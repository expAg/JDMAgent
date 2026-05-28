// View: Jarvis — autonomous looping pipelines.
//
// Each flow runs as a background loop: the agent iterates, calls tools,
// validates candidates, accumulates results. The user configures params
// once, hits "Lancer", and watches the pipeline run. No manual stepping.

const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Boucle de génération-validation : propose des triplets candidats, les valide via un panel de vérifications JDM, garde ceux qui passent.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'génération → validation → mémoire',
  },
  {
    id: 'audit',
    title: 'Audit de cohérence',
    kicker: 'Flux 2',
    desc: 'Parcourt le voisinage d\'un terme, détecte contradictions et triplets suspects par cross-checking entre relations.',
    accent: 'var(--jdm-cyan)',
    loopOf: 'parcours → cross-check → flag',
  },
  {
    id: 'expand',
    title: 'Expansion sémantique',
    kicker: 'Flux 3',
    desc: 'Étend une requête initiale par strates : synonymes, hyponymes, termes culturellement liés, jusqu\'à saturation.',
    accent: 'var(--jdm-green)',
    loopOf: 'strate N → strate N+1',
  },
  {
    id: 'factcheck',
    title: 'Fact-checking textuel',
    kicker: 'Flux 4',
    desc: 'Lit un paragraphe, en extrait les affirmations atomiques, vérifie chacune dans JDM, rend une synthèse.',
    accent: 'var(--jdm-orange)',
    loopOf: 'extraction → vérification → synthèse',
  },
  {
    id: 'synth',
    title: 'Synthèse de concept',
    kicker: 'Flux 5',
    desc: 'Collecte les relations isa/parties/but/agents d\'un concept, assemble une définition lexicale riche.',
    accent: 'var(--jdm-violet)',
    loopOf: 'collecte → assemblage',
  },
];

