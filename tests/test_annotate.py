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
    # Section principale — nouveau format avec espaces + crochets
    assert "avocat (juriste) | r_isa | juriste | [constitutif]" in content
    assert "définition essentielle" in content
    # Section signalement — espaces + crochets
    assert "=====SIGNALEMENT=====" in content
    assert "JDM:[constitutif] | LLM:[exception]" in content
    assert "biologiquement faux" in content
    # Skip : le triplet x|r_isa|y n'apparaît PAS
    assert "r_isa | y" not in content


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


def test_write_annotation_file_agreement_not_in_signalement(tmp_path):
    """RÉGRESSION : si JDM et LLM ont la MÊME annotation, le triplet
    va dans la section principale, JAMAIS dans SIGNALEMENT.
    Bug rapporté : 'mouette | r_isa | oiseau | JDM:non spécifique |
    LLM:non spécifique < Aucun désaccord >' apparaissait en SIGNALEMENT."""
    proposals = [
        # Accord parfait JDM == LLM → section principale
        AnnotationProposal(
            subject="mouette", relation="r_isa", target="oiseau",
            category=AnnotationCategory.NON_SPECIFIQUE,
            justification="peu informatif",
            existing_jdm="non spécifique"),
    ]
    path = tmp_path / "test.annot"
    stats = write_annotation_file(path, proposals)
    assert stats["n_annotated"] == 1
    assert stats["n_signalement"] == 0
    content = path.read_text(encoding="utf-8")
    # En section principale (avec espaces + crochets)
    assert "mouette | r_isa | oiseau | [non spécifique]" in content
    # PAS dans section signalement (qui ne doit même pas exister)
    assert "=====SIGNALEMENT=====" not in content
    assert "JDM:[non spécifique] | LLM:[non spécifique]" not in content


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
    # Les pipes des labels sont remplacés par /, espaces + crochets autour
    assert "terme/tordu | r_isa | cible/piégée | [constitutif]" in content


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


def test_annotation_workflow_uses_inline_annotations():
    """Régression : pour le flow annotation, l'étape de récupération des
    triplets DOIT instruire le LLM d'appeler `get_relations_of_type` avec
    `with_annotations=True`, et NE DOIT PAS imposer une étape séparée
    d'appel à `get_triplet_annotations` (= N+1 round-trips inutiles)."""
    from jdm_agent.tools.jdm_tools import annotation_workflow
    out = annotation_workflow.invoke({})
    # Trouve l'étape de récupération des triplets
    fetch_steps = [s for s in out["steps"]
                   if "get_relations_of_type" in s.get("tool", "")
                   or "get_relations_of_type" in s.get("description", "")]
    assert fetch_steps, "Aucune étape get_relations_of_type trouvée"
    blob = " ".join(s["description"] for s in fetch_steps)
    assert "with_annotations=True" in blob, (
        "L'étape de fetch doit explicitement demander with_annotations=True"
    )
    # Aucune étape séparée get_triplet_annotations dans le tool field
    steps_calling_gta = [s for s in out["steps"]
                        if s.get("tool", "").startswith("get_triplet_annotations")]
    assert not steps_calling_gta, (
        "annotation_workflow ne doit plus inclure d'étape séparée "
        "get_triplet_annotations (les annotations viennent inline)"
    )


def test_get_relations_of_type_exposes_with_annotations():
    """Régression : le tool MCP get_relations_of_type DOIT exposer
    with_annotations dans sa signature accessible au LLM."""
    from jdm_agent.tools.jdm_tools import get_relations_of_type
    schema = get_relations_of_type.args_schema.model_json_schema()
    props = schema.get("properties", {})
    assert "with_annotations" in props, (
        "with_annotations doit être exposé pour que les flows annotation/"
        "audit puissent inliner les annotations en un seul appel"
    )


