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
        assert p["rx"] is not None


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
