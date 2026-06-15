"""Soumission automatique au LLMDrops JDM (Phase 12).

Poste un fichier de soumission consolidé au endpoint LLMDrops de JDM,
sous un nom standardisé qui trace quel LLM l'a produit et quand. Conçu
pour être appelé depuis `write_submission_file` ou directement.

Configuration (cascade) :
  - api_key      : arg `api_key` → env `JDM_DROPS_API_KEY`
  - endpoint_url : arg `endpoint_url` → env `JDM_DROPS_URL` → défaut
  - model_name   : arg `model_name` → env `LLM_MODEL` → "gemini-3.1-flash-lite"

Le fichier est posté sous `compute_submission_filename(model_name)`,
indépendant du nom local sur disque (le LLMDrops voit toujours un nom
auto-descriptif, horodaté date-puis-heure pour un tri chronologique, type
`2026-05-27_14h32_automatic_submission_from_claude-sonnet-4-7.enrich`).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import httpx

# Charge le .env du projet pour que `JDM_DROPS_API_KEY`, `JDM_DROPS_URL` et
# `LLM_MODEL` soient disponibles même si l'appelant n'a pas importé d'autre
# composant qui charge dotenv (cas typique : `python -c "from jdm_agent.enrich
# import submit_to_jdm; ..."`).
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(override=False)
except Exception:
    pass


DEFAULT_ENDPOINT_URL = "http://jeuxdemots.org/LLMDrops.php"
# Modèle par défaut si l'appelant ne fournit pas model_name et que LLM_MODEL
# n'est pas défini dans l'env — c'est le modèle du pool gratuit utilisé
# partout par défaut (et non un placeholder « mcp_client » illisible).
_DEFAULT_MODEL = "gemini-3.1-flash-lite"


def submit_to_jdm(
    path: str | Path,
    *,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    endpoint_url: Optional[str] = None,
    timeout: float = 30.0,
) -> dict:
    """POST le fichier de soumission au endpoint LLMDrops.

    Args:
        path: chemin local du fichier à uploader. Son extension réelle est
            PRÉSERVÉE pour le nom soumis (y compris extensions custom des
            agents sur mesure : .verifagent, etc.).
        api_key: clé API (override env `JDM_DROPS_API_KEY` si fournie).
        model_name: nom du LLM source (override env `LLM_MODEL`, fallback "gemini-3.1-flash-lite").
        endpoint_url: URL du endpoint (override env `JDM_DROPS_URL`, fallback défaut).
        timeout: timeout HTTP en secondes.

    Returns:
        {"ok": bool, "status_code": int, "response": dict | str,
         "uploaded_as": str, "endpoint": str, "error": str | None}

        Ne lève jamais d'exception réseau / HTTP — toute erreur est captée
        et reportée dans `error` avec `ok=False`. L'appelant décide quoi
        en faire.
    """
    # Préparation du fichier
    p = Path(path)
    if not p.exists():
        return {
            "ok": False, "status_code": 0,
            "response": None, "uploaded_as": "",
            "endpoint": endpoint_url or "",
            "error": f"Fichier introuvable : {p}",
        }

    # Résolution des paramètres (cascade)
    key = api_key or os.environ.get("JDM_DROPS_API_KEY") or ""
    url = endpoint_url or os.environ.get("JDM_DROPS_URL") or DEFAULT_ENDPOINT_URL
    resolved_model = model_name or os.environ.get("LLM_MODEL") or _DEFAULT_MODEL
    # Extension dérivée du fichier source — on PRÉSERVE l'extension RÉELLE,
    # y compris les extensions CUSTOM des agents sur mesure (.verifagent, …).
    # ⚠️ NE PAS rabattre sur une whitelist codée en dur : c'était le bug qui
    # uploadait tout en .enrich quand l'extension n'était pas une des 5 natives,
    # écrasant silencieusement l'extension custom voulue par l'agent.
    # Fallback NEUTRE `.txt` si le fichier n'a réellement pas d'extension —
    # JAMAIS `.enrich` (réservé au flux enrichissement ; ne doit pas être
    # forcé sur un autre flux).
    src_ext = p.suffix.lower()
    if not src_ext or len(src_ext) < 2:
        src_ext = ".txt"
    uploaded_name = compute_submission_filename(resolved_model, extension=src_ext)

    if not key:
        return {
            "ok": False, "status_code": 0,
            "response": None, "uploaded_as": uploaded_name,
            "endpoint": url,
            "error": (
                "Clé API manquante : passe `api_key=...` ou définis "
                "`JDM_DROPS_API_KEY` dans l'env. Le fichier local a été "
                "écrit mais l'upload a été sauté."
            ),
        }

    headers = {"X-API-Key": key}
    data = {"format": "json"}

    try:
        with p.open("rb") as f:
            files = {"file": (uploaded_name, f, "text/plain")}
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, headers=headers, data=data, files=files)
    except httpx.HTTPError as e:
        return {
            "ok": False, "status_code": 0,
            "response": None, "uploaded_as": uploaded_name,
            "endpoint": url,
            "error": f"Erreur réseau / HTTP : {e}",
        }
    except OSError as e:
        return {
            "ok": False, "status_code": 0,
            "response": None, "uploaded_as": uploaded_name,
            "endpoint": url,
            "error": f"Erreur d'I/O sur le fichier : {e}",
        }

    # Parse la réponse — JSON si possible, brut sinon
    try:
        body: object = resp.json()
    except Exception:
        body = resp.text

    ok = 200 <= resp.status_code < 300
    return {
        "ok": ok,
        "status_code": resp.status_code,
        "response": body,
        "uploaded_as": uploaded_name,
        "endpoint": url,
        "error": None if ok else f"HTTP {resp.status_code}",
    }


# Re-export pour ergonomie depuis ce module
def compute_submission_filename(model_name: str, *, now=None,
                                extension: str = ".enrich") -> str:
    """Délègue à `jdm_agent.enrich.pipeline.compute_submission_filename`."""
    # Import local pour éviter une dépendance circulaire au load time
    from jdm_agent.enrich.pipeline import compute_submission_filename as _impl
    return _impl(model_name, now=now, extension=extension)
