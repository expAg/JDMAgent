# -*- coding: utf-8 -*-
"""Tests hors-ligne de la découpe/recouture (module pur `app.chunking`)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))
from chunking import split_sentences, tok_count, offsets, windows, stitch  # noqa: E402

CONLLU = (
    "# sent 1\n"
    "1\tLe\tle\tDET\t_\t_\t2\tdet\t_\t_\n"
    "2\tchat\tchat\tNOUN\t_\t_\t3\tnsubj\t_\t_\n"
    "3\tdort\tdormir\tVERB\t_\t_\t0\troot\t_\t_\n"
    "\n"
    "# sent 2\n"
    "1\tIl\tlui\tPRON\t_\t_\t2\tnsubj\t_\t_\n"
    "2\tronronne\tronronner\tVERB\t_\t_\t0\troot\t_\t_\n"
    "\n"
    "# sent 3 (avec multiword)\n"
    "1-2\tdu\t_\t_\t_\t_\t_\t_\t_\t_\n"
    "1\tde\tde\tADP\t_\t_\t3\tcase\t_\t_\n"
    "2\tle\tle\tDET\t_\t_\t3\tdet\t_\t_\n"
    "3\tlait\tlait\tNOUN\t_\t_\t0\troot\t_\t_\n"
    "\n"
)


def test_split_and_counts():
    blocks = split_sentences(CONLLU)
    assert len(blocks) == 3
    assert tok_count(blocks[0]) == 3          # Le chat dort
    assert tok_count(blocks[1]) == 2          # Il ronronne
    assert tok_count(blocks[2]) == 3          # de le lait (la plage 1-2 NON comptée)
    assert offsets(blocks) == [0, 3, 5]       # global start de chaque phrase


def test_windows():
    # court : une seule fenêtre couvrant tout
    assert windows(3, 6, 1) == [(0, 3)]
    # long : fenêtres de 3, chevauchement 1 → pas de 2
    assert windows(7, 3, 1) == [(0, 3), (2, 5), (4, 7)]
    # chevauchement 0 → pas de 3
    assert windows(6, 3, 0) == [(0, 3), (3, 6)]


def test_stitch_merges_shared_span():
    # fenêtre A : chaîne [chat(1,2)... ] ; fenêtre B : chaîne partageant le span [1,2]
    # (mention commune dans le chevauchement) → une seule chaîne fusionnée.
    a = [[[1, 2], [4]]]          # "le chat" (tokens 1,2) ~ "Il" (token 4)
    b = [[[1, 2], [7]]]          # "le chat" (mêmes tokens 1,2) ~ autre mention (7)
    merged = stitch(a + b)
    assert len(merged) == 1
    assert [1, 2] in merged[0] and [4] in merged[0] and [7] in merged[0]


def test_stitch_keeps_distinct():
    a = [[[1, 2], [4]]]
    b = [[[8, 9], [11]]]         # aucun span commun → 2 chaînes distinctes
    merged = stitch(a + b)
    assert len(merged) == 2


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
    print("TOUS OK")
