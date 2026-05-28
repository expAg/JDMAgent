"""Tests du flow d'annotation sémantique JDM."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from jdm_agent.annotate import (
    AnnotationCategory, AnnotationProposal, parse_category,
    write_annotation_file,
)
from jdm_agent.annotate.proposer import propose_annotations


# ─────────────────────── parse_category ───────────────────────

def test_parse_category_exact():
    assert parse_category("constitutif") == AnnotationCategory.CONSTITUTIF
    assert parse_category("contrastif") == AnnotationCategory.CONTRASTIF
    assert parse_category("non spécifique") == AnnotationCategory.NON_SPECIFIQUE
    assert parse_category("exception") == AnnotationCategory.EXCEPTION


def test_parse_category_ascii_variants():
    """Le LLM peut écrire sans accent ou avec un tiret — on tolère."""
    assert parse_category("non specifique") == AnnotationCategory.NON_SPECIFIQUE
    assert parse_category("non-specifique") == AnnotationCategory.NON_SPECIFIQUE
    assert parse_category("non_specifique") == AnnotationCategory.NON_SPECIFIQUE
    assert parse_category("CONSTITUTIF") == AnnotationCategory.CONSTITUTIF
    assert parse_category("  contrastif  ") == AnnotationCategory.CONTRASTIF


def test_parse_category_invalid_returns_none():
    assert parse_category("") is None
    assert parse_category(None) is None
    assert parse_category("essentiel") is None     # pas dans la taxonomie
    assert parse_category("constitutive") is None  # pas tolérant à l'orthographe


# ─────────────────────── AnnotationProposal ───────────────────────

def test_proposal_disagrees_with_jdm():
    p = AnnotationProposal(
        subject="avocat (juriste)", relation="r_isa", target="juriste",
        category=AnnotationCategory.CONSTITUTIF,
        justification="essentiel",
        existing_jdm="non spécifique",
    )
    assert p.disagrees_with_jdm() is True


def test_proposal_agrees_with_jdm():
    p = AnnotationProposal(
        subject="x", relation="r_isa", target="y",
        category=AnnotationCategory.CONSTITUTIF,
        existing_jdm="constitutif",
    )
    assert p.disagrees_with_jdm() is False


def test_proposal_no_jdm_means_no_disagreement():
    p = AnnotationProposal(
        subject="x", relation="r_isa", target="y",
        category=AnnotationCategory.CONSTITUTIF,
        existing_jdm=None,
    )
    assert p.disagrees_with_jdm() is False


def test_proposal_no_category_means_no_disagreement():
    """Si LLM n'annote pas, il ne peut pas être en désaccord."""
    p = AnnotationProposal(
        subject="x", relation="r_isa", target="y",
        category=None,
        existing_jdm="constitutif",
    )
    assert p.disagrees_with_jdm() is False
    assert p.is_annotable() is False


# ─────────────────────── propose_annotations (LLM mocké) ───────────────────────

class _FakeRaw:
    def __init__(self, index, category, justification=""):
        self.index = index
        self.category = category
        self.justification = justification


class _FakeOut:
    def __init__(self, annotations):
        self.annotations = annotations


def _make_llm(annotations):
    """Construit un LLM mocké dont with_structured_output().invoke() renvoie
    `_FakeOut(annotations)`."""
    structured = MagicMock()
    structured.invoke = MagicMock(return_value=_FakeOut(annotations))
    llm = MagicMock()
    llm.with_structured_output = MagicMock(return_value=structured)
    return llm


def test_propose_annotations_happy_path():
    triplets = [
        {"subject": "avocat (juriste)", "relation": "r_isa", "target": "juriste"},
        {"subject": "avocat (juriste)", "relation": "r_isa", "target": "humain"},
    ]
    llm = _make_llm([
        _FakeRaw(0, "constitutif", "définition essentielle du métier"),
        _FakeRaw(1, "non spécifique", "vrai mais trop générique"),
    ])
    props = propose_annotations(triplets, llm)
    assert len(props) == 2
    assert props[0].category == AnnotationCategory.CONSTITUTIF
    assert "essentielle" in props[0].justification
    assert props[1].category == AnnotationCategory.NON_SPECIFIQUE


def test_propose_annotations_unannotable_returns_none():
    triplets = [{"subject": "x", "relation": "r_isa", "target": "y"}]
    llm = _make_llm([_FakeRaw(0, "", "ne sait pas")])
    props = propose_annotations(triplets, llm)
    assert len(props) == 1
    assert props[0].category is None
    assert props[0].is_annotable() is False


def test_propose_annotations_llm_failure_returns_stubs():
    """Si le LLM lève (timeout, parse error), on renvoie des stubs vides
    plutôt que de planter le pipeline."""
    triplets = [{"subject": "x", "relation": "r_isa", "target": "y"}]
    llm = MagicMock()
    structured = MagicMock()
    structured.invoke = MagicMock(side_effect=RuntimeError("boom"))
    llm.with_structured_output = MagicMock(return_value=structured)
    props = propose_annotations(triplets, llm)
    assert len(props) == 1
    assert props[0].category is None


