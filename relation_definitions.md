# Description Sémantique des Relations - JeuxDeMots

Ce document répertorie les relations sémantiques utilisées dans le réseau lexical JeuxDeMots (JDM). Chaque relation est définie par son nom technique, une description explicite et des exemples d'usage.

## 1. Relations Hiérarchiques et d'Équivalence

### Is-A / Generic (`r_isa`)
Désigne un lien de généralisation (hyperonymie). Le terme cible est une catégorie dont le terme source fait partie.
* chat | r_isa | mammifère
* truite | r_isa | poisson
* marteau | r_isa | outil

### Hyponym / Specific (`r_hypo`)
Désigne un lien de spécification. Le terme cible est une instance ou une sous-catégorie du terme source.
* insecte | r_hypo | mouche
* arbre | r_hypo | chêne
* métal | r_hypo | or

### Synonym (`r_syn`)
Relie des termes ayant un sens identique ou très proche.
* chat | r_syn | matou
* voiture | r_syn | automobile
* casser | r_syn | briser

### Antonym (`r_anto`)
Relie des termes ayant des sens opposés.
* chaud | r_anto | froid
* grand | r_anto | petit
* monter | r_anto | descendre

## 2. Relations de Composition (Méronymie / Holonymie)

### Has-Part / Meronym (`r_has_part`)
Indique que le terme cible est une partie, un constituant ou un membre du terme source.
* voiture | r_has_part | roue
* visage | r_has_part | nez
* livre | r_has_part | page

### Part-Of / Holonym (`r_holo`)
Indique que le terme source fait partie d'un ensemble plus vaste (le terme cible).
* main | r_holo | corps
* tuile | r_holo | toit
* élève | r_holo | classe

## 3. Caractéristiques et Propriétés

### Characteristic / Attribute (`r_carac`)
Associe un nom à ses attributs ou adjectifs qualificatifs typiques.
* eau | r_carac | liquide
* neige | r_carac | blanche
* citron | r_carac | acide

### Has-Color (`r_has_color`)
Spécifie la couleur typique d'un objet.
* sang | r_has_color | rouge
* ciel | r_has_color | bleu
* corbeau | r_has_color | noir

### Has-Property (`r_has_prop`)
Indique une propriété intrinsèque ou une capacité de l'objet.
* moteur | r_has_prop | puissance
* aimant | r_has_prop | magnétisme
* verre | r_has_prop | fragilité

## 4. Relations Actancielles et Procédurales

Le premier terme (terme source) est *toujours* un verbe à l'infinitif.

