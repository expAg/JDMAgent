"""Moteur d'inférence JDM — cascade de schémas, bornée par budget (Phase 11).

`infer(client, subject, relation, object, *, effort=...)` essaie une cascade
de schémas d'inférence (du moins cher au plus cher) et s'arrête au premier
qui conclut. Renvoie un `InferenceResult` dont `signed_weight` porte le
verdict : > 0 vrai, < 0 faux/réfuté, 0 silence.

Inspiré du moteur PHP `infer_answer` — adapté : typé, structuré, et surtout
**borné** (un `LookupBudget` coupe net pour rester « pas trop gourmand »).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from jdm_agent.client import JDMClient
from jdm_agent.inference.budget import BudgetExhausted, LookupBudget
from jdm_agent.inference.constants import (
    BUDGET_BY_EFFORT,
    COMPOSITION_MAP,
    DEFAULT_MAX_DEPTH,
    DEFAULT_TOP_K,
    IMPLICATION_MAP,
    INVERSE_RELATIONS,
    REFUTATION_SCAN,
    RELATION_PHRASES,
    SCHEMA_LABELS,
    STRONG_SUPPORT_W,
    TRANSITIVE_RELATIONS,
)
from jdm_agent.inference.graph import (
    display,
    edge_weight,
    generics,
    norm,
    outgoing,
    topk_positive,
)
from jdm_agent.inference.models import FiredSchema, InferenceResult, ProofStep


# ---------- Contexte d'une inférence ----------

@dataclass
class _Ctx:
    client: JDMClient
    budget: LookupBudget
    subject: str
    relation: str
    object: str
    top_k: int
    max_depth: int
    effort: int
    mem: dict = field(default_factory=dict)


# Helpers liés au contexte (consomment le budget via graph.py).
def _out(ctx: _Ctx, term: str, rel: str):
    return outgoing(ctx.client, ctx.budget, ctx.mem, term, rel)


def _ew(ctx: _Ctx, src: str, rel: str, tgt: str) -> float:
    return edge_weight(ctx.client, ctx.budget, ctx.mem, src, rel, tgt)


def _disp(ctx: _Ctx, name: str) -> str:
    return display(ctx.client, name)


def _gens(ctx: _Ctx, term: str, k: int | None = None):
    return generics(ctx.client, ctx.budget, ctx.mem, term, k or ctx.top_k)


# ---------- Construction du résultat ----------

# Facteur de soundness par schéma : la confiance finale est pondérée par ce
# facteur. Les schémas SAINS (transitivité, inverse, déduction-ISA) gardent
# une confiance pleine ; les schémas LÂCHES (synonymie, association, double-ISA)
# sont délibérément décotés — la substitution par synonyme/association n'est
# pas une équivalence stricte (ex. « pénis r_syn sexe » est en réalité une
# hyperonymie : on doit donc rester prudent sur ce type de déduction).
SCHEMA_CONFIDENCE: dict[FiredSchema, float] = {
    FiredSchema.TAUTOLOGY:        1.00,
    FiredSchema.CONTRADICTION:    1.00,
    FiredSchema.INVERSE:          1.00,
    FiredSchema.IMPLICATION:      0.95,
    FiredSchema.ISA_INCOMPATIBLE: 0.95,
    FiredSchema.CLASS_ELIM:       0.90,
    FiredSchema.ANTONYM_CONTRAST: 0.88,
    FiredSchema.COHYPONYM:        0.85,
    FiredSchema.DEDUCTION_ISA:    0.90,
    FiredSchema.TRANSITIVITY:     0.90,
    FiredSchema.GEO_PROPAGATION:  0.88,
    FiredSchema.HYPONYM_PROP:     0.85,
    FiredSchema.PREFIX:           0.85,
    FiredSchema.COMPOSITION:      0.80,
    FiredSchema.SYNONYM_EQUIV:    0.70,
    FiredSchema.TARGET_GENERIC:   0.60,
    FiredSchema.DOUBLE_ISA:       0.55,
}


# Mots de négation par premier mot de la locution (rendu naturel).
_NEG_FIRST: dict[str, str] = {
    "est": "n'est", "a": "n'a", "peut": "ne peut", "fait": "ne fait",
    "sert": "ne sert", "se": "ne se", "subit": "ne subit",
    "utilise": "n'utilise", "relève": "ne relève", "caractérise": "ne caractérise",
    "produit": "ne produit", "évoque": "n'évoque",
}


def _negate_phrase(phrase: str) -> str:
    """Met une locution relationnelle à la forme négative (rendu naturel)."""
    words = phrase.split(" ", 1)
    first, rest = words[0], (words[1] if len(words) > 1 else "")
    neg = _NEG_FIRST.get(first, "ne " + first)
    return f"{neg} pas {rest}".strip()


def _natural_chain(proof: list[ProofStep]) -> str:
    """Rend la chaîne de preuve en français lisible — pas de codes r_xxx.

    Ex. [moineau r_isa oiseau ; oiseau r_can_eat graine] →
        « moineau » est un type d'« oiseau », et « oiseau » peut manger « graine »
    """
    parts: list[str] = []
    for s in proof:
        phrase = RELATION_PHRASES.get(s.relation, f"est en relation ({s.relation}) avec")
        if s.w < 0:
            phrase = _negate_phrase(phrase)
        parts.append(f"« {s.source} » {phrase} « {s.target} »")
    return ", et ".join(parts)


def _make_result(ctx: _Ctx, weight: float, schema: FiredSchema,
                 proof: list[ProofStep], explanation: str | None = None,
                 consensus: int = 1) -> InferenceResult:
    """Assemble l'InferenceResult : confiance normalisée + explication FR.

    Confiance = tanh(|w|/W) · décote longueur de chaîne · facteur de soundness
    du schéma · bonus de consensus. Un schéma lâche donne une confiance
    honnêtement plus basse ; à l'inverse, `consensus` > 1 (plusieurs chemins
    indépendants concordants — cf. agrégation multi-chemins) la rehausse.
    """
    factor = SCHEMA_CONFIDENCE.get(schema, 0.70)
    consensus_factor = min(1.30, 1.0 + 0.12 * max(0, consensus - 1))
    conf = round(min(1.0,
        math.tanh(abs(weight) / STRONG_SUPPORT_W)
        * (0.9 ** max(0, len(proof) - 1))
        * factor
        * consensus_factor,
    ), 3)
    if explanation is None:
        # Explication en langage naturel : chaîne de raisonnement lisible,
        # sans codes de relations (« r_syn »), avec le schéma en clair.
        chain = _natural_chain(proof)
        label = SCHEMA_LABELS.get(schema.value, schema.value)
        verdict = "Oui, déductible" if weight > 0 else "Non, réfuté"
        extra = f", {consensus} chemins concordants" if consensus > 1 else ""
        explanation = f"{verdict} ({label}{extra}) : {chain}."
    return InferenceResult(
        subject=ctx.subject, relation=ctx.relation, object=ctx.object,
        signed_weight=float(weight), fired_schema=schema, proof=proof,
        confidence=conf, explanation=explanation,
    )


# ---------- Schémas d'inférence (effort 1) ----------

def _schema_guards(ctx: _Ctx) -> InferenceResult | None:
    """subject == object : tautologie (relations réflexives) ou contradiction."""
    if norm(ctx.subject) != norm(ctx.object):
        return None
    if ctx.relation == "r_anto":
        return _make_result(
            ctx, -STRONG_SUPPORT_W, FiredSchema.CONTRADICTION, [],
            explanation="Non — un terme n'est pas l'antonyme de lui-même.",
        )
    if ctx.relation in ("r_isa", "r_syn", "r_hypo", "r_associated", "r_similar"):
        return _make_result(
            ctx, STRONG_SUPPORT_W, FiredSchema.TAUTOLOGY, [],
            explanation=f"Oui — trivialement, « {ctx.subject} » entretient "
                        f"{ctx.relation} avec lui-même.",
        )
    return None


def _schema_prefix(ctx: _Ctx) -> InferenceResult | None:
    """« saucisse de Toulouse » r_isa « saucisse » — composé préfixé."""
    if ctx.relation not in ("r_isa", "r_associated"):
        return None
    s, o = norm(ctx.subject), norm(ctx.object)
    if s != o and o and (s + " ").startswith(o + " "):
        return _make_result(
            ctx, 30.0, FiredSchema.PREFIX, [],
            explanation=f"Oui — « {ctx.subject} » est un composé lexical "
                        f"préfixé par « {ctx.object} ».",
        )
    return None


def _schema_inverse(ctx: _Ctx) -> InferenceResult | None:
    """Relation inverse : `(object, R⁻¹, subject)` répond pour `(subject, R, object)`."""
    inv = INVERSE_RELATIONS.get(ctx.relation)
    if not inv:
        return None
    w = _ew(ctx, ctx.object, inv, ctx.subject)
    if w == 0:
        return None
    proof = [ProofStep(source=_disp(ctx, ctx.object), relation=inv,
                       target=_disp(ctx, ctx.subject), w=w,
                       note=f"inverse de {ctx.relation}")]
    return _make_result(ctx, w, FiredSchema.INVERSE, proof)


def _schema_implication(ctx: _Ctx) -> InferenceResult | None:
    """Implication : une relation plus spécifique R' implique la relation demandée."""
    for impl_rel in IMPLICATION_MAP.get(ctx.relation, []):
        w = _ew(ctx, ctx.subject, impl_rel, ctx.object)
        if w > 0:
            proof = [ProofStep(source=_disp(ctx, ctx.subject), relation=impl_rel,
                               target=_disp(ctx, ctx.object), w=w,
                               note=f"implique {ctx.relation}")]
            return _make_result(ctx, w, FiredSchema.IMPLICATION, proof)
    return None


