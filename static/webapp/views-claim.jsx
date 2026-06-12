// View: Claim checker — verify subject | relation | object via /api/factcheck.

const CLAIM_RELATIONS_OPTS = [
  { value: 'r_isa', label: 'r_isa — est un' },
  { value: 'r_hypo', label: 'r_hypo — exemple de' },
  { value: 'r_carac', label: 'r_carac — caractéristique' },
  { value: 'r_has_color', label: 'r_has_color — couleur' },
  { value: 'r_has_part', label: 'r_has_part — partie / composant' },
  { value: 'r_agent', label: 'r_agent — agent typique' },
  { value: 'r_patient', label: 'r_patient — patient typique' },
  { value: 'r_instr', label: 'r_instr — instrument' },
  { value: 'r_lieu', label: 'r_lieu — lieu typique' },
  { value: 'r_has_causatif', label: 'r_has_causatif — cause' },
  { value: 'r_has_conseq', label: 'r_has_conseq — conséquence' },
  { value: 'r_but', label: 'r_but — but' },
  { value: 'r_telic_role', label: 'r_telic_role — à quoi sert' },
];

const EFFORT_OPTS = [
  { value: 0, label: '0 — Contenance', sub: 'JDM contient-il ce triplet ?' },
  { value: 1, label: '1 — + inférence noyau', sub: 'isa-transitivité + agent/patient' },
  { value: 2, label: '2 — + inférence complète', sub: 'tous les schémas (lent)' },
];

// Mapping backend origin → libellé FR pour l'UI.
const ORIGIN_LABEL = {
  inference: 'inférence',
  containment: 'contenance',
  none: '—',
};

function ViewClaim() {
  // Defaults alignés sur la branche deploy-self : baleine | r_isa | poisson / effort 0.
  const [subject, setSubject] = useState('baleine');
  const [relation, setRelation] = useState('r_isa');
  // TOUTES les relations JDM depuis /api/relations ; CLAIM_RELATIONS_OPTS = fallback offline.
  const _allRels = useJdmRelations();
  const relOptions = jdmRelationOptions(_allRels, CLAIM_RELATIONS_OPTS);
  const [object_, setObject] = useState('poisson');
  const [effort, setEffort] = useState(0);
  const [bypass, setBypass] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // `run(opts)` accepte un override explicite des valeurs — utile pour
  // les boutons d'exemples qui changent le form ET veulent vérifier
  // dans la même intention (sinon : race entre setState async et fetch).
  const run = async (opts) => {
    const _subject  = opts && opts.subject  !== undefined ? opts.subject  : subject;
    const _relation = opts && opts.relation !== undefined ? opts.relation : relation;
    const _object   = opts && opts.object   !== undefined ? opts.object   : object_;
    const _effort   = opts && opts.effort   !== undefined ? opts.effort   : Number(effort);
    const _bypass   = opts && opts.bypass   !== undefined ? opts.bypass   : !!bypass;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: _subject,
          relation: _relation,
          object: _object,
          effort: Number(_effort),
          bypass: !!_bypass,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const submitted = {
        subject: _subject, relation: _relation,
        object: _object,
        effort: Number(_effort),
        bypass: !!_bypass,
      };
      if (data.error) {
        setResult({
          submitted,
          status: 'unknown',
          confidence: 0,
          explanation: data.error,
          origin: ORIGIN_LABEL[data.origin] || '—',
        });
      } else {
        setResult({
          submitted,
          status: data.status,
          confidence: data.confidence,
          explanation: data.explanation,
          origin: ORIGIN_LABEL[data.origin] || '—',
          inference_schema: data.inference_schema,
          proof: data.proof,
          counter: data.counter,
        });
      }
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au mount pour montrer un exemple
  React.useEffect(() => { run(); }, []);

  const examples = [
    ['chat', 'r_isa', 'animal'],
    ['tomate', 'r_isa', 'fruit'],
    ['tomate', 'r_isa', 'légume'],
    ['chat', 'r_agent', 'aboyer'],
  ];

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · déterministe"
        title="Claim checker"
        desc="Vérifie une affirmation atomique. JDM répond ✅ supporté, ❌ contredit, ou ❓ inconnu, avec sa chaîne de preuve."
      />

      {/* Triplet builder */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        marginBottom: 16,
      }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 12,
        }}>Construire le triplet</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr',
          gap: 10,
          alignItems: 'center',
        }}>
          <Input value={subject} onChange={setSubject} placeholder="sujet" mono />
          <Sep />
          <Select value={relation} options={relOptions} onChange={setRelation} />
          <Sep />
          <Input value={object_} onChange={setObject} placeholder="objet" mono />
        </div>

        {/* Options + run */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr auto',
          gap: 14,
          alignItems: 'end',
          marginTop: 18,
        }}>
          <Field label="Effort de vérification">
            <Select value={effort} options={EFFORT_OPTS} onChange={(v) => setEffort(Number(v))} />
          </Field>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
            padding: '10px 0',
          }}>
            <input type="checkbox" checked={bypass}
              onChange={(e) => setBypass(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }} />
            Bypass contenance
          </label>
          <Button onClick={run} size="lg" disabled={loading}>
            {loading ? 'Vérification…' : 'Vérifier'}
          </Button>
        </div>
      </div>

      {/* Quick examples */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        marginBottom: 28,
      }}>
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          alignSelf: 'center', marginRight: 6,
        }}>Exemples :</span>
        {examples.map(([s, r, o], i) => (
          <button key={i}
            className="focus-ring"
            onClick={() => {
              // Update du form + run avec les NOUVELLES valeurs passées
              // explicitement (le setState est async, run() lirait sinon
              // l'ancien state). Fix la race « clic sur exemple → vérifie
              // le triplet précédent puis affiche le nouveau form ».
              setSubject(s); setRelation(r); setObject(o);
              run({ subject: s, relation: r, object: o });
            }}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 999,
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: 'pointer',
            }}>
            {s} | {r} | {o}
          </button>
        ))}
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

      {/* Indicateur « résultats périmés » si le formulaire a changé
          depuis la dernière vérification. */}
      {result && result.submitted && (
        result.submitted.subject !== subject ||
        result.submitted.relation !== relation ||
        result.submitted.object !== object_ ||
        result.submitted.effort !== Number(effort) ||
        result.submitted.bypass !== !!bypass
      ) && (
        <div style={{
          padding: '8px 14px', marginBottom: 12,
          background: 'var(--bg-elev)',
          border: '1px dashed var(--jdm-orange)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-orange)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span>⚠️ Le formulaire a changé — le verdict ci-dessous concerne le triplet précédent.</span>
          <Button size="sm" onClick={run} disabled={loading}>Re-vérifier</Button>
        </div>
      )}

      {/* Result — utilise les valeurs SNAPSHOTÉES dans result.submitted
          pour éviter le bug stale : si l'utilisateur change le form
          après vérification, le banner affiche le verdict avec le
          triplet *réellement vérifié*, pas le triplet en cours
          d'édition. */}
      {result && (
        <ClaimResult
          result={result}
          subject={result.submitted ? result.submitted.subject : subject}
          relation={result.submitted ? result.submitted.relation : relation}
          object={result.submitted ? result.submitted.object : object_}
        />
      )}
    </PageShell>
  );
}

