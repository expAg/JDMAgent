# Construire une visualisation de sous-graphe JDM

Spécification pour transformer la démarche en outil MCP. Le fichier de référence est [plat_asiatique_subgraph.html](plat_asiatique_subgraph.html).

## 1. Source des données — outils MCP `jdm`

Tout est construit en interrogeant les outils du serveur MCP `jdm` (basés sur le dump JeuxDeMots du LIRMM/CNRS). Pour un terme racine `T` :

### Profondeur 1 — voisins directs de T, un appel par relation
- `disambiguate(T)` → si polysémique, on choisit un `sense_id` à explorer
- `get_hypernyms(T)` → `r_isa` (catégories)
- `get_hyponyms(T)` → `r_hypo` (exemples)
- `get_synonyms(T)` → `r_syn`
- `get_antonyms(T)` → `r_anto`
- `get_characteristics(T)` → `r_carac`
- `get_parts(T)` → `r_has_part`
- `get_locations(T)` → `r_lieu`
- `get_actions_on(T)` → `r_patient-1` (verbes dont T est COD)
- `get_relations_of_type(T, "r_domain")` et `get_relations_of_type(T, "r_associated")`

Chaque appel renvoie une liste `{source, relation, target, w, polarity}`.

**À conserver tel quel** :
- `target` : déjà décodé en français lisible — ne pas re-transformer.
- `w` : poids consensuel ; sert à filtrer (`w ≥ 25`) et à épaissir les arêtes.
- `polarity` : `"affirmation"` ou `"négation"` — à **ne pas mélanger**.

### Profondeur 2 — voisins de voisins
Pour chaque voisin sélectionné N (typiquement top-K par poids), relancer un sous-ensemble des mêmes outils — généralement `get_parts`, `get_locations`, `get_characteristics` — selon le type de N (un nom de plat → ingrédients + lieux ; un ingrédient → caractéristiques ; etc.).

## 2. Structure du graphe en mémoire

### Nœuds
Un par terme unique rencontré.
```json
{
  "id": "Y1",
  "label": "curry",
  "depth": 1,
  "kind": "hypo"
}
```
- `kind` est dérivé de la relation entrante : `center | isa | hypo | syn | anto | carac | part | lieu | verb | domain | assoc`.

### Arêtes
```json
{
  "from": "P",
  "to": "Y1",
  "relation": "r_hypo",
  "weight": 70,
  "polarity": "affirmation",
  "depth": 1
}
```
- Le `label` affiché concatène relation et poids, ex. `"r_hypo 70"`.
- `depth === 2` → tracer en pointillés gris.
- `polarity === "négation"` → préfixer le label « NON » et/ou utiliser une couleur dédiée (rouge). **Ne jamais traiter une négation comme une affirmation.**

### Filtrage
- Top-K par relation (ici K = 4 à 9 selon la relation).
- `w ≥ 25` par défaut (le seuil JDM standard pour exclure le bruit).
- Évite l'explosion combinatoire à profondeur 2.

## 3. Rendu (vis-network)

### Lib
`vis-network` via CDN (`https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js`). Moteur force-directed prêt à l'emploi, alternative possible : Cytoscape.js (même format JSON).

### Centre épinglé
Le nœud racine est fixé au centre :
```js
{ id:'P', x:0, y:0, fixed:{x:true,y:true}, mass:5 }
```
Les autres nœuds gravitent autour via le solver `forceAtlas2Based`.

### Paramètres physiques clés (à ajuster selon densité)
```js
forceAtlas2Based: {
  gravitationalConstant: -90,  // répulsion entre nœuds
  centralGravity: 0.05,        // attire l'ensemble vers le centre
  springLength: 110,           // longueur d'arête au repos — petit = compact
  springConstant: 0.12,
  avoidOverlap: 1
}
```

### Physique désactivée après stabilisation
```js
network.once('stabilizationIterationsDone', () => {
  network.setOptions({ physics:{ enabled:false } });
  network.fit({ animation:{ duration:400 } });
});
```
Le layout fige une fois calculé, ce qui rend les nœuds draggables sans rebondissement.

