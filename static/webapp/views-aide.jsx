// View: Aide — relation glossary + shortcuts + about.

const RELATIONS_GLOSSARY = [
  { id: 'r_syn', label: 'Synonymes', kind: 'lexical', ex: 'chat ≈ matou' },
  { id: 'r_anto', label: 'Antonymes', kind: 'lexical', ex: 'grand ↔ petit' },
  { id: 'r_isa', label: 'Hyperonymes — "est un"', kind: 'taxonomique', ex: 'chat r_isa félin' },
  { id: 'r_hypo', label: 'Hyponymes — "exemples de"', kind: 'taxonomique', ex: 'félin r_hypo chat' },
  { id: 'r_has_part', label: 'Parties / composants', kind: 'méronymique', ex: 'chat r_has_part patte' },
  { id: 'r_carac', label: 'Caractéristiques', kind: 'attributive', ex: 'chat r_carac agile' },
  { id: 'r_has_color', label: 'Couleurs', kind: 'attributive', ex: 'ciel r_has_color bleu' },
  { id: 'r_lieu', label: 'Lieux typiques', kind: 'spatiale', ex: 'lion r_lieu savane' },
  { id: 'r_agent', label: 'Agents typiques', kind: 'actantielle', ex: 'aboyer r_agent chien' },
  { id: 'r_patient', label: 'Patients typiques', kind: 'actantielle', ex: 'manger r_patient pomme' },
  { id: 'r_instr', label: 'Instruments', kind: 'actantielle', ex: 'écrire r_instr stylo' },
  { id: 'r_telic_role', label: 'Rôle télique — à quoi sert', kind: 'fonctionnelle', ex: 'couteau r_telic_role couper' },
  { id: 'r_has_causatif', label: 'Causes', kind: 'causale', ex: 'rire r_has_causatif joie' },
  { id: 'r_has_conseq', label: 'Conséquences', kind: 'causale', ex: 'pluie r_has_conseq mouille' },
  { id: 'r_but', label: 'But', kind: 'finaliste', ex: 'manger r_but vivre' },
  { id: 'r_manner', label: 'Manière', kind: 'modale', ex: 'courir r_manner vite' },
];

const SHORTCUTS = [
  { keys: ['G', 'E'], desc: 'Aller à Explorer' },
  { keys: ['G', 'C'], desc: 'Aller à Claim checker' },
  { keys: ['G', 'A'], desc: 'Aller à Agent' },
  { keys: ['G', 'J'], desc: 'Aller à Jarvis' },
  { keys: ['/'], desc: 'Focus sur le champ de recherche' },
  { keys: ['⌘', 'K'], desc: 'Palette de commandes (à venir)' },
  { keys: ['?'], desc: 'Cette page' },
];

function ViewAide() {
  return (
    <PageShell>
      <SectionTitle
        kicker="Documentation"
        title="Aide"
        desc="Glossaire des relations JeuxDeMots, raccourcis clavier, ressources."
      />

      {/* Relations glossary */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22, fontWeight: 600,
        margin: '0 0 14px',
      }}>Relations JDM principales</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 1,
        background: 'var(--line)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 40,
      }}>
        {RELATIONS_GLOSSARY.map((r, i) => (
          <div key={r.id} style={{
            background: 'var(--bg-card)',
            padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <code className="mono" style={{
                background: 'var(--bg-elev)',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: 12,
                color: 'var(--accent)',
                fontWeight: 600,
              }}>{r.id}</code>
              <span style={{
                fontSize: 10,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>{r.kind}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 6, fontWeight: 500 }}>{r.label}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.ex}</div>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
      }}>
        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600,
            margin: '0 0 14px',
          }}>Raccourcis clavier</h2>
          <Card padding={0}>
            {SHORTCUTS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                borderBottom: i < SHORTCUTS.length - 1 ? '1px solid var(--line-soft)' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.keys.map((k, j) => (
                    <span key={j} className="kbd">{k}</span>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginLeft: 12 }}>{s.desc}</div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600,
            margin: '0 0 14px',
          }}>Ressources</h2>
          <Card>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['JeuxDeMots.org', 'Le site source du projet', 'https://jeuxdemots.org'],
                ['Article fondateur', 'Lafourcade, M. (2007).', '#'],
                ['Documentation API', 'Endpoints, types de relations', '#'],
                ['Code source', 'github.com/expAg/JDMAgent', 'https://github.com/expAg/JDMAgent'],
                ['Hugging Face Space', 'Démo hébergée', '#'],
              ].map(([title, desc, href], i) => (
                <a key={i} href={href} style={{
                  display: 'block',
                  padding: '12px 14px',
                  background: 'var(--bg-elev)',
                  borderRadius: 'var(--radius)',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  border: '1px solid var(--line-soft)',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line-soft)'}>
                  <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    {title}
                    <span style={{ color: 'var(--ink-3)' }}>↗</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>
                </a>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div style={{
        marginTop: 48,
        padding: 32,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
      }}>
        {/* Institutional logos */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}>
          <image-slot
            id="logo-lirmm"
            shape="rect"
            placeholder="Dépose le logo LIRMM ici"
            style={{
              width: 200, height: 80,
              background: 'transparent',
            }}
          />
          <div style={{
            width: 1, height: 60,
            background: 'var(--line)',
          }} />
          <image-slot
            id="logo-um"
            shape="rect"
            placeholder="Dépose le logo Université de Montpellier ici"
            style={{
              width: 200, height: 80,
              background: 'transparent',
            }}
          />
          <div style={{
            width: 1, height: 60,
            background: 'var(--line)',
          }} />
          <image-slot
            id="logo-cnrs"
            shape="rect"
            placeholder="Dépose le logo CNRS ici"
            style={{
              width: 120, height: 80,
              background: 'transparent',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingTop: 24,
          borderTop: '1px solid var(--line-soft)',
        }}>
          <JDMMark size={28} />
          <div>
            <div className="display" style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16, fontWeight: 600,
            }}>jdmAgent</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              phase-13-jarvis · build {new Date().toISOString().slice(0, 10)}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

window.ViewAide = ViewAide;
