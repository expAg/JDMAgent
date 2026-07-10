"""Pipeline de coréférence française SOTA (CorPipe 25) + dépendances UD.

  texte --UDPipe2--> CoNLL-U --CorPipe25--> CoNLL-U annoté (Entity=)
        --udapi--> chaînes de coréférence + arbres de dépendances (UD)
"""
import os
import warnings

warnings.filterwarnings("ignore")

import requests
import udapi
from spacy import displacy

from .corpipe_engine import predict_conllu, OUT_DIR
from .neurosym.rerank import resolve_chains
from .neurosym.selection import jdm_scorer

UDPIPE_URL = "https://lindat.mff.cuni.cz/services/udpipe/api/process"
UDPIPE_MODEL = "french"  # french-gsd : tokenisation alignée sur l'entraînement de CorPipe


def _udpipe(text: str) -> str:
    """Texte brut -> CoNLL-U (tokenisation + POS + dépendances UD), via UDPipe 2."""
    r = requests.post(UDPIPE_URL, data={
        "data": text, "model": UDPIPE_MODEL,
        "tokenizer": "", "tagger": "", "parser": "",
    }, timeout=60)
    r.raise_for_status()
    return r.json()["result"]


def _ud_svg(doc) -> str:
    """SVG des dépendances universelles (displaCy, mode manuel), une par phrase."""
    opts = {"compact": True, "bg": "#ffffff", "color": "#1d2330",
            "distance": 110, "word_spacing": 28}
    svgs = []
    for tree in doc.trees:
        nodes = tree.descendants
        pos = {n.ord: i for i, n in enumerate(nodes)}
        words = [{"text": n.form, "tag": n.upos or ""} for n in nodes]
        arcs = []
        for n in nodes:
            if n.parent is None or n.parent.is_root():
                continue
            i, j = pos[n.ord], pos[n.parent.ord]
            arcs.append({"start": min(i, j), "end": max(i, j),
                         "label": n.deprel or "", "dir": "left" if j > i else "right"})
        svgs.append(displacy.render({"words": words, "arcs": arcs},
                                    style="dep", manual=True, options=opts))
    return "\n".join(svgs)


def resolve(text: str) -> dict:
    """Analyse un texte : tokens, chaînes de coréférence (toutes mentions), SVG UD."""
    # 1) Texte -> CoNLL-U
    in_path = os.path.join(OUT_DIR, "request.conllu")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(in_path, "w", encoding="utf-8") as f:
        f.write(_udpipe(text))

    # 2) CorPipe 25 -> CoNLL-U annoté en coréférence
    out_path = predict_conllu(in_path)

    # 3) Lecture via udapi
    doc = udapi.Document(out_path)

    # Index global des tokens (mots, dans l'ordre du document)
    nodes = [n for tree in doc.trees for n in tree.descendants]
    idx = {id(n): i for i, n in enumerate(nodes)}
    tokens = [{
        "i": i, "text": n.form,
        "ws": "" if (n.misc and n.misc.get("SpaceAfter") == "No") else " ",
    } for i, n in enumerate(nodes)]

    # Chaînes de coréférence.
    # PAR DÉFAUT : CorPipe seul (mesuré à ~60.7 CoNLL F1 sur Democrat dev).
    # La couche neuro-symbolique est DÉSACTIVÉE par défaut : l'évaluation
    # (eval/run_eval.py) montre qu'elle dégrade le F1 de ~16-18 points — elle
    # re-résout trop agressivement les pronoms et écrase CorPipe. À ne réactiver
    # (COREF_NEUROSYM=1) qu'après l'avoir corrigée ET re-mesurée.
    if os.getenv("COREF_NEUROSYM") == "1":
        chains, corrections = resolve_chains(doc, jdm_scorer=None)
    else:
        chains, corrections = _baseline_chains(doc, idx, tokens), []

    return {"tokens": tokens, "chains": chains,
            "corrections": corrections, "ud_svg": _ud_svg(doc)}


def syntax(text: str) -> dict:
    """Analyse syntaxique SEULE : texte -> dépendances universelles (UD).

    Chemin allégé de `resolve()` : UDPipe2 (tokenisation + POS + parse) puis rendu
    displaCy, SANS CorPipe (le modèle mT5-large n'est pas chargé). Renvoie les
    `tokens` (dans l'ordre du document) et le SVG des arbres de dépendances.
    """
    in_path = os.path.join(OUT_DIR, "syntax_request.conllu")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(in_path, "w", encoding="utf-8") as f:
        f.write(_udpipe(text))

    doc = udapi.Document(in_path)
    nodes = [n for tree in doc.trees for n in tree.descendants]
    tokens = [{
        "i": i, "text": n.form,
        "ws": "" if (n.misc and n.misc.get("SpaceAfter") == "No") else " ",
    } for i, n in enumerate(nodes)]
    return {"tokens": tokens, "ud_svg": _ud_svg(doc)}


def _baseline_chains(doc, idx, tokens):
    """Chaînes brutes de CorPipe (>= 2 mentions) — le résultat SOTA de référence."""
    chains = []
    for ent in getattr(doc, "coref_entities", []):
        mentions = []
        for m in ent.mentions:
            span = sorted(idx[id(w)] for w in m.words if id(w) in idx)
            if span:
                mentions.append(span)
        if len(mentions) < 2:
            continue
        label = " ".join(tokens[i]["text"] for i in mentions[0])
        chains.append({"id": 0, "label": label, "cat": ent.etype or "",
                       "mentions": mentions})
    chains.sort(key=lambda c: c["mentions"][0][0])
    for i, c in enumerate(chains):
        c["id"] = i
    return chains