### Palette par type de relation
| Relation | Couleur (fond / bordure) |
|---|---|
| centre | `#212121` / `#000` (texte blanc) |
| `r_isa` | `#e3f2fd` / `#1976d2` (bleu) |
| `r_hypo` | `#e8f5e9` / `#388e3c` (vert) |
| `r_carac` | `#f3e5f5` / `#7b1fa2` (violet) |
| `r_has_part` | `#fff3e0` / `#ef6c00` (orange) |
| `r_lieu` | `#e0f7fa` / `#00838f` (cyan) |
| `r_patient-1` | `#fce4ec` / `#ad1457` (rose) |
| profondeur 2 | `#fafafa` / `#bdbdbd` (gris, arêtes pointillées) |

## 4. Interactions

### Zoom
- Molette : zoom natif vis-network (`zoomSpeed: 0.6`, `minZoom: 0.1`, `maxZoom: 4`).
- Boutons `Zoom +/−` : `network.moveTo({ scale: network.getScale() * factor })`.
- Bouton `Recentrer` : `network.fit({ animation:true })`.

### Hover — mise en évidence des voisins
```js
network.on('hoverNode', p => highlight(p.node));
network.on('blurNode', resetHighlight);
```
Dans `highlight(focusId)` :
1. `const connected = new Set(network.getConnectedNodes(focusId))` + ajouter `focusId`.
2. `network.getConnectedEdges(focusId)` → set des arêtes voisines.
3. `nodes.update(...)` : opacité 0.2 et texte gris pour tout ce qui n'est pas connecté.
4. `edges.update(...)` : couleur gris très clair pour les arêtes hors voisinage.

`resetHighlight` restaure les couleurs d'origine en relisant l'attribut `dashes` (profondeur 2) de chaque arête.

## 5. Recette pour en faire un outil MCP

### API proposée
```python
build_subgraph(
    term: str,
    depth: int = 2,
    top_k_per_relation: int = 6,
    min_weight: float = 25,
    relations: list[str] | None = None,  # défaut : jeu standard ci-dessus
    output: Literal["json", "html"] = "html"
) -> str
```

### Étapes
1. **Désambiguïsation** : `disambiguate(term)`. Si plusieurs sens forts, prendre le top par poids ou exposer un paramètre `sense_id`.
2. **Profondeur 1** : appels parallèles des ~10 outils listés en §1. Agréger en `{nodes, edges}`.
3. **Profondeur 2** : pour chaque voisin retenu (top-K par poids), choisir le sous-ensemble d'outils pertinent selon `kind`, relancer. Marquer les nœuds/arêtes `depth: 2`.
4. **Sérialisation** :
   - `output="json"` → retourner `{nodes, edges, root, stats}`.
   - `output="html"` → injecter les `DataSet` dans le template de [plat_asiatique_subgraph.html](plat_asiatique_subgraph.html) et retourner un fichier autonome.

### Format vis-network (cible)
```js
const nodes = new vis.DataSet([
  { id:'P', label:'plat asiatique', x:0, y:0, fixed:{x:true,y:true}, mass:5,
    color:{ background:'#212121', border:'#000' }, font:{ color:'#fff', size:28 } },
  { id:'Y1', label:'curry', color:{ background:'#e8f5e9', border:'#388e3c' },
    font:{ size:22 } },
  // ...
]);
const edges = new vis.DataSet([
  { from:'P', to:'Y1', label:'r_hypo 70', arrows:'to',
    color:{ color:'#9e9e9e' }, font:{ size:14 } },
  // depth 2 : dashes: true
]);
```

## 6. Pièges à connaître

- **Polysémie** : toujours `disambiguate` en premier. Pour les termes très ambigus (`avocat`, `souris`, `police`), interroger sur le `sense_id` plutôt que sur le terme nu — sinon on mélange des branches sans rapport. Cf. mémoire `feedback_jdm_disambiguate_first`.
- **Polarité négative** : `polarity === "négation"` est fréquente et porteuse de sens. Exemple réel : `plat asiatique | r_isa | cuisine asiatique` avec `w = -30, polarity="négation"` — JDM marque ici que le plat n'EST PAS la cuisine. La traiter comme une affirmation = erreur factuelle.
- **Artefacts d'héritage** : `canard laqué | r_has_part | plumage (w=146)` est hérité du canard vivant — incohérent avec le plat. Un filtre heuristique par cohérence sémantique aide, mais reste un travail manuel ou nécessite un LLM en post-traitement.
- **Lourdeur de profondeur 3** : limiter `depth` à 2 par défaut. Profondeur 3 → graphes illisibles et latence multipliée.
- **Doublons en français/anglais** : JDM mélange parfois `en:music`, `en:chorus` dans les résultats — filtrer le préfixe `en:` si on veut rester monolingue.