def test_propose_annotations_existing_jdm_threaded_through():
    triplets = [
        {"subject": "x", "relation": "r_isa", "target": "y"},
        {"subject": "a", "relation": "r_isa", "target": "b"},
    ]
    llm = _make_llm([
        _FakeRaw(0, "constitutif"),
        _FakeRaw(1, "contrastif"),
    ])
    props = propose_annotations(triplets, llm,
                                existing_jdm_by_index={0: "non spécifique"})
    assert props[0].existing_jdm == "non spécifique"
    assert props[0].disagrees_with_jdm() is True
    assert props[1].existing_jdm is None
    assert props[1].disagrees_with_jdm() is False


def test_propose_annotations_skipped_index_gets_no_annotation():
    """Si le LLM omet un triplet dans sa réponse, on le marque non annoté."""
    triplets = [
        {"subject": "x", "relation": "r_isa", "target": "y"},
        {"subject": "a", "relation": "r_isa", "target": "b"},
    ]
    # Seul l'index 1 est renvoyé
    llm = _make_llm([_FakeRaw(1, "constitutif")])
    props = propose_annotations(triplets, llm)
    assert props[0].category is None  # omis → None
    assert props[1].category == AnnotationCategory.CONSTITUTIF


# ─────────────────────── write_annotation_file ───────────────────────

def test_write_annotation_file_two_sections(tmp_path):
    proposals = [
        # Annotation normale (LLM, pas de JDM existant)
        AnnotationProposal(
            subject="avocat (juriste)", relation="r_isa", target="juriste",
            category=AnnotationCategory.CONSTITUTIF,
            justification="définition essentielle"),
        # LLM diverge de JDM → SIGNALEMENT
        AnnotationProposal(
            subject="baleine", relation="r_isa", target="poisson",
            category=AnnotationCategory.EXCEPTION,
            justification="biologiquement faux, populairement vrai",
            existing_jdm="constitutif"),
        # Non annotable → skip
        AnnotationProposal(
            subject="x", relation="r_isa", target="y",
            category=None, justification=""),
    ]
    path = tmp_path / "test.annot"
    stats = write_annotation_file(path, proposals)
    assert stats["n_annotated"] == 1
    assert stats["n_signalement"] == 1
    assert stats["n_skipped"] == 1

    content = path.read_text(encoding="utf-8")
    # Section principale
    assert "avocat (juriste)|r_isa|juriste|constitutif" in content
    assert "définition essentielle" in content
    # Section signalement
    assert "=====SIGNALEMENT=====" in content
    assert "JDM:constitutif|LLM:exception" in content
    assert "biologiquement faux" in content
    # Skip : le triplet x|r_isa|y n'apparaît PAS
    assert "|r_isa|y" not in content


def test_write_annotation_file_no_signalement_no_header(tmp_path):
    """Si aucun désaccord, la section SIGNALEMENT n'est pas écrite."""
    proposals = [
        AnnotationProposal(
            subject="x", relation="r_isa", target="y",
            category=AnnotationCategory.CONSTITUTIF),
    ]
    path = tmp_path / "test.annot"
    stats = write_annotation_file(path, proposals)
    assert stats["n_signalement"] == 0
    content = path.read_text(encoding="utf-8")
    assert "=====SIGNALEMENT=====" not in content


def test_write_annotation_file_pipe_escape(tmp_path):
    """Un pipe dans un label ne doit pas casser le parser JDM côté serveur."""
    proposals = [
        AnnotationProposal(
            subject="terme|tordu", relation="r_isa", target="cible|piégée",
            category=AnnotationCategory.CONSTITUTIF, justification="test"),
    ]
    path = tmp_path / "test.annot"
    write_annotation_file(path, proposals)
    content = path.read_text(encoding="utf-8")
    # Les pipes des labels sont remplacés par /
    assert "terme/tordu|r_isa|cible/piégée|constitutif" in content


# ─────────────────────── compute_submission_filename .annot ───────────────────────

def test_compute_submission_filename_annot_extension():
    from datetime import datetime
    from jdm_agent.enrich.pipeline import compute_submission_filename
    fn = compute_submission_filename(
        "claude-sonnet-4-7",
        now=datetime(2026, 5, 28, 14, 32),
        extension=".annot",
    )
    assert fn.endswith(".annot")
    assert "claude-sonnet-4-7" in fn
    assert "14h32" in fn


# ─────────────────────── annotation_workflow tool ───────────────────────

def test_annotation_workflow_returns_canonical_dict():
    """Le tool de workflow doit renvoyer le contrat attendu (title, steps,
    rules, taxonomy) sans appel HTTP ni LLM."""
    from jdm_agent.tools.jdm_tools import annotation_workflow
    out = annotation_workflow.invoke({})
    assert "title" in out
    assert "taxonomy" in out
    assert "constitutif" in out["taxonomy"]
    assert "contrastif" in out["taxonomy"]
    assert "non spécifique" in out["taxonomy"]
    assert "exception" in out["taxonomy"]
    assert any(s.get("tool") == "write_submission_file" for s in out["steps"])
    assert any("signalement" in r.lower() or "SIGNALEMENT" in r
               for r in out["rules"])
