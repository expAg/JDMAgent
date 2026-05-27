"""Gradio web demo of JDMAgent for Hugging Face Spaces.

Three tabs:
  1. Explorer JDM (no LLM, instant)
  2. Fact-checker (deterministic on direct claims, BYOK for text extraction)
  3. Agent JDM (BYOK conversational)

The user brings their own Anthropic API key for the LLM-powered tabs.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure local sources are importable on HF Spaces (no `pip install -e .` there).
_root = Path(__file__).parent
sys.path.insert(0, str(_root / "src"))

# Charge un .env eventuel au demarrage pour que les variables soient lues
# AVANT toute lecture os.environ.get(...). override=False : un secret deja
# defini dans l'env reel (HF Spaces, systemd, export shell) garde priorite
# sur .env. Optional : si python-dotenv n'est pas installe, on continue.
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(override=False)
except ImportError:
    pass

# Force le cache disque dans /tmp/jdm_cache : sur HF Spaces le CWD (/app)
# est monté en read-only ou avec un overlay qui fait silencieusement échouer
# les écritures diskcache → chaque requête refait l'aller-retour HTTP.
# /tmp est toujours writable et persistant pendant toute la durée de vie
# du conteneur (les requêtes successives partagent donc le cache).
os.environ.setdefault("JDM_CACHE_DIR", "/tmp/jdm_cache")

# Cache temporaire Gradio — par défaut /tmp/gradio mais sur HF Spaces ce
# dossier n'existe pas toujours au boot, ce qui fait crash gr.File et
# gr.Code en preprocess avec "FileNotFoundError: /tmp/gradio/tmpXXX".
# On force un dossier qu'on crée nous-même → preprocess fiable.
_GRADIO_TEMP = "/tmp/jdm_gradio_cache"
os.makedirs(_GRADIO_TEMP, exist_ok=True)
os.environ.setdefault("GRADIO_TEMP_DIR", _GRADIO_TEMP)

import gradio as gr
import pandas as pd

from jdm_agent.client import JDMClient
from jdm_agent.factcheck import Claim, verify_claim
from jdm_agent.factcheck.models import Status
from jdm_agent.viz import (
    DEFAULT_DEPTH2_RELATIONS,
    DEFAULT_DEPTH3_RELATIONS,
    DEFAULT_DEPTH4_RELATIONS,
    DEFAULT_RELATIONS,
    build_subgraph,
)


# ---------- Shared client (cached, lazy) ----------
_client: JDMClient | None = None


def get_client() -> JDMClient:
    global _client
    if _client is None:
        _client = JDMClient()
    return _client


# ---------- Tab 1: Explorer JDM ----------

# Mapping of nice labels to (relation_name, optional helper)
EXPLORE_RELATIONS = {
    "Synonymes (r_syn)": "r_syn",
    "Antonymes (r_anto)": "r_anto",
    "Hyperonymes — 'est un' (r_isa)": "r_isa",
    "Hyponymes — 'exemples de' (r_hypo)": "r_hypo",
    "Parties / composants (r_has_part)": "r_has_part",
    "Caractéristiques (r_carac)": "r_carac",
    "Couleurs (r_has_color)": "r_has_color",
    "Lieux typiques (r_lieu)": "r_lieu",
    "Agents typiques (r_agent) — verbe": "r_agent",
    "Patients typiques (r_patient) — verbe": "r_patient",
    "Instruments (r_instr) — verbe": "r_instr",
    "Rôle télique — à quoi sert (r_telic_role)": "r_telic_role",
    "Causes (r_has_causatif)": "r_has_causatif",
    "Conséquences (r_has_conseq)": "r_has_conseq",
    "But (r_but)": "r_but",
    "Manière (r_manner) — verbe / processus": "r_manner",
}


def _resolve_and_check(client, term: str) -> tuple[str, str]:
    """Résout une forme molle de raffinement et vérifie l'existence du terme.

    Renvoie (terme_résolu, message_erreur). `message_erreur` est non vide si
    le terme est absent de JDM — l'UI affiche alors un message clair plutôt
    que l'erreur serveur 500 brute renvoyée par l'API.
    """
    raw = (term or "").strip()
    if not raw:
        return raw, "Renseigne un terme."
    resolved = client.resolve_term(raw)
    if not client.term_exists(resolved):
        return resolved, f"« {raw} » n'est pas connu de JeuxDeMots."
    return resolved, ""


def explore(term: str, relation_label: str, min_weight: float,
            limit: int, with_annotations: bool) -> tuple[pd.DataFrame, str]:
    c = get_client()
    term, err = _resolve_and_check(c, term)
    if err:
        return pd.DataFrame(), err
    rel_name = EXPLORE_RELATIONS[relation_label]
    rid = c.relation_type_id(rel_name)
    if rid is None:
        return pd.DataFrame(), f"Relation inconnue : {rel_name!r}"

    try:
        res = c.relations_from(term, types_ids=[rid],
                               min_weight=float(min_weight), limit=int(limit))
    except Exception as e:
        return pd.DataFrame(), f"Erreur API JDM : {e}"

    idx = res.node_index()
    rows: list[dict] = []
    for r in sorted(res.relations, key=lambda x: -x.w):
        node = idx.get(r.node2)
        if node is None:
            try:
                node = c.node_by_id(r.node2)
            except Exception:
                continue
        dec = c.decode_node_name(node.name, local_nodes=idx)
        # Annotations sémantiques (constitutif, contrastif, exception, ...)
        # fetchées à la demande — N+1 HTTP par relation, mais elles sont
        # cachées par diskcache.
        annot_str = ""
        if with_annotations:
            try:
                anns = c.get_annotations_for_triplet(r.id)
                if anns:
                    annot_str = " ; ".join(
                        f"{a.value} (w={int(round(a.w))})" for a in anns
                    )
            except Exception:
                annot_str = ""
        rows.append({
            "source": term,
            "relation": rel_name,
            "target": dec["decoded"],
            "w": round(r.w, 1),
            "annotations": annot_str,
            "target_id (si raffinement)": node.name if dec["is_refinement"] else "",
        })
    if not rows:
        msg = (f"Aucun triplet `{term} | {rel_name} | ?` (w ≥ {min_weight:.0f}). "
               f"Essaie un seuil plus bas, ou un autre terme.")
        return pd.DataFrame(), msg
    df = pd.DataFrame(rows)
    return df, f"{len(rows)} triplet(s) trouvé(s)."


def disambiguate_term(term: str) -> tuple[pd.DataFrame, str]:
    if not term.strip():
        return pd.DataFrame(), "Renseigne un terme polysémique (avocat, souris, police, ...)."
    c = get_client()
    if not c.term_exists(term.strip()):
        return pd.DataFrame(), f"« {term.strip()} » n'est pas connu de JeuxDeMots."
    try:
        senses = c.refinements_decoded(term.strip())
    except Exception as e:
        return pd.DataFrame(), f"Erreur : {e}"
    senses.sort(key=lambda s: -s.weight)
    if not senses:
        return pd.DataFrame(), f"Aucun sens raffiné trouvé pour {term!r} (terme probablement monosémique)."
    rows = [
        {"sens (décodé)": s.decoded, "poids": round(s.weight, 1), "id JDM": s.name}
        for s in senses[:30]
    ]
    return pd.DataFrame(rows), f"{len(rows)} sens trouvés."


# ---------- Tab 2: Fact-checker ----------

CLAIM_RELATIONS = [
    "r_isa", "r_hypo", "r_carac", "r_has_color", "r_has_part",
    "r_agent", "r_patient", "r_instr", "r_lieu",
    "r_has_causatif", "r_has_conseq", "r_but", "r_telic_role",
]


# Régimes de vérification proposés à l'utilisateur (effort du moteur).
EFFORT_CHOICES = {
    "0 — Contenance (JDM contient-il ?)": 0,
    "1 — + inférence (noyau)": 1,
    "2 — + inférence (complète)": 2,
}


def factcheck_one(subject: str, relation: str, object_: str,
                  effort_label: str, bypass: bool) -> tuple[str, str]:
    if not (subject.strip() and object_.strip()):
        return "—", "Renseigne un sujet et un objet."
    effort = EFFORT_CHOICES.get(effort_label, 0)
    c = get_client()
    # Résolution des raffinements + contrôle de présence dans JDM.
    subj, err_s = _resolve_and_check(c, subject)
    if err_s:
        return "—", err_s
    obj, err_o = _resolve_and_check(c, object_)
    if err_o:
        return "—", err_o
    claim = Claim(text=f"{subj} | {relation} | {obj}",
                  subject=subj, relation=relation, object=obj)
    try:
        v = verify_claim(c, claim, effort=effort, bypass_containment=bool(bypass))
    except Exception as e:
        return "—", f"Erreur : {e}"

    ICONS = {Status.SUPPORTED: "✅", Status.CONTRADICTED: "❌", Status.UNKNOWN: "❓"}
    icon = ICONS[v.status]
    # Origine du verdict : contenance directe ou inférence.
    if v.inference_schema:
        origin = f"🧠 *Verdict obtenu par **inférence** (schéma `{v.inference_schema}`)*"
    elif v.status != Status.UNKNOWN:
        origin = "📦 *Verdict obtenu par **contenance directe** dans JDM*"
    else:
        origin = ""
    status_md = (f"## {icon} {v.status.value.upper()}\n\n"
                 f"{origin}\n\n"
                 f"**Confiance** : {v.confidence:.2f}\n\n"
                 f"**Explication** : {v.explanation}")

    lines = []
    # Chaîne de preuve de l'inférence (« oui/non parce que … »).
    if v.inference_proof:
        lines.append("**🔗 Chaîne de déduction**")
        for e in v.inference_proof:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
        lines.append("")
    if v.evidence_for and not v.inference_proof:
        lines.append("**✓ Évidences en faveur**")
        for e in v.evidence_for:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
    if v.evidence_against and not v.inference_proof:
        lines.append("\n**✗ Évidences contraires**")
        for e in v.evidence_against:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
    return status_md, "\n".join(lines) if lines else "*(aucun triplet cité)*"


# ---------- Tab 3: Agent (HF Inference gratuit OU Anthropic BYOK) ----------

ANTHROPIC_MODELS = {
    "claude-haiku-4-5":   "Claude Haiku 4.5 (BYOK Anthropic)",
    "claude-sonnet-4-5":  "Claude Sonnet 4.5 (BYOK Anthropic)",
}
OPENAI_MODELS = {
    "gpt-4o-mini": "GPT-4o mini (BYOK OpenAI)",
    "gpt-4o":      "GPT-4o (BYOK OpenAI)",
}
# Modèles OpenAI qui acceptent strictement le kwarg `reasoning_effort`
# (modèles o-series / GPT-5). Vide actuellement — aucun de ces modèles
# n'est exposé dans le dropdown. La case « Raisonnement » reste
# néanmoins cochable sur GPT-4o à titre cosmétique (cf.
# THINKING_SUPPORTED_MODELS) mais aucun kwarg supplémentaire n'est passé
# à l'API.
OPENAI_REASONING_MODELS: set[str] = set()
# Providers gratuits — token côté Space, gratuit pour le visiteur, quota
# partagé. Le prompt agent + 34 outils sérialisés fait ~19-20 K tokens par
# appel, ce qui élimine la plupart des free tiers (TPM trop bas).
#
# Seul Gemini (Google AI Studio, endpoint OpenAI-compatible) a un quota
# free tier assez large par modèle pour passer nos 19-20 K tokens. Retirés :
#   - Groq Llama 3.x (TPM free : 6 K pour 8B, 12 K pour 70B — sous notre seuil)
#   - HF Inference Providers Together AI (~0.10 $/mois de crédits, épuisés
#     en quelques appels)
#   → helpers conservés dans le code pour réactivation si tier payant souscrit.
#
# `-lite` = variantes optimisées pour le coût/débit (qualité légèrement
# moindre), `-live` = optimisée pour le streaming temps réel (peut avoir des
# limitations sur le tool calling complexe).
GEMINI_MODELS = {
    "gemini-3.1-flash-lite":   "Gemini 3.1 Flash Lite (500 req/jour)",
    "gemini-2.5-flash-lite":   "Gemini 2.5 Flash Lite (20 req/jour)",
    "gemini-3.5-flash":        "Gemini 3.5 Flash (20 req/jour)",
}
# Noms d'identifiants API officiels (cf. https://ai.google.dev/gemini-api/docs/pricing).
# Deux chemins selon la version :
#  - 2.x stables → endpoint OpenAI-compat (simple, déjà éprouvé)
#  - 3.x preview → SDK natif Google (langchain-google-genai), qui préserve
#    automatiquement les `thought_signature` entre tours (sans quoi le
#    serveur rejette les enchaînements de tool calls — cf. issue LangChain
#    #34056 : https://github.com/langchain-ai/langchain/issues/34056).
GEMINI_MODEL_ROUTING = {
    "gemini-3.1-flash-lite":   "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite":   "gemini-2.5-flash-lite",
    "gemini-3.5-flash":        "gemini-3.5-flash",
}
# Modèles qui exigent le SDK natif Google (`langchain-google-genai`)
# au lieu de l'endpoint OpenAI-compatible. Tous les Gemini natifs
# y vont — l'endpoint OpenAI-compat de Gemini est capricieux et
# discrimine 2.5 dans certains cas. SDK natif pour TOUS.
GEMINI_NATIVE_REQUIRED = {"gemini-3.1-flash-lite", "gemini-3.5-flash",
                          "gemini-2.5-flash-lite"}
# Sous-ensemble des Gemini natifs qui supportent le raisonnement
# (`thinking_level`). 2.5 ne le supporte PAS — l'API renvoie 400
# INVALID_ARGUMENT « Thinking level is not supported for this model ».
GEMINI_THINKING_SUPPORTED = {"gemini-3.1-flash-lite", "gemini-3.5-flash"}
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# Le SEUL modèle pour lequel le pool de clés bascule sur PerDay.
# `gemini-3.1-flash-lite` a un quota PerDay généreux (500 req/jour) →
# ça vaut le coup de multiplier par N clés. Les autres modèles ont
# des quotas chiches (~20 req/jour) qui ne justifient PAS de griller
# une clé du pool. Sur PerDay d'un autre modèle, on remonte l'erreur
# (l'utilisateur bascule manuellement via le dropdown).
GEMINI_POOL_PROTECTED_MODEL = "gemini-3.1-flash-lite"


# ---------- Pool de clés Google API (rotation sur PerDay) ----------
# Plusieurs clés Google AI Studio peuvent être fournies via la variable
# d'env CSV `GOOGLE_API_KEYS` (séparées par virgules). Quand une clé
# hit un quota PerDay (épuisée pour la journée UTC), on bascule sur la
# suivante dans la liste. Reset automatique à minuit UTC car la marque
# « blown » est indexée par (key, date).
# Fallback : si `GOOGLE_API_KEYS` vide, on lit `GOOGLE_API_KEY` (singulier).

def _parse_google_keys() -> list[str]:
    """Renvoie la liste ordonnée de clés Google API disponibles.

    Priorité 1 : variable `GOOGLE_API_KEYS` (multi-clés).
    Priorité 2 : variable `GOOGLE_API_KEY` (singulière, rétro-compat).
    Renvoie [] si aucune.

    Parsing TRÈS robuste : on splitte sur tout caractère qui n'est PAS
    un caractère valide de clé Google API (alphabet `[A-Za-z0-9_-]`).
    Couvre tous les cas observés :
    - Séparateur classique : `,` ASCII U+002C
    - Fullwidth comma `，` U+FF0C (claviers chinois/japonais)
    - Arabic comma `،` U+060C
    - Newlines, tabs, espaces, `;`, `|`, ou autres confusables
    - Guillemets éventuels autour des clés
    """
    import re

    def _split_robust(blob: str) -> list[str]:
        chunks = re.split(r"[^A-Za-z0-9_-]+", blob)
        return [c for c in chunks if c]

    raw = os.environ.get("GOOGLE_API_KEYS", "")
    csv = raw.lstrip("﻿").strip()  # ﻿ = BOM UTF-8
    if csv:
        return _split_robust(csv)
    single_raw = os.environ.get("GOOGLE_API_KEY", "").lstrip("﻿").strip()
    if not single_raw:
        return []
    # Même nettoyage si la singulière est mal collée (peu probable mais
    # défensif — un user pourrait avoir mis une CSV dans GOOGLE_API_KEY
    # par accident).
    return _split_robust(single_raw)


def _current_key_index_label() -> str:
    """Renvoie '(clé 2/4)' selon la position de _CURRENT_GEMINI_KEY
    dans le pool. '(pool vide)' si aucune clé. Si la clé courante
    n'est pas (ou pas encore) dans le pool → défaut '(clé 1/N)' :
    on présume la 1ʳᵉ du CSV, qui est aussi celle qu'on utilisera
    par défaut au prochain pick."""
    try:
        keys = _parse_google_keys()
    except Exception:
        return ""
    n = len(keys)
    if n == 0:
        return "(pool vide)"
    cur = _CURRENT_GEMINI_KEY
    if cur and cur in keys:
        idx = keys.index(cur) + 1
        return f"(clé {idx}/{n})"
    return f"(clé 1/{n})"


def _switch_key_btn_label() -> str:
    """Label du bouton « Rotation clés gemini » avec index courant."""
    return f"🔄 Rotation clés gemini {_current_key_index_label()}"


def _masked_key(key: str) -> str:
    """Affichage masqué d'une clé pour diagnostic (4 premiers + 4 derniers
    chars + longueur), sans exposer la valeur entière."""
    if not key:
        return "(vide)"
    if len(key) < 12:
        return f"« {key} » ({len(key)} chars — trop court, suspect)"
    return f"{key[:4]}…{key[-4:]} ({len(key)} chars)"


def build_pool_diag_md() -> str:
    """Bloc Markdown de DIAGNOSTIC du pool — utilisable pour debug.
    Non injecté dans les erreurs UI par défaut."""
    lines = ["**État du pool Gemini** :"]
    if _CURRENT_GEMINI_KEY:
        lines.append(f"- Clé courante : `{_masked_key(_CURRENT_GEMINI_KEY)}`")
    else:
        lines.append("- Clé courante : *(aucune)*")
    lines.append(f"- Modèle actif : `{_CURRENT_MODEL or '(aucun)'}`")
    today = _today_utc_str()
    blown_today = [(k, m) for (k, m, d), v in _BLOWN_TODAY.items()
                   if d == today and v]
    if blown_today:
        lines.append("- **Blown aujourd'hui** :")
        for k, m in blown_today:
            lines.append(f"  - `{_masked_key(k)}` / `{m}`")
    else:
        lines.append("- **Blown aujourd'hui** : *(aucun)*")
    if _INVALID_KEYS:
        lines.append("- **Clés marquées invalides (session)** :")
        for k in _INVALID_KEYS:
            lines.append(f"  - `{_masked_key(k)}`")
    return "\n".join(lines)


# Marquage in-memory **par (clé, modèle)** : chaque modèle Gemini a
# son propre quota PerDay → une clé peut être blown pour
# gemini-3.1-flash-lite mais OK pour gemini-3.5-flash. Format :
#   {(api_key, model_id, "YYYY-MM-DD"): True}
# Reset implicite à minuit UTC (l'entrée du jour précédent n'existe plus).
_BLOWN_TODAY: dict[tuple[str, str, str], bool] = {}

# Clés marquées comme INVALIDES (typo, révoquée, etc.) — exclusion
# PERMANENTE pour la session courante (pas reset à minuit). Détecté
# via le code 400 INVALID_ARGUMENT / API_KEY_INVALID renvoyé par
# l'API Google quand on tente d'utiliser une clé bidon.
_INVALID_KEYS: set[str] = set()

# Version counter incrémenté à chaque mark blown / invalid. Le wrapper
# `_refresh_dropdown_wrap` ne yield un `gr.update(choices=...)` QUE si
# la version a changé depuis le dernier tour — sinon il yield
# `gr.update()` (no-op). Évite de spammer Gradio avec des choices
# identiques à chaque chunk pendant le streaming.
_REGISTRY_VERSION: int = 0


def _bump_registry_version() -> None:
    global _REGISTRY_VERSION
    _REGISTRY_VERSION += 1


def mark_gemini_key_invalid(key: str) -> None:
    """Marque une clé comme définitivement invalide pour la session
    (typo, révoquée, jamais activée pour Gemini, etc.)."""
    if key and key not in _INVALID_KEYS:
        _INVALID_KEYS.add(key)
        _bump_registry_version()
        _save_pool_state()


def _today_utc_str() -> str:
    """Renvoie la date du jour de RESET des quotas Gemini PerDay.
    Google reset les quotas du free tier à minuit Pacific Time (PT),
    PAS UTC. Le nom de la fonction est resté `_utc` pour rétro-compat
    mais l'implémentation utilise désormais America/Los_Angeles."""
    from datetime import datetime
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    except Exception:
        # Fallback : UTC (approximation, déraille de ~8h)
        from datetime import timezone
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# Fichier de persistance de l'état du pool — survit aux crashs du
# process et permet de reprendre l'état correct au redémarrage. Au
# load on filtre par _today_utc_str() courante → les entrées des
# jours précédents sont automatiquement abandonnées (= reset auto
# à minuit Pacific Time, comme Gemini lui-même).
_POOL_STATE_FILE = "pool_state.json"

# DIAG : capture le dernier appel à _build_openai_compat / _build_gemini_native
# (model, source de la clé, base_url, token masqué). Utilisé pour afficher
# dans le chatbot ce qui a été effectivement envoyé à Gemini quand on
# reçoit un INVALID_KEY inattendu.
_DEBUG_LAST_BUILD: dict = {}


