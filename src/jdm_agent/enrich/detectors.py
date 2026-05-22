"""Détecte les trous de couverture dans JDM pour un terme donné.

Trois familles de gaps :
  - MISSING : aucun triplet (term, relation, ?) pour une relation pourtant
              utile pour ce type de terme.
  - NEGATIVE_FILLED : que des triplets négatifs (JDM a regardé et dit non).
  - LOW_COVERAGE : très peu de triplets positifs (< seuil).

Pas d'appel LLM, déterministe, basé sur les requêtes JDM.
"""
from __future__ import annotations

from typing import Iterable, Optional

from jdm_agent.client import JDMClient
from jdm_agent.enrich.models import Gap, GapType


# Relations qu'on considère utile d'avoir pour la plupart des noms communs.
DEFAULT_TARGET_RELATIONS: tuple[str, ...] = (
    "r_has_part", "r_carac", "r_has_color", "r_telic_role",
    "r_lieu", "r_make", "r_object>mater",
)

# Relations qu'on considère utile pour les verbes.
VERB_TARGET_RELATIONS: tuple[str, ...] = (
    "r_agent", "r_patient", "r_instr", "r_lieu", "r_manner",
    "r_has_conseq", "r_has_causatif", "r_but",
)


def _get_relations_signed(client: JDMClient, term: str, relation: str,
                          limit: int = 50) -> list[tuple[str, float]]:
    """Récupère les triplets avec leur poids (signé), Phase 9b sans seuil.

    Renvoie [(target_name, w), ...]. Inclut tout ce que JDM renvoie par
    défaut (négatifs et faibles inclus).
    """
    rid = client.relation_type_id(relation)
    if rid is None:
        return []
    try:
        res = client.relations_from(term, types_ids=[rid], limit=limit)
    except Exception:
        return []
    idx = res.node_index()
    out = []
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None:
            out.append((n.name, r.w))
    return out


def _detect_missing(client: JDMClient, term: str,
                    relations: Iterable[str], min_to_consider: int = 1) -> list[Gap]:
    """Pour chaque relation cible, classifie en MISSING / NEGATIVE_FILLED / LOW_COVERAGE.

    Phase 9b : aucun seuil de poids hardcodé.
      - MISSING strict : aucun triplet (ni positif NI négatif)
      - NEGATIVE_FILLED : que des triplets négatifs (JDM a regardé et dit non)
      - LOW_COVERAGE : < min_to_consider triplets positifs
    """
    gaps: list[Gap] = []
    for rel in relations:
        signed = _get_relations_signed(client, term, rel)
        positives = [w for _, w in signed if w > 0]
        negatives = [(n, w) for n, w in signed if w < 0]
        n_pos = len(positives)
        if n_pos == 0 and len(negatives) > 0:
            top_neg = sorted(negatives, key=lambda x: x[1])[:3]
            detail_extras = "; ".join(f"{n} (w={w:.0f})" for n, w in top_neg)
            gaps.append(Gap(
                term=term, relation=rel, gap_type=GapType.NEGATIVE_FILLED,
                severity=0.3,
                detail=(f"JDM contient {len(negatives)} triplet(s) NÉGATIFS pour "
                        f"`{term} | {rel} | ?` : {detail_extras}. Pas un gap au "
                        f"sens strict — déjà rempli avec des assertions négatives."),
            ))
        elif n_pos == 0:
            gaps.append(Gap(
                term=term, relation=rel, gap_type=GapType.MISSING,
                severity=1.0,
                detail=f"Aucun triplet positif `{term} | {rel} | ?` dans JDM.",
            ))
        elif n_pos < min_to_consider:
            gaps.append(Gap(
                term=term, relation=rel, gap_type=GapType.LOW_COVERAGE,
                severity=0.6,
                detail=f"Seulement {n_pos} triplet(s) positif(s) `{term} | {rel} | ?`.",
            ))
    return gaps


def detect_gaps(
    client: JDMClient,
    term: str,
    target_relations: Optional[Iterable[str]] = None,
    min_to_consider: int = 3,
) -> list[Gap]:
    """Point d'entrée principal : trouve les gaps de couverture d'un terme.

    Args:
        client: JDMClient.
        term: le terme à analyser.
        target_relations: relations à examiner (défaut: noun-typiques + verb-typiques).
        min_to_consider: seuil pour LOW_COVERAGE (< N triplets positifs).
    """
    if target_relations is None:
        # On essaie les deux jeux ; les non-pertinents se traduiront par MISSING
        # qu'on pourra filtrer côté pipeline si besoin.
        target_relations = tuple(set(DEFAULT_TARGET_RELATIONS) | set(VERB_TARGET_RELATIONS))

    return _detect_missing(client, term, target_relations, min_to_consider)
