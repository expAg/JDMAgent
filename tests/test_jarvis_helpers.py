"""Tests pour les builders de pré-prompts Jarvis (Phase 13).

Vérifie que :
- les phrases relatives au budget n'apparaissent QUE si le budget est borné
- le terme et la relation sont bien injectés
- la mention de l'upload est conditionnelle
- chaque builder mentionne explicitement le workflow tool qu'il déclenche
"""
from __future__ import annotations

import pytest

from jarvis import (
    BUDGET_LABEL_TO_LIMIT,
    _is_bounded_budget,
    build_audit_prompt,
    build_enrich_prompt,
    build_gap_prompt,
    build_signalement_prompt,
    build_stats_prompt,
    detect_rate_limit_retry,
    is_invalid_api_key,
    is_per_day_quota_exhausted,
)


# ---------- detect_rate_limit_retry ----------

_GEMINI_429_PERMINUTE = (
    "Error calling model 'gemini-3.1-flash-lite' (RESOURCE_EXHAUSTED): 429 "
    "RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded "
    "your current quota. Quota exceeded for metric: "
    "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, "
    "limit: 250000, model: gemini-3.1-flash-lite\\nPlease retry in 44.989s.', "
    "'status': 'RESOURCE_EXHAUSTED', 'details': [{'quotaId': "
    "'GenerateContentInputTokensPerModelPerMinute-FreeTier', "
    "'quotaDimensions': {'location': 'global', 'model': 'gemini-3.1-flash-lite'}}, "
    "{'retryDelay': '44s'}]}}"
)


def test_detect_rate_limit_per_minute_extracts_delay():
    """Sur un quota PerMinute Gemini, renvoie le délai (+1s de marge)."""
    delay = detect_rate_limit_retry(Exception(_GEMINI_429_PERMINUTE))
    assert delay is not None
    assert 45.0 <= delay <= 46.0  # 44.989 + 1.0 marge


def test_detect_rate_limit_per_day_returns_none():
    """Quota PerDay : detect_rate_limit_retry renvoie None (pas de
    retry, on traite via is_per_day_quota_exhausted en amont)."""
    msg = _GEMINI_429_PERMINUTE.replace("PerMinute", "PerDay")
    assert detect_rate_limit_retry(Exception(msg)) is None


def test_is_per_day_quota_exhausted_detects_per_day():
    """Detect du quota quotidien épuisé."""
    msg = _GEMINI_429_PERMINUTE.replace("PerMinute", "PerDay")
    assert is_per_day_quota_exhausted(Exception(msg)) is True


def test_is_per_day_quota_exhausted_false_on_per_minute():
    """PerMinute n'est PAS un quota quotidien."""
    assert is_per_day_quota_exhausted(Exception(_GEMINI_429_PERMINUTE)) is False


def test_is_per_day_quota_exhausted_false_on_non_quota():
    """Erreur générique : pas un quota."""
    assert is_per_day_quota_exhausted(ValueError("foo")) is False


_GEMINI_400_INVALID_KEY = (
    "Error calling model 'gemini-3.1-flash-lite' (INVALID_ARGUMENT): 400 "
    "INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not "
    "valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', "
    "'details': [{'reason': 'API_KEY_INVALID', "
    "'domain': 'googleapis.com'}]}}"
)


def test_is_invalid_api_key_detects_400():
    """Détection de la clé Google invalide (400 INVALID_ARGUMENT)."""
    assert is_invalid_api_key(Exception(_GEMINI_400_INVALID_KEY)) is True


def test_is_invalid_api_key_false_on_quota():
    """Une 429 quota n'est PAS une clé invalide."""
    assert is_invalid_api_key(Exception(_GEMINI_429_PERMINUTE)) is False


def test_is_invalid_api_key_false_on_other():
    """Erreur générique : pas une clé invalide."""
    assert is_invalid_api_key(ValueError("foo")) is False
    assert is_invalid_api_key(Exception("Connection refused")) is False


