"""Diagnostic en couches du système JDM Agent.

Teste séquentiellement :
  1. JDMClient brut (HTTP + cache)
  2. Outils LangChain (sans LLM)
  3. Connectivité Ollama (si choisi)
  4. Inférence LLM seule (1 prompt court, pas d'outil)
  5. Agent avec un seul tool call

Affiche le timing de chaque étape pour identifier où ça bloque.
Usage :
    python -m jdm_agent.apps.diagnose
    python -m jdm_agent.apps.diagnose --provider ollama --model llama3.2:3b
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — force stdout UTF-8 (Windows)

import argparse
import os
import sys
import time
import urllib.request
import urllib.error

from jdm_agent.client import JDMClient
from jdm_agent.tools.jdm_tools import set_default_client, get_synonyms


GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


def _step(label: str):
    print(f"\n── {label} ──", flush=True)
    return time.time()


def _ok(t0: float, extra: str = "") -> None:
    dt = time.time() - t0
    print(f"  {GREEN}✓{RESET} {dt:5.2f}s  {extra}", flush=True)


def _fail(t0: float, err: Exception) -> None:
    dt = time.time() - t0
    print(f"  {RED}✗{RESET} {dt:5.2f}s  {type(err).__name__}: {err}", flush=True)


def _warn(msg: str) -> None:
    print(f"  {YELLOW}!{RESET} {msg}", flush=True)


def check_jdm_client() -> bool:
    t = _step("1. JDMClient HTTP")
    try:
        c = JDMClient()
        n = c.node_by_name("chat")
        _ok(t, f"node chat id={n.id} w={n.w}")
        t2 = time.time()
        n2 = c.node_by_name("chat")
        dt = time.time() - t2
        _ok(t2, f"2e appel (cache disque) en {dt*1000:.1f}ms")
        return True
    except Exception as e:
        _fail(t, e)
        return False


def check_tools() -> bool:
    t = _step("2. Outils LangChain (sans LLM)")
    try:
        c = JDMClient()
        set_default_client(c)
        syns = get_synonyms.invoke({"term": "voiture", "min_weight": 50, "limit": 3})
        for s in syns:
            print(f"     · {s['target']} (w={s['w']})")
        _ok(t)
        return True
    except Exception as e:
        _fail(t, e)
        return False


def check_ollama(model: str) -> bool:
    t = _step(f"3. Ollama (modèle {model})")
    url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/tags"
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            import json
            data = json.loads(r.read())
            tags = [m["name"] for m in data.get("models", [])]
        print(f"     · serveur joignable ; modèles installés : {tags or '(aucun)'}")
        if not any(m.startswith(model.split(':')[0]) for m in tags):
            _warn(f"le modèle {model!r} n'est PAS installé. Lancer : ollama pull {model}")
            return False
        _ok(t)
        return True
    except urllib.error.URLError as e:
        _fail(t, e)
        _warn("Ollama ne tourne pas. Démarrer avec : ollama serve")
        return False
    except Exception as e:
        _fail(t, e)
        return False


def check_llm_inference(provider: str, model: str) -> bool:
    t = _step(f"4. Inférence LLM nue ({provider}:{model}) — peut prendre 10-60s")
    try:
        from jdm_agent.tools.llm_factory import get_llm
        from langchain_core.messages import HumanMessage

        llm = get_llm(provider=provider, model=model)
        # Force pas d'outils : juste une réponse texte.
        out = llm.invoke([HumanMessage(content="Réponds en un seul mot : OUI")])
        _ok(t, f"sortie: {(out.content or '').strip()[:80]!r}")
        return True
    except Exception as e:
        _fail(t, e)
        return False


def check_agent_one_round(provider: str, model: str) -> bool:
    t = _step(f"5. Agent complet : 1 question simple ({provider}:{model})")
    try:
        from jdm_agent.tools.jdm_agent import build_jdm_agent, stream

        client = JDMClient()
        set_default_client(client)
        from jdm_agent.tools.llm_factory import get_llm
        llm = get_llm(provider=provider, model=model)
        agent = build_jdm_agent(client=client, llm=llm)

        # Stream pour montrer chaque étape.
        def on_event(ev):
            dt = time.time() - t
            kind = ev["kind"]
            tcs = ev.get("tool_calls") or []
            if kind == "AIMessage" and tcs:
                for tc in tcs:
                    print(f"     [{dt:5.1f}s] → appel {tc['name']}({tc.get('args')})")
            elif kind == "ToolMessage":
                content = (ev.get("content") or "")[:80].replace("\n", " ")
                print(f"     [{dt:5.1f}s] ← outil {ev.get('name')} : {content}…")
            elif kind == "AIMessage":
                preview = (ev.get("content") or "").strip().replace("\n", " ")[:80]
                if preview:
                    print(f"     [{dt:5.1f}s] ← réponse finale ({len(ev['content'])} chars)")

        out = stream(agent, "Donne-moi 2 synonymes de voiture.", on_event=on_event)
        print(f"     réponse : {out['answer'][:200]}…")
        _ok(t)
        return True
    except Exception as e:
        _fail(t, e)
        return False


def main() -> int:
    p = argparse.ArgumentParser(description="Diagnostic en couches JDM Agent.")
    p.add_argument("--provider", default=os.environ.get("LLM_PROVIDER", "ollama"))
    p.add_argument("--model", default=os.environ.get("LLM_MODEL", "llama3.2:3b"))
    p.add_argument("--skip-llm", action="store_true", help="Saute les étapes 3-5.")
    args = p.parse_args()

    print(f"{'='*60}\n  JDM Agent — diagnostic\n  provider={args.provider}, model={args.model}\n{'='*60}")

    if not check_jdm_client():
        return 1
    if not check_tools():
        return 1
    if args.skip_llm:
        print("\n[--skip-llm] : étapes 3-5 sautées.")
        return 0
    if args.provider == "ollama":
        if not check_ollama(args.model):
            return 2
    if not check_llm_inference(args.provider, args.model):
        return 3
    if not check_agent_one_round(args.provider, args.model):
        return 4

    print(f"\n{GREEN}Tout fonctionne.{RESET} Tu peux lancer maintenant :")
    print(f"  python -m jdm_agent.apps.qa_cli --provider {args.provider} --model {args.model} --verbose")
    return 0


if __name__ == "__main__":
    sys.exit(main())
