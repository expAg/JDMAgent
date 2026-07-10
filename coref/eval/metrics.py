"""Métriques de coréférence standard : MUC, B³, CEAFe → CoNLL F1 (leur moyenne).

Les clusters sont des listes d'ensembles de clés de mention (ex. spans (start,end)).
Chaque métrique renvoie des compteurs micro-agrégeables (num/den de R et P) afin de
sommer correctement sur plusieurs documents avant de calculer F1 — comme le scorer
officiel CoNLL/CorefUD.
"""
from scipy.optimize import linear_sum_assignment
import numpy as np


def _f1(rn, rd, pn, pd):
    r = rn / rd if rd else 0.0
    p = pn / pd if pd else 0.0
    f = 2 * p * r / (p + r) if (p + r) else 0.0
    return p, r, f


def muc_counts(gold, pred):
    def part(c, others):
        seen, mapped = 0, set()
        idx = {m: i for i, o in enumerate(others) for m in o}
        singles = 0
        for m in c:
            if m in idx:
                mapped.add(idx[m])
            else:
                singles += 1
        return len(mapped) + singles
    rn = sum(len(g) - part(g, pred) for g in gold)
    rd = sum(len(g) - 1 for g in gold)
    pn = sum(len(p) - part(p, gold) for p in pred)
    pd = sum(len(p) - 1 for p in pred)
    return rn, rd, pn, pd


def b3_counts(gold, pred):
    pred_of = {m: p for p in pred for m in p}
    gold_of = {m: g for g in gold for m in g}
    rn = 0.0
    for g in gold:
        for m in g:
            p = pred_of.get(m)
            if p:
                rn += len(g & p) / len(g)
    rd = sum(len(g) for g in gold)
    pn = 0.0
    for p in pred:
        for m in p:
            g = gold_of.get(m)
            if g:
                pn += len(g & p) / len(p)
    pd = sum(len(p) for p in pred)
    return rn, rd, pn, pd


def ceafe_counts(gold, pred):
    if not gold or not pred:
        return 0.0, len(gold), 0.0, len(pred)
    sim = np.zeros((len(gold), len(pred)))
    for i, g in enumerate(gold):
        for j, p in enumerate(pred):
            if g & p:
                sim[i, j] = 2 * len(g & p) / (len(g) + len(p))
    ri, cj = linear_sum_assignment(-sim)
    best = sim[ri, cj].sum()
    # renvoie (best, #gold, best, #pred) -> recall=best/#gold, prec=best/#pred
    return best, len(gold), best, len(pred)


def conll_f1(gold, pred):
    """Renvoie un dict {muc, b3, ceafe, conll} de scores F1 (un seul document/lot)."""
    out = {}
    fs = []
    for name, fn in (("muc", muc_counts), ("b3", b3_counts), ("ceafe", ceafe_counts)):
        rn, rd, pn, pd = fn(gold, pred)
        p, r, f = _f1(rn, rd, pn, pd)
        out[name] = {"p": p, "r": r, "f": f}
        fs.append(f)
    out["conll"] = sum(fs) / 3
    return out


class Aggregator:
    """Micro-agrège les compteurs sur plusieurs documents avant le F1 final."""
    def __init__(self):
        self.c = {k: [0.0, 0.0, 0.0, 0.0] for k in ("muc", "b3", "ceafe")}

    def add(self, gold, pred):
        for name, fn in (("muc", muc_counts), ("b3", b3_counts), ("ceafe", ceafe_counts)):
            vals = fn(gold, pred)
            for i in range(4):
                self.c[name][i] += vals[i]

    def result(self):
        out, fs = {}, []
        for name in ("muc", "b3", "ceafe"):
            rn, rd, pn, pd = self.c[name]
            p, r, f = _f1(rn, rd, pn, pd)
            out[name] = {"p": round(p, 4), "r": round(r, 4), "f": round(f, 4)}
            fs.append(f)
        out["conll"] = round(sum(fs) / 3, 4)
        return out


if __name__ == "__main__":
    # Auto-tests
    A = frozenset({(0, 0), (1, 1), (2, 2)})
    B = frozenset({(3, 3), (4, 4)})
    gold = [A, B]
    print("identité (doit être 1.0):", conll_f1(gold, [A, B])["conll"])
    print("désaccord total:", conll_f1(gold, [frozenset({(0, 0), (3, 3)}),
                                              frozenset({(1, 1), (4, 4)})])["conll"])
    print("partiel:", round(conll_f1(gold, [frozenset({(0, 0), (1, 1)}),
                                            frozenset({(2, 2), (3, 3), (4, 4)})])["conll"], 4))
