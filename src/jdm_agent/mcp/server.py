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
            "Outils JeuxDeMots — graphe lexico-sémantique du français "
            "(LIRMM/CNRS).\n\n"
            "RÈGLES DE COMPORTEMENT :\n\n"
            "1. Pour toute affirmation factuelle, appelle un outil JDM et "
            "cite les triplets renvoyés au format "
            "`source | relation | target (w=...)`. Les `source` et `target` "
            "sont déjà décodés en français lisible — cite-les tels quels.\n\n"
            "2. POLARITÉ : chaque triplet a un champ `polarity` qui vaut "
            "\"affirmation\" ou \"négation\". Quand polarity == \"négation\", "
            "préface ta citation pour le marquer clairement, par exemple : "
            "« JDM indique explicitement que X N'EST PAS Y ». NE PAS mélanger "
            "silencieusement les négations avec les affirmations.\n\n"
            "3. ANNOTATIONS : les triplets retournés par défaut n'incluent "
            "PAS d'annotations (raison de performance). Quand tu veux "
            "comprendre la nuance d'un triplet précis (constitutif vs "
            "contrastif, exception, etc.), un outil dédié permet de récupérer "
            "ses annotations à la demande.\n\n"
            "4. POLYSÉMIE : pour les termes ayant plusieurs sens (avocat, "
            "souris, police, chat, …), un outil dédié liste les sens "
            "disponibles ; utilise-le en premier puis requête sur le sens "
            "précis voulu.\n\n"
            "5. PERSPECTIVES MULTIPLES (suggestion, non obligation) : "
            "certaines questions recouvrent plusieurs angles sémantiques "
            "d'un même objet ou concept. Dans ces cas, il PEUT être utile "
            "(pas obligatoire) d'explorer plusieurs relations complémentaires "
            "pour offrir des perspectives multiples, structurées par angle. "
            "Exemples de familles d'angles :\n"
            "  * « que peut-on faire avec/de X » (X = objet) → fonction "
            "primaire (r_telic_role) ; usages instrumentaux variés "
            "(r_instr-1) ; actions subies par X (r_patient-1)\n"
            "  * « qu'est-ce qu'un X » (X = nom) → catégorisation (r_isa) ; "
            "caractéristiques (r_carac) ; parties (r_has_part) ; sens "
            "(raffinements via désambiguïsation)\n"
            "  * « que peut faire X » (X = agent) → actions typiques "
            "(r_agent-1) ; caractéristiques (r_carac)\n"
            "  * « domaine de X » → domaines auxquels X appartient "
            "(r_domain) ; ou inversement (r_domain-1) si X est un domaine\n"
            "Utilise ton jugement : si l'utilisateur attend une réponse "
            "courte et ciblée, reste sur 1 angle. Si la question est "
            "ouverte ou exploratoire, présente plusieurs angles avec des "
            "sections comme « du point de vue X… ».\n\n"
            "6. PRÉSENTATION : quand tu réponds à l'utilisateur, n'écris "
            "JAMAIS les noms d'outils internes (par ex. les fonctions Python "
            "que tu appelles). Parle en français naturel : « je regarde les "
            "sens du mot », « je cherche les synonymes », etc. Les NOMS DE "
            "RELATIONS JDM (r_isa, r_anto, r_has_part, etc.) sont en revanche "
            "AUTORISÉS dans tes triplets — c'est de la terminologie "
            "linguistique légitime."
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

    if args.transport == "stdio":
        server.run()  # transport par défaut stdio
    else:
        server.run(transport=args.transport, host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
