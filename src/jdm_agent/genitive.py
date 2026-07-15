# -*- coding: utf-8 -*-
"""GRASP-IT — prédiction de la relation d'un génitif « A de B » à partir de
features SYMBOLIQUES JeuxDeMots (INFO-SEM r_infopot, hyperonymes r_isa, relations
prédicatives sortantes, et relation DIRECTE A↔B).

SERVING SANS DÉPENDANCE : le modèle (régression logistique) est exporté en JSON
portable (models/grasp_it.json) par scripts/gen_build_model.py, et la prédiction
est réimplémentée en Python pur (pas de scikit-learn / joblib / numpy à installer
sur le serveur). scikit-learn ne sert qu'à l'entraînement hors-ligne.
"""
from __future__ import annotations

import json
import math
import os
import re

_CONN = re.compile(r"(?<= )(de la |de l'|de l’|du |des |de |d'|d’)")

# Relations sortantes typées informatives (id → étiquette).
_TYPE_TAGS = {70: "procag", 76: "procpa", 24: "ag1", 26: "pa1", 28: "lieu1",
              30: "lieuact", 122: "own1", 171: "origin", 50: "mater", 10: "holo",
              9: "haspart", 100: "auteur", 37: "telic", 3: "domain"}

# Étiquettes lisibles des signaux de type (pour l'explication).
_OUT_LABEL = {"procag": "action (agent d'un processus)", "procpa": "action (objet d'un processus)",
              "ag1": "peut agir", "pa1": "peut subir", "lieu1": "lieu (contient des choses)",
              "lieuact": "lieu (d'actions)", "own1": "possédé par", "origin": "a une origine",
              "mater": "matière", "holo": "a des parties", "haspart": "a des parties",
              "auteur": "a un auteur", "telic": "a une fonction", "domain": "a un domaine"}

# Relations JDM NON discriminantes / bruit → écartées des features et de l'évidence.
_SKIP_REL = {"r_associated", "r_aki", "r_wiki", "r_raff_sem", "r_raff_morpho",
             "r_raff_sem-1", "r_pos", "r_lemma", "r_meaning/glose", "r_data",
             "r_pos_seq", "r_annotation", "r_annotation_context", "r_annotation_exception"}

# Couche de LOOKUP direct : relation JDM A↔B → classe génitive. Quand JDM contient
# déjà la relation entre A et B, on la remonte directement (plus fiable que le
# modèle pour les paires connues). Direction-agnostique.
_REL2CLASS = {
    "r_processus>agent": "r_agent", "r_agent": "r_agent", "r_agent-1": "r_agent",
    "r_processus>patient": "r_patient", "r_patient": "r_patient", "r_patient-1": "r_patient",
    "r_object>mater": "r_composition", "r_mater>object": "r_composition",
    "r_holo": "r_holonymie", "r_has_part": "r_holonymie",
    "r_lieu": "r_lieu", "r_lieu-1": "r_lieu",
    "r_lieu>origine": "r_origine",   # r_product_of : arbitré à part (origine vs auteur selon B)
    "r_own": "r_possession", "r_own-1": "r_possession",
    "r_has_auteur": "r_auteur", "r_has_auteur-1": "r_auteur",
    "r_carac": "r_caractérisation", "r_carac-1": "r_caractérisation",
    "r_has_topic": "r_topique", "r_domain": "r_topique", "r_domain-1": "r_topique",
    "r_quantificateur": "r_quantification", "r_quantificateur-1": "r_quantification",
    "r_has_causatif": "r_causalité", "r_has_conseq": "r_causalité",
    "r_depict": "r_dépiction",
    "r_has_social_tie_with": "r_relationnel", "r_family": "r_relationnel",
    "r_instr": "r_instrument", "r_instr-1": "r_instrument",
    "r_telic_role": "r_instrument", "r_processus>instr": "r_instrument",
}

