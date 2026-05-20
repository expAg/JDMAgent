"""Agent LangChain qui répond UNIQUEMENT à partir du graphe JeuxDeMots.

Utilise l'API LangChain 1.x : `langchain.agents.create_agent` (basé sur LangGraph).
Renvoie un graphe compilé exposant `.invoke({"messages": [...]})`.

Prompt système strict : toute affirmation doit être justifiée par un triplet
JDM réellement remonté par un outil. Si l'agent n'a pas l'information, il
doit le dire — pas d'invention.
"""
from __future__ import annotations

from typing import Any, Optional

from langchain.agents import create_agent
from langchain_core.messages import HumanMessage

from jdm_agent.client import JDMClient
from jdm_agent.tools.jdm_tools import build_jdm_tools
from jdm_agent.tools.llm_factory import get_llm


SYSTEM_PROMPT = """Tu es un assistant qui répond aux questions de l'utilisateur en t'appuyant \
EXCLUSIVEMENT sur la base de connaissance JeuxDeMots (JDM), un graphe lexico-sémantique \
du français.

RÈGLES STRICTES :
1. Pour toute affirmation factuelle, tu DOIS d'abord la vérifier via un outil JDM.
2. Tu DOIS citer les triplets JDM qui justifient ta réponse au format :
   `source | r_xxx | target (w=...)`. Tous les `source` et `target` que tu reçois
   des outils sont DÉJÀ DÉCODÉS en français lisible — cite-les tels quels.
3. Si JDM ne contient pas l'information, dis explicitement : "JDM ne contient pas
   cette information." N'invente JAMAIS.
4. Les poids (`w`) reflètent la pertinence selon JDM ; privilégie les triplets
   de poids élevé.
5. Pour les termes polysémiques (avocat, souris, police, chat, …), commence
   TOUJOURS par `disambiguate`. Le résultat contient `sense` (forme lisible)
   et `sense_id` (identifiant brut à passer dans les outils suivants pour
   requêter ce sens précis).
6. Quand un triplet renvoyé contient `source_id` ou `target_id`, c'est qu'il
   désigne un sens raffiné. Cite la forme lisible (`source`/`target`), mais
   garde l'`*_id` si tu dois rappeler un outil sur ce sens spécifique.
7. Si tu ne connais pas le nom technique d'une relation, utilise
   `list_relation_types(prefix=...)`.
8. Réponds en français concis : réponse synthétique d'abord, puis section
   "Sources JDM :" listant les triplets.
"""


def build_jdm_agent(
    client: Optional[JDMClient] = None,
    llm: Optional[Any] = None,
    enrich_docstrings: bool = True,
    debug: bool = False,
):
    """Construit un agent LangChain (LangGraph compilé) pour JDM.

    Args:
        client: JDMClient (un client par défaut sera créé si None).
        llm: instance LangChain ChatModel ou string "provider:model".
             Si None, `get_llm()` lit l'env (LLM_PROVIDER, LLM_MODEL).
        enrich_docstrings: ajoute les descriptions de relations aux docstrings.
        debug: trace verbose des appels.

    Returns:
        CompiledStateGraph — appeler `.invoke({"messages": [HumanMessage("...")]})`.
    """
    tools = build_jdm_tools(client=client, enrich_docstrings=enrich_docstrings)
    if llm is None:
        llm = get_llm()
    return create_agent(model=llm, tools=tools, system_prompt=SYSTEM_PROMPT, debug=debug)


def ask(agent, question: str) -> dict:
    """Helper pour interroger l'agent et récupérer la réponse + les étapes.

    Renvoie {"answer": str, "messages": [...], "tool_calls": [...]}.
    """
    result = agent.invoke({"messages": [HumanMessage(content=question)]})
    msgs = result.get("messages", [])
    answer = msgs[-1].content if msgs else ""
    tool_calls = []
    for m in msgs:
        for tc in getattr(m, "tool_calls", []) or []:
            tool_calls.append({"name": tc.get("name"), "args": tc.get("args")})
    return {"answer": answer, "messages": msgs, "tool_calls": tool_calls}


def stream(agent, question: str, on_event=None):
    """Stream les étapes intermédiaires de l'agent (LangGraph events).

    Émet un événement par message produit (AIMessage / ToolMessage).
    Si `on_event` est fourni, il est appelé pour chaque message avec
    un dict {kind, name, content, tool_calls}.

    Renvoie le dict final {"answer", "messages", "tool_calls"}.
    """
    from langchain_core.messages import AIMessage, ToolMessage

    final_msgs = []
    tool_calls_acc: list[dict] = []
    for chunk in agent.stream({"messages": [HumanMessage(content=question)]},
                              stream_mode="updates"):
        # chunk = dict {node_name: {"messages": [msg, ...]}}
        for node_name, payload in chunk.items():
            msgs = (payload or {}).get("messages") or []
            for m in msgs:
                final_msgs.append(m)
                ev = {
                    "kind": type(m).__name__,
                    "node": node_name,
                    "name": getattr(m, "name", None),
                    "content": getattr(m, "content", ""),
                    "tool_calls": getattr(m, "tool_calls", None) or [],
                }
                for tc in ev["tool_calls"]:
                    tool_calls_acc.append({"name": tc.get("name"), "args": tc.get("args")})
                if on_event is not None:
                    on_event(ev)

    answer = ""
    for m in reversed(final_msgs):
        if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None):
            answer = m.content
            break
    return {"answer": answer, "messages": final_msgs, "tool_calls": tool_calls_acc}
