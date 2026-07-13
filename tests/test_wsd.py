# -*- coding: utf-8 -*-
"""Tests hors-ligne du WSD (client JDM factice, aucun réseau)."""
from jdm_agent.wsd import disambiguate


class _Sense:
    def __init__(self, name, decoded, path, weight):
        self.name, self.decoded, self.path, self.weight = name, decoded, path, weight


class _Node:
    def __init__(self, i, name):
        self.id, self.name = i, name


class _Rel:
    def __init__(self, node2, w):
        self.node2, self.w = node2, w


class _Res:
    def __init__(self, pairs):  # pairs: [(name, w)]
        self._nodes = [_Node(i, n) for i, (n, _w) in enumerate(pairs)]
        self._rels = [_Rel(i, w) for i, (_n, w) in enumerate(pairs)]

    @property
    def relations(self):
        return self._rels

    def node_index(self):
        return {n.id: n for n in self._nodes}


class _FakeClient:
    """« souris » a 2 sens ; voisinages construits pour que le CONTEXTE tranche."""
    _REFS = {
        "souris": [_Sense("souris>1", "souris (rongeur)", ["souris", "rongeur"], 90),
                   _Sense("souris>2", "souris (informatique)", ["souris", "informatique"], 80)],
    }
    _NEIGH = {
        # mots de contexte (voisinages riches) → pointent vers le label discriminant
        "chat":     [("rongeur", 100), ("animal", 80)],
        "fromage":  [("rongeur", 40)],
        "souris>1": [("queue", 30)],           # nœud de sens (creux)
        "souris>2": [("clic", 30)],
    }

    def relation_type_id(self, name):
        return 27 if name == "r_domain" else 33

    def refinements_decoded(self, name):
        return self._REFS.get(name.lower(), [])

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        return _Res(self._NEIGH.get(name.lower(), []))


def test_disambiguate_picks_context_sense():
    # contexte animalier → « souris » doit être le RONGEUR (via chat/fromage → rongeur)
    out = disambiguate("souris chat fromage", _FakeClient())
    words = {w["word"]: w for w in out["words"]}
    assert "souris" in words
    assert words["souris"]["chosen"]["sense"] == "souris (rongeur)"
    assert words["souris"]["confident"] is True


def test_monosemous_skipped():
    # « chat » n'a pas de raffinements dans le fake → non listé
    out = disambiguate("souris chat fromage", _FakeClient())
    assert all(w["word"] != "chat" for w in out["words"])
