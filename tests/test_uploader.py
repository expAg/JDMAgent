"""Tests de la soumission automatique au LLMDrops JDM (Phase 12)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import httpx
import respx

from jdm_agent.enrich import compute_submission_filename, submit_to_jdm
from jdm_agent.enrich.uploader import DEFAULT_ENDPOINT_URL


# -------------------- compute_submission_filename --------------------

def test_filename_basic_format():
    now = datetime(2026, 5, 27, 14, 32, 0)
    name = compute_submission_filename("claude-opus-4-7", now=now)
    assert name == "2026-05-27_14h32_automatic_submission_from_claude-opus-4-7.txt"


def test_filename_slug_spaces_to_underscores():
    now = datetime(2026, 1, 3, 9, 5, 0)
    name = compute_submission_filename("Claude Opus 4.7", now=now)
    # Les espaces → '_', le point conservé (autorisé en filename), pas de doublon.
    assert name == "2026-01-03_09h05_automatic_submission_from_Claude_Opus_4.7.txt"


def test_filename_slug_strips_dangerous_chars():
    now = datetime(2026, 12, 31, 23, 59, 0)
    name = compute_submission_filename("gpt-5/turbo:beta", now=now)
    # Slashes et deux-points → '_' (sécurité URL / shell).
    assert name == "2026-12-31_23h59_automatic_submission_from_gpt-5_turbo_beta.txt"


def test_filename_empty_model_falls_back():
    now = datetime(2026, 5, 27, 14, 32, 0)
    name = compute_submission_filename("", now=now)
    assert name == "2026-05-27_14h32_automatic_submission_from_unknown.txt"


def test_filename_only_unsafe_chars_falls_back():
    # Tout est strippé → fallback "unknown".
    now = datetime(2026, 5, 27, 14, 32, 0)
    name = compute_submission_filename("///!!!", now=now)
    assert "unknown" in name


# -------------------- submit_to_jdm --------------------

def test_submit_missing_file(tmp_path):
    out = submit_to_jdm(tmp_path / "does_not_exist.enrich", api_key="test-key")
    assert out["ok"] is False
    assert out["status_code"] == 0
    assert "introuvable" in out["error"]


def test_submit_missing_api_key(tmp_path, monkeypatch):
    """Sans api_key arg ni env → on n'upload pas mais on remonte l'erreur."""
    monkeypatch.delenv("JDM_DROPS_API_KEY", raising=False)
    p = tmp_path / "sub.enrich"
    p.write_text("chat | r_isa | mammifère | < oui >\n", encoding="utf-8")
    out = submit_to_jdm(p)
    assert out["ok"] is False
    assert "API" in out["error"] or "JDM_DROPS_API_KEY" in out["error"]
    # Mais le filename uploadé est quand même calculé (utile pour log).
    assert "_automatic_submission_from_" in out["uploaded_as"]
    assert out["uploaded_as"].endswith(".enrich")


@respx.mock
def test_submit_success_with_json_response(tmp_path):
    p = tmp_path / "sub.enrich"
    p.write_text("chat | r_isa | mammifère | < oui >\n", encoding="utf-8")

    route = respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"status": "ok", "drop_id": 42})
    )

    out = submit_to_jdm(p, api_key="secret-key", model_name="claude-opus-4-7")

    assert route.called
    assert out["ok"] is True
    assert out["status_code"] == 200
    assert out["response"] == {"status": "ok", "drop_id": 42}
    assert "_automatic_submission_from_claude-opus-4-7.enrich" in out["uploaded_as"]
    assert out["endpoint"] == DEFAULT_ENDPOINT_URL
    assert out["error"] is None

    # Vérifie que les headers / le multipart sont corrects.
    request = route.calls[0].request
    assert request.headers["X-API-Key"] == "secret-key"
    body = request.content.decode("utf-8", errors="replace")
    # Multipart contient le filename uploadé et le format=json.
    assert "_automatic_submission_from_claude-opus-4-7.enrich" in body
    assert "format" in body and "json" in body


@respx.mock
def test_submit_preserves_custom_extension(tmp_path):
    """RÉGRESSION (bug grave) : une extension CUSTOM d'agent sur mesure
    (.verifagent) doit être PRÉSERVÉE dans le nom uploadé — surtout pas
    écrasée en .enrich par une whitelist codée en dur."""
    p = tmp_path / "mon_run.verifagent"
    p.write_text("ligne 1\nligne 2\n", encoding="utf-8")
    respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    out = submit_to_jdm(p, api_key="k", model_name="gpt-5")
    assert out["uploaded_as"].endswith(".verifagent"), out["uploaded_as"]
    assert ".enrich" not in out["uploaded_as"]


@respx.mock
def test_submit_no_extension_falls_back_to_txt(tmp_path):
    """Fallback NEUTRE `.txt` quand le fichier n'a pas d'extension —
    JAMAIS `.enrich` (réservé au flux enrichissement)."""
    p = tmp_path / "noext"
    p.write_text("x\n", encoding="utf-8")
    respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    out = submit_to_jdm(p, api_key="k", model_name="gpt-5")
    assert out["uploaded_as"].endswith(".txt"), out["uploaded_as"]
    assert ".enrich" not in out["uploaded_as"]


@respx.mock
def test_submit_server_error(tmp_path):
    p = tmp_path / "sub.enrich"
    p.write_text("x\n", encoding="utf-8")
    respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(500, text="boom")
    )
    out = submit_to_jdm(p, api_key="k")
    assert out["ok"] is False
    assert out["status_code"] == 500
    assert out["response"] == "boom"   # text quand non-JSON
    assert "HTTP 500" in out["error"]


@respx.mock
def test_submit_uses_env_api_key_when_arg_empty(tmp_path, monkeypatch):
    monkeypatch.setenv("JDM_DROPS_API_KEY", "from-env")
    p = tmp_path / "sub.enrich"
    p.write_text("x\n", encoding="utf-8")
    route = respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    out = submit_to_jdm(p)
    assert out["ok"] is True
    assert route.calls[0].request.headers["X-API-Key"] == "from-env"


@respx.mock
def test_submit_arg_overrides_env(tmp_path, monkeypatch):
    monkeypatch.setenv("JDM_DROPS_API_KEY", "from-env")
    p = tmp_path / "sub.enrich"
    p.write_text("x\n", encoding="utf-8")
    route = respx.post(DEFAULT_ENDPOINT_URL).mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    submit_to_jdm(p, api_key="from-arg")
    assert route.calls[0].request.headers["X-API-Key"] == "from-arg"


@respx.mock
def test_submit_custom_endpoint(tmp_path):
    custom = "https://staging.jeuxdemots.org/LLMDrops.php"
    p = tmp_path / "sub.enrich"
    p.write_text("x\n", encoding="utf-8")
    respx.post(custom).mock(return_value=httpx.Response(200, json={"ok": True}))
    out = submit_to_jdm(p, api_key="k", endpoint_url=custom)
    assert out["ok"] is True
    assert out["endpoint"] == custom
