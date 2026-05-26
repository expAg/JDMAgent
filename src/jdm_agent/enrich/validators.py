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

# Path d'append automatique pour les consolidations. Quand non-None,
# register_consolidation() écrit chaque triplet consolidé en mode
# append dans ce fichier IMMÉDIATEMENT après l'avoir ajouté au
# registry. Permet à l'UI Gradio (et au mcp client) de voir le
# fichier grossir en temps réel, sans dépendre du LLM appelant
# write_submission_file (qui écraserait à chaque appel).
_CONSOLIDATION_OUTPUT_PATH: Optional[str] = None
_CONSOLIDATION_OUTPUT_HEADER_WRITTEN: bool = False


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


def set_consolidation_output_path(path: Optional[str]) -> None:
    """Active l'écriture automatique en mode APPEND : chaque appel à
    `register_consolidation` écrit la ligne du triplet consolidé dans
    `path` immédiatement après l'avoir ajouté au registry.

    Permet à l'UI (Gradio gr.File) de voir le fichier grossir en temps
    réel sans dépendre du LLM appelant `write_submission_file`. Le
    fichier reçoit un header de soumission JeuxDeMots au PREMIER append.

    Passer `None` désactive l'auto-append (reset du flag header).
    """
    global _CONSOLIDATION_OUTPUT_PATH, _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
    with _REGISTRY_LOCK:
        _CONSOLIDATION_OUTPUT_PATH = path
        _CONSOLIDATION_OUTPUT_HEADER_WRITTEN = False


def get_consolidation_output_path() -> Optional[str]:
    """Retourne le path d'auto-append courant, ou None si désactivé."""
    with _REGISTRY_LOCK:
        return _CONSOLIDATION_OUTPUT_PATH


def _append_consolidation_to_file(term: str, relation: str, target: str,
                                   explanation: str) -> None:
    """Écrit une ligne `term | relation | target |  < explanation >`
    en APPEND dans le path configuré par `set_consolidation_output_path`.
    No-op si aucun path n'est défini. Crée le dossier parent si absent.
    Écrit un header de soumission lors du PREMIER append.

    Appelé sous `_REGISTRY_LOCK` par `register_consolidation`.
    L'écriture file est rapide (~ms) ; le lock reste bref.

    Pas de décodage des raffinements ici (raw `term>id` reste raw) —
    le décodage propre est fait par la fusion finale via
    `pipeline.write_submission`. Trade-off : visibilité temps réel
    prime sur la cosmétique des noms.
    """
    global _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
    if _CONSOLIDATION_OUTPUT_PATH is None:
        return
    try:
        from pathlib import Path as _Path
        p = _Path(_CONSOLIDATION_OUTPUT_PATH)
        p.parent.mkdir(parents=True, exist_ok=True)
        write_header = not _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
        expl = " ".join((explanation or "").split())
        with p.open("a", encoding="utf-8") as f:
            if write_header:
                f.write(
                    "# Soumission JeuxDeMots — fichier d'enrichissement.\n"
                    "# Format : terme | relation | cible | annotation < explication >\n\n"
                )
                _CONSOLIDATION_OUTPUT_HEADER_WRITTEN = True
            f.write(f"{term} | {relation} | {target} |  < {expl} >\n")
    except Exception:
        pass  # silent fail : le registry continue à fonctionner


def register_consolidation(term: str, relation: str, target: str,
                            explanation: str, schema: Optional[str] = None) -> None:
    """Stocke l'explication d'inférence produite par `infer()` pour ce
    triplet. Appelé par `consolidate_candidate` quand le triplet est
    confirmé. No-op si aucun `exclusion_context()` actif.

    Si `set_consolidation_output_path` a été appelé, écrit également
    la ligne en APPEND dans ce fichier (auto-append temps réel).
    Déduplication : si le triplet est déjà dans le registry, on
    ne l'écrit PAS une 2e fois (évite les doublons dans le fichier
    append-only).
    """
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return
        key = _norm_consolidation_key(term, relation, target)
        is_new = key not in _CONSOLIDATION_REGISTRY
        _CONSOLIDATION_REGISTRY[key] = {
            "explanation": (explanation or "").strip(),
            "schema": (schema or "").strip(),
        }
        if is_new:
            _append_consolidation_to_file(term, relation, target, explanation)


def get_consolidation(term: str, relation: str, target: str) -> Optional[dict]:
    """Récupère l'explication d'inférence stockée pour ce triplet, si
    elle existe. None si pas trouvée. Utilisé par `write_submission_file`
    pour OVERRIDER une éventuelle explanation custom du LLM."""
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return None
        key = _norm_consolidation_key(term, relation, target)
        return _CONSOLIDATION_REGISTRY.get(key)


def count_consolidations() -> int:
    """Renvoie le NOMBRE CUMULATIF de triplets consolidés depuis l'entrée
    dans `exclusion_context()` — incluant TOUTES les relances persistance.

    Source de vérité pour le compteur de progression du flow d'enrichissement.
    À PRÉFÉRER à `count_consolidated_in_messages(accumulated_messages)` qui
    ne voit que les ToolMessages du tour COURANT (l'accumulated_messages
    étant reset à chaque relance via `build_relance_summary`).

    Renvoie 0 hors `exclusion_context()` (registry None)."""
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return 0
        return len(_CONSOLIDATION_REGISTRY)


def list_consolidations() -> list[dict]:
    """Renvoie la LISTE des triplets consolidés depuis l'entrée dans
    `exclusion_context()` (incluant toutes les relances). Format :
    [{term, relation, target, explanation, schema}, ...]. Liste vide
    hors contexte. Utile pour une fusion finale (option B) ou un dump
    complet en fin de flow."""
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return []
        return [
            {
                "term": k[0], "relation": k[1], "target": k[2],
                "explanation": v.get("explanation", ""),
                "schema": v.get("schema", ""),
            }
            for k, v in _CONSOLIDATION_REGISTRY.items()
        ]


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
