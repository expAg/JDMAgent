// View: Projet — landing / about page describing JDMAgent.

function ViewProjet({ goto }) {
  const stats = [
    { label: 'Termes JDM', value: '5.4M', sub: 'JeuxDeMots' },
    { label: 'Relations', value: '350M+', sub: '152 types' },
    { label: 'Outils agent', value: '34', sub: 'LangChain · MCP' },
    { label: 'Flux Jarvis', value: '5', sub: 'guidés' },
  ];

  const features = [
    {
      id: 'explorer',
      title: 'Explorer',
      kind: 'instant',
      desc: 'Naviguer les relations d\'un terme : synonymes, hyperonymes, parties, agents, lieux… Sans LLM, en moins d\'une seconde.',
      example: 'chat | r_has_part | ?',
    },
    {
      id: 'claim',
      title: 'Claim checker',
      kind: 'déterministe',
      desc: 'Vérifier une affirmation sous la forme sujet | relation | objet. Verdict avec chaîne de preuve.',
      example: 'tomate | r_isa | légume → ❌',
    },
    {
      id: 'subgraph',
      title: 'Sous-graphe',
      kind: 'visuel',
      desc: 'Extraire et visualiser le voisinage d\'un terme à profondeur 2/3/4, filtré par type de relation.',
      example: 'profondeur 2 · 12 relations',
    },
    {
      id: 'agent',
      title: 'Agent',
      kind: 'LLM · BYOK',
      desc: 'Chat conversationnel donnant accès aux 34 outils JDM via un LLM. Idéal pour les requêtes en langue naturelle.',
      example: '« Que mange un chat ? »',
    },
    {
      id: 'jarvis',
      title: 'Jarvis',
      kind: '5 flux',
      desc: 'Workflows guidés pour les tâches récurrentes : enrichissement, audit de cohérence, expansion sémantique, fact-checking textuel, synthèse.',
      example: 'enrichissement → 17 propositions',
    },
  ];

  return (
    <PageShell>
      {/* Hero */}
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
            Une couche d&apos;agent <em style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic', color: 'var(--accent)',
            }}>au-dessus</em> du graphe lexico-sémantique JeuxDeMots.
          </h1>
          <p style={{
            marginTop: 22,
            fontSize: 17,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
            maxWidth: '52ch',
          }}>
            <strong style={{ color: 'var(--ink)' }}>jdmAgent</strong> donne accès
            programmatique aux 350 millions de relations lexicales de JDM,
            via 34 outils LangChain et 5 workflows guidés. Conçu pour les
            chercheurs en TAL et linguistique computationnelle.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <Button onClick={() => goto('explorer')}>Commencer à explorer →</Button>
            <Button variant="secondary" onClick={() => goto('jarvis')}>Workflows Jarvis</Button>
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
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}>{s.label}</div>
              <div className="display" style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 600,
                color: 'var(--ink)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <SectionTitle
        kicker="Sept fonctionnalités · une API"
        title="Tout JeuxDeMots, depuis un seul endroit"
        desc="Chaque module utilise la même API JDM mise en cache, sans appel LLM superflu."
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
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
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
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}>{f.title}</div>
              <Pill>{f.kind}</Pill>
            </div>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              flex: 1,
            }}>{f.desc}</p>
            <div className="mono" style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              paddingTop: 10,
              borderTop: '1px dashed var(--line-soft)',
            }}>{f.example}</div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 56,
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
            Cet espace utilise un pool de clés Gemini partagé. Pour des
            usages intensifs, fournis ta clé Anthropic ou OpenAI dans
            l&apos;onglet Agent (BYOK).
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill color="var(--jdm-green)" tone="outline">
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
            Pool gemini · clé 3/4
          </Pill>
          <Pill>500 req/jour</Pill>
        </div>
      </div>
    </PageShell>
  );
}

window.ViewProjet = ViewProjet;
