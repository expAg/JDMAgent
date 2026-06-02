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
        "consolidates": False, "writes": True, "format": "jdm",
        "output_ext": ".audit", "canonical_mode": "redirect",
        "skeleton": (
            "Tu AUDITES un terme : pour chaque sens (désambiguïsation), vérifie "
            "sens par sens quelles relations sont légitimes / contrastives / à "
            "corriger, et produis des verdicts justifiés."
        ),
    },
    "generation_endogene": {
        "label": "Génération endogène",
        "consolidates": True, "writes": True, "format": "jdm",
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
        "consolidates": True, "writes": True, "format": "jdm",
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
        "consolidates": False, "writes": False, "format": "libre",
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
    # Format de sortie SÉMANTIQUE choisi par l'utilisateur : jdm (pipe
    # A|R|B|annot, soumissible LLMDrops), libre (texte), ou json.
    fmt = (s.get("output_format") or tpl.get("format") or "jdm")
    s["output_format"] = fmt if fmt in ("jdm", "libre", "json") else "jdm"
    # Extension du fichier : LIBRE (l'utilisateur la renseigne), sanitizée à
    # des caractères sûrs ; à défaut, dérivée du format ou du template.
    ext = (s.get("output_ext") or "").strip()
    if not ext:
        ext = {"jdm": tpl["output_ext"], "json": ".json", "libre": ".txt"}.get(
            s["output_format"], tpl["output_ext"])
    ext = "." + str(ext).lstrip(".").lower()
    ext = re.sub(r"[^a-z0-9._-]", "", ext) or ".txt"
    s["output_ext"] = ext
    # canonical_mode : cohérent avec writes/consolidates.
    if not s["writes"]:
        s["canonical_mode"] = None
    else:
        s["canonical_mode"] = "auto_append" if s["consolidates"] else "redirect"
    s["system_prompt"] = (s.get("system_prompt") or tpl["skeleton"]).strip()
    s["defaults"] = s.get("defaults") if isinstance(s.get("defaults"), dict) else {}
    # allowed_tools : sous-ensemble du catalogue que l'agent SAIT FAIRE (choisi
    # par l'orchestrateur / éditable dans la confirmation). Vide = tout le
    # catalogue disponible (sauf *_workflow et écriture si non-écrivant).
    at = s.get("allowed_tools")
    if isinstance(at, list):
        s["allowed_tools"] = [str(x) for x in at if str(x).strip()]
    else:
        s["allowed_tools"] = []
    # instructions : la demande BRUTE de l'utilisateur (ce qu'il a tapé / dit),
    # conservée pour pouvoir RE-générer le workflow plus tard. Le system_prompt,
    # lui, EST le workflow généré par l'orchestrateur à la manière des *_workflow.
    s["instructions"] = (s.get("instructions") or "").strip()
    return s


def split_workflow_and_brief(text: str) -> tuple[str, str]:
    """Sépare un workflow rédigé par l'orchestrateur en (workflow, brief).

    Le workflow se termine par une section `DESCRIPTION:` (3 lignes pour la
    carte). SOURCE UNIQUE utilisée à la fois par l'endpoint UI (/generate) ET
    par l'outil chat `create_specialist_agent` → aucune divergence possible."""
    wf = (text or "").strip()
    brief = ""
    for marker in ("DESCRIPTION:", "DESCRIPTION :"):
        idx = wf.rfind(marker)
        if idx >= 0:
            brief = wf[idx + len(marker):].strip()
            wf = wf[:idx].strip()
            break
    return wf, brief


def build_workflow_generation_prompt(spec: dict) -> str:
    """Méta-prompt DÉTERMINISTE (l'« aide ») demandant à l'orchestrateur LLM de
    CRÉER, à la manière des outils `*_workflow` de JDM (qui renvoient un flux
    canonique : un TITRE, des ÉTAPES numérotées, des RÈGLES), un NOUVEAU workflow
    pour l'agent spécialiste à partir des instructions de l'utilisateur.

    La SORTIE de ce prompt (le workflow rédigé par le LLM) devient le
    `system_prompt` de l'agent — c'est elle qu'on montre à l'assemblage."""
    s = _normalize_spec(spec)
    instructions = (s.get("instructions") or s.get("system_prompt") or "").strip()
    tpl = AGENT_TEMPLATES[s["template"]]
    fmt = s["output_format"]
    fmt_hint = {
        "jdm": "soumission JDM (lignes `terme|relation|cible|annotation`)",
        "json": "JSON structuré",
        "libre": "texte/rapport libre",
    }.get(fmt, fmt)
    tools = s.get("allowed_tools") or []
    tools_line = (", ".join(tools) if tools
                  else "tout le catalogue JDM disponible (sauf les *_workflow)")
    caps = []
    caps.append("CONSOLIDE chaque candidat par inférence" if s["consolidates"]
                else "ne consolide pas")
    caps.append(f"ÉCRIT un fichier {s['output_ext']}" if s["writes"]
                else "n'écrit pas de fichier (résultat en réponse)")
    return (
        "Tu es l'orchestrateur Jarvis. À LA MANIÈRE des outils `*_workflow` de "
        "JDM (enrichment_workflow, audit_workflow… qui renvoient un flux "
        "canonique : un TITRE, des ÉTAPES numérotées, et des RÈGLES), rédige un "
        "NOUVEAU workflow pour un agent spécialiste, à partir de ces instructions :\n\n"
        f"« {instructions} »\n\n"
        "Cadre de l'agent :\n"
        f"- Esprit du template : {tpl['skeleton']}\n"
        f"- Format de sortie : {fmt_hint}\n"
        f"- Capacités : {' ; '.join(caps)}\n"
        f"- Outils que l'agent SAIT utiliser (UNIQUEMENT ceux-ci, JAMAIS de "
        f"*_workflow) : {tools_line}\n\n"
        "Rends le workflow (pas de préambule, pas de ```), au format :\n"
        "TITRE : <titre court>\n"
        "ÉTAPES : 3 à 5 grandes phases SYNTHÉTIQUES (comme les agents natifs : "
        "« Proposition », « Validation », « Consolidation »). UNE ligne par phase, "
        "format `Nom — courte description` où Nom = 1 à 3 mots :\n"
        "1. <Nom> — <description brève (≤ 12 mots)>\n"
        "2. …\n"
        "RÈGLES :\n"
        "- <garde-fou / critère d'arrêt / qualité>\n"
        "\n"
        "Puis, TOUT À LA FIN, une section préfixée exactement `DESCRIPTION:` "
        "donnant en 3 lignes max, pour la carte de l'agent : ce qu'il fait, ses "
        "étapes clés, sa sortie.\n"
    )


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


# Recettes de flux canoniques : RÉSERVÉES aux agents NATIFS. Un agent sur
# mesure suit SA PROPRE stratégie (son system_prompt) — on ne lui donne JAMAIS
# les *_workflow (sinon il rejouerait le flux d'un natif au lieu du sien).
WORKFLOW_TOOLS = frozenset({
    "enrichment_workflow", "audit_workflow", "gap_detection_workflow",
    "error_detection_workflow", "stats_workflow", "annotation_workflow",
})


_ALL_TOOL_NAMES_CACHE: Optional[set] = None


def all_tool_names() -> set:
    """Noms de tous les @tool du catalogue JDM (cache process). Sert à calculer
    l'exclusion quand un agent a une allow-list explicite."""
    global _ALL_TOOL_NAMES_CACHE
    if _ALL_TOOL_NAMES_CACHE is None:
        try:
            from jdm_agent.tools.jdm_tools import build_jdm_tools
            _ALL_TOOL_NAMES_CACHE = {getattr(t, "name", "") for t in build_jdm_tools()} - {""}
        except Exception:
            _ALL_TOOL_NAMES_CACHE = set()
    return set(_ALL_TOOL_NAMES_CACHE)


def selectable_tool_names() -> set:
    """Outils PROPOSABLES à un agent sur mesure = catalogue moins les recettes
    *_workflow (réservées aux natifs)."""
    return all_tool_names() - set(WORKFLOW_TOOLS)


def exclude_tools_for_spec(spec: dict) -> set:
    """Outils JDM à retirer pour cet agent sur mesure :
    - TOUJOURS les recettes *_workflow (réservées aux natifs) ;
    - l'écriture si writes est faux ;
    - tout ce qui n'est PAS dans `allowed_tools` quand cette allow-list est
      renseignée (vide = tout le catalogue disponible).
    (Les FORBIDDEN_TOOLS ne sont pas dans le toolset JDM.)"""
    excl = set(WORKFLOW_TOOLS)
    if not spec.get("writes"):
        excl.add("write_submission_file")
    allowed = spec.get("allowed_tools") or []
    if allowed:
        names = all_tool_names()
        if names:
            excl |= (names - set(allowed))
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
        fmt = spec.get("output_format") or "jdm"
        fmt_hint = {
            "jdm": "Format JDM : lignes `terme|relation|cible|annotation` "
                   "(pipe-separated, soumissibles au LLMDrops).",
            "json": "Format JSON : un tableau JSON valide d'objets.",
            "libre": "Format LIBRE : texte/rapport lisible, structuré.",
        }.get(fmt, "")
        ext = spec.get("output_ext") or ".txt"
        if fmt_hint:
            parts.append(fmt_hint)
        if p.get("upload"):
            parts.append(f"À la fin, écris le fichier de soumission (extension {ext}) "
                         "ET soumets-le au LLMDrops (write_submission_file avec upload=True).")
        else:
            parts.append(f"À la fin, écris le fichier de soumission (extension {ext}) "
                         "(write_submission_file SANS upload) — l'utilisateur décidera de soumettre.")
    else:
        parts.append("N'écris PAS de fichier de soumission ; rends ton résultat "
                     "directement dans ta réponse.")
    return "\n".join([x for x in parts if x])
