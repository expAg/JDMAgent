"""J1 — Contraintes dures des CO-ARGUMENTS (théorie du liage, thèse ARCS §5.2.4.1).

Règle co-Arg : deux arguments [sujet, OD, COI] d'un même prédicat verbal
**non-pronominal** ne peuvent pas désigner la même entité.

On travaille directement sur l'arbre UD (CoNLL-U) déjà calculé par UDPipe et
préservé dans la sortie de CorPipe. On produit un ensemble de paires de mots-têtes
qui ne peuvent PAS co-référer (« cannot-link »).
"""
from itertools import combinations

# Relations syntaxiques considérées comme arguments essentiels du prédicat.
CORE_ARGS = {"nsubj", "obj", "iobj"}
# UPOS des têtes réellement référentielles.
REFERENTIAL = {"NOUN", "PROPN", "PRON"}
# Relations par lesquelles un infinitif hérite du sujet de son contrôleur
# (vouloir/pouvoir/devoir + inf, etc.).
CONTROL_DEPRELS = {"xcomp", "ccomp", "advcl"}


def _is_pronominal(verb) -> bool:
    """Vrai si le verbe porte un clitique réfléchi (emploi pronominal)."""
    for c in verb.children:
        if c.udeprel == "expl":                       # expl, expl:pv, expl:comp
            return True
        if (c.feats.get("Reflex") == "Yes"
                and (c.lemma in ("se", "soi") or c.feats.get("PronType") == "Prs")):
            return True
    return False


def _arguments(verb):
    """Têtes argumentales (sujet, OD, COI) du prédicat, sujet hérité par contrôle inclus."""
    args = [c for c in verb.children
            if c.udeprel in CORE_ARGS and (c.upos in REFERENTIAL)]
    # Contrôle du sujet : un infinitif sans sujet propre hérite du sujet du contrôleur.
    has_subject = any(c.udeprel == "nsubj" for c in verb.children)
    if not has_subject and verb.udeprel in CONTROL_DEPRELS and verb.parent is not None:
        for c in verb.parent.children:
            if c.udeprel == "nsubj" and c.upos in REFERENTIAL:
                args.append(c)
    return args


def cannot_link_pairs(doc):
    """Renvoie l'ensemble des paires de nœuds (têtes) qui ne peuvent pas co-référer.

    Chaque paire est un frozenset de deux nœuds udapi. La justification (verbe en
    cause) est renvoyée séparément pour l'explicabilité.
    """
    pairs = set()
    reasons = {}
    for tree in doc.trees:
        for node in tree.descendants:
            if node.upos != "VERB" or _is_pronominal(node):
                continue
            args = _arguments(node)
            for a, b in combinations(args, 2):
                key = frozenset((id(a), id(b)))
                pairs.add(key)
                reasons[key] = (a, b, node)
    return pairs, reasons
