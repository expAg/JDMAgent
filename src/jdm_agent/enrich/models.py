"""Modèles pour l'enrichissement."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class GapType(str, Enum):
    MISSING         = "missing"          # aucune triplet pour (term, relation)
    LOW_COVERAGE    = "low_coverage"     # < N triplets positifs
    NEGATIVE_FILLED = "negative_filled"  # que des triplets négatifs (JDM a dit non)


class Gap(BaseModel):
    """Un trou identifié dans le graphe JDM."""
    term: str = Field(..., description="Le terme analysé")
    relation: str = Field(..., description="Relation JDM ciblée (r_xxx)")
    gap_type: GapType
    severity: float = Field(0.0, ge=0.0, le=1.0,
                            description="Force du signal (0=faible, 1=très forte)")
    detail: str = ""
    # Pour les asymétries : référence aux triplets en place côté inverse.
    related_triples: List[dict] = Field(default_factory=list)


class Candidate(BaseModel):
    """Un triplet candidat proposé pour combler un gap."""
    term: str
    relation: str
    target: str = Field(..., description="Terme cible proposé")
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    rationale: str = ""
    source: str = Field("unknown", description="LLM | inference | external")
    annotation: str = Field(
        "", description="Annotation sémantique suggérée (constitutif, "
        "contrastif, ...) — vide si aucune")
    # Validation STRUCTURELLE (déterministe, contenance) :
    validation_status: Optional[str] = None  # "ok" | "duplicate" | "unknown_term" | "inconsistent"
    validation_note: str = ""
    # Consolidation SÉMANTIQUE par inférence (Phase 11) :
    #   "consolidated"     — l'inférence confirme le triplet (→ soumission)
    #   "not_consolidated" — silence de l'inférence (pas forcément faux)
    #   "rejected"         — l'inférence réfute le triplet
    consolidation_status: Optional[str] = None
    consolidation_schema: Optional[str] = None
    consolidation_explanation: str = ""

    def is_valid(self) -> bool:
        return self.validation_status in (None, "ok")

    def is_consolidated(self) -> bool:
        return self.consolidation_status == "consolidated"
