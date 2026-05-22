"""CLI d'enrichissement JDM.

Usages :
  # 1. Détection des gaps sans LLM (instantané, gratuit)
  python -m jdm_agent.apps.enrich --terms smartphone tablette --no-propose

  # 2. Proposition de candidats via LLM + validation, sortie CSV
  python -m jdm_agent.apps.enrich --terms smartphone --provider anthropic --model claude-sonnet-4-5 -o candidats.csv

  # 3. Liste de termes depuis un fichier
  python -m jdm_agent.apps.enrich --terms-file domaine.txt --provider ollama --model llama3.1:8b
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — UTF-8 console

import argparse
import sys
from pathlib import Path

from jdm_agent.client import JDMClient
from jdm_agent.enrich import enrich
from jdm_agent.enrich.pipeline import write_candidates_csv, write_submission


GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
GRAY = "\033[90m"
RESET = "\033[0m"


def main() -> int:
    p = argparse.ArgumentParser(description="Enrichissement actif de JeuxDeMots.")
    p.add_argument("--terms", nargs="*", default=[],
                   help="Liste de termes à analyser (séparés par espace).")
    p.add_argument("--terms-file",
                   help="Fichier texte (1 terme par ligne) à analyser.")
    p.add_argument("--relations", default=None,
                   help="Relations à inspecter, séparées par virgule. Défaut: jeu standard.")
    p.add_argument("--no-propose", action="store_true",
                   help="Détecte les gaps sans demander de candidats au LLM.")
    p.add_argument("--no-validate", action="store_true",
                   help="Désactive la validation des candidats (plus rapide, moins fiable).")
    p.add_argument("--consolidate", action="store_true",
                   help="Consolide les candidats validés par INFÉRENCE dans le réseau JDM.")
    p.add_argument("--inference-effort", type=int, default=1, choices=(1, 2),
                   help="Effort du moteur d'inférence pour la consolidation (1 noyau, 2 complet).")
    p.add_argument("--min-coverage", type=int, default=3,
                   help="Une relation ayant < N triplets positifs est signalée comme "
                        "gap. Monter pour enrichir aussi les relations bien fournies "
                        "(défaut 3 → relations à 3+ entrées ignorées).")
    p.add_argument("--provider", default=None)
    p.add_argument("--model", default=None)
    p.add_argument("--max-per-gap", type=int, default=10)
    p.add_argument("-o", "--output", default=None,
                   help="Fichier CSV de travail (tous les candidats annotés).")
    p.add_argument("--submission-output", default=None,
                   help="Fichier de soumission : UNIQUEMENT les triplets consolidés "
                        "par inférence (force --consolidate).")
    args = p.parse_args()

    terms: list[str] = list(args.terms)
    if args.terms_file:
        terms.extend(l.strip() for l in Path(args.terms_file).read_text(encoding="utf-8").splitlines()
                     if l.strip() and not l.startswith("#"))
    if not terms:
        p.print_help()
        return 1

    target_relations = None
    if args.relations:
        target_relations = [r.strip() for r in args.relations.split(",") if r.strip()]

    client = JDMClient()
    llm = None
    if not args.no_propose:
        try:
            from jdm_agent.tools.llm_factory import get_llm
            llm = get_llm(provider=args.provider, model=args.model)
        except Exception as e:
            print(f"[erreur] init LLM : {e}", file=sys.stderr)
            return 2

    # Une soumission n'a de sens que consolidée → --submission-output force
    # la consolidation systématique de tous les candidats validés.
    do_consolidate = args.consolidate or bool(args.submission_output)

    print(f"[enrich] {len(terms)} terme(s), relations={target_relations or 'standard'}, "
          f"min_coverage={args.min_coverage}, consolidate={do_consolidate}", file=sys.stderr)
    gaps, candidates = enrich(
        terms,
        client=client,
        llm=llm,
        target_relations=target_relations,
        propose=not args.no_propose,
        validate=not args.no_validate,
        consolidate=do_consolidate,
        inference_effort=args.inference_effort,
        max_per_gap=args.max_per_gap,
        min_coverage=args.min_coverage,
    )

    # Résumé gaps
    print(f"\n=== Gaps détectés : {len(gaps)} ===")
    by_type: dict[str, int] = {}
    for g in gaps:
        by_type[g.gap_type.value] = by_type.get(g.gap_type.value, 0) + 1
    for k, v in sorted(by_type.items()):
        print(f"  - {k}: {v}")

    for g in gaps[:20]:
        print(f"  {YELLOW}? {g.term} | {g.relation}{RESET}  [{g.gap_type.value}, sev={g.severity:.1f}]")
        print(f"     {GRAY}{g.detail}{RESET}")
    if len(gaps) > 20:
        print(f"  {GRAY}… {len(gaps) - 20} autre(s) gap(s) non affiché(s){RESET}")

    # Résumé candidats
    if candidates:
        ok = [c for c in candidates if c.is_valid()]
        dup = [c for c in candidates if c.validation_status == "duplicate"]
        unk = [c for c in candidates if c.validation_status == "unknown_term"]
        inc = [c for c in candidates if c.validation_status == "inconsistent"]
        print(f"\n=== Candidats proposés : {len(candidates)} ===")
        print(f"  {GREEN}ok          : {len(ok)}{RESET}")
        print(f"  {GRAY}duplicate   : {len(dup)}{RESET}")
        print(f"  {YELLOW}unknown_term: {len(unk)}{RESET}")
        print(f"  {RED}inconsistent: {len(inc)}{RESET}")

        for c in ok[:30]:
            print(f"  {GREEN}+ {c.term} | {c.relation} | {c.target}{RESET}  "
                  f"{GRAY}(conf={c.confidence:.2f}){RESET}")
            if c.rationale:
                print(f"     {GRAY}→ {c.rationale}{RESET}")
        if len(ok) > 30:
            print(f"  {GRAY}… {len(ok) - 30} autre(s){RESET}")

        # Résumé consolidation (si demandée)
        if do_consolidate:
            cons = [c for c in candidates if c.is_consolidated()]
            rej = [c for c in candidates if c.consolidation_status == "rejected"]
            notc = [c for c in candidates if c.consolidation_status == "not_consolidated"]
            print(f"\n=== Consolidation par inférence ===")
            print(f"  {GREEN}consolidés      : {len(cons)}{RESET}")
            print(f"  {YELLOW}non consolidés  : {len(notc)}{RESET}")
            print(f"  {RED}réfutés         : {len(rej)}{RESET}")
            for c in cons[:20]:
                print(f"  {GREEN}✓ {c.term} | {c.relation} | {c.target}{RESET}")
                print(f"     {GRAY}{c.consolidation_explanation[:140]}{RESET}")

    if args.output:
        write_candidates_csv(args.output, candidates)
        print(f"\n[csv] {len(candidates)} candidat(s) écrit(s) dans {args.output}",
              file=sys.stderr)

    if args.submission_output:
        n = write_submission(args.submission_output, candidates)
        print(f"[soumission] {n} candidat(s) consolidé(s) — fichier {args.submission_output}",
              file=sys.stderr)

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