def _schema_antonym_contrast(ctx: _Ctx) -> InferenceResult | None:
    """Réfutation par contraste antonymique : `A R X` ∧ `X r_anto B` ⟹ A R B faux.

    Si A possède déjà une propriété X et que la cible B est l'antonyme de X,
    le triplet est réfuté. Ex. `feu r_carac chaud` (présent) + `chaud r_anto
    froid` ⟹ `feu r_carac froid` = non. Pertinent pour les relations de
    propriété (r_carac, r_has_prop). Coût : 2 lookups (intersection en mémoire).
    """
    if ctx.relation not in ("r_carac", "r_has_prop"):
        return None
    a_vals = {norm(n): (n, w) for n, w, _ in
              topk_positive(_out(ctx, ctx.subject, ctx.relation), ctx.top_k)}
    if not a_vals:
        return None
    for aname, aw, _rid in _out(ctx, ctx.object, "r_anto"):
        if aw > 0 and norm(aname) in a_vals and norm(aname) != norm(ctx.object):
            xn, xw = a_vals[norm(aname)]
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, xn), w=xw),
                ProofStep(source=_disp(ctx, ctx.object), relation="r_anto",
                          target=_disp(ctx, xn), w=aw, note="antonyme"),
            ]
            return _make_result(ctx, -min(xw, aw), FiredSchema.ANTONYM_CONTRAST, proof)
    return None


