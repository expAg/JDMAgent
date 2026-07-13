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
   tranche).

Quand ni le générique ni le direct ne tranchent → « incertain » (honnête), pas de
réponse fabriquée. L'inférence de graphe n'est PAS utilisée ici : mesurée trop
coûteuse (≈20 s/phrase) et surtout génératrice de faux positifs confiants (elle
sur-généralise via r_isa : « un cuisinier est une personne, une personne peut
diriger » → sens erroné). Elle reste dispo hors-ligne (jdm_agent.inference).

Perf : voisinage générique = 1 fetch tous-types par nœud (caché) ; arêtes
actancielles = requêtes typées ciblées. Une phrase = quelques appels.
"""
from __future__ import annotations

from jdm_agent.thematic import _content_words

_CONTENT_POS = {"NOUN", "PROPN", "ADJ", "VERB"}   # contexte
_CAND_POS = {"NOUN", "PROPN"}                       # mots à désambiguïser
_AGENT_DEP = {"nsubj"}
_PATIENT_DEP = {"obj", "iobj", "nsubj:pass"}
_AGENT_INV_ID, _PATIENT_INV_ID = 24, 26
_LAMBDA = 1.0
_MAX_SENSES = 3
_FETCH_LIMIT = 250

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
    d: dict = {}
    for _t, name, w, _id in rels:
        if w > 0 and w > d.get(name, 0.0):
            d[name] = w
    return d


def _discriminants(sense) -> list:
    parts = sense.path[1:] if getattr(sense, "path", None) else []
    return [p.strip().lower() for p in parts if p and not p.rstrip().endswith(":")]


def _annot_factor(client, rel_id) -> float:
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
    """Arête `node -tid-> verb` REPONDÉRÉE par annotation. None si absente (requête typée)."""
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


def _direct_asym(client, sense, verb: str):
    """asym directe = agent − patient (annotation-repondéré). None si TROU (aucune arête)."""
    a = _gated_edge(client, sense.name, _AGENT_INV_ID, verb)
    p = _gated_edge(client, sense.name, _PATIENT_INV_ID, verb)
    if a is None and p is None:
        return None
    return (a or 0.0) - (p or 0.0)


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
            asym = _direct_asym(client, s, verb)   # None si trou → sel reste 0
            if asym is not None:
                sel = asym if role == "agent" else -asym
        scored.append({"sense": s.decoded, "name": s.name,
                       "consensus": round(s.weight, 1),
                       "generic": round(gen, 1), "selectional": round(sel, 1),
                       "score": round(gen + _LAMBDA * sel, 1)})
    scored.sort(key=lambda x: -x["score"])
    return scored


def _occ(word, token, role, verb, scored) -> dict:
    best = scored[0]
    second = scored[1]["score"] if len(scored) > 1 else 0.0
    return {"word": word, "token": token, "role": role, "verb": verb,
            "chosen": best, "senses": scored,
            "confident": best["score"] > 0 and best["score"] >= 1.5 * abs(second)}


def _ws_after(toks, k) -> str:
    """Espace après le token k : rien avant une ponctuation ni après une élision."""
    form = toks[k].form or ""
    nxt = toks[k + 1] if k + 1 < len(toks) else None
    if form.endswith("'") or form.endswith("’"):
        return ""
    if nxt is not None and nxt.upos == "PUNCT":
        return ""
    return " "


_MWE_MAXK = 3


def _span_surface(toks, a: int, b: int) -> str:
    """Surface des tokens a..b (élisions/ponctuation respectées)."""
    out = []
    for i in range(a, b + 1):
        out.append(toks[i].form or "")
        if i < b:
            out.append(_ws_after(toks, i))
    return "".join(out).strip()


def _mwe_span(sent, k: int, client):
    """Plus long COMPOSÉ connu de JDM commençant au token k (« chef d'orchestre »,
    « joueur de piano »). Renvoie (k, end, surface) ou None. On ne sonde JDM que
    si le motif s'y prête (mot suivant = préposition ou nom)."""
    toks = sent.tokens
    nxt = toks[k + 1] if k + 1 < len(toks) else None
    if nxt is None or nxt.upos not in ("ADP", "NOUN", "PROPN"):
        return None
    best = None
    for end in range(k + 1, min(k + 1 + _MWE_MAXK, len(toks))):
        if toks[end].upos in ("ADP", "DET", "PUNCT", "CCONJ"):
            continue  # bord droit fonctionnel
        surface = _span_surface(toks, k, end)
        try:
            if client.term_exists(surface):
                best = (k, end, surface)   # garde le plus long
        except Exception:
            pass
    return best


