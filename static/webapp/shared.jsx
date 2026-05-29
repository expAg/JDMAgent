// === webapp/shared.jsx ===
// Shared components — custom Select (fix dropdown hit-area bug),
// Field wrapper, Button, Card, Pill, Sparkline, JDMLogo mark.
//
// All exposed on window for cross-script consumption.

const { useState, useRef, useEffect, useMemo, useCallback, useReducer } = React;

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

  // Wordmark unifié pour les deux thèmes (Paper et Lab) :
  // « jdm » en Lilita One coloré + « Agent » serif italic.
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


// ───────── MultiSelect — sélection multiple à cases à cocher ─────────
// Même look que `Select`. `value` = tableau de valeurs sélectionnées.
// `onChange(newArray)` appelé à chaque toggle. `placeholder` affiché
// quand vide. Affiche en pastilles compactes quand 1-3 items, sinon
// « N sélectionnés ». Cliquer en dehors ferme le menu (idem Select).
function MultiSelect({ value, options, onChange, placeholder = 'Aucune sélection', width }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = Array.isArray(value) ? value : (value ? [value] : []);

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

  const toggle = (v) => {
    const next = selected.includes(v)
      ? selected.filter(x => x !== v)
      : [...selected, v];
    onChange(next);
  };

  // Label : pastilles si peu de sélection, compteur sinon
  const labelNode = () => {
    if (selected.length === 0) {
      return <span style={{ color: 'var(--ink-3)' }}>{placeholder}</span>;
    }
    if (selected.length <= 3) {
      return (
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap',
                        alignItems: 'center', overflow: 'hidden' }}>
          {selected.map(v => {
            const o = options.find(o => (o.value ?? o) === v);
            const l = o ? (o.label ?? o) : v;
            return (
              <span key={v} style={{
                fontSize: 11, padding: '1px 6px',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line-soft)',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink)',
              }}>{l}</span>
            );
          })}
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--ink)' }}>
        {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
      </span>
    );
  };

  return (
    <div className="om-select" ref={rootRef} style={{ width }}>
      <button
        type="button"
        className="om-select__trigger focus-ring"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          textAlign: 'left',
        }}>{labelNode()}</span>
        <svg className="om-select__chevron" width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open && (
        <div className="om-select__menu fade-up" role="listbox">
          {/* Petite barre d'action pour tout sélectionner/désélectionner */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 10px', borderBottom: '1px solid var(--line-soft)',
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--ink-3)', letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <span>{selected.length}/{options.length}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onChange(options.map(o => o.value ?? o)); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: 10,
                  fontFamily: 'var(--font-mono)', padding: 0,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>tout</button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', fontSize: 10,
                  fontFamily: 'var(--font-mono)', padding: 0,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>aucun</button>
            </span>
          </div>
          {options.map((o, i) => {
            const v = o.value ?? o;
            const l = o.label ?? o;
            const sub = o.sub;
            const isSel = selected.includes(v);
            return (
              <div key={i}
                className="om-select__option"
                role="option"
                aria-selected={isSel}
                onClick={() => toggle(v)}>
                {/* Case à cocher visuelle */}
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1.5px solid ${isSel ? 'var(--accent)' : 'var(--line)'}`,
                  background: isSel ? 'var(--accent)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginRight: 8,
                }}>
                  {isSel && (
                    <svg width="9" height="9" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-6" fill="none" stroke="var(--bg)"
                            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
                  {sub && (
                    <div style={{
                      fontSize: 11, color: 'var(--ink-3)',
                      marginTop: 2, fontFamily: 'var(--font-mono)',
                    }}>{sub}</div>
                  )}
                </div>
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
        boxSizing: 'border-box',
        padding: '10px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        color: 'var(--ink)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 13,
        lineHeight: 1.35,
        outline: 'none',
        transition: 'border-color 0.12s',
        // Reset des styles inputs proper aux navigateurs — assure une
        // hauteur calculée identique au Select trigger (button flex).
        appearance: 'none',
        WebkitAppearance: 'none',
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
        minWidth: 28, textAlign: 'right',
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
  // Triplet à poids négatif = JDM AFFIRME que c'est faux. On teinte
  // légèrement de magenta pour le signaler visuellement (cohérent
  // avec le header « ✗ Évidences contraires » qui est aussi en magenta).
  const isNegative = weight != null && Number(weight) < 0;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      background: isNegative ? 'rgba(200, 58, 115, 0.08)' : 'var(--bg-elev)',
      border: `1px solid ${isNegative ? 'rgba(200, 58, 115, 0.35)' : 'var(--line-soft)'}`,
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{subject}</span>
      <span style={{ color: 'var(--ink-3)' }}>│</span>
      <span style={{ color: isNegative ? 'var(--jdm-magenta)' : 'var(--accent)' }}>{relation}</span>
      <span style={{ color: 'var(--ink-3)' }}>│</span>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{object}</span>
      {weight != null && (
        <span style={{
          marginLeft: 'auto',
          color: isNegative ? 'var(--jdm-magenta)' : 'var(--ink-3)',
          fontSize: 11,
          fontWeight: isNegative ? 600 : 400,
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
function TopNav({ active, setActive, theme, setTheme, accent, cycleAccent }) {
  const items = [
    { id: 'projet',      label: 'Projet' },
    { id: 'explorer',    label: 'Explorer' },
    { id: 'claim',       label: 'Claim checker' },
    { id: 'subgraph',    label: 'Sous-graphe' },
    { id: 'agent',       label: 'Chatbot LLM' },
    { id: 'jarvis',      label: 'Jarvis' },
    { id: 'productions', label: 'Productions' },
    { id: 'aide',        label: 'Aide' },
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
          <button
            type="button"
            onClick={cycleAccent}
            className="focus-ring"
            title="Cycler la couleur d'accent"
            aria-label="Cycler la couleur d'accent"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: cycleAccent ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 999,
              transition: 'transform 0.18s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(-12deg) scale(1.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
          >
            <JDMMark size={26} />
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('jdm:goto', { detail: { view: 'projet' } }));
              // Defer the panel-set so it runs after the view actually
              // mounted (ViewProjet attaches its listener on mount).
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('jdm:projet-panel', { detail: { index: 1 } }));
              }, 30);
            }}
            className="focus-ring"
            title="Accueil — panneau Présentation"
            aria-label="Accueil"
            style={{
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            <JDMWordmark />
          </button>
        </div>
        <nav style={{ display: 'flex', gap: 2, marginLeft: 12, overflow: 'hidden', scrollbarWidth: 'none' }}>
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
          {active !== 'projet' && <CliCommandButton view={active} />}
          {setTheme && <ThemeSwitcher theme={theme} setTheme={setTheme} />}
          <ProductionsCountPill />
        </div>
      </div>
    </header>
  );
}

// ───────── CLI command pill — shows the cli entrypoint for the current view
// Hidden on the Projet view (where the whole product is presented, not a tool).
// Click → popover with the command + copy button. Styled monospace,
// dark on light themes and slate on dark themes.
// CLI commands — vraies entrées `python -m jdm_agent.apps.*` du projet.
// Chaque app vit dans src/jdm_agent/apps/ et fait l'objet de tests
// unitaires + smoke réels (cf. tests/test_*).
const CLI_COMMANDS = {
  explorer:    { cmd: 'python -c "from jdm_agent.client import JDMClient; c=JDMClient(); print(c.relations_from(\'voiture\').relations[:5])"',
                 hint: 'Inspect direct via JDMClient — pas de CLI dédiée (cache disque inclus).' },
  claim:       { cmd: 'python -m jdm_agent.apps.factcheck --claim "baleine r_isa poisson" --effort 1',
                 hint: 'Vérifie un triplet : SUPPORTED / CONTRADICTED / UNKNOWN avec chaîne d\'évidence.' },
  subgraph:    { cmd: 'python -m jdm_agent.apps.viz_cli --term "voiture" --depth 2 --format html',
                 hint: 'Construit le voisinage sémantique en HTML autonome (vis-network).' },
  agent:       { cmd: 'python -m jdm_agent.apps.qa_cli --provider gemini --model gemini-3.1-flash-lite',
                 hint: 'REPL chat LLM avec outils JDM. ANTHROPIC_API_KEY / GOOGLE_API_KEY dans l\'env.' },
  jarvis:      { cmd: 'python -m jdm_agent.apps.enrich --terms voiture --consolidate --inference-effort 1',
                 hint: 'Flux Enrichissement complet — proposer, valider, consolider, écrire le .enrich.' },
  productions: { cmd: 'ls /tmp/jdm_outputs/ && cat /tmp/jdm_outputs/*.enrich | head -20',
                 hint: 'Liste les fichiers produits (.enrich/.annot/.audit/.err/.stat).' },
  aide:        { cmd: 'python -m jdm_agent.apps.enrich --help',
                 hint: 'Affiche les flags de chacune des CLI (--help fonctionne sur tous les modules).' },
};

// Remote API equivalents — vrais endpoints FastAPI du projet (depuis
// la migration). Snippets Python via `httpx` (déjà dépendance) ou
// curl en alternative. Pas de gradio_client — le backend est FastAPI
// pur. Endpoint host = celui du déploiement (LIRMM, HF Space, etc.).
const REMOTE_COMMANDS = {
  explorer:    { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/explore", json={\n    "term": "voiture",\n    "relation": "r_isa",\n    "limit": 50,\n    "min_weight": 25\n})\nprint(r.json())',
                 hint: 'POST /api/explore — triplets bruts {nodes, edges, relations}.' },
  claim:       { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/factcheck", json={\n    "subject": "baleine",\n    "relation": "r_isa",\n    "object": "poisson",\n    "effort": 1\n})\nprint(r.json())',
                 hint: 'POST /api/factcheck — verdict + chaîne d\'inférence.' },
  subgraph:    { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/subgraph", json={\n    "term": "voiture",\n    "depth": 2,\n    "top_k": 3,\n    "format": "json"\n})\nprint(r.json())',
                 hint: 'POST /api/subgraph — nodes/edges JSON ou HTML (format="html").' },
  agent:       { lang: 'python',
                 cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/agent/stream",\n        json={"message": "quels sens de voiture ?",\n              "model": "gemini-3.1-flash-lite"}) as r:\n    for line in r.iter_lines():\n        if line.startswith("data:"): print(line[5:].strip())',
                 hint: 'POST /api/agent/stream — SSE streaming (events: chunk, tool, done).' },
  jarvis:      { lang: 'python',
                 cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/jarvis/enrich/stream",\n        json={"params": {"term": "voiture", "target_count": 20,\n                          "iterate": True, "budget_label": "50"}}) as r:\n    for line in r.iter_lines():\n        if line.startswith("event:"): print(line)',
                 hint: 'POST /api/jarvis/{enrich|audit|gap|annotation|stats}/stream — SSE.' },
  productions: { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/api/productions")\nfor p in r.json().get("files", []):\n    print(p["name"], p["size"], p["mtime"])',
                 hint: 'GET /api/productions — liste tous les fichiers produits.' },
  aide:        { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/openapi.json")\nschema = r.json()\nfor path, methods in schema["paths"].items():\n    for method in methods:\n        print(f"{method.upper():6} {path}")',
                 hint: 'GET /openapi.json — schéma OpenAPI complet (ou /docs pour UI Swagger).' },
};

// ───────── Reusable terminal block — same look as the CLI popover,
// but standalone (no positioning, no open/close). Used inline in the
// Modules detail panels and inside the header's CliCommandButton.
//
// Pass `cliData` and optionally `remoteData`. If both are present the
// title bar renders a small CLI/Remote toggle (the active variant is
// lit; the inactive is dimmed). Mode persists per-instance.
function CliTerminalBlock({ cliData, remoteData, closeable, onClose, data, onRun }) {
  // Back-compat: callers that pass `data` directly are treated as cli-only.
  const effectiveCli = cliData || data || null;
  const effectiveRemote = remoteData || null;
  const hasBoth = !!(effectiveCli && effectiveRemote);
  const [mode, setMode] = useState('cli');
  const [copied, setCopied] = useState(false);
  // État du bouton ▶ play. running = en train d'exécuter ; runOut =
  // résultat textuel à afficher sous le terminal (null = pas de run).
  const [running, setRunning] = useState(false);
  const [runOut, setRunOut] = useState(null);
  const rootRef = useRef(null);

  const active = mode === 'remote' && effectiveRemote ? effectiveRemote : effectiveCli;
  if (!active) return null;
  const lang = active.lang || 'shell';

  // Smooth-scroll quand on bascule CLI ↔ Remote (le bloc grandit /
  // rétrécit en fonction du contenu, on suit pour rester aligné).
  const handleSetMode = (m) => {
    if (m === mode) return;
    setMode(m);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (typeof scrollGroupIntoView === 'function' && rootRef.current) {
          try { scrollGroupIntoView(rootRef.current, rootRef.current); } catch {}
        }
      }, 30);
    });
  };

  // Play button — exécute la commande selon le mode actif (CLI ou
  // Remote). L'appelant fournit `onRun({mode, cmd})` qui sait quoi
  // appeler côté backend. Si pas d'onRun, le bouton n'apparaît pas.
  const handleRun = async () => {
    if (!onRun || running) return;
    setRunning(true);
    setRunOut(null);
    try {
      const r = await onRun({ mode, cmd: active.cmd });
      setRunOut(typeof r === 'string' ? r : (r ? JSON.stringify(r, null, 2) : '(ok)'));
    } catch (e) {
      setRunOut(`⚠️ ${e.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    const text = active.cmd;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  // Small toggle pill in the title bar — lit (cyan-tinted) for the active
  // variant, dim white at low alpha for the other.
  const togglePillStyle = (isActive) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 18, padding: 0,
    background: isActive ? 'rgba(125,205,255,0.20)' : 'rgba(255,255,255,0.04)',
    border: '1px solid ' + (isActive ? 'rgba(125,205,255,0.50)' : 'rgba(255,255,255,0.10)'),
    borderRadius: 3,
    color: isActive ? '#bfe6ff' : 'rgba(201,204,210,0.55)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  });

  return (
    <div ref={rootRef} style={{
      background: '#1b1d22',
      border: '1px solid #2c2f36',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
    }}>
      {/* title bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 10px',
        background: 'linear-gradient(#33363d, #2a2d33)',
        borderBottom: '1px solid #14151a',
        position: 'relative',
        height: 26,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', gap: 5, position: 'absolute', left: 10, top: 8 }}>
          {closeable ? (
            <button
              onClick={onClose}
              aria-label="Fermer"
              title="Fermer"
              className="focus-ring"
              style={{
                width: 9, height: 9, padding: 0,
                borderRadius: '50%',
                background: '#ff5f57',
                border: 'none',
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)',
                cursor: 'pointer',
              }}
            />
          ) : (
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)' }} />
          )}
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)' }} />
        </div>

        {hasBoth && (
          <div style={{
            position: 'absolute', left: 60, top: 4,
            display: 'flex', gap: 4,
          }}>
            <button
              onClick={() => handleSetMode('cli')}
              aria-label="CLI"
              title="Mode CLI (local)"
              className="focus-ring"
              style={togglePillStyle(mode === 'cli')}
            >
              {/* terminal */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <path d="M4 6.5 L6.5 8 L4 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <line x1="8" y1="10" x2="11.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => handleSetMode('remote')}
              aria-label="Remote"
              title="Mode Remote (Gradio API)"
              className="focus-ring"
              style={togglePillStyle(mode === 'remote')}
            >
              {/* cloud */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4.4 12.5h7.2c1.6 0 2.9-1.3 2.9-2.9 0-1.5-1.1-2.7-2.6-2.9 -.4-1.7-1.9-3-3.7-3 -1.8 0-3.3 1.3-3.7 2.9 -1.5.2-2.5 1.4-2.5 2.9 0 1.6 1.3 3 2.9 3z"
                  stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 10,
          color: '#9aa0aa',
          letterSpacing: '0.02em',
          userSelect: 'none',
          paddingLeft: hasBoth ? 64 : 0,
        }}>
          jdm-agent — {lang === 'python' ? 'python' : 'bash'}
        </div>
        {onRun && (
          <button
            onClick={handleRun}
            disabled={running}
            className="focus-ring"
            title={mode === 'remote' ? 'Exécuter (Remote)' : 'Exécuter (CLI)'}
            aria-label="Exécuter la commande"
            style={{
              position: 'absolute', right: 58, top: 4,
              background: running ? 'rgba(125,205,255,0.10)' : 'rgba(125,205,255,0.16)',
              border: '1px solid rgba(125,205,255,0.40)',
              borderRadius: 3,
              padding: '1px 6px',
              fontFamily: 'inherit',
              fontSize: 9.5,
              color: running ? 'rgba(191,230,255,0.55)' : '#bfe6ff',
              cursor: running ? 'wait' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
            <span aria-hidden="true" style={{ fontSize: 8, lineHeight: 1 }}>▶</span>
            <span>{running ? 'run…' : 'run'}</span>
          </button>
        )}
        <button
          onClick={copy}
          className="focus-ring"
          title="Copier la commande"
          style={{
            position: 'absolute', right: 8, top: 4,
            background: copied ? 'rgba(40,200,64,0.18)' : 'rgba(255,255,255,0.06)',
            border: '1px solid ' + (copied ? 'rgba(40,200,64,0.45)' : 'rgba(255,255,255,0.12)'),
            borderRadius: 3,
            padding: '1px 6px',
            fontFamily: 'inherit',
            fontSize: 9.5,
            color: copied ? '#7ee59a' : '#c9ccd2',
            cursor: 'pointer',
            textTransform: 'lowercase',
            letterSpacing: '0.04em',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      {/* body */}
      <div style={{
        padding: '10px 12px 12px',
        fontFamily: 'inherit',
        fontSize: 11.5,
        lineHeight: 1.55,
        color: '#e6e8ec',
      }}>
        {active.hint && (
          <div style={{ color: '#6b7180', whiteSpace: 'pre-wrap' }}>
            # {active.hint}
          </div>
        )}
        {lang === 'shell' ? (
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: active.hint ? 4 : 0, flexWrap: 'wrap' }}>
            <span style={{ color: '#7ee59a', flexShrink: 0, userSelect: 'none' }}>(jdm-agent)</span>
            <span style={{ color: '#5d8fd6', flexShrink: 0, userSelect: 'none', marginLeft: 5 }}>~</span>
            <span style={{ color: '#e6e8ec', flexShrink: 0, userSelect: 'none', margin: '0 6px 0 5px' }}>$</span>
            <span style={{ wordBreak: 'break-word', color: '#e6e8ec' }}>{active.cmd}</span>
            {/* Curseur clignotant : récupéré du brief designer (cf. CHANGELOG). */}
            <span className="cli-caret" aria-hidden="true" />
          </div>
        ) : (
          // Python: render as a script (multi-line, no prompt) with subtle
          // syntax tint — keywords + strings hinted in cooler colors.
          <pre style={{
            margin: active.hint ? '4px 0 0' : 0,
            color: '#e6e8ec',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 1.6,
          }}>
            <code dangerouslySetInnerHTML={{ __html: highlightPython(active.cmd) }}/>
          </pre>
        )}
      </div>
      {/* Sortie du bouton ▶ : prolonge le terminal d'un panneau de
          résultat. Reste mono, indenté, séparé par une fine ligne. */}
      {(running || runOut != null) && (
        <div style={{
          borderTop: '1px solid #14151a',
          background: '#15171b',
          padding: '8px 12px 10px',
          fontFamily: 'inherit',
          fontSize: 11,
          lineHeight: 1.5,
          color: '#c9ccd2',
        }}>
          <div style={{ color: '#6b7180', fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            {running ? '↻ running…' : '↳ output'}
          </div>
          {running && runOut == null ? (
            <div style={{ color: '#7d8390' }}>…</div>
          ) : (
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              maxHeight: 220,
              overflow: 'auto',
            }}>{runOut}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// Minimal Python syntax highlight — keywords, strings, comments. Not a
// full parser; just enough to make the snippet feel like code.
function highlightPython(src) {
  // Escape HTML first to avoid breaking from < > & in user content.
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Highlight une PORTION DE CODE (= sans commentaire) :
  // strings → keywords → calls. L'ordre interne importe peu ici car
  // ces tokens ne contiennent pas de `#`.
  const highlightCode = (code) => {
    code = code.replace(/(&quot;[^&\n]*?&quot;|'[^'\n]*?')/g,
      '<span style="color:#e0c890">$1</span>');
    code = code.replace(/\b(from|import|for|in|print|return|if|else|as|def|class|with|try|except|raise|yield|lambda)\b/g,
      '<span style="color:#c89bff">$1</span>');
    code = code.replace(/\.(predict|submit|view_api|post|get|stream|iter_lines|startswith|strip|json|items|append|read|write|close)\b/g,
      '.<span style="color:#7ee59a">$1</span>');
    return code;
  };

  // Bug rapporté : appliquer les keywords AVANT les commentaires
  // produit du HTML inline du style `<span style="color:#c89bff">`,
  // et la regex de commentaire qui tourne après matche `#c89bff">…`
  // comme un commentaire littéral → la couleur s'affiche en texte.
  // Fix : traiter ligne par ligne et isoler le `#` (= premier `#`
  // hors-string) AVANT toute autre coloration.
  return src.split('\n').map(line => {
    // Cherche le 1er `#` qui n'est pas dans une string.
    let inStr = null, commentIdx = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === inStr && line[i - 1] !== '\\') inStr = null;
      } else if (c === '"' || c === "'") {
        inStr = c;
      } else if (c === '#') {
        commentIdx = i;
        break;
      }
    }
    if (commentIdx < 0) {
      return highlightCode(esc(line));
    }
    const code = line.slice(0, commentIdx);
    const comment = line.slice(commentIdx);
    return highlightCode(esc(code))
         + '<span style="color:#6b7180">' + esc(comment) + '</span>';
  }).join('\n');
}

function CliCommandButton({ view }) {
  const data = CLI_COMMANDS[view];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!data) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="focus-ring"
        title="Commande CLI équivalente"
        aria-label="Voir la commande CLI"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28,
          padding: 0,
          background: open ? 'var(--bg-elev)' : 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          color: open ? 'var(--ink)' : 'var(--ink-2)',
          cursor: 'pointer',
          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = 'var(--ink-2)'; }}
      >
        {/* terminal glyph — fills the button frame */}
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="2.5" width="14" height="11" rx="1.5"
                stroke="currentColor" strokeWidth="1.2" fill="none"/>
          <path d="M4 6.5 L6.5 8 L4 9.5" stroke="currentColor"
                strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="8" y1="10" x2="11.5" y2="10"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Commande CLI / Remote"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(540px, calc(100vw - 32px))',
            zIndex: 100,
            animation: 'cli-pop 0.14s ease-out',
          }}>
          <CliTerminalBlock
            cliData={CLI_COMMANDS[view]}
            remoteData={REMOTE_COMMANDS[view]}
            closeable
            onClose={() => setOpen(false)}
          />
        </div>
      )}

      <style>{`
        @keyframes cli-pop {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
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

// ───────── Productions count pill — sticky en haut, polling léger ─────
// Affiche le nombre de productions actives (fichiers sortie de Jarvis)
// dans la nav. Recharge toutes les 30s ; échec silencieux si l'API
// n'est pas dispo.
function ProductionsCountPill() {
  const [n, setN] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('api/productions');
        if (!r.ok || !alive) return;
        const d = await r.json();
        setN((d.productions || []).length);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return (
    <Pill color="var(--jdm-green)" tone="outline">
      <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
      {n == null ? '— productions' : `${n} production${n > 1 ? 's' : ''} soumise${n > 1 ? 's' : ''}`}
    </Pill>
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