def _save_pool_state() -> None:
    """Persiste sur disque l'état blown/invalid + clé/modèle courants.
    Best-effort, jamais bloquant (try/except global).
    Désactivé pendant pytest pour ne pas polluer le repo entre tests."""
    import os as _os
    if _os.environ.get("PYTEST_CURRENT_TEST"):
        return
    try:
        import json
        today = _today_utc_str()
        # Sérialisation : tuples → listes (JSON ne supporte pas les tuples)
        blown_list = [
            {"key": k, "model": m, "date": d}
            for (k, m, d), v in _BLOWN_TODAY.items() if v
        ]
        payload = {
            "version": 1,
            "saved_at_date": today,
            "blown": blown_list,
            "invalid_keys": sorted(_INVALID_KEYS),
            "current_key": _CURRENT_GEMINI_KEY,
            "current_model": _CURRENT_MODEL,
        }
        with open(_POOL_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception:
        pass  # best-effort, on n'interrompt jamais le flow


def _load_pool_state() -> None:
    """Restaure l'état blown/invalid + clé/modèle courants depuis le
    disque au démarrage du module. Filtre par date courante (Pacific
    Time) pour ignorer les blown des jours précédents (= reset Gemini).
    Désactivé pendant pytest pour repartir d'un état propre."""
    global _CURRENT_GEMINI_KEY, _CURRENT_MODEL
    import os as _os
    if _os.environ.get("PYTEST_CURRENT_TEST"):
        return
    try:
        import json
        import os
        if not os.path.exists(_POOL_STATE_FILE):
            return
        with open(_POOL_STATE_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)
        today = _today_utc_str()
        # On ne charge QUE les blown de la date du jour. Si le file a
        # été écrit hier, ses blown sont obsolètes (Gemini a reset).
        for entry in payload.get("blown", []):
            d = entry.get("date")
            k = entry.get("key")
            m = entry.get("model")
            if d == today and k and m:
                _BLOWN_TODAY[(k, m, d)] = True
        # NOTE : on N'IMPORTE PLUS les invalid_keys d'une session
        # précédente. Trop de risque qu'elles aient été marquées à tort
        # (cas 2.5 qui renvoie INVALID_KEY alors que la clé est valide
        # pour 3.1). Au prochain démarrage, on repart avec un pool
        # propre — si une clé est vraiment invalide pour 3.1, elle
        # sera re-marquée à la 1ʳᵉ tentative.
        # for k in payload.get("invalid_keys", []):
        #     if k: _INVALID_KEYS.add(k)
        # Restore la clé courante SEULEMENT si elle est encore utilisable
        # (présente dans le pool, non invalide, et pas blown pour le
        # modèle protégé — sinon on laissera pick_unblown_gemini_key
        # en choisir une autre au prochain pick).
        saved_key = payload.get("current_key")
        saved_model = payload.get("current_model")
        if saved_key:
            pool = _parse_google_keys()
            if (saved_key in pool
                    and saved_key not in _INVALID_KEYS
                    and not _BLOWN_TODAY.get(
                        (saved_key, GEMINI_POOL_PROTECTED_MODEL, today), False)):
                _CURRENT_GEMINI_KEY = saved_key
        if saved_model:
            _CURRENT_MODEL = saved_model
    except Exception:
        pass  # best-effort, on n'interrompt jamais le démarrage


def mark_gemini_key_blown(key: str, model: str) -> None:
    """Marque une (clé, modèle) comme épuisée pour aujourd'hui (PT)."""
    if not key or not model:
        return
    cell = (key, model, _today_utc_str())
    if not _BLOWN_TODAY.get(cell, False):
        _BLOWN_TODAY[cell] = True
        _bump_registry_version()
        _save_pool_state()


# Clé Gemini ACTIVE dans la session courante (= celle dans laquelle
# tournent les requêtes en ce moment). Mise à jour quand on pick une
# nouvelle clé (init) ou quand on bascule (PerDay/invalid sur 3.1).
# Le dropdown affiche le status « épuisé » selon ce qui est blown
# POUR CETTE CLÉ — pas pour tout le pool.
_CURRENT_GEMINI_KEY: Optional[str] = None


def set_current_gemini_key(key: Optional[str]) -> None:
    """Déclare la clé Gemini active. Bumpe le registry version pour
    que le dropdown se rafraîchisse au prochain yield (le label
    « ✅/❌ épuisé sur cette clé » dépend de la clé courante).
    Persiste sur disque pour reprendre l'état au prochain démarrage."""
    global _CURRENT_GEMINI_KEY
    if _CURRENT_GEMINI_KEY != key:
        _CURRENT_GEMINI_KEY = key
        _bump_registry_version()
        _save_pool_state()


# Modèle actuellement sélectionné (utilisé pour préfixer ✅ devant
# l'option courante dans le dropdown). Init = défaut des deux dropdowns
# pour que le ✅ apparaisse sans avoir besoin de re-cliquer.
_CURRENT_MODEL: Optional[str] = "gemini-3.1-flash-lite"


def set_current_model(model: Optional[str]) -> None:
    """Déclare le modèle actif. Bumpe la version → le dropdown se
    rafraîchit avec ✅ devant cette option. Persiste sur disque."""
    global _CURRENT_MODEL
    if _CURRENT_MODEL != model:
        _CURRENT_MODEL = model
        _bump_registry_version()
        _save_pool_state()


def is_model_blown_on_current_key(model: str) -> bool:
    """True si le modèle est épuisé SUR LA CLÉ COURANTE (blown today
    ou invalide). C'est ça qui détermine si le dropdown affiche
    « ❌ épuisé ». Si on n'a pas encore de clé active, on retourne
    False (état neutre)."""
    key = _CURRENT_GEMINI_KEY
    if not key:
        return False
    if key in _INVALID_KEYS:
        return True
    return _BLOWN_TODAY.get((key, model, _today_utc_str()), False)


def _refresh_dropdown_wrap(fn):
    """Decorator/wrapper qui ajoute en DERNIÈRE position des tuples
    yieldés un update du dropdown modèle — MAIS seulement quand
    l'état du pool change (registry version bumpée).

    Si rien n'a changé depuis le dernier yield, on envoie un
    `gr.update()` no-op qui ne traverse pas la frontière réseau
    pour rebuild le dropdown. Premier tour : on snapshot la version
    courante et on yield un update initial (pour synchroniser après
    une rebuild de page).
    """
    # Wrapper devenu pass-through : les dropdowns ne sont PLUS dans les
    # outputs du launch handler (sinon Gradio les marque « processing »
    # pendant tout le flow). Ils sont rafraîchis SÉPARÉMENT via une
    # chaîne .then(refresh_dropdowns_silent, show_progress="hidden")
    # APRÈS la fin du flow → row Modèle stable + état final propagé.
    return fn


def refresh_dropdowns_silent():
    """Helper appelé via .then() après chaque launch handler.
    Refresh choices+value des DEUX dropdowns, sans progress bar."""
    cur = _CURRENT_MODEL or "gemini-3.1-flash-lite"
    choices = build_model_choices()
    return (
        gr.update(choices=choices, value=cur),
        gr.update(choices=choices, value=cur),
    )


def build_model_choices(for_chatbot: bool = False) -> list[tuple[str, str]]:
    """Construit la liste de (label, value) du dropdown des modèles.

    Marquage server-side (les deux dropdowns) :
      - ✅ devant le modèle courant (_CURRENT_MODEL)
      - suffixe `— épuisé sur cette clé` pour les modèles Gemini natifs
        blown sur la clé courante (le JS ajoute ❌ + grisage CSS)
    """
    import re as _re
    out: list[tuple[str, str]] = []
    for key, label in ALL_MODELS.items():
        # Le check « épuisé » s'applique à TOUS les Gemini natifs
        # (3.1, 3.5, 2.5…), pas seulement NATIVE_REQUIRED. Sinon
        # 2.5 hit PerDay → mark_blown → MAIS dropdown ne montre rien
        # parce que la condition ne le testait pas.
        if key in GEMINI_MODELS and is_model_blown_on_current_key(key):
            base = _re.sub(r"\s*\(.*?\)\s*$", "", str(label)).strip()
            decorated = f"{base} — épuisé sur cette clé"
        elif key == _CURRENT_MODEL:
            decorated = f"✅ {label}"
        else:
            decorated = label
        out.append((decorated, key))
    return out


def pick_unblown_gemini_key(model: str,
                             skip: Optional[str] = None) -> Optional[str]:
    """Renvoie une clé du pool non-épuisée pour `model`, ou None si
    toutes blown / pool vide. `skip` exclut une clé donnée (utilisé pour
    ne pas re-choisir celle qui vient de hit le PerDay).

    PRIORITÉ STICKY : si `_CURRENT_GEMINI_KEY` est déjà fixée pour cette
    session ET qu'elle reste utilisable (présente dans le pool, non
    invalide, non blown pour `model`), on la réutilise. Sans ça, chaque
    onglet (LLM Chatbot vs Jarvis) piquait une clé différente, et les
    marquages « blown » de l'un n'étaient pas visibles sur l'autre. Avec
    le sticky, toute la session partage la même clé courante tant qu'elle
    n'est pas épuisée.

    `model` est requis : chaque modèle Gemini a son propre quota PerDay,
    donc une clé peut être blown pour un modèle et OK pour un autre.

    Exclut aussi les clés marquées comme INVALIDES (API_KEY_INVALID)
    pour la session courante."""
    keys = _parse_google_keys()
    today = _today_utc_str()
    n = len(keys)
    if n == 0:
        return None
    # 1) Sticky : réutilise _CURRENT_GEMINI_KEY si encore utilisable
    cur = _CURRENT_GEMINI_KEY
    if (cur and cur != skip and cur in keys
            and cur not in _INVALID_KEYS
            and not _BLOWN_TODAY.get((cur, model, today), False)):
        return cur
    # 2) Rotation cyclique : on commence APRÈS skip (ou après cur),
    #    pas au début du pool — sinon on cycle 1↔2 sans atteindre 3/4.
    start = 0
    if skip and skip in keys:
        start = (keys.index(skip) + 1) % n
    elif cur and cur in keys:
        start = (keys.index(cur) + 1) % n
    for i in range(n):
        k = keys[(start + i) % n]
        if k == skip:
            continue
        if k in _INVALID_KEYS:
            continue
        if not _BLOWN_TODAY.get((k, model, today), False):
            return k
    return None


def gemini_pool_size() -> int:
    """Nombre total de clés dans le pool (utilisé pour les messages UX)."""
    return len(_parse_google_keys())

ALL_MODELS = {
    **GEMINI_MODELS,
    **ANTHROPIC_MODELS, **OPENAI_MODELS,
}

# Charge l'état persisté du pool depuis le disque (crashs, restarts).
# Filtre par date Pacific Time → les blown des jours précédents sont
# automatiquement abandonnés (Gemini les a reset à minuit PT).
_load_pool_state()

# Si après load _CURRENT_GEMINI_KEY est toujours None mais qu'on a un
# pool, on init à la 1ʳᵉ clé du pool → l'index dans le bouton affiche
# bien « clé 1/N » au démarrage, pas « ? ».
if _CURRENT_GEMINI_KEY is None:
    _initial_keys = _parse_google_keys()
    if _initial_keys:
        _CURRENT_GEMINI_KEY = _initial_keys[0]

# Modèles pour lesquels la case « Raisonnement » est cochable :
#   - Gemini 3.x natifs : include_thoughts + thinking_level (réel côté API)
#   - Claude Sonnet/Haiku 4.5 : thinking={"type":"enabled","budget_tokens":N}
#     (réel côté API, requiert temperature=1.0)
#   - GPT-4o / GPT-4o-mini : cochable mais aucun kwarg n'est passé à
#     l'API (gpt-4o ne supporte pas `reasoning_effort` strictement) — la
#     case y est cosmétique
# Gemini 2.x : pas de raisonnement → case grisée + décochée + tooltip
# « Non disponible pour {model} ».
THINKING_SUPPORTED_MODELS = (
    GEMINI_THINKING_SUPPORTED
    | set(ANTHROPIC_MODELS.keys())
    | set(OPENAI_MODELS.keys())
)


def _toggle_thinking_for_model(model: str):
    """Handler Gradio : appelé sur model_in.change() / jarvis_model.change().
    Renvoie un gr.update pour la checkbox Raisonnement : interactive si
    le modèle supporte le thinking, sinon décoché + grisé."""
    if model in THINKING_SUPPORTED_MODELS:
        return gr.update(interactive=True)
    return gr.update(interactive=False, value=False)


def _thinking_tooltip_js(checkbox_elem_id: str) -> str:
    """Génère le JS qui met à jour le tooltip de la checkbox selon le
    modèle sélectionné. Reçoit le model_id en argument (1er input)."""
    return (
        "(model) => {"
        f"  const el = document.getElementById('{checkbox_elem_id}');"
        "  if (!el) return;"
        f"  const supported = {sorted(THINKING_SUPPORTED_MODELS)!r}.includes(model);"
        "  const tip = supported"
        "    ? 'Active le chain-of-thought sur ce modèle. Décoché : démarrage '"
        "      + 'plus rapide, comportement fonctionnel strictement identique '"
        "      + '(mêmes outils, mêmes sorties).'"
        "    : 'Non disponible pour ' + model;"
        "  el.title = tip;"
        "  el.querySelectorAll('label, input, span').forEach(c => c.title = tip);"
        "  el.dataset.tipApplied = '1';"  # éviter que le MutationObserver l'écrase
        "}"
    )


def _build_llm(model: str, api_key: str, *, use_thinking: bool = True,
               gemini_key_override: Optional[str] = None):
    """Instancie le ChatModel selon le modèle choisi.

    - claude-*   → Anthropic via clé visiteur (BYOK, sk-ant-...)
    - gpt-*      → OpenAI via clé visiteur (BYOK, sk-...)
    - hf-*       → HF Inference Providers (OpenAI-compatible) via token HF
                   (hf_...). Le modèle est routé sur le backend le plus rapide
                   pour son architecture (Cerebras pour Qwen, Together pour
                   Mistral) via le suffixe :provider du nom de modèle.

    `use_thinking` contrôle le chain-of-thought sur les modèles qui
    supportent un raisonnement explicite (« thought summary ») :
      - Gemini 3.x natifs : `include_thoughts=True, thinking_level="low"`
      - Claude Sonnet/Haiku 4.5 : `thinking={"type":"enabled","budget_tokens":1024}`
        (et `temperature=1.0`, requis par l'API)
      - GPT-4o / GPT-4o-mini : cochable mais no-op (l'API ne supporte
        pas `reasoning_effort` strictement)
      - Modèles dans OPENAI_REASONING_MODELS (vide actuellement) :
        `reasoning_effort="low"`
    Gemini 2.x : pas de raisonnement → case grisée. Décoché : démarrage
    plus rapide, comportement fonctionnel strictement identique
    (mêmes outils, mêmes sorties).

    Lève ValueError avec message utilisateur explicite si la clé manque.
    """
    if model.startswith("claude-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle Claude, colle ta clé Anthropic "
                "(sk-ant-...) ci-dessus. Crée-en une sur "
                "https://console.anthropic.com/settings/keys — la clé reste "
                "dans ta session, n'est ni sauvegardée ni loggée."
            )
        os.environ["ANTHROPIC_API_KEY"] = api_key.strip()
        from jdm_agent.tools.llm_factory import get_llm
        kwargs: dict = {}
        if use_thinking:
            # Extended thinking Anthropic — Claude Sonnet 4.5 / Haiku 4.5
            # le supportent (cf. https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking).
            # budget_tokens=1024 : minimum officiel, raisonnement léger.
            # temperature=1.0 est requis par l'API quand thinking est activé.
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": 1024}
            kwargs["temperature"] = 1.0
        return get_llm(provider="anthropic", model=model, **kwargs)

    if model.startswith("gpt-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle GPT, colle ta clé OpenAI (sk-...) "
                "ci-dessus. Crée-en une sur "
                "https://platform.openai.com/api-keys — la clé reste dans "
                "ta session, n'est ni sauvegardée ni loggée."
            )
        os.environ["OPENAI_API_KEY"] = api_key.strip()
        from jdm_agent.tools.llm_factory import get_llm
        kwargs: dict = {}
        if use_thinking and model in OPENAI_REASONING_MODELS:
            # GPT-5 / GPT-5 mini : reasoning_effort contrôle la profondeur
            # du chain-of-thought (low/medium/high). 'low' = comportement
            # raisonné léger, équivalent en intention au thinking_level
            # 'low' chez Gemini.
            kwargs["reasoning_effort"] = "low"
        return get_llm(provider="openai", model=model, **kwargs)

    # Gemini = seul provider gratuit avec un quota TPM assez large pour
    # notre prompt agent (~19-20 K tokens / appel à cause des 34 outils).
    # Token côté Space, gratuit pour le visiteur. Si épuisement → BYOK
    # Claude / GPT.
    if model.startswith("gemini-"):
        # 3.x preview → SDK natif Google (préserve thought_signature).
        # 2.x stables → endpoint OpenAI-compat (déjà éprouvé, plus simple).
        if model in GEMINI_NATIVE_REQUIRED:
            return _build_gemini_native(
                model, use_thinking=use_thinking,
                api_key_override=gemini_key_override,
            )
        return _build_openai_compat(
            model_id=model, label="Google Gemini",
            env_var="GOOGLE_API_KEY",
            env_var_help=(
                "L'admin du Space doit créer une clé sur https://aistudio.google.com/apikey "
                "(sans CB), et l'ajouter dans Settings → Variables & secrets."
            ),
            base_url=GEMINI_BASE_URL, routing=GEMINI_MODEL_ROUTING,
            api_key=api_key,
            # Pool override : si on a rotated le pool Gemini, on veut
            # utiliser CETTE clé pour 2.5 aussi (pas la 1ère env-seule).
            override_token=gemini_key_override,
        )

    raise ValueError(f"Modèle inconnu : {model!r}")


def _build_openai_compat(*, model_id: str, label: str, env_var: str,
                         env_var_help: str, base_url: str, routing: dict,
                         api_key: str = "", override_token: Optional[str] = None):
    """Builder commun pour les endpoints OpenAI-compatibles (HF / Groq / Gemini).

    Le token vient de l'env (côté Space), pas du champ BYOK. Le visiteur ne
    fournit rien — c'est gratuit pour lui, quota partagé.

    `override_token` : utilisé en PRIORITÉ sur l'env (cas du pool Gemini
    où on veut forcer une clé spécifique pour ce call).
    """
    env_token = os.environ.get(env_var, "").strip()
    if override_token and override_token.strip():
        token = override_token.strip()
        token_source = "override_token (pool)"
    else:
        token = env_token
        token_source = f"env {env_var}"
    # DIAG : enregistre l'état exact du build pour pouvoir diagnostiquer.
    _DEBUG_LAST_BUILD.clear()
    _DEBUG_LAST_BUILD.update({
        "builder": "_build_openai_compat",
        "model_id_requested": model_id,
        "env_var": env_var,
        "env_var_set": bool(env_token),
        "env_var_masked": _masked_key(env_token) if env_token else "(vide)",
        "override_token_provided": bool(override_token),
        "override_token_masked": (_masked_key(override_token.strip())
                                  if override_token and override_token.strip()
                                  else "(non fourni)"),
        "token_source": token_source,
        "token_used_masked": _masked_key(token) if token else "(vide)",
        "base_url": base_url,
        "routed_model": routing.get(model_id, "(routing manquant)"),
    })
    if not token:
        raise ValueError(
            f"Ce modèle nécessite un token {label} côté Space (variable "
            f"d'environnement {env_var}). {env_var_help} En cas d'épuisement "
            "du quota partagé, bascule sur un modèle BYOK Claude ou GPT."
        )
    routed_model = routing.get(model_id)
    if not routed_model:
        raise ValueError(f"Modèle inconnu pour {label} : {model_id!r}")
    from langchain_openai import ChatOpenAI
    # temperature : 1.5 sur Gemini OpenAI-compat (échelle 0..2).
    # Variété forte pour l'enrichissement/audit — 1.0 produisait
    # systématiquement les mêmes mots (« voiture », « chat »,
    # « manger »…) sur les tirages random côté LLM, 1.5 ouvre
    # significativement l'espace de choix sans rendre incohérent.
    # GPT (autres endpoints OpenAI-compat) tolère 0..2 aussi → on
    # met 1.3 pour eux, un peu moins agressif (GPT plus instable au-dessus).
    temp = 1.5 if "gemini" in routed_model.lower() else 1.3
    return ChatOpenAI(
        model=routed_model,
        base_url=base_url,
        api_key=token,
        temperature=temp,
    )


def _build_gemini_native(model_id: str, *, use_thinking: bool = True,
                         api_key_override: Optional[str] = None):
    """Builder spécifique pour les Gemini 3.x preview via SDK natif Google.

    Le SDK `langchain-google-genai` (qui enveloppe le SDK Python officiel
    `google-genai`) préserve automatiquement les `thought_signature` entre
    les tours, ce que ne fait PAS l'endpoint OpenAI-compatible — cf.
    https://github.com/langchain-ai/langchain/issues/34056

    Le token GOOGLE_API_KEY (côté Space, gratuit pour le visiteur) est lu
    automatiquement par le SDK depuis l'env.
    """
    # Priorité : override explicite (cas rotation pool) → première
    # clé non-blown du pool → GOOGLE_API_KEY singulier (rétro-compat).
    if api_key_override:
        token = api_key_override.strip()
    else:
        picked = pick_unblown_gemini_key(model_id)
        token = picked or os.environ.get("GOOGLE_API_KEY", "").strip()
    if not token:
        raise ValueError(
            "Ce modèle Gemini 3.x preview nécessite un token Google côté "
            "Space (variable d'environnement GOOGLE_API_KEY ou pool "
            "GOOGLE_API_KEYS). L'admin du Space doit créer une clé sur "
            "https://aistudio.google.com/apikey (sans CB), et l'ajouter "
            "dans Settings → Variables & secrets. Si toutes les clés du "
            "pool sont épuisées pour aujourd'hui, bascule sur un modèle "
            "BYOK Claude ou GPT."
        )
    routed_model = GEMINI_MODEL_ROUTING.get(model_id)
    if not routed_model:
        raise ValueError(f"Modèle Gemini natif inconnu : {model_id!r}")
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
    except ImportError as e:
        raise ValueError(
            "Le paquet `langchain-google-genai` est requis pour les modèles "
            "Gemini 3.x preview. Installe-le avec : "
            "pip install langchain-google-genai"
        ) from e
    # `include_thoughts=True` expose le RÉSUMÉ de raisonnement (Google
    # n'expose JAMAIS les raw thoughts — ce qu'on récupère est déjà un
    # « thought summary » synthétisé côté API). Arrive dans `m.content`
    # comme blocs {type:"thinking"} (v0) ou {type:"reasoning"} (v1),
    # consommés par `_content_to_thoughts`.
    #
    # `thinking_level="low"` : raisonnement léger sur Gemini 3.x — un cran
    # au-dessus de "minimal" (qui équivaut à « no thinking »), donne un
    # vrai chain-of-thought lisible sans coût massif. Niveaux dispo selon
    # https://ai.google.dev/gemini-api/docs/thinking :
    # minimal/low/medium/high. Exception : Gemini 3.1 Pro ne supporte pas
    # "minimal" mais accepte "low". try/except gère aussi le cas où la
    # version de langchain-google-genai ne connaît pas ces kwargs.
    base_kwargs = {
        "model": routed_model,
        "google_api_key": token,
        # temperature=1.5 sur Gemini natif (échelle 0..2). Variété
        # forte pour l'enrichissement : 1.0 collait aux mots les
        # plus fréquents (« voiture », « chat »…), 1.5 ouvre
        # significativement l'espace de tirage sans casser la
        # cohérence des tool_calls.
        "temperature": 1.5,
    }
    if not use_thinking:
        # Pas de chain-of-thought demandé → on n'active rien. Gemini répond
        # plus vite (pas de génération du « thought summary »), et le
        # comportement fonctionnel reste identique (mêmes outils, mêmes
        # sorties). On laisse aussi `thinking_level` non-défini : selon
        # la version langchain-google-genai, cela tombe sur le défaut
        # « no thinking » du SDK.
        return ChatGoogleGenerativeAI(**base_kwargs)
    # Safety net : si le modèle n'est PAS dans GEMINI_THINKING_SUPPORTED
    # (ex: 2.5-flash-lite), on n'envoie pas thinking_level — sinon l'API
    # renvoie 400 INVALID_ARGUMENT « Thinking level is not supported ».
    if model_id not in GEMINI_THINKING_SUPPORTED:
        return ChatGoogleGenerativeAI(**base_kwargs)
    try:
        return ChatGoogleGenerativeAI(
            **base_kwargs,
            include_thoughts=True,
            thinking_level="low",
        )
    except (TypeError, ValueError):
        return ChatGoogleGenerativeAI(**base_kwargs)


def _history_to_lc(history: list[dict], current_user_message: str) -> list:
    """Convertit l'historique Gradio (format messages) en messages LangChain.

    Filtre les traces de tools / messages vides / erreurs des tours précédents
    pour ne garder que les vraies bulles user/assistant utiles au contexte.
    """
    from langchain_core.messages import AIMessage, HumanMessage

    lc: list = []
    for h in history or []:
        role = h.get("role")
        content = (h.get("content") or "").strip()
        if not content or content.startswith("⚠️") or content.startswith("❌"):
            continue
        if role == "user":
            lc.append(HumanMessage(content=content))
        elif role == "assistant":
            # On nettoie de l'historique LLM les blocs annexes (compteur
            # outils, lien viz, anciens formats hérités) pour ne renvoyer
            # au LLM que le texte de réponse utile au contexte.
            answer_only = content
            for marker in (
                "\n\n*(",                           # nouveau compteur outils
                "\n\n📊 [Ouvrir la visualisation", # lien viz
                "\n\n---\n**Outils JDM appelés",   # ancien format markdown liste
                "\n\n---\n*Outils JDM appelés*",   # ancien markdown italique
                "\n\n<iframe",                      # ancien HTML
                "\n\n<details>",                    # ancien HTML
            ):
                answer_only = answer_only.split(marker, 1)[0]
            answer_only = answer_only.strip()
            if answer_only:
                lc.append(AIMessage(content=answer_only))
    lc.append(HumanMessage(content=current_user_message))
    return lc


def chat_with_agent(message: str, history: list[dict], api_key: str, model: str,
                    use_thinking: bool = True):
    """Générateur de streaming pour ChatInterface.

    Yields la trace progressive (thinking + appels d'outils + résultats)
    puis le message final + <details> avec le raisonnement complet.
    Même format que les flows Jarvis (cf. jarvis.run_jarvis_flow) :
    helpers de normalisation `_content_to_text` / `_content_to_thoughts`
    pour éviter de crasher quand m.content est une liste de blocs
    (Gemini avec include_thoughts=True), narration lexicalisée des
    outils connus, indicateur fugace « Génération en cours » pendant
    le silence du LLM, <details> collapsible à la fin pour ne pas
    polluer la réponse finale.
    """
    _NOOP_FILE = gr.update()
    if not message.strip():
        yield "Pose une question sur la langue française.", _NOOP_FILE
        return
    # Pool Gemini : on track la clé courante pour bascule sur PerDay.
    # Si toutes les clés du pool sont blown/invalides pour ce modèle,
    # on retombe sur la variable d'env singulière GOOGLE_API_KEY (qui
    # peut être utilisée même hors pool) et on la track quand même —
    # mark_blown ultérieur fonctionne et le dropdown reflète l'état.
    current_gemini_key: Optional[str] = None
    if model in GEMINI_MODELS:
        # Pick pour TOUS les Gemini (3.1, 3.5, 2.5) — pas seulement
        # NATIVE_REQUIRED. Sinon 2.5 (OpenAI-compat) tombe sur l'env
        # GOOGLE_API_KEY brut = CSV du pool non parsé = INVALID_KEY.
        current_gemini_key = pick_unblown_gemini_key(model)
        if not current_gemini_key:
            keys = _parse_google_keys()
            if keys:
                current_gemini_key = keys[0]
    set_current_gemini_key(current_gemini_key)
    # Annonce le modèle actif → préfixe ✅ devant lui dans le dropdown.
    set_current_model(model)
    try:
        llm = _build_llm(model, api_key, use_thinking=use_thinking,
                          gemini_key_override=current_gemini_key)
    except ValueError as e:
        yield f"⚠️ {e}", _NOOP_FILE
        return

    from jdm_agent.tools.jdm_agent import build_jdm_agent
    from langchain_core.messages import AIMessage, ToolMessage
    from jdm_agent.enrich.validators import exclusion_context
    from jarvis import (
        _content_to_text, _content_to_thoughts,
        _narrate_tool_call, _narrate_tool_result,
    )

    # 2 listes parallèles (cf. jarvis.run_jarvis_flow) :
    # - progress_live : affiché pendant le streaming
    # - progress_full : version complète pour le <details> final
    progress_live: list[str] = ["*🧠 Réflexion en cours…*"]
    progress_full: list[str] = []
    final_answer: str = ""
    viz_path: Optional[str] = None

    def _add_line(line: str) -> None:
        progress_live.append(line)
        progress_full.append(line)

    yield "\n\n".join(progress_live), _NOOP_FILE

    # Retry sur quota PerMinute Gemini — cf. detect_rate_limit_retry
    # dans jarvis.py. Si l'API renvoie 429 PerMinute, on attend le délai
    # annoncé puis on CONTINUE le travail en cours (les messages déjà
    # produits par l'agent sont accumulés et re-passés à agent.stream()
    # pour reprendre là où on s'est arrêté — pas de redémarrage).
    # exclusion_context vit AUTOUR du while pour être maintenu entre
    # retries.
    import time as _time
    from jarvis import detect_rate_limit_retry
    agent = build_jdm_agent(client=get_client(), llm=llm)
    accumulated_messages = _history_to_lc(history, message)
    rate_limit_attempts = 0
    consecutive_rate_limit_hits = 0
    MAX_CONSECUTIVE_RATE_LIMIT = 3
    with exclusion_context():
        # Retry rate limit ILLIMITÉ tant que le délai est court
        # ET qu'on fait du progrès entre deux hits (cf. cap consécutifs
        # ci-dessous). Si quotas croisés Google free tier, on remonte.
        while True:
            try:
                for chunk in agent.stream(
                    {"messages": accumulated_messages},
                    stream_mode="updates",
                ):
                    # Reset compteur de hits consécutifs : on a reçu
                    # un chunk = du progrès LLM réel.
                    consecutive_rate_limit_hits = 0
                    for _node_name, payload in chunk.items():
                        msgs = (payload or {}).get("messages") or []
                        for m in msgs:
                            # Accumulation pour reprise après pause quota.
                            accumulated_messages.append(m)
                            if isinstance(m, AIMessage):
                                tcs = getattr(m, "tool_calls", []) or []
                                # 1) Chain-of-thought (Gemini, Claude Extended)
                                thoughts = _content_to_thoughts(m.content)
                                if thoughts.strip():
                                    t = thoughts.strip()
                                    t_html = (
                                        t.replace("&", "&amp;")
                                         .replace("<", "&lt;")
                                         .replace(">", "&gt;")
                                         .replace("\n", "<br>")
                                    )
                                    _add_line(
                                        f'<div class="jdm-thinking">💭 {t_html}</div>'
                                    )
                                # 2) Texte parlé entre tool_calls (Claude/GPT)
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
                                    live_with_pending = (
                                        "\n\n".join(progress_live)
                                        + "\n\n*⏳ Génération en cours…*"
                                    )
                                    yield live_with_pending, _NOOP_FILE
                                else:
                                    # Pas de tool_calls → réponse finale
                                    final_answer = spoken
                            elif isinstance(m, ToolMessage):
                                content = _content_to_text(m.content)
                                # Détecte un retour de build_subgraph_visualization
                                if m.name == "build_subgraph_visualization":
                                    viz_path = _extract_html_path(content)
                                narrated_done = _narrate_tool_result(m.name, content)
                                if narrated_done:
                                    _add_line(
                                        f'<div class="jdm-narration">'
                                        f'{narrated_done}</div>'
                                    )
                                else:
                                    preview = content[:140].replace("\n", " ")
                                    if len(content) > 140:
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
                            yield live_with_pending, _NOOP_FILE
                # Sortie normale → on quitte le while
                break
            except Exception as e:
                # 0) Clé API invalide → marque + switch UNIQUEMENT si
                # c'est le modèle protégé (3.1) qui rejette. Sinon
                # (2.5 / 3.5), INVALID_KEY peut être trompeur (modèle
                # pas dispo sur cette clé, endpoint OpenAI-compat
                # capricieux). On abort proprement sans toucher au pool.
                from jarvis import is_invalid_api_key
                if is_invalid_api_key(e):
                    if model != GEMINI_POOL_PROTECTED_MODEL:
                        yield (
                            f"⚠️ La clé Google a renvoyé `API_KEY_INVALID` "
                            f"pour `{model}`. Cela peut indiquer un problème "
                            f"spécifique à ce modèle (pas dispo sur cette clé, "
                            f"endpoint OpenAI-compat capricieux). La clé n'est "
                            f"**PAS** marquée invalide globalement. ➡️ Bascule "
                            f"sur `{GEMINI_POOL_PROTECTED_MODEL}` ou un BYOK "
                            f"Claude/GPT.",
                            _NOOP_FILE,
                        )
                        return
                    switched = False
                    try:
                        if current_gemini_key:
                            mark_gemini_key_invalid(current_gemini_key)
                        next_key = pick_unblown_gemini_key(
                            model, skip=current_gemini_key
                        )
                        if next_key:
                            pool_n = gemini_pool_size()
                            current_gemini_key = next_key
                            set_current_gemini_key(current_gemini_key)
                            llm = _build_llm(
                                model, api_key,
                                use_thinking=use_thinking,
                                gemini_key_override=current_gemini_key,
                            )
                            agent = build_jdm_agent(
                                client=get_client(), llm=llm
                            )
                            switch_msg = (
                                f"\n\n*🔑 Clé Google invalide détectée — "
                                f"bascule sur une autre clé du pool "
                                f"(pool : {pool_n} clés).*"
                            )
                            current_progress = "\n\n".join(progress_live)
                            yield current_progress + switch_msg, _NOOP_FILE
                            switched = True
                    except Exception:
                        pass
                    if switched:
                        continue
                    # Toutes les clés ont échoué — yield un message
                    # clair au chatbot avec DIAGNOSTIC des clés parsées
                    # (4 premiers + 4 derniers chars de chacune) pour
                    # vérifier que le parsing CSV n'a rien tronqué.
                    parsed = _parse_google_keys()
                    diag = "\n".join(
                        f"  - {i+1}. {_masked_key(k)}"
                        for i, k in enumerate(parsed)
                    ) or "  (aucune clé parsée — vérifie GOOGLE_API_KEYS)"
                    yield (
                        "❌ **Toutes les clés Google du pool ont échoué**.\n\n"
                        f"**Diagnostic** : {len(parsed)} clé(s) parsée(s) "
                        f"depuis `GOOGLE_API_KEYS` :\n{diag}\n\n"
                        "Vérifie ci-dessus que chaque clé a la **longueur "
                        "attendue (~39 chars)** et commence par `AIza`. "
                        "Si une clé est tronquée → problème de parsing CSV.\n\n"
                        "Sinon, causes possibles côté Google :\n"
                        "1. Clés non **activées pour l'API Generative "
                        "Language** (Google Cloud Console → APIs & Services).\n"
                        "2. Clés d'un projet sans accès aux modèles Gemini 3.x.\n"
                        "3. Quotas PerDay tous épuisés (reset minuit UTC).\n\n"
                        "Bascule sur un modèle BYOK (Claude / GPT) pour "
                        "continuer dès maintenant."
                    ), _NOOP_FILE
                    return
                # 1) Quota QUOTIDIEN épuisé.
                # On TRACE TOUJOURS la clé courante comme blown pour
                # ce modèle (UI dropdown : « épuisé » quand toutes les
                # clés sont blown). On ne BASCULE de clé que si on est
                # sur le modèle protégé (gemini-3.1-flash-lite, 500
                # req/jour). Pour les autres (~20 req/jour), on remonte
                # l'erreur après le marquage.
                from jarvis import is_per_day_quota_exhausted
                if is_per_day_quota_exhausted(e, expected_model=model):
                    if current_gemini_key:
                        mark_gemini_key_blown(current_gemini_key, model)
                # PerDay sur modèle non-protégé : on bascule le dropdown
                # sur 3.1 et on ABORT. L'utilisateur ré-envoie son message
                # s'il veut retry avec 3.1 (« oui »), sinon il choisit
                # autre chose (« non »). Pas d'auto-retry silencieux.
                if (model != GEMINI_POOL_PROTECTED_MODEL
                        and is_per_day_quota_exhausted(e, expected_model=model)):
                    try:
                        set_current_model(GEMINI_POOL_PROTECTED_MODEL)
                    except Exception:
                        pass
                    # Extrait un snippet du message API réel pour
                    # transparence (cas où la détection a tort).
                    err_snippet = str(e)[:500].replace("`", "ʼ")
                    switch_msg = (
                        f"⚠️ **Modèle `{model}` épuisé pour aujourd'hui** "
                        f"(quota quotidien).\n\n"
                        f"Le sélecteur est passé sur "
                        f"`{GEMINI_POOL_PROTECTED_MODEL}` (500 req/j).\n\n"
                        f"➡️ **Renvoie ton message** pour continuer avec "
                        f"`{GEMINI_POOL_PROTECTED_MODEL}`, ou choisis un "
                        f"autre modèle BYOK (Claude / GPT).\n\n"
                        f"<details><summary>Erreur API brute (debug)</summary>\n\n"
                        f"```\n{err_snippet}\n```\n</details>"
                    )
                    yield switch_msg, _NOOP_FILE
                    return
                if (model == GEMINI_POOL_PROTECTED_MODEL
                        and is_per_day_quota_exhausted(e, expected_model=model)):
                    switched = False
                    try:
                        if current_gemini_key:
                            mark_gemini_key_blown(current_gemini_key, model)
                        next_key = pick_unblown_gemini_key(
                            model, skip=current_gemini_key
                        )
                        if next_key:
                            pool_n = gemini_pool_size()
                            current_gemini_key = next_key
                            set_current_gemini_key(current_gemini_key)
                            llm = _build_llm(
                                model, api_key,
                                use_thinking=use_thinking,
                                gemini_key_override=current_gemini_key,
                            )
                            agent = build_jdm_agent(
                                client=get_client(), llm=llm
                            )
                            switch_msg = (
                                f"\n\n*🔄 Quota quotidien atteint sur cette "
                                f"clé Google — bascule sur une autre clé du "
                                f"pool (pool : {pool_n} clés).*"
                            )
                            current_progress = "\n\n".join(progress_live)
                            yield current_progress + switch_msg, _NOOP_FILE
                            switched = True
                    except Exception:
                        pass
                    if switched:
                        continue
                    raise RuntimeError(
                        "Quota quotidien Gemini free tier épuisé sur "
                        "TOUTES les clés du pool (ou pool vide). Le "
                        "quota se réinitialise à minuit UTC. Réessaie "
                        "demain ou bascule sur un modèle BYOK "
                        "(Claude / GPT)."
                    ) from e
                # 2) Quota PerMinute Gemini : on attend + on CONTINUE le
                # travail (pas de reset). accumulated_messages contient
                # tout ce que l'agent a déjà produit — on le passe tel
                # quel au prochain agent.stream() pour reprendre là où
                # on s'est arrêté.
                retry_delay = detect_rate_limit_retry(e)
                if retry_delay is not None:
                    consecutive_rate_limit_hits += 1
                    if consecutive_rate_limit_hits >= MAX_CONSECUTIVE_RATE_LIMIT:
                        raise RuntimeError(
                            f"Quotas Gemini free tier croisés "
                            f"({consecutive_rate_limit_hits} hits PerMinute "
                            f"consécutifs sans progrès). Les fenêtres "
                            f"glissantes ne s'ouvrent jamais en même temps. "
                            f"Réessaie dans quelques minutes ou bascule sur "
                            f"un modèle BYOK (Claude / GPT)."
                        ) from e
                    rate_limit_attempts += 1
                    wait_msg = (
                        f"\n\n*⏳ Quota Gemini free tier atteint — j'attends "
                        f"{retry_delay:.0f}s puis je CONTINUE le travail en "
                        f"cours (pas de redémarrage).*"
                    )
                    current_progress = "\n\n".join(progress_live)
                    yield current_progress + wait_msg, _NOOP_FILE
                    _time.sleep(retry_delay)
                    # PAS de reset des progress / accumulated_messages,
                    # MAIS strip des blocs thinking pour économiser les
                    # tokens (le LLM n'a pas besoin de ses pensées pour
                    # continuer). On garde le DERNIER thinking pour
                    # la signature Gemini 3.x.
                    from jarvis import strip_thinking_blocks
                    accumulated_messages = strip_thinking_blocks(
                        accumulated_messages, keep_last=True
                    )
                    continue
                # Erreur non-retryable ou déjà tenté
                err_block = ""
                if progress_full:
                    err_block = (
                        f"\n\n<details><summary>🧠 Voir les étapes avant erreur "
                        f"({len(progress_full)})</summary>\n\n"
                        f"{(chr(10)*2).join(progress_full)}\n\n</details>"
                    )
                yield f"❌ Erreur agent : {e}" + err_block, _NOOP_FILE
                return

    # Viz : iframe interactif embarqué dans un gr.HTML séparé.
    viz_html = _stage_viz_html(viz_path) if viz_path else None

    # Réponse finale + footer viz éventuel + <details> raisonnement.
    out = final_answer or "*(réponse vide)*"
    if viz_path:
        out += "\n\n📊 *Visualisation interactive disponible ci-dessous ↓*"
    if progress_full:
        full_text = "\n\n".join(progress_full)
        n_steps = len(progress_full)
        plural = "s" if n_steps > 1 else ""
        # Libellé adaptatif selon que le raisonnement LLM a été demandé
        # ou non (cf. run_jarvis_flow pour le même pattern).
        if use_thinking:
            summary_label = (
                f"🧠 Voir le résumé du raisonnement "
                f"({n_steps} étape{plural})"
            )
        else:
            summary_label = f"🧠 Voir les étapes ({n_steps} étape{plural})"
        out += (
            f"\n\n<details><summary>{summary_label}</summary>\n\n"
            f"{full_text}\n\n</details>"
        )

    if viz_html:
        yield out, gr.update(value=viz_html, visible=True)
    else:
        yield out, _NOOP_FILE


def _extract_html_path(tool_message_content: str) -> Optional[str]:
    """Extrait `html_path` d'un retour de build_subgraph_visualization.

    Le ToolMessage contient le dict sérialisé en JSON (ou en repr Python
    selon LangChain). On essaie les deux.
    """
    import json
    import re
    if not tool_message_content:
        return None
    # 1) Essai JSON propre
    try:
        d = json.loads(tool_message_content)
        if isinstance(d, dict) and d.get("html_path"):
            return str(d["html_path"])
    except Exception:
        pass
    # 2) Fallback : regex sur 'html_path' dans la chaîne brute
    m = re.search(r"['\"]html_path['\"]\s*:\s*['\"]([^'\"]+)['\"]", tool_message_content)
    if m:
        return m.group(1)
    return None


def _stage_viz_html(html_path: str) -> Optional[str]:
    """Compose l'HTML du composant viz : iframe sandbox de la viz courante
    + bouton fermer + liste de TOUTES les viz générées dans la session
    (replie l'iframe au clic et présente la liste ; chaque entrée a un
    bouton « voir » qui ré-ouvre l'iframe avec ce fichier, et un bouton
    « télécharger »).

    Stratégie : on copie le fichier passé en argument dans VIZ_DIR sous
    un nom canonique `chat_<stem>_<hash>.html`, puis on glob VIZ_DIR
    pour bâtir l'inventaire. Garantit que la viz courante apparaît dans
    la liste — même si l'agent l'a écrite ailleurs (CWD par défaut).

    Retourne None si la lecture du fichier courant échoue.
    """
    import base64 as _b64
    import hashlib as _hashlib
    import json as _json
    import shutil as _shutil
    from pathlib import Path as _Path

    src = _Path(html_path)
    if not src.exists():
        return None
    try:
        current_text = src.read_text(encoding="utf-8")
    except Exception:
        return None

    # Copie dans VIZ_DIR sous un nom canonique pour qu'il apparaisse dans
    # le glob. Hash du contenu = idempotent (mêmes graphes → même nom).
    stem = src.stem.removeprefix("chat_").removeprefix("viz_") or "viz"
    h = _hashlib.sha1(current_text.encode("utf-8")).hexdigest()[:8]
    canonical = VIZ_DIR / f"chat_{stem}_{h}.html"
    if not canonical.exists():
        try:
            canonical.write_text(current_text, encoding="utf-8")
        except Exception:
            pass  # si l'écriture échoue, on continue avec ce qu'on a

    current_b64 = _b64.b64encode(current_text.encode("utf-8")).decode("ascii")

    # Inventaire de TOUS les fichiers viz stagés dans la session, triés
    # par date de modif desc (les plus récents en haut). On accepte les
    # deux préfixes : `chat_*` (cet agent) ET `viz_*` (tab Sous-graphe).
    viz_files = sorted(
        list(VIZ_DIR.glob("chat_*.html")) + list(VIZ_DIR.glob("viz_*.html")),
        key=lambda p: -p.stat().st_mtime,
    )
    files_data = []
    for f in viz_files:
        try:
            txt = f.read_text(encoding="utf-8")
        except Exception:
            continue
        b64 = _b64.b64encode(txt.encode("utf-8")).decode("ascii")
        # Nom lisible : on retire le préfixe et le suffixe hashé.
        # Format : chat_<stem>_<hash>.html ou viz_<hash>.html
        bare = f.stem.removeprefix("chat_").removeprefix("viz_")
        nice = bare.rsplit("_", 1)[0] or bare or f.stem
        files_data.append({
            "id": f.stem,
            "label": nice,
            "size_kb": round(f.stat().st_size / 1024, 1),
            "b64": b64,
        })

    # Données passées EN ARGUMENT du onclick="vizClose('...')" — la
    # seule méthode survivant à DOMPurify de Gradio (qui strippe les
    # data-*, les <pre>, les <script>, et les éléments style=display:none).
    # Base64 ASCII pur → safe dans l'attribut JS (ni quote ni < ni >).
    # vizClose() reçoit la data, la parse et la stocke sur l'élément
    # container pour les appels vizOpen() suivants.
    files_b64 = _b64.b64encode(
        _json.dumps(files_data).encode("utf-8")
    ).decode("ascii")

    # Couleurs adaptatives au thème via CSS variables Gradio
    # (--block-background-fill, --body-text-color, etc.) — fond
    # transparent qui hérite du composant parent. Pas de fond blanc
    # forcé qui tranche avec le thème dark.
    return f"""
<div id="viz-container"
     style="margin:8px 0;border:1px solid var(--border-color-primary,#ddd);border-radius:8px;background:var(--block-background-fill,transparent);overflow:hidden;">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background-fill-secondary,#f3f4f6);border-bottom:1px solid var(--border-color-primary,#ddd);">
    <span style="font-weight:500;color:var(--body-text-color,#444);font-size:0.9em">
      🕸️ <span id="viz-title">Visualisation interactive du sous-graphe</span>
      <span style="color:var(--body-text-color-subdued,#999);font-size:0.85em">
        — zoom : molette · déplacer : glisser · double-clic : recentrer
      </span>
    </span>
    <button id="viz-close-btn" onclick="window.vizClose('{files_b64}')"
            style="background:var(--button-secondary-background-fill,#fff);border:1px solid var(--border-color-primary,#ccc);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.85em;color:var(--body-text-color,#444);">
      ✖ Fermer
    </button>
  </div>
  <iframe id="viz-iframe" src="data:text/html;base64,{current_b64}"
          style="width:100%;height:700px;border:0;background:#fff;display:block;"
          sandbox="allow-scripts allow-same-origin"></iframe>
  <div id="viz-list" style="display:none;padding:14px;">
    <div style="font-weight:500;color:var(--body-text-color,#444);margin-bottom:10px;">
      📁 Visualisations générées dans cette session
    </div>
    <div id="viz-list-rows" style="color:var(--body-text-color,#444);"></div>
  </div>
</div>
"""


# ---------- UI ----------

THEME = gr.themes.Soft(primary_hue="violet", secondary_hue="amber")

PROJET_MD = """# JDMAgent — Démo interactive

**Objectif** : agentification de [JeuxDeMots](https://www.jeuxdemots.org)
(LIRMM/CNRS, ~2 M nœuds, 180+ relations typées) pour les LLM modernes via
**LangChain** et le **Model Context Protocol**.

## Que peux-tu faire dans cette démo ?

- **🔎 Explorer JDM** — choisis un terme et une relation, vois les triplets
  triés par poids consensuel. Annotations sémantiques (constitutif,
  contrastif, exception, …) optionnelles. Désambiguïsation des termes
  polysémiques (avocat, souris, police…).
- **⚖️ Claim checker** — vérifie une affirmation factuelle contre JDM de
  façon **déterministe** (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN
  avec citations des triplets utilisés.
- **🕸️ Sous-graphe** — visualisation interactive (vis-network) du
  voisinage sémantique d'un terme jusqu'à profondeur 4, sélection de
  relations indépendante par niveau, négations en rouge.
- **🤖 Agent** — conversation avec un agent (Gemini hébergé gratuit, ou
  BYOK Claude/GPT) qui n'utilise QUE les outils JDM et cite ses sources.
- **🦾 Jarvis** — flux guidés par formulaires (zéro prompt à taper) :
  - <small>🌱</small> *Enrichissement* — propose et consolide de nouveaux triplets (`.enrich`)
  - <small>🔍</small> *Audit* — détecte les contaminations par les sens non-premiers (`.audit`)
  - <small>🕳️</small> *Détection de trous* — flagge MISSING / NEGATIVE / LOW_COVERAGE
  - <small>⚠️</small> *Signalement* — flagge les triplets suspects au LLM (`.err`)
  - <small>📊</small> *Statistiques* — couverture par relation et par termes rencontrés (`.stat`)

## Le projet en bref

- Couche client typée (`JDMClient`) sur l'[API JeuxDeMots](https://jdm-api.demo.lirmm.fr)
  + cache disque + retry exponentiel.
- ~35 outils MCP exposés à n'importe quel client (Claude Code/Desktop,
  Cursor, etc.) via [FastMCP](https://github.com/jlowin/fastmcp).
- Pipeline fact-check déterministe + détection de gaps + **moteur
  d'inférence symbolique borné** pour la consolidation des candidats avant
  soumission au canal contributif LLMDrops de JDM.
- Visualisation sous-graphe HTML autonome (vis-network) avec sélection de
  relations par niveau, palette par famille de relation et opacité
  progressive.

**Données** : JeuxDeMots — Mathieu Lafourcade, équipe TEXTE, LIRMM/CNRS.

**Liens** :
[Code source & README académique](https://github.com/expAg/JDMAgent) ·
[USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md) ·
[Notebook Colab](https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb)
"""


AIDE_MD = """# 🛠️ Aide & Installation

## 1. Naviguer dans la démo

| Onglet | Ce qu'il fait | Clé API ? |
|---|---|---|
| 📋 **Projet** | Présentation, liens code source | Aucune |
| 🔎 **Explorer JDM** | Table de triplets pour un terme/relation, déterministe | Aucune |
| ⚖️ **Claim checker** | SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet, déterministe | Aucune |
| 🕸️ **Sous-graphe** | Visualisation vis-network interactive du voisinage | Aucune |
| 🤖 **Agent** | Chat libre avec un agent LLM qui utilise les 34 outils JDM | Gemini hébergé gratuit, ou BYOK Claude / GPT |
| 🦾 **Jarvis** | Flows guidés par formulaires (5 sous-onglets) | Gemini hébergé gratuit ; clé LLMDrops si tu veux pousser vers JDM |
| 🛠️ **Aide** | Ce document | — |

## 2. Jarvis en détail — 5 flows guidés

Tous les sous-onglets Jarvis partagent un **bandeau** en haut :
- **Clé API LLMDrops** (optionnel) : override l'env `JDM_DROPS_API_KEY` pour les uploads.
- **Modèle LLM** : Gemini 3.1 Flash Lite par défaut (500 requêtes/jour gratuites). BYOK Claude / GPT possibles si tu colles ta clé.
- **Budget d'appels d'outils** : 10 / 25 / 50 / 100 / illimité. Au-delà, le LLM reçoit un sentinel et arrête proprement en consolidant ce qu'il a.

### 🌱 Enrichissement
Propose et consolide de nouveaux triplets pour un terme.
- **Form** : terme, relation cible (optionnelle), nombre cible de triplets, varier les relations, itérer jusqu'au but, soumettre directement.
- **Output** : chatbot avec le raisonnement + le fichier `.enrich` écrit.
- **Workflow** : `enrichment_workflow()` (pré-fetch → désambiguïsation → proposition → validation+consolidation par inférence → écriture).

### 🔍 Audit
Audit sémantique de la répartition des sens d'un terme polysémique.
- **Form** : terme, relation cible optionnelle, soumettre directement.
- **Output** : verdict par triplet du terme générique (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative.
- **Workflow** : `audit_workflow()`.

### 🕳️ Détection de trous
Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE).
- **Form** : terme, relations à examiner (vide = défauts), seuil LOW_COVERAGE.
- **Output gauche** : tableau des gaps trouvés (déterministe, instantané) + dropdown pour router un gap → boutons **→ Enrichir** / **→ Auditer** / **→ Stats** qui pré-remplissent les autres sous-onglets et basculent l'onglet.
- **Output droite** : synthèse narrative de l'agent.
- **Workflow** : `gap_detection_workflow()`.

### ⚠️ Signalement
Le LLM utilise son **jugement linguistique** pour flagger les triplets suspects (pas besoin de preuve d'outil).
- **Form** : terme, relation optionnelle, soumettre directement.
- **Output** : fichier `.err` avec catégorie de suspicion et justification.
- **Workflow** : `signalement_workflow()`.

### 📊 Stats
Statistiques de couverture par terme et/ou par relation.
- **Form** : terme (mode PAR_TERME), relation (mode PAR_RELATION) — au moins un des deux.
- **Output** : tableau (n_total, n_pos, n_neg, max_w, min_w, mean_w par relation) + 3-5 observations clés.
- **Workflow** : `stats_workflow()`.

## 3. Obtenir les clés API

| Clé | Où ? | Coût | Quand l'utiliser |
|---|---|---|---|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Gratuit (500 req/jour pour 3.1 Flash Lite) | Pré-configurée côté HF Space, rien à faire pour toi |
| **LLMDrops JDM** | jeuxdemots.org (contacter M. Lafourcade) | Gratuit sur demande | Soumettre `.enrich` / `.audit` / `.err` directement à JDM |
| **Anthropic (Claude)** | [console.anthropic.com](https://console.anthropic.com) | Payant ($) | BYOK Claude dans Agent / Jarvis |
| **OpenAI (GPT)** | [platform.openai.com](https://platform.openai.com/api-keys) | Payant ($) | BYOK GPT dans Agent / Jarvis |

⚠️ **Sécurité** : les clés que tu colles dans l'UI ne sont **jamais persistées** côté serveur — elles vivent uniquement le temps de ton onglet navigateur.

## 4. Installation locale (déployer la même app ailleurs)

Recette complète pour faire tourner la démo Gradio sur ta machine (Linux / macOS / Windows) ou sur un serveur (LIRMM, VPS, etc.) :

```bash
# 1. Cloner le repo
git clone https://github.com/expAg/JDMAgent.git
cd JDMAgent

# 2. Créer un environnement Python isolé (venv) dans le repo
#    Sur Debian/Ubuntu : sudo apt install python3-venv si pas déjà là
python3 -m venv .venv

# 3. Activer le venv
source .venv/bin/activate          # Linux / macOS
# .venv\\Scripts\\activate           # Windows (cmd / PowerShell)

# 4. Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt

# 5. Configurer les clés API (copie le template puis édite)
cp .env.example .env
# édite .env : ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY /
# GROQ_API_KEY / DEEPSEEK_API_KEY / JDM_DROPS_API_KEY / LLM_PROVIDER /
# LLM_MODEL — seules les clés des providers que tu veux utiliser sont
# obligatoires, le reste peut rester vide.

# 6. Lancer l'app — écoute sur http://0.0.0.0:7860
python app.py
```

Ensuite, dans ton navigateur → <http://localhost:7860> (ou l'IP du serveur sur le port 7860 si déploiement distant).

**Sur Debian 12 / Ubuntu 24.04 (PEP 668)** : pip refuse d'installer hors venv — le venv ci-dessus est donc **obligatoire**, pas optionnel. Ne contourne pas avec `--break-system-packages` (casse les outils OS).

**Pour ré-utiliser sans tout retaper** : `cd /chemin/JDMAgent && source .venv/bin/activate && python app.py`. Ou en service systemd, invoque directement `.venv/bin/python app.py` (pas besoin d'activate).

Voir [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md) pour les détails (CLI, MCP, fact-check programmatique).

## 5. Serveur MCP — utiliser les 34 outils JDM dans Claude Code / Cursor

```bash
# Installation locale (stdio)
claude mcp add jdm "python -m jdm_agent.mcp.server"

# Vérification
claude mcp list
```

Ensuite, depuis Claude Code : « Donne-moi les synonymes de voiture dans JDM » → l'agent appelle automatiquement les outils MCP exposés.

## 6. Format des fichiers de soumission

Tous les fichiers produits par Jarvis suivent un **format pipe** :

```
# .enrich (proposition de triplets)
term | relation | target | annotation < explication chaîne d'inférence >

# .audit (deux sections séparées par === META ===)
=== PROPOSITIONS ===
term | relation | target | annotation | verdict | justification
...
=== META ===
<compte rendu narratif sur la confusion / propagation des sens>

# .err (suspects flaggés par le LLM)
term | relation | target | catégorie_suspect | justification
```

Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
- coche **Soumettre directement** dans le formulaire (la clé `JDM_DROPS_API_KEY` doit être configurée) ;
- ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.

## 7. Liens utiles

- **Code source** : <https://github.com/expAg/JDMAgent>
- **API JeuxDeMots** : <https://jdm-api.demo.lirmm.fr>
- **JeuxDeMots (site)** : <https://www.jeuxdemots.org>
- **USAGE.md détaillé** : <https://github.com/expAg/JDMAgent/blob/main/USAGE.md>
- **DEVELOPMENT.md** : <https://github.com/expAg/JDMAgent/blob/main/DEVELOPMENT.md>
"""


# ---------- Tab 4: Sous-graphe (visualisation) ----------

import base64 as _b64
import tempfile

# RÉPERTOIRE UNIFIÉ des productions JDM Agent.
# Tous les flows (sous-graphes HTML, enrichissements .enrich, audits .audit,
# signalements .err, stats .stat) écrivent dans ce dossier unique pour :
#   1. Centraliser dans l'onglet « 📁 Productions » (FileExplorer)
#   2. Simplifier le `allowed_paths` du launch Gradio
#   3. Persister sur /tmp (seul dir fiable sur HF Spaces, cf. /tmp/jdm_cache)
PRODUCTIONS_DIR = Path("/tmp/jdm_outputs")
PRODUCTIONS_DIR.mkdir(parents=True, exist_ok=True)
# VIZ_DIR conservé comme ALIAS du dir unifié — pour rétro-compat des
# code paths qui le référencent encore. Pas de second répertoire.
VIZ_DIR = PRODUCTIONS_DIR

# Liste des relations principales exposées aux formulaires Jarvis +
# Sous-graphe. Sortie au niveau module pour être réutilisable.
JARVIS_RELATIONS: list[str] = list(DEFAULT_RELATIONS) + [
    r for r in (
        "r_syn", "r_anto", "r_agent-1", "r_patient-1", "r_instr-1",
        "r_telic_role", "r_lieu", "r_has_color", "r_has_part",
        "r_make", "r_processus>agent", "r_processus>patient",
        "r_has_conseq", "r_has_causatif", "r_domain", "r_associated",
    )
    if r not in DEFAULT_RELATIONS
]


def viz_subgraph(term: str, depth: float,
                 top_k: float, top_k_d2: float, top_k_d3: float, top_k_d4: float,
                 selected_relations: list[str],
                 selected_depth2_relations: list[str],
                 selected_depth3_relations: list[str],
                 selected_depth4_relations: list[str]):
    """Construit un sous-graphe et renvoie (status, html_inline, file_for_download).

    Stratégie multi-fallback :
    - **HTML inline** via iframe data:base64 (marche si DOMPurify autorise data:)
    - **Téléchargement** du même fichier via gr.File (toujours dispo, plan B sûr)
    - Logs côté serveur (visibles dans HF Spaces) pour diagnostic en cas d'écran blanc.
    """
    term = (term or "").strip()
    if not term:
        return "⚠️ Saisis un terme.", "", None
    # Résolution raffinement + contrôle de présence dans JDM.
    term, _err = _resolve_and_check(get_client(), term)
    if _err:
        return f"⚠️ {_err}", "", None
    rels = selected_relations if selected_relations else None
    d2_rels = selected_depth2_relations if selected_depth2_relations else None
    d3_rels = selected_depth3_relations if selected_depth3_relations else None
    d4_rels = selected_depth4_relations if selected_depth4_relations else None
    try:
        cache_key = (term, depth, top_k, top_k_d2, top_k_d3, top_k_d4,
                     tuple(rels or ()), tuple(d2_rels or ()),
                     tuple(d3_rels or ()), tuple(d4_rels or ()))
        # Nom incluant terme + timestamp court → lisible dans l'onglet
        # Productions ET unique par requête (hash trop opaque pour l'UI).
        # Le timestamp court (HHMMSS) garantit qu'une re-requête sur le
        # même terme produit un fichier distinct (pas d'écrasement).
        import time as _time_mod_viz
        _safe_term = "".join(ch if ch.isalnum() or ch in "_-" else "_"
                             for ch in (term or "x"))[:40]
        _ts_short = _time_mod_viz.strftime("%H%M%S")
        out_path = VIZ_DIR / f"viz_{_safe_term}_{_ts_short}.html"
        # Safety anti-collision (rare : 2 viz exactement à la même seconde)
        _i = 2
        while out_path.exists():
            out_path = VIZ_DIR / f"viz_{_safe_term}_{_ts_short}_{_i}.html"
            _i += 1
        print(f"[viz] term={term!r} depth={depth} "
              f"top_k=[{top_k},{top_k_d2},{top_k_d3},{top_k_d4}] "
              f"rels={rels} d2={d2_rels} d3={d3_rels} d4={d4_rels}", flush=True)
        res = build_subgraph(
            term,
            client=get_client(),
            depth=int(depth),
            top_k_per_relation=int(top_k),
            top_k_depth2=int(top_k_d2),
            top_k_depth3=int(top_k_d3),
            top_k_depth4=int(top_k_d4),
            relations=rels,
            depth2_relations=d2_rels,
            depth3_relations=d3_rels,
            depth4_relations=d4_rels,
            output="html",
            output_path=str(out_path),
        )
        s = res["stats"]
        print(f"[viz] generated {s['n_nodes']} nodes / {s['n_edges']} edges -> {out_path}",
              flush=True)
        html_text = out_path.read_text(encoding="utf-8")
        b64 = _b64.b64encode(html_text.encode("utf-8")).decode("ascii")
        iframe = (
            f'<iframe src="data:text/html;base64,{b64}" '
            f'style="width:100%;height:910px;border:1px solid #ddd;'
            f'border-radius:8px;background:#fff;display:block;" '
            f'sandbox="allow-scripts allow-same-origin"></iframe>'
        )
        status = (
            f"✅ **{s['n_nodes']} nœuds**, **{s['n_edges']} arêtes** "
            f"(dont **{s['n_negative']} négations** en rouge) — profondeur {s['depth']}.\n\n"
            f"*Si le graphe ne s'affiche pas inline ci-dessous, "
            f"télécharge le fichier HTML et ouvre-le dans ton navigateur.*"
        )
        return status, iframe, str(out_path)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[viz] ERROR: {e}\n{tb}", flush=True)
        return f"❌ Erreur : {e}\n\n```\n{tb}\n```", "", None


# JS GLOBAL injecté dans le <head> de la page Gradio.
# Fonctions vizClose / vizOpen utilisées par les boutons onclick du
# composant viz. Le <script> à l'intérieur d'un gr.HTML n'est PAS
# exécuté par Gradio v5 (sanitisation), donc fonctions remontées ici.
# Les données sont lues depuis l'attribut data-viz du #viz-container
# au moment du clic (toujours synchro avec le DOM actuel).
_HEAD_JS = """
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function() {
  // ---------- Gate admin (URL flag ?admin=1) ----------
  // Si l'URL contient ?admin=1, on ajoute la classe .admin-revealed
  // sur CHAQUE element .admin-only (pas sur <body>). Le CSS associe
  // (cf. _CHATBOT_CSS) revele alors ces blocs.
  //
  // POURQUOI cette double-classe au lieu d'un selector d'ancetre :
  // Gradio v5 scope automatiquement le CSS injecte via le param `css=`
  // en prefixant chaque regle avec `gradio-container.gradio-container-X.X.X
  // .contain `. Du coup un selector comme `body.admin-mode .admin-only`
  // devient `gradio-container... .contain .admin-mode .admin-only` —
  // qui demande que .admin-mode soit DESCENDANT de .contain. Or le body
  // est ANCETRE de .contain, donc le selector ne matche jamais.
  // En mettant la classe .admin-revealed sur l'element .admin-only
  // lui-meme, on evite tout selector d'ancetre — la regle CSS
  // `.admin-only.admin-revealed` resiste au scoping de Gradio.
  try {
    var qs = new URLSearchParams(window.location.search || '');
    if (qs.get('admin') === '1') {
      var revealAdmin = function() {
        document.querySelectorAll('.admin-only').forEach(function(el) {
          if (!el.classList.contains('admin-revealed')) {
            el.classList.add('admin-revealed');
          }
        });
      };
      if (document.readyState !== 'loading') revealAdmin();
      else document.addEventListener('DOMContentLoaded', revealAdmin);
      // Observer pour les .admin-only rendus apres le DOMContentLoaded
      // (Gradio v5 monte la UI de facon asynchrone).
      new MutationObserver(revealAdmin).observe(
        document.body || document.documentElement,
        { childList: true, subtree: true }
      );
    }
  } catch (e) { /* navigateurs anciens : on ignore */ }

  // ---------- Style parenthèses des dropdowns (quotas, BYOK) ----------
  // Trouve toute option dont le texte se termine par « (X req/jour) » ou
  // « (BYOK ...) » et entoure cette partie d'un span gris/petit.
  // MutationObserver pour rattraper les options rendues à l'ouverture
  // du dropdown.
  var PAREN_RE = /\\s*\\((\\d+\\s*req\\/jour|BYOK\\s+[^)]+)\\)\\s*$/;
  function styleParens(root) {
    root.querySelectorAll(
      'li[role="option"], div[role="option"], [data-testid*="dropdown"] li, ul[role="listbox"] li'
    ).forEach(function(opt) {
      if (opt.dataset.parenStyled) return;
      var text = opt.textContent || '';
      var m = text.match(PAREN_RE);
      if (!m) return;
      var main = text.slice(0, m.index).trim();
      opt.innerHTML = main +
        ' <span style="color:var(--body-text-color-subdued,#999);font-size:0.85em;font-weight:normal;">' +
        m[0].trim() + '</span>';
      opt.dataset.parenStyled = '1';
    });
  }
  document.addEventListener('DOMContentLoaded', function() { styleParens(document); });
  new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) styleParens(n);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  function parseB64Json(b64) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) {
      console.error('viz: parse failed', e);
      return [];
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // vizClose reçoit le base64 du JSON des fichiers EN ARGUMENT (passé
  // directement depuis l'onclick HTML — seule méthode robuste face à
  // DOMPurify de Gradio qui strippe data-*, <pre>, <script>, etc.).
  // On stocke la data parsée sur le container pour les vizOpen suivants.
  window.vizClose = function(b64) {
    var ifr = document.getElementById('viz-iframe');
    var list = document.getElementById('viz-list');
    var rows = document.getElementById('viz-list-rows');
    var btn = document.getElementById('viz-close-btn');
    var c = document.getElementById('viz-container');
    if (!ifr || !list || !rows || !btn || !c) return;
    var data = b64 ? parseB64Json(b64) : (c.__vizFiles || []);
    c.__vizFiles = data;  // mémorise pour vizOpen
    ifr.style.display = 'none';
    btn.style.display = 'none';
    list.style.display = 'block';
    if (data.length === 0) {
      rows.innerHTML = '<div style="color:var(--body-text-color-subdued,#999);font-style:italic;padding:6px 0;">Aucune visualisation dans la session pour l\\'instant.</div>';
      return;
    }
    rows.innerHTML = data.map(function(f, idx) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color-primary,#eee);">'
        + '<a href="#" onclick="window.vizOpen(' + idx + ');return false;" style="color:var(--link-text-color,#7c3aed);text-decoration:none;font-weight:500;flex:1;">'
        + esc(f.label) + '</a>'
        + '<span style="color:var(--body-text-color-subdued,#999);font-size:0.85em;display:flex;align-items:center;gap:10px;">'
        + '<span>' + f.size_kb + ' KB</span>'
        + '<a href="data:text/html;base64,' + f.b64 + '" download="' + esc(f.id) + '.html"'
        + ' style="color:var(--body-text-color,#666);text-decoration:none;border:1px solid var(--border-color-primary,#ccc);border-radius:4px;padding:3px 10px;font-size:0.85em;background:var(--button-secondary-background-fill,#fff);">⬇ Télécharger</a>'
        + '</span>'
        + '</div>';
    }).join('');
  };

  window.vizOpen = function(idx) {
    var ifr = document.getElementById('viz-iframe');
    var list = document.getElementById('viz-list');
    var btn = document.getElementById('viz-close-btn');
    var title = document.getElementById('viz-title');
    var c = document.getElementById('viz-container');
    if (!ifr || !list || !btn || !c) return;
    var data = c.__vizFiles || [];
    if (!data[idx]) return;
    ifr.src = 'data:text/html;base64,' + data[idx].b64;
    if (title) title.textContent = data[idx].label;
    ifr.style.display = 'block';
    btn.style.display = 'inline-block';
    list.style.display = 'none';
  };

  // ---------- Chatbot auto-resize (content-aware) ----------
  // Gradio v5 gr.Chatbot a une hauteur fixe par défaut. On observe les
  // changements de contenu et on adapte dynamiquement la hauteur du
  // .bubble-wrap :
  //   - vide (0 message) → 90 px (compact)
  //   - rempli → grandit avec le contenu jusqu'à 85vh (≈ pleine fenêtre)
  // Centrage : à chaque nouveau message, on scroll le chatbot dans la
  // vue centrée verticalement → l'utilisateur n'a presque pas à scroller.
  function resizeChatbot() {
    var root = document.getElementById('agent-chatbot');
    if (!root) return;
    var wrap = root.querySelector('.bubble-wrap')
            || root.querySelector('[class*="bubble-wrap"]')
            || root.querySelector('.wrap');
    if (!wrap) return;
    // Compte les messages réels
    var msgs = root.querySelectorAll('.message, [class*="message-row"], [data-testid="bot"], [data-testid="user"]');
    var isEmpty = msgs.length === 0;
    var maxH = Math.floor(window.innerHeight * 0.85);
    var minH = isEmpty ? 90 : 200;
    // Hauteur naturelle du contenu (scrollHeight) bornée par max
    wrap.style.height = 'auto';
    wrap.style.maxHeight = maxH + 'px';
    wrap.style.minHeight = minH + 'px';
    // Si contenu présent et qu'il pousse au-delà du minH, on suit le
    // scrollHeight pour ne pas créer une scrollbar inutile.
    if (!isEmpty) {
      var natural = wrap.scrollHeight;
      var target = Math.min(natural, maxH);
      if (target > minH) wrap.style.height = target + 'px';
    } else {
      wrap.style.height = minH + 'px';
    }

    // ---- Masquer les exemples dès qu'un message existe ----
    // gr.ChatInterface rend les exemples comme un panneau séparé sous
    // le chat. On le repère par plusieurs sélecteurs candidats (la
    // classe exacte change entre versions Gradio v5.x). On remonte au
    // parent .block pour cacher tout le bloc, pas juste le contenu.
    try {
      var sels = [
        '.examples-holder',
        '.examples-table',
        '[data-testid="examples"]',
        '.examples'
      ];
      var ex = null;
      for (var i = 0; i < sels.length; i++) {
        ex = document.querySelector(sels[i]);
        if (ex) break;
      }
      if (ex) {
        var block = ex.closest('.block') || ex.parentElement || ex;
        block.style.display = isEmpty ? '' : 'none';
      }
    } catch (e) { /* silently ignore selector failures */ }
  }

  // Debounce du scroll : on attend que les mutations se calment (~250 ms)
  // avant de scroller — sinon on scroll à chaque chunk de streaming. Le
  // viz scroll fire à 300/700/1200 ms via viz_html_out.change() et
  // l'emporte si une viz a été générée.
  //
  // CIBLE : la barre de saisie (textarea du chat) — elle DOIT rester
  // collée au bas de la fenêtre, pour que l'utilisateur réponde sans
  // scroller. Le chatbot rempli au-dessus se cale naturellement
  // (jusqu'à 85vh, scroll interne au-delà).
  var _scrollTimer = null;
  function findChatInput() {
    // Stratégie multi-fallback (la classe Gradio change entre versions).
    var root = document.getElementById('agent-chatbot');
    if (root) {
      var section = root.closest('[class*="chat-interface"]')
                 || root.closest('.tabitem')
                 || root.parentElement;
      if (section) {
        // 1) textarea avec placeholder « message » / « Type »
        var ta = section.querySelector(
          'textarea[placeholder*="message" i], textarea[placeholder*="Type" i]'
        );
        if (ta) return ta;
        // 2) Fallback : tout textarea visible dans la section
        var allTa = section.querySelectorAll('textarea');
        for (var i = 0; i < allTa.length; i++) {
          if (allTa[i].offsetParent !== null) return allTa[i];
        }
      }
    }
    // 3) Dernier recours : n'importe quel textarea avec placeholder type message
    return document.querySelector(
      'textarea[placeholder*="message" i], textarea[placeholder*="Type" i]'
    );
  }
  function scrollChatIntoView() {
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(function() {
      // Si une viz est visible, on NE scroll PAS — la viz scroll s'en
      // chargera quelques ms plus tard. Évite le saut chat→viz.
      var viz = document.getElementById('viz-container');
      if (viz && viz.offsetParent !== null) return;
      var input = findChatInput();
      if (!input) return;
      // block:'end' colle l'input contre le bas du viewport ; le chatbot
      // (au-dessus) occupe le reste de la fenêtre, l'utilisateur voit
      // les derniers messages + la zone de saisie sans scroller.
      input.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 250);
  }

  // Lance au load, puis observe le DOM du chatbot pour réagir aux
  // ajouts/suppressions de messages (et streaming progressif).
  function bindChatbotObserver() {
    var root = document.getElementById('agent-chatbot');
    if (!root || root.__resizeBound) {
      // Pas encore monté — retry au prochain tick
      if (!root) { setTimeout(bindChatbotObserver, 400); return; }
      return;
    }
    root.__resizeBound = true;
    resizeChatbot();
    new MutationObserver(function() {
      resizeChatbot();
      // À chaque mutation du chatbot (nouveau message, streaming chunk),
      // on (re)déclenche le scroll centré — debouncé, donc une seule
      // exécution au calme.
      var msgs = root.querySelectorAll('.message, [class*="message-row"], [data-testid="bot"], [data-testid="user"]');
      if (msgs.length > 0) scrollChatIntoView();
    }).observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', resizeChatbot);
  }
  document.addEventListener('DOMContentLoaded', bindChatbotObserver);
  // Filet de sécurité : Gradio rend les composants après DOMContentLoaded
  setTimeout(bindChatbotObserver, 800);
  setTimeout(bindChatbotObserver, 2000);

  // ---------- Onglets « Aide » et « Drops » flush à droite ----------
  // CSS pur ne marche pas de façon fiable (structure DOM Gradio v5
  // varie). On cherche tous les boutons role="tab" qui contiennent
  // un des labels cibles (Aide en top-level, Drops en sous-onglet
  // Jarvis) et on leur applique margin-left:auto pour les pousser
  // au bout à droite de leur tablist parent.
  function pushAideTabRight() {
    var tabs = document.querySelectorAll('[role="tab"]');
    var done = false;
    var targets = ['Aide', 'Drops'];
    for (var i = 0; i < tabs.length; i++) {
      var label = (tabs[i].textContent || '').trim();
      for (var t = 0; t < targets.length; t++) {
        if (label.indexOf(targets[t]) >= 0) {
          tabs[i].style.marginLeft = 'auto';
          done = true;
          break;
        }
      }
    }
    return done;
  }

  // ---------- Tab « Jarvis » coloré ----------
  // Gradio rend le label de gr.Tab en TEXTE PLAT (pas markdown/HTML).
  // Pour mettre « Jarvis » en couleur, on cherche le tab contenant
  // « Jarvis » et on remplace son innerHTML par une version avec span
  // coloré. Marqueur dataset pour éviter de remplacer plusieurs fois.
  // L'espace insécable &nbsp; garantit la séparation Agent | Jarvis
  // (parfois mangée par Gradio quand le label devient innerHTML).
  // Couleur dorée chaude (#f5b042) qui s'accorde avec l'amber du thème
  // secondary_hue et fait un contraste agréable avec le gris-bleu du
  // robot 🤖 (au lieu du cyan bleuté qui rentrait en conflit).
  function colorJarvisTab() {
    var tabs = document.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.dataset.jarvisStyled) continue;
      var txt = (t.textContent || '');
      if (txt.indexOf('Jarvis') < 0) continue;
      // Force un espace insécable AVANT Jarvis pour éviter le collage.
      // Pas de font-weight : il rendait les glyphes visuellement plus
      // larges → impression de taille différente vs « Agent ». La
      // couleur seule suffit à distinguer.
      t.innerHTML = t.innerHTML.replace(
        /\\s*Jarvis/g,
        '&nbsp;<span style="color:#f5b042;">Jarvis</span>'
      );
      t.dataset.jarvisStyled = '1';
    }
  }

  // Tooltip natif (attribut title) sur les checkboxes « Raisonnement
  // Gemini ». Le texte explicite (« comportement identique, démarrage
  // plus rapide ») apparait au survol — pas de bloc verbeux sous le
  // label.
  function applyThinkingTooltip() {
    var ids = ['jarvis-thinking-cb', 'chat-thinking-cb'];
    var tip = 'Active le chain-of-thought sur les modèles qui le supportent '
            + '(Gemini 3.x, Claude Sonnet/Haiku 4.5). Décoché : démarrage '
            + 'plus rapide, comportement fonctionnel strictement identique '
            + '(mêmes outils, mêmes sorties — seule la narration interne du '
            + 'raisonnement n\\'est pas demandée à l\\'API). Sans effet sur '
            + 'Gemini 2.x (pas de raisonnement natif).';
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && !el.dataset.tipApplied) {
        el.title = tip;
        // Et sur tous les enfants (label, input) pour que le hover soit
        // déclenché partout sur la case.
        var children = el.querySelectorAll('label, input, span');
        for (var j = 0; j < children.length; j++) children[j].title = tip;
        el.dataset.tipApplied = '1';
      }
    }
  }

  // Pour chaque option de dropdown dont le label contient
  // « épuisé sur cette clé » :
  //   - insère un ❌ devant le ✓ natif Gradio (ou en début d'option si
  //     le ✓ n'est pas trouvé) ;
  //   - masque le ✓ natif (display:none) pour éviter ❌ et ✓ côte à côte ;
  //   - applique opacity 0.45 + couleur grisée à l'option entière pour
  //     marquer visuellement « non utilisable ».
  // S'applique à TOUS les dropdowns (LLM Chatbot + Jarvis) — la
  // détection se fait par texte, peu importe l'arbre DOM.
  function replaceCheckOnBlownOptions() {
    // Sélecteurs très larges : Gradio v5 rend les options dans des
    // portails (souvent attachés au body) avec des marqueurs variables.
    var nodes = document.querySelectorAll(
      '[role="option"], li[role="option"], ul[role="listbox"] li, ' +
      '.options li, .options [data-value], [data-testid="dropdown"] li'
    );
    nodes.forEach(function(opt) {
      var text = (opt.textContent || '').trim();
      var isBlown = text.indexOf('épuisé sur cette clé') !== -1;
      // Marker existant ?
      var existing = opt.querySelector('.jdm-x-marker');
      if (isBlown) {
        // Grisage de l'option
        opt.style.opacity = '0.45';
        opt.style.color = '#9aa0a6';
        opt.dataset.jdmBlown = '1';
        if (!existing) {
          var x = document.createElement('span');
          x.textContent = '❌ ';
          x.className = 'jdm-x-marker';
          x.style.marginRight = '4px';
          x.style.display = 'inline-block';
          // Insertion au début de l'option (avant ✓ et label)
          opt.insertBefore(x, opt.firstChild);
        }
        // Masque ✓ natif Gradio (svg, .checkmark, etc.)
        var ticks = opt.querySelectorAll('svg.checkmark, span.checkmark, .check-icon');
        ticks.forEach(function(ic) { ic.style.display = 'none'; });
      } else if (opt.dataset.jdmBlown === '1') {
        // Reset (cas où l'état a basculé blown -> dispo)
        opt.style.opacity = '';
        opt.style.color = '';
        delete opt.dataset.jdmBlown;
        if (existing) existing.remove();
        var ticks2 = opt.querySelectorAll('svg.checkmark, span.checkmark, .check-icon');
        ticks2.forEach(function(ic) { ic.style.display = ''; });
      }

      // BYOK : remplacer le ✓ par 🔑 pour les options qui contiennent
      // « BYOK » dans leur label (Claude, GPT). Même technique que ❌.
      var isByok = !isBlown && text.indexOf('BYOK') !== -1;
      var existingKey = opt.querySelector('.jdm-key-marker');
      if (isByok) {
        opt.dataset.jdmByok = '1';
        if (!existingKey) {
          var k = document.createElement('span');
          k.textContent = '🔑 ';
          k.className = 'jdm-key-marker';
          k.style.marginRight = '4px';
          k.style.display = 'inline-block';
          opt.insertBefore(k, opt.firstChild);
        }
        var ticks3 = opt.querySelectorAll('svg.checkmark, span.checkmark, .check-icon');
        ticks3.forEach(function(ic) { ic.style.display = 'none'; });
      } else if (opt.dataset.jdmByok === '1' && !isByok) {
        delete opt.dataset.jdmByok;
        if (existingKey) existingKey.remove();
      }
    });
  }

  // Injection d'un bouton stylé « Rotation clés gemini (clé X/N) » à
  // la FIN de la liste d'options du dropdown modèle. On l'ajoute DANS
  // le ul (sinon caché par overflow du conteneur Gradio).
  //
  // ASTUCE pour ne pas casser la reconciliation Gradio sur click :
  // on RETIRE le bouton du DOM JUSTE AVANT de dispatch le click sur
  // le bouton Gradio caché. Gradio diff son ul avec 7 enfants (ses
  // 7 options), pas 8. Notre MutationObserver re-injecte le bouton
  // après que Gradio ait fini sa MAJ.
  function injectSwitchKeyButton() {
    var hidden = document.getElementById('jarvis-switch-key-btn')
              || document.getElementById('chat-switch-key-btn');
    if (!hidden) return;
    var btnLabel = (hidden.textContent || '🔄 Rotation clés gemini').trim();

    var lists = document.querySelectorAll('ul[role="listbox"]');
    lists.forEach(function(ul) {
      var optsTxt = (ul.textContent || '');
      if (optsTxt.indexOf('Gemini') === -1) return;
      var existing = ul.querySelector('.jdm-switch-key-injected');
      if (existing) {
        // Update juste le label si nécessaire — pas de remove/recreate
        if (existing.textContent !== btnLabel) existing.textContent = btnLabel;
        return;
      }
      // Création UNIQUE : le bouton reste en place pendant les
      // re-renders Svelte de ul, car {#each filtered_indices as index}
      // ne diff que les <li data-index=...> qu'il a créés. Notre <li>
      // sans data-index est invisible pour Svelte → jamais touché.
      var btn = document.createElement('li');
      btn.className = 'jdm-switch-key-injected';
      btn.textContent = btnLabel;
      btn.setAttribute('role', 'button');
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        // PAS de removeChild ici — le bouton reste dans le DOM
        // pendant toute la rotation. Comme Svelte ne le track pas
        // dans son {#each}, il survit aux re-renders intermédiaires.
        var liInput = null;
        try {
          liInput = ul.closest('.form, [class*="block"]')
                       ?.querySelector('input[role="listbox"]');
        } catch (e) {}
        if (liInput) {
          var setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          var resetObs = new MutationObserver(function() {
            var v = liInput.value;
            if (v) {
              liInput.placeholder = v;
              liInput.classList.add('jdm-placeholder-as-value');
              setter.call(liInput, '');
              liInput.dispatchEvent(new Event('input', {bubbles: true}));
            }
          });
          resetObs.observe(ul, { childList: true });
          setTimeout(function() { resetObs.disconnect(); }, 2000);
        }
        hidden.click();
      });
      ul.appendChild(btn);
    });
  }

  function applyTabTweaks() {
    pushAideTabRight();
    colorJarvisTab();
    applyThinkingTooltip();
    replaceCheckOnBlownOptions();
    injectSwitchKeyButton();
  }
  document.addEventListener('DOMContentLoaded', applyTabTweaks);
  setTimeout(applyTabTweaks, 400);
  setTimeout(applyTabTweaks, 1200);
  setTimeout(applyTabTweaks, 2500);
  // Si l'utilisateur clique sur un autre onglet et revient, Gradio peut
  // re-render et perdre les tweaks — on observe le DOM.
  new MutationObserver(function() {
    applyTabTweaks();
  }).observe(document.body, { childList: true, subtree: true });
})();
</script>
"""

_CHATBOT_CSS = """
/* ----- Gate admin : .admin-only cache par defaut, revele si l'element
   recoit en plus la classe .admin-revealed (posee par le JS quand
   ?admin=1 dans URL, cf. _HEAD_JS).
   IMPORTANT : on EVITE TOUT selector d'ancetre (.admin-mode .admin-only,
   body.admin-mode ...) parce que Gradio v5 scope le CSS injecte via
   `css=` en prefixant chaque regle avec `gradio-container.gradio-
   container-X.X.X .contain `. Du coup un selector base sur un ancetre
   en dehors de .contain (le body par exemple) ne matche jamais apres
   scoping. La double classe `.admin-only.admin-revealed` resout le
   probleme : pas d'ancetre requis, le scoping de Gradio prefixe juste
   les deux regles a l'identique, la specificite tranche. */
.admin-only { display: none !important; }
.admin-only.admin-revealed { display: block !important; }

/* Checkbox 'Raisonnement' flottante : position absolue dans le coin
   haut-droit du conteneur de la Column qui contient le dropdown modèle
   — alignée verticalement sur la baseline du label chip « Modèle ».
   Le texte « Raisonnement » est à GAUCHE de la case (flex-direction
   row-reverse sur le label de la checkbox). */
.floating-thinking-wrap {
  position: relative !important;
}
.floating-thinking-wrap .floating-thinking {
  position: absolute !important;
  /* Aligné verticalement sur le centre du chip « Modèle » du dropdown
     en dessous. Le chip a un padding-top de ~12-16px dans le wrapper,
     plus sa demi-hauteur (~10px). On vise ~20px depuis le haut du
     conteneur de la Column. */
  top: 20px !important;
  right: 8px !important;
  /* Translate -50% pour centrer la case sur cette ligne (la case fait
     ~20px de haut → on monte de la moitié pour que le CENTRE de la case
     soit à top:20px). */
  transform: translateY(-50%) !important;
  z-index: 5 !important;
  min-width: 0 !important;
  width: auto !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  font-size: 1em !important;
  display: inline-flex !important;
  align-items: center !important;
  line-height: 1 !important;
}
/* Inverse l'ordre interne du label de la checkbox : case à droite,
   texte « Raisonnement » à gauche. Sélecteurs multiples pour couvrir
   les variantes de rendu Gradio v5. */
.floating-thinking-wrap .floating-thinking label,
.floating-thinking-wrap .floating-thinking label > div,
.floating-thinking-wrap .floating-thinking [data-testid="checkbox"] {
  flex-direction: row-reverse !important;
  gap: 6px !important;
  align-items: center !important;
  white-space: nowrap !important;
}

/* Chatbot agent : compact quand vide, grandit avec le contenu jusqu'à
   ~85vh (presque la hauteur de la fenêtre). On force min-height à 0 sur
   le wrapper et tous les enfants pour défaire la hauteur fixe par défaut
   Gradio. Le JS dans _HEAD_JS surveille les changements de contenu et
   ajuste dynamiquement la hauteur réelle. */
#agent-chatbot,
#agent-chatbot > div,
#agent-chatbot .wrap,
#agent-chatbot .bubble-wrap,
#agent-chatbot .message-wrap,
#agent-chatbot [class*="bubble-wrap"],
#agent-chatbot [class*="message-wrap"] {
  min-height: 0 !important;
  max-height: none !important;
}
#agent-chatbot { height: auto !important; }
#agent-chatbot .bubble-wrap,
#agent-chatbot [class*="bubble-wrap"] {
  height: auto !important;
  overflow-y: auto;
}

/* Blocs « thinking » dans les messages Jarvis — rendus discrets :
   très petits, grisés, italiques. La classe `.jdm-thinking` est
   appliquée par un <div> dans les progress_lines de jarvis.py.
   On passe par une classe car les attributs `style=` inline sont
   filtrés par DOMPurify de Gradio v5. */
.jdm-thinking,
.jdm-thinking * {
  font-size: 0.85em !important;
  color: #999 !important;
  font-style: italic !important;
  line-height: 1.35 !important;
}

/* Narrations des outils Jarvis (« 📖 Je vérifie l'existence… »,
   « 🔧 enrichment_workflow(...) », « ✓ outil renvoie N chars »).
   MÊME taille et italique que thinking, mais teinte BLEU-CYAN doux
   (#82aaff) au lieu du gris — se démarque subtilement du flux
   principal blanc tout en restant lisible. Distinct du violet
   primaire de Gradio (accents UI) pour éviter la confusion. */
.jdm-narration,
.jdm-narration * {
  font-size: 0.85em !important;
  color: #82aaff !important;
  font-style: italic !important;
  line-height: 1.35 !important;
}

/* Responsive mobile : sur petits écrans (< 768px), les gr.Row de
   Gradio v5 gardent leurs colonnes côte à côte avec leur scale, ce
   qui donne des champs étriqués sur smartphone (cf. screenshot user).
   On force ici l'empilement vertical : chaque enfant de Row prend la
   pleine largeur. Couvre plusieurs noms de classes Gradio (varie
   entre versions). */
@media (max-width: 768px) {
  .gradio-container .form,
  .gradio-container .row,
  .gradio-container [class*="row"]:not([class*="tab"]),
  .gradio-container [class*="flex-row"] {
    flex-direction: column !important;
    flex-wrap: wrap !important;
  }
  .gradio-container .row > *,
  .gradio-container [class*="row"]:not([class*="tab"]) > *,
  .gradio-container [class*="flex-row"] > * {
    width: 100% !important;
    min-width: 0 !important;
    flex: 1 1 100% !important;
  }
}

/* Champ clé API : quand le textbox est interactive=False (i.e. l'input
   est disabled), on grise AUSSI le label et l'info de placeholder, pas
   seulement le champ. CSS :has() supporté par tous les navigateurs
   modernes (Chrome 105+, Firefox 121+, Safari 15.4+). */
#key-in:has(input[disabled]),
#key-in:has(input:disabled) {
  opacity: 0.55;
}

/* Boutons « Changer de clé API » masqués (Gradio les rend mais on les
   cache visuellement — leurs clicks restent triggerables via JS
   depuis le bouton clone injecté dans le dropdown). */
.jdm-hidden-switch-btn {
  display: none !important;
}

/* Style du bouton clone INJECTÉ par JS à la fin de la liste d'options
   du dropdown modèle. Format = bouton standard, distinct des options.
   `order: 999` + flex sur ul (règle suivante) → le bouton apparaît
   TOUJOURS visuellement en dernier, quelle que soit sa position dans
   le DOM (Svelte peut le faire remonter après un re-render, il reste
   visuellement en bas). */
.jdm-switch-key-injected {
  display: block !important;
  width: calc(100% - 16px) !important;
  margin: 8px !important;
  padding: 10px 16px !important;
  background: var(--button-secondary-background-fill, #4b4b5c) !important;
  border: 1px solid var(--button-secondary-border-color, #6b6b80) !important;
  border-radius: 8px !important;
  color: var(--button-secondary-text-color, #fff) !important;
  font-weight: 600 !important;
  text-align: center !important;
  cursor: pointer !important;
  user-select: none !important;
  transition: background 0.15s ease !important;
  order: 999 !important;
}
.jdm-switch-key-injected:hover {
  background: var(--button-secondary-background-fill-hover, #5d5d70) !important;
}

/* Active le layout flex column sur l'ul de listbox UNIQUEMENT s'il
   contient notre bouton (donc le dropdown modèle). Ainsi le bouton
   avec order:999 est toujours visuellement en bas, même si Svelte
   réordonne les <li> du each block autour. */
ul[role="listbox"]:has(.jdm-switch-key-injected) {
  display: flex !important;
  flex-direction: column !important;
}

/* Placeholder utilisé comme valeur visible (post-rotation) — ressemble
   à une vraie value pour que l'utilisateur ne voie pas un trigger vide.
   Couleur body-text (au lieu du gris standard), opacité 1, pas
   d'italique. Disparaît automatiquement dès que l'input.value devient
   non-vide (next user-interaction). */
input.jdm-placeholder-as-value::placeholder {
  color: var(--body-text-color, #e0e0e0) !important;
  opacity: 1 !important;
  font-style: normal !important;
}

/* Gradio v5 cache le ✓ sur les options non sélectionnées via
   .inner-item.hide { visibility: hidden }. On le rend VISIBLE en gris
   pour que chaque option ait son check (gris si non sélectionné,
   normal si sélectionné). Désactivé sur options grisées blown
   (data-jdm-blown=1) où on a déjà mis ❌. */
ul[role="listbox"] li .inner-item.hide {
  visibility: visible !important;
  opacity: 0.28 !important;
}
ul[role="listbox"] li[data-jdm-blown="1"] .inner-item,
ul[role="listbox"] li[data-jdm-byok="1"] .inner-item {
  visibility: hidden !important;
}

/* Onglet Aide flush à droite — appliqué par JS (pushAideTabRight
   dans _HEAD_JS) qui cherche par texte « Aide » dans tous les
   boutons role="tab", car la structure DOM Gradio v5 varie. CSS
   ci-dessous = fallback si le JS échoue. */
[role="tablist"]:first-of-type > [role="tab"]:last-child {
  margin-left: auto !important;
}

/* Pleine largeur pour TOUS les onglets : Gradio v5 fixe un max-width
   par défaut sur .gradio-container, ce qui laisse des bandes vides à
   gauche/droite sur grands écrans. On le retire — fill_width=True sur
   gr.Blocks suffit pour la grille de composants mais ne touche pas
   au conteneur racine. */
.gradio-container, .gradio-container.app {
  max-width: 100% !important;
  width: 100% !important;
}
"""

with gr.Blocks(theme=THEME, title="Jarvis : Agent JeuxDeMots", head=_HEAD_JS, css=_CHATBOT_CSS,
               fill_width=True) as demo:

    # Les deux dropdowns « Modèle » sont DÉCLARÉS ici (avant les tabs)
    # avec render=False puis .render() dans leur tab respectif. Permet
    # de les passer dans les outputs des handlers des AUTRES tabs : le
    # flow LLM Chatbot peut updater jarvis_model et vice-versa.
    # filterable=False : sinon Gradio met le dropdown en mode combobox
    # avec search/filter. Sur gr.update(choices=...) pendant qu'il est
    # ouvert, l'input garde le label de la value courante → la liste
    # affichée est filtrée à cette seule option (bug visible : BYOK
    # et 2.5 disparaissent après un click rotation). En non-filterable,
    # les choices update sont visibles intégralement.
    model_in = gr.Dropdown(
        choices=build_model_choices(),
        value="gemini-3.1-flash-lite",
        label="Modèle",
        filterable=False,
        render=False,
    )
    jarvis_model = gr.Dropdown(
        choices=build_model_choices(),
        value="gemini-3.1-flash-lite",
        label="Modèle",
        filterable=False,
        render=False,
    )

    with gr.Tabs() as main_tabs:

        # ----- Tab 0: Projet (description et liens) -----
        with gr.Tab("📋 Projet"):
            gr.Markdown(PROJET_MD)

        # ----- Tab 1: Explorer -----
        with gr.Tab("🔎 Explorer JDM"):
            with gr.Row():
                term_in = gr.Textbox(label="Terme", value="chat",
                                     placeholder="ex: voiture, chat, manger…")
                rel_in = gr.Dropdown(list(EXPLORE_RELATIONS.keys()),
                                     value="Hyperonymes — 'est un' (r_isa)",
                                     label="Relation à explorer")
            with gr.Row():
                mw_in = gr.Slider(0, 1000, value=25, step=5, label="Poids min (w ≥)")
                lim_in = gr.Slider(5, 100, value=20, step=5, label="Limite de résultats")
                annot_in = gr.Checkbox(value=True, label="Inclure les annotations")
            explore_btn = gr.Button("Explorer", variant="primary")
            explore_status = gr.Markdown()
            explore_df = gr.Dataframe(
                label="Triplets trouvés",
                headers=["source", "relation", "target", "w", "annotations", "target_id (si raffinement)"],
                interactive=False,
            )
            explore_btn.click(explore,
                               inputs=[term_in, rel_in, mw_in, lim_in, annot_in],
                               outputs=[explore_df, explore_status])

            gr.Markdown("---\n### Désambiguïsation des termes polysémiques")
            with gr.Row():
                dis_in = gr.Textbox(label="Terme polysémique", value="avocat",
                                    placeholder="ex: avocat, souris, police, chat…")
                dis_btn = gr.Button("Désambiguïser", variant="secondary")
            dis_status = gr.Markdown()
            dis_df = gr.Dataframe(label="Sens trouvés",
                                   headers=["sens (décodé)", "poids", "id JDM"],
                                   interactive=False)
            dis_btn.click(disambiguate_term, inputs=[dis_in],
                          outputs=[dis_df, dis_status])

        # ----- Tab 2: Claim checker -----
        with gr.Tab("⚖️ Claim checker"):
            with gr.Row():
                fc_subject = gr.Textbox(label="Sujet", value="baleine",
                                        placeholder="ex: baleine, sang, voiture…")
                fc_relation = gr.Dropdown(CLAIM_RELATIONS, value="r_isa", label="Relation")
                fc_object = gr.Textbox(label="Objet / Cible", value="poisson",
                                       placeholder="ex: poisson, rouge, roue…")
            fc_effort = gr.Radio(
                choices=list(EFFORT_CHOICES.keys()),
                value="0 — Contenance (JDM contient-il ?)",
                label="Régime de vérification",
                info="Contenance = JDM contient-il littéralement le triplet ? "
                     "Inférence = peut-on le déduire du réseau si JDM est silencieux ?",
            )
            fc_bypass = gr.Checkbox(
                value=False,
                label="Forcer l'inférence même si le triplet est déjà dans JDM",
                info="Bypass de la contenance : montre la chaîne de déduction "
                     "d'un fait pourtant déjà connu (effort ≥ 1 requis).",
            )
            fc_btn = gr.Button("Vérifier", variant="primary")
            fc_status = gr.Markdown()
            fc_evidence = gr.Markdown()
            fc_btn.click(factcheck_one,
                         inputs=[fc_subject, fc_relation, fc_object, fc_effort, fc_bypass],
                         outputs=[fc_status, fc_evidence])
            gr.Examples(
                examples=[
                    ["baleine", "r_isa", "poisson", "0 — Contenance (JDM contient-il ?)"],
                    ["chat", "r_isa", "mammifère", "0 — Contenance (JDM contient-il ?)"],
                    ["sang", "r_has_color", "rouge", "0 — Contenance (JDM contient-il ?)"],
                    ["baleine", "r_isa", "poisson", "1 — + inférence (noyau)"],
                    ["couteau", "r_telic_role", "couper", "1 — + inférence (noyau)"],
                    ["saumon", "r_isa", "mammifère", "1 — + inférence (noyau)"],
                ],
                inputs=[fc_subject, fc_relation, fc_object, fc_effort],
            )

        # ----- Tab 3: Sous-graphe (visualisation interactive) -----
        with gr.Tab("🕸️ Sous-graphe"):
            with gr.Row():
                viz_term = gr.Textbox(label="Terme racine", value="plat asiatique",
                                      placeholder="ex: chat, polyphonie, voiture…",
                                      scale=3)
                viz_depth = gr.Slider(1, 4, value=1, step=1, label="Profondeur",
                                      scale=1)
            # Palette commune à cocher pour les 4 niveaux. Par défaut le
            # même top-K (3) partout ; l'utilisateur peut le tordre par
            # niveau (utile pour ne pas exploser au-delà du 1er anneau).
            _ALL_REL_CHOICES = DEFAULT_RELATIONS + [
                r for r in ("r_syn", "r_anto", "r_patient-1", "r_agent-1", "r_associated")
                if r not in DEFAULT_RELATIONS
            ]
            _DEFAULT_TOPK = 3
            # Sélection de relations + top-K par niveau — repliée par défaut.
            # Les rangées des niveaux 2/3/4 ne sont visibles que si la
            # profondeur sélectionnée les atteint (cf. viz_depth.change).
            with gr.Accordion("⚙️ Réglages par niveau (top-K + relations)",
                              open=False):
                # Niveau 1 — toujours visible (min depth = 1).
                with gr.Row():
                    viz_topk = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                         label="Top-K niveau 1")
                viz_relations = gr.CheckboxGroup(
                    choices=_ALL_REL_CHOICES,
                    value=DEFAULT_RELATIONS,
                    label="Niveau 1 — voisins directs du terme",
                )
                # Niveau 2 — visible si profondeur ≥ 2.
                with gr.Group(visible=False) as viz_level2_group:
                    with gr.Row():
                        viz_topk_d2 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 2")
                    viz_depth2_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH2_RELATIONS,
                        label="Niveau 2 — voisins de voisins",
                    )
                # Niveau 3 — visible si profondeur ≥ 3.
                with gr.Group(visible=False) as viz_level3_group:
                    with gr.Row():
                        viz_topk_d3 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 3")
                    viz_depth3_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH3_RELATIONS,
                        label="Niveau 3",
                    )
                # Niveau 4 — visible si profondeur = 4.
                with gr.Group(visible=False) as viz_level4_group:
                    with gr.Row():
                        viz_topk_d4 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 4")
                    viz_depth4_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH4_RELATIONS,
                        label="Niveau 4 (déconseillé sauf cas ciblé)",
                    )

            # Wire visibility : afficher seulement les niveaux ≤ profondeur.
            def _update_levels_visibility(d):
                d = int(d)
                return (
                    gr.update(visible=d >= 2),
                    gr.update(visible=d >= 3),
                    gr.update(visible=d >= 4),
                )

            viz_depth.change(
                _update_levels_visibility,
                inputs=[viz_depth],
                outputs=[viz_level2_group, viz_level3_group, viz_level4_group],
            )
            viz_btn = gr.Button("Construire le sous-graphe", variant="primary")
            viz_status = gr.Markdown()
            viz_file = gr.File(label="Télécharger le HTML interactif",
                               interactive=False)
            # elem_id pour pouvoir scroller vers cette zone après génération.
            viz_out = gr.HTML(label="Visualisation (inline)", elem_id="viz-output")
            # Gradio 5 : le paramètre js= sur .click() s'exécute AVANT fn
            # (sa valeur de retour remplace les inputs). Pour lancer du JS
            # APRÈS la génération, on chaîne via .then() avec fn=None.
            _scroll_js = (
                "() => { setTimeout(() => { "
                "const el = document.getElementById('viz-output'); "
                "if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); "
                "}, 100); }"
            )
            viz_btn.click(
                viz_subgraph,
                inputs=[viz_term, viz_depth,
                        viz_topk, viz_topk_d2, viz_topk_d3, viz_topk_d4,
                        viz_relations, viz_depth2_relations,
                        viz_depth3_relations, viz_depth4_relations],
                outputs=[viz_status, viz_out, viz_file],
            ).then(fn=None, inputs=None, outputs=None, js=_scroll_js)

        # ----- Tab 4: Agent (BYOK Anthropic / OpenAI ; HF Inference = gratuit) -----
        with gr.Tab("💬 LLM Chatbot"):
            # La checkbox 'Raisonnement' est absolument positionnée dans le
            # coin haut-droit du conteneur du dropdown modèle (cf. CSS sur
            # .floating-thinking-wrap > .floating-thinking).
            with gr.Row():
                # Désactivée par défaut (le modèle initial est Gemini hébergé).
                # Réactivée dynamiquement quand l'utilisateur choisit
                # Claude ou GPT via le dropdown ci-dessous.
                key_in = gr.Textbox(
                    label="Clé API",
                    type="password",
                    placeholder="Non requis pour les modèles Gemini hébergés",
                    interactive=False,
                    elem_id="key-in",
                    scale=3,
                )
                with gr.Column(scale=2, min_width=0,
                               elem_classes=["floating-thinking-wrap"]):
                    chat_thinking = gr.Checkbox(
                        value=False,
                        label="Raisonnement",
                        elem_id="chat-thinking-cb",
                        elem_classes=["floating-thinking"],
                    )
                    model_in.render()
                    # Bouton caché — sera trigger par le clone DOM injecté
                    # dans le dropdown via JS.
                    chat_switch_key_btn = gr.Button(
                        value=_switch_key_btn_label(),
                        size="sm",
                        elem_id="chat-switch-key-btn",
                        elem_classes=["jdm-hidden-switch-btn"],
                    )

            # Handler model_in.change : binding différé à la fin du
            # Blocks (jarvis_model n'existe pas encore ici).
            # Composant SÉPARÉ pour la viz : gr.HTML qui embarque un
            # iframe sandbox avec le sous-graphe interactif. Alimenté
            # via additional_outputs de ChatInterface — donc le message
            # de chat reste UNIQUEMENT le texte de l'agent (pas d'append
            # qui ferait fragmenter Gemini 3.x). Le composant se met à
            # jour à chaque nouvelle viz, remplaçant l'ancienne.
            #
            # render=False : on déclare le composant ici pour pouvoir le
            # passer en additional_outputs de ChatInterface, mais on le
            # rend (.render()) PLUS BAS, après le chat — sinon il
            # s'afficherait au-dessus de la conversation et l'auto-scroll
            # Gradio sauterait en bas de page quand il devient visible.
            viz_html_out = gr.HTML(
                label="🕸️ Visualisation interactive du sous-graphe",
                visible=False,
                render=False,
            )
            # Les dropdowns NE SONT PLUS dans additional_outputs → row
            # Modèle reste stable (pas de "processing | Xs"). Update
            # fait via chat.chatbot.change(.then) APRÈS la fin du flow
            # (helper refresh_dropdowns_silent, show_progress="hidden").
            chat = gr.ChatInterface(
                fn=chat_with_agent,
                additional_inputs=[key_in, model_in, chat_thinking],
                additional_outputs=[viz_html_out],
                # Chatbot agrandi : 780 px de haut (+30 % vs 600).
                # Tentative d'HTML/<details> abandonnée — gr.Chatbot v5
                # fragmente tout tag inconnu en un caractère par ligne ;
                # on s'en tient à du markdown plat dans chat_with_agent.
                chatbot=gr.Chatbot(
                    # Hauteur gérée par CSS (#agent-chatbot dans _CHATBOT_CSS) :
                    # bubble-wrap.height = auto → la bulle grandit avec le
                    # contenu jusqu'à 820 px, puis scrolle. Les props natives
                    # min/max_height de gr.Chatbot v5 ne suffisent pas à
                    # supprimer le min-height du conteneur parent.
                    elem_id="agent-chatbot",
                    resizable=True,
                    type="messages",
                    show_label=False,
                    avatar_images=(None, None),
                ),
                # Avec additional_inputs, chaque exemple = liste alignée sur
                # [message, key, model]. La clé reste vide pour les exemples ;
                # sans clé, l'utilisateur aura le message d'erreur informatif.
                examples=[
                    # Tous les exemples passent par Gemini 3.1 Flash Lite
                    # (quota le plus large : 500 req/jour, le plus rapide).
                    # En cas d'épuisement, BYOK Claude / GPT.
                    # 4 valeurs par exemple : [message, key, model, use_thinking]
                    ["Quels sont les synonymes de voiture ?", "", "gemini-3.1-flash-lite", False],
                    ["Le saumon est-il un mammifère selon JDM ?", "", "gemini-3.1-flash-lite", False],
                    ["Pour le sens juridique de 'avocat', donne-moi 5 synonymes.", "", "gemini-3.1-flash-lite", False],
                    ["Que peut faire un chat ?", "", "gemini-3.1-flash-lite", False],
                    ["Quelles sont les composantes typiques d'un smartphone ?", "", "gemini-3.1-flash-lite", False],
                ],
                cache_examples=False,
                type="messages",
            )
            # Rendu effectif de viz_html_out APRÈS le chat → la viz
            # apparaît sous la conversation, pas au-dessus.
            viz_html_out.render()
            # Scroll automatique CENTRÉ sur la viz quand elle apparaît.
            # Le Chatbot Gradio auto-scrolle vers la fin du chat APRÈS
            # notre yield, donc on doit scroller APRÈS lui : plusieurs
            # tentatives échelonnées (300/700/1200ms) pour s'imposer.
            viz_html_out.change(
                fn=None, inputs=None, outputs=None,
                js="""() => {
                  const scrollToViz = () => {
                    const el = document.getElementById('viz-container');
                    if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                  };
                  setTimeout(scrollToViz, 300);
                  setTimeout(scrollToViz, 700);
                  setTimeout(scrollToViz, 1200);
                }"""
            )

            # Après chaque tour de chat (chat.chatbot change), on refresh
            # silencieusement les deux dropdowns pour propager l'état
            # « épuisé » si PerDay a été hit. show_progress="hidden" →
            # zéro indicateur visuel sur les rows Modèle.
            chat.chatbot.change(
                refresh_dropdowns_silent,
                inputs=None,
                outputs=[model_in, jarvis_model],
                show_progress="hidden",
            )

        # ----- Tab 5: Jarvis (flows guidés par formulaires — Phase 13) -----
        with gr.Tab("🤖 Agent Jarvis"):
            gr.Markdown(
                "# 🦾 Jarvis — flows guidés JDM\n\n"
                "Pas de prompt à taper : remplis le formulaire, "
                "Jarvis exécute le flux canonique correspondant. Tous "
                "les fichiers produits (.enrich / .audit / .err) restent "
                "en local sauf demande explicite d'upload LLMDrops."
            )

            # ====== BANDEAU partagé (clé Drops + modèle + budget) ======
            # La checkbox 'Raisonnement' est absolument positionnée dans le
            # coin haut-droit du conteneur du dropdown modèle (cf. CSS sur
            # .floating-thinking-wrap > .floating-thinking) — elle s'aligne
            # visuellement sur le label « Modèle » sans occuper de place
            # dans le flux.
            with gr.Row():
                jarvis_drops_key = gr.Textbox(
                    label="Clé LLMDrops",
                    type="password",
                    placeholder="Optionnel — laisse vide pour utiliser la clé d'environnement",
                    elem_id="jarvis-drops-key",
                    scale=3,
                )
                with gr.Column(scale=2, min_width=0,
                               elem_classes=["floating-thinking-wrap"]):
                    jarvis_thinking = gr.Checkbox(
                        value=False,
                        label="Raisonnement",
                        elem_id="jarvis-thinking-cb",
                        elem_classes=["floating-thinking"],
                    )
                    jarvis_model.render()
                    jarvis_switch_key_btn = gr.Button(
                        value=_switch_key_btn_label(),
                        size="sm",
                        elem_id="jarvis-switch-key-btn",
                        elem_classes=["jdm-hidden-switch-btn"],
                    )
                jarvis_budget = gr.Dropdown(
                    choices=["10", "25", "50", "100", "illimité"],
                    value="illimité",
                    label="Budget",
                    scale=1,
                )

            # Checkbox auto-bascule (option C). Décochée par défaut →
            # le mode B s'active : sur PerDay non-3.1, l'agent abort,
            # save son state, et un bouton « ▶️ Continuer avec 3.1 »
            # apparaît dans le sous-onglet pour reprendre exactement où
            # l'agent s'est arrêté. Cochée → auto-retry silencieux.
            jarvis_auto_switch_cb = gr.Checkbox(
                value=False,
                label="Auto-bascule sur 3.1 si quota épuisé (sinon : bouton « Continuer »)",
                elem_id="jarvis-auto-switch-cb",
            )

            # ====== Sous-onglets ======
            with gr.Tabs() as jarvis_tabs:

                # ---- Sous-onglet : Enrichissement ----
                with gr.Tab("🌱 Enrichissement", id="jarvis-enrich"):
                    gr.Markdown(
                        "Propose et consolide de nouveaux triplets pour un "
                        "terme. Le LLM suit `enrichment_workflow()` : "
                        "pré-fetch exhaustif → désambiguïsation → "
                        "proposition → validation+consolidation par "
                        "inférence → écriture du fichier `.enrich`."
                    )
                    with gr.Row():
                        with gr.Column(scale=1):
                            je_term = gr.Textbox(
                                label="Terme à enrichir (optionnel — vide = tirage au hasard)",
                                placeholder="ex: guitare",
                            )
                            je_relation = gr.Dropdown(
                                choices=JARVIS_RELATIONS,
                                value=[],
                                label="Relation(s) cible(s) (optionnel — multi-sélection)",
                                allow_custom_value=True,
                                multiselect=True,
                            )
                            je_target_n = gr.Slider(
                                1, 50, value=3, step=1,
                                label="Nombre cible de triplets consolidés",
                            )
                            je_vary = gr.Checkbox(
                                value=True,
                                label="Varier les types de relations",
                            )
                            je_iterate = gr.Checkbox(
                                value=True,
                                label="Itérer jusqu'à atteindre le nombre cible",
                            )
                            je_upload = gr.Checkbox(
                                value=False,
                                label="Soumettre directement à JDM (LLMDrops)",
                                info="Nécessite une clé API LLMDrops dans le bandeau ou en env JDM_DROPS_API_KEY.",
                            )
                            je_launch = gr.Button(
                                "🌱 Lancer l'enrichissement",
                                variant="primary",
                            )
                            # Bouton de soumission post-hoc — apparaît une
                            # fois qu'un fichier .enrich a été produit.
                            # Variant 'stop' (rouge) pour le distinguer du
                            # primary 'Lancer'. Grisé si pas de clé Drops.
                            from jarvis import has_drops_key as _has_dk
                            je_submit = gr.Button(
                                "📤 Soumettre à JDM (post-hoc)",
                                variant="stop",
                                visible=False,
                                interactive=_has_dk(),
                            )
                        with gr.Column(scale=2):
                            je_chat = gr.Chatbot(
                                type="messages",
                                elem_id="jarvis-enrich-chat",
                                show_label=False,
                                resizable=True,
                                height=520,
                            )
                            je_file = gr.File(
                                label="📄 Fichier produit (télécharger)",
                                interactive=False,
                                visible=False,
                            )
                            je_preview = gr.Code(
                                label="Aperçu du fichier",
                                language=None,
                                lines=12,
                                interactive=False,
                                visible=False,
                            )
                            # State pour B (option par défaut) : sauve le
                            # state du flow quand PerDay non-3.1 hit, pour
                            # permettre la reprise via le bouton continue.
                            je_resume_state = gr.State(value=None)
                            je_continue_btn = gr.Button(
                                "▶️ Continuer avec gemini-3.1-flash-lite",
                                visible=False,
                                variant="primary",
                            )

                    def _run_enrich(term, relations, target_n, vary, iterate, upload,
                                    drops_key, model, budget_label, use_thinking,
                                    auto_switch, resume_state):
                        """Wrapper Gradio : construit le prompt, lance le flow.
                        Yield 5-tuples (chat, file, preview, state, btn_update).
                        Si resume_state n'est pas None, run_jarvis_flow reprend
                        sur l'état sauvé (mode B continue)."""
                        from jarvis import build_enrich_prompt, run_jarvis_flow
                        from jdm_agent.tools.jdm_agent import build_jdm_agent
                        prompt = build_enrich_prompt(
                            term=term,
                            relation=relations,
                            target_count=int(target_n),
                            vary_relations=bool(vary),
                            iterate=bool(iterate),
                            budget_label=str(budget_label),
                            upload=bool(upload),
                        )
                        t = (term or "").strip()
                        headline = (
                            f"🌱 Enrichissement de « {t} »"
                            if t else "🌱 Enrichissement (terme tiré au hasard)"
                        )
                        abort_yielded = False
                        for chunk in run_jarvis_flow(
                            prompt=prompt,
                            headline=headline,
                            model=model,
                            api_key="",
                            budget_label=str(budget_label),
                            drops_key=drops_key,
                            build_llm_fn=_build_llm,
                            build_agent_fn=build_jdm_agent,
                            get_client_fn=get_client,
                            use_thinking=bool(use_thinking),
                            consolidation_target=(
                                int(target_n) if bool(iterate) else None
                            ),
                            auto_switch_on_perday=bool(auto_switch),
                            resume_state=resume_state,
                        ):
                            if len(chunk) == 5:
                                # Abort PerDay non-3.1 : state + show btn
                                messages, fpath, fprev, state, _ = chunk
                                abort_yielded = True
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    state,
                                    gr.update(visible=True),
                                )
                            else:
                                messages, fpath, fprev = chunk
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    gr.skip(),
                                    gr.skip(),
                                )
                        # Fin de flow normale (pas d'abort) : on clear le
                        # state + hide le bouton (au cas où ils traînaient
                        # d'une session précédente).
                        if not abort_yielded:
                            yield (gr.skip(), gr.skip(), gr.skip(),
                                   None, gr.update(visible=False))

                    _je_inputs = [
                        je_term, je_relation, je_target_n, je_vary,
                        je_iterate, je_upload,
                        jarvis_drops_key, jarvis_model, jarvis_budget,
                        jarvis_thinking, jarvis_auto_switch_cb, je_resume_state,
                    ]
                    _je_outputs = [je_chat, je_file, je_preview,
                                   je_resume_state, je_continue_btn]
                    je_launch.click(_run_enrich, inputs=_je_inputs, outputs=_je_outputs)
                    je_continue_btn.click(_run_enrich, inputs=_je_inputs, outputs=_je_outputs)
                    je_chat.change(
                        refresh_dropdowns_silent,
                        inputs=None,
                        outputs=[model_in, jarvis_model],
                        show_progress="hidden",
                    )

                    # Grisage visuel de « Varier les types de relations »
                    # quand des relations sont déjà sélectionnées (la case
                    # devient sans effet — le builder l'ignore déjà dans
                    # ce cas, on rend juste le visuel cohérent).
                    def _toggle_vary_state(rels):
                        has_rels = bool(rels)
                        return gr.update(interactive=not has_rels)

                    je_relation.change(
                        _toggle_vary_state,
                        inputs=[je_relation],
                        outputs=[je_vary],
                    )

                    # Quand un fichier est produit (je_file devient visible),
                    # on rend visible le bouton « Soumettre » post-hoc.
                    def _show_submit_btn(file_path, drops_key):
                        if not file_path:
                            return gr.update(visible=False)
                        from jarvis import has_drops_key as _hk
                        return gr.update(visible=True, interactive=_hk(drops_key))

                    je_file.change(
                        _show_submit_btn,
                        inputs=[je_file, jarvis_drops_key],
                        outputs=[je_submit],
                    )

                    def _submit_enrich(file_path, drops_key, model, chat):
                        from jarvis import submit_existing_file
                        return submit_existing_file(file_path, drops_key, model, chat)

                    je_submit.click(
                        _submit_enrich,
                        inputs=[je_file, jarvis_drops_key, jarvis_model, je_chat],
                        outputs=[je_chat],
                    )

                with gr.Tab("🔍 Audit", id="jarvis-audit"):
                    gr.Markdown(
                        "Audit sémantique : détecte les CONTAMINATIONS du "
                        "terme générique par les relations propres aux sens "
                        "NON-PREMIERS. Produit un fichier `.audit` factuel "
                        "(SENS + SIGNALEMENTS + META score/10)."
                    )
                    with gr.Row():
                        with gr.Column(scale=1):
                            ja_term = gr.Textbox(
                                label="Terme à auditer (optionnel — vide = tirage polysémique au hasard)",
                                placeholder="ex: avocat",
                            )
                            ja_relation = gr.Dropdown(
                                choices=JARVIS_RELATIONS,
                                value=[],
                                label="Relation(s) à auditer (optionnel — multi-sélection)",
                                allow_custom_value=True,
                                multiselect=True,
                                info="Vide = le LLM choisit (couvre plusieurs types).",
                            )
                            ja_upload = gr.Checkbox(
                                value=False,
                                label="Soumettre directement à JDM (LLMDrops)",
                                info="Nécessite une clé API LLMDrops dans le bandeau ou en env.",
                            )
                            ja_launch = gr.Button(
                                "🔍 Lancer l'audit",
                                variant="primary",
                            )
                            from jarvis import has_drops_key as _hk_a
                            ja_submit = gr.Button(
                                "📤 Soumettre à JDM (post-hoc)",
                                variant="stop",
                                visible=False,
                                interactive=_hk_a(),
                            )
                        with gr.Column(scale=2):
                            ja_chat = gr.Chatbot(
                                type="messages",
                                elem_id="jarvis-audit-chat",
                                show_label=False,
                                resizable=True,
                                height=520,
                            )
                            ja_file = gr.File(
                                label="📄 Fichier produit (télécharger)",
                                interactive=False,
                                visible=False,
                            )
                            ja_preview = gr.Code(
                                label="Aperçu du fichier",
                                language=None,
                                lines=14,
                                interactive=False,
                                visible=False,
                            )
                            ja_resume_state = gr.State(value=None)
                            ja_continue_btn = gr.Button(
                                "▶️ Continuer avec gemini-3.1-flash-lite",
                                visible=False, variant="primary",
                            )

                    def _run_audit(term, relations, upload, drops_key, model, budget_label,
                                   use_thinking, auto_switch, resume_state):
                        from jarvis import build_audit_prompt, run_jarvis_flow
                        from jdm_agent.tools.jdm_agent import build_jdm_agent
                        prompt = build_audit_prompt(
                            term=term, relation=relations,
                            budget_label=str(budget_label),
                            upload=bool(upload),
                        )
                        t = (term or "").strip()
                        headline = (
                            f"🔍 Audit de « {t} »"
                            if t else "🔍 Audit (terme polysémique tiré au hasard)"
                        )
                        abort_yielded = False
                        for chunk in run_jarvis_flow(
                            prompt=prompt, headline=headline,
                            model=model, api_key="",
                            budget_label=str(budget_label),
                            drops_key=drops_key,
                            build_llm_fn=_build_llm,
                            build_agent_fn=build_jdm_agent,
                            get_client_fn=get_client,
                            use_thinking=bool(use_thinking),
                            auto_switch_on_perday=bool(auto_switch),
                            resume_state=resume_state,
                        ):
                            if len(chunk) == 5:
                                messages, fpath, fprev, state, _ = chunk
                                abort_yielded = True
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    state, gr.update(visible=True),
                                )
                            else:
                                messages, fpath, fprev = chunk
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    gr.skip(), gr.skip(),
                                )
                        if not abort_yielded:
                            yield (gr.skip(), gr.skip(), gr.skip(),
                                   None, gr.update(visible=False))

                    _ja_inputs = [ja_term, ja_relation, ja_upload,
                                  jarvis_drops_key, jarvis_model, jarvis_budget,
                                  jarvis_thinking, jarvis_auto_switch_cb,
                                  ja_resume_state]
                    _ja_outputs = [ja_chat, ja_file, ja_preview,
                                   ja_resume_state, ja_continue_btn]
                    ja_launch.click(_run_audit, inputs=_ja_inputs, outputs=_ja_outputs)
                    ja_continue_btn.click(_run_audit, inputs=_ja_inputs, outputs=_ja_outputs)
                    ja_chat.change(
                        refresh_dropdowns_silent,
                        inputs=None,
                        outputs=[model_in, jarvis_model],
                        show_progress="hidden",
                    )

                    def _show_audit_submit(file_path, drops_key):
                        if not file_path:
                            return gr.update(visible=False)
                        from jarvis import has_drops_key as _hk
                        return gr.update(visible=True, interactive=_hk(drops_key))

                    ja_file.change(
                        _show_audit_submit,
                        inputs=[ja_file, jarvis_drops_key],
                        outputs=[ja_submit],
                    )

                    def _submit_audit(file_path, drops_key, model, chat):
                        from jarvis import submit_existing_file
                        return submit_existing_file(file_path, drops_key, model, chat)

                    ja_submit.click(
                        _submit_audit,
                        inputs=[ja_file, jarvis_drops_key, jarvis_model, ja_chat],
                        outputs=[ja_chat],
                    )

                with gr.Tab("🕳️ Détection de trous", id="jarvis-gaps"):
                    gr.Markdown(
                        "Identifie les trous de couverture (MISSING / "
                        "NEGATIVE_FILLED / LOW_COVERAGE) pour un terme. "
                        "Le LLM ajoute une synthèse narrative et propose "
                        "des routages vers les autres sous-onglets."
                    )
                    with gr.Row():
                        with gr.Column(scale=1):
                            jg_term = gr.Textbox(
                                label="Terme à analyser (optionnel — vide = tirage au hasard)",
                                placeholder="ex: smartphone",
                            )
                            jg_relations = gr.Dropdown(
                                choices=JARVIS_RELATIONS,
                                value=[],
                                label="Relation(s) à examiner (optionnel — multi-sélection)",
                                allow_custom_value=True,
                                multiselect=True,
                            )
                            jg_min_pos = gr.Slider(
                                1, 10, value=3, step=1,
                                label="Seuil LOW_COVERAGE (< N triplets positifs)",
                            )
                            jg_launch = gr.Button(
                                "🕳️ Détecter les trous",
                                variant="primary",
                            )
                            gr.Markdown("### Router un trou détecté")
                            jg_gap_dropdown = gr.Dropdown(
                                choices=[],
                                label="Choisis un gap à router",
                                interactive=True,
                            )
                            with gr.Row():
                                jg_route_enrich = gr.Button("→ Enrichir ce trou", scale=1)
                                jg_route_audit = gr.Button("→ Auditer", scale=1)
                                jg_route_stats = gr.Button("→ Stats", scale=1)
                        with gr.Column(scale=2):
                            jg_gaps_table = gr.Dataframe(
                                headers=["term", "relation", "type", "sévérité", "détail"],
                                datatype=["str", "str", "str", "number", "str"],
                                label="Trous détectés (déterministe, instantané)",
                                interactive=False,
                                wrap=True,
                            )
                            jg_chat = gr.Chatbot(
                                type="messages",
                                elem_id="jarvis-gaps-chat",
                                label="Synthèse de l'agent",
                                show_label=True,
                                resizable=True,
                                height=400,
                            )
                            jg_resume_state = gr.State(value=None)
                            jg_continue_btn = gr.Button(
                                "▶️ Continuer avec gemini-3.1-flash-lite",
                                visible=False, variant="primary",
                            )

                    def _run_gap_detection(term, relations, min_pos, drops_key, model,
                                           budget_label, use_thinking,
                                           auto_switch, resume_state):
                        """Détecte les gaps DIRECTEMENT (rapide, déterministe)
                        puis lance l'agent pour la synthèse narrative."""
                        from jarvis import build_gap_prompt, run_jarvis_flow
                        from jdm_agent.enrich.detectors import detect_gaps
                        from jdm_agent.tools.jdm_agent import build_jdm_agent

                        term = (term or "").strip()
                        target_rels = list(relations) if relations else None

                        # Terme vide AUTORISÉ : on saute le detect_gaps
                        # direct (impossible sans terme), l'agent tirera
                        # un terme au hasard puis fera lui-même detect_gaps.
                        if term:
                            try:
                                gaps = detect_gaps(
                                    get_client(), term,
                                    target_relations=target_rels,
                                    min_to_consider=int(min_pos),
                                )
                            except Exception as e:
                                yield (
                                    gr.update(value=[]),
                                    gr.update(choices=[], value=None),
                                    [{"role": "assistant",
                                      "content": f"❌ Erreur de détection : {e}"}],
                                )
                                return

                            table_rows = [
                                [g.term, g.relation, g.gap_type.value,
                                 round(g.severity, 2), g.detail[:120]]
                                for g in gaps
                            ]
                            gap_labels = [
                                f"{g.term} | {g.relation} | {g.gap_type.value}"
                                for g in gaps
                            ]
                            user_msg = f"Détecte les trous de « {term} »."
                        else:
                            # Pas de detect_gaps direct possible — placeholder
                            table_rows = []
                            gap_labels = []
                            user_msg = (
                                "Détecte les trous de JDM pour un terme "
                                "(tiré au hasard par toi)."
                            )

                        # Premier yield : tableau + dropdown (vides si term vide),
                        # chatbot placeholder
                        yield (
                            gr.update(value=table_rows),
                            gr.update(choices=gap_labels,
                                      value=gap_labels[0] if gap_labels else None),
                            [{"role": "user", "content": user_msg},
                             {"role": "assistant",
                              "content": "*🧠 Synthèse en cours…*"}],
                        )

                        # 2) Synthèse via l'agent (peut prendre du temps)
                        prompt = build_gap_prompt(
                            term=term, relations=target_rels,
                            budget_label=str(budget_label),
                        )
                        headline = (
                            f"🕳️ Détection de trous pour « {term} »"
                            if term else "🕳️ Détection (terme tiré au hasard)"
                        )
                        # run_jarvis_flow yield (messages, fpath, fprev) —
                        # gap_detection ne produit pas de fichier, on ignore
                        # les 2 derniers.
                        abort_yielded = False
                        for chunk in run_jarvis_flow(
                            prompt=prompt, headline=headline,
                            model=model, api_key="",
                            budget_label=str(budget_label),
                            drops_key=drops_key,
                            build_llm_fn=_build_llm,
                            build_agent_fn=build_jdm_agent,
                            get_client_fn=get_client,
                            use_thinking=bool(use_thinking),
                            auto_switch_on_perday=bool(auto_switch),
                            resume_state=resume_state,
                        ):
                            if len(chunk) == 5:
                                chat_msgs, _fp, _fpv, state, _ = chunk
                                abort_yielded = True
                                yield (gr.update(), gr.update(), chat_msgs,
                                       state, gr.update(visible=True))
                            else:
                                chat_msgs, _fp, _fpv = chunk
                                yield (gr.update(), gr.update(), chat_msgs,
                                       gr.skip(), gr.skip())
                        if not abort_yielded:
                            yield (gr.skip(), gr.skip(), gr.skip(),
                                   None, gr.update(visible=False))

                    _jg_inputs = [jg_term, jg_relations, jg_min_pos,
                                  jarvis_drops_key, jarvis_model, jarvis_budget,
                                  jarvis_thinking, jarvis_auto_switch_cb,
                                  jg_resume_state]
                    _jg_outputs = [jg_gaps_table, jg_gap_dropdown, jg_chat,
                                   jg_resume_state, jg_continue_btn]
                    jg_launch.click(_run_gap_detection, inputs=_jg_inputs, outputs=_jg_outputs)
                    jg_continue_btn.click(_run_gap_detection, inputs=_jg_inputs, outputs=_jg_outputs)
                    jg_chat.change(
                        refresh_dropdowns_silent,
                        inputs=None,
                        outputs=[model_in, jarvis_model],
                        show_progress="hidden",
                    )

                    # Routage du gap sélectionné → onglet Enrichissement,
                    # avec pré-remplissage des champs.
                    def _route_gap_to_enrich(gap_label):
                        if not gap_label:
                            return (gr.update(), gr.update(),
                                    gr.update())  # no-op
                        parts = [p.strip() for p in gap_label.split("|")]
                        if len(parts) < 2:
                            return (gr.update(), gr.update(), gr.update())
                        term_v, relation_v = parts[0], parts[1]
                        return (
                            gr.update(value=term_v),         # je_term
                            gr.update(value=[relation_v]),   # je_relation (multiselect)
                            gr.update(selected="jarvis-enrich"),  # jarvis_tabs
                        )

                    jg_route_enrich.click(
                        _route_gap_to_enrich,
                        inputs=[jg_gap_dropdown],
                        outputs=[je_term, je_relation, jarvis_tabs],
                    )

                    # Routage vers Audit (le sous-onglet Audit a été défini
                    # AVANT Détection — ja_term/ja_relation sont en scope ici).
                    def _route_gap_to_audit(gap_label):
                        if not gap_label:
                            return (gr.update(), gr.update(), gr.update())
                        parts = [p.strip() for p in gap_label.split("|")]
                        if len(parts) < 2:
                            return (gr.update(), gr.update(), gr.update())
                        term_v, relation_v = parts[0], parts[1]
                        return (
                            gr.update(value=term_v),
                            gr.update(value=[relation_v]),   # multiselect
                            gr.update(selected="jarvis-audit"),
                        )
                    jg_route_audit.click(
                        _route_gap_to_audit,
                        inputs=[jg_gap_dropdown],
                        outputs=[ja_term, ja_relation, jarvis_tabs],
                    )

                with gr.Tab("⚠️ Signalement", id="jarvis-err"):
                    gr.Markdown(
                        "Scanne les triplets d'un terme (optionnellement "
                        "restreint à une ou plusieurs relations) et flagge "
                        "ceux qui paraissent suspects au LLM. Le LLM utilise "
                        "son **jugement linguistique** — sa suspicion vaut, "
                        "même sans preuve d'outil. Produit un fichier `.err`."
                    )
                    with gr.Row():
                        with gr.Column(scale=1):
                            js_term = gr.Textbox(
                                label="Terme à scanner (optionnel — vide = tirage au hasard)",
                                placeholder="ex: baleine",
                            )
                            js_relation = gr.Dropdown(
                                choices=JARVIS_RELATIONS,
                                value=[],
                                label="Relation(s) à scanner (optionnel — multi-sélection)",
                                allow_custom_value=True,
                                multiselect=True,
                            )
                            js_upload = gr.Checkbox(
                                value=False,
                                label="Soumettre directement à JDM (LLMDrops)",
                                info="Nécessite une clé API LLMDrops dans le bandeau ou en env.",
                            )
                            js_launch = gr.Button(
                                "⚠️ Scanner et signaler",
                                variant="primary",
                            )
                            from jarvis import has_drops_key as _hk_s
                            js_submit = gr.Button(
                                "📤 Soumettre à JDM (post-hoc)",
                                variant="stop",
                                visible=False,
                                interactive=_hk_s(),
                            )
                        with gr.Column(scale=2):
                            js_chat = gr.Chatbot(
                                type="messages",
                                elem_id="jarvis-err-chat",
                                show_label=False,
                                resizable=True,
                                height=520,
                            )
                            js_file = gr.File(
                                label="📄 Fichier produit (télécharger)",
                                interactive=False,
                                visible=False,
                            )
                            js_preview = gr.Code(
                                label="Aperçu du fichier",
                                language=None,
                                lines=12,
                                interactive=False,
                                visible=False,
                            )
                            js_resume_state = gr.State(value=None)
                            js_continue_btn = gr.Button(
                                "▶️ Continuer avec gemini-3.1-flash-lite",
                                visible=False, variant="primary",
                            )

                    def _run_signalement(term, relations, upload, drops_key, model,
                                         budget_label, use_thinking,
                                         auto_switch, resume_state):
                        from jarvis import build_signalement_prompt, run_jarvis_flow
                        from jdm_agent.tools.jdm_agent import build_jdm_agent
                        prompt = build_signalement_prompt(
                            term=term, relation=relations,
                            budget_label=str(budget_label),
                            upload=bool(upload),
                        )
                        t = (term or "").strip()
                        headline = (
                            f"⚠️ Signalement pour « {t} »"
                            if t else "⚠️ Signalement (terme tiré au hasard)"
                        )
                        abort_yielded = False
                        for chunk in run_jarvis_flow(
                            prompt=prompt, headline=headline,
                            model=model, api_key="",
                            budget_label=str(budget_label),
                            drops_key=drops_key,
                            build_llm_fn=_build_llm,
                            build_agent_fn=build_jdm_agent,
                            get_client_fn=get_client,
                            use_thinking=bool(use_thinking),
                            auto_switch_on_perday=bool(auto_switch),
                            resume_state=resume_state,
                        ):
                            if len(chunk) == 5:
                                messages, fpath, fprev, state, _ = chunk
                                abort_yielded = True
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    state, gr.update(visible=True),
                                )
                            else:
                                messages, fpath, fprev = chunk
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    gr.skip(), gr.skip(),
                                )
                        if not abort_yielded:
                            yield (gr.skip(), gr.skip(), gr.skip(),
                                   None, gr.update(visible=False))

                    _js_inputs = [js_term, js_relation, js_upload,
                                  jarvis_drops_key, jarvis_model, jarvis_budget,
                                  jarvis_thinking, jarvis_auto_switch_cb,
                                  js_resume_state]
                    _js_outputs = [js_chat, js_file, js_preview,
                                   js_resume_state, js_continue_btn]
                    js_launch.click(_run_signalement, inputs=_js_inputs, outputs=_js_outputs)
                    js_continue_btn.click(_run_signalement, inputs=_js_inputs, outputs=_js_outputs)
                    js_chat.change(
                        refresh_dropdowns_silent,
                        inputs=None,
                        outputs=[model_in, jarvis_model],
                        show_progress="hidden",
                    )

                    def _show_signal_submit(file_path, drops_key):
                        if not file_path:
                            return gr.update(visible=False)
                        from jarvis import has_drops_key as _hk
                        return gr.update(visible=True, interactive=_hk(drops_key))

                    js_file.change(
                        _show_signal_submit,
                        inputs=[js_file, jarvis_drops_key],
                        outputs=[js_submit],
                    )

                    def _submit_signal(file_path, drops_key, model, chat):
                        from jarvis import submit_existing_file
                        return submit_existing_file(file_path, drops_key, model, chat)

                    js_submit.click(
                        _submit_signal,
                        inputs=[js_file, jarvis_drops_key, jarvis_model, js_chat],
                        outputs=[js_chat],
                    )

                with gr.Tab("📊 Stats", id="jarvis-stats"):
                    gr.Markdown(
                        "Statistiques de couverture JDM. Deux modes "
                        "(combinables) :\n"
                        "* **PAR_TERME** — distribution des triplets sur "
                        "les relations principales pour un terme donné.\n"
                        "* **PAR_RELATION** — distribution typique d'une "
                        "relation sur des termes-pivots variés.\n\n"
                        "Le LLM rend un tableau machine-lisible + des "
                        "observations clés en prose."
                    )
                    with gr.Row():
                        with gr.Column(scale=1):
                            jst_term = gr.Textbox(
                                label="Terme (optionnel — mode PAR_TERME)",
                                placeholder="ex: chat",
                            )
                            jst_relation = gr.Dropdown(
                                choices=JARVIS_RELATIONS,
                                value=[],
                                label="Relation(s) (optionnel — multi-sélection)",
                                allow_custom_value=True,
                                multiselect=True,
                                info=(
                                    "Si renseigné, le scan est restreint "
                                    "strictement à ces relations. Sinon, "
                                    "le LLM choisit librement (couverture "
                                    "≥ 8-12 types)."
                                ),
                            )
                            gr.Markdown(
                                "<small><em>Si les deux champs sont vides, "
                                "le LLM choisira un terme au hasard.</em></small>"
                            )
                            jst_upload = gr.Checkbox(
                                value=False,
                                label="Soumettre directement à JDM (LLMDrops)",
                                info="Nécessite une clé API LLMDrops dans le bandeau ou en env.",
                            )
                            jst_launch = gr.Button(
                                "📊 Lancer les stats",
                                variant="primary",
                            )
                            from jarvis import has_drops_key as _hk_st
                            jst_submit = gr.Button(
                                "📤 Soumettre à JDM (post-hoc)",
                                variant="stop",
                                visible=False,
                                interactive=_hk_st(),
                            )
                        with gr.Column(scale=2):
                            jst_chat = gr.Chatbot(
                                type="messages",
                                elem_id="jarvis-stats-chat",
                                show_label=False,
                                resizable=True,
                                height=520,
                            )
                            jst_file = gr.File(
                                label="📄 Fichier produit (télécharger)",
                                interactive=False,
                                visible=False,
                            )
                            jst_preview = gr.Code(
                                label="Aperçu du fichier",
                                language=None,
                                lines=12,
                                interactive=False,
                                visible=False,
                            )
                            jst_resume_state = gr.State(value=None)
                            jst_continue_btn = gr.Button(
                                "▶️ Continuer avec gemini-3.1-flash-lite",
                                visible=False, variant="primary",
                            )

                    def _run_stats(term, relations, upload, drops_key, model,
                                   budget_label, use_thinking,
                                   auto_switch, resume_state):
                        from jarvis import build_stats_prompt, run_jarvis_flow
                        from jdm_agent.tools.jdm_agent import build_jdm_agent
                        prompt = build_stats_prompt(
                            term=term, relation=relations,
                            budget_label=str(budget_label),
                            upload=bool(upload),
                        )
                        t = (term or "").strip()
                        rels = relations if isinstance(relations, list) else (
                            [relations] if relations else []
                        )
                        if t and rels:
                            headline = f"📊 Stats sur « {t} » + {len(rels)} relation(s)"
                        elif t:
                            headline = f"📊 Stats sur « {t} »"
                        elif rels:
                            headline = f"📊 Stats sur {len(rels)} relation(s)"
                        else:
                            headline = "📊 Stats (terme tiré au hasard)"
                        abort_yielded = False
                        for chunk in run_jarvis_flow(
                            prompt=prompt, headline=headline,
                            model=model, api_key="",
                            budget_label=str(budget_label),
                            drops_key=drops_key,
                            build_llm_fn=_build_llm,
                            build_agent_fn=build_jdm_agent,
                            get_client_fn=get_client,
                            use_thinking=bool(use_thinking),
                            auto_switch_on_perday=bool(auto_switch),
                            resume_state=resume_state,
                        ):
                            if len(chunk) == 5:
                                messages, fpath, fprev, state, _ = chunk
                                abort_yielded = True
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    state, gr.update(visible=True),
                                )
                            else:
                                messages, fpath, fprev = chunk
                                yield (
                                    messages,
                                    gr.update(value=fpath, visible=bool(fpath)),
                                    gr.update(value=fprev, visible=bool(fprev)),
                                    gr.skip(), gr.skip(),
                                )
                        if not abort_yielded:
                            yield (gr.skip(), gr.skip(), gr.skip(),
                                   None, gr.update(visible=False))

                    _jst_inputs = [jst_term, jst_relation, jst_upload,
                                   jarvis_drops_key, jarvis_model, jarvis_budget,
                                   jarvis_thinking, jarvis_auto_switch_cb,
                                   jst_resume_state]
                    _jst_outputs = [jst_chat, jst_file, jst_preview,
                                    jst_resume_state, jst_continue_btn]
                    jst_launch.click(_run_stats, inputs=_jst_inputs, outputs=_jst_outputs)
                    jst_continue_btn.click(_run_stats, inputs=_jst_inputs, outputs=_jst_outputs)
                    jst_chat.change(
                        refresh_dropdowns_silent,
                        inputs=None,
                        outputs=[model_in, jarvis_model],
                        show_progress="hidden",
                    )

                    def _show_stats_submit(file_path, drops_key):
                        if not file_path:
                            return gr.update(visible=False)
                        from jarvis import has_drops_key as _hk
                        return gr.update(visible=True, interactive=_hk(drops_key))

                    jst_file.change(
                        _show_stats_submit,
                        inputs=[jst_file, jarvis_drops_key],
                        outputs=[jst_submit],
                    )

                    def _submit_stats(file_path, drops_key, model, chat):
                        from jarvis import submit_existing_file
                        return submit_existing_file(file_path, drops_key, model, chat)

                    jst_submit.click(
                        _submit_stats,
                        inputs=[jst_file, jarvis_drops_key, jarvis_model, jst_chat],
                        outputs=[jst_chat],
                    )

                    # Routage du bouton « → Stats » du sous-onglet Détection
                    # (jst_term/jst_relation existent maintenant — forward
                    # refs OK pour ce câblage tardif).
                    def _route_gap_to_stats(gap_label):
                        if not gap_label:
                            return (gr.update(), gr.update(), gr.update())
                        parts = [p.strip() for p in gap_label.split("|")]
                        if len(parts) < 2:
                            return (gr.update(), gr.update(), gr.update())
                        term_v, relation_v = parts[0], parts[1]
                        return (
                            gr.update(value=term_v),
                            gr.update(value=[relation_v]),   # multiselect
                            gr.update(selected="jarvis-stats"),
                        )
                    jg_route_stats.click(
                        _route_gap_to_stats,
                        inputs=[jg_gap_dropdown],
                        outputs=[jst_term, jst_relation, jarvis_tabs],
                    )

                # ---- Sous-onglet 6 : 📁 Productions ----
                # Centralise TOUS les fichiers produits par l'agent (sous-graphes
                # HTML, .enrich, .audit, .err, .stat). Arborescence à gauche,
                # viewer adaptatif à droite (iframe pour HTML, code pour text,
                # télécharge pour le reste). Pas d'écrasement : tout file producer
                # détecte les collisions et suffixe (_2, _3…).
                with gr.Tab("📥 Drops", id="jarvis-drops"):
                    gr.Markdown(
                        "**Tous les fichiers produits** par l'agent (sous-graphes, "
                        "enrichissements, audits, signalements, stats) sont listés "
                        "ici, du PLUS RÉCENT au PLUS ANCIEN. Aucun écrasement : les "
                        "collisions de nom sont suffixées automatiquement (`_2`, `_3`…). "
                        "La liste se rafraîchit toute seule toutes les 3 secondes. "
                        "Sélectionne un fichier puis **📤 Soumettre à JDM** pour le "
                        "pousser au LLMDrops directement depuis ici."
                    )

                    def _scan_productions_choices():
                        """Liste (label, path) triée par mtime DESC. Label format
                        '<nom> — <KB>KB · <âge>s' pour scan visuel rapide."""
                        if not PRODUCTIONS_DIR.exists():
                            return []
                        import time as _t_prod
                        now = _t_prod.time()
                        files = []
                        for p in PRODUCTIONS_DIR.iterdir():
                            if not p.is_file():
                                continue
                            try:
                                st = p.stat()
                                files.append((p, st.st_size, st.st_mtime))
                            except OSError:
                                continue
                        files.sort(key=lambda x: -x[2])
                        out = []
                        for p, sz, mt in files:
                            age = int(now - mt)
                            if age < 60:
                                age_s = f"{age}s"
                            elif age < 3600:
                                age_s = f"{age // 60}min"
                            elif age < 86400:
                                age_s = f"{age // 3600}h"
                            else:
                                age_s = f"{age // 86400}j"
                            sz_kb = sz / 1024
                            label = f"{p.name} — {sz_kb:.1f}KB · {age_s}"
                            out.append((label, str(p)))
                        return out

                    with gr.Row():
                        with gr.Column(scale=1, min_width=320):
                            prod_file_dropdown = gr.Dropdown(
                                choices=_scan_productions_choices(),
                                label="📂 Fichiers (du plus récent au plus ancien)",
                                value=None,
                                interactive=True,
                                filterable=True,
                            )
                            prod_refresh_btn = gr.Button("🔄 Rafraîchir maintenant",
                                                          size="sm")
                            # Timer de re-scan : tick toutes les 3s, met à jour
                            # les choices du Dropdown sans toucher à la sélection
                            # courante de l'utilisateur (gr.update(choices=…)
                            # préserve value si toujours présente).
                            prod_timer = gr.Timer(3.0, active=True)
                        with gr.Column(scale=3):
                            prod_status = gr.Markdown(
                                "*Sélectionne un fichier à gauche pour le visualiser.*"
                            )
                            prod_html_viewer = gr.HTML(visible=False)
                            prod_text_viewer = gr.Code(
                                visible=False, label="Contenu",
                                language="markdown", lines=30,
                            )
                            prod_download = gr.File(
                                visible=False, label="📥 Télécharger ce fichier",
                                interactive=False,
                            )
                            # Bouton soumission JDM — actif si fichier
                            # sélectionné ET clé LLMDrops dispo (env ou
                            # input). Sinon dégrise pour signaler.
                            with gr.Row():
                                prod_submit_btn = gr.Button(
                                    "📤 Soumettre ce fichier à JDM (LLMDrops)",
                                    variant="primary",
                                    interactive=False,
                                )
                            prod_submit_status = gr.Markdown(visible=False)

                    def _render_production_file(selected_path):
                        """Affiche le fichier selon son extension :
                          - .html → iframe (data:base64) comme dans Sous-graphe
                          - .enrich/.audit/.err/.stat/.txt/.md → gr.Code
                          - autre → gr.File pour téléchargement
                        Renvoie (status_md, html_html, text_code_update, file_update).
                        """
                        import base64 as _b64_prod
                        import time as _time_prod
                        if not selected_path:
                            return (
                                "*Sélectionne un fichier à gauche pour le visualiser.*",
                                gr.update(visible=False, value=""),
                                gr.update(visible=False, value=""),
                                gr.update(visible=False, value=None),
                            )
                        try:
                            sp = Path(selected_path)
                            if not sp.exists():
                                return (
                                    f"⚠️ Le fichier `{selected_path}` n'existe plus "
                                    "(supprimé ou renommé).",
                                    gr.update(visible=False, value=""),
                                    gr.update(visible=False, value=""),
                                    gr.update(visible=False, value=None),
                                )
                            size_kb = sp.stat().st_size / 1024
                            age_s = int(_time_prod.time() - sp.stat().st_mtime)
                            status_md = (
                                f"**📄 `{sp.name}`** — {size_kb:.1f} KB "
                                f"(modifié il y a {age_s}s)"
                            )
                            ext = sp.suffix.lower()
                            if ext == ".html":
                                # iframe data:base64 — comme viz_subgraph
                                html_text = sp.read_text(encoding="utf-8")
                                b64 = _b64_prod.b64encode(html_text.encode("utf-8")).decode("ascii")
                                iframe = (
                                    f'<iframe src="data:text/html;base64,{b64}" '
                                    f'style="width:100%;height:780px;border:1px solid #444;'
                                    f'border-radius:8px;background:#fff;display:block;" '
                                    f'sandbox="allow-scripts allow-same-origin"></iframe>'
                                )
                                return (
                                    status_md,
                                    gr.update(visible=True, value=iframe),
                                    gr.update(visible=False, value=""),
                                    gr.update(visible=True, value=str(sp)),
                                )
                            text_exts = {".enrich", ".audit", ".err", ".stat",
                                         ".txt", ".md", ".csv", ".json", ".log"}
                            if ext in text_exts:
                                content = sp.read_text(encoding="utf-8", errors="replace")
                                if len(content) > 200_000:
                                    content = content[:200_000] + "\n\n[… tronqué — télécharge pour tout voir]"
                                lang = {"json": "json", "md": "markdown"}.get(
                                    ext.lstrip("."), "markdown"
                                )
                                return (
                                    status_md,
                                    gr.update(visible=False, value=""),
                                    gr.update(visible=True, value=content, language=lang),
                                    gr.update(visible=True, value=str(sp)),
                                )
                            # Type inconnu : juste téléchargement
                            return (
                                status_md + " *(type non prévisualisé)*",
                                gr.update(visible=False, value=""),
                                gr.update(visible=False, value=""),
                                gr.update(visible=True, value=str(sp)),
                            )
                        except Exception as e:
                            return (
                                f"⚠️ Erreur lecture : {e}",
                                gr.update(visible=False, value=""),
                                gr.update(visible=False, value=""),
                                gr.update(visible=False, value=None),
                            )

                    # Handler unique : rend le fichier ET met à jour
                    # l'état du bouton submit en une seule passe. Évite
                    # le bug où le Timer (qui modifie les choices du
                    # Dropdown) re-déclenche en interne le change → un
                    # 2e handler bound séparément reçoit [] comme inputs
                    # (cf. erreur HF « didn't receive enough input values »).
                    def _render_and_toggle(selected_path, drops_key):
                        from jarvis import has_drops_key as _hk
                        status, html_u, text_u, file_u = _render_production_file(
                            selected_path
                        )
                        submit_ok = bool(selected_path) and _hk(drops_key)
                        return (
                            status, html_u, text_u, file_u,
                            gr.update(interactive=submit_ok),
                        )

                    prod_file_dropdown.change(
                        _render_and_toggle,
                        inputs=[prod_file_dropdown, jarvis_drops_key],
                        outputs=[prod_status, prod_html_viewer,
                                 prod_text_viewer, prod_download,
                                 prod_submit_btn],
                    )

                    # Refresh du bouton quand la clé Drops change SEULE
                    # (pas de changement de sélection). Handler dédié
                    # avec inputs explicites — pas de risque de fire
                    # interne car la textbox de clé ne participe pas
                    # au Timer du Dropdown.
                    def _toggle_submit_only(selected_path, drops_key):
                        from jarvis import has_drops_key as _hk
                        ok = bool(selected_path) and _hk(drops_key)
                        return gr.update(interactive=ok)

                    jarvis_drops_key.change(
                        _toggle_submit_only,
                        inputs=[prod_file_dropdown, jarvis_drops_key],
                        outputs=[prod_submit_btn],
                    )

                    def _submit_production_file(selected_path, drops_key, jarvis_model_v):
                        """Upload le fichier sélectionné vers LLMDrops via
                        jarvis.submit_existing_file (gère env override de
                        JDM_DROPS_API_KEY le temps de l'appel)."""
                        if not selected_path:
                            return gr.update(visible=True,
                                             value="⚠️ Aucun fichier sélectionné.")
                        try:
                            from jarvis import submit_existing_file
                            res = submit_existing_file(
                                file_path=selected_path,
                                drops_key=(drops_key or ""),
                                model_name=(jarvis_model_v or "manual_submission"),
                            )
                            if isinstance(res, dict) and res.get("ok"):
                                uploaded = res.get("uploaded_as") or Path(selected_path).name
                                return gr.update(
                                    visible=True,
                                    value=f"✅ **Soumis avec succès** sous le nom "
                                          f"`{uploaded}`. Réponse serveur : "
                                          f"`{str(res.get('response') or '')[:200]}`",
                                )
                            err = (res or {}).get("error") if isinstance(res, dict) else str(res)
                            return gr.update(
                                visible=True,
                                value=f"❌ **Échec de soumission** : {err}",
                            )
                        except Exception as e:
                            return gr.update(
                                visible=True,
                                value=f"❌ Erreur soumission : {e}",
                            )

                    prod_submit_btn.click(
                        _submit_production_file,
                        inputs=[prod_file_dropdown, jarvis_drops_key, jarvis_model],
                        outputs=[prod_submit_status],
                    )

                    def _refresh_choices():
                        """Re-scanne PRODUCTIONS_DIR et met à jour les choices
                        du Dropdown. Préserve la sélection courante si le
                        fichier existe encore (Gradio gère ça nativement)."""
                        return gr.update(choices=_scan_productions_choices())

                    prod_refresh_btn.click(
                        _refresh_choices,
                        inputs=None,
                        outputs=[prod_file_dropdown],
                    )
                    # Auto-refresh via Timer : tick toutes les 3s → re-scan
                    # du dir → mise à jour silencieuse des choices. Le user
                    # voit apparaître les nouveaux fichiers sans clic.
                    prod_timer.tick(
                        _refresh_choices,
                        inputs=None,
                        outputs=[prod_file_dropdown],
                    )

            # ---- Câblage transverse : quand la clé LLMDrops change dans
            # le bandeau, on rafraîchit l'état interactive des 4 boutons
            # « Soumettre » post-hoc (Enrich/Audit/Signalement/Stats).
            def _refresh_submit_buttons(drops_key):
                from jarvis import has_drops_key as _hk
                ok = _hk(drops_key)
                return (
                    gr.update(interactive=ok),
                    gr.update(interactive=ok),
                    gr.update(interactive=ok),
                    gr.update(interactive=ok),
                )

            jarvis_drops_key.change(
                _refresh_submit_buttons,
                inputs=[jarvis_drops_key],
                outputs=[je_submit, ja_submit, js_submit, jst_submit],
            )

            # Handler jarvis_model.change : binding différé à la fin
            # du Blocks (handler consolidé avec model_in).

        # ----- Tab 6: Aide / Installation (Phase 13.7) -----
        with gr.Tab("🛠️ Aide / Installation"):
            gr.Markdown(AIDE_MD)
            gr.Markdown("---")
            # === Panneau Configuration .env (admin) ===
            # Sur deploy-self : panneau qui LIT le fichier .env du repo
            # et permet de MODIFIER chaque variable (cles API, config) puis
            # de RE-ECRIRE le fichier. Utile sur un serveur dedie ou la UI
            # HF Settings n'existe pas — l'admin se connecte avec ?admin=1
            # + mot de passe et edite le .env via l'app au lieu d'ouvrir
            # un terminal SSH.
            # PROTECTION DOUBLE :
            #   1. URL flag ?admin=1 (cf. JS dans _HEAD_JS + CSS .admin-only)
            #      → sans le flag, le panneau est invisible dans le DOM
            #   2. Mot de passe (env var `EXPORT_SECRETS_PASSWORD`)
            #      → meme avec le flag, faut le mot de passe pour reveler/editer
            # Allowlist stricte des cles editables.
            EDITABLE_ENV_VARS = [
                # Secrets sensibles
                "ANTHROPIC_API_KEY",
                "OPENAI_API_KEY",
                "GOOGLE_API_KEY",
                "GOOGLE_API_KEYS",
                "GROQ_API_KEY",
                "DEEPSEEK_API_KEY",
                "JDM_DROPS_API_KEY",
                "EXPORT_SECRETS_PASSWORD",
                # Configuration
                "LLM_PROVIDER",
                "LLM_MODEL",
                "LLM_TEMPERATURE",
                "JDM_BASE_URL",
                "JDM_TIMEOUT",
                "JDM_DROPS_URL",
                "JDM_CACHE_TTL_META",
                "JDM_CACHE_TTL_DATA",
                "OLLAMA_BASE_URL",
                "APP_SUBPATH",
            ]
            # Variables traitees comme secrets (champ password masque)
            _SECRET_LIKE = lambda v: (
                v.endswith("_API_KEY") or v == "GOOGLE_API_KEYS"
                or v.endswith("_PASSWORD")
            )
            # Chemin du fichier .env a editer — racine du repo
            _ENV_FILE = Path(__file__).parent / ".env"

            def _parse_env_file(path):
                """Parse un .env (KEY=val ou KEY="val"). Renvoie un dict.
                Ignore les lignes commentees et vides. Tolere les guillemets
                doubles/simples et les commentaires inline (apres #).
                """
                result = {}
                if not path.exists():
                    return result
                try:
                    raw = path.read_text(encoding="utf-8")
                except Exception:
                    return result
                for line in raw.splitlines():
                    s = line.strip()
                    if not s or s.startswith("#"):
                        continue
                    if "=" not in s:
                        continue
                    key, _, val = s.partition("=")
                    key = key.strip()
                    val = val.strip()
                    # Retire commentaire inline non-protege par guillemets
                    if val and val[0] not in ('"', "'"):
                        # split sur # uniquement s'il y a un espace avant
                        hashpos = val.find("  #")
                        if hashpos < 0:
                            hashpos = val.find(" #")
                        if hashpos >= 0:
                            val = val[:hashpos].strip()
                    # Retire les guillemets externes + unescape
                    if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
                        val = val[1:-1]
                        val = val.replace('\\"', '"').replace("\\\\", "\\")
                    result[key] = val
                return result

            with gr.Accordion(
                "⚙️ Configuration .env (admin uniquement)",
                open=False,
                elem_classes=["admin-only"],
            ):
                gr.Markdown(
                    "Edite les variables d'environnement persistees dans le "
                    "fichier `.env` a la racine du repo. Mot de passe requis "
                    "(`EXPORT_SECRETS_PASSWORD` defini dans `.env` ou env "
                    "shell). La sauvegarde reecrit le fichier ; les variables "
                    "non listees ici (commentaires, vars custom) sont "
                    "**preservees** au mieux."
                )
                with gr.Row():
                    _cfg_pw = gr.Textbox(
                        label="Mot de passe (`EXPORT_SECRETS_PASSWORD`)",
                        type="password", placeholder="…",
                        scale=3,
                    )
                    _cfg_unlock_btn = gr.Button(
                        "🔓 Deverrouiller",
                        variant="primary", scale=1,
                    )
                _cfg_status = gr.Markdown(visible=False)

                # Form de tous les champs editables — rendus invisibles
                # jusqu'au deverrouillage.
                _cfg_fields = {}
                with gr.Group(visible=False) as _cfg_form:
                    for var in EDITABLE_ENV_VARS:
                        _cfg_fields[var] = gr.Textbox(
                            label=var,
                            type="password" if _SECRET_LIKE(var) else "text",
                            placeholder=f"valeur de {var} (vide = non definie)",
                            interactive=True,
                            value="",
                        )
                    _cfg_save_btn = gr.Button(
                        "💾 Sauvegarder dans .env",
                        variant="primary",
                    )
                    _cfg_save_status = gr.Markdown(visible=False)

            def _cfg_unlock(pw: str):
                """Verifie le mot de passe puis charge les valeurs du .env
                (ou os.environ en fallback) dans les champs."""
                expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
                if not expected:
                    return (
                        gr.update(
                            visible=True,
                            value="⚠️ **Non configure.** Definis "
                                  "`EXPORT_SECRETS_PASSWORD` dans ton .env "
                                  "(ou env var shell) puis relance l'app.",
                        ),
                        gr.update(visible=False),
                        *[gr.update() for _ in EDITABLE_ENV_VARS],
                    )
                if not pw or pw.strip() != expected:
                    return (
                        gr.update(
                            visible=True,
                            value="❌ **Mot de passe incorrect.**",
                        ),
                        gr.update(visible=False),
                        *[gr.update() for _ in EDITABLE_ENV_VARS],
                    )
                # OK : lire le .env existant et pre-remplir
                env_dict = _parse_env_file(_ENV_FILE)
                field_updates = []
                for var in EDITABLE_ENV_VARS:
                    val = env_dict.get(var, os.environ.get(var, ""))
                    field_updates.append(gr.update(value=val))
                return (
                    gr.update(
                        visible=True,
                        value=f"✅ **Deverrouille.** Fichier source : "
                              f"`{_ENV_FILE}` "
                              f"({'existe' if _ENV_FILE.exists() else 'sera cree'}).",
                    ),
                    gr.update(visible=True),
                    *field_updates,
                )

            def _cfg_save(*values):
                """Ecrit toutes les valeurs dans le .env. Preserve les
                lignes existantes non-allowlistees (commentaires + vars
                custom) en les recopiant au debut du fichier."""
                # Re-verification : qu'on n'a pas perdu le contexte admin
                expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
                if not expected:
                    return gr.update(
                        visible=True,
                        value="⚠️ **Non configure.** Definis "
                              "`EXPORT_SECRETS_PASSWORD` d'abord.",
                    )
                # Map var → nouvelle valeur soumise
                new_values = dict(zip(EDITABLE_ENV_VARS, values))
                # Lit le .env existant pour preserver les lignes non gerees
                preserved_lines = []
                if _ENV_FILE.exists():
                    try:
                        raw = _ENV_FILE.read_text(encoding="utf-8")
                        for line in raw.splitlines():
                            s = line.strip()
                            if not s or s.startswith("#"):
                                preserved_lines.append(line)
                                continue
                            if "=" not in s:
                                preserved_lines.append(line)
                                continue
                            key = s.partition("=")[0].strip()
                            if key not in EDITABLE_ENV_VARS:
                                # Var hors allowlist : on garde la ligne
                                preserved_lines.append(line)
                    except Exception as e:
                        return gr.update(
                            visible=True,
                            value=f"❌ **Lecture impossible** : `{e}`",
                        )
                # Compose le nouveau contenu
                output_lines = []
                if preserved_lines:
                    output_lines.extend(preserved_lines)
                    output_lines.append("")
                output_lines.append("# === Variables editees via le panneau Config ===")
                n_written = 0
                n_skipped = 0
                for var in EDITABLE_ENV_VARS:
                    val = new_values.get(var, "")
                    if val is None:
                        val = ""
                    val = str(val).strip()
                    if not val:
                        # Vide → on ecrit la ligne commentee pour montrer
                        # que la var existe mais n'est pas definie
                        output_lines.append(f"# {var}=")
                        n_skipped += 1
                        continue
                    # Echappe pour le format .env
                    safe = val.replace("\\", "\\\\").replace('"', '\\"')
                    output_lines.append(f'{var}="{safe}"')
                    n_written += 1
                final = "\n".join(output_lines) + "\n"
                try:
                    _ENV_FILE.write_text(final, encoding="utf-8")
                except Exception as e:
                    return gr.update(
                        visible=True,
                        value=f"❌ **Ecriture impossible** dans `{_ENV_FILE}` "
                              f": `{e}`. Verifie les droits d'ecriture du "
                              f"process.",
                    )
                return gr.update(
                    visible=True,
                    value=f"✅ **Sauvegarde** dans `{_ENV_FILE}` "
                          f"({n_written} variables definies, "
                          f"{n_skipped} vides). "
                          f"⚠️ Les changements ne prennent effet qu'au "
                          f"prochain redemarrage de l'app.",
                )

            _cfg_unlock_btn.click(
                _cfg_unlock,
                inputs=[_cfg_pw],
                outputs=[_cfg_status, _cfg_form,
                         *[_cfg_fields[v] for v in EDITABLE_ENV_VARS]],
            )
            _cfg_save_btn.click(
                _cfg_save,
                inputs=[_cfg_fields[v] for v in EDITABLE_ENV_VARS],
                outputs=[_cfg_save_status],
            )

        # ----- Sync des dropdowns modèle entre onglets -----
        # 1) Le marquage « épuisé » d'un modèle (blown PerDay) doit être
        #    visible sur les DEUX dropdowns sans avoir à lancer un flow.
        # 2) Le modèle courant (_CURRENT_MODEL, session-wide) doit être
        #    affiché par les DEUX dropdowns à chaque retour d'onglet —
        #    pas le `value` initial hardcodé du composant.
        # 3) Changer le modèle dans un onglet → l'AUTRE dropdown bascule
        #    instantanément sur le même choix (cross-sync direct).
        def _refresh_both_dropdowns():
            cur = _CURRENT_MODEL or "gemini-3.1-flash-lite"
            return (
                gr.update(choices=build_model_choices(), value=cur),
                gr.update(choices=build_model_choices(), value=cur),
            )
        main_tabs.select(
            _refresh_both_dropdowns,
            inputs=None,
            outputs=[model_in, jarvis_model],
            show_progress="hidden",
        )

        # Bouton « Rotation clés gemini » :
        # CAUSE ROOT lue dans gradio/_frontend_code/dropdown/shared/
        # Dropdown.svelte L95-101 : quand choices update, Gradio appelle
        # set_input_text() qui set input_text = label de la value
        # courante, puis handle_filter(choices, input_text) filtre la
        # liste à ce substring → seule la value courante visible.
        # FIX : .then(js=...) dispatch un 'focus' sur l'input → la fn
        # handle_focus (L152-155) reset filtered_indices à tous les
        # choices → toutes les options redeviennent visibles.
        def _switch_api_key():
            cur_key = _CURRENT_GEMINI_KEY
            cur_mod = _CURRENT_MODEL or "gemini-3.1-flash-lite"
            next_key = pick_unblown_gemini_key(cur_mod, skip=cur_key)
            if next_key and next_key != cur_key:
                set_current_gemini_key(next_key)
            choices = build_model_choices()
            new_label = _switch_key_btn_label()
            return (
                gr.update(choices=choices),
                gr.update(choices=choices),
                gr.update(value=new_label),
                gr.update(value=new_label),
            )
        _switch_outputs = [model_in, jarvis_model,
                           chat_switch_key_btn, jarvis_switch_key_btn]
        # Pas de .then(js=...) ici : le reset du filter est géré
        # directement par la MutationObserver setupée dans le click
        # handler de injectSwitchKeyButton (cf. _HEAD_JS). Cet observer
        # réagit IMMÉDIATEMENT à la mutation de ul par Svelte → aucun
        # délai de setTimeout visible → pas de flash.
        chat_switch_key_btn.click(
            _switch_api_key, inputs=None,
            outputs=_switch_outputs,
            show_progress="hidden",
        )
        jarvis_switch_key_btn.click(
            _switch_api_key, inputs=None,
            outputs=_switch_outputs,
            show_progress="hidden",
        )
        # ---- Handlers consolidés .change pour les deux dropdowns ----
        # UN SEUL aller-retour serveur par pick (au lieu de 3+ avant) :
        # - set_current_model(_CURRENT_MODEL tracking)
        # - key_in (model_in seulement) : interactive si BYOK
        # - thinking checkbox : interactive si supporté
        # - sync de la VALUE du dropdown jumeau (pas des choices →
        #   pas de rebuild de liste = pas de progress bar).
        # Le ✅ ne suit pas instantanément (recalc seulement aux flow
        # yields + tab.select), c'est cosmétique pur — Gradio affiche
        # déjà la valeur sélectionnée dans la case fermée.
        def _on_model_change_chat(m: str):
            set_current_model(m)
            needs_key = m.startswith("claude-") or m.startswith("gpt-")
            thinking_update = (gr.update(interactive=True)
                               if m in THINKING_SUPPORTED_MODELS
                               else gr.update(interactive=False, value=False))
            # Refresh choices avec ✅ devant le NOUVEAU modèle courant,
            # même operation pour les deux dropdowns. show_progress=
            # "hidden" rend l'aller-retour invisible.
            choices = build_model_choices()
            return (
                gr.update(  # key_in
                    interactive=needs_key,
                    placeholder=("sk-ant-… ou sk-…" if needs_key
                                 else "Non requis pour les modèles Gemini hébergés"),
                ),
                thinking_update,  # chat_thinking
                gr.update(choices=choices, value=m),  # model_in
                gr.update(choices=choices, value=m),  # jarvis_model
            )
        model_in.change(
            _on_model_change_chat,
            inputs=[model_in],
            outputs=[key_in, chat_thinking, model_in, jarvis_model],
            show_progress="hidden",
        ).then(
            fn=None, inputs=[model_in], outputs=None,
            js=_thinking_tooltip_js("chat-thinking-cb"),
        )

        def _on_jarvis_model_change(m: str):
            set_current_model(m)
            thinking_update = (gr.update(interactive=True)
                               if m in THINKING_SUPPORTED_MODELS
                               else gr.update(interactive=False, value=False))
            choices = build_model_choices()
            return (
                thinking_update,  # jarvis_thinking
                gr.update(choices=choices, value=m),  # model_in
                gr.update(choices=choices, value=m),  # jarvis_model
            )
        jarvis_model.change(
            _on_jarvis_model_change,
            inputs=[jarvis_model],
            outputs=[jarvis_thinking, model_in, jarvis_model],
            show_progress="hidden",
        ).then(
            fn=None, inputs=[jarvis_model], outputs=None,
            js=_thinking_tooltip_js("jarvis-thinking-cb"),
        )

    gr.Markdown(
        "---\n*Données : [JeuxDeMots](https://www.jeuxdemots.org) — "
        "M. Lafourcade, équipe TEXTE, LIRMM/CNRS. "
        "Projet open-source : [GitHub](https://github.com/expAg/JDMAgent).*"
    )


