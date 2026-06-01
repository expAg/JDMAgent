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

// ─────────── Router URL (history.pushState + popstate) ───────────
//
// Map view ↔ pathname. Le préfixe de déploiement est lu depuis le
// <base href> injecté par FastAPI (`/jdm-agent/` en prod LIRMM, `/` en
// dev). Ça strippe automatiquement quel que soit l'environnement.
//
// Vues supportées : 8 top-level (cf. VIEWS). Jarvis a en plus des
// sous-routes /jarvis/<flow> qui pré-remplissent
// window.__jdmPendingPayload.jarvis.flow (lu par ViewJarvis au mount).
const _VALID_VIEWS = ['projet', 'explorer', 'claim', 'subgraph',
                       'agent', 'jarvis', 'productions', 'aide'];

function _appBase() {
  if (typeof document === 'undefined') return '';
  const b = document.querySelector('base');
  const href = (b && b.getAttribute('href')) || '/';
  // "/jdm-agent/" → "/jdm-agent" ; "/" → ""
  return href.replace(/\/+$/, '');
}

function _parseRoute(pathname) {
  const base = _appBase();
  let p = pathname || '/';
  if (base && p.startsWith(base)) p = p.slice(base.length);
  if (!p.startsWith('/')) p = '/' + p;
  const segs = p.split('/').filter(Boolean);
  const view = (segs[0] || 'projet').toLowerCase();
  const sub = segs[1] || null;
  return _VALID_VIEWS.includes(view) ? { view, sub } : { view: 'projet', sub: null };
}

function _buildPath(view, sub) {
  const base = _appBase();
  if (!view || view === 'projet') return base + '/';
  let p = base + '/' + view;
  if (sub) p += '/' + sub;
  return p;
}

