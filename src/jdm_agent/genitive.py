# -*- coding: utf-8 -*-
"""GRASP-IT — prédiction de la relation d'un génitif « A de B » à partir de
features SYMBOLIQUES JeuxDeMots (INFO-SEM r_infopot, hyperonymes r_isa, relations
prédicatives sortantes, et relation DIRECTE A↔B).

SERVING SANS DÉPENDANCE : le modèle (régression logistique) est exporté en JSON
portable (models/grasp_it.json) par scripts/gen_build_model.py, et la prédiction
est réimplémentée en Python pur (pas de scikit-learn / joblib / numpy à installer
sur le serveur). scikit-learn ne sert qu'à l'entraînement hors-ligne.
"""
from __future__ import annotations

import json
import math
import os
import re

_CONN = re.compile(r"(?<= )(de la |de l'|de l’|du |des |de |d'|d’)")

# Relations sortantes typées informatives (id → étiquette).
_TYPE_TAGS = {70: "procag", 76: "procpa", 24: "ag1", 26: "pa1", 28: "lieu1",
              30: "lieuact", 122: "own1", 171: "origin", 50: "mater", 10: "holo",
              9: "haspart", 100: "auteur", 37: "telic", 3: "domain"}

# Formulation en langage naturel : « A <prédicat> B ».
_NL = {
    "r_agent": "{a} a pour agent {b}",
    "r_auteur": "{a} a pour auteur {b}",
    "r_caractérisation": "{a} est une caractéristique de {b}",
    "r_causalité": "{a} est causé par {b}",
    "r_composition": "{a} a pour matière (est composé de) {b}",
    "r_dépiction": "{a} représente {b}",
    "r_holonymie": "{a} est une partie de {b}",
    "r_instrument": "{a} est un instrument pour {b}",
    "r_lieu": "{a} est situé dans {b}",
    "r_origine": "{a} provient de {b}",
    "r_patient": "{a} porte sur (a pour patient) {b}",
    "r_possession": "{a} appartient à {b}",
    "r_quantification": "{a} est une quantité de {b}",
    "r_relationnel": "{a} est lié à {b} (parenté / relation sociale)",
    "r_topique": "{a} a pour thème {b}",
}


def nl(relation: str, a: str, b: str) -> str:
    return _NL.get(relation, "{a} — " + relation + " — {b}").format(a=a, b=b)


def parse_pair(text: str):
    """« A de B » → (A, B). Gère « +de/+d' » internes aux composés."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    m = _CONN.search(s)
    if not m:
        return None
    a = s[:m.start()].replace("+", "").strip()
    b = s[m.end():].replace("+", "").strip()
    return (a, b) if a and b else None


def _term_feats(client, term, cache):
    if term in cache:
        return cache[term]
    f = {}
    try:
        res = client.relations_from(term, limit=500)
        idx = res.node_index()
        isa, seen = [], set()
        for r in res.relations:
            n = idx.get(r.node2)
            if n is None or r.w <= 0:
                continue
            seen.add(r.type)
            if r.type == 6:
                isa.append((n.name.strip().lower(), r.w))
        for nm, _w in sorted(isa, key=lambda x: -x[1])[:6]:
            f["ISA:" + nm] = 1.0
        for tid, tag in _TYPE_TAGS.items():
            if tid in seen:
                f["OUT:" + tag] = 1.0
    except Exception:
        pass
    try:
        res = client.relations_from(term, types_ids=[36], limit=80)
        idx = res.node_index()
        for r in res.relations:
            n = idx.get(r.node2)
            if n and n.name.upper().startswith("_INFO") and r.w > 0:
                f["INFO:" + n.name.lower()] = math.log1p(r.w)
    except Exception:
        pass
    cache[term] = f
    return f


def _pair_feats(client, a, b, cache):
    """Relation DIRECTE A↔B (les deux sens). Renvoie (dict_features, evidence)."""
    key = ("PAIR", a, b)
    if key in cache:
        return cache[key]
    f, ev = {}, []
    for x, y, pref in ((a, b, "AB"), (b, a, "BA")):
        try:
            res = client.relations_between(x, y)
            for rel in res.relations:
                if rel.w > 0:
                    tn = client.relation_type_name(rel.type) or str(rel.type)
                    k = pref + ":" + tn
                    f[k] = max(f.get(k, 0.0), math.log1p(rel.w))
                    ev.append((f"{x}→{y}", tn, rel.w))
        except Exception:
            pass
    ev.sort(key=lambda e: -e[2])
    out = (f, ev)
    cache[key] = out
    return out


def featurize(client, a, b, cache=None):
    """Vecteur de features (dict) d'une paire + évidence (relations A↔B trouvées)."""
    cache = cache if cache is not None else {}
    fv = {}
    for k, v in _term_feats(client, a, cache).items():
        fv["A_" + k] = v
    for k, v in _term_feats(client, b, cache).items():
        fv["B_" + k] = v
    pf, ev = _pair_feats(client, a, b, cache)
    fv.update(pf)
    return fv, ev


def model_path():
    return os.path.join(os.path.dirname(__file__), "..", "..", "models", "grasp_it.json")


_MODEL = None


def _load():
    """Charge le modèle JSON : {classes, features, index, mean, scale, coef, intercept}."""
    global _MODEL
    if _MODEL is None:
        with open(model_path(), encoding="utf-8") as fh:
            m = json.load(fh)
        m["index"] = {name: i for i, name in enumerate(m["features"])}
        _MODEL = m
    return _MODEL


def _proba(model, fv: dict):
    """Régression logistique multinomiale en Python pur → liste de probas."""
    feats, idx = model["features"], model["index"]
    mean, scale = model["mean"], model["scale"]
    # vecteur standardisé (features absentes = 0)
    x = [0.0] * len(feats)
    for k, v in fv.items():
        i = idx.get(k)
        if i is not None:
            x[i] = (v - mean[i]) / (scale[i] or 1.0)
    logits = []
    for c, coef_c in enumerate(model["coef"]):
        s = model["intercept"][c]
        for i, w in enumerate(coef_c):
            if w:
                s += w * x[i]
        logits.append(s)
    mx = max(logits)
    exps = [math.exp(l - mx) for l in logits]
    tot = sum(exps) or 1.0
    return [e / tot for e in exps]


def predict(text: str, client, *, top_k: int = 3) -> dict:
    """« A de B » → {a, b, relation, nl, top[], evidence[]}."""
    p = parse_pair(text)
    if p is None:
        return {"ok": False, "error": "Format attendu : « A de B »."}
    a, b = p
    model = _load()
    fv, ev = featurize(client, a, b)
    proba = _proba(model, fv)
    classes = model["classes"]
    order = sorted(range(len(classes)), key=lambda i: -proba[i])
    top = [{"relation": classes[i], "proba": round(proba[i], 3),
            "nl": nl(classes[i], a, b)} for i in order[:top_k]]
    best = classes[order[0]]
    return {"ok": True, "a": a, "b": b, "relation": best, "nl": nl(best, a, b),
            "top": top,
            "evidence": [f"{d} : {t} ({int(w)})" for d, t, w in ev[:6]]}
