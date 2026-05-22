"""Tests du moteur d'inférence JDM (Phase 11) — JDMClient mocké, hors-ligne."""
from __future__ import annotations

from unittest.mock import MagicMock

from jdm_agent.client.models import Node, Relation, RelationsResult
from jdm_agent.factcheck import Claim, Status, verify_claim
from jdm_agent.inference import FiredSchema, infer


# Relations connues du mock (id arbitraire mais stable).
_REL_IDS: dict[str, int] = {
    name: 1000 + i for i, name in enumerate([
        "r_isa", "r_hypo", "r_syn", "r_anto", "r_carac", "r_carac-1",
        "r_has_part", "r_holo", "r_lieu", "r_lieu-1", "r_isa-incompatible",
        "r_can_eat", "r_can_eat-1", "r_has_conseq", "r_associated",
        "r_has_prop",
    ])
}


def _make_client(data: dict[tuple[str, str], list[tuple[str, float]]]) -> MagicMock:
    """Mock JDMClient indexé par `(terme, relation)` → liste de `(cible, w)`.

    Reproduit `relation_type_id`, `relations_from`, `decode_node_name`,
    `get_annotations_for_triplet`. Toute relation apparaissant dans `data`
    reçoit un id, même si elle n'est pas dans la liste standard `_REL_IDS`.
    """
    c = MagicMock()
    rel_ids = dict(_REL_IDS)
    for (_term, rel) in data:
        rel_ids.setdefault(rel, 2000 + len(rel_ids))
    c.relation_type_id.side_effect = lambda name: rel_ids.get(name)

    def fake_relations_from(term, types_ids=None, min_weight=None, limit=None):
        rid = (types_ids or [None])[0]
        rel_name = next((n for n, i in rel_ids.items() if i == rid), None)
        rows = data.get((term, rel_name), []) if rel_name else []
        nodes, relations = [], []
        for j, (tgt, w) in enumerate(rows):
            nid = 50_000 + j + (rid or 0)
            nodes.append(Node(id=nid, name=tgt, type=1, w=int(abs(w)) or 1))
            relations.append(Relation(id=j + 1, node1=1, node2=nid,
                                      type=rid, w=float(w)))
        return RelationsResult(nodes=nodes, relations=relations)

    c.relations_from.side_effect = fake_relations_from
    c.decode_node_name.side_effect = lambda name, **kw: {
        "decoded": name, "is_refinement": False}
    c.get_annotations_for_triplet.side_effect = lambda rid: []
    return c


# ---------- Schémas individuels ----------

def test_guards_tautology():
    res = infer(_make_client({}), "chat", "r_syn", "chat", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.TAUTOLOGY


def test_guards_contradiction():
    res = infer(_make_client({}), "chaud", "r_anto", "chaud", effort=1)
    assert res.is_false
    assert res.fired_schema == FiredSchema.CONTRADICTION


def test_inverse():
    c = _make_client({("graine", "r_can_eat-1"): [("moineau", 50)]})
    res = infer(c, "moineau", "r_can_eat", "graine", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.INVERSE
    assert res.proof and res.proof[0].relation == "r_can_eat-1"


def test_implication():
    # r_lieu-1 est impliquée par r_has_part.
    c = _make_client({("chat", "r_has_part"): [("patte", 80)]})
    res = infer(c, "chat", "r_lieu-1", "patte", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.IMPLICATION


def test_deduction_isa():
    c = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200)],
        ("oiseau", "r_can_eat"): [("graine", 40)],
    })
    res = infer(c, "moineau", "r_can_eat", "graine", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.DEDUCTION_ISA
    assert len(res.proof) == 2  # moineau r_isa oiseau ; oiseau r_can_eat graine


def test_transitivity():
    c = _make_client({
        ("voiture", "r_has_part"): [("moteur", 100)],
        ("moteur", "r_has_part"): [("piston", 80)],
    })
    res = infer(c, "voiture", "r_has_part", "piston", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.TRANSITIVITY


def test_isa_incompatible_refutation():
    c = _make_client({
        ("baleine", "r_isa"): [("mammifère", 300)],
        ("mammifère", "r_isa-incompatible"): [("poisson", 50)],
    })
    res = infer(c, "baleine", "r_isa", "poisson", effort=1)
    assert res.is_false
    assert res.fired_schema == FiredSchema.ISA_INCOMPATIBLE


def test_class_elimination_refutation():
    # mammifère est une classe d'élimination ; il NIE r_carac écaille.
    c = _make_client({
        ("baleine", "r_isa"): [("mammifère", 300)],
        ("mammifère", "r_carac"): [("écaille", -60)],
    })
    res = infer(c, "baleine", "r_carac", "écaille", effort=1)
    assert res.is_false
    assert res.fired_schema == FiredSchema.CLASS_ELIM


def test_hyponym_propagation():
    # oiseau r_can_eat graine ; graine r_isa nourriture ⟹ oiseau r_can_eat nourriture
    c = _make_client({
        ("oiseau", "r_can_eat"): [("graine", 100)],
        ("graine", "r_isa"): [("nourriture", 200)],
    })
    res = infer(c, "oiseau", "r_can_eat", "nourriture", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.HYPONYM_PROP


def test_assoc_bridge():
    # cuisine r_but nourrir ; nourrir r_associated manger ⟹ cuisine r_but manger
    c = _make_client({
        ("cuisine", "r_but"): [("nourrir", 52)],
        ("nourrir", "r_associated"): [("manger", 145)],
    })
    res = infer(c, "cuisine", "r_but", "manger", effort=2)
    assert res.is_true
    assert res.fired_schema == FiredSchema.ASSOC_BRIDGE
    # Schéma lâche → confiance honnêtement décotée.
    assert res.confidence < 0.5


def test_antonym_contrast_refutation():
    # feu r_carac chaud ; froid r_anto chaud ⟹ feu r_carac froid réfuté
    c = _make_client({
        ("feu", "r_carac"): [("chaud", 300)],
        ("froid", "r_anto"): [("chaud", 90)],
    })
    res = infer(c, "feu", "r_carac", "froid", effort=1)
    assert res.is_false
    assert res.fired_schema == FiredSchema.ANTONYM_CONTRAST


def test_cohyponym_refutation():
    # chat et chien partagent l'hyperonyme mammifère ⟹ chat r_isa chien réfuté
    c = _make_client({
        ("chat", "r_isa"): [("mammifère", 500)],
        ("chien", "r_isa"): [("mammifère", 500)],
    })
    res = infer(c, "chat", "r_isa", "chien", effort=1)
    assert res.is_false
    assert res.fired_schema == FiredSchema.COHYPONYM


def test_geo_propagation():
    # tour Eiffel r_lieu Paris ; Paris r_holo France ⟹ tour Eiffel r_lieu France
    c = _make_client({
        ("tour eiffel", "r_lieu"): [("Paris", 200)],
        ("Paris", "r_holo"): [("France", 300)],
    })
    res = infer(c, "tour eiffel", "r_lieu", "France", effort=1)
    assert res.is_true
    assert res.fired_schema == FiredSchema.GEO_PROPAGATION


def test_multipath_consensus_boosts_confidence():
    # Deux génériques confirment → confiance rehaussée + mention « concordants ».
    two = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200), ("animal", 100)],
        ("oiseau", "r_carac"): [("petit", 50)],
        ("animal", "r_carac"): [("petit", 50)],
    })
    one = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200)],
        ("oiseau", "r_carac"): [("petit", 50)],
    })
    r2 = infer(two, "moineau", "r_carac", "petit", effort=1)
    r1 = infer(one, "moineau", "r_carac", "petit", effort=1)
    assert r2.is_true and r1.is_true
    assert r2.fired_schema == FiredSchema.DEDUCTION_ISA
    assert r2.confidence > r1.confidence            # consensus → plus confiant
    assert "concordant" in r2.explanation


