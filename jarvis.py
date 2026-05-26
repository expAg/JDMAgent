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
    """Normalise un `AIMessage.content` LangChain en string plate
    (TEXTE PARLÉ uniquement, exclut les blocs thinking/reasoning).

    Selon le provider (Anthropic vs Gemini natif vs OpenAI), `m.content`
    peut être :
      - une str directe (cas le plus simple)
      - une liste de blocs dict {type, text, ...} (Anthropic, Gemini SDK
        natif quand reasoning_summary ou multimodal)
      - une liste de str (rare)
      - None (cas vide)
    On extrait UNIQUEMENT les blocs de type 'text' — pas les blocs
    'thinking'/'reasoning' (cf. `_content_to_thoughts` pour ça).
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
                # On accepte UNIQUEMENT les blocs text (pas thinking).
                btype = block.get("type")
                if btype in (None, "text"):
                    txt = block.get("text")
                    if isinstance(txt, str):
                        parts.append(txt)
        return "".join(parts)
    # Cas pathologique : on tente str() en garde-fou
    return str(content)


def _content_to_thoughts(content: Any) -> str:
    """Extrait UNIQUEMENT le chain-of-thought / raisonnement exposé
    par le modèle dans `AIMessage.content`.

    Reconnaît les deux formats coexistant dans LangChain :
      - {"type": "thinking", "thinking": "..."}    (Anthropic Extended
        Thinking, Gemini langchain-google-genai v0)
      - {"type": "reasoning", "reasoning": "..."} (OpenAI o1/o3,
        Gemini langchain-google-genai v1, standard LangChain Core 1.0)

    Renvoie "" si pas de thinking exposé (cas normal pour les modèles
    sans thinking, ou Gemini sans `include_thoughts=True`).
    """
    if content is None or isinstance(content, str):
        return ""
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "thinking":
            txt = block.get("thinking")
            if isinstance(txt, str) and txt.strip():
                parts.append(txt)
        elif btype == "reasoning":
            txt = block.get("reasoning")
            if isinstance(txt, str) and txt.strip():
                parts.append(txt)
    return "\n".join(parts)


# ---------- Narration lexicalisée des appels d'outils Jarvis ----------
# Pour les outils utilisés couramment dans les flux Jarvis, on remplace
# l'affichage technique « 🔧 tool_name(args) » par une phrase en français
# plus lisible. Fallback : si l'outil n'est pas dans la table, on garde
# l'affichage technique actuel (zéro régression sur les ~30 autres outils).
#
# Chaque entrée : {"start": fn(args)->str, "done": fn(result_str)->str}
# - `start` : phrase affichée AVANT l'exécution du tool (sur le tool_call)
# - `done`  : phrase affichée APRÈS (sur le ToolMessage de retour)
# Si une fn lève une exception, on fait gracieusement fallback.

def _truncate(s: str, n: int = 60) -> str:
    s = str(s or "").strip()
    return s if len(s) <= n else s[:n - 1] + "…"


def strip_thinking_blocks(messages: list, keep_last: bool = True) -> list:
    """Filtre les blocs « thinking » / « reasoning » des AIMessage list-content.

    Gemini 3.x avec `include_thoughts=True` produit un content sous forme
    de liste `[{"type":"thinking", ...}, {"type":"text", ...}, ...]`.
    Ces résumés de raisonnement coûtent 30-50% des tokens accumulés et
    ne sont PAS nécessaires pour que l'agent continue son travail —
    seuls les tool_calls et tool results comptent pour la continuité
    d'action.

    `keep_last=True` : garde le DERNIER bloc thinking de la session,
    pour préserver le `thought_signature` que Gemini 3.x utilise entre
    tours (sans quoi l'API peut rejeter le retour des tool_calls
    enchaînés).
    """
    if not messages:
        return messages

    # Trouver l'index du dernier AIMessage avec un thinking block
    last_thinking_idx = -1
    if keep_last:
        for i, m in enumerate(messages):
            content = getattr(m, "content", None)
            if not isinstance(content, list):
                continue
            for blk in content:
                if isinstance(blk, dict) and blk.get("type") in ("thinking", "reasoning"):
                    last_thinking_idx = i
                    break

    out: list = []
    for i, m in enumerate(messages):
        content = getattr(m, "content", None)
        if not isinstance(content, list):
            out.append(m)
            continue
        if i == last_thinking_idx:
            out.append(m)  # garder tel quel pour la signature
            continue
        # Filtrer
        filtered = [
            blk for blk in content
            if not (isinstance(blk, dict) and blk.get("type") in ("thinking", "reasoning"))
        ]
        if filtered == content:
            out.append(m)
            continue
        # Reconstruire (pydantic v2 model_copy)
        try:
            out.append(m.model_copy(update={"content": filtered}))
        except Exception:
            out.append(m)  # fallback : on garde tel quel si copy échoue
    return out


def build_relance_summary(messages: list, n_done: int, target: int,
                          relance_num: int,
                          max_relances: Optional[int] = None) -> str:
    """Construit un résumé condensé pour le HumanMessage de relance.

    Au lieu de ré-injecter `accumulated_messages` complet (50-200 messages,
    explosion des tokens), on liste :
      - les triplets déjà CONSOLIDÉS (à préserver)
      - les cibles déjà testées en échec (à ne pas reproposer, top 20)
      - les couples (term, relation) déjà pré-fetchés
    Le LLM reçoit cette synthèse + l'instruction « continue » et reprend
    avec un brief propre, sans bagage cognitif.
    """
    consolidated: list[str] = []
    failed: list[str] = []
    prefetched: set[str] = set()

    for m in messages:
        name = getattr(m, "name", None) or ""
        content_str = str(getattr(m, "content", "") or "")
        parsed = _parse_tool_result(content_str)
        if not isinstance(parsed, dict):
            continue
        if name == "validate_candidate":
            t = parsed.get("term") or "?"
            r = parsed.get("relation") or "?"
            tg = parsed.get("target") or "?"
            triplet = f"{t} | {r} | {tg}"
            if parsed.get("ready_for_submission") is True or parsed.get("consolidation_status") == "consolidated":
                consolidated.append(triplet)
            else:
                failed.append(triplet)
        elif name == "list_existing_for_enrichment":
            t = parsed.get("term")
            r = parsed.get("relation")
            if t and r:
                prefetched.add(f"{t} | {r}")

    lines = [
        f"⛔ STOP. Tu as consolidé **{n_done}/{target}** triplet(s) — il en manque "
        f"{target - n_done}.",
    ]
    if consolidated:
        lines.append("")
        lines.append("**Déjà consolidés (PRÉSERVE-les dans le fichier final)** :")
        for c in consolidated:
            lines.append(f"  ✅ {c}")
    if failed:
        lines.append("")
        lines.append("**Cibles déjà testées sans succès** (NE PAS reproposer) :")
        cap = 20
        for f in failed[:cap]:
            lines.append(f"  ⏸️ {f}")
        if len(failed) > cap:
            lines.append(f"  … (+ {len(failed) - cap} autres)")
    if prefetched:
        lines.append("")
        lines.append("**Pré-fetchs déjà effectués** (ne PAS rappeler "
                     "`list_existing_for_enrichment` dessus, le registre "
                     "côté Python te court-circuitera) :")
        for p in sorted(prefetched):
            lines.append(f"  📥 {p}")
    lines.append("")
    lines.append(
        f"RECOMMENCE avec de NOUVEAUX candidats sur d'AUTRES relations / "
        f"d'AUTRES cibles. Ne rends ta réponse finale QU'APRÈS avoir "
        f"atteint le compte cible. (Relance auto {relance_num}"
        + (f"/{max_relances}" if max_relances is not None else "") + ".)"
    )
    return "\n".join(lines)


def count_consolidated_in_messages(messages: list) -> int:
    """Compte les triplets consolidés en parcourant les ToolMessages
    `validate_candidate` accumulés pendant l'invocation agent.

    Un triplet est compté comme consolidé si le retour contient soit
    `ready_for_submission=True`, soit `consolidation_status="consolidated"`.
    Robuste aux différents formats de sérialisation (JSON / Python repr).
    """
    n = 0
    for m in messages:
        name = getattr(m, "name", None) or ""
        if name != "validate_candidate":
            continue
        content = getattr(m, "content", "") or ""
        parsed = _parse_tool_result(str(content))
        if not isinstance(parsed, dict):
            continue
        if parsed.get("ready_for_submission") is True:
            n += 1
        elif parsed.get("consolidation_status") == "consolidated":
            n += 1
    return n


def is_invalid_api_key(exc) -> bool:
    """Détecte une clé API invalide (typo, révoquée, jamais activée
    pour Gemini, etc.). Google renvoie alors 400 INVALID_ARGUMENT avec
    `reason: 'API_KEY_INVALID'`. À traiter comme exclusion permanente
    (la clé ne deviendra pas valide en attendant) → bascule de clé."""
    msg = str(exc)
    return "API_KEY_INVALID" in msg or "API key not valid" in msg


def _extract_quota_model(exc) -> Optional[str]:
    """Extrait l'identifiant du modèle concerné par un quota épuisé,
    via `quotaDimensions.model` dans le message d'erreur.

    Ex : « 'quotaDimensions': {'location': 'global',
    'model': 'gemini-3.1-flash-lite'} » → renvoie 'gemini-3.1-flash-lite'.
    Renvoie None si pas trouvé."""
    import re
    msg = str(exc)
    m = re.search(r"'model'\s*:\s*'([^']+)'", msg)
    if m:
        return m.group(1)
    m = re.search(r'"model"\s*:\s*"([^"]+)"', msg)
    if m:
        return m.group(1)
    return None


def is_per_day_quota_exhausted(exc, expected_model: Optional[str] = None) -> bool:
    """Détecte les quotas QUOTIDIENS épuisés sur Gemini.

    Match STRICT sur quotaId contenant `PerDay` (typiquement
    `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). On évite les
    heuristiques sur metric names — `free_tier_requests` apparaît AUSSI
    dans les payloads PerMinute (le même metric existe pour les
    fenêtres minute ET jour), faux positifs assurés.

    Si `expected_model` est fourni, on ne renvoie True QUE si le quota
    concerne exactement ce modèle (extrait via quotaDimensions).
    """
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" not in msg and "429" not in msg:
        return False
    if "PerDay" not in msg:
        return False
    if expected_model is None:
        return True
    quota_model = _extract_quota_model(exc)
    if quota_model is None:
        return True  # conservateur : on considère que ça concerne le modèle courant
    return quota_model == expected_model


def detect_rate_limit_retry(exc) -> Optional[float]:
    """Détecte les erreurs 429 quota PerMinute Gemini (transients) et
    extrait le délai de retry recommandé par l'API.

    Ne renvoie un délai QUE pour les quotas PerMinute (fenêtres
    glissantes qui se régénèrent vite). Les quotas PerDay sont
    explicitement exclus → cf. `is_per_day_quota_exhausted` qui les
    intercepte en amont pour signaler une exhaustion réelle.

    Renvoie None si :
      - pas un 429 / RESOURCE_EXHAUSTED
      - pas un PerMinute (PerDay traité ailleurs)
      - pas de retryDelay parseable
      - délai > 120s
    """
    import re
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" not in msg and "429" not in msg:
        return None
    if "PerMinute" not in msg:
        return None  # PerDay ou autre → pas de retry ici
    m = re.search(r"retry in ([\d.]+)s", msg)
    if not m:
        m = re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+)s", msg)
    if not m:
        return None
    try:
        delay = float(m.group(1))
    except ValueError:
        return None
    if delay > 120:
        return None
    return delay + 1.0


_PARSE_EMPTY = object()      # sentinelle : contenu vide / blanc
_PARSE_UNPARSABLE = object() # sentinelle : ni JSON ni Python literal valide


def _parse_tool_result(content: str):
    """Parse défensif d'un retour de tool.

    Retourne :
      - `_PARSE_EMPTY` si le contenu est vide ou whitespace
      - l'objet parsé (dict / list / str / int / float / bool / None) si
        le contenu est du JSON valide
      - l'objet parsé via `ast.literal_eval` si le contenu est un
        Python literal valide (dict-repr avec single quotes, etc. —
        LangChain sérialise parfois ainsi)
      - `_PARSE_UNPARSABLE` si rien de tout ça ne marche

    Note : ne renvoie PLUS de dict vide `{}` pour signaler une erreur ;
    on utilise les sentinelles dédiées.
    """
    import json
    import ast
    if not content or not str(content).strip():
        return _PARSE_EMPTY
    s = str(content).strip()
    # 1) JSON canonique
    try:
        return json.loads(s)
    except Exception:
        pass
    # 2) Python literal (dict-repr avec single quotes, tuples, etc.)
    try:
        return ast.literal_eval(s)
    except Exception:
        pass
    return _PARSE_UNPARSABLE


def _format_done(content: str, fmt_dict) -> str:
    """Helper commun pour les callbacks 'done' du TOOL_NARRATION.

    Parse le contenu, puis dispatche :
      - vide            → '→ vide'
      - non parsable    → '→ (résultat non parsable)'
      - dict            → délègue à `fmt_dict(d)`
      - list            → '→ N élément(s)'
      - autre (str/int) → '→ {valeur tronquée}'
    """
    parsed = _parse_tool_result(content)
    if parsed is _PARSE_EMPTY:
        return "→ vide"
    if parsed is _PARSE_UNPARSABLE:
        return "→ (résultat non parsable)"
    if isinstance(parsed, dict):
        try:
            return fmt_dict(parsed)
        except Exception:
            return "→ (format inattendu)"
    if isinstance(parsed, list):
        return f"→ {len(parsed)} élément(s)"
    return f"→ {_truncate(str(parsed), 80)}"


TOOL_NARRATION: dict[str, dict] = {
    "list_existing_for_enrichment": {
        "start": lambda a: (
            f"📥 Je récupère ce qui existe déjà sur "
            f"« {_truncate(a.get('term'))} » pour la relation "
            f"`{a.get('relation_name') or a.get('relation') or '?'}`…"
        ),
        "done": lambda c: _format_done(c, lambda d: (
            f"→ {d.get('count', '?')} triplet(s) existant(s) trouvé(s)."
        )),
    },
    "validate_candidate": {
        "start": lambda a: (
            f"🧪 Je teste le candidat « {_truncate(a.get('term'))} | "
            f"{a.get('relation', '?')} | {_truncate(a.get('target'))} »…"
        ),
        # Cascade d'affichage du verdict :
        # 1. consolidation_status (résultat de l'inférence) prime
        # 2. sinon validation_status (résultat de la validation structurelle)
        # Note : `not_consolidated` est la VRAIE valeur renvoyée par
        # consolidate_candidate quand l'inférence est silencieuse — l'ancien
        # `silent` ne matchait jamais et tombait dans le fallback `→ ok`.
        "done": lambda c: _format_done(c, lambda d: (
            "✅ consolidé par inférence"
                if d.get("consolidation_status") == "consolidated"
            else "⏸️ non inférable à partir de JDM"
                if d.get("consolidation_status") in ("not_consolidated", "silent")
            else "❌ rejeté par inférence"
                if d.get("consolidation_status") == "rejected"
            # Pas de consolidation tentée → on lit le validation_status seul.
            else "❌ doublon"
                if d.get("validation_status") == "duplicate"
            else "❌ cible inconnue de JDM"
                if d.get("validation_status") == "unknown_term"
            else "❌ contradiction directe dans JDM"
                if d.get("validation_status") == "inconsistent"
            else "⏸️ non inférable à partir de JDM"
                if d.get("validation_status") == "ok"
            else f"→ {d.get('validation_status', '?')}"
        )),
    },
    "disambiguate": {
        "start": lambda a: f"🔎 Je cherche les sens de « {_truncate(a.get('term'))} »…",
        "done": lambda c: _format_done(c, lambda d: (
            f"→ {len(d.get('senses') or d.get('refinements') or []) or '?'} sens trouvés."
        )),
    },
    "lookup_term": {
        "start": lambda a: f"📖 Je vérifie l'existence de « {_truncate(a.get('term'))} » dans JDM…",
        "done": lambda c: _format_done(c, lambda d: (
            "→ trouvé." if d.get("found") or d.get("id") else "→ inconnu."
        )),
    },
    "get_relations_of_type": {
        "start": lambda a: (
            f"🔗 Je regarde les triplets « {_truncate(a.get('term'))} | "
            f"{a.get('relation_name') or a.get('relation') or '?'} »…"
        ),
        "done": lambda c: _format_done(c, lambda d: (
            f"→ {d.get('count', len(d.get('triplets', [])) or '?')} relation(s) trouvée(s)."
        )),
    },
    "write_submission_file": {
        "start": lambda a: (
            f"💾 J'écris le fichier de soumission ({len(a.get('triplets') or [])} item(s))"
            + (" et je le pousse à JDM…" if a.get("upload") else "…")
        ),
        "done": lambda c: _format_done(c, lambda d: (
            f"❌ {d['error']}" if d.get("error")
            else f"→ écrit dans `{d.get('path', '?')}` ({d.get('count', '?')} ligne(s))."
        )),
    },
}


def _narrate_tool_call(name: str, args: dict) -> Optional[str]:
    """Renvoie une phrase narrative pour un tool_call si l'outil est
    connu de TOOL_NARRATION, sinon None (le caller fera fallback sur
    l'affichage technique)."""
    spec = TOOL_NARRATION.get(name)
    if not spec:
        return None
    try:
        return spec["start"](args or {})
    except Exception:
        return None


def _narrate_tool_result(name: str, content: str) -> Optional[str]:
    """Renvoie une phrase narrative pour un ToolMessage si l'outil est
    connu, sinon None."""
    spec = TOOL_NARRATION.get(name)
    if not spec:
        return None
    try:
        return spec["done"](content)
    except Exception:
        return None


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
        # Persistance EXPLICITE : sans ce paragraphe, les LLM abandonnent
        # après 2-3 « non inférable » consécutifs en concluant que rien
        # n'est consolidable. Or c'est NORMAL d'en avoir beaucoup (le
        # moteur d'inférence est strict). La règle : tant que budget
        # restant, GÉNÉRER d'autres candidats avec d'AUTRES relations.
        if bounded:
            parts.append(
                "PERSISTANCE OBLIGATOIRE : itère jusqu'à atteindre le "
                "nombre cible OU jusqu'à épuisement du budget. Recevoir "
                "plusieurs « non inférable à partir de JDM » de suite "
                "est NORMAL — le moteur d'inférence est strict et ne "
                "consolide que ce qu'il peut prouver. Dans ce cas : "
                "essaie d'AUTRES relations, d'AUTRES cibles, ne te "
                "résigne pas. N'abandonne JAMAIS avant d'avoir épuisé "
                "le budget ou atteint le nombre cible de consolidés."
            )
        else:
            parts.append(
                "PERSISTANCE ABSOLUE — N'ABANDONNE JAMAIS.\n"
                "Tu es en BUDGET ILLIMITÉ. La valeur de ce que tu "
                "produis est PROPORTIONNELLE au nombre de tentatives "
                "que tu endures avant de trouver des candidats "
                "consolidés. Recevoir 20, 50, 100 « non inférable à "
                "partir de JDM » consécutifs est NORMAL et ATTENDU — "
                "le moteur d'inférence est strict par construction.\n"
                "RÈGLES :\n"
                "1. NE JAMAIS s'arrêter après quelques échecs. Un "
                "résultat à 0 consolidé après 20 essais n'est PAS "
                "un échec : c'est la BASELINE attendue.\n"
                "2. Tant que le nombre cible de consolidés n'est PAS "
                "atteint, GÉNÈRE encore et encore des candidats — "
                "varie systématiquement les relations, varie les "
                "cibles, explore des angles obliques (relations "
                "moins évidentes, sens raffinés, inverses).\n"
                "3. Un seul triplet réellement consolidé après 50 "
                "tentatives vaut INFINIMENT plus qu'une réponse "
                "rapide « rien trouvé ». L'utilisateur a coché "
                "« itérer » EXPRÈS pour que tu persistes.\n"
                "4. NE rends ta réponse finale QUE quand tu as atteint "
                "le nombre cible de consolidés."
            )
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
    use_thinking: bool = True,
    consolidation_target: Optional[int] = None,
    max_persistence_relances: Optional[int] = None,
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
    from jdm_agent.enrich.validators import exclusion_context
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    # Override env var pour LLMDrops si une clé est fournie côté UI
    saved_drops_key: Optional[str] = None
    if drops_key and drops_key.strip():
        saved_drops_key = os.environ.get("JDM_DROPS_API_KEY")
        os.environ["JDM_DROPS_API_KEY"] = drops_key.strip()

    last_file_path: Optional[str] = None

    try:
        # LLM + agent — pool Gemini : on track la clé courante pour
        # pouvoir basculer sur quota PerDay (cf. retry plus bas).
        current_gemini_key: Optional[str] = None
        try:
            # Si modèle Gemini natif, on pick une clé du pool en explicite
            # pour pouvoir la marquer "blown" plus tard si nécessaire.
            try:
                from app import (
                    GEMINI_NATIVE_REQUIRED, pick_unblown_gemini_key,
                    set_current_gemini_key as _set_current_key,
                    set_current_model as _set_current_model,
                )
                if model in GEMINI_NATIVE_REQUIRED:
                    current_gemini_key = pick_unblown_gemini_key(model)
                    # Fallback : si toutes les clés du pool sont blown/
                    # invalides pour ce modèle, on retombe sur la
                    # variable d'env singulière GOOGLE_API_KEY (qui
                    # peut être utilisée même hors pool). On la track
                    # quand même comme current_gemini_key → mark_blown
                    # ultérieur fonctionne et le dropdown reflète l'état.
                    if not current_gemini_key:
                        env_key = os.environ.get("GOOGLE_API_KEY", "").strip()
                        if env_key:
                            current_gemini_key = env_key
                    _set_current_key(current_gemini_key)
                # Annonce le modèle actif → préfixe ✅ dans le dropdown.
                _set_current_model(model)
            except Exception:
                pass  # app pas importable (test mode) → comportement standard
            llm = build_llm_fn(model, api_key, use_thinking=use_thinking,
                               gemini_key_override=current_gemini_key)
        except ValueError as e:
            yield (
                [{"role": "user", "content": user_display},
                 {"role": "assistant", "content": f"⚠️ {e}"}],
                None, "",
            )
            return

        agent = build_agent_fn(client=get_client_fn(), llm=llm)
        limit = BUDGET_LABEL_TO_LIMIT.get(budget_label, 25)

        # Deux listes parallèles :
        #  - progress_live : affichée pendant le streaming, thinking tronqué
        #    pour éviter les blocs de texte massifs qui noient l'UI.
        #  - progress_full : version complète sans troncature, montrée à la
        #    FIN dans un <details> collapsible « Voir le raisonnement ».
        progress_live: list[str] = ["*🧠 Réflexion en cours…*"]
        progress_full: list[str] = []
        final_answer: str = ""

        def _add_line(live: str, full: Optional[str] = None) -> None:
            """Ajoute une ligne aux 2 listes (full = live par défaut)."""
            progress_live.append(live)
            progress_full.append(full if full is not None else live)

        # Yield initial : user message + assistant placeholder, pas encore de fichier
        yield (
            [{"role": "user", "content": user_display},
             {"role": "assistant", "content": "\n\n".join(progress_live)}],
            None, "",
        )

        # Retry sur quota PerMinute Gemini : on attend le délai annoncé
        # par l'API et on CONTINUE le travail en cours — on ne repart
        # PAS de zéro. Les messages déjà produits (HumanMessage,
        # AIMessage avec tool_calls, ToolMessage de retour) sont
        # accumulés et passés tel quel à la nouvelle invocation
        # agent.stream(), qui reprend là où la précédente s'est arrêtée
        # (langgraph create_agent supporte le restart par history).
        #
        # Le budget_context et exclusion_context vivent À L'EXTÉRIEUR
        # de la boucle de retry → compteur d'outils et registry
        # d'exclusion MAINTENUS à travers la pause.
        import time as _time
        accumulated_messages: list = [HumanMessage(content=prompt)]
        # `persistence_relances` : nombre de relances déjà tentées via
        # nudge. Fix structurel du biais d'abandon du LLM — si le LLM
        # finalise prématurément (= consolidés < target alors qu'on a
        # demandé iterate), on injecte un HumanMessage qui le force à
        # reprendre, et on relance le streaming. Cap à
        # `max_persistence_relances` pour éviter les boucles infinies.
        # NB : chaque relance ouvre un NOUVEAU budget_context (compteur
        # reset par relance) — c'est volontaire : le budget label est
        # interprété « par session de streaming », pas « total absolu ».
        persistence_relances = 0
        persistence_done = False
        budget = None  # accessible hors du with pour le compteur final
        while not persistence_done:
            rate_limit_attempts = 0
            # Hits de rate limit CONSÉCUTIFS sans aucun chunk reçu
            # entre. Cap dur à 3 = quotas Google croisés bloqués,
            # inutile de boucler. Reset à 0 dès qu'on reçoit un chunk
            # (= du vrai progrès LLM s'est produit).
            consecutive_rate_limit_hits = 0
            MAX_CONSECUTIVE_RATE_LIMIT = 3
            with budget_context(limit=limit) as budget, exclusion_context():
                # boucle retry quota : ILLIMITÉ tant que le délai
                # retry est court (cf. detect_rate_limit_retry, cap
                # interne à 120s par hit) ET qu'on fait du progrès
                # entre deux hits. Si quotas croisés (3 hits sans
                # progrès), on tombe en erreur finale.
                while True:
                    try:
                        for chunk in agent.stream(
                            {"messages": accumulated_messages},
                            stream_mode="updates",
                        ):
                            # Reset du compteur de rate limit consécutifs :
                            # on a reçu un chunk = vrai progrès LLM, donc
                            # le quota a libéré quelque chose entre temps.
                            consecutive_rate_limit_hits = 0
                            # chunk = dict {node_name: {"messages": [msg, ...]}}
                            for _node, payload in chunk.items():
                                msgs = (payload or {}).get("messages") or []
                                for m in msgs:
                                    # Accumulation pour permettre la reprise
                                    # après pause quota (cf. retry plus bas).
                                    accumulated_messages.append(m)
                                    if isinstance(m, AIMessage):
                                        tcs = getattr(m, "tool_calls", []) or []
                                        # 1) Chain-of-thought (Anthropic Extended,
                                        #    Gemini avec include_thoughts, o1/o3).
                                        #    Style : blockquote + <small> + couleur
                                        #    grisée + italique pour le distinguer
                                        #    nettement des outils et du texte parlé,
                                        #    et signaler son statut « pensée » plutôt
                                        #    qu'action. Pas de troncature : Gemini
                                        #    renvoie déjà une SYNTHÈSE côté API
                                        #    (jamais les raw thoughts), inutile de
                                        #    re-raboter.
                                        thoughts = _content_to_thoughts(m.content)
                                        if thoughts.strip():
                                            t = thoughts.strip()
                                            # Le thinking contient souvent des
                                            # newlines markdown (\n\n) qui REFERMENT
                                            # le span/div HTML — d'où le bug observé
                                            # où seule la 1re ligne avait le style.
                                            # Fix : on convertit tous les retours en
                                            # <br> HTML pour rester inline-block, et
                                            # on enveloppe dans un <div> bloc (les
                                            # styles bloc s'appliquent au tout).
                                            # Markdown interne au thinking (genre
                                            # `code` ou *italique*) ne sera pas
                                            # rendu — acceptable pour un bloc déjà
                                            # marqué comme « discret ».
                                            t_html = (
                                                t.replace("&", "&amp;")
                                                 .replace("<", "&lt;")
                                                 .replace(">", "&gt;")
                                                 .replace("\n", "<br>")
                                            )
                                            line = (
                                                f"<div class=\"jdm-thinking\">"
                                                f"💭 {t_html}</div>"
                                            )
                                            _add_line(line)
                                        # 2) Texte parlé entre 2 tool_calls (Claude/
                                        #    GPT le font ; Gemini souvent vide).
                                        #    Blockquote normal pour le distinguer du
                                        #    thinking (qui est plus discret).
                                        spoken = _content_to_text(m.content)
                                        if tcs and spoken.strip():
                                            _add_line(f"> 💬 {spoken.strip()}")
                                        if tcs:
                                            for tc in tcs:
                                                name = tc.get("name", "?")
                                                tc_args = tc.get("args") or {}
                                                narrated = _narrate_tool_call(name, tc_args)
                                                if narrated:
                                                    _add_line(
                                                        f'<div class="jdm-narration">'
                                                        f'{narrated}</div>'
                                                    )
                                                else:
                                                    args_str = ", ".join(
                                                        f"{k}={v!r}"
                                                        for k, v in tc_args.items()
                                                    )
                                                    _add_line(
                                                        f'<div class="jdm-narration">'
                                                        f'🔧 `{name}({args_str})`</div>'
                                                    )
                                            # Ajoute en bas un indicateur fugace
                                            # « génération en cours » pour qu'on
                                            # sache que ça tourne (le LLM peut
                                            # tarder à produire sa réponse finale
                                            # ou son prochain tool_call). Cette
                                            # ligne disparaît au prochain yield
                                            # ou au yield final.
                                            live_with_pending = (
                                                "\n\n".join(progress_live)
                                                + "\n\n*⏳ Génération en cours…*"
                                            )
                                            yield (
                                                [{"role": "user", "content": user_display},
                                                 {"role": "assistant",
                                                  "content": live_with_pending}],
                                                last_file_path,
                                                _read_file_preview(last_file_path),
                                            )
                                        else:
                                            # Pas de tool_calls → réponse finale
                                            final_answer = spoken
                                    elif isinstance(m, ToolMessage):
                                        content = _content_to_text(m.content)
                                        if m.name == "write_submission_file":
                                            p = _extract_submission_path(content)
                                            if p:
                                                last_file_path = p
                                        narrated_done = _narrate_tool_result(m.name, content)
                                        if narrated_done:
                                            _add_line(
                                                f'<div class="jdm-narration">'
                                                f'{narrated_done}</div>'
                                            )
                                        else:
                                            preview = content[:120].replace("\n", " ")
                                            if len(content) > 120:
                                                preview += "…"
                                            _add_line(
                                                f'<div class="jdm-narration">'
                                                f'✓ *{m.name}* renvoie {len(content)} chars : `{preview}`'
                                                f'</div>'
                                            )
                                        live_with_pending = (
                                            "\n\n".join(progress_live)
                                            + "\n\n*⏳ Génération en cours…*"
                                        )
                                        yield (
                                            [{"role": "user", "content": user_display},
                                             {"role": "assistant",
                                              "content": live_with_pending}],
                                            last_file_path,
                                            _read_file_preview(last_file_path),
                                        )
                        # Sortie normale de la boucle for chunk → quitter while
                        break
                    except Exception as e:
                        # Quota PerMinute Gemini ET premier essai : on attend
                        # le délai, on AFFICHE un message d'attente, et on
                        # CONTINUE le travail en cours — on ne reset PAS les
                        # progress lists, et on relance agent.stream() en
                        # passant les `accumulated_messages` pour que langgraph
                        # reprenne là où il en était (les messages déjà
                        # produits = HumanMessage + AIMessages + ToolMessages).
                        # 1) Quota QUOTIDIEN épuisé.
                        # Si on a un POOL de clés (GOOGLE_API_KEYS CSV),
                        # on marque la clé courante comme blown et on
                        # tente de basculer sur la suivante non-blown.
                        # Sinon (pool vide / toutes blown), on signale
                        # et on stop.
                        # 0) Clé API invalide (typo, révoquée). Marquer
                        # la clé courante comme invalide pour la session
                        # et basculer sur la suivante du pool. Même
                        # logique que PerDay (rebuild LLM + agent +
                        # continue), mais marquage différent (permanent).
                        if is_invalid_api_key(e):
                            switched = False
                            try:
                                from app import (
                                    mark_gemini_key_invalid,
                                    pick_unblown_gemini_key,
                                    gemini_pool_size,
                                )
                                if current_gemini_key:
                                    mark_gemini_key_invalid(current_gemini_key)
                                next_key = pick_unblown_gemini_key(
                                    model, skip=current_gemini_key
                                )
                                if next_key:
                                    pool_n = gemini_pool_size()
                                    current_gemini_key = next_key
                                    try:
                                        from app import set_current_gemini_key as _set_cur
                                        _set_cur(current_gemini_key)
                                    except Exception:
                                        pass
                                    llm = build_llm_fn(
                                        model, api_key,
                                        use_thinking=use_thinking,
                                        gemini_key_override=current_gemini_key,
                                    )
                                    agent = build_agent_fn(
                                        client=get_client_fn(), llm=llm
                                    )
                                    _add_line(
                                        f"*🔑 Clé Google invalide détectée — "
                                        f"bascule sur une autre clé du pool "
                                        f"(pool : {pool_n} clés).*"
                                    )
                                    yield (
                                        [{"role": "user", "content": user_display},
                                         {"role": "assistant",
                                          "content": "\n\n".join(progress_live)}],
                                        last_file_path,
                                        _read_file_preview(last_file_path),
                                    )
                                    switched = True
                            except Exception:
                                pass
                            if switched:
                                continue
                            # Yield au chatbot avec DIAGNOSTIC : ce qui
                            # a été parsé depuis GOOGLE_API_KEYS (4 chars
                            # début + 4 chars fin + longueur de chaque
                            # clé) pour vérifier que le parsing CSV
                            # n'a rien tronqué.
                            try:
                                from app import (
                                    _parse_google_keys as _parse_keys,
                                    _masked_key,
                                )
                                parsed = _parse_keys()
                                diag = "\n".join(
                                    f"  - {i+1}. {_masked_key(k)}"
                                    for i, k in enumerate(parsed)
                                ) or "  (aucune clé parsée)"
                            except Exception:
                                parsed = []
                                diag = "  (diagnostic indisponible)"
                            err_msg = (
                                "❌ **Toutes les clés Google du pool ont "
                                "échoué**.\n\n"
                                f"**Diagnostic** : {len(parsed)} clé(s) "
                                f"parsée(s) depuis `GOOGLE_API_KEYS` :\n"
                                f"{diag}\n\n"
                                "Vérifie ci-dessus que chaque clé a la "
                                "**longueur attendue (~39 chars)** et "
                                "commence par `AIza`. Si une clé est "
                                "tronquée → problème de parsing CSV.\n\n"
                                "Sinon, causes possibles côté Google :\n"
                                "1. Clés non activées pour l'**API "
                                "Generative Language** (Google Cloud "
                                "Console).\n"
                                "2. Clés d'un projet sans accès aux "
                                "modèles Gemini 3.x.\n"
                                "3. Quotas PerDay tous épuisés (reset "
                                "à minuit UTC).\n\n"
                                "Bascule sur un modèle BYOK Claude / GPT."
                            )
                            yield (
                                [{"role": "user", "content": user_display},
                                 {"role": "assistant", "content": err_msg}],
                                last_file_path,
                                _read_file_preview(last_file_path),
                            )
                            return
                        # PerDay : on TRACE TOUJOURS la clé courante
                        # comme blown pour ce modèle (visuel dropdown
                        # « épuisé »). On ne BASCULE de clé que si on
                        # est sur le modèle protégé (gemini-3.1-flash-
                        # lite, 500 req/jour). Pour les autres (quotas
                        # ~20 req/jour), on remonte l'erreur après le
                        # marquage.
                        try:
                            from app import (
                                GEMINI_POOL_PROTECTED_MODEL as _PROTECTED,
                                mark_gemini_key_blown as _mark_blown_fn,
                            )
                        except Exception:
                            _PROTECTED = "gemini-3.1-flash-lite"
                            _mark_blown_fn = None
                        if is_per_day_quota_exhausted(e, expected_model=model):
                            if _mark_blown_fn and current_gemini_key:
                                _mark_blown_fn(current_gemini_key, model)
                        if (model == _PROTECTED
                                and is_per_day_quota_exhausted(e, expected_model=model)):
                            switched = False
                            try:
                                from app import (
                                    mark_gemini_key_blown,
                                    pick_unblown_gemini_key,
                                    gemini_pool_size,
                                )
                                if current_gemini_key:
                                    mark_gemini_key_blown(current_gemini_key, model)
                                next_key = pick_unblown_gemini_key(
                                    model, skip=current_gemini_key
                                )
                                if next_key:
                                    # Rebuild LLM + agent avec la nouvelle clé.
                                    # accumulated_messages reste intact →
                                    # langgraph reprend là où il en était.
                                    pool_n = gemini_pool_size()
                                    current_gemini_key = next_key
                                    try:
                                        from app import set_current_gemini_key as _set_cur
                                        _set_cur(current_gemini_key)
                                    except Exception:
                                        pass
                                    llm = build_llm_fn(
                                        model, api_key,
                                        use_thinking=use_thinking,
                                        gemini_key_override=current_gemini_key,
                                    )
                                    agent = build_agent_fn(
                                        client=get_client_fn(), llm=llm
                                    )
                                    _add_line(
                                        f"*🔄 Quota quotidien atteint sur "
                                        f"cette clé Google — bascule sur "
                                        f"une autre clé du pool "
                                        f"(pool : {pool_n} clés).*"
                                    )
                                    yield (
                                        [{"role": "user", "content": user_display},
                                         {"role": "assistant",
                                          "content": "\n\n".join(progress_live)}],
                                        last_file_path,
                                        _read_file_preview(last_file_path),
                                    )
                                    switched = True
                            except Exception:
                                pass  # bascule indisponible → on raise comme avant
                            if switched:
                                continue  # reprend la boucle avec la nouvelle clé
                            raise RuntimeError(
                                "Quota quotidien Gemini free tier épuisé sur "
                                "TOUTES les clés du pool (ou pool vide). Le "
                                "quota se réinitialise à minuit UTC. Réessaie "
                                "demain ou bascule sur un modèle BYOK "
                                "(Claude / GPT)."
                            ) from e
                        # 2) Rate limit PerMinute → retry avec attente
                        retry_delay = detect_rate_limit_retry(e)
                        if retry_delay is not None:
                            consecutive_rate_limit_hits += 1
                            # Filet : 3 hits PerMinute consécutifs sans
                            # progrès = quotas glissants croisés bloqués.
                            if consecutive_rate_limit_hits >= MAX_CONSECUTIVE_RATE_LIMIT:
                                raise RuntimeError(
                                    f"Quotas Gemini free tier croisés "
                                    f"({consecutive_rate_limit_hits} hits "
                                    f"PerMinute consécutifs sans progrès). "
                                    f"Les fenêtres glissantes ne s'ouvrent "
                                    f"jamais en même temps. Réessaie dans "
                                    f"quelques minutes ou bascule sur un "
                                    f"modèle BYOK (Claude / GPT)."
                                ) from e
                            rate_limit_attempts += 1
                            wait_msg = (
                                f"*⏳ Quota Gemini free tier atteint — j'attends "
                                f"{retry_delay:.0f}s puis je CONTINUE le travail "
                                f"en cours (pas de redémarrage).*"
                            )
                            current_progress = "\n\n".join(progress_live)
                            yield (
                                [{"role": "user", "content": user_display},
                                 {"role": "assistant",
                                  "content": current_progress + "\n\n" + wait_msg}],
                                last_file_path, _read_file_preview(last_file_path),
                            )
                            _time.sleep(retry_delay)
                            # PAS de reset des progress / last_file_path.
                            # MAIS strip des blocs thinking pour réduire
                            # massivement les tokens ré-envoyés (le LLM
                            # n'a pas besoin de ses propres pensées pour
                            # continuer — juste des tool_calls et résultats).
                            # On garde le DERNIER thinking pour préserver
                            # le thought_signature Gemini 3.x.
                            accumulated_messages = strip_thinking_blocks(
                                accumulated_messages, keep_last=True
                            )
                            continue
                        # Pas un quota retryable, ou déjà tenté : erreur finale
                        err_block = ""
                        if progress_full:
                            err_block = (
                                f"\n\n<details><summary>🧠 Voir les étapes avant erreur "
                                f"({len(progress_full)})</summary>\n\n"
                                f"{(chr(10)*2).join(progress_full)}\n\n</details>"
                            )
                        # MARQUEUR HARDCODÉ : pour vérifier qu'on est bien
                        # dans ce code path (et que HF déploie bien).
                        diag = "\n\n---\n🔎 **[MARKER-JARVIS-FINAL-YIELD]** (Phase 13 debug)"
                        try:
                            from app import build_pool_diag_md as _pool_diag
                            diag += "\n\n" + _pool_diag()
                        except Exception as _diag_exc:
                            diag += f"\n\n*(build_pool_diag_md raised : {_diag_exc})*"
                        yield (
                            [{"role": "user", "content": user_display},
                             {"role": "assistant",
                              "content": f"❌ Erreur agent : {e}" + diag + err_block}],
                            last_file_path, _read_file_preview(last_file_path),
                        )
                        return

            # Sortie normale du with → check persistance.
            # Si le LLM a finalisé prématurément (consolidés < target)
            # et qu'on a encore des relances disponibles, on injecte un
            # nudge et on relance le with (= nouveau budget_context,
            # mais accumulated_messages conservé donc l'agent reprend
            # avec tout son contexte).
            if consolidation_target is None:
                persistence_done = True
                continue
            n_done = count_consolidated_in_messages(accumulated_messages)
            if n_done >= consolidation_target:
                persistence_done = True
                continue
            # Pas de cap dur sur les relances persistance — on continue
            # tant que le LLM finalise sans avoir atteint le target.
            # Si l'utilisateur veut un cap, il passe max_persistence_relances
            # (par défaut None = illimité).
            if max_persistence_relances is not None and persistence_relances >= max_persistence_relances:
                persistence_done = True
                continue
            # On relance avec un nudge fort.
            persistence_relances += 1
            # Construit un résumé condensé (consolidés / échecs / pré-fetchs)
            # à partir des accumulated_messages, PUIS reset à juste :
            #   [HumanMessage initial, HumanMessage du résumé+nudge]
            # → drop massif des tokens (de ~50k à ~2k typiquement).
            # Le LLM reprend frais avec un état explicite plutôt que de
            # devoir digérer 50+ messages avec leurs raisonnements.
            summary = build_relance_summary(
                accumulated_messages, n_done, consolidation_target,
                persistence_relances, max_persistence_relances,
            )
            initial_human = accumulated_messages[0]  # HumanMessage(prompt)
            accumulated_messages = [
                initial_human,
                HumanMessage(content=summary),
            ]
            _cap_label = (
                f"/{max_persistence_relances}"
                if max_persistence_relances is not None else ""
            )
            _add_line(
                f"*🔁 Relance automatique {persistence_relances}{_cap_label} — "
                f"{n_done}/{consolidation_target} consolidés, on continue.*"
            )
            yield (
                [{"role": "user", "content": user_display},
                 {"role": "assistant", "content": "\n\n".join(progress_live)}],
                last_file_path, _read_file_preview(last_file_path),
            )
            # Boucle continue → nouveau with budget_context + nouvelle
            # invocation agent.stream avec accumulated_messages enrichi.

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

        # Bloc collapsible <details> avec la trace complète : résumé de
        # raisonnement (le « thought summary » de Gemini, déjà condensé
        # côté API — pas de version raw exposée) + texte parlé +
        # tool_calls + retours, dans l'ordre chronologique. Replié par
        # défaut pour ne pas polluer la réponse.
        #
        # Libellé adaptatif :
        #  - raisonnement ON  → « Voir le résumé du raisonnement (N étapes) »
        #  - raisonnement OFF → « Voir les étapes (N étapes) »
        #    (pas de raisonnement LLM dans le bloc, juste la narration des
        #     appels d'outils et leurs résultats)
        reasoning_block = ""
        if progress_full:
            full_text = "\n\n".join(progress_full)
            n_steps = len(progress_full)
            plural = "s" if n_steps > 1 else ""
            if use_thinking:
                summary_label = (
                    f"🧠 Voir le résumé du raisonnement "
                    f"({n_steps} étape{plural})"
                )
            else:
                summary_label = f"🧠 Voir les étapes ({n_steps} étape{plural})"
            reasoning_block = (
                f"\n\n<details><summary>{summary_label}</summary>\n\n"
                f"{full_text}\n\n</details>"
            )

        final_content = (
            (final_answer or "*(réponse vide)*")
            + footer
            + reasoning_block
        )
        yield (
            [{"role": "user", "content": user_display},
             {"role": "assistant", "content": final_content}],
            last_file_path, _read_file_preview(last_file_path),
        )
    finally:
        # Restore env var si on l'avait modifiée
        if drops_key and drops_key.strip():
            if saved_drops_key is None:
                os.environ.pop("JDM_DROPS_API_KEY", None)
            else:
                os.environ["JDM_DROPS_API_KEY"] = saved_drops_key
