"""Tests de l'enrichissement (détecteurs + validateurs)."""
from __future__ import annotations

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.enrich import Candidate, GapType, detect_gaps
from jdm_agent.enrich.validators import validate_candidate


BASE = "https://jdm-api.demo.lirmm.fr"

REL_TYPES = [
    {"id": 5,  "name": "r_syn",       "help": ""},
    {"id": 6,  "name": "r_isa",       "help": ""},
    {"id": 9,  "name": "r_has_part",  "help": ""},
    {"id": 10, "name": "r_holo",      "help": ""},
    {"id": 17, "name": "r_carac",     "help": ""},
    {"id": 106, "name": "r_has_color", "help": ""},
    {"id": 37, "name": "r_telic_role","help": ""},
    {"id": 15, "name": "r_lieu",      "help": ""},
    {"id": 53, "name": "r_make",      "help": ""},
    {"id": 50, "name": "r_object>mater", "help": ""},
    {"id": 13, "name": "r_agent",     "help": ""},
    {"id": 14, "name": "r_patient",   "help": ""},
    {"id": 16, "name": "r_instr",     "help": ""},
    {"id": 34, "name": "r_manner",    "help": ""},
    {"id": 41, "name": "r_has_conseq","help": ""},
    {"id": 42, "name": "r_has_causatif", "help": ""},
    {"id": 119, "name": "r_but",      "help": ""},
    {"id": 126, "name": "r_isa-incompatible", "help": ""},
]
NODE_TYPES = [{"id": 1, "name": "n_generic", "help": ""}]


def _meta_mocks():
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))


@pytest.fixture
def client(tmp_path):
    cache = DiskJSONCache(cache_dir=tmp_path / "cache")
    return JDMClient(base_url=BASE, cache=cache)


@respx.mock
def test_detect_missing_relation(client):
    """Si le terme n'a aucun triplet pour une relation cible, c'est MISSING."""
    _meta_mocks()
    # Mock: aucune relation sortante pour 'smartphone' sur les types cibles
    respx.get(f"{BASE}/v0/relations/from/smartphone").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    gaps = detect_gaps(client, "smartphone",
                       target_relations=["r_has_part", "r_carac"],
                       check_asymmetries=False)
    by_rel = {g.relation: g for g in gaps}
    assert by_rel["r_has_part"].gap_type == GapType.MISSING
    assert by_rel["r_carac"].gap_type == GapType.MISSING
    assert all(g.severity > 0.5 for g in gaps)


@respx.mock
def test_validate_candidate_duplicate(client):
    """Un candidat déjà présent dans JDM doit être marqué 'duplicate'."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/node_by_name/roue").mock(return_value=httpx.Response(200, json={
        "id": 100, "name": "roue", "type": 1, "w": 1000,
    }))
    respx.get(f"{BASE}/v0/relations/from/voiture").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "voiture", "type": 1, "w": 100},
            {"id": 100, "name": "roue", "type": 1, "w": 1000},
        ],
        "relations": [{"id": 1, "node1": 1, "node2": 100, "type": 9, "w": 630.0}],
    }))
    c = Candidate(term="voiture", relation="r_has_part", target="roue",
                  confidence=0.9, rationale="évident", source="llm")
    out = validate_candidate(client, c)
    assert out.validation_status == "duplicate"


@respx.mock
def test_validate_candidate_unknown_term(client):
    """Si la cible n'existe pas dans JDM, c'est 'unknown_term'."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/node_by_name/zorglub").mock(return_value=httpx.Response(500, json={}))
    c = Candidate(term="smartphone", relation="r_has_part", target="zorglub",
                  confidence=0.5, source="llm")
    out = validate_candidate(client, c)
    assert out.validation_status == "unknown_term"


@respx.mock
def test_validate_candidate_ok(client):
    """Cible existe, pas de duplicate, pas de contradiction → ok."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/node_by_name/processeur").mock(return_value=httpx.Response(200, json={
        "id": 200, "name": "processeur", "type": 1, "w": 800,
    }))
    # Aucun triplet smartphone r_has_part (donc pas duplicate) ni contradiction.
    respx.get(f"{BASE}/v0/relations/from/smartphone").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    c = Candidate(term="smartphone", relation="r_has_part", target="processeur",
                  confidence=0.85, source="llm")
    out = validate_candidate(client, c)
    assert out.validation_status == "ok"


@respx.mock
def test_validate_candidate_inconsistent(client):
    """r_isa contradicté par r_isa-incompatible → 'inconsistent', confidence réduite."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/node_by_name/poisson").mock(return_value=httpx.Response(200, json={
        "id": 50, "name": "poisson", "type": 1, "w": 800,
    }))
    # baleine r_isa → [mammifère] avec w fort
    respx.get(f"{BASE}/v0/relations/from/baleine").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 10, "name": "baleine", "type": 1, "w": 100},
            {"id": 20, "name": "mammifère", "type": 1, "w": 1000},
        ],
        "relations": [{"id": 1, "node1": 10, "node2": 20, "type": 6, "w": 300.0}],
    }))
    # Synonyme fallback de poisson vide
    respx.get(f"{BASE}/v0/relations/from/poisson").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    # mammifère r_isa-incompatible poisson
    respx.get(f"{BASE}/v0/relations/from/mammif%C3%A8re").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 20, "name": "mammifère", "type": 1, "w": 1000},
            {"id": 50, "name": "poisson", "type": 1, "w": 800},
        ],
        "relations": [{"id": 2, "node1": 20, "node2": 50, "type": 126, "w": 50.0}],
    }))
    c = Candidate(term="baleine", relation="r_isa", target="poisson",
                  confidence=0.9, source="llm")
    out = validate_candidate(client, c)
    assert out.validation_status == "inconsistent"
    assert out.confidence <= 0.1
