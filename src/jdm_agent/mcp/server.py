"""Serveur MCP exposant les outils JeuxDeMots à n'importe quel client MCP
(Claude Desktop, Claude Code, Cursor, etc.).

Réutilise les mêmes fonctions Python que la couche LangChain — pas de
duplication. Chaque `StructuredTool` LangChain expose la fonction d'origine
via `.func`, qu'on enregistre ensuite comme outil MCP.

Lancement :
    python -m jdm_agent.mcp.server         # stdio (par défaut, pour Claude Desktop/Code)
    jdm-mcp                                # même chose via le script installé

Configuration côté Claude Desktop/Code (`claude_desktop_config.json` ou
`~/.claude.json` selon l'outil) :

    {
      "mcpServers": {
        "jdm": {
          "command": "python",
          "args": ["-m", "jdm_agent.mcp.server"]
        }
      }
    }
"""
from __future__ import annotations

import argparse
import logging

from fastmcp import FastMCP

from jdm_agent.client import JDMClient
from jdm_agent.enrich.validators import exclusion_context
from jdm_agent.tools.jdm_tools import ALL_TOOLS, set_default_client


logger = logging.getLogger("jdm-mcp")


def build_server(client: JDMClient | None = None) -> FastMCP:
    """Construit l'instance FastMCP et enregistre tous les outils JDM."""
    if client is not None:
        set_default_client(client)
    else:
        # Force la création paresseuse pour pré-charger les types relations
        # (un seul HTTP au démarrage).
        set_default_client(JDMClient())

    mcp = FastMCP(
        name="jdm-agent",
        instructions=(
            "Outils JeuxDeMots — graphe lexico-sémantique du français (LIRMM/CNRS).\n\n"
            "RÈGLE PRIORITAIRE : tout ce que tu énonces (relation, triplet, verdict, "
            "gap) provient d'un appel d'outil JDM réel de ce tour. Pas de simulation, "
            "pas de relations hallucinées. Si les outils ne sont pas disponibles dans "
            "la session, dis-le et arrête.\n\n"
            "CITATION : format `source | relation | target (w=...)`. Les noms reçus "
            "sont déjà décodés — cite-les tels quels. `|w|` = intensité du consensus.\n\n"
            "POLARITÉ : `polarity ∈ {affirmation, négation}`. Préface clairement "
            "les négations (« JDM affirme que X N'EST PAS Y »), NE les mêle JAMAIS "
            "aux affirmations.\n\n"
            "POLYSÉMIE : pour les termes à plusieurs sens (avocat, souris, police, "
            "chat, livre, sens, vol, glace…), liste d'abord les sens via l'outil "
            "dédié puis requête sur le sens visé avec son `sense_id` raffiné.\n\n"
            "CONTENANCE vs INFÉRENCE : « JDM contient-il X ? » → vérification "
            "stricte (effort 0), si absent dis « pas dans JDM ». « X est-il vrai / "
            "déductible ? » → autorise l'inférence (effort ≥ 1). Un résultat "
            "inféré se présente comme déduction (« on peut déduire que… parce "
            "que… »), JAMAIS comme contenu direct.\n\n"
            "ANNOTATIONS : opt-in (perf) ; outil dédié pour récupérer "
            "constitutif / contrastif / exception sur un triplet précis.\n\n"
            "PRÉSENTATION : n'écris JAMAIS les noms d'outils internes — parle en "
            "français (« je regarde les sens », « je cherche les synonymes »). "
            "Les noms de relations JDM (r_isa, r_anto, r_has_part…) sont AUTORISÉS "
            "— terminologie linguistique légitime.\n\n"
            "PERSPECTIVES MULTIPLES (suggestion) : question ouverte sur un terme → "
            "explorer plusieurs angles complémentaires (catégorisation / parties / "
            "caractéristiques ; fonction / usages / actions subies ; …) enrichit "
            "la réponse. Utilise ton jugement.\n\n"
            "ENRICHISSEMENT : dès qu'on te demande de proposer / suggérer / "
            "ajouter / enrichir des triplets dans JDM, ton TOUT PREMIER appel "
            "est `enrichment_workflow()` — il renvoie le flux canonique à "
            "suivre étape par étape (pré-fetch, désambiguïsation, proposition, "
            "validation + consolidation, écriture soumission) et les règles "
            "transversales. C'est la source de vérité du flux.\n\n"
            "DÉTECTION DE GAPS SANS TERME : règle détaillée dans la docstring "
            "de `detect_gaps` (rechargée à chaque appel d'outil)."
        ),
    )

    # Chaque LangChain @tool a un attribut .func = la fonction Python d'origine
    # (avec ses annotations + docstring). FastMCP en infère le schéma.
    for t in ALL_TOOLS:
        fn = getattr(t, "func", None) or t  # fallback si l'attribut change
        mcp.tool(fn, name=t.name, description=t.description)

    return mcp


def main() -> int:
    parser = argparse.ArgumentParser(description="Serveur MCP JeuxDeMots.")
    parser.add_argument(
        "--transport",
        choices=("stdio", "sse", "streamable-http"),
        default="stdio",
        help="Transport MCP (stdio = défaut pour clients desktop).",
    )
    parser.add_argument(
        "--host", default="127.0.0.1",
        help="Hôte pour les transports HTTP/SSE.",
    )
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--log-level", default="WARNING")
    args = parser.parse_args()

    logging.basicConfig(level=args.log_level.upper(), format="[%(name)s] %(message)s")
    server = build_server()

    # Active le registry de consolidation pour TOUTE la duree du
    # serveur MCP. Sans ce wrap, `validate_candidate` appelle
    # `register_consolidation` qui voit `_CONSOLIDATION_REGISTRY is None`
    # (= aucun `exclusion_context` actif) et fait un no-op silencieux ;
    # ensuite `write_submission_file` en mode triplets `.enrich` rejette
    # TOUS les triplets comme « absents du registry d'inference », forcant
    # le LLM a contourner via le mode RAW (qui bypass la verification
    # « preuve d'inference »). Le wrap reste ouvert tant que `server.run()`
    # ne retourne pas — le cleanup naturel se fait a l'arret du process.
    with exclusion_context():
        if args.transport == "stdio":
            server.run()  # transport par défaut stdio
        else:
            server.run(transport=args.transport, host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
