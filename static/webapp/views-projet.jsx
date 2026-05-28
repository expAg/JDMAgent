// View: Projet — landing page.
//
// Three vertical panels with scroll-snap:
//   1. Hero        : animated graph + chat demo (top), then text + stats (bottom)
//   2. Modules     : SectionTitle + carousel of 5 feature cards
//   3. Sous le capot : 4 briefs + footer
//
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).
// All canonical text from the original views-projet.jsx is preserved.

// Palette commune (stats + feature cards) — accents JDM.
const ACCENT_PALETTE = [
  'var(--jdm-yellow)',
  'var(--jdm-orange)',
  'var(--jdm-magenta)',
  'var(--jdm-green)',
  'var(--jdm-cyan)',
];

// Mélange Fisher-Yates puis renvoie N premières — garantit que toutes
// les couleurs sont distinctes (tant que N ≤ taille de palette).
function useShuffledAccents(n) {
  return React.useMemo(() => {
    const a = ACCENT_PALETTE.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const out = [];
    for (let k = 0; k < n; k++) out.push(a[k % a.length]);
    return out;
  }, [n]);
}

// PANELS — ordre VISUEL pour navigation :
//   • bref     (Sous le capot)  → à gauche / en haut
//   • hero     (Présentation)   → au centre (entrée par défaut)
//   • modules  (Modules)        → à droite / en bas
// Cet ordre détermine la position sur la track ; index initial = 1 (hero).
const PANELS = [
  { id: 'bref',     label: 'Sous le capot',  symbol: '♠' },
  { id: 'hero',     label: 'Présentation',   symbol: '♥' },
  { id: 'modules',  label: 'Modules',        symbol: '♦' },
];

