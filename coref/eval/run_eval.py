"""Évaluation réelle : CorPipe seul vs CorPipe + couche neuro-symbolique (ablation),
scoré en CoNLL F1 sur un corpus gold (Democrat/ANCOR au format boberle).

On donne à CorPipe l'UD GOLD (col. 1-10) → tokenisation identique au gold →
alignement token-à-token → scoring propre des clusters.

Usage : python eval/run_eval.py <fichier.conll> [n_docs]
"""
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import udapi

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.corpipe_engine import predict_conllu, OUT_DIR
from app.neurosym.rerank import resolve_chains, resolve_coarg_only, _node_index
from app.neurosym.selection import jdm_scorer
from eval.dataset import read_documents, clusters_as_spansets
from eval.metrics import Aggregator


def _span(tok_indices):
    return (min(tok_indices), max(tok_indices))


def _clean_conllu(text):
    """Normalise : supprime les lignes vides en double / en tête (CoNLL-U valide)."""
    out, prev_blank = [], True
    for ln in text.split("\n"):
        blank = (ln.strip() == "")
        if blank and prev_blank:
            continue
        out.append("" if blank else ln)
        prev_blank = blank
    return "\n".join(out).strip("\n") + "\n\n"


def baseline_clusters(doc):
    """Clusters bruts CorPipe depuis la sortie udapi (chaînes >= 2 mentions)."""
    order = _node_index(doc)
    out = []
    for ent in getattr(doc, "coref_entities", []):
        spans = set()
        for mu in ent.mentions:
            idx = [order[id(w)] for w in mu.words if id(w) in order]
            if idx:
                spans.add(_span(idx))
        if len(spans) >= 2:
            out.append(frozenset(spans))
    return out


def _chains_to_spansets(chains):
    out = []
    for c in chains:
        spans = {_span(m) for m in c["mentions"]}
        if len(spans) >= 2:
            out.append(frozenset(spans))
    return out


def layer_clusters(doc, **kw):
    return _chains_to_spansets(resolve_chains(doc, **kw)[0])


def coarg_only_clusters(doc):
    return _chains_to_spansets(resolve_coarg_only(doc))


# NB : le système JDM (HTTP par paire) est exclu de l'éval — trop lent sans cache
# pré-chauffé. On mesure d'abord les couches pur-Python (co-arg, saillance, centrage).
SYSTEMS = {
    "CorPipe (seul)":          "baseline",
    "+coarg conservateur":     "coarg_only",
    "+J1 actif (coarg+saill)": dict(jdm_scorer=None, use_centering=False),
}


def main():
    path = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    docs = sorted(read_documents(path), key=lambda d: len(d["conllu"]))[:n]  # plus petits d'abord
    aggs = {name: Aggregator() for name in SYSTEMS}

    tok = 0
    for i, d in enumerate(docs):
        gold = clusters_as_spansets(d["gold"], min_size=2)
        inp = os.path.join(OUT_DIR, "evaldoc.conllu")
        with open(inp, "w", encoding="utf-8") as f:
            f.write("# newdoc id = eval\n" + _clean_conllu(d["conllu"]))
        try:
            out = predict_conllu(inp)
            doc = udapi.Document(out)
        except Exception as e:
            print(f"  doc {i+1}/{len(docs)} IGNORÉ ({d['name'][:30]}): {e}", flush=True)
            continue
        tok += sum(1 for _ in (n for tree in doc.trees for n in tree.descendants))

        for name, kw in SYSTEMS.items():
            if kw == "baseline":
                pred = baseline_clusters(doc)
            elif kw == "coarg_only":
                pred = coarg_only_clusters(doc)
            else:
                pred = layer_clusters(doc, **kw)
            aggs[name].add(gold, pred)
        print(f"  doc {i+1}/{len(docs)} traité ({d['name'][:40]})", flush=True)

    print(f"\n=== Democrat (dev) — {len(docs)} docs, {tok} tokens ===")
    print(f"{'système':<30} {'MUC':>7} {'B³':>7} {'CEAFe':>7} {'CoNLL':>7}")
    for name in SYSTEMS:
        r = aggs[name].result()
        print(f"{name:<30} {r['muc']['f']*100:7.2f} {r['b3']['f']*100:7.2f} "
              f"{r['ceafe']['f']*100:7.2f} {r['conll']*100:7.2f}")


if __name__ == "__main__":
    main()