# Formulation en langage naturel : « A <prédicat> B ».
_NL = {
    "r_agent": "{a} a pour agent {b}",
    "r_auteur": "{a} a pour auteur {b}",
    "r_caractérisation": "{a} est une caractéristique de {b}",
    "r_causalité": "{a} est causé par {b}",
    "r_composition": "{a} a pour matière (est composé de) {b}",
    "r_dépiction": "{a} représente {b}",
    "r_holonymie": "{a} est une partie de {b}",
    "r_instrument": "{a} est un instrument pour {b}",
    "r_lieu": "{a} est situé dans {b}",
    "r_origine": "{a} provient de {b}",
    "r_patient": "{a} porte sur (a pour patient) {b}",
    "r_possession": "{a} appartient à {b}",
    "r_quantification": "{a} est une quantité de {b}",
    "r_relationnel": "{a} est lié à {b} (parenté / relation sociale)",
    "r_topique": "{a} a pour thème {b}",
}


# Classe génitive interne → relation JDM (affichage), d'après la typologie de
# référence : Guenoune & Lafourcade, « Extraction automatique de règles pour la
# détermination de types de relations sémantiques dans les constructions génitives
# en français » (PFIA/IC 2024), Tableau 1. Les relations 'r_x-1' sont conversives
# (A→B) : « beauté de la fille » = A(propriété) r_has_property-1 B(porteur).
_CLASS2JDM = {
    "r_agent": "r_processus>agent",
    "r_patient": "r_processus>patient",
    "r_possession": "r_own-1",
    "r_auteur": "r_product_of",
    "r_caractérisation": "r_has_property-1",
    "r_causalité": "r_has_causatif",
    "r_composition": "r_object>mater",
    "r_dépiction": "r_depict",
    "r_holonymie": "r_holo",
    "r_instrument": "r_processus>instr-1",
    "r_lieu": "r_lieu",
    "r_origine": "r_lieu>origine",
    "r_quantification": "r_quantificateur",
    "r_relationnel": "r_has_social_tie_with",   # Table 1 dit 'r_social_tie' (coquille) → vrai nom JDM (id 113)
    "r_topique": "r_has_topic",                 # Table 1 'r_topic' = simplif. → vrai nom client/JDM (id 142)
}
# NB : la Table 1 note 'r_objet>matière' / 'r_topic' / 'r_social_tie' comme
# simplifications rédactionnelles ; on affiche les noms qui résolvent réellement
# dans JDM (r_object>mater 50, r_has_topic 142, r_has_social_tie_with 113).


def jdm_name(relation: str) -> str:
    return _CLASS2JDM.get(relation, relation)


def nl(relation: str, a: str, b: str) -> str:
    return _NL.get(relation, "{a} — " + relation + " — {b}").format(a=a, b=b)


# Connecteurs marquant un B DÉFINI (article) vs BRUT (massif / indéfini).
_DEF_CONN = {"du", "de la", "de l'", "de l’", "des"}


def _norm_conn(conn):
    """Normalise le connecteur (« De La » → « de la ») ; None si absent."""
    if not conn:
        return None
    return re.sub(r"\s+", " ", conn.strip().lower())


def _definite(conn):
    """True si B est introduit par un article défini (du/de la/de l'/des),
    False si brut (de/d'), None si inconnu. La définitude discrimine p.ex.
    « café de Colombie » (origine, brut) de « voiture de l'homme » (possession)."""
    c = _norm_conn(conn)
    if c is None:
        return None
    return c in _DEF_CONN


