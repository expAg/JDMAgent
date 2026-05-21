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
  <button onclick="network.fit({animation:true})">Recentrer</button>
  <button onclick="zoomBy(1.3)">Zoom +</button>
  <button onclick="zoomBy(0.77)">Zoom -</button>
</div>
<div id="net"></div>
<div class="legend">{{LEGEND}}</div>

<script>
const NODES_DATA = {{NODES_JSON}};
const EDGES_DATA = {{EDGES_JSON}};

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
network.once('stabilizationIterationsDone', () => {
  network.setOptions({ physics: { enabled: false } });
  network.fit({ animation: { duration: 400 } });
});
function zoomBy(factor) {
  const s = network.getScale();
  network.moveTo({ scale: s * factor, animation: { duration: 200 } });
}

// Hover : met en évidence le nœud survolé et ses voisins, estompe le reste.
// Les couleurs originales des arêtes (teintées par famille de relation + opacité
// dépendant du niveau) sont snapshottées une fois pour pouvoir être restaurées
// proprement au blur.
const allNodeIds = nodes.getIds();
const allEdgeIds = edges.getIds();
const _edgeBase = {};
edges.forEach(e => {
  _edgeBase[e.id] = {
    color: e.color ? { ...e.color } : { color: '#9e9e9e', opacity: 1 },
    font: e.font ? { ...e.font } : { color: '#555', size: 14, background: '#d4d7daee' }
  };
});

function highlight(focusId) {
  const connected = new Set(network.getConnectedNodes(focusId));
  connected.add(focusId);
  const connectedEdges = new Set(network.getConnectedEdges(focusId));
  nodes.update(allNodeIds.map(id => ({
    id,
    opacity: connected.has(id) ? 1 : 0.15,
    font: { color: connected.has(id) ? (id === 'ROOT' ? '#fff' : '#222') : '#bbb' }
  })));
  edges.update(allEdgeIds.map(id => {
    const base = _edgeBase[id];
    if (connectedEdges.has(id)) {
      // Mettre en avant : couleur originale, opacité pleine (même au niveau 2).
      return { id, color: { ...base.color, opacity: 1 }, font: base.font };
    }
    // Estomper fortement les arêtes hors voisinage.
    return {
      id,
      color: { color: '#e0e0e0', opacity: 0.25 },
      font: { color: '#ddd', size: 13, background: '#d4d7dacc' }
    };
  }));
}
function resetHighlight() {
  nodes.update(allNodeIds.map(id => ({ id, opacity: 1, font: { color: id === 'ROOT' ? '#fff' : '#222' } })));
  edges.update(allEdgeIds.map(id => {
    const base = _edgeBase[id];
    return { id, color: base.color, font: base.font };
  }));
}
network.on('hoverNode', p => highlight(p.node));
network.on('blurNode', resetHighlight);
</script>
</body>
</html>
"""
