"""Enrichissement actif du graphe JeuxDeMots.

Détecte les trous de couverture, propose des triplets candidats, valide,
émet un rapport CSV à soumettre à la modération JDM (l'API publique étant
en lecture seule, on ne pousse pas directement dans JDM).
"""
from jdm_agent.enrich.models import Gap, Candidate, GapType
from jdm_agent.enrich.detectors import detect_gaps, DEFAULT_TARGET_RELATIONS
from jdm_agent.enrich.proposers import propose_candidates
from jdm_agent.enrich.validators import (
    validate_candidate, consolidate_candidate,
    count_consolidations, list_consolidations,
    set_consolidation_output_path, get_consolidation_output_path,
    is_run_output_path, register_run_output_path, list_run_output_paths,
)
from jdm_agent.enrich.pipeline import (
    enrich, write_candidates_csv, write_submission,
    compute_submission_filename,
)
from jdm_agent.enrich.uploader import submit_to_jdm, DEFAULT_ENDPOINT_URL

__all__ = [
    "Gap", "Candidate", "GapType",
    "detect_gaps", "DEFAULT_TARGET_RELATIONS",
    "propose_candidates", "validate_candidate", "consolidate_candidate",
    "count_consolidations", "list_consolidations",
    "set_consolidation_output_path", "get_consolidation_output_path",
    "is_run_output_path", "register_run_output_path", "list_run_output_paths",
    "enrich", "write_candidates_csv", "write_submission",
    "compute_submission_filename", "submit_to_jdm", "DEFAULT_ENDPOINT_URL",
]