def _schema_cohyponym(ctx: _Ctx) -> InferenceResult | None:
    """Réfutation par cohyponymie : A et B partagent un hyperonyme ⟹ A r_isa B faux.

    Ne concerne que `r_isa`. Si A et B ont un hyperonyme commun et qu'aucun
    n'est l'hyperonyme de l'autre, ce sont des FRÈRES — `A r_isa B` est faux.
    Ex. `chat r_isa mammifère`, `chien r_isa mammifère` ⟹ `chat r_isa chien`
    = non. Placé APRÈS les schémas ISA positifs : si B était un hyperonyme
    (même transitif) de A, la transitivité l'aurait déjà confirmé.
    """
    if ctx.relation != "r_isa":
        return None
    sub_h = {norm(h): (h, w) for h, w, _ in
             topk_positive(_out(ctx, ctx.subject, "r_isa"), ctx.top_k)}
    obj_h = {norm(h): (h, w) for h, w, _ in
             topk_positive(_out(ctx, ctx.object, "r_isa"), ctx.top_k)}
    # Si l'un subsume l'autre, ce ne sont pas des cohyponymes.
    if norm(ctx.object) in sub_h or norm(ctx.subject) in obj_h:
        return None
    common = sorted(set(sub_h) & set(obj_h))
    if common:
        g = common[0]
        gh, gw = sub_h[g]
        proof = [
            ProofStep(source=_disp(ctx, ctx.subject), relation="r_isa",
                      target=_disp(ctx, gh), w=gw),
            ProofStep(source=_disp(ctx, ctx.object), relation="r_isa",
                      target=_disp(ctx, gh), w=obj_h[g][1],
                      note="hyperonyme commun — A et B sont frères"),
        ]
        return _make_result(ctx, -30.0, FiredSchema.COHYPONYM, proof)
    return None


