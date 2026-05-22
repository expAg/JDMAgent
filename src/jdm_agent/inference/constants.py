"""Constantes du moteur d'inférence JDM (Phase 11).

Cartes dérivées de `relation_definitions.md` et du moteur PHP `infer_answer`.
Aucune dépendance runtime au markdown — littéraux testables hors-ligne.
"""
from __future__ import annotations

# --- Relations inverses -----------------------------------------------------

#: Couples (relation, inverse). On construit la carte bidirectionnelle ensuite.
_INVERSE_PAIRS: list[tuple[str, str]] = [
    ("r_isa", "r_hypo"),
    ("r_has_part", "r_holo"),
    ("r_carac", "r_carac-1"),
    ("r_agent", "r_agent-1"),
    ("r_patient", "r_patient-1"),
    ("r_instr", "r_instr-1"),
    ("r_lieu", "r_lieu-1"),
    ("r_domain", "r_domain-1"),
    ("r_has_prop", "r_has_prop-1"),
    ("r_promote", "r_promote-1"),
    ("r_against", "r_against-1"),
    ("r_but", "r_but-1"),
    ("r_sentiment", "r_sentiment-1"),
    ("r_can_eat", "r_can_eat-1"),
    ("r_make_use_of", "r_make_use_of-1"),
    ("r_own", "r_own-1"),
    ("r_object>mater", "r_mater>object"),
    ("r_set>item", "r_item>set"),
    ("r_processus>agent", "r_processus>agent-1"),
    ("r_processus>patient", "r_processus>patient-1"),
    ("r_processus>instr", "r_processus>instr-1"),
]

#: Relations symétriques : leur inverse est elles-mêmes.
_SYMMETRIC: tuple[str, ...] = ("r_syn", "r_anto", "r_associated", "r_similar")

#: Carte bidirectionnelle nom de relation → nom de la relation inverse.
INVERSE_RELATIONS: dict[str, str] = {}
for _a, _b in _INVERSE_PAIRS:
    INVERSE_RELATIONS[_a] = _b
    INVERSE_RELATIONS[_b] = _a
for _s in _SYMMETRIC:
    INVERSE_RELATIONS[_s] = _s


# --- Relations transitives --------------------------------------------------

#: Relations où A R X ∧ X R B ⟹ A R B.
TRANSITIVE_RELATIONS: frozenset[str] = frozenset({
    "r_isa", "r_hypo", "r_has_part", "r_holo",
    "r_lieu", "r_lieu-1", "r_has_conseq", "r_syn",
})


# --- Implication ------------------------------------------------------------

#: La relation demandée (clé) est IMPLIQUÉE si l'une des relations de la
#: liste tient entre les mêmes termes (R' plus spécifique ⟹ R).
IMPLICATION_MAP: dict[str, list[str]] = {
    "r_lieu-1": ["r_has_part"],
    "r_lieu": ["r_holo"],
    "r_interact_with": ["r_can_eat", "r_against", "r_promote", "r_make_use_of"],
    "r_has_conseq": ["r_sentiment"],
}


# --- Composition (effort 2) -------------------------------------------------

#: R demandée ⟸ il existe C tel que `A R2 C` ∧ `C R3 B`. Cartes (R2, R3).
COMPOSITION_MAP: dict[str, list[tuple[str, str]]] = {
    "r_lieu": [("r_holo", "r_lieu")],
    "r_agent-1": [("r_make_use_of", "r_instr-1"), ("r_has_part", "r_instr-1")],
    "r_interact_with": [("r_agent-1", "r_patient"), ("r_instr-1", "r_patient")],
}


# --- Génériques & classes ---------------------------------------------------

#: Relations « génériques » : du terme vers ses sur-ensembles (déduction-ISA).
GENERIC_RELATIONS: tuple[str, ...] = ("r_isa", "r_syn")

#: Grandes classes pour le schéma d'élimination par classe.
ELIMINATION_CLASSES: tuple[str, ...] = (
    "être vivant", "être humain", "animal", "plante", "végétal",
    "objet", "artéfact", "substance", "matière",
    "oiseau", "poisson", "insecte", "mammifère", "reptile",
    "arbre", "personne", "aliment", "véhicule", "lieu",
)


# --- Calibration & défauts --------------------------------------------------

#: Facteur d'échelle pour normaliser la confiance via `tanh(|w| / W)`.
#: Pas un seuil de filtrage — un facteur d'échelle.
STRONG_SUPPORT_W: float = 100.0

DEFAULT_MAX_DEPTH: int = 2
DEFAULT_TOP_K: int = 8

#: Budget d'appels HTTP par inférence, selon l'effort. Généreux mais borné :
#: tous les appels passent par le cache disque de JDMClient — la 1re inférence
#: sur un terme froid prend quelques secondes, les suivantes sont instantanées.
BUDGET_BY_EFFORT: dict[int, int] = {1: 70, 2: 150}

#: Nb d'hyperonymes scrutés par les schémas de réfutation (isa_incompatible,
#: class_elim). Le vrai générique peut être noyé loin dans le bruit JDM
#: (baleine → mammifère vers le rang 25).
REFUTATION_SCAN: int = 25
