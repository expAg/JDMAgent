# -*- coding: utf-8 -*-
"""Tests hors-ligne du WSD (client JDM factice, aucun réseau)."""
from jdm_agent.wsd import disambiguate, _direct_asym


class _Sense:
    def __init__(self, name, decoded, path, weight):
        self.name, self.decoded, self.path, self.weight = name, decoded, path, weight


class _Node:
    def __init__(self, i, name):
        self.id, self.name = i, name


class _Rel:
    def __init__(self, rid, node2, w, typ):
        self.id, self.node2, self.w, self.type = rid, node2, w, typ


class _Res:
    def __init__(self, quads):  # quads: [(rel_id, name, w, type)]
        self._nodes = [_Node(i, n) for i, (_r, n, _w, _t) in enumerate(quads)]
        self._rels = [_Rel(r, i, w, t) for i, (r, _n, w, t) in enumerate(quads)]

    @property
    def relations(self):
        return self._rels

    def node_index(self):
        return {n.id: n for n in self._nodes}


class _Annot:
    def __init__(self, value):
        self.value, self.kind, self.w = value, "annotation", 1.0


class _FakeClient:
    """« souris » a 2 sens ; voisinages génériques pour que le contexte tranche."""
    _REFS = {"souris": [_Sense("souris>1", "souris (rongeur)", ["souris", "rongeur"], 90),
                        _Sense("souris>2", "souris (informatique)", ["souris", "informatique"], 80)]}
    _NEIGH = {"chat": [("rongeur", 100), ("animal", 80)], "fromage": [("rongeur", 40)]}

    def relation_type_id(self, name):
        return {"r_domain": 3}.get(name, 99)

    def refinements_decoded(self, name):
        return self._REFS.get(name.lower(), [])

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        return _Res([(0, n, w, 0) for (n, w) in self._NEIGH.get(name.lower(), [])])


def test_fallback_by_type_generic():
    # sans réseau → analyse() échoue → repli générique par type ; contexte animalier
    out = disambiguate("souris chat fromage", _FakeClient())
    occ = {o["word"]: o for o in out["occurrences"]}
    assert "souris" in occ
    assert occ["souris"]["chosen"]["sense"] == "souris (rongeur)"


# ── Cœur : repondération de l'arête actancielle par l'annotation ──
class _AnnotClient:
    """juriste & fruit ont TOUS DEUX r_patient-1 manger = +204 ; juriste est annoté
    « improbable » (arête héritée à réfuter), fruit « pertinent »."""
    _EDGES = {  # node -> [(rel_id, target, w, type)]  (24 = r_agent-1, 26 = r_patient-1)
        "avocat>juriste": [(1, "manger", -11, 24), (2, "manger", 204, 26)],
        "avocat>fruit": [(3, "manger", -43, 24), (4, "manger", 204, 26)],
    }
    _ANNOT = {2: "improbable", 4: "pertinent"}

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        edges = self._EDGES.get(name, [])
        if types_ids:  # requête TYPÉE : ne renvoyer que les arêtes de ce type
            edges = [e for e in edges if e[3] == types_ids[0]]
        return _Res(edges)

    def get_annotations_for_triplet(self, rel_id):
        v = self._ANNOT.get(rel_id)
        return [_Annot(v)] if v else []


def test_selectional_annotation_flips_polluted_edge():
    c = _AnnotClient()
    juriste = _Sense("avocat>juriste", "avocat (juriste)", ["avocat", "juriste"], 90)
    fruit = _Sense("avocat>fruit", "avocat (fruit)", ["avocat", "fruit"], 80)
    # juriste : patient 204 × (improbable=-0.7) → asym positif → AGENT
    assert _direct_asym(c, juriste, "manger") > 0
    # fruit : patient 204 × (pertinent=1.0) → asym négatif → PATIENT
    assert _direct_asym(c, fruit, "manger") < 0


def test_mwe_detection():
    # « chef d'orchestre » = composé connu de JDM → absorbé comme une unité
    from jdm_agent.wsd import _mwe_span
    from jdm_agent.relext.udpipe import Token, Sentence
    toks = [Token(1, "chef", "chef", "NOUN", {}, 0, "root"),
            Token(2, "d'", "de", "ADP", {}, 3, "case"),
            Token(3, "orchestre", "orchestre", "NOUN", {}, 1, "nmod")]
    s = Sentence(tokens=toks)
    s.by_id = {t.id: t for t in toks}

    class _C:
        def term_exists(self, name):
            return name.lower() == "chef d'orchestre"

    span = _mwe_span(s, 0, _C())
    assert span is not None and span[2] == "chef d'orchestre"
