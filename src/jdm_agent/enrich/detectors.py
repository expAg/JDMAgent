"""Détecte les trous de couverture dans JDM pour un terme donné.

Trois familles de gaps :
  - MISSING : aucun triplet (term, relation, ?) pour une relation pourtant
              utile pour ce type de terme.
  - LOW_COVERAGE : très peu de triplets (< seuil) alors que la PoS ou les
              co-hyponymes en ont beaucoup.
  - ASYMMETRY : un triplet A r_xxx B existe mais B r_inverse(xxx) A manque
              (relations symétriques ou conversives au sens JDM).

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

# Paires (relation directe, relation inverse) pour la détection d'asymétrie.
INVERSE_PAIRS: tuple[tuple[str, str], ...] = (
    ("r_has_part", "r_holo"),
    ("r_isa",      "r_hypo"),
    ("r_agent",    "r_agent-1"),
    ("r_patient",  "r_patient-1"),
    ("r_instr",    "r_instr-1"),
    ("r_lieu",     "r_lieu-1"),
    ("r_carac",    "r_carac-1"),
    ("r_make",     "r_product_of"),
    ("r_has_causatif", "r_has_conseq"),
    ("r_set>item", "r_item>set"),
    ("r_object>mater", "r_mater>object"),
)


def _count_relations(client: JDMClient, term: str, relation: str,
                     min_weight: float = 1.0, limit: int = 50) -> int:
    """Compte (avec un cap = limit) le nombre de triplets sortants."""
    rid = client.relation_type_id(relation)
    if rid is None:
        return 0
    try:
        res = client.relations_from(term, types_ids=[rid],
                                     min_weight=min_weight, limit=limit)
    except Exception:
        return 0
    return len(res.relations)


def _detect_missing(client: JDMClient, term: str,
                    relations: Iterable[str], min_to_consider: int = 1) -> list[Gap]:
    """Pour chaque relation cible, signale celle qui a < min_to_consider triplets."""
    gaps: list[Gap] = []
    for rel in relations:
        n = _count_relations(client, term, rel, min_weight=25, limit=50)
        if n == 0:
            gaps.append(Gap(
                term=term, relation=rel, gap_type=GapType.MISSING,
                severity=1.0,
                detail=f"Aucun triplet `{term} | {rel} | ?` (avec w≥25) dans JDM.",
            ))
        elif n < min_to_consider:
            gaps.append(Gap(
                term=term, relation=rel, gap_type=GapType.LOW_COVERAGE,
                severity=0.6,
                detail=f"Seulement {n} triplets `{term} | {rel} | ?` (w≥25).",
            ))
    return gaps


def _detect_asymmetries(client: JDMClient, term: str,
                        pairs: Iterable[tuple[str, str]] = INVERSE_PAIRS,
                        sample_size: int = 5,
                        min_weight: float = 50.0) -> list[Gap]:
    """Pour chaque triplet (term, R, target), vérifie si (target, R_inv, term) existe.

    On échantillonne les `sample_size` triplets de plus haut poids pour limiter
    les appels HTTP.
    """
    gaps: list[Gap] = []
    for rel, rel_inv in pairs:
        rid = client.relation_type_id(rel)
        rid_inv = client.relation_type_id(rel_inv)
        if rid is None or rid_inv is None:
            continue
        try:
            res = client.relations_from(term, types_ids=[rid],
                                         min_weight=min_weight, limit=sample_size)
        except Exception:
            continue
        idx = res.node_index()
        for r in res.relations[:sample_size]:
            target = idx.get(r.node2)
            if target is None or ">" in target.name:
                continue
            # Cherche (target, R_inv, term)
            try:
                back = client.relations_from(target.name, types_ids=[rid_inv],
                                              min_weight=1.0, limit=100)
            except Exception:
                continue
            idx_back = back.node_index()
            found = False
            for r2 in back.relations:
                n2 = idx_back.get(r2.node2)
                if n2 and n2.name == term:
                    found = True
                    break
            if not found:
                gaps.append(Gap(
                    term=target.name, relation=rel_inv,
                    gap_type=GapType.ASYMMETRY,
                    severity=0.7,
                    detail=(
                        f"`{term} | {rel} | {target.name}` existe (w={r.w:.0f}) "
                        f"mais l'inverse `{target.name} | {rel_inv} | {term}` manque."
                    ),
                    related_triples=[{
                        "source": term, "relation": rel,
                        "target": target.name, "w": r.w,
                    }],
                ))
    return gaps


def detect_gaps(
    client: JDMClient,
    term: str,
    target_relations: Optional[Iterable[str]] = None,
    check_asymmetries: bool = True,
    min_to_consider: int = 3,
) -> list[Gap]:
    """Point d'entrée principal : trouve les gaps d'un terme.

    Args:
        client: JDMClient.
        term: le terme à analyser.
        target_relations: relations à examiner (défaut: noun-typiques + verb-typiques).
        check_asymmetries: active la détection des asymétries (plus coûteux en HTTP).
        min_to_consider: seuil pour LOW_COVERAGE.
    """
    if target_relations is None:
        # On essaie les deux jeux ; les non-pertinents se traduiront par MISSING
        # qu'on pourra filtrer côté pipeline si besoin.
        target_relations = tuple(set(DEFAULT_TARGET_RELATIONS) | set(VERB_TARGET_RELATIONS))

    gaps: list[Gap] = []
    gaps.extend(_detect_missing(client, term, target_relations, min_to_consider))
    if check_asymmetries:
        gaps.extend(_detect_asymmetries(client, term))
    return gaps