function Sep() {
  return (
    <div style={{
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      fontSize: 20,
      userSelect: 'none',
    }}>│</div>
  );
}

function ClaimResult({ result, subject, relation, object }) {
  const verdict = {
    supported:    { icon: '✓', label: 'SUPPORTED',    color: 'var(--jdm-green)' },
    contradicted: { icon: '✗', label: 'CONTRADICTED', color: 'var(--jdm-magenta)' },
    unknown:      { icon: '?', label: 'UNKNOWN',      color: 'var(--ink-3)' },
  }[result.status] || { icon: '?', label: result.status, color: 'var(--ink-3)' };

  const confidence = typeof result.confidence === 'number' ? result.confidence : 0;

  return (
    <div className="fade-up">
      {/* Banner */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        background: 'var(--bg-card)',
        border: `2px solid ${verdict.color}`,
        borderRadius: 'var(--radius-lg)',
        marginBottom: 16,
      }}>
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          borderRadius: '50%',
          background: verdict.color,
          color: 'var(--bg)',
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}>{verdict.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 11, color: verdict.color,
            letterSpacing: '0.18em', fontWeight: 700,
            marginBottom: 6,
          }}>{verdict.label}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 8,
          }}>
            <span className="mono" style={{
              fontSize: 17,
              color: 'var(--ink)',
            }}>{subject}</span>
            <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>│</span>
            <span className="mono" style={{
              fontSize: 17, color: 'var(--accent)',
            }}>{relation}</span>
            <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>│</span>
            <span className="mono" style={{
              fontSize: 17,
              color: 'var(--ink)',
            }}>{object}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{result.explanation}</div>
          {result.inference_schema && (
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              marginTop: 8,
            }}>
              schéma : <span style={{ color: 'var(--accent)' }}>{result.inference_schema}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Confiance</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32, fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1,
            marginTop: 6,
          }}>{confidence.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            {result.origin === 'inférence' ? '🧠 via inférence' :
             result.origin === 'contenance' ? '📦 via contenance' : ''}
          </div>
        </div>
      </div>

      {/* Proof chain */}
      {result.proof && result.proof.length > 0 && (
        <Card>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12,
          }}>{result.origin === 'inférence' ? '🔗 Chaîne de déduction' : '✓ Évidences en faveur'}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {result.proof.map((e, i) => (
              <Triplet key={i} subject={e.s} relation={e.r} object={e.t} weight={e.w} />
            ))}
          </div>
        </Card>
      )}

      {result.counter && result.counter.length > 0 && (
        <Card>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--jdm-magenta)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12,
          }}>✗ Évidences contraires</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {result.counter.map((e, i) => (
              <Triplet key={i} subject={e.s} relation={e.r} object={e.t} weight={e.w} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

window.ViewClaim = ViewClaim;
