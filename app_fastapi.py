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
    depth: int = 2
    relations: list[str] = []
    min_weight: float = 25
    max_nodes: int = 40


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
app = FastAPI(title="JDMAgent API", version="1.0.0")

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
    """Construire le sous-graphe d'un terme et renvoyer nodes/edges JSON.

    On délègue à `build_subgraph(output="json")` puis on aplatit en une
    structure légère facile à layouter côté frontend :
        {root, nodes: [{id, label, kind, depth}],
               edges: [{from, to, relation, weight, negative, depth}],
               stats: {...}, message?}
    """
    c = get_client()
    term, err = _resolve_and_check(c, req.term)
    if err:
        return {"root": req.term, "nodes": [], "edges": [],
                "stats": {"n_nodes": 0, "n_edges": 0}, "message": err}

    rels = list(req.relations) if req.relations else None
    try:
        res = build_subgraph(
            term,
            client=c,
            depth=max(1, min(int(req.depth), 4)),
            top_k_per_relation=8,  # backend décide, frontend coupe à max_nodes
            min_weight=float(req.min_weight) if req.min_weight else None,
            relations=rels,
            output="json",
        )
    except Exception as e:
        return {"root": term, "nodes": [], "edges": [],
                "stats": {"n_nodes": 0, "n_edges": 0},
                "message": f"Erreur API JDM : {e}"}

    # Aplatir nodes vis-network → forme frontend simple.
    raw_nodes = res.get("nodes", [])
    raw_edges = res.get("edges", [])

    nodes_out = [
        {
            "id": n["id"],
            "label": n.get("label", n["id"]),
            "kind": n.get("_kind", "assoc"),
            "depth": n.get("_depth", 0),
        }
        for n in raw_nodes
    ]
    edges_out = [
        {
            "from": e["from"],
            "to": e["to"],
            "relation": e.get("_relation", ""),
            "weight": e.get("_weight", 0),
            "negative": bool(e.get("_negative", False)),
            "depth": e.get("_depth", 1),
        }
        for e in raw_edges
    ]

    # Optionnel : tronquer à max_nodes en préservant la connectivité.
    # Stratégie : BFS depuis ROOT en respectant l'ordre par poids d'arête
    # descendant. Garde tous les nœuds atteignables jusqu'à saturation.
    if req.max_nodes and len(nodes_out) > req.max_nodes:
        # Index edges sortantes par source, triées par poids desc.
        out_edges: dict[str, list[dict]] = {}
        for e in edges_out:
            out_edges.setdefault(e["from"], []).append(e)
        for src in out_edges:
            out_edges[src].sort(key=lambda e: -abs(e["weight"]))
        # BFS depuis ROOT, en saturant par couches.
        keep: set[str] = {"ROOT"}
        frontier = ["ROOT"]
        while frontier and len(keep) < req.max_nodes:
            next_frontier = []
            for src in frontier:
                for e in out_edges.get(src, []):
                    if e["to"] not in keep:
                        keep.add(e["to"])
                        next_frontier.append(e["to"])
                        if len(keep) >= req.max_nodes:
                            break
                if len(keep) >= req.max_nodes:
                    break
            frontier = next_frontier
        nodes_out = [n for n in nodes_out if n["id"] in keep]
        edges_out = [e for e in edges_out if e["from"] in keep and e["to"] in keep]

    return {
        "root": term,
        "nodes": nodes_out,
        "edges": edges_out,
        "stats": res.get("stats", {"n_nodes": len(nodes_out), "n_edges": len(edges_out)}),
    }


# ────────────────────────────────────────────────────────────────────
# LLM factory (slim port from app.py — pool/rate-limit comes in step 3)
# ────────────────────────────────────────────────────────────────────
def _build_llm(model: str, api_key: str, *, use_thinking: bool = True):
    """Instancie un ChatModel selon le préfixe du modèle.

    Version minimale pour la migration FastAPI :
      - claude-* → Anthropic BYOK (api_key requis)
      - gpt-*    → OpenAI BYOK (api_key requis)
      - gemini-* → utilise GOOGLE_API_KEY de l'environnement (pool en step 3)

    Lève ValueError avec message explicite si la clé manque.
    """
    from jdm_agent.tools.llm_factory import get_llm

    if model.startswith("claude-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle Claude, fournis une clé Anthropic (sk-ant-…)."
            )
        os.environ["ANTHROPIC_API_KEY"] = api_key.strip()
        kwargs: dict = {}
        if use_thinking:
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": 1024}
            kwargs["temperature"] = 1.0
        return get_llm(provider="anthropic", model=model, **kwargs)

    if model.startswith("gpt-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle GPT, fournis une clé OpenAI (sk-…)."
            )
        os.environ["OPENAI_API_KEY"] = api_key.strip()
        return get_llm(provider="openai", model=model)

    if model.startswith("gemini-"):
        # GOOGLE_API_KEY lue depuis l'env (pool / rotation = step 3).
        if not os.environ.get("GOOGLE_API_KEY"):
            raise ValueError(
                "Aucune clé Google disponible côté serveur (GOOGLE_API_KEY)."
            )
        return get_llm(provider="google_genai", model=model)

    raise ValueError(f"Modèle non supporté : {model!r}")


