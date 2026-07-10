"""J3 — ASR : propagation d'activation sur un graphe de travail JDM (thèse §4.1.4.1).

On construit un petit graphe à partir de termes du contexte (et de candidats),
on y ajoute les relations JDM (poids signés ; les paires sans relation s'inhibent
légèrement, -epsilon), puis on propage un signal d'activation par seuil/décharge
(analogue à un réseau de neurones formel). Le niveau d'activation moyen d'un nœud
mesure sa compatibilité avec le contexte → utile pour désambiguïser un sens ou
départager des antécédents sémantiquement.

Implémentation fidèle au pseudo-code de la thèse (activation / propagation
itérée, évaporation par seuil, inhibition par relations négatives).
"""
from .jdm_client import relations

REL_TYPES = ["r_isa", "r_agent", "r_patient", "r_carac",
             "r_telic_role", "r_lieu", "r_cohypo"]
EPS = 0.02            # inhibition légère entre nœuds non reliés
THRESHOLD = 0.5      # seuil de décharge
ROUNDS = 5


def _edge(a, b, _cache={}):
    """Évidence JDM signée a→b (relation la plus forte en valeur absolue), normalisée."""
    if (a, b) in _cache:
        return _cache[(a, b)]
    best = 0
    for rt in REL_TYPES:
        for name, w in relations(a, rt):
            if name.lower() == b.lower() and abs(w) > abs(best):
                best = w
    _cache[(a, b)] = best / 1000.0
    return _cache[(a, b)]


def activate(seeds, candidates=(), rounds=ROUNDS):
    """Propage l'activation depuis `seeds` ; renvoie l'activation moyenne par nœud."""
    nodes = list(dict.fromkeys(list(seeds) + list(candidates)))
    edges = {n: {} for n in nodes}
    for a in nodes:
        for b in nodes:
            if a == b:
                continue
            w = _edge(a, b)
            edges[a][b] = w if w != 0 else -EPS

    act = {n: (1.0 if n in seeds else 0.0) for n in nodes}
    hist = {n: [] for n in nodes}
    for _ in range(rounds):
        new = {n: 0.0 for n in nodes}
        for n in nodes:
            if act[n] > THRESHOLD:
                for v, w in edges[n].items():
                    new[v] += act[n] * w
        for n in nodes:
            hist[n].append(act[n])
            base = 0.0 if act[n] > THRESHOLD else act[n]
            act[n] = base + new[n]
    return {n: sum(hist[n]) / len(hist[n]) for n in nodes}


def context_compat(candidate, context_terms, rounds=ROUNDS):
    """Score de compatibilité sémantique d'un candidat avec un contexte (≥0 meilleur)."""
    scores = activate(seeds=list(context_terms), candidates=[candidate], rounds=rounds)
    return scores.get(candidate, 0.0)
