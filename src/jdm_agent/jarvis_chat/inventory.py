"""Inventaire des agents Jarvis — built-ins + agents SUR MESURE persistés.

Un **AgentSpec** (dict sérialisable) décrit un agent lançable :

    {
      "id": "enrich",                # slug unique
      "title": "Enrichissement",
      "icon": "🌱",
      "accent": "var(--jdm-magenta)",
      "kicker": "Agent 1",
      "brief": "…",                  # une ligne
      "builtin": True,               # natif (code) vs sur mesure (disque)
      "template": "generation_endogene",  # custom only
      "system_prompt": "…stratégie…",     # custom only (le pré-prompt de tâche)
      "consolidates": True,          # lit le registry de consolidation
      "writes": True,                # a l'outil write_submission_file
      "output_ext": ".enrich",       # extension du fichier produit
      "canonical_mode": "auto_append",
      "defaults": {"target_count": 3, ...},
    }

Les 6 natifs sont définis EN CODE (source de vérité des capacités :
`consolidates`, `output_ext`, `canonical_mode`). Les agents sur mesure sont
persistés dans `.jarvis_agents.json` (racine projet) et rejoignent
l'inventaire au même titre que les natifs — lançables, supervisables.

Garde-fous (decision utilisateur) : un agent sur mesure n'a JAMAIS les outils
d'orchestration/secret (`start_agent`/`stop_agent`/`set_env`/`rollback_env`) —
de toute façon hors du toolset JDM d'un agent — et n'a l'ÉCRITURE
(`write_submission_file`) que si `writes` est vrai.
"""
from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
CUSTOM_AGENTS_PATH = _PROJECT_ROOT / ".jarvis_agents.json"
_LOCK = threading.Lock()

# Extensions de sortie autorisées (format → extension de fichier).
ALLOWED_OUTPUT_EXTS = {".enrich", ".audit", ".err", ".stat", ".annot", ".txt", ".json"}

# Outils JDM que l'agent sur mesure ne doit JAMAIS avoir (sécurité). Ils ne
# font pas partie du toolset JDM d'un agent, mais on les liste pour valider.
FORBIDDEN_TOOLS = {"start_agent", "stop_agent", "set_env", "rollback_env"}

# ───────────────────────── Built-ins (source de vérité capacités) ──────────
_BUILTINS: dict[str, dict] = {
    "enrich": {
        "id": "enrich", "title": "Enrichissement", "icon": "🌱",
        "accent": "var(--jdm-magenta)", "kicker": "Agent 1",
        "brief": "Propose et consolide de nouveaux triplets.",
        "consolidates": True, "writes": True,
        "output_ext": ".enrich", "canonical_mode": "auto_append",
    },
    "audit": {
        "id": "audit", "title": "Audit sémantique", "icon": "🔍",
        "accent": "var(--jdm-cyan)", "kicker": "Agent 2",
        "brief": "Vérifie sens par sens la légitimité des relations.",
        "consolidates": False, "writes": True,
        "output_ext": ".audit", "canonical_mode": "redirect",
    },
    "gap": {
        "id": "gap", "title": "Détection de trous", "icon": "🕳️",
        "accent": "var(--jdm-green)", "kicker": "Agent 3",
        "brief": "Repère les trous de couverture d'un terme.",
        "consolidates": False, "writes": False,
        "output_ext": ".gap", "canonical_mode": None,
    },
    "signalement": {
        "id": "signalement", "title": "Signalement", "icon": "⚠️",
        "accent": "var(--jdm-orange)", "kicker": "Agent 4",
        "brief": "Flag les triplets suspects pour un mainteneur.",
        "consolidates": False, "writes": True,
        "output_ext": ".err", "canonical_mode": "redirect",
    },
    "stats": {
        "id": "stats", "title": "Stats", "icon": "📊",
        "accent": "var(--jdm-violet)", "kicker": "Agent 5",
        "brief": "Mesure la couverture par terme et par relation.",
        "consolidates": False, "writes": True,
        "output_ext": ".stat", "canonical_mode": "redirect",
    },
    "annotation": {
        "id": "annotation", "title": "Annotation sémantique", "icon": "🏷️",
        "accent": "var(--jdm-yellow)", "kicker": "Agent 6",
        "brief": "Annote les triplets (constitutif / contrastif…).",
        "consolidates": False, "writes": True,
        "output_ext": ".annot", "canonical_mode": "redirect",
    },
}


