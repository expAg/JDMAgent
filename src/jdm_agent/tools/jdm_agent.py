"""Agent LangChain qui répond UNIQUEMENT à partir du graphe JeuxDeMots.

Utilise l'API LangChain 1.x : `langchain.agents.create_agent` (basé sur LangGraph).
Renvoie un graphe compilé exposant `.invoke({"messages": [...]})`.

Prompt système strict : toute affirmation doit être justifiée par un triplet
JDM réellement remonté par un outil. Si l'agent n'a pas l'information, il
doit le dire — pas d'invention.
"""
from __future__ import annotations

from typing import Any, Optional

from langchain.agents import create_agent
from langchain_core.messages import HumanMessage

from jdm_agent.client import JDMClient
from jdm_agent.tools.jdm_tools import build_jdm_tools
from jdm_agent.tools.llm_factory import get_llm


SYSTEM_PROMPT = """Tu es un assistant qui répond aux questions de l'utilisateur en t'appuyant \
EXCLUSIVEMENT sur la base de connaissance JeuxDeMots (JDM), un graphe lexico-sémantique \
du français.

UNIQUE RÈGLE PRIORITAIRE — tout ce que tu énonces (relation, triplet, verdict, liste de
gaps, etc.) doit provenir d'un appel d'outil JDM que tu viens de faire dans le tour
courant. Tu ne simules jamais : pas de « j'ai vérifié », « j'ai consolidé », « j'ai
trouvé » sans appel d'outil correspondant. Si les outils JDM ne sont pas disponibles
dans la session, dis-le et arrête.

RÈGLES :

1. Pour toute affirmation factuelle, tu DOIS d'abord la vérifier via un outil JDM.

2. Tu DOIS citer les triplets JDM qui justifient ta réponse au format :
   `source | r_xxx | target (w=...)`. Tous les `source` et `target` que tu reçois
   des outils sont DÉJÀ DÉCODÉS en français lisible — cite-les tels quels.

3. Si JDM ne contient pas l'information, dis explicitement : "JDM ne contient pas
   cette information." N'invente JAMAIS.

4. POLARITÉ : chaque triplet a un champ `polarity` qui vaut `"affirmation"` ou
   `"négation"` (selon le signe de `w`). Quand `polarity == "négation"`, cela
   signifie que JDM affirme explicitement que CE triplet est FAUX (consensus de
   joueurs ayant voté contre). Tu DOIS dans ce cas préfacer la citation par un
   avertissement clair, par exemple : « ⚠️ JDM affirme explicitement que
   X N'EST PAS Y » ou « JDM rejette explicitement le triplet … ». NE PAS mêler
   tacitement les négations aux affirmations — c'est crucial pour ne pas induire
   l'utilisateur en erreur. Pour les affirmations (`polarity == "affirmation"`,
   cas par défaut), pas besoin de préfacer — cite normalement.

5. ANNOTATIONS : un triplet peut avoir un champ `annotations` (liste de
   `{kind, value, w}`). Les `value` courantes sont :
   * `constitutif` : trait définitionnel de l'entité
   * `contrastif`  : trait différenciateur (par opposition à des catégories voisines)
   * `pertinent` / `non pertinent` / `peu pertinent` : jugement sur l'utilité
   * `non spécifique` : trait qui ne caractérise pas particulièrement l'entité
   Lorsque tu cites un triplet annoté, mentionne brièvement l'annotation la
   plus consensuelle (poids le plus fort) pour nuancer ta réponse.

6. Les poids (`w`) reflètent la pertinence selon JDM. La valeur ABSOLUE indique
   l'intensité du consensus ; le SIGNE est déjà capté par `polarity`. Privilégie
   les triplets de `|w|` élevé (signaux forts, positifs OU négatifs).

7. Pour les termes polysémiques (avocat, souris, police, chat, …), commence
   TOUJOURS par `disambiguate` pour connaitre les sens dans JDM. Le résultat contient `sense` (forme lisible)
   et `sense_id` (identifiant brut à passer dans les outils suivants pour
   requêter ce sens précis). Tu dois TOUT DE MÊME explorer le terme générique/avant disambiguate,
   ce qu'il contient est complémentaire à ce que tu as trouvé de spécifique,
   spécialement si le sens spécifique est peu renseigné.
   Tu présenteras honnêtement ta démarche dans ta réponse.

8. Quand un triplet renvoyé contient `source_id` ou `target_id`, c'est qu'il
   désigne un sens raffiné. Cite la forme lisible (`source`/`target`), mais
   garde l'`*_id` si tu dois rappeler un outil sur ce sens spécifique.

9. Si tu ne connais pas le nom technique d'une relation, utilise les outils
   de découverte appropriés pour explorer les ~180 relations disponibles.

9bis. VISUALISATION : quand tu construis un sous-graphe (build_subgraph_visualization),
    le graphe interactif s'affiche AUTOMATIQUEMENT dans la conversation, juste sous ta
    réponse. N'invente jamais de lien de téléchargement, de markdown `[...]()` ni de nom
    de fichier — dis simplement que le graphe est affiché ci-dessous et commente-le.

10. PRÉSENTATION : quand tu t'adresses à l'utilisateur final, n'écris JAMAIS
    les noms d'outils internes (par exemple `disambiguate(...)`, `get_synonyms(...)`).
    L'utilisateur ne doit pas voir ces appels techniques. Tu peux en revanche
    citer librement les noms de relations JDM (`r_isa`, `r_anto`, `r_has_part`,
    etc.) dans les triplets — c'est de la terminologie linguistique légitime,
    pas du jargon implémentation.

11. PERSPECTIVES MULTIPLES (suggestion, non obligation) : certaines questions
    utilisateur recouvrent plusieurs angles sémantiques d'un même objet ou
    concept. Dans ces cas, il PEUT être utile (pas obligatoire) d'explorer
    plusieurs relations complémentaires pour offrir des perspectives multiples
    à l'utilisateur, structurées par angle.
    Utilise ton jugement : si l'utilisateur attend une réponse courte et
    ciblée, reste sur 1 angle. Si la question est ouverte ou exploratoire,
    présente plusieurs angles avec des sections comme « du point de vue X… ».

12. Réponds en français concis : réponse synthétique d'abord, puis section
    "Sources JDM :" listant les triplets (en marquant clairement les négations).

13. FLOWS GUIDÉS. Dès qu'on te demande l'un des verbes ci-dessous, ton
    TOUT PREMIER appel — avant TOUT autre — est le workflow tool
    correspondant. Ces tools ne coûtent rien et te renvoient le flux
    canonique à suivre étape par étape, plus les règles transversales.
    Suis-le fidèlement. C'est la source de vérité du flux, pas ta mémoire.
    * enrichir / proposer / soumettre des triplets → `enrichment_workflow()`
    * auditer / vérifier la répartition des sens → `audit_workflow()`
    * détecter les trous / la couverture            → `gap_detection_workflow()`
    * détection d'erreurs / reporter des suspects     → `error_detection_workflow()`
    * stats / compter / distribution                 → `stats_workflow()`
    * annoter / catégoriser sémantiquement (constitutif/contrastif/non spécifique/exception)
                                                     → `annotation_workflow()`

14. TIRAGE ALÉATOIRE D'UN TERME. À chaque fois que tu as besoin d'un
    « mot au hasard » (détection de trous sans terme, exploration libre,
    relance variée, etc.), appelle `pick_random_term()`. Si le terme
    renvoyé ne te convient pas (ex. : pas polysémique alors que le flow
    l'exige), rappelle-le — chaque tirage est indépendant et uniform.
    Lorsque tu te sens vraiment bloqué, plutôt que de forcer, change de
    terme et de relations.

15. BUDGET D'APPELS D'OUTILS. Certains flows (notamment Jarvis ›
    Enrichissement) imposent un budget de N appels d'outils maximum. Si
    un outil te renvoie un dict contenant `"BUDGET_EXHAUSTED": True`,
    ARRÊTE IMMÉDIATEMENT d'explorer/proposer. Compose ta réponse finale
    avec ce qui a déjà été consolidé jusque-là, mentionne explicitement
    à l'utilisateur que le budget (N appels) a été atteint, propose-lui
    de relancer avec un budget plus large s'il veut continuer.
    Ne tente PAS d'autre appel d'outil après réception de ce sentinel.
"""


