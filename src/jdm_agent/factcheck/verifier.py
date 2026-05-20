"""Vérifie une `Claim` contre le graphe JDM — déterministe, sans LLM.

Stratégie en cascade :
  1. Cherche le triplet exact (subject, relation, object) via JDM.
  2. Si présent avec poids ≥ seuil → SUPPORTED.
  3. Sinon, cherche les synonymes de l'object — si l'un d'eux matche → SUPPORTED.
  4. Sinon, pour r_isa spécifiquement : si le top hyperonyme de subject est
     incompatible (via r_isa-incompatible) avec object → CONTRADICTED.
  5. Sinon → UNKNOWN.

La confiance est calibrée sur le poids du triplet trouvé (normalisé) ou
sur la force de l'évidence contraire.
"""
from __future__ import annotations

from typing import Optional

from jdm_agent.client import JDMClient
from jdm_agent.factcheck.models import Claim, Evidence, Status, Verdict


# Seuils par défaut (heuristiques, ajustables par relation).
DEFAULT_SUPPORT_MIN_W = 25.0
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
                            min_weight: float = 1.0, limit: int = 100) -> list:
    """Helper : liste les triplets sortants de subject pour ce type de relation.

    Renvoie [] silencieusement si le subject n'existe pas dans JDM (l'API renvoie 500).
    """
    rid = client.relation_type_id(relation_name)
    if rid is None:
        return []
    try:
        res = client.relations_from(subject, types_ids=[rid],
                                    min_weight=min_weight, limit=limit)
    except Exception:
        # Nœud inexistant (500), réseau, etc. — on traite comme absence de données.
        return []
    idx = res.node_index()
    out = []
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None:
            out.append((n.name, r.w))
    return out