def parse_pair(text: str):
    """« A de B » → (A, B, connecteur). Gère « +de/+d' » internes aux composés.
    Le connecteur (du/de la/de/d'…) est conservé pour le trait de définitude."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    m = _CONN.search(s)
    if not m:
        return None
    a = s[:m.start()].replace("+", "").strip()
    b = s[m.end():].replace("+", "").strip()
    return (a, b, _norm_conn(m.group(1))) if a and b else None


def _term_feats(client, term, cache):
    # IMPORTANT : l'API JDM ne trie PAS par poids avant d'appliquer `limit` (ordre
    # natif par id) → un petit limit jette les relations les plus FORTES. On passe
    # donc `min_weight` (pattern canonique du client : synonyms/hypernyms) pour ne
    # pas tronquer les signaux forts (ex. « fille r_carac belle » w=106).
    if term in cache:
        return cache[term]
    f = {}
    try:                # UN seul appel tous-types (l'API rejette une LISTE de types_ids
                        # → 500) ; min_weight pour ne pas tronquer les relations fortes,
                        # d'où hyperonymes forts (r_isa=6) ET présence de types sortants.
        res = client.relations_from(term, min_weight=25, limit=1000)
        idx = res.node_index()
        isa, seen = [], set()
        for r in res.relations:
            n = idx.get(r.node2)
            if n is None or r.w <= 0:
                continue
            seen.add(r.type)
            if r.type == 6:
                isa.append((n.name.strip().lower().split(">")[0], r.w))
        for nm, _w in sorted(isa, key=lambda x: -x[1])[:6]:
            f["ISA:" + nm] = 1.0
        for tid, tag in _TYPE_TAGS.items():
            if tid in seen:
                f["OUT:" + tag] = 1.0
    except Exception:
        pass
    try:                                    # INFO-SEM (r_infopot=36)
        res = client.relations_from(term, types_ids=[36], min_weight=1, limit=200)
        idx = res.node_index()
        for r in res.relations:
            n = idx.get(r.node2)
            if n and n.name.upper().startswith("_INFO") and r.w > 0:
                f["INFO:" + n.name.lower()] = math.log1p(r.w)
    except Exception:
        pass
    cache[term] = f
    return f


# Transitivité nom déverbal → verbe → agent/patient du verbe.
_RID_ACTVERB, _RID_AG, _RID_PA = 40, 13, 14

# Termes trop génériques : présents dans les agents ET patients de beaucoup de verbes
# (un « malade » isa « personne » matcherait l'agent générique) → exclus du matching.
_GENERIC = {"personne", "individu", "gens", "être humain", "être vivant", "humain",
            "animal", "être", "chose", "objet", "truc", "quelqu'un", "quelque chose",
            "entité", "agent", "patient", "quelque_chose"}


def _verb_of(client, term, cache):
    """Verbe d'un nom d'action via r_action-verbe (40) : auscultation→ausculter."""
    key = ("VERB", term)
    if key in cache:
        return cache[key]
    v, best = None, 0.0
    try:
        res = client.relations_from(term, types_ids=[_RID_ACTVERB], min_weight=1, limit=100)
        idx = res.node_index()
        for r in res.relations:
            n = idx.get(r.node2)
            if n and r.w > best:
                best, v = r.w, n.name.strip().lower()
    except Exception:
        pass
    cache[key] = v
    return v


def _verb_roles(client, verb, cache):
    """({agent: poids}, {patient: poids}) du verbe (r_agent 13 / r_patient 14),
    noms normalisés (raffinements « docteur>59071 » → « docteur »)."""
    key = ("VROLE", verb)
    if key in cache:
        return cache[key]

    def rolemap(tid):
        m = {}
        try:
            res = client.relations_from(verb, types_ids=[tid], min_weight=25, limit=300)
            idx = res.node_index()
            for r in sorted(res.relations, key=lambda x: -x.w)[:15]:
                n = idx.get(r.node2)
                if n and r.w > 0:
                    nm = n.name.strip().lower().split(">")[0]
                    if nm not in _GENERIC:
                        m[nm] = max(m.get(nm, 0.0), float(r.w))
        except Exception:
            pass
        return m

    out = (rolemap(_RID_AG), rolemap(_RID_PA))
    cache[key] = out
    return out


def _verb_feats(client, a, b, fv, cache):
    """Par TRANSITIVITÉ : remonte au verbe de A et exploite ses agents/patients.
      - A_VERB_AG / A_VERB_PA : A est une action (à agent/patient) — SEULEMENT quand
        r_processus>agent/patient (70/76) manque sur le nom (fallback demandé) ;
      - VW:B_verb_agent / VW:B_verb_patient : B (ou un hyperonyme spécifique) est
        l'agent vs le patient du verbe, GRADUÉ par le poids JDM (log1p) → le modèle
        apprend la marge agent−patient et discrimine r_agent de r_patient."""
    verb = _verb_of(client, a, cache)
    if not verb:
        return {}
    ag, pa = _verb_roles(client, verb, cache)
    if not ag and not pa:
        return {}
    f = {}
    if "A_OUT:procag" not in fv and "A_OUT:procpa" not in fv:   # fallback 70/76 absents
        if ag:
            f["A_VERB_AG"] = 1.0
        if pa:
            f["A_VERB_PA"] = 1.0
    bset = {b.strip().lower()}
    for k in fv:
        if k.startswith("B_ISA:"):
            nm = k[6:].split(">")[0]
            if nm not in _GENERIC:      # pas de match via un hyperonyme trop générique
                bset.add(nm)
    w_ag = max((ag.get(n, 0.0) for n in bset), default=0.0)
    w_pa = max((pa.get(n, 0.0) for n in bset), default=0.0)
    if w_ag > 0:
        f["VW:B_verb_agent"] = math.log1p(w_ag)
    if w_pa > 0:
        f["VW:B_verb_patient"] = math.log1p(w_pa)
    return f


# Transitivité CARACTÉRISATION : nom de qualité ↔ adjectif ↔ r_carac du porteur.
#   r_nom>adj (165) nom→adj ; r_adj>nom (164) conversif ; r_fem (60)/r_masc (59)
#   pour l'accord ; r_carac (17) porteur→adjectifs ; r_lemma (19) normalisation.
_RID_NOMADJ, _RID_ADJNOM, _RID_FEM, _RID_MASC, _RID_CARAC = 165, 164, 60, 59, 17


def _targets(client, term, rid, cache, k=8, mw=1, limit=500):
    """Cibles (nom minuscule, poids) fortes d'un terme pour un type de relation,
    triées par poids, cachées. `min_weight` évite la troncature (l'API ne trie pas)."""
    key = ("T", term, rid, mw)
    if key in cache:
        return cache[key]
    out = []
    try:
        res = client.relations_from(term, types_ids=[rid], min_weight=mw, limit=limit)
        idx = res.node_index()
        for r in sorted(res.relations, key=lambda x: -x.w)[:k]:
            n = idx.get(r.node2)
            if n and r.w > 0:
                out.append((n.name.strip().lower().split(">")[0], float(r.w)))
    except Exception:
        pass
    cache[key] = out
    return out


def _adj_forms(client, noun, cache):
    """Adjectif(s) d'un nom de qualité : masculin (r_nom>adj) + féminin (r_fem),
    pour matcher un porteur dont l'adjectif r_carac est accordé (belle, douce…)."""
    key = ("ADJF", noun)
    if key in cache:
        return cache[key]
    forms = set()
    for adj, _w in _targets(client, noun, _RID_NOMADJ, cache, k=3):
        forms.add(adj)
        for fem, _wf in _targets(client, adj, _RID_FEM, cache, k=2):
            forms.add(fem)                       # beau→belle, doux→douce, dur→dure
    cache[key] = forms
    return forms


def _adj_noun(client, adj, cache):
    """CONVERSIF : nom(s) de qualité d'un adjectif — via r_adj>nom (164), en
    normalisant d'abord le féminin en masculin (r_masc) car r_adj>nom n'est peuplé
    que sur la base masculine (« belle »→beau→beauté, « courageuse »→courageux→courage)."""
    mascs = {adj} | {m for m, _ in _targets(client, adj, _RID_MASC, cache, k=2)}
    noms = set()
    for m in mascs:
        for nom, _w in _targets(client, m, _RID_ADJNOM, cache, k=3):
            noms.add(nom)
    return noms


def _carac_feats(client, a, b, cache):
    """Par TRANSITIVITÉ : « caractérisation » si l'adjectif r_carac du porteur B
    correspond au nom de qualité A. Deux sens, robustes à l'accord :
      DIRECT : A →r_nom>adj(+r_fem)→ {adj} ∩ adjectifs r_carac de B ;
      CONVERSIF (fallback) : adjectifs r_carac de B →r_masc→r_adj>nom→ nom == A.
    Haute précision (ne se déclenche pas hors qualité)."""
    cadj = _targets(client, b, _RID_CARAC, cache, k=30, mw=25)   # adjectifs FORTS de B
    if not cadj:
        return {}
    forms = _adj_forms(client, a, cache)
    best = max((w for bad, w in cadj if bad in forms), default=0.0)
    if best == 0.0:                                        # fallback conversif
        a_low = (a or "").strip().lower()
        for bad, w in sorted(cadj, key=lambda x: -x[1])[:6]:
            if a_low in _adj_noun(client, bad, cache):
                best = w
                break
    return {"VW:B_carac_of_A": math.log1p(best)} if best > 0 else {}


def _pair_feats(client, a, b, cache):
    """Relation DIRECTE A↔B (les deux sens). Renvoie (dict_features, evidence)."""
    key = ("PAIR", a, b)
    if key in cache:
        return cache[key]
    f, ev = {}, []
    for x, y, pref in ((a, b, "AB"), (b, a, "BA")):
        try:
            res = client.relations_between(x, y)
            for rel in res.relations:
                if rel.w <= 0:
                    continue
                tn = client.relation_type_name(rel.type) or str(rel.type)
                if tn in _SKIP_REL:          # relations génériques : ni feature ni évidence
                    continue
                k = pref + ":" + tn
                f[k] = max(f.get(k, 0.0), math.log1p(rel.w))
                ev.append((f"{x}→{y}", tn, rel.w))
        except Exception:
            pass
    ev.sort(key=lambda e: -e[2])
    out = (f, ev)
    cache[key] = out
    return out


# Catégories de type d'un terme, agrégées à partir des signaux GÉNÉRIQUES (INFO-SEM
# r_infopot + relations sortantes typées) — volontairement PAS les hyperonymes
# spécifiques (r_isa creux, sur-appris) : ces buckets se croisent proprement.
def _type_tags(fv, pref):
    keys = [k[len(pref):] for k in fv if k.startswith(pref)]
    ks = set(keys)

    def eq(*names):
        return any(n in ks for n in names)

    def pre(*subs):
        return any(any(k.startswith(s) for s in subs) for k in keys)

    tags = set()
    if eq("OUT:procag", "OUT:procpa", "ISA:action") or pre("INFO:_info-sem-action",
                                                           "INFO:_info-sem-event"):
        tags.add("action")
    if eq("OUT:mater", "OUT:holo", "OUT:haspart") or pre("INFO:_info-sem-thing",
                                                         "INFO:_info-sem-artefact",
                                                         "INFO:_info-sem-object"):
        tags.add("object")
    if pre("INFO:_info-sem-subst"):
        tags.add("subst")
    if eq("OUT:lieu1", "OUT:lieuact", "OUT:origin") or pre("INFO:_info-sem-place"):
        tags.add("place")
    if pre("INFO:_info-sem-pers", "INFO:_info-sem-living-being"):
        tags.add("pers")
    if pre("INFO:_info-sem-abstr"):
        tags.add("abstr")
    return tags


def _conjunctions(fv):
    """Traits d'INTERACTION A×B — un modèle linéaire est ADDITIF : il ne peut pas
    ET-er « A est une action » et « B est une personne » (→ agent, PAS possession).
    On matérialise donc le CONJOINT sur l'exemple entier en croisant SYSTÉMATIQUEMENT
    chaque type de A × chaque type de B (action/objet/subst/lieu/personne/abstrait).
    (Une personne possède un OBJET, pas une action → action×pers ≠ object×pers.)"""
    at, bt = _type_tags(fv, "A_"), _type_tags(fv, "B_")
    out = {}
    for a in at:
        out["XA:" + a] = 1.0            # type marginal de A (générique)
    for b in bt:
        out["XB:" + b] = 1.0            # type marginal de B
    for a in at:
        for b in bt:
            out["X:" + a + "×" + b] = 1.0   # interaction A×B (conjoint)
    return out


def featurize(client, a, b, cache=None, conn=None):
    """Vecteur de features (dict) d'une paire + évidence (relations A↔B trouvées).

    `conn` = connecteur du génitif (du/de la/de/d'…) → trait de DÉFINITUDE de B."""
    cache = cache if cache is not None else {}
    fv = {}
    for k, v in _term_feats(client, a, cache).items():
        fv["A_" + k] = v
    for k, v in _term_feats(client, b, cache).items():
        fv["B_" + k] = v
    pf, ev = _pair_feats(client, a, b, cache)
    fv.update(pf)
    fv.update(_verb_feats(client, a, b, fv, cache))
    fv.update(_carac_feats(client, a, b, cache))
    fv.update(_conjunctions(fv))
    d = _definite(conn)
    if d is True:
        fv["B_DET:def"] = 1.0      # « du / de la / de l' / des B » → B défini
    elif d is False:
        fv["B_DET:bare"] = 1.0     # « de / d' B » → B brut (massif / indéfini)
    return fv, ev


def model_path():
    return os.path.join(os.path.dirname(__file__), "..", "..", "models", "grasp_it.json")


_MODEL = None


def _load():
    """Charge le modèle JSON : {classes, features, index, mean, scale, coef, intercept}."""
    global _MODEL
    if _MODEL is None:
        with open(model_path(), encoding="utf-8") as fh:
            m = json.load(fh)
        m["index"] = {name: i for i, name in enumerate(m["features"])}
        _MODEL = m
    return _MODEL


def _proba(model, fv: dict):
    """Régression logistique multinomiale en Python pur → liste de probas."""
    feats, idx = model["features"], model["index"]
    mean, scale = model["mean"], model["scale"]
    # vecteur standardisé (features absentes = 0)
    x = [0.0] * len(feats)
    for k, v in fv.items():
        i = idx.get(k)
        if i is not None:
            x[i] = (v - mean[i]) / (scale[i] or 1.0)
    logits = []
    for c, coef_c in enumerate(model["coef"]):
        s = model["intercept"][c]
        for i, w in enumerate(coef_c):
            if w:
                s += w * x[i]
        logits.append(s)
    mx = max(logits)
    exps = [math.exp(l - mx) for l in logits]
    tot = sum(exps) or 1.0
    return [e / tot for e in exps]


def _signals(fv: dict) -> dict:
    """Explique les signaux de type par côté : A est-il une action ? B un lieu/personne ?"""
    def side(pref):
        types = [_OUT_LABEL.get(k[6:], k[6:]) for k in fv if k.startswith(pref + "OUT:")]
        isa = [k[6:] for k in fv if k.startswith(pref + "ISA:")]
        return {"types": types, "isa": isa[:4]}
    return {"a": side("A_"), "b": side("B_")}


def predict(text: str, client, *, top_k: int = 3) -> dict:
    """« A de B » → {a, b, relation, nl, top[], evidence[]}."""
    p = parse_pair(text)
    if p is None:
        return {"ok": False, "error": "Format attendu : « A de B »."}
    a, b, conn = p
    model = _load()
    fv, ev = featurize(client, a, b, conn=conn)
    proba = _proba(model, fv)
    classes = model["classes"]
    order = sorted(range(len(classes)), key=lambda i: -proba[i])
    top = [{"relation": jdm_name(classes[i]), "proba": round(proba[i], 3),
            "nl": nl(classes[i], a, b)} for i in order[:top_k]]
    best = classes[order[0]]

    # Couche DIRECTE : relations JDM A↔B qui concernent les génitifs (toutes,
    # dédupliquées par classe = poids max), triées par poids.
    # r_product_of est AMBIGU dans JDM : « café de Colombie » (origine) et
    # « gâteau du pâtissier » (auteur) l'emploient tous deux. On arbitre par le
    # type de B : lieu → origine, personne → auteur (Table 1 : auteur = r_product_of).
    b_pers = any(k in fv for k in ("B_INFO:_info-sem-pers", "B_INFO:_info-sem-living-being"))
    direct = {}
    for d, tn, w in ev:
        if tn == "r_product_of":
            cls = "r_auteur" if b_pers else "r_origine"   # personne → auteur, sinon (lieu) origine
        else:
            cls = _REL2CLASS.get(tn)
        if cls and w > direct.get(cls, (0, None, None))[0]:
            direct[cls] = (w, tn, d)
    # Les relations « lieu-like » (r_lieu, r_domain…) ont des poids JDM souvent
    # très élevés (association spatiale) mais sont de faux amis pour le génitif →
    # on classe APRÈS les relations structurelles/prédicatives.
    _lieu_like = {"r_lieu", "r_lieu-1", "r_domain", "r_domain-1", "r_has_topic"}
    direct_list = sorted(
        [{"relation": jdm_name(c), "via": via, "weight": int(w), "nl": nl(c, a, b)}
         for c, (w, via, d) in direct.items()],
        key=lambda x: (x["via"] in _lieu_like, -x["weight"]))

    return {"ok": True, "a": a, "b": b, "relation": jdm_name(best), "nl": nl(best, a, b),
            "top": top, "signals": _signals(fv), "direct": direct_list,
            "evidence": [f"{d} : {t} ({int(w)})" for d, t, w in ev[:6]]}
