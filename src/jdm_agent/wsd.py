# -*- coding: utf-8 -*-
"""Désambiguïsation lexicale (WSD) par raffinements sémantiques JeuxDeMots.

Deux signaux combinés, PAR OCCURRENCE :

1. ASSOCIATION GÉNÉRIQUE — le sens dont le voisinage JDM recouvre le mieux le
   contexte (autres mots de contenu). Robuste, fait le gros du tri.

2. PRÉFÉRENCE SÉLECTIONNELLE (rôle) — quand le mot est sujet/objet d'un verbe
   (UDPipe : `nsubj → agent`, `obj/nsubj:pass → patient`), on regarde si le SENS
   est plutôt agent ou patient de ce verbe, via les relations actancielles
   INVERSES `r_agent-1` / `r_patient-1`, REPONDÉRÉES par leur ANNOTATION
   (« improbable » réfute l'arête héritée du sens dominant — c'est le signal qui
   tranche). Trou sur le nœud → repli INFÉRENCE (comble via r_isa) mais COÛTEUX,
   donc OPT-IN (`_USE_INFERENCE`) : par défaut, sel=0 et le générique tranche.

Perf : voisinage générique = 1 fetch tous-types par nœud (mis en cache) ; arêtes
actancielles = requêtes typées ciblées. Pas d'inférence dans le chemin par défaut
(elle faisait exploser le temps). Une phrase = quelques appels, pas des centaines.
"""
from __future__ import annotations

from jdm_agent.thematic import _content_words

_CONTENT_POS = {"NOUN", "PROPN", "ADJ", "VERB"}   # contexte
_CAND_POS = {"NOUN", "PROPN"}                       # mots à désambiguïser
_AGENT_DEP = {"nsubj"}
_PATIENT_DEP = {"obj", "iobj", "nsubj:pass"}
_R_AGENT_INV, _R_PATIENT_INV = "r_agent-1", "r_patient-1"
_AGENT_INV_ID, _PATIENT_INV_ID = 24, 26
_LAMBDA = 1.0
_MAX_SENSES = 3
_FETCH_LIMIT = 250
# Inférence en repli sur les TROUS (sens sans arête actancielle directe) : puissante
# mais COÛTEUSE (~0.7s/appel). OFF par défaut → interactif. Le signal direct annoté
# suffit dans l'immense majorité des cas ; sinon sel=0 et le générique tranche.
_USE_INFERENCE = False

# Valeurs d'annotation (§20/§22) → facteur de pertinence de l'arête.
_ANNOT_FACTOR = {
    "constitutif": 1.0, "pertinent": 1.0, "probable": 0.7, "incertain": 0.3,
    "non spécifique": 0.2, "peu pertinent": -0.4, "non pertinent": -0.5,
    "improbable": -0.7, "exception": -1.0,
}


def _node_rels(client, name: str, cache: dict) -> list:
    """Relations sortantes d'un nœud, fetchées UNE fois : [(type, nom↓, w, rel_id)]."""
    hit = cache.get(name)
    if hit is not None:
        return hit
    try:
        res = client.relations_from(name, limit=_FETCH_LIMIT)
    except Exception:
        cache[name] = []
        return []
    idx = res.node_index()
    out = []
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None:
            k = n.name.strip().lower()
            if k:
                out.append((r.type, k, r.w, r.id))
    cache[name] = out
    return out


def _neigh_of(rels: list) -> dict:
    """Voisinage {nom↓: poids max > 0} dérivé des relations déjà fetchées."""
    d: dict = {}
    for _t, name, w, _id in rels:
        if w > 0 and w > d.get(name, 0.0):
            d[name] = w
    return d


def _discriminants(sense) -> list:
    parts = sense.path[1:] if getattr(sense, "path", None) else []
    return [p.strip().lower() for p in parts if p and not p.rstrip().endswith(":")]


def _annot_factor(client, rel_id) -> float:
    """Facteur ∈ [-1,1] de l'annotation dominante d'un triplet (1.0 si non annoté)."""
    if rel_id is None:
        return 1.0
    try:
        for a in client.get_annotations_for_triplet(rel_id):
            v = (a.value or "").strip().lower()
            if v in _ANNOT_FACTOR:
                return _ANNOT_FACTOR[v]
    except Exception:
        pass
    return 1.0


def _generic_score(sense_neigh: dict, discs: list, context: list, ctx_neigh: dict) -> float:
    sc = 0.0
    for cw in context:
        best = sense_neigh.get(cw, 0.0)
        cwn = ctx_neigh.get(cw, {})
        for d in discs:
            v = cwn.get(d, 0.0)
            if v > best:
                best = v
        sc += best
    return sc


