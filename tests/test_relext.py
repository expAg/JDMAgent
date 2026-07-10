# -*- coding: utf-8 -*-
"""Tests hors-ligne de l'extracteur de relations sémantiques (patrons de surface).

client=None → aucun appel réseau : on ne teste que le fichier de patrons, la
compilation regex, l'accord des participes et le mapping vers les relations JDM.
La partie mots-composés / filtre lexical (qui interroge JDM) n'est pas testée ici.
"""
from jdm_agent.relext import extract_relations, load_patterns


def _keys(rows):
    return {(r["source"], r["relation"], r["target"]) for r in rows}


def test_patterns_load():
    pats = load_patterns()
    assert len(pats) > 20
    assert all(p["relation"].startswith("r_") for p in pats)
    # chaque patron a bien deux fentes et une regex compilée
    for p in pats:
        assert "$x" in p["pattern"] and "$y" in p["pattern"]
        assert p["ops"] and any(k == "slot" for k, _ in p["ops"])


def test_surface_extraction_offline():
    txt = ("Le chat est une sorte de félin. "
           "La grippe provoque de la fièvre. "
           "Paris se trouve dans France. "
           "La roue fait partie de la voiture.")
    k = _keys(extract_relations(txt, client=None))
    assert ("chat", "r_isa", "félin") in k
    assert ("grippe", "r_has_conseq", "fièvre") in k
    assert ("paris", "r_lieu", "france") in k
    assert ("roue", "r_holo", "voiture") in k


def test_gender_agreement_offline():
    # « composée » (féminin) doit matcher le patron « $x est composé de $y »
    k = _keys(extract_relations("La voiture est composée de roue.", client=None))
    assert ("voiture", "r_has_part", "roue") in k


def test_no_determiner_captured_offline():
    # sans client on ne filtre pas, mais le déterminant ne doit pas être capturé
    rows = extract_relations("Le chien est une sorte de animal.", client=None)
    srcs = {r["source"] for r in rows}
    assert "chien" in srcs
    assert "le chien" not in srcs


def test_pronoun_substitution_offline():
    # substitution pure (sans réseau) : la mention pronominale « Il » est
    # remplacée par le représentant nominal de sa chaîne.
    from jdm_agent.relext.coref import _substitute
    words = ["Le", "chat", "dort", ".", "Il", "ronronne", "."]
    tokens = [{"i": i, "text": w, "ws": ("" if w == "." else " ")}
              for i, w in enumerate(words)]
    chains = [{"id": 0, "mentions": [[0, 1], [4]]}]
    out = _substitute(tokens, chains)
    assert "le chat ronronne" in out.lower()
    assert " il " not in (" " + out.lower() + " ")


def test_pronoun_substitution_prefers_first_name():
    # « Leslie Johnson … Il est un pionnier du swamp blues » : la chaîne contient
    # le NOM (tôt) ET le PRÉDICAT nominal (long). On doit substituer « Il » par le
    # nom, pas par le prédicat (sinon tautologie « pionnier … est un pionnier »).
    from jdm_agent.relext.coref import _substitute
    words = ["Leslie", "Johnson", "chante", ".", "Il", "est", "un",
             "pionnier", "du", "swamp", "blues", "."]
    tokens = [{"i": i, "text": w, "ws": ("" if w == "." else " ")}
              for i, w in enumerate(words)]
    chains = [{"id": 0, "mentions": [[0, 1], [4], [6, 7, 8, 9, 10]]}]
    out = _substitute(tokens, chains).lower()
    assert "leslie johnson est un pionnier" in out
    assert "pionnier du swamp blues est un pionnier" not in out


# ── Tests des règles SYNTAXIQUES sur phrases synthétiques (hors-ligne) ──
def _sent(rows):
    from jdm_agent.relext.udpipe import Token, Sentence
    toks = [Token(r[0], r[1], r[2], r[3], (r[6] if len(r) > 6 else {}), r[4], r[5])
            for r in rows]
    s = Sentence(tokens=toks)
    s.by_id = {t.id: t for t in toks}
    return s


def _syn_keys(sent):
    from jdm_agent.relext.syntactic import extract_from_sentences
    return {(r["source"], r["relation"], r["target"])
            for r in extract_from_sentences([sent])}


def test_copula_isa_positive():
    # « chat est un félin »
    s = _sent([(1, "chat", "chat", "NOUN", 3, "nsubj"),
               (2, "est", "être", "AUX", 3, "cop"),
               (3, "félin", "félin", "NOUN", 0, "root")])
    assert ("chat", "r_isa", "félin") in _syn_keys(s)


def test_copula_en_marge_negative():
    # « Lester était en marge » : « marge » porte un case → PAS de r_isa
    s = _sent([(1, "Lester", "Lester", "PROPN", 4, "nsubj"),
               (2, "était", "être", "AUX", 4, "cop"),
               (3, "en", "en", "ADP", 4, "case"),
               (4, "marge", "marge", "NOUN", 0, "root")])
    assert _syn_keys(s) == set()