def _schema_synonym_equiv(ctx: _Ctx) -> InferenceResult | None:
    """Via un synonyme de l'object : `object r_syn S` ∧ `subject R S`."""
    syns = topk_positive(_out(ctx, ctx.object, "r_syn"), ctx.top_k)
    for sname, sw, _rid in syns:
        if norm(sname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        w = _ew(ctx, ctx.subject, ctx.relation, sname)
        if w != 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.object), relation="r_syn",
                          target=_disp(ctx, sname), w=sw, note="synonyme"),
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, sname), w=w),
            ]
            return _make_result(ctx, w, FiredSchema.SYNONYM_EQUIV, proof)
    return None


def _schema_deduction_isa(ctx: _Ctx) -> InferenceResult | None:
    """Déduction par généralisation : `A r_isa/r_syn G` ∧ `G R B` ⟹ `A R B`.

    Le schéma le plus rentable — un trait porté par un générique se transfère.
    AGRÉGATION MULTI-CHEMINS : on n'arrête PAS au 1er générique concluant, on
    parcourt tous ceux déjà récupérés (même coût d'appels, ils sont en cache).
    Une négation héritée prime sur une affirmation concurrente ; plusieurs
    chemins concordants rehaussent la confiance (consensus).
    """
    hits: list[tuple[str, float, str, float]] = []  # (gname, gw, via, w)
    for gname, gw, via in _gens(ctx, ctx.subject):
        if norm(gname) == norm(ctx.object):
            continue
        w = _ew(ctx, gname, ctx.relation, ctx.object)
        if w != 0:
            hits.append((gname, gw, via, w))
    if not hits:
        return None
    negs = [h for h in hits if h[3] < 0]
    poss = [h for h in hits if h[3] > 0]
    # La négation curée prime sur une affirmation générique concurrente.
    pool = negs if negs else poss
    gname, gw, via, w = max(pool, key=lambda h: abs(h[3]))
    proof = [
        ProofStep(source=_disp(ctx, ctx.subject), relation=via,
                  target=_disp(ctx, gname), w=gw),
        ProofStep(source=_disp(ctx, gname), relation=ctx.relation,
                  target=_disp(ctx, ctx.object), w=w),
    ]
    return _make_result(ctx, w, FiredSchema.DEDUCTION_ISA, proof,
                        consensus=len(pool))


def _schema_geo_propagation(ctx: _Ctx) -> InferenceResult | None:
    """Propagation géographique : `A r_lieu L` ∧ `L r_holo B` ⟹ `A r_lieu B`.

    Complète la transitivité de r_lieu en suivant la chaîne de CONTENANCE
    géographique (un lieu fait partie d'un lieu plus grand). Ex.
    `X r_lieu Paris` ∧ `Paris r_holo France` ⟹ `X r_lieu France`.
    """
    if ctx.relation != "r_lieu":
        return None
    places = topk_positive(_out(ctx, ctx.subject, "r_lieu"), ctx.top_k)
    for lname, lw, _rid in places:
        if norm(lname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        w = _ew(ctx, lname, "r_holo", ctx.object)
        if w > 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation="r_lieu",
                          target=_disp(ctx, lname), w=lw),
                ProofStep(source=_disp(ctx, lname), relation="r_holo",
                          target=_disp(ctx, ctx.object), w=w,
                          note="contenu géographiquement"),
            ]
            return _make_result(ctx, w, FiredSchema.GEO_PROPAGATION, proof)
    return None


