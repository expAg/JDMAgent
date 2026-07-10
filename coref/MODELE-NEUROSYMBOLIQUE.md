# Modèle neuro-symbolique de coréférence (CorPipe 25 × JeuxDeMots / ARCS)

Modèle implémenté et testé : un **étage neuronal** (CorPipe 25, SOTA) produit les
mentions et un clustering prior ; un **étage symbolique** (ARCS × JDM) re-résout les
pronoms sous contraintes de liage et évidence sémantique. Tout est *explicable*.

## Pipeline

```
texte ─UDPipe─▶ CoNLL-U(UD) ─CorPipe 25─▶ clusters prior
                                  │
                    app/neurosym/ ▼  (re-résolution des pronoms)
   coargs.py   contraintes DURES co-arguments (verbe non-pronominal)   ── J1
   salience.py compétition par saillance (parallélisme, récence, prior) ── J1/IV
   jdm_client.py + selection.py  restrictions de sélection JDM (souple) ── J2/J4
   asr.py      propagation d'activation (désambiguïsation, compat)      ── J3
   features.py vecteurs pour ré-ordonnanceur appris                     ── J5
                                  ▼
                       chaînes finales + corrections tracées
```

## Principe de décision (par pronom, dans l'ordre du texte)

1. **Ancres** : on fait confiance à CorPipe pour la coréférence nominale (NOM/NOM propre).
2. **Veto dur (co-Arg)** : un pronom ne peut rejoindre une entité contenant un de ses
   co-arguments (même prédicat non-pronominal). Transitivité automatique (l'entité
   accumule les mots de ses mentions).
3. **Score = saillance + prior CorPipe + JDM (souple)** :
   `s = parallélisme_rôle + saillance_sujet + récence + 0.8·prior_CorPipe + Δ_JDM`
   avec `Δ_JDM ∈ [-0.6, 0.6]` (agent/patient/carac), **jamais éliminatoire**
   (absence JDM = neutre ; langage figuré respecté).
4. Sinon → nouvel antécédent (exophore/cataphore).

## Résultats (harnais `eval_suite.py`)

**11/11 assertions** vérifiées, dont le cas du screenshot :
- `il` (sujet de *rendre*) → **John** ; `lui` (COI de *rendre*) → **frère**
  (résolu par la contrainte co-Arg + parallélisme sujet, là où CorPipe seul échouait).
- Co-arguments *méprise* (Pierre/Paul), objets (*le chat/la souris*, *les clés/les*),
  sélection JDM (*butiner* → abeille) : tous corrects, **sans régression**.

## J5 — Vers l'intégration « forte » (apprentissage)

L'étage symbolique est aujourd'hui un post-traitement. Étapes pour l'internaliser :

1. **Ré-ordonnanceur appris** : `features.pair_features` produit, pour chaque paire
   (pronom, candidat), un vecteur [coarg_veto, accord, parallélisme, récence,
   prior, fit JDM, compat ASR]. Entraîner une régression logistique / MLP léger sur
   **Democrat + ANCOR** (CorefUD) pour remplacer la combinaison linéaire calibrée à la
   main par des poids appris.
2. **Perte structurée co-Arg** : pénaliser à l'entraînement de CorPipe les liens
   d'antécédent qui violent la règle co-Arg (contrainte → terme de perte), pour que le
   modèle *internalise* la non-réflexivité plutôt que de la subir en post-traitement.
3. **Features JDM/ASR dans l'encodeur** : concaténer les scores sélectionnels (agent/
   patient) et l'activation ASR aux représentations de mentions, ou via un adaptateur
   léger ré-entraîné, puis mesurer le gain CoNLL F1 vs. le post-traitement.
4. **Évaluation** : CoNLL F1 (scorer CorefUD) + diagnostic par type d'erreur et
   ablation par couche (J1 / J2 / J3), suite Winograd-FR + régression `eval_suite.py`.

## Notes
- Versions « légère » (J1+J2, rapide) vs « complète » (+ J3 ASR, plus de requêtes JDM),
  exactement la distinction de la thèse (§5.2.5). ASR n'est pas branché par défaut dans
  le service web pour la latence ; il est disponible et testé.
- JDM en accès rezo-dump + cache disque (`app/neurosym/.jdm_cache/`).
