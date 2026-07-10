"""Cohérence discursive — Théorie du Centrage (Grosz, Joshi & Weinstein).

Chaque énoncé Uᵢ a une liste de centres prospectifs Cf (entités réalisées, classées
par saillance grammaticale : sujet > objet > objet indirect > autres). Le centre
préféré Cp = tête de Cf. Le centre rétrospectif Cb = l'élément le mieux classé de
Cf(Uᵢ₋₁) réalisé dans Uᵢ. Les transitions (Continue > Retain > Smooth-Shift >
Rough-Shift) mesurent la cohérence.

Usage POST-HOC (étape A/B de l'inclusion au modèle) : en résolvant un pronom de
Uᵢ, on bonifie le candidat qui prolonge le centre de Uᵢ₋₁ (préférence Continue) —
ce que la saillance locale ne capte pas entre phrases. Les indices Cb/Cp/transition
sont aussi exportés comme features (centering.pair_features) pour l'apprentissage.
"""
ROLE_RANK = {"nsubj": 0, "nsubj:pass": 0, "csubj": 0,
             "obj": 1, "iobj": 2, "obl:arg": 2}
OTHER = 3


def cf_list(entities, mentions, sent):
    """Cf(sent) : [(entity_index, meilleur_rang)] trié par saillance (rang croissant)."""
    items = []
    for ei, ent in enumerate(entities):
        best = None
        for mi in ent["members"]:
            m = mentions[mi]
            if m["sent"] == sent:
                r = ROLE_RANK.get(m["head"].udeprel, OTHER)
                best = r if best is None else min(best, r)
        if best is not None:
            items.append((ei, best))
    items.sort(key=lambda x: x[1])
    return items


def transition_bonus(ei, cf_prev, w=1.0):
    """Bonus de continuité : l'entité `ei` prolonge-t-elle un centre de Uᵢ₋₁ ?"""
    for pos, (e, _rank) in enumerate(cf_prev):
        if e == ei:
            return w if pos == 0 else w * 0.4      # Cp (sujet précédent) > autres Cf
    return 0.0


def transitions(entities, mentions, n_sents):
    """Étiquette de transition de centrage par énoncé (pour features/explicabilité)."""
    labels, prev_cb = [], None
    for s in range(n_sents):
        cf_prev = cf_list(entities, mentions, s - 1) if s > 0 else []
        cf_cur = cf_list(entities, mentions, s)
        cp = cf_cur[0][0] if cf_cur else None
        cur_set = {e for e, _ in cf_cur}
        cb = next((e for e, _ in cf_prev if e in cur_set), None)
        if cb is None:
            lab = "none"
        elif prev_cb is not None and cb == prev_cb:
            lab = "continue" if cb == cp else "retain"
        else:
            lab = "smooth-shift" if cb == cp else "rough-shift"
        labels.append(lab)
        prev_cb = cb
    return labels


def pair_features(p, cand_entity_index, entities, mentions):
    """Features de centrage pour la paire (pronom p, entité candidate)."""
    cf_prev = cf_list(entities, mentions, p["sent"] - 1)
    rank = next((pos for pos, (e, _) in enumerate(cf_prev)
                 if e == cand_entity_index), None)
    return {
        "cand_is_prev_Cp": float(rank == 0),
        "cand_in_prev_Cf": float(rank is not None),
        "cand_prev_Cf_rank": float(rank if rank is not None else 9),
    }
