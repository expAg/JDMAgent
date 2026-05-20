"""Tests du parseur de relation_definitions.md."""
from __future__ import annotations

from pathlib import Path

import pytest

from jdm_agent.client.relations import (
    RelationDoc,
    describe_relation,
    parse_relation_definitions,
)


SAMPLE = """# Description Sémantique des Relations - JeuxDeMots

## 1. Test

### Synonym (`r_syn`)
Relie des termes ayant un sens identique ou très proche.
* chat | r_syn | matou
* voiture | r_syn | automobile

### Is-A / Generic (`r_isa`)
Désigne un lien de généralisation.
* chat | r_isa | mammifère
* truite | r_isa | poisson
* marteau | r_isa | outil
"""


@pytest.fixture
def sample_file(tmp_path: Path) -> Path:
    p = tmp_path / "relation_definitions.md"
    p.write_bytes(SAMPLE.encode("cp1252"))
    return p


def test_parses_basic_relations(sample_file: Path):
    docs = parse_relation_definitions(sample_file)
    assert set(docs.keys()) == {"r_syn", "r_isa"}
    r = docs["r_syn"]
    assert isinstance(r, RelationDoc)
    assert "identique" in r.description
    assert ("chat", "r_syn", "matou") in r.examples
    assert len(docs["r_isa"].examples) == 3


def test_describe_relation_output(sample_file: Path):
    docs = parse_relation_definitions(sample_file)
    out = describe_relation("r_isa", docs)
    assert "r_isa" in out
    assert "ex.:" in out
    assert "Is-A" in out


def test_missing_file_is_non_blocking(tmp_path: Path):
    docs = parse_relation_definitions(tmp_path / "nope.md")
    assert docs == {}


def test_describe_relation_unknown(sample_file: Path):
    docs = parse_relation_definitions(sample_file)
    out = describe_relation("r_unknown", docs)
    assert "r_unknown" in out
    assert "non document" in out.lower()


def test_real_relation_definitions_file_parses():
    """Smoke-test contre le vrai fichier (s'il est présent)."""
    docs = parse_relation_definitions()
    if not docs:
        pytest.skip("relation_definitions.md absent")
    # Sanity : on doit retrouver les relations canoniques.
    for code in ("r_syn", "r_isa", "r_hypo", "r_anto", "r_has_part"):
        assert code in docs, f"{code} manque dans relation_definitions.md"
    # > 100 relations parsées (le doc en référence ~180).
    assert len(docs) > 100