def test_is_per_day_quota_exhausted_filter_by_model():
    """Avec expected_model, ne renvoie True QUE si le quota PerDay
    concerne le modèle attendu."""
    msg = _GEMINI_429_PERMINUTE.replace("PerMinute", "PerDay")
    # Sans filtre → True
    assert is_per_day_quota_exhausted(Exception(msg)) is True
    # Avec filtre matchant → True
    assert is_per_day_quota_exhausted(
        Exception(msg), expected_model="gemini-3.1-flash-lite"
    ) is True
    # Avec filtre différent → False (le quota concernait 3.1, pas 2.5)
    assert is_per_day_quota_exhausted(
        Exception(msg), expected_model="gemini-2.5-flash-lite"
    ) is False


# ---------- Pool de clés Google API ----------


def test_google_api_keys_pool_csv():
    """Parse CSV de GOOGLE_API_KEYS."""
    import os
    import importlib
    saved_csv = os.environ.get("GOOGLE_API_KEYS")
    saved_single = os.environ.get("GOOGLE_API_KEY")
    try:
        os.environ.pop("GOOGLE_API_KEY", None)
        os.environ["GOOGLE_API_KEYS"] = "key_aaa,key_bbb,  key_ccc  "
        import app
        importlib.reload(app)
        keys = app._parse_google_keys()
        assert keys == ["key_aaa", "key_bbb", "key_ccc"]
        assert app.gemini_pool_size() == 3
        MODEL = "gemini-3.1-flash-lite"
        OTHER = "gemini-3.5-flash"
        # Pick : première par défaut
        assert app.pick_unblown_gemini_key(MODEL) == "key_aaa"
        # Skip : suivante
        assert app.pick_unblown_gemini_key(MODEL, skip="key_aaa") == "key_bbb"
        # Mark blown sur MODEL : la pick suivante saute pour MODEL
        app.mark_gemini_key_blown("key_aaa", MODEL)
        assert app.pick_unblown_gemini_key(MODEL) == "key_bbb"
        # MAIS la même clé reste DISPO pour OTHER (quota séparé par modèle)
        assert app.pick_unblown_gemini_key(OTHER) == "key_aaa"
        app.mark_gemini_key_blown("key_bbb", MODEL)
        assert app.pick_unblown_gemini_key(MODEL) == "key_ccc"
        app.mark_gemini_key_blown("key_ccc", MODEL)
        assert app.pick_unblown_gemini_key(MODEL) is None  # MODEL : tout blown
        assert app.pick_unblown_gemini_key(OTHER) == "key_aaa"  # OTHER : intact
    finally:
        if saved_csv is not None:
            os.environ["GOOGLE_API_KEYS"] = saved_csv
        else:
            os.environ.pop("GOOGLE_API_KEYS", None)
        if saved_single is not None:
            os.environ["GOOGLE_API_KEY"] = saved_single


def test_google_api_keys_fallback_singular():
    """Si GOOGLE_API_KEYS vide, on lit GOOGLE_API_KEY singulier."""
    import os
    import importlib
    saved_csv = os.environ.get("GOOGLE_API_KEYS")
    saved_single = os.environ.get("GOOGLE_API_KEY")
    try:
        os.environ.pop("GOOGLE_API_KEYS", None)
        os.environ["GOOGLE_API_KEY"] = "lonely_key"
        import app
        importlib.reload(app)
        keys = app._parse_google_keys()
        assert keys == ["lonely_key"]
        assert app.gemini_pool_size() == 1
    finally:
        if saved_csv is not None:
            os.environ["GOOGLE_API_KEYS"] = saved_csv
        else:
            os.environ.pop("GOOGLE_API_KEYS", None)
        if saved_single is not None:
            os.environ["GOOGLE_API_KEY"] = saved_single
        else:
            os.environ.pop("GOOGLE_API_KEY", None)


