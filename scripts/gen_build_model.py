# -*- coding: utf-8 -*-
"""Entraîne GRASP-IT sur le corpus 'learn' et sérialise le pipeline (DictVectorizer
+ StandardScaler + LogisticRegression) dans models/grasp_it.joblib.

Usage : py -3.13 scripts/gen_build_model.py <learn.txt>
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
import joblib
from jdm_agent.client.client import JDMClient
from jdm_agent.genitive import featurize, model_path
from gen_train import load_corpus


def main():
    learn = load_corpus(sys.argv[1])
    print(f"{len(learn)} exemples · {len(set(c for *_, c in learn))} classes")
    client = JDMClient()
    cache = {}
    X, y = [], []
    for i, (a, b, c) in enumerate(learn):
        fv, _ev = featurize(client, a, b, cache)
        X.append(fv)
        y.append(c)
        if (i + 1) % 100 == 0:
            print(f"  {i+1}/{len(learn)}", flush=True)

    from sklearn.feature_extraction import DictVectorizer
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline

    model = make_pipeline(DictVectorizer(sparse=False),
                          StandardScaler(),
                          LogisticRegression(max_iter=3000, C=1.0))
    model.fit(X, y)
    os.makedirs(os.path.dirname(model_path()), exist_ok=True)
    joblib.dump(model, model_path())
    print("modèle sauvé →", os.path.abspath(model_path()))
    print("train accuracy :", round(model.score(X, y), 3))


if __name__ == "__main__":
    main()
