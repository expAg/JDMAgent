// View: Claim checker — verify subject | relation | object.

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

const SCENARIOS = {
  'tomate|r_isa|fruit': {
    status: 'supported',
    confidence: 0.94,
    explanation: 'Triplet trouvé directement dans JDM avec poids 256.',
    origin: 'contenance',
    proof: [
      { s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 },
    ],
  },
  'tomate|r_isa|légume': {
    status: 'contradicted',
    confidence: 0.82,
    explanation: 'JDM contient tomate r_isa fruit (w=256). Aucune trace de tomate r_isa légume.',
    origin: 'contenance',
    counter: [
      { s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 },
    ],
  },
  'chat|r_isa|animal': {
    status: 'supported',
    confidence: 0.97,
    explanation: 'Verdict obtenu par inférence (isa-transitivité).',
    origin: 'inférence',
    proof: [
      { s: 'chat', r: 'r_isa', t: 'mammifère', w: 198 },
      { s: 'mammifère', r: 'r_isa', t: 'vertébré', w: 220 },
      { s: 'vertébré', r: 'r_isa', t: 'animal', w: 305 },
    ],
  },
  'chat|r_agent|aboyer': {
    status: 'contradicted',
    confidence: 0.78,
    explanation: 'Le verbe aboyer a chien comme agent typique. Aucun lien chat-aboyer trouvé.',
    origin: 'contenance',
    counter: [
      { s: 'aboyer', r: 'r_agent', t: 'chien', w: 312 },
    ],
  },
};

function ViewClaim() {
  const [subject, setSubject] = useState('chat');
  const [relation, setRelation] = useState('r_isa');
  const [object_, setObject] = useState('animal');
  const [effort, setEffort] = useState(1);
  const [bypass, setBypass] = useState(false);
  const [result, setResult] = useState(SCENARIOS['chat|r_isa|animal']);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setTimeout(() => {
      const key = `${subject}|${relation}|${object_}`;
      setResult(SCENARIOS[key] || {
        status: 'unknown',
        confidence: 0.0,
        explanation: 'Aucun triplet direct, aucune chaîne d\'inférence trouvée.',
        origin: '—',
      });
      setLoading(false);
    }, 460);
  };

  const examples = [
    ['chat', 'r_isa', 'animal', '✅'],
    ['tomate', 'r_isa', 'fruit', '✅'],
    ['tomate', 'r_isa', 'légume', '❌'],
    ['chat', 'r_agent', 'aboyer', '❌'],
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
          <Select value={relation} options={CLAIM_RELATIONS_OPTS} onChange={setRelation} />
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
            <Select value={effort} options={EFFORT_OPTS} onChange={setEffort} />
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
          <Button onClick={run} size="lg">
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
        {examples.map(([s, r, o, icon], i) => (
          <button key={i}
            className="focus-ring"
            onClick={() => {
              setSubject(s); setRelation(r); setObject(o);
              setTimeout(() => {
                const k = `${s}|${r}|${o}`;
                setResult(SCENARIOS[k] || result);
              }, 100);
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
            {icon} {s} | {r} | {o}
          </button>
        ))}
      </div>

      {/* Result */}
      {result && <ClaimResult result={result} subject={subject} relation={relation} object={object_} />}
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
  }[result.status];

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
          }}>{result.confidence.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            {result.origin === 'inférence' ? '🧠 via inférence' :
             result.origin === 'contenance' ? '📦 via contenance' : ''}
          </div>
        </div>
      </div>

      {/* Proof chain */}
      {result.proof && (
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

      {result.counter && (
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
