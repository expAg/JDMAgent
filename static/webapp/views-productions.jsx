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
        desc="Fichiers .enrich / .audit / .err / .stat / visualisations produits par les flux Jarvis. Liste, prévisualisation, téléchargement, soumission LLMDrops."
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
