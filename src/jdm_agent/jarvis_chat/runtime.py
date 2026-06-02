"""État partagé injecté pour le chat Jarvis.

Évite l'import circulaire avec `app_fastapi.py` : les tools de la mascotte
ont besoin de lire les runs vivants (`bg_runs`, qui vit dans app_fastapi) et
de signaler des patches de config au stream SSE. On expose ici des points
d'injection que app_fastapi câble au démarrage.

- `set_runs_provider(fn)` : `fn() -> list[dict]` snapshot des runs vivants.
  Le tool `list_runs`/`get_run` fusionne ça avec l'historique persisté.

- `_PENDING_CONFIG_PATCHES` (ContextVar) : le tool `set_config` y empile
  `{key, value}`. L'endpoint de chat draine cette liste après le tour de
  l'agent et émet un event SSE `config_patch` que le frontend applique à
  `localStorage.jdm_jarvis_config`.
"""
from __future__ import annotations

import contextvars
from typing import Callable, Optional

# Provider des runs vivants (snapshot de bg_runs côté app_fastapi).
_runs_provider: Optional[Callable[[], list]] = None


def set_runs_provider(fn: Callable[[], list]) -> None:
    global _runs_provider
    _runs_provider = fn


def get_live_runs() -> list:
    """Snapshot des runs vivants (peut être vide si non câblé / tests)."""
    if _runs_provider is None:
        return []
    try:
        return list(_runs_provider() or [])
    except Exception:
        return []


# Contrôleur de flux : start/stop de runs bg, injecté par app_fastapi
# (qui détient la machinerie _new_run + thread + cancel). La mascotte
# peut ainsi LANCER et ARRÊTER des flux à la demande, sans dépendre
# d'app_fastapi (anti-circulaire).
_flow_start = None  # (agent_id: str, params: dict) -> dict {run_id, headline}
_flow_stop = None   # (run_id: str) -> dict {ok, status, ...}


def set_agent_controller(start_fn, stop_fn) -> None:
    global _flow_start, _flow_stop
    _flow_start, _flow_stop = start_fn, stop_fn


def start_agent(agent_id: str, params: dict) -> dict:
    if _flow_start is None:
        return {"error": "Lancement de flux indisponible (contrôleur non câblé)."}
    try:
        return _flow_start(agent_id, params or {})
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


def stop_agent(run_id: str) -> dict:
    if _flow_stop is None:
        return {"error": "Arrêt de flux indisponible (contrôleur non câblé)."}
    try:
        return _flow_stop(run_id)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# Patches de config empilés par le tool set_config pendant un tour d'agent.
# ContextVar pour isoler par requête de chat (chaque appel /api/jarvis/chat
# pose sa propre liste fraîche).
_PENDING_CONFIG_PATCHES: contextvars.ContextVar = contextvars.ContextVar(
    "jarvis_chat_config_patches", default=None,
)


def begin_config_patch_capture() -> None:
    """Réinitialise la liste de patches pour le tour courant."""
    _PENDING_CONFIG_PATCHES.set([])


def push_config_patch(key: str, value) -> None:
    lst = _PENDING_CONFIG_PATCHES.get()
    if lst is None:
        lst = []
        _PENDING_CONFIG_PATCHES.set(lst)
    lst.append({"key": key, "value": value})


def drain_config_patches() -> list:
    """Renvoie et vide les patches accumulés ce tour."""
    lst = _PENDING_CONFIG_PATCHES.get() or []
    _PENDING_CONFIG_PATCHES.set([])
    return list(lst)


# Snapshot de la config Jarvis courante. Le serveur ne voit pas le
# localStorage du frontend ; l'endpoint de chat reçoit la config dans le
# payload de la requête et la pose ici pour que le tool `get_config` la lise.
# `set_config` met aussi à jour ce snapshot pour cohérence intra-tour.
_CONFIG_SNAPSHOT: contextvars.ContextVar = contextvars.ContextVar(
    "jarvis_chat_config_snapshot", default=None,
)


def set_config_snapshot(cfg: dict) -> None:
    _CONFIG_SNAPSHOT.set(dict(cfg or {}))


def get_config_snapshot() -> dict:
    return dict(_CONFIG_SNAPSHOT.get() or {})


def patch_config_snapshot(key: str, value) -> None:
    cfg = dict(_CONFIG_SNAPSHOT.get() or {})
    cfg[key] = value
    _CONFIG_SNAPSHOT.set(cfg)
