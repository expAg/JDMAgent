// === webapp/shared.jsx ===
// Shared components — custom Select (fix dropdown hit-area bug),
// Field wrapper, Button, Card, Pill, Sparkline, JDMLogo mark.
//
// All exposed on window for cross-script consumption.

const { useState, useRef, useEffect, useMemo, useCallback } = React;

// ───────── JDM palette (logo + accent fallback) ─────────
const JDM_PALETTE = {
  magenta: '#c83a73',
  green:   '#4ea63c',
  yellow:  '#d4a90a',
  cyan:    '#1f97b1',
  orange:  '#d96810',
  violet:  '#7a4fbe',
};
const JDM_COLORS = Object.values(JDM_PALETTE);

// ───────── Logo mark — compact, theme-aware ─────────
function JDMMark({ size = 28 }) {
  // Sun-network glyph: a small dot ringed by colour pips.
  const r = size / 2;
  const ringR = r - 3;
  const n = 8;
  const dots = Array.from({ length: n }).map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: r + Math.cos(a) * ringR,
      y: r + Math.sin(a) * ringR,
      c: JDM_COLORS[i % JDM_COLORS.length],
    };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.6} fill={d.c} />
      ))}
      <circle cx={r} cy={r} r={3.6} fill="var(--accent)" />
    </svg>
  );
}

function JDMWordmark({ small = false }) {
  // wordmark adapts to theme. The "jdm" letters are a subtle nod to the
  // original JeuxDeMots logo: Lilita One display, slight per-letter rotation,
  // and the signature magenta/green/cyan colour run.
  const theme = document.body.dataset.theme || 'paper';
  const baseSize = small ? 17 : 22;
  const jdmSize = baseSize * 1.05;  // slight scale up — display face

  const jdmLetters = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 0,
    }}>
      <span style={{
        fontFamily: "'Lilita One', system-ui",
        fontSize: jdmSize,
        lineHeight: 0.95,
        color: 'color-mix(in srgb, var(--jdm-magenta) 55%, var(--ink) 45%)',
        display: 'inline-block',
        transform: 'rotate(-4deg) translateY(1px)',
      }}>j</span>
      <span style={{
        fontFamily: "'Lilita One', system-ui",
        fontSize: jdmSize,
        lineHeight: 0.95,
        color: 'color-mix(in srgb, var(--jdm-green) 55%, var(--ink) 45%)',
        display: 'inline-block',
        transform: 'rotate(2deg)',
      }}>d</span>
      <span style={{
        fontFamily: "'Lilita One', system-ui",
        fontSize: jdmSize,
        lineHeight: 0.95,
        color: 'color-mix(in srgb, var(--jdm-cyan) 55%, var(--ink) 45%)',
        display: 'inline-block',
        transform: 'rotate(-2deg) translateY(1px)',
        marginRight: 3,
      }}>m</span>
    </span>
  );

  if (theme === 'lab') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 1,
      }}>
        {jdmLetters}
        <span className="mono" style={{
          fontWeight: 600,
          fontSize: small ? 12 : 14,
          letterSpacing: '0.04em',
          color: 'var(--ink-2)',
          marginLeft: 2,
        }}>·agent</span>
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 1,
    }}>
      {jdmLetters}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: baseSize,
        letterSpacing: '-0.015em',
        color: 'var(--ink)',
      }}>Agent</span>
    </span>
  );
}

// ───────── Custom Select — the dropdown bug fix ─────────
// Full-width hit targets, generous vertical padding, no children
// stealing pointer events. Open/close on full trigger area; option
// list is a sibling div absolutely positioned (proper z-index).
function Select({ value, options, onChange, placeholder = 'Choisir…', width }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => (o.value ?? o) === value);
  const label = selected ? (selected.label ?? selected) : placeholder;

  return (
    <div className="om-select" ref={rootRef} style={{ width }}>
      <button
        type="button"
        className="om-select__trigger focus-ring"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}>
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? 'var(--ink)' : 'var(--ink-3)',
        }}>{label}</span>
        <svg className="om-select__chevron" width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open && (
        <div className="om-select__menu fade-up" role="listbox">
          {options.map((o, i) => {
            const v = o.value ?? o;
            const l = o.label ?? o;
            const sub = o.sub;
            const isSel = v === value;
            return (
              <div key={i}
                className="om-select__option"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(v); setOpen(false); }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
                  {sub && (
                    <div style={{
                      fontSize: 11, color: 'var(--ink-3)',
                      marginTop: 2, fontFamily: 'var(--font-mono)',
                    }}>{sub}</div>
                  )}
                </div>
                <svg className="check" width="12" height="12" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────── Field — label + helper + control ─────────
function Field({ label, hint, children, inline }) {
  return (
    <label style={{
      display: inline ? 'flex' : 'block',
      alignItems: inline ? 'center' : undefined,
      gap: inline ? 12 : 0,
      marginBottom: inline ? 8 : 14,
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--ink-2)',
        marginBottom: inline ? 0 : 6,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>{label}</div>
      <div style={{ flex: inline ? 1 : undefined }}>{children}</div>
      {hint && !inline && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>
      )}
    </label>
  );
}

// ───────── Input — text input that matches the select ─────────
function Input({ value, onChange, placeholder, mono, ...rest }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="focus-ring"
      style={{
        width: '100%',
        padding: '10px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        color: 'var(--ink)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 13,
        outline: 'none',
        transition: 'border-color 0.12s',
      }}
      {...rest}
    />
  );
}

// ───────── Slider ─────────
function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)' }}
      />
      <div className="mono" style={{
        minWidth: 48, textAlign: 'right',
        fontSize: 12, color: 'var(--ink-2)',
      }}>{value}{suffix}</div>
    </div>
  );
}

// ───────── Button ─────────
function Button({ children, onClick, variant = 'primary', size = 'md', icon, disabled, full }) {
  const styles = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--bg)',
      border: '1px solid var(--accent)',
    },
    secondary: {
      background: 'var(--bg-card)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid transparent',
    },
  }[variant];

  const sizes = {
    sm: { padding: '5px 10px', fontSize: 12 },
    md: { padding: '9px 14px', fontSize: 13 },
    lg: { padding: '11px 18px', fontSize: 14 },
  }[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring"
      style={{
        ...styles,
        ...sizes,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 'var(--radius)',
        fontFamily: 'inherit',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : undefined,
        transition: 'transform 0.06s, opacity 0.12s',
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
    >
      {icon}
      {children}
    </button>
  );
}

// ───────── Card ─────────
function Card({ children, padding = 20, style }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding,
      ...style,
    }}>{children}</div>
  );
}

// ───────── Pill / Tag ─────────
function Pill({ children, color = 'var(--ink-3)', tone = 'soft' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      background: tone === 'soft' ? 'var(--line-soft)' : color,
      color: tone === 'soft' ? color : 'var(--bg)',
      border: tone === 'outline' ? `1px solid ${color}` : 'none',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// ───────── Section title ─────────
function SectionTitle({ kicker, title, desc, right }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 20,
      paddingBottom: 14,
      borderBottom: '1px solid var(--line)',
    }}>
      <div>
        {kicker && (
          <div className="mono" style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 8,
          }}>{kicker}</div>
        )}
        <h1 className="display" style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'var(--ink)',
        }}>{title}</h1>
        {desc && (
          <p style={{
            margin: '8px 0 0',
            color: 'var(--ink-2)',
            fontSize: 14,
            maxWidth: '60ch',
          }}>{desc}</p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ───────── Empty state ─────────
function EmptyState({ icon, title, desc, action }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      color: 'var(--ink-3)',
    }}>
      {icon && <div style={{ marginBottom: 12, opacity: 0.6 }}>{icon}</div>}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 500,
        color: 'var(--ink-2)',
        marginBottom: 4,
      }}>{title}</div>
      {desc && <div style={{ fontSize: 13, marginBottom: 16 }}>{desc}</div>}
      {action}
    </div>
  );
}

