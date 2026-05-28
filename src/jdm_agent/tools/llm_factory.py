"""LLM factory provider-agnostic.

S'appuie sur `langchain.chat_models.init_chat_model` qui supporte
"anthropic", "openai", "ollama", "google_genai", "azure_openai", etc.

Configuration via variables d'environnement :
    LLM_PROVIDER (défaut: anthropic)
    LLM_MODEL    (défaut: claude-sonnet-4-5)
    LLM_TEMPERATURE (défaut: 0)

La clé API spécifique au provider doit être présente dans l'env
(ANTHROPIC_API_KEY, OPENAI_API_KEY, ...). On charge un .env si présent.
"""
from __future__ import annotations

import os
from typing import Any, Optional

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(override=False)
except Exception:
    pass


_DEFAULT_PROVIDER = "anthropic"
_DEFAULT_MODEL = "claude-sonnet-4-5"


def get_llm(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    **kwargs: Any,
):
    """Instancie un chat model LangChain agnostique du provider.

    Exemples:
        get_llm()                                  # lit l'env
        get_llm(provider="openai", model="gpt-4o")
        get_llm(provider="ollama", model="llama3.1")
    """
    from langchain.chat_models import init_chat_model

    provider = provider or os.environ.get("LLM_PROVIDER", _DEFAULT_PROVIDER)
    model = model or os.environ.get("LLM_MODEL", _DEFAULT_MODEL)
    if temperature is None:
        # Défaut bumped : 0 = argmax greedy = mêmes mots à chaque
        # session. 1.2 = compromis variété/cohérence pour la plupart
        # des providers (échelle 0..1 ou 0..2 selon le provider).
        # Override via env LLM_TEMPERATURE pour les tests reproductibles
        # (LLM_TEMPERATURE=0) ou pour aller plus loin (1.5+).
        temperature = float(os.environ.get("LLM_TEMPERATURE", "1.2"))

    return init_chat_model(
        model=model,
        model_provider=provider,
        temperature=temperature,
        **kwargs,
    )
