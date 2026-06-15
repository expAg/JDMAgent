// View: Explorer — fetch relations for a term.
// Migration FastAPI : remplace FAKE_DATA par fetch('/api/explore').

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

// Jauge « Limite » : valeurs 10..EXPLORE_LIMIT_MAX, puis un cran final
// (EXPLORE_LIMIT_MAX + pas) = « illimité » (aucun cap envoyé au backend).
const EXPLORE_LIMIT_MAX = 1000;
const EXPLORE_LIMIT_STEP = 10;

function ViewExplorer() {
  // Pré-remplissage depuis Projet › Quick try (term, rel). Lu une fois
  // au mount puis nettoyé. Pas d'auto-fetch ici — le user clique « Lister ».
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.explorer) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.explorer;
  }
  // Defaults alignés sur la branche deploy-self : chat / r_isa / 25 / 20 / true.
  const [term, setTerm] = useState(_pending?.term || 'chat');
  const [rel, setRel] = useState(_pending?.rel || 'r_isa');
  // TOUTES les relations JDM (180+) depuis /api/relations ; EXPLORE_RELATIONS
  // reste le fallback offline. Courantes en tête, le reste par nom.
  const _allRels = useJdmRelations();
  const relOptions = jdmRelationOptions(_allRels, EXPLORE_RELATIONS);
  const [minWeight, setMinWeight] = useState(25);
  const [limit, setLimit] = useState(20);
  const [annotations, setAnnotations] = useState(true);
  // Récupérer aussi les triplets de poids NÉGATIF (par défaut oui). Le seuil
  // de poids (minWeight) ne porte que sur les positifs.
  const [includeNeg, setIncludeNeg] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  // rows = liste de {source, relation, target, weight, annotations, target_id}
  // (forme directement renvoyee par /api/explore — pas de remapping cote front)
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onRun = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          relation: rel,
          min_weight: Number(minWeight),
          // Jauge au max (> EXPLORE_LIMIT_MAX) → illimité (null = pas de cap).
          limit: Number(limit) > EXPLORE_LIMIT_MAX ? null : Number(limit),
          with_annotations: !!annotations,
          include_negatives: !!includeNeg,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMessage(data.message || '');
      setLoaded(true);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setRows([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au premier render pour montrer un resultat (chat r_has_part)
  React.useEffect(() => { onRun(); }, []);

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · sans LLM"
        title="Explorer"
        desc="Récupère les relations d'un terme dans JeuxDeMots. Instantané, déterministe, mis en cache."
      />

      {/* Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
        gap: 14,
        alignItems: 'end',
        marginBottom: 16,
      }}>
        <Field label="Terme">
          <Input value={term} onChange={setTerm} placeholder="chat, avocat, courir…" mono />
        </Field>
        <Field label="Type de relation">
          <Select value={rel} options={relOptions} onChange={setRel} />
        </Field>
        {/* Spacer marginBottom matches Field's marginBottom:14 so the
            visible button aligns with the visible input row (le Field
            réserve 14px sous l'input pour son espacement). */}
        <div style={{ marginBottom: 14 }}>
          <Button onClick={onRun} size="lg" disabled={loading}>
            {loading ? 'Chargement…' : 'Interroger'}
          </Button>
        </div>
      </div>

      {/* Secondary controls — 2×2 : sliders en haut, cases en bas. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px 20px',
        padding: '14px 16px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius)',
        marginBottom: 28,
      }}>
        <Field label="Poids minimum (positifs)" inline>
          <Slider value={minWeight} onChange={setMinWeight} min={0} max={500} step={5} />
        </Field>
        <Field label="Limite" inline>
          <Slider value={limit} onChange={setLimit}
            min={10} max={EXPLORE_LIMIT_MAX + EXPLORE_LIMIT_STEP} step={EXPLORE_LIMIT_STEP}
            format={(v) => v > EXPLORE_LIMIT_MAX ? '∞' : String(v)} />
        </Field>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
        }}>
          <input type="checkbox"
            checked={includeNeg}
            onChange={(e) => setIncludeNeg(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Récupérer les relations négatives
        </label>
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

      {/* Error banner */}
      {error && (
        <div style={{
          padding: 16,
          marginBottom: 16,
          background: 'rgba(200, 58, 115, 0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)',
          fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {loaded && !error && (
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
              <Button size="sm" variant="secondary"
                onClick={() => exportCSV(rows, term, rel)}>Exporter CSV</Button>
              <Button size="sm" variant="ghost"
                onClick={() => window.dispatchEvent(new CustomEvent('jdm:goto', { detail: { view: 'subgraph', term } }))}>
                Voir le graphe →
              </Button>
            </div>
          </div>

          {/* Distribution sparkline */}
          {rows.length > 0 && (
            <Card padding={16} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Distribution des poids
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  max {Math.max(...rows.map(r => r.weight))} · min {Math.min(...rows.map(r => r.weight))}
                </div>
              </div>
              <Bars rows={rows} />
            </Card>
          )}

          {/* Triplets list */}
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r, i) => (
              <Triplet key={i}
                subject={r.source || term}
                relation={r.relation || rel}
                object={r.target}
                weight={r.weight}
                annotations={annotations && r.annotations ? r.annotations : undefined}
              />
            ))}
          </div>

          {rows.length === 0 && (
            <EmptyState
              title="Aucun triplet"
              desc={message || `Aucun « ${term} | ${rel} | ? » avec w ≥ ${minWeight}. Essaie un seuil plus bas.`}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function Bars({ rows }) {
  const max = Math.max(...rows.map(r => r.weight), 1);
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      alignItems: 'flex-end',
      height: 64,
    }}>
      {rows.map((r, i) => (
        <div key={i} title={`${r.target} · w=${r.weight}`}
          style={{
            flex: 1,
            height: `${(r.weight / max) * 100}%`,
            minHeight: 2,
            background: 'var(--accent)',
            opacity: 0.3 + 0.7 * (r.weight / max),
            borderRadius: '2px 2px 0 0',
          }} />
      ))}
    </div>
  );
}

// Helper : export CSV simple (téléchargement client-side)
function exportCSV(rows, term, rel) {
  if (!rows || rows.length === 0) return;
  const header = ['source', 'relation', 'target', 'weight', 'annotations', 'target_id'];
  const escape = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(k => escape(r[k])).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jdm_${term}_${rel}.csv`.replace(/[^a-z0-9_\-.]/gi, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.ViewExplorer = ViewExplorer;
