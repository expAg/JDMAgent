# -*- coding: utf-8 -*-
"""Jeu de test « gold » pour l'extracteur de relations sémantiques (texte Lazy Lester).

Ce que l'extracteur DEVRAIT produire (mappé sur des relations JeuxDeMots), et ce
qu'il ne doit PAS. Réseau requis (UDPipe + coref/JDM) → ce n'est PAS un test CI :
utiliser `eval_gold()` à la main (service coref lancé pour la partie « coref »).

Portée de chaque attendu :
  now   — atteignable par le modèle syntaxique v2 actuel.
  coref — nécessite la case « Résoudre les anaphores pronominales » (Il/ce/l').
  rule  — nécessite une NOUVELLE règle (lieu « déménage à/vit à », cause
          « décède de », instruments joués…).
  hard  — hors portée proche (reprises, dates, attributions d'auteur…).
"""

TEXT = (
    "Leslie Johnson, mieux connu sous le nom de Lazy Lester, est un musicien de "
    "blues américain qui chante, joue de l'harmonica et de la guitare. "
    "Il a été un pionnier du swamp blues et a également joué du blues de Louisiane. "
    "Leslie Johnson a commencé à jouer de la guitare vers l'âge de 11 ans. "
    "Au milieu des années 1950, Lester était en marge de la scène blues de Louisiane. "
    "Lester déménage finalement à Pontiac, Michigan. "
    "Lester vit alors à Paradise, en Californie. "
    "Lester décède d'un cancer le 22 août 2018."
)

# (source, relation, cible, portée)
GOLD = [
    ("leslie johnson", "r_syn", "lazy lester", "now"),
    ("leslie johnson", "r_isa", "musicien de blues", "now"),
    ("leslie johnson", "r_isa", "pionnier du swamp blues", "coref"),   # « Il »
    # NB : « joue de l'harmonica/la guitare » n'a PAS de relation JDM propre
    # (r_carac = attribut adjectival : liquide/blanche/acide — cf.
    # relation_definitions.md). On ne l'extrait donc pas.
    ("lester", "r_lieu", "louisiane", "hard"),   # « scène blues DE Louisiane » : nmod, pas prédiqué de Lester
    ("lester", "r_lieu", "pontiac", "rule"),                           # déménage à
    ("lester", "r_lieu", "paradise", "rule"),                          # vit à
    ("lester", "r_has_causatif", "cancer", "rule"),                    # décède de
]

# Faux positifs à NE JAMAIS produire.
MUST_NOT = [
    ("lester", "r_isa", "marge"),          # « était en marge » (prépositionnel)
    ("il", "r_isa", "pionnier"),           # sujet pronom non résolu
    ("lester", "r_own", "tel instrument"), # objet indéfini « tel ou tel »
    ("vivre", "r_instr", "sœur"),          # comitatif « vit avec sa sœur »
    ("vivre", "r_instr", "petite amie"),   # comitatif
]


def eval_gold(resolve_anaphora: bool = False,
              coref_url: str = "http://127.0.0.1:8901/api/coref") -> None:
    """Compare la sortie de l'extracteur au gold. Réseau requis."""
    from jdm_agent.relext import extract_best
    out = extract_best(TEXT, resolve_anaphora=resolve_anaphora, coref_url=coref_url)
    got = {(t["source"], t["relation"], t["target"]) for t in out["triplets"]}

    scopes = {"now"} | ({"coref"} if resolve_anaphora else set())
    target = {(s, r, o) for s, r, o, sc in GOLD if sc in scopes}
    tp = got & target
    missed = target - got
    forbidden = got & set(MUST_NOT)

    print(f"mode: {out['mode']}")
    print(f"trouvés: {len(got)}")
    print(f"rappel (portée {sorted(scopes)}): {len(tp)}/{len(target)}")
    for m in sorted(missed):
        print("  MANQUÉ:", m)
    print("faux positifs interdits:", sorted(forbidden) or "aucun")
    print("\n--- tous les triplets produits ---")
    for t in out["triplets"]:
        print(f"  {t['source']} | {t['relation']} | {t['target']}  ({t['category']})")