def verify_claim(client: JDMClient, claim: Claim,
                 support_min_w: float = DEFAULT_SUPPORT_MIN_W) -> Verdict:
    """Vérifie une claim atomique contre JDM. Pas d'appel LLM."""
    # 1) Triplet direct
    triples = _relations_from_by_type(client, claim.subject, claim.relation, min_weight=1.0)
    if not triples and not client.relation_type_id(claim.relation):
        return Verdict(
            claim=claim, status=Status.UNKNOWN, confidence=0.0,
            explanation=f"Relation inconnue dans JDM : {claim.relation!r}.",
        )

    # 1a) Match exact (ou via décodage du nom JDM côté target)
    direct_hit = None
    for name, w in triples:
        if _matches(name, claim.object):
            direct_hit = (name, w)
            break
        # Vérifie aussi la forme décodée d'un refinement.
        dec = client.decode_node_name(name)
        if dec["is_refinement"] and _matches(dec["decoded"], claim.object):
            direct_hit = (name, w)
            break

    if direct_hit is not None:
        name, w = direct_hit
        # Confiance ~ tanh(w / STRONG_SUPPORT_W)
        import math
        conf = round(math.tanh(w / STRONG_SUPPORT_W), 3)
        ev = _to_evidence(client, claim.subject, claim.relation, name, w)
        verdict_status = Status.SUPPORTED if claim.polarity else Status.CONTRADICTED
        return Verdict(
            claim=claim, status=verdict_status, confidence=conf,
            evidence_for=[ev] if claim.polarity else [],
            evidence_against=[] if claim.polarity else [ev],
            explanation=(
                f"JDM contient directement le triplet "
                f"`{claim.subject} | {claim.relation} | {ev.target}` "
                f"avec poids {w:.0f}."
            ),
        )

    # 2) Pour r_isa : vérification d'incompatibilité AVANT la fallback synonymes.
    #    Évite les faux positifs du type "animal aquatique ~ poisson" qui
    #    conduiraient à valider à tort "baleine r_isa poisson".
    if claim.relation == "r_isa":
        contradicted_evidence = _check_isa_contradiction(client, claim, triples)
        if contradicted_evidence:
            return contradicted_evidence

    # 3) Match via synonymes de l'object (folk-taxonomy fallback)
    syn_id = client.relation_type_id("r_syn")
    if syn_id is not None:
        try:
            syns_res = client.relations_from(claim.object, types_ids=[syn_id],
                                              min_weight=support_min_w, limit=50)
            syn_names = {n.name for n in syns_res.nodes}
        except Exception:
            syn_names = set()
        for name, w in triples:
            if name in syn_names and w >= support_min_w:
                ev = _to_evidence(client, claim.subject, claim.relation, name, w)
                import math
                conf = round(math.tanh(w / STRONG_SUPPORT_W) * 0.85, 3)  # un peu décoté
                verdict_status = Status.SUPPORTED if claim.polarity else Status.CONTRADICTED
                return Verdict(
                    claim=claim, status=verdict_status, confidence=conf,
                    evidence_for=[ev] if claim.polarity else [],
                    evidence_against=[] if claim.polarity else [ev],
                    explanation=(
                        f"JDM contient `{claim.subject} | {claim.relation} | {name}` "
                        f"(w={w:.0f}), et {name!r} est synonyme de {claim.object!r}."
                    ),
                )

    # 4) Inconnu — JDM ne contient ni le triplet ni de contradiction explicite
    # Si on a vu des triplets pour ce type de relation mais pas notre object, c'est
    # un signal faible de contradiction (ex: chat r_isa mammifère, pas chat r_isa poisson).
    if triples and len(triples) >= 5:
        # Le top des génériques peut servir d'evidence_against indicative.
        top_against = [
            _to_evidence(client, claim.subject, claim.relation, n, w)
            for n, w in sorted(triples, key=lambda x: -x[1])[:5]
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


def _check_isa_contradiction(client: JDMClient, claim: Claim,
                              isa_triples: list) -> Optional[Verdict]:
    """Pour une claim r_isa, cherche si JDM a une incompatibilité explicite.

    Stratégie : pour chaque hyperonyme fort du subject (poids > 100), vérifie
    s'il existe (top_hypernym, r_isa-incompatible, claim.object) — si oui,
    contradiction forte.
    """
    incomp_id = client.relation_type_id("r_isa-incompatible")
    if incomp_id is None:
        return None

    # On scrute jusqu'à 30 hyperonymes (le bruit JDM type baleine→scie/homme
    # peut noyer le vrai générique — mammifère est au rang 25 pour baleine).
    # Chaque scan = 1 HTTP cached, donc ~30 appels max pour les cas durs ;
    # une fois la contradiction trouvée, on arrête.
    top_hypernyms = sorted(isa_triples, key=lambda x: -x[1])[:30]
    for hyp_name, hyp_w in top_hypernyms:
        if hyp_w < 50:
            continue
        # Saute les noms refinement (avocat>X>Y) — ils n'auront pas de
        # r_isa-incompatible directement attachée.
        if ">" in hyp_name:
            continue
        try:
            incomp = client.relations_from(hyp_name, types_ids=[incomp_id], min_weight=1.0)
            for r in incomp.relations:
                # Le target d'une r_isa-incompatible doit matcher claim.object
                idx = incomp.node_index()
                node = idx.get(r.node2)
                if node and _matches(node.name, claim.object):
                    ev_for_other = _to_evidence(client, claim.subject, "r_isa", hyp_name, hyp_w)
                    ev_incomp = _to_evidence(client, hyp_name, "r_isa-incompatible", node.name, r.w)
                    import math
                    conf = round(math.tanh((hyp_w + r.w) / (2 * STRONG_SUPPORT_W)), 3)
                    return Verdict(
                        claim=claim,
                        status=Status.CONTRADICTED,
                        confidence=conf,
                        evidence_against=[ev_for_other, ev_incomp],
                        explanation=(
                            f"JDM contredit : `{claim.subject} | r_isa | {hyp_name}` "
                            f"(w={hyp_w:.0f}) et `{hyp_name} | r_isa-incompatible | {claim.object}` "
                            f"(w={r.w:.0f}). Donc `{claim.subject}` ne peut pas être un "
                            f"`{claim.object}` (sauf polysémie)."
                        ),
                    )
        except Exception:
            continue
    return None
