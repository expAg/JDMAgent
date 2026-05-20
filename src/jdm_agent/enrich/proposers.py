"""Proposition de candidats pour combler un gap (basée sur LLM)."""
from __future__ import annotations

from typing import Any, List

from pydantic import BaseModel, Field

from jdm_agent.client.relations import describe_relation, parse_relation_definitions
from jdm_agent.enrich.models import Candidate, Gap


PROPOSER_PROMPT = """Tu es un expert en linguistique française et en construction de \
graphes lexico-sémantiques pour JeuxDeMots (JDM).

Ton rôle : pour un gap donné (term, relation), proposer **5 à 10 termes cibles** \
plausibles qui complètent le triplet. Chaque proposition doit être :
- linguistiquement correcte
- factuelle (vérifiable, non-créative)
- en français standard, EN MINUSCULES
- au singulier (sauf si la cible est intrinsèquement pluriel)
- à l'infinitif pour les verbes

Pour CHAQUE candidat, fournis :
- `target`     : le terme cible
- `confidence` : 0.0–1.0 de ta certitude (1.0 = totalement standard)
- `rationale`  : 1 phrase courte expliquant pourquoi

Renvoie SEULEMENT la liste JSON, pas de commentaire libre.

Si tu ne connais pas la relation ou si elle est trop floue, renvoie une liste vide.
"""


class _RawCandidate(BaseModel):
    target: str
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    rationale: str = ""


class _CandidateList(BaseModel):
    candidates: List[_RawCandidate] = Field(default_factory=list)


def propose_candidates(gap: Gap, llm: Any, max_candidates: int = 10) -> List[Candidate]:
    """Demande au LLM de proposer des cibles pour combler le gap.

    Args:
        gap: le trou identifié.
        llm: instance LangChain BaseChatModel.
        max_candidates: limite haute.

    Returns:
        Liste de Candidate (non encore validés).
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    # Décrit la relation au LLM pour cadrer la sémantique.
    rel_docs = parse_relation_definitions()
    rel_desc = describe_relation(gap.relation, rel_docs)

    user_msg = (
        f"Gap à combler :\n"
        f"  term     = {gap.term!r}\n"
        f"  relation = {gap.relation!r}\n"
        f"  contexte = {gap.detail}\n\n"
        f"Description de la relation :\n{rel_desc}\n\n"
        f"Propose jusqu'à {max_candidates} cibles pertinentes."
    )

    structured = llm.with_structured_output(_CandidateList)
    try:
        out: _CandidateList = structured.invoke([
            SystemMessage(content=PROPOSER_PROMPT),
            HumanMessage(content=user_msg),
        ])
    except Exception:
        return []

    return [
        Candidate(
            term=gap.term, relation=gap.relation,
            target=rc.target, confidence=rc.confidence,
            rationale=rc.rationale, source="llm",
        )
        for rc in out.candidates[:max_candidates]
    ]
