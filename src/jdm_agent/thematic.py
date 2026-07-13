# -*- coding: utf-8 -*-
"""Analyse thématique d'un texte via JeuxDeMots (v1, simple).

Principe : pour chaque mot de contenu du texte, on récupère ses DOMAINES
(relation `r_domain` : « octave r_domain musique », « scalpel r_domain chirurgie »),
puis on AGRÈGE et CLASSE ces domaines sur tout le texte. Les domaines dominants
sont les THÈMES du texte.

Score d'un domaine = somme des poids JDM des relations (mot → domaine) qui y
contribuent. Un domaine visé par beaucoup de mots, avec des poids forts, ressort
comme thème principal.

À VENIR (annoncé) : pondération par rôle syntaxique (UDPipe : sujet/objet pèsent
plus qu'un complément) et meilleur usage du poids JDM pour affiner le score.
"""
from __future__ import annotations

import re

# Mots-outils français à ignorer (liste courte, extensible).
_STOP = {
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "mais",
    "donc", "car", "que", "qui", "quoi", "dont", "où", "au", "aux", "en",
    "dans", "sur", "sous", "par", "pour", "avec", "sans", "ce", "cet", "cette",
    "ces", "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton", "ta",
    "tes", "notre", "nos", "votre", "vos", "il", "elle", "ils", "elles", "on",
    "je", "tu", "nous", "vous", "se", "ne", "pas", "plus", "moins", "très",
    "être", "avoir", "faire", "est", "sont", "été", "ont", "avait", "était",
    "comme", "aussi", "alors", "puis", "entre", "vers", "chez", "depuis",
    "après", "avant", "pendant", "selon", "ainsi", "cela", "ceci", "tout",
    "tous", "toute", "toutes", "même", "autre", "autres", "bien", "déjà",
    "encore", "cours", "lors", "notamment", "également", "afin", "dont",
}

_WORD = re.compile(r"[^\W\d_]+", re.UNICODE)  # suites de lettres (sans chiffres)

# Domaines « fourre-tout » : beaucoup de mots courants portent r_domain vers eux
# (grammaire → linguistique, nombres → mathématique, corps → médecine), ce qui
# les fait remonter à tort comme thèmes. On les PÉNALISE (facteur réducteur, pas
# suppression) plutôt que de les retirer.
_PENALIZED = {"linguistique", "mathématique", "mathématiques", "médecine", "droit"}
_PENALTY = 0.15


def _content_words(text: str, min_len: int = 3) -> list:
    """Repli SANS syntaxe : mots de contenu par regex (lettres, minuscule, hors
    mots-outils, dédupliqués, ordre d'apparition)."""
    seen, out = set(), []
    for m in _WORD.finditer(text or ""):
        w = m.group(0).lower()
        if len(w) < min_len or w in _STOP:
            continue
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out


# POS porteuses de thème (on écarte verbes/adverbes/déterminants…).
_CONTENT_POS = {"NOUN", "PROPN", "ADJ"}
# Poids d'influence par rôle syntaxique : un sujet/objet/tête pèse plus qu'un
# simple modificateur ou complément périphérique.
_ROLE_CORE = {"nsubj", "nsubj:pass", "obj", "iobj", "root"}
_ROLE_MID = {"nmod", "amod", "appos", "conj", "obl", "obl:arg", "xcomp", "ccomp"}


def _role_weight(deprel: str) -> float:
    if deprel in _ROLE_CORE:
        return 1.0
    if deprel in _ROLE_MID or deprel.split(":")[0] in {"nmod", "obl", "nsubj", "obj"}:
        return 0.6
    return 0.4


def _syntactic_units(text: str) -> dict:
    """Texte → {lemme de contenu: poids syntaxique cumulé}, via UDPipe.

    Ne garde que NOUN/PROPN/ADJ, travaille sur les LEMMES (meilleur rappel JDM :
    « musiciens »→« musicien »), et cumule le poids de rôle des occurrences (un
    lemme répété ou en position centrale pèse plus). Réseau requis (lindat)."""
    from jdm_agent.relext.udpipe import analyse
    units: dict = {}
    for sent in analyse(text or ""):
        for t in sent.tokens:
            if t.upos not in _CONTENT_POS:
                continue
            lem = (t.lemma or t.form or "").lower()
            if len(lem) < 3 or lem in _STOP:
                continue
            units[lem] = units.get(lem, 0.0) + _role_weight(t.deprel)
    return units


