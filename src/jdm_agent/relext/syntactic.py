"""Extraction de relations JDM pilotée par la SYNTAXE (dépendances UDPipe).

Résout les deux limites du modèle de surface :
- MOTS COMPOSÉS : un terme = un chunk nominal (tête + flat/compound/amod…),
  issu de la grammaire → « Louisiana blues », « rythmes lourds », « musique
  sombre » sans dépendre d'une liste JeuxDeMots.
- RATTACHEMENT AU SUJET : le complément d'un verbe est relié à son sujet
  syntaxique (nsubj), y compris à travers un relatif « qui » (→ antécédent, et si
  l'antécédent est un prédicat copule, son propre sujet). Ainsi « se distingue
  par des rythmes lourds » crée « Louisiana blues r_carac rythmes lourds ».

Jeu de règles v2 (déclencheurs par lemme + déprel/case), volontairement compact.
"""
from __future__ import annotations

from jdm_agent.relext.udpipe import analyse

# Modifieurs inclus dans un chunk nominal (mot composé).
_NP_MODS = {"flat", "flat:name", "compound", "fixed", "amod", "nummod"}
# Pronoms relatifs.
_REL = {"qui", "que", "qu'", "dont", "lequel", "laquelle", "lesquels",
        "lesquelles", "où"}
# Noms de lieu génériques : on descend vers leur complément « de X ».
_PLACE = {"état", "région", "ville", "pays", "zone", "alentour", "alentours",
          "périphérie", "proximité", "banlieue", "périmètre", "abord", "abords"}
# Sujets pronominaux non résolus (pas de coréférence ici) → on n'attache pas.
_SKIP_SUBJ = {"il", "elle", "ils", "elles", "on", "ce", "cela", "ça",
              "celui", "celle", "ceux", "celles"}
# Noms temporels : à exclure d'un complément de LIEU (« dans la période… »).
_TEMPORAL = {"période", "année", "siècle", "jour", "moment", "époque", "temps",
             "an", "décennie", "semaine", "mois", "heure", "date", "instant"}


def _np(sent, head_id: int) -> str:
    """Chunk nominal (tête + modifieurs) → texte, sans déterminant, minuscule."""
    ids = {head_id}
    frontier = [head_id]
    while frontier:
        cur = frontier.pop()
        for t in sent.children(cur):
            if t.deprel in _NP_MODS and t.id not in ids:
                ids.add(t.id)
                frontier.append(t.id)
    words = [sent.by_id[i].form for i in sorted(ids)
             if sent.by_id[i].upos != "DET"]
    return " ".join(words).strip().lower()


def _case_lemma(sent, tid: int):
    c = sent.child(tid, {"case"})
    return c.lemma if c else None


def _loc(sent, tid: int) -> str:
    """« état de la Louisiane » → louisiane ; « alentours de Bâton-Rouge » → …"""
    if sent.by_id[tid].lemma in _PLACE:
        for ch in sent.children(tid):
            if ch.deprel in ("nmod", "obl", "obl:arg") and _case_lemma(sent, ch.id) == "de":
                return _np(sent, ch.id)
    return _np(sent, tid)


def _term_np(sent, tok) -> "str | None":
    """Chunk nominal d'un argument, ou None si c'est un pronom personnel/
    démonstratif non résolu (il/elle/ce…)."""
    if tok.upos == "PRON" and (tok.feats.get("PronType") in ("Prs", "Dem")
                               or tok.form.lower() in _SKIP_SUBJ):
        return None
    return _np(sent, tok.id)


def _subject(sent, verb) -> "str | None":
    """Sujet syntaxique d'un verbe, avec résolution du relatif « qui »."""
    sub = sent.child(verb.id, {"nsubj", "nsubj:pass"})
    if sub is None:
        return None
    if sub.feats.get("PronType") == "Rel" or sub.lemma in _REL:
        ant = sent.by_id.get(verb.head)
        if ant is None:
            return None
        # antécédent = prédicat copule ? → prendre SON sujet (« Louisiana blues »)
        if sent.child(ant.id, {"cop"}) is not None:
            asub = sent.child(ant.id, {"nsubj", "nsubj:pass"})
            if asub is not None:
                return _np(sent, asub.id)
        return _np(sent, ant.id)
    # Sujet pronominal personnel/démonstratif (il/elle/ce…) : pas de coréférence
    # ici → on n'attache pas (le lemme UDPipe de « Il » est « lui » → on se fie
    # aux traits + à la forme).
    if sub.upos == "PRON" and (sub.feats.get("PronType") in ("Prs", "Dem")
                               or sub.form.lower() in _SKIP_SUBJ):
        return None
    return _np(sent, sub.id)


def _place_obl(sent, verb_id):
    """Complément de lieu d'un verbe (case dans/à/sur), en excluant les noms
    temporels (« dans la période »)."""
    for ch in sent.children(verb_id):
        if (ch.deprel.startswith("obl") and _case_lemma(sent, ch.id) in {"dans", "à", "sur"}
                and ch.lemma not in _TEMPORAL):
            return ch
    return None


def _obl_by_case(sent, verb_id, case_lemma):
    for ch in sent.children(verb_id):
        if ch.deprel.startswith("obl") and _case_lemma(sent, ch.id) == case_lemma:
            return ch
    return None


# Noms « prédicat de classe » : « est un genre/sorte de Y » → cible = Y.
_GENRE = {"genre", "sorte", "type", "espèce", "famille", "catégorie", "forme",
          "variété", "sous-genre"}

