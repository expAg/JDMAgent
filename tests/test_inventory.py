"""Tests de l'inventaire des agents (built-ins + sur mesure persistés)."""
from __future__ import annotations

import importlib


def _fresh_inventory(tmp_path, monkeypatch):
    inv = importlib.import_module("jdm_agent.jarvis_chat.inventory")
    monkeypatch.setattr(inv, "CUSTOM_AGENTS_PATH", tmp_path / ".jarvis_agents.json")
    return inv


def test_builtins_present_and_capabilities(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    specs = {s["id"]: s for s in inv.list_agent_specs()}
    for aid in ("enrich", "audit", "gap", "signalement", "stats", "annotation"):
        assert aid in specs and specs[aid]["builtin"] is True
    assert specs["enrich"]["consolidates"] is True
    assert specs["audit"]["consolidates"] is False
    assert specs["gap"]["writes"] is False
    assert inv.consolidating_agent_ids() == {"enrich"}


def test_save_get_delete_custom_roundtrip(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    saved = inv.save_agent_spec({
        "title": "Mon Spécialiste",
        "template": "generation_endogene",
        "system_prompt": "Tire un terme, explore ses idées associées, consolide.",
    })
    assert saved["id"] == "mon_specialiste"
    assert saved["builtin"] is False
    assert saved["consolidates"] is True          # hérité du template
    assert saved["output_ext"] == ".enrich"
    assert saved["canonical_mode"] == "auto_append"
    # présent dans get + list + prédicat consolidation
    got = inv.get_agent_spec("mon_specialiste")
    assert got and got["title"] == "Mon Spécialiste"
    assert "mon_specialiste" in inv.consolidating_agent_ids()
    assert any(s["id"] == "mon_specialiste" for s in inv.list_agent_specs())
    # suppression
    assert inv.delete_agent_spec("mon_specialiste") is True
    assert inv.get_agent_spec("mon_specialiste") is None


def test_cannot_overwrite_or_delete_builtin(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    saved = inv.save_agent_spec({"id": "enrich", "title": "Faux enrich"})
    assert saved["id"] != "enrich"               # suffixé _custom
    assert inv.delete_agent_spec("enrich") is False


def test_writes_false_excludes_write_tool_and_no_canonical(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    spec = inv.save_agent_spec({
        "title": "Lecteur", "template": "libre", "writes": False,
    })
    assert spec["writes"] is False
    assert spec["canonical_mode"] is None
    assert "write_submission_file" in inv.exclude_tools_for_spec(spec)


def test_output_ext_free(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    # L'extension est LIBRE désormais : 'cuisine' → '.cuisine'.
    spec = inv.save_agent_spec({
        "title": "X", "template": "audit", "output_ext": "cuisine",
    })
    assert spec["output_ext"] == ".cuisine"
    # Sanitization des caractères dangereux ('../x' → '.x').
    spec2 = inv.save_agent_spec({
        "title": "Y", "template": "audit", "output_ext": "../e x e!",
    })
    assert spec2["output_ext"].startswith(".")
    assert "/" not in spec2["output_ext"] and " " not in spec2["output_ext"]
    # Vide → défaut du template.
    spec3 = inv.save_agent_spec({
        "title": "Z", "template": "audit", "output_ext": "",
    })
    assert spec3["output_ext"] == ".audit"


def test_output_format_normalized(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    spec = inv.save_agent_spec({
        "title": "F", "template": "libre", "output_format": "json",
    })
    assert spec["output_format"] == "json"
    # Format inconnu → 'jdm' par défaut.
    spec2 = inv.save_agent_spec({
        "title": "G", "template": "libre", "output_format": "yaml",
    })
    assert spec2["output_format"] == "jdm"


def test_build_preprompt_includes_strategy_and_random_clause(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    spec = inv.save_agent_spec({
        "title": "Endo", "template": "generation_endogene",
        "system_prompt": "STRATEGIE_UNIQUE_XYZ",
    })
    pre = inv.build_preprompt_for_spec(spec, {"term": "", "target_count": 5})
    assert "STRATEGIE_UNIQUE_XYZ" in pre
    assert "5" in pre  # objectif chiffré
