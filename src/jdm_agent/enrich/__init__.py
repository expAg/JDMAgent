"""Enrichissement actif du graphe JeuxDeMots.

Détecte les trous de couverture, propose des triplets candidats, valide,
émet un rapport CSV à soumettre à la modération JDM (l'API publique étant
en lecture seule, on ne pousse pas directement dans JDM).
"""
from jdm_agent.enrich.models import Gap, Candidate, GapType
from jdm_agent.enrich.detectors import detect_gaps, DEFAULT_TARGET_RELATIONS
from jdm_agent.enrich.proposers import propose_candidates
from jdm_agent.enrich.validators import validate_candidate, consolidate_candidate
from jdm_agent.enrich.pipeline import enrich, write_candidates_csv, write_submission

__all__ = [
    "Gap", "Candidate", "GapType",
    "detect_gaps", "DEFAULT_TARGET_RELATIONS",
    "propose_candidates", "validate_candidate", "consolidate_candidate",
    "enrich", "write_candidates_csv", "write_submission",
]
