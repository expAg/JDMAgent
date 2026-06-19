"""FastAPI replacement for app.py (Gradio).

Ce fichier est un SQUELETTE pour démarrer la migration. Il :
- Importe la logique métier existante depuis src/jdm_agent/
- Reprend les blocs de setup env de app.py (cache, dotenv, pool Gemini)
- Définit les routes API (/api/*)
- Sert le frontend statique sous /

⚠️ Lis `README.md` (à côté de ce fichier) AVANT de commencer.

Démarrer en local :
    uvicorn app_fastapi:app --reload --port 7860

Sur HF Spaces : géré par le Dockerfile + sdk: docker dans le README frontmatter.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

# ────────────────────────────────────────────────────────────────────
# Setup env — repris de app.py
# ────────────────────────────────────────────────────────────────────
_root = Path(__file__).parent
sys.path.insert(0, str(_root / "src"))

try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(override=False)
except ImportError:
    pass

os.environ.setdefault("JDM_CACHE_DIR", "/tmp/jdm_cache")

# Reverse-proxy : si on est servi sous /Jarvis/ (Apache LIRMM, etc.),
# l'env var APP_SUBPATH = "/Jarvis" injecte un <base href> dans index.html
# pour que toutes les URLs relatives (fetch + assets) se résolvent
# correctement côté navigateur. Vide ou "/" = mode racine (HF Spaces, local).
_RAW_SUBPATH = os.environ.get("APP_SUBPATH", "").strip()
# Normalise : "" / "/" → "" ; "Jarvis" → "/Jarvis" ; "/Jarvis/" → "/Jarvis"
if _RAW_SUBPATH and _RAW_SUBPATH != "/":
    APP_SUBPATH = "/" + _RAW_SUBPATH.strip("/")
else:
    APP_SUBPATH = ""

# ────────────────────────────────────────────────────────────────────
# FastAPI
# ────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

# ────────────────────────────────────────────────────────────────────
# Logique métier — INCHANGÉE par rapport à app.py
# ────────────────────────────────────────────────────────────────────
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

# ⚠️ ARCHITECTURE — pourquoi on importe `app` (le module Gradio) ici
# ─────────────────────────────────────────────────────────────────────
# app.py contient des helpers BATTLE-TESTED qu'on NE veut PAS dupliquer :
#   - _build_llm : routing natif vs OpenAI-compat, override pool, thinking
#   - chat_with_agent : retry PerMinute illimité, retry PerDay avec
#     rotation, INVALID_KEY → mark + switch, accumulation messages
#     pour reprise, exclusion_context
#   - pool state : _BLOWN_TODAY (par key+model+jour), _INVALID_KEYS,
#     _CURRENT_GEMINI_KEY persisté dans pool_state.json,
#     pick_unblown_gemini_key, mark_gemini_key_invalid,
#     mark_gemini_key_blown, set_current_gemini_key
# jarvis.py contient `run_jarvis_agent` avec budget tool, append cumulatif
# vers `canonical_path`, retry rate-limit, retry-à-la-fin (truncate
# history + liste des interdits), auto-bascule sur 3.1, etc.
#
# Coût de l'import : ~7s au boot (app.py construit ses Gradio Blocks au
# module load, mais ne lance rien). Acceptable pour récupérer toute
# cette mécanique. Une phase future extraira ces helpers dans
# src/jdm_agent/llm_pool.py pour supprimer cette dépendance.
import app as _app
import jarvis as _jarvis

# Chat de supervision Jarvis (la mascotte) : persistance des runs +
# overlay d'env + provider injecté pour que ses outils voient bg_runs.
from jdm_agent.jarvis_chat import persistence as _jchat_persist
from jdm_agent.jarvis_chat import runtime as _jchat_rt

# ────────────────────────────────────────────────────────────────────
# Shared client (lazy, cached)
# ────────────────────────────────────────────────────────────────────
_client: Optional[JDMClient] = None


def get_client() -> JDMClient:
    global _client
    if _client is None:
        _client = JDMClient()
    return _client


# ────────────────────────────────────────────────────────────────────
# Constants from app.py (copy ce qu'il te faut)
# ────────────────────────────────────────────────────────────────────
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

EFFORT_CHOICES = {0, 1, 2}

# Liste des relations principales exposées aux formulaires Jarvis.
# (DEFAULT_RELATIONS + quelques relations utiles supplémentaires.)
JARVIS_RELATIONS: list[str] = list(DEFAULT_RELATIONS) + [
    r for r in (
        "r_syn", "r_anto", "r_agent-1", "r_patient-1", "r_instr-1",
        "r_telic_role", "r_lieu", "r_has_color", "r_has_part",
        "r_make", "r_processus>agent", "r_processus>patient",
        "r_has_conseq", "r_has_causatif", "r_domain", "r_associated",
    )
    if r not in DEFAULT_RELATIONS
]


# ────────────────────────────────────────────────────────────────────
# Helpers — copie depuis app.py si tu en as besoin
# ────────────────────────────────────────────────────────────────────
def _resolve_and_check(client, term: str) -> tuple[str, str]:
    raw = (term or "").strip()
    if not raw:
        return raw, "Renseigne un terme."
    resolved = client.resolve_term(raw)
    if not client.term_exists(resolved):
        return resolved, f"« {raw} » n'est pas connu de JeuxDeMots."
    return resolved, ""


# ────────────────────────────────────────────────────────────────────
# Pydantic models
# ────────────────────────────────────────────────────────────────────
class ExploreRequest(BaseModel):
    term: str
    relation: str = Field(..., description="r_syn, r_isa, etc.")
    min_weight: float = 25
    limit: Optional[int] = 50          # None = illimité (jauge au max)
    with_annotations: bool = False
    include_negatives: bool = True     # inclure les triplets de poids négatif


class ClaimRequest(BaseModel):
    subject: str
    relation: str
    object: str
    effort: int = 1
    bypass: bool = False


class TermRequest(BaseModel):
    term: str


def _inject_iframe_css(html: str) -> str:
    """Injecte le CSS d'override pour afficher un sous-graphe HTML dans une
    iframe : fond transparent (hérite du thème parent), layout flex pour que
    #net prenne l'espace restant, header/legend adoucis. Idempotent-ish."""
    transparent_css = (
        "<style id='__jdm-skin-override'>"
        "html,body{background:transparent!important;color:inherit!important;"
        "height:100%!important;overflow:hidden!important}"
        "body{display:flex!important;flex-direction:column!important}"
        "header{background:rgba(128,128,128,0.08)!important;"
        "border-bottom-color:rgba(128,128,128,0.25)!important;"
        "color:inherit!important;flex:0 0 auto!important}"
        "#net{background:transparent!important;"
        "flex:1 1 auto!important;height:auto!important;min-height:0!important}"
        ".legend{background:rgba(128,128,128,0.08)!important;"
        "border-top-color:rgba(128,128,128,0.25)!important;"
        "color:inherit!important;flex:0 0 auto!important}"
        "</style>"
    )
    if html and "__jdm-skin-override" not in html and "</head>" in html:
        return html.replace("</head>", transparent_css + "</head>", 1)
    return html


def _read_produced_viz_html(tool_output_content: str) -> Optional[str]:
    """Récupère le HTML que l'outil build_subgraph_visualization a DÉJÀ
    écrit (html_path dans sa sortie), le lit et lui injecte le CSS iframe.
    None si pas de html_path exploitable / fichier introuvable.
    Évite de reconstruire le graphe : on affiche exactement ce que l'agent
    a produit."""
    if not tool_output_content:
        return None
    path = None
    try:
        d = json.loads(tool_output_content)
        if isinstance(d, dict):
            path = d.get("html_path")
    except Exception:
        m = _re.search(r"['\"]html_path['\"]\s*:\s*['\"]([^'\"]+)['\"]",
                       tool_output_content)
        if m:
            path = m.group(1)
    if not path:
        return None
    try:
        html = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    return _inject_iframe_css(html)


def _flatten_subgraph_live(raw_nodes: list, raw_edges: list) -> dict:
    """Aplatit les nodes/edges bruts (vis-network) de build_subgraph(json)
    vers la forme légère attendue par le rendu LIVE côté client
    (LiveAnimWrapper) : nodes {id,label,kind,depth}, edges
    {from,to,relation,weight,negative,depth,highlight}. Même mapping que
    l'endpoint /api/subgraph/live (factorisé)."""
    nodes = [
        {"id": n["id"], "label": n.get("label", n["id"]),
         "kind": n.get("_kind", "assoc"), "depth": n.get("_depth", 0)}
        for n in (raw_nodes or [])
    ]
    edges = [
        {"from": e["from"], "to": e["to"], "relation": e.get("_relation", ""),
         "weight": e.get("_weight", 0), "negative": bool(e.get("_negative", False)),
         "depth": e.get("_depth", 1), "highlight": e.get("_depth", 1) == 1}
        for e in (raw_edges or [])
    ]
    return {"nodes": nodes, "edges": edges}


def _viz_event_from_tool_output(content: str) -> Optional[dict]:
    """Construit le payload de l'event `viz` à partir de la SORTIE de
    build_subgraph_visualization (ce que l'agent a produit, pas un rebuild) :
      - mode live/json (nodes/edges) → {format:"live", nodes, edges}
      - mode html (html_path)        → {format:"html", html}
    None si rien d'exploitable."""
    if not content:
        return None
    d = None
    try:
        d = json.loads(content)
    except Exception:
        d = None
    if isinstance(d, dict) and isinstance(d.get("nodes"), list):
        flat = _flatten_subgraph_live(d.get("nodes"), d.get("edges") or [])
        return {"format": "live", **flat}
    # mode html : on lit le fichier produit et on injecte le CSS iframe
    html = _read_produced_viz_html(content)
    if html:
        return {"format": "html", "html": html}
    return None


def _viz_payload_from_tool_input(args: dict) -> Optional[dict]:
    """Mappe les arguments de l'outil build_subgraph_visualization vers le
    payload attendu par /api/subgraph (rendu inline iframe). None si pas
    de terme exploitable."""
    if not isinstance(args, dict):
        return None
    term = (args.get("term") or "").strip()
    if not term:
        return None
    def _lst(v):
        return list(v) if isinstance(v, list) else []
    return {
        "term": term,
        "depth": int(args.get("depth") or 1),
        "top_k": int(args.get("top_k_per_relation") or 3),
        "top_k_d2": int(args.get("top_k_depth2") or 3),
        "top_k_d3": int(args.get("top_k_depth3") or 3),
        "top_k_d4": int(args.get("top_k_depth4") or 3),
        "relations": _lst(args.get("relations")),
        "relations_d2": _lst(args.get("depth2_relations")),
        "relations_d3": _lst(args.get("depth3_relations")),
        "relations_d4": _lst(args.get("depth4_relations")),
        "min_weight": float(args.get("min_weight") or 0),
        "format": "html",
    }


class SubgraphRequest(BaseModel):
    term: str
    depth: int = 1
    # Top-K et relations par profondeur (défauts JDM). Les listes vides
    # font tomber sur les défauts côté build_subgraph (DEFAULT_RELATIONS,
    # DEFAULT_DEPTH2_RELATIONS, ...).
    top_k: int = 3
    top_k_d2: int = 3
    top_k_d3: int = 3
    top_k_d4: int = 3
    relations: list[str] = []
    relations_d2: list[str] = []
    relations_d3: list[str] = []
    relations_d4: list[str] = []
    min_weight: float = 0
    max_nodes: int = 40
    # "html" = HTML interactif vis-network (rendu en iframe côté front)
    # "json" = nodes/edges JSON pour rendu SVG natif
    format: str = "html"


class AgentRequest(BaseModel):
    message: str
    history: list[dict] = []
    api_key: str = ""
    model: str = "gemini-3.1-flash-lite"
    use_thinking: bool = True


class JarvisRequest(BaseModel):
    agent_id: str
    params: dict = {}


class JarvisChatRequest(BaseModel):
    """Requête du chat de la mascotte Jarvis (supervision)."""
    message: str
    history: list[dict] = []
    # Config Jarvis courante (localStorage côté front) — transmise pour que
    # le tool get_config la lise. set_config renvoie des patches via SSE.
    config: dict = {}
    # Modèle imposé : la mascotte tourne sur le pool gratuit par défaut.
    model: str = "gemini-3.1-flash-lite"
    api_key: str = ""


# ────────────────────────────────────────────────────────────────────
# App
# ────────────────────────────────────────────────────────────────────
app = FastAPI(title="JDMAgent API", version="1.0.0", root_path=APP_SUBPATH)

# CORS — utile en dev (front sur un autre port). Retire en prod si même origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Disable buffering for SSE on HF Spaces (Nginx-style header)
@app.middleware("http")
async def strip_subpath(request: Request, call_next):
    """Strippe APP_SUBPATH (ex. /jdm-agent) du path entrant pour que le
    routing FastAPI matche les routes déclarées sans préfixe. Permet à
    une config Apache symétrique (`/jdm-agent → /jdm-agent$1`) de marcher
    sans toucher la déclaration des routes (/api/explore, etc.).

    No-op si APP_SUBPATH vide (mode racine : HF Spaces, dev local)."""
    if APP_SUBPATH:
        path = request.scope.get("path", "")
        if path.startswith(APP_SUBPATH):
            request.scope["path"] = path[len(APP_SUBPATH):] or "/"
            # raw_path est utilisé par certains middlewares + log access
            raw = request.scope.get("raw_path") or b""
            prefix_b = APP_SUBPATH.encode("utf-8")
            if raw.startswith(prefix_b):
                request.scope["raw_path"] = raw[len(prefix_b):] or b"/"
    return await call_next(request)


@app.middleware("http")
async def disable_buffering(request: Request, call_next):
    response = await call_next(request)
    if "/stream" in request.url.path:
        response.headers["X-Accel-Buffering"] = "no"
        response.headers["Cache-Control"] = "no-cache"
    return response


# ────────────────────────────────────────────────────────────────────
# Route: Explorer (CÂBLÉE comme exemple)
# ────────────────────────────────────────────────────────────────────
@app.get("/api/relations")
def api_relations() -> dict[str, Any]:
    """Catalogue COMPLET des types de relations JDM (180+), pour peupler les
    dropdowns Explorer / Claim. Trié par nom. Source = JDMClient.relation_types
    (caché TTL long côté client). Renvoie [{name, id, help}]."""
    c = get_client()
    out: list[dict] = []
    try:
        for rt in c.relation_types():
            if not getattr(rt, "name", None):
                continue
            out.append({"name": rt.name, "id": rt.id, "help": (rt.help or "")[:160]})
    except Exception as e:
        return {"relations": [], "error": f"{type(e).__name__}: {e}"}
    out.sort(key=lambda d: d["name"])
    return {"relations": out}


