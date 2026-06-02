"""Persistance pour le chat Jarvis (mascotte orchestratrice).

Deux responsabilités, sans dépendance externe (json + pathlib + threading) :

1. **Journal des runs** (`.jarvis_runs.jsonl`, append-only à la racine projet) :
   chaque run Jarvis terminé y écrit UNE ligne JSON avec ses stats finales
   (flow, statut, durée, tentatives, retenus, tokens, outils appelés, fichier
   produit). Au boot du serveur, on rejoue les N dernières lignes pour
   repeupler `bg_runs` en mémoire — le robot voit ainsi l'historique même
   après un redémarrage.

2. **Overlay d'environnement** (`.env.runtime.json`, racine projet) : permet
   au robot (via le tool `set_env`, protégé par mot de passe) de surcharger
   une variable d'env À CHAUD et de la PERSISTER. Appliqué à `os.environ`
   au boot. Garde un historique pour le `rollback_env`.

Les fichiers vivent à la RACINE du projet (à côté du vrai `.env`), pas dans
`/tmp` — pour survivre à un redémarrage applicatif.
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Optional

# Racine projet = parents[3] de src/jdm_agent/jarvis_chat/persistence.py
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
RUNS_LOG_PATH = _PROJECT_ROOT / ".jarvis_runs.jsonl"
ENV_OVERLAY_PATH = _PROJECT_ROOT / ".env.runtime.json"

_LOG_LOCK = threading.Lock()
_ENV_LOCK = threading.Lock()


# ───────────────────────── Journal des runs ─────────────────────────

def append_run_record(record: dict) -> None:
    """Append UNE ligne JSON au journal des runs. Idempotence non garantie
    (un même run_id peut apparaître plusieurs fois si appelé à tort) — le
    chargement dédoublonne par run_id en gardant la dernière occurrence."""
    try:
        line = json.dumps(record, ensure_ascii=False, default=str)
    except Exception:
        return
    with _LOG_LOCK:
        try:
            with RUNS_LOG_PATH.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass


def load_recent_runs(limit: int = 200) -> list[dict]:
    """Lit le journal et renvoie jusqu'à `limit` runs récents, dédoublonnés
    par run_id (dernière occurrence gagne), triés par started_at décroissant."""
    if not RUNS_LOG_PATH.exists():
        return []
    by_id: dict[str, dict] = {}
    order: list[str] = []
    with _LOG_LOCK:
        try:
            for raw in RUNS_LOG_PATH.read_text(encoding="utf-8").splitlines():
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except Exception:
                    continue
                rid = rec.get("run_id")
                if not rid:
                    continue
                # Rétro-compat : les anciens records utilisaient `flow_id`
                # (avant le renommage flux→agent). On normalise à la lecture.
                if "agent_id" not in rec and "flow_id" in rec:
                    rec["agent_id"] = rec.get("flow_id")
                if rid not in by_id:
                    order.append(rid)
                by_id[rid] = rec
        except OSError:
            return []
    runs = [by_id[r] for r in order]
    runs.sort(key=lambda r: r.get("started_at") or 0, reverse=True)
    return runs[:limit]


# ───────────────────────── Overlay d'environnement ─────────────────────────

def _read_overlay() -> dict:
    if not ENV_OVERLAY_PATH.exists():
        return {"current": {}, "history": []}
    try:
        data = json.loads(ENV_OVERLAY_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data.setdefault("current", {})
            data.setdefault("history", [])
            return data
    except Exception:
        pass
    return {"current": {}, "history": []}


def _write_overlay(data: dict) -> None:
    try:
        ENV_OVERLAY_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def apply_env_overlay() -> list[str]:
    """Applique l'overlay persisté à os.environ. Appelé au boot du serveur.
    Renvoie la liste des noms de variables appliquées."""
    with _ENV_LOCK:
        data = _read_overlay()
        applied = []
        for name, value in (data.get("current") or {}).items():
            if isinstance(name, str) and isinstance(value, str):
                os.environ[name] = value
                applied.append(name)
        return applied


def set_env_override(name: str, value: str) -> dict:
    """Pose `name=value` dans os.environ ET dans l'overlay persisté.
    Enregistre l'ancienne valeur dans l'historique pour le rollback.
    Renvoie {ok, name, previous_existed}."""
    with _ENV_LOCK:
        data = _read_overlay()
        # old = valeur courante dans os.environ (peut venir du vrai .env)
        old_present = name in os.environ
        old_value = os.environ.get(name)
        data.setdefault("history", []).append({
            "name": name,
            "old_value": old_value,
            "old_present": old_present,
            "new_value": value,
            "ts": time.time(),
        })
        data.setdefault("current", {})[name] = value
        _write_overlay(data)
        os.environ[name] = value
        return {"ok": True, "name": name, "previous_existed": old_present}


def rollback_env() -> dict:
    """Annule le DERNIER set_env_override : restaure l'ancienne valeur (ou
    supprime la variable si elle n'existait pas avant). Renvoie
    {ok, name, restored_to} ou {ok: False, error}."""
    with _ENV_LOCK:
        data = _read_overlay()
        history = data.get("history") or []
        if not history:
            return {"ok": False, "error": "Aucune modification d'env à annuler."}
        last = history.pop()
        name = last.get("name")
        # Restaure os.environ
        if last.get("old_present"):
            os.environ[name] = last.get("old_value") or ""
            restored = last.get("old_value")
        else:
            os.environ.pop(name, None)
            restored = None
        # Met à jour `current` : on recalcule depuis l'historique restant
        # (la dernière valeur survivante de `name`, sinon retire).
        cur = data.setdefault("current", {})
        remaining = [h for h in history if h.get("name") == name]
        if remaining and remaining[-1].get("new_value") is not None:
            cur[name] = remaining[-1]["new_value"]
            os.environ[name] = remaining[-1]["new_value"]
            restored = remaining[-1]["new_value"]
        else:
            cur.pop(name, None)
        _write_overlay(data)
        return {"ok": True, "name": name, "restored_to": restored}


def list_env_overrides() -> dict:
    """Diagnostic : renvoie les overrides courants (valeurs masquées) et
    le nombre d'entrées d'historique."""
    with _ENV_LOCK:
        data = _read_overlay()
        cur = data.get("current") or {}
        return {
            "overrides": {k: _mask(v) for k, v in cur.items()},
            "history_len": len(data.get("history") or []),
        }


def _mask(value: Optional[str]) -> str:
    if not value:
        return ""
    if len(value) <= 6:
        return "***"
    return value[:3] + "***" + value[-2:]
