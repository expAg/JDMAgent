"""CLI d'annotation sémantique JDM (taxonomie 4-catégories).

Usages :
  # 1. Annoter un terme sur les relations standard
  python -m jdm_agent.apps.annotate --terms avocat --provider gemini --model gemini-3.1-flash-lite

  # 2. Cibler une relation
  python -m jdm_agent.apps.annotate --terms baleine --relations r_isa --provider anthropic --model claude-sonnet-4-7

  # 3. Soumettre directement au LLMDrops (env JDM_DROPS_API_KEY)
  python -m jdm_agent.apps.annotate --terms guitare --upload
"""
from __future__ import annotations

from jdm_agent.apps import _console  # noqa: F401 — UTF-8 console

import argparse
import sys
from pathlib import Path

from jdm_agent.client import JDMClient
from jdm_agent.annotate import (
    DEFAULT_ANNOTATION_RELATIONS, annotate, write_annotation_file,
)
from jdm_agent.enrich.pipeline import compute_submission_filename


GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
GRAY = "\033[90m"
RESET = "\033[0m"


def main() -> int:
    p = argparse.ArgumentParser(
        description="Annotation sémantique de triplets JDM "
        "(constitutif/contrastif/non spécifique/exception)."
    )
    p.add_argument("--terms", nargs="*", default=[],
                   help="Termes à annoter (séparés par espace).")
    p.add_argument("--terms-file",
                   help="Fichier texte (1 terme par ligne).")
    p.add_argument("--relations", default=None,
                   help="Relations à inspecter, séparées par virgule. "
                        f"Défaut: {','.join(DEFAULT_ANNOTATION_RELATIONS)}")
    p.add_argument("--top-k", type=int, default=8,
                   help="Top-K triplets par relation à annoter (défaut 8).")
    p.add_argument("--provider", default=None,
                   help="Provider LangChain (anthropic/openai/gemini/ollama).")
    p.add_argument("--model", default=None,
                   help="Modèle exact (claude-sonnet-4-7, gpt-4o, …).")
    p.add_argument("-o", "--output", default=None,
                   help="Chemin du fichier .annot. Défaut: <term>_annotation.annot")
    p.add_argument("--upload", action="store_true",
                   help="POST le .annot au LLMDrops après écriture. "
                        "Nécessite JDM_DROPS_API_KEY dans l'env.")
    p.add_argument("--upload-model", default=None,
                   help="Nom du LLM source pour le filename uploadé.")
    p.add_argument("--upload-endpoint", default=None)
    p.add_argument("--upload-api-key", default=None)
    args = p.parse_args()

    terms: list[str] = list(args.terms)
    if args.terms_file:
        terms.extend(
            l.strip() for l in
            Path(args.terms_file).read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")
        )
    if not terms:
        p.print_help()
        return 1

    relations = None
    if args.relations:
        relations = [r.strip() for r in args.relations.split(",") if r.strip()]

    try:
        from jdm_agent.tools.llm_factory import get_llm
        llm = get_llm(provider=args.provider, model=args.model)
    except Exception as e:
        print(f"[erreur] init LLM : {e}", file=sys.stderr)
        return 2

    client = JDMClient()
    total_annotated = 0
    total_signal = 0
    out_paths: list[str] = []

    for term in terms:
        print(f"\n[annot] === {term} ===", file=sys.stderr)
        proposals = annotate(
            client=client, llm=llm, term=term,
            relations=relations, top_k_per_relation=args.top_k,
        )
        # Path par terme — sinon un seul fichier perdrait la traçabilité
        out_path = (
            args.output if len(terms) == 1 and args.output
            else f"{term.replace(' ', '_')}_annotation.annot"
        )
        stats = write_annotation_file(out_path, proposals)
        out_paths.append(stats["path"])
        total_annotated += stats["n_annotated"]
        total_signal += stats["n_signalement"]

        print(f"  {GREEN}annotés    : {stats['n_annotated']}{RESET}", file=sys.stderr)
        print(f"  {YELLOW}signalement: {stats['n_signalement']}{RESET}", file=sys.stderr)
        print(f"  {GRAY}non annotable: {stats['n_skipped']}{RESET}", file=sys.stderr)
        print(f"  → {stats['path']}", file=sys.stderr)

        # Aperçu (5 premières lignes utiles)
        for p_ in proposals[:5]:
            cat = p_.category.value if p_.category else "—"
            print(f"    {p_.subject} | {p_.relation} | {p_.target}  "
                  f"{GRAY}[{cat}]{RESET}")

    print(f"\n[annot] TOTAL : {GREEN}{total_annotated} annoté(s){RESET}, "
          f"{YELLOW}{total_signal} signalement(s){RESET}", file=sys.stderr)

    if args.upload:
        from jdm_agent.enrich import submit_to_jdm
        upload_model = args.upload_model or args.model
        for path in out_paths:
            result = submit_to_jdm(
                path,
                api_key=args.upload_api_key,
                model_name=upload_model,
                endpoint_url=args.upload_endpoint,
            )
            if result["ok"]:
                print(f"[upload] {GREEN}✓{RESET} {path} → "
                      f"{result['uploaded_as']} (HTTP {result['status_code']})",
                      file=sys.stderr)
            else:
                print(f"[upload] {RED}✗{RESET} {path} : {result['error']}",
                      file=sys.stderr)

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
