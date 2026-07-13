# -*- coding: utf-8 -*-
"""Tests hors-ligne du WSD (client JDM factice, aucun réseau)."""
from jdm_agent.wsd import disambiguate, _selectional_asym


class _Sense:
    def __init__(self, name, decoded, path, weight):
        self.name, self.decoded, self.path, self.weight = name, decoded, path, weight


class _Node:
    def __init__(self, i, name):
        self.id, self.name = i, name


class _Rel:
    def __init__(self, rid, node2, w):
        self.id, self.node2, self.w = rid, node2, w


class _Res:
    def __init__(self, triples):  # triples: [(rel_id, name, w)]
        self._nodes = [_Node(i, n) for i, (_r, n, _w) in enumerate(triples)]
        self._rels = [_Rel(r, i, w) for i, (r, _n, w) in enumerate(triples)]

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
        return _Res([(0, n, w) for (n, w) in self._NEIGH.get(name.lower(), [])])


def test_fallback_by_type_generic():
    # sans réseau → analyse() échoue → repli générique par type ; contexte animalier
    out = disambiguate("souris chat fromage", _FakeClient())
    occ = {o["word"]: o for o in out["occurrences"]}
    assert "souris" in occ
    assert occ["souris"]["chosen"]["sense"] == "souris (rongeur)"


# ── Cœur nouveau : repondération de l'arête actancielle par l'annotation ──
class _AnnotClient:
    """« avocat » : juriste & fruit ont TOUS DEUX r_patient-1 manger = +204, mais le
    juriste est annoté « improbable » (arête héritée à réfuter), le fruit « pertinent »."""
    _EDGES = {  # (node, type_id) -> [(rel_id, target, w)]
        ("avocat>juriste", 24): [(1, "manger", -11)],   # r_agent-1
        ("avocat>juriste", 26): [(2, "manger", 204)],   # r_patient-1 (improbable)
        ("avocat>fruit", 24): [(3, "manger", -43)],
        ("avocat>fruit", 26): [(4, "manger", 204)],      # r_patient-1 (pertinent)
    }
    _ANNOT = {2: "improbable", 4: "pertinent"}

    def relations_from(self, name, types_ids=None, min_weight=None, limit=None):
        key = (name, types_ids[0] if types_ids else None)
        return _Res(self._EDGES.get(key, []))

    def get_annotations_for_triplet(self, rel_id):
        v = self._ANNOT.get(rel_id)
        return [_Annot(v)] if v else []


def test_selectional_annotation_flips_polluted_edge():
    c = _AnnotClient()
    juriste = _Sense("avocat>juriste", "avocat (juriste)", ["avocat", "juriste"], 90)
    fruit = _Sense("avocat>fruit", "avocat (fruit)", ["avocat", "fruit"], 80)
    # juriste : patient 204 × (improbable=-0.7) = -142.8 → asym positif → AGENT
    assert _selectional_asym(c, juriste, "manger") > 0
    # fruit : patient 204 × (pertinent=1.0) = 204 → asym négatif → PATIENT
    assert _selectional_asym(c, fruit, "manger") < 0
