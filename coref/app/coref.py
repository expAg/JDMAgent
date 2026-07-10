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
    # 1) Texte -> CoNLL-U (UDPipe, léger). Sert aux tokens + au SVG (indices GLOBAUX).
    in_path = os.path.join(OUT_DIR, "request.conllu")
    os.makedirs(OUT_DIR, exist_ok=True)
    full_conllu = _udpipe(text)
    with open(in_path, "w", encoding="utf-8") as f:
        f.write(full_conllu)

    doc_in = udapi.Document(in_path)
    nodes = [n for tree in doc_in.trees for n in tree.descendants]
    tokens = [{
        "i": i, "text": n.form,
        "ws": "" if (n.misc and n.misc.get("SpaceAfter") == "No") else " ",
    } for i, n in enumerate(nodes)]
    ud_svg = _ud_svg(doc_in)

    # 2) Chaînes de coréférence.
    # PAR DÉFAUT : CorPipe seul (mesuré à ~60.7 CoNLL F1 sur Democrat dev).
    # La couche neuro-symbolique est DÉSACTIVÉE par défaut (dégrade le F1) : à ne
    # réactiver (COREF_NEUROSYM=1) qu'après correction + re-mesure.
    # Sur texte long, CorPipe sur tout le document part en temps quasi infini :
    # on passe par un découpage en FENÊTRES de phrases (COREF_CHUNK=1, défaut).
    from .chunking import split_sentences
    window = int(os.getenv("COREF_WINDOW", "6"))
    overlap = int(os.getenv("COREF_OVERLAP", "1"))
    n_sent = len(split_sentences(full_conllu))

    if os.getenv("COREF_NEUROSYM") == "1":
        doc = udapi.Document(predict_conllu(in_path))
        chains, corrections = resolve_chains(doc, jdm_scorer=None)
    elif os.getenv("COREF_CHUNK", "1") == "1" and n_sent > window:
        chains, corrections = _chunked_chains(full_conllu, tokens, window, overlap), []
    else:
        doc = udapi.Document(predict_conllu(in_path))
        idx = {id(n): i for i, n in enumerate(n for tree in doc.trees for n in tree.descendants)}
        chains, corrections = _baseline_chains(doc, idx, tokens), []

    return {"tokens": tokens, "chains": chains,
            "corrections": corrections, "ud_svg": ud_svg}


def _chunked_chains(full_conllu: str, tokens: list, window: int, overlap: int) -> list:
    """Coréférence NON BLOQUANTE : CorPipe par fenêtres de phrases, chaînes
    recousues via les mentions partagées dans le chevauchement (indices globaux)."""
    from .chunking import split_sentences, offsets, windows, stitch

    blocks = split_sentences(full_conllu)
    offs = offsets(blocks)
    raw = []  # liste de chaînes ; chaque chaîne = liste de spans GLOBAUX
    for (a, b) in windows(len(blocks), window, overlap):
        wpath = os.path.join(OUT_DIR, f"win_{a}_{b}.conllu")
        with open(wpath, "w", encoding="utf-8") as f:
            f.write("\n\n".join(blocks[a:b]) + "\n\n")
        docw = udapi.Document(predict_conllu(wpath))
        nodesw = [n for tree in docw.trees for n in tree.descendants]
        localidx = {id(n): i for i, n in enumerate(nodesw)}
        goff = offs[a]  # décalage global du 1er mot de la fenêtre
        for ent in getattr(docw, "coref_entities", []):
            spans = []
            for m in ent.mentions:
                span = sorted(localidx[id(w)] + goff for w in m.words if id(w) in localidx)
                if span:
                    spans.append(span)
            if spans:
                raw.append(spans)

    chains = []
    for spans in stitch(raw):
        if len(spans) < 2:  # une chaîne = au moins 2 mentions
            continue
        label = " ".join(tokens[i]["text"] for i in spans[0])
        chains.append({"id": 0, "label": label, "cat": "", "mentions": spans})
    chains.sort(key=lambda c: c["mentions"][0][0])
    for i, c in enumerate(chains):
        c["id"] = i
    return chains


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
