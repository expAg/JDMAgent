"""Tests du fact-checker (verifier déterministe, sans LLM)."""
from __future__ import annotations

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.factcheck import Claim, Status, factcheck_claims, verify_claim


BASE = "https://jdm-api.demo.lirmm.fr"

REL_TYPES = [
    {"id": 5,   "name": "r_syn",              "help": "synonymes"},
    {"id": 6,   "name": "r_isa",              "help": "hyperonymes"},
    {"id": 17,  "name": "r_carac",            "help": "caractéristiques"},
    {"id": 126, "name": "r_isa-incompatible", "help": "incompatibilité de types"},
]
NODE_TYPES = [{"id": 1, "name": "n_generic", "help": ""}]


@pytest.fixture
def client(tmp_path):
    cache = DiskJSONCache(cache_dir=tmp_path / "cache")
    return JDMClient(base_url=BASE, cache=cache)


def _meta_mocks():
    """Enregistre les mocks meta (types) pour respx — à appeler dans chaque test."""
    respx.get(f"{BASE}/v0/relations_types").mock(return_value=httpx.Response(200, json=REL_TYPES))
    respx.get(f"{BASE}/v0/nodes_types").mock(return_value=httpx.Response(200, json=NODE_TYPES))


@respx.mock
def test_verify_supported_direct(client):
    """`sang r_carac rouge` doit être SUPPORTED."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/relations/from/sang").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "sang", "type": 1, "w": 100},
            {"id": 2, "name": "rouge", "type": 1, "w": 500},
        ],
        "relations": [
            {"id": 1, "node1": 1, "node2": 2, "type": 17, "w": 341.0},
        ],
    }))
    v = verify_claim(client, Claim(
        text="le sang est rouge", subject="sang", relation="r_carac", object="rouge",
    ))
    assert v.status == Status.SUPPORTED
    assert v.evidence_for and v.evidence_for[0].target == "rouge"
    assert v.confidence > 0.5


@respx.mock
def test_verify_contradicted_via_isa_incompatible(client):
    """`baleine r_isa poisson` doit être CONTRADICTED via r_isa-incompatible."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/relations/from/baleine").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "baleine", "type": 1, "w": 100},
            {"id": 10, "name": "mammifère", "type": 1, "w": 1000},
        ],
        "relations": [
            {"id": 1, "node1": 1, "node2": 10, "type": 6, "w": 320.0},  # baleine r_isa mammifère
        ],
    }))
    # Mock r_syn de poisson (recherche fallback synonyme) — vide
    respx.get(f"{BASE}/v0/relations/from/poisson").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    # mammifère r_isa-incompatible poisson
    respx.get(f"{BASE}/v0/relations/from/mammif%C3%A8re").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 10, "name": "mammifère", "type": 1, "w": 1000},
            {"id": 20, "name": "poisson", "type": 1, "w": 800},
        ],
        "relations": [
            {"id": 2, "node1": 10, "node2": 20, "type": 126, "w": 50.0},
        ],
    }))
    v = verify_claim(client, Claim(
        text="la baleine est un poisson",
        subject="baleine", relation="r_isa", object="poisson",
    ))
    assert v.status == Status.CONTRADICTED
    assert any("mammifère" in e.target for e in v.evidence_against)
    assert v.confidence > 0.3


@respx.mock
def test_verify_unknown_when_no_data(client):
    _meta_mocks()
    respx.get(f"{BASE}/v0/relations/from/xyzzy").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    respx.get(f"{BASE}/v0/relations/from/foo").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    v = verify_claim(client, Claim(
        text="x", subject="xyzzy", relation="r_isa", object="foo",
    ))
    assert v.status == Status.UNKNOWN


@respx.mock
def test_unknown_relation_name(client):
    _meta_mocks()
    v = verify_claim(client, Claim(
        text="x", subject="chat", relation="r_inexistant", object="y",
    ))
    assert v.status == Status.UNKNOWN
    assert "inconnue" in v.explanation.lower()


@respx.mock
def test_phase9_direct_negative_match_contradicted(client):
    """Phase 9 : un triplet présent dans JDM avec w<0 doit donner CONTRADICTED
    pour une claim positive (et non plus UNKNOWN comme avant)."""
    _meta_mocks()
    # baleine r_isa poisson existe à w=-35 dans JDM
    respx.get(f"{BASE}/v0/relations/from/baleine").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 10, "name": "baleine", "type": 1, "w": 100},
            {"id": 20, "name": "poisson", "type": 1, "w": 800},
        ],
        "relations": [{"id": 9001, "node1": 10, "node2": 20, "type": 6, "w": -35.0}],
    }))
    # Pas d'annotation
    respx.get(f"{BASE}/v0/relations/from/:r9001").mock(return_value=httpx.Response(500, json={}))
    v = verify_claim(client, Claim(
        text="baleine est un poisson",
        subject="baleine", relation="r_isa", object="poisson",
    ))
    assert v.status == Status.CONTRADICTED
    assert "négation consensuelle" in v.explanation
    assert v.evidence_against
    assert v.evidence_against[0].w == -35.0


@respx.mock
def test_phase9_factcheck_includes_annotations_in_explanation(client):
    """Si le triplet trouvé est annoté, l'explication mentionne les annotations."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/relations/from/chat").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 1, "name": "chat", "type": 1, "w": 100},
            {"id": 2, "name": "mammifère", "type": 1, "w": 1000},
        ],
        "relations": [{"id": 4242, "node1": 1, "node2": 2, "type": 6, "w": 1000.0}],
    }))
    # Annotations attachées au triplet 4242
    respx.get(f"{BASE}/v0/relations/from/:r4242").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 901, "name": "contrastif",     "type": 1, "w": 1003},
            {"id": 902, "name": "non spécifique", "type": 1, "w": 3},
        ],
        "relations": [
            {"id": 91, "node1": 99, "node2": 901, "type": 998, "w": 1003},
            {"id": 92, "node1": 99, "node2": 902, "type": 998, "w": 3},
        ],
    }))
    v = verify_claim(client, Claim(
        text="le chat est un mammifère",
        subject="chat", relation="r_isa", object="mammifère",
    ))
    assert v.status == Status.SUPPORTED
    assert "contrastif" in v.explanation
    assert "Annotations JDM" in v.explanation


@respx.mock
def test_factcheck_claims_batch(client):
    """Mode batch : plusieurs claims, un report consolidé."""
    _meta_mocks()
    respx.get(f"{BASE}/v0/relations/from/sang").mock(return_value=httpx.Response(200, json={
        "nodes": [{"id": 1, "name": "sang", "type": 1, "w": 100},
                  {"id": 2, "name": "rouge", "type": 1, "w": 500}],
        "relations": [{"id": 1, "node1": 1, "node2": 2, "type": 17, "w": 341.0}],
    }))
    respx.get(f"{BASE}/v0/relations/from/xyzzy").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    respx.get(f"{BASE}/v0/relations/from/foo").mock(return_value=httpx.Response(200, json={
        "nodes": [], "relations": [],
    }))
    claims = [
        Claim(text="sang rouge", subject="sang", relation="r_carac", object="rouge"),
        Claim(text="?", subject="xyzzy", relation="r_isa", object="foo"),
    ]
    rep = factcheck_claims(claims, client=client)
    assert rep.summary()["total"] == 2
    statuses = [v.status for v in rep.verdicts]
    assert Status.SUPPORTED in statuses
    assert Status.UNKNOWN in statuses
