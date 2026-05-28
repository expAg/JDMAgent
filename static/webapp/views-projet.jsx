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
            Accès web à l&apos;agent <em style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic', color: 'var(--accent)',
            }}>JeuxDeMots</em>.
          </h1>
          <p style={{
            marginTop: 22,
            fontSize: 17,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
            maxWidth: '52ch',
          }}>
            Agentification de <a href="https://www.jeuxdemots.org" style={{ color: 'var(--accent)' }}>JeuxDeMots</a> (LIRMM/CNRS, ~2 M nœuds, 180+ relations typées) pour les <strong style={{ color: 'var(--ink)' }}>LLM modernes</strong> via <strong style={{ color: 'var(--ink)' }}>LangChain</strong> et le <strong style={{ color: 'var(--ink)' }}>Model Context Protocol</strong>.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <Button onClick={() => goto('explorer')}>Commencer à explorer →</Button>
            <Button variant="secondary" onClick={() => goto('jarvis')}>Flux Jarvis</Button>
            <Button variant="ghost" onClick={() => goto('aide')}>Documentation</Button>
          </div>
        </div>

        {/* Stats column */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              background: 'var(--bg-card)',
              padding: '20px 22px',
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8,
              }}>{s.label}</div>
              <div className="display" style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32, fontWeight: 600,
                color: 'var(--ink)', lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>
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

      {/* Footer — données + crédits + liens */}
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
            fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 600, marginBottom: 4,
          }}>Auto-hébergé, gratuit pour les visiteurs.</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Données : <strong>JeuxDeMots</strong> — Mathieu Lafourcade, équipe TEXTE, LIRMM/CNRS.
            Pool de clés Gemini partagé pour les visiteurs ; BYOK Claude/OpenAI dans l&apos;onglet Agent.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
            <a href="https://github.com/expAg/JDMAgent" style={{ color: 'var(--accent)' }}>Code source</a>
            <span style={{ color: 'var(--ink-3)' }}>·</span>
            <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" style={{ color: 'var(--accent)' }}>USAGE.md</a>
            <span style={{ color: 'var(--ink-3)' }}>·</span>
            <a href="https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb" style={{ color: 'var(--accent)' }}>Notebook Colab</a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill color="var(--jdm-green)" tone="outline">
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
            Pool Gemini
          </Pill>
          <Pill>500 req/jour</Pill>
        </div>
      </div>
    </PageShell>
  );
}

window.ViewProjet = ViewProjet;