@app.post("/api/explore")
def api_explore(req: ExploreRequest) -> dict[str, Any]:
    """Explorer les relations d'un terme dans JDM."""
    c = get_client()
    term, err = _resolve_and_check(c, req.term)
    if err:
        return {"rows": [], "message": err}

    rid = c.relation_type_id(req.relation)
    if rid is None:
        return {"rows": [], "message": f"Relation inconnue : {req.relation!r}"}

    # On NE filtre PAS côté API (pas de min_weight ni limit passés) : on
    # récupère TOUT pour pouvoir (a) trier par poids AVANT de tronquer
    # (l'API JDM tronque AVANT le tri → un `limit` API perd les plus forts),
    # (b) appliquer le seuil de poids aux SEULS positifs et inclure les
    # négatifs indépendamment selon `include_negatives`.
    try:
        res = c.relations_from(term, types_ids=[rid])
    except Exception as e:
        return {"rows": [], "message": f"Erreur API JDM : {e}"}

    mw = float(req.min_weight)
    lim = req.limit if (req.limit is None or int(req.limit) <= 0) else int(req.limit)
    # UN SEUL fetch JDM (sans limit/min_weight côté API) → on découpe ici.
    # La limite porte sur CHAQUE signe INDÉPENDAMMENT : limite=10 → jusqu'à
    # 10 positifs ET 10 négatifs (pas 10 au total, pas tous les négatifs).
    # Positifs filtrés par seuil de poids ; négatifs (si case cochée) triés par
    # négation la plus forte d'abord. Tri AVANT troncature (l'API JDM tronque
    # avant de trier → on ne lui passe jamais le limit).
    rels = res.relations
    positives = sorted((r for r in rels if r.w >= 0 and r.w >= mw),
                       key=lambda x: -x.w)
    negatives = (sorted((r for r in rels if r.w < 0), key=lambda x: x.w)
                 if req.include_negatives else [])
    if lim is not None:
        positives = positives[:lim]
        negatives = negatives[:lim]
    kept = positives + negatives

    idx = res.node_index()
    rows: list[dict] = []
    for r in kept:
        node = idx.get(r.node2)
        if node is None:
            try:
                node = c.node_by_id(r.node2)
            except Exception:
                continue
        dec = c.decode_node_name(node.name, local_nodes=idx)
        annot_str = ""
        if req.with_annotations:
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
            "relation": req.relation,
            "target": dec["decoded"],
            "weight": round(r.w, 1),
            "annotations": annot_str,
            "target_id": node.name if dec["is_refinement"] else "",
        })

    if not rows:
        neg = "" if req.include_negatives else " ; négatifs exclus"
        msg = (f"Aucun triplet `{term} | {req.relation} | ?` "
               f"(positifs w ≥ {req.min_weight:.0f}{neg}).")
        return {"rows": [], "message": msg}

    return {"rows": rows, "message": f"{len(rows)} triplet(s) trouvé(s)."}


# ────────────────────────────────────────────────────────────────────
# Route: Claim checker (CÂBLÉE comme exemple)
# ────────────────────────────────────────────────────────────────────
@app.post("/api/factcheck")
def api_factcheck(req: ClaimRequest) -> dict[str, Any]:
    """Vérifier un triplet sujet | relation | objet."""
    if req.effort not in EFFORT_CHOICES:
        raise HTTPException(400, f"effort doit être dans {EFFORT_CHOICES}")
    c = get_client()
    subj, err_s = _resolve_and_check(c, req.subject)
    if err_s:
        return {"status": "unknown", "error": err_s}
    obj, err_o = _resolve_and_check(c, req.object)
    if err_o:
        return {"status": "unknown", "error": err_o}

    claim = Claim(
        text=f"{subj} | {req.relation} | {obj}",
        subject=subj, relation=req.relation, object=obj,
    )
    try:
        v = verify_claim(c, claim, effort=req.effort,
                         bypass_containment=bool(req.bypass))
    except Exception as e:
        raise HTTPException(500, f"Erreur factcheck : {e}")

    def fmt(e):
        return {"s": e.source, "r": e.relation, "t": e.target, "w": e.w}

    origin = ("inference" if v.inference_schema
              else "containment" if v.status != Status.UNKNOWN
              else "none")

    return {
        "status": v.status.value,
        "confidence": v.confidence,
        "explanation": v.explanation,
        "origin": origin,
        "inference_schema": v.inference_schema,
        "proof": [fmt(e) for e in (v.inference_proof or v.evidence_for or [])],
        "counter": [fmt(e) for e in (v.evidence_against or [])],
    }


# ────────────────────────────────────────────────────────────────────
# Route: Disambiguate
# ────────────────────────────────────────────────────────────────────
@app.post("/api/disambiguate")
def api_disambiguate(req: TermRequest) -> dict[str, Any]:
    """Récupérer les sens raffinés d'un terme polysémique.

    Retourne `{senses: [{decoded, weight, id}], message}` — `senses` trié
    par poids r_raff_sem décroissant. Liste vide si terme monosémique ou
    inconnu (le `message` précise le cas).
    """
    raw = (req.term or "").strip()
    if not raw:
        return {"senses": [], "message": "Renseigne un terme polysémique (avocat, souris, police, …)."}
    c = get_client()
    if not c.term_exists(raw):
        return {"senses": [], "message": f"« {raw} » n'est pas connu de JeuxDeMots."}
    try:
        senses = c.refinements_decoded(raw)
    except Exception as e:
        return {"senses": [], "message": f"Erreur API JDM : {e}"}
    if not senses:
        return {"senses": [], "message": f"Aucun sens raffiné pour « {raw} » (terme probablement monosémique)."}
    senses.sort(key=lambda s: -s.weight)
    rows = [
        {"decoded": s.decoded, "weight": round(s.weight, 1), "id": s.name}
        for s in senses[:30]
    ]
    return {"senses": rows, "message": f"{len(rows)} sens trouvé(s)."}


# ────────────────────────────────────────────────────────────────────
# Route: Subgraph
# ────────────────────────────────────────────────────────────────────
@app.post("/api/subgraph")
def api_subgraph(req: SubgraphRequest) -> dict[str, Any]:
    """Construire le sous-graphe d'un terme.

    Deux formats :
      - `format="html"` : HTML autonome vis-network (interactif), à
        afficher dans une iframe côté front. Retour :
          {format: "html", root, html: "<!doctype html>...", stats}
      - `format="json"` : nodes + edges aplatis pour rendu SVG natif.
          {format: "json", root, nodes, edges, stats}
    """
    c = get_client()
    term, err = _resolve_and_check(c, req.term)
    if err:
        return {"format": req.format, "root": req.term, "message": err,
                "stats": {"n_nodes": 0, "n_edges": 0},
                "nodes": [], "edges": [], "html": ""}

    # Conversion listes vides → None pour que build_subgraph utilise
    # ses DEFAULT_RELATIONS / DEFAULT_DEPTH2_RELATIONS / etc.
    def _nz(lst: list[str]) -> Optional[list[str]]:
        return list(lst) if lst else None

    fmt = req.format.lower() if req.format else "html"
    if fmt not in {"html", "json"}:
        raise HTTPException(400, f"format doit être 'html' ou 'json' (reçu : {req.format!r})")

    try:
        kwargs: dict[str, Any] = {
            "client": c,
            "depth": max(1, min(int(req.depth), 4)),
            "top_k_per_relation": int(req.top_k),
            "top_k_depth2": int(req.top_k_d2),
            "top_k_depth3": int(req.top_k_d3),
            "top_k_depth4": int(req.top_k_d4),
            "relations": _nz(req.relations),
            "depth2_relations": _nz(req.relations_d2),
            "depth3_relations": _nz(req.relations_d3),
            "depth4_relations": _nz(req.relations_d4),
            "output": fmt,
        }
        # min_weight=0 → on passe None à build_subgraph pour qu'il
        # délègue à JDM (sinon on coupe trop fort sur des graphes courts).
        if req.min_weight and req.min_weight > 0:
            kwargs["min_weight"] = float(req.min_weight)

        if fmt == "html":
            import tempfile
            tmpdir = Path(tempfile.gettempdir())
            tmppath = tmpdir / f"jdm_subgraph_{abs(hash((term, req.depth)))}.html"
            kwargs["output_path"] = str(tmppath)
            res = build_subgraph(term, **kwargs)
            try:
                html = tmppath.read_text(encoding="utf-8")
            finally:
                try: tmppath.unlink()
                except Exception: pass
            html = _inject_iframe_css(html)
            return {
                "format": "html",
                "root": term,
                "html": html,
                "stats": res.get("stats", {}),
            }

        # format == "json"
        res = build_subgraph(term, **kwargs)
    except Exception as e:
        return {"format": fmt, "root": term, "message": f"Erreur API JDM : {e}",
                "stats": {"n_nodes": 0, "n_edges": 0},
                "nodes": [], "edges": [], "html": ""}

    raw_nodes = res.get("nodes", [])
    raw_edges = res.get("edges", [])
    nodes_out = [
        {"id": n["id"], "label": n.get("label", n["id"]),
         "kind": n.get("_kind", "assoc"), "depth": n.get("_depth", 0)}
        for n in raw_nodes
    ]
    edges_out = [
        {"from": e["from"], "to": e["to"],
         "relation": e.get("_relation", ""),
         "weight": e.get("_weight", 0),
         "negative": bool(e.get("_negative", False)),
         "depth": e.get("_depth", 1)}
        for e in raw_edges
    ]

    # Tronque à max_nodes en BFS depuis ROOT (préserve la connectivité).
    if req.max_nodes and len(nodes_out) > req.max_nodes:
        out_edges: dict[str, list[dict]] = {}
        for e in edges_out:
            out_edges.setdefault(e["from"], []).append(e)
        for src in out_edges:
            out_edges[src].sort(key=lambda e: -abs(e["weight"]))
        keep: set[str] = {"ROOT"}
        frontier = ["ROOT"]
        while frontier and len(keep) < req.max_nodes:
            nxt = []
            for src in frontier:
                for e in out_edges.get(src, []):
                    if e["to"] not in keep:
                        keep.add(e["to"])
                        nxt.append(e["to"])
                        if len(keep) >= req.max_nodes:
                            break
                if len(keep) >= req.max_nodes:
                    break
            frontier = nxt
        nodes_out = [n for n in nodes_out if n["id"] in keep]
        edges_out = [e for e in edges_out if e["from"] in keep and e["to"] in keep]

    return {
        "format": "json",
        "root": term,
        "nodes": nodes_out,
        "edges": edges_out,
        "stats": res.get("stats", {"n_nodes": len(nodes_out), "n_edges": len(edges_out)}),
    }


# ────────────────────────────────────────────────────────────────────
# Route: Subgraph LIVE (SSE) — mode animé du sous-graphe
# ────────────────────────────────────────────────────────────────────
# Émet le graphe progressivement pour le mode LIVE de l'onglet Sous-graphe.
# Format SSE (cf. INTEGRATION.md handoff designer) :
#   event: graph    data: {nodes, edges}          ← snapshot complet immédiat
#   event: node     data: {id, label, kind, depth} ← émis un par un
#   event: edge     data: {from, to, relation, highlight}
#   event: thinking data: {text}                  ← optionnel (LLM)
#   event: response data: {text}                  ← optionnel (LLM)
#   event: done     data: {}
class SubgraphLiveRequest(BaseModel):
    term: str
    depth: int = 1
    top_k: int = 4
    relations: list[str] = []
    max_nodes: int = 30
    # Rang max par type de relation : pour chaque relation distincte,
    # garde les `rank_cap` arêtes de plus fort poids. 0 = aucun (super
    # restrictif), valeur élevée = permissif. Les négations sont
    # toujours conservées indépendamment du rang.
    rank_cap: int = 999
    # Si fourni : question posée au LLM en parallèle de l'animation.
    # Sa réponse est streamée via les events 'thinking' / 'response'.
    question: Optional[str] = None
    api_key: str = ""
    model: str = "gemini-3.1-flash-lite"


