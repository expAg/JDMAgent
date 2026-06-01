"""Outils internes de la mascotte Jarvis (chat de supervision).

Ces outils donnent au robot une vue sur les RUNS (vivants + historisés),
les FICHIERS produits, la CONFIG Jarvis, et l'ENVIRONNEMENT (lecture +
écriture protégée par mot de passe). Ils complètent les outils JDM de
lecture/exploration (verify_claim, disambiguate, …) câblés séparément
dans agent.py.

Aucune dépendance vers app_fastapi (anti-circulaire) : les runs vivants
sont lus via `runtime.get_live_runs()` (provider injecté au boot), les
fichiers via le filesystem `/tmp/jdm_outputs`, la config via le snapshot
posé par l'endpoint de chat.
"""
from __future__ import annotations

import os
import re
from collections import Counter
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool

from jdm_agent.jarvis_chat import persistence as _persist
from jdm_agent.jarvis_chat import runtime as _rt

PRODUCTIONS_DIR = Path("/tmp/jdm_outputs")
_SUBMITTED_FILE = PRODUCTIONS_DIR / ".submitted.json"
_ENV_PASSWORD_VAR = "EXPORT_SECRETS_PASSWORD"


def _submitted_set() -> set:
    """Noms de fichiers déjà soumis à LLMDrops (lit .submitted.json, même
    format que l'app : dict {nom: ts} ou liste)."""
    import json as _json
    if not _SUBMITTED_FILE.exists():
        return set()
    try:
        data = _json.loads(_SUBMITTED_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return set(data.keys())
        if isinstance(data, list):
            return set(data)
    except Exception:
        pass
    return set()


# ───────────────────────── helpers ─────────────────────────

def _merged_runs() -> list[dict]:
    """Runs vivants (bg_runs) + historisés (.jarvis_runs.jsonl), dédoublonnés
    par run_id (vivant gagne car plus à jour), triés récents d'abord."""
    by_id: dict[str, dict] = {}
    for r in _persist.load_recent_runs(limit=300):
        rid = r.get("run_id")
        if rid:
            by_id[rid] = r
    for r in _rt.get_live_runs():
        rid = r.get("run_id")
        if rid:
            by_id[rid] = r
    runs = list(by_id.values())
    runs.sort(key=lambda r: r.get("started_at") or 0, reverse=True)
    return runs


def _run_summary(r: dict, submitted: set = None) -> dict:
    """Vue compacte d'un run pour list_runs."""
    stats = r.get("stats") or {}
    started = r.get("started_at")
    finished = r.get("finished_at")
    dur = None
    if started and finished:
        dur = round(finished - started, 1)
    elif started:
        dur = None
    fname = _basename(r.get("last_file_path") or stats.get("file"))
    sub = submitted if submitted is not None else _submitted_set()
    return {
        "run_id": r.get("run_id"),
        "flow_id": r.get("flow_id"),
        "status": r.get("status"),
        "headline": r.get("headline"),
        "started_at": started,
        "duration_s": dur,
        "retained": stats.get("retained"),
        "attempts": stats.get("attempts"),
        "file": fname,
        "submitted": (fname in sub) if fname else False,
    }


def _basename(p) -> Optional[str]:
    if not p:
        return None
    return str(p).replace("\\", "/").rstrip("/").split("/")[-1]


def _safe_name(name: str) -> Optional[str]:
    """Valide un nom de fichier (anti path-traversal)."""
    if not name or "/" in name or "\\" in name or name.startswith("."):
        return None
    return name


# ───────────────────────── tools : runs ─────────────────────────

@tool
def list_runs(status: str = "", flow_id: str = "", limit: int = 20) -> dict:
    """Liste les flux (runs) Jarvis, vivants et passés, le plus récent d'abord.

    Filtres optionnels :
      - status : 'running', 'done', 'error', 'starting' (vide = tous)
      - flow_id : 'enrich', 'audit', 'gap', 'signalement', 'stats',
        'annotation' (vide = tous)
      - limit : nombre max de runs renvoyés (défaut 20)

    Chaque run renvoie : run_id, flow_id, status, headline, started_at,
    duration_s, retained (items retenus/consolidés), attempts (tentatives),
    file (nom du fichier produit). Pour le détail complet d'un run précis,
    utilise get_run(run_id).
    """
    runs = _merged_runs()
    if status:
        runs = [r for r in runs if (r.get("status") or "") == status]
    if flow_id:
        runs = [r for r in runs if (r.get("flow_id") or "") == flow_id]
    sub = _submitted_set()
    out = [_run_summary(r, sub) for r in runs[: max(1, min(100, int(limit or 20)))]]
    return {"count": len(out), "runs": out}


@tool
def get_run(run_id: str) -> dict:
    """Détail complet d'un run Jarvis, incluant ses STATISTIQUES :
      - attempts    : nombre de tentatives (triplets soumis à validation)
      - retained    : nombre d'items retenus / consolidés
      - tokens      : tokens LLM estimés consommés
      - tools_count : nombre total d'appels d'outils
      - tools       : détail {nom_outil: nb_appels}
      - file        : fichier produit (nom)
      - status, flow_id, headline, started_at, duration_s

    Passe le run_id renvoyé par list_runs.
    """
    for r in _merged_runs():
        if r.get("run_id") == run_id:
            stats = r.get("stats") or {}
            started = r.get("started_at")
            finished = r.get("finished_at")
            dur = round(finished - started, 1) if (started and finished) else None
            fname = _basename(r.get("last_file_path") or stats.get("file"))
            return {
                "run_id": r.get("run_id"),
                "flow_id": r.get("flow_id"),
                "status": r.get("status"),
                "headline": r.get("headline"),
                "started_at": started,
                "finished_at": finished,
                "duration_s": dur,
                "attempts": stats.get("attempts", 0),
                "retained": stats.get("retained", 0),
                "tokens": stats.get("tokens", 0),
                "tools_count": stats.get("tools_count", 0),
                "tools": stats.get("tools", {}),
                "file": fname,
                "submitted": (fname in _submitted_set()) if fname else False,
                "error_text": r.get("error_text"),
            }
    return {"error": f"Run introuvable : {run_id}. Utilise list_runs pour les ids valides."}


# ───────────────────────── tools : fichiers produits ─────────────────────────

@tool
def list_productions(ext: str = "") -> dict:
    """Liste les fichiers produits par les flux Jarvis dans le dossier de
    sortie (.enrich / .audit / .err / .stat / .annot / .gap).

    Filtre optionnel `ext` (sans le point, ex. 'enrich') pour ne garder
    qu'un type. Renvoie pour chaque fichier : name, ext, size, age_s.
    """
    if not PRODUCTIONS_DIR.exists():
        return {"count": 0, "files": []}
    import time as _t
    want = (ext or "").lstrip(".").lower()
    sub = _submitted_set()
    files = []
    for p in PRODUCTIONS_DIR.iterdir():
        if not p.is_file() or p.name.startswith("."):
            continue
        e = p.suffix.lstrip(".").lower()
        if want and e != want:
            continue
        try:
            st = p.stat()
            files.append({"name": p.name, "ext": e or "txt",
                          "size": st.st_size, "age_s": int(_t.time() - st.st_mtime),
                          "submitted": p.name in sub})
        except OSError:
            continue
    files.sort(key=lambda f: f["age_s"])
    return {"count": len(files), "files": files}


@tool
def read_production(name: str, max_chars: int = 6000) -> dict:
    """Lit le CONTENU d'un fichier produit (par son nom exact, cf.
    list_productions). Tronque à `max_chars` (défaut 6000). Renvoie
    {name, content, truncated, size}.
    """
    safe = _safe_name(name)
    if not safe:
        return {"error": "Nom de fichier invalide."}
    p = PRODUCTIONS_DIR / safe
    if not p.exists() or not p.is_file():
        return {"error": f"Fichier introuvable : {name}"}
    try:
        content = p.read_text(encoding="utf-8")
    except Exception as e:
        return {"error": f"Lecture impossible : {e}"}
    cap = max(500, min(20000, int(max_chars or 6000)))
    truncated = len(content) > cap
    return {"name": safe, "content": content[:cap],
            "truncated": truncated, "size": len(content),
            "submitted": safe in _submitted_set()}


@tool
def summarize_triplets(name: str) -> dict:
    """Résume les triplets d'un fichier produit : nombre de lignes-triplets,
    distribution par relation (top), termes-sources les plus fréquents.

    Le format attendu est `terme | relation | cible | ...` (une ligne par
    triplet ; les lignes de commentaire `#` ou de section `===` sont
    ignorées). Renvoie {name, n_triplets, by_relation, top_terms}.
    """
    safe = _safe_name(name)
    if not safe:
        return {"error": "Nom de fichier invalide."}
    p = PRODUCTIONS_DIR / safe
    if not p.exists() or not p.is_file():
        return {"error": f"Fichier introuvable : {name}"}
    try:
        content = p.read_text(encoding="utf-8")
    except Exception as e:
        return {"error": f"Lecture impossible : {e}"}
    rels = Counter()
    terms = Counter()
    n = 0
    for raw in content.splitlines():
        s = raw.strip()
        if not s or s.startswith("#") or s.startswith("="):
            continue
        if "|" not in s:
            continue
        parts = [x.strip() for x in s.split("|")]
        if len(parts) < 3 or not parts[0] or not parts[1] or not parts[2]:
            continue
        n += 1
        terms[parts[0]] += 1
        rels[parts[1]] += 1
    return {
        "name": safe,
        "n_triplets": n,
        "by_relation": dict(rels.most_common(15)),
        "top_terms": dict(terms.most_common(10)),
    }


# ───────────────────────── tools : config Jarvis ─────────────────────────

@tool
def get_config() -> dict:
    """Lit la configuration Jarvis courante (mode d'exécution, modèle LLM,
    budget, température, pool gratuit, soumission auto, etc.). Renvoie le
    dict de config tel que configuré dans l'interface.
    """
    cfg = _rt.get_config_snapshot()
    if not cfg:
        return {"note": "Configuration non transmise par le client pour ce tour.",
                "config": {}}
    return {"config": cfg}


@tool
def set_config(key: str, value: str) -> dict:
    """Modifie UNE clé de la configuration Jarvis (ex. key='mode'
    value='autonome', key='llm' value='gemini-3.1-flash-lite', key='poolActive'
    value='true'). Le changement est appliqué côté interface immédiatement.

    Clés utiles : mode (autonome|supervise|pasapas), llm, temperature,
    globalConf, autoSubmit (true|false), poolActive (true|false),
    defaultMaxIter, parallel, logLevel. Booléens en 'true'/'false',
    nombres en chaîne ('0.3', '50'). N'invente pas de clés inexistantes —
    en cas de doute, appelle get_config() d'abord.
    """
    k = (key or "").strip()
    if not k:
        return {"error": "Clé vide."}
    # Coercition légère : bool / nombre depuis la string
    v: object = value
    low = str(value).strip().lower()
    if low in ("true", "false"):
        v = (low == "true")
    else:
        try:
            v = int(value) if re.fullmatch(r"-?\d+", str(value).strip()) else v
            if isinstance(v, str) and re.fullmatch(r"-?\d*\.\d+", str(value).strip()):
                v = float(value)
        except Exception:
            v = value
    _rt.push_config_patch(k, v)
    _rt.patch_config_snapshot(k, v)
    return {"ok": True, "key": k, "value": v,
            "note": "Patch appliqué à l'interface (config_patch)."}


# ───────────────────────── tools : environnement ─────────────────────────

@tool
def read_env(name: str) -> dict:
    """Lit une variable d'environnement, valeur MASQUÉE (ex. 'sk-***ab')
    pour ne jamais exposer un secret en clair. Renvoie {name, set, masked}.
    Utile pour vérifier qu'une clé API est bien configurée (GOOGLE_API_KEY,
    ANTHROPIC_API_KEY, JDM_DROPS_API_KEY, …) sans la révéler.
    """
    n = (name or "").strip()
    if not n:
        return {"error": "Nom de variable vide."}
    val = os.environ.get(n)
    return {"name": n, "set": val is not None, "masked": _persist._mask(val)}


@tool
def set_env(name: str, value: str, password: str) -> dict:
    """Modifie une variable d'environnement À CHAUD et la PERSISTE (overlay
    .env.runtime.json). PROTÉGÉ : `password` doit correspondre au secret
    serveur EXPORT_SECRETS_PASSWORD, sinon refus.

    Sert à configurer des clés API (GOOGLE_API_KEY, ANTHROPIC_API_KEY,
    JDM_DROPS_API_KEY, …). La modification survit à un redémarrage. Pour
    annuler la dernière modification, utilise rollback_env (même mot de
    passe). Demande TOUJOURS le mot de passe à l'utilisateur — ne l'invente
    jamais.
    """
    expected = os.environ.get(_ENV_PASSWORD_VAR)
    if not expected:
        return {"error": f"{_ENV_PASSWORD_VAR} non configuré côté serveur — "
                         "modification d'env désactivée."}
    if (password or "") != expected:
        return {"error": "Mot de passe incorrect — modification refusée."}
    n = (name or "").strip()
    if not n:
        return {"error": "Nom de variable vide."}
    res = _persist.set_env_override(n, value or "")
    return {"ok": True, "name": n, "masked": _persist._mask(value),
            "previous_existed": res.get("previous_existed"),
            "note": "Variable modifiée et persistée. rollback_env pour annuler."}


@tool
def rollback_env(password: str) -> dict:
    """Annule la DERNIÈRE modification d'environnement faite via set_env :
    restaure l'ancienne valeur (ou supprime la variable si elle n'existait
    pas). PROTÉGÉ par EXPORT_SECRETS_PASSWORD. Renvoie {ok, name, restored_to}.
    """
    expected = os.environ.get(_ENV_PASSWORD_VAR)
    if not expected:
        return {"error": f"{_ENV_PASSWORD_VAR} non configuré côté serveur."}
    if (password or "") != expected:
        return {"error": "Mot de passe incorrect — rollback refusé."}
    return _persist.rollback_env()


# ───────────────────────── tools : lancer / arrêter un flux ─────────────────────────

_VALID_FLOWS = {"enrich", "audit", "gap", "signalement", "stats", "annotation"}


@tool
def start_flow(flow_id: str, term: str = "", relation: str = "",
               target_count: int = 0) -> dict:
    """Démarre un flux d'agent Jarvis EN ARRIÈRE-PLAN et renvoie son run_id.

    flow_id ∈ {enrich, audit, gap, signalement, stats, annotation} :
      - enrich      : proposer + consolider de nouveaux triplets
      - audit       : auditer la répartition des sens d'un terme
      - gap         : détecter les trous de couverture
      - signalement : repérer des triplets suspects
      - stats       : statistiques sur un terme
      - annotation  : annoter des triplets (constitutif/contrastif/…)

    `term` optionnel : si vide, l'agent du flux tire un terme au hasard.
    `relation` optionnel (ex. 'r_isa'). `target_count` optionnel (nb d'items
    visés, 0 = défaut du flux). Le flux tourne en fond et apparaît dans la
    supervision ; suis-le avec list_runs / get_run, arrête-le avec stop_flow.
    """
    fid = (flow_id or "").strip().lower()
    if fid not in _VALID_FLOWS:
        return {"status": "error", "ok": False,
                "error": f"flow_id invalide : {flow_id!r}. Attendu : {sorted(_VALID_FLOWS)}.",
                "instruction": "Dis à l'utilisateur que le flux N'A PAS démarré (flow_id invalide). N'invente pas de succès."}
    params: dict = {}
    if term and term.strip():
        params["term"] = term.strip()
    if relation and relation.strip():
        params["relation"] = [relation.strip()]
    if target_count and int(target_count) > 0:
        params["target_count"] = int(target_count)
    res = _rt.start_flow(fid, params)
    # Échec réel (contrôleur non câblé, dispatch invalide, exception) :
    # statut error EXPLICITE + instruction de ne pas prétendre au succès.
    if res.get("error") or not res.get("run_id"):
        return {"status": "error", "ok": False,
                "error": res.get("error") or "Démarrage impossible (aucun run_id renvoyé).",
                "instruction": "Le flux N'A PAS démarré. Dis-le clairement à l'utilisateur "
                               "et n'invente NI succès NI identifiant."}
    return {"status": "started", "ok": True, "flow_id": fid,
            "run_id": res.get("run_id"),
            "instruction": "Le flux EST bien démarré en arrière-plan. Confirme-le à "
                           "l'utilisateur en langage humain (type + terme), sans afficher "
                           "le run_id. Il apparaîtra dans la supervision."}


@tool
def stop_flow(run_id: str) -> dict:
    """Arrête (annulation coopérative) un flux Jarvis en cours, par son
    run_id (cf. list_runs). L'arrêt prend effet entre deux étapes du flux
    (latence ~5-15s, le temps de l'appel LLM en cours). Idempotent : si le
    run est déjà terminé, renvoie son statut sans erreur.
    """
    rid = (run_id or "").strip()
    if not rid:
        return {"status": "error", "ok": False, "error": "run_id vide.",
                "instruction": "Impossible d'arrêter : aucun run_id. N'invente pas d'arrêt."}
    res = _rt.stop_flow(rid)
    if res.get("error"):
        return {"status": "error", "ok": False, "error": res["error"],
                "instruction": "L'arrêt a ÉCHOUÉ. Dis-le clairement, n'invente pas un arrêt réussi."}
    return {**res, "status": "stopping", "ok": True,
            "instruction": "Arrêt demandé (coopératif, effet en ~5-15s). Confirme à "
                           "l'utilisateur sans afficher le run_id."}


# ───────────────────────── tool : description des flux (lecture seule) ─────────────────────────

# flow_id (UI / start_flow) → fonction workflow canonique (jdm_tools).
_FLOW_WORKFLOWS = {
    "enrich": "enrichment_workflow",
    "audit": "audit_workflow",
    "gap": "gap_detection_workflow",
    "signalement": "error_detection_workflow",
    "stats": "stats_workflow",
    "annotation": "annotation_workflow",
}


def _condense_workflow(fid: str, full: dict, detailed: bool) -> dict:
    """Réduit le dict workflow verbeux à l'essentiel (titre + étapes + outils).
    `detailed=False` : juste titre + noms d'étapes (ultra compact, pour la
    liste). `detailed=True` : + intent court + outil de chaque étape."""
    steps_raw = full.get("steps") or []
    if not detailed:
        return {"flow_id": fid, "title": full.get("title"),
                "steps": [s.get("name") for s in steps_raw]}
    steps = [{"order": s.get("order"), "name": s.get("name"),
              "tools": s.get("tool")} for s in steps_raw]
    return {"flow_id": fid, "title": full.get("title"),
            "intent": full.get("intent"), "steps": steps}


@tool
def describe_flows(flow_id: str = "") -> dict:
    """Vue LECTURE SEULE des flux d'agents Jarvis : étapes et outils de chaque
    flow. À utiliser pour EXPLIQUER fidèlement comment un agent travaille —
    ne devine JAMAIS les étapes, lis-les ici.

    - flow_id vide → résumé compact de TOUS les flux (titre + noms d'étapes).
    - flow_id précis (enrich/audit/gap/signalement/stats/annotation) → détail
      du flow : intention + étapes + outil de chaque étape.

    N'EXÉCUTE rien : c'est purement descriptif. Pour LANCER un flux, utilise
    start_flow.
    """
    from jdm_agent.tools import jdm_tools as _jt
    fid = (flow_id or "").strip().lower()
    if fid:
        wf_name = _FLOW_WORKFLOWS.get(fid)
        if not wf_name:
            return {"error": f"flow_id invalide : {flow_id!r}. "
                             f"Attendu : {sorted(_FLOW_WORKFLOWS)}."}
        full = getattr(_jt, wf_name).invoke({})
        return _condense_workflow(fid, full, detailed=True)
    flows = []
    for k, wf_name in _FLOW_WORKFLOWS.items():
        try:
            full = getattr(_jt, wf_name).invoke({})
            flows.append(_condense_workflow(k, full, detailed=False))
        except Exception:
            continue
    return {"flows": flows, "note": "Pour le détail d'un flow, rappelle "
            "describe_flows(flow_id)."}


def build_supervision_tools() -> list:
    """Renvoie la liste des outils internes de supervision de la mascotte."""
    return [
        list_runs, get_run, list_productions, read_production, summarize_triplets,
        describe_flows,
        start_flow, stop_flow,
        get_config, set_config,
        read_env, set_env, rollback_env,
    ]