def _schema_transitivity(ctx: _Ctx) -> InferenceResult | None:
    """Transitivité (relations transitives) : `A R X` ∧ `X R B` ⟹ `A R B`.

    AGRÉGATION MULTI-CHEMINS : on parcourt tous les intermédiaires (déjà en
    cache) ; plusieurs chemins concordants rehaussent la confiance.
    """
    if ctx.relation not in TRANSITIVE_RELATIONS:
        return None
    mids = topk_positive(_out(ctx, ctx.subject, ctx.relation), ctx.top_k)
    hits: list[tuple[str, float, float]] = []  # (mname, mw, w)
    for mname, mw, _rid in mids:
        if norm(mname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        w = _ew(ctx, mname, ctx.relation, ctx.object)
        if w > 0:
            hits.append((mname, mw, w))
    if not hits:
        return None
    mname, mw, w = max(hits, key=lambda h: h[2])
    proof = [
        ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                  target=_disp(ctx, mname), w=mw),
        ProofStep(source=_disp(ctx, mname), relation=ctx.relation,
                  target=_disp(ctx, ctx.object), w=w),
    ]
    return _make_result(ctx, w, FiredSchema.TRANSITIVITY, proof,
                        consensus=len(hits))


def _schema_isa_incompatible(ctx: _Ctx) -> InferenceResult | None:
    """Réfutation : `A r_isa H` ∧ `H r_isa-incompatible B` ⟹ A n'est pas B."""
    if ctx.relation != "r_isa":
        return None
    # On scrute REFUTATION_SCAN hyperonymes (le vrai générique peut être noyé
    # dans le bruit JDM — cf. baleine→mammifère au rang ~25).
    hyps = topk_positive(_out(ctx, ctx.subject, "r_isa"), REFUTATION_SCAN)
    for hname, hw, _rid in hyps:
        if ">" in hname:  # refinement — pas de r_isa-incompatible attachée
            continue
        w = _ew(ctx, hname, "r_isa-incompatible", ctx.object)
        if w > 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation="r_isa",
                          target=_disp(ctx, hname), w=hw),
                ProofStep(source=_disp(ctx, hname), relation="r_isa-incompatible",
                          target=_disp(ctx, ctx.object), w=w),
            ]
            return _make_result(ctx, -abs(w), FiredSchema.ISA_INCOMPATIBLE, proof)
    return None


def _schema_class_elim(ctx: _Ctx) -> InferenceResult | None:
    """Réfutation par HÉRITAGE NÉGATIF : `A r_isa H` ∧ `H R B` explicitement nié.

    Scanne TOUS les hyperonymes de A (pas seulement les grandes classes) : si
    l'un d'eux nie explicitement la relation vers B (w < 0), A en hérite. Une
    négation JDM est un signal curé délibéré — elle prime sur une déduction
    positive concurrente. Capture les contrastifs de genre :
    `chatte r_isa femelle` ∧ `femelle r_has_part pénis = -24` ⟹ réfuté.
    Doit donc tourner AVANT deduction_isa (qui sinon conclurait « vrai » via
    un hyperonyme générique comme `chat r_has_part pénis = +72`).
    """
    hyps = topk_positive(_out(ctx, ctx.subject, "r_isa"), REFUTATION_SCAN)
    hyp_w = {norm(h): w for h, w, _ in hyps}

    # (a) un hyperonyme nie directement la relation vers la cible.
    for hname, hw, _rid in hyps:
        if norm(hname) == norm(ctx.object):
            continue
        w = _ew(ctx, hname, ctx.relation, ctx.object)
        if w < 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation="r_isa",
                          target=_disp(ctx, hname), w=hw),
                ProofStep(source=_disp(ctx, hname), relation=ctx.relation,
                          target=_disp(ctx, ctx.object), w=w, note="négation"),
            ]
            return _make_result(ctx, w, FiredSchema.CLASS_ELIM, proof)

    # (b) la négation est stockée sur la relation INVERSE : `object R⁻¹ H' < 0`
    # avec H' un hyperonyme du sujet. Ex. `prostate r_holo femme = -171`
    # ⟹ une femme n'a pas de prostate (un seul lookup, pas N).
    inv = INVERSE_RELATIONS.get(ctx.relation)
    if inv:
        for hname, hw, _rid in _out(ctx, ctx.object, inv):
            if hw < 0 and norm(hname) in hyp_w and norm(hname) != norm(ctx.object):
                proof = [
                    ProofStep(source=_disp(ctx, ctx.subject), relation="r_isa",
                              target=_disp(ctx, hname), w=hyp_w[norm(hname)]),
                    ProofStep(source=_disp(ctx, ctx.object), relation=inv,
                              target=_disp(ctx, hname), w=hw, note="négation (inverse)"),
                ]
                return _make_result(ctx, hw, FiredSchema.CLASS_ELIM, proof)
    return None


