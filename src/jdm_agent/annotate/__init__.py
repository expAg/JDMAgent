"""Annotation sémantique de triplets JDM (constitutif / contrastif /
non spécifique / exception).

Le LLM est l'oracle : il pose un jugement linguistique de locuteur sur
chaque lien (sujet | relation | objet). Pas de consolidation par
inférence — on qualifie un triplet existant, pas un triplet candidat.

Output : fichier `.annot` à deux sections (annotations + signalement
des désaccords avec JDM existant).
"""
from jdm_agent.annotate.models import (
    AnnotationCategory, AnnotationProposal, parse_category,
)
from jdm_agent.annotate.proposer import propose_annotations
from jdm_agent.annotate.pipeline import (
    DEFAULT_ANNOTATION_RELATIONS, annotate, write_annotation_file,
)

__all__ = [
    "AnnotationCategory", "AnnotationProposal", "parse_category",
    "propose_annotations",
    "DEFAULT_ANNOTATION_RELATIONS", "annotate", "write_annotation_file",
]
