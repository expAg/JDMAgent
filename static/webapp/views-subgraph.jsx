// View: Sous-graphe — extract & visualise a term's neighbourhood via /api/subgraph.

const SUBGRAPH_RELATIONS = [
  'r_syn', 'r_isa', 'r_hypo', 'r_has_part', 'r_carac',
  'r_has_color', 'r_lieu', 'r_agent', 'r_patient', 'r_instr',
];

// Couleur par "kind" de relation — calque du PALETTE backend.
const KIND_COLOR = {
  center: '#1a1a1a',
  isa:    '#1565c0',
  hypo:   '#2e7d32',
  syn:    '#558b2f',
  anto:   '#c62828',
  carac:  '#6a1b9a',
  part:   '#a04500',
  lieu:   '#00838f',
  verb:   '#ef6c00',
  domain: '#455a64',
  assoc:  '#757575',
};

const KIND_OF_REL = {
  r_isa: 'isa', r_hypo: 'hypo', r_syn: 'syn', r_anto: 'anto',
  r_carac: 'carac', r_has_part: 'part', r_lieu: 'lieu',
  'r_patient-1': 'verb', 'r_agent-1': 'verb',
  r_domain: 'domain', r_associated: 'assoc',
};

function ViewSubgraph() {
  // Si Explorer a navigué vers nous via jdm:goto, on récupère son terme.
  const initialTerm = (typeof window !== 'undefined' && window.__jdmPendingTerm) || 'chat';
  if (typeof window !== 'undefined') window.__jdmPendingTerm = null;
  const [term, setTerm] = useState(initialTerm);
  const [depth, setDepth] = useState(2);
  const [activeRels, setActiveRels] = useState(['r_isa', 'r_has_part', 'r_carac', 'r_syn']);
  const [minWeight, setMinWeight] = useState(30);
  const [maxNodes, setMaxNodes] = useState(40);
  const [data, setData] = useState({ nodes: [], edges: [], stats: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleRel = (r) => {
    setActiveRels((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  };

  const onBuild = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/subgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          depth: Number(depth),
          relations: activeRels,
          min_weight: Number(minWeight),
          max_nodes: Number(maxNodes),
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
      });
      if (d.message) setMessage(d.message);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setData({ nodes: [], edges: [], stats: {} });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au mount pour montrer un sous-graphe
  React.useEffect(() => { onBuild(); }, []);

  const stats = data.stats || {};

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · visualisation"
        title="Sous-graphe"
        desc="Extrait et visualise le voisinage d'un terme à profondeur N, filtré par type de relation."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: controls */}
        <div style={{
          position: 'sticky',
          top: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <Card padding={16}>
            <Field label="Terme">
              <Input value={term} onChange={setTerm} mono />
            </Field>
            <Field label={`Profondeur · ${depth}`}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
              }}>
                {[2, 3, 4].map(d => (
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
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Poids minimum">
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
            </Field>
            <Field label="Nœuds max">
              <Slider value={maxNodes} onChange={setMaxNodes} min={10} max={200} step={5} />
            </Field>
            <div style={{ marginTop: 16 }}>
              <Button full onClick={onBuild} disabled={loading}>
                {loading ? 'Construction…' : 'Construire le graphe'}
              </Button>
            </div>
          </Card>

          {/* Relation filter */}
          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 10,
            }}>Relations actives · {activeRels.length}/{SUBGRAPH_RELATIONS.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {SUBGRAPH_RELATIONS.map(r => {
                const active = activeRels.includes(r);
                const colorIdx = SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length;
                const c = JDM_COLORS[colorIdx];
                return (
                  <button key={r}
                    onClick={() => toggleRel(r)}
                    style={{
                      padding: '4px 9px',
                      background: active ? c : 'transparent',
                      border: `1px solid ${active ? c : 'var(--line)'}`,
                      borderRadius: 999,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}>{r}</button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: viz */}
        <div>
          {error && (
            <div style={{
              padding: 16, marginBottom: 12,
              background: 'rgba(200, 58, 115, 0.08)',
              border: '1px solid var(--jdm-magenta)',
              borderRadius: 'var(--radius)',
              color: 'var(--jdm-magenta)',
              fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}
          {message && !error && (
            <div style={{
              padding: 12, marginBottom: 12,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius)',
              color: 'var(--ink-2)',
              fontSize: 13,
            }}>{message}</div>
          )}

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span>
                {' · '}profondeur {depth}
                {' · '}<span style={{ color: 'var(--ink)' }}>{data.nodes.length}</span> nœuds
                {' · '}<span style={{ color: 'var(--ink)' }}>{data.edges.length}</span> arêtes
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={() => exportSVG(term)}>SVG</Button>
              </div>
            </div>
            <div style={{ height: 540, background: 'var(--bg-elev)', position: 'relative' }} className="lab-grid">
              <GraphViz nodes={data.nodes} edges={data.edges} relations={activeRels} />
            </div>
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              flexWrap: 'wrap',
            }}>
              {activeRels.map((r) => (
                <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 10, height: 2,
                    background: JDM_COLORS[SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length],
                    display: 'inline-block',
                  }} />
                  {r}
                </span>
              ))}
            </div>
          </Card>

          {/* Stats below */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginTop: 16,
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

// Layout : nœuds disposés en anneaux concentriques par profondeur.
// `nodes` = [{id, label, kind, depth}], `edges` = [{from, to, relation, weight, negative, depth}]
function GraphViz({ nodes, edges, relations }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--ink-3)', fontSize: 13,
      }}>
        Aucun nœud à afficher.
      </div>
    );
  }

  const W = 800, H = 540, cx = W / 2, cy = H / 2;
  const RING_RADII = [0, 140, 230, 305, 360];  // profondeurs 0..4

  // Group nodes by depth
  const byDepth = {};
  for (const n of nodes) {
    const d = Math.min(n.depth ?? 1, 4);
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n);
  }

  // Place root at center, others on rings
  const positioned = [];
  for (const dStr of Object.keys(byDepth).sort()) {
    const d = Number(dStr);
    const arr = byDepth[d];
    const r = RING_RADII[d] ?? 360;
    if (d === 0 || arr.length === 1) {
      positioned.push({ ...arr[0], x: cx, y: cy, r: 22, depth: d });
    } else {
      arr.forEach((n, i) => {
        const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2 + d * 0.15;
        const nodeRadius = d === 1 ? 14 : (d === 2 ? 11 : 9);
        positioned.push({
          ...n,
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          r: nodeRadius,
          depth: d,
        });
      });
    }
  }

  const byId = Object.fromEntries(positioned.map(n => [n.id, n]));

  // Truncate label for display
  const truncLabel = (s, max) => {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      {/* Edges (drawn first so nodes overlap) */}
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        let color;
        if (e.negative) {
          color = '#c62828';
        } else {
          const kind = KIND_OF_REL[e.relation] || 'assoc';
          color = KIND_COLOR[kind] || KIND_COLOR.assoc;
        }
        const opacity = e.depth >= 2 ? 0.35 : 0.6;
        const strokeDasharray = e.depth >= 2 ? '4 3' : undefined;
        return (
          <line key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={e.depth >= 2 ? 1.0 : 1.4}
            strokeDasharray={strokeDasharray}
          />
        );
      })}
      {/* Nodes */}
      {positioned.map((n, i) => {
        const isCenter = n.depth === 0;
        const kindColor = KIND_COLOR[n.kind] || KIND_COLOR.assoc;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={isCenter ? 'var(--accent)' : 'var(--bg-card)'}
              stroke={isCenter ? 'var(--accent)' : kindColor}
              strokeWidth={isCenter ? 0 : 1.2}
            />
            <text x={n.x} y={n.y + n.r + 14}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={isCenter ? 13 : (n.depth === 1 ? 11 : 10)}
              fontWeight={isCenter ? 700 : 400}
              fill="var(--ink)">
              {truncLabel(n.label, isCenter ? 28 : 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Helper : export SVG du graphe affiché (client-side)
function exportSVG(term) {
  const svg = document.querySelector('.lab-grid svg');
  if (!svg) return;
  const ser = new XMLSerializer();
  const src = ser.serializeToString(svg);
  const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jdm_subgraph_${term}.svg`.replace(/[^a-z0-9_\-.]/gi, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.ViewSubgraph = ViewSubgraph;
