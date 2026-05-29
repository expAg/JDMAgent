// View: Jarvis — autonomous looping pipelines.
//
// Landing = a Projet-style panel carousel: a "Sommaire" overview panel
// followed by one design panel per flow, presented in sequence. Each flow
// panel shows its loop laid out step-by-step, the params you'll set, and a
// preview of the kind of results it accumulates, with a "Lancer" CTA that
// drops into the live auto-loop monitor (JarvisRun, unchanged).
//
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).

// Catalogue des 6 flux JDM réels (mapping vers les sous-commandes
// /api/jarvis/{flow_id}/stream du backend). Conserve la structure
// attendue par le design (id/title/kicker/desc/accent/loopOf/produces/
// category/tags/steps). Les TOOL_DOCS / FLOW_TOOL_STEPS / FLOW_FAKES
// restent fictifs en l'état (à câbler en phase 2 sur le vrai registre
// d'outils + SSE backend ; cf. handoff README §6).
const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'proposition → validation → consolidation',
    produces: 'triplets consolidés (.enrich)',
    category: 'Production',
    tags: ['proposition', 'validation', 'consolidation', 'inférence', 'LLMDrops'],
    steps: [
      { n: 'Proposition',   d: 'propose des triplets candidats sur la relation cible' },
      { n: 'Validation',    d: 'factcheck JDM + inférence (effort 1/2)' },
      { n: 'Consolidation', d: 'écrit dans le .enrich ceux qui passent' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit sémantique',
    kicker: 'Flux 2',
    desc: 'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit deux sections (verdicts + META).',
    accent: 'var(--jdm-cyan)',
    loopOf: 'sens → triplet → verdict',
    produces: 'verdicts par sens (.audit)',
    category: 'Qualité',
    tags: ['polysémie', 'sens', 'verdict', 'META'],
    steps: [
      { n: 'Disambiguation', d: 'isole les sens dominants du terme' },
      { n: 'Cross-check',    d: 'audite chaque triplet par sens' },
      { n: 'Verdict',        d: 'LEGITIME / CONTRASTIF / À REVOIR / NEGATION' },
    ],
  },
  {
    id: 'gap',
    title: 'Détection de trous',
    kicker: 'Flux 3',
    desc: 'Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l\'enrichissement de façon ciblée. Sortie : rapport JSON.',
    accent: 'var(--jdm-green)',
    loopOf: 'parcours → diagnostic → trous',
    produces: 'rapport de trous (MISSING/LOW)',
    category: 'Exploration',
    tags: ['couverture', 'trous', 'diagnostic'],
    steps: [
      { n: 'Parcours',   d: 'inventorie les relations existantes' },
      { n: 'Diagnostic', d: 'compare à la couverture attendue' },
      { n: 'Trous',      d: 'liste les MISSING / NEGATIVE / LOW_COVERAGE' },
    ],
  },
  {
    id: 'signalement',
    title: 'Signalement',
    kicker: 'Flux 4',
    desc: 'Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.',
    accent: 'var(--jdm-orange)',
    loopOf: 'inventaire → flag → catégorisation',
    produces: 'suspects flaggés (.err)',
    category: 'Qualité',
    tags: ['suspects', 'incohérence', 'polarité', 'annotations'],
    steps: [
      { n: 'Inventaire',     d: 'récupère les triplets candidats à inspecter' },
      { n: 'Flag',           d: 'jugement linguistique LLM par triplet' },
      { n: 'Catégorisation', d: 'sémantique / polarité / annotation_oubliée / …' },
    ],
  },
  {
    id: 'stats',
    title: 'Stats',
    kicker: 'Flux 5',
    desc: 'Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré (.stat).',
    accent: 'var(--jdm-violet)',
    loopOf: 'inventaire → agrégation',
    produces: 'récap structuré (.stat)',
    category: 'Synthèse',
    tags: ['distribution', 'compteurs', 'poids'],
    steps: [
      { n: 'Inventaire', d: 'récupère les relations & leurs poids' },
      { n: 'Agrégation', d: 'distribution par relation & par terme' },
    ],
  },
  {
    id: 'annotation',
    title: 'Annotation sémantique',
    kicker: 'Flux 6',
    desc: 'Annote les triplets existants selon la taxonomie 4 catégories (constitutif / contrastif / non spécifique / exception). L\'annotation qualifie le LIEN, pas l\'objet. Produit un fichier .annot deux sections (annotations + signalement des désaccords avec JDM existant).',
    accent: 'var(--jdm-yellow)',
    loopOf: 'triplet → jugement → catégorie',
    produces: 'annotations (.annot)',
    category: 'Production',
    tags: ['constitutif', 'contrastif', 'taxonomie', 'lien'],
    steps: [
      { n: 'Lecture',  d: 'récupère les triplets à annoter pour le terme' },
      { n: 'Jugement', d: 'décide constitutif / contrastif / non spécifique / exception' },
      { n: 'Sortie',   d: 'écrit dans .annot + section SIGNALEMENT si désaccord JDM' },
    ],
  },
];

// Three top-level sections shown in the horizontal "sommaire" nav.
const J_SECTIONS = [
  { id: 'config',      label: 'Configuration' },
  { id: 'accueil',     label: 'Accueil' },
  { id: 'supervision', label: 'Supervision' },
];
// Carousel track = the 3 sections, then one detail panel per flow
// (reachable from the Accueil / Supervision cards).
const J_PANELS = [
  ...J_SECTIONS,
  ...JARVIS_FLOWS.map(f => ({ id: f.id, label: f.kicker })),
];
const JPANEL_BASIS = `${100 / J_PANELS.length}%`;

// Ring interaction CSS (hover spin + scale, soft pulsing halo). Injected once.
const JRING_CSS = `
@keyframes jorbGlow{0%,100%{opacity:.12}50%{opacity:.3}}
@keyframes jringSpin{to{transform:rotate(360deg)}}
.jring-btn{padding:0;border:none;background:transparent;cursor:pointer;border-radius:50%;line-height:0;-webkit-tap-highlight-color:transparent;}
.jring-btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
.jring{display:inline-flex;transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
.jring-btn:hover .jring{transform:scale(1.12);}
.jring-btn:active .jring{transform:scale(.95);}
.jring-arcs{transform-box:view-box;transform-origin:32px 32px;}
.jring-btn:hover .jring-arcs{animation:jringSpin .6s cubic-bezier(.45,0,.2,1);}
.jcfg-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;}
.jcfg-row + .jcfg-row{border-top:1px solid var(--line-soft);}
.jcfg-row--stack{flex-direction:column;align-items:stretch;gap:9px;}
.jtool-chip:hover{border-color:var(--accent)!important;color:var(--ink)!important;background:var(--bg-card)!important;}
@keyframes jbd{from{opacity:0}to{opacity:1}}
.jtool-backdrop{animation:jbd .16s ease-out;}
.jcode-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink-3);font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcode-copy:hover{background:var(--bg-elev);color:var(--ink);border-color:var(--ink-3);}
.jcli-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;border:1px solid #2a2f3a;background:#222631;color:#c4c9d4;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcli-copy:hover{background:#2f3542;color:#fff;border-color:#3a4150;}
.jpanel-scroll{scrollbar-width:thin;scrollbar-color:var(--line) transparent;}
.jpanel-scroll::-webkit-scrollbar{width:11px;height:11px;}
.jpanel-scroll::-webkit-scrollbar-track{background:transparent;}
.jpanel-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px;border:3px solid var(--bg);background-clip:padding-box;}
.jpanel-scroll::-webkit-scrollbar-thumb:hover{background:var(--ink-3);background-clip:padding-box;}
`;

