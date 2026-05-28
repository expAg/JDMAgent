"""Framework-agnostic chat streaming for the JDM agent.

Yields plain dicts (event + data) so any HTTP layer (FastAPI SSE,
WebSocket, …) can adapt without coupling to Gradio.

Event types yielded by `chat_stream`:
    {"type": "thought",    "text": str}     # chain-of-thought (Gemini / Claude Extended)
    {"type": "spoken",     "text": str}     # text the LLM speaks between tool calls
    {"type": "tool_call",  "name": str, "args": dict, "narration": str}
    {"type": "tool_result","name": str, "preview": str, "narration": str}
    {"type": "final",      "text": str}     # the agent's final answer
    {"type": "error",      "text": str}

This module deliberately stays minimal: pool/key rotation and rate-limit
retries are NOT replicated here yet (they live in `app.py` for now and
will be ported in the FastAPI migration step 3 when the pool endpoints
move out of Gradio).
"""
from __future__ import annotations

from typing import Any, Iterator, Optional

from jdm_agent.client import JDMClient


def _history_to_lc(history: list[dict], current_user_message: str) -> list:
    """Same logic as app.py:_history_to_lc — convert {role, content}
    history into LangChain messages, dropping previous error bubbles."""
    from langchain_core.messages import AIMessage, HumanMessage

    lc: list = []
    for h in history or []:
        role = h.get("role")
        content = (h.get("content") or "").strip()
        if not content or content.startswith("⚠️") or content.startswith("❌"):
            continue
        if role == "user":
            lc.append(HumanMessage(content=content))
        elif role == "assistant":
            lc.append(AIMessage(content=content))
    lc.append(HumanMessage(content=current_user_message))
    return lc


def chat_stream(
    *,
    message: str,
    history: list[dict],
    llm: Any,
    client: Optional[JDMClient] = None,
) -> Iterator[dict]:
    """Stream agent events for a single user turn.

    Args:
        message: user input.
        history: prior turns, format ``[{"role": "user"|"assistant", "content": str}]``.
        llm: a langchain chat model instance (already built — caller handles
             provider selection, API keys, thinking mode).
        client: a JDMClient instance (defaults to a fresh one).

    Yields dicts with ``type`` key — see module docstring.
    """
    if not message or not message.strip():
        yield {"type": "error", "text": "Message vide."}
        return

    from langchain_core.messages import AIMessage, ToolMessage

    # Reuse narration helpers + exclusion_context from jarvis (no Gradio dep).
    from jarvis import (
        _content_to_text, _content_to_thoughts,
        _narrate_tool_call, _narrate_tool_result,
    )
    from jdm_agent.enrich.validators import exclusion_context
    from jdm_agent.tools.jdm_agent import build_jdm_agent

    c = client or JDMClient()
    agent = build_jdm_agent(client=c, llm=llm)
    accumulated_messages = _history_to_lc(history, message)
    final_answer: str = ""

    with exclusion_context():
        try:
            for chunk in agent.stream(
                {"messages": accumulated_messages},
                stream_mode="updates",
            ):
                for _node_name, payload in chunk.items():
                    msgs = (payload or {}).get("messages") or []
                    for m in msgs:
                        accumulated_messages.append(m)
                        if isinstance(m, AIMessage):
                            tcs = getattr(m, "tool_calls", []) or []
                            thoughts = _content_to_thoughts(m.content)
                            if thoughts.strip():
                                yield {"type": "thought", "text": thoughts.strip()}
                            spoken = _content_to_text(m.content)
                            if tcs and spoken.strip():
                                yield {"type": "spoken", "text": spoken.strip()}
                            if tcs:
                                for tc in tcs:
                                    name = tc.get("name", "?")
                                    args = tc.get("args") or {}
                                    yield {
                                        "type": "tool_call",
                                        "name": name,
                                        "args": args,
                                        "narration": _narrate_tool_call(name, args) or "",
                                    }
                            else:
                                # AIMessage sans tool_calls → réponse finale
                                final_answer = spoken
                        elif isinstance(m, ToolMessage):
                            content = _content_to_text(m.content)
                            preview = content[:140].replace("\n", " ")
                            if len(content) > 140:
                                preview += "…"
                            yield {
                                "type": "tool_result",
                                "name": m.name,
                                "preview": preview,
                                "narration": _narrate_tool_result(m.name, content) or "",
                            }
        except Exception as e:
            yield {"type": "error", "text": f"{type(e).__name__}: {e}"}
            return

    yield {"type": "final", "text": final_answer or ""}
