"""Tests du JDMClient avec mock httpx via respx."""
from __future__ import annotations

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache


BASE = "https://jdm-api.demo.lirmm.fr"

REL_TYPES = [
    {"id": 5, "name": "r_syn", "help": "synonymes"},
    {"id": 6, "name": "r_isa", "help": "hyperonymes"},
    {"id": 0, "name": "r_associated", "help": "associations"},
]
NODE_TYPES = [
    {"id": 1, "name": "n_generic", "help": "terme"},
    {"id": 4, "name": "n_pos", "help": "partie du discours"},
]

NODE_CHAT = {
    "id": 150, "name": "chat", "type": 1, "w": 7967,
    "c": 0, "level": 87.0, "infoid": None,
    "creationdate": "2007-06-21", "touchdate": "2026-05-20",
}

SYN_RESPONSE = {
    "nodes": [
        {"id": 150, "name": "chat", "type": 1, "w": 7967},
        {"id": 999, "name": "matou", "type": 1, "w": 100},
        {"id": 888, "name": "minet", "type": 1, "w": 80},
    ],
    "relations": [
        {"id": 1, "node1": 150, "node2": 999, "type": 5, "w": 50.0},
        {"id": 2, "node1": 150, "node2": 888, "type": 5, "w": 30.0},
    ],
}


@pytest.fixture
def client(tmp_path):
    cache = DiskJSONCache(cache_dir=tmp_path / "cache")
    return JDMClient(base_url=BASE, cache=cache)


@respx.mock
def test_ensure_meta_lazy_and_cached(client):
    rels = respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    nodes = respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    # Premier appel : déclenche le chargement.
    assert client.relation_type_id("r_syn") == 5
    # Deuxième appel : cache en mémoire (et disque).
    assert client.relation_type_name(6) == "r_isa"
    assert rels.call_count == 1
    assert nodes.call_count == 1


@respx.mock
def test_node_by_name(client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/node_by_name/chat").mock(return_value=httpx.Response(200, json=NODE_CHAT))

    n = client.node_by_name("chat")
    assert n.id == 150
    assert n.name == "chat"
    # Cache disque actif : 2e appel sans HTTP supplémentaire.
    n2 = client.node_by_name("chat")
    assert n2.id == 150
    assert route.call_count == 1


@respx.mock
def test_synonyms_helper(client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/relations/from/chat").mock(return_value=httpx.Response(200, json=SYN_RESPONSE))

    syns = client.synonyms("chat", min_weight=0, limit=10)
    names = [n.name for n in syns]
    assert "matou" in names and "minet" in names
    # Trié par w décroissant.
    assert syns[0].w >= syns[-1].w


@respx.mock
def test_retry_on_5xx(client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/node_by_name/test").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json={**NODE_CHAT, "name": "test"}),
        ]
    )
    n = client.node_by_name("test")
    assert n.name == "test"
    assert route.call_count == 2


@respx.mock
def test_get_annotations_for_triplet(client):
    """Phase 9 : récupération des annotations via :r{id}.

    Vérifie que :
    - on appelle bien /v0/relations/from/:r{id} sans types_ids (bug JDM)
    - on filtre les targets sur node.type==1 (skip r_pos type 4)
    - on mappe les types 996/997/998 vers les bons 'kind'
    """
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    # Le node :r12345 a 3 outgoing :
    #   type=4 (r_pos) "Relation:" type=4 → à ignorer
    #   type=998 (r_annotation) "contrastif" type=1 → conservé
    #   type=996 (r_annotation_context) "constitutif" type=1 → conservé
    respx.get(f"{BASE}/v0/relations/from/:r12345").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 999, "name": ":r12345", "type": 10, "w": 0},
            {"id": 100, "name": "Relation:", "type": 4, "w": 100},
            {"id": 101, "name": "contrastif", "type": 1, "w": 200},
            {"id": 102, "name": "constitutif", "type": 1, "w": 80},
        ],
        "relations": [
            {"id": 1, "node1": 999, "node2": 100, "type": 4,   "w": 100},  # r_pos - skip
            {"id": 2, "node1": 999, "node2": 101, "type": 998, "w": 200},
            {"id": 3, "node1": 999, "node2": 102, "type": 996, "w": 80},
        ],
    }))
    annots = client.get_annotations_for_triplet(12345)
    assert len(annots) == 2
    # Tri par |w| desc : contrastif (200) puis constitutif (80)
    assert annots[0].kind == "annotation"
    assert annots[0].value == "contrastif"
    assert annots[0].w == 200
    assert annots[1].kind == "context"
    assert annots[1].value == "constitutif"


@respx.mock
def test_get_annotations_returns_empty_on_500(client):
    """Le pattern :r{id} 500-fail gracieusement si le triplet n'est pas annoté."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/relations/from/:r999999").mock(return_value=httpx.Response(500, json={}))
    annots = client.get_annotations_for_triplet(999999)
    assert annots == []


@respx.mock
def test_refinements_decoded(client):
    """Décode `avocat>116477>66699` → "avocat (personne, juriste)" via lookups node_by_id."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/refinements/avocat").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "avocat", "type": 1, "w": 100},
            {"id": 116477, "name": "personne", "type": 1, "w": 1000},
            {"id": 87286, "name": "fruit", "type": 1, "w": 50},
        ],
        "refinements": [
            {"id": 100, "name": "avocat>116477>66699", "type": 1, "w": 356.0},
            {"id": 101, "name": "avocat>87286", "type": 1, "w": 98.0},
        ],
    }))
    # 66699 = juriste — pas dans nodes locales → un lookup HTTP supplémentaire.
    respx.get(f"{BASE}/v0/node_by_id/66699").mock(return_value=httpx.Response(200, json={
        "id": 66699, "name": "juriste", "type": 1, "w": 911,
    }))

    decoded = client.refinements_decoded("avocat")
    by_name = {d.name: d for d in decoded}
    assert "avocat (personne, juriste)" == by_name["avocat>116477>66699"].decoded
    assert by_name["avocat>116477>66699"].path == ["avocat", "personne", "juriste"]
    assert by_name["avocat>116477>66699"].path_ids == [116477, 66699]
    assert "avocat (fruit)" == by_name["avocat>87286"].decoded


@respx.mock
def test_relations_between_with_filters(client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/relations/from/chat/to/internet").mock(
        return_value=httpx.Response(200, json={"nodes": [], "relations": []})
    )
    client.relations_between("chat", "internet", types_ids=[5, 6], min_weight=10, limit=5)
    assert route.called
    qs = dict(route.calls.last.request.url.params)
    assert qs.get("types_ids") == "5,6"
    assert qs.get("min_weight") == "10"
    assert qs.get("limit") == "5"
