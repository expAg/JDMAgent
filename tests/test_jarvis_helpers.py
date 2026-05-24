"""Tests pour les builders de pré-prompts Jarvis (Phase 13).

Vérifie que :
- les phrases relatives au budget n'apparaissent QUE si le budget est borné
- le terme et la relation sont bien injectés
- la mention de l'upload est conditionnelle
- chaque builder mentionne explicitement le workflow tool qu'il déclenche
"""
from __future__ import annotations

import pytest

from jarvis import (
    BUDGET_LABEL_TO_LIMIT,
    _is_bounded_budget,
    build_audit_prompt,
    build_enrich_prompt,
    build_gap_prompt,
    build_signalement_prompt,
    build_stats_prompt,
)


# ---------- _is_bounded_budget ----------

@pytest.mark.parametrize("label,expected", [
    ("25", True),
    ("100", True),
    ("1", True),
    ("illimité", False),
    ("illimite", False),
    ("unlimited", False),
    ("0", False),
    ("", False),
    ("none", False),
    ("abc", False),
])
def test_bounded_budget(label, expected):
    assert _is_bounded_budget(label) is expected


def test_budget_label_to_limit_dropdown_values():
    """Tous les choix du dropdown UI doivent être mappés (et 'illimité' → None)."""
    assert BUDGET_LABEL_TO_LIMIT["10"] == 10
    assert BUDGET_LABEL_TO_LIMIT["25"] == 25
    assert BUDGET_LABEL_TO_LIMIT["50"] == 50
    assert BUDGET_LABEL_TO_LIMIT["100"] == 100
    assert BUDGET_LABEL_TO_LIMIT["illimité"] is None


# ---------- build_enrich_prompt ----------

def test_enrich_mentions_term_and_workflow():
    p = build_enrich_prompt("guitare")
    assert "guitare" in p
    assert "enrichment_workflow" in p
    assert "ENRICHIR" in p


def test_enrich_bounded_budget_mentions_sentinel():
    p = build_enrich_prompt("chat", budget_label="25")
    assert "25" in p
    assert "BUDGET_EXHAUSTED" in p
    assert "Budget" in p


def test_enrich_unlimited_skips_budget_mentions():
    """En illimité, AUCUNE mention de budget ni sentinel."""
    p = build_enrich_prompt("chat", budget_label="illimité", iterate=True)
    assert "BUDGET_EXHAUSTED" not in p
    assert "Budget" not in p
    # iterate doit toujours s'afficher mais sans la clause "sauf si épuisé"
    assert "Itère" in p
    assert "épuisé" not in p


def test_enrich_upload_appears_only_if_true():
    p_off = build_enrich_prompt("x", upload=False)
    p_on = build_enrich_prompt("x", upload=True)
    assert "SANS upload" in p_off
    assert "upload=True" in p_on
    assert "LLMDrops" in p_on


def test_enrich_vary_appears_only_if_true():
    p_off = build_enrich_prompt("x", vary_relations=False)
    p_on = build_enrich_prompt("x", vary_relations=True)
    assert "Varie" not in p_off
    assert "Varie" in p_on


def test_enrich_relation_optional():
    p_no = build_enrich_prompt("x", relation="")
    p_yes = build_enrich_prompt("x", relation="r_isa")
    assert "Relation cible" not in p_no
    assert "r_isa" in p_yes


# ---------- build_audit_prompt ----------

def test_audit_mentions_workflow():
    p = build_audit_prompt("avocat")
    assert "AUDITER" in p
    assert "avocat" in p
    assert "audit_workflow" in p


def test_audit_unlimited_no_budget():
    p = build_audit_prompt("avocat", budget_label="illimité")
    assert "Budget" not in p


def test_audit_relation_optional():
    p_no = build_audit_prompt("x", relation="")
    p_yes = build_audit_prompt("x", relation="r_isa")
    assert "Restreins" not in p_no
    assert "r_isa" in p_yes


# ---------- build_gap_prompt ----------

def test_gap_mentions_workflow_and_routing():
    p = build_gap_prompt("smartphone")
    assert "smartphone" in p
    assert "gap_detection_workflow" in p
    assert "Enrichir" in p
    assert "Auditer" in p
    assert "Stats" in p


def test_gap_unlimited_no_budget():
    p = build_gap_prompt("smartphone", budget_label="illimité")
    assert "Budget" not in p


def test_gap_relations_list_injected():
    p_no = build_gap_prompt("x")
    p_yes = build_gap_prompt("x", relations=["r_isa", "r_has_part"])
    assert "r_isa" in p_yes and "r_has_part" in p_yes
    assert "Relations cibles" in p_yes
    assert "défaut" in p_no


# ---------- build_signalement_prompt ----------

def test_signalement_mentions_workflow_and_judgment():
    p = build_signalement_prompt("baleine")
    assert "baleine" in p
    assert "signalement_workflow" in p
    assert "JUGEMENT" in p


def test_signalement_unlimited_still_caps_suspects():
    """Même en illimité, on garde la limite à ~20 suspects."""
    p = build_signalement_prompt("x", budget_label="illimité")
    assert "Budget" not in p
    assert "20 suspects" in p


# ---------- build_stats_prompt ----------

def test_stats_per_term_mode():
    p = build_stats_prompt(term="chat")
    assert "PAR_TERME" in p
    assert "chat" in p
    assert "stats_workflow" in p


def test_stats_per_relation_mode():
    p = build_stats_prompt(relation="r_isa")
    assert "PAR_RELATION" in p
    assert "r_isa" in p


def test_stats_both_modes():
    p = build_stats_prompt(term="chat", relation="r_isa")
    assert "deux modes" in p or "PAR_TERME" in p


def test_stats_no_args_fallback():
    """Si rien n'est fourni, l'agent doit tirer un terme au hasard."""
    p = build_stats_prompt()
    assert "hasard" in p or "au hasard" in p


def test_stats_unlimited_no_budget():
    p = build_stats_prompt(term="x", budget_label="illimité")
    assert "Budget" not in p
