# -*- coding: utf-8 -*-
"""Désambiguïsation lexicale (WSD) par raffinements sémantiques JeuxDeMots.

Deux signaux combinés, PAR OCCURRENCE :

1. ASSOCIATION GÉNÉRIQUE — le sens dont le voisinage JDM recouvre le mieux le
   contexte (autres mots de contenu). Robuste, fait le gros du tri.

2. PRÉFÉRENCE SÉLECTIONNELLE (rôle) — quand le mot est sujet/objet d'un verbe
   (UDPipe : `nsubj → agent`, `obj/nsubj:pass → patient`), on regarde si le SENS
   est plutôt agent ou patient de ce verbe, via les relations actancielles
   INVERSES `r_agent-1` / `r_patient-1` sur le label discriminant du sens :
       asym(sens) = poids(disc, r_agent-1, verbe) − poids(disc, r_patient-1, verbe)
   positif → plutôt agent ; négatif → plutôt patient. Le poids est obtenu par
   INFÉRENCE (moteur jdm_agent.inference) : si le lien direct est muet
   (« personne r_agent-1 manger » = 0), il est déduit via r_isa
   (personne → mammifère → mange). C'est ce qui distingue les deux « avocat » de
   « l'avocat mange l'avocat » : sujet → juriste (agent), objet → fruit (patient).

Repli : pas de verbe régissant, ou signal sélectionnel nul → l'association
générique décide seule.
"""
from __future__ import annotations

from jdm_agent.thematic import _content_words

_CONTENT_POS = {"NOUN", "PROPN", "ADJ", "VERB"}   # contexte
_CAND_POS = {"NOUN", "PROPN"}                       # mots à désambiguïser
_AGENT_DEP = {"nsubj"}
_PATIENT_DEP = {"obj", "iobj", "nsubj:pass"}
_R_AGENT_INV = "r_agent-1"
_R_PATIENT_INV = "r_patient-1"
_LAMBDA = 1.0        # poids du signal sélectionnel dans le score combiné


def _neigh(client, name: str, limit: int = 120) -> dict:
    """Voisinage sortant d'un nœud : {nom_voisin_minuscule: poids max}."""
    res = client.relations_from(name, limit=limit)
    idx = res.node_index()
    d: dict = {}
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None and r.w > 0:
            k = n.name.strip().lower()
            if k:
                d[k] = max(d.get(k, 0.0), r.w)
    return d


def _discriminants(sense) -> list:
    """Labels qui distinguent le sens (composantes du chemin, hors POS « Nom: »)."""
    parts = sense.path[1:] if getattr(sense, "path", None) else []
    return [p.strip().lower() for p in parts if p and not p.rstrip().endswith(":")]


def _generic_score(client, sense, context, ctx_neigh) -> float:
    """Recouvrement bidirectionnel du sens avec le contexte."""
    sng = _neigh(client, sense.name)
    discs = _discriminants(sense)
    sc = 0.0
    for cw in context:
        best = sng.get(cw, 0.0)
        cwn = ctx_neigh.get(cw, {})
        for d in discs:
            v = cwn.get(d, 0.0)
            if v > best:
                best = v
        sc += best
    return sc


# Valeurs d'annotation (§20/§22) → facteur de pertinence de l'arête. « improbable »
# / « exception » retournent l'arête (héritée du sens dominant) : c'est là pour
# désambiguïser. « pertinent » / « constitutif » la confirment.
_ANNOT_FACTOR = {
    "constitutif": 1.0, "pertinent": 1.0, "probable": 0.7, "incertain": 0.3,
    "non spécifique": 0.2, "peu pertinent": -0.4, "non pertinent": -0.5,
    "improbable": -0.7, "exception": -1.0,
}
_AGENT_INV_ID = 24
_PATIENT_INV_ID = 26


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


def _gated_edge(client, node: str, tid: int, verb: str):
    """Poids de l'arête `node -tid-> verb` REPONDÉRÉ par son annotation. None si absente."""
    try:
        res = client.relations_from(node, types_ids=[tid], limit=600)
    except Exception:
        return None
    idx = res.node_index()
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None and n.name.strip().lower() == verb:
            return r.w * _annot_factor(client, r.id)
    return None


def _selectional_asym(client, sense, verb: str) -> float:
    """asym = agent − patient (positif → agent, négatif → patient).

    1) Sur le NŒUD DE SENS : arêtes actancielles inverses (r_agent-1 / r_patient-1)
       vers le verbe, REPONDÉRÉES par leur annotation (« improbable » réfute
       l'arête héritée du sens dominant — c'est le signal qui tranche).
    2) Trou (nœud sans arête) → INFÉRENCE sur le label discriminant (comble via r_isa).
    """
    a = _gated_edge(client, sense.name, _AGENT_INV_ID, verb)
    p = _gated_edge(client, sense.name, _PATIENT_INV_ID, verb)
    if a is not None or p is not None:
        return (a or 0.0) - (p or 0.0)

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
    """(rôle, lemme du verbe régissant) si `tok` est sujet/objet d'un verbe."""
    head = sent.by_id.get(tok.head)
    if head is None or head.upos != "VERB":
        return None, None
    if tok.deprel in _AGENT_DEP:
        return "agent", (head.lemma or head.form or "").lower()
    if tok.deprel in _PATIENT_DEP:
        return "patient", (head.lemma or head.form or "").lower()
    return None, None


def _fallback_by_type(text: str, client, max_senses: int) -> dict:
    """Sans UDPipe : désambiguïsation par TYPE (générique seul, tout le texte)."""
    words = _content_words(text)
    ctx_neigh = {w: _neigh(client, w) for w in words}
    occ = []
    for w in words:
        senses = client.refinements_decoded(w)
        if len(senses) < 2:
            continue
        senses = sorted(senses, key=lambda s: -s.weight)[:max_senses]
        others = [cw for cw in words if cw != w]
        scored = _rank(client, senses, others, ctx_neigh, None, None)
        occ.append(_occ(w, None, None, scored))
    return {"occurrences": occ, "mode": "générique (par type, sans syntaxe)"}


def _rank(client, senses, context, ctx_neigh, role, verb) -> list:
    scored = []
    for s in senses:
        gen = _generic_score(client, s, context, ctx_neigh)
        sel = 0.0
        if role and verb:
            asym = _selectional_asym(client, s, verb)
            sel = asym if role == "agent" else -asym   # objet → on veut l'asym négative
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
            "senses": scored, "confident": best["score"] > 0 and best["score"] >= 1.5 * abs(second)}


def disambiguate(text: str, client, *, max_senses: int = 6) -> dict:
    """Texte → sens choisi PAR OCCURRENCE des mots ambigus. Réseau requis (JDM).

    Utilise UDPipe (rôles) + inférence (sélectionnel) + association générique. En
    cas d'échec UDPipe → repli générique par type.
    """
    try:
        from jdm_agent.relext.udpipe import analyse
        sents = analyse(text or "")
    except Exception:
        return _fallback_by_type(text or "", client, max_senses)

    occ = []
    n_words = 0
    for sent in sents:
        ctx = [(t.lemma or t.form or "").lower() for t in sent.tokens
               if t.upos in _CONTENT_POS]
        ctx = [w for w in ctx if len(w) >= 3]
        ctx_neigh = {w: _neigh(client, w) for w in set(ctx)}
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
            scored = _rank(client, senses, others, ctx_neigh, role, verb)
            occ.append(_occ(w, role, verb, scored))

    return {"occurrences": occ, "analyzed": n_words,
            "mode": "syntaxe (UDPipe) + inférence + générique"}