def test_silent_when_no_data():
    res = infer(_make_client({}), "xyzzy", "r_carac", "truc", effort=1)
    assert res.is_silent
    assert res.fired_schema == FiredSchema.NONE
    assert res.explanation == ""  # pas de justification quand on ne sait pas


def test_budget_is_bounded():
    # Graphe qui exigerait plusieurs lookups, mais budget = 1 → silence propre.
    c = _make_client({
        ("a", "r_isa"): [("b", 100)],
        ("b", "r_carac"): [("z", 90)],
    })
    res = infer(c, "a", "r_carac", "z", effort=1, budget=1)
    assert res.is_silent          # budget épuisé avant de conclure
    assert res.lookups_used <= 2  # jamais d'exception qui fuit


def test_confidence_and_proof_present():
    c = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200)],
        ("oiseau", "r_can_eat"): [("graine", 40)],
    })
    res = infer(c, "moineau", "r_can_eat", "graine", effort=1)
    assert 0.0 < res.confidence <= 1.0
    assert res.explanation.startswith("Oui")


# ---------- Fusion dans verify_claim ----------

def test_verify_effort0_is_pure_containment():
    """À effort 0, un triplet seulement déductible reste UNKNOWN."""
    c = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200)],
        ("oiseau", "r_can_eat"): [("graine", 40)],
    })
    claim = Claim(text="x", subject="moineau", relation="r_can_eat", object="graine")
    v = verify_claim(c, claim, effort=0)
    assert v.status == Status.UNKNOWN
    assert v.inference_schema is None


def test_verify_effort1_uses_inference():
    """À effort 1, le même triplet est SUPPORTED par inférence."""
    c = _make_client({
        ("moineau", "r_isa"): [("oiseau", 200)],
        ("oiseau", "r_can_eat"): [("graine", 40)],
    })
    claim = Claim(text="x", subject="moineau", relation="r_can_eat", object="graine")
    v = verify_claim(c, claim, effort=1)
    assert v.status == Status.SUPPORTED
    assert v.inference_schema == "deduction_isa"
    assert v.inference_proof  # chaîne de preuve présente


def test_verify_direct_match_never_marked_inference():
    """Un verdict de contenance directe n'a jamais d'inference_schema."""
    c = _make_client({("sang", "r_carac"): [("rouge", 300)]})
    claim = Claim(text="x", subject="sang", relation="r_carac", object="rouge")
    v = verify_claim(c, claim, effort=1)
    assert v.status == Status.SUPPORTED
    assert v.inference_schema is None  # direct, pas inféré
