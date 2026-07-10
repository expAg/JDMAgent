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


def extract_best(text: str, client=None, *, resolve_anaphora: bool = False,
                 coref_url: str = "") -> dict:
    """Meilleure extraction dispo. Renvoie {triplets, mode}.

    Si `resolve_anaphora` et `coref_url` : on résout d'abord les pronoms via le
    service de coréférence (« Il » → « Louisiana blues »), puis on extrait sur le
    texte résolu. En cas d'échec coref → on continue sans résolution.
    """
    txt = text or ""
    resolved = False
    if resolve_anaphora and coref_url:
        try:
            from jdm_agent.relext.coref import resolve_pronouns
            txt = resolve_pronouns(text or "", coref_url)
            resolved = True
        except Exception:
            resolved = False
    try:
        rows, mode = extract_syntactic(txt), "syntaxe (UDPipe)"
    except Exception:
        rows, mode = extract_relations(txt, client=client), "surface (repli)"
    if resolved:
        mode += " + coréférence"
    return {"triplets": rows, "mode": mode}
