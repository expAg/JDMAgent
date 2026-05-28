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
function TopNav({ active, setActive, theme, setTheme }) {
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
          <JDMMark size={26} />
          <JDMWordmark />
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
          {setTheme && <ThemeSwitcher theme={theme} setTheme={setTheme} />}
          <ProductionsCountPill />
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

function HeroAnimation({ height = 380, showChat = true, liveScenario = null }) {
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
    }}>
      {/* Left — graph */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        height,
        overflow: 'hidden',
      }}>
        <GraphCanvas scenario={scenario} tick={tick} height={height} />
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

function GraphCanvas({ scenario, tick, height }) {
  const W = 560, H = height;
  const cx = W / 2, cy = H / 2;
  const g = scenario.graph;

  const positions = {};
  if (g.center) positions[g.center] = { x: 0, y: 0 };
  g.nodes.forEach(n => {
    if (n.x !== undefined) {
      positions[n.id] = { x: n.x, y: n.y };
    } else {
      const rad = (n.angle * Math.PI) / 180;
      positions[n.id] = { x: Math.cos(rad) * n.dist, y: Math.sin(rad) * n.dist };
    }
  });

  // Path layout doesn't rotate — labels need to stay axis-aligned and
  // not drift off-frame. Radial layout has a slow drift.
  const isPath = g.layout === 'path';
  const breathScale = 1 + (isPath ? 0.008 : 0.012) * Math.sin(tick * 0.6);
  const rotateAll = isPath ? 0 : tick * 1.2;

  const transform = `translate(${cx} ${cy}) rotate(${rotateAll}) scale(${breathScale})`;

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
      </defs>

      <circle cx={cx} cy={cy} r={Math.min(W, H) / 3} fill="url(#hero-glow)"/>

      <g transform={transform}>
        {g.edges.map((e, i) => {
          const visible = tick >= e.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - e.delay) / 0.7);
          const a = positions[e.from], b = positions[e.to];
          if (!a || !b) return null;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={x} y2={y}
                stroke={e.highlight ? 'var(--accent)' : 'var(--ink-3)'}
                strokeWidth={e.highlight ? 2 : 1}
                strokeOpacity={e.highlight ? 0.9 : 0.45}
                strokeLinecap="round"
              />
              {e.label && t > 0.6 && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fill={e.highlight ? 'var(--accent)' : 'var(--ink-3)'}
                  opacity={(t - 0.6) / 0.4}
                  transform={`rotate(${-rotateAll}, ${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 6})`}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {g.center && (
          <CenterNode label={g.center} tick={tick} counterRotate={-rotateAll} />
        )}

        {g.nodes.map((n, i) => {
          const p = positions[n.id];
          if (!p) return null;
          const visible = tick >= n.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - n.delay) / 0.5);
          const floatY = Math.sin(tick * 1.2 + i) * 1.5;
          return (
            <NodeBubble
              key={n.id}
              x={p.x} y={p.y + floatY}
              label={n.label}
              color={n.color}
              dim={n.dim}
              appearT={t}
              counterRotate={-rotateAll}
            />
          );
        })}
      </g>
    </svg>
  );
}

function CenterNode({ label, tick, counterRotate }) {
  const pulse = 0.5 + 0.5 * Math.sin(tick * 2);
  return (
    <g>
      <circle r={28} fill="var(--accent)" opacity={0.08 + pulse * 0.06}/>
      <circle r={20} fill="var(--accent)" opacity={0.18}/>
      <circle r={13} fill="var(--accent)"/>
      <text
        y={5}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="600"
        fill="var(--bg)"
        transform={`rotate(${counterRotate})`}
      >
        {label}
      </text>
    </g>
  );
}

