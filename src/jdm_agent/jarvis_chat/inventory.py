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
# Chaque natif est un SPEC COMPLET (source de vérité unique) consommé par le
# MÊME pipeline que les sur-mesure. `prompt_builder` = nom de la fonction
# `build_*_prompt` (jarvis.py) qui produit son pré-prompt EXACT (zéro régression :
# on délègue au builder existant au lieu de réécrire la stratégie). `workflow_tool`
# = sa recette canonique (autorisée pour CE natif). `defaults` = params de
# lancement (repris des anciennes branches `_default_agent_params`).
# `display_template` ∈ {consolidant, explorateur} pilote l'affichage.
_BUILTINS: dict[str, dict] = {
    "enrich": {
        "id": "enrich", "title": "Enrichissement", "icon": "🌱",
        "accent": "var(--jdm-magenta)", "kicker": "Agent 1",
        "brief": "Propose et consolide de nouveaux triplets.",
        "consolidates": True, "writes": True,
        "output_ext": ".enrich", "output_format": "jdm", "canonical_mode": "auto_append",
        "prompt_builder": "build_enrich_prompt", "workflow_tool": "enrichment_workflow",
        "display_template": "consolidant", "production_unit": "consolidés",
        "defaults": {"target_count": 3, "vary_relations": True, "iterate": True},
    },
    "audit": {
        "id": "audit", "title": "Audit sémantique", "icon": "🔍",
        "accent": "var(--jdm-cyan)", "kicker": "Agent 2",
        "brief": "Vérifie sens par sens la légitimité des relations.",
        "consolidates": False, "writes": True,
        "output_ext": ".audit", "output_format": "jdm", "canonical_mode": "redirect",
        "prompt_builder": "build_audit_prompt", "workflow_tool": "audit_workflow",
        "display_template": "explorateur", "production_unit": "verdicts",
        "defaults": {},
    },
    "gap": {
        "id": "gap", "title": "Détection de trous", "icon": "🕳️",
        "accent": "var(--jdm-green)", "kicker": "Agent 3",
        "brief": "Repère les trous de couverture d'un terme.",
        "consolidates": False, "writes": False,
        "output_ext": ".gap", "output_format": "json", "canonical_mode": None,
        "prompt_builder": "build_gap_prompt", "workflow_tool": "gap_detection_workflow",
        "display_template": "explorateur", "production_unit": "trous",
        "defaults": {},
    },
    "signalement": {
        "id": "signalement", "title": "Signalement", "icon": "⚠️",
        "accent": "var(--jdm-orange)", "kicker": "Agent 4",
        "brief": "Flag les triplets suspects pour un mainteneur.",
        "consolidates": False, "writes": True,
        "output_ext": ".err", "output_format": "jdm", "canonical_mode": "redirect",
        "prompt_builder": "build_signalement_prompt", "workflow_tool": "error_detection_workflow",
        "display_template": "explorateur", "production_unit": "suspects",
        "defaults": {},
    },
    "stats": {
        "id": "stats", "title": "Stats", "icon": "📊",
        "accent": "var(--jdm-violet)", "kicker": "Agent 5",
        "brief": "Mesure la couverture par terme et par relation.",
        "consolidates": False, "writes": True,
        "output_ext": ".stat", "output_format": "jdm", "canonical_mode": "redirect",
        "prompt_builder": "build_stats_prompt", "workflow_tool": "stats_workflow",
        "display_template": "explorateur", "production_unit": "lignes",
        "defaults": {},
    },
    "annotation": {
        "id": "annotation", "title": "Annotation sémantique", "icon": "🏷️",
        "accent": "var(--jdm-yellow)", "kicker": "Agent 6",
        "brief": "Annote les triplets (constitutif / contrastif…).",
        "consolidates": False, "writes": True,
        "output_ext": ".annot", "output_format": "jdm", "canonical_mode": "redirect",
        "prompt_builder": "build_annotation_prompt", "workflow_tool": "annotation_workflow",
        "display_template": "explorateur", "production_unit": "annotations",
        "defaults": {"top_k": 8, "target_count": 10},
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
    # `ligne` = une entrée par ligne, AU FORMAT LIBRE (pas de gabarit imposé) :
    # parsée comme les lignes JDM pour l'affichage en liste, mais sans contrainte
    # de structure (le format réel est demandé dans les instructions / le prompt).
    s["output_format"] = fmt if fmt in ("jdm", "libre", "json", "ligne") else "jdm"
    # Extension du fichier : LIBRE (l'utilisateur la renseigne), sanitizée à
    # des caractères sûrs ; à défaut, dérivée du format ou du template.
    ext = (s.get("output_ext") or "").strip()
    if not ext:
        ext = {"jdm": tpl["output_ext"], "json": ".json", "libre": ".txt",
               "ligne": ".txt"}.get(s["output_format"], tpl["output_ext"])
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
    # steps : RÉSUMÉ d'étapes pour l'AFFICHAGE de la carte/fiche (liste {n,d}).
    # Purement cosmétique — n'affecte pas l'exécution (qui lit system_prompt).
    st = s.get("steps")
    if isinstance(st, list):
        s["steps"] = [{"n": str(x.get("n", "")).strip(), "d": str(x.get("d", "")).strip()}
                      for x in st if isinstance(x, dict) and str(x.get("n", "")).strip()]
    else:
        s["steps"] = []
    # tool_steps : mapping {outil: indice d'étape} pour animer l'étape courante
    # (équivalent custom d'AGENT_TOOL_STEPS). AFFECTÉ par le LLM au SITE UNIQUE
    # `save_agent_spec` (à l'enregistrement, seulement si workflow/étapes/outils
    # ont changé). Ici on ne fait que valider/borner le dict existant ; jamais
    # de parsing de texte. `tool_steps_sig` = empreinte de l'état ayant servi.
    s["tool_steps"] = _clamp_tool_steps(s.get("tool_steps"), len(s["steps"]))
    s["tool_steps_sig"] = str(s.get("tool_steps_sig") or "")
    # display_template : pilote l'affichage carte/log/ItemCard. Décidé à la
    # création selon `consolidates` (consolidant = tentatives+retenus comme
    # enrich ; explorateur = log d'exploration + items produits). Surchargeable.
    dt = s.get("display_template")
    if dt not in ("consolidant", "explorateur"):
        dt = "consolidant" if s["consolidates"] else "explorateur"
    s["display_template"] = dt
    # production_unit : libellé des items pour les compteurs (affichage).
    s["production_unit"] = (s.get("production_unit")
                            or ("consolidés" if s["consolidates"] else "items"))
    return s


def _parse_step_lines(block: str) -> list:
    """Parse un bloc de lignes « Nom — desc » en [{n, d}] (affichage carte)."""
    out = []
    for line in (block or "").splitlines():
        line = re.sub(r"^\s*(\d+[.)]|[-*•])\s*", "", line).strip()
        if not line:
            continue
        parts = re.split(r"\s+[—–-]\s+|\s*:\s+", line, maxsplit=1)
        n = parts[0].strip().strip("`")[:40]
        d = parts[1].strip() if len(parts) > 1 else ""
        if n:
            out.append({"n": n, "d": d})
        if len(out) >= 6:
            break
    return out


def parse_generation_output(text: str) -> tuple[str, str, list, list, str]:
    """Découpe la sortie de génération en (workflow, brief, outils, étapes_carte, icône).

    Le WORKFLOW (TITRE/ÉTAPES/RÈGLES) est le CŒUR FONCTIONNEL — il n'est ni
    allégé ni reformaté. Les sections suivantes sont AJOUTÉES, uniquement pour
    l'affichage / la config, et ne remplacent PAS le workflow :
        OUTILS: a, b, c          (outils choisis par le LLM)
        RÉSUMÉ: Nom — desc …     (3-5 phases synthétiques pour la carte)
        DESCRIPTION: …           (3 lignes courtes pour la carte)

    SOURCE UNIQUE : endpoint UI (/generate) ET outil chat create_specialist_agent."""
    t = (text or "").strip()
    brief, tools, steps, icon = "", [], [], ""
    # ICÔNE en DERNIER dans la sortie attendue → on l'extrait EN PREMIER (c'est
    # la queue du texte) pour ne pas la laisser dans la DESCRIPTION.
    for marker in ("ICÔNE:", "ICONE:", "ICÔNE :", "ICONE :", "EMOJI:", "EMOJI :"):
        idx = t.rfind(marker)
        if idx >= 0:
            raw = t[idx + len(marker):].strip()
            raw = raw.splitlines()[0] if raw else ""
            t = t[:idx].strip()
            icon = _first_glyph(raw)
            break
    for marker in ("DESCRIPTION:", "DESCRIPTION :"):
        idx = t.rfind(marker)
        if idx >= 0:
            brief = t[idx + len(marker):].strip()
            t = t[:idx].strip()
            break
    for marker in ("RÉSUMÉ:", "RESUME:", "RÉSUMÉ :", "RESUME :", "RÉSUMÉ_ÉTAPES:", "APERÇU:"):
        idx = t.rfind(marker)
        if idx >= 0:
            steps = _parse_step_lines(t[idx + len(marker):])
            t = t[:idx].strip()
            break
    for marker in ("OUTILS:", "OUTILS :", "TOOLS:"):
        idx = t.rfind(marker)
        if idx >= 0:
            raw = t[idx + len(marker):].strip().splitlines()[0] if t[idx + len(marker):].strip() else ""
            t = t[:idx].strip()
            tools = [x.strip().strip("`") for x in re.split(r"[,\n;]+", raw) if x.strip()]
            break
    return t, brief, tools, steps, icon


def _first_glyph(raw: str) -> str:
    """Extrait UN emoji/glyphe d'une chaîne libre rendue par le LLM.
    Retire backticks/guillemets/espaces et garde le premier token, borné
    (un emoji peut faire plusieurs codepoints : variation selectors, ZWJ,
    tons de peau). Renvoie "" si rien d'exploitable."""
    s = (raw or "").strip().strip("`\"'  ").strip()
    if not s:
        return ""
    tok = s.split()[0] if s.split() else s
    # Borne de sécurité : un emoji composé reste court ; on évite qu'une
    # phrase entière ne devienne l'« icône ».
    return tok[:8]


def split_workflow_and_brief(text: str) -> tuple[str, str]:
    """Compat : (workflow, brief). Délègue à parse_generation_output."""
    wf, brief, _, _, _ = parse_generation_output(text)
    return wf, brief


def extract_tool_steps(text: str) -> dict:
    """Extrait le mapping {outil: indice_étape} de la section `TOOL_STEPS:` —
    un OBJET JSON affecté PAR LE LLM (pas de parsing de texte libre). On lit le
    premier objet `{…}` équilibré après le marqueur et on le passe à json.loads.
    Renvoie {} si absent/illisible (animation simplement désactivée)."""
    t = text or ""
    # Accepte soit une section « TOOL_STEPS: {…} », soit un objet JSON NU (la
    # réponse de l'invocateur dédié) → on lit le 1er objet {…} équilibré.
    m = re.search(r"TOOL_STEPS\s*:\s*", t, re.IGNORECASE)
    rest = t[m.end():] if m else t
    start = rest.find("{")
    if start < 0:
        return {}
    depth = 0
    for i in range(start, len(rest)):
        c = rest[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(rest[start:i + 1])
                except Exception:
                    return {}
                return obj if isinstance(obj, dict) else {}
    return {}


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
        "ligne": "une entrée par ligne, format LIBRE (défini par les instructions ; aucun gabarit imposé)",
    }.get(fmt, fmt)
    # Catalogue PROPOSABLE (sans *_workflow) : on le donne au LLM pour qu'il
    # CHOISISSE les outils nécessaires (section OUTILS), au lieu de tout prendre.
    try:
        catalog = sorted(selectable_tool_names())
    except Exception:
        catalog = []
    catalog_line = ", ".join(catalog) if catalog else "(catalogue JDM standard)"
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
        f"- Catalogue d'outils disponibles (CHOISIS uniquement ceux dont l'agent "
        f"a besoin, JAMAIS de *_workflow) : {catalog_line}\n\n"
        "Rends le WORKFLOW FONCTIONNEL — le cerveau de l'agent, AUSSI DÉTAILLÉ "
        "que la tâche l'exige — et RIEN D'AUTRE (pas de préambule, pas de "
        "confirmation, pas de ```). Décide selon le besoin décrit par les "
        "instructions utilisateur ; décide du point d'entrée — s'il doit être un "
        "TERME ou une RELATION — pour conditionner l'outil utilisé. Ce travail est "
        "réalisé sur JDM, donc toi, orchestrateur, dois être extrêmement au fait du "
        "fonctionnement et de la sémantique des types de relations de JDM. "
        "Format :\n"
        "TITRE : <titre court>\n"
        "ÉTAPES :\n"
        "1. <action concrète mobilisant les outils ci-dessus>\n"
        "2. … (autant d'étapes, et aussi détaillées, que nécessaire)\n"
        "RÈGLES :\n"
        "- <garde-fou / qualité>\n"
        "OUTILS: <liste, séparée par des virgules, des SEULS outils du catalogue "
        "ci-dessus dont l'agent a besoin (3 à 8 ; PAS de *_workflow)>\n"
    )


def build_card_meta_prompt(spec: dict, workflow: str, used_icons=()) -> str:
    """Méta-prompt SÉPARÉ (2ᵉ appel) pour produire UNIQUEMENT les éléments
    d'AFFICHAGE de la carte (résumé d'étapes + description courte + ICÔNE) à
    partir du workflow déjà rédigé. Séparé de la génération du workflow pour
    éviter toute pollution par du texte conversationnel.

    `used_icons` : emojis déjà utilisés (natifs + sur mesure) à NE PAS reprendre
    — pour que chaque agent ait un glyphe distinct."""
    excl = " ".join(x for x in (used_icons or []) if x)
    excl_line = (
        f"   N'utilise AUCUN de ces emojis déjà pris (choisis-en un DIFFÉRENT) : {excl}\n"
        if excl else ""
    )
    return (
        "Voici le workflow d'un agent JDM :\n\n" + (workflow or "").strip() + "\n\n"
        "Produis UNIQUEMENT, sans préambule ni phrase de conclusion, ces trois "
        "sections (rien d'autre), DANS CET ORDRE :\n"
        "RÉSUMÉ:\n"
        "1. <Nom (1-3 mots)> — <courte description>\n"
        "2. … (3 à 5 phases synthétiques, façon Proposition/Validation/…)\n"
        "DESCRIPTION: <description factuelle COURTE, 3 lignes max, pour la carte : "
        "ce que fait l'agent, ses étapes clés, sa sortie. PAS de question, PAS de "
        "demande de confirmation, PAS de « je ».>\n"
        "ICÔNE: <UN SEUL emoji, le plus représentatif de la mission de cet agent>\n"
        + excl_line
    )


# Hook d'affectation outil→étape — INJECTÉ par la couche serveur (app_fastapi)
# au démarrage. inventory reste sans dépendance LLM ; save_agent_spec l'appelle
# (SITE UNIQUE) si le workflow/les étapes/les outils ont changé.
_TOOL_STEPS_INVOKER = None


def set_tool_steps_invoker(fn) -> None:
    """Enregistre l'invocateur LLM (prompt:str -> texte) utilisé à
    l'enregistrement pour affecter les outils aux étapes. None = pas d'appel."""
    global _TOOL_STEPS_INVOKER
    _TOOL_STEPS_INVOKER = fn


def _clamp_tool_steps(raw, nsteps: int) -> dict:
    """Valide un mapping {outil: indice} : clés str non vides, valeurs int
    bornées à [0, nsteps) (ou tout entier >=0 si nsteps==0). Aucun parsing de
    texte : on attend déjà un dict."""
    out = {}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        try:
            i = int(v)
        except (TypeError, ValueError):
            continue
        name = str(k).strip()
        if name and i >= 0 and (nsteps == 0 or i < nsteps):
            out[name] = i
    return out


def _tool_steps_signature(spec: dict) -> str:
    """Empreinte des SEULS éléments dont dépend l'affectation : workflow
    (system_prompt), étapes (n+d), outils autorisés. Si elle est inchangée, on
    réutilise le mapping existant — aucun appel LLM."""
    import hashlib
    payload = json.dumps({
        "wf": (spec.get("system_prompt") or "").strip(),
        "steps": [(st.get("n", ""), st.get("d", "")) for st in (spec.get("steps") or [])],
        "tools": sorted(spec.get("allowed_tools") or []),
    }, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def build_tool_steps_prompt(spec: dict) -> str:
    """Méta-prompt DÉDIÉ à l'affectation outil→étape. Le workflow est une
    DONNÉE D'ENTRÉE (jamais régénéré). Sortie attendue : objet JSON
    {outil: indice_étape}."""
    wf = (spec.get("system_prompt") or "").strip()
    steps = spec.get("steps") or []
    tools = spec.get("allowed_tools") or []
    steps_lines = "\n".join(
        f"{i}. {st.get('n', '')} — {st.get('d', '')}" for i, st in enumerate(steps)
    ) or "(aucune étape)"
    tools_line = ", ".join(tools) if tools else "(les outils cités dans le workflow)"
    hi = max(0, len(steps) - 1)
    return (
        "Voici le WORKFLOW d'un agent JDM. C'est une DONNÉE — ne le réécris pas, "
        "ne le régénère pas :\n\n" + wf + "\n\n"
        "Ses ÉTAPES d'affichage (indices 0-based) :\n" + steps_lines + "\n\n"
        "Ses OUTILS : " + tools_line + "\n\n"
        "Affecte CHAQUE outil à l'indice de l'étape où il intervient principalement. "
        "Réponds UNIQUEMENT par un objet JSON sur une seule ligne au format "
        "{\"nom_outil\": indice, …} — clés = noms EXACTS des outils ci-dessus, "
        f"valeurs = entier entre 0 et {hi}. Rien d'autre (pas de phrase, pas de ```)."
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
    un natif. Renvoie le spec normalisé persisté.

    SITE UNIQUE (UI ET outil chat passent par ici — pas de drift) pour DEUX
    affectations :
      - icône DISTINCTE par agent (garde celle proposée si libre, sinon pioche) ;
      - mapping outil→étape (`tool_steps`) : affecté par un appel LLM DÉDIÉ
        (jamais de régénération du workflow), et SEULEMENT si le workflow / les
        étapes / les outils ont changé depuis le dernier enregistrement
        (comparaison de signature). Sinon on réutilise le mapping existant."""
    norm = _normalize_spec(spec)
    if norm["id"] in _BUILTINS:
        norm["id"] = norm["id"] + "_custom"
    with _LOCK:
        raw = _load_custom_raw()
        # Spec existante (même id) : pour réutiliser tool_steps si rien de
        # pertinent n'a changé.
        existing = next((r for r in raw
                         if slugify_agent_id(r.get("id") or r.get("title") or "") == norm["id"]),
                        None)
        raw = [r for r in raw if slugify_agent_id(r.get("id") or r.get("title") or "") != norm["id"]]
        # Icônes déjà prises (natifs + autres sur mesure, l'agent courant exclu).
        used = {v.get("icon") for v in _BUILTINS.values() if v.get("icon")}
        for r in raw:
            try:
                used.add(_normalize_spec(r).get("icon"))
            except Exception:
                pass
        norm["icon"] = _distinct_icon(norm.get("icon"), used)
        # tool_steps : réutiliser si signature inchangée, sinon (ré)affecter via
        # l'invocateur LLM dédié — uniquement si workflow/étapes/outils ont bougé.
        sig = _tool_steps_signature(norm)
        ex_ts = (existing or {}).get("tool_steps") if isinstance(existing, dict) else None
        ex_sig = (existing or {}).get("tool_steps_sig") if isinstance(existing, dict) else None
        # Signature inchangée (même workflow/étapes/outils) → on RÉUTILISE, même
        # si le mapping est vide : l'affectation a déjà été tentée pour cet état,
        # on ne rappelle pas le LLM.
        if ex_sig and ex_sig == sig:
            norm["tool_steps"] = _clamp_tool_steps(ex_ts, len(norm["steps"]))
        elif _TOOL_STEPS_INVOKER is not None:
            try:
                out = _TOOL_STEPS_INVOKER(build_tool_steps_prompt(norm))
                norm["tool_steps"] = _clamp_tool_steps(extract_tool_steps(out or ""), len(norm["steps"]))
            except Exception:
                norm["tool_steps"] = _clamp_tool_steps(ex_ts, len(norm["steps"]))
        else:
            # pas d'invocateur (tests/offline) : on garde l'existant s'il y en a.
            norm["tool_steps"] = _clamp_tool_steps(ex_ts, len(norm["steps"]))
        norm["tool_steps_sig"] = sig
        raw.append(norm)
        _write_custom_raw(raw)
    return norm


# Réserve d'emojis variés pour l'attribution automatique quand le LLM n'en a pas
# proposé (ou un déjà pris). Tirés de registres lexico-sémantiques / d'outils.
_ICON_POOL = [
    "🧩", "🔮", "🧠", "📚", "🗂️", "🔗", "🧪", "🛰️", "🧭", "📐",
    "🔧", "⚙️", "🪛", "📎", "🧱", "🪐", "🌿", "🦉", "🐝", "🦊",
    "📡", "🔦", "🧮", "✒️", "🗺️", "🎯", "🧰", "🔬", "📊", "🧷",
]


def _distinct_icon(preferred, used) -> str:
    """Renvoie un emoji distinct : garde `preferred` s'il est exploitable, non
    générique (≠ 🤖) et libre ; sinon pioche le 1er emoji libre de la réserve ;
    en dernier recours, garde `preferred` ou 🤖."""
    used = set(used or [])
    p = (preferred or "").strip()
    if p and p != "🤖" and p not in used:
        return p
    for cand in _ICON_POOL:
        if cand not in used:
            return cand
    return p or "🤖"


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
    """Outils JDM à retirer pour CE spec (natif OU sur mesure) :
    - NATIF (`builtin`) : aucune exclusion — il a le catalogue complet, y
      compris SA recette `*_workflow` (comportement historique inchangé).
    - SUR MESURE :
    - TOUJOURS les recettes *_workflow (réservées aux natifs) ;
    - l'écriture si writes est faux ;
    - tout ce qui n'est PAS dans `allowed_tools` (l'allow-list générée par
      l'orchestrateur — section OUTILS — qui est la SOURCE DE VÉRITÉ). On ne
      parse PAS le system_prompt : on fait confiance à cette liste.
    Vide = tout le catalogue disponible (agent sans restriction d'outils).
    (Les FORBIDDEN_TOOLS ne sont pas dans le toolset JDM.)"""
    if spec.get("builtin"):
        return set()  # natif : catalogue complet (incl. son *_workflow)
    excl = set(WORKFLOW_TOOLS)
    if not spec.get("writes"):
        excl.add("write_submission_file")
    allowed = spec.get("allowed_tools") or []
    if allowed:
        names = all_tool_names()
        if names:
            keep = set(allowed)
            if spec.get("writes"):
                keep.add("write_submission_file")  # l'écriture reste implicite
            excl |= (names - keep)
    return excl


def build_preprompt_for_spec(spec: dict, params: dict) -> str:
    """CONSTRUCTEUR DE PRÉ-PROMPT UNIQUE pour TOUS les agents (natifs + sur mesure).

    - Natif : le spec porte `prompt_builder` = nom d'une fonction `build_*_prompt`
      de jarvis.py → on la délègue avec les params filtrés à sa signature (prompt
      EXACT, zéro régression).
    - Sur mesure : assemblage générique (system_prompt + cadrage portée/cible/
      itération/format/upload).
    """
    p = dict(params or {})
    # ── Chemin NATIF : délégation au builder canonique (même params filtrés que
    #    l'ancien _jarvis_dispatch). ─────────────────────────────────────────
    builder_name = spec.get("prompt_builder")
    if builder_name:
        try:
            import inspect
            import jarvis as _j
            fn = getattr(_j, builder_name, None)
            if fn is not None:
                sig = inspect.signature(fn)
                accepted = {k: v for k, v in p.items() if k in sig.parameters}
                return fn(**accepted)
        except Exception:
            pass  # fallback assemblage générique ci-dessous
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
        # Pas de terme imposé → instruction de point de départ. ⚠️ Cette
        # instruction DOIT rester accordée à l'outillage RÉEL de l'agent :
        # un natif a `pick_random_term` ; un agent SUR MESURE ne l'a que si
        # son `allowed_tools` le contient (sinon le binding refuse l'appel
        # — incohérence prompt↔outils observée). Cascade déterministe :
        #   1. pick_random_term dispo → instruction canonique d'origine.
        #   2. sinon pick_random_relation dispo → tirage par relation.
        #   3. sinon → consigne neutre, sans nommer d'outil absent.
        # MIROIR de exclude_tools_for_spec : `allowed_tools` VIDE = catalogue
        # complet (agent non restreint) → il a donc TOUS les outils.
        _allowed = set(spec.get("allowed_tools") or [])
        _unrestricted = (not _allowed)
        def _has(name: str) -> bool:
            return bool(spec.get("builtin")) or _unrestricted or (name in _allowed)
        if _has("pick_random_term"):
            parts.append(random_term_instruction())
        elif _has("pick_random_relation"):
            parts.append(
                "Je n'ai pas précisé de terme : pars d'une relation tirée au "
                "hasard via `pick_random_relation()` (puis travaille sur ses "
                "termes)."
            )
        else:
            parts.append(
                "Je n'ai pas précisé de terme : choisis un point de départ "
                "UNIQUEMENT avec les outils dont tu disposes. N'appelle aucun "
                "outil hors de ta liste (notamment PAS `pick_random_term`)."
            )
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
            "ligne": "Format LIGNES LIBRES : une entrée par ligne (une ligne = un "
                     "résultat affiché). Le format de chaque ligne est LIBRE — "
                     "suis celui demandé dans tes instructions ; aucun gabarit imposé.",
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
