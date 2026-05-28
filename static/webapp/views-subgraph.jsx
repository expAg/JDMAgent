// View: Sous-graphe — extract & visualise a term's neighbourhood via /api/subgraph.
// Deux formats : HTML interactif (iframe vis-network) par défaut, ou SVG natif.

const SUBGRAPH_DEFAULT_RELATIONS = [
  'r_isa', 'r_hypo', 'r_syn', 'r_anto',
  'r_carac', 'r_has_part', 'r_lieu', 'r_domain',
];
const SUBGRAPH_DEFAULT_D2 = ['r_isa', 'r_carac', 'r_has_part', 'r_lieu'];
const SUBGRAPH_DEFAULT_D3 = ['r_isa', 'r_has_part', 'r_carac'];
const SUBGRAPH_DEFAULT_D4 = ['r_isa', 'r_carac'];

const SUBGRAPH_ALL_RELATIONS = [
  ...SUBGRAPH_DEFAULT_RELATIONS,
  'r_has_color', 'r_agent', 'r_patient', 'r_instr',
  'r_telic_role', 'r_has_causatif', 'r_has_conseq',
  'r_patient-1', 'r_agent-1', 'r_associated',
];

// Mapping kind → couleur (utilisé par le rendu SVG).
const KIND_COLOR = {
  center: '#1a1a1a',
  isa:    '#1565c0', hypo:   '#2e7d32', syn:    '#558b2f', anto:   '#c62828',
  carac:  '#6a1b9a', part:   '#a04500', lieu:   '#00838f',
  verb:   '#ef6c00', domain: '#455a64', assoc:  '#757575',
};
const KIND_OF_REL = {
  r_isa: 'isa', r_hypo: 'hypo', r_syn: 'syn', r_anto: 'anto',
  r_carac: 'carac', r_has_part: 'part', r_lieu: 'lieu',
  'r_patient-1': 'verb', 'r_agent-1': 'verb',
  r_domain: 'domain', r_associated: 'assoc',
};

// Couleurs LIVE — vives, lisibles sur fond sombre (≠ KIND_COLOR qui est
// taillé pour le SVG sur fond clair). Utilisées pour les arêtes en
// mode LIVE et la légende.
const REL_COLOR_LIVE = {
  r_isa:        '#4ea1ff',   // bleu
  r_hypo:       '#5cd6a8',   // vert menthe
  r_syn:        '#a8e063',   // vert lime
  r_anto:       '#ff5c87',   // rose vif
  r_carac:      '#c084fc',   // violet
  r_has_part:   '#ffa94d',   // orange
  r_lieu:       '#22d3ee',   // cyan
  r_domain:     '#94a3b8',   // ardoise
  r_has_color:  '#fbbf24',   // jaune
  r_agent:      '#f97316',   // orange foncé
  r_patient:    '#ec4899',   // magenta
  r_instr:      '#06b6d4',   // teal
  r_telic_role: '#84cc16',   // lime
  r_has_causatif: '#dc2626', // rouge
  r_has_conseq: '#a78bfa',   // violet clair
  'r_patient-1': '#fb923c',  // orange clair
  'r_agent-1':  '#f59e0b',   // ambre
  r_associated: '#9ca3af',   // gris
  r_raff_sem:   '#e879f9',   // magenta clair
};
const REL_COLOR_DEFAULT = '#6b7280';
function relColor(rel) {
  return REL_COLOR_LIVE[rel] || REL_COLOR_DEFAULT;
}