def _mwe_occ(surface, span_gids, role, verb) -> dict:
    """Occurrence d'un composé JDM (unité lexicale, non ambiguë ici)."""
    chosen = {"sense": surface, "name": surface, "consensus": 0.0,
              "generic": 0.0, "selectional": 0.0, "score": 0.0}
    return {"word": surface, "token": span_gids[0], "span": span_gids,
            "role": role, "verb": verb, "mwe": True,
            "chosen": chosen, "senses": [chosen], "confident": True}


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
        occ.append(_occ(w, None, None, None, _rank(client, senses, others, ctx_neigh, None, None, cache)))
    return {"tokens": [], "occurrences": occ, "analyzed": len(words),
            "mode": "générique (par type, sans syntaxe)"}


_MODE = "syntaxe (UDPipe) + sélectionnel + générique"


def disambiguate_iter(text: str, client, *, max_senses: int = _MAX_SENSES):
    """Générateur d'ÉVÉNEMENTS pour un affichage TEMPS RÉEL :
      {"type":"tokens", ...}  d'abord (le texte peut se rendre tout de suite),
      {"type":"occ", ...}     à chaque occurrence traitée,
      {"type":"done", ...}    à la fin.
    """
    cache: dict = {}
    try:
        from jdm_agent.relext.udpipe import analyse
        sents = analyse(text or "")
    except Exception:
        fb = _fallback_by_type(text or "", client, cache)
        yield {"type": "tokens", "tokens": fb["tokens"], "mode": fb["mode"]}
        for o in fb["occurrences"]:
            yield {"type": "occ", "occurrence": o}
        yield {"type": "done", "analyzed": fb["analyzed"]}
        return

    # 1) Tous les tokens d'abord (rapide) → le texte s'affiche immédiatement.
    tokens_out, sent_base, g = [], [], 0
    for sent in sents:
        sent_base.append(g)
        toks = sent.tokens
        for k, t in enumerate(toks):
            tokens_out.append({"i": g, "text": t.form or "", "ws": _ws_after(toks, k)})
            g += 1
    yield {"type": "tokens", "tokens": tokens_out, "mode": _MODE}

    # 2) Occurrences, émises une par une au fil du traitement.
    n_words = 0
    for si, sent in enumerate(sents):
        toks = sent.tokens
        base = sent_base[si]
        absorbed = set()
        ctx = [(t.lemma or t.form or "").lower() for t in toks if t.upos in _CONTENT_POS]
        ctx = [w for w in ctx if len(w) >= 3]
        ctx_neigh = {w: _neigh_of(_node_rels(client, w, cache)) for w in set(ctx)}
        for k, t in enumerate(toks):
            g = base + k
            if g in absorbed or t.upos not in _CAND_POS:
                continue
            role, verb = _role_and_verb(sent, t)
            mwe = _mwe_span(sent, k, client)
            if mwe is not None:
                _a, end, surface = mwe
                span = [base + i for i in range(k, end + 1)]
                absorbed.update(span[1:])
                n_words += 1
                yield {"type": "occ", "occurrence": _mwe_occ(surface, span, role, verb)}
                continue
            w = (t.lemma or t.form or "").lower()
            if len(w) < 3:
                continue
            senses = client.refinements_decoded(w)
            if len(senses) < 2:
                continue
            n_words += 1
            senses = sorted(senses, key=lambda s: -s.weight)[:max_senses]
            others = [cw for cw in ctx if cw != w]
            scored = _rank(client, senses, others, ctx_neigh, role, verb, cache)
            yield {"type": "occ", "occurrence": _occ(w, g, role, verb, scored)}

    yield {"type": "done", "analyzed": n_words}


def disambiguate(text: str, client, *, max_senses: int = _MAX_SENSES) -> dict:
    """Version non-streaming (collecte le générateur) — pour tests / thématique."""
    tokens, occ, analyzed, mode = [], [], 0, _MODE
    for ev in disambiguate_iter(text, client, max_senses=max_senses):
        if ev["type"] == "tokens":
            tokens, mode = ev["tokens"], ev["mode"]
        elif ev["type"] == "occ":
            occ.append(ev["occurrence"])
        elif ev["type"] == "done":
            analyzed = ev["analyzed"]
    return {"tokens": tokens, "occurrences": occ, "analyzed": analyzed, "mode": mode}
