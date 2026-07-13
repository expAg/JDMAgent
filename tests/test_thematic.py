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
    out = analyze_thematic("guitare piano but stade", _FakeClient())
    themes = {t["theme"]: t for t in out["themes"]}
    # casse fusionnée : musique = 100+80+20 = 200 ; pluriel fusionné : sport = 50+30+40 = 120
    assert themes["musique"]["score"] == 200.0
    assert themes["sport"]["score"] == 120.0
    assert "Musique" not in themes and "sports" not in themes
    # normalisation : dominant (musique) = 100 %
    assert themes["musique"]["rel"] == 100.0
    assert themes["sport"]["rel"] == 60.0            # 120/200
    # classé par score décroissant
    assert out["themes"][0]["theme"] == "musique"
    # comptage de mots-source
    assert themes["musique"]["count"] == 3           # guitare + piano(x2 mentions)
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
    out = analyze_thematic("mot note", _PenClient())
    th = {t["theme"]: t for t in out["themes"]}
    assert th["linguistique"]["score"] == 15.0       # 100 × 0.15 (pénalisé)
    assert th["musique"]["score"] == 100.0
    assert out["themes"][0]["theme"] == "musique"    # linguistique repasse dessous