// Convertit {nodes, edges} SSE en scénario HeroAnimation, en
// REPRODUISANT EXACTEMENT le pattern du scénario 'voiture' de la
// démo accueil (hero-animation.jsx) :
//
//   - centre au milieu (positions[center] = {0,0})
//   - depth-1 : posés en POLAIRE, angles répartis uniformément
//     autour du centre, dist = 110
//   - depth-2 : posés en POLAIRE, ANGLE PROCHE de leur parent
//     depth-1 (± offset léger pour les frères), dist = 180
//     → visuellement = "branches" qui sortent du centre
//   - depth-3+ : même logique, dist 240 puis 290
//
// `layout` :
//   'tree'  → angles depth-2+ clusterisés près du parent (arbre)
//   'rings' → angles depth-2+ uniformes sur leur anneau (cercles)
function buildLiveScenario(rootTerm, nodes, edges, layout = 'tree') {
  if (!nodes || nodes.length === 0) return null;

  // Centre = ROOT, ou le 1er nœud à défaut. center = LABEL (string)
  // car GraphCanvas indexe positions[g.center] par cette string.
  const centerNode = nodes.find(n => n.id === 'ROOT') || nodes[0];
  const center = centerNode.label || rootTerm;
  const centerId = centerNode.id;

  // Palette de branches — chaque depth-1 a sa couleur, héritée par
  // ses descendants → groupes lisibles comme la démo voiture.
  const BRANCH_COLORS = [
    'jdm-magenta', 'jdm-cyan', 'jdm-green', 'jdm-violet',
    'jdm-orange', 'jdm-yellow',
  ];

  // ──────────────────────────────────────────────────────────────
  // 1. Groupement par PROFONDEUR (utilise le champ depth du backend
  //    directement, fiable). Centre = depth 0 (ignoré).
  // ──────────────────────────────────────────────────────────────
  const byDepth = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    const d = Math.max(1, Math.min(Number(n.depth) || 1, 4));
    byDepth[d].push(n);
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Index parents : pour chaque nœud non-centre, trouver UN
  //    parent de profondeur strictement inférieure parmi les edges.
  //    On regarde les deux directions (from→to et to→from) parce
  //    que la subgraph BFS n'a pas toujours from=parent.
  // ──────────────────────────────────────────────────────────────
  const depthOfId = { [centerId]: 0 };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    depthOfId[n.id] = Math.max(1, Math.min(Number(n.depth) || 1, 4));
  }
  const parentOf = {};
  for (const e of edges || []) {
    const fa = depthOfId[e.from];
    const fb = depthOfId[e.to];
    if (fa === undefined || fb === undefined) continue;
    // L'extrémité de plus grande profondeur est l'enfant
    if (fb > fa && !(e.to in parentOf)) parentOf[e.to] = e.from;
    else if (fa > fb && !(e.from in parentOf)) parentOf[e.from] = e.to;
  }

  // ──────────────────────────────────────────────────────────────
  // 3. POSITIONNEMENT POLAIRE (angle, dist) — imite la démo voiture
  //    mais avec des distances qui s'adaptent au volume et au
  //    canvas élargi (viewBox 920×H en mode interactif).
  // ──────────────────────────────────────────────────────────────
  const d1Count = byDepth[1].length;
  // Distances de base — adaptées à un viewBox de 920×560 (LIVE).
  // Pour ≥ 12 nœuds en depth-1, on espace plus radialement et on
  // alterne légèrement la distance pour éviter le chevauchement
  // de labels longs.
  const RING_DIST = [
    0,
    d1Count >= 12 ? 220 : (d1Count >= 8 ? 200 : 180),
    320, 410, 470,
  ];
  const polar = { [centerId]: { angle: 0, dist: 0 } };
  const branchColorOf = { [centerId]: 'jdm-magenta' };

  // depth-1 : uniforme autour du centre. Alternance dist±18 sur les
  // index pairs/impairs quand il y a beaucoup de frères (≥ 8) →
  // les labels ne se collent plus dans la même couronne.
  const d1 = byDepth[1];
  d1.forEach((n, i) => {
    const angle = (i / Math.max(d1.length, 1)) * 360 - 90;
    const stagger = d1.length >= 8 ? (i % 2 === 0 ? -22 : 22) : 0;
    polar[n.id] = { angle, dist: RING_DIST[1] + stagger };
    branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
  });

  // depth-2/3/4 : pour chaque nœud, prendre l'angle du parent
  //   trouvé (ou un fallback uniforme) et y ajouter un offset.
  //   On regroupe les enfants par parent_id pour calculer l'offset.
  //   layout='rings' → angles uniformes (pas de cluster autour du parent).
  for (let depth = 2; depth <= 4; depth++) {
    const arr = byDepth[depth];
    if (arr.length === 0) continue;
    const dist = RING_DIST[Math.min(depth, 4)];

    if (layout === 'rings') {
      // CERCLES : uniforme sur l'anneau, comme demandé en mode Cercles.
      arr.forEach((n, i) => {
        const angle = (i / arr.length) * 360 - 90 + (depth - 1) * 15;
        polar[n.id] = { angle, dist };
        // Couleur = celle du parent si trouvé, sinon palette
        const pId = parentOf[n.id];
        branchColorOf[n.id] = (pId && branchColorOf[pId])
          || BRANCH_COLORS[i % BRANCH_COLORS.length];
      });
      continue;
    }

    // ARBRE : grouper par parent → angle parent ± offset
    const byParent = {};
    const orphans = [];
    for (const n of arr) {
      const pId = parentOf[n.id];
      if (pId && polar[pId] !== undefined) {
        if (!byParent[pId]) byParent[pId] = [];
        byParent[pId].push(n);
      } else {
        orphans.push(n);
      }
    }
    for (const pId of Object.keys(byParent)) {
      const kids = byParent[pId];
      const pAngle = polar[pId].angle;
      // Span d'ouverture : 26° par enfant, plafonné à 70°.
      const span = Math.min(70, Math.max(20, kids.length * 26));
      kids.forEach((n, i) => {
        const off = kids.length === 1
          ? 0
          : (i / (kids.length - 1)) * span - span / 2;
        polar[n.id] = { angle: pAngle + off, dist };
        branchColorOf[n.id] = branchColorOf[pId] || 'jdm-violet';
      });
    }
    // Orphelins : on les répartit dans les "trous angulaires" entre
    // les depth-1, sur l'anneau de leur profondeur.
    orphans.forEach((n, i) => {
      const angle = (i / Math.max(orphans.length, 1)) * 360 - 45;
      polar[n.id] = { angle, dist };
      branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
    });
  }

  // ──────────────────────────────────────────────────────────────
  // 4. Délais d'apparition — par vagues de profondeur
  // ──────────────────────────────────────────────────────────────
  const DELAY_PER_DEPTH = [0, 0.4, 1.8, 3.0, 4.0];
  const nodeDelays = { [centerId]: 0 };

  const liveNodes = [];
  // Tri par depth pour l'anim en vagues (depth 1 d'abord, etc.)
  const sortedNodes = nodes
    .filter(n => n.id !== centerId && polar[n.id] !== undefined)
    .sort((a, b) => (depthOfId[a.id] || 1) - (depthOfId[b.id] || 1));

  let perDepthCounter = {};
  sortedNodes.forEach((n) => {
    const d = depthOfId[n.id] || 1;
    perDepthCounter[d] = (perDepthCounter[d] || 0) + 1;
    const base = DELAY_PER_DEPTH[Math.min(d, 4)];
    const delay = base + perDepthCounter[d] * 0.08;
    nodeDelays[n.id] = delay;
    liveNodes.push({
      id: n.id,
      label: n.label || n.id,
      angle: polar[n.id].angle,
      dist: polar[n.id].dist,
      color: branchColorOf[n.id] || 'jdm-violet',
      delay,
      dim: d >= 2,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 5. Arêtes — remap le centre par son LABEL (cf. GraphCanvas)
  // ──────────────────────────────────────────────────────────────
  const remap = (id) => (id === centerId ? center : id);
  const known = (id) => id === centerId || polar[id] !== undefined;
  const liveEdges = (edges || [])
    .filter(e => known(e.from) && known(e.to))
    .map(e => ({
      from: remap(e.from),
      to:   remap(e.to),
      delay: Math.max(nodeDelays[e.from] || 0, nodeDelays[e.to] || 0) + 0.12,
      label: e.relation || '',
      // Couleur par TYPE DE RELATION (visible sur fond sombre).
      // Les négations passent en rouge dédié pour signal fort.
      color: e.negative ? '#ef4444' : relColor(e.relation),
      negative: !!e.negative,
      highlight: e.highlight !== false,
    }));

  return {
    id: 'live',
    question: '',
    streamChunks: [],
    graph: { center, nodes: liveNodes, edges: liveEdges },
  };
}


// Wrapper qui MEMOIZE le scenario pour ne pas recréer un nouvel objet
// à chaque render — sinon HeroAnimation re-trigger l'animation en
// boucle infinie (sa useEffect dépend de liveScenario par référence).
// Ajoute toutes les fonctionnalités de graphe communes :
//   - Zoom (boutons +/− + molette Alt/Ctrl)
//   - Pan (drag du canvas)
//   - Hover arête → surlignage + tooltip natif (from/relation/to/poids)
//   - Hover nœud → focus mode : arêtes connectées surlignées, reste dim
//   - Clic nœud → recentre le graphe sur ce terme (via onRecenter)
//   - Reset view (zoom 100% + pan 0,0)
//   - Légende dynamique par type de relation
function LiveAnimWrapper({ term, nodes, edges, layout, onRecenter }) {
  const scenario = React.useMemo(
    () => buildLiveScenario(term, nodes, edges, layout),
    [term, layout, (nodes || []).length, (edges || []).length,
     (nodes || [])[0]?.id, (nodes || [])[(nodes || []).length - 1]?.id]
  );

  // ── Zoom ──
  const [zoom, setZoom] = useState(1);
  // ── Pan ──
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = React.useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });

  const onWheel = (e) => {
    // Molette = zoom in/out — bloque le scroll uniquement si Alt/Ctrl
    // (sinon la page peut scroller normalement par-dessus le canvas).
    if (!(e.altKey || e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom(z => Math.max(0.4, Math.min(3, z + delta)));
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;          // bouton gauche uniquement
    if (e.target.closest('[data-node-bubble]')) return; // pas si on clique un nœud
    drag.current = { active: true, sx: e.clientX, sy: e.clientY,
                     px: pan.x, py: pan.y };
  };
  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.sx),
      y: drag.current.py + (e.clientY - drag.current.sy),
    });
  };
  const stopDrag = () => { drag.current.active = false; };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Recentre : clic nœud → relance la requête avec ce terme comme racine
  const handleNodeClick = React.useCallback((node) => {
    if (!onRecenter) return;
    // Le label est le texte affiché (déjà décodé côté backend)
    onRecenter(node.label || node.id);
  }, [onRecenter]);

  // Relations effectivement présentes dans les arêtes → légende dynamique
  const presentRels = React.useMemo(() => {
    const set = new Set();
    for (const e of edges || []) if (e.relation) set.add(e.relation);
    return Array.from(set).sort();
  }, [edges]);

  const cursor = drag.current.active ? 'grabbing' : 'grab';

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex',
                  flexDirection: 'column' }}>
      {/* Boutons d'action — overlay coin haut-droit */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 5,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: '+', title: 'Zoom +', onClick: () => setZoom(z => Math.min(3, z + 0.2)) },
          { label: '−', title: 'Zoom −', onClick: () => setZoom(z => Math.max(0.4, z - 0.2)) },
          { label: '⟲', title: 'Réinitialiser vue (zoom + pan)', onClick: resetView },
        ].map(b => (
          <button key={b.label}
            onClick={b.onClick}
            className="focus-ring"
            title={b.title}
            style={{
              width: 28, height: 28,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{b.label}</button>
        ))}
        <div className="mono" style={{
          marginTop: 2,
          fontSize: 9, color: 'var(--ink-3)',
          textAlign: 'center', letterSpacing: '0.05em',
        }}>{Math.round(zoom * 100)}%</div>
      </div>

      {/* Hint d'usage — overlay coin haut-gauche, discret */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 5,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid var(--line-soft)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 9, color: 'var(--ink-3)',
        pointerEvents: 'none',
        letterSpacing: '0.04em',
      }}>
        glisser : pan · Alt+molette : zoom · survoler : info · cliquer : recentrer
      </div>

      {/* Canvas zoomable + draggable */}
      <div
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          position: 'relative',
          cursor,
          userSelect: 'none',
        }}>
        <div style={{
          width: '100%', height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: drag.current.active
            ? 'none'
            : 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <HeroAnimation height={720} showChat={false}
                         liveScenario={scenario}
                         interactive={true}
                         onNodeClick={handleNodeClick} />
        </div>
      </div>

      {/* Légende — codage couleur par type de relation présente */}
      {presentRels.length > 0 && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--bg-elev)',
          display: 'flex', flexWrap: 'wrap', gap: 10,
          alignItems: 'center',
        }}>
          <span className="mono" style={{
            fontSize: 9, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Légende</span>
          {presentRels.map(r => (
            <span key={r} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--ink-2)',
            }}>
              <span style={{
                width: 18, height: 3, borderRadius: 2,
                background: relColor(r),
              }}/>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewSubgraph() {
  // Si Explorer a navigué vers nous via jdm:goto, on récupère son terme.
  const initialTerm = (typeof window !== 'undefined' && window.__jdmPendingTerm) || 'plat asiatique';
  if (typeof window !== 'undefined') window.__jdmPendingTerm = null;
  const [term, setTerm] = useState(initialTerm);
  const [depth, setDepth] = useState(1);
  const [topK, setTopK] = useState(3);
  const [topKd2, setTopKd2] = useState(3);
  const [topKd3, setTopKd3] = useState(3);
  const [topKd4, setTopKd4] = useState(3);
  const [activeRels, setActiveRels] = useState(SUBGRAPH_DEFAULT_RELATIONS);
  const [activeRelsD2, setActiveRelsD2] = useState(SUBGRAPH_DEFAULT_D2);
  const [activeRelsD3, setActiveRelsD3] = useState(SUBGRAPH_DEFAULT_D3);
  const [activeRelsD4, setActiveRelsD4] = useState(SUBGRAPH_DEFAULT_D4);
  const [minWeight, setMinWeight] = useState(0);
  const [maxNodes, setMaxNodes] = useState(40);
  const [format, setFormat] = useState('live');  // 'live' par défaut (animation graphique)
  // Layout en mode LIVE : 'tree' (arbre radial, défaut) ou 'rings' (cercles concentriques).
  const [liveLayout, setLiveLayout] = useState('tree');
  const [data, setData] = useState({ nodes: [], edges: [], stats: {}, html: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleIn = (set, setSet) => (r) =>
    setSet((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);

  const onBuild = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    // Mode LIVE : consomme l'endpoint SSE /api/subgraph/live qui émet
    // un snapshot 'graph' immédiat puis les nodes/edges progressivement.
    // L'iframe LIVE (HeroAnimation simulation) continue de tourner en
    // parallèle, mais on a maintenant un graphe réel JDM en data.
    if (format === 'live') {
      try {
        // Pas de cap dur en LIVE : l'utilisateur décide via le
        // slider maxNodes. Plancher à 25 pour LIVE pour laisser
        // de la place aux depth-2 (sinon avec top_k=3 × 7 relations,
        // la couronne depth-1 mange toute la quota et l'arbre
        // dégénère en cercle plat).
        const liveMaxNodes = Math.max(25, Number(maxNodes) || 30);
        const res = await fetch('api/subgraph/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term,
            depth: Number(depth),
            top_k: Number(topK),
            relations: activeRels,
            max_nodes: liveMaxNodes,
            // Seuil sur le POIDS des relations (arêtes), pas sur les
            // nœuds. Les négations sont toujours conservées côté
            // backend, peu importe la valeur.
            min_weight: Number(minWeight) || 0,
          }),
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        let collectedNodes = [];
        let collectedEdges = [];
        // Parse SSE robust (CRLF + LF, comments, multi-line data)
        const flush = () => {
          const re = /\r\n\r\n|\n\n|\r\r/;
          let m;
          while ((m = re.exec(buf)) !== null) {
            const raw = buf.slice(0, m.index);
            buf = buf.slice(m.index + m[0].length);
            let evName = 'message', evData = '';
            for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('event:')) evName = line.slice(6).trim();
              else if (line.startsWith('data:'))
                evData += (evData ? '\n' : '') + line.slice(5).replace(/^ /, '');
            }
            if (!evData) continue;
            let parsed;
            try { parsed = JSON.parse(evData); } catch { parsed = { text: evData }; }
            if (evName === 'graph') {
              collectedNodes = parsed.nodes || [];
              collectedEdges = parsed.edges || [];
              setData({ nodes: collectedNodes, edges: collectedEdges,
                        stats: { n_nodes: collectedNodes.length,
                                 n_edges: collectedEdges.length, depth },
                        html: '', format: 'live' });
            } else if (evName === 'error') {
              setError(parsed.text || 'erreur LIVE');
            }
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          flush();
        }
      } catch (e) {
        setError(String(e && e.message ? e.message : e));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Modes HTML / JSON : appel REST classique à /api/subgraph
    try {
      const res = await fetch('api/subgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          depth: Number(depth),
          top_k: Number(topK),
          top_k_d2: Number(topKd2),
          top_k_d3: Number(topKd3),
          top_k_d4: Number(topKd4),
          relations: activeRels,
          relations_d2: activeRelsD2,
          relations_d3: activeRelsD3,
          relations_d4: activeRelsD4,
          min_weight: Number(minWeight),
          max_nodes: Number(maxNodes),
          format,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const d = await res.json();
      setData({
        nodes: d.nodes || [],
        edges: d.edges || [],
        stats: d.stats || {},
        html: d.html || '',
        format: d.format,
      });
      if (d.message) setMessage(d.message);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setData({ nodes: [], edges: [], stats: {}, html: '' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au mount + à chaque incrément de runVersion
  // (utilisé par recenterTo pour relancer après setTerm).
  const [runVersion, setRunVersion] = useState(0);
  React.useEffect(() => { onBuild(); /* eslint-disable-next-line */ }, [runVersion]);

  // Recentre : utilisé par le clic sur un nœud en mode LIVE.
  // setTerm(newTerm) → bump runVersion → useEffect → onBuild lit le
  // term à jour. Pas de race condition : React garantit que le
  // useEffect part avec la valeur de term post-render.
  const recenterTo = React.useCallback((newTerm) => {
    if (!newTerm || newTerm === term) return;
    setTerm(newTerm);
    setRunVersion(v => v + 1);
  }, [term]);

  const stats = data.stats || {};

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · visualisation"
        title="Sous-graphe"
        desc="Extrait et visualise le voisinage d'un terme à profondeur N, filtré par type de relation. Deux formats : HTML interactif (vis-network) ou SVG natif."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: controls */}
        <div style={{
          position: 'sticky', top: 80,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <Card padding={16}>
            <Field label="Terme racine">
              <Input value={term} onChange={setTerm} mono />
            </Field>
            <Field label={`Profondeur · ${depth}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {[1, 2, 3, 4].map(d => (
                  <button key={d}
                    onClick={() => setDepth(d)}
                    className="focus-ring"
                    style={{
                      padding: '8px',
                      background: depth === d ? 'var(--accent)' : 'var(--bg-elev)',
                      border: '1px solid var(--line)',
                      color: depth === d ? 'var(--bg)' : 'var(--ink)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Format de rendu">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {[
                  { id: 'html', value: 'html', label: 'HTML' },
                  { id: 'svg',  value: 'json', label: 'SVG' },
                  { id: 'live', value: 'live', label: 'LIVE', dot: true },
                ].map(f => {
                  const active = format === f.value;
                  return (
                    <button key={f.id}
                      onClick={() => setFormat(f.value)}
                      className="focus-ring"
                      style={{
                        padding: '8px',
                        background: active ? 'var(--accent)' : 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        color: active ? 'var(--bg)' : 'var(--ink)',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}>
                      {f.dot && (
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: active ? 'var(--bg)' : 'var(--jdm-green)',
                          animation: 'pulse-dot 1.2s ease-in-out infinite',
                        }}/>
                      )}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={`Poids min des relations · ${minWeight}`}>
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
              <div className="mono" style={{
                marginTop: 4, fontSize: 9, color: 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}>
                seuil sur |w| des arêtes · négations toujours visibles
              </div>
            </Field>
            {(format === 'json' || format === 'live') && (
              <Field label={`Nœuds max · ${maxNodes}`}>
                <Slider value={maxNodes} onChange={setMaxNodes}
                  min={format === 'live' ? 25 : 10} max={200} step={5} />
              </Field>
            )}
            {/* Toggle layout — visible uniquement en mode LIVE */}
            {format === 'live' && (
              <Field label="Layout">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {[
                    { id: 'tree',  label: 'Arbre' },
                    { id: 'rings', label: 'Cercles' },
                  ].map(opt => {
                    const active = liveLayout === opt.id;
                    return (
                      <button key={opt.id}
                        onClick={() => setLiveLayout(opt.id)}
                        className="focus-ring"
                        style={{
                          padding: '8px',
                          background: active ? 'var(--accent)' : 'var(--bg-elev)',
                          border: '1px solid var(--line)',
                          color: active ? 'var(--bg)' : 'var(--ink)',
                          borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>{opt.label}</button>
                    );
                  })}
                </div>
              </Field>
            )}
            <div style={{ marginTop: 12 }}>
              <Button full onClick={onBuild} disabled={loading}>
                {loading ? 'Construction…' : 'Construire le graphe'}
              </Button>
            </div>
          </Card>

          {/* Niveau 1 */}
          <RelationFilterCard
            label={`Niveau 1 — voisins (top-K ${topK})`}
            topK={topK} setTopK={setTopK}
            active={activeRels} setActive={setActiveRels}
          />
          {depth >= 2 && (
            <RelationFilterCard
              label={`Niveau 2 (top-K ${topKd2})`}
              topK={topKd2} setTopK={setTopKd2}
              active={activeRelsD2} setActive={setActiveRelsD2}
            />
          )}
          {depth >= 3 && (
            <RelationFilterCard
              label={`Niveau 3 (top-K ${topKd3})`}
              topK={topKd3} setTopK={setTopKd3}
              active={activeRelsD3} setActive={setActiveRelsD3}
            />
          )}
          {depth >= 4 && (
            <RelationFilterCard
              label={`Niveau 4 (top-K ${topKd4})`}
              topK={topKd4} setTopK={setTopKd4}
              active={activeRelsD4} setActive={setActiveRelsD4}
            />
          )}
        </div>

        {/* Right: viz */}
        <div>
          {error && (
            <div style={{
              padding: 16, marginBottom: 12,
              background: 'rgba(200, 58, 115, 0.08)',
              border: '1px solid var(--jdm-magenta)',
              borderRadius: 'var(--radius)',
              color: 'var(--jdm-magenta)', fontSize: 13,
            }}>⚠️ {error}</div>
          )}
          {message && !error && (
            <div style={{
              padding: 12, marginBottom: 12,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius)',
              color: 'var(--ink-2)', fontSize: 13,
            }}>{message}</div>
          )}

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span>
                {' · '}profondeur {depth}
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_nodes ?? data.nodes.length}</span> nœuds
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_edges ?? data.edges.length}</span> arêtes
                {' · '}<span className="mono" style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{data.format || format}</span>
              </div>
            </div>
            <div style={{
              // Hauteur adaptative selon le format :
              //  - HTML (vis-network iframe) : gros canvas, prend la viewport
              //  - SVG (rendu natif sur dataset) : moyen
              //  - LIVE (animation graphique) : prend toute la viewport dispo
              height: format === 'live'
                ? 'min(820px, calc(100vh - 180px))'
                : format === 'json'
                  ? 'min(720px, calc(100vh - 220px))'
                  : 'min(900px, calc(100vh - 220px))',
              minHeight: format === 'live' ? 640 : 560,
              background: 'var(--bg-card)',
              position: 'relative',
              transition: 'height 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              {data.format === 'html' && data.html ? (
                <iframe
                  title="JDM subgraph"
                  srcDoc={data.html}
                  sandbox="allow-scripts allow-same-origin"
                  style={{
                    width: '100%', height: '100%', border: 0, display: 'block',
                    // Le HTML interne a un fond transparent (override CSS
                    // injecté côté backend), donc l'iframe montre cette
                    // couleur — qui suit le thème via var(--bg).
                    background: 'var(--bg)',
                  }}
                />
              ) : format === 'live' ? (
                // Mode LIVE — graphe animé en boucle (sans chat).
                // À brancher sur /api/subgraph/live (SSE) — voir brief.
                // Pour l'instant : scénarios pré-enregistrés en démo.
                <div style={{ padding: 12, height: '100%' }}>
                  <LiveAnimWrapper
                    term={term}
                    nodes={data.nodes}
                    edges={data.edges}
                    layout={liveLayout}
                    onRecenter={recenterTo}
                  />
                </div>
              ) : data.nodes && data.nodes.length > 0 ? (
                <GraphViz nodes={data.nodes} edges={data.edges} relations={activeRels} />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: 'var(--ink-3)', fontSize: 13,
                }}>
                  {loading ? 'Construction…' : 'Aucun nœud à afficher.'}
                </div>
              )}
            </div>
          </Card>

          {/* Stats below */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12, marginTop: 16,
          }}>
            {[
              ['Nœuds', String(stats.n_nodes ?? data.nodes.length)],
              ['Arêtes', String(stats.n_edges ?? data.edges.length)],
              ['Négations', String(stats.n_negative ?? data.edges.filter(e => e.negative).length)],
              ['Profondeur', String(stats.depth ?? depth)],
            ].map(([k, v]) => (
              <Card key={k} padding={14}>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{k}</div>
                <div className="display" style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24, fontWeight: 600, marginTop: 6,
                }}>{v}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function RelationFilterCard({ label, topK, setTopK, active, setActive }) {
  const toggle = (r) =>
    setActive((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  return (
    <Card padding={16}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, marginBottom: 10 }}>
        <Slider value={topK} onChange={setTopK} min={1} max={15} step={1} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SUBGRAPH_ALL_RELATIONS.map(r => {
          const on = active.includes(r);
          const kind = KIND_OF_REL[r] || 'assoc';
          const c = KIND_COLOR[kind];
          return (
            <button key={r}
              onClick={() => toggle(r)}
              style={{
                padding: '3px 8px',
                background: on ? c : 'transparent',
                border: `1px solid ${on ? c : 'var(--line)'}`,
                borderRadius: 999,
                color: on ? '#fff' : 'var(--ink-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer',
              }}>{r}</button>
          );
        })}
      </div>
    </Card>
  );
}

// Layout SVG : anneaux concentriques par profondeur.
function GraphViz({ nodes, edges }) {
  const W = 800, H = 640, cx = W / 2, cy = H / 2;
  const RING_RADII = [0, 160, 250, 320, 380];

  const byDepth = {};
  for (const n of nodes) {
    const d = Math.min(n.depth ?? 1, 4);
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n);
  }
  const positioned = [];
  for (const dStr of Object.keys(byDepth).sort()) {
    const d = Number(dStr);
    const arr = byDepth[d];
    const r = RING_RADII[d] ?? 380;
    if (d === 0 || arr.length === 1) {
      positioned.push({ ...arr[0], x: cx, y: cy, r: 22, depth: d });
    } else {
      arr.forEach((n, i) => {
        const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2 + d * 0.15;
        const nr = d === 1 ? 14 : (d === 2 ? 11 : 9);
        positioned.push({
          ...n,
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          r: nr, depth: d,
        });
      });
    }
  }
  const byId = Object.fromEntries(positioned.map(n => [n.id, n]));
  const trunc = (s, max) => (s && s.length > max) ? s.slice(0, max - 1) + '…' : (s || '');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        const color = e.negative ? '#c62828'
          : (KIND_COLOR[KIND_OF_REL[e.relation] || 'assoc'] || KIND_COLOR.assoc);
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color}
            strokeOpacity={e.depth >= 2 ? 0.35 : 0.6}
            strokeWidth={e.depth >= 2 ? 1.0 : 1.4}
            strokeDasharray={e.depth >= 2 ? '4 3' : undefined}
          />
        );
      })}
      {positioned.map((n, i) => {
        const isCenter = n.depth === 0;
        const kindColor = KIND_COLOR[n.kind] || KIND_COLOR.assoc;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={isCenter ? '#c0411a' : '#fbf6ea'}
              stroke={isCenter ? '#c0411a' : kindColor}
              strokeWidth={isCenter ? 0 : 1.2}
            />
            <text x={n.x} y={n.y + n.r + 14}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={isCenter ? 13 : (n.depth === 1 ? 11 : 10)}
              fontWeight={isCenter ? 700 : 400}
              fill="#1f1d18">
              {trunc(n.label, isCenter ? 28 : 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

window.ViewSubgraph = ViewSubgraph;
