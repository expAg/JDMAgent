"""Résolution d'anaphores pronominales via le service de coréférence.

Principe : on demande les chaînes de coréférence au service coref, puis on
RÉÉCRIT le texte en remplaçant chaque mention PRONOMINALE par le représentant
nominal de sa chaîne (« Il s'est développé… » → « Le Louisiana blues s'est
développé… »). L'extracteur syntaxique re-parse ce texte résolu et rattache
alors la relation au bon terme.

Le service coref renvoie {tokens:[{i,text,ws}], chains:[{mentions:[[idx…]]…}]}.
"""
from __future__ import annotations

# Mentions considérées « pronominales » (à remplacer).
_PRON = {
    "il", "elle", "ils", "elles", "on", "lui", "eux", "elle-même", "lui-même",
    "celui", "celle", "ceux", "celles", "celui-ci", "celle-ci", "ce", "cela",
    "ça", "c'", "ceci", "leur", "y", "en", "se", "soi",
}


def _is_pron(word: str) -> bool:
    return word.lower().replace("’", "'").rstrip("'").strip() in _PRON


def _substitute(tokens: list, chains: list) -> str:
    """Réécrit le texte (pur, testable) : mentions pronominales → représentant."""
    repl: dict = {}
    for ch in chains or []:
        mentions = ch.get("mentions") or []
        # Représentant = la plus longue mention qui n'est pas un simple pronom.
        rep = None
        for span in mentions:
            words = " ".join(tokens[i]["text"] for i in span if i < len(tokens))
            if not words:
                continue
            if len(span) > 1 or not _is_pron(words):
                if rep is None or len(span) > rep[0]:
                    rep = (len(span), words)
        if rep is None:
            continue
        rep_text = rep[1]
        for span in mentions:
            if len(span) == 1:
                i = span[0]
                if i < len(tokens) and _is_pron(tokens[i]["text"]):
                    repl[i] = rep_text

    out = []
    for idx, t in enumerate(tokens):
        out.append(repl.get(idx, t.get("text", "")))
        out.append(t.get("ws", " "))
    return "".join(out).strip()


def resolve_pronouns(text: str, coref_url: str, *, timeout: float = 300.0) -> str:
    """Texte → texte avec anaphores pronominales résolues (via service coref).
    Lève en cas d'échec réseau (l'appelant gère le repli)."""
    import httpx
    r = httpx.post(coref_url, json={"text": text}, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return _substitute(data.get("tokens") or [], data.get("chains") or [])