def _gated_edge(client, node: str, tid: int, verb: str):
    """Poids de l'arête `node -tid-> verb` REPONDÉRÉ par annotation. None si absente.
    Requête TYPÉE (ciblée, fiable) : l'arête actancielle peut être basse dans le
    classement général, donc introuvable dans un fetch tous-types plafonné."""
    try:
        res = client.relations_from(node, types_ids=[tid], limit=200)
    except Exception:
        return None
    idx = res.node_index()
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None and n.name.strip().lower() == verb:
            return r.w * _annot_factor(client, r.id)
    return None


def _selectional_asym(client, sense, verb: str) -> float:
    """asym = agent − patient (annotation-repondéré) ; inférence en repli sur trou."""
    a = _gated_edge(client, sense.name, _AGENT_INV_ID, verb)
    p = _gated_edge(client, sense.name, _PATIENT_INV_ID, verb)
    if a is not None or p is not None:
        return (a or 0.0) - (p or 0.0)

    if not _USE_INFERENCE:
        return 0.0
    from jdm_agent.inference.engine import infer
    best = 0.0
    for d in _discriminants(sense):
        try:
            ia = infer(client, d, _R_AGENT_INV, verb, effort=1).signed_weight
            ip = infer(client, d, _R_PATIENT_INV, verb, effort=1).signed_weight
        except Exception:
            continue
        if abs(ia - ip) > abs(best):
            best = ia - ip
    return best


def _role_and_verb(sent, tok):
    head = sent.by_id.get(tok.head)
    if head is None or head.upos != "VERB":
        return None, None
    if tok.deprel in _AGENT_DEP:
        return "agent", (head.lemma or head.form or "").lower()
    if tok.deprel in _PATIENT_DEP:
        return "patient", (head.lemma or head.form or "").lower()
    return None, None


def _rank(client, senses, context, ctx_neigh, role, verb, cache) -> list:
    scored = []
    for s in senses:
        gen = _generic_score(_neigh_of(_node_rels(client, s.name, cache)),
                             _discriminants(s), context, ctx_neigh)
        sel = 0.0
        if role and verb:
            asym = _selectional_asym(client, s, verb)
            sel = asym if role == "agent" else -asym
        scored.append({"sense": s.decoded, "name": s.name,
                       "consensus": round(s.weight, 1),
                       "generic": round(gen, 1), "selectional": round(sel, 1),
                       "score": round(gen + _LAMBDA * sel, 1)})
    scored.sort(key=lambda x: -x["score"])
    return scored


def _occ(word, role, verb, scored) -> dict:
    best = scored[0]
    second = scored[1]["score"] if len(scored) > 1 else 0.0
    return {"word": word, "role": role, "verb": verb, "chosen": best,
            "senses": scored,
            "confident": best["score"] > 0 and best["score"] >= 1.5 * abs(second)}


def _fallback_by_type(text: str, client, cache) -> dict:
    words = _content_words(text)
    ctx_neigh = {w: _neigh_of(_node_rels(client, w, cache)) for w in words}
    occ = []
    for w in words:
        senses = client.refinements_decoded(w)
        if len(senses) < 2:
            continue
        senses = sorted(senses, key=lambda s: -s.weight)[:_MAX_SENSES]
        others = [cw for cw in words if cw != w]
        occ.append(_occ(w, None, None, _rank(client, senses, others, ctx_neigh, None, None, cache)))
    return {"occurrences": occ, "analyzed": len(words),
            "mode": "générique (par type, sans syntaxe)"}


def disambiguate(text: str, client, *, max_senses: int = _MAX_SENSES) -> dict:
    """Texte → sens choisi PAR OCCURRENCE des mots ambigus. Réseau requis (JDM)."""
    cache: dict = {}   # nom de nœud → relations (fetch unique)
    try:
        from jdm_agent.relext.udpipe import analyse
        sents = analyse(text or "")
    except Exception:
        return _fallback_by_type(text or "", client, cache)

    occ, n_words = [], 0
    for sent in sents:
        ctx = [(t.lemma or t.form or "").lower() for t in sent.tokens
               if t.upos in _CONTENT_POS]
        ctx = [w for w in ctx if len(w) >= 3]
        ctx_neigh = {w: _neigh_of(_node_rels(client, w, cache)) for w in set(ctx)}
        for t in sent.tokens:
            if t.upos not in _CAND_POS:
                continue
            w = (t.lemma or t.form or "").lower()
            if len(w) < 3:
                continue
            n_words += 1
            senses = client.refinements_decoded(w)
            if len(senses) < 2:
                continue
            senses = sorted(senses, key=lambda s: -s.weight)[:max_senses]
            role, verb = _role_and_verb(sent, t)
            others = [cw for cw in ctx if cw != w]
            occ.append(_occ(w, role, verb, _rank(client, senses, others, ctx_neigh, role, verb, cache)))

    return {"occurrences": occ, "analyzed": n_words,
            "mode": "syntaxe (UDPipe) + rôles + générique"}
