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
# jarvis.py contient `run_jarvis_flow` avec budget tool, append cumulatif
# vers `canonical_path`, retry rate-limit, retry-à-la-fin (truncate
# history + liste des interdits), auto-bascule sur 3.1, etc.
#
# Coût de l'import : ~7s au boot (app.py construit ses Gradio Blocks au
# module load, mais ne lance rien). Acceptable pour récupérer toute
# cette mécanique. Une phase future extraira ces helpers dans
# src/jdm_agent/llm_pool.py pour supprimer cette dépendance.
import app as _app
import jarvis as _jarvis

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
    limit: int = 50
    with_annotations: bool = False


class ClaimRequest(BaseModel):
    subject: str
    relation: str
    object: str
    effort: int = 1
    bypass: bool = False


class TermRequest(BaseModel):
    term: str


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
    flow_id: str
    params: dict = {}


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
async def disable_buffering(request: Request, call_next):
    response = await call_next(request)
    if "/stream" in request.url.path:
        response.headers["X-Accel-Buffering"] = "no"
        response.headers["Cache-Control"] = "no-cache"
    return response


# ────────────────────────────────────────────────────────────────────
# Route: Explorer (CÂBLÉE comme exemple)
# ────────────────────────────────────────────────────────────────────
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

    try:
        res = c.relations_from(
            term, types_ids=[rid],
            min_weight=float(req.min_weight),
            limit=int(req.limit),
        )
    except Exception as e:
        return {"rows": [], "message": f"Erreur API JDM : {e}"}

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
        msg = (f"Aucun triplet `{term} | {req.relation} | ?` "
               f"(w ≥ {req.min_weight:.0f}).")
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
            # Écrit dans /tmp puis on relit le HTML pour le renvoyer
            # inline (le front l'injecte dans une iframe). Évite de
            # devoir gérer les fichiers servis statiquement.
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
# Helper : wrap un générateur SYNC bloquant en async generator pour SSE
# ────────────────────────────────────────────────────────────────────
async def _to_async_gen(sync_gen):
    """Convertit un générateur sync en async, en exécutant chaque `next()`
    dans un thread (pour ne pas bloquer le event loop FastAPI).

    Utilisé pour chat_with_agent / run_jarvis_flow qui font des appels
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
# Route: Agent SSE stream
# ────────────────────────────────────────────────────────────────────
# On wrappe `app.chat_with_agent` qui yield des tuples (text, gr_update).
# `text` est le markdown LIVE cumulatif (croît à chaque étape : thoughts,
# tool_calls, tool_results, réponse finale). On émet 1 event SSE par
# yield, le frontend remplace le contenu de la bulle avec ce markdown.
#
# On RÉUTILISE tout : retry PerMinute, retry PerDay avec rotation pool,
# INVALID_KEY → mark + switch, accumulation messages pour reprise, etc.
@app.post("/api/agent/stream")
async def api_agent_stream(req: AgentRequest):
    """Stream l'agent LLM + tool calls JDM via SSE.

    Events émis :
      event: text   data: {"text": "<markdown cumulatif live>"}
      event: done   data: {}
      event: error  data: {"text": "<message>"}
    """
    async def gen():
        try:
            sync_gen = _app.chat_with_agent(
                message=req.message,
                history=req.history,
                api_key=req.api_key,
                model=req.model,
                use_thinking=req.use_thinking,
            )
            async for chunk in _to_async_gen(sync_gen):
                # chat_with_agent yield (text_markdown, gr_update_for_file)
                if isinstance(chunk, tuple) and len(chunk) >= 1:
                    text = chunk[0]
                else:
                    text = str(chunk)
                yield {
                    "event": "text",
                    "data": json.dumps({"text": text}, ensure_ascii=False),
                }
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"
            }, ensure_ascii=False)}

    return EventSourceResponse(gen())


# ────────────────────────────────────────────────────────────────────
# Route: Jarvis stream
# ────────────────────────────────────────────────────────────────────
# Mapping flow_id → (prompt_builder, headline_builder).
# `params` est le dict envoyé par l'UI ; on en extrait ce que le
# builder accepte. On filtre via inspect.signature pour rester
# tolérant aux paramètres inconnus.
def _term_or_random(p: dict) -> str:
    """Renvoie le terme du form, ou un libellé 'aléatoire' si vide.
    Évite l'affichage moche de « » dans les headlines.
    """
    t = (p.get("term") or "").strip()
    return t if t else "un terme tiré au hasard"


def _jarvis_dispatch(flow_id: str, params: dict) -> tuple[str, str]:
    """Construit (prompt, headline) pour un flow donné. Lève ValueError
    si le flow est inconnu."""
    import inspect
    from jarvis import (
        build_enrich_prompt, build_audit_prompt, build_gap_prompt,
        build_signalement_prompt, build_stats_prompt,
    )
    BUILDERS = {
        "enrich":      (build_enrich_prompt,      lambda p: f"🌱 Enrichir {_term_or_random(p)}"),
        "audit":       (build_audit_prompt,       lambda p: f"🔍 Auditer {_term_or_random(p)}"),
        "gap":         (build_gap_prompt,         lambda p: f"🕳️ Détecter les trous sur {_term_or_random(p)}"),
        "signalement": (build_signalement_prompt, lambda p: f"⚠️ Signaler les triplets suspects de {_term_or_random(p)}"),
        "stats":       (build_stats_prompt,       lambda p: f"📊 Stats sur {_term_or_random(p)}"),
    }
    if flow_id not in BUILDERS:
        raise ValueError(
            f"flow_id inconnu : {flow_id!r}. "
            f"Attendu : {sorted(BUILDERS)}."
        )
    builder, headline_fn = BUILDERS[flow_id]
    # Garde seulement les params acceptés par la signature du builder.
    sig = inspect.signature(builder)
    accepted = {k: v for k, v in (params or {}).items() if k in sig.parameters}
    prompt = builder(**accepted)
    headline = headline_fn(params or {})
    return prompt, headline


@app.post("/api/jarvis/{flow_id}/stream")
async def api_jarvis_stream(flow_id: str, req: JarvisRequest):
    """Lance un flux Jarvis via `jarvis.run_jarvis_flow` (réutilise toute
    la mécanique : budget tool, append cumulatif vers canonical_path,
    retry rate-limit, retry-à-la-fin, auto-bascule, exclusion_context).

    Events SSE émis :
      event: headline  data: {"text": "...", "flow_id": "..."}
      event: jarvis    data: {"messages": [...], "file_path": "...",
                              "file_preview": "...", "state": {...}|null}
      event: done      data: {}
      event: error     data: {"text": "..."}
    """
    # 1) Build prompt + headline
    try:
        prompt, headline = _jarvis_dispatch(flow_id, req.params or {})
    except ValueError as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": str(e)})}
        return EventSourceResponse(err_gen())

    p = req.params or {}

    async def gen():
        # 0) Headline tout de suite
        yield {
            "event": "headline",
            "data": json.dumps({"text": headline, "flow_id": flow_id},
                              ensure_ascii=False),
        }
        try:
            sync_gen = _jarvis.run_jarvis_flow(
                prompt=prompt,
                headline=headline,
                model=p.get("model", "gemini-3.1-flash-lite"),
                api_key=p.get("api_key", ""),
                budget_label=str(p.get("budget_label", "illimité")),
                drops_key=p.get("drops_key", ""),
                # Injection — évite l'import circulaire avec app.py
                build_llm_fn=_app._build_llm,
                build_agent_fn=_app.build_jdm_agent if hasattr(_app, "build_jdm_agent")
                              else __import__("jdm_agent.tools.jdm_agent",
                                              fromlist=["build_jdm_agent"]).build_jdm_agent,
                get_client_fn=_app.get_client,
                use_thinking=bool(p.get("use_thinking", False)),
                consolidation_target=p.get("target_count"),
                auto_switch_on_perday=bool(p.get("auto_switch", False)),
                resume_state=p.get("resume_state"),
            )
            async for chunk in _to_async_gen(sync_gen):
                # run_jarvis_flow yield :
                #   3-tuple : (messages, fpath, fpreview)
                #   5-tuple : (messages, fpath, fpreview, state, _continue_visible)
                if not isinstance(chunk, tuple):
                    continue
                messages = chunk[0] if len(chunk) >= 1 else None
                fpath = chunk[1] if len(chunk) >= 2 else None
                fpreview = chunk[2] if len(chunk) >= 3 else None
                state = chunk[3] if len(chunk) >= 4 else None
                # Sérialise messages (peut contenir des objets Gradio
                # gr.update — on filtre pour ne garder que les dict).
                msgs_clean = []
                if isinstance(messages, list):
                    for m in messages:
                        if isinstance(m, dict):
                            msgs_clean.append({
                                "role": m.get("role", ""),
                                "content": m.get("content", ""),
                            })
                yield {
                    "event": "jarvis",
                    "data": json.dumps({
                        "messages": msgs_clean,
                        "file_path": str(fpath) if fpath else None,
                        "file_preview": fpreview if isinstance(fpreview, str) else "",
                        "state": state if isinstance(state, dict) else None,
                    }, ensure_ascii=False, default=str),
                }
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"
            }, ensure_ascii=False)}

    return EventSourceResponse(gen())


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
    for k in keys:
        out_keys.append({
            "masked": _app._masked_key(k),
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
        "current_key_masked": _app._masked_key(current_key) if current_key else None,
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

    # Sert tout le RESTE de static/ (webapp/*.jsx, etc.) sous /.
    # html=False désactive le catch-all index automatique : seul notre
    # route GET / sert index.html (avec <base href> injecté).
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=False), name="static")
else:
    @app.get("/")
    def root_missing():
        return JSONResponse({"error": "static/ folder missing"}, status_code=500)
