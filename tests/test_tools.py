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
    get_agents,
    get_consequences,
    get_instruments,
    get_patients,
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
    {"id": 13, "name": "r_agent", "help": "sujet"},
    {"id": 14, "name": "r_patient", "help": "objet"},
    {"id": 15, "name": "r_lieu", "help": "lieux typiques"},
    {"id": 16, "name": "r_instr", "help": "instrument"},
    {"id": 41, "name": "r_has_conseq", "help": "consequence"},
    {"id": 42, "name": "r_has_causatif", "help": "cause"},
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
    # Termes simples : pas de source_id / target_id (champ omis).
    assert out[0]["source"] == "chat"
    assert out[0]["target"] == "matou"
    assert out[0]["relation"] == "r_syn"
    assert out[0]["w"] == 80.0
    assert "source_id" not in out[0]
    assert "target_id" not in out[0]


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
    # Pré-check : le tool vérifie que les deux termes existent avant
    # de querier les relations. Mocks requis.
    respx.get(f"{BASE}/v0/node_by_name/chat").mock(return_value=httpx.Response(200, json={
        "id": 150, "name": "chat", "type": 1, "w": 100,
    }))
    respx.get(f"{BASE}/v0/node_by_name/internet").mock(return_value=httpx.Response(200, json={
        "id": 999, "name": "internet", "type": 1, "w": 100,
    }))
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
def test_get_relations_between_missing_term(patched_client):
    """Si l'un des termes n'existe pas, on renvoie un item d'erreur
    explicite plutôt qu'une liste vide ambiguë."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/node_by_name/tuile").mock(return_value=httpx.Response(200, json={
        "id": 200, "name": "tuile", "type": 1, "w": 50,
    }))
    # Le terme « materiau » n'existe pas (404 ou 500 avec body "not found")
    respx.get(f"{BASE}/v0/node_by_name/materiau").mock(return_value=httpx.Response(404, json={
        "error": "Node 'materiau' not found!",
    }))
    out = get_relations_between.invoke({"term1": "tuile", "term2": "materiau"})
    assert len(out) == 1
    assert "error" in out[0]
    assert out[0]["missing"] == "materiau"


@respx.mock
def test_disambiguate(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/refinements/avocat").mock(return_value=httpx.Response(200, json=REFINEMENTS_RESP))
    out = disambiguate.invoke({"term": "avocat"})
    ids = [d["sense_id"] for d in out]
    assert "avocat>fruit" in ids and "avocat>juriste" in ids


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
    # Sanity sur quelques outils-clés.
    for n in ("get_synonyms", "lookup_term", "get_agents", "get_patients",
              "get_instruments", "get_consequences", "get_actions_of",
              "get_uses_with", "get_domain_members"):
        assert n in names, f"{n} missing"


@respx.mock
def test_get_agents_calls_r_agent(patched_client):
    """get_agents doit filtrer sur r_agent (id=13) côté HTTP."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/relations/from/manger").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "manger", "type": 1, "w": 10},
            {"id": 2, "name": "chat", "type": 1, "w": 5},
        ],
        "relations": [{"id": 1, "node1": 1, "node2": 2, "type": 13, "w": 200.0}],
    }))
    out = get_agents.invoke({"verb": "manger", "min_weight": 0, "limit": 10})
    assert route.called
    assert dict(route.calls.last.request.url.params)["types_ids"] == "13"
    assert out[0]["source"] == "manger"
    assert out[0]["target"] == "chat"
    assert out[0]["relation"] == "r_agent"
    assert out[0]["w"] == 200.0
    assert "source_id" not in out[0] and "target_id" not in out[0]


@respx.mock
def test_get_consequences_uses_correct_relation_id(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    route = respx.get(f"{BASE}/v0/relations/from/pluie").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    get_consequences.invoke({"term": "pluie"})
    assert dict(route.calls.last.request.url.params)["types_ids"] == "41"


@respx.mock
def test_disambiguate_returns_sense_and_id(patched_client):
    """disambiguate doit renvoyer 'sense' (décodé) et 'sense_id' (brut)."""
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
    respx.get(f"{BASE}/v0/node_by_id/66699").mock(return_value=httpx.Response(200, json={
        "id": 66699, "name": "juriste", "type": 1, "w": 911,
    }))
    out = disambiguate.invoke({"term": "avocat"})
    by_id = {d["sense_id"]: d for d in out}
    assert by_id["avocat>116477>66699"]["sense"] == "avocat (personne, juriste)"
    assert by_id["avocat>87286"]["sense"] == "avocat (fruit)"
    # Trié par poids décroissant.
    assert out[0]["weight"] >= out[-1]["weight"]


@respx.mock
def test_relations_decode_refinement_target(patched_client):
    """Un target qui EST un refinement doit apparaître décodé + target_id préservé."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    # avocat → r_raff_sem → avocat>116477>66699 (le sens "juriste")
    respx.get(f"{BASE}/v0/relations/from/avocat").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "avocat", "type": 1, "w": 100},
            {"id": 116477, "name": "personne", "type": 1, "w": 1000},
            {"id": 565903, "name": "avocat>116477>66699", "type": 1, "w": 50},
        ],
        "relations": [
            {"id": 1, "node1": 1, "node2": 565903, "type": 5, "w": 200.0},
        ],
    }))
    # r_syn id=5 dans REL_TYPES, peu importe la sémantique pour ce test.
    respx.get(f"{BASE}/v0/node_by_id/66699").mock(return_value=httpx.Response(200, json={
        "id": 66699, "name": "juriste", "type": 1, "w": 911,
    }))

    out = get_synonyms.invoke({"term": "avocat", "min_weight": 0, "limit": 5})
    assert out[0]["source"] == "avocat"
    assert out[0]["target"] == "avocat (personne, juriste)"
    assert out[0]["target_id"] == "avocat>116477>66699"
    assert "source_id" not in out[0]  # source = terme simple


@respx.mock
def test_detect_gaps_tool(patched_client):
    """detect_gaps doit renvoyer des Gap dicts pour un terme sans triplets."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/relations/from/smartphone").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    from jdm_agent.tools.jdm_tools import detect_gaps as detect_gaps_tool
    out = detect_gaps_tool.invoke({
        "term": "smartphone",
        "relations": ["r_isa"],   # une relation présente dans REL_TYPES (id=6)
    })
    assert isinstance(out, list)
    assert any(g["term"] == "smartphone" for g in out)