// ───────── Triplet — visually distinctive "subject | relation | object" ─────
function Triplet({ subject, relation, object, weight, annotations }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)',
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{subject}</span>
      <span style={{ color: 'var(--ink-3)' }}>│</span>
      <span style={{ color: 'var(--accent)' }}>{relation}</span>
      <span style={{ color: 'var(--ink-3)' }}>│</span>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{object}</span>
      {weight != null && (
        <span style={{
          marginLeft: 'auto',
          color: 'var(--ink-3)',
          fontSize: 11,
        }}>w={weight}</span>
      )}
      {annotations && (
        <div style={{
          flexBasis: '100%',
          fontSize: 11,
          color: 'var(--ink-3)',
          paddingLeft: 4,
        }}>↳ {annotations}</div>
      )}
    </div>
  );
}

// ───────── Top nav (horizontal) — used by all themes ─────────
function TopNav({ active, setActive, theme, setTheme }) {
  const items = [
    { id: 'projet',    label: 'Projet' },
    { id: 'explorer',  label: 'Explorer' },
    { id: 'claim',     label: 'Claim checker' },
    { id: 'subgraph',  label: 'Sous-graphe' },
    { id: 'agent',     label: 'Agent' },
    { id: 'jarvis',    label: 'Jarvis' },
    { id: 'aide',      label: 'Aide' },
  ];
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--line)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <JDMMark size={26} />
          <JDMWordmark />
        </div>
        <nav style={{ display: 'flex', gap: 2, marginLeft: 12, overflow: 'auto' }}>
          {items.map(it => {
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setActive(it.id)}
                className="focus-ring"
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}>
                {it.label}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    left: 12, right: 12, bottom: -1,
                    height: 2,
                    background: 'var(--accent)',
                  }} />
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {setTheme && <ThemeSwitcher theme={theme} setTheme={setTheme} />}
          <Pill color="var(--jdm-green)" tone="outline">
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
            API JDM
          </Pill>
        </div>
      </div>
    </header>
  );
}