function NodeBubble({ x, y, label, color, dim, appearT, counterRotate }) {
  const c = `var(--${color})`;
  const r = (dim ? 5 : 9) * appearT;
  const fontSize = dim ? 10 : 12;
  return (
    <g transform={`translate(${x} ${y})`} opacity={appearT}>
      <circle r={r + 5} fill={c} opacity="0.12"/>
      <circle r={r} fill={c}/>
      <g transform={`rotate(${counterRotate})`}>
        <text
          y={r + fontSize + 4}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={fontSize}
          fontWeight={dim ? 400 : 600}
          fill="var(--ink)"
          opacity={dim ? 0.65 : 1}
        >
          {label}
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

// Convertit {nodes, edges} SSE en scénario HeroAnimation.
// `layout` : 'tree' = arbre radial (enfants près de leur parent) ;
//            'rings' = cercles concentriques uniformes (anneau par depth).
function buildLiveScenario(rootTerm, nodes, edges, layout = 'tree') {
  if (!nodes || nodes.length === 0) return null;

  const centerNode = nodes.find(n => n.id === 'ROOT') || nodes[0];
  const center = centerNode.label || rootTerm;
  const centerId = centerNode.id;

  // Index parent ↔ enfants
  const childrenOf = {};
  const parentOf = {};
  for (const e of edges || []) {
    if (!childrenOf[e.from]) childrenOf[e.from] = [];
    if (!childrenOf[e.from].includes(e.to)) childrenOf[e.from].push(e.to);
    if (!(e.to in parentOf)) parentOf[e.to] = e.from;
  }

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Palette de branches — chaque branche principale (= un depth-1)
  // reçoit une couleur unique, héritée par tous ses descendants
  // → groupes de couleur lisibles, comme dans la démo Projet hero.
  const BRANCH_COLORS = [
    'jdm-magenta', 'jdm-cyan', 'jdm-green', 'jdm-violet',
    'jdm-orange', 'jdm-yellow',
  ];

  // ───── Layout 'tree' : positions cartésiennes parent → enfant ─────
  // depth-1 : posés en cercle autour du centre, dist = 130
  // depth ≥ 2 : posés en partant du PARENT (pos parent + vecteur radial),
  //   branchAngle = direction du parent ± offset léger pour ses frères.
  // Conversion cart → polaire pour HeroAnimation à la fin.
  const cartPos = { [centerId]: { x: 0, y: 0, branchAngle: 0, depth: 0 } };
  const nodeColors = { [centerId]: 'jdm-magenta' };
  const toRad = (a) => a * Math.PI / 180;

  // depth-1 = nœuds directement enfants du centre dans le graphe
  const d1Ids = (childrenOf[centerId] || []).filter(id => byId[id]);
  const D1_DIST = 130;
  d1Ids.forEach((id, i) => {
    const angle = (i / d1Ids.length) * 360 - 90;
    const rad = toRad(angle);
    cartPos[id] = {
      x: D1_DIST * Math.cos(rad), y: D1_DIST * Math.sin(rad),
      branchAngle: angle, depth: 1,
    };
    nodeColors[id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
  });

  // BFS depuis depth-1 pour placer toutes les profondeurs supérieures
  const BRANCH_LEN = [0, 0, 80, 65, 55];   // dist parent → child par depth
  const queue = [...d1Ids];
  while (queue.length) {
    const pid = queue.shift();
    const pPos = cartPos[pid];
    const kids = (childrenOf[pid] || [])
      .filter(id => byId[id] && !(id in cartPos) && id !== centerId);
    if (kids.length === 0) continue;

    const childDepth = pPos.depth + 1;
    const len = BRANCH_LEN[Math.min(childDepth, 4)] || 55;

    kids.forEach((id, i) => {
      // Span d'ouverture des frères depuis l'angle radial du parent.
      // 18° par frère (max 60°) → assez serré pour rester "en branche".
      const span = Math.min(60, Math.max(18, kids.length * 18));
      const off = kids.length === 1
        ? 0
        : (i / (kids.length - 1)) * span - span / 2;
      const branchAngle = pPos.branchAngle + off;
      const rad = toRad(branchAngle);
      cartPos[id] = {
        x: pPos.x + len * Math.cos(rad),
        y: pPos.y + len * Math.sin(rad),
        branchAngle, depth: childDepth,
      };
      nodeColors[id] = nodeColors[pid];  // hérite couleur branche
      queue.push(id);
    });
  }

  // Nœuds ORPHELINS (= pas atteignables depuis le centre via les edges
  // child-of) : on les colle quand même autour, sur un anneau secondaire.
  // Comme ça TOUS les nœuds renvoyés par l'API sont visibles, même si
  // leur edge entrant vient d'un autre depth-1.
  let orphanIdx = 0;
  const orphans = nodes.filter(n => !(n.id in cartPos));
  for (const n of orphans) {
    const angle = (orphanIdx / Math.max(orphans.length, 1)) * 360 - 90 + 15;
    const dist = 230;
    const rad = toRad(angle);
    cartPos[n.id] = {
      x: dist * Math.cos(rad), y: dist * Math.sin(rad),
      branchAngle: angle, depth: 2,
    };
    nodeColors[n.id] = BRANCH_COLORS[orphanIdx % BRANCH_COLORS.length];
    orphanIdx++;
  }

  // Mode 'rings' : on écrase le placement et on rebatch tout sur cercles
  // concentriques uniformes par profondeur.
  if (layout === 'rings') {
    const RING_DIST = [0, 130, 215, 280, 330];
    const byDepth = {};
    for (const id of Object.keys(cartPos)) {
      if (id === centerId) continue;
      const d = Math.min(cartPos[id].depth || 1, 4);
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(id);
    }
    for (const dStr of Object.keys(byDepth)) {
      const d = Number(dStr);
      const arr = byDepth[d];
      const dist = RING_DIST[Math.min(d, 4)] || 330;
      arr.forEach((id, i) => {
        const angle = (i / arr.length) * 360 - 90 + d * 12;
        const rad = toRad(angle);
        cartPos[id] = {
          x: dist * Math.cos(rad), y: dist * Math.sin(rad),
          branchAngle: angle, depth: d,
        };
      });
    }
  }

  // Conversion cartésien → polaire (angle, dist) pour HeroAnimation
  const liveNodes = [];
  const nodeDelays = { [centerId]: 0 };
  // Tri par depth pour une anim en vagues (depth 1 d'abord, etc.)
  const sortedIds = Object.keys(cartPos)
    .filter(id => id !== centerId && byId[id])
    .sort((a, b) => (cartPos[a].depth || 1) - (cartPos[b].depth || 1));

  sortedIds.forEach((id, i) => {
    const p = cartPos[id];
    const n = byId[id];
    const angle = Math.atan2(p.y, p.x) * 180 / Math.PI;
    const dist = Math.sqrt(p.x * p.x + p.y * p.y);
    const parentDelay = nodeDelays[parentOf[id] || centerId] || 0;
    const delay = Math.max(parentDelay + 0.18, 0.4 + i * 0.06);
    nodeDelays[id] = delay;
    liveNodes.push({
      id, label: n.label || id,
      angle, dist,
      color: nodeColors[id] || 'jdm-violet',
      delay, dim: p.depth >= 2,
    });
  });

  // TOUTES les arêtes — les deux extrémités sont placées (cartPos
  // contient le centre + tous les nœuds + les orphelins rattachés
  // à l'anneau secondaire).
  const liveEdges = (edges || [])
    .filter(e => (e.from in cartPos) && (e.to in cartPos))
    .map(e => ({
      from: e.from, to: e.to,
      delay: Math.max(nodeDelays[e.from] || 0, nodeDelays[e.to] || 0) + 0.15,
      label: e.relation || '',
      highlight: e.highlight !== false,
    }));

  return {
    id: 'live',
    question: '',
    streamChunks: [],
    graph: { center, nodes: liveNodes, edges: liveEdges },
  };
}


// Wrapper qui MEMOIZE le scenario pour ne pas recréer un nouvel objet
// à chaque render — sinon HeroAnimation re-trigger l'animation en
// boucle infinie (sa useEffect dépend de liveScenario par référence).
function LiveAnimWrapper({ term, nodes, edges, layout }) {
  const scenario = React.useMemo(
    () => buildLiveScenario(term, nodes, edges, layout),
    // Dépend de la longueur + premier/dernier id pour détecter des
    // données réellement différentes sans tomber dans le piège du
    // "nouvelle référence à chaque tick SSE".
    [term, layout, (nodes || []).length, (edges || []).length,
     (nodes || [])[0]?.id, (nodes || [])[(nodes || []).length - 1]?.id]
  );
  return <HeroAnimation height={560} showChat={false} liveScenario={scenario} />;
}

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
  const [format, setFormat] = useState('live');  // 'live' par défaut (animation graphique)
  // Layout en mode LIVE : 'tree' (arbre radial, défaut) ou 'rings' (cercles concentriques).
  const [liveLayout, setLiveLayout] = useState('tree');
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

    // Mode LIVE : consomme l'endpoint SSE /api/subgraph/live qui émet
    // un snapshot 'graph' immédiat puis les nodes/edges progressivement.
    // L'iframe LIVE (HeroAnimation simulation) continue de tourner en
    // parallèle, mais on a maintenant un graphe réel JDM en data.
    if (format === 'live') {
      try {
        // En mode LIVE, on cap dur max_nodes à 18 pour garder une
        // visualisation lisible (au-delà : nœuds se chevauchent).
        // L'utilisateur peut quand même augmenter la profondeur ou
        // le top_k pour explorer — mais la couronne reste bornée.
        const liveMaxNodes = Math.min(Number(maxNodes) || 18, 18);
        const res = await fetch('api/subgraph/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term,
            depth: Number(depth),
            top_k: Number(topK),
            relations: activeRels,
            max_nodes: liveMaxNodes,
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
              collectedNodes = parsed.nodes || [];
              collectedEdges = parsed.edges || [];
              setData({ nodes: collectedNodes, edges: collectedEdges,
                        stats: { n_nodes: collectedNodes.length,
                                 n_edges: collectedEdges.length, depth },
                        html: '', format: 'live' });
            } else if (evName === 'error') {
              setError(parsed.text || 'erreur LIVE');
            }
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          flush();
        }
      } catch (e) {
        setError(String(e && e.message ? e.message : e));
      } finally {
        setLoading(false);
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
            <Field label={`Poids minimum · ${minWeight}`}>
              <Slider value={minWeight} onChange={setMinWeight} min={0} max={300} step={5} />
            </Field>
            {format === 'json' && (
              <Field label={`Nœuds max (SVG) · ${maxNodes}`}>
                <Slider value={maxNodes} onChange={setMaxNodes} min={10} max={200} step={5} />
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
            <div style={{
              // Hauteur adaptative selon le format :
              //  - HTML (vis-network iframe) : gros canvas, prend la viewport
              //  - SVG (rendu natif sur dataset) : moyen
              //  - LIVE (animation graphique) : 600px pour matcher l'anim
              height: format === 'live'
                ? 620
                : format === 'json'
                  ? 'min(720px, calc(100vh - 220px))'
                  : 'min(900px, calc(100vh - 220px))',
              minHeight: format === 'live' ? 620 : 560,
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

  // Send : POST /api/agent/stream, parse SSE en flux, accumule sur le
  // dernier message assistant (créé vide juste avant le fetch).
  // `overrideMsg` permet au bouton ↻ de re-soumettre une question
  // précédente sans passer par le state input (qui est async).
  const send = async (overrideMsg) => {
    const effectiveMsg = (overrideMsg !== undefined ? overrideMsg : input);
    if (!effectiveMsg.trim() || streaming) return;
    const userMsg = { role: 'user', content: effectiveMsg };
    const historySnapshot = convo.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? (m.content || '') : m.content,
    }));
    const assistantStub = { role: 'assistant', thoughts: [], tools: [], content: '', error: '' };
    setConvo([...convo, userMsg, assistantStub]);
    const msg = effectiveMsg;
    if (overrideMsg === undefined) setInput('');
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
    case 'error':
      patchLast(last => { last.error = d.text || 'Erreur inconnue.'; });
      break;
    default:
      break;
  }
}

// ─── Rendu d'un message ────────────────────────────────────────

function Message({ m, onResend }) {
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
    const idx = JARVIS_FLOWS.findIndex(f => f.id === active);
    const flow = JARVIS_FLOWS[idx];
    const nextFlow = idx >= 0 && idx < JARVIS_FLOWS.length - 1 ? JARVIS_FLOWS[idx + 1] : null;
    return (
      <JarvisRun
        flow={flow}
        nextFlow={nextFlow}
        onBack={() => setActive(null)}
        onNext={nextFlow ? () => setActive(nextFlow.id) : null}
      />
    );
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
function JarvisRun({ flow, nextFlow, onBack, onNext }) {
  const [params, setParams] = useState(defaultParamsFor(flow.id));
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [log, setLog] = useState([]);
  const [metrics, setMetrics] = useState({
    toolsCalled: 0, accepted: 0, tokens: 0, elapsed: 0,
  });
  const [accepted, setAccepted] = useState([]);
  // narrationHTML = trace markdown/HTML cumulative du LLM (left panel)
  // filePreview = contenu du fichier .enrich/.audit/.err qui se construit
  //              (right panel — c'est CE qu'on appelle « réponse finale »)
  const [narrationHTML, setNarrationHTML] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [filePath, setFilePath] = useState(null);
  const [headline, setHeadline] = useState('');
  // Etat de reprise après PerDay sur modèle non-3.1 — run_jarvis_flow
  // yield un 5-tuple avec state quand l'agent abort. Le state contient
  // accumulated_messages + canonical_path + budget courant → re-passe
  // à un nouveau call pour reprendre exactement où on s'est arrêté.
  const [resumeState, setResumeState] = useState(null);
  const [poolStatus, setPoolStatus] = useState(null);

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
  const abortRef = useRef(null);
  const startTimeRef = useRef(null);

  // Auto-scroll log + narration : suit le flux de génération en bas
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);

  // Tick elapsed time
  useEffect(() => {
    if (state !== 'running') return;
    const id = setInterval(() => {
      setMetrics(m => ({ ...m, elapsed: Date.now() - (startTimeRef.current || Date.now()) }));
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  const reset = () => {
    setLog([]); setAccepted([]); setNarrationHTML(''); setFilePreview('');
    setFilePath(null); setHeadline('');
    setMetrics({ toolsCalled: 0, accepted: 0, tokens: 0, elapsed: 0 });
    setState('idle');
  };

  const launch = async (continueFromResume) => {
    const isResume = !!continueFromResume;
    if (!isResume) {
      reset();
    } else {
      // Pour Continuer : on garde le log, narration, fichier en cours,
      // metrics — on ajoute juste une ligne de reprise.
      setLog(l => [...l, { t: ts(), tag: '[resume]', kind: 'iter', msg: 'Reprise après abort PerDay…' }]);
    }
    setState('running');
    if (!isResume) startTimeRef.current = Date.now();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const flowParams = {
      ...params,
      ...(isResume && resumeState ? { resume_state: resumeState } : {}),
    };
    if (isResume) setResumeState(null);  // clear pour ne pas reprendre 2x
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
      // Backend yield des events { type: jarvis } portant :
      //   messages          [{role, content}]
      //   file_path         chemin du fichier .enrich/.audit/.err
      //   file_preview      contenu courant du fichier (gradually appended)
      //   consolidated_count int — VRAI compteur depuis count_consolidations()
      //   consolidated      list[{term, relation, target, ...}]
      // Le narration HTML (avec divs .jdm-narration et spans .jarvis-term)
      // est dans le dernier message assistant — on l'injecte tel quel dans
      // le panneau LOG (HTML interprété via dangerouslySetInnerHTML).
      // file_preview va dans le panneau « RÉPONSE FINALE » (= état du
      // fichier en construction).
      let prevConsolidatedCount = 0;
      const dispatchEvent = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'headline':
            setHeadline(d.text || '');
            setLog(l => [...l, { t: ts(), tag: '[start]', kind: 'iter', msg: d.text || '' }]);
            break;
          case 'jarvis': {
            const msgs = d.messages || [];
            const assistant = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            // Stocke le state de reprise s'il est fourni (= l'agent a
            // abort sur PerDay sans auto-bascule → on offre Continuer).
            if (d.state) setResumeState(d.state);
            // Met à jour la narration HTML pour le panneau LOG
            if (assistant && assistant.content) {
              setNarrationHTML(assistant.content);
            }
            // Compteur consolidés depuis le registry (source de vérité)
            const cc = Number(d.consolidated_count || 0);
            if (cc !== prevConsolidatedCount) {
              setMetrics(m => ({ ...m, accepted: cc }));
              prevConsolidatedCount = cc;
            }
            // Compteur outils via marqueurs de narration HTML
            if (assistant && assistant.content) {
              const toolMatches = assistant.content.match(/class="jdm-narration"/g) || [];
              setMetrics(m => ({ ...m, toolsCalled: toolMatches.length }));
            }
            // Tokens estimés (sert à voir le gain après truncate/relance)
            if (typeof d.tokens_estimate === 'number') {
              setMetrics(m => ({ ...m, tokens: d.tokens_estimate }));
            }
            // Triplets consolidés depuis le registry (pas du parsing)
            if (Array.isArray(d.consolidated)) {
              setAccepted(d.consolidated.map(c => ({
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: '✓',
              })));
            }
            // Aperçu du fichier qui se construit (gradually appended)
            if (typeof d.file_preview === 'string') {
              setFilePreview(d.file_preview);
            }
            // Path du fichier (téléchargement)
            if (d.file_path && d.file_path !== filePath) {
              setFilePath(d.file_path);
              setLog(l => [...l, {
                t: ts(), tag: '[file]', kind: 'accept',
                msg: `Fichier : ${d.file_path}`,
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
              <Field label="Clé LLMDrops">
                <Input value={params.drops_key || ''}
                  onChange={(v) => setParams(p => ({ ...p, drops_key: v }))}
                  placeholder="vide = clé serveur…" mono />
              </Field>
              {(params.model || '').match(/^(claude|gpt)-/) && (
                <Field label="Clé API LLM">
                  <Input value={params.api_key || ''}
                    onChange={(v) => setParams(p => ({ ...p, api_key: v }))}
                    placeholder={(params.model || '').startsWith('claude-') ? 'sk-ant-…' : 'sk-…'}
                    mono />
                </Field>
              )}
            </div>
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
            <Metric label="Consolidés" value={metrics.accepted} sub="triplets" color="var(--jdm-green)" />
            <Metric label="Temps" value={fmtElapsed(metrics.elapsed)} sub="écoulé" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Narration (markdown HTML interprété — narrations LLM,
                tools, consolidations) — c'est notre VRAI log temps réel. */}
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
                }}>Narration LLM</div>
                {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420,
                overflowY: 'auto',
                padding: 14,
                background: 'var(--bg-card)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {narrationHTML ? (
                  <div dangerouslySetInnerHTML={{ __html: narrationHTML }} />
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
                  Triplets consolidés · <span style={{ color: 'var(--jdm-green)' }}>{metrics.accepted}</span>
                  {filePath && (
                    <span style={{ color: 'var(--ink-2)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                      · {filePath.split(/[\\/]/).slice(-1)[0]}
                    </span>
                  )}
                </div>
                {/* Télécharger le fichier brut — appelle l'API
                    /api/productions/download avec le basename. */}
                {filePath && (
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
                )}
              </div>
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 0,
                background: 'var(--bg-card)',
              }}>
                {accepted.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4, padding: 12 }}>
                    {accepted.map((a, i) => (
                      <div key={i} className="fade-up" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line-soft)',
                        borderRadius: 'var(--radius)',
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                      }}>
                        <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>{a.score}</span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)' }}>{a.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                    {state === 'idle' ? 'Aucun triplet encore.' : 'En attente du 1ᵉʳ triplet consolidé…'}
                  </div>
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

// ───── fmtElapsed : ms → "12.4s" ou "2m 14.8s" (passe en minutes ≥ 60s) ─
function fmtElapsed(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rem = sec - m * 60;
  return `${m}m ${rem.toFixed(1)}s`;
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
  // thinking=false (Jarvis = robustesse > raisonnement), upload=false,
  // auto_switch=false (= mode B : abort + bouton Continuer).
  const common = {
    model: 'gemini-3.1-flash-lite',
    api_key: '', drops_key: '',
    use_thinking: false,
    budget_label: 'illimité',
    auto_switch: false,
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

// === webapp/views-productions.jsx ===
// View: Productions — fichiers .enrich / .audit / .err / .stat /
// visualisations produits par les flux Jarvis. Liste + download +
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
  const [modelName, setModelName] = useState('claude-sonnet');

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

  return (
    <PageShell>
      <SectionTitle
        kicker="Sorties Jarvis"
        title="Productions"
        desc="Fichiers .enrich / .audit / .err / .stat / visualisations produits par les flux Jarvis. Liste, prévisualisation, téléchargement, soumission LLMDrops."
      />

      {/* Bandeau actions */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <Field label="Clé LLMDrops (override env)">
            <Input value={dropsKey} onChange={setDropsKey} placeholder="optionnel…" mono />
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
        selected={selectedRecent}
        onToggle={toggle(selectedRecent, setSelectedRecent)}
        onPreview={openPreview}
        onDownload={downloadOne}
        onSubmit={() => submitSelected(false)}
        onDelete={() => deleteSelected(false)}
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
              selected={selectedOldies}
              onToggle={toggle(selectedOldies, setSelectedOldies)}
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

function ProductionsSection({ title, files, archived, selected, onToggle,
                              onPreview, onDownload, onSubmit, onDelete,
                              busy, isAdmin }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10,
      }}>
        {title && (
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600, margin: 0,
          }}>{title}</h2>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Button size="sm" onClick={onSubmit}
            disabled={busy || selected.size === 0}>
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
      <span className="mono" style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: 'var(--ink)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{file.name}</span>
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
  { icon: '🦾', name: 'Jarvis',        what: 'Flux guidés par formulaires (5 sous-onglets).',                    key: 'Gemini · LLMDrops si soumission' },
  { icon: '🛠️', name: 'Aide',          what: 'Ce document.',                                                      key: '—' },
];

const JARVIS_FLOWS_HELP = [
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
            {JARVIS_FLOWS_HELP.map(f => (
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

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('projet');

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

  // Raccourcis clavier — séquence "G E" pour Aller à Explorer, etc.
  // Annoncés dans l'onglet Aide. Désactivés quand on est dans un input
  // (textarea, contenteditable, [type=text|password|...]) pour ne pas
  // intercepter les saisies utilisateur.
  useEffect(() => {
    let pendingG = false;
    let pendingGTimer = null;
    const SHORTCUTS_G = {
      'KeyE': 'explorer', 'KeyC': 'claim',  'KeyS': 'subgraph',
      'KeyA': 'agent',    'KeyJ': 'jarvis', 'KeyP': 'productions',
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
    agent:       <ViewAgent />,
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
              ['agent', 'Chatbot LLM'],
              ['jarvis', 'Jarvis'],
              ['productions', 'Productions'],
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

