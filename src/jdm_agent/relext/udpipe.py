"""Analyse en dépendances via UDPipe 2 (service public LIRMM/ÚFAL, lindat).

Léger : un appel HTTP + un parseur CoNLL-U minimal (pas de dépendance udapi).
Renvoie des phrases de tokens (form, lemma, upos, feats, head, deprel) — de quoi
faire de l'extraction de relations pilotée par la SYNTAXE (chunks nominaux =
mots composés, rattachement au sujet, etc.).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

_UDPIPE_URL = os.environ.get(
    "UDPIPE_URL", "https://lindat.mff.cuni.cz/services/udpipe/api/process")
_UDPIPE_MODEL = os.environ.get("UDPIPE_MODEL", "french")


@dataclass
class Token:
    id: int
    form: str
    lemma: str
    upos: str
    feats: dict
    head: int
    deprel: str


@dataclass
class Sentence:
    tokens: list  # 1-indexé via .by_id ; liste dans l'ordre
    by_id: dict = field(default_factory=dict)

    def children(self, tid: int) -> list:
        return [t for t in self.tokens if t.head == tid]

    def child(self, tid: int, deprels) -> "Token | None":
        for t in self.tokens:
            if t.head == tid and t.deprel in deprels:
                return t
        return None


def _parse_feats(s: str) -> dict:
    if not s or s == "_":
        return {}
    out = {}
    for kv in s.split("|"):
        if "=" in kv:
            k, v = kv.split("=", 1)
            out[k] = v
    return out


def parse_conllu(conllu: str) -> list:
    """CoNLL-U texte → liste de Sentence (ignore tokens multi-mots « 3-4 »)."""
    sents, toks = [], []
    for line in conllu.splitlines():
        if not line.strip():
            if toks:
                sents.append(_mk_sentence(toks))
                toks = []
            continue
        if line.startswith("#"):
            continue
        c = line.split("\t")
        if len(c) < 8 or "-" in c[0] or "." in c[0]:
            continue
        toks.append(Token(int(c[0]), c[1], c[2] if c[2] != "_" else c[1],
                          c[3], _parse_feats(c[5]), int(c[6]), c[7]))
    if toks:
        sents.append(_mk_sentence(toks))
    return sents


def _mk_sentence(toks: list) -> Sentence:
    s = Sentence(tokens=toks)
    s.by_id = {t.id: t for t in toks}
    return s


def analyse(text: str, *, timeout: float = 60.0) -> list:
    """Texte → liste de Sentence via UDPipe 2. Lève en cas d'échec réseau."""
    import httpx
    r = httpx.post(_UDPIPE_URL, data={
        "data": text, "model": _UDPIPE_MODEL,
        "tokenizer": "", "tagger": "", "parser": "",
    }, timeout=timeout)
    r.raise_for_status()
    return parse_conllu(r.json()["result"])
