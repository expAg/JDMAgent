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


def _get_app_module():
    """Récupère le module app DÉJÀ chargé via sys.modules. Sur HF
    Spaces, app.py tourne comme __main__ (pas 'app'). Faire
    `from app import X` re-load app.py SOUS LA CLÉ 'app' et déclenche
    un bug Gradio (composants re-créés hors d'un contexte Blocks valide
    → 'Button' object has no attribute '_id'). Le pattern correct :
    lire app.X via sys.modules sans jamais ré-importer.
    Renvoie None si introuvable (= mode test isolé, p.ex. pytest)."""
    import sys
    m = sys.modules.get('__main__')
    # On vérifie qu'on a bien le bon module — pas par exemple le
    # __main__ d'un test pytest qui n'a pas nos symboles.
    if m is not None and hasattr(m, 'pick_unblown_gemini_key'):
        return m
    return sys.modules.get('app')


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


def _hi(text) -> str:
    """Wrap un terme-cle (mot JDM, cible candidate…) dans un span colore
    pour le faire ressortir dans les narrations Jarvis (couleur ambre
    sobre, distincte du gris du raisonnement). La classe `jarvis-term`
    est definie dans `_CHATBOT_CSS` cote app.py — si la classe est
    strippee par le sanitizer du Chatbot, le texte reste lisible (juste
    pas colore). HTML-escape le contenu pour eviter toute injection
    accidentelle si un terme JDM contient '<' '>' '&'.
    """
    import html as _h
    return f'<span class="jarvis-term">{_h.escape(str(text or ""))}</span>'


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
                          max_relances: Optional[int] = None,
                          unit: str = "triplet consolidé") -> str:
    """Construit un résumé condensé pour le HumanMessage de relance.

    Au lieu de ré-injecter `accumulated_messages` complet (50-200 messages,
    explosion des tokens), on liste :
      - les triplets déjà PRODUITS (à préserver)
      - les cibles déjà testées en échec (à ne pas reproposer, top 20)
      - les couples (term, relation) déjà pré-fetchés
    Le LLM reçoit cette synthèse + l'instruction « continue » et reprend
    avec un brief propre, sans bagage cognitif.

    `unit` adapte le vocabulaire au flow courant (triplet consolidé /
    annotation / verdict / suspect / …). Le repérage des triplets
    « produits » via validate_candidate ne marche que pour le flow
    enrich ; pour les autres flows ces listes restent vides mais les
    messages STOP/RECOMMENCE sont corrects.

    NB : pour les flows en mode redirect (annot/audit/err/stat), la
    préservation des items déjà écrits sur disque est gérée
    STRUCTURELLEMENT par write_submission_file (accumule dans le rctx
    et overwrite avec l'union à chaque appel). Pas besoin d'instruction
    LLM ici.
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

    missing = max(0, target - n_done)
    lines = [
        f"⛔ STOP. Tu as produit **{n_done}/{target} {unit}(s)** — il en manque "
        f"{missing}.",
    ]
    if consolidated:
        lines.append("")
        lines.append(f"**Déjà produits (PRÉSERVE-les dans le fichier final)** :")
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
        f"RECOMMENCE avec de NOUVELLES propositions sur d'AUTRES "
        f"relations / d'AUTRES cibles. Ne rends ta réponse finale "
        f"QU'APRÈS avoir atteint le compte cible. (Relance auto "
        f"{relance_num}"
        + (f"/{max_relances}" if max_relances is not None else "") + ".)"
    )
    return "\n".join(lines)


# Seuil de condensation proactive de l'historique. Au-delà, l'historique
# devient trop coûteux à ré-envoyer à chaque chunk → on remplace par
# [HumanMessage initial, HumanMessage(summary+nudge)] avant que le LLM
# n'explose le contexte. ~230k tokens ≈ 920k chars (heuristique simple
# « 1 token ≈ 4 chars »). On vise 230k au lieu de 240k pour garder une
# marge plus confortable sous le plafond effectif de ~250k tokens souvent
# touché en pratique sur Gemini free tier (limite serveur, pas la limite
# nominale 1M qui n'est pas toujours servie au free tier). Préfère
# condenser un peu plus tôt et plus souvent que rater des appels.
HISTORY_CONDENSE_THRESHOLD_CHARS = 920_000

# Nudges aléatoires injectés après un résumé condensé pour apporter de
# la variété et de la nouveauté entre relances. Trois variantes
# tirées au sort (random.choice) → l'agent ne reproduit pas le même
# ton ni la même stratégie deux fois de suite.
_CONDENSE_NUDGE_VARIANTS = [
    "Continue en apportant plus de **variété et de nouveauté** dans tes "
    "propositions — change de relation, change d'angle, ne reprends pas "
    "ce qui a déjà été tenté.",
    "Continue : lorsque tu cibles un terme source ou une cible à "
    "**sens spécifique**, désambiguïse (`disambiguate`) puis propose / "
    "consolide avec le ou les **raffinements** plutôt qu'avec le "
    "terme générique.",
    "Continue : tu **n'as pas de limites**. Tu peux utiliser des termes "
    "techniques domain-specific, des néologismes, du vocabulaire de "
    "niche — la langue n'a pas de cloisons, du moment que tu passes "
    "par le flow d'enrichissement.",
]


def _history_total_chars(messages: list) -> int:
    """Estimation grossière du poids de l'historique en chars.
    Sum(len(content)) sur tous les messages. Pas un comptage de tokens
    précis mais suffisant pour le seuil de condensation (heuristique
    1 token ≈ 4 chars)."""
    return sum(len(str(getattr(m, "content", "") or "")) for m in messages)


def condense_history_with_nudge(
    messages: list,
    *,
    consolidation_target: Optional[int] = None,
    target: Optional[int] = None,
    count_fn: Optional[Any] = None,
    unit: str = "triplet consolidé",
    attempt: int = 0,
) -> Optional[list]:
    """Condense `messages` en `[HumanMessage initial, HumanMessage(summary
    + nudge aléatoire)]` SI son poids dépasse `HISTORY_CONDENSE_THRESHOLD_CHARS`.

    Retourne la nouvelle liste si la condensation a eu lieu, `None` sinon
    (poids sous le seuil ou erreur).

    Le summary est 100% déterministe (parcours Python — zéro appel LLM).
    Le nudge est tiré aléatoirement parmi `_CONDENSE_NUDGE_VARIANTS` pour
    apporter de la variété entre relances.

    Source du compteur (priorité descendante) :
      1. (target, count_fn) si fournis → flow-aware (annot, audit, …)
      2. consolidation_target + count_consolidations (rétro-compat enrich)
    """
    total_chars = _history_total_chars(messages)
    if total_chars <= HISTORY_CONDENSE_THRESHOLD_CHARS:
        return None
    try:
        from langchain_core.messages import HumanMessage as _HM
        import random as _random
        if target is not None and count_fn is not None:
            try:
                n_so_far = int(count_fn() or 0)
            except Exception:
                n_so_far = 0
            effective_target = target
        else:
            from jdm_agent.enrich import count_consolidations
            n_so_far = count_consolidations()
            effective_target = consolidation_target or (n_so_far + 1)
        summary = build_relance_summary(
            messages, n_so_far, effective_target, attempt, None, unit=unit,
        )
        nudge = _random.choice(_CONDENSE_NUDGE_VARIANTS)
        return [
            messages[0],  # HumanMessage initial (le prompt original)
            _HM(content=summary + "\n\n" + nudge),
        ]
    except Exception:
        return None


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

    Logique STRICTE en deux temps :
      1. PAS un 429 / RESOURCE_EXHAUSTED → False
      2. PAS un PerDay → False :
         - si le message contient « PerMinute » sans « PerDay » dans un
           quotaId de violation → PerMinute, jamais PerDay.
         - on regarde UNIQUEMENT le quotaId à l'intérieur de la première
           « violations: [...] » de l'erreur (les autres quotaId qui
           pourraient apparaître ailleurs — limits configurées,
           messages de doc — sont ignorés).
      3. si expected_model fourni : le quota doit cibler exactement
         ce modèle (extrait via quotaDimensions).

    Cible : éviter les faux positifs PerDay observés quand le payload
    PerMinute contenait par ailleurs une mention « PerDay » dans une
    description secondaire.
    """
    import re
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" not in msg and "429" not in msg:
        return False
    # Extrait le bloc 'violations: [...]' si présent. Le quotaId du
    # quota EFFECTIVEMENT violé y est. Hors de ce bloc on peut trouver
    # des quotaId informatifs (limits configurées, autres infos) qui
    # ne doivent PAS déclencher la détection.
    m = re.search(r"['\"]?violations['\"]?\s*:\s*\[(.*?)\]", msg, re.DOTALL)
    block = m.group(1) if m else msg  # fallback : tout le msg si pas trouvé
    if not re.search(r"['\"]quotaId['\"]?\s*:\s*['\"][^'\"]*PerDay", block):
        return False
    # Sanity check final : si le bloc contient AUSSI un PerMinute
    # violation mais pas un PerDay isolé → c'est PerMinute, pas PerDay.
    has_perminute_violation = bool(re.search(
        r"['\"]quotaId['\"]?\s*:\s*['\"][^'\"]*PerMinute", block))
    has_perday_violation = bool(re.search(
        r"['\"]quotaId['\"]?\s*:\s*['\"][^'\"]*PerDay", block))
    if has_perminute_violation and not has_perday_violation:
        return False
    if not has_perday_violation:
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
            f"« {_hi(_truncate(a.get('term')))} » pour la relation "
            f"`{a.get('relation_name') or a.get('relation') or '?'}`…"
        ),
        "done": lambda c: _format_done(c, lambda d: (
            f"→ {d.get('count', '?')} triplet(s) existant(s) trouvé(s)."
        )),
    },
    "validate_candidate": {
        "start": lambda a: (
            f"🧪 Je teste le candidat « {_hi(_truncate(a.get('term')))} | "
            f"`{a.get('relation', '?')}` | {_hi(_truncate(a.get('target')))} »…"
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
        "start": lambda a: f"🔎 Je cherche les sens de « {_hi(_truncate(a.get('term')))} »…",
        "done": lambda c: _format_done(c, lambda d: (
            f"→ {len(d.get('senses') or d.get('refinements') or []) or '?'} sens trouvés."
        )),
    },
    "lookup_term": {
        "start": lambda a: f"📖 Je vérifie l'existence de « {_hi(_truncate(a.get('term')))} » dans JDM…",
        "done": lambda c: _format_done(c, lambda d: (
            "→ trouvé." if d.get("found") or d.get("id") else "→ inconnu."
        )),
    },
    "get_relations_of_type": {
        "start": lambda a: (
            f"🔗 Je regarde les triplets « {_hi(_truncate(a.get('term')))} | "
            f"`{a.get('relation_name') or a.get('relation') or '?'}` »…"
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
    "Je n'ai pas précisé de terme — TU AS CARTE BLANCHE pour piocher "
    "au hasard dans TOUT le lexique français. La langue est vaste : "
    "noms abstraits, verbes, adjectifs, expressions, objets ordinaires, "
    "concepts techniques, sentiments, états, processus, métiers, "
    "phénomènes physiques ou sociaux… N'IMPORTE QUOI peut être "
    "intéressant. ÉVITE les champs scolaires sur-explorés (animaux "
    "courants, plantes, couleurs primaires) — JDM y est déjà dense "
    "et tu ne ferais que dupliquer du connu.\n"
    "VARIE RADICALEMENT d'un essai à l'autre et d'une session à "
    "l'autre : registre (familier ↔ soutenu), longueur (1 mot ↔ "
    "expression), niveau d'abstraction (concret ↔ abstrait), "
    "fréquence (commun ↔ rare). Vérifie d'abord qu'il existe via "
    "`lookup_term` ; si non, recommence avec un autre."
)


# Compat : les anciens callers utilisent random_term_instruction()
# (la version avec ancres a été retirée — c'était bricolé). On garde
# une fonction qui retourne juste la constante pour ne rien casser.
def random_term_instruction() -> str:
    return _RANDOM_TERM_INSTRUCTION


def _iteration_block(
    target_count: Optional[int],
    budget_label: str,
    *,
    unit: str = "triplet candidat consolidé",
    relax_on_unit_value: bool = True,
) -> str:
    """Bloc d'instruction réutilisable : « itère jusqu'à la cible / budget ».

    Centralise la prose de persistance partagée par tous les flows
    itératifs (enrich, audit, signalement, annotation…). Évite la
    divergence et facilite les ajustements.

    Args:
        target_count: nombre cible à produire (None = pas de cible
            chiffrée, juste épuiser le budget).
        budget_label: '10', '25', …, ou 'illimité'.
        unit: ce qu'on compte (« triplet candidat consolidé », « audit
            verdict utile », « annotation utile », « signalement »…).
        relax_on_unit_value: si True, mentionne « un seul X vaut
            infiniment plus qu'un échec rapide » (utile quand l'unit
            est coûteux à produire — ex. consolidation).

    Returns:
        Bloc de texte prêt à concaténer dans le prompt. Peut être vide
        si ni cible, ni budget contraignant ne sont actifs.
    """
    bounded = _is_bounded_budget(budget_label)
    has_target = target_count is not None and int(target_count) > 0

    if not has_target and not bounded:
        # Cas dégénéré : pas de cible et budget illimité → on demande
        # juste de la persistance générale.
        return (
            f"PERSISTANCE GÉNÉRALE : produis des {unit}s autant que "
            "possible. Tant qu'il reste des angles non explorés "
            "(relations différentes, sens raffinés, inverses), "
            "continue."
        )

    parts: list[str] = []
    if has_target and bounded:
        parts.append(
            f"PERSISTANCE OBLIGATOIRE : itère jusqu'à produire "
            f"{int(target_count)} {unit}s OU jusqu'à épuisement du "
            f"budget ({budget_label} appels d'outils). Les deux sont "
            "des conditions d'arrêt valides ; la première qui se "
            "réalise stoppe la boucle."
        )
    elif has_target:
        parts.append(
            f"PERSISTANCE ABSOLUE — N'ABANDONNE JAMAIS avant d'avoir "
            f"produit {int(target_count)} {unit}s. Tu es en BUDGET "
            "ILLIMITÉ. Recevoir des dizaines d'échecs consécutifs est "
            "NORMAL — tu dois persister, varier les relations, varier "
            "les cibles, explorer des angles obliques."
        )
    else:
        parts.append(
            f"Itère tant que le budget ({budget_label} appels) le "
            f"permet. Au-delà, tu recevras BUDGET_EXHAUSTED — arrête "
            "alors immédiatement et compose ta réponse finale avec "
            "ce qui est déjà produit."
        )

    if relax_on_unit_value:
        parts.append(
            f"Recevoir plusieurs « rien d'utile » de suite est NORMAL — "
            f"les flows JDM sont stricts par construction. Dans ce cas : "
            "essaie d'AUTRES relations, d'AUTRES cibles, ne te résigne "
            f"pas. Un seul {unit} de qualité après 20 tentatives vaut "
            "infiniment plus qu'une réponse rapide « rien trouvé »."
        )

    return "\n".join(parts)


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
        parts.append(random_term_instruction())
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
        # Persistance via le helper centralisé. Sans ce paragraphe, les
        # LLM abandonnent après 2-3 « non inférable » consécutifs en
        # concluant que rien n'est consolidable. Or c'est NORMAL d'en
        # avoir beaucoup (le moteur d'inférence est strict).
        parts.append(_iteration_block(
            target_count=int(target_count),
            budget_label=budget_label,
            unit="triplet candidat consolidé",
        ))
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
        parts.append(random_term_instruction() + (
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
        parts.append(random_term_instruction())
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
        parts.append(random_term_instruction())
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
        "Tu SUIVRAS `error_detection_workflow()` en TOUT PREMIER. Obligatoire."
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
        parts.append(random_term_instruction())
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


def build_annotation_prompt(
    term: str = "",
    relation=None,
    top_k: int = 8,
    target_count: int = 10,
    budget_label: str = "50",
    upload: bool = False,
) -> str:
    """Pré-prompt du flow Annotation sémantique.

    Le LLM annote les triplets existants selon la taxonomie 4 catégories
    (constitutif/contrastif/non spécifique/exception). L'annotation
    qualifie le LIEN, pas l'objet. Pas de consolidation par inférence.
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
            f"Je veux ANNOTER sémantiquement les triplets JDM du terme "
            f"« {term} » RESTREINTS à la/aux relation(s) {rel_label}."
        )
        parts.append(
            "⚠️ Limite-toi STRICTEMENT à cette/ces relation(s) — n'en "
            "examine aucune autre."
        )
    elif term:
        parts.append(
            f"Je veux ANNOTER sémantiquement les triplets JDM du terme "
            f"« {term} » sur les relations principales (r_isa, r_has_part, "
            "r_carac, r_telic_role, r_lieu, r_anto, r_syn)."
        )
    elif rels:
        parts.append(
            f"Je veux ANNOTER sémantiquement des triplets JDM portant "
            f"sur la/les relation(s) {rel_label}. Tu choisis librement "
            "des termes à examiner."
        )
        parts.append(random_term_instruction())
        parts.append(
            "⚠️ Limite-toi STRICTEMENT à cette/ces relation(s)."
        )
    else:
        parts.append(
            "Je veux ANNOTER sémantiquement des triplets JDM mais je n'ai "
            "ni terme ni relation. Tu pioches toi-même les termes."
        )
        parts.append(random_term_instruction())
    parts.append(
        f"Top-K par relation : {int(top_k)}. APPELLE :\n"
        f"  `get_relations_of_type(term, relation, limit={int(top_k)}, "
        "with_annotations=True)`\n"
        "Le flag `with_annotations=True` est CRUCIAL pour ce flow : il "
        "inline les annotations JDM existantes dans chaque triplet "
        "(champ `annotations`). Tu n'as PAS BESOIN d'appeler "
        "`get_triplet_annotations` séparément pour CHAQUE triplet — "
        "tu obtiens tout en UN tour, économise N round-trips."
    )
    parts.append(
        "TAXONOMIE STRICTE (4 catégories) :\n"
        "  - `constitutif` : trait définitionnel essentiel\n"
        "  - `contrastif` : différenciation clé / pairs proches\n"
        "  - `non spécifique` : vrai mais trop générique\n"
        "  - `exception` : valide en cadre restreint / contredit\n"
        "Si aucune ne convient PARFAITEMENT → vide (pas d'annotation "
        "forcée). MIEUX VAUT N'ANNOTER QU'UN PETIT NOMBRE de triplets "
        "réellement INFORMATIFS plutôt que d'annoter par défaut. La "
        "valeur du `.annot` se mesure à la pertinence de ce qui est "
        "annoté, pas au volume."
    )
    parts.append(
        "⚠️ L'annotation qualifie le LIEN, PAS l'objet. Respecte le "
        "SENS RAFFINÉ (désambiguïse d'abord si polysémique)."
    )
    parts.append(_iteration_block(
        target_count=int(target_count),
        budget_label=budget_label,
        unit="annotation utile (pertinente, non forcée)",
    ))
    parts.append(
        "FORMAT EXACT (espaces autour des | et annotation entre "
        "CROCHETS) :\n"
        "  Section principale : "
        "`sujet | relation | objet | [annotation] < justification >`\n"
        "  Section SIGNALEMENT : "
        "`sujet | relation | objet | JDM:[existant] | LLM:[tien] < argument >`"
    )
    parts.append(
        "Section SIGNALEMENT du `.annot` : lis le champ `annotations` "
        "de chaque triplet (renvoyé par with_annotations=True) pour "
        "voir si JDM a déjà une annotation parmi la taxonomie. ⚠️ "
        "N'écris en SIGNALEMENT que si ton annotation DIFFÈRE "
        "STRICTEMENT de celle de JDM. Si JDM et toi êtes d'accord "
        "(même catégorie), garde le triplet en section principale — "
        "NE PAS écrire « JDM:[X] | LLM:[X] < Aucun désaccord… > », "
        "c'est inutile et trompeur."
    )
    if upload:
        parts.append(
            "Soumets directement le fichier `.annot` à JDM (LLMDrops) à "
            "la fin (`write_submission_file(..., upload=True)`)."
        )
    else:
        parts.append(
            "Écris le fichier `.annot` à la fin "
            "(`write_submission_file(..., upload=False)`)."
        )
    parts.append(
        "Tu SUIVRAS `annotation_workflow()` en TOUT PREMIER. Obligatoire."
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
    On regarde la clé `path` MAIS on retourne None si :
      - `error` est présent dans le dict (l'écriture a échoué)
      - `path` est vide
      - le fichier n'existe pas physiquement (filet anti-régression
        contre les chemins valides retournés sans fichier derrière)
    """
    import json
    import re
    from pathlib import Path
    if not tool_message_content:
        return None

    def _validate(p: str) -> Optional[str]:
        if not p:
            return None
        try:
            if Path(p).exists():
                return p
        except Exception:
            pass
        return None

    try:
        d = json.loads(tool_message_content)
        if isinstance(d, dict):
            if d.get("error"):
                return None
            p = d.get("path")
            if p:
                return _validate(str(p))
    except Exception:
        pass
    # Fallback regex : si on ne peut pas parser le JSON, on extrait la
    # valeur de path mais on valide quand même l'existence du fichier.
    if "'error'" in tool_message_content or '"error"' in tool_message_content:
        return None
    m = re.search(r"['\"]path['\"]\s*:\s*['\"]([^'\"]+)['\"]", tool_message_content)
    if m:
        return _validate(m.group(1))
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
    production_target: Optional[int] = None,
    production_counter: Optional[Any] = None,
    production_unit: str = "items",
    max_persistence_relances: Optional[int] = None,
    auto_switch_on_perday: bool = False,
    resume_state: Optional[dict] = None,
    flow_id: Optional[str] = None,
    temperature: Optional[float] = None,
) -> Generator[tuple, None, None]:
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
    from jdm_agent.enrich.validators import RunContext, run_context_active
    from jdm_agent.enrich import count_consolidations
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    def _default_file_counter() -> int:
        """Compte les items « produits » à partir du fichier en cours.
        Convient à tous les flows non-enrich : compte les lignes
        pipe-separated qui ne sont ni commentaire (`#`) ni séparateur
        de section (`===`, `=====SIGNALEMENT`). Fallback robuste si
        aucun fichier n'a encore été écrit.

        ⚠️ N'utilise PAS canonical_path direct : pour annot/audit/err
        le LLM écrit dans last_file_path (ex. annotations_1.annot),
        pas dans le canonical .enrich. _current_file_path() retourne
        le bon chemin (canonical si présent, sinon last_file_path).
        """
        path = _current_file_path()
        if not path:
            return 0
        try:
            from pathlib import Path as _P
            content = _P(path).read_text(encoding="utf-8")
        except (FileNotFoundError, OSError, UnicodeDecodeError):
            return 0
        n = 0
        for raw in content.splitlines():
            s = raw.strip()
            if not s or s.startswith("#") or s.startswith("="):
                continue
            if "|" in s:
                n += 1
        return n

    # Résolution du couple (target, counter) à utiliser pour les
    # décisions de relance et l'affichage du compteur de progression.
    # Priorité absolue à consolidation_target (= flow enrich, registry)
    # pour préserver la compatibilité. Sinon production_target avec
    # son propre counter (ou le compteur fichier par défaut).
    def _resolve_target_counter():
        if consolidation_target is not None:
            return consolidation_target, count_consolidations, "consolidés"
        if production_target is not None:
            ctr = production_counter or _default_file_counter
            return production_target, ctr, production_unit
        return None, None, ""

    def _pending_line() -> str:
        """Ligne « génération en cours » avec compteur cumulatif (n/target)
        spécifique au flow courant : consolidations pour enrich, items
        produits dans le fichier canonique pour les autres flows si un
        production_target a été configuré."""
        tgt, ctr, unit = _resolve_target_counter()
        if tgt and ctr:
            try:
                n = ctr()
            except Exception:
                n = 0
            return f"*⏳ Génération en cours… ({n}/{tgt} {unit})*"
        return "*⏳ Génération en cours…*"

    def _current_file_path() -> Optional[str]:
        """Renvoie canonical_path dès qu'il existe sur disque (auto-append
        l'aura créé au 1er triplet consolidé) — priorité absolue car
        c'est CE fichier qui contient l'historique complet du run en
        temps réel. Sinon fallback sur last_file_path (path écrit par
        le LLM via write_submission_file) qui peut être un .audit/.err
        legitimately différent."""
        try:
            from pathlib import Path as _PathCheck
            if _PathCheck(canonical_path).exists():
                return canonical_path
        except Exception:
            pass
        return last_file_path

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
                _app = _get_app_module()
                if _app is None:
                    raise RuntimeError("app module unavailable")
                GEMINI_MODELS = _app.GEMINI_MODELS
                pick_unblown_gemini_key = _app.pick_unblown_gemini_key
                _set_current_key = _app.set_current_gemini_key
                _set_current_model = _app.set_current_model
                # Pick pour TOUS les Gemini (3.1, 3.5, 2.5…), pas seulement
                # NATIVE_REQUIRED. Sinon 2.5 (qui passe par l'endpoint
                # OpenAI-compat) ne reçoit pas la clé du pool et tombe
                # sur l'env GOOGLE_API_KEY brut = CSV des 4 clés non
                # parsé = INVALID_KEY garanti.
                if model in GEMINI_MODELS:
                    current_gemini_key = pick_unblown_gemini_key(model)
                    # Fallback : pool vide → env GOOGLE_API_KEY (mais
                    # _parse_google_keys → 1ère du CSV, pas CSV brut).
                    if not current_gemini_key:
                        keys = _app._parse_google_keys()
                        if keys:
                            current_gemini_key = keys[0]
                    _set_current_key(current_gemini_key)
                # Annonce le modèle actif → préfixe ✅ dans le dropdown.
                _set_current_model(model)
            except Exception:
                pass  # app pas importable (test mode) → comportement standard
            llm = build_llm_fn(model, api_key, use_thinking=use_thinking, temperature=temperature,
                               gemini_key_override=current_gemini_key)
        except ValueError as e:
            yield (
                [{"role": "user", "content": user_display},
                 {"role": "assistant", "content": f"⚠️ {e}"}],
                None, "",
            )
            return

        agent = build_agent_fn(
            client=get_client_fn(), llm=llm,
        )
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

        # OPTION C — path canonique unique pour CE run.
        # Timestamp + 6 premiers chars du hash du prompt → unicité même
        # si même prompt re-lancé. Tout va dans /tmp/jdm_outputs (la
        # seule destination fiable sur HF Spaces).
        # OPTION B — à la fin du flow on dumpe TOUT le registry de
        # consolidation dans ce path. Garantit que le fichier final
        # contient toutes les consolidations du run, même si le LLM
        # a écrit dans plusieurs paths intermédiaires ou si rien.
        import hashlib
        import time as _time_mod
        _ts = _time_mod.strftime("%Y%m%d_%H%M%S")
        _hash = hashlib.sha1((prompt or "").encode("utf-8")).hexdigest()[:6]
        # Extension + mode du canonical par flow_id :
        #   - enrich      → .enrich, mode auto_append (streaming +
        #     crash-safety via register_consolidation)
        #   - annotation  → .annot,  mode redirect  (overwrite canonical)
        #   - audit       → .audit,  mode redirect
        #   - signalement → .err,    mode redirect
        #   - stats       → .stat,   mode redirect
        #   - gap         → pas de canonical (flow de découverte, ne
        #     produit pas de fichier)
        #   - flow_id None : compat legacy. Si consolidation_target est
        #     set → enrich auto_append. Sinon, pas de canonical (le LLM
        #     contrôle, anti-écrasement actif comme avant).
        _flow_canonical_spec = {
            "enrich":      (".enrich", "auto_append"),
            "annotation":  (".annot",  "redirect"),
            "audit":       (".audit",  "redirect"),
            "signalement": (".err",    "redirect"),
            "stats":       (".stat",   "redirect"),
            "gap":         (".gap",    None),  # ext sentinelle, pas de canonical
        }
        if flow_id is not None:
            _ext, _canon_mode = _flow_canonical_spec.get(flow_id, (".enrich", None))
        elif consolidation_target is not None:
            # Legacy : pas de flow_id mais on a consolidation_target → enrich.
            _ext, _canon_mode = ".enrich", "auto_append"
        else:
            _ext, _canon_mode = ".enrich", None
        canonical_path = f"/tmp/jdm_outputs/jdm_{_ts}_{_hash}{_ext}"

        # Snapshot du dossier de sortie pour le cleanup filet en finally.
        # On notera tout fichier nouveau qui n'est PAS canonical_path à la
        # fin du run et on le supprimera. Avec le mode redirect en place,
        # cette liste devrait être vide en pratique — c'est juste un
        # filet pour les régressions futures.
        try:
            from pathlib import Path as _PathSnap
            _outputs_dir = _PathSnap("/tmp/jdm_outputs")
            _outputs_dir.mkdir(parents=True, exist_ok=True)
            _pre_run_files = {p.resolve() for p in _outputs_dir.iterdir() if p.is_file()}
        except Exception:
            _pre_run_files = set()

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
        # Si on est en mode RESUME (l'utilisateur a cliqué « Continuer
        # avec 3.1 » après un PerDay), on restaure l'état sauvé au lieu
        # de partir d'un HumanMessage frais. accumulated_messages a déjà
        # été passé par strip_thinking_blocks dans le state.
        if resume_state is not None and resume_state.get("accumulated_messages"):
            accumulated_messages = list(resume_state["accumulated_messages"])
            if resume_state.get("progress_live"):
                progress_live = list(resume_state["progress_live"])
            if resume_state.get("progress_full"):
                progress_full = list(resume_state["progress_full"])
            if resume_state.get("last_file_path"):
                last_file_path = resume_state["last_file_path"]
            _add_line(
                "*▶️ Reprise du flow interrompu (PerDay) sur "
                f"`{model}` — l'agent continue exactement où il s'était arrêté.*"
            )
        else:
            accumulated_messages = [HumanMessage(content=prompt)]
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
        # exclusion_context AUTOUR du while persistance : sans ça le
        # registry de consolidation est wipé entre chaque relance car
        # le with exit + re-enter à chaque tour → count_consolidations()
        # repartirait de 0 et le fix cumulatif serait inopérant. Avec
        # exclusion_context ici, le registry persiste sur TOUT le run.
        # budget_context reste dans la boucle (compteur reset par relance
        # = comportement actuel volontaire, budget interprété par session
        # de streaming).
        # ---------------------------------------------------------------
        # ISOLATION PER-RUN (fix contamination cross-flow parallèle) :
        # On crée un RunContext propre au run et on le pose dans la
        # ContextVar `_CURRENT_RUN_CTX`. Tous les tools (validate_candidate,
        # register_consolidation, write_submission_file, etc.) lisent
        # CE rctx via `_active_ctx()` et y écrivent au lieu des globals
        # partagés. Conséquence : deux flows en parallèle ont chacun leur
        # canonical_path/mode + leurs registries propres — plus jamais de
        # mélange.
        # La ContextVar se propage à travers les ThreadPoolExecutor
        # langchain.agents.create_agent via copy_context — vérifié par
        # test end-to-end avec un fake LLM + outil custom.
        # Entrée MANUELLE du context manager (__enter__/__exit__) pour
        # ne pas re-indenter tout le while → fermé dans le finally du try
        # principal (cf. plus bas).
        rctx = RunContext()
        _rctx_ctx = run_context_active(rctx)
        _rctx_ctx.__enter__()
        # Active le canonical avec le bon mode SUR LE RCTX (pas sur les
        # globals — l'isolation per-run dépend de ça) :
        #   - auto_append (enrich) : register_consolidation streame
        #     ligne par ligne dans canonical_path. write_submission_file
        #     y est no-op poli. UI voit le fichier grossir en temps réel.
        #   - redirect (annot/audit/err/stat) : write_submission_file
        #     overwrite canonical_path, ignore le path passé par le LLM.
        #     Garantie structurelle zéro fragmentation.
        #   - None (gap, ou legacy sans signal) : pas de canonical, le
        #     LLM contrôle son path (anti-écrasement actif).
        # Désactivé automatiquement quand `_rctx_ctx.__exit__` est appelé
        # dans le finally (le rctx tombe hors scope, plus de globals à
        # nettoyer).
        if _canon_mode is not None:
            rctx.set_canonical(canonical_path, _canon_mode)
        while not persistence_done:
            rate_limit_attempts = 0
            # Hits de rate limit CONSÉCUTIFS sans aucun chunk reçu
            # entre. Cap dur à 3 = quotas Google croisés bloqués,
            # inutile de boucler. Reset à 0 dès qu'on reçoit un chunk
            # (= du vrai progrès LLM s'est produit).
            consecutive_rate_limit_hits = 0
            MAX_CONSECUTIVE_RATE_LIMIT = 3
            proactive_condense_count = 0
            with budget_context(limit=limit) as budget:
                # boucle retry quota : ILLIMITÉ tant que le délai
                # retry est court (cf. detect_rate_limit_retry, cap
                # interne à 120s par hit) ET qu'on fait du progrès
                # entre deux hits. Si quotas croisés (3 hits sans
                # progrès), on tombe en erreur finale.
                while True:
                    _need_restart_after_condense = False
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
                                                # data-triplet : encode le (term, rel,
                                                # target) tente, pour que la vue Log de
                                                # narration cote front puisse afficher
                                                # directement les triplets parcourus
                                                # sans avoir a re-parser la phrase
                                                # humaine. Utile pour validate_candidate
                                                # consolidate_candidate, get_relations,
                                                # write_submission_file, etc.
                                                _t  = tc_args.get("term") or tc_args.get("subject") or ""
                                                _r  = tc_args.get("relation") or tc_args.get("relation_name") or ""
                                                _tg = tc_args.get("target") or ""
                                                if _t and _r and _tg:
                                                    _trip = f'data-triplet="{_t}|{_r}|{_tg}"'
                                                elif _t and _r:
                                                    _trip = f'data-triplet="{_t}|{_r}"'
                                                elif _t:
                                                    _trip = f'data-triplet="{_t}"'
                                                else:
                                                    _trip = ""
                                                narrated = _narrate_tool_call(name, tc_args)
                                                if narrated:
                                                    _add_line(
                                                        f'<div class="jdm-narration" data-tool="{name}" {_trip}>'
                                                        f'{narrated}</div>'
                                                    )
                                                else:
                                                    args_str = ", ".join(
                                                        f"{k}={v!r}"
                                                        for k, v in tc_args.items()
                                                    )
                                                    _add_line(
                                                        f'<div class="jdm-narration" data-tool="{name}" {_trip}>'
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
                                                + "\n\n" + _pending_line()
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
                                                f'<div class="jdm-narration" data-tool="{m.name}" data-result="1">'
                                                f'{narrated_done}</div>'
                                            )
                                        else:
                                            preview = content[:120].replace("\n", " ")
                                            if len(content) > 120:
                                                preview += "…"
                                            _add_line(
                                                f'<div class="jdm-narration" data-tool="{m.name}" data-result="1">'
                                                f'✓ *{m.name}* renvoie {len(content)} chars : `{preview}`'
                                                f'</div>'
                                            )
                                        live_with_pending = (
                                            "\n\n".join(progress_live)
                                            + "\n\n" + _pending_line()
                                        )
                                        yield (
                                            [{"role": "user", "content": user_display},
                                             {"role": "assistant",
                                              "content": live_with_pending}],
                                            _current_file_path(),
                                            _read_file_preview(_current_file_path()),
                                        )
                            # FIN DE CHUNK : check si historique
                            # dépasse le seuil → condensation proactive
                            # (mêmes conditions que post-PerMinute :
                            # build_relance_summary + nudge random).
                            # Si condensé, on BREAK le for chunk et on
                            # CONTINUE le while True pour relancer
                            # agent.stream avec les messages condensés.
                            chars_before = _history_total_chars(accumulated_messages)
                            if chars_before > HISTORY_CONDENSE_THRESHOLD_CHARS:
                                _tgt2, _ctr2, _u2 = _resolve_target_counter()
                                condensed = condense_history_with_nudge(
                                    accumulated_messages,
                                    consolidation_target=consolidation_target,
                                    target=_tgt2, count_fn=_ctr2,
                                    unit=_u2 or "triplet consolidé",
                                    attempt=proactive_condense_count,
                                )
                                if condensed is not None:
                                    proactive_condense_count += 1
                                    accumulated_messages = condensed
                                    _add_line(
                                        f"*🗜️ Historique condensé "
                                        f"({chars_before // 1000}k chars → résumé, "
                                        f"relance {proactive_condense_count}) — "
                                        f"l'agent reprend avec un nudge frais.*"
                                    )
                                    yield (
                                        [{"role": "user", "content": user_display},
                                         {"role": "assistant",
                                          "content": "\n\n".join(progress_live)}],
                                        last_file_path,
                                        _read_file_preview(last_file_path),
                                    )
                                    _need_restart_after_condense = True
                                    break  # sort du for chunk
                        if _need_restart_after_condense:
                            continue  # relance agent.stream avec accumulated_messages condensé
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
                            # On NE MARQUE INVALIDE que si c'est le modèle
                            # protégé (3.1) qui rejette la clé. Pour les
                            # autres modèles (2.5, 3.5), un INVALID_KEY
                            # peut être trompeur (endpoint OpenAI-compat
                            # qui retourne ce code pour d'autres raisons
                            # — modèle non dispo, version, etc.). Marquer
                            # globalement invalide pourrait gâcher une
                            # clé pourtant valide pour 3.1.
                            _app = _get_app_module()
                            _PROTECTED = (getattr(_app, 'GEMINI_POOL_PROTECTED_MODEL',
                                                  "gemini-3.1-flash-lite")
                                          if _app else "gemini-3.1-flash-lite")
                            if model != _PROTECTED:
                                # Abort + DIAG complet pour pouvoir tracer
                                # honnêtement (cas 2.5 qui renvoie INVALID
                                # alors que clé valide pour 3.1).
                                diag_lines = [
                                    f"⚠️ **`API_KEY_INVALID` pour `{model}`** "
                                    f"alors que clé attendue valide pour `{_PROTECTED}`."
                                    f"\n\n**Diagnostic du dernier build LLM** :",
                                ]
                                try:
                                    db = getattr(_app, '_DEBUG_LAST_BUILD', {}) or {}
                                    if not db:
                                        diag_lines.append("- *(_DEBUG_LAST_BUILD vide)*")
                                    for k, v in db.items():
                                        diag_lines.append(f"- `{k}` : `{v}`")
                                except Exception as _ex:
                                    diag_lines.append(f"- *(diag indisponible : {_ex})*")
                                diag_lines.append(
                                    "\n**Exception brute Gemini** (premiers 1500 chars) :"
                                )
                                diag_lines.append(f"```\n{str(e)[:1500]}\n```")
                                diag_lines.append(
                                    f"\n➡️ Pour l'instant, bascule sur "
                                    f"`{_PROTECTED}` ou un BYOK. La clé n'est "
                                    f"PAS marquée invalide globalement."
                                )
                                yield (
                                    [{"role": "user", "content": user_display},
                                     {"role": "assistant",
                                      "content": "\n".join(diag_lines)}],
                                    last_file_path,
                                    _read_file_preview(last_file_path),
                                )
                                return
                            switched = False
                            try:
                                if _app is None:
                                    raise RuntimeError("app module unavailable")
                                mark_gemini_key_invalid = _app.mark_gemini_key_invalid
                                pick_unblown_gemini_key = _app.pick_unblown_gemini_key
                                gemini_pool_size = _app.gemini_pool_size
                                if current_gemini_key:
                                    mark_gemini_key_invalid(current_gemini_key)
                                next_key = pick_unblown_gemini_key(
                                    model, skip=current_gemini_key
                                )
                                if next_key:
                                    pool_n = gemini_pool_size()
                                    current_gemini_key = next_key
                                    try:
                                        _app.set_current_gemini_key(current_gemini_key)
                                    except Exception:
                                        pass
                                    llm = build_llm_fn(
                                        model, api_key,
                                        use_thinking=use_thinking,
                                        temperature=temperature,
                                        gemini_key_override=current_gemini_key,
                                    )
                                    agent = build_agent_fn(
                                        client=get_client_fn(), llm=llm,
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
                                _app = _get_app_module()
                                if _app is None:
                                    raise RuntimeError("app module unavailable")
                                _parse_keys = _app._parse_google_keys
                                _masked_key = _app._masked_key
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
                        _app = _get_app_module()
                        if _app is not None:
                            _PROTECTED = getattr(_app, 'GEMINI_POOL_PROTECTED_MODEL', "gemini-3.1-flash-lite")
                            _mark_blown_fn = getattr(_app, 'mark_gemini_key_blown', None)
                        else:
                            _PROTECTED = "gemini-3.1-flash-lite"
                            _mark_blown_fn = None
                        if is_per_day_quota_exhausted(e, expected_model=model):
                            if _mark_blown_fn and current_gemini_key:
                                _mark_blown_fn(current_gemini_key, model)
                        # PerDay sur modèle non-protégé.
                        # Deux modes :
                        #   - auto_switch_on_perday=True (option C) : on
                        #     bascule silencieusement sur _PROTECTED et
                        #     on continue le flow (state préservé via
                        #     accumulated_messages, strip_thinking pour
                        #     les tokens).
                        #   - sinon (option B, défaut) : ABORT, save
                        #     state stripped, yield un 5-tuple avec
                        #     state + marker → le wrapper affiche un
                        #     bouton « Continuer avec 3.1 ».
                        if (model != _PROTECTED
                                and is_per_day_quota_exhausted(e, expected_model=model)
                                and _app is not None):
                            try:
                                _app.set_current_model(_PROTECTED)
                            except Exception:
                                pass
                            if auto_switch_on_perday and current_gemini_key:
                                # Option C : auto-retry silencieux
                                try:
                                    accumulated_messages = strip_thinking_blocks(
                                        accumulated_messages, keep_last=True
                                    )
                                    model = _PROTECTED
                                    llm = build_llm_fn(
                                        model, api_key,
                                        use_thinking=use_thinking,
                                        temperature=temperature,
                                        gemini_key_override=current_gemini_key,
                                    )
                                    agent = build_agent_fn(
                                        client=get_client_fn(), llm=llm,
                                    )
                                    _add_line(
                                        f"*🔄 Quota épuisé — bascule auto "
                                        f"sur `{_PROTECTED}`, je continue.*"
                                    )
                                    yield (
                                        [{"role": "user", "content": user_display},
                                         {"role": "assistant",
                                          "content": "\n\n".join(progress_live)}],
                                        last_file_path,
                                        _read_file_preview(last_file_path),
                                    )
                                    continue
                                except Exception:
                                    pass  # fallback sur abort si erreur
                            # Option B (défaut) : abort + save state +
                            # yield 5-tuple pour activer bouton continuer.
                            try:
                                stripped = strip_thinking_blocks(
                                    accumulated_messages, keep_last=True
                                )
                            except Exception:
                                stripped = accumulated_messages
                            saved_state = {
                                "accumulated_messages": stripped,
                                "progress_full": list(progress_full),
                                "progress_live": list(progress_live),
                                "last_file_path": last_file_path,
                                "user_display": user_display,
                            }
                            switch_msg = (
                                f"⚠️ **Modèle `{model}` épuisé pour "
                                f"aujourd'hui** (quota quotidien).\n\n"
                                f"Le sélecteur est passé sur "
                                f"`{_PROTECTED}` (500 req/j).\n\n"
                                f"➡️ Clique sur **« ▶️ Continuer avec "
                                f"`{_PROTECTED}` »** pour reprendre EXACTEMENT "
                                f"où l'agent s'est arrêté (state préservé), "
                                f"ou re-clique « Lancer » pour repartir de "
                                f"zéro."
                            )
                            yield (
                                [{"role": "user", "content": user_display},
                                 {"role": "assistant", "content": switch_msg}],
                                last_file_path,
                                _read_file_preview(last_file_path),
                                saved_state,
                                "show_continue_btn",
                            )
                            return
                        if (model == _PROTECTED
                                and is_per_day_quota_exhausted(e, expected_model=model)):
                            switched = False
                            try:
                                _app = _get_app_module()
                                if _app is None:
                                    raise RuntimeError("app module unavailable")
                                mark_gemini_key_blown = _app.mark_gemini_key_blown
                                pick_unblown_gemini_key = _app.pick_unblown_gemini_key
                                gemini_pool_size = _app.gemini_pool_size
                                if current_gemini_key:
                                    mark_gemini_key_blown(current_gemini_key, model)
                                next_key = pick_unblown_gemini_key(
                                    model, skip=current_gemini_key
                                )
                                if next_key:
                                    # Rebuild LLM + agent avec la nouvelle clé.
                                    pool_n = gemini_pool_size()
                                    current_gemini_key = next_key
                                    try:
                                        _app.set_current_gemini_key(current_gemini_key)
                                    except Exception:
                                        pass
                                    llm = build_llm_fn(
                                        model, api_key,
                                        use_thinking=use_thinking,
                                        temperature=temperature,
                                        gemini_key_override=current_gemini_key,
                                    )
                                    agent = build_agent_fn(
                                        client=get_client_fn(), llm=llm,
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
                                _current_file_path(), _read_file_preview(_current_file_path()),
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
                            # Condensation proactive si APRÈS strip
                            # l'historique reste massif (>seuil). Le
                            # helper renvoie None si pas nécessaire,
                            # ou la nouvelle liste [initial, summary
                            # + nudge random] sinon. Logique identique
                            # à la condensation proactive en cours de
                            # streaming (cf. fin du for chunk).
                            chars_before = _history_total_chars(accumulated_messages)
                            _tgt3, _ctr3, _u3 = _resolve_target_counter()
                            condensed = condense_history_with_nudge(
                                accumulated_messages,
                                consolidation_target=consolidation_target,
                                target=_tgt3, count_fn=_ctr3,
                                unit=_u3 or "triplet consolidé",
                                attempt=rate_limit_attempts,
                            )
                            if condensed is not None:
                                accumulated_messages = condensed
                                _add_line(
                                    f"*🗜️ Historique condensé "
                                    f"({chars_before // 1000}k chars → résumé) — "
                                    f"l'agent reprend avec un nudge frais.*"
                                )
                                # Yield immédiat — sans ça la ligne n'est
                                # poussée à Gradio QU'AU PROCHAIN chunk,
                                # qui peut tarder (PerMinute en boucle) →
                                # l'utilisateur ne voyait jamais le message
                                # condensé, juste « j'attends Xs ».
                                yield (
                                    [{"role": "user", "content": user_display},
                                     {"role": "assistant",
                                      "content": "\n\n".join(progress_live)}],
                                    last_file_path,
                                    _read_file_preview(last_file_path),
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
                        # PRÉSERVATION DU FICHIER SUR ERREUR : on yield
                        # _current_file_path() (priorité canonical_path
                        # si auto-append a écrit quelque chose) pour
                        # que l'utilisateur garde son fichier de
                        # consolidation même quand l'API LLM crashe.
                        yield (
                            [{"role": "user", "content": user_display},
                             {"role": "assistant",
                              "content": f"❌ Erreur agent : {e}" + err_block}],
                            _current_file_path(), _read_file_preview(_current_file_path()),
                        )
                        return

            # Sortie normale du with → check persistance.
            # Si le LLM a finalisé prématurément (produits < target)
            # et qu'on a encore des relances disponibles, on injecte un
            # nudge et on relance le with (= nouveau budget_context,
            # mais accumulated_messages conservé donc l'agent reprend
            # avec tout son contexte).
            #
            # Flow-aware : utilise le compteur résolu
            # (consolidations pour enrich, file-lines pour les autres).
            _tgt, _ctr, _unit = _resolve_target_counter()
            if _tgt is None or _ctr is None:
                persistence_done = True
                continue
            try:
                n_done = _ctr()
            except Exception:
                n_done = 0
            if n_done >= _tgt:
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
                accumulated_messages, n_done, _tgt,
                persistence_relances, max_persistence_relances,
                unit=_unit or "triplet consolidé",
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
                f"{n_done}/{_tgt} {_unit}, on continue.*"
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

        # OPTION B — FUSION FINALE depuis le registry de consolidation.
        # On dumpe TOUS les triplets consolidés du run (cumulatif via le
        # registry survivant grâce à exclusion_context wrappant le while
        # persistance) dans canonical_path. Garantit que le fichier
        # affiché contient TOUT, peu importe ce que le LLM a écrit dans
        # des paths intermédiaires ou si certaines écritures ont été
        # écrasées par des appels successifs.
        try:
            from jdm_agent.enrich import list_consolidations
            from jdm_agent.enrich.pipeline import write_submission as _write_sub
            from jdm_agent.enrich import Candidate as _Candidate
            from pathlib import Path as _Path
            entries = list_consolidations()
            if entries:
                _Path(canonical_path).parent.mkdir(parents=True, exist_ok=True)
                cands = [
                    _Candidate(
                        term=e["term"], relation=e["relation"], target=e["target"],
                        annotation="",
                        consolidation_explanation=e.get("explanation") or "",
                        confidence=0.8, source="agent",
                        validation_status="ok",
                        consolidation_status="consolidated",
                    )
                    for e in entries
                ]
                _write_sub(canonical_path, cands, client=get_client_fn())
                last_file_path = canonical_path
                _add_line(
                    f"*📦 Fichier final fusionné : {len(entries)} triplets "
                    f"consolidés écrits dans `{canonical_path}` "
                    f"(garantit que rien n'est perdu).*"
                )
        except Exception as _e:
            # Safety : si la fusion finale foire, on ne casse pas le flow,
            # on garde last_file_path tel que la dernière écriture LLM
            # l'avait laissé.
            _add_line(
                f"*⚠️ Fusion finale impossible : {_e}. Le fichier affiché "
                f"correspond à la dernière écriture du LLM.*"
            )

        final_content = (
            (final_answer or "*(réponse vide)*")
            + footer
            + reasoning_block
        )
        yield (
            [{"role": "user", "content": user_display},
             {"role": "assistant", "content": final_content}],
            _current_file_path(), _read_file_preview(_current_file_path()),
        )
    finally:
        # Note : pas besoin de `set_canonical_output_path(None)` ici.
        # Le canonical est posé sur `rctx`, pas sur les globals — il
        # disparaît automatiquement à la sortie de `_rctx_ctx.__exit__`
        # (la ContextVar est restorée à sa valeur précédente, le rctx
        # tombe hors scope, GC). Aucune fuite cross-run possible.
        # CLEANUP FILET — supprime tout fichier créé pendant ce run dans
        # /tmp/jdm_outputs qui n'est PAS le canonical. Avec le mode
        # redirect en place, ne devrait jamais matcher (le LLM ne peut
        # pas créer de fichier ailleurs). C'est juste un filet pour les
        # régressions futures / les cas exotiques (legacy mode sans
        # canonical, gap flow, etc.).
        try:
            from pathlib import Path as _PathClean
            _canonical_resolved = _PathClean(canonical_path).resolve()
            _outputs_dir2 = _PathClean("/tmp/jdm_outputs")
            if _outputs_dir2.is_dir():
                for _f in _outputs_dir2.iterdir():
                    if not _f.is_file():
                        continue
                    _fr = _f.resolve()
                    if _fr == _canonical_resolved:
                        continue
                    if _fr in _pre_run_files:
                        continue  # existait avant ce run, pas notre affaire
                    try:
                        _f.unlink()
                    except OSError:
                        pass
        except Exception:
            pass
        # Ferme manuellement le run_context_active ouvert avant le
        # while persistance (cf. __enter__ plus haut). Restore la
        # ContextVar à sa valeur précédente — un autre flow Jarvis qui
        # tournait en parallèle reprend son propre rctx sans pollution.
        # Try/except : supporte le cas où `_rctx_ctx` n'a pas été
        # initialisé (erreur très précoce dans le run).
        try:
            _rctx_ctx.__exit__(None, None, None)
        except Exception:
            pass
        # Restore env var si on l'avait modifiée
        if drops_key and drops_key.strip():
            if saved_drops_key is None:
                os.environ.pop("JDM_DROPS_API_KEY", None)
            else:
                os.environ["JDM_DROPS_API_KEY"] = saved_drops_key