# ───────────────────────── Templates pour le builder ───────────────────────
# Squelette déterministe par type. Le LLM (Phase 3) raffine la « stratégie »
# à partir de la description NL de l'utilisateur ; ces valeurs sont les
# défauts de capacités/format proposés dans le formulaire.
AGENT_TEMPLATES: dict[str, dict] = {
    "audit": {
        "label": "Audit",
        "consolidates": False, "writes": True,
        "output_ext": ".audit", "canonical_mode": "redirect",
        "skeleton": (
            "Tu AUDITES un terme : pour chaque sens (désambiguïsation), vérifie "
            "sens par sens quelles relations sont légitimes / contrastives / à "
            "corriger, et produis des verdicts justifiés."
        ),
    },
    "generation_endogene": {
        "label": "Génération endogène",
        "consolidates": True, "writes": True,
        "output_ext": ".enrich", "canonical_mode": "auto_append",
        "skeleton": (
            "Tu ENRICHIS un terme à partir de ses PROPRES idées associées "
            "(voisinage interne du graphe) : tu pars de ce que JDM connaît déjà "
            "du terme, tentes une relation cible spécifique, valides et "
            "consolides ce qui passe."
        ),
    },
    "generation_exogene": {
        "label": "Génération exogène",
        "consolidates": True, "writes": True,
        "output_ext": ".enrich", "canonical_mode": "auto_append",
        "skeleton": (
            "Tu ENRICHIS un terme avec de la connaissance EXTERNE au graphe "
            "(savoir général), en restant vérifiable : tu proposes des triplets "
            "plausibles, les valides via JDM (factcheck + inférence) et "
            "consolides ceux qui passent."
        ),
    },
    "libre": {
        "label": "Libre",
        "consolidates": False, "writes": False,
        "output_ext": ".txt", "canonical_mode": None,
        "skeleton": "Agent libre : suis fidèlement la stratégie décrite.",
    },
}


# ───────────────────────── Persistance custom ──────────────────────────────

