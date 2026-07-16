# -*- coding: utf-8 -*-
"""Analyse de POLARITÉ d'un texte via JeuxDeMots (relation `r_infopot`, id 36).

Chaque terme porte, sur `r_infopot`, des marqueurs `_POL-POS` / `_POL-NEG` /
`_POL-NEUTRE` (poids = consensus). On agrège les polarités des mots du texte (à la
manière des domaines) pour rendre un verdict binaire : positif / négatif / neutre.

Sémantique prise en compte : la NÉGATION d'un verbe (ou adjectif) INVERSE sa
polarité (« aimer » positif → « ne pas aimer » négatif), détectée via UDPipe
(« ne/pas/jamais… » rattaché au mot). Repli sans négation si UDPipe indispo.
"""
from __future__ import annotations

_POL_ID = 36  # r_infopot
_POL_POS, _POL_NEG, _POL_NEU = "_pol-pos", "_pol-neg", "_pol-neutre"
# Mots qui portent une négation → inversent la polarité de leur tête.
_NEG = {"ne", "pas", "plus", "jamais", "rien", "aucun", "nul", "sans", "non",
        "guère", "point", "ni"}
_POL_POS_LABEL, _POL_NEG_LABEL, _POL_NEUTRE = "positif", "négatif", "neutre"
# NOM en position de MODIFIEUR oblique/adverbial = souvent un connecteur
# (« en revanche », « de toute façon ») → à exclure de la polarité.
_EXCL_NOUN_DEP = {"obl", "advmod", "discourse", "vocative", "dislocated"}
_BAND = 0.15  # bande morte autour de 0 → neutre
# Pronoms réfléchis (on teste la FORME : UDPipe lemmatise « me » → « moi »).
_REFL = {"se", "me", "te", "nous", "vous", "s'", "m'", "t'"}
# Un objet ne « porte le contenu » (et n'écrase la polarité du verbe) que s'il est
# polaire de façon NON AMBIGUË : poids fort ET faible masse NEUTRE. Sans la seconde
# condition, « j'aime le froid » devenait négatif et — pire — donnait le MÊME score
# que « je déteste le froid » (verbe ignoré = attitude perdue).
#   mort  : neg=1000, neu=  53 → non ambigu   → l'objet domine  (« j'aime la mort »)
#   froid : neg= 540, neu= 511 → affaire de goût → le verbe garde sa polarité
_STRONG_OBJ = 500.0
_AMBIG_RATIO = 2.0        # polarité non ambiguë si max(pos,neg) > 2 × neutre


def _opinion_token(t) -> bool:
    """Porte-t-il potentiellement une opinion ? ADJ/VERB/ADV oui ; NOM seulement
    en position d'argument (on écarte les NOM obliques = connecteurs)."""
    if t.upos in ("ADJ", "VERB", "ADV"):
        return True
    if t.upos in ("NOUN", "PROPN"):
        return t.deprel.split(":")[0] not in _EXCL_NOUN_DEP
    return False


def _pol_of(client, word: str):
    """(pos, neg, neutre) du terme via r_infopot. (0,0,0) si non marqué."""
    try:
        # limit large + min_weight : l'API ne trie pas par poids → limit=40 pouvait
        # tronquer les tags _POL-* (mot marqué qui paraissait neutre à tort).
        res = client.relations_from(word, types_ids=[_POL_ID], min_weight=1, limit=300)
    except Exception:
        return 0.0, 0.0, 0.0
    idx = res.node_index()
    pos = neg = neu = 0.0
    for r in res.relations:
        n = idx.get(r.node2)
        if n is None:
            continue
        nm = n.name.strip().lower()
        if nm == _POL_POS:
            pos = max(pos, r.w)
        elif nm == _POL_NEG:
            neg = max(neg, r.w)
        elif nm == _POL_NEU:
            neu = max(neu, r.w)
    return pos, neg, neu


def _composed(client, sent, t):
    """COMPOSITION prédicat-argument par la SYNTAXE : un verbe et son objet ne
    s'additionnent pas — « donner la mort » (neg) vs « donner la vie » (pos) alors
    que « donner » seul est positif. On reconstruit l'expression depuis la relation
    de dépendance `obj` (+ déterminant, + réfléchi) et on demande à JDM SA polarité.
    Renvoie (entry, {ids consommés}) si JDM connaît l'expression, sinon None."""
    obj = None
    for c in sent.children(t.id):
        if c.deprel.split(":")[0] == "obj" and c.upos in ("NOUN", "PROPN"):
            obj = c
            break
    if obj is None:
        return None
    verb = (t.lemma or t.form or "").lower()
    noun = (obj.lemma or obj.form or "").lower()
    if len(verb) < 2 or len(noun) < 2:
        return None
    det = next((( c.form or "").lower() for c in sent.children(obj.id)
                if c.deprel.split(":")[0] == "det"), None)
    refl = any((c.form or "").lower() in _REFL           # FORME (lemme = « moi »)
               for c in sent.children(t.id)
               if c.deprel.split(":")[0] in ("expl", "obj", "iobj"))
    core = f"{verb} {det} {noun}" if det else f"{verb} {noun}"
    cands = (["se " + core] if refl else []) + [core]
    for cand in cands:
        pos, neg, neu = _pol_of(client, cand)
        if max(pos, neg) > neu and max(pos, neg) > 0:   # JDM connaît l'expression
            return ({"word": cand, "pos": pos, "neg": neg, "negated": False,
                     "composed": True}, {t.id, obj.id})
    return None


