
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


// === webapp/views-explorer.jsx ===
// View: Explorer — fetch relations for a term.

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

// Fake dataset for the demo — different by (term, relation).
const FAKE_DATA = {
  'chat | r_has_part': [
    { t: 'patte', w: 142, a: 'constitutif (w=12)' },
    { t: 'queue', w: 138 },
    { t: 'oreille', w: 121, a: 'constitutif (w=10)' },
    { t: 'griffe', w: 110 },
    { t: 'moustache', w: 104 },
    { t: 'œil', w: 98 },
    { t: 'fourrure', w: 85 },
    { t: 'pelage', w: 72 },
    { t: 'crocs', w: 51 },
  ],
  'chat | r_isa': [
    { t: 'félin', w: 215, a: 'constitutif (w=18)' },
    { t: 'mammifère', w: 198 },
    { t: 'animal de compagnie', w: 142 },
    { t: 'carnivore', w: 121 },
    { t: 'animal domestique', w: 118 },
    { t: 'animal', w: 102 },
    { t: 'vertébré', w: 56 },
  ],
  'chat | r_syn': [
    { t: 'matou', w: 89 },
    { t: 'minet', w: 72 },
    { t: 'félin', w: 58 },
    { t: 'greffier', w: 14, a: 'familier (w=8)' },
    { t: 'mistigri', w: 11, a: 'familier (w=6)' },
  ],
  'avocat | r_isa': [
    { t: 'fruit', w: 121, a: 'sens : fruit' },
    { t: 'juriste', w: 118, a: 'sens : profession' },
    { t: 'légume', w: 32 },
    { t: 'défenseur', w: 28 },
  ],
};

function ViewExplorer() {
  const [term, setTerm] = useState('chat');
  const [rel, setRel] = useState('r_has_part');
  const [minWeight, setMinWeight] = useState(25);
  const [limit, setLimit] = useState(50);
  const [annotations, setAnnotations] = useState(true);
  const [loaded, setLoaded] = useState(true);
  const [loading, setLoading] = useState(false);

  const key = `${term} | ${rel}`;
  const data = FAKE_DATA[key] || FAKE_DATA['chat | r_has_part'];
  const rows = data
    .filter(r => r.w >= minWeight)
    .slice(0, limit);

  const onRun = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setLoaded(true); }, 380);
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · sans LLM"
        title="Explorer"
        desc="Récupère les relations d'un terme dans JeuxDeMots. Instantané, déterministe, mis en cache."
      />

      {/* Controls + sense-disambiguation hint */}
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
        <Button onClick={onRun} size="lg">
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

      {/* Results */}
      {loaded && (
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
              <Button size="sm" variant="secondary">Exporter CSV</Button>
              <Button size="sm" variant="ghost">Voir le graphe →</Button>
            </div>
          </div>

          {/* Distribution sparkline */}
          <Card padding={16} style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Distribution des poids
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                max {Math.max(...rows.map(r => r.w))} · min {Math.min(...rows.map(r => r.w))}
              </div>
            </div>
            <Bars rows={rows} />
          </Card>

          {/* Triplets list */}
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r, i) => (
              <Triplet key={i}
                subject={term}
                relation={rel}
                object={r.t}
                weight={r.w}
                annotations={annotations ? r.a : undefined}
              />
            ))}
          </div>

          {rows.length === 0 && (
            <EmptyState
              title="Aucun triplet"
              desc={`Aucun « ${term} | ${rel} | ? » avec w ≥ ${minWeight}. Essaie un seuil plus bas.`}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function Bars({ rows }) {
  const max = Math.max(...rows.map(r => r.w), 1);
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      alignItems: 'flex-end',
      height: 64,
    }}>
      {rows.map((r, i) => (
        <div key={i} title={`${r.t} · w=${r.w}`}
          style={{
            flex: 1,
            height: `${(r.w / max) * 100}%`,
            minHeight: 2,
            background: 'var(--accent)',
            opacity: 0.3 + 0.7 * (r.w / max),
            borderRadius: '2px 2px 0 0',
          }} />
      ))}
    </div>
  );
}

