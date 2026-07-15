# -*- coding: utf-8 -*-
"""Petit modèle de prédiction de la relation d'un génitif « A de B ».

Features SYMBOLIQUES JeuxDeMots, pour A et pour B :
  - INFO-SEM (relation r_infopot, id 36) : types sémantiques (_INFO-SEM-PERS,
    _INFO-SEM-SUBST, _INFO-SEM-THING-CONCRETE…), poids log-compressés ;
  - hyperonymes r_isa (top-k), en présence.

Modèle : régression logistique multiclasse, évaluée en validation croisée
stratifiée (l'accuracy d'entraînement tromperait sur un petit corpus).

Usage : py -3.13 scripts/gen_train.py <corpus.txt>
"""
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from jdm_agent.client.client import JDMClient
from jdm_agent.genitive import parse_pair   # site UNIQUE du parse « A de B » (+ connecteur)

# Plancher d'écart-type pour la standardisation. StandardScaler divise par l'écart-
# type : un indicateur binaire RARE a un écart-type minuscule (vu 1 fois / 749 →
# std≈0.036), donc quand il s'allume sa valeur z-scorée explose (×27) et un poids
# appris modeste devient un logit énorme — c'est l'overfit « hyperonyme dentiste →
# possession ». Plafonner l'amplification en imposant scale = max(std, FLOOR) tue ce
# gonflement des traits rares sans toucher aux traits fréquents (std déjà > FLOOR).
# Plancher réglé par balayage hold-out : 0.08 = meilleur compromis (agrégat ~0.826
# ET bascule piqûre→agent avec marge confortable ; 0.05 monte à 0.836 mais ne corrige
# pas piqûre, 0.10 corrige mais retombe à 0.817).
SCALE_FLOOR = 0.08


class FlooredScaler(BaseEstimator, TransformerMixin):
    """StandardScaler avec plancher d'écart-type (scale = max(std, SCALE_FLOOR)).
    Export identique à StandardScaler (mean_/scale_) → serving Python pur inchangé."""

    def __init__(self, floor=SCALE_FLOOR):
        self.floor = floor

    def fit(self, X, y=None):
        X = np.asarray(X, float)
        std = X.std(0)
        std[std == 0] = 1.0
        self.mean_ = X.mean(0)
        self.scale_ = np.maximum(std, self.floor)
        return self

    def transform(self, X):
        return (np.asarray(X, float) - self.mean_) / self.scale_


def load_corpus(path):
    """→ [(A, B, classe, connecteur)] ; le connecteur porte la définitude de B."""
    cls = None
    data = []
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        st = line.strip()
        if not st:
            continue
        if st.startswith("r_"):
            cls = st.split()[0]            # « r_relationnel - parenté » → r_relationnel
            continue
        if cls and cls.startswith("r_GEN_CORP"):
            continue                        # sections vides de contrôle
        p = parse_pair(st)
        if p:
            data.append((p[0], p[1], cls, p[2]))
    return data


def _feats(client, term, cache, rid_isa):
    if term in cache:
        return cache[term]
    f = {}
    try:
        res = client.relations_from(term, types_ids=[36], limit=80)
        idx = res.node_index()
        for r in res.relations:
            n = idx.get(r.node2)
            if n and n.name.upper().startswith("_INFO") and r.w > 0:
                f["INFO:" + n.name.lower()] = np.log1p(r.w)
    except Exception:
        pass
    try:
        res = client.relations_from(term, types_ids=[rid_isa], limit=15)
        idx = res.node_index()
        for r in sorted(res.relations, key=lambda x: -x.w)[:6]:
            n = idx.get(r.node2)
            if n and r.w > 0:
                f["ISA:" + n.name.strip().lower()] = 1.0
    except Exception:
        pass
    cache[term] = f
    return f


def main():
    path = sys.argv[1]
    data = load_corpus(path)
    print(f"{len(data)} exemples · {len(set(t[2] for t in data))} classes")

    client = JDMClient()
    rid_isa = client.relation_type_id("r_isa")
    cache = {}
    X_dicts, y = [], []
    for i, (a, b, c, _conn) in enumerate(data):
        fa = _feats(client, a, cache, rid_isa)
        fb = _feats(client, b, cache, rid_isa)
        fv = {}
        for k, v in fa.items():
            fv["A_" + k] = v
        for k, v in fb.items():
            fv["B_" + k] = v
        X_dicts.append(fv)
        y.append(c)
        if (i + 1) % 100 == 0:
            print(f"  features {i+1}/{len(data)} (termes uniques cachés: {len(cache)})")

    from sklearn.feature_extraction import DictVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import accuracy_score, classification_report

    vec = DictVectorizer(sparse=False)
    X = vec.fit_transform(X_dicts)
    y = np.array(y)
    print(f"matrice: {X.shape[0]} × {X.shape[1]} features")

    clf = make_pipeline(StandardScaler(),
                        LogisticRegression(max_iter=2000, C=1.0))
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    pred = cross_val_predict(clf, X, y, cv=cv)
    print(f"\nACCURACY (CV 5-fold) : {accuracy_score(y, pred):.3f}")
    print(classification_report(y, pred, digits=2, zero_division=0))


if __name__ == "__main__":
    main()
