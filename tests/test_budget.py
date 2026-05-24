"""Tests pour le module budget.py (Phase 13)."""
from __future__ import annotations

import pytest

from jdm_agent.tools.budget import (
    ToolBudget,
    apply_budget_wrapping,
    budget_context,
    get_current_budget,
    is_budgeted,
)


# ---------- ToolBudget pur ----------

def test_budget_unlimited_when_limit_none():
    b = ToolBudget(limit=None)
    for _ in range(1000):
        assert b.check_and_increment() is True
    assert b.exhausted is False
    assert b.count == 1000


def test_budget_respects_limit():
    b = ToolBudget(limit=3)
    assert b.check_and_increment() is True   # 1
    assert b.check_and_increment() is True   # 2
    assert b.check_and_increment() is True   # 3
    assert b.check_and_increment() is False  # 4 — dépassé
    assert b.exhausted is True
    assert b.check_and_increment() is False  # ne ré-incrémente plus à True
    assert b.exhausted is True


def test_budget_zero_or_negative_treated_as_unlimited():
    # Via le contextmanager, qui normalise.
    with budget_context(limit=0) as b:
        for _ in range(10):
            assert b.check_and_increment() is True
        assert b.exhausted is False
    with budget_context(limit=-5) as b:
        for _ in range(10):
            assert b.check_and_increment() is True
        assert b.exhausted is False


# ---------- ContextVar ----------

def test_no_context_returns_none():
    # En dehors de tout `with budget_context(...)`, get_current_budget() est None.
    assert get_current_budget() is None


def test_context_isolates_invocations():
    with budget_context(limit=5) as outer:
        assert get_current_budget() is outer
        with budget_context(limit=2) as inner:
            assert get_current_budget() is inner
            inner.check_and_increment()
            inner.check_and_increment()
            assert inner.count == 2
        # Sortie du contexte interne → on retombe sur le parent
        assert get_current_budget() is outer
        assert outer.count == 0
    assert get_current_budget() is None


# ---------- is_budgeted (exclusions) ----------

def test_is_budgeted_excludes_workflow_tools():
    assert is_budgeted("enrichment_workflow") is False
    assert is_budgeted("audit_workflow") is False
    assert is_budgeted("gap_detection_workflow") is False
    assert is_budgeted("signalement_workflow") is False
    assert is_budgeted("stats_workflow") is False


def test_is_budgeted_includes_regular_tools():
    assert is_budgeted("lookup_term") is True
    assert is_budgeted("get_synonyms") is True
    assert is_budgeted("validate_candidate") is True
    assert is_budgeted("write_submission_file") is True


# ---------- apply_budget_wrapping ----------

class _FakeTool:
    """Minimal stub mimant StructuredTool : a .name et .func."""
    def __init__(self, name, func):
        self.name = name
        self.func = func


def test_wrapping_passes_through_without_context():
    calls = []
    def real_func(x):
        calls.append(x)
        return f"OK:{x}"
    t = _FakeTool("lookup_term", real_func)
    apply_budget_wrapping([t])
    # Sans contexte budget → exécution libre
    assert t.func("a") == "OK:a"
    assert t.func("b") == "OK:b"
    assert calls == ["a", "b"]


def test_wrapping_returns_sentinel_when_budget_exhausted():
    def real_func(x):
        return f"OK:{x}"
    t = _FakeTool("lookup_term", real_func)
    apply_budget_wrapping([t])
    with budget_context(limit=2) as b:
        assert t.func(1) == "OK:1"
        assert t.func(2) == "OK:2"
        # 3e appel dépasse la limite → sentinel
        result = t.func(3)
        assert isinstance(result, dict)
        assert result.get("BUDGET_EXHAUSTED") is True
        assert "limit" in result
        assert result["limit"] == 2
        assert "message" in result
        assert b.exhausted is True
        # Tout appel ultérieur reste sentinel
        assert t.func(4).get("BUDGET_EXHAUSTED") is True


def test_wrapping_skips_workflow_tools():
    """Les workflow tools ne consomment PAS de budget."""
    def workflow_func():
        return {"title": "Flow"}
    def regular_func():
        return "result"
    wf = _FakeTool("audit_workflow", workflow_func)
    rg = _FakeTool("lookup_term", regular_func)
    apply_budget_wrapping([wf, rg])
    with budget_context(limit=1) as b:
        # workflow tool : appelé 5 fois sans consommer
        for _ in range(5):
            assert wf.func() == {"title": "Flow"}
        assert b.count == 0
        # tool régulier : 1er appel OK, 2e sentinel
        assert rg.func() == "result"
        assert rg.func().get("BUDGET_EXHAUSTED") is True


def test_wrapping_is_idempotent():
    """Double wrapping ne double pas le compteur."""
    def real_func():
        return "ok"
    t = _FakeTool("lookup_term", real_func)
    apply_budget_wrapping([t])
    apply_budget_wrapping([t])  # 2e appel idempotent
    with budget_context(limit=2) as b:
        t.func()
        t.func()
        # Si double-wrapping bug, le compteur serait à 4 ici
        assert b.count == 2
        assert t.func().get("BUDGET_EXHAUSTED") is True