# ── Jeu de test « couverture » : texte VARIÉ, ≥1 exemple par relation (portée now) ──
# Vocabulaire volontairement diversifié (animaux, objets, aliments, lieux, arts…)
# pour ne pas surajuster l'extracteur à un champ lexical. Chaque phrase illustre
# une relation JeuxDeMots exprimable par la syntaxe (UDPipe → dépendances).
TEXT_MULTI = (
    "Le rouge-gorge est un oiseau. "                              # r_isa (copule)
    "Le puma, connu sous le nom de couguar, est un félin. "       # r_syn + r_isa
    "La bicyclette est composée de deux roues. "                  # r_has_part
    "Le clavier fait partie de l'ordinateur. "                    # r_holo
    "Le jour est le contraire de la nuit. "                       # r_anto
    "Le congre ressemble à une anguille. "                        # r_similar
    "Le désert se caractérise par une chaleur intense. "         # r_carac
    "Le tabac provoque le cancer. "                               # r_has_conseq
    "Le lion vit dans la savane. "                                # r_lieu
    "La table est fabriquée en bois. "                            # r_object>mater
    "La tomate est rouge. "                                       # r_has_color
    "Le roi possède un château. "                                 # r_own
    "La plante nécessite de l'eau. "                              # r_require
    "Le koala mange des feuilles. "                               # r_can_eat
    "Ce roman a été écrit par Hugo. "                             # r_has_auteur
    "Le menuisier coupe le bois avec une scie. "                  # r_instr
    "L'abeille fabrique du miel. "                                # r_make (partitif)
    "Le moteur utilise de l'essence. "                            # r_make_use_of
    "Le vaccin protège contre la maladie. "                       # r_against
    "Le couteau sert à couper. "                                  # r_telic_role
    "La fête se déroule en hiver. "                               # r_time
    "Le cassoulet est originaire de Toulouse. "                   # r_lieu>origine
    "Le patient décède d'un cancer."                              # r_has_causatif
)
GOLD_MULTI = [
    ("rouge-gorge", "r_isa", "oiseau"),
    ("puma", "r_syn", "couguar"),
    ("puma", "r_isa", "félin"),
    ("bicyclette", "r_has_part", "deux roues"),
    ("clavier", "r_holo", "ordinateur"),
    ("jour", "r_anto", "nuit"),
    ("congre", "r_similar", "anguille"),
    ("désert", "r_carac", "chaleur intense"),
    ("tabac", "r_has_conseq", "cancer"),
    ("lion", "r_lieu", "savane"),
    ("table", "r_object>mater", "bois"),
    ("tomate", "r_has_color", "rouge"),
    ("roi", "r_own", "château"),
    ("plante", "r_require", "eau"),
    ("koala", "r_can_eat", "feuilles"),
    ("roman", "r_has_auteur", "hugo"),
    ("couper", "r_instr", "scie"),
    ("abeille", "r_make", "miel"),
    ("moteur", "r_make_use_of", "essence"),
    ("vaccin", "r_against", "maladie"),
    ("couteau", "r_telic_role", "couper"),
    ("fête", "r_time", "hiver"),
    ("cassoulet", "r_lieu>origine", "toulouse"),
    ("patient", "r_has_causatif", "cancer"),
]

# Relations prédicatives génériques (source = verbe) TOUJOURS émises en plus des
# relations sémantiques ci-dessus : ce sont des bonus, pas des manques.
_PREDICATIVE = {"r_agent", "r_patient"}


def eval_multi() -> None:
    from jdm_agent.relext.syntactic import extract_syntactic
    got = {(t["source"], t["relation"], t["target"]) for t in extract_syntactic(TEXT_MULTI)}
    gold = set(GOLD_MULTI)
    rels = {r for _, r, _ in gold}
    print(f"couverture triplets: {len(got & gold)}/{len(gold)}")
    print(f"couverture relations distinctes: {len({r for _, r, _ in (got & gold)})}/{len(rels)}")
    for m in sorted(gold - got):
        print("  MANQUÉ:", m)
    extra = {e for e in (got - gold) if e[1] not in _PREDICATIVE}
    if extra:
        print("en plus (hors prédicatif agent/patient, à vérifier):")
        for e in sorted(extra):
            print("  +", e)


if __name__ == "__main__":
    import sys
    if "--multi" in sys.argv:
        eval_multi()
    else:
        eval_gold(resolve_anaphora=("--coref" in sys.argv))