def analyze_thematic(text: str, client, *, max_words: int = 150,
                     per_word: int = 15, min_weight: float = 1.0,
                     use_syntax: bool = False, use_wsd: bool = False) -> dict:
    """Texte → thèmes (domaines JDM agrégés + classés).

    `use_wsd` : OPT-IN. On désambiguïse chaque mot puis on FILTRE les domaines
    (riches) du mot brut par ceux du sens choisi / du composé (« chef d'orchestre »)
    → retire du bruit de polysémie. Mesuré : nettoie la queue mais peut affaiblir un
    thème secondaire réel, et ~8× plus lent → désactivé par défaut.

    `use_syntax` : variante lemmes+rôles (mesurée dégradante, opt-in).

    Le scoring par DISPERSION (poids JDM × part focalisée) fait le tri des domaines.
    Renvoie `{themes, word_count, analyzed, truncated, suggested_threshold}`.
    """
    rid = client.relation_type_id("r_domain")

    # items = liste de (mot_affiché, terme_jdm, nœud_de_sens_pour_filtre, poids)
    items = None
    if use_wsd:
        try:
            from jdm_agent.wsd import resolved_terms
            items = [(disp, term, sense, 1.0) for disp, term, sense in resolved_terms(text, client)]
        except Exception:
            items = None
    if items is None and use_syntax:
        try:
            items = [(w, w, None, rw) for w, rw in _syntactic_units(text).items()]
        except Exception:
            items = None
    if items is None:
        items = [(w, w, None, 1.0) for w in _content_words(text)]

    truncated = len(items) > max_words
    analyzed = items[:max_words]

    def _domains(term):
        res = client.relations_from(term, types_ids=[rid], min_weight=min_weight, limit=per_word)
        idx = res.node_index()
        return [(idx[r.node2].name.strip().lower(), r.w)
                for r in res.relations
                if r.node2 in idx and r.w > 0 and idx[r.node2].name.strip()]

    agg: dict = {}
    if rid is not None:
        for disp, term, sense, rw in analyzed:
            doms = _domains(term)
            # FILTRE par le sens désambiguïsé : on garde les domaines RICHES du mot
            # brut mais seulement ceux cohérents avec le sens choisi (avocat→juriste
            # ⇒ droit, pas botanique/cuisine). Sens sans domaine → pas de filtre.
            if sense:
                keep = {k for k, _ in _domains(sense)}
                if keep:
                    filtered = [(k, wt) for k, wt in doms if k in keep]
                    if filtered:          # ne filtre que si ça laisse des domaines
                        doms = filtered
            total = sum(wt for _, wt in doms)
            if total <= 0:
                continue
            # Score = MAGNITUDE du poids JDM × PART focalisée (poids/total).
            for key, wt in doms:
                e = agg.setdefault(key, {"score": 0.0, "count": 0, "words": []})
                e["score"] += rw * wt * (wt / total)
                e["count"] += 1
                if disp not in e["words"]:
                    e["words"].append(disp)

    # Fusion pluriel → singulier (« sports »→« sport », « spectacles »→« spectacle »).
    # Cheap et sûr sur des noms de domaine ; la vraie lemmatisation viendra avec UDPipe.
    for key in [k for k in agg if k.endswith("s") and k[:-1] in agg]:
        sing = agg[key[:-1]]
        plur = agg.pop(key)
        sing["score"] += plur["score"]
        sing["count"] += plur["count"]
        for w in plur["words"]:
            if w not in sing["words"]:
                sing["words"].append(w)

    # Pénalité sur les domaines fourre-tout (les fait redescendre dans le classement).
    for key in agg:
        if key in _PENALIZED:
            agg[key]["score"] *= _PENALTY

    themes = [{"theme": d, "score": round(v["score"], 1), "count": v["count"],
               "words": v["words"]} for d, v in agg.items()]
    themes.sort(key=lambda t: -t["score"])
    maxs = themes[0]["score"] if themes else 0.0
    for t in themes:
        t["rel"] = round(100.0 * t["score"] / maxs, 1) if maxs > 0 else 0.0
    return {"themes": themes, "word_count": len(items),
            "analyzed": len(analyzed), "truncated": truncated,
            "suggested_threshold": _suggested_cut(themes)}


def _suggested_cut(themes: list) -> float:
    """Seuil adaptatif : au MILIEU du plus grand écart entre deux thèmes
    consécutifs (en score normalisé) → ne garde que la tête du classement.
    Ne scrute que le haut (s'arrête quand on descend sous 12 %)."""
    rels = [t["rel"] for t in themes]
    if len(rels) < 2:
        return 0.0
    best_gap, cut = -1.0, 0.0
    for i in range(len(rels) - 1):
        gap = rels[i] - rels[i + 1]
        if gap > best_gap:
            best_gap, cut = gap, rels[i + 1] + gap / 2.0
        if rels[i + 1] < 12:   # inutile de chercher un écart plus bas
            break
    return round(cut, 1)
