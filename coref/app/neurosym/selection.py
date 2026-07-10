"""J2/J4 — Restrictions de sélection JDM, en évidence SOUPLE (défaisable).

Pour un pronom argument d'un prédicat, on pondère un antécédent candidat selon
sa compatibilité sémantique dans le rôle (agent/patient du verbe) et selon les
caractéristiques (prédicat adjectival copule). Bornes étroites : l'absence dans
JDM ne pénalise PAS (≠ négation), et le score ne peut jamais éliminer un candidat
(pas de veto) — conforme au recadrage : le langage peut être figuré.
"""
from .jdm_client import weight

CAP = 0.6          # amplitude maximale du signal sémantique
SCALE = 300.0


def _fit(w):
    if w is None:
        return 0.0                       # absence = neutre (défaisable)
    return max(-CAP, min(CAP, w / SCALE))


def jdm_scorer(p, cand, doc):
    """Delta de score sémantique souple pour rattacher le pronom `p` à `cand`.

    Renvoie un réel borné (≈ [-0.6, +0.6]) ou 0.0. Jamais None/veto.
    """
    head, V = p["head"], p["head"].parent
    if V is None:
        return 0.0
    role = head.udeprel
    cand_lemma = (cand["head"].lemma or cand["head"].form or "").lower()
    if not cand_lemma:
        return 0.0

    delta = 0.0
    try:
        if V.upos == "VERB":
            if role in ("nsubj", "csubj"):
                delta += _fit(weight(V.lemma, "r_agent", cand_lemma))
            elif role in ("obj", "iobj", "nsubj:pass"):
                delta += _fit(weight(V.lemma, "r_patient", cand_lemma))
        # Prédicat adjectival copule : « elle est lourde » → V = adjectif tête.
        if V.upos == "ADJ" and role in ("nsubj", "nsubj:pass"):
            delta += _fit(weight(cand_lemma, "r_carac", (V.lemma or "").lower()))
    except Exception:
        return 0.0
    return delta
