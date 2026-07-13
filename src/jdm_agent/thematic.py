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
_PENALIZED = {"linguistique", "mathématique", "mathématiques", "médecine"}
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
                     use_syntax: bool = False) -> dict:
    """Texte → thèmes (domaines JDM agrégés + classés).

    `use_syntax` : OPT-IN. Mesuré comme DÉGRADANT la discrimination sur nos textes
    (la lemmatisation ramène « genres/rythmes » vers des singuliers fourre-tout et
    la pondération de rôle gonfle les noms abstraits sujets). Par défaut : mots par
    regex, poids uniforme. Le scoring par dispersion (poids×part) fait le tri.
    Si activé et réseau OK : UDPipe (POS de contenu + lemmes + poids de rôle).

    Renvoie `{themes, word_count, analyzed, truncated}` où chaque thème est
    `{theme, score, rel, count, words}` (`rel` = score normalisé 0-100 par
    rapport au thème dominant ; `count` = nb de contributions ; `words` = lemmes).
    """
    rid = client.relation_type_id("r_domain")

    units = None
    if use_syntax:
        try:
            units = _syntactic_units(text)
        except Exception:
            units = None
    if not units:
        units = {w: 1.0 for w in _content_words(text)}

    items = list(units.items())  # (lemme, poids_syntaxique)
    truncated = len(items) > max_words
    analyzed = items[:max_words]

    agg: dict = {}
    if rid is not None:
        for w, rw in analyzed:
            res = client.relations_from(w, types_ids=[rid],
                                        min_weight=min_weight, limit=per_word)
            idx = res.node_index()
            # Domaines du mot (clé minuscule → fusionne « Musique »/« musique »).
            doms = [(idx[r.node2].name.strip().lower(), r.w)
                    for r in res.relations
                    if r.node2 in idx and r.w > 0 and idx[r.node2].name.strip()]
            total = sum(wt for _, wt in doms)
            if total <= 0:
                continue
            # Score = MAGNITUDE du poids JDM × PART focalisée (poids/total). Un
            # domaine définitionnel fort (blues→musique) ressort ; les domaines
            # éparpillés des mots génériques (genre→sociologie/biologie/…)
            # s'effondrent. `rw` = influence de rôle (1.0 si sans syntaxe).
            for key, wt in doms:
                e = agg.setdefault(key, {"score": 0.0, "count": 0, "words": []})
                e["score"] += rw * wt * (wt / total)
                e["count"] += 1
                if w not in e["words"]:
                    e["words"].append(w)

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
            "analyzed": len(analyzed), "truncated": truncated}
