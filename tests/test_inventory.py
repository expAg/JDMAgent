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


def test_workflow_tools_always_excluded_for_custom(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    # Même un agent qui ÉCRIT (writes=True) n'a JAMAIS les recettes *_workflow.
    spec = inv.save_agent_spec({
        "title": "Endo", "template": "generation_endogene",
        "system_prompt": "S",
    })
    assert spec["writes"] is True
    excl = inv.exclude_tools_for_spec(spec)
    for wf in ("enrichment_workflow", "audit_workflow", "gap_detection_workflow",
               "error_detection_workflow", "stats_workflow", "annotation_workflow"):
        assert wf in excl


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


def test_allowed_tools_restricts_catalog(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    names = inv.all_tool_names()
    assert names, "catalogue d'outils non vide attendu"
    pick = "exists" if "exists" in names else sorted(names)[0]
    spec = inv.save_agent_spec({
        "title": "Ciblé", "template": "libre", "writes": False,
        "allowed_tools": [pick],
    })
    assert spec["allowed_tools"] == [pick]
    excl = inv.exclude_tools_for_spec(spec)
    # Tout le catalogue SAUF `pick` est exclu ; les *_workflow aussi.
    assert pick not in excl
    assert (names - {pick}).issubset(excl)
    for wf in inv.WORKFLOW_TOOLS:
        assert wf in excl
    # Allow-list vide → comportement par défaut (rien retiré au-delà des workflows).
    spec2 = inv.save_agent_spec({"title": "Large", "template": "libre", "writes": True})
    excl2 = inv.exclude_tools_for_spec(spec2)
    assert excl2 == set(inv.WORKFLOW_TOOLS)


def test_parse_generation_output(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    txt = ("TITRE : X\nÉTAPES :\n1. action détaillée a\n2. action détaillée b\n"
           "RÈGLES :\n- r\n"
           "OUTILS: exists, get_relations_of_type, verify_claim\n"
           "RÉSUMÉ:\n1. Analyse — repère le domaine\n2. Production — écrit les triplets\n"
           "DESCRIPTION: Fait ceci.\nÉtapes clés.\nSort un .x")
    wf, brief, tools, steps = inv.parse_generation_output(txt)
    # Le workflow FONCTIONNEL conserve ses étapes détaillées, sans les sections
    # d'affichage.
    assert "TITRE : X" in wf and "RÈGLES" in wf
    assert "action détaillée a" in wf
    assert "DESCRIPTION" not in wf and "OUTILS" not in wf and "RÉSUMÉ" not in wf
    assert brief.startswith("Fait ceci.")
    assert tools == ["exists", "get_relations_of_type", "verify_claim"]
    assert [s["n"] for s in steps] == ["Analyse", "Production"]
    assert steps[0]["d"].startswith("repère")
    # Compat wrapper.
    wf2, brief2 = inv.split_workflow_and_brief(txt)
    assert wf2 == wf and brief2 == brief
    # Sans sections → workflow brut, reste vide.
    wf3, brief3, tools3, steps3 = inv.parse_generation_output("TITRE : Y\nÉTAPES :\n1. z")
    assert "TITRE : Y" in wf3 and brief3 == "" and tools3 == [] and steps3 == []


def test_workflow_generation_prompt(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    spec = {"title": "Cuistot", "template": "generation_endogene",
            "instructions": "INSTRUCTION_UNIQUE_ABC",
            "allowed_tools": ["exists", "get_relations"], "writes": True}
    meta = inv.build_workflow_generation_prompt(spec)
    assert "INSTRUCTION_UNIQUE_ABC" in meta      # les instructions de l'user
    assert "*_workflow" in meta                  # « à la manière des *_workflow »
    assert "exists" in meta and "get_relations" in meta  # outils dispo cités
    assert "TITRE" in meta and "ÉTAPES" in meta and "RÈGLES" in meta
    assert "DESCRIPTION" in meta             # résumé carte généré par le LLM
    assert "OUTILS" in meta                  # le LLM choisit les outils nécessaires
    assert "RÉSUMÉ" in meta                  # résumé d'étapes (affichage), EN PLUS
    assert "FONCTIONNEL" in meta             # le workflow reste le cœur fonctionnel


def test_instructions_persisted(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    saved = inv.save_agent_spec({
        "title": "I", "template": "libre",
        "system_prompt": "WORKFLOW_GENERE", "instructions": "INSTR_BRUTE"})
    assert saved["instructions"] == "INSTR_BRUTE"
    assert saved["system_prompt"] == "WORKFLOW_GENERE"


def test_runtime_tools_restricted_to_workflow(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    names = inv.all_tool_names()
    assert {"exists", "verify_claim"}.issubset(names)
    # Agent SANS allow-list mais dont le workflow CITE des outils → l'agent ne
    # doit avoir QUE ces outils (pas tout le catalogue).
    spec = inv.save_agent_spec({
        "title": "Cite", "template": "libre", "writes": False,
        "system_prompt": "TITRE: X\nÉTAPES:\n1. appelle exists(terme)\n2. verify_claim(...)",
    })
    excl = inv.exclude_tools_for_spec(spec)
    remaining = names - excl
    assert remaining == {"exists", "verify_claim"}
    # Allow-list = TOUT le catalogue → ignorée (pas une vraie restriction) →
    # on retombe sur les outils cités par le workflow.
    spec2 = inv.save_agent_spec({
        "title": "AllSelected", "template": "libre", "writes": False,
        "allowed_tools": sorted(inv.selectable_tool_names()),
        "system_prompt": "1. exists(x)",
    })
    rem2 = names - inv.exclude_tools_for_spec(spec2)
    assert rem2 == {"exists"}


def test_edit_preserves_id_on_rename(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    saved = inv.save_agent_spec({"title": "Cuisinier", "template": "libre",
                                 "system_prompt": "S"})
    aid = saved["id"]
    assert aid == "cuisinier"
    # Édition : on renomme MAIS on passe l'id existant → identité préservée,
    # pas de doublon créé.
    edited = inv.save_agent_spec({"id": aid, "title": "Chef Cuisinier",
                                  "template": "libre", "system_prompt": "S2"})
    assert edited["id"] == aid
    assert edited["title"] == "Chef Cuisinier"
    customs = [s for s in inv.list_agent_specs() if not s["builtin"]]
    assert len(customs) == 1
    assert inv.get_agent_spec(aid)["system_prompt"] == "S2"


def test_preprompt_upload_gated(tmp_path, monkeypatch):
    inv = _fresh_inventory(tmp_path, monkeypatch)
    spec = inv.save_agent_spec({"title": "W", "template": "audit",
                                "system_prompt": "S"})  # writes=True
    # Sans upload → écrit le fichier mais NE soumet PAS.
    pre_no = inv.build_preprompt_for_spec(spec, {"term": "chat", "upload": False})
    assert "SANS upload" in pre_no
    # Avec upload → soumet.
    pre_yes = inv.build_preprompt_for_spec(spec, {"term": "chat", "upload": True})
    assert "upload=True" in pre_yes


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