window.ViewExplorer = ViewExplorer;


// === webapp/views-claim.jsx ===
// View: Claim checker — verify subject | relation | object.

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

const SCENARIOS = {
  'tomate|r_isa|fruit': {
    status: 'supported',
    confidence: 0.94,
    explanation: 'Triplet trouvé directement dans JDM avec poids 256.',
    origin: 'contenance',
    proof: [
      { s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 },
    ],
  },
  'tomate|r_isa|légume': {
    status: 'contradicted',
    confidence: 0.82,
    explanation: 'JDM contient tomate r_isa fruit (w=256). Aucune trace de tomate r_isa légume.',
    origin: 'contenance',
    counter: [
      { s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 },
    ],
  },
  'chat|r_isa|animal': {
    status: 'supported',
    confidence: 0.97,
    explanation: 'Verdict obtenu par inférence (isa-transitivité).',
    origin: 'inférence',
    proof: [
      { s: 'chat', r: 'r_isa', t: 'mammifère', w: 198 },
      { s: 'mammifère', r: 'r_isa', t: 'vertébré', w: 220 },
      { s: 'vertébré', r: 'r_isa', t: 'animal', w: 305 },
    ],
  },
  'chat|r_agent|aboyer': {
    status: 'contradicted',
    confidence: 0.78,
    explanation: 'Le verbe aboyer a chien comme agent typique. Aucun lien chat-aboyer trouvé.',
    origin: 'contenance',
    counter: [
      { s: 'aboyer', r: 'r_agent', t: 'chien', w: 312 },
    ],
  },
};

