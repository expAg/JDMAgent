const { useState, useRef, useEffect, useMemo, useCallback, useReducer } = React;
const JDM_PALETTE = {
  magenta: "#c83a73",
  green: "#4ea63c",
  yellow: "#d4a90a",
  cyan: "#1f97b1",
  orange: "#d96810",
  violet: "#7a4fbe"
};
const JDM_COLORS = Object.values(JDM_PALETTE);
function JDMMark({ size = 28 }) {
  const r = size / 2;
  const ringR = r - 3;
  const n = 8;
  const dots = Array.from({ length: n }).map((_, i) => {
    const a = i / n * Math.PI * 2 - Math.PI / 2;
    return {
      x: r + Math.cos(a) * ringR,
      y: r + Math.sin(a) * ringR,
      c: JDM_COLORS[i % JDM_COLORS.length]
    };
  });
  return /* @__PURE__ */ React.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true" }, dots.map((d, i) => /* @__PURE__ */ React.createElement("circle", { key: i, cx: d.x, cy: d.y, r: 1.6, fill: d.c })), /* @__PURE__ */ React.createElement("circle", { cx: r, cy: r, r: 3.6, fill: "var(--accent)" }));
}
function JDMWordmark({ small = false }) {
  const theme = document.body.dataset.theme || "paper";
  const baseSize = small ? 17 : 22;
  const jdmSize = baseSize * 1.05;
  const jdmLetters = /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 0
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "'Lilita One', system-ui",
    fontSize: jdmSize,
    lineHeight: 0.95,
    color: "color-mix(in srgb, var(--jdm-magenta) 55%, var(--ink) 45%)",
    display: "inline-block",
    transform: "rotate(-4deg) translateY(1px)"
  } }, "j"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "'Lilita One', system-ui",
    fontSize: jdmSize,
    lineHeight: 0.95,
    color: "color-mix(in srgb, var(--jdm-green) 55%, var(--ink) 45%)",
    display: "inline-block",
    transform: "rotate(2deg)"
  } }, "d"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "'Lilita One', system-ui",
    fontSize: jdmSize,
    lineHeight: 0.95,
    color: "color-mix(in srgb, var(--jdm-cyan) 55%, var(--ink) 45%)",
    display: "inline-block",
    transform: "rotate(-2deg) translateY(1px)",
    marginRight: 3
  } }, "m"));
  return /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 1
  } }, jdmLetters, /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    fontWeight: 500,
    fontSize: baseSize,
    letterSpacing: "-0.015em",
    color: "var(--ink)"
  } }, "Agent"));
}
function _normSearch(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function filterOptions(options, query) {
  const q = _normSearch(query);
  if (!q) return options;
  return options.filter((o) => {
    var _a, _b;
    const v = _normSearch((_a = o.value) != null ? _a : o);
    const l = _normSearch((_b = o.label) != null ? _b : o);
    const sub = _normSearch(o.sub);
    return v.includes(q) || l.includes(q) || sub.includes(q);
  });
}
function OptionSearchInput({ inputRef, value, onChange, onKeyDown }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    position: "sticky",
    top: -4,
    zIndex: 1,
    background: "var(--bg-card)",
    padding: "2px 2px 6px",
    borderBottom: "1px solid var(--line-soft)",
    marginBottom: 4
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      value,
      onChange: (e) => onChange(e.target.value),
      onKeyDown,
      placeholder: "Filtrer… (r_agent, agent, hyperonyme)",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "7px 9px",
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink)",
        fontFamily: "inherit",
        fontSize: 13,
        outline: "none"
      }
    }
  ));
}
function Select({ value, options, onChange, placeholder = "Choisir…", width, searchable = false }) {
  var _a;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    if (open && searchable) {
      setQuery("");
      const t = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);
  const selected = options.find((o) => {
    var _a2;
    return ((_a2 = o.value) != null ? _a2 : o) === value;
  });
  const label = selected ? (_a = selected.label) != null ? _a : selected : placeholder;
  const filtered = searchable ? filterOptions(options, query) : options;
  return /* @__PURE__ */ React.createElement("div", { className: "om-select", ref: rootRef, style: { width } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "om-select__trigger focus-ring",
      onClick: () => setOpen((o) => !o),
      "aria-haspopup": "listbox",
      "aria-expanded": open
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: selected ? "var(--ink)" : "var(--ink-3)"
    } }, label),
    /* @__PURE__ */ React.createElement("svg", { className: "om-select__chevron", width: "12", height: "12", viewBox: "0 0 12 12" }, /* @__PURE__ */ React.createElement("path", { d: "M2 4l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: "1.6" }))
  ), open && /* @__PURE__ */ React.createElement("div", { className: "om-select__menu fade-up", role: "listbox" }, searchable && /* @__PURE__ */ React.createElement(
    OptionSearchInput,
    {
      inputRef,
      value: query,
      onChange: setQuery,
      onKeyDown: (e) => {
        var _a2;
        if (e.key === "Enter" && filtered.length) {
          const f = filtered[0];
          onChange((_a2 = f.value) != null ? _a2 : f);
          setOpen(false);
        }
      }
    }
  ), filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "om-select__option", style: { color: "var(--ink-3)", cursor: "default" } }, "Aucune relation ne correspond."), filtered.map((o, i) => {
    var _a2, _b;
    const v = (_a2 = o.value) != null ? _a2 : o;
    const l = (_b = o.label) != null ? _b : o;
    const sub = o.sub;
    const isSel = v === value;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: i,
        className: "om-select__option",
        role: "option",
        "aria-selected": isSel,
        onClick: () => {
          onChange(v);
          setOpen(false);
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, l), sub && /* @__PURE__ */ React.createElement("div", { style: {
        fontSize: 11,
        color: "var(--ink-3)",
        marginTop: 2,
        fontFamily: "var(--font-mono)"
      } }, sub)),
      /* @__PURE__ */ React.createElement("svg", { className: "check", width: "12", height: "12", viewBox: "0 0 12 12" }, /* @__PURE__ */ React.createElement("path", { d: "M2 6l3 3 5-6", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }))
    );
  })));
}
function MultiSelect({ value, options, onChange, placeholder = "Aucune sélection", width, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    if (open && searchable) {
      setQuery("");
      const t = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);
  const filtered = searchable ? filterOptions(options, query) : options;
  const _qActive = !!query.trim();
  const toggle = (v) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next);
  };
  const labelNode = () => {
    if (selected.length === 0) {
      return /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, placeholder);
    }
    if (selected.length <= 3) {
      return /* @__PURE__ */ React.createElement("span", { style: {
        display: "inline-flex",
        gap: 4,
        flexWrap: "wrap",
        alignItems: "center",
        overflow: "hidden"
      } }, selected.map((v) => {
        var _a;
        const o = options.find((o2) => {
          var _a2;
          return ((_a2 = o2.value) != null ? _a2 : o2) === v;
        });
        const l = o ? (_a = o.label) != null ? _a : o : v;
        return /* @__PURE__ */ React.createElement("span", { key: v, style: {
          fontSize: 11,
          padding: "1px 6px",
          background: "var(--bg-elev)",
          border: "1px solid var(--line-soft)",
          borderRadius: 3,
          fontFamily: "var(--font-mono)",
          color: "var(--ink)"
        } }, l);
      }));
    }
    return /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, selected.length, " sélectionné", selected.length > 1 ? "s" : "");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "om-select", ref: rootRef, style: { width } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "om-select__trigger focus-ring",
      onClick: () => setOpen((o) => !o),
      "aria-haspopup": "listbox",
      "aria-expanded": open
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      flex: 1,
      minWidth: 0,
      textAlign: "left"
    } }, labelNode()),
    /* @__PURE__ */ React.createElement("svg", { className: "om-select__chevron", width: "12", height: "12", viewBox: "0 0 12 12" }, /* @__PURE__ */ React.createElement("path", { d: "M2 4l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: "1.6" }))
  ), open && /* @__PURE__ */ React.createElement("div", { className: "om-select__menu fade-up", role: "listbox" }, searchable && /* @__PURE__ */ React.createElement(OptionSearchInput, { inputRef, value: query, onChange: setQuery }), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 10px",
    borderBottom: "1px solid var(--line-soft)",
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    color: "var(--ink-3)",
    letterSpacing: "0.06em",
    textTransform: "uppercase"
  } }, /* @__PURE__ */ React.createElement("span", null, selected.length, "/", options.length, _qActive ? ` · ${filtered.length} filtrés` : ""), /* @__PURE__ */ React.createElement("span", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: (e) => {
        e.stopPropagation();
        const fv = filtered.map((o) => {
          var _a;
          return (_a = o.value) != null ? _a : o;
        });
        onChange(Array.from(/* @__PURE__ */ new Set([...selected, ...fv])));
      },
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--accent)",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        padding: 0,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
      }
    },
    "tout"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: (e) => {
        e.stopPropagation();
        const fv = new Set(filtered.map((o) => {
          var _a;
          return (_a = o.value) != null ? _a : o;
        }));
        onChange(selected.filter((v) => !fv.has(v)));
      },
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--ink-3)",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        padding: 0,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
      }
    },
    "aucun"
  ))), filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "om-select__option", style: { color: "var(--ink-3)", cursor: "default" } }, "Aucune relation ne correspond."), filtered.map((o, i) => {
    var _a, _b;
    const v = (_a = o.value) != null ? _a : o;
    const l = (_b = o.label) != null ? _b : o;
    const sub = o.sub;
    const isSel = selected.includes(v);
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: i,
        className: "om-select__option",
        role: "option",
        "aria-selected": isSel,
        onClick: () => toggle(v)
      },
      /* @__PURE__ */ React.createElement("span", { style: {
        width: 14,
        height: 14,
        borderRadius: 3,
        border: `1.5px solid ${isSel ? "var(--accent)" : "var(--line)"}`,
        background: isSel ? "var(--accent)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginRight: 8
      } }, isSel && /* @__PURE__ */ React.createElement("svg", { width: "9", height: "9", viewBox: "0 0 12 12" }, /* @__PURE__ */ React.createElement(
        "path",
        {
          d: "M2 6l3 3 5-6",
          fill: "none",
          stroke: "var(--bg)",
          strokeWidth: "2.2",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ))),
      /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, l), sub && /* @__PURE__ */ React.createElement("div", { style: {
        fontSize: 11,
        color: "var(--ink-3)",
        marginTop: 2,
        fontFamily: "var(--font-mono)"
      } }, sub))
    );
  })));
}
function Field({ label, hint, children, inline }) {
  return /* @__PURE__ */ React.createElement("label", { style: {
    display: inline ? "flex" : "block",
    alignItems: inline ? "center" : void 0,
    gap: inline ? 12 : 0,
    marginBottom: inline ? 8 : 14
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ink-2)",
    marginBottom: inline ? 0 : 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "var(--font-mono)",
    flexShrink: 0
  } }, label), /* @__PURE__ */ React.createElement("div", { style: { flex: inline ? 1 : void 0 } }, children), hint && !inline && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 4 } }, hint));
}
function Input({ value, onChange, placeholder, mono, type, ...rest }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      type: type || "text",
      value,
      onChange: (e) => onChange(e.target.value),
      placeholder,
      className: "focus-ring",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontSize: 13,
        lineHeight: 1.35,
        outline: "none",
        transition: "border-color 0.12s",
        // Reset des styles inputs proper aux navigateurs — assure une
        // hauteur calculée identique au Select trigger (button flex).
        appearance: "none",
        WebkitAppearance: "none"
      },
      ...rest
    }
  );
}
function TermSenseField({ value, onChange, placeholder, mono }) {
  const [typed, setTyped] = React.useState(value || "");
  const [open, setOpen] = React.useState(false);
  const [senses, setSenses] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    if ((value || "") !== typed) setTyped(value || "");
  }, [value]);
  const emit = (v, label) => {
    if (onChange) onChange(v, label || "");
  };
  const onType = (v) => {
    const added = (v.match(/>/g) || []).length > (typed.match(/>/g) || []).length;
    setTyped(v);
    emit(v, "");
    if (added) setOpen(true);
  };
  const baseTerm = (typed || "").split(">")[0].trim();
  const fetchSenses = async (b) => {
    const t = (b !== void 0 ? b : baseTerm).trim();
    if (!t) {
      setSenses([]);
      setMsg("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("api/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: t })
      });
      const d = await r.json();
      setSenses(Array.isArray(d.senses) ? d.senses : []);
      setMsg(d.message || "");
    } catch (e) {
      setSenses([]);
      setMsg(String(e && e.message ? e.message : e));
    }
    setLoading(false);
  };
  React.useEffect(() => {
    if (open) fetchSenses(baseTerm);
  }, [open]);
  React.useEffect(() => {
    const id = setTimeout(() => fetchSenses(baseTerm), 300);
    return () => clearTimeout(id);
  }, [baseTerm]);
  const hasSenses = senses.length > 0;
  const _chain = (typed || "").trim().replace(/>+$/, "");
  const _lc = _chain.toLowerCase();
  let _prefix = _lc;
  if (_chain.includes(">")) {
    const _hasChildren = senses.some((s) => (s.soft || "").toLowerCase().startsWith(_lc + ">"));
    const _isExact = senses.some((s) => (s.soft || "").toLowerCase() === _lc);
    if (_isExact && !_hasChildren) {
      _prefix = _lc.slice(0, _lc.lastIndexOf(">"));
    }
  }
  const _filtered = senses.filter((s) => (s.soft || "").toLowerCase().startsWith(_prefix));
  const displayed = _filtered.length ? _filtered : senses;
  const pick = (s) => {
    const soft = s.soft || s.id;
    setTyped(soft);
    emit(soft, s.decoded || "");
    setOpen(false);
  };
  return /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement(Input, { value: typed, onChange: onType, placeholder, mono })), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setOpen((o) => !o),
      className: "focus-ring",
      title: hasSenses ? `« ${baseTerm} » est polysémique — ${senses.length} sens disponibles` : "Choisir un sens précis (terme polysémique)",
      style: {
        flexShrink: 0,
        cursor: "pointer",
        padding: "0 12px",
        background: open ? "var(--accent)" : "var(--bg-elev)",
        border: `1px solid ${open ? "var(--accent)" : hasSenses ? "var(--jdm-green)" : "var(--line)"}`,
        borderRadius: "var(--radius)",
        color: open ? "var(--bg)" : hasSenses ? "var(--jdm-green)" : "var(--ink-2)",
        fontSize: 12,
        fontWeight: hasSenses ? 700 : 400,
        whiteSpace: "nowrap"
      }
    },
    "> sens"
  )), open && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 30,
    marginTop: 4,
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
    maxHeight: 260,
    overflow: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", padding: "4px 6px" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setOpen(false),
      style: {
        cursor: "pointer",
        background: "transparent",
        border: "none",
        color: "var(--ink-3)",
        fontSize: 12
      }
    },
    "fermer ✕"
  )), loading && /* @__PURE__ */ React.createElement("div", { style: { padding: 10, fontSize: 12, color: "var(--ink-3)" } }, "… recherche des sens …"), !loading && senses.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: 10, fontSize: 12, color: "var(--ink-3)" } }, msg || "Aucun sens raffiné."), !loading && displayed.map((s, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      onClick: () => pick(s),
      className: "focus-ring",
      style: {
        padding: "8px 10px",
        cursor: "pointer",
        fontSize: 13,
        color: "var(--ink)",
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        borderTop: i ? "1px solid var(--line-soft)" : "none"
      }
    },
    /* @__PURE__ */ React.createElement("span", null, s.decoded),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-3)", fontSize: 11 } }, "w=", s.weight)
  ))));
}
function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = "", format }) {
  const display = format ? format(value) : `${value}${suffix}`;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min,
      max,
      step,
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      style: { flex: 1, accentColor: "var(--accent)" }
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    minWidth: 28,
    textAlign: "right",
    fontSize: 12,
    color: "var(--ink-2)"
  } }, display));
}
function Button({ children, onClick, variant = "primary", size = "md", icon, disabled, full }) {
  const styles = {
    primary: {
      background: "var(--accent)",
      color: "var(--bg)",
      border: "1px solid var(--accent)"
    },
    secondary: {
      background: "var(--bg-card)",
      color: "var(--ink)",
      border: "1px solid var(--line)"
    },
    ghost: {
      background: "transparent",
      color: "var(--ink-2)",
      border: "1px solid transparent"
    }
  }[variant];
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12 },
    md: { padding: "9px 14px", fontSize: 13 },
    lg: { padding: "11px 18px", fontSize: 14 }
  }[size];
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      disabled,
      className: "focus-ring",
      style: {
        ...styles,
        ...sizes,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: "var(--radius)",
        fontFamily: "inherit",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : void 0,
        transition: "transform 0.06s, opacity 0.12s"
      },
      onMouseDown: (e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.98)";
      },
      onMouseUp: (e) => {
        e.currentTarget.style.transform = "";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "";
      }
    },
    icon,
    children
  );
}
function Card({ children, padding = 20, style }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    padding,
    ...style
  } }, children);
}
function Pill({ children, color = "var(--ink-3)", tone = "soft" }) {
  return /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    background: tone === "soft" ? "var(--line-soft)" : color,
    color: tone === "soft" ? color : "var(--bg)",
    border: tone === "outline" ? `1px solid ${color}` : "none",
    lineHeight: 1.4,
    whiteSpace: "nowrap"
  } }, children);
}
function SectionTitle({ kicker, title, desc, right }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: "1px solid var(--line)"
  } }, /* @__PURE__ */ React.createElement("div", null, kicker && /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 8
  } }, kicker), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: "-0.015em",
    color: "var(--ink)"
  } }, title), desc && /* @__PURE__ */ React.createElement("p", { style: {
    margin: "8px 0 0",
    color: "var(--ink-2)",
    fontSize: 14,
    maxWidth: "60ch"
  } }, desc)), right && /* @__PURE__ */ React.createElement("div", { style: { flexShrink: 0 } }, right));
}
function EmptyState({ icon, title, desc, action }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    textAlign: "center",
    padding: "48px 24px",
    color: "var(--ink-3)"
  } }, icon && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, opacity: 0.6 } }, icon), /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 500,
    color: "var(--ink-2)",
    marginBottom: 4
  } }, title), desc && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginBottom: 16 } }, desc), action);
}
function Triplet({ subject, relation, object, weight, annotations }) {
  const isNegative = weight != null && Number(weight) < 0;
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: isNegative ? "rgba(200, 58, 115, 0.08)" : "var(--bg-elev)",
    border: `1px solid ${isNegative ? "rgba(200, 58, 115, 0.35)" : "var(--line-soft)"}`,
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", fontWeight: 600 } }, subject), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "│"), /* @__PURE__ */ React.createElement("span", { style: { color: isNegative ? "var(--jdm-magenta)" : "var(--accent)" } }, relation), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "│"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", fontWeight: 600 } }, object), weight != null && /* @__PURE__ */ React.createElement("span", { style: {
    marginLeft: "auto",
    color: isNegative ? "var(--jdm-magenta)" : "var(--ink-3)",
    fontSize: 11,
    fontWeight: isNegative ? 600 : 400
  } }, "w=", weight), annotations && /* @__PURE__ */ React.createElement("div", { style: {
    flexBasis: "100%",
    fontSize: 11,
    color: "var(--ink-3)",
    paddingLeft: 4
  } }, "↳ ", annotations));
}
function TopNav({ active, setActive, theme, setTheme, accent, cycleAccent, hubText }) {
  const items = [
    { id: "projet", label: "Projet" },
    { id: "explorer", label: "Explorer" },
    { id: "claim", label: "Claim checker" },
    { id: "subgraph", label: "Sous-graphe" },
    { id: "chatbot", label: "Chatbot LLM" },
    { id: "jarvis", label: "Jarvis" },
    { id: "productions", label: "Productions" },
    // 'outils' : route volontairement NON listée ici (accessible par URL /outils
    // ou raccourci « G O ») — hub TALN interne, non exposé aux visiteurs.
    { id: "aide", label: "Aide" }
  ];
  return /* @__PURE__ */ React.createElement("header", { style: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "var(--bg)",
    borderBottom: "1px solid var(--line)",
    backdropFilter: "blur(8px)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    gap: 24,
    height: 56
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: cycleAccent,
      className: "focus-ring",
      title: "Cycler la couleur d'accent",
      "aria-label": "Cycler la couleur d'accent",
      style: {
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: cycleAccent ? "pointer" : "default",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        transition: "transform 0.18s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.transform = "rotate(-12deg) scale(1.06)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "";
      }
    },
    /* @__PURE__ */ React.createElement(JDMMark, { size: 26 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("jdm:goto", { detail: { view: "projet" } }));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jdm:projet-panel", { detail: { index: 1 } }));
        }, 30);
      },
      className: "focus-ring",
      title: "Accueil — panneau Présentation",
      "aria-label": "Accueil",
      style: {
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center"
      }
    },
    /* @__PURE__ */ React.createElement(JDMWordmark, null)
  )), hubText ? /* @__PURE__ */ React.createElement("div", { style: {
    marginLeft: 12,
    alignSelf: "center",
    fontFamily: "var(--font-display)",
    fontSize: 15,
    color: "var(--ink-2)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  } }, hubText) : /* @__PURE__ */ React.createElement("nav", { style: { display: "flex", gap: 2, marginLeft: 12, overflow: "hidden", scrollbarWidth: "none" } }, items.map((it) => {
    const isActive = active === it.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: it.id,
        onClick: () => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("jdm-nav-reset", { detail: { view: it.id } }));
          }
          setActive(it.id);
          if (typeof window !== "undefined") {
            setTimeout(() => window.dispatchEvent(
              new CustomEvent("jdm-nav-reset", { detail: { view: it.id } })
            ), 0);
          }
        },
        className: "focus-ring",
        style: {
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          borderRadius: "var(--radius)",
          color: isActive ? "var(--ink)" : "var(--ink-2)",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          cursor: "pointer",
          position: "relative",
          whiteSpace: "nowrap"
        }
      },
      it.label,
      isActive && /* @__PURE__ */ React.createElement("span", { style: {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: -1,
        height: 2,
        background: "var(--accent)"
      } })
    );
  })), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" } }, !hubText && active !== "projet" && /* @__PURE__ */ React.createElement(CliCommandButton, { view: active }), setTheme && /* @__PURE__ */ React.createElement(ThemeSwitcher, { theme, setTheme }), !hubText && /* @__PURE__ */ React.createElement(ProductionsCountPill, null))));
}
const CLI_COMMANDS = {
  explorer: {
    cmd: `python -c "from jdm_agent.client import JDMClient; c=JDMClient(); print(c.relations_from('voiture').relations[:5])"`,
    hint: "Inspect direct via JDMClient — pas de CLI dédiée (cache disque inclus)."
  },
  claim: {
    cmd: 'python -m jdm_agent.apps.factcheck --claim "baleine r_isa poisson" --effort 1',
    hint: "Vérifie un triplet : SUPPORTED / CONTRADICTED / UNKNOWN avec chaîne d'évidence."
  },
  subgraph: {
    cmd: 'python -m jdm_agent.apps.viz_cli --term "voiture" --depth 2 --format html',
    hint: "Construit le voisinage sémantique en HTML autonome (vis-network)."
  },
  agent: {
    cmd: "python -m jdm_agent.apps.qa_cli --provider gemini --model gemini-3.1-flash-lite",
    hint: "REPL chat LLM avec outils JDM. ANTHROPIC_API_KEY / GOOGLE_API_KEY dans l'env."
  },
  jarvis: {
    cmd: "python -m jdm_agent.apps.enrich --terms voiture --consolidate --inference-effort 1",
    hint: "Agent Enrichissement complet — proposer, valider, consolider, écrire le .enrich."
  },
  productions: {
    cmd: "ls /tmp/jdm_outputs/ && cat /tmp/jdm_outputs/*.enrich | head -20",
    hint: "Liste les fichiers produits (.enrich/.annot/.audit/.err/.stat)."
  },
  aide: {
    cmd: "python -m jdm_agent.apps.enrich --help",
    hint: "Affiche les flags de chacune des CLI (--help fonctionne sur tous les modules)."
  }
};
async function _runExplorer() {
  const r = await fetch("api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      term: "voiture",
      relation: "r_isa",
      limit: 50,
      min_weight: 25
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function _runClaim() {
  const r = await fetch("api/factcheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: "baleine",
      relation: "r_isa",
      object: "poisson",
      effort: 1
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function _runSubgraph() {
  var _a, _b, _c, _d, _e, _f, _g;
  const r = await fetch("api/subgraph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term: "voiture", depth: 2, top_k: 3, format: "json" })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const s = d.stats || {};
  return `→ voiture · depth=2
${(_c = (_b = s.n_nodes) != null ? _b : (_a = d.nodes) == null ? void 0 : _a.length) != null ? _c : "?"} nœuds · ${(_f = (_e = s.n_edges) != null ? _e : (_d = d.edges) == null ? void 0 : _d.length) != null ? _f : "?"} arêtes · ${(_g = s.n_negative) != null ? _g : 0} négations`;
}
async function _runAgentStream() {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 1e4);
  try {
    const r = await fetch("api/chatbot/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "quels sens de voiture ?",
        model: "gemini-3.1-flash-lite",
        use_thinking: false
      }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", tools = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 8e3) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      const re = /event:\s*(\w+)\s*\ndata:\s*({.*})/g;
      let m;
      while ((m = re.exec(buf)) !== null) {
        try {
          const d = JSON.parse(m[2]);
          if (m[1] === "chunk" && d.text) text += d.text;
          else if (m[1] === "tool") tools++;
        } catch {
        }
      }
      if (text.length > 300) break;
    }
    try {
      await reader.cancel();
    } catch {
    }
    return `(premiers ${text.length} chars, ${tools} appels outils)

` + text.slice(0, 300) + (text.length > 300 ? "…" : "");
  } finally {
    clearTimeout(tid);
  }
}
async function _runJarvisStream() {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8e3);
  try {
    const r = await fetch("api/jarvis/enrich/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        params: {
          term: "voiture",
          target_count: 5,
          budget_label: "10",
          model: "gemini-3.1-flash-lite"
        }
      }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let received = "", events = 0;
    while (events < 3) {
      const { done, value } = await reader.read();
      if (done) break;
      received += dec.decode(value);
      events = (received.match(/event:/g) || []).length;
    }
    try {
      await reader.cancel();
    } catch {
    }
    const headlineMatch = received.match(/event: headline\s*\ndata: ({.*})/);
    const headline = headlineMatch ? JSON.parse(headlineMatch[1]).text : "(en cours)";
    return `Flow enrich démarré sur « voiture »
${headline}
(${events} events SSE reçus, connexion fermée — ouvrir l'onglet Jarvis pour la suite)`;
  } finally {
    clearTimeout(tid);
  }
}
async function _runProductions() {
  const r = await fetch("api/productions");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const files = d.files || [];
  if (files.length === 0) return "(aucun fichier produit pour l'instant)";
  return files.slice(0, 20).map(
    (p) => `${p.name}  ${p.size} bytes  ${p.mtime || ""}`
  ).join("\n") + (files.length > 20 ? `
… (+ ${files.length - 20} autres)` : "");
}
async function _runAide() {
  const r = await fetch("openapi.json");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const schema = await r.json();
  const lines = [];
  for (const [path, methods] of Object.entries(schema.paths || {})) {
    for (const method of Object.keys(methods)) {
      lines.push(`${method.toUpperCase().padEnd(6)} ${path}`);
    }
  }
  return lines.join("\n");
}
const REMOTE_COMMANDS = {
  explorer: {
    lang: "python",
    cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/explore", json={\n    "term": "voiture",\n    "relation": "r_isa",\n    "limit": 50,\n    "min_weight": 25\n})\nprint(r.json())',
    hint: "POST /api/explore — triplets bruts {nodes, edges, relations}.",
    runner: _runExplorer
  },
  claim: {
    lang: "python",
    cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/factcheck", json={\n    "subject": "baleine",\n    "relation": "r_isa",\n    "object": "poisson",\n    "effort": 1\n})\nprint(r.json())',
    hint: "POST /api/factcheck — verdict + chaîne d'inférence.",
    runner: _runClaim
  },
  subgraph: {
    lang: "python",
    cmd: 'import httpx\n\nr = httpx.post("http://localhost:7860/api/subgraph", json={\n    "term": "voiture",\n    "depth": 2,\n    "top_k": 3,\n    "format": "json"\n})\nprint(r.json())',
    hint: 'POST /api/subgraph — nodes/edges JSON ou HTML (format="html").',
    runner: _runSubgraph
  },
  agent: {
    lang: "python",
    cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/chatbot/stream",\n        json={"message": "quels sens de voiture ?",\n              "model": "gemini-3.1-flash-lite"}) as r:\n    for line in r.iter_lines():\n        if line.startswith("data:"): print(line[5:].strip())',
    hint: "POST /api/chatbot/stream — SSE streaming (events: chunk, tool, done).",
    runner: _runAgentStream
  },
  jarvis: {
    lang: "python",
    cmd: 'import httpx\n\nwith httpx.stream("POST", "http://localhost:7860/api/jarvis/enrich/stream",\n        json={"params": {"term": "voiture", "target_count": 20,\n                          "iterate": True, "budget_label": "50"}}) as r:\n    for line in r.iter_lines():\n        if line.startswith("event:"): print(line)',
    hint: "POST /api/jarvis/{enrich|audit|gap|annotation|stats}/stream — SSE.",
    runner: _runJarvisStream
  },
  productions: {
    lang: "python",
    cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/api/productions")\nfor p in r.json().get("files", []):\n    print(p["name"], p["size"], p["mtime"])',
    hint: "GET /api/productions — liste tous les fichiers produits.",
    runner: _runProductions
  },
  aide: {
    lang: "python",
    cmd: 'import httpx\n\nr = httpx.get("http://localhost:7860/openapi.json")\nschema = r.json()\nfor path, methods in schema["paths"].items():\n    for method in methods:\n        print(f"{method.upper():6} {path}")',
    hint: "GET /openapi.json — schéma OpenAPI complet (ou /docs pour UI Swagger).",
    runner: _runAide
  }
};
function CliTerminalBlock({ cliData, remoteData, closeable, onClose, data, onRun }) {
  const effectiveCli = cliData || data || null;
  const effectiveRemote = remoteData || null;
  const hasBoth = !!(effectiveCli && effectiveRemote);
  const [mode, setMode] = useState("cli");
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runOut, setRunOut] = useState(null);
  const rootRef = useRef(null);
  const active = mode === "remote" && effectiveRemote ? effectiveRemote : effectiveCli;
  if (!active) return null;
  const lang = active.lang || "shell";
  const handleSetMode = (m) => {
    if (m === mode) return;
    setMode(m);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (typeof scrollGroupIntoView === "function" && rootRef.current) {
          try {
            scrollGroupIntoView(rootRef.current, rootRef.current);
          } catch {
          }
        }
      }, 30);
    });
  };
  const resolvedRunner = onRun || effectiveRemote && effectiveRemote.runner || effectiveCli && effectiveCli.runner || null;
  const handleRun = async () => {
    if (!resolvedRunner || running) return;
    setRunning(true);
    setRunOut(null);
    try {
      const r = await resolvedRunner({ mode, cmd: active.cmd });
      setRunOut(typeof r === "string" ? r : r ? JSON.stringify(r, null, 2) : "(ok)");
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
    } catch {
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  const togglePillStyle = (isActive) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 18,
    padding: 0,
    background: isActive ? "rgba(125,205,255,0.20)" : "rgba(255,255,255,0.04)",
    border: "1px solid " + (isActive ? "rgba(125,205,255,0.50)" : "rgba(255,255,255,0.10)"),
    borderRadius: 3,
    color: isActive ? "#bfe6ff" : "rgba(201,204,210,0.55)",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s, border-color 0.15s"
  });
  return /* @__PURE__ */ React.createElement("div", { ref: rootRef, style: {
    background: "#1b1d22",
    border: "1px solid #2c2f36",
    borderRadius: 8,
    overflow: "hidden",
    fontFamily: "var(--font-mono)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    padding: "6px 10px",
    background: "linear-gradient(#33363d, #2a2d33)",
    borderBottom: "1px solid #14151a",
    position: "relative",
    height: 26,
    boxSizing: "border-box"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 5, position: "absolute", left: 10, top: 8 } }, closeable ? /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onClose,
      "aria-label": "Fermer",
      title: "Fermer",
      className: "focus-ring",
      style: {
        width: 9,
        height: 9,
        padding: 0,
        borderRadius: "50%",
        background: "#ff5f57",
        border: "none",
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
        cursor: "pointer"
      }
    }
  ) : /* @__PURE__ */ React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: "#ff5f57", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)" } }), /* @__PURE__ */ React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: "#febc2e", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)" } }), /* @__PURE__ */ React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: "#28c840", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)" } })), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 60,
    top: 4,
    display: "flex",
    gap: 4,
    alignItems: "center"
  } }, hasBoth && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleSetMode("cli"),
      "aria-label": "CLI",
      title: "Mode CLI (local)",
      className: "focus-ring",
      style: togglePillStyle(mode === "cli")
    },
    /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("rect", { x: "1.5", y: "3", width: "13", height: "10", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2", fill: "none" }), /* @__PURE__ */ React.createElement("path", { d: "M4 6.5 L6.5 8 L4 9.5", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "10", x2: "11.5", y2: "10", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" }))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleSetMode("remote"),
      "aria-label": "Remote",
      title: "Mode Remote (Gradio API)",
      className: "focus-ring",
      style: togglePillStyle(mode === "remote")
    },
    /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M4.4 12.5h7.2c1.6 0 2.9-1.3 2.9-2.9 0-1.5-1.1-2.7-2.6-2.9 -.4-1.7-1.9-3-3.7-3 -1.8 0-3.3 1.3-3.7 2.9 -1.5.2-2.5 1.4-2.5 2.9 0 1.6 1.3 3 2.9 3z",
        stroke: "currentColor",
        strokeWidth: "1.2",
        fill: "none",
        strokeLinejoin: "round"
      }
    ))
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleRun,
      disabled: running || !resolvedRunner,
      className: "focus-ring",
      title: !resolvedRunner ? "Pas d'exécuteur disponible pour cette commande" : mode === "remote" ? "Exécuter (Remote)" : "Exécuter (CLI)",
      "aria-label": "Exécuter la commande",
      style: {
        background: !resolvedRunner ? "rgba(255,255,255,0.04)" : running ? "rgba(125,205,255,0.10)" : "rgba(125,205,255,0.16)",
        border: "1px solid " + (!resolvedRunner ? "rgba(255,255,255,0.10)" : "rgba(125,205,255,0.40)"),
        borderRadius: 3,
        padding: "1px 6px",
        fontFamily: "inherit",
        fontSize: 9.5,
        color: !resolvedRunner ? "rgba(201,204,210,0.40)" : running ? "rgba(191,230,255,0.55)" : "#bfe6ff",
        cursor: !resolvedRunner ? "not-allowed" : running ? "wait" : "pointer",
        letterSpacing: "0.04em",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        height: 18
      }
    },
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: 8, lineHeight: 1 } }, "▶"),
    /* @__PURE__ */ React.createElement("span", null, running ? "run…" : "run")
  )), /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: "#9aa0aa",
    letterSpacing: "0.02em",
    userSelect: "none",
    paddingLeft: hasBoth ? 110 : 50
  } }, "jdm-agent — ", lang === "python" ? "python" : "bash"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: copy,
      className: "focus-ring",
      title: "Copier la commande",
      style: {
        position: "absolute",
        right: 8,
        top: 4,
        background: copied ? "rgba(40,200,64,0.18)" : "rgba(255,255,255,0.06)",
        border: "1px solid " + (copied ? "rgba(40,200,64,0.45)" : "rgba(255,255,255,0.12)"),
        borderRadius: 3,
        padding: "1px 6px",
        fontFamily: "inherit",
        fontSize: 9.5,
        color: copied ? "#7ee59a" : "#c9ccd2",
        cursor: "pointer",
        textTransform: "lowercase",
        letterSpacing: "0.04em",
        transition: "background 0.15s, color 0.15s, border-color 0.15s"
      }
    },
    copied ? "✓ copied" : "copy"
  )), /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 12px 12px",
    fontFamily: "inherit",
    fontSize: 11.5,
    lineHeight: 1.55,
    color: "#e6e8ec"
  } }, active.hint && /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7180", whiteSpace: "pre-wrap" } }, "# ", active.hint), lang === "shell" ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", marginTop: active.hint ? 4 : 0, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#7ee59a", flexShrink: 0, userSelect: "none" } }, "(jdm-agent)"), /* @__PURE__ */ React.createElement("span", { style: { color: "#5d8fd6", flexShrink: 0, userSelect: "none", marginLeft: 5 } }, "~"), /* @__PURE__ */ React.createElement("span", { style: { color: "#e6e8ec", flexShrink: 0, userSelect: "none", margin: "0 6px 0 5px" } }, "$"), /* @__PURE__ */ React.createElement("span", { style: { wordBreak: "break-word", color: "#e6e8ec" } }, active.cmd), /* @__PURE__ */ React.createElement("span", { className: "cli-caret", "aria-hidden": "true" })) : (
    // Python: render as a script (multi-line, no prompt) with subtle
    // syntax tint — keywords + strings hinted in cooler colors.
    /* @__PURE__ */ React.createElement("pre", { style: {
      margin: active.hint ? "4px 0 0" : 0,
      color: "#e6e8ec",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontFamily: "inherit",
      fontSize: "inherit",
      lineHeight: 1.6
    } }, /* @__PURE__ */ React.createElement("code", { dangerouslySetInnerHTML: { __html: highlightPython(active.cmd) } }))
  )), (running || runOut != null) && /* @__PURE__ */ React.createElement("div", { style: {
    borderTop: "1px solid #14151a",
    background: "#15171b",
    padding: "8px 12px 10px",
    fontFamily: "inherit",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#c9ccd2"
  } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7180", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 } }, running ? "↻ running…" : "↳ output"), running && runOut == null ? /* @__PURE__ */ React.createElement("div", { style: { color: "#7d8390" } }, "…") : /* @__PURE__ */ React.createElement("pre", { style: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "inherit",
    fontSize: "inherit",
    maxHeight: 220,
    overflow: "auto"
  } }, runOut)));
}
function highlightPython(src) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const highlightCode2 = (code) => {
    code = code.replace(
      /(&quot;[^&\n]*?&quot;|'[^'\n]*?')/g,
      '<span style="color:#e0c890">$1</span>'
    );
    code = code.replace(
      /\b(from|import|for|in|print|return|if|else|as|def|class|with|try|except|raise|yield|lambda)\b/g,
      '<span style="color:#c89bff">$1</span>'
    );
    code = code.replace(
      /\.(predict|submit|view_api|post|get|stream|iter_lines|startswith|strip|json|items|append|read|write|close)\b/g,
      '.<span style="color:#7ee59a">$1</span>'
    );
    return code;
  };
  return src.split("\n").map((line) => {
    let inStr = null, commentIdx = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === inStr && line[i - 1] !== "\\") inStr = null;
      } else if (c === '"' || c === "'") {
        inStr = c;
      } else if (c === "#") {
        commentIdx = i;
        break;
      }
    }
    if (commentIdx < 0) {
      return highlightCode2(esc(line));
    }
    const code = line.slice(0, commentIdx);
    const comment = line.slice(commentIdx);
    return highlightCode2(esc(code)) + '<span style="color:#6b7180">' + esc(comment) + "</span>";
  }).join("\n");
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
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!data) return null;
  return /* @__PURE__ */ React.createElement("div", { ref, style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setOpen((o) => !o),
      className: "focus-ring",
      title: "Commande CLI équivalente",
      "aria-label": "Voir la commande CLI",
      "aria-expanded": open,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        background: open ? "var(--bg-elev)" : "transparent",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: open ? "var(--ink)" : "var(--ink-2)",
        cursor: "pointer",
        transition: "background 0.12s, color 0.12s, border-color 0.12s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.color = "var(--ink)";
      },
      onMouseLeave: (e) => {
        if (!open) e.currentTarget.style.color = "var(--ink-2)";
      }
    },
    /* @__PURE__ */ React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(
      "rect",
      {
        x: "1",
        y: "2.5",
        width: "14",
        height: "11",
        rx: "1.5",
        stroke: "currentColor",
        strokeWidth: "1.2",
        fill: "none"
      }
    ), /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M4 6.5 L6.5 8 L4 9.5",
        stroke: "currentColor",
        strokeWidth: "1.3",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        fill: "none"
      }
    ), /* @__PURE__ */ React.createElement(
      "line",
      {
        x1: "8",
        y1: "10",
        x2: "11.5",
        y2: "10",
        stroke: "currentColor",
        strokeWidth: "1.3",
        strokeLinecap: "round"
      }
    ))
  ), open && /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "dialog",
      "aria-label": "Commande CLI / Remote",
      style: {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "min(540px, calc(100vw - 32px))",
        zIndex: 100,
        animation: "cli-pop 0.14s ease-out"
      }
    },
    /* @__PURE__ */ React.createElement(
      CliTerminalBlock,
      {
        cliData: CLI_COMMANDS[view],
        remoteData: REMOTE_COMMANDS[view],
        closeable: true,
        onClose: () => setOpen(false)
      }
    )
  ), /* @__PURE__ */ React.createElement("style", null, `
        @keyframes cli-pop {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `));
}
function ThemeSwitcher({ theme, setTheme }) {
  const themes = [
    {
      id: "paper",
      label: "Paper",
      icon: (
        // Sun
        /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none" }, /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "2.7", fill: "currentColor" }), Array.from({ length: 8 }).map((_, i) => {
          const a = i / 8 * Math.PI * 2;
          const x1 = 7 + Math.cos(a) * 4.4;
          const y1 = 7 + Math.sin(a) * 4.4;
          const x2 = 7 + Math.cos(a) * 6;
          const y2 = 7 + Math.sin(a) * 6;
          return /* @__PURE__ */ React.createElement(
            "line",
            {
              key: i,
              x1,
              y1,
              x2,
              y2,
              stroke: "currentColor",
              strokeWidth: "1.2",
              strokeLinecap: "round"
            }
          );
        }))
      )
    },
    {
      id: "lab",
      label: "Lab",
      icon: (
        // Eclipse — dark disc with thin crescent halo
        /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none" }, /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "6", stroke: "currentColor", strokeWidth: "0.8", opacity: "0.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "4.2", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "6.2", cy: "6.2", r: "3.5", fill: "var(--bg)" }))
      )
    }
  ];
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    padding: 3,
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    gap: 2
  } }, themes.map((t) => {
    const on = theme === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        onClick: () => setTheme(t.id),
        className: "focus-ring",
        title: t.label,
        "aria-label": `Thème ${t.label}`,
        style: {
          width: 30,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: on ? "var(--bg-card)" : "transparent",
          color: on ? "var(--ink)" : "var(--ink-3)",
          border: "1px solid " + (on ? "var(--line)" : "transparent"),
          borderRadius: "calc(var(--radius) - 2px)",
          cursor: "pointer",
          boxShadow: on ? "var(--shadow-sm)" : "none",
          transition: "background 0.12s, color 0.12s",
          padding: 0
        }
      },
      t.icon
    );
  }));
}
const JARVIS_AGENTS_TOTAL = 6;
function _interpolateColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}
function _loadGradientRGB(load) {
  const green = [78, 166, 60];
  const yellow = [212, 169, 10];
  const red = [200, 58, 115];
  if (load <= 0.5) return _interpolateColor(green, yellow, load * 2);
  return _interpolateColor(yellow, red, (load - 0.5) * 2);
}
function ProductionsCountPill() {
  const [serverActive, setServerActive] = useState(null);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.__jdmJarvisStore) return;
    return window.__jdmJarvisStore.subscribe("*", () => forceTick((t) => t + 1));
  }, []);
  useEffect(() => {
    let alive = true;
    const load2 = async () => {
      try {
        const r2 = await fetch("api/jarvis/runs");
        if (!r2.ok || !alive) return;
        const d = await r2.json();
        const runs = d.runs || [];
        const n = runs.filter((r3) => r3.status === "starting" || r3.status === "running").length;
        setServerActive(n);
      } catch {
      }
    };
    load2();
    const id = setInterval(load2, 15e3);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const localActive = typeof window !== "undefined" && window.__jdmJarvisStore ? window.__jdmJarvisStore.activeFlowIds().length : 0;
  const active = localActive > 0 ? localActive : serverActive != null ? serverActive : 0;
  const label = `${active}/${JARVIS_AGENTS_TOTAL}`;
  const load = Math.min(1, active / JARVIS_AGENTS_TOTAL);
  const [r, g, b] = _loadGradientRGB(load);
  const accentRGB = `rgb(${r}, ${g}, ${b})`;
  const fillRGBA = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const borderRGBA = `rgba(${r}, ${g}, ${b}, 0.45)`;
  const dotRGB = accentRGB;
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "focus-ring",
      onClick: () => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("jdm-goto-jarvis-supervision"));
      },
      title: active == null ? "Chargement…" : `${active} agents Jarvis actuellement en cours sur ${JARVIS_AGENTS_TOTAL} disponibles · clic pour ouvrir Supervision`,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        background: fillRGBA,
        border: "1px solid " + borderRGBA,
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        color: accentRGB,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s, color 0.2s, transform .12s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "none";
      }
    },
    /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: dotRGB } }),
    /* @__PURE__ */ React.createElement("span", null, label),
    /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.65, fontWeight: 400, textTransform: "lowercase" } }, "agents")
  );
}
function PageShell({ children }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: "32px 28px 80px"
  } }, children);
}
let _ENV_STATUS_CACHE = null;
let _ENV_STATUS_LOADERS = /* @__PURE__ */ new Set();
async function _fetchEnvStatus() {
  try {
    const r = await fetch("api/env-status");
    if (!r.ok) return {};
    const d = await r.json();
    return d.env || {};
  } catch {
    return {};
  }
}
function useEnvStatus() {
  const [env, setEnv] = useState(_ENV_STATUS_CACHE);
  useEffect(() => {
    if (_ENV_STATUS_CACHE !== null) return;
    _ENV_STATUS_LOADERS.add(setEnv);
    if (_ENV_STATUS_LOADERS.size > 1) return;
    _fetchEnvStatus().then((e) => {
      _ENV_STATUS_CACHE = e;
      _ENV_STATUS_LOADERS.forEach((s) => {
        try {
          s(e);
        } catch {
        }
      });
      _ENV_STATUS_LOADERS.clear();
    });
    return () => {
      _ENV_STATUS_LOADERS.delete(setEnv);
    };
  }, []);
  return env || {};
}
function isKeyAvailable(envStatus, name, userInput) {
  if (userInput && userInput.trim()) return true;
  return !!(envStatus && envStatus[name] && envStatus[name].set);
}
const JDM_RELATION_LABELS = {
  r_syn: "Synonymes",
  r_anto: "Antonymes",
  r_isa: "Hyperonymes — « est un »",
  r_hypo: "Hyponymes — « exemples de »",
  r_has_part: "Parties / composants",
  r_holo: "Tout / ensemble",
  r_carac: "Caractéristiques",
  r_has_color: "Couleurs",
  r_lieu: "Lieux typiques",
  r_agent: "Agents typiques (verbe)",
  r_patient: "Patients typiques (verbe)",
  r_instr: "Instruments (verbe)",
  r_telic_role: "Rôle télique — à quoi sert",
  r_has_causatif: "Causes",
  r_has_conseq: "Conséquences",
  r_but: "But",
  r_manner: "Manière (verbe / processus)"
};
const JDM_RELATION_COMMON = [
  "r_isa",
  "r_hypo",
  "r_syn",
  "r_anto",
  "r_carac",
  "r_has_part",
  "r_has_color",
  "r_lieu",
  "r_agent",
  "r_patient",
  "r_instr",
  "r_telic_role",
  "r_has_causatif",
  "r_has_conseq",
  "r_but",
  "r_manner"
];
let _JDM_RELATIONS_CACHE = null;
const _JDM_RELATIONS_LOADERS = /* @__PURE__ */ new Set();
async function _fetchJdmRelations() {
  try {
    const r = await fetch("api/relations");
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.relations) ? d.relations : [];
  } catch (e) {
    return [];
  }
}
function useJdmRelations() {
  const [rels, setRels] = useState(_JDM_RELATIONS_CACHE || []);
  useEffect(() => {
    if (_JDM_RELATIONS_CACHE) {
      setRels(_JDM_RELATIONS_CACHE);
      return;
    }
    _JDM_RELATIONS_LOADERS.add(setRels);
    if (_JDM_RELATIONS_LOADERS.size > 1) return;
    _fetchJdmRelations().then((list) => {
      _JDM_RELATIONS_CACHE = list;
      _JDM_RELATIONS_LOADERS.forEach((s) => {
        try {
          s(list);
        } catch {
        }
      });
      _JDM_RELATIONS_LOADERS.clear();
    });
    return () => {
      _JDM_RELATIONS_LOADERS.delete(setRels);
    };
  }, []);
  return rels;
}
function jdmRelationOptions(relations, fallback) {
  if (!relations || !relations.length) return fallback || [];
  const byName = {};
  for (const r of relations) {
    if (r && r.name) byName[r.name] = r;
  }
  const seen = /* @__PURE__ */ new Set();
  const opts = [];
  const push = (name) => {
    if (seen.has(name) || !byName[name]) return;
    seen.add(name);
    const friendly = JDM_RELATION_LABELS[name];
    const help = (byName[name].help || "").trim();
    opts.push(friendly ? { value: name, label: friendly, sub: name } : { value: name, label: name, sub: help || void 0 });
  };
  JDM_RELATION_COMMON.forEach(push);
  Object.keys(byName).sort().forEach(push);
  return opts;
}
Object.assign(window, {
  JDM_PALETTE,
  JDM_COLORS,
  Select,
  Field,
  Input,
  Slider,
  Button,
  Card,
  Pill,
  SectionTitle,
  EmptyState,
  Triplet,
  TopNav,
  ThemeSwitcher,
  PageShell,
  JDMMark,
  JDMWordmark,
  useEnvStatus,
  isKeyAvailable,
  useJdmRelations,
  jdmRelationOptions
});
const { useState: useStateHero, useEffect: useEffectHero, useRef: useRefHero } = React;
function HeroAnimation({
  height = 380,
  showChat = true,
  liveScenario = null,
  interactive = false,
  onNodeClick = null
}) {
  const scenarios = [
    {
      id: "voiture",
      question: 'quels sont les sens de "voiture" ?',
      streamChunks: [
        "Dans JeuxDeMots, ",
        "**voiture** est polysémique. ",
        "Quatre sens principaux sont identifiés :\n",
        "\n• **véhicule automobile**",
        " — le plus fréquent (w=842)",
        "\n• **wagon ferroviaire**",
        " — sens technique (w=312)",
        "\n• **moyen de transport**",
        " — sens générique (w=198)",
        "\n• **véhicule hippomobile**",
        " — sens historique (w=89)",
        "\n\nChacun a son propre voisinage lexical."
      ],
      graph: {
        center: "voiture",
        nodes: [
          { id: "auto", label: "automobile", angle: -60, dist: 110, color: "jdm-magenta", delay: 0.6 },
          { id: "wagon", label: "wagon", angle: 30, dist: 110, color: "jdm-cyan", delay: 1.6 },
          { id: "tpt", label: "transport", angle: 120, dist: 110, color: "jdm-green", delay: 2.3 },
          { id: "hippo", label: "hippomobile", angle: 210, dist: 110, color: "jdm-violet", delay: 3.2 },
          { id: "moteur", label: "moteur", angle: -90, dist: 180, color: "jdm-magenta", delay: 3.8, dim: true },
          { id: "roue", label: "roue", angle: -30, dist: 180, color: "jdm-magenta", delay: 4.1, dim: true },
          { id: "rail", label: "rail", angle: 60, dist: 180, color: "jdm-cyan", delay: 4.4, dim: true },
          { id: "voyage", label: "voyage", angle: 150, dist: 180, color: "jdm-green", delay: 4.7, dim: true },
          { id: "cheval", label: "cheval", angle: 240, dist: 180, color: "jdm-violet", delay: 5, dim: true }
        ],
        edges: [
          { from: "voiture", to: "auto", delay: 0.7, label: "r_raff", highlight: true },
          { from: "voiture", to: "wagon", delay: 1.7, label: "r_raff", highlight: true },
          { from: "voiture", to: "tpt", delay: 2.4, label: "r_raff", highlight: true },
          { from: "voiture", to: "hippo", delay: 3.3, label: "r_raff", highlight: true },
          { from: "auto", to: "moteur", delay: 3.9, label: "r_has_part" },
          { from: "auto", to: "roue", delay: 4.2, label: "r_has_part" },
          { from: "wagon", to: "rail", delay: 4.5, label: "r_lieu" },
          { from: "tpt", to: "voyage", delay: 4.8, label: "r_telic_role" },
          { from: "hippo", to: "cheval", delay: 5.1, label: "r_agent" }
        ]
      }
    },
    {
      id: "velo-pneu",
      question: "comment sont liés vélo et pneumatique ?",
      streamChunks: [
        "Dans JeuxDeMots, ",
        "il **n'existe pas de lien direct**",
        " entre *vélo* et *pneumatique*.\n",
        "\nMais en passant par **pneu** :\n",
        "\n• vélo `r_has_part` **pneu** (w=110)",
        "\n• pneu `r_syn` **pneumatique** (w=87)",
        "\n\nLa chaîne fait **2 sauts**.",
        " L'agent infère donc une relation indirecte."
      ],
      graph: {
        center: null,
        layout: "path",
        nodes: [
          { id: "velo", label: "vélo", x: -150, y: 0, color: "jdm-green", delay: 0.3 },
          { id: "pneu", label: "pneu", x: 0, y: 0, color: "jdm-orange", delay: 1.5 },
          { id: "pneuma", label: "pneumatique", x: 155, y: 0, color: "jdm-magenta", delay: 2.7 },
          { id: "cadre", label: "cadre", x: -195, y: -90, color: "jdm-green", delay: 3.6, dim: true },
          { id: "guidon", label: "guidon", x: -195, y: 90, color: "jdm-green", delay: 3.9, dim: true },
          { id: "caoutchouc", label: "caoutchouc", x: 200, y: -90, color: "jdm-magenta", delay: 4.3, dim: true }
        ],
        edges: [
          { from: "velo", to: "pneu", delay: 1.8, label: "r_has_part", highlight: true },
          { from: "pneu", to: "pneuma", delay: 3, label: "r_syn", highlight: true },
          { from: "velo", to: "cadre", delay: 3.7, label: "r_has_part" },
          { from: "velo", to: "guidon", delay: 4, label: "r_has_part" },
          { from: "pneuma", to: "caoutchouc", delay: 4.4, label: "r_made_of" }
        ]
      }
    }
  ];
  const [scenarioIdx, setScenarioIdx] = useStateHero(0);
  const [phase, setPhase] = useStateHero("typing");
  const [userText, setUserText] = useStateHero("");
  const [streamText, setStreamText] = useStateHero("");
  const [tick, setTick] = useStateHero(0);
  const scenario = liveScenario || scenarios[scenarioIdx];
  const graphEndTime = (() => {
    const lastNode = Math.max(...scenario.graph.nodes.map((n) => n.delay + 0.5));
    const lastEdge = scenario.graph.edges.length ? Math.max(...scenario.graph.edges.map((e) => e.delay + 0.7)) : 0;
    return Math.max(lastNode, lastEdge);
  })();
  useEffectHero(() => {
    let cancelled = false;
    const run = async () => {
      setUserText("");
      setStreamText("");
      setPhase("typing");
      setTick(0);
      if (liveScenario) {
        setPhase("streaming");
        const startTick2 = Date.now();
        const tickInterval2 = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick2) / 1e3);
        }, 80);
        await sleepHero((graphEndTime + 1) * 1e3);
        clearInterval(tickInterval2);
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
      setPhase("streaming");
      const startTick = Date.now();
      const tickInterval = setInterval(() => {
        if (!cancelled) setTick((Date.now() - startTick) / 1e3);
      }, 80);
      let acc = "";
      for (const chunk of scenario.streamChunks) {
        if (cancelled) {
          clearInterval(tickInterval);
          return;
        }
        for (let i = 0; i < chunk.length; i++) {
          acc += chunk[i];
          setStreamText(acc);
          await sleepHero(6 + Math.random() * 11);
        }
        await sleepHero(90);
      }
      clearInterval(tickInterval);
      if (cancelled) return;
      setPhase("done");
      const elapsedNow = (Date.now() - startTick) / 1e3;
      const waitForGraph = Math.max(0, graphEndTime - elapsedNow) * 1e3;
      if (waitForGraph > 0) {
        const waitTick = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick) / 1e3);
        }, 80);
        await sleepHero(waitForGraph);
        clearInterval(waitTick);
      }
      await sleepHero(1600);
      if (cancelled) return;
      setScenarioIdx((i) => (i + 1) % scenarios.length);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [scenarioIdx, liveScenario]);
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: showChat ? "minmax(0, 1.05fr) minmax(0, 1fr)" : "1fr",
    gap: 16,
    borderRadius: "var(--radius-lg)",
    height: interactive ? "100%" : "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    height: interactive ? "100%" : height,
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement(
    GraphCanvas,
    {
      scenario,
      tick,
      height,
      interactive,
      onNodeClick
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: 14,
    left: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em"
  } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: "var(--accent)" } }), "Graphe JDM · en direct")), showChat && /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    height,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 16px",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em"
  } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: "var(--jdm-green)" } }), "Chatbot LLM · démo", /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", textTransform: "none", letterSpacing: 0 } }, "gemini-3.1-flash-lite")), /* @__PURE__ */ React.createElement(ChatView, { userText, streamText, phase })));
}
function sleepHero(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function GraphCanvas({ scenario, tick, height, interactive = false, onNodeClick = null }) {
  const H = height;
  const W = interactive ? 920 : Math.round(H * 1.55);
  const cx = W / 2, cy = H / 2;
  const g = scenario.graph;
  const distScale = interactive ? 1 : Math.min(0.92, H / 430);
  const positions = {};
  if (g.center) positions[g.center] = { x: 0, y: 0 };
  g.nodes.forEach((n) => {
    if (n.x !== void 0) {
      positions[n.id] = { x: n.x * distScale, y: n.y * distScale };
    } else {
      const rad = n.angle * Math.PI / 180;
      const d = n.dist * distScale;
      positions[n.id] = { x: Math.cos(rad) * d, y: Math.sin(rad) * d };
    }
  });
  if (interactive) {
    const margX = 84, margY = 44;
    const maxX = Math.max(1, ...Object.values(positions).map((p) => Math.abs(p.x)));
    const maxY = Math.max(1, ...Object.values(positions).map((p) => Math.abs(p.y)));
    const safeX = Math.max(40, cx - margX);
    const safeY = Math.max(40, cy - margY);
    const sX = safeX / maxX;
    const sY = safeY / maxY;
    const fitScale = Math.min(sX, sY, 1.6);
    if (Math.abs(fitScale - 1) > 0.02) {
      for (const id of Object.keys(positions)) {
        positions[id] = {
          x: positions[id].x * fitScale,
          y: positions[id].y * fitScale
        };
      }
    }
  }
  const isPath = g.layout === "path";
  const breathScale = 1 + (isPath || interactive ? 4e-3 : 0.012) * Math.sin(tick * 0.6);
  const rotateAll = isPath || interactive ? 0 : tick * 1.2;
  const transform = `translate(${cx} ${cy}) rotate(${rotateAll}) scale(${breathScale})`;
  const [hoverEdge, setHoverEdge] = useStateHero(null);
  const [hoverNode, setHoverNode] = useStateHero(null);
  const edgesByNode = {};
  g.edges.forEach((e, i) => {
    (edgesByNode[e.from] = edgesByNode[e.from] || []).push(i);
    (edgesByNode[e.to] = edgesByNode[e.to] || []).push(i);
  });
  const labelOf = Object.assign({}, g._labelByRawId || {});
  if (g.center) labelOf[g.center] = g.center;
  g.nodes.forEach((n) => {
    const lbl = (n.label || "").toString().trim();
    if (lbl) labelOf[n.id] = lbl;
  });
  const neighborSummary = (nodeId) => {
    const ed = edgesByNode[nodeId] || [];
    if (!ed.length) return "";
    const CAP = 10;
    const lines = ed.slice(0, CAP).map((i) => {
      const e = g.edges[i];
      const isOut = e.from === nodeId;
      const otherId = isOut ? e.to : e.from;
      const otherLabel = labelOf[otherId] || otherId;
      const arrow = isOut ? "→" : "←";
      const wPart = e.weight !== void 0 && e.weight !== null ? `  w=${e.weight}` : "";
      const negPart = e.negative ? "  [NÉGATION]" : "";
      return `  ${arrow} [${e.label || "?"}] ${otherLabel}${wPart}${negPart}`;
    });
    if (ed.length > CAP) lines.push(`  … (+${ed.length - CAP} autres)`);
    return lines.join("\n");
  };
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      width: "100%",
      height: "100%",
      style: { display: "block" }
    },
    /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("radialGradient", { id: "hero-glow", cx: "50%", cy: "50%", r: "50%" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "var(--accent)", stopOpacity: "0.10" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "var(--accent)", stopOpacity: "0" })), Array.from(new Set(g.edges.map(
      (e) => e.color || (e.highlight ? "__accent__" : "__ink3__")
    ))).map((c) => {
      const fill = c === "__accent__" ? "var(--accent)" : c === "__ink3__" ? "var(--ink-3)" : c;
      const id = "arrow-" + (c || "none").replace(/[^a-zA-Z0-9_-]/g, "");
      return /* @__PURE__ */ React.createElement(
        "marker",
        {
          key: c,
          id,
          viewBox: "0 0 10 10",
          refX: "9",
          refY: "5",
          markerUnits: "userSpaceOnUse",
          markerWidth: "11",
          markerHeight: "11",
          orient: "auto"
        },
        /* @__PURE__ */ React.createElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill })
      );
    })),
    /* @__PURE__ */ React.createElement("circle", { cx, cy, r: Math.min(W, H) / 3, fill: "url(#hero-glow)" }),
    /* @__PURE__ */ React.createElement("g", { transform }, g.edges.map((e, i) => {
      const visible = tick >= e.delay;
      if (!visible) return null;
      const t = Math.min(1, (tick - e.delay) / 0.7);
      const a = positions[e.from], b = positions[e.to];
      if (!a || !b) return null;
      const dx = b.x - a.x, dy = b.y - a.y;
      const segLen = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const trim = interactive ? 16 : 0;
      const bx = b.x - dx / segLen * trim;
      const by = b.y - dy / segLen * trim;
      const x = a.x + (bx - a.x) * t;
      const y = a.y + (by - a.y) * t;
      const edgeColor = e.color || (e.highlight ? "var(--accent)" : "var(--ink-3)");
      const labelColor = e.color || (e.highlight ? "var(--accent)" : "var(--ink-3)");
      const adjacentHover = hoverNode != null && (e.from === hoverNode || e.to === hoverNode);
      const isHot = hoverEdge === i || adjacentHover;
      const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
      const dimmed = someHoverActive && !isHot;
      return /* @__PURE__ */ React.createElement("g", { key: i }, interactive && /* @__PURE__ */ React.createElement(
        "line",
        {
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          stroke: "transparent",
          strokeWidth: 14,
          style: { cursor: "pointer" },
          onMouseEnter: () => setHoverEdge(i),
          onMouseLeave: () => setHoverEdge((h) => h === i ? null : h)
        },
        /* @__PURE__ */ React.createElement("title", null, `${labelOf[e.from] || e.from} —[${e.label || "?"}]→ ${labelOf[e.to] || e.to}`, e.weight !== void 0 ? `  (w=${e.weight})` : "", e.negative ? "  [NÉGATION]" : "")
      ), /* @__PURE__ */ React.createElement(
        "line",
        {
          x1: a.x,
          y1: a.y,
          x2: x,
          y2: y,
          stroke: edgeColor,
          strokeWidth: isHot ? 3.2 : e.highlight ? 2 : 1.2,
          strokeOpacity: dimmed ? 0.15 : isHot ? 1 : e.color ? 0.82 : e.highlight ? 0.9 : 0.45,
          strokeLinecap: "round",
          strokeDasharray: e.negative ? "4 3" : void 0,
          markerEnd: interactive && t > 0.85 ? `url(#arrow-${(e.color || (e.highlight ? "__accent__" : "__ink3__")).replace(/[^a-zA-Z0-9_-]/g, "")})` : void 0,
          style: { pointerEvents: "none", transition: "stroke-width 0.12s, stroke-opacity 0.12s" }
        }
      ), (e.label && t > 0.6 || isHot) && /* @__PURE__ */ React.createElement(
        "text",
        {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2 - 6,
          textAnchor: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: isHot ? 11 : 9,
          fontWeight: isHot ? 700 : 400,
          fill: labelColor,
          opacity: dimmed ? 0.15 : isHot ? 1 : (t - 0.6) / 0.4,
          transform: `rotate(${-rotateAll}, ${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 6})`,
          style: { pointerEvents: "none" }
        },
        e.label
      ));
    }), g.center && /* @__PURE__ */ React.createElement(
      CenterNode,
      {
        label: g.center,
        tick,
        counterRotate: -rotateAll,
        tooltip: interactive ? (() => {
          const nb = neighborSummary(g.center);
          return nb ? `${g.center}  (centre)

Liens (${(edgesByNode[g.center] || []).length}) :
${nb}` : `${g.center}  (centre)`;
        })() : void 0
      }
    ), g.nodes.map((n, i) => {
      const p = positions[n.id];
      if (!p) return null;
      const visible = tick >= n.delay;
      if (!visible) return null;
      const t = Math.min(1, (tick - n.delay) / 0.5);
      const floatY = interactive ? 0 : Math.sin(tick * 1.2 + i) * 1.5;
      const isHot = hoverNode === n.id;
      const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
      const edgeHovered = hoverEdge != null ? g.edges[hoverEdge] : null;
      const concerned = edgeHovered && (edgeHovered.from === n.id || edgeHovered.to === n.id);
      const dimmed = someHoverActive && !isHot && !concerned;
      return /* @__PURE__ */ React.createElement(
        NodeBubble,
        {
          key: n.id,
          x: p.x,
          y: p.y + floatY,
          label: n.label,
          color: n.color,
          dim: n.dim,
          appearT: t,
          counterRotate: -rotateAll,
          interactive,
          hot: isHot || concerned,
          dimmed,
          onMouseEnter: interactive ? () => setHoverNode(n.id) : void 0,
          onMouseLeave: interactive ? () => setHoverNode((h) => h === n.id ? null : h) : void 0,
          onClick: interactive && onNodeClick ? () => onNodeClick(n) : void 0,
          tooltip: (() => {
            const head = `${n.label}${n.dist != null ? `  (depth ${n.dim ? 2 : 1})` : ""}`;
            const nb = neighborSummary(n.id);
            return nb ? `${head}

Liens (${(edgesByNode[n.id] || []).length}) :
${nb}` : head;
          })()
        }
      );
    }))
  );
}
function CenterNode({ label, tick, counterRotate, tooltip }) {
  const pulse = 0.5 + 0.5 * Math.sin(tick * 2);
  return /* @__PURE__ */ React.createElement("g", null, tooltip && /* @__PURE__ */ React.createElement("title", null, tooltip), /* @__PURE__ */ React.createElement("circle", { r: 28, fill: "var(--accent)", opacity: 0.08 + pulse * 0.06 }), /* @__PURE__ */ React.createElement("circle", { r: 20, fill: "var(--accent)", opacity: 0.18 }), /* @__PURE__ */ React.createElement("circle", { r: 13, fill: "var(--accent)" }), /* @__PURE__ */ React.createElement(
    "text",
    {
      y: 5,
      textAnchor: "middle",
      fontFamily: "var(--font-display)",
      fontSize: "13",
      fontWeight: "600",
      fill: "var(--ink)",
      transform: `rotate(${counterRotate})`
    },
    label
  ));
}
function NodeBubble({
  x,
  y,
  label,
  color,
  dim,
  appearT,
  counterRotate,
  interactive = false,
  hot = false,
  dimmed = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  tooltip
}) {
  const c = `var(--${color})`;
  const baseR = (dim ? 7 : 12) * (interactive ? 1 : 0.75);
  const r = (hot ? baseR * 1.35 : baseR) * appearT;
  const fontSize = (dim ? 11 : 13) + (hot ? 2 : 0);
  const opacity = dimmed ? 0.25 : appearT;
  const shownLabel = label && label.length > 22 ? label.slice(0, 21) + "…" : label;
  return /* @__PURE__ */ React.createElement(
    "g",
    {
      transform: `translate(${x} ${y})`,
      opacity,
      "data-node-bubble": interactive ? "1" : void 0,
      style: {
        cursor: interactive && onClick ? "pointer" : interactive ? "default" : "inherit",
        transition: "opacity 0.15s"
      },
      onMouseEnter,
      onMouseLeave,
      onClick
    },
    tooltip && /* @__PURE__ */ React.createElement("title", null, tooltip),
    interactive && /* @__PURE__ */ React.createElement("circle", { r: Math.max(r + 8, 14), fill: "transparent" }),
    /* @__PURE__ */ React.createElement("circle", { r: r + (hot ? 8 : 5), fill: c, opacity: hot ? 0.28 : 0.12 }),
    /* @__PURE__ */ React.createElement("circle", { r, fill: c, stroke: hot ? "#fff" : "none", strokeWidth: hot ? 1.5 : 0 }),
    /* @__PURE__ */ React.createElement("g", { transform: `rotate(${counterRotate})`, style: { pointerEvents: "none" } }, /* @__PURE__ */ React.createElement(
      "text",
      {
        y: r + fontSize + 4,
        textAnchor: "middle",
        fontFamily: "var(--font-sans)",
        fontSize,
        fontWeight: hot ? 700 : dim ? 400 : 600,
        fill: "var(--ink)",
        opacity: dim && !hot ? 0.7 : 1,
        style: { paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 3, strokeLinejoin: "round" }
      },
      shownLabel
    ))
  );
}
function ChatView({ userText, streamText, phase }) {
  const scrollRef = useRefHero(null);
  useEffectHero(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamText]);
  return /* @__PURE__ */ React.createElement("div", { ref: scrollRef, style: {
    flex: 1,
    padding: "16px 18px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 14
  } }, userText && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("div", { style: {
    maxWidth: "85%",
    padding: "8px 12px",
    background: "var(--accent)",
    color: "var(--bg)",
    borderRadius: "var(--radius-lg)",
    fontSize: 13,
    lineHeight: 1.45
  } }, userText, phase === "typing" && /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-block",
    width: 2,
    height: 13,
    background: "var(--bg)",
    marginLeft: 2,
    verticalAlign: "text-bottom",
    animation: "hero-caret 0.7s steps(2) infinite"
  } }))), (phase === "streaming" || phase === "done") && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 6,
    marginTop: 2,
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  } }, /* @__PURE__ */ React.createElement(JDMMark, { size: 16 })), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, streamText.length === 0 ? /* @__PURE__ */ React.createElement(TypingDots, null) : /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: "var(--ink)",
    lineHeight: 1.55
  }, dangerouslySetInnerHTML: { __html: renderStreamMd(streamText, phase === "streaming") } }))), /* @__PURE__ */ React.createElement("style", null, `
        @keyframes hero-caret { 50% { opacity: 0; } }
        @keyframes hero-typing {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
      `));
}
function TypingDots() {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, padding: "6px 0" } }, [0, 1, 2].map((i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--ink-3)",
    animation: `hero-typing 1.2s infinite ${i * 0.15}s`
  } })));
}
function renderStreamMd(s, withCaret) {
  let html = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.88em;color:var(--accent);">$1</code>').replace(/\n• /g, '<br/><span style="color:var(--accent);">•</span> ').replace(/\n/g, "<br/>");
  if (withCaret) {
    html += '<span style="display:inline-block;width:2px;height:1em;background:var(--accent);margin-left:2px;vertical-align:text-bottom;animation:hero-caret 0.7s steps(2) infinite;"></span>';
  }
  return html;
}
window.HeroAnimation = HeroAnimation;
const ACCENT_PALETTE = [
  "var(--jdm-yellow)",
  "var(--jdm-orange)",
  "var(--jdm-magenta)",
  "var(--jdm-green)",
  "var(--jdm-cyan)"
];
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
const PANELS = [
  { id: "contexte", label: "Projet", symbol: "♣" },
  { id: "hero", label: "Présentation", symbol: "♥" },
  { id: "modules", label: "Modules", symbol: "♦" },
  { id: "bref", label: "Sous le capot", symbol: "♠" }
];
function ViewProjet({ goto }) {
  const [panelIndex, setPanelIndex] = useState(1);
  const [direction, setDirection] = useState("vertical");
  const [transitioning, setTransitioning] = useState(true);
  const totalPanels = PANELS.length;
  const goToIndex = useCallback((i) => {
    setPanelIndex(Math.max(0, Math.min(totalPanels - 1, i)));
  }, [totalPanels]);
  useEffect(() => {
    const onPanel = (e) => {
      var _a;
      const i = (_a = e.detail) == null ? void 0 : _a.index;
      if (typeof i === "number") goToIndex(i);
    };
    window.addEventListener("jdm:projet-panel", onPanel);
    return () => window.removeEventListener("jdm:projet-panel", onPanel);
  }, [goToIndex]);
  const activePanel = PANELS[panelIndex].id;
  const switchTo = (newDir, targetIdx) => {
    if (direction === newDir) {
      goToIndex(targetIdx);
      return;
    }
    setTransitioning(false);
    setDirection(newDir);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
        goToIndex(targetIdx);
      });
    });
  };
  const goFromBottom = (id) => {
    const idx = PANELS.findIndex((p) => p.id === id);
    if (idx >= 0) switchTo("horizontal", idx);
  };
  const goFromLeft = (id) => {
    const idx = PANELS.findIndex((p) => p.id === id);
    if (idx >= 0) switchTo("vertical", idx);
  };
  useEffect(() => {
    let lock = false;
    let resetTimer = null;
    const onWheel = (e) => {
      let el = e.target;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
          return;
        }
        el = el.parentElement;
      }
      e.preventDefault();
      if (lock) return;
      lock = true;
      const dir = e.deltaY > 0 ? 1 : -1;
      setPanelIndex((prev) => Math.max(0, Math.min(totalPanels - 1, prev + dir)));
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        lock = false;
      }, 850);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      clearTimeout(resetTimer);
    };
  }, [totalPanels]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToIndex(panelIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToIndex(panelIndex - 1);
      } else if (e.key === "Home") {
        goToIndex(0);
      } else if (e.key === "End") {
        goToIndex(totalPanels - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelIndex, goToIndex, totalPanels]);
  useEffect(() => {
    let startY = null;
    const onStart = (e) => {
      startY = e.touches[0].clientY;
    };
    const onEnd = (e) => {
      if (startY == null) return;
      const endY = e.changedTouches[0].clientY;
      const dy = startY - endY;
      if (Math.abs(dy) > 50) {
        goToIndex(panelIndex + (dy > 0 ? 1 : -1));
      }
      startY = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [panelIndex, goToIndex]);
  const stats = [
    { label: "Termes JDM", value: "2M+", sub: "JeuxDeMots" },
    { label: "Relations", value: "180+", sub: "types typées" },
    { label: "Outils MCP", value: "35", sub: "LangChain · FastMCP" },
    { label: "Agents Jarvis", value: "5", sub: "guidés" }
  ];
  const features = [
    {
      id: "jarvis",
      title: "🤖 Jarvis",
      kind: "5 agents",
      primary: true,
      desc: "Agents guidés par formulaires (zéro prompt à taper) : Enrichissement (.enrich), Audit (.audit), Détection de trous, Signalement (.err), Statistiques.",
      example: "enrichissement → 17 triplets consolidés",
      detail: {
        lede: "Cinq workflows agentiques guidés par formulaire — pas de prompt à écrire, l'enchaînement outils + LLM + consolidation est canonique.",
        body: "Chaque agent suit un workflow déterministe (defined-in-code) avec un budget de tokens, un budget d'outils et un critère d'arrêt. Le LLM ne décide jamais seul de continuer ; il propose, le moteur consolide ou rejette.",
        quickTry: {
          kind: "select-and-term",
          options: [
            { value: "enrich", label: "Enrichissement" },
            { value: "audit", label: "Audit sémantique" },
            { value: "gap", label: "Détection de trous" },
            { value: "signalement", label: "Signalement" },
            { value: "stats", label: "Stats" }
          ],
          defaultValue: "enrich",
          termDefault: "voiture",
          // Quick-try Jarvis : hit /api/jarvis/{flow}/stream et capte
          // les 1res messages SSE (~5s) pour montrer un vrai démarrage,
          // sans laisser tourner le flow complet (budget min).
          mock: async (flow, term) => {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 8e3);
            try {
              const r = await fetch(`api/jarvis/${flow}/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  params: { term, target_count: 5, budget_label: "10", model: "gemini-3.1-flash-lite" }
                }),
                signal: ctrl.signal
              });
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const reader = r.body.getReader();
              const dec = new TextDecoder();
              let received = "", events = 0;
              while (events < 3) {
                const { done, value } = await reader.read();
                if (done) break;
                received += dec.decode(value);
                events = (received.match(/event:/g) || []).length;
              }
              try {
                await reader.cancel();
              } catch {
              }
              const headlineMatch = received.match(/event: headline\s*\ndata: ({.*})/);
              const headline = headlineMatch ? JSON.parse(headlineMatch[1]).text : "(en cours)";
              return `→ Flow ${flow} démarré sur « ${term} »
${headline}
(${events} events SSE reçus, connexion fermée — ouvrir l'onglet Jarvis pour la suite)`;
            } finally {
              clearTimeout(timeoutId);
            }
          }
        }
      }
    },
    {
      id: "chatbot",
      title: "💬 Chatbot LLM",
      kind: "LLM · BYOK",
      desc: "Conversation avec un agent (Gemini hébergé gratuit, ou BYOK Claude/GPT) qui n'utilise QUE les outils JDM et cite ses sources.",
      example: "« Que mange typiquement un chat ? »",
      detail: {
        lede: "Agent contraint à l'usage exclusif des outils JDM. Toute affirmation factuelle est appuyée par un triplet cité.",
        body: "Le modèle planifie en boucle (raisonnement → outil → observation) sans jamais répondre à partir de sa mémoire pré-entraînée seule. Si JDM ne couvre pas la question, l'agent l'explicite plutôt que d'halluciner.",
        quickTry: {
          kind: "prompt",
          placeholder: "Que mange typiquement un chat ?",
          defaultValue: "Que mange typiquement un chat ?",
          models: [
            { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash · gratuit" },
            { value: "gemini-2.0-pro", label: "Gemini 2.0 Pro · BYOK" },
            { value: "claude-4.5-sonnet", label: "Claude 4.5 Sonnet · BYOK" },
            { value: "gpt-5-mini", label: "GPT-5 mini · BYOK" },
            { value: "llama-4-70b", label: "Llama 4 70B · local" }
          ],
          defaultModel: "gemini-3.1-flash-lite",
          // Quick-try Chatbot : appel SSE /api/chatbot/stream, capture les
          // premiers chunks de la réponse (~10s max) puis ferme.
          mock: async (q, model) => {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 12e3);
            try {
              const r = await fetch("api/chatbot/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: q, model, use_thinking: false }),
                signal: ctrl.signal
              });
              if (!r.ok) throw new Error(`HTTP ${r.status} — vérifier la clé API du modèle`);
              const reader = r.body.getReader();
              const dec = new TextDecoder();
              let buf = "", text = "", toolCalls = 0;
              const t0 = Date.now();
              while (Date.now() - t0 < 1e4) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value);
                const re = /event:\s*(\w+)\s*\ndata:\s*({.*})/g;
                let m;
                while ((m = re.exec(buf)) !== null) {
                  try {
                    const d = JSON.parse(m[2]);
                    if (m[1] === "chunk" && d.text) text += d.text;
                    else if (m[1] === "tool") toolCalls++;
                  } catch {
                  }
                }
                if (text.length > 400) break;
              }
              try {
                await reader.cancel();
              } catch {
              }
              return `${model} (premiers ${text.length} chars, ${toolCalls} appels outils)

${text.slice(0, 400)}${text.length > 400 ? "…" : ""}`;
            } finally {
              clearTimeout(tid);
            }
          }
        }
      }
    },
    {
      id: "subgraph",
      title: "🕸️ Sous-graphe",
      kind: "visuel",
      desc: "Visualisation interactive (vis-network) du voisinage sémantique d'un terme jusqu'à profondeur 4, sélection de relations indépendante par niveau, négations en rouge.",
      example: "plat asiatique · depth 1 · 8 relations",
      detail: {
        lede: "Sous-graphe lexico-sémantique d'un terme, filtré par relation et par profondeur — un instrument de lecture, pas seulement de visualisation.",
        body: "Construit un HTML autonome (zéro requête externe) qui peut être archivé dans un dépôt de publication. Palette par famille de relation, négations marquées en rouge, opacité dégradée par profondeur.",
        quickTry: {
          kind: "term-and-depth",
          termDefault: "voiture",
          depthDefault: 2,
          // Quick-try Sous-graphe : appel /api/subgraph format=json,
          // affiche les compteurs réels nodes/edges/negatives.
          mock: async (term, depth) => {
            var _a, _b, _c, _d, _e;
            const r = await fetch("api/subgraph", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ term, depth, top_k: 3, format: "json" })
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            const s = d.stats || {};
            const n = (_b = s.n_nodes) != null ? _b : ((_a = d.nodes) == null ? void 0 : _a.length) || 0;
            const e = (_d = s.n_edges) != null ? _d : ((_c = d.edges) == null ? void 0 : _c.length) || 0;
            const neg = (_e = s.n_negative) != null ? _e : 0;
            return `→ ${term} · depth=${depth}
${n} nœuds · ${e} arêtes · ${neg} négations
Ouvrir l'onglet Sous-graphe pour le rendu interactif.`;
          }
        }
      }
    },
    {
      id: "claim",
      title: "⚖️ Claim checker",
      kind: "déterministe",
      desc: "Vérifie une affirmation factuelle contre JDM de façon déterministe (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN avec citations des triplets utilisés.",
      example: "baleine | r_isa | poisson → ❌",
      detail: {
        lede: "Vérification déterministe d'un triplet contre JDM — pas de LLM dans la boucle de jugement, le verdict est rejouable et auditable.",
        body: "L'effort de vérification est paramétrable (0 = match direct ; 1 = contenance ; 2+ = inférence transitive bornée). Chaque verdict est accompagné de la chaîne d'évidence (triplets cités, poids).",
        quickTry: {
          kind: "triplet",
          defaults: { s: "baleine", r: "r_isa", o: "mammifère" },
          // Quick-try Claim checker : POST /api/factcheck avec effort=1
          // (déduction par inférence). Renvoie {verdict, confidence,
          // chain, note} comme attendu par ClaimVerdictHeader/Chain.
          mock: async (s, r, o) => {
            var _a;
            const resp = await fetch("api/factcheck", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject: s,
                relation: r,
                object: o,
                effort: 1
              })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const d = await resp.json();
            const chain = (d.evidence || []).map((ev) => ({
              from: ev.subject || ev.source,
              rel: ev.relation,
              to: ev.target || ev.object,
              w: Math.round(Math.abs(ev.weight || 0)),
              neg: !!ev.negative
            }));
            return {
              verdict: d.status || d.verdict || "UNKNOWN",
              confidence: (_a = d.confidence) != null ? _a : 0,
              triplet: { s, r, o },
              chain,
              note: d.explanation || d.note || (d.inference_schema ? `Inféré via schéma ${d.inference_schema}` : "Contenance directe JDM")
            };
          }
        }
      }
    },
    {
      id: "explorer",
      title: "🔎 Explorer JDM",
      kind: "instant",
      desc: "Choisis un terme et une relation, vois les triplets triés par poids consensuel. Annotations sémantiques (constitutif, contrastif, exception…) optionnelles. Désambiguïsation des termes polysémiques (avocat, souris, police…).",
      example: "chat | r_has_part | ?",
      detail: {
        lede: "Table déterministe des triplets d'un terme pour une relation — l'instrument le plus simple pour inspecter JDM.",
        body: "Tri par poids consensuel décroissant. Désambiguïsation polysémique optionnelle (avocat, souris, police…). Annotations sémantiques (constitutif, contrastif, exception).",
        quickTry: {
          kind: "term-and-relation",
          termDefault: "chat",
          relationDefault: "r_has_part",
          // Quick-try Explorer : POST /api/explore et formate les 3
          // premiers triplets par poids décroissant.
          mock: async (term, rel) => {
            const r = await fetch("api/explore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                term,
                relation: rel,
                limit: 20,
                min_weight: 25
              })
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            const triplets = d.triplets || d.relations || [];
            if (triplets.length === 0) {
              return `→ ${term} | ${rel} → aucun triplet (≥ poids 25). Essayer min_weight=0 ou un autre terme.`;
            }
            const top = triplets.slice(0, 3).map((t) => {
              var _a, _b;
              const tgt = t.target || t.target_display || t.to || "?";
              const w = (_b = (_a = t.w) != null ? _a : t.weight) != null ? _b : 0;
              return `${tgt} (w=${Math.round(Math.abs(w))})`;
            }).join(" · ");
            return `→ ${term} | ${rel} → ${triplets.length} triplets
Top 3 : ${top}`;
          }
        }
      }
    }
  ];
  const briefs = [
    {
      title: "Client typé + cache disque",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "Couche client ", /* @__PURE__ */ React.createElement("code", null, "JDMClient"), " sur l'", /* @__PURE__ */ React.createElement("a", { href: "https://jdm-api.demo.lirmm.fr", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--accent)" } }, "API JeuxDeMots"), ", cache disque, retry exponentiel."),
      // ── Detail panel content ─────────────────────────────────────────
      detail: {
        kicker: "Reproductibilité · Abstraction typée",
        lede: "Une couche d'abstraction Python entre l'agent et l'API JeuxDeMots — pas un wrapper trivial, mais un substrat qui rend les workflows agentiques auditables, déterministes et rejouables.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Les ", /* @__PURE__ */ React.createElement("em", null, "workflows agentiques"), " souffrent classiquement d'un problème de reproductibilité : un même prompt produit des appels API distincts à chaque exécution, rendant l'audit et la régression difficiles. Le client typé matérialise chaque réponse JDM en objet Python (", /* @__PURE__ */ React.createElement("code", null, "Term"), ", ", /* @__PURE__ */ React.createElement("code", null, "Relation"), ", ", /* @__PURE__ */ React.createElement("code", null, "Triplet"), "), sérialisé sur disque dans un cache LRU adressé par hash de requête."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Cette indirection ouvre trois bénéfices : ", /* @__PURE__ */ React.createElement("strong", null, "hors-ligne"), " (un workflow déjà exécuté peut être rejoué sans accès réseau), ", /* @__PURE__ */ React.createElement("strong", null, "idempotence"), " (deux runs du même flow produisent strictement le même artefact), ", /* @__PURE__ */ React.createElement("strong", null, "traçabilité"), " (chaque triplet consolidé pointe vers la requête API qui l'a produit, avec timestamp et version du cache).")
        ],
        citations: [
          { author: "Lafourcade, M.", year: 2007, title: "Making people play for Lexical Acquisition with the JeuxDeMots prototype", venue: "SNLP'07, Pattaya" },
          { author: "Schick, T. et al.", year: 2023, title: "Toolformer: Language Models Can Teach Themselves to Use Tools", venue: "NeurIPS" },
          { author: "Anthropic", year: 2024, title: "Model Context Protocol — Specification", venue: "Technical Report" }
        ],
        cta: { label: "Voir le client sur GitHub →", href: "https://github.com/expAg/JDMAgent" }
      }
    },
    {
      title: "~35 outils MCP exposés",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "À n'importe quel client (Claude Code/Desktop, Cursor, etc.) via ", /* @__PURE__ */ React.createElement("a", { href: "https://github.com/jlowin/fastmcp", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--accent)" } }, "FastMCP"), "."),
      detail: {
        kicker: "Interopérabilité · Outils standardisés",
        lede: "Le Model Context Protocol comme standard d'accès à une base de connaissance lexico-sémantique — une trentaine d'outils typés exposés à tout client compatible (Claude Code, Claude Desktop, Cursor, OpenAI Realtime…).",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "L'exposition MCP transforme JeuxDeMots d'une API REST traditionnelle en un ", /* @__PURE__ */ React.createElement("em", null, "knowledge backend"), " consultable nativement par les agents LLM. Chaque outil porte une ", /* @__PURE__ */ React.createElement("strong", null, "signature typée"), " (Pydantic) et une ", /* @__PURE__ */ React.createElement("strong", null, "docstring discriminante"), " — le LLM choisit l'outil par similarité sémantique sans heuristique côté serveur."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Le découpage suit la sémantique JDM, pas l'API : ", /* @__PURE__ */ React.createElement("code", null, "get_relations(term, relation_type)"), " plutôt qu'un endpoint paramétrique générique. Cela réduit l'espace de décision du modèle et accroît la précision du tool-calling — un effet documenté par ", /* @__PURE__ */ React.createElement("em", null, "Patil et al. (2024)"), " dans l'évaluation de Gorilla.")
        ],
        citations: [
          { author: "Patil, S.G. et al.", year: 2024, title: "Gorilla: Large Language Model Connected with Massive APIs", venue: "NeurIPS" },
          { author: "Yao, S. et al.", year: 2023, title: "ReAct: Synergizing Reasoning and Acting in Language Models", venue: "ICLR" },
          { author: "Lafourcade, M. & Joubert, A.", year: 2008, title: "Une approche lexico-sémantique du jeu pour l'acquisition de connaissances", venue: "TALN" }
        ],
        cta: { label: "Lire l'USAGE MCP →", href: "https://github.com/expAg/JDMAgent/blob/main/USAGE.md" }
      }
    },
    {
      title: "Pipeline fact-check + inférence",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "Détermination + détection de gaps + ", /* @__PURE__ */ React.createElement("strong", null, "moteur d'inférence symbolique borné"), " pour la consolidation des candidats avant soumission au canal contributif LLMDrops de JDM."),
      detail: {
        kicker: "Neuro-symbolique · Consolidation",
        lede: "Au cœur du projet : un pipeline neuro-symbolique qui mobilise un LLM pour proposer des connaissances, puis un moteur d'inférence borné pour vérifier, contraindre et consolider avant écriture dans la base.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "L'agent illustre une instance pragmatique de l'", /* @__PURE__ */ React.createElement("em", null, "approche neuro-symbolique"), " formalisée par ", /* @__PURE__ */ React.createElement("strong", null, "Garcez & Lamb (2020)"), " : le LLM joue le rôle de ", /* @__PURE__ */ React.createElement("em", null, "générateur sous-contraint"), " (créativité, formulation, désambiguïsation), tandis que le moteur d'inférence sur la base JDM joue le rôle de ", /* @__PURE__ */ React.createElement("em", null, "vérificateur formel"), " (cohérence, antonymie, transitivité bornée)."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "La consolidation procède en trois passes : ", /* @__PURE__ */ React.createElement("strong", null, "(i) génération"), " — le modèle propose ", /* @__PURE__ */ React.createElement("code", null, "n"), " triplets candidats pour un terme cible ; ", /* @__PURE__ */ React.createElement("strong", null, "(ii) vérification"), " — chaque candidat est soumis au claim-checker déterministe (chaîne d'inférence ≤ k, contradiction explicite, sub-graphe d'évidence) ; ", /* @__PURE__ */ React.createElement("strong", null, "(iii) annotation"), " — les triplets survivants sont étiquetés (légitime, contrastif, sens-spécifique) puis sérialisés dans le format de soumission JDM (canal LLMDrops)."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Cette architecture évite à la fois l'écueil des ", /* @__PURE__ */ React.createElement("em", null, "hallucinations symboliques pures"), " (génération sans LLM = peu inventive) et celui des ", /* @__PURE__ */ React.createElement("em", null, "hallucinations neurales"), " (LLM sans contrôle symbolique = injection de bruit dans la base).")
        ],
        citations: [
          { author: "d'Avila Garcez, A. & Lamb, L.C.", year: 2020, title: "Neurosymbolic AI: The 3rd Wave", venue: "arXiv:2012.05876" },
          { author: "Hitzler, P. & Sarker, M.K.", year: 2021, title: "Neuro-Symbolic Artificial Intelligence: The State of the Art", venue: "IOS Press" },
          { author: "Marcus, G.", year: 2020, title: "The Next Decade in AI: Four Steps Towards Robust AI", venue: "arXiv:2002.06177" },
          { author: "Pan, S. et al.", year: 2024, title: "Unifying Large Language Models and Knowledge Graphs: A Roadmap", venue: "IEEE TKDE" }
        ],
        cta: { label: "Comprendre le pipeline →", href: "https://github.com/expAg/JDMAgent/blob/main/docs/pipeline.md" }
      }
    },
    {
      title: "Sous-graphe HTML autonome",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "vis-network avec sélection de relations par niveau, palette par famille de relation, opacité progressive."),
      detail: {
        kicker: "Explicabilité · Graphes lexico-sémantiques",
        lede: "Visualisation du voisinage sémantique comme outil d'explicabilité : le chercheur ou le contributeur voit pourquoi un triplet a été retenu ou rejeté, sans relancer l'agent.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "JeuxDeMots compte ~2 millions de termes et 180+ relations typées et pondérées (", /* @__PURE__ */ React.createElement("em", null, "Lafourcade, 2007"), "). Naviguer ce graphe à profondeur ≥ 2 sans filtrage produit des sous-graphes hyper-denses inutilisables visuellement (densité moyenne > 80 arcs/nœud sur les termes-vedettes)."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Le module construit un sous-graphe avec ", /* @__PURE__ */ React.createElement("strong", null, "sélection indépendante par profondeur"), " et ", /* @__PURE__ */ React.createElement("strong", null, "palette par famille de relation"), " — choix de design issus des conventions de visualisation de graphes lexicaux (", /* @__PURE__ */ React.createElement("em", null, "Crouch et al., 2019"), "). L'HTML produit est ", /* @__PURE__ */ React.createElement("strong", null, "autonome"), " (zéro requête externe) pour rester archivable dans un dépôt de publication.")
        ],
        citations: [
          { author: "Lafourcade, M.", year: 2007, title: "Making people play for Lexical Acquisition", venue: "SNLP'07" },
          { author: "Crouch, R. et al.", year: 2019, title: "Lexical Semantics in the Age of LLMs", venue: "CL Journal" },
          { author: "Almeida, A. & Lafourcade, M.", year: 2015, title: "Sentiment polarity and term relevance in JeuxDeMots", venue: "LREC" }
        ],
        cta: { label: "Ouvrir le module Sous-graphe →", goto: "subgraph" }
      }
    }
  ];
  const briefsContexte = [
    {
      title: "Présentation de JeuxDeMots",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "Réseau lexico-sémantique du français (LIRMM/CNRS, depuis 2007) : ~2 M nœuds, 180+ relations typées ", /* @__PURE__ */ React.createElement("strong", null, "pondérées et orientées"), ", avec des garde-fous internes (inverses, contradictions, inférences)."),
      detail: {
        kicker: "Ressource · Réseau lexico-sémantique",
        lede: "JDM construit une vaste base de connaissances, de sens commun comme de spécialité, à l'aide de jeux, de la contribution collective et de mécanismes d'inférence.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Le réseau repose sur des relations typées (lexicales, sémantiques, ontologiques, rôles sémantiques, etc.), ", /* @__PURE__ */ React.createElement("strong", null, "orientées et pondérées"), " : le poids reflète la force d'association entre deux termes."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Deux caractéristiques le rendent particulièrement intéressant pour un usage symbolique. D'abord, un ", /* @__PURE__ */ React.createElement("strong", null, "poids négatif y exprime une impossibilité"), ", et certains nœuds distinguent les différents usages d'un même terme (par exemple « avocat » fruit ou justice). Ensuite, la base intègre des garde-fous internes : la redondance entre relations inverses permet de ", /* @__PURE__ */ React.createElement("strong", null, "détecter automatiquement des contradictions"), ", et un module d'inférence enrichit le réseau tout en signalant les anomalies."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "JDM offre ainsi un substrat structuré, vérifiable et déjà partiellement auto-correcteur.")
        ],
        citations: [
          { author: "Lafourcade, M.", year: 2007, title: "Making people play for Lexical Acquisition with the JeuxDeMots prototype", venue: "SNLP'07, Pattaya" },
          { author: "Lafourcade, M. & Le Brun, N.", year: 2020, title: "JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d'inférences", venue: "Lexique, 27, 47-86" }
        ],
        cta: { label: "Site officiel JeuxDeMots →", href: "https://www.jeuxdemots.org" }
      }
    },
    {
      title: "Le projet d'agentification",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "Intégrer JDM dans une architecture ", /* @__PURE__ */ React.createElement("strong", null, "neuro-symbolique"), " où il coopère avec des IA génératives — non plus ressource consultée, mais agent actif qui ", /* @__PURE__ */ React.createElement("em", null, "propose, conteste et arbitre"), "."),
      detail: {
        kicker: "Architecture · Neuro-symbolique",
        lede: "Le composant neuronal (LLM) apporte la flexibilité, la couverture lexicale et la capacité langagière ; la couche symbolique (le réseau et son moteur d'inférence) apporte la rigueur logique, la traçabilité et la correction.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "L'idée directrice est la ", /* @__PURE__ */ React.createElement("strong", null, "complémentarité des deux paradigmes"), ". Dans ce schéma, JDM n'est plus une simple ressource consultée, mais un agent actif qui propose, conteste et arbitre."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Trois finalités structurent la coopération : ", /* @__PURE__ */ React.createElement("strong", null, "découvrir"), " de nouvelles connaissances, les ", /* @__PURE__ */ React.createElement("strong", null, "contrôler"), ", puis les ", /* @__PURE__ */ React.createElement("strong", null, "consolider"), "."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Les trois enjeux clés de cette agentification sont détaillés dans les cartes suivantes : la sécurisation des apports des LLM, l'explicabilité comme outil de diagnostic, et l'orchestration des agents.")
        ],
        citations: [
          { author: "Magana Vsevolodovna, R. I. et al.", year: 2025, title: "Enhancing Large Language Models through Neuro-Symbolic Integration and Ontological Reasoning", venue: "arXiv:2504.07640" }
        ]
      }
    },
    {
      title: "LLM contributeurs & garde-fous symboliques",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "Faire générer des relations candidates par un LLM est utile mais risqué. La solution : ", /* @__PURE__ */ React.createElement("strong", null, "valider chaque apport par une couche symbolique"), " — graphe de connaissances comme vérificateur d'exactitude."),
      detail: {
        kicker: "Enjeu 1 · Sécurisation",
        lede: "À l'inverse des LLM, un graphe de connaissances offre une exactitude vérifiée et évite les hallucinations. Le LLM produit, le symbolique valide.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "L'approche ", /* @__PURE__ */ React.createElement("strong", null, "ATA"), " illustre ce principe : le LLM traduit une spécification informelle en base formelle vérifiable, ce qui permet d'écarter les hallucinations en amont. Un ", /* @__PURE__ */ React.createElement("em", null, "raisonneur ontologique"), " peut ensuite détecter les incohérences, puis renvoyer au LLM une explication corrective dans une ", /* @__PURE__ */ React.createElement("strong", null, "boucle itérative"), "."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Au niveau des relations elles-mêmes, ", /* @__PURE__ */ React.createElement("strong", null, "OMNIA"), " enchaîne génération de candidats et double validation, par plongements puis par LLM."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Ce contrôle est d'autant plus nécessaire dans JDM qu'", /* @__PURE__ */ React.createElement("strong", null, "une erreur initiale peut s'y propager par inférence"), " en erreurs secondaires.")
        ],
        citations: [
          { author: "Peer, D. & Stabinger, S.", year: 2025, title: "ATA: A Neuro-Symbolic Approach to Implement Autonomous and Trustworthy Agents", venue: "arXiv:2510.16381" },
          { author: "Magana Vsevolodovna, R. I. et al.", year: 2025, title: "Enhancing Large Language Models through Neuro-Symbolic Integration and Ontological Reasoning", venue: "arXiv:2504.07640" },
          { author: "OMNIA", year: 2026, title: "Closing the Loop by Leveraging LLMs for Knowledge Graph Completion", venue: "arXiv:2603.11820" },
          { author: "Lafourcade, M. & Le Brun, N.", year: 2020, title: "JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d'inférences", venue: "Lexique, 27, 47-86" }
        ]
      }
    },
    {
      title: "Explicabilité : « trous » & « bosses »",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "L'explicabilité est l'", /* @__PURE__ */ React.createElement("strong", null, "outil de diagnostic"), " de la base. Elle révèle deux défauts : la ", /* @__PURE__ */ React.createElement("em", null, "complétion"), " vise les connaissances manquantes (trous), la ", /* @__PURE__ */ React.createElement("em", null, "détection d'erreurs"), " les assertions fausses (bosses)."),
      detail: {
        kicker: "Enjeu 2 · Diagnostic",
        lede: "Un système neuro-symbolique permet de remonter à la règle exacte qui a conduit à une décision, même si la fidélité de ces explications reste un défi ouvert.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Deux défauts sont bien identifiés dans la littérature : la ", /* @__PURE__ */ React.createElement("strong", null, "complétion"), " (Paulheim, 2017) cible les connaissances manquantes, et la ", /* @__PURE__ */ React.createElement("strong", null, "détection d'erreurs"), " les assertions fausses. Ce sont les ", /* @__PURE__ */ React.createElement("em", null, "« trous » (lacunes)"), " et les ", /* @__PURE__ */ React.createElement("em", null, "« bosses » (informations présentes mais erronées ou mal classées)"), "."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Leur traitement s'organise en trois étapes : ", /* @__PURE__ */ React.createElement("strong", null, "détecter, corriger, puis raisonner malgré l'incohérence"), ". À l'inférence, un raisonneur peut tester chaque prédiction et filtrer celles qui produisent une incohérence logique."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "JDM amorce déjà cette boucle : l'IA qui examine le réseau repère les problèmes et propose des parties pour les résoudre.")
        ],
        citations: [
          { author: "Herron, D., Jiménez-Ruiz, E. & Weyde, T.", year: 2025, title: "On the Potential of Logic and Reasoning in Neurosymbolic Systems Using OWL-Based Knowledge Graphs", venue: "Neurosymbolic AI / SAGE" },
          { author: "Paulheim, H.", year: 2017, title: "Knowledge Graph Refinement: A Survey of Approaches and Evaluation Methods", venue: "Semantic Web Journal" },
          { author: "Survey", year: 2025, title: "Dealing with Inconsistency for Reasoning over Knowledge Graphs", venue: "arXiv:2502.19023" },
          { author: "Lafourcade, M. & Le Brun, N.", year: 2020, title: "JeuxDeMots : un réseau lexico-sémantique pour le français, issu de jeux et d'inférences", venue: "Lexique, 27, 47-86" }
        ]
      }
    },
    {
      title: "Collaboration, compétition, orchestration",
      body: /* @__PURE__ */ React.createElement(React.Fragment, null, "La co-construction multi-agents repose sur trois régimes : ", /* @__PURE__ */ React.createElement("strong", null, "compétition, collaboration, coordination"), ". Multiplier les agents n'améliore pas mécaniquement la performance — il faut un orchestrateur."),
      detail: {
        kicker: "Enjeu 3 · Orchestration",
        lede: "Les gains du multi-agents ne sont pas automatiques : multiplier les agents n'améliore pas forcément la performance, et un débat mal structuré peut enfermer le groupe dans une erreur commune.",
        paragraphs: [
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Pour la construction de graphes, ", /* @__PURE__ */ React.createElement("strong", null, "CooperKGC"), " (Ye et al., 2023) montre qu'une équipe d'agents spécialisés, travaillant par tours successifs, améliore la sélection et la correction des connaissances. La compétition entre modèles doit néanmoins être encadrée : il faut ", /* @__PURE__ */ React.createElement("strong", null, "écarter les associations qui amplifient les erreurs"), "."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "L'orchestration la plus avancée vise une ", /* @__PURE__ */ React.createElement("strong", null, "synergie cognitive"), " : dans ", /* @__PURE__ */ React.createElement("strong", null, "OSC"), " (Zhang et al., 2025), chaque agent modélise l'état de ses collaborateurs et adapte ses échanges pour réduire la redondance avant de converger."),
          /* @__PURE__ */ React.createElement(React.Fragment, null, "Pour JDM, cela suggère trois rôles : des agents qui ", /* @__PURE__ */ React.createElement("strong", null, "génèrent"), " (découverte), des agents critiques qui ", /* @__PURE__ */ React.createElement("strong", null, "mettent à l'épreuve"), " (exposition des « bosses »), et un ", /* @__PURE__ */ React.createElement("strong", null, "orchestrateur symbolique"), " qui arbitre par l'inférence et les pondérations.")
        ],
        citations: [
          { author: "Preprint", year: 2025, title: "Multi-Agent LLM Systems: From Emergent Collaboration to Structured Collective Intelligence", venue: "Preprints.org 202511.1370" },
          { author: "Ye, H. et al.", year: 2023, title: "Beyond Isolation: Multi-Agent Synergy for Improving Knowledge Graph Construction (CooperKGC)", venue: "arXiv:2312.03022" },
          { author: "Survey", year: 2025, title: "Multi-LLM Collaboration Strategy", venue: "2025" },
          { author: "Zhang, J. et al.", year: 2025, title: "OSC: Cognitive Orchestration through Dynamic Knowledge Alignment in Multi-Agent LLM Collaboration", venue: "arXiv:2509.04876" }
        ]
      }
    }
  ];
  const panelBasis = `${100 / totalPanels}%`;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(NavLeftRail, { activePanel, onSelect: goFromLeft }), /* @__PURE__ */ React.createElement(NavBottomDots, { activePanel, onSelect: goFromBottom }), /* @__PURE__ */ React.createElement("style", null, `
        @media (max-width: 720px) {
          nav[aria-label="Navigation entre panneaux bas"] {
            bottom: 14px !important;
            transform: translateX(-50%) scale(0.85) !important;
            transform-origin: bottom center !important;
          }
        }
      `), /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    height: "calc(100vh - 56px)",
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: direction === "vertical" ? `${totalPanels * 100}%` : "100%",
    width: direction === "vertical" ? "100%" : `${totalPanels * 100}%`,
    display: "flex",
    flexDirection: direction === "vertical" ? "column" : "row",
    transform: direction === "vertical" ? `translate3d(0, -${panelIndex / totalPanels * 100}%, 0)` : `translate3d(-${panelIndex / totalPanels * 100}%, 0, 0)`,
    transition: transitioning ? "transform 0.85s cubic-bezier(0.65, 0, 0.35, 1)" : "none",
    willChange: "transform"
  } }, /* @__PURE__ */ React.createElement(CarouselPanel, { flexBasis: panelBasis }, /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    flexDirection: "column",
    gap: 28
  } }, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Projet",
      title: "Le projet en bref",
      desc: "Cadre neuro-symbolique d'agentification du réseau lexico-sémantique JeuxDeMots, articulant la générativité des LLM et la validation par inférence symbolique, pour la découverte, le contrôle explicable et la consolidation coopérative d'une base de connaissances de sens commun — l'explicabilité y opérant à la fois comme garde-fou contre l'hallucination et comme instrument de diagnostic des lacunes et des erreurs du réseau."
    }
  ), /* @__PURE__ */ React.createElement(ExpandableBriefsGrid, { briefs: briefsContexte, goto }))), /* @__PURE__ */ React.createElement(CarouselPanel, { flexBasis: panelBasis }, /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    flexDirection: "column",
    gap: "clamp(20px, 3vh, 36px)"
  } }, /* @__PURE__ */ React.createElement(HeroAnimation, { height: Math.min(320, Math.round(window.innerHeight * 0.34)) }), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
    gap: 48,
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    marginBottom: 14
  } }, "LIRMM · CNRS · Université de Montpellier"), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    fontFamily: "var(--font-display)",
    margin: 0,
    fontSize: "clamp(32px, 4.5vw, 56px)",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
    color: "var(--ink)"
  } }, "Agent ", /* @__PURE__ */ React.createElement("em", { style: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    color: "var(--accent)"
  } }, "Jarvis"), " :", /* @__PURE__ */ React.createElement("br", null), "Plateforme web."), /* @__PURE__ */ React.createElement("p", { style: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 1.55,
    color: "var(--ink-2)",
    maxWidth: "52ch"
  } }, "Projet d'agentification de la ressource lexico-sémantique", " ", /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://www.jeuxdemots.org",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "JeuxDeMots"
  ), " ", "(LIRMM/CNRS, ~2 M nœuds, 180+ relations typées et pondérées) pour les", " ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "LLM modernes"), " via", " ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "LangChain"), " et le", " ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Model Context Protocol"), "."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(Button, { onClick: () => goto("jarvis") }, "Jarvis →"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => goto("chatbot") }, "Discuter avec JDM"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => goto("subgraph") }, "Visualiser"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => goto("explorer") }, "Explorer"))), /* @__PURE__ */ React.createElement(StatsGrid, { stats })))), /* @__PURE__ */ React.createElement(CarouselPanel, { flexBasis: panelBasis }, /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    flexDirection: "column",
    gap: 32
  } }, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Que peux-tu faire sur cette page ?",
      title: /* @__PURE__ */ React.createElement(React.Fragment, null, "Fonctionnalités de l'API :", /* @__PURE__ */ React.createElement("br", null), "Utilisation CLI, distant (à venir)"),
      desc: "Chaque fonctionnalité est accessible via remote API et en ligne de commande."
    }
  ), /* @__PURE__ */ React.createElement(ExpandableFeaturesPanel, { features, goto }))), /* @__PURE__ */ React.createElement(CarouselPanel, { flexBasis: panelBasis }, /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    flexDirection: "column",
    gap: 28
  } }, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Sous le capot",
      title: "Le projet en bref",
      desc: "Quatre piliers techniques qui rendent l'agent fiable, reproductible et accessible à toute la chaîne d'outils LLM modernes."
    }
  ), /* @__PURE__ */ React.createElement(ExpandableBriefsGrid, { briefs, goto }), /* @__PURE__ */ React.createElement("div", { style: {
    padding: 24,
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius-lg)",
    display: "flex",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 240 } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 6
  } }, /* @__PURE__ */ React.createElement(GitHubMark, { size: 20 }), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://github.com/expAg/JDMAgent",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--ink)", textDecoration: "none" }
    },
    "Projet open-source"
  )), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-2)" } }, "Données : ", /* @__PURE__ */ React.createElement("strong", null, "JeuxDeMots"), " — Mathieu Lafourcade, équipe SLICE, LIRMM/CNRS."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 } }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://github.com/expAg/JDMAgent",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "Code source"
  ), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "·"), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://github.com/expAg/JDMAgent/blob/main/USAGE.md",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "USAGE.md"
  ), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "·"), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "Notebook Colab"
  )))))))));
}
function CarouselPanel({ children, flexBasis = "33.3333%" }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    flex: `0 0 ${flexBasis}`,
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "40px 28px 110px",
    overflow: "auto"
  } }, children);
}
function PanelDots({ activePanel, onSelect }) {
  const [style, setStyle] = useState(
    () => typeof window !== "undefined" && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle || "bottom"
  );
  useEffect(() => {
    const sync = () => setStyle(
      window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle || "bottom"
    );
    window.addEventListener("__jdm_tweaks_changed", sync);
    return () => window.removeEventListener("__jdm_tweaks_changed", sync);
  }, []);
  if (style === "left") return /* @__PURE__ */ React.createElement(NavLeftRail, { activePanel, onSelect });
  return /* @__PURE__ */ React.createElement(NavBottomDots, { activePanel, onSelect });
}
function NavBottomDots({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({
      x: ir.left - cr.left + cont.scrollLeft,
      w: ir.width,
      ready: true
    });
  }, [activePanel]);
  useEffect(() => {
    const onResize = () => {
      const activeEl = itemRefs.current[activePanel];
      const cont = containerRef.current;
      if (!activeEl || !cont) return;
      const cr = cont.getBoundingClientRect();
      const ir = activeEl.getBoundingClientRect();
      setIndicator((prev) => ({ ...prev, x: ir.left - cr.left, w: ir.width }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activePanel]);
  return /* @__PURE__ */ React.createElement(
    "nav",
    {
      ref: containerRef,
      "aria-label": "Navigation entre panneaux bas",
      onMouseEnter: (e) => {
        e.currentTarget.style.opacity = "1";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.opacity = "0.5";
      },
      style: {
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 6,
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        boxShadow: "var(--shadow)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 40,
        opacity: 0.5,
        transition: "opacity 0.22s ease-out"
      }
    },
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
      position: "absolute",
      left: indicator.x,
      width: indicator.w,
      top: 6,
      bottom: 6,
      background: "var(--accent)",
      borderRadius: 999,
      opacity: indicator.ready ? 1 : 0,
      transition: "left 0.42s cubic-bezier(0.4, 0, 0.2, 1), width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s",
      zIndex: 0
    } }),
    PANELS.map((p, i) => {
      const active = activePanel === p.id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: p.id,
          ref: (el) => {
            if (el) itemRefs.current[p.id] = el;
          },
          type: "button",
          onClick: () => onSelect(p.id),
          "aria-label": `Aller à ${p.label}`,
          style: {
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            background: "transparent",
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            color: active ? "var(--bg)" : "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: active ? 600 : 400,
            transition: "color 0.32s 0.05s",
            // léger délai pour matcher l'arrivée du pill
            whiteSpace: "nowrap"
          }
        },
        /* @__PURE__ */ React.createElement("span", { style: {
          fontFamily: "var(--font-display)",
          fontSize: 13,
          opacity: active ? 0.95 : 0.55,
          fontWeight: 600,
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1
        } }, p.symbol),
        /* @__PURE__ */ React.createElement("span", null, p.label)
      );
    })
  );
}
function NavLeftRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  const [mode, setMode] = useState("full");
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel, mode]);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      let next = w >= 1440 ? "full" : w >= 1180 ? "compact" : "hidden";
      if (next !== "hidden") {
        const heroTextEl = document.querySelector("main h1.display");
        if (heroTextEl) {
          const r = heroTextEl.getBoundingClientRect();
          const railEdge = 32 + (next === "full" ? 170 : 50);
          if (r.left < railEdge + 24) {
            if (next === "full") {
              const compactEdge = 32 + 50;
              next = r.left < compactEdge + 24 ? "hidden" : "compact";
            } else {
              next = "hidden";
            }
          }
        }
      }
      setMode(next);
    };
    compute();
    window.addEventListener("resize", compute);
    const id = setInterval(compute, 800);
    return () => {
      window.removeEventListener("resize", compute);
      clearInterval(id);
    };
  }, []);
  if (mode === "hidden") return null;
  const compact = mode === "compact";
  return /* @__PURE__ */ React.createElement(
    "nav",
    {
      ref: containerRef,
      "aria-label": "Navigation entre panneaux gauche",
      style: {
        position: "fixed",
        left: compact ? 24 : 32,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        zIndex: 40,
        borderLeft: "1px solid var(--line)",
        paddingLeft: compact ? 10 : 16
      }
    },
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
      position: "absolute",
      left: -1,
      top: indicator.y,
      height: indicator.h,
      width: 2,
      background: "var(--accent)",
      opacity: indicator.ready ? 1 : 0,
      transition: "top 0.42s cubic-bezier(0.4, 0, 0.2, 1), height 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s"
    } }),
    PANELS.map((p) => /* @__PURE__ */ React.createElement(
      PanelNavItem,
      {
        key: p.id,
        ref: (el) => {
          if (el) itemRefs.current[p.id] = el;
        },
        symbol: p.symbol,
        label: p.label,
        showLabel: !compact,
        active: activePanel === p.id,
        onClick: () => onSelect(p.id)
      }
    ))
  );
}
const PanelNavItem = React.forwardRef(function PanelNavItem2({ symbol, label, showLabel, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? "var(--accent)" : hover ? "var(--ink)" : "var(--ink-3)";
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ref,
      type: "button",
      onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      "aria-label": `Aller à ${label}`,
      title: !showLabel ? label : void 0,
      style: {
        background: "transparent",
        border: "none",
        padding: showLabel ? "16px 0" : "14px 0",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        position: "relative",
        color,
        transition: "color 0.32s",
        fontFamily: "inherit"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      fontFamily: "var(--font-display)",
      fontSize: showLabel ? 22 : 18,
      fontWeight: 600,
      lineHeight: 1,
      color: "inherit"
    } }, symbol),
    showLabel && /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "inherit",
      fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap"
    } }, label)
  );
});
function BackToTopBtn({ visible, onClick }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick,
      "aria-label": "Revenir en haut",
      title: "Revenir en haut",
      style: {
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: visible ? "translate(-50%, 0)" : "translate(-50%, 24px)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        borderRadius: 999,
        border: "1px solid var(--line)",
        background: "var(--bg-card)",
        color: "var(--ink)",
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        boxShadow: "var(--shadow)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "opacity 0.25s, transform 0.25s, background 0.15s, color 0.15s",
        zIndex: 45
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.background = "var(--accent)";
        e.currentTarget.style.color = "var(--bg)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = "var(--bg-card)";
        e.currentTarget.style.color = "var(--ink)";
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, lineHeight: 1 } }, "↑"),
    "Revenir en haut"
  );
}
function StatsGrid({ stats }) {
  const colors = useShuffledAccents(stats.length);
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 1,
    background: "var(--line)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden"
  } }, stats.map((s, i) => /* @__PURE__ */ React.createElement(StatTile, { key: s.label, stat: s, hoverColor: colors[i] })));
}
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
    el.addEventListener("scroll", updateBounds, { passive: true });
    window.addEventListener("resize", updateBounds);
    return () => {
      el.removeEventListener("scroll", updateBounds);
      window.removeEventListener("resize", updateBounds);
    };
  }, [updateBounds]);
  const animFrameRef = useRef(null);
  const animScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
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
        el.style.scrollSnapType = prevSnap || "x mandatory";
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };
  React.useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);
  const btnStyle = (enabled) => ({
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid var(--line)",
    background: "var(--bg-card)",
    color: "var(--ink-2)",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? "auto" : "none",
    boxShadow: "var(--shadow)",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 500,
    transition: "background 0.15s, color 0.15s, transform 0.18s, opacity 0.25s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)"
  });
  const hoverIn = (e) => {
    e.currentTarget.style.background = "var(--accent)";
    e.currentTarget.style.color = "var(--bg)";
    e.currentTarget.style.transform = "translateY(-50%) scale(1.08)";
  };
  const hoverOut = (e) => {
    e.currentTarget.style.background = "var(--bg-card)";
    e.currentTarget.style.color = "var(--ink-2)";
    e.currentTarget.style.transform = "translateY(-50%)";
  };
  return /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => animScroll(-1),
      "aria-label": "Défiler à gauche",
      onMouseEnter: hoverIn,
      onMouseLeave: hoverOut,
      style: {
        ...btnStyle(canPrev),
        position: "absolute",
        left: -56,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 6
      }
    },
    "‹"
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: scrollRef,
      className: `jdm-carousel ${canNext ? "jdm-carousel--fade-right" : ""}`,
      style: {
        display: "flex",
        gap: 14,
        overflowX: "auto",
        // Padding vertical = breathing room pour le hover lift + son
        // ombre. Margin négative compense pour conserver l'alignement
        // visuel avec les autres éléments de la page.
        padding: "14px 4px",
        margin: "-14px -4px",
        scrollSnapType: "x mandatory"
      }
    },
    features.map((f, i) => /* @__PURE__ */ React.createElement("div", { key: f.id, style: {
      flex: "0 0 clamp(280px, 28vw, 340px)",
      scrollSnapAlign: "start",
      display: "flex",
      transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
    } }, /* @__PURE__ */ React.createElement(FeatureCard, { f, onClick: () => onCardClick(f.id), hoverColor: colors[i], selected: expandedId === f.id })))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => animScroll(1),
      "aria-label": "Défiler à droite",
      onMouseEnter: hoverIn,
      onMouseLeave: hoverOut,
      style: {
        ...btnStyle(canNext),
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 6
      }
    },
    "›"
  ));
}
function FeatureCard({ f, onClick, hoverColor, selected }) {
  const [hovering, setHovering] = useState(false);
  const primary = !!f.primary;
  const bg = primary ? "color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)" : "var(--bg-card)";
  const inkColor = primary ? "var(--bg)" : "var(--ink)";
  const ink2Color = primary ? "rgba(255,255,255,0.88)" : "var(--ink-2)";
  const ink3Color = primary ? "rgba(255,255,255,0.72)" : "var(--ink-3)";
  const borderColor = selected ? "var(--accent)" : primary ? "color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)" : hovering ? hoverColor : "var(--line)";
  const shadow = selected ? "0 8px 22px -10px var(--accent)" : hovering ? primary ? "0 10px 24px -10px var(--accent)" : `0 6px 18px -8px ${hoverColor}` : "none";
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick,
      className: "focus-ring",
      tabIndex: 0,
      onKeyDown: (e) => {
        if (e.key === "Enter") onClick && onClick();
      },
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
      style: {
        background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
        borderRadius: "var(--radius-lg)",
        padding: 22,
        cursor: "pointer",
        transform: hovering ? "translateY(-2px)" : "none",
        transition: "transform 0.18s, border-color 0.18s, box-shadow 0.18s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
        position: "relative",
        overflow: "hidden"
      }
    },
    primary && /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      position: "absolute",
      top: 10,
      right: 10,
      fontSize: 9,
      color: "rgba(255,255,255,0.85)",
      background: "rgba(0,0,0,0.18)",
      padding: "2px 8px",
      borderRadius: 999,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontWeight: 600
    } }, "★ principal"),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: primary ? inkColor : hovering ? hoverColor : "var(--ink)",
      transition: "color 0.18s"
    } }, f.title), !primary && /* @__PURE__ */ React.createElement(Pill, null, f.kind), primary && /* @__PURE__ */ React.createElement("span", { style: {
      padding: "3px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.18)",
      color: "#fff",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      fontWeight: 500
    } }, f.kind)),
    /* @__PURE__ */ React.createElement("p", { style: {
      margin: 0,
      fontSize: 13,
      color: ink2Color,
      lineHeight: 1.55,
      flex: 1
    } }, f.desc),
    /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 11,
      color: primary ? ink3Color : hovering ? hoverColor : "var(--ink-3)",
      paddingTop: 10,
      borderTop: `1px dashed ${primary ? "rgba(255,255,255,0.30)" : hovering ? hoverColor : "var(--line-soft)"}`,
      transition: "color 0.18s, border-top-color 0.18s"
    } }, f.example)
  );
}
function findScrollableParent(el) {
  let p = el && el.parentElement;
  while (p) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowY)) return p;
    p = p.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}
function scrollGroupIntoView(topEl, detailEl, gap = 18, duration = 520) {
  if (!topEl) return;
  const scroller = findScrollableParent(topEl);
  if (!scroller) return;
  const contentEl = detailEl && detailEl.querySelector("[data-detail-content]");
  const extraHeight = contentEl ? contentEl.getBoundingClientRect().height : 0;
  const sRect = scroller.getBoundingClientRect();
  const tRect = topEl.getBoundingClientRect();
  const topInScroll = tRect.top - sRect.top + scroller.scrollTop;
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
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    scroller.scrollTop = start + (target - start) * ease(t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function ExpandableFeaturesPanel({ features, goto }) {
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId((prev) => prev === id ? null : id);
  const expanded = expandedId ? features.find((f) => f.id === expandedId) : null;
  const gridRef = useRef(null);
  const detailRef = useRef(null);
  useEffect(() => {
    if (!expandedId) return;
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(gridRef.current, detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedId]);
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 18 } }, /* @__PURE__ */ React.createElement("div", { ref: gridRef }, /* @__PURE__ */ React.createElement(FeaturesGrid, { features, onCardClick: toggle, expandedId })), /* @__PURE__ */ React.createElement("div", { ref: detailRef }, /* @__PURE__ */ React.createElement(FeatureDetailPanel, { f: expanded, goto, onClose: () => setExpandedId(null) })));
}
function FeatureDetailPanel({ f, goto, onClose }) {
  var _a, _b, _c;
  const lastFRef = useRef(null);
  if (f) lastFRef.current = f;
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const open = !!f;
  const shown = lastFRef.current;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onTransitionEnd: (e) => {
        if (!open && e.target === e.currentTarget && lastFRef.current) {
          lastFRef.current = null;
          forceRender();
        }
      },
      style: {
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 0.32s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s",
        opacity: open ? 1 : 0
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { minHeight: 0, overflow: "hidden" } }, shown && /* @__PURE__ */ React.createElement("div", { "data-detail-content": true, style: {
      background: "var(--bg-card)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-lg)",
      padding: 24,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
      gap: 28,
      position: "relative"
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onClose,
        "aria-label": "Refermer le panneau",
        className: "focus-ring",
        style: {
          position: "absolute",
          top: 12,
          right: 12,
          background: "transparent",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          width: 26,
          height: 26,
          padding: 0,
          color: "var(--ink-3)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          zIndex: 2
        }
      },
      "×"
    ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12
    } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 11,
      color: "var(--accent)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontWeight: 600
    } }, shown.title, " · détail")), /* @__PURE__ */ React.createElement("p", { className: "display", style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      lineHeight: 1.25,
      marginBottom: 12
    } }, (_a = shown.detail) == null ? void 0 : _a.lede), /* @__PURE__ */ React.createElement("p", { style: {
      margin: 0,
      fontSize: 14,
      lineHeight: 1.6,
      color: "var(--ink-2)",
      marginBottom: 18
    } }, (_b = shown.detail) == null ? void 0 : _b.body), /* @__PURE__ */ React.createElement(Button, { onClick: () => goto(shown.id) }, "Aller au module ", shown.title.replace(/^[^\s]+\s/, ""), " →")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 10,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      marginBottom: 8
    } }, "Essai rapide"), /* @__PURE__ */ React.createElement(ModuleQuickTryAndCli, { moduleId: shown.id, config: (_c = shown.detail) == null ? void 0 : _c.quickTry }))))
  );
}
function ModuleQuickTry({ config, form, setForm, onNavigate, onRunInline }) {
  if (!config) return null;
  switch (config.kind) {
    case "select-and-term":
      return /* @__PURE__ */ React.createElement(QTSelectAndTerm, { config, form, setForm, onNavigate });
    case "prompt":
      return /* @__PURE__ */ React.createElement(QTPrompt, { config, form, setForm, onNavigate });
    case "term-and-depth":
      return /* @__PURE__ */ React.createElement(QTTermAndDepth, { config, form, setForm, onNavigate });
    case "triplet":
      return /* @__PURE__ */ React.createElement(QTTriplet, { config, form, setForm, onRunInline });
    case "term-and-relation":
      return /* @__PURE__ */ React.createElement(QTTermAndRelation, { config, form, setForm, onNavigate });
    default:
      return null;
  }
}
function initFormState(config) {
  var _a, _b;
  if (!config) return {};
  switch (config.kind) {
    case "select-and-term":
      return { flow: config.defaultValue, term: config.termDefault };
    case "prompt":
      return { q: config.defaultValue, model: config.defaultModel || ((_b = (_a = config.models) == null ? void 0 : _a[0]) == null ? void 0 : _b.value) };
    case "term-and-depth":
      return { term: config.termDefault, depth: config.depthDefault };
    case "triplet":
      return { s: config.defaults.s, r: config.defaults.r, o: config.defaults.o };
    case "term-and-relation":
      return { term: config.termDefault, rel: config.relationDefault };
    default:
      return {};
  }
}
function formToArgs(form, kind) {
  switch (kind) {
    case "select-and-term":
      return [form.flow, form.term];
    case "prompt":
      return [form.q, form.model];
    case "term-and-depth":
      return [form.term, form.depth];
    case "triplet":
      return [form.s, form.r, form.o];
    case "term-and-relation":
      return [form.term, form.rel];
    default:
      return [];
  }
}
function ModuleQuickTryAndCli({ moduleId, config }) {
  const [form, setForm] = useState(() => initFormState(config));
  const lastIdRef = useRef(moduleId);
  useEffect(() => {
    if (lastIdRef.current !== moduleId) {
      lastIdRef.current = moduleId;
      setForm(initFormState(config));
    }
  }, [moduleId, config]);
  const onRun = (config == null ? void 0 : config.mock) ? async ({ mode }) => {
    const args = formToArgs(form, config.kind);
    const r = await config.mock(...args);
    if (typeof r === "string") return r;
    if (r == null) return "(ok)";
    try {
      return JSON.stringify(r, null, 2);
    } catch {
      return String(r);
    }
  } : null;
  const onNavigate = () => {
    const detail = { view: moduleId, payload: form };
    if (form.term) detail.term = form.term;
    window.dispatchEvent(new CustomEvent("jdm:goto", { detail }));
  };
  const onRunInline = (config == null ? void 0 : config.mock) ? async () => {
    const args = formToArgs(form, config.kind);
    return await config.mock(...args);
  } : null;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    ModuleQuickTry,
    {
      config,
      form,
      setForm,
      onNavigate,
      onRunInline
    }
  ), (CLI_COMMANDS[moduleId] || REMOTE_COMMANDS[moduleId]) && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement(
    CliTerminalBlock,
    {
      cliData: CLI_COMMANDS[moduleId],
      remoteData: REMOTE_COMMANDS[moduleId],
      onRun
    }
  )));
}
const QT_PANEL = {
  background: "var(--bg-elev)",
  border: "1px solid var(--line-soft)",
  borderRadius: "var(--radius)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10
};
function QTPreview({ text, node, onClose }) {
  const content = node != null ? node : text;
  if (!content) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-2)",
    background: "var(--bg-card)",
    border: "1px dashed var(--line)",
    borderRadius: 4,
    padding: "8px 10px",
    lineHeight: 1.5,
    wordBreak: "break-word",
    position: "relative"
  } }, onClose && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onClose,
      "aria-label": "Fermer le résultat",
      title: "Fermer",
      className: "focus-ring",
      style: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 18,
        height: 18,
        padding: 0,
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 3,
        color: "var(--ink-3)",
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
      }
    },
    "×"
  ), /* @__PURE__ */ React.createElement("div", { style: { paddingRight: onClose ? 24 : 0 } }, content));
}
const VERDICT_STYLES = {
  SUPPORTED: { color: "var(--jdm-green)", bg: "rgba(78,166,60,0.15)", border: "rgba(78,166,60,0.45)" },
  CONTRADICTED: { color: "var(--jdm-magenta)", bg: "rgba(200,58,115,0.15)", border: "rgba(200,58,115,0.45)" },
  UNKNOWN: { color: "var(--jdm-yellow)", bg: "rgba(212,169,10,0.15)", border: "rgba(212,169,10,0.45)" }
};
function VerdictPill({ verdict }) {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-block",
    padding: "1px 7px",
    background: s.bg,
    border: `1px solid ${s.border}`,
    color: s.color,
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.04em"
  } }, verdict);
}
function ClaimVerdictHeader({ result }) {
  if (!result) return null;
  const { verdict, triplet } = result;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "→"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, triplet.s), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "|"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, triplet.r), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "|"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, triplet.o), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "→"), /* @__PURE__ */ React.createElement(VerdictPill, { verdict }));
}
function ClaimVerdictChain({ result }) {
  if (!result) return null;
  const { verdict, chain, confidence, note } = result;
  const vStyle = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  if ((!chain || chain.length === 0) && !note && confidence == null) return null;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, chain && chain.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    paddingLeft: 8,
    borderLeft: `2px solid ${vStyle.border}`,
    color: "var(--ink-2)",
    display: "flex",
    flexDirection: "column",
    gap: 2
  } }, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 } }, "Schéma d'inférence"), chain.map((step, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, i === chain.length - 1 ? "└─" : "├─"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, step.from), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "──"), /* @__PURE__ */ React.createElement("span", { style: { color: step.neg ? "var(--jdm-magenta)" : "var(--accent)" } }, step.rel), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "→"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, step.to), step.w != null && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", marginLeft: "auto", fontSize: 10 } }, "w=", step.w)))), (confidence != null || note) && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    color: "var(--ink-3)",
    fontSize: 10
  } }, note && /* @__PURE__ */ React.createElement("span", null, note), confidence != null && /* @__PURE__ */ React.createElement("span", null, "confidence = ", confidence.toFixed(2))));
}
function ClaimVerdictBlock({ result }) {
  if (!result) return null;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement(ClaimVerdictHeader, { result }), /* @__PURE__ */ React.createElement(ClaimVerdictChain, { result }));
}
function QTRunButton({ onClick, label = "Tester" }) {
  return /* @__PURE__ */ React.createElement("div", { style: { alignSelf: "flex-start" } }, /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick }, label));
}
function QTSelectAndTerm({ config, form, setForm, onNavigate }) {
  return /* @__PURE__ */ React.createElement("div", { style: QT_PANEL }, /* @__PURE__ */ React.createElement(Select, { value: form.flow, onChange: (v) => setForm((s) => ({ ...s, flow: v })), options: config.options }), /* @__PURE__ */ React.createElement(Input, { value: form.term, onChange: (v) => setForm((s) => ({ ...s, term: v })), placeholder: "terme" }), /* @__PURE__ */ React.createElement(QTRunButton, { onClick: onNavigate, label: "Préparer dans Jarvis" }));
}
function QTPrompt({ config, form, setForm, onNavigate }) {
  return /* @__PURE__ */ React.createElement("div", { style: QT_PANEL }, config.models && /* @__PURE__ */ React.createElement(Select, { value: form.model, onChange: (v) => setForm((s) => ({ ...s, model: v })), options: config.models }), /* @__PURE__ */ React.createElement(Input, { value: form.q, onChange: (v) => setForm((s) => ({ ...s, q: v })), placeholder: config.placeholder }), /* @__PURE__ */ React.createElement(QTRunButton, { onClick: onNavigate, label: "Ouvrir le chat" }));
}
function QTTermAndDepth({ config, form, setForm, onNavigate }) {
  return /* @__PURE__ */ React.createElement("div", { style: QT_PANEL }, /* @__PURE__ */ React.createElement(Input, { value: form.term, onChange: (v) => setForm((s) => ({ ...s, term: v })), placeholder: "terme" }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", minWidth: 78 } }, "profondeur"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(Slider, { min: 1, max: 4, step: 1, value: form.depth, onChange: (v) => setForm((s) => ({ ...s, depth: v })) }))), /* @__PURE__ */ React.createElement(QTRunButton, { onClick: onNavigate, label: "Construire" }));
}
function QTTriplet({ config, form, setForm, onRunInline }) {
  var _a;
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const isVerdict = out && typeof out === "object";
  const rootRef = useRef(null);
  const tailRef = useRef(null);
  const onVerify = async () => {
    if (!onRunInline || loading) return;
    setLoading(true);
    try {
      const r = await onRunInline();
      setOut(r);
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (rootRef.current && typeof scrollGroupIntoView === "function") {
            try {
              scrollGroupIntoView(rootRef.current, tailRef.current || rootRef.current);
            } catch {
            }
          }
        }, 30);
      });
    } catch (e) {
      setOut(`⚠️ ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { ref: rootRef, style: QT_PANEL }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 } }, /* @__PURE__ */ React.createElement(Input, { value: form.s, onChange: (v) => setForm((st) => ({ ...st, s: v })), placeholder: "sujet" }), /* @__PURE__ */ React.createElement(Input, { value: form.r, onChange: (v) => setForm((st) => ({ ...st, r: v })), placeholder: "relation" }), /* @__PURE__ */ React.createElement(Input, { value: form.o, onChange: (v) => setForm((st) => ({ ...st, o: v })), placeholder: "objet" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { alignSelf: "flex-start" } }, /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: onVerify, disabled: loading }, loading ? "⏳ vérification…" : "Vérifier")), out && /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, isVerdict ? /* @__PURE__ */ React.createElement(QTPreview, { node: /* @__PURE__ */ React.createElement(ClaimVerdictHeader, { result: out }), onClose: () => setOut(null) }) : /* @__PURE__ */ React.createElement(QTPreview, { text: out, onClose: () => setOut(null) }))), isVerdict && (((_a = out.chain) == null ? void 0 : _a.length) > 0 || out.note || out.confidence != null) && /* @__PURE__ */ React.createElement("div", { ref: tailRef, "data-detail-content": true }, /* @__PURE__ */ React.createElement(QTPreview, { node: /* @__PURE__ */ React.createElement(ClaimVerdictChain, { result: out }) })));
}
function QTTermAndRelation({ config, form, setForm, onNavigate }) {
  return /* @__PURE__ */ React.createElement("div", { style: QT_PANEL }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, /* @__PURE__ */ React.createElement(Input, { value: form.term, onChange: (v) => setForm((s) => ({ ...s, term: v })), placeholder: "terme" }), /* @__PURE__ */ React.createElement(Input, { value: form.rel, onChange: (v) => setForm((s) => ({ ...s, rel: v })), placeholder: "relation" })), /* @__PURE__ */ React.createElement(QTRunButton, { onClick: onNavigate, label: "Lister" }));
}
function ExpandableBriefsGrid({ briefs, goto }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [slotIdx, setSlotIdx] = useState(null);
  const [cols, setCols] = useState(1);
  const expanded = expandedIdx == null ? null : briefs[expandedIdx];
  const toggle = (i) => {
    if (expandedIdx === i) {
      setExpandedIdx(null);
    } else {
      setExpandedIdx(i);
      setSlotIdx(i);
    }
  };
  const cardRefs = useRef({});
  const detailRef = useRef(null);
  const gridRef = useRef(null);
  React.useLayoutEffect(() => {
    const measure = () => {
      const els = briefs.map((_, i) => cardRefs.current[i]).filter(Boolean);
      if (!els.length) return;
      const top0 = els[0].offsetTop;
      const c = els.filter((el) => el.offsetTop === top0).length;
      if (c > 0 && c !== cols) setCols(c);
    };
    measure();
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [briefs.length, cols]);
  const detailInsertAfterIdx = slotIdx == null ? -1 : Math.min(briefs.length - 1, (Math.floor(slotIdx / Math.max(1, cols)) + 1) * cols - 1);
  useEffect(() => {
    if (expandedIdx == null) return;
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(cardRefs.current[expandedIdx], detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedIdx]);
  const renderDetail = /* @__PURE__ */ React.createElement("div", { ref: detailRef, style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement(
    BriefDetailPanel,
    {
      brief: expanded,
      index: expandedIdx,
      goto,
      onClose: () => setExpandedIdx(null),
      onClosed: () => setSlotIdx(null)
    }
  ));
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { ref: gridRef, style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12
  } }, briefs.map((b, i) => {
    const isOpen = expandedIdx === i;
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: (el) => {
          if (el) cardRefs.current[i] = el;
        },
        onClick: () => toggle(i),
        onKeyDown: (e) => {
          if (e.key === "Enter") toggle(i);
        },
        className: "focus-ring",
        tabIndex: 0,
        style: {
          background: "var(--bg-card)",
          border: "1px solid " + (isOpen ? "var(--accent)" : "var(--line)"),
          borderRadius: "var(--radius-lg)",
          padding: 20,
          cursor: "pointer",
          position: "relative",
          boxShadow: isOpen ? "0 6px 18px -10px var(--accent)" : "none",
          transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
          transform: isOpen ? "translateY(-1px)" : "none"
        }
      },
      /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
        fontSize: 11,
        color: isOpen ? "var(--accent)" : "var(--ink-3)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 8,
        fontWeight: 600,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, "0", i + 1), /* @__PURE__ */ React.createElement("span", { style: {
        fontSize: 10,
        color: isOpen ? "var(--accent)" : "var(--ink-3)",
        letterSpacing: "0.08em"
      } }, isOpen ? "— refermer" : "déplier +")),
      /* @__PURE__ */ React.createElement("div", { className: "display", style: {
        fontFamily: "var(--font-display)",
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 8,
        color: "var(--ink)"
      } }, b.title),
      /* @__PURE__ */ React.createElement("p", { style: {
        margin: 0,
        fontSize: 13,
        color: "var(--ink-2)",
        lineHeight: 1.55
      } }, b.body)
    ), detailInsertAfterIdx === i && renderDetail);
  })));
}
function BriefDetailPanel({ brief, index, goto, onClose, onClosed }) {
  var _a, _b, _c, _d, _e, _f;
  const lastBriefRef = useRef(null);
  const lastIndexRef = useRef(index);
  if (brief) {
    lastBriefRef.current = brief;
    lastIndexRef.current = index;
  }
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const open = !!brief;
  const shown = lastBriefRef.current;
  const shownIndex = lastIndexRef.current;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onTransitionEnd: (e) => {
        if (!open && e.target === e.currentTarget && lastBriefRef.current) {
          lastBriefRef.current = null;
          forceRender();
          if (typeof onClosed === "function") onClosed();
        }
      },
      style: {
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 0.34s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s",
        opacity: open ? 1 : 0
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { minHeight: 0, overflow: "hidden" } }, shown && /* @__PURE__ */ React.createElement("div", { "data-detail-content": true, style: {
      background: "var(--bg-card)",
      border: "1px solid var(--line)",
      borderLeft: "3px solid var(--accent)",
      borderRadius: "var(--radius-lg)",
      padding: "22px 26px 0",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      overflow: "hidden"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 11,
      color: "var(--accent)",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      fontWeight: 600
    } }, "0", (shownIndex != null ? shownIndex : 0) + 1, " · ", (_a = shown.detail) == null ? void 0 : _a.kicker), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onClose,
        "aria-label": "Refermer le panneau",
        className: "focus-ring",
        style: {
          background: "transparent",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          width: 26,
          height: 26,
          padding: 0,
          color: "var(--ink-3)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1
        }
      },
      "×"
    )), /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
      gap: 32,
      alignItems: "start"
    } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "display", style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      lineHeight: 1.3,
      marginBottom: 14
    } }, (_b = shown.detail) == null ? void 0 : _b.lede), (((_c = shown.detail) == null ? void 0 : _c.paragraphs) || []).map((p, i) => /* @__PURE__ */ React.createElement("p", { key: i, style: {
      margin: "0 0 12px",
      fontSize: 14,
      lineHeight: 1.65,
      color: "var(--ink-2)",
      fontFamily: "var(--font-serif)"
    } }, p)), ((_d = shown.detail) == null ? void 0 : _d.cta) && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, shown.detail.cta.goto ? /* @__PURE__ */ React.createElement(Button, { onClick: () => goto(shown.detail.cta.goto) }, shown.detail.cta.label) : /* @__PURE__ */ React.createElement(
      "a",
      {
        href: shown.detail.cta.href,
        target: "_blank",
        rel: "noopener noreferrer",
        style: { textDecoration: "none" }
      },
      /* @__PURE__ */ React.createElement(Button, { variant: "secondary" }, shown.detail.cta.label)
    ))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 10,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      marginBottom: 10
    } }, "Bibliographie convoquée"), /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 } }, (((_e = shown.detail) == null ? void 0 : _e.citations) || []).map((c, i) => /* @__PURE__ */ React.createElement("li", { key: i, style: {
      fontSize: 12.5,
      lineHeight: 1.5,
      color: "var(--ink-2)",
      paddingLeft: 12,
      borderLeft: "2px solid var(--line-soft)"
    } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", fontWeight: 500 } }, c.author), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " (", c.year, ")"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)" } }, c.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", marginTop: 2 } }, c.venue)))))), /* @__PURE__ */ React.createElement(CitationsMarquee, { citations: ((_f = shown.detail) == null ? void 0 : _f.citations) || [] })))
  );
}
function CitationsMarquee({ citations }) {
  if (!citations.length) return null;
  const items = [...citations, ...citations, ...citations];
  return /* @__PURE__ */ React.createElement("div", { style: {
    borderTop: "1px solid var(--line-soft)",
    margin: "0 -26px",
    padding: "10px 0",
    overflow: "hidden",
    position: "relative",
    maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
    WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 36,
    whiteSpace: "nowrap",
    animation: "jdm-citations-scroll 48s linear infinite",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-3)",
    letterSpacing: "0.04em"
  } }, items.map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: { flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, "●"), " ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, c.author), " ", "(", c.year, ") — ", /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font-serif)", fontStyle: "italic" } }, c.title), " ", "· ", /* @__PURE__ */ React.createElement("span", null, c.venue)))), /* @__PURE__ */ React.createElement("style", null, `
        @keyframes jdm-citations-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(-100% / 3)); }
        }
      `));
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
    const suffix = parsed.suffix || "";
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    const startVal = hasM ? 1e-3 : target * 0.45;
    const duration = hasM ? 2400 : 1200;
    const fmtFull = (v, final = false) => {
      const plus = final && hasPlus ? "+" : "";
      if (hasM) {
        if (v < 1) return Math.round(v * 1e3) + "k" + plus;
        const s = v.toFixed(1);
        return (s.endsWith(".0") ? s.slice(0, -2) : s) + "M" + plus;
      }
      return String(Math.floor(v)) + plus;
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
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
  React.useEffect(() => {
    const target = parsed.num;
    const suffix = parsed.suffix || "";
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    const plus = hasPlus ? "+" : "";
    if (hasM) {
      const s = target.toFixed(1);
      setDisplay((s.endsWith(".0") ? s.slice(0, -2) : s) + "M" + plus);
    } else {
      setDisplay(String(target) + plus);
    }
  }, [parsed]);
  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onMouseEnter: () => {
        setHovering(true);
        animate();
      },
      onMouseLeave: () => setHovering(false),
      style: {
        background: "var(--bg-card)",
        padding: "18px 20px",
        transition: "background 0.2s",
        cursor: "default"
      }
    },
    /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 11,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 6
    } }, stat.label),
    /* @__PURE__ */ React.createElement("div", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 28,
      fontWeight: 600,
      color: hovering ? hoverColor || "var(--accent)" : "var(--ink)",
      lineHeight: 1,
      letterSpacing: "-0.02em",
      transition: "color 0.18s",
      fontVariantNumeric: "tabular-nums"
    } }, display),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 4 } }, stat.sub)
  );
}
function GitHubMark({ size = 22 }) {
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "currentColor",
      style: { flexShrink: 0 },
      "aria-label": "GitHub"
    },
    /* @__PURE__ */ React.createElement("path", { d: "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.79.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" })
  );
}
window.ViewProjet = ViewProjet;
const EXPLORE_RELATIONS = [
  { value: "r_syn", label: "Synonymes", sub: "r_syn" },
  { value: "r_anto", label: "Antonymes", sub: "r_anto" },
  { value: "r_isa", label: 'Hyperonymes — "est un"', sub: "r_isa" },
  { value: "r_hypo", label: 'Hyponymes — "exemples de"', sub: "r_hypo" },
  { value: "r_has_part", label: "Parties / composants", sub: "r_has_part" },
  { value: "r_carac", label: "Caractéristiques", sub: "r_carac" },
  { value: "r_has_color", label: "Couleurs", sub: "r_has_color" },
  { value: "r_lieu", label: "Lieux typiques", sub: "r_lieu" },
  { value: "r_agent", label: "Agents typiques (verbe)", sub: "r_agent" },
  { value: "r_patient", label: "Patients typiques (verbe)", sub: "r_patient" },
  { value: "r_instr", label: "Instruments (verbe)", sub: "r_instr" },
  { value: "r_telic_role", label: "Rôle télique — à quoi sert", sub: "r_telic_role" },
  { value: "r_has_causatif", label: "Causes", sub: "r_has_causatif" },
  { value: "r_has_conseq", label: "Conséquences", sub: "r_has_conseq" },
  { value: "r_but", label: "But", sub: "r_but" },
  { value: "r_manner", label: "Manière (verbe / processus)", sub: "r_manner" }
];
const EXPLORE_LIMIT_MAX = 1e3;
const EXPLORE_LIMIT_STEP = 10;
function ViewExplorer() {
  var _a;
  const _pending = typeof window !== "undefined" && ((_a = window.__jdmPendingPayload) == null ? void 0 : _a.explorer) || null;
  if (typeof window !== "undefined" && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.explorer;
  }
  const [term, setTerm] = useState((_pending == null ? void 0 : _pending.term) || "chat");
  const [termLabel, setTermLabel] = useState("");
  const [rel, setRel] = useState((_pending == null ? void 0 : _pending.rel) || "r_isa");
  const _allRels = useJdmRelations();
  const relOptions = jdmRelationOptions(_allRels, EXPLORE_RELATIONS);
  const [minWeight, setMinWeight] = useState(25);
  const [limit, setLimit] = useState(20);
  const [annotations, setAnnotations] = useState(true);
  const [includeNeg, setIncludeNeg] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hoverRow, setHoverRow] = useState(-1);
  const [highlightRow, setHighlightRow] = useState(-1);
  const scrollToRow = (i) => {
    setHighlightRow(i);
    const el = document.getElementById("expl-row-" + i);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightRow((h) => h === i ? -1 : h), 1600);
  };
  const onRun = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          relation: rel,
          min_weight: Number(minWeight),
          // Jauge au max (> EXPLORE_LIMIT_MAX) → illimité (null = pas de cap).
          limit: Number(limit) > EXPLORE_LIMIT_MAX ? null : Number(limit),
          with_annotations: !!annotations,
          include_negatives: !!includeNeg
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMessage(data.message || "");
      setLoaded(true);
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setRows([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    onRun();
  }, []);
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Module · sans LLM",
      title: "Explorer",
      desc: "Récupère les relations d'un terme dans JeuxDeMots. Instantané, déterministe, mis en cache."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "end",
    marginBottom: 16
  } }, /* @__PURE__ */ React.createElement(Field, { label: "Terme" }, /* @__PURE__ */ React.createElement(
    TermSenseField,
    {
      value: term,
      onChange: (v, label) => {
        setTerm(v);
        setTermLabel(label);
      },
      placeholder: "chat, avocat, courir…",
      mono: true
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: "Type de relation" }, /* @__PURE__ */ React.createElement(Select, { value: rel, options: relOptions, onChange: setRel, searchable: true })), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement(Button, { onClick: onRun, size: "lg", disabled: loading }, loading ? "Chargement…" : "Interroger"))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 20px",
    padding: "14px 16px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    marginBottom: 28
  } }, /* @__PURE__ */ React.createElement(Field, { label: "Poids minimum (positifs)", inline: true }, /* @__PURE__ */ React.createElement(Slider, { value: minWeight, onChange: setMinWeight, min: 0, max: 500, step: 5 })), /* @__PURE__ */ React.createElement(Field, { label: "Limite (par signe)", inline: true }, /* @__PURE__ */ React.createElement(
    Slider,
    {
      value: limit,
      onChange: setLimit,
      min: 10,
      max: EXPLORE_LIMIT_MAX + EXPLORE_LIMIT_STEP,
      step: EXPLORE_LIMIT_STEP,
      format: (v) => v > EXPLORE_LIMIT_MAX ? "∞" : String(v)
    }
  )), /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--ink-2)",
    cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: includeNeg,
      onChange: (e) => setIncludeNeg(e.target.checked),
      style: { accentColor: "var(--accent)" }
    }
  ), "Récupérer les relations négatives"), /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--ink-2)",
    cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: annotations,
      onChange: (e) => setAnnotations(e.target.checked),
      style: { accentColor: "var(--accent)" }
    }
  ), "Annotations sémantiques (constitutif, contrastif…)")), error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 16,
    marginBottom: 16,
    background: "rgba(200, 58, 115, 0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 13
  } }, "⚠️ ", error), loaded && !error && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 12, color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, rows.length), " triplet", rows.length > 1 ? "s" : "", " trouvé", rows.length > 1 ? "s" : "", " · ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, termLabel || term), " | ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, rel), " | ?"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "secondary",
      onClick: () => exportCSV(rows, term, rel)
    },
    "Exporter CSV"
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      onClick: () => window.dispatchEvent(new CustomEvent("jdm:goto", { detail: { view: "subgraph", term } }))
    },
    "Voir le graphe →"
  ))), rows.length > 0 && /* @__PURE__ */ React.createElement(Card, { padding: 16, style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" } }, "Distribution des poids"), hoverRow >= 0 && rows[hoverRow] ? /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, rows[hoverRow].source || term), " | ", /* @__PURE__ */ React.createElement("span", { style: { color: rows[hoverRow].weight < 0 ? "var(--jdm-magenta)" : "var(--accent)" } }, rows[hoverRow].relation || rel), " | ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, rows[hoverRow].target), " · ", /* @__PURE__ */ React.createElement("span", { style: { color: rows[hoverRow].weight < 0 ? "var(--jdm-magenta)" : "var(--ink-3)" } }, "w=", rows[hoverRow].weight)) : /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, "max ", Math.max(...rows.map((r) => r.weight)), " · min ", Math.min(...rows.map((r) => r.weight)))), /* @__PURE__ */ React.createElement(Bars, { rows, onHover: setHoverRow, onPick: scrollToRow })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, rows.map((r, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      id: "expl-row-" + i,
      style: {
        borderRadius: "var(--radius)",
        outline: highlightRow === i ? "2px solid var(--accent)" : "2px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.25s"
      }
    },
    /* @__PURE__ */ React.createElement(
      Triplet,
      {
        subject: r.source || term,
        relation: r.relation || rel,
        object: r.target,
        weight: r.weight,
        annotations: annotations && r.annotations ? r.annotations : void 0
      }
    )
  ))), rows.length === 0 && /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      title: "Aucun triplet",
      desc: message || `Aucun « ${term} | ${rel} | ? » avec w ≥ ${minWeight}. Essaie un seuil plus bas.`
    }
  )));
}
function Bars({ rows, onHover, onPick }) {
  const withIdx = rows.map((r, i) => ({ ...r, _i: i }));
  const positives = withIdx.filter((r) => r.weight >= 0);
  const negatives = withIdx.filter((r) => r.weight < 0);
  const posMax = Math.max(...positives.map((r) => r.weight), 1);
  const negMax = Math.max(...negatives.map((r) => Math.abs(r.weight)), 1);
  const HALF = 48;
  const col = (r, sign) => {
    const mag = Math.abs(r.weight);
    const ref = sign > 0 ? posMax : negMax;
    const h = Math.max(2, mag / ref * (HALF - 3));
    const color = sign > 0 ? "var(--accent)" : "var(--jdm-magenta)";
    const bar = /* @__PURE__ */ React.createElement("div", { style: {
      width: "100%",
      height: h,
      background: color,
      opacity: 0.35 + 0.65 * (mag / ref),
      borderRadius: sign > 0 ? "2px 2px 0 0" : "0 0 2px 2px"
    } });
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: (sign > 0 ? "p" : "n") + r._i,
        title: `${r.source || ""} | ${r.relation || ""} | ${r.target} · w=${r.weight}`,
        onMouseEnter: () => onHover && onHover(r._i),
        onMouseLeave: () => onHover && onHover(-1),
        onClick: () => onPick && onPick(r._i),
        style: { flex: 1, display: "flex", flexDirection: "column", cursor: "pointer" }
      },
      /* @__PURE__ */ React.createElement("div", { style: { height: HALF, display: "flex", alignItems: "flex-end" } }, sign > 0 && bar),
      /* @__PURE__ */ React.createElement("div", { style: { height: HALF, display: "flex", alignItems: "flex-start" } }, sign < 0 && bar)
    );
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: { position: "relative" },
      onMouseLeave: () => onHover && onHover(-1)
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 2, alignItems: "stretch" } }, positives.map((r) => col(r, 1)), negatives.map((r) => col(r, -1))),
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: HALF,
      height: 1,
      background: "var(--line)",
      pointerEvents: "none"
    } })
  );
}
function exportCSV(rows, term, rel) {
  if (!rows || rows.length === 0) return;
  const header = ["source", "relation", "target", "weight", "annotations", "target_id"];
  const escape = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((k) => escape(r[k])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jdm_${term}_${rel}.csv`.replace(/[^a-z0-9_\-.]/gi, "_");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
window.ViewExplorer = ViewExplorer;
const CLAIM_RELATIONS_OPTS = [
  { value: "r_isa", label: "r_isa — est un" },
  { value: "r_hypo", label: "r_hypo — exemple de" },
  { value: "r_carac", label: "r_carac — caractéristique" },
  { value: "r_has_color", label: "r_has_color — couleur" },
  { value: "r_has_part", label: "r_has_part — partie / composant" },
  { value: "r_agent", label: "r_agent — agent typique" },
  { value: "r_patient", label: "r_patient — patient typique" },
  { value: "r_instr", label: "r_instr — instrument" },
  { value: "r_lieu", label: "r_lieu — lieu typique" },
  { value: "r_has_causatif", label: "r_has_causatif — cause" },
  { value: "r_has_conseq", label: "r_has_conseq — conséquence" },
  { value: "r_but", label: "r_but — but" },
  { value: "r_telic_role", label: "r_telic_role — à quoi sert" }
];
const EFFORT_OPTS = [
  { value: 0, label: "0 — Contenance", sub: "JDM contient-il ce triplet ?" },
  { value: 1, label: "1 — + inférence noyau", sub: "isa-transitivité + agent/patient" },
  { value: 2, label: "2 — + inférence complète", sub: "tous les schémas (lent)" }
];
const ORIGIN_LABEL = {
  inference: "inférence",
  containment: "contenance",
  none: "—"
};
function ViewClaim() {
  const [subject, setSubject] = useState("baleine");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [objectLabel, setObjectLabel] = useState("");
  const [relation, setRelation] = useState("r_isa");
  const _allRels = useJdmRelations();
  const relOptions = jdmRelationOptions(_allRels, CLAIM_RELATIONS_OPTS);
  const [object_, setObject] = useState("poisson");
  const [effort, setEffort] = useState(0);
  const [bypass, setBypass] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const run = async (opts) => {
    const _subject = opts && opts.subject !== void 0 ? opts.subject : subject;
    const _relation = opts && opts.relation !== void 0 ? opts.relation : relation;
    const _object = opts && opts.object !== void 0 ? opts.object : object_;
    const _effort = opts && opts.effort !== void 0 ? opts.effort : Number(effort);
    const _bypass = opts && opts.bypass !== void 0 ? opts.bypass : !!bypass;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("api/factcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: _subject,
          relation: _relation,
          object: _object,
          effort: Number(_effort),
          bypass: !!_bypass
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const submitted = {
        subject: _subject,
        relation: _relation,
        object: _object,
        effort: Number(_effort),
        bypass: !!_bypass
      };
      if (data.error) {
        setResult({
          submitted,
          status: "unknown",
          confidence: 0,
          explanation: data.error,
          origin: ORIGIN_LABEL[data.origin] || "—"
        });
      } else {
        setResult({
          submitted,
          status: data.status,
          confidence: data.confidence,
          explanation: data.explanation,
          origin: ORIGIN_LABEL[data.origin] || "—",
          inference_schema: data.inference_schema,
          proof: data.proof,
          counter: data.counter
        });
      }
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    run();
  }, []);
  const examples = [
    ["chat", "r_isa", "animal"],
    ["tomate", "r_isa", "fruit"],
    ["tomate", "r_isa", "légume"],
    ["chat", "r_agent", "aboyer"]
  ];
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Module · déterministe",
      title: "Claim checker",
      desc: "Vérifie une affirmation atomique. JDM répond ✅ supporté, ❌ contredit, ou ❓ inconnu, avec sa chaîne de preuve."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    padding: 20,
    marginBottom: 16
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12
  } }, "Construire le triplet"), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr auto 1fr",
    gap: 10,
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement(
    TermSenseField,
    {
      value: subject,
      onChange: (v, label) => {
        setSubject(v);
        setSubjectLabel(label);
      },
      placeholder: "sujet",
      mono: true
    }
  ), /* @__PURE__ */ React.createElement(Sep, null), /* @__PURE__ */ React.createElement(Select, { value: relation, options: relOptions, onChange: setRelation, searchable: true }), /* @__PURE__ */ React.createElement(Sep, null), /* @__PURE__ */ React.createElement(
    TermSenseField,
    {
      value: object_,
      onChange: (v, label) => {
        setObject(v);
        setObjectLabel(label);
      },
      placeholder: "objet",
      mono: true
    }
  )), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 14,
    alignItems: "end",
    marginTop: 18
  } }, /* @__PURE__ */ React.createElement(Field, { label: "Effort de vérification" }, /* @__PURE__ */ React.createElement(Select, { value: effort, options: EFFORT_OPTS, onChange: (v) => setEffort(Number(v)) })), /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--ink-2)",
    cursor: "pointer",
    padding: "10px 0"
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: bypass,
      onChange: (e) => setBypass(e.target.checked),
      style: { accentColor: "var(--accent)" }
    }
  ), "Bypass contenance"), /* @__PURE__ */ React.createElement(Button, { onClick: run, size: "lg", disabled: loading }, loading ? "Vérification…" : "Vérifier"))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 28
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    alignSelf: "center",
    marginRight: 6
  } }, "Exemples :"), examples.map(([s, r, o], i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: i,
      className: "focus-ring",
      onClick: () => {
        setSubject(s);
        setRelation(r);
        setObject(o);
        setSubjectLabel("");
        setObjectLabel("");
        run({ subject: s, relation: r, object: o });
      },
      style: {
        padding: "4px 10px",
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 999,
        color: "var(--ink-2)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        cursor: "pointer"
      }
    },
    s,
    " | ",
    r,
    " | ",
    o
  ))), error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 16,
    marginBottom: 16,
    background: "rgba(200, 58, 115, 0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 13
  } }, "⚠️ ", error), result && result.submitted && (result.submitted.subject !== subject || result.submitted.relation !== relation || result.submitted.object !== object_ || result.submitted.effort !== Number(effort) || result.submitted.bypass !== !!bypass) && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 14px",
    marginBottom: 12,
    background: "var(--bg-elev)",
    border: "1px dashed var(--jdm-orange)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-orange)",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  } }, /* @__PURE__ */ React.createElement("span", null, "⚠️ Le formulaire a changé — le verdict ci-dessous concerne le triplet précédent."), /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: run, disabled: loading }, "Re-vérifier")), result && /* @__PURE__ */ React.createElement(
    ClaimResult,
    {
      result,
      subject: subjectLabel || (result.submitted ? result.submitted.subject : subject),
      relation: result.submitted ? result.submitted.relation : relation,
      object: objectLabel || (result.submitted ? result.submitted.object : object_)
    }
  ));
}
function Sep() {
  return /* @__PURE__ */ React.createElement("div", { style: {
    color: "var(--ink-3)",
    fontFamily: "var(--font-mono)",
    fontSize: 20,
    userSelect: "none"
  } }, "│");
}
function ClaimResult({ result, subject, relation, object }) {
  const verdict = {
    supported: { icon: "✓", label: "SUPPORTED", color: "var(--jdm-green)" },
    contradicted: { icon: "✗", label: "CONTRADICTED", color: "var(--jdm-magenta)" },
    unknown: { icon: "?", label: "UNKNOWN", color: "var(--ink-3)" }
  }[result.status] || { icon: "?", label: result.status, color: "var(--ink-3)" };
  const confidence = typeof result.confidence === "number" ? result.confidence : 0;
  return /* @__PURE__ */ React.createElement("div", { className: "fade-up" }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 24,
    padding: 24,
    background: "var(--bg-card)",
    border: `2px solid ${verdict.color}`,
    borderRadius: "var(--radius-lg)",
    marginBottom: 16
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderRadius: "50%",
    background: verdict.color,
    color: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 700,
    fontFamily: "var(--font-display)"
  } }, verdict.icon), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: verdict.color,
    letterSpacing: "0.18em",
    fontWeight: 700,
    marginBottom: 6
  } }, verdict.label), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: 8
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 17,
    color: "var(--ink)"
  } }, subject), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", margin: "0 8px" } }, "│"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 17,
    color: "var(--accent)"
  } }, relation), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", margin: "0 8px" } }, "│"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 17,
    color: "var(--ink)"
  } }, object)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-2)" } }, result.explanation), result.inference_schema && /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    marginTop: 8
  } }, "schéma : ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, result.inference_schema))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "Confiance"), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 32,
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1,
    marginTop: 6
  } }, confidence.toFixed(2)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 6 } }, result.origin === "inférence" ? "🧠 via inférence" : result.origin === "contenance" ? "📦 via contenance" : ""))), result.proof && result.proof.length > 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12
  } }, result.origin === "inférence" ? "🔗 Chaîne de déduction" : "✓ Évidences en faveur"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, result.proof.map((e, i) => /* @__PURE__ */ React.createElement(Triplet, { key: i, subject: e.s, relation: e.r, object: e.t, weight: e.w })))), result.counter && result.counter.length > 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--jdm-magenta)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12
  } }, "✗ Évidences contraires"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, result.counter.map((e, i) => /* @__PURE__ */ React.createElement(Triplet, { key: i, subject: e.s, relation: e.r, object: e.t, weight: e.w })))));
}
window.ViewClaim = ViewClaim;
const SUBGRAPH_DEFAULT_RELATIONS = [
  "r_isa",
  "r_hypo",
  "r_syn",
  "r_anto",
  "r_carac",
  "r_has_part",
  "r_lieu",
  "r_domain"
];
const SUBGRAPH_DEFAULT_D2 = ["r_isa", "r_carac", "r_has_part", "r_lieu"];
const SUBGRAPH_DEFAULT_D3 = ["r_isa", "r_has_part", "r_carac"];
const SUBGRAPH_DEFAULT_D4 = ["r_isa", "r_carac"];
const SUBGRAPH_ALL_RELATIONS = [
  ...SUBGRAPH_DEFAULT_RELATIONS,
  "r_has_color",
  "r_agent",
  "r_patient",
  "r_instr",
  "r_telic_role",
  "r_has_causatif",
  "r_has_conseq",
  "r_patient-1",
  "r_agent-1",
  "r_associated"
];
const KIND_COLOR = {
  center: "#1a1a1a",
  isa: "#1565c0",
  hypo: "#2e7d32",
  syn: "#558b2f",
  anto: "#c62828",
  carac: "#6a1b9a",
  part: "#a04500",
  lieu: "#00838f",
  verb: "#ef6c00",
  domain: "#455a64",
  assoc: "#757575"
};
const KIND_OF_REL = {
  r_isa: "isa",
  r_hypo: "hypo",
  r_syn: "syn",
  r_anto: "anto",
  r_carac: "carac",
  r_has_part: "part",
  r_lieu: "lieu",
  "r_patient-1": "verb",
  "r_agent-1": "verb",
  r_domain: "domain",
  r_associated: "assoc"
};
const REL_COLOR_LIVE = {
  r_isa: "#4ea1ff",
  // bleu
  r_hypo: "#5cd6a8",
  // vert menthe
  r_syn: "#a8e063",
  // vert lime
  r_anto: "#ff5c87",
  // rose vif
  r_carac: "#c084fc",
  // violet
  r_has_part: "#ffa94d",
  // orange
  r_lieu: "#22d3ee",
  // cyan
  r_domain: "#94a3b8",
  // ardoise
  r_has_color: "#fbbf24",
  // jaune
  r_agent: "#f97316",
  // orange foncé
  r_patient: "#ec4899",
  // magenta
  r_instr: "#06b6d4",
  // teal
  r_telic_role: "#84cc16",
  // lime
  r_has_causatif: "#dc2626",
  // rouge
  r_has_conseq: "#a78bfa",
  // violet clair
  "r_patient-1": "#fb923c",
  // orange clair
  "r_agent-1": "#f59e0b",
  // ambre
  r_associated: "#9ca3af",
  // gris
  r_raff_sem: "#e879f9"
  // magenta clair
};
const REL_COLOR_DEFAULT = "#6b7280";
function relColor(rel) {
  return REL_COLOR_LIVE[rel] || REL_COLOR_DEFAULT;
}
function buildLiveScenario(rootTerm, nodes, edges, layout = "tree", opts = {}) {
  if (!nodes || nodes.length === 0) return null;
  const showNegatives = opts.showNegatives !== false;
  if (!showNegatives) {
    const filteredEdges = (edges || []).filter((e) => !e.negative);
    const touched = /* @__PURE__ */ new Set(["ROOT"]);
    for (const e of filteredEdges) {
      touched.add(e.from);
      touched.add(e.to);
    }
    nodes = (nodes || []).filter((n) => touched.has(n.id));
    edges = filteredEdges;
    if (nodes.length === 0) return null;
  }
  const centerNode = nodes.find((n) => n.id === "ROOT") || nodes[0];
  const center = centerNode.label || rootTerm;
  const centerId = centerNode.id;
  const BRANCH_COLORS = [
    "jdm-magenta",
    "jdm-cyan",
    "jdm-green",
    "jdm-violet",
    "jdm-orange",
    "jdm-yellow"
  ];
  const byDepth = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    const d = Math.max(1, Math.min(Number(n.depth) || 1, 4));
    byDepth[d].push(n);
  }
  const depthOfId = { [centerId]: 0 };
  for (const n of nodes) {
    if (n.id === centerId) continue;
    depthOfId[n.id] = Math.max(1, Math.min(Number(n.depth) || 1, 4));
  }
  const parentOf = {};
  for (const e of edges || []) {
    const fa = depthOfId[e.from];
    const fb = depthOfId[e.to];
    if (fa === void 0 || fb === void 0) continue;
    if (fb > fa && !(e.to in parentOf)) parentOf[e.to] = e.from;
    else if (fa > fb && !(e.from in parentOf)) parentOf[e.from] = e.to;
  }
  const d1Count = byDepth[1].length;
  const RING_DIST = [
    0,
    d1Count >= 12 ? 220 : d1Count >= 8 ? 200 : 180,
    320,
    410,
    470
  ];
  const polar = { [centerId]: { angle: 0, dist: 0 } };
  const branchColorOf = { [centerId]: "jdm-magenta" };
  const d1 = byDepth[1];
  d1.forEach((n, i) => {
    const angle = i / Math.max(d1.length, 1) * 360 - 90;
    const stagger = d1.length >= 8 ? i % 2 === 0 ? -22 : 22 : 0;
    polar[n.id] = { angle, dist: RING_DIST[1] + stagger };
    branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
  });
  for (let depth = 2; depth <= 4; depth++) {
    const arr = byDepth[depth];
    if (arr.length === 0) continue;
    const dist = RING_DIST[Math.min(depth, 4)];
    const minArcDeg = 13;
    const tooCrowded = arr.length * minArcDeg > 340;
    if (layout === "rings" || tooCrowded) {
      arr.forEach((n, i) => {
        const angle = i / arr.length * 360 - 90 + (depth - 1) * 15;
        polar[n.id] = { angle, dist };
        const pId = parentOf[n.id];
        branchColorOf[n.id] = pId && branchColorOf[pId] || BRANCH_COLORS[i % BRANCH_COLORS.length];
      });
      continue;
    }
    const byParent = {};
    const orphans = [];
    for (const n of arr) {
      const pId = parentOf[n.id];
      if (pId && polar[pId] !== void 0) {
        if (!byParent[pId]) byParent[pId] = [];
        byParent[pId].push(n);
      } else {
        orphans.push(n);
      }
    }
    for (const pId of Object.keys(byParent)) {
      const kids = byParent[pId];
      const pAngle = polar[pId].angle;
      const parentSlice = d1Count > 0 ? 360 / d1Count : 90;
      const span = Math.min(
        parentSlice * 0.85,
        Math.max(20, kids.length * 26)
      );
      kids.forEach((n, i) => {
        const off = kids.length === 1 ? 0 : i / (kids.length - 1) * span - span / 2;
        polar[n.id] = { angle: pAngle + off, dist };
        branchColorOf[n.id] = branchColorOf[pId] || "jdm-violet";
      });
    }
    orphans.forEach((n, i) => {
      const angle = i / Math.max(orphans.length, 1) * 360 - 45;
      polar[n.id] = { angle, dist };
      branchColorOf[n.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
    });
  }
  const DELAY_PER_DEPTH = [0, 0.4, 1.8, 3, 4];
  const nodeDelays = { [centerId]: 0 };
  const liveNodes = [];
  const sortedNodes = nodes.filter((n) => n.id !== centerId && polar[n.id] !== void 0).sort((a, b) => (depthOfId[a.id] || 1) - (depthOfId[b.id] || 1));
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
      color: branchColorOf[n.id] || "jdm-violet",
      delay,
      dim: d >= 2
    });
  });
  const remap = (id) => id === centerId ? center : id;
  const known = (id) => id === centerId || polar[id] !== void 0;
  const liveEdges = (edges || []).filter((e) => known(e.from) && known(e.to)).map((e) => ({
    from: remap(e.from),
    to: remap(e.to),
    delay: Math.max(nodeDelays[e.from] || 0, nodeDelays[e.to] || 0) + 0.12,
    label: e.relation || "",
    // Couleur par TYPE DE RELATION (visible sur fond sombre).
    // Les négations passent en rouge dédié pour signal fort.
    color: e.negative ? "#ef4444" : relColor(e.relation),
    negative: !!e.negative,
    // Poids JDM exposé au tooltip survol (cf. GraphCanvas <title>).
    weight: e.weight,
    highlight: e.highlight !== false
  }));
  const labelByRawId = {};
  for (const n of nodes) {
    const lbl = (n.label || "").toString().trim();
    labelByRawId[n.id] = lbl || n.id;
  }
  labelByRawId[centerId] = center;
  return {
    id: "live",
    question: "",
    streamChunks: [],
    graph: {
      center,
      nodes: liveNodes,
      edges: liveEdges,
      _labelByRawId: labelByRawId,
      _centerId: centerId
    }
  };
}
function LiveAnimWrapper({ term, nodes, edges, layout, onRecenter }) {
  var _a, _b;
  const [showNegatives, setShowNegatives] = useState(true);
  const scenario = React.useMemo(
    () => buildLiveScenario(term, nodes, edges, layout, { showNegatives }),
    [
      term,
      layout,
      showNegatives,
      (nodes || []).length,
      (edges || []).length,
      (_a = (nodes || [])[0]) == null ? void 0 : _a.id,
      (_b = (nodes || [])[(nodes || []).length - 1]) == null ? void 0 : _b.id
    ]
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = React.useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  const onWheel = (e) => {
    if (!(e.altKey || e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 1e-3;
    setZoom((z) => Math.max(0.4, Math.min(3, z + delta)));
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-node-bubble]")) return;
    drag.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      px: pan.x,
      py: pan.y
    };
  };
  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.sx),
      y: drag.current.py + (e.clientY - drag.current.sy)
    });
  };
  const stopDrag = () => {
    drag.current.active = false;
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const handleNodeClick = React.useCallback((node) => {
    if (!onRecenter) return;
    onRecenter(node.label || node.id);
  }, [onRecenter]);
  const cursor = drag.current.active ? "grabbing" : "grab";
  return /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 5,
    display: "flex",
    flexDirection: "column",
    gap: 4
  } }, [
    { label: "+", title: "Zoom +", onClick: () => setZoom((z) => Math.min(3, z + 0.2)) },
    { label: "−", title: "Zoom −", onClick: () => setZoom((z) => Math.max(0.4, z - 0.2)) },
    { label: "⟲", title: "Réinitialiser vue (zoom + pan)", onClick: resetView }
  ].map((b) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: b.label,
      onClick: b.onClick,
      className: "focus-ring",
      title: b.title,
      style: {
        width: 28,
        height: 28,
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        color: "var(--ink)",
        borderRadius: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    },
    b.label
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setShowNegatives((v) => !v),
      className: "focus-ring",
      title: showNegatives ? "Masquer les relations négatives (affiner)" : "Afficher les relations négatives",
      style: {
        width: 28,
        height: 28,
        marginTop: 4,
        background: showNegatives ? "var(--bg-elev)" : "#ef4444",
        border: "1px solid var(--line)",
        color: showNegatives ? "var(--ink)" : "#fff",
        borderRadius: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: showNegatives ? "none" : "line-through"
      }
    },
    "¬"
  ), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    marginTop: 2,
    fontSize: 9,
    color: "var(--ink-3)",
    textAlign: "center",
    letterSpacing: "0.05em"
  } }, Math.round(zoom * 100), "%")), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    bottom: 10,
    left: 10,
    zIndex: 5,
    padding: "4px 8px",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid var(--line-soft)",
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--ink-3)",
    pointerEvents: "none",
    letterSpacing: "0.04em"
  } }, "glisser : pan · Alt+molette : zoom · survoler : info · cliquer : recentrer"), /* @__PURE__ */ React.createElement(
    "div",
    {
      onWheel,
      onMouseDown,
      onMouseMove,
      onMouseUp: stopDrag,
      onMouseLeave: stopDrag,
      style: {
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        cursor,
        userSelect: "none"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      width: "100%",
      height: "100%",
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: "center center",
      transition: drag.current.active ? "none" : "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
    } }, /* @__PURE__ */ React.createElement(
      HeroAnimation,
      {
        height: 720,
        showChat: false,
        liveScenario: scenario,
        interactive: true,
        onNodeClick: handleNodeClick
      }
    ))
  ));
}
function ViewSubgraph() {
  var _a, _b, _c, _d, _e, _f, _g;
  const _pending = typeof window !== "undefined" && ((_a = window.__jdmPendingPayload) == null ? void 0 : _a.subgraph) || null;
  if (typeof window !== "undefined" && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.subgraph;
  }
  const initialTerm = typeof window !== "undefined" && window.__jdmPendingTerm || (_pending == null ? void 0 : _pending.term) || "plat asiatique";
  if (typeof window !== "undefined") window.__jdmPendingTerm = null;
  const [term, setTerm] = useState(initialTerm);
  const [termLabel, setTermLabel] = useState("");
  const [depth, setDepth] = useState((_pending == null ? void 0 : _pending.depth) || 2);
  const [topK, setTopK] = useState(1);
  const [topKd2, setTopKd2] = useState(3);
  const [topKd3, setTopKd3] = useState(3);
  const [topKd4, setTopKd4] = useState(3);
  const [activeRels, setActiveRels] = useState(SUBGRAPH_DEFAULT_RELATIONS);
  const [activeRelsD2, setActiveRelsD2] = useState(SUBGRAPH_DEFAULT_D2);
  const [activeRelsD3, setActiveRelsD3] = useState(SUBGRAPH_DEFAULT_D3);
  const [activeRelsD4, setActiveRelsD4] = useState(SUBGRAPH_DEFAULT_D4);
  const vizRef = useRef(null);
  const [levelsCollapsed, setLevelsCollapsed] = useState(false);
  const [rankCap, setRankCap] = useState(20);
  const [maxNodes, setMaxNodes] = useState(40);
  const [format, setFormat] = useState("live");
  const [liveLayout, setLiveLayout] = useState("tree");
  const [data, setData] = useState({ nodes: [], edges: [], stats: {}, html: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const toggleIn = (set, setSet) => (r) => setSet((a) => a.includes(r) ? a.filter((x) => x !== r) : [...a, r]);
  const buildSeq = React.useRef(0);
  const onBuild = async () => {
    const mySeq = ++buildSeq.current;
    const isStale = () => mySeq !== buildSeq.current;
    setLoading(true);
    setError("");
    setMessage("");
    if (format === "live") {
      try {
        const liveMaxNodes = Math.max(25, Number(maxNodes) || 30);
        const res = await fetch("api/subgraph/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term,
            depth: Number(depth),
            top_k: Number(topK),
            relations: activeRels,
            max_nodes: liveMaxNodes,
            // Cap par RANG (par type de relation) — pas un seuil de
            // poids absolu. Les négations sont toujours conservées
            // côté backend, peu importe la valeur.
            rank_cap: Number(rankCap)
          })
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        let collectedNodes = [];
        let collectedEdges = [];
        const flush = () => {
          const re = /\r\n\r\n|\n\n|\r\r/;
          let m;
          while ((m = re.exec(buf)) !== null) {
            const raw = buf.slice(0, m.index);
            buf = buf.slice(m.index + m[0].length);
            let evName = "message", evData = "";
            for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
              if (!line || line.startsWith(":")) continue;
              if (line.startsWith("event:")) evName = line.slice(6).trim();
              else if (line.startsWith("data:"))
                evData += (evData ? "\n" : "") + line.slice(5).replace(/^ /, "");
            }
            if (!evData) continue;
            let parsed;
            try {
              parsed = JSON.parse(evData);
            } catch {
              parsed = { text: evData };
            }
            if (evName === "graph") {
              if (isStale()) return;
              collectedNodes = parsed.nodes || [];
              collectedEdges = parsed.edges || [];
              setData({
                nodes: collectedNodes,
                edges: collectedEdges,
                stats: {
                  n_nodes: collectedNodes.length,
                  n_edges: collectedEdges.length,
                  depth
                },
                html: "",
                format: "live"
              });
            } else if (evName === "error") {
              if (isStale()) return;
              setError(parsed.text || "erreur LIVE");
            }
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (isStale()) {
            reader.cancel().catch(() => {
            });
            return;
          }
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
    try {
      const res = await fetch("api/subgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          format
        })
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
        html: d.html || "",
        format: d.format
      });
      if (d.message) setMessage(d.message);
    } catch (e) {
      if (isStale()) return;
      setError(String(e && e.message ? e.message : e));
      setData({ nodes: [], edges: [], stats: {}, html: "" });
    } finally {
      if (!isStale()) setLoading(false);
    }
  };
  const [runVersion, setRunVersion] = useState(0);
  React.useEffect(() => {
    onBuild();
  }, [runVersion]);
  const recenterTo = React.useCallback((newTerm) => {
    if (!newTerm || newTerm === term) return;
    setTerm(newTerm);
    setTermLabel("");
    setRunVersion((v) => v + 1);
  }, [term]);
  const firstReactiveRun = React.useRef(true);
  React.useEffect(() => {
    if (firstReactiveRun.current) {
      firstReactiveRun.current = false;
      return;
    }
    const timer = setTimeout(() => setRunVersion((v) => v + 1), 400);
    return () => clearTimeout(timer);
  }, [
    term,
    depth,
    format,
    topK,
    topKd2,
    topKd3,
    topKd4,
    rankCap,
    maxNodes,
    // Sérialisation des listes pour détecter les toggles de relations
    activeRels.join(","),
    activeRelsD2.join(","),
    activeRelsD3.join(","),
    activeRelsD4.join(",")
  ]);
  const stats = data.stats || {};
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Module · visualisation",
      title: "Sous-graphe",
      desc: "Extrait et visualise le voisinage d'un terme à profondeur N, filtré par type de relation. Deux formats : HTML interactif (vis-network) ou SVG natif."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: 20,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "sticky",
    top: 80,
    display: "flex",
    flexDirection: "column",
    gap: 14
  } }, /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement(Field, { label: "Terme racine" }, /* @__PURE__ */ React.createElement(
    TermSenseField,
    {
      value: term,
      onChange: (v, label) => {
        setTerm(v);
        setTermLabel(label);
      },
      mono: true
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: `Profondeur · ${depth}` }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 } }, [1, 2, 3, 4].map((d) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: d,
      onClick: () => setDepth(d),
      className: "focus-ring",
      style: {
        padding: "8px",
        background: depth === d ? "var(--accent)" : "var(--bg-elev)",
        border: "1px solid var(--line)",
        color: depth === d ? "var(--bg)" : "var(--ink)",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer"
      }
    },
    d
  )))), /* @__PURE__ */ React.createElement(Field, { label: "Format de rendu" }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 } }, [
    { id: "html", value: "html", label: "HTML" },
    { id: "svg", value: "json", label: "SVG" },
    { id: "live", value: "live", label: "LIVE", dot: true }
  ].map((f) => {
    const active = format === f.value;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: f.id,
        onClick: () => setFormat(f.value),
        className: "focus-ring",
        style: {
          padding: "8px",
          background: active ? "var(--accent)" : "var(--bg-elev)",
          border: "1px solid var(--line)",
          color: active ? "var(--bg)" : "var(--ink)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5
        }
      },
      f.dot && /* @__PURE__ */ React.createElement("span", { style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: active ? "var(--bg)" : "var(--jdm-green)",
        animation: "pulse-dot 1.2s ease-in-out infinite"
      } }),
      f.label
    );
  }))), /* @__PURE__ */ React.createElement(Field, { label: `Rang max par relation · ${rankCap}` }, /* @__PURE__ */ React.createElement(Slider, { value: rankCap, onChange: setRankCap, min: 0, max: 20, step: 1 }), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    marginTop: 4,
    fontSize: 9,
    color: "var(--ink-3)",
    letterSpacing: "0.04em"
  } }, rankCap === 0 ? "0 = aucune relation positive" : `garde les ${rankCap} plus forts par type`, " · négations toujours visibles")), (format === "json" || format === "live") && /* @__PURE__ */ React.createElement(Field, { label: `Nœuds max · ${maxNodes}` }, /* @__PURE__ */ React.createElement(
    Slider,
    {
      value: maxNodes,
      onChange: setMaxNodes,
      min: format === "live" ? 25 : 10,
      max: 200,
      step: 5
    }
  )), format === "live" && /* @__PURE__ */ React.createElement(Field, { label: "Layout" }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } }, [
    { id: "tree", label: "Arbre" },
    { id: "rings", label: "Cercles" }
  ].map((opt) => {
    const active = liveLayout === opt.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: opt.id,
        onClick: () => setLiveLayout(opt.id),
        className: "focus-ring",
        style: {
          padding: "8px",
          background: active ? "var(--accent)" : "var(--bg-elev)",
          border: "1px solid var(--line)",
          color: active ? "var(--bg)" : "var(--ink)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer"
        }
      },
      opt.label
    );
  }))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement(Button, { full: true, disabled: loading, onClick: () => {
    setRunVersion((v) => v + 1);
    setLevelsCollapsed(true);
    setTimeout(() => {
      if (typeof scrollGroupIntoView === "function" && vizRef.current) {
        try {
          scrollGroupIntoView(vizRef.current, vizRef.current);
        } catch {
        }
      }
    }, 80);
  } }, loading ? "Construction…" : "Reconstruire"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    marginTop: 6,
    fontSize: 9,
    color: "var(--ink-3)",
    letterSpacing: "0.04em",
    textAlign: "center"
  } }, "tous les paramètres se rafraîchissent en direct")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 2px"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "Filtres par niveau (", depth, ")"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setLevelsCollapsed((c) => !c),
      className: "focus-ring",
      title: levelsCollapsed ? "Déplier" : "Plier",
      "aria-label": levelsCollapsed ? "Déplier tous les niveaux" : "Plier tous les niveaux",
      "aria-expanded": !levelsCollapsed,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink-3)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "color 0.12s, border-color 0.12s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.color = "var(--ink)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.color = "var(--ink-3)";
      }
    },
    levelsCollapsed ? "déplier" : "plier",
    /* @__PURE__ */ React.createElement(
      "svg",
      {
        width: "10",
        height: "10",
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        style: {
          transform: levelsCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
          transition: "transform 0.18s"
        }
      },
      /* @__PURE__ */ React.createElement(
        "path",
        {
          d: "M2 4 L6 8 L10 4",
          stroke: "currentColor",
          strokeWidth: "1.4",
          fill: "none",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      )
    )
  )), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: `repeat(${depth}, minmax(0, 1fr))`,
    gap: 12
  } }, /* @__PURE__ */ React.createElement(
    RelationFilterCard,
    {
      label: `Niveau 1 — voisins (top-K ${topK})`,
      topK,
      setTopK,
      active: activeRels,
      setActive: setActiveRels,
      collapsed: levelsCollapsed
    }
  ), depth >= 2 && /* @__PURE__ */ React.createElement(
    RelationFilterCard,
    {
      label: `Niveau 2 (top-K ${topKd2})`,
      topK: topKd2,
      setTopK: setTopKd2,
      active: activeRelsD2,
      setActive: setActiveRelsD2,
      collapsed: levelsCollapsed
    }
  ), depth >= 3 && /* @__PURE__ */ React.createElement(
    RelationFilterCard,
    {
      label: `Niveau 3 (top-K ${topKd3})`,
      topK: topKd3,
      setTopK: setTopKd3,
      active: activeRelsD3,
      setActive: setActiveRelsD3,
      collapsed: levelsCollapsed
    }
  ), depth >= 4 && /* @__PURE__ */ React.createElement(
    RelationFilterCard,
    {
      label: `Niveau 4 (top-K ${topKd4})`,
      topK: topKd4,
      setTopK: setTopKd4,
      active: activeRelsD4,
      setActive: setActiveRelsD4,
      collapsed: levelsCollapsed
    }
  ))), error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 16,
    marginBottom: 12,
    background: "rgba(200, 58, 115, 0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 13
  } }, "⚠️ ", error), message && !error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 12,
    marginBottom: 12,
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    color: "var(--ink-2)",
    fontSize: 13
  } }, message), /* @__PURE__ */ React.createElement("div", { ref: vizRef }, /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid var(--line-soft)",
    background: "var(--bg-elev)",
    gap: 12,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, termLabel || term), " · ", "profondeur ", depth, " · ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, (_b = stats.n_nodes) != null ? _b : data.nodes.length), " nœuds", " · ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, (_c = stats.n_edges) != null ? _c : data.edges.length), " arêtes", " · ", /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--accent)", textTransform: "uppercase" } }, data.format || format)), format === "live" && (data.edges || []).length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    maxWidth: "60%"
  } }, Array.from(new Set((data.edges || []).map((e) => e.relation).filter(Boolean))).sort().map((r) => /* @__PURE__ */ React.createElement("span", { key: r, style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--ink-2)"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    width: 14,
    height: 3,
    borderRadius: 2,
    background: relColor(r)
  } }), r)))), /* @__PURE__ */ React.createElement("div", { style: {
    // Hauteur adaptative selon le format :
    //  - HTML (vis-network iframe) : gros canvas, prend la viewport
    //  - SVG (rendu natif sur dataset) : moyen
    //  - LIVE (animation graphique) : prend toute la viewport dispo
    height: format === "live" ? "min(820px, calc(100vh - 180px))" : format === "json" ? "min(720px, calc(100vh - 220px))" : "min(900px, calc(100vh - 220px))",
    minHeight: format === "live" ? 640 : 560,
    background: "var(--bg-card)",
    position: "relative",
    transition: "height 0.32s cubic-bezier(0.4, 0, 0.2, 1)"
  } }, data.format === "html" && data.html ? /* @__PURE__ */ React.createElement(
    "iframe",
    {
      title: "JDM subgraph",
      srcDoc: data.html,
      sandbox: "allow-scripts allow-same-origin",
      style: {
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        // Le HTML interne a un fond transparent (override CSS
        // injecté côté backend), donc l'iframe montre cette
        // couleur — qui suit le thème via var(--bg).
        background: "var(--bg)"
      }
    }
  ) : format === "live" ? (
    // Mode LIVE — graphe animé en boucle (sans chat).
    // À brancher sur /api/subgraph/live (SSE) — voir brief.
    // Pour l'instant : scénarios pré-enregistrés en démo.
    /* @__PURE__ */ React.createElement("div", { style: { padding: 12, height: "100%" } }, /* @__PURE__ */ React.createElement(
      LiveAnimWrapper,
      {
        term,
        nodes: data.nodes,
        edges: data.edges,
        layout: liveLayout,
        onRecenter: recenterTo
      }
    ))
  ) : data.nodes && data.nodes.length > 0 ? /* @__PURE__ */ React.createElement(GraphViz, { nodes: data.nodes, edges: data.edges, relations: activeRels }) : /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--ink-3)",
    fontSize: 13
  } }, loading ? "Construction…" : "Aucun nœud à afficher.")))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginTop: 16
  } }, [
    ["Nœuds", String((_d = stats.n_nodes) != null ? _d : data.nodes.length)],
    ["Arêtes", String((_e = stats.n_edges) != null ? _e : data.edges.length)],
    ["Négations", String((_f = stats.n_negative) != null ? _f : data.edges.filter((e) => e.negative).length)],
    ["Profondeur", String((_g = stats.depth) != null ? _g : depth)]
  ].map(([k, v]) => /* @__PURE__ */ React.createElement(Card, { key: k, padding: 14 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, k), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 24,
    fontWeight: 600,
    marginTop: 6
  } }, v)))))));
}
function RelationFilterCard({ label, topK, setTopK, active, setActive, collapsed = false }) {
  const toggle = (r) => setActive((a) => a.includes(r) ? a.filter((x) => x !== r) : [...a, r]);
  return /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: collapsed ? 0 : 10,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  } }, label), !collapsed && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 60px", gap: 8, marginBottom: 10 } }, /* @__PURE__ */ React.createElement(Slider, { value: topK, onChange: setTopK, min: 1, max: 15, step: 1 })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 } }, SUBGRAPH_ALL_RELATIONS.map((r) => {
    const on = active.includes(r);
    const kind = KIND_OF_REL[r] || "assoc";
    const c = KIND_COLOR[kind];
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: r,
        onClick: () => toggle(r),
        style: {
          padding: "3px 8px",
          background: on ? c : "transparent",
          border: `1px solid ${on ? c : "var(--line)"}`,
          borderRadius: 999,
          color: on ? "#fff" : "var(--ink-2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          cursor: "pointer"
        }
      },
      r
    );
  }))));
}
function GraphViz({ nodes, edges }) {
  var _a, _b;
  const W = 800, H = 640, cx = W / 2, cy = H / 2;
  const RING_RADII = [0, 160, 250, 320, 380];
  const byDepth = {};
  for (const n of nodes) {
    const d = Math.min((_a = n.depth) != null ? _a : 1, 4);
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n);
  }
  const positioned = [];
  for (const dStr of Object.keys(byDepth).sort()) {
    const d = Number(dStr);
    const arr = byDepth[d];
    const r = (_b = RING_RADII[d]) != null ? _b : 380;
    if (d === 0 || arr.length === 1) {
      positioned.push({ ...arr[0], x: cx, y: cy, r: 22, depth: d });
    } else {
      arr.forEach((n, i) => {
        const a = i / arr.length * Math.PI * 2 - Math.PI / 2 + d * 0.15;
        const nr = d === 1 ? 14 : d === 2 ? 11 : 9;
        positioned.push({
          ...n,
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          r: nr,
          depth: d
        });
      });
    }
  }
  const byId = Object.fromEntries(positioned.map((n) => [n.id, n]));
  const trunc = (s, max) => s && s.length > max ? s.slice(0, max - 1) + "…" : s || "";
  return /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: "100%", style: { display: "block" } }, edges.map((e, i) => {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) return null;
    const color = e.negative ? "#c62828" : KIND_COLOR[KIND_OF_REL[e.relation] || "assoc"] || KIND_COLOR.assoc;
    return /* @__PURE__ */ React.createElement(
      "line",
      {
        key: i,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: color,
        strokeOpacity: e.depth >= 2 ? 0.35 : 0.6,
        strokeWidth: e.depth >= 2 ? 1 : 1.4,
        strokeDasharray: e.depth >= 2 ? "4 3" : void 0
      }
    );
  }), positioned.map((n, i) => {
    const isCenter = n.depth === 0;
    const kindColor = KIND_COLOR[n.kind] || KIND_COLOR.assoc;
    return /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement(
      "circle",
      {
        cx: n.x,
        cy: n.y,
        r: n.r,
        fill: isCenter ? "#c0411a" : "#fbf6ea",
        stroke: isCenter ? "#c0411a" : kindColor,
        strokeWidth: isCenter ? 0 : 1.2
      }
    ), /* @__PURE__ */ React.createElement(
      "text",
      {
        x: n.x,
        y: n.y + n.r + 14,
        textAnchor: "middle",
        fontFamily: "var(--font-mono)",
        fontSize: isCenter ? 13 : n.depth === 1 ? 11 : 10,
        fontWeight: isCenter ? 700 : 400,
        fill: "#1f1d18"
      },
      trunc(n.label, isCenter ? 28 : 18)
    ));
  }));
}
window.ViewSubgraph = ViewSubgraph;
window.__JdmLiveGraph = LiveAnimWrapper;
const AGENT_MODELS = [
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", sub: "pool gratuit · 500 req/jour" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", sub: "pool gratuit · 20 req/jour" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", sub: "pool gratuit · 20 req/jour" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", sub: "BYOK Anthropic" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", sub: "BYOK Anthropic" },
  { value: "gpt-4o-mini", label: "GPT-4o mini", sub: "BYOK OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", sub: "BYOK OpenAI" }
];
function ViewAgent() {
  var _a;
  const _pending = typeof window !== "undefined" && ((_a = window.__jdmPendingPayload) == null ? void 0 : _a.chatbot) || null;
  if (typeof window !== "undefined" && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.chatbot;
  }
  const [model, setModel] = useState((_pending == null ? void 0 : _pending.model) || "gemini-3.1-flash-lite");
  const [thinking, setThinking] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [convo, setConvo] = useState([]);
  const [input, setInput] = useState((_pending == null ? void 0 : _pending.q) || "");
  const [streaming, setStreaming] = useState(false);
  const [poolStatus, setPoolStatus] = useState(null);
  const chatScrollRef = useRef(null);
  const needsBYOK = model.startsWith("claude-") || model.startsWith("gpt-");
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [convo, streaming]);
  const resendUserMessage = (text) => {
    if (streaming || !text) return;
    setInput(text);
    setTimeout(() => send(text), 30);
  };
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("api/pool/status");
        if (r.ok && alive) setPoolStatus(await r.json());
      } catch {
      }
    };
    load();
    const id = setInterval(load, 3e4);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const modelOptions = React.useMemo(() => {
    return AGENT_MODELS.map((m) => {
      let label = m.label;
      let sub = m.sub;
      if (poolStatus && m.value.startsWith("gemini-")) {
        const allBlown = (poolStatus.keys || []).every(
          (k) => k.invalid || k.blown_by_model && k.blown_by_model[m.value]
        );
        if (allBlown && poolStatus.keys && poolStatus.keys.length > 0) {
          label = `❌ ${label} — épuisé sur toutes les clés`;
          sub = "pool entièrement consommé aujourd'hui";
        }
      }
      return { ...m, label, sub };
    });
  }, [poolStatus]);
  const send = async (overrideMsg) => {
    const isStringOverride = typeof overrideMsg === "string";
    const effectiveMsg = isStringOverride ? overrideMsg : input;
    if (!effectiveMsg || !effectiveMsg.trim() || streaming) return;
    const userMsg = { role: "user", content: effectiveMsg };
    const historySnapshot = convo.map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? m.content || "" : m.content
    }));
    const assistantStub = { role: "assistant", thoughts: [], tools: [], content: "", error: "" };
    setConvo([...convo, userMsg, assistantStub]);
    const msg = effectiveMsg;
    if (!isStringOverride) setInput("");
    setStreaming(true);
    const patchLast = (mutator) => {
      setConvo((prev) => {
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        mutator(last);
        next[next.length - 1] = last;
        return next;
      });
    };
    try {
      const res = await fetch("api/chatbot/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: historySnapshot,
          api_key: apiKey,
          model,
          use_thinking: thinking
        })
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      const flushEvents = () => {
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
      if (buf.trim()) {
        const ev = parseSSEEvent(buf);
        if (ev) handleEvent(ev, patchLast);
      }
    } catch (e) {
      patchLast((last) => {
        last.error = String(e && e.message ? e.message : e);
      });
    } finally {
      setStreaming(false);
    }
  };
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement("style", null, `@keyframes jdm-mark-spin { to { transform: rotate(360deg); } }`), /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Module · chat LLM + outils JDM",
      title: "Chatbot LLM",
      desc: "Chat conversationnel. Le modèle a accès aux outils JDM via LangChain."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    gap: 20,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    minHeight: 500,
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { ref: chatScrollRef, style: {
    padding: "20px 24px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 22,
    maxHeight: 600,
    overflowY: "auto"
  } }, convo.length === 0 && /* @__PURE__ */ React.createElement("div", { style: {
    color: "var(--ink-3)",
    fontSize: 13,
    textAlign: "center",
    padding: "60px 0"
  } }, "Pose une question sur la langue française — l'agent ira interroger JDM."), convo.map((m, i) => /* @__PURE__ */ React.createElement(
    Message,
    {
      key: i,
      m,
      onResend: m.role === "user" ? () => resendUserMessage(m.content) : null,
      isStreaming: streaming && i === convo.length - 1 && m.role === "assistant"
    }
  )), streaming && /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 11,
    color: "var(--ink-3)",
    fontFamily: "var(--font-mono)",
    fontStyle: "italic"
  } }, "⏳ génération en cours…")), /* @__PURE__ */ React.createElement("div", { style: {
    borderTop: "1px solid var(--line-soft)",
    padding: 14,
    background: "var(--bg-elev)",
    borderRadius: "0 0 var(--radius-lg) var(--radius-lg)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end"
  } }, /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: input,
      onChange: (e) => setInput(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
          return;
        }
        if (e.key === "ArrowDown") {
          const last = [...convo].reverse().find(
            (m) => m.role === "user" && (m.content || "").trim()
          );
          if (last) {
            e.preventDefault();
            setInput(last.content);
          }
        }
      },
      placeholder: "Pose une question sur la langue française…",
      rows: 2,
      className: "focus-ring",
      style: {
        flex: 1,
        resize: "none",
        padding: "10px 12px",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink)",
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: 1.5,
        outline: "none"
      }
    }
  ), /* @__PURE__ */ React.createElement(Button, { onClick: send, size: "lg", disabled: streaming || !input.trim() }, streaming ? "…" : "Envoyer")), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    fontSize: 11,
    color: "var(--ink-3)",
    display: "flex",
    alignItems: "center",
    gap: 8
  } }, /* @__PURE__ */ React.createElement("span", { className: "kbd" }, "Entrée"), " envoyer", /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.4 } }, "·"), /* @__PURE__ */ React.createElement("span", { className: "kbd" }, "⇧ Entrée"), " nouvelle ligne", /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, "Modèle : ", /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink)" } }, model)))))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    position: "sticky",
    top: 80
  } }, /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement(Field, { label: "Modèle" }, /* @__PURE__ */ React.createElement(Select, { value: model, options: modelOptions, onChange: setModel })), /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--ink-2)",
    cursor: "pointer",
    marginBottom: needsBYOK ? 14 : 0
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: thinking,
      onChange: (e) => setThinking(e.target.checked),
      style: { accentColor: "var(--accent)" }
    }
  ), "Raisonnement (chain-of-thought)"), needsBYOK && /* @__PURE__ */ React.createElement(Field, { label: "Clé API", hint: "Conservée en session uniquement." }, /* @__PURE__ */ React.createElement(Input, { value: apiKey, onChange: setApiKey, placeholder: model.startsWith("claude-") ? "sk-ant-…" : "sk-…", mono: true }))), /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 10
  } }, "Outils JDM"), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: "var(--ink-2)",
    lineHeight: 1.5
  } }, "L'agent dispose d'une trentaine d'outils LangChain wrappant le client JDM : exploration, vérification, désambiguïsation, inférence, sous-graphe.")), /* @__PURE__ */ React.createElement(PoolWidget, { model }))));
}
function parseSSEEvent(raw) {
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) {
      const v = line.slice(5).replace(/^ /, "");
      data += (data ? "\n" : "") + v;
    }
  }
  if (!data) return null;
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = { text: data };
  }
  return { event, data: parsed };
}
function handleEvent(ev, patchLast) {
  const d = ev.data || {};
  switch (ev.event) {
    case "text":
      patchLast((last) => {
        last.content = d.text || "";
      });
      break;
    case "done":
      break;
    case "viz":
      if (d && d.term) patchLast((last) => {
        last.viz = d;
      });
      break;
    case "error":
      patchLast((last) => {
        last.error = d.text || "Erreur inconnue.";
      });
      break;
    default:
      break;
  }
}
function AgentVizBubble({ viz }) {
  const isLive = viz && viz.format === "live" && Array.isArray(viz.nodes);
  const Live = typeof window !== "undefined" ? window.__JdmLiveGraph : null;
  const [html, setHtml] = useState(viz && viz.html ? viz.html : "");
  const [err, setErr] = useState("");
  React.useEffect(() => {
    if (isLive || viz && viz.html) {
      if (viz.html) setHtml(viz.html);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("api/subgraph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...viz, format: "html" })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const dd = await res.json();
        if (!alive) return;
        if (dd.html) setHtml(dd.html);
        else setErr(dd.message || "Visualisation indisponible.");
      } catch (e) {
        if (alive) setErr(String(e && e.message ? e.message : e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify(viz)]);
  return /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginBottom: 6 } }, "🕸️ Sous-graphe : ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, viz.term)), isLive && Live ? /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    minHeight: 360,
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    background: "var(--bg)",
    overflow: "hidden"
  } }, React.createElement(Live, {
    term: viz.term,
    nodes: viz.nodes,
    edges: viz.edges || [],
    layout: "tree"
  })) : err ? /* @__PURE__ */ React.createElement("div", { style: { color: "var(--jdm-magenta)", fontSize: 12 } }, "⚠️ ", err) : html ? /* @__PURE__ */ React.createElement(
    "iframe",
    {
      title: `viz-${viz.term}`,
      srcDoc: html,
      sandbox: "allow-scripts allow-same-origin",
      style: {
        width: "100%",
        height: 420,
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--bg)"
      }
    }
  ) : /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12.5, padding: "14px 0" } }, "… génération du graphe …"));
}
function Message({ m, onResend, isStreaming = false }) {
  if (m.role === "user") {
    return /* @__PURE__ */ React.createElement(UserMessage, { content: m.content, onResend });
  }
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 6,
    marginTop: 2,
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Animation : pendant que le LLM réfléchit ou streame, l'icône
    // tourne sur elle-même (remplace le texte « Réflexion en cours »).
    animation: isStreaming ? "jdm-mark-spin 1.8s linear infinite" : "none"
  } }, /* @__PURE__ */ React.createElement(JDMMark, { size: 18 })), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, m.content && /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "jdm-agent-bubble",
      style: { fontSize: 14, color: "var(--ink)", lineHeight: 1.6 },
      dangerouslySetInnerHTML: { __html: renderMarkdownLite(m.content) }
    }
  ), m.viz && /* @__PURE__ */ React.createElement(AgentVizBubble, { viz: m.viz }), m.error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 10,
    marginTop: 8,
    background: "rgba(200, 58, 115, 0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 12
  } }, "⚠️ ", m.error)));
}
function UserMessage({ content, onResend }) {
  const [hovering, setHovering] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1e3);
    } catch {
    }
  };
  const btn = {
    background: "transparent",
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 11,
    color: "var(--ink-3)",
    lineHeight: 1
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
      style: { display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 6 }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      gap: 4,
      alignItems: "center",
      opacity: hovering ? 1 : 0,
      transition: "opacity 0.15s",
      marginBottom: 2
    } }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: copy, title: "Copier", style: {
      ...btn,
      color: copied ? "var(--jdm-green)" : "var(--ink-3)",
      borderColor: copied ? "var(--jdm-green)" : "var(--line)"
    } }, copied ? "✓" : "⎘"), onResend && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onResend, title: "Renvoyer", style: btn }, "↻")),
    /* @__PURE__ */ React.createElement("div", { style: {
      maxWidth: "70%",
      padding: "10px 14px",
      background: "var(--accent)",
      color: "var(--bg)",
      borderRadius: "var(--radius-lg)",
      fontSize: 14,
      lineHeight: 1.5
    } }, content)
  );
}
function renderMarkdownLite(s) {
  s = s || "";
  if (typeof window !== "undefined" && window.marked) {
    try {
      window.marked.setOptions({ gfm: true, breaks: true });
      return window.marked.parse(s);
    } catch {
    }
  }
  return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>').replace(/\n/g, "<br/>");
}
function PoolWidget({ model }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const r = await fetch("api/pool/status");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
      setError("");
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
    }
  };
  React.useEffect(() => {
    load();
  }, []);
  const rotate = async () => {
    setBusy(true);
    try {
      const r = await fetch("api/pool/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, skip_current: true })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
      setError("");
    } catch (e) {
      setError(String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };
  if (!status) {
    return /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 11,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 8
    } }, "Pool Gemini"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)" } }, error || "Chargement…"));
  }
  const keys = status.keys || [];
  const isGemini = model && model.startsWith("gemini-");
  return /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 10
  } }, "Pool Gemini · ", keys.length, " clé", keys.length > 1 ? "s" : ""), keys.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)" } }, "Pool vide — configure ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "GOOGLE_API_KEYS"), ".") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 4, marginBottom: 10 } }, keys.map((k, i) => {
    const blownHere = isGemini && k.blown_by_model && k.blown_by_model[model];
    const status_icon = k.invalid ? "🚫" : blownHere ? "❌" : k.is_current ? "✅" : "○";
    const status_color = k.invalid ? "var(--jdm-magenta)" : blownHere ? "var(--jdm-orange)" : k.is_current ? "var(--jdm-green)" : "var(--ink-3)";
    return /* @__PURE__ */ React.createElement("div", { key: i, style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 8px",
      background: k.is_current ? "var(--bg-elev)" : "transparent",
      borderRadius: 3,
      fontFamily: "var(--font-mono)",
      fontSize: 11
    } }, /* @__PURE__ */ React.createElement("span", { style: { color: status_color } }, status_icon), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, "Clé ", i + 1), k.is_current && /* @__PURE__ */ React.createElement("span", { style: {
      marginLeft: "auto",
      fontSize: 9,
      color: "var(--jdm-green)",
      textTransform: "uppercase",
      letterSpacing: "0.08em"
    } }, "actuelle"));
  })), isGemini && status.current_model && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "var(--ink-3)", marginBottom: 8, fontFamily: "var(--font-mono)" } }, "❌ = épuisée pour ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, model), " aujourd'hui"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", full: true, onClick: rotate, disabled: busy || keys.length === 0 }, busy ? "↻ Rotation…" : "↻ Rotation manuelle"), error && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    padding: 8,
    background: "rgba(200,58,115,0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 11
  } }, error));
}
window.ViewAgent = ViewAgent;
function ViewChat() {
  const api = typeof window !== "undefined" && window.JarvisChat || null;
  const store = api && api.store;
  const renderMd = api && api.renderMd ? api.renderMd : (t) => t || "";
  const VizBubble = api && api.VizBubble ? api.VizBubble : null;
  const [, _force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!store) return void 0;
    return store.subscribe(_force);
  }, [store]);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const snap = store ? store.get() : { msgs: [], busy: false };
  const msgs = snap.msgs || [];
  const busy = !!snap.busy;
  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, busy]);
  const send = () => {
    const text = draft.trim();
    if (!text || !store) return;
    setDraft("");
    store.send(text);
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === "ArrowDown") {
      const last = [...msgs].reverse().find((m) => m.who === "me" && (m.text || "").trim());
      if (last) {
        e.preventDefault();
        setDraft(last.text);
      }
    }
  };
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Orchestrateur",
      title: "Jarvis · Chat",
      desc: "Discute avec l'orchestrateur en plein écran : il supervise et lance les agents, explique le graphe JDM. Même conversation que le volet latéral (le fil continue en fond)."
    }
  ), !store ? /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", padding: "48px 0", textAlign: "center" } }, "Le chat n'est pas encore prêt (mascotte non chargée). Recharge la page.") : /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 240px)",
    minHeight: 440,
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    background: "var(--bg-card)"
  } }, /* @__PURE__ */ React.createElement("div", { ref: scrollRef, className: "jb-chat-body", style: { flex: 1 } }, msgs.map((m, i) => m.who === "viz" ? VizBubble ? React.createElement(VizBubble, { key: i, viz: m.viz }) : /* @__PURE__ */ React.createElement("div", { key: i, className: "jb-msg jb-msg--bot" }, "[graphe]") : m.who === "bot" && m.text ? /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      className: "jb-msg jb-msg--bot jb-md",
      dangerouslySetInnerHTML: { __html: renderMd(m.text) }
    }
  ) : /* @__PURE__ */ React.createElement("div", { key: i, className: `jb-msg jb-msg--${m.who}` }, m.text)), busy && /* @__PURE__ */ React.createElement("div", { className: "jb-msg jb-msg--bot jb-msg--typing" }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    padding: 12,
    borderTop: "1px solid var(--line-soft)",
    background: "var(--bg-card)"
  } }, /* @__PURE__ */ React.createElement(
    "textarea",
    {
      ref: inputRef,
      className: "jb-chat-input",
      rows: "2",
      placeholder: "Écris ton message à Jarvis…",
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown,
      style: { flex: 1 }
    }
  ), /* @__PURE__ */ React.createElement(Button, { onClick: send, disabled: busy || !draft.trim() }, "Envoyer"))));
}
const JARVIS_AGENTS = [
  {
    id: "enrich",
    consolidates: true,
    // lit le registry de consolidation (vs file_preview)
    title: "Enrichissement",
    kicker: "Agent 1",
    desc: "Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.",
    accent: "var(--jdm-magenta)",
    loopOf: "proposition → validation → consolidation",
    produces: "triplets consolidés (.enrich)",
    category: "Production",
    tags: ["proposition", "validation", "consolidation", "inférence", "LLMDrops"],
    steps: [
      { n: "Proposition", d: "propose des triplets candidats sur la relation cible" },
      { n: "Validation", d: "factcheck JDM + inférence (effort 1/2)" },
      { n: "Consolidation", d: "écrit dans le .enrich ceux qui passent" }
    ]
  },
  {
    id: "audit",
    title: "Audit sémantique",
    kicker: "Agent 2",
    desc: "Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit deux sections (verdicts + META).",
    accent: "var(--jdm-cyan)",
    loopOf: "sens → triplet → verdict",
    produces: "verdicts par sens (.audit)",
    category: "Qualité",
    tags: ["polysémie", "sens", "verdict", "META"],
    steps: [
      { n: "Disambiguation", d: "isole les sens dominants du terme" },
      { n: "Cross-check", d: "audite chaque triplet par sens" },
      { n: "Verdict", d: "LEGITIME / CONTRASTIF / À REVOIR / NEGATION" }
    ]
  },
  {
    id: "gap",
    title: "Détection de trous",
    kicker: "Agent 3",
    desc: "Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l'enrichissement de façon ciblée. Sortie : rapport JSON.",
    accent: "var(--jdm-green)",
    loopOf: "parcours → diagnostic → trous",
    produces: "rapport de trous (MISSING/LOW)",
    category: "Exploration",
    tags: ["couverture", "trous", "diagnostic"],
    steps: [
      { n: "Parcours", d: "inventorie les relations existantes" },
      { n: "Diagnostic", d: "compare à la couverture attendue" },
      { n: "Trous", d: "liste les MISSING / NEGATIVE / LOW_COVERAGE" }
    ]
  },
  {
    id: "signalement",
    title: "Signalement",
    kicker: "Agent 4",
    desc: "Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.",
    accent: "var(--jdm-orange)",
    loopOf: "inventaire → flag → catégorisation",
    produces: "suspects flaggés (.err)",
    category: "Qualité",
    tags: ["suspects", "incohérence", "polarité", "annotations"],
    steps: [
      { n: "Inventaire", d: "récupère les triplets candidats à inspecter" },
      { n: "Flag", d: "jugement linguistique LLM par triplet" },
      { n: "Catégorisation", d: "sémantique / polarité / annotation_oubliée / …" }
    ]
  },
  {
    id: "stats",
    title: "Stats",
    kicker: "Agent 5",
    desc: "Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré (.stat).",
    accent: "var(--jdm-violet)",
    loopOf: "inventaire → agrégation",
    produces: "récap structuré (.stat)",
    category: "Synthèse",
    tags: ["distribution", "compteurs", "poids"],
    steps: [
      { n: "Inventaire", d: "récupère les relations & leurs poids" },
      { n: "Agrégation", d: "distribution par relation & par terme" }
    ]
  },
  {
    id: "annotation",
    title: "Annotation sémantique",
    kicker: "Agent 6",
    desc: "Annote les triplets existants selon la taxonomie 4 catégories (constitutif / contrastif / non spécifique / exception). L'annotation qualifie le LIEN, pas l'objet. Produit un fichier .annot deux sections (annotations + signalement des désaccords avec JDM existant).",
    accent: "var(--jdm-yellow)",
    loopOf: "triplet → jugement → catégorie",
    produces: "annotations (.annot)",
    category: "Production",
    tags: ["constitutif", "contrastif", "taxonomie", "lien"],
    steps: [
      { n: "Lecture", d: "récupère les triplets à annoter pour le terme" },
      { n: "Jugement", d: "décide constitutif / contrastif / non spécifique / exception" },
      { n: "Sortie", d: "écrit dans .annot + section SIGNALEMENT si désaccord JDM" }
    ]
  }
];
const J_SECTIONS = [
  { id: "config", label: "Configuration" },
  { id: "supervision", label: "Supervision" },
  { id: "repertoire", label: "Répertoire" }
];
const J_PANELS = [
  ...J_SECTIONS,
  ...JARVIS_AGENTS.map((f) => ({ id: f.id, label: f.kicker }))
];
const JPANEL_BASIS = `${100 / J_PANELS.length}%`;
const SUBMITTABLE_FLOWS = /* @__PURE__ */ new Set([
  "enrich",
  "audit",
  "signalement",
  "stats",
  "annotation"
]);
const AGENT_ICON = {
  enrich: "🌱",
  audit: "🔍",
  gap: "🕳️",
  signalement: "⚠️",
  stats: "📊",
  annotation: "🏷️"
};
const agentIcon = (id) => AGENT_ICON[id] || "🦾";
const _ICON_PICK_POOL = [
  "🧩",
  "🔮",
  "🧠",
  "📚",
  "🗂️",
  "🔗",
  "🧪",
  "🛰️",
  "🧭",
  "📐",
  "🔧",
  "⚙️",
  "🪛",
  "📎",
  "🧱",
  "🪐",
  "🌿",
  "🦉",
  "🐝",
  "🦊",
  "📡",
  "🔦",
  "🧮",
  "✒️",
  "🗺️",
  "🎯",
  "🧰",
  "🔬",
  "📈",
  "🧷",
  "🌱",
  "🔍",
  "🕳️",
  "⚠️",
  "📊",
  "🏷️",
  "🤖",
  "🦾",
  "💡",
  "🧬"
];
const AGENT_BRIEF = {
  enrich: "Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence) et consolide ceux qui passent dans un .enrich prêt pour LLMDrops.",
  audit: "Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives ou à corriger. Produit un .audit en deux sections (verdicts + META).",
  gap: "Inventorie les relations d’un terme et repère les trous de couverture (manquantes, faibles, négatives) pour cibler l’enrichissement. Sortie : rapport de trous.",
  signalement: "Parcourt les triplets d’un terme et flag ceux qui paraissent suspects (jugement linguistique), avec catégorie et justification. Produit un .err pour un mainteneur.",
  stats: "Mesure la couverture d’un terme et/ou d’une relation : totaux, positifs/négatifs, poids, distribution — avec quelques observations clés en prose.",
  annotation: "Annote les triplets d’un terme (constitutif / contrastif / exception…) et signale les désaccords avec JDM. Produit un fichier .annot."
};
function JRobotHead({ size = 30, title }) {
  const accent = "#2BD4C0";
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      viewBox: "0 0 80 74",
      width: size,
      height: Math.round(size * 74 / 80),
      style: { display: "block", overflow: "visible" },
      role: "img",
      "aria-label": title || "Jarvis"
    },
    title && /* @__PURE__ */ React.createElement("title", null, title),
    /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "jrhbody", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0", stopColor: "#ffffff" }), /* @__PURE__ */ React.createElement("stop", { offset: "0.55", stopColor: "#f3eee2" }), /* @__PURE__ */ React.createElement("stop", { offset: "1", stopColor: "#dcd4c4" })), /* @__PURE__ */ React.createElement("linearGradient", { id: "jrhjdm", x1: "0", y1: "0", x2: "1", y2: "0" }, /* @__PURE__ */ React.createElement("stop", { offset: "0", stopColor: "#E63B7A" }), /* @__PURE__ */ React.createElement("stop", { offset: "0.25", stopColor: "#F5C518" }), /* @__PURE__ */ React.createElement("stop", { offset: "0.5", stopColor: "#5FB94A" }), /* @__PURE__ */ React.createElement("stop", { offset: "0.75", stopColor: "#2BB8D4" }), /* @__PURE__ */ React.createElement("stop", { offset: "1", stopColor: "#8A5CD4" })), /* @__PURE__ */ React.createElement("linearGradient", { id: "jrhvisor", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0", stopColor: "#33353f" }), /* @__PURE__ */ React.createElement("stop", { offset: "0.5", stopColor: "#1a1b22" }), /* @__PURE__ */ React.createElement("stop", { offset: "1", stopColor: "#0b0c10" }))),
    /* @__PURE__ */ React.createElement("line", { x1: "40", y1: "14", x2: "40", y2: "6", stroke: "#b8b0a0", strokeWidth: "2", strokeLinecap: "round" }),
    /* @__PURE__ */ React.createElement("circle", { cx: "40", cy: "4.5", r: "3", fill: accent }),
    /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "52", height: "48", rx: "19", fill: "url(#jrhbody)", stroke: "rgba(40,32,22,0.14)", strokeWidth: "1.4" }),
    /* @__PURE__ */ React.createElement("rect", { x: "10", y: "32", width: "6", height: "14", rx: "3", fill: "#cfc8b8" }),
    /* @__PURE__ */ React.createElement("rect", { x: "64", y: "32", width: "6", height: "14", rx: "3", fill: "#cfc8b8" }),
    /* @__PURE__ */ React.createElement("rect", { x: "20", y: "25", width: "40", height: "28", rx: "13", fill: "url(#jrhjdm)", opacity: "0.95" }),
    /* @__PURE__ */ React.createElement("rect", { x: "22", y: "27", width: "36", height: "24", rx: "11", fill: "url(#jrhvisor)" }),
    /* @__PURE__ */ React.createElement("g", null, /* @__PURE__ */ React.createElement("circle", { cx: "33", cy: "39", r: "4.4", fill: accent }), /* @__PURE__ */ React.createElement("circle", { cx: "47", cy: "39", r: "4.4", fill: accent }), /* @__PURE__ */ React.createElement("circle", { cx: "31.5", cy: "37.5", r: "1.4", fill: "#fff", opacity: "0.85" }), /* @__PURE__ */ React.createElement("circle", { cx: "45.5", cy: "37.5", r: "1.4", fill: "#fff", opacity: "0.85" }))
  );
}
function FileSubmitButton({ filePath, agentId, submitted, onDone, compact, running }) {
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const [state, setState] = useState("idle");
  const [done, setDone] = useState(!!submitted);
  React.useEffect(() => {
    setDone(!!submitted);
  }, [submitted]);
  if (!filePath || !SUBMITTABLE_FLOWS.has(agentId)) return null;
  const fileName = filePath.split(/[\\/]/).slice(-1)[0];
  const canSubmit = _envHasDrops;
  const submit = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!canSubmit || state === "sending" || done) return;
    if (running) {
      const ext = agentId === "enrich" ? "enrich" : agentId === "audit" ? "audit" : agentId === "signalement" ? "err" : agentId === "stats" ? "stat" : agentId === "annotation" ? "annot" : "txt";
      const ok = window.confirm(
        "Le flow n'est pas encore terminé — le fichier ." + ext + " contient seulement les triplets produits jusqu'à maintenant.\n\nSoumettre maintenant quand même ?"
      );
      if (!ok) return;
    }
    setState("sending");
    let _model = "";
    try {
      const cfg = typeof window !== "undefined" && window.__JDM_JARVIS_CONFIG__ || {};
      _model = cfg.llm || "";
    } catch (e2) {
    }
    try {
      const r = await fetch("api/productions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [fileName], archived: false, api_key: "", model_name: _model })
      });
      const data = await r.json();
      const res = (data.results || [])[0] || {};
      if (res.ok) {
        setDone(true);
        setState("idle");
        onDone && onDone();
      } else {
        setState("error");
        setTimeout(() => setState("idle"), 6e3);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 6e3);
    }
  };
  if (done) {
    return /* @__PURE__ */ React.createElement(
      Button,
      {
        size: "sm",
        variant: "ghost",
        disabled: true,
        title: "Déjà soumis au LLMDrops JDM",
        style: { color: "var(--jdm-green)", opacity: 1 }
      },
      "✓ Soumis"
    );
  }
  const label = state === "sending" ? "⏳ Envoi…" : state === "error" ? "✗ Échec" : "📤 Soumettre";
  return /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      disabled: !canSubmit || state === "sending",
      onClick: submit,
      title: canSubmit ? "Soumettre ce fichier au LLMDrops JDM (clé serveur)" : "Configure JDM_DROPS_API_KEY côté serveur pour activer la soumission"
    },
    compact ? state === "sending" ? "⏳" : state === "error" ? "✗" : "📤" : label
  );
}
const _JARVIS_RUNS = {};
const _JARVIS_LISTENERS = {};
function _emptyJarvisRun(agentId) {
  return {
    agentId,
    status: "idle",
    // 'idle' | 'running' | 'done' | 'error'
    headline: "",
    log: [],
    metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
    submitted: false,
    // passé à true par JarvisRun quand l'upload LLMDrops succès
    accepted: [],
    narrationHTML: "",
    filePreview: "",
    filePath: null,
    resumeState: null,
    // internes — pas lus par le composant
    _abortCtrl: null,
    _startTime: null,
    _elapsedTimer: null,
    _prevConsolidatedCount: 0
  };
}
function _slotAgent(slot) {
  return String(slot || "").split("#")[0];
}
function _allocSlot(agentId) {
  const free = (s) => !s || s.status === "idle";
  if (free(_JARVIS_RUNS[agentId])) return agentId;
  for (let n = 2; n < 100; n++) {
    const k = agentId + "#" + n;
    if (free(_JARVIS_RUNS[k])) return k;
  }
  return agentId + "#" + Math.floor(Date.now() / 1e3);
}
function _toolSteps(flowOrId) {
  const flow = flowOrId && typeof flowOrId === "object" ? flowOrId : typeof _flowById === "function" ? _flowById(flowOrId) : null;
  const id = flow ? flow.id : flowOrId;
  return typeof AGENT_TOOL_STEPS !== "undefined" && AGENT_TOOL_STEPS[id] || flow && flow._spec && flow._spec.tool_steps || {};
}
function _slotForRun(agentId, runId) {
  if (runId) {
    for (const k of Object.keys(_JARVIS_RUNS)) {
      const s = _JARVIS_RUNS[k];
      if (_slotAgent(k) === agentId && s && s.runId === runId) return k;
    }
  }
  return agentId;
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
    if (subs) for (const cb of subs) {
      try {
        cb();
      } catch {
      }
    }
    const glob = _JARVIS_LISTENERS["*"];
    if (glob) for (const cb of glob) {
      try {
        cb();
      } catch {
      }
    }
  },
  subscribe(agentId, cb) {
    if (!_JARVIS_LISTENERS[agentId]) _JARVIS_LISTENERS[agentId] = /* @__PURE__ */ new Set();
    _JARVIS_LISTENERS[agentId].add(cb);
    return () => {
      if (_JARVIS_LISTENERS[agentId]) _JARVIS_LISTENERS[agentId].delete(cb);
    };
  },
  activeFlowIds() {
    return Object.entries(_JARVIS_RUNS).filter(([, s]) => s.status === "running").map(([id]) => id);
  },
  stop(agentId) {
    const cur = this.get(agentId);
    if (cur.runId) {
      fetch(`api/jarvis/runs/${encodeURIComponent(cur.runId)}/cancel`, {
        method: "POST"
      }).catch(() => {
      });
      const ts = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
      cur.log = [...cur.log, {
        t: ts(),
        tag: "[stop]",
        kind: "iter",
        msg: "Demande d'arrêt envoyée — le flow se termine après le chunk en cours (~5-15s)."
      }];
      this._emit(agentId);
    }
    if (cur._abortCtrl) try {
      cur._abortCtrl.abort();
    } catch {
    }
  },
  reset(agentId) {
    const cur = this.get(agentId);
    if (cur._abortCtrl) try {
      cur._abortCtrl.abort();
    } catch {
    }
    if (cur._elapsedTimer) clearInterval(cur._elapsedTimer);
    _localRunIdSet(agentId, null);
    _JARVIS_RUNS[agentId] = _emptyJarvisRun(agentId);
    this._emit(agentId);
  },
  // Helpers internes ─────────────────────────────────────
  _resetRunData(cur) {
    Object.assign(cur, {
      status: "running",
      log: [],
      accepted: [],
      narrationHTML: "",
      filePreview: "",
      filePath: null,
      headline: "",
      metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
      submitted: false,
      _prevConsolidatedCount: 0,
      _startTime: Date.now(),
      runId: null
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
    if (cur.status === "running") return;
    this._resetRunData(cur);
    cur.status = "running";
    cur.runId = runId;
    if (knownHeadline) cur.headline = knownHeadline;
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(agentId);
    await this._consumeStream(
      agentId,
      `api/jarvis/runs/${encodeURIComponent(runId)}/stream`,
      { method: "GET" },
      cur._abortCtrl
    );
  },
  async start(agentId, { params, isResume, resumeState }) {
    const cur = this.get(agentId);
    if (cur.status === "running") return;
    cur.params = params || {};
    if (!isResume) {
      this._resetRunData(cur);
    } else {
      const ts = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
      cur.status = "running";
      cur.log = [...cur.log, { t: ts(), tag: "[resume]", kind: "iter", msg: "Reprise après abort PerDay…" }];
    }
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(agentId);
    const flowParams = {
      ...params,
      ...isResume && resumeState ? { resume_state: resumeState } : {}
    };
    await this._consumeStream(
      agentId,
      `api/jarvis/${agentId}/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, params: flowParams })
      },
      cur._abortCtrl
    );
  },
  // Boucle de consommation SSE partagée par start() et attach(). Le
  // dispatchEv gère désormais 'run_id' (persisté en localStorage pour
  // reconnexion ultérieure) et 'ping' (keepalive — ignoré).
  async _consumeStream(agentId, url, fetchInit, abortCtrl) {
    const cur = this.get(agentId);
    const ts = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
    try {
      const res = await fetch(url, {
        ...fetchInit,
        signal: abortCtrl.signal
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      const dispatchEv = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case "run_id":
            if (d.run_id) {
              cur.runId = d.run_id;
              _localRunIdSet(agentId, d.run_id);
            }
            break;
          case "ping":
            break;
          case "headline":
            cur.headline = d.text || "";
            if (d.run_id && !cur.runId) {
              cur.runId = d.run_id;
              _localRunIdSet(agentId, d.run_id);
            }
            cur.log = [...cur.log, { t: ts(), tag: "[start]", kind: "iter", msg: d.text || "" }];
            break;
          case "jarvis": {
            const msgs = d.messages || [];
            const assistant = msgs.filter((m) => m.role === "assistant").slice(-1)[0];
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
            if (typeof d.tokens_estimate === "number") {
              cur.metrics = { ...cur.metrics, tokens: d.tokens_estimate };
            }
            if (Array.isArray(d.consolidated)) {
              cur.accepted = d.consolidated.map((c) => ({
                type: "consolidated",
                subject: c.term || "",
                relation: c.relation || "",
                target: c.target || "",
                explanation: c.explanation || "",
                // Compat ancien rendu (label/score) : conservés au cas où.
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: "✓"
              }));
              const _prevLogged = cur._loggedAcceptedCount || 0;
              const nbNew = d.consolidated.length - _prevLogged;
              if (nbNew > 0) {
                const newOnes = d.consolidated.slice(_prevLogged);
                for (const c of newOnes) {
                  cur.log = [...cur.log, {
                    t: ts(),
                    tag: "[ok]",
                    kind: "accept",
                    msg: `${c.term} | ${c.relation} | ${c.target}`,
                    triplet: {
                      term: c.term,
                      relation: c.relation,
                      target: c.target,
                      schema: c.schema || "",
                      explanation: c.explanation || ""
                    }
                  }];
                }
              }
              cur._loggedAcceptedCount = d.consolidated.length;
            }
            if (typeof d.file_preview === "string") cur.filePreview = d.file_preview;
            if (d.file_path) {
              cur.filePath = d.file_path;
              const fileMsg = `Fichier : ${d.file_path}`;
              const alreadyLogged = cur.log.some(
                (l) => l.tag === "[file]" && l.msg === fileMsg
              );
              if (!alreadyLogged) {
                cur.log = [...cur.log, {
                  t: ts(),
                  tag: "[file]",
                  kind: "accept",
                  msg: fileMsg
                }];
              }
            }
            break;
          }
          case "cancelled":
            cur.log = [...cur.log, { t: ts(), tag: "[stop]", kind: "iter", msg: d.text || "Flow annulé." }];
            cur.status = "done";
            _localRunIdSet(agentId, null);
            break;
          case "done":
            if (cur.status !== "done") {
              cur.log = [...cur.log, { t: ts(), tag: "[done]", kind: "accept", msg: "Flow terminé." }];
              cur.status = "done";
            }
            _localRunIdSet(agentId, null);
            break;
          case "error":
            cur.log = [...cur.log, { t: ts(), tag: "[err]", kind: "reject", msg: d.text || "erreur" }];
            cur.status = "error";
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
      if (cur.status === "running") cur.status = "done";
    } catch (e) {
      if (cur._abortCtrl && cur._abortCtrl.signal.aborted) {
        cur.log = [...cur.log, { t: ts(), tag: "[stop]", kind: "iter", msg: "Observation arrêtée (le flow continue côté serveur)." }];
        cur.status = "idle";
      } else {
        cur.log = [...cur.log, { t: ts(), tag: "[err]", kind: "reject", msg: String(e && e.message ? e.message : e) }];
        cur.status = "error";
        _localRunIdSet(agentId, null);
      }
    } finally {
      if (cur._elapsedTimer) {
        clearInterval(cur._elapsedTimer);
        cur._elapsedTimer = null;
      }
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
    try {
      local = _localRunIdMap();
    } catch {
    }
    const agentIds = Object.keys(local);
    if (agentIds.length === 0) return;
    let serverRuns = [];
    try {
      const r = await fetch("api/jarvis/runs");
      if (r.ok) {
        const d = await r.json();
        serverRuns = d.runs || [];
      }
    } catch {
    }
    const activeOnServer = new Map(
      serverRuns.filter((s) => s.status === "starting" || s.status === "running").map((s) => [s.run_id, s])
    );
    for (const agentId of agentIds) {
      const runId = local[agentId];
      if (!runId) continue;
      const serverInfo = activeOnServer.get(runId);
      if (!serverInfo) {
        _localRunIdSet(agentId, null);
        continue;
      }
      this.attach(agentId, runId, serverInfo.headline).catch(() => {
      });
    }
  }
};
const _JARVIS_LS_KEY = "jdm_jarvis_runs_v1";
function _localRunIdMap() {
  try {
    const raw = localStorage.getItem(_JARVIS_LS_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}
function _localRunIdSet(agentId, runId) {
  try {
    const cur = _localRunIdMap();
    if (runId) cur[agentId] = runId;
    else delete cur[agentId];
    localStorage.setItem(_JARVIS_LS_KEY, JSON.stringify(cur));
  } catch {
  }
}
if (typeof window !== "undefined") window.__jdmJarvisStore = JarvisStore;
function useJarvisRunState(agentId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe(agentId, force), [agentId]);
  return JarvisStore.get(agentId);
}
function useJarvisActiveSet() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe("*", force), []);
  return new Set(JarvisStore.activeFlowIds());
}
const _OBS_RUNS = {};
const _OBS_LISTENERS = {};
function _emptyObsRun(runId, agentId) {
  return {
    runId,
    agentId: agentId || "",
    status: "idle",
    headline: "",
    log: [],
    accepted: [],
    narrationHTML: "",
    filePreview: "",
    filePath: null,
    metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
    submitted: false,
    _observing: false,
    _abortCtrl: null,
    _prevConsolidatedCount: 0,
    _loggedAcceptedCount: 0
  };
}
const ObsStore = {
  getRun(runId) {
    if (!_OBS_RUNS[runId]) _OBS_RUNS[runId] = _emptyObsRun(runId);
    return _OBS_RUNS[runId];
  },
  _emit(runId) {
    const s = _OBS_LISTENERS[runId];
    if (s) for (const cb of s) {
      try {
        cb();
      } catch {
      }
    }
    const g = _OBS_LISTENERS["*"];
    if (g) for (const cb of g) {
      try {
        cb();
      } catch {
      }
    }
  },
  subscribe(runId, cb) {
    if (!_OBS_LISTENERS[runId]) _OBS_LISTENERS[runId] = /* @__PURE__ */ new Set();
    _OBS_LISTENERS[runId].add(cb);
    return () => {
      if (_OBS_LISTENERS[runId]) _OBS_LISTENERS[runId].delete(cb);
    };
  },
  observe(runId, agentId, headline) {
    if (!runId) return;
    const cur = this.getRun(runId);
    if (cur._observing) return;
    cur._observing = true;
    cur.agentId = agentId || cur.agentId;
    if (headline && !cur.headline) cur.headline = headline;
    if (cur.status === "idle") cur.status = "running";
    cur._abortCtrl = new AbortController();
    this._emit(runId);
    this._consume(runId, cur).finally(() => {
      cur._observing = false;
    });
  },
  stopObs(runId) {
    if (!runId) return;
    const cur = this.getRun(runId);
    fetch(`api/jarvis/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }).catch(() => {
    });
    cur.log = [...cur.log, {
      t: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
      tag: "[stop]",
      kind: "iter",
      msg: "Demande d'arrêt envoyée — fin après le chunk en cours (~5-15s)."
    }];
    this._emit(runId);
  },
  async _consume(runId, cur) {
    const ts = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
    const emit = () => this._emit(runId);
    try {
      const res = await fetch(
        `api/jarvis/runs/${encodeURIComponent(runId)}/stream`,
        { signal: cur._abortCtrl.signal }
      );
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      const onEv = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case "ping":
          case "run_id":
            break;
          case "headline":
            cur.headline = d.text || cur.headline;
            break;
          case "jarvis": {
            const msgs = d.messages || [];
            const a = msgs.filter((m) => m.role === "assistant").slice(-1)[0];
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
            if (typeof d.tokens_estimate === "number") cur.metrics = { ...cur.metrics, tokens: d.tokens_estimate };
            if (Array.isArray(d.consolidated)) {
              cur.accepted = d.consolidated.map((c) => ({
                type: "consolidated",
                subject: c.term || "",
                relation: c.relation || "",
                target: c.target || "",
                explanation: c.explanation || "",
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: "✓"
              }));
              const prev = cur._loggedAcceptedCount || 0;
              const nbNew = d.consolidated.length - prev;
              if (nbNew > 0) for (const c of d.consolidated.slice(prev)) cur.log = [...cur.log, {
                t: ts(),
                tag: "[ok]",
                kind: "accept",
                msg: `${c.term} | ${c.relation} | ${c.target}`,
                triplet: { term: c.term, relation: c.relation, target: c.target, schema: c.schema || "", explanation: c.explanation || "" }
              }];
              cur._loggedAcceptedCount = d.consolidated.length;
            }
            if (typeof d.file_preview === "string") cur.filePreview = d.file_preview;
            if (d.file_path) {
              cur.filePath = d.file_path;
              const fm = `Fichier : ${d.file_path}`;
              if (!cur.log.some((l) => l.tag === "[file]" && l.msg === fm))
                cur.log = [...cur.log, { t: ts(), tag: "[file]", kind: "accept", msg: fm }];
            }
            break;
          }
          case "cancelled":
            cur.log = [...cur.log, { t: ts(), tag: "[stop]", kind: "iter", msg: d.text || "Flow annulé." }];
            cur.status = "done";
            break;
          case "done":
            if (cur.status !== "done") {
              cur.log = [...cur.log, { t: ts(), tag: "[done]", kind: "accept", msg: "Flow terminé." }];
              cur.status = "done";
            }
            break;
          case "error":
            cur.log = [...cur.log, { t: ts(), tag: "[err]", kind: "reject", msg: d.text || "erreur" }];
            cur.status = "error";
            break;
        }
        emit();
      };
      const flush = () => {
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const raw = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEventJarvis(raw);
          if (ev) onEv(ev);
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
        if (ev) onEv(ev);
      }
      if (cur.status === "running") cur.status = "done";
    } catch (e) {
      if (!(cur._abortCtrl && cur._abortCtrl.signal.aborted)) {
        cur.status = "error";
        cur.log = [...cur.log, { t: ts(), tag: "[err]", kind: "reject", msg: String(e && e.message ? e.message : e) }];
      }
    } finally {
      emit();
    }
  }
};
if (typeof window !== "undefined") window.__jdmObsStore = ObsStore;
function useObsRun(runId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => runId ? ObsStore.subscribe(runId, force) : void 0, [runId]);
  return runId ? ObsStore.getRun(runId) : null;
}
function ItemCard({ item, accent }) {
  const typeStyle = {
    consolidated: { border: "var(--jdm-green)", icon: "✓", label: "consolidé" },
    flagged: { border: "var(--jdm-orange)", icon: "⚠", label: "suspect" },
    signalement: { border: "var(--jdm-magenta)", icon: "!", label: "désaccord JDM" },
    audit_signalement: { border: "var(--jdm-magenta)", icon: "!", label: "verdict" },
    sens: { border: "var(--line)", icon: "·", label: "sens" },
    meta: { border: "var(--accent)", icon: "✎", label: "observation" },
    line: { border: "var(--line)", icon: "·", label: "ligne" }
  }[item.type] || { border: "var(--line)", icon: "·", label: "" };
  if (item.type === "meta" || item.type === "line") {
    return /* @__PURE__ */ React.createElement("div", { className: "fade-up", style: {
      padding: "8px 10px",
      background: "var(--bg-elev)",
      borderLeft: `3px solid ${typeStyle.border}`,
      borderRadius: "0 var(--radius) var(--radius) 0",
      fontSize: 12,
      color: "var(--ink-2)",
      lineHeight: 1.5
    } }, item.raw);
  }
  const tripletLine = /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
    fontFamily: "var(--font-mono)",
    fontSize: 11
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    color: typeStyle.border,
    flexShrink: 0,
    fontWeight: 700,
    width: 12,
    textAlign: "center"
  } }, typeStyle.icon), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, item.subject, " ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "|"), " ", item.relation, " ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "|"), " ", item.target));
  const chips = [];
  if (item.category) chips.push({ k: "cat", v: item.category });
  if (item.verdict) chips.push({ k: "verdict", v: item.verdict });
  if (item.jdm) chips.push({ k: "JDM", v: item.jdm });
  if (item.llm) chips.push({ k: "LLM", v: item.llm });
  return /* @__PURE__ */ React.createElement("div", { className: "fade-up", style: {
    padding: "8px 10px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderLeft: `3px solid ${typeStyle.border}`,
    borderRadius: "0 var(--radius) var(--radius) 0"
  } }, tripletLine, chips.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
    marginLeft: 18
  } }, chips.map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    padding: "1px 6px",
    background: "var(--bg-card)",
    border: "1px solid var(--line-soft)",
    borderRadius: 3,
    color: c.k === "LLM" ? typeStyle.border : c.k === "JDM" ? "var(--ink-3)" : "var(--ink-2)"
  } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, c.k, ":"), " ", c.v))), item.explanation && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 6,
    marginLeft: 18,
    padding: "6px 9px",
    background: "var(--bg-card)",
    borderLeft: `2px solid ${accent || typeStyle.border}`,
    borderRadius: "0 3px 3px 0",
    fontSize: 11,
    color: "var(--ink-2)",
    lineHeight: 1.5,
    fontStyle: "italic"
  } }, item.explanation));
}
function renderMarkdownJarvis(s) {
  s = s || "";
  if (typeof window !== "undefined" && window.marked) {
    try {
      window.marked.setOptions({ gfm: true, breaks: true });
      return window.marked.parse(s);
    } catch {
    }
  }
  return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>').replace(/\n/g, "<br/>");
}
function parseFilePreview(text, agentId, fmt) {
  text = (text || "").toString();
  if (!text.trim()) return { items: [], counts: {} };
  const lines = text.split(/\r?\n/);
  const items = [];
  let inSignalement = false;
  let inAuditSignalements = false;
  let inAuditMeta = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    const upper = line.toUpperCase();
    if (/^=====+SIGNALEMENT=====+/i.test(line) || upper.includes("SIGNALEMENT")) {
      inSignalement = true;
      inAuditSignalements = upper.includes("=== SIGNALEMENT") || upper.includes("SIGNALEMENTS ===");
      inAuditMeta = false;
      continue;
    }
    if (/^===\s*META\s*===$/i.test(line)) {
      inAuditMeta = true;
      inSignalement = false;
      inAuditSignalements = false;
      continue;
    }
    if (/^===\s*SENS\s*===$/i.test(line)) {
      inAuditMeta = false;
      inSignalement = false;
      inAuditSignalements = false;
      continue;
    }
    if (inAuditMeta) {
      items.push({ type: "meta", raw: line });
      continue;
    }
    const mWithExplain = line.match(/^([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)(?:\s+<\s*(.+?)\s*>\s*)?$/);
    if (mWithExplain) {
      const [, subject, relation, target, restRaw, explanation] = mWithExplain;
      const stripBrackets = (s) => (s || "").trim().replace(/^\[(.*)\]$/, "$1").trim();
      const rest = restRaw.trim();
      if (inSignalement && /JDM\s*:/i.test(rest) && /LLM\s*:/i.test(rest)) {
        const jdmM = rest.match(/JDM\s*:\s*\[?([^|\]]+)\]?\s*\|\s*LLM\s*:\s*\[?(.+?)\]?\s*$/i);
        if (jdmM) {
          const jdmVal = jdmM[1].trim();
          const llmVal = jdmM[2].trim();
          if (jdmVal.toLowerCase() === llmVal.toLowerCase()) {
            items.push({
              type: "consolidated",
              subject: subject.trim(),
              relation: relation.trim(),
              target: target.trim(),
              category: llmVal,
              explanation: (explanation || "").trim(),
              raw: line
            });
            continue;
          }
          items.push({
            type: "signalement",
            subject: subject.trim(),
            relation: relation.trim(),
            target: target.trim(),
            jdm: jdmVal,
            llm: llmVal,
            explanation: (explanation || "").trim(),
            raw: line
          });
          continue;
        }
      }
      if (agentId === "signalement" || /suspect/i.test(rest)) {
        items.push({
          type: "flagged",
          subject: subject.trim(),
          relation: relation.trim(),
          target: target.trim(),
          category: stripBrackets(rest),
          explanation: (explanation || "").trim(),
          raw: line
        });
        continue;
      }
      if (inAuditSignalements) {
        items.push({
          type: "audit_signalement",
          subject: subject.trim(),
          relation: relation.trim(),
          target: target.trim(),
          verdict: stripBrackets(rest),
          explanation: (explanation || "").trim(),
          raw: line
        });
        continue;
      }
      items.push({
        type: inSignalement ? "signalement" : "consolidated",
        subject: subject.trim(),
        relation: relation.trim(),
        target: target.trim(),
        category: stripBrackets(rest),
        explanation: (explanation || "").trim(),
        raw: line
      });
      continue;
    }
    const piped = line.match(/^([^|]+)\|([^|]+)\|([^|]+)$/);
    if (piped) {
      items.push({
        type: "sens",
        subject: piped[1].trim(),
        relation: piped[2].trim(),
        target: piped[3].trim(),
        raw: line
      });
      continue;
    }
    if (fmt === "ligne") {
      items.push({ type: "line", raw: line });
      continue;
    }
  }
  const counts = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});
  return { items, counts };
}
function metricLabelFor(agentId) {
  switch (agentId) {
    case "enrich":
      return { label: "Consolidés", sub: "triplets" };
    case "audit":
      return { label: "Verdicts", sub: "signalements" };
    case "signalement":
      return { label: "Signalés", sub: "triplets flaggés" };
    case "annotation":
      return { label: "Annotations", sub: "+ signalements" };
    case "stats":
      return { label: "Analysés", sub: "Termes/Relations" };
    case "gap":
      return { label: "Trous", sub: "détectés" };
    default:
      return { label: "Items", sub: "produits" };
  }
}
function panelTitleFor(agentId) {
  switch (agentId) {
    case "enrich":
      return "Triplets consolidés";
    case "audit":
      return "Verdicts d'audit (signalements)";
    case "signalement":
      return "Triplets signalés";
    case "annotation":
      return "Annotations + signalements";
    case "stats":
      return "Artefacts analysés";
    case "gap":
      return "Trous détectés";
    default:
      return "Résultats";
  }
}
function parseSSEEventJarvis(raw) {
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) {
      const v = line.slice(5).replace(/^ /, "");
      data += (data ? "\n" : "") + v;
    }
  }
  if (!data) return null;
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = { text: data };
  }
  return { event, data: parsed };
}
function fmtTokens(n) {
  n = Number(n) || 0;
  if (n < 1e3) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "k";
  return (n / 1e6).toFixed(1) + "M";
}
function shortArgs(args) {
  if (!args) return "";
  return Object.entries(args).slice(0, 3).map(([k, v]) => `${k}=${typeof v === "string" ? `"${v.slice(0, 20)}"` : JSON.stringify(v).slice(0, 25)}`).join(", ");
}
function fmtElapsed(ms) {
  const sec = ms / 1e3;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rem = sec - m * 60;
  return `${m}m ${rem.toFixed(1)}s`;
}
const REL_OPTS_COMMON = [
  { value: "r_isa", label: "r_isa — est un" },
  { value: "r_hypo", label: "r_hypo — exemple de" },
  { value: "r_carac", label: "r_carac — caractéristique" },
  { value: "r_has_part", label: "r_has_part — parties" },
  { value: "r_has_color", label: "r_has_color — couleur" },
  { value: "r_agent", label: "r_agent — agent typique" },
  { value: "r_patient", label: "r_patient — patient typique" },
  { value: "r_lieu", label: "r_lieu — lieu typique" },
  { value: "r_telic_role", label: "r_telic_role — à quoi sert" }
];
const BUDGET_OPTS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "illimité", label: "illimité" }
];
const _CUSTOM_SPEC_REG = {};
function defaultParamsFor(agentId) {
  const cfg = typeof window !== "undefined" && window.__JDM_JARVIS_CONFIG__ || {};
  const _temp = typeof cfg.temperature === "number" ? cfg.temperature : void 0;
  const _poolActive = cfg.poolActive !== false;
  const _isGemini = (m) => typeof m === "string" && m.startsWith("gemini");
  const _modelPick = _poolActive && !_isGemini(cfg.llm) ? "gemini-3.1-flash-lite" : cfg.llm || "gemini-3.1-flash-lite";
  const common = {
    model: _modelPick,
    api_key: "",
    drops_key: "",
    use_thinking: true,
    budget_label: "illimité",
    auto_switch: false,
    temperature: _temp,
    pool_active: _poolActive
  };
  const autoUpload = cfg.autoSubmit === true;
  let _spec = _CUSTOM_SPEC_REG[agentId];
  if (!_spec) {
    const _FB = {
      enrich: { defaults: { target_count: 3, vary_relations: true, iterate: true }, writes: true },
      audit: { defaults: {}, writes: true },
      gap: { defaults: {}, writes: false },
      signalement: { defaults: {}, writes: true },
      stats: { defaults: {}, writes: true },
      annotation: { defaults: { top_k: 8, target_count: 10 }, writes: true }
    };
    _spec = _FB[agentId];
  }
  const _d = _spec && _spec.defaults || {};
  const _writes = !_spec || _spec.writes !== false;
  const _isCustom = !!_CUSTOM_SPEC_REG[agentId];
  const _up = typeof _d.upload === "boolean" ? _d.upload : _isCustom ? false : autoUpload;
  return {
    ...common,
    term: "",
    relation: [],
    ..._d,
    ..._writes ? { upload: _up } : {}
  };
}
function ParamsForm({ flow, params, setParams, locked }) {
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const _allRels = useJdmRelations();
  const relOpts = jdmRelationOptions(_allRels, REL_OPTS_COMMON);
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  const submitLabel = /* @__PURE__ */ React.createElement(
    "label",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: _canSubmit ? "var(--ink-2)" : "var(--ink-3)",
        cursor: _canSubmit ? "pointer" : "not-allowed",
        opacity: _canSubmit ? 1 : 0.55
      },
      title: _canSubmit ? params.drops_key ? "Le fichier sera soumis automatiquement avec la clé saisie" : "Le fichier sera soumis automatiquement avec la clé serveur (.env)" : "Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer"
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!params.upload && _canSubmit,
        disabled: !_canSubmit,
        onChange: (e) => set("upload", e.target.checked),
        style: { accentColor: "var(--accent)" }
      }
    ),
    "Soumettre à LLMDrops"
  );
  const wrap = (children) => /* @__PURE__ */ React.createElement("div", { style: { opacity: locked ? 0.55 : 1, pointerEvents: locked ? "none" : void 0 } }, children);
  if (flow.id === "enrich") {
    return wrap(/* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Terme à enrichir" }, /* @__PURE__ */ React.createElement(Input, { value: params.term, onChange: (v) => set("term", v), mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "Relations cibles (optionnel, multi)" }, /* @__PURE__ */ React.createElement(
      MultiSelect,
      {
        value: params.relation || [],
        onChange: (v) => set("relation", v),
        placeholder: "— libre (toutes par défaut) —",
        options: relOpts,
        searchable: true
      }
    )), /* @__PURE__ */ React.createElement(Field, { label: `Nombre cible · ${params.target_count}` }, /* @__PURE__ */ React.createElement(Slider, { value: params.target_count, onChange: (v) => set("target_count", v), min: 1, max: 50, step: 1 })), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", marginBottom: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!params.vary_relations,
        onChange: (e) => set("vary_relations", e.target.checked),
        style: { accentColor: "var(--accent)" }
      }
    ), "Varier les relations"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", marginBottom: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!params.iterate,
        onChange: (e) => set("iterate", e.target.checked),
        style: { accentColor: "var(--accent)" }
      }
    ), "Itérer jusqu'à la cible"), /* @__PURE__ */ React.createElement(Field, { label: "Budget d'outils" }, /* @__PURE__ */ React.createElement(Select, { value: params.budget_label, onChange: (v) => set("budget_label", v), options: BUDGET_OPTS })), submitLabel));
  }
  if (flow.id === "audit" || flow.id === "signalement" || flow.id === "stats") {
    return wrap(/* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Terme" }, /* @__PURE__ */ React.createElement(Input, { value: params.term, onChange: (v) => set("term", v), mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "Relations (optionnel, multi)" }, /* @__PURE__ */ React.createElement(
      MultiSelect,
      {
        value: params.relation || [],
        onChange: (v) => set("relation", v),
        placeholder: "— toutes —",
        options: relOpts,
        searchable: true
      }
    )), /* @__PURE__ */ React.createElement(Field, { label: "Budget d'outils" }, /* @__PURE__ */ React.createElement(Select, { value: params.budget_label, onChange: (v) => set("budget_label", v), options: BUDGET_OPTS })), flow.id !== "stats" && submitLabel));
  }
  if (flow.id === "gap") {
    return wrap(/* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Terme" }, /* @__PURE__ */ React.createElement(Input, { value: params.term, onChange: (v) => set("term", v), mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "Budget d'outils" }, /* @__PURE__ */ React.createElement(Select, { value: params.budget_label, onChange: (v) => set("budget_label", v), options: BUDGET_OPTS }))));
  }
  if (flow.id === "annotation") {
    return wrap(/* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Terme (optionnel)" }, /* @__PURE__ */ React.createElement(Input, { value: params.term, onChange: (v) => set("term", v), mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "Relations (optionnel, multi)" }, /* @__PURE__ */ React.createElement(
      MultiSelect,
      {
        value: params.relation || [],
        onChange: (v) => set("relation", v),
        placeholder: "— toutes principales —",
        options: relOpts,
        searchable: true
      }
    )), /* @__PURE__ */ React.createElement(Field, { label: `Cible d'annotations utiles · ${params.target_count}` }, /* @__PURE__ */ React.createElement(Slider, { value: params.target_count, onChange: (v) => set("target_count", v), min: 1, max: 50, step: 1 })), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 11,
      color: "var(--ink-3)",
      marginBottom: 8,
      fontFamily: "var(--font-mono)",
      lineHeight: 1.4
    } }, "taxonomie : constitutif / contrastif / non spécifique / exception · annotation qualifie le LIEN · sélectivité > volume · itère librement"), /* @__PURE__ */ React.createElement(Field, { label: "Budget d'outils" }, /* @__PURE__ */ React.createElement(Select, { value: params.budget_label, onChange: (v) => set("budget_label", v), options: BUDGET_OPTS })), submitLabel));
  }
  return wrap(/* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Terme (optionnel — vide = tirage au hasard)" }, /* @__PURE__ */ React.createElement(Input, { value: params.term, onChange: (v) => set("term", v), mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "Relations (optionnel, multi)" }, /* @__PURE__ */ React.createElement(
    MultiSelect,
    {
      value: params.relation || [],
      onChange: (v) => set("relation", v),
      placeholder: "— libre —",
      options: relOpts,
      searchable: true
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: `Nombre cible · ${params.target_count || "—"}` }, /* @__PURE__ */ React.createElement(Slider, { value: params.target_count || 0, onChange: (v) => set("target_count", v), min: 0, max: 50, step: 1 })), /* @__PURE__ */ React.createElement(Field, { label: "Budget d'outils" }, /* @__PURE__ */ React.createElement(Select, { value: params.budget_label, onChange: (v) => set("budget_label", v), options: BUDGET_OPTS })), flow.writes !== false && submitLabel));
}
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
  const [running, setRunning] = useState(null);
  const [editing, setEditing] = useState(null);
  const _customAgents = useCustomAgentFlows();
  const [panelIndex, setPanelIndex] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const allAgents = [...JARVIS_AGENTS, ..._customAgents];
  const sectionCount = J_SECTIONS.length;
  const panels = [
    ...J_SECTIONS,
    ...allAgents.map((f) => ({ id: f.id, label: f.kicker || "Sur mesure" }))
  ];
  const total = panels.length;
  const panelBasis = `${100 / total}%`;
  const goToIndex = useCallback((i) => {
    const next = Math.max(0, Math.min(total - 1, i));
    if (next !== panelIndex) setTransitioning(true);
    setPanelIndex(next);
  }, [total, panelIndex]);
  const goToId = useCallback((id) => {
    const idx = panels.findIndex((p) => p.id === id);
    if (idx >= 0) goToIndex(idx);
  }, [goToIndex, panels]);
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    JarvisStore.bootReconcile().catch(() => {
    });
  }, []);
  useEffect(() => {
    const onReset = (e) => {
      if (!e.detail || e.detail.view !== "jarvis") return;
      setRunning(null);
      const supIdx = J_SECTIONS.findIndex((s) => s.id === "supervision");
      setPanelIndex(supIdx >= 0 ? supIdx : 1);
      setTransitioning(false);
      if (typeof window !== "undefined" && window.__jdmPendingPayload) {
        delete window.__jdmPendingPayload.jarvis;
      }
    };
    window.addEventListener("jdm-nav-reset", onReset);
    return () => window.removeEventListener("jdm-nav-reset", onReset);
  }, []);
  useEffect(() => {
    const onSwitch = (e) => {
      const id = e.detail && e.detail.agent_id;
      if (id) setRunning(id);
    };
    window.addEventListener("jdm-jarvis-switch-run", onSwitch);
    return () => window.removeEventListener("jdm-jarvis-switch-run", onSwitch);
  }, []);
  useEffect(() => {
    const onGoToSup = () => {
      setRunning(null);
      setTransitioning(true);
      const supIdx = J_SECTIONS.findIndex((s) => s.id === "supervision");
      if (supIdx >= 0) setPanelIndex(supIdx);
    };
    window.addEventListener("jdm-goto-jarvis-supervision", onGoToSup);
    return () => window.removeEventListener("jdm-goto-jarvis-supervision", onGoToSup);
  }, []);
  const lastScroll = useRef(0);
  useEffect(() => {
    lastScroll.current = 0;
    setNavHidden(false);
  }, [panelIndex]);
  useEffect(() => {
    if (running) return;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains("jpanel-scroll")) return;
      const top = t.scrollTop;
      const prev = lastScroll.current;
      if (top < 40) setNavHidden(false);
      else if (top > prev + 4) setNavHidden(true);
      else if (top < prev - 4) setNavHidden(false);
      lastScroll.current = top;
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [running]);
  useEffect(() => {
    if (running) return;
    const onKey = (e) => {
      if (e.target.matches && e.target.matches("input, textarea, [contenteditable]")) return;
      const onFlow = panelIndex >= sectionCount;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.min(sectionCount - 1, panelIndex + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.max(0, panelIndex - 1));
      } else if (e.key === "Home") {
        goToIndex(0);
      } else if (e.key === "End") {
        goToIndex(sectionCount - 1);
      } else if (e.key === "Escape" && onFlow) {
        goToIndex(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelIndex, goToIndex, sectionCount, running]);
  useEffect(() => {
    if (running) return;
    let start = null;
    const onStart = (e) => {
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
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
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [panelIndex, goToIndex, sectionCount, running]);
  const _delCustomAgent = async (f) => {
    if (typeof window !== "undefined" && !window.confirm(`Supprimer définitivement l'agent « ${f.title} » ?`)) return;
    try {
      await fetch("api/jarvis/agents/" + encodeURIComponent(f.id), { method: "DELETE" });
      try {
        window.dispatchEvent(new CustomEvent("jdm-agents-changed"));
      } catch (e) {
      }
    } catch (e) {
    }
    goToId("repertoire");
  };
  if (running) {
    const flow = allAgents.find((f) => f.id === _slotAgent(running));
    if (!flow) {
      return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement("div", { style: { padding: "60px 0", textAlign: "center", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, "… chargement de l'agent …"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => setRunning(null) }, "← Retour")));
    }
    return /* @__PURE__ */ React.createElement(
      JarvisRun,
      {
        flow,
        slot: running,
        onBack: () => {
          const idx = panels.findIndex((p) => p.id === _slotAgent(running));
          setRunning(null);
          setTransitioning(false);
          if (idx >= 0) setPanelIndex(idx);
        }
      }
    );
  }
  const activePanel = panels[panelIndex].id;
  const activeSection = panelIndex < sectionCount ? activePanel : "accueil";
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, JRING_CSS), /* @__PURE__ */ React.createElement(
    JSectionNav,
    {
      activeSection,
      onSelect: goToId,
      hidden: panelIndex >= sectionCount
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    height: "calc(100vh - 56px)",
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        height: "100%",
        width: `${total * 100}%`,
        display: "flex",
        flexDirection: "row",
        transform: `translate3d(-${panelIndex / total * 100}%, 0, 0)`,
        transition: transitioning ? "transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)" : "none",
        willChange: "transform"
      },
      onTransitionEnd: (e) => {
        if (e.propertyName === "transform") setTransitioning(false);
      }
    },
    /* @__PURE__ */ React.createElement(JPanel, { basis: panelBasis }, /* @__PURE__ */ React.createElement(JConfigPanel, { onAccueil: () => goToId("repertoire") })),
    /* @__PURE__ */ React.createElement(JPanel, { basis: panelBasis }, /* @__PURE__ */ React.createElement(JSupervisionPanel, { flows: JARVIS_AGENTS, onPick: goToId, onLaunch: (id) => setRunning(_allocSlot(id)), onOpenRun: (aid, rid) => {
      const _found = _slotForRun(aid, rid);
      const _hasLocal = rid && _JARVIS_RUNS[_found] && _JARVIS_RUNS[_found].runId === rid;
      if (_hasLocal) {
        setRunning(_found);
        return;
      }
      if (rid) {
        const _s = _allocSlot(aid);
        JarvisStore.attach(_s, rid).catch(() => {
        });
        setRunning(_s);
        return;
      }
      setRunning(_allocSlot(aid));
    }, active: activePanel === "supervision" })),
    /* @__PURE__ */ React.createElement(JPanel, { basis: panelBasis }, /* @__PURE__ */ React.createElement(JAccueilPanel, { flows: JARVIS_AGENTS, onPick: goToId, onLaunch: (id) => setRunning(_allocSlot(id)) })),
    allAgents.map((f, i) => {
      const panelPos = sectionCount + i;
      const isCustom = !!f._custom;
      return /* @__PURE__ */ React.createElement(JPanel, { key: f.id, basis: panelBasis }, /* @__PURE__ */ React.createElement(
        JAgentPanel,
        {
          flow: f,
          index: i,
          panelPos,
          total,
          onLaunch: () => setRunning(f.id),
          onIndex: goToIndex,
          onSommaire: () => goToId("repertoire"),
          onEdit: isCustom ? (spec) => setEditing(spec._spec || spec) : void 0,
          onDelete: isCustom ? _delCustomAgent : void 0
        }
      ));
    })
  )), editing && /* @__PURE__ */ React.createElement(
    JAgentBuilderModal,
    {
      editSpec: editing,
      onClose: () => setEditing(null),
      onCreated: (id) => {
        setEditing(null);
        goToId(id);
      }
    }
  ));
}
function JPanel({ children, basis }) {
  return /* @__PURE__ */ React.createElement("div", { className: "jpanel-scroll", style: {
    flex: `0 0 ${basis || JPANEL_BASIS}`,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "6px 28px 56px",
    overflow: "auto"
  } }, children);
}
let JARVIS_LLMS = [
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" }
];
const _LLMS_LISTENERS = /* @__PURE__ */ new Set();
let _LLMS_LOADED = false;
async function _loadJarvisModels() {
  if (_LLMS_LOADED) return;
  try {
    const r = await fetch("api/jarvis/models");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.models) && d.models.length > 0) {
      JARVIS_LLMS = d.models.map((m) => ({ value: m.value, label: m.label }));
      if (d.default) _JARVIS_DEFAULT_LLM = d.default;
      _LLMS_LOADED = true;
      for (const cb of _LLMS_LISTENERS) {
        try {
          cb();
        } catch {
        }
      }
    }
  } catch {
  }
}
if (typeof window !== "undefined") {
  _loadJarvisModels();
}
function useGeminiModels() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    _LLMS_LISTENERS.add(force);
    return () => _LLMS_LISTENERS.delete(force);
  }, []);
  return [JARVIS_LLMS, _LLMS_LOADED];
}
const JARVIS_FORMATS = [
  { value: "jdm", label: "JDM (.enrich/.audit/.err/.stat/.annot)" }
];
let _JARVIS_DEFAULT_LLM = "gemini-3.1-flash-lite";
const JCONFIG_DEFAULTS = {
  mode: "autonome",
  parallel: 2,
  defaultMaxIter: 30,
  llm: "gemini-3.1-flash-lite",
  temperature: 0.3,
  globalConf: 50,
  humanReview: false,
  autoSubmit: true,
  logLevel: "detaille",
  storageDir: "~/jdm/exports",
  exportFormat: "jdm",
  keepHistory: true,
  // Pool gratuit actif : check-out / check-in d'une clé Gemini par run
  // (cf. pool_lease.py côté backend). Évite que 2 runs parallèles se
  // partagent le même quota PerMinute. Quand actif, gemini-3.1-flash-lite
  // est forcé par défaut (modèle gratuit du pool).
  poolActive: true
};
function useJarvisConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem("jdm_jarvis_config");
      if (raw) return { ...JCONFIG_DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
    }
    return JCONFIG_DEFAULTS;
  });
  useEffect(() => {
    try {
      localStorage.setItem("jdm_jarvis_config", JSON.stringify(cfg));
    } catch (e) {
    }
    window.__JDM_JARVIS_CONFIG__ = cfg;
    try {
      window.dispatchEvent(new CustomEvent("__jdm_jarvis_config_changed"));
    } catch (e) {
    }
  }, [cfg]);
  const set = useCallback((k, v) => setCfg((c) => ({ ...c, [k]: v })), []);
  const reset = useCallback(() => setCfg(JCONFIG_DEFAULTS), []);
  return [cfg, set, reset];
}
function JToggle({ checked, onChange, disabled }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      disabled,
      onClick: () => !disabled && onChange(!checked),
      className: "focus-ring",
      style: {
        width: 42,
        height: 24,
        flexShrink: 0,
        padding: 0,
        borderRadius: 999,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid " + (checked ? "var(--accent)" : "var(--line)"),
        background: checked ? "var(--accent)" : "var(--bg-elev)",
        opacity: disabled ? 0.5 : 1,
        transition: "background .2s, border-color .2s"
      }
    },
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
      position: "absolute",
      top: 2,
      left: checked ? 20 : 2,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: checked ? "var(--bg)" : "var(--ink-3)",
      transition: "left .2s cubic-bezier(.34,1.56,.64,1), background .2s"
    } })
  );
}
function JSegmented({ value, options, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    padding: 3,
    gap: 2,
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    borderRadius: 999
  } }, options.map((o) => {
    const active = value === o.value;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: o.value,
        type: "button",
        onClick: () => onChange(o.value),
        className: "focus-ring",
        style: {
          padding: "6px 14px",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          background: active ? "var(--accent)" : "transparent",
          color: active ? "var(--bg)" : "var(--ink-2)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: active ? 600 : 400,
          transition: "background .18s, color .18s",
          whiteSpace: "nowrap"
        }
      },
      o.label
    );
  }));
}
function JCfgGroup({ title, children }) {
  return /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "11px 18px", background: "var(--bg-elev)", borderBottom: "1px solid var(--line-soft)" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em"
  } }, title)), /* @__PURE__ */ React.createElement("div", { style: { padding: "2px 18px 8px" } }, children));
}
function JCfgRow({ label, hint, children, stack }) {
  return /* @__PURE__ */ React.createElement("div", { className: "jcfg-row" + (stack ? " jcfg-row--stack" : "") }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13.5, color: "var(--ink)", fontWeight: 500 } }, label), hint && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.4 } }, hint)), /* @__PURE__ */ React.createElement("div", { style: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: stack ? "stretch" : "flex-end",
    ...stack ? { alignSelf: "stretch" } : { minWidth: 150, maxWidth: "55%" }
  } }, children));
}
function JConfigPanel({ onAccueil }) {
  const [cfg, set, reset] = useJarvisConfig();
  const [
    llmList
    /*, llmsReady */
  ] = useGeminiModels();
  const autonomous = cfg.mode === "autonome";
  const modeHint = {
    autonome: "La boucle s’exécute de bout en bout, sans intervention humaine.",
    supervise: "Jarvis sollicite ta validation aux étapes critiques.",
    pasapas: "Tu valides chaque itération avant qu’elle ne soit écrite."
  }[cfg.mode];
  const llmLabel = (llmList.find((l) => l.value === cfg.llm) || {}).label || cfg.llm;
  const fmtLabel = (JARVIS_FORMATS.find((f) => f.value === cfg.exportFormat) || {}).label || cfg.exportFormat;
  const modeLabel = { autonome: "Autonome", supervise: "Supervisé", pasapas: "Pas-à-pas" }[cfg.mode];
  const modeColor = { autonome: "var(--jdm-green)", supervise: "var(--jdm-orange)", pasapas: "var(--jdm-cyan)" }[cfg.mode];
  const checks = [
    { label: "Mode d’exécution choisi", ok: !!cfg.mode },
    { label: "Modèle LLM sélectionné", ok: !!cfg.llm },
    { label: "Seuil de confiance défini", ok: cfg.globalConf > 0 },
    { label: "Répertoire de stockage renseigné", ok: !!(cfg.storageDir && cfg.storageDir.trim()) },
    { label: autonomous ? "Soumission automatique activée" : "Validation configurée", ok: autonomous ? cfg.autoSubmit : cfg.humanReview || cfg.autoSubmit }
  ];
  const doneCount = checks.filter((c) => c.ok).length;
  const pct = Math.round(doneCount / checks.length * 100);
  const ready = pct === 100;
  const barColor = ready ? "var(--jdm-green)" : "var(--accent)";
  return /* @__PURE__ */ React.createElement("div", { style: { width: "100%", maxWidth: 1080 } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
    flexWrap: "wrap",
    marginBottom: 22
  } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("em", { style: { fontStyle: "italic", fontFamily: "var(--font-display)", color: "var(--accent)", fontSize: 13, textTransform: "none", letterSpacing: 0 } }, "Jarvis"), " · Réglages de l’agent"), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(32px, 4.2vw, 52px)",
    fontWeight: 500,
    letterSpacing: "-0.025em",
    lineHeight: 1,
    color: "var(--ink)"
  } }, "Config", /* @__PURE__ */ React.createElement("span", { style: { fontStyle: "italic", color: "var(--accent)" } }, "uration"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: "var(--jdm-green)" } }), " enregistré"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: reset, className: "focus-ring", style: ghostLinkStyle }, "↺ Réinitialiser"))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)",
    gap: 18,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement(JCfgGroup, { title: "Exécution" }, /* @__PURE__ */ React.createElement(JCfgRow, { label: "Mode d’exécution", stack: true }, /* @__PURE__ */ React.createElement(JSegmented, { value: cfg.mode, onChange: (v) => set("mode", v), options: [
    { value: "autonome", label: "Autonome" },
    { value: "supervise", label: "Supervisé" },
    { value: "pasapas", label: "Pas-à-pas" }
  ] }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 } }, modeHint)), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Agents en parallèle", hint: "Boucles d’agent exécutées simultanément.", stack: true }, /* @__PURE__ */ React.createElement(Slider, { value: cfg.parallel, onChange: (v) => set("parallel", v), min: 1, max: 5, step: 1 })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Itérations max par défaut", hint: "Plafond appliqué à chaque nouvel agent.", stack: true }, /* @__PURE__ */ React.createElement(Slider, { value: cfg.defaultMaxIter, onChange: (v) => set("defaultMaxIter", v), min: 5, max: 100, step: 1 }))), /* @__PURE__ */ React.createElement(JCfgGroup, { title: "Modèle & inférence" }, /* @__PURE__ */ React.createElement(JCfgRow, { label: "Modèle LLM", stack: true }, /* @__PURE__ */ React.createElement(Select, { value: cfg.llm, onChange: (v) => set("llm", v), options: llmList })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Pool gratuit actif", hint: "Chaque run prend une clé Gemini distincte du pool (load-min sinon). Force gemini-3.1-flash-lite par défaut." }, /* @__PURE__ */ React.createElement(JToggle, { checked: cfg.poolActive !== false, onChange: (v) => set("poolActive", v) })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Température", hint: "Créativité de la génération de candidats.", stack: true }, /* @__PURE__ */ React.createElement(Slider, { value: Math.round(cfg.temperature * 100), onChange: (v) => set("temperature", v / 100), min: 0, max: 100, step: 5, suffix: "%" })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Seuil de confiance global", hint: "Score minimum pour conserver un triplet.", stack: true }, /* @__PURE__ */ React.createElement(Slider, { value: cfg.globalConf, onChange: (v) => set("globalConf", v), min: 0, max: 100, step: 5, suffix: "%" }))), /* @__PURE__ */ React.createElement(JCfgGroup, { title: "Validation & soumission" }, /* @__PURE__ */ React.createElement(JCfgRow, { label: "Validation humaine avant écriture", hint: autonomous ? "Désactivée en mode autonome." : "Relire les triplets avant de les mémoriser." }, /* @__PURE__ */ React.createElement(JToggle, { checked: autonomous ? false : cfg.humanReview, disabled: autonomous, onChange: (v) => set("humanReview", v) })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Soumettre automatiquement à JDM", hint: "Pousser les triplets validés vers le serveur JeuxDeMots." }, /* @__PURE__ */ React.createElement(JToggle, { checked: cfg.autoSubmit, onChange: (v) => set("autoSubmit", v) })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Journalisation", stack: true }, /* @__PURE__ */ React.createElement(JSegmented, { value: cfg.logLevel, onChange: (v) => set("logLevel", v), options: [
    { value: "concis", label: "Concis" },
    { value: "detaille", label: "Détaillé" },
    { value: "debug", label: "Debug" }
  ] }))), /* @__PURE__ */ React.createElement(JCfgGroup, { title: "Stockage & sortie" }, /* @__PURE__ */ React.createElement(JCfgRow, { label: "Répertoire de stockage", hint: "Où les exports et journaux sont écrits.", stack: true }, /* @__PURE__ */ React.createElement(Input, { value: cfg.storageDir, onChange: (v) => set("storageDir", v), mono: true })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Format d’export", stack: true }, /* @__PURE__ */ React.createElement(Select, { value: cfg.exportFormat, onChange: (v) => set("exportFormat", v), options: JARVIS_FORMATS })), /* @__PURE__ */ React.createElement(JCfgRow, { label: "Conserver l’historique des runs", hint: "Garder une trace de chaque exécution." }, /* @__PURE__ */ React.createElement(JToggle, { checked: cfg.keepHistory, onChange: (v) => set("keepHistory", v) })))), /* @__PURE__ */ React.createElement("div", { style: { position: "sticky", top: 96, display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "13px 18px 14px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 9 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" } }, "Préparation de l’agent"), /* @__PURE__ */ React.createElement("span", { className: "display", style: { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: ready ? "var(--jdm-green)" : "var(--ink)", fontVariantNumeric: "tabular-nums" } }, pct, "%")), /* @__PURE__ */ React.createElement("div", { style: { height: 6, borderRadius: 999, background: "var(--bg-elev)", overflow: "hidden", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { width: pct + "%", height: "100%", background: barColor, borderRadius: 999, transition: "width .4s cubic-bezier(.4,0,.2,1), background .3s" } })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, checks.map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: {
    width: 15,
    height: 15,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    lineHeight: 1,
    background: c.ok ? "var(--jdm-green)" : "var(--bg-elev)",
    color: c.ok ? "var(--bg)" : "var(--ink-3)",
    border: "1px solid " + (c.ok ? "var(--jdm-green)" : "var(--line)")
  } }, c.ok ? "✓" : ""), /* @__PURE__ */ React.createElement("span", { style: { color: c.ok ? "var(--ink-2)" : "var(--ink-3)" } }, c.label)))), ready && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { marginTop: 11, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10.5, color: "var(--jdm-green)", textTransform: "uppercase", letterSpacing: "0.08em" } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: "var(--jdm-green)" } }), " prêt à lancer"))), /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden", borderTop: `3px solid ${modeColor}` } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 18px 12px" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 10
  } }, "Profil d’exécution"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 10, height: 10, borderRadius: "50%", background: modeColor, flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "var(--ink)"
  } }, modeLabel))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid var(--line-soft)", padding: "4px 18px 10px" } }, /* @__PURE__ */ React.createElement(JSumRow, { k: "Modèle", v: llmLabel }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Confiance min", v: cfg.globalConf + " %" }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Itér. max", v: cfg.defaultMaxIter }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Parallèle", v: cfg.parallel + " agents" }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Soumission JDM", v: cfg.autoSubmit ? "auto" : "manuelle", accent: cfg.autoSubmit ? "var(--jdm-green)" : void 0 }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Validation", v: autonomous ? "aucune" : cfg.humanReview ? "humaine" : "auto" }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Export", v: fmtLabel }), /* @__PURE__ */ React.createElement(JSumRow, { k: "Stockage", v: cfg.storageDir, mono: true }))), /* @__PURE__ */ React.createElement(Button, { full: true, size: "lg", onClick: onAccueil }, "Choisir un agent →"))));
}
function JSumRow({ k, v, accent, mono }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-3)", flexShrink: 0, fontSize: 11 } }, k), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, borderBottom: "1px dotted var(--line)", transform: "translateY(-4px)" } }), /* @__PURE__ */ React.createElement("span", { className: mono ? "mono" : void 0, style: {
    color: accent || "var(--ink)",
    textAlign: "right",
    fontWeight: 500,
    maxWidth: "62%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: mono ? 11 : 12.5
  } }, v));
}
function JAccueilPanel({ flows, onPick, onLaunch }) {
  const activeFlowSet = useJarvisActiveSet();
  const [q, setQ] = useState("");
  const [view, setView] = useState("library");
  const customAgents = useCustomAgentFlows();
  const [showBuilder, setShowBuilder] = useState(false);
  const allFlows = [...flows, ...customAgents];
  const qq = q.trim().toLowerCase();
  const indexed = allFlows.map((f, i) => ({ f, num: i + 1 }));
  const list = qq ? indexed.filter(({ f }) => (f.title + " " + f.kicker + " " + f.produces + " " + f.steps.map((s) => s.n).join(" ")).toLowerCase().includes(qq)) : indexed;
  return /* @__PURE__ */ React.createElement("div", { style: { width: "100%", maxWidth: view === "library" ? 1180 : 980 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("em", { style: { fontStyle: "italic", fontFamily: "var(--font-display)", color: "var(--accent)", fontSize: 13, textTransform: "none", letterSpacing: 0 } }, "Jarvis"), " · Catalogue des agents disponibles"), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(32px, 4.4vw, 52px)",
    fontWeight: 500,
    letterSpacing: "-0.025em",
    lineHeight: 1,
    color: "var(--ink)"
  } }, "Réper", /* @__PURE__ */ React.createElement("span", { style: { fontStyle: "italic", color: "var(--accent)" } }, "toire"))), /* @__PURE__ */ React.createElement("div", { style: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "8px 0 12px",
    marginBottom: 14,
    background: "var(--bg)",
    borderBottom: "1px solid var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", flex: "1 1 240px", minWidth: 190 } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--ink-3)",
    fontSize: 14,
    pointerEvents: "none"
  } }, "⌕"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: q,
      onChange: (e) => setQ(e.target.value),
      placeholder: "Rechercher un agent, une étape, un résultat…",
      "aria-label": "Rechercher un agent",
      style: {
        width: "100%",
        padding: "10px 12px 10px 31px",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink)",
        fontFamily: "inherit",
        fontSize: 13,
        outline: "none"
      }
    }
  )), /* @__PURE__ */ React.createElement(JSegmented, { value: view, onChange: setView, options: [
    { value: "library", label: "Bibliothèque" },
    { value: "apercus", label: "Aperçus" }
  ] }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    whiteSpace: "nowrap",
    padding: "6px 11px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: 999
  } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, list.length), qq ? ` / ${allFlows.length}` : "", " agents"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "focus-ring",
      onClick: () => setShowBuilder(true),
      title: "Créer un agent spécialiste sur mesure",
      style: {
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px",
        borderRadius: 999,
        cursor: "pointer",
        border: "none",
        background: "var(--accent)",
        color: "#fff",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }
    },
    "＋ Créer un agent spécialiste"
  )), showBuilder && /* @__PURE__ */ React.createElement(
    JAgentBuilderModal,
    {
      onClose: () => setShowBuilder(false),
      onCreated: (id) => {
        setShowBuilder(false);
        if (onLaunch) onLaunch(id);
      }
    }
  ), list.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: {
    padding: "48px 20px",
    textAlign: "center",
    border: "1px dashed var(--line)",
    borderRadius: "var(--radius-lg)"
  } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-2)", marginBottom: 4 } }, "Aucun agent"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-3)" } }, "Rien ne correspond à « ", q, " ».")) : view === "apercus" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
    fontFamily: "var(--font-mono)",
    fontSize: 11.5,
    color: "var(--ink-3)"
  } }, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" } }), "Clic sur le ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "cercle"), " = lancer l'agent", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)" } }, "|"), "clic sur la ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "carte"), " = voir le détail"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 10 } }, list.map(({ f, num }) => /* @__PURE__ */ React.createElement(
    JTocRow,
    {
      key: f.id,
      flow: f,
      num,
      delay: (num - 1) * 0.45,
      running: activeFlowSet.has(f.id),
      onOpen: () => onPick(f.id),
      onLaunch: () => onLaunch(f.id)
    }
  )))) : /* @__PURE__ */ React.createElement(JLibrary, { list, onPick, onLaunch }));
}
function JTocRow({ flow, num, delay, onOpen, onLaunch, running }) {
  const [hover, setHover] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16, position: "relative" } }, running && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: -6,
    right: 10,
    zIndex: 2,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 8px",
    background: "rgba(78,166,60,0.12)",
    border: "1px solid rgba(78,166,60,0.40)",
    borderRadius: 999,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--jdm-green)",
    letterSpacing: "0.04em",
    textTransform: "uppercase"
  } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { width: 6, height: 6, borderRadius: "50%", background: "var(--jdm-green)" } }), "en cours"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onLaunch,
      className: "jring-btn",
      title: `Lancer l'agent « ${flow.title} »`,
      "aria-label": `Lancer l'agent ${flow.title}`,
      style: { flexShrink: 0 }
    },
    /* @__PURE__ */ React.createElement(JLoopRing, { accent: flow.accent, num, steps: flow.steps.length, delay, size: 62 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onOpen,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      className: "focus-ring",
      style: {
        flex: 1,
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 16,
        textAlign: "left",
        padding: "15px 20px",
        background: "var(--bg-card)",
        border: "1px solid " + (hover ? flow.accent : "var(--line)"),
        borderRadius: "var(--radius-lg)",
        boxShadow: hover ? `inset 5px 0 0 ${flow.accent}, 0 8px 26px -14px ${flow.accent}` : `inset 5px 0 0 ${flow.accent}`,
        cursor: "pointer",
        transform: hover ? "translateX(2px)" : "none",
        transition: "transform 0.16s, border-color 0.16s, box-shadow 0.28s",
        fontFamily: "inherit"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("span", { className: "display", style: {
      display: "block",
      fontFamily: "var(--font-display)",
      fontSize: 21,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      lineHeight: 1.1
    } }, flow.title), /* @__PURE__ */ React.createElement("span", { style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 7,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--ink-3)",
      flexWrap: "wrap"
    } }, /* @__PURE__ */ React.createElement(LoopGlyph, { color: flow.accent }), flow.steps.map((s, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, i > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)" } }, "›"), /* @__PURE__ */ React.createElement("span", null, s.n))), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)", margin: "0 2px" } }, "—"), /* @__PURE__ */ React.createElement("span", { style: { color: flow.accent } }, flow.produces))),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: hover ? flow.accent : "var(--ink-3)",
      transition: "color 0.16s, transform 0.16s",
      transform: hover ? "translateX(3px)" : "none",
      flexShrink: 0,
      whiteSpace: "nowrap"
    } }, "détails →")
  ));
}
function JRegistry({ list, onPick, onLaunch }) {
  const cols = "34px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1fr) 92px";
  return /* @__PURE__ */ React.createElement("div", { style: { border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-card)" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: cols,
    gap: 12,
    alignItems: "center",
    padding: "9px 16px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, /* @__PURE__ */ React.createElement("span", null, "#"), /* @__PURE__ */ React.createElement("span", null, "Agent"), /* @__PURE__ */ React.createElement("span", null, "Séquence"), /* @__PURE__ */ React.createElement("span", null, "Produit"), /* @__PURE__ */ React.createElement("span", { style: { textAlign: "right" } }, "Action")), list.map(({ f, num }, i) => /* @__PURE__ */ React.createElement(
    JRegistryRow,
    {
      key: f.id,
      flow: f,
      num,
      cols,
      last: i === list.length - 1,
      onOpen: () => onPick(f.id),
      onLaunch: () => onLaunch(f.id)
    }
  )));
}
function JRegistryRow({ flow, num, cols, last, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      onClick: onOpen,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      className: "focus-ring",
      style: {
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        alignItems: "center",
        padding: "10px 16px",
        cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        background: hover ? "var(--bg-elev)" : "transparent",
        boxShadow: hover ? `inset 3px 0 0 ${a}` : "inset 3px 0 0 transparent",
        transition: "background .12s, box-shadow .12s"
      }
    },
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: a, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${a} 16%, transparent)` } })),
    /* @__PURE__ */ React.createElement("span", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("span", { className: "display", style: {
      display: "block",
      fontFamily: "var(--font-display)",
      fontSize: 15.5,
      fontWeight: 600,
      color: "var(--ink)",
      letterSpacing: "-0.01em",
      lineHeight: 1.15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    } }, flow.title), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 9.5, color: a, textTransform: "uppercase", letterSpacing: "0.1em" } }, flow.kicker)),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", minWidth: 0 } }, flow.steps.map((s, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, i > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)" } }, "›"), /* @__PURE__ */ React.createElement("span", null, s.n)))),
    /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, flow.produces),
    /* @__PURE__ */ React.createElement("span", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: (e) => {
          e.stopPropagation();
          onLaunch();
        },
        title: `Lancer « ${flow.title} »`,
        "aria-label": `Lancer ${flow.title}`,
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          border: `1px solid color-mix(in srgb, ${a} 50%, transparent)`,
          background: `color-mix(in srgb, ${a} 10%, transparent)`,
          color: a,
          cursor: "pointer",
          fontSize: 10,
          lineHeight: 1
        }
      },
      "▶"
    ), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 13, color: hover ? a : "var(--ink-3)", transition: "color .12s", transform: hover ? "translateX(2px)" : "none" } }, "→"))
  );
}
function flowToolKinds(flow) {
  const steps = _toolSteps(flow);
  const kinds = /* @__PURE__ */ new Set();
  for (const t of Object.keys(steps)) {
    const d = TOOL_DOCS[t];
    if (d) kinds.add(d.kind);
  }
  return [...kinds];
}
const J_FACETS = [
  { id: "category", label: "Catégorie", get: (f) => f.category ? [f.category] : [] },
  { id: "kind", label: "Type d’outil", get: (f) => flowToolKinds(f) },
  { id: "steps", label: "Étapes", get: (f) => [`${f.steps.length} étapes`] },
  { id: "tags", label: "Tags", get: (f) => f.tags || [] }
];
function JLibrary({ list, onPick, onLaunch }) {
  const [sel, setSel] = useState({});
  const toggle = (gid, val) => setSel((prev) => {
    const next = { ...prev };
    const s = new Set(next[gid] || []);
    if (s.has(val)) s.delete(val);
    else s.add(val);
    next[gid] = s;
    return next;
  });
  const clear = () => setSel({});
  const activeCount = Object.values(sel).reduce((n, s) => n + (s ? s.size : 0), 0);
  const resultsRef = useRef(null);
  const _userTouched = useRef(false);
  useEffect(() => {
    if (activeCount === 0 && !_userTouched.current) return;
    _userTouched.current = true;
    const el = resultsRef.current;
    if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      sc = sc.parentElement;
    }
    if (!sc) sc = window;
    const elTop = el.getBoundingClientRect().top;
    const scTop = sc === window ? 0 : sc.getBoundingClientRect().top;
    const delta = elTop - scTop - 12;
    if (sc.scrollBy) sc.scrollBy({ top: delta, behavior: "smooth" });
    else if (sc.scrollTo) sc.scrollTo({ top: (sc.scrollTop || 0) + delta, behavior: "smooth" });
  }, [sel, activeCount]);
  const groups = J_FACETS.map((g) => {
    const counts = {};
    list.forEach(({ f }) => g.get(f).forEach((v) => {
      counts[v] = (counts[v] || 0) + 1;
    }));
    const items = Object.keys(counts).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, count: counts[v] }));
    return { ...g, items };
  }).filter((g) => g.items.length > 0);
  const results = list.filter(
    ({ f }) => J_FACETS.every((g) => {
      const s = sel[g.id];
      if (!s || s.size === 0) return true;
      return g.get(f).some((v) => s.has(v));
    })
  );
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch" } }, /* @__PURE__ */ React.createElement("aside", { style: {
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    background: "var(--bg-card)",
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 14px",
    borderBottom: "1px solid var(--line-soft)",
    background: "var(--bg-elev)"
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em" } }, "Filtres MediaBay ", activeCount > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, "· ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, activeCount, " actif", activeCount > 1 ? "s" : ""))), activeCount > 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: clear,
      className: "focus-ring",
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--accent)",
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }
    },
    "Effacer (",
    activeCount,
    ")"
  )), /* @__PURE__ */ React.createElement("div", null, groups.map((g, gi) => /* @__PURE__ */ React.createElement("div", { key: g.id, style: {
    display: "grid",
    gridTemplateColumns: "128px minmax(0, 1fr)",
    gap: 14,
    alignItems: "start",
    padding: "10px 14px",
    borderBottom: gi < groups.length - 1 ? "1px solid var(--line-soft)" : "none"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    paddingTop: 5
  } }, g.label), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 } }, g.items.map((it) => {
    const on = !!(sel[g.id] && sel[g.id].has(it.value));
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: it.value,
        type: "button",
        onClick: () => toggle(g.id, it.value),
        className: "focus-ring",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 9px",
          borderRadius: 999,
          cursor: "pointer",
          border: "1px solid " + (on ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--line-soft)"),
          background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-elev)",
          fontFamily: "inherit",
          transition: "background .12s, border-color .12s"
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: {
        width: 12,
        height: 12,
        borderRadius: 2,
        flexShrink: 0,
        border: "1px solid " + (on ? "var(--accent)" : "var(--line)"),
        background: on ? "var(--accent)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--bg)",
        fontSize: 8.5,
        lineHeight: 1
      } }, on ? "✓" : ""),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, color: on ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap" } }, it.value),
      /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)" } }, it.count)
    );
  })))))), /* @__PURE__ */ React.createElement("div", { ref: resultsRef, style: { minWidth: 0, scrollMarginTop: 12 } }, results.length > 0 ? /* @__PURE__ */ React.createElement(JRegistry, { list: results, onPick, onLaunch }) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px 20px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "var(--radius-lg)" } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", marginBottom: 4 } }, "Aucun agent pour ces filtres"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-3)" } }, "Élargis ta sélection dans les facettes ci-dessus."))));
}
function _parseWorkflowSteps(sp) {
  if (!sp || typeof sp !== "string") return null;
  let body = sp;
  const mStart = sp.match(/[ÉE]TAPES?\s*:/i);
  if (mStart) body = sp.slice(mStart.index + mStart[0].length);
  const mEnd = body.match(/\n\s*(R[ÈE]GLES?|DESCRIPTION|ATTENTION|NOTES?|SORTIE|REMARQUES?|CONTRAINTES?|IMPORTANT)\s*:?/i);
  if (mEnd) body = body.slice(0, mEnd.index);
  const items = [];
  const re = /(?:^|\n)\s*(\d+)[.)]\s+([^\n]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const full = m[2].trim().replace(/\s+/g, " ");
    if (!full) continue;
    if (/^(attention|important|note|règle|regle|ne\s|n[e'’]|aucun|jamais)\b/i.test(full)) continue;
    let name, desc;
    const sep = full.split(/\s+[—–:-]\s+/);
    if (sep.length > 1 && sep[0].split(" ").length <= 4) {
      name = sep[0].trim();
      desc = sep.slice(1).join(" — ").trim();
    } else {
      const w = full.replace(/[.:;،,].*$/, "").trim().split(" ");
      name = w.slice(0, w.length === 1 ? 1 : w[0].length <= 3 ? 2 : 1).join(" ");
      desc = full;
    }
    name = name.replace(/[.:;,]+$/, "").trim();
    if (!name) name = "Étape " + m[1];
    items.push({ n: name, d: desc });
    if (items.length >= 6) break;
  }
  return items.length ? items : null;
}
function _specToFlow(spec) {
  const brief = spec.brief || "";
  try {
    _CUSTOM_SPEC_REG[spec.id] = spec;
    if (spec.icon) AGENT_ICON[spec.id] = spec.icon;
    if (brief) AGENT_BRIEF[spec.id] = brief;
  } catch (e) {
  }
  const fmt = spec.output_format || "jdm";
  const fmtLabel = fmt === "json" ? "JSON" : fmt === "libre" ? "texte libre" : fmt === "ligne" ? "lignes libres" : "soumission JDM";
  let steps = Array.isArray(spec.steps) && spec.steps.length ? spec.steps.map((s) => ({ n: s.n || "", d: s.d || "" })) : _parseWorkflowSteps(spec.system_prompt);
  if (!steps || !steps.length) {
    steps = [
      { n: "Cadrage", d: "Reçoit le terme (ou en tire un) et la stratégie de l'agent." },
      { n: "Exécution", d: "Suit la stratégie en mobilisant les outils JDM autorisés." }
    ];
    if (spec.consolidates) steps.push({ n: "Consolidation", d: "Vérifie chaque candidat par inférence dans le graphe." });
    steps.push(spec.writes === false ? { n: "Réponse", d: `Restitue le résultat en ${fmtLabel} dans la conversation.` } : { n: "Soumission", d: `Écrit le fichier ${spec.output_ext || ""} (${fmtLabel}).` });
  }
  return {
    id: spec.id,
    title: spec.title,
    kicker: "Sur mesure",
    icon: spec.icon || "🤖",
    accent: spec.accent || "var(--accent)",
    desc: brief,
    brief,
    produces: spec.output_ext || (spec.writes === false ? "réponse" : ""),
    loopOf: spec.template || "sur mesure",
    category: "Sur mesure",
    tags: [spec.template || "custom"],
    steps,
    consolidates: !!spec.consolidates,
    writes: spec.writes !== false,
    _custom: true,
    _strategy: spec.system_prompt || "",
    _spec: spec,
    _format: fmt,
    _formatLabel: fmtLabel,
    _defaults: { target_count: spec.defaults && spec.defaults.target_count || (spec.consolidates ? 3 : 0) }
  };
}
function _flowById(id) {
  const nat = JARVIS_AGENTS.find((f) => f.id === id);
  if (nat) return nat;
  const spec = _CUSTOM_SPEC_REG[id];
  if (spec) {
    try {
      return _specToFlow(spec);
    } catch (e) {
    }
  }
  return JARVIS_AGENTS[0];
}
function useCustomAgentFlows() {
  const [customs, setCustoms] = React.useState([]);
  const load = React.useCallback(async () => {
    try {
      const r = await fetch("api/jarvis/agents");
      if (!r.ok) return;
      const d = await r.json();
      for (const a of d.agents || []) {
        if (a && a.id) _CUSTOM_SPEC_REG[a.id] = a;
      }
      const cs = (d.agents || []).filter((a) => !a.builtin).map(_specToFlow);
      setCustoms(cs);
    } catch (e) {
    }
  }, []);
  React.useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("jdm-agents-changed", h);
    return () => window.removeEventListener("jdm-agents-changed", h);
  }, [load]);
  return customs;
}
function _startCustomAgent(flow) {
  if (typeof window === "undefined" || !window.__jdmJarvisStore) return;
  const cfg = window.__JDM_JARVIS_CONFIG__ || {};
  const _d = flow._spec && flow._spec.defaults || {};
  const _up = typeof _d.upload === "boolean" ? _d.upload : false;
  const params = {
    term: "",
    relation: [],
    model: cfg.llm || "gemini-3.1-flash-lite",
    use_thinking: true,
    budget_label: "illimité",
    pool_active: cfg.poolActive !== false,
    auto_switch: false,
    upload: flow.writes !== false ? _up : false,
    target_count: flow._defaults && flow._defaults.target_count || 0
  };
  window.__jdmJarvisStore.start(_allocSlot(flow.id), { params, isResume: false, resumeState: null }).catch(() => {
  });
}
const _BUILDER_FORMATS = [
  { value: "jdm", label: "Soumission JDM (lignes terme|relation|cible)" },
  { value: "ligne", label: "Ligne libre (1 ligne = 1 résultat, format libre)" },
  { value: "libre", label: "Libre (texte / prose)" },
  { value: "json", label: "JSON (données structurées)" }
];
const _FMT_DEFAULT_EXT = { jdm: ".enrich", ligne: ".txt", libre: ".txt", json: ".json" };
function _sanitizeExt(raw) {
  let e = (raw || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!e) return "";
  return "." + e.replace(/^\.+/, "");
}
function JAgentBuilderModal({ onClose, onCreated, editSpec }) {
  const _isEdit = !!(editSpec && editSpec.id);
  const [templates, setTemplates] = React.useState({});
  const [step, setStep] = React.useState("form");
  const [tab, setTab] = React.useState(_isEdit ? "prompt" : "instructions");
  const [name, setName] = React.useState(_isEdit ? editSpec.title || "" : "");
  const [description, setDescription] = React.useState(_isEdit ? editSpec.brief || "" : "");
  const [template, setTemplate] = React.useState(_isEdit ? editSpec.template || "libre" : "generation_endogene");
  const [strategy, setStrategy] = React.useState(
    _isEdit ? editSpec.instructions || editSpec.system_prompt || "" : ""
  );
  const [workflow, setWorkflow] = React.useState(_isEdit ? editSpec.system_prompt || "" : "");
  const [genSteps, setGenSteps] = React.useState(
    _isEdit && Array.isArray(editSpec.steps) ? editSpec.steps : []
  );
  const [writes, setWrites] = React.useState(_isEdit ? editSpec.writes !== false : true);
  const [consolidates, setConsolidates] = React.useState(_isEdit ? !!editSpec.consolidates : true);
  const [consTouched, setConsTouched] = React.useState(false);
  const [writesTouched, setWritesTouched] = React.useState(false);
  const [fmt, setFmt] = React.useState(_isEdit ? editSpec.output_format || "jdm" : "jdm");
  const [ext, setExt] = React.useState(_isEdit ? editSpec.output_ext || "" : "");
  const [extTouched, setExtTouched] = React.useState(_isEdit && !!editSpec.output_ext);
  const [target, setTarget] = React.useState(_isEdit ? editSpec.defaults && editSpec.defaults.target_count || 0 : 0);
  const [autoSubmit, setAutoSubmit] = React.useState(
    _isEdit ? !!(editSpec.defaults && editSpec.defaults.upload) : false
  );
  const [icon, setIcon] = React.useState(_isEdit ? editSpec.icon || "" : "");
  const [iconPick, setIconPick] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [genLoading, setGenLoading] = React.useState(false);
  const [toolOpts, setToolOpts] = React.useState([]);
  const [allowedTools, setAllowedTools] = React.useState(
    _isEdit && Array.isArray(editSpec.allowed_tools) ? editSpec.allowed_tools.slice() : null
  );
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("api/jarvis/agents");
        if (r.ok) {
          const d = await r.json();
          setTemplates(d.templates || {});
        }
      } catch (e) {
      }
    })();
  }, []);
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("api/jarvis/tools");
        if (!r.ok) return;
        const d = await r.json();
        const sel = (d.tools || []).filter((t) => t.kind !== "workflow");
        const opts = sel.map((t) => ({
          value: t.name,
          label: t.description ? `${t.name} — ${String(t.description).slice(0, 60)}` : t.name
        }));
        setToolOpts(opts);
        setAllowedTools((prev) => Array.isArray(prev) ? prev : []);
      } catch (e) {
      }
    })();
  }, []);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const tpl = templates[template] || {};
  const _userPickedTpl = React.useRef(false);
  const _didInitAlign = React.useRef(false);
  React.useEffect(() => {
    if (!Object.keys(templates).length) return;
    const userChange = _userPickedTpl.current;
    _userPickedTpl.current = false;
    if (!userChange) {
      if (_isEdit) return;
      if (_didInitAlign.current) return;
    }
    _didInitAlign.current = true;
    if (tpl.format && (tpl.format === "jdm" || tpl.format === "ligne" || tpl.format === "libre" || tpl.format === "json")) {
      setFmt(tpl.format);
    }
    if (!consTouched && typeof tpl.consolidates === "boolean") setConsolidates(tpl.consolidates);
    if (!writesTouched && typeof tpl.writes === "boolean") setWrites(tpl.writes);
  }, [template, templates]);
  const effExt = extTouched && ext.trim() ? _sanitizeExt(ext) : _FMT_DEFAULT_EXT[fmt] || ".txt";
  const _buildSpec = (forGen) => {
    const spec = {
      title: name.trim(),
      template,
      system_prompt: forGen ? "" : workflow.trim() || strategy.trim(),
      instructions: strategy.trim(),
      writes,
      consolidates,
      output_format: fmt,
      output_ext: effExt,
      brief: description.trim()
    };
    if (icon) spec.icon = icon;
    if (_isEdit) spec.id = editSpec.id;
    const _def = {};
    if (target > 0) _def.target_count = Number(target);
    if (writes) _def.upload = !!autoSubmit;
    if (Object.keys(_def).length) spec.defaults = _def;
    if (Array.isArray(genSteps) && genSteps.length) spec.steps = genSteps;
    if (Array.isArray(allowedTools) && allowedTools.length) {
      spec.allowed_tools = allowedTools;
    }
    return spec;
  };
  const generate = async () => {
    setGenLoading(true);
    setMsg("");
    try {
      const cfg = typeof window !== "undefined" && window.__JDM_JARVIS_CONFIG__ || {};
      const usedIcons = (() => {
        const s = /* @__PURE__ */ new Set();
        try {
          Object.values(AGENT_ICON || {}).forEach((v) => v && s.add(v));
          Object.values(_CUSTOM_SPEC_REG || {}).forEach((sp) => sp && sp.icon && s.add(sp.icon));
        } catch (e) {
        }
        if (_isEdit && editSpec.icon) s.delete(editSpec.icon);
        return [...s];
      })();
      const r = await fetch("api/jarvis/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: _buildSpec(true), config: { llm: cfg.llm, poolActive: cfg.poolActive, usedIcons } })
      });
      const d = await r.json();
      if (d.ok && d.workflow) {
        setWorkflow(d.workflow);
        if (d.icon) setIcon(d.icon);
        if (d.brief) setDescription(d.brief);
        if (Array.isArray(d.tools) && d.tools.length) {
          const valid = new Set(toolOpts.map((o) => o.value));
          const picked = d.tools.filter((t) => !valid.size || valid.has(t));
          if (picked.length) setAllowedTools(picked);
        }
        if (Array.isArray(d.steps) && d.steps.length) setGenSteps(d.steps);
      } else {
        setWorkflow(d.fallback || strategy.trim());
        if (d.error) setMsg("⚠ génération indisponible (" + d.error + ") — workflow = instructions brutes, éditable.");
      }
    } catch (e) {
      setWorkflow(strategy.trim());
      setMsg("⚠ " + (e.message || e));
    }
    setGenLoading(false);
  };
  const wand = async () => {
    if (!strategy.trim()) {
      setTab("instructions");
      setMsg("Écris d'abord les instructions.");
      return;
    }
    setTab("prompt");
    await generate();
  };
  const goRecap = async () => {
    if (!name.trim() || (_isEdit ? !workflow.trim() : !strategy.trim())) {
      setMsg(_isEdit ? "Nom et prompt requis." : "Nom et instructions requis.");
      return;
    }
    setMsg("");
    setStep("recap");
    if (!workflow.trim()) await generate();
  };
  const create = async () => {
    if (!name.trim() || (_isEdit ? !workflow.trim() : !strategy.trim())) {
      setMsg(_isEdit ? "Nom et prompt requis." : "Nom et instructions requis.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const spec = _buildSpec();
      const r = await fetch("api/jarvis/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec })
      });
      const d = await r.json();
      if (d.ok) {
        try {
          window.dispatchEvent(new CustomEvent("jdm-agents-changed"));
        } catch (e) {
        }
        const newId = d.spec && d.spec.id || d.agent_id || "";
        if (onCreated && newId) onCreated(newId);
        else onClose();
      } else {
        setMsg("✗ " + (d.error || "échec"));
      }
    } catch (e) {
      setMsg("✗ " + (e.message || e));
    }
    setBusy(false);
  };
  const fmtLabel = (_BUILDER_FORMATS.find((f) => f.value === fmt) || {}).label || fmt;
  const availIcons = (() => {
    const used = /* @__PURE__ */ new Set();
    try {
      Object.values(AGENT_ICON || {}).forEach((v) => v && used.add(v));
      Object.values(_CUSTOM_SPEC_REG || {}).forEach((sp) => sp && sp.icon && used.add(sp.icon));
    } catch (e) {
    }
    if (_isEdit && editSpec.icon) used.delete(editSpec.icon);
    if (icon) used.delete(icon);
    return _ICON_PICK_POOL.filter((em) => !used.has(em));
  })();
  const recapRow = (k, v) => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line-soft)" } }, /* @__PURE__ */ React.createElement("span", { style: { flex: "0 0 130px", fontSize: 12, color: "var(--ink-3)" } }, k), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--ink)", fontWeight: 500 } }, v));
  return ReactDOM.createPortal(
    // Pas de fermeture au clic sur le fond : un clic hors de la carte ne doit
    // PAS détruire le brouillon en cours (instructions, prompt généré…).
    // Fermeture volontaire seulement via « × Fermer » / « Annuler » / Échap.
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "5vh 20px",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
      background: "var(--bg)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-lg)",
      maxWidth: 640,
      width: "100%",
      boxShadow: "var(--shadow-lg)",
      padding: "20px 22px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: { fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { position: "relative", display: "inline-block" } }, /* @__PURE__ */ React.createElement(
      "span",
      {
        onClick: () => setIconPick((v) => !v),
        title: "Changer l'icône",
        style: { cursor: "pointer", userSelect: "none" }
      },
      icon || "🤖"
    ), iconPick && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: "100%",
      left: 0,
      zIndex: 20,
      marginTop: 6,
      background: "var(--bg-elev)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius)",
      padding: 8,
      boxShadow: "var(--shadow-lg)",
      display: "grid",
      gridTemplateColumns: "repeat(8, 1fr)",
      gap: 2,
      width: 300
    } }, availIcons.map((em) => /* @__PURE__ */ React.createElement(
      "span",
      {
        key: em,
        onClick: () => {
          setIcon(em);
          setIconPick(false);
        },
        style: {
          cursor: "pointer",
          fontSize: 18,
          lineHeight: "28px",
          textAlign: "center",
          borderRadius: 6,
          background: em === icon ? "rgba(138,35,66,0.15)" : "transparent"
        }
      },
      em
    )))), /* @__PURE__ */ React.createElement("span", null, step === "recap" ? _isEdit ? "Confirmer les modifications" : "Confirmer l'agent" : _isEdit ? "Modifier l'agent spécialiste" : "Créer un agent spécialiste")), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onClose }, "× Fermer")), step === "form" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Nom de l'agent" }, /* @__PURE__ */ React.createElement(Input, { value: name, onChange: setName, placeholder: "ex. Enrichisseur de cuisine" })), /* @__PURE__ */ React.createElement(Field, { label: "Template (préremplit consolide / écrit / format — modifiables)" }, /* @__PURE__ */ React.createElement(
      Select,
      {
        value: template,
        onChange: (v) => {
          _userPickedTpl.current = true;
          setTemplate(v);
        },
        options: Object.keys(templates).length ? Object.entries(templates).map(([k, v]) => ({ value: k, label: v.label || k })) : [{ value: "generation_endogene", label: "Génération endogène" }]
      }
    )), tpl.skeleton && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)", margin: "-4px 0 10px", lineHeight: 1.4 } }, tpl.skeleton), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { role: "tablist", style: { display: "flex", gap: 2, flex: 1 } }, [["instructions", "Instructions"], ["prompt", "Prompt de l'agent"]].map(([k, lbl]) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: k,
        type: "button",
        role: "tab",
        "aria-selected": tab === k,
        onClick: () => setTab(k),
        className: "focus-ring",
        style: {
          appearance: "none",
          cursor: "pointer",
          padding: "6px 12px",
          background: tab === k ? "var(--accent)" : "var(--bg-elev)",
          color: tab === k ? "#fff" : "var(--ink-2)",
          border: "1px solid " + (tab === k ? "var(--accent)" : "var(--line)"),
          borderRadius: "var(--radius)",
          fontFamily: "inherit",
          fontSize: 12.5
        }
      },
      lbl
    ))), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: wand,
        disabled: genLoading || !strategy.trim(),
        className: "focus-ring",
        title: "Générer le prompt de l'agent via l'orchestrateur",
        style: {
          appearance: "none",
          padding: "6px 12px",
          borderRadius: "var(--radius)",
          background: "var(--bg-card)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 12.5,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: genLoading || !strategy.trim() ? "not-allowed" : "pointer",
          opacity: genLoading || !strategy.trim() ? 0.55 : 1
        }
      },
      "🪄 ",
      genLoading ? "Génération…" : "Générer le prompt"
    )), tab === "instructions" ? /* @__PURE__ */ React.createElement(Field, { label: "Instructions — ce que l'agent doit faire (langage naturel)" }, /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: strategy,
        onChange: (e) => setStrategy(e.target.value),
        rows: 6,
        placeholder: "Décris ce que l'agent doit accomplir (ex. « enrichis les termes de cuisine en relations de parties, en partant de leurs idées associées, et consolide »). Puis 🪄 pour que l'orchestrateur en rédige le prompt.",
        style: {
          width: "100%",
          resize: "vertical",
          padding: "10px 12px",
          background: "var(--bg-card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13.5,
          lineHeight: 1.5,
          outline: "none"
        }
      }
    )) : /* @__PURE__ */ React.createElement(Field, { label: "Prompt de l'agent — rédigé par l'orchestrateur (éditable, c'est le cerveau de l'agent)" }, genLoading ? /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 12, color: "var(--ink-3)", padding: "10px 12px" } }, "… l'orchestrateur rédige le prompt …") : /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: workflow,
        onChange: (e) => setWorkflow(e.target.value),
        rows: 12,
        placeholder: "Vide → clique 🪄 pour générer depuis les instructions (ou écris le prompt directement).",
        style: {
          width: "100%",
          resize: "vertical",
          padding: "10px 12px",
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          color: "var(--ink)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
          outline: "none"
        }
      }
    )), /* @__PURE__ */ React.createElement(Field, { label: "Outils que l'agent peut mobiliser" }, /* @__PURE__ */ React.createElement(
      MultiSelect,
      {
        value: allowedTools || [],
        onChange: (v) => setAllowedTools(v),
        placeholder: toolOpts.length ? "— sélectionne les outils —" : "… chargement du catalogue …",
        options: toolOpts,
        searchable: true
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 5, lineHeight: 1.4 } }, "Présélectionné par l'orchestrateur (🪄). Vide → l'agent n'a que les outils cités par son prompt. Jamais tout le catalogue ni les ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "*_workflow"), ".")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Format de sortie" }, /* @__PURE__ */ React.createElement(Select, { value: fmt, onChange: (v) => {
      setFmt(v);
    }, options: _BUILDER_FORMATS })), /* @__PURE__ */ React.createElement(Field, { label: "Extension de fichier (libre)" }, /* @__PURE__ */ React.createElement(
      Input,
      {
        value: extTouched ? ext : effExt,
        onChange: (v) => {
          setExtTouched(true);
          setExt(v);
        },
        placeholder: _FMT_DEFAULT_EXT[fmt] || ".txt"
      }
    ))), /* @__PURE__ */ React.createElement(Field, { label: `Nombre cible · ${target || "—"}` }, /* @__PURE__ */ React.createElement(Slider, { value: target, onChange: setTarget, min: 0, max: 50, step: 1 })), msg && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 12, color: "var(--jdm-magenta)", marginBottom: 10 } }, msg), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8 } }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: onClose }, "Annuler"), /* @__PURE__ */ React.createElement(Button, { onClick: goRecap, disabled: !name.trim() || (_isEdit ? !workflow.trim() : !strategy.trim()) }, "Suivant : description & options →"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.45 } }, "Vérifie la configuration de l'agent avant de le créer. Tu peux revenir en arrière pour ajuster."), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14 } }, recapRow("Nom", icon ? /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { marginRight: 6 } }, icon), name.trim()) : name.trim()), description.trim() && recapRow("Description", description.trim()), recapRow("Template", tpl.label || template), recapRow("Format", fmtLabel), recapRow("Extension", /* @__PURE__ */ React.createElement("span", { className: "mono" }, writes ? effExt : "— (pas de fichier)")), recapRow("Écrit un fichier", writes ? "Oui" : "Non"), recapRow("Consolide", consolidates ? "Oui" : "Non"), recapRow("Nombre cible", target > 0 ? String(target) : "défaut"), recapRow("Outils", `${(allowedTools || []).length}${toolOpts.length ? ` / ${toolOpts.length}` : ""}`)), Array.isArray(genSteps) && genSteps.length > 0 && /* @__PURE__ */ React.createElement(Field, { label: "Étapes" }, /* @__PURE__ */ React.createElement("ol", { style: { margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 } }, genSteps.map((s, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, s.n), s.d ? ` — ${s.d}` : "")))), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", margin: "4px 0 8px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: consolidates,
        onChange: (e) => {
          setConsTouched(true);
          setConsolidates(e.target.checked);
        },
        style: { accentColor: "var(--accent)" }
      }
    ), "Consolide (vérifie chaque candidat par inférence avant de le retenir)"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", margin: "0 0 8px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: writes,
        onChange: (e) => {
          setWritesTouched(true);
          setWrites(e.target.checked);
        },
        style: { accentColor: "var(--accent)" }
      }
    ), "Produit un fichier de soumission (sinon résultat en réponse seulement)"), /* @__PURE__ */ React.createElement(
      "label",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: writes ? "var(--ink-2)" : "var(--ink-3)",
          cursor: writes ? "pointer" : "not-allowed",
          opacity: writes ? 1 : 0.55,
          margin: "-2px 0 6px"
        },
        title: writes ? "Valeur par défaut au lancement (nécessite une clé LLMDrops)" : "Active « Produit un fichier » pour pouvoir soumettre"
      },
      /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked: writes && autoSubmit,
          disabled: !writes,
          onChange: (e) => setAutoSubmit(e.target.checked),
          style: { accentColor: "var(--accent)" }
        }
      ),
      "Soumettre automatiquement à JDM (valeur par défaut au lancement)"
    ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)", margin: "-2px 0 14px", lineHeight: 1.4 } }, _isEdit ? "Les modifications sont enregistrées sur l'agent existant ; tu seras redirigé vers sa fiche." : "Après création, l'agent apparaît dans le Répertoire et la Supervision ; tu seras redirigé vers sa fiche."), msg && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 12, color: "var(--jdm-magenta)", marginBottom: 10 } }, msg), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: () => {
      setStep("form");
      setMsg("");
    } }, "← Modifier"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: onClose }, "Annuler"), /* @__PURE__ */ React.createElement(Button, { onClick: create, disabled: busy || genLoading || !name.trim() || !workflow.trim() }, busy ? "Enregistrement…" : _isEdit ? "Enregistrer" : "Créer l'agent")))))),
    document.body
  );
}
function JRunsSeparator({ label, count, action }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, margin: "4px 0 14px" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--ink-3)",
    whiteSpace: "nowrap",
    fontWeight: 600
  } }, label, typeof count === "number" ? /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-4, var(--ink-3))", fontWeight: 400 } }, ` · ${count}`) : ""), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, height: 1, background: "var(--line-soft)" } }), action && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: action.onClick,
      className: "focus-ring",
      title: "Retirer les runs terminés de la supervision",
      style: {
        appearance: "none",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--ink-3)",
        padding: "2px 2px",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 5
      }
    },
    action.label,
    " ",
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: 12 } }, "✕")
  ));
}
function JSupervisionPanel({ flows, onPick, onLaunch, onOpenRun, active }) {
  const customAgents = useCustomAgentFlows();
  const [showBuilder, setShowBuilder] = useState(false);
  const [tick, setTick] = useState(0);
  const rootRef = useRef(null);
  const [previewPath, setPreviewPath] = useState(null);
  const [detailRunId, setDetailRunId] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);
  const [serverRuns, setServerRuns] = useState([]);
  const adoptedRef = useRef(/* @__PURE__ */ new Set());
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const t = async () => {
      try {
        const r = await fetch("api/jarvis/runs");
        if (r.ok) {
          const d = await r.json();
          if (!alive) return;
          const runs = d.runs || [];
          setServerRuns(runs);
          for (const s of runs) {
            if ((s.status === "running" || s.status === "starting") && s.run_id && !adoptedRef.current.has(s.run_id)) {
              adoptedRef.current.add(s.run_id);
              ObsStore.observe(s.run_id, s.agent_id, s.headline);
            }
          }
        }
      } catch {
      }
    };
    t();
    const h = setInterval(t, 3e3);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [active]);
  const localActiveSet = useJarvisActiveSet();
  useEffect(() => {
    if (!active) return;
    const el = rootRef.current;
    if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      sc = sc.parentElement;
    }
    if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" });
  }, [active]);
  const [, _obsForce] = React.useReducer((x) => x + 1, 0);
  useEffect(() => ObsStore.subscribe("*", _obsForce), []);
  const _runsByFlow = {};
  for (const r of serverRuns) {
    if (r.agent_id) (_runsByFlow[r.agent_id] = _runsByFlow[r.agent_id] || []).push(r);
  }
  const cardSpecs = [];
  for (const f of [...flows, ...customAgents]) {
    const frs = _runsByFlow[f.id] || [];
    const activeR = frs.filter((r) => r.status === "running" || r.status === "starting").sort((a, b) => (a.started_at || 0) - (b.started_at || 0));
    for (const r of activeR) cardSpecs.push({ flow: f, run: r });
    if (!activeR.length) {
      const latest = frs.slice().sort((a, b) => (b.started_at || 0) - (a.started_at || 0))[0] || null;
      if (latest) cardSpecs.push({ flow: f, run: latest });
    }
    cardSpecs.push({ flow: f, run: null, isLaunch: true });
  }
  const live = cardSpecs.map((spec, i) => spec.isLaunch ? { isLaunch: true, isRunning: false, isDone: false, submitted: false } : computeAgentLive(
    spec.flow,
    i,
    tick,
    serverRuns,
    localActiveSet,
    spec.run ? { rec: ObsStore.getRun(spec.run.run_id), serverRun: spec.run } : void 0
  ));
  const _bucket = (l) => {
    if (l.isRunning) return 0;
    if (l.submitted) return 1;
    if (l.isDone) return 2;
    return 3;
  };
  const orderedIdx = cardSpecs.map((_, i) => i).sort((a, b) => {
    const ba = _bucket(live[a]);
    const bb = _bucket(live[b]);
    if (ba !== bb) return ba - bb;
    return a - b;
  });
  const agg = live.reduce((a, l) => ({
    iter: a.iter + (l.iter || 0),
    tools: a.tools + (l.tools || 0),
    accepted: a.accepted + (l.accepted || 0)
  }), { iter: 0, tools: 0, accepted: 0 });
  const activeCount = serverRuns.filter((r) => r.status === "running" || r.status === "starting").length;
  const runningIdx = orderedIdx.filter((i) => !cardSpecs[i].isLaunch && live[i].isRunning);
  const doneIdx = orderedIdx.filter((i) => !cardSpecs[i].isLaunch && !live[i].isRunning);
  const launchIdx = orderedIdx.filter((i) => cardSpecs[i].isLaunch);
  const clearFinished = async () => {
    try {
      await fetch("api/jarvis/runs/clear", { method: "POST" });
      const r = await fetch("api/jarvis/runs");
      if (r.ok) {
        const d = await r.json();
        setServerRuns(d.runs || []);
      }
    } catch (e) {
    }
  };
  const renderCard = (i) => {
    const spec = cardSpecs[i];
    const f = spec.flow;
    if (spec.isLaunch) {
      return /* @__PURE__ */ React.createElement(
        JLaunchCard,
        {
          key: "launch-" + f.id,
          flow: f,
          onLaunch: () => onLaunch(f.id),
          onDetail: () => onPick(f.id),
          onStart: () => {
            if (f._custom) {
              _startCustomAgent(f);
              return;
            }
            if (typeof window !== "undefined" && window.__jdmJarvisStore) {
              const dp = typeof defaultParamsFor === "function" ? defaultParamsFor(f.id) : {};
              window.__jdmJarvisStore.start(_allocSlot(f.id), { params: dp, isResume: false, resumeState: null }).catch(() => {
              });
            }
          }
        }
      );
    }
    const rid = spec.run && spec.run.run_id;
    const _origin = spec.run && spec.run.origin || "ui";
    return /* @__PURE__ */ React.createElement(
      JAgentDashCard,
      {
        key: rid || f.id,
        flow: f,
        num: i + 1,
        live: live[i],
        onOpen: () => onOpenRun(f.id, rid),
        onDetail: () => onPick(f.id),
        onLaunch: () => onLaunch(f.id),
        onPreview: (p) => setPreviewPath(p),
        onStart: () => {
          if (f._custom) {
            _startCustomAgent(f);
            return;
          }
          if (typeof window !== "undefined" && window.__jdmJarvisStore) {
            const dp = typeof defaultParamsFor === "function" ? defaultParamsFor(f.id) : {};
            window.__jdmJarvisStore.start(_allocSlot(f.id), { params: dp, isResume: false, resumeState: null }).catch(() => {
            });
          }
        }
      }
    );
  };
  return /* @__PURE__ */ React.createElement("div", { ref: rootRef, style: { width: "100%", maxWidth: 1120 } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    minHeight: 180,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
    flexWrap: "wrap",
    marginBottom: 18
  } }, typeof window !== "undefined" && window.JarvisBanner ? React.createElement(window.JarvisBanner) : null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 10
  } }, /* @__PURE__ */ React.createElement("em", { style: { fontStyle: "italic", fontFamily: "var(--font-display)", color: "var(--accent)", fontSize: 13, textTransform: "none", letterSpacing: 0 } }, "Jarvis"), /* @__PURE__ */ React.createElement("span", null, "·", " Supervision ", "·", " ", flows.length, " agents"), /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, color: activeCount > 0 ? "var(--jdm-green)" : "var(--ink-3)" } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: activeCount > 0 ? "var(--jdm-green)" : "var(--ink-3)" } }), " live")), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(32px, 4.2vw, 52px)",
    fontWeight: 500,
    letterSpacing: "-0.025em",
    lineHeight: 1,
    color: "var(--ink)"
  } }, "Tableau de ", /* @__PURE__ */ React.createElement("span", { style: { fontStyle: "italic", color: "var(--accent)" } }, "bord")), /* @__PURE__ */ React.createElement("p", { style: {
    margin: "14px 0 0",
    maxWidth: "54ch",
    fontSize: 13.5,
    lineHeight: 1.55,
    color: "var(--ink-3)"
  } }, "Jarvis est l'agent orchestrateur des différents agents JDM. Sur cette page il est possible de configurer Jarvis et voir le détail des agents individuels."))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "var(--line)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    marginBottom: 18
  } }, /* @__PURE__ */ React.createElement(JKpi, { label: "Agents actifs", value: activeCount, sub: "en boucle", dot: true }), /* @__PURE__ */ React.createElement(JKpi, { label: "Iterations", value: agg.iter, sub: "cumulees" }), /* @__PURE__ */ React.createElement(JKpi, { label: "Outils appeles", value: agg.tools, sub: "JDM" }), /* @__PURE__ */ React.createElement(JKpi, { label: "Items produits", value: agg.accepted, sub: "consolides/annotes", color: "var(--jdm-green)" })), runningIdx.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(JRunsSeparator, { label: "En cours", count: runningIdx.length }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14, marginBottom: 26 } }, runningIdx.map(renderCard))), doneIdx.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    JRunsSeparator,
    {
      label: "Terminés",
      count: doneIdx.length,
      action: { label: "Effacer", onClick: clearFinished }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14, marginBottom: 26 } }, doneIdx.map(renderCard))), /* @__PURE__ */ React.createElement(JRunsSeparator, { label: "À lancer", count: launchIdx.length }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 } }, launchIdx.map(renderCard), /* @__PURE__ */ React.createElement(JCreateAgentCard, { onClick: () => setShowBuilder(true) })), showBuilder && /* @__PURE__ */ React.createElement(
    JAgentBuilderModal,
    {
      onClose: () => setShowBuilder(false),
      onCreated: (id) => {
        setShowBuilder(false);
        if (onLaunch) onLaunch(id);
      }
    }
  ), previewPath && /* @__PURE__ */ React.createElement(FilePreviewModal, { path: previewPath, onClose: () => setPreviewPath(null) }), detailRunId && /* @__PURE__ */ React.createElement(
    RunDetailModal,
    {
      runId: detailRunId,
      onClose: () => setDetailRunId(null),
      onPreview: (p) => setPreviewPath(p)
    }
  ));
}
function FilePreviewModal({ path, onClose }) {
  const [content, setContent] = useState("… chargement …");
  const [err, setErr] = useState("");
  const name = (path || "").split(/[\\/]/).slice(-1)[0] || "";
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`api/productions/file?name=${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!alive) return;
        setContent(d.content || "(vide)");
      } catch (e) {
        if (!alive) return;
        setErr(String(e && e.message ? e.message : e));
        setContent("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [name]);
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  const isHtml = name.toLowerCase().endsWith(".html");
  const _ext = (name.toLowerCase().match(/\.([a-z]+)$/) || [])[1] || "";
  const _flowForExt = {
    enrich: "enrich",
    audit: "audit",
    err: "signalement",
    stat: "stats",
    annot: "annotation"
  }[_ext] || "";
  return ReactDOM.createPortal(/* @__PURE__ */ React.createElement("div", { onClick: onBackdropClick, style: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    maxWidth: 920,
    width: "100%",
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 13, color: "var(--ink)" } }, name), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } }, /* @__PURE__ */ React.createElement(FileSubmitButton, { filePath: path, agentId: _flowForExt }), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "secondary",
      onClick: () => {
        window.open(`api/productions/download?name=${encodeURIComponent(name)}`, "_blank");
      }
    },
    "Télécharger"
  ), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onClose }, "×"))), err ? /* @__PURE__ */ React.createElement("div", { style: {
    padding: 18,
    color: "var(--jdm-magenta)",
    fontFamily: "var(--font-mono)",
    fontSize: 12
  } }, "Erreur : ", err) : isHtml ? /* @__PURE__ */ React.createElement(
    "iframe",
    {
      title: name,
      srcDoc: content,
      sandbox: "allow-scripts allow-same-origin",
      style: { flex: 1, width: "100%", border: 0, minHeight: 500, background: "var(--bg)" }
    }
  ) : /* @__PURE__ */ React.createElement("pre", { style: {
    margin: 0,
    padding: 18,
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    lineHeight: 1.6,
    color: "var(--ink)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    flex: 1
  } }, content))), document.body);
}
function RunDetailModal({ runId, onClose, onPreview }) {
  const rec = useObsRun(runId);
  React.useEffect(() => {
    if (runId) ObsStore.observe(runId);
  }, [runId]);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [leftView, setLeftView] = useState("narration");
  const logRef = useRef(null);
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  const r = rec || {};
  const agentId = r.agentId || "";
  const flow = _flowById(agentId);
  const state = r.status || "idle";
  const log = r.log || [];
  const accepted = r.accepted || [];
  const narrationHTML = r.narrationHTML || "";
  const filePath = r.filePath || null;
  const baseMetrics = r.metrics || {};
  const parsed = React.useMemo(
    () => parseFilePreview(r.filePreview || "", agentId, flow && flow._format),
    [r.filePreview, agentId, flow && flow._format]
  );
  const produced = flow.consolidates ? baseMetrics.accepted || accepted.length || 0 : parsed.items.filter((i) => i.type !== "meta" && i.type !== "sens").length;
  const metrics = { ...baseMetrics, produced };
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);
  const fileName = filePath ? filePath.split(/[\\/]/).slice(-1)[0] : null;
  return ReactDOM.createPortal(/* @__PURE__ */ React.createElement("div", { onClick: onBackdrop, style: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "4vh 20px",
    overflow: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    maxWidth: 1080,
    width: "100%",
    boxShadow: "var(--shadow-lg)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  } }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0, display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 24, flexShrink: 0 } }, flow.icon || "🦾"), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    color: "var(--ink)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  } }, r.headline || flow.title || "Run"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 } }, state === "running" && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: flow.accent } }), state, " · ", flow.title, r.submitted && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--jdm-green)" } }, "· soumis")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexShrink: 0 } }, state === "running" && /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", onClick: () => ObsStore.stopObs(runId) }, "Arrêter"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onClose }, "× Fermer"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "16px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "var(--line)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    marginBottom: 14
  } }, /* @__PURE__ */ React.createElement(Metric, { label: "Outils", value: metrics.toolsCalled || 0, sub: "appels", accent: flow.accent }), /* @__PURE__ */ React.createElement(Metric, { label: "Tokens", value: fmtTokens(metrics.tokens || 0), sub: "estimés", mono: true }), /* @__PURE__ */ React.createElement(
    Metric,
    {
      label: metricLabelFor(agentId).label,
      value: metrics.produced,
      sub: metricLabelFor(agentId).sub,
      color: "var(--jdm-green)"
    }
  ), /* @__PURE__ */ React.createElement(Metric, { label: "Temps", value: fmtElapsed(metrics.elapsed || 0), sub: "écoulé", mono: true })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 } }, /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    gap: 8
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, leftView === "log" ? "Log temps réel" : "Narration LLM"), /* @__PURE__ */ React.createElement("div", { style: { display: "inline-flex", alignItems: "center", gap: 8 } }, state === "running" && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: flow.accent } }), /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: 2
  } }, [{ id: "narration", label: "Narration" }, { id: "log", label: "Log" }].map((t) => {
    const active = leftView === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        type: "button",
        onClick: () => setLeftView(t.id),
        className: "focus-ring",
        style: {
          padding: "3px 10px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: active ? flow.accent : "transparent",
          color: active ? "var(--bg)" : "var(--ink-3)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: active ? 600 : 500,
          transition: "background .18s, color .18s"
        }
      },
      t.label
    );
  })))), /* @__PURE__ */ React.createElement("div", { ref: logRef, className: "jdm-narration-pane", style: {
    height: 420,
    overflowY: "auto",
    padding: leftView === "log" ? 12 : 14,
    background: "var(--bg-card)",
    fontFamily: leftView === "log" ? "var(--font-mono)" : "inherit",
    fontSize: leftView === "log" ? 11 : 13,
    lineHeight: 1.55,
    color: "var(--ink)"
  } }, !narrationHTML && log.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", textAlign: "center", padding: "40px 0" } }, state === "idle" ? "En attente du lancement…" : "—"), leftView === "log" ? (() => {
    const fts = _toolSteps(agentId);
    const _norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase();
    const validatedSet = /* @__PURE__ */ new Set();
    if (Array.isArray(accepted)) {
      for (const a of accepted) {
        const t = _norm(a.subject || a.term), rr = _norm(a.relation), tg = _norm(a.target);
        if (t && rr && tg) validatedSet.add(`${t}|${rr}|${tg}`);
      }
    }
    if (parsed && Array.isArray(parsed.items)) {
      for (const it of parsed.items) {
        if (it.type === "consolidated" || it.type === "audit_signalement") {
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
        items.push({ tool: mm[1], triplet: mm[3] || "", isResult: !!mm[4] });
      }
    }
    const tentatives = [];
    let cur = null, prevStep = -1;
    for (const it of items) {
      if (it.isResult) {
        if (cur) cur.push(it);
        continue;
      }
      const s = fts[it.tool];
      if (s === void 0) {
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
    return /* @__PURE__ */ React.createElement(React.Fragment, null, tentatives.map((tent, ti) => /* @__PURE__ */ React.createElement("div", { key: "t" + ti, style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 0",
      marginBottom: 6,
      borderBottom: `1px dashed color-mix(in srgb, ${flow.accent} 35%, transparent)`,
      color: flow.accent,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontSize: 10
    } }, /* @__PURE__ */ React.createElement("span", { style: { background: flow.accent, color: "var(--bg)", padding: "1px 7px", borderRadius: 3, fontSize: 9.5 } }, "Tentative ", ti + 1), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 } }, tent.filter((x) => !x.isResult).length, " appel(s), ", tent.filter((x) => x.isResult).length, " retour(s)")), tent.filter((x) => !x.isResult && x.triplet).map((it, k) => {
      const parts = it.triplet.split("|");
      const [term, rel, target] = parts;
      const _key = term && rel && target ? `${term.trim().toLowerCase()}|${rel.trim().toLowerCase()}|${target.trim().toLowerCase()}` : null;
      const isValidated = _key && validatedSet.has(_key);
      return /* @__PURE__ */ React.createElement("div", { key: k, style: {
        display: "flex",
        gap: 8,
        marginBottom: 3,
        alignItems: "baseline",
        paddingLeft: 8,
        paddingRight: 8,
        background: isValidated ? "color-mix(in srgb, var(--jdm-green) 9%, transparent)" : "transparent",
        borderLeft: isValidated ? "2px solid var(--jdm-green)" : "2px solid transparent",
        borderRadius: "0 3px 3px 0",
        paddingTop: 2,
        paddingBottom: 2,
        transition: "background .25s, border-color .25s"
      }, title: isValidated ? "Triplet validé : passé en consolidation" : "Triplet tenté" }, /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, fontSize: 10, color: isValidated ? "var(--jdm-green)" : "var(--accent)", fontWeight: isValidated ? 700 : 400 } }, isValidated ? "✓" : "→"), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0, color: "var(--ink)", wordBreak: "break-word" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, term), rel && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " | "), /* @__PURE__ */ React.createElement("span", { style: { color: flow.accent } }, rel)), target && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " | "), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, target))), /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, color: "var(--ink-3)", fontSize: 9.5 } }, it.tool));
    }), tent.filter((x) => !x.isResult && x.triplet).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { paddingLeft: 8, fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" } }, "aucun triplet tenté (", tent.filter((x) => !x.isResult).length, " appel(s) sans args triplet)"))), (log || []).length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line-soft)" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 } }, "Events systeme"), log.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 2, alignItems: "baseline" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", flexShrink: 0 } }, l.t), /* @__PURE__ */ React.createElement("span", { style: {
      flexShrink: 0,
      minWidth: 56,
      color: l.kind === "tool" ? "var(--accent)" : l.kind === "accept" ? "var(--jdm-green)" : l.kind === "reject" ? "var(--jdm-magenta)" : l.kind === "iter" ? flow.accent : "var(--ink-3)"
    } }, l.tag), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", wordBreak: "break-word" } }, l.msg)))));
  })() : narrationHTML ? /* @__PURE__ */ React.createElement("div", { className: "jdm-prose", dangerouslySetInnerHTML: { __html: renderMarkdownJarvis(narrationHTML) } }) : log.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 4, alignItems: "baseline", fontFamily: "var(--font-mono)", fontSize: 11 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", flexShrink: 0 } }, l.t), /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, minWidth: 64, color: l.kind === "accept" ? "var(--jdm-green)" : l.kind === "reject" ? "var(--jdm-magenta)" : l.kind === "iter" ? flow.accent : "var(--ink-3)" } }, l.tag), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", wordBreak: "break-word" } }, l.msg))))), /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  } }, panelTitleFor(agentId), " · ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--jdm-green)" } }, metrics.produced), fileName && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)", marginLeft: 8, textTransform: "none", letterSpacing: 0 } }, "· ", fileName)), fileName && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
    FileSubmitButton,
    {
      filePath,
      agentId,
      submitted: r.submitted,
      running: state === "running"
    }
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      onClick: () => {
        const url = `api/productions/download?name=${encodeURIComponent(fileName)}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    "⬇ Télécharger"
  ))), /* @__PURE__ */ React.createElement("div", { style: { height: 420, overflowY: "auto", padding: 0, background: "var(--bg-card)" } }, (() => {
    const toShow = flow.consolidates && accepted.length ? accepted : parsed.items;
    if (toShow.length === 0) {
      return /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12, textAlign: "center", padding: "60px 0" } }, state === "idle" ? "Le panneau se remplira au fur et à mesure que le fichier est écrit." : "En attente des premiers résultats…");
    }
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, padding: 12 } }, toShow.map((it, i) => /* @__PURE__ */ React.createElement(ItemCard, { key: i, item: it, accent: flow.accent })));
  })())))))), document.body);
}
function JLaunchCard({ flow, onStart, onDetail, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      onClick: onLaunch,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLaunch && onLaunch();
        }
      },
      title: `Lancer « ${flow.title} » (vue Run)`,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      className: "focus-ring",
      style: {
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        background: "var(--bg-card)",
        border: "1px dashed " + (hover ? a : "var(--line)"),
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        opacity: hover ? 1 : 0.78,
        filter: hover ? "none" : "saturate(0.7)",
        boxShadow: hover ? `0 12px 32px -18px ${a}` : "var(--shadow-sm)",
        transition: "opacity .2s, filter .2s, border-color .16s, box-shadow .28s"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { height: 3, background: a, opacity: 0.55 } }),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 13, padding: "14px 15px 8px" } }, /* @__PURE__ */ React.createElement("div", { style: {
      flexShrink: 0,
      width: 50,
      height: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 34,
      lineHeight: 1,
      background: "transparent",
      border: "none"
    } }, agentIcon(flow.id)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 10,
      color: a,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: 3
    } }, flow.kicker), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      lineHeight: 1.05,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    } }, flow.title))),
    /* @__PURE__ */ React.createElement("div", { style: {
      padding: "0 16px 12px",
      fontSize: 12.5,
      color: "var(--ink-3)",
      lineHeight: 1.4
    } }, AGENT_BRIEF[flow.id] || ""),
    /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "auto",
      padding: "10px 14px",
      borderTop: "1px dashed var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "focus-ring",
        onClick: (e) => {
          e.stopPropagation();
          onStart && onStart();
        },
        title: `Démarrer « ${flow.title} » maintenant (defaults)`,
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 13px",
          borderRadius: 999,
          cursor: "pointer",
          border: "none",
          background: a,
          color: "var(--bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em"
        }
      },
      "▸ Démarrer"
    ), onDetail && /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "focus-ring",
        onClick: (e) => {
          e.stopPropagation();
          onDetail();
        },
        title: `Ouvrir la vue Run de « ${flow.title} »`,
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 10px",
          borderRadius: 999,
          cursor: "pointer",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--ink-2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em"
        }
      },
      "Détail →"
    ))
  );
}
function JCreateAgentCard({ onClick }) {
  const [hover, setHover] = useState(false);
  const a = "var(--accent)";
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      onClick,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      className: "focus-ring",
      title: "Créer un agent spécialiste",
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 150,
        cursor: "pointer",
        background: "var(--bg-card)",
        border: "1px dashed " + (hover ? a : "var(--line)"),
        borderRadius: "var(--radius-lg)",
        color: hover ? a : "var(--ink-3)",
        transition: "border-color .16s, color .16s, transform .18s",
        transform: hover ? "translateY(-2px)" : "none"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 30, lineHeight: 1 } }, "＋"),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.08em"
    } }, "Créer un agent spécialiste")
  );
}
function JKpi({ label, value, sub, color, dot }) {
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg-card)", padding: "13px 16px" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    display: "flex",
    alignItems: "center",
    gap: 6
  } }, dot && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: "var(--jdm-green)" } }), label), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    fontWeight: 600,
    marginTop: 4,
    color: color || "var(--ink)",
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums"
  } }, value), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 2 } }, sub));
}
function computeAgentLive(flow, i, tick, serverRuns, _localActiveSet, opts) {
  const store = opts && opts.rec ? opts.rec : typeof JarvisStore !== "undefined" ? JarvisStore.get(flow.id) : null;
  const runs = (serverRuns || []).filter((r) => r.agent_id === flow.id);
  const latest = opts && opts.serverRun ? opts.serverRun : runs.sort((a, b) => (b.started_at || 0) - (a.started_at || 0))[0] || null;
  const isLocallyRunning = store && store.status === "running";
  const isServerRunning = latest && (latest.status === "running" || latest.status === "starting");
  const isRunning = isLocallyRunning || isServerRunning;
  const m = store && store.metrics || { toolsCalled: 0, accepted: 0, tokens: 0, elapsed: 0 };
  let tools = m.toolsCalled || 0;
  const narration = store && store.narrationHTML || "";
  const toolSeq = [];
  if (narration) {
    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"([^>]*)>/g;
    let mm;
    while ((mm = re.exec(narration)) !== null) {
      const isResult = /data-result="1"/.test(mm[2] || "");
      if (!isResult) toolSeq.push(mm[1]);
    }
  }
  const fts = _toolSteps(flow);
  let iter = 0;
  {
    let prevStep = -1;
    for (const name of toolSeq) {
      const s = fts[name];
      if (s === void 0) continue;
      if (s === 0 && (prevStep === -1 || prevStep >= 1)) iter++;
      prevStep = s;
    }
  }
  if (iter < 1 && (isRunning || tools > 0)) iter = 1;
  const dp = typeof defaultParamsFor === "function" && defaultParamsFor(flow.id) || {};
  const budgetCap = dp.budget_label && /^\d+$/.test(String(dp.budget_label)) ? parseInt(dp.budget_label, 10) : null;
  const target = latest && latest.target_count || store && store.params && store.params.target_count || dp.target_count || null;
  const span = target || budgetCap || null;
  let accepted = 0, rejected = 0, items = [];
  if (flow.consolidates && Array.isArray(store && store.accepted)) {
    accepted = store.accepted.length;
    items = store.accepted;
  }
  if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id, flow._format);
    if (!flow.consolidates) {
      for (const it of parsed.items) {
        if (it.type === "flagged" || it.type === "signalement" || it.type === "audit_signalement") rejected++;
        else accepted++;
      }
      items = parsed.items;
    } else {
      for (const it of parsed.items) {
        if (it.type === "flagged" || it.type === "signalement") rejected++;
      }
    }
  }
  const produced = accepted;
  const pct = span ? Math.min(100, Math.round(produced / span * 100)) : null;
  let stepIdx = -1;
  if (isRunning) {
    for (let k = toolSeq.length - 1; k >= 0; k--) {
      const s = fts[toolSeq[k]];
      if (s !== void 0) {
        stepIdx = s;
        break;
      }
    }
  }
  let recent = [];
  if (flow.consolidates && Array.isArray(items) && items.length > 0) {
    recent = items.slice(-3).map((a, k) => ({
      key: "a" + k,
      label: a.label || `${a.subject || ""} | ${a.relation || ""} | ${a.target || ""}`,
      tag: (a.schema || "").replace(/^isa_?/, "isa-") || "consolidé",
      ok: true
    }));
  } else if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id, flow._format);
    recent = parsed.items.slice(-3).map((it, k) => {
      const tag = it.type === "flagged" ? it.category || "suspect" : it.type === "signalement" ? "JDM≠LLM" : it.type === "audit_signalement" ? it.verdict || "verdict" : it.type === "consolidated" ? it.category || "ok" : it.type === "sens" ? "sens" : it.type;
      return {
        key: "p" + k,
        label: `${it.subject || ""} | ${it.relation || ""} | ${it.target || ""}`,
        tag,
        ok: it.type !== "flagged" && it.type !== "signalement" && it.type !== "audit_signalement"
      };
    });
  }
  let nbAttempted = 0;
  for (const name of toolSeq) {
    if (name === "validate_candidate") nbAttempted++;
  }
  const _terms = /* @__PURE__ */ new Set();
  if (narration) {
    const re2 = /data-triplet="([^|"]+)/g;
    let mm2;
    while ((mm2 = re2.exec(narration)) !== null) {
      const t0 = (mm2[1] || "").trim();
      if (t0) _terms.add(t0);
    }
  }
  const nbTerms = _terms.size;
  const _st = latest && latest.stats || {};
  if (!narration) {
    if (!nbAttempted && _st.attempts) nbAttempted = _st.attempts;
    if (!accepted && _st.retained) accepted = _st.retained;
    if (!tools && _st.tools_count) tools = _st.tools_count;
  }
  if (flow.consolidates && nbAttempted > 0) {
    rejected = Math.max(0, nbAttempted - accepted);
  }
  const tokens = m.tokens || 0 || (_st.tokens || 0);
  const _validatedSet = /* @__PURE__ */ new Set();
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it.type === "consolidated" || it.type === "audit_signalement") {
        const tk = (it.subject || "").trim().toLowerCase();
        const rk = (it.relation || "").trim().toLowerCase();
        const gk = (it.target || "").trim().toLowerCase();
        if (tk && rk && gk) _validatedSet.add(`${tk}|${rk}|${gk}`);
      }
    }
  }
  const _tries = [];
  if (narration) {
    const reTry = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
    let mt;
    while ((mt = reTry.exec(narration)) !== null) {
      const isResult = !!mt[4];
      const triplet = mt[3] || "";
      if (isResult || !triplet) continue;
      _tries.push({ tool: mt[1], triplet });
    }
  }
  const _recentTries = _tries.slice(-5);
  const feedTries = _recentTries.map((t, idx) => {
    const parts = t.triplet.split("|");
    const tNorm = (parts[0] || "").trim().toLowerCase();
    const rNorm = (parts[1] || "").trim().toLowerCase();
    const gNorm = (parts[2] || "").trim().toLowerCase();
    const isValidated = tNorm && rNorm && gNorm && _validatedSet.has(`${tNorm}|${rNorm}|${gNorm}`);
    return {
      kind: "try",
      key: "tr" + idx + ":" + t.triplet,
      triplet: t.triplet,
      tool: t.tool,
      validated: isValidated
    };
  });
  const _log = store && store.log || [];
  const _sysTagsOK = /* @__PURE__ */ new Set(["[start]", "[file]", "[done]", "[err]", "[stop]", "[resume]"]);
  const _sysLog = _log.filter((e) => _sysTagsOK.has(e.tag)).slice(-2);
  const feedLog = _sysLog.map((e, idx) => ({
    kind: "log",
    key: "lg" + idx + ":" + (e.t || ""),
    t: e.t || "",
    tag: e.tag || "",
    msg: e.msg || "",
    ok: e.kind !== "reject"
  }));
  feedTries.reverse();
  feedLog.reverse();
  const feed = [...feedTries, ...feedLog];
  const submitted = !!(store && store.submitted);
  const isDone = store && store.status === "done" || latest && (latest.status === "done" || latest.status === "error");
  const filePath = store && store.filePath || latest && latest.stats && latest.stats.file || null;
  const runId = opts && opts.serverRun && opts.serverRun.run_id || store && store.runId || latest && latest.run_id || null;
  const origin = opts && opts.serverRun && opts.serverRun.origin || latest && latest.origin || "ui";
  return {
    iter,
    span,
    tools,
    accepted,
    rejected,
    produced,
    pct,
    recent,
    stepIdx,
    isRunning,
    nbAttempted,
    nbTerms,
    tokens,
    feed,
    submitted,
    isDone,
    filePath,
    runId,
    origin,
    headline: store && store.headline || latest && latest.headline || ""
  };
}
function JAgentDashCard({ flow, num, live, onOpen, onLaunch, onStart, onPreview, onDetail }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  const tint = (p) => `color-mix(in srgb, ${a} ${p}%, transparent)`;
  const dimmed = !live.isRunning;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      onClick: onOpen,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      className: "focus-ring",
      style: {
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-card)",
        border: "1px solid " + (hover ? a : "var(--line)"),
        borderRadius: "var(--radius-lg)",
        boxShadow: hover ? `0 12px 32px -18px ${a}` : "var(--shadow-sm)",
        overflow: "hidden",
        cursor: "pointer",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "transform .18s, border-color .16s, box-shadow .28s, opacity .25s, filter .25s",
        opacity: dimmed ? 0.62 : 1,
        filter: dimmed ? "saturate(0.55)" : "none",
        position: "relative"
      }
    },
    live.origin && live.origin !== "ui" && /* @__PURE__ */ React.createElement(
      "div",
      {
        title: live.origin === "chat" ? "Lancé par la mascotte Jarvis (chat)" : "Lancé côté serveur",
        style: {
          position: "absolute",
          top: -14,
          right: -12,
          zIndex: 3,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--bg-card)",
          border: `1.5px solid ${a}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-md)"
        }
      },
      /* @__PURE__ */ React.createElement(JRobotHead, { size: 32, title: live.origin === "chat" ? "Lancé par la mascotte Jarvis" : "Lancé côté serveur" })
    ),
    /* @__PURE__ */ React.createElement("div", { style: { height: 3, background: a, opacity: 0.9 } }),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 13, padding: "14px 15px 12px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "jring-btn",
        onClick: (e) => {
          e.stopPropagation();
          if (onStart) onStart();
          else onLaunch();
        },
        title: onStart ? `Lancer "${flow.title}" maintenant (defaults)` : `(Re)lancer "${flow.title}"`,
        "aria-label": `Lancer ${flow.title}`,
        style: { flexShrink: 0 }
      },
      /* @__PURE__ */ React.createElement(JLoopRing, { accent: a, num, steps: flow.steps.length, delay: num * 0.3, size: 50, icon: "power" })
    ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 10,
      color: a,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: 3
    } }, flow.kicker), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      lineHeight: 1.05,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    } }, flow.title)), live.isDone && !live.submitted && live.filePath && SUBMITTABLE_FLOWS.has(flow.id) && /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { flexShrink: 0 } }, /* @__PURE__ */ React.createElement(FileSubmitButton, { filePath: live.filePath, agentId: flow.id, compact: true })), (() => {
      const _stopProp = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      const _canPreview = !!live.filePath && (live.submitted || live.isDone);
      const _onClickBadge = (e) => {
        if (!_canPreview) return;
        _stopProp(e);
        if (typeof onPreview === "function") onPreview(live.filePath);
      };
      const _commonStyle = {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        padding: "4px 9px",
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 600,
        cursor: _canPreview ? "pointer" : "default"
      };
      if (live.isRunning) {
        return /* @__PURE__ */ React.createElement("span", { style: {
          ..._commonStyle,
          border: `1px solid ${tint(45)}`,
          background: tint(8),
          color: a
        } }, /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: a } }), " en cours");
      }
      if (live.submitted) {
        return /* @__PURE__ */ React.createElement(
          "span",
          {
            onClick: _onClickBadge,
            title: _canPreview ? "Voir le fichier produit" : "",
            style: {
              ..._commonStyle,
              border: "1px solid var(--jdm-green)",
              background: "color-mix(in srgb, var(--jdm-green) 10%, transparent)",
              color: "var(--jdm-green)"
            }
          },
          "soumis",
          _canPreview && /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.7, fontWeight: 400 } }, "·voir")
        );
      }
      if (live.isDone) {
        return /* @__PURE__ */ React.createElement(
          "span",
          {
            onClick: _onClickBadge,
            title: _canPreview ? "Voir le fichier produit" : "Flow terminé (pas de fichier)",
            style: {
              ..._commonStyle,
              fontWeight: 500,
              border: "1px solid var(--line-soft)",
              background: "var(--bg-elev)",
              color: "var(--ink-2)"
            }
          },
          "terminé",
          _canPreview && /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.6, fontWeight: 400 } }, "·voir")
        );
      }
      return /* @__PURE__ */ React.createElement("span", { style: {
        ..._commonStyle,
        fontWeight: 500,
        border: "1px solid var(--line-soft)",
        background: "var(--bg-elev)",
        color: "var(--ink-3)"
      } }, "en attente");
    })()),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "0 15px 12px", flexWrap: "wrap" } }, flow.steps.map((s, k) => {
      const isActive = live.isRunning && k === live.stepIdx;
      return /* @__PURE__ */ React.createElement(React.Fragment, { key: k }, k > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)", fontSize: 11 } }, "›"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
        fontSize: 10,
        padding: "3px 8px",
        borderRadius: 999,
        background: isActive ? tint(14) : "var(--bg-elev)",
        border: "1px solid " + (isActive ? tint(50) : "var(--line-soft)"),
        color: isActive ? a : "var(--ink-3)",
        fontWeight: isActive ? 600 : 400,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition: "all .25s"
      } }, isActive && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: a, width: 5, height: 5 } }), s.n));
    })),
    /* @__PURE__ */ React.createElement("div", { style: { padding: "0 15px 12px" } }, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color: "var(--ink-3)",
      marginBottom: 5
    } }, /* @__PURE__ */ React.createElement("span", null, "Tent. ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, live.nbAttempted || 0), /* @__PURE__ */ React.createElement("span", { style: { margin: "0 6px", color: "var(--line)" } }, "·"), "Term. ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, live.nbTerms || 0)), /* @__PURE__ */ React.createElement("span", { style: { color: a } }, flow.produces)), /* @__PURE__ */ React.createElement("div", { style: { height: 5, borderRadius: 999, background: "var(--bg-elev)", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: `${live.pct != null ? live.pct : Math.min(100, (live.nbAttempted || 0) * 8)}%`,
      height: "100%",
      background: a,
      borderRadius: 999,
      transition: "width .6s cubic-bezier(.4,0,.2,1)"
    } }))),
    /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 1,
      background: "var(--line-soft)",
      borderTop: "1px solid var(--line-soft)",
      borderBottom: "1px solid var(--line-soft)"
    } }, /* @__PURE__ */ React.createElement(JMini, { label: "cible", value: live.span != null ? live.span : "—", color: a }), /* @__PURE__ */ React.createElement(JMini, { label: "acceptes", value: live.accepted, color: "var(--jdm-green)" }), /* @__PURE__ */ React.createElement(JMini, { label: "rejetes", value: live.rejected, color: "var(--jdm-magenta)" }), /* @__PURE__ */ React.createElement(JMini, { label: "tokens", value: fmtTokens(live.tokens || 0) }), /* @__PURE__ */ React.createElement(JMini, { label: "outils", value: live.tools })),
    /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 15px 6px", flex: 1 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 9.5,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 7,
      display: "flex",
      alignItems: "center",
      gap: 6
    } }, live.isRunning && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: a, width: 5, height: 5 } }), live.isRunning ? "agent en direct" : "derniers events"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 4, minHeight: 78 } }, !live.feed || live.feed.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: {
      color: "var(--ink-3)",
      fontSize: 11,
      fontStyle: "italic",
      padding: "10px 0",
      textAlign: "center"
    } }, live.isRunning ? "En attente du 1er event…" : "Aucun event encore.") : live.feed.map((e) => e.kind === "try" ? (
      // Tentative de tool call (= ligne du Log temps réel) :
      // `→ triplet  tool_name`. Teinte verte + liseré gauche
      // si le triplet a fini par être validé (= dans accepted).
      /* @__PURE__ */ React.createElement("div", { key: e.key, className: "fade-up", style: {
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 8,
        paddingRight: 8,
        background: e.validated ? "color-mix(in srgb, var(--jdm-green) 9%, transparent)" : "transparent",
        borderLeft: e.validated ? "2px solid var(--jdm-green)" : "2px solid transparent",
        borderRadius: "0 3px 3px 0",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        minWidth: 0,
        transition: "background .25s, border-color .25s"
      } }, /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, color: a, opacity: 0.7 } }, "→"), /* @__PURE__ */ React.createElement("span", { style: {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, title: e.triplet }, e.triplet), /* @__PURE__ */ React.createElement("span", { style: {
        flex: "0 1 auto",
        minWidth: 0,
        color: "var(--ink-3)",
        fontSize: 9,
        lineHeight: 1.3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 110
      }, title: e.tool }, e.tool))
    ) : e.kind === "item" ? (
      // Triplet validé : format pretty avec ✓ vert + tag schema
      /* @__PURE__ */ React.createElement("div", { key: e.key, className: "fade-up", style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: "var(--radius)",
        background: "var(--bg-elev)",
        border: "1px solid var(--line-soft)",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        minWidth: 0
      } }, /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, color: "var(--jdm-green)" } }, "✓"), /* @__PURE__ */ React.createElement("span", { style: {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, title: e.label }, e.label), e.tag && /* @__PURE__ */ React.createElement("span", { style: {
        flex: "0 1 auto",
        minWidth: 0,
        color: "var(--ink-3)",
        fontSize: 9,
        lineHeight: 1.3,
        padding: "1px 5px",
        borderRadius: 3,
        background: "var(--bg-card)",
        border: "1px solid var(--line-soft)",
        maxWidth: 72,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, title: String(e.tag) }, e.tag))
    ) : (
      // Log système : timestamp + tag + msg mono compact (pied de page)
      /* @__PURE__ */ React.createElement("div", { key: e.key, className: "fade-up", style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        color: "var(--ink-3)",
        minWidth: 0,
        opacity: 0.75
      } }, /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0 } }, e.t), /* @__PURE__ */ React.createElement("span", { style: {
        flexShrink: 0,
        color: e.tag === "[err]" ? "var(--jdm-magenta)" : e.tag === "[file]" ? a : e.tag === "[done]" ? "var(--jdm-green)" : "var(--ink-3)"
      } }, e.tag), /* @__PURE__ */ React.createElement("span", { style: {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--ink-3)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, title: e.msg }, e.msg))
    )))),
    /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "9px 15px",
      borderTop: "1px solid var(--line-soft)",
      background: "var(--bg-elev)"
    } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" } }, "boucle ", "·", " ", flow.steps.length, " etapes"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: (e) => {
          e.stopPropagation();
          (onDetail || onOpen)();
        },
        className: "focus-ring",
        title: `Voir le détail de « ${flow.title} » (outils, étapes)`,
        style: {
          background: "transparent",
          border: "none",
          padding: "2px 0",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          transition: "color .16s, transform .16s"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.color = a;
          e.currentTarget.style.transform = "translateX(3px)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.color = "var(--ink-3)";
          e.currentTarget.style.transform = "none";
        }
      },
      "detail ",
      "→"
    ))
  );
}
function JMini({ label, value, color }) {
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg-card)", padding: "8px 12px", textAlign: "left" } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 17,
    fontWeight: 600,
    color: color || "var(--ink)",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums"
  } }, value), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 9, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 } }, label));
}
function useRingStyle() {
  const get = () => typeof window !== "undefined" && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.ringStyle || "boucle";
  const [s, setS] = useState(get);
  useEffect(() => {
    const f = () => setS(get());
    window.addEventListener("__jdm_tweaks_changed", f);
    return () => window.removeEventListener("__jdm_tweaks_changed", f);
  }, []);
  return s;
}
function JLoopRing({ accent, num, steps, delay, size = 60, icon }) {
  const ringStyle = useRingStyle();
  const c = `color-mix(in srgb, ${accent} 50%, var(--ink-3) 50%)`;
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
    return {
      ex,
      ey,
      b1: [ex - ah * tx + ah * 0.6 * px, ey - ah * ty + ah * 0.6 * py],
      b2: [ex - ah * tx - ah * 0.6 * px, ey - ah * ty - ah * 0.6 * py]
    };
  };
  const N = Math.max(2, steps || 2);
  let arcGroup, marks = null;
  if (ringStyle === "cycle") {
    const gap = N === 2 ? 26 : 22;
    const segs = [];
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const base = i * 360 / N;
      nodes.push(pt(base));
      const s = base + gap, e = (i + 1) * 360 / N - gap;
      const [sx, sy] = pt(s), [ex, ey] = pt(e);
      const large = e - s > 180 ? 1 : 0;
      segs.push({ sx, sy, ex, ey, large, a: arrow(e) });
    }
    arcGroup = segs.map((s, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement("path", { d: `M ${f(s.sx)} ${f(s.sy)} A ${R} ${R} 0 ${s.large} 1 ${f(s.ex)} ${f(s.ey)}` }), /* @__PURE__ */ React.createElement("path", { d: `M ${f(s.a.b1[0])} ${f(s.a.b1[1])} L ${f(s.ex)} ${f(s.ey)} L ${f(s.a.b2[0])} ${f(s.a.b2[1])}` })));
    marks = nodes.map((n, i) => /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement("circle", { cx: f(n[0]), cy: f(n[1]), r: 3.6, fill: "var(--bg-card)", stroke: c, strokeWidth: "1.6" }), /* @__PURE__ */ React.createElement("circle", { cx: f(n[0]), cy: f(n[1]), r: 1.6, fill: c })));
  } else {
    const g = 40;
    const s = g, e = 360 - g;
    const [sx, sy] = pt(s), [ex, ey] = pt(e);
    const a = arrow(e, 3.8);
    arcGroup = /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: `M ${f(sx)} ${f(sy)} A ${R} ${R} 0 1 1 ${f(ex)} ${f(ey)}` }), /* @__PURE__ */ React.createElement("path", { d: `M ${f(a.b1[0])} ${f(a.b1[1])} L ${f(ex)} ${f(ey)} L ${f(a.b2[0])} ${f(a.b2[1])}` }));
    marks = Array.from({ length: N }).map((_, i) => {
      const base = i * 360 / N;
      if (base < g || base > 360 - g) return null;
      const [mx, my] = pt(base);
      return /* @__PURE__ */ React.createElement("circle", { key: i, cx: f(mx), cy: f(my), r: 1.9, fill: c, opacity: "0.85" });
    });
  }
  return /* @__PURE__ */ React.createElement("span", { className: "jring", style: {
    position: "relative",
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", className: "jring-halo", style: {
    position: "absolute",
    inset: Math.round(size * 0.05),
    borderRadius: "50%",
    background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
    filter: "blur(7px)",
    animation: `jorbGlow 3.8s ease-in-out ${delay || 0}s infinite`
  } }), /* @__PURE__ */ React.createElement("svg", { width: size, height: size, viewBox: "0 0 64 64", style: { position: "relative", overflow: "visible" } }, /* @__PURE__ */ React.createElement("circle", { cx, cy, r: 26, fill: c, opacity: "0.05" }), /* @__PURE__ */ React.createElement("circle", { cx, cy, r: R, fill: "none", stroke: c, strokeWidth: "1", opacity: "0.16" }), /* @__PURE__ */ React.createElement("g", { className: "jring-arcs", stroke: c, fill: "none", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" }, arcGroup), marks, icon === "power" ? (
    // Icône power : arc ouvert en haut + barre verticale centrée.
    // Dimensionnée pour le viewBox 64x64 standard du ring (R=21).
    /* @__PURE__ */ React.createElement(
      "g",
      {
        transform: `translate(${cx} ${cy})`,
        stroke: c,
        strokeWidth: "2.2",
        fill: "none",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      /* @__PURE__ */ React.createElement("path", { d: "M -6 -3 A 7.5 7.5 0 1 0 6 -3" }),
      /* @__PURE__ */ React.createElement("line", { x1: "0", y1: "-9", x2: "0", y2: "-1.5" })
    )
  ) : /* @__PURE__ */ React.createElement(
    "text",
    {
      x: cx,
      y: cy,
      textAnchor: "middle",
      dominantBaseline: "central",
      fill: c,
      style: { fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 17 }
    },
    num
  )));
}
let TOOL_DOCS = {};
const _TOOL_DOCS_LISTENERS = /* @__PURE__ */ new Set();
let _TOOL_DOCS_LOADED = false;
function _notifyToolDocs() {
  for (const cb of _TOOL_DOCS_LISTENERS) {
    try {
      cb();
    } catch {
    }
  }
}
async function _loadToolDocs() {
  if (_TOOL_DOCS_LOADED) return;
  try {
    const r = await fetch("api/jarvis/tools");
    if (!r.ok) return;
    const d = await r.json();
    const m = {};
    for (const t of d.tools || []) {
      const argList = (t.args || []).map((a) => a.name + (a.required ? "" : "?")).join(", ");
      m[t.name] = {
        sig: t.signature || `${t.name}(${argList})`,
        kind: t.kind || "outil",
        desc: (t.description || "").split("\n")[0],
        // 1re ligne en résumé
        docstring: t.docstring || t.description || "",
        // Pas d'entrée prompt ni de cli côté backend — on synthétise.
        prompt: `# Outil LangChain — ${t.name}

` + (t.description || "").slice(0, 600) + ((t.description || "").length > 600 ? "…" : ""),
        cli: `# Disponible via le serveur MCP
mcp call ${t.name} ${(t.args || []).map((a) => "--" + a.name + " …").join(" ")}`,
        output: (t.args || []).length === 0 ? "{}" : "{\n  // sortie selon la signature du tool\n  // schéma : " + (t.args || []).map((a) => a.name + ":" + (a.type || "any")).join(", ") + "\n}"
      };
    }
    TOOL_DOCS = m;
    _TOOL_DOCS_LOADED = true;
    _notifyToolDocs();
  } catch {
  }
}
if (typeof window !== "undefined") {
  _loadToolDocs();
}
function useToolDocs() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    _TOOL_DOCS_LISTENERS.add(force);
    return () => _TOOL_DOCS_LISTENERS.delete(force);
  }, []);
  return [TOOL_DOCS, _TOOL_DOCS_LOADED];
}
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
    submit_to_jdm: 2
  },
  audit: {
    audit_workflow: 0,
    pick_random_term: 0,
    disambiguate: 0,
    exists: 0,
    get_relations_of_type: 1,
    verify_claim: 1,
    write_submission_file: 2
  },
  gap: {
    gap_detection_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    detect_gaps: 1,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1
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
    write_submission_file: 2
  },
  stats: {
    stats_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1
  },
  annotation: {
    annotation_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    disambiguate: 0,
    get_relations_of_type: 1,
    write_submission_file: 2
  }
};
function JToolCode({ children }) {
  return /* @__PURE__ */ React.createElement("pre", { className: "mono", style: {
    margin: 0,
    padding: "12px 14px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    fontSize: 12,
    lineHeight: 1.55,
    color: "var(--ink-2)",
    overflowX: "auto",
    whiteSpace: "pre",
    fontFamily: "var(--font-mono)"
  } }, children);
}
function JToolSection({ label, children }) {
  return /* @__PURE__ */ React.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10.5,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 8
  } }, label), children);
}
function JCopyBtn({ text, dark }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e) => {
    e.stopPropagation();
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    const fb = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e2) {
      }
      done();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fb);
      } else fb();
    } catch (err) {
      fb();
    }
  };
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onCopy,
      className: dark ? "jcli-copy" : "jcode-copy",
      title: "Copier",
      "aria-label": "Copier dans le presse-papiers"
    },
    copied ? "✓ Copié" : "⧉ Copier"
  );
}
function highlightCode(src) {
  const C = {
    comment: "#6b7280",
    guill: "#c9a978",
    verb: "#ff9e64",
    ph: "#7dcfff",
    key: "#7aa2f7",
    str: "#9ece6a",
    num: "#bb9af7",
    bool: "#ff9e64",
    punct: "#8b92a5",
    arrow: "#8b92a5"
  };
  const out = [];
  const re = /(#[^\n]*)|(«[^»]*»)|\b(GET|POST|PUT|DELETE|PATCH)\b|(\{[a-zA-Z0-9_]+\})|("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|(→)|([{}\[\],:])/g;
  let last = 0, m, i = 0;
  const push = (txt, color, extra) => out.push(/* @__PURE__ */ React.createElement("span", { key: i++, style: { color, ...extra || {} } }, txt));
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(/* @__PURE__ */ React.createElement("span", { key: i++ }, src.slice(last, m.index)));
    if (m[1] !== void 0) push(m[1], C.comment, { fontStyle: "italic" });
    else if (m[2] !== void 0) push(m[2], C.guill, { fontStyle: "italic" });
    else if (m[3] !== void 0) push(m[3], C.verb, { fontWeight: 600 });
    else if (m[4] !== void 0) push(m[4], C.ph);
    else if (m[5] !== void 0) {
      const isKey = m[6] !== void 0;
      push(m[5], isKey ? C.key : C.str);
      if (isKey) push(m[6], C.punct);
    } else if (m[7] !== void 0) push(m[7], C.num);
    else if (m[8] !== void 0) push(m[8], C.bool);
    else if (m[9] !== void 0) push(m[9], C.arrow);
    else if (m[10] !== void 0) push(m[10], C.punct);
    last = re.lastIndex;
  }
  if (last < src.length) out.push(/* @__PURE__ */ React.createElement("span", { key: i++ }, src.slice(last)));
  return out;
}
function JCodeBlock({ tag, code }) {
  return /* @__PURE__ */ React.createElement("div", { style: { borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid #2a2f3a", background: "#0f1117" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "7px 8px 7px 12px",
    background: "#191c24",
    borderBottom: "1px solid #2a2f3a"
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 9.5, color: "#8b92a5", textTransform: "uppercase", letterSpacing: "0.1em" } }, tag || "CODE"), /* @__PURE__ */ React.createElement(JCopyBtn, { text: code, dark: true })), /* @__PURE__ */ React.createElement("pre", { className: "mono", style: {
    margin: 0,
    padding: "13px 14px",
    background: "#0f1117",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#d6dbe5",
    overflowX: "auto",
    whiteSpace: "pre",
    fontFamily: "var(--font-mono)"
  } }, /* @__PURE__ */ React.createElement("code", null, highlightCode(code))));
}
function JCliBlock({ command }) {
  return /* @__PURE__ */ React.createElement("div", { style: { borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid #2a2f3a", background: "#0f1117" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 12px", background: "#191c24", borderBottom: "1px solid #2a2f3a" } }, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" } }), /* @__PURE__ */ React.createElement("span", { style: { width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" } }), /* @__PURE__ */ React.createElement("span", { style: { width: 10, height: 10, borderRadius: "50%", background: "#27c93f" } })), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, color: "#8b92a5", letterSpacing: "0.04em", marginLeft: 4 } }, "zsh — jdm-agent"), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, /* @__PURE__ */ React.createElement(JCopyBtn, { text: command, dark: true }))), /* @__PURE__ */ React.createElement("div", { style: { padding: "13px 14px", display: "flex", gap: 9, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "#4ea63c", userSelect: "none", flexShrink: 0, fontSize: 12.5, lineHeight: 1.6 } }, "$"), /* @__PURE__ */ React.createElement("code", { className: "mono", style: { color: "#e6e9ef", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)" } }, command)));
}
function JToolDialog({ flow, tool, onClose }) {
  const [docs, ready] = useToolDocs();
  const doc = docs[tool] || {
    sig: tool + "(…)",
    kind: "outil",
    desc: ready ? "Outil non documenté." : "Chargement du catalogue…",
    docstring: "—",
    prompt: "—",
    cli: tool,
    output: "—"
  };
  const customFlows = useCustomAgentFlows();
  const allFlows = [...JARVIS_AGENTS, ...customFlows];
  const [selectedFlowId, setSelectedFlowId] = useState(flow.id);
  const selectedFlow = allFlows.find((f) => f.id === selectedFlowId) || flow;
  const a = selectedFlow.accent;
  const kindColor = { "API JDM": "var(--jdm-cyan)", "LLM": "var(--jdm-violet)", "logique": "var(--jdm-orange)" }[doc.kind] || a;
  const _stepOf = (f) => {
    if (f._custom) return null;
    const s = _toolSteps(f)[tool];
    return s != null ? s : null;
  };
  const _usesTool = (f) => {
    if (f._custom) {
      const al = f._spec && f._spec.allowed_tools || [];
      return Array.isArray(al) && al.includes(tool);
    }
    return _toolSteps(f)[tool] != null;
  };
  const usages = allFlows.filter(_usesTool);
  const flowPrompt = (() => {
    if (selectedFlow._custom) {
      const strat = selectedFlow._strategy || selectedFlow._spec && selectedFlow._spec.system_prompt || "";
      return strat ? `# STRATEGIE — agent sur mesure « ${selectedFlow.title} » (${selectedFlow.id})

${strat}` : doc.prompt;
    }
    const fts = _toolSteps(selectedFlow);
    const ordered = Object.keys(fts).sort((a2, b) => fts[a2] - fts[b]);
    if (ordered.length === 0) return doc.prompt;
    const parts = [
      `# PROMPT AGREGED — flow « ${selectedFlow.title} » (${selectedFlow.id})`,
      `# Etapes : ${selectedFlow.steps.map((s, k) => `[${k}] ${s.n}`).join(" → ")}`,
      `# ${ordered.length} tools concatenes ci-dessous dans l'ordre d'execution.`,
      `# C'est ce que voit le LLM comme contexte agent pour ce flow.`,
      ""
    ];
    for (const t of ordered) {
      const d = docs[t];
      const step = fts[t];
      const stepName = selectedFlow.steps[step] && selectedFlow.steps[step].n || "";
      parts.push(`## [step ${step}${stepName ? " · " + stepName : ""}] ${t}()`);
      parts.push("");
      if (d) {
        if (d.sig) parts.push(`# signature : ${d.sig}`);
        if (d.kind) parts.push(`# kind : ${d.kind}`);
        if (d.sig || d.kind) parts.push("");
        parts.push((d.docstring || d.desc || "(pas de docstring)").trim());
      } else {
        parts.push("(documentation indisponible — catalogue /api/jarvis/tools encore en chargement ou ce tool n'est pas registry-expose)");
      }
      parts.push("");
      parts.push("---");
      parts.push("");
    }
    return parts.join("\n");
  })();
  const codeTabs = [
    { id: "docstring", label: "Docstring", body: doc.docstring, lang: "text", tag: doc.kind === "API JDM" ? "HTTP" : "DOC" },
    { id: "prompt", label: "Prompt", body: flowPrompt, lang: "text", tag: "PROMPT · FLOW" },
    { id: "cli", label: "CLI", body: doc.cli, lang: "sh" },
    { id: "output", label: "Sortie", body: doc.output, lang: "json", tag: "JSON" }
  ];
  const [tab, setTab] = useState(doc.kind === "LLM" ? "prompt" : "docstring");
  const active = codeTabs.find((t) => t.id === tab) || codeTabs[0];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return ReactDOM.createPortal(/* @__PURE__ */ React.createElement("div", { onClick: onClose, className: "jtool-backdrop", style: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "rgba(15,12,8,0.5)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)"
  } }, /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: (e) => e.stopPropagation(),
      role: "dialog",
      "aria-modal": "true",
      "aria-label": doc.sig,
      className: "fade-up jpanel-scroll",
      style: {
        width: "min(820px, 100%)",
        maxHeight: "90vh",
        overflowY: "auto",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        borderTop: `3px solid ${kindColor}`
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "sticky",
      top: 0,
      zIndex: 1,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
      padding: "16px 20px 14px",
      background: "var(--bg-card)",
      borderBottom: "1px solid var(--line-soft)"
    } }, /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 600,
      color: "var(--ink)",
      letterSpacing: "-0.01em"
    } }, tool, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "()")), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
      fontSize: 9.5,
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid color-mix(in srgb, ${kindColor} 50%, transparent)`,
      background: `color-mix(in srgb, ${kindColor} 9%, transparent)`,
      color: kindColor,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontWeight: 600
    } }, doc.kind)), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 } }, doc.sig)), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onClose, "aria-label": "Fermer", className: "focus-ring", style: {
      flexShrink: 0,
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: "1px solid var(--line)",
      background: "var(--bg-elev)",
      color: "var(--ink-2)",
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1
    } }, "✕")),
    /* @__PURE__ */ React.createElement("div", { style: { padding: "4px 20px 20px" } }, /* @__PURE__ */ React.createElement(JToolSection, { label: "Description" }, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" } }, doc.desc)), /* @__PURE__ */ React.createElement(JToolSection, { label: usages.length > 1 ? "Inscription dans les séquences" : "Inscription dans la séquence" }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 10 } }, usages.map((u) => {
      const si = _stepOf(u);
      const isOriginFlow = u.id === flow.id;
      const isSelected = u.id === selectedFlowId;
      const uc = u.accent;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: u.id,
          type: "button",
          onClick: () => setSelectedFlowId(u.id),
          className: "focus-ring",
          title: isSelected ? `Flow viewé — Prompt + step ci-dessous concernent « ${u.title} »` : `Cliquer pour voir le Prompt agreged + l'étape de « ${u.title} »`,
          style: {
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            background: isSelected ? `color-mix(in srgb, ${uc} 14%, var(--bg-elev))` : "var(--bg-elev)",
            border: "1px solid " + (isSelected ? `color-mix(in srgb, ${uc} 55%, transparent)` : "var(--line-soft)"),
            boxShadow: isSelected ? `0 0 0 1px color-mix(in srgb, ${uc} 35%, transparent), 0 6px 18px -10px ${uc}` : "none",
            transition: "background .18s, border-color .18s, box-shadow .25s",
            fontFamily: "inherit"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: {
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: uc,
          flexShrink: 0,
          opacity: isSelected ? 1 : 0.6
        } }), /* @__PURE__ */ React.createElement("span", { className: "display", style: {
          fontFamily: "var(--font-display)",
          fontSize: 14.5,
          fontWeight: 600,
          color: isSelected ? "var(--ink)" : "var(--ink-2)",
          letterSpacing: "-0.01em"
        } }, u.title), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" } }, u.kicker), isOriginFlow && /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
          fontSize: 9,
          padding: "2px 7px",
          borderRadius: 999,
          // Pastille « actuel » TOUJOURS presente sur le flow
          // d'origine — meme si on a clique ailleurs. Quand
          // elle n'est PLUS le flow viewé, on l'attenue (border
          // pointillé, fond plus discret).
          background: isSelected ? `color-mix(in srgb, ${uc} 22%, transparent)` : "transparent",
          border: isSelected ? "1px solid transparent" : `1px dashed color-mix(in srgb, ${uc} 50%, transparent)`,
          color: uc,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600
        } }, "actuel"), isSelected && !isOriginFlow && // Indicateur « viewé » sur un flow autre que l'origine
        // — pour signaler que c'est le flow qui alimente le
        // Prompt sans ambiguïté.
        /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
          fontSize: 9,
          padding: "2px 7px",
          borderRadius: 999,
          background: uc,
          color: "var(--bg)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700
        } }, "viewé")),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: si != null ? 7 : 0 } }, u.steps.map((s, k) => {
          const act = k === si;
          return /* @__PURE__ */ React.createElement(React.Fragment, { key: k }, k > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--line)", fontSize: 12 } }, "›"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
            fontSize: 10.5,
            padding: "3px 9px",
            borderRadius: 999,
            background: act ? `color-mix(in srgb, ${uc} 16%, transparent)` : "var(--bg-card)",
            border: "1px solid " + (act ? `color-mix(in srgb, ${uc} 50%, transparent)` : "var(--line-soft)"),
            color: act ? uc : "var(--ink-3)",
            fontWeight: act ? 600 : 400
          } }, s.n));
        })),
        si != null && u.steps[si] && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, lineHeight: 1.5, color: "var(--ink-3)" } }, "Étape ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "« ", u.steps[si].n, " »"), " — ", u.steps[si].d, ".")
      );
    }))), /* @__PURE__ */ React.createElement(JToolSection, { label: "Détails de l'outil" }, /* @__PURE__ */ React.createElement("div", { role: "tablist", style: { display: "flex", gap: 2, marginBottom: 10, borderBottom: "1px solid var(--line-soft)" } }, codeTabs.map((t) => {
      const on = t.id === tab;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t.id,
          type: "button",
          role: "tab",
          "aria-selected": on,
          onClick: () => setTab(t.id),
          className: "focus-ring",
          style: {
            appearance: "none",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "7px 12px",
            marginBottom: -1,
            borderBottom: "2px solid " + (on ? kindColor : "transparent"),
            color: on ? "var(--ink)" : "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: on ? 600 : 400,
            transition: "color .15s, border-color .15s"
          }
        },
        t.label
      );
    })), active.id === "cli" ? /* @__PURE__ */ React.createElement(JCliBlock, { command: doc.cli }) : /* @__PURE__ */ React.createElement(JCodeBlock, { tag: active.tag, code: active.body })))
  )), document.body);
}
function JAgentPanel({ flow, index, panelPos: panelPosProp, total, onLaunch, onIndex, onSommaire, standalone, onBack, onEdit, onDelete }) {
  const isCustom = !!flow._custom;
  const steps = _toolSteps(flow);
  const tools = Object.keys(steps);
  const samples = [];
  const params = defaultParamsFor(flow.id);
  const [openTool, setOpenTool] = useState(null);
  const [_allDocs] = useToolDocs();
  let customTools = [];
  if (isCustom) {
    const al = flow._spec && flow._spec.allowed_tools || [];
    customTools = al && al.length ? al : Object.keys(_allDocs || {}).filter((n) => n && !n.endsWith("_workflow")).sort();
  }
  const panelPos = panelPosProp != null && panelPosProp >= 0 ? panelPosProp : J_PANELS.findIndex((p) => p.id === flow.id);
  const sectionCount = typeof J_SECTIONS !== "undefined" ? J_SECTIONS.length : 3;
  const carouselTotal = total != null && total > 0 ? total : J_PANELS.length;
  const agentCount = carouselTotal - sectionCount;
  const agentNum = panelPos - sectionCount + 1;
  const safeIndex = index >= 0 ? index : 0;
  const lastFlow = panelPos >= carouselTotal - 1;
  return /* @__PURE__ */ React.createElement("div", { style: { width: "100%", maxWidth: 1120, margin: standalone ? "0 auto" : void 0, padding: standalone ? "6px 28px 80px" : void 0 } }, openTool && /* @__PURE__ */ React.createElement(JToolDialog, { flow, tool: openTool, onClose: () => setOpenTool(null) }), standalone && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onBack, className: "focus-ring", style: { ...ghostLinkStyle, marginBottom: 16 } }, "← Retour"), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    paddingBottom: 16,
    marginBottom: 24,
    borderBottom: `1px solid var(--line)`
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 20 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onLaunch,
      className: "jring-btn",
      title: "Lancer cet agent",
      "aria-label": "Lancer cet agent",
      style: { flexShrink: 0 }
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 84,
      height: 84,
      fontSize: 56,
      lineHeight: 1,
      background: "transparent",
      border: "none"
    } }, agentIcon(flow.id))
  ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: flow.accent,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: 8
  } }, flow.kicker, agentNum >= 1 && agentCount >= 1 ? ` · ${agentNum} / ${agentCount}` : ""), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(30px, 3.6vw, 44px)",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    lineHeight: 1.02,
    color: "var(--ink)"
  } }, flow.title), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 9, display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em"
  } }, "produit"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    fontSize: 17,
    color: "var(--ink-2)"
  } }, flow.produces)))), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${flow.accent} 55%, var(--line))`,
    color: `color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    background: `color-mix(in srgb, ${flow.accent} 7%, transparent)`
  } }, /* @__PURE__ */ React.createElement(LoopGlyph, { color: `color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))` }), " boucle · ", flow.steps.length, " étapes")), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
    gap: 26,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 20 } }, /* @__PURE__ */ React.createElement("p", { style: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: "var(--ink-2)",
    maxWidth: "58ch"
  } }, flow.desc), /* @__PURE__ */ React.createElement(JLoopDiagram, { flow }), tools.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "Outils JDM mobilisés"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, tools.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      type: "button",
      onClick: () => setOpenTool(t),
      className: "jtool-chip",
      title: `Voir la fiche de ${t}()`,
      style: {
        fontSize: 11,
        padding: "4px 9px",
        background: "var(--bg-elev)",
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--radius)",
        color: "var(--ink-2)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition: "border-color .14s, color .14s, background .14s"
      }
    },
    t,
    "()",
    /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.5, fontSize: 10 } }, "↗")
  )))), isCustom && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "Stratégie de l'agent"), /* @__PURE__ */ React.createElement("div", { style: {
    whiteSpace: "pre-wrap",
    fontFamily: "var(--font-mono)",
    fontSize: 12.5,
    lineHeight: 1.55,
    color: "var(--ink-2)",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
    maxHeight: 320,
    overflow: "auto"
  } }, flow._strategy || "(stratégie non renseignée)"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    margin: "16px 0 8px"
  } }, "Outils JDM mobilisés"), customTools.length ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, customTools.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      type: "button",
      onClick: () => setOpenTool(t),
      className: "jtool-chip",
      title: `Voir la fiche de ${t}()`,
      style: {
        fontSize: 11,
        padding: "4px 9px",
        background: "var(--bg-elev)",
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--radius)",
        color: "var(--ink-2)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition: "border-color .14s, color .14s, background .14s"
      }
    },
    t,
    "()",
    /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.5, fontSize: 10 } }, "↗")
  ))) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 } }, "… chargement du catalogue d'outils …"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement(Card, { padding: 16, style: { borderTop: `3px solid ${flow.accent}` } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 10
  } }, "Tu paramètres"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 9 } }, Object.entries(params).map(([k, v]) => /* @__PURE__ */ React.createElement("div", { key: k, style: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 12.5
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-3)", flexShrink: 0 } }, PARAM_LABELS[k] || k), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, borderBottom: "1px dotted var(--line)", transform: "translateY(-4px)" } }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    color: "var(--ink)",
    textAlign: "right",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "62%"
  } }, formatParam(k, v)))))), /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "9px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "Aperçu des résultats validés")), /* @__PURE__ */ React.createElement("div", { style: { padding: 10, display: "grid", gap: 4 } }, samples.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-mono)",
    fontSize: 11
  } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--jdm-green)", flexShrink: 0 } }, "✓"), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.label), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", flexShrink: 0 } }, s.s.toFixed(2))))), /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 14px",
    borderTop: "1px solid var(--line-soft)",
    background: "var(--bg-elev)",
    fontFamily: "var(--font-mono)",
    fontSize: 10.5,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  } }, "Exemple · la boucle en accumule davantage")), /* @__PURE__ */ React.createElement(Button, { full: true, size: "lg", onClick: onLaunch }, "▶ Lancer cet agent"))), standalone ? /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 26,
    paddingTop: 16,
    borderTop: "1px solid var(--line-soft)",
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onBack, className: "focus-ring", style: ghostLinkStyle }, "← Retour"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, isCustom && onEdit && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => onEdit(flow), className: "focus-ring", style: ghostLinkStyle }, "✎ Modifier"), isCustom && onDelete && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => onDelete(flow),
      className: "focus-ring",
      style: { ...ghostLinkStyle, color: "var(--jdm-magenta)", borderColor: "color-mix(in srgb, var(--jdm-magenta) 40%, var(--line))" }
    },
    "🗑 Supprimer"
  ), /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: onLaunch }, "▶ Lancer cet agent"))) : /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 26,
    paddingTop: 16,
    borderTop: "1px solid var(--line-soft)",
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onSommaire, className: "focus-ring", style: ghostLinkStyle }, "↖ Répertoire"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.1em" } }, "AGENT ", String(agentNum).padStart(2, "0"), " / ", String(agentCount).padStart(2, "0")), isCustom && onEdit && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => onEdit(flow), className: "focus-ring", style: ghostLinkStyle }, "✎ Modifier"), isCustom && onDelete && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => onDelete(flow),
      className: "focus-ring",
      style: { ...ghostLinkStyle, color: "var(--jdm-magenta)", borderColor: "color-mix(in srgb, var(--jdm-magenta) 40%, var(--line))" }
    },
    "🗑 Supprimer"
  )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => agentNum <= 1 ? onSommaire() : onIndex(panelPos - 1),
      className: "focus-ring",
      style: ghostLinkStyle
    },
    "‹ Précédent"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => lastFlow ? onSommaire() : onIndex(panelPos + 1),
      className: "focus-ring",
      style: ghostLinkStyle
    },
    lastFlow ? "Répertoire ›" : "Suivant ›"
  ))));
}
const ghostLinkStyle = {
  background: "transparent",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "6px 12px",
  color: "var(--ink-2)",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.05em"
};
const PARAM_LABELS = {
  term: "terme",
  relation: "relation",
  maxIter: "itér. max",
  minConf: "confiance min",
  depth: "profondeur",
  text: "texte",
  concept: "concept"
};
function formatParam(k, v) {
  if (k === "minConf") return Math.round(v * 100) + " %";
  if (k === "text") return "« " + String(v).slice(0, 28) + "… »";
  if (k === "relation") return String(v);
  return String(v);
}
function JLoopDiagram({ flow }) {
  const mc = `color-mix(in srgb, ${flow.accent} 58%, var(--ink-3) 42%)`;
  const lineCol = `color-mix(in srgb, ${flow.accent} 30%, var(--line))`;
  const steps = flow.steps;
  return /* @__PURE__ */ React.createElement("div", { style: {
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    background: "var(--bg-card)",
    overflow: "hidden"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement(LoopGlyph, { color: mc }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "La boucle, étape par étape")), /* @__PURE__ */ React.createElement("div", { style: { padding: "16px 18px 14px" } }, steps.map((s, i) => {
    const last = i === steps.length - 1;
    return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "28px 1fr", columnGap: 15 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { style: {
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: mc,
      color: "#fff",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      fontWeight: 600,
      boxShadow: `0 2px 6px -2px ${mc}`
    } }, i + 1), !last && /* @__PURE__ */ React.createElement("span", { style: { width: 2, flex: 1, minHeight: 14, background: lineCol, marginTop: 4, borderRadius: 2 } })), /* @__PURE__ */ React.createElement("div", { style: { paddingBottom: last ? 0 : 16, paddingTop: 3 } }, /* @__PURE__ */ React.createElement("div", { className: "display", style: {
      fontFamily: "var(--font-display)",
      fontSize: 16.5,
      fontWeight: 600,
      color: "var(--ink)",
      letterSpacing: "-0.01em",
      lineHeight: 1.15
    } }, s.n), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5, marginTop: 3 } }, s.d)));
  }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "28px 1fr", columnGap: 15, marginTop: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("svg", { width: "28", height: "24", viewBox: "0 0 28 24", fill: "none", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M14 4 A 8 8 0 1 1 6 12", fill: "none", stroke: mc, strokeWidth: "1.6", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M11 3 L14 4 L13 7", fill: "none", stroke: mc, strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }))), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    alignSelf: "center",
    fontSize: 11,
    color: mc,
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  } }, "recommence — jusqu'au critère d'arrêt"))));
}
function JArrow({ color }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    flex: "0 0 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    color
  } }, /* @__PURE__ */ React.createElement("svg", { width: "26", height: "14", viewBox: "0 0 26 14", fill: "none" }, /* @__PURE__ */ React.createElement("path", { d: "M1 7 H22", stroke: color, strokeWidth: "1.4", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M18 3 L23 7 L18 11", stroke: color, strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" })));
}
function JSectionNav({ activeSection, onSelect, hidden }) {
  return /* @__PURE__ */ React.createElement("nav", { "aria-label": "Sections Jarvis", style: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    transform: hidden ? "translateY(110%)" : "translateY(0)",
    opacity: hidden ? 0 : 1,
    pointerEvents: hidden ? "none" : "auto",
    transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease",
    borderTop: "1px solid var(--line-soft)",
    background: "color-mix(in srgb, var(--bg) 92%, transparent)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    overflowX: "auto",
    whiteSpace: "nowrap",
    scrollbarWidth: "none"
  }, className: "jpanel-scroll" }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    flexShrink: 0,
    fontSize: 9.5,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginRight: 4
  } }, "Sections"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 8 }, "aria-hidden": "true" }), J_SECTIONS.map((p, i) => {
    const active = activeSection === p.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.id,
        type: "button",
        onClick: () => onSelect(p.id),
        "aria-label": `Aller à ${p.label}`,
        "aria-current": active ? "page" : void 0,
        className: "focus-ring",
        style: {
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 11px",
          background: active ? "color-mix(in srgb, var(--accent) 12%, var(--bg-card))" : "var(--bg-card)",
          border: "1px solid " + (active ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "var(--line-soft)"),
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: active ? "var(--accent)" : "var(--ink-2)",
          transition: "background .15s, border-color .15s, color .15s"
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent)",
        opacity: active ? 1 : 0.45
      } }),
      /* @__PURE__ */ React.createElement("span", { style: {
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontSize: 11,
        opacity: active ? 0.9 : 0.55,
        fontWeight: 500,
        letterSpacing: 0
      } }, String(i + 1).padStart(2, "0")),
      /* @__PURE__ */ React.createElement("span", { style: { color: "inherit" } }, p.label),
      active && /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
        fontSize: 8.5,
        padding: "1px 5px",
        borderRadius: 3,
        background: "var(--accent)",
        color: "var(--bg)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600
      } }, "actuel")
    );
  }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 8 }, "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "focus-ring",
      onClick: () => {
        try {
          window.dispatchEvent(new CustomEvent("jdm-toggle-jarvis-chat"));
        } catch (e) {
        }
      },
      "aria-label": "Discuter avec Jarvis",
      title: "Discuter avec Jarvis",
      style: {
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 13px",
        marginLeft: 4,
        background: "color-mix(in srgb, var(--accent) 12%, var(--bg-card))",
        border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--accent)",
        transition: "background .15s, border-color .15s, transform .12s"
      },
      onMouseDown: (e) => {
        e.currentTarget.style.transform = "translateY(1px)";
      },
      onMouseUp: (e) => {
        e.currentTarget.style.transform = "none";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "none";
      }
    },
    /* @__PURE__ */ React.createElement(
      "svg",
      {
        width: "14",
        height: "14",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 }
      },
      /* @__PURE__ */ React.createElement("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })
    ),
    "Discuter avec Jarvis"
  )));
}
function JAgentNav({ navStyle, activePanel, onSelect }) {
  const [wide, setWide] = useState(typeof window !== "undefined" ? window.innerWidth >= 1100 : true);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (navStyle === "left" && wide) return /* @__PURE__ */ React.createElement(JNavRail, { activePanel, onSelect });
  return /* @__PURE__ */ React.createElement(JNavBottom, { activePanel, onSelect });
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
  return /* @__PURE__ */ React.createElement("nav", { ref: containerRef, "aria-label": "Navigation entre agents", style: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: 6,
    maxWidth: "calc(100vw - 32px)",
    overflowX: "auto",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 40,
    scrollbarWidth: "none"
  } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
    position: "absolute",
    left: indicator.x,
    width: indicator.w,
    top: 6,
    bottom: 6,
    background: "var(--accent)",
    borderRadius: 999,
    opacity: indicator.ready ? 1 : 0,
    transition: "left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s",
    zIndex: 0
  } }), J_PANELS.map((p, i) => {
    const active = activePanel === p.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.id,
        ref: (el) => {
          if (el) itemRefs.current[p.id] = el;
        },
        type: "button",
        onClick: () => onSelect(p.id),
        "aria-label": `Aller à ${p.label}`,
        style: {
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 13px",
          background: "transparent",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          color: active ? "var(--bg)" : "var(--ink-3)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: active ? 600 : 400,
          whiteSpace: "nowrap",
          transition: "color 0.32s 0.05s"
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: {
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontSize: 12,
        opacity: active ? 0.85 : 0.55,
        fontWeight: 500,
        letterSpacing: 0,
        textTransform: "none"
      } }, String(i).padStart(2, "0")),
      /* @__PURE__ */ React.createElement("span", null, p.label)
    );
  }));
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
  return /* @__PURE__ */ React.createElement("nav", { ref: containerRef, "aria-label": "Navigation entre agents", style: {
    position: "fixed",
    left: 32,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    zIndex: 40,
    borderLeft: "1px solid var(--line)",
    paddingLeft: 16
  } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
    position: "absolute",
    left: -1,
    top: indicator.y,
    height: indicator.h,
    width: 2,
    background: "var(--accent)",
    opacity: indicator.ready ? 1 : 0,
    transition: "top 0.42s cubic-bezier(0.4,0,0.2,1), height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s"
  } }), J_PANELS.map((p, i) => /* @__PURE__ */ React.createElement(
    JRailItem,
    {
      key: p.id,
      ref: (el) => {
        if (el) itemRefs.current[p.id] = el;
      },
      num: String(i).padStart(2, "0"),
      label: p.label,
      active: activePanel === p.id,
      onClick: () => onSelect(p.id)
    }
  )));
}
const JRailItem = React.forwardRef(function JRailItem2({ num, label, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? "var(--accent)" : hover ? "var(--ink)" : "var(--ink-3)";
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ref,
      type: "button",
      onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      "aria-label": `Aller à ${label}`,
      style: {
        background: "transparent",
        border: "none",
        padding: "13px 0",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        position: "relative",
        color,
        transition: "color 0.32s",
        fontFamily: "inherit"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      fontFamily: "var(--font-display)",
      fontStyle: "italic",
      fontSize: 20,
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: "-0.01em",
      color: "inherit"
    } }, num),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "inherit",
      fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap"
    } }, label)
  );
});
function LoopGlyph({ color }) {
  return /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 12 12", style: { flexShrink: 0 } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M 10 4 A 4 4 0 1 0 9.5 8.5",
      fill: "none",
      stroke: color,
      strokeWidth: "1.4",
      strokeLinecap: "round"
    }
  ), /* @__PURE__ */ React.createElement("path", { d: "M 10 4 L 8 4 L 10 2", fill: "none", stroke: color, strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }));
}
function JarvisRun({ flow, slot, nextFlow, onBack, onNext }) {
  var _a;
  const runKey = slot || flow.id;
  const _pending = typeof window !== "undefined" && ((_a = window.__jdmPendingPayload) == null ? void 0 : _a.jarvis) || null;
  if (typeof window !== "undefined" && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.jarvis;
  }
  const [params, setParams] = useState(() => {
    const base = defaultParamsFor(flow.id);
    if ((_pending == null ? void 0 : _pending.term) && typeof base === "object") {
      return { ...base, term: _pending.term };
    }
    return base;
  });
  const run = useJarvisRunState(runKey);
  const state = run.status;
  const log = run.log;
  const metrics = run.metrics;
  const accepted = run.accepted;
  const narrationHTML = run.narrationHTML;
  const filePreview = run.filePreview;
  const filePath = run.filePath;
  const headline = run.headline;
  const resumeState = run.resumeState;
  const setResumeState = (v) => JarvisStore.patch(runKey, { resumeState: v });
  const [poolStatus, setPoolStatus] = useState(null);
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  const [submitState, setSubmitState] = useState("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const [leftView, setLeftView] = useState("log");
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("api/pool/status");
        if (r.ok && alive) setPoolStatus(await r.json());
      } catch {
      }
    };
    load();
    const id = setInterval(load, 3e4);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);
  const parsed = React.useMemo(
    () => parseFilePreview(filePreview, flow.id, flow._format),
    [filePreview, flow.id, flow._format]
  );
  React.useEffect(() => {
    if (flow.consolidates) {
      JarvisStore.patch(runKey, { metrics: { ...metrics, produced: metrics.accepted } });
    } else {
      const n = parsed.items.filter((i) => i.type !== "meta" && i.type !== "sens").length;
      JarvisStore.patch(runKey, { metrics: { ...metrics, produced: n } });
    }
  }, [parsed.items.length, metrics.accepted, runKey]);
  const launch = (continueFromResume) => {
    JarvisStore.start(runKey, {
      params,
      isResume: !!continueFromResume,
      resumeState: continueFromResume ? resumeState : null
    });
    if (continueFromResume) setResumeState(null);
  };
  const stop = () => JarvisStore.stop(runKey);
  const reset = () => JarvisStore.reset(runKey);
  const _scrollSmoothTo = React.useCallback((targetY) => {
    const startY = window.scrollY || window.pageYOffset || 0;
    const dist = targetY - startY;
    if (Math.abs(dist) < 4) return;
    const dur = 520;
    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  React.useEffect(() => {
    const tid = setTimeout(() => _scrollSmoothTo(0), 50);
    return () => clearTimeout(tid);
  }, [runKey]);
  const _prevStateRef = useRef(state);
  React.useEffect(() => {
    if (_prevStateRef.current === "idle" && state === "running") {
      setTimeout(_scrollSmoothToBottom, 200);
    }
    _prevStateRef.current = state;
  }, [state, _scrollSmoothToBottom]);
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: onBack }, "← Tous les agents"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, "/"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: flow.accent, textTransform: "uppercase", letterSpacing: "0.1em" } }, flow.kicker), onNext && nextFlow && /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "ghost",
      size: "sm",
      onClick: onNext,
      style: { marginLeft: "auto" }
    },
    nextFlow.title,
    " →"
  )), /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: flow.kicker,
      title: flow.title,
      desc: flow.desc,
      right: /* @__PURE__ */ React.createElement(StatusBadge, { state, accent: flow.accent })
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 20,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 80 } }, /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12
  } }, "Paramètres"), /* @__PURE__ */ React.createElement(ParamsForm, { flow, params, setParams, locked: state === "running" })), /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12
  } }, "Contrôles"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, (state === "idle" || state === "done" || state === "error") && /* @__PURE__ */ React.createElement(Button, { full: true, onClick: () => launch(false) }, state === "idle" ? "▶ Lancer" : "↻ Relancer"), state === "running" && /* @__PURE__ */ React.createElement(Button, { variant: "secondary", full: true, onClick: stop }, "⏹ Stop")), resumeState && state !== "running" && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(Button, { full: true, onClick: () => launch(true) }, "▶ Continuer avec 3.1"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 6, fontSize: 11, color: "var(--ink-3)" } }, "L'agent a saturé son quota — reprends sur Gemini 3.1 Flash Lite (pool partagé, 500 req/jour) en gardant l'historique.")), /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    fontSize: 12,
    color: "var(--ink-2)",
    cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: !!params.auto_switch,
      onChange: (e) => setParams((p) => ({ ...p, auto_switch: e.target.checked })),
      style: { accentColor: "var(--accent)" },
      disabled: state === "running"
    }
  ), "Auto-bascule sur 3.1 si quota épuisé"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.45 } }, "Décoché (défaut) : abort propre + bouton « Continuer » apparaît. Coché : retry silencieux sans intervention."), state === "running" && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 10,
    padding: "6px 10px",
    background: "var(--bg-elev)",
    borderRadius: "var(--radius)",
    fontSize: 11,
    color: "var(--ink-3)",
    fontFamily: "var(--font-mono)"
  } }, "Streaming SSE · arrêt manuel possible")), /* @__PURE__ */ React.createElement(Card, { padding: 16 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "Note"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 } }, "Modèle, budget et clés sont configurés dans la barre horizontale en bas de l'écran (sous la vue temps réel)."))), /* @__PURE__ */ React.createElement("div", null, headline && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 14px",
    marginBottom: 12,
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    fontSize: 13,
    color: "var(--ink-2)"
  } }, headline), /* @__PURE__ */ React.createElement(Card, { padding: 14, style: { marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: (params.model || "").match(/^(claude|gpt)-/) ? "minmax(180px, 1.4fr) minmax(140px, 1fr) minmax(180px, 1.2fr) minmax(180px, 1.2fr)" : "minmax(220px, 1.6fr) minmax(160px, 1fr) minmax(200px, 1.2fr)",
    gap: 12,
    alignItems: "end"
  } }, /* @__PURE__ */ React.createElement(Field, { label: "Modèle" }, /* @__PURE__ */ React.createElement(
    Select,
    {
      value: params.model || "gemini-3.1-flash-lite",
      onChange: (v) => setParams((p) => ({ ...p, model: v })),
      options: [
        { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
        { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
        { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (BYOK)" },
        { value: "gpt-4o-mini", label: "GPT-4o mini (BYOK)" }
      ].map((m) => {
        if (poolStatus && m.value.startsWith("gemini-")) {
          const allBlown = (poolStatus.keys || []).every(
            (k) => k.invalid || k.blown_by_model && k.blown_by_model[m.value]
          );
          if (allBlown && poolStatus.keys && poolStatus.keys.length > 0) {
            return {
              ...m,
              label: `❌ ${m.label} — épuisé`,
              sub: "pool entièrement consommé aujourd'hui"
            };
          }
        }
        return m;
      })
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: "Budget outils" }, /* @__PURE__ */ React.createElement(
    Select,
    {
      value: params.budget_label || "illimité",
      onChange: (v) => setParams((p) => ({ ...p, budget_label: v })),
      options: BUDGET_OPTS
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: _envHasDrops ? "Clé LLMDrops (override .env)" : "Clé LLMDrops" }, /* @__PURE__ */ React.createElement(
    Input,
    {
      type: "password",
      value: params.drops_key || "",
      onChange: (v) => setParams((p) => ({ ...p, drops_key: v })),
      placeholder: _envHasDrops ? "— configurée côté serveur —" : "vide = pas de clé",
      mono: true
    }
  )), (params.model || "").match(/^(claude|gpt)-/) && (() => {
    const envKey = (params.model || "").startsWith("claude-") ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    const envHas = !!(_envStatus[envKey] && _envStatus[envKey].set);
    return /* @__PURE__ */ React.createElement(Field, { label: envHas ? "Clé API LLM (override .env)" : "Clé API LLM" }, /* @__PURE__ */ React.createElement(
      Input,
      {
        type: "password",
        value: params.api_key || "",
        onChange: (v) => setParams((p) => ({ ...p, api_key: v })),
        placeholder: envHas ? "— configurée côté serveur —" : (params.model || "").startsWith("claude-") ? "sk-ant-…" : "sk-…",
        mono: true
      }
    ));
  })()), /* @__PURE__ */ React.createElement(
    "label",
    {
      title: "Active la trace de raisonnement (« thinking » Anthropic / Google) — coûte plus de tokens mais peut améliorer les choix d'outils.",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "var(--ink-2)",
        cursor: "pointer",
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--line-soft)"
      }
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !!params.use_thinking,
        onChange: (e) => setParams((p) => ({ ...p, use_thinking: e.target.checked })),
        style: { accentColor: "var(--accent)" }
      }
    ),
    "Raisonnement (chain-of-thought)"
  )), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "var(--line)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    marginBottom: 14
  } }, /* @__PURE__ */ React.createElement(Metric, { label: "Outils", value: metrics.toolsCalled, sub: "appels", accent: flow.accent }), /* @__PURE__ */ React.createElement(Metric, { label: "Tokens", value: fmtTokens(metrics.tokens), sub: "estimés", mono: true }), /* @__PURE__ */ React.createElement(
    Metric,
    {
      label: metricLabelFor(flow.id).label,
      value: metrics.produced,
      sub: metricLabelFor(flow.id).sub,
      color: "var(--jdm-green)"
    }
  ), /* @__PURE__ */ React.createElement(Metric, { label: "Temps", value: fmtElapsed(metrics.elapsed), sub: "écoulé", mono: true })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 } }, /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    gap: 8
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, leftView === "log" ? "Log temps réel" : "Narration LLM"), /* @__PURE__ */ React.createElement("div", { style: { display: "inline-flex", alignItems: "center", gap: 8 } }, state === "running" && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: flow.accent } }), /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: 2
  } }, [
    { id: "narration", label: "Narration" },
    { id: "log", label: "Log" }
  ].map((t) => {
    const active = leftView === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        type: "button",
        onClick: () => setLeftView(t.id),
        className: "focus-ring",
        style: {
          padding: "3px 10px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: active ? flow.accent : "transparent",
          color: active ? "var(--bg)" : "var(--ink-3)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: active ? 600 : 500,
          transition: "background .18s, color .18s"
        }
      },
      t.label
    );
  })))), /* @__PURE__ */ React.createElement("div", { ref: logRef, className: "jdm-narration-pane", style: {
    height: 420,
    overflowY: "auto",
    padding: leftView === "log" ? 12 : 14,
    background: "var(--bg-card)",
    fontFamily: leftView === "log" ? "var(--font-mono)" : "inherit",
    fontSize: leftView === "log" ? 11 : 13,
    lineHeight: 1.55,
    color: "var(--ink)"
  } }, !narrationHTML && log.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", textAlign: "center", padding: "40px 0" } }, state === "idle" ? "En attente du lancement…" : "—"), leftView === "log" ? (
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
      const fts = _toolSteps(flow);
      const _norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase();
      const validatedSet = /* @__PURE__ */ new Set();
      if (Array.isArray(accepted)) {
        for (const a of accepted) {
          const t = _norm(a.subject || a.term);
          const r = _norm(a.relation);
          const tg = _norm(a.target);
          if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
        }
      }
      if (parsed && Array.isArray(parsed.items)) {
        for (const it of parsed.items) {
          if (it.type === "consolidated" || it.type === "audit_signalement") {
            const t = _norm(it.subject);
            const r = _norm(it.relation);
            const tg = _norm(it.target);
            if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
          }
        }
      }
      const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
      const items = [];
      if (narrationHTML) {
        let mm;
        while ((mm = re.exec(narrationHTML)) !== null) {
          items.push({
            tool: mm[1],
            triplet: mm[3] || "",
            isResult: !!mm[4]
          });
        }
      }
      const tentatives = [];
      let cur = null, prevStep = -1;
      for (const it of items) {
        if (it.isResult) {
          if (cur) cur.push(it);
          continue;
        }
        const s = fts[it.tool];
        if (s === void 0) {
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
      return /* @__PURE__ */ React.createElement(React.Fragment, null, tentatives.map((tent, ti) => /* @__PURE__ */ React.createElement("div", { key: "t" + ti, style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        marginBottom: 6,
        borderBottom: `1px dashed color-mix(in srgb, ${flow.accent} 35%, transparent)`,
        color: flow.accent,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 10
      } }, /* @__PURE__ */ React.createElement("span", { style: {
        background: flow.accent,
        color: "var(--bg)",
        padding: "1px 7px",
        borderRadius: 3,
        fontSize: 9.5
      } }, "Tentative ", ti + 1), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 } }, tent.filter((x) => !x.isResult).length, " appel(s), ", tent.filter((x) => x.isResult).length, " retour(s)")), tent.filter((x) => !x.isResult && x.triplet).map((it, k) => {
        const parts = it.triplet.split("|");
        const [term, rel, target] = parts;
        const _key = term && rel && target ? `${term.trim().toLowerCase()}|${rel.trim().toLowerCase()}|${target.trim().toLowerCase()}` : null;
        const isValidated = _key && validatedSet.has(_key);
        return /* @__PURE__ */ React.createElement("div", { key: k, style: {
          display: "flex",
          gap: 8,
          marginBottom: 3,
          alignItems: "baseline",
          paddingLeft: 8,
          paddingRight: 8,
          // Teinte verte douce + liseré gauche quand valide.
          // L'absence de fond et de bordure pour les non valides
          // garde le visuel sobre par défaut.
          background: isValidated ? "color-mix(in srgb, var(--jdm-green) 9%, transparent)" : "transparent",
          borderLeft: isValidated ? "2px solid var(--jdm-green)" : "2px solid transparent",
          borderRadius: "0 3px 3px 0",
          paddingTop: 2,
          paddingBottom: 2,
          transition: "background .25s, border-color .25s"
        }, title: isValidated ? "Triplet validé : passé en consolidation" : "Triplet tenté" }, /* @__PURE__ */ React.createElement("span", { style: {
          flexShrink: 0,
          fontSize: 10,
          color: isValidated ? "var(--jdm-green)" : "var(--accent)",
          fontWeight: isValidated ? 700 : 400
        } }, isValidated ? "✓" : "→"), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0, color: "var(--ink)", wordBreak: "break-word" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, term), rel && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " | "), /* @__PURE__ */ React.createElement("span", { style: { color: flow.accent } }, rel)), target && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " | "), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, target))), isValidated && /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
          flexShrink: 0,
          fontSize: 8.5,
          fontWeight: 600,
          padding: "1px 5px",
          borderRadius: 3,
          background: "var(--jdm-green)",
          color: "var(--bg)",
          textTransform: "uppercase",
          letterSpacing: "0.06em"
        } }, "validé"), /* @__PURE__ */ React.createElement("span", { style: { flexShrink: 0, color: "var(--ink-3)", fontSize: 9.5 } }, it.tool));
      }), tent.filter((x) => !x.isResult && x.triplet).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { paddingLeft: 8, fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" } }, "aucun triplet tente dans cette tentative (", tent.filter((x) => !x.isResult).length, " appel(s) sans args triplet)"))), (log || []).length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
        marginTop: 14,
        paddingTop: 10,
        borderTop: "1px solid var(--line-soft)"
      } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 } }, "Events systeme"), log.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 2, alignItems: "baseline" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", flexShrink: 0 } }, l.t), /* @__PURE__ */ React.createElement("span", { style: {
        flexShrink: 0,
        color: l.kind === "tool" ? "var(--accent)" : l.kind === "accept" ? "var(--jdm-green)" : l.kind === "reject" ? "var(--jdm-magenta)" : l.kind === "iter" ? flow.accent : "var(--ink-3)",
        minWidth: 56
      } }, l.tag), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", wordBreak: "break-word" } }, l.msg)))));
    })()
  ) : narrationHTML ? (
    // Vue Narration : markdown + HTML <jdm-narration> inline
    // rendus par marked.js (la trace d'outils reste structurée,
    // les **gras** / `code` / listes se rendent correctement).
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "jdm-prose",
        dangerouslySetInnerHTML: { __html: renderMarkdownJarvis(narrationHTML) }
      }
    )
  ) : (
    // Fallback : entrées tag/temps des events headline/file/etc.
    log.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 4, alignItems: "baseline", fontFamily: "var(--font-mono)", fontSize: 11 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", flexShrink: 0 } }, l.t), /* @__PURE__ */ React.createElement("span", { style: {
      flexShrink: 0,
      minWidth: 64,
      color: l.kind === "accept" ? "var(--jdm-green)" : l.kind === "reject" ? "var(--jdm-magenta)" : l.kind === "iter" ? flow.accent : "var(--ink-3)"
    } }, l.tag), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)", wordBreak: "break-word" } }, l.msg)))
  ))), /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  } }, panelTitleFor(flow.id), " · ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--jdm-green)" } }, metrics.produced), filePath && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)", marginLeft: 8, textTransform: "none", letterSpacing: 0 } }, "· ", filePath.split(/[\\/]/).slice(-1)[0])), filePath && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } }, SUBMITTABLE_FLOWS.has(flow.id) && /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      disabled: !_canSubmit || submitState === "sending",
      style: state === "running" && _canSubmit ? { opacity: 0.55 } : void 0,
      title: !_canSubmit ? "Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer la soumission" : state === "running" ? "Soumission anticipée — le flow tourne encore (clic pour confirmer)" : params.drops_key ? "Soumettre ce fichier au LLMDrops JDM (clé saisie)" : "Soumettre ce fichier au LLMDrops JDM (clé serveur)",
      onClick: async () => {
        if (state === "running") {
          const ok = window.confirm(
            "Le flow n'est pas encore terminé — le fichier ." + (flow.id === "enrich" ? "enrich" : flow.id === "audit" ? "audit" : flow.id === "signalement" ? "err" : flow.id === "stats" ? "stat" : flow.id === "annotation" ? "annot" : "txt") + " contient seulement les triplets produits jusqu'à maintenant. \n\nSoumettre maintenant quand même ?"
          );
          if (!ok) return;
        }
        const name = filePath.split(/[\\/]/).slice(-1)[0];
        setSubmitState("sending");
        setSubmitMsg("");
        try {
          const r = await fetch("api/productions/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              names: [name],
              archived: false,
              api_key: params.drops_key || "",
              model_name: params.model || ""
            })
          });
          const data = await r.json();
          const res = (data.results || [])[0] || {};
          if (res.ok) {
            setSubmitState("done");
            setSubmitMsg(`✓ uploadé sous ${res.uploaded_as || name} (HTTP ${res.status_code || "?"})`);
            try {
              JarvisStore.patch(runKey, { submitted: true });
            } catch {
            }
          } else {
            setSubmitState("error");
            setSubmitMsg(`✗ ${res.error || "échec inconnu"}`);
          }
        } catch (e) {
          setSubmitState("error");
          setSubmitMsg(`✗ ${e.message || e}`);
        }
        setTimeout(() => {
          setSubmitState("idle");
          setSubmitMsg("");
        }, 8e3);
      }
    },
    submitState === "sending" ? "⏳ Envoi…" : "📤 Soumettre"
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      onClick: () => {
        const name = filePath.split(/[\\/]/).slice(-1)[0];
        const url = `api/productions/download?name=${encodeURIComponent(name)}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    "⬇ Télécharger"
  ))), submitMsg && /* @__PURE__ */ React.createElement("div", { className: "fade-up", style: {
    padding: "6px 14px",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: submitState === "error" ? "var(--jdm-magenta)" : "var(--jdm-green)",
    borderBottom: "1px solid var(--line-soft)",
    background: "var(--bg-elev)"
  } }, submitMsg), /* @__PURE__ */ React.createElement("div", { style: {
    height: 420,
    overflowY: "auto",
    padding: 0,
    background: "var(--bg-card)"
  } }, (() => {
    const toShow = flow.consolidates && accepted.length ? accepted : parsed.items;
    if (toShow.length === 0) {
      return /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12, textAlign: "center", padding: "60px 0" } }, state === "idle" ? "Le panneau se remplira au fur et à mesure que le fichier est écrit." : "En attente des premiers résultats…");
    }
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, padding: 12 } }, toShow.map((it, i) => /* @__PURE__ */ React.createElement(ItemCard, { key: i, item: it, accent: flow.accent })));
  })()))))), /* @__PURE__ */ React.createElement(
    JarvisRunRail,
    {
      flow,
      onPick: (id) => {
        if (id === flow.id) return;
        if (typeof window !== "undefined" && window.__jdmRoute) {
          window.__jdmRoute.push("jarvis", id);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("jdm-jarvis-switch-run", { detail: { agent_id: id } }));
        }
      }
    }
  ));
}
function JarvisRunRail({ flow, onPick }) {
  const activeSet = useJarvisActiveSet();
  const ordered = JARVIS_AGENTS.slice(0, 10).slice().sort((a, b) => {
    const aRun = activeSet.has(a.id) ? 0 : 1;
    const bRun = activeSet.has(b.id) ? 0 : 1;
    if (aRun !== bRun) return aRun - bRun;
    return JARVIS_AGENTS.findIndex((f) => f.id === a.id) - JARVIS_AGENTS.findIndex((f) => f.id === b.id);
  });
  return /* @__PURE__ */ React.createElement("div", { style: {
    position: "sticky",
    bottom: 0,
    zIndex: 5,
    marginTop: 18,
    borderTop: "1px solid var(--line-soft)",
    background: "color-mix(in srgb, var(--bg) 92%, transparent)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    overflowX: "auto",
    whiteSpace: "nowrap",
    scrollbarWidth: "none"
  }, className: "jpanel-scroll" }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    flexShrink: 0,
    fontSize: 9.5,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginRight: 4
  } }, "Agents"), ordered.map((f) => {
    const isCurrent = f.id === flow.id;
    const isActive = activeSet.has(f.id);
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: f.id,
        type: "button",
        onClick: () => onPick(f.id),
        title: `${f.title}${isActive ? " · en cours" : ""}`,
        className: "focus-ring",
        style: {
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 11px",
          background: isCurrent ? `color-mix(in srgb, ${f.accent} 12%, var(--bg-card))` : "var(--bg-card)",
          border: "1px solid " + (isCurrent ? `color-mix(in srgb, ${f.accent} 55%, transparent)` : "var(--line-soft)"),
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: isCurrent ? f.accent : "var(--ink-2)",
          transition: "background .15s, border-color .15s, color .15s"
        }
      },
      isActive && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: f.accent, width: 6, height: 6 } }),
      /* @__PURE__ */ React.createElement("span", { style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: f.accent,
        opacity: isActive ? 0 : 0.55,
        display: isActive ? "none" : "inline-block"
      } }),
      /* @__PURE__ */ React.createElement("span", { style: { color: "inherit" } }, f.title),
      isCurrent && /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
        fontSize: 8.5,
        padding: "1px 5px",
        borderRadius: 3,
        background: f.accent,
        color: "var(--bg)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600
      } }, "actuel")
    );
  })));
}
function StatusBadge({ state, accent }) {
  const STYLES = {
    idle: { label: "En attente", color: "var(--ink-3)", dot: false },
    running: { label: "En cours", color: accent, dot: true },
    submitted: { label: "Soumis", color: "var(--jdm-green)", dot: false },
    done: { label: "Terminé", color: "var(--jdm-green)", dot: false },
    paused: { label: "En pause", color: "var(--jdm-orange)", dot: false },
    error: { label: "Erreur", color: "var(--jdm-magenta)", dot: false },
    cancelled: { label: "Annulé", color: "var(--ink-3)", dot: false },
    aborted: { label: "Interrompu", color: "var(--ink-3)", dot: false }
  };
  const styles = STYLES[state] || STYLES.idle;
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px",
    border: `1px solid ${styles.color}`,
    borderRadius: 999,
    color: styles.color,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 600
  } }, styles.dot && /* @__PURE__ */ React.createElement("span", { className: "pulse-dot", style: { background: styles.color } }), styles.label);
}
function Metric({ label, value, sub, max, accent, color, mono }) {
  const pct = max ? Math.min(100, Number(value) / max * 100) : null;
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--bg-card)", padding: "12px 14px", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, label), /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
    fontSize: mono ? 20 : 24,
    fontWeight: 600,
    marginTop: 4,
    color: color || "var(--ink)",
    letterSpacing: "-0.01em"
  } }, value), sub && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 2 } }, sub), pct != null && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    background: "var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { width: `${pct}%`, height: "100%", background: accent || "var(--accent)", transition: "width 0.3s" } })));
}
window.ViewJarvis = ViewJarvis;
function ViewProductions() {
  const [recent, setRecent] = useState([]);
  const [oldies, setOldies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecent, setSelectedRecent] = useState(/* @__PURE__ */ new Set());
  const [selectedOldies, setSelectedOldies] = useState(/* @__PURE__ */ new Set());
  const [busy, setBusy] = useState(false);
  const [previewName, setPreviewName] = useState(null);
  const [previewArchived, setPreviewArchived] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [actionLog, setActionLog] = useState([]);
  const [dropsKey, setDropsKey] = useState("");
  const [modelName, setModelName] = useState(() => {
    try {
      const cfg = typeof window !== "undefined" && window.__JDM_JARVIS_CONFIG__ || {};
      return cfg.llm || "gemini-3.1-flash-lite";
    } catch (e) {
      return "gemini-3.1-flash-lite";
    }
  });
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!dropsKey || _envHasDrops;
  const isAdmin = typeof window !== "undefined" && window.__JDM_ADMIN__;
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("api/productions");
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
  React.useEffect(() => {
    load();
  }, []);
  const openPreview = async (name, archived) => {
    setPreviewName(name);
    setPreviewArchived(archived);
    setPreviewContent("… chargement …");
    try {
      const r = await fetch(`api/productions/file?name=${encodeURIComponent(name)}&archived=${archived ? 1 : 0}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPreviewContent(d.content || "(vide)");
    } catch (e) {
      setPreviewContent(`Erreur : ${e && e.message ? e.message : e}`);
    }
  };
  const downloadOne = (name, archived) => {
    const url = `api/productions/download?name=${encodeURIComponent(name)}&archived=${archived ? 1 : 0}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const toggle = (set, setSet) => (name) => {
    const next = new Set(set);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSet(next);
  };
  const submitSelected = async (archived) => {
    const selected = archived ? selectedOldies : selectedRecent;
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const r = await fetch("api/productions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: Array.from(selected),
          archived,
          api_key: dropsKey,
          model_name: modelName
        })
      });
      const d = await r.json();
      const results = d.results || [];
      const ok = results.filter((x) => x.ok).length;
      const ko = results.length - ok;
      setActionLog((prev) => [
        ...prev,
        ...results.map((x) => ({
          t: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
          ok: !!x.ok,
          name: x.name,
          msg: x.ok ? `Soumis · uploaded_as=${x.uploaded_as || ""}` : x.error || "échec"
        }))
      ]);
      if (ok) {
        const remaining = /* @__PURE__ */ new Set();
        results.forEach((x) => {
          if (!x.ok) remaining.add(x.name);
        });
        if (archived) setSelectedOldies(remaining);
        else setSelectedRecent(remaining);
        await load();
      }
    } catch (e) {
      setActionLog((prev) => [...prev, {
        t: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
        ok: false,
        name: "?",
        msg: String(e)
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
      const r = await fetch("api/productions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: Array.from(selected),
          archived
        })
      });
      const d = await r.json();
      setActionLog((prev) => [
        ...prev,
        ...(d.results || []).map((x) => ({
          t: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
          ok: !!x.ok,
          name: x.name,
          msg: x.ok ? "Supprimé" : x.error || "échec"
        }))
      ]);
      if (archived) setSelectedOldies(/* @__PURE__ */ new Set());
      else setSelectedRecent(/* @__PURE__ */ new Set());
      await load();
    } catch (e) {
      setActionLog((prev) => [...prev, {
        t: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
        ok: false,
        name: "?",
        msg: String(e)
      }]);
    } finally {
      setBusy(false);
    }
  };
  const _submittedCount = recent.filter((f) => f.submitted).length + oldies.filter((f) => f.submitted).length;
  const _totalCount = recent.length + oldies.length;
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      kicker: "Sorties Jarvis",
      title: "Productions",
      desc: "Fichiers .enrich / .audit / .err / .stat / visualisations produits par les agents Jarvis. Liste, prévisualisation, téléchargement, soumission LLMDrops.",
      right: /* @__PURE__ */ React.createElement("div", { style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: _submittedCount > 0 ? "rgba(78,166,60,0.10)" : "var(--bg-elev)",
        border: "1px solid " + (_submittedCount > 0 ? "rgba(78,166,60,0.40)" : "var(--line-soft)"),
        borderRadius: "var(--radius)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: _submittedCount > 0 ? "var(--jdm-green)" : "var(--ink-2)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap"
      } }, _submittedCount > 0 && /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "✅"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", { style: { fontWeight: 600 } }, _submittedCount), " / ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, _totalCount), " ", "production", _totalCount > 1 ? "s" : "", " soumise", _submittedCount > 1 ? "s" : ""))
    }
  ), /* @__PURE__ */ React.createElement(Card, { padding: 16, style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end" } }, /* @__PURE__ */ React.createElement(Field, { label: _envHasDrops ? "Clé LLMDrops (override .env)" : "Clé LLMDrops" }, /* @__PURE__ */ React.createElement(
    Input,
    {
      type: "password",
      value: dropsKey,
      onChange: setDropsKey,
      placeholder: _envHasDrops ? "— configurée côté serveur —" : "vide = pas de clé",
      mono: true
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: "Nom modèle (filename uploadé)" }, /* @__PURE__ */ React.createElement(Input, { value: modelName, onChange: setModelName, placeholder: "claude-sonnet", mono: true })), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: load, disabled: loading || busy }, "↻ Rafraîchir"))), error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: 12,
    marginBottom: 16,
    background: "rgba(200,58,115,0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 13
  } }, "⚠️ ", error), /* @__PURE__ */ React.createElement(
    ProductionsSection,
    {
      title: `Récents · ${recent.length}`,
      files: recent,
      archived: false,
      selected: selectedRecent,
      setSelected: setSelectedRecent,
      onToggle: toggle(selectedRecent, setSelectedRecent),
      onPreview: openPreview,
      onDownload: downloadOne,
      onSubmit: () => submitSelected(false),
      onDelete: () => deleteSelected(false),
      canSubmit: _canSubmit,
      busy,
      isAdmin
    }
  ), oldies.length > 0 && /* @__PURE__ */ React.createElement("details", { style: { marginTop: 28 } }, /* @__PURE__ */ React.createElement("summary", { style: {
    cursor: "pointer",
    padding: "12px 14px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--ink-2)",
    listStyle: "none"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 11,
    color: "var(--ink-3)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "▸ Archives oldies"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 400, color: "var(--ink-3)" } }, "· ", oldies.length, " fichier", oldies.length > 1 ? "s" : "", " de plus de 48h")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement(
    ProductionsSection,
    {
      title: "",
      files: oldies,
      archived: true,
      selected: selectedOldies,
      setSelected: setSelectedOldies,
      onToggle: toggle(selectedOldies, setSelectedOldies),
      canSubmit: _canSubmit,
      onPreview: openPreview,
      onDownload: downloadOne,
      onSubmit: () => submitSelected(true),
      onDelete: () => deleteSelected(true),
      busy,
      isAdmin
    }
  ))), actionLog.length > 0 && /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { marginTop: 28, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em"
  } }, "Log d'actions · ", actionLog.length)), /* @__PURE__ */ React.createElement("div", { style: { maxHeight: 200, overflowY: "auto", padding: 12, fontFamily: "var(--font-mono)", fontSize: 11 } }, actionLog.slice().reverse().map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 2, alignItems: "baseline" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, l.t), /* @__PURE__ */ React.createElement("span", { style: { color: l.ok ? "var(--jdm-green)" : "var(--jdm-magenta)", minWidth: 12 } }, l.ok ? "✓" : "✗"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink)" } }, l.name), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", marginLeft: 6 } }, "—"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, l.msg))))), previewName && /* @__PURE__ */ React.createElement("div", { onClick: () => setPreviewName(null), style: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    maxWidth: 920,
    width: "100%",
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 13, color: "var(--ink)" } }, previewArchived ? "oldies/" : "", previewName), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", onClick: () => downloadOne(previewName, previewArchived) }, "Télécharger"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: () => setPreviewName(null) }, "×"))), previewName && previewName.toLowerCase().endsWith(".html") ? /* @__PURE__ */ React.createElement(
    "iframe",
    {
      title: previewName,
      srcDoc: previewContent,
      sandbox: "allow-scripts allow-same-origin",
      style: {
        flex: 1,
        width: "100%",
        border: 0,
        minHeight: 500,
        background: "var(--bg)"
      }
    }
  ) : /* @__PURE__ */ React.createElement("pre", { style: {
    margin: 0,
    padding: 18,
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    lineHeight: 1.6,
    color: "var(--ink)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    flex: 1
  } }, previewContent))));
}
function ProductionsSection({
  title,
  files,
  archived,
  selected,
  setSelected,
  onToggle,
  onPreview,
  onDownload,
  onSubmit,
  onDelete,
  canSubmit = true,
  busy,
  isAdmin
}) {
  const allSelected = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => {
    if (!setSelected) return;
    setSelected(allSelected ? /* @__PURE__ */ new Set() : new Set(files.map((f) => f.name)));
  };
  const allCbRef = useRef(null);
  React.useEffect(() => {
    if (allCbRef.current) allCbRef.current.indeterminate = someSelected;
  }, [someSelected]);
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "baseline",
    gap: 14,
    marginBottom: 10,
    // paddingLeft = padding gauche d'une ProductionsRow (10px 14px) →
    // la checkbox « tout » s'aligne pile sur la colonne des checkboxes
    // individuelles de chaque ligne en dessous.
    paddingLeft: 14
  } }, files.length > 0 && setSelected && /* @__PURE__ */ React.createElement(
    "label",
    {
      title: allSelected ? "Tout désélectionner" : "Tout sélectionner",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--ink-3)",
        userSelect: "none"
      }
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: allCbRef,
        type: "checkbox",
        checked: allSelected,
        onChange: toggleAll,
        style: {
          accentColor: "var(--accent)",
          margin: 0,
          cursor: "pointer"
        }
      }
    ),
    /* @__PURE__ */ React.createElement("span", null, "tout")
  ), title && /* @__PURE__ */ React.createElement("h2", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 600,
    margin: 0
  } }, title), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      onClick: onSubmit,
      disabled: busy || selected.size === 0 || !canSubmit,
      title: !canSubmit ? "Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer la soumission" : "Soumettre les fichiers sélectionnés au LLMDrops JDM"
    },
    "📤 Soumettre ",
    selected.size > 0 ? `(${selected.size})` : ""
  ), /* @__PURE__ */ React.createElement("span", { className: "admin-only" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      onClick: onDelete,
      disabled: busy || selected.size === 0
    },
    "🗑 Supprimer ",
    selected.size > 0 ? `(${selected.size})` : ""
  )))), files.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: {
    padding: 24,
    textAlign: "center",
    color: "var(--ink-3)",
    fontSize: 13,
    background: "var(--bg-elev)",
    border: "1px dashed var(--line)",
    borderRadius: "var(--radius-lg)"
  } }, "Aucun fichier ", archived ? "archivé" : "récent", ".") : /* @__PURE__ */ React.createElement(Card, { padding: 0, style: { overflow: "hidden" } }, files.map((f, i) => /* @__PURE__ */ React.createElement(
    ProductionsRow,
    {
      key: f.name + i,
      file: f,
      archived,
      selected: selected.has(f.name),
      onToggle: () => onToggle(f.name),
      onPreview: () => onPreview(f.name, archived),
      onDownload: () => onDownload(f.name, archived),
      isLast: i === files.length - 1
    }
  ))));
}
function ProductionsRow({ file, archived, selected, onToggle, onPreview, onDownload, isLast }) {
  const sizeKB = (file.size / 1024).toFixed(1);
  const age = formatAge(file.age_s);
  const extColors = {
    "enrich": { fg: "var(--jdm-magenta)", tint: "rgba(200, 58, 115, 0.04)" },
    "audit": { fg: "var(--jdm-cyan)", tint: "rgba(31, 151, 177, 0.04)" },
    "err": { fg: "var(--jdm-orange)", tint: "rgba(217, 104, 16, 0.04)" },
    "stat": { fg: "var(--jdm-violet)", tint: "rgba(122, 79, 190, 0.04)" },
    "html": { fg: "var(--jdm-green)", tint: "rgba(78, 166, 60, 0.04)" }
  };
  const { fg: extColor, tint: extTint } = extColors[file.ext] || { fg: "var(--ink-3)", tint: "transparent" };
  const bg = file.submitted ? "rgba(78,166,60,0.10)" : extTint;
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
    background: bg
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: selected,
      onChange: onToggle,
      style: { accentColor: "var(--accent)", flexShrink: 0 }
    }
  ), file.submitted && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--jdm-green)" } }, "✅"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    padding: "2px 6px",
    borderRadius: 3,
    background: "var(--bg-elev)",
    color: extColor,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    flexShrink: 0
  } }, file.ext), /* @__PURE__ */ React.createElement(
    "span",
    {
      className: "mono",
      onClick: onToggle,
      title: selected ? "Désélectionner" : "Sélectionner",
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        transition: "color 0.12s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.textDecoration = "underline";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.textDecoration = "none";
      }
    },
    file.name
  ), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", flexShrink: 0 } }, sizeKB, "KB · ", age), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, flexShrink: 0 } }, /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onPreview }, "👁 Aperçu"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onDownload }, "⬇ DL")));
}
function formatAge(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}
window.ViewProductions = ViewProductions;
const OUTILS_TABS = [
  { id: "coref", label: "Coréférence" },
  { id: "syntax", label: "Analyse syntaxique" },
  { id: "wsd", label: "Désambiguïsation (WSD)" },
  { id: "thematic", label: "Analyse thématique" },
  { id: "polarity", label: "Analyse de polarité" },
  { id: "jdmrel", label: "Extraction de relations" },
  { id: "semviz", label: "Visualisation sémantique", disabled: true },
  { id: "genitive", label: "Génitifs « A de B »" },
  { id: "analogy", label: "Analogies", disabled: true }
];
const TOOL_MODELS = {
  coref: [{ value: "corpipe25", label: "(par défaut)" }],
  syntax: [{ value: "udpipe2-fr-gsd", label: "UDPipe 2 — french-gsd (défaut)" }],
  wsd: [{ value: "jdm-raffinements", label: "JDM WSD" }],
  thematic: [{ value: "jdm-domain", label: "JDM DOMAIN" }],
  polarity: [{ value: "jdm-infopot", label: "JDM POL" }],
  genitive: [{ value: "grasp-it", label: "GRASP-IT" }],
  analogy: [{ value: "default", label: "(par défaut)" }],
  jdmrel: [{ value: "default", label: "JDM EXTRACT" }]
};
const JDMREL_DEFAULT = `Leslie Johnson (20 juin 1933 - 22 août 2018 (à 85 ans)), mieux connu sous le nom de Lazy Lester, est un musicien de blues américain qui chante, joue de l'harmonica et de la guitare. Au cours d'une carrière s'étendant des années 1950 à 2018, il a été un pionnier du swamp blues [1] et a également joué du blues harmonica, du rythme and blues et du blues de Louisiane[2].

Mieux connu pour ses succès régionaux enregistrés avec les Excello Records d'Ernie Young, basé à Nashville, Lester a également contribué aux morceaux enregistrés par d'autres artistes Excello, notamment Slim Harpo, Lightnin' Slim et Katie Webster . Des reprises de ses chansons ont été enregistrées par (entre autres) les Kinks, les Flamin' Groovies, Freddy Fender, Dwight Yoakam, Dave Edmunds, Raful Neal, Anson Funderburgh et les Fabulous Thunderbirds . Après son comeback (depuis la fin des années 1980), il enregistre de nouveaux albums grâce à Mike Buck, Sue Foley, Gene Taylor, Kenny Neal, Lucky Peterson et Jimmie Vaughan.

Leslie Johnson a commencé à jouer de la guitare vers l'âge de 11 ans et à se produire à l'adolescence autour de Baton Rouge avec Raful Neal, co-fondant plus tard les Rhythm Rockers. Au milieu des années 1950, Lester était en marge de la scène blues de Louisiane. Lorsque Buddy Guy part pour Chicago, en 1957, Lester le remplace, à la guitare, dans un groupe local – même si, à cette époque, Lester ne possède pas un tel instrument.

La carrière de Lester décolle lorsqu'il rencontre Lightnin' Slim dans un bus transportant Slim à une session d'enregistrement Excello. Au studio, l'harmoniciste prévu ne se présente pas. Slim et Lester passent l'après-midi à essayer en vain de le retrouver, lorsque Lester se propose de le remplacer. Le travail de Lester lors de cette première session Lightnin' Slim conduit le producteur Jay Miller à enregistrer Lester en tant qu'artiste solo. Miller a surnommé Lester « Lazy Lester » en raison de son style laconique et décontracté.

À la fin des années 1960, il abandonne la musique, travaillant manuellement et s'adonnant à son passe-temps favori : la pêche. Lester déménage finalement à Pontiac, Michigan, vivant avec la sœur de Slim Harpo. En 1971, Fred Reif organise un concert de Lightnin' Slim au Festival Folk de l'Université de Chicago, et amène Lester de Louisiane pour l'accompagner. Des années plus tard, Reif orchestre son comeback.

En septembre 2002, la Boston Blues Society lui décerne un Lifetime Achievement Award. En 2003, Martin Scorsese inclut Lester dans son concert hommage au blues au Radio City Music Hall. Lester vit alors à Paradise, en Californie, avec sa petite amie et apparaît dans le film documentaire de 2015 I Am the Blues. Lester continue à se produire jusqu'en 2018, retournant souvent en Louisiane. Lester décède d'un cancer le 22 août 2018, à l'âge de 85 ans.`;
const DEMO_DEFAULT = "Le guitariste et le pianiste ont joué une symphonie lors du concert. Le chef d'orchestre a dirigé les musiciens sur la scène du théâtre, et le public a applaudi la mélodie. Plus tard, l'équipe a marqué un but au stade : l'attaquant a dribblé le défenseur avant de tirer, et l'arbitre a sifflé la fin du match.";
function ToolNotice({ msg, tone }) {
  const color = tone === "error" ? "var(--jdm-magenta)" : "var(--jdm-orange)";
  return /* @__PURE__ */ React.createElement("div", { style: {
    padding: 16,
    borderRadius: "var(--radius)",
    background: "var(--bg-elev)",
    border: `1px dashed ${color}`,
    color: "var(--ink-2)",
    fontSize: 13,
    lineHeight: 1.5
  } }, tone === "error" ? "⚠️ " : "ℹ️ ", msg);
}
async function _callTool(path, payload) {
  try {
    const res = await fetch("api/tools/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
async function _streamTool(path, payload, onEvent) {
  const res = await fetch("api/tools/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.body) {
    const j = await res.json();
    onEvent(j);
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch (e) {
        }
      }
    }
  }
  const rest = buf.trim();
  if (rest) {
    try {
      onEvent(JSON.parse(rest));
    } catch (e) {
    }
  }
}
function ModelPicker({ value, onChange, options }) {
  if (!options || options.length === 0) return null;
  return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, maxWidth: 420 } }, /* @__PURE__ */ React.createElement(Field, { label: "Modèle" }, /* @__PURE__ */ React.createElement(Select, { value, options, onChange })));
}
function panelGrid() {
  return { display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)" };
}
const _COREF_COLORS = [
  "var(--jdm-magenta)",
  "var(--jdm-cyan)",
  "var(--jdm-green)",
  "var(--jdm-violet)",
  "var(--jdm-orange)",
  "var(--jdm-yellow)"
];
const COREF_EXAMPLES = [
  "La chienne de la voisine est en chaleur. Elle braille sans arrêt. Pourtant elle lui donne la pilule.",
  "Le chien de la voisine est tombé dans le puits. Il a aboyé toute la nuit. Il est très profond. Il l'a beaucoup ennuyée.",
  "Julien a appelé son frère parce qu'il devait lui rendre sa clé. Il l'avait oubliée chez lui hier soir."
];
function CorefPanel() {
  const [text, setText] = React.useState(COREF_EXAMPLES[0]);
  const [model, setModel] = React.useState(TOOL_MODELS.coref[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async (override) => {
    const t = typeof override === "string" ? override : text;
    setLoading(true);
    setRes(null);
    setRes(await _callTool("coref", { text: t, model }));
    setLoading(false);
  };
  const chainOf = {};
  if (res && res.ok && res.data && Array.isArray(res.data.chains)) {
    res.data.chains.forEach((c) => {
      (c.mentions || []).forEach((span) => {
        (span || []).forEach((i) => {
          chainOf[i] = c.id;
        });
      });
    });
  }
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text,
      setText,
      run,
      loading,
      placeholder: "Colle un texte français à résoudre…",
      model,
      setModel,
      models: TOOL_MODELS.coref
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 } }, "Exemples :"), COREF_EXAMPLES.map((ex, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: i,
      className: "focus-ring",
      title: ex,
      onClick: () => {
        setText(ex);
        run(ex);
      },
      style: {
        padding: "4px 10px",
        maxWidth: 360,
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 999,
        color: "var(--ink-2)",
        fontSize: 11,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    },
    ex.length > 46 ? ex.slice(0, 45) + "…" : ex
  ))), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "error" }), res && res.ok && res.data && /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, lineHeight: 2, marginBottom: 16 } }, (res.data.tokens || []).map((t, i) => {
    const cid = chainOf[i];
    const col = cid != null ? _COREF_COLORS[cid % _COREF_COLORS.length] : null;
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement("span", { style: col ? {
      background: `color-mix(in srgb, ${col} 22%, transparent)`,
      borderBottom: `2px solid ${col}`,
      borderRadius: 3,
      padding: "1px 2px"
    } : void 0 }, t.text), t.ws);
  })), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 } }, (res.data.chains || []).length, " chaîne(s) de coréférence"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, (res.data.chains || []).map((c) => {
    const col = _COREF_COLORS[c.id % _COREF_COLORS.length];
    return /* @__PURE__ */ React.createElement("span", { key: c.id, style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: `color-mix(in srgb, ${col} 15%, transparent)`,
      border: `1px solid ${col}`,
      fontSize: 12,
      color: "var(--ink)"
    } }, /* @__PURE__ */ React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: col } }), c.label, c.cat ? ` · ${c.cat}` : "", " (", (c.mentions || []).length, ")");
  })), res.data.ud_svg && /* @__PURE__ */ React.createElement(UdSvg, { svg: res.data.ud_svg })));
}
function SyntaxPanel() {
  const [text, setText] = React.useState("Le chat de la voisine dort sur le canapé.");
  const [model, setModel] = React.useState(TOOL_MODELS.syntax[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true);
    setRes(null);
    setRes(await _callTool("syntax", { text, model }));
    setLoading(false);
  };
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text,
      setText,
      run,
      loading,
      placeholder: "Une phrase à analyser en dépendances…",
      model,
      setModel,
      models: TOOL_MODELS.syntax
    }
  ), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "error" }), res && res.ok && res.data && res.data.ud_svg && /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement(UdSvg, { svg: res.data.ud_svg })));
}
function UdSvg({ svg }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 14,
    background: "#ffffff",
    borderRadius: "var(--radius)",
    border: "1px solid var(--line)",
    padding: 12,
    maxWidth: "100%",
    overflowX: "auto"
  }, dangerouslySetInnerHTML: { __html: svg } });
}
function JsonResult({ data }) {
  return /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("pre", { className: "mono", style: { fontSize: 12, color: "var(--ink-2)", whiteSpace: "pre-wrap", margin: 0, maxWidth: "100%", overflowX: "auto" } }, JSON.stringify(data, null, 2)));
}
function GenitivePanel() {
  const [phrase, setPhrase] = React.useState("roue du vélo");
  const [model, setModel] = React.useState(TOOL_MODELS.genitive[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true);
    setRes(null);
    setRes(await _callTool("genitive", { phrase, model }));
    setLoading(false);
  };
  const d = res && res.ok ? res.data : null;
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text: phrase,
      setText: setPhrase,
      run,
      loading,
      rows: 2,
      placeholder: "Un syntagme génitif « A de B » (ex. roue du vélo)…",
      model,
      setModel,
      models: TOOL_MODELS.genitive
    }
  ), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "warn" }), d && /* @__PURE__ */ React.createElement(Card, { padding: 18 }, d.direct && d.direct.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid var(--line-soft)" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--jdm-green)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 } }, "relations JeuxDeMots directes (A↔B)"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, d.direct.map((x, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "var(--jdm-green)" : "var(--ink-2)", minWidth: 130 } }, x.relation), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--ink)" } }, "« ", x.nl, " »"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" } }, x.via, " (", x.weight, ")"))))), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 } }, d.lexical ? "tête nominale relationnelle (lexical)" : "prédiction du modèle"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: d.lexical ? 13 : 16, fontWeight: 700, color: "var(--accent)", minWidth: 0, overflowWrap: "anywhere" } }, d.relation), !d.lexical && d.top && d.top[0] && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { flexShrink: 0, fontSize: 12, color: "var(--ink-3)" } }, Math.round(d.top[0].proba * 100), "%")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, marginBottom: 16 } }, "« ", d.nl, " »"), d.lexical && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: -8, marginBottom: 16, lineHeight: 1.6 } }, d.lexical.note, /* @__PURE__ */ React.createElement("br", null), "prédiction du modèle (écartée) : ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ink-2)" } }, d.lexical.model_relation), d.top && d.top[0] ? ` (${Math.round(d.top[0].proba * 100)}%)` : ""), d.top && d.top.length > 1 && /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6, marginBottom: 14 } }, d.top.map((t, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: i === 0 ? "var(--ink)" : "var(--ink-3)", minWidth: 130 } }, t.relation), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: 8, background: "var(--bg-elev)", borderRadius: 999, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { width: `${Math.round(t.proba * 100)}%`, height: "100%", background: i === 0 ? "var(--accent)" : "var(--line)" } })), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", minWidth: 34, textAlign: "right" } }, Math.round(t.proba * 100), "%")))), d.signals && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 14, display: "grid", gap: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" } }, "signaux de type"), [["a", d.a], ["b", d.b]].map(([k, w]) => {
    const s = d.signals[k] || { types: [], isa: [] };
    return /* @__PURE__ */ React.createElement("div", { key: k, className: "mono", style: { fontSize: 11, color: "var(--ink-2)" } }, /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ink)" } }, w), s.types.length ? " — " + s.types.join(" · ") : "", s.isa.length ? /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, " (isa : ", s.isa.join(", "), ")") : null);
  })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 } }, "évidence (relations JDM A↔B)"), d.evidence && d.evidence.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, d.evidence.map((e, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "mono", style: { fontSize: 11, padding: "3px 8px", borderRadius: 999, color: "var(--ink-2)", background: "var(--bg-elev)", border: "1px solid var(--line-soft)" } }, e))) : /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, "aucune relation directe discriminante"))));
}
function TextToolPanel({ path, models, defaultText, placeholder, rows = 4, renderData, options }) {
  const [text, setText] = React.useState(defaultText || "");
  const [model, setModel] = React.useState(models[0].value);
  const [opts, setOpts] = React.useState(() => {
    const o = {};
    (options || []).forEach((x) => {
      o[x.key] = !!x.default;
    });
    return o;
  });
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true);
    setRes(null);
    setRes(await _callTool(path, { text, model, ...opts }));
    setLoading(false);
  };
  const checkboxes = options && options.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 } }, options.map((o) => /* @__PURE__ */ React.createElement(
    "label",
    {
      key: o.key,
      title: o.disabled ? "À venir (coréférence trop lente)" : void 0,
      style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)", cursor: o.disabled ? "not-allowed" : "pointer", opacity: o.disabled ? 0.5 : 1 }
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: !o.disabled && !!opts[o.key],
        disabled: o.disabled,
        onChange: (e) => setOpts((s) => ({ ...s, [o.key]: e.target.checked }))
      }
    ),
    o.label
  ))) : null;
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text,
      setText,
      run,
      loading,
      rows,
      placeholder,
      model,
      setModel,
      models,
      belowText: checkboxes
    }
  ), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "warn" }), res && res.ok && res.data && (renderData ? renderData(res.data) : /* @__PURE__ */ React.createElement(JsonResult, { data: res.data })));
}
function JdmRelResult({ data }) {
  const trips = data && data.triplets || [];
  if (!trips.length) {
    return /* @__PURE__ */ React.createElement(
      ToolNotice,
      {
        tone: "warn",
        msg: "Aucune relation détectée (patrons morpho-lexicaux + lexique JeuxDeMots)."
      }
    );
  }
  return /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 } }, trips.length, " relation(s) extraite(s)", data.mode ? ` · ${data.mode}` : ""), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, trips.map((t, i) => /* @__PURE__ */ React.createElement("div", { key: i, title: t.pattern, style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "8px 10px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)"
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 13, color: "var(--ink)" } }, t.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: "var(--accent)" } }, t.relation), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 13, color: "var(--ink)" } }, t.target), t.category && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" } }, t.category)))));
}
const _POL_STYLE = {
  positif: { color: "var(--jdm-green)", bg: "rgba(78,166,60,0.15)", border: "rgba(78,166,60,0.45)" },
  négatif: { color: "var(--jdm-magenta)", bg: "rgba(200,58,115,0.15)", border: "rgba(200,58,115,0.45)" },
  neutre: { color: "var(--jdm-yellow)", bg: "rgba(212,169,10,0.15)", border: "rgba(212,169,10,0.45)" }
};
function PolarityResult({ data }) {
  const s = _POL_STYLE[data.label] || _POL_STYLE.neutre;
  const words = data.words || [];
  const denom = data.pos + data.neg || 1;
  const posPct = Math.round(data.pos / denom * 100);
  return /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "8px 20px",
    borderRadius: 999,
    color: s.color,
    background: s.bg,
    border: `1px solid ${s.border}`
  } }, data.label), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: "var(--ink-3)" } }, "score ", data.score >= 0 ? "+" : "", data.score, " · pos ", data.pos, " / neg ", data.neg)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", height: 10, borderRadius: 999, overflow: "hidden", marginBottom: 16, border: "1px solid var(--line-soft)" } }, /* @__PURE__ */ React.createElement("div", { style: { width: `${posPct}%`, background: "var(--jdm-green)" } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, background: "var(--jdm-magenta)" } })), words.length ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, words.map((w, i) => {
    const ws = _POL_STYLE[w.polarity] || _POL_STYLE.neutre;
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: i,
        title: `positif ${w.pos} · négatif ${w.neg}${w.negated ? " · NÉGATION → inversé" : ""}`,
        style: { fontSize: 12, padding: "3px 10px", borderRadius: 999, color: ws.color, background: ws.bg, border: `1px solid ${ws.border}`, cursor: "help" }
      },
      w.word,
      w.negated ? " ⊘" : ""
    );
  })) : /* @__PURE__ */ React.createElement(ToolNotice, { tone: "warn", msg: "Aucun mot porteur de polarité trouvé dans JeuxDeMots." }));
}
function _senseTag(sense) {
  const m = (sense || "").match(/\(([^)]+)\)/);
  return m ? m[1] : sense;
}
function WsdColumn({ occ: w }) {
  const senses = w.senses || [];
  const accent = w.mwe ? "var(--jdm-cyan)" : w.confident ? "var(--accent)" : "var(--jdm-yellow)";
  return /* @__PURE__ */ React.createElement("div", { style: {
    flex: "0 0 250px",
    minWidth: 250,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 14, color: "var(--ink)", fontWeight: 700 } }, w.word), /* @__PURE__ */ React.createElement("span", { style: {
    marginLeft: "auto",
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 999,
    color: w.mwe || w.confident ? "var(--bg)" : "var(--ink-2)",
    background: accent,
    border: "1px solid var(--line)"
  } }, w.mwe ? "composé" : w.confident ? "confiant" : "incertain")), w.role && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, w.role, " de « ", w.verb, " »"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 5 } }, senses.map((s, j) => {
    const top = j === 0;
    const scoreCol = s.score < 0 ? "var(--jdm-magenta)" : top ? accent : "var(--ink-2)";
    return /* @__PURE__ */ React.createElement("div", { key: j, style: {
      padding: "6px 8px",
      borderRadius: 8,
      background: top ? `color-mix(in srgb, ${accent} 16%, transparent)` : "var(--bg)",
      border: `1px solid ${top ? accent : "var(--line-soft)"}`
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: top ? "var(--ink)" : "var(--ink-2)", fontWeight: top ? 600 : 400, minWidth: 0, flex: "1 1 auto", overflowWrap: "anywhere" } }, j + 1, ". ", _senseTag(s.sense)), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { marginLeft: "auto", flexShrink: 0, fontSize: 12, fontWeight: 600, color: scoreCol } }, s.score)), !w.mwe && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.55 } }, /* @__PURE__ */ React.createElement("div", null, "gén ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ink-2)" } }, s.generic), s.why_gen && s.why_gen.length ? /* @__PURE__ */ React.createElement("span", null, " ← ", s.why_gen.join(", ")) : null), (s.selectional !== 0 || s.why_sel && s.why_sel.length) && /* @__PURE__ */ React.createElement("div", null, "sél ", /* @__PURE__ */ React.createElement("b", { style: { color: s.selectional < 0 ? "var(--jdm-magenta)" : "var(--ink-2)" } }, s.selectional), s.why_sel && s.why_sel.length ? /* @__PURE__ */ React.createElement("span", null, " ← ", s.why_sel.join(" · ")) : null)));
  })));
}
function WsdView({ tokens, occ, mode, loading }) {
  const byToken = {};
  occ.forEach((o) => {
    const idxs = o.span && o.span.length ? o.span : o.token != null ? [o.token] : [];
    idxs.forEach((ti) => {
      byToken[ti] = o;
    });
  });
  return /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 } }, occ.length, " occurrence(s)", loading ? " · analyse en cours…" : "", mode ? ` · ${mode}` : ""), tokens.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, lineHeight: 2.4, marginBottom: 16 } }, tokens.map((t, i) => {
    const o = byToken[t.i];
    if (!o) return /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement("span", null, t.text), t.ws);
    const span = o.span && o.span.length ? o.span : [o.token];
    const isLast = t.i === span[span.length - 1];
    const col = o.mwe ? "var(--jdm-cyan)" : o.confident ? "var(--accent)" : "var(--jdm-yellow)";
    const tag = o.mwe ? "composé" : _senseTag(o.chosen.sense);
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement(
      "span",
      {
        title: `${o.role ? o.role + " de « " + o.verb + " » — " : ""}${o.chosen.sense}`,
        style: { background: `color-mix(in srgb, ${col} 20%, transparent)`, borderBottom: `2px solid ${col}`, borderRadius: 3, padding: "1px 2px", cursor: "help" }
      },
      t.text
    ), isLast && /* @__PURE__ */ React.createElement("sub", { style: { fontSize: 10, color: col, marginLeft: 1, whiteSpace: "nowrap" } }, tag), t.ws);
  })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, alignItems: "stretch" } }, occ.map((w, i) => /* @__PURE__ */ React.createElement(WsdColumn, { key: i, occ: w }))));
}
const WSD_POS = [
  { key: "NOUN", label: "Nom" },
  { key: "PROPN", label: "Nom propre" },
  { key: "VERB", label: "Verbe" },
  { key: "ADJ", label: "Adjectif" }
];
function WsdPanel() {
  const [text, setText] = React.useState(DEMO_DEFAULT);
  const [model, setModel] = React.useState(TOOL_MODELS.wsd[0].value);
  const [tokens, setTokens] = React.useState([]);
  const [occ, setOcc] = React.useState([]);
  const [mode, setMode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [pos, setPos] = React.useState({ NOUN: true, PROPN: true, VERB: false, ADJ: false });
  const allOn = WSD_POS.every((o) => pos[o.key]);
  const selected = WSD_POS.filter((o) => pos[o.key]).map((o) => o.key);
  const run = async () => {
    setLoading(true);
    setErr(null);
    setTokens([]);
    setOcc([]);
    setMode("");
    try {
      await _streamTool("wsd/stream", { text, model, pos: selected }, (ev) => {
        if (ev.type === "tokens") {
          setTokens(ev.tokens || []);
          setMode(ev.mode || "");
        } else if (ev.type === "occ") {
          setOcc((prev) => [...prev, ev.occurrence]);
        } else if (ev.type === "error") {
          setErr(ev.error);
        }
      });
    } catch (e) {
      setErr(String(e && e.message ? e.message : e));
    }
    setLoading(false);
  };
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text,
      setText,
      run,
      loading,
      placeholder: "Un texte à désambiguïser (le bon sens de chaque mot polysémique)…",
      model,
      setModel,
      models: TOOL_MODELS.wsd,
      belowText: /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 12 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" } }, "catégories à désambiguïser"), WSD_POS.map((o) => /* @__PURE__ */ React.createElement("label", { key: o.key, style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked: !!pos[o.key],
          onChange: (e) => setPos({ ...pos, [o.key]: e.target.checked })
        }
      ), o.label)), /* @__PURE__ */ React.createElement(
        "label",
        {
          title: "Désambiguïser aussi les verbes et adjectifs (plus complet, mais plus lent)",
          style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }
        },
        /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: allOn,
            onChange: (e) => setPos(Object.fromEntries(WSD_POS.map((o) => [o.key, e.target.checked])))
          }
        ),
        "Tout"
      ))
    }
  ), err && /* @__PURE__ */ React.createElement(ToolNotice, { tone: "warn", msg: err }), (tokens.length > 0 || occ.length > 0) && /* @__PURE__ */ React.createElement(WsdView, { tokens, occ, mode, loading }));
}
function ThematicPanel() {
  const [text, setText] = React.useState(DEMO_DEFAULT);
  const [model, setModel] = React.useState(TOOL_MODELS.thematic[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [thr, setThr] = React.useState(12);
  const [wsd, setWsd] = React.useState(true);
  const run = async () => {
    setLoading(true);
    setRes(null);
    const r = await _callTool("thematic", { text, model, wsd });
    setRes(r);
    setLoading(false);
    if (r && r.ok && r.data && typeof r.data.suggested_threshold === "number") {
      setThr(r.data.suggested_threshold);
    }
  };
  const data = res && res.ok ? res.data : null;
  const suggested = data && typeof data.suggested_threshold === "number" ? data.suggested_threshold : null;
  const themes = data && data.themes || [];
  const shown = themes.filter((t) => t.rel >= thr);
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(
    ToolForm,
    {
      text,
      setText,
      run,
      loading,
      rows: 6,
      model,
      setModel,
      models: TOOL_MODELS.thematic,
      placeholder: "Un texte à analyser thématiquement (thèmes = domaines JeuxDeMots)…",
      belowText: /* @__PURE__ */ React.createElement(
        "label",
        {
          title: "Désambiguïser chaque mot puis filtrer les domaines par le sens choisi (plus lent, retire la polysémie)",
          style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", marginTop: 12 }
        },
        /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: wsd, onChange: (e) => setWsd(e.target.checked) }),
        "WSD"
      )
    }
  ), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "warn" }), data && /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 } }, themes.length, " thème(s) · ", shown.length, " affiché(s) · ", data.analyzed, "/", data.word_count, " mots analysés", data.truncated ? " (tronqué)" : ""), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" } }, "Seuil"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: thr,
      onChange: (e) => setThr(Number(e.target.value)),
      style: { flex: 1, accentColor: "var(--accent)", cursor: "pointer" }
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 12, color: "var(--accent)", minWidth: 36, textAlign: "right" } }, thr, "%"), suggested !== null && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setThr(suggested),
      className: "focus-ring",
      title: `Seuil auto au plus grand écart (${suggested}%)`,
      style: {
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 999,
        cursor: "pointer",
        color: "var(--ink-2)",
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        whiteSpace: "nowrap"
      }
    },
    "auto ",
    suggested,
    "%"
  )), shown.length ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } }, shown.map((t) => {
    const fs = 13 + t.rel / 100 * 24;
    const pct = Math.round(18 + t.rel / 100 * 52);
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: t.theme,
        title: `score ${t.score} · ${t.count} mot(s) : ${t.words.join(", ")}`,
        style: {
          display: "inline-block",
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: fs,
          lineHeight: 1.15,
          fontWeight: 600,
          color: "var(--ink)",
          background: `color-mix(in srgb, var(--accent) ${pct}%, transparent)`,
          border: "1px solid var(--line-soft)",
          cursor: "default"
        }
      },
      t.theme
    );
  })) : /* @__PURE__ */ React.createElement(ToolNotice, { tone: "warn", msg: "Aucun thème au-dessus du seuil — baisse la barre." })));
}
function AnalogyPanel() {
  const [a, setA] = React.useState("Paris");
  const [b, setB] = React.useState("France");
  const [c, setC] = React.useState("Rome");
  const [model, setModel] = React.useState(TOOL_MODELS.analogy[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true);
    setRes(null);
    setRes(await _callTool("analogy", { a, b, c, model }));
    setLoading(false);
  };
  return /* @__PURE__ */ React.createElement("div", { style: panelGrid() }, /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement(ModelPicker, { value: model, onChange: setModel, options: TOOL_MODELS.analogy }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" } }, /* @__PURE__ */ React.createElement(Field, { label: "A" }, /* @__PURE__ */ React.createElement(Input, { value: a, onChange: setA, mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "est à B" }, /* @__PURE__ */ React.createElement(Input, { value: b, onChange: setB, mono: true })), /* @__PURE__ */ React.createElement(Field, { label: "ce que C" }, /* @__PURE__ */ React.createElement(Input, { value: c, onChange: setC, mono: true })), /* @__PURE__ */ React.createElement(Button, { onClick: run, disabled: loading }, loading ? "…" : "Expliquer")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: 8 } }, "A est à B ce que C est à … ?")), res && !res.ok && /* @__PURE__ */ React.createElement(ToolNotice, { msg: res.error, tone: "warn" }), res && res.ok && res.data && /* @__PURE__ */ React.createElement(JsonResult, { data: res.data }));
}
function ToolForm({ text, setText, run, loading, placeholder, rows = 4, model, setModel, models, belowText }) {
  return /* @__PURE__ */ React.createElement(Card, { padding: 18 }, /* @__PURE__ */ React.createElement(ModelPicker, { value: model, onChange: setModel, options: models }), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: text,
      onChange: (e) => setText(e.target.value),
      placeholder,
      rows,
      style: {
        width: "100%",
        boxSizing: "border-box",
        resize: "vertical",
        background: "var(--bg-elev)",
        color: "var(--ink)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "10px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.5
      }
    }
  ), belowText, /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(Button, { onClick: run, disabled: loading || !text.trim() }, loading ? "Analyse…" : "Analyser")));
}
const TAB_SLUG = {
  coref: "coref",
  syntax: "syntax",
  wsd: "wsd",
  thematic: "theme",
  polarity: "pol",
  jdmrel: "extraction",
  semviz: "semviz",
  genitive: "gen",
  analogy: "analogie"
};
const TAB_BY_SLUG = {
  coref: "coref",
  coreference: "coref",
  syntax: "syntax",
  synt: "syntax",
  syntaxe: "syntax",
  wsd: "wsd",
  desamb: "wsd",
  desambiguisation: "wsd",
  theme: "thematic",
  thematic: "thematic",
  thematique: "thematic",
  thematique2: "thematic",
  pol: "polarity",
  polarite: "polarity",
  polarity: "polarity",
  rel: "jdmrel",
  extraction: "jdmrel",
  relations: "jdmrel",
  jdmrel: "jdmrel",
  semviz: "semviz",
  viz: "semviz",
  gen: "genitive",
  genitif: "genitive",
  genitifs: "genitive",
  genitive: "genitive",
  analogie: "analogy",
  analogies: "analogy",
  analogy: "analogy"
};
function _tabFromHash() {
  if (typeof window === "undefined") return null;
  const raw = (window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
  const id = TAB_BY_SLUG[raw];
  if (!id) return null;
  const t = OUTILS_TABS.find((x) => x.id === id);
  return t && !t.disabled ? id : null;
}
function ViewOutils() {
  const [tab, _setTab] = React.useState(() => _tabFromHash() || "coref");
  const setTab = React.useCallback((id) => {
    _setTab(id);
    if (typeof window !== "undefined" && window.history) {
      window.history.replaceState(null, "", "#" + (TAB_SLUG[id] || id));
    }
  }, []);
  React.useEffect(() => {
    const onHash = () => {
      const id = _tabFromHash();
      if (id) _setTab(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement(
    SectionTitle,
    {
      title: "Services : Tâche TALN",
      desc: "Démonstrateurs d'outils de traitement automatique des langues assistés par le réseau lexico-sémantique JeuxDeMots"
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 } }, OUTILS_TABS.map((t) => {
    const active = tab === t.id;
    const off = !!t.disabled;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        onClick: () => {
          if (!off) setTab(t.id);
        },
        disabled: off,
        title: off ? "À venir" : void 0,
        className: "focus-ring",
        style: {
          padding: "8px 14px",
          background: active ? "var(--accent)" : "var(--bg-elev)",
          color: off ? "var(--ink-3)" : active ? "var(--bg)" : "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          cursor: off ? "not-allowed" : "pointer",
          opacity: off ? 0.5 : 1,
          fontSize: 13,
          fontWeight: active ? 600 : 400
        }
      },
      t.label
    );
  })), tab === "coref" && /* @__PURE__ */ React.createElement(CorefPanel, null), tab === "syntax" && /* @__PURE__ */ React.createElement(SyntaxPanel, null), tab === "wsd" && /* @__PURE__ */ React.createElement(WsdPanel, null), tab === "thematic" && /* @__PURE__ */ React.createElement(ThematicPanel, null), tab === "polarity" && /* @__PURE__ */ React.createElement(
    TextToolPanel,
    {
      path: "polarity",
      models: TOOL_MODELS.polarity,
      defaultText: "Ce film n'est pas excellent, quelle horreur. En revanche j'ai adoré la musique.",
      placeholder: "Un texte dont analyser la polarité (positif / négatif / neutre)…",
      renderData: (d) => /* @__PURE__ */ React.createElement(PolarityResult, { data: d })
    }
  ), tab === "genitive" && /* @__PURE__ */ React.createElement(GenitivePanel, null), tab === "analogy" && /* @__PURE__ */ React.createElement(AnalogyPanel, null), tab === "jdmrel" && /* @__PURE__ */ React.createElement(
    TextToolPanel,
    {
      path: "jdmrel",
      models: TOOL_MODELS.jdmrel,
      defaultText: JDMREL_DEFAULT,
      rows: 12,
      placeholder: "Un texte à analyser en relations sémantiques JDM (syntaxe UDPipe + JDM)…",
      options: [{ key: "resolve_anaphora", label: "Résoudre les anaphores pronominales (coréférence)", default: false, disabled: true }],
      renderData: (d) => /* @__PURE__ */ React.createElement(JdmRelResult, { data: d })
    }
  ));
}
window.ViewOutils = ViewOutils;
const AIDE_SECTIONS = [
  { id: "tour", num: "01", label: "Tour des onglets" },
  { id: "jarvis", num: "02", label: "Jarvis en détail" },
  { id: "install", num: "03", label: "Installation locale" },
  { id: "mcp", num: "04", label: "Serveur MCP" },
  { id: "keys", num: "05", label: "Clés API" },
  { id: "kbd", num: "06", label: "Raccourcis" },
  { id: "format", num: "07", label: "Formats de fichiers" }
];
const TABS_TABLE = [
  { icon: "📋", name: "Projet", what: "Présentation, liens code source.", key: "Aucune" },
  { icon: "🔎", name: "Explorer JDM", what: "Table de triplets pour un terme/relation. Déterministe.", key: "Aucune" },
  { icon: "⚖️", name: "Claim checker", what: "SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet. Déterministe.", key: "Aucune" },
  { icon: "🕸️", name: "Sous-graphe", what: "Visualisation vis-network interactive du voisinage.", key: "Aucune" },
  { icon: "🤖", name: "Agent", what: "Chat libre avec un agent LLM qui utilise les outils JDM.", key: "Gemini gratuit · BYOK Claude/GPT" },
  { icon: "🦾", name: "Jarvis", what: "Agents guidés par formulaires (5 sous-onglets).", key: "Gemini · LLMDrops si soumission" },
  { icon: "🛠️", name: "Aide", what: "Ce document.", key: "—" }
];
const JARVIS_AGENTS_HELP = [
  {
    id: "enrich",
    icon: "🌱",
    accent: "var(--jdm-green)",
    name: "Enrichissement",
    wf: "enrichment_workflow()",
    desc: "Propose et consolide de nouveaux triplets pour un terme. Form : terme, relation cible (optionnelle), nombre cible, varier les relations, itérer jusqu'au but, soumettre. Output : chatbot + fichier .enrich."
  },
  {
    id: "audit",
    icon: "🔍",
    accent: "var(--jdm-cyan)",
    name: "Audit",
    wf: "audit_workflow()",
    desc: "Audit sémantique de la répartition des sens d'un terme polysémique. Verdict par triplet (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative. Fichier .audit."
  },
  {
    id: "gap",
    icon: "🕳️",
    accent: "var(--jdm-violet)",
    name: "Détection de trous",
    wf: "gap_detection_workflow()",
    desc: "Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE). Tableau déterministe + synthèse narrative. Routage vers Enrich / Audit / Stats."
  },
  {
    id: "signalement",
    icon: "⚠️",
    accent: "var(--jdm-magenta)",
    name: "Signalement",
    wf: "signalement_workflow()",
    desc: "Le LLM utilise son jugement linguistique pour flagger les triplets suspects (pas besoin de preuve d'outil). Fichier .err avec catégorie de suspicion et justification."
  },
  {
    id: "stats",
    icon: "📊",
    accent: "var(--jdm-yellow)",
    name: "Stats",
    wf: "stats_workflow()",
    desc: "Statistiques de couverture par terme et/ou par relation : n_total, n_pos, n_neg, max_w, min_w, mean_w par relation + 3-5 observations clés en prose."
  }
];
const API_KEYS_TABLE = [
  {
    name: "Gemini",
    where: "aistudio.google.com/apikey",
    cost: "Gratuit (500 req/jour, 3.1 Flash Lite)",
    when: "Pré-configurée côté serveur",
    url: "https://aistudio.google.com/apikey",
    tone: "free"
  },
  {
    name: "LLMDrops JDM",
    where: "jeuxdemots.org (contact M. Lafourcade)",
    cost: "Gratuit sur demande",
    when: "Pousser .enrich / .audit / .err",
    url: "https://www.jeuxdemots.org",
    tone: "free"
  },
  {
    name: "Anthropic (Claude)",
    where: "console.anthropic.com",
    cost: "Payant ($)",
    when: "BYOK Claude dans Agent / Jarvis",
    url: "https://console.anthropic.com",
    tone: "paid"
  },
  {
    name: "OpenAI (GPT)",
    where: "platform.openai.com",
    cost: "Payant ($)",
    when: "BYOK GPT dans Agent / Jarvis",
    url: "https://platform.openai.com/api-keys",
    tone: "paid"
  }
];
const SHORTCUTS = [
  { keys: ["G", "E"], desc: "Aller à Explorer" },
  { keys: ["G", "C"], desc: "Aller à Claim checker" },
  { keys: ["G", "A"], desc: "Aller à Agent" },
  { keys: ["G", "J"], desc: "Aller à Jarvis" },
  { keys: ["?"], desc: "Cette page d'aide" }
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
function CodeBlock({ label, language, children }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    border: "1px solid var(--line)",
    background: "var(--bg-card)",
    marginBottom: 16
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 14px",
    background: "var(--bg-elev)",
    borderBottom: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.12em"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 5 } }, ["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: c,
    opacity: 0.55
  } }))), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: 4 } }, label), language && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", color: "var(--accent)" } }, language)), /* @__PURE__ */ React.createElement("pre", { style: {
    margin: 0,
    padding: "16px 18px",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    lineHeight: 1.65,
    color: "var(--ink)",
    overflowX: "auto",
    whiteSpace: "pre"
  } }, children));
}
function AideSectionHeader({ num, title, kicker }) {
  return /* @__PURE__ */ React.createElement("div", { id: `aide-${num}`, style: {
    marginBottom: 20,
    paddingTop: 8,
    scrollMarginTop: 80
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "baseline",
    gap: 14,
    marginBottom: kicker ? 8 : 0
  } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
    fontSize: 12,
    color: "var(--accent)",
    fontWeight: 700,
    letterSpacing: "0.08em"
  } }, num), /* @__PURE__ */ React.createElement("h2", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    fontWeight: 600,
    letterSpacing: "-0.015em",
    margin: 0,
    color: "var(--ink)"
  } }, title), /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    height: 1,
    background: "linear-gradient(to right, var(--line) 0%, transparent 100%)",
    marginLeft: 6
  } })), kicker && /* @__PURE__ */ React.createElement("p", { style: {
    margin: 0,
    marginLeft: 38,
    fontSize: 13,
    color: "var(--ink-2)",
    lineHeight: 1.55,
    maxWidth: "64ch"
  } }, kicker));
}
function AideTOC() {
  const [active, setActive] = useState("tour");
  useEffect(() => {
    const onScroll = () => {
      let best = "tour", bestDist = Infinity;
      AIDE_SECTIONS.forEach((s) => {
        const el = document.getElementById(`aide-${s.num}`);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const dist = Math.abs(top - 100);
        if (top < 200 && dist < bestDist) {
          bestDist = dist;
          best = s.id;
        }
      });
      setActive(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const go = (s) => {
    const el = document.getElementById(`aide-${s.num}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return /* @__PURE__ */ React.createElement("nav", { "aria-label": "Table des matières", style: {
    position: "sticky",
    top: 80,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingLeft: 14,
    borderLeft: "1px solid var(--line-soft)"
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 10,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: 10,
    fontWeight: 600
  } }, "Sommaire"), AIDE_SECTIONS.map((s) => {
    const on = active === s.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: s.id,
        type: "button",
        onClick: () => go(s),
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: "6px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          color: on ? "var(--accent)" : "var(--ink-2)",
          transition: "color 0.18s",
          position: "relative"
        }
      },
      on && /* @__PURE__ */ React.createElement("span", { style: {
        position: "absolute",
        left: -15,
        top: "50%",
        transform: "translateY(-50%)",
        width: 2,
        height: 16,
        background: "var(--accent)"
      } }),
      /* @__PURE__ */ React.createElement("span", { className: "mono", style: {
        fontSize: 10,
        opacity: 0.7,
        minWidth: 18
      } }, s.num),
      /* @__PURE__ */ React.createElement("span", { style: {
        fontSize: 13,
        fontWeight: on ? 600 : 400
      } }, s.label)
    );
  }));
}
function ViewAide() {
  return /* @__PURE__ */ React.createElement(PageShell, null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 28,
    alignItems: "center",
    padding: "24px 28px",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    marginBottom: 40
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 30, color: "var(--bg)" } }, "?")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    marginBottom: 6
  } }, "Documentation"), /* @__PURE__ */ React.createElement("h1", { className: "display", style: {
    fontFamily: "var(--font-display)",
    margin: 0,
    fontSize: 30,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "var(--ink)"
  } }, "Aide & Installation"), /* @__PURE__ */ React.createElement("p", { style: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "var(--ink-2)",
    lineHeight: 1.55,
    maxWidth: "70ch"
  } }, "Naviguer la démo, installer en local, brancher le MCP, comprendre les formats de soumission JDM. Sommaire à gauche, contenu à droite."))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "200px 1fr",
    gap: 40,
    alignItems: "start"
  } }, /* @__PURE__ */ React.createElement(AideTOC, null), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "01",
      title: "Tour des onglets",
      kicker: "7 onglets, chacun avec sa fonction. Cartes ci-dessous : ce que fait l'onglet et quelle clé API il consomme."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 10,
    marginBottom: 48
  } }, TABS_TABLE.map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t.name,
      style: {
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        transition: "border-color 0.15s"
      },
      onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--accent)",
      onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--line)"
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 18 } }, t.icon), /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 13, color: "var(--ink)" } }, t.name)),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 8 } }, t.what),
    /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
      fontSize: 10,
      color: "var(--ink-3)",
      textTransform: "uppercase",
      letterSpacing: "0.08em"
    } }, "Clé : ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent)" } }, t.key))
  ))), /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "02",
      title: "Jarvis en détail",
      kicker: "5 flows guidés. Tous partagent un bandeau (clé LLMDrops, modèle, budget d'appels d'outils 10 / 25 / 50 / 100 / illimité)."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
    marginBottom: 48
  } }, JARVIS_AGENTS_HELP.map((f) => /* @__PURE__ */ React.createElement("div", { key: f.id, style: {
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderLeft: `3px solid ${f.accent}`,
    borderRadius: "var(--radius-lg)",
    padding: 18
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 22 } }, f.icon), /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 15, color: "var(--ink)" } }, f.name), /* @__PURE__ */ React.createElement("code", { className: "mono", style: {
    marginLeft: "auto",
    background: "var(--bg-elev)",
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 10,
    color: f.accent,
    fontWeight: 600
  } }, f.wf)), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 } }, f.desc)))), /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "03",
      title: "Installation locale",
      kicker: "Sur Debian 12 / Ubuntu 24.04 (PEP 668), le venv est obligatoire — pip refuse hors venv."
    }
  ), /* @__PURE__ */ React.createElement(CodeBlock, { label: "install.sh", language: "bash" }, INSTALL_SCRIPT), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: "var(--ink-2)",
    lineHeight: 1.6,
    padding: "12px 16px",
    background: "var(--bg-elev)",
    borderLeft: "3px solid var(--accent)",
    borderRadius: "0 var(--radius) var(--radius) 0",
    marginBottom: 48
  } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Reverse-proxy"), " — pour servir sur un sous-chemin (", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "/Jarvis/"), " par ex.), mets ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "APP_SUBPATH=/Jarvis"), " dans ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, ".env"), ". Le frontend injecte ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "<base href>"), " automatiquement et les fetch API se résolvent."), /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "04",
      title: "Serveur MCP",
      kicker: "Expose les outils JDM dans Claude Code / Cursor / tout client MCP-compatible."
    }
  ), /* @__PURE__ */ React.createElement(CodeBlock, { label: "claude-code", language: "bash" }, MCP_SCRIPT), /* @__PURE__ */ React.createElement("p", { style: {
    fontSize: 13,
    color: "var(--ink-2)",
    lineHeight: 1.6,
    margin: "0 0 48px"
  } }, "Ensuite depuis Claude Code : ", /* @__PURE__ */ React.createElement("em", null, "« Donne-moi les synonymes de voiture dans JDM »"), " → l'agent appelle automatiquement les outils MCP exposés."), /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "05",
      title: "Clés API",
      kicker: "Quatre fournisseurs possibles, deux gratuits et deux payants."
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 10,
    marginBottom: 12
  } }, API_KEYS_TABLE.map((k) => /* @__PURE__ */ React.createElement(
    "a",
    {
      key: k.name,
      href: k.url,
      target: "_blank",
      rel: "noopener noreferrer",
      style: {
        display: "block",
        padding: 16,
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.18s, border-color 0.15s, box-shadow 0.15s",
        position: "relative",
        overflow: "hidden"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.borderColor = k.tone === "free" ? "var(--jdm-green)" : "var(--jdm-yellow)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px -10px rgba(0,0,0,0.3)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "none";
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 14, color: "var(--ink)" } }, k.name), /* @__PURE__ */ React.createElement(Pill, { color: k.tone === "free" ? "var(--jdm-green)" : "var(--jdm-yellow)", tone: "outline" }, k.tone === "free" ? "Gratuit" : "Payant")),
    /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)", marginBottom: 8 } }, k.where),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", marginBottom: 6 } }, k.cost),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" } }, k.when),
    /* @__PURE__ */ React.createElement("span", { style: { position: "absolute", bottom: 12, right: 14, color: "var(--accent)", fontSize: 14 } }, "↗")
  ))), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 11,
    color: "var(--ink-3)",
    marginBottom: 48,
    lineHeight: 1.6,
    padding: "10px 14px",
    background: "var(--bg-elev)",
    border: "1px dashed var(--line)",
    borderRadius: "var(--radius)"
  } }, "⚠ ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "Sécurité"), " — les clés que tu colles dans l'UI ne sont", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, " jamais persistées"), " côté serveur — elles vivent uniquement le temps de ton onglet."), /* @__PURE__ */ React.createElement(AideSectionHeader, { num: "06", title: "Raccourcis clavier" }), /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
    marginBottom: 48
  } }, SHORTCUTS.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "var(--bg-card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, flexShrink: 0 } }, s.keys.map((k, j) => /* @__PURE__ */ React.createElement("span", { key: j, className: "kbd" }, k))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-2)" } }, s.desc)))), /* @__PURE__ */ React.createElement(
    AideSectionHeader,
    {
      num: "07",
      title: "Format des fichiers de soumission",
      kicker: "Tous les fichiers produits par Jarvis suivent un format pipe."
    }
  ), /* @__PURE__ */ React.createElement(CodeBlock, { label: "formats", language: "pipe" }, FORMAT_TEXT), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: "var(--ink-2)",
    marginBottom: 48,
    lineHeight: 1.6
  } }, "Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :", /* @__PURE__ */ React.createElement("ul", { style: { marginTop: 8, paddingLeft: 22 } }, /* @__PURE__ */ React.createElement("li", { style: { marginBottom: 4 } }, "coche ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Soumettre directement"), " dans le formulaire (clé ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "JDM_DROPS_API_KEY"), " requise) ;"), /* @__PURE__ */ React.createElement("li", null, "ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org."))), /* @__PURE__ */ React.createElement("div", { className: "admin-only", style: { marginBottom: 40 } }, /* @__PURE__ */ React.createElement(AideSectionHeader, { num: "08", title: "Panneau admin" }), /* @__PURE__ */ React.createElement(AdminPanel, null)), /* @__PURE__ */ React.createElement("div", { style: {
    padding: 28,
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius-lg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18
  } }, /* @__PURE__ */ React.createElement(JDMMark, { size: 36 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "display", style: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 4
  } }, "jdmAgent"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 } }, "Mathieu Lafourcade ·", " ", /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://www.lirmm.fr/",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "LIRMM"
  ), " ", "(Université de Montpellier — CNRS) ·", " ", /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://www.lirmm.fr/equipes/slice/",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--accent)" }
    },
    "Équipe SLICE"
  )), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: 4 } }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://github.com/expAg/JDMAgent",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--ink-3)" }
    },
    "github.com/expAg/JDMAgent"
  ), " · ", /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://github.com/expAg/JDMAgent/blob/main/USAGE.md",
      target: "_blank",
      rel: "noopener noreferrer",
      style: { color: "var(--ink-3)" }
    },
    "USAGE.md"
  )))))));
}
function AdminPanel() {
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [allVars, setAllVars] = useState({});
  const [edits, setEdits] = useState({});
  const [editMsg, setEditMsg] = useState("");
  const [cacheMsg, setCacheMsg] = useState("");
  React.useEffect(() => {
    fetch("api/admin/info").then((r) => r.json()).then(setInfo).catch(() => {
    });
  }, []);
  const auth = async () => {
    if (!password) {
      setAuthErr("Mot de passe requis.");
      return;
    }
    setBusy(true);
    setAuthErr("");
    try {
      const r = await fetch("api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (r.status === 401) {
        setAuthErr("Mot de passe invalide.");
        return;
      }
      if (r.status === 503) {
        setAuthErr("Admin désactivé : EXPORT_SECRETS_PASSWORD non défini côté serveur.");
        return;
      }
      if (!r.ok) {
        setAuthErr(`HTTP ${r.status}`);
        return;
      }
      setAuthed(true);
      const exp = await fetch("api/admin/export-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
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
    setAuthed(false);
    setPassword("");
    setAllVars({});
    setEdits({});
    setEditMsg("");
    setCacheMsg("");
  };
  const setOne = (k, v) => setEdits((e) => ({ ...e, [k]: v }));
  const submitEdits = async () => {
    setEditMsg("");
    const vars = Object.fromEntries(Object.entries(edits).filter(([_, v]) => v !== void 0 && v !== ""));
    if (Object.keys(vars).length === 0) {
      setEditMsg("Aucune modification à appliquer.");
      return;
    }
    try {
      const r = await fetch("api/admin/env-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, vars })
      });
      const d = await r.json();
      if (r.ok) {
        setEditMsg(`✓ ${(d.updated || []).length} mise(s) à jour · .env persisté : ${d.persisted_to_dotenv ? "oui" : "non"}`);
        setAllVars((av) => ({ ...av, ...vars }));
        setEdits({});
      } else {
        setEditMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setEditMsg(`✗ ${e && e.message ? e.message : e}`);
    }
  };
  const clearCache = async () => {
    setCacheMsg("");
    if (!confirm("Vider tout le cache disque JDM ? Les prochains appels iront refrapper l'API.")) return;
    try {
      const r = await fetch("api/admin/cache-clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
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
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.export";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const EDITABLE_VARS = [
    "JDM_BASE_URL",
    "JDM_TIMEOUT",
    "JDM_CACHE_DIR",
    "JDM_CACHE_TTL_META",
    "JDM_CACHE_TTL_DATA",
    "LLM_PROVIDER",
    "LLM_MODEL",
    "LLM_TEMPERATURE",
    "OLLAMA_BASE_URL",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GROQ_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_API_KEYS",
    "HF_TOKEN",
    "JDM_DROPS_API_KEY",
    "JDM_DROPS_URL",
    "APP_SUBPATH"
  ];
  return /* @__PURE__ */ React.createElement(Card, { padding: 20, style: { border: "1px dashed var(--jdm-magenta)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--jdm-magenta)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 600
  } }, "Panneau admin"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)" } }, "Réservé · activé via ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "?admin=1"), " dans l'URL."), authed && /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      style: { marginLeft: "auto" },
      onClick: logout
    },
    "🔒 Verrouiller"
  )), info && /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-elev)",
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius)",
    padding: 14,
    marginBottom: 14,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    lineHeight: 1.7
  } }, /* @__PURE__ */ React.createElement("div", null, "Python : ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, info.python)), /* @__PURE__ */ React.createElement("div", null, "APP_SUBPATH : ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, info.app_subpath || "(racine)")), /* @__PURE__ */ React.createElement("div", null, "Pool Gemini : ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, info.pool_size, " clé(s)")), /* @__PURE__ */ React.createElement("div", null, "Export secrets : ", /* @__PURE__ */ React.createElement("strong", { style: { color: info.export_secrets_enabled ? "var(--jdm-green)" : "var(--jdm-magenta)" } }, info.export_secrets_enabled ? "activé" : "désactivé (EXPORT_SECRETS_PASSWORD non défini)")), /* @__PURE__ */ React.createElement("div", null, "Env vars présentes : ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, (info.env_vars_present || []).length), " / ", EDITABLE_VARS.length)), !authed ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "Authentification requise"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8 } }, /* @__PURE__ */ React.createElement(
    Input,
    {
      value: password,
      onChange: setPassword,
      placeholder: "Mot de passe EXPORT_SECRETS_PASSWORD",
      mono: true
    }
  ), /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: auth, disabled: busy || !password }, busy ? "…" : "Déverrouiller")), authErr && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    padding: 10,
    background: "rgba(200,58,115,0.08)",
    border: "1px solid var(--jdm-magenta)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-magenta)",
    fontSize: 12
  } }, authErr)) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    marginBottom: 16,
    padding: 10,
    background: "rgba(78,166,60,0.08)",
    border: "1px solid var(--jdm-green)",
    borderRadius: "var(--radius)",
    color: "var(--jdm-green)",
    fontSize: 12,
    fontFamily: "var(--font-mono)"
  } }, "✓ Mot de passe accepté — contrôles débloqués"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "1 · Variables d'environnement"), /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--bg-elev)",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 8,
    maxHeight: 420,
    overflow: "auto"
  } }, EDITABLE_VARS.map((k) => {
    const isSecret = /KEY|TOKEN|PASSWORD/.test(k);
    const cur = allVars[k] || "";
    const displayMask = isSecret && cur ? cur.slice(0, 4) + "…" + cur.slice(-4) : cur;
    return /* @__PURE__ */ React.createElement(
      AdminVarRow,
      {
        key: k,
        name: k,
        current: cur,
        displayMask,
        editValue: edits[k] || "",
        onEdit: (v) => setOne(k, v)
      }
    );
  })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: submitEdits }, "✓ Appliquer les modifications"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", onClick: downloadEnv }, "⬇ Télécharger .env complet")), editMsg && /* @__PURE__ */ React.createElement("div", { style: {
    marginBottom: 16,
    padding: 10,
    background: editMsg.startsWith("✓") ? "rgba(78,166,60,0.08)" : "rgba(200,58,115,0.08)",
    border: `1px solid ${editMsg.startsWith("✓") ? "var(--jdm-green)" : "var(--jdm-magenta)"}`,
    borderRadius: "var(--radius)",
    color: editMsg.startsWith("✓") ? "var(--jdm-green)" : "var(--jdm-magenta)",
    fontSize: 12
  } }, editMsg), /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 8
  } }, "2 · Cache disque JDM"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", onClick: clearCache }, "🗑 Vider le cache JDM"), cacheMsg && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    padding: 10,
    background: cacheMsg.startsWith("✓") ? "rgba(78,166,60,0.08)" : "rgba(200,58,115,0.08)",
    border: `1px solid ${cacheMsg.startsWith("✓") ? "var(--jdm-green)" : "var(--jdm-magenta)"}`,
    borderRadius: "var(--radius)",
    color: cacheMsg.startsWith("✓") ? "var(--jdm-green)" : "var(--jdm-magenta)",
    fontSize: 12
  } }, cacheMsg)));
}
function AdminVarRow({ name, current, displayMask, editValue, onEdit }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
    }
  };
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "170px 1fr 28px 220px",
    gap: 8,
    alignItems: "center",
    marginBottom: 6
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: {
    fontSize: 11,
    color: "var(--ink-2)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  } }, name), /* @__PURE__ */ React.createElement("div", { className: "mono", title: current || "(non défini)", style: {
    fontSize: 11,
    color: current ? "var(--ink)" : "var(--ink-3)",
    fontStyle: current ? "normal" : "italic",
    background: "var(--bg-card)",
    padding: "6px 10px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--line-soft)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  } }, current ? displayMask : "(non défini)"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: copy,
      disabled: !current,
      title: current ? "Copier la valeur" : "",
      style: {
        width: 28,
        height: 28,
        padding: 0,
        background: copied ? "var(--jdm-green)" : "transparent",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: copied ? "#fff" : "var(--ink-3)",
        cursor: current ? "pointer" : "not-allowed",
        opacity: current ? 1 : 0.4,
        fontSize: 13
      }
    },
    copied ? "✓" : "⎘"
  ), /* @__PURE__ */ React.createElement(
    Input,
    {
      value: editValue,
      onChange: onEdit,
      placeholder: "nouvelle valeur (vide = ignore)",
      mono: true
    }
  ));
}
window.ViewAide = ViewAide;
const _PREFERS_DARK = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const TWEAK_DEFAULTS = (
  /*EDITMODE-BEGIN*/
  {
    "theme": _PREFERS_DARK ? "lab" : "paper",
    "accent": "#c0411a"
  }
);
const TWEAK_ACCENTS = ["#c0411a", "#1f97b1", "#c83a73", "#4ea63c", "#7a4fbe", "#d96810"];
const _VALID_VIEWS = [
  "projet",
  "explorer",
  "claim",
  "subgraph",
  "chatbot",
  "chat",
  "jarvis",
  "productions",
  "outils",
  "aide"
];
function _appBase() {
  if (typeof document === "undefined") return "";
  const b = document.querySelector("base");
  const href = b && b.getAttribute("href") || "/";
  return href.replace(/\/+$/, "");
}
function _parseRoute(pathname) {
  const base = _appBase();
  let p = pathname || "/";
  if (base && p.startsWith(base)) p = p.slice(base.length);
  if (!p.startsWith("/")) p = "/" + p;
  const segs = p.split("/").filter(Boolean);
  const view = (segs[0] || "projet").toLowerCase();
  const sub = segs[1] || null;
  return _VALID_VIEWS.includes(view) ? { view, sub } : { view: "projet", sub: null };
}
function _buildPath(view, sub) {
  const base = _appBase();
  let p;
  if (!view || view === "projet") p = base + "/";
  else {
    p = base + "/" + view;
    if (sub) p += "/" + sub;
  }
  if (typeof window !== "undefined" && view === "outils" && window.location.hash) {
    p += window.location.hash;
  }
  return p;
}
if (typeof window !== "undefined") {
  window.__jdmRoute = {
    push(view, sub) {
      if (!window.history || !window.history.pushState) return;
      const target = _buildPath(view, sub);
      if (window.location.pathname === target) return;
      window.history.pushState({ view, sub }, "", target);
    },
    replace(view, sub) {
      if (!window.history || !window.history.replaceState) return;
      const target = _buildPath(view, sub);
      window.history.replaceState({ view, sub }, "", target);
    }
  };
}
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const _initialRoute = typeof window !== "undefined" ? _parseRoute(window.location.pathname) : { view: "projet", sub: null };
  if (typeof window !== "undefined" && typeof _tabFromHash === "function") {
    try {
      if (_tabFromHash()) _initialRoute.view = "outils";
    } catch (e) {
    }
  }
  if (_initialRoute.view === "jarvis" && _initialRoute.sub && typeof window !== "undefined") {
    window.__jdmPendingPayload = window.__jdmPendingPayload || {};
    window.__jdmPendingPayload.jarvis = Object.assign(
      {},
      window.__jdmPendingPayload.jarvis || {},
      { flow: _initialRoute.sub }
    );
  }
  const [view, setView] = useState(_initialRoute.view);
  useEffect(() => {
    document.body.dataset.theme = tweaks.theme || (_PREFERS_DARK ? "lab" : "paper");
  }, [tweaks.theme]);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const sysTheme = e.matches ? "lab" : "paper";
      const wasSystem = tweaks.theme === "lab" === e.matches;
    };
    mq.addEventListener && mq.addEventListener("change", handler);
    return () => mq.removeEventListener && mq.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    const root = document.body;
    if (tweaks.accent) {
      root.style.setProperty("--accent", tweaks.accent);
    } else {
      root.style.removeProperty("--accent");
    }
  }, [tweaks.accent, tweaks.theme]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);
  const _viewMountedRef = useRef(false);
  useEffect(() => {
    if (!_viewMountedRef.current) {
      _viewMountedRef.current = true;
      if (window.__jdmRoute) window.__jdmRoute.replace(view, null);
      return;
    }
    if (window.__jdmRoute) window.__jdmRoute.push(view, null);
  }, [view]);
  useEffect(() => {
    const ROBOT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='11 6 58 58'%3E%3Cdefs%3E%3ClinearGradient id='v' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23E63B7A'/%3E%3Cstop offset='.25' stop-color='%23F5C518'/%3E%3Cstop offset='.5' stop-color='%235FB94A'/%3E%3Cstop offset='.75' stop-color='%232BB8D4'/%3E%3Cstop offset='1' stop-color='%238A5CD4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cline x1='40' y1='21' x2='40' y2='13' stroke='%232BD4C0' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='40' cy='10.5' r='4' fill='%232BD4C0'/%3E%3Crect x='16' y='21' width='48' height='43' rx='17' fill='%23f3eee2'/%3E%3Crect x='21' y='28' width='38' height='27' rx='12' fill='url(%23v)' opacity='.95'/%3E%3Crect x='23.5' y='30.5' width='33' height='22' rx='10' fill='%230b0c10'/%3E%3Ccircle cx='33' cy='41.5' r='5' fill='%232BD4C0'/%3E%3Ccircle cx='47' cy='41.5' r='5' fill='%232BD4C0'/%3E%3C/svg%3E";
    const SUN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='13 13 54 54'%3E%3Ccircle cx='40' cy='18' r='4.5' fill='%23E63B7A'/%3E%3Ccircle cx='55.6' cy='24.4' r='4.5' fill='%23F5C518'/%3E%3Ccircle cx='62' cy='40' r='4.5' fill='%235FB94A'/%3E%3Ccircle cx='55.6' cy='55.6' r='4.5' fill='%232BB8D4'/%3E%3Ccircle cx='40' cy='62' r='4.5' fill='%238A5CD4'/%3E%3Ccircle cx='24.4' cy='55.6' r='4.5' fill='%23E63B7A'/%3E%3Ccircle cx='18' cy='40' r='4.5' fill='%23F5C518'/%3E%3Ccircle cx='24.4' cy='24.4' r='4.5' fill='%235FB94A'/%3E%3Ccircle cx='40' cy='40' r='9' fill='%23c0411a'/%3E%3C/svg%3E";
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "icon");
      link.setAttribute("type", "image/svg+xml");
      document.head.appendChild(link);
    }
    const robotViews = view === "jarvis" || view === "chat";
    link.setAttribute("href", robotViews ? ROBOT : SUN);
  }, [view]);
  useEffect(() => {
    const TITLES = {
      projet: "JDM Agent",
      explorer: "JDM Agent - Explorer",
      claim: "JDM Agent - Claim",
      subgraph: "JDM Agent - Sous-graphe",
      chatbot: "JDM Agent - Chatbot",
      chat: "Jarvis : Chat",
      productions: "JDM Agent - Productions",
      outils: "JDM Agent - Outils",
      aide: "JDM Agent - Aide",
      jarvis: "Jarvis : Orchestrateur"
    };
    document.title = TITLES[view] || "JDM Agent";
  }, [view]);
  useEffect(() => {
    var _a, _b;
    if (typeof window !== "undefined" && window.__jdmJarvisStore) {
      (_b = (_a = window.__jdmJarvisStore).bootReconcile) == null ? void 0 : _b.call(_a);
    }
  }, []);
  useEffect(() => {
    const onGoToSup = () => setView("jarvis");
    window.addEventListener("jdm-goto-jarvis-supervision", onGoToSup);
    return () => window.removeEventListener("jdm-goto-jarvis-supervision", onGoToSup);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      const r = _parseRoute(window.location.pathname);
      if (r.view === "jarvis" && r.sub) {
        window.__jdmPendingPayload = window.__jdmPendingPayload || {};
        window.__jdmPendingPayload.jarvis = Object.assign(
          {},
          window.__jdmPendingPayload.jarvis || {},
          { flow: r.sub }
        );
      }
      setView(r.view);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    if (typeof _tabFromHash !== "function") return void 0;
    const onHash = () => {
      try {
        if (_tabFromHash()) setView((v) => v === "outils" ? v : "outils");
      } catch (e) {
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      if (d.term) window.__jdmPendingTerm = d.term;
      if (d.payload && d.view) {
        window.__jdmPendingPayload = window.__jdmPendingPayload || {};
        window.__jdmPendingPayload[d.view] = d.payload;
      }
      if (d.view && VIEWS[d.view]) setView(d.view);
    };
    window.addEventListener("jdm:goto", handler);
    return () => window.removeEventListener("jdm:goto", handler);
  }, []);
  useEffect(() => {
    let pendingG = false;
    let pendingGTimer = null;
    const SHORTCUTS_G = {
      "KeyE": "explorer",
      "KeyC": "claim",
      "KeyS": "subgraph",
      "KeyA": "chatbot",
      "KeyJ": "jarvis",
      "KeyP": "productions",
      "KeyO": "outils",
      "KeyH": "aide"
    };
    const isTyping = (target) => {
      if (!target) return false;
      const tag = (target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (target.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (e.code === "KeyG" && !pendingG) {
        pendingG = true;
        clearTimeout(pendingGTimer);
        pendingGTimer = setTimeout(() => {
          pendingG = false;
        }, 1200);
        return;
      }
      if (pendingG && SHORTCUTS_G[e.code]) {
        e.preventDefault();
        pendingG = false;
        clearTimeout(pendingGTimer);
        setView(SHORTCUTS_G[e.code]);
        return;
      }
      if (e.key === "?" && !e.shiftKey === false) {
        e.preventDefault();
        setView("aide");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(pendingGTimer);
    };
  }, []);
  const VIEWS = {
    projet: /* @__PURE__ */ React.createElement(ViewProjet, { goto: setView }),
    explorer: /* @__PURE__ */ React.createElement(ViewExplorer, null),
    claim: /* @__PURE__ */ React.createElement(ViewClaim, null),
    subgraph: /* @__PURE__ */ React.createElement(ViewSubgraph, null),
    chatbot: /* @__PURE__ */ React.createElement(ViewAgent, null),
    chat: /* @__PURE__ */ React.createElement(ViewChat, null),
    jarvis: /* @__PURE__ */ React.createElement(ViewJarvis, null),
    productions: /* @__PURE__ */ React.createElement(ViewProductions, null),
    outils: /* @__PURE__ */ React.createElement(ViewOutils, null),
    aide: /* @__PURE__ */ React.createElement(ViewAide, null)
  };
  const accentOptions = ["#c0411a", "#1f97b1", "#c83a73", "#4ea63c", "#7a4fbe", "#d96810"];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
    TopNav,
    {
      active: view,
      setActive: setView,
      theme: tweaks.theme,
      setTheme: (t) => setTweak("theme", t),
      accent: tweaks.accent,
      cycleAccent: () => {
        const cur = tweaks.accent || TWEAK_ACCENTS[0];
        const i = TWEAK_ACCENTS.indexOf(cur);
        const next = TWEAK_ACCENTS[(i + 1) % TWEAK_ACCENTS.length];
        setTweak("accent", next);
      },
      hubText: view === "outils" ? "Hub de services : tâches de traitement automatique du langage" : void 0
    }
  ), /* @__PURE__ */ React.createElement("main", null, VIEWS[view]), /* @__PURE__ */ React.createElement(TweaksPanel, { title: "Tweaks" }, /* @__PURE__ */ React.createElement(TweakSection, { label: "Direction visuelle" }, /* @__PURE__ */ React.createElement(
    TweakRadio,
    {
      label: "Thème",
      value: tweaks.theme,
      onChange: (v) => setTweak("theme", v),
      options: [
        { value: "paper", label: "Paper" },
        { value: "lab", label: "Lab" }
      ]
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 11,
    color: "var(--ink-3)",
    marginTop: 6,
    lineHeight: 1.5
  } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "Paper"), " — sobre, crème, à la claude.ai.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-2)" } }, "Lab"), " — dashboard dense, monospace, fond sombre.")), /* @__PURE__ */ React.createElement(TweakSection, { label: "Accent" }, /* @__PURE__ */ React.createElement(
    TweakColor,
    {
      label: "Couleur d'accent",
      value: tweaks.accent || "#c0411a",
      onChange: (v) => setTweak("accent", v),
      options: accentOptions
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 6 } }, "Remplace l'accent natif du thème par cette couleur.")), /* @__PURE__ */ React.createElement(TweakSection, { label: "Navigation rapide" }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4
  } }, [
    ["projet", "Projet"],
    ["explorer", "Explorer"],
    ["claim", "Claim"],
    ["subgraph", "Sous-graphe"],
    ["chatbot", "Chatbot LLM"],
    ["jarvis", "Jarvis"],
    ["productions", "Productions"],
    ["aide", "Aide"]
  ].map(([id, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: id,
      onClick: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("jdm-nav-reset", { detail: { view: id } }));
        }
        setView(id);
        if (typeof window !== "undefined") {
          setTimeout(() => window.dispatchEvent(
            new CustomEvent("jdm-nav-reset", { detail: { view: id } })
          ), 0);
        }
      },
      style: {
        padding: "6px 10px",
        background: view === id ? "var(--accent)" : "var(--bg-elev)",
        color: view === id ? "#fff" : "var(--ink)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        fontFamily: "inherit",
        fontSize: 12,
        cursor: "pointer",
        textAlign: "left"
      }
    },
    label
  ))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
