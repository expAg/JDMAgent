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


# ---------- Registry d'exclusion (option A) ----------

_EXCLUSION_REGISTRY: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "jdm_enrich_exclusion", default=None
)

# Registry des explications de consolidation produites par `infer()`.
# Indexé par (term_normé, relation_normée, target_normée). Rempli par
# `consolidate_candidate` quand status="consolidated". Re-lu par
# `write_submission_file` pour OVERRIDER une éventuelle explanation
# custom passée par le LLM (qui aurait tendance à mettre sa propre
# formulation naturelle au lieu de la chaîne d'inférence formelle).
_CONSOLIDATION_REGISTRY: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "jdm_enrich_consolidation", default=None
)


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
    """Crée des registries frais (exclusion + consolidation) pour la
    durée d'une invocation agent.

    Sans ce contexte, les helpers sont des no-ops — le comportement
    précédent (verify_claim a posteriori, explanation custom du LLM)
    est préservé.

    Implémentation : on N'UTILISE PAS `reset(token)` car LangGraph fait
    tourner l'agent dans un contexte (asyncio/threading) différent de
    celui où le `with` a démarré → ValueError("Token … was created in a
    different Context") à la sortie. À la place, on `set(None)` pour
    invalider le registry.
    """
    _EXCLUSION_REGISTRY.set({})
    _CONSOLIDATION_REGISTRY.set({})
    try:
        yield
    finally:
        try:
            _EXCLUSION_REGISTRY.set(None)
        except Exception:
            pass
        try:
            _CONSOLIDATION_REGISTRY.set(None)
        except Exception:
            pass


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
    reg = _CONSOLIDATION_REGISTRY.get()
    if reg is None:
        return
    key = _norm_consolidation_key(term, relation, target)
    reg[key] = {
        "explanation": (explanation or "").strip(),
        "schema": (schema or "").strip(),
    }


def get_consolidation(term: str, relation: str, target: str) -> Optional[dict]:
    """Récupère l'explication d'inférence stockée pour ce triplet, si
    elle existe. None si pas trouvée. Utilisé par `write_submission_file`
    pour OVERRIDER une éventuelle explanation custom du LLM."""
    reg = _CONSOLIDATION_REGISTRY.get()
    if reg is None:
        return None
    key = _norm_consolidation_key(term, relation, target)
    return reg.get(key)


def register_exclusion(term: str, relation: str, exclusion_set) -> None:
    """Stocke la liste de cibles déjà présentes pour (term, relation).
    Appelé par `list_existing_for_enrichment` après son fetch.
    No-op si aucun `exclusion_context()` n'est actif."""
    reg = _EXCLUSION_REGISTRY.get()
    if reg is None:
        return
    reg[_norm_key(term, relation)] = set(exclusion_set or [])


def is_excluded(term: str, relation: str, target: str) -> Optional[str]:
    """Retourne None si la cible n'est pas dans l'exclusion enregistrée,
    sinon un message court qui rappelle au LLM qu'il avait l'info.
    No-op (None) si aucun `exclusion_context()` n'est actif ou si pas
    de pré-fetch enregistré pour ce (term, relation)."""
    reg = _EXCLUSION_REGISTRY.get()
    if reg is None:
        return None
    excl = reg.get(_norm_key(term, relation))
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
