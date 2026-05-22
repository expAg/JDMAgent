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
    GENERIC_HUBS,
    IMPLICATION_MAP,
    INVERSE_RELATIONS,
    REFUTATION_SCAN,
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
    FiredSchema.DEDUCTION_ISA:    0.90,
    FiredSchema.TRANSITIVITY:     0.90,
    FiredSchema.HYPONYM_PROP:     0.85,
    FiredSchema.PREFIX:           0.85,
    FiredSchema.COMPOSITION:      0.80,
    FiredSchema.SYNONYM_EQUIV:    0.70,
    FiredSchema.TARGET_GENERIC:   0.60,
    FiredSchema.ASSOC_BRIDGE:     0.55,
    FiredSchema.DOUBLE_ISA:       0.55,
}


def _fmt_step(s: ProofStep) -> str:
    base = f"{s.source} {s.relation} {s.target} (w={s.w:.0f})"
    return f"{base} [{s.note}]" if s.note else base


def _make_result(ctx: _Ctx, weight: float, schema: FiredSchema,
                 proof: list[ProofStep], explanation: str | None = None
                 ) -> InferenceResult:
    """Assemble l'InferenceResult : confiance normalisée + explication FR.

    Confiance = tanh(|w|/W) · décote longueur de chaîne · facteur de soundness
    du schéma. Un schéma lâche (synonymie, association) donne donc une
    confiance honnêtement plus basse qu'un schéma sain à poids égal.
    """
    factor = SCHEMA_CONFIDENCE.get(schema, 0.70)
    conf = round(
        math.tanh(abs(weight) / STRONG_SUPPORT_W)
        * (0.9 ** max(0, len(proof) - 1))
        * factor,
        3,
    )
    if explanation is None:
        chain = " ; ".join(_fmt_step(s) for s in proof)
        verdict = "Oui" if weight > 0 else "Non"
        kind = "déduit" if weight > 0 else "réfuté"
        explanation = (
            f"{verdict} — {kind} par inférence (schéma {schema.value}) : {chain}"
        )
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
    """
    for gname, gw, via in _gens(ctx, ctx.subject):
        if norm(gname) == norm(ctx.object):
            continue
        w = _ew(ctx, gname, ctx.relation, ctx.object)
        if w != 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=via,
                          target=_disp(ctx, gname), w=gw),
                ProofStep(source=_disp(ctx, gname), relation=ctx.relation,
                          target=_disp(ctx, ctx.object), w=w),
            ]
            return _make_result(ctx, w, FiredSchema.DEDUCTION_ISA, proof)
    return None


def _schema_transitivity(ctx: _Ctx) -> InferenceResult | None:
    """Transitivité (relations transitives) : `A R X` ∧ `X R B` ⟹ `A R B`.

    On saute les intermédiaires « hubs » trop génériques (corps, organisme…) :
    enchaîner via eux sur-génère (lionne r_has_part corps r_has_part prostate).
    """
    if ctx.relation not in TRANSITIVE_RELATIONS:
        return None
    mids = topk_positive(_out(ctx, ctx.subject, ctx.relation), ctx.top_k)
    for mname, mw, _rid in mids:
        if norm(mname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        if norm(mname) in GENERIC_HUBS:
            continue  # hub universel — transitivité non fiable
        w = _ew(ctx, mname, ctx.relation, ctx.object)
        if w > 0:
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, mname), w=mw),
                ProofStep(source=_disp(ctx, mname), relation=ctx.relation,
                          target=_disp(ctx, ctx.object), w=w),
            ]
            return _make_result(ctx, w, FiredSchema.TRANSITIVITY, proof)
    return None


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


def _schema_assoc_bridge(ctx: _Ctx) -> InferenceResult | None:
    """Pont par association : `A R T` ∧ `T ≈ B` (synonyme ou associé fort).

    Lâche par nature (l'association n'est pas une équivalence) — d'où une
    confiance fortement décotée. Capture les déductions « molles » : le sujet
    entretient la relation vers un terme proche de la cible.
    """
    targets = topk_positive(_out(ctx, ctx.subject, ctx.relation), ctx.top_k)
    for tname, tw, _rid in targets:
        if norm(tname) in (norm(ctx.subject), norm(ctx.object)):
            continue
        if norm(tname) in GENERIC_HUBS:
            continue  # hub universel — pont non fiable
        # T est-il synonyme ou fortement associé à la cible ?
        link_w = _ew(ctx, tname, "r_syn", ctx.object)
        link_rel = "r_syn"
        if link_w <= 0:
            link_w = _ew(ctx, tname, "r_associated", ctx.object)
            link_rel = "r_associated"
        if link_w <= 0:
            link_w = _ew(ctx, ctx.object, "r_associated", tname)
            link_rel = "r_associated"
        if link_w > 0:
            w = min(tw, link_w)
            proof = [
                ProofStep(source=_disp(ctx, ctx.subject), relation=ctx.relation,
                          target=_disp(ctx, tname), w=tw),
                ProofStep(source=_disp(ctx, tname), relation=link_rel,
                          target=_disp(ctx, ctx.object), w=link_w,
                          note="proche de la cible"),
            ]
            return _make_result(ctx, w, FiredSchema.ASSOC_BRIDGE, proof)
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
    _schema_isa_incompatible,
    _schema_class_elim,
    _schema_deduction_isa,
    _schema_transitivity,
    _schema_hyponym_propagation,
    _schema_synonym_equiv,
)
# Effort 2 : composition (curée, saine) d'abord, puis les schémas LÂCHES en
# bas de cascade — target_generic, double_isa, assoc_bridge. Ces trois-là
# sur-génèrent (ponts par nœuds génériques) : ils ne tournent qu'en dernier
# recours, après tous les schémas sains ET la synonymie, et leur confiance
# est fortement décotée (cf. SCHEMA_CONFIDENCE).
_EFFORT2_SCHEMAS = (
    _schema_composition,
    _schema_target_generic,
    _schema_double_isa,
    _schema_assoc_bridge,
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
