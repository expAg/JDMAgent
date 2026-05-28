# Brief design — Refonte de la page Projet (onglet « Projet »)

## Contexte

L'onglet **Projet** de l'app FastAPI (branche `fastapi-migration`) avait
au départ un layout designer en hero + grille de feature cards. On a fait
évoluer le besoin vers un **système de panneaux pleine viewport** avec
une **navigation latérale par dots** et un **carousel horizontal** pour
les modules. Le résultat actuel a plusieurs défauts visuels qu'on
n'arrive pas à régler proprement en code seul — d'où ce brief.

## Le besoin actuel

### Trois panneaux, chacun en plein viewport

1. **Panneau 1 — Hero** : titre principal *« Agent Jarvis : Plateforme
   web. »*, paragraphe descriptif, 4 boutons CTA (Jarvis primary +
   Discuter / Visualiser / Explorer secondary), 4 stats numériques
   animées au hover.
2. **Panneau 2 — Modules** : SectionTitle *« Cinq modules · une seule
   API »* + un carousel horizontal de 5 cards (Jarvis primary +
   Chatbot LLM, Sous-graphe, Claim checker, Explorer).
3. **Panneau 3 — Sous le capot** : SectionTitle *« Le projet en bref »*
   + 4 cards de piliers techniques + footer institutionnel (crédit
   LIRMM / Mathieu Lafourcade / Équipe SLICE / lien GitHub).

Chaque panneau doit :
- Occuper exactement **une viewport (100vh − 56px navbar)**, ni plus ni moins.
- Avoir son **contenu centré verticalement** dans le panneau (centrage
  visuel — pas seulement géométrique).
- **Snap proprement** au scroll : un petit scroll → la page bascule
  sur le panneau suivant ou précédent.

### Navigation entre panneaux

- 3 **dots latéraux fixes à droite**, vertical-center. Le dot du
  panneau actif est colorisé.
- 1 **bouton « Revenir en haut »** fixed bottom-center, visible
  uniquement sur le 3ᵉ panneau.

### Carousel du panneau 2

- 5 cards de 280-340px de large, gap 14px → la rangée dépasse de
  la viewport, scroll horizontal nécessaire.
- **Cards à pleine largeur** : on ne troque PAS leur taille pour
  faire de la place aux boutons (les boutons doivent flotter par-dessus
  ou être à l'extérieur).
- **Bouton « précédent »** : à GAUCHE, **hors de la rangée**
  (dans la marge gauche du panneau).
- **Bouton « suivant »** : à DROITE, **par-dessus la dernière card
  visible**, avec un effet « estompé » (fade gradient depuis le bord
  droit) qui suggère qu'il y a plus de contenu — sans rendre la card
  illisible.
- **Animation de scroll** : interpolation ralentie, élégante (~900ms,
  ease-out quint), sans saccade, **scroll-snap désactivé pendant
  l'animation** puis réactivé.
- **Hover des cards** : lift de -2px + ombre colorée (`box-shadow
  0 6px 18px -8px <couleur accent>`). La couleur accent est différente
  par card (palette aléatoire jaune/orange/rouge/vert/cyan, sauf la
  Jarvis qui est en `var(--accent)`).

### Skin-aware

- Tout doit fonctionner identiquement en thème **Paper** (clair, fond
  crème `#efe9dc`) et **Lab** (sombre, fond `#181b22`). Les variables
  CSS utilisées : `--bg`, `--bg-card`, `--bg-elev`, `--ink`,
  `--ink-2`, `--ink-3`, `--line`, `--line-soft`, `--accent`,
  `--accent-soft`, `--jdm-yellow/orange/magenta/green/cyan`.

## Les défauts visuels actuels qu'on n'arrive pas à régler

### 1. Bleed à droite du carousel

Une bande verticale étroite est visible à droite du bouton « suivant »,
montrant la lisière de la card suivante (cf. capture). Plusieurs
tentatives :
- Gradient fade `var(--bg)` 84px puis 120px puis 180px : **insuffisant** —
  on voit toujours du contenu derrière.
- `overflow: hidden` sur un wrapper englobant : **clippe correctement**
  le bleed MAIS clippe aussi le hover lift des cards.

### 2. Hover lift / box-shadow clippé en haut

Quand on hover une card, elle remonte de 2px et son ombre colorée
s'étend ~6px au-dessus. Avec `overflow: hidden` sur le wrapper, cet
effet vertical est coupé. Sans `overflow: hidden`, le bleed à droite
revient.

Le compromis « `overflow-x: hidden; overflow-y: visible` » n'est pas
faisable en CSS standard (les deux deviennent `auto` automatiquement).
La propriété `overflow-clip-margin` est encore expérimentale.

### 3. Centrage vertical du contenu dans les panneaux

Avec `display: flex; justify-content: center` ou `display: grid;
place-content: center` sur un panneau qui contient SectionTitle +
carousel : le contenu paraît **trop bas** parce que le carousel pèse
visuellement, alors que géométriquement c'est centré. Le client veut
un centrage **visuel**, pas géométrique.

## Ce qu'on attend du designer

Une **proposition concrète** (mock, captures, ou patch CSS/JSX) pour :

1. Régler le bleed du carousel **sans** clipper le hover des cards.
   Pistes à explorer : `clip-path` custom, masque SVG, gradient plus
   intelligent (ex. avec stops alpha multi-étapes), repositionnement
   des boutons, etc.

2. Trouver un centrage vertical **visuellement** équilibré pour
   les panneaux 2 et 3 (titre + bloc large en dessous). Suggestion
   bienvenue : marge fixe en haut + flex-start ? Grille avec
   gridTemplateRows définissant un ratio précis ?

3. Optionnel : revoir entièrement la nav inter-panneaux si une
   approche plus élégante est possible (ex. fullpage.js,
   `scroll-snap-type: mandatory` strict, etc.).

## Fichiers à consulter / modifier

### Fichier principal de la page (à donner au designer)

```
static/webapp/views-projet.jsx
```

C'est LE fichier de la vue Projet : le composant `ViewProjet`, le
`FeaturesGrid` avec le carousel et ses boutons, le `FeatureCard` avec
le hover, le `PanelDots` (nav latérale), le `BackToTopBtn`, le
`StatsGrid` avec les tuiles animées au hover.

### Variables CSS et classes globales

```
static/index.html
```

Tout est dans la balise `<style>` du `<head>` : tokens de thème
(Paper / Lab), classe `.jdm-carousel`, classe `.jdm-prose`, etc.

### Composants partagés utilisés par la vue

```
static/webapp/shared.jsx
```

Contient `PageShell` (wrapper max-width 1320 padding 32 28 80),
`SectionTitle`, `Button`, `Card`, `Pill`, `JDMMark`, `Triplet`, `TopNav`.

## Comment tester en local

```bash
git clone https://github.com/expAg/JDMAgent.git
cd JDMAgent
git checkout fastapi-migration
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app_fastapi:app --reload --port 7860
# Ouvrir http://localhost:7860 dans le navigateur
# Aller sur l'onglet "Projet"
```

À chaque modification des fichiers `static/webapp/*.jsx`, relancer :

```bash
python scripts/build_bundle.py
```

(le bundle est servi par le navigateur, pas les fichiers source
individuels).
