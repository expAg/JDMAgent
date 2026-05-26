"""Validation et consolidation des candidats proposés.

Deux étapes distinctes :

* `validate_candidate` — validation STRUCTURELLE déterministe, en CONTENANCE
  pure (`verify_claim` à effort 0). Statuts : `unknown_term`, `duplicate`,
  `inconsistent` (triplet déjà nié explicitement dans JDM), `ok`.

* `consolidate_candidate` — consolidation SÉMANTIQUE par INFÉRENCE. Cherche
  si le réseau JDM permet de déduire (ou de réfuter) le triplet. Statuts :
  `consolidated` (déduit → point d'entrée vers la soumission),
  `rejected` (réfuté), `not_consolidated` (silence — pas forcément faux).

Registry d'exclusion (option A — anti-doublons) :
  ContextVar `_EXCLUSION_REGISTRY` qui stocke, par (term, relation), la
  liste normalisée des cibles déjà connues dans JDM (renseignée par
  `list_existing_for_enrichment` au moment du pré-fetch). Quand le LLM
  appelle ensuite `validate_candidate` sur un candidat dont la cible est
  dans cette liste, on court-circuite SANS appeler verify_claim (pas
  d'HTTP, pas d'inférence) et on retourne immédiatement
  validation_status="duplicate" avec un message qui rappelle au LLM
  qu'il avait l'info.

  Le registry vit pendant une invocation agent — encadrer le streaming
  par `with exclusion_context(): ...`. Hors contexte, registry=None et
  toutes les fonctions sont des no-ops (compat 100% avec l'existant).
"""
from __future__ import annotations

import contextvars
import unicodedata
from contextlib import contextmanager
from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.enrich.models import Candidate
from jdm_agent.factcheck import Claim
from jdm_agent.factcheck.models import Status
from jdm_agent.factcheck.verifier import verify_claim


# ---------- Registries partagés thread-safe ----------
#
# IMPORTANT : on N'UTILISE PAS ContextVar pour ces registries. Raison :
# LangChain exécute les tools dans des threads worker (ThreadPoolExecutor)
# qui ne préservent PAS le contexte ContextVar du parent. Résultat :
# register_consolidation() depuis le tool validate_candidate écrivait
# dans un dict isolé du thread, get_consolidation() depuis le tool
# write_submission_file lisait None → tous les triplets skippés
# silencieusement → fichier .enrich vide.
#
# À la place : dict global module-level + Lock. Activé/désactivé par
# `exclusion_context()` via un compteur (pour supporter le nesting).
# Trade-off accepté : pas d'isolation per-user en cas de concurrent
# heavy multi-user — mais les keys sont (term, relation, target) qui
# sont stables, et chaque write_submission_file ne consulte que les
# triplets que SON LLM lui passe → pas de fuite de contenu entre users.
import threading

_REGISTRY_LOCK = threading.RLock()
_EXCLUSION_REGISTRY: Optional[dict] = None
_CONSOLIDATION_REGISTRY: Optional[dict] = None
_CONTEXT_DEPTH = 0  # compteur de nesting d'exclusion_context()


def _norm_target(s: str) -> str:
    """Normalisation cohérente avec `jdm_tools._norm` utilisé dans
    list_existing_for_enrichment : NFKD + suppression diacritiques +
    lowercase + strip. Doit matcher EXACTEMENT la normalisation stockée."""
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(ch for ch in s if not unicodedata.combining(ch)).lower().strip()


def _norm_key(term: str, relation: str) -> tuple[str, str]:
    return (_norm_target(term), (relation or "").strip().lower())