function ViewProjet({ goto }) {
  // ─── Carousel state ───
  // Au lieu de scroll-snap natif, on utilise une track translatée. C'est
  // un "carousel géant" — toute la page glisse comme un bloc.
  // direction = 'vertical' (translateY) ou 'horizontal' (translateX).
  // La nav du bas force horizontal, le rail gauche force vertical.
  const [panelIndex, setPanelIndex] = useState(1);  // hero = milieu = entrée par défaut
  const [direction, setDirection] = useState('vertical');
  const [transitioning, setTransitioning] = useState(true);
  const totalPanels = PANELS.length;

  const goToIndex = useCallback((i) => {
    setPanelIndex(Math.max(0, Math.min(totalPanels - 1, i)));
  }, [totalPanels]);

  const activePanel = PANELS[panelIndex].id;

  // Handlers spécifiques aux 2 navs : forcent la direction d'anim.
  // Si on switche de direction (V→H ou H→V), on snap d'abord au même
  // panelIndex dans la nouvelle direction (sans anim), puis on anime
  // vers la cible. Évite le « slide diagonal » disgracieux.
  const switchTo = (newDir, targetIdx) => {
    if (direction === newDir) {
      goToIndex(targetIdx);
      return;
    }
    // Phase 1 — snap sans anim à la nouvelle direction, panelIndex inchangé.
    setTransitioning(false);
    setDirection(newDir);
    // Phase 2 — sur le frame suivant (double rAF pour que React ait
    // committé le snap), on ré-active l'anim et on bouge vers la cible.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
        goToIndex(targetIdx);
      });
    });
  };
  const goFromBottom = (id) => {
    const idx = PANELS.findIndex(p => p.id === id);
    if (idx >= 0) switchTo('horizontal', idx);
  };
  const goFromLeft = (id) => {
    const idx = PANELS.findIndex(p => p.id === id);
    if (idx >= 0) switchTo('vertical', idx);
  };

  // ─── Wheel : un cran de molette = un panneau, debouncé ───
  useEffect(() => {
    let lock = false;
    let resetTimer = null;
    const onWheel = (e) => {
      // Ne pas bloquer le scroll dans les zones internes scrollables
      // (carousel des cards, log Jarvis, etc.) — on check si le scroll
      // peut être absorbé par un ancêtre.
      let el = e.target;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll')
            && el.scrollHeight > el.clientHeight) {
          return;  // un parent gère, on laisse passer
        }
        el = el.parentElement;
      }
      e.preventDefault();
      if (lock) return;
      lock = true;
      const dir = e.deltaY > 0 ? 1 : -1;
      setPanelIndex(prev => Math.max(0, Math.min(totalPanels - 1, prev + dir)));
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { lock = false; }, 850);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      clearTimeout(resetTimer);
    };
  }, [totalPanels]);

  // ─── Clavier : flèches up/down, page up/down, home/end ───
  useEffect(() => {
    const onKey = (e) => {
      // N'interfère pas si on est dans un input/textarea
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(panelIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(panelIndex - 1);
      } else if (e.key === 'Home') {
        goToIndex(0);
      } else if (e.key === 'End') {
        goToIndex(totalPanels - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelIndex, goToIndex, totalPanels]);

  // ─── Touch : swipe haut/bas ───
  useEffect(() => {
    let startY = null;
    const onStart = (e) => { startY = e.touches[0].clientY; };
    const onEnd = (e) => {
      if (startY == null) return;
      const endY = e.changedTouches[0].clientY;
      const dy = startY - endY;
      if (Math.abs(dy) > 50) {
        goToIndex(panelIndex + (dy > 0 ? 1 : -1));
      }
      startY = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [panelIndex, goToIndex]);

  // Stats — chiffres tirés du README JDM (LIRMM/CNRS) et du projet.
  const stats = [
    { label: 'Termes JDM',   value: '2M+',    sub: 'JeuxDeMots'    },
    { label: 'Relations',    value: '180+',   sub: 'types typées'  },
    { label: 'Outils MCP',   value: '35',     sub: 'LangChain · FastMCP' },
    { label: 'Flux Jarvis',  value: '5',      sub: 'guidés'        },
  ];

  // Features
  const features = [
    {
      id: 'jarvis',
      title: '🤖 Jarvis',
      kind: '5 flux',
      primary: true,
      desc: 'Flux guidés par formulaires (zéro prompt à taper) : Enrichissement (.enrich), Audit (.audit), Détection de trous, Signalement (.err), Statistiques.',
      example: 'enrichissement → 17 triplets consolidés',
    },
    {
      id: 'agent',
      title: '💬 Chatbot LLM',
      kind: 'LLM · BYOK',
      desc: 'Conversation avec un agent (Gemini hébergé gratuit, ou BYOK Claude/GPT) qui n\'utilise QUE les outils JDM et cite ses sources.',
      example: '« Que mange typiquement un chat ? »',
    },
    {
      id: 'subgraph',
      title: '🕸️ Sous-graphe',
      kind: 'visuel',
      desc: 'Visualisation interactive (vis-network) du voisinage sémantique d\'un terme jusqu\'à profondeur 4, sélection de relations indépendante par niveau, négations en rouge.',
      example: 'plat asiatique · depth 1 · 8 relations',
    },
    {
      id: 'claim',
      title: '⚖️ Claim checker',
      kind: 'déterministe',
      desc: 'Vérifie une affirmation factuelle contre JDM de façon déterministe (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN avec citations des triplets utilisés.',
      example: 'baleine | r_isa | poisson → ❌',
    },
    {
      id: 'explorer',
      title: '🔎 Explorer JDM',
      kind: 'instant',
      desc: 'Choisis un terme et une relation, vois les triplets triés par poids consensuel. Annotations sémantiques (constitutif, contrastif, exception…) optionnelles. Désambiguïsation des termes polysémiques (avocat, souris, police…).',
      example: 'chat | r_has_part | ?',
    },
  ];

  const briefs = [
    {
      title: 'Client typé + cache disque',
      body: <>Couche client <code>JDMClient</code> sur l&apos;<a href="https://jdm-api.demo.lirmm.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>API JeuxDeMots</a>, cache disque, retry exponentiel.</>,
    },
    {
      title: '~35 outils MCP exposés',
      body: <>À n&apos;importe quel client (Claude Code/Desktop, Cursor, etc.) via <a href="https://github.com/jlowin/fastmcp" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>FastMCP</a>.</>,
    },
    {
      title: 'Pipeline fact-check + inférence',
      body: <>Détermination + détection de gaps + <strong>moteur d&apos;inférence symbolique borné</strong> pour la consolidation des candidats avant soumission au canal contributif LLMDrops de JDM.</>,
    },
    {
      title: 'Sous-graphe HTML autonome',
      body: <>vis-network avec sélection de relations par niveau, palette par famille de relation, opacité progressive.</>,
    },
  ];

  // Pan style : on rend les DEUX navs en même temps maintenant.
  return (
    <>
      <NavLeftRail   activePanel={activePanel} onSelect={goFromLeft} />
      <NavBottomDots activePanel={activePanel} onSelect={goFromBottom} />
      <style>{`
        @media (max-width: 720px) {
          nav[aria-label="Navigation entre panneaux bas"] {
            bottom: 14px !important;
            transform: translateX(-50%) scale(0.85) !important;
            transform-origin: bottom center !important;
          }
        }
      `}</style>

      {/* Carousel container — viewport plein, sous la nav */}
      <div style={{
        position: 'relative',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}>
        {/* Track : N panneaux empilés (vertical) ou alignés (horizontal),
            transform: translateY OU translateX selon direction. */}
        <div style={{
          height: direction === 'vertical' ? `${totalPanels * 100}%` : '100%',
          width:  direction === 'vertical' ? '100%' : `${totalPanels * 100}%`,
          display: 'flex',
          flexDirection: direction === 'vertical' ? 'column' : 'row',
          transform: direction === 'vertical'
            ? `translate3d(0, -${(panelIndex / totalPanels) * 100}%, 0)`
            : `translate3d(-${(panelIndex / totalPanels) * 100}%, 0, 0)`,
          transition: transitioning
            ? 'transform 0.85s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'none',
          willChange: 'transform',
        }}>
          {/* ── Panneau 1 — Sous le capot (gauche / haut) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}>
              <SectionTitle
                kicker="Sous le capot"
                title="Le projet en bref"
                desc="Quatre piliers techniques qui rendent l'agent fiable, reproductible et accessible à toute la chaîne d'outils LLM modernes."
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12, marginBottom: 24,
              }}>
                {briefs.map((b, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                  }}>
                    <div className="mono" style={{
                      fontSize: 11, color: 'var(--accent)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      marginBottom: 8, fontWeight: 600,
                    }}>0{i + 1}</div>
                    <div className="display" style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 18, fontWeight: 600,
                      marginBottom: 8, color: 'var(--ink)',
                    }}>{b.title}</div>
                    <p style={{
                      margin: 0, fontSize: 13,
                      color: 'var(--ink-2)', lineHeight: 1.55,
                    }}>{b.body}</p>
                  </div>
                ))}
              </div>

              <div style={{
                padding: 24,
                background: 'var(--bg-elev)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'var(--font-display)',
                    fontSize: 18, fontWeight: 600, marginBottom: 6,
                  }}>
                    <GitHubMark size={20} />
                    <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                      Projet open-source
                    </a>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    Données : <strong>JeuxDeMots</strong> — Mathieu Lafourcade, équipe SLICE, LIRMM/CNRS.
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                    <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>Code source</a>
                    <span style={{ color: 'var(--ink-3)' }}>·</span>
                    <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>USAGE.md</a>
                    <span style={{ color: 'var(--ink-3)' }}>·</span>
                    <a href="https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>Notebook Colab</a>
                  </div>
                </div>
              </div>
            </div>
          </CarouselPanel>{/* ── Panneau 2 — Présentation (centre, entrée) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(20px, 3vh, 36px)',
            }}>
              <HeroAnimation height={Math.min(420, Math.round(window.innerHeight * 0.44))} />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: 48,
                alignItems: 'center',
              }}>
                <div>
                  <div className="mono" style={{
                    fontSize: 11, color: 'var(--ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                    marginBottom: 14,
                  }}>
                    LIRMM · CNRS · Université de Montpellier
                  </div>
                  <h1 className="display" style={{
                    fontFamily: 'var(--font-display)',
                    margin: 0,
                    fontSize: 'clamp(32px, 4.5vw, 56px)',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    color: 'var(--ink)',
                  }}>
                    Agent <em style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic', color: 'var(--accent)',
                    }}>Jarvis</em> :<br/>Plateforme web.
                  </h1>
                  <p style={{
                    marginTop: 18,
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: 'var(--ink-2)',
                    maxWidth: '52ch',
                  }}>
                    Projet d&apos;agentification de la ressource lexico-sémantique{' '}
                    <a href="https://www.jeuxdemots.org" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>JeuxDeMots</a>{' '}
                    (LIRMM/CNRS, ~2 M nœuds, 180+ relations typées et pondérées) pour les{' '}
                    <strong style={{ color: 'var(--ink)' }}>LLM modernes</strong> via{' '}
                    <strong style={{ color: 'var(--ink)' }}>LangChain</strong> et le{' '}
                    <strong style={{ color: 'var(--ink)' }}>Model Context Protocol</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                    <Button onClick={() => goto('jarvis')}>Jarvis →</Button>
                    <Button variant="secondary" onClick={() => goto('agent')}>Discuter avec JDM</Button>
                    <Button variant="secondary" onClick={() => goto('subgraph')}>Visualiser</Button>
                    <Button variant="secondary" onClick={() => goto('explorer')}>Explorer</Button>
                  </div>
                </div>

                <StatsGrid stats={stats} />
              </div>
            </div>
          </CarouselPanel>

          {/* ── Panneau 3 — Modules (droite / bas) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 32,
            }}>
              <SectionTitle
                kicker="Que peux-tu faire sur cette page ?"
                title={<>Fonctionnalités de l'API :<br/>Utilisation CLI, distant (à venir)</>}
                desc="Chaque fonctionnalité est accessible via remote API et en ligne de commande."
              />
              <FeaturesGrid features={features} goto={goto} />
            </div>
          </CarouselPanel>

          
        </div>
      </div>
    </>
  );
}

// ─── Wrapper pour chaque panneau dans le carousel ───
// flex 1/N de la track (en main axis), padding uniforme.
function CarouselPanel({ children }) {
  return (
    <div style={{
      flex: '0 0 33.3333%',
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 28px 28px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  );
}

// ─── PanelNav : 2 variantes, l'indicateur ACTIF glisse entre items.
//   'bottom' (défaut) : pill horizontal en bas — indicateur glisse en X
//   'left'           : rail vertical à gauche — indicateur glisse en Y
//
// La variante est choisie via tweaks.navStyle (Tweaks panel ou
// window.__JDM_TWEAKS__.navStyle = 'left' | 'bottom').
function PanelDots({ activePanel, onSelect }) {
  // Re-read on tweaks change.
  const [style, setStyle] = useState(() =>
    (typeof window !== 'undefined' && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle) || 'bottom'
  );
  useEffect(() => {
    const sync = () => setStyle(
      (window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle) || 'bottom'
    );
    window.addEventListener('__jdm_tweaks_changed', sync);
    return () => window.removeEventListener('__jdm_tweaks_changed', sync);
  }, []);

  if (style === 'left') return <NavLeftRail   activePanel={activePanel} onSelect={onSelect} />;
  return                       <NavBottomDots activePanel={activePanel} onSelect={onSelect} />;
}

// ─── Variant : Bottom dots avec indicateur glissant ──────────────────
function NavBottomDots({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  // Mesure la position/largeur du bouton actif et anime l'indicateur.
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({
      x: ir.left - cr.left + cont.scrollLeft,
      w: ir.width,
      ready: true,
    });
  }, [activePanel]);

  // Re-mesure au resize (les labels peuvent changer de largeur).
  useEffect(() => {
    const onResize = () => {
      const activeEl = itemRefs.current[activePanel];
      const cont = containerRef.current;
      if (!activeEl || !cont) return;
      const cr = cont.getBoundingClientRect();
      const ir = activeEl.getBoundingClientRect();
      setIndicator(prev => ({ ...prev, x: ir.left - cr.left, w: ir.width }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePanel]);

  return (
    <nav
      ref={containerRef}
      aria-label="Navigation entre panneaux bas"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 6,
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 999,
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 40,
      }}>
      {/* Pill d'indicateur — glisse en horizontal */}
      <span aria-hidden="true" style={{
        position: 'absolute',
        left: indicator.x,
        width: indicator.w,
        top: 6, bottom: 6,
        background: 'var(--accent)',
        borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4, 0, 0.2, 1), width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s',
        zIndex: 0,
      }}/>
      {PANELS.map((p, i) => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.32s 0.05s',  // léger délai pour matcher l'arrivée du pill
              whiteSpace: 'nowrap',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              opacity: active ? 0.95 : 0.55,
              fontWeight: 600,
              letterSpacing: 0,
              textTransform: 'none',
              lineHeight: 1,
            }}>{p.symbol}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Variant : Left rail avec indicateur glissant verticalement ──────
//
// Comportement adaptatif piloté par la largeur du viewport :
//   - ≥ 1440px : rail complet avec symbole + label (mode 'full')
//   - 1180-1439 : rail compact, symbole uniquement (mode 'compact')
//   - < 1180px : rail entièrement caché (mode 'hidden')
//
// Cette logique est doublée par une mesure réelle de collision avec le
// contenu principal (.jdm-projet-content si présent) — si le rail
// chevauche le contenu, on bascule en hidden quelle que soit la largeur.
function NavLeftRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  const [mode, setMode] = useState('full');  // 'full' | 'compact' | 'hidden'

  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel, mode]);

  // Détection de largeur + collision avec le contenu hero.
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // Choix nominal basé sur la largeur.
      let next = w >= 1440 ? 'full' : w >= 1180 ? 'compact' : 'hidden';

      // Test de collision : on cherche un élément qui marque la zone
      // de contenu (h1.display dans le panneau hero, ou main centré).
      // Si le rail prévu (à gauche, 32px + 110-200px de large) chevauche,
      // on cache.
      if (next !== 'hidden') {
        const heroTextEl = document.querySelector('main h1.display');
        if (heroTextEl) {
          const r = heroTextEl.getBoundingClientRect();
          const railEdge = 32 + (next === 'full' ? 170 : 50);
          if (r.left < railEdge + 24) {
            // Si collision en mode full, tenter compact avant de cacher.
            if (next === 'full') {
              const compactEdge = 32 + 50;
              next = r.left < compactEdge + 24 ? 'hidden' : 'compact';
            } else {
              next = 'hidden';
            }
          }
        }
      }
      setMode(next);
    };
    compute();
    window.addEventListener('resize', compute);
    // Re-mesure après que le contenu hero ait bougé (changement de
    // panneau ou de thème).
    const id = setInterval(compute, 800);
    return () => { window.removeEventListener('resize', compute); clearInterval(id); };
  }, []);

  if (mode === 'hidden') return null;

  const compact = mode === 'compact';

  return (
    <nav
      ref={containerRef}
      aria-label="Navigation entre panneaux gauche"
      style={{
        position: 'fixed',
        left: compact ? 24 : 32,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        zIndex: 40,
        borderLeft: '1px solid var(--line)',
        paddingLeft: compact ? 10 : 16,
      }}>
      <span aria-hidden="true" style={{
        position: 'absolute',
        left: -1, top: indicator.y,
        height: indicator.h,
        width: 2,
        background: 'var(--accent)',
        opacity: indicator.ready ? 1 : 0,
        transition: 'top 0.42s cubic-bezier(0.4, 0, 0.2, 1), height 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s',
      }}/>
      {PANELS.map((p) => (
        <PanelNavItem
          key={p.id}
          ref={el => { if (el) itemRefs.current[p.id] = el; }}
          symbol={p.symbol}
          label={p.label}
          showLabel={!compact}
          active={activePanel === p.id}
          onClick={() => onSelect(p.id)}
        />
      ))}
    </nav>
  );
}

