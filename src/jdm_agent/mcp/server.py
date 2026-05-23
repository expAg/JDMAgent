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
            "RÈGLE PRIORITAIRE A — ne JAMAIS demander un terme à l'utilisateur "
            "quand il a indiqué une relation seule. Si l'utilisateur dit "
            "« détecte les trous pour r_holo » / « r_telic_role » / etc. "
            "sans donner de terme, tu NE LUI POSES PAS DE QUESTION. Tu tires "
            "TOI-MÊME un mot français au hasard, tu le vérifies via lookup, "
            "tu appelles `detect_gaps` dessus, et tu ITÈRES SILENCIEUSEMENT "
            "(6-8 essais max) si le mot n'est pas dans JDM ou si tu n'obtiens "
            "pas au moins 3 gaps intéressants. Tu ne montres à l'utilisateur "
            "que le résultat final.\n\n"
            "VARIE VRAIMENT tes tirages d'un essai à l'autre, et d'une "
            "session à l'autre — la langue française et JDM sont infiniment "
            "plus riches que quelques catégories mentales. Évite la facilité "
            "du même registre répété (par défaut tu tombes souvent sur le "
            "même genre de mot deux fois de suite) : change de registre, de "
            "longueur, de niveau d'abstraction, de domaine — exploite toute "
            "l'étendue du français.\n\n"
            "RÈGLE PRIORITAIRE 0 — JAMAIS de réponse sans outils JDM. Tout "
            "ce que tu dis doit venir d'un appel d'outil JDM réel. AVANT "
            "TOUTE proposition de triplet, ton TOUT PREMIER appel est "
            "OBLIGATOIREMENT à l'outil qui liste les types de relations JDM, "
            "pour récupérer les noms EXACTS (r_isa, r_anto, r_has_color, "
            "r_has_conseq, r_object>mater, r_sentiment, …). Tu ne dois "
            "JAMAIS inventer un nom de relation depuis ta mémoire "
            "(« r_color », « r_made_of », « r_product_of », « r_consequence » "
            "n'existent pas dans JDM — ce sont des hallucinations). Si pour "
            "une raison quelconque tu ne peux pas appeler les outils JDM "
            "dans cette session (serveur non connecté, outils non surfacés), "
            "tu DOIS le dire EXPLICITEMENT à l'utilisateur et T'ARRÊTER — "
            "tu NE simules JAMAIS le flux, tu NE narres JAMAIS « j'ai "
            "consolidé / j'ai vérifié » sans avoir vraiment appelé les "
            "outils. Mieux vaut dire « les outils JDM ne sont pas "
            "disponibles dans cette session » que produire 50 triplets "
            "fictifs avec des relations inventées.\n\n"
            "RÈGLE PRIORITAIRE B — JAMAIS de proposition à l'aveugle. Dès "
            "qu'on te demande de PROPOSER / SUGGÉRER des triplets pour "
            "enrichir JDM, ta TOUTE PREMIÈRE action pour chaque couple "
            "(terme, relation) ciblé est OBLIGATOIREMENT un appel à l'outil "
            "qui liste les triplets d'un type donné pour ce terme. Cette "
            "liste devient ta zone d'EXCLUSION : tu ne proposes ensuite QUE "
            "des cibles HORS de cette liste. Tu ne dois JAMAIS proposer un "
            "triplet puis découvrir via la vérification qu'il est duplicate — "
            "chaque duplicate signalé APRÈS coup est un appel gaspillé et "
            "c'est ta faute. Pré-fetch d'abord, proposition ensuite.\n\n"
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
            "linguistique légitime.\n\n"
            "7. CONTENANCE vs INFÉRENCE : distingue deux questions. "
            "« JDM CONTIENT-IL / INCLUT-IL le fait X ? » → vérification en "
            "contenance stricte (effort 0) : si le fait n'est pas littéralement "
            "dans le graphe, réponds qu'il n'y est pas — NE JAMAIS dire « oui » "
            "parce que tu as pu l'inférer. « Le fait X est-il VRAI / "
            "DÉDUCTIBLE / émergent ? » → autorise l'inférence (effort 1 ou 2, "
            "ou l'outil d'inférence dédié) : JDM cherche d'abord le fait, et "
            "s'il est absent, tente de le déduire. Un résultat inféré doit "
            "toujours être présenté comme une déduction (« on peut déduire "
            "que… parce que… »), jamais comme un contenu direct de JDM.\n\n"
            "8. FLUX DE SOUMISSION (proposer des triplets pour JDM) : dès "
            "qu'on te demande de PROPOSER / SUGGÉRER des triplets pour enrichir "
            "JDM, exécute TOUT le flux toi-même, sans t'arrêter en chemin et "
            "sans qu'on ait à te le redemander :\n"
            "  (a) pour chaque couple (terme, relation) que tu vises, "
            "RÉCUPÈRE D'ABORD l'existant via l'outil qui liste les triplets "
            "d'un type donné pour ce terme. C'est ta liste d'EXCLUSION : "
            "inutile de proposer ce qui est déjà dans JDM, tu évites "
            "d'itérer en aveugle ;\n"
            "  (b) propose des triplets candidats NOUVEAUX. Si le terme du "
            "candidat OU sa cible est POLYSÉMIQUE (avocat, souris, police, "
            "chat, livre, sens, vol, glace, …), tu DOIS d'abord lister les "
            "sens avec l'outil de désambiguïsation, CHOISIR toi-même le sens "
            "auquel s'applique ton triplet, et passer le `sense_id` "
            "(raffinement brut, type `avocat>116477>66699`) comme `term` ou "
            "`target` à la vérification — pas la forme générique. La "
            "consolidation tournera sur le sens raffiné que TU as choisi ;\n"
            "  (c) pour CHAQUE candidat (raffiné si nécessaire), appelle "
            "l'outil de vérification de candidat — il fait la validation "
            "structurelle ET la CONSOLIDATION par inférence en un seul "
            "appel ;\n"
            "  (d) un candidat n'est RETENU que si son champ "
            "`ready_for_submission` vaut true (consolidé par inférence) ;\n"
            "  (e) écris la soumission avec l'outil dédié, au format "
            "`terme | relation | cible | annotation < explication >`.\n"
            "La validation structurelle seule (« ok ») NE SUFFIT PAS : ne "
            "déclare JAMAIS un triplet « prêt » sans l'avoir consolidé. La "
            "soumission ne contient QUE les candidats consolidés. L'ANNOTATION "
            "(constitutif, contrastif, probable…) et l'EXPLICATION (la chaîne "
            "d'inférence) sont DEUX champs distincts — ne les confonds pas.\n\n"
            "9. DÉTECTION DE TROUS SANS TERME : si on te demande de détecter "
            "les trous pour UNE RELATION SEULE sans préciser de terme "
            "(ex. « détecte les trous pour r_holo »), c'est À TOI de fournir "
            "le terme : tire un mot français au hasard (vraiment au hasard, "
            "varie les domaines — objets, animaux, métiers, abstractions, "
            "lieux, plantes, aliments, sentiments…), vérifie qu'il existe "
            "dans JDM via l'outil de lookup, lance la détection de trous "
            "dessus. Si le terme n'est pas dans JDM OU si aucun gap "
            "intéressant n'apparaît, RECOMMENCE avec un autre mot — jusqu'à "
            "un résultat exploitable (typiquement ≥ 3 gaps, max 6-8 essais)."
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
