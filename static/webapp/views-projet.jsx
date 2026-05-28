// View: Projet — landing page using the designer layout (hero / stats /
// feature cards / footer) populated avec notre texte canonique PROJET_MD.

function ViewProjet({ goto }) {
  // Stats — chiffres tirés du README JDM (LIRMM/CNRS) et du projet.
  const stats = [
    { label: 'Termes JDM',   value: '2M+',    sub: 'JeuxDeMots'    },
    { label: 'Relations',    value: '180+',   sub: 'types typées'  },
    { label: 'Outils MCP',   value: '35',     sub: 'LangChain · FastMCP' },
    { label: 'Flux Jarvis',  value: '5',      sub: 'guidés'        },
  ];

  // Features — descriptions issues mot pour mot du PROJET_MD du projet
  // (cf. branche deploy-self / app.py PROJET_MD).
  const features = [
    {
      id: 'explorer',
      title: '🔎 Explorer JDM',
      kind: 'instant',
      desc: 'Choisis un terme et une relation, vois les triplets triés par poids consensuel. Annotations sémantiques (constitutif, contrastif, exception…) optionnelles. Désambiguïsation des termes polysémiques (avocat, souris, police…).',
      example: 'chat | r_has_part | ?',
    },
    {
      id: 'claim',
      title: '⚖️ Claim checker',
      kind: 'déterministe',
      desc: 'Vérifie une affirmation factuelle contre JDM de façon déterministe (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN avec citations des triplets utilisés.',
      example: 'baleine | r_isa | poisson → ❌',
    },
    {
      id: 'subgraph',
      title: '🕸️ Sous-graphe',
      kind: 'visuel',
      desc: 'Visualisation interactive (vis-network) du voisinage sémantique d\'un terme jusqu\'à profondeur 4, sélection de relations indépendante par niveau, négations en rouge.',
      example: 'plat asiatique · depth 1 · 8 relations',
    },
    {
      id: 'agent',
      title: '🤖 Agent',
      kind: 'LLM · BYOK',
      desc: 'Conversation avec un agent (Gemini hébergé gratuit, ou BYOK Claude/GPT) qui n\'utilise QUE les outils JDM et cite ses sources.',
      example: '« Que mange typiquement un chat ? »',
    },
    {
      id: 'jarvis',
      title: '🦾 Jarvis',
      kind: '5 flux',
      desc: 'Flux guidés par formulaires (zéro prompt à taper) : Enrichissement (.enrich), Audit (.audit), Détection de trous, Signalement (.err), Statistiques.',
      example: 'enrichissement → 17 triplets consolidés',
    },
  ];

  // « Le projet en bref » — bullets du PROJET_MD canonique.
  const briefs = [
    {
      title: 'Client typé + cache disque',
      body: <>Couche client <code>JDMClient</code> sur l&apos;<a href="https://jdm-api.demo.lirmm.fr">API JeuxDeMots</a>, cache disque, retry exponentiel.</>,
    },
    {
      title: '~35 outils MCP exposés',
      body: <>À n&apos;importe quel client (Claude Code/Desktop, Cursor, etc.) via <a href="https://github.com/jlowin/fastmcp">FastMCP</a>.</>,
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
      {/* Hero — designer layout, texte canonique */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 48,
        marginBottom: 56,
        alignItems: 'center',
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
            }}>Jarvis</em> :<br/>plateforme web.
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
            <Button variant="secondary" onClick={() => goto('explorer')}>Explorer</Button>
            <Button variant="secondary" onClick={() => goto('subgraph')}>Visualiser</Button>
          </div>
        </div>

        {/* Stats column — chiffres animés count-up au hover.
            Chaque tuile reçoit une couleur DIFFÉRENTE de la palette
            jaune/orange/rouge/vert/bleu, randomisée à chaque mount. */}
        <StatsGrid stats={stats} />
      </div>

      {/* Features — Que peux-tu faire sur cette page ? */}
      <SectionTitle
        kicker="Que peux-tu faire sur cette page ?"
        title="Cinq modules · une seule API"
        desc="Chaque module utilise la même API JDM mise en cache, sans appel LLM superflu sauf quand c'est explicitement utile."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {features.map(f => (
          <div key={f.id}
            onClick={() => goto(f.id)}
            className="focus-ring"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') goto(f.id); }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: 22,
              cursor: 'pointer',
              transition: 'transform 0.12s, border-color 0.12s',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink-3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.transform = '';
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="display" style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 600,
                letterSpacing: '-0.01em',
              }}>{f.title}</div>
              <Pill>{f.kind}</Pill>
            </div>
            <p style={{
              margin: 0, fontSize: 13,
              color: 'var(--ink-2)', lineHeight: 1.55, flex: 1,
            }}>{f.desc}</p>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              paddingTop: 10, borderTop: '1px dashed var(--line-soft)',
            }}>{f.example}</div>
          </div>
        ))}
      </div>

      {/* Le projet en bref — 4 sous-piliers du PROJET_MD */}
      <SectionTitle
        kicker="Sous le capot"
        title="Le projet en bref"
        desc="Quatre piliers techniques qui rendent l'agent fiable, reproductible et accessible à toute la chaîne d'outils LLM modernes."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12, marginBottom: 56,
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
    </PageShell>
  );
}

// ─── StatsGrid : 4 tuiles avec une couleur d'accent distincte chacune,
// tirée au sort dans la palette jaune/orange/rouge/vert/bleu à chaque
// mount du composant.
function StatsGrid({ stats }) {
  const PALETTE = [
    'var(--jdm-yellow)',
    'var(--jdm-orange)',
    'var(--jdm-magenta)',  // rouge dans nos tokens (magenta-rouge)
    'var(--jdm-green)',
    'var(--jdm-cyan)',     // bleu dans nos tokens
  ];
  // Mélange Fisher-Yates puis prend N premiers — garantit que toutes
  // les couleurs sont distinctes (tant que N ≤ taille de palette).
  const colors = React.useMemo(() => {
    const a = PALETTE.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, stats.length);
  }, [stats.length]);

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
