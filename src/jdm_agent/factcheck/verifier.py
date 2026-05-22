"""Vérifie une `Claim` contre le graphe JDM.

Modèle « contenance vs inférence » (Phase 11), piloté par `effort` :

  * **effort = 0** — CONTENANCE pure. On ne répond que sur ce que JDM
    contient littéralement : le triplet exact `(subject, relation, object)`.
    Absent = UNKNOWN. Aucune déduction. C'est la « vue du réseau ».
  * **effort = 1** — direct d'abord ; si JDM est silencieux, repli sur le
    moteur d'inférence (schémas noyau). « Le fait est-il vrai / déductible ? »
  * **effort = 2** — idem avec la cascade d'inférence complète.

Un verdict inféré est TOUJOURS marqué (`Verdict.inference_schema` non nul) et
son explication précise que JDM ne contient pas directement le triplet — on
ne confond jamais contenance et déduction.
"""
from __future__ import annotations

import math
from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.factcheck.models import Claim, Evidence, Status, Verdict
from jdm_agent.inference import DEFAULT_MAX_DEPTH

# Constante de calibration utilisée UNIQUEMENT pour normaliser la confiance via
# `tanh(|w| / STRONG_SUPPORT_W)`. Pas un seuil de filtrage — un facteur d'échelle.
STRONG_SUPPORT_W = 100.0


def _to_evidence(client: JDMClient, source: str, rel: str, target: str, w: float) -> Evidence:
    """Convertit un triplet bas niveau en Evidence (avec décodage refinement)."""
    src_dec = client.decode_node_name(source)
    tgt_dec = client.decode_node_name(target)
    return Evidence(
        source=src_dec["decoded"],
        relation=rel,
        target=tgt_dec["decoded"],
        w=w,
        source_id=source if src_dec["is_refinement"] else None,
        target_id=target if tgt_dec["is_refinement"] else None,
    )


def _norm(s: str) -> str:
    """Normalisation simple pour matcher des noms (casse, espaces)."""
    return s.strip().lower()


def _matches(target_name: str, expected: str) -> bool:
    return _norm(target_name) == _norm(expected)


def _relations_from_by_type(client: JDMClient, subject: str, relation_name: str,
                            min_weight: Optional[float] = None,
                            limit: int = 500) -> list[tuple[str, float, int]]:
    """Helper : liste les triplets sortants de subject pour ce type de relation.

    Phase 9b : aucun seuil hardcodé. Si l'appelant ne précise pas min_weight,
    on ne transmet pas le filtre à JDM. Renvoie tuples (name, w, rel_id).
    """
    rid = client.relation_type_id(relation_name)
    if rid is None:
        return []
    try:
        res = client.relations_from(
            subject, types_ids=[rid],
            min_weight=min_weight,
            limit=limit,
        )
    except Exception:
        return []
    idx = res.node_index()
    out = []
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None:
            out.append((n.name, r.w, r.id))
    return out


