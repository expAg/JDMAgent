"""Proposeur d'annotations basé LLM.

L'annotation est PUREMENT un jugement linguistique (cf. le brief utilisateur :
le LLM utilise sa connaissance de locuteur, pas besoin de vérification d'outil).
Le proposeur reçoit une liste de triplets et la taxonomie, et renvoie pour
chaque triplet une catégorie (ou rien) + une justification courte.

L'annotation qualifie LE LIEN, pas le sujet. C'est explicite dans le prompt.
"""
from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field

from jdm_agent.annotate.models import (
    AnnotationProposal, parse_category,
)


PROPOSER_PROMPT = """Tu es un annotateur expert en sémantique pour le graphe \
JeuxDeMots (JDM).

Ta tâche : analyser des triplets (sujet | relation | objet) et leur attribuer \
l'annotation sémantique la plus pertinente parmi la TAXONOMIE STRICTE suivante :

- `constitutif` : le trait est une définition essentielle, sans laquelle \
l'entité perd son essence.
- `contrastif` : le trait est une différenciation clé qui permet de distinguer \
l'entité de ses pairs proches dans la même catégorie.
- `non spécifique` : la propriété est vraie mais trop triviale, générique ou \
partagée par trop de concepts pour être informative.
- `exception` : le lien est valide mais ne s'applique que dans un cadre restreint \
ou est contredit par un sous-type majeur.

RÈGLES :
1. Analyse la PROFONDEUR SÉMANTIQUE, pas seulement la vérité factuelle.
2. Si AUCUNE catégorie ne convient, renvoie `category=""` (chaîne vide).
3. Les termes complexes (ex: `avocat>116477>66699`, `souris (informatique)`) \
sont des unités sémantiques distinctes — respecte le sens indiqué entre \
parenthèses ou par le raffinement.
4. L'annotation QUALIFIE LE LIEN avec l'objet cible, PAS l'objet en lui-même.
5. Exemple : `Avocat (Juriste) | r_isa | Juriste` → `constitutif` (définition \
intrinsèque). Mais `Avocat (Juriste) | r_isa | Humain` → `non spécifique` \
(vrai mais ne distingue pas l'avocat des autres humains).

Pour CHAQUE triplet fourni, produis :
- `index`         : l'index du triplet dans la liste (0-based)
- `category`      : la catégorie (en français, EXACTEMENT comme ci-dessus) ou \
"" si non annotable
- `justification` : 1 phrase courte (< 25 mots) qui explique le choix

Renvoie SEULEMENT la liste JSON, pas de commentaire libre."""


class _RawAnnotation(BaseModel):
    index: int = Field(..., ge=0)
    category: str = Field("", description="constitutif|contrastif|non spécifique|exception| (vide)")
    justification: str = Field("", description="phrase courte")


class _AnnotationList(BaseModel):
    annotations: List[_RawAnnotation] = Field(default_factory=list)


def propose_annotations(
    triplets: List[dict],
    llm: Any,
    *,
    existing_jdm_by_index: Optional[dict[int, str]] = None,
) -> List[AnnotationProposal]:
    """Demande au LLM d'annoter chaque triplet de la liste.

    Args:
        triplets: liste de dicts `{subject, relation, target}`. Les valeurs sont
            telles qu'elles seront affichées (déjà décodées ou sous forme raffinée
            explicite type `avocat (juriste)`).
        llm: instance LangChain BaseChatModel.
        existing_jdm_by_index: facultatif — index → annotation déjà existante
            dans JDM pour ce triplet (forme texte brute, ex. `"constitutif"`).
            Stocké sur la proposition pour détecter les désaccords.

    Returns:
        Liste de `AnnotationProposal` indexée parallèle à `triplets` (taille
        identique, dans le même ordre). Les triplets que le LLM n'a pas annotés
        reçoivent `category=None`.
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    if not triplets:
        return []

    # Construit la liste numérotée pour le LLM
    lines = []
    for i, t in enumerate(triplets):
        lines.append(
            f"  {i}. {t['subject']} | {t['relation']} | {t['target']}"
        )
    user_msg = (
        f"Triplets à annoter ({len(triplets)}) :\n"
        + "\n".join(lines)
        + "\n\nAnnote chacun selon la taxonomie. Renvoie la liste complète."
    )

    structured = llm.with_structured_output(_AnnotationList)
    try:
        out: _AnnotationList = structured.invoke([
            SystemMessage(content=PROPOSER_PROMPT),
            HumanMessage(content=user_msg),
        ])
    except Exception:
        # Échec LLM : aucune annotation produite, retourne des stubs
        return [
            AnnotationProposal(
                subject=t["subject"], relation=t["relation"], target=t["target"],
                category=None, justification="",
                existing_jdm=(existing_jdm_by_index or {}).get(i),
            )
            for i, t in enumerate(triplets)
        ]

    # Indexe par triplet, défaut = pas d'annotation
    by_idx: dict[int, _RawAnnotation] = {}
    for a in out.annotations:
        if 0 <= a.index < len(triplets):
            by_idx[a.index] = a

    proposals: List[AnnotationProposal] = []
    for i, t in enumerate(triplets):
        raw = by_idx.get(i)
        cat = parse_category(raw.category) if raw else None
        proposals.append(AnnotationProposal(
            subject=t["subject"], relation=t["relation"], target=t["target"],
            category=cat,
            justification=(raw.justification if raw else "").strip(),
            existing_jdm=(existing_jdm_by_index or {}).get(i),
        ))
    return proposals