@contextmanager
def exclusion_context():
    """Active les registries partagés (exclusion + consolidation) pour la
    durée d'une invocation agent.

    Sans ce contexte, les helpers sont des no-ops — le comportement
    précédent (verify_claim a posteriori, explanation custom du LLM)
    est préservé.

    Implémentation : dict module-level + Lock + compteur de nesting.
    Anciennement basé sur ContextVar mais LangChain exécute les tools
    dans des threads worker qui ne préservent pas le ContextVar du
    parent → registry None dans le tool → register/get no-ops →
    fichier .enrich vide. Le dict global avec Lock est cross-thread,
    le compteur supporte le nesting (plusieurs invocations imbriquées
    partagent le même dict, seule la SORTIE la plus externe le vide).
    """
    global _EXCLUSION_REGISTRY, _CONSOLIDATION_REGISTRY, _CONTEXT_DEPTH
    with _REGISTRY_LOCK:
        if _CONTEXT_DEPTH == 0:
            _EXCLUSION_REGISTRY = {}
            _CONSOLIDATION_REGISTRY = {}
        _CONTEXT_DEPTH += 1
    try:
        yield
    finally:
        with _REGISTRY_LOCK:
            _CONTEXT_DEPTH = max(0, _CONTEXT_DEPTH - 1)
            if _CONTEXT_DEPTH == 0:
                _EXCLUSION_REGISTRY = None
                _CONSOLIDATION_REGISTRY = None


# ---------- Registry de consolidation ----------

def _norm_consolidation_key(term: str, relation: str, target: str) -> tuple[str, str, str]:
    return (
        _norm_target(term),
        (relation or "").strip().lower(),
        _norm_target(target),
    )


def register_consolidation(term: str, relation: str, target: str,
                            explanation: str, schema: Optional[str] = None) -> None:
    """Stocke l'explication d'inférence produite par `infer()` pour ce
    triplet. Appelé par `consolidate_candidate` quand le triplet est
    confirmé. No-op si aucun `exclusion_context()` actif."""
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return
        key = _norm_consolidation_key(term, relation, target)
        _CONSOLIDATION_REGISTRY[key] = {
            "explanation": (explanation or "").strip(),
            "schema": (schema or "").strip(),
        }


def get_consolidation(term: str, relation: str, target: str) -> Optional[dict]:
    """Récupère l'explication d'inférence stockée pour ce triplet, si
    elle existe. None si pas trouvée. Utilisé par `write_submission_file`
    pour OVERRIDER une éventuelle explanation custom du LLM."""
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return None
        key = _norm_consolidation_key(term, relation, target)
        return _CONSOLIDATION_REGISTRY.get(key)


def register_exclusion(term: str, relation: str, exclusion_set) -> None:
    """Stocke la liste de cibles déjà présentes pour (term, relation).
    Appelé par `list_existing_for_enrichment` après son fetch.
    No-op si aucun `exclusion_context()` n'est actif."""
    with _REGISTRY_LOCK:
        if _EXCLUSION_REGISTRY is None:
            return
        _EXCLUSION_REGISTRY[_norm_key(term, relation)] = set(exclusion_set or [])


def is_excluded(term: str, relation: str, target: str) -> Optional[str]:
    """Retourne None si la cible n'est pas dans l'exclusion enregistrée,
    sinon un message court qui rappelle au LLM qu'il avait l'info.
    No-op (None) si aucun `exclusion_context()` n'est actif ou si pas
    de pré-fetch enregistré pour ce (term, relation)."""
    with _REGISTRY_LOCK:
        if _EXCLUSION_REGISTRY is None:
            return None
        excl = _EXCLUSION_REGISTRY.get(_norm_key(term, relation))
    if not excl:
        return None
    if _norm_target(target) in excl:
        return (
            f"Déjà vu lors du pré-fetch `list_existing_for_enrichment("
            f"term='{term}', relation_name='{relation}')`. Tu avais "
            f"la cible « {target} » dans l'exclusion_set — propose autre chose."
        )
    return None


# ---------- Validation et consolidation ----------


