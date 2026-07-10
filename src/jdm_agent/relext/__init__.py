"""Extraction de relations sémantiques JeuxDeMots.

Deux moteurs :
- `extract_syntactic` (dépendances UDPipe) : chunks nominaux = mots composés issus
  de la grammaire, rattachement au sujet syntaxique. Nécessite le réseau (lindat).
- `extract_relations` (patrons de surface + JDM) : repli hors-ligne / si UDPipe KO.
`extract_best` tente la syntaxe, sinon la surface.
"""
from jdm_agent.relext.extractor import extract_relations, load_patterns
from jdm_agent.relext.syntactic import extract_syntactic

__all__ = ["extract_relations", "extract_syntactic", "extract_best", "load_patterns"]


def extract_best(text: str, client=None) -> dict:
    """Meilleure extraction dispo. Renvoie {triplets, mode}."""
    try:
        return {"triplets": extract_syntactic(text or ""), "mode": "syntaxe (UDPipe)"}
    except Exception:
        return {"triplets": extract_relations(text or "", client=client),
                "mode": "surface (repli)"}