def verify_claim(client: JDMClient, claim: Claim, *,
                 effort: int = 0,
                 budget: Optional[int] = None,
                 max_depth: int = DEFAULT_MAX_DEPTH) -> Verdict:
    """Vérifie une claim atomique contre JDM. Pas d'appel LLM.

    Args:
        client: JDMClient.
        claim: la claim à vérifier.
        effort: 0 = contenance pure (triplet exact uniquement) ; 1 = repli
            inférence noyau si JDM est silencieux ; 2 = inférence complète.
        budget: plafond d'appels HTTP pour l'inférence (None = défaut par effort).
        max_depth: profondeur max de l'inférence.

    Returns:
        `Verdict`. Si le verdict vient de l'inférence, `inference_schema` est
        renseigné et `inference_proof` détaille la chaîne de déduction.
    """
    triples = _relations_from_by_type(client, claim.subject, claim.relation)
    if not triples and not client.relation_type_id(claim.relation):
        return Verdict(
            claim=claim, status=Status.UNKNOWN, confidence=0.0,
            explanation=f"Relation inconnue dans JDM : {claim.relation!r}.",
        )

    # --- 1) Lookup DIRECT : le triplet exact existe-t-il ? (signe ±) ----------
    # C'est la « contenance » — la seule chose vraie à effort 0.
    direct_hit = None  # tuple (name, w, rel_id)
    for name, w, rid in triples:
        if _matches(name, claim.object):
            direct_hit = (name, w, rid)
            break
        dec = client.decode_node_name(name)
        if dec["is_refinement"] and _matches(dec["decoded"], claim.object):
            direct_hit = (name, w, rid)
            break

    if direct_hit is not None:
        name, w, rid = direct_hit
        jdm_says_yes = w > 0
        claim_says_yes = claim.polarity
        status = Status.SUPPORTED if (jdm_says_yes == claim_says_yes) else Status.CONTRADICTED
        conf = round(math.tanh(abs(w) / STRONG_SUPPORT_W), 3)

        try:
            annotations = client.get_annotations_for_triplet(rid)
        except Exception:
            annotations = []
        annot_str = ""
        if annotations:
            tops = ", ".join(f"{a.value} (w={a.w:.0f})" for a in annotations[:3])
            annot_str = f" Annotations JDM : {tops}."
        exceptions = [a for a in annotations if a.kind == "exception"]
        if exceptions:
            exc_str = ", ".join(a.value for a in exceptions[:3])
            annot_str += f" Exception(s) annotée(s) : {exc_str}."

        ev = _to_evidence(client, claim.subject, claim.relation, name, w)
        explanation = (
            f"JDM contient directement le triplet "
            f"`{claim.subject} | {claim.relation} | {ev.target}` avec poids "
            f"{w:.0f} ({'affirmation' if jdm_says_yes else 'négation'} consensuelle).{annot_str}"
        )
        return Verdict(
            claim=claim, status=status, confidence=conf,
            evidence_for=[ev] if status == Status.SUPPORTED else [],
            evidence_against=[ev] if status == Status.CONTRADICTED else [],
            explanation=explanation,
        )

    # --- 2) Repli INFÉRENCE (effort >= 1) ------------------------------------
    # Ne s'exécute QUE si le lookup direct est silencieux : l'inférence ne
    # surcharge jamais une réponse de contenance.
    if effort >= 1:
        inferred = _verdict_from_inference(client, claim, effort, budget, max_depth)
        if inferred is not None:
            return inferred

    # --- 3) UNKNOWN ----------------------------------------------------------
    # JDM ne contient pas le triplet et (effort 0) ou aucune inférence n'a
    # conclu. Si beaucoup de triplets existent pour ce type, on les liste à
    # titre INDICATIF (ne constitue pas une contradiction stricte).
    if triples and len(triples) >= 5:
        top_against = [
            _to_evidence(client, claim.subject, claim.relation, n, w)
            for n, w, _rid in sorted(triples, key=lambda x: -abs(x[1]))[:5]
        ]
        return Verdict(
            claim=claim, status=Status.UNKNOWN, confidence=0.3,
            evidence_against=top_against,
            explanation=(
                f"JDM ne contient pas le triplet `{claim.subject} | {claim.relation} | {claim.object}`. "
                f"Les valeurs connues pour `{claim.subject} | {claim.relation} | ?` sont listées dans "
                f"`evidence_against` à titre indicatif (ne constituent pas une contradiction stricte)."
            ),
        )

    return Verdict(
        claim=claim, status=Status.UNKNOWN, confidence=0.0,
        explanation=f"JDM ne contient pas d'information vérifiable pour `{claim.subject} | {claim.relation} | {claim.object}`.",
    )


def _verdict_from_inference(client: JDMClient, claim: Claim, effort: int,
                            budget: Optional[int], max_depth: int) -> Optional[Verdict]:
    """Tente un verdict par inférence. Renvoie None si l'inférence est silencieuse.

    Le verdict produit est toujours marqué (`inference_schema`) et son
    explication précise que JDM ne contient pas directement le triplet.
    """
    from jdm_agent.inference import infer

    res = infer(client, claim.subject, claim.relation, claim.object,
                effort=effort, budget=budget, max_depth=max_depth)
    if res.is_silent:
        return None

    proof_ev = [
        Evidence(source=s.source, relation=s.relation, target=s.target, w=s.w)
        for s in res.proof
    ]
    # res.is_true => JDM permet de déduire le triplet ; sinon il le réfute.
    jdm_says_yes = res.is_true
    status = Status.SUPPORTED if (jdm_says_yes == claim.polarity) else Status.CONTRADICTED
    explanation = (
        "JDM ne contient pas directement ce triplet — verdict obtenu par "
        f"inférence. {res.explanation}"
    )
    return Verdict(
        claim=claim, status=status, confidence=res.confidence,
        evidence_for=proof_ev if status == Status.SUPPORTED else [],
        evidence_against=proof_ev if status == Status.CONTRADICTED else [],
        explanation=explanation,
        inference_schema=res.fired_schema.value,
        inference_proof=proof_ev,
    )
