# -*- coding: utf-8 -*-
"""Modèle génitif v2 — features enrichies :
  - INFO-SEM (r_infopot 36) + hyperonymes (r_isa 6) pour A et B (comme v1) ;
  - PRÉSENCE de relations sortantes TYPÉES du terme (r_processus>agent/patient →
    nom d'action ; r_lieu-1/r_lieu_action → lieu ; r_own-1, r_object>mater…) ;
  - relation DIRECTE A↔B (relations_between, les deux sens) : son TYPE donne
    souvent la classe (table→bois = r_object>mater = composition ; roue→vélo =
    r_holo = holonymie).

Rapporte CV 5-fold (learn) ET hold-out (test labellisé).
Usage : py -3.13 scripts/gen_train2.py <learn.txt> <test_labelled.txt>
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from jdm_agent.client.client import JDMClient
from gen_train import load_corpus, parse_pair
from gen_eval_labeled import load_labeled

# Relations sortantes typées informatives (id → étiquette courte).
_TYPE_TAGS = {70: "procag", 76: "procpa", 24: "ag1", 26: "pa1", 28: "lieu1",
              30: "lieuact", 122: "own1", 171: "origin", 50: "mater", 10: "holo",
              9: "haspart", 100: "auteur", 37: "telic", 3: "domain"}


def _term_feats(client, term, cache):
    if term in cache:
        return cache[term]
    f = {}
    # 1 fetch tous-types → hyperonymes (r_isa=6) + présence de types sortants
    try:
        res = client.relations_from(term, limit=500)
        idx = res.node_index()
        isa = []
        seen = set()
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
    # INFO-SEM (r_infopot=36) garanti par un fetch ciblé
    try:
        res = client.relations_from(term, types_ids=[36], limit=80)
        idx = res.node_index()
        for r in res.relations:
            n = idx.get(r.node2)
            if n and n.name.upper().startswith("_INFO") and r.w > 0:
                f["INFO:" + n.name.lower()] = np.log1p(r.w)
    except Exception:
        pass
    cache[term] = f
    return f


def _pair_feats(client, a, b, cache):
    key = ("PAIR", a, b)
    if key in cache:
        return cache[key]
    f = {}
    for x, y, pref in ((a, b, "AB"), (b, a, "BA")):
        try:
            res = client.relations_between(x, y)
            for rel in res.relations:
                if rel.w > 0:
                    tn = client.relation_type_name(rel.type) or str(rel.type)
                    k = pref + ":" + tn
                    f[k] = max(f.get(k, 0.0), np.log1p(rel.w))
        except Exception:
            pass
    cache[key] = f
    return f


def _vec(client, pairs, cache):
    # Utilise EXACTEMENT les features déployées (genitive.featurize, filtrées).
    from jdm_agent.genitive import featurize
    dicts, y = [], []
    for i, (a, b, c) in enumerate(pairs):
        fv, _ev = featurize(client, a, b, cache)
        dicts.append(fv)
        y.append(c)
        if (i + 1) % 100 == 0:
            print(f"    {i+1}/{len(pairs)}", flush=True)
    return dicts, np.array(y)


def main():
    learn = load_corpus(sys.argv[1])
    test = load_labeled(sys.argv[2])
    client = JDMClient()
    cache = {}
    print("features learn…", flush=True)
    Xtr_d, ytr = _vec(client, learn, cache)
    print("features test…", flush=True)
    Xte_d, yte = _vec(client, test, cache)

    from sklearn.feature_extraction import DictVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import accuracy_score, classification_report

    vec = DictVectorizer(sparse=False)
    Xtr = vec.fit_transform(Xtr_d)
    Xte = vec.transform(Xte_d)
    print(f"features: {Xtr.shape[1]}")

    def pipe():
        return make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=1.0))

    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    pcv = cross_val_predict(pipe(), Xtr, ytr, cv=cv)
    print(f"\nCV 5-fold (learn) : {accuracy_score(ytr, pcv):.3f}")

    clf = pipe(); clf.fit(Xtr, ytr)
    pte = clf.predict(Xte)
    print(f"HOLD-OUT (test)   : {accuracy_score(yte, pte):.3f}")
    print(classification_report(yte, pte, digits=2, zero_division=0))


if __name__ == "__main__":
    main()
