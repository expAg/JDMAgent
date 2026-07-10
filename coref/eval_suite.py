"""J0 — Harnais d'évaluation / régression de la couche neuro-symbolique.

Chaque cas : un texte + des assertions « telle mention doit / ne doit pas
co-référer avec telle autre ». On repère les mentions par (surface, n-ième
occurrence). Permet l'ablation (avec/sans couche) et garde contre les régressions.
"""
import warnings; warnings.filterwarnings("ignore")
import sys
from app.coref import resolve

# (texte, [ (surfaceA, occA, surfaceB, occB, doivent_coreferer) ... ])
CASES = [
    ("John a appelé son frère parce qu'il voulait lui rendre ses clés. "
     "Il les avait oubliées chez lui hier soir. Il avait peur qu'il les ait mangées", [
        ("il", 1, "John", 1, True),     # il (sujet de rendre) = John
        ("lui", 1, "John", 1, False),   # lui (COI de rendre) != John  -> frère
        ("lui", 1, "frère", 1, True),
     ]),
    ("Pierre déteste Paul. En réalité il le méprise depuis longtemps", [
        ("il", 1, "Pierre", 1, True),
        ("le", 1, "Paul", 1, True),
        ("il", 1, "Paul", 1, False),
     ]),
    ("Le chat a vu la souris et il l'a mangée", [
        ("il", 1, "chat", 1, True),
        ("l'", 1, "souris", 1, True),
     ]),
    ("Marie a vu les clés et elle les a prises", [
        ("elle", 1, "Marie", 1, True),
        ("les", 2, "clés", 1, True),    # 2e "les" = pronom objet = les clés
     ]),
    # J2 : sélection JDM (agent de "butiner" = abeille, pas fleur)
    ("L'abeille s'est posée sur la fleur, puis elle a butiné tout le champ", [
        ("elle", 1, "abeille", 1, True),
     ]),
    # Accord en genre (récupéré du déterminant) : elle = la marée (fém), pas le poisson (masc)
    ("Le poisson a mangé l'asticot, ils étaient ensemble dans la marée sale, "
     "elle est verte et il est délicieux", [
        ("elle", 1, "marée", 1, True),
        ("elle", 1, "poisson", 1, False),
     ]),
    # Cohérence discursive (centrage) : Il prolonge le centre sujet (Pierre) de la phrase précédente
    ("Pierre a rencontré Marc au bureau. Il l'a salué chaleureusement", [
        ("Il", 1, "Pierre", 1, True),
        ("l'", 1, "Marc", 1, True),
        ("Il", 1, "Marc", 1, False),
     ]),
]


def _tok_index(tokens, surface, occ):
    n = 0
    for t in tokens:
        if t["text"].lower() == surface.lower():
            n += 1
            if n == occ:
                return t["i"]
    return None


def _chain_of(chains, i):
    for c in chains:
        if any(i in m for m in c["mentions"]):
            return c["id"]
    return None


def run():
    total = passed = 0
    for text, asserts in CASES:
        r = resolve(text)
        print("=" * 72)
        print(text)
        for c in r["chains"]:
            toks = [" ".join(r["tokens"][i]["text"] for i in m) for m in c["mentions"]]
            print(f"   chaîne {c['id']}: {toks}")
        for sa, oa, sb, ob, expect in asserts:
            ia, ib = _tok_index(r["tokens"], sa, oa), _tok_index(r["tokens"], sb, ob)
            ca, cb = _chain_of(r["chains"], ia), _chain_of(r["chains"], ib)
            ok = (ca is not None and ca == cb) == expect
            total += 1; passed += ok
            rel = "≡" if expect else "≢"
            print(f"   [{'OK ' if ok else 'XX '}] {sa}#{oa} {rel} {sb}#{ob}  "
                  f"(chaînes {ca} vs {cb})")
    print("=" * 72)
    print(f"RÉSULTAT : {passed}/{total} assertions vérifiées")
    return passed == total


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