def test_copula_pronoun_subject_negative():
    # « Il est un pionnier » : sujet pronom personnel → pas d'attache (sans coref)
    s = _sent([(1, "Il", "lui", "PRON", 4, "nsubj", {"PronType": "Prs"}),
               (2, "est", "être", "AUX", 4, "cop"),
               (3, "pionnier", "pionnier", "NOUN", 0, "root")])
    assert _syn_keys(s) == set()


def test_copula_anto_offline():
    # « couteau est l'inverse de cuillère » → r_anto (pas r_isa)
    s = _sent([(1, "couteau", "couteau", "NOUN", 5, "nsubj"),
               (2, "est", "être", "AUX", 5, "cop"),
               (3, "l'", "le", "DET", 5, "det"),
               (4, "de", "de", "ADP", 6, "case"),
               (5, "inverse", "inverse", "NOUN", 0, "root"),
               (6, "cuillère", "cuillère", "NOUN", 5, "nmod")])
    keys = _syn_keys(s)
    assert ("couteau", "r_anto", "cuillère") in keys
    assert not any(r == "r_isa" for _, r, _ in keys)


def test_instr_comitative_negative():
    # « vit avec sa sœur » : comitatif (pas d'objet + personne) → PAS de r_instr
    s = _sent([(1, "Lester", "Lester", "PROPN", 2, "nsubj"),
               (2, "vit", "vivre", "VERB", 0, "root"),
               (3, "avec", "avec", "ADP", 5, "case"),
               (4, "sa", "son", "DET", 5, "det"),
               (5, "sœur", "sœur", "NOUN", 2, "obl")])
    assert not any(r == "r_instr" for _, r, _ in _syn_keys(s))


def test_instr_transitive_positive():
    # « coupe le bois avec une scie » : objet + outil → r_instr
    s = _sent([(1, "menuisier", "menuisier", "NOUN", 2, "nsubj"),
               (2, "coupe", "couper", "VERB", 0, "root"),
               (3, "bois", "bois", "NOUN", 2, "obj"),
               (4, "avec", "avec", "ADP", 6, "case"),
               (5, "une", "un", "DET", 6, "det"),
               (6, "scie", "scie", "NOUN", 2, "obl")])
    assert ("couper", "r_instr", "scie") in _syn_keys(s)


def test_carac_reflexive_negative():
    # « se présente » : clitique réfléchi → PAS de r_carac vers « se »
    s = _sent([(1, "harmoniciste", "harmoniciste", "NOUN", 3, "nsubj"),
               (2, "se", "se", "PRON", 3, "expl:pass", {"PronType": "Prs"}),
               (3, "présente", "présenter", "VERB", 0, "root")])
    assert not any(r == "r_carac" for _, r, _ in _syn_keys(s))


def test_auteur_pronoun_negative():
    # « a été produit par lui » : agent pronom → PAS de r_has_auteur
    s = _sent([(1, "album", "album", "NOUN", 4, "nsubj:pass"),
               (2, "a", "avoir", "AUX", 4, "aux"),
               (3, "été", "être", "AUX", 4, "aux:pass"),
               (4, "produit", "produire", "VERB", 0, "root"),
               (5, "par", "par", "ADP", 6, "case"),
               (6, "lui", "lui", "PRON", 4, "obl:agent", {"PronType": "Prs"})])
    assert not any(r == "r_has_auteur" for _, r, _ in _syn_keys(s))


def test_own_indefinite_negative():
    # « possède tel instrument » : objet indéfini → PAS de r_own
    s = _sent([(1, "Lester", "Lester", "PROPN", 2, "nsubj"),
               (2, "possède", "posséder", "VERB", 0, "root"),
               (3, "tel", "tel", "ADJ", 4, "amod"),
               (4, "instrument", "instrument", "NOUN", 2, "obj")])
    assert not any(r == "r_own" for _, r, _ in _syn_keys(s))


def test_conj_verb_subject_inheritance():
    # « voiture qui roule et provoque un accident » : « provoque » (conj de
    # « roule ») hérite le sujet → r_has_conseq bien attaché au sujet réel.
    s = _sent([(1, "voiture", "voiture", "NOUN", 0, "root"),
               (2, "qui", "qui", "PRON", 3, "nsubj", {"PronType": "Rel"}),
               (3, "roule", "rouler", "VERB", 1, "acl:relcl"),
               (4, "et", "et", "CCONJ", 5, "cc"),
               (5, "provoque", "provoquer", "VERB", 3, "conj"),
               (6, "accident", "accident", "NOUN", 5, "obj")])
    assert ("voiture", "r_has_conseq", "accident") in _syn_keys(s)
