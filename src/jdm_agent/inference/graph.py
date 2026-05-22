"""Accès bornés au graphe JDM pour le moteur d'inférence.

Toutes les lectures passent par un `LookupBudget` (1 unité par appel
`relations_from`) et par un cache mémoire local à une inférence (`mem`),
qui évite de re-dépenser le budget pour un couple `(terme, relation)`
déjà consulté. Le cache disque de `JDMClient` couvre, lui, les inférences
successives.
"""
from __future__ import annotations

from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.inference.budget import LookupBudget


def norm(s: str) -> str:
    """Normalisation simple pour matcher des noms (casse, espaces)."""
    return (s or "").strip().lower()


def outgoing(client: JDMClient, budget: LookupBudget, mem: dict,
             term: str, relation: str) -> list[tuple[str, float, int]]:
    """Triplets sortants `(term, relation, ?)`.

    Renvoie `[(name, w, rel_id), ...]`. 1 appel HTTP (sauf hit `mem`).
    `[]` si la relation est inconnue de JDM ou en cas d'erreur réseau.
    """
    key = (norm(term), relation)
    if key in mem:
        return mem[key]
    rid = client.relation_type_id(relation)
    if rid is None:
        mem[key] = []
        return []
    budget.spend(1)  # une lecture JDM consommée
    try:
        res = client.relations_from(term, types_ids=[rid])
    except Exception:
        mem[key] = []
        return []
    idx = res.node_index()
    out: list[tuple[str, float, int]] = []
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None:
            out.append((n.name, r.w, r.id))
    mem[key] = out
    return out


def edge_weight(client: JDMClient, budget: LookupBudget, mem: dict,
                source: str, relation: str, target: str) -> float:
    """Poids signé du triplet exact `(source, relation, target)`, 0 si absent.

    Matching insensible à la casse + décodage des refinements opaques.
    """
    rows = outgoing(client, budget, mem, source, relation)
    tgt = norm(target)
    for name, w, _rid in rows:
        if norm(name) == tgt:
            return w
        try:
            dec = client.decode_node_name(name)
        except Exception:
            continue
        if dec.get("is_refinement") and norm(dec.get("decoded", "")) == tgt:
            return w
    return 0.0


def display(client: JDMClient, name: str) -> str:
    """Nom lisible d'un nœud (décodage refinement ; sûr en cas d'erreur)."""
    try:
        return client.decode_node_name(name).get("decoded", name)
    except Exception:
        return name


def topk_positive(rows: list[tuple[str, float, int]], k: int
                  ) -> list[tuple[str, float, int]]:
    """Trie les triplets par poids positif décroissant, tronque à `k`."""
    pos = [(n, w, rid) for n, w, rid in rows if w > 0]
    pos.sort(key=lambda x: -x[1])
    return pos[:max(1, k)]


def generics(client: JDMClient, budget: LookupBudget, mem: dict,
             term: str, k: int,
             relations: Optional[tuple[str, ...]] = None
             ) -> list[tuple[str, float, str]]:
    """Sur-ensembles d'un terme : hyperonymes (r_isa) + synonymes (r_syn).

    Renvoie `[(name, w, via_relation), ...]` dédupliqué, top-k par poids.
    """
    from jdm_agent.inference.constants import GENERIC_RELATIONS
    rels = relations or GENERIC_RELATIONS
    collected: list[tuple[str, float, str]] = []
    for rel in rels:
        for name, w, _rid in outgoing(client, budget, mem, term, rel):
            if w > 0:
                collected.append((name, w, rel))
    collected.sort(key=lambda x: -x[1])
    seen: set[str] = set()
    uniq: list[tuple[str, float, str]] = []
    for name, w, rel in collected:
        kk = norm(name)
        if kk in seen or kk == norm(term):
            continue
        seen.add(kk)
        uniq.append((name, w, rel))
    return uniq[:max(1, k)]
