# Feuille de route — Couche neuro-symbolique (CorPipe × JeuxDeMots / ARCS)

Objectif : améliorer la résolution de coréférence du service (CorPipe 25, neuronal)
en lui adjoignant une couche **symbolique** inspirée du système **ARCS** (thèse Guenoune
2022) et adossée à **JeuxDeMots (JDM)**. On vise une amélioration *explicable* : chaque
correction doit pouvoir être justifiée (contrainte syntaxique violée, évidence sémantique).

---

## 0. Principe d'architecture : neuro-symbolique en deux registres

CorPipe 25 est un excellent **générateur sous-symbolique** : il propose des mentions et,
pour chaque mention anaphorique, une distribution de scores d'antécédents (cf. `compute_antecedents`).
Mais il n'a aucune représentation explicite de la syntaxe argumentale ni du sens commun → il
sur-fusionne (cf. screenshot : 7 pronoms masculins singuliers agglomérés sur « John »).

La couche ARCS intervient **après** CorPipe, en réutilisant :
- l'**arbre UD** déjà calculé (UDPipe → CoNLL-U) ;
- le **graphe JDM** (via l'API/MCP).

> **Distinction cardinale (recadrage expert)** — il faut séparer deux registres d'évidence :
> - **Contraintes DURES** = syntaxiques. La règle des **co-arguments d'un verbe non-pronominal**
>   (règle `co-Arg`/`nonR`, théorie du liage de Reinhart, thèse §5.2.4.1). Elles *interdisent* des liens.
> - **Évidences SOUPLES (défaisables)** = sémantiques (JDM). Restrictions de sélection, classes,
>   anaphores associatives. Elles *pondèrent*, jamais n'éliminent.
>
> ⚠️ **L'absence d'une relation dans JDM n'invalide pas une lecture** (JDM est incomplet) et le
> **langage peut être figuré** (ex. « il avait peur qu'il les [clés] ait mangées » = hyperbole).
> Donc : aucune décision dure fondée sur une absence/poids JDM.

Mapping sur les 5 phases d'ARCS :

| Phase ARCS (thèse) | Équivalent dans le service |
|---|---|
| I — Détection des mentions | Fourni par CorPipe (mention detection) |
| II — Génération des candidats | Distribution d'antécédents de CorPipe |
| III — Pré-sélection / filtrage | **Couche dure** : co-arguments (UD) → élagage d'arêtes |
| IV — Compétition (scoring) | **Couche souple** : score combiné CorPipe + JDM (ASR) |
| V — Sélection | Re-clustering sous contraintes |

---

## 1. Diagnostic du cas test (screenshot)

> *« John a appelé son frère parce qu'il voulait lui rendre ses clés. Il les avait oubliées
> chez lui hier soir. Il avait peur qu'il les ait mangées. »*

CorPipe produit : **Chaîne 0 « John » (7 mentions)** = John, il, lui, Il, lui, Il, il —
fusion erronée de tous les pronoms masc. sing.

**Le levier principal = co-arguments.** UD (vérifié) :
```
il  (nsubj → voulait)      lui (iobj → rendre)      rendre (xcomp → voulait, NON-pronominal)
```
`il` (sujet, par contrôle vouloir→rendre) et `lui` (COI) sont **co-arguments du verbe
non-pronominal `rendre`** ⇒ règle `co-Arg` : `il ≠ lui`. Comme `il = John`, alors
`lui = son frère`. → casse la fusion, sépare la chaîne « frère ».

**Ce qui N'est PAS un bon levier ici** : la sélection sémantique sur « manger les clés ».
JDM montre bien `manger | r_patient | viande, sandwich, pomme…` (et `clé ↔ manger = ∅`),
mais l'énoncé est **figuré** → on ne doit ni exclure de candidat ni inférer un « antécédent
manquant ». Au mieux : un signal souple, très faible, jamais éliminatoire.

---

## 2. Leviers ARCS ↔ JDM réutilisables

### 2.a — Contraintes dures de co-arguments (syntaxe, **sans JDM**) — *priorité 1*
Règles `nonR` / `co-Arg` (thèse §5.2.4.1) : deux arguments [sujet, OD, COI] d'un même
prédicat **non-pronominal** ne co-réfèrent pas ; transitivité étendue aux co-référents
(thèse §5.2.4, ex. 5.75-5.76). Exception du complément circonstanciel + c-commande
(« il regarde Pitt, en face de Luc ») — thèse §5.2.5.1.
Implémentable **entièrement depuis le CoNLL-U UD** : détecter le prédicat (lemme verbal,
absence de clitique réfléchi `se`), récolter ses core-args (`nsubj`, `obj`, `iobj`,
sujet hérité via `xcomp`/`advcl`), marquer les paires conflictuelles.

### 2.b — Restrictions de sélection (JDM, **souple**)
Rôles sémantiques JDM : `r_agent` / `r_patient` (et formes `r_processus>agent/patient`
pour prédicats nominaux). Outils MCP : `get_agents`, `get_patients`, `get_process_agents`,
`get_relations_between`. Sert à **pondérer** la plausibilité d'un candidat dans un rôle, pas
à filtrer. Poids JDM = évidence (positif = plausible, négatif = contre-évidence, ex.
`chat | r_agent | voler = -50`). Toujours défaisable (figuré, incomplétude).

### 2.c — Classes sémantiques / animacy (JDM, anaphore nominale)
`r_isa` + nœuds méta `_INFO_SEM_PERS`, `_INFO_SEM_ALIVE`, `_INFO_SEM_PLACE`… (thèse §4.1.3.2).
Pour les renvois nominaux (« L'animal a gémi » → Milou, pas Bill — thèse ex. 5.77).
Outils : `get_hypernyms`, `get_relations_between`. **Souple** + monde ouvert (un nom propre
inconnu de JDM ne doit pas être exclu).

### 2.d — Anaphores associatives (JDM, méronymie/holonymie/télique)
« Le chat… L'accoudoir est griffé. Son cri… » (thèse fig. 4.2). Relations `r_has_part`,
`r_holo`, `r_carac`, rôle télique. Outils : `get_parts`, `get_characteristics`,
`get_telic_role`. Pour relier une mention à un tout/partie plausible.

### 2.e — ASR : propagation d'activation comme scoreur (cœur neuro-symbolique)
Algorithme ASR (thèse §4.1.4.1) : construire un graphe de travail (termes du contexte +
raffinements + relations UD prioritaires + relations JDM, poids négatifs inclus), propager
un signal d'activation, lire les niveaux d'activation. Donne **simultanément** (i) la
désambiguïsation de sens (raffinements activés) et (ii) un score de compatibilité sémantique
candidat↔contexte. C'est le mécanisme à brancher dans la phase IV (compétition).

---

## 3. Architecture technique dans le repo

```
app/
  corpipe_engine.py     # (existant) CorPipe résident → CoNLL-U annoté Entity=
  coref.py              # (existant) UDPipe → CorPipe → udapi → chaînes + UD
  neurosym/             # NOUVEAU
    coargs.py           #   2.a  contraintes dures co-arguments (depuis le CoNLL-U UD)
    jdm_client.py       #   accès JDM (API/MCP) + cache disque (le graphe est stable)
    selection.py        #   2.b/2.c/2.d  scores sémantiques souples
    asr.py              #   2.e  propagation d'activation (graphe de travail)
    rerank.py           #   phase IV/V : score combiné + re-clustering sous contraintes
```

Point d'insertion : entre `predict_conllu()` (qui donne mentions + liens) et la construction
des chaînes dans `coref.py`. Idéalement, exploiter les **scores d'antécédents** de CorPipe
(exposer `compute_antecedents` au lieu de la seule décision argmax) pour disposer d'une
distribution sur laquelle ré-ordonner — sinon, opérer au niveau des clusters (fusion/scission).

Score final d'un lien mention→antécédent :
```
score = w_n · s_corpipe        (neuronal, normalisé)
      + w_s · s_jdm(ASR)        (sémantique souple ∈ [-1,1])
      − ∞   si co-argument dur violé        (contrainte = élagage de l'arête)
```
`w_n, w_s` calibrés sur dev (cf. thèse : « vecteur d'amplification des scores internes »).

---

## 4. Jalons

**J0 — Socle d'évaluation & diagnostic** (prérequis, peu coûteux)
- Jeux de test : `fr_democrat` + `fr_ancor` (CorefUD), une suite de **cas Winograd-FR** et
  une **suite de régression** dérivée du screenshot (co-arguments, possessifs, exophore figurée).
- Métriques : CoNLL F1 (head-match, via le scorer CorefUD) **+ diagnostic par type d'erreur**
  (sur-fusion pronominale, co-arguments, nominal/associatif). Objectif : mesurer chaque couche
  isolément (ablation), comme dans la thèse (SEM-Lite / SEM-All).

**J1 — Couche dure « co-arguments » (UD, sans JDM)** — *quick win, fort ROI*
- Implémenter `coargs.py` : extraction des core-args par prédicat non-pronominal, paires
  conflictuelles, propagation par transitivité aux co-référents (thèse §5.2.4).
- Brancher en élagage : interdire la fusion de deux mentions co-arguments ⇒ scission de chaîne.
- Cible : corriger le cas screenshot (`il ≠ lui` sur `rendre`). Validation sur la suite Winograd-FR.

**J2 — Couche souple « restrictions de sélection » (JDM)** — *défaisable*
- `jdm_client.py` (cache) + `selection.py` : score `r_agent`/`r_patient` du candidat dans son
  rôle, **borné et défaisable**, jamais éliminatoire. Caveat figuré explicite (plafonner l'impact).
- Ajout au score de compétition (poids `w_s` faible au départ).

**J3 — Scoreur ASR (propagation d'activation)** — *cœur neuro-symbolique*
- `asr.py` : graphe de travail (contexte + raffinements + UD prioritaire + JDM), propagation,
  lecture des activations. Fournit désambiguïsation de sens + score candidat↔contexte.
- Remplace/enrichit le score souple de J2 dans la phase IV.

**J4 — Anaphores nominales & associatives**
- `selection.py` étendu : classes sémantiques (`r_isa` + `_INFO_SEM_*`) pour renvois nominaux,
  méronymie/holonymie/télique pour associatives. Monde ouvert (pas d'exclusion sur inconnu).

**J5 — Intégration « forte » (apprentissage)** — *cible long terme*
- Passer de la post-correction à l'**injection de features JDM dans le modèle** : features
  sélectionnelles / d'activation ASR concaténées aux représentations, ou adaptateur léger
  ré-entraîné sur Democrat/ANCOR + cas de sens commun. Évaluer le gain vs. la couche post-hoc.
- Piste : contraintes co-arguments comme **perte structurée** (pénaliser à l'entraînement les
  liens violant `co-Arg`), pour internaliser la règle plutôt que la plaquer.

---

## 5. Risques & limites (déjà identifiés dans la thèse)

- **Verbes pronominaux non-réflexifs** (« ma femme se tape une raclette ») : la détection de
  réflexivité par le clitique `se` rate ces cas → ne pas appliquer `co-Arg` (thèse ex. 5.73).
- **Hypothèse du monde clos sur la REN / JDM** : trop restrictive (« Bill » chien vs personne) →
  rester en monde ouvert, JDM en évidence souple (thèse §5.2.4.2).
- **Polysémie** : passer par `disambiguate` (raffinements) avant d'interroger un sens précis.
- **Complétude de JDM** : variable selon les termes → l'absence n'est jamais une preuve.
- **Qualité de l'UD** : les co-arguments dépendent du parse (UDPipe) ; erreurs de rattachement
  (contrôle `xcomp`, coordinations) à gérer défensivement.

---

### Synthèse
Le gain le plus net et le plus sûr vient de **J1 (co-arguments, contrainte dure, UD pure)** —
c'est ce qui corrige le screenshot. JDM intervient ensuite comme **évidence souple** (J2–J4),
puis s'**internalise** par apprentissage (J5). On garde le caractère explicable d'ARCS : chaque
correction est tracée à une règle de liage ou à un chemin JDM pondéré.
