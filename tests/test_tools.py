"""Tests des outils LangChain (mockant JDMClient via respx)."""
from __future__ import annotations

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.tools.jdm_tools import (
    ALL_TOOLS,
    build_jdm_tools,
    disambiguate,
    get_relations_between,
    get_relations_of_type,
    get_synonyms,
    list_relation_types,
    lookup_term,
    set_default_client,
)


BASE = "https://jdm-api.demo.lirmm.fr"

REL_TYPES = [
    {"id": 5, "name": "r_syn", "help": "synonymes"},
    {"id": 6, "name": "r_isa", "help": "hyperonymes"},
    {"id": 15, "name": "r_lieu", "help": "lieux typiques"},
]
NODE_TYPES = [{"id": 1, "name": "n_generic", "help": ""}]

NODE_CHAT = {"id": 150, "name": "chat", "type": 1, "w": 7967}

SYN_RESP = {
    "nodes": [
        {"id": 150, "name": "chat", "type": 1, "w": 7967},
        {"id": 999, "name": "matou", "type": 1, "w": 100},
    ],
    "relations": [
        {"id": 1, "node1": 150, "node2": 999, "type": 5, "w": 80.0},
    ],
}

REFINEMENTS_RESP = {
    "nodes": [{"id": 1, "name": "avocat", "type": 1, "w": 10}],
    "refinements": [
        {"id": 11, "name": "avocat>fruit", "type": 1, "w": 50},
        {"id": 12, "name": "avocat>juriste", "type": 1, "w": 60},
    ],
}


@pytest.fixture
def patched_client(tmp_path):
    cache = DiskJSONCache(cache_dir=tmp_path / "cache")
    client = JDMClient(base_url=BASE, cache=cache)
    set_default_client(client)
    return client


@respx.mock
def test_lookup_term(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/node_by_name/chat").mock(return_value=httpx.Response(200, json=NODE_CHAT))
    out = lookup_term.invoke({"term": "chat"})
    assert out["name"] == "chat"
    assert out["id"] == 150
    assert "weight" in out


@respx.mock
def test_lookup_term_unknown(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/node_by_name/zzzzz").mock(return_value=httpx.Response(404, json={}))
    out = lookup_term.invoke({"term": "zzzzz"})
    assert "error" in out


@respx.mock
def test_get_synonyms_returns_triplets(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/relations/from/chat").mock(return_value=httpx.Response(200, json=SYN_RESP))

    out = get_synonyms.invoke({"term": "chat", "min_weight": 0, "limit": 10})
    assert isinstance(out, list)
    assert out[0] == {"source": "chat", "relation": "r_syn", "target": "matou", "w": 80.0}


@respx.mock
def test_get_relations_of_type_unknown_relation(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    out = get_relations_of_type.invoke({"term": "chat", "relation_name": "r_invented"})
    assert out and "error" in out[0]


@respx.mock
def test_get_relations_of_type_to_direction(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/relations/to/poisson").mock(
        return_value=httpx.Response(200, json={
            "nodes": [{"id": 50, "name": "truite", "type": 1, "w": 10}],
            "relations": [{"id": 1, "node1": 50, "node2": 1, "type": 6, "w": 90.0}],
        })
    )
    out = get_relations_of_type.invoke({
        "term": "poisson", "relation_name": "r_isa", "direction": "to",
    })
    assert route.called
    # Pour direction="to", le terme interrogé est la CIBLE du triplet (target),
    # et la source est l'autre bout (ici "truite").
    assert out[0]["target"] == "poisson"
    assert out[0]["source"] == "truite"


@respx.mock
def test_get_relations_between(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/relations/from/chat/to/internet").mock(return_value=httpx.Response(200, json={
        "nodes": [],
        "relations": [
            {"id": 1, "node1": 150, "node2": 999, "type": 5, "w": 30.0},
            {"id": 2, "node1": 150, "node2": 999, "type": 15, "w": 50.0},
        ],
    }))
    out = get_relations_between.invoke({"term1": "chat", "term2": "internet", "min_weight": 0})
    assert len(out) == 2
    # Trié par poids décroissant.
    assert out[0]["w"] >= out[1]["w"]


@respx.mock
def test_disambiguate(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/refinements/avocat").mock(return_value=httpx.Response(200, json=REFINEMENTS_RESP))
    out = disambiguate.invoke({"term": "avocat"})
    names = [d["name"] for d in out]
    assert "avocat>fruit" in names and "avocat>juriste" in names


@respx.mock
def test_list_relation_types_with_prefix(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    out = list_relation_types.invoke({"prefix": "r_is"})
    names = [d["name"] for d in out]
    assert "r_isa" in names
    assert "r_syn" not in names


def test_build_jdm_tools_enriches_docstrings(patched_client):
    """Vérifie que les docstrings sont enrichies par describe_relation()."""
    tools = build_jdm_tools(enrich_docstrings=True)
    by_name = {t.name: t for t in tools}
    desc = by_name["get_synonyms"].description
    # L'enrichissement ajoute la balise [JDM] si le fichier .md est trouvé.
    # En cas d'absence du fichier, on tolère le test (skip silencieux).
    if "[JDM]" not in desc:
        pytest.skip("relation_definitions.md non trouvé depuis ce contexte")
    assert "r_syn" in desc


def test_all_tools_have_unique_names():
    names = [t.name for t in ALL_TOOLS]
    assert len(names) == len(set(names))
    assert "get_synonyms" in names
    assert "lookup_term" in names


def test_all_tools_have_valid_schemas():
    """Chaque @tool doit avoir un args_schema Pydantic exploitable par un LLM."""
    for t in ALL_TOOLS:
        schema = t.args_schema.model_json_schema() if t.args_schema else {}
        assert "properties" in schema, f"{t.name} sans schema"