def validate_candidate(client: JDMClient, candidate: Candidate) -> Candidate:
    """Annote le candidat avec validation_status / validation_note.

    Validation STRUCTURELLE en contenance pure (pas d'inférence) : on regarde
    uniquement ce que JDM contient littéralement.
    """
    # 1. La cible existe-t-elle dans JDM ?
    try:
        client.node_by_name(candidate.target)
    except Exception:
        candidate.validation_status = "unknown_term"
        candidate.validation_note = f"Le terme {candidate.target!r} n'existe pas dans JDM."
        return candidate

    # 1.5 FAST-PATH option A : si le pré-fetch a été fait pour ce
    # (term, relation) et que la cible y figure, on court-circuite sans
    # appeler verify_claim — message éducatif pour faire reculer le LLM.
    excl_msg = is_excluded(candidate.term, candidate.relation, candidate.target)
    if excl_msg:
        candidate.validation_status = "duplicate"
        candidate.validation_note = excl_msg
        return candidate

    # 2. Le triplet existe-t-il déjà ? (= déjà couvert, rien à ajouter)
    # effort=0 : un doublon = littéralement présent — contenance stricte.
    # Cas où on arrive ici : pas de pré-fetch enregistré pour ce couple
    # (LLM a sauté l'étape, ou pre-fetch sur autre relation, etc.) — on
    # paie un appel HTTP de plus à titre de filet de sécurité.
    claim = Claim(
        text=f"{candidate.term} | {candidate.relation} | {candidate.target}",
        subject=candidate.term, relation=candidate.relation, object=candidate.target,
    )
    verdict = verify_claim(client, claim, effort=0)
    if verdict.status == Status.SUPPORTED and verdict.evidence_for:
        ev = verdict.evidence_for[0]
        if ev.target.lower().strip() == candidate.target.lower().strip():
            candidate.validation_status = "duplicate"
            candidate.validation_note = (
                f"Déjà présent : {ev.source} | {ev.relation} | {ev.target} (w={ev.w:.0f})."
            )
            return candidate

    # 3. Incohérence directe ? (triplet explicitement nié dans JDM, w<0)
    if verdict.status == Status.CONTRADICTED:
        candidate.validation_status = "inconsistent"
        candidate.validation_note = f"Contradiction JDM directe : {verdict.explanation}"
        candidate.confidence = min(candidate.confidence, 0.1)
        return candidate

    # 4. OK structurellement
    candidate.validation_status = "ok"
    candidate.validation_note = (
        "Validé structurellement — non-dupliqué, cible connue de JDM, "
        "aucune négation directe."
    )
    return candidate


def consolidate_candidate(client: JDMClient, candidate: Candidate, *,
                          effort: int = 1,
                          budget: Optional[int] = None) -> Candidate:
    """Consolide un candidat par INFÉRENCE dans le réseau JDM.

    Tente de déduire le triplet à partir du graphe :
      * déduit  → `consolidation_status = "consolidated"` (prêt pour soumission)
      * réfuté  → `"rejected"` (+ confidence abaissée)
      * silence → `"not_consolidated"` (« pas forcément faux » — simplement
        non démontrable par les schémas actuels)

    La chaîne d'inférence devient `consolidation_explanation` (justification
    « oui parce que … » / « non parce que … »).
    """
    from jdm_agent.inference import infer

    res = infer(client, candidate.term, candidate.relation, candidate.target,
                effort=effort, budget=budget)

    if res.is_true:
        candidate.consolidation_status = "consolidated"
        candidate.consolidation_schema = res.fired_schema.value
        candidate.consolidation_explanation = res.explanation
        # Enregistre dans le registry partagé pour que write_submission_file
        # puisse OVERRIDER une éventuelle explanation custom du LLM par
        # cette explication formelle issue du moteur d'inférence.
        register_consolidation(
            candidate.term, candidate.relation, candidate.target,
            res.explanation, res.fired_schema.value,
        )
    elif res.is_false:
        candidate.consolidation_status = "rejected"
        candidate.consolidation_schema = res.fired_schema.value
        candidate.consolidation_explanation = res.explanation
        candidate.confidence = min(candidate.confidence, 0.1)
    else:
        candidate.consolidation_status = "not_consolidated"
        candidate.consolidation_schema = None
        candidate.consolidation_explanation = (
            "Inférence silencieuse — non démontré dans JDM (pas forcément faux)."
        )
    return candidate
