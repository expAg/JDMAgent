"""Extracteur de relations sémantiques JeuxDeMots par patrons morpho-lexicaux.

Inspiré de Rel-Sem (github.com/Haniiist/Rel-Sem) — adapté à notre stack :

  texte --patrons(tokens)--> triplets (source, relation JDM, cible)

Idées reprises / adaptées :
- FICHIER DE PATRONS (`patterns.txt`) : tournures FR → relations JDM (r_isa,
  r_has_part, r_holo, r_has_conseq, r_causatif, r_carac, r_anto, r_lieu…).
- DÉTERMINANTS (un/le/du/d'un…) absorbés automatiquement (pas d'énumération).
- MOTS COMPOSÉS : extension locale d'un terme vers un composé connu de JDM
  (« pomme de terre ») ; JDM sert aussi de lexique-filtre.
- VERBES via JDM `r_lemma` : un mot du patron matche aussi une forme fléchie
  quand leurs lemmes JDM coïncident (« provoque/provoquait/provoquera » →
  « provoquer »). Pas besoin de lemmatiseur externe. Offline (sans client) : on
  reste sur du surface (les patrons listent la forme fléchie usuelle).

v1.5 : patrons à 2 fentes ($x, $y), matching par tokens.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

_PATTERNS_FILE = Path(__file__).with_name("patterns.txt")

# Token de mot (dans le texte comme dans les patrons) : lettres accentuées +
# chiffres, tiret/apostrophe internes (« l'inverse », « arc-en-ciel »).
_TERM_WORD = re.compile(
    r"[a-zàâäéèêëïîôöùûüçœ0-9]+(?:['’-][a-zàâäéèêëïîôöùûüçœ0-9]+)*", re.IGNORECASE)

# Déterminants absorbés en tête d'une fente de terme.
_DET_WORDS = {"le", "la", "les", "un", "une", "des", "du", "de", "d", "l",
              "au", "aux", "à"}

# Mots-outils : autorisés À L'INTÉRIEUR d'un composé (pomme DE terre, arc EN
# ciel) mais jamais en BORD (on ne veut pas « la voiture », « de fièvre »).
_FUNC = {
    "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "à",
    "et", "ou", "ni", "ce", "cet", "cette", "ces", "son", "sa", "ses", "mon", "ma",
    "mes", "ton", "ta", "tes", "notre", "votre", "nos", "vos", "leur", "leurs",
    "se", "s", "qui", "que", "dont", "où", "ne", "n", "est", "sont", "a", "ont",
    "il", "elle", "ils", "elles", "on", "je", "tu", "nous", "vous",
    "dans", "sur", "sous", "par", "pour", "avec", "sans", "en", "aussi",
}

_MISSING = object()


def _norm(w: str) -> str:
    return w.replace("’", "'").strip().lower()


def _load_raw_patterns(path: Path = _PATTERNS_FILE) -> list[tuple[str, str, str]]:
    """[(relation_jdm, étiquette, patron_brut)] depuis le fichier de patrons."""
    rel: Optional[str] = None
    label = ""
    out: list[tuple[str, str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            m = re.match(r"#\s*(r_[a-z_]+)\s+(.*)", s)
            if m:
                rel, label = m.group(1), m.group(2).strip()
            continue
        if rel and "$x" in s and "$y" in s:
            out.append((rel, label, s))
    return out


@lru_cache(maxsize=1)
def load_patterns() -> list[dict]:
    """Patrons → liste d'opérations (slot / littéral). Mis en cache."""
    out = []
    for rel, label, patron in _load_raw_patterns():
        ops = [("slot", tk) if tk in ("$x", "$y") else ("lit", _norm(tk))
               for tk in patron.split()]
        out.append({"relation": rel, "label": label, "pattern": patron, "ops": ops})
    return out


# ── Accès JDM (mots composés, lexique, lemmes) ───────────────────────────────
def _jdm_knows(client, term: str) -> bool:
    if client is None:
        return True
    try:
        return bool(client.term_exists(term.replace("_", " ")))
    except Exception:
        return False


def _jdm_lemmas(client, word: str) -> set:
    """Ensemble des lemmes JDM d'un mot (toutes cibles r_lemma positives) +
    le mot lui-même. Un ENSEMBLE (pas le plus fort) car les formes ambiguës
    nom/verbe ont plusieurs lemmes : « cause » → {cause, causer}, ce qui permet
    d'apparier « causera » → {causer} par intersection."""
    out = {word}
    if client is None:
        return out
    try:
        rid = client.relation_type_id("r_lemma")
        if rid is None:
            return out
        res = client.relations_from(word, types_ids=[rid])
        idx = res.node_index()
        for r in res.relations:
            if r.w > 0 and r.node2 in idx:
                out.add(idx[r.node2].name.lower())
    except Exception:
        pass
    return out