// Theme switcher — segmented control, always visible
function ThemeSwitcher({ theme, setTheme }) {
  const themes = [
    {
      id: 'paper',
      label: 'Paper',
      icon: (
        // Sun
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.7" fill="currentColor"/>
          {Array.from({length: 8}).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const x1 = 7 + Math.cos(a) * 4.4;
            const y1 = 7 + Math.sin(a) * 4.4;
            const x2 = 7 + Math.cos(a) * 6;
            const y2 = 7 + Math.sin(a) * 6;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />;
          })}
        </svg>
      ),
    },
    {
      id: 'lab',
      label: 'Lab',
      icon: (
        // Eclipse — dark disc with thin crescent halo
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
          <circle cx="7" cy="7" r="4.2" fill="currentColor"/>
          <circle cx="6.2" cy="6.2" r="3.5" fill="var(--bg)"/>
        </svg>
      ),
    },
  ];
  return (
    <div style={{
      display: 'inline-flex',
      padding: 3,
      background: 'var(--bg-elev)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      gap: 2,
    }}>
      {themes.map(t => {
        const on = theme === t.id;
        return (
          <button key={t.id}
            onClick={() => setTheme(t.id)}
            className="focus-ring"
            title={t.label}
            aria-label={`Thème ${t.label}`}
            style={{
              width: 30, height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: on ? 'var(--bg-card)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--ink-3)',
              border: '1px solid ' + (on ? 'var(--line)' : 'transparent'),
              borderRadius: 'calc(var(--radius) - 2px)',
              cursor: 'pointer',
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
              transition: 'background 0.12s, color 0.12s',
              padding: 0,
            }}>
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}

// ───────── Page shell — bg + padding ─────────
function PageShell({ children }) {
  return (
    <div style={{
      maxWidth: 1320,
      margin: '0 auto',
      padding: '32px 28px 80px',
    }}>{children}</div>
  );
}

Object.assign(window, {
  JDM_PALETTE, JDM_COLORS,
  Select, Field, Input, Slider, Button, Card, Pill, SectionTitle, EmptyState,
  Triplet, TopNav, ThemeSwitcher, PageShell, JDMMark, JDMWordmark,
});

// === webapp/views-projet.jsx ===
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

// === webapp/views-explorer.jsx ===
// View: Explorer — fetch relations for a term.
// Migration FastAPI : remplace FAKE_DATA par fetch('/api/explore').

const EXPLORE_RELATIONS = [
  { value: 'r_syn', label: 'Synonymes', sub: 'r_syn' },
  { value: 'r_anto', label: 'Antonymes', sub: 'r_anto' },
  { value: 'r_isa', label: 'Hyperonymes — "est un"', sub: 'r_isa' },
  { value: 'r_hypo', label: 'Hyponymes — "exemples de"', sub: 'r_hypo' },
  { value: 'r_has_part', label: 'Parties / composants', sub: 'r_has_part' },
  { value: 'r_carac', label: 'Caractéristiques', sub: 'r_carac' },
  { value: 'r_has_color', label: 'Couleurs', sub: 'r_has_color' },
  { value: 'r_lieu', label: 'Lieux typiques', sub: 'r_lieu' },
  { value: 'r_agent', label: 'Agents typiques (verbe)', sub: 'r_agent' },
  { value: 'r_patient', label: 'Patients typiques (verbe)', sub: 'r_patient' },
  { value: 'r_instr', label: 'Instruments (verbe)', sub: 'r_instr' },
  { value: 'r_telic_role', label: 'Rôle télique — à quoi sert', sub: 'r_telic_role' },
  { value: 'r_has_causatif', label: 'Causes', sub: 'r_has_causatif' },
  { value: 'r_has_conseq', label: 'Conséquences', sub: 'r_has_conseq' },
  { value: 'r_but', label: 'But', sub: 'r_but' },
  { value: 'r_manner', label: 'Manière (verbe / processus)', sub: 'r_manner' },
];

function ViewExplorer() {
  // Defaults alignés sur la branche deploy-self : chat / r_isa / 25 / 20 / true.
  const [term, setTerm] = useState('chat');
  const [rel, setRel] = useState('r_isa');
  const [minWeight, setMinWeight] = useState(25);
  const [limit, setLimit] = useState(20);
  const [annotations, setAnnotations] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  // rows = liste de {source, relation, target, weight, annotations, target_id}
  // (forme directement renvoyee par /api/explore — pas de remapping cote front)
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onRun = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          relation: rel,
          min_weight: Number(minWeight),
          limit: Number(limit),
          with_annotations: !!annotations,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMessage(data.message || '');
      setLoaded(true);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setRows([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au premier render pour montrer un resultat (chat r_has_part)
  React.useEffect(() => { onRun(); }, []);

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · sans LLM"
        title="Explorer"
        desc="Récupère les relations d'un terme dans JeuxDeMots. Instantané, déterministe, mis en cache."
      />

      {/* Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
        gap: 14,
        alignItems: 'flex-end',
        marginBottom: 16,
      }}>
        <Field label="Terme">
          <Input value={term} onChange={setTerm} placeholder="chat, avocat, courir…" mono />
        </Field>
        <Field label="Type de relation">
          <Select value={rel} options={EXPLORE_RELATIONS} onChange={setRel} />
        </Field>
        <Button onClick={onRun} size="lg" disabled={loading}>
          {loading ? 'Chargement…' : 'Interroger'}
        </Button>
      </div>

      {/* Secondary controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 20,
        padding: '14px 16px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius)',
        marginBottom: 28,
      }}>
        <Field label="Poids minimum" inline>
          <Slider value={minWeight} onChange={setMinWeight} min={0} max={500} step={5} />
        </Field>
        <Field label="Limite" inline>
          <Slider value={limit} onChange={setLimit} min={5} max={200} step={5} />
        </Field>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
        }}>
          <input type="checkbox"
            checked={annotations}
            onChange={(e) => setAnnotations(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Annotations sémantiques (constitutif, contrastif…)
        </label>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: 16,
          marginBottom: 16,
          background: 'rgba(200, 58, 115, 0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)',
          fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {loaded && !error && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 12,
          }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--ink)' }}>{rows.length}</span> triplet{rows.length > 1 ? 's' : ''} trouvé{rows.length > 1 ? 's' : ''}
              {' · '}
              <span style={{ color: 'var(--ink)' }}>{term}</span> | <span style={{ color: 'var(--accent)' }}>{rel}</span> | ?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="secondary"
                onClick={() => exportCSV(rows, term, rel)}>Exporter CSV</Button>
              <Button size="sm" variant="ghost"
                onClick={() => window.dispatchEvent(new CustomEvent('jdm:goto', { detail: { view: 'subgraph', term } }))}>
                Voir le graphe →
              </Button>
            </div>
          </div>

          {/* Distribution sparkline */}
          {rows.length > 0 && (
            <Card padding={16} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Distribution des poids
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  max {Math.max(...rows.map(r => r.weight))} · min {Math.min(...rows.map(r => r.weight))}
                </div>
              </div>
              <Bars rows={rows} />
            </Card>
          )}

          {/* Triplets list */}
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r, i) => (
              <Triplet key={i}
                subject={r.source || term}
                relation={r.relation || rel}
                object={r.target}
                weight={r.weight}
                annotations={annotations && r.annotations ? r.annotations : undefined}
              />
            ))}
          </div>

          {rows.length === 0 && (
            <EmptyState
              title="Aucun triplet"
              desc={message || `Aucun « ${term} | ${rel} | ? » avec w ≥ ${minWeight}. Essaie un seuil plus bas.`}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function Bars({ rows }) {
  const max = Math.max(...rows.map(r => r.weight), 1);
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      alignItems: 'flex-end',
      height: 64,
    }}>
      {rows.map((r, i) => (
        <div key={i} title={`${r.target} · w=${r.weight}`}
          style={{
            flex: 1,
            height: `${(r.weight / max) * 100}%`,
            minHeight: 2,
            background: 'var(--accent)',
            opacity: 0.3 + 0.7 * (r.weight / max),
            borderRadius: '2px 2px 0 0',
          }} />
      ))}
    </div>
  );
}

// Helper : export CSV simple (téléchargement client-side)
function exportCSV(rows, term, rel) {
  if (!rows || rows.length === 0) return;
  const header = ['source', 'relation', 'target', 'weight', 'annotations', 'target_id'];
  const escape = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(k => escape(r[k])).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jdm_${term}_${rel}.csv`.replace(/[^a-z0-9_\-.]/gi, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.ViewExplorer = ViewExplorer;

// === webapp/views-claim.jsx ===
// View: Claim checker — verify subject | relation | object via /api/factcheck.

const CLAIM_RELATIONS_OPTS = [
  { value: 'r_isa', label: 'r_isa — est un' },
  { value: 'r_hypo', label: 'r_hypo — exemple de' },
  { value: 'r_carac', label: 'r_carac — caractéristique' },
  { value: 'r_has_color', label: 'r_has_color — couleur' },
  { value: 'r_has_part', label: 'r_has_part — partie / composant' },
  { value: 'r_agent', label: 'r_agent — agent typique' },
  { value: 'r_patient', label: 'r_patient — patient typique' },
  { value: 'r_instr', label: 'r_instr — instrument' },
  { value: 'r_lieu', label: 'r_lieu — lieu typique' },
  { value: 'r_has_causatif', label: 'r_has_causatif — cause' },
  { value: 'r_has_conseq', label: 'r_has_conseq — conséquence' },
  { value: 'r_but', label: 'r_but — but' },
  { value: 'r_telic_role', label: 'r_telic_role — à quoi sert' },
];

const EFFORT_OPTS = [
  { value: 0, label: '0 — Contenance', sub: 'JDM contient-il ce triplet ?' },
  { value: 1, label: '1 — + inférence noyau', sub: 'isa-transitivité + agent/patient' },
  { value: 2, label: '2 — + inférence complète', sub: 'tous les schémas (lent)' },
];

// Mapping backend origin → libellé FR pour l'UI.
const ORIGIN_LABEL = {
  inference: 'inférence',
  containment: 'contenance',
  none: '—',
};

function ViewClaim() {
  // Defaults alignés sur la branche deploy-self : baleine | r_isa | poisson / effort 0.
  const [subject, setSubject] = useState('baleine');
  const [relation, setRelation] = useState('r_isa');
  const [object_, setObject] = useState('poisson');
  const [effort, setEffort] = useState(0);
  const [bypass, setBypass] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          relation,
          object: object_,
          effort: Number(effort),
          bypass: !!bypass,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data.error) {
        // Cas terme inconnu : on affiche le banner UNKNOWN avec le message
        setResult({
          status: 'unknown',
          confidence: 0,
          explanation: data.error,
          origin: ORIGIN_LABEL[data.origin] || '—',
        });
      } else {
        setResult({
          status: data.status,
          confidence: data.confidence,
          explanation: data.explanation,
          origin: ORIGIN_LABEL[data.origin] || '—',
          inference_schema: data.inference_schema,
          proof: data.proof,
          counter: data.counter,
        });
      }
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au mount pour montrer un exemple
  React.useEffect(() => { run(); }, []);

  const examples = [
    ['chat', 'r_isa', 'animal'],
    ['tomate', 'r_isa', 'fruit'],
    ['tomate', 'r_isa', 'légume'],
    ['chat', 'r_agent', 'aboyer'],
  ];

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · déterministe"
        title="Claim checker"
        desc="Vérifie une affirmation atomique. JDM répond ✅ supporté, ❌ contredit, ou ❓ inconnu, avec sa chaîne de preuve."
      />

      {/* Triplet builder */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        marginBottom: 16,
      }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 12,
        }}>Construire le triplet</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr',
          gap: 10,
          alignItems: 'center',
        }}>
          <Input value={subject} onChange={setSubject} placeholder="sujet" mono />
          <Sep />
          <Select value={relation} options={CLAIM_RELATIONS_OPTS} onChange={setRelation} />
          <Sep />
          <Input value={object_} onChange={setObject} placeholder="objet" mono />
        </div>

        {/* Options + run */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr auto',
          gap: 14,
          alignItems: 'end',
          marginTop: 18,
        }}>
          <Field label="Effort de vérification">
            <Select value={effort} options={EFFORT_OPTS} onChange={(v) => setEffort(Number(v))} />
          </Field>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
            padding: '10px 0',
          }}>
            <input type="checkbox" checked={bypass}
              onChange={(e) => setBypass(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }} />
            Bypass contenance
          </label>
          <Button onClick={run} size="lg" disabled={loading}>
            {loading ? 'Vérification…' : 'Vérifier'}
          </Button>
        </div>
      </div>

      {/* Quick examples */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        marginBottom: 28,
      }}>
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          alignSelf: 'center', marginRight: 6,
        }}>Exemples :</span>
        {examples.map(([s, r, o], i) => (
          <button key={i}
            className="focus-ring"
            onClick={() => {
              setSubject(s); setRelation(r); setObject(o);
              // Délai pour laisser React appliquer les setState avant fetch
              setTimeout(run, 50);
            }}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 999,
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: 'pointer',
            }}>
            {s} | {r} | {o}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: 16,
          marginBottom: 16,
          background: 'rgba(200, 58, 115, 0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)',
          fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && <ClaimResult result={result} subject={subject} relation={relation} object={object_} />}
    </PageShell>
  );
}

function Sep() {
  return (
    <div style={{
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      fontSize: 20,
      userSelect: 'none',
    }}>│</div>
  );
}

function ClaimResult({ result, subject, relation, object }) {
  const verdict = {
    supported:    { icon: '✓', label: 'SUPPORTED',    color: 'var(--jdm-green)' },
    contradicted: { icon: '✗', label: 'CONTRADICTED', color: 'var(--jdm-magenta)' },
    unknown:      { icon: '?', label: 'UNKNOWN',      color: 'var(--ink-3)' },
  }[result.status] || { icon: '?', label: result.status, color: 'var(--ink-3)' };

  const confidence = typeof result.confidence === 'number' ? result.confidence : 0;

  return (
    <div className="fade-up">
      {/* Banner */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        background: 'var(--bg-card)',
        border: `2px solid ${verdict.color}`,
        borderRadius: 'var(--radius-lg)',
        marginBottom: 16,
      }}>
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          borderRadius: '50%',
          background: verdict.color,
          color: 'var(--bg)',
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}>{verdict.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 11, color: verdict.color,
            letterSpacing: '0.18em', fontWeight: 700,
            marginBottom: 6,
          }}>{verdict.label}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 8,
          }}>
            <span className="mono" style={{
              fontSize: 17,
              color: 'var(--ink)',
            }}>{subject}</span>
            <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>│</span>
            <span className="mono" style={{
              fontSize: 17, color: 'var(--accent)',
            }}>{relation}</span>
            <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>│</span>
            <span className="mono" style={{
              fontSize: 17,
              color: 'var(--ink)',
            }}>{object}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{result.explanation}</div>
          {result.inference_schema && (
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              marginTop: 8,
            }}>
              schéma : <span style={{ color: 'var(--accent)' }}>{result.inference_schema}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Confiance</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32, fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1,
            marginTop: 6,
          }}>{confidence.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            {result.origin === 'inférence' ? '🧠 via inférence' :
             result.origin === 'contenance' ? '📦 via contenance' : ''}
          </div>
        </div>
      </div>

      {/* Proof chain */}
      {result.proof && result.proof.length > 0 && (
        <Card>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12,
          }}>{result.origin === 'inférence' ? '🔗 Chaîne de déduction' : '✓ Évidences en faveur'}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {result.proof.map((e, i) => (
              <Triplet key={i} subject={e.s} relation={e.r} object={e.t} weight={e.w} />
            ))}
          </div>
        </Card>
      )}

      {result.counter && result.counter.length > 0 && (
        <Card>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--jdm-magenta)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12,
          }}>✗ Évidences contraires</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {result.counter.map((e, i) => (
              <Triplet key={i} subject={e.s} relation={e.r} object={e.t} weight={e.w} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

window.ViewClaim = ViewClaim;

// === webapp/views-subgraph.jsx ===
// View: Sous-graphe — extract & visualise a term's neighbourhood via /api/subgraph.
// Deux formats : HTML interactif (iframe vis-network) par défaut, ou SVG natif.

const SUBGRAPH_DEFAULT_RELATIONS = [
  'r_isa', 'r_hypo', 'r_syn', 'r_anto',
  'r_carac', 'r_has_part', 'r_lieu', 'r_domain',
];
const SUBGRAPH_DEFAULT_D2 = ['r_isa', 'r_carac', 'r_has_part', 'r_lieu'];
const SUBGRAPH_DEFAULT_D3 = ['r_isa', 'r_has_part', 'r_carac'];
const SUBGRAPH_DEFAULT_D4 = ['r_isa', 'r_carac'];

const SUBGRAPH_ALL_RELATIONS = [
  ...SUBGRAPH_DEFAULT_RELATIONS,
  'r_has_color', 'r_agent', 'r_patient', 'r_instr',
  'r_telic_role', 'r_has_causatif', 'r_has_conseq',
  'r_patient-1', 'r_agent-1', 'r_associated',
];

// Mapping kind → couleur (utilisé par le rendu SVG).
const KIND_COLOR = {
  center: '#1a1a1a',
  isa:    '#1565c0', hypo:   '#2e7d32', syn:    '#558b2f', anto:   '#c62828',
  carac:  '#6a1b9a', part:   '#a04500', lieu:   '#00838f',
  verb:   '#ef6c00', domain: '#455a64', assoc:  '#757575',
};
const KIND_OF_REL = {
  r_isa: 'isa', r_hypo: 'hypo', r_syn: 'syn', r_anto: 'anto',
  r_carac: 'carac', r_has_part: 'part', r_lieu: 'lieu',
  'r_patient-1': 'verb', 'r_agent-1': 'verb',
  r_domain: 'domain', r_associated: 'assoc',
};

function ViewSubgraph() {
  // Si Explorer a navigué vers nous via jdm:goto, on récupère son terme.
  const initialTerm = (typeof window !== 'undefined' && window.__jdmPendingTerm) || 'plat asiatique';
  if (typeof window !== 'undefined') window.__jdmPendingTerm = null;
  const [term, setTerm] = useState(initialTerm);
  const [depth, setDepth] = useState(1);
  const [topK, setTopK] = useState(3);
  const [topKd2, setTopKd2] = useState(3);
  const [topKd3, setTopKd3] = useState(3);
  const [topKd4, setTopKd4] = useState(3);
  const [activeRels, setActiveRels] = useState(SUBGRAPH_DEFAULT_RELATIONS);
  const [activeRelsD2, setActiveRelsD2] = useState(SUBGRAPH_DEFAULT_D2);
  const [activeRelsD3, setActiveRelsD3] = useState(SUBGRAPH_DEFAULT_D3);
  const [activeRelsD4, setActiveRelsD4] = useState(SUBGRAPH_DEFAULT_D4);
  const [minWeight, setMinWeight] = useState(0);
  const [maxNodes, setMaxNodes] = useState(40);
  const [format, setFormat] = useState('html');  // 'html' par défaut (vis-network)
  const [data, setData] = useState({ nodes: [], edges: [], stats: {}, html: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleIn = (set, setSet) => (r) =>
    setSet((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);

  const onBuild = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('api/subgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          depth: Number(depth),
          top_k: Number(topK),
          top_k_d2: Number(topKd2),
          top_k_d3: Number(topKd3),
          top_k_d4: Number(topKd4),
          relations: activeRels,
          relations_d2: activeRelsD2,
          relations_d3: activeRelsD3,
          relations_d4: activeRelsD4,
          min_weight: Number(minWeight),
          max_nodes: Number(maxNodes),
          format,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const d = await res.json();
      setData({
        nodes: d.nodes || [],
        edges: d.edges || [],
        stats: d.stats || {},
        html: d.html || '',
        format: d.format,
      });
      if (d.message) setMessage(d.message);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setData({ nodes: [], edges: [], stats: {}, html: '' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run au mount
  React.useEffect(() => { onBuild(); }, []);

  const stats = data.stats || {};

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · visualisation"
        title="Sous-graphe"
        desc="Extrait et visualise le voisinage d'un terme à profondeur N, filtré par type de relation. Deux formats : HTML interactif (vis-network) ou SVG natif."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: controls */}
        <div style={{
          position: 'sticky', top: 80,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <Card padding={16}>
            <Field label="Terme racine">
              <Input value={term} onChange={setTerm} mono />
            </Field>
            <Field label={`Profondeur · ${depth}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {[1, 2, 3, 4].map(d => (
                  <button key={d}
                    onClick={() => setDepth(d)}
                    className="focus-ring"
                    style={{
                      padding: '8px',
                      background: depth === d ? 'var(--accent)' : 'var(--bg-elev)',
                      border: '1px solid var(--line)',
                      color: depth === d ? 'var(--bg)' : 'var(--ink)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Format de rendu">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {['html', 'svg'].map(f => (
                  <button key={f}
                    onClick={() => setFormat(f === 'svg' ? 'json' : 'html')}
                    className="focus-ring"
                    style={{
                      padding: '8px',
                      background: (f === 'svg' ? format === 'json' : format === 'html')
                                  ? 'var(--accent)' : 'var(--bg-elev)',
                      border: '1px solid var(--line)',
                      color: (f === 'svg' ? format === 'json' : format === 'html')
                             ? 'var(--bg)' : 'var(--ink)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}>{f}</button>
                ))}
              </div>
            </Field>
            <Field label={`Poids minimum · ${minWeight}`}>
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
            </Field>
            {format === 'json' && (
              <Field label={`Nœuds max (SVG) · ${maxNodes}`}>
                <Slider value={maxNodes} onChange={setMaxNodes} min={10} max={200} step={5} />
              </Field>
            )}
            <div style={{ marginTop: 12 }}>
              <Button full onClick={onBuild} disabled={loading}>
                {loading ? 'Construction…' : 'Construire le graphe'}
              </Button>
            </div>
          </Card>

          {/* Niveau 1 */}
          <RelationFilterCard
            label={`Niveau 1 — voisins (top-K ${topK})`}
            topK={topK} setTopK={setTopK}
            active={activeRels} setActive={setActiveRels}
          />
          {depth >= 2 && (
            <RelationFilterCard
              label={`Niveau 2 (top-K ${topKd2})`}
              topK={topKd2} setTopK={setTopKd2}
              active={activeRelsD2} setActive={setActiveRelsD2}
            />
          )}
          {depth >= 3 && (
            <RelationFilterCard
              label={`Niveau 3 (top-K ${topKd3})`}
              topK={topKd3} setTopK={setTopKd3}
              active={activeRelsD3} setActive={setActiveRelsD3}
            />
          )}
          {depth >= 4 && (
            <RelationFilterCard
              label={`Niveau 4 (top-K ${topKd4})`}
              topK={topKd4} setTopK={setTopKd4}
              active={activeRelsD4} setActive={setActiveRelsD4}
            />
          )}
        </div>

        {/* Right: viz */}
        <div>
          {error && (
            <div style={{
              padding: 16, marginBottom: 12,
              background: 'rgba(200, 58, 115, 0.08)',
              border: '1px solid var(--jdm-magenta)',
              borderRadius: 'var(--radius)',
              color: 'var(--jdm-magenta)', fontSize: 13,
            }}>⚠️ {error}</div>
          )}
          {message && !error && (
            <div style={{
              padding: 12, marginBottom: 12,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius)',
              color: 'var(--ink-2)', fontSize: 13,
            }}>{message}</div>
          )}

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span>
                {' · '}profondeur {depth}
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_nodes ?? data.nodes.length}</span> nœuds
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_edges ?? data.edges.length}</span> arêtes
                {' · '}<span className="mono" style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{data.format || format}</span>
              </div>
            </div>
            <div style={{ height: 640, background: '#ffffff', position: 'relative' }}>
              {data.format === 'html' && data.html ? (
                <iframe
                  title="JDM subgraph"
                  srcDoc={data.html}
                  sandbox="allow-scripts allow-same-origin"
                  style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                />
              ) : data.nodes && data.nodes.length > 0 ? (
                <GraphViz nodes={data.nodes} edges={data.edges} relations={activeRels} />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: 'var(--ink-3)', fontSize: 13,
                }}>
                  {loading ? 'Construction…' : 'Aucun nœud à afficher.'}
                </div>
              )}
            </div>
          </Card>

          {/* Stats below */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12, marginTop: 16,
          }}>
            {[
              ['Nœuds', String(stats.n_nodes ?? data.nodes.length)],
              ['Arêtes', String(stats.n_edges ?? data.edges.length)],
              ['Négations', String(stats.n_negative ?? data.edges.filter(e => e.negative).length)],
              ['Profondeur', String(stats.depth ?? depth)],
            ].map(([k, v]) => (
              <Card key={k} padding={14}>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{k}</div>
                <div className="display" style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24, fontWeight: 600, marginTop: 6,
                }}>{v}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function RelationFilterCard({ label, topK, setTopK, active, setActive }) {
  const toggle = (r) =>
    setActive((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  return (
    <Card padding={16}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, marginBottom: 10 }}>
        <Slider value={topK} onChange={setTopK} min={1} max={15} step={1} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SUBGRAPH_ALL_RELATIONS.map(r => {
          const on = active.includes(r);
          const kind = KIND_OF_REL[r] || 'assoc';
          const c = KIND_COLOR[kind];
          return (
            <button key={r}
              onClick={() => toggle(r)}
              style={{
                padding: '3px 8px',
                background: on ? c : 'transparent',
                border: `1px solid ${on ? c : 'var(--line)'}`,
                borderRadius: 999,
                color: on ? '#fff' : 'var(--ink-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer',
              }}>{r}</button>
          );
        })}
      </div>
    </Card>
  );
}

// Layout SVG : anneaux concentriques par profondeur.
function GraphViz({ nodes, edges }) {
  const W = 800, H = 640, cx = W / 2, cy = H / 2;
  const RING_RADII = [0, 160, 250, 320, 380];

  const byDepth = {};
  for (const n of nodes) {
    const d = Math.min(n.depth ?? 1, 4);
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n);
  }
  const positioned = [];
  for (const dStr of Object.keys(byDepth).sort()) {
    const d = Number(dStr);
    const arr = byDepth[d];
    const r = RING_RADII[d] ?? 380;
    if (d === 0 || arr.length === 1) {
      positioned.push({ ...arr[0], x: cx, y: cy, r: 22, depth: d });
    } else {
      arr.forEach((n, i) => {
        const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2 + d * 0.15;
        const nr = d === 1 ? 14 : (d === 2 ? 11 : 9);
        positioned.push({
          ...n,
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          r: nr, depth: d,
        });
      });
    }
  }
  const byId = Object.fromEntries(positioned.map(n => [n.id, n]));
  const trunc = (s, max) => (s && s.length > max) ? s.slice(0, max - 1) + '…' : (s || '');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        const color = e.negative ? '#c62828'
          : (KIND_COLOR[KIND_OF_REL[e.relation] || 'assoc'] || KIND_COLOR.assoc);
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color}
            strokeOpacity={e.depth >= 2 ? 0.35 : 0.6}
            strokeWidth={e.depth >= 2 ? 1.0 : 1.4}
            strokeDasharray={e.depth >= 2 ? '4 3' : undefined}
          />
        );
      })}
      {positioned.map((n, i) => {
        const isCenter = n.depth === 0;
        const kindColor = KIND_COLOR[n.kind] || KIND_COLOR.assoc;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={isCenter ? '#c0411a' : '#fbf6ea'}
              stroke={isCenter ? '#c0411a' : kindColor}
              strokeWidth={isCenter ? 0 : 1.2}
            />
            <text x={n.x} y={n.y + n.r + 14}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={isCenter ? 13 : (n.depth === 1 ? 11 : 10)}
              fontWeight={isCenter ? 700 : 400}
              fill="#1f1d18">
              {trunc(n.label, isCenter ? 28 : 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

window.ViewSubgraph = ViewSubgraph;

// === webapp/views-agent.jsx ===
// View: Agent — conversational chat with the LLM + JDM tools (via SSE).

const AGENT_MODELS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', sub: 'pool gratuit · 500 req/jour' },
  { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash',      sub: 'pool gratuit · 20 req/jour' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', sub: 'pool gratuit · 20 req/jour' },
  { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5',      sub: 'BYOK Anthropic' },
  { value: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5',     sub: 'BYOK Anthropic' },
  { value: 'gpt-4o-mini',           label: 'GPT-4o mini',           sub: 'BYOK OpenAI' },
  { value: 'gpt-4o',                label: 'GPT-4o',                sub: 'BYOK OpenAI' },
];

function ViewAgent() {
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [thinking, setThinking] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [convo, setConvo] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const needsBYOK = model.startsWith('claude-') || model.startsWith('gpt-');

  // Send : POST /api/agent/stream, parse SSE en flux, accumule sur le
  // dernier message assistant (créé vide juste avant le fetch).
  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    // Snapshot l'historique AVANT d'ajouter le message courant
    // (le backend l'attend séparément via `message`).
    const historySnapshot = convo.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? (m.content || '') : m.content,
    }));
    const assistantStub = { role: 'assistant', thoughts: [], tools: [], content: '', error: '' };
    setConvo([...convo, userMsg, assistantStub]);
    const msg = input;
    setInput('');
    setStreaming(true);

    // Helper : update le dernier message (assistant) en place.
    const patchLast = (mutator) => {
      setConvo(prev => {
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        mutator(last);
        next[next.length - 1] = last;
        return next;
      });
    };

    try {
      const res = await fetch('api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: historySnapshot,
          api_key: apiKey,
          model,
          use_thinking: thinking,
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      const flushEvents = () => {
        // Séparateur d'événement = ligne vide (= deux fins de ligne
        // consécutives). sse-starlette utilise CRLF par défaut donc on
        // accepte \r\n\r\n, \n\n, et \r\r pour être robuste.
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const rawEv = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEvent(rawEv);
          if (ev) handleEvent(ev, patchLast);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        flushEvents();
      }
      // Vide final : reste éventuel (si dernier event sans sep)
      if (buf.trim()) {
        const ev = parseSSEEvent(buf);
        if (ev) handleEvent(ev, patchLast);
      }
    } catch (e) {
      patchLast(last => { last.error = String(e && e.message ? e.message : e); });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · agent LLM"
        title="Agent"
        desc="Chat conversationnel. Le modèle a accès aux outils JDM via LangChain."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Conversation */}
        <div>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            minHeight: 500,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '20px 24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              maxHeight: 600,
              overflowY: 'auto',
            }}>
              {convo.length === 0 && (
                <div style={{
                  color: 'var(--ink-3)', fontSize: 13,
                  textAlign: 'center', padding: '60px 0',
                }}>
                  Pose une question sur la langue française — l'agent ira interroger JDM.
                </div>
              )}
              {convo.map((m, i) => <Message key={i} m={m} />)}
              {streaming && (
                <div style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontStyle: 'italic',
                }}>⏳ génération en cours…</div>
              )}
            </div>

            {/* Composer */}
            <div style={{
              borderTop: '1px solid var(--line-soft)',
              padding: 14,
              background: 'var(--bg-elev)',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            }}>
              <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
              }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault(); send();
                    }
                  }}
                  placeholder="Pose une question sur la langue française…"
                  rows={2}
                  className="focus-ring"
                  style={{
                    flex: 1,
                    resize: 'none',
                    padding: '10px 12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--ink)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    lineHeight: 1.5,
                    outline: 'none',
                  }}
                />
                <Button onClick={send} size="lg" disabled={streaming || !input.trim()}>
                  {streaming ? '…' : 'Envoyer'}
                </Button>
              </div>
              <div style={{
                marginTop: 8,
                fontSize: 11, color: 'var(--ink-3)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span className="kbd">Entrée</span> envoyer
                <span style={{ opacity: 0.4 }}>·</span>
                <span className="kbd">⇧ Entrée</span> nouvelle ligne
                <span style={{ marginLeft: 'auto' }}>
                  Modèle : <span className="mono" style={{ color: 'var(--ink)' }}>{model}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — config */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'sticky',
          top: 80,
        }}>
          <Card padding={16}>
            <Field label="Modèle">
              <Select value={model} options={AGENT_MODELS} onChange={setModel} />
            </Field>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
              marginBottom: needsBYOK ? 14 : 0,
            }}>
              <input type="checkbox" checked={thinking}
                onChange={(e) => setThinking(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }} />
              Raisonnement (chain-of-thought)
            </label>
            {needsBYOK && (
              <Field label="Clé API" hint="Conservée en session uniquement.">
                <Input value={apiKey} onChange={setApiKey} placeholder={
                  model.startsWith('claude-') ? 'sk-ant-…' : 'sk-…'
                } mono />
              </Field>
            )}
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 10,
            }}>Outils JDM</div>
            <div style={{
              fontSize: 12, color: 'var(--ink-2)',
              lineHeight: 1.5,
            }}>
              L'agent dispose d'une trentaine d'outils LangChain
              wrappant le client JDM : exploration, vérification,
              désambiguïsation, inférence, sous-graphe.
            </div>
          </Card>

          <PoolWidget model={model} />
        </div>
      </div>
    </PageShell>
  );
}

