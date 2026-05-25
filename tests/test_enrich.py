"""Tests de l'enrichissement (détecteurs + validateurs)."""
from __future__ import annotations

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.enrich import Candidate, GapType, detect_gaps, write_submission
from jdm_agent.enrich.validators import (
    consolidate_candidate,
    exclusion_context,
    get_consolidation,
    is_excluded,
    register_consolidation,
    register_exclusion,
    validate_candidate,
)


def test_write_submission_only_consolidated(tmp_path):
    """Le fichier de soumission ne contient QUE les triplets consolidés —
    ni les non-consolidés, ni les réfutés, ni de section « À REVOIR »."""
    cands = [
        Candidate(term="a", relation="r_isa", target="b", confidence=0.8,
                  source="llm", validation_status="ok",
                  consolidation_status="consolidated",
                  consolidation_explanation="Oui — déduit par inférence : a r_isa x ; x r_isa b"),
        Candidate(term="c", relation="r_isa", target="d", confidence=0.5,
                  source="llm", validation_status="ok",
                  consolidation_status="not_consolidated"),
        Candidate(term="e", relation="r_isa", target="f", confidence=0.1,
                  source="llm", validation_status="ok",
                  consolidation_status="rejected"),
    ]
    fn = tmp_path / "soumission.txt"
    n = write_submission(fn, cands)
    assert n == 1
    content = fn.read_text(encoding="utf-8")
    assert "a | r_isa | b" in content      # consolidé → écrit, format pipe espacé
    assert "< Oui" in content
    assert "c | r_isa | d" not in content  # non consolidé → exclu
    assert "e | r_isa | f" not in content  # réfuté → exclu
    assert "REVOIR" not in content         # plus de section à-revoir


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
                       target_relations=["r_has_part", "r_carac"])
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
def test_validate_candidate_ok_without_direct_negation(client):
    """Phase 11 : `validate_candidate` est en CONTENANCE pure (effort 0).

    `baleine r_isa poisson` n'a PAS de triplet direct négatif dans ce mock
    (l'incohérence n'apparaît que via inférence r_isa-incompatible) → la
    validation structurelle conclut « ok » ; c'est la consolidation qui
    réfutera (cf. test_consolidate_candidate_rejected).
    """
    _meta_mocks()
    respx.get(f"{BASE}/v0/node_by_name/poisson").mock(return_value=httpx.Response(200, json={
        "id": 50, "name": "poisson", "type": 1, "w": 800,
    }))
    # baleine r_isa → [mammifère] : aucun triplet direct baleine r_isa poisson.
    respx.get(f"{BASE}/v0/relations/from/baleine").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 10, "name": "baleine", "type": 1, "w": 100},
            {"id": 20, "name": "mammifère", "type": 1, "w": 1000},
        ],
        "relations": [{"id": 1, "node1": 10, "node2": 20, "type": 6, "w": 300.0}],
    }))
    c = Candidate(term="baleine", relation="r_isa", target="poisson",
                  confidence=0.9, source="llm")
    out = validate_candidate(client, c)
    assert out.validation_status == "ok"


@respx.mock
def test_consolidate_candidate_rejected(client):
    """Phase 11 : `consolidate_candidate` réfute par inférence (r_isa-incompatible)."""
    _meta_mocks()
    # baleine r_isa → [mammifère] avec w fort
    respx.get(f"{BASE}/v0/relations/from/baleine").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 10, "name": "baleine", "type": 1, "w": 100},
            {"id": 20, "name": "mammifère", "type": 1, "w": 1000},
        ],
        "relations": [{"id": 1, "node1": 10, "node2": 20, "type": 6, "w": 300.0}],
    }))
    # mammifère r_isa-incompatible poisson → réfutation
    respx.get(f"{BASE}/v0/relations/from/mammif%C3%A8re").mock(return_value=httpx.Response(200, json={
        "nodes": [
            {"id": 20, "name": "mammifère", "type": 1, "w": 1000},
            {"id": 50, "name": "poisson", "type": 1, "w": 800},
        ],
        "relations": [{"id": 2, "node1": 20, "node2": 50, "type": 126, "w": 50.0}],
    }))
    c = Candidate(term="baleine", relation="r_isa", target="poisson",
                  confidence=0.9, source="llm")
    out = consolidate_candidate(client, c, effort=1)
    assert out.consolidation_status == "rejected"
    assert out.consolidation_schema == "isa_incompatible"
    assert out.confidence <= 0.1


