"""Modèles pour le flow Annotation.

L'annotation qualifie un LIEN entre deux nœuds JDM (un triplet existant)
selon une taxonomie sémantique stricte de 4 catégories. L'annotation
porte sur le lien spécifique avec la cible, pas sur le sujet ni sur la
cible eux-mêmes.

Voir `relation_definitions.md` §22 pour la spec complète de la taxonomie.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AnnotationCategory(str, Enum):
    """Les 4 catégories d'annotation sémantique de JDM utilisées par ce flow.

    Vide (`""`) est une réponse valide du LLM : aucune catégorie ne
    s'applique, on ne force pas une annotation arbitraire. Ces triplets-
    là ne sont PAS écrits dans le fichier `.annot`.
    """
    CONSTITUTIF    = "constitutif"
    CONTRASTIF     = "contrastif"
    NON_SPECIFIQUE = "non spécifique"
    EXCEPTION      = "exception"


# Mapping ASCII pour parsing tolérant (LLM peut écrire "non specifique"
# sans accent ; on accepte les deux formes).
CATEGORY_ASCII_ALIASES = {
    "constitutif":    AnnotationCategory.CONSTITUTIF,
    "contrastif":     AnnotationCategory.CONTRASTIF,
    "non specifique": AnnotationCategory.NON_SPECIFIQUE,
    "non spécifique": AnnotationCategory.NON_SPECIFIQUE,
    "non-specifique": AnnotationCategory.NON_SPECIFIQUE,
    "non-spécifique": AnnotationCategory.NON_SPECIFIQUE,
    "non_specifique": AnnotationCategory.NON_SPECIFIQUE,
    "exception":      AnnotationCategory.EXCEPTION,
}


def parse_category(raw: Optional[str]) -> Optional[AnnotationCategory]:
    """Tolère espaces, casse, accents manquants. None si vide / inconnu."""
    if not raw:
        return None
    key = raw.strip().lower()
    return CATEGORY_ASCII_ALIASES.get(key)


class AnnotationProposal(BaseModel):
    """Une proposition d'annotation pour un triplet JDM.

    `category` est `None` si le LLM n'a pas pu rattacher le triplet à
    une catégorie de la taxonomie (= triplet non annotable).
    `existing_jdm` capture l'annotation déjà présente dans JDM (via
    `get_triplet_annotations`) au moment de la proposition — utile pour
    la section SIGNALEMENT quand le LLM est en désaccord.
    """
    subject: str = Field(..., description="Sujet (terme JDM, peut être raffiné)")
    relation: str = Field(..., description="Relation JDM (r_xxx)")
    target:  str = Field(..., description="Objet (terme JDM, peut être raffiné)")
    category: Optional[AnnotationCategory] = Field(
        None, description="Catégorie proposée ; None si non annotable")
    justification: str = Field(
        "", description="Phrase courte expliquant le choix (ou son absence)")
    existing_jdm: Optional[str] = Field(
        None,
        description="Annotation JDM préexistante (chaîne brute) si récupérée,"
                    " sinon None. Sert au repérage des désaccords.")

    def disagrees_with_jdm(self) -> bool:
        """True si JDM avait une annotation ET qu'elle diffère de la nôtre."""
        if not self.existing_jdm or not self.category:
            return False
        # Normalise les deux et compare. Tolère les espaces / casse.
        ours_norm = self.category.value.strip().lower()
        theirs_norm = (self.existing_jdm or "").strip().lower()
        return bool(theirs_norm) and theirs_norm != ours_norm

    def is_annotable(self) -> bool:
        return self.category is not None
