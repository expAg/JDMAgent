"""CLI : lance un AGENT Jarvis (enrich/audit/gap/signalement/stats/annotation
ou un agent sur mesure de l'inventaire).

Deux modes :
  - CLIENT (défaut) : appelle l'API du serveur FastAPI qui tourne
    (`POST /api/jarvis/<agent>/stream`). Le run s'exécute CÔTÉ SERVEUR et est
    donc SUPERVISÉ dans l'app (cartes, /api/jarvis/runs, stop). Recommandé.
  - --local : exécute le run EN PROCESS (offline, sans serveur). Pratique pour
    le scripting hors-ligne, mais NON supervisé par l'app.

Exemples :
    python -m jdm_agent.apps.jarvis_agent --agent enrich --term chat
    python -m jdm_agent.apps.jarvis_agent --agent audit            # terme au hasard
    python -m jdm_agent.apps.jarvis_agent --agent mon_specialiste  # sur mesure
    python -m jdm_agent.apps.jarvis_agent --agent enrich --local --target 3
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — stdout UTF-8 (Windows)

import argparse
import json
import os
import sys

DEFAULT_URL = os.environ.get("JDM_SERVER_URL", "http://127.0.0.1:7860").rstrip("/")


def _params_from_args(a) -> dict:
    p: dict = {}
    if a.term:
        p["term"] = a.term
    if a.relation:
        p["relation"] = [a.relation]
    if a.target and a.target > 0:
        p["target_count"] = a.target
    if a.model:
        p["model"] = a.model
    p["use_thinking"] = not a.no_thinking
    p["budget_label"] = a.budget
    return p


def _run_client(a) -> int:
    """Mode CLIENT : POST SSE vers le serveur, tail des événements."""
    import httpx
    url = f"{a.url.rstrip('/')}/api/jarvis/{a.agent}/stream"
    body = {"agent_id": a.agent, "params": _params_from_args(a)}
    print(f"→ {a.agent} via {a.url} (supervisé dans l'app)…", flush=True)
    prev_assistant = ""
    try:
        with httpx.stream("POST", url, json=body, timeout=None) as r:
            if r.status_code != 200:
                print(f"✗ HTTP {r.status_code}", file=sys.stderr)
                return 1
            event = None
            for line in r.iter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    raw = line[5:].strip()
                    try:
                        data = json.loads(raw)
                    except Exception:
                        continue
                    if event == "run_id":
                        print(f"  run: {data.get('run_id')}", flush=True)
                    elif event == "headline":
                        print(f"  {data.get('text', '')}", flush=True)
                    elif event == "jarvis":
                        msgs = data.get("messages") or []
                        asst = next((m.get("content", "") for m in reversed(msgs)
                                     if m.get("role") == "assistant"), "")
                        if asst and asst != prev_assistant:
                            sys.stdout.write(asst[len(prev_assistant):])
                            sys.stdout.flush()
                            prev_assistant = asst
                        fp = data.get("file_path")
                        if fp:
                            a._last_file = fp  # type: ignore
                    elif event == "done":
                        fp = getattr(a, "_last_file", None)
                        print(f"\n✓ terminé{(' · fichier : ' + fp) if fp else ''}", flush=True)
                    elif event == "error":
                        print(f"\n✗ {data.get('text', 'erreur')}", file=sys.stderr)
                        return 1
    except httpx.HTTPError as e:
        print(f"✗ Serveur injoignable ({e}). Lance `uvicorn app_fastapi:app "
              f"--port 7860` ou utilise --local.", file=sys.stderr)
        return 1
    return 0


def _run_local(a) -> int:
    """Mode LOCAL : exécute le run en process (non supervisé)."""
    import jarvis as _j
    from jdm_agent.tools.jdm_agent import build_jdm_agent
    from jdm_agent.tools.llm_factory import get_llm
    from jdm_agent.client import JDMClient
    from jdm_agent.jarvis_chat import inventory as _inv

    params = _params_from_args(a)
    spec = _inv.get_agent_spec(a.agent)
    # Pré-prompt : built-in via build_*_prompt, sur mesure via inventory.
    builders = {
        "enrich": _j.build_enrich_prompt, "audit": _j.build_audit_prompt,
        "gap": _j.build_gap_prompt, "signalement": _j.build_signalement_prompt,
        "stats": _j.build_stats_prompt, "annotation": _j.build_annotation_prompt,
    }
    if a.agent in builders:
        import inspect
        b = builders[a.agent]
        kw = {k: v for k, v in params.items() if k in inspect.signature(b).parameters}
        prompt = b(**kw)
        excl, output_ext, canon = None, None, None
    elif spec and not spec.get("builtin"):
        prompt = _inv.build_preprompt_for_spec(spec, params)
        excl = _inv.exclude_tools_for_spec(spec)
        output_ext, canon = spec.get("output_ext"), spec.get("canonical_mode")
    else:
        print(f"✗ agent inconnu : {a.agent}", file=sys.stderr)
        return 1

    def _ba(client=None, llm=None):
        return build_jdm_agent(client=client, llm=llm, exclude_tools=excl)

    consolidates = bool(spec and spec.get("consolidates"))
    print(f"→ {a.agent} EN LOCAL (non supervisé)…", flush=True)
    prev = ""
    for chunk in _j.run_jarvis_agent(
        prompt=prompt, model=a.model or "gemini-3.1-flash-lite", api_key="",
        budget_label=a.budget, drops_key="",
        build_llm_fn=lambda m, k, **kw: get_llm(), build_agent_fn=_ba,
        get_client_fn=lambda: JDMClient(),
        use_thinking=not a.no_thinking,
        consolidation_target=(a.target if consolidates and a.target else None),
        production_target=(a.target if not consolidates and a.target else None),
        agent_id=(a.agent if a.agent in builders else None),
        output_ext=output_ext, canonical_mode=canon,
    ):
        if isinstance(chunk, tuple) and chunk:
            msgs = chunk[0] or []
            asst = next((m.get("content", "") for m in reversed(msgs)
                         if isinstance(m, dict) and m.get("role") == "assistant"), "")
            if asst and asst != prev:
                sys.stdout.write(asst[len(prev):]); sys.stdout.flush(); prev = asst
    print("\n✓ terminé (local)", flush=True)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Lance un agent Jarvis (client serveur ou local).")
    p.add_argument("--agent", required=True,
                   help="enrich/audit/gap/signalement/stats/annotation ou id sur mesure.")
    p.add_argument("--term", default="", help="Terme cible (vide = tirage au hasard par l'agent).")
    p.add_argument("--relation", default="", help="Relation cible (ex. r_isa).")
    p.add_argument("--target", type=int, default=0, help="Nombre d'items visés (0 = défaut).")
    p.add_argument("--model", default="", help="Modèle LLM (défaut gemini-3.1-flash-lite).")
    p.add_argument("--budget", default="illimité", help="Budget d'outils (10/25/50/100/illimité).")
    p.add_argument("--no-thinking", action="store_true", help="Désactive le raisonnement.")
    p.add_argument("--url", default=DEFAULT_URL, help=f"URL du serveur (défaut {DEFAULT_URL}).")
    p.add_argument("--local", action="store_true",
                   help="Exécute en process (offline, NON supervisé) au lieu d'appeler le serveur.")
    a = p.parse_args()
    return _run_local(a) if a.local else _run_client(a)


if __name__ == "__main__":
    raise SystemExit(main())
