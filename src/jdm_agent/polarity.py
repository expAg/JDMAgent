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
            for t in sent.tokens:
                if not _opinion_token(t):
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