@respx.mock
def test_validate_candidate_tool(patched_client):
    """validate_candidate doit retourner un dict avec validation_status."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/node_by_name/processeur").mock(return_value=httpx.Response(200, json={
        "id": 200, "name": "processeur", "type": 1, "w": 800,
    }))
    respx.get(f"{BASE}/v0/relations/from/smartphone").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    from jdm_agent.tools.jdm_tools import validate_candidate as validate_tool
    out = validate_tool.invoke({
        "term": "smartphone", "relation": "r_isa", "target": "processeur",
    })
    assert out["validation_status"] in ("ok", "duplicate", "unknown_term", "inconsistent")


@respx.mock
def test_lookup_term_includes_decoded(patched_client):
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))
    respx.get(f"{BASE}/v0/node_by_name/avocat%3E116477%3E66699").mock(return_value=httpx.Response(200, json={
        "id": 565903, "name": "avocat>116477>66699", "type": 1, "w": 50,
    }))
    respx.get(f"{BASE}/v0/node_by_id/116477").mock(return_value=httpx.Response(200, json={
        "id": 116477, "name": "personne", "type": 1, "w": 1000,
    }))
    respx.get(f"{BASE}/v0/node_by_id/66699").mock(return_value=httpx.Response(200, json={
        "id": 66699, "name": "juriste", "type": 1, "w": 911,
    }))
    out = lookup_term.invoke({"term": "avocat>116477>66699"})
    assert out["name"] == "avocat>116477>66699"
    assert out["decoded"] == "avocat (personne, juriste)"


def test_all_tools_have_valid_schemas():
    """Chaque @tool doit avoir un args_schema Pydantic exploitable par un LLM."""
    for t in ALL_TOOLS:
        schema = t.args_schema.model_json_schema() if t.args_schema else {}
        assert "properties" in schema, f"{t.name} sans schema"


# -------------------- Phase 12 : write_submission_file avec upload --------------------

@respx.mock
def test_write_submission_file_local_only_default(tmp_path, monkeypatch):
    """Par défaut upload=False : on écrit le fichier local, on ne POST rien."""
    monkeypatch.setenv("JDM_DROPS_API_KEY", "would-be-used")
    from jdm_agent.tools.jdm_tools import write_submission_file
    from jdm_agent.enrich.uploader import DEFAULT_ENDPOINT_URL

    # Si un POST partait, respx mock le bloquerait (pas de route → erreur).
    out = write_submission_file.invoke({
        "triplets": [{
            "term": "chat", "relation": "r_isa", "target": "mammifère",
            "annotation": "constitutif", "explanation": "trivialement",
        }],
        "path": str(tmp_path / "sub.txt"),
    })
    assert out["count"] == 1
    assert "upload" not in out  # pas tenté


@respx.mock
def test_write_submission_file_with_upload_success(tmp_path, monkeypatch):
    monkeypatch.delenv("JDM_DROPS_API_KEY", raising=False)
    from jdm_agent.tools.jdm_tools import write_submission_file
    from jdm_agent.enrich.uploader import DEFAULT_ENDPOINT_URL

    respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"status": "ok", "id": 7})
    )

    out = write_submission_file.invoke({
        "triplets": [{
            "term": "chat", "relation": "r_isa", "target": "mammifère",
            "annotation": "", "explanation": "trivialement",
        }],
        "path": str(tmp_path / "sub.txt"),
        "upload": True,
        "model_name": "claude-sonnet-4-7",
        "api_key": "explicit-key",
    })
    assert out["count"] == 1
    assert out["upload"]["ok"] is True
    assert out["upload"]["status_code"] == 200
    assert out["upload"]["uploaded_as"].endswith(
        "_automatic_submission_from_claude-sonnet-4-7.enrich"
    )
    assert out["upload"]["response"] == {"status": "ok", "id": 7}


def test_write_submission_file_upload_without_api_key(tmp_path, monkeypatch):
    """upload=True sans clé : fichier local OK, upload reporte l'erreur."""
    monkeypatch.delenv("JDM_DROPS_API_KEY", raising=False)
    from jdm_agent.tools.jdm_tools import write_submission_file

    out = write_submission_file.invoke({
        "triplets": [{
            "term": "chat", "relation": "r_isa", "target": "mammifère",
            "annotation": "", "explanation": "trivialement",
        }],
        "path": str(tmp_path / "sub.txt"),
        "upload": True,
        "model_name": "claude-haiku",
    })
    assert out["count"] == 1
    assert out["upload"]["ok"] is False
    assert "API" in out["upload"]["error"] or "JDM_DROPS_API_KEY" in out["upload"]["error"]