@app.post("/api/subgraph/live")
async def api_subgraph_live(req: SubgraphLiveRequest):
    """SSE qui anime la construction du sous-graphe d'un terme."""
    c = get_client()
    term, err = _resolve_and_check(c, req.term)
    if err:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": err}, ensure_ascii=False)}
        return EventSourceResponse(err_gen())

    # Build le sous-graphe complet en JSON (réutilise build_subgraph existant)
    try:
        rels = list(req.relations) if req.relations else None
        res = build_subgraph(
            term, client=c,
            depth=max(1, min(int(req.depth), 4)),
            top_k_per_relation=int(req.top_k),
            relations=rels,
            output="json",
        )
    except Exception as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"
            }, ensure_ascii=False)}
        return EventSourceResponse(err_gen())

    # Aplatit vers la forme légère LIVE (factorisé : cf. _flatten_subgraph_live,
    # réutilisé par le rendu viz inline du chat).
    _flat = _flatten_subgraph_live(res.get("nodes", []), res.get("edges", []))
    nodes = _flat["nodes"]
    edges = _flat["edges"]

    # ─────────────────────────────────────────────────────────────
    # Filtre par RANG (≠ filtre par poids absolu) :
    # pour chaque type de relation distinct, garde les `rank_cap`
    # arêtes de plus fort |poids|. Les NÉGATIONS sont toujours
    # conservées (signal sémantique fort, indépendant du rang).
    # 0 = ultra restrictif (aucune positive), grande valeur = permissif.
    # Puis nœuds orphelins retirés (sauf ROOT).
    # ─────────────────────────────────────────────────────────────
    rc = int(req.rank_cap)
    if rc < 999:  # < 999 = cap actif (sinon : tout passe)
        by_rel: dict[str, list[dict]] = {}
        kept_neg: list[dict] = []
        for e in edges:
            if e["negative"]:
                kept_neg.append(e)
            else:
                by_rel.setdefault(e["relation"], []).append(e)
        kept_pos: list[dict] = []
        for rel, arr in by_rel.items():
            arr.sort(key=lambda x: -abs(float(x.get("weight", 0))))
            kept_pos.extend(arr[:rc])
        edges = kept_pos + kept_neg
        touched: set[str] = {"ROOT"}
        for e in edges:
            touched.add(e["from"]); touched.add(e["to"])
        nodes = [n for n in nodes if n["id"] in touched]

    # ─────────────────────────────────────────────────────────────
    # PROPAGATION POSITIVE UNIQUEMENT :
    # une arête négative `A -[NEG]-> B` est gardée (terminaison
    # informative) mais B n'est PAS exploré pour la profondeur
    # suivante — sauf si B est aussi atteint positivement par
    # ailleurs. Ça évite que les enfants de B viennent polluer le
    # sous-graphe alors qu'on a explicitement dit « A n'est pas B ».
    # ─────────────────────────────────────────────────────────────
    reachable_pos = {"ROOT"}
    frontier = ["ROOT"]
    while frontier:
        nxt: list[str] = []
        for src in frontier:
            for e in edges:
                if e["from"] == src and not e["negative"]:
                    if e["to"] not in reachable_pos:
                        reachable_pos.add(e["to"])
                        nxt.append(e["to"])
        frontier = nxt
    # On retire les arêtes qui PARTENT d'un nœud non atteint positivement
    # (donc atteint uniquement par négation, ou détaché). Les arêtes
    # entrant vers ces nœuds (les négations elles-mêmes) restent.
    edges = [e for e in edges if e["from"] in reachable_pos]
    touched2: set[str] = {"ROOT"}
    for e in edges:
        touched2.add(e["from"]); touched2.add(e["to"])
    nodes = [n for n in nodes if n["id"] in touched2]

    # Cap par max_nodes via BFS depuis ROOT (idem /api/subgraph).
    if req.max_nodes and len(nodes) > req.max_nodes:
        out_edges_idx: dict[str, list[dict]] = {}
        for e in edges:
            out_edges_idx.setdefault(e["from"], []).append(e)
        for src in out_edges_idx:
            out_edges_idx[src].sort(key=lambda e: -abs(e.get("weight", 0)))
        keep: set[str] = {"ROOT"}
        frontier = ["ROOT"]
        while frontier and len(keep) < req.max_nodes:
            nxt = []
            for src in frontier:
                for e in out_edges_idx.get(src, []):
                    if e["to"] not in keep:
                        keep.add(e["to"])
                        nxt.append(e["to"])
                        if len(keep) >= req.max_nodes:
                            break
                if len(keep) >= req.max_nodes:
                    break
            frontier = nxt
        nodes = [n for n in nodes if n["id"] in keep]
        edges = [e for e in edges if e["from"] in keep and e["to"] in keep]

    # Option LLM : si une question est fournie, on lance chat_with_agent
    # en parallèle et on stream la réponse. Sinon on saute cette partie.
    has_question = bool((req.question or "").strip())

    async def gen():
        import asyncio
        # 1) Snapshot global immédiat (fast clients qui ne veulent pas
        # attendre l'animation peuvent l'utiliser direct)
        yield {
            "event": "graph",
            "data": json.dumps({
                "nodes": nodes, "edges": edges, "root": term,
            }, ensure_ascii=False),
        }

        # 2) Émission progressive — node toutes les 120ms (l'anim
        # designer dans HeroAnimation utilise des delays similaires)
        for n in nodes:
            yield {"event": "node", "data": json.dumps(n, ensure_ascii=False)}
            await asyncio.sleep(0.12)

        # 3) Émission progressive des edges après les nodes
        for e in edges:
            yield {"event": "edge", "data": json.dumps(e, ensure_ascii=False)}
            await asyncio.sleep(0.08)

        # 4) Optionnel : si question → on streame une réponse LLM
        if has_question:
            try:
                llm = _app._build_llm(req.model, req.api_key, use_thinking=False)
                from langchain_core.messages import HumanMessage
                # Stream la réponse en tokens via astream_events
                from jdm_agent.tools.jdm_agent import build_jdm_agent
                agent = build_jdm_agent(client=c, llm=llm)
                prompt = f"Pour le terme « {term} », réponds : {req.question}"
                accumulated = ""
                async for ev in agent.astream_events(
                    {"messages": [HumanMessage(content=prompt)]},
                    version="v2",
                ):
                    if ev.get("event") == "on_chat_model_stream":
                        chunk = (ev.get("data") or {}).get("chunk")
                        if chunk is None:
                            continue
                        content = chunk.content
                        if isinstance(content, str):
                            delta = content
                        elif isinstance(content, list):
                            delta = "".join(
                                b.get("text", "") for b in content
                                if isinstance(b, dict) and b.get("type") == "text"
                            )
                        else:
                            delta = ""
                        if delta:
                            accumulated += delta
                            yield {
                                "event": "response",
                                "data": json.dumps({"text": accumulated}, ensure_ascii=False),
                            }
            except Exception as e:
                yield {"event": "thinking", "data": json.dumps({
                    "text": f"(LLM indisponible : {type(e).__name__}: {e})"
                }, ensure_ascii=False)}

        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(gen(), ping=15)


