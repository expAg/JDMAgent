"""J5 — Pont vers l'apprentissage : features neuro-symboliques par paire.

Vectorise, pour une paire (pronom, antécédent candidat), les signaux de toutes
les couches : contrainte dure co-Arg, saillance, sélection JDM, compatibilité ASR.
Ces vecteurs alimentent (a) un ré-ordonnanceur appris (régression logistique /
MLP) et (b) une perte structurée pénalisant les liens violant co-Arg (cf. J5).
"""
from .coargs import cannot_link_pairs
from .salience import agree, SUBJECT, OBJECT
from .selection import jdm_scorer
from .asr import context_compat
from . import centering


def _content_terms(node):
    sent = node.root
    return [n.lemma for n in sent.descendants
            if n.upos in ("VERB", "NOUN", "PROPN", "ADJ") and n.lemma]


def pair_features(p, cand, doc, pairs=None, with_asr=False,
                  cand_entity_index=None, entities=None, mentions=None):
    """Renvoie un dict de features pour la paire (pronom p, candidat cand).

    Si le contexte discursif (cand_entity_index, entities, mentions) est fourni,
    les features de centrage (Cb/Cp/transition) sont incluses — clé pour
    l'apprentissage de la cohérence inter-phrastique (étapes A/B d'intégration).
    """
    if pairs is None:
        pairs, _ = cannot_link_pairs(doc)
    coarg_veto = any(frozenset((wp, wc)) in pairs
                     for wp in p["wids"] for wc in cand["wids"])
    pr, cr = p["head"].udeprel, cand["head"].udeprel
    feats = {
        "coarg_veto": float(coarg_veto),
        "agree": float(agree(p, cand)),
        "subj_parallel": float(pr in SUBJECT and cr in SUBJECT),
        "obj_parallel": float(pr in OBJECT and cr in OBJECT),
        "antecedent_subject": float(cr in SUBJECT),
        "antecedent_propn": float(cand["head"].upos == "PROPN"),
        "sent_distance": float(abs(p["sent"] - cand["sent"])),
        "jdm_role_fit": float(jdm_scorer(p, cand, doc)),
    }
    if cand_entity_index is not None and entities is not None and mentions is not None:
        feats.update(centering.pair_features(p, cand_entity_index, entities, mentions))
    if with_asr:
        feats["asr_compat"] = float(
            context_compat(cand["head"].lemma or cand["head"].form,
                           _content_terms(p["head"])))
    return feats


FEATURE_ORDER = [
    "coarg_veto", "agree", "subj_parallel", "obj_parallel",
    "antecedent_subject", "antecedent_propn", "sent_distance", "jdm_role_fit",
]


def vectorize(feats, order=FEATURE_ORDER):
    return [feats.get(k, 0.0) for k in order]
