// View: Projet — landing page using the designer layout (hero / stats /
// feature cards / footer) populated avec notre texte canonique PROJET_MD.

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
    // Si on a besoin de plus que la palette, on cycle.
    const out = [];
    for (let k = 0; k < n; k++) out.push(a[k % a.length]);
    return out;
  }, [n]);
}

// 3 sections-panneaux : hero / features / briefs+footer. Chaque section
// remplit le viewport (min-height: 100vh − nav) et s'aligne via
// scroll-snap. Les dots latéraux pilotent la navigation entre panneaux.
const PANELS = [
  { id: 'hero',     label: 'Présentation' },
  { id: 'modules',  label: 'Modules' },
  { id: 'bref',     label: 'Sous le capot' },
];

function ViewProjet({ goto }) {
  const heroRef = useRef(null);
  const modulesRef = useRef(null);
  const brefRef = useRef(null);
  const refs = { hero: heroRef, modules: modulesRef, bref: brefRef };
  const [activePanel, setActivePanel] = useState('hero');

  // IntersectionObserver — quand un panneau couvre >50% du viewport,
  // le dot correspondant devient actif.
  React.useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      // On prend l'entry la plus visible
      let best = null, bestRatio = 0;
      for (const e of entries) {
        if (e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      }
      if (best && best.dataset.panel) setActivePanel(best.dataset.panel);
    }, { threshold: [0.3, 0.55, 0.8] });
    Object.values(refs).forEach(r => { if (r.current) observer.observe(r.current); });
    return () => observer.disconnect();
  }, []);

  const scrollToPanel = (id) => {
    const r = refs[id];
    if (r && r.current) r.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  // Stats — chiffres tirés du README JDM (LIRMM/CNRS) et du projet.
  const stats = [
    { label: 'Termes JDM',   value: '2M+',    sub: 'JeuxDeMots'    },
    { label: 'Relations',    value: '180+',   sub: 'types typées'  },
    { label: 'Outils MCP',   value: '35',     sub: 'LangChain · FastMCP' },
    { label: 'Flux Jarvis',  value: '5',      sub: 'guidés'        },
  ];

  // Features — ordre demandé par utilisateur :
  // 1. Jarvis (primary)  2. Chatbot LLM  3. Sous-graphe
  // 4. Claim checker     5. Explorer
  // Icônes alignées sur app.py : 🤖 Jarvis (robot), 💬 Chatbot (bulle).
  const features = [
    {
      id: 'jarvis',
      title: '🤖 Jarvis',
      kind: '5 flux',
      primary: true,  // carte mise en avant : fond accent + texte adapté
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

  // « Le projet en bref » — bullets du PROJET_MD canonique.
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

  return (
    <PageShell>
      {/* Dots latéraux (panneau actif) */}
      <PanelDots activePanel={activePanel} onSelect={scrollToPanel} />

      {/* Back-to-top — bouton flottant bottom-center, visible UNIQUEMENT
          sur le 3ᵉ panneau. Placé loin des dots et du carousel. */}
      <BackToTopBtn visible={activePanel === 'bref'} onClick={scrollToTop} />

      {/* Panneau 1 — Hero. min-height calc(100vh − nav) → remplit la
          viewport. Snap-align start aligne propre au sticky top. */}
      <div ref={heroRef} data-panel="hero" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 48,
        alignItems: 'center',
        minHeight: 'calc(100vh - 56px)',
        scrollSnapAlign: 'start',
        scrollMarginTop: 56,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.18em',
            marginBottom: 16,
          }}>
            LIRMM · CNRS · Université de Montpellier
          </div>
          <h1 className="display" style={{
            fontFamily: 'var(--font-display)',
            margin: 0,
            fontSize: 'clamp(36px, 5vw, 60px)',
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
            marginTop: 22,
            fontSize: 17,
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
          <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
            <Button onClick={() => goto('jarvis')}>Jarvis →</Button>
            <Button variant="secondary" onClick={() => goto('agent')}>Discuter avec JDM</Button>
            <Button variant="secondary" onClick={() => goto('subgraph')}>Visualiser</Button>
            <Button variant="secondary" onClick={() => goto('explorer')}>Explorer</Button>
          </div>
        </div>

        {/* Stats column — chiffres animés count-up au hover.
            Chaque tuile reçoit une couleur DIFFÉRENTE de la palette
            jaune/orange/rouge/vert/bleu, randomisée à chaque mount. */}
        <StatsGrid stats={stats} />
      </div>

      {/* Panneau 2 — Modules. Grid avec place-content: center ET grille
          auto sur 1 colonne : centre VERTICALEMENT + HORIZONTALEMENT
          le bloc contenu, peu importe sa hauteur. */}
      <div ref={modulesRef} data-panel="modules" style={{
        scrollSnapAlign: 'start', scrollMarginTop: 56,
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(60px, 12vh, 140px)',
        paddingBottom: 'clamp(40px, 8vh, 100px)',
        gap: 28,
      }}>
        <SectionTitle
          kicker="Que peux-tu faire sur cette page ?"
          title="Cinq modules · une seule API"
          desc="Chaque module utilise la même API JDM mise en cache, sans appel LLM superflu sauf quand c'est explicitement utile."
        />
        <FeaturesGrid features={features} goto={goto} />
      </div>

      {/* Panneau 3 — Sous le capot + footer. Même technique de centrage
          que le panneau 2. */}
      <div ref={brefRef} data-panel="bref" style={{
        scrollSnapAlign: 'start', scrollMarginTop: 56,
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(60px, 12vh, 140px)',
        paddingBottom: 'clamp(40px, 8vh, 100px)',
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
        gap: 12, marginBottom: 32,
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

      {/* Footer — crédits + liens */}
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
      </div>{/* /panneau 3 */}
    </PageShell>
  );
}

// ─── PanelDots : navigation latérale entre les 3 panneaux du Projet.
// Position fixed à droite, vertical-center. Skin-aware (vars CSS).
function PanelDots({ activePanel, onSelect }) {
  return (
    <div className="jdm-panel-dots" style={{
      position: 'fixed',
      right: 22, top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 14,
      zIndex: 40,
    }}>
      {PANELS.map(p => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            title={p.label}
            className="jdm-panel-dot"
            style={{
              width: 10, height: 10, padding: 0,
              borderRadius: '50%',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--ink-3)'}`,
              background: active ? 'var(--accent)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.18s, border-color 0.18s, transform 0.18s',
              transform: active ? 'scale(1.25)' : 'scale(1)',
            }} />
        );
      })}
    </div>
  );
}

// ─── BackToTopBtn : bouton flottant bottom-center, fade in/out selon
// `visible`. Placé EN BAS de la fenêtre (loin des dots latéraux et du
// carousel). Skin-aware.
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

// ─── StatsGrid : 4 tuiles avec couleur de hover distincte par tuile
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

// ─── FeaturesGrid : carrousel horizontal (rangée unique scrollable)
// avec snap, scrollbar masquée, boutons prev/next skin-aware aux bords,
// et gradient de fade qui s'estompe quand on est en bout de course.
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

  // Animation JS du scroll : interpolation ralentie, élégante.
  // Pendant l'anim, on désactive scroll-snap (mandatory snape sinon
  // les positions intermédiaires → saccades). On rétablit en fin.
  // ease-out quint ralentit plus que cubic → effet 'glissé'.
  // En cas de clic rapide, on annule l'anim en cours (cancelAnimationFrame).
  const animFrameRef = useRef(null);

  const animScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Désactive le snap pendant l'animation (évite les saccades).
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';

    const step = Math.max(320, el.clientWidth * 0.78);
    const start = el.scrollLeft;
    const target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, start + dir * step));
    const duration = 900;  // 900ms = sensation 'élégante' sans être lent
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      // ease-out quint : décélération douce et marquée à la fin
      const eased = 1 - Math.pow(1 - t, 5);
      el.scrollLeft = start + (target - start) * eased;
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
        // Restaure le snap (mandatory) en fin d'anim
        el.style.scrollSnapType = prevSnap || 'x mandatory';
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  React.useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Style commun des boutons (skin-aware via vars CSS).
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
    e.currentTarget.style.transform = e.currentTarget.dataset.side === 'left'
      ? 'translateY(-50%) scale(1.08)'
      : 'translateY(-50%) scale(1.08)';
  };
  const hoverOut = (e) => {
    e.currentTarget.style.background = 'var(--bg-card)';
    e.currentTarget.style.color = 'var(--ink-2)';
    e.currentTarget.style.transform = 'translateY(-50%)';
  };

  // Structure : wrapper-clip (overflow: hidden, clipe TOUT bleed) avec
  // boutons + carousel à l'intérieur.
  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton gauche — hors de la rangée à gauche, sur la marge */}
      <button
        type="button"
        data-side="left"
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

      {/* Wrapper SANS overflow:hidden (qui clippait le hover lift).
          Le bleed est maintenant couvert par un gradient + bloc
          solide plus large à droite. */}
      <div style={{ position: 'relative' }}>
        {/* Carousel — pleine largeur, padding/margin HORIZONTAL only */}
        <div
          ref={scrollRef}
          className="jdm-carousel"
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            overflowY: 'visible',
            scrollSnapType: 'x mandatory',
            padding: '0 4px',
            margin: '0 -4px',
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

        {/* Gradient fade SUR la dernière carte (style 'estompé') —
            ÉLARGI à 180px pour couvrir tout bleed visible. var(--bg)
            opaque sur 50% droite (= 90px solide), fade sur 90px à
            gauche. Plus de wrapper clip donc le gradient doit faire
            tout le job de masquage tout seul. */}
        <div style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: 180,
          pointerEvents: 'none',
          zIndex: 3,
          background: 'linear-gradient(to left, var(--bg) 50%, transparent 100%)',
          opacity: canNext ? 1 : 0,
          transition: 'opacity 0.25s',
        }} />
      </div>

      {/* Bouton droit — par-dessus le gradient, au niveau du wrapper */}
      <button
        type="button"
        data-side="right"
        onClick={() => animScroll(1)}
        aria-label="Défiler à droite"
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{
          ...btnStyle(canNext),
          position: 'absolute',
          right: 16, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 6,
        }}>›</button>
    </div>
  );
}

