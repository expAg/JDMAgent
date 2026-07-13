# -*- coding: utf-8 -*-
"""Tests hors-ligne de l'analyse de polarité (client JDM factice, sans réseau).

Sans UDPipe (réseau KO), `analyze_polarity` prend le chemin regex (sans négation) :
on y valide le parsing des marqueurs _POL-* et le filtre du neutre dominant.
"""
from jdm_agent.polarity import analyze_polarity, _pol_of


class _Node:
    def __init__(self, i, name):
        self.id, self.name = i, name


class _Rel:
    def __init__(self, node2, w):
        self.node2, self.w = node2, w


class _Res:
    def __init__(self, pairs):
        self._nodes = [_Node(i, n) for i, (n, _w) in enumerate(pairs)]
        self._rels = [_Rel(i, w) for i, (_n, w) in enumerate(pairs)]

    @property
    def relations(self):
        return self._rels

    def node_index(self):
        return {n.id: n for n in self._nodes}


class _FakeClient:
    _DB = {
        "excellent": [("_POL-POS", 500), ("_POL-NEG", 30), ("_POL-NEUTRE", 60)],
        "horreur": [("_POL-NEG", 1000), ("_POL-POS", 20), ("_POL-NEUTRE", 5)],
        "chat": [("_POL-POS", 100), ("_POL-NEUTRE", 300)],  # neutre dominant → ignoré
    }

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        return _Res(self._DB.get(name.lower(), []))


def test_pol_of_parses_markers():
    pos, neg, neu = _pol_of(_FakeClient(), "excellent")
    assert (pos, neg, neu) == (500.0, 30.0, 60.0)


def test_verdict_and_neutral_filter():
    out = analyze_polarity("excellent horreur chat", _FakeClient())
    words = {w["word"] for w in out["words"]}
    assert "excellent" in words and "horreur" in words
    assert "chat" not in words                 # neutre dominant → écarté
    assert out["label"] == "négatif"           # neg 1000 > pos 500


def test_all_positive():
    out = analyze_polarity("excellent", _FakeClient())
    assert out["label"] == "positif"