// ─── SSE helpers ────────────────────────────────────────────────

function parseSSEEvent(raw) {
  // Normalise CRLF → LF puis parse ligne par ligne. Ignore les
  // commentaires (lignes commençant par `:`, utilisés pour keepalive).
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      // SSE : `data:` peut apparaître plusieurs fois, chaque valeur est
      // jointe par `\n`. L'espace après `:` est optionnel mais usuel.
      const v = line.slice(5).replace(/^ /, '');
      data += (data ? '\n' : '') + v;
    }
  }
  if (!data) return null;
  let parsed;
  try { parsed = JSON.parse(data); }
  catch { parsed = { text: data }; }
  return { event, data: parsed };
}

function handleEvent(ev, patchLast) {
  const d = ev.data || {};
  switch (ev.event) {
    case 'text':
      // app.chat_with_agent yield le markdown cumulatif live (thoughts,
      // tool_calls, tool_results, réponse finale — déjà formaté en
      // narration markdown). On remplace simplement le contenu.
      patchLast(last => { last.content = d.text || ''; });
      break;
    case 'done':
      // Stream terminé proprement, rien à faire (UI se ferme via finally)
      break;
    case 'error':
      patchLast(last => { last.error = d.text || 'Erreur inconnue.'; });
      break;
    default:
      break;
  }
}