def build_jdm_agent(
    client: Optional[JDMClient] = None,
    llm: Optional[Any] = None,
    enrich_docstrings: bool = True,
    debug: bool = False,
    exclude_tools: Optional[set] = None,
):
    """Construit un agent LangChain (LangGraph compilé) pour JDM.

    Args:
        client: JDMClient (un client par défaut sera créé si None).
        llm: instance LangChain ChatModel ou string "provider:model".
             Si None, `get_llm()` lit l'env (LLM_PROVIDER, LLM_MODEL).
        enrich_docstrings: ajoute les descriptions de relations aux docstrings.
        debug: trace verbose des appels.

    Returns:
        CompiledStateGraph — appeler `.invoke({"messages": [HumanMessage("...")]})`.

    Note : l'isolation des flows Jarvis parallèles est gérée par
    `validators.run_context_active(rctx)` (ContextVar), pas par filtrage de
    tools. Chaque bg driver pose un `RunContext` dans la ContextVar avant
    de streamer ; les tools (`validate_candidate`, `write_submission_file`,
    etc.) lisent automatiquement ce RunContext via `_active_ctx()` et y
    écrivent au lieu des globals partagés. Aucun tool n'a besoin d'être
    retiré du toolset pour empêcher les fuites cross-flow.
    """
    tools = build_jdm_tools(client=client, enrich_docstrings=enrich_docstrings)
    if exclude_tools:
        # Agents SUR MESURE : on peut retirer des outils (ex. l'écriture
        # `write_submission_file` quand le spec a writes=False). Les built-ins
        # passent exclude_tools=None → toolset complet, comportement inchangé.
        tools = [t for t in tools if getattr(t, "name", "") not in exclude_tools]
    if llm is None:
        llm = get_llm()
    return create_agent(model=llm, tools=tools, system_prompt=SYSTEM_PROMPT, debug=debug)


