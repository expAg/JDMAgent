"""CLI : REPL de discussion avec l'ORCHESTRATEUR Jarvis (la mascotte).

Deux modes :
  - CLIENT (défaut) : appelle `POST /api/jarvis/chat` du serveur FastAPI (SSE).
    L'orchestrateur a alors accès à la supervision live, peut lancer/arrêter
    des agents, etc. Recommandé.
  - --local : instancie l'agent en process (offline). Outils de supervision
    limités (pas de runs live serveur), mais utile pour tester hors-ligne.

Exemples :
    python -m jdm_agent.apps.jarvis_chat
    python -m jdm_agent.apps.jarvis_chat --url http://127.0.0.1:7860
    python -m jdm_agent.apps.jarvis_chat --local
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — stdout UTF-8 (Windows)

import argparse
import json
import os
import sys

DEFAULT_URL = os.environ.get("JDM_SERVER_URL", "http://127.0.0.1:7860").rstrip("/")
_PROMPT = "\n\033[1mtoi ›\033[0m "
_BOT = "\033[36mJarvis ›\033[0m "


def _repl_client(url: str) -> int:
    import httpx
    history: list[dict] = []
    print(f"Jarvis (orchestrateur) — client {url}. Ctrl-C pour quitter.\n")
    while True:
        try:
            msg = input(_PROMPT).strip()
        except (EOFError, KeyboardInterrupt):
            print(); return 0
        if not msg:
            continue
        if msg in ("/quit", "/exit"):
            return 0
        sys.stdout.write(_BOT); sys.stdout.flush()
        acc = ""
        try:
            with httpx.stream("POST", f"{url}/api/jarvis/chat", timeout=None,
                              json={"message": msg, "history": history, "config": {}}) as r:
                if r.status_code != 200:
                    print(f"✗ HTTP {r.status_code}"); continue
                event = None
                for line in r.iter_lines():
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:"):
                        try:
                            data = json.loads(line[5:].strip())
                        except Exception:
                            continue
                        if event in ("text", "token", "message", None):
                            # Le endpoint envoie le texte CUMULATIF — on n'écrit
                            # que le delta pour un rendu progressif propre.
                            full = data.get("text") or data.get("token") or ""
                            if full and full != acc:
                                sys.stdout.write(full[len(acc):] if full.startswith(acc) else full)
                                sys.stdout.flush()
                                acc = full
                        elif event == "viz":
                            sys.stdout.write(f"\n  [graphe : {data.get('term', '')}]")
                            sys.stdout.flush()
                        elif event == "error":
                            sys.stdout.write(f"\n✗ {data.get('text', 'erreur')}")
        except httpx.HTTPError as e:
            print(f"✗ Serveur injoignable ({e}). Lance le serveur ou utilise --local.")
            continue
        print()
        history.append({"role": "user", "content": msg})
        history.append({"role": "assistant", "content": acc})


def _repl_local() -> int:
    from langchain_core.messages import AIMessage, HumanMessage
    from jdm_agent.jarvis_chat.agent import build_jarvis_chat_agent
    agent = build_jarvis_chat_agent()
    lc: list = []
    print("Jarvis (orchestrateur) — LOCAL (offline). Ctrl-C pour quitter.\n")
    while True:
        try:
            msg = input(_PROMPT).strip()
        except (EOFError, KeyboardInterrupt):
            print(); return 0
        if not msg:
            continue
        if msg in ("/quit", "/exit"):
            return 0
        lc.append(HumanMessage(content=msg))
        try:
            out = agent.invoke({"messages": lc})
            reply = out["messages"][-1].content if out.get("messages") else ""
        except Exception as e:
            reply = f"✗ {type(e).__name__}: {e}"
        print(_BOT + (reply or ""))
        lc.append(AIMessage(content=reply or ""))


def main() -> int:
    p = argparse.ArgumentParser(description="REPL avec l'orchestrateur Jarvis.")
    p.add_argument("--url", default=DEFAULT_URL, help=f"URL serveur (défaut {DEFAULT_URL}).")
    p.add_argument("--local", action="store_true", help="En process (offline) au lieu du serveur.")
    a = p.parse_args()
    return _repl_local() if a.local else _repl_client(a.url)


if __name__ == "__main__":
    raise SystemExit(main())