# ────────────────────────────────────────────────────────────────────
# Route: Agent SSE stream
# ────────────────────────────────────────────────────────────────────
@app.post("/api/agent/stream")
async def api_agent_stream(req: AgentRequest):
    """Streamer la réponse de l'agent LLM + tool calls JDM via SSE.

    Émet des events typés (cf. `jdm_agent.streaming.chat_stream`) :
      event: thought | spoken | tool_call | tool_result | final | error
      data:  JSON sérialisé du dict d'event.
    """
    from jdm_agent.streaming import chat_stream

    try:
        llm = _build_llm(req.model, req.api_key, use_thinking=req.use_thinking)
    except ValueError as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": str(e)})}
        return EventSourceResponse(err_gen())

    async def gen():
        try:
            for ev in chat_stream(
                message=req.message,
                history=req.history,
                llm=llm,
                client=get_client(),
            ):
                yield {
                    "event": ev.get("type", "update"),
                    "data": json.dumps(ev, ensure_ascii=False),
                }
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
def _jarvis_dispatch(flow_id: str, params: dict) -> tuple[str, str]:
    """Construit (prompt, headline) pour un flow donné. Lève ValueError
    si le flow est inconnu."""
    import inspect
    from jarvis import (
        build_enrich_prompt, build_audit_prompt, build_gap_prompt,
        build_signalement_prompt, build_stats_prompt,
    )
    BUILDERS = {
        "enrich":      (build_enrich_prompt,      lambda p: f"🌱 Enrichir « {p.get('term', '?')} »"),
        "audit":       (build_audit_prompt,       lambda p: f"🔍 Auditer « {p.get('term', '?')} »"),
        "gap":         (build_gap_prompt,         lambda p: f"🕳️ Trous sur « {p.get('term', '?')} »"),
        "signalement": (build_signalement_prompt, lambda p: f"⚠️ Signaler sur « {p.get('term', '?')} »"),
        "stats":       (build_stats_prompt,       lambda p: f"📊 Stats sur « {p.get('term', '?')} »"),
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
    """Lancer un flux Jarvis et streamer ses events.

    Le `flow_id` identifie le flow ; `params` contient les valeurs du
    formulaire (term, relation, target_count, …). On compose le prompt
    via le `build_*_prompt` correspondant puis on streame comme l'agent.

    Émet un event supplémentaire `event: headline` (1er event) avec
    le résumé court à afficher dans la bulle « user ».
    """
    from jdm_agent.streaming import chat_stream

    # 1) Build prompt + headline
    try:
        prompt, headline = _jarvis_dispatch(flow_id, req.params or {})
    except ValueError as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": str(e)})}
        return EventSourceResponse(err_gen())

    # 2) Build LLM (model/api_key passés dans params pour rester compat
    # avec la signature JarvisRequest existante).
    p = req.params or {}
    model = p.get("model", "gemini-3.1-flash-lite")
    api_key = p.get("api_key", "")
    use_thinking = bool(p.get("use_thinking", True))
    try:
        llm = _build_llm(model, api_key, use_thinking=use_thinking)
    except ValueError as e:
        async def err_gen():
            yield {"event": "error", "data": json.dumps({"text": str(e)})}
        return EventSourceResponse(err_gen())

    async def gen():
        # Headline immédiate
        yield {
            "event": "headline",
            "data": json.dumps({"text": headline, "flow_id": flow_id},
                              ensure_ascii=False),
        }
        try:
            for ev in chat_stream(
                message=prompt,
                history=[],  # Jarvis flows sont one-shot, pas de continuation
                llm=llm,
                client=get_client(),
            ):
                yield {
                    "event": ev.get("type", "update"),
                    "data": json.dumps(ev, ensure_ascii=False),
                }
        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "text": f"{type(e).__name__}: {e}"
            }, ensure_ascii=False)}

    return EventSourceResponse(gen())


