"""Tests pour les 4 nouveaux workflow tools de la Phase 13 :
audit / gap_detection / signalement / stats.

Ces tools renvoient un dict statique (zéro appel HTTP), donc on teste
juste la STRUCTURE du dict (clés présentes, types attendus) pour s'assurer
qu'il sera consommable côté UI Jarvis et compréhensible côté LLM.
"""
from __future__ import annotations

import pytest

from jdm_agent.tools.jdm_tools import (
    audit_workflow,
    gap_detection_workflow,
    error_detection_workflow,
    stats_workflow,
    enrichment_workflow,  # ref pour s'assurer qu'on suit le même pattern
)


# Liste des workflow tools à tester avec le même contrat structurel.
WORKFLOWS = [
    ("audit_workflow", audit_workflow),
    ("gap_detection_workflow", gap_detection_workflow),
    ("error_detection_workflow", error_detection_workflow),
    ("stats_workflow", stats_workflow),
]


@pytest.mark.parametrize("name,wf", WORKFLOWS)
def test_workflow_returns_dict(name, wf):
    """Chaque workflow tool renvoie un dict (zéro appel HTTP)."""
    result = wf.invoke({})
    assert isinstance(result, dict), f"{name} doit renvoyer un dict"


@pytest.mark.parametrize("name,wf", WORKFLOWS)
def test_workflow_has_title(name, wf):
    """Doit exposer un title (utilisé par l'UI dans le bandeau)."""
    result = wf.invoke({})
    assert "title" in result, f"{name} doit avoir un champ 'title'"
    assert isinstance(result["title"], str) and result["title"], \
        f"{name}.title doit être une string non vide"


@pytest.mark.parametrize("name,wf", WORKFLOWS)
def test_workflow_has_steps(name, wf):
    """Doit exposer steps[] avec order, name, description, tool sur chaque."""
    result = wf.invoke({})
    assert "steps" in result, f"{name} doit avoir un champ 'steps'"
    steps = result["steps"]
    assert isinstance(steps, list) and len(steps) >= 2, \
        f"{name}.steps doit être une liste de ≥2 étapes (au moins préparation + exécution)"
    for i, step in enumerate(steps):
        assert isinstance(step, dict), f"{name}.steps[{i}] doit être un dict"
        for key in ("order", "name", "description", "tool"):
            assert key in step, f"{name}.steps[{i}] manque la clé '{key}'"


@pytest.mark.parametrize("name,wf", WORKFLOWS)
def test_workflow_has_rules(name, wf):
    """Doit exposer rules[] (au moins une règle transversale)."""
    result = wf.invoke({})
    assert "rules" in result, f"{name} doit avoir un champ 'rules'"
    assert isinstance(result["rules"], list) and len(result["rules"]) >= 1, \
        f"{name}.rules doit être une liste non vide"
    for i, r in enumerate(result["rules"]):
        assert isinstance(r, str) and r, f"{name}.rules[{i}] doit être une string non vide"


@pytest.mark.parametrize("name,wf", WORKFLOWS)
def test_workflow_steps_ordered(name, wf):
    """Les `order` doivent être croissants à partir de 1."""
    result = wf.invoke({})
    orders = [s["order"] for s in result["steps"]]
    assert orders == sorted(orders), f"{name}.steps doit être trié par 'order'"
    assert orders[0] == 1, f"{name}.steps[0].order doit valoir 1"


def test_audit_workflow_has_meta_section_mention():
    """L'audit produit un fichier .audit en 2 sections — META OBLIGATOIRE."""
    result = audit_workflow.invoke({})
    # Section META mentionnée dans la dernière étape (écriture du fichier)
    last_step = result["steps"][-1]["description"]
    assert "META" in last_step, \
        "audit_workflow doit mentionner === META === dans l'étape d'écriture"


def test_audit_workflow_focuses_on_non_premier_sens():
    """Le nouveau flow audit cible la CONTAMINATION du générique par
    les sens NON-PREMIERS, et NE limite PAS à top 2-3."""
    result = audit_workflow.invoke({})
    full = result["intent"] + " ".join(s["description"] for s in result["steps"])
    # Doit parler de contamination / sens non premier
    assert "NON-PREMIER" in full or "non-premier" in full or "non premier" in full
    assert "contamination" in full.lower() or "CONTAMINATION" in full
    # Ne doit pas imposer un top arbitraire (les anciennes versions disaient top 2-3)
    assert "top 2-3" not in full.lower()
    # Doit aussi inclure le cas du sens premier discutable
    assert "premier" in full.lower() and "discutable" in full.lower()


def test_audit_workflow_handles_no_term():
    """Le nouveau flow audit doit accepter qu'on lui demande sans terme :
    il délègue alors le tirage à `pick_random_term()` (uniform sampling
    backend, anti mode-collapse) au lieu de demander au LLM de tirer."""
    result = audit_workflow.invoke({})
    full = " ".join(s["description"] for s in result["steps"])
    assert "pick_random_term" in full


def test_error_detection_workflow_mentions_judgment():
    """error_detection_workflow doit explicitement dire que le jugement du LLM compte."""
    result = error_detection_workflow.invoke({})
    intent = result.get("intent", "")
    # Au moins une mention du jugement linguistique / sans preuve d'outil
    text = intent + " ".join(result["rules"])
    assert "jugement" in text.lower() or "intuition" in text.lower(), \
        "error_detection_workflow doit explicitement légitimer le jugement LLM"


def test_gap_detection_proposes_three_actions():
    """gap_detection_workflow doit proposer les 3 actions de routage."""
    result = gap_detection_workflow.invoke({})
    # On cherche les 3 verbes d'action quelque part dans les étapes
    full = " ".join(s["description"] for s in result["steps"])
    for action in ("Enrichir", "Auditer", "Stats"):
        assert action in full, \
            f"gap_detection_workflow doit proposer l'action '{action}'"


def test_stats_workflow_has_two_modes():
    """stats_workflow doit avoir un mode PAR_TERME et un mode PAR_RELATION."""
    result = stats_workflow.invoke({})
    full = " ".join(s["description"] for s in result["steps"])
    assert "PAR_TERME" in full and "PAR_RELATION" in full, \
        "stats_workflow doit décrire les deux modes (par terme + par relation)"


def test_all_workflows_exposed_in_ALL_TOOLS():
    """Les 4 nouveaux workflows doivent être enregistrés dans ALL_TOOLS."""
    from jdm_agent.tools.jdm_tools import ALL_TOOLS
    names = {t.name for t in ALL_TOOLS}
    for new_wf in ("audit_workflow", "gap_detection_workflow",
                   "error_detection_workflow", "stats_workflow"):
        assert new_wf in names, f"{new_wf} doit être dans ALL_TOOLS"


def test_workflows_exempt_from_budget():
    """Les workflow tools ne consomment PAS de budget — vérifié via is_budgeted."""
    from jdm_agent.tools.budget import is_budgeted
    for name in ("enrichment_workflow", "audit_workflow",
                 "gap_detection_workflow", "error_detection_workflow",
                 "stats_workflow"):
        assert is_budgeted(name) is False, \
            f"{name} doit être exempté du budget (zero-cost)"
