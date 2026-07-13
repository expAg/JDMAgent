# -*- coding: utf-8 -*-
"""Désambiguïsation lexicale (WSD) par raffinements sémantiques JeuxDeMots (v1).

Un mot polysémique a plusieurs SENS en JDM (`r_raff_sem` : « avocat>fruit »,
« avocat>juriste »…). On choisit le sens le mieux associé au CONTEXTE (les autres
mots de contenu du texte), à la manière de Lesk mais sur le graphe JDM.

Score d'un sens = association du sens au contexte, mesurée dans LES DEUX SENS du
graphe (le voisinage du nœud raffiné étant souvent creux) :
  - voisinage sortant du nœud de sens  → contient-il le mot de contexte ?
  - voisinage (riche) du mot de contexte → contient-il un LABEL DISCRIMINANT du
    sens (« juriste », « fruit »… = les composantes du chemin de raffinement) ?

Limite v1 : désambiguïsation par TYPE de mot (un sens par forme sur tout le
texte), pas par occurrence — la vraie WSD par position viendra avec UDPipe.
"""
from __future__ import annotations

from jdm_agent.thematic import _content_words


def _neigh(client, name: str, limit: int = 120) -> dict:
    """Voisinage sortant d'un nœud : {nom_voisin_minuscule: poids max}."""
    res = client.relations_from(name, limit=limit)
    idx = res.node_index()
    d: dict = {}
    for r in res.relations:
        n = idx.get(r.node2)
        if n is not None and r.w > 0:
            k = n.name.strip().lower()
            if k:
                d[k] = max(d.get(k, 0.0), r.w)
    return d


def _discriminants(sense) -> list:
    """Labels qui distinguent le sens (composantes du chemin, hors POS « Nom: »)."""
    parts = sense.path[1:] if getattr(sense, "path", None) else []
    return [p.strip().lower() for p in parts if p and not p.rstrip().endswith(":")]


def disambiguate(text: str, client, *, max_words: int = 60, max_senses: int = 6,
                 neigh_limit: int = 120) -> dict:
    """Texte → sens choisi pour chaque mot AMBIGU. Réseau requis (JDM).

    Renvoie `{words:[{word, chosen, senses, confident}], analyzed}` où `chosen`
    et chaque élément de `senses` = `{sense, name, consensus, score}`.
    """
    words = _content_words(text)[:max_words]
    # Voisinages des mots de contexte : calculés UNE fois, réutilisés pour tous.
    ctx_neigh = {w: _neigh(client, w, neigh_limit) for w in words}

    out = []
    for w in words:
        senses = client.refinements_decoded(w)
        if len(senses) < 2:
            continue  # mot non ambigu
        senses = sorted(senses, key=lambda s: -s.weight)[:max_senses]
        others = [cw for cw in words if cw != w]

        scored = []
        for s in senses:
            sng = _neigh(client, s.name, neigh_limit)
            discs = _discriminants(s)
            sc = 0.0
            for cw in others:
                best = sng.get(cw, 0.0)
                cwn = ctx_neigh.get(cw, {})
                for d in discs:
                    val = cwn.get(d, 0.0)
                    if val > best:
                        best = val
                sc += best
            scored.append({"sense": s.decoded, "name": s.name,
                           "consensus": round(s.weight, 1), "score": round(sc, 1)})
        scored.sort(key=lambda x: -x["score"])

        best = scored[0]
        second = scored[1]["score"] if len(scored) > 1 else 0.0
        out.append({
            "word": w,
            "chosen": best,
            "senses": scored,
            # confiant si un sens ressort nettement (contexte discriminant trouvé).
            "confident": best["score"] > 0 and best["score"] >= 1.5 * second,
        })

    return {"words": out, "analyzed": len(words)}