def test_annotation_workflow_no_directive_categories():
    """Régression : la consigne 'pas de terme' ne doit PAS imposer un
    type de mot (animal/objet/action…) qui biaise le LLM vers les
    champs scolaires. On veut 'carte blanche dans tout le lexique'."""
    from jdm_agent.tools.jdm_tools import annotation_workflow
    out = annotation_workflow.invoke({})
    # Cherche dans toutes les étapes + rules + if_no_term
    blob = " ".join([
        str(out.get("if_no_term", "")),
        *(str(s.get("description", "")) for s in out.get("steps", [])),
        *(str(r) for r in out.get("rules", [])),
    ])
    # Termes interdits dans la consigne (trop directifs)
    forbidden_phrases = [
        "2-3 termes",
        "deux ou trois termes",
        "(animal, objet, action",
        "un animal, un objet, une action",
    ]
    for phrase in forbidden_phrases:
        assert phrase.lower() not in blob.lower(), (
            f"Phrase trop directive trouvée : {phrase!r}"
        )
    # Termes attendus (carte blanche)
    assert "carte blanche" in blob.lower() or "tout le lexique" in blob.lower()


# ─────────────────────── _iteration_block helper ───────────────────────

def test_iteration_block_bounded_with_target():
    """Cible + budget borné → mention des deux conditions d'arrêt."""
    from jarvis import _iteration_block
    txt = _iteration_block(target_count=10, budget_label="25", unit="triplet")
    assert "10 triplets" in txt
    assert "25" in txt
    assert "épuisement du budget" in txt or "épuiser" in txt.lower()


def test_iteration_block_unlimited_with_target():
    """Cible + budget illimité → persistance absolue (pas d'abandon)."""
    from jarvis import _iteration_block
    txt = _iteration_block(target_count=10, budget_label="illimité",
                           unit="annotation utile")
    assert "10 annotation utile" in txt
    assert "BUDGET" in txt and "ILLIMIT" in txt
    assert "ABANDONNE" in txt.upper() or "abandonne" in txt.lower()


def test_iteration_block_unbounded_no_target_falls_back():
    """Ni cible ni budget : pas vide, mais persistance générale."""
    from jarvis import _iteration_block
    txt = _iteration_block(target_count=None, budget_label="illimité",
                           unit="signalement")
    assert txt.strip() != ""
    assert "signalement" in txt.lower()


def test_build_annotation_prompt_uses_iteration_block():
    """Le pré-prompt annotation doit contenir un bloc d'itération non
    vide et pointer vers `pick_random_term` en l'absence de terme.
    (L'ancienne mention « carte blanche / TOUT le lexique » a été
    retirée : elle alimentait le mode collapse — on délègue le tirage
    à l'outil dédié backend-side.)"""
    from jarvis import build_annotation_prompt
    p = build_annotation_prompt(term="", relation=None, top_k=8,
                                target_count=10, budget_label="25")
    assert "pick_random_term" in p
    assert "10" in p
    # Mention de la sélectivité (mieux vaut peu et pertinent)
    assert "selectivit" in p.lower().replace("é", "e") or \
           "n'annote QUE" in p or "petit nombre" in p.lower()


# ─────────────── production_target file-line counter (flow-aware) ───────────────

def test_run_jarvis_flow_accepts_production_target(tmp_path, monkeypatch):
    """Smoke contract : run_jarvis_flow accepte production_target/
    production_counter/production_unit sans planter à l'import-vérif.
    On ne lance pas l'agent — on vérifie juste la signature."""
    import inspect
    from jarvis import run_jarvis_flow
    sig = inspect.signature(run_jarvis_flow)
    assert "production_target" in sig.parameters
    assert "production_counter" in sig.parameters
    assert "production_unit" in sig.parameters


def test_condense_history_with_nudge_uses_flow_counter(tmp_path):
    """Quand target+count_fn sont fournis, condense_history_with_nudge
    doit utiliser le compteur fourni et le nombre observé doit
    apparaître dans le summary — pas le compteur consolidations."""
    from jarvis import condense_history_with_nudge, HISTORY_CONDENSE_THRESHOLD_CHARS
    from langchain_core.messages import HumanMessage
    # Construit un historique au-dessus du seuil
    big_content = "X" * (HISTORY_CONDENSE_THRESHOLD_CHARS + 1000)
    messages = [HumanMessage(content=big_content)]
    # Compteur custom qui renvoie 7
    count_fn = lambda: 7
    result = condense_history_with_nudge(
        messages, target=15, count_fn=count_fn, attempt=1,
    )
    assert result is not None
    # 2 messages : initial + summary+nudge
    assert len(result) == 2
    summary = result[1].content
    # Le résumé doit refléter notre compteur (7) et notre target (15),
    # pas le compteur consolidations (qui aurait été 0 ou autre).
    assert "7" in summary
    assert "15" in summary