# ────────────────────────────────────────────────────────────────────
# Helper : wrap un générateur SYNC bloquant en async generator pour SSE
# ────────────────────────────────────────────────────────────────────
async def _to_async_gen(sync_gen):
    """Convertit un générateur sync en async, en exécutant chaque `next()`
    dans un thread (pour ne pas bloquer le event loop FastAPI).

    Utilisé pour chat_with_agent / run_jarvis_agent qui font des appels
    HTTP/LLM bloquants à l'intérieur de leur boucle.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    _SENTINEL = object()

    def _next_or_sentinel():
        try:
            return next(sync_gen)
        except StopIteration:
            return _SENTINEL

    while True:
        result = await loop.run_in_executor(None, _next_or_sentinel)
        if result is _SENTINEL:
            break
        yield result


# ────────────────────────────────────────────────────────────────────
# Route: Agent SSE stream — TOKEN-LEVEL via astream_events
# ────────────────────────────────────────────────────────────────────
# Pourquoi pas `app.chat_with_agent` ici : il utilise stream_mode="updates"
# qui ne yield qu'à la fin de chaque node. Pour une question Q&A simple
# sans tool, ça donne UN seul yield → impression de "réflexion figée"
# côté UI. astream_events('v2') donne :
#   - on_chat_model_stream : chaque token du LLM (delta)
#   - on_tool_start / on_tool_end : appels d'outils
# → vraie streaming token par token, narration HTML identique au LLM.
#
# Trade-off : on perd ici la mécanique de retry rate-limit + rotation
# pool de chat_with_agent. C'est acceptable pour un chat (l'utilisateur
# peut resoumettre). Pour les flux Jarvis longs, on garde chat_with_agent
# via run_jarvis_agent.
@app.post("/api/chatbot/stream")
async def api_agent_stream(req: AgentRequest):
    """Token-level SSE stream pour le chatbot LLM."""
    async def gen():
        from langchain_core.messages import AIMessage, HumanMessage
        from jarvis import (
            _content_to_text, _content_to_thoughts,
            _narrate_tool_call, _narrate_tool_result,
        )
        from jdm_agent.enrich.validators import exclusion_context
        from jdm_agent.tools.jdm_agent import build_jdm_agent

        # 1) Build LLM via la version complète (routing 3.x natif vs
        # 2.x OpenAI-compat, thinking par modèle, pool key override).
        try:
            llm = _app._build_llm(
                req.model, req.api_key,
                use_thinking=req.use_thinking,
            )
        except ValueError as e:
            yield {"event": "error", "data": json.dumps({"text": str(e)}, ensure_ascii=False)}
            return

        # 2) Build agent + historique
        try:
            agent = build_jdm_agent(client=get_client(), llm=llm)
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"Build agent : {type(e).__name__}: {e}"
            }, ensure_ascii=False)}
            return

        # Conversion historique Gradio → LangChain
        lc_messages = []
        for h in req.history or []:
            role = h.get("role")
            content = (h.get("content") or "").strip()
            if not content or content.startswith("⚠️") or content.startswith("❌"):
                continue
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                # Nettoie les blocs annexes du markdown cumulatif AVANT
                # de réinjecter au LLM :
                #   - "\n\n<details>"   : le résumé serveur du raisonnement
                #     (sinon le LLM le mime au tour suivant et génère un
                #     faux <details> dans sa nouvelle réponse — cause du
                #     bug « 2 blocs RAISONNEMENT séparés »).
                #   - "\n\n*⏳"          : suffixe pending (legacy).
                #   - "\n\n<div class=\"jdm-narration\"" : narration LIVE
                #     non encapsulée (cas anciens).
                ans = content
                for marker in (
                    "\n\n<details>",
                    "\n\n*⏳",
                    "\n\n<div class=\"jdm-narration\"",
                ):
                    ans = ans.split(marker, 1)[0]
                ans = ans.strip()
                if ans:
                    lc_messages.append(AIMessage(content=ans))
        lc_messages.append(HumanMessage(content=req.message))

        # 3) Accumulateurs
        # progress       = lignes narration finalisées (tool_calls, tool_results,
        #                  thoughts/spoken finalisés avant un nouveau tour LLM)
        # current_text   = texte LLM en cours de streaming (delta tokens)
        # current_thinking = chain-of-thought en cours
        # NB : pendant le stream, on affiche TOUT inline pour suivre.
        # À la FIN, on bascule sur un rendu "réponse seule + <details>"
        # (cf. app.py chat_with_agent ligne ~1495).
        # Plus de prologue "🧠 Réflexion en cours…" : il faisait doublon
        # avec l'indicateur React `streaming` (ainsi que l'animation de
        # l'icône JDMMark côté UI). Le LLM commence à streamer dans la
        # seconde, l'attente n'a pas besoin de message texte.
        progress: list[str] = []
        current_text = ""
        current_thinking = ""
        _pending_viz = None  # params de viz capturés au on_tool_start
        use_thinking_flag = bool(req.use_thinking)

        def html_escape(s: str) -> str:
            return (s.replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;")
                     .replace("\n", "<br>"))

        def render_live() -> str:
            """Markdown LIVE pendant la génération — tout inline (suivi)."""
            live = list(progress)
            if current_thinking.strip():
                live.append(f'<div class="jdm-thinking">💭 {html_escape(current_thinking)}</div>')
            if current_text.strip():
                live.append(current_text)
            return "\n\n".join(live)

        def render_with_pending() -> str:
            # NB : on ne suffixe PLUS "⏳ Génération en cours…" ici. L'UI
            # affiche déjà un indicateur de streaming compact en bas
            # (views-agent.jsx, contrôlé par le state `streaming`) — un
            # second indicateur en gros dans le corps du message faisait
            # doublon. On garde la fonction pour ne pas toucher aux 4
            # callsites en aval.
            return render_live()

        def render_final() -> str:
            """Markdown FINAL — réponse en haut, raisonnement collapsible en bas.

            Reproduit le pattern app.py : la trace (thoughts, tool calls,
            tool results) est cachée dans un <details><summary>...</summary>.
            La 1ère ligne de progress ('🧠 Réflexion en cours…') est
            écartée car elle n'apporte rien dans le résumé final.
            """
            # Filtre la ligne 'Réflexion en cours' si présente en tête.
            steps = list(progress)
            if steps and steps[0].startswith("*🧠 Réflexion"):
                steps = steps[1:]
            if current_thinking.strip():
                steps.append(f'<div class="jdm-thinking">💭 {html_escape(current_thinking)}</div>')

            final = current_text.strip() or "*(réponse vide)*"

            if not steps:
                return final

            n = len(steps)
            plural = "s" if n > 1 else ""
            label = (f"🧠 Voir le résumé du raisonnement ({n} étape{plural})"
                     if use_thinking_flag
                     else f"🧠 Voir les étapes ({n} étape{plural})")
            details = (
                "\n\n<details><summary>" + label + "</summary>\n\n"
                + "\n\n".join(steps)
                + "\n\n</details>"
            )
            return final + details

        # 4) Premier yield immédiat — text vide, l'UI montre l'animation
        # JDMMark + indicator React le temps que les premiers tokens arrivent.
        yield {
            "event": "text",
            "data": json.dumps({"text": ""}, ensure_ascii=False),
        }

        try:
            with exclusion_context():
                async for event in agent.astream_events(
                    {"messages": lc_messages}, version="v2",
                ):
                    kind = event.get("event")

                    if kind == "on_chat_model_stream":
                        chunk = (event.get("data") or {}).get("chunk")
                        if chunk is None:
                            continue
                        # chunk.content peut être str (OpenAI) ou list de
                        # blocs (Anthropic/Gemini avec thoughts).
                        delta_text = _content_to_text(chunk.content)
                        delta_thought = _content_to_thoughts(chunk.content)
                        if delta_thought:
                            current_thinking += delta_thought
                        if delta_text:
                            current_text += delta_text
                        if delta_text or delta_thought:
                            yield {
                                "event": "text",
                                "data": json.dumps({"text": render_with_pending()}, ensure_ascii=False),
                            }

                    elif kind == "on_tool_start":
                        name = event.get("name") or "?"
                        data = event.get("data") or {}
                        args = data.get("input") or {}
                        if isinstance(args, dict) and "input" in args and isinstance(args["input"], dict):
                            args = args["input"]
                        if name == "build_subgraph_visualization":
                            _pending_viz = _viz_payload_from_tool_input(
                                args if isinstance(args, dict) else {})
                        narrated = _narrate_tool_call(name, args if isinstance(args, dict) else {})
                        if not narrated:
                            args_str = ", ".join(
                                f"{k}={v!r}" for k, v in (args.items() if isinstance(args, dict) else [])
                            )
                            narrated = f"🔧 `{name}({args_str})`"
                        # Finalize text courant avant l'outil (sera repris
                        # après si le LLM continue à parler post-tool).
                        if current_text.strip():
                            progress.append(current_text)
                        if current_thinking.strip():
                            progress.append(f'<div class="jdm-thinking">💭 {html_escape(current_thinking)}</div>')
                        current_text = ""
                        current_thinking = ""
                        progress.append(f'<div class="jdm-narration">{narrated}</div>')
                        yield {
                            "event": "text",
                            "data": json.dumps({"text": render_with_pending()}, ensure_ascii=False),
                        }

                    elif kind == "on_tool_end":
                        name = event.get("name") or "?"
                        data = event.get("data") or {}
                        out = data.get("output", "")
                        # out peut être ToolMessage, str, ou autre
                        if hasattr(out, "content"):
                            content = _content_to_text(out.content)
                        else:
                            content = str(out)
                        narrated_done = _narrate_tool_result(name, content)
                        if narrated_done:
                            progress.append(f'<div class="jdm-narration">{narrated_done}</div>')
                        else:
                            preview = content[:140].replace("\n", " ")
                            if len(content) > 140:
                                preview += "…"
                            progress.append(
                                f'<div class="jdm-narration">✓ <em>{name}</em> renvoie {len(content)} chars · '
                                f'<code>{html_escape(preview)}</code></div>'
                            )
                        # Viz inline — émet ce que l'outil a produit (live
                        # par défaut / html sur demande). Cf. chat mascotte.
                        if name == "build_subgraph_visualization":
                            _vev = _viz_event_from_tool_output(content)
                            term = (_pending_viz or {}).get("term", "")
                            if _vev:
                                yield {"event": "viz", "data": json.dumps(
                                    {"term": term, **_vev}, ensure_ascii=False)}
                            elif _pending_viz:
                                yield {"event": "viz",
                                       "data": json.dumps(_pending_viz, ensure_ascii=False)}
                            _pending_viz = None
                        yield {
                            "event": "text",
                            "data": json.dumps({"text": render_with_pending()}, ensure_ascii=False),
                        }

            # Final : réponse seule en haut + raisonnement dans <details>
            # (= pattern app.py chat_with_agent, qui scinde
            # progress_live / progress_full pour le résumé collapsible).
            yield {
                "event": "text",
                "data": json.dumps({"text": render_final()}, ensure_ascii=False),
            }
            yield {"event": "done", "data": "{}"}

        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"
            }, ensure_ascii=False)}

    # ping=15 envoie un `:ping` toutes les 15s — force Apache/Nginx à
    # flusher les chunks au lieu de les buffer en attente d'un timeout.
    return EventSourceResponse(gen(), ping=15)


# ────────────────────────────────────────────────────────────────────
# Route: Chat mascotte Jarvis (supervision) — SSE token-level
# ────────────────────────────────────────────────────────────────────
# Même mécanique de streaming que /api/chatbot/stream, mais :
#   - agent = build_jarvis_chat_agent (outils supervision + JDM lecture)
#   - config courante injectée dans le snapshot (tool get_config)
#   - patches de config (tool set_config) émis en events `config_patch`
#     que le frontend applique à localStorage.jdm_jarvis_config.
@app.post("/api/jarvis/chat")
async def api_jarvis_chat(req: JarvisChatRequest):
    """Token-level SSE pour le chat de la mascotte Jarvis."""
    async def gen():
        from langchain_core.messages import AIMessage, HumanMessage
        from jarvis import (
            _content_to_text, _content_to_thoughts,
            _narrate_tool_call, _narrate_tool_result,
        )
        from jdm_agent.enrich.validators import exclusion_context
        from jdm_agent.jarvis_chat.agent import build_jarvis_chat_agent

        # Pose la config courante + initialise la capture de patches POUR
        # CE tour (ContextVar → isolé par requête).
        _jchat_rt.set_config_snapshot(req.config or {})
        _jchat_rt.begin_config_patch_capture()

        # Clé Gemini à OCCUPATION MINIMALE : comme les flux, le chat prend
        # une clé du pool la moins chargée (load-min) plutôt que la clé env
        # sticky — évite qu'une discussion monopolise la même clé qu'un flux
        # qui tourne. Lease relâché dans le finally. Si pas de pool / pas
        # gemini → override None (fallback env, comportement inchangé).
        _chat_lease_id = "chat-" + _uuid.uuid4().hex[:8]
        _gem_key = None
        try:
            if (req.model or "").startswith("gemini-"):
                from jdm_agent.pool_lease import acquire_key as _acq
                _gem_key = _acq(req.model, _chat_lease_id, _app)
        except Exception:
            _gem_key = None

        try:
            llm = _app._build_llm(req.model, req.api_key, use_thinking=False,
                                  gemini_key_override=_gem_key)
        except ValueError as e:
            yield {"event": "error", "data": json.dumps({"text": str(e)}, ensure_ascii=False)}
            return
        try:
            agent = build_jarvis_chat_agent(client=get_client(), llm=llm)
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"Build agent : {type(e).__name__}: {e}"}, ensure_ascii=False)}
            return

        lc_messages = []
        for h in req.history or []:
            role = h.get("role")
            content = (h.get("content") or "").strip()
            if not content:
                continue
            if role in ("user", "me"):
                lc_messages.append(HumanMessage(content=content))
            elif role in ("assistant", "bot"):
                lc_messages.append(AIMessage(content=content))
        lc_messages.append(HumanMessage(content=req.message))

        progress: list[str] = []
        current_text = ""
        _pending_viz = None  # params de viz capturés au on_tool_start

        def html_escape(s: str) -> str:
            return (s.replace("&", "&amp;").replace("<", "&lt;")
                     .replace(">", "&gt;").replace("\n", "<br>"))

        def render_live() -> str:
            live = list(progress)
            if current_text.strip():
                live.append(current_text)
            return "\n\n".join(live)

        def emit_config_patches():
            """Draine les patches set_config accumulés et les émet."""
            patches = _jchat_rt.drain_config_patches()
            for p in patches:
                yield {"event": "config_patch",
                       "data": json.dumps(p, ensure_ascii=False)}

        yield {"event": "text", "data": json.dumps({"text": ""}, ensure_ascii=False)}

        try:
            with exclusion_context():
                async for event in agent.astream_events(
                    {"messages": lc_messages}, version="v2",
                ):
                    kind = event.get("event")
                    if kind == "on_chat_model_stream":
                        chunk = (event.get("data") or {}).get("chunk")
                        if chunk is None:
                            continue
                        delta = _content_to_text(chunk.content)
                        if delta:
                            current_text += delta
                            yield {"event": "text",
                                   "data": json.dumps({"text": render_live()}, ensure_ascii=False)}
                    elif kind == "on_tool_start":
                        name = event.get("name") or "?"
                        data = event.get("data") or {}
                        args = data.get("input") or {}
                        if isinstance(args, dict) and "input" in args and isinstance(args["input"], dict):
                            args = args["input"]
                        # Capture les params de visualisation pour les
                        # émettre en `viz` (rendu inline iframe) à la fin
                        # du tool.
                        if name == "build_subgraph_visualization":
                            _pending_viz = _viz_payload_from_tool_input(
                                args if isinstance(args, dict) else {})
                        narrated = _narrate_tool_call(name, args if isinstance(args, dict) else {})
                        if not narrated:
                            narrated = f"🔧 `{name}`"
                        if current_text.strip():
                            progress.append(current_text)
                        current_text = ""
                        progress.append(f'<div class="jdm-narration">{narrated}</div>')
                        yield {"event": "text",
                               "data": json.dumps({"text": render_live()}, ensure_ascii=False)}
                    elif kind == "on_tool_end":
                        name = event.get("name") or "?"
                        data = event.get("data") or {}
                        out = data.get("output", "")
                        content = _content_to_text(out.content) if hasattr(out, "content") else str(out)
                        narrated_done = _narrate_tool_result(name, content)
                        if narrated_done:
                            progress.append(f'<div class="jdm-narration">{narrated_done}</div>')
                        # Visualisation : on émet EXACTEMENT ce que l'outil a
                        # produit (live nodes/edges par défaut, ou html sur
                        # demande), sans reconstruire. Fallback params si rien
                        # d'exploitable (le front refera via /api/subgraph).
                        if name == "build_subgraph_visualization":
                            _vev = _viz_event_from_tool_output(content)
                            term = (_pending_viz or {}).get("term", "")
                            if _vev:
                                yield {"event": "viz", "data": json.dumps(
                                    {"term": term, **_vev}, ensure_ascii=False)}
                            elif _pending_viz:
                                yield {"event": "viz",
                                       "data": json.dumps(_pending_viz, ensure_ascii=False)}
                            _pending_viz = None
                        # Émet les patches de config dès qu'un set_config a tourné.
                        for ev in emit_config_patches():
                            yield ev
                        yield {"event": "text",
                               "data": json.dumps({"text": render_live()}, ensure_ascii=False)}

            # Patches résiduels + réponse finale
            for ev in emit_config_patches():
                yield ev
            yield {"event": "text",
                   "data": json.dumps({"text": current_text.strip() or render_live()},
                                      ensure_ascii=False)}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"}, ensure_ascii=False)}
        finally:
            # Relâche la clé pool prise pour ce tour de chat.
            if _gem_key:
                try:
                    from jdm_agent.pool_lease import release_key as _rel
                    _rel(_chat_lease_id)
                except Exception:
                    pass

    return EventSourceResponse(gen(), ping=15)


# ────────────────────────────────────────────────────────────────────
# Route: Jarvis stream
# ────────────────────────────────────────────────────────────────────
# Mapping agent_id → (prompt_builder, headline_builder).
# `params` est le dict envoyé par l'UI ; on en extrait ce que le
# builder accepte. On filtre via inspect.signature pour rester
# tolérant aux paramètres inconnus.
def _term_or_random(p: dict) -> str:
    """Renvoie le terme du form, ou un libellé 'aléatoire' si vide.
    Évite l'affichage moche de « » dans les headlines.
    """
    t = (p.get("term") or "").strip()
    return t if t else "un terme tiré au hasard"


def _jarvis_dispatch(agent_id: str, params: dict) -> tuple[str, str]:
    """Construit (prompt, headline) pour N'IMPORTE quel agent de l'inventaire
    (natif OU sur mesure) — UN SEUL chemin. Lève ValueError si l'id est inconnu.

    Le pré-prompt vient TOUJOURS de `build_preprompt_for_spec(spec, params)` :
    pour un natif il délègue au `build_*_prompt` référencé par le spec (prompt
    exact), pour un custom il assemble génériquement."""
    from jdm_agent.jarvis_chat import inventory as _inv
    spec = _inv.get_agent_spec(agent_id)
    if not spec:
        raise ValueError(
            f"agent_id inconnu : {agent_id!r}. "
            f"Attendu : un agent de l'inventaire ({sorted(_inv._BUILTINS)} ou sur mesure)."
        )
    prompt = _inv.build_preprompt_for_spec(spec, params or {})
    headline = f"{spec.get('icon', '🤖')} {spec.get('title', agent_id)} · {_term_or_random(params or {})}"
    return prompt, headline


# ────────────────────────────────────────────────────────────────────
# Jarvis run registry — background execution decoupled from SSE
#
# Pourquoi : si le client (browser) ferme la tab pendant un run, sans
# ce registre la connexion SSE se ferme, sse-starlette détecte la
# déconnexion, le générateur Python lève CancelledError, le flow Jarvis
# meurt (tokens LLM dépensés pour rien). Avec, le flow tourne dans un
# thread d'arrière-plan indépendant ; le SSE n'est qu'un observateur
# branché sur un buffer d'events. Tab fermée → SSE coupé MAIS le bg
# thread continue. Reconnexion possible via GET /api/jarvis/runs/<id>/stream
# qui replay le buffer + live.
#
# Limites assumées :
#   - process restart uvicorn → tous les runs meurent (pas de persistance
#     disque, c'est volontaire — overkill pour cet usage)
#   - TTL des runs terminés : 24h, puis purge auto
#   - "Stop" depuis le client = stoppe l'OBSERVATION SSE seulement, le
#     bg thread continue jusqu'à fin naturelle ou exhaustion budget
#     (interrompre un thread Python proprement n'est pas trivial)
# ────────────────────────────────────────────────────────────────────
import uuid as _uuid
import threading as _threading
import time as _time
import asyncio as _asyncio
import re as _re

_JARVIS_RUNS: dict[str, dict] = {}
_JARVIS_RUNS_LOCK = _threading.Lock()
_JARVIS_RUN_TTL = 24 * 3600  # 24h après terminaison (done / error)

# Boucle asyncio principale, capturée au startup. Indispensable pour les
# runs démarrés depuis un THREAD worker (ex. tool start_agent du chat
# mascotte) : asyncio.get_event_loop() y lève RuntimeError (Py 3.12+).
# _push_event a besoin d'un loop valide pour call_soon_threadsafe.
_MAIN_LOOP: Optional[Any] = None


def _resolve_loop():
    """Loop pour un run : running loop si dispo (handler async), sinon la
    loop principale capturée au boot. Évite le RuntimeError en thread worker."""
    try:
        return _asyncio.get_running_loop()
    except RuntimeError:
        return _MAIN_LOOP


def _slug_term(term: str) -> str:
    """Slug sûr pour un nom de fichier : minuscules, sans accents, alnum +
    tirets. Vide → 'hasard'."""
    import unicodedata
    t = (term or "").strip().lower()
    if not t:
        return "hasard"
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    t = _re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return (t or "hasard")[:32]


def _make_run_id(agent_id: str, params: dict) -> str:
    """Identité LISIBLE d'un run = stem du fichier produit.
    Forme : `<flux>_<terme>_<JJ-MM-AA_HHhMMmSS>`. Unique (collision →
    suffixe _2, _3…). Remplace l'ancien uuid hex incompréhensible : une
    seule identité cohérente entre le run et son fichier."""
    import datetime as _dt
    slug = _slug_term((params or {}).get("term") or "")
    ts = _dt.datetime.now().strftime("%d-%m-%y_%Hh%Mm%S")
    base = f"{agent_id}_{slug}_{ts}"
    with _JARVIS_RUNS_LOCK:
        rid, i = base, 2
        while rid in _JARVIS_RUNS:
            rid = f"{base}_{i}"; i += 1
    return rid


def _new_run(agent_id: str, params: dict, headline: str, origin: str = "ui") -> dict:
    run_id = _make_run_id(agent_id, params)
    # Snapshot des clés du registry de consolidation au moment du start.
    # Le registry est un global module-level (cf. note historique dans
    # validators.py expliquant pourquoi ce n'est pas un ContextVar — les
    # workers LangChain ne préservent pas le contexte). En parallèle,
    # plusieurs runs partagent ce registry → contamination de la liste
    # `consolidated` envoyée en SSE.
    #
    # Filtre pragmatique : on snapshot l'état du registry au start, et
    # on envoie en SSE uniquement les triplets dont la clé n'était PAS
    # dans le snapshot (= ajoutés depuis le start de CE run). Imparfait
    # pour le premier run quand un second démarre après et ajoute en
    # parallèle, mais résout 90% des cas (le nouveau run voit propre).
    try:
        from jdm_agent.enrich import validators as _v
        with _v._REGISTRY_LOCK:
            initial_keys = (set(_v._CONSOLIDATION_REGISTRY.keys())
                            if _v._CONSOLIDATION_REGISTRY else set())
    except Exception:
        initial_keys = set()

    run = {
        "run_id": run_id,
        "agent_id": agent_id,
        "params": params,
        "headline": headline,
        # origine du lancement : 'ui' (vue JarvisRun) | 'chat' (mascotte).
        # Sert au badge tête-de-robot sur les cartes lancées hors JarvisRun.
        "origin": origin,
        "status": "starting",    # starting | running | done | error
        "events": [],            # list[{event, data}] append-only
        "subscribers": set(),    # set[asyncio.Event] notified à chaque push
        "started_at": _time.time(),
        "finished_at": None,
        "loop": _resolve_loop(),
        "error_text": None,
        # Cooperative cancellation flag — vu par le bg thread entre
        # deux chunks. Posé par POST /api/jarvis/runs/{id}/cancel.
        # Latence d'arrêt ≈ temps du round-trip LLM en cours (5-15s).
        "cancel_requested": False,
        # Snapshot des clés pré-existantes pour filtrer le `consolidated`
        # envoyé en SSE (anti-contamination cross-run).
        "initial_consolidation_keys": initial_keys,
    }
    with _JARVIS_RUNS_LOCK:
        _JARVIS_RUNS[run_id] = run
    return run


def _push_event(run: dict, event: str, data) -> None:
    """Push un event dans le buffer du run et réveille tous les abonnés.
    `data` peut être un dict (sera JSON-encodé) ou une string déjà sérialisée."""
    if isinstance(data, (dict, list)):
        data = json.dumps(data, ensure_ascii=False, default=str)
    run["events"].append({"event": event, "data": data})
    # Notify subscribers — call_soon_threadsafe pour traverser le boundary
    # thread → event loop sans race.
    loop = run["loop"]
    for sub in list(run["subscribers"]):
        try:
            loop.call_soon_threadsafe(sub.set)
        except Exception:
            pass  # loop closed, subscriber stale — ignored


# Agents qui CONSOLIDENT (lisent le registry de consolidation au lieu de
def _agent_consolidates(agent_id: str) -> bool:
    """True si l'agent passe par la consolidation (registry) plutôt que par
    l'écriture/parse de file_preview. SOURCE UNIQUE : `spec.consolidates` de
    l'inventaire (natifs ET sur mesure) — aucun id codé en dur."""
    try:
        from jdm_agent.jarvis_chat import inventory as _inv
        spec = _inv.get_agent_spec(agent_id)
        return bool(spec and spec.get("consolidates"))
    except Exception:
        return False


