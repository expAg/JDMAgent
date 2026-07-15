# -*- coding: utf-8 -*-
"""Évaluation HOLD-OUT du modèle génitif : entraîne sur le corpus 'learn' (labellisé)
et teste sur 'test_clean' (non labellisé mais ordonné par classe, N par classe dans
le MÊME ordre que le learn → gold reconstruit par position).

Usage : py -3.13 scripts/gen_eval.py <learn.txt> <test_clean.txt>
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from jdm_agent.client.client import JDMClient
from gen_train import load_corpus, _feats, parse_pair


def _vec(client, pairs, rid_isa, cache):
    dicts, y = [], []
    for i, item in enumerate(pairs):
        a, b, c = item[0], item[1], item[2]
        fa, fb = _feats(client, a, cache, rid_isa), _feats(client, b, cache, rid_isa)
        fv = {}
        for k, v in fa.items():
            fv["A_" + k] = v
        for k, v in fb.items():
            fv["B_" + k] = v
        dicts.append(fv)
        y.append(c)
        if (i + 1) % 100 == 0:
            print(f"    {i+1}/{len(pairs)}", flush=True)
    return dicts, np.array(y)


def main():
    learn_path, test_path = sys.argv[1], sys.argv[2]
    learn = load_corpus(learn_path)
    order = []
    for t in learn:
        c = t[2]
        if c not in order:
            order.append(c)
    print(f"learn: {len(learn)} ex · {len(order)} classes (ordre): {order}")

    lines = [ln.strip() for ln in open(test_path, encoding="utf-8") if ln.strip()]
    per = len(lines) // len(order)
    print(f"test: {len(lines)} lignes → {per} par classe (par position)")
    test = []
    for i, ln in enumerate(lines):
        p = parse_pair(ln)
        if p:
            test.append((p[0], p[1], order[i // per], p[2]))

    client = JDMClient()
    rid_isa = client.relation_type_id("r_isa")
    cache = {}
    print("features (train)…", flush=True)
    Xtr_d, ytr = _vec(client, learn, rid_isa, cache)
    print("features (test)…", flush=True)
    Xte_d, yte = _vec(client, test, rid_isa, cache)

    from sklearn.feature_extraction import DictVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import accuracy_score, classification_report

    vec = DictVectorizer(sparse=False)
    Xtr = vec.fit_transform(Xtr_d)
    Xte = vec.transform(Xte_d)
    clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0))
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)

    print(f"\nACCURACY HOLD-OUT : {accuracy_score(yte, pred):.3f}  (sur {len(yte)} ex)")
    print(classification_report(yte, pred, digits=2, zero_division=0))


if __name__ == "__main__":
    main()
