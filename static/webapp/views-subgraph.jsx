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

// Convertit {nodes, edges} SSE en scénario HeroAnimation.
// `layout` : 'tree' = arbre radial (enfants près de leur parent) ;
//            'rings' = cercles concentriques uniformes (anneau par depth).
function buildLiveScenario(rootTerm, nodes, edges, layout = 'tree') {
  if (!nodes || nodes.length === 0) return null;

  const centerNode = nodes.find(n => n.id === 'ROOT') || nodes[0];
  const center = centerNode.label || rootTerm;
  const centerId = centerNode.id;

  // Index parent ↔ enfants
  const childrenOf = {};
  const parentOf = {};
  for (const e of edges || []) {
    if (!childrenOf[e.from]) childrenOf[e.from] = [];
    if (!childrenOf[e.from].includes(e.to)) childrenOf[e.from].push(e.to);
    if (!(e.to in parentOf)) parentOf[e.to] = e.from;
  }

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Palette de branches — chaque branche principale (= un depth-1)
  // reçoit une couleur unique, héritée par tous ses descendants
  // → groupes de couleur lisibles, comme dans la démo Projet hero.
  const BRANCH_COLORS = [
    'jdm-magenta', 'jdm-cyan', 'jdm-green', 'jdm-violet',
    'jdm-orange', 'jdm-yellow',
  ];

  // ───── Layout 'tree' : positions cartésiennes parent → enfant ─────
  // depth-1 : posés en cercle autour du centre, dist = 130
  // depth ≥ 2 : posés en partant du PARENT (pos parent + vecteur radial),
  //   branchAngle = direction du parent ± offset léger pour ses frères.
  // Conversion cart → polaire pour HeroAnimation à la fin.
  const cartPos = { [centerId]: { x: 0, y: 0, branchAngle: 0, depth: 0 } };
  const nodeColors = { [centerId]: 'jdm-magenta' };
  const toRad = (a) => a * Math.PI / 180;

  // depth-1 = nœuds directement enfants du centre dans le graphe
  const d1Ids = (childrenOf[centerId] || []).filter(id => byId[id]);
  const D1_DIST = 130;
  d1Ids.forEach((id, i) => {
    const angle = (i / d1Ids.length) * 360 - 90;
    const rad = toRad(angle);
    cartPos[id] = {
      x: D1_DIST * Math.cos(rad), y: D1_DIST * Math.sin(rad),
      branchAngle: angle, depth: 1,
    };
    nodeColors[id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
  });

  // BFS depuis depth-1 pour placer toutes les profondeurs supérieures
  const BRANCH_LEN = [0, 0, 80, 65, 55];   // dist parent → child par depth
  const queue = [...d1Ids];
  while (queue.length) {
    const pid = queue.shift();
    const pPos = cartPos[pid];
    const kids = (childrenOf[pid] || [])
      .filter(id => byId[id] && !(id in cartPos) && id !== centerId);
    if (kids.length === 0) continue;

    const childDepth = pPos.depth + 1;
    const len = BRANCH_LEN[Math.min(childDepth, 4)] || 55;

    kids.forEach((id, i) => {
      // Span d'ouverture des frères depuis l'angle radial du parent.
      // 18° par frère (max 60°) → assez serré pour rester "en branche".
      const span = Math.min(60, Math.max(18, kids.length * 18));
      const off = kids.length === 1
        ? 0
        : (i / (kids.length - 1)) * span - span / 2;
      const branchAngle = pPos.branchAngle + off;
      const rad = toRad(branchAngle);
      cartPos[id] = {
        x: pPos.x + len * Math.cos(rad),
        y: pPos.y + len * Math.sin(rad),
        branchAngle, depth: childDepth,
      };
      nodeColors[id] = nodeColors[pid];  // hérite couleur branche
      queue.push(id);
    });
  }

  // Nœuds ORPHELINS (= pas atteignables depuis le centre via les edges
  // child-of) : on les colle quand même autour, sur un anneau secondaire.
  // Comme ça TOUS les nœuds renvoyés par l'API sont visibles, même si
  // leur edge entrant vient d'un autre depth-1.
  let orphanIdx = 0;
  const orphans = nodes.filter(n => !(n.id in cartPos));
  for (const n of orphans) {
    const angle = (orphanIdx / Math.max(orphans.length, 1)) * 360 - 90 + 15;
    const dist = 230;
    const rad = toRad(angle);
    cartPos[n.id] = {
      x: dist * Math.cos(rad), y: dist * Math.sin(rad),
      branchAngle: angle, depth: 2,
    };
    nodeColors[n.id] = BRANCH_COLORS[orphanIdx % BRANCH_COLORS.length];
    orphanIdx++;
  }

  // Mode 'rings' : on écrase le placement et on rebatch tout sur cercles
  // concentriques uniformes par profondeur.
  if (layout === 'rings') {
    const RING_DIST = [0, 130, 215, 280, 330];
    const byDepth = {};
    for (const id of Object.keys(cartPos)) {
      if (id === centerId) continue;
      const d = Math.min(cartPos[id].depth || 1, 4);
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(id);
    }
    for (const dStr of Object.keys(byDepth)) {
      const d = Number(dStr);
      const arr = byDepth[d];
      const dist = RING_DIST[Math.min(d, 4)] || 330;
      arr.forEach((id, i) => {
        const angle = (i / arr.length) * 360 - 90 + d * 12;
        const rad = toRad(angle);
        cartPos[id] = {
          x: dist * Math.cos(rad), y: dist * Math.sin(rad),
          branchAngle: angle, depth: d,
        };
      });
    }
  }

  // Conversion cartésien → polaire (angle, dist) pour HeroAnimation
  const liveNodes = [];
  const nodeDelays = { [centerId]: 0 };
  // Tri par depth pour une anim en vagues (depth 1 d'abord, etc.)
  const sortedIds = Object.keys(cartPos)
    .filter(id => id !== centerId && byId[id])
    .sort((a, b) => (cartPos[a].depth || 1) - (cartPos[b].depth || 1));

  sortedIds.forEach((id, i) => {
    const p = cartPos[id];
    const n = byId[id];
    const angle = Math.atan2(p.y, p.x) * 180 / Math.PI;
    const dist = Math.sqrt(p.x * p.x + p.y * p.y);
    const parentDelay = nodeDelays[parentOf[id] || centerId] || 0;
    const delay = Math.max(parentDelay + 0.18, 0.4 + i * 0.06);
    nodeDelays[id] = delay;
    liveNodes.push({
      id, label: n.label || id,
      angle, dist,
      color: nodeColors[id] || 'jdm-violet',
      delay, dim: p.depth >= 2,
    });
  });

  // TOUTES les arêtes — les deux extrémités sont placées (cartPos
  // contient le centre + tous les nœuds + les orphelins rattachés
  // à l'anneau secondaire).
  const liveEdges = (edges || [])
    .filter(e => (e.from in cartPos) && (e.to in cartPos))
    .map(e => ({
      from: e.from, to: e.to,
      delay: Math.max(nodeDelays[e.from] || 0, nodeDelays[e.to] || 0) + 0.15,
      label: e.relation || '',
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
function LiveAnimWrapper({ term, nodes, edges, layout }) {
  const scenario = React.useMemo(
    () => buildLiveScenario(term, nodes, edges, layout),
    // Dépend de la longueur + premier/dernier id pour détecter des
    // données réellement différentes sans tomber dans le piège du
    // "nouvelle référence à chaque tick SSE".
    [term, layout, (nodes || []).length, (edges || []).length,
     (nodes || [])[0]?.id, (nodes || [])[(nodes || []).length - 1]?.id]
  );
  return <HeroAnimation height={560} showChat={false} liveScenario={scenario} />;
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
        // En mode LIVE, on cap dur max_nodes à 18 pour garder une
        // visualisation lisible (au-delà : nœuds se chevauchent).
        // L'utilisateur peut quand même augmenter la profondeur ou
        // le top_k pour explorer — mais la couronne reste bornée.
        const liveMaxNodes = Math.min(Number(maxNodes) || 18, 18);
        const res = await fetch('api/subgraph/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term,
            depth: Number(depth),
            top_k: Number(topK),
            relations: activeRels,
            max_nodes: liveMaxNodes,
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

  // Auto-run au mount
  React.useEffect(() => { onBuild(); }, []);

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
            <Field label={`Poids minimum · ${minWeight}`}>
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
            </Field>
            {format === 'json' && (
              <Field label={`Nœuds max (SVG) · ${maxNodes}`}>
                <Slider value={maxNodes} onChange={setMaxNodes} min={10} max={200} step={5} />
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
              //  - LIVE (animation graphique) : 600px pour matcher l'anim
              height: format === 'live'
                ? 620
                : format === 'json'
                  ? 'min(720px, calc(100vh - 220px))'
                  : 'min(900px, calc(100vh - 220px))',
              minHeight: format === 'live' ? 620 : 560,
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
