"""Pipeline complet : texte → claims → verdicts → Report."""
from __future__ import annotations

from typing import Any, Iterable, List, Optional

from jdm_agent.client import JDMClient
from jdm_agent.factcheck.extractor import extract_claims
from jdm_agent.factcheck.models import Claim, Report
from jdm_agent.factcheck.verifier import verify_claim


def factcheck(
    text: str,
    *,
    client: Optional[JDMClient] = None,
    llm: Optional[Any] = None,
    claims: Optional[Iterable[Claim]] = None,
    support_min_w: float = 25.0,
) -> Report:
    """Vérifie les claims (extraites ou fournies) d'un texte contre JDM.

    Args:
        text: le texte source (pour traçabilité dans le rapport).
        client: JDMClient. Créé par défaut.
        llm: LangChain ChatModel pour l'extraction. Inutile si `claims` est fourni.
        claims: claims pré-extraites (skip extraction). Si None, on appelle `llm`.
        support_min_w: poids minimum requis pour considérer une claim supportée
                       via un synonyme.

    Returns:
        `Report` avec un Verdict par claim.
    """
    if client is None:
        client = JDMClient()
    if claims is None:
        if llm is None:
            raise ValueError("Fournis soit `claims` (claims pré-extraites), soit `llm` (extraction LLM).")
        claims = extract_claims(text, llm)

    verdicts = [verify_claim(client, c, support_min_w=support_min_w) for c in claims]
    return Report(text=text, verdicts=verdicts)


def factcheck_claims(
    claims: Iterable[Claim],
    *,
    client: Optional[JDMClient] = None,
    support_min_w: float = 25.0,
) -> Report:
    """Variante directe sans extraction : tu fournis déjà les claims."""
    if client is None:
        client = JDMClient()
    verdicts = [verify_claim(client, c, support_min_w=support_min_w) for c in claims]
    return Report(text="", verdicts=verdicts)
