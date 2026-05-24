"""Helpers Jarvis (Phase 13) — construction de pré-prompts à partir
de formulaires UI + exécution de flows agent avec budget.

Pour ne pas surcharger app.py, on isole ici :
  - les fonctions `build_*_prompt(form_values)` qui composent le
    texte d'entrée envoyé à l'agent à partir des champs du formulaire
  - le générateur `run_jarvis_flow(prompt, model, api_key, budget_limit,
    drops_key)` qui pilote l'agent en mode streaming dans une bulle
    de chatbot Gradio (sans saisie utilisateur)

L'agent lui-même est inchangé — c'est juste le harnais d'invocation
qui change : (a) on lui injecte un budget via `budget_context`, (b) on
lui passe un message utilisateur construit du formulaire, (c) on
streame ses étapes dans le Chatbot.
"""
from __future__ import annotations

from typing import Any, Generator, Optional


def _content_to_text(content: Any) -> str:
    """Normalise un `AIMessage.content` LangChain en string plate.

    Selon le provider (Anthropic vs Gemini natif vs OpenAI), `m.content`
    peut être :
      - une str directe (cas le plus simple)
      - une liste de blocs dict {type, text, ...} (Anthropic, Gemini SDK
        natif quand reasoning_summary ou multimodal)
      - une liste de str (rare)
      - None (cas vide)
    On extrait toujours une str finale concatenable.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Bloc de type {"type": "text", "text": "..."} (Anthropic)
                # ou {"text": "..."} (Gemini), ou autre — on essaye "text".
                txt = block.get("text")
                if isinstance(txt, str):
                    parts.append(txt)
        return "".join(parts)
    # Cas pathologique : on tente str() en garde-fou
    return str(content)


# ---------- Construction des pré-prompts ----------

def _is_bounded_budget(budget_label: str) -> bool:
    """True si le label correspond à une limite finie (et donc qu'il
    faut prévenir le LLM du sentinel BUDGET_EXHAUSTED). Évite de
    polluer le prompt quand l'utilisateur a choisi 'illimité'."""
    if not budget_label:
        return False
    s = str(budget_label).strip().lower()
    if s in ("illimité", "illimite", "unlimited", "none", "0", ""):
        return False
    return s.isdigit() and int(s) > 0


_RANDOM_TERM_INSTRUCTION = (
    "Je n'ai pas précisé de terme — TIRE toi-même un mot français au "
    "hasard et VARIÉ (varie domaine, registre, longueur, niveau "
    "d'abstraction d'un essai à l'autre et d'une session à l'autre). "
    "Évite les taxonomies scolaires (animaux, plantes) où JDM est "
    "déjà dense. Vérifie d'abord qu'il existe via `lookup_term` ; "
    "si non, recommence avec un autre — jusqu'à un terme exploitable."
)