def _drive_jarvis_agent_thread(run: dict) -> None:
    """Exécute le flow Jarvis dans un thread, push les events dans le
    buffer. Appelé via threading.Thread (pas await) pour que ce soit
    INDÉPENDANT du cycle de vie HTTP."""
    agent_id = run["agent_id"]
    p = run["params"]
    try:
        # 1) Headline tout de suite
        _push_event(run, "headline", {
            "text": run["headline"], "agent_id": agent_id, "run_id": run["run_id"],
        })
        # 2) Build prompt
        prompt, headline = _jarvis_dispatch(agent_id, p)
        run["status"] = "running"
        # Spec inventaire = SOURCE UNIQUE pour TOUS (natifs ET sur mesure) :
        # toolset (exclude), extension/mode de sortie canonique, unité de prod.
        # Natif → exclude_tools_for_spec renvoie set() (catalogue complet) et le
        # spec porte output_ext/canonical_mode → même mécanique, un seul chemin.
        from jdm_agent.jarvis_chat import inventory as _inv
        _spec = _inv.get_agent_spec(agent_id) or {}
        _excl = _inv.exclude_tools_for_spec(_spec) if _spec else None
        _base_build_agent = (_app.build_jdm_agent if hasattr(_app, "build_jdm_agent")
                             else __import__("jdm_agent.tools.jdm_agent",
                                             fromlist=["build_jdm_agent"]).build_jdm_agent)

        def _build_agent(client=None, llm=None):
            return _base_build_agent(client=client, llm=llm, exclude_tools=_excl)

        # 3) Drive run_jarvis_agent
        sync_gen = _jarvis.run_jarvis_agent(
            prompt=prompt,
            headline=headline,
            model=p.get("model", "gemini-3.1-flash-lite"),
            api_key=p.get("api_key", ""),
            budget_label=str(p.get("budget_label", "illimité")),
            drops_key=p.get("drops_key", ""),
            build_llm_fn=_app._build_llm,
            build_agent_fn=_build_agent,
            get_client_fn=_app.get_client,
            use_thinking=bool(p.get("use_thinking", False)),
            temperature=(p.get("temperature") if isinstance(p.get("temperature"), (int, float)) else None),
            consolidation_target=(
                p.get("target_count") if _agent_consolidates(agent_id) else None
            ),
            production_target=(
                p.get("target_count") if not _agent_consolidates(agent_id) else None
            ),
            production_unit=_spec.get("production_unit", "items"),
            auto_switch_on_perday=bool(p.get("auto_switch", False)),
            resume_state=p.get("resume_state"),
            agent_id=agent_id,
            # Pool lease per-run : si activé via la config Jarvis, chaque
            # run prend une clé Gemini distincte (load-min) pour éviter
            # que 2 runs parallèles se battent sur le même quota PerMin.
            # Le run_id est l'UUID interne du bg-run (cf. _new_run).
            pool_active=bool(p.get("pool_active", False)),
            run_id=run.get("run_id"),
            output_ext=_spec.get("output_ext"),
            canonical_mode=_spec.get("canonical_mode"),
        )
        try:
            from jdm_agent.enrich import count_consolidations, list_consolidations
        except ImportError:
            count_consolidations = lambda: 0
            list_consolidations = lambda: []
        cancelled = False
        # Cache le dernier filePath non-null vu — beaucoup de yields
        # dans jarvis.py utilisent `last_file_path` (None tant que le LLM
        # n'a pas appelé write_submission_file). Pour ENRICH auto_append
        # le LLM ne l'appelle jamais → fpath toujours None dans certains
        # chunks. On garde la dernière valeur connue pour que le
        # frontend voit le canonical_path dès qu'au moins UN chunk l'a
        # exposé (typiquement via _current_file_path() qui le retourne
        # une fois le file matérialisé sur disque).
        last_known_fpath = None
        for chunk in sync_gen:
            # Cooperative cancellation : check le flag entre chaque chunk.
            # Le chunk LLM en cours s'est déjà terminé (on l'a payé), mais
            # on n'en démarre pas de nouveau. Latence d'arrêt ≈ 5-15s.
            if run.get("cancel_requested"):
                _push_event(run, "cancelled", {
                    "text": "Flow annulé par l'utilisateur.",
                })
                cancelled = True
                # Ferme proprement le générateur sync — déclenche les
                # `finally` (exclusion_context exit, etc.).
                try:
                    sync_gen.close()
                except Exception:
                    pass
                break
            if not isinstance(chunk, tuple):
                continue
            messages = chunk[0] if len(chunk) >= 1 else None
            fpath = chunk[1] if len(chunk) >= 2 else None
            if fpath:
                last_known_fpath = str(fpath)
            fpreview = chunk[2] if len(chunk) >= 3 else None
            state = chunk[3] if len(chunk) >= 4 else None
            msgs_clean = []
            if isinstance(messages, list):
                for m in messages:
                    if isinstance(m, dict):
                        msgs_clean.append({
                            "role": m.get("role", ""),
                            "content": m.get("content", ""),
                        })
            try:
                # Filtre anti-contamination : ne garde que les triplets
                # AJOUTÉS depuis le start de CE run (clés absentes du
                # snapshot initial). Les compteurs cc/produced suivent
                # cette même restriction pour rester cohérents avec
                # ce que l'UI affiche.
                from jdm_agent.enrich.validators import _norm_consolidation_key as _nck
                all_consolidated = list_consolidations() or []
                initial_keys = run.get("initial_consolidation_keys") or set()
                consolidated = [
                    c for c in all_consolidated
                    if _nck(c.get("term") or "",
                            c.get("relation") or "",
                            c.get("target") or "") not in initial_keys
                ]
                cc = len(consolidated)
            except Exception:
                cc = 0
                consolidated = []
            text_chars = sum(len(m.get("content", "") or "") for m in msgs_clean)
            tokens_estimate = text_chars // 4
            # Stats serveur (pour le chat mascotte + persistance) : on
            # parse la narration cumulative (data-tool) du message
            # assistant pour compter tentatives / outils, et on reprend
            # cc (retenus) + tokens. Stocké sur le run, écrasé à chaque
            # chunk (la narration est cumulative donc le dernier gagne).
            run["stats"] = _compute_run_stats(msgs_clean, cc, tokens_estimate,
                                              last_known_fpath)
            _push_event(run, "jarvis", {
                "messages": msgs_clean,
                # Sticky : envoie la dernière valeur connue (cf. note plus
                # haut sur la non-uniformité des yields dans jarvis.py).
                "file_path": last_known_fpath,
                "file_preview": fpreview if isinstance(fpreview, str) else "",
                "state": state if isinstance(state, dict) else None,
                "consolidated_count": cc,
                "consolidated": consolidated[-50:],
                "tokens_estimate": tokens_estimate,
            })
        _push_event(run, "done", {})
        run["status"] = "done"
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        _push_event(run, "error", {"text": msg})
        run["status"] = "error"
        run["error_text"] = msg
    finally:
        run["finished_at"] = _time.time()
        # Persiste le run terminé dans le journal (.jarvis_runs.jsonl) pour
        # que la mascotte le voie même après un redémarrage serveur.
        try:
            _persist_run_record(run)
        except Exception:
            pass


# Regex narration (mêmes attributs que jarvis.py / computeFlowLive front).
_NARRATION_TOOL_RE = _re.compile(
    r'<div\s+class="jdm-narration"\s+data-tool="(\w+)"([^>]*)>')


def _compute_run_stats(msgs_clean: list, cc: int, tokens_estimate: int,
                       file_path) -> dict:
    """Calcule les stats d'un run depuis la narration cumulative.

    - attempts    : nb d'appels validate_candidate (= triplets tentés)
    - retained    : cc (items consolidés/retenus)
    - tokens      : estimation tokens
    - tools_count : nb total d'APPELS d'outils (hors retours data-result)
    - tools       : {nom_outil: nb_appels}
    Source = contenu du message assistant (porte les <div data-tool=...>).
    """
    narration = ""
    for m in msgs_clean:
        if m.get("role") == "assistant":
            narration = m.get("content", "") or ""
    tools: dict[str, int] = {}
    attempts = 0
    for mm in _NARRATION_TOOL_RE.finditer(narration):
        name, attrs = mm.group(1), mm.group(2) or ""
        if 'data-result="1"' in attrs:
            continue  # retour de tool, pas un appel
        tools[name] = tools.get(name, 0) + 1
        if name == "validate_candidate":
            attempts += 1
    return {
        "attempts": attempts,
        "retained": cc,
        "tokens": tokens_estimate,
        "tools_count": sum(tools.values()),
        "tools": tools,
        "file": str(file_path) if file_path else None,
    }


def _persist_run_record(run: dict) -> None:
    """Sérialise un run terminé en une ligne du journal mascotte."""
    _jchat_persist.append_run_record({
        "run_id": run.get("run_id"),
        "agent_id": run.get("agent_id"),
        "status": run.get("status"),
        "headline": run.get("headline"),
        "started_at": run.get("started_at"),
        "finished_at": run.get("finished_at"),
        "last_file_path": run.get("stats", {}).get("file"),
        "stats": run.get("stats", {}),
        "error_text": run.get("error_text"),
    })


async def _stream_run_events(run: dict):
    """Async generator qui yield les events d'un run, en mode catch-up
    (replay du buffer existant) PUIS live (attente sur subscriber.set()).
    Sort quand le run est terminé ET que le buffer a été drainé."""
    cursor = 0
    while True:
        # Drain ce qui est nouveau dans le buffer
        while cursor < len(run["events"]):
            yield run["events"][cursor]
            cursor += 1
        # Terminé + buffer vidé → fin du stream
        if run["status"] in ("done", "error") and cursor >= len(run["events"]):
            break
        # Attend une notification d'event nouveau (ou un timeout pour
        # envoyer un keepalive et vérifier le statut).
        evt = _asyncio.Event()
        run["subscribers"].add(evt)
        try:
            await _asyncio.wait_for(evt.wait(), timeout=20)
        except _asyncio.TimeoutError:
            # Keepalive : commentaire SSE (pas un event nommé pour ne pas
            # polluer le dispatch côté client)
            yield {"event": "ping", "data": "{}"}
        finally:
            run["subscribers"].discard(evt)


async def _cleanup_old_runs_loop():
    """Tâche d'arrière-plan qui purge les runs terminés (done/error)
    depuis plus de _JARVIS_RUN_TTL secondes. Tourne tous les 10 min."""
    while True:
        await _asyncio.sleep(600)
        now = _time.time()
        to_drop = []
        with _JARVIS_RUNS_LOCK:
            for rid, r in _JARVIS_RUNS.items():
                if r["status"] in ("done", "error"):
                    ft = r.get("finished_at") or now
                    if (now - ft) > _JARVIS_RUN_TTL:
                        to_drop.append(rid)
            for rid in to_drop:
                _JARVIS_RUNS.pop(rid, None)


def _runs_snapshot_for_chat() -> list[dict]:
    """Snapshot SÉRIALISABLE des runs vivants pour les outils de la
    mascotte (pas de subscribers/loop/events bruts). Provider injecté
    dans jarvis_chat.runtime."""
    with _JARVIS_RUNS_LOCK:
        out = []
        for r in _JARVIS_RUNS.values():
            out.append({
                "run_id": r.get("run_id"),
                "agent_id": r.get("agent_id"),
                "status": r.get("status"),
                "headline": r.get("headline"),
                "started_at": r.get("started_at"),
                "finished_at": r.get("finished_at"),
                "stats": r.get("stats") or {},
                "last_file_path": (r.get("stats") or {}).get("file"),
                "error_text": r.get("error_text"),
            })
        return out


def _default_agent_params(agent_id: str, cfg: dict | None) -> dict:
    """Défauts canoniques d'un flux pour un lancement AUTONOME (mascotte /
    serveur). Miroir DÉTERMINISTE de `defaultParamsFor` côté front
    (views-jarvis.jsx) : c'est ce qui porte TOUTE la mécanique du flux —
    `target_count` (relance/itération vers la cible), `vary_relations`,
    `iterate`, `top_k`, soumission auto… Sans ça, un flux lancé hors UI
    tournerait « à nu » (un seul passage, pas de relance). On garde une
    SEULE source de vérité conceptuelle : les mêmes clés/valeurs que le
    formulaire, donc un run mascotte se comporte exactement comme un run UI.

    Différence ASSUMÉE avec l'UI : `auto_switch=True`. Un run serveur doit
    être 100% autonome — sur quota PerDay il bascule silencieusement sur le
    modèle protégé et CONTINUE, au lieu d'aborter en attendant un clic
    « Continuer » (mode B de l'UI). « On ne doit jamais cliquer. »
    """
    cfg = cfg or {}
    llm = cfg.get("llm")
    pool_active = cfg.get("poolActive") is not False  # défaut True (comme l'UI)
    is_gemini = isinstance(llm, str) and llm.startswith("gemini")
    model = ("gemini-3.1-flash-lite"
             if (pool_active and not is_gemini)
             else (llm or "gemini-3.1-flash-lite"))
    temp = cfg.get("temperature")
    temperature = temp if isinstance(temp, (int, float)) else None
    auto_upload = cfg.get("autoSubmit") is True
    common = {
        "model": model, "api_key": "", "drops_key": "",
        "use_thinking": True, "budget_label": "illimité",
        "auto_switch": True,           # autonomie serveur (cf. docstring)
        "temperature": temperature, "pool_active": pool_active,
        "term": "",                    # vide → tirage hasard via pick_random_term
    }
    # UN SEUL chemin (natif ET sur mesure) : common + defaults du spec
    # (target_count/vary_relations/iterate/top_k…, repris des anciennes branches
    # natives) + upload si l'agent écrit. Aucun id codé en dur.
    try:
        from jdm_agent.jarvis_chat import inventory as _inv
        spec = _inv.get_agent_spec(agent_id) or {}
    except Exception:
        spec = {}
    out = {**common, "relation": []}
    d = spec.get("defaults") or {}
    out.update(d)
    if spec.get("writes"):
        # Case « Soumettre automatiquement » (defaults.upload) prime ; sinon le
        # réglage global autoSubmit.
        out["upload"] = bool(d["upload"]) if isinstance(d.get("upload"), bool) else auto_upload
    return out


