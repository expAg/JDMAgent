# -*- coding: utf-8 -*-
"""Tests hors-ligne de l'analyse thématique (client JDM factice, aucun réseau)."""
from jdm_agent.thematic import _content_words, analyze_thematic


def test_content_words_filters():
    ws = _content_words("Le guitariste joue, et le PIANO du concert !")
    assert "guitariste" in ws and "piano" in ws and "concert" in ws
    assert "le" not in ws and "et" not in ws and "du" not in ws  # mots-outils
    assert ws.count("piano") == 1  # dédupliqué (casse ignorée)


class _Node:
    def __init__(self, i, name, w=0.0):
        self.id, self.name, self.w = i, name, w


class _Rel:
    def __init__(self, node2, w):
        self.node2, self.w = node2, w


class _Res:
    def __init__(self, rels, nodes):
        self._rels, self._nodes = rels, nodes

    @property
    def relations(self):
        return self._rels

    def node_index(self):
        return {n.id: n for n in self._nodes}


class _FakeClient:
    """r_domain factice : guitare/piano → musique(+Musique casse) ; but/stade → sport(+sports)."""
    _DB = {
        "guitare": [(1, "musique", 100)],
        "piano":   [(1, "musique", 80), (2, "Musique", 20)],   # casse à fusionner
        "but":     [(3, "sport", 50), (4, "sports", 30)],      # pluriel à fusionner
        "stade":   [(3, "sport", 40)],
    }

    def relation_type_id(self, name):
        return 27 if name == "r_domain" else None

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        rows = self._DB.get(name.lower(), [])
        rels = [_Rel(i, w) for (i, _n, w) in rows]
        nodes = [_Node(i, n, w) for (i, n, w) in rows]
        return _Res(rels, nodes)


def test_aggregate_merge_normalize():
    out = analyze_thematic("guitare piano but stade", _FakeClient(), use_syntax=False)
    themes = {t["theme"]: t for t in out["themes"]}
    # fusion casse (« Musique »→« musique ») et pluriel (« sports »→« sport »)
    assert "Musique" not in themes and "sports" not in themes
    assert "musique" in themes and "sport" in themes
    # classé par score décroissant, dominant normalisé à 100
    scores = [t["score"] for t in out["themes"]]
    assert scores == sorted(scores, reverse=True)
    assert out["themes"][0]["rel"] == 100.0
    # mots-source correctement attribués
    assert set(themes["musique"]["words"]) == {"guitare", "piano"}
    assert set(themes["sport"]["words"]) == {"but", "stade"}


class _PenClient:
    """« mot » → linguistique (fourre-tout) ; « note » → musique, poids égaux."""
    _DB = {"mot": [(1, "linguistique", 100)], "note": [(2, "musique", 100)]}

    def relation_type_id(self, name):
        return 27 if name == "r_domain" else None

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        rows = self._DB.get(name.lower(), [])
        return _Res([_Rel(i, w) for i, _n, w in rows],
                    [_Node(i, n, w) for i, n, w in rows])


def test_penalty_generic_domains():
    # « mot »→linguistique et « note »→musique à poids égaux : sans pénalité ils
    # seraient à égalité ; la pénalité fait passer musique devant.
    out = analyze_thematic("mot note", _PenClient(), use_syntax=False)
    th = {t["theme"]: t for t in out["themes"]}
    assert out["themes"][0]["theme"] == "musique"
    assert th["linguistique"]["score"] < th["musique"]["score"]
    # facteur exact : linguistique pénalisé à 15 % de musique
    assert th["linguistique"]["rel"] == 15.0