# lemme de verbe → (relation JDM, mode de complément)
_CONSEQ = {"produire", "provoquer", "causer", "entraîner", "engendrer",
           "déclencher", "générer", "induire"}
_HASPART = {"composer", "constituer", "comporter", "contenir", "inclure"}
_CARAC_OBJ = {"souligner", "amplifier", "présenter", "posséder", "arborer"}
_LOC = {"développer", "situer", "trouver", "implanter", "établir", "naître",
        "apparaître"}


def _emit(results, seen, subj, rel, obj, trigger):
    if not subj or not obj or subj == obj:
        return
    key = (subj, rel, obj)
    if key in seen:
        return
    seen.add(key)
    results.append({"source": subj, "relation": rel, "target": obj,
                    "category": trigger, "pattern": "(syntaxe)"})


def extract_syntactic(text: str) -> list:
    """Texte → triplets JDM (parse UDPipe puis règles)."""
    return extract_from_sentences(analyse(text))


def extract_from_sentences(sentences: list) -> list:
    """Applique les règles syntaxiques à des phrases déjà parsées. Renvoie
    [{source, relation, target, category, pattern}]. Testable hors-ligne."""
    results, seen = [], set()
    for sent in sentences:
        for t in sent.tokens:
            # ── Copule : « $x est un [genre/sorte de] $y » → r_isa ──
            # On EXCLUT les prédicats prépositionnels (« en marge », « dans X » :
            # le nom porte un `case`) → ce n'est pas une copule attributive.
            if (t.upos in ("NOUN", "PROPN") and sent.child(t.id, {"cop"}) is not None
                    and sent.child(t.id, {"case"}) is None):
                subj_tok = sent.child(t.id, {"nsubj", "nsubj:pass"})
                subj = _term_np(sent, subj_tok) if subj_tok is not None else None
                if subj:
                    m = None
                    for ch in sent.children(t.id):
                        if ch.deprel in ("nmod", "obl") and _case_lemma(sent, ch.id) == "de":
                            m = ch
                            break
                    if t.lemma in _GENRE:
                        # « est un genre de blues » → cible = blues
                        obj = _np(sent, m.id) if m else _np(sent, t.id)
                    elif m is not None:
                        # « est un musicien de blues » → cible = musicien de blues
                        obj = f"{t.form.lower()} de {_np(sent, m.id)}"
                    else:
                        obj = _np(sent, t.id)
                    _emit(results, seen, subj, "r_isa", obj, f"copule/{t.lemma}")

            # ── Verbes ──
            if t.upos != "VERB":
                continue
            L = t.lemma
            obj_tok = sent.child(t.id, {"obj"})

            # ── Alias / synonymie (n'ont pas besoin d'un nsubj) ──
            # « connu sous le nom de X » : E (tête de l'acl) r_syn X
            if L == "connaître":
                nom = next((c for c in sent.children(t.id)
                            if c.deprel.startswith("obl") and c.lemma == "nom"), None)
                ent = sent.by_id.get(t.head)
                if nom is not None and ent is not None:
                    alias = next((c for c in sent.children(nom.id)
                                  if c.deprel in ("nmod", "appos") and _case_lemma(sent, c.id) == "de"), None)
                    e = _term_np(sent, ent)
                    if alias is not None and e:
                        _emit(results, seen, e, "r_syn", _np(sent, alias.id), "connu sous le nom de")
            # « surnommer / appeler / nommer X Y » → X r_syn Y
            if L in {"surnommer", "appeler", "nommer"} and obj_tok is not None:
                second = next((c for c in sent.children(t.id)
                               if c.deprel in ("xcomp", "obl:mod", "obj") and c.id != obj_tok.id), None)
                if second is None:
                    second = sent.child(obj_tok.id, {"appos"})
                o1 = _term_np(sent, obj_tok)
                if second is not None and o1:
                    _emit(results, seen, o1, "r_syn", _np(sent, second.id), L)

            # ── Règles à SUJET ──
            subj = _subject(sent, t)
            if subj is None:
                continue
            if L in {"distinguer", "caractériser"}:
                par = _obl_by_case(sent, t.id, "par")
                if par is not None:
                    _emit(results, seen, subj, "r_carac", _np(sent, par.id), L)
            if L in _CARAC_OBJ and obj_tok is not None:
                _emit(results, seen, subj, "r_carac", _np(sent, obj_tok.id), L)
            if L in _CONSEQ:
                comp = obj_tok or _obl_by_case(sent, t.id, "en") or _obl_by_case(sent, t.id, "à")
                if comp is not None:
                    _emit(results, seen, subj, "r_has_conseq", _np(sent, comp.id), L)
            if L in _HASPART:
                comp = obj_tok or _obl_by_case(sent, t.id, "de")
                if comp is not None:
                    _emit(results, seen, subj, "r_has_part", _np(sent, comp.id), L)
            if L in _LOC:
                loc = _place_obl(sent, t.id)
                if loc is not None:
                    _emit(results, seen, subj, "r_lieu", _loc(sent, loc.id), L)
            if L == "faire" and obj_tok is not None and obj_tok.lemma == "partie":
                for ch in sent.children(obj_tok.id):
                    if ch.deprel in ("nmod", "obl") and _case_lemma(sent, ch.id) == "de":
                        _emit(results, seen, subj, "r_holo", _np(sent, ch.id), "faire partie de")
    return results