def _load_custom_raw() -> list[dict]:
    if not CUSTOM_AGENTS_PATH.exists():
        return []
    try:
        data = json.loads(CUSTOM_AGENTS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_custom_raw(specs: list[dict]) -> None:
    try:
        CUSTOM_AGENTS_PATH.write_text(
            json.dumps(specs, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def slugify_agent_id(name: str) -> str:
    """Slug sûr et unique-isable pour un id d'agent sur mesure."""
    import unicodedata
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s or "agent"


def _normalize_spec(spec: dict) -> dict:
    """Valide + complète un spec custom (capacités cohérentes, format sûr)."""
    s = dict(spec or {})
    s["builtin"] = False
    s["id"] = slugify_agent_id(s.get("id") or s.get("title") or "agent")
    s["title"] = (s.get("title") or s["id"]).strip()
    s["icon"] = s.get("icon") or "🤖"
    s["accent"] = s.get("accent") or "var(--accent)"
    s["kicker"] = s.get("kicker") or "Sur mesure"
    s["brief"] = (s.get("brief") or "").strip()
    s["template"] = s.get("template") if s.get("template") in AGENT_TEMPLATES else "libre"
    tpl = AGENT_TEMPLATES[s["template"]]
    s["consolidates"] = bool(s.get("consolidates", tpl["consolidates"]))
    s["writes"] = bool(s.get("writes", tpl["writes"]))
    ext = s.get("output_ext") or tpl["output_ext"]
    if not str(ext).startswith("."):
        ext = "." + str(ext)
    s["output_ext"] = ext if ext in ALLOWED_OUTPUT_EXTS else tpl["output_ext"]
    # canonical_mode : cohérent avec writes/consolidates.
    if not s["writes"]:
        s["canonical_mode"] = None
    else:
        s["canonical_mode"] = "auto_append" if s["consolidates"] else "redirect"
    s["system_prompt"] = (s.get("system_prompt") or tpl["skeleton"]).strip()
    s["defaults"] = s.get("defaults") if isinstance(s.get("defaults"), dict) else {}
    return s


# ───────────────────────── API inventaire ──────────────────────────────────

def list_agent_specs() -> list[dict]:
    """Tous les agents : 6 natifs + sur mesure persistés."""
    out = [dict(v) | {"builtin": True} for v in _BUILTINS.values()]
    with _LOCK:
        for raw in _load_custom_raw():
            try:
                out.append(_normalize_spec(raw))
            except Exception:
                continue
    return out


def get_agent_spec(agent_id: str) -> Optional[dict]:
    """Spec d'un agent (natif ou sur mesure) ou None."""
    aid = (agent_id or "").strip()
    if aid in _BUILTINS:
        return dict(_BUILTINS[aid]) | {"builtin": True}
    with _LOCK:
        for raw in _load_custom_raw():
            try:
                spec = _normalize_spec(raw)
            except Exception:
                continue
            if spec["id"] == aid:
                return spec
    return None


def is_builtin(agent_id: str) -> bool:
    return (agent_id or "") in _BUILTINS


def save_agent_spec(spec: dict) -> dict:
    """Crée/écrase un agent sur mesure (id unique, slug auto). Refuse d'écraser
    un natif. Renvoie le spec normalisé persisté."""
    norm = _normalize_spec(spec)
    if norm["id"] in _BUILTINS:
        norm["id"] = norm["id"] + "_custom"
    with _LOCK:
        raw = _load_custom_raw()
        raw = [r for r in raw if slugify_agent_id(r.get("id") or r.get("title") or "") != norm["id"]]
        raw.append(norm)
        _write_custom_raw(raw)
    return norm


def delete_agent_spec(agent_id: str) -> bool:
    """Supprime un agent sur mesure. Renvoie True si supprimé."""
    aid = (agent_id or "").strip()
    if aid in _BUILTINS:
        return False
    with _LOCK:
        raw = _load_custom_raw()
        kept = [r for r in raw
                if slugify_agent_id(r.get("id") or r.get("title") or "") != aid]
        if len(kept) == len(raw):
            return False
        _write_custom_raw(kept)
    return True


# ───────────────────────── Helpers d'exécution ─────────────────────────────

def consolidating_agent_ids() -> set:
    """Ids des agents qui consolident (built-ins + customs) — pour le prédicat
    générique côté app_fastapi."""
    return {s["id"] for s in list_agent_specs() if s.get("consolidates")}


def exclude_tools_for_spec(spec: dict) -> set:
    """Outils JDM à retirer pour cet agent sur mesure : l'écriture si writes
    est faux. (Les FORBIDDEN_TOOLS ne sont pas dans le toolset JDM.)"""
    excl = set()
    if not spec.get("writes"):
        excl.add("write_submission_file")
    return excl


def build_preprompt_for_spec(spec: dict, params: dict) -> str:
    """Assemble le PRÉ-PROMPT (message de tâche) d'un agent sur mesure :
    stratégie du spec + cadrage des params (terme/hasard, cible, itération,
    écriture). Réutilise les helpers canoniques de jarvis.py."""
    p = dict(params or {})
    term = (p.get("term") or "").strip()
    parts: list[str] = [spec.get("system_prompt") or ""]
    # Terme : fourni, ou tirage côté agent (instruction canonique partagée).
    try:
        from jarvis import random_term_instruction, _iteration_block  # lazy (anti-circulaire)
    except Exception:
        random_term_instruction = lambda: ""  # noqa: E731
        _iteration_block = None
    if term:
        parts.append(f"Terme cible : « {term} ».")
    else:
        parts.append(random_term_instruction())
    rels = p.get("relation")
    if rels:
        rel_str = ", ".join(f"`{r}`" for r in (rels if isinstance(rels, list) else [rels]))
        parts.append(f"Relation(s) cible(s) : {rel_str}.")
    tc = p.get("target_count")
    if tc and int(tc) > 0:
        unit = "items consolidés" if spec.get("consolidates") else "items produits"
        parts.append(f"Objectif : produire {int(tc)} {unit}.")
        if _iteration_block is not None:
            try:
                parts.append(_iteration_block(int(tc), str(p.get("budget_label", "illimité"))))
            except Exception:
                pass
    if spec.get("writes"):
        if p.get("upload"):
            parts.append("À la fin, écris le fichier de soumission ET soumets-le "
                         "au LLMDrops (write_submission_file avec upload=True).")
        else:
            parts.append("À la fin, écris le fichier de soumission "
                         "(write_submission_file SANS upload) — l'utilisateur "
                         "décidera de soumettre.")
    else:
        parts.append("N'écris PAS de fichier de soumission ; rends ton résultat "
                     "directement dans ta réponse.")
    return "\n".join([x for x in parts if x])
