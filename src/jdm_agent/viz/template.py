"""Template HTML autonome (vis-network) pour visualiser un sous-graphe JDM.

Le template est paramétré par cinq placeholders remplacés par `str.replace` :
- `{{TITLE}}`            — titre de la page (terme racine + profondeur)
- `{{SUBTITLE}}`         — sous-titre explicatif
- `{{LEGEND}}`           — HTML des chips de légende (relations actives)
- `{{NODES_JSON}}`       — tableau JSON de nœuds vis-network
- `{{EDGES_JSON}}`       — tableau JSON d'arêtes vis-network

Le rendu côté navigateur (physique forceAtlas2Based, hover highlight, zoom,
recentrage) reproduit fidèlement plat_asiatique_subgraph.html.
"""
from __future__ import annotations

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{{TITLE}}</title>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<style>
  /* Fond gris doux — un cran au-dessus du sombre précédent, pour ne pas
     écraser les couleurs des nœuds tout en restant reposant pour l'œil. */
  html, body { margin:0; padding:0; height:100%; background:#c8ccd0; font-family: system-ui, sans-serif; color:#1a1a1a; }
  header { padding:14px 20px; border-bottom:1px solid #a8acb0; background:#d4d7da; color:#1a1a1a; }
  h1 { margin:0; font-size:18px; }
  .sub { color:#3c4043; font-size:13px; margin-top:2px; }
  #net { width:100%; height: calc(100vh - 110px); background:#d4d7da; }
  #controls { position:absolute; top:70px; right:24px; z-index:10; display:flex; gap:6px; }
  #controls button { padding:6px 10px; border:1px solid #9aa0a6; background:#e8eaed; border-radius:6px; cursor:pointer; font-size:13px; color:#1a1a1a; font-weight:500; }
  #controls button:hover { background:#f1f3f4; }
  #btn-reset { background:#fff3e0; border-color:#a04500; }
  #btn-reset .rot { display:inline-block; }
  #btn-reset:hover .rot { animation: jdm-spin 0.7s linear; }
  @keyframes jdm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .legend { padding:8px 20px; font-size:12px; color:#202124; background:#d4d7da; border-top:1px solid #a8acb0; }
  .legend span { display:inline-block; padding:2px 8px; border-radius:4px; margin-right:8px; }
</style>
</head>
<body>
<header>
  <h1>{{TITLE}}</h1>
  <div class="sub">{{SUBTITLE}}</div>
</header>
<div id="controls">
  <button id="btn-reset" onclick="resetGraph()" style="display:none;"
          title="Revenir à l'état de départ">
    <span class="rot">&#x21bb;</span> Réinitialiser
  </button>
  <button id="btn-degree" onclick="toggleLowDegree()"
          title="Masquer les nœuds ayant moins de 2 arêtes">Masquer isolés</button>
  <button onclick="network.fit({animation:true})">Recentrer</button>
  <button onclick="zoomBy(1.3)">Zoom +</button>
  <button onclick="zoomBy(0.77)">Zoom -</button>
</div>
<div id="net"></div>
<div class="legend">{{LEGEND}}</div>

<script>
const NODES_DATA = {{NODES_JSON}};
const EDGES_DATA = {{EDGES_JSON}};

// Copies vierges pour le bouton "Réinitialiser" : les objets passés à
// vis.DataSet sont mutés par les .update() ultérieurs (fixed, x/y, hidden…),
// donc on en garde un instantané immuable.
const PRISTINE_NODES = JSON.parse(JSON.stringify(NODES_DATA));
const PRISTINE_EDGES = JSON.parse(JSON.stringify(EDGES_DATA));

const nodes = new vis.DataSet(NODES_DATA);
const edges = new vis.DataSet(EDGES_DATA);

const container = document.getElementById('net');
const data = { nodes, edges };
const options = {
  layout: { improvedLayout: true },
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -90,
      centralGravity: 0.05,
      springLength: 110,
      springConstant: 0.12,
      avoidOverlap: 1
    },
    stabilization: { iterations: 600 }
  },
  edges: { width: 1.4, selectionWidth: 3, hoverWidth: 2 },
  interaction: {
    hover: true, dragNodes: true, zoomView: true, zoomSpeed: 0.6,
    minZoom: 0.1, maxZoom: 4,
    hoverConnectedEdges: true, selectConnectedEdges: true
  },
  nodes: { borderWidth: 1.5, borderWidthSelected: 3 }
};
const network = new vis.Network(container, data, options);

// À chaque fin de stabilisation (chargement initial OU recentrage de
// gravité OU réinitialisation), on fige la physique et on recadre.
network.on('stabilizationIterationsDone', () => {
  network.setOptions({ physics: { enabled: false } });
  network.fit({ animation: { duration: 400 } });
});

function zoomBy(factor) {
  const s = network.getScale();
  network.moveTo({ scale: s * factor, animation: { duration: 200 } });
}

// ---------- État dynamique ----------
const INITIAL_CENTER = 'ROOT';   // nœud central d'origine
let currentCenter = 'ROOT';      // centre de gravité courant
let hideLowDegree = false;       // filtre "masquer isolés" actif ?

// ---------- Masquer les nœuds à moins de 2 arêtes ----------
function toggleLowDegree() {
  hideLowDegree = !hideLowDegree;
  const updates = nodes.getIds().map(id => {
    // Degré = nb total d'arêtes (entrantes + sortantes) sur le graphe.
    const deg = network.getConnectedEdges(id).length;
    const hide = hideLowDegree && id !== currentCenter && id !== INITIAL_CENTER && deg < 2;
    return { id, hidden: hide };
  });
  nodes.update(updates);
  document.getElementById('btn-degree').textContent =
    hideLowDegree ? 'Tout afficher' : 'Masquer isolés';
}

// ---------- Clic simple : centrer le nœud + cadrer ses connexions ----------
network.on('click', params => {
  if (params.nodes.length === 1) {
    const id = params.nodes[0];
    const fitIds = [id, ...network.getConnectedNodes(id)];
    network.fit({ nodes: fitIds, animation: { duration: 500 } });
  }
});

// ---------- Double-clic : faire du nœud le centre de gravité ----------
network.on('doubleClick', params => {
  if (params.nodes.length === 1) recenterGravity(params.nodes[0]);
});

function recenterGravity(newId) {
  if (newId === currentCenter) return;
  // Libère l'ancien centre (il pourra de nouveau bouger).
  nodes.update({ id: currentCenter, fixed: false, mass: 1 });
  // Fixe le nouveau centre au milieu, masse élevée.
  nodes.update({ id: newId, x: 0, y: 0, fixed: { x: true, y: true }, mass: 5 });
  currentCenter = newId;
  // Relance la physique pour réorganiser le graphe autour du nouveau centre.
  network.setOptions({ physics: { enabled: true } });
  network.stabilize();
  // Le bouton "Réinitialiser" devient disponible.
  document.getElementById('btn-reset').style.display = '';
}

// ---------- Réinitialiser à l'état de départ ----------
function resetGraph() {
  hideLowDegree = false;
  currentCenter = INITIAL_CENTER;
  // Recharge les DataSets depuis les copies vierges.
  nodes.clear();
  edges.clear();
  nodes.add(JSON.parse(JSON.stringify(PRISTINE_NODES)));
  edges.add(JSON.parse(JSON.stringify(PRISTINE_EDGES)));
  rebuildEdgeBase();
  document.getElementById('btn-degree').textContent = 'Masquer isolés';
  document.getElementById('btn-reset').style.display = 'none';
  network.setOptions({ physics: { enabled: true } });
  network.stabilize();
}

// ---------- Hover : met en évidence le nœud survolé et ses voisins ----------
// Les couleurs d'origine des arêtes (teintées par famille + opacité par
// niveau) sont snapshottées pour être restaurées proprement au blur.
let _edgeBase = {};
function rebuildEdgeBase() {
  _edgeBase = {};
  edges.forEach(e => {
    _edgeBase[e.id] = {
      color: e.color ? { ...e.color } : { color: '#9aa0a6', opacity: 1 },
      font: e.font ? { ...e.font } : { color: '#555', size: 14, background: '#d4d7daee' }
    };
  });
}
rebuildEdgeBase();

function highlight(focusId) {
  const connected = new Set(network.getConnectedNodes(focusId));
  connected.add(focusId);
  const connectedEdges = new Set(network.getConnectedEdges(focusId));
  nodes.update(nodes.getIds().map(id => ({
    id,
    opacity: connected.has(id) ? 1 : 0.15,
    font: { color: connected.has(id) ? (id === INITIAL_CENTER ? '#fff' : '#222') : '#bbb' }
  })));
  edges.update(edges.getIds().map(id => {
    const base = _edgeBase[id];
    if (connectedEdges.has(id)) {
      return { id, color: { ...base.color, opacity: 1 }, font: base.font };
    }
    return {
      id,
      color: { color: '#e0e0e0', opacity: 0.25 },
      font: { color: '#ddd', size: 13, background: '#d4d7dacc' }
    };
  }));
}
function resetHighlight() {
  nodes.update(nodes.getIds().map(id => ({
    id, opacity: 1, font: { color: id === INITIAL_CENTER ? '#fff' : '#222' }
  })));
  edges.update(edges.getIds().map(id => {
    const base = _edgeBase[id];
    return base ? { id, color: base.color, font: base.font } : { id };
  }));
}
network.on('hoverNode', p => highlight(p.node));
network.on('blurNode', resetHighlight);
</script>
</body>
</html>
"""