function ViewJarvis() {
  const [active, setActive] = useState(null);
  if (active) {
    const flow = JARVIS_FLOWS.find(f => f.id === active);
    return <JarvisRun flow={flow} onBack={() => setActive(null)} />;
  }
  return (
    <PageShell>
      <SectionTitle
        kicker="Pipelines autonomes"
        title="Jarvis"
        desc="Cinq boucles d'agent qui itèrent sans intervention. Tu paramètres, tu lances, tu regardes. Pause / stop à tout moment."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {JARVIS_FLOWS.map(f => (
          <div key={f.id}
            onClick={() => setActive(f.id)}
            className="focus-ring"
            tabIndex={0}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: 22,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = f.accent;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.transform = '';
            }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: 4,
              background: f.accent,
            }} />
            <div className="mono" style={{
              fontSize: 11, color: f.accent,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontWeight: 600,
              marginBottom: 8,
            }}>{f.kicker}</div>
            <div className="display" style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24, fontWeight: 600,
              letterSpacing: '-0.015em',
              marginBottom: 10,
            }}>{f.title}</div>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              marginBottom: 14,
            }}>{f.desc}</p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              background: 'var(--bg-elev)',
              border: '1px dashed var(--line-soft)',
              borderRadius: 999,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-3)',
            }}>
              <LoopGlyph color={f.accent} />
              boucle : {f.loopOf}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function LoopGlyph({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
      <path d="M 10 4 A 4 4 0 1 0 9.5 8.5"
        fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 10 4 L 8 4 L 10 2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ───── Run view — the auto-loop interface ─────
function JarvisRun({ flow, onBack }) {
  // Per-flow params
  const [params, setParams] = useState(defaultParamsFor(flow.id));
  // Pipeline state
  const [state, setState] = useState('idle'); // idle | running | paused | done
  const [log, setLog] = useState([]);
  const [metrics, setMetrics] = useState({
    iterations: 0,
    toolsCalled: 0,
    candidates: 0,
    accepted: 0,
    rejected: 0,
    elapsed: 0,
  });
  const [accepted, setAccepted] = useState([]);
  const logRef = useRef(null);
  const tickRef = useRef(null);

  // Tick the loop
  useEffect(() => {
    if (state !== 'running') {
      clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      step(flow.id, params, setLog, setMetrics, setAccepted, setState);
    }, 650);
    return () => clearInterval(tickRef.current);
  }, [state, flow.id, params]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const reset = () => {
    setLog([]); setAccepted([]);
    setMetrics({ iterations: 0, toolsCalled: 0, candidates: 0, accepted: 0, rejected: 0, elapsed: 0 });
    setState('idle');
  };

  return (
    <PageShell>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
      }}>
        <Button variant="ghost" size="sm" onClick={onBack}>← Tous les flux</Button>
        <span style={{ color: 'var(--ink-3)' }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: flow.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
      </div>
      <SectionTitle
        kicker={flow.kicker}
        title={flow.title}
        desc={flow.desc}
        right={<StatusBadge state={state} accent={flow.accent} />}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: params + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 80 }}>
          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Paramètres</div>
            <ParamsForm flow={flow} params={params} setParams={setParams} locked={state === 'running' || state === 'paused'} />
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Contrôles</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state === 'idle' && <Button full onClick={() => setState('running')}>▶ Lancer la boucle</Button>}
              {state === 'running' && <>
                <Button variant="secondary" onClick={() => setState('paused')}>⏸ Pause</Button>
                <Button variant="secondary" onClick={() => setState('done')}>⏹ Stop</Button>
              </>}
              {state === 'paused' && <>
                <Button onClick={() => setState('running')}>▶ Reprendre</Button>
                <Button variant="secondary" onClick={() => setState('done')}>⏹ Stop</Button>
              </>}
              {state === 'done' && <Button full variant="secondary" onClick={reset}>↻ Relancer</Button>}
            </div>
            {(state === 'running' || state === 'paused') && (
              <div style={{
                marginTop: 10,
                padding: '6px 10px',
                background: 'var(--bg-elev)',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                Boucle auto · pas de validation manuelle
              </div>
            )}
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Critères d'arrêt</div>
            <StopCriteria flow={flow.id} params={params} setParams={setParams} locked={state === 'running'} />
          </Card>
        </div>

        {/* Right: live monitor */}
        <div>
          {/* Metrics grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <Metric label="Itération" value={metrics.iterations} max={params.maxIter ?? 100} accent={flow.accent} />
            <Metric label="Outils" value={metrics.toolsCalled} sub="appels" />
            <Metric label="Candidats" value={metrics.candidates} sub="générés" />
            <Metric label="Acceptés" value={metrics.accepted} sub="validés" color="var(--jdm-green)" />
            <Metric label="Rejetés" value={metrics.rejected} sub="filtrés" color="var(--jdm-magenta)" />
            <Metric label="Temps" value={`${(metrics.elapsed / 1000).toFixed(1)}s`} sub="écoulé" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Log stream */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>Log temps réel</div>
                {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
              </div>
              <div ref={logRef} style={{
                height: 420,
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.55,
                padding: 12,
                background: 'var(--bg-card)',
              }}>
                {log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {log.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                    <span style={{
                      flexShrink: 0,
                      color: l.kind === 'tool' ? 'var(--accent)' :
                             l.kind === 'accept' ? 'var(--jdm-green)' :
                             l.kind === 'reject' ? 'var(--jdm-magenta)' :
                             l.kind === 'iter' ? flow.accent :
                             'var(--ink-3)',
                      minWidth: 56,
                    }}>{l.tag}</span>
                    <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Accepted candidates accumulator */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>Résultats validés · {accepted.length}</div>
              </div>
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 12,
                background: 'var(--bg-card)',
              }}>
                {accepted.length === 0 ? (
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>
                    Aucun résultat encore.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {accepted.map((a, i) => (
                      <div key={i} className="fade-up" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line-soft)',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                      }}>
                        <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>✓</span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                        <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{a.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {accepted.length > 0 && state === 'done' && (
                <div style={{
                  padding: 10,
                  borderTop: '1px solid var(--line-soft)',
                  background: 'var(--bg-elev)',
                  display: 'flex', gap: 6,
                }}>
                  <Button size="sm" variant="secondary">Exporter CSV</Button>
                  <Button size="sm" variant="ghost">JSON</Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ───── Status badge ─────
function StatusBadge({ state, accent }) {
  const styles = {
    idle:    { label: 'En attente', color: 'var(--ink-3)', dot: false },
    running: { label: 'En cours',   color: accent,         dot: true  },
    paused:  { label: 'En pause',   color: 'var(--jdm-orange)', dot: false },
    done:    { label: 'Terminé',    color: 'var(--jdm-green)',  dot: false },
  }[state];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '5px 12px',
      border: `1px solid ${styles.color}`,
      borderRadius: 999,
      color: styles.color,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      fontWeight: 600,
    }}>
      {styles.dot && <span className="pulse-dot" style={{ background: styles.color }} />}
      {styles.label}
    </div>
  );
}

// ───── Metric tile ─────
function Metric({ label, value, sub, max, accent, color, mono }) {
  const pct = max ? Math.min(100, (Number(value) / max) * 100) : null;
  return (
    <div style={{ background: 'var(--bg-card)', padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>{label}</div>
      <div className="display" style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontSize: mono ? 20 : 24,
        fontWeight: 600,
        marginTop: 4,
        color: color || 'var(--ink)',
        letterSpacing: '-0.01em',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      {pct != null && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 2, background: 'var(--line-soft)',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', background: accent || 'var(--accent)', transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

// ───── Per-flow params ─────
function defaultParamsFor(flowId) {
  switch (flowId) {
    case 'enrich': return { term: 'chat', relation: 'r_carac', maxIter: 30, minConf: 0.5 };
    case 'audit':  return { term: 'chat', depth: 2, maxIter: 50 };
    case 'expand': return { term: 'félin', depth: 3, maxIter: 25 };
    case 'factcheck': return { text: 'Le chat est un mammifère. Il mange des croquettes et chasse des souris. Sa moustache lui sert à mesurer les ouvertures.', maxIter: 6 };
    case 'synth': return { concept: 'chat', maxIter: 8 };
  }
}

function ParamsForm({ flow, params, setParams, locked }) {
  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  if (flow.id === 'enrich') {
    return (
      <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
        <Field label="Terme à enrichir">
          <Input value={params.term} onChange={(v) => set('term', v)} mono />
        </Field>
        <Field label="Type de relation">
          <Select value={params.relation} onChange={(v) => set('relation', v)} options={[
            { value: 'r_carac', label: 'r_carac — caractéristiques' },
            { value: 'r_isa', label: 'r_isa — hyperonymes' },
            { value: 'r_has_part', label: 'r_has_part — parties' },
            { value: 'r_agent', label: 'r_agent — agents typiques' },
            { value: 'r_lieu', label: 'r_lieu — lieux typiques' },
          ]} />
        </Field>
        <Field label={`Confiance minimum · ${params.minConf}`}>
          <Slider value={params.minConf * 100} onChange={(v) => set('minConf', v / 100)} min={0} max={100} step={5} suffix="%" />
        </Field>
      </div>
    );
  }
  if (flow.id === 'audit') {
    return (
      <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
        <Field label="Terme racine"><Input value={params.term} onChange={(v) => set('term', v)} mono /></Field>
        <Field label={`Profondeur · ${params.depth}`}>
          <Slider value={params.depth} onChange={(v) => set('depth', v)} min={1} max={4} step={1} />
        </Field>
      </div>
    );
  }
  if (flow.id === 'expand') {
    return (
      <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
        <Field label="Terme initial"><Input value={params.term} onChange={(v) => set('term', v)} mono /></Field>
        <Field label={`Strates · ${params.depth}`}>
          <Slider value={params.depth} onChange={(v) => set('depth', v)} min={1} max={5} step={1} />
        </Field>
      </div>
    );
  }
  if (flow.id === 'factcheck') {
    return (
      <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
        <Field label="Texte à vérifier">
          <textarea
            value={params.text}
            onChange={(e) => set('text', e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </Field>
      </div>
    );
  }
  if (flow.id === 'synth') {
    return (
      <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
        <Field label="Concept à définir"><Input value={params.concept} onChange={(v) => set('concept', v)} mono /></Field>
      </div>
    );
  }
}

function StopCriteria({ flow, params, setParams, locked }) {
  return (
    <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
      <Field label={`Itérations max · ${params.maxIter}`}>
        <Slider value={params.maxIter} onChange={(v) => setParams(p => ({ ...p, maxIter: v }))} min={5} max={100} step={1} />
      </Field>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)',
        lineHeight: 1.5, marginTop: 4,
      }}>
        La boucle s'arrête aussi si plus aucun candidat n'est généré pendant 5 itérations consécutives.
      </div>
    </div>
  );
}

// ───── Simulated step — fake but realistic ─────
const FLOW_FAKES = {
  enrich: {
    tools: ['relations_from', 'relations_to', 'analogies', 'common_ancestors', 'validate_candidate'],
    candidatesPool: [
      { label: 'chat | r_carac | curieux',    s: 0.92, ok: true },
      { label: 'chat | r_carac | indépendant', s: 0.89, ok: true },
      { label: 'chat | r_carac | propre',      s: 0.81, ok: true },
      { label: 'chat | r_carac | nocturne',    s: 0.77, ok: true },
      { label: 'chat | r_carac | silencieux',  s: 0.71, ok: true },
      { label: 'chat | r_carac | hautain',     s: 0.54, ok: true },
      { label: 'chat | r_carac | aboyeur',     s: 0.12, ok: false, reason: 'contradicted by r_agent(aboyer, chien)' },
      { label: 'chat | r_carac | aquatique',   s: 0.18, ok: false, reason: 'no support in r_lieu' },
      { label: 'chat | r_carac | énorme',      s: 0.22, ok: false, reason: 'contradicted by r_size' },
      { label: 'chat | r_carac | gracieux',    s: 0.86, ok: true },
      { label: 'chat | r_carac | affectueux',  s: 0.79, ok: true },
      { label: 'chat | r_carac | chasseur',    s: 0.88, ok: true },
    ],
  },
  audit: {
    tools: ['relations_from', 'cross_check', 'detect_contradiction', 'flag_suspect'],
    candidatesPool: [
      { label: 'chat | r_isa | chien',         s: 0.04, ok: false, reason: 'contradicted by r_isa(chat, félin)' },
      { label: 'chat | r_has_part | aile',     s: 0.02, ok: false, reason: 'no support in JDM' },
      { label: 'chat | r_has_color | bleu',    s: 0.31, ok: false, reason: 'suspicious — low weight (w=3)' },
      { label: 'chat | r_isa | félin',         s: 0.97, ok: true },
      { label: 'chat | r_has_part | patte',    s: 0.95, ok: true },
    ],
  },
  expand: {
    tools: ['refinements_decoded', 'relations_from', 'common_ancestors'],
    candidatesPool: [
      { label: 'félin → chat',                 s: 0.95, ok: true },
      { label: 'félin → lion',                 s: 0.91, ok: true },
      { label: 'félin → tigre',                s: 0.88, ok: true },
      { label: 'félin → léopard',              s: 0.82, ok: true },
      { label: 'félin → panthère',             s: 0.79, ok: true },
      { label: 'félin → guépard',              s: 0.76, ok: true },
      { label: 'félin → lynx',                 s: 0.71, ok: true },
      { label: 'félin → puma',                 s: 0.65, ok: true },
      { label: 'félin → ocelot',               s: 0.42, ok: true },
      { label: 'félin → serval',               s: 0.31, ok: true },
    ],
  },
  factcheck: {
    tools: ['extract_claims', 'verify_claim'],
    candidatesPool: [
      { label: '✓ chat | r_isa | mammifère',          s: 0.97, ok: true },
      { label: '✓ chat | r_patient | manger croquette', s: 0.91, ok: true },
      { label: '✓ chat | r_agent | chasser souris',    s: 0.88, ok: true },
      { label: '✓ moustache | r_telic_role | mesurer', s: 0.74, ok: true },
    ],
  },
  synth: {
    tools: ['relations_from', 'refinements_decoded', 'common_ancestors'],
    candidatesPool: [
      { label: 'isa: mammifère, félin, animal',        s: 0.95, ok: true },
      { label: 'parties: patte, queue, oreille',       s: 0.92, ok: true },
      { label: 'agents typiques: ronronner, miauler',  s: 0.87, ok: true },
      { label: 'but: chasser, garder compagnie',       s: 0.81, ok: true },
      { label: 'caractéristiques: agile, curieux',     s: 0.85, ok: true },
    ],
  },
};

function step(flowId, params, setLog, setMetrics, setAccepted, setState) {
  const fake = FLOW_FAKES[flowId];
  if (!fake) return;
  const t = new Date();
  const tStr = t.toTimeString().slice(0, 8);
  const minConf = params.minConf ?? 0.5;

  setMetrics(m => {
    const newIter = m.iterations + 1;
    // Stop conditions
    if (newIter > (params.maxIter ?? 30) || newIter > fake.candidatesPool.length + 2) {
      setLog(l => [...l, { t: tStr, tag: '[stop]', kind: 'iter', msg: 'Critère d\'arrêt atteint — fin de boucle' }]);
      setTimeout(() => setState('done'), 100);
      return m;
    }

    const newLogs = [];
    const idx = (newIter - 1) % fake.candidatesPool.length;
    const cand = fake.candidatesPool[idx];

    newLogs.push({ t: tStr, tag: `[iter ${newIter}]`, kind: 'iter', msg: 'Génération de candidats…' });

    // Pick 1-2 tool calls
    const nTools = 2 + (newIter % 2);
    for (let i = 0; i < nTools; i++) {
      const tool = fake.tools[(newIter + i) % fake.tools.length];
      newLogs.push({ t: tStr, tag: '[tool]', kind: 'tool', msg: `${tool}(…) → ${20 + (newIter * 7) % 80}ms` });
    }

    // Decision
    const passesConf = cand.s >= minConf;
    if (cand.ok && passesConf) {
      newLogs.push({ t: tStr, tag: '[accept]', kind: 'accept', msg: `${cand.label} · score=${cand.s.toFixed(2)}` });
      setAccepted(a => [...a, { label: cand.label, score: cand.s.toFixed(2) }]);
    } else {
      const reason = cand.reason || `score ${cand.s.toFixed(2)} < ${minConf.toFixed(2)}`;
      newLogs.push({ t: tStr, tag: '[reject]', kind: 'reject', msg: `${cand.label} · ${reason}` });
    }

    setLog(l => [...l, ...newLogs]);

    return {
      iterations: newIter,
      toolsCalled: m.toolsCalled + nTools,
      candidates: m.candidates + 1,
      accepted: m.accepted + (cand.ok && passesConf ? 1 : 0),
      rejected: m.rejected + (cand.ok && passesConf ? 0 : 1),
      elapsed: m.elapsed + 650,
    };
  });
}

window.ViewJarvis = ViewJarvis;
