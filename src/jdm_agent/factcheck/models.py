"""Modèles Pydantic pour le fact-checker."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Status(str, Enum):
    SUPPORTED = "supported"        # JDM confirme directement le triplet
    CONTRADICTED = "contradicted"  # JDM contient une info incompatible
    UNKNOWN = "unknown"            # JDM ne dit rien à ce sujet


class Claim(BaseModel):
    """Une affirmation atomique extraite d'un texte, sous forme structurée.

    `polarity = False` signifie une négation ("La baleine N'EST PAS un poisson").
    """
    model_config = ConfigDict(extra="ignore")

    text: str = Field(..., description="Formulation originale de l'affirmation")
    subject: str = Field(..., description="Terme source (en minuscule, à l'infinitif si verbe)")
    relation: str = Field(..., description="Nom technique JDM (r_isa, r_carac, r_has_color, r_agent, r_patient, ...)")
    object: str = Field(..., description="Terme cible de la relation")
    polarity: bool = Field(True, description="True = affirmation, False = négation")


class Evidence(BaseModel):
    """Un triplet JDM qui sert de preuve pour/contre une claim."""
    source: str
    relation: str
    target: str
    w: float
    # Identifiants bruts si refinements (rarement nécessaires pour le fact-checking).
    source_id: Optional[str] = None
    target_id: Optional[str] = None


class Verdict(BaseModel):
    """Le verdict de vérification pour une `Claim`.

    `inference_schema` est `None` pour un verdict obtenu par lookup DIRECT
    (contenance JDM). Il porte le nom du schéma quand le verdict provient du
    moteur d'inférence (Phase 11) — la `inference_proof` détaille alors la
    chaîne de déduction.
    """
    claim: Claim
    status: Status
    confidence: float = Field(0.0, ge=0.0, le=1.0,
                              description="Confiance dans le verdict (0-1)")
    evidence_for: List[Evidence] = Field(default_factory=list)
    evidence_against: List[Evidence] = Field(default_factory=list)
    explanation: str = ""
    inference_schema: Optional[str] = Field(
        None, description="Nom du schéma d'inférence (None = verdict direct)")
    inference_proof: List[Evidence] = Field(
        default_factory=list,
        description="Chaîne de triplets justifiant un verdict inféré")


class Report(BaseModel):
    """Rapport global d'un fact-check (sur un texte ou une batch de claims)."""
    text: str = ""
    verdicts: List[Verdict] = Field(default_factory=list)

    def summary(self) -> dict:
        c = {s.value: 0 for s in Status}
        for v in self.verdicts:
            c[v.status.value] += 1
        return {"total": len(self.verdicts), **c}
