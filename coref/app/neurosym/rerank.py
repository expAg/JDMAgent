"""J1+IV — Re-clustering neuro-symbolique des sorties de CorPipe.

Principe « RÉPARATION SUR VIOLATION » (do-no-harm) :
  • On garde le clustering de CorPipe par défaut (il est bon, y compris pour les
    pronoms nominaux comme « la marée … elle »).
  • On ne DÉTACHE et re-résout QUE les pronoms en *violation* dans leur cluster :
      (a) co-argument dur (règle co-Arg) avec un co-membre antérieur, ou
      (b) désaccord en genre/nombre avec un co-membre antérieur.
  • Les pronoms détachés sont re-résolus par saillance + JDM (souple), sous veto
    co-Arg et accord. Sinon → nouvelle entité (exophore/cataphore).

Le genre/nombre est récupéré du DÉTERMINANT quand le nom ne le porte pas (UDPipe
laisse souvent `Gender` vide sur les noms communs).
"""
from .coargs import cannot_link_pairs
from .salience import salience, agree
from . import centering


def _node_index(doc):
    return {id(n): i for i, n in enumerate(
        n for tree in doc.trees for n in tree.descendants)}


def _sentences(doc):
    s = {}
    for si, tree in enumerate(doc.trees):
        for n in tree.descendants:
            s[id(n)] = si
    return s


def _head(words):
    wid = {id(w) for w in words}
    for w in words:
        if w.parent is None or id(w.parent) not in wid:
            return w
    return words[0]


def _gn(words, head):
    """Genre/nombre de la mention : tête sinon déterminant/modifieur accordé."""
    g = head.feats.get("Gender") or None
    n = head.feats.get("Number") or None
    for w in words:                       # le/la/les, adjectifs… portent l'accord
        if g and n:
            break
        if w is head:
            continue
        g = g or (w.feats.get("Gender") or None)
        n = n or (w.feats.get("Number") or None)
    return g, n


def _collect_mentions(doc, order, sents):
    mentions = []
    for ent in getattr(doc, "coref_entities", []):
        for mu in ent.mentions:
            words = list(mu.words)
            if not words:
                continue
            h = _head(words)
            is_poss = h.upos == "DET" and h.feats.get("Poss") == "Yes"
            g, n = _gn(words, h)
            if is_poss:                    # possessif : accorde avec le possédé,
                g, n = None, None          # pas avec l'antécédent -> neutre
            mentions.append({
                "orig": ent.eid, "etype": ent.etype or "",
                "words": words, "wids": {id(w) for w in words}, "head": h,
                "gender": g, "number": n,
                "pos": min(order[id(w)] for w in words),
                "sent": sents[id(h)],
                "is_pron": h.upos == "PRON" or is_poss,
                "tokens": sorted(order[id(w)] for w in words),
            })
    mentions.sort(key=lambda m: m["pos"])
    return mentions


def resolve_coarg_only(doc):
    """Version ULTRA-CONSERVATRICE : on garde le clustering de CorPipe à l'identique,
    et on retire seulement les mentions qui violent la contrainte dure des
    co-arguments dans leur propre cluster (cas structurellement impossibles, rares).
    Aucune saillance, aucun centrage, aucun JDM. Risque borné aux cas en violation.

    Renvoie une liste de chaînes (>= 2 mentions) au même format que resolve_chains.
    """
    order, sents = _node_index(doc), _sentences(doc)
    pairs, _ = cannot_link_pairs(doc)
    mentions = _collect_mentions(doc, order, sents)

    by_orig = {}
    for mi, m in enumerate(mentions):
        by_orig.setdefault(m["orig"], []).append(mi)

    kept_clusters = []
    for orig, mem in by_orig.items():
        keep, kept_wids = [], set()
        for mi in mem:                                   # ordre du texte
            conflict = any(frozenset((w, x)) in pairs
                           for w in mentions[mi]["wids"] for x in kept_wids)
            if conflict:
                continue                                 # mention retirée (split-off)
            keep.append(mi)
            kept_wids |= mentions[mi]["wids"]
        kept_clusters.append(keep)

    chains = []
    for keep in kept_clusters:
        if len(keep) < 2:
            continue
        keep = sorted(keep, key=lambda i: mentions[i]["pos"])
        first = mentions[keep[0]]
        chains.append({"id": 0, "cat": first["etype"],
                       "label": " ".join(w.form for w in first["words"]),
                       "mentions": [mentions[i]["tokens"] for i in keep]})
    chains.sort(key=lambda c: c["mentions"][0][0])
    for i, c in enumerate(chains):
        c["id"] = i
    return chains


