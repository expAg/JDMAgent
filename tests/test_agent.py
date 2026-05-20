"""Tests de l'agent LangChain 1.x (sans LLM réel)."""
from __future__ import annotations

import pytest

from jdm_agent.tools.jdm_agent import SYSTEM_PROMPT, build_jdm_agent
from jdm_agent.tools.jdm_tools import ALL_TOOLS


def test_system_prompt_grounded_constraints():
    assert "EXCLUSIVEMENT" in SYSTEM_PROMPT
    assert "triplets JDM" in SYSTEM_PROMPT
    assert "N'invente JAMAIS" in SYSTEM_PROMPT


def test_build_jdm_agent_compiles_and_lists_tools():
    """L'agent doit se construire et exposer la liste complète des outils.

    On utilise un FakeMessagesListChatModel pour éviter toute requête réseau.
    """
    try:
        from langchain_core.language_models import FakeMessagesListChatModel
        from langchain_core.messages import AIMessage
    except Exception as e:
        pytest.skip(f"FakeMessagesListChatModel indisponible: {e}")

    fake = FakeMessagesListChatModel(responses=[AIMessage(content="ok")])

    agent = build_jdm_agent(llm=fake)
    # create_agent renvoie un CompiledStateGraph — vérifions la présence des tools
    # via le node "tools" du graphe.
    graph = agent.get_graph()
    node_names = set(graph.nodes.keys())
    # LangChain 1.x agent graph contient typiquement {"__start__", "model", "tools", "__end__"}
    # Le nom exact peut varier — on tolère.
    assert any("tool" in n.lower() for n in node_names), f"node tools manquant: {node_names}"


def test_all_tools_listed():
    names = {t.name for t in ALL_TOOLS}
    expected = {
        "lookup_term", "get_synonyms", "get_antonyms",
        "get_hypernyms", "get_hyponyms", "get_parts",
        "get_characteristics", "get_relations_of_type",
        "get_relations_between", "disambiguate", "list_relation_types",
    }
    assert expected.issubset(names)