// ─── Rendu d'un message ────────────────────────────────────────

function Message({ m }) {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '70%',
          padding: '10px 14px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          borderRadius: 'var(--radius-lg)',
          fontSize: 14,
          lineHeight: 1.5,
        }}>{m.content}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: 6, marginTop: 2,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <JDMMark size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {m.content && (
          <div className="jdm-agent-bubble"
            style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
        )}
        {m.error && (
          <div style={{
            padding: 10,
            marginTop: 8,
            background: 'rgba(200, 58, 115, 0.08)',
            border: '1px solid var(--jdm-magenta)',
            borderRadius: 'var(--radius)',
            color: 'var(--jdm-magenta)',
            fontSize: 12,
          }}>
            ⚠️ {m.error}
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarkdownLite(s) {
  // L'agent produit volontairement des balises HTML pour styliser ses
  // mots (ex: <strong>chat</strong>, <code>r_isa</code>, <em>...</em>).
  // On NE LES ESCAPE PAS — c'est du contenu de confiance produit par
  // notre propre LLM. On préfère utiliser marked.js si dispo (rendu
  // markdown plein + GFM tables) — sinon fallback sur le subset léger.
  s = s || '';
  if (typeof window !== 'undefined' && window.marked) {
    try {
      window.marked.setOptions({ gfm: true, breaks: true });
      return window.marked.parse(s);
    } catch {
      // fallback ci-dessous
    }
  }
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>')
    .replace(/\n/g, '<br/>');
}

// ─── Pool Gemini widget — état réel + bouton rotation ────────────

function PoolWidget({ model }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await fetch('api/pool/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
      setError('');
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
    }
  };
  React.useEffect(() => { load(); }, []);

  const rotate = async () => {
    setBusy(true);
    try {
      const r = await fetch('api/pool/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, skip_current: true }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
      setError('');
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <Card padding={16}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 8,
        }}>Pool Gemini</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{error || 'Chargement…'}</div>
      </Card>
    );
  }

  const keys = status.keys || [];
  const isGemini = model && model.startsWith('gemini-');

  return (
    <Card padding={16}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 10,
      }}>Pool Gemini · {keys.length} clé{keys.length > 1 ? 's' : ''}</div>

      {keys.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Pool vide — configure <code className="mono">GOOGLE_API_KEYS</code>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
          {keys.map((k, i) => {
            const blownHere = isGemini && k.blown_by_model && k.blown_by_model[model];
            const status_icon = k.invalid ? '🚫' : blownHere ? '❌' : k.is_current ? '✅' : '○';
            const status_color = k.invalid ? 'var(--jdm-magenta)'
                                 : blownHere ? 'var(--jdm-orange)'
                                 : k.is_current ? 'var(--jdm-green)'
                                 : 'var(--ink-3)';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px',
                background: k.is_current ? 'var(--bg-elev)' : 'transparent',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>
                <span style={{ color: status_color }}>{status_icon}</span>
                <span style={{ color: 'var(--ink-2)' }}>{k.masked}</span>
                {k.is_current && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9,
                    color: 'var(--jdm-green)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>actuelle</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isGemini && status.current_model && (
        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
          ❌ = épuisée pour <strong style={{ color: 'var(--ink-2)' }}>{model}</strong> aujourd'hui
        </div>
      )}

      <Button size="sm" variant="secondary" full onClick={rotate} disabled={busy || keys.length === 0}>
        {busy ? '↻ Rotation…' : '↻ Rotation manuelle'}
      </Button>

      {error && (
        <div style={{
          marginTop: 8, padding: 8,
          background: 'rgba(200,58,115,0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)', fontSize: 11,
        }}>{error}</div>
      )}
    </Card>
  );
}

window.ViewAgent = ViewAgent;

// === webapp/views-jarvis.jsx ===
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
  const [finalText, setFinalText] = useState('');
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
    setLog([]); setAccepted([]); setFinalText(''); setHeadline('');
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
      // Le backend wrappe run_jarvis_flow qui yield (messages, fpath,
      // fpreview, [state]). On reçoit donc des events de type "jarvis"
      // avec le contenu narratif complet (markdown cumulatif) dans le
      // dernier message assistant. On compte les triplets consolidés
      // en parsant la narration côté client (le pattern « consolidé »
      // apparaît dans la trace markdown).
      let prevConsolidatedCount = 0;
      let lastFilePath = null;
      const dispatchEvent = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'headline':
            setHeadline(d.text || '');
            setLog(l => [...l, { t: ts(), tag: '[start]', kind: 'iter', msg: d.text || '' }]);
            break;
          case 'jarvis': {
            // d.messages = [{role, content}], d.file_path, d.file_preview
            const msgs = d.messages || [];
            // Affiche la dernière bulle assistant comme « réponse finale
            // live » (run_jarvis_flow accumule tout dans la 2ème bulle).
            const assistant = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            if (assistant && assistant.content) {
              setFinalText(assistant.content);
              // Compte les consolidations dans le markdown narratif :
              // chaque triplet validé+consolidé crée une ligne avec un
              // marqueur reconnaissable (✓ consolidé / triplet écrit).
              const text = assistant.content;
              const matches = text.match(/✓\s*(consolid|écrit|appended)/gi) || [];
              if (matches.length > prevConsolidatedCount) {
                const delta = matches.length - prevConsolidatedCount;
                setMetrics(m => ({ ...m, accepted: m.accepted + delta }));
                prevConsolidatedCount = matches.length;
              }
              // Compteur d'outils approximatif via lignes « 🔧 » ou
              // narrations connues (`* nom_outil *` dans la trace).
              const toolMatches = text.match(/🔧|<div class="jdm-narration">/g) || [];
              setMetrics(m => ({ ...m, toolsCalled: toolMatches.length }));
            }
            // Si le fichier de sortie change, log + push dans accepted
            if (d.file_path && d.file_path !== lastFilePath) {
              lastFilePath = d.file_path;
              setLog(l => [...l, {
                t: ts(), tag: '[file]', kind: 'accept',
                msg: `Fichier écrit : ${d.file_path}`,
              }]);
              setAccepted(prev => [...prev, {
                label: d.file_path.split(/[\\/]/).slice(-1)[0],
                score: '📄',
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
                             l.kind === 'thought' ? 'var(--ink-3)' :
                             l.kind === 'iter' ? flow.accent :
                             'var(--ink-3)',
                      minWidth: 64,
                    }}>{l.tag}</span>
                    <span style={{
                      color: l.kind === 'thought' ? 'var(--ink-3)' : 'var(--ink)',
                      fontStyle: l.kind === 'thought' ? 'italic' : 'normal',
                      wordBreak: 'break-word',
                    }}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Accepted / final answer */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {finalText ? 'Réponse finale' : `Triplets consolidés · ${accepted.length}`}
                </div>
              </div>
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 12,
                background: 'var(--bg-card)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
              }}>
                {finalText ? finalText : (
                  accepted.length === 0 ? (
                    <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>
                      Aucun fichier encore.
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
                  )
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

// === webapp/views-aide.jsx ===
// View: Aide — installation, usage, MCP, soumission.
// Conserve le layout designer (SectionTitle / Card / kbd / image-slot)
// mais le remplit avec notre contenu canonique AIDE_MD réparti dans
// des sections visuellement structurées.

// Navigation : table des onglets — version "card" du tableau markdown.
const TABS_TABLE = [
  { icon: '📋', name: 'Projet',        what: 'Présentation, liens code source.',                                 key: 'Aucune' },
  { icon: '🔎', name: 'Explorer JDM',  what: 'Table de triplets pour un terme/relation. Déterministe.',          key: 'Aucune' },
  { icon: '⚖️', name: 'Claim checker', what: 'SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet. Déterministe.', key: 'Aucune' },
  { icon: '🕸️', name: 'Sous-graphe',   what: 'Visualisation vis-network interactive du voisinage.',              key: 'Aucune' },
  { icon: '🤖', name: 'Agent',         what: 'Chat libre avec un agent LLM qui utilise les outils JDM.',         key: 'Gemini (gratuit) ou BYOK Claude/GPT' },
  { icon: '🦾', name: 'Jarvis',        what: 'Flux guidés par formulaires (5 sous-onglets).',                    key: 'Gemini gratuit · LLMDrops si soumission' },
  { icon: '🛠️', name: 'Aide',          what: 'Ce document.',                                                      key: '—' },
];

// Les 5 flows Jarvis avec leur description.
const JARVIS_FLOWS_HELP = [
  { id: 'enrich',      icon: '🌱', name: 'Enrichissement', wf: 'enrichment_workflow()',
    desc: 'Propose et consolide de nouveaux triplets pour un terme. Form : terme, relation cible (optionnelle), nombre cible, varier les relations, itérer jusqu\'au but, soumettre. Output : chatbot + fichier .enrich.' },
  { id: 'audit',       icon: '🔍', name: 'Audit',          wf: 'audit_workflow()',
    desc: 'Audit sémantique de la répartition des sens d\'un terme polysémique. Verdict par triplet (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative. Fichier .audit.' },
  { id: 'gap',         icon: '🕳️', name: 'Détection de trous', wf: 'gap_detection_workflow()',
    desc: 'Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE). Tableau déterministe + synthèse narrative. Routage vers Enrich / Audit / Stats.' },
  { id: 'signalement', icon: '⚠️', name: 'Signalement',    wf: 'signalement_workflow()',
    desc: 'Le LLM utilise son jugement linguistique pour flagger les triplets suspects (pas besoin de preuve d\'outil). Fichier .err avec catégorie de suspicion et justification.' },
  { id: 'stats',       icon: '📊', name: 'Stats',          wf: 'stats_workflow()',
    desc: 'Statistiques de couverture par terme et/ou par relation : n_total, n_pos, n_neg, max_w, min_w, mean_w par relation + 3-5 observations clés en prose.' },
];

const API_KEYS_TABLE = [
  { name: 'Gemini',          where: 'aistudio.google.com/apikey',     cost: 'Gratuit (500 req/jour pour 3.1 Flash Lite)', when: 'Pré-configurée côté serveur',
    url: 'https://aistudio.google.com/apikey' },
  { name: 'LLMDrops JDM',    where: 'jeuxdemots.org (contacter M. Lafourcade)', cost: 'Gratuit sur demande', when: 'Pousser .enrich / .audit / .err vers JDM',
    url: 'https://www.jeuxdemots.org' },
  { name: 'Anthropic (Claude)', where: 'console.anthropic.com',       cost: 'Payant ($)',                              when: 'BYOK Claude dans Agent / Jarvis',
    url: 'https://console.anthropic.com' },
  { name: 'OpenAI (GPT)',    where: 'platform.openai.com',            cost: 'Payant ($)',                              when: 'BYOK GPT dans Agent / Jarvis',
    url: 'https://platform.openai.com/api-keys' },
];

const SHORTCUTS = [
  { keys: ['G', 'E'], desc: 'Aller à Explorer' },
  { keys: ['G', 'C'], desc: 'Aller à Claim checker' },
  { keys: ['G', 'A'], desc: 'Aller à Agent' },
  { keys: ['G', 'J'], desc: 'Aller à Jarvis' },
  { keys: ['?'],      desc: 'Cette page d\'aide' },
];

const INSTALL_SCRIPT = `# 1. Cloner le repo
git clone https://github.com/expAg/JDMAgent.git
cd JDMAgent

# 2. Créer un environnement Python isolé (venv)
python3 -m venv .venv

# 3. Activer le venv (Linux / macOS)
source .venv/bin/activate

# 4. Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt

# 5. Configurer les clés API
cp .env.example .env
# édite .env : GOOGLE_API_KEYS (CSV) / ANTHROPIC_API_KEY /
# OPENAI_API_KEY / JDM_DROPS_API_KEY / APP_SUBPATH (reverse-proxy)

# 6. Lancer l'app (écoute sur http://0.0.0.0:7860)
uvicorn app_fastapi:app --host 0.0.0.0 --port 7860`;

const MCP_SCRIPT = `# Installation locale (stdio)
claude mcp add jdm "python -m jdm_agent.mcp.server"

# Vérification
claude mcp list`;

const FORMAT_TEXT = `# .enrich (proposition de triplets)
term | relation | target | annotation < explication chaîne d'inférence >

# .audit (deux sections séparées par === META ===)
=== PROPOSITIONS ===
term | relation | target | annotation | verdict | justification
...
=== META ===
<compte rendu narratif sur la confusion / propagation des sens>

# .err (suspects flaggés par le LLM)
term | relation | target | catégorie_suspect | justification`;

function ViewAide() {
  return (
    <PageShell>
      <SectionTitle
        kicker="Documentation"
        title="Aide & Installation"
        desc="Naviguer la démo, installer en local, brancher le MCP, comprendre les formats de soumission JDM."
      />

      {/* 1. Naviguer dans la démo — cards par onglet */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>1 · Naviguer dans la démo</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        marginBottom: 40,
      }}>
        {TABS_TABLE.map((t) => (
          <div key={t.name} style={{ background: 'var(--bg-card)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{t.name}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>
              {t.what}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Clé : <span style={{ color: 'var(--accent)' }}>{t.key}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Jarvis en détail */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 8px',
      }}>2 · Jarvis en détail — 5 flows guidés</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.55 }}>
        Tous les sous-onglets Jarvis partagent un <strong>bandeau</strong> en haut :
        clé LLMDrops (override env), modèle LLM (Gemini par défaut, BYOK possible),
        budget d&apos;appels d&apos;outils (10 / 25 / 50 / 100 / illimité — au-delà, le LLM reçoit un sentinel et consolide ce qu&apos;il a).
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12, marginBottom: 40,
      }}>
        {JARVIS_FLOWS_HELP.map(f => (
          <Card key={f.id} padding={18}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <strong style={{ fontSize: 16, color: 'var(--ink)' }}>{f.name}</strong>
              <code className="mono" style={{
                marginLeft: 'auto', background: 'var(--bg-elev)',
                padding: '2px 6px', borderRadius: 3,
                fontSize: 10, color: 'var(--accent)',
              }}>{f.wf}</code>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{f.desc}</p>
          </Card>
        ))}
      </div>

      {/* 3. Installation locale */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>3 · Installation locale</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.55 }}>
        Déployer la même app sur ta machine ou un serveur. Sur <strong>Debian 12 / Ubuntu 24.04</strong> (PEP 668),
        le venv est <strong>obligatoire</strong> (pip refuse hors venv).
      </p>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}>{INSTALL_SCRIPT}</pre>
      </Card>
      <div style={{
        fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 40,
        padding: 12, background: 'var(--bg-elev)',
        borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius)',
      }}>
        <strong style={{ color: 'var(--ink)' }}>Sous reverse-proxy</strong> (Apache/Nginx sur sous-chemin <code className="mono">/Jarvis/</code> par ex.) :
        mets <code className="mono">APP_SUBPATH=/Jarvis</code> dans <code className="mono">.env</code>. Le frontend injecte <code className="mono">&lt;base href&gt;</code> automatiquement et les fetch API se résolvent.
      </div>

      {/* 4. MCP */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>4 · Serveur MCP — outils JDM dans Claude Code / Cursor</h2>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto',
        }}>{MCP_SCRIPT}</pre>
      </Card>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 40, lineHeight: 1.55 }}>
        Ensuite depuis Claude Code : <em>« Donne-moi les synonymes de voiture dans JDM »</em> → l&apos;agent appelle automatiquement les outils MCP exposés.
      </p>

      {/* 5. Clés API + Raccourcis (2 colonnes) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40,
      }}>
        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
            margin: '0 0 14px',
          }}>5 · Clés API</h2>
          <Card padding={0}>
            {API_KEYS_TABLE.map((k, i) => (
              <a key={k.name} href={k.url}
                style={{
                  display: 'block', padding: 14,
                  borderBottom: i < API_KEYS_TABLE.length - 1 ? '1px solid var(--line-soft)' : 'none',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elev)'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{k.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--accent)' }}>↗</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{k.where}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{k.cost} · <em>{k.when}</em></div>
              </a>
            ))}
          </Card>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.55 }}>
            ⚠️ Sécurité : les clés que tu colles dans l&apos;UI ne sont <strong>jamais persistées</strong> côté serveur — elles vivent uniquement le temps de ton onglet navigateur.
          </div>
        </div>

        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
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
                  {s.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginLeft: 12 }}>{s.desc}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* 6. Formats de fichiers de soumission */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>6 · Format des fichiers de soumission</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.55 }}>
        Tous les fichiers produits par Jarvis suivent un <strong>format pipe</strong>.
      </p>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto', whiteSpace: 'pre',
        }}>{FORMAT_TEXT}</pre>
      </Card>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 40, lineHeight: 1.55 }}>
        Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
        <ul style={{ marginTop: 6, paddingLeft: 20 }}>
          <li>coche <strong>Soumettre directement</strong> dans le formulaire (clé <code className="mono">JDM_DROPS_API_KEY</code> requise) ;</li>
          <li>ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.</li>
        </ul>
      </div>

      {/* 7. Footer institutionnel — slots logos préservés */}
      <div style={{
        padding: 32, background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 48, marginBottom: 28, flexWrap: 'wrap',
        }}>
          <image-slot id="logo-lirmm" shape="rect" placeholder="Dépose le logo LIRMM ici"
            style={{ width: 200, height: 80, background: 'transparent' }} />
          <div style={{ width: 1, height: 60, background: 'var(--line)' }} />
          <image-slot id="logo-um" shape="rect" placeholder="Dépose le logo Université de Montpellier ici"
            style={{ width: 200, height: 80, background: 'transparent' }} />
          <div style={{ width: 1, height: 60, background: 'var(--line)' }} />
          <image-slot id="logo-cnrs" shape="rect" placeholder="Dépose le logo CNRS ici"
            style={{ width: 120, height: 80, background: 'transparent' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, paddingTop: 24, borderTop: '1px solid var(--line-soft)',
        }}>
          <JDMMark size={28} />
          <div>
            <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              jdmAgent
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              <a href="https://github.com/expAg/JDMAgent" style={{ color: 'var(--ink-3)' }}>github.com/expAg/JDMAgent</a>
              {' · '}
              <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" style={{ color: 'var(--ink-3)' }}>USAGE.md</a>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

window.ViewAide = ViewAide;

// === webapp/app.jsx ===
// Main app: theme switcher + router + Tweaks panel wiring.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "accent": "#c0411a"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('projet');

  // Apply theme to body
  useEffect(() => {
    document.body.dataset.theme = tweaks.theme || 'paper';
  }, [tweaks.theme]);

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

  const VIEWS = {
    projet:   <ViewProjet goto={setView} />,
    explorer: <ViewExplorer />,
    claim:    <ViewClaim />,
    subgraph: <ViewSubgraph />,
    agent:    <ViewAgent />,
    jarvis:   <ViewJarvis />,
    aide:     <ViewAide />,
  };

  // Accent swatches — first one is the theme default (terracotta).
  const accentOptions = ['#c0411a', '#1f97b1', '#c83a73', '#4ea63c', '#7a4fbe', '#d96810'];

  return (
    <div>
      <TopNav
        active={view} setActive={setView}
        theme={tweaks.theme}
        setTheme={(t) => setTweak('theme', t)}
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
              ['agent', 'Agent'],
              ['jarvis', 'Jarvis'],
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