def build_enrich_prompt(
    term: str,
    relation: str = "",
    target_count: int = 10,
    vary_relations: bool = False,
    iterate: bool = False,
    budget_label: str = "25",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt d'enrichissement à partir du formulaire."""
    term = (term or "").strip()
    relation = (relation or "").strip()
    bounded = _is_bounded_budget(budget_label)
    parts: list[str] = []
    if term:
        parts.append(f"Je veux ENRICHIR le terme « {term} » dans JDM.")
    else:
        parts.append("Je veux ENRICHIR un terme dans JDM.")
        parts.append(_RANDOM_TERM_INSTRUCTION)
    if relation:
        parts.append(f"Relation cible prioritaire : `{relation}`.")
    if vary_relations:
        parts.append(
            "Varie explicitement les TYPES de relations explorées — "
            "pas une seule, plusieurs angles."
        )
    parts.append(
        f"Objectif : produire {int(target_count)} triplets candidats "
        "CONSOLIDÉS (ready_for_submission=true)."
    )
    if iterate:
        if bounded:
            parts.append(
                "Itère jusqu'à atteindre le nombre cible — sauf si le "
                "budget d'appels d'outils est épuisé, auquel cas rends "
                "proprement ce qui a déjà été consolidé."
            )
        else:
            parts.append("Itère jusqu'à atteindre le nombre cible.")
    if bounded:
        parts.append(
            f"Budget : {budget_label} appels d'outils maximum. Au-delà, "
            "tu recevras un sentinel BUDGET_EXHAUSTED — arrête alors "
            "immédiatement et compose ta réponse finale avec ce qui est "
            "déjà consolidé."
        )
    if upload:
        parts.append(
            "Soumets directement le fichier d'enrichissement au "
            "endpoint LLMDrops à la fin (write_submission_file avec "
            "upload=True). La clé est dans l'env JDM_DROPS_API_KEY."
        )
    else:
        parts.append(
            "Écris le fichier d'enrichissement à la fin "
            "(write_submission_file SANS upload=True) — l'utilisateur "
            "décidera ensuite de le soumettre ou non."
        )
    parts.append(
        "Tu SUIVRAS `enrichment_workflow()` en TOUT PREMIER pour le "
        "flux canonique — c'est obligatoire."
    )
    return "\n".join(parts)


def build_audit_prompt(
    term: str,
    relation: str = "",
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt d'audit à partir du formulaire."""
    term = (term or "").strip()
    relation = (relation or "").strip()
    parts: list[str] = []
    if term:
        parts.append(f"Je veux AUDITER le terme « {term} » dans JDM.")
    else:
        parts.append(
            "Je veux AUDITER un terme POLYSÉMIQUE dans JDM (chercher des "
            "contaminations du générique par des sens non-premiers)."
        )
        parts.append(_RANDOM_TERM_INSTRUCTION + (
            " IMPORTANT : pour l'audit, le terme tiré doit être "
            "POLYSÉMIQUE (plusieurs sens dans disambiguate) ; sinon "
            "retire un autre mot."
        ))
    if relation:
        parts.append(f"Restreins l'audit à la relation `{relation}`.")
    if _is_bounded_budget(budget_label):
        parts.append(
            f"Budget : {budget_label} appels d'outils maximum. Au-delà, "
            "arrête et compose ta synthèse avec ce que tu as déjà examiné."
        )
    if upload:
        parts.append("Soumets ensuite le fichier .audit à JDM (LLMDrops).")
    else:
        parts.append(
            "Écris le fichier .audit (sans upload) — l'utilisateur "
            "décidera ensuite de la soumission."
        )
    parts.append(
        "Tu SUIVRAS `audit_workflow()` en TOUT PREMIER. C'est obligatoire."
    )
    return "\n".join(parts)


def build_gap_prompt(
    term: str,
    relations: Optional[list[str]] = None,
    budget_label: str = "25",
) -> str:
    """Compose le pré-prompt de détection de trous à partir du formulaire."""
    term = (term or "").strip()
    parts: list[str] = []
    if term:
        parts.append(f"Je veux DÉTECTER les trous de JDM pour le terme « {term} ».")
    else:
        parts.append("Je veux DÉTECTER les trous de JDM pour un terme.")
        parts.append(_RANDOM_TERM_INSTRUCTION)
    if relations:
        rels = ", ".join(f"`{r}`" for r in relations if r)
        parts.append(f"Relations cibles : {rels}.")
    else:
        parts.append("Pas de relation imposée : choisis-les toi-même (variées).")
    if _is_bounded_budget(budget_label):
        parts.append(
            f"Budget : {budget_label} appels d'outils maximum."
        )
    parts.append(
        "Pour chaque gap identifié, propose explicitement les 3 actions "
        "(Enrichir / Auditer / Stats) avec le format `term | relation | "
        "type_de_gap` pour que je puisse les router."
    )
    parts.append(
        "Tu SUIVRAS `gap_detection_workflow()` en TOUT PREMIER. Obligatoire."
    )
    return "\n".join(parts)


def build_signalement_prompt(
    term: str,
    relation: str = "",
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt de signalement à partir du formulaire."""
    term = (term or "").strip()
    relation = (relation or "").strip()
    parts: list[str] = []
    if term:
        parts.append(
            f"Je veux SIGNALER les triplets suspects de JDM pour « {term} »."
        )
    else:
        parts.append("Je veux SIGNALER les triplets suspects de JDM pour un terme.")
        parts.append(_RANDOM_TERM_INSTRUCTION)
    if relation:
        parts.append(f"Restreins le scan à la relation `{relation}` seule.")
    else:
        parts.append("Pas de relation imposée : choisis-les toi-même (variées).")
    parts.append(
        "Utilise TON JUGEMENT linguistique de francophone — pas besoin "
        "de vérifier chaque suspect par un outil, ta suspicion vaut. "
        "Suis la grille de signaux du workflow (sémantiques + structurels)."
    )
    if _is_bounded_budget(budget_label):
        parts.append(
            f"Budget : {budget_label} appels d'outils maximum. Limite à ~20 "
            "suspects max pour éviter le bruit."
        )
    else:
        parts.append("Limite à ~20 suspects max pour éviter le bruit.")
    if upload:
        parts.append("Soumets ensuite le fichier .err à JDM (LLMDrops).")
    else:
        parts.append("Écris le fichier .err sans upload.")
    parts.append(
        "Tu SUIVRAS `signalement_workflow()` en TOUT PREMIER. Obligatoire."
    )
    return "\n".join(parts)


def build_stats_prompt(
    term: str = "",
    relation: str = "",
    budget_label: str = "50",
) -> str:
    """Compose le pré-prompt de stats à partir du formulaire.

    `term` seul → mode PAR_TERME. `relation` seule → mode PAR_RELATION.
    Les deux → fait les deux.
    """
    term = (term or "").strip()
    relation = (relation or "").strip()
    parts: list[str] = []
    if term and relation:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur le terme « {term} » et "
            f"sur la relation `{relation}` (deux modes en séquence)."
        )
    elif term:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur le terme « {term} » "
            "(mode PAR_TERME : couverture relation par relation)."
        )
    elif relation:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur la relation `{relation}` "
            "(mode PAR_RELATION : distribution sur termes-pivots variés)."
        )
    else:
        parts.append(
            "Je veux des STATISTIQUES JDM mais je n'ai pas précisé "
            "le terme ni la relation — exécute le mode PAR_TERME sur "
            "un terme tiré au hasard."
        )
        parts.append(_RANDOM_TERM_INSTRUCTION)
    if _is_bounded_budget(budget_label):
        parts.append(
            f"Budget : {budget_label} appels d'outils maximum."
        )
    parts.append(
        "Rends une synthèse structurée : un tableau machine-lisible "
        "(une ligne par relation avec n_total, n_pos, n_neg, max_w, "
        "min_w, mean_w) ET 3-5 observations clés en prose."
    )
    parts.append(
        "Tu SUIVRAS `stats_workflow()` en TOUT PREMIER. Obligatoire."
    )
    return "\n".join(parts)


# ---------- Exécution de flow agent (avec budget) ----------

# Mapping label dropdown → limite numérique. `"illimité"` → None.
BUDGET_LABEL_TO_LIMIT: dict[str, Optional[int]] = {
    "10": 10, "25": 25, "50": 50, "100": 100, "illimité": None,
}


def run_jarvis_flow(
    prompt: str,
    *,
    model: str,
    api_key: str,
    budget_label: str,
    drops_key: str,
    build_llm_fn,
    build_agent_fn,
    get_client_fn,
) -> Generator[list[dict], None, None]:
    """Générateur qui pilote un agent avec budget pour un sous-onglet
    Jarvis, et yield des listes de messages compatibles avec
    `gr.Chatbot(type="messages")`.

    Le messaging modèle :
      - message 1 : user → le pré-prompt construit par le formulaire
      - message 2 : assistant → contenu progressivement mis à jour
        pendant le streaming (tool calls + résultats partiels + réponse)

    Args:
        prompt        : pré-prompt construit par `build_*_prompt`
        model         : modèle LLM (clé GEMINI_MODELS ou nom Anthropic/OpenAI)
        api_key       : clé visiteur Anthropic/OpenAI (vide si Gemini hébergé)
        budget_label  : "10" / "25" / "50" / "100" / "illimité"
        drops_key     : clé LLMDrops (override env), passée via os.environ pour
                        que `submit_to_jdm` la voie quand `upload=True` est utilisé
        build_llm_fn  : `_build_llm` (injection pour éviter import circulaire)
        build_agent_fn: `build_jdm_agent` idem
        get_client_fn : `get_client` idem

    Yields:
        list de dicts {role, content} pour chaque chunk de streaming.
    """
    import os
    from jdm_agent.tools.budget import budget_context
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    # Override env var pour LLMDrops si une clé est fournie côté UI
    saved_drops_key: Optional[str] = None
    if drops_key and drops_key.strip():
        saved_drops_key = os.environ.get("JDM_DROPS_API_KEY")
        os.environ["JDM_DROPS_API_KEY"] = drops_key.strip()

    try:
        # LLM + agent
        try:
            llm = build_llm_fn(model, api_key)
        except ValueError as e:
            yield [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"⚠️ {e}"},
            ]
            return

        agent = build_agent_fn(client=get_client_fn(), llm=llm)
        limit = BUDGET_LABEL_TO_LIMIT.get(budget_label, 25)

        progress_lines: list[str] = ["*🧠 Réflexion en cours…*"]
        final_answer: str = ""

        # Yield initial : user message + assistant placeholder
        yield [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": "\n".join(progress_lines)},
        ]

        try:
            with budget_context(limit=limit) as budget:
                for chunk in agent.stream(
                    {"messages": [HumanMessage(content=prompt)]},
                    stream_mode="updates",
                ):
                    # chunk = dict {node_name: {"messages": [msg, ...]}}
                    for _node, payload in chunk.items():
                        msgs = (payload or {}).get("messages") or []
                        for m in msgs:
                            if isinstance(m, AIMessage):
                                tcs = getattr(m, "tool_calls", []) or []
                                if tcs:
                                    for tc in tcs:
                                        args = ", ".join(
                                            f"{k}={v!r}"
                                            for k, v in (tc.get("args") or {}).items()
                                        )
                                        progress_lines.append(
                                            f"🔧 `{tc['name']}({args})`"
                                        )
                                    yield [
                                        {"role": "user", "content": prompt},
                                        {"role": "assistant",
                                         "content": "\n".join(progress_lines)},
                                    ]
                                else:
                                    final_answer = _content_to_text(m.content)
                            elif isinstance(m, ToolMessage):
                                content = _content_to_text(m.content)
                                preview = content[:120].replace("\n", " ")
                                if len(content) > 120:
                                    preview += "…"
                                progress_lines.append(
                                    f"✓ *{m.name}* renvoie {len(content)} chars : `{preview}`"
                                )
                                yield [
                                    {"role": "user", "content": prompt},
                                    {"role": "assistant",
                                     "content": "\n".join(progress_lines)},
                                ]
        except Exception as e:
            yield [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"❌ Erreur agent : {e}"},
            ]
            return

        # Réponse finale : on remplace les progress_lines par la réponse
        # définitive du modèle, suivie d'un footer avec compteur (limite
        # n'est mentionnée que si elle est bornée).
        n = budget.count
        if budget.limit:
            footer = (
                f"\n\n---\n*Budget : {n} appel{'s' if n > 1 else ''} "
                f"d'outils consommé{'s' if n > 1 else ''} / {budget.limit}.*"
            )
            if budget.exhausted:
                footer += " ⚠️ **Budget atteint** — relance avec un budget plus large si besoin."
        else:
            footer = (
                f"\n\n---\n*Budget illimité — {n} appel{'s' if n > 1 else ''} "
                f"d'outils consommé{'s' if n > 1 else ''}.*"
            )
        yield [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": (final_answer or "*(réponse vide)*") + footer},
        ]
    finally:
        # Restore env var si on l'avait modifiée
        if drops_key and drops_key.strip():
            if saved_drops_key is None:
                os.environ.pop("JDM_DROPS_API_KEY", None)
            else:
                os.environ["JDM_DROPS_API_KEY"] = saved_drops_key