### Agent / Subject (`r_has_agent`)
Désigne l'entité qui effectue l'action (le sujet typique du verbe à l'infinitif).
* manger | r_has_agent | chat
* voler | r_has_agent | oiseau
* courir | r_has_agent | sportif

### Patient / Object (`r_has_patient`)
Désigne l'entité qui subit l'action (l'objet typique du verbe à l'infinitif).
* manger | r_has_patient | souris
* réparer | r_has_patient | voiture
* lire | r_has_patient | livre

### Instrument (`r_has_instr`)
Désigne l'outil ou le moyen utilisé pour accomplir l'action (qui est toujours un verbe à l'infinitif).
* couper | r_has_instr | couteau
* écrire | r_has_instr | stylo
* peindre | r_has_instr | pinceau

### Location / Venue (`r_has_location`)
Indique le lieu typique où se trouve un objet ou où se déroule une action.
* carotte | r_has_location | potager
* poisson | r_has_location | mer
* étudier | r_has_location | école

## 5. Dynamique Temporelle et Causale

### Has-Consequence (`r_has_conseq`)
Indique un effet ou une conséquence directe d'une action ou d'un état.
* tomber | r_has_conseq | se blesser
* étudier | r_has_conseq | réussir
* pluie | r_has_conseq | inondation

### Has-Cause (`r_has_causatif`)
Indique la cause ou l'origine d'un état ou d'une action.
* blessure | r_has_causatif | chute
* fatigue | r_has_causatif | travail
* fumée | r_has_causatif | feu

### Time-Successor (`r_has_successeur_time`)
Indique ce qui suit chronologiquement le terme source.
* jour | r_has_successeur_time | nuit
* printemps | r_has_successeur_time | été
* déjeuner | r_has_successeur_time | sieste

## 6. Production et Transformation

### Makes / Produces (`r_make`)
Indique ce que l'entité source produit ou crée.
* abeille | r_make | miel
* boulanger | r_make | pain
* vache | r_make | lait

### Material / Substance (`r_object>mater`)
Indique la matière dont est composé l'objet.
* poutre | r_object>mater | bois
* bague | r_object>mater | or
* statue | r_object>mater | marbre

### Can-Become / Transformation (`r_can_become`)
Indique une transformation possible du terme source.
* chenille | r_can_become | papillon
* glaçon | r_can_become | eau
* farine | r_can_become | pâte

## 7. Relations Fonctionnelles et Diverses

### Purpose / Goal (`r_but`)
Indique l'objectif d'une action.
* courir | r_but | santé
* travailler | r_but | argent
* dormir | r_but | récupérer

### Telic-Role / Function (`r_telic_role`)
Indique la fonction primaire pour laquelle un objet a été conçu.
* couteau | r_telic_role | couper
* chaise | r_telic_role | s'asseoir
* lunettes | r_telic_role | voir

### Against / Opposes (`r_against`)
Indique ce que le terme combat ou empêche.
* médicament | r_against | maladie
* parapluie | r_against | pluie
* digue | r_against | inondation

### Sentiment / Emotion (`r_sentiment`)
Relie un terme à une émotion ou un sentiment qu'il évoque.
* victoire | r_sentiment | joie
* échec | r_sentiment | tristesse
* araignée | r_sentiment | peur

### Accompanied-By (`r_accomp`)
Indique une association fréquente entre deux termes.
* pain | r_accomp | fromage
* couteau | r_accomp | fourchette
* orage | r_accomp | éclairs

### Actor of Process (`r_processus>agent`)
Désigne l'entité ou l'acteur qui réalise le processus ou l'événement spécifié.
* nettoyage | r_processus>agent | technicien de surface
* enseignement | r_processus>agent | professeur
* chirurgie | r_processus>agent | chirurgien

### Patient of Process (`r_processus>patient`)
Désigne l'entité qui subit le processus ou sur laquelle l'action de l'événement s'exerce.
* découpe | r_processus>patient | viande
* soin | r_processus>patient | malade
* récolte | r_processus>patient | blé

### Instrument of Process (`r_processus>instr`)
Désigne l'outil, le moyen ou l'instrument nécessaire à la réalisation du processus.
* découpe | r_processus>instr | couteau
* transport | r_processus>instr | camion
* communication | r_processus>instr | téléphone

### Intensification / Magnification (`r_has_magn`)
Indique un terme ou une expression qui intensifie le sens du terme source.
* fièvre | r_has_magn | fièvre de cheval
* peur | r_has_magn | peur bleue
* amour | r_has_magn | amour fou

### Logical Implication (`r_implication`)
Indique ce qu'un terme implique logiquement ou nécessairement.
* ronfler | r_implication | dormir
* courir | r_implication | se déplacer
* câlin | r_implication | contact physique

### Similar-To (`r_similar`)
Relie des termes qui se ressemblent ou présentent une forte similarité sans être synonymes.
* congre | r_similar | anguille
* zèbre | r_similar | cheval
* orange | r_similar | mandarine

### Has-Instance (`r_has_instance`)
Relie un type général à une instance c'est-à-dire une entité nommée spécifique.
* cheval | r_has_instance | Jolly Jumper
* transatlantique | r_has_instance | Titanic
* ville | r_has_instance | Paris

### Set-to-Item (`r_set>item`)
Désigne l'élément type qui compose un ensemble ou un collectif.
* essaim | r_set>item | abeille
* forêt | r_set>item | arbre
* foule | r_set>item | personne

### Item-to-Set (`r_item>set`)
Désigne l'ensemble ou le collectif composé par l'élément (inverse de r_set>item).
* abeille | r_item>set | essaim
* arbre | r_item>set | forêt
* soldat | r_item>set | armée

### Promotion / Favors (`r_promote`)
Indique ce que le terme source favorise ou encourage.
* catalyseur | r_promote | réaction chimique
* engrais | r_promote | croissance
* étude | r_promote | réussite

### Domain / Field (`r_domain`)
Spécifie le domaine d'activité ou de connaissance auquel appartient le terme.
* corner | r_domain | football
* scalpel | r_domain | chirurgie
* octave | r_domain | musique



## 8. Relations Inverses des Actants

### Characteristic-Of (`r_carac-1`)
Inverse de r_carac : à partir d'une caractéristique, énumère les objets qui la possèdent typiquement.
* chaud | r_carac-1 | soleil
* liquide | r_carac-1 | eau
* acide | r_carac-1 | citron

### Action-Of-Agent (`r_agent-1`)
Inverse de r_agent : à partir d'un sujet, énumère les actions qu'il peut effectuer.
* chat | r_agent-1 | miauler
* oiseau | r_agent-1 | voler
* sportif | r_agent-1 | courir

### Action-On-Patient (`r_patient-1`)
Inverse de r_patient : à partir d'un objet, énumère les actions que l'on peut lui appliquer.
* pomme | r_patient-1 | manger
* voiture | r_patient-1 | réparer
* livre | r_patient-1 | lire

### Use-Of-Instrument (`r_instr-1`)
Inverse de r_instr : à partir d'un instrument, énumère les actions qu'il permet de réaliser.
* scie | r_instr-1 | scier
* couteau | r_instr-1 | couper
* stylo | r_instr-1 | écrire

### Located-In (`r_lieu-1`)
Inverse de r_lieu : à partir d'un lieu, énumère ce qui s'y trouve typiquement.
* Paris | r_lieu-1 | tour Eiffel
* potager | r_lieu-1 | carotte
* mer | r_lieu-1 | poisson

### Domain-To-Term (`r_domain-1`)
Inverse de r_domain : à partir d'un domaine, énumère les termes qui en relèvent.
* football | r_domain-1 | corner
* chirurgie | r_domain-1 | scalpel
* musique | r_domain-1 | octave

### Manner-To-Action (`r_manner-1`)
Inverse de r_manner : à partir d'une manière, énumère les actions qui peuvent s'effectuer ainsi.
* rapidement | r_manner-1 | courir
* goulûment | r_manner-1 | manger
* silencieusement | r_manner-1 | marcher

### Property-To-Owner (`r_has_prop-1`)
Inverse de r_has_prop : à partir d'une propriété, énumère les objets qui la possèdent.
* puissance | r_has_prop-1 | moteur
* prix | r_has_prop-1 | voiture
* poids | r_has_prop-1 | objet

### Promoted-By (`r_promote-1`)
Inverse de r_promote : indique ce qui favorise le terme cible.
* réaction chimique | r_promote-1 | catalyseur
* croissance | r_promote-1 | engrais
* réussite | r_promote-1 | étude

### Quantified-By (`r_quantificateur-1`)
Inverse de r_quantificateur : à partir d'un quantificateur, énumère les termes qu'il quantifie.
* grain | r_quantificateur-1 | sucre
* pincée | r_quantificateur-1 | sel
* brin | r_quantificateur-1 | herbe

### Sentiment-To-Term (`r_sentiment-1`)
Inverse de r_sentiment : à partir d'un sentiment, énumère les termes qui l'évoquent.
* joie | r_sentiment-1 | cadeau
* peur | r_sentiment-1 | araignée
* tristesse | r_sentiment-1 | échec

### Opposed-By (`r_against-1`)
Inverse de r_against : indique ce qui combat ou empêche le terme cible.
* maladie | r_against-1 | médicament
* pluie | r_against-1 | parapluie
* bactérie | r_against-1 | antibiotique

### Purpose-To-Action (`r_but-1`)
Inverse de r_but : à partir d'un but, énumère les actions qui visent ce but.
* santé | r_but-1 | courir
* argent | r_but-1 | travailler
* récupération | r_but-1 | dormir

### Quantifier (`r_quantificateur`)
Désigne le quantificateur typique pour un terme, indiquant une quantité.
* sucre | r_quantificateur | grain
* sel | r_quantificateur | pincée
* herbe | r_quantificateur | brin

### Is-Instance-Of (`r_is_instance_of`)
Inverse de r_has_instance : relie une instance nommée à son type général.
* Jolly Jumper | r_is_instance_of | cheval
* Titanic | r_is_instance_of | transatlantique
* Paris | r_is_instance_of | ville

### Disease-To-Symptom-Inv (`r_symptomes-1`)
Inverse de r_has_symptomes : à partir d'un symptôme, énumère les maladies associées.
* boutons | r_symptomes-1 | rougeole
* yeux rouges | r_symptomes-1 | myxomatose
* fièvre | r_symptomes-1 | grippe

### Works-By-Author (`r_has_auteur-1`)
Inverse de r_has_auteur : à partir d'un auteur, énumère ses œuvres.
* Victor Hugo | r_has_auteur-1 | Les Misérables
* Molière | r_has_auteur-1 | Le Misanthrope
* Rimbaud | r_has_auteur-1 | Le Bateau ivre

### Consumed-By (`r_can_eat-1`)
Inverse de r_can_eat : à partir d'une nourriture, énumère qui peut la consommer.
* herbe | r_can_eat-1 | vache
* souris | r_can_eat-1 | chat
* graine | r_can_eat-1 | oiseau

## 9. Relations Morphologiques et Lexicales

### Lexical-Family (`r_family`)
Relie des termes appartenant à la même famille lexicale par dérivation morphologique.
* lait | r_family | laitier
* jardin | r_family | jardinage
* livre | r_family | librairie

### Lemma (`r_lemma`)
Indique la forme lemmatisée (forme canonique) du terme.
* mangent | r_lemma | manger
* avions | r_lemma | avion
* chevaux | r_lemma | cheval

### Part-Of-Speech (`r_pos`)
Indique la partie du discours (nom, verbe, adjectif, adverbe, etc.).
* manger | r_pos | Ver:Inf
* chat | r_pos | Nom:Com
* rapidement | r_pos | Adv

### Morphological-Derivation (`r_der_morpho`)
Désigne des termes dérivés morphologiquement à partir du terme source.
* jardin | r_der_morpho | jardinier
* lait | r_der_morpho | laitage
* feu | r_der_morpho | feutré

### Variant (`r_variante`)
Indique des variantes orthographiques ou typographiques d'un même terme.
* yaourt | r_variante | yahourt
* événement | r_variante | évènement
* clef | r_variante | clé

### Singular-Form (`r_sing_form`)
Indique la forme au singulier du terme.
* chevaux | r_sing_form | cheval
* yeux | r_sing_form | œil
* travaux | r_sing_form | travail

### Locution / Expression (`r_locution`)
Énumère les locutions, expressions ou mots composés contenant le terme.
* moulin | r_locution | moulin à vent
* vendre | r_locution | vendre la peau de l'ours
* pied | r_locution | mettre les pieds dans le plat

### Equivalent (`r_equiv`)
Relie des termes strictement équivalents : acronymes, sigles, apocopes, entités nommées (? synonymes).
* PS | r_equiv | parti socialiste
* ciné | r_equiv | cinéma
* Louis XIV | r_equiv | Le roi soleil

### Strict-Synonym (`r_syn_strict`)
Termes strictement substituables, notamment pour la terminologie technique ou spécialisée.
* endométriose intra-utérine | r_syn_strict | adénomyose
* infarctus | r_syn_strict | crise cardiaque
* tension artérielle | r_syn_strict | pression artérielle

### Homophone (`r_homophone`)
Relie des termes prononcés de façon identique ou quasi identique.
* ver | r_homophone | verre
* sang | r_homophone | cent
* cou | r_homophone | coup

### Potential-Confusion (`r_potential_confusion_with`)
Indique un terme avec lequel une confusion fréquente est possible.
* âcre | r_potential_confusion_with | acre
* détoner | r_potential_confusion_with | détonner
* censé | r_potential_confusion_with | sensé

### Masculine-Form (`r_masc`)
Indique l'équivalent masculin du terme.
* lionne | r_masc | lion
* vache | r_masc | taureau
* actrice | r_masc | acteur

### Feminine-Form (`r_fem`)
Indique l'équivalent féminin du terme.
* lion | r_fem | lionne
* acteur | r_fem | actrice
* boulanger | r_fem | boulangère

### Alias (`r_alias`)
Indique que les deux termes sont identiques, le second étant un alias du premier (synchronisation).
* USA | r_alias | États-Unis
* GB | r_alias | Royaume-Uni
* ONU | r_alias | Organisation des Nations Unies

### Preferred-Form (`r_pref_form`)
Indique la forme préférée parmi plusieurs graphies ou variantes possibles.
* évènement | r_pref_form | événement
* clé | r_pref_form | clef
* nénufar | r_pref_form | nénuphar

## 10. Dérivations Verbales, Adjectivales et Adverbiales

### Verb-To-Action (`r_verbe-action`)
Du verbe vers le nom d'action dérivé (même racine).
* construire | r_verbe-action | construction
* jardiner | r_verbe-action | jardinage
* nettoyer | r_verbe-action | nettoyage

### Action-To-Verb (`r_action-verbe`)
Inverse de r_verbe-action : du nom d'action vers le verbe correspondant.
* construction | r_action-verbe | construire
* jardinage | r_action-verbe | jardiner
* nettoyage | r_action-verbe | nettoyer

### Adjective-To-Verb (`r_adj-verbe`)
Pour un adjectif de potentialité, donne le verbe correspondant.
* lavable | r_adj-verbe | laver
* mangeable | r_adj-verbe | manger
* lisible | r_adj-verbe | lire

### Verb-To-Adjective (`r_verbe-adj`)
Pour un verbe, donne l'adjectif de potentialité correspondant.
* laver | r_verbe-adj | lavable
* manger | r_verbe-adj | mangeable
* lire | r_verbe-adj | lisible

### Adjective-To-Property-Noun (`r_adj-nomprop`)
Pour un adjectif, donne le nom de propriété correspondant.
* friable | r_adj-nomprop | friabilité
* fragile | r_adj-nomprop | fragilité
* rapide | r_adj-nomprop | rapidité

### Property-Noun-To-Adjective (`r_nomprop-adj`)
Pour un nom de propriété, donne l'adjectif correspondant.
* friabilité | r_nomprop-adj | friable
* fragilité | r_nomprop-adj | fragile
* rapidité | r_nomprop-adj | rapide

### Adjective-To-Adverb (`r_adj-adv`)
Pour un adjectif, donne l'adverbe correspondant.
* rapide | r_adj-adv | rapidement
* lent | r_adj-adv | lentement
* franc | r_adj-adv | franchement

### Adverb-To-Adjective (`r_adv-adj`)
Pour un adverbe, donne l'adjectif correspondant.
* rapidement | r_adv-adj | rapide
* lentement | r_adv-adj | lent
* franchement | r_adv-adj | franc

### Adjective-To-Noun (`r_adj>nom`)
Donne le nom associé à un adjectif.
* urinaire | r_adj>nom | urine
* solaire | r_adj>nom | soleil
* lunaire | r_adj>nom | lune

### Noun-To-Adjective (`r_nom>adj`)
Donne l'adjectif associé à un nom.
* urine | r_nom>adj | urinaire
* soleil | r_nom>adj | solaire
* lune | r_nom>adj | lunaire

### Verb-Doer (`r_verb_real`)
Pour un verbe, donne le nom de celui qui réalise l'action (dérivation morphologique).
* chasser | r_verb_real | chasseur
* naviguer | r_verb_real | navigateur
* enseigner | r_verb_real | enseignant

### Past-Participle (`r_verb_ppas`)
Donne le participe passé (masculin singulier) du verbe.
* manger | r_verb_ppas | mangé
* finir | r_verb_ppas | fini
* prendre | r_verb_ppas | pris

### Present-Participle (`r_verb_ppre`)
Donne le participe présent du verbe.
* manger | r_verb_ppre | mangeant
* finir | r_verb_ppre | finissant
* prendre | r_verb_ppre | prenant

### Auxiliary (`r_verb_aux`)
Indique l'auxiliaire utilisé pour conjuguer le verbe aux temps composés.
* manger | r_verb_aux | avoir
* aller | r_verb_aux | être
* tomber | r_verb_aux | être

### Active-Voice (`r_activ_voice`)
Pour un verbe à la voix passive, donne sa voix active.
* être mangé | r_activ_voice | manger
* être lu | r_activ_voice | lire
* être construit | r_activ_voice | construire

## 11. Relations Actancielles Complémentaires

### Manner (`r_manner`)
Indique de quelle manière (adverbe ou locution adverbiale) une action peut être effectuée.
* manger | r_manner | goulûment
* courir | r_manner | rapidement
* parler | r_manner | doucement

### Provider / Pourvoyeur (`r_pourvoyeur`)
Désigne l'entité qui fournit l'objet de l'action (complément introduit par 'à').
* demander | r_pourvoyeur | serveur
* emprunter | r_pourvoyeur | banque
* acheter | r_pourvoyeur | vendeur

### Agent-Complement (`r_compl_agent`)
Désigne celui qui effectue l'action dans une forme passive.
* être mangé | r_compl_agent | chat
* être écrit | r_compl_agent | auteur
* être construit | r_compl_agent | maçon

### Beneficiary (`r_has_beneficiaire`)
Désigne l'entité qui tire bénéfice ou préjudice de l'action.
* donner | r_has_beneficiaire | destinataire
* offrir | r_has_beneficiaire | invité
* léguer | r_has_beneficiaire | héritier

### Agentive-Role (`r_agentif_role`)
Énumère les verbes transitifs qui donnent naissance à l'entité désignée par le terme.
* maison | r_agentif_role | construire
* livre | r_agentif_role | rédiger
* tableau | r_agentif_role | peindre

### Agentive-Implication (`r_agentive_implication`)
Désigne les étapes nécessaires à la création de l'objet (rôle agentif détaillé).
* livre | r_agentive_implication | imprimer
* livre | r_agentive_implication | relier
* pain | r_agentive_implication | pétrir

### Meaning / Gloss (`r_meaning/glose`)
Énumère les sens ou significations possibles du terme (gloses désambiguïsantes).
* police | r_meaning/glose | forces de l'ordre
* police | r_meaning/glose | police typographique
* avocat | r_meaning/glose | fruit tropical

### Nominal-Characteristic (`r_carac_nominale`)
Énumère les caractéristiques nominales (noms) possibles ou typiques pour le terme.
* stylo | r_carac_nominale | bille
* stylo | r_carac_nominale | feutre
* table | r_carac_nominale | rectangulaire

## 12. Successions et Précédences

### Time-Predecessor (`r_has_predecesseur-time`)
Indique ce qui précède chronologiquement le terme source.
* nuit | r_has_predecesseur-time | jour
* été | r_has_predecesseur-time | printemps
* jour de l'an | r_has_predecesseur-time | Noël

### Space-Predecessor (`r_has_predecesseur-space`)
Indique ce qui précède spatialement le terme source.
* wagon | r_has_predecesseur-space | locomotive
* dessert | r_has_predecesseur-space | plat principal
* mer | r_has_predecesseur-space | plage

### Space-Successor (`r_has_successeur-space`)
Indique ce qui suit spatialement le terme source.
* locomotive | r_has_successeur-space | wagon
* plat principal | r_has_successeur-space | dessert
* plage | r_has_successeur-space | mer

### Logic-Predecessor (`r_has_predecesseur-logic`)
Indique ce qui précède logiquement le terme source.
* conclusion | r_has_predecesseur-logic | prémisse
* effet | r_has_predecesseur-logic | cause
* résultat | r_has_predecesseur-logic | calcul

### Logic-Successor (`r_has_successeur-logic`)
Indique ce qui suit logiquement le terme source.
* prémisse | r_has_successeur-logic | conclusion
* cause | r_has_successeur-logic | effet
* calcul | r_has_successeur-logic | résultat

### Narration-Next (`r_narration_next`)
Indique l'événement ou le fait qui suit dans la narration (distinct du successeur temporel/logique).
* exposition | r_narration_next | péripétie
* crime | r_narration_next | enquête
* rencontre | r_narration_next | mariage

### Time-Value (`r_time`)
Associe au terme la valeur temporelle (moment) qui lui est typique.
* dormir | r_time | nuit
* bronzer | r_time | été
* fatigue | r_time | soir

### Location-To-Action (`r_lieu_action`)
À partir d'un lieu, énumère les actions typiques qui peuvent s'y dérouler.
* école | r_lieu_action | étudier
* cuisine | r_lieu_action | cuisiner
* lit | r_lieu_action | dormir

### Action-To-Location (`r_action_lieu`)
À partir d'une action, énumère les lieux typiques où elle peut être réalisée.
* étudier | r_action_lieu | école
* cuisiner | r_action_lieu | cuisine
* dormir | r_action_lieu | chambre

## 13. Production, Possession et Usage

### Product-Of (`r_product_of`)
Indique de qui ou de quoi le terme est le résultat ou le produit.
* miel | r_product_of | abeille
* pain | r_product_of | boulanger
* lait | r_product_of | vache

### Material-To-Object (`r_mater>object`)
Inverse de r_object>mater : à partir d'une matière, énumère les choses qui en sont composées.
* bois | r_mater>object | poutre
* or | r_mater>object | bague
* marbre | r_mater>object | statue

### Owns (`r_own`)
Indique ce que possède le terme source.
* soldat | r_own | fusil
* cavalière | r_own | bottes
* roi | r_own | couronne

### Owned-By (`r_own-1`)
Inverse de r_own : indique le possesseur du terme source.
* fusil | r_own-1 | soldat
* bottes | r_own-1 | cavalière
* couronne | r_own-1 | roi

### Makes-Use-Of (`r_make_use_of`)
Indique qu'un terme peut utiliser un objet ou un produit pour fonctionner.
* frigo | r_make_use_of | électricité
* voiture | r_make_use_of | essence
* ordinateur | r_make_use_of | énergie

### Is-Used-By (`r_is_used_by`)
Inverse de r_make_use_of : indique par quoi le terme est utilisé.
* essence | r_is_used_by | voiture
* électricité | r_is_used_by | frigo
* eau | r_is_used_by | plante

### Can-Eat (`r_can_eat`)
Indique de quoi peut se nourrir l'entité.
* vache | r_can_eat | herbe
* chat | r_can_eat | souris
* oiseau | r_can_eat | graine

### Interact-With (`r_interact_with`)
Indique avec quoi le terme peut interagir.
* clé | r_interact_with | serrure
* enfant | r_interact_with | jouet
* utilisateur | r_interact_with | logiciel

### Requires (`r_require`)
Énumère les termes nécessaires au terme cible pour exister ou fonctionner.
* se reposer | r_require | calme
* pain | r_require | farine
* feu | r_require | combustible

### Descends-From (`r_descend_de`)
Indique une filiation évolutive ou un ancêtre dont descend le terme.
* homme | r_descend_de | primate
* français | r_descend_de | latin
* oiseau | r_descend_de | dinosaure

## 14. Comparaison et Intensité

### Associated (`r_associated`)
Désigne les termes les plus étroitement associés (association libre).
* été | r_associated | plage
* livre | r_associated | lecture
* nuit | r_associated | sommeil

### Co-Hyponym (`r_cohypo`)
Relie des termes partageant le même hyperonyme (frères sémantiques).
* chat | r_cohypo | tigre
* pomme | r_cohypo | poire
* voiture | r_cohypo | camion

### Bigger-Than (`r_is_bigger_than`)
Indique ce qui est physiquement moins gros que le terme source (le source est plus gros).
* éléphant | r_is_bigger_than | souris
* maison | r_is_bigger_than | voiture
* baleine | r_is_bigger_than | dauphin

### Smaller-Than (`r_is_smaller_than`)
Indique ce qui est physiquement plus gros que le terme source (le source est plus petit).
* souris | r_is_smaller_than | éléphant
* voiture | r_is_smaller_than | maison
* dauphin | r_is_smaller_than | baleine

### Antimagnification (`r_has_antimagn`)
Indique un terme atténuant le sens du terme source (opposé de la magnification).
* pluie | r_has_antimagn | bruine
* peur | r_has_antimagn | appréhension
* colère | r_has_antimagn | agacement

### Euphemism (`r_has_euphemisme`)
Indique une formulation moins intense ou édulcorée du terme source.
* mourir | r_has_euphemisme | s'éteindre
* être mort | r_has_euphemisme | être fatigué
* licencier | r_has_euphemisme | se séparer de

## 15. Incompatibilités et Exclusions

### Isa-Incompatible (`r_isa-incompatible`)
Indique que deux génériques sont incompatibles : un même terme ne peut appartenir aux deux (sauf polysémie).
* poisson | r_isa-incompatible | oiseau
* mammifère | r_isa-incompatible | reptile
* végétal | r_isa-incompatible | minéral

### Incompatible (`r_incompatible`)
Indique des termes qui ne doivent pas être présents ensemble.
* alcool | r_incompatible | antibiotique
* eau | r_incompatible | feu
* huile | r_incompatible | eau

### Inhibits (`r_inhib`)
Indique que le terme inhibe ou tend à exclure d'autres termes associés.
* silence | r_inhib | bruit
* lumière | r_inhib | obscurité
* paix | r_inhib | guerre

## 16. Domaines Spécifiques

### Has-Author (`r_has_auteur`)
Indique l'auteur d'une œuvre.
* Les Misérables | r_has_auteur | Victor Hugo
* Le Misanthrope | r_has_auteur | Molière
* Hamlet | r_has_auteur | Shakespeare

### Has-Character (`r_has_personnage`)
Énumère les personnages présents dans une œuvre.
* Astérix | r_has_personnage | Obélix
* Tintin | r_has_personnage | Milou
* Harry Potter | r_has_personnage | Hermione

### Has-Actor (`r_has_actors`)
Indique les acteurs d'un film ou d'une œuvre similaire.
* Le Parrain | r_has_actors | Marlon Brando
* Titanic | r_has_actors | Leonardo DiCaprio
* Les Tontons flingueurs | r_has_actors | Lino Ventura

### Has-Interpreter (`r_has_interpret`)
Indique l'interprète d'un personnage au cinéma ou au théâtre.
* James Bond | r_has_interpret | Sean Connery
* Harry Potter | r_has_interpret | Daniel Radcliffe
* Don Juan | r_has_interpret | Michel Piccoli

### Disease-Target (`r_has_cible`)
Indique la cible typique d'une maladie.
* myxomatose | r_has_cible | lapin
* rougeole | r_has_cible | enfant
* prostatite | r_has_cible | homme

### Has-Symptoms (`r_has_symptomes`)
Énumère les symptômes d'une maladie.
* rougeole | r_has_symptomes | boutons
* grippe | r_has_symptomes | fièvre
* myxomatose | r_has_symptomes | yeux rouges

### Has-Diagnostic (`r_has_diagnostic`)
Indique le moyen de diagnostic d'une maladie.
* diabète | r_has_diagnostic | prise de sang
* rougeole | r_has_diagnostic | examen clinique
* fracture | r_has_diagnostic | radiographie

### Locomotion-Mode (`r_deplac_mode`)
Indique le mode de déplacement d'une entité.
* chat | r_deplac_mode | marche
* oiseau | r_deplac_mode | vol
* poisson | r_deplac_mode | nage

### Has-Topic (`r_has_topic`)
Indique le thème lié à l'objet de départ.
* restaurant | r_has_topic | sushis
* magazine | r_has_topic | bande dessinée
* émission | r_has_topic | politique

### Can-Measure (`r_can_measure`)
Indique ce que peut mesurer un instrument ou un objet.
* thermomètre | r_can_measure | température
* baromètre | r_can_measure | pression
* balance | r_can_measure | poids

### Has-Units (`r_units`)
Indique les unités associées à une propriété ou une mesure.
* vitesse | r_units | km/h
* poids | r_units | kg
* longueur | r_units | mètre

### Has-Value (`r_has_value`)
Associe une valeur à une propriété ou à un objet.
* température corporelle | r_has_value | 37°C
* vitesse de la lumière | r_has_value | 300000 km/s
* pH neutre | r_has_value | 7

### Has-Circumstances (`r_has_circumstances`)
Indique les circonstances possibles d'un événement ou d'un objet.
* mort | r_has_circumstances | fusillade
* accident | r_has_circumstances | verglas
* rencontre | r_has_circumstances | hasard

### Origin-Place (`r_lieu>origine`)
Indique le lieu d'origine du terme.
* saucisse de Toulouse | r_lieu>origine | Toulouse
* champagne | r_lieu>origine | Champagne
* roquefort | r_lieu>origine | Roquefort

### Depicts (`r_depict`)
Indique ce que représente une image, une photo ou une œuvre.
* photo | r_depict | personne
* tableau | r_depict | paysage
* statue | r_depict | héros

### Social-Tie (`r_has_social_tie_with`)
Indique une relation sociale ou familiale entre individus.
* Julie Depardieu | r_has_social_tie_with | Gérard Depardieu
* père | r_has_social_tie_with | fils
* époux | r_has_social_tie_with | épouse

### Tributary (`r_tributary`)
Indique une dépendance physique ou spatiale (notamment hydrographique).
* Marne | r_tributary | Seine
* Saône | r_tributary | Rhône
* satellite | r_tributary | planète

## 17. Relations Sémantiques Diverses

### Semantic-Refinement (`r_raff_sem`)
Désigne un raffinement sémantique vers un usage particulier du terme source (gestion de la polysémie).
* avocat | r_raff_sem | avocat>fruit
* avocat | r_raff_sem | avocat>juriste
* souris | r_raff_sem | souris>animal

### Semantic-Refinement-Inv (`r_raff_sem-1`)
Inverse de r_raff_sem : relie un sens spécifique au terme source polysémique.
* avocat>fruit | r_raff_sem-1 | avocat
* avocat>juriste | r_raff_sem-1 | avocat
* souris>animal | r_raff_sem-1 | souris

### Morphological-Refinement (`r_raff_morpho`)
Désigne un raffinement morphologique vers un usage particulier du terme source.
* manger | r_raff_morpho | manger>infinitif
* chat | r_raff_morpho | chat>singulier
* bleu | r_raff_morpho | bleu>masculin

### Linked-With (`r_linked-with`)
Indique à quoi un terme est physiquement ou conceptuellement relié.
* wagon | r_linked-with | locomotive
* satellite | r_linked-with | planète
* maillon | r_linked-with | chaîne

### Concerning (`r_concerning`)
Indique ce que le terme concerne ou à quoi il s'applique.
* maladie | r_concerning | personne
* disparition | r_concerning | emploi
* décret | r_concerning | citoyen

### Is-Concerned-By (`r_is_concerned_by`)
Inverse de r_concerning : indique ce par quoi le terme est concerné.
* personne | r_is_concerned_by | maladie
* employé | r_is_concerned_by | licenciement
* citoyen | r_is_concerned_by | décret

### Functor (`r_foncteur`)
Indique la fonction d'un terme (souvent une préposition) par rapport à d'autres.
* chez | r_foncteur | r_lieu
* avec | r_foncteur | r_instr
* pour | r_foncteur | r_but

### Domain-Substitution (`r_domain_subst`)
Indique les domaines de substitution quand le terme est utilisé comme domaine.
* muscle | r_domain_subst | anatomie du système musculaire
* cœur | r_domain_subst | cardiologie
* dent | r_domain_subst | odontologie

### Opinion-Of (`r_opinion_of`)
Indique l'opinion d'un groupe ou d'une personne (utilisé comme annotation).
* enfant | r_opinion_of | bonbon>positif
* adulte | r_opinion_of | impôt>négatif
* étudiant | r_opinion_of | examen>négatif

## 18. Annotations, Métadonnées et Ressources Externes

### Annotation (`r_annotation`)
Relation générale pour annoter d'autres relations.
* (chat r_agent miauler) | r_annotation | typique
* (lion r_lieu Afrique) | r_annotation | habitat naturel
* (eau r_carac chaude) | r_annotation | contextuel

### Annotation-Context (`r_annotation_context`)
Indique le contexte d'une relation annotée.
* (baguette r_accomp fromage) | r_annotation_context | repas français traditionnel
* (chat r_can_eat croquette) | r_annotation_context | alimentation domestique
* (oiseau r_deplac_mode marche) | r_annotation_context | au sol

### Annotation-Exception (`r_annotation_exception`)
Indique qu'une relation constitue une exception par rapport à la cible.
* (autruche r_agent-1 voler) | r_annotation_exception | oiseau
* (manchot r_agent-1 voler) | r_annotation_exception | oiseau
* (baleine r_isa poisson) | r_annotation_exception | mammifère

### Translation (`r_translation`)
Traduction du terme dans une autre langue.
* chat | r_translation | cat
* maison | r_translation | house
* livre | r_translation | book

### External-Link (`r_link`)
Lien vers une ressource externe (WordNet, RadLex, UMLS, Wikipedia, etc.).
* chat | r_link | wn:cat#n1
* infarctus | r_link | RadLex:RID5375
* Paris | r_link | wikipedia:Paris

### Wiki-Association (`r_wiki`)
Associations issues de Wikipedia.
* Napoléon | r_wiki | Waterloo
* Einstein | r_wiki | relativité
* Mona Lisa | r_wiki | Léonard de Vinci

### Aki-Association (`r_aki`)
Équivalent de l'association libre pour TOTAKI.
* mer | r_aki | sel
* nuit | r_aki | étoile
* feu | r_aki | chaleur

### POS-Sequence (`r_pos_seq`)
Indique la séquence de parties du discours d'une expression.
* belle maison | r_pos_seq | Adj:Nom
* manger vite | r_pos_seq | Ver:Adv
* le chat noir | r_pos_seq | Det:Nom:Adj

### Lexical-Data (`r_data`)
Informations diverses d'ordre lexical attachées au terme.
* chat | r_data | fréquence=élevée
* prendre | r_data | irrégulier
* hier | r_data | invariable
