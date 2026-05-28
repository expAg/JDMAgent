// View: Jarvis — agent-driven flows wired to /api/jarvis/{flow_id}/stream.
//
// Conserve la structure visuelle du designer (cards de flow, page Run
// avec params + metrics + log + résultats) mais branche maintenant les
// 5 vrais flows backend : enrich / audit / gap / signalement / stats.

const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'proposition → validation → consolidation',
  },
  {
    id: 'audit',
    title: 'Audit sémantique',
    kicker: 'Flux 2',
    desc: 'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit.',
    accent: 'var(--jdm-cyan)',
    loopOf: 'sens → triplet → verdict',
  },
  {
    id: 'gap',
    title: 'Détection de trous',
    kicker: 'Flux 3',
    desc: 'Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l\'enrichissement de façon ciblée.',
    accent: 'var(--jdm-green)',
    loopOf: 'parcours → diagnostic → trous',
  },
  {
    id: 'signalement',
    title: 'Signalement',
    kicker: 'Flux 4',
    desc: 'Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.',
    accent: 'var(--jdm-orange)',
    loopOf: 'inventaire → flag → catégorisation',
  },
  {
    id: 'stats',
    title: 'Stats',
    kicker: 'Flux 5',
    desc: 'Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré.',
    accent: 'var(--jdm-violet)',
    loopOf: 'inventaire → agrégation',
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
        kicker="Pipelines guidés"
        title="Jarvis"
        desc="Cinq flux d'agent guidés par formulaire. Tu paramètres, tu lances, l'agent suit le workflow canonique du flux. Stoppable à tout moment."
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
              {f.loopOf}
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

// ───── Run view — Sse-driven ─────
function JarvisRun({ flow, onBack }) {
  const [params, setParams] = useState(defaultParamsFor(flow.id));
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [log, setLog] = useState([]);
  const [metrics, setMetrics] = useState({
    toolsCalled: 0, accepted: 0, thoughts: 0, elapsed: 0,
  });
  const [accepted, setAccepted] = useState([]);
  // narrationHTML = trace markdown/HTML cumulative du LLM (left panel)
  // filePreview = contenu du fichier .enrich/.audit/.err qui se construit
  //              (right panel — c'est CE qu'on appelle « réponse finale »)
  const [narrationHTML, setNarrationHTML] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [filePath, setFilePath] = useState(null);
  const [headline, setHeadline] = useState('');
  const logRef = useRef(null);
  const abortRef = useRef(null);
  const startTimeRef = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Tick elapsed time
  useEffect(() => {
    if (state !== 'running') return;
    const id = setInterval(() => {
      setMetrics(m => ({ ...m, elapsed: Date.now() - (startTimeRef.current || Date.now()) }));
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  const reset = () => {
    setLog([]); setAccepted([]); setNarrationHTML(''); setFilePreview('');
    setFilePath(null); setHeadline('');
    setMetrics({ toolsCalled: 0, accepted: 0, thoughts: 0, elapsed: 0 });
    setState('idle');
  };

  const launch = async () => {
    reset();
    setState('running');
    startTimeRef.current = Date.now();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const flowParams = { ...params };
    const ts = () => new Date().toTimeString().slice(0, 8);

    try {
      const res = await fetch(`api/jarvis/${flow.id}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_id: flow.id, params: flowParams }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      // Backend yield des events { type: jarvis } portant :
      //   messages          [{role, content}]
      //   file_path         chemin du fichier .enrich/.audit/.err
      //   file_preview      contenu courant du fichier (gradually appended)
      //   consolidated_count int — VRAI compteur depuis count_consolidations()
      //   consolidated      list[{term, relation, target, ...}]
      // Le narration HTML (avec divs .jdm-narration et spans .jarvis-term)
      // est dans le dernier message assistant — on l'injecte tel quel dans
      // le panneau LOG (HTML interprété via dangerouslySetInnerHTML).
      // file_preview va dans le panneau « RÉPONSE FINALE » (= état du
      // fichier en construction).
      let prevConsolidatedCount = 0;
      const dispatchEvent = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'headline':
            setHeadline(d.text || '');
            setLog(l => [...l, { t: ts(), tag: '[start]', kind: 'iter', msg: d.text || '' }]);
            break;
          case 'jarvis': {
            const msgs = d.messages || [];
            const assistant = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            // Met à jour la narration HTML pour le panneau LOG
            if (assistant && assistant.content) {
              setNarrationHTML(assistant.content);
            }
            // Compteur consolidés depuis le registry (source de vérité)
            const cc = Number(d.consolidated_count || 0);
            if (cc !== prevConsolidatedCount) {
              setMetrics(m => ({ ...m, accepted: cc }));
              prevConsolidatedCount = cc;
            }
            // Compteur outils via marqueurs de narration HTML
            if (assistant && assistant.content) {
              const toolMatches = assistant.content.match(/class="jdm-narration"/g) || [];
              setMetrics(m => ({ ...m, toolsCalled: toolMatches.length }));
            }
            // Triplets consolidés depuis le registry (pas du parsing)
            if (Array.isArray(d.consolidated)) {
              setAccepted(d.consolidated.map(c => ({
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: '✓',
              })));
            }
            // Aperçu du fichier qui se construit (gradually appended)
            if (typeof d.file_preview === 'string') {
              setFilePreview(d.file_preview);
            }
            // Path du fichier (téléchargement)
            if (d.file_path && d.file_path !== filePath) {
              setFilePath(d.file_path);
              setLog(l => [...l, {
                t: ts(), tag: '[file]', kind: 'accept',
                msg: `Fichier : ${d.file_path}`,
              }]);
            }
            break;
          }
          case 'done':
            setLog(l => [...l, { t: ts(), tag: '[done]', kind: 'accept', msg: 'Flow terminé.' }]);
            setState('done');
            break;
          case 'error':
            setLog(l => [...l, { t: ts(), tag: '[err]', kind: 'reject', msg: d.text || 'erreur' }]);
            setState('error');
            break;
          default: break;
        }
      };
      const flushEvents = () => {
        // Robuste : accepte CRLF (sse-starlette défaut) ET LF.
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const rawEv = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEventJarvis(rawEv);
          if (ev) dispatchEvent(ev);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        flushEvents();
      }
      if (buf.trim()) {
        const ev = parseSSEEventJarvis(buf);
        if (ev) dispatchEvent(ev);
      }
      if (state === 'running') setState('done');
    } catch (e) {
      if (ctrl.signal.aborted) {
        setLog(l => [...l, { t: ts(), tag: '[stop]', kind: 'iter', msg: 'Annulé par l\'utilisateur.' }]);
        setState('done');
      } else {
        setLog(l => [...l, { t: ts(), tag: '[err]', kind: 'reject', msg: String(e && e.message ? e.message : e) }]);
        setState('error');
      }
    }
  };

  const stop = () => {
    if (abortRef.current) abortRef.current.abort();
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
            <ParamsForm flow={flow} params={params} setParams={setParams} locked={state === 'running'} />
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Contrôles</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(state === 'idle' || state === 'done' || state === 'error') && (
                <Button full onClick={launch}>
                  {state === 'idle' ? '▶ Lancer' : '↻ Relancer'}
                </Button>
              )}
              {state === 'running' && (
                <Button variant="secondary" full onClick={stop}>⏹ Stop</Button>
              )}
            </div>
            {state === 'running' && (
              <div style={{
                marginTop: 10,
                padding: '6px 10px',
                background: 'var(--bg-elev)',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                Streaming SSE · arrêt manuel possible
              </div>
            )}
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Modèle</div>
            <Field label="Choix">
              <Select value={params.model || 'gemini-3.1-flash-lite'}
                onChange={(v) => setParams(p => ({ ...p, model: v }))}
                options={[
                  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
                  { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash' },
                  { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5 (BYOK)' },
                  { value: 'gpt-4o-mini',           label: 'GPT-4o mini (BYOK)' },
                ]} />
            </Field>
            {(params.model || '').match(/^(claude|gpt)-/) && (
              <Field label="Clé API">
                <Input value={params.api_key || ''}
                  onChange={(v) => setParams(p => ({ ...p, api_key: v }))}
                  placeholder={(params.model || '').startsWith('claude-') ? 'sk-ant-…' : 'sk-…'}
                  mono />
              </Field>
            )}
            <Field label="Budget d'outils">
              <Select value={params.budget_label || 'illimité'}
                onChange={(v) => setParams(p => ({ ...p, budget_label: v }))}
                options={BUDGET_OPTS} />
            </Field>
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>LLMDrops</div>
            <Field label="Clé API" hint="Override l'env JDM_DROPS_API_KEY. Vide = utilise la clé serveur.">
              <Input value={params.drops_key || ''}
                onChange={(v) => setParams(p => ({ ...p, drops_key: v }))}
                placeholder="optionnel…" mono />
            </Field>
            <div style={{
              fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5,
            }}>
              Sans clé, la case « Soumettre » écrit juste le fichier local
              sans pousser à JDM.
            </div>
          </Card>
        </div>

        {/* Right: live monitor */}
        <div>
          {/* Headline (résumé) */}
          {headline && (
            <div style={{
              padding: '8px 14px',
              marginBottom: 12,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              color: 'var(--ink-2)',
            }}>
              {headline}
            </div>
          )}

          {/* Metrics grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <Metric label="Outils" value={metrics.toolsCalled} sub="appels" accent={flow.accent} />
            <Metric label="Pensées" value={metrics.thoughts} sub="thoughts" />
            <Metric label="Consolidés" value={metrics.accepted} sub="triplets" color="var(--jdm-green)" />
            <Metric label="Temps" value={`${(metrics.elapsed / 1000).toFixed(1)}s`} sub="écoulé" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Narration (markdown HTML interprété — narrations LLM,
                tools, consolidations) — c'est notre VRAI log temps réel. */}
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
                }}>Narration LLM</div>
                {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420,
                overflowY: 'auto',
                padding: 14,
                background: 'var(--bg-card)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {narrationHTML ? (
                  <div dangerouslySetInnerHTML={{ __html: narrationHTML }} />
                ) : (
                  // Fallback : entrées tag/temps des events headline/file/etc.
                  log.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                      <span style={{
                        flexShrink: 0, minWidth: 64,
                        color: l.kind === 'accept' ? 'var(--jdm-green)'
                              : l.kind === 'reject' ? 'var(--jdm-magenta)'
                              : l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                      }}>{l.tag}</span>
                      <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Réponse finale = état du fichier .enrich/.audit/.err
                en cours de construction (file_preview, gradually appended). */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Fichier en construction
                  {filePath && (
                    <span style={{ color: 'var(--ink-2)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                      · {filePath.split(/[\\/]/).slice(-1)[0]}
                    </span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--jdm-green)' }}>
                  {metrics.accepted} consolidé{metrics.accepted > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 0,
                background: 'var(--bg-card)',
              }}>
                {filePreview ? (
                  <pre style={{
                    margin: 0, padding: 14,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11, lineHeight: 1.6,
                    color: 'var(--ink)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>{filePreview}</pre>
                ) : accepted.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4, padding: 12 }}>
                    {accepted.map((a, i) => (
                      <div key={i} className="fade-up" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line-soft)',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                      }}>
                        <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>{a.score}</span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)' }}>{a.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                    {state === 'idle' ? 'Aucun fichier encore.' : 'En attente du 1ᵉʳ triplet consolidé…'}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ───── Helpers ─────

function parseSSEEventJarvis(raw) {
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      const v = line.slice(5).replace(/^ /, '');
      data += (data ? '\n' : '') + v;
    }
  }
  if (!data) return null;
  let parsed;
  try { parsed = JSON.parse(data); } catch { parsed = { text: data }; }
  return { event, data: parsed };
}

function shortArgs(args) {
  if (!args) return '';
  return Object.entries(args)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v.slice(0, 20)}"` : JSON.stringify(v).slice(0, 25)}`)
    .join(', ');
}

// ───── Status badge ─────
function StatusBadge({ state, accent }) {
  const styles = {
    idle:    { label: 'En attente', color: 'var(--ink-3)',       dot: false },
    running: { label: 'En cours',   color: accent,               dot: true  },
    done:    { label: 'Terminé',    color: 'var(--jdm-green)',   dot: false },
    error:   { label: 'Erreur',     color: 'var(--jdm-magenta)', dot: false },
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

// ───── Per-flow form ─────

const REL_OPTS_COMMON = [
  { value: 'r_isa', label: 'r_isa — est un' },
  { value: 'r_hypo', label: 'r_hypo — exemple de' },
  { value: 'r_carac', label: 'r_carac — caractéristique' },
  { value: 'r_has_part', label: 'r_has_part — parties' },
  { value: 'r_has_color', label: 'r_has_color — couleur' },
  { value: 'r_agent', label: 'r_agent — agent typique' },
  { value: 'r_patient', label: 'r_patient — patient typique' },
  { value: 'r_lieu', label: 'r_lieu — lieu typique' },
  { value: 'r_telic_role', label: 'r_telic_role — à quoi sert' },
];

const BUDGET_OPTS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'illimité', label: 'illimité' },
];

function defaultParamsFor(flowId) {
  // Defaults alignés sur la branche deploy-self / app.py :
  // term vide partout (= tirage au hasard côté backend), budget illimité,
  // thinking=false (Jarvis = robustesse > raisonnement), upload=false.
  const common = {
    model: 'gemini-3.1-flash-lite',
    api_key: '', drops_key: '',
    use_thinking: false,
    budget_label: 'illimité',
  };
  switch (flowId) {
    case 'enrich':
      return { ...common, term: '', relation: '',
               target_count: 3, vary_relations: true, iterate: true, upload: false };
    case 'audit':
      return { ...common, term: '', relation: '', upload: false };
    case 'gap':
      return { ...common, term: '' };
    case 'signalement':
      return { ...common, term: '', relation: '', upload: false };
    case 'stats':
      return { ...common, term: '', relation: '', upload: false };
  }
  return common;
}

function ParamsForm({ flow, params, setParams, locked }) {
  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const wrap = (children) => (
    <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
      {children}
    </div>
  );

  if (flow.id === 'enrich') {
    return wrap(<>
      <Field label="Terme à enrichir">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relation cible (optionnelle)">
        <Select value={params.relation || ''}
          onChange={(v) => set('relation', v)}
          options={[{ value: '', label: '— libre —' }, ...REL_OPTS_COMMON]} />
      </Field>
      <Field label={`Nombre cible · ${params.target_count}`}>
        <Slider value={params.target_count} onChange={(v) => set('target_count', v)} min={1} max={50} step={1} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={!!params.vary_relations}
          onChange={(e) => set('vary_relations', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Varier les relations
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={!!params.iterate}
          onChange={(e) => set('iterate', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Itérer jusqu'à la cible
      </label>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!params.upload}
          onChange={(e) => set('upload', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Soumettre à LLMDrops
      </label>
    </>);
  }

  if (flow.id === 'audit' || flow.id === 'signalement' || flow.id === 'stats') {
    return wrap(<>
      <Field label="Terme">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relation (optionnelle)">
        <Select value={params.relation || ''}
          onChange={(v) => set('relation', v)}
          options={[{ value: '', label: '— toutes —' }, ...REL_OPTS_COMMON]} />
      </Field>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {flow.id !== 'stats' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!params.upload}
            onChange={(e) => set('upload', e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Soumettre à LLMDrops
        </label>
      )}
    </>);
  }

  if (flow.id === 'gap') {
    return wrap(<>
      <Field label="Terme">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
    </>);
  }

  return null;
}

window.ViewJarvis = ViewJarvis;