def _chat_start_agent(agent_id: str, params: dict) -> dict:
    """Démarre un flux Jarvis en bg (même machinerie que l'endpoint
    /api/jarvis/{agent_id}/stream) pour le compte de la mascotte. Renvoie
    {run_id, headline}. Lève via retour {error} si flow inconnu.

    CLÉ : on part des défauts canoniques complets (`_default_agent_params`)
    pour que le flux soit STRICTEMENT identique à un lancement UI (même
    pré-prompt enrichi par target_count/relations, même relance/itération),
    puis on superpose UNIQUEMENT les valeurs réellement fournies par la
    mascotte (typiquement `term`). Les None sont ignorés pour ne pas écraser
    un défaut par un vide.
    """
    cfg = _jchat_rt.get_config_snapshot()
    base = _default_agent_params(agent_id, cfg)
    overrides = {k: v for k, v in (params or {}).items() if v is not None}
    p = {**base, **overrides}
    try:
        _prompt, headline = _jarvis_dispatch(agent_id, p)
    except ValueError as e:
        return {"error": str(e)}
    run = _new_run(agent_id, p, headline, origin="chat")
    _threading.Thread(
        target=_drive_jarvis_agent_thread, args=(run,), daemon=True,
        name=f"jarvis-run-{run['run_id']}",
    ).start()
    return {"run_id": run["run_id"], "headline": headline}


def _chat_stop_agent(run_id: str) -> dict:
    """Annulation coopérative d'un run (même logique que l'endpoint cancel)."""
    with _JARVIS_RUNS_LOCK:
        run = _JARVIS_RUNS.get(run_id)
    if run is None:
        return {"error": f"run_id inconnu : {run_id}"}
    if run["status"] in ("done", "error"):
        return {"ok": True, "status": run["status"], "note": "déjà terminé"}
    run["cancel_requested"] = True
    return {"ok": True, "status": run["status"], "note": "arrêt demandé (effet ~5-15s)"}


@app.on_event("startup")
async def _start_jarvis_cleanup_task():
    # Capture la loop principale (le startup tourne dedans) pour que les
    # runs démarrés en thread worker (tool start_agent) aient un loop valide.
    global _MAIN_LOOP
    _MAIN_LOOP = _asyncio.get_running_loop()
    _asyncio.create_task(_cleanup_old_runs_loop())
    # Applique l'overlay d'environnement persisté (clés API modifiées via
    # le chat mascotte) — fait au boot pour que les modifs survivent à un
    # redémarrage serveur.
    try:
        applied = _jchat_persist.apply_env_overlay()
        if applied:
            print(f"[jarvis_chat] overlay env appliqué : {applied}")
    except Exception as e:
        print(f"[jarvis_chat] overlay env échec : {e}")
    # Câble le provider de runs vivants pour les outils de la mascotte.
    # L'historique persisté (.jarvis_runs.jsonl) est lu indépendamment par
    # les outils (jarvis_chat.tools._merged_runs fusionne vivant + journal),
    # donc on ne réinjecte PAS les vieux runs dans _JARVIS_RUNS (éviterait
    # de ressusciter de vieux runs dans la vue live des cartes de supervision).
    _jchat_rt.set_runs_provider(_runs_snapshot_for_chat)
    # Câble le contrôleur de flux : la mascotte peut lancer/arrêter des flux.
    _jchat_rt.set_agent_controller(_chat_start_agent, _chat_stop_agent)


@app.get("/api/jarvis/runs")
def api_jarvis_list_runs():
    """Liste les runs connus (actifs + terminés < TTL). Sert au boot
    client pour reconnecter aux runs encore vivants (filtre status==running)."""
    with _JARVIS_RUNS_LOCK:
        return {
            "runs": [
                {
                    "run_id": r["run_id"],
                    "agent_id": r["agent_id"],
                    "status": r["status"],
                    "headline": r["headline"],
                    "started_at": r["started_at"],
                    "finished_at": r.get("finished_at"),
                    "stats": r.get("stats") or {},
                    "origin": r.get("origin", "ui"),
                    # Cible réelle du run (pour la barre de progression côté
                    # client — sinon elle retombe sur le défaut du flux).
                    "target_count": (r.get("params") or {}).get("target_count"),
                }
                for r in _JARVIS_RUNS.values()
            ]
        }


# ────────────────────────────────────────────────────────────────────
# Inventaire des agents (natifs + sur mesure) — CRUD
# ────────────────────────────────────────────────────────────────────
@app.get("/api/jarvis/agents")
def api_jarvis_list_agents() -> dict[str, Any]:
    """Tous les agents de l'inventaire (6 natifs + sur mesure persistés)."""
    from jdm_agent.jarvis_chat import inventory as _inv
    return {"agents": _inv.list_agent_specs(), "templates": _inv.AGENT_TEMPLATES}


class AgentSpecRequest(BaseModel):
    spec: dict


@app.post("/api/jarvis/agents")
def api_jarvis_save_agent(req: AgentSpecRequest) -> dict[str, Any]:
    """Crée / écrase un agent SUR MESURE (refuse d'écraser un natif)."""
    from jdm_agent.jarvis_chat import inventory as _inv
    try:
        saved = _inv.save_agent_spec(req.spec or {})
        return {"ok": True, "spec": saved}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


class AgentGenerateRequest(BaseModel):
    spec: dict
    config: dict | None = None


@app.post("/api/jarvis/agents/generate")
def api_jarvis_generate_workflow(req: AgentGenerateRequest) -> dict[str, Any]:
    """Fait GÉNÉRER par L'ORCHESTRATEUR (le MÊME agent que la mascotte chat —
    build_jarvis_chat_agent) le WORKFLOW de l'agent spécialiste « à la manière
    des *_workflow » à partir des instructions de l'utilisateur.

    C'est cette sortie (le workflow rédigé par l'orchestrateur) qui devient le
    system_prompt de l'agent et qu'on montre à l'assemblage. Le méta-prompt
    déterministe (build_workflow_generation_prompt) n'est qu'une aide. On ne crée
    PAS un LLM ad hoc : on passe par l'orchestrateur déjà en place."""
    from jdm_agent.jarvis_chat import inventory as _inv
    from jdm_agent.jarvis_chat.agent import build_jarvis_chat_agent
    from langchain_core.messages import HumanMessage
    from jarvis import _content_to_text
    cfg = req.config or {}
    spec = req.spec or {}
    meta = _inv.build_workflow_generation_prompt(spec)
    _fallback = (spec.get("instructions") or spec.get("system_prompt") or "")
    # Résolution modèle + clé pool IDENTIQUE au chat de la mascotte.
    llm_name = cfg.get("llm") or "gemini-3.1-flash-lite"
    pool_active = cfg.get("poolActive") is not False
    is_gemini = isinstance(llm_name, str) and llm_name.startswith("gemini")
    model = ("gemini-3.1-flash-lite" if (pool_active and not is_gemini) else llm_name)
    lease_id = "gen-" + _uuid.uuid4().hex[:8]
    gem_key = None
    try:
        if str(model).startswith("gemini-") and pool_active:
            from jdm_agent.pool_lease import acquire_key as _acq
            gem_key = _acq(model, lease_id, _app)
    except Exception:
        gem_key = None
    def _invoke(agent, prompt_text):
        out = agent.invoke({"messages": [HumanMessage(content=prompt_text)]})
        msgs = out.get("messages") if isinstance(out, dict) else None
        raw = msgs[-1].content if msgs else ""
        return (_content_to_text(raw) or "").strip()

    try:
        llm = _app._build_llm(model, cfg.get("api_key") or "", use_thinking=False,
                              gemini_key_override=gem_key)
        agent = build_jarvis_chat_agent(client=get_client(), llm=llm)
        # APPEL 1 — workflow FONCTIONNEL (+ OUTILS). Rien d'autre.
        full = _invoke(agent, meta)
        if not full:
            return {"ok": False, "error": "génération vide", "fallback": _fallback}
        workflow, _b0, tools, _s0, _ic0 = _inv.parse_generation_output(full)
        sel = _inv.selectable_tool_names()
        tools = [t for t in tools if t in sel] if sel else tools
        # APPEL 2 — SÉPARÉ : éléments d'AFFICHAGE (résumé + description + ICÔNE) à
        # partir du workflow. Isolé → aucune pollution conversationnelle.
        # `usedIcons` (fourni par le front : natifs + sur mesure) → exclusion pour
        # que le LLM choisisse un emoji DISTINCT.
        used_icons = [str(x) for x in (cfg.get("usedIcons") or []) if x]
        brief, steps, icon = "", [], ""
        try:
            card = _invoke(agent, _inv.build_card_meta_prompt(spec, workflow, used_icons))
            _w, brief, _t, steps, icon = _inv.parse_generation_output(card)
        except Exception:
            pass
        # NB : tool_steps (mapping outil→étape) n'est PAS produit ici. Il est
        # affecté au SITE UNIQUE save_agent_spec, à l'enregistrement, par un appel
        # LLM dédié — sans régénérer le workflow, et seulement si workflow/étapes/
        # outils ont changé.
        return {"ok": True, "workflow": workflow, "brief": brief, "tools": tools,
                "steps": steps, "icon": icon, "meta_prompt": meta}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "fallback": _fallback}
    finally:
        if gem_key:
            try:
                from jdm_agent.pool_lease import release_key as _rel
                _rel(lease_id, _app)
            except Exception:
                pass


def _tool_steps_invoke(prompt_text: str) -> str:
    """Invocateur LLM DÉDIÉ pour l'affectation outil→étape, enregistré sur
    inventory et appelé au SITE UNIQUE save_agent_spec (UI ET outil chat). Bâtit
    un orchestrateur par défaut (pool Gemini), invoque, libère le lease. Ne
    régénère JAMAIS le workflow (le prompt ne demande qu'un mapping JSON)."""
    from jdm_agent.jarvis_chat.agent import build_jarvis_chat_agent
    from langchain_core.messages import HumanMessage
    from jarvis import _content_to_text
    model = "gemini-3.1-flash-lite"
    lease_id = "tsteps-" + _uuid.uuid4().hex[:8]
    gem_key = None
    try:
        try:
            from jdm_agent.pool_lease import acquire_key as _acq
            gem_key = _acq(model, lease_id, _app)
        except Exception:
            gem_key = None
        llm = _app._build_llm(model, "", use_thinking=False, gemini_key_override=gem_key)
        agent = build_jarvis_chat_agent(client=get_client(), llm=llm)
        out = agent.invoke({"messages": [HumanMessage(content=prompt_text)]})
        msgs = out.get("messages") if isinstance(out, dict) else None
        raw = msgs[-1].content if msgs else ""
        return (_content_to_text(raw) or "").strip()
    finally:
        if gem_key:
            try:
                from jdm_agent.pool_lease import release_key as _rel
                _rel(lease_id, _app)
            except Exception:
                pass


# Enregistre l'invocateur sur l'inventaire (SITE UNIQUE save_agent_spec l'utilise).
try:
    from jdm_agent.jarvis_chat import inventory as _inv_reg
    _inv_reg.set_tool_steps_invoker(_tool_steps_invoke)
except Exception:
    pass


@app.post("/api/jarvis/agents/preview")
def api_jarvis_preview_agent(req: AgentSpecRequest) -> dict[str, Any]:
    """Renvoie le PRÉ-PROMPT réellement assemblé (squelette déterministe +
    stratégie + cadrage format/params) pour un spec donné — sans persister.
    Sert l'aperçu « voir le vrai prompt » dans la confirmation du builder."""
    from jdm_agent.jarvis_chat import inventory as _inv
    try:
        spec = _inv._normalize_spec(req.spec or {})
        d = spec.get("defaults") or {}
        params = {"term": "", "relation": [],
                  "target_count": int(d.get("target_count") or 0),
                  "budget_label": "illimité",
                  "upload": False}
        preprompt = _inv.build_preprompt_for_spec(spec, params)
        return {"ok": True, "preprompt": preprompt, "spec": spec}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@app.delete("/api/jarvis/agents/{agent_id}")
def api_jarvis_delete_agent(agent_id: str) -> dict[str, Any]:
    """Supprime un agent SUR MESURE de l'inventaire."""
    from jdm_agent.jarvis_chat import inventory as _inv
    ok = _inv.delete_agent_spec(agent_id)
    return {"ok": ok, "error": None if ok else "Agent introuvable ou natif (non supprimable)."}


# Catalogue d'outils mis en cache au premier hit — l'introspection
# LangChain coûte ~50ms (39 tools, docstrings parsées) ; le résultat
# est strictement statique pour la durée du process, donc cache infini.
_TOOLS_CATALOG_CACHE: Optional[list[dict]] = None


def _build_tools_catalog() -> list[dict]:
    """Introspecte les @tool LangChain de build_jdm_tools() + workflows.

    Renvoie : [{name, description, kind, signature, args, returns, examples}]
    - kind dérivé du nom : workflow → 'workflow', verify_claim/infer → 'logique',
      exists/get_* → 'API JDM', write_submission_file/submit_to_jdm → 'IO',
      defaut → 'LLM'.
    - args dérivés de args_schema (Pydantic) : {name, type, required, desc}.
    """
    from jdm_agent.tools.jdm_tools import build_jdm_tools

    def _kind(name: str) -> str:
        if name.endswith("_workflow"):
            return "workflow"
        if name in {"verify_claim", "infer", "validate_candidate",
                    "consolidate_candidate"}:
            return "logique"
        if name.startswith("get_") or name in {
            "exists", "pick_random_term", "disambiguate", "list_relation_types",
            "list_existing_for_enrichment", "describe_relation",
            "detect_gaps",
        }:
            return "API JDM"
        if name in {"write_submission_file", "submit_to_jdm"}:
            return "IO"
        return "outil"

    def _args(schema) -> list[dict]:
        if not schema:
            return []
        try:
            # Pydantic v2 : model_fields ; v1 : __fields__
            fields = getattr(schema, "model_fields", None) or {}
            if not fields:
                fields = getattr(schema, "__fields__", None) or {}
            out = []
            for fname, finfo in fields.items():
                # v2 FieldInfo : .annotation, .is_required(), .description
                anno = getattr(finfo, "annotation", None)
                tname = getattr(anno, "__name__", str(anno)) if anno else "any"
                desc = getattr(finfo, "description", None) or ""
                req = True
                if hasattr(finfo, "is_required"):
                    try:
                        req = bool(finfo.is_required())
                    except Exception:
                        pass
                out.append({
                    "name": fname,
                    "type": tname,
                    "required": req,
                    "desc": desc,
                })
            return out
        except Exception:
            return []

    tools = build_jdm_tools()
    catalog = []
    for t in tools:
        name = t.name
        desc = (t.description or "").strip()
        catalog.append({
            "name": name,
            "kind": _kind(name),
            "description": desc,
            "docstring": desc,  # même contenu : LangChain prend la docstring
            "signature": f"{name}({', '.join(a['name'] for a in _args(t.args_schema))})",
            "args": _args(t.args_schema),
        })
    return catalog