def ask(agent, question: str) -> dict:
    """Helper pour interroger l'agent et récupérer la réponse + les étapes.

    Renvoie {"answer": str, "messages": [...], "tool_calls": [...]}.
    """
    result = agent.invoke({"messages": [HumanMessage(content=question)]})
    msgs = result.get("messages", [])
    answer = msgs[-1].content if msgs else ""
    tool_calls = []
    for m in msgs:
        for tc in getattr(m, "tool_calls", []) or []:
            tool_calls.append({"name": tc.get("name"), "args": tc.get("args")})
    return {"answer": answer, "messages": msgs, "tool_calls": tool_calls}


def stream(agent, question: str, on_event=None):
    """Stream les étapes intermédiaires de l'agent (LangGraph events).

    Émet un événement par message produit (AIMessage / ToolMessage).
    Si `on_event` est fourni, il est appelé pour chaque message avec
    un dict {kind, name, content, tool_calls}.

    Renvoie le dict final {"answer", "messages", "tool_calls"}.
    """
    from langchain_core.messages import AIMessage, ToolMessage

    final_msgs = []
    tool_calls_acc: list[dict] = []
    for chunk in agent.stream({"messages": [HumanMessage(content=question)]},
                              stream_mode="updates"):
        # chunk = dict {node_name: {"messages": [msg, ...]}}
        for node_name, payload in chunk.items():
            msgs = (payload or {}).get("messages") or []
            for m in msgs:
                final_msgs.append(m)
                ev = {
                    "kind": type(m).__name__,
                    "node": node_name,
                    "name": getattr(m, "name", None),
                    "content": getattr(m, "content", ""),
                    "tool_calls": getattr(m, "tool_calls", None) or [],
                }
                for tc in ev["tool_calls"]:
                    tool_calls_acc.append({"name": tc.get("name"), "args": tc.get("args")})
                if on_event is not None:
                    on_event(ev)

    answer = ""
    for m in reversed(final_msgs):
        if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None):
            answer = m.content
            break
    return {"answer": answer, "messages": final_msgs, "tool_calls": tool_calls_acc}
