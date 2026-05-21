"""Tests pour la construction de sous-graphes (jdm_agent.viz)."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from jdm_agent.client.models import Node, Relation, RelationsResult
from jdm_agent.viz.subgraph import (
    DEFAULT_DEPTH2_RELATIONS,
    DEFAULT_RELATIONS,
    build_subgraph,
)


def _make_client_mock(relation_data: dict[str, list[tuple[str, float]]]) -> MagicMock:
    """Construit un JDMClient mock qui répond à relations_from + relation_type_id.

    `relation_data` : {rel_name: [(target_label, w), ...]}.
    """
    c = MagicMock()
    # Map rel_name → fake id
    rel_ids = {name: 1000 + i for i, name in enumerate(relation_data.keys())}
    c.relation_type_id.side_effect = lambda name: rel_ids.get(name)

    def fake_relations_from(term, types_ids=None, min_weight=None, limit=None):
        rid = (types_ids or [None])[0]
        rel_name = next((n for n, i in rel_ids.items() if i == rid), None)
        rows = relation_data.get(rel_name, []) if rel_name else []
        nodes = []
        relations = []
        for i, (label, w) in enumerate(rows):
            nid = 50_000 + i + rid  # fake unique id
            nodes.append(Node(id=nid, name=label, type=1, w=int(abs(w) or 1)))
            relations.append(Relation(id=i + 1, node1=1, node2=nid,
                                      type=rid, w=float(w)))
        return RelationsResult(nodes=nodes, relations=relations)

    c.relations_from.side_effect = fake_relations_from

    def fake_decode(name, local_nodes=None):
        return {"decoded": name, "is_refinement": False}

    c.decode_node_name.side_effect = fake_decode
    c.node_by_id.side_effect = lambda _id: Node(id=_id, name="?", type=1, w=1)
    return c


def test_build_subgraph_depth1_json():
    c = _make_client_mock({
        "r_isa": [("mammifère", 80), ("animal", 100)],
        "r_carac": [("poilu", 50)],
    })
    res = build_subgraph(
        "chat",
        client=c,
        depth=1,
        relations=["r_isa", "r_carac"],
        output="json",
    )
    assert res["root"] == "chat"
    labels = {n["label"] for n in res["nodes"]}
    assert "chat" in labels
    assert "mammifère" in labels
    assert "animal" in labels
    assert "poilu" in labels
    # Le centre doit être fixé
    center = next(n for n in res["nodes"] if n["label"] == "chat")
    assert center["fixed"] == {"x": True, "y": True}
    # Toutes les arêtes partent du centre à profondeur 1
    assert all(e["from"] == "ROOT" for e in res["edges"])
    # Tri |w| décroissant → animal (100) avant mammifère (80)
    rel_isa_edges = [e for e in res["edges"] if e["_relation"] == "r_isa"]
    assert rel_isa_edges[0]["_weight"] >= rel_isa_edges[1]["_weight"]


def test_build_subgraph_negation_marker():
    c = _make_client_mock({
        "r_isa": [("poisson", -40)],  # négation
    })
    res = build_subgraph(
        "baleine", client=c, depth=1,
        relations=["r_isa"], output="json",
    )
    edge = next(e for e in res["edges"] if e["_relation"] == "r_isa")
    assert edge["_negative"] is True
    assert edge["_polarity"] == "négation"
    assert edge["label"].startswith("NON ")
    assert edge["color"]["color"] == "#c62828"


def test_build_subgraph_depth2(tmp_path: Path):
    c = _make_client_mock({
        "r_isa": [("plat", 100)],
        "r_has_part": [("riz", 60)],
        # Profondeur 2 (appelée pour chaque voisin retenu)
        "r_hypo": [],  # rien
        "r_lieu": [],
        "r_carac": [],
    })
    res = build_subgraph(
        "curry", client=c, depth=2,
        relations=["r_isa", "r_has_part"],
        depth2_relations=["r_has_part", "r_lieu", "r_carac", "r_hypo"],
        top_k_per_relation=3,
        output="json",
    )
    # Profondeur 2 demande les depth2_relations sur chaque voisin niveau 1
    # Ici on a 2 voisins niveau 1 (plat, riz), donc 2 * 4 = 8 appels supplémentaires.
    # Avec nos mocks vides, pas de nouveaux nœuds, mais l'appel a bien lieu.
    assert res["stats"]["depth"] == 2
    assert res["stats"]["n_nodes"] >= 3  # centre + plat + riz au minimum


def test_build_subgraph_html_writes_file(tmp_path: Path):
    c = _make_client_mock({
        "r_isa": [("mammifère", 80)],
    })
    out = tmp_path / "chat_viz.html"
    res = build_subgraph(
        "chat", client=c, depth=1,
        relations=["r_isa"],
        output="html", output_path=str(out),
    )
    assert "html_path" in res
    assert out.exists()
    content = out.read_text(encoding="utf-8")
    # Le HTML autonome contient vis-network + nos données
    assert "vis-network" in content
    assert "chat" in content
    assert "mammifère" in content
    # Légende avec « négation » et relations
    assert "r_isa" in content


def test_defaults_match_howto():
    # Les défauts doivent rester alignés sur la recette du howto.
    assert "r_isa" in DEFAULT_RELATIONS
    assert "r_hypo" in DEFAULT_RELATIONS
    assert "r_has_part" in DEFAULT_RELATIONS
    assert "r_patient-1" in DEFAULT_RELATIONS
    assert set(DEFAULT_DEPTH2_RELATIONS).issubset(set(DEFAULT_RELATIONS))