def _label(pos: float, neg: float) -> str:
    d = pos - neg
    return _POL_POS_LABEL if d > 0 else (_POL_NEG_LABEL if d < 0 else _POL_NEUTRE)


def analyze_polarity(text: str, client, *, max_words: int = 200) -> dict:
    """Texte → verdict de polarité + détail par mot.

    Renvoie `{label, score, pos, neg, words}` où `score` ∈ [-1,1] et chaque mot est
    `{word, pos, neg, negated, polarity}`."""
    try:
        from jdm_agent.relext.udpipe import analyse
        sents = analyse(text or "")
    except Exception:
        sents = None

    entries = []
    if sents:
        for sent in sents:
            # têtes portant une négation → à inverser
            negated = set()
            for t in sent.tokens:
                lem = (t.lemma or t.form or "").lower()
                if lem in _NEG or t.feats.get("Polarity") == "Neg":
                    negated.add(t.head)
            # 1) EXPRESSIONS COMPOSÉES verbe+objet connues de JDM : une seule unité,
            #    et on NE recompte PAS les parties (sinon « donner »+ écraserait).
            consumed = set()
            for t in sent.tokens:
                if t.upos != "VERB" or t.id in consumed:
                    continue
                got = _composed(client, sent, t)
                if got is None:
                    continue
                e, ids = got
                if t.id in negated:                  # « il ne veut pas se donner la mort »
                    e["pos"], e["neg"] = e["neg"], e["pos"]
                    e["negated"] = True
                entries.append(e)
                consumed |= ids
            # 1b) verbe régissant un objet FORTEMENT polaire non lexicalisé dans JDM :
            #     l'objet porte le contenu → on n'ajoute pas la polarité propre du verbe
            #     (« j'aime la mort » → négatif, et non neutre par annulation).
            for t in sent.tokens:
                if t.upos != "VERB" or t.id in consumed:
                    continue
                obj = next((c for c in sent.children(t.id)
                            if c.deprel.split(":")[0] == "obj"
                            and c.upos in ("NOUN", "PROPN")), None)
                if obj is None:
                    continue
                p, n, u = _pol_of(client, (obj.lemma or obj.form or "").lower())
                if max(p, n) >= _STRONG_OBJ and max(p, n) > _AMBIG_RATIO * u:
                    consumed.add(t.id)      # objet non ambigu → il porte le contenu
            # 1c) verbe modal/attitude régissant un xcomp déjà pris en charge
            #     (« je veux [me donner la mort] ») → sa polarité ne doit pas diluer.
            for t in sent.tokens:
                if t.upos != "VERB" or t.id in consumed:
                    continue
                if any(c.deprel.split(":")[0] == "xcomp" and c.id in consumed
                       for c in sent.children(t.id)):
                    consumed.add(t.id)
            # 2) mots restants, un par un
            for t in sent.tokens:
                if t.id in consumed or not _opinion_token(t):
                    continue
                w = (t.lemma or t.form or "").lower()
                if len(w) < 2 or w in _NEG:      # mots de négation : pas de polarité propre
                    continue
                pos, neg, neu = _pol_of(client, w)
                if max(pos, neg) <= neu:         # majoritairement neutre → ignoré
                    continue
                is_neg = t.id in negated
                if is_neg:
                    pos, neg = neg, pos          # INVERSION sur négation
                entries.append({"word": w, "pos": pos, "neg": neg, "negated": is_neg})
    else:
        from jdm_agent.thematic import _content_words
        for w in _content_words(text or ""):
            pos, neg, neu = _pol_of(client, w)
            if max(pos, neg) > neu:
                entries.append({"word": w, "pos": pos, "neg": neg, "negated": False})

    entries = entries[:max_words]
    total_pos = sum(e["pos"] for e in entries)
    total_neg = sum(e["neg"] for e in entries)
    denom = total_pos + total_neg or 1.0
    score = (total_pos - total_neg) / denom
    label = (_POL_POS_LABEL if score > _BAND
             else _POL_NEG_LABEL if score < -_BAND else _POL_NEUTRE)

    for e in entries:
        e["pos"] = round(e["pos"], 1)
        e["neg"] = round(e["neg"], 1)
        e["polarity"] = _label(e["pos"], e["neg"])
    entries.sort(key=lambda e: -abs(e["pos"] - e["neg"]))

    return {"label": label, "score": round(score, 3),
            "pos": round(total_pos, 1), "neg": round(total_neg, 1),
            "words": entries}