def _schema_hyponym_propagation(ctx: _Ctx) -> InferenceResult | None:
    """Propagation par hyponymie : `A R H` ∧ `H r_isa B` ⟹ `A R B`.

    Sain : si A entretient la relation avec un cas PARTICULIER de B, il
    l'entretient avec B (plus général). Ex. `oiseau r_can_eat graine` +
    `graine r_isa nourriture` ⟹ `oiseau r_can_eat nourriture`.
    """
    targets = topk_positive(_out(ctx, ctx.subject, ctx.relation), ctx.top_k)
    for tname, tw, _rid in targets:
        if norm(tname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        isa_w = _ew(ctx, tname, "r_isa", ctx.object)
        if isa_w > 0:
            w = min(tw, isa_w)
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, tname), w=tw),
                ProofStep(source=_disp(ctx, tname), relation="r_isa",
                          target=_disp(ctx, ctx.object), w=isa_w,
                          note="cas particulier de la cible"),
            ]
            return _make_result(ctx, w, FiredSchema.HYPONYM_PROP, proof)
    return None


# ---------- Schémas d'inférence (effort 2) ----------

def _schema_composition(ctx: _Ctx) -> InferenceResult | None:
    """Composition : `A R2 C` ∧ `C R3 B` ⟹ `A R B` (cartes curées)."""
    for r2, r3 in COMPOSITION_MAP.get(ctx.relation, []):
        for cname, cw, _rid in topk_positive(_out(ctx, ctx.subject, r2), ctx.top_k):
            if norm(cname) in (norm(ctx.subject), norm(ctx.object)):
                continue
            w = _ew(ctx, cname, r3, ctx.object)
            if w > 0:
                proof = [
                    ProofStep(source=_disp(ctx, ctx.subject), relation=r2,
                              target=_disp(ctx, cname), w=cw),
                    ProofStep(source=_disp(ctx, cname), relation=r3,
                              target=_disp(ctx, ctx.object), w=w),
                ]
                return _make_result(ctx, w, FiredSchema.COMPOSITION, proof)
    return None


def _schema_double_isa(ctx: _Ctx) -> InferenceResult | None:
    """Double-ISA : `A r_isa X` ∧ `B r_isa Y` ∧ `X R Y` ⟹ `A R B`."""
    gens_s = _gens(ctx, ctx.subject, min(ctx.top_k, 5))
    gens_o = _gens(ctx, ctx.object, min(ctx.top_k, 5))
    for gs, gsw, vs in gens_s:
        for go, gow, vo in gens_o:
            if norm(gs) == norm(go):
                continue
            w = _ew(ctx, gs, ctx.relation, go)
            if w != 0:
                proof = [
                    ProofStep(source=_disp(ctx, ctx.subject), relation=vs,
                              target=_disp(ctx, gs), w=gsw),
                    ProofStep(source=_disp(ctx, gs), relation=ctx.relation,
                              target=_disp(ctx, go), w=w),
                    ProofStep(source=_disp(ctx, ctx.object), relation=vo,
                              target=_disp(ctx, go), w=gow, note="généralisation"),
                ]
                return _make_result(ctx, w, FiredSchema.DOUBLE_ISA, proof)
    return None


def _schema_target_generic(ctx: _Ctx) -> InferenceResult | None:
    """Via un générique de l'object : `subject R G` ∧ `object r_isa/r_syn G`."""
    for gname, gw, via in _gens(ctx, ctx.object):
        if norm(gname) == norm(ctx.subject):
            continue
        w = _ew(ctx, ctx.subject, ctx.relation, gname)
        if w != 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, gname), w=w),
                ProofStep(source=_disp(ctx, ctx.object), relation=via,
                          target=_disp(ctx, gname), w=gw, note="généralisation"),
            ]
            return _make_result(ctx, w, FiredSchema.TARGET_GENERIC, proof)
    return None