if __name__ == "__main__":
    # HF Spaces : bind explicite sur 0.0.0.0 (sinon Gradio essaye localhost
    # qui n'est pas joignable dans le conteneur) et port standard 7860.
    # ssr_mode=False : désactive le rendu côté serveur de Gradio 5. Sinon
    # Gradio tente un health-check sur localhost qui échoue dans le conteneur
    # HF Spaces ("When localhost is not accessible, a shareable link must be
    # created"). On garde le rendu client classique, ça marche partout.
    # pwa=True : Progressive Web App — permet au visiteur d'« installer »
    # la démo (icône bureau / écran d'accueil mobile, plein écran sans
    # barre URL, cache partiel des assets). Aucun coût si non utilisé.
    # APP_SUBPATH : chemin sous lequel l'app est servie quand elle est
    # derriere un reverse proxy avec sous-chemin (ex. monsite.fr/MaApp).
    # Sans cette var, Gradio genere des liens d'assets en racine absolue
    # (/assets/...) qui ne sont pas routes par le proxy → page blanche.
    # Format attendu : "/MaApp" (avec slash initial). Vide = sert a la
    # racine (cas par defaut, HF Space ou Docker direct).
    _subpath = os.environ.get("APP_SUBPATH", "").strip()
    demo.launch(server_name="0.0.0.0", server_port=7860,
                allowed_paths=[str(PRODUCTIONS_DIR)],
                root_path=_subpath,
                ssr_mode=False,
                pwa=True)
