"""Extracteur de relations sémantiques JeuxDeMots par patrons morpho-lexicaux.

Inspiré de Rel-Sem (github.com/Haniiist/Rel-Sem) — adapté à notre stack :

  texte --patrons(regex)--> triplets (source, relation JDM, cible)

Idées clés reprises / adaptées :
- un FICHIER DE PATRONS (`patterns.txt`) mappe des tournures françaises vers des
  relations JDM (r_isa, r_has_part, r_holo, r_has_conseq, r_causatif, r_carac,
  r_anto, r_lieu…). Éditable sans toucher au code.
- les DÉTERMINANTS (un/une/des/le/la/du/de la/d'un…) sont absorbés
  automatiquement — inutile de les énumérer (contrairement à la version Java).
- réflexion MOTS COMPOSÉS : on interroge JDM pour reconnaître les termes
  multi-mots (« pomme de terre », « moulin à vent ») comme UNE unité, de sorte
  que les patrons ne les coupent pas ; JDM sert aussi de lexique-filtre (on ne
  garde que des termes réellement connus de JDM).

v1 : recherche de SURFACE (pas encore de lemmatisation ; les verbes sont listés
à leur forme fléchie usuelle). Amélioration possible : lemmatiser via UDPipe.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

_PATTERNS_FILE = Path(__file__).with_name("patterns.txt")

# Un déterminant (optionnel) devant un terme — absorbé, jamais capturé.
_DET = (r"(?:un|une|des|le|la|les|l['’]|du|de\s+la|de\s+l['’]|"
        r"d['’]un|d['’]une|de|d['’]|au|aux|à\s+la|à\s+l['’])")
# Un token de terme (capturé par les patrons) : lettres accentuées + chiffres,
# tiret/apostrophe internes.
_TERMTOK = r"[a-zàâäéèêëïîôöùûüçœ0-9][a-zàâäéèêëïîôöùûüçœ0-9'’-]*"


def _load_raw_patterns(path: Path = _PATTERNS_FILE) -> list[tuple[str, str, str]]:
    """Renvoie [(relation_jdm, étiquette, patron_brut)] depuis le fichier."""
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


def _compile(patron: str) -> re.Pattern:
    """Compile « $x <mots> $y » en regex : termes capturés, déterminant optionnel
    devant chaque terme, mots littéraux tolérants aux apostrophes."""
    parts = []
    for tk in patron.split():
        if tk in ("$x", "$y"):
            parts.append(("slot", tk))
        else:
            parts.append(("lit", tk))
    rx = [r"\b"]
    for j, (kind, val) in enumerate(parts):
        if kind == "slot":
            rx.append(r"(?:" + _DET + r"\s+)?(" + _TERMTOK + r")")
        else:
            lit = re.escape(val).replace("'", "['’]").replace("’", "['’]")
            # Accord des participes passés : composé → composé(e)(s)
            # (couvre composée/composés/composées, constitué…, caractérisé…, causé…).
            if val.endswith("é"):
                lit = lit[:-1] + "é(?:e?s?)"
            rx.append(lit)
        if j < len(parts) - 1:
            rx.append(r"\s+")
    rx.append(r"\b")
    return re.compile("".join(rx), re.IGNORECASE)


@lru_cache(maxsize=1)
def load_patterns() -> list[dict]:
    """Patrons compilés (mis en cache). Chaque entrée : relation, label, patron, rx."""
    compiled = []
    for rel, label, patron in _load_raw_patterns():
        compiled.append({"relation": rel, "label": label,
                         "pattern": patron, "rx": _compile(patron)})
    return compiled


def _jdm_knows(client, term: str) -> bool:
    if client is None:
        return True
    try:
        return bool(client.term_exists(term.replace("_", " ")))
    except Exception:
        return False


_SENT_SPLIT = re.compile(r"[.!?;:\n]+")
_TERM_WORD = re.compile(r"[a-zàâäéèêëïîôöùûüçœ0-9]+(?:['’-][a-zàâäéèêëïîôöùûüçœ0-9]+)*",
                        re.IGNORECASE)


# Mots-outils : autorisés À L'INTÉRIEUR d'un composé (pomme DE terre, arc EN
# ciel) mais jamais en BORD (on ne veut pas « la voiture », « de fièvre »).
_FUNC = {
    "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "à",
    "et", "ou", "ni", "ce", "cet", "cette", "ces", "son", "sa", "ses", "mon", "ma",
    "mes", "ton", "ta", "tes", "notre", "votre", "nos", "vos", "leur", "leurs",
    "se", "s", "qui", "que", "dont", "où", "ne", "n", "est", "sont", "a", "ont",
    "il", "elle", "ils", "elles", "on", "je", "tu", "nous", "vous",
    "dans", "sur", "sous", "par", "pour", "avec", "sans", "en",
}


def _expand_compound(toks, idx, client, direction: str, maxk: int = 3) -> str:
    """Étend le terme au token `idx` vers un MOT COMPOSÉ connu de JDM en incluant
    les tokens adjacents. Les « de/à/en… » sont acceptés à l'intérieur d'un
    composé mais refusés en bord (pas de déterminant capturé). Garde le plus long
    connu. Extension purement locale au terme — ne touche pas aux mots du patron.
    """
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
        if edge.lower() in _FUNC:
            continue  # bord = mot-outil → on saute (un k plus grand peut convenir)
        cand = " ".join(words)
        if _jdm_knows(client, cand):
            best = cand
    return best


def extract_relations(text: str, client=None, *, validate: bool = True,
                      max_expand: int = 3) -> list[dict]:
    """Extrait des triplets JDM d'un texte par patrons morpho-lexicaux.

    Args:
        text: texte français.
        client: JDMClient — sert à (a) étendre les termes en MOTS COMPOSÉS
            connus (« pomme de terre »), (b) filtrer sur le lexique JDM.
            None → hors-ligne (appariements de surface bruts, mono-mot).
        validate: ne garder que les triplets dont les DEUX termes sont connus de
            JDM (lexique-filtre). Ignoré si client est None.

    Renvoie une liste de dicts dédupliqués :
        {source, relation, target, category, pattern}
    """
    patterns = load_patterns()
    seen: set[tuple[str, str, str]] = set()
    results: list[dict] = []

    for sentence in _SENT_SPLIT.split(text):
        sentence = sentence.strip().lower()
        if not sentence:
            continue
        # Tokens (mot, offset) → retrouver le token d'un terme par son offset,
        # puis l'étendre en composé sur la séquence de tokens.
        toks = [(m.group(0), m.start()) for m in _TERM_WORD.finditer(sentence)]
        start_to_idx = {st: i for i, (w, st) in enumerate(toks)}

        for p in patterns:
            for m in p["rx"].finditer(sentence):
                i1 = start_to_idx.get(m.start(1))
                i2 = start_to_idx.get(m.start(2))
                src = (_expand_compound(toks, i1, client, "left", max_expand)
                       if i1 is not None else m.group(1))
                tgt = (_expand_compound(toks, i2, client, "right", max_expand)
                       if i2 is not None else m.group(2))
                src, tgt = src.strip(), tgt.strip()
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
