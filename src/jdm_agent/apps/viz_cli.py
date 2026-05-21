"""CLI pour générer une visualisation de sous-graphe JDM en HTML.

Usage::

    python -m jdm_agent.apps.viz_cli "plat asiatique"
    python -m jdm_agent.apps.viz_cli polyphonie --depth 2 --top-k 8
    python -m jdm_agent.apps.viz_cli chat --relations r_isa,r_has_part,r_carac \
        --output-path chat.html

Aucun LLM impliqué — seulement le client JDM + la couche viz.
"""
from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from jdm_agent.client import JDMClient
from jdm_agent.viz import (
    DEFAULT_DEPTH2_RELATIONS,
    DEFAULT_DEPTH3_RELATIONS,
    DEFAULT_DEPTH4_RELATIONS,
    DEFAULT_RELATIONS,
    build_subgraph,
)


def _csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [s.strip() for s in value.split(",") if s.strip()]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Construit un sous-graphe JDM autour d'un terme (HTML interactif).",
    )
    p.add_argument("term", help="terme racine (ex. \"plat asiatique\", \"polyphonie\")")
    p.add_argument("--depth", type=int, default=1,
                   help="profondeur (1 à 4 ; défaut = 1)")
    p.add_argument("--top-k", type=int, default=3,
                   help="top-K niveau 1 (défaut = 3) — applique aussi aux niveaux 2..4 si non précisés")
    p.add_argument("--top-k-depth2", type=int, default=None,
                   help="top-K niveau 2 (défaut = même que --top-k)")
    p.add_argument("--top-k-depth3", type=int, default=None,
                   help="top-K niveau 3 (défaut = même que --top-k)")
    p.add_argument("--top-k-depth4", type=int, default=None,
                   help="top-K niveau 4 (défaut = même que --top-k)")
    p.add_argument("--min-weight", type=float, default=None,
                   help="poids minimum (défaut : aucun, JDM décide)")
    p.add_argument("--relations", type=str, default=None,
                   help="liste CSV de relations (défaut = jeu standard : "
                        + ",".join(DEFAULT_RELATIONS) + ")")
    p.add_argument("--depth2-relations", type=str, default=None,
                   help="liste CSV pour la profondeur 2 (défaut : "
                        + ",".join(DEFAULT_DEPTH2_RELATIONS) + ")")
    p.add_argument("--depth3-relations", type=str, default=None,
                   help="liste CSV pour la profondeur 3 (défaut : "
                        + ",".join(DEFAULT_DEPTH3_RELATIONS) + ")")
    p.add_argument("--depth4-relations", type=str, default=None,
                   help="liste CSV pour la profondeur 4 (défaut : "
                        + ",".join(DEFAULT_DEPTH4_RELATIONS) + ")")
    p.add_argument("--output-path", type=str, default=None,
                   help="fichier HTML de sortie (défaut = <slug>_subgraph.html)")
    p.add_argument("--no-open", action="store_true",
                   help="ne pas ouvrir le fichier dans le navigateur à la fin")
    args = p.parse_args(argv)

    client = JDMClient()
    res = build_subgraph(
        args.term,
        client=client,
        depth=args.depth,
        top_k_per_relation=args.top_k,
        min_weight=args.min_weight,
        relations=_csv(args.relations),
        depth2_relations=_csv(args.depth2_relations),
        depth3_relations=_csv(args.depth3_relations),
        depth4_relations=_csv(args.depth4_relations),
        top_k_depth2=args.top_k_depth2,
        top_k_depth3=args.top_k_depth3,
        top_k_depth4=args.top_k_depth4,
        output="html",
        output_path=args.output_path,
    )
    stats = res["stats"]
    path = res["html_path"]
    # ASCII only pour compat console Windows cp1252.
    print(f"[OK] {stats['n_nodes']} nodes, {stats['n_edges']} edges, "
          f"{stats['n_negative']} negations (depth={stats['depth']})")
    print(f"  -> {path}")

    if not args.no_open:
        webbrowser.open(Path(path).as_uri())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