function ViewClaim() {
  const [subject, setSubject] = useState('chat');
  const [relation, setRelation] = useState('r_isa');
  const [object_, setObject] = useState('animal');
  const [effort, setEffort] = useState(1);
  const [bypass, setBypass] = useState(false);
  const [result, setResult] = useState(SCENARIOS['chat|r_isa|animal']);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setTimeout(() => {
      const key = `${subject}|${relation}|${object_}`;
      setResult(SCENARIOS[key] || {
        status: 'unknown',
        confidence: 0.0,
        explanation: 'Aucun triplet direct, aucune chaîne d\'inférence trouvée.',
        origin: '—',
      });
      setLoading(false);
    }, 460);
  };

  const examples = [
    ['chat', 'r_isa', 'animal', '✅'],
    ['tomate', 'r_isa', 'fruit', '✅'],
    ['tomate', 'r_isa', 'légume', '❌'],
    ['chat', 'r_agent', 'aboyer', '❌'],
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
            <Select value={effort} options={EFFORT_OPTS} onChange={setEffort} />
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
          <Button onClick={run} size="lg">
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
        {examples.map(([s, r, o, icon], i) => (
          <button key={i}
            className="focus-ring"
            onClick={() => {
              setSubject(s); setRelation(r); setObject(o);
              setTimeout(() => {
                const k = `${s}|${r}|${o}`;
                setResult(SCENARIOS[k] || result);
              }, 100);
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
            {icon} {s} | {r} | {o}
          </button>
        ))}
      </div>

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
  }[result.status];

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
          }}>{result.confidence.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            {result.origin === 'inférence' ? '🧠 via inférence' :
             result.origin === 'contenance' ? '📦 via contenance' : ''}
          </div>
        </div>
      </div>

      {/* Proof chain */}
      {result.proof && (
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

      {result.counter && (
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
// View: Sous-graphe — extract & visualise a term's neighbourhood.

const SUBGRAPH_RELATIONS = [
  'r_syn', 'r_isa', 'r_hypo', 'r_has_part', 'r_carac',
  'r_has_color', 'r_lieu', 'r_agent', 'r_patient', 'r_instr',
];

function ViewSubgraph() {
  const [term, setTerm] = useState('chat');
  const [depth, setDepth] = useState(2);
  const [activeRels, setActiveRels] = useState(['r_isa', 'r_has_part', 'r_carac', 'r_syn']);
  const [minWeight, setMinWeight] = useState(30);
  const [maxNodes, setMaxNodes] = useState(40);

  const toggleRel = (r) => {
    setActiveRels((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · visualisation"
        title="Sous-graphe"
        desc="Extrait et visualise le voisinage d'un terme à profondeur N, filtré par type de relation."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: controls */}
        <div style={{
          position: 'sticky',
          top: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <Card padding={16}>
            <Field label="Terme">
              <Input value={term} onChange={setTerm} mono />
            </Field>
            <Field label={`Profondeur · ${depth}`}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
              }}>
                {[2, 3, 4].map(d => (
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
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Poids minimum">
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
            </Field>
            <Field label="Nœuds max">
              <Slider value={maxNodes} onChange={setMaxNodes} min={10} max={200} step={5} />
            </Field>
            <div style={{ marginTop: 16 }}>
              <Button full>Construire le graphe</Button>
            </div>
          </Card>

          {/* Relation filter */}
          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 10,
            }}>Relations actives · {activeRels.length}/{SUBGRAPH_RELATIONS.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {SUBGRAPH_RELATIONS.map(r => {
                const active = activeRels.includes(r);
                const colorIdx = SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length;
                const c = JDM_COLORS[colorIdx];
                return (
                  <button key={r}
                    onClick={() => toggleRel(r)}
                    style={{
                      padding: '4px 9px',
                      background: active ? c : 'transparent',
                      border: `1px solid ${active ? c : 'var(--line)'}`,
                      borderRadius: 999,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}>{r}</button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: viz */}
        <div>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span> · profondeur {depth} · 38 nœuds · 62 arêtes
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost">SVG</Button>
                <Button size="sm" variant="ghost">PNG</Button>
                <Button size="sm" variant="ghost">DOT</Button>
              </div>
            </div>
            <div style={{ height: 540, background: 'var(--bg-elev)', position: 'relative' }} className="lab-grid">
              <GraphViz term={term} relations={activeRels} />
            </div>
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
            }}>
              {activeRels.map((r, i) => (
                <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 10, height: 2,
                    background: JDM_COLORS[SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length],
                    display: 'inline-block',
                  }} />
                  {r}
                </span>
              ))}
            </div>
          </Card>

          {/* Stats below */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginTop: 16,
          }}>
            {[
              ['Nœuds', '38'],
              ['Arêtes', '62'],
              ['Densité', '0.087'],
              ['Diamètre', '3'],
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

function GraphViz({ term, relations }) {
  // Deterministic fake graph layout — places nodes in concentric rings.
  const ring1 = ['félin', 'mammifère', 'animal de compagnie', 'patte', 'queue', 'oreille', 'griffe', 'matou', 'minet', 'poil'];
  const ring2 = ['vertébré', 'animal', 'chien', 'chaton', 'animal domestique', 'pelage', 'moustache'];

  const W = 800, H = 540, cx = W / 2, cy = H / 2;
  const nodes = [{ id: term, x: cx, y: cy, r: 22, ring: 0 }];
  ring1.forEach((t, i) => {
    const a = (i / ring1.length) * Math.PI * 2 - Math.PI / 2;
    nodes.push({ id: t, x: cx + Math.cos(a) * 140, y: cy + Math.sin(a) * 140, r: 14, ring: 1 });
  });
  ring2.forEach((t, i) => {
    const a = (i / ring2.length) * Math.PI * 2 - Math.PI / 2 + 0.15;
    nodes.push({ id: t, x: cx + Math.cos(a) * 230, y: cy + Math.sin(a) * 230, r: 10, ring: 2 });
  });

  // Edges: every ring1 node connects to centre, some to ring2
  const edges = [];
  ring1.forEach((t, i) => {
    const relIdx = i % relations.length;
    const r = relations[relIdx] || 'r_isa';
    const colorIdx = SUBGRAPH_RELATIONS.indexOf(r) % JDM_COLORS.length;
    edges.push({ from: term, to: t, c: JDM_COLORS[colorIdx] });
    if (i % 3 === 0 && ring2[i / 3]) {
      edges.push({ from: t, to: ring2[Math.floor(i / 3)], c: JDM_COLORS[(colorIdx + 1) % JDM_COLORS.length] });
    }
  });

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        return (
          <line key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={e.c}
            strokeOpacity="0.55"
            strokeWidth="1.4"
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r}
            fill={n.ring === 0 ? 'var(--accent)' : 'var(--bg-card)'}
            stroke={n.ring === 0 ? 'var(--accent)' : 'var(--ink-2)'}
            strokeWidth={n.ring === 0 ? 0 : 1.2}
          />
          <text x={n.x} y={n.y + n.r + 14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={n.ring === 0 ? 13 : 11}
            fontWeight={n.ring === 0 ? 700 : 400}
            fill="var(--ink)">
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

window.ViewSubgraph = ViewSubgraph;


// === webapp/views-agent.jsx ===
// View: Agent — conversational chat with the LLM + JDM tools.

const AGENT_MODELS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', sub: 'pool gratuit · 500 req/jour' },
  { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash',      sub: 'pool gratuit · 20 req/jour' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', sub: 'pool gratuit · 20 req/jour' },
  { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5',      sub: 'BYOK Anthropic' },
  { value: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5',     sub: 'BYOK Anthropic' },
  { value: 'gpt-4o-mini',           label: 'GPT-4o mini',           sub: 'BYOK OpenAI' },
  { value: 'gpt-4o',                label: 'GPT-4o',                sub: 'BYOK OpenAI' },
];

const SEED_CONVO = [
  {
    role: 'user',
    content: 'Que mange typiquement un chat ?',
  },
  {
    role: 'assistant',
    thinking: 'L\'utilisateur cherche les patients typiques du verbe « manger » avec « chat » comme agent. Je vais interroger r_patient sur manger, puis croiser avec r_agent(chat).',
    tools: [
      { name: 'relations_from', args: { term: 'manger', rel: 'r_patient', limit: 30 }, dur: 142, count: 30 },
      { name: 'relations_to',   args: { term: 'manger', rel: 'r_agent',   limit: 30 }, dur: 98,  count: 28 },
    ],
    content: 'Selon JeuxDeMots, un chat mange typiquement des **croquettes** (w=312), de la **viande** (w=287), du **poisson** (w=234), des **souris** (w=198), du **lait** (w=156). Le lait est culturellement associé mais souvent mal toléré par les chats adultes. Veux-tu que j\'élargisse aux verbes apparentés (chasser, attraper) ?',
  },
];

function ViewAgent() {
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [thinking, setThinking] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [convo, setConvo] = useState(SEED_CONVO);
  const [input, setInput] = useState('');

  const needsBYOK = model.startsWith('claude-') || model.startsWith('gpt-');

  const send = () => {
    if (!input.trim()) return;
    setConvo([...convo, { role: 'user', content: input }]);
    setInput('');
    // Faked assistant reply.
    setTimeout(() => {
      setConvo(c => [...c, {
        role: 'assistant',
        thinking: 'Je décompose la requête en interrogations JDM atomiques.',
        tools: [
          { name: 'term_exists', args: { term: input.split(' ')[0] || 'chat' }, dur: 32, count: 1 },
          { name: 'relations_from', args: { term: input.split(' ')[0] || 'chat', rel: 'r_carac' }, dur: 124, count: 12 },
        ],
        content: 'Réponse simulée — connecte ta clé pour interroger le vrai modèle.',
      }]);
    }, 600);
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · agent LLM"
        title="Agent"
        desc="Chat conversationnel. Le modèle a accès à 34 outils JDM via LangChain."
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
              {convo.map((m, i) => <Message key={i} m={m} />)}
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
                <Button onClick={send} size="lg">Envoyer</Button>
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
            }}>Outils disponibles · 34</div>
            <div style={{
              fontSize: 12, color: 'var(--ink-2)',
              display: 'grid', gap: 4,
            }}>
              {['relations_from', 'relations_to', 'term_exists', 'refinements_decoded',
                'verify_claim', 'build_subgraph', 'common_ancestors', 'analogies',
                'shortest_path', 'gloss_term'].map(t => (
                <div key={t} className="mono" style={{
                  fontSize: 11,
                  padding: '3px 6px',
                  background: 'var(--bg-elev)',
                  borderRadius: 3,
                  color: 'var(--ink)',
                }}>{t}</div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                + 24 autres…
              </div>
            </div>
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 10,
            }}>Pool Gemini</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Clé courante : <span className="mono" style={{ color: 'var(--ink)' }}>3/4</span><br/>
              Reset quotidien : <span className="mono">00:00 PT</span>
            </div>
            <Button variant="secondary" size="sm" full>
              ↻ Rotation manuelle
            </Button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

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
        {m.thinking && (
          <details style={{ marginBottom: 10 }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>🧠 Raisonnement</summary>
            <div style={{
              marginTop: 8,
              padding: 10,
              background: 'var(--bg-elev)',
              borderLeft: '2px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}>{m.thinking}</div>
          </details>
        )}
        {m.tools && m.tools.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px',
            background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius)',
            marginBottom: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            <span style={{ color: 'var(--jdm-green)' }}>●</span>
            <span style={{ color: 'var(--accent)' }}>{t.name}</span>
            <span style={{ color: 'var(--ink-3)' }}>(</span>
            <span style={{ color: 'var(--ink)' }}>{Object.entries(t.args).map(([k, v]) => `${k}="${v}"`).join(', ')}</span>
            <span style={{ color: 'var(--ink-3)' }}>)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
              {t.count} résultats · {t.dur}ms
            </span>
          </div>
        ))}
        <div style={{
          fontSize: 14,
          color: 'var(--ink)',
          lineHeight: 1.6,
        }} dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
      </div>
    </div>
  );
}

function renderMarkdownLite(s) {
  // tiny markdown subset: **bold**, *italic*, `code`, line breaks
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>')
    .replace(/\n/g, '<br/>');
}

window.ViewAgent = ViewAgent;


// === webapp/views-jarvis.jsx ===
// View: Jarvis — autonomous looping pipelines.
//
// Each flow runs as a background loop: the agent iterates, calls tools,
// validates candidates, accumulates results. The user configures params
// once, hits "Lancer", and watches the pipeline run. No manual stepping.

const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Boucle de génération-validation : propose des triplets candidats, les valide via un panel de vérifications JDM, garde ceux qui passent.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'génération → validation → mémoire',
  },
  {
    id: 'audit',
    title: 'Audit de cohérence',
    kicker: 'Flux 2',
    desc: 'Parcourt le voisinage d\'un terme, détecte contradictions et triplets suspects par cross-checking entre relations.',
    accent: 'var(--jdm-cyan)',
    loopOf: 'parcours → cross-check → flag',
  },
  {
    id: 'expand',
    title: 'Expansion sémantique',
    kicker: 'Flux 3',
    desc: 'Étend une requête initiale par strates : synonymes, hyponymes, termes culturellement liés, jusqu\'à saturation.',
    accent: 'var(--jdm-green)',
    loopOf: 'strate N → strate N+1',
  },
  {
    id: 'factcheck',
    title: 'Fact-checking textuel',
    kicker: 'Flux 4',
    desc: 'Lit un paragraphe, en extrait les affirmations atomiques, vérifie chacune dans JDM, rend une synthèse.',
    accent: 'var(--jdm-orange)',
    loopOf: 'extraction → vérification → synthèse',
  },
  {
    id: 'synth',
    title: 'Synthèse de concept',
    kicker: 'Flux 5',
    desc: 'Collecte les relations isa/parties/but/agents d\'un concept, assemble une définition lexicale riche.',
    accent: 'var(--jdm-violet)',
    loopOf: 'collecte → assemblage',
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
        kicker="Pipelines autonomes"
        title="Jarvis"
        desc="Cinq boucles d'agent qui itèrent sans intervention. Tu paramètres, tu lances, tu regardes. Pause / stop à tout moment."
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
              boucle : {f.loopOf}
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


// === webapp/views-aide.jsx ===
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

