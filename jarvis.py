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


def _norm_relations(rels) -> list[str]:
    """Normalise une entrée 'relations' qui peut être None, str ou liste."""
    if rels is None:
        return []
    if isinstance(rels, str):
        rels = [rels]
    return [str(r).strip() for r in rels if r and str(r).strip()]


def build_enrich_prompt(
    term: str,
    relation=None,
    target_count: int = 10,
    vary_relations: bool = False,
    iterate: bool = False,
    budget_label: str = "25",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt d'enrichissement à partir du formulaire.

    `relation` accepte str (rétro-compat), list ou None.
    """
    term = (term or "").strip()
    rels = _norm_relations(relation)
    bounded = _is_bounded_budget(budget_label)
    parts: list[str] = []
    if term:
        parts.append(f"Je veux ENRICHIR le terme « {term} » dans JDM.")
    else:
        parts.append("Je veux ENRICHIR un terme dans JDM.")
        parts.append(_RANDOM_TERM_INSTRUCTION)
    # Contrainte de portée selon ce que l'utilisateur a fourni :
    #   - term + rels  → tous les triplets ont CE terme et UNE de CES
    #                    relations ; seule la cible varie. (cas A)
    #   - term seul    → CE terme reste fixe ; relation ET cible varient. (cas B)
    #   - rels seules  → CES relations restent fixes ; le terme (source)
    #                    varie pour produire des triplets variés. (cas C)
    #   - rien         → tout est libre, comportement par défaut. (cas D)
    if term and rels:
        rel_str = ", ".join(f"`{r}`" for r in rels)
        parts.append(
            f"⚠️ IMPÉRATIF : tous les triplets proposés DOIVENT avoir "
            f"« {term} » comme SOURCE et l'une des relations {rel_str} "
            "comme PRÉDICAT. Tu varies les CIBLES uniquement. NE propose "
            "AUCUN triplet sur un autre terme ou une autre relation — "
            "même si elles paraissent intéressantes."
        )
    elif term and not rels:
        parts.append(
            f"⚠️ IMPÉRATIF : tous les triplets proposés DOIVENT avoir "
            f"« {term} » comme SOURCE. Tu varies les RELATIONS et les "
            "CIBLES, mais pas le terme."
        )
    elif rels and not term:
        rel_str = ", ".join(f"`{r}`" for r in rels)
        if len(rels) == 1:
            parts.append(
                f"⚠️ IMPÉRATIF : tous les triplets proposés DOIVENT "
                f"utiliser la relation {rel_str} comme PRÉDICAT. Tu "
                "varies les TERMES sources (et les cibles)."
            )
        else:
            parts.append(
                f"⚠️ IMPÉRATIF : tous les triplets proposés DOIVENT "
                f"utiliser l'une des relations {rel_str} comme PRÉDICAT. "
                "Tu varies les TERMES sources (et les cibles)."
            )
    # Cas D (ni term ni rels) : aucune contrainte injectée — l'agent
    # est libre, _RANDOM_TERM_INSTRUCTION (plus haut) suffit pour
    # orienter le tirage.

    if vary_relations and not rels:
        # 'Varier les relations' ne s'applique que si l'utilisateur n'a
        # PAS imposé de relations spécifiques (sinon contradictoire).
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
    relation=None,
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt d'audit à partir du formulaire.

    `relation` accepte str (rétro-compat), list ou None.
    """
    term = (term or "").strip()
    rels = _norm_relations(relation)
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
    if len(rels) == 1:
        parts.append(f"Restreins l'audit à la relation `{rels[0]}`.")
    elif len(rels) > 1:
        parts.append(
            "Restreins l'audit à ces relations : "
            + ", ".join(f"`{r}`" for r in rels) + "."
        )
    else:
        parts.append(
            "Pas de relation imposée : couvre un nombre suffisant de "
            "types de relations (variées) pour faire un audit représentatif."
        )
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
    rels = _norm_relations(relations)
    if rels:
        parts.append(
            "Relations cibles : " + ", ".join(f"`{r}`" for r in rels) + "."
        )
    else:
        parts.append(
            "Pas de relation imposée : choisis-les toi-même (variées, "
            "couvre un nombre suffisant de types)."
        )
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
    relation=None,
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt de signalement à partir du formulaire.

    `relation` accepte str (rétro-compat), list ou None.
    """
    term = (term or "").strip()
    rels = _norm_relations(relation)
    parts: list[str] = []
    if term:
        parts.append(
            f"Je veux SIGNALER les triplets suspects de JDM pour « {term} »."
        )
    else:
        parts.append("Je veux SIGNALER les triplets suspects de JDM pour un terme.")
        parts.append(_RANDOM_TERM_INSTRUCTION)
    if len(rels) == 1:
        parts.append(f"Restreins le scan à la relation `{rels[0]}` seule.")
    elif len(rels) > 1:
        parts.append(
            "Restreins le scan à ces relations : "
            + ", ".join(f"`{r}`" for r in rels) + "."
        )
    else:
        parts.append(
            "Pas de relation imposée : choisis-les toi-même (variées, "
            "couvre un nombre suffisant de types)."
        )
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
    relation=None,
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Compose le pré-prompt de stats à partir du formulaire.

    `relation` accepte str, list ou None. Une seule relation passée →
    mode PAR_RELATION focalisé ; plusieurs → mode PAR_RELATION sur
    chacune ; aucune + terme → mode PAR_TERME (relations choisies par
    le LLM).
    """
    term = (term or "").strip()
    rels = _norm_relations(relation)
    rel_label = (
        f"`{rels[0]}`" if len(rels) == 1
        else (", ".join(f"`{r}`" for r in rels) if rels else "")
    )
    parts: list[str] = []
    if term and rels:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur le terme « {term} », "
            f"RESTREINTES à la/aux relation(s) {rel_label}."
        )
        parts.append(
            "⚠️ Limite-toi STRICTEMENT à cette/ces relation(s) — n'en "
            "examine aucune autre, même par souci de couverture."
        )
    elif term:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur le terme « {term} » "
            "(mode PAR_TERME : couverture relation par relation)."
        )
    elif rels:
        parts.append(
            f"Je veux des STATISTIQUES JDM sur la/les relation(s) "
            f"{rel_label} (mode PAR_RELATION : distribution sur "
            "termes-pivots variés)."
        )
        parts.append(
            "⚠️ Limite-toi STRICTEMENT à cette/ces relation(s) — "
            "n'en examine aucune autre."
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
    # La consigne 'couvre N types' ne s'applique QUE si aucune relation
    # n'est imposée — sinon contradictoire avec la restriction stricte.
    if not rels:
        parts.append(
            "Couvre un nombre SUFFISANT de types de relations (au moins "
            "8-12 différents) — qualité statistique."
        )
    parts.append(
        "Rends DEUX vues complémentaires :\n"
        "  1) TABLEAU par RELATION : une ligne par relation (n_total, "
        "n_pos, n_neg, max_w, min_w, mean_w).\n"
        "  2) TABLEAU par TERMES RENCONTRÉS : agrège les cibles "
        "(targets) toutes relations confondues — top 20 par "
        "occurrence/poids — avec nb_relations_distinctes et "
        "poids_total. Permet de voir quels termes reviennent souvent.\n"
        "Plus 3-5 observations BRÈVES et FACTUELLES après les tableaux."
    )
    if upload:
        parts.append(
            "Soumets directement le fichier `.stat` à JDM (LLMDrops) à "
            "la fin (`write_submission_file(..., upload=True)`)."
        )
    else:
        parts.append(
            "Écris le fichier `.stat` à la fin "
            "(`write_submission_file(..., upload=False)`) — l'utilisateur "
            "décidera ensuite de le soumettre ou non."
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


def _extract_submission_path(tool_message_content: str) -> Optional[str]:
    """Extrait le chemin du fichier produit par write_submission_file.

    Le ToolMessage contient un dict sérialisé en JSON (ou en repr Python).
    On regarde la clé `path`.
    """
    import json
    import re
    if not tool_message_content:
        return None
    try:
        d = json.loads(tool_message_content)
        if isinstance(d, dict) and d.get("path"):
            return str(d["path"])
    except Exception:
        pass
    m = re.search(r"['\"]path['\"]\s*:\s*['\"]([^'\"]+)['\"]", tool_message_content)
    if m:
        return m.group(1)
    return None


def _read_file_preview(path: Optional[str], max_chars: int = 6000) -> str:
    """Lit le contenu d'un fichier produit, tronqué à `max_chars` pour le preview UI."""
    if not path:
        return ""
    try:
        from pathlib import Path
        text = Path(path).read_text(encoding="utf-8")
    except Exception as e:
        return f"⚠️ Impossible de lire {path} : {e}"
    if len(text) > max_chars:
        return text[:max_chars] + f"\n\n… [{len(text) - max_chars} caractères supplémentaires non affichés — télécharge le fichier pour tout voir]"
    return text


def submit_existing_file(
    file_path: Optional[str],
    drops_key: str,
    model_name: str,
    current_chat: Optional[list[dict]] = None,
) -> list[dict]:
    """Soumet un fichier .enrich/.audit/.err déjà produit au LLMDrops JDM.

    À utiliser pour le bouton « 📤 Soumettre » post-hoc des sous-onglets
    Jarvis. Si une clé est fournie côté UI (`drops_key`), elle override
    temporairement `JDM_DROPS_API_KEY` le temps de l'appel.

    Renvoie la liste de messages mise à jour pour le `gr.Chatbot` (append
    d'un message assistant avec le verdict).
    """
    import os
    from jdm_agent.enrich.uploader import submit_to_jdm

    chat = list(current_chat) if current_chat else []

    if not file_path:
        chat.append({
            "role": "assistant",
            "content": "⚠️ Aucun fichier produit à soumettre."
        })
        return chat

    saved = os.environ.get("JDM_DROPS_API_KEY")
    if drops_key and drops_key.strip():
        os.environ["JDM_DROPS_API_KEY"] = drops_key.strip()
    try:
        result = submit_to_jdm(file_path, model_name=(model_name or "").strip() or None)
    finally:
        if drops_key and drops_key.strip():
            if saved is None:
                os.environ.pop("JDM_DROPS_API_KEY", None)
            else:
                os.environ["JDM_DROPS_API_KEY"] = saved

    if result.get("ok"):
        chat.append({
            "role": "assistant",
            "content": (
                f"✅ Fichier soumis à JDM (status {result.get('status_code')}) — "
                f"uploadé sous le nom `{result.get('uploaded_as')}`.\n\n"
                f"Réponse serveur : `{result.get('response')}`"
            )
        })
    else:
        chat.append({
            "role": "assistant",
            "content": f"❌ Échec de soumission : {result.get('error', 'inconnu')}"
        })
    return chat


def has_drops_key(ui_key: str = "") -> bool:
    """True si une clé LLMDrops est disponible (UI override OU env)."""
    import os
    if ui_key and ui_key.strip():
        return True
    return bool(os.environ.get("JDM_DROPS_API_KEY", "").strip())


def run_jarvis_flow(
    prompt: str,
    *,
    headline: str = "",
    model: str,
    api_key: str,
    budget_label: str,
    drops_key: str,
    build_llm_fn,
    build_agent_fn,
    get_client_fn,
) -> Generator[tuple[list[dict], Optional[str], str], None, None]:
    """Générateur qui pilote un agent avec budget pour un sous-onglet
    Jarvis, et yield des tuples (messages_chatbot, file_path, file_preview)
    compatibles avec 3 composants Gradio :
      - `gr.Chatbot(type="messages")`
      - `gr.File`
      - `gr.Code`/`gr.Markdown`/`gr.Textbox`

    Le messaging modèle :
      - message 1 : user → headline court (PAS le prompt complet)
      - message 2 : assistant → contenu progressivement mis à jour
        pendant le streaming (tool calls + résultats partiels + réponse)

    `file_path` reste None jusqu'à ce qu'un `write_submission_file` soit
    détecté dans le stream, puis pointe sur le fichier produit. La 3e
    valeur est le preview texte (lecture tronquée) ou "" si pas de fichier.

    Args:
        prompt        : pré-prompt construit par `build_*_prompt` (envoyé
                        au LLM mais NON affiché à l'utilisateur)
        headline      : résumé court 1-ligne affiché dans la bulle « user »
        model         : modèle LLM
        api_key       : clé visiteur (vide si modèle hébergé Space)
        budget_label  : "10" / "25" / "50" / "100" / "illimité"
        drops_key     : clé LLMDrops (override env)
        build_llm_fn  : `_build_llm` (injection pour éviter import circulaire)
        build_agent_fn: `build_jdm_agent` idem
        get_client_fn : `get_client` idem

    Yields:
        (messages, file_path, file_preview)
    """
    # Bulle user affichée — résumé léger, JAMAIS le prompt technique
    user_display = headline.strip() or "🚀 Demande envoyée."
    import os
    from jdm_agent.tools.budget import budget_context
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    # Override env var pour LLMDrops si une clé est fournie côté UI
    saved_drops_key: Optional[str] = None
    if drops_key and drops_key.strip():
        saved_drops_key = os.environ.get("JDM_DROPS_API_KEY")
        os.environ["JDM_DROPS_API_KEY"] = drops_key.strip()

    last_file_path: Optional[str] = None

    try:
        # LLM + agent
        try:
            llm = build_llm_fn(model, api_key)
        except ValueError as e:
            yield (
                [{"role": "user", "content": user_display},
                 {"role": "assistant", "content": f"⚠️ {e}"}],
                None, "",
            )
            return

        agent = build_agent_fn(client=get_client_fn(), llm=llm)
        limit = BUDGET_LABEL_TO_LIMIT.get(budget_label, 25)

        progress_lines: list[str] = ["*🧠 Réflexion en cours…*"]
        final_answer: str = ""

        # Yield initial : user message + assistant placeholder, pas encore de fichier
        yield (
            [{"role": "user", "content": user_display},
             {"role": "assistant", "content": "\n".join(progress_lines)}],
            None, "",
        )

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
                                    yield (
                                        [{"role": "user", "content": user_display},
                                         {"role": "assistant",
                                          "content": "\n".join(progress_lines)}],
                                        last_file_path, "",
                                    )
                                else:
                                    final_answer = _content_to_text(m.content)
                            elif isinstance(m, ToolMessage):
                                content = _content_to_text(m.content)
                                # Captation du fichier produit par
                                # write_submission_file (.enrich/.audit/.err)
                                if m.name == "write_submission_file":
                                    p = _extract_submission_path(content)
                                    if p:
                                        last_file_path = p
                                preview = content[:120].replace("\n", " ")
                                if len(content) > 120:
                                    preview += "…"
                                progress_lines.append(
                                    f"✓ *{m.name}* renvoie {len(content)} chars : `{preview}`"
                                )
                                yield (
                                    [{"role": "user", "content": user_display},
                                     {"role": "assistant",
                                      "content": "\n".join(progress_lines)}],
                                    last_file_path, "",
                                )
        except Exception as e:
            yield (
                [{"role": "user", "content": user_display},
                 {"role": "assistant", "content": f"❌ Erreur agent : {e}"}],
                last_file_path, _read_file_preview(last_file_path),
            )
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
        yield (
            [{"role": "user", "content": user_display},
             {"role": "assistant", "content": (final_answer or "*(réponse vide)*") + footer}],
            last_file_path, _read_file_preview(last_file_path),
        )
    finally:
        # Restore env var si on l'avait modifiée
        if drops_key and drops_key.strip():
            if saved_drops_key is None:
                os.environ.pop("JDM_DROPS_API_KEY", None)
            else:
                os.environ["JDM_DROPS_API_KEY"] = saved_drops_key
