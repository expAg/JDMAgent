"""Modèles Pydantic du moteur d'inférence JDM (Phase 11)."""
from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class FiredSchema(str, Enum):
    """Schéma d'inférence ayant produit le résultat.

    L'énumération est complète dès le départ (sérialisation stable) même si
    certains schémas ne sont activés qu'à l'effort 2.
    """
    NONE             = "none"               # aucun schéma — silence
    TAUTOLOGY        = "tautology"           # subject == object, relation réflexive
    CONTRADICTION    = "contradiction"       # subject == object, relation antonymique
    INVERSE          = "inverse"             # (object, R⁻¹, subject)
    IMPLICATION      = "implication"         # R impliquée par une R' plus spécifique
    SYNONYM_EQUIV    = "synonym_equiv"       # via un synonyme de l'object
    ISA_INCOMPATIBLE = "isa_incompatible"    # réfutation via r_isa-incompatible
    CLASS_ELIM       = "class_elimination"   # réfutation : la classe de A nie R B
    DEDUCTION_ISA    = "deduction_isa"       # A r_isa/r_syn G, G R B
    TRANSITIVITY     = "transitivity"        # A R X, X R B (relation transitive)
    TARGET_GENERIC   = "target_generic"      # A R G, G générique de l'object
    DOUBLE_ISA       = "double_isa"          # A r_isa X, B r_isa Y, X R Y
    COMPOSITION      = "composition"         # A R2 C, C R3 B ⟹ A R B
    PREFIX           = "prefix"              # préfixe lexical (saucisse de Toulouse)
    HYPONYM_PROP     = "hyponym_propagation" # A R H, H r_isa B ⟹ A R B
    ASSOC_BRIDGE     = "assoc_bridge"        # A R T, T ≈ B (synonyme / associé)
    COHYPONYM        = "cohyponym"           # cohyponymes (réservé, effort 2)


class ProofStep(BaseModel):
    """Un triplet JDM élémentaire dans la chaîne de preuve d'une inférence."""
    source: str
    relation: str
    target: str
    w: float
    note: str = ""


class InferenceResult(BaseModel):
    """Résultat d'une inférence sur le triplet (subject, relation, object).

    `signed_weight` porte le verdict :
      * > 0 → le triplet est jugé VRAI par inférence
      * < 0 → le triplet est jugé FAUX / réfuté
      * = 0 → silence (aucun schéma n'a conclu)
    """
    model_config = ConfigDict(extra="ignore")

    subject: str
    relation: str
    object: str
    signed_weight: float = 0.0
    fired_schema: FiredSchema = FiredSchema.NONE
    proof: List[ProofStep] = Field(default_factory=list)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    lookups_used: int = 0
    explanation: str = ""

    @property
    def is_true(self) -> bool:
        return self.signed_weight > 0

    @property
    def is_false(self) -> bool:
        return self.signed_weight < 0

    @property
    def is_silent(self) -> bool:
        return self.signed_weight == 0