function ViewJarvis() {
  const [running, setRunning] = useState(null);       // flow id, or null = carousel
  const [panelIndex, setPanelIndex] = useState(1);     // default landing = Accueil (middle)
  const [transitioning, setTransitioning] = useState(true);
  const total = J_PANELS.length;
  const sectionCount = J_SECTIONS.length;

  const goToIndex = useCallback((i) => {
    setTransitioning(true);
    setPanelIndex(Math.max(0, Math.min(total - 1, i)));
  }, [total]);
  const goToId = useCallback((id) => {
    const idx = J_PANELS.findIndex(p => p.id === id);
    if (idx >= 0) goToIndex(idx);
  }, [goToIndex]);

  // Auto-hide the section nav while scrolling down through a panel's content
  // (so it never collides with what's underneath); reveal it at the top or on scroll-up.
  const [navHidden, setNavHidden] = useState(false);
  const lastScroll = useRef(0);
  useEffect(() => { lastScroll.current = 0; setNavHidden(false); }, [panelIndex]);
  useEffect(() => {
    if (running) return;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains('jpanel-scroll')) return;
      const top = t.scrollTop;
      const prev = lastScroll.current;
      if (top < 40) setNavHidden(false);
      else if (top > prev + 4) setNavHidden(true);
      else if (top < prev - 4) setNavHidden(false);
      lastScroll.current = top;
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [running]);

  // ─── Keyboard : ←/→ move between the three top sections. ───
  useEffect(() => {
    if (running) return;
    const onKey = (e) => {
      if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
      const onFlow = panelIndex >= sectionCount;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.min(sectionCount - 1, panelIndex + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.max(0, panelIndex - 1));
      } else if (e.key === 'Home') { goToIndex(0); }
      else if (e.key === 'End') { goToIndex(sectionCount - 1); }
      else if (e.key === 'Escape' && onFlow) { goToIndex(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Touch swipe between the three sections ───
  useEffect(() => {
    if (running) return;
    let start = null;
    const onStart = (e) => { start = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onEnd = (e) => {
      if (!start) return;
      const dx = start.x - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 50) {
        const onFlow = panelIndex >= sectionCount;
        if (onFlow) goToIndex(1);
        else goToIndex(Math.max(0, Math.min(sectionCount - 1, panelIndex + (dx > 0 ? 1 : -1))));
      }
      start = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Run mode : replace carousel with the live monitor ───
  if (running) {
    const flow = JARVIS_FLOWS.find(f => f.id === running);
    return (
      <JarvisRun
        flow={flow}
        onBack={() => {
          const idx = J_PANELS.findIndex(p => p.id === running);
          setRunning(null);
          setTransitioning(false);
          if (idx >= 0) setPanelIndex(idx);
        }}
      />
    );
  }

  const activePanel = J_PANELS[panelIndex].id;
  const activeSection = panelIndex < sectionCount ? activePanel : 'accueil';

  return (
    <>
      <style>{JRING_CSS}</style>
      <JSectionNav activeSection={activeSection} onSelect={goToId} hidden={navHidden} />

      <div style={{
        position: 'relative',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${total * 100}%`,
          display: 'flex',
          flexDirection: 'row',
          transform: `translate3d(-${(panelIndex / total) * 100}%, 0, 0)`,
          transition: transitioning
            ? 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'none',
          willChange: 'transform',
        }}>
          <JPanel><JConfigPanel onAccueil={() => goToId('accueil')} /></JPanel>
          <JPanel><JAccueilPanel flows={JARVIS_FLOWS} onPick={goToId} onLaunch={(id) => setRunning(id)} /></JPanel>
          <JPanel><JSupervisionPanel flows={JARVIS_FLOWS} onPick={goToId} onLaunch={(id) => setRunning(id)} active={activePanel === 'supervision'} /></JPanel>

          {JARVIS_FLOWS.map((f, i) => (
            <JPanel key={f.id}>
              <JFlowPanel
                flow={f}
                index={i}
                onLaunch={() => setRunning(f.id)}
                onIndex={goToIndex}
                onSommaire={() => goToId('accueil')}
              />
            </JPanel>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Panel wrapper — one slot of the carousel track ───
function JPanel({ children }) {
  return (
    <div className="jpanel-scroll" style={{
      flex: `0 0 ${JPANEL_BASIS}`,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '92px 28px 56px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  );
}

// ═══════════════════ Configuration — réglages de l'agent ═══════════════════
const JARVIS_LLMS = [
  { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5 — équilibré' },
  { value: 'claude-opus-4.1',   label: 'Claude Opus 4.1 — qualité max' },
  { value: 'gpt-4o',            label: 'GPT-4o' },
  { value: 'mistral-large',     label: 'Mistral Large — FR' },
  { value: 'llama-3.1-70b',     label: 'Llama 3.1 70B — local' },
];
const JARVIS_FORMATS = [
  { value: 'json',   label: 'JSON' },
  { value: 'csv',    label: 'CSV' },
  { value: 'rdf',    label: 'RDF / Turtle' },
  { value: 'jsonld', label: 'JSON-LD' },
];
const JCONFIG_DEFAULTS = {
  mode: 'autonome', parallel: 2, defaultMaxIter: 30,
  llm: 'claude-sonnet-4.5', temperature: 0.3, globalConf: 50,
  humanReview: false, autoSubmit: true, logLevel: 'detaille',
  storageDir: '~/jdm/exports', exportFormat: 'json', keepHistory: true,
};

function useJarvisConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem('jdm_jarvis_config');
      if (raw) return { ...JCONFIG_DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {}
    return JCONFIG_DEFAULTS;
  });
  useEffect(() => {
    try { localStorage.setItem('jdm_jarvis_config', JSON.stringify(cfg)); } catch (e) {}
    window.__JDM_JARVIS_CONFIG__ = cfg;
  }, [cfg]);
  const set = useCallback((k, v) => setCfg(c => ({ ...c, [k]: v })), []);
  const reset = useCallback(() => setCfg(JCONFIG_DEFAULTS), []);
  return [cfg, set, reset];
}

// Small on/off switch (no shared Toggle exists).
function JToggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)} className="focus-ring"
      style={{
        width: 42, height: 24, flexShrink: 0, padding: 0,
        borderRadius: 999, position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--line)'),
        background: checked ? 'var(--accent)' : 'var(--bg-elev)',
        opacity: disabled ? 0.5 : 1, transition: 'background .2s, border-color .2s',
      }}>
      <span aria-hidden="true" style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--bg)' : 'var(--ink-3)',
        transition: 'left .2s cubic-bezier(.34,1.56,.64,1), background .2s',
      }} />
    </button>
  );
}

// Segmented control for 2–3 short options.
function JSegmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, gap: 2,
      background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 999,
    }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className="focus-ring"
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 999, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--ink-2)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontWeight: active ? 600 : 400, transition: 'background .18s, color .18s', whiteSpace: 'nowrap',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function JCfgGroup({ title, children }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>{title}</div>
      </div>
      <div style={{ padding: '2px 18px 8px' }}>{children}</div>
    </Card>
  );
}

function JCfgRow({ label, hint, children, stack }) {
  return (
    <div className={'jcfg-row' + (stack ? ' jcfg-row--stack' : '')}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: stack ? 'stretch' : 'flex-end',
        ...(stack ? { alignSelf: 'stretch' } : { minWidth: 150, maxWidth: '55%' }),
      }}>{children}</div>
    </div>
  );
}

function JConfigPanel({ onAccueil }) {
  const [cfg, set, reset] = useJarvisConfig();
  const autonomous = cfg.mode === 'autonome';
  const modeHint = {
    autonome: 'La boucle s’exécute de bout en bout, sans intervention humaine.',
    supervise: 'Jarvis sollicite ta validation aux étapes critiques.',
    pasapas: 'Tu valides chaque itération avant qu’elle ne soit écrite.',
  }[cfg.mode];
  const llmLabel = (JARVIS_LLMS.find(l => l.value === cfg.llm) || {}).label || cfg.llm;
  const fmtLabel = (JARVIS_FORMATS.find(f => f.value === cfg.exportFormat) || {}).label || cfg.exportFormat;
  const modeLabel = { autonome: 'Autonome', supervise: 'Supervisé', pasapas: 'Pas-à-pas' }[cfg.mode];
  const modeColor = { autonome: 'var(--jdm-green)', supervise: 'var(--jdm-orange)', pasapas: 'var(--jdm-cyan)' }[cfg.mode];

  // Ad-hoc readiness checklist → drives the preparation progress bar.
  const checks = [
    { label: 'Mode d’exécution choisi', ok: !!cfg.mode },
    { label: 'Modèle LLM sélectionné', ok: !!cfg.llm },
    { label: 'Seuil de confiance défini', ok: cfg.globalConf > 0 },
    { label: 'Répertoire de stockage renseigné', ok: !!(cfg.storageDir && cfg.storageDir.trim()) },
    { label: autonomous ? 'Soumission automatique activée' : 'Validation configurée', ok: autonomous ? cfg.autoSubmit : (cfg.humanReview || cfg.autoSubmit) },
  ];
  const doneCount = checks.filter(c => c.ok).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const ready = pct === 100;
  const barColor = ready ? 'var(--jdm-green)' : 'var(--accent)';

  return (
    <div style={{ width: '100%', maxWidth: 1080 }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 22,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
            letterSpacing: '0.16em', marginBottom: 12,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            &nbsp;· Réglages de l’agent
          </div>
          <h1 className="display" style={{
            margin: 0, fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)', fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
          }}>
            Config<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>uration</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> enregistré
          </span>
          <button type="button" onClick={reset} className="focus-ring" style={ghostLinkStyle}>↺ Réinitialiser</button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
        gap: 18, alignItems: 'start',
      }}>
        {/* settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <JCfgGroup title="Exécution">
            <JCfgRow label="Mode d’exécution" stack>
              <JSegmented value={cfg.mode} onChange={(v) => set('mode', v)} options={[
                { value: 'autonome', label: 'Autonome' },
                { value: 'supervise', label: 'Supervisé' },
                { value: 'pasapas', label: 'Pas-à-pas' },
              ]} />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{modeHint}</div>
            </JCfgRow>
            <JCfgRow label="Flux en parallèle" hint="Boucles d’agent exécutées simultanément." stack>
              <Slider value={cfg.parallel} onChange={(v) => set('parallel', v)} min={1} max={5} step={1} />
            </JCfgRow>
            <JCfgRow label="Itérations max par défaut" hint="Plafond appliqué à chaque nouveau flux." stack>
              <Slider value={cfg.defaultMaxIter} onChange={(v) => set('defaultMaxIter', v)} min={5} max={100} step={1} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Modèle & inférence">
            <JCfgRow label="Modèle LLM" stack>
              <Select value={cfg.llm} onChange={(v) => set('llm', v)} options={JARVIS_LLMS} />
            </JCfgRow>
            <JCfgRow label="Température" hint="Créativité de la génération de candidats." stack>
              <Slider value={Math.round(cfg.temperature * 100)} onChange={(v) => set('temperature', v / 100)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
            <JCfgRow label="Seuil de confiance global" hint="Score minimum pour conserver un triplet." stack>
              <Slider value={cfg.globalConf} onChange={(v) => set('globalConf', v)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Validation & soumission">
            <JCfgRow label="Validation humaine avant écriture" hint={autonomous ? 'Désactivée en mode autonome.' : 'Relire les triplets avant de les mémoriser.'}>
              <JToggle checked={autonomous ? false : cfg.humanReview} disabled={autonomous} onChange={(v) => set('humanReview', v)} />
            </JCfgRow>
            <JCfgRow label="Soumettre automatiquement à JDM" hint="Pousser les triplets validés vers le serveur JeuxDeMots.">
              <JToggle checked={cfg.autoSubmit} onChange={(v) => set('autoSubmit', v)} />
            </JCfgRow>
            <JCfgRow label="Journalisation" stack>
              <JSegmented value={cfg.logLevel} onChange={(v) => set('logLevel', v)} options={[
                { value: 'concis', label: 'Concis' },
                { value: 'detaille', label: 'Détaillé' },
                { value: 'debug', label: 'Debug' },
              ]} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Stockage & sortie">
            <JCfgRow label="Répertoire de stockage" hint="Où les exports et journaux sont écrits." stack>
              <Input value={cfg.storageDir} onChange={(v) => set('storageDir', v)} mono />
            </JCfgRow>
            <JCfgRow label="Format d’export" stack>
              <Select value={cfg.exportFormat} onChange={(v) => set('exportFormat', v)} options={JARVIS_FORMATS} />
            </JCfgRow>
            <JCfgRow label="Conserver l’historique des runs" hint="Garder une trace de chaque exécution.">
              <JToggle checked={cfg.keepHistory} onChange={(v) => set('keepHistory', v)} />
            </JCfgRow>
          </JCfgGroup>
        </div>

        {/* live summary */}
        <div style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ad-hoc preparation progress */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Préparation de l’agent</span>
                <span className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: ready ? 'var(--jdm-green)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 999, transition: 'width .4s cubic-bezier(.4,0,.2,1), background .3s' }} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {checks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, lineHeight: 1,
                      background: c.ok ? 'var(--jdm-green)' : 'var(--bg-elev)',
                      color: c.ok ? 'var(--bg)' : 'var(--ink-3)',
                      border: '1px solid ' + (c.ok ? 'var(--jdm-green)' : 'var(--line)'),
                    }}>{c.ok ? '✓' : ''}</span>
                    <span style={{ color: c.ok ? 'var(--ink-2)' : 'var(--ink-3)' }}>{c.label}</span>
                  </div>
                ))}
              </div>
              {ready && (
                <div className="mono" style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: 'var(--jdm-green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> prêt à lancer
                </div>
              )}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden', borderTop: `3px solid ${modeColor}` }}>
            <div style={{ padding: '14px 18px 12px' }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 10,
              }}>Profil d’exécution</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: modeColor, flexShrink: 0 }} />
                <span className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
                  letterSpacing: '-0.01em', color: 'var(--ink)',
                }}>{modeLabel}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-soft)', padding: '4px 18px 10px' }}>
              <JSumRow k="Modèle" v={llmLabel} />
              <JSumRow k="Confiance min" v={cfg.globalConf + ' %'} />
              <JSumRow k="Itér. max" v={cfg.defaultMaxIter} />
              <JSumRow k="Parallèle" v={cfg.parallel + ' flux'} />
              <JSumRow k="Soumission JDM" v={cfg.autoSubmit ? 'auto' : 'manuelle'} accent={cfg.autoSubmit ? 'var(--jdm-green)' : undefined} />
              <JSumRow k="Validation" v={autonomous ? 'aucune' : (cfg.humanReview ? 'humaine' : 'auto')} />
              <JSumRow k="Export" v={fmtLabel} />
              <JSumRow k="Stockage" v={cfg.storageDir} mono />
            </div>
          </Card>
          <Button full size="lg" onClick={onAccueil}>Choisir un flux →</Button>
        </div>
      </div>
    </div>
  );
}

function JSumRow({ k, v, accent, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', fontSize: 12.5 }}>
      <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0, fontSize: 11 }}>{k}</span>
      <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
      <span className={mono ? 'mono' : undefined} style={{
        color: accent || 'var(--ink)', textAlign: 'right', fontWeight: 500,
        maxWidth: '62%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: mono ? 11 : 12.5,
      }}>{v}</span>
    </div>
  );
}

// ═══════════════════ Accueil — flux disponibles ═══════════════════
// Two views: "Aperçus" (rich animated preview rows) and "Registre"
// (dense library/explorer table). Search filters both; scales to hundreds.
function JAccueilPanel({ flows, onPick, onLaunch }) {
  const [q, setQ] = useState('');
  const [view, setView] = useState('apercus'); // 'apercus' | 'registre'

  const qq = q.trim().toLowerCase();
  const indexed = flows.map((f, i) => ({ f, num: i + 1 }));
  const list = qq
    ? indexed.filter(({ f }) =>
        (f.title + ' ' + f.kicker + ' ' + f.produces + ' ' + f.steps.map(s => s.n).join(' ')).toLowerCase().includes(qq))
    : indexed;

  return (
    <div style={{ width: '100%', maxWidth: view === 'library' ? 1180 : 980 }}>
      {/* header */}
      <div style={{ marginBottom: 14 }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12,
        }}>
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
          &nbsp;· Pipelines autonomes
        </div>
        <h1 className="display" style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
        }}>
          Flux <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>disponibles</span>
        </h1>
      </div>

      {/* toolbar — sticky search + view switch + count */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '8px 0 12px', marginBottom: 14,
        background: 'var(--bg)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 190 }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-3)', fontSize: 14, pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un flux, une étape, un résultat…"
            aria-label="Rechercher un flux"
            style={{
              width: '100%', padding: '10px 12px 10px 31px',
              background: 'var(--bg-card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', color: 'var(--ink)',
              fontFamily: 'inherit', fontSize: 13, outline: 'none',
            }} />
        </div>
        <JSegmented value={view} onChange={setView} options={[
          { value: 'apercus', label: 'Aperçus' },
          { value: 'library', label: 'Bibliothèque' },
        ]} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
          padding: '6px 11px', background: 'var(--bg-elev)', border: '1px solid var(--line-soft)', borderRadius: 999,
        }}>
          <strong style={{ color: 'var(--ink-2)' }}>{list.length}</strong>{qq ? ` / ${flows.length}` : ''} flux
        </span>
      </div>

      {list.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)',
        }}>
          <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun flux</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Rien ne correspond à «&nbsp;{q}&nbsp;».</div>
        </div>
      ) : view === 'apercus' ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
            fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)',
          }}>
            <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            Clic sur le <strong style={{ color: 'var(--ink-2)' }}>cercle</strong> = lancer le flux
            <span style={{ color: 'var(--line)' }}>|</span>
            clic sur la <strong style={{ color: 'var(--ink-2)' }}>carte</strong> = voir le détail
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map(({ f, num }) => (
              <JTocRow key={f.id} flow={f} num={num} delay={(num - 1) * 0.45}
                onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
            ))}
          </div>
        </>
      ) : (
        <JLibrary list={list} onPick={onPick} onLaunch={onLaunch} />
      )}
    </div>
  );
}

// Rich animated preview row (loop ring + full preview). Default "Aperçus" view.
function JTocRow({ flow, num, delay, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Circular loop schematic — OUTSIDE the card. Click = launch the flux. */}
      <button type="button" onClick={onLaunch} className="jring-btn"
        title={`Lancer le flux « ${flow.title} »`} aria-label={`Lancer le flux ${flow.title}`}
        style={{ flexShrink: 0 }}>
        <JLoopRing accent={flow.accent} num={num} steps={flow.steps.length} delay={delay} size={62} />
      </button>

      {/* Card — click = open the flow's detail panel. */}
      <button type="button" onClick={onOpen}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="focus-ring"
        style={{
          flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: 16, textAlign: 'left', padding: '15px 20px',
          background: 'var(--bg-card)',
          border: '1px solid ' + (hover ? flow.accent : 'var(--line)'),
          borderRadius: 'var(--radius-lg)',
          boxShadow: hover
            ? `inset 5px 0 0 ${flow.accent}, 0 8px 26px -14px ${flow.accent}`
            : `inset 5px 0 0 ${flow.accent}`,
          cursor: 'pointer',
          transform: hover ? 'translateX(2px)' : 'none',
          transition: 'transform 0.16s, border-color 0.16s, box-shadow 0.28s',
          fontFamily: 'inherit',
        }}>
        <span style={{ minWidth: 0 }}>
          <span className="display" style={{
            display: 'block', fontFamily: 'var(--font-display)',
            fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em',
            color: 'var(--ink)', lineHeight: 1.1,
          }}>{flow.title}</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 7,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexWrap: 'wrap',
          }}>
            <LoopGlyph color={flow.accent} />
            {flow.steps.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
                <span>{s.n}</span>
              </React.Fragment>
            ))}
            <span style={{ color: 'var(--line)', margin: '0 2px' }}>—</span>
            <span style={{ color: flow.accent }}>{flow.produces}</span>
          </span>
        </span>

        <span className="mono" style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? flow.accent : 'var(--ink-3)',
          transition: 'color 0.16s, transform 0.16s',
          transform: hover ? 'translateX(3px)' : 'none',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>détails →</span>
      </button>
    </div>
  );
}

// Dense library/explorer table — catalogs flows in rows. "Registre" view.
function JRegistry({ list, onPick, onLaunch }) {
  const cols = '34px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1fr) 92px';
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '9px 16px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        <span>#</span><span>Flux</span><span>Séquence</span><span>Produit</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>
      {list.map(({ f, num }, i) => (
        <JRegistryRow key={f.id} flow={f} num={num} cols={cols} last={i === list.length - 1}
          onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
      ))}
    </div>
  );
}

function JRegistryRow({ flow, num, cols, last, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '10px 16px', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--line-soft)',
        background: hover ? 'var(--bg-elev)' : 'transparent',
        boxShadow: hover ? `inset 3px 0 0 ${a}` : 'inset 3px 0 0 transparent',
        transition: 'background .12s, box-shadow .12s',
      }}>
      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: a, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${a} 16%, transparent)` }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="display" style={{
          display: 'block', fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{flow.title}</span>
        <span className="mono" style={{ fontSize: 9.5, color: a, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
        {flow.steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
            <span>{s.n}</span>
          </React.Fragment>
        ))}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.produces}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onLaunch(); }}
          title={`Lancer « ${flow.title} »`} aria-label={`Lancer ${flow.title}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            border: `1px solid color-mix(in srgb, ${a} 50%, transparent)`,
            background: `color-mix(in srgb, ${a} 10%, transparent)`,
            color: a, cursor: 'pointer', fontSize: 10, lineHeight: 1,
          }}>▶</button>
        <span className="mono" style={{ fontSize: 13, color: hover ? a : 'var(--ink-3)', transition: 'color .12s', transform: hover ? 'translateX(2px)' : 'none' }}>→</span>
      </span>
    </div>
  );
}

// Tool kinds (API JDM / LLM / logique) a flow touches — used for faceting.
function flowToolKinds(flow) {
  const tools = (typeof FLOW_FAKES !== 'undefined' && FLOW_FAKES[flow.id] ? FLOW_FAKES[flow.id].tools : []) || [];
  const kinds = new Set();
  tools.forEach(t => { const d = (typeof TOOL_DOCS !== 'undefined') && TOOL_DOCS[t]; if (d) kinds.add(d.kind); });
  return [...kinds];
}

// Facet definitions for the library browser.
const J_FACETS = [
  { id: 'category', label: 'Catégorie',    get: (f) => (f.category ? [f.category] : []) },
  { id: 'kind',     label: 'Type d’outil', get: (f) => flowToolKinds(f) },
  { id: 'steps',    label: 'Étapes',       get: (f) => [`${f.steps.length} étapes`] },
  { id: 'tags',     label: 'Tags',         get: (f) => f.tags || [] },
];

// MediaBay-style library: facet sidebar (multi-criteria) + filtered results table.
function JLibrary({ list, onPick, onLaunch }) {
  const [sel, setSel] = useState({});
  const toggle = (gid, val) => setSel(prev => {
    const next = { ...prev };
    const s = new Set(next[gid] || []);
    if (s.has(val)) s.delete(val); else s.add(val);
    next[gid] = s;
    return next;
  });
  const clear = () => setSel({});
  const activeCount = Object.values(sel).reduce((n, s) => n + (s ? s.size : 0), 0);

  const groups = J_FACETS.map(g => {
    const counts = {};
    list.forEach(({ f }) => g.get(f).forEach(v => { counts[v] = (counts[v] || 0) + 1; }));
    const items = Object.keys(counts).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, count: counts[v] }));
    return { ...g, items };
  }).filter(g => g.items.length > 0);

  const results = list.filter(({ f }) =>
    J_FACETS.every(g => {
      const s = sel[g.id];
      if (!s || s.size === 0) return true;
      return g.get(f).some(v => s.has(v));
    })
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '212px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      {/* facet sidebar */}
      <aside style={{
        border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)', overflow: 'hidden', position: 'sticky', top: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-elev)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Filtres</span>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="focus-ring" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Effacer ({activeCount})</button>
          )}
        </div>
        <div className="jpanel-scroll" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
          {groups.map(g => (
            <div key={g.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7, paddingLeft: 2 }}>{g.label}</div>
              <div style={{ display: 'grid', gap: 2 }}>
                {g.items.map(it => {
                  const on = !!(sel[g.id] && sel[g.id].has(it.value));
                  return (
                    <button key={it.value} type="button" onClick={() => toggle(g.id, it.value)} className="focus-ring"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '5px 8px', borderRadius: 'var(--radius)', cursor: 'pointer',
                        border: '1px solid ' + (on ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'transparent'),
                        background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                        textAlign: 'left', fontFamily: 'inherit',
                        transition: 'background .12s, border-color .12s',
                      }}>
                      <span style={{
                        width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                        background: on ? 'var(--accent)' : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--bg)', fontSize: 9, lineHeight: 1,
                      }}>{on ? '✓' : ''}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: on ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.value}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{it.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* results */}
      <div style={{ minWidth: 0 }}>
        {results.length > 0 ? (
          <JRegistry list={results} onPick={onPick} onLaunch={onLaunch} />
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)' }}>
            <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun flux pour ces filtres</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Élargis ta sélection à gauche.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════ Supervision — tableau de bord live ═══════════════════
// Synthetic dashboard: every flux is shown "en cours", with a live preview of
// what's happening inside (current step, growing metrics, streaming results).
function JSupervisionPanel({ flows, onPick, onLaunch, active }) {
  const [tick, setTick] = useState(0);
  const rootRef = useRef(null);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  // On opening Supervision, smooth-scroll its panel back to the top (stats strip).
  useEffect(() => {
    if (!active) return;
    const el = rootRef.current; if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active]);

  const live = flows.map((f, i) => computeFlowLive(f, i, tick));
  const agg = live.reduce((a, l) => ({
    iter: a.iter + l.iter,
    tools: a.tools + l.tools,
    accepted: a.accepted + l.accepted,
    rejected: a.rejected + l.rejected,
  }), { iter: 0, tools: 0, accepted: 0, rejected: 0 });

  return (
    <div ref={rootRef} style={{ width: '100%', maxWidth: 1120 }}>
      {/* ── Masthead ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.16em',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            <span>· Supervision · {flows.length} flux</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--jdm-green)' }}>
              <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> live
            </span>
          </div>
          <h1 className="display" style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)',
            fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1,
            color: 'var(--ink)',
          }}>
            Tableau de <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>bord</span>
          </h1>
        </div>

        <p style={{
          margin: 0, maxWidth: '38ch',
          fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-3)',
        }}>
          Cinq boucles d'agent en cours d'exécution. Chaque carte montre, en
          direct, ce qui se passe à l'intérieur du flux.
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 18,
      }}>
        <JKpi label="Flux actifs"      value={flows.length} sub="en boucle"  dot />
        <JKpi label="Itérations"       value={agg.iter}     sub="cumulées" />
        <JKpi label="Outils appelés"   value={agg.tools}    sub="JDM" />
        <JKpi label="Triplets validés" value={agg.accepted} sub="acceptés" color="var(--jdm-green)" />
      </div>

      {/* ── Live flux grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: 14,
      }}>
        {flows.map((f, i) => (
          <JFlowDashCard key={f.id} flow={f} num={i + 1} live={live[i]}
            onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
        Clic sur le <strong style={{ color: 'var(--ink-2)' }}>cercle</strong> = (re)lancer le flux
        <span style={{ color: 'var(--line)' }}>|</span>
        clic sur la <strong style={{ color: 'var(--ink-2)' }}>carte</strong> = ouvrir le détail
      </div>
    </div>
  );
}

// KPI tile for the dashboard's top strip.
function JKpi({ label, value, sub, color, dot }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '13px 16px' }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {dot && <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />}
        {label}
      </div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
        marginTop: 4, color: color || 'var(--ink)', letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// Derive a flow's live snapshot from a shared heartbeat (tick). Pure + cyclic,
// so each card looks like a pipeline endlessly looping through its candidates.
function computeFlowLive(flow, i, tick) {
  const fake = (typeof FLOW_FAKES !== 'undefined' && FLOW_FAKES[flow.id]) || { tools: [], candidatesPool: [] };
  const pool = fake.candidatesPool.length ? fake.candidatesPool : [{ label: '—', s: 0, ok: true }];
  const dp = (typeof defaultParamsFor === 'function' && defaultParamsFor(flow.id)) || {};
  const maxIter = dp.maxIter || 30;
  const span = Math.min(maxIter, pool.length + 4);
  const iter = ((tick + i * 2) % span) + 1;

  let accepted = 0, rejected = 0, tools = 0;
  for (let k = 0; k < iter; k++) {
    const c = pool[k % pool.length];
    if (c.ok) accepted++; else rejected++;
    tools += 2 + (k % 2);
  }
  const recent = [];
  for (let k = Math.max(0, iter - 3); k < iter; k++) {
    recent.push({ key: k, cand: pool[k % pool.length] });
  }
  const stepIdx = (iter - 1) % flow.steps.length;
  const pct = Math.round((iter / span) * 100);
  return { iter, span, maxIter, accepted, rejected, tools, recent, stepIdx, pct };
}

// One live "monitor" card for a flux — the heart of the dashboard.
function JFlowDashCard({ flow, num, live, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  const tint = (p) => `color-mix(in srgb, ${a} ${p}%, transparent)`;
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid ' + (hover ? a : 'var(--line)'),
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? `0 12px 32px -18px ${a}` : 'var(--shadow-sm)',
        overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform .18s, border-color .16s, box-shadow .28s',
      }}>

      {/* top hairline in the flow's colour */}
      <div style={{ height: 3, background: a, opacity: 0.9 }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px 12px' }}>
        <button type="button" className="jring-btn"
          onClick={(e) => { e.stopPropagation(); onLaunch(); }}
          title={`(Re)lancer « ${flow.title} »`} aria-label={`Lancer ${flow.title}`}
          style={{ flexShrink: 0 }}>
          <JLoopRing accent={a} num={num} steps={flow.steps.length} delay={num * 0.3} size={50} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 10, color: a, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3,
          }}>{flow.kicker}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.05,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{flow.title}</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '4px 9px', borderRadius: 999,
          border: `1px solid ${tint(45)}`, background: tint(8), color: a,
          fontFamily: 'var(--font-mono)', fontSize: 9.5,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          <span className="pulse-dot" style={{ background: a }} /> en cours
        </span>
      </div>

      {/* step pipeline — active step highlighted */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 15px 12px', flexWrap: 'wrap' }}>
        {flow.steps.map((s, k) => {
          const active = k === live.stepIdx;
          return (
            <React.Fragment key={k}>
              {k > 0 && <span style={{ color: 'var(--line)', fontSize: 11 }}>›</span>}
              <span className="mono" style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 999,
                background: active ? tint(14) : 'var(--bg-elev)',
                border: '1px solid ' + (active ? tint(50) : 'var(--line-soft)'),
                color: active ? a : 'var(--ink-3)',
                fontWeight: active ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'all .25s',
              }}>
                {active && <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} />}
                {s.n}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* progress toward the stop criterion */}
      <div style={{ padding: '0 15px 12px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 5,
        }}>
          <span>itér <strong style={{ color: 'var(--ink)' }}>{live.iter}</strong> / {live.span}</span>
          <span style={{ color: a }}>{flow.produces}</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden' }}>
          <div style={{ width: `${live.pct}%`, height: '100%', background: a, borderRadius: 999, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>

      {/* mini metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
        background: 'var(--line-soft)',
        borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <JMini label="acceptés" value={live.accepted} color="var(--jdm-green)" />
        <JMini label="rejetés"  value={live.rejected} color="var(--jdm-magenta)" />
        <JMini label="outils"   value={live.tools} />
      </div>

      {/* live result stream */}
      <div style={{ padding: '10px 15px 6px', flex: 1 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} /> flux en direct
        </div>
        <div style={{ display: 'grid', gap: 4, minHeight: 78 }}>
          {live.recent.map(({ key, cand }) => (
            <div key={key} className="fade-up" style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 8px', borderRadius: 'var(--radius)',
              background: 'var(--bg-elev)', border: '1px solid var(--line-soft)',
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
            }}>
              <span style={{ flexShrink: 0, color: cand.ok ? 'var(--jdm-green)' : 'var(--jdm-magenta)' }}>{cand.ok ? '✓' : '✕'}</span>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cand.label}</span>
              <span style={{ flexShrink: 0, color: 'var(--ink-3)' }}>{cand.s.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 15px', borderTop: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>boucle · {flow.steps.length} étapes</span>
        <span className="mono" style={{
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? a : 'var(--ink-3)',
          transition: 'color .16s, transform .16s',
          transform: hover ? 'translateX(3px)' : 'none',
        }}>détail →</span>
      </div>
    </div>
  );
}

// Compact metric cell inside a dashboard card.
function JMini({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', textAlign: 'left' }}>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
        color: color || 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{label}</div>
    </div>
  );
}

// Loop schematic in two refined, low-saturation styles (Tweaks → Cercles Jarvis):
//   'boucle' — a single repeat/refresh arrow wrapping the number (calm, default).
//   'cycle'  — step nodes joined by directional arcs (the original).
// Colour is desaturated by mixing the flow accent ~50% with a neutral.
function useRingStyle() {
  const get = () => (typeof window !== 'undefined' && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.ringStyle) || 'boucle';
  const [s, setS] = useState(get);
  useEffect(() => {
    const f = () => setS(get());
    window.addEventListener('__jdm_tweaks_changed', f);
    return () => window.removeEventListener('__jdm_tweaks_changed', f);
  }, []);
  return s;
}

function JLoopRing({ accent, num, steps, delay, size = 60 }) {
  const ringStyle = useRingStyle();
  const c = `color-mix(in srgb, ${accent} 50%, var(--ink-3) 50%)`;   // desaturated
  const cx = 32, cy = 32, R = 20;
  const f = (n) => n.toFixed(2);
  const pt = (deg, r = R) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arrow = (deg, ah = 3.4) => {
    const ea = (deg - 90) * Math.PI / 180;
    const tx = -Math.sin(ea), ty = Math.cos(ea);
    const px = Math.cos(ea), py = Math.sin(ea);
    const [ex, ey] = pt(deg);
    return { ex, ey,
      b1: [ex - ah * tx + ah * 0.6 * px, ey - ah * ty + ah * 0.6 * py],
      b2: [ex - ah * tx - ah * 0.6 * px, ey - ah * ty - ah * 0.6 * py] };
  };
  const N = Math.max(2, steps || 2);

  let arcGroup, marks = null;
  if (ringStyle === 'cycle') {
    const gap = N === 2 ? 26 : 22;
    const segs = [];
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const base = i * 360 / N;
      nodes.push(pt(base));
      const s = base + gap, e = (i + 1) * 360 / N - gap;
      const [sx, sy] = pt(s), [ex, ey] = pt(e);
      const large = (e - s) > 180 ? 1 : 0;
      segs.push({ sx, sy, ex, ey, large, a: arrow(e) });
    }
    arcGroup = segs.map((s, i) => (
      <React.Fragment key={i}>
        <path d={`M ${f(s.sx)} ${f(s.sy)} A ${R} ${R} 0 ${s.large} 1 ${f(s.ex)} ${f(s.ey)}`} />
        <path d={`M ${f(s.a.b1[0])} ${f(s.a.b1[1])} L ${f(s.ex)} ${f(s.ey)} L ${f(s.a.b2[0])} ${f(s.a.b2[1])}`} />
      </React.Fragment>
    ));
    marks = nodes.map((n, i) => (
      <g key={i}>
        <circle cx={f(n[0])} cy={f(n[1])} r={3.6} fill="var(--bg-card)" stroke={c} strokeWidth="1.6" />
        <circle cx={f(n[0])} cy={f(n[1])} r={1.6} fill={c} />
      </g>
    ));
  } else {
    // 'boucle' — one near-full loop arrow with a gap at the top.
    const g = 40;
    const s = g, e = 360 - g;
    const [sx, sy] = pt(s), [ex, ey] = pt(e);
    const a = arrow(e, 3.8);
    arcGroup = (
      <React.Fragment>
        <path d={`M ${f(sx)} ${f(sy)} A ${R} ${R} 0 1 1 ${f(ex)} ${f(ey)}`} />
        <path d={`M ${f(a.b1[0])} ${f(a.b1[1])} L ${f(ex)} ${f(ey)} L ${f(a.b2[0])} ${f(a.b2[1])}`} />
      </React.Fragment>
    );
    marks = Array.from({ length: N }).map((_, i) => {
      const base = i * 360 / N;
      if (base < g || base > (360 - g)) return null;
      const [mx, my] = pt(base);
      return <circle key={i} cx={f(mx)} cy={f(my)} r={1.9} fill={c} opacity="0.85" />;
    });
  }

  return (
    <span className="jring" style={{
      position: 'relative', width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" className="jring-halo" style={{
        position: 'absolute', inset: Math.round(size * 0.05), borderRadius: '50%',
        background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
        filter: 'blur(7px)',
        animation: `jorbGlow 3.8s ease-in-out ${delay || 0}s infinite`,
      }} />
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'relative', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={26} fill={c} opacity="0.05" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeWidth="1" opacity="0.16" />
        <g className="jring-arcs" stroke={c} fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {arcGroup}
        </g>
        {marks}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fill={c}
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 17 }}>{num}</text>
      </svg>
    </span>
  );
}

// ═══════════════════ Tool catalog — fiches d'outils ═══════════════════
// Per-tool documentation surfaced in the JToolDialog (clic sur un chip outil).
const TOOL_DOCS = {
  relations_from: {
    sig: 'relations_from(terme, type?) → Relation[]', kind: 'API JDM',
    desc: "Récupère les relations sortantes d'un terme : celles dont le terme est la source. Optionnellement filtrées par type de relation.",
    docstring: `GET /relations/from/{terme}?type={type}

Renvoie les relations sortantes du nœud {terme} dans
JeuxDeMots, triées par poids décroissant. Si {type}
est fourni, ne renvoie que ce type (r_isa, r_carac…).`,
    prompt: `# Outil agent — relations_from
Récolte les indices sortants AVANT de proposer un triplet.

{ "name": "relations_from",
  "args": { "terme": "str", "type": "str?" } }

« Filtre par {type} quand tu cibles une relation précise. »`,
    cli: 'jdm-agent tool relations_from --terme chat --type r_carac',
    output: `[
  { "r": "r_isa",   "node": "félin",   "w": 412 },
  { "r": "r_carac", "node": "agile",   "w": 142 },
  { "r": "r_carac", "node": "curieux", "w":  88 }
]`,
  },
  relations_to: {
    sig: 'relations_to(terme, type?) → Relation[]', kind: 'API JDM',
    desc: "Relations entrantes : celles dont le terme est la cible. Utile pour savoir « qui pointe vers » ce terme.",
    docstring: `GET /relations/to/{terme}?type={type}

Renvoie les relations dont {terme} est le nœud cible.
Ex. relations_to("félin", "r_isa") → les termes qui
sont des félins.`,
    prompt: `# Outil agent — relations_to
Trouve les termes qui pointent VERS la cible.

{ "name": "relations_to",
  "args": { "terme": "str", "type": "str?" } }

« Idéal pour énumérer les hyponymes d'une classe. »`,
    cli: 'jdm-agent tool relations_to --terme félin --type r_isa',
    output: `[
  { "r": "r_isa", "source": "chat",  "w": 380 },
  { "r": "r_isa", "source": "tigre", "w": 210 },
  { "r": "r_isa", "source": "lion",  "w": 198 }
]`,
  },
  analogies: {
    sig: 'analogies(terme, k?) → Analogy[]', kind: 'API JDM',
    desc: "Propose des analogies proportionnelles (a est à b ce que c est à d) à partir du voisinage du terme. Sert à générer des candidats par transfert.",
    docstring: `GET /analogies/{terme}?k={k}

Renvoie les k meilleures analogies proportionnelles
impliquant {terme}, sous la forme a:b :: c:d.`,
    prompt: `# Outil agent — analogies
Génère des candidats par transfert proportionnel.

{ "name": "analogies",
  "args": { "terme": "str", "k": "int?" } }

« Si a:b tient, teste d sur c. »`,
    cli: 'jdm-agent tool analogies --terme chat -k 5',
    output: `[
  { "a":"chat","b":"miauler","c":"chien","d":"aboyer","conf":0.86 },
  { "a":"chat","b":"chaton", "c":"chien","d":"chiot", "conf":0.81 }
]`,
  },
  common_ancestors: {
    sig: 'common_ancestors(t1, t2) → Node[]', kind: 'API JDM',
    desc: "Hyperonymes (r_isa) partagés par deux termes — leurs ancêtres communs dans la taxonomie. Mesure la proximité sémantique.",
    docstring: `GET /common_ancestors?a={t1}&b={t2}

Remonte les chaînes r_isa de {t1} et {t2} et renvoie
leurs ancêtres communs, du plus spécifique au plus général.`,
    prompt: `# Outil agent — common_ancestors
Mesure la parenté sémantique de deux termes.

{ "name": "common_ancestors",
  "args": { "t1": "str", "t2": "str" } }

« Un ancêtre proche = forte parenté. »`,
    cli: 'jdm-agent tool common_ancestors --a chat --b chien',
    output: `[
  { "node": "félin",     "depth": 1 },
  { "node": "mammifère", "depth": 2 },
  { "node": "animal",    "depth": 3 }
]`,
  },
  validate_candidate: {
    sig: 'validate_candidate(triplet) → { ok, score, raison }', kind: 'LLM',
    desc: "Soumet un triplet candidat à un panel de vérifications (poids JDM, contradictions, support croisé) et renvoie un score de confiance et une décision.",
    docstring: `validate_candidate(triplet) → { ok, score, raison }

Wrapper LLM : confronte le triplet aux indices JDM
rassemblés puis rend une décision pondérée.`,
    prompt: `Tu es un validateur de connaissances pour JeuxDeMots.
Triplet : {sujet} | {relation} | {objet}
Indices JDM : {relations_pertinentes}

Évalue si le triplet est plausible. Pénalise toute
contradiction. Réponds en JSON :
{ "ok": bool, "score": 0..1, "raison": str }`,
    cli: 'jdm-agent tool validate_candidate --triplet "chat|r_carac|curieux"',
    output: `{
  "ok": true,
  "score": 0.92,
  "raison": "soutenu par r_carac(chat, curieux) w=88"
}`,
  },
  cross_check: {
    sig: 'cross_check(relation) → Evidence', kind: 'logique',
    desc: "Recoupe une relation avec d'autres relations du graphe pour mesurer son support ou repérer un conflit.",
    docstring: `cross_check(relation) → { support, conflits[] }

Pour R = (s, r, o), collecte les relations voisines qui
la confirment ou l'infirment et calcule un support net
dans [-1, 1].`,
    prompt: `# Outil agent — cross_check
Recoupe une relation avant de la garder.

{ "name": "cross_check",
  "args": { "relation": "s|r|o" } }

« Un support négatif = conflit à examiner. »`,
    cli: 'jdm-agent tool cross_check --relation "chat|r_isa|chien"',
    output: `{
  "relation": "chat | r_isa | chien",
  "support": -0.91,
  "conflits": ["r_isa(chat, félin) w=412"]
}`,
  },
  detect_contradiction: {
    sig: 'detect_contradiction(relation) → Contradiction?', kind: 'logique',
    desc: "Détecte une contradiction logique entre une relation et le reste du voisinage (incompatibilités isa, antonymie, exclusions).",
    docstring: `detect_contradiction(relation) → Contradiction | null

Étant donné R et le voisinage du sujet, cherche une
relation incompatible (ex. deux r_isa mutuellement
exclusifs). Renvoie la plus forte, sinon null.`,
    prompt: `# Outil agent — detect_contradiction
Signale toute incompatibilité logique.

{ "name": "detect_contradiction",
  "args": { "relation": "s|r|o" } }

« isa exclusifs, antonymie → contradiction. »`,
    cli: 'jdm-agent tool detect_contradiction --relation "chat|r_isa|chien"',
    output: `{
  "type": "isa_exclusif",
  "avec": "r_isa(chat, félin)",
  "gravite": "haute"
}`,
  },
  flag_suspect: {
    sig: 'flag_suspect(triplet, raison) → void', kind: 'logique',
    desc: "Marque un triplet comme suspect dans le rapport d'audit, avec la raison et la gravité, pour relecture ultérieure.",
    docstring: `flag_suspect(triplet, raison) → void

Ajoute {triplet} à la liste des suspects du rapport avec
{ raison, gravite, source }. N'écrit jamais dans le graphe.`,
    prompt: `# Outil agent — flag_suspect
Marque, ne corrige pas.

{ "name": "flag_suspect",
  "args": { "triplet": "s|r|o", "raison": "str" } }

« La décision finale revient au relecteur. »`,
    cli: 'jdm-agent tool flag_suspect --triplet "chat|r_has_color|bleu" --raison "poids faible"',
    output: `{
  "flagged": "chat | r_has_color | bleu",
  "raison": "poids faible (w=3)",
  "gravite": "moyenne"
}`,
  },
  refinements_decoded: {
    sig: 'refinements_decoded(terme) → Sense[]', kind: 'API JDM',
    desc: "Renvoie les raffinements sémantiques (sens / gloses) d'un terme polysémique, décodés en libellés lisibles.",
    docstring: `GET /refinements/{terme}

Renvoie les nœuds de raffinement de {terme} (ex.
"souris>animal", "souris>périphérique") avec leur gloss.`,
    prompt: `# Outil agent — refinements_decoded
Désambiguïse un terme polysémique.

{ "name": "refinements_decoded",
  "args": { "terme": "str" } }

« À appeler avant d'étendre ou de vérifier. »`,
    cli: 'jdm-agent tool refinements_decoded --terme souris',
    output: `[
  { "sens": "chat>animal",   "gloss": "félin domestique" },
  { "sens": "chat>logiciel", "gloss": "messagerie instantanée" }
]`,
  },
  extract_claims: {
    sig: 'extract_claims(texte) → Claim[]', kind: 'LLM',
    desc: "Découpe un texte en affirmations atomiques, normalisées en triplets vérifiables.",
    docstring: `extract_claims(texte) → Claim[]

Wrapper LLM : segmente le texte en affirmations
atomiques, chacune normalisée en triplet JDM.`,
    prompt: `Décompose le texte en affirmations atomiques. Pour chacune,
produis un triplet { sujet, relation, objet } normalisé
sur les relations JDM.
Texte : """{texte}"""`,
    cli: 'jdm-agent tool extract_claims --texte "Le chat est un mammifère."',
    output: `[
  { "claim":"Le chat est un mammifère","t":"chat | r_isa | mammifère" },
  { "claim":"Il mange des croquettes", "t":"chat | r_patient | croquette" }
]`,
  },
  verify_claim: {
    sig: 'verify_claim(triplet) → { verdict, conf, preuves }', kind: 'LLM',
    desc: "Confronte une affirmation atomique au graphe JDM et rend un verdict (vrai / faux / indéterminé) avec ses preuves.",
    docstring: `verify_claim(triplet) → { verdict, conf, preuves }

Wrapper LLM : vérifie une affirmation contre JDM
et cite les relations de preuve.`,
    prompt: `Vérifie le triplet {t} contre JeuxDeMots. Cite les
relations de preuve et leur poids. Réponds :
{ "verdict": "vrai|faux|indéterminé", "conf": 0..1, "preuves": [...] }`,
    cli: 'jdm-agent tool verify_claim --triplet "chat|r_isa|mammifère"',
    output: `{
  "verdict": "vrai",
  "conf": 0.97,
  "preuves": ["r_isa(chat, mammifère) w=205"]
}`,
  },
};

// Which step (index into flow.steps) each tool serves, per flow.
const FLOW_TOOL_STEPS = {
  enrich:    { relations_from: 0, relations_to: 0, analogies: 0, common_ancestors: 0, validate_candidate: 1 },
  audit:     { relations_from: 0, cross_check: 1, detect_contradiction: 1, flag_suspect: 2 },
  expand:    { refinements_decoded: 0, relations_from: 1, common_ancestors: 2 },
  factcheck: { extract_claims: 0, verify_claim: 1 },
  synth:     { relations_from: 0, refinements_decoded: 0, common_ancestors: 1 },
};

function JToolCode({ children }) {
  return (
    <pre className="mono" style={{
      margin: 0, padding: '12px 14px', background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
      fontSize: 12, lineHeight: 1.55, color: 'var(--ink-2)',
      overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
    }}>{children}</pre>
  );
}

function JToolSection({ label, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="mono" style={{
        fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

// Copy-to-clipboard button (clipboard API + textarea fallback for sandboxed frames).
function JCopyBtn({ text, dark }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e) => {
    e.stopPropagation();
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    const fb = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {}
      done();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fb);
      } else fb();
    } catch (err) { fb(); }
  };
  return (
    <button type="button" onClick={onCopy} className={dark ? 'jcli-copy' : 'jcode-copy'}
      title="Copier" aria-label="Copier dans le presse-papiers">
      {copied ? '✓ Copié' : '⧉ Copier'}
    </button>
  );
}

// Lightweight syntax highlighter for all code/text zones (rendered on a dark surface).
// Handles JSON, HTTP docstrings, function docs and prompt specs in one pass.
function highlightCode(src) {
  const C = {
    comment: '#6b7280', guill: '#c9a978', verb: '#ff9e64', ph: '#7dcfff',
    key: '#7aa2f7', str: '#9ece6a', num: '#bb9af7', bool: '#ff9e64',
    punct: '#8b92a5', arrow: '#8b92a5',
  };
  const out = [];
  const re = /(#[^\n]*)|(«[^»]*»)|\b(GET|POST|PUT|DELETE|PATCH)\b|(\{[a-zA-Z0-9_]+\})|("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|(→)|([{}\[\],:])/g;
  let last = 0, m, i = 0;
  const push = (txt, color, extra) => out.push(<span key={i++} style={{ color, ...(extra || {}) }}>{txt}</span>);
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(<span key={i++}>{src.slice(last, m.index)}</span>);
    if (m[1] !== undefined) push(m[1], C.comment, { fontStyle: 'italic' });
    else if (m[2] !== undefined) push(m[2], C.guill, { fontStyle: 'italic' });
    else if (m[3] !== undefined) push(m[3], C.verb, { fontWeight: 600 });
    else if (m[4] !== undefined) push(m[4], C.ph);
    else if (m[5] !== undefined) {
      const isKey = m[6] !== undefined;
      push(m[5], isKey ? C.key : C.str);
      if (isKey) push(m[6], C.punct);
    }
    else if (m[7] !== undefined) push(m[7], C.num);
    else if (m[8] !== undefined) push(m[8], C.bool);
    else if (m[9] !== undefined) push(m[9], C.arrow);
    else if (m[10] !== undefined) push(m[10], C.punct);
    last = re.lastIndex;
  }
  if (last < src.length) out.push(<span key={i++}>{src.slice(last)}</span>);
  return out;
}

// Styled code zone — dark surface with a label header + copy button
// (docstring / prompt / output), so it reads clearly as a code/text area.
function JCodeBlock({ tag, code }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 8px 7px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tag || 'CODE'}</span>
        <JCopyBtn text={code} dark />
      </div>
      <pre className="mono" style={{
        margin: 0, padding: '13px 14px', background: '#0f1117',
        fontSize: 12, lineHeight: 1.6, color: '#d6dbe5',
        overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
      }}><code>{highlightCode(code)}</code></pre>
    </div>
  );
}

// Terminal-style block for the CLI command — traffic lights, prompt, copy button.
function JCliBlock({ command }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a' }}>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: '#8b92a5', letterSpacing: '0.04em', marginLeft: 4 }}>zsh — jdm-agent</span>
        <span style={{ marginLeft: 'auto' }}><JCopyBtn text={command} dark /></span>
      </div>
      <div style={{ padding: '13px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span className="mono" style={{ color: '#4ea63c', userSelect: 'none', flexShrink: 0, fontSize: 12.5, lineHeight: 1.6 }}>$</span>
        <code className="mono" style={{ color: '#e6e9ef', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>{command}</code>
      </div>
    </div>
  );
}

// Modal fiche for a single tool, contextualised to the flow it's used in.
function JToolDialog({ flow, tool, onClose }) {
  const doc = TOOL_DOCS[tool] || { sig: tool + '(…)', kind: 'outil', desc: 'Outil interne.', docstring: '—', prompt: '—', cli: tool, output: '—' };
  const a = flow.accent;
  const kindColor = { 'API JDM': 'var(--jdm-cyan)', 'LLM': 'var(--jdm-violet)', 'logique': 'var(--jdm-orange)' }[doc.kind] || a;

  // Every flow whose sequence calls this tool (souvent plus d'une).
  const usages = JARVIS_FLOWS.filter(f => (FLOW_TOOL_STEPS[f.id] || {})[tool] != null);

  const codeTabs = [
    { id: 'docstring', label: 'Docstring', body: doc.docstring, lang: 'text', tag: doc.kind === 'API JDM' ? 'HTTP' : 'DOC' },
    { id: 'prompt',    label: 'Prompt',    body: doc.prompt,    lang: 'text', tag: 'PROMPT' },
    { id: 'cli',       label: 'CLI',       body: doc.cli,       lang: 'sh' },
    { id: 'output',    label: 'Sortie',    body: doc.output,    lang: 'json', tag: 'JSON' },
  ];
  const [tab, setTab] = useState(doc.kind === 'LLM' ? 'prompt' : 'docstring');
  const active = codeTabs.find(t => t.id === tab) || codeTabs[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; };
  }, [onClose]);

  return ReactDOM.createPortal((
    <div onClick={onClose} className="jtool-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'rgba(15,12,8,0.5)',
      backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={doc.sig}
        className="fade-up" style={{
          width: 'min(640px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
          borderTop: `3px solid ${kindColor}`,
        }}>
        {/* header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
          padding: '16px 20px 14px', background: 'var(--bg-card)',
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>{tool}<span style={{ color: 'var(--ink-3)' }}>()</span></span>
              <span className="mono" style={{
                fontSize: 9.5, padding: '3px 8px', borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${kindColor} 50%, transparent)`,
                background: `color-mix(in srgb, ${kindColor} 9%, transparent)`,
                color: kindColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
              }}>{doc.kind}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{doc.sig}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="focus-ring" style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--bg-elev)',
            color: 'var(--ink-2)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '4px 20px 20px' }}>
          <JToolSection label="Description">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{doc.desc}</p>
          </JToolSection>

          <JToolSection label={usages.length > 1 ? 'Inscription dans les séquences' : 'Inscription dans la séquence'}>
            <div style={{ display: 'grid', gap: 10 }}>
              {usages.map(u => {
                const si = (FLOW_TOOL_STEPS[u.id] || {})[tool];
                const isCurrent = u.id === flow.id;
                const uc = u.accent;
                return (
                  <div key={u.id} style={{
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    background: isCurrent ? `color-mix(in srgb, ${uc} 7%, var(--bg-elev))` : 'var(--bg-elev)',
                    border: '1px solid ' + (isCurrent ? `color-mix(in srgb, ${uc} 38%, transparent)` : 'var(--line-soft)'),
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: uc, flexShrink: 0 }} />
                      <span className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{u.title}</span>
                      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{u.kicker}</span>
                      {isCurrent && (
                        <span className="mono" style={{ fontSize: 9, padding: '2px 7px', borderRadius: 999, background: `color-mix(in srgb, ${uc} 15%, transparent)`, color: uc, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>actuel</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: si != null ? 7 : 0 }}>
                      {u.steps.map((s, k) => {
                        const act = k === si;
                        return (
                          <React.Fragment key={k}>
                            {k > 0 && <span style={{ color: 'var(--line)', fontSize: 12 }}>›</span>}
                            <span className="mono" style={{
                              fontSize: 10.5, padding: '3px 9px', borderRadius: 999,
                              background: act ? `color-mix(in srgb, ${uc} 16%, transparent)` : 'var(--bg-card)',
                              border: '1px solid ' + (act ? `color-mix(in srgb, ${uc} 50%, transparent)` : 'var(--line-soft)'),
                              color: act ? uc : 'var(--ink-3)', fontWeight: act ? 600 : 400,
                            }}>{s.n}</span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {si != null && u.steps[si] && (
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)' }}>
                        Étape <strong style={{ color: 'var(--ink-2)' }}>« {u.steps[si].n} »</strong> — {u.steps[si].d}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </JToolSection>

          <JToolSection label="Détails de l'outil">
            <div role="tablist" style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
              {codeTabs.map(t => {
                const on = t.id === tab;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on}
                    onClick={() => setTab(t.id)} className="focus-ring"
                    style={{
                      appearance: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '7px 12px', marginBottom: -1,
                      borderBottom: '2px solid ' + (on ? kindColor : 'transparent'),
                      color: on ? 'var(--ink)' : 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                      fontWeight: on ? 600 : 400, transition: 'color .15s, border-color .15s',
                    }}>{t.label}</button>
                );
              })}
            </div>
            {active.id === 'cli'
              ? <JCliBlock command={doc.cli} />
              : <JCodeBlock tag={active.tag} code={active.body} />}
          </JToolSection>
        </div>
      </div>
    </div>
  ), document.body);
}

// ═══════════════════ Per-flow design panel ═══════════════════
function JFlowPanel({ flow, index, onLaunch, onIndex, onSommaire }) {
  const fake = FLOW_FAKES[flow.id] || { tools: [], candidatesPool: [] };
  const samples = fake.candidatesPool.filter(c => c.ok).slice(0, 4);
  const tools = fake.tools;
  const params = defaultParamsFor(flow.id);
  const [openTool, setOpenTool] = useState(null);
  const panelPos = J_PANELS.findIndex(p => p.id === flow.id);  // position in the carousel track
  const lastFlow = index === JARVIS_FLOWS.length - 1;

  return (
    <div style={{ width: '100%', maxWidth: 1120 }}>
      {openTool && <JToolDialog flow={flow} tool={openTool} onClose={() => setOpenTool(null)} />}
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
        paddingBottom: 16, marginBottom: 24,
        borderBottom: `1px solid var(--line)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            type="button"
            onClick={onLaunch}
            className="jring-btn"
            title="Lancer ce flux"
            aria-label="Lancer ce flux"
            style={{ flexShrink: 0 }}>
            <JLoopRing accent={flow.accent} num={index + 1} steps={flow.steps.length} delay={0} size={90} />
          </button>
          <div>
            <div className="mono" style={{
              fontSize: 11, color: flow.accent, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{flow.kicker} · {index + 1} / {JARVIS_FLOWS.length}</div>
            <h1 className="display" style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 3.6vw, 44px)', fontWeight: 500,
              letterSpacing: '-0.02em', lineHeight: 1.02, color: 'var(--ink)',
            }}>{flow.title}</h1>
            <div style={{ marginTop: 9, display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>produit</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 17, color: 'var(--ink-2)',
              }}>{flow.produces}</span>
            </div>
          </div>
        </div>
        <div className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${flow.accent} 55%, var(--line))`,
          color: `color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`,
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          background: `color-mix(in srgb, ${flow.accent} 7%, transparent)`,
        }}>
          <LoopGlyph color={`color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`} /> boucle · {flow.steps.length} étapes
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 26,
        alignItems: 'start',
      }}>
        {/* ── Left : the design of the flow, in sequence ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{
            margin: 0, fontSize: 15, lineHeight: 1.6,
            color: 'var(--ink-2)', maxWidth: '58ch',
          }}>{flow.desc}</p>

          <JLoopDiagram flow={flow} />

          {tools.length > 0 && (
            <div>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Outils JDM mobilisés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tools.map(t => (
                  <button key={t} type="button" onClick={() => setOpenTool(t)}
                    className="jtool-chip" title={`Voir la fiche de ${t}()`}
                    style={{
                      fontSize: 11, padding: '4px 9px',
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: 'var(--radius)', color: 'var(--ink-2)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      transition: 'border-color .14s, color .14s, background .14s',
                    }}>{t}()<span style={{ opacity: 0.5, fontSize: 10 }}>↗</span></button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right : params preview + sample output + CTA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={16} style={{ borderTop: `3px solid ${flow.accent}` }}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
            }}>Tu paramètres</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {Object.entries(params).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5,
                }}>
                  <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{PARAM_LABELS[k] || k}</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
                  <span className="mono" style={{
                    color: 'var(--ink)', textAlign: 'right', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%',
                  }}>{formatParam(k, v)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '9px 14px', background: 'var(--bg-elev)',
              borderBottom: '1px solid var(--line-soft)',
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Aperçu des résultats validés</div>
            </div>
            <div style={{ padding: 10, display: 'grid', gap: 4 }}>
              {samples.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', background: 'var(--bg-elev)',
                  border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>✓</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{s.s.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '8px 14px', borderTop: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)', fontFamily: 'var(--font-mono)',
              fontSize: 10.5, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Exemple · la boucle en accumule davantage</div>
          </Card>

          <Button full size="lg" onClick={onLaunch}>▶ Lancer ce flux</Button>
        </div>
      </div>

      {/* Footer : sequence position + step within the run */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginTop: 26, paddingTop: 16,
        borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap',
      }}>
        <button type="button" onClick={onSommaire} className="focus-ring" style={ghostLinkStyle}>
          ↖ Accueil
        </button>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
          FLUX {String(index + 1).padStart(2, '0')} / {String(JARVIS_FLOWS.length).padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onIndex(panelPos - 1)} className="focus-ring" style={ghostLinkStyle}>
            ‹ Précédent
          </button>
          <button type="button"
            onClick={() => lastFlow ? onSommaire() : onIndex(panelPos + 1)}
            className="focus-ring" style={ghostLinkStyle}>
            {lastFlow ? 'Accueil ›' : 'Suivant ›'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostLinkStyle = {
  background: 'transparent', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '6px 12px',
  color: 'var(--ink-2)', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: 11,
  letterSpacing: '0.05em',
};

const PARAM_LABELS = {
  term: 'terme', relation: 'relation', maxIter: 'itér. max',
  minConf: 'confiance min', depth: 'profondeur', text: 'texte', concept: 'concept',
};
function formatParam(k, v) {
  if (k === 'minConf') return Math.round(v * 100) + ' %';
  if (k === 'text') return '« ' + String(v).slice(0, 28) + '… »';
  if (k === 'relation') return String(v);
  return String(v);
}

// ─── Loop diagram : the flow's steps laid out in sequence, looping ───
function JLoopDiagram({ flow }) {
  const mc = `color-mix(in srgb, ${flow.accent} 58%, var(--ink-3) 42%)`;
  const lineCol = `color-mix(in srgb, ${flow.accent} 30%, var(--line))`;
  const steps = flow.steps;
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--line-soft)',
      }}>
        <LoopGlyph color={mc} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>La boucle, étape par étape</span>
      </div>

      <div style={{ padding: '16px 18px 14px' }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: mc, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                  boxShadow: `0 2px 6px -2px ${mc}`,
                }}>{i + 1}</span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 14, background: lineCol, marginTop: 4, borderRadius: 2 }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, paddingTop: 3 }}>
                <div className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
                }}>{s.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 3 }}>{s.d}</div>
              </div>
            </div>
          );
        })}

        {/* loop-back to step 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none" aria-hidden="true">
              <path d="M14 4 A 8 8 0 1 1 6 12" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M11 3 L14 4 L13 7" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mono" style={{
            alignSelf: 'center', fontSize: 11, color: mc,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>recommence — jusqu'au critère d'arrêt</div>
        </div>
      </div>
    </div>
  );
}

function JArrow({ color }) {
  return (
    <div style={{
      flex: '0 0 30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'flex-start', marginTop: 6, color,
    }}>
      <svg width="26" height="14" viewBox="0 0 26 14" fill="none">
        <path d="M1 7 H22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M18 3 L23 7 L18 11" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

// ─── Sommaire horizontal — the three top-level Jarvis sections ───
function JSectionNav({ activeSection, onSelect, hidden }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activeSection];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ x: ir.left - cr.left + cont.scrollLeft, w: ir.width, ready: true });
  }, [activeSection]);

  return (
    <nav ref={containerRef} aria-label="Sections Jarvis" style={{
      position: 'fixed', top: 72, left: '50%',
      transform: hidden ? 'translateX(-50%) translateY(-160%)' : 'translateX(-50%) translateY(0)',
      opacity: hidden ? 0 : 1,
      pointerEvents: hidden ? 'none' : 'auto',
      transition: 'transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease',
      display: 'flex', alignItems: 'center', gap: 2, padding: 5,
      maxWidth: 'calc(100vw - 32px)', overflowX: 'auto',
      background: 'var(--bg-card)', border: '1px solid var(--line)',
      borderRadius: 999, boxShadow: 'var(--shadow)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 40, scrollbarWidth: 'none',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: indicator.x, width: indicator.w,
        top: 5, bottom: 5, background: 'var(--accent)', borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
        zIndex: 0,
      }} />
      {J_SECTIONS.map((p, i) => {
        const active = activeSection === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button" onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`} aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: 'transparent', border: 'none',
              borderRadius: 999, cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
              transition: 'color 0.32s 0.05s',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13,
              opacity: active ? 0.9 : 0.5, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── (legacy) Carousel navigation — kept for reference, no longer mounted ───
function JFlowNav({ navStyle, activePanel, onSelect }) {
  const [wide, setWide] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1100 : true);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (navStyle === 'left' && wide) return <JNavRail activePanel={activePanel} onSelect={onSelect} />;
  return <JNavBottom activePanel={activePanel} onSelect={onSelect} />;
}

function JNavBottom({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ x: ir.left - cr.left + cont.scrollLeft, w: ir.width, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre flux" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 2, padding: 6,
      maxWidth: 'calc(100vw - 32px)', overflowX: 'auto',
      background: 'var(--bg-card)', border: '1px solid var(--line)',
      borderRadius: 999, boxShadow: 'var(--shadow)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 40, scrollbarWidth: 'none',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: indicator.x, width: indicator.w,
        top: 6, bottom: 6, background: 'var(--accent)', borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
        zIndex: 0,
      }} />
      {J_PANELS.map((p, i) => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button" onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 13px', background: 'transparent', border: 'none',
              borderRadius: 999, cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
              transition: 'color 0.32s 0.05s',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
              opacity: active ? 0.85 : 0.55, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
            }}>{String(i).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function JNavRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre flux" style={{
      position: 'fixed', left: 32, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 0, zIndex: 40,
      borderLeft: '1px solid var(--line)', paddingLeft: 16,
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: -1, top: indicator.y, height: indicator.h,
        width: 2, background: 'var(--accent)', opacity: indicator.ready ? 1 : 0,
        transition: 'top 0.42s cubic-bezier(0.4,0,0.2,1), height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
      }} />
      {J_PANELS.map((p, i) => (
        <JRailItem key={p.id}
          ref={el => { if (el) itemRefs.current[p.id] = el; }}
          num={String(i).padStart(2, '0')} label={p.label}
          active={activePanel === p.id} onClick={() => onSelect(p.id)} />
      ))}
    </nav>
  );
}

const JRailItem = React.forwardRef(function JRailItem({ num, label, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? 'var(--accent)' : (hover ? 'var(--ink)' : 'var(--ink-3)');
  return (
    <button ref={ref} type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={`Aller à ${label}`}
      style={{
        background: 'transparent', border: 'none', padding: '13px 0',
        cursor: 'pointer', textAlign: 'left', display: 'flex',
        flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        position: 'relative', color, transition: 'color 0.32s', fontFamily: 'inherit',
      }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 20, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.01em', color: 'inherit',
      }}>{num}</span>
      <span className="mono" style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
        color: 'inherit', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
});

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