def test_detect_rate_limit_non_429_returns_none():
    """Exception non-quota → None."""
    assert detect_rate_limit_retry(ValueError("invalid input")) is None
    assert detect_rate_limit_retry(Exception("Connection refused")) is None


def test_detect_rate_limit_too_long_returns_none():
    """Délai > 120s → on n'attend pas (probablement per-day déguisé)."""
    msg = _GEMINI_429_PERMINUTE.replace("retry in 44.989s", "retry in 600s")
    msg = msg.replace("'retryDelay': '44s'", "'retryDelay': '600s'")
    assert detect_rate_limit_retry(Exception(msg)) is None


# ---------- _is_bounded_budget ----------

@pytest.mark.parametrize("label,expected", [
    ("25", True),
    ("100", True),
    ("1", True),
    ("illimité", False),
    ("illimite", False),
    ("unlimited", False),
    ("0", False),
    ("", False),
    ("none", False),
    ("abc", False),
])
def test_bounded_budget(label, expected):
    assert _is_bounded_budget(label) is expected


def test_budget_label_to_limit_dropdown_values():
    """Tous les choix du dropdown UI doivent être mappés (et 'illimité' → None)."""
    assert BUDGET_LABEL_TO_LIMIT["10"] == 10
    assert BUDGET_LABEL_TO_LIMIT["25"] == 25
    assert BUDGET_LABEL_TO_LIMIT["50"] == 50
    assert BUDGET_LABEL_TO_LIMIT["100"] == 100
    assert BUDGET_LABEL_TO_LIMIT["illimité"] is None


# ---------- build_enrich_prompt ----------

def test_enrich_mentions_term_and_workflow():
    p = build_enrich_prompt("guitare")
    assert "guitare" in p
    assert "enrichment_workflow" in p
    assert "ENRICHIR" in p


def test_enrich_bounded_budget_mentions_sentinel():
    p = build_enrich_prompt("chat", budget_label="25")
    assert "25" in p
    assert "BUDGET_EXHAUSTED" in p
    assert "Budget" in p


def test_enrich_unlimited_skips_budget_mentions():
    """En illimité, AUCUNE mention de budget ni sentinel."""
    p = build_enrich_prompt("chat", budget_label="illimité", iterate=True)
    assert "BUDGET_EXHAUSTED" not in p
    assert "Budget" not in p
    # iterate doit toujours s'afficher (bloc PERSISTANCE ABSOLUE renforcé)
    # mais sans la clause « épuisement du budget »
    assert "PERSISTANCE" in p
    assert "ABANDONNE" in p  # « N'ABANDONNE JAMAIS »
    # Pas de mention de borne/épuisement du budget (le mot « BUDGET
    # ILLIMITÉ » peut apparaître mais pas « épuisement du budget »).
    assert "épuisement du budget" not in p
    assert "budget d'appels d'outils maximum" not in p


def test_enrich_upload_appears_only_if_true():
    p_off = build_enrich_prompt("x", upload=False)
    p_on = build_enrich_prompt("x", upload=True)
    assert "SANS upload" in p_off
    assert "upload=True" in p_on
    assert "LLMDrops" in p_on


def test_enrich_vary_appears_only_if_true():
    p_off = build_enrich_prompt("x", vary_relations=False)
    p_on = build_enrich_prompt("x", vary_relations=True)
    assert "Varie" not in p_off
    assert "Varie" in p_on


def test_enrich_relation_optional():
    p_no = build_enrich_prompt("x", relation="")
    p_yes = build_enrich_prompt("x", relation="r_isa")
    assert "Relation cible" not in p_no
    assert "r_isa" in p_yes


# ---------- Terme vide → tirage au hasard (tous les builders) ----------

