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

# Étiquettes lisibles des signaux de type (pour l'explication).
_OUT_LABEL = {"procag": "action (agent d'un processus)", "procpa": "action (objet d'un processus)",
              "ag1": "peut agir", "pa1": "peut subir", "lieu1": "lieu (contient des choses)",
              "lieuact": "lieu (d'actions)", "own1": "possédé par", "origin": "a une origine",
              "mater": "matière", "holo": "a des parties", "haspart": "a des parties",
              "auteur": "a un auteur", "telic": "a une fonction", "domain": "a un domaine"}

# Relations JDM NON discriminantes / bruit → écartées des features et de l'évidence.
_SKIP_REL = {"r_associated", "r_aki", "r_wiki", "r_raff_sem", "r_raff_morpho",
             "r_raff_sem-1", "r_pos", "r_lemma", "r_meaning/glose", "r_data",
             "r_pos_seq", "r_annotation", "r_annotation_context", "r_annotation_exception"}

# Couche de LOOKUP direct : relation JDM A↔B → classe génitive. Quand JDM contient
# déjà la relation entre A et B, on la remonte directement (plus fiable que le
# modèle pour les paires connues). Direction-agnostique.
_REL2CLASS = {
    "r_processus>agent": "r_agent", "r_agent": "r_agent", "r_agent-1": "r_agent",
    "r_processus>patient": "r_patient", "r_patient": "r_patient", "r_patient-1": "r_patient",
    "r_object>mater": "r_composition", "r_mater>object": "r_composition",
    "r_holo": "r_holonymie", "r_has_part": "r_holonymie",
    "r_lieu": "r_lieu", "r_lieu-1": "r_lieu",
    "r_lieu>origine": "r_origine", "r_product_of": "r_origine",
    "r_own": "r_possession", "r_own-1": "r_possession",
    "r_has_auteur": "r_auteur", "r_has_auteur-1": "r_auteur",
    "r_carac": "r_caractérisation", "r_carac-1": "r_caractérisation",
    "r_has_topic": "r_topique", "r_domain": "r_topique", "r_domain-1": "r_topique",
    "r_quantificateur": "r_quantification", "r_quantificateur-1": "r_quantification",
    "r_has_causatif": "r_causalité", "r_has_conseq": "r_causalité",
    "r_depict": "r_dépiction",
    "r_has_social_tie_with": "r_relationnel", "r_family": "r_relationnel",
    "r_instr": "r_instrument", "r_instr-1": "r_instrument",
    "r_telic_role": "r_instrument", "r_processus>instr": "r_instrument",
}

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
                if rel.w <= 0:
                    continue
                tn = client.relation_type_name(rel.type) or str(rel.type)
                if tn in _SKIP_REL:          # relations génériques : ni feature ni évidence
                    continue
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


def _signals(fv: dict) -> dict:
    """Explique les signaux de type par côté : A est-il une action ? B un lieu/personne ?"""
    def side(pref):
        types = [_OUT_LABEL.get(k[6:], k[6:]) for k in fv if k.startswith(pref + "OUT:")]
        isa = [k[6:] for k in fv if k.startswith(pref + "ISA:")]
        return {"types": types, "isa": isa[:4]}
    return {"a": side("A_"), "b": side("B_")}


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

    # Couche DIRECTE : relations JDM A↔B qui concernent les génitifs (toutes,
    # dédupliquées par classe = poids max), triées par poids.
    direct = {}
    for d, tn, w in ev:
        cls = _REL2CLASS.get(tn)
        if cls and w > direct.get(cls, (0, None, None))[0]:
            direct[cls] = (w, tn, d)
    # Les relations « lieu-like » (r_lieu, r_domain…) ont des poids JDM souvent
    # très élevés (association spatiale) mais sont de faux amis pour le génitif →
    # on classe APRÈS les relations structurelles/prédicatives.
    _lieu_like = {"r_lieu", "r_lieu-1", "r_domain", "r_domain-1", "r_has_topic"}
    direct_list = sorted(
        [{"relation": c, "via": via, "weight": int(w), "nl": nl(c, a, b)}
         for c, (w, via, d) in direct.items()],
        key=lambda x: (x["via"] in _lieu_like, -x["weight"]))

    return {"ok": True, "a": a, "b": b, "relation": best, "nl": nl(best, a, b),
            "top": top, "signals": _signals(fv), "direct": direct_list,
            "evidence": [f"{d} : {t} ({int(w)})" for d, t, w in ev[:6]]}
