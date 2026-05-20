"""Smoke tests du serveur MCP (sans transport réseau).

On vérifie que :
- build_server() ne lève pas
- tous les outils LangChain sont bien enregistrés côté MCP
- un call_tool fonctionne et renvoie le contenu structuré attendu
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
import respx

from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.tools.jdm_tools import ALL_TOOLS, set_default_client


BASE = "https://jdm-api.demo.lirmm.fr"


@pytest.fixture
def mcp_with_mocks(tmp_path):
    """Construit le serveur MCP avec un JDMClient mocké."""
    pytest.importorskip("fastmcp")
    from jdm_agent.mcp.server import build_server

    client = JDMClient(base_url=BASE, cache=DiskJSONCache(cache_dir=tmp_path / "cache"))
    set_default_client(client)
    server = build_server(client=client)
    return server


def test_build_server_registers_all_tools(mcp_with_mocks):
    server = mcp_with_mocks
    tools = asyncio.run(server.list_tools())
    names = {t.name for t in tools}
    expected = {t.name for t in ALL_TOOLS}
    assert expected.issubset(names), f"manquants: {expected - names}"


def test_mcp_call_tool_returns_triplets(mcp_with_mocks):
    """call_tool('get_synonyms') exécute la vraie fonction et renvoie ses résultats."""
    server = mcp_with_mocks

    with respx.mock(base_url=BASE) as mock:
        mock.get("/v0/relations_types").mock(return_value=httpx.Response(200, json=[
            {"id": 5, "name": "r_syn", "help": "synonymes"},
        ]))
        mock.get("/v0/nodes_types").mock(return_value=httpx.Response(200, json=[
            {"id": 1, "name": "n_generic", "help": ""},
        ]))
        mock.get("/v0/relations/from/chat").mock(return_value=httpx.Response(200, json={
            "nodes": [
                {"id": 150, "name": "chat", "type": 1, "w": 7967},
                {"id": 999, "name": "matou", "type": 1, "w": 100},
            ],
            "relations": [{"id": 1, "node1": 150, "node2": 999, "type": 5, "w": 80.0}],
        }))

        result = asyncio.run(server.call_tool(
            "get_synonyms", {"term": "chat", "min_weight": 0, "limit": 5}
        ))

    payload = result.structured_content["result"]
    assert any(t["target"] == "matou" and t["relation"] == "r_syn" for t in payload)