def resolve_chains(doc, jdm_scorer=None, use_centering=True):
    order, sents = _node_index(doc), _sentences(doc)
    pairs, _ = cannot_link_pairs(doc)
    mentions = _collect_mentions(doc, order, sents)

    # --- 1) Ancres = mentions NOMINALES (NOM/NOM propre) : on fait confiance à
    #         CorPipe pour la coréférence nominale (lexicale).
    entities, ent_of = [], {}
    for mi, m in enumerate(mentions):
        if m["is_pron"]:
            continue
        ei = ent_of.get(m["orig"])
        if ei is None:
            ei = len(entities)
            ent_of[m["orig"]] = ei
            entities.append({"members": [], "wids": set(), "orig": m["orig"]})
        entities[ei]["members"].append(mi)
        entities[ei]["wids"] |= m["wids"]

    corrections = []

    def vetoed(mi, ent):
        return any(frozenset((wid, nid)) in pairs
                   for wid in mentions[mi]["wids"] for nid in ent["wids"])

    # --- 2) Compétition : re-résoudre CHAQUE pronom (ordre du texte) par
    #         saillance + JDM, sous veto co-Arg et accord. La saillance de sujet
    #         corrige les inversions (swaps) que CorPipe commet ; l'accord (genre/
    #         nombre, récupéré du déterminant) protège les bonnes décisions.
    for mi, m in enumerate(mentions):
        if not m["is_pron"]:
            continue
        cf_prev = centering.cf_list(entities, mentions, m["sent"] - 1)
        best, best_ei = 0.0, None
        for ei, ent in enumerate(entities):
            prev = [mentions[j] for j in ent["members"] if mentions[j]["pos"] < m["pos"]]
            if not prev or vetoed(mi, ent):
                continue
            sc = salience(m, prev, is_corpipe_origin=(ent["orig"] == m["orig"]))
            if sc is None:
                continue
            if use_centering:
                sc += centering.transition_bonus(ei, cf_prev)    # cohérence discursive
            if jdm_scorer is not None:
                extra = jdm_scorer(m, max(prev, key=lambda x: x["pos"]), doc)
                if extra:
                    sc += extra
            if sc > best:
                best, best_ei = sc, ei
        if best_ei is None:                       # exophore/cataphore/nouvelle entité
            best_ei = len(entities)
            entities.append({"members": [], "wids": set(), "orig": m["orig"]})
        elif entities[best_ei]["orig"] != m["orig"]:
            cand = max((mentions[j] for j in entities[best_ei]["members"]
                        if mentions[j]["pos"] < m["pos"]), key=lambda x: x["pos"])
            corrections.append({
                "pronoun": m["head"].form, "corpipe": m["orig"],
                "reattached_to": " ".join(w.form for w in cand["words"]),
            })
        entities[best_ei]["members"].append(mi)
        entities[best_ei]["wids"] |= m["wids"]

    # --- 4) Chaînes (>= 2 mentions) ---
    chains = []
    for ent in entities:
        if len(ent["members"]) < 2:
            continue
        ms = sorted(ent["members"], key=lambda i: mentions[i]["pos"])
        first = mentions[ms[0]]
        chains.append({
            "id": 0, "cat": first["etype"],
            "label": " ".join(w.form for w in first["words"]),
            "mentions": [mentions[i]["tokens"] for i in ms],
        })
    chains.sort(key=lambda c: c["mentions"][0][0])
    for i, c in enumerate(chains):
        c["id"] = i
    return chains, corrections