@app.get("/api/jarvis/models")
def api_jarvis_models():
    """Catalogue des modèles LLM utilisables par l'agent Jarvis.

    Source de vérité : `app.GEMINI_MODELS` (et `GEMINI_THINKING_SUPPORTED`
    pour annoter quels modèles supportent le raisonnement). Le front
    utilise ça pour peupler le sélecteur de modèle dans `JConfigPanel`
    et dans `ParamsForm` — fini les listes codées en dur dans le JS.
    """
    try:
        from app import (
            GEMINI_MODELS,
            GEMINI_THINKING_SUPPORTED,
            GEMINI_POOL_PROTECTED_MODEL,
        )
    except Exception as e:
        return {"models": [], "default": None, "error": str(e)}
    models = []
    for k, label in GEMINI_MODELS.items():
        models.append({
            "value": k,
            "label": label,
            "supports_thinking": k in GEMINI_THINKING_SUPPORTED,
            "pool_protected": k == GEMINI_POOL_PROTECTED_MODEL,
        })
    return {
        "models": models,
        "default": GEMINI_POOL_PROTECTED_MODEL,
        "count": len(models),
    }


@app.get("/api/jarvis/tools")
def api_jarvis_tools():
    """Catalogue introspecté du registre LangChain de l'agent JDM.

    Sert à alimenter `JToolDialog` (panneau de détail outil) côté
    frontend Jarvis. Une fiche par tool : description, kind, signature,
    args (depuis les schémas Pydantic).

    Résultat caché en mémoire process (statique pour la durée du run).
    """
    global _TOOLS_CATALOG_CACHE
    if _TOOLS_CATALOG_CACHE is None:
        _TOOLS_CATALOG_CACHE = _build_tools_catalog()
    return {"tools": _TOOLS_CATALOG_CACHE, "count": len(_TOOLS_CATALOG_CACHE)}


@app.post("/api/jarvis/runs/{run_id}/cancel")
def api_jarvis_cancel_run(run_id: str):
    """Demande l'arrêt cooperative d'un run en cours. Pose un flag que
    le bg thread voit entre deux chunks et déclenche `sync_gen.close()`
    → `finally` blocs propres (exclusion_context exit, etc.).

    Idempotent : si le run est déjà terminé (done/error), no-op + 200.
    Si run_id inconnu (typo ou TTL dépassé), 404.

    Latence d'arrêt ≈ temps d'un round-trip LLM en cours (5-15s) —
    on ne peut pas interrompre du code sync Python proprement depuis
    un autre thread sans corrompre les locks/registries (cf. note
    archi en tête de section)."""
    with _JARVIS_RUNS_LOCK:
        run = _JARVIS_RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run_id inconnu : {run_id}")
    if run["status"] in ("done", "error"):
        return {"ok": True, "status": run["status"], "note": "already terminated"}
    run["cancel_requested"] = True
    return {"ok": True, "status": run["status"], "note": "cancel requested"}


@app.post("/api/jarvis/runs/clear")
def api_jarvis_clear_runs():
    """Purge IMMÉDIATE des runs terminés (done/error) du registre mémoire —
    déclenchée par le bouton « Effacer » du séparateur « Terminés » de la
    Supervision. N'efface PAS les runs actifs (running/starting), ni le
    journal persistant .jarvis_runs.jsonl (= historique Productions). Le
    client re-poll /api/jarvis/runs et les cartes terminées disparaissent."""
    dropped = 0
    with _JARVIS_RUNS_LOCK:
        to_drop = [rid for rid, r in _JARVIS_RUNS.items()
                   if r.get("status") in ("done", "error")]
        for rid in to_drop:
            _JARVIS_RUNS.pop(rid, None)
            dropped += 1
    return {"ok": True, "dropped": dropped}


@app.get("/api/jarvis/runs/{run_id}/stream")
async def api_jarvis_stream_existing_run(run_id: str):
    """Re-stream un run existant (catch-up depuis le début du buffer
    + live). Utilisé après une reconnexion (tab refermée puis rouverte,
    ou navigation interne).

    Si le run n'existe pas (typo ou TTL dépassé), 404.
    Si le run est déjà terminé, on yield tous les events bufferés puis
    EOF — le client voit le résultat final."""
    with _JARVIS_RUNS_LOCK:
        run = _JARVIS_RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run_id inconnu : {run_id}")
    return EventSourceResponse(_stream_run_events(run))


@app.post("/api/jarvis/{agent_id}/stream")
async def api_jarvis_stream(agent_id: str, req: JarvisRequest):
    """Lance un flux Jarvis EN ARRIÈRE-PLAN et retourne un SSE qui
    observe son buffer d'events. Le flow est exécuté dans un thread
    indépendant du cycle de vie HTTP : si le client ferme la tab,
    l'observation s'arrête mais LE FLOW CONTINUE. Pour re-observer
    ensuite, GET /api/jarvis/runs/{run_id}/stream avec le run_id
    retourné dans le PREMIER event de cette stream :

        event: run_id
        data: {"run_id": "abc123"}

    Le client le persiste en localStorage et peut s'y rebrancher
    après refresh, navigation, tab close+rouverte, etc.

    Events SSE émis :
      event: run_id    data: {"run_id": "..."}       ← NOUVEAU
      event: headline  data: {"text": "...", "agent_id": "...", "run_id": "..."}
      event: jarvis    data: {"messages": [...], ...}
      event: done      data: {}
      event: error     data: {"text": "..."}
      event: ping      data: {}                       ← keepalive idle 20s
    """
    p = req.params or {}
    # NB: la pre-resolution silencieuse de term (1c20bea) est retiree.
    # Strategie outil-driven : si term est vide, le LLM appelle l'outil
    # dedie `pick_random_term()` (cf. jdm_tools.py + system prompt regle
    # 14). C'est l'agent qui orchestre, le backend ne triche plus en
    # injectant un terme sans le dire. La methode JDMClient.random_term()
    # reste utilisee — mais a travers l'outil, donc visible au LLM dans
    # la narration.

    # 1) Build prompt + headline (validation précoce, error inline)
    try:
        prompt, headline = _jarvis_dispatch(agent_id, p)
    except ValueError as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": str(e)})}
        return EventSourceResponse(err_gen())

    # 2) Crée le run + spawn le bg thread
    run = _new_run(agent_id, p, headline)
    _threading.Thread(
        target=_drive_jarvis_agent_thread,
        args=(run,),
        daemon=True,
        name=f"jarvis-run-{run['run_id']}",
    ).start()

    # 3) Stream depuis le buffer du run. Insère un event run_id en tête
    # pour que le client puisse le persister.
    async def gen_with_runid():
        yield {
            "event": "run_id",
            "data": json.dumps({"run_id": run["run_id"]}, ensure_ascii=False),
        }
        async for ev in _stream_run_events(run):
            yield ev
    return EventSourceResponse(gen_with_runid())




# ────────────────────────────────────────────────────────────────────
# Pool Gemini — délègue à app.py (état partagé, persistance disque)
# ────────────────────────────────────────────────────────────────────
def _today_utc() -> str:
    # Même format que app._today_utc_str
    import datetime as _dt
    return _dt.datetime.utcnow().strftime("%Y-%m-%d")


@app.get("/api/pool/status")
def api_pool_status() -> dict[str, Any]:
    """État détaillé du pool Gemini : pour chaque clé, son status par
    modèle aujourd'hui (blown ou non), invalidation globale, clé +
    modèle courants.

    Structure :
        {
          "keys": [
             {"masked": "AIza…1234", "is_current": bool, "invalid": bool,
              "blown_by_model": {"gemini-3.1-flash-lite": bool, ...}},
             ...
          ],
          "current_model": "gemini-3.1-flash-lite" | null,
          "current_key_masked": "AIza…1234" | null,
          "models": ["gemini-3.1-flash-lite", ...],
        }
    """
    keys = _app._parse_google_keys()
    current_key = _app._CURRENT_GEMINI_KEY
    current_model = _app._CURRENT_MODEL
    today = _today_utc()
    models = list(_app.GEMINI_MODELS.keys())
    out_keys = []
    for i, k in enumerate(keys):
        out_keys.append({
            # On n'envoie PAS le préfixe/suffixe — un attaquant pourrait
            # corréler avec d'autres fuites. Juste l'index 1-based.
            "index": i + 1,
            "is_current": (k == current_key),
            "invalid": (k in _app._INVALID_KEYS),
            "blown_by_model": {
                m: bool(_app._BLOWN_TODAY.get((k, m, today), False))
                for m in models
            },
        })
    return {
        "keys": out_keys,
        "current_model": current_model,
        "models": models,
    }


class RotateRequest(BaseModel):
    # Modèle pour lequel on cherche une clé non-épuisée (sinon prend
    # le modèle courant de la session).
    model: Optional[str] = None
    skip_current: bool = True


@app.post("/api/pool/rotate")
def api_pool_rotate(req: RotateRequest = RotateRequest()) -> dict[str, Any]:
    """Pick la prochaine clé non-épuisée pour le modèle donné et la
    déclare comme courante (persiste sur disque via app._save_pool_state).
    """
    model = (req.model or _app._CURRENT_MODEL or "gemini-3.1-flash-lite")
    skip = _app._CURRENT_GEMINI_KEY if req.skip_current else None
    new_key = _app.pick_unblown_gemini_key(model, skip=skip)
    if not new_key:
        # Pool entièrement épuisé pour ce modèle aujourd'hui → renvoie
        # quand même la 1ère clé du pool (utile pour reset visuel).
        pool = _app._parse_google_keys()
        if not pool:
            raise HTTPException(400, "Pool Gemini vide : configure GOOGLE_API_KEYS ou GOOGLE_API_KEY.")
        new_key = pool[0]
    _app.set_current_gemini_key(new_key)
    return api_pool_status()


# Health check pour HF Spaces
@app.get("/health")
def health():
    return {"status": "ok"}


# ────────────────────────────────────────────────────────────────────
# Env keys status — quels secrets sont présents en env vars côté serveur
# ────────────────────────────────────────────────────────────────────
# Permet au front de savoir SI une clé est configurée (sans la révéler),
# pour dégriser le bouton "Soumettre" / la case "Soumettre auto" même
# quand le champ d'input est vide. Le backend utilisera l'env si le
# champ est vide.
@app.get("/api/env-status")
def api_env_status():
    """Renvoie pour chaque clé d'env utilisée par l'app : `{set: bool}`.
    Ne révèle JAMAIS la valeur — juste sa présence/absence."""
    keys = [
        "JDM_DROPS_API_KEY",  # soumission LLMDrops
        "ANTHROPIC_API_KEY",  # Claude BYOK
        "OPENAI_API_KEY",     # GPT BYOK
        # Pool Gemini : on regarde GOOGLE_API_KEY simple OU GOOGLE_API_KEYS
        # (CSV multi-clés). Présent si au moins une est non vide.
    ]
    status = {}
    for k in keys:
        v = os.environ.get(k, "").strip()
        status[k] = {"set": bool(v)}
    gemini_set = (
        bool(os.environ.get("GOOGLE_API_KEY", "").strip())
        or any(
            bool(x.strip())
            for x in os.environ.get("GOOGLE_API_KEYS", "").split(",")
        )
    )
    status["GOOGLE_API_KEY"] = {"set": gemini_set}
    return {"env": status}


# ────────────────────────────────────────────────────────────────────
# Productions — liste / download / submit / delete (port app.py)
# ────────────────────────────────────────────────────────────────────
PRODUCTIONS_DIR = Path("/tmp/jdm_outputs")
PRODUCTIONS_DIR.mkdir(parents=True, exist_ok=True)
PRODUCTIONS_OLDIES_DIR = PRODUCTIONS_DIR / "oldies"
PRODUCTIONS_SUBMITTED_FILE = PRODUCTIONS_DIR / ".submitted.json"
PRODUCTIONS_OLDIES_THRESHOLD_SEC = 48 * 3600  # 48h


