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
from jdm_agent.client.client import JDMClient

_CONN = re.compile(r"(?<= )(de la |de l'|de l’|du |des |de |d'|d’)")


def parse_pair(line: str):
    """« A de B » → (A, B). Gère « +de/+d' » = connecteur INTERNE (composé), le
    vrai split est le 1er connecteur précédé d'une espace (pas d'un « + »)."""
    s = re.sub(r"\s+", " ", line.strip())
    m = _CONN.search(s)
    if not m:
        return None
    a = s[:m.start()].replace("+", "").strip()
    b = s[m.end():].replace("+", "").strip()
    if not a or not b:
        return None
    return a, b


def load_corpus(path):
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
            data.append((p[0], p[1], cls))
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
    print(f"{len(data)} exemples · {len(set(c for *_, c in data))} classes")

    client = JDMClient()
    rid_isa = client.relation_type_id("r_isa")
    cache = {}
    X_dicts, y = [], []
    for i, (a, b, c) in enumerate(data):
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
