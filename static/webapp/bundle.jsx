// === webapp/shared.jsx ===
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
function Input({ value, onChange, placeholder, mono, type, ...rest }) {
  return (
    <input
      type={type || "text"}
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
    { id: 'chatbot',     label: 'Chatbot LLM' },
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
                onClick={() => {
                  // Reset SYSTEMATIQUE au clic d'un onglet du header : la vue
                  // cible remonte à son panneau d'entrée (pour Jarvis =
                  // Supervision), exactement comme la pill « N/6 flux » et la
                  // quick-nav. Double-dispatch (avant + microtask après
                  // setActive) pour couvrir le tout-premier mount de la vue.
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('jdm-nav-reset', { detail: { view: it.id } }));
                  }
                  setActive(it.id);
                  if (typeof window !== 'undefined') {
                    setTimeout(() => window.dispatchEvent(
                      new CustomEvent('jdm-nav-reset', { detail: { view: it.id } })
                    ), 0);
                  }
                }}
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
                 hint: 'Agent Enrichissement complet — proposer, valider, consolider, écrire le .enrich.' },
  productions: { cmd: 'ls /tmp/jdm_outputs/ && cat /tmp/jdm_outputs/*.enrich | head -20',
                 hint: 'Liste les fichiers produits (.enrich/.annot/.audit/.err/.stat).' },
  aide:        { cmd: 'python -m jdm_agent.apps.enrich --help',
                 hint: 'Affiche les flags de chacune des CLI (--help fonctionne sur tous les modules).' },
};

// Runners par vue — appelés par le bouton ▶ run de chaque CliTerminalBlock
// quand aucun `onRun` explicite n'est passé (= cas de la popover
// CliCommandButton, qui n'a pas accès à un form). Le navigateur ne peut
// pas exec Python local, donc CLI et Remote pointent sur le même
// endpoint FastAPI same-origin. Paramètres = valeurs présentes dans le
// snippet affiché (voiture, baleine, etc.).
async function _runExplorer() {
  const r = await fetch('api/explore', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term: 'voiture', relation: 'r_isa',
                            limit: 50, min_weight: 25 }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function _runClaim() {
  const r = await fetch('api/factcheck', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'baleine', relation: 'r_isa',
                            object: 'poisson', effort: 1 }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function _runSubgraph() {
  const r = await fetch('api/subgraph', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term: 'voiture', depth: 2, top_k: 3, format: 'json' }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const s = d.stats || {};
  return `→ voiture · depth=2\n${s.n_nodes ?? d.nodes?.length ?? '?'} nœuds · `
       + `${s.n_edges ?? d.edges?.length ?? '?'} arêtes · `
       + `${s.n_negative ?? 0} négations`;
}
// SSE runners — capturent les premiers chunks puis abortent. Affichent
// un résumé court plutôt que la stream brute (qui partirait à 10k+ chars).
async function _runAgentStream() {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('api/chatbot/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'quels sens de voiture ?',
                              model: 'gemini-3.1-flash-lite',
                              use_thinking: false }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', tools = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      const re = /event:\s*(\w+)\s*\ndata:\s*({.*})/g;
      let m;
      while ((m = re.exec(buf)) !== null) {
        try {
          const d = JSON.parse(m[2]);
          if (m[1] === 'chunk' && d.text) text += d.text;
          else if (m[1] === 'tool') tools++;
        } catch {}
      }
      if (text.length > 300) break;
    }
    try { await reader.cancel(); } catch {}
    return `(premiers ${text.length} chars, ${tools} appels outils)\n\n`
         + text.slice(0, 300) + (text.length > 300 ? '…' : '');
  } finally {
    clearTimeout(tid);
  }
}
async function _runJarvisStream() {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch('api/jarvis/enrich/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params: { term: 'voiture', target_count: 5, budget_label: '10',
                  model: 'gemini-3.1-flash-lite' }
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let received = '', events = 0;
    while (events < 3) {
      const { done, value } = await reader.read();
      if (done) break;
      received += dec.decode(value);
      events = (received.match(/event:/g) || []).length;
    }
    try { await reader.cancel(); } catch {}
    const headlineMatch = received.match(/event: headline\s*\ndata: ({.*})/);
    const headline = headlineMatch ? JSON.parse(headlineMatch[1]).text : '(en cours)';
    return `Flow enrich démarré sur « voiture »\n${headline}\n`
         + `(${events} events SSE reçus, connexion fermée — `
         + `ouvrir l'onglet Jarvis pour la suite)`;
  } finally {
    clearTimeout(tid);
  }
}
async function _runProductions() {
  const r = await fetch('api/productions');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const files = d.files || [];
  if (files.length === 0) return '(aucun fichier produit pour l\'instant)';
  return files.slice(0, 20).map(p =>
    `${p.name}  ${p.size} bytes  ${p.mtime || ''}`
  ).join('\n') + (files.length > 20 ? `\n… (+ ${files.length - 20} autres)` : '');
}
async function _runAide() {
  const r = await fetch('openapi.json');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const schema = await r.json();
  const lines = [];
  for (const [path, methods] of Object.entries(schema.paths || {})) {
    for (const method of Object.keys(methods)) {
      lines.push(`${method.toUpperCase().padEnd(6)} ${path}`);
    }
  }
  return lines.join('\n');
}

// Remote API equivalents — vrais endpoints FastAPI du projet (depuis
// la migration). Snippets Python via `httpx` (déjà dépendance) ou
// curl en alternative. Pas de gradio_client — le backend est FastAPI
// pur. Endpoint host = celui du déploiement (LIRMM, HF Space, etc.).
// Chaque entrée embarque un `runner` invoqué par le bouton ▶ run.
const REMOTE_COMMANDS = {
  explorer:    { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/explore", json={\n    "term": "voiture",\n    "relation": "r_isa",\n    "limit": 50,\n    "min_weight": 25\n})\nprint(r.json())',
                 hint: 'POST /api/explore — triplets bruts {nodes, edges, relations}.',
                 runner: _runExplorer },
  claim:       { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/factcheck", json={\n    "subject": "baleine",\n    "relation": "r_isa",\n    "object": "poisson",\n    "effort": 1\n})\nprint(r.json())',
                 hint: 'POST /api/factcheck — verdict + chaîne d\'inférence.',
                 runner: _runClaim },
  subgraph:    { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/subgraph", json={\n    "term": "voiture",\n    "depth": 2,\n    "top_k": 3,\n    "format": "json"\n})\nprint(r.json())',
                 hint: 'POST /api/subgraph — nodes/edges JSON ou HTML (format="html").',
                 runner: _runSubgraph },
  agent:       { lang: 'python',
                 cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/chatbot/stream",\n        json={"message": "quels sens de voiture ?",\n              "model": "gemini-3.1-flash-lite"}) as r:\n    for line in r.iter_lines():\n        if line.startswith("data:"): print(line[5:].strip())',
                 hint: 'POST /api/chatbot/stream — SSE streaming (events: chunk, tool, done).',
                 runner: _runAgentStream },
  jarvis:      { lang: 'python',
                 cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/jarvis/enrich/stream",\n        json={"params": {"term": "voiture", "target_count": 20,\n                          "iterate": True, "budget_label": "50"}}) as r:\n    for line in r.iter_lines():\n        if line.startswith("event:"): print(line)',
                 hint: 'POST /api/jarvis/{enrich|audit|gap|annotation|stats}/stream — SSE.',
                 runner: _runJarvisStream },
  productions: { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/api/productions")\nfor p in r.json().get("files", []):\n    print(p["name"], p["size"], p["mtime"])',
                 hint: 'GET /api/productions — liste tous les fichiers produits.',
                 runner: _runProductions },
  aide:        { lang: 'python',
                 cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/openapi.json")\nschema = r.json()\nfor path, methods in schema["paths"].items():\n    for method in methods:\n        print(f"{method.upper():6} {path}")',
                 hint: 'GET /openapi.json — schéma OpenAPI complet (ou /docs pour UI Swagger).',
                 runner: _runAide },
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

  // Runner effectif : priorité au `onRun` du parent (ex. Projet ›
  // ModuleQuickTryAndCli qui exécute avec le state du form), sinon
  // fallback sur le `runner` défini sur la commande Remote (les
  // CliCommandButton popovers de chaque onglet utilisent ce chemin —
  // le navigateur ne peut pas exec Python local de toute façon, donc
  // CLI et Remote pointent sur le même endpoint FastAPI).
  const resolvedRunner = onRun
    || (effectiveRemote && effectiveRemote.runner)
    || (effectiveCli && effectiveCli.runner)
    || null;

  const handleRun = async () => {
    if (!resolvedRunner || running) return;
    setRunning(true);
    setRunOut(null);
    try {
      const r = await resolvedRunner({ mode, cmd: active.cmd });
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

        {/* Cluster gauche : toggle CLI/Remote (si les deux variantes
            existent) + bouton ▶ run. Tout regroupé pour que le run soit
            visuellement adjacent au switch CLI/Remote. */}
        <div style={{
          position: 'absolute', left: 60, top: 4,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          {hasBoth && (
            <>
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
            </>
          )}
          {/* ▶ run : toujours présent maintenant. Si pas de runner
              résolu (cas dégénéré), le bouton est disabled et grisé. */}
          <button
            onClick={handleRun}
            disabled={running || !resolvedRunner}
            className="focus-ring"
            title={
              !resolvedRunner ? 'Pas d\'exécuteur disponible pour cette commande'
              : mode === 'remote' ? 'Exécuter (Remote)' : 'Exécuter (CLI)'
            }
            aria-label="Exécuter la commande"
            style={{
              background: !resolvedRunner ? 'rgba(255,255,255,0.04)'
                          : running ? 'rgba(125,205,255,0.10)'
                          : 'rgba(125,205,255,0.16)',
              border: '1px solid ' + (
                !resolvedRunner ? 'rgba(255,255,255,0.10)'
                                : 'rgba(125,205,255,0.40)'),
              borderRadius: 3,
              padding: '1px 6px',
              fontFamily: 'inherit',
              fontSize: 9.5,
              color: !resolvedRunner ? 'rgba(201,204,210,0.40)'
                    : running ? 'rgba(191,230,255,0.55)'
                    : '#bfe6ff',
              cursor: !resolvedRunner ? 'not-allowed'
                    : running ? 'wait' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 3,
              height: 18,
            }}>
            <span aria-hidden="true" style={{ fontSize: 8, lineHeight: 1 }}>▶</span>
            <span>{running ? 'run…' : 'run'}</span>
          </button>
        </div>

        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 10,
          color: '#9aa0aa',
          letterSpacing: '0.02em',
          userSelect: 'none',
          paddingLeft: hasBoth ? 110 : 50,
        }}>
          jdm-agent — {lang === 'python' ? 'python' : 'bash'}
        </div>
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

// ───────── Flux en cours pill — sticky en haut, polling léger ─────
// Affiche `X/N flux en cours` où X = runs actifs (status=running)
// retournés par GET /api/jarvis/runs et N = nombre de flows distincts
// (configuré globalement par JARVIS_AGENTS_TOTAL). Gradient de couleur :
//   0%   → vert  (var(--jdm-green))      tout dispo
//   50%  → jaune (var(--jdm-yellow))     mi-charge
//   100% → rouge (var(--jdm-magenta))    tous pris, file d'attente
// Recharge toutes les 5s pendant qu'on a au moins un run actif (pour
// suivre le pulse), 30s sinon (économe quand idle).
const JARVIS_AGENTS_TOTAL = 6;  // enrich + audit + gap + signalement + stats + annotation

function _interpolateColor(c1, c2, t) {
  // c1, c2 = [r, g, b] ; t in [0,1]
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}
function _loadGradientRGB(load) {
  // load in [0,1]. 0=vert, 0.5=jaune, 1=rouge. Interpolation par segments
  // pour matcher le sentiment visuel (jaune intermédiaire).
  const green  = [78, 166, 60];   // var(--jdm-green)
  const yellow = [212, 169, 10];  // var(--jdm-yellow)
  const red    = [200, 58, 115];  // var(--jdm-magenta)
  if (load <= 0.5) return _interpolateColor(green, yellow, load * 2);
  return _interpolateColor(yellow, red, (load - 0.5) * 2);
}

function ProductionsCountPill() {
  // Source primaire : le JarvisStore local (instant, sans polling).
  // Source secondaire : GET /api/jarvis/runs pour rattraper les runs
  // lancés dans une autre tab/session. On prend le MAX des deux.
  const [serverActive, setServerActive] = useState(null);
  // Force-update sur changement du store local
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__jdmJarvisStore) return;
    return window.__jdmJarvisStore.subscribe('*', () => forceTick(t => t + 1));
  }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('api/jarvis/runs');
        if (!r.ok || !alive) return;
        const d = await r.json();
        const runs = d.runs || [];
        const n = runs.filter(r => r.status === 'starting' || r.status === 'running').length;
        setServerActive(n);
      } catch {}
    };
    load();
    const id = setInterval(load, 15_000);  // 15s, sans logique adapt cassée
    return () => { alive = false; clearInterval(id); };
  }, []);

  const localActive = (typeof window !== 'undefined' && window.__jdmJarvisStore)
    ? window.__jdmJarvisStore.activeFlowIds().length
    : 0;
  // Source de vérité = store local (instantané, réactif à chaque
  // changement de status). Le poll serveur est utilisé UNIQUEMENT en
  // fallback quand le local n'a aucun run actif (cas où l'utilisateur
  // a lancé des runs depuis une autre tab). Sans ce fallback-only,
  // l'ancien `max(local, server)` empêchait la décroissance immédiate
  // au stop (serveur lag 15s + bg thread cancellation 5-15s).
  const active = localActive > 0 ? localActive : (serverActive ?? 0);
  const label = `${active}/${JARVIS_AGENTS_TOTAL}`;
  const load = Math.min(1, active / JARVIS_AGENTS_TOTAL);
  const [r, g, b] = _loadGradientRGB(load);
  const accentRGB = `rgb(${r}, ${g}, ${b})`;
  const fillRGBA = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const borderRGBA = `rgba(${r}, ${g}, ${b}, 0.45)`;
  const dotRGB = accentRGB;
  return (
    <button
      type="button"
      className="focus-ring"
      onClick={() => {
        // Navigate to Jarvis tab + Supervision panel. App.jsx ecoute pour
        // setView('jarvis'), ViewJarvis ecoute pour setPanelIndex(2).
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('jdm-goto-jarvis-supervision'));
      }}
      title={
        active == null ? 'Chargement…'
        : `${active} agents Jarvis actuellement en cours sur ${JARVIS_AGENTS_TOTAL} disponibles · clic pour ouvrir Supervision`
      }
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 11px',
        background: fillRGBA,
        border: '1px solid ' + borderRGBA,
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        color: accentRGB,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s, color 0.2s, transform .12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
      <span className="pulse-dot" style={{ background: dotRGB }} />
      <span>{label}</span>
      <span style={{ opacity: 0.65, fontWeight: 400, textTransform: 'lowercase' }}>agents</span>
    </button>
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

// ───────── Env-status hook — quels secrets sont configurés en .env ─────
// Le backend expose GET /api/env-status qui renvoie pour chaque clé :
// `{set: bool}`. Le front l'utilise pour dégriser les boutons qui
// dépendent d'une clé : si l'utilisateur n'a rien tapé MAIS l'env
// contient la clé, on autorise (la clé sera prise côté serveur).
//
// Cache module-level + recharge unique au boot — l'env ne change pas
// au runtime. Si tu déploies un changement, tu redémarres uvicorn.
let _ENV_STATUS_CACHE = null;
let _ENV_STATUS_LOADERS = new Set();

async function _fetchEnvStatus() {
  try {
    const r = await fetch('api/env-status');
    if (!r.ok) return {};
    const d = await r.json();
    return d.env || {};
  } catch { return {}; }
}

function useEnvStatus() {
  const [env, setEnv] = useState(_ENV_STATUS_CACHE);
  useEffect(() => {
    if (_ENV_STATUS_CACHE !== null) return;
    _ENV_STATUS_LOADERS.add(setEnv);
    if (_ENV_STATUS_LOADERS.size > 1) return;  // déjà en cours
    _fetchEnvStatus().then(e => {
      _ENV_STATUS_CACHE = e;
      _ENV_STATUS_LOADERS.forEach(s => { try { s(e); } catch {} });
      _ENV_STATUS_LOADERS.clear();
    });
    return () => { _ENV_STATUS_LOADERS.delete(setEnv); };
  }, []);
  return env || {};
}

// Helper : la clé `name` est-elle disponible (saisie ou en env) ?
function isKeyAvailable(envStatus, name, userInput) {
  if (userInput && userInput.trim()) return true;
  return !!(envStatus && envStatus[name] && envStatus[name].set);
}

Object.assign(window, {
  JDM_PALETTE, JDM_COLORS,
  Select, Field, Input, Slider, Button, Card, Pill, SectionTitle, EmptyState,
  Triplet, TopNav, ThemeSwitcher, PageShell, JDMMark, JDMWordmark,
  useEnvStatus, isKeyAvailable,
});

// === webapp/hero-animation.jsx ===
// hero-animation.jsx — animated graph + simulated chat for Projet hero.
// Loops indefinitely with 2 alternating scenarios.
//
// Mount with <HeroAnimation height={380} /> inside Panel 1.
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).
//
// Size is configurable via `height` prop (default 380). The internal
// graph layout & font sizes stay constant — they're tuned for 380px.

const { useState: useStateHero, useEffect: useEffectHero, useRef: useRefHero } = React;

function HeroAnimation({ height = 380, showChat = true, liveScenario = null,
                         interactive = false, onNodeClick = null }) {
  // Si liveScenario est fourni : on l'utilise À LA PLACE des scénarios
  // hardcodés (= mode "vraies données JDM" depuis /api/subgraph/live).
  // Pas de loop, pas de chat de démo — un seul rendu animé.
  const scenarios = [
    {
      id: 'voiture',
      question: 'quels sont les sens de "voiture" ?',
      streamChunks: [
        'Dans JeuxDeMots, ',
        '**voiture** est polysémique. ',
        'Quatre sens principaux sont identifiés :\n',
        '\n• **véhicule automobile**',
        ' — le plus fréquent (w=842)',
        '\n• **wagon ferroviaire**',
        ' — sens technique (w=312)',
        '\n• **moyen de transport**',
        ' — sens générique (w=198)',
        '\n• **véhicule hippomobile**',
        ' — sens historique (w=89)',
        '\n\nChacun a son propre voisinage lexical.',
      ],
      graph: {
        center: 'voiture',
        nodes: [
          { id: 'auto',    label: 'automobile',     angle: -60, dist: 110, color: 'jdm-magenta', delay: 0.6 },
          { id: 'wagon',   label: 'wagon',          angle: 30,  dist: 110, color: 'jdm-cyan',    delay: 1.6 },
          { id: 'tpt',     label: 'transport',      angle: 120, dist: 110, color: 'jdm-green',   delay: 2.3 },
          { id: 'hippo',   label: 'hippomobile',    angle: 210, dist: 110, color: 'jdm-violet',  delay: 3.2 },
          { id: 'moteur',  label: 'moteur',         angle: -90, dist: 180, color: 'jdm-magenta', delay: 3.8, dim: true },
          { id: 'roue',    label: 'roue',           angle: -30, dist: 180, color: 'jdm-magenta', delay: 4.1, dim: true },
          { id: 'rail',    label: 'rail',           angle: 60,  dist: 180, color: 'jdm-cyan',    delay: 4.4, dim: true },
          { id: 'voyage',  label: 'voyage',         angle: 150, dist: 180, color: 'jdm-green',   delay: 4.7, dim: true },
          { id: 'cheval',  label: 'cheval',         angle: 240, dist: 180, color: 'jdm-violet',  delay: 5.0, dim: true },
        ],
        edges: [
          { from: 'voiture', to: 'auto',   delay: 0.7, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'wagon',  delay: 1.7, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'tpt',    delay: 2.4, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'hippo',  delay: 3.3, label: 'r_raff', highlight: true },
          { from: 'auto',  to: 'moteur', delay: 3.9, label: 'r_has_part' },
          { from: 'auto',  to: 'roue',   delay: 4.2, label: 'r_has_part' },
          { from: 'wagon', to: 'rail',   delay: 4.5, label: 'r_lieu' },
          { from: 'tpt',   to: 'voyage', delay: 4.8, label: 'r_telic_role' },
          { from: 'hippo', to: 'cheval', delay: 5.1, label: 'r_agent' },
        ],
      },
    },
    {
      id: 'velo-pneu',
      question: 'comment sont liés vélo et pneumatique ?',
      streamChunks: [
        'Dans JeuxDeMots, ',
        'il **n\'existe pas de lien direct**',
        ' entre *vélo* et *pneumatique*.\n',
        '\nMais en passant par **pneu** :\n',
        '\n• vélo `r_has_part` **pneu** (w=110)',
        '\n• pneu `r_syn` **pneumatique** (w=87)',
        '\n\nLa chaîne fait **2 sauts**.',
        ' L\'agent infère donc une relation indirecte.',
      ],
      graph: {
        center: null,
        layout: 'path',
        nodes: [
          { id: 'velo',  label: 'vélo',        x: -150, y: 0,   color: 'jdm-green',   delay: 0.3 },
          { id: 'pneu',  label: 'pneu',        x: 0,    y: 0,   color: 'jdm-orange',  delay: 1.5 },
          { id: 'pneuma',label: 'pneumatique', x: 155,  y: 0,   color: 'jdm-magenta', delay: 2.7 },
          { id: 'cadre', label: 'cadre',       x: -195, y: -90, color: 'jdm-green',   delay: 3.6, dim: true },
          { id: 'guidon',label: 'guidon',      x: -195, y: 90,  color: 'jdm-green',   delay: 3.9, dim: true },
          { id: 'caoutchouc', label: 'caoutchouc', x: 200, y: -90, color: 'jdm-magenta', delay: 4.3, dim: true },
        ],
        edges: [
          { from: 'velo', to: 'pneu',   delay: 1.8, label: 'r_has_part', highlight: true },
          { from: 'pneu', to: 'pneuma', delay: 3.0, label: 'r_syn',      highlight: true },
          { from: 'velo', to: 'cadre',  delay: 3.7, label: 'r_has_part' },
          { from: 'velo', to: 'guidon', delay: 4.0, label: 'r_has_part' },
          { from: 'pneuma', to: 'caoutchouc', delay: 4.4, label: 'r_made_of' },
        ],
      },
    },
  ];

  const [scenarioIdx, setScenarioIdx] = useStateHero(0);
  const [phase, setPhase] = useStateHero('typing');
  const [userText, setUserText] = useStateHero('');
  const [streamText, setStreamText] = useStateHero('');
  const [tick, setTick] = useStateHero(0);

  // Si liveScenario fourni → on l'utilise (mode données réelles SSE).
  // Sinon : rotation des scénarios pré-enregistrés (mode démo Projet).
  const scenario = liveScenario || scenarios[scenarioIdx];

  // Wait for the graph to finish drawing before swapping scenarios.
  const graphEndTime = (() => {
    const lastNode = Math.max(...scenario.graph.nodes.map(n => n.delay + 0.5));
    const lastEdge = scenario.graph.edges.length
      ? Math.max(...scenario.graph.edges.map(e => e.delay + 0.7))
      : 0;
    return Math.max(lastNode, lastEdge);
  })();

  useEffectHero(() => {
    let cancelled = false;
    const run = async () => {
      setUserText(''); setStreamText(''); setPhase('typing'); setTick(0);

      // Mode liveScenario : on saute le typing et le streaming de chat,
      // on démarre directement l'animation du graphe.
      if (liveScenario) {
        setPhase('streaming');
        const startTick = Date.now();
        const tickInterval = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick) / 1000);
        }, 80);
        // Anim termine quand le dernier edge est dessiné. Puis on garde
        // le graphe visible (pas de loop : pas de scenarioIdx incrémenté).
        await sleepHero((graphEndTime + 1) * 1000);
        clearInterval(tickInterval);
        return;
      }

      const q = scenario.question;
      for (let i = 0; i <= q.length; i++) {
        if (cancelled) return;
        setUserText(q.slice(0, i));
        await sleepHero(22 + Math.random() * 22);
      }
      await sleepHero(350);

      if (cancelled) return;
      setPhase('streaming');
      const startTick = Date.now();
      const tickInterval = setInterval(() => {
        if (!cancelled) setTick((Date.now() - startTick) / 1000);
      }, 80);

      let acc = '';
      for (const chunk of scenario.streamChunks) {
        if (cancelled) { clearInterval(tickInterval); return; }
        for (let i = 0; i < chunk.length; i++) {
          acc += chunk[i];
          setStreamText(acc);
          await sleepHero(6 + Math.random() * 11);
        }
        await sleepHero(90);
      }
      clearInterval(tickInterval);

      if (cancelled) return;
      setPhase('done');
      const elapsedNow = (Date.now() - startTick) / 1000;
      const waitForGraph = Math.max(0, graphEndTime - elapsedNow) * 1000;
      if (waitForGraph > 0) {
        const waitTick = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick) / 1000);
        }, 80);
        await sleepHero(waitForGraph);
        clearInterval(waitTick);
      }
      await sleepHero(1600);
      if (cancelled) return;
      setScenarioIdx(i => (i + 1) % scenarios.length);
    };
    run();
    return () => { cancelled = true; };
  }, [scenarioIdx, liveScenario]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: showChat ? 'minmax(0, 1.05fr) minmax(0, 1fr)' : '1fr',
      gap: 16,
      borderRadius: 'var(--radius-lg)',
      height: interactive ? '100%' : 'auto',
    }}>
      {/* Left — graph */}
      {/* En mode interactif (LIVE), on prend toute la hauteur dispo
          du parent (height: 100%) ; sinon hauteur fixe (démo accueil). */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        height: interactive ? '100%' : height,
        overflow: 'hidden',
      }}>
        <GraphCanvas scenario={scenario} tick={tick} height={height}
                     interactive={interactive} onNodeClick={onNodeClick} />
        <div style={{
          position: 'absolute', top: 14, left: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          <span className="pulse-dot" style={{ background: 'var(--accent)' }} />
          Graphe JDM · en direct
        </div>
      </div>

      {/* Right — chat (caché si showChat=false) */}
      {showChat && (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
          Chatbot LLM · démo
          <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
            gemini-3.1-flash-lite
          </span>
        </div>
        <ChatView userText={userText} streamText={streamText} phase={phase} />
      </div>
      )}
    </div>
  );
}

function sleepHero(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function GraphCanvas({ scenario, tick, height, interactive = false, onNodeClick = null }) {
  // viewBox dynamique : ratio 1.55 sur la hauteur pour que la démo
  // accueil tienne dans le panneau (≠ ancien 560 fixe qui marginait
  // sur les hauteurs < 380). En mode interactif (LIVE) on garde 920
  // pour la pleine largeur du sidebar.   (design-pass-2)
  const H = height;
  const W = interactive ? 920 : Math.round(H * 1.55);
  const cx = W / 2, cy = H / 2;
  const g = scenario.graph;

  // distScale : adapte les distances aux nœuds à la hauteur réelle du
  // panneau démo (sinon nœuds périphériques touchent les bords quand
  // height < 380). Cap à 0.92 pour ne pas surdimensionner sur grand H.
  // En interactif l'autofit + zoom utilisateur gèrent — pas de scale.
  const distScale = interactive ? 1 : Math.min(0.92, H / 430);

  const positions = {};
  if (g.center) positions[g.center] = { x: 0, y: 0 };
  g.nodes.forEach(n => {
    if (n.x !== undefined) {
      positions[n.id] = { x: n.x * distScale, y: n.y * distScale };
    } else {
      const rad = (n.angle * Math.PI) / 180;
      const d = n.dist * distScale;
      positions[n.id] = { x: Math.cos(rad) * d, y: Math.sin(rad) * d };
    }
  });

  // ── AUTOFIT — rescale toutes les positions pour exploiter au mieux
  //    le viewBox :
  //      - réduit (≤ 1) si du contenu dépasserait les marges sûres
  //      - agrandit (≤ 1.6) si le contenu est petit et qu'il reste
  //        de la place → les nœuds deviennent lisibles
  //    Marges :
  //      horizontal = bubble + demi-largeur label (≈84)
  //      vertical   = bubble + hauteur label sous bulle (≈44)
  //    Activé uniquement en mode interactif (LIVE).
  if (interactive) {
    const margX = 84, margY = 44;
    const maxX = Math.max(1, ...Object.values(positions).map(p => Math.abs(p.x)));
    const maxY = Math.max(1, ...Object.values(positions).map(p => Math.abs(p.y)));
    const safeX = Math.max(40, cx - margX);
    const safeY = Math.max(40, cy - margY);
    const sX = safeX / maxX;
    const sY = safeY / maxY;
    // Cap à 1.6 : sinon les petits graphes deviennent grotesques
    // (1 nœud à 100px → x4 → 400px illisible).
    const fitScale = Math.min(sX, sY, 1.6);
    if (Math.abs(fitScale - 1) > 0.02) {
      for (const id of Object.keys(positions)) {
        positions[id] = {
          x: positions[id].x * fitScale,
          y: positions[id].y * fitScale,
        };
      }
    }
  }

  // Path layout doesn't rotate — labels need to stay axis-aligned and
  // not drift off-frame. Radial layout has a slow drift.
  // MODE INTERACTIF (LIVE) : aucune rotation pour que le hover soit
  // utilisable et que les nœuds soient cliquables sans bouger.
  const isPath = g.layout === 'path';
  const breathScale = 1 + (isPath || interactive ? 0.004 : 0.012) * Math.sin(tick * 0.6);
  const rotateAll = (isPath || interactive) ? 0 : tick * 1.2;

  const transform = `translate(${cx} ${cy}) rotate(${rotateAll}) scale(${breathScale})`;

  // Hover state — index d'arête/de nœud sous le curseur
  const [hoverEdge, setHoverEdge] = useStateHero(null);
  const [hoverNode, setHoverNode] = useStateHero(null);

  // Index : pour un nœud donné, quelles arêtes le touchent ?
  // Permet de SURBRILLER les arêtes connectées au nœud survolé.
  const edgesByNode = {};
  g.edges.forEach((e, i) => {
    (edgesByNode[e.from] = edgesByNode[e.from] || []).push(i);
    (edgesByNode[e.to]   = edgesByNode[e.to]   || []).push(i);
  });

  // Index id → label décodé pour les tooltips d'arêtes — les ids
  // bruts JDM (N23, N1234…, ROOT) ne sont pas lisibles.
  // Source la PLUS COMPLÈTE : _labelByRawId fourni par buildLiveScenario
  // qui couvre TOUS les nœuds reçus du backend (y compris ROOT et ceux
  // qui auraient pu être filtrés du rendu). On complète avec g.nodes
  // et g.center pour les scénarios démo.
  const labelOf = Object.assign({}, g._labelByRawId || {});
  if (g.center) labelOf[g.center] = g.center;
  g.nodes.forEach(n => {
    const lbl = (n.label || '').toString().trim();
    if (lbl) labelOf[n.id] = lbl;
  });

  // Construit la liste des voisins d'un nœud pour son tooltip survol.
  // Format multi-ligne (les <title> SVG natifs respectent \n).
  // Affiche le sens de l'arête (→ sortante, ← entrante), le type de
  // relation, le label du voisin, le poids et le flag négation.
  const neighborSummary = (nodeId) => {
    const ed = edgesByNode[nodeId] || [];
    if (!ed.length) return '';
    const CAP = 10;
    const lines = ed.slice(0, CAP).map(i => {
      const e = g.edges[i];
      const isOut = e.from === nodeId;
      const otherId = isOut ? e.to : e.from;
      const otherLabel = labelOf[otherId] || otherId;
      const arrow = isOut ? '→' : '←';
      const wPart = e.weight !== undefined && e.weight !== null
        ? `  w=${e.weight}` : '';
      const negPart = e.negative ? '  [NÉGATION]' : '';
      return `  ${arrow} [${e.label || '?'}] ${otherLabel}${wPart}${negPart}`;
    });
    if (ed.length > CAP) lines.push(`  … (+${ed.length - CAP} autres)`);
    return lines.join('\n');
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`}
         preserveAspectRatio="xMidYMid meet"
         width="100%" height="100%"
         style={{ display: 'block' }}>
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </radialGradient>
        {/* Marqueurs de flèche — un par couleur unique présente dans
            les arêtes. Permet à chaque arête d'avoir une flèche de
            même couleur que sa ligne (pas de context-stroke universel
            cross-browser). */}
        {Array.from(new Set(g.edges.map(e =>
          e.color || (e.highlight ? '__accent__' : '__ink3__')
        ))).map(c => {
          const fill = c === '__accent__' ? 'var(--accent)'
                     : c === '__ink3__'   ? 'var(--ink-3)'
                     : c;
          const id = 'arrow-' + (c || 'none').replace(/[^a-zA-Z0-9_-]/g, '');
          return (
            <marker key={c} id={id}
                    viewBox="0 0 10 10" refX="9" refY="5"
                    markerUnits="userSpaceOnUse"
                    markerWidth="11" markerHeight="11"
                    orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={fill}/>
            </marker>
          );
        })}
      </defs>

      <circle cx={cx} cy={cy} r={Math.min(W, H) / 3} fill="url(#hero-glow)"/>

      <g transform={transform}>
        {g.edges.map((e, i) => {
          const visible = tick >= e.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - e.delay) / 0.7);
          const a = positions[e.from], b = positions[e.to];
          if (!a || !b) return null;
          // Tronque la ligne avant le nœud destination pour que la
          // flèche ne plonge pas dans la bulle (marge = rayon + padding).
          const dx = b.x - a.x, dy = b.y - a.y;
          const segLen = Math.max(1, Math.sqrt(dx*dx + dy*dy));
          const trim = interactive ? 16 : 0;
          const bx = b.x - (dx / segLen) * trim;
          const by = b.y - (dy / segLen) * trim;
          const x = a.x + (bx - a.x) * t;
          const y = a.y + (by - a.y) * t;
          const edgeColor = e.color
            || (e.highlight ? 'var(--accent)' : 'var(--ink-3)');
          const labelColor = e.color
            || (e.highlight ? 'var(--accent)' : 'var(--ink-3)');
          // États de surlignage : hover direct sur l'arête OU nœud
          // adjacent survolé.
          const adjacentHover = hoverNode != null &&
            (e.from === hoverNode || e.to === hoverNode);
          const isHot = hoverEdge === i || adjacentHover;
          // En mode interactif, on dim les arêtes non concernées
          // quand un hover est actif → "focus mode".
          const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
          const dimmed = someHoverActive && !isHot;
          return (
            <g key={i}>
              {/* Hitbox transparente plus large pour faciliter le hover */}
              {interactive && (
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverEdge(i)}
                  onMouseLeave={() => setHoverEdge(h => h === i ? null : h)}
                >
                  <title>
                    {`${labelOf[e.from] || e.from} —[${e.label || '?'}]→ ${labelOf[e.to] || e.to}`}
                    {e.weight !== undefined ? `  (w=${e.weight})` : ''}
                    {e.negative ? '  [NÉGATION]' : ''}
                  </title>
                </line>
              )}
              <line
                x1={a.x} y1={a.y} x2={x} y2={y}
                stroke={edgeColor}
                strokeWidth={isHot ? 3.2 : (e.highlight ? 2 : 1.2)}
                strokeOpacity={dimmed ? 0.15 : (isHot ? 1 : (e.color ? 0.82 : (e.highlight ? 0.9 : 0.45)))}
                strokeLinecap="round"
                strokeDasharray={e.negative ? '4 3' : undefined}
                markerEnd={interactive && t > 0.85 ? `url(#arrow-${
                  (e.color || (e.highlight ? '__accent__' : '__ink3__'))
                    .replace(/[^a-zA-Z0-9_-]/g, '')
                })` : undefined}
                style={{ pointerEvents: 'none', transition: 'stroke-width 0.12s, stroke-opacity 0.12s' }}
              />
              {((e.label && t > 0.6) || isHot) && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={isHot ? 11 : 9}
                  fontWeight={isHot ? 700 : 400}
                  fill={labelColor}
                  opacity={dimmed ? 0.15 : (isHot ? 1 : ((t - 0.6) / 0.4))}
                  transform={`rotate(${-rotateAll}, ${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 6})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {g.center && (
          <CenterNode label={g.center} tick={tick} counterRotate={-rotateAll}
            tooltip={interactive ? (() => {
              const nb = neighborSummary(g.center);
              return nb
                ? `${g.center}  (centre)\n\nLiens (${(edgesByNode[g.center]||[]).length}) :\n${nb}`
                : `${g.center}  (centre)`;
            })() : undefined} />
        )}

        {g.nodes.map((n, i) => {
          const p = positions[n.id];
          if (!p) return null;
          const visible = tick >= n.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - n.delay) / 0.5);
          // Pas de flottement en mode interactif (sinon le clic rate).
          const floatY = interactive ? 0 : Math.sin(tick * 1.2 + i) * 1.5;
          const isHot = hoverNode === n.id;
          const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
          // Un nœud "concerné" par le hover d'arête = ses extrémités
          const edgeHovered = hoverEdge != null ? g.edges[hoverEdge] : null;
          const concerned = edgeHovered &&
            (edgeHovered.from === n.id || edgeHovered.to === n.id);
          const dimmed = someHoverActive && !isHot && !concerned;
          return (
            <NodeBubble
              key={n.id}
              x={p.x} y={p.y + floatY}
              label={n.label}
              color={n.color}
              dim={n.dim}
              appearT={t}
              counterRotate={-rotateAll}
              interactive={interactive}
              hot={isHot || concerned}
              dimmed={dimmed}
              onMouseEnter={interactive ? () => setHoverNode(n.id) : undefined}
              onMouseLeave={interactive ? () => setHoverNode(h => h === n.id ? null : h) : undefined}
              onClick={interactive && onNodeClick ? () => onNodeClick(n) : undefined}
              tooltip={(() => {
                const head = `${n.label}${n.dist != null ? `  (depth ${n.dim ? 2 : 1})` : ''}`;
                const nb = neighborSummary(n.id);
                return nb ? `${head}\n\nLiens (${(edgesByNode[n.id]||[]).length}) :\n${nb}` : head;
              })()}
            />
          );
        })}
      </g>
    </svg>
  );
}

function CenterNode({ label, tick, counterRotate, tooltip }) {
  const pulse = 0.5 + 0.5 * Math.sin(tick * 2);
  return (
    <g>
      {tooltip && <title>{tooltip}</title>}
      <circle r={28} fill="var(--accent)" opacity={0.08 + pulse * 0.06}/>
      <circle r={20} fill="var(--accent)" opacity={0.18}/>
      <circle r={13} fill="var(--accent)"/>
      <text
        y={5}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="600"
        fill="var(--ink)"
        transform={`rotate(${counterRotate})`}
      >
        {label}
      </text>
    </g>
  );
}

function NodeBubble({ x, y, label, color, dim, appearT, counterRotate,
                     interactive = false, hot = false, dimmed = false,
                     onMouseEnter, onMouseLeave, onClick, tooltip }) {
  const c = `var(--${color})`;
  // Hot = boost taille + opacité ; dimmed = recule visuellement.
  // Bulles plus grosses en mode interactif (LIVE) — viewBox étendu.
  const baseR = (dim ? 7 : 12) * (interactive ? 1 : 0.75);
  const r = (hot ? baseR * 1.35 : baseR) * appearT;
  const fontSize = (dim ? 11 : 13) + (hot ? 2 : 0);
  const opacity = dimmed ? 0.25 : appearT;
  // Tronque les labels très longs pour limiter le chevauchement.
  // Le tooltip natif (title) garde la version complète.
  const shownLabel = (label && label.length > 22)
    ? label.slice(0, 21) + '…'
    : label;
  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={opacity}
      data-node-bubble={interactive ? '1' : undefined}
      style={{
        cursor: interactive && onClick ? 'pointer' : (interactive ? 'default' : 'inherit'),
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {tooltip && <title>{tooltip}</title>}
      {/* Hitbox transparente pour faciliter hover/clic */}
      {interactive && (
        <circle r={Math.max(r + 8, 14)} fill="transparent" />
      )}
      <circle r={r + (hot ? 8 : 5)} fill={c} opacity={hot ? 0.28 : 0.12}/>
      <circle r={r} fill={c} stroke={hot ? '#fff' : 'none'} strokeWidth={hot ? 1.5 : 0}/>
      <g transform={`rotate(${counterRotate})`} style={{ pointerEvents: 'none' }}>
        <text
          y={r + fontSize + 4}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={fontSize}
          fontWeight={hot ? 700 : (dim ? 400 : 600)}
          fill="var(--ink)"
          opacity={dim && !hot ? 0.7 : 1}
          style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3, strokeLinejoin: 'round' }}
        >
          {shownLabel}
        </text>
      </g>
    </g>
  );
}

function ChatView({ userText, streamText, phase }) {
  const scrollRef = useRefHero(null);
  useEffectHero(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamText]);

  return (
    <div ref={scrollRef} style={{
      flex: 1,
      padding: '16px 18px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {userText && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            maxWidth: '85%',
            padding: '8px 12px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 13,
            lineHeight: 1.45,
          }}>
            {userText}
            {phase === 'typing' && (
              <span style={{
                display: 'inline-block',
                width: 2, height: 13,
                background: 'var(--bg)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'hero-caret 0.7s steps(2) infinite',
              }}/>
            )}
          </div>
        </div>
      )}

      {(phase === 'streaming' || phase === 'done') && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0,
            borderRadius: 6, marginTop: 2,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <JDMMark size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {streamText.length === 0 ? (
              <TypingDots />
            ) : (
              <div style={{
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.55,
              }} dangerouslySetInnerHTML={{ __html: renderStreamMd(streamText, phase === 'streaming') }}/>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes hero-caret { 50% { opacity: 0; } }
        @keyframes hero-typing {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--ink-3)',
          animation: `hero-typing 1.2s infinite ${i * 0.15}s`,
        }}/>
      ))}
    </div>
  );
}

function renderStreamMd(s, withCaret) {
  let html = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.88em;color:var(--accent);">$1</code>')
    .replace(/\n• /g, '<br/><span style="color:var(--accent);">•</span> ')
    .replace(/\n/g, '<br/>');
  if (withCaret) {
    html += '<span style="display:inline-block;width:2px;height:1em;background:var(--accent);margin-left:2px;vertical-align:text-bottom;animation:hero-caret 0.7s steps(2) infinite;"></span>';
  }
  return html;
}

window.HeroAnimation = HeroAnimation;

// === webapp/views-projet.jsx ===
// === webapp/views-projet.jsx ===
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
  { id: 'contexte', label: 'Projet',            symbol: '♣' },
  { id: 'hero',     label: 'Présentation',      symbol: '♥' },
  { id: 'modules',  label: 'Modules',           symbol: '♦' },
  { id: 'bref',     label: 'Sous le capot',     symbol: '♠' },
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

  // External nav hook : let other components (e.g. the topbar wordmark)
  // jump to a specific panel via window.dispatchEvent.
  useEffect(() => {
    const onPanel = (e) => {
      const i = e.detail?.index;
      if (typeof i === 'number') goToIndex(i);
    };
    window.addEventListener('jdm:projet-panel', onPanel);
    return () => window.removeEventListener('jdm:projet-panel', onPanel);
  }, [goToIndex]);

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
    { label: 'Agents Jarvis',  value: '5',      sub: 'guidés'        },
  ];

  // Features
  const features = [
    {
      id: 'jarvis',
      title: '🤖 Jarvis',
      kind: '5 agents',
      primary: true,
      desc: 'Agents guidés par formulaires (zéro prompt à taper) : Enrichissement (.enrich), Audit (.audit), Détection de trous, Signalement (.err), Statistiques.',
      example: 'enrichissement → 17 triplets consolidés',
      detail: {
        lede: 'Cinq workflows agentiques guidés par formulaire — pas de prompt à écrire, l\'enchaînement outils + LLM + consolidation est canonique.',
        body: 'Chaque agent suit un workflow déterministe (defined-in-code) avec un budget de tokens, un budget d\'outils et un critère d\'arrêt. Le LLM ne décide jamais seul de continuer ; il propose, le moteur consolide ou rejette.',
        quickTry: {
          kind: 'select-and-term',
          options: [
            { value: 'enrich', label: 'Enrichissement' },
            { value: 'audit', label: 'Audit sémantique' },
            { value: 'gap', label: 'Détection de trous' },
            { value: 'signalement', label: 'Signalement' },
            { value: 'stats', label: 'Stats' },
          ],
          defaultValue: 'enrich',
          termDefault: 'voiture',
          // Quick-try Jarvis : hit /api/jarvis/{flow}/stream et capte
          // les 1res messages SSE (~5s) pour montrer un vrai démarrage,
          // sans laisser tourner le flow complet (budget min).
          mock: async (flow, term) => {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 8000);
            try {
              const r = await fetch(`api/jarvis/${flow}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  params: { term, target_count: 5, budget_label: '10', model: 'gemini-3.1-flash-lite' }
                }),
                signal: ctrl.signal,
              });
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const reader = r.body.getReader();
              const dec = new TextDecoder();
              let received = '', events = 0;
              while (events < 3) {
                const { done, value } = await reader.read();
                if (done) break;
                received += dec.decode(value);
                events = (received.match(/event:/g) || []).length;
              }
              try { await reader.cancel(); } catch {}
              const headlineMatch = received.match(/event: headline\s*\ndata: ({.*})/);
              const headline = headlineMatch ? JSON.parse(headlineMatch[1]).text : '(en cours)';
              return `→ Flow ${flow} démarré sur « ${term} »\n${headline}\n(${events} events SSE reçus, connexion fermée — ouvrir l'onglet Jarvis pour la suite)`;
            } finally {
              clearTimeout(timeoutId);
            }
          },
        },
      },
    },
    {
      id: 'chatbot',
      title: '💬 Chatbot LLM',
      kind: 'LLM · BYOK',
      desc: 'Conversation avec un agent (Gemini hébergé gratuit, ou BYOK Claude/GPT) qui n\'utilise QUE les outils JDM et cite ses sources.',
      example: '« Que mange typiquement un chat ? »',
      detail: {
        lede: 'Agent contraint à l\'usage exclusif des outils JDM. Toute affirmation factuelle est appuyée par un triplet cité.',
        body: 'Le modèle planifie en boucle (raisonnement → outil → observation) sans jamais répondre à partir de sa mémoire pré-entraînée seule. Si JDM ne couvre pas la question, l\'agent l\'explicite plutôt que d\'halluciner.',
        quickTry: {
          kind: 'prompt',
          placeholder: 'Que mange typiquement un chat ?',
          defaultValue: 'Que mange typiquement un chat ?',
          models: [
            { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash · gratuit' },
            { value: 'gemini-2.0-pro',        label: 'Gemini 2.0 Pro · BYOK' },
            { value: 'claude-4.5-sonnet',     label: 'Claude 4.5 Sonnet · BYOK' },
            { value: 'gpt-5-mini',            label: 'GPT-5 mini · BYOK' },
            { value: 'llama-4-70b',           label: 'Llama 4 70B · local' },
          ],
          defaultModel: 'gemini-3.1-flash-lite',
          // Quick-try Chatbot : appel SSE /api/chatbot/stream, capture les
          // premiers chunks de la réponse (~10s max) puis ferme.
          mock: async (q, model) => {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 12000);
            try {
              const r = await fetch('api/chatbot/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: q, model, use_thinking: false }),
                signal: ctrl.signal,
              });
              if (!r.ok) throw new Error(`HTTP ${r.status} — vérifier la clé API du modèle`);
              const reader = r.body.getReader();
              const dec = new TextDecoder();
              let buf = '', text = '', toolCalls = 0;
              const t0 = Date.now();
              while (Date.now() - t0 < 10000) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value);
                const re = /event:\s*(\w+)\s*\ndata:\s*({.*})/g;
                let m;
                while ((m = re.exec(buf)) !== null) {
                  try {
                    const d = JSON.parse(m[2]);
                    if (m[1] === 'chunk' && d.text) text += d.text;
                    else if (m[1] === 'tool') toolCalls++;
                  } catch {}
                }
                if (text.length > 400) break;
              }
              try { await reader.cancel(); } catch {}
              return `${model} (premiers ${text.length} chars, ${toolCalls} appels outils)\n\n${text.slice(0, 400)}${text.length > 400 ? '…' : ''}`;
            } finally {
              clearTimeout(tid);
            }
          },
        },
      },
    },
    {
      id: 'subgraph',
      title: '🕸️ Sous-graphe',
      kind: 'visuel',
      desc: 'Visualisation interactive (vis-network) du voisinage sémantique d\'un terme jusqu\'à profondeur 4, sélection de relations indépendante par niveau, négations en rouge.',
      example: 'plat asiatique · depth 1 · 8 relations',
      detail: {
        lede: 'Sous-graphe lexico-sémantique d\'un terme, filtré par relation et par profondeur — un instrument de lecture, pas seulement de visualisation.',
        body: 'Construit un HTML autonome (zéro requête externe) qui peut être archivé dans un dépôt de publication. Palette par famille de relation, négations marquées en rouge, opacité dégradée par profondeur.',
        quickTry: {
          kind: 'term-and-depth',
          termDefault: 'voiture',
          depthDefault: 2,
          // Quick-try Sous-graphe : appel /api/subgraph format=json,
          // affiche les compteurs réels nodes/edges/negatives.
          mock: async (term, depth) => {
            const r = await fetch('api/subgraph', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ term, depth, top_k: 3, format: 'json' }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            const s = d.stats || {};
            const n = s.n_nodes ?? (d.nodes?.length || 0);
            const e = s.n_edges ?? (d.edges?.length || 0);
            const neg = s.n_negative ?? 0;
            return `→ ${term} · depth=${depth}\n${n} nœuds · ${e} arêtes · ${neg} négations\nOuvrir l'onglet Sous-graphe pour le rendu interactif.`;
          },
        },
      },
    },
    {
      id: 'claim',
      title: '⚖️ Claim checker',
      kind: 'déterministe',
      desc: 'Vérifie une affirmation factuelle contre JDM de façon déterministe (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN avec citations des triplets utilisés.',
      example: 'baleine | r_isa | poisson → ❌',
      detail: {
        lede: 'Vérification déterministe d\'un triplet contre JDM — pas de LLM dans la boucle de jugement, le verdict est rejouable et auditable.',
        body: 'L\'effort de vérification est paramétrable (0 = match direct ; 1 = contenance ; 2+ = inférence transitive bornée). Chaque verdict est accompagné de la chaîne d\'évidence (triplets cités, poids).',
        quickTry: {
          kind: 'triplet',
          defaults: { s: 'baleine', r: 'r_isa', o: 'mammifère' },
          // Quick-try Claim checker : POST /api/factcheck avec effort=1
          // (déduction par inférence). Renvoie {verdict, confidence,
          // chain, note} comme attendu par ClaimVerdictHeader/Chain.
          mock: async (s, r, o) => {
            const resp = await fetch('api/factcheck', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subject: s, relation: r, object: o, effort: 1,
              }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const d = await resp.json();
            // Normalise le format pour les composants Verdict :
            //   d.status ∈ {SUPPORTED, CONTRADICTED, UNKNOWN}
            //   d.evidence: list[{subject, relation, target, weight, negative}]
            const chain = (d.evidence || []).map(ev => ({
              from: ev.subject || ev.source,
              rel:  ev.relation,
              to:   ev.target || ev.object,
              w:    Math.round(Math.abs(ev.weight || 0)),
              neg:  !!ev.negative,
            }));
            return {
              verdict: d.status || d.verdict || 'UNKNOWN',
              confidence: d.confidence ?? 0,
              triplet: { s, r, o },
              chain,
              note: d.explanation || d.note ||
                    (d.inference_schema ? `Inféré via schéma ${d.inference_schema}` : 'Contenance directe JDM'),
            };
          },
        },
      },
    },
    {
      id: 'explorer',
      title: '🔎 Explorer JDM',
      kind: 'instant',
      desc: 'Choisis un terme et une relation, vois les triplets triés par poids consensuel. Annotations sémantiques (constitutif, contrastif, exception…) optionnelles. Désambiguïsation des termes polysémiques (avocat, souris, police…).',
      example: 'chat | r_has_part | ?',
      detail: {
        lede: 'Table déterministe des triplets d\'un terme pour une relation — l\'instrument le plus simple pour inspecter JDM.',
        body: 'Tri par poids consensuel décroissant. Désambiguïsation polysémique optionnelle (avocat, souris, police…). Annotations sémantiques (constitutif, contrastif, exception).',
        quickTry: {
          kind: 'term-and-relation',
          termDefault: 'chat',
          relationDefault: 'r_has_part',
          // Quick-try Explorer : POST /api/explore et formate les 3
          // premiers triplets par poids décroissant.
          mock: async (term, rel) => {
            const r = await fetch('api/explore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                term, relation: rel, limit: 20, min_weight: 25
              }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            const triplets = d.triplets || d.relations || [];
            if (triplets.length === 0) {
              return `→ ${term} | ${rel} → aucun triplet (≥ poids 25). Essayer min_weight=0 ou un autre terme.`;
            }
            const top = triplets.slice(0, 3).map(t => {
              const tgt = t.target || t.target_display || t.to || '?';
              const w = t.w ?? t.weight ?? 0;
              return `${tgt} (w=${Math.round(Math.abs(w))})`;
            }).join(' · ');
            return `→ ${term} | ${rel} → ${triplets.length} triplets\nTop 3 : ${top}`;
          },
        },
      },
    },
  ];

  const briefs = [
    {
      title: 'Client typé + cache disque',
      body: <>Couche client <code>JDMClient</code> sur l&apos;<a href="https://jdm-api.demo.lirmm.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>API JeuxDeMots</a>, cache disque, retry exponentiel.</>,
      // ── Detail panel content ─────────────────────────────────────────
      detail: {
        kicker: 'Reproductibilité · Abstraction typée',
        lede: 'Une couche d\'abstraction Python entre l\'agent et l\'API JeuxDeMots — pas un wrapper trivial, mais un substrat qui rend les workflows agentiques auditables, déterministes et rejouables.',
        paragraphs: [
          <>Les <em>workflows agentiques</em> souffrent classiquement d&apos;un problème de reproductibilité : un même prompt produit des appels API distincts à chaque exécution, rendant l&apos;audit et la régression difficiles. Le client typé matérialise chaque réponse JDM en objet Python (<code>Term</code>, <code>Relation</code>, <code>Triplet</code>), sérialisé sur disque dans un cache LRU adressé par hash de requête.</>,
          <>Cette indirection ouvre trois bénéfices : <strong>hors-ligne</strong> (un workflow déjà exécuté peut être rejoué sans accès réseau), <strong>idempotence</strong> (deux runs du même flow produisent strictement le même artefact), <strong>traçabilité</strong> (chaque triplet consolidé pointe vers la requête API qui l&apos;a produit, avec timestamp et version du cache).</>,
        ],
        citations: [
          { author: 'Lafourcade, M.', year: 2007, title: 'Making people play for Lexical Acquisition with the JeuxDeMots prototype', venue: 'SNLP\'07, Pattaya' },
          { author: 'Schick, T. et al.', year: 2023, title: 'Toolformer: Language Models Can Teach Themselves to Use Tools', venue: 'NeurIPS' },
          { author: 'Anthropic', year: 2024, title: 'Model Context Protocol — Specification', venue: 'Technical Report' },
        ],
        cta: { label: 'Voir le client sur GitHub →', href: 'https://github.com/expAg/JDMAgent' },
      },
    },
    {
      title: '~35 outils MCP exposés',
      body: <>À n&apos;importe quel client (Claude Code/Desktop, Cursor, etc.) via <a href="https://github.com/jlowin/fastmcp" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>FastMCP</a>.</>,
      detail: {
        kicker: 'Interopérabilité · Outils standardisés',
        lede: 'Le Model Context Protocol comme standard d\'accès à une base de connaissance lexico-sémantique — une trentaine d\'outils typés exposés à tout client compatible (Claude Code, Claude Desktop, Cursor, OpenAI Realtime…).',
        paragraphs: [
          <>L&apos;exposition MCP transforme JeuxDeMots d&apos;une API REST traditionnelle en un <em>knowledge backend</em> consultable nativement par les agents LLM. Chaque outil porte une <strong>signature typée</strong> (Pydantic) et une <strong>docstring discriminante</strong> — le LLM choisit l&apos;outil par similarité sémantique sans heuristique côté serveur.</>,
          <>Le découpage suit la sémantique JDM, pas l&apos;API : <code>get_relations(term, relation_type)</code> plutôt qu&apos;un endpoint paramétrique générique. Cela réduit l&apos;espace de décision du modèle et accroît la précision du tool-calling — un effet documenté par <em>Patil et al. (2024)</em> dans l&apos;évaluation de Gorilla.</>,
        ],
        citations: [
          { author: 'Patil, S.G. et al.', year: 2024, title: 'Gorilla: Large Language Model Connected with Massive APIs', venue: 'NeurIPS' },
          { author: 'Yao, S. et al.', year: 2023, title: 'ReAct: Synergizing Reasoning and Acting in Language Models', venue: 'ICLR' },
          { author: 'Lafourcade, M. & Joubert, A.', year: 2008, title: 'Une approche lexico-sémantique du jeu pour l\'acquisition de connaissances', venue: 'TALN' },
        ],
        cta: { label: 'Lire l\'USAGE MCP →', href: 'https://github.com/expAg/JDMAgent/blob/main/USAGE.md' },
      },
    },
    {
      title: 'Pipeline fact-check + inférence',
      body: <>Détermination + détection de gaps + <strong>moteur d&apos;inférence symbolique borné</strong> pour la consolidation des candidats avant soumission au canal contributif LLMDrops de JDM.</>,
      detail: {
        kicker: 'Neuro-symbolique · Consolidation',
        lede: 'Au cœur du projet : un pipeline neuro-symbolique qui mobilise un LLM pour proposer des connaissances, puis un moteur d\'inférence borné pour vérifier, contraindre et consolider avant écriture dans la base.',
        paragraphs: [
          <>L&apos;agent illustre une instance pragmatique de l&apos;<em>approche neuro-symbolique</em> formalisée par <strong>Garcez & Lamb (2020)</strong> : le LLM joue le rôle de <em>générateur sous-contraint</em> (créativité, formulation, désambiguïsation), tandis que le moteur d&apos;inférence sur la base JDM joue le rôle de <em>vérificateur formel</em> (cohérence, antonymie, transitivité bornée).</>,
          <>La consolidation procède en trois passes : <strong>(i) génération</strong> — le modèle propose <code>n</code> triplets candidats pour un terme cible ; <strong>(ii) vérification</strong> — chaque candidat est soumis au claim-checker déterministe (chaîne d&apos;inférence ≤ k, contradiction explicite, sub-graphe d&apos;évidence) ; <strong>(iii) annotation</strong> — les triplets survivants sont étiquetés (légitime, contrastif, sens-spécifique) puis sérialisés dans le format de soumission JDM (canal LLMDrops).</>,
          <>Cette architecture évite à la fois l&apos;écueil des <em>hallucinations symboliques pures</em> (génération sans LLM = peu inventive) et celui des <em>hallucinations neurales</em> (LLM sans contrôle symbolique = injection de bruit dans la base).</>,
        ],
        citations: [
          { author: 'd\'Avila Garcez, A. & Lamb, L.C.', year: 2020, title: 'Neurosymbolic AI: The 3rd Wave', venue: 'arXiv:2012.05876' },
          { author: 'Hitzler, P. & Sarker, M.K.', year: 2021, title: 'Neuro-Symbolic Artificial Intelligence: The State of the Art', venue: 'IOS Press' },
          { author: 'Marcus, G.', year: 2020, title: 'The Next Decade in AI: Four Steps Towards Robust AI', venue: 'arXiv:2002.06177' },
          { author: 'Pan, S. et al.', year: 2024, title: 'Unifying Large Language Models and Knowledge Graphs: A Roadmap', venue: 'IEEE TKDE' },
        ],
        cta: { label: 'Comprendre le pipeline →', href: 'https://github.com/expAg/JDMAgent/blob/main/docs/pipeline.md' },
      },
    },
    {
      title: 'Sous-graphe HTML autonome',
      body: <>vis-network avec sélection de relations par niveau, palette par famille de relation, opacité progressive.</>,
      detail: {
        kicker: 'Explicabilité · Graphes lexico-sémantiques',
        lede: 'Visualisation du voisinage sémantique comme outil d\'explicabilité : le chercheur ou le contributeur voit pourquoi un triplet a été retenu ou rejeté, sans relancer l\'agent.',
        paragraphs: [
          <>JeuxDeMots compte ~2 millions de termes et 180+ relations typées et pondérées (<em>Lafourcade, 2007</em>). Naviguer ce graphe à profondeur ≥ 2 sans filtrage produit des sous-graphes hyper-denses inutilisables visuellement (densité moyenne &gt; 80 arcs/nœud sur les termes-vedettes).</>,
          <>Le module construit un sous-graphe avec <strong>sélection indépendante par profondeur</strong> et <strong>palette par famille de relation</strong> — choix de design issus des conventions de visualisation de graphes lexicaux (<em>Crouch et al., 2019</em>). L&apos;HTML produit est <strong>autonome</strong> (zéro requête externe) pour rester archivable dans un dépôt de publication.</>,
        ],
        citations: [
          { author: 'Lafourcade, M.', year: 2007, title: 'Making people play for Lexical Acquisition', venue: 'SNLP\'07' },
          { author: 'Crouch, R. et al.', year: 2019, title: 'Lexical Semantics in the Age of LLMs', venue: 'CL Journal' },
          { author: 'Almeida, A. & Lafourcade, M.', year: 2015, title: 'Sentiment polarity and term relevance in JeuxDeMots', venue: 'LREC' },
        ],
        cta: { label: 'Ouvrir le module Sous-graphe →', goto: 'subgraph' },
      },
    },
  ];

  // ── Briefs « Cadre théorique » — Panneau 4 ───────────────────────────
  // Cinq cartes qui résument le positionnement du projet : la ressource
  // JeuxDeMots, le projet d'agentification, et les trois enjeux clés
  // (garde-fous symboliques, explicabilité, orchestration multi-agents).
  // Chaque carte suit le même schéma que `briefs` (title, body, detail
  // {kicker, lede, paragraphs, citations}) — donc rendu via le même
  // composant ExpandableBriefsGrid.
  const briefsContexte = [
    {
      title: 'Présentation de JeuxDeMots',
      body: <>Réseau lexico-sémantique du français (LIRMM/CNRS, depuis 2007) : ~2 M nœuds, 180+ relations typées <strong>pondérées et orientées</strong>, avec des garde-fous internes (inverses, contradictions, inférences).</>,
      detail: {
        kicker: 'Ressource · Réseau lexico-sémantique',
        lede: 'JDM construit une vaste base de connaissances, de sens commun comme de spécialité, à l\'aide de jeux, de la contribution collective et de mécanismes d\'inférence.',
        paragraphs: [
          <>Le réseau repose sur des relations typées (lexicales, sémantiques, ontologiques, rôles sémantiques, etc.), <strong>orientées et pondérées</strong> : le poids reflète la force d&apos;association entre deux termes.</>,
          <>Deux caractéristiques le rendent particulièrement intéressant pour un usage symbolique. D&apos;abord, un <strong>poids négatif y exprime une impossibilité</strong>, et certains nœuds distinguent les différents usages d&apos;un même terme (par exemple « avocat » fruit ou justice). Ensuite, la base intègre des garde-fous internes : la redondance entre relations inverses permet de <strong>détecter automatiquement des contradictions</strong>, et un module d&apos;inférence enrichit le réseau tout en signalant les anomalies.</>,
          <>JDM offre ainsi un substrat structuré, vérifiable et déjà partiellement auto-correcteur.</>,
        ],
        citations: [
          { author: 'Lafourcade, M.', year: 2007, title: 'Making people play for Lexical Acquisition with the JeuxDeMots prototype', venue: 'SNLP\'07, Pattaya' },
          { author: 'Lafourcade, M. & Le Brun, N.', year: 2020, title: 'JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d\'inférences', venue: 'Lexique, 27, 47-86' },
        ],
        cta: { label: 'Site officiel JeuxDeMots →', href: 'https://www.jeuxdemots.org' },
      },
    },
    {
      title: 'Le projet d\'agentification',
      body: <>Intégrer JDM dans une architecture <strong>neuro-symbolique</strong> où il coopère avec des IA génératives — non plus ressource consultée, mais agent actif qui <em>propose, conteste et arbitre</em>.</>,
      detail: {
        kicker: 'Architecture · Neuro-symbolique',
        lede: 'Le composant neuronal (LLM) apporte la flexibilité, la couverture lexicale et la capacité langagière ; la couche symbolique (le réseau et son moteur d\'inférence) apporte la rigueur logique, la traçabilité et la correction.',
        paragraphs: [
          <>L&apos;idée directrice est la <strong>complémentarité des deux paradigmes</strong>. Dans ce schéma, JDM n&apos;est plus une simple ressource consultée, mais un agent actif qui propose, conteste et arbitre.</>,
          <>Trois finalités structurent la coopération : <strong>découvrir</strong> de nouvelles connaissances, les <strong>contrôler</strong>, puis les <strong>consolider</strong>.</>,
          <>Les trois enjeux clés de cette agentification sont détaillés dans les cartes suivantes : la sécurisation des apports des LLM, l&apos;explicabilité comme outil de diagnostic, et l&apos;orchestration des agents.</>,
        ],
        citations: [
          { author: 'Magana Vsevolodovna, R. I. et al.', year: 2025, title: 'Enhancing Large Language Models through Neuro-Symbolic Integration and Ontological Reasoning', venue: 'arXiv:2504.07640' },
        ],
      },
    },
    {
      title: 'LLM contributeurs & garde-fous symboliques',
      body: <>Faire générer des relations candidates par un LLM est utile mais risqué. La solution : <strong>valider chaque apport par une couche symbolique</strong> — graphe de connaissances comme vérificateur d&apos;exactitude.</>,
      detail: {
        kicker: 'Enjeu 1 · Sécurisation',
        lede: 'À l\'inverse des LLM, un graphe de connaissances offre une exactitude vérifiée et évite les hallucinations. Le LLM produit, le symbolique valide.',
        paragraphs: [
          <>L&apos;approche <strong>ATA</strong> illustre ce principe : le LLM traduit une spécification informelle en base formelle vérifiable, ce qui permet d&apos;écarter les hallucinations en amont. Un <em>raisonneur ontologique</em> peut ensuite détecter les incohérences, puis renvoyer au LLM une explication corrective dans une <strong>boucle itérative</strong>.</>,
          <>Au niveau des relations elles-mêmes, <strong>OMNIA</strong> enchaîne génération de candidats et double validation, par plongements puis par LLM.</>,
          <>Ce contrôle est d&apos;autant plus nécessaire dans JDM qu&apos;<strong>une erreur initiale peut s&apos;y propager par inférence</strong> en erreurs secondaires.</>,
        ],
        citations: [
          { author: 'Peer, D. & Stabinger, S.', year: 2025, title: 'ATA: A Neuro-Symbolic Approach to Implement Autonomous and Trustworthy Agents', venue: 'arXiv:2510.16381' },
          { author: 'Magana Vsevolodovna, R. I. et al.', year: 2025, title: 'Enhancing Large Language Models through Neuro-Symbolic Integration and Ontological Reasoning', venue: 'arXiv:2504.07640' },
          { author: 'OMNIA', year: 2026, title: 'Closing the Loop by Leveraging LLMs for Knowledge Graph Completion', venue: 'arXiv:2603.11820' },
          { author: 'Lafourcade, M. & Le Brun, N.', year: 2020, title: 'JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d\'inférences', venue: 'Lexique, 27, 47-86' },
        ],
      },
    },
    {
      title: 'Explicabilité : « trous » & « bosses »',
      body: <>L&apos;explicabilité est l&apos;<strong>outil de diagnostic</strong> de la base. Elle révèle deux défauts : la <em>complétion</em> vise les connaissances manquantes (trous), la <em>détection d&apos;erreurs</em> les assertions fausses (bosses).</>,
      detail: {
        kicker: 'Enjeu 2 · Diagnostic',
        lede: 'Un système neuro-symbolique permet de remonter à la règle exacte qui a conduit à une décision, même si la fidélité de ces explications reste un défi ouvert.',
        paragraphs: [
          <>Deux défauts sont bien identifiés dans la littérature : la <strong>complétion</strong> (Paulheim, 2017) cible les connaissances manquantes, et la <strong>détection d&apos;erreurs</strong> les assertions fausses. Ce sont les <em>« trous » (lacunes)</em> et les <em>« bosses » (informations présentes mais erronées ou mal classées)</em>.</>,
          <>Leur traitement s&apos;organise en trois étapes : <strong>détecter, corriger, puis raisonner malgré l&apos;incohérence</strong>. À l&apos;inférence, un raisonneur peut tester chaque prédiction et filtrer celles qui produisent une incohérence logique.</>,
          <>JDM amorce déjà cette boucle : l&apos;IA qui examine le réseau repère les problèmes et propose des parties pour les résoudre.</>,
        ],
        citations: [
          { author: 'Herron, D., Jiménez-Ruiz, E. & Weyde, T.', year: 2025, title: 'On the Potential of Logic and Reasoning in Neurosymbolic Systems Using OWL-Based Knowledge Graphs', venue: 'Neurosymbolic AI / SAGE' },
          { author: 'Paulheim, H.', year: 2017, title: 'Knowledge Graph Refinement: A Survey of Approaches and Evaluation Methods', venue: 'Semantic Web Journal' },
          { author: 'Survey', year: 2025, title: 'Dealing with Inconsistency for Reasoning over Knowledge Graphs', venue: 'arXiv:2502.19023' },
          { author: 'Lafourcade, M. & Le Brun, N.', year: 2020, title: 'JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d\'inférences', venue: 'Lexique, 27, 47-86' },
        ],
      },
    },
    {
      title: 'Collaboration, compétition, orchestration',
      body: <>La co-construction multi-agents repose sur trois régimes : <strong>compétition, collaboration, coordination</strong>. Multiplier les agents n&apos;améliore pas mécaniquement la performance — il faut un orchestrateur.</>,
      detail: {
        kicker: 'Enjeu 3 · Orchestration',
        lede: 'Les gains du multi-agents ne sont pas automatiques : multiplier les agents n\'améliore pas forcément la performance, et un débat mal structuré peut enfermer le groupe dans une erreur commune.',
        paragraphs: [
          <>Pour la construction de graphes, <strong>CooperKGC</strong> (Ye et al., 2023) montre qu&apos;une équipe d&apos;agents spécialisés, travaillant par tours successifs, améliore la sélection et la correction des connaissances. La compétition entre modèles doit néanmoins être encadrée : il faut <strong>écarter les associations qui amplifient les erreurs</strong>.</>,
          <>L&apos;orchestration la plus avancée vise une <strong>synergie cognitive</strong> : dans <strong>OSC</strong> (Zhang et al., 2025), chaque agent modélise l&apos;état de ses collaborateurs et adapte ses échanges pour réduire la redondance avant de converger.</>,
          <>Pour JDM, cela suggère trois rôles : des agents qui <strong>génèrent</strong> (découverte), des agents critiques qui <strong>mettent à l&apos;épreuve</strong> (exposition des « bosses »), et un <strong>orchestrateur symbolique</strong> qui arbitre par l&apos;inférence et les pondérations.</>,
        ],
        citations: [
          { author: 'Preprint', year: 2025, title: 'Multi-Agent LLM Systems: From Emergent Collaboration to Structured Collective Intelligence', venue: 'Preprints.org 202511.1370' },
          { author: 'Ye, H. et al.', year: 2023, title: 'Beyond Isolation: Multi-Agent Synergy for Improving Knowledge Graph Construction (CooperKGC)', venue: 'arXiv:2312.03022' },
          { author: 'Survey', year: 2025, title: 'Multi-LLM Collaboration Strategy', venue: '2025' },
          { author: 'Zhang, J. et al.', year: 2025, title: 'OSC: Cognitive Orchestration through Dynamic Knowledge Alignment in Multi-Agent LLM Collaboration', venue: 'arXiv:2509.04876' },
        ],
      },
    },
  ];

  // Largeur de chaque panneau dans la track horizontale = 1/N de la track.
  // Auparavant hardcodée à 33.3333% (3 panneaux). Maintenant calculée pour
  // suivre `totalPanels` automatiquement quand on en ajoute/retire.
  const panelBasis = `${100 / totalPanels}%`;

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
          {/* ── Panneau 1 — Projet (briefs problématique / cadre théorique) ── */}
          <CarouselPanel flexBasis={panelBasis}>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}>
              <SectionTitle
                kicker="Projet"
                title="Le projet en bref"
                desc={"Cadre neuro-symbolique d'agentification du réseau lexico-sémantique JeuxDeMots, articulant la générativité des LLM et la validation par inférence symbolique, pour la découverte, le contrôle explicable et la consolidation coopérative d'une base de connaissances de sens commun — l'explicabilité y opérant à la fois comme garde-fou contre l'hallucination et comme instrument de diagnostic des lacunes et des erreurs du réseau."}
              />
              <ExpandableBriefsGrid briefs={briefsContexte} goto={goto} />
            </div>
          </CarouselPanel>{/* ── Panneau 2 — Présentation (centre, entrée) ── */}
          <CarouselPanel flexBasis={panelBasis}>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(20px, 3vh, 36px)',
            }}>
              <HeroAnimation height={Math.min(320, Math.round(window.innerHeight * 0.34))} />

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
                    <Button variant="secondary" onClick={() => goto('chatbot')}>Discuter avec JDM</Button>
                    <Button variant="secondary" onClick={() => goto('subgraph')}>Visualiser</Button>
                    <Button variant="secondary" onClick={() => goto('explorer')}>Explorer</Button>
                  </div>
                </div>

                <StatsGrid stats={stats} />
              </div>
            </div>
          </CarouselPanel>

          {/* ── Panneau 3 — Modules (droite / bas) ── */}
          <CarouselPanel flexBasis={panelBasis}>
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
              <ExpandableFeaturesPanel features={features} goto={goto} />
            </div>
          </CarouselPanel>

          {/* ── Panneau 4 — Sous le capot (droite) ── */}
          <CarouselPanel flexBasis={panelBasis}>
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

              <ExpandableBriefsGrid briefs={briefs} goto={goto} />

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
          </CarouselPanel>

        </div>
      </div>
    </>
  );
}

// ─── Wrapper pour chaque panneau dans le carousel ───
// flex 1/N de la track (en main axis), padding uniforme.
function CarouselPanel({ children, flexBasis = '33.3333%' }) {
  return (
    <div style={{
      flex: `0 0 ${flexBasis}`,
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 28px 110px',
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
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
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
        opacity: 0.5,
        transition: 'opacity 0.22s ease-out',
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
function FeaturesGrid({ features, onCardClick, expandedId }) {
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
            <FeatureCard f={f} onClick={() => onCardClick(f.id)} hoverColor={colors[i]} selected={expandedId === f.id} />
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

function FeatureCard({ f, onClick, hoverColor, selected }) {
  const [hovering, setHovering] = useState(false);
  const primary = !!f.primary;

  const bg = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : 'var(--bg-card)';
  const inkColor = primary ? 'var(--bg)' : 'var(--ink)';
  const ink2Color = primary ? 'rgba(255,255,255,0.88)' : 'var(--ink-2)';
  const ink3Color = primary ? 'rgba(255,255,255,0.72)' : 'var(--ink-3)';
  const borderColor = selected
    ? 'var(--accent)'
    : primary
      ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
      : (hovering ? hoverColor : 'var(--line)');
  const shadow = selected
    ? '0 8px 22px -10px var(--accent)'
    : hovering
      ? (primary
          ? '0 10px 24px -10px var(--accent)'
          : `0 6px 18px -8px ${hoverColor}`)
      : 'none';

  return (
    <div
      onClick={onClick}
      className="focus-ring"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick && onClick(); }}
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

// ───────── Scroll helper — centers a card+detail group in its scroll parent.
// Walks up to the closest overflowing ancestor and animates scrollTo there.
// (Avoids scrollIntoView, which behaves unpredictably across our layout.)
function findScrollableParent(el) {
  let p = el && el.parentElement;
  while (p) {
    const cs = getComputedStyle(p);
    // Accept any auto/scroll ancestor — don't require scrollHeight>clientHeight
    // (the overflow only appears AFTER the detail panel expands).
    if (/(auto|scroll)/.test(cs.overflowY)) return p;
    p = p.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

// Custom rAF-driven smooth scroll. Runs in parallel with the panel's
// grid-template-rows animation so the two motions feel like a single
// coordinated gesture — no waiting, no jank.
//   topEl       : top of the group (the card)
//   extraHeight : natural height of the detail content (measured separately)
//   gap         : px between card and detail (matches CSS gap)
//   duration    : ms; ease = easeInOutCubic
function scrollGroupIntoView(topEl, detailEl, gap = 18, duration = 520) {
  if (!topEl) return;
  const scroller = findScrollableParent(topEl);
  if (!scroller) return;
  // Detail's natural height — measure the inner content (which is not
  // affected by the grid-template-rows animation).
  const contentEl = detailEl && detailEl.querySelector('[data-detail-content]');
  const extraHeight = contentEl ? contentEl.getBoundingClientRect().height : 0;

  const sRect = scroller.getBoundingClientRect();
  const tRect = topEl.getBoundingClientRect();
  const topInScroll = tRect.top - sRect.top + scroller.scrollTop;
  // 2 modes :
  //   - panel briefs/features : on a un detailEl avec extraHeight > 0 →
  //     groupHeight = topEl + gap + detail → on CENTRE le groupe entier
  //     dans la viewport. C'est ce que veut la carte expandable.
  //   - viz subgraph : topEl == detailEl (= le wrapper viz) sans
  //     data-detail-content → extraHeight == 0 → on ne CENTRE PAS la
  //     hauteur du panneau (qui mesure 800px+ et scrollerait trop
  //     loin), on aligne juste son haut sur le haut de la viewport
  //     avec une petite marge (24px).
  // Compense le topbar sticky (56px de hauteur — voir TopBar dans
  // shared.jsx) quand le scroller est la page entière. Sans ça, le
  // top du target finit caché sous le topbar (« scrolle trop loin »).
  const isPageScroll = scroller === document.scrollingElement || scroller === document.documentElement;
  const topbarH = isPageScroll ? 56 : 0;
  let target;
  if (extraHeight > 0) {
    const groupHeight = tRect.height + gap + extraHeight;
    const center = topInScroll + groupHeight / 2;
    target = Math.max(0, center - scroller.clientHeight / 2);
  } else {
    target = Math.max(0, topInScroll - 24 - topbarH);
  }

  const start = scroller.scrollTop;
  if (Math.abs(target - start) < 2) return;
  const t0 = performance.now();
  const ease = (t) => (t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    scroller.scrollTop = start + (target - start) * ease(t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ───────── Expandable features panel (Modules) ─────────
// Click a card → inline DetailPanel below the carousel with the expanded
// description, an "Aller à <module>" CTA, and a small quick-try widget.
function ExpandableFeaturesPanel({ features, goto }) {
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);
  const expanded = expandedId ? features.find(f => f.id === expandedId) : null;
  const gridRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    if (!expandedId) return;
    // Measure & scroll on next frame — refs are in place, panel content
    // has its natural size (only the row animation clips it visually).
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(gridRef.current, detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div ref={gridRef}>
        <FeaturesGrid features={features} onCardClick={toggle} expandedId={expandedId} />
      </div>
      <div ref={detailRef}>
        <FeatureDetailPanel f={expanded} goto={goto} onClose={() => setExpandedId(null)} />
      </div>
    </div>
  );
}

function FeatureDetailPanel({ f, goto, onClose }) {
  // Keep last truthy f around so the panel can finish its close animation
  // before content unmounts. Ref so the value is committed SYNCHRONOUSLY
  // — fixes the first-click case where the scroll measurement would happen
  // before content had a natural height.
  const lastFRef = useRef(null);
  if (f) lastFRef.current = f;
  const [, forceRender] = useReducer(x => x + 1, 0);
  const open = !!f;
  const shown = lastFRef.current;
  return (
    <div
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && lastFRef.current) {
          lastFRef.current = null;
          forceRender();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.32s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s',
        opacity: open ? 1 : 0,
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {shown && (
          <div data-detail-content style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            gap: 28,
            position: 'relative',
          }}>
            <button
              onClick={onClose}
              aria-label="Refermer le panneau"
              className="focus-ring"
              style={{
                position: 'absolute',
                top: 12, right: 12,
                background: 'transparent', border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                width: 26, height: 26, padding: 0,
                color: 'var(--ink-3)', cursor: 'pointer',
                fontSize: 14, lineHeight: 1,
                zIndex: 2,
              }}>×</button>
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, marginBottom: 12,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  fontWeight: 600,
                }}>
                  {shown.title} · détail
                </div>
              </div>
              <p className="display" style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
                color: 'var(--ink)', lineHeight: 1.25,
                marginBottom: 12,
              }}>{shown.detail?.lede}</p>
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6,
                color: 'var(--ink-2)',
                marginBottom: 18,
              }}>{shown.detail?.body}</p>
              <Button onClick={() => goto(shown.id)}>Aller au module {shown.title.replace(/^[^\s]+\s/, '')} →</Button>
            </div>
            <div>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                marginBottom: 8,
              }}>Essai rapide</div>
              <ModuleQuickTryAndCli moduleId={shown.id} config={shown.detail?.quickTry} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───── Inline quick-try widget per module ─────────────────────────────
// Formulaire « contrôlé » : le state du form vit dans le parent
// (ModuleQuickTryAndCli) pour qu'il soit partagé avec la CliTerminalBlock
// (le bouton ▶ play). Le bouton du QT lui-même ne fait plus de fetch —
// il navigue vers la vue du module (event jdm:goto) et laisse l'API
// call au play ▶ de la CliTerminalBlock juste en-dessous.
function ModuleQuickTry({ config, form, setForm, onNavigate, onRunInline }) {
  if (!config) return null;
  switch (config.kind) {
    case 'select-and-term':
      return <QTSelectAndTerm config={config} form={form} setForm={setForm} onNavigate={onNavigate} />;
    case 'prompt':
      return <QTPrompt config={config} form={form} setForm={setForm} onNavigate={onNavigate} />;
    case 'term-and-depth':
      return <QTTermAndDepth config={config} form={form} setForm={setForm} onNavigate={onNavigate} />;
    case 'triplet':
      // Cas spécial INLINE — pas de navigation, on appelle l'API sur place
      // et on affiche la verdict dans le panneau du form.
      return <QTTriplet config={config} form={form} setForm={setForm} onRunInline={onRunInline} />;
    case 'term-and-relation':
      return <QTTermAndRelation config={config} form={form} setForm={setForm} onNavigate={onNavigate} />;
    default:
      return null;
  }
}

// Initialise le state du form à partir des defaults du config — keyé
// par config.kind. Renvoie {} si pas de config.
function initFormState(config) {
  if (!config) return {};
  switch (config.kind) {
    case 'select-and-term':
      return { flow: config.defaultValue, term: config.termDefault };
    case 'prompt':
      return { q: config.defaultValue, model: config.defaultModel || (config.models?.[0]?.value) };
    case 'term-and-depth':
      return { term: config.termDefault, depth: config.depthDefault };
    case 'triplet':
      return { s: config.defaults.s, r: config.defaults.r, o: config.defaults.o };
    case 'term-and-relation':
      return { term: config.termDefault, rel: config.relationDefault };
    default:
      return {};
  }
}

// Convertit le form state en ordre d'arguments attendu par config.mock.
function formToArgs(form, kind) {
  switch (kind) {
    case 'select-and-term':   return [form.flow, form.term];
    case 'prompt':            return [form.q, form.model];
    case 'term-and-depth':    return [form.term, form.depth];
    case 'triplet':           return [form.s, form.r, form.o];
    case 'term-and-relation': return [form.term, form.rel];
    default: return [];
  }
}

// Wrapper qui colocate le form QT et le terminal CLI. Le state du form
// vit ici et est passé EN BAS au QT (controlled inputs) ET utilisé par
// le ▶ du terminal (qui exécute l'API call). Le bouton du QT lui-même
// se contente de naviguer.
function ModuleQuickTryAndCli({ moduleId, config }) {
  const [form, setForm] = useState(() => initFormState(config));

  // Si l'utilisateur change de module dans le carrousel, le config change
  // → reset du form vers les defaults du nouveau module.
  const lastIdRef = useRef(moduleId);
  useEffect(() => {
    if (lastIdRef.current !== moduleId) {
      lastIdRef.current = moduleId;
      setForm(initFormState(config));
    }
  }, [moduleId, config]);

  // onRun du terminal CLI : appelle config.mock (qui fait le vrai fetch
  // backend) avec les valeurs actuelles du form, renvoie une string.
  const onRun = config?.mock ? async ({ mode }) => {
    const args = formToArgs(form, config.kind);
    const r = await config.mock(...args);
    if (typeof r === 'string') return r;
    if (r == null) return '(ok)';
    try { return JSON.stringify(r, null, 2); } catch { return String(r); }
  } : null;

  // onNavigate du QT : dispatch jdm:goto vers la vue du module. Le `term`
  // est posé sur window.__jdmPendingTerm pour les vues qui le lisent
  // (subgraph). Le `payload` complet va dans window.__jdmPendingPayload
  // pour les vues qui l'utilisent à terme.
  // Note : pour les vues qui auto-trigger après la navigation (chat, jarvis),
  // on veut PRÉ-REMPLIR mais PAS lancer — le user reste maître du moment.
  // Les vues cibles lisent leur payload au mount et ne déclenchent rien
  // automatiquement.
  const onNavigate = () => {
    const detail = { view: moduleId, payload: form };
    if (form.term) detail.term = form.term;
    window.dispatchEvent(new CustomEvent('jdm:goto', { detail }));
  };

  // onRunInline (claim only) : déclenche config.mock SUR PLACE et renvoie
  // la verdict, qui sera affichée dans le panneau QT lui-même (pas de
  // navigation). Pour le claim checker — fact-check rapide et déterministe,
  // ça n'a pas de sens de changer de page.
  const onRunInline = config?.mock ? async () => {
    const args = formToArgs(form, config.kind);
    return await config.mock(...args);
  } : null;

  return (
    <>
      <ModuleQuickTry
        config={config}
        form={form}
        setForm={setForm}
        onNavigate={onNavigate}
        onRunInline={onRunInline} />
      {(CLI_COMMANDS[moduleId] || REMOTE_COMMANDS[moduleId]) && (
        <div style={{ marginTop: 16 }}>
          <CliTerminalBlock
            cliData={CLI_COMMANDS[moduleId]}
            remoteData={REMOTE_COMMANDS[moduleId]}
            onRun={onRun}
          />
        </div>
      )}
    </>
  );
}

const QT_PANEL = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line-soft)',
  borderRadius: 'var(--radius)',
  padding: 12,
  display: 'flex', flexDirection: 'column', gap: 10,
};

function QTPreview({ text, node, onClose }) {
  const content = node ?? text;
  if (!content) return null;
  return (
    <div className="mono" style={{
      fontSize: 11,
      color: 'var(--ink-2)',
      background: 'var(--bg-card)',
      border: '1px dashed var(--line)',
      borderRadius: 4,
      padding: '8px 10px',
      lineHeight: 1.5,
      wordBreak: 'break-word',
      position: 'relative',
    }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le résultat"
          title="Fermer"
          className="focus-ring"
          style={{
            position: 'absolute',
            top: 4, right: 4,
            width: 18, height: 18, padding: 0,
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 3,
            color: 'var(--ink-3)',
            cursor: 'pointer',
            fontSize: 12, lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      )}
      <div style={{ paddingRight: onClose ? 24 : 0 }}>{content}</div>
    </div>
  );
}

// Verdict colors — match the claim checker's UI conventions.
const VERDICT_STYLES = {
  SUPPORTED:    { color: 'var(--jdm-green)',   bg: 'rgba(78,166,60,0.15)',  border: 'rgba(78,166,60,0.45)' },
  CONTRADICTED: { color: 'var(--jdm-magenta)', bg: 'rgba(200,58,115,0.15)', border: 'rgba(200,58,115,0.45)' },
  UNKNOWN:      { color: 'var(--jdm-yellow)',  bg: 'rgba(212,169,10,0.15)', border: 'rgba(212,169,10,0.45)' },
};

function VerdictPill({ verdict }) {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.04em',
    }}>{verdict}</span>
  );
}

function ClaimVerdictHeader({ result }) {
  if (!result) return null;
  const { verdict, triplet } = result;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--ink-3)' }}>→</span>
      <span style={{ color: 'var(--ink)' }}>{triplet.s}</span>
      <span style={{ color: 'var(--ink-3)' }}>|</span>
      <span style={{ color: 'var(--accent)' }}>{triplet.r}</span>
      <span style={{ color: 'var(--ink-3)' }}>|</span>
      <span style={{ color: 'var(--ink)' }}>{triplet.o}</span>
      <span style={{ color: 'var(--ink-3)' }}>→</span>
      <VerdictPill verdict={verdict} />
    </div>
  );
}

function ClaimVerdictChain({ result }) {
  if (!result) return null;
  const { verdict, chain, confidence, note } = result;
  const vStyle = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  if ((!chain || chain.length === 0) && !note && confidence == null) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {chain && chain.length > 0 && (
        <div style={{
          paddingLeft: 8,
          borderLeft: `2px solid ${vStyle.border}`,
          color: 'var(--ink-2)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Schéma d'inférence
          </div>
          {chain.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-3)' }}>{i === chain.length - 1 ? '└─' : '├─'}</span>
              <span style={{ color: 'var(--ink)' }}>{step.from}</span>
              <span style={{ color: 'var(--ink-3)' }}>──</span>
              <span style={{ color: step.neg ? 'var(--jdm-magenta)' : 'var(--accent)' }}>{step.rel}</span>
              <span style={{ color: 'var(--ink-3)' }}>→</span>
              <span style={{ color: 'var(--ink)' }}>{step.to}</span>
              {step.w != null && (
                <span style={{ color: 'var(--ink-3)', marginLeft: 'auto', fontSize: 10 }}>w={step.w}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {(confidence != null || note) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          color: 'var(--ink-3)', fontSize: 10,
        }}>
          {note && <span>{note}</span>}
          {confidence != null && <span>confidence = {confidence.toFixed(2)}</span>}
        </div>
      )}
    </div>
  );
}

function ClaimVerdictBlock({ result }) {
  if (!result) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ClaimVerdictHeader result={result} />
      <ClaimVerdictChain result={result} />
    </div>
  );
}

function QTRunButton({ onClick, label = 'Tester' }) {
  return (
    <div style={{ alignSelf: 'flex-start' }}>
      <Button size="sm" onClick={onClick}>{label}</Button>
    </div>
  );
}

// Note : tous les QT widgets sont maintenant CONTROLLED — le state vit
// dans ModuleQuickTryAndCli. Les boutons ne font plus que naviguer (via
// onNavigate). Le vrai API call est désormais déclenché par le bouton
// ▶ de la CliTerminalBlock juste en-dessous.

function QTSelectAndTerm({ config, form, setForm, onNavigate }) {
  return (
    <div style={QT_PANEL}>
      <Select value={form.flow} onChange={v => setForm(s => ({ ...s, flow: v }))} options={config.options} />
      <Input value={form.term} onChange={v => setForm(s => ({ ...s, term: v }))} placeholder="terme" />
      {/* Préparer = navigation + pré-remplissage, l'utilisateur lance
          lui-même depuis l'onglet Jarvis (un flux est long, on évite
          le clic involontaire). */}
      <QTRunButton onClick={onNavigate} label="Préparer dans Jarvis" />
    </div>
  );
}

function QTPrompt({ config, form, setForm, onNavigate }) {
  return (
    <div style={QT_PANEL}>
      {config.models && (
        <Select value={form.model} onChange={v => setForm(s => ({ ...s, model: v }))} options={config.models} />
      )}
      <Input value={form.q} onChange={v => setForm(s => ({ ...s, q: v }))} placeholder={config.placeholder} />
      {/* Pas "Envoyer" — on ouvre le chat avec le message pré-rempli
          mais on ne l'envoie PAS. L'utilisateur clique Envoyer côté
          chatbot quand il veut. */}
      <QTRunButton onClick={onNavigate} label="Ouvrir le chat" />
    </div>
  );
}

function QTTermAndDepth({ config, form, setForm, onNavigate }) {
  return (
    <div style={QT_PANEL}>
      <Input value={form.term} onChange={v => setForm(s => ({ ...s, term: v }))} placeholder="terme" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 78 }}>profondeur</span>
        <div style={{ flex: 1 }}>
          <Slider min={1} max={4} step={1} value={form.depth} onChange={v => setForm(s => ({ ...s, depth: v }))} />
        </div>
      </div>
      <QTRunButton onClick={onNavigate} label="Construire" />
    </div>
  );
}

function QTTriplet({ config, form, setForm, onRunInline }) {
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const isVerdict = out && typeof out === 'object';
  const rootRef = useRef(null);
  const tailRef = useRef(null);

  const onVerify = async () => {
    if (!onRunInline || loading) return;
    setLoading(true);
    try {
      const r = await onRunInline();
      setOut(r);
      // Smooth-scroll pour amener la verdict + chaîne d'inférence dans
      // la viewport (le panneau s'agrandit en bas).
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (rootRef.current && typeof scrollGroupIntoView === 'function') {
            try { scrollGroupIntoView(rootRef.current, tailRef.current || rootRef.current); } catch {}
          }
        }, 30);
      });
    } catch (e) {
      setOut(`⚠️ ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={rootRef} style={QT_PANEL}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Input value={form.s} onChange={v => setForm(st => ({ ...st, s: v }))} placeholder="sujet" />
        <Input value={form.r} onChange={v => setForm(st => ({ ...st, r: v }))} placeholder="relation" />
        <Input value={form.o} onChange={v => setForm(st => ({ ...st, o: v }))} placeholder="objet" />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ alignSelf: 'flex-start' }}>
          <Button size="sm" onClick={onVerify} disabled={loading}>
            {loading ? '⏳ vérification…' : 'Vérifier'}
          </Button>
        </div>
        {out && (
          <div style={{ flex: 1, minWidth: 0 }}>
            {isVerdict
              ? <QTPreview node={<ClaimVerdictHeader result={out} />} onClose={() => setOut(null)} />
              : <QTPreview text={out} onClose={() => setOut(null)} />}
          </div>
        )}
      </div>
      {isVerdict && (out.chain?.length > 0 || out.note || out.confidence != null) && (
        <div ref={tailRef} data-detail-content>
          <QTPreview node={<ClaimVerdictChain result={out} />} />
        </div>
      )}
    </div>
  );
}

function QTTermAndRelation({ config, form, setForm, onNavigate }) {
  return (
    <div style={QT_PANEL}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Input value={form.term} onChange={v => setForm(s => ({ ...s, term: v }))} placeholder="terme" />
        <Input value={form.rel} onChange={v => setForm(s => ({ ...s, rel: v }))} placeholder="relation" />
      </div>
      <QTRunButton onClick={onNavigate} label="Lister" />
    </div>
  );
}

// ───────── Expandable briefs grid (Sous le capot) ─────────
// Le détail s'ouvre IMMÉDIATEMENT SOUS LA RANGÉE de la carte cliquée
// — les autres cartes de cette rangée RESTENT à côté de la carte
// cliquée. Le détail est injecté APRÈS la dernière carte de la rangée
// concernée, occupe toute la largeur via `gridColumn: 1 / -1`.
//
// Comme le nombre de colonnes dépend du viewport (auto-fit), on le
// mesure dynamiquement après layout : pour chaque card, on lit son
// `offsetTop` ; les cards qui partagent le même top forment la 1ʳᵉ
// rangée — le compte donne `cols`. Re-mesuré à chaque resize via
// ResizeObserver.
function ExpandableBriefsGrid({ briefs, goto }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  // `slotIdx` = index de la CARTE qui a déclenché l'ouverture, gardé
  // pendant la fermeture animée (sinon le détail saute hors layout
  // dès qu'on ferme). BriefDetailPanel appelle `onClosed` à la fin
  // de sa transition de fermeture pour qu'on reset le slot.
  const [slotIdx, setSlotIdx] = useState(null);
  const [cols, setCols] = useState(1);  // nb de cards par rangée, mesuré post-layout
  const expanded = expandedIdx == null ? null : briefs[expandedIdx];
  const toggle = (i) => {
    if (expandedIdx === i) {
      setExpandedIdx(null);
      // slotIdx reste → BriefDetailPanel s'anime en fermeture sur place
    } else {
      setExpandedIdx(i);
      setSlotIdx(i);
    }
  };
  const cardRefs = useRef({});
  const detailRef = useRef(null);
  const gridRef = useRef(null);

  // Mesure du nombre de colonnes effectives. Lit offsetTop de chaque
  // card ; toutes celles qui partagent le top de la 1ʳᵉ card sont en
  // rangée 1 → compteur = nb de cols. Robuste aux changements de
  // viewport (ResizeObserver) et aux changements de longueur de
  // briefs.
  React.useLayoutEffect(() => {
    const measure = () => {
      const els = briefs.map((_, i) => cardRefs.current[i]).filter(Boolean);
      if (!els.length) return;
      const top0 = els[0].offsetTop;
      const c = els.filter(el => el.offsetTop === top0).length;
      if (c > 0 && c !== cols) setCols(c);
    };
    measure();
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [briefs.length, cols]);

  // Index APRÈS lequel insérer le détail : dernière carte de la rangée
  // contenant `slotIdx`. Clampé au dernier index valide pour les
  // rangées incomplètes (ex. 5 briefs / 4 cols → dernière rangée = idx 4).
  const detailInsertAfterIdx = slotIdx == null
    ? -1
    : Math.min(briefs.length - 1, (Math.floor(slotIdx / Math.max(1, cols)) + 1) * cols - 1);

  useEffect(() => {
    if (expandedIdx == null) return;
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(cardRefs.current[expandedIdx], detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedIdx]);

  const renderDetail = (
    <div ref={detailRef} style={{ gridColumn: '1 / -1' }}>
      <BriefDetailPanel
        brief={expanded}
        index={expandedIdx}
        goto={goto}
        onClose={() => setExpandedIdx(null)}
        onClosed={() => setSlotIdx(null)}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
      <div ref={gridRef} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {briefs.map((b, i) => {
          const isOpen = expandedIdx === i;
          return (
            <React.Fragment key={i}>
              <div
                ref={el => { if (el) cardRefs.current[i] = el; }}
                onClick={() => toggle(i)}
                onKeyDown={(e) => { if (e.key === 'Enter') toggle(i); }}
                className="focus-ring"
                tabIndex={0}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--line)'),
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: isOpen ? '0 6px 18px -10px var(--accent)' : 'none',
                  transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
                  transform: isOpen ? 'translateY(-1px)' : 'none',
                }}>
                <div className="mono" style={{
                  fontSize: 11,
                  color: isOpen ? 'var(--accent)' : 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 8, fontWeight: 600,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--accent)' }}>0{i + 1}</span>
                  <span style={{
                    fontSize: 10,
                    color: isOpen ? 'var(--accent)' : 'var(--ink-3)',
                    letterSpacing: '0.08em',
                  }}>{isOpen ? '— refermer' : 'déplier +'}</span>
                </div>
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
              {detailInsertAfterIdx === i && renderDetail}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BriefDetailPanel({ brief, index, goto, onClose, onClosed }) {
  // Keep last truthy brief around so the panel can finish its close animation
  // before content unmounts. Ref so the value is committed SYNCHRONOUSLY
  // — fixes the first-click case where scroll measurement would happen
  // before content had a natural height.
  const lastBriefRef = useRef(null);
  const lastIndexRef = useRef(index);
  if (brief) { lastBriefRef.current = brief; lastIndexRef.current = index; }
  const [, forceRender] = useReducer(x => x + 1, 0);
  const open = !!brief;
  const shown = lastBriefRef.current;
  const shownIndex = lastIndexRef.current;
  return (
    <div
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && lastBriefRef.current) {
          lastBriefRef.current = null;
          forceRender();
          // Signale au parent que la fermeture est terminée — sert
          // au grid `ExpandableBriefsGrid` à retirer le slot du
          // détail dans le DOM grid (sinon il reste en case fantôme).
          if (typeof onClosed === 'function') onClosed();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.34s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s',
        opacity: open ? 1 : 0,
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {shown && (
          <div data-detail-content style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius-lg)',
            padding: '22px 26px 0',
            display: 'flex', flexDirection: 'column', gap: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                fontWeight: 600,
              }}>
                0{(shownIndex ?? 0) + 1} · {shown.detail?.kicker}
              </div>
              <button
                onClick={onClose}
                aria-label="Refermer le panneau"
                className="focus-ring"
                style={{
                  background: 'transparent', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  width: 26, height: 26, padding: 0,
                  color: 'var(--ink-3)', cursor: 'pointer',
                  fontSize: 14, lineHeight: 1,
                }}>×</button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 32,
              alignItems: 'start',
            }}>
              <div>
                <p className="display" style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
                  color: 'var(--ink)', lineHeight: 1.3,
                  marginBottom: 14,
                }}>{shown.detail?.lede}</p>
                {(shown.detail?.paragraphs || []).map((p, i) => (
                  <p key={i} style={{
                    margin: '0 0 12px',
                    fontSize: 14, lineHeight: 1.65,
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font-serif)',
                  }}>{p}</p>
                ))}
                {shown.detail?.cta && (
                  <div style={{ marginTop: 12 }}>
                    {shown.detail.cta.goto ? (
                      <Button onClick={() => goto(shown.detail.cta.goto)}>
                        {shown.detail.cta.label}
                      </Button>
                    ) : (
                      <a href={shown.detail.cta.href} target="_blank" rel="noopener noreferrer"
                         style={{ textDecoration: 'none' }}>
                        <Button variant="secondary">{shown.detail.cta.label}</Button>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                  marginBottom: 10,
                }}>Bibliographie convoquée</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(shown.detail?.citations || []).map((c, i) => (
                    <li key={i} style={{
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      paddingLeft: 12,
                      borderLeft: '2px solid var(--line-soft)',
                    }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.author}</span>
                      <span style={{ color: 'var(--ink-3)' }}> ({c.year})</span>
                      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--ink-2)' }}>
                        {c.title}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 2 }}>
                        {c.venue}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Scrolling marquee — citations égrainées */}
            <CitationsMarquee citations={shown.detail?.citations || []} />
          </div>
        )}
      </div>
    </div>
  );
}

function CitationsMarquee({ citations }) {
  if (!citations.length) return null;
  // Duplicate the run to make seamless loop.
  const items = [...citations, ...citations, ...citations];
  return (
    <div style={{
      borderTop: '1px solid var(--line-soft)',
      margin: '0 -26px',
      padding: '10px 0',
      overflow: 'hidden',
      position: 'relative',
      maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
    }}>
      <div style={{
        display: 'flex',
        gap: 36,
        whiteSpace: 'nowrap',
        animation: 'jdm-citations-scroll 48s linear infinite',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink-3)',
        letterSpacing: '0.04em',
      }}>
        {items.map((c, i) => (
          <span key={i} style={{ flexShrink: 0 }}>
            <span style={{ color: 'var(--accent)' }}>●</span>{' '}
            <span style={{ color: 'var(--ink-2)' }}>{c.author}</span>
            {' '}({c.year}) — <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{c.title}</span>
            {' '}· <span>{c.venue}</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes jdm-citations-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(-100% / 3)); }
        }
      `}</style>
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
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    // Pour les stats en "M+" on commence à 1k (= 0.001M) et on passe
    // de k vers M lorsqu'on atteint 1M.
    // Pour les stats sans magnitude (180+, 35, 5) : start = 0.45 * target.
    const startVal = hasM ? 0.001 : target * 0.45;
    // Plus la plage est large, plus on prend de temps — sinon le début
    // (les milliers) défile trop vite pour être lisible.
    const duration = hasM ? 2400 : 1200;
    // Renvoie la chaîne complète (nombre + magnitude) — le "+" est ajouté
    // uniquement à la fin de l'animation pour ne pas distraire pendant.
    // Tant que v < 1M, on affiche "Xk" (PAS de M) ; ≥ 1M, on affiche "X.YM".
    const fmtFull = (v, final = false) => {
      const plus = final && hasPlus ? '+' : '';
      if (hasM) {
        if (v < 1) return Math.round(v * 1000) + 'k' + plus;
        const s = v.toFixed(1);
        return (s.endsWith('.0') ? s.slice(0, -2) : s) + 'M' + plus;
      }
      return String(Math.floor(v)) + plus;
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Pour les "M" (1k → 2M = 3+ ordres de grandeur) on interpole en
      // exponentiel pour que chaque décade soit visible le même temps.
      // Pour les autres, ease-out cubique standard.
      let v;
      if (hasM) {
        const logStart = Math.log(startVal);
        const logEnd = Math.log(target);
        const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
        v = Math.exp(logStart + (logEnd - logStart) * eased);
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        v = startVal + (target - startVal) * eased;
      }
      setDisplay(fmtFull(v, t === 1));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Au mount : affichage initial = valeur formatée selon les règles ci-dessus
  // (donc "2M+" complet d'office, "180+", "35", etc.).
  React.useEffect(() => {
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    const plus = hasPlus ? '+' : '';
    if (hasM) {
      const s = target.toFixed(1);
      setDisplay((s.endsWith('.0') ? s.slice(0, -2) : s) + 'M' + plus);
    } else {
      setDisplay(String(target) + plus);
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
      }}>{display}</div>
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
  // Pré-remplissage depuis Projet › Quick try (term, rel). Lu une fois
  // au mount puis nettoyé. Pas d'auto-fetch ici — le user clique « Lister ».
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.explorer) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.explorer;
  }
  // Defaults alignés sur la branche deploy-self : chat / r_isa / 25 / 20 / true.
  const [term, setTerm] = useState(_pending?.term || 'chat');
  const [rel, setRel] = useState(_pending?.rel || 'r_isa');
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
        alignItems: 'end',
        marginBottom: 16,
      }}>
        <Field label="Terme">
          <Input value={term} onChange={setTerm} placeholder="chat, avocat, courir…" mono />
        </Field>
        <Field label="Type de relation">
          <Select value={rel} options={EXPLORE_RELATIONS} onChange={setRel} />
        </Field>
        {/* Spacer marginBottom matches Field's marginBottom:14 so the
            visible button aligns with the visible input row (le Field
            réserve 14px sous l'input pour son espacement). */}
        <div style={{ marginBottom: 14 }}>
          <Button onClick={onRun} size="lg" disabled={loading}>
            {loading ? 'Chargement…' : 'Interroger'}
          </Button>
        </div>
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

  // `run(opts)` accepte un override explicite des valeurs — utile pour
  // les boutons d'exemples qui changent le form ET veulent vérifier
  // dans la même intention (sinon : race entre setState async et fetch).
  const run = async (opts) => {
    const _subject  = opts && opts.subject  !== undefined ? opts.subject  : subject;
    const _relation = opts && opts.relation !== undefined ? opts.relation : relation;
    const _object   = opts && opts.object   !== undefined ? opts.object   : object_;
    const _effort   = opts && opts.effort   !== undefined ? opts.effort   : Number(effort);
    const _bypass   = opts && opts.bypass   !== undefined ? opts.bypass   : !!bypass;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: _subject,
          relation: _relation,
          object: _object,
          effort: Number(_effort),
          bypass: !!_bypass,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const submitted = {
        subject: _subject, relation: _relation,
        object: _object,
        effort: Number(_effort),
        bypass: !!_bypass,
      };
      if (data.error) {
        setResult({
          submitted,
          status: 'unknown',
          confidence: 0,
          explanation: data.error,
          origin: ORIGIN_LABEL[data.origin] || '—',
        });
      } else {
        setResult({
          submitted,
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
              // Update du form + run avec les NOUVELLES valeurs passées
              // explicitement (le setState est async, run() lirait sinon
              // l'ancien state). Fix la race « clic sur exemple → vérifie
              // le triplet précédent puis affiche le nouveau form ».
              setSubject(s); setRelation(r); setObject(o);
              run({ subject: s, relation: r, object: o });
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

      {/* Indicateur « résultats périmés » si le formulaire a changé
          depuis la dernière vérification. */}
      {result && result.submitted && (
        result.submitted.subject !== subject ||
        result.submitted.relation !== relation ||
        result.submitted.object !== object_ ||
        result.submitted.effort !== Number(effort) ||
        result.submitted.bypass !== !!bypass
      ) && (
        <div style={{
          padding: '8px 14px', marginBottom: 12,
          background: 'var(--bg-elev)',
          border: '1px dashed var(--jdm-orange)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-orange)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span>⚠️ Le formulaire a changé — le verdict ci-dessous concerne le triplet précédent.</span>
          <Button size="sm" onClick={run} disabled={loading}>Re-vérifier</Button>
        </div>
      )}

      {/* Result — utilise les valeurs SNAPSHOTÉES dans result.submitted
          pour éviter le bug stale : si l'utilisateur change le form
          après vérification, le banner affiche le verdict avec le
          triplet *réellement vérifié*, pas le triplet en cours
          d'édition. */}
      {result && (
        <ClaimResult
          result={result}
          subject={result.submitted ? result.submitted.subject : subject}
          relation={result.submitted ? result.submitted.relation : relation}
          object={result.submitted ? result.submitted.object : object_}
        />
      )}
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

// Couleurs LIVE — vives, lisibles sur fond sombre (≠ KIND_COLOR qui est
// taillé pour le SVG sur fond clair). Utilisées pour les arêtes en
// mode LIVE et la légende.
const REL_COLOR_LIVE = {
  r_isa:        '#4ea1ff',   // bleu
  r_hypo:       '#5cd6a8',   // vert menthe
  r_syn:        '#a8e063',   // vert lime
  r_anto:       '#ff5c87',   // rose vif
  r_carac:      '#c084fc',   // violet
  r_has_part:   '#ffa94d',   // orange
  r_lieu:       '#22d3ee',   // cyan
  r_domain:     '#94a3b8',   // ardoise
  r_has_color:  '#fbbf24',   // jaune
  r_agent:      '#f97316',   // orange foncé
  r_patient:    '#ec4899',   // magenta
  r_instr:      '#06b6d4',   // teal
  r_telic_role: '#84cc16',   // lime
  r_has_causatif: '#dc2626', // rouge
  r_has_conseq: '#a78bfa',   // violet clair
  'r_patient-1': '#fb923c',  // orange clair
  'r_agent-1':  '#f59e0b',   // ambre
  r_associated: '#9ca3af',   // gris
  r_raff_sem:   '#e879f9',   // magenta clair
};
const REL_COLOR_DEFAULT = '#6b7280';
function relColor(rel) {
  return REL_COLOR_LIVE[rel] || REL_COLOR_DEFAULT;
}

// Convertit {nodes, edges} SSE en scénario HeroAnimation, en
// REPRODUISANT EXACTEMENT le pattern du scénario 'voiture' de la
// démo accueil (hero-animation.jsx) :
//
//   - centre au milieu (positions[center] = {0,0})
//   - depth-1 : posés en POLAIRE, angles répartis uniformément
//     autour du centre, dist = 110
//   - depth-2 : posés en POLAIRE, ANGLE PROCHE de leur parent
//     depth-1 (± offset léger pour les frères), dist = 180
//     → visuellement = "branches" qui sortent du centre
//   - depth-3+ : même logique, dist 240 puis 290
//
// `layout` :
//   'tree'  → angles depth-2+ clusterisés près du parent (arbre)
//   'rings' → angles depth-2+ uniformes sur leur anneau (cercles)
function buildLiveScenario(rootTerm, nodes, edges, layout = 'tree', opts = {}) {
  if (!nodes || nodes.length === 0) return null;

  // showNegatives=false : on retire les arêtes de polarité négation
  // ET les nœuds devenus orphelins (plus aucune arête restante).
  // Filtré dès le départ pour que parentOf / branches couleur / autofit
  // travaillent sur le sous-graphe effectivement affiché.
  const showNegatives = opts.showNegatives !== false;
  if (!showNegatives) {
    const filteredEdges = (edges || []).filter(e => !e.negative);
    const touched = new Set(['ROOT']);
    for (const e of filteredEdges) { touched.add(e.from); touched.add(e.to); }
    nodes = (nodes || []).filter(n => touched.has(n.id));
    edges = filteredEdges;
    if (nodes.length === 0) return null;
  }

  // Centre = ROOT, ou le 1er nœud à défaut. center = LABEL (string)
  // car GraphCanvas indexe positions[g.center] par cette string.
  const centerNode = nodes.find(n => n.id === 'ROOT') || nodes[0];
  const center = centerNode.label || rootTerm;
  const centerId = centerNode.id;

  // Palette de branches — chaque depth-1 a sa couleur, héritée par
  // ses descendants → groupes lisibles comme la démo voiture.
  const BRANCH_COLORS = [
    'jdm-magenta', 'jdm-cyan', 'jdm-green', 'jdm-violet',
    'jdm-orange', 'jdm-yellow',
  ];

  // ──────────────────────────────────────────────────────────────
  // 1. Groupement par PROFONDEUR (utilise le champ depth du backend
  //    directement, fiable). Centre = depth 0 (ignoré).
  // ──────────────────────────────────────────────────────────────
  const byDepth = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    const d = Math.max(1, Math.min(Number(n.depth) || 1, 4));
    byDepth[d].push(n);
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Index parents : pour chaque nœud non-centre, trouver UN
  //    parent de profondeur strictement inférieure parmi les edges.
  //    On regarde les deux directions (from→to et to→from) parce
  //    que la subgraph BFS n'a pas toujours from=parent.
  // ──────────────────────────────────────────────────────────────
  const depthOfId = { [centerId]: 0 };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    depthOfId[n.id] = Math.max(1, Math.min(Number(n.depth) || 1, 4));
  }
  const parentOf = {};
  for (const e of edges || []) {
    const fa = depthOfId[e.from];
    const fb = depthOfId[e.to];
    if (fa === undefined || fb === undefined) continue;
    // L'extrémité de plus grande profondeur est l'enfant
    if (fb > fa && !(e.to in parentOf)) parentOf[e.to] = e.from;
    else if (fa > fb && !(e.from in parentOf)) parentOf[e.from] = e.to;
  }

  // ──────────────────────────────────────────────────────────────
  // 3. POSITIONNEMENT POLAIRE (angle, dist) — imite la démo voiture
  //    mais avec des distances qui s'adaptent au volume et au
  //    canvas élargi (viewBox 920×H en mode interactif).
  // ──────────────────────────────────────────────────────────────
  const d1Count = byDepth[1].length;
  // Distances de base — adaptées à un viewBox de 920×560 (LIVE).
  // Pour ≥ 12 nœuds en depth-1, on espace plus radialement et on
  // alterne légèrement la distance pour éviter le chevauchement
  // de labels longs.
  const RING_DIST = [
    0,
    d1Count >= 12 ? 220 : (d1Count >= 8 ? 200 : 180),
    320, 410, 470,
  ];
  const polar = { [centerId]: { angle: 0, dist: 0 } };
  const branchColorOf = { [centerId]: 'jdm-magenta' };

  // depth-1 : uniforme autour du centre. Alternance dist±18 sur les
  // index pairs/impairs quand il y a beaucoup de frères (≥ 8) →
  // les labels ne se collent plus dans la même couronne.
  const d1 = byDepth[1];
  d1.forEach((n, i) => {
    const angle = (i / Math.max(d1.length, 1)) * 360 - 90;
    const stagger = d1.length >= 8 ? (i % 2 === 0 ? -22 : 22) : 0;
    polar[n.id] = { angle, dist: RING_DIST[1] + stagger };
    branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
  });

  // depth-2/3/4 : deux stratégies selon le volume.
  //   - PEU de nœuds OU layout='tree' avec branches peu chargées :
  //     CLUSTER près du parent (angle parent ± offset) — donne le
  //     look "branches" de la démo voiture.
  //   - BEAUCOUP de nœuds OU clusters surchargés :
  //     UNIFORME sur l'anneau (couronne complète), couleur héritée
  //     du parent pour rester lisible visuellement → plus de demi-
  //     cercles entassés avec labels confondus.
  //   layout='rings' force le mode uniforme pour tous les depths.
  for (let depth = 2; depth <= 4; depth++) {
    const arr = byDepth[depth];
    if (arr.length === 0) continue;
    const dist = RING_DIST[Math.min(depth, 4)];

    // Estime l'arc minimum nécessaire par label : à dist `dist`,
    // un label de ≈80 px occupe (80/dist) rad. On veut ≥ 10° (~0.17 rad)
    // d'arc par nœud pour ne pas se chevaucher.
    const minArcDeg = 13;
    const tooCrowded = arr.length * minArcDeg > 340;

    if (layout === 'rings' || tooCrowded) {
      // UNIFORME : tous les nœuds de ce depth sur la couronne complète.
      // L'offset (depth-1)*15 évite que les rayons depth-1/2/3 soient
      // exactement alignés (et donc qu'un nœud depth-2 cache son parent).
      arr.forEach((n, i) => {
        const angle = (i / arr.length) * 360 - 90 + (depth - 1) * 15;
        polar[n.id] = { angle, dist };
        const pId = parentOf[n.id];
        branchColorOf[n.id] = (pId && branchColorOf[pId])
          || BRANCH_COLORS[i % BRANCH_COLORS.length];
      });
      continue;
    }

    // ARBRE peu chargé : cluster près du parent
    const byParent = {};
    const orphans = [];
    for (const n of arr) {
      const pId = parentOf[n.id];
      if (pId && polar[pId] !== undefined) {
        if (!byParent[pId]) byParent[pId] = [];
        byParent[pId].push(n);
      } else {
        orphans.push(n);
      }
    }
    for (const pId of Object.keys(byParent)) {
      const kids = byParent[pId];
      const pAngle = polar[pId].angle;
      // Span d'ouverture proportionnel + plafond cohérent avec la part
      // angulaire que le parent "possède" (360 / nombre de depth-1).
      const parentSlice = d1Count > 0 ? 360 / d1Count : 90;
      const span = Math.min(parentSlice * 0.85,
                            Math.max(20, kids.length * 26));
      kids.forEach((n, i) => {
        const off = kids.length === 1
          ? 0
          : (i / (kids.length - 1)) * span - span / 2;
        polar[n.id] = { angle: pAngle + off, dist };
        branchColorOf[n.id] = branchColorOf[pId] || 'jdm-violet';
      });
    }
    // Orphelins : répartis uniformément sur la couronne.
    orphans.forEach((n, i) => {
      const angle = (i / Math.max(orphans.length, 1)) * 360 - 45;
      polar[n.id] = { angle, dist };
      branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
    });
  }

  // ──────────────────────────────────────────────────────────────
  // 4. Délais d'apparition — par vagues de profondeur
  // ──────────────────────────────────────────────────────────────
  const DELAY_PER_DEPTH = [0, 0.4, 1.8, 3.0, 4.0];
  const nodeDelays = { [centerId]: 0 };

  const liveNodes = [];
  // Tri par depth pour l'anim en vagues (depth 1 d'abord, etc.)
  const sortedNodes = nodes
    .filter(n => n.id !== centerId && polar[n.id] !== undefined)
    .sort((a, b) => (depthOfId[a.id] || 1) - (depthOfId[b.id] || 1));

  let perDepthCounter = {};
  sortedNodes.forEach((n) => {
    const d = depthOfId[n.id] || 1;
    perDepthCounter[d] = (perDepthCounter[d] || 0) + 1;
    const base = DELAY_PER_DEPTH[Math.min(d, 4)];
    const delay = base + perDepthCounter[d] * 0.08;
    nodeDelays[n.id] = delay;
    liveNodes.push({
      id: n.id,
      label: n.label || n.id,
      angle: polar[n.id].angle,
      dist: polar[n.id].dist,
      color: branchColorOf[n.id] || 'jdm-violet',
      delay,
      dim: d >= 2,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 5. Arêtes — remap le centre par son LABEL (cf. GraphCanvas)
  // ──────────────────────────────────────────────────────────────
  const remap = (id) => (id === centerId ? center : id);
  const known = (id) => id === centerId || polar[id] !== undefined;
  const liveEdges = (edges || [])
    .filter(e => known(e.from) && known(e.to))
    .map(e => ({
      from: remap(e.from),
      to:   remap(e.to),
      delay: Math.max(nodeDelays[e.from] || 0, nodeDelays[e.to] || 0) + 0.12,
      label: e.relation || '',
      // Couleur par TYPE DE RELATION (visible sur fond sombre).
      // Les négations passent en rouge dédié pour signal fort.
      color: e.negative ? '#ef4444' : relColor(e.relation),
      negative: !!e.negative,
      // Poids JDM exposé au tooltip survol (cf. GraphCanvas <title>).
      weight: e.weight,
      highlight: e.highlight !== false,
    }));

  // Map ID brut JDM (incluant ROOT et tous les N1, N2…) → label décodé.
  // Sert aux tooltips d'arête (GraphCanvas le consulte en priorité)
  // pour qu'aucune ID brute ne fuite dans l'UI.
  const labelByRawId = {};
  for (const n of nodes) {
    const lbl = (n.label || '').toString().trim();
    labelByRawId[n.id] = lbl || n.id;
  }
  labelByRawId[centerId] = center;

  return {
    id: 'live',
    question: '',
    streamChunks: [],
    graph: {
      center, nodes: liveNodes, edges: liveEdges,
      _labelByRawId: labelByRawId, _centerId: centerId,
    },
  };
}


// Wrapper qui MEMOIZE le scenario pour ne pas recréer un nouvel objet
// à chaque render — sinon HeroAnimation re-trigger l'animation en
// boucle infinie (sa useEffect dépend de liveScenario par référence).
// Ajoute toutes les fonctionnalités de graphe communes :
//   - Zoom (boutons +/− + molette Alt/Ctrl)
//   - Pan (drag du canvas)
//   - Hover arête → surlignage + tooltip natif (from/relation/to/poids)
//   - Hover nœud → focus mode : arêtes connectées surlignées, reste dim
//   - Clic nœud → recentre le graphe sur ce terme (via onRecenter)
//   - Reset view (zoom 100% + pan 0,0)
//   - Légende dynamique par type de relation
function LiveAnimWrapper({ term, nodes, edges, layout, onRecenter }) {
  // Toggle masquage des arêtes négatives (par défaut ON = visibles).
  const [showNegatives, setShowNegatives] = useState(true);
  const scenario = React.useMemo(
    () => buildLiveScenario(term, nodes, edges, layout, { showNegatives }),
    [term, layout, showNegatives,
     (nodes || []).length, (edges || []).length,
     (nodes || [])[0]?.id, (nodes || [])[(nodes || []).length - 1]?.id]
  );

  // ── Zoom ──
  const [zoom, setZoom] = useState(1);
  // ── Pan ──
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = React.useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });

  const onWheel = (e) => {
    // Molette = zoom in/out — bloque le scroll uniquement si Alt/Ctrl
    // (sinon la page peut scroller normalement par-dessus le canvas).
    if (!(e.altKey || e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom(z => Math.max(0.4, Math.min(3, z + delta)));
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;          // bouton gauche uniquement
    if (e.target.closest('[data-node-bubble]')) return; // pas si on clique un nœud
    drag.current = { active: true, sx: e.clientX, sy: e.clientY,
                     px: pan.x, py: pan.y };
  };
  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.sx),
      y: drag.current.py + (e.clientY - drag.current.sy),
    });
  };
  const stopDrag = () => { drag.current.active = false; };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Recentre : clic nœud → relance la requête avec ce terme comme racine
  const handleNodeClick = React.useCallback((node) => {
    if (!onRecenter) return;
    // Le label est le texte affiché (déjà décodé côté backend)
    onRecenter(node.label || node.id);
  }, [onRecenter]);

  // La légende des couleurs est désormais rendue dans le header de la
  // Card (à côté de "LIVE") — voir ViewSubgraph. On la laisse là parce
  // qu'elle utilise data.edges qui est déjà à ce niveau.

  const cursor = drag.current.active ? 'grabbing' : 'grab';

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex',
                  flexDirection: 'column' }}>
      {/* Boutons d'action — overlay coin haut-droit */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 5,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: '+', title: 'Zoom +', onClick: () => setZoom(z => Math.min(3, z + 0.2)) },
          { label: '−', title: 'Zoom −', onClick: () => setZoom(z => Math.max(0.4, z - 0.2)) },
          { label: '⟲', title: 'Réinitialiser vue (zoom + pan)', onClick: resetView },
        ].map(b => (
          <button key={b.label}
            onClick={b.onClick}
            className="focus-ring"
            title={b.title}
            style={{
              width: 28, height: 28,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{b.label}</button>
        ))}
        {/* Toggle négations : ¬ barré = masquées, ¬ plein = visibles. */}
        <button
          onClick={() => setShowNegatives(v => !v)}
          className="focus-ring"
          title={showNegatives
            ? 'Masquer les relations négatives (affiner)'
            : 'Afficher les relations négatives'}
          style={{
            width: 28, height: 28, marginTop: 4,
            background: showNegatives ? 'var(--bg-elev)' : '#ef4444',
            border: '1px solid var(--line)',
            color: showNegatives ? 'var(--ink)' : '#fff',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: showNegatives ? 'none' : 'line-through',
          }}>¬</button>
        <div className="mono" style={{
          marginTop: 2,
          fontSize: 9, color: 'var(--ink-3)',
          textAlign: 'center', letterSpacing: '0.05em',
        }}>{Math.round(zoom * 100)}%</div>
      </div>

      {/* Hint d'usage — overlay coin haut-gauche, discret */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 5,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid var(--line-soft)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 9, color: 'var(--ink-3)',
        pointerEvents: 'none',
        letterSpacing: '0.04em',
      }}>
        glisser : pan · Alt+molette : zoom · survoler : info · cliquer : recentrer
      </div>

      {/* Canvas zoomable + draggable */}
      <div
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          position: 'relative',
          cursor,
          userSelect: 'none',
        }}>
        <div style={{
          width: '100%', height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: drag.current.active
            ? 'none'
            : 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <HeroAnimation height={720} showChat={false}
                         liveScenario={scenario}
                         interactive={true}
                         onNodeClick={handleNodeClick} />
        </div>
      </div>

      {/* Légende déplacée dans le header du Card (à côté de "LIVE") —
          libère l'espace bas du canvas pour le graphe lui-même. */}
    </div>
  );
}

function ViewSubgraph() {
  // Si Explorer ou Projet a navigué vers nous via jdm:goto, on récupère
  // son terme et (depuis Projet) sa profondeur. Lu une fois au mount.
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.subgraph) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.subgraph;
  }
  const initialTerm = (typeof window !== 'undefined' && window.__jdmPendingTerm) || _pending?.term || 'plat asiatique';
  if (typeof window !== 'undefined') window.__jdmPendingTerm = null;
  const [term, setTerm] = useState(initialTerm);
  // Défauts choisis pour le mode LIVE : profondeur 2 + Niveau 1 top-K=1
  // (= un voisin par type de relation, garde l'arbre lisible) + Niveau 2
  // top-K=3 (un peu plus de matière à explorer en profondeur).
  const [depth, setDepth] = useState(_pending?.depth || 2);
  const [topK, setTopK] = useState(1);
  const [topKd2, setTopKd2] = useState(3);
  const [topKd3, setTopKd3] = useState(3);
  const [topKd4, setTopKd4] = useState(3);
  const [activeRels, setActiveRels] = useState(SUBGRAPH_DEFAULT_RELATIONS);
  const [activeRelsD2, setActiveRelsD2] = useState(SUBGRAPH_DEFAULT_D2);
  const [activeRelsD3, setActiveRelsD3] = useState(SUBGRAPH_DEFAULT_D3);
  const [activeRelsD4, setActiveRelsD4] = useState(SUBGRAPH_DEFAULT_D4);
  // design-pass-2 : les NiveauFilterCards passent de la sidebar à la
  // colonne droite (grid horizontal au-dessus du viz). Un bouton
  // global plier/déplier dans le header replie/déplie tous d'un coup,
  // et le clic « Construire » auto-collapse + scroll au viz.
  const vizRef = useRef(null);
  const [levelsCollapsed, setLevelsCollapsed] = useState(false);
  // Rang max par relation : pour chaque type de relation distinct,
  // garde les N arêtes de plus fort poids. 0 = aucune relation
  // (le plus restrictif), 20 = très permissif. Négations toujours
  // affichées peu importe la valeur.
  const [rankCap, setRankCap] = useState(20);
  const [maxNodes, setMaxNodes] = useState(40);
  const [format, setFormat] = useState('live');  // 'live' par défaut (animation graphique)
  // Layout en mode LIVE : 'tree' (arbre radial, défaut) ou 'rings' (cercles concentriques).
  const [liveLayout, setLiveLayout] = useState('tree');
  const [data, setData] = useState({ nodes: [], edges: [], stats: {}, html: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleIn = (set, setSet) => (r) =>
    setSet((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);

  // Compteur de séquence : si l'user change un param pendant qu'une
  // requête est en vol, on ne veut pas qu'une vieille réponse écrase
  // la dernière. On garde la dernière version vue, on jette tout ce
  // qui n'est pas elle (latest-wins).
  const buildSeq = React.useRef(0);

  const onBuild = async () => {
    const mySeq = ++buildSeq.current;
    const isStale = () => mySeq !== buildSeq.current;
    setLoading(true);
    setError('');
    setMessage('');

    // Mode LIVE : consomme l'endpoint SSE /api/subgraph/live qui émet
    // un snapshot 'graph' immédiat puis les nodes/edges progressivement.
    // L'iframe LIVE (HeroAnimation simulation) continue de tourner en
    // parallèle, mais on a maintenant un graphe réel JDM en data.
    if (format === 'live') {
      try {
        // Pas de cap dur en LIVE : l'utilisateur décide via le
        // slider maxNodes. Plancher à 25 pour LIVE pour laisser
        // de la place aux depth-2 (sinon avec top_k=3 × 7 relations,
        // la couronne depth-1 mange toute la quota et l'arbre
        // dégénère en cercle plat).
        const liveMaxNodes = Math.max(25, Number(maxNodes) || 30);
        const res = await fetch('api/subgraph/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term,
            depth: Number(depth),
            top_k: Number(topK),
            relations: activeRels,
            max_nodes: liveMaxNodes,
            // Cap par RANG (par type de relation) — pas un seuil de
            // poids absolu. Les négations sont toujours conservées
            // côté backend, peu importe la valeur.
            rank_cap: Number(rankCap),
          }),
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        let collectedNodes = [];
        let collectedEdges = [];
        // Parse SSE robust (CRLF + LF, comments, multi-line data)
        const flush = () => {
          const re = /\r\n\r\n|\n\n|\r\r/;
          let m;
          while ((m = re.exec(buf)) !== null) {
            const raw = buf.slice(0, m.index);
            buf = buf.slice(m.index + m[0].length);
            let evName = 'message', evData = '';
            for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('event:')) evName = line.slice(6).trim();
              else if (line.startsWith('data:'))
                evData += (evData ? '\n' : '') + line.slice(5).replace(/^ /, '');
            }
            if (!evData) continue;
            let parsed;
            try { parsed = JSON.parse(evData); } catch { parsed = { text: evData }; }
            if (evName === 'graph') {
              if (isStale()) return;
              collectedNodes = parsed.nodes || [];
              collectedEdges = parsed.edges || [];
              setData({ nodes: collectedNodes, edges: collectedEdges,
                        stats: { n_nodes: collectedNodes.length,
                                 n_edges: collectedEdges.length, depth },
                        html: '', format: 'live' });
            } else if (evName === 'error') {
              if (isStale()) return;
              setError(parsed.text || 'erreur LIVE');
            }
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (isStale()) { reader.cancel().catch(() => {}); return; }
          buf += decoder.decode(value, { stream: true });
          flush();
        }
      } catch (e) {
        if (isStale()) return;
        setError(String(e && e.message ? e.message : e));
      } finally {
        if (!isStale()) setLoading(false);
      }
      return;
    }

    // Modes HTML / JSON : appel REST classique à /api/subgraph
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
          // En HTML/SVG REST, on n'envoie plus min_weight (le slider
          // est désormais un cap par rang, géré côté live). Le backend
          // REST n'utilise pas cette info ; le top_k_per_relation y
          // joue déjà ce rôle.
          max_nodes: Number(maxNodes),
          format,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const d = await res.json();
      if (isStale()) return;
      setData({
        nodes: d.nodes || [],
        edges: d.edges || [],
        stats: d.stats || {},
        html: d.html || '',
        format: d.format,
      });
      if (d.message) setMessage(d.message);
    } catch (e) {
      if (isStale()) return;
      setError(String(e && e.message ? e.message : e));
      setData({ nodes: [], edges: [], stats: {}, html: '' });
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  // Auto-run au mount + à chaque incrément de runVersion
  // (utilisé par recenterTo pour relancer après setTerm).
  const [runVersion, setRunVersion] = useState(0);
  React.useEffect(() => { onBuild(); /* eslint-disable-next-line */ }, [runVersion]);

  // Recentre : utilisé par le clic sur un nœud en mode LIVE.
  const recenterTo = React.useCallback((newTerm) => {
    if (!newTerm || newTerm === term) return;
    setTerm(newTerm);
    setRunVersion(v => v + 1);
  }, [term]);

  // ── REACTIVITÉ LIVE — tous les paramètres du side bar relancent
  //    automatiquement la construction du graphe, avec debounce de
  //    400 ms (sliders, multi-toggles) pour ne pas spammer l'API.
  //    liveLayout est EXCLU des déps : il ne nécessite pas de fetch
  //    (le LiveAnimWrapper rebuild le scenario client-side).
  //    Le 1er render est déjà géré par le useEffect mount ci-dessus
  //    → on saute la 1re exécution de ce useEffect via un ref. ──
  const firstReactiveRun = React.useRef(true);
  React.useEffect(() => {
    if (firstReactiveRun.current) {
      firstReactiveRun.current = false;
      return;
    }
    const timer = setTimeout(() => setRunVersion(v => v + 1), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [
    term, depth, format,
    topK, topKd2, topKd3, topKd4,
    rankCap, maxNodes,
    // Sérialisation des listes pour détecter les toggles de relations
    activeRels.join(','), activeRelsD2.join(','),
    activeRelsD3.join(','), activeRelsD4.join(','),
  ]);

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {[
                  { id: 'html', value: 'html', label: 'HTML' },
                  { id: 'svg',  value: 'json', label: 'SVG' },
                  { id: 'live', value: 'live', label: 'LIVE', dot: true },
                ].map(f => {
                  const active = format === f.value;
                  return (
                    <button key={f.id}
                      onClick={() => setFormat(f.value)}
                      className="focus-ring"
                      style={{
                        padding: '8px',
                        background: active ? 'var(--accent)' : 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        color: active ? 'var(--bg)' : 'var(--ink)',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}>
                      {f.dot && (
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: active ? 'var(--bg)' : 'var(--jdm-green)',
                          animation: 'pulse-dot 1.2s ease-in-out infinite',
                        }}/>
                      )}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={`Rang max par relation · ${rankCap}`}>
              <Slider value={rankCap} onChange={setRankCap} min={0} max={20} step={1} />
              <div className="mono" style={{
                marginTop: 4, fontSize: 9, color: 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}>
                {rankCap === 0
                  ? '0 = aucune relation positive'
                  : `garde les ${rankCap} plus forts par type`}
                {' · négations toujours visibles'}
              </div>
            </Field>
            {(format === 'json' || format === 'live') && (
              <Field label={`Nœuds max · ${maxNodes}`}>
                <Slider value={maxNodes} onChange={setMaxNodes}
                  min={format === 'live' ? 25 : 10} max={200} step={5} />
              </Field>
            )}
            {/* Toggle layout — visible uniquement en mode LIVE */}
            {format === 'live' && (
              <Field label="Layout">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {[
                    { id: 'tree',  label: 'Arbre' },
                    { id: 'rings', label: 'Cercles' },
                  ].map(opt => {
                    const active = liveLayout === opt.id;
                    return (
                      <button key={opt.id}
                        onClick={() => setLiveLayout(opt.id)}
                        className="focus-ring"
                        style={{
                          padding: '8px',
                          background: active ? 'var(--accent)' : 'var(--bg-elev)',
                          border: '1px solid var(--line)',
                          color: active ? 'var(--bg)' : 'var(--ink)',
                          borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>{opt.label}</button>
                    );
                  })}
                </div>
              </Field>
            )}
            <div style={{ marginTop: 12 }}>
              <Button full disabled={loading} onClick={() => {
                setRunVersion(v => v + 1);
                // design-pass-2 : auto-collapse les niveau filters
                // pour libérer la vue, puis scroll au viz une fois
                // le layout reflowé (~80ms).
                setLevelsCollapsed(true);
                setTimeout(() => {
                  if (typeof scrollGroupIntoView === 'function' && vizRef.current) {
                    try { scrollGroupIntoView(vizRef.current, vizRef.current); } catch {}
                  }
                }, 80);
              }}>
                {loading ? 'Construction…' : 'Reconstruire'}
              </Button>
              <div className="mono" style={{
                marginTop: 6, fontSize: 9, color: 'var(--ink-3)',
                letterSpacing: '0.04em', textAlign: 'center',
              }}>
                tous les paramètres se rafraîchissent en direct
              </div>
            </div>
          </Card>

          {/* design-pass-2 : NiveauFilterCards ont migré dans la
              colonne droite au-dessus du viz (cf. juste ci-dessous).
              On laisse cette zone de sidebar dédiée à ConfigCard
              uniquement → plus court, plus aéré. */}
        </div>

        {/* Right: niveau filters (header global plier/déplier) + viz */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* Niveau filter cards — grid horizontal, 1 par profondeur active.
              Bouton global plier/déplier à droite du header. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0 2px',
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Filtres par niveau ({depth})</div>
              <button
                type="button"
                onClick={() => setLevelsCollapsed(c => !c)}
                className="focus-ring"
                title={levelsCollapsed ? 'Déplier' : 'Plier'}
                aria-label={levelsCollapsed ? 'Déplier tous les niveaux' : 'Plier tous les niveaux'}
                aria-expanded={!levelsCollapsed}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; }}
              >
                {levelsCollapsed ? 'déplier' : 'plier'}
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"
                  style={{
                    transform: levelsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s',
                  }}>
                  <path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.4"
                    fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${depth}, minmax(0, 1fr))`,
              gap: 12,
            }}>
              <RelationFilterCard
                label={`Niveau 1 — voisins (top-K ${topK})`}
                topK={topK} setTopK={setTopK}
                active={activeRels} setActive={setActiveRels}
                collapsed={levelsCollapsed}
              />
              {depth >= 2 && (
                <RelationFilterCard
                  label={`Niveau 2 (top-K ${topKd2})`}
                  topK={topKd2} setTopK={setTopKd2}
                  active={activeRelsD2} setActive={setActiveRelsD2}
                  collapsed={levelsCollapsed}
                />
              )}
              {depth >= 3 && (
                <RelationFilterCard
                  label={`Niveau 3 (top-K ${topKd3})`}
                  topK={topKd3} setTopK={setTopKd3}
                  active={activeRelsD3} setActive={setActiveRelsD3}
                  collapsed={levelsCollapsed}
                />
              )}
              {depth >= 4 && (
                <RelationFilterCard
                  label={`Niveau 4 (top-K ${topKd4})`}
                  topK={topKd4} setTopK={setTopKd4}
                  active={activeRelsD4} setActive={setActiveRelsD4}
                  collapsed={levelsCollapsed}
                />
              )}
            </div>
          </div>

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

          <div ref={vizRef}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)',
              gap: 12, flexWrap: 'wrap',
            }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{term}</span>
                {' · '}profondeur {depth}
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_nodes ?? data.nodes.length}</span> nœuds
                {' · '}<span style={{ color: 'var(--ink)' }}>{stats.n_edges ?? data.edges.length}</span> arêtes
                {' · '}<span className="mono" style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{data.format || format}</span>
              </div>
              {/* Légende des couleurs de relations — affichée ici en
                  header à côté de "LIVE" plutôt qu'en bas du canvas.
                  Uniquement en mode LIVE (les autres formats ont leurs
                  propres couleurs). */}
              {format === 'live' && (data.edges || []).length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8,
                  alignItems: 'center', maxWidth: '60%',
                }}>
                  {Array.from(new Set((data.edges || [])
                      .map(e => e.relation).filter(Boolean))).sort()
                    .map(r => (
                      <span key={r} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--ink-2)',
                      }}>
                        <span style={{
                          width: 14, height: 3, borderRadius: 2,
                          background: relColor(r),
                        }}/>
                        {r}
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div style={{
              // Hauteur adaptative selon le format :
              //  - HTML (vis-network iframe) : gros canvas, prend la viewport
              //  - SVG (rendu natif sur dataset) : moyen
              //  - LIVE (animation graphique) : prend toute la viewport dispo
              height: format === 'live'
                ? 'min(820px, calc(100vh - 180px))'
                : format === 'json'
                  ? 'min(720px, calc(100vh - 220px))'
                  : 'min(900px, calc(100vh - 220px))',
              minHeight: format === 'live' ? 640 : 560,
              background: 'var(--bg-card)',
              position: 'relative',
              transition: 'height 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              {data.format === 'html' && data.html ? (
                <iframe
                  title="JDM subgraph"
                  srcDoc={data.html}
                  sandbox="allow-scripts allow-same-origin"
                  style={{
                    width: '100%', height: '100%', border: 0, display: 'block',
                    // Le HTML interne a un fond transparent (override CSS
                    // injecté côté backend), donc l'iframe montre cette
                    // couleur — qui suit le thème via var(--bg).
                    background: 'var(--bg)',
                  }}
                />
              ) : format === 'live' ? (
                // Mode LIVE — graphe animé en boucle (sans chat).
                // À brancher sur /api/subgraph/live (SSE) — voir brief.
                // Pour l'instant : scénarios pré-enregistrés en démo.
                <div style={{ padding: 12, height: '100%' }}>
                  <LiveAnimWrapper
                    term={term}
                    nodes={data.nodes}
                    edges={data.edges}
                    layout={liveLayout}
                    onRecenter={recenterTo}
                  />
                </div>
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
          </div>

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

function RelationFilterCard({ label, topK, setTopK, active, setActive, collapsed = false }) {
  const toggle = (r) =>
    setActive((a) => a.includes(r) ? a.filter(x => x !== r) : [...a, r]);
  return (
    <Card padding={16}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: collapsed ? 0 : 10,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      {!collapsed && (<>
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
      </>)}
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
// Exposé pour le chat mascotte (jarvis-banner.jsx, module IIFE séparé) qui
// rend la viz LIVE inline : window.__JdmLiveGraph(term, nodes, edges, layout).
window.__JdmLiveGraph = LiveAnimWrapper;

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
  // Pré-remplissage depuis Projet › Quick try : si l'utilisateur a cliqué
  // « Ouvrir le chat » avec un prompt et un modèle, on les charge ici
  // SANS envoyer (le user clique Envoyer lui-même). Lu une seule fois
  // au mount, puis le payload est nettoyé.
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.chatbot) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.chatbot;
  }
  const [model, setModel] = useState(_pending?.model || 'gemini-3.1-flash-lite');
  const [thinking, setThinking] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [convo, setConvo] = useState([]);
  const [input, setInput] = useState(_pending?.q || '');
  const [streaming, setStreaming] = useState(false);
  const [poolStatus, setPoolStatus] = useState(null);
  const chatScrollRef = useRef(null);

  const needsBYOK = model.startsWith('claude-') || model.startsWith('gpt-');

  // Auto-scroll en bas quand le contenu change (génération en cours
  // ou nouveau message envoyé). Évite le décalage à chaque token.
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [convo, streaming]);

  // Renvoie une question utilisateur précédente comme nouveau message.
  // Utilisé par le bouton ↻ sur les bulles user.
  const resendUserMessage = (text) => {
    if (streaming || !text) return;
    setInput(text);
    // Trigger envoi dans le tick suivant — laisse setInput propager.
    setTimeout(() => send(text), 30);
  };

  // Charge l'état du pool pour griser les Gemini blown dans le dropdown.
  // Rafraîchi périodiquement et après chaque conversation (un PerDay
  // se déclare au cours du flow).
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('api/pool/status');
        if (r.ok && alive) setPoolStatus(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, 30_000);  // poll toutes les 30s
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Construit les options du dropdown avec marquage ❌ pour Gemini blown.
  const modelOptions = React.useMemo(() => {
    return AGENT_MODELS.map(m => {
      let label = m.label;
      let sub = m.sub;
      if (poolStatus && m.value.startsWith('gemini-')) {
        const allBlown = (poolStatus.keys || []).every(
          k => k.invalid || (k.blown_by_model && k.blown_by_model[m.value])
        );
        if (allBlown && poolStatus.keys && poolStatus.keys.length > 0) {
          label = `❌ ${label} — épuisé sur toutes les clés`;
          sub = 'pool entièrement consommé aujourd\'hui';
        }
      }
      return { ...m, label, sub };
    });
  }, [poolStatus]);

  // Send : POST /api/chatbot/stream, parse SSE en flux, accumule sur le
  // dernier message assistant (créé vide juste avant le fetch).
  // `overrideMsg` permet au bouton ↻ de re-soumettre une question
  // précédente sans passer par le state input (qui est async).
  const send = async (overrideMsg) => {
    // Défense : `onClick={send}` passe un SyntheticEvent React → on n'utilise
    // l'override que si c'est vraiment une string. Sinon (event, undefined,
    // null...) on retombe sur l'input courant.
    const isStringOverride = typeof overrideMsg === 'string';
    const effectiveMsg = isStringOverride ? overrideMsg : input;
    if (!effectiveMsg || !effectiveMsg.trim() || streaming) return;
    const userMsg = { role: 'user', content: effectiveMsg };
    const historySnapshot = convo.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? (m.content || '') : m.content,
    }));
    const assistantStub = { role: 'assistant', thoughts: [], tools: [], content: '', error: '' };
    setConvo([...convo, userMsg, assistantStub]);
    const msg = effectiveMsg;
    if (!isStringOverride) setInput('');
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
      const res = await fetch('api/chatbot/stream', {
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
      {/* Animation de l'icône JDMMark pendant le streaming. Une rotation
          lente (1.8s) reste sobre et sert d'indicateur visuel passif. */}
      <style>{`@keyframes jdm-mark-spin { to { transform: rotate(360deg); } }`}</style>
      <SectionTitle
        kicker="Module · chat LLM + outils JDM"
        title="Chatbot LLM"
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
            <div ref={chatScrollRef} style={{
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
              {convo.map((m, i) => (
                <Message key={i} m={m}
                  onResend={m.role === 'user' ? () => resendUserMessage(m.content) : null}
                  isStreaming={streaming && i === convo.length - 1 && m.role === 'assistant'}
                />
              ))}
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
                      e.preventDefault(); send(); return;
                    }
                    // Flèche bas : rappelle le dernier message envoyé de la
                    // session dans l'input, prêt à être renvoyé/édité.
                    if (e.key === 'ArrowDown') {
                      const last = [...convo].reverse().find(
                        (m) => m.role === 'user' && (m.content || '').trim());
                      if (last) { e.preventDefault(); setInput(last.content); }
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
              <Select value={model} options={modelOptions} onChange={setModel} />
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
    case 'viz':
      // Visualisation de sous-graphe : rendue inline (iframe via /api/subgraph).
      if (d && d.term) patchLast(last => { last.viz = d; });
      break;
    case 'error':
      patchLast(last => { last.error = d.text || 'Erreur inconnue.'; });
      break;
    default:
      break;
  }
}

// Bulle viz inline (Chatbot) — même endpoint /api/subgraph que l'onglet
// Sous-graphe. Affiche le graphe interactif dans une iframe, sans lien.
function AgentVizBubble({ viz }) {
  // live : graphe natif interactif (LiveAnimWrapper, même composant que
  // l'onglet Sous-graphe). html : iframe vis-network. params : fallback fetch.
  const isLive = viz && viz.format === 'live' && Array.isArray(viz.nodes);
  const Live = (typeof window !== 'undefined') ? window.__JdmLiveGraph : null;
  const [html, setHtml] = useState(viz && viz.html ? viz.html : '');
  const [err, setErr] = useState('');
  React.useEffect(() => {
    if (isLive || (viz && viz.html)) { if (viz.html) setHtml(viz.html); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch('api/subgraph', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...viz, format: 'html' }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const dd = await res.json();
        if (!alive) return;
        if (dd.html) setHtml(dd.html); else setErr(dd.message || 'Visualisation indisponible.');
      } catch (e) { if (alive) setErr(String(e && e.message ? e.message : e)); }
    })();
    return () => { alive = false; };
  }, [JSON.stringify(viz)]);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>
        🕸️ Sous-graphe : <strong style={{ color: 'var(--ink-2)' }}>{viz.term}</strong>
      </div>
      {isLive && Live
        ? <div style={{ width: '100%', minHeight: 360, border: '1px solid var(--line)',
                        borderRadius: 'var(--radius)', background: 'var(--bg)', overflow: 'hidden' }}>
            {React.createElement(Live, { term: viz.term, nodes: viz.nodes,
              edges: viz.edges || [], layout: 'tree' })}
          </div>
        : err
          ? <div style={{ color: 'var(--jdm-magenta)', fontSize: 12 }}>⚠️ {err}</div>
          : html
            ? <iframe title={`viz-${viz.term}`} srcDoc={html}
                      sandbox="allow-scripts allow-same-origin"
                      style={{ width: '100%', height: 420, border: '1px solid var(--line)',
                               borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
            : <div style={{ color: 'var(--ink-3)', fontSize: 12.5, padding: '14px 0' }}>… génération du graphe …</div>}
    </div>
  );
}

// ─── Rendu d'un message ────────────────────────────────────────

function Message({ m, onResend, isStreaming = false }) {
  if (m.role === 'user') {
    return <UserMessage content={m.content} onResend={onResend} />;
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: 6, marginTop: 2,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Animation : pendant que le LLM réfléchit ou streame, l'icône
        // tourne sur elle-même (remplace le texte « Réflexion en cours »).
        animation: isStreaming ? 'jdm-mark-spin 1.8s linear infinite' : 'none',
      }}>
        <JDMMark size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {m.content && (
          <div className="jdm-agent-bubble"
            style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
        )}
        {m.viz && <AgentVizBubble viz={m.viz} />}
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

// Bulle user — apparition des icônes copier / renvoyer au hover.
function UserMessage({ content, onResend }) {
  const [hovering, setHovering] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {}
  };
  const btn = {
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 999,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 11,
    color: 'var(--ink-3)',
    lineHeight: 1,
  };
  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 6 }}>
      {/* Boutons à GAUCHE de la bulle, alignés sur sa base */}
      <div style={{
        display: 'flex', gap: 4, alignItems: 'center',
        opacity: hovering ? 1 : 0,
        transition: 'opacity 0.15s',
        marginBottom: 2,
      }}>
        <button type="button" onClick={copy} title="Copier" style={{
          ...btn,
          color: copied ? 'var(--jdm-green)' : 'var(--ink-3)',
          borderColor: copied ? 'var(--jdm-green)' : 'var(--line)',
        }}>{copied ? '✓' : '⎘'}</button>
        {onResend && (
          <button type="button" onClick={onResend} title="Renvoyer" style={btn}>↻</button>
        )}
      </div>
      <div style={{
        maxWidth: '70%',
        padding: '10px 14px',
        background: 'var(--accent)',
        color: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        fontSize: 14,
        lineHeight: 1.5,
      }}>{content}</div>
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
                <span style={{ color: 'var(--ink-2)' }}>Clé {i + 1}</span>
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

// === webapp/views-chat.jsx ===
// View: Chat — discussion PLEIN ÉCRAN avec l'orchestrateur Jarvis.
//
// Partage l'état avec le volet latéral : on consomme le MÊME singleton de
// conversation (msgs/busy/stream en fond) et les MÊMES helpers de rendu
// (markdown, VizBubble) exposés par jarvis-banner.jsx sur `window.JarvisChat`
// (le banner est chargé avant le bundle). Aucune duplication de logique chat :
// envoyer/streaming/persistance vivent dans le store partagé.

function ViewChat() {
  const api = (typeof window !== 'undefined' && window.JarvisChat) || null;
  const store = api && api.store;
  const renderMd = (api && api.renderMd) ? api.renderMd : (t) => (t || '');
  const VizBubble = (api && api.VizBubble) ? api.VizBubble : null;

  // Re-render sur chaque changement du store partagé (même mécanisme que le volet).
  const [, _force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!store) return undefined;
    return store.subscribe(_force);
  }, [store]);

  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const snap = store ? store.get() : { msgs: [], busy: false };
  const msgs = snap.msgs || [];
  const busy = !!snap.busy;

  React.useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, busy]);

  const send = () => {
    const text = draft.trim();
    if (!text || !store) return;
    setDraft('');
    store.send(text);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return; }
    // Flèche bas : rappelle le dernier message envoyé (même geste que le volet).
    if (e.key === 'ArrowDown') {
      const last = [...msgs].reverse().find((m) => m.who === 'me' && (m.text || '').trim());
      if (last) { e.preventDefault(); setDraft(last.text); }
    }
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Orchestrateur"
        title="Jarvis · Chat"
        desc="Discute avec l'orchestrateur en plein écran : il supervise et lance les agents, explique le graphe JDM. Même conversation que le volet latéral (le fil continue en fond)." />

      {!store ? (
        <div style={{ color: 'var(--ink-3)', padding: '48px 0', textAlign: 'center' }}>
          Le chat n'est pas encore prêt (mascotte non chargée). Recharge la page.
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column',
          height: 'calc(100vh - 240px)', minHeight: 440,
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', background: 'var(--bg-card)',
        }}>
          {/* Corps : réutilise les classes globales du volet (jb-chat-body /
              jb-msg / jb-md / jb-viz) pour un rendu strictement identique. */}
          <div ref={scrollRef} className="jb-chat-body" style={{ flex: 1 }}>
            {msgs.map((m, i) => (
              m.who === 'viz'
                ? (VizBubble
                    ? React.createElement(VizBubble, { key: i, viz: m.viz })
                    : <div key={i} className="jb-msg jb-msg--bot">[graphe]</div>)
                : m.who === 'bot' && m.text
                  ? <div key={i} className="jb-msg jb-msg--bot jb-md"
                         dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
                  : <div key={i} className={`jb-msg jb-msg--${m.who}`}>{m.text}</div>
            ))}
            {busy && (
              <div className="jb-msg jb-msg--bot jb-msg--typing"><span></span><span></span><span></span></div>
            )}
          </div>

          {/* Saisie */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            padding: 12, borderTop: '1px solid var(--line-soft)', background: 'var(--bg-card)',
          }}>
            <textarea ref={inputRef} className="jb-chat-input" rows="2"
              placeholder="Écris ton message à Jarvis…"
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
              style={{ flex: 1 }} />
            <Button onClick={send} disabled={busy || !draft.trim()}>Envoyer</Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// === webapp/views-jarvis.jsx ===
// View: Jarvis — autonomous looping pipelines.
//
// Landing = a Projet-style panel carousel: a "Sommaire" overview panel
// followed by one design panel per flow, presented in sequence. Each flow
// panel shows its loop laid out step-by-step, the params you'll set, and a
// preview of the kind of results it accumulates, with a "Lancer" CTA that
// drops into the live auto-loop monitor (JarvisRun, unchanged).
//
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).

// Catalogue des 6 flux JDM réels (mapping vers les sous-commandes
// /api/jarvis/{agent_id}/stream du backend). Conserve la structure
// attendue par le design (id/title/kicker/desc/accent/loopOf/produces/
// category/tags/steps). Les TOOL_DOCS / AGENT_TOOL_STEPS / FLOW_FAKES
// restent fictifs en l'état (à câbler en phase 2 sur le vrai registre
// d'outils + SSE backend ; cf. handoff README §6).
const JARVIS_AGENTS = [
  {
    id: 'enrich',
    consolidates: true,  // lit le registry de consolidation (vs file_preview)
    title: 'Enrichissement',
    kicker: 'Agent 1',
    desc: 'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'proposition → validation → consolidation',
    produces: 'triplets consolidés (.enrich)',
    category: 'Production',
    tags: ['proposition', 'validation', 'consolidation', 'inférence', 'LLMDrops'],
    steps: [
      { n: 'Proposition',   d: 'propose des triplets candidats sur la relation cible' },
      { n: 'Validation',    d: 'factcheck JDM + inférence (effort 1/2)' },
      { n: 'Consolidation', d: 'écrit dans le .enrich ceux qui passent' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit sémantique',
    kicker: 'Agent 2',
    desc: 'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit deux sections (verdicts + META).',
    accent: 'var(--jdm-cyan)',
    loopOf: 'sens → triplet → verdict',
    produces: 'verdicts par sens (.audit)',
    category: 'Qualité',
    tags: ['polysémie', 'sens', 'verdict', 'META'],
    steps: [
      { n: 'Disambiguation', d: 'isole les sens dominants du terme' },
      { n: 'Cross-check',    d: 'audite chaque triplet par sens' },
      { n: 'Verdict',        d: 'LEGITIME / CONTRASTIF / À REVOIR / NEGATION' },
    ],
  },
  {
    id: 'gap',
    title: 'Détection de trous',
    kicker: 'Agent 3',
    desc: 'Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l\'enrichissement de façon ciblée. Sortie : rapport JSON.',
    accent: 'var(--jdm-green)',
    loopOf: 'parcours → diagnostic → trous',
    produces: 'rapport de trous (MISSING/LOW)',
    category: 'Exploration',
    tags: ['couverture', 'trous', 'diagnostic'],
    steps: [
      { n: 'Parcours',   d: 'inventorie les relations existantes' },
      { n: 'Diagnostic', d: 'compare à la couverture attendue' },
      { n: 'Trous',      d: 'liste les MISSING / NEGATIVE / LOW_COVERAGE' },
    ],
  },
  {
    id: 'signalement',
    title: 'Signalement',
    kicker: 'Agent 4',
    desc: 'Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.',
    accent: 'var(--jdm-orange)',
    loopOf: 'inventaire → flag → catégorisation',
    produces: 'suspects flaggés (.err)',
    category: 'Qualité',
    tags: ['suspects', 'incohérence', 'polarité', 'annotations'],
    steps: [
      { n: 'Inventaire',     d: 'récupère les triplets candidats à inspecter' },
      { n: 'Flag',           d: 'jugement linguistique LLM par triplet' },
      { n: 'Catégorisation', d: 'sémantique / polarité / annotation_oubliée / …' },
    ],
  },
  {
    id: 'stats',
    title: 'Stats',
    kicker: 'Agent 5',
    desc: 'Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré (.stat).',
    accent: 'var(--jdm-violet)',
    loopOf: 'inventaire → agrégation',
    produces: 'récap structuré (.stat)',
    category: 'Synthèse',
    tags: ['distribution', 'compteurs', 'poids'],
    steps: [
      { n: 'Inventaire', d: 'récupère les relations & leurs poids' },
      { n: 'Agrégation', d: 'distribution par relation & par terme' },
    ],
  },
  {
    id: 'annotation',
    title: 'Annotation sémantique',
    kicker: 'Agent 6',
    desc: 'Annote les triplets existants selon la taxonomie 4 catégories (constitutif / contrastif / non spécifique / exception). L\'annotation qualifie le LIEN, pas l\'objet. Produit un fichier .annot deux sections (annotations + signalement des désaccords avec JDM existant).',
    accent: 'var(--jdm-yellow)',
    loopOf: 'triplet → jugement → catégorie',
    produces: 'annotations (.annot)',
    category: 'Production',
    tags: ['constitutif', 'contrastif', 'taxonomie', 'lien'],
    steps: [
      { n: 'Lecture',  d: 'récupère les triplets à annoter pour le terme' },
      { n: 'Jugement', d: 'décide constitutif / contrastif / non spécifique / exception' },
      { n: 'Sortie',   d: 'écrit dans .annot + section SIGNALEMENT si désaccord JDM' },
    ],
  },
];

// Three top-level sections shown in the horizontal "sommaire" nav.
// Ordre = position dans le carrousel : Configuration (gauche) → Supervision
// (CENTRE = entree par defaut) → Repertoire (droite, ex-« Accueil »).
// Supervision est l'entree « tableau de bord live » de la console.
const J_SECTIONS = [
  { id: 'config',      label: 'Configuration' },
  { id: 'supervision', label: 'Supervision' },
  { id: 'repertoire',  label: 'Répertoire' },
];
// Carousel track = the 3 sections, then one detail panel per flow
// (reachable from the Accueil / Supervision cards).
const J_PANELS = [
  ...J_SECTIONS,
  ...JARVIS_AGENTS.map(f => ({ id: f.id, label: f.kicker })),
];
const JPANEL_BASIS = `${100 / J_PANELS.length}%`;

// ─────────────────────────────────────────────────────────────────────

// REAL BACKEND WIRING (extrait de fastapi-self) — câble le design Jarvis

// sur le vrai /api/jarvis/{agent_id}/stream + JarvisStore (singleton qui

// survit aux unmount, persiste runId en localStorage, reconcile au boot).

// ─────────────────────────────────────────────────────────────────────

// LLM peut le faire directement via upload=True). Gap n'écrit pas
// de fichier → pas soumissible. Tous les autres sortent un fichier
// avec une extension reconnue par submit_to_jdm.
const SUBMITTABLE_FLOWS = new Set(['enrich', 'audit', 'signalement',
                                    'stats', 'annotation']);

// Icône emoji par flux (même set que l'onglet Aide : brin d'herbe pour
// l'enrichissement, trou pour la détection de trous, etc.). Source unique
// d'identité visuelle des flux dans la console.
const AGENT_ICON = {
  enrich: '🌱', audit: '🔍', gap: '🕳️',
  signalement: '⚠️', stats: '📊', annotation: '🏷️',
};
const agentIcon = (id) => AGENT_ICON[id] || '🦾';

// Brief ULTRA court (une ligne) de ce que fait l'agent — affiché sur les
// cartes de lancement vides pour orienter d'un coup d'œil.
const AGENT_BRIEF = {
  enrich:      'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence) et consolide ceux qui passent dans un .enrich prêt pour LLMDrops.',
  audit:       'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives ou à corriger. Produit un .audit en deux sections (verdicts + META).',
  gap:         'Inventorie les relations d’un terme et repère les trous de couverture (manquantes, faibles, négatives) pour cibler l’enrichissement. Sortie : rapport de trous.',
  signalement: 'Parcourt les triplets d’un terme et flag ceux qui paraissent suspects (jugement linguistique), avec catégorie et justification. Produit un .err pour un mainteneur.',
  stats:       'Mesure la couverture d’un terme et/ou d’une relation : totaux, positifs/négatifs, poids, distribution — avec quelques observations clés en prose.',
  annotation:  'Annote les triplets d’un terme (constitutif / contrastif / exception…) et signale les désaccords avec JDM. Produit un fichier .annot.',
};

// Tête de robot Jarvis — réplique du dessin MiniRobot de la bannière
// (jarvis-banner.jsx), embarquée ici car le bundle ne peut pas importer le
// composant de la bannière (scope isolé). `size` = côté en px. Sert
// d'étiquette sur les cartes lancées hors JarvisRun (mascotte / serveur).
function JRobotHead({ size = 30, title }) {
  const accent = '#2BD4C0';
  return (
    <svg viewBox="0 0 80 74" width={size} height={Math.round(size * 74 / 80)}
      style={{ display: 'block', overflow: 'visible' }}
      role="img" aria-label={title || 'Jarvis'}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id="jrhbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#f3eee2" /><stop offset="1" stopColor="#dcd4c4" /></linearGradient>
        <linearGradient id="jrhjdm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E63B7A" /><stop offset="0.25" stopColor="#F5C518" /><stop offset="0.5" stopColor="#5FB94A" /><stop offset="0.75" stopColor="#2BB8D4" /><stop offset="1" stopColor="#8A5CD4" /></linearGradient>
        <linearGradient id="jrhvisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#33353f" /><stop offset="0.5" stopColor="#1a1b22" /><stop offset="1" stopColor="#0b0c10" /></linearGradient>
      </defs>
      <line x1="40" y1="14" x2="40" y2="6" stroke="#b8b0a0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="4.5" r="3" fill={accent} />
      <rect x="14" y="14" width="52" height="48" rx="19" fill="url(#jrhbody)" stroke="rgba(40,32,22,0.14)" strokeWidth="1.4" />
      <rect x="10" y="32" width="6" height="14" rx="3" fill="#cfc8b8" />
      <rect x="64" y="32" width="6" height="14" rx="3" fill="#cfc8b8" />
      <rect x="20" y="25" width="40" height="28" rx="13" fill="url(#jrhjdm)" opacity="0.95" />
      <rect x="22" y="27" width="36" height="24" rx="11" fill="url(#jrhvisor)" />
      <g>
        <circle cx="33" cy="39" r="4.4" fill={accent} />
        <circle cx="47" cy="39" r="4.4" fill={accent} />
        <circle cx="31.5" cy="37.5" r="1.4" fill="#fff" opacity="0.85" />
        <circle cx="45.5" cy="37.5" r="1.4" fill="#fff" opacity="0.85" />
      </g>
    </svg>
  );
}


// Bouton « 📤 Soumettre » / « ✓ Soumis » réutilisable (vue per-run, preview
// fichier, carte terminée). POST /api/productions/submit avec le basename ;
// clé LLMDrops prise côté serveur (.env JDM_DROPS_API_KEY) — donc grisé tant
// que ni clé serveur ni clé fournie. `submitted` initial vient du run/fichier ;
// devient ✓ après succès. `compact` = pastille icône-only pour les cartes.
function FileSubmitButton({ filePath, agentId, submitted, onDone, compact, running }) {
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const [state, setState] = useState('idle');   // idle | sending | error
  const [done, setDone] = useState(!!submitted);
  React.useEffect(() => { setDone(!!submitted); }, [submitted]);
  if (!filePath || !SUBMITTABLE_FLOWS.has(agentId)) return null;
  const fileName = filePath.split(/[\\/]/).slice(-1)[0];
  const canSubmit = _envHasDrops;
  const submit = async (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!canSubmit || state === 'sending' || done) return;
    // IDENTIQUE à JarvisRun : si le flow tourne encore, on DEMANDE
    // confirmation avant de soumettre un fichier partiel (ne jamais
    // soumettre à moitié sans validation explicite de l'utilisateur).
    if (running) {
      const ext = agentId === 'enrich' ? 'enrich' : agentId === 'audit' ? 'audit'
        : agentId === 'signalement' ? 'err' : agentId === 'stats' ? 'stat'
        : agentId === 'annotation' ? 'annot' : 'txt';
      const ok = window.confirm(
        'Le flow n\'est pas encore terminé — le fichier .' + ext +
        ' contient seulement les triplets produits jusqu\'à maintenant.' +
        '\n\nSoumettre maintenant quand même ?'
      );
      if (!ok) return;
    }
    setState('sending');
    // Modèle pour le nom de fichier uploadé = celui de la CONFIGURATION
    // Jarvis courante (window.__JDM_JARVIS_CONFIG__.llm). Évite le fallback
    // serveur générique : le drop porte le modèle réellement configuré.
    let _model = '';
    try {
      const cfg = (typeof window !== 'undefined' && window.__JDM_JARVIS_CONFIG__) || {};
      _model = cfg.llm || '';
    } catch (e) {}
    try {
      const r = await fetch('api/productions/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [fileName], archived: false, api_key: '', model_name: _model }),
      });
      const data = await r.json();
      const res = (data.results || [])[0] || {};
      if (res.ok) { setDone(true); setState('idle'); onDone && onDone(); }
      else { setState('error'); setTimeout(() => setState('idle'), 6000); }
    } catch { setState('error'); setTimeout(() => setState('idle'), 6000); }
  };
  if (done) {
    return (
      <Button size="sm" variant="ghost" disabled
        title="Déjà soumis au LLMDrops JDM"
        style={{ color: 'var(--jdm-green)', opacity: 1 }}>✓ Soumis</Button>
    );
  }
  const label = state === 'sending' ? '⏳ Envoi…' : state === 'error' ? '✗ Échec' : '📤 Soumettre';
  return (
    <Button size="sm" variant="ghost"
      disabled={!canSubmit || state === 'sending'}
      onClick={submit}
      title={canSubmit
        ? 'Soumettre ce fichier au LLMDrops JDM (clé serveur)'
        : 'Configure JDM_DROPS_API_KEY côté serveur pour activer la soumission'}>
      {compact ? (state === 'sending' ? '⏳' : state === 'error' ? '✗' : '📤') : label}
    </Button>
  );
}


// ─────────────────────────────────────────────────────────────────────
// JarvisStore — singleton qui survit aux unmounts de JarvisRun.
//
// Pourquoi : quand l'utilisateur quitte l'onglet Jarvis pendant un run,
// sans ce store le composant unmount, son fetch SSE est aborted par GC,
// sse-starlette détecte la déconnexion côté serveur, le générateur
// Python lève CancelledError → flow tué, progrès perdu, tokens LLM
// consommés pour rien.
//
// Avec : le reader SSE vit dans le store, indépendant du cycle React.
// Le composant lit l'état et se réabonne au mount. Le serveur ne voit
// pas de déconnexion, le flow continue, on retrouve tout en revenant.
//
// Bonus : permet l'affichage du badge « 🟢 en cours » sur la liste
// des flows (activeFlowIds()) — y compris depuis ViewJarvis.
// ─────────────────────────────────────────────────────────────────────
const _JARVIS_RUNS = {};
const _JARVIS_LISTENERS = {};

function _emptyJarvisRun(agentId) {
  return {
    agentId,
    status: 'idle',  // 'idle' | 'running' | 'done' | 'error'
    headline: '',
    log: [],
    metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
    submitted: false,  // passé à true par JarvisRun quand l'upload LLMDrops succès
    accepted: [],
    narrationHTML: '',
    filePreview: '',
    filePath: null,
    resumeState: null,
    // internes — pas lus par le composant
    _abortCtrl: null,
    _startTime: null,
    _elapsedTimer: null,
    _prevConsolidatedCount: 0,
  };
}

const JarvisStore = {
  get(agentId) {
    if (!_JARVIS_RUNS[agentId]) _JARVIS_RUNS[agentId] = _emptyJarvisRun(agentId);
    return _JARVIS_RUNS[agentId];
  },
  patch(agentId, partial) {
    Object.assign(this.get(agentId), partial);
    this._emit(agentId);
  },
  _emit(agentId) {
    const subs = _JARVIS_LISTENERS[agentId];
    if (subs) for (const cb of subs) { try { cb(); } catch {} }
    const glob = _JARVIS_LISTENERS['*'];
    if (glob) for (const cb of glob) { try { cb(); } catch {} }
  },
  subscribe(agentId, cb) {
    if (!_JARVIS_LISTENERS[agentId]) _JARVIS_LISTENERS[agentId] = new Set();
    _JARVIS_LISTENERS[agentId].add(cb);
    return () => { if (_JARVIS_LISTENERS[agentId]) _JARVIS_LISTENERS[agentId].delete(cb); };
  },
  activeFlowIds() {
    return Object.entries(_JARVIS_RUNS)
      .filter(([, s]) => s.status === 'running')
      .map(([id]) => id);
  },
  stop(agentId) {
    // Stop = cooperative cancellation côté serveur (POST /cancel) qui
    // pose un flag que le bg thread voit entre deux chunks → break du
    // for loop → finally blocs propres (exclusion_context exit, etc.).
    // Latence ≈ 5-15s (le round-trip LLM en cours se termine, aucun
    // nouveau ne démarre). En parallèle on coupe l'observation SSE
    // locale pour libérer le reader.
    const cur = this.get(agentId);
    if (cur.runId) {
      // Fire-and-forget : on n'attend pas la réponse pour ne pas bloquer
      // l'UI. Le bg confirmera le stop via event 'cancelled' dans la SSE
      // (que l'observation soit encore branchée ou pas — au pire on le
      // récupère au prochain bootReconcile via GET /runs).
      fetch(`api/jarvis/runs/${encodeURIComponent(cur.runId)}/cancel`, {
        method: 'POST',
      }).catch(() => {});
      const ts = () => new Date().toTimeString().slice(0, 8);
      cur.log = [...cur.log, {
        t: ts(), tag: '[stop]', kind: 'iter',
        msg: 'Demande d\'arrêt envoyée — le flow se termine après le chunk en cours (~5-15s).',
      }];
      this._emit(agentId);
    }
    if (cur._abortCtrl) try { cur._abortCtrl.abort(); } catch {}
  },
  reset(agentId) {
    const cur = this.get(agentId);
    if (cur._abortCtrl) try { cur._abortCtrl.abort(); } catch {}
    if (cur._elapsedTimer) clearInterval(cur._elapsedTimer);
    _localRunIdSet(agentId, null);  // purge la persistance localStorage
    _JARVIS_RUNS[agentId] = _emptyJarvisRun(agentId);
    this._emit(agentId);
  },

  // Helpers internes ─────────────────────────────────────
  _resetRunData(cur) {
    Object.assign(cur, {
      status: 'running',
      log: [],
      accepted: [],
      narrationHTML: '',
      filePreview: '',
      filePath: null,
      headline: '',
      metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
      submitted: false,
      _prevConsolidatedCount: 0,
      _startTime: Date.now(),
      runId: null,
    });
  },
  _startElapsedTimer(cur) {
    if (cur._elapsedTimer) clearInterval(cur._elapsedTimer);
    cur._elapsedTimer = setInterval(() => {
      cur.metrics = { ...cur.metrics, elapsed: Date.now() - (cur._startTime || Date.now()) };
      this._emit(cur.agentId);
    }, 250);
  },

  /**
   * Réattache une stream SSE à un run_id existant côté serveur. Utilisé
   * au boot pour reconnecter aux runs qui tournaient avant un refresh
   * ou une tab close. Le serveur replay tous les events bufferés puis
   * passe en live → on retrouve l'état exact.
   *
   * Cas d'usage : au boot, on lit localStorage, on GET /api/jarvis/runs
   * pour filtrer les still-active, et on appelle attach() pour chacun.
   */
  async attach(agentId, runId, knownHeadline) {
    const cur = this.get(agentId);
    if (cur.status === 'running') return;  // déjà attaché ou en cours
    this._resetRunData(cur);
    cur.status = 'running';
    cur.runId = runId;
    if (knownHeadline) cur.headline = knownHeadline;
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(agentId);
    await this._consumeStream(
      agentId,
      `api/jarvis/runs/${encodeURIComponent(runId)}/stream`,
      { method: 'GET' },
      cur._abortCtrl,
    );
  },
  async start(agentId, { params, isResume, resumeState }) {
    const cur = this.get(agentId);
    if (cur.status === 'running') return;
    // Mémorise les params du run (notamment target_count) pour que la
    // barre de progression / le label X/Y reflètent la VRAIE cible
    // demandée, pas le défaut du flux.
    cur.params = params || {};
    if (!isResume) {
      this._resetRunData(cur);
    } else {
      const ts = () => new Date().toTimeString().slice(0, 8);
      cur.status = 'running';
      cur.log = [...cur.log, { t: ts(), tag: '[resume]', kind: 'iter', msg: 'Reprise après abort PerDay…' }];
    }
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(agentId);

    const flowParams = {
      ...params,
      ...(isResume && resumeState ? { resume_state: resumeState } : {}),
    };
    await this._consumeStream(
      agentId,
      `api/jarvis/${agentId}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, params: flowParams }),
      },
      cur._abortCtrl,
    );
  },

  // Boucle de consommation SSE partagée par start() et attach(). Le
  // dispatchEv gère désormais 'run_id' (persisté en localStorage pour
  // reconnexion ultérieure) et 'ping' (keepalive — ignoré).
  async _consumeStream(agentId, url, fetchInit, abortCtrl) {
    const cur = this.get(agentId);
    const ts = () => new Date().toTimeString().slice(0, 8);
    try {
      const res = await fetch(url, {
        ...fetchInit,
        signal: abortCtrl.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      const dispatchEv = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'run_id':
            // Premier event de la SSE POST — on persiste pour reconnect.
            if (d.run_id) {
              cur.runId = d.run_id;
              _localRunIdSet(agentId, d.run_id);
            }
            break;
          case 'ping':
            // Keepalive serveur (toutes les ~20s d'idle) — no-op.
            break;
          case 'headline':
            cur.headline = d.text || '';
            // Premier event utile : on enregistre le run_id côté serveur
            // si présent dans le payload (sécurité / cas de reconnect).
            if (d.run_id && !cur.runId) {
              cur.runId = d.run_id;
              _localRunIdSet(agentId, d.run_id);
            }
            cur.log = [...cur.log, { t: ts(), tag: '[start]', kind: 'iter', msg: d.text || '' }];
            break;
          case 'jarvis': {
            const msgs = d.messages || [];
            const assistant = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            if (d.state) cur.resumeState = d.state;
            if (assistant && assistant.content) cur.narrationHTML = assistant.content;
            const cc = Number(d.consolidated_count || 0);
            if (cc !== cur._prevConsolidatedCount) {
              cur.metrics = { ...cur.metrics, accepted: cc };
              cur._prevConsolidatedCount = cc;
            }
            if (assistant && assistant.content) {
              const toolMatches = assistant.content.match(/class="jdm-narration"/g) || [];
              cur.metrics = { ...cur.metrics, toolsCalled: toolMatches.length };
            }
            if (typeof d.tokens_estimate === 'number') {
              cur.metrics = { ...cur.metrics, tokens: d.tokens_estimate };
            }
            if (Array.isArray(d.consolidated)) {
              // On garde tous les champs utiles à <ItemCard> (subject/
              // relation/target/explanation) pour pouvoir afficher
              // l'explication d'inférence sous chaque triplet — même
              // rendu que les autres flows.
              cur.accepted = d.consolidated.map(c => ({
                type: 'consolidated',
                subject: c.term || '',
                relation: c.relation || '',
                target: c.target || '',
                explanation: c.explanation || '',
                // Compat ancien rendu (label/score) : conservés au cas où.
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: '✓',
              }));
              // Push une entry log [ok] par NOUVEAU triplet (= delta avec
              // le compteur précédent). Permet à la zone « flux en direct »
              // de la Supervision d'afficher chaque consolidation au format
              // triplet pretty, à côté des autres events système ([file],
              // [start], etc.). Le _loggedAcceptedCount est strictement
              // monotone : si d.consolidated diminue (reset), on ne push
              // rien et on baisse le compteur sans bruit.
              const _prevLogged = cur._loggedAcceptedCount || 0;
              const nbNew = d.consolidated.length - _prevLogged;
              if (nbNew > 0) {
                const newOnes = d.consolidated.slice(_prevLogged);
                for (const c of newOnes) {
                  cur.log = [...cur.log, {
                    t: ts(), tag: '[ok]', kind: 'accept',
                    msg: `${c.term} | ${c.relation} | ${c.target}`,
                    triplet: {
                      term: c.term, relation: c.relation, target: c.target,
                      schema: c.schema || '',
                      explanation: c.explanation || '',
                    },
                  }];
                }
              }
              cur._loggedAcceptedCount = d.consolidated.length;
            }
            if (typeof d.file_preview === 'string') cur.filePreview = d.file_preview;
            if (d.file_path) {
              // cur.filePath = toujours updaté (suit le dernier path actif :
              // canonical_path en cours d'auto_append OU dernier path écrit par
              // le LLM — backend alterne entre les deux).
              cur.filePath = d.file_path;
              // Le LOG ne push qu'une seule entrée par path UNIQUE — sinon
              // on voit alterner [file] enrichment_submission.enrich /
              // [file] jdm_*.enrich à chaque tick parce que le backend
              // yield les deux sources (canonical vs path LLM) en boucle.
              const fileMsg = `Fichier : ${d.file_path}`;
              const alreadyLogged = cur.log.some(
                l => l.tag === '[file]' && l.msg === fileMsg
              );
              if (!alreadyLogged) {
                cur.log = [...cur.log, {
                  t: ts(), tag: '[file]', kind: 'accept', msg: fileMsg,
                }];
              }
            }
            break;
          }
          case 'cancelled':
            // Le bg thread a vu le flag et a fait sync_gen.close() —
            // les finally ont tourné, le flow s'est arrêté proprement.
            // Le serveur peut encore pousser un 'done' juste après pour
            // confirmer la fin de boucle — on ignorera le doublon car
            // status est déjà 'done'.
            cur.log = [...cur.log, { t: ts(), tag: '[stop]', kind: 'iter', msg: d.text || 'Flow annulé.' }];
            cur.status = 'done';
            _localRunIdSet(agentId, null);
            break;
          case 'done':
            // Idempotent : si déjà 'done' (post-cancellation), on ne
            // ré-écrit pas l'event log avec un message contradictoire.
            if (cur.status !== 'done') {
              cur.log = [...cur.log, { t: ts(), tag: '[done]', kind: 'accept', msg: 'Flow terminé.' }];
              cur.status = 'done';
            }
            _localRunIdSet(agentId, null);
            break;
          case 'error':
            cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: d.text || 'erreur' }];
            cur.status = 'error';
            _localRunIdSet(agentId, null);
            break;
        }
        this._emit(agentId);
      };
      const flush = () => {
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const raw = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEventJarvis(raw);
          if (ev) dispatchEv(ev);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        flush();
      }
      if (buf.trim()) {
        const ev = parseSSEEventJarvis(buf);
        if (ev) dispatchEv(ev);
      }
      if (cur.status === 'running') cur.status = 'done';
    } catch (e) {
      if (cur._abortCtrl && cur._abortCtrl.signal.aborted) {
        // Abort côté client = on arrête l'observation. Le bg thread
        // serveur peut continuer — donc on ne marque PAS done, on
        // garde le runId. La reconnexion ultérieure (boot reconcile)
        // récupérera la progression.
        cur.log = [...cur.log, { t: ts(), tag: '[stop]', kind: 'iter', msg: 'Observation arrêtée (le flow continue côté serveur).' }];
        // Statut = idle pour signaler que le composant local est détaché ;
        // le badge "en cours" reste via le serveur listing au prochain
        // bootReconcile() ou getRunStatus().
        cur.status = 'idle';
      } else {
        cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: String(e && e.message ? e.message : e) }];
        cur.status = 'error';
        _localRunIdSet(agentId, null);
      }
    } finally {
      if (cur._elapsedTimer) { clearInterval(cur._elapsedTimer); cur._elapsedTimer = null; }
      this._emit(agentId);
    }
  },

  // Boot reconcile : appelée une fois au démarrage de l'app pour
  // détecter les runs qui tournaient encore côté serveur quand
  // l'utilisateur a fermé la tab / refresh / etc. Pour chaque
  // (agentId, runId) trouvé en localStorage qui est encore actif
  // côté serveur, on rouvre une stream pour récupérer la progression.
  async bootReconcile() {
    let local = {};
    try { local = _localRunIdMap(); } catch {}
    const agentIds = Object.keys(local);
    if (agentIds.length === 0) return;
    let serverRuns = [];
    try {
      const r = await fetch('api/jarvis/runs');
      if (r.ok) {
        const d = await r.json();
        serverRuns = d.runs || [];
      }
    } catch {}
    const activeOnServer = new Map(
      serverRuns
        .filter(s => s.status === 'starting' || s.status === 'running')
        .map(s => [s.run_id, s])
    );
    for (const agentId of agentIds) {
      const runId = local[agentId];
      if (!runId) continue;
      const serverInfo = activeOnServer.get(runId);
      if (!serverInfo) {
        // Plus actif côté serveur (terminé, ou TTL dépassé, ou process
        // restart) → purge la persistance.
        _localRunIdSet(agentId, null);
        continue;
      }
      // Reconnect — fire-and-forget. attach() retourne après que la
      // stream se ferme (= run terminé) ou que l'observation est
      // arrêtée par l'utilisateur. Pas besoin d'attendre.
      this.attach(agentId, runId, serverInfo.headline).catch(() => {});
    }
  },
};

// ── localStorage helpers ────────────────────────────────────────
// Stocke un mapping {[agentId]: runId} pour permettre la reconnexion
// au boot après refresh / tab close. Effacée à la terminaison normale
// (done / error) du flow ou au reset explicite.
const _JARVIS_LS_KEY = 'jdm_jarvis_runs_v1';

function _localRunIdMap() {
  try {
    const raw = localStorage.getItem(_JARVIS_LS_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch { return {}; }
}
function _localRunIdSet(agentId, runId) {
  try {
    const cur = _localRunIdMap();
    if (runId) cur[agentId] = runId; else delete cur[agentId];
    localStorage.setItem(_JARVIS_LS_KEY, JSON.stringify(cur));
  } catch {}
}
if (typeof window !== 'undefined') window.__jdmJarvisStore = JarvisStore;

function useJarvisRunState(agentId) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe(agentId, force), [agentId]);
  return JarvisStore.get(agentId);
}

function useJarvisActiveSet() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe('*', force), []);
  return new Set(JarvisStore.activeFlowIds());
}

// ─────────────────────────────────────────────────────────────────────
// ObsStore — store d'OBSERVATION keyé par run_id, dédié à la SUPERVISION.
// Indépendant de JarvisStore (qui reste keyé par flow pour la vue de
// lancement, INCHANGÉE). Permet d'afficher PLUSIEURS runs du même type de
// flux côté à côté, chacun avec son propre feed temps réel + détail.
// Chaque run observé se branche sur /api/jarvis/runs/{id}/stream (catch-up
// + live). Consume compact dédié (pas de persistance localStorage ni de
// logique resume — c'est de la pure observation lecture seule).
// ─────────────────────────────────────────────────────────────────────
const _OBS_RUNS = {};
const _OBS_LISTENERS = {};

function _emptyObsRun(runId, agentId) {
  return {
    runId, agentId: agentId || '', status: 'idle', headline: '',
    log: [], accepted: [], narrationHTML: '', filePreview: '', filePath: null,
    metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
    submitted: false,
    _observing: false, _abortCtrl: null,
    _prevConsolidatedCount: 0, _loggedAcceptedCount: 0,
  };
}

const ObsStore = {
  getRun(runId) {
    if (!_OBS_RUNS[runId]) _OBS_RUNS[runId] = _emptyObsRun(runId);
    return _OBS_RUNS[runId];
  },
  _emit(runId) {
    const s = _OBS_LISTENERS[runId];
    if (s) for (const cb of s) { try { cb(); } catch {} }
    const g = _OBS_LISTENERS['*'];
    if (g) for (const cb of g) { try { cb(); } catch {} }
  },
  subscribe(runId, cb) {
    if (!_OBS_LISTENERS[runId]) _OBS_LISTENERS[runId] = new Set();
    _OBS_LISTENERS[runId].add(cb);
    return () => { if (_OBS_LISTENERS[runId]) _OBS_LISTENERS[runId].delete(cb); };
  },
  observe(runId, agentId, headline) {
    if (!runId) return;
    const cur = this.getRun(runId);
    if (cur._observing) return;  // déjà branché
    cur._observing = true;
    cur.agentId = agentId || cur.agentId;
    if (headline && !cur.headline) cur.headline = headline;
    if (cur.status === 'idle') cur.status = 'running';
    cur._abortCtrl = new AbortController();
    this._emit(runId);
    this._consume(runId, cur).finally(() => { cur._observing = false; });
  },
  stopObs(runId) {
    if (!runId) return;
    const cur = this.getRun(runId);
    fetch(`api/jarvis/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' }).catch(() => {});
    cur.log = [...cur.log, { t: new Date().toTimeString().slice(0, 8),
      tag: '[stop]', kind: 'iter', msg: "Demande d'arrêt envoyée — fin après le chunk en cours (~5-15s)." }];
    this._emit(runId);
  },
  async _consume(runId, cur) {
    const ts = () => new Date().toTimeString().slice(0, 8);
    const emit = () => this._emit(runId);
    try {
      const res = await fetch(`api/jarvis/runs/${encodeURIComponent(runId)}/stream`,
                             { signal: cur._abortCtrl.signal });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      const onEv = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'ping': case 'run_id': break;
          case 'headline': cur.headline = d.text || cur.headline; break;
          case 'jarvis': {
            const msgs = d.messages || [];
            const a = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            if (a && a.content) {
              cur.narrationHTML = a.content;
              const tm = a.content.match(/class="jdm-narration"/g) || [];
              cur.metrics = { ...cur.metrics, toolsCalled: tm.length };
            }
            const cc = Number(d.consolidated_count || 0);
            if (cc !== cur._prevConsolidatedCount) {
              cur.metrics = { ...cur.metrics, accepted: cc };
              cur._prevConsolidatedCount = cc;
            }
            if (typeof d.tokens_estimate === 'number') cur.metrics = { ...cur.metrics, tokens: d.tokens_estimate };
            if (Array.isArray(d.consolidated)) {
              cur.accepted = d.consolidated.map(c => ({
                type: 'consolidated', subject: c.term || '', relation: c.relation || '',
                target: c.target || '', explanation: c.explanation || '',
                label: `${c.term} | ${c.relation} | ${c.target}`, score: '✓' }));
              const prev = cur._loggedAcceptedCount || 0;
              const nbNew = d.consolidated.length - prev;
              if (nbNew > 0) for (const c of d.consolidated.slice(prev)) cur.log = [...cur.log, {
                t: ts(), tag: '[ok]', kind: 'accept', msg: `${c.term} | ${c.relation} | ${c.target}`,
                triplet: { term: c.term, relation: c.relation, target: c.target, schema: c.schema || '', explanation: c.explanation || '' } }];
              cur._loggedAcceptedCount = d.consolidated.length;
            }
            if (typeof d.file_preview === 'string') cur.filePreview = d.file_preview;
            if (d.file_path) {
              cur.filePath = d.file_path;
              const fm = `Fichier : ${d.file_path}`;
              if (!cur.log.some(l => l.tag === '[file]' && l.msg === fm))
                cur.log = [...cur.log, { t: ts(), tag: '[file]', kind: 'accept', msg: fm }];
            }
            break;
          }
          case 'cancelled':
            cur.log = [...cur.log, { t: ts(), tag: '[stop]', kind: 'iter', msg: d.text || 'Flow annulé.' }];
            cur.status = 'done'; break;
          case 'done':
            if (cur.status !== 'done') { cur.log = [...cur.log, { t: ts(), tag: '[done]', kind: 'accept', msg: 'Flow terminé.' }]; cur.status = 'done'; }
            break;
          case 'error':
            cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: d.text || 'erreur' }];
            cur.status = 'error'; break;
        }
        emit();
      };
      const flush = () => {
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const raw = buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEventJarvis(raw); if (ev) onEv(ev);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        flush();
      }
      if (buf.trim()) { const ev = parseSSEEventJarvis(buf); if (ev) onEv(ev); }
      if (cur.status === 'running') cur.status = 'done';
    } catch (e) {
      if (!(cur._abortCtrl && cur._abortCtrl.signal.aborted)) {
        cur.status = 'error';
        cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: String(e && e.message ? e.message : e) }];
      }
    } finally { emit(); }
  },
};
if (typeof window !== 'undefined') window.__jdmObsStore = ObsStore;

function useObsRun(runId) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => (runId ? ObsStore.subscribe(runId, force) : undefined), [runId]);
  return runId ? ObsStore.getRun(runId) : null;
}

function ItemCard({ item, accent }) {
  // Couleur de bord par type — signal visuel rapide.
  const typeStyle = {
    consolidated:       { border: 'var(--jdm-green)',   icon: '✓', label: 'consolidé' },
    flagged:            { border: 'var(--jdm-orange)',  icon: '⚠', label: 'suspect' },
    signalement:        { border: 'var(--jdm-magenta)', icon: '!', label: 'désaccord JDM' },
    audit_signalement:  { border: 'var(--jdm-magenta)', icon: '!', label: 'verdict' },
    sens:               { border: 'var(--line)',        icon: '·', label: 'sens' },
    meta:               { border: 'var(--accent)',      icon: '✎', label: 'observation' },
  }[item.type] || { border: 'var(--line)', icon: '·', label: '' };

  // Item meta = ligne de prose simple, pas un triplet.
  if (item.type === 'meta') {
    return (
      <div className="fade-up" style={{
        padding: '8px 10px',
        background: 'var(--bg-elev)',
        borderLeft: `3px solid ${typeStyle.border}`,
        borderRadius: '0 var(--radius) var(--radius) 0',
        fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5,
      }}>{item.raw}</div>
    );
  }

  // Triplet + (option) catégorie + (option) bloc explication.
  const tripletLine = (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <span style={{ color: typeStyle.border, flexShrink: 0,
                     fontWeight: 700, width: 12, textAlign: 'center' }}>
        {typeStyle.icon}
      </span>
      <span style={{ color: 'var(--ink)' }}>
        {item.subject} <span style={{ color: 'var(--ink-3)' }}>|</span>
        {' '}{item.relation} <span style={{ color: 'var(--ink-3)' }}>|</span>
        {' '}{item.target}
      </span>
    </div>
  );

  // Catégorie / verdict / JDM≠LLM — affiché en chip discret sous le triplet.
  const chips = [];
  if (item.category) chips.push({ k: 'cat', v: item.category });
  if (item.verdict)  chips.push({ k: 'verdict', v: item.verdict });
  if (item.jdm)      chips.push({ k: 'JDM', v: item.jdm });
  if (item.llm)      chips.push({ k: 'LLM', v: item.llm });

  return (
    <div className="fade-up" style={{
      padding: '8px 10px',
      background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)',
      borderLeft: `3px solid ${typeStyle.border}`,
      borderRadius: '0 var(--radius) var(--radius) 0',
    }}>
      {tripletLine}
      {chips.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          marginTop: 6, marginLeft: 18,
        }}>
          {chips.map((c, i) => (
            <span key={i} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--line-soft)',
              borderRadius: 3,
              color: c.k === 'LLM' ? typeStyle.border
                   : c.k === 'JDM' ? 'var(--ink-3)'
                   : 'var(--ink-2)',
            }}>
              <span style={{ color: 'var(--ink-3)' }}>{c.k}:</span> {c.v}
            </span>
          ))}
        </div>
      )}
      {/* Bloc explication stylisé — c'est ce que le LLM a dit sur ce
          signalement / verdict / désaccord. C'est ÇA la valeur ajoutée
          du flow ; on la met bien en évidence. */}
      {item.explanation && (
        <div style={{
          marginTop: 6, marginLeft: 18,
          padding: '6px 9px',
          background: 'var(--bg-card)',
          borderLeft: `2px solid ${accent || typeStyle.border}`,
          borderRadius: '0 3px 3px 0',
          fontSize: 11, color: 'var(--ink-2)',
          lineHeight: 1.5, fontStyle: 'italic',
        }}>
          {item.explanation}
        </div>
      )}
    </div>
  );
}

// ─── Markdown render (reuse pattern from views-agent) ────────────
// Contenu produit par notre propre LLM = confiance, on n'escape pas.
// marked.js (chargé dans index.html) fait tout le boulot ; fallback
// léger si non disponible.
function renderMarkdownJarvis(s) {
  s = s || '';
  if (typeof window !== 'undefined' && window.marked) {
    try {
      window.marked.setOptions({ gfm: true, breaks: true });
      return window.marked.parse(s);
    } catch {}
  }
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>')
    .replace(/\n/g, '<br/>');
}

// ─── parseFilePreview ─────────────────────────────────────────────
// À partir du contenu textuel d'un .enrich / .err / .audit / .annot /
// .stat, extrait une liste structurée d'items à afficher dans le
// panneau de droite. Chaque item :
//   { type: 'consolidated'|'flagged'|'signalement'|'annotation'|'meta'|'sens',
//     subject, relation, target,    (canonique pipe-separated)
//     category, verdict, jdm, llm,  (champs optionnels selon type)
//     explanation,                  (justification / argument contre)
//     raw }                         (la ligne brute pour fallback)
//
// Comprend les 4 formats :
//   .enrich : term|rel|target|annotation < explanation >
//   .err    : term|rel|target|catégorie_suspect|justification
//   .annot  : sujet|rel|objet|annotation < justif >  +  section
//             =====SIGNALEMENT===== : sujet|rel|objet|JDM:x|LLM:y < arg >
//   .audit  : sections === SENS ===, === SIGNALEMENTS ===, === META ===
//             la section SIGNALEMENTS contient term|rel|target|verdict|justif
function parseFilePreview(text, agentId) {
  text = (text || '').toString();
  if (!text.trim()) return { items: [], counts: {} };
  const lines = text.split(/\r?\n/);
  const items = [];
  let inSignalement = false;
  let inAuditSignalements = false;
  let inAuditMeta = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Commentaires (# ...) sauvent comme meta light, on saute pour
    // l'affichage principal mais on sait les détecter.
    if (line.startsWith('#')) continue;

    // Délimiteurs de sections
    const upper = line.toUpperCase();
    if (/^=====+SIGNALEMENT=====+/i.test(line) ||
        upper.includes('SIGNALEMENT')) {
      inSignalement = true;
      inAuditSignalements = upper.includes('=== SIGNALEMENT') ||
                            upper.includes('SIGNALEMENTS ===');
      inAuditMeta = false;
      continue;
    }
    if (/^===\s*META\s*===$/i.test(line)) {
      inAuditMeta = true; inSignalement = false; inAuditSignalements = false;
      continue;
    }
    if (/^===\s*SENS\s*===$/i.test(line)) {
      inAuditMeta = false; inSignalement = false; inAuditSignalements = false;
      // SENS dans audit → on les push comme type 'sens'
      // (la 1re ligne après le délimiteur sera la suivante)
      continue;
    }
    // Bloc META : prose, on peut le montrer dans une carte spéciale
    if (inAuditMeta) {
      items.push({ type: 'meta', raw: line });
      continue;
    }

    // Format avec explication entre < > (commune à .enrich/.annot/.audit)
    // Accepte les pipes avec OU sans espaces (\s*) et l'annotation entre
    // crochets optionnels [...] (le nouveau format) — rétro-compat
    // avec l'ancien format sans espaces/crochets.
    const mWithExplain = line.match(/^([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)(?:\s+<\s*(.+?)\s*>\s*)?$/);
    if (mWithExplain) {
      const [, subject, relation, target, restRaw, explanation] = mWithExplain;
      // Strip les crochets autour de l'annotation pour l'affichage
      // (le nouveau format les ajoute, on les retire pour l'UI).
      const stripBrackets = (s) => (s || '').trim().replace(/^\[(.*)\]$/, '$1').trim();
      const rest = restRaw.trim();
      // Section SIGNALEMENT du .annot : rest peut contenir
      // "JDM:[x] | LLM:[y]" (nouveau) ou "JDM:<x>|LLM:<y>" (ancien) → extraction tolérante.
      if (inSignalement && /JDM\s*:/i.test(rest) && /LLM\s*:/i.test(rest)) {
        const jdmM = rest.match(/JDM\s*:\s*\[?([^|\]]+)\]?\s*\|\s*LLM\s*:\s*\[?(.+?)\]?\s*$/i);
        if (jdmM) {
          const jdmVal = jdmM[1].trim();
          const llmVal = jdmM[2].trim();
          // Filtrage anti-bug : si JDM == LLM (= pas un vrai désaccord),
          // on REND quand même la ligne mais comme `consolidated` pour
          // ne pas tromper le compteur de signalements et ne pas
          // laisser ce faux désaccord en évidence.
          if (jdmVal.toLowerCase() === llmVal.toLowerCase()) {
            items.push({
              type: 'consolidated',
              subject: subject.trim(), relation: relation.trim(),
              target: target.trim(),
              category: llmVal,
              explanation: (explanation || '').trim(),
              raw: line,
            });
            continue;
          }
          items.push({
            type: 'signalement',
            subject: subject.trim(), relation: relation.trim(),
            target: target.trim(),
            jdm: jdmVal, llm: llmVal,
            explanation: (explanation || '').trim(),
            raw: line,
          });
          continue;
        }
      }
      // .err format : rest = catégorie_suspect, explanation
      if (agentId === 'signalement' || /suspect/i.test(rest)) {
        items.push({
          type: 'flagged',
          subject: subject.trim(), relation: relation.trim(),
          target: target.trim(),
          category: stripBrackets(rest),
          explanation: (explanation || '').trim(),
          raw: line,
        });
        continue;
      }
      // .audit signalements section : rest = verdict
      if (inAuditSignalements) {
        items.push({
          type: 'audit_signalement',
          subject: subject.trim(), relation: relation.trim(),
          target: target.trim(),
          verdict: stripBrackets(rest),
          explanation: (explanation || '').trim(),
          raw: line,
        });
        continue;
      }
      // .enrich / .annot : rest = annotation (avec ou sans crochets)
      items.push({
        type: inSignalement ? 'signalement' : 'consolidated',
        subject: subject.trim(), relation: relation.trim(),
        target: target.trim(),
        category: stripBrackets(rest),
        explanation: (explanation || '').trim(),
        raw: line,
      });
      continue;
    }

    // Lignes 'pure pipe' (.audit SENS, autres tableaux .stat)
    const piped = line.match(/^([^|]+)\|([^|]+)\|([^|]+)$/);
    if (piped) {
      items.push({
        type: 'sens',
        subject: piped[1].trim(),
        relation: piped[2].trim(),
        target: piped[3].trim(),
        raw: line,
      });
      continue;
    }
  }

  // Compteurs par type — utiles pour le dashboard.
  const counts = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});
  return { items, counts };
}

// Libellé adaptatif du compteur "Consolidés" selon le flow.
// (design-pass-2 : aligné sur le wording designer — Signalés/Analysés)
function metricLabelFor(agentId) {
  switch (agentId) {
    case 'enrich':      return { label: 'Consolidés',  sub: 'triplets' };
    case 'audit':       return { label: 'Verdicts',    sub: 'signalements' };
    case 'signalement': return { label: 'Signalés',    sub: 'triplets flaggés' };
    case 'annotation':  return { label: 'Annotations', sub: '+ signalements' };
    case 'stats':       return { label: 'Analysés',    sub: 'Termes/Relations' };
    case 'gap':         return { label: 'Trous',       sub: 'détectés' };
    default:            return { label: 'Items',       sub: 'produits' };
  }
}

// Titre adaptatif du panneau de droite selon le flow.
// (design-pass-2 : 'Triplets signalés' + 'Artefacts analysés')
function panelTitleFor(agentId) {
  switch (agentId) {
    case 'enrich':      return 'Triplets consolidés';
    case 'audit':       return 'Verdicts d\'audit (signalements)';
    case 'signalement': return 'Triplets signalés';
    case 'annotation':  return 'Annotations + signalements';
    case 'stats':       return 'Artefacts analysés';
    case 'gap':         return 'Trous détectés';
    default:            return 'Résultats';
  }
}


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

// Formatte un nombre de tokens : 1234 → "1.2k", 1234567 → "1.2M".
function fmtTokens(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}

function shortArgs(args) {
  if (!args) return '';
  return Object.entries(args)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v.slice(0, 20)}"` : JSON.stringify(v).slice(0, 25)}`)
    .join(', ');
}

function fmtElapsed(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rem = sec - m * 60;
  return `${m}m ${rem.toFixed(1)}s`;
}

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

// Registre des specs SUR MESURE (peuplé par _specToFlow au fetch de
// l'inventaire) — permet à defaultParamsFor de dériver les défauts d'un agent
// custom (cible, écriture) DEPUIS son spec, comme le fait le backend.
const _CUSTOM_SPEC_REG = {};

function defaultParamsFor(agentId) {
  // Defaults : term vide partout (= tirage au hasard via pick_random_term),
  // budget illimité, thinking=true (raisonnement activé par défaut sur tous
  // les flows — meilleur taux de consolidation, l'utilisateur peut décocher
  // dans le ParamsForm si latence prioritaire), upload=false, auto_switch=false
  // (= mode B : abort + bouton Continuer).
  //
  // Le `model` et `autoSubmit` sont pré-remplis depuis JConfigPanel
  // (window.__JDM_JARVIS_CONFIG__, persisté en localStorage). L'utilisateur
  // peut toujours override dans le ParamsForm avant Lancer.
  const cfg = (typeof window !== 'undefined' && window.__JDM_JARVIS_CONFIG__) || {};
  // temperature de JConfig : si l'utilisateur l'a deplacee depuis le
  // default (0.3), on l'envoie au backend. Sinon undefined → defaults
  // par-modele cote serveur (jdm_temperature env var, sinon 1.5-1.7).
  const _temp = (typeof cfg.temperature === 'number') ? cfg.temperature : undefined;
  // Pool gratuit actif : check-out d'une clé Gemini distincte par run via
  // pool_lease.py (backend). Quand actif, gemini-3.1-flash-lite est le
  // modèle pertinent (gratuit, multi-clés possibles). Si l'utilisateur a
  // sauvé un modèle non-gemini dans cfg.llm, on le force vers le pool.
  const _poolActive = cfg.poolActive !== false;  // défaut true
  const _isGemini = (m) => typeof m === 'string' && m.startsWith('gemini');
  const _modelPick = (_poolActive && !_isGemini(cfg.llm))
    ? 'gemini-3.1-flash-lite'
    : (cfg.llm || 'gemini-3.1-flash-lite');
  const common = {
    model: _modelPick,
    api_key: '', drops_key: '',
    use_thinking: true,
    budget_label: 'illimité',
    auto_switch: false,
    temperature: _temp,
    pool_active: _poolActive,
  };
  // `upload` = soumission auto du fichier au LLMDrops (mappe cfg.autoSubmit).
  const autoUpload = cfg.autoSubmit === true;
  switch (agentId) {
    case 'enrich':
      return { ...common, term: '', relation: [],
               target_count: 3, vary_relations: true, iterate: true, upload: autoUpload };
    case 'audit':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'gap':
      return { ...common, term: '' };
    case 'signalement':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'stats':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'annotation':
      return { ...common, term: '', relation: [], top_k: 8,
               target_count: 10, upload: autoUpload };
  }
  // Agent SUR MESURE : défauts DÉRIVÉS DU SPEC (= ceux du formulaire de
  // création), modifiables ensuite dans le ParamsForm de JarvisRun comme les
  // natifs. `upload` n'est proposé QUE si l'agent écrit (sinon rien à soumettre).
  const _spec = _CUSTOM_SPEC_REG[agentId];
  const _tc = (_spec && _spec.defaults && _spec.defaults.target_count)
    || (_spec && _spec.consolidates ? 3 : 0);
  const _writes = !_spec || _spec.writes !== false;
  return {
    ...common, term: '', relation: [], target_count: _tc,
    ...(_writes ? { upload: autoUpload } : {}),
  };
}


function ParamsForm({ flow, params, setParams, locked }) {
  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  // Env-aware : la case « Soumettre à LLMDrops » n'est cochable que
  // si une clé est dispo (champ saisi OU env serveur). Sinon disabled
  // + tooltip explicatif.
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  const submitLabel = (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
      color: _canSubmit ? 'var(--ink-2)' : 'var(--ink-3)',
      cursor: _canSubmit ? 'pointer' : 'not-allowed',
      opacity: _canSubmit ? 1 : 0.55,
    }}
    title={_canSubmit
      ? (params.drops_key
        ? 'Le fichier sera soumis automatiquement avec la clé saisie'
        : 'Le fichier sera soumis automatiquement avec la clé serveur (.env)')
      : 'Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer'}>
      <input type="checkbox"
        checked={!!params.upload && _canSubmit}
        disabled={!_canSubmit}
        onChange={(e) => set('upload', e.target.checked)}
        style={{ accentColor: 'var(--accent)' }} />
      Soumettre à LLMDrops
    </label>
  );
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
      <Field label="Relations cibles (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— libre (toutes par défaut) —"
          options={REL_OPTS_COMMON} />
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
      {submitLabel}
    </>);
  }

  if (flow.id === 'audit' || flow.id === 'signalement' || flow.id === 'stats') {
    return wrap(<>
      <Field label="Terme">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relations (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— toutes —"
          options={REL_OPTS_COMMON} />
      </Field>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {flow.id !== 'stats' && submitLabel}
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

  if (flow.id === 'annotation') {
    // Pas de Top-K exposé : le param top_k est laissé à sa valeur par
    // défaut (8) en arrière-plan, il configure la profondeur de
    // récup de triplets candidats par get_relations_of_type. Le seul
    // levier utile pour l'utilisateur est la CIBLE d'annotations
    // (= nombre d'annotations utiles à atteindre par itération).
    return wrap(<>
      <Field label="Terme (optionnel)">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relations (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— toutes principales —"
          options={REL_OPTS_COMMON} />
      </Field>
      <Field label={`Cible d'annotations utiles · ${params.target_count}`}>
        <Slider value={params.target_count} onChange={(v) => set('target_count', v)} min={1} max={50} step={1} />
      </Field>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)', marginBottom: 8,
        fontFamily: 'var(--font-mono)', lineHeight: 1.4,
      }}>
        taxonomie : constitutif / contrastif / non spécifique / exception ·
        annotation qualifie le LIEN · sélectivité &gt; volume · itère
        librement
      </div>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {submitLabel}
    </>);
  }

  // Agent SUR MESURE (hors built-ins) : formulaire générique — terme,
  // relations, cible, budget, et soumission si l'agent écrit (flow.writes !==
  // false). Le pré-prompt/format/outils sont portés par son spec côté serveur.
  return wrap(<>
    <Field label="Terme (optionnel — vide = tirage au hasard)">
      <Input value={params.term} onChange={(v) => set('term', v)} mono />
    </Field>
    <Field label="Relations (optionnel, multi)">
      <MultiSelect value={params.relation || []}
        onChange={(v) => set('relation', v)}
        placeholder="— libre —"
        options={REL_OPTS_COMMON} />
    </Field>
    <Field label={`Nombre cible · ${params.target_count || '—'}`}>
      <Slider value={params.target_count || 0} onChange={(v) => set('target_count', v)} min={0} max={50} step={1} />
    </Field>
    <Field label="Budget d'outils">
      <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
    </Field>
    {flow.writes !== false && submitLabel}
  </>);
}

// Ring interaction CSS (hover spin + scale, soft pulsing halo). Injected once.
const JRING_CSS = `
@keyframes jorbGlow{0%,100%{opacity:.12}50%{opacity:.3}}
@keyframes jringSpin{to{transform:rotate(360deg)}}
.jring-btn{padding:0;border:none;background:transparent;cursor:pointer;border-radius:50%;line-height:0;-webkit-tap-highlight-color:transparent;}
.jring-btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
.jring{display:inline-flex;transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
.jring-btn:hover .jring{transform:scale(1.12);}
.jring-btn:active .jring{transform:scale(.95);}
.jring-arcs{transform-box:view-box;transform-origin:32px 32px;}
.jring-btn:hover .jring-arcs{animation:jringSpin .6s cubic-bezier(.45,0,.2,1);}
.jcfg-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;}
.jcfg-row + .jcfg-row{border-top:1px solid var(--line-soft);}
.jcfg-row--stack{flex-direction:column;align-items:stretch;gap:9px;}
.jtool-chip:hover{border-color:var(--accent)!important;color:var(--ink)!important;background:var(--bg-card)!important;}
@keyframes jbd{from{opacity:0}to{opacity:1}}
.jtool-backdrop{animation:jbd .16s ease-out;}
.jcode-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink-3);font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcode-copy:hover{background:var(--bg-elev);color:var(--ink);border-color:var(--ink-3);}
.jcli-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;border:1px solid #2a2f3a;background:#222631;color:#c4c9d4;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcli-copy:hover{background:#2f3542;color:#fff;border-color:#3a4150;}
.jpanel-scroll{scrollbar-width:thin;scrollbar-color:var(--line) transparent;}
.jpanel-scroll::-webkit-scrollbar{width:11px;height:11px;}
.jpanel-scroll::-webkit-scrollbar-track{background:transparent;}
.jpanel-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px;border:3px solid var(--bg);background-clip:padding-box;}
.jpanel-scroll::-webkit-scrollbar-thumb:hover{background:var(--ink-3);background-clip:padding-box;}
`;

function ViewJarvis() {
  const [running, setRunning] = useState(null);       // flow id, or null = carousel
  const [detailing, setDetailing] = useState(null);   // flow id pour la vue DÉTAIL (plein écran)
  const [editing, setEditing] = useState(null);       // spec d'un agent custom en cours d'édition
  // Agents sur mesure (inventaire) — pour résoudre la vue JarvisRun d'un agent
  // sur mesure lancé depuis Supervision/Répertoire (les natifs vivent dans
  // JARVIS_AGENTS ; les sur-mesure y sont fusionnés à la volée).
  const _customAgents = useCustomAgentFlows();
  const [panelIndex, setPanelIndex] = useState(1);     // default landing = Accueil (middle)
  const [transitioning, setTransitioning] = useState(true);
  const total = J_PANELS.length;
  const sectionCount = J_SECTIONS.length;

  const goToIndex = useCallback((i) => {
    setTransitioning(true);
    setPanelIndex(Math.max(0, Math.min(total - 1, i)));
  }, [total]);
  const goToId = useCallback((id) => {
    const idx = J_PANELS.findIndex(p => p.id === id);
    if (idx >= 0) goToIndex(idx);
  }, [goToIndex]);

  // Auto-hide the section nav while scrolling down through a panel's content
  // (so it never collides with what's underneath); reveal it at the top or on scroll-up.
  const [navHidden, setNavHidden] = useState(false);
  // Au mount, reconnect aux runs serveur encore actifs apres un
  // refresh / tab close pendant un run (JarvisStore + localStorage).
  useEffect(() => { JarvisStore.bootReconcile().catch(() => {}); }, []);

  // Echappatoire : clic sur l'onglet Jarvis (qu'on soit deja dessus ou
  // qu'on arrive d'ailleurs) ramene SYSTEMATIQUEMENT a l'entree de la
  // console = panneau Supervision (centre). Sort aussi du mode Run
  // s'il y en avait un. App.jsx dispatche le meme event deux fois
  // (pre + post setView) pour couvrir le cas premier mount.
  useEffect(() => {
    const onReset = (e) => {
      if (!e.detail || e.detail.view !== 'jarvis') return;
      setRunning(null);
      const supIdx = J_SECTIONS.findIndex(s => s.id === 'supervision');
      setPanelIndex(supIdx >= 0 ? supIdx : 1);
      setTransitioning(true);
      // Purge aussi le pending payload eventuel (deep link /jarvis/X qui
      // remettrait `running` au mount via _pending). Belt-and-suspenders.
      if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
        delete window.__jdmPendingPayload.jarvis;
      }
    };
    window.addEventListener('jdm-nav-reset', onReset);
    return () => window.removeEventListener('jdm-nav-reset', onReset);
  }, []);

  // Switch entre runs depuis le rail bas du JarvisRun.
  useEffect(() => {
    const onSwitch = (e) => {
      const id = e.detail && e.detail.agent_id;
      if (id) setRunning(id);
    };
    window.addEventListener('jdm-jarvis-switch-run', onSwitch);
    return () => window.removeEventListener('jdm-jarvis-switch-run', onSwitch);
  }, []);

  // Clic sur la pill « N/M flux » du header (ProductionsCountPill) :
  // sort du mode run + ouvre le panneau Supervision (index 2 = derniere
  // section avant les flux details).
  useEffect(() => {
    const onGoToSup = () => {
      setRunning(null);
      setTransitioning(true);
      const supIdx = J_SECTIONS.findIndex(s => s.id === 'supervision');
      if (supIdx >= 0) setPanelIndex(supIdx);
    };
    window.addEventListener('jdm-goto-jarvis-supervision', onGoToSup);
    return () => window.removeEventListener('jdm-goto-jarvis-supervision', onGoToSup);
  }, []);

  const lastScroll = useRef(0);
  useEffect(() => { lastScroll.current = 0; setNavHidden(false); }, [panelIndex]);
  useEffect(() => {
    if (running) return;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains('jpanel-scroll')) return;
      const top = t.scrollTop;
      const prev = lastScroll.current;
      if (top < 40) setNavHidden(false);
      else if (top > prev + 4) setNavHidden(true);
      else if (top < prev - 4) setNavHidden(false);
      lastScroll.current = top;
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [running]);

  // ─── Keyboard : ←/→ move between the three top sections. ───
  useEffect(() => {
    if (running) return;
    const onKey = (e) => {
      if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
      const onFlow = panelIndex >= sectionCount;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.min(sectionCount - 1, panelIndex + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.max(0, panelIndex - 1));
      } else if (e.key === 'Home') { goToIndex(0); }
      else if (e.key === 'End') { goToIndex(sectionCount - 1); }
      else if (e.key === 'Escape' && onFlow) { goToIndex(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Touch swipe between the three sections ───
  useEffect(() => {
    if (running) return;
    let start = null;
    const onStart = (e) => { start = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onEnd = (e) => {
      if (!start) return;
      const dx = start.x - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 50) {
        const onFlow = panelIndex >= sectionCount;
        if (onFlow) goToIndex(1);
        else goToIndex(Math.max(0, Math.min(sectionCount - 1, panelIndex + (dx > 0 ? 1 : -1))));
      }
      start = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Detail mode : vue détail plein écran d'un agent (natif ou sur mesure).
  // Atteinte via le bouton « Détail → » de N'IMPORTE quelle carte. Le clic sur
  // le corps de la carte LANCE le run ; le bouton Détail ouvre cette vue. ───
  if (detailing) {
    const flow = [...JARVIS_AGENTS, ..._customAgents].find(f => f.id === detailing);
    if (!flow) {
      return (
        <PageShell>
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ marginBottom: 14 }}>… chargement de l'agent …</div>
            <Button variant="secondary" onClick={() => setDetailing(null)}>← Retour</Button>
          </div>
        </PageShell>
      );
    }
    const _idx = JARVIS_AGENTS.findIndex(f => f.id === detailing);
    const _delCustom = async (f) => {
      if (typeof window !== 'undefined' && !window.confirm(`Supprimer définitivement l'agent « ${f.title} » ?`)) return;
      try {
        await fetch('api/jarvis/agents/' + encodeURIComponent(f.id), { method: 'DELETE' });
        try { window.dispatchEvent(new CustomEvent('jdm-agents-changed')); } catch (e) {}
      } catch (e) {}
      setDetailing(null);
    };
    return (
      <>
        <JAgentPanel
          flow={flow}
          index={_idx}
          standalone
          onBack={() => setDetailing(null)}
          onLaunch={() => { setDetailing(null); setRunning(detailing); }}
          onIndex={() => setDetailing(null)}
          onSommaire={() => setDetailing(null)}
          onEdit={(f) => setEditing(f._spec || f)}
          onDelete={_delCustom}
        />
        {editing && (
          <JAgentBuilderModal
            editSpec={editing}
            onClose={() => setEditing(null)}
            onCreated={(id) => { setEditing(null); setDetailing(id); }}
          />
        )}
      </>
    );
  }

  // ─── Run mode : replace carousel with the live monitor ───
  if (running) {
    const flow = [...JARVIS_AGENTS, ..._customAgents].find(f => f.id === running);
    if (!flow) {
      // Agent sur mesure pas encore chargé (fetch async de l'inventaire) ou
      // introuvable : on évite le crash (flow.id sur undefined). Le hook
      // useCustomAgentFlows re-render dès que l'inventaire arrive → flow trouvé.
      return (
        <PageShell>
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ marginBottom: 14 }}>… chargement de l'agent …</div>
            <Button variant="secondary" onClick={() => setRunning(null)}>← Retour</Button>
          </div>
        </PageShell>
      );
    }
    return (
      <JarvisRun
        flow={flow}
        onBack={() => {
          const idx = J_PANELS.findIndex(p => p.id === running);
          setRunning(null);
          setTransitioning(false);
          if (idx >= 0) setPanelIndex(idx);
        }}
      />
    );
  }

  const activePanel = J_PANELS[panelIndex].id;
  const activeSection = panelIndex < sectionCount ? activePanel : 'accueil';

  return (
    <>
      <style>{JRING_CSS}</style>
      {/* Rail sticky bottom = sections (Config / Supervision / Répertoire).
          TOUJOURS visible sur Config/Supervision/Répertoire (pas de hide
          au scroll — il prend la place de l'ancienne légende du bas et
          doit rester ancré). Caché uniquement quand on est sur un panneau
          de flux (= vue Run) pour laisser place au JarvisRunRail qui vit
          DEDANS avec la même position bottom. */}
      <JSectionNav activeSection={activeSection} onSelect={goToId}
        hidden={panelIndex >= sectionCount} />

      <div style={{
        position: 'relative',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${total * 100}%`,
          display: 'flex',
          flexDirection: 'row',
          transform: `translate3d(-${(panelIndex / total) * 100}%, 0, 0)`,
          transition: transitioning
            ? 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'none',
          willChange: 'transform',
        }}>
          <JPanel><JConfigPanel onAccueil={() => goToId('repertoire')} /></JPanel>
          <JPanel><JSupervisionPanel flows={JARVIS_AGENTS} onPick={(id) => setDetailing(id)} onLaunch={(id) => setRunning(id)} active={activePanel === 'supervision'} /></JPanel>
          <JPanel><JAccueilPanel flows={JARVIS_AGENTS} onPick={(id) => setDetailing(id)} onLaunch={(id) => setRunning(id)} /></JPanel>

          {JARVIS_AGENTS.map((f, i) => (
            <JPanel key={f.id}>
              <JAgentPanel
                flow={f}
                index={i}
                onLaunch={() => setRunning(f.id)}
                onIndex={goToIndex}
                onSommaire={() => goToId('accueil')}
              />
            </JPanel>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Panel wrapper — one slot of the carousel track ───
function JPanel({ children }) {
  return (
    <div className="jpanel-scroll" style={{
      flex: `0 0 ${JPANEL_BASIS}`,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '6px 28px 56px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  );
}

// ═══════════════════ Configuration — réglages de l'agent ═══════════════════
//
// JARVIS_LLMS = liste DE FALLBACK utilisée si /api/jarvis/models répond
// pas (offline mode, dev sans backend). Le vrai catalogue est fetché à
// l'init et populé via useGeminiModels() ci-dessous. Les modèles fictifs
// (Claude/GPT/Mistral/Llama) sont remplacés par les Gemini réels dispos
// côté serveur.
let JARVIS_LLMS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];
const _LLMS_LISTENERS = new Set();
let _LLMS_LOADED = false;

async function _loadJarvisModels() {
  if (_LLMS_LOADED) return;
  try {
    const r = await fetch('api/jarvis/models');
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.models) && d.models.length > 0) {
      JARVIS_LLMS = d.models.map(m => ({ value: m.value, label: m.label }));
      // Met à jour le default initial du JCONFIG si encore l'ancien fallback
      if (d.default) _JARVIS_DEFAULT_LLM = d.default;
      _LLMS_LOADED = true;
      for (const cb of _LLMS_LISTENERS) { try { cb(); } catch {} }
    }
  } catch {}
}
if (typeof window !== 'undefined') { _loadJarvisModels(); }

function useGeminiModels() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _LLMS_LISTENERS.add(force);
    return () => _LLMS_LISTENERS.delete(force);
  }, []);
  return [JARVIS_LLMS, _LLMS_LOADED];
}

// JARVIS_FORMATS : champ purement informatif (aucun backend de conversion
// d'export — les sorties sont des fichiers texte typés par flux :
// .enrich/.audit/.err/.stat/.annot, format JDM pipe-separated). Conservé
// pour ne pas casser le rendu du Select dans JConfigPanel mais marqué
// disabled côté UI ; tout choix utilisateur reste sans effet backend.
const JARVIS_FORMATS = [
  { value: 'jdm', label: 'JDM (.enrich/.audit/.err/.stat/.annot)' },
];

let _JARVIS_DEFAULT_LLM = 'gemini-3.1-flash-lite';

// JCONFIG = preferences UI (localStorage). Les champs « mode », « parallel »,
// « defaultMaxIter », « temperature », « globalConf », « humanReview »,
// « logLevel », « storageDir », « keepHistory » sont COSMETIQUES — ils
// n'ont aucun pendant backend dans le routage actuel des flows Jarvis
// (les vrais leviers sont passes per-run via /api/jarvis/{flow}/stream :
// model, api_key, budget_label, drops_key, auto_switch, term, relation,
// target_count, upload, vary_relations, iterate, top_k). On conserve la
// surface UI pour la fidelite au design ; seuls « llm » et « autoSubmit »
// sont reellement pre-utilises par ParamsForm via JarvisStore.
const JCONFIG_DEFAULTS = {
  mode: 'autonome', parallel: 2, defaultMaxIter: 30,
  llm: 'gemini-3.1-flash-lite', temperature: 0.3, globalConf: 50,
  humanReview: false, autoSubmit: true, logLevel: 'detaille',
  storageDir: '~/jdm/exports', exportFormat: 'jdm', keepHistory: true,
  // Pool gratuit actif : check-out / check-in d'une clé Gemini par run
  // (cf. pool_lease.py côté backend). Évite que 2 runs parallèles se
  // partagent le même quota PerMinute. Quand actif, gemini-3.1-flash-lite
  // est forcé par défaut (modèle gratuit du pool).
  poolActive: true,
};

function useJarvisConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem('jdm_jarvis_config');
      if (raw) return { ...JCONFIG_DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {}
    return JCONFIG_DEFAULTS;
  });
  useEffect(() => {
    try { localStorage.setItem('jdm_jarvis_config', JSON.stringify(cfg)); } catch (e) {}
    window.__JDM_JARVIS_CONFIG__ = cfg;
    // Signal aux composants externes (mascotte jarvis-banner.jsx) qui
    // écoutent la config sans avoir accès au state React. Le banner
    // tombe sinon sur son poll de 1.2s. Évènement zéro-payload : les
    // consommateurs relisent localStorage / __JDM_JARVIS_CONFIG__.
    try { window.dispatchEvent(new CustomEvent('__jdm_jarvis_config_changed')); } catch (e) {}
  }, [cfg]);
  const set = useCallback((k, v) => setCfg(c => ({ ...c, [k]: v })), []);
  const reset = useCallback(() => setCfg(JCONFIG_DEFAULTS), []);
  return [cfg, set, reset];
}

// Small on/off switch (no shared Toggle exists).
function JToggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)} className="focus-ring"
      style={{
        width: 42, height: 24, flexShrink: 0, padding: 0,
        borderRadius: 999, position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--line)'),
        background: checked ? 'var(--accent)' : 'var(--bg-elev)',
        opacity: disabled ? 0.5 : 1, transition: 'background .2s, border-color .2s',
      }}>
      <span aria-hidden="true" style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--bg)' : 'var(--ink-3)',
        transition: 'left .2s cubic-bezier(.34,1.56,.64,1), background .2s',
      }} />
    </button>
  );
}

// Segmented control for 2–3 short options.
function JSegmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, gap: 2,
      background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 999,
    }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className="focus-ring"
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 999, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--ink-2)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontWeight: active ? 600 : 400, transition: 'background .18s, color .18s', whiteSpace: 'nowrap',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function JCfgGroup({ title, children }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>{title}</div>
      </div>
      <div style={{ padding: '2px 18px 8px' }}>{children}</div>
    </Card>
  );
}

function JCfgRow({ label, hint, children, stack }) {
  return (
    <div className={'jcfg-row' + (stack ? ' jcfg-row--stack' : '')}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: stack ? 'stretch' : 'flex-end',
        ...(stack ? { alignSelf: 'stretch' } : { minWidth: 150, maxWidth: '55%' }),
      }}>{children}</div>
    </div>
  );
}

function JConfigPanel({ onAccueil }) {
  const [cfg, set, reset] = useJarvisConfig();
  // useGeminiModels s'abonne au catalogue : le Select se met à jour
  // automatiquement quand /api/jarvis/models répond. Avant cela on
  // tombe sur le fallback (1 entrée gemini-3.1-flash-lite).
  const [llmList /*, llmsReady */] = useGeminiModels();
  const autonomous = cfg.mode === 'autonome';
  const modeHint = {
    autonome: 'La boucle s’exécute de bout en bout, sans intervention humaine.',
    supervise: 'Jarvis sollicite ta validation aux étapes critiques.',
    pasapas: 'Tu valides chaque itération avant qu’elle ne soit écrite.',
  }[cfg.mode];
  const llmLabel = (llmList.find(l => l.value === cfg.llm) || {}).label || cfg.llm;
  const fmtLabel = (JARVIS_FORMATS.find(f => f.value === cfg.exportFormat) || {}).label || cfg.exportFormat;
  const modeLabel = { autonome: 'Autonome', supervise: 'Supervisé', pasapas: 'Pas-à-pas' }[cfg.mode];
  const modeColor = { autonome: 'var(--jdm-green)', supervise: 'var(--jdm-orange)', pasapas: 'var(--jdm-cyan)' }[cfg.mode];

  // Ad-hoc readiness checklist → drives the preparation progress bar.
  const checks = [
    { label: 'Mode d’exécution choisi', ok: !!cfg.mode },
    { label: 'Modèle LLM sélectionné', ok: !!cfg.llm },
    { label: 'Seuil de confiance défini', ok: cfg.globalConf > 0 },
    { label: 'Répertoire de stockage renseigné', ok: !!(cfg.storageDir && cfg.storageDir.trim()) },
    { label: autonomous ? 'Soumission automatique activée' : 'Validation configurée', ok: autonomous ? cfg.autoSubmit : (cfg.humanReview || cfg.autoSubmit) },
  ];
  const doneCount = checks.filter(c => c.ok).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const ready = pct === 100;
  const barColor = ready ? 'var(--jdm-green)' : 'var(--accent)';

  return (
    <div style={{ width: '100%', maxWidth: 1080 }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 22,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
            letterSpacing: '0.16em', marginBottom: 12,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            &nbsp;· Réglages de l’agent
          </div>
          <h1 className="display" style={{
            margin: 0, fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)', fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
          }}>
            Config<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>uration</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> enregistré
          </span>
          <button type="button" onClick={reset} className="focus-ring" style={ghostLinkStyle}>↺ Réinitialiser</button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
        gap: 18, alignItems: 'start',
      }}>
        {/* settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <JCfgGroup title="Exécution">
            <JCfgRow label="Mode d’exécution" stack>
              <JSegmented value={cfg.mode} onChange={(v) => set('mode', v)} options={[
                { value: 'autonome', label: 'Autonome' },
                { value: 'supervise', label: 'Supervisé' },
                { value: 'pasapas', label: 'Pas-à-pas' },
              ]} />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{modeHint}</div>
            </JCfgRow>
            <JCfgRow label="Agents en parallèle" hint="Boucles d’agent exécutées simultanément." stack>
              <Slider value={cfg.parallel} onChange={(v) => set('parallel', v)} min={1} max={5} step={1} />
            </JCfgRow>
            <JCfgRow label="Itérations max par défaut" hint="Plafond appliqué à chaque nouvel agent." stack>
              <Slider value={cfg.defaultMaxIter} onChange={(v) => set('defaultMaxIter', v)} min={5} max={100} step={1} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Modèle & inférence">
            <JCfgRow label="Modèle LLM" stack>
              <Select value={cfg.llm} onChange={(v) => set('llm', v)} options={llmList} />
            </JCfgRow>
            <JCfgRow label="Pool gratuit actif" hint="Chaque run prend une clé Gemini distincte du pool (load-min sinon). Force gemini-3.1-flash-lite par défaut.">
              <JToggle checked={cfg.poolActive !== false} onChange={(v) => set('poolActive', v)} />
            </JCfgRow>
            <JCfgRow label="Température" hint="Créativité de la génération de candidats." stack>
              <Slider value={Math.round(cfg.temperature * 100)} onChange={(v) => set('temperature', v / 100)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
            <JCfgRow label="Seuil de confiance global" hint="Score minimum pour conserver un triplet." stack>
              <Slider value={cfg.globalConf} onChange={(v) => set('globalConf', v)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Validation & soumission">
            <JCfgRow label="Validation humaine avant écriture" hint={autonomous ? 'Désactivée en mode autonome.' : 'Relire les triplets avant de les mémoriser.'}>
              <JToggle checked={autonomous ? false : cfg.humanReview} disabled={autonomous} onChange={(v) => set('humanReview', v)} />
            </JCfgRow>
            <JCfgRow label="Soumettre automatiquement à JDM" hint="Pousser les triplets validés vers le serveur JeuxDeMots.">
              <JToggle checked={cfg.autoSubmit} onChange={(v) => set('autoSubmit', v)} />
            </JCfgRow>
            <JCfgRow label="Journalisation" stack>
              <JSegmented value={cfg.logLevel} onChange={(v) => set('logLevel', v)} options={[
                { value: 'concis', label: 'Concis' },
                { value: 'detaille', label: 'Détaillé' },
                { value: 'debug', label: 'Debug' },
              ]} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Stockage & sortie">
            <JCfgRow label="Répertoire de stockage" hint="Où les exports et journaux sont écrits." stack>
              <Input value={cfg.storageDir} onChange={(v) => set('storageDir', v)} mono />
            </JCfgRow>
            <JCfgRow label="Format d’export" stack>
              <Select value={cfg.exportFormat} onChange={(v) => set('exportFormat', v)} options={JARVIS_FORMATS} />
            </JCfgRow>
            <JCfgRow label="Conserver l’historique des runs" hint="Garder une trace de chaque exécution.">
              <JToggle checked={cfg.keepHistory} onChange={(v) => set('keepHistory', v)} />
            </JCfgRow>
          </JCfgGroup>
        </div>

        {/* live summary */}
        <div style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ad-hoc preparation progress */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Préparation de l’agent</span>
                <span className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: ready ? 'var(--jdm-green)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 999, transition: 'width .4s cubic-bezier(.4,0,.2,1), background .3s' }} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {checks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, lineHeight: 1,
                      background: c.ok ? 'var(--jdm-green)' : 'var(--bg-elev)',
                      color: c.ok ? 'var(--bg)' : 'var(--ink-3)',
                      border: '1px solid ' + (c.ok ? 'var(--jdm-green)' : 'var(--line)'),
                    }}>{c.ok ? '✓' : ''}</span>
                    <span style={{ color: c.ok ? 'var(--ink-2)' : 'var(--ink-3)' }}>{c.label}</span>
                  </div>
                ))}
              </div>
              {ready && (
                <div className="mono" style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: 'var(--jdm-green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> prêt à lancer
                </div>
              )}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden', borderTop: `3px solid ${modeColor}` }}>
            <div style={{ padding: '14px 18px 12px' }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 10,
              }}>Profil d’exécution</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: modeColor, flexShrink: 0 }} />
                <span className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
                  letterSpacing: '-0.01em', color: 'var(--ink)',
                }}>{modeLabel}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-soft)', padding: '4px 18px 10px' }}>
              <JSumRow k="Modèle" v={llmLabel} />
              <JSumRow k="Confiance min" v={cfg.globalConf + ' %'} />
              <JSumRow k="Itér. max" v={cfg.defaultMaxIter} />
              <JSumRow k="Parallèle" v={cfg.parallel + ' agents'} />
              <JSumRow k="Soumission JDM" v={cfg.autoSubmit ? 'auto' : 'manuelle'} accent={cfg.autoSubmit ? 'var(--jdm-green)' : undefined} />
              <JSumRow k="Validation" v={autonomous ? 'aucune' : (cfg.humanReview ? 'humaine' : 'auto')} />
              <JSumRow k="Export" v={fmtLabel} />
              <JSumRow k="Stockage" v={cfg.storageDir} mono />
            </div>
          </Card>
          <Button full size="lg" onClick={onAccueil}>Choisir un agent →</Button>
        </div>
      </div>
    </div>
  );
}

function JSumRow({ k, v, accent, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', fontSize: 12.5 }}>
      <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0, fontSize: 11 }}>{k}</span>
      <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
      <span className={mono ? 'mono' : undefined} style={{
        color: accent || 'var(--ink)', textAlign: 'right', fontWeight: 500,
        maxWidth: '62%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: mono ? 11 : 12.5,
      }}>{v}</span>
    </div>
  );
}

// ═══════════════════ Repertoire — flux disponibles (panneau droit) ═══
// Anciennement « Accueil » (centre, vue Aperçus par defaut). Devenu
// le panneau droit « Répertoire » avec la Bibliothèque (mode library)
// par defaut — l'utilisateur peut basculer en « Aperçus » via le
// toggle dans la toolbar.
function JAccueilPanel({ flows, onPick, onLaunch }) {
  // Set des flows actuellement en cours (resync via JarvisStore — survit
  // aux unmount). Sert à dégrader chaque carte avec un badge « en cours »
  // pour que l'utilisateur retrouve d'un coup d'œil ses runs.
  const activeFlowSet = useJarvisActiveSet();
  const [q, setQ] = useState('');
  // Defaut = library (Bibliothèque MediaBay) au lieu d'apercus.
  const [view, setView] = useState('library'); // 'library' | 'apercus'
  // Agents SUR MESURE de l'inventaire + builder.
  const customAgents = useCustomAgentFlows();
  const [showBuilder, setShowBuilder] = useState(false);
  const allFlows = [...flows, ...customAgents];

  const qq = q.trim().toLowerCase();
  const indexed = allFlows.map((f, i) => ({ f, num: i + 1 }));
  const list = qq
    ? indexed.filter(({ f }) =>
        (f.title + ' ' + f.kicker + ' ' + f.produces + ' ' + f.steps.map(s => s.n).join(' ')).toLowerCase().includes(qq))
    : indexed;

  return (
    <div style={{ width: '100%', maxWidth: view === 'library' ? 1180 : 980 }}>
      {/* header */}
      <div style={{ marginBottom: 14 }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12,
        }}>
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
          &nbsp;· Catalogue des agents disponibles
        </div>
        <h1 className="display" style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
        }}>
          Réper<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>toire</span>
        </h1>
      </div>

      {/* toolbar — sticky search + view switch + count */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '8px 0 12px', marginBottom: 14,
        background: 'var(--bg)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 190 }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-3)', fontSize: 14, pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un agent, une étape, un résultat…"
            aria-label="Rechercher un agent"
            style={{
              width: '100%', padding: '10px 12px 10px 31px',
              background: 'var(--bg-card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', color: 'var(--ink)',
              fontFamily: 'inherit', fontSize: 13, outline: 'none',
            }} />
        </div>
        <JSegmented value={view} onChange={setView} options={[
          { value: 'library', label: 'Bibliothèque' },
          { value: 'apercus', label: 'Aperçus' },
        ]} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
          padding: '6px 11px', background: 'var(--bg-elev)', border: '1px solid var(--line-soft)', borderRadius: 999,
        }}>
          <strong style={{ color: 'var(--ink-2)' }}>{list.length}</strong>{qq ? ` / ${allFlows.length}` : ''} agents
        </span>
        <button type="button" className="focus-ring" onClick={() => setShowBuilder(true)}
          title="Créer un agent spécialiste sur mesure"
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>＋ Créer un agent spécialiste</button>
      </div>
      {showBuilder && <JAgentBuilderModal onClose={() => setShowBuilder(false)}
        onCreated={(id) => { setShowBuilder(false); if (onLaunch) onLaunch(id); }} />}

      {list.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)',
        }}>
          <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun agent</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Rien ne correspond à «&nbsp;{q}&nbsp;».</div>
        </div>
      ) : view === 'apercus' ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
            fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)',
          }}>
            <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            Clic sur le <strong style={{ color: 'var(--ink-2)' }}>cercle</strong> = lancer l'agent
            <span style={{ color: 'var(--line)' }}>|</span>
            clic sur la <strong style={{ color: 'var(--ink-2)' }}>carte</strong> = voir le détail
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map(({ f, num }) => (
              <JTocRow key={f.id} flow={f} num={num} delay={(num - 1) * 0.45}
                running={activeFlowSet.has(f.id)}
                onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
            ))}
          </div>
        </>
      ) : (
        <JLibrary list={list} onPick={onPick} onLaunch={onLaunch} />
      )}
    </div>
  );
}

// Rich animated preview row (loop ring + full preview). Default "Aperçus" view.
function JTocRow({ flow, num, delay, onOpen, onLaunch, running }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
      {running && (
        <div style={{
          position: 'absolute', top: -6, right: 10, zIndex: 2,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          background: 'rgba(78,166,60,0.12)',
          border: '1px solid rgba(78,166,60,0.40)',
          borderRadius: 999,
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--jdm-green)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--jdm-green)' }} />
          en cours
        </div>
      )}
      {/* Circular loop schematic — OUTSIDE the card. Click = launch the flux. */}
      <button type="button" onClick={onLaunch} className="jring-btn"
        title={`Lancer l'agent « ${flow.title} »`} aria-label={`Lancer l'agent ${flow.title}`}
        style={{ flexShrink: 0 }}>
        <JLoopRing accent={flow.accent} num={num} steps={flow.steps.length} delay={delay} size={62} />
      </button>

      {/* Card — click = open the flow's detail panel. */}
      <button type="button" onClick={onOpen}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="focus-ring"
        style={{
          flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: 16, textAlign: 'left', padding: '15px 20px',
          background: 'var(--bg-card)',
          border: '1px solid ' + (hover ? flow.accent : 'var(--line)'),
          borderRadius: 'var(--radius-lg)',
          boxShadow: hover
            ? `inset 5px 0 0 ${flow.accent}, 0 8px 26px -14px ${flow.accent}`
            : `inset 5px 0 0 ${flow.accent}`,
          cursor: 'pointer',
          transform: hover ? 'translateX(2px)' : 'none',
          transition: 'transform 0.16s, border-color 0.16s, box-shadow 0.28s',
          fontFamily: 'inherit',
        }}>
        <span style={{ minWidth: 0 }}>
          <span className="display" style={{
            display: 'block', fontFamily: 'var(--font-display)',
            fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em',
            color: 'var(--ink)', lineHeight: 1.1,
          }}>{flow.title}</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 7,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexWrap: 'wrap',
          }}>
            <LoopGlyph color={flow.accent} />
            {flow.steps.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
                <span>{s.n}</span>
              </React.Fragment>
            ))}
            <span style={{ color: 'var(--line)', margin: '0 2px' }}>—</span>
            <span style={{ color: flow.accent }}>{flow.produces}</span>
          </span>
        </span>

        <span className="mono" style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? flow.accent : 'var(--ink-3)',
          transition: 'color 0.16s, transform 0.16s',
          transform: hover ? 'translateX(3px)' : 'none',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>détails →</span>
      </button>
    </div>
  );
}

// Dense library/explorer table — catalogs flows in rows. "Registre" view.
function JRegistry({ list, onPick, onLaunch }) {
  const cols = '34px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1fr) 92px';
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '9px 16px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        <span>#</span><span>Agent</span><span>Séquence</span><span>Produit</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>
      {list.map(({ f, num }, i) => (
        <JRegistryRow key={f.id} flow={f} num={num} cols={cols} last={i === list.length - 1}
          onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
      ))}
    </div>
  );
}

function JRegistryRow({ flow, num, cols, last, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '10px 16px', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--line-soft)',
        background: hover ? 'var(--bg-elev)' : 'transparent',
        boxShadow: hover ? `inset 3px 0 0 ${a}` : 'inset 3px 0 0 transparent',
        transition: 'background .12s, box-shadow .12s',
      }}>
      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: a, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${a} 16%, transparent)` }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="display" style={{
          display: 'block', fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{flow.title}</span>
        <span className="mono" style={{ fontSize: 9.5, color: a, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
        {flow.steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
            <span>{s.n}</span>
          </React.Fragment>
        ))}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.produces}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onLaunch(); }}
          title={`Lancer « ${flow.title} »`} aria-label={`Lancer ${flow.title}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            border: `1px solid color-mix(in srgb, ${a} 50%, transparent)`,
            background: `color-mix(in srgb, ${a} 10%, transparent)`,
            color: a, cursor: 'pointer', fontSize: 10, lineHeight: 1,
          }}>▶</button>
        <span className="mono" style={{ fontSize: 13, color: hover ? a : 'var(--ink-3)', transition: 'color .12s', transform: hover ? 'translateX(2px)' : 'none' }}>→</span>
      </span>
    </div>
  );
}

// Tool kinds (API JDM / logique / workflow / IO / outil) a flow touches —
// utilise pour les facettes de la Bibliotheque. Source de verite :
// AGENT_TOOL_STEPS (mapping reel tool -> etape par flux) croise avec
// TOOL_DOCS (fetched : kind par tool).
function flowToolKinds(flow) {
  const steps = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[flow.id]) || {};
  const kinds = new Set();
  for (const t of Object.keys(steps)) {
    const d = TOOL_DOCS[t];
    if (d) kinds.add(d.kind);
  }
  return [...kinds];
}

// Facet definitions for the library browser.
const J_FACETS = [
  { id: 'category', label: 'Catégorie',    get: (f) => (f.category ? [f.category] : []) },
  { id: 'kind',     label: 'Type d’outil', get: (f) => flowToolKinds(f) },
  { id: 'steps',    label: 'Étapes',       get: (f) => [`${f.steps.length} étapes`] },
  { id: 'tags',     label: 'Tags',         get: (f) => f.tags || [] },
];

// MediaBay-style library: facet sidebar (multi-criteria) + filtered results table.
function JLibrary({ list, onPick, onLaunch }) {
  const [sel, setSel] = useState({});
  const toggle = (gid, val) => setSel(prev => {
    const next = { ...prev };
    const s = new Set(next[gid] || []);
    if (s.has(val)) s.delete(val); else s.add(val);
    next[gid] = s;
    return next;
  });
  const clear = () => setSel({});
  const activeCount = Object.values(sel).reduce((n, s) => n + (s ? s.size : 0), 0);

  // Scroll auto-centre sur les resultats apres chaque changement de
  // selection facette. Au mount initial (sel === {}), on ne fait rien
  // (la vue est deja au top, le user n'a pas encore interagi).
  // _userTouched evite le scroll sur le tout premier render.
  const resultsRef = useRef(null);
  const _userTouched = useRef(false);
  useEffect(() => {
    if (activeCount === 0 && !_userTouched.current) return;
    _userTouched.current = true;
    const el = resultsRef.current;
    if (!el) return;
    // Cherche le scrollable parent (.jpanel-scroll) et scrolle vers
    // la position des resultats. scrollIntoView fonctionne aussi mais
    // affecte la window — on prefere viser le panel pour ne pas casser
    // la nav de carrousel. Smooth + block 'start' = haut des resultats
    // arrive en haut de la fenetre de scroll.
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    if (!sc) sc = window;
    const elTop = el.getBoundingClientRect().top;
    const scTop = (sc === window) ? 0 : sc.getBoundingClientRect().top;
    const delta = elTop - scTop - 12;  // -12px de marge
    if (sc.scrollBy) sc.scrollBy({ top: delta, behavior: 'smooth' });
    else if (sc.scrollTo) sc.scrollTo({ top: (sc.scrollTop || 0) + delta, behavior: 'smooth' });
  }, [sel, activeCount]);

  const groups = J_FACETS.map(g => {
    const counts = {};
    list.forEach(({ f }) => g.get(f).forEach(v => { counts[v] = (counts[v] || 0) + 1; }));
    const items = Object.keys(counts).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, count: counts[v] }));
    return { ...g, items };
  }).filter(g => g.items.length > 0);

  const results = list.filter(({ f }) =>
    J_FACETS.every(g => {
      const s = sel[g.id];
      if (!s || s.size === 0) return true;
      return g.get(f).some(v => s.has(v));
    })
  );

  // Layout vertical : MediaBay en HAUT (panneau horizontal pleine largeur,
  // 4 sections empilees l'une au dessus de l'autre) → puis liste des
  // resultats en dessous. Chaque section MediaBay = un facette + ses
  // checkboxes disposees en wrap horizontal (= chips qu'on peut cocher).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
      {/* MediaBay : panneau facettes en haut, 4 sections empilees */}
      <aside style={{
        border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
        }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Filtres MediaBay {activeCount > 0 && <>· <span style={{ color: 'var(--accent)' }}>{activeCount} actif{activeCount > 1 ? 's' : ''}</span></>}
          </span>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="focus-ring"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Effacer ({activeCount})</button>
          )}
        </div>
        {/* 4 sections empilees verticalement, separees par un trait fin.
            Chaque section : label a gauche + chips horizontales a droite
            qui wrappent sur plusieurs lignes si necessaire. */}
        <div>
          {groups.map((g, gi) => (
            <div key={g.id} style={{
              display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)',
              gap: 14, alignItems: 'start',
              padding: '10px 14px',
              borderBottom: gi < groups.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', paddingTop: 5,
              }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                {g.items.map(it => {
                  const on = !!(sel[g.id] && sel[g.id].has(it.value));
                  return (
                    <button key={it.value} type="button" onClick={() => toggle(g.id, it.value)} className="focus-ring"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                        border: '1px solid ' + (on ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line-soft)'),
                        background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-elev)',
                        fontFamily: 'inherit',
                        transition: 'background .12s, border-color .12s',
                      }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                        background: on ? 'var(--accent)' : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--bg)', fontSize: 8.5, lineHeight: 1,
                      }}>{on ? '✓' : ''}</span>
                      <span style={{ fontSize: 11.5, color: on ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{it.value}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{it.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Liste des resultats — sous le MediaBay. Le ref est cible par
          le scroll auto-centre apres chaque toggle facette. */}
      <div ref={resultsRef} style={{ minWidth: 0, scrollMarginTop: 12 }}>
        {results.length > 0 ? (
          <JRegistry list={results} onPick={onPick} onLaunch={onLaunch} />
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)' }}>
            <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun agent pour ces filtres</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Élargis ta sélection dans les facettes ci-dessus.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════ Agents SUR MESURE — inventaire + builder ═══════════════
// Mappe un AgentSpec de l'inventaire (/api/jarvis/agents) vers un objet
// « flow » consommable par les cartes. Enregistre aussi icône/brief dans les
// Parse les ÉTAPES d'un workflow rédigé par l'orchestrateur (format
// « TITRE :… / ÉTAPES : 1. … 2. … / RÈGLES : … ») en [{n, d}] pour le
// diagramme de boucle. Renvoie null si rien d'exploitable.
function _parseWorkflowSteps(sp) {
  if (!sp || typeof sp !== 'string') return null;
  let body = sp;
  // Si une section « ÉTAPES : » existe (workflow généré), on part de là ; sinon
  // on parse la liste numérotée telle quelle (instructions brutes).
  const mStart = sp.match(/[ÉE]TAPES?\s*:/i);
  if (mStart) body = sp.slice(mStart.index + mStart[0].length);
  // Coupe à la 1re section de RÈGLES / DESCRIPTION / ATTENTION… (pas des étapes).
  const mEnd = body.match(/\n\s*(R[ÈE]GLES?|DESCRIPTION|ATTENTION|NOTES?|SORTIE|REMARQUES?|CONTRAINTES?|IMPORTANT)\s*:?/i);
  if (mEnd) body = body.slice(0, mEnd.index);
  const items = [];
  const re = /(?:^|\n)\s*(\d+)[.)]\s+([^\n]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const full = m[2].trim().replace(/\s+/g, ' ');
    if (!full) continue;
    // Ignore les lignes qui sont des RÈGLES / avertissements (pas des étapes).
    if (/^(attention|important|note|règle|regle|ne\s|n[e'’]|aucun|jamais)\b/i.test(full)) continue;
    let name, desc;
    const sep = full.split(/\s+[—–:-]\s+/);  // « Nom — desc » / « Nom : desc »
    if (sep.length > 1 && sep[0].split(' ').length <= 4) {
      name = sep[0].trim();
      desc = sep.slice(1).join(' — ').trim();
    } else {
      // Pas de séparateur : nom SYNTHÉTIQUE = le verbe initial (1er mot),
      // description = la phrase complète. Donne « Analyse », « Identifie »…
      const w = full.replace(/[.:;،,].*$/, '').trim().split(' ');
      name = w.slice(0, w.length === 1 ? 1 : (w[0].length <= 3 ? 2 : 1)).join(' ');
      desc = full;
    }
    name = name.replace(/[.:;,]+$/, '').trim();
    if (!name) name = 'Étape ' + m[1];
    items.push({ n: name, d: desc });
    if (items.length >= 6) break;
  }
  return items.length ? items : null;
}

// maps globales pour que flowIcon/FLOW_BRIEF marchent sans toucher les cartes.
function _specToFlow(spec) {
  const brief = spec.brief || '';
  try {
    _CUSTOM_SPEC_REG[spec.id] = spec;
    if (spec.icon) AGENT_ICON[spec.id] = spec.icon;
    if (brief) AGENT_BRIEF[spec.id] = brief;
  } catch (e) {}
  const fmt = spec.output_format || 'jdm';
  const fmtLabel = fmt === 'json' ? 'JSON' : fmt === 'libre' ? 'texte libre' : 'soumission JDM';
  // Vraies ÉTAPES = celles du workflow rédigé par l'orchestrateur (parsées du
  // system_prompt). Fallback générique si non parsables.
  let steps = _parseWorkflowSteps(spec.system_prompt);
  if (!steps || !steps.length) {
    steps = [
      { n: 'Cadrage', d: 'Reçoit le terme (ou en tire un) et la stratégie de l\'agent.' },
      { n: 'Exécution', d: 'Suit la stratégie en mobilisant les outils JDM autorisés.' },
    ];
    if (spec.consolidates) steps.push({ n: 'Consolidation', d: 'Vérifie chaque candidat par inférence dans le graphe.' });
    steps.push(spec.writes === false
      ? { n: 'Réponse', d: `Restitue le résultat en ${fmtLabel} dans la conversation.` }
      : { n: 'Soumission', d: `Écrit le fichier ${spec.output_ext || ''} (${fmtLabel}).` });
  }
  return {
    id: spec.id, title: spec.title, kicker: 'Sur mesure',
    icon: spec.icon || '🤖', accent: spec.accent || 'var(--accent)',
    desc: brief, brief: brief,
    produces: spec.output_ext || (spec.writes === false ? 'réponse' : ''),
    loopOf: spec.template || 'sur mesure',
    category: 'Sur mesure', tags: [spec.template || 'custom'],
    steps,
    consolidates: !!spec.consolidates,
    writes: spec.writes !== false,
    _custom: true,
    _strategy: spec.system_prompt || '',
    _spec: spec,
    _format: fmt, _formatLabel: fmtLabel,
    _defaults: { target_count: (spec.defaults && spec.defaults.target_count) || (spec.consolidates ? 3 : 0) },
  };
}

// Résout un flow par id : natif, sinon agent SUR MESURE (via le registre de
// specs peuplé au fetch de l'inventaire). Fallback sur le 1er natif si inconnu.
function _flowById(id) {
  const nat = JARVIS_AGENTS.find(f => f.id === id);
  if (nat) return nat;
  const spec = _CUSTOM_SPEC_REG[id];
  if (spec) { try { return _specToFlow(spec); } catch (e) {} }
  return JARVIS_AGENTS[0];
}

// Hook : récupère les agents SUR MESURE (rafraîchi sur l'event global
// 'jdm-agents-changed', émis après création/suppression).
function useCustomAgentFlows() {
  const [customs, setCustoms] = React.useState([]);
  const load = React.useCallback(async () => {
    try {
      const r = await fetch('api/jarvis/agents');
      if (!r.ok) return;
      const d = await r.json();
      const cs = (d.agents || []).filter(a => !a.builtin).map(_specToFlow);
      setCustoms(cs);
    } catch (e) {}
  }, []);
  React.useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('jdm-agents-changed', h);
    return () => window.removeEventListener('jdm-agents-changed', h);
  }, [load]);
  return customs;
}

// Lance un agent SUR MESURE EN PLACE (in-place, comme « ▸ Démarrer »), avec
// les défauts de son spec — il apparaît ensuite dans la Supervision.
function _startCustomAgent(flow) {
  if (typeof window === 'undefined' || !window.__jdmJarvisStore) return;
  const cfg = (window.__JDM_JARVIS_CONFIG__) || {};
  const params = {
    term: '', relation: [],
    model: cfg.llm || 'gemini-3.1-flash-lite',
    use_thinking: true, budget_label: 'illimité',
    pool_active: cfg.poolActive !== false,
    auto_switch: false,
    upload: cfg.autoSubmit === true,
    target_count: (flow._defaults && flow._defaults.target_count) || 0,
  };
  window.__jdmJarvisStore.start(flow.id, { params, isResume: false, resumeState: null }).catch(() => {});
}

// Modal de CRÉATION d'un agent spécialiste (le formulaire-builder).
// Format de sortie = jdm / libre / json (3 choix). L'extension de fichier est
// LIBRE (texte), proposée par défaut selon le format.
const _BUILDER_FORMATS = [
  { value: 'jdm', label: 'Soumission JDM (lignes terme|relation|cible)' },
  { value: 'libre', label: 'Libre (texte / prose)' },
  { value: 'json', label: 'JSON (données structurées)' },
];
const _FMT_DEFAULT_EXT = { jdm: '.enrich', libre: '.txt', json: '.json' };

// Sanitize une extension saisie librement (miroir du backend _normalize_spec).
function _sanitizeExt(raw) {
  let e = (raw || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!e) return '';
  return '.' + e.replace(/^\.+/, '');
}

function JAgentBuilderModal({ onClose, onCreated, editSpec }) {
  const _isEdit = !!(editSpec && editSpec.id);
  const [templates, setTemplates] = React.useState({});
  const [step, setStep] = React.useState('form'); // 'form' | 'recap'
  const [name, setName] = React.useState(_isEdit ? (editSpec.title || '') : '');
  const [description, setDescription] = React.useState(_isEdit ? (editSpec.brief || '') : '');
  const [template, setTemplate] = React.useState(_isEdit ? (editSpec.template || 'libre') : 'generation_endogene');
  // `strategy` = INSTRUCTIONS brutes saisies par l'utilisateur. `workflow` =
  // le workflow rédigé par l'ORCHESTRATEUR « à la manière des *_workflow »
  // (ce qui devient le system_prompt). En édition : instructions d'origine si
  // gardées, workflow = system_prompt sauvegardé.
  const [strategy, setStrategy] = React.useState(
    _isEdit ? (editSpec.instructions || editSpec.system_prompt || '') : '');
  const [workflow, setWorkflow] = React.useState(_isEdit ? (editSpec.system_prompt || '') : '');
  const [writes, setWrites] = React.useState(_isEdit ? (editSpec.writes !== false) : true);
  const [fmt, setFmt] = React.useState(_isEdit ? (editSpec.output_format || 'jdm') : 'jdm');
  const [ext, setExt] = React.useState(_isEdit ? (editSpec.output_ext || '') : '');
  const [extTouched, setExtTouched] = React.useState(_isEdit && !!editSpec.output_ext);
  const [target, setTarget] = React.useState(_isEdit ? ((editSpec.defaults && editSpec.defaults.target_count) || 0) : 0);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [genLoading, setGenLoading] = React.useState(false);
  // Catalogue d'outils PROPOSABLES (sans *_workflow) + allow-list « ce que
  // l'agent doit savoir faire ». Pré-rempli : édition → outils sauvegardés ;
  // création → TOUT le catalogue (l'orchestrateur les connaît tous).
  const [toolOpts, setToolOpts] = React.useState([]);
  const [allowedTools, setAllowedTools] = React.useState(
    _isEdit && Array.isArray(editSpec.allowed_tools) ? editSpec.allowed_tools.slice() : null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('api/jarvis/agents');
        if (r.ok) { const d = await r.json(); setTemplates(d.templates || {}); }
      } catch (e) {}
    })();
  }, []);
  // Catalogue d'outils → options du multi-select (exclut les *_workflow).
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('api/jarvis/tools');
        if (!r.ok) return;
        const d = await r.json();
        const sel = (d.tools || []).filter(t => t.kind !== 'workflow');
        const opts = sel.map(t => ({
          value: t.name,
          label: t.description ? `${t.name} — ${String(t.description).slice(0, 60)}` : t.name,
        }));
        setToolOpts(opts);
        // Pré-remplissage : si pas déjà défini (création, ou édition sans
        // allow-list sauvegardée) → TOUS les outils proposables.
        setAllowedTools(prev => (prev && prev.length) ? prev : opts.map(o => o.value));
      } catch (e) {}
    })();
  }, []); // eslint-disable-line
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tpl = templates[template] || {};
  // Quand on change le template, aligne le format sur celui du template (sauf
  // si l'utilisateur a déjà personnalisé). L'extension par défaut suit le format
  // tant qu'elle n'a pas été touchée manuellement.
  const _tplFirst = React.useRef(true);
  React.useEffect(() => {
    // En édition, ne PAS écraser le format sauvegardé au montage initial.
    if (_tplFirst.current) { _tplFirst.current = false; if (_isEdit) return; }
    if (tpl.format && (tpl.format === 'jdm' || tpl.format === 'libre' || tpl.format === 'json')) {
      setFmt(tpl.format);
    }
  }, [template, templates]); // eslint-disable-line
  const effExt = (extTouched && ext.trim()) ? _sanitizeExt(ext) : (_FMT_DEFAULT_EXT[fmt] || '.txt');

  // spec ENVOYÉ : system_prompt = le WORKFLOW généré par l'orchestrateur (ou,
  // à défaut, les instructions brutes) ; instructions = la saisie brute (gardée
  // pour ré-génération). `forGen` true = on prépare la requête de génération
  // (workflow pas encore produit).
  const _buildSpec = (forGen) => {
    const spec = {
      title: name.trim(), template,
      system_prompt: forGen ? '' : (workflow.trim() || strategy.trim()),
      instructions: strategy.trim(),
      writes, output_format: fmt, output_ext: effExt,
      brief: description.trim(),
    };
    if (_isEdit) spec.id = editSpec.id;  // préserve l'identité en édition
    if (target > 0) spec.defaults = { target_count: Number(target) };
    // On persiste TOUJOURS la sélection d'outils (même « tout ») pour que la
    // fiche détail puisse les afficher comme les natifs. « tout » → l'exclusion
    // backend ne retire rien de plus que les *_workflow.
    if (Array.isArray(allowedTools) && allowedTools.length) {
      spec.allowed_tools = allowedTools;
    }
    return spec;
  };

  // Demande à L'ORCHESTRATEUR (même agent que la mascotte) de rédiger le
  // workflow « à la manière des *_workflow » depuis les instructions.
  const generate = async () => {
    setGenLoading(true); setMsg('');
    try {
      const cfg = (typeof window !== 'undefined' && window.__JDM_JARVIS_CONFIG__) || {};
      const r = await fetch('api/jarvis/agents/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: _buildSpec(true), config: { llm: cfg.llm, poolActive: cfg.poolActive } }),
      });
      const d = await r.json();
      if (d.ok && d.workflow) {
        setWorkflow(d.workflow);
        // Description (carte) rédigée par le LLM en 3 lignes.
        if (d.brief) setDescription(d.brief);
      }
      else { setWorkflow(d.fallback || strategy.trim()); if (d.error) setMsg('⚠ génération indisponible (' + d.error + ') — workflow = instructions brutes, éditable.'); }
    } catch (e) { setWorkflow(strategy.trim()); setMsg('⚠ ' + (e.message || e)); }
    setGenLoading(false);
  };

  const goRecap = async () => {
    if (!name.trim() || !strategy.trim()) { setMsg('Nom et instructions requis.'); return; }
    setMsg(''); setStep('recap');
    // En création : génère le workflow via l'orchestrateur. En édition : on
    // garde le workflow existant (re-génération sur demande via le bouton).
    if (!workflow.trim()) await generate();
  };

  const create = async () => {
    if (!name.trim() || !strategy.trim()) { setMsg('Nom et instructions requis.'); return; }
    setBusy(true); setMsg('');
    try {
      const spec = _buildSpec();
      const r = await fetch('api/jarvis/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const d = await r.json();
      if (d.ok) {
        try { window.dispatchEvent(new CustomEvent('jdm-agents-changed')); } catch (e) {}
        const newId = (d.spec && d.spec.id) || d.agent_id || '';
        if (onCreated && newId) onCreated(newId); else onClose();
      } else { setMsg('✗ ' + (d.error || 'échec')); }
    } catch (e) { setMsg('✗ ' + (e.message || e)); }
    setBusy(false);
  };

  const fmtLabel = (_BUILDER_FORMATS.find(f => f.value === fmt) || {}).label || fmt;
  const recapRow = (k, v) => (
    <div style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ flex: '0 0 130px', fontSize: 12, color: 'var(--ink-3)' }}>{k}</span>
      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
    </div>
  );

  return ReactDOM.createPortal((
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 20px', overflow: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        maxWidth: 640, width: '100%', boxShadow: 'var(--shadow-lg)', padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>
            {step === 'recap'
              ? (_isEdit ? '🤖 Confirmer les modifications' : '🤖 Confirmer l\'agent')
              : (_isEdit ? '🤖 Modifier l\'agent spécialiste' : '🤖 Créer un agent spécialiste')}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>× Fermer</Button>
        </div>

        {step === 'form' ? (<React.Fragment>
        <Field label="Nom de l'agent">
          <Input value={name} onChange={setName} placeholder="ex. Enrichisseur de cuisine" />
        </Field>
        <Field label="Template (fixe les défauts : consolide / écrit / format)">
          <Select value={template} onChange={setTemplate}
            options={Object.keys(templates).length
              ? Object.entries(templates).map(([k, v]) => ({ value: k, label: v.label || k }))
              : [{ value: 'generation_endogene', label: 'Génération endogène' }]} />
        </Field>
        {tpl.skeleton && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '-4px 0 10px', lineHeight: 1.4 }}>
            {tpl.skeleton}
          </div>
        )}
        <Field label="Instructions — ce que l'agent doit faire (l'orchestrateur en rédigera le workflow)">
          <textarea value={strategy} onChange={(e) => { setStrategy(e.target.value); setWorkflow(''); }} rows={5}
            placeholder="Décris en langage naturel ce que l'agent doit accomplir (ex. « enrichis les termes de cuisine en relations de parties, en partant de leurs idées associées, et consolide »). L'orchestrateur en fera un workflow à la manière des *_workflow."
            style={{
              width: '100%', resize: 'vertical', padding: '10px 12px',
              background: 'var(--bg-card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', color: 'var(--ink)', fontFamily: 'inherit',
              fontSize: 13.5, lineHeight: 1.5, outline: 'none',
            }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Format de sortie">
            <Select value={fmt} onChange={(v) => { setFmt(v); }} options={_BUILDER_FORMATS} />
          </Field>
          <Field label="Extension de fichier (libre)">
            <Input value={extTouched ? ext : effExt}
              onChange={(v) => { setExtTouched(true); setExt(v); }}
              placeholder={_FMT_DEFAULT_EXT[fmt] || '.txt'} />
          </Field>
        </div>
        <Field label={`Nombre cible · ${target || '—'}`}>
          <Slider value={target} onChange={setTarget} min={0} max={50} step={1} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', margin: '4px 0 14px' }}>
          <input type="checkbox" checked={writes} onChange={(e) => setWrites(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Produit un fichier de soumission (sinon résultat en réponse seulement)
        </label>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', margin: '-8px 0 14px', lineHeight: 1.4 }}>
          Comme les autres agents : le fichier n'est <strong>soumis à JDM</strong>
          {' '}que si « Soumettre » est coché au lancement (jamais d'envoi automatique).
        </div>

        {msg && <div className="mono" style={{ fontSize: 12, color: 'var(--jdm-magenta)', marginBottom: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={goRecap} disabled={!name.trim() || !strategy.trim()}>
            Aperçu &amp; confirmation →
          </Button>
        </div>
        </React.Fragment>) : (<React.Fragment>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 12, lineHeight: 1.45 }}>
          Vérifie la configuration de l'agent avant de le créer. Tu peux revenir
          en arrière pour ajuster.
        </div>
        <div style={{ marginBottom: 14 }}>
          {recapRow('Nom', name.trim())}
          {description.trim() && recapRow('Description', description.trim())}
          {recapRow('Template', (tpl.label || template))}
          {recapRow('Format', fmtLabel)}
          {recapRow('Extension', <span className="mono">{writes ? effExt : '— (pas de fichier)'}</span>)}
          {recapRow('Écrit un fichier', writes ? 'Oui' : 'Non')}
          {recapRow('Consolide', tpl.consolidates ? 'Oui' : 'Non')}
          {recapRow('Nombre cible', target > 0 ? String(target) : 'défaut')}
          {recapRow('Outils', `${(allowedTools || []).length}${toolOpts.length ? ` / ${toolOpts.length}` : ''}`)}
        </div>
        <Field label="Ce que l'agent spécialiste doit savoir faire (outils)">
          <MultiSelect value={allowedTools || []}
            onChange={(v) => setAllowedTools(v)}
            placeholder={toolOpts.length ? '— sélectionne les outils —' : '… chargement du catalogue …'}
            options={toolOpts} />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5, lineHeight: 1.4 }}>
            Pré-rempli avec tout le catalogue. Retire ce dont l'agent n'a pas
            besoin. Les recettes <span className="mono">*_workflow</span> (natifs)
            ne sont jamais proposées.
          </div>
        </Field>
        {/* Le WORKFLOW rédigé par l'ORCHESTRATEUR « à la manière des *_workflow »
            depuis les instructions — c'est lui qui devient le system_prompt de
            l'agent. Éditable ; régénérable. */}
        <Field label="Workflow rédigé par l'orchestrateur (deviendra le cerveau de l'agent) — éditable">
          {genLoading ? (
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', padding: '10px 12px' }}>
              … l'orchestrateur rédige le workflow …
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea value={workflow} onChange={(e) => setWorkflow(e.target.value)} rows={12}
                placeholder="(le workflow généré par l'orchestrateur apparaîtra ici)"
                style={{
                  width: '100%', resize: 'vertical', padding: '10px 12px',
                  background: 'var(--bg-elev)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)', color: 'var(--ink)', fontFamily: 'var(--font-mono)',
                  fontSize: 12, lineHeight: 1.5, outline: 'none',
                }} />
              <button type="button" onClick={generate} className="focus-ring" style={{ ...ghostLinkStyle, alignSelf: 'flex-start' }}>
                ↻ Régénérer via l'orchestrateur
              </button>
            </div>
          )}
        </Field>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '-4px 0 14px', lineHeight: 1.4 }}>
          Au lancement, ce workflow est cadré par le préprompt déterministe
          (terme/cible/format) — une simple aide.{' '}
          {_isEdit
            ? 'Les modifications sont enregistrées sur l\'agent existant ; tu seras redirigé vers sa fiche.'
            : 'Après création, l\'agent apparaît dans le Répertoire et la Supervision ; tu seras redirigé vers sa fiche.'}
        </div>

        {msg && <div className="mono" style={{ fontSize: 12, color: 'var(--jdm-magenta)', marginBottom: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button variant="ghost" onClick={() => { setStep('form'); setMsg(''); }}>← Modifier</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button onClick={create} disabled={busy || genLoading || !name.trim() || !workflow.trim()}>
              {busy ? 'Enregistrement…' : (_isEdit ? 'Enregistrer' : 'Créer l\'agent')}
            </Button>
          </div>
        </div>
        </React.Fragment>)}
      </div>
    </div>
  ), document.body);
}

// ═══════════════════ Supervision — tableau de bord live ═══════════════════
// Synthetic dashboard: every flux is shown "en cours", with a live preview of
// what's happening inside (current step, growing metrics, streaming results).
function JSupervisionPanel({ flows, onPick, onLaunch, active }) {
  // Agents SUR MESURE de l'inventaire (fusionnés aux 6 natifs pour les cartes).
  const customAgents = useCustomAgentFlows();
  const [showBuilder, setShowBuilder] = useState(false);
  // Heartbeat tick (animation refresh) — anime stepIdx + petits effets visuels.
  // Reste fictif (cosmetique) ; ne change pas les chiffres reels.
  const [tick, setTick] = useState(0);
  const rootRef = useRef(null);
  // Path du fichier en cours de preview (= modal ouvert). null = fermé.
  // Set par le badge statut de chaque card via prop onPreview.
  const [previewPath, setPreviewPath] = useState(null);
  // run_id dont on affiche le détail (modal) — clic sur une carte de run.
  const [detailRunId, setDetailRunId] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  // Donnees REELLES du backend : on poll /api/jarvis/runs toutes les 3s
  // pour le statut, headlines, started_at. En parallele JarvisStore expose
  // les metrics live (consolidated, toolsCalled, accepted items) pour chaque
  // agent_id observe localement. On combine les deux.
  const [serverRuns, setServerRuns] = useState([]);
  // run_ids déjà adoptés (attach) pour ne pas re-brancher en boucle.
  const adoptedRef = useRef(new Set());
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const t = async () => {
      try {
        const r = await fetch('api/jarvis/runs');
        if (r.ok) {
          const d = await r.json();
          if (!alive) return;
          const runs = d.runs || [];
          setServerRuns(runs);
          // OBSERVATION PAR RUN : chaque run actif (lancé d'ici, par la
          // mascotte, ou ailleurs) est observé via ObsStore keyé par
          // run_id → une carte par run avec son propre feed/métriques/
          // détail (plusieurs runs du même type coexistent sans s'écraser).
          for (const s of runs) {
            if ((s.status === 'running' || s.status === 'starting')
                && s.run_id && !adoptedRef.current.has(s.run_id)) {
              adoptedRef.current.add(s.run_id);
              ObsStore.observe(s.run_id, s.agent_id, s.headline);
            }
          }
        }
      } catch {}
    };
    t();
    const h = setInterval(t, 3000);
    return () => { alive = false; clearInterval(h); };
  }, [active]);

  // S'abonne aux changements de JarvisStore pour rerender quand une metrique
  // bouge entre deux ticks (= reactivite immediate au lieu d'attendre 1.4s).
  const localActiveSet = useJarvisActiveSet();

  // On opening Supervision, smooth-scroll its panel back to the top (stats strip).
  useEffect(() => {
    if (!active) return;
    const el = rootRef.current; if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active]);

  // Re-render quand un run OBSERVÉ (ObsStore) bouge entre deux ticks.
  const [, _obsForce] = React.useReducer(x => x + 1, 0);
  useEffect(() => ObsStore.subscribe('*', _obsForce), []);

  // ── cardSpecs : UNE CARTE PAR RUN ──────────────────────────────────
  // Pour chaque type de flux : si ≥1 run ACTIF (running/starting), une
  // carte par run actif (2 audits en // → 2 cartes). Sinon, une seule
  // carte = le dernier run (terminé) ou un placeholder « en attente »
  // (lançable). Évite de noyer la grille avec tout l'historique.
  const _runsByFlow = {};
  for (const r of serverRuns) {
    if (r.agent_id) (_runsByFlow[r.agent_id] = _runsByFlow[r.agent_id] || []).push(r);
  }
  const cardSpecs = [];
  for (const f of [...flows, ...customAgents]) {
    const frs = _runsByFlow[f.id] || [];
    const activeR = frs.filter(r => r.status === 'running' || r.status === 'starting')
                       .sort((a, b) => (a.started_at || 0) - (b.started_at || 0));
    for (const r of activeR) cardSpecs.push({ flow: f, run: r });
    if (!activeR.length) {
      const latest = frs.slice().sort((a, b) => (b.started_at || 0) - (a.started_at || 0))[0] || null;
      if (latest) cardSpecs.push({ flow: f, run: latest });  // dernier résultat
    }
    // TOUJOURS une carte grisée « lancer » → vue JarvisRun (lancement manuel).
    cardSpecs.push({ flow: f, run: null, isLaunch: true });
  }
  const live = cardSpecs.map((spec, i) => spec.isLaunch
    ? { isLaunch: true, isRunning: false, isDone: false, submitted: false }
    : computeAgentLive(
        spec.flow, i, tick, serverRuns, localActiveSet,
        spec.run ? { rec: ObsStore.getRun(spec.run.run_id), serverRun: spec.run } : undefined
      ));
  // Ordre d'affichage : en cours → soumis → terminé → en attente.
  const _bucket = (l) => {
    if (l.isRunning) return 0;
    if (l.submitted) return 1;
    if (l.isDone) return 2;
    return 3;
  };
  const orderedIdx = cardSpecs.map((_, i) => i).sort((a, b) => {
    const ba = _bucket(live[a]); const bb = _bucket(live[b]);
    if (ba !== bb) return ba - bb;
    return a - b;
  });
  // Aggregats reels : iter cumule (sum des iter detectes par flux),
  // tools cumule, accepted cumule. Aucune valeur fabriquee.
  const agg = live.reduce((a, l) => ({
    iter:     a.iter + (l.iter || 0),
    tools:    a.tools + (l.tools || 0),
    accepted: a.accepted + (l.accepted || 0),
  }), { iter: 0, tools: 0, accepted: 0 });

  // Compteur "Flux actifs" base sur les runs serveur reellement running/starting.
  const activeCount = serverRuns.filter(r => r.status === 'running' || r.status === 'starting').length;

  return (
    <div ref={rootRef} style={{ width: '100%', maxWidth: 1120 }}>
      {/* ── Masthead — wrapper position:relative + min-height pour que
            la couche jb-layer du banner (absolute/inset:0) ait de la
            place a droite du titre pour rendre ses controles (toggle
            Manuel/Autonome, bouton Discuter, bouton close) qui sont
            positionnes bottom:9 right:10 du layer. Sans min-height, le
            layer epouserait juste la hauteur du titre+texte et les
            controles seraient ecrases. */}
      <div style={{
        position: 'relative',
        minHeight: 180,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 18,
      }}>
        {/* Mascotte Jarvis — module IIFE charge avant bundle.jsx, expose
            window.JarvisBanner. Inclut deja en interne : robot mascotte,
            toggle Manuel/Autonome, bouton Discuter, bouton close, mode
            replie (mini-robot a droite du titre). On ne touche pas a la
            logique interne — juste a son ancrage DOM. */}
        {typeof window !== 'undefined' && window.JarvisBanner
          ? React.createElement(window.JarvisBanner)
          : null}
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.16em',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            <span>{'·'} Supervision {'·'} {flows.length} agents</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: activeCount > 0 ? 'var(--jdm-green)' : 'var(--ink-3)' }}>
              <span className="pulse-dot" style={{ background: activeCount > 0 ? 'var(--jdm-green)' : 'var(--ink-3)' }} /> live
            </span>
          </div>
          <h1 className="display" style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)',
            fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1,
            color: 'var(--ink)',
          }}>
            Tableau de <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>bord</span>
          </h1>
          {/* Description sous le titre — laisse la zone droite du masthead
              libre pour les contrôles de la mascotte (toggle Manuel/Autonome,
              bouton Discuter) qui se logent à droite via la couche jb-layer. */}
          <p style={{
            margin: '14px 0 0', maxWidth: '54ch',
            fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-3)',
          }}>
            Jarvis est l'agent orchestrateur des différents agents JDM. Sur cette
            page il est possible de configurer Jarvis et voir le détail des
            agents individuels.
          </p>
        </div>
      </div>

      {/* ── KPI strip — agreges sur tous les flux ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 18,
      }}>
        <JKpi label="Agents actifs"      value={activeCount}   sub="en boucle"  dot />
        <JKpi label="Iterations"       value={agg.iter}      sub="cumulees" />
        <JKpi label="Outils appeles"   value={agg.tools}     sub="JDM" />
        <JKpi label="Items produits"   value={agg.accepted}  sub="consolides/annotes" color="var(--jdm-green)" />
      </div>

      {/* ── Live flux grid — une carte par flux ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: 14,
      }}>
        {orderedIdx.map(i => {
          const spec = cardSpecs[i];
          const f = spec.flow;
          if (spec.isLaunch) {
            return <JLaunchCard key={'launch-' + f.id} flow={f}
              onLaunch={() => onLaunch(f.id)}
              onDetail={() => onPick(f.id)}
              onStart={() => {
                // Agent SUR MESURE → démarrage in-place avec ses propres
                // défauts (spec). Natif → defaults canoniques du flux.
                if (f._custom) { _startCustomAgent(f); return; }
                if (typeof window !== 'undefined' && window.__jdmJarvisStore) {
                  const dp = (typeof defaultParamsFor === 'function')
                    ? defaultParamsFor(f.id) : {};
                  window.__jdmJarvisStore.start(f.id, {
                    params: dp, isResume: false, resumeState: null,
                  }).catch(() => {});
                }
              }} />;
          }
          const rid = spec.run && spec.run.run_id;
          // Origine du run : 'ui' = lancé via JarvisRun (session locale dans
          // JarvisStore) → le clic ROUVRE JarvisRun pour continuer à suivre.
          // 'chat'/'server' = pas de session locale → on ouvre la modal détail
          // du run. (Placeholder sans run → lancement via JarvisRun.)
          const _origin = (spec.run && spec.run.origin) || 'ui';
          return (
            <JAgentDashCard key={rid || f.id} flow={f} num={i + 1} live={live[i]}
              onOpen={() => { if (rid && _origin !== 'ui') setDetailRunId(rid); else onLaunch(f.id); }}
              onDetail={() => onPick(f.id)}
              onLaunch={() => onLaunch(f.id)}
              onPreview={(p) => setPreviewPath(p)}
              onStart={() => {
                if (f._custom) { _startCustomAgent(f); return; }
                if (typeof window !== 'undefined' && window.__jdmJarvisStore) {
                  const dp = (typeof defaultParamsFor === 'function')
                    ? defaultParamsFor(f.id) : {};
                  window.__jdmJarvisStore.start(f.id, {
                    params: dp, isResume: false, resumeState: null,
                  }).catch(() => {});
                }
              }} />
          );
        })}
        {/* Carte « + » — créer un agent spécialiste (ouvre le builder). */}
        <JCreateAgentCard onClick={() => setShowBuilder(true)} />
      </div>
      {showBuilder && <JAgentBuilderModal onClose={() => setShowBuilder(false)}
        onCreated={(id) => { setShowBuilder(false); if (onLaunch) onLaunch(id); }} />}

      {/* Légende « Clic sur le cercle / la carte » retirée — le rail
          sticky bottom (JSectionNav) prend sa place visuelle en bas de
          la console et reste toujours visible. */}

      {/* Modal preview — ouvert par clic sur le badge 'soumis'/'terminé'
          d'une card. Sert le contenu via /api/productions/file (= même
          endpoint que la page Productions). */}
      {previewPath && (
        <FilePreviewModal path={previewPath} onClose={() => setPreviewPath(null)} />
      )}

      {/* Détail d'un run précis (clic sur sa carte) — lit ObsStore par
          run_id : log temps réel + fichier produit. Indépendant de la vue
          de lancement (flow-keyée). */}
      {detailRunId && (
        <RunDetailModal runId={detailRunId} onClose={() => setDetailRunId(null)}
          onPreview={(p) => setPreviewPath(p)} />
      )}
    </div>
  );
}

// ─── Modal de preview d'un fichier produit (.enrich/.audit/.err/.stat) ──
// Réutilise l'endpoint /api/productions/file (= même source que la page
// Productions). Path en entrée = path absolu (ex: /tmp/jdm_outputs/X.enrich) ;
// on extrait juste le basename pour la query string.
function FilePreviewModal({ path, onClose }) {
  const [content, setContent] = useState('… chargement …');
  const [err, setErr] = useState('');
  const name = (path || '').split(/[\\/]/).slice(-1)[0] || '';
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`api/productions/file?name=${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!alive) return;
        setContent(d.content || '(vide)');
      } catch (e) {
        if (!alive) return;
        setErr(String(e && e.message ? e.message : e));
        setContent('');
      }
    })();
    return () => { alive = false; };
  }, [name]);
  const onBackdropClick = (e) => { if (e.target === e.currentTarget) onClose(); };
  const isHtml = name.toLowerCase().endsWith('.html');
  // Déduit le flow depuis l'extension du fichier pour proposer la soumission
  // LLMDrops (un .err vient du flow 'signalement', .stat de 'stats', etc.).
  const _ext = (name.toLowerCase().match(/\.([a-z]+)$/) || [])[1] || '';
  const _flowForExt = { enrich: 'enrich', audit: 'audit', err: 'signalement',
                        stat: 'stats', annot: 'annotation' }[_ext] || '';
  // Portail vers document.body : le rail-pager horizontal a un
  // `transform: translate3d(...)` qui crée un containing block pour
  // les `position: fixed` de tous ses descendants. Sans portail, le
  // backdrop couvre bien tout (car inset:0 du rail = 600% du viewport)
  // mais la card centrée par flex se positionne au centre du RAIL,
  // pas du viewport — donc rendue HORS écran quand on n'est pas au
  // panel central. Le portail rend le modal directement sous <body>,
  // hors de toute hiérarchie transformée → fixed se réfère au viewport.
  return ReactDOM.createPortal((
    <div onClick={onBackdropClick} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 920, width: '100%',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>{name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FileSubmitButton filePath={path} agentId={_flowForExt} />
            <Button size="sm" variant="secondary"
              onClick={() => {
                window.open(`api/productions/download?name=${encodeURIComponent(name)}`, '_blank');
              }}>Télécharger</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>×</Button>
          </div>
        </div>
        {err ? (
          <div style={{
            padding: 18, color: 'var(--jdm-magenta)',
            fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>Erreur : {err}</div>
        ) : isHtml ? (
          <iframe title={name} srcDoc={content}
            sandbox="allow-scripts allow-same-origin"
            style={{ flex: 1, width: '100%', border: 0, minHeight: 500, background: 'var(--bg)' }} />
        ) : (
          <pre style={{
            margin: 0, padding: 18, overflow: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
            color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            flex: 1,
          }}>{content}</pre>
        )}
      </div>
    </div>
  ), document.body);
}

// ─── Détail d'un run précis (supervision) — lit ObsStore par run_id ───
// Log temps réel + métriques + accès au fichier produit. Indépendant de
// la vue de lancement (flow-keyée), donc 2 runs du même type ont chacun
// leur détail. Portail vers document.body (cf. note FilePreviewModal :
// le rail-pager transforme le containing block des position:fixed).
// Vue de run détaillée — RICHE, identique au corps de JarvisRun (grille
// métriques + double panneau narration/log + panneau d'items + télécharger).
// Lit en LECTURE SEULE le record ObsStore (run observé, lancé hors JarvisRun :
// mascotte/serveur). Aucun formulaire de lancement : un run précis est déjà
// en cours/terminé. Réutilise les helpers de module (parseFilePreview,
// renderMarkdownJarvis, ItemCard, AGENT_TOOL_STEPS, metricLabelFor…) pour un
// rendu strictement aligné sur la vue Run.
function RunDetailModal({ runId, onClose, onPreview }) {
  const rec = useObsRun(runId);
  React.useEffect(() => { if (runId) ObsStore.observe(runId); }, [runId]);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [leftView, setLeftView] = useState('narration');
  const logRef = useRef(null);
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const r = rec || {};
  const agentId = r.agentId || '';
  const flow = _flowById(agentId);   // natif OU sur mesure
  const state = r.status || 'idle';
  const log = r.log || [];
  const accepted = r.accepted || [];
  const narrationHTML = r.narrationHTML || '';
  const filePath = r.filePath || null;
  const baseMetrics = r.metrics || {};
  const parsed = React.useMemo(
    () => parseFilePreview(r.filePreview || '', agentId),
    [r.filePreview, agentId]
  );
  // Compteur "produits" dérivé comme dans JarvisRun (registry pour enrich,
  // items parsés sinon).
  const produced = flow.consolidates
    ? (baseMetrics.accepted || accepted.length || 0)
    : parsed.items.filter(i => i.type !== 'meta' && i.type !== 'sens').length;
  const metrics = { ...baseMetrics, produced };

  // Auto-scroll du panneau gauche pendant que le run vit.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);

  const fileName = filePath ? filePath.split(/[\\/]/).slice(-1)[0] : null;

  return ReactDOM.createPortal((
    <div onClick={onBackdrop} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '4vh 20px', overflow: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', maxWidth: 1080, width: '100%',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* En-tête */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--line-soft)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{flow.icon || '🦾'}</span>
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.headline || flow.title || 'Run'}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
                {state} · {flow.title}
                {r.submitted && <span style={{ color: 'var(--jdm-green)' }}>· soumis</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {state === 'running' && (
              <Button size="sm" variant="secondary" onClick={() => ObsStore.stopObs(runId)}>Arrêter</Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>× Fermer</Button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Grille métriques (identique JarvisRun) */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
            background: 'var(--line)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 14,
          }}>
            <Metric label="Outils" value={metrics.toolsCalled || 0} sub="appels" accent={flow.accent} />
            <Metric label="Tokens" value={fmtTokens(metrics.tokens || 0)} sub="estimés" mono />
            <Metric label={metricLabelFor(agentId).label} value={metrics.produced}
                    sub={metricLabelFor(agentId).sub} color="var(--jdm-green)" />
            <Metric label="Temps" value={fmtElapsed(metrics.elapsed || 0)} sub="écoulé" mono />
          </div>

          {/* Double panneau : narration/log (gauche) + items (droite) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Gauche : narration LLM / log temps réel */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)', gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{leftView === 'log' ? 'Log temps réel' : 'Narration LLM'}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
                  <div style={{
                    display: 'inline-flex', background: 'var(--bg-card)',
                    border: '1px solid var(--line)', borderRadius: 999, padding: 2,
                  }}>
                    {[{ id: 'narration', label: 'Narration' }, { id: 'log', label: 'Log' }].map(t => {
                      const active = leftView === t.id;
                      return (
                        <button key={t.id} type="button" onClick={() => setLeftView(t.id)}
                          className="focus-ring" style={{
                            padding: '3px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                            background: active ? flow.accent : 'transparent',
                            color: active ? 'var(--bg)' : 'var(--ink-3)',
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontWeight: active ? 600 : 500, transition: 'background .18s, color .18s',
                          }}>{t.label}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420, overflowY: 'auto',
                padding: leftView === 'log' ? 12 : 14, background: 'var(--bg-card)',
                fontFamily: leftView === 'log' ? 'var(--font-mono)' : 'inherit',
                fontSize: leftView === 'log' ? 11 : 13, lineHeight: 1.55, color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {leftView === 'log' ? (
                  (() => {
                    const fts = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[agentId]) || {};
                    const _norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase();
                    const validatedSet = new Set();
                    if (Array.isArray(accepted)) {
                      for (const a of accepted) {
                        const t = _norm(a.subject || a.term), rr = _norm(a.relation), tg = _norm(a.target);
                        if (t && rr && tg) validatedSet.add(`${t}|${rr}|${tg}`);
                      }
                    }
                    if (parsed && Array.isArray(parsed.items)) {
                      for (const it of parsed.items) {
                        if (it.type === 'consolidated' || it.type === 'audit_signalement') {
                          const t = _norm(it.subject), rr = _norm(it.relation), tg = _norm(it.target);
                          if (t && rr && tg) validatedSet.add(`${t}|${rr}|${tg}`);
                        }
                      }
                    }
                    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
                    const items = [];
                    if (narrationHTML) {
                      let mm;
                      while ((mm = re.exec(narrationHTML)) !== null) {
                        items.push({ tool: mm[1], triplet: mm[3] || '', isResult: !!mm[4] });
                      }
                    }
                    const tentatives = [];
                    let cur = null, prevStep = -1;
                    for (const it of items) {
                      if (it.isResult) { if (cur) cur.push(it); continue; }
                      const s = fts[it.tool];
                      if (s === undefined) { if (cur) cur.push(it); continue; }
                      if (s === 0 && (prevStep === -1 || prevStep >= 1)) { cur = []; tentatives.push(cur); }
                      if (cur) cur.push(it);
                      prevStep = s;
                    }
                    if (!narrationHTML && (!log || log.length === 0)) return null;
                    return (
                      <>
                        {tentatives.map((tent, ti) => (
                          <div key={'t' + ti} style={{ marginBottom: 12 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '4px 0', marginBottom: 6,
                              borderBottom: `1px dashed color-mix(in srgb, ${flow.accent} 35%, transparent)`,
                              color: flow.accent, fontWeight: 600,
                              textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10,
                            }}>
                              <span style={{ background: flow.accent, color: 'var(--bg)', padding: '1px 7px', borderRadius: 3, fontSize: 9.5 }}>Tentative {ti + 1}</span>
                              <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
                                {tent.filter(x => !x.isResult).length} appel(s), {tent.filter(x => x.isResult).length} retour(s)
                              </span>
                            </div>
                            {tent.filter(x => !x.isResult && x.triplet).map((it, k) => {
                              const parts = it.triplet.split('|');
                              const [term, rel, target] = parts;
                              const _key = (term && rel && target)
                                ? `${term.trim().toLowerCase()}|${rel.trim().toLowerCase()}|${target.trim().toLowerCase()}` : null;
                              const isValidated = _key && validatedSet.has(_key);
                              return (
                                <div key={k} style={{
                                  display: 'flex', gap: 8, marginBottom: 3, alignItems: 'baseline',
                                  paddingLeft: 8, paddingRight: 8,
                                  background: isValidated ? 'color-mix(in srgb, var(--jdm-green) 9%, transparent)' : 'transparent',
                                  borderLeft: isValidated ? '2px solid var(--jdm-green)' : '2px solid transparent',
                                  borderRadius: '0 3px 3px 0', paddingTop: 2, paddingBottom: 2,
                                  transition: 'background .25s, border-color .25s',
                                }} title={isValidated ? 'Triplet validé : passé en consolidation' : 'Triplet tenté'}>
                                  <span style={{ flexShrink: 0, fontSize: 10, color: isValidated ? 'var(--jdm-green)' : 'var(--accent)', fontWeight: isValidated ? 700 : 400 }}>
                                    {isValidated ? '✓' : '→'}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', wordBreak: 'break-word' }}>
                                    <span style={{ fontWeight: 600 }}>{term}</span>
                                    {rel && (<><span style={{ color: 'var(--ink-3)' }}> | </span><span style={{ color: flow.accent }}>{rel}</span></>)}
                                    {target && (<><span style={{ color: 'var(--ink-3)' }}> | </span><span style={{ fontWeight: 600 }}>{target}</span></>)}
                                  </span>
                                  <span style={{ flexShrink: 0, color: 'var(--ink-3)', fontSize: 9.5 }}>{it.tool}</span>
                                </div>
                              );
                            })}
                            {tent.filter(x => !x.isResult && x.triplet).length === 0 && (
                              <div style={{ paddingLeft: 8, fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                                aucun triplet tenté ({tent.filter(x => !x.isResult).length} appel(s) sans args triplet)
                              </div>
                            )}
                          </div>
                        ))}
                        {(log || []).length > 0 && (
                          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
                            <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Events systeme</div>
                            {log.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'baseline' }}>
                                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                                <span style={{
                                  flexShrink: 0, minWidth: 56,
                                  color: l.kind === 'tool' ? 'var(--accent)' : l.kind === 'accept' ? 'var(--jdm-green)' :
                                         l.kind === 'reject' ? 'var(--jdm-magenta)' : l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                                }}>{l.tag}</span>
                                <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : narrationHTML ? (
                  <div className="jdm-prose" dangerouslySetInnerHTML={{ __html: renderMarkdownJarvis(narrationHTML) }} />
                ) : (
                  log.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                      <span style={{ flexShrink: 0, minWidth: 64, color: l.kind === 'accept' ? 'var(--jdm-green)' : l.kind === 'reject' ? 'var(--jdm-magenta)' : l.kind === 'iter' ? flow.accent : 'var(--ink-3)' }}>{l.tag}</span>
                      <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Droite : items produits + télécharger / voir */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px', background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
                  letterSpacing: '0.1em', flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {panelTitleFor(agentId)} · <span style={{ color: 'var(--jdm-green)' }}>{metrics.produced}</span>
                  {fileName && (
                    <span style={{ color: 'var(--ink-2)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>· {fileName}</span>
                  )}
                </div>
                {fileName && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <FileSubmitButton filePath={filePath} agentId={agentId}
                      submitted={r.submitted} running={state === 'running'} />
                    <Button size="sm" variant="ghost"
                      onClick={() => {
                        const url = `api/productions/download?name=${encodeURIComponent(fileName)}`;
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}>⬇ Télécharger</Button>
                  </div>
                )}
              </div>
              <div style={{ height: 420, overflowY: 'auto', padding: 0, background: 'var(--bg-card)' }}>
                {(() => {
                  // Source items : registry de consolidation si dispo, SINON
                  // parse du fichier produit (format jdm) — indispensable pour
                  // les agents sur mesure qui écrivent sans passer par le registry.
                  const toShow = (flow.consolidates && accepted.length) ? accepted : parsed.items;
                  if (toShow.length === 0) {
                    return (
                      <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                        {state === 'idle'
                          ? 'Le panneau se remplira au fur et à mesure que le fichier est écrit.'
                          : 'En attente des premiers résultats…'}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                      {toShow.map((it, i) => <ItemCard key={i} item={it} accent={flow.accent} />)}
                    </div>
                  );
                })()}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

// Carte « lancer » grisée — toujours présente par flux dans la Supervision.
// Affiche l'icône emoji du flux (🌱 / 🔍 / 🕳️ …), son titre, un brief
// d'une ligne, puis deux actions : « ▸ Démarrer » lance le flux DIRECTEMENT
// en place (defaults serveur, comme avant) et « Détail → » ouvre la vue Run
// (formulaire + paramètres). Désaturée + bordure pointillée pour signaler
// l'emplacement de lancement.
function JLaunchCard({ flow, onStart, onDetail, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return (
    <div
      role="button" tabIndex={0}
      onClick={onLaunch}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLaunch && onLaunch(); } }}
      title={`Lancer « ${flow.title} » (vue Run)`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
        background: 'var(--bg-card)',
        border: '1px dashed ' + (hover ? a : 'var(--line)'),
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        opacity: hover ? 1 : 0.78, filter: hover ? 'none' : 'saturate(0.7)',
        boxShadow: hover ? `0 12px 32px -18px ${a}` : 'var(--shadow-sm)',
        transition: 'opacity .2s, filter .2s, border-color .16s, box-shadow .28s',
      }}>
      <div style={{ height: 3, background: a, opacity: 0.55 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px 8px' }}>
        <div style={{
          flexShrink: 0, width: 50, height: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34, lineHeight: 1,
          background: 'transparent', border: 'none',
        }}>{agentIcon(flow.id)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 10, color: a, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3,
          }}>{flow.kicker}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.05,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{flow.title}</div>
        </div>
      </div>
      {/* Brief une ligne */}
      <div style={{
        padding: '0 16px 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.4,
      }}>{AGENT_BRIEF[flow.id] || ''}</div>
      {/* Actions : Démarrer (direct) + Détail (vue Run) */}
      <div style={{
        marginTop: 'auto', padding: '10px 14px',
        borderTop: '1px dashed var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <button type="button" className="focus-ring"
          onClick={(e) => { e.stopPropagation(); onStart && onStart(); }}
          title={`Démarrer « ${flow.title} » maintenant (defaults)`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
            border: 'none', background: a, color: 'var(--bg)',
            fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>▸ Démarrer</button>
        {onDetail && (
          <button type="button" className="focus-ring"
            onClick={(e) => { e.stopPropagation(); onDetail(); }}
            title={`Ouvrir la vue Run de « ${flow.title} »`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
              border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)',
              fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>Détail →</button>
        )}
      </div>
    </div>
  );
}

// Carte « + » de fin de grille Supervision : ouvre le builder d'agent sur mesure.
function JCreateAgentCard({ onClick }) {
  const [hover, setHover] = useState(false);
  const a = 'var(--accent)';
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring" title="Créer un agent spécialiste"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, minHeight: 150, cursor: 'pointer',
        background: 'var(--bg-card)',
        border: '1px dashed ' + (hover ? a : 'var(--line)'),
        borderRadius: 'var(--radius-lg)',
        color: hover ? a : 'var(--ink-3)',
        transition: 'border-color .16s, color .16s, transform .18s',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}>
      <span style={{ fontSize: 30, lineHeight: 1 }}>＋</span>
      <span className="mono" style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>Créer un agent spécialiste</span>
    </div>
  );
}

// KPI tile for the dashboard's top strip.
function JKpi({ label, value, sub, color, dot }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '13px 16px' }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {dot && <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />}
        {label}
      </div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
        marginTop: 4, color: color || 'var(--ink)', letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// Source de live snapshots pour les cartes du dashboard — alimentee
// par les VRAIES donnees backend :
//   - JarvisStore.get(flow.id) : etat local du run observe (metrics,
//     accepted items, log) ; survit aux unmount.
//   - serverRuns[flow.id] : dernier run cote serveur (statut, headline)
//     poll'e toutes les 3s via /api/jarvis/runs.
//   - tick : heartbeat 1.4s utilise UNIQUEMENT pour animer stepIdx
//     (= l'etape "active" qui clignote sur la pipeline) et donner du
//     mouvement aux cartes meme quand les chiffres ne bougent pas.
function computeAgentLive(flow, i, tick, serverRuns, _localActiveSet, opts) {
  // opts.rec : record d'OBSERVATION par run (ObsStore) → carte PAR RUN.
  // opts.serverRun : le run serveur précis de cette carte.
  // Sans opts : comportement historique (JarvisStore par flow + dernier run).
  const store = opts && opts.rec
    ? opts.rec
    : ((typeof JarvisStore !== 'undefined') ? JarvisStore.get(flow.id) : null);
  const runs = (serverRuns || []).filter(r => r.agent_id === flow.id);
  const latest = (opts && opts.serverRun)
    ? opts.serverRun
    : (runs.sort((a, b) => (b.started_at || 0) - (a.started_at || 0))[0] || null);
  const isLocallyRunning = store && store.status === 'running';
  const isServerRunning = latest && (latest.status === 'running' || latest.status === 'starting');
  const isRunning = isLocallyRunning || isServerRunning;

  const m = (store && store.metrics) || { toolsCalled: 0, accepted: 0, tokens: 0, elapsed: 0 };
  let tools = m.toolsCalled || 0;
  const narration = (store && store.narrationHTML) || '';

  // Sequence des tool calls cote agent — chaque div narration porte
  // `data-tool="<nom>"` depuis jarvis.py. On parcourt cette sequence
  // UNE seule fois pour calculer iter (tentatives) ET stepIdx (etape
  // active courante). data-result="1" marque un retour de tool ; on
  // ne garde que les APPELS pour ne pas doubler chaque tool.
  const toolSeq = [];
  if (narration) {
    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"([^>]*)>/g;
    let mm;
    while ((mm = re.exec(narration)) !== null) {
      const isResult = /data-result="1"/.test(mm[2] || '');
      if (!isResult) toolSeq.push(mm[1]);
    }
  }

  // iter = TENTATIVE REELLE : chaque fois que l'agent retourne a step 0
  // depuis un step >= 1, c'est une nouvelle tentative. Le 1er passage en
  // step 0 compte aussi pour 1.
  //   ex annot : workflow(0) → lookup(0) → get_relations(1) → lookup(0=>+1)
  //              → get_relations(1) → write_submission(2)  ⇒ 2 tentatives
  const fts = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[flow.id]) || {};
  let iter = 0;
  {
    let prevStep = -1;
    for (const name of toolSeq) {
      const s = fts[name];
      if (s === undefined) continue;
      if (s === 0 && (prevStep === -1 || prevStep >= 1)) iter++;
      prevStep = s;
    }
  }
  if (iter < 1 && (isRunning || tools > 0)) iter = 1;

  // Y reel : si l'utilisateur a fixe un budget numerique, c'est Y. Sinon
  // pas de Y montre (juste "iter X").
  const dp = (typeof defaultParamsFor === 'function' && defaultParamsFor(flow.id)) || {};
  const budgetCap = dp.budget_label && /^\d+$/.test(String(dp.budget_label)) ? parseInt(dp.budget_label, 10) : null;
  // Cible RÉELLE du run (pas le défaut du flux) : priorité au run serveur
  // (target_count exposé par /api/jarvis/runs), puis aux params du store
  // local (UI), enfin au défaut. Corrige la barre qui restait bloquée à 3.
  const target = (latest && latest.target_count)
    || (store && store.params && store.params.target_count)
    || dp.target_count || null;
  // span = ce qui sert au "X / Y" du label iter X/Y. On prefere
  // target_count (le user a dit "je veux N items") sur budgetCap.
  const span = target || budgetCap || null;

  // accepted / rejected REELS via parseFilePreview du file_preview qui
  // contient le contenu reellement ecrit cote backend. Pour enrich on
  // s'appuie sur store.accepted (= registry de consolidation, source
  // canonique). Pour les autres flows on classe les items parses :
  //   ok types (consolidated, sens) → accepted
  //   not-ok types (flagged, signalement, audit_signalement) → rejected
  let accepted = 0, rejected = 0, items = [];
  if (flow.consolidates && Array.isArray(store && store.accepted)) {
    accepted = store.accepted.length;
    items = store.accepted;
  }
  if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id);
    if (!flow.consolidates) {
      for (const it of parsed.items) {
        if (it.type === 'flagged' || it.type === 'signalement' || it.type === 'audit_signalement') rejected++;
        else accepted++;
      }
      items = parsed.items;
    } else {
      // pour enrich on ajoute juste le compte de signalements eventuels
      // (rare : enrich ne signale pas, mais defense en profondeur)
      for (const it of parsed.items) {
        if (it.type === 'flagged' || it.type === 'signalement') rejected++;
      }
    }
  }
  const produced = accepted;
  const pct = span ? Math.min(100, Math.round((produced / span) * 100)) : null;

  // Step ACTIF REEL : derniere etape touchee dans toolSeq (= meme source
  // que iter, derive des data-tool attributes). Quand le flow tourne, ca
  // anime visuellement la progression : chaque nouveau tool dans la
  // narration → re-render → stepIdx mis a jour → highlight CSS transition.
  // Hors run (idle/done), aucune etape highlightee.
  let stepIdx = -1;
  if (isRunning) {
    for (let k = toolSeq.length - 1; k >= 0; k--) {
      const s = fts[toolSeq[k]];
      if (s !== undefined) { stepIdx = s; break; }
    }
  }

  // Recent items : 3 derniers items avec leur LABEL reel ET un TAG
  // contextuel (= remplace l'ancien score "1.00" fictif). Le tag est
  // derive du type d'item :
  //   enrich consolidated → schema (isa-trans, trans, …) ou "✓"
  //   annot consolidated → category (constitutif, contrastif, …)
  //   annot signalement → JDM≠LLM
  //   audit verdict → verdict (LEGITIME, CONTRASTIF, …)
  //   err flagged → category (semantique, polarite, …)
  let recent = [];
  if (flow.consolidates && Array.isArray(items) && items.length > 0) {
    recent = items.slice(-3).map((a, k) => ({
      key: 'a' + k,
      label: a.label || `${a.subject || ''} | ${a.relation || ''} | ${a.target || ''}`,
      tag: (a.schema || '').replace(/^isa_?/, 'isa-') || 'consolidé',
      ok: true,
    }));
  } else if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id);
    recent = parsed.items.slice(-3).map((it, k) => {
      const tag = it.type === 'flagged'           ? (it.category || 'suspect')
                : it.type === 'signalement'        ? 'JDM≠LLM'
                : it.type === 'audit_signalement'  ? (it.verdict || 'verdict')
                : it.type === 'consolidated'       ? (it.category || 'ok')
                : it.type === 'sens'               ? 'sens'
                : it.type;
      return {
        key: 'p' + k,
        label: `${it.subject || ''} | ${it.relation || ''} | ${it.target || ''}`,
        tag,
        ok: it.type !== 'flagged' && it.type !== 'signalement' && it.type !== 'audit_signalement',
      };
    });
  }

  // ─── Compteurs Tentatives / Termes / Tokens (réutilisent la narration) ──
  // - nbAttempted = nombre d'appels `validate_candidate` (= 1 triplet
  //   tenté = 1 appel). Source = toolSeq déjà parcouru ci-dessus.
  // - nbTerms     = nombre de termes UNIQUES vus dans `data-triplet="t|r|t"`
  //   sur les divs jdm-narration (1er champ).
  // - Rejected pour enrich : recalculé = nbAttempted - accepted (= consolidés).
  //   Le calcul d'origine basé sur filePreview restait à 0 pour enrich
  //   car le .enrich ne contient QUE les consolidés (les rejets ne sont
  //   pas écrits) → cube de stats incorrect en supervision.
  let nbAttempted = 0;
  for (const name of toolSeq) {
    if (name === 'validate_candidate') nbAttempted++;
  }
  const _terms = new Set();
  if (narration) {
    const re2 = /data-triplet="([^|"]+)/g;
    let mm2;
    while ((mm2 = re2.exec(narration)) !== null) {
      const t0 = (mm2[1] || '').trim();
      if (t0) _terms.add(t0);
    }
  }
  const nbTerms = _terms.size;
  // FALLBACK stats serveur : pour un run terminé NON observé (rec vide,
  // pas de narration), les compteurs live valent 0. On retombe alors sur
  // les stats persistées du run (serverRun.stats) pour afficher les vrais
  // chiffres sur la carte sans rouvrir un stream.
  const _st = (latest && latest.stats) || {};
  if (!narration) {
    if (!nbAttempted && _st.attempts) nbAttempted = _st.attempts;
    if (!accepted && _st.retained) accepted = _st.retained;
    if (!tools && _st.tools_count) tools = _st.tools_count;
  }
  if (flow.consolidates && nbAttempted > 0) {
    rejected = Math.max(0, nbAttempted - accepted);
  }
  const tokens = (m.tokens || 0) || (_st.tokens || 0);

  // ─── Feed pour la zone « flux en direct » de la card Supervision ──────
  // Source unique = même que la vue Log temps réel : la NARRATION HTML
  // (data-tool="..." + data-triplet="t|r|tg" sur chaque div). On extrait
  // les derniers TOOL CALLS avec leur triplet (= tentatives factuelles
  // affichées exactement comme dans le Log temps réel : `→ t|r|tg  tool`).
  // En complément, on garde 1-2 derniers events log pour le contexte
  // système ([start]/[file]/[done]/[err]).
  //
  // Teinture verte : si le triplet a fini par être consolidé (présent
  // dans `accepted`), on tinte la ligne — même règle visuelle que la
  // vue Log complète, cohérence garantie.
  const _validatedSet = new Set();
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it.type === 'consolidated' || it.type === 'audit_signalement') {
        const tk = (it.subject || '').trim().toLowerCase();
        const rk = (it.relation || '').trim().toLowerCase();
        const gk = (it.target || '').trim().toLowerCase();
        if (tk && rk && gk) _validatedSet.add(`${tk}|${rk}|${gk}`);
      }
    }
  }
  // Parse narration pour extraire les tool calls (skip results, skip
  // tools sans triplet — workflow init, write_submission_file).
  const _tries = [];
  if (narration) {
    const reTry = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
    let mt;
    while ((mt = reTry.exec(narration)) !== null) {
      const isResult = !!mt[4];
      const triplet = mt[3] || '';
      if (isResult || !triplet) continue;
      _tries.push({ tool: mt[1], triplet });
    }
  }
  const _recentTries = _tries.slice(-5);
  const feedTries = _recentTries.map((t, idx) => {
    const parts = t.triplet.split('|');
    const tNorm = (parts[0] || '').trim().toLowerCase();
    const rNorm = (parts[1] || '').trim().toLowerCase();
    const gNorm = (parts[2] || '').trim().toLowerCase();
    const isValidated = (tNorm && rNorm && gNorm)
      && _validatedSet.has(`${tNorm}|${rNorm}|${gNorm}`);
    return {
      kind: 'try',
      key: 'tr' + idx + ':' + t.triplet,
      triplet: t.triplet,
      tool: t.tool,
      validated: isValidated,
    };
  });
  // 2 derniers events log pour le contexte système (filtre les bruits :
  // garde [start], [file], [done], [err], [stop] ; drop le reste).
  const _log = (store && store.log) || [];
  const _sysTagsOK = new Set(['[start]', '[file]', '[done]', '[err]', '[stop]', '[resume]']);
  const _sysLog = _log.filter(e => _sysTagsOK.has(e.tag)).slice(-2);
  const feedLog = _sysLog.map((e, idx) => ({
    kind: 'log',
    key: 'lg' + idx + ':' + (e.t || ''),
    t: e.t || '',
    tag: e.tag || '',
    msg: e.msg || '',
    ok: e.kind !== 'reject',
  }));
  // Ordre dans la zone : tentatives en haut (plus pertinent pour le suivi
  // factuel) puis events système discrets en bas. Dans chaque sous-bloc,
  // le PLUS RÉCENT EST EN HAUT (reverse après slice — sinon les anciens
  // collent au header et les nouveaux disparaissent en bas de la zone
  // étroite quand le run produit beaucoup).
  feedTries.reverse();
  feedLog.reverse();
  const feed = [...feedTries, ...feedLog];

  // submitted = run a poussé un fichier au LLMDrops avec succès
  // (set par JarvisRun après réponse positive de /api/productions/submit).
  // done = run terminé (sans soumission). isRunning = run en cours.
  // → 4 statuts UI possibles : 'running' / 'submitted' / 'done' / 'idle'.
  const submitted = !!(store && store.submitted);
  // isDone : statut du rec (obs) SINON du run serveur (latest) — sinon un
  // run terminé non encore observé (rec vide=idle) s'affichait « en
  // attente » au lieu de « terminé ».
  const isDone = (store && store.status === 'done')
    || (latest && (latest.status === 'done' || latest.status === 'error'));
  const filePath = (store && store.filePath)
    || (latest && latest.stats && latest.stats.file) || null;

  const runId = (opts && opts.serverRun && opts.serverRun.run_id)
    || (store && store.runId) || (latest && latest.run_id) || null;
  // origine du run : 'ui' (vue JarvisRun) | 'chat' (mascotte). Sert au
  // badge tête-de-robot sur les cartes lancées hors JarvisRun.
  const origin = (opts && opts.serverRun && opts.serverRun.origin)
    || (latest && latest.origin) || 'ui';
  return { iter, span, tools, accepted, rejected, produced, pct, recent, stepIdx,
           isRunning, nbAttempted, nbTerms, tokens, feed,
           submitted, isDone, filePath, runId, origin,
           headline: (store && store.headline) || (latest && latest.headline) || '' };
}

// One live "monitor" card for a flux — the heart of the dashboard.
//   onLaunch : ouvre la vue de Run (navigation interne du carrousel)
//   onOpen   : ouvre le panneau de detail du flow (l'explication)
//   onStart  : LANCE le flow IMMEDIATEMENT via JarvisStore.start avec
//              les params par defaut (term/relation vides) SANS changer
//              de page. Utilise par le ring click pour permettre de
//              demarrer un flow grise depuis Supervision en gardant le
//              tableau de bord visible.
function JAgentDashCard({ flow, num, live, onOpen, onLaunch, onStart, onPreview, onDetail }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  const tint = (p) => `color-mix(in srgb, ${a} ${p}%, transparent)`;
  // Cards "au repos" grisees (alpha sur la card entiere) — visuellement
  // reconnaissables en un coup d'oeil dans Supervision.
  const dimmed = !live.isRunning;
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid ' + (hover ? a : 'var(--line)'),
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? `0 12px 32px -18px ${a}` : 'var(--shadow-sm)',
        overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform .18s, border-color .16s, box-shadow .28s, opacity .25s, filter .25s',
        opacity: dimmed ? 0.62 : 1,
        filter: dimmed ? 'saturate(0.55)' : 'none',
        position: 'relative',
      }}>

      {/* Étiquette « tête de robot » sur le bord — marque les runs lancés
          HORS JarvisRun (origin !== 'ui' : mascotte chat ou serveur). */}
      {live.origin && live.origin !== 'ui' && (
        <div title={live.origin === 'chat'
          ? 'Lancé par la mascotte Jarvis (chat)'
          : 'Lancé côté serveur'}
          style={{
            position: 'absolute', top: -14, right: -12, zIndex: 3,
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--bg-card)', border: `1.5px solid ${a}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
          <JRobotHead size={32} title={live.origin === 'chat'
            ? 'Lancé par la mascotte Jarvis' : 'Lancé côté serveur'} />
        </div>
      )}

      {/* top hairline in the flow's colour */}
      <div style={{ height: 3, background: a, opacity: 0.9 }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px 12px' }}>
        <button type="button" className="jring-btn"
          onClick={(e) => {
            e.stopPropagation();
            // Si onStart fourni : demarre en place (Supervision), la card
            // s'allume "en cours" via le poll /api/jarvis/runs sans
            // changer de page. Sinon fallback onLaunch (navigation vers
            // la vue Run — comportement par defaut hors Supervision).
            if (onStart) onStart(); else onLaunch();
          }}
          title={onStart ? `Lancer "${flow.title}" maintenant (defaults)` : `(Re)lancer "${flow.title}"`}
          aria-label={`Lancer ${flow.title}`}
          style={{ flexShrink: 0 }}>
          <JLoopRing accent={a} num={num} steps={flow.steps.length} delay={num * 0.3} size={50} icon="power" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 10, color: a, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3,
          }}>{flow.kicker}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.05,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{flow.title}</div>
        </div>
        {/* Soumettre (compact) — carte terminée, fichier produit, pas encore
            soumis : permet de pousser au LLMDrops directement depuis la carte
            (à côté du badge « terminé·voir »). */}
        {live.isDone && !live.submitted && live.filePath && SUBMITTABLE_FLOWS.has(flow.id) && (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            <FileSubmitButton filePath={live.filePath} agentId={flow.id} compact />
          </div>
        )}
        {/* Badge statut — 4 cas : en cours / soumis / terminé / au repos.
            Quand statut est "soumis" ou "terminé" ET qu'un fichier a été
            produit (live.filePath), le badge devient cliquable et ouvre
            le preview. Stop propagation pour ne pas relancer le flow
            (= onClick parent de la card). */}
        {(() => {
          const _stopProp = (e) => { e.stopPropagation(); e.preventDefault(); };
          const _canPreview = !!live.filePath && (live.submitted || live.isDone);
          const _onClickBadge = (e) => {
            if (!_canPreview) return;
            _stopProp(e);
            if (typeof onPreview === 'function') onPreview(live.filePath);
          };
          const _commonStyle = {
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '4px 9px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
            cursor: _canPreview ? 'pointer' : 'default',
          };
          if (live.isRunning) {
            return (
              <span style={{
                ..._commonStyle,
                border: `1px solid ${tint(45)}`, background: tint(8), color: a,
              }}>
                <span className="pulse-dot" style={{ background: a }} /> en cours
              </span>
            );
          }
          if (live.submitted) {
            return (
              <span onClick={_onClickBadge}
                title={_canPreview ? 'Voir le fichier produit' : ''}
                style={{
                  ..._commonStyle,
                  border: '1px solid var(--jdm-green)',
                  background: 'color-mix(in srgb, var(--jdm-green) 10%, transparent)',
                  color: 'var(--jdm-green)',
                }}>
                soumis{_canPreview && <span style={{ opacity: 0.7, fontWeight: 400 }}>·voir</span>}
              </span>
            );
          }
          if (live.isDone) {
            return (
              <span onClick={_onClickBadge}
                title={_canPreview ? 'Voir le fichier produit' : 'Flow terminé (pas de fichier)'}
                style={{
                  ..._commonStyle, fontWeight: 500,
                  border: '1px solid var(--line-soft)',
                  background: 'var(--bg-elev)', color: 'var(--ink-2)',
                }}>
                terminé{_canPreview && <span style={{ opacity: 0.6, fontWeight: 400 }}>·voir</span>}
              </span>
            );
          }
          return (
            <span style={{
              ..._commonStyle, fontWeight: 500,
              border: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
              color: 'var(--ink-3)',
            }}>
              en attente
            </span>
          );
        })()}
      </div>

      {/* Step pipeline — etape active highlightee. Detection REELLE :
          on lookup le dernier tool mentionne dans la narration LLM via
          AGENT_TOOL_STEPS pour savoir a quelle etape on en est. -1 = aucun
          tool reconnu encore, ou flow au repos. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 15px 12px', flexWrap: 'wrap' }}>
        {flow.steps.map((s, k) => {
          const isActive = live.isRunning && k === live.stepIdx;
          return (
            <React.Fragment key={k}>
              {k > 0 && <span style={{ color: 'var(--line)', fontSize: 11 }}>{'›'}</span>}
              <span className="mono" style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 999,
                background: isActive ? tint(14) : 'var(--bg-elev)',
                border: '1px solid ' + (isActive ? tint(50) : 'var(--line-soft)'),
                color: isActive ? a : 'var(--ink-3)',
                fontWeight: isActive ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'all .25s',
              }}>
                {isActive && <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} />}
                {s.n}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Tent. (nb triplets passés à validate_candidate) / Term. (nb termes
          distincts vus dans data-triplet de la narration). Plus parlant que
          le "iter X/Y" précédent qui comptait les retours à step 0 et donnait
          un compteur peu lisible. La progress bar reste basée sur live.pct
          (= produced / target_count) qui est inchangée. */}
      <div style={{ padding: '0 15px 12px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 5,
        }}>
          <span>
            Tent. <strong style={{ color: 'var(--ink)' }}>{live.nbAttempted || 0}</strong>
            <span style={{ margin: '0 6px', color: 'var(--line)' }}>·</span>
            Term. <strong style={{ color: 'var(--ink)' }}>{live.nbTerms || 0}</strong>
          </span>
          <span style={{ color: a }}>{flow.produces}</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden' }}>
          <div style={{
            width: `${live.pct != null ? live.pct : Math.min(100, (live.nbAttempted || 0) * 8)}%`,
            height: '100%', background: a, borderRadius: 999,
            transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
      </div>

      {/* 4 mini-metriques : acceptés (vert), rejetés (magenta), tokens, outils.
          - acceptés/rejetés : alimentés par nbAttempted - accepted pour enrich
            (avant : rejetés restait à 0 car le .enrich ne contient que les
            consolidés).
          - tokens : estimation depuis store.metrics.tokens (tokens_estimate
            backend). */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1,
        background: 'var(--line-soft)',
        borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <JMini label="cible"    value={live.span != null ? live.span : '—'} color={a} />
        <JMini label="acceptes" value={live.accepted} color="var(--jdm-green)" />
        <JMini label="rejetes"  value={live.rejected} color="var(--jdm-magenta)" />
        <JMini label="tokens"   value={fmtTokens(live.tokens || 0)} />
        <JMini label="outils"   value={live.tools} />
      </div>

      {/* Flux en direct = log temps réel (timestamps + tags) MIX avec les
          triplets validés au format pretty quand l'entry porte un `triplet`
          (= [ok] poussée par le handler delta-aware). Source unifiée :
          live.feed (cf. computeAgentLive). Avant : on n'affichait que les
          items recent → la zone restait « En attente du 1er résultat » tant
          qu'aucun triplet n'avait été validé, même si plein d'events
          [start]/[file] passaient. */}
      <div style={{ padding: '10px 15px 6px', flex: 1 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {live.isRunning && <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} />}
          {live.isRunning ? 'agent en direct' : 'derniers events'}
        </div>
        <div style={{ display: 'grid', gap: 4, minHeight: 78 }}>
          {(!live.feed || live.feed.length === 0) ? (
            <div style={{
              color: 'var(--ink-3)', fontSize: 11, fontStyle: 'italic',
              padding: '10px 0', textAlign: 'center',
            }}>
              {live.isRunning ? 'En attente du 1er event…' : 'Aucun event encore.'}
            </div>
          ) : live.feed.map((e) => (
            e.kind === 'try' ? (
              // Tentative de tool call (= ligne du Log temps réel) :
              // `→ triplet  tool_name`. Teinte verte + liseré gauche
              // si le triplet a fini par être validé (= dans accepted).
              <div key={e.key} className="fade-up" style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                paddingTop: 2, paddingBottom: 2,
                paddingLeft: 8, paddingRight: 8,
                background: e.validated
                  ? 'color-mix(in srgb, var(--jdm-green) 9%, transparent)'
                  : 'transparent',
                borderLeft: e.validated
                  ? '2px solid var(--jdm-green)'
                  : '2px solid transparent',
                borderRadius: '0 3px 3px 0',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                minWidth: 0,
                transition: 'background .25s, border-color .25s',
              }}>
                <span style={{ flexShrink: 0, color: a, opacity: 0.7 }}>→</span>
                <span style={{
                  flex: '1 1 auto', minWidth: 0, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={e.triplet}>{e.triplet}</span>
                <span style={{
                  flex: '0 1 auto', minWidth: 0,
                  color: 'var(--ink-3)', fontSize: 9, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 110,
                }} title={e.tool}>{e.tool}</span>
              </div>
            ) : e.kind === 'item' ? (
              // Triplet validé : format pretty avec ✓ vert + tag schema
              <div key={e.key} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 'var(--radius)',
                background: 'var(--bg-elev)', border: '1px solid var(--line-soft)',
                fontFamily: 'var(--font-mono)', fontSize: 10.5,
                minWidth: 0,
              }}>
                <span style={{ flexShrink: 0, color: 'var(--jdm-green)' }}>✓</span>
                <span style={{
                  flex: '1 1 auto', minWidth: 0, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={e.label}>{e.label}</span>
                {e.tag && (
                  <span style={{
                    flex: '0 1 auto', minWidth: 0,
                    color: 'var(--ink-3)', fontSize: 9, lineHeight: 1.3,
                    padding: '1px 5px', borderRadius: 3,
                    background: 'var(--bg-card)', border: '1px solid var(--line-soft)',
                    maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={String(e.tag)}>{e.tag}</span>
                )}
              </div>
            ) : (
              // Log système : timestamp + tag + msg mono compact (pied de page)
              <div key={e.key} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 9.5,
                color: 'var(--ink-3)', minWidth: 0, opacity: 0.75,
              }}>
                <span style={{ flexShrink: 0 }}>{e.t}</span>
                <span style={{
                  flexShrink: 0,
                  color: e.tag === '[err]' ? 'var(--jdm-magenta)'
                    : e.tag === '[file]' ? a
                    : e.tag === '[done]' ? 'var(--jdm-green)'
                    : 'var(--ink-3)',
                }}>{e.tag}</span>
                <span style={{
                  flex: '1 1 auto', minWidth: 0, color: 'var(--ink-3)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={e.msg}>{e.msg}</span>
              </div>
            )
          ))}
        </div>
      </div>

      {/* footer — "détail →" est un bouton qui stoppe la propagation et
          ouvre le panneau de détail du flux (l'explication). Le reste de
          la card route vers le run. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 15px', borderTop: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>boucle {'·'} {flow.steps.length} etapes</span>
        <button type="button"
          onClick={(e) => { e.stopPropagation(); (onDetail || onOpen)(); }}
          className="focus-ring"
          title={`Voir le détail de « ${flow.title} » (outils, étapes)`}
          style={{
            background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--ink-3)',
            transition: 'color .16s, transform .16s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = a; e.currentTarget.style.transform = 'translateX(3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.transform = 'none'; }}
        >detail {'→'}</button>
      </div>
    </div>
  );
}

// Compact metric cell inside a dashboard card.
function JMini({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', textAlign: 'left' }}>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
        color: color || 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{label}</div>
    </div>
  );
}



// KPI tile for the dashboard's top strip.
// Derive a flow's live snapshot from a shared heartbeat (tick). Pure + cyclic,
// so each card looks like a pipeline endlessly looping through its candidates.
// One live "monitor" card for a flux — the heart of the dashboard.
// Compact metric cell inside a dashboard card.
// Loop schematic in two refined, low-saturation styles (Tweaks → Cercles Jarvis):
//   'boucle' — a single repeat/refresh arrow wrapping the number (calm, default).
//   'cycle'  — step nodes joined by directional arcs (the original).
// Colour is desaturated by mixing the flow accent ~50% with a neutral.
function useRingStyle() {
  const get = () => (typeof window !== 'undefined' && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.ringStyle) || 'boucle';
  const [s, setS] = useState(get);
  useEffect(() => {
    const f = () => setS(get());
    window.addEventListener('__jdm_tweaks_changed', f);
    return () => window.removeEventListener('__jdm_tweaks_changed', f);
  }, []);
  return s;
}

// `icon` optionnel : si fourni (ex. 'power'), remplace le numéro par
// une icône SVG centrée. Utilisé dans les cartes Supervision pour
// rendre l'intention « cliquer = allumer le flow » immédiate. `num`
// reste passé pour la couleur/animation (delay) — il n'est juste pas
// rendu visuellement.
function JLoopRing({ accent, num, steps, delay, size = 60, icon }) {
  const ringStyle = useRingStyle();
  const c = `color-mix(in srgb, ${accent} 50%, var(--ink-3) 50%)`;   // desaturated
  const cx = 32, cy = 32, R = 20;
  const f = (n) => n.toFixed(2);
  const pt = (deg, r = R) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arrow = (deg, ah = 3.4) => {
    const ea = (deg - 90) * Math.PI / 180;
    const tx = -Math.sin(ea), ty = Math.cos(ea);
    const px = Math.cos(ea), py = Math.sin(ea);
    const [ex, ey] = pt(deg);
    return { ex, ey,
      b1: [ex - ah * tx + ah * 0.6 * px, ey - ah * ty + ah * 0.6 * py],
      b2: [ex - ah * tx - ah * 0.6 * px, ey - ah * ty - ah * 0.6 * py] };
  };
  const N = Math.max(2, steps || 2);

  let arcGroup, marks = null;
  if (ringStyle === 'cycle') {
    const gap = N === 2 ? 26 : 22;
    const segs = [];
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const base = i * 360 / N;
      nodes.push(pt(base));
      const s = base + gap, e = (i + 1) * 360 / N - gap;
      const [sx, sy] = pt(s), [ex, ey] = pt(e);
      const large = (e - s) > 180 ? 1 : 0;
      segs.push({ sx, sy, ex, ey, large, a: arrow(e) });
    }
    arcGroup = segs.map((s, i) => (
      <React.Fragment key={i}>
        <path d={`M ${f(s.sx)} ${f(s.sy)} A ${R} ${R} 0 ${s.large} 1 ${f(s.ex)} ${f(s.ey)}`} />
        <path d={`M ${f(s.a.b1[0])} ${f(s.a.b1[1])} L ${f(s.ex)} ${f(s.ey)} L ${f(s.a.b2[0])} ${f(s.a.b2[1])}`} />
      </React.Fragment>
    ));
    marks = nodes.map((n, i) => (
      <g key={i}>
        <circle cx={f(n[0])} cy={f(n[1])} r={3.6} fill="var(--bg-card)" stroke={c} strokeWidth="1.6" />
        <circle cx={f(n[0])} cy={f(n[1])} r={1.6} fill={c} />
      </g>
    ));
  } else {
    // 'boucle' — one near-full loop arrow with a gap at the top.
    const g = 40;
    const s = g, e = 360 - g;
    const [sx, sy] = pt(s), [ex, ey] = pt(e);
    const a = arrow(e, 3.8);
    arcGroup = (
      <React.Fragment>
        <path d={`M ${f(sx)} ${f(sy)} A ${R} ${R} 0 1 1 ${f(ex)} ${f(ey)}`} />
        <path d={`M ${f(a.b1[0])} ${f(a.b1[1])} L ${f(ex)} ${f(ey)} L ${f(a.b2[0])} ${f(a.b2[1])}`} />
      </React.Fragment>
    );
    marks = Array.from({ length: N }).map((_, i) => {
      const base = i * 360 / N;
      if (base < g || base > (360 - g)) return null;
      const [mx, my] = pt(base);
      return <circle key={i} cx={f(mx)} cy={f(my)} r={1.9} fill={c} opacity="0.85" />;
    });
  }

  return (
    <span className="jring" style={{
      position: 'relative', width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" className="jring-halo" style={{
        position: 'absolute', inset: Math.round(size * 0.05), borderRadius: '50%',
        background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
        filter: 'blur(7px)',
        animation: `jorbGlow 3.8s ease-in-out ${delay || 0}s infinite`,
      }} />
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'relative', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={26} fill={c} opacity="0.05" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeWidth="1" opacity="0.16" />
        <g className="jring-arcs" stroke={c} fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {arcGroup}
        </g>
        {marks}
        {icon === 'power' ? (
          // Icône power : arc ouvert en haut + barre verticale centrée.
          // Dimensionnée pour le viewBox 64x64 standard du ring (R=21).
          <g transform={`translate(${cx} ${cy})`}
             stroke={c} strokeWidth="2.2" fill="none"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M -6 -3 A 7.5 7.5 0 1 0 6 -3" />
            <line x1="0" y1="-9" x2="0" y2="-1.5" />
          </g>
        ) : (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
            fill={c}
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 17 }}>{num}</text>
        )}
      </svg>
    </span>
  );
}

// ═══════════════════ Tool catalog — fetché depuis le backend ═══════════════════
// TOOL_DOCS et AGENT_TOOL_STEPS sont alimentés au boot par
// GET /api/jarvis/tools. Le backend introspecte les @tool LangChain
// de build_jdm_tools() et renvoie 39 fiches : {name, kind, description,
// signature, args}. Avant la fin du fetch, TOOL_DOCS est un objet vide
// et les usages tombent sur le fallback générique défini dans
// JToolDialog (sig='nom(…)', kind='outil').
//
// useToolDocs() renvoie [docs, ready] et force le re-render des
// consommateurs quand le fetch arrive — sans cela, JToolDialog ouvert
// avant que le catalogue soit chargé n'afficherait jamais ses détails.

let TOOL_DOCS = {};
const _TOOL_DOCS_LISTENERS = new Set();
let _TOOL_DOCS_LOADED = false;

function _notifyToolDocs() {
  for (const cb of _TOOL_DOCS_LISTENERS) { try { cb(); } catch {} }
}

async function _loadToolDocs() {
  if (_TOOL_DOCS_LOADED) return;
  try {
    const r = await fetch('api/jarvis/tools');
    if (!r.ok) return;
    const d = await r.json();
    const m = {};
    for (const t of d.tools || []) {
      // Adapter le format backend -> celui attendu par JToolDialog
      // (sig, kind, desc, docstring, prompt, cli, output).
      const argList = (t.args || []).map(a => a.name + (a.required ? '' : '?')).join(', ');
      m[t.name] = {
        sig: t.signature || `${t.name}(${argList})`,
        kind: t.kind || 'outil',
        desc: (t.description || '').split('\n')[0],  // 1re ligne en résumé
        docstring: t.docstring || t.description || '',
        // Pas d'entrée prompt ni de cli côté backend — on synthétise.
        prompt: `# Outil LangChain — ${t.name}\n\n` +
                (t.description || '').slice(0, 600) +
                ((t.description || '').length > 600 ? '…' : ''),
        cli: `# Disponible via le serveur MCP\nmcp call ${t.name} ${(t.args || []).map(a => '--' + a.name + ' …').join(' ')}`,
        output: (t.args || []).length === 0
          ? '{}'
          : '{\n  // sortie selon la signature du tool\n  // schéma : ' +
            (t.args || []).map(a => a.name + ':' + (a.type || 'any')).join(', ') + '\n}',
      };
    }
    TOOL_DOCS = m;
    _TOOL_DOCS_LOADED = true;
    _notifyToolDocs();
  } catch {}
}
if (typeof window !== 'undefined') { _loadToolDocs(); }

function useToolDocs() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _TOOL_DOCS_LISTENERS.add(force);
    return () => _TOOL_DOCS_LISTENERS.delete(force);
  }, []);
  return [TOOL_DOCS, _TOOL_DOCS_LOADED];
}

// Map outil → index d'étape dans flow.steps, par agent_id réel. Établi
// d'après les workflows backend (enrichment_workflow, audit_workflow,
// etc.) qui décrivent quel tool LLM est attendu à quelle étape.
const AGENT_TOOL_STEPS = {
  enrich: {
    enrichment_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    list_existing_for_enrichment: 0,
    disambiguate: 0,
    validate_candidate: 1,
    consolidate_candidate: 1,
    verify_claim: 1,
    infer: 1,
    write_submission_file: 2,
    submit_to_jdm: 2,
  },
  audit: {
    audit_workflow: 0,
    pick_random_term: 0,
    disambiguate: 0,
    exists: 0,
    get_relations_of_type: 1,
    verify_claim: 1,
    write_submission_file: 2,
  },
  gap: {
    gap_detection_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    detect_gaps: 1,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1,
  },
  signalement: {
    // Le tool backend est `error_detection_workflow` (renommé). On garde
    // signalement_workflow ici comme alias pour les anciennes traces ; les
    // nouvelles passent par error_detection_workflow.
    error_detection_workflow: 0,
    signalement_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    get_relations_of_type: 1,
    verify_claim: 1,
    write_submission_file: 2,
  },
  stats: {
    stats_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1,
  },
  annotation: {
    annotation_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    disambiguate: 0,
    get_relations_of_type: 1,
    write_submission_file: 2,
  },
};

// ═══════════════════ Tool catalog — fiches d'outils ═══════════════════
// Per-tool documentation surfaced in the JToolDialog (clic sur un chip outil).

// Which step (index into flow.steps) each tool serves, per flow.

function JToolCode({ children }) {
  return (
    <pre className="mono" style={{
      margin: 0, padding: '12px 14px', background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
      fontSize: 12, lineHeight: 1.55, color: 'var(--ink-2)',
      overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
    }}>{children}</pre>
  );
}

function JToolSection({ label, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="mono" style={{
        fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

// Copy-to-clipboard button (clipboard API + textarea fallback for sandboxed frames).
function JCopyBtn({ text, dark }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e) => {
    e.stopPropagation();
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    const fb = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {}
      done();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fb);
      } else fb();
    } catch (err) { fb(); }
  };
  return (
    <button type="button" onClick={onCopy} className={dark ? 'jcli-copy' : 'jcode-copy'}
      title="Copier" aria-label="Copier dans le presse-papiers">
      {copied ? '✓ Copié' : '⧉ Copier'}
    </button>
  );
}

// Lightweight syntax highlighter for all code/text zones (rendered on a dark surface).
// Handles JSON, HTTP docstrings, function docs and prompt specs in one pass.
function highlightCode(src) {
  const C = {
    comment: '#6b7280', guill: '#c9a978', verb: '#ff9e64', ph: '#7dcfff',
    key: '#7aa2f7', str: '#9ece6a', num: '#bb9af7', bool: '#ff9e64',
    punct: '#8b92a5', arrow: '#8b92a5',
  };
  const out = [];
  const re = /(#[^\n]*)|(«[^»]*»)|\b(GET|POST|PUT|DELETE|PATCH)\b|(\{[a-zA-Z0-9_]+\})|("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|(→)|([{}\[\],:])/g;
  let last = 0, m, i = 0;
  const push = (txt, color, extra) => out.push(<span key={i++} style={{ color, ...(extra || {}) }}>{txt}</span>);
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(<span key={i++}>{src.slice(last, m.index)}</span>);
    if (m[1] !== undefined) push(m[1], C.comment, { fontStyle: 'italic' });
    else if (m[2] !== undefined) push(m[2], C.guill, { fontStyle: 'italic' });
    else if (m[3] !== undefined) push(m[3], C.verb, { fontWeight: 600 });
    else if (m[4] !== undefined) push(m[4], C.ph);
    else if (m[5] !== undefined) {
      const isKey = m[6] !== undefined;
      push(m[5], isKey ? C.key : C.str);
      if (isKey) push(m[6], C.punct);
    }
    else if (m[7] !== undefined) push(m[7], C.num);
    else if (m[8] !== undefined) push(m[8], C.bool);
    else if (m[9] !== undefined) push(m[9], C.arrow);
    else if (m[10] !== undefined) push(m[10], C.punct);
    last = re.lastIndex;
  }
  if (last < src.length) out.push(<span key={i++}>{src.slice(last)}</span>);
  return out;
}

// Styled code zone — dark surface with a label header + copy button
// (docstring / prompt / output), so it reads clearly as a code/text area.
function JCodeBlock({ tag, code }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 8px 7px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tag || 'CODE'}</span>
        <JCopyBtn text={code} dark />
      </div>
      <pre className="mono" style={{
        margin: 0, padding: '13px 14px', background: '#0f1117',
        fontSize: 12, lineHeight: 1.6, color: '#d6dbe5',
        overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
      }}><code>{highlightCode(code)}</code></pre>
    </div>
  );
}

// Terminal-style block for the CLI command — traffic lights, prompt, copy button.
function JCliBlock({ command }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a' }}>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: '#8b92a5', letterSpacing: '0.04em', marginLeft: 4 }}>zsh — jdm-agent</span>
        <span style={{ marginLeft: 'auto' }}><JCopyBtn text={command} dark /></span>
      </div>
      <div style={{ padding: '13px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span className="mono" style={{ color: '#4ea63c', userSelect: 'none', flexShrink: 0, fontSize: 12.5, lineHeight: 1.6 }}>$</span>
        <code className="mono" style={{ color: '#e6e9ef', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>{command}</code>
      </div>
    </div>
  );
}

// Modal fiche for a single tool, contextualised to the flow it's used in.
function JToolDialog({ flow, tool, onClose }) {
  // useToolDocs s'abonne au catalogue : le 1er render après l'ouverture
  // peut tomber sur TOOL_DOCS={} (fetch pas encore arrivé), useToolDocs
  // force le re-render dès que /api/jarvis/tools répond.
  const [docs, ready] = useToolDocs();
  const doc = docs[tool] || {
    sig: tool + '(…)',
    kind: 'outil',
    desc: ready ? 'Outil non documenté.' : 'Chargement du catalogue…',
    docstring: '—', prompt: '—', cli: tool, output: '—',
  };
  // Two notions de flow distinctes :
  //   - `flow` (prop)         : flow d'ORIGINE depuis lequel le dialog a ete
  //                             ouvert. Garde la pastille « ACTUEL » comme
  //                             reperage contextuel.
  //   - `selectedFlowId` / `selectedFlow` : flow actuellement VIEWE dans
  //                             le dialog. Defaut = flow.id ; change quand
  //                             l'utilisateur clique sur une autre carte
  //                             dans « Inscription dans les sequences ».
  // Tous les rendus dependants d'un flow (Prompt agreged, step highlight,
  // accent CSS) utilisent selectedFlow.
  const [selectedFlowId, setSelectedFlowId] = useState(flow.id);
  const selectedFlow = JARVIS_AGENTS.find(f => f.id === selectedFlowId) || flow;
  const a = selectedFlow.accent;
  const kindColor = { 'API JDM': 'var(--jdm-cyan)', 'LLM': 'var(--jdm-violet)', 'logique': 'var(--jdm-orange)' }[doc.kind] || a;

  // Every flow whose sequence calls this tool (souvent plus d'une).
  const usages = JARVIS_AGENTS.filter(f => (AGENT_TOOL_STEPS[f.id] || {})[tool] != null);

  // « Prompt » du flow courant = concatenation des docstrings de TOUS les
  // tools du flow (workflow + step tools), dans l'ordre de leur step.
  // C'est exactement ce qui est envoye au LLM comme contexte pour ce flow.
  // On INCLUT TOUT, sans tronquer — meme si certains tools n'ont pas leur
  // doc disponible cote catalogue (chargement en cours), on liste leur
  // nom avec un placeholder pour ne pas masquer leur presence.
  const flowPrompt = (() => {
    // Utilise selectedFlow (= flow VIEWE dans le dialog), pas flow (=
    // flow d'ORIGINE). Permet la navigation : cliquer sur une autre
    // carte dans « Inscription » switch le prompt agreged sur ce flow.
    const fts = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[selectedFlow.id]) || {};
    const ordered = Object.keys(fts).sort((a, b) => (fts[a] - fts[b]));
    if (ordered.length === 0) return doc.prompt;
    const parts = [
      `# PROMPT AGREGED — flow « ${selectedFlow.title} » (${selectedFlow.id})`,
      `# Etapes : ${selectedFlow.steps.map((s, k) => `[${k}] ${s.n}`).join(' → ')}`,
      `# ${ordered.length} tools concatenes ci-dessous dans l'ordre d'execution.`,
      `# C'est ce que voit le LLM comme contexte agent pour ce flow.`,
      '',
    ];
    for (const t of ordered) {
      const d = docs[t];
      const step = fts[t];
      const stepName = (selectedFlow.steps[step] && selectedFlow.steps[step].n) || '';
      parts.push(`## [step ${step}${stepName ? ' · ' + stepName : ''}] ${t}()`);
      parts.push('');
      if (d) {
        if (d.sig) parts.push(`# signature : ${d.sig}`);
        if (d.kind) parts.push(`# kind : ${d.kind}`);
        if (d.sig || d.kind) parts.push('');
        parts.push((d.docstring || d.desc || '(pas de docstring)').trim());
      } else {
        parts.push('(documentation indisponible — catalogue /api/jarvis/tools encore en chargement ou ce tool n\'est pas registry-expose)');
      }
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    return parts.join('\n');
  })();

  const codeTabs = [
    { id: 'docstring', label: 'Docstring', body: doc.docstring, lang: 'text', tag: doc.kind === 'API JDM' ? 'HTTP' : 'DOC' },
    { id: 'prompt',    label: 'Prompt',    body: flowPrompt,    lang: 'text', tag: 'PROMPT · FLOW' },
    { id: 'cli',       label: 'CLI',       body: doc.cli,       lang: 'sh' },
    { id: 'output',    label: 'Sortie',    body: doc.output,    lang: 'json', tag: 'JSON' },
  ];
  const [tab, setTab] = useState(doc.kind === 'LLM' ? 'prompt' : 'docstring');
  const active = codeTabs.find(t => t.id === tab) || codeTabs[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; };
  }, [onClose]);

  return ReactDOM.createPortal((
    <div onClick={onClose} className="jtool-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'rgba(15,12,8,0.5)',
      backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={doc.sig}
        className="fade-up jpanel-scroll" style={{
          width: 'min(820px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
          borderTop: `3px solid ${kindColor}`,
        }}>
        {/* header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
          padding: '16px 20px 14px', background: 'var(--bg-card)',
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>{tool}<span style={{ color: 'var(--ink-3)' }}>()</span></span>
              <span className="mono" style={{
                fontSize: 9.5, padding: '3px 8px', borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${kindColor} 50%, transparent)`,
                background: `color-mix(in srgb, ${kindColor} 9%, transparent)`,
                color: kindColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
              }}>{doc.kind}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{doc.sig}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="focus-ring" style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--bg-elev)',
            color: 'var(--ink-2)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '4px 20px 20px' }}>
          <JToolSection label="Description">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{doc.desc}</p>
          </JToolSection>

          <JToolSection label={usages.length > 1 ? 'Inscription dans les séquences' : 'Inscription dans la séquence'}>
            <div style={{ display: 'grid', gap: 10 }}>
              {usages.map(u => {
                const si = (AGENT_TOOL_STEPS[u.id] || {})[tool];
                // Distinction nette : `isOriginFlow` = flow depuis lequel le
                // dialog a ete OUVERT (garde la pastille « actuel », pas
                // d'highlight). `isSelected` = flow actuellement VIEWE dans
                // le dialog (= alimente le Prompt tab) → highlight visuel.
                const isOriginFlow = u.id === flow.id;
                const isSelected   = u.id === selectedFlowId;
                const uc = u.accent;
                return (
                  <button key={u.id} type="button"
                    onClick={() => setSelectedFlowId(u.id)}
                    className="focus-ring"
                    title={isSelected
                      ? `Flow viewé — Prompt + step ci-dessous concernent « ${u.title} »`
                      : `Cliquer pour voir le Prompt agreged + l'étape de « ${u.title} »`}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '10px 12px', borderRadius: 'var(--radius)',
                      background: isSelected ? `color-mix(in srgb, ${uc} 14%, var(--bg-elev))` : 'var(--bg-elev)',
                      border: '1px solid ' + (isSelected ? `color-mix(in srgb, ${uc} 55%, transparent)` : 'var(--line-soft)'),
                      boxShadow: isSelected ? `0 0 0 1px color-mix(in srgb, ${uc} 35%, transparent), 0 6px 18px -10px ${uc}` : 'none',
                      transition: 'background .18s, border-color .18s, box-shadow .25s',
                      fontFamily: 'inherit',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: uc, flexShrink: 0,
                        opacity: isSelected ? 1 : 0.6,
                      }} />
                      <span className="display" style={{
                        fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600,
                        color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                        letterSpacing: '-0.01em',
                      }}>{u.title}</span>
                      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{u.kicker}</span>
                      {isOriginFlow && (
                        <span className="mono" style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 999,
                          // Pastille « actuel » TOUJOURS presente sur le flow
                          // d'origine — meme si on a clique ailleurs. Quand
                          // elle n'est PLUS le flow viewé, on l'attenue (border
                          // pointillé, fond plus discret).
                          background: isSelected
                            ? `color-mix(in srgb, ${uc} 22%, transparent)`
                            : 'transparent',
                          border: isSelected
                            ? '1px solid transparent'
                            : `1px dashed color-mix(in srgb, ${uc} 50%, transparent)`,
                          color: uc,
                          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                        }}>actuel</span>
                      )}
                      {isSelected && !isOriginFlow && (
                        // Indicateur « viewé » sur un flow autre que l'origine
                        // — pour signaler que c'est le flow qui alimente le
                        // Prompt sans ambiguïté.
                        <span className="mono" style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 999,
                          background: uc, color: 'var(--bg)',
                          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                        }}>viewé</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: si != null ? 7 : 0 }}>
                      {u.steps.map((s, k) => {
                        const act = k === si;
                        return (
                          <React.Fragment key={k}>
                            {k > 0 && <span style={{ color: 'var(--line)', fontSize: 12 }}>›</span>}
                            <span className="mono" style={{
                              fontSize: 10.5, padding: '3px 9px', borderRadius: 999,
                              background: act ? `color-mix(in srgb, ${uc} 16%, transparent)` : 'var(--bg-card)',
                              border: '1px solid ' + (act ? `color-mix(in srgb, ${uc} 50%, transparent)` : 'var(--line-soft)'),
                              color: act ? uc : 'var(--ink-3)', fontWeight: act ? 600 : 400,
                            }}>{s.n}</span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {si != null && u.steps[si] && (
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)' }}>
                        Étape <strong style={{ color: 'var(--ink-2)' }}>« {u.steps[si].n} »</strong> — {u.steps[si].d}.
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </JToolSection>

          <JToolSection label="Détails de l'outil">
            <div role="tablist" style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
              {codeTabs.map(t => {
                const on = t.id === tab;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on}
                    onClick={() => setTab(t.id)} className="focus-ring"
                    style={{
                      appearance: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '7px 12px', marginBottom: -1,
                      borderBottom: '2px solid ' + (on ? kindColor : 'transparent'),
                      color: on ? 'var(--ink)' : 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                      fontWeight: on ? 600 : 400, transition: 'color .15s, border-color .15s',
                    }}>{t.label}</button>
                );
              })}
            </div>
            {/* Le body du tab est rendu en pleine hauteur — le scroll est
                porte par le modal exterieur (overflow:auto sur le dialog
                container). Comme ca le prompt aggreged d'un flow peut
                faire 1500 lignes : tout reste visible, on scrolle juste
                le modal de bout en bout. */}
            {active.id === 'cli'
              ? <JCliBlock command={doc.cli} />
              : <JCodeBlock tag={active.tag} code={active.body} />}
          </JToolSection>
        </div>
      </div>
    </div>
  ), document.body);
}

// ═══════════════════ Per-flow design panel ═══════════════════
function JAgentPanel({ flow, index, onLaunch, onIndex, onSommaire, standalone, onBack, onEdit, onDelete }) {
  // Tools utilises par ce flow (derives de AGENT_TOOL_STEPS — le mapping
  // reel tool -> etape, defini en haut du fichier en s'alignant sur les
  // workflows backend). Pas de samples : la "candidatesPool" du design
  // etait des donnees fictives ; les vraies candidats remontent dans
  // le ItemCard de la vue Run au moment du run, pas en preview.
  const isCustom = !!flow._custom;
  const steps = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[flow.id]) || {};
  const tools = Object.keys(steps);
  const samples = [];
  const params = defaultParamsFor(flow.id);
  const [openTool, setOpenTool] = useState(null);
  // Catalogue chargé (boot) → liste d'outils pour un agent SUR MESURE : son
  // allow-list si renseignée, sinon TOUT le catalogue proposable (sans
  // *_workflow). Rendu en chips cliquables, EXACTEMENT comme les natifs.
  const [_allDocs] = useToolDocs();
  let customTools = [];
  if (isCustom) {
    const al = (flow._spec && flow._spec.allowed_tools) || [];
    customTools = (al && al.length)
      ? al
      : Object.keys(_allDocs || {}).filter(n => n && !n.endsWith('_workflow')).sort();
  }
  const panelPos = J_PANELS.findIndex(p => p.id === flow.id);  // position in the carousel track
  const safeIndex = index >= 0 ? index : 0;  // custom : pas dans JARVIS_AGENTS
  const lastFlow = index === JARVIS_AGENTS.length - 1;

  return (
    <div style={{ width: '100%', maxWidth: 1120, margin: standalone ? '0 auto' : undefined, padding: standalone ? '6px 28px 80px' : undefined }}>
      {openTool && <JToolDialog flow={flow} tool={openTool} onClose={() => setOpenTool(null)} />}
      {standalone && (
        <button type="button" onClick={onBack} className="focus-ring" style={{ ...ghostLinkStyle, marginBottom: 16 }}>
          ← Retour
        </button>
      )}
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
        paddingBottom: 16, marginBottom: 24,
        borderBottom: `1px solid var(--line)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            type="button"
            onClick={onLaunch}
            className="jring-btn"
            title="Lancer cet agent"
            aria-label="Lancer cet agent"
            style={{ flexShrink: 0 }}>
            {/* Emoji du flux NU — aucun fond ni bordure (pas de carré blanc,
                pas l'anneau numéroté générique). */}
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 84, height: 84, fontSize: 56, lineHeight: 1,
              background: 'transparent', border: 'none',
            }}>{agentIcon(flow.id)}</span>
          </button>
          <div>
            <div className="mono" style={{
              fontSize: 11, color: flow.accent, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{flow.kicker}{isCustom ? '' : ` · ${index + 1} / ${JARVIS_AGENTS.length}`}</div>
            <h1 className="display" style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 3.6vw, 44px)', fontWeight: 500,
              letterSpacing: '-0.02em', lineHeight: 1.02, color: 'var(--ink)',
            }}>{flow.title}</h1>
            <div style={{ marginTop: 9, display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>produit</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 17, color: 'var(--ink-2)',
              }}>{flow.produces}</span>
            </div>
          </div>
        </div>
        <div className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${flow.accent} 55%, var(--line))`,
          color: `color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`,
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          background: `color-mix(in srgb, ${flow.accent} 7%, transparent)`,
        }}>
          <LoopGlyph color={`color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`} /> boucle · {flow.steps.length} étapes
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 26,
        alignItems: 'start',
      }}>
        {/* ── Left : the design of the flow, in sequence ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{
            margin: 0, fontSize: 15, lineHeight: 1.6,
            color: 'var(--ink-2)', maxWidth: '58ch',
          }}>{flow.desc}</p>

          <JLoopDiagram flow={flow} />

          {tools.length > 0 && (
            <div>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Outils JDM mobilisés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tools.map(t => (
                  <button key={t} type="button" onClick={() => setOpenTool(t)}
                    className="jtool-chip" title={`Voir la fiche de ${t}()`}
                    style={{
                      fontSize: 11, padding: '4px 9px',
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: 'var(--radius)', color: 'var(--ink-2)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      transition: 'border-color .14s, color .14s, background .14s',
                    }}>{t}()<span style={{ opacity: 0.5, fontSize: 10 }}>↗</span></button>
                ))}
              </div>
            </div>
          )}

          {/* ── Agent SUR MESURE : sa stratégie (system prompt) + ses outils ── */}
          {isCustom && (
            <div>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Stratégie de l'agent</div>
              <div style={{
                whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12.5,
                lineHeight: 1.55, color: 'var(--ink-2)', background: 'var(--bg-card)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                padding: '12px 14px', maxHeight: 320, overflow: 'auto',
              }}>{flow._strategy || '(stratégie non renseignée)'}</div>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 8px',
              }}>Outils JDM mobilisés</div>
              {customTools.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {customTools.map(t => (
                    <button key={t} type="button" onClick={() => setOpenTool(t)}
                      className="jtool-chip" title={`Voir la fiche de ${t}()`}
                      style={{
                        fontSize: 11, padding: '4px 9px', background: 'var(--bg-elev)',
                        border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
                        color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        transition: 'border-color .14s, color .14s, background .14s',
                      }}>{t}()<span style={{ opacity: 0.5, fontSize: 10 }}>↗</span></button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  … chargement du catalogue d'outils …
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right : params preview + sample output + CTA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={16} style={{ borderTop: `3px solid ${flow.accent}` }}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
            }}>Tu paramètres</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {Object.entries(params).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5,
                }}>
                  <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{PARAM_LABELS[k] || k}</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
                  <span className="mono" style={{
                    color: 'var(--ink)', textAlign: 'right', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%',
                  }}>{formatParam(k, v)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '9px 14px', background: 'var(--bg-elev)',
              borderBottom: '1px solid var(--line-soft)',
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Aperçu des résultats validés</div>
            </div>
            <div style={{ padding: 10, display: 'grid', gap: 4 }}>
              {samples.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', background: 'var(--bg-elev)',
                  border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>✓</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{s.s.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '8px 14px', borderTop: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)', fontFamily: 'var(--font-mono)',
              fontSize: 10.5, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Exemple · la boucle en accumule davantage</div>
          </Card>

          <Button full size="lg" onClick={onLaunch}>▶ Lancer cet agent</Button>
        </div>
      </div>

      {/* Footer : sequence position + step within the run. En mode standalone
          (vue détail ouverte par « Détail → »), pas de navigation carousel —
          juste un retour. */}
      {standalone ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, marginTop: 26, paddingTop: 16,
          borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap',
        }}>
          <button type="button" onClick={onBack} className="focus-ring" style={ghostLinkStyle}>
            ← Retour
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isCustom && onEdit && (
              <button type="button" onClick={() => onEdit(flow)} className="focus-ring" style={ghostLinkStyle}>
                ✎ Modifier
              </button>
            )}
            {isCustom && onDelete && (
              <button type="button" onClick={() => onDelete(flow)} className="focus-ring"
                style={{ ...ghostLinkStyle, color: 'var(--jdm-magenta)', borderColor: 'color-mix(in srgb, var(--jdm-magenta) 40%, var(--line))' }}>
                🗑 Supprimer
              </button>
            )}
            <Button size="sm" onClick={onLaunch}>▶ Lancer cet agent</Button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, marginTop: 26, paddingTop: 16,
          borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap',
        }}>
          <button type="button" onClick={onSommaire} className="focus-ring" style={ghostLinkStyle}>
            ↖ Accueil
          </button>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
            AGENT {String(index + 1).padStart(2, '0')} / {String(JARVIS_AGENTS.length).padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => onIndex(panelPos - 1)} className="focus-ring" style={ghostLinkStyle}>
              ‹ Précédent
            </button>
            <button type="button"
              onClick={() => lastFlow ? onSommaire() : onIndex(panelPos + 1)}
              className="focus-ring" style={ghostLinkStyle}>
              {lastFlow ? 'Accueil ›' : 'Suivant ›'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ghostLinkStyle = {
  background: 'transparent', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '6px 12px',
  color: 'var(--ink-2)', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: 11,
  letterSpacing: '0.05em',
};

const PARAM_LABELS = {
  term: 'terme', relation: 'relation', maxIter: 'itér. max',
  minConf: 'confiance min', depth: 'profondeur', text: 'texte', concept: 'concept',
};
function formatParam(k, v) {
  if (k === 'minConf') return Math.round(v * 100) + ' %';
  if (k === 'text') return '« ' + String(v).slice(0, 28) + '… »';
  if (k === 'relation') return String(v);
  return String(v);
}

// ─── Loop diagram : the flow's steps laid out in sequence, looping ───
function JLoopDiagram({ flow }) {
  const mc = `color-mix(in srgb, ${flow.accent} 58%, var(--ink-3) 42%)`;
  const lineCol = `color-mix(in srgb, ${flow.accent} 30%, var(--line))`;
  const steps = flow.steps;
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--line-soft)',
      }}>
        <LoopGlyph color={mc} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>La boucle, étape par étape</span>
      </div>

      <div style={{ padding: '16px 18px 14px' }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: mc, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                  boxShadow: `0 2px 6px -2px ${mc}`,
                }}>{i + 1}</span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 14, background: lineCol, marginTop: 4, borderRadius: 2 }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, paddingTop: 3 }}>
                <div className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
                }}>{s.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 3 }}>{s.d}</div>
              </div>
            </div>
          );
        })}

        {/* loop-back to step 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none" aria-hidden="true">
              <path d="M14 4 A 8 8 0 1 1 6 12" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M11 3 L14 4 L13 7" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mono" style={{
            alignSelf: 'center', fontSize: 11, color: mc,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>recommence — jusqu'au critère d'arrêt</div>
        </div>
      </div>
    </div>
  );
}

function JArrow({ color }) {
  return (
    <div style={{
      flex: '0 0 30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'flex-start', marginTop: 6, color,
    }}>
      <svg width="26" height="14" viewBox="0 0 26 14" fill="none">
        <path d="M1 7 H22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M18 3 L23 7 L18 11" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

// ─── Bottom sticky rail — the three top-level Jarvis sections ───
// Style aligné sur JarvisRunRail (rail de la vue Run) : fond opaque
// avec blur, border-top, pills compacts, position fixed bottom 0.
function JSectionNav({ activeSection, onSelect, hidden }) {
  return (
    <nav aria-label="Sections Jarvis" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      transform: hidden ? 'translateY(110%)' : 'translateY(0)',
      opacity: hidden ? 0 : 1,
      pointerEvents: hidden ? 'none' : 'auto',
      transition: 'transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease',
      borderTop: '1px solid var(--line-soft)',
      background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        overflowX: 'auto', whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
      }} className="jpanel-scroll">
        {/* « Sections » reste flush left, les pills sont centrés via
            les 2 spacers flex:1 de part et d'autre. Au-dessous d'une
            certaine largeur, le scroll horizontal prend le relais
            (overflowX: auto) — pas de débordement visuel. */}
        <span className="mono" style={{
          flexShrink: 0, fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginRight: 4,
        }}>Sections</span>
        <div style={{ flex: 1, minWidth: 8 }} aria-hidden="true" />
        {J_SECTIONS.map((p, i) => {
          const active = activeSection === p.id;
          return (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)}
              aria-label={`Aller à ${p.label}`} aria-current={active ? 'page' : undefined}
              className="focus-ring"
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 11px',
                background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)',
                border: '1px solid ' + (active ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'var(--line-soft)'),
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: active ? 'var(--accent)' : 'var(--ink-2)',
                transition: 'background .15s, border-color .15s, color .15s',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)', opacity: active ? 1 : 0.45,
              }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 11, opacity: active ? 0.9 : 0.55, fontWeight: 500,
                letterSpacing: 0,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ color: 'inherit' }}>{p.label}</span>
              {active && (
                <span className="mono" style={{
                  fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                  background: 'var(--accent)', color: 'var(--bg)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>actuel</span>
              )}
            </button>
          );
        })}
        {/* spacer droit (= miroir du gauche) pour finir le centrage des pills */}
        <div style={{ flex: 1, minWidth: 8 }} aria-hidden="true" />
        {/* Bouton « Discuter avec Jarvis » flush à droite — dispatche un
            event window écouté par la bannière (JarvisBanner) qui ouvre le
            panneau de chat latéral. */}
        <button type="button" className="focus-ring"
          onClick={() => { try { window.dispatchEvent(new CustomEvent('jdm-toggle-jarvis-chat')); } catch (e) {} }}
          aria-label="Discuter avec Jarvis"
          title="Discuter avec Jarvis"
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 13px', marginLeft: 4,
            background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
            border: '1px solid color-mix(in srgb, var(--accent) 55%, transparent)',
            borderRadius: 999, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            color: 'var(--accent)',
            transition: 'background .15s, border-color .15s, transform .12s',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Discuter avec Jarvis
        </button>
      </div>
    </nav>
  );
}

// ─── (legacy) Carousel navigation — kept for reference, no longer mounted ───
function JAgentNav({ navStyle, activePanel, onSelect }) {
  const [wide, setWide] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1100 : true);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (navStyle === 'left' && wide) return <JNavRail activePanel={activePanel} onSelect={onSelect} />;
  return <JNavBottom activePanel={activePanel} onSelect={onSelect} />;
}

function JNavBottom({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ x: ir.left - cr.left + cont.scrollLeft, w: ir.width, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre agents" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 2, padding: 6,
      maxWidth: 'calc(100vw - 32px)', overflowX: 'auto',
      background: 'var(--bg-card)', border: '1px solid var(--line)',
      borderRadius: 999, boxShadow: 'var(--shadow)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 40, scrollbarWidth: 'none',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: indicator.x, width: indicator.w,
        top: 6, bottom: 6, background: 'var(--accent)', borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
        zIndex: 0,
      }} />
      {J_PANELS.map((p, i) => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button" onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 13px', background: 'transparent', border: 'none',
              borderRadius: 999, cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
              transition: 'color 0.32s 0.05s',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
              opacity: active ? 0.85 : 0.55, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
            }}>{String(i).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function JNavRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre agents" style={{
      position: 'fixed', left: 32, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 0, zIndex: 40,
      borderLeft: '1px solid var(--line)', paddingLeft: 16,
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: -1, top: indicator.y, height: indicator.h,
        width: 2, background: 'var(--accent)', opacity: indicator.ready ? 1 : 0,
        transition: 'top 0.42s cubic-bezier(0.4,0,0.2,1), height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
      }} />
      {J_PANELS.map((p, i) => (
        <JRailItem key={p.id}
          ref={el => { if (el) itemRefs.current[p.id] = el; }}
          num={String(i).padStart(2, '0')} label={p.label}
          active={activePanel === p.id} onClick={() => onSelect(p.id)} />
      ))}
    </nav>
  );
}

const JRailItem = React.forwardRef(function JRailItem({ num, label, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? 'var(--accent)' : (hover ? 'var(--ink)' : 'var(--ink-3)');
  return (
    <button ref={ref} type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={`Aller à ${label}`}
      style={{
        background: 'transparent', border: 'none', padding: '13px 0',
        cursor: 'pointer', textAlign: 'left', display: 'flex',
        flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        position: 'relative', color, transition: 'color 0.32s', fontFamily: 'inherit',
      }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 20, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.01em', color: 'inherit',
      }}>{num}</span>
      <span className="mono" style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
        color: 'inherit', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
});

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
function JarvisRun({ flow, nextFlow, onBack, onNext }) {
  // Pré-remplissage du `term` depuis Projet › Quick try (si présent).
  // Consommation et nettoyage du payload au mount. PAS de lancement
  // automatique — l'utilisateur clique « Lancer » lui-même.
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.jarvis) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.jarvis;
  }
  const [params, setParams] = useState(() => {
    const base = defaultParamsFor(flow.id);
    if (_pending?.term && typeof base === 'object') {
      return { ...base, term: _pending.term };
    }
    return base;
  });
  // ── Run state hoisted in JarvisStore ───────────────────────────
  // Survit aux unmounts → switch d'onglet pendant un run ne tue plus
  // le flow ni la progression affichée. Le composant ne fait que lire
  // et déclencher des actions sur le store.
  const run = useJarvisRunState(flow.id);
  const state = run.status;
  const log = run.log;
  const metrics = run.metrics;
  const accepted = run.accepted;
  const narrationHTML = run.narrationHTML;
  const filePreview = run.filePreview;
  const filePath = run.filePath;
  const headline = run.headline;
  const resumeState = run.resumeState;
  const setResumeState = (v) => JarvisStore.patch(flow.id, { resumeState: v });
  const [poolStatus, setPoolStatus] = useState(null);
  // État des secrets en env serveur. Permet d'autoriser
  // soumission / auto-upload même si l'utilisateur n'a pas tapé la clé
  // (elle sera prise depuis l'env par le backend).
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  // État du bouton « 📤 Soumettre » post-hoc à côté de Télécharger.
  // submitState ∈ {idle, sending, done, error}. submitMsg = retour serveur
  // affiché en pastille discrète sous l'en-tête du panneau pour ~6s.
  const [submitState, setSubmitState] = useState('idle');
  const [submitMsg, setSubmitMsg] = useState('');

  // Vue alternative du panneau GAUCHE (Narration LLM) :
  //   'log' (défaut, timeline mono-fontée avec timestamps + tags colorés
  //   — donne le suivi factuel des events) ↔ 'narration' (markdown HTML
  //   rendu, pensées + tool calls formatés par le backend). Le toggle
  //   apparaît dans le header du panneau. Le panneau droit (ItemCard)
  //   reste constant.
  const [leftView, setLeftView] = useState('log');

  // Pool status pour griser les Gemini blown dans le dropdown modèle.
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('api/pool/status');
        if (r.ok && alive) setPoolStatus(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const logRef = useRef(null);

  // Auto-scroll log + narration : suit le flux de génération en bas
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);

  // Parse le file_preview pour extraire les items à afficher dans le
  // panneau de droite. Mémoïsé sur (filePreview, flow.id) — la parse
  // est cheap mais évite de re-allouer N fois par seconde pendant
  // que le fichier grandit.
  const parsed = React.useMemo(
    () => parseFilePreview(filePreview, flow.id),
    [filePreview, flow.id]
  );

  // Synchronise le compteur "produced" du dashboard avec les items
  // parsés. Pour enrich, on garde la source registry (`accepted`) qui
  // est canonique. Push direct dans le store via patch — pas de setX
  // local (le state vit là-bas).
  React.useEffect(() => {
    if (flow.consolidates) {
      JarvisStore.patch(flow.id, { metrics: { ...metrics, produced: metrics.accepted } });
    } else {
      const n = parsed.items.filter(i => i.type !== 'meta' && i.type !== 'sens').length;
      JarvisStore.patch(flow.id, { metrics: { ...metrics, produced: n } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.items.length, metrics.accepted, flow.id]);

  // launch/stop/reset délèguent au store. Le reader SSE + l'horloge
  // elapsed + le state du run vivent là-bas, donc unmount du composant
  // (= switch d'onglet) ne tue plus le flow.
  const launch = (continueFromResume) => {
    JarvisStore.start(flow.id, {
      params,
      isResume: !!continueFromResume,
      resumeState: continueFromResume ? resumeState : null,
    });
    if (continueFromResume) setResumeState(null);
  };
  const stop = () => JarvisStore.stop(flow.id);
  const reset = () => JarvisStore.reset(flow.id);

  // Smooth scroll animé : tween rAF custom (behavior:'smooth' peut
  // etre desactive par prefers-reduced-motion).
  //
  // Deux comportements :
  //   - À l'ouverture (mount / changement de flow) : scroll vers le
  //     TITRE (top + petite marge), pas vers le bas. L'utilisateur veut
  //     voir le header « Audit sémantique » + description avant les
  //     metrics/cards.
  //   - Au lancement (idle → running) : scroll vers le bas pour suivre
  //     le live (narration LLM + triplets en cours d'écriture).
  const _scrollSmoothTo = React.useCallback((targetY) => {
    const startY = window.scrollY || window.pageYOffset || 0;
    const dist = targetY - startY;
    if (Math.abs(dist) < 4) return;  // déjà au bon endroit
    const dur = 520;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, startY + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);
  const _scrollSmoothToBottom = React.useCallback(() => {
    _scrollSmoothTo(Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  }, [_scrollSmoothTo]);
  // Au mount / changement de flow : scroll vers le HAUT (titre visible
  // a quelques pixels du top). Pas vers le bas, l'utilisateur veut voir
  // l'entete du run avant les metrics et le live.
  React.useEffect(() => {
    const tid = setTimeout(() => _scrollSmoothTo(0), 50);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);
  // Au passage idle → running (clic Lancer) : scroll vers le bas pour
  // suivre la narration live + les triplets qui arrivent.
  const _prevStateRef = useRef(state);
  React.useEffect(() => {
    if (_prevStateRef.current === 'idle' && state === 'running') {
      setTimeout(_scrollSmoothToBottom, 200);
    }
    _prevStateRef.current = state;
  }, [state, _scrollSmoothToBottom]);

  return (
    <PageShell>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
      }}>
        <Button variant="ghost" size="sm" onClick={onBack}>← Tous les agents</Button>
        <span style={{ color: 'var(--ink-3)' }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: flow.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
        {/* Symétrique : à droite, le flux suivant si pas en bout. */}
        {onNext && nextFlow && (
          <Button variant="ghost" size="sm" onClick={onNext}
            style={{ marginLeft: 'auto' }}>
            {nextFlow.title} →
          </Button>
        )}
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
                <Button full onClick={() => launch(false)}>
                  {state === 'idle' ? '▶ Lancer' : '↻ Relancer'}
                </Button>
              )}
              {state === 'running' && (
                <Button variant="secondary" full onClick={stop}>⏹ Stop</Button>
              )}
            </div>

            {/* Bouton Continuer — apparaît si l'agent a abort (mode B) */}
            {resumeState && state !== 'running' && (
              <div style={{ marginTop: 10 }}>
                <Button full onClick={() => launch(true)}>
                  ▶ Continuer avec 3.1
                </Button>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
                  L'agent a saturé son quota — reprends sur Gemini 3.1 Flash Lite
                  (pool partagé, 500 req/jour) en gardant l'historique.
                </div>
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 12, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer',
            }}>
              <input type="checkbox"
                checked={!!params.auto_switch}
                onChange={(e) => setParams(p => ({ ...p, auto_switch: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
                disabled={state === 'running'} />
              Auto-bascule sur 3.1 si quota épuisé
            </label>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>
              Décoché (défaut) : abort propre + bouton « Continuer » apparaît.
              Coché : retry silencieux sans intervention.
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
              marginBottom: 8,
            }}>Note</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Modèle, budget et clés sont configurés dans la barre horizontale
              en bas de l'écran (sous la vue temps réel).
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

          {/* ── Barre horizontale Modèle / Budget / Clé LLMDrops :
              Modèle / Budget / Clé LLMDrops (et clé BYOK si applicable).
              Positionnée AU-DESSUS des compteurs (remontée depuis sidebar). */}
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: (params.model || '').match(/^(claude|gpt)-/)
                ? 'minmax(180px, 1.4fr) minmax(140px, 1fr) minmax(180px, 1.2fr) minmax(180px, 1.2fr)'
                : 'minmax(220px, 1.6fr) minmax(160px, 1fr) minmax(200px, 1.2fr)',
              gap: 12,
              alignItems: 'end',
            }}>
              <Field label="Modèle">
                <Select value={params.model || 'gemini-3.1-flash-lite'}
                  onChange={(v) => setParams(p => ({ ...p, model: v }))}
                  options={[
                    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
                    { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash' },
                    { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5 (BYOK)' },
                    { value: 'gpt-4o-mini',           label: 'GPT-4o mini (BYOK)' },
                  ].map(m => {
                    if (poolStatus && m.value.startsWith('gemini-')) {
                      const allBlown = (poolStatus.keys || []).every(
                        k => k.invalid || (k.blown_by_model && k.blown_by_model[m.value])
                      );
                      if (allBlown && poolStatus.keys && poolStatus.keys.length > 0) {
                        return { ...m, label: `❌ ${m.label} — épuisé`,
                                 sub: 'pool entièrement consommé aujourd\'hui' };
                      }
                    }
                    return m;
                  })} />
              </Field>
              <Field label="Budget outils">
                <Select value={params.budget_label || 'illimité'}
                  onChange={(v) => setParams(p => ({ ...p, budget_label: v }))}
                  options={BUDGET_OPTS} />
              </Field>
              <Field label={
                _envHasDrops
                  ? 'Clé LLMDrops (override .env)'
                  : 'Clé LLMDrops'
              }>
                <Input type="password"
                  value={params.drops_key || ''}
                  onChange={(v) => setParams(p => ({ ...p, drops_key: v }))}
                  placeholder={_envHasDrops ? '— configurée côté serveur —' : 'vide = pas de clé'}
                  mono />
              </Field>
              {(params.model || '').match(/^(claude|gpt)-/) && (() => {
                const envKey = (params.model || '').startsWith('claude-') ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
                const envHas = !!(_envStatus[envKey] && _envStatus[envKey].set);
                return (
                  <Field label={envHas ? 'Clé API LLM (override .env)' : 'Clé API LLM'}>
                    <Input type="password"
                      value={params.api_key || ''}
                      onChange={(v) => setParams(p => ({ ...p, api_key: v }))}
                      placeholder={envHas
                        ? '— configurée côté serveur —'
                        : ((params.model || '').startsWith('claude-') ? 'sk-ant-…' : 'sk-…')}
                      mono />
                  </Field>
                );
              })()}
            </div>
            {/* Checkbox raisonnement (chain-of-thought) — pareil que dans
                l'onglet Chatbot LLM. Toggle params.use_thinking, dispo
                quel que soit le modèle (Gemini, Claude, GPT). Pour les
                flows Jarvis le défaut est false (robustesse > raisonnement
                long) mais l'utilisateur peut l'activer ad hoc. */}
            <label
              title="Active la trace de raisonnement (« thinking » Anthropic / Google) — coûte plus de tokens mais peut améliorer les choix d'outils."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--line-soft)',
              }}>
              <input type="checkbox"
                checked={!!params.use_thinking}
                onChange={(e) => setParams(p => ({ ...p, use_thinking: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }} />
              Raisonnement (chain-of-thought)
            </label>
          </Card>

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
            <Metric label="Tokens" value={fmtTokens(metrics.tokens)} sub="estimés" mono />
            {/* Compteur "produits" dynamique selon le flow : pour enrich
                = consolidés depuis le registry ; pour audit/err/annot/stats
                = items extraits du file_preview (signalements + verdicts +
                annotations + lignes). Le label s'adapte. */}
            <Metric label={metricLabelFor(flow.id).label}
                    value={metrics.produced}
                    sub={metricLabelFor(flow.id).sub}
                    color="var(--jdm-green)" />
            <Metric label="Temps" value={fmtElapsed(metrics.elapsed)} sub="écoulé" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Narration (markdown HTML interprété — narrations LLM,
                tools, consolidations) — c'est notre VRAI log temps réel. */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {leftView === 'log' ? 'Log temps réel' : 'Narration LLM'}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
                  {/* Toggle Narration / Log — bascule l'affichage du panneau
                      gauche entre :
                      - Narration LLM (défaut) : markdown HTML rendu (pensées
                        + tool calls formatés par le backend, c'est notre
                        vrai « live » de l'agent)
                      - Log temps réel : timeline mono-fontée avec timestamps
                        + tags colorés par type d'event SSE (start/file/done/
                        error/cancelled)
                      Même flux de données ; seule la présentation change. */}
                  <div style={{
                    display: 'inline-flex',
                    background: 'var(--bg-card)', border: '1px solid var(--line)',
                    borderRadius: 999, padding: 2,
                  }}>
                    {[
                      { id: 'narration', label: 'Narration' },
                      { id: 'log',       label: 'Log' },
                    ].map(t => {
                      const active = leftView === t.id;
                      return (
                        <button key={t.id} type="button"
                          onClick={() => setLeftView(t.id)}
                          className="focus-ring"
                          style={{
                            padding: '3px 10px', borderRadius: 999,
                            border: 'none', cursor: 'pointer',
                            background: active ? flow.accent : 'transparent',
                            color: active ? 'var(--bg)' : 'var(--ink-3)',
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontWeight: active ? 600 : 500,
                            transition: 'background .18s, color .18s',
                          }}>{t.label}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420,
                overflowY: 'auto',
                padding: leftView === 'log' ? 12 : 14,
                background: 'var(--bg-card)',
                fontFamily: leftView === 'log' ? 'var(--font-mono)' : 'inherit',
                fontSize: leftView === 'log' ? 11 : 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {leftView === 'log' ? (
                  // Vue Log : derive les TENTATIVES depuis narrationHTML
                  // (data-tool attributes) + croise avec AGENT_TOOL_STEPS,
                  // puis groupe les tools de chaque tentative sous un
                  // header « Tentative N ». Les events SSE brut (log)
                  // restent en pied de page pour les meta-evenements
                  // (start/done/error/cancelled/file).
                  //
                  // Triplet VALIDE = present dans store.accepted (registry
                  // consolidation pour enrich) ou dans les items
                  // parseFilePreview type=consolidated/audit_signalement.
                  // On construit un Set de cles "term|rel|target" normalisees
                  // pour pouvoir teinter chaque ligne tentative.
                  (() => {
                    const fts = (typeof AGENT_TOOL_STEPS !== 'undefined' && AGENT_TOOL_STEPS[flow.id]) || {};
                    const _norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase();
                    const validatedSet = new Set();
                    if (Array.isArray(accepted)) {
                      for (const a of accepted) {
                        const t = _norm(a.subject || a.term);
                        const r = _norm(a.relation);
                        const tg = _norm(a.target);
                        if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
                      }
                    }
                    // file_preview consolidated/audit_signalement items
                    if (parsed && Array.isArray(parsed.items)) {
                      for (const it of parsed.items) {
                        if (it.type === 'consolidated' || it.type === 'audit_signalement') {
                          const t = _norm(it.subject);
                          const r = _norm(it.relation);
                          const tg = _norm(it.target);
                          if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
                        }
                      }
                    }
                    // Parse les tool calls — on extrait data-tool, data-triplet
                    // (pose cote backend depuis tc.args.term/relation/target) et
                    // data-result. La vue Log affiche les TRIPLETS tentes, pas
                    // la phrase humaine ; le pattern « X | r_xxx | Y » ressort
                    // directement de l'attribut data-triplet, deterministe.
                    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
                    const items = [];
                    if (narrationHTML) {
                      let mm;
                      while ((mm = re.exec(narrationHTML)) !== null) {
                        items.push({
                          tool: mm[1],
                          triplet: mm[3] || '',
                          isResult: !!mm[4],
                        });
                      }
                    }
                    // Regroupe par tentative (chaque step 0 apres step >=1 ouvre une nouvelle)
                    const tentatives = [];
                    let cur = null, prevStep = -1;
                    for (const it of items) {
                      if (it.isResult) {
                        if (cur) cur.push(it);
                        continue;
                      }
                      const s = fts[it.tool];
                      if (s === undefined) {
                        if (cur) cur.push(it);
                        continue;
                      }
                      if (s === 0 && (prevStep === -1 || prevStep >= 1)) {
                        cur = [];
                        tentatives.push(cur);
                      }
                      if (cur) cur.push(it);
                      prevStep = s;
                    }
                    if (!narrationHTML && (!log || log.length === 0)) return null;
                    return (
                      <>
                        {tentatives.map((tent, ti) => (
                          <div key={'t' + ti} style={{ marginBottom: 12 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '4px 0', marginBottom: 6,
                              borderBottom: `1px dashed color-mix(in srgb, ${flow.accent} 35%, transparent)`,
                              color: flow.accent, fontWeight: 600,
                              textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10,
                            }}>
                              <span style={{
                                background: flow.accent, color: 'var(--bg)',
                                padding: '1px 7px', borderRadius: 3, fontSize: 9.5,
                              }}>Tentative {ti + 1}</span>
                              <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
                                {tent.filter(x => !x.isResult).length} appel(s), {tent.filter(x => x.isResult).length} retour(s)
                              </span>
                            </div>
                            {tent.filter(x => !x.isResult && x.triplet).map((it, k) => {
                              // Affiche le TRIPLET tente (data-triplet : term|rel|target,
                              // term|rel, ou term seul selon le tool). Skip les tools
                              // sans triplet (workflow init, write_submission_file).
                              const parts = it.triplet.split('|');
                              const [term, rel, target] = parts;
                              // Check si ce triplet a fini par etre VALIDE (= present
                              // dans le registry de consolidation enrich ou les items
                              // consolidated du file_preview). Sans target on ne peut
                              // pas valider strictement, on laisse neutre.
                              const _key = (term && rel && target)
                                ? `${term.trim().toLowerCase()}|${rel.trim().toLowerCase()}|${target.trim().toLowerCase()}`
                                : null;
                              const isValidated = _key && validatedSet.has(_key);
                              return (
                                <div key={k} style={{
                                  display: 'flex', gap: 8, marginBottom: 3, alignItems: 'baseline',
                                  paddingLeft: 8, paddingRight: 8,
                                  // Teinte verte douce + liseré gauche quand valide.
                                  // L'absence de fond et de bordure pour les non valides
                                  // garde le visuel sobre par défaut.
                                  background: isValidated
                                    ? 'color-mix(in srgb, var(--jdm-green) 9%, transparent)'
                                    : 'transparent',
                                  borderLeft: isValidated
                                    ? '2px solid var(--jdm-green)'
                                    : '2px solid transparent',
                                  borderRadius: '0 3px 3px 0',
                                  paddingTop: 2, paddingBottom: 2,
                                  transition: 'background .25s, border-color .25s',
                                }} title={isValidated ? 'Triplet validé : passé en consolidation' : 'Triplet tenté'}>
                                  <span style={{
                                    flexShrink: 0, fontSize: 10,
                                    color: isValidated ? 'var(--jdm-green)' : 'var(--accent)',
                                    fontWeight: isValidated ? 700 : 400,
                                  }}>
                                    {isValidated ? '✓' : '→'}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', wordBreak: 'break-word' }}>
                                    <span style={{ fontWeight: 600 }}>{term}</span>
                                    {rel && (<>
                                      <span style={{ color: 'var(--ink-3)' }}> | </span>
                                      <span style={{ color: flow.accent }}>{rel}</span>
                                    </>)}
                                    {target && (<>
                                      <span style={{ color: 'var(--ink-3)' }}> | </span>
                                      <span style={{ fontWeight: 600 }}>{target}</span>
                                    </>)}
                                  </span>
                                  {isValidated && (
                                    <span className="mono" style={{
                                      flexShrink: 0, fontSize: 8.5, fontWeight: 600,
                                      padding: '1px 5px', borderRadius: 3,
                                      background: 'var(--jdm-green)', color: 'var(--bg)',
                                      textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>validé</span>
                                  )}
                                  <span style={{ flexShrink: 0, color: 'var(--ink-3)', fontSize: 9.5 }}>{it.tool}</span>
                                </div>
                              );
                            })}
                            {/* Si la tentative n'a aucun triplet (workflow + lookup seuls),
                                affiche un placeholder leger pour ne pas etre invisible. */}
                            {tent.filter(x => !x.isResult && x.triplet).length === 0 && (
                              <div style={{ paddingLeft: 8, fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                                aucun triplet tente dans cette tentative ({tent.filter(x => !x.isResult).length} appel(s) sans args triplet)
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Events SSE bruts (start/done/cancelled/file/error) en pied de page */}
                        {(log || []).length > 0 && (
                          <div style={{
                            marginTop: 14, paddingTop: 10,
                            borderTop: '1px solid var(--line-soft)',
                          }}>
                            <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Events systeme</div>
                            {log.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'baseline' }}>
                                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                                <span style={{
                                  flexShrink: 0,
                                  color: l.kind === 'tool' ? 'var(--accent)' :
                                         l.kind === 'accept' ? 'var(--jdm-green)' :
                                         l.kind === 'reject' ? 'var(--jdm-magenta)' :
                                         l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                                  minWidth: 56,
                                }}>{l.tag}</span>
                                <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : narrationHTML ? (
                  // Vue Narration : markdown + HTML <jdm-narration> inline
                  // rendus par marked.js (la trace d'outils reste structurée,
                  // les **gras** / `code` / listes se rendent correctement).
                  <div className="jdm-prose"
                       dangerouslySetInnerHTML={{ __html: renderMarkdownJarvis(narrationHTML) }} />
                ) : (
                  // Fallback : entrées tag/temps des events headline/file/etc.
                  log.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                      <span style={{
                        flexShrink: 0, minWidth: 64,
                        color: l.kind === 'accept' ? 'var(--jdm-green)'
                              : l.kind === 'reject' ? 'var(--jdm-magenta)'
                              : l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                      }}>{l.tag}</span>
                      <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Triplets consolidés = liste qui croît avec le fichier en
                construction. Bouton "Télécharger" en haut à droite pour
                récupérer le fichier brut. */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {panelTitleFor(flow.id)} · <span style={{ color: 'var(--jdm-green)' }}>{metrics.produced}</span>
                  {filePath && (
                    <span style={{ color: 'var(--ink-2)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                      · {filePath.split(/[\\/]/).slice(-1)[0]}
                    </span>
                  )}
                </div>
                {/* Télécharger le fichier brut — appelle l'API
                    /api/productions/download avec le basename. */}
                {filePath && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Bouton « 📤 Soumettre à JDM » post-hoc. Disponible
                        uniquement pour les flows qui produisent un fichier
                        soumissible (.enrich/.audit/.err/.stat/.annot) ET
                        si la clé LLMDrops est saisie (sinon disabled +
                        tooltip explicatif). Appelle /api/productions/submit
                        avec le basename + api_key + model_name pour
                        renommer correctement côté serveur. */}
                    {SUBMITTABLE_FLOWS.has(flow.id) && (
                      <Button size="sm" variant="ghost"
                        // Disabled UNIQUEMENT si pas de clé OU upload en cours.
                        // Si le flow tourne encore mais qu'on a la clé, on
                        // laisse cliquer (avec grisage visuel + confirm).
                        disabled={!_canSubmit || submitState === 'sending'}
                        style={state === 'running' && _canSubmit
                          ? { opacity: 0.55 }
                          : undefined}
                        title={!_canSubmit
                          ? 'Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer la soumission'
                          : state === 'running'
                            ? 'Soumission anticipée — le flow tourne encore (clic pour confirmer)'
                            : (params.drops_key
                              ? 'Soumettre ce fichier au LLMDrops JDM (clé saisie)'
                              : 'Soumettre ce fichier au LLMDrops JDM (clé serveur)')}
                        onClick={async () => {
                          // Confirmation si le flow tourne encore — soumettre
                          // un fichier incomplet est légitime mais inhabituel.
                          if (state === 'running') {
                            const ok = window.confirm(
                              'Le flow n\'est pas encore terminé — le fichier .' +
                              (flow.id === 'enrich' ? 'enrich' : flow.id === 'audit' ? 'audit'
                                : flow.id === 'signalement' ? 'err' : flow.id === 'stats' ? 'stat'
                                : flow.id === 'annotation' ? 'annot' : 'txt') +
                              ' contient seulement les triplets produits jusqu\'à maintenant. ' +
                              '\n\nSoumettre maintenant quand même ?'
                            );
                            if (!ok) return;
                          }
                          const name = filePath.split(/[\\/]/).slice(-1)[0];
                          setSubmitState('sending');
                          setSubmitMsg('');
                          try {
                            const r = await fetch('api/productions/submit', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                names: [name],
                                archived: false,
                                api_key: params.drops_key || '',
                                model_name: params.model || '',
                              }),
                            });
                            const data = await r.json();
                            const res = (data.results || [])[0] || {};
                            if (res.ok) {
                              setSubmitState('done');
                              setSubmitMsg(`✓ uploadé sous ${res.uploaded_as || name} (HTTP ${res.status_code || '?'})`);
                              // Persiste dans le store pour que la card
                              // Supervision affiche le statut "SOUMIS"
                              // après unmount + sticky entre runs.
                              try { JarvisStore.patch(flow.id, { submitted: true }); } catch {}
                            } else {
                              setSubmitState('error');
                              setSubmitMsg(`✗ ${res.error || 'échec inconnu'}`);
                            }
                          } catch (e) {
                            setSubmitState('error');
                            setSubmitMsg(`✗ ${e.message || e}`);
                          }
                          // Auto-clear le message après 8s pour ne pas
                          // bloquer l'UI si l'user veut retenter.
                          setTimeout(() => {
                            setSubmitState('idle'); setSubmitMsg('');
                          }, 8000);
                        }}>
                        {submitState === 'sending' ? '⏳ Envoi…' : '📤 Soumettre'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => {
                        const name = filePath.split(/[\\/]/).slice(-1)[0];
                        const url = `api/productions/download?name=${encodeURIComponent(name)}`;
                        const a = document.createElement('a');
                        a.href = url; a.download = name;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}>
                      ⬇ Télécharger
                    </Button>
                  </div>
                )}
              </div>
              {/* Toast discret du verdict de soumission post-hoc.
                  Vert si succès, rose si erreur. Apparaît ~8s. */}
              {submitMsg && (
                <div className="fade-up" style={{
                  padding: '6px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: submitState === 'error' ? 'var(--jdm-magenta)' : 'var(--jdm-green)',
                  borderBottom: '1px solid var(--line-soft)',
                  background: 'var(--bg-elev)',
                }}>{submitMsg}</div>
              )}
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 0,
                background: 'var(--bg-card)',
              }}>
              {(() => {
                  // Enrich : source registry (`accepted`) — déjà au format
                  // ItemCard (cf. mapping SSE plus haut qui pose
                  // type='consolidated' + explanation).
                  // Registry de consolidation si dispo, SINON parse du fichier
                  // produit (format jdm) — pour les agents sur mesure qui
                  // écrivent sans passer par le registry de consolidation.
                  const toShow = (flow.consolidates && accepted.length) ? accepted : parsed.items;
                  if (toShow.length === 0) {
                    return (
                      <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                        {state === 'idle'
                          ? 'Le panneau se remplira au fur et à mesure que le fichier est écrit.'
                          : 'En attente des premiers résultats…'}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                      {toShow.map((it, i) => (
                        <ItemCard key={i} item={it} accent={flow.accent} />
                      ))}
                    </div>
                  );
              })()}
              </div>
            </Card>
          </div>

        </div>
      </div>

      {/* Rail discret d'acces rapide aux 10 premiers flux (running d'abord).
          Permet de switcher entre runs depuis la vue de run sans repasser
          par le carrousel sommaire. Styling subtil — bg-elev, separateurs
          fins, pulse-dot sur le flux courant et les flux en cours. */}
      <JarvisRunRail flow={flow}
        onPick={(id) => {
          // Si on est deja sur ce flow, no-op ; sinon switch en passant par
          // window.__jdmRoute pour preserver l'historique.
          if (id === flow.id) return;
          if (typeof window !== 'undefined' && window.__jdmRoute) {
            window.__jdmRoute.push('jarvis', id);
          }
          // Force le ViewJarvis a re-evaluer son state running depuis l'URL.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('jdm-jarvis-switch-run', { detail: { agent_id: id } }));
          }
        }}
      />
    </PageShell>
  );
}

// Rail bas de page — 10 premiers flux du catalogue, ordonnes : en cours
// d'abord (avec pulse-dot d'accent), puis au repos. Le flux courant a un
// outline et une pastille « actuel ». Styling aligne sur le design
// (mono font, var(--bg-elev), bordures fines).
function JarvisRunRail({ flow, onPick }) {
  const activeSet = useJarvisActiveSet();
  const ordered = JARVIS_AGENTS.slice(0, 10).slice().sort((a, b) => {
    const aRun = activeSet.has(a.id) ? 0 : 1;
    const bRun = activeSet.has(b.id) ? 0 : 1;
    if (aRun !== bRun) return aRun - bRun;
    return JARVIS_AGENTS.findIndex(f => f.id === a.id) - JARVIS_AGENTS.findIndex(f => f.id === b.id);
  });
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 5,
      marginTop: 18,
      borderTop: '1px solid var(--line-soft)',
      background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        overflowX: 'auto', whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
      }} className="jpanel-scroll">
        <span className="mono" style={{
          flexShrink: 0, fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginRight: 4,
        }}>Agents</span>
        {ordered.map(f => {
          const isCurrent = f.id === flow.id;
          const isActive = activeSet.has(f.id);
          return (
            <button key={f.id} type="button" onClick={() => onPick(f.id)}
              title={`${f.title}${isActive ? ' · en cours' : ''}`}
              className="focus-ring"
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 11px',
                background: isCurrent ? `color-mix(in srgb, ${f.accent} 12%, var(--bg-card))` : 'var(--bg-card)',
                border: '1px solid ' + (isCurrent ? `color-mix(in srgb, ${f.accent} 55%, transparent)` : 'var(--line-soft)'),
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: isCurrent ? f.accent : 'var(--ink-2)',
                transition: 'background .15s, border-color .15s, color .15s',
              }}>
              {isActive && (
                <span className="pulse-dot" style={{ background: f.accent, width: 6, height: 6 }} />
              )}
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: f.accent, opacity: isActive ? 0 : 0.55,
                display: isActive ? 'none' : 'inline-block',
              }} />
              <span style={{ color: 'inherit' }}>{f.title}</span>
              {isCurrent && (
                <span className="mono" style={{
                  fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                  background: f.accent, color: 'var(--bg)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>actuel</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}




// ───── Status badge ─────
function StatusBadge({ state, accent }) {
  const STYLES = {
    idle:      { label: 'En attente', color: 'var(--ink-3)',       dot: false },
    running:   { label: 'En cours',   color: accent,               dot: true  },
    submitted: { label: 'Soumis',     color: 'var(--jdm-green)',   dot: false },
    done:      { label: 'Terminé',    color: 'var(--jdm-green)',   dot: false },
    paused:    { label: 'En pause',   color: 'var(--jdm-orange)',  dot: false },
    error:     { label: 'Erreur',     color: 'var(--jdm-magenta)', dot: false },
    cancelled: { label: 'Annulé',     color: 'var(--ink-3)',       dot: false },
    aborted:   { label: 'Interrompu', color: 'var(--ink-3)',       dot: false },
  };
  // Fallback : si un nouveau statut backend arrive sans entrée dans STYLES,
  // on retombe sur 'idle' pour ne JAMAIS crasher le render (vu en prod
  // quand une erreur Google API mettait state='error', non couvert → null
  // → styles.color crash).
  const styles = STYLES[state] || STYLES.idle;
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
// ───── Simulated step — fake but realistic ─────
window.ViewJarvis = ViewJarvis;

// === webapp/views-productions.jsx ===
// View: Productions — fichiers .enrich / .audit / .err / .stat /
// visualisations produits par les agents Jarvis. Liste + download +
// soumission LLMDrops + suppression (admin).

function ViewProductions() {
  const [recent, setRecent] = useState([]);
  const [oldies, setOldies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecent, setSelectedRecent] = useState(new Set());
  const [selectedOldies, setSelectedOldies] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [previewName, setPreviewName] = useState(null);
  const [previewArchived, setPreviewArchived] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [actionLog, setActionLog] = useState([]);
  // Bandeau Drops + modèle (pour soumissions)
  const [dropsKey, setDropsKey] = useState('');
  // Pré-rempli avec le modèle de la configuration Jarvis courante
  // (window.__JDM_JARVIS_CONFIG__.llm) — l'utilisateur peut toujours l'éditer.
  const [modelName, setModelName] = useState(() => {
    try {
      const cfg = (typeof window !== 'undefined' && window.__JDM_JARVIS_CONFIG__) || {};
      return cfg.llm || 'gemini-3.1-flash-lite';
    } catch (e) { return 'gemini-3.1-flash-lite'; }
  });
  // Env-aware : si JDM_DROPS_API_KEY est posée côté serveur, le bouton
  // Soumettre est dégrisé même quand l'input est vide. La clé saisie
  // override toujours l'env (sinon impossible de tester avec une autre).
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!dropsKey || _envHasDrops;

  const isAdmin = typeof window !== 'undefined' && window.__JDM_ADMIN__;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('api/productions');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRecent(d.recent || []);
      setOldies(d.oldies || []);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => { load(); }, []);

  const openPreview = async (name, archived) => {
    setPreviewName(name);
    setPreviewArchived(archived);
    setPreviewContent('… chargement …');
    try {
      const r = await fetch(`api/productions/file?name=${encodeURIComponent(name)}&archived=${archived ? 1 : 0}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPreviewContent(d.content || '(vide)');
    } catch (e) {
      setPreviewContent(`Erreur : ${e && e.message ? e.message : e}`);
    }
  };

  const downloadOne = (name, archived) => {
    const url = `api/productions/download?name=${encodeURIComponent(name)}&archived=${archived ? 1 : 0}`;
    // Force download via <a download>
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const toggle = (set, setSet) => (name) => {
    const next = new Set(set);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSet(next);
  };

  const submitSelected = async (archived) => {
    const selected = archived ? selectedOldies : selectedRecent;
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const r = await fetch('api/productions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: Array.from(selected),
          archived,
          api_key: dropsKey,
          model_name: modelName,
        }),
      });
      const d = await r.json();
      const results = d.results || [];
      const ok = results.filter(x => x.ok).length;
      const ko = results.length - ok;
      setActionLog(prev => [...prev,
        ...results.map(x => ({
          t: new Date().toTimeString().slice(0, 8),
          ok: !!x.ok, name: x.name,
          msg: x.ok ? `Soumis · uploaded_as=${x.uploaded_as || ''}` : (x.error || 'échec'),
        })),
      ]);
      if (ok) {
        // Clear selection des items réussis et recharge la liste pour
        // que .submitted réapparaisse en ✅ vert.
        const remaining = new Set();
        results.forEach(x => { if (!x.ok) remaining.add(x.name); });
        if (archived) setSelectedOldies(remaining); else setSelectedRecent(remaining);
        await load();
      }
    } catch (e) {
      setActionLog(prev => [...prev, {
        t: new Date().toTimeString().slice(0, 8),
        ok: false, name: '?', msg: String(e),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async (archived) => {
    const selected = archived ? selectedOldies : selectedRecent;
    if (selected.size === 0) return;
    if (!confirm(`Supprimer ${selected.size} fichier(s) ?`)) return;
    setBusy(true);
    try {
      const r = await fetch('api/productions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: Array.from(selected),
          archived,
        }),
      });
      const d = await r.json();
      setActionLog(prev => [...prev,
        ...(d.results || []).map(x => ({
          t: new Date().toTimeString().slice(0, 8),
          ok: !!x.ok, name: x.name,
          msg: x.ok ? 'Supprimé' : (x.error || 'échec'),
        })),
      ]);
      if (archived) setSelectedOldies(new Set()); else setSelectedRecent(new Set());
      await load();
    } catch (e) {
      setActionLog(prev => [...prev, {
        t: new Date().toTimeString().slice(0, 8),
        ok: false, name: '?', msg: String(e),
      }]);
    } finally {
      setBusy(false);
    }
  };

  // Compteur soumissions — agrège récents + oldies. La marque ✅ vient
  // du flag `submitted` côté backend (cf. ProductionFileCard ligne 395),
  // donc le compte ici est cohérent avec le badge sur chaque carte.
  const _submittedCount = recent.filter(f => f.submitted).length
                        + oldies.filter(f => f.submitted).length;
  const _totalCount = recent.length + oldies.length;

  return (
    <PageShell>
      <SectionTitle
        kicker="Sorties Jarvis"
        title="Productions"
        desc="Fichiers .enrich / .audit / .err / .stat / visualisations produits par les agents Jarvis. Liste, prévisualisation, téléchargement, soumission LLMDrops."
        right={
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: _submittedCount > 0
              ? 'rgba(78,166,60,0.10)'
              : 'var(--bg-elev)',
            border: '1px solid ' + (_submittedCount > 0
              ? 'rgba(78,166,60,0.40)'
              : 'var(--line-soft)'),
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: _submittedCount > 0 ? 'var(--jdm-green)' : 'var(--ink-2)',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}>
            {_submittedCount > 0 && <span aria-hidden="true">✅</span>}
            <span>
              <strong style={{ fontWeight: 600 }}>{_submittedCount}</strong>
              {' / '}
              <span style={{ color: 'var(--ink-3)' }}>{_totalCount}</span>
              {' '}
              production{_totalCount > 1 ? 's' : ''} soumise{_submittedCount > 1 ? 's' : ''}
            </span>
          </div>
        }
      />

      {/* Bandeau actions */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <Field label={
            _envHasDrops
              ? 'Clé LLMDrops (override .env)'
              : 'Clé LLMDrops'
          }>
            <Input type="password"
              value={dropsKey} onChange={setDropsKey}
              placeholder={_envHasDrops ? '— configurée côté serveur —' : 'vide = pas de clé'} mono />
          </Field>
          <Field label="Nom modèle (filename uploadé)">
            <Input value={modelName} onChange={setModelName} placeholder="claude-sonnet" mono />
          </Field>
          <Button variant="ghost" onClick={load} disabled={loading || busy}>
            ↻ Rafraîchir
          </Button>
        </div>
      </Card>

      {error && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: 'rgba(200,58,115,0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* Récents */}
      <ProductionsSection
        title={`Récents · ${recent.length}`}
        files={recent} archived={false}
        selected={selectedRecent} setSelected={setSelectedRecent}
        onToggle={toggle(selectedRecent, setSelectedRecent)}
        onPreview={openPreview}
        onDownload={downloadOne}
        onSubmit={() => submitSelected(false)}
        onDelete={() => deleteSelected(false)}
        canSubmit={_canSubmit}
        busy={busy} isAdmin={isAdmin}
      />

      {/* Oldies (archives > 48h) — section pliable */}
      {oldies.length > 0 && (
        <details style={{ marginTop: 28 }}>
          <summary style={{
            cursor: 'pointer',
            padding: '12px 14px',
            background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'baseline', gap: 10,
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            color: 'var(--ink-2)',
            listStyle: 'none',
          }}>
            <span style={{
              fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>▸ Archives oldies</span>
            <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-3)' }}>
              · {oldies.length} fichier{oldies.length > 1 ? 's' : ''} de plus de 48h
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <ProductionsSection
              title=""  /* le titre est déjà dans le summary */
              files={oldies} archived={true}
              selected={selectedOldies} setSelected={setSelectedOldies}
              onToggle={toggle(selectedOldies, setSelectedOldies)}
              canSubmit={_canSubmit}
              onPreview={openPreview}
              onDownload={downloadOne}
              onSubmit={() => submitSelected(true)}
              onDelete={() => deleteSelected(true)}
              busy={busy} isAdmin={isAdmin}
            />
          </div>
        </details>
      )}

      {/* Log d'actions */}
      {actionLog.length > 0 && (
        <Card padding={0} style={{ marginTop: 28, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg-elev)',
            borderBottom: '1px solid var(--line-soft)',
          }}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>Log d'actions · {actionLog.length}</div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {actionLog.slice().reverse().map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--ink-3)' }}>{l.t}</span>
                <span style={{ color: l.ok ? 'var(--jdm-green)' : 'var(--jdm-magenta)', minWidth: 12 }}>{l.ok ? '✓' : '✗'}</span>
                <span style={{ color: 'var(--ink)' }}>{l.name}</span>
                <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>—</span>
                <span style={{ color: 'var(--ink-2)' }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal preview */}
      {previewName && (
        <div onClick={() => setPreviewName(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: 920, width: '100%',
            maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--line-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
                {previewArchived ? 'oldies/' : ''}{previewName}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="secondary" onClick={() => downloadOne(previewName, previewArchived)}>
                  Télécharger
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewName(null)}>×</Button>
              </div>
            </div>
            {/* Si c'est un .html, on le rend dans un iframe (vis-network
                interactif, etc.) au lieu d'afficher le source brut. */}
            {previewName && previewName.toLowerCase().endsWith('.html') ? (
              <iframe
                title={previewName}
                srcDoc={previewContent}
                sandbox="allow-scripts allow-same-origin"
                style={{
                  flex: 1, width: '100%', border: 0, minHeight: 500,
                  background: 'var(--bg)',
                }}
              />
            ) : (
              <pre style={{
                margin: 0, padding: 18, overflow: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
                color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                flex: 1,
              }}>{previewContent}</pre>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function ProductionsSection({ title, files, archived, selected, setSelected,
                              onToggle, onPreview, onDownload, onSubmit,
                              onDelete, canSubmit = true, busy, isAdmin }) {
  // Select-all : si tous sont sélectionnés → clear, sinon → tout sélectionner.
  // Tri-état visuel : empty / indeterminate / checked.
  const allSelected = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => {
    if (!setSelected) return;
    setSelected(allSelected ? new Set() : new Set(files.map(f => f.name)));
  };
  // Pour l'état indeterminate, React n'a pas de prop checked='indeterminate'
  // → on pose via ref + useEffect.
  const allCbRef = useRef(null);
  React.useEffect(() => {
    if (allCbRef.current) allCbRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10,
        // paddingLeft = padding gauche d'une ProductionsRow (10px 14px) →
        // la checkbox « tout » s'aligne pile sur la colonne des checkboxes
        // individuelles de chaque ligne en dessous.
        paddingLeft: 14,
      }}>
        {/* Select-all subtile : checkbox + petit label "tout", devant le titre.
            Caché si pas de fichiers (rien à sélectionner). */}
        {files.length > 0 && setSelected && (
          <label
            title={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-3)',
              userSelect: 'none',
            }}>
            <input ref={allCbRef} type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{
                accentColor: 'var(--accent)',
                margin: 0,
                cursor: 'pointer',
              }} />
            <span>tout</span>
          </label>
        )}
        {title && (
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600, margin: 0,
          }}>{title}</h2>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Button size="sm" onClick={onSubmit}
            disabled={busy || selected.size === 0 || !canSubmit}
            title={!canSubmit
              ? 'Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer la soumission'
              : 'Soumettre les fichiers sélectionnés au LLMDrops JDM'}>
            📤 Soumettre {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
          <span className="admin-only">
            <Button size="sm" variant="ghost" onClick={onDelete}
              disabled={busy || selected.size === 0}>
              🗑 Supprimer {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </span>
        </div>
      </div>

      {files.length === 0 ? (
        <div style={{
          padding: 24, textAlign: 'center',
          color: 'var(--ink-3)', fontSize: 13,
          background: 'var(--bg-elev)',
          border: '1px dashed var(--line)',
          borderRadius: 'var(--radius-lg)',
        }}>
          Aucun fichier {archived ? 'archivé' : 'récent'}.
        </div>
      ) : (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {files.map((f, i) => (
            <ProductionsRow
              key={f.name + i}
              file={f} archived={archived}
              selected={selected.has(f.name)}
              onToggle={() => onToggle(f.name)}
              onPreview={() => onPreview(f.name, archived)}
              onDownload={() => onDownload(f.name, archived)}
              isLast={i === files.length - 1}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function ProductionsRow({ file, archived, selected, onToggle, onPreview, onDownload, isLast }) {
  const sizeKB = (file.size / 1024).toFixed(1);
  const age = formatAge(file.age_s);
  // Couleur par type (badge ET teinte de la ligne, très douce).
  const extColors = {
    'enrich':  { fg: 'var(--jdm-magenta)', tint: 'rgba(200, 58, 115, 0.04)' },
    'audit':   { fg: 'var(--jdm-cyan)',    tint: 'rgba(31, 151, 177, 0.04)' },
    'err':     { fg: 'var(--jdm-orange)',  tint: 'rgba(217, 104, 16, 0.04)' },
    'stat':    { fg: 'var(--jdm-violet)',  tint: 'rgba(122, 79, 190, 0.04)' },
    'html':    { fg: 'var(--jdm-green)',   tint: 'rgba(78, 166, 60, 0.04)' },
  };
  const { fg: extColor, tint: extTint } = extColors[file.ext] || { fg: 'var(--ink-3)', tint: 'transparent' };
  // Si déjà soumis, le vert prend le pas sur la teinte par type.
  const bg = file.submitted ? 'rgba(78,166,60,0.10)' : extTint;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--line-soft)',
      background: bg,
    }}>
      <input type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ accentColor: 'var(--accent)', flexShrink: 0 }} />
      {file.submitted && <span style={{ color: 'var(--jdm-green)' }}>✅</span>}
      <span className="mono" style={{
        padding: '2px 6px', borderRadius: 3,
        background: 'var(--bg-elev)',
        color: extColor, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>{file.ext}</span>
      {/* Cliquer sur le nom = toggle selection. cursor pointer + léger
          hover underline pour l'affordance. Empêche d'avoir à viser la
          petite checkbox quand on parcourt rapidement la liste. */}
      <span
        className="mono"
        onClick={onToggle}
        title={selected ? 'Désélectionner' : 'Sélectionner'}
        style={{
          flex: 1, minWidth: 0,
          fontSize: 13, color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
      >{file.name}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
        {sizeKB}KB · {age}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Button size="sm" variant="ghost" onClick={onPreview}>👁 Aperçu</Button>
        <Button size="sm" variant="ghost" onClick={onDownload}>⬇ DL</Button>
      </div>
    </div>
  );
}

function formatAge(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

window.ViewProductions = ViewProductions;

// === webapp/views-aide.jsx ===
// View: Aide — refonte visuelle "plus jolie".
// Sticky TOC à gauche, contenu structuré à droite, blocs colorés, icônes.
// Tous les textes canoniques sont préservés.

const AIDE_SECTIONS = [
  { id: 'tour',    num: '01', label: 'Tour des onglets' },
  { id: 'jarvis',  num: '02', label: 'Jarvis en détail' },
  { id: 'install', num: '03', label: 'Installation locale' },
  { id: 'mcp',     num: '04', label: 'Serveur MCP' },
  { id: 'keys',    num: '05', label: 'Clés API' },
  { id: 'kbd',     num: '06', label: 'Raccourcis' },
  { id: 'format',  num: '07', label: 'Formats de fichiers' },
];

const TABS_TABLE = [
  { icon: '📋', name: 'Projet',        what: 'Présentation, liens code source.',                                 key: 'Aucune' },
  { icon: '🔎', name: 'Explorer JDM',  what: 'Table de triplets pour un terme/relation. Déterministe.',          key: 'Aucune' },
  { icon: '⚖️', name: 'Claim checker', what: 'SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet. Déterministe.', key: 'Aucune' },
  { icon: '🕸️', name: 'Sous-graphe',   what: 'Visualisation vis-network interactive du voisinage.',              key: 'Aucune' },
  { icon: '🤖', name: 'Agent',         what: 'Chat libre avec un agent LLM qui utilise les outils JDM.',         key: 'Gemini gratuit · BYOK Claude/GPT' },
  { icon: '🦾', name: 'Jarvis',        what: 'Agents guidés par formulaires (5 sous-onglets).',                    key: 'Gemini · LLMDrops si soumission' },
  { icon: '🛠️', name: 'Aide',          what: 'Ce document.',                                                      key: '—' },
];

const JARVIS_AGENTS_HELP = [
  { id: 'enrich',      icon: '🌱', accent: 'var(--jdm-green)',   name: 'Enrichissement', wf: 'enrichment_workflow()',
    desc: 'Propose et consolide de nouveaux triplets pour un terme. Form : terme, relation cible (optionnelle), nombre cible, varier les relations, itérer jusqu\'au but, soumettre. Output : chatbot + fichier .enrich.' },
  { id: 'audit',       icon: '🔍', accent: 'var(--jdm-cyan)',    name: 'Audit',          wf: 'audit_workflow()',
    desc: 'Audit sémantique de la répartition des sens d\'un terme polysémique. Verdict par triplet (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative. Fichier .audit.' },
  { id: 'gap',         icon: '🕳️', accent: 'var(--jdm-violet)',  name: 'Détection de trous', wf: 'gap_detection_workflow()',
    desc: 'Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE). Tableau déterministe + synthèse narrative. Routage vers Enrich / Audit / Stats.' },
  { id: 'signalement', icon: '⚠️', accent: 'var(--jdm-magenta)', name: 'Signalement',    wf: 'signalement_workflow()',
    desc: 'Le LLM utilise son jugement linguistique pour flagger les triplets suspects (pas besoin de preuve d\'outil). Fichier .err avec catégorie de suspicion et justification.' },
  { id: 'stats',       icon: '📊', accent: 'var(--jdm-yellow)',  name: 'Stats',          wf: 'stats_workflow()',
    desc: 'Statistiques de couverture par terme et/ou par relation : n_total, n_pos, n_neg, max_w, min_w, mean_w par relation + 3-5 observations clés en prose.' },
];

const API_KEYS_TABLE = [
  { name: 'Gemini',          where: 'aistudio.google.com/apikey',     cost: 'Gratuit (500 req/jour, 3.1 Flash Lite)', when: 'Pré-configurée côté serveur',
    url: 'https://aistudio.google.com/apikey', tone: 'free' },
  { name: 'LLMDrops JDM',    where: 'jeuxdemots.org (contact M. Lafourcade)', cost: 'Gratuit sur demande', when: 'Pousser .enrich / .audit / .err',
    url: 'https://www.jeuxdemots.org', tone: 'free' },
  { name: 'Anthropic (Claude)', where: 'console.anthropic.com',       cost: 'Payant ($)',                              when: 'BYOK Claude dans Agent / Jarvis',
    url: 'https://console.anthropic.com', tone: 'paid' },
  { name: 'OpenAI (GPT)',    where: 'platform.openai.com',            cost: 'Payant ($)',                              when: 'BYOK GPT dans Agent / Jarvis',
    url: 'https://platform.openai.com/api-keys', tone: 'paid' },
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

// ── Code block stylisé avec header type "terminal" ───────────────────
function CodeBlock({ label, language, children }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--line)',
      background: 'var(--bg-card)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f56','#ffbd2e','#27c93f'].map((c, i) => (
            <span key={i} style={{
              width: 9, height: 9, borderRadius: '50%',
              background: c, opacity: 0.55,
            }}/>
          ))}
        </div>
        <span style={{ marginLeft: 4 }}>{label}</span>
        {language && (
          <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>{language}</span>
        )}
      </div>
      <pre style={{
        margin: 0, padding: '16px 18px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12, lineHeight: 1.65,
        color: 'var(--ink)',
        overflowX: 'auto', whiteSpace: 'pre',
      }}>{children}</pre>
    </div>
  );
}

// ── Header de section : numéro accent + titre serif + ligne ──────────
function AideSectionHeader({ num, title, kicker }) {
  return (
    <div id={`aide-${num}`} style={{
      marginBottom: 20,
      paddingTop: 8,
      scrollMarginTop: 80,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14,
        marginBottom: kicker ? 8 : 0,
      }}>
        <span className="mono" style={{
          fontSize: 12, color: 'var(--accent)',
          fontWeight: 700, letterSpacing: '0.08em',
        }}>{num}</span>
        <h2 className="display" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26, fontWeight: 600,
          letterSpacing: '-0.015em',
          margin: 0, color: 'var(--ink)',
        }}>{title}</h2>
        <div style={{
          flex: 1, height: 1,
          background: 'linear-gradient(to right, var(--line) 0%, transparent 100%)',
          marginLeft: 6,
        }}/>
      </div>
      {kicker && (
        <p style={{
          margin: 0, marginLeft: 38,
          fontSize: 13, color: 'var(--ink-2)',
          lineHeight: 1.55, maxWidth: '64ch',
        }}>{kicker}</p>
      )}
    </div>
  );
}

// ── Table des matières sticky (left rail) ────────────────────────────
function AideTOC() {
  const [active, setActive] = useState('tour');
  useEffect(() => {
    const onScroll = () => {
      // Trouve la section dont le top est le plus proche du viewport
      let best = 'tour', bestDist = Infinity;
      AIDE_SECTIONS.forEach(s => {
        const el = document.getElementById(`aide-${s.num}`);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const dist = Math.abs(top - 100);
        if (top < 200 && dist < bestDist) {
          bestDist = dist; best = s.id;
        }
      });
      setActive(best);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (s) => {
    const el = document.getElementById(`aide-${s.num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Table des matières" style={{
      position: 'sticky', top: 80,
      display: 'flex', flexDirection: 'column', gap: 2,
      paddingLeft: 14,
      borderLeft: '1px solid var(--line-soft)',
    }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.14em',
        marginBottom: 10, fontWeight: 600,
      }}>Sommaire</div>
      {AIDE_SECTIONS.map(s => {
        const on = active === s.id;
        return (
          <button key={s.id}
            type="button"
            onClick={() => go(s)}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: on ? 'var(--accent)' : 'var(--ink-2)',
              transition: 'color 0.18s',
              position: 'relative',
            }}>
            {on && (
              <span style={{
                position: 'absolute',
                left: -15, top: '50%',
                transform: 'translateY(-50%)',
                width: 2, height: 16,
                background: 'var(--accent)',
              }}/>
            )}
            <span className="mono" style={{
              fontSize: 10, opacity: 0.7,
              minWidth: 18,
            }}>{s.num}</span>
            <span style={{
              fontSize: 13,
              fontWeight: on ? 600 : 400,
            }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ViewAide() {
  return (
    <PageShell>
      {/* HERO bloc compact : intro + chips de raccourcis vers sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 28,
        alignItems: 'center',
        padding: '24px 28px',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 40,
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 30, color: 'var(--bg)' }}>?</span>
        </div>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.18em',
            marginBottom: 6,
          }}>Documentation</div>
          <h1 className="display" style={{
            fontFamily: 'var(--font-display)',
            margin: 0,
            fontSize: 30, fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}>Aide &amp; Installation</h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: 14,
            color: 'var(--ink-2)',
            lineHeight: 1.55,
            maxWidth: '70ch',
          }}>
            Naviguer la démo, installer en local, brancher le MCP, comprendre
            les formats de soumission JDM. Sommaire à gauche, contenu à droite.
          </p>
        </div>
      </div>

      {/* Layout 2 colonnes : TOC sticky | contenu */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 40,
        alignItems: 'start',
      }}>
        <AideTOC />

        <div style={{ minWidth: 0 }}>
          {/* 01 — Tour des onglets */}
          <AideSectionHeader num="01" title="Tour des onglets"
            kicker="7 onglets, chacun avec sa fonction. Cartes ci-dessous : ce que fait l'onglet et quelle clé API il consomme." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10, marginBottom: 48,
          }}>
            {TABS_TABLE.map((t) => (
              <div key={t.name} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: 14,
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{t.name}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 8 }}>
                  {t.what}
                </div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Clé : <span style={{ color: 'var(--accent)' }}>{t.key}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 02 — Jarvis */}
          <AideSectionHeader num="02" title="Jarvis en détail"
            kicker="5 flows guidés. Tous partagent un bandeau (clé LLMDrops, modèle, budget d'appels d'outils 10 / 25 / 50 / 100 / illimité)." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12, marginBottom: 48,
          }}>
            {JARVIS_AGENTS_HELP.map(f => (
              <div key={f.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${f.accent}`,
                borderRadius: 'var(--radius-lg)',
                padding: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{f.icon}</span>
                  <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{f.name}</strong>
                  <code className="mono" style={{
                    marginLeft: 'auto',
                    background: 'var(--bg-elev)',
                    padding: '3px 8px', borderRadius: 4,
                    fontSize: 10, color: f.accent, fontWeight: 600,
                  }}>{f.wf}</code>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* 03 — Installation */}
          <AideSectionHeader num="03" title="Installation locale"
            kicker="Sur Debian 12 / Ubuntu 24.04 (PEP 668), le venv est obligatoire — pip refuse hors venv." />
          <CodeBlock label="install.sh" language="bash">{INSTALL_SCRIPT}</CodeBlock>
          <div style={{
            fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6,
            padding: '12px 16px',
            background: 'var(--bg-elev)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '0 var(--radius) var(--radius) 0',
            marginBottom: 48,
          }}>
            <strong style={{ color: 'var(--ink)' }}>Reverse-proxy</strong> — pour servir sur un sous-chemin (<code className="mono">/Jarvis/</code> par ex.),
            mets <code className="mono">APP_SUBPATH=/Jarvis</code> dans <code className="mono">.env</code>. Le frontend injecte <code className="mono">&lt;base href&gt;</code> automatiquement et les fetch API se résolvent.
          </div>

          {/* 04 — MCP */}
          <AideSectionHeader num="04" title="Serveur MCP"
            kicker="Expose les outils JDM dans Claude Code / Cursor / tout client MCP-compatible." />
          <CodeBlock label="claude-code" language="bash">{MCP_SCRIPT}</CodeBlock>
          <p style={{
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6,
            margin: '0 0 48px',
          }}>
            Ensuite depuis Claude Code : <em>« Donne-moi les synonymes de voiture dans JDM »</em> → l'agent appelle automatiquement les outils MCP exposés.
          </p>

          {/* 05 — Clés API */}
          <AideSectionHeader num="05" title="Clés API"
            kicker="Quatre fournisseurs possibles, deux gratuits et deux payants." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 10, marginBottom: 12,
          }}>
            {API_KEYS_TABLE.map(k => (
              <a key={k.name} href={k.url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: 16,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'transform 0.18s, border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = k.tone === 'free' ? 'var(--jdm-green)' : 'var(--jdm-yellow)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px -10px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{k.name}</strong>
                  <Pill color={k.tone === 'free' ? 'var(--jdm-green)' : 'var(--jdm-yellow)'} tone="outline">
                    {k.tone === 'free' ? 'Gratuit' : 'Payant'}
                  </Pill>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 8 }}>{k.where}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>{k.cost}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>{k.when}</div>
                <span style={{ position: 'absolute', bottom: 12, right: 14, color: 'var(--accent)', fontSize: 14 }}>↗</span>
              </a>
            ))}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--ink-3)',
            marginBottom: 48, lineHeight: 1.6,
            padding: '10px 14px',
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line)',
            borderRadius: 'var(--radius)',
          }}>
            ⚠ <strong style={{ color: 'var(--ink-2)' }}>Sécurité</strong> — les clés que tu colles dans l'UI ne sont
            <strong style={{ color: 'var(--ink)' }}> jamais persistées</strong> côté serveur — elles vivent uniquement le temps de ton onglet.
          </div>

          {/* 06 — Raccourcis */}
          <AideSectionHeader num="06" title="Raccourcis clavier" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 10, marginBottom: 48,
          }}>
            {SHORTCUTS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {s.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* 07 — Formats */}
          <AideSectionHeader num="07" title="Format des fichiers de soumission"
            kicker="Tous les fichiers produits par Jarvis suivent un format pipe." />
          <CodeBlock label="formats" language="pipe">{FORMAT_TEXT}</CodeBlock>
          <div style={{
            fontSize: 13, color: 'var(--ink-2)',
            marginBottom: 48, lineHeight: 1.6,
          }}>
            Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
            <ul style={{ marginTop: 8, paddingLeft: 22 }}>
              <li style={{ marginBottom: 4 }}>coche <strong style={{ color: 'var(--ink)' }}>Soumettre directement</strong> dans le formulaire (clé <code className="mono">JDM_DROPS_API_KEY</code> requise) ;</li>
              <li>ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.</li>
            </ul>
          </div>

          {/* Panneau admin — réservé ?admin=1 */}
          <div className="admin-only" style={{ marginBottom: 40 }}>
            <AideSectionHeader num="08" title="Panneau admin" />
            <AdminPanel />
          </div>

          {/* Footer institutionnel */}
          <div style={{
            padding: 28,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18,
          }}>
            <JDMMark size={36} />
            <div>
              <div className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
                marginBottom: 4,
              }}>jdmAgent</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                Mathieu Lafourcade ·{' '}
                <a href="https://www.lirmm.fr/" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}>LIRMM</a>{' '}
                (Université de Montpellier — CNRS) ·{' '}
                <a href="https://www.lirmm.fr/equipes/slice/" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}>Équipe SLICE</a>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ink-3)' }}>github.com/expAg/JDMAgent</a>
                {' · '}
                <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ink-3)' }}>USAGE.md</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Panneau admin (gate par mot de passe) — inchangé ─────────────────

function AdminPanel() {
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [allVars, setAllVars] = useState({});
  const [edits, setEdits] = useState({});
  const [editMsg, setEditMsg] = useState('');
  const [cacheMsg, setCacheMsg] = useState('');

  React.useEffect(() => {
    fetch('api/admin/info').then(r => r.json()).then(setInfo).catch(() => {});
  }, []);

  const auth = async () => {
    if (!password) { setAuthErr('Mot de passe requis.'); return; }
    setBusy(true); setAuthErr('');
    try {
      const r = await fetch('api/admin/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.status === 401) { setAuthErr('Mot de passe invalide.'); return; }
      if (r.status === 503) {
        setAuthErr('Admin désactivé : EXPORT_SECRETS_PASSWORD non défini côté serveur.');
        return;
      }
      if (!r.ok) { setAuthErr(`HTTP ${r.status}`); return; }
      setAuthed(true);
      const exp = await fetch('api/admin/export-secrets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (exp.ok) {
        const d = await exp.json();
        setAllVars(d.vars || {});
      }
    } catch (e) {
      setAuthErr(String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    setAuthed(false); setPassword(''); setAllVars({}); setEdits({});
    setEditMsg(''); setCacheMsg('');
  };

  const setOne = (k, v) => setEdits(e => ({ ...e, [k]: v }));

  const submitEdits = async () => {
    setEditMsg('');
    const vars = Object.fromEntries(Object.entries(edits).filter(([_, v]) => v !== undefined && v !== ''));
    if (Object.keys(vars).length === 0) { setEditMsg('Aucune modification à appliquer.'); return; }
    try {
      const r = await fetch('api/admin/env-set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, vars }),
      });
      const d = await r.json();
      if (r.ok) {
        setEditMsg(`✓ ${(d.updated || []).length} mise(s) à jour · .env persisté : ${d.persisted_to_dotenv ? 'oui' : 'non'}`);
        setAllVars(av => ({ ...av, ...vars }));
        setEdits({});
      } else {
        setEditMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setEditMsg(`✗ ${e && e.message ? e.message : e}`);
    }
  };

  const clearCache = async () => {
    setCacheMsg('');
    if (!confirm('Vider tout le cache disque JDM ? Les prochains appels iront refrapper l\'API.')) return;
    try {
      const r = await fetch('api/admin/cache-clear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (r.ok) {
        setCacheMsg(`✓ ${d.deleted_files} fichier(s) supprimé(s) dans ${d.cache_dir}`);
      } else {
        setCacheMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setCacheMsg(`✗ ${e && e.message ? e.message : e}`);
    }
  };

  const downloadEnv = () => {
    if (!allVars || Object.keys(allVars).length === 0) return;
    const lines = Object.entries(allVars).map(([k, v]) => `${k}=${v}`);
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '.env.export';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const EDITABLE_VARS = [
    'JDM_BASE_URL', 'JDM_TIMEOUT',
    'JDM_CACHE_DIR', 'JDM_CACHE_TTL_META', 'JDM_CACHE_TTL_DATA',
    'LLM_PROVIDER', 'LLM_MODEL', 'LLM_TEMPERATURE',
    'OLLAMA_BASE_URL',
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY',
    'DEEPSEEK_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_API_KEYS',
    'HF_TOKEN',
    'JDM_DROPS_API_KEY', 'JDM_DROPS_URL',
    'APP_SUBPATH',
  ];

  return (
    <Card padding={20} style={{ border: '1px dashed var(--jdm-magenta)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--jdm-magenta)',
          textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
        }}>Panneau admin</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          Réservé · activé via <code className="mono">?admin=1</code> dans l'URL.
        </div>
        {authed && (
          <Button size="sm" variant="ghost"
            style={{ marginLeft: 'auto' }}
            onClick={logout}>🔒 Verrouiller</Button>
        )}
      </div>

      {info && (
        <div style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: 14, marginBottom: 14,
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
        }}>
          <div>Python : <strong style={{ color: 'var(--ink)' }}>{info.python}</strong></div>
          <div>APP_SUBPATH : <strong style={{ color: 'var(--ink)' }}>{info.app_subpath || '(racine)'}</strong></div>
          <div>Pool Gemini : <strong style={{ color: 'var(--ink)' }}>{info.pool_size} clé(s)</strong></div>
          <div>Export secrets : <strong style={{ color: info.export_secrets_enabled ? 'var(--jdm-green)' : 'var(--jdm-magenta)' }}>
            {info.export_secrets_enabled ? 'activé' : 'désactivé (EXPORT_SECRETS_PASSWORD non défini)'}
          </strong></div>
          <div>Env vars présentes : <strong style={{ color: 'var(--ink)' }}>{(info.env_vars_present || []).length}</strong> / {EDITABLE_VARS.length}</div>
        </div>
      )}

      {!authed ? (
        <>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>Authentification requise</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <Input value={password} onChange={setPassword}
              placeholder="Mot de passe EXPORT_SECRETS_PASSWORD" mono />
            <Button size="sm" onClick={auth} disabled={busy || !password}>
              {busy ? '…' : 'Déverrouiller'}
            </Button>
          </div>
          {authErr && (
            <div style={{
              marginTop: 8, padding: 10,
              background: 'rgba(200,58,115,0.08)',
              border: '1px solid var(--jdm-magenta)',
              borderRadius: 'var(--radius)',
              color: 'var(--jdm-magenta)', fontSize: 12,
            }}>{authErr}</div>
          )}
        </>
      ) : (
        <>
          <div style={{
            marginBottom: 16, padding: 10,
            background: 'rgba(78,166,60,0.08)',
            border: '1px solid var(--jdm-green)',
            borderRadius: 'var(--radius)',
            color: 'var(--jdm-green)', fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}>✓ Mot de passe accepté — contrôles débloqués</div>

          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>1 · Variables d'environnement</div>
          <div style={{
            background: 'var(--bg-elev)', borderRadius: 'var(--radius)',
            padding: 12, marginBottom: 8,
            maxHeight: 420, overflow: 'auto',
          }}>
            {EDITABLE_VARS.map(k => {
              const isSecret = /KEY|TOKEN|PASSWORD/.test(k);
              const cur = allVars[k] || '';
              const displayMask = isSecret && cur ? (cur.slice(0, 4) + '…' + cur.slice(-4)) : cur;
              return (
                <AdminVarRow key={k}
                  name={k} current={cur} displayMask={displayMask}
                  editValue={edits[k] || ''}
                  onEdit={(v) => setOne(k, v)} />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button size="sm" onClick={submitEdits}>✓ Appliquer les modifications</Button>
            <Button size="sm" variant="secondary" onClick={downloadEnv}>⬇ Télécharger .env complet</Button>
          </div>
          {editMsg && (
            <div style={{
              marginBottom: 16, padding: 10,
              background: editMsg.startsWith('✓') ? 'rgba(78,166,60,0.08)' : 'rgba(200,58,115,0.08)',
              border: `1px solid ${editMsg.startsWith('✓') ? 'var(--jdm-green)' : 'var(--jdm-magenta)'}`,
              borderRadius: 'var(--radius)',
              color: editMsg.startsWith('✓') ? 'var(--jdm-green)' : 'var(--jdm-magenta)',
              fontSize: 12,
            }}>{editMsg}</div>
          )}

          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>2 · Cache disque JDM</div>
          <Button size="sm" variant="secondary" onClick={clearCache}>
            🗑 Vider le cache JDM
          </Button>
          {cacheMsg && (
            <div style={{
              marginTop: 8, padding: 10,
              background: cacheMsg.startsWith('✓') ? 'rgba(78,166,60,0.08)' : 'rgba(200,58,115,0.08)',
              border: `1px solid ${cacheMsg.startsWith('✓') ? 'var(--jdm-green)' : 'var(--jdm-magenta)'}`,
              borderRadius: 'var(--radius)',
              color: cacheMsg.startsWith('✓') ? 'var(--jdm-green)' : 'var(--jdm-magenta)',
              fontSize: 12,
            }}>{cacheMsg}</div>
          )}
        </>
      )}
    </Card>
  );
}

function AdminVarRow({ name, current, displayMask, editValue, onEdit }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '170px 1fr 28px 220px',
      gap: 8, alignItems: 'center', marginBottom: 6,
    }}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
      <div className="mono" title={current || '(non défini)'} style={{
        fontSize: 11,
        color: current ? 'var(--ink)' : 'var(--ink-3)',
        fontStyle: current ? 'normal' : 'italic',
        background: 'var(--bg-card)',
        padding: '6px 10px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line-soft)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{current ? displayMask : '(non défini)'}</div>
      <button
        type="button"
        onClick={copy}
        disabled={!current}
        title={current ? 'Copier la valeur' : ''}
        style={{
          width: 28, height: 28, padding: 0,
          background: copied ? 'var(--jdm-green)' : 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          color: copied ? '#fff' : 'var(--ink-3)',
          cursor: current ? 'pointer' : 'not-allowed',
          opacity: current ? 1 : 0.4,
          fontSize: 13,
        }}>{copied ? '✓' : '⎘'}</button>
      <Input value={editValue}
        onChange={onEdit}
        placeholder="nouvelle valeur (vide = ignore)" mono />
    </div>
  );
}

window.ViewAide = ViewAide;

// === webapp/app.jsx ===
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
                       'chatbot', 'chat', 'jarvis', 'productions', 'aide'];

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
    // Robot sur les surfaces orchestrateur (console Jarvis + chat plein écran).
    const robotViews = (view === 'jarvis' || view === 'chat');
    link.setAttribute('href', robotViews ? ROBOT : SUN);
  }, [view]);

  // Titre d'onglet par route : « JDM Agent » à l'accueil, « JDM Agent - <page> »
  // ailleurs ; Jarvis garde son identité d'orchestrateur.
  useEffect(() => {
    const TITLES = {
      projet:      'JDM Agent',
      explorer:    'JDM Agent - Explorer',
      claim:       'JDM Agent - Claim',
      subgraph:    'JDM Agent - Sous-graphe',
      chatbot:     'JDM Agent - Chatbot',
      chat:        'Jarvis : Chat',
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
      'KeyA': 'chatbot',  'KeyJ': 'jarvis', 'KeyP': 'productions',
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
    chatbot:     <ViewAgent />,
    chat:        <ViewChat />,
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
              ['chatbot', 'Chatbot LLM'],
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

