"""Parseur des corpus boberle (Democrat/ANCOR) : CoNLL-U (col. 1-10) + colonne
de coréférence gold en encodage CoNLL-2012 (dernière colonne).

Pour chaque document, on produit :
  - `conllu` : le texte CoNLL-U (col. 1-10) prêt pour CorPipe (même tokenisation) ;
  - `gold` : dict {chain_id -> liste de spans (start_word_idx, end_word_idx)},
    indexé sur les MOTS (lignes à id entier, hors tokens multi-mots).
"""
import re

_INT = re.compile(r"^\d+$")


def _parse_coref_column(tokens_coref):
    """tokens_coref : liste (word_idx, champ_coref). Renvoie {cid: [(s,e), ...]}."""
    chains, stacks = {}, {}
    for wi, field in tokens_coref:
        if field in ("_", "-", ""):
            continue
        for part in field.split("|"):
            if part.startswith("(") and part.endswith(")"):
                cid = int(part[1:-1])
                chains.setdefault(cid, []).append((wi, wi))
            elif part.startswith("("):
                cid = int(part[1:])
                stacks.setdefault(cid, []).append(wi)
            elif part.endswith(")"):
                cid = int(part[:-1])
                s = stacks[cid].pop()
                chains.setdefault(cid, []).append((s, wi))
    return chains


def read_documents(path):
    """Itère sur les documents : dict {name, conllu, gold}."""
    docs = []
    cur_lines, cur_coref, wi, name = [], [], 0, None

    def flush():
        if cur_lines:
            docs.append({
                "name": name,
                "conllu": "\n".join(cur_lines) + "\n",
                "gold": _parse_coref_column(cur_coref),
            })

    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#begin document"):
                flush()
                cur_lines, cur_coref, wi = [], [], 0
                name = line.split("document", 1)[1].strip()
                continue
            if line.startswith("#end document"):
                continue
            if not line.strip():
                cur_lines.append("")           # frontière de phrase
                continue
            cols = line.split("\t")
            tid = cols[0]
            # ligne CoNLL-U = 10 premières colonnes
            cur_lines.append("\t".join(cols[:10]))
            if _INT.match(tid):                 # mot réel (pas un token multi-mot)
                cur_coref.append((wi, cols[-1]))
                wi += 1
    flush()
    return docs


def clusters_as_spansets(gold, min_size=2):
    """Convertit {cid:[spans]} en liste d'ensembles de spans (chaînes >= min_size)."""
    out = []
    for cid, spans in gold.items():
        uniq = sorted(set(spans))
        if len(uniq) >= min_size:
            out.append(frozenset(uniq))
    return out


if __name__ == "__main__":
    import sys
    docs = read_documents(sys.argv[1])
    n_chains = sum(len(clusters_as_spansets(d["gold"])) for d in docs)
    n_ment = sum(sum(len(c) for c in clusters_as_spansets(d["gold"])) for d in docs)
    print(f"documents: {len(docs)}")
    print(f"chaînes (>=2 mentions): {n_chains}")
    print(f"mentions (dans ces chaînes): {n_ment}")
    d = docs[0]
    print(f"\nexemple doc: {d['name']}")
    print(f"  lignes conllu: {d['conllu'].count(chr(10))}")
    print(f"  chaînes gold (toutes): {len(d['gold'])}")
    sample = clusters_as_spansets(d['gold'])[:2]
    print(f"  2 chaînes (spans): {[sorted(c) for c in sample]}")
