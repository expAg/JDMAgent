// View: Sous-graphe — extract & visualise a term's neighbourhood.

const SUBGRAPH_RELATIONS = [
  'r_syn', 'r_isa', 'r_hypo', 'r_has_part', 'r_carac',
  'r_has_color', 'r_lieu', 'r_agent', 'r_patient', 'r_instr',
];

function ViewSubgraph() {
  const [term, setTerm] = useState('chat');
  const [depth, setDepth] = useState(2);
  const [activeRels, setActiveRels] = useState(['r_isa', 'r_has_part', 'r_carac', 'r_syn']);
  const [minWeight, setMinWeight] = useState(30);
  const [maxNodes, setMaxNodes] = useState(40);

  const toggleRel = (r) => {
    setActiveRels((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  };

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
              <Button full>Construire le graphe</Button>
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
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span> · profondeur {depth} · 38 nœuds · 62 arêtes
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost">SVG</Button>
                <Button size="sm" variant="ghost">PNG</Button>
                <Button size="sm" variant="ghost">DOT</Button>
              </div>
            </div>
            <div style={{ height: 540, background: 'var(--bg-elev)', position: 'relative' }} className="lab-grid">
              <GraphViz term={term} relations={activeRels} />
            </div>
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
            }}>
              {activeRels.map((r, i) => (
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
              ['Nœuds', '38'],
              ['Arêtes', '62'],
              ['Densité', '0.087'],
              ['Diamètre', '3'],
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

function GraphViz({ term, relations }) {
  // Deterministic fake graph layout — places nodes in concentric rings.
  const ring1 = ['félin', 'mammifère', 'animal de compagnie', 'patte', 'queue', 'oreille', 'griffe', 'matou', 'minet', 'poil'];
  const ring2 = ['vertébré', 'animal', 'chien', 'chaton', 'animal domestique', 'pelage', 'moustache'];

  const W = 800, H = 540, cx = W / 2, cy = H / 2;
  const nodes = [{ id: term, x: cx, y: cy, r: 22, ring: 0 }];
  ring1.forEach((t, i) => {
    const a = (i / ring1.length) * Math.PI * 2 - Math.PI / 2;
    nodes.push({ id: t, x: cx + Math.cos(a) * 140, y: cy + Math.sin(a) * 140, r: 14, ring: 1 });
  });
  ring2.forEach((t, i) => {
    const a = (i / ring2.length) * Math.PI * 2 - Math.PI / 2 + 0.15;
    nodes.push({ id: t, x: cx + Math.cos(a) * 230, y: cy + Math.sin(a) * 230, r: 10, ring: 2 });
  });

  // Edges: every ring1 node connects to centre, some to ring2
  const edges = [];
  ring1.forEach((t, i) => {
    const relIdx = i % relations.length;
    const r = relations[relIdx] || 'r_isa';
    const colorIdx = SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length;
    edges.push({ from: term, to: t, c: JDM_COLORS[colorIdx] });
    if (i % 3 === 0 && ring2[i / 3]) {
      edges.push({ from: t, to: ring2[Math.floor(i / 3)], c: JDM_COLORS[(colorIdx + 1) % JDM_COLORS.length] });
    }
  });

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        return (
          <line key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={e.c}
            strokeOpacity="0.55"
            strokeWidth="1.4"
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r}
            fill={n.ring === 0 ? 'var(--accent)' : 'var(--bg-card)'}
            stroke={n.ring === 0 ? 'var(--accent)' : 'var(--ink-2)'}
            strokeWidth={n.ring === 0 ? 0 : 1.2}
          />
          <text x={n.x} y={n.y + n.r + 14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={n.ring === 0 ? 13 : 11}
            fontWeight={n.ring === 0 ? 700 : 400}
            fill="var(--ink)">
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

window.ViewSubgraph = ViewSubgraph;