const PanelNavItem = React.forwardRef(function PanelNavItem({ symbol, label, showLabel, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? 'var(--accent)' : (hover ? 'var(--ink)' : 'var(--ink-3)');
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Aller à ${label}`}
      title={!showLabel ? label : undefined}
      style={{
        background: 'transparent',
        border: 'none',
        padding: showLabel ? '16px 0' : '14px 0',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        position: 'relative',
        color,
        transition: 'color 0.32s',
        fontFamily: 'inherit',
      }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: showLabel ? 22 : 18,
        fontWeight: 600,
        lineHeight: 1,
        color: 'inherit',
      }}>{symbol}</span>
      {showLabel && (
        <span className="mono" style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'inherit',
          fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap',
        }}>{label}</span>
      )}
    </button>
  );
});

function BackToTopBtn({ visible, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Revenir en haut"
      title="Revenir en haut"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: visible
          ? 'translate(-50%, 0)'
          : 'translate(-50%, 24px)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px',
        borderRadius: 999,
        border: '1px solid var(--line)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'opacity 0.25s, transform 0.25s, background 0.15s, color 0.15s',
        zIndex: 45,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent)';
        e.currentTarget.style.color = 'var(--bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.color = 'var(--ink)';
      }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>↑</span>
      Revenir en haut
    </button>
  );
}

function StatsGrid({ stats }) {
  const colors = useShuffledAccents(stats.length);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 1,
      background: 'var(--line)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {stats.map((s, i) => (
        <StatTile key={s.label} stat={s} hoverColor={colors[i]} />
      ))}
    </div>
  );
}

// ─── FeaturesGrid : carrousel avec FADE PAR MASK-IMAGE (pas par overlay).
//
// Solution aux deux bugs précédents :
//
//   1. Bleed à droite : mask-image fond GRADUELLEMENT le contenu en
//      transparent — au lieu d'un overlay opaque var(--bg), ce sont les
//      pixels eux-mêmes qui disparaissent. Aucun bleed possible.
//
//   2. Hover lift clippé : on ne touche plus à overflow. Le carousel a
//      `overflow-x: auto` et `overflow-y: hidden`, mais avec une padding
//      verticale (14px haut + bas) + margin négative compensatrice, le
//      hover lift (+ son ombre) s'épanouit dans la zone padded — pas
//      clippé visuellement. La mask-image fait le boulot du gradient.
function FeaturesGrid({ features, goto }) {
  const colors = useShuffledAccents(features.length);
  const scrollRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateBounds = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setCanPrev(!atStart);
    setCanNext(!atEnd);
  }, []);

  React.useEffect(() => {
    updateBounds();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateBounds, { passive: true });
    window.addEventListener('resize', updateBounds);
    return () => {
      el.removeEventListener('scroll', updateBounds);
      window.removeEventListener('resize', updateBounds);
    };
  }, [updateBounds]);

  // Animation JS du scroll : interpolation ease-out quint, 900ms.
  const animFrameRef = useRef(null);
  const animScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';

    const step = Math.max(320, el.clientWidth * 0.78);
    const start = el.scrollLeft;
    const target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, start + dir * step));
    const duration = 900;
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 5);
      el.scrollLeft = start + (target - start) * eased;
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
        el.style.scrollSnapType = prevSnap || 'x mandatory';
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  React.useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const btnStyle = (enabled) => ({
    width: 44, height: 44,
    borderRadius: '50%',
    border: '1px solid var(--line)',
    background: 'var(--bg-card)',
    color: 'var(--ink-2)',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? 'auto' : 'none',
    boxShadow: 'var(--shadow)',
    fontSize: 22, lineHeight: 1, fontWeight: 500,
    transition: 'background 0.15s, color 0.15s, transform 0.18s, opacity 0.25s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });

  const hoverIn = (e) => {
    e.currentTarget.style.background = 'var(--accent)';
    e.currentTarget.style.color = 'var(--bg)';
    e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
  };
  const hoverOut = (e) => {
    e.currentTarget.style.background = 'var(--bg-card)';
    e.currentTarget.style.color = 'var(--ink-2)';
    e.currentTarget.style.transform = 'translateY(-50%)';
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => animScroll(-1)}
        aria-label="Défiler à gauche"
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{
          ...btnStyle(canPrev),
          position: 'absolute',
          left: -56, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 6,
        }}>‹</button>

      <div
        ref={scrollRef}
        className={`jdm-carousel ${canNext ? 'jdm-carousel--fade-right' : ''}`}
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          // Padding vertical = breathing room pour le hover lift + son
          // ombre. Margin négative compense pour conserver l'alignement
          // visuel avec les autres éléments de la page.
          padding: '14px 4px',
          margin: '-14px -4px',
          scrollSnapType: 'x mandatory',
        }}>
        {features.map((f, i) => (
          <div key={f.id} style={{
            flex: '0 0 clamp(280px, 28vw, 340px)',
            scrollSnapAlign: 'start',
            display: 'flex',
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <FeatureCard f={f} goto={goto} hoverColor={colors[i]} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => animScroll(1)}
        aria-label="Défiler à droite"
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{
          ...btnStyle(canNext),
          position: 'absolute',
          right: 8, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 6,
        }}>›</button>
    </div>
  );
}

function FeatureCard({ f, goto, hoverColor }) {
  const [hovering, setHovering] = useState(false);
  const primary = !!f.primary;

  const bg = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : 'var(--bg-card)';
  const inkColor = primary ? 'var(--bg)' : 'var(--ink)';
  const ink2Color = primary ? 'rgba(255,255,255,0.88)' : 'var(--ink-2)';
  const ink3Color = primary ? 'rgba(255,255,255,0.72)' : 'var(--ink-3)';
  const borderColor = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : (hovering ? hoverColor : 'var(--line)');
  const shadow = hovering
    ? (primary
        ? '0 10px 24px -10px var(--accent)'
        : `0 6px 18px -8px ${hoverColor}`)
    : 'none';

  return (
    <div
      onClick={() => goto(f.id)}
      className="focus-ring"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') goto(f.id); }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
        borderRadius: 'var(--radius-lg)',
        padding: 22,
        cursor: 'pointer',
        transform: hovering ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
        display: 'flex', flexDirection: 'column', gap: 10,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}>
      {primary && (
        <div className="mono" style={{
          position: 'absolute',
          top: 10, right: 10,
          fontSize: 9,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.18)',
          padding: '2px 8px',
          borderRadius: 999,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 600,
        }}>★ principal</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className="display" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 600,
          letterSpacing: '-0.01em',
          color: primary ? inkColor : (hovering ? hoverColor : 'var(--ink)'),
          transition: 'color 0.18s',
        }}>{f.title}</div>
        {!primary && <Pill>{f.kind}</Pill>}
        {primary && (
          <span style={{
            padding: '3px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
          }}>{f.kind}</span>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: 13,
        color: ink2Color, lineHeight: 1.55, flex: 1,
      }}>{f.desc}</p>
      <div className="mono" style={{
        fontSize: 11,
        color: primary ? ink3Color : (hovering ? hoverColor : 'var(--ink-3)'),
        paddingTop: 10,
        borderTop: `1px dashed ${primary
          ? 'rgba(255,255,255,0.30)'
          : (hovering ? hoverColor : 'var(--line-soft)')}`,
        transition: 'color 0.18s, border-top-color 0.18s',
      }}>{f.example}</div>
    </div>
  );
}

function StatTile({ stat, hoverColor }) {
  const parsed = React.useMemo(() => {
    const m = String(stat.value).match(/^([\d.]+)(.*)$/);
    if (!m) return { num: 0, suffix: stat.value };
    return { num: parseFloat(m[1]), suffix: m[2] };
  }, [stat.value]);

  const [display, setDisplay] = useState(parsed.num);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef(null);

  const animate = () => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 1200;
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    // Pour les stats en "M+" on commence à 700k (= 0.7M) et on passe
    // de k vers M lorsqu'on atteint 1M.
    // Pour les stats sans magnitude (180+, 35, 5) : start = 0.45 * target.
    const startVal = hasM ? 0.7 : target * 0.45;
    // Format dynamique : sous 1M on affiche "Xk" (entier), au-dessus "X.YM"
    // sans le .0 (donc "2M" plutôt que "2.0M", mais "1.5M" reste).
    const fmtNum = (v) => {
      if (hasM) {
        if (v < 1) return Math.round(v * 1000) + 'k';  // 700, 800, 900k
        // ≥ 1M : 1 décimale, mais on retire le .0 final
        const s = v.toFixed(1);
        return s.endsWith('.0') ? s.slice(0, -2) : s;
      }
      // Pas de magnitude : entier
      return String(Math.floor(v));
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = startVal + (target - startVal) * eased;
      if (t === 1) {
        // Snap final exact
        if (hasM) {
          const s = target.toFixed(1);
          setDisplay(s.endsWith('.0') ? s.slice(0, -2) : s);
        } else {
          setDisplay(Number.isInteger(target) ? target : target);
        }
      } else {
        setDisplay(fmtNum(v));
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Au mount : affichage initial = valeur formatée selon les règles ci-dessus
  // (donc "2M" pas "2M+" partial, "180" entier, etc.). Sans toucher au suffix
  // qui reste "+".
  React.useEffect(() => {
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    if (hasM) {
      const s = target.toFixed(1);
      setDisplay(s.endsWith('.0') ? s.slice(0, -2) : s);
    } else {
      setDisplay(target);
    }
  }, [parsed]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div
      onMouseEnter={() => { setHovering(true); animate(); }}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: 'var(--bg-card)',
        padding: '18px 20px',
        transition: 'background 0.2s',
        cursor: 'default',
      }}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 6,
      }}>{stat.label}</div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 600,
        color: hovering ? (hoverColor || 'var(--accent)') : 'var(--ink)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
        transition: 'color 0.18s',
        fontVariantNumeric: 'tabular-nums',
      }}>{display}{parsed.suffix}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{stat.sub}</div>
    </div>
  );
}

function GitHubMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
         style={{ flexShrink: 0 }} aria-label="GitHub">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.79.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}

window.ViewProjet = ViewProjet;
