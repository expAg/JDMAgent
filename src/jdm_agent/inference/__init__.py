"""Moteur d'inférence JDM (Phase 11).

Décide si un triplet (subject, relation, object) est vrai *par déduction*
dans le graphe — au-delà du simple lookup direct. Réutilisé par
`verify_claim` (repli inférence) et par la consolidation de l'enrichissement.
"""
from jdm_agent.inference.budget import BudgetExhausted, LookupBudget
from jdm_agent.inference.constants import (
    BUDGET_BY_EFFORT,
    DEFAULT_MAX_DEPTH,
    DEFAULT_TOP_K,
    INVERSE_RELATIONS,
    TRANSITIVE_RELATIONS,
)
from jdm_agent.inference.engine import infer
from jdm_agent.inference.models import FiredSchema, InferenceResult, ProofStep

__all__ = [
    "infer",
    "InferenceResult",
    "ProofStep",
    "FiredSchema",
    "LookupBudget",
    "BudgetExhausted",
    "INVERSE_RELATIONS",
    "TRANSITIVE_RELATIONS",
    "BUDGET_BY_EFFORT",
    "DEFAULT_MAX_DEPTH",
    "DEFAULT_TOP_K",
]