// Exposé sur window pour que ViewJarvis (et autres) puissent pousser
// leurs sous-routes sans drilling de props.
if (typeof window !== 'undefined') {
  window.__jdmRoute = {
    push(view, sub) {
      if (!window.history || !window.history.pushState) return;
      const target = _buildPath(view, sub);
      if (window.location.pathname === target) return;
      window.history.pushState({ view, sub }, '', target);
    },
    replace(view, sub) {
      if (!window.history || !window.history.replaceState) return;
      const target = _buildPath(view, sub);
      window.history.replaceState({ view, sub }, '', target);
    },
  };
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Vue initiale tirée de l'URL (deep linking : /jarvis/enrich → jarvis
  // avec flow=enrich préchargé dans le pending payload).
  const _initialRoute = (typeof window !== 'undefined')
    ? _parseRoute(window.location.pathname)
    : { view: 'projet', sub: null };
  if (_initialRoute.view === 'jarvis' && _initialRoute.sub
      && typeof window !== 'undefined') {
    window.__jdmPendingPayload = window.__jdmPendingPayload || {};
    window.__jdmPendingPayload.jarvis = Object.assign(
      {}, window.__jdmPendingPayload.jarvis || {},
      { flow: _initialRoute.sub }
    );
  }
  const [view, setView] = useState(_initialRoute.view);

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

  // ─── Router : push URL on view change + listen popstate ───
  //
  // Premier render : remplace l'entrée d'historique pour normaliser
  // l'URL (utile si l'utilisateur a tapé /JDM-AGENT/ ou un truc capi
  // inconsistant — on rentre dans l'app avec le path canonique).
  const _viewMountedRef = useRef(false);
  useEffect(() => {
    if (!_viewMountedRef.current) {
      _viewMountedRef.current = true;
      if (window.__jdmRoute) window.__jdmRoute.replace(view, null);
      return;
    }
    if (window.__jdmRoute) window.__jdmRoute.push(view, null);
  }, [view]);

  // Favicon par vue : tête du robot sur l'onglet Jarvis, logo sun-network
  // (le logo du site) partout ailleurs. On swap l'attribut href du <link>.
  useEffect(() => {
    const ROBOT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='11 6 58 58'%3E%3Cdefs%3E%3ClinearGradient id='v' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23E63B7A'/%3E%3Cstop offset='.25' stop-color='%23F5C518'/%3E%3Cstop offset='.5' stop-color='%235FB94A'/%3E%3Cstop offset='.75' stop-color='%232BB8D4'/%3E%3Cstop offset='1' stop-color='%238A5CD4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cline x1='40' y1='21' x2='40' y2='13' stroke='%232BD4C0' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='40' cy='10.5' r='4' fill='%232BD4C0'/%3E%3Crect x='16' y='21' width='48' height='43' rx='17' fill='%23f3eee2'/%3E%3Crect x='21' y='28' width='38' height='27' rx='12' fill='url(%23v)' opacity='.95'/%3E%3Crect x='23.5' y='30.5' width='33' height='22' rx='10' fill='%230b0c10'/%3E%3Ccircle cx='33' cy='41.5' r='5' fill='%232BD4C0'/%3E%3Ccircle cx='47' cy='41.5' r='5' fill='%232BD4C0'/%3E%3C/svg%3E";
    const SUN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='13 13 54 54'%3E%3Ccircle cx='40' cy='18' r='4.5' fill='%23E63B7A'/%3E%3Ccircle cx='55.6' cy='24.4' r='4.5' fill='%23F5C518'/%3E%3Ccircle cx='62' cy='40' r='4.5' fill='%235FB94A'/%3E%3Ccircle cx='55.6' cy='55.6' r='4.5' fill='%232BB8D4'/%3E%3Ccircle cx='40' cy='62' r='4.5' fill='%238A5CD4'/%3E%3Ccircle cx='24.4' cy='55.6' r='4.5' fill='%23E63B7A'/%3E%3Ccircle cx='18' cy='40' r='4.5' fill='%23F5C518'/%3E%3Ccircle cx='24.4' cy='24.4' r='4.5' fill='%235FB94A'/%3E%3Ccircle cx='40' cy='40' r='9' fill='%23c0411a'/%3E%3C/svg%3E";
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      link.setAttribute('type', 'image/svg+xml');
      document.head.appendChild(link);
    }
    link.setAttribute('href', view === 'jarvis' ? ROBOT : SUN);
  }, [view]);

  // Titre d'onglet par route : « JDM Agent » à l'accueil, « JDM Agent - <page> »
  // ailleurs ; Jarvis garde son identité d'orchestrateur.
  useEffect(() => {
    const TITLES = {
      projet:      'JDM Agent',
      explorer:    'JDM Agent - Explorer',
      claim:       'JDM Agent - Claim',
      subgraph:    'JDM Agent - Sous-graphe',
      agent:       'JDM Agent - Chatbot',
      productions: 'JDM Agent - Productions',
      aide:        'JDM Agent - Aide',
      jarvis:      'Jarvis : Orchestrateur',
    };
    document.title = TITLES[view] || 'JDM Agent';
  }, [view]);

  // Reconcile au boot : si des runs Jarvis tournaient encore côté
  // serveur quand l'utilisateur a fermé la tab / refresh, on s'y
  // rebranche pour récupérer la progression. Fire-and-forget.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__jdmJarvisStore) {
      window.__jdmJarvisStore.bootReconcile?.();
    }
  }, []);

  // Clic sur la pill « N/M flux » du header (ProductionsCountPill) →
  // ouvre l'onglet Jarvis. ViewJarvis ecoute le meme event pour
  // basculer sur le panneau Supervision (panelIndex=2).
  useEffect(() => {
    const onGoToSup = () => setView('jarvis');
    window.addEventListener('jdm-goto-jarvis-supervision', onGoToSup);
    return () => window.removeEventListener('jdm-goto-jarvis-supervision', onGoToSup);
  }, []);

  // popstate (back/forward navigateur) : on relit l'URL et on switche.
  // Si la nouvelle URL contient une sous-route Jarvis, on injecte le
  // pending payload AVANT setView pour que ViewJarvis ouvre le bon flow.
  useEffect(() => {
    const handler = (e) => {
      const r = _parseRoute(window.location.pathname);
      if (r.view === 'jarvis' && r.sub) {
        window.__jdmPendingPayload = window.__jdmPendingPayload || {};
        window.__jdmPendingPayload.jarvis = Object.assign(
          {}, window.__jdmPendingPayload.jarvis || {},
          { flow: r.sub }
        );
      }
      setView(r.view);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Routing inter-vues : permet à n'importe quel composant de naviguer
  // via window.dispatchEvent(new CustomEvent('jdm:goto', { detail: { view, term, ... } })).
  // Le `term` est posé sur window.__jdmPendingTerm pour que la vue cible
  // puisse le lire au premier render (pas de prop drilling).
  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      if (d.term) window.__jdmPendingTerm = d.term;
      // Payload générique : la vue cible le lira à son premier render via
      // window.__jdmPendingPayload?.[view]. Ex : { jarvis: { flow, term } }.
      if (d.payload && d.view) {
        window.__jdmPendingPayload = window.__jdmPendingPayload || {};
        window.__jdmPendingPayload[d.view] = d.payload;
      }
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
                onClick={() => {
                  // Reset event SYSTEMATIQUE au clic d'un onglet — pour que
                  // les vues remontent au panel d'entree. Dispatch DEUX
                  // fois : avant setView (capte le cas « deja sur cette vue »
                  // ou le listener est deja attache) ET dans un microtask
                  // apres setView (capte le cas « on vient d'une autre vue »
                  // ou la vue cible vient juste de monter — son listener
                  // existe maintenant). Sans le double, le tout-premier
                  // mount de la vue ne recoit pas le signal. Idempotent.
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('jdm-nav-reset', { detail: { view: id } }));
                  }
                  setView(id);
                  if (typeof window !== 'undefined') {
                    setTimeout(() => window.dispatchEvent(
                      new CustomEvent('jdm-nav-reset', { detail: { view: id } })
                    ), 0);
                  }
                }}
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