# Cascade effort 1. ORDRE CRITIQUE (early-exit au 1er schéma concluant) :
#   1. schémas gratuits / exacts : guards, prefix, inverse, implication
#   2. RÉFUTATIONS spécialisées : isa_incompatible, class_elim
#   3. schémas SAINS porteurs de signe : deduction_isa, transitivity,
#      hyponym_propagation — ils peuvent conclure « vrai » OU « faux » et
#      doivent passer AVANT la synonymie. Ex. `chatte r_has_part pénis` est
#      réfuté par deduction_isa (chatte r_isa femelle, femelle r_has_part
#      pénis = -24) — il ne faut pas qu'un schéma lâche conclue « vrai »
#      avant via une fausse synonymie (pénis r_syn sexe).
#   4. synonym_equiv EN DERNIER : la synonymie JDM n'est pas substituable
#      (souvent une hyperonymie déguisée) → priorité basse, dernier recours.
_EFFORT1_SCHEMAS = (
    _schema_guards,
    _schema_prefix,
    _schema_inverse,
    _schema_implication,
    # Réfutations spécialisées (avant les déductions).
    _schema_isa_incompatible,
    _schema_class_elim,
    _schema_antonym_contrast,
    # Déductions saines.
    _schema_deduction_isa,
    _schema_transitivity,
    _schema_geo_propagation,
    _schema_hyponym_propagation,
    # Réfutation tardive : cohyponymie — uniquement si aucun chemin ISA
    # positif n'a abouti (sinon la transitivité aurait confirmé).
    _schema_cohyponym,
    # Synonymie en tout dernier (priorité basse, substitution non stricte).
    _schema_synonym_equiv,
)
# Effort 2 : composition (curée, saine) d'abord, puis les schémas LÂCHES en
# bas de cascade — target_generic, double_isa. Ces deux-là sur-génèrent
# (ponts par nœuds génériques) : ils ne tournent qu'en dernier recours,
# après tous les schémas sains ET la synonymie, et leur confiance est
# fortement décotée (cf. SCHEMA_CONFIDENCE).
_EFFORT2_SCHEMAS = (
    _schema_composition,
    _schema_target_generic,
    _schema_double_isa,
)


# ---------- Point d'entrée ----------

def infer(client: JDMClient, subject: str, relation: str, object: str, *,
          effort: int = 1, budget: int | None = None,
          max_depth: int = DEFAULT_MAX_DEPTH,
          top_k: int = DEFAULT_TOP_K) -> InferenceResult:
    """Infère si le triplet `(subject, relation, object)` est vrai selon JDM.

    Ne refait PAS le lookup direct exact du triplet demandé (cf. `verify_claim`
    qui s'en charge avant) — les schémas n'examinent que des triplets dérivés.

    Args:
        client: JDMClient.
        subject, relation, object: le triplet à inférer (relation = nom JDM r_xxx).
        effort: 1 = schémas noyau (rapide) ; 2 = + schémas étendus.
        budget: plafond d'appels HTTP. Si None, dérivé de l'effort.
        max_depth: profondeur max (réservé pour les schémas multi-sauts).
        top_k: nb de génériques/intermédiaires explorés par schéma.

    Returns:
        `InferenceResult` — `signed_weight` > 0 vrai, < 0 faux, 0 silence.
        `lookups_used` indique le coût réel.
    """
    effort = 2 if effort >= 2 else 1
    limit = budget if budget is not None else BUDGET_BY_EFFORT[effort]
    bdg = LookupBudget(limit)
    ctx = _Ctx(
        client=client, budget=bdg,
        subject=subject, relation=relation, object=object,
        top_k=top_k, max_depth=max_depth, effort=effort,
    )

    schemas = list(_EFFORT1_SCHEMAS)
    if effort >= 2:
        schemas += list(_EFFORT2_SCHEMAS)

    result: InferenceResult | None = None
    try:
        for schema_fn in schemas:
            r = schema_fn(ctx)
            if r is not None and r.signed_weight != 0:
                result = r
                break
    except BudgetExhausted:
        # On a épuisé le budget sans conclure — silence propre.
        result = None

    if result is None:
        result = InferenceResult(
            subject=subject, relation=relation, object=object,
            signed_weight=0.0, fired_schema=FiredSchema.NONE,
            confidence=0.0, explanation="",
        )
    result.lookups_used = bdg.used
    return result
