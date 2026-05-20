"""REPL minimal de Q&A NL → JeuxDeMots.

Usage :
    python -m jdm_agent.apps.qa_cli
    python -m jdm_agent.apps.qa_cli --question "synonymes de voiture"
    python -m jdm_agent.apps.qa_cli --provider ollama --model llama3.1:8b

Variables d'environnement (alternatives aux flags) :
    LLM_PROVIDER, LLM_MODEL, LLM_TEMPERATURE
    ANTHROPIC_API_KEY, OPENAI_API_KEY (selon provider)
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — force stdout UTF-8 (Windows)

import argparse
import os
import sys
from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.tools.jdm_agent import ask, build_jdm_agent, stream
from jdm_agent.tools.llm_factory import get_llm


BANNER = """
╔══════════════════════════════════════════════════════════════╗
║  JDM Q&A — réponses ancrées dans le graphe JeuxDeMots        ║
║  Tape une question (en français) ou 'exit' pour quitter.     ║
║  '/help' pour l'aide, '/tools' pour lister les outils.       ║
╚══════════════════════════════════════════════════════════════╝
"""

HELP = """
Commandes :
  /help            cette aide
  /tools           liste les outils JDM disponibles
  /verbose on|off  active/désactive la trace des appels d'outils
  /clear           efface l'écran
  exit | quit      quitter

Exemples de questions :
  - Qu'est-ce qu'un chat ?
  - Donne-moi des synonymes de voiture.
  - Quel est le rapport entre chat et internet ?
  - Le mot "avocat" a-t-il plusieurs sens ?
  - Quelle est la couleur du sang d'après JDM ?
"""


def _print_tool_calls(tool_calls: list[dict]) -> None:
    if not tool_calls:
        return
    print("\n[outils appelés]")
    for tc in tool_calls:
        args = tc.get("args") or {}
        args_str = ", ".join(f"{k}={v!r}" for k, v in args.items())
        print(f"  • {tc['name']}({args_str})")


def _stream_printer(verbose: bool):
    """Imprime un événement par étape de l'agent — montre que ça avance."""
    import time
    t0 = [time.time()]

    def on_event(ev: dict) -> None:
        dt = time.time() - t0[0]
        kind = ev["kind"]
        if kind == "AIMessage":
            tcs = ev.get("tool_calls") or []
            if tcs:
                for tc in tcs:
                    args = ", ".join(f"{k}={v!r}" for k, v in (tc.get("args") or {}).items())
                    print(f"  ⏱ {dt:5.1f}s  →  appel {tc['name']}({args})", flush=True)
            else:
                # Réponse finale du modèle.
                preview = (ev.get("content") or "").strip().replace("\n", " ")[:80]
                if preview:
                    print(f"  ⏱ {dt:5.1f}s  ←  réponse du modèle ({len(ev['content'])} chars)", flush=True)
        elif kind == "ToolMessage":
            content = ev.get("content") or ""
            preview = content[:100].replace("\n", " ")
            print(f"  ⏱ {dt:5.1f}s  ←  outil {ev.get('name')} renvoie {len(content)} chars : {preview}…", flush=True)
        t0[0] = time.time()

    return on_event if verbose else None


def run_repl(provider: Optional[str], model: Optional[str], verbose: bool) -> int:
    print(BANNER)
    print(f"Provider : {provider or os.environ.get('LLM_PROVIDER', 'anthropic')}")
    print(f"Modèle   : {model or os.environ.get('LLM_MODEL', 'claude-sonnet-4-5')}")
    print("Chargement du client JDM et du modèle…")

    client = JDMClient()
    try:
        llm = get_llm(provider=provider, model=model)
        agent = build_jdm_agent(client=client, llm=llm)
    except Exception as e:
        print(f"\n[erreur] impossible d'initialiser le modèle: {e}", file=sys.stderr)
        return 2

    print("Prêt.\n")
    show_tools = verbose
    while True:
        try:
            q = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not q:
            continue
        if q.lower() in {"exit", "quit"}:
            break
        if q == "/help":
            print(HELP)
            continue
        if q == "/clear":
            os.system("cls" if os.name == "nt" else "clear")
            continue
        if q.startswith("/verbose"):
            show_tools = "on" in q
            print(f"verbose = {show_tools}")
            continue
        if q == "/tools":
            from jdm_agent.tools.jdm_tools import ALL_TOOLS
            for t in ALL_TOOLS:
                print(f"  - {t.name}: {t.description.splitlines()[0]}")
            continue

        try:
            print("(réflexion en cours…)", flush=True)
            on_event = _stream_printer(show_tools)
            out = stream(agent, q, on_event=on_event)
        except Exception as e:
            print(f"[erreur] {e}", file=sys.stderr)
            continue

        print()
        print(out["answer"])
        print()

    client.close()
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="REPL Q&A JeuxDeMots (LangChain agent).")
    p.add_argument("--provider", default=None, help="LLM provider (anthropic, openai, ollama, ...)")
    p.add_argument("--model", default=None, help="Nom du modèle (claude-sonnet-4-5, gpt-4o, llama3.1:8b, ...)")
    p.add_argument("--question", "-q", default=None, help="Pose une seule question puis quitte.")
    p.add_argument("--verbose", action="store_true", help="Affiche les appels d'outils.")
    args = p.parse_args()

    if args.question:
        client = JDMClient()
        llm = get_llm(provider=args.provider, model=args.model)
        agent = build_jdm_agent(client=client, llm=llm)
        if args.verbose:
            print("(réflexion en cours…)", flush=True)
            out = stream(agent, args.question, on_event=_stream_printer(True))
        else:
            out = ask(agent, args.question)
        print()
        print(out["answer"])
        client.close()
        return 0

    return run_repl(args.provider, args.model, args.verbose)


if __name__ == "__main__":
    sys.exit(main())
