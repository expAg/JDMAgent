"""Validation des candidats proposés.

Quatre checks :
  - duplicate    : le triplet existe déjà dans JDM (rien à enrichir)
  - unknown_term : la cible proposée n'existe pas comme nœud JDM
  - inconsistent : la cible viole une contrainte (ex. r_isa-incompatible pour r_isa)
  - ok           : prêt à soumettre
"""
from __future__ import annotations

from jdm_agent.client import JDMClient
from jdm_agent.enrich.models import Candidate
from jdm_agent.factcheck import Claim
from jdm_agent.factcheck.verifier import verify_claim
from jdm_agent.factcheck.models import Status


def validate_candidate(client: JDMClient, candidate: Candidate) -> Candidate:
    """Annote le candidat en place avec validation_status / validation_note."""
    # 1. La cible existe-t-elle dans JDM ?
    try:
        client.node_by_name(candidate.target)
    except Exception:
        candidate.validation_status = "unknown_term"
        candidate.validation_note = f"Le terme {candidate.target!r} n'existe pas dans JDM."
        return candidate

    # 2. Le triplet existe-t-il déjà ? (= déjà couvert, rien à ajouter)
    claim = Claim(
        text=f"{candidate.term} | {candidate.relation} | {candidate.target}",
        subject=candidate.term, relation=candidate.relation, object=candidate.target,
    )
    verdict = verify_claim(client, claim)
    if verdict.status == Status.SUPPORTED and verdict.evidence_for:
        # On considère "duplicate" si la preuve est DIRECTE (pas via synonyme).
        ev = verdict.evidence_for[0]
        if ev.target.lower().strip() == candidate.target.lower().strip():
            candidate.validation_status = "duplicate"
            candidate.validation_note = (
                f"Déjà présent : {ev.source} | {ev.relation} | {ev.target} (w={ev.w:.0f})."
            )
            return candidate

    # 3. Inconsistance ? (le verifier détecte les contradictions explicites)
    if verdict.status == Status.CONTRADICTED:
        candidate.validation_status = "inconsistent"
        candidate.validation_note = (
            f"Contradiction JDM : {verdict.explanation}"
        )
        # On pénalise la confidence.
        candidate.confidence = min(candidate.confidence, 0.1)
        return candidate

    # 4. OK
    candidate.validation_status = "ok"
    candidate.validation_note = (
        "Prêt à soumettre — non-dupliqué, cible connue de JDM, aucune contradiction détectée."
    )
    return candidate
