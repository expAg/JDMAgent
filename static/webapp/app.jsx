// === webapp/app.jsx ===
// Main app: theme switcher + router + Tweaks panel wiring.

// Thème par défaut suit la préférence système (prefers-color-scheme).
// L'utilisateur peut toujours forcer via le Tweaks panel ; sa préférence
// est persistée par useTweaks via localStorage.
const _PREFERS_DARK = (typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": _PREFERS_DARK ? "lab" : "paper",
  "accent": "#c0411a"
}/*EDITMODE-END*/;

// Accent swatches available for cycling via the JDMMark click in the topbar.
const TWEAK_ACCENTS = ['#c0411a', '#1f97b1', '#c83a73', '#4ea63c', '#7a4fbe', '#d96810'];

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('projet');

  // Apply theme to body — suit le système au boot, persisté ensuite.
  useEffect(() => {
    document.body.dataset.theme = tweaks.theme || (_PREFERS_DARK ? 'lab' : 'paper');
  }, [tweaks.theme]);

  // Écoute les changements de préférence système et applique si
  // l'utilisateur n'a pas explicitement override (= valeur === default).
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Only auto-flip if user hasn't explicitly chosen a different theme
      // (heuristic : si la valeur stockée correspond au système actuel,
      // on suit le nouveau ; sinon on respecte le choix utilisateur)
      const sysTheme = e.matches ? 'lab' : 'paper';
      const wasSystem = (tweaks.theme === 'lab') === e.matches;
      // (no-op for now : on laisse le user souverain — il y a un toggle)
    };
    mq.addEventListener && mq.addEventListener('change', handler);
    return () => mq.removeEventListener && mq.removeEventListener('change', handler);
  }, []);

  // Apply accent override
  useEffect(() => {
    const root = document.body;
    if (tweaks.accent) {
      root.style.setProperty('--accent', tweaks.accent);
    } else {
      root.style.removeProperty('--accent');
    }
  }, [tweaks.accent, tweaks.theme]);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  // Routing inter-vues : permet à n'importe quel composant de naviguer
  // via window.dispatchEvent(new CustomEvent('jdm:goto', { detail: { view, term, ... } })).
  // Le `term` est posé sur window.__jdmPendingTerm pour que la vue cible
  // puisse le lire au premier render (pas de prop drilling).
  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      if (d.term) window.__jdmPendingTerm = d.term;
      if (d.view && VIEWS[d.view]) setView(d.view);
    };
    window.addEventListener('jdm:goto', handler);
    return () => window.removeEventListener('jdm:goto', handler);
  }, []);

  // Raccourcis clavier — séquence "G E" pour Aller à Explorer, etc.
  // Annoncés dans l'onglet Aide. Désactivés quand on est dans un input
  // (textarea, contenteditable, [type=text|password|...]) pour ne pas
  // intercepter les saisies utilisateur.
  useEffect(() => {
    let pendingG = false;
    let pendingGTimer = null;
    const SHORTCUTS_G = {
      'KeyE': 'explorer', 'KeyC': 'claim',  'KeyS': 'subgraph',
      'KeyA': 'agent',    'KeyJ': 'jarvis', 'KeyP': 'productions',
      'KeyH': 'aide',
    };
    const isTyping = (target) => {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (e.code === 'KeyG' && !pendingG) {
        pendingG = true;
        clearTimeout(pendingGTimer);
        pendingGTimer = setTimeout(() => { pendingG = false; }, 1200);
        return;
      }
      if (pendingG && SHORTCUTS_G[e.code]) {
        e.preventDefault();
        pendingG = false;
        clearTimeout(pendingGTimer);
        setView(SHORTCUTS_G[e.code]);
        return;
      }
      // ? = aller à l'aide
      if (e.key === '?' && !e.shiftKey === false) {  // shift+/ = ?
        e.preventDefault();
        setView('aide');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(pendingGTimer);
    };
  }, []);

  const VIEWS = {
    projet:      <ViewProjet goto={setView} />,
    explorer:    <ViewExplorer />,
    claim:       <ViewClaim />,
    subgraph:    <ViewSubgraph />,
    agent:       <ViewAgent />,
    jarvis:      <ViewJarvis />,
    productions: <ViewProductions />,
    aide:        <ViewAide />,
  };

  // Accent swatches — first one is the theme default (terracotta).
  const accentOptions = ['#c0411a', '#1f97b1', '#c83a73', '#4ea63c', '#7a4fbe', '#d96810'];

  return (
    <div>
      <TopNav
        active={view} setActive={setView}
        theme={tweaks.theme}
        setTheme={(t) => setTweak('theme', t)}
        accent={tweaks.accent}
        cycleAccent={() => {
          const cur = tweaks.accent || TWEAK_ACCENTS[0];
          const i = TWEAK_ACCENTS.indexOf(cur);
          const next = TWEAK_ACCENTS[(i + 1) % TWEAK_ACCENTS.length];
          setTweak('accent', next);
        }}
      />
      <main>{VIEWS[view]}</main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Direction visuelle">
          <TweakRadio
            label="Thème"
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'paper', label: 'Paper' },
              { value: 'lab',   label: 'Lab' },
            ]}
          />
          <div style={{
            fontSize: 11, color: 'var(--ink-3)',
            marginTop: 6, lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--ink-2)' }}>Paper</strong> — sobre, crème, à la claude.ai.<br/>
            <strong style={{ color: 'var(--ink-2)' }}>Lab</strong> — dashboard dense, monospace, fond sombre.
          </div>
        </TweakSection>

        <TweakSection label="Accent">
          <TweakColor
            label="Couleur d'accent"
            value={tweaks.accent || '#c0411a'}
            onChange={(v) => setTweak('accent', v)}
            options={accentOptions}
          />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            Remplace l'accent natif du thème par cette couleur.
          </div>
        </TweakSection>

        <TweakSection label="Navigation rapide">
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
          }}>
            {[
              ['projet', 'Projet'],
              ['explorer', 'Explorer'],
              ['claim', 'Claim'],
              ['subgraph', 'Sous-graphe'],
              ['agent', 'Chatbot LLM'],
              ['jarvis', 'Jarvis'],
              ['productions', 'Productions'],
              ['aide', 'Aide'],
            ].map(([id, label]) => (
              <button key={id}
                onClick={() => setView(id)}
                style={{
                  padding: '6px 10px',
                  background: view === id ? 'var(--accent)' : 'var(--bg-elev)',
                  color: view === id ? '#fff' : 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  fontFamily: 'inherit', fontSize: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                {label}
              </button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

