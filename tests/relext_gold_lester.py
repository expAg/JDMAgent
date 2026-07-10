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
    ("leslie johnson", "r_carac", "harmonica", "hard"),                # joue de
    ("leslie johnson", "r_carac", "guitare", "hard"),
    ("lester", "r_lieu", "louisiane", "hard"),   # « scène blues DE Louisiane » : nmod, pas prédiqué de Lester
    ("lester", "r_lieu", "pontiac", "rule"),                           # déménage à
    ("lester", "r_lieu", "paradise", "rule"),                          # vit à
    ("lester", "r_has_causatif", "cancer", "rule"),                    # décède de
]

# Faux positifs à NE JAMAIS produire.
MUST_NOT = [
    ("lester", "r_isa", "marge"),          # « était en marge » (prépositionnel)
    ("il", "r_isa", "pionnier"),           # sujet pronom non résolu
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


if __name__ == "__main__":
    import sys
    eval_gold(resolve_anaphora=("--coref" in sys.argv))
