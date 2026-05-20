"""Mini-banc d'évaluation manuelle de l'agent Q&A.

Pose une série de questions types et imprime les réponses + les outils appelés.
Utile pour mesurer rapidement la qualité du grounding sur différents modèles.

Usage :
    python -m jdm_agent.apps.qa_eval
    python -m jdm_agent.apps.qa_eval --provider ollama --model llama3.2:3b
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — force stdout UTF-8 (Windows)

import argparse
import time
from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.tools.jdm_agent import ask, build_jdm_agent
from jdm_agent.tools.llm_factory import get_llm


QUESTIONS: list[str] = [
    "Qu'est-ce qu'un chat ?",
    "Donne-moi 5 synonymes de voiture.",
    "Quelle est la couleur typique du sang d'après JeuxDeMots ?",
    "Le mot 'avocat' a-t-il plusieurs sens ? Quels sont-ils ?",
    "Quel est le rapport entre 'chat' et 'internet' ?",
    "Cite 3 contraires de 'grand'.",
    "Quels sont les composants typiques d'une voiture ?",
    "Quels sont les hyponymes de 'fruit' ?",
    "Quelle est la conséquence typique d'un orage ?",
    "Une baleine est-elle un poisson ?",
]


def main() -> int:
    p = argparse.ArgumentParser(description="Banc d'évaluation Q&A JDM.")
    p.add_argument("--provider", default=None)
    p.add_argument("--model", default=None)
    p.add_argument("--limit", type=int, default=0, help="N premières questions (0 = toutes).")
    p.add_argument("--show-tools", action="store_true")
    args = p.parse_args()

    client = JDMClient()
    llm = get_llm(provider=args.provider, model=args.model)
    agent = build_jdm_agent(client=client, llm=llm)

    qs = QUESTIONS if args.limit <= 0 else QUESTIONS[: args.limit]
    for i, q in enumerate(qs, 1):
        print(f"\n{'=' * 70}\nQ{i}. {q}\n{'-' * 70}")
        t0 = time.time()
        try:
            out = ask(agent, q)
        except Exception as e:
            print(f"[erreur] {e}")
            continue
        dt = time.time() - t0
        print(out["answer"])
        if args.show_tools:
            print(f"\n[{len(out['tool_calls'])} appels d'outils, {dt:.1f}s]")
            for tc in out["tool_calls"]:
                args_str = ", ".join(f"{k}={v!r}" for k, v in (tc.get("args") or {}).items())
                print(f"  • {tc['name']}({args_str})")
        else:
            print(f"\n[{dt:.1f}s]")

    client.close()
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