function FeatureCard({ f, goto, hoverColor }) {
  const [hovering, setHovering] = useState(false);
  const primary = !!f.primary;

  // Couleurs de base selon primary/standard.
  // Pour la carte primary : on désature l'accent en le mixant avec un
  // peu de noir (12%) — l'accent pur (#c0411a ou #7eb5c5 selon skin)
  // était trop saturé en grand aplat. color-mix() est skin-aware
  // (utilise les vars d'accent du thème courant).
  const bg = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : 'var(--bg-card)';
  const inkColor = primary ? 'var(--bg)' : 'var(--ink)';
  const ink2Color = primary ? 'rgba(255,255,255,0.88)' : 'var(--ink-2)';
  const ink3Color = primary ? 'rgba(255,255,255,0.72)' : 'var(--ink-3)';
  const borderColor = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : (hovering ? hoverColor : 'var(--line)');
  // Hover de la primary : on lift + ombre dans la couleur accent, pas
  // de changement de couleurs internes (sinon ça pulse trop).
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
      {/* Badge "PRINCIPAL" en haut à droite sur Jarvis */}
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

// ─── StatTile : tuile de stat avec animation count-up au hover ─────
function StatTile({ stat, hoverColor }) {
  // Parse la valeur : "2M+" → {num: 2, suffix: "M+"}, "350M+" → {350, "M+"},
  // "35" → {35, ""}, "5" → {5, ""}.
  const parsed = React.useMemo(() => {
    const m = String(stat.value).match(/^([\d.]+)(.*)$/);
    if (!m) return { num: 0, suffix: stat.value };
    return { num: parseFloat(m[1]), suffix: m[2] };
  }, [stat.value]);

  const [display, setDisplay] = useState(parsed.num);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef(null);

  // Au hover : reset à 0 puis ease-out cubic vers la valeur cible.
  // Classy : durée ~900ms, démarre rapide, ralentit, s'arrête pile.
  const animate = () => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 900;
    const target = parsed.num;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      // Pour les valeurs entières (35, 5) : pas de décimale ; pour
      // les valeurs déjà décimales (2.0, 5.4) : 1 décimale en cours,
      // valeur finale exacte.
      const isInt = target === Math.floor(target);
      setDisplay(t === 1 ? target : (isInt ? Math.floor(v) : v.toFixed(1)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div
      onMouseEnter={() => { setHovering(true); animate(); }}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: 'var(--bg-card)',
        padding: '20px 22px',
        transition: 'background 0.2s',
        cursor: 'default',
      }}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 8,
      }}>{stat.label}</div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32, fontWeight: 600,
        color: hovering ? (hoverColor || 'var(--accent)') : 'var(--ink)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
        transition: 'color 0.18s',
        fontVariantNumeric: 'tabular-nums',  // évite le sautillement
      }}>{display}{parsed.suffix}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{stat.sub}</div>
    </div>
  );
}

// ─── Petite icône GitHub (Octicon-like, SVG inline) ─────────────
function GitHubMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
         style={{ flexShrink: 0 }} aria-label="GitHub">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.79.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}

window.ViewProjet = ViewProjet;
