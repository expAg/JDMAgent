import warnings; warnings.filterwarnings("ignore")
import os, udapi
from app.coref import _udpipe, OUT_DIR
from app.corpipe_engine import predict_conllu
from app.neurosym.coargs import cannot_link_pairs as _clp
def cannot_link_pairs(doc):
    return _clp(doc)
from app.neurosym.rerank import resolve_chains, _node_index, _sentences, _collect_mentions

TEXT = "John a appelé son frère parce qu'il voulait lui rendre les clés. Il les avait oubliées chez lui hier soir. Il avait peur qu'il les ait mangées"

p = os.path.join(OUT_DIR, "t.conllu")
open(p, "w", encoding="utf-8").write(_udpipe(TEXT))
doc = udapi.Document(predict_conllu(p))
order, sents = _node_index(doc), _sentences(doc)

print("== mentions CorPipe (avec genre/nombre/upos/role) ==")
mentions = _collect_mentions(doc, order, sents)
for m in mentions:
    h = m["head"]
    print(f"  {' '.join(w.form for w in m['words']):<16} orig={m['orig']:<4} "
          f"upos={h.upos:<6} role={h.udeprel:<8} "
          f"G={h.feats.get('Gender') or '-':<5} N={h.feats.get('Number') or '-':<5} pron={m['is_pron']}")

print("== CorPipe brut ==")
for ent in doc.coref_entities:
    print("  ", ent.eid, [" ".join(w.form for w in mu.words) for mu in ent.mentions])

print("== cannot-link (co-args) ==")
_pairs, _reasons = _clp(doc)
for k, (a, b, v) in _reasons.items():
    print(f"   {a.form} !=  {b.form}   (verbe: {v.form})")

from app.neurosym.selection import jdm_scorer
chains, corr = resolve_chains(doc, jdm_scorer=jdm_scorer)
nodes = [n for tree in doc.trees for n in tree.descendants]
print("== après neuro-symbolique ==")
for c in chains:
    print("  ", c["id"], "«", c["label"], "»:",
          ["+".join(nodes[i].form for i in m) for m in c["mentions"]])
print("corrections:", corr)