# ---------- Option A : registry d'exclusion (fast-path anti-doublons) ----------


def test_exclusion_registry_no_context_is_noop():
    """Hors `exclusion_context()`, register/is_excluded sont des no-ops."""
    register_exclusion("voiture", "r_has_part", ["roue", "moteur"])
    assert is_excluded("voiture", "r_has_part", "roue") is None


def test_exclusion_registry_basic():
    """Dans un `exclusion_context()`, register + is_excluded fonctionnent."""
    with exclusion_context():
        register_exclusion("voiture", "r_has_part", ["roue", "moteur"])
        # match exact
        assert is_excluded("voiture", "r_has_part", "roue") is not None
        # match insensible à la casse / aux accents
        assert is_excluded("VOITURE", "r_has_part", "ROUE") is not None
        # pas dans la liste
        assert is_excluded("voiture", "r_has_part", "phare") is None
        # autre relation → pas de match
        assert is_excluded("voiture", "r_isa", "roue") is None


def test_exclusion_context_isolation():
    """Deux contextes successifs ne partagent pas leur registry."""
    with exclusion_context():
        register_exclusion("a", "r_isa", ["b"])
        assert is_excluded("a", "r_isa", "b") is not None
    # contexte fermé → no-op
    assert is_excluded("a", "r_isa", "b") is None
    # nouveau contexte vide
    with exclusion_context():
        assert is_excluded("a", "r_isa", "b") is None


def test_consolidation_registry_no_context_is_noop():
    """Hors `exclusion_context()`, register/get sont des no-ops."""
    register_consolidation("a", "r_isa", "b", "Oui, déductible (transitivité)")
    assert get_consolidation("a", "r_isa", "b") is None


def test_consolidation_registry_basic():
    """Dans un `exclusion_context()`, register + get fonctionnent."""
    with exclusion_context():
        register_consolidation("voiture", "r_has_part", "roue",
                               "Oui, déductible (transitivité) : voiture r_isa véhicule ; véhicule r_has_part roue.",
                               schema="transitivity")
        got = get_consolidation("voiture", "r_has_part", "roue")
        assert got is not None
        assert "transitivité" in got["explanation"]
        assert got["schema"] == "transitivity"
        # Match insensible à la casse et accents
        got2 = get_consolidation("VOITURE", "r_has_part", "ROUE")
        assert got2 is not None
        # Pas dans le registry → None
        assert get_consolidation("vélo", "r_has_part", "selle") is None


def test_validate_candidate_uses_exclusion_fast_path():
    """validate_candidate court-circuite SANS appeler verify_claim si
    la cible est dans le registry. On le prouve en NE mockant AUCUN
    endpoint pour /relations/from/ — si verify_claim était appelé, le
    test échouerait avec une vraie requête HTTP."""
    from unittest.mock import MagicMock

    fake_client = MagicMock()
    # node_by_name réussit (pas de 'unknown_term')
    fake_client.node_by_name.return_value = {"id": 100, "name": "roue"}

    cand = Candidate(term="voiture", relation="r_has_part", target="roue",
                     confidence=0.9, rationale="évident", source="llm")

    with exclusion_context():
        register_exclusion("voiture", "r_has_part", ["roue", "moteur"])
        out = validate_candidate(fake_client, cand)

    assert out.validation_status == "duplicate"
    assert "pré-fetch" in out.validation_note.lower()
    # node_by_name a bien été appelé (étape 1) mais aucun autre appel
    # côté client (= pas de verify_claim).
    fake_client.node_by_name.assert_called_once_with("roue")
    # relations_from N'A PAS été appelé (verify_claim aurait fait ça)
    fake_client.relations_from.assert_not_called()
