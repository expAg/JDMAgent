# -*- coding: utf-8 -*-
"""Éval hold-out avec un test LABELLISÉ (format « A de B : r_classe »).

Usage : py -3.13 scripts/gen_eval_labeled.py <learn.txt> <test_labelled.txt>
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from jdm_agent.client.client import JDMClient
from gen_train import load_corpus, parse_pair
from gen_eval import _vec


def load_labeled(path):
    out = []
    for line in open(path, encoding="utf-8"):
        st = line.strip()
        if " : " not in st:
            continue                      # entêtes de section / lignes vides
        left, right = st.split(" : ", 1)
        label = right.strip().split()[0]  # « r_relationnel - parenté » → r_relationnel
        p = parse_pair(left.strip())
        if p:
            out.append((p[0], p[1], label, p[2]))   # + connecteur (définitude de B)
    return out


def main():
    learn = load_corpus(sys.argv[1])
    test = load_labeled(sys.argv[2])
    import collections
    print(f"learn: {len(learn)} · test: {len(test)}")
    print("classes test:", dict(collections.Counter(t[2] for t in test)))

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
    print(f"\nACCURACY HOLD-OUT (labels réels) : {accuracy_score(yte, pred):.3f}  (sur {len(yte)} ex)")
    print(classification_report(yte, pred, digits=2, zero_division=0))


if __name__ == "__main__":
    main()