def _load_submitted_set() -> set:
    """Charge l'ensemble des noms de fichiers déjà soumis (cf. app.py)."""
    if not PRODUCTIONS_SUBMITTED_FILE.exists():
        return set()
    try:
        data = json.loads(PRODUCTIONS_SUBMITTED_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return set(data.keys())
        if isinstance(data, list):
            return set(data)
    except Exception:
        pass
    return set()


def _mark_submitted(filename: str) -> None:
    """Ajoute filename au registre des fichiers soumis (persiste)."""
    import time as _t
    try:
        current: dict = {}
        if PRODUCTIONS_SUBMITTED_FILE.exists():
            try:
                current = json.loads(PRODUCTIONS_SUBMITTED_FILE.read_text(encoding="utf-8"))
                if not isinstance(current, dict):
                    current = {}
            except Exception:
                current = {}
        current[filename] = _t.time()
        PRODUCTIONS_DIR.mkdir(exist_ok=True)
        PRODUCTIONS_SUBMITTED_FILE.write_text(
            json.dumps(current, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def _move_old_to_oldies() -> None:
    """Déplace les fichiers du root PRODUCTIONS_DIR plus vieux que 48h
    vers PRODUCTIONS_DIR/oldies/. Idempotent."""
    import time as _t
    if not PRODUCTIONS_DIR.exists():
        return
    now = _t.time()
    PRODUCTIONS_OLDIES_DIR.mkdir(exist_ok=True)
    for p in PRODUCTIONS_DIR.iterdir():
        if not p.is_file() or p.name.startswith("."):
            continue
        try:
            age = now - p.stat().st_mtime
            if age >= PRODUCTIONS_OLDIES_THRESHOLD_SEC:
                dst = PRODUCTIONS_OLDIES_DIR / p.name
                if dst.exists():
                    dst = PRODUCTIONS_OLDIES_DIR / f"{int(p.stat().st_mtime)}_{p.name}"
                p.rename(dst)
        except OSError:
            continue


def _file_meta(p: Path, submitted_set: set) -> dict:
    import time as _t
    st = p.stat()
    age = int(_t.time() - st.st_mtime)
    return {
        "name": p.name,
        "size": st.st_size,
        "mtime": st.st_mtime,
        "age_s": age,
        "submitted": p.name in submitted_set,
        # Hint d'extension pour l'UI
        "ext": p.suffix.lstrip(".").lower() or "txt",
    }


@app.get("/api/productions")
def api_productions_list() -> dict[str, Any]:
    """Liste les fichiers produits : `recent` (root) + `oldies` (archivés
    >48h). Lance auto-archive avant le scan.
    """
    _move_old_to_oldies()
    sub = _load_submitted_set()
    recent: list[dict] = []
    oldies: list[dict] = []
    if PRODUCTIONS_DIR.exists():
        for p in PRODUCTIONS_DIR.iterdir():
            if p.is_file() and not p.name.startswith("."):
                try:
                    recent.append(_file_meta(p, sub))
                except OSError:
                    pass
    if PRODUCTIONS_OLDIES_DIR.exists():
        for p in PRODUCTIONS_OLDIES_DIR.iterdir():
            if p.is_file():
                try:
                    oldies.append(_file_meta(p, sub))
                except OSError:
                    pass
    recent.sort(key=lambda f: -f["mtime"])
    oldies.sort(key=lambda f: -f["mtime"])
    return {"recent": recent, "oldies": oldies}


@app.get("/api/productions/file")
def api_productions_get(name: str, archived: bool = False):
    """Renvoie le CONTENU TEXTE d'un fichier de productions (preview).
    `name` est validé pour éviter le path traversal."""
    if not name or "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(400, "Nom de fichier invalide.")
    base = PRODUCTIONS_OLDIES_DIR if archived else PRODUCTIONS_DIR
    p = base / name
    if not p.exists() or not p.is_file():
        raise HTTPException(404, f"Fichier introuvable : {name}")
    try:
        content = p.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(500, f"Erreur lecture : {e}")
    return {"name": name, "content": content, "size": p.stat().st_size}


@app.get("/api/productions/download")
def api_productions_download(name: str, archived: bool = False):
    """Télécharge le fichier brut (Content-Disposition: attachment)."""
    if not name or "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(400, "Nom de fichier invalide.")
    base = PRODUCTIONS_OLDIES_DIR if archived else PRODUCTIONS_DIR
    p = base / name
    if not p.exists() or not p.is_file():
        raise HTTPException(404, f"Fichier introuvable : {name}")
    return FileResponse(str(p), filename=name,
                        media_type="application/octet-stream")


class ProductionsSubmitRequest(BaseModel):
    names: list[str]
    archived: bool = False
    api_key: str = ""  # override JDM_DROPS_API_KEY (optionnel)
    model_name: str = ""  # passé à submit_to_jdm pour le nom uploadé


@app.post("/api/productions/submit")
def api_productions_submit(req: ProductionsSubmitRequest) -> dict[str, Any]:
    """Soumet un ou plusieurs fichiers à LLMDrops. Marque chaque
    succès dans .submitted.json."""
    from jdm_agent.enrich.uploader import submit_to_jdm
    base = PRODUCTIONS_OLDIES_DIR if req.archived else PRODUCTIONS_DIR
    results = []
    for name in req.names:
        if not name or "/" in name or "\\" in name or name.startswith("."):
            results.append({"name": name, "ok": False, "error": "Nom invalide."})
            continue
        p = base / name
        if not p.exists() or not p.is_file():
            results.append({"name": name, "ok": False, "error": "Introuvable."})
            continue
        try:
            res = submit_to_jdm(
                p,
                api_key=req.api_key or None,
                model_name=req.model_name or None,
            )
            ok = bool(res.get("ok"))
            if ok:
                _mark_submitted(name)
            results.append({"name": name, **res})
        except Exception as e:
            results.append({"name": name, "ok": False,
                            "error": f"{type(e).__name__}: {e}"})
    return {"results": results}


class ProductionsDeleteRequest(BaseModel):
    names: list[str]
    archived: bool = False


@app.post("/api/productions/delete")
def api_productions_delete(req: ProductionsDeleteRequest) -> dict[str, Any]:
    """Supprime un ou plusieurs fichiers de productions. Réservé admin
    (le frontend gate via ?admin=1, mais ici on n'enforce pas — c'est
    de la donnée non sensible, juste des outputs locaux)."""
    base = PRODUCTIONS_OLDIES_DIR if req.archived else PRODUCTIONS_DIR
    results = []
    for name in req.names:
        if not name or "/" in name or "\\" in name or name.startswith("."):
            results.append({"name": name, "ok": False, "error": "Nom invalide."})
            continue
        p = base / name
        try:
            if p.exists() and p.is_file():
                p.unlink()
                results.append({"name": name, "ok": True})
            else:
                results.append({"name": name, "ok": False, "error": "Introuvable."})
        except OSError as e:
            results.append({"name": name, "ok": False, "error": str(e)})
    return {"results": results}


# ────────────────────────────────────────────────────────────────────
# Admin — export secrets (mot de passe EXPORT_SECRETS_PASSWORD)
# ────────────────────────────────────────────────────────────────────
class AdminAuthRequest(BaseModel):
    password: str


@app.post("/api/admin/auth")
def api_admin_auth(req: AdminAuthRequest) -> dict[str, Any]:
    """Valide juste le mot de passe — sert au frontend pour révéler les
    contrôles d'admin AVANT de tenter l'export/edit/cache-clear."""
    expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
    if not expected:
        raise HTTPException(503, "Admin désactivé : EXPORT_SECRETS_PASSWORD non défini.")
    if (req.password or "").strip() != expected:
        raise HTTPException(401, "Mot de passe invalide.")
    return {"ok": True}


class ExportSecretsRequest(BaseModel):
    password: str


# Liste complète des vars d'env modifiables — tout ce qui est dans
# .env.example (cf. user feedback : « il manque des TTL etc »).
_EXPORTABLE_ENV_VARS = [
    # JDM API
    "JDM_BASE_URL", "JDM_TIMEOUT",
    "JDM_CACHE_DIR", "JDM_CACHE_TTL_META", "JDM_CACHE_TTL_DATA",
    # LLM defaults
    "LLM_PROVIDER", "LLM_MODEL", "LLM_TEMPERATURE",
    # Ollama (modèles locaux — branche ollama)
    "OLLAMA_BASE_URL",
    # Provider API keys
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY",
    "DEEPSEEK_API_KEY", "GOOGLE_API_KEY", "GOOGLE_API_KEYS",
    "HF_TOKEN",
    # LLMDrops (soumission JDM)
    "JDM_DROPS_API_KEY", "JDM_DROPS_URL",
    # Reverse-proxy subpath
    "APP_SUBPATH",
]


@app.post("/api/admin/export-secrets")
def api_admin_export_secrets(req: ExportSecretsRequest) -> dict[str, Any]:
    """Export les secrets d'env (clés API, etc.) si le mot de passe
    matche `EXPORT_SECRETS_PASSWORD`. Ne renvoie JAMAIS la valeur de
    `EXPORT_SECRETS_PASSWORD` elle-même."""
    expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
    if not expected:
        raise HTTPException(503,
            "Export désactivé : `EXPORT_SECRETS_PASSWORD` n'est pas défini côté serveur.")
    if (req.password or "").strip() != expected:
        raise HTTPException(401, "Mot de passe invalide.")
    out = {}
    for k in _EXPORTABLE_ENV_VARS:
        v = os.environ.get(k, "")
        if v:
            out[k] = v
    return {"vars": out, "count": len(out)}


class EnvSetRequest(BaseModel):
    password: str
    vars: dict[str, str]  # {NAME: VALUE} — VALUE vide = unset


@app.post("/api/admin/env-set")
def api_admin_env_set(req: EnvSetRequest) -> dict[str, Any]:
    """Modifie les env vars whitelistées (uniquement celles de
    `_EXPORTABLE_ENV_VARS`). Persiste dans `.env` si fichier existe,
    sinon juste in-process. Mot de passe `EXPORT_SECRETS_PASSWORD` requis.
    """
    expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
    if not expected:
        raise HTTPException(503, "Admin désactivé : EXPORT_SECRETS_PASSWORD non défini.")
    if (req.password or "").strip() != expected:
        raise HTTPException(401, "Mot de passe invalide.")
    if not isinstance(req.vars, dict) or not req.vars:
        raise HTTPException(400, "vars vide ou invalide.")

    # Filtre : seules les vars whitelistées peuvent être modifiées
    allowed = set(_EXPORTABLE_ENV_VARS)
    updates = {k: v for k, v in req.vars.items() if k in allowed}
    rejected = sorted(set(req.vars.keys()) - allowed)

    # Update in-process
    for k, v in updates.items():
        if v == "":
            os.environ.pop(k, None)
        else:
            os.environ[k] = v

    # Persistance .env si présent à la racine du projet
    env_path = _root / ".env"
    persisted = False
    if env_path.exists():
        try:
            lines = env_path.read_text(encoding="utf-8").splitlines()
            seen = set()
            new_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    new_lines.append(line)
                    continue
                key = stripped.split("=", 1)[0].strip()
                if key in updates:
                    seen.add(key)
                    val = updates[key]
                    if val == "":
                        new_lines.append(f"# {key}=  # unset")
                    else:
                        new_lines.append(f"{key}={val}")
                else:
                    new_lines.append(line)
            # Append les nouvelles clés (jamais vues dans .env)
            for k, v in updates.items():
                if k not in seen and v != "":
                    new_lines.append(f"{k}={v}")
            env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
            persisted = True
        except Exception:
            persisted = False

    return {
        "updated": sorted(updates.keys()),
        "rejected": rejected,
        "persisted_to_dotenv": persisted,
    }


class CacheClearRequest(BaseModel):
    password: str


@app.post("/api/admin/cache-clear")
def api_admin_cache_clear(req: CacheClearRequest) -> dict[str, Any]:
    """Vide le cache disque JDM (`JDM_CACHE_DIR`). Tous les prochains
    appels devront refrapper l'API JeuxDeMots. Mot de passe requis."""
    expected = os.environ.get("EXPORT_SECRETS_PASSWORD", "").strip()
    if not expected:
        raise HTTPException(503, "Admin désactivé : EXPORT_SECRETS_PASSWORD non défini.")
    if (req.password or "").strip() != expected:
        raise HTTPException(401, "Mot de passe invalide.")
    cache_dir = Path(os.environ.get("JDM_CACHE_DIR", ".cache/jdm"))
    deleted = 0
    errors = []
    if cache_dir.exists():
        for p in cache_dir.rglob("*"):
            if p.is_file():
                try:
                    p.unlink()
                    deleted += 1
                except OSError as e:
                    errors.append(str(e))
    # Reset le client partagé pour qu'il rebuild son diskcache
    global _client
    _client = None
    return {
        "ok": True, "deleted_files": deleted,
        "cache_dir": str(cache_dir),
        "errors": errors[:5],
    }


@app.get("/api/admin/info")
def api_admin_info() -> dict[str, Any]:
    """Diagnostic admin : versions, état pool, env vars présentes (noms
    seulement, pas les valeurs)."""
    import sys as _sys
    present_env = sorted(k for k in _EXPORTABLE_ENV_VARS if os.environ.get(k))
    return {
        "python": _sys.version.split()[0],
        "app_subpath": APP_SUBPATH or "",
        "pool_size": len(_app._parse_google_keys()),
        "env_vars_present": present_env,
        "export_secrets_enabled": bool(os.environ.get("EXPORT_SECRETS_PASSWORD")),
    }


# ────────────────────────────────────────────────────────────────────
# Static files — IMPORTANT : déclarer EN DERNIER (catch-all)
# ────────────────────────────────────────────────────────────────────
STATIC_DIR = _root / "static"
INDEX_HTML_PATH = STATIC_DIR / "index.html"

# Cache le template index.html avec un placeholder à substituer pour
# le <base href>. Lecture au boot puis substitution à chaque GET /.
_INDEX_TEMPLATE: Optional[str] = None


def _serve_index_html() -> str:
    """Renvoie index.html avec <base href> injecté selon APP_SUBPATH.

    On insère le tag juste après <head>. Si APP_SUBPATH est vide, on met
    quand même `<base href="/">` pour être explicite — ça ne change rien
    au comportement mais clarifie ce qui se passe côté navigateur.
    """
    global _INDEX_TEMPLATE
    if _INDEX_TEMPLATE is None:
        _INDEX_TEMPLATE = INDEX_HTML_PATH.read_text(encoding="utf-8")
    base = (APP_SUBPATH + "/") if APP_SUBPATH else "/"
    base_tag = f'<base href="{base}">'
    # Insertion juste après <head> (1ère occurrence). Idempotent : si un
    # <base> existe déjà, on le remplace.
    import re
    html = _INDEX_TEMPLATE
    if re.search(r"<base\b", html):
        html = re.sub(r"<base[^>]*>", base_tag, html, count=1)
    else:
        html = re.sub(r"(<head[^>]*>)", r"\1\n" + base_tag, html, count=1)
    return html


if STATIC_DIR.exists():
    @app.get("/", include_in_schema=False)
    def index():
        from fastapi.responses import HTMLResponse
        return HTMLResponse(_serve_index_html())

    # Catch-all SPA + static : pour toute requête GET non encore matchée
    # par une route API (déclarées plus haut), on sert :
    #   1. le fichier statique s'il existe dans static/ (webapp/*.jsx, css, etc.)
    #   2. sinon `index.html` avec <base href> injecté — c'est ça qui rend
    #      les deep links genre /jarvis/enrich utilisables côté SPA.
    # Remplace `app.mount("/", StaticFiles(...))` parce qu'un mount intercepte
    # tout indistinctement et 404 sur les URLs SPA inconnues du dossier.
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_or_static(full_path: str):
        from fastapi.responses import HTMLResponse
        # Garde-fou : les vraies routes /api/* sont déclarées avant et
        # matchent en priorité ; si on tombe ici sur /api/quelque-chose
        # c'est que la route n'existe pas → 404 explicite (pas index.html).
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not Found")
        # Fichier static existant → on le sert (assets, JS, CSS).
        # Garde-fou path traversal : on vérifie que le résolu est sous STATIC_DIR.
        if full_path:
            candidate = STATIC_DIR / full_path
            try:
                resolved = candidate.resolve()
                static_root = STATIC_DIR.resolve()
                if (candidate.is_file()
                    and str(resolved).startswith(str(static_root) + os.sep)):
                    return FileResponse(str(candidate))
            except (OSError, ValueError):
                pass
        # Sinon → SPA deep link, on renvoie index.html. Le router client
        # lira location.pathname et ouvrira la bonne vue.
        return HTMLResponse(_serve_index_html())
else:
    @app.get("/")
    def root_missing():
        return JSONResponse({"error": "static/ folder missing"}, status_code=500)