def _lemmas_cached(client, word: str, cache: dict) -> set:
    v = cache.get(word, _MISSING)
    if v is _MISSING:
        v = _jdm_lemmas(client, word)
        cache[word] = v
    return v


def _lit_ok(lit: str, surface: str, client, cache: dict) -> bool:
    """Un mot littéral du patron matche un token : égalité de surface, accord de
    participe (composé→composée/…), ou INTERSECTION des ensembles de lemmes JDM
    (formes fléchies des verbes). Repli lemme borné aux mots de contenu (≥4)."""
    s = _norm(surface)
    if s == lit:
        return True
    if lit.endswith("é") and s in (lit + "e", lit + "s", lit + "es"):
        return True
    if (client is not None and len(lit) >= 4 and len(s) >= 4
            and lit not in _FUNC and s not in _FUNC):
        if _lemmas_cached(client, s, cache) & _lemmas_cached(client, lit, cache):
            return True
    return False


def _try_match(ops, tokens, pos, client, cache) -> Optional[list[int]]:
    """Tente d'apparier `ops` à partir du token `pos`. Renvoie les index des
    tokens capturés (têtes de terme), ou None."""
    i = pos
    caps: list[int] = []
    for kind, val in ops:
        if kind == "slot":
            while i < len(tokens) and _norm(tokens[i]) in _DET_WORDS:
                i += 1
            if i >= len(tokens):
                return None
            caps.append(i)
            i += 1
        else:
            if i >= len(tokens) or not _lit_ok(val, tokens[i], client, cache):
                return None
            i += 1
    return caps


def _expand_compound(toks, idx, client, direction: str, maxk: int = 3) -> str:
    """Étend le terme au token `idx` vers un MOT COMPOSÉ connu de JDM. Les
    « de/à/en… » sont acceptés à l'intérieur mais refusés en bord (pas de
    déterminant capturé). Garde le plus long composé connu."""
    base = toks[idx][0]
    if client is None:
        return base
    best = base
    for k in range(1, maxk + 1):
        if direction == "left":
            j = idx - k
            if j < 0:
                break
            words = [w for w, _ in toks[j:idx + 1]]
        else:
            j = idx + k
            if j >= len(toks):
                break
            words = [w for w, _ in toks[idx:j + 1]]
        edge = words[0] if direction == "left" else words[-1]
        if _norm(edge) in _FUNC:
            continue
        cand = " ".join(words)
        if _jdm_knows(client, cand):
            best = cand
    return best


_SENT_SPLIT = re.compile(r"[.!?;:\n]+")


def extract_relations(text: str, client=None, *, validate: bool = True,
                      max_expand: int = 3) -> list[dict]:
    """Extrait des triplets JDM d'un texte par patrons morpho-lexicaux.

    Args:
        text: texte français.
        client: JDMClient — mots composés, lexique-filtre, lemmes de verbes.
            None → hors-ligne (surface brute, mono-mot).
        validate: ne garder que les triplets dont les DEUX termes sont connus de
            JDM (ignoré si client None).

    Renvoie [{source, relation, target, category, pattern}] dédupliqué.
    """
    patterns = load_patterns()
    seen: set[tuple[str, str, str]] = set()
    results: list[dict] = []
    lemma_cache: dict = {}

    for sentence in _SENT_SPLIT.split(text):
        low = sentence.strip().lower()
        if not low:
            continue
        toks = [(m.group(0), m.start()) for m in _TERM_WORD.finditer(low)]
        tokens = [w for w, _ in toks]
        n = len(tokens)
        for p in patterns:
            ops = p["ops"]
            for start in range(n):
                caps = _try_match(ops, tokens, start, client, lemma_cache)
                if not caps or len(caps) < 2:
                    continue
                i1, i2 = caps[0], caps[1]
                src = _expand_compound(toks, i1, client, "left", max_expand)
                tgt = _expand_compound(toks, i2, client, "right", max_expand)
                src, tgt = _norm(src), _norm(tgt)
                if not src or not tgt or src == tgt:
                    continue
                if validate and client is not None:
                    if not (_jdm_knows(client, src) and _jdm_knows(client, tgt)):
                        continue
                key = (src, p["relation"], tgt)
                if key in seen:
                    continue
                seen.add(key)
                results.append({
                    "source": src, "relation": p["relation"], "target": tgt,
                    "category": p["label"], "pattern": p["pattern"],
                })
    return results
