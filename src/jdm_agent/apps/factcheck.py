"""CLI du fact-checker JDM.

Trois modes :
  1. Texte → LLM extrait les claims, puis vérification
       python -m jdm_agent.apps.factcheck --text "La baleine est un poisson."

  2. Claim unique directe (sans LLM, instantanée)
       python -m jdm_agent.apps.factcheck --claim "baleine r_isa poisson"
       python -m jdm_agent.apps.factcheck --claim "sang r_has_color rouge"

  3. Stdin : un claim "subject r_xxx object" par ligne
       echo "baleine r_isa poisson" | python -m jdm_agent.apps.factcheck --stdin
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — UTF-8 console

import argparse
import json
import sys
from typing import Iterable

from jdm_agent.client import JDMClient
from jdm_agent.factcheck import Claim, Report, factcheck, factcheck_claims
from jdm_agent.factcheck.models import Status


GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
GRAY = "\033[90m"
RESET = "\033[0m"

STATUS_COLOR = {
    Status.SUPPORTED: GREEN,
    Status.CONTRADICTED: RED,
    Status.UNKNOWN: YELLOW,
}
STATUS_ICON = {
    Status.SUPPORTED: "✓",
    Status.CONTRADICTED: "✗",
    Status.UNKNOWN: "?",
}


def parse_claim_line(line: str) -> Claim:
    """Parse 'subject r_xxx object' (séparateurs espace OU pipe)."""
    line = line.strip().replace("|", " ")
    parts = line.split()
    if len(parts) < 3:
        raise ValueError(f"Format invalide : {line!r}. Attendu : 'subject r_xxx object'")
    # subject = parts[0], relation = parts[1] (commence par r_), object = reste
    subject = parts[0]
    relation = parts[1]
    obj = " ".join(parts[2:])
    if not relation.startswith("r_"):
        raise ValueError(f"Le 2e champ doit être une relation JDM (`r_xxx`) : {relation!r}")
    return Claim(text=line, subject=subject, relation=relation, object=obj)


def print_report(report: Report, as_json: bool = False) -> None:
    if as_json:
        print(report.model_dump_json(indent=2))
        return

    summary = report.summary()
    print(f"\n=== Rapport ({summary['total']} claim(s)) ===")
    print(f"  {GREEN}✓ supported{RESET}    : {summary['supported']}")
    print(f"  {RED}✗ contradicted{RESET} : {summary['contradicted']}")
    print(f"  {YELLOW}? unknown{RESET}      : {summary['unknown']}")
    print()

    for v in report.verdicts:
        color = STATUS_COLOR[v.status]
        icon = STATUS_ICON[v.status]
        print(f"{color}{icon} [{v.status.value.upper()}]{RESET} "
              f"`{v.claim.subject} | {v.claim.relation} | {v.claim.object}`"
              f"  {GRAY}(conf={v.confidence:.2f}){RESET}")
        if v.claim.text and v.claim.text != f"{v.claim.subject} {v.claim.relation} {v.claim.object}":
            print(f"   {GRAY}texte : {v.claim.text!r}{RESET}")
        if v.explanation:
            print(f"   → {v.explanation}")
        for e in v.evidence_for:
            print(f"     {GREEN}+ {e.source} | {e.relation} | {e.target} (w={e.w:.0f}){RESET}")
        for e in v.evidence_against:
            print(f"     {RED}- {e.source} | {e.relation} | {e.target} (w={e.w:.0f}){RESET}")
        print()


def main() -> int:
    p = argparse.ArgumentParser(description="Fact-checker JeuxDeMots.")
    p.add_argument("--text", help="Texte libre à analyser (LLM extrait les claims).")
    p.add_argument("--claim", action="append",
                   help="Claim direct au format 'subject r_xxx object' (répétable).")
    p.add_argument("--stdin", action="store_true",
                   help="Lit un claim par ligne sur stdin.")
    p.add_argument("--provider", default=None, help="LLM provider (pour --text)")
    p.add_argument("--model", default=None, help="LLM model (pour --text)")
    p.add_argument("--json", action="store_true", help="Sortie en JSON brut.")
    args = p.parse_args()

    if not (args.text or args.claim or args.stdin):
        p.print_help()
        return 1

    client = JDMClient()

    if args.text:
        try:
            from jdm_agent.tools.llm_factory import get_llm
            llm = get_llm(provider=args.provider, model=args.model)
        except Exception as e:
            print(f"[erreur] init LLM : {e}", file=sys.stderr)
            return 2
        print(f"[extraction] {args.text!r} → claims via LLM…", file=sys.stderr)
        report = factcheck(args.text, client=client, llm=llm)
    else:
        claims_lines: list[str] = []
        if args.claim:
            claims_lines.extend(args.claim)
        if args.stdin:
            claims_lines.extend(l for l in sys.stdin if l.strip() and not l.startswith("#"))
        try:
            claims = [parse_claim_line(l) for l in claims_lines]
        except ValueError as e:
            print(f"[erreur] {e}", file=sys.stderr)
            return 1
        report = factcheck_claims(claims, client=client)

    print_report(report, as_json=args.json)
    client.close()

    # Exit code basé sur les contradictions trouvées (utile en CI).
    n_contradicted = sum(1 for v in report.verdicts if v.status == Status.CONTRADICTED)
    return 0 if n_contradicted == 0 else 3


if __name__ == "__main__":
    sys.exit(main())
