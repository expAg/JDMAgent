"""Extraction de claims structurées à partir d'un texte libre (via LLM)."""
from __future__ import annotations

from typing import Any, List

from pydantic import BaseModel, Field

from jdm_agent.factcheck.models import Claim


EXTRACTION_PROMPT = """Tu es un extracteur d'affirmations factuelles pour la base \
de connaissance JeuxDeMots (JDM).

Pour le texte fourni, extrais TOUTES les affirmations atomiques vérifiables \
sous forme de triplets `(subject, relation, object)` où `relation` est un nom \
technique JDM (commence par `r_`).

Relations JDM courantes :
- r_isa          : A est un B (générique/hyperonyme)              ex: chat r_isa mammifère
- r_carac        : A est <adj>                                     ex: eau r_carac liquide
- r_has_color    : A a pour couleur B                              ex: sang r_has_color rouge
- r_has_part     : A a pour partie B                               ex: voiture r_has_part roue
- r_agent        : verbe-A est typiquement fait par B              ex: manger r_agent chat
- r_patient      : verbe-A est typiquement appliqué à B            ex: lire r_patient livre
- r_instr        : verbe-A se fait avec B                          ex: couper r_instr couteau
- r_lieu         : A se trouve à B (ou verbe-A se passe à B)       ex: poisson r_lieu mer
- r_has_conseq   : A a pour conséquence B                          ex: pluie r_has_conseq inondation
- r_has_causatif : A a pour cause B                                ex: fatigue r_has_causatif travail
- r_telic_role   : A sert à faire B                                ex: couteau r_telic_role couper

Règles :
- subject et object EN MINUSCULES, à l'infinitif si verbe.
- Une phrase peut contenir PLUSIEURS claims (sépare-les).
- `polarity` = false pour les négations ("ne ... pas").
- Si la phrase n'est PAS factuellement vérifiable (opinion, métaphore vague), ignore-la.
- Si tu hésites entre plusieurs relations, prends la plus précise.
- `text` reproduit la formulation originale de la phrase ayant produit le claim.

Renvoie UNIQUEMENT la liste structurée — pas de commentaire libre.
"""


class _ClaimList(BaseModel):
    """Wrapper pour structured output (certains providers exigent un objet racine)."""
    claims: List[Claim] = Field(default_factory=list)


def extract_claims(text: str, llm: Any) -> List[Claim]:
    """Demande au LLM d'extraire des claims structurées du texte.

    Args:
        text: le texte à analyser.
        llm: une instance LangChain BaseChatModel supportant `with_structured_output`.

    Returns:
        Liste de `Claim` (peut être vide si aucune affirmation factuelle).
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    structured = llm.with_structured_output(_ClaimList)
    result: _ClaimList = structured.invoke([
        SystemMessage(content=EXTRACTION_PROMPT),
        HumanMessage(content=f"Texte à analyser :\n\n{text}"),
    ])
    return list(result.claims)