def test_enrich_empty_term_triggers_random_pick():
    p = build_enrich_prompt("")
    assert "ENRICHIR un terme" in p or "hasard" in p
    # Le prompt doit pointer vers pick_random_term (outil dédié) plutôt
    # que demander au LLM de tirer lui-même + faire exists() derrière.
    assert "pick_random_term" in p


def test_audit_empty_term_triggers_random_polysemous_pick():
    p = build_audit_prompt("")
    assert "AUDITER un terme" in p
    assert "POLYSÉMIQUE" in p   # contrainte spécifique à l'audit
    assert "hasard" in p


def test_gap_empty_term_triggers_random_pick():
    p = build_gap_prompt("")
    assert "DÉTECTER les trous" in p
    assert "hasard" in p


def test_signalement_empty_term_triggers_random_pick():
    p = build_signalement_prompt("")
    assert "SIGNALER" in p
    assert "hasard" in p


def test_stats_empty_everything_triggers_random_pick():
    p = build_stats_prompt(term="", relation="")
    assert "hasard" in p


# ---------- build_audit_prompt ----------

def test_audit_mentions_workflow():
    p = build_audit_prompt("avocat")
    assert "AUDITER" in p
    assert "avocat" in p
    assert "audit_workflow" in p


def test_audit_unlimited_no_budget():
    p = build_audit_prompt("avocat", budget_label="illimité")
    assert "Budget" not in p


def test_audit_relation_optional():
    p_no = build_audit_prompt("x", relation="")
    p_yes = build_audit_prompt("x", relation="r_isa")
    assert "Restreins" not in p_no
    assert "r_isa" in p_yes


# ---------- build_gap_prompt ----------

def test_gap_mentions_workflow_and_routing():
    p = build_gap_prompt("smartphone")
    assert "smartphone" in p
    assert "gap_detection_workflow" in p
    assert "Enrichir" in p
    assert "Auditer" in p
    assert "Stats" in p


def test_gap_unlimited_no_budget():
    p = build_gap_prompt("smartphone", budget_label="illimité")
    assert "Budget" not in p


def test_gap_relations_list_injected():
    p_no = build_gap_prompt("x")
    p_yes = build_gap_prompt("x", relations=["r_isa", "r_has_part"])
    assert "r_isa" in p_yes and "r_has_part" in p_yes
    assert "Relations cibles" in p_yes
    # Sans relations imposées, l'agent choisit lui-même
    assert "choisis" in p_no.lower()


# ---------- build_signalement_prompt ----------

def test_signalement_mentions_workflow_and_judgment():
    p = build_signalement_prompt("baleine")
    assert "baleine" in p
    assert "error_detection_workflow" in p
    assert "JUGEMENT" in p


def test_signalement_unlimited_still_caps_suspects():
    """Même en illimité, on garde la limite à ~20 suspects."""
    p = build_signalement_prompt("x", budget_label="illimité")
    assert "Budget" not in p
    assert "20 suspects" in p


# ---------- build_stats_prompt ----------

def test_stats_per_term_mode():
    p = build_stats_prompt(term="chat")
    assert "PAR_TERME" in p
    assert "chat" in p
    assert "stats_workflow" in p


def test_stats_per_relation_mode():
    p = build_stats_prompt(relation="r_isa")
    assert "PAR_RELATION" in p
    assert "r_isa" in p


def test_stats_term_plus_relation_restricts():
    """term + relation → stats RESTREINTES à la relation, pas un balayage."""
    p = build_stats_prompt(term="chat", relation="r_isa")
    assert "chat" in p and "r_isa" in p
    assert "RESTREINTES" in p or "Limite-toi" in p


def test_stats_no_args_fallback():
    """Si rien n'est fourni, l'agent doit tirer un terme au hasard."""
    p = build_stats_prompt()
    assert "hasard" in p or "au hasard" in p


def test_stats_unlimited_no_budget():
    p = build_stats_prompt(term="x", budget_label="illimité")
    assert "Budget" not in p