# ────────────────────────────────────────────────────────────────────
# Pool Gemini — parsing + rotation (slim ; full blown-tracking en step 4)
# ────────────────────────────────────────────────────────────────────
import re as _re_pool

# Clé courante (session locale au process — pas de persistance disque ici,
# la persistance vit dans app.py pour l'instant et sera unifiée en step 4).
_CURRENT_POOL_KEY: Optional[str] = None


def _parse_pool_keys() -> list[str]:
    """Liste ordonnée des clés Google API du pool.

    Priorité : GOOGLE_API_KEYS (multi) > GOOGLE_API_KEY (single).
    Split robuste sur tout caractère non-[A-Za-z0-9_-] (gère virgules
    fullwidth, BOM UTF-8, espaces, etc.).
    """
    def _split(blob: str) -> list[str]:
        return [c for c in _re_pool.split(r"[^A-Za-z0-9_-]+", blob) if c]

    raw = os.environ.get("GOOGLE_API_KEYS", "").lstrip("﻿").strip()
    if raw:
        return _split(raw)
    single = os.environ.get("GOOGLE_API_KEY", "").lstrip("﻿").strip()
    return _split(single) if single else []


def _mask_key(k: str) -> str:
    if not k or len(k) < 8:
        return "***"
    return f"{k[:4]}…{k[-4:]}"


def _current_pool_index(keys: list[str]) -> int:
    """1-based index de la clé courante dans le pool, 0 si vide/inconnue."""
    if not keys or not _CURRENT_POOL_KEY:
        return 0
    try:
        return keys.index(_CURRENT_POOL_KEY) + 1
    except ValueError:
        return 0


@app.get("/api/pool/status")
def api_pool_status() -> dict[str, Any]:
    """État du pool Gemini : nombre de clés, clé courante (masquée),
    index 1-based dans le pool.

    Note : la sémantique « blown today » (clé épuisée pour quota PerDay
    sur un modèle donné) reste pour l'instant gérée côté app.py — le
    plein partage d'état pool↔FastAPI vient en step 4 quand on supprime
    app.py.
    """
    keys = _parse_pool_keys()
    return {
        "keys_count": len(keys),
        "current_key_masked": _mask_key(_CURRENT_POOL_KEY) if _CURRENT_POOL_KEY else None,
        "current_index": _current_pool_index(keys),
    }


class RotateRequest(BaseModel):
    skip_current: bool = True  # avance d'un cran ; False = ne fait rien si déjà bonne


@app.post("/api/pool/rotate")
def api_pool_rotate(req: RotateRequest = RotateRequest()) -> dict[str, Any]:
    """Avance la clé Gemini courante au tour suivant du pool (round-robin).

    Renvoie le nouveau statut.
    """
    global _CURRENT_POOL_KEY
    keys = _parse_pool_keys()
    if not keys:
        raise HTTPException(400, "Pool Gemini vide : configure GOOGLE_API_KEYS ou GOOGLE_API_KEY.")
    if not _CURRENT_POOL_KEY or _CURRENT_POOL_KEY not in keys:
        new_key = keys[0]
    elif req.skip_current:
        idx = keys.index(_CURRENT_POOL_KEY)
        new_key = keys[(idx + 1) % len(keys)]
    else:
        new_key = _CURRENT_POOL_KEY
    _CURRENT_POOL_KEY = new_key
    # Reflète dans l'env pour que _build_llm() (GOOGLE_API_KEY) la voie.
    os.environ["GOOGLE_API_KEY"] = new_key
    return {
        "keys_count": len(keys),
        "current_key_masked": _mask_key(_CURRENT_POOL_KEY),
        "current_index": _current_pool_index(keys),
        "rotated": True,
    }


# ────────────────────────────────────────────────────────────────────
# Static files — IMPORTANT : déclarer EN DERNIER (catch-all)
# ────────────────────────────────────────────────────────────────────
STATIC_DIR = _root / "static"

if STATIC_DIR.exists():
    # Sert tout le contenu de static/ sous /
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
else:
    @app.get("/")
    def root():
        return JSONResponse({"error": "static/ folder missing"}, status_code=500)


# Health check pour HF Spaces
@app.get("/health")
def health():
    return {"status": "ok"}
