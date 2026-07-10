"""Découpe d'un CoNLL-U en fenêtres de phrases + recouture des chaînes de
coréférence, en indices de tokens GLOBAUX au document.

Objectif : rendre la coréférence NON BLOQUANTE. CorPipe (mT5-large) sur tout un
document long en CPU part en pratique en temps quasi infini. On l'exécute donc
par fenêtres de quelques phrases (bornées), avec un chevauchement de N phrases
pour que les mentions communes recousent les chaînes entre fenêtres.

Ce module est PUR (aucun import lourd) → testable hors-ligne. Le lancement du
modèle et la lecture udapi restent dans `coref.py`.
"""
import re

_TOKLINE = re.compile(r"^\d+\t")  # ligne de MOT (exclut les plages « 3-4 » et vides « 3.1 »)


def split_sentences(conllu: str) -> list:
    """CoNLL-U → liste de blocs-phrases (séparés par une ligne vide)."""
    blocks, cur = [], []
    for line in conllu.splitlines():
        if line.strip() == "":
            if cur:
                blocks.append("\n".join(cur))
                cur = []
        else:
            cur.append(line)
    if cur:
        blocks.append("\n".join(cur))
    return blocks


def tok_count(block: str) -> int:
    """Nombre de MOTS (tokens syntaxiques) d'un bloc-phrase."""
    return sum(1 for ln in block.splitlines() if _TOKLINE.match(ln))


def offsets(blocks: list) -> list:
    """Indice de token GLOBAL du premier mot de chaque bloc."""
    offs, acc = [], 0
    for b in blocks:
        offs.append(acc)
        acc += tok_count(b)
    return offs


def windows(n_blocks: int, size: int, overlap: int) -> list:
    """Fenêtres (a, b) de blocs [a, b[ : taille `size`, chevauchement `overlap`."""
    if n_blocks <= size:
        return [(0, n_blocks)]
    step = max(1, size - max(0, overlap))
    res, i = [], 0
    while i < n_blocks:
        res.append((i, min(i + size, n_blocks)))
        if i + size >= n_blocks:
            break
        i += step
    return res


def stitch(chains: list) -> list:
    """Fusionne les chaînes qui partagent une mention IDENTIQUE (même span global,
    apparue dans le chevauchement de deux fenêtres). union-find.

    `chains` : liste de chaînes ; chaque chaîne = liste de spans ; chaque span =
    liste (triée) d'indices de tokens globaux. Retourne les chaînes fusionnées.
    """
    parent = list(range(len(chains)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    owner = {}
    for ci, ch in enumerate(chains):
        for sp in ch:
            key = tuple(sp)
            if key in owner:
                union(owner[key], ci)
            else:
                owner[key] = ci

    buckets = {}
    for ci, ch in enumerate(chains):
        r = find(ci)
        b = buckets.setdefault(r, set())
        for sp in ch:
            b.add(tuple(sp))

    out = [sorted([list(s) for s in spans]) for spans in buckets.values()]
    out.sort(key=lambda c: c[0][0] if c and c[0] else 0)
    return out
