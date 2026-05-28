// View: Explorer — fetch relations for a term.

const EXPLORE_RELATIONS = [
  { value: 'r_syn', label: 'Synonymes', sub: 'r_syn' },
  { value: 'r_anto', label: 'Antonymes', sub: 'r_anto' },
  { value: 'r_isa', label: 'Hyperonymes — "est un"', sub: 'r_isa' },
  { value: 'r_hypo', label: 'Hyponymes — "exemples de"', sub: 'r_hypo' },
  { value: 'r_has_part', label: 'Parties / composants', sub: 'r_has_part' },
  { value: 'r_carac', label: 'Caractéristiques', sub: 'r_carac' },
  { value: 'r_has_color', label: 'Couleurs', sub: 'r_has_color' },
  { value: 'r_lieu', label: 'Lieux typiques', sub: 'r_lieu' },
  { value: 'r_agent', label: 'Agents typiques (verbe)', sub: 'r_agent' },
  { value: 'r_patient', label: 'Patients typiques (verbe)', sub: 'r_patient' },
  { value: 'r_instr', label: 'Instruments (verbe)', sub: 'r_instr' },
  { value: 'r_telic_role', label: 'Rôle télique — à quoi sert', sub: 'r_telic_role' },
  { value: 'r_has_causatif', label: 'Causes', sub: 'r_has_causatif' },
  { value: 'r_has_conseq', label: 'Conséquences', sub: 'r_has_conseq' },
  { value: 'r_but', label: 'But', sub: 'r_but' },
  { value: 'r_manner', label: 'Manière (verbe / processus)', sub: 'r_manner' },
];

// Fake dataset for the demo — different by (term, relation).
const FAKE_DATA = {
  'chat | r_has_part': [
    { t: 'patte', w: 142, a: 'constitutif (w=12)' },
    { t: 'queue', w: 138 },
    { t: 'oreille', w: 121, a: 'constitutif (w=10)' },
    { t: 'griffe', w: 110 },
    { t: 'moustache', w: 104 },
    { t: 'œil', w: 98 },
    { t: 'fourrure', w: 85 },
    { t: 'pelage', w: 72 },
    { t: 'crocs', w: 51 },
  ],
  'chat | r_isa': [
    { t: 'félin', w: 215, a: 'constitutif (w=18)' },
    { t: 'mammifère', w: 198 },
    { t: 'animal de compagnie', w: 142 },
    { t: 'carnivore', w: 121 },
    { t: 'animal domestique', w: 118 },
    { t: 'animal', w: 102 },
    { t: 'vertébré', w: 56 },
  ],
  'chat | r_syn': [
    { t: 'matou', w: 89 },
    { t: 'minet', w: 72 },
    { t: 'félin', w: 58 },
    { t: 'greffier', w: 14, a: 'familier (w=8)' },
    { t: 'mistigri', w: 11, a: 'familier (w=6)' },
  ],
  'avocat | r_isa': [
    { t: 'fruit', w: 121, a: 'sens : fruit' },
    { t: 'juriste', w: 118, a: 'sens : profession' },
    { t: 'légume', w: 32 },
    { t: 'défenseur', w: 28 },
  ],
};

function ViewExplorer() {
  const [term, setTerm] = useState('chat');
  const [rel, setRel] = useState('r_has_part');
  const [minWeight, setMinWeight] = useState(25);
  const [limit, setLimit] = useState(50);
  const [annotations, setAnnotations] = useState(true);
  const [loaded, setLoaded] = useState(true);
  const [loading, setLoading] = useState(false);

  const key = `${term} | ${rel}`;
  const data = FAKE_DATA[key] || FAKE_DATA['chat | r_has_part'];
  const rows = data
    .filter(r => r.w >= minWeight)
    .slice(0, limit);

  const onRun = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setLoaded(true); }, 380);
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · sans LLM"
        title="Explorer"
        desc="Récupère les relations d'un terme dans JeuxDeMots. Instantané, déterministe, mis en cache."
      />

      {/* Controls + sense-disambiguation hint */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
        gap: 14,
        alignItems: 'flex-end',
        marginBottom: 16,
      }}>
        <Field label="Terme">
          <Input value={term} onChange={setTerm} placeholder="chat, avocat, courir…" mono />
        </Field>
        <Field label="Type de relation">
          <Select value={rel} options={EXPLORE_RELATIONS} onChange={setRel} />
        </Field>
        <Button onClick={onRun} size="lg">
          {loading ? 'Chargement…' : 'Interroger'}
        </Button>
      </div>

      {/* Secondary controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 20,
        padding: '14px 16px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius)',
        marginBottom: 28,
      }}>
        <Field label="Poids minimum" inline>
          <Slider value={minWeight} onChange={setMinWeight} min={0} max={500} step={5} />
        </Field>
        <Field label="Limite" inline>
          <Slider value={limit} onChange={setLimit} min={5} max={200} step={5} />
        </Field>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
        }}>
          <input type="checkbox"
            checked={annotations}
            onChange={(e) => setAnnotations(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Annotations sémantiques (constitutif, contrastif…)
        </label>
      </div>

      {/* Results */}
      {loaded && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 12,
          }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--ink)' }}>{rows.length}</span> triplet{rows.length > 1 ? 's' : ''} trouvé{rows.length > 1 ? 's' : ''}
              {' · '}
              <span style={{ color: 'var(--ink)' }}>{term}</span> | <span style={{ color: 'var(--accent)' }}>{rel}</span> | ?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="secondary">Exporter CSV</Button>
              <Button size="sm" variant="ghost">Voir le graphe →</Button>
            </div>
          </div>

          {/* Distribution sparkline */}
          <Card padding={16} style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Distribution des poids
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                max {Math.max(...rows.map(r => r.w))} · min {Math.min(...rows.map(r => r.w))}
              </div>
            </div>
            <Bars rows={rows} />
          </Card>

          {/* Triplets list */}
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r, i) => (
              <Triplet key={i}
                subject={term}
                relation={rel}
                object={r.t}
                weight={r.w}
                annotations={annotations ? r.a : undefined}
              />
            ))}
          </div>

          {rows.length === 0 && (
            <EmptyState
              title="Aucun triplet"
              desc={`Aucun « ${term} | ${rel} | ? » avec w ≥ ${minWeight}. Essaie un seuil plus bas.`}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function Bars({ rows }) {
  const max = Math.max(...rows.map(r => r.w), 1);
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      alignItems: 'flex-end',
      height: 64,
    }}>
      {rows.map((r, i) => (
        <div key={i} title={`${r.t} · w=${r.w}`}
          style={{
            flex: 1,
            height: `${(r.w / max) * 100}%`,
            minHeight: 2,
            background: 'var(--accent)',
            opacity: 0.3 + 0.7 * (r.w / max),
            borderRadius: '2px 2px 0 0',
          }} />
      ))}
    </div>
  );
}

window.ViewExplorer = ViewExplorer;
