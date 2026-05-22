"""Validation et consolidation des candidats proposés.

Deux étapes distinctes :

* `validate_candidate` — validation STRUCTURELLE déterministe, en CONTENANCE
  pure (`verify_claim` à effort 0). Statuts : `unknown_term`, `duplicate`,
  `inconsistent` (triplet déjà nié explicitement dans JDM), `ok`.

* `consolidate_candidate` — consolidation SÉMANTIQUE par INFÉRENCE. Cherche
  si le réseau JDM permet de déduire (ou de réfuter) le triplet. Statuts :
  `consolidated` (déduit → point d'entrée vers la soumission),
  `rejected` (réfuté), `not_consolidated` (silence — pas forcément faux).
"""
from __future__ import annotations

from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.enrich.models import Candidate
from jdm_agent.factcheck import Claim
from jdm_agent.factcheck.models import Status
from jdm_agent.factcheck.verifier import verify_claim


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

    # 2. Le triplet existe-t-il déjà ? (= déjà couvert, rien à ajouter)
    # effort=0 : un doublon = littéralement présent — contenance stricte.
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
