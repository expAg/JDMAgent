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

      {/* Oldies (archives > 48h) */}
      {oldies.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <ProductionsSection
            title={`Archives oldies · ${oldies.length}`}
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
      )}

      {/* Section admin — réservée ?admin=1 */}
      <div className="admin-only" style={{ marginTop: 32 }}>
        <AdminPanel />
      </div>

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
        <h2 className="display" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 600, margin: 0,
        }}>{title}</h2>
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
  const extColor = {
    'enrich':  'var(--jdm-magenta)',
    'audit':   'var(--jdm-cyan)',
    'err':     'var(--jdm-orange)',
    'stat':    'var(--jdm-violet)',
    'html':    'var(--jdm-green)',
  }[file.ext] || 'var(--ink-3)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--line-soft)',
      background: file.submitted ? 'rgba(78,166,60,0.06)' : 'transparent',
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

// ─── Panneau admin — réservé ?admin=1 ─────────────────────────

function AdminPanel() {
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    fetch('api/admin/info')
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setInfo({ error: 'Impossible de charger les infos.' }));
  }, []);

  const doExport = async () => {
    if (!password) { setExportError('Mot de passe requis.'); return; }
    setBusy(true); setExportError(''); setExported(null);
    try {
      const r = await fetch('api/admin/export-secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.status === 401) { setExportError('Mot de passe invalide.'); return; }
      if (r.status === 503) {
        setExportError('Export désactivé côté serveur (EXPORT_SECRETS_PASSWORD non défini).');
        return;
      }
      if (!r.ok) { setExportError(`HTTP ${r.status}`); return; }
      const d = await r.json();
      setExported(d.vars || {});
    } catch (e) {
      setExportError(String(e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const downloadEnv = () => {
    if (!exported) return;
    const lines = Object.entries(exported).map(([k, v]) => `${k}=${v}`);
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '.env.export';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      </div>

      {/* Diag info */}
      {info && !info.error && (
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
            {info.export_secrets_enabled ? 'activé (EXPORT_SECRETS_PASSWORD défini)' : 'désactivé'}
          </strong></div>
          <div style={{ marginTop: 8 }}>Env vars présentes ({(info.env_vars_present || []).length}) :</div>
          <div style={{ paddingLeft: 12, color: 'var(--ink-2)' }}>
            {(info.env_vars_present || []).join(', ') || '—'}
          </div>
        </div>
      )}

      {/* Export secrets + édition + cache clear */}
      {info && info.export_secrets_enabled && (
        <AdminSecretsSection password={password} setPassword={setPassword}
          doExport={doExport} busy={busy} exported={exported}
          exportError={exportError} downloadEnv={downloadEnv} />
      )}
    </Card>
  );
}

function AdminSecretsSection({ password, setPassword, doExport, busy,
                               exported, exportError, downloadEnv }) {
  const [edits, setEdits] = useState({});
  const [editMsg, setEditMsg] = useState('');
  const [cacheMsg, setCacheMsg] = useState('');

  const setOne = (k, v) => setEdits(e => ({ ...e, [k]: v }));

  const submitEdits = async () => {
    setEditMsg('');
    const vars = Object.fromEntries(Object.entries(edits).filter(([_, v]) => v !== undefined));
    if (Object.keys(vars).length === 0) { setEditMsg('Rien à modifier.'); return; }
    try {
      const r = await fetch('api/admin/env-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, vars }),
      });
      const d = await r.json();
      if (r.ok) {
        setEditMsg(`✓ ${(d.updated || []).length} mise(s) à jour. .env persisté : ${d.persisted_to_dotenv}.`);
        setEdits({});
      } else {
        setEditMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setEditMsg(`✗ ${e.message || e}`);
    }
  };

  const clearCache = async () => {
    setCacheMsg('');
    if (!confirm('Vider tout le cache disque JDM ?')) return;
    try {
      const r = await fetch('api/admin/cache-clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (r.ok) {
        setCacheMsg(`✓ ${d.deleted_files} fichier(s) supprimé(s) dans ${d.cache_dir}`);
      } else {
        setCacheMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setCacheMsg(`✗ ${e.message || e}`);
    }
  };

  // Variables modifiables (whitelist alignée backend _EXPORTABLE_ENV_VARS)
  const EDITABLE_VARS = [
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_API_KEYS',
    'JDM_DROPS_API_KEY', 'JDM_DROPS_URL', 'LLM_PROVIDER', 'LLM_MODEL',
  ];

  return (
    <>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 8,
      }}>Authentification</div>
      <Input value={password} onChange={setPassword}
        placeholder="Mot de passe (EXPORT_SECRETS_PASSWORD)" mono />
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, marginBottom: 16 }}>
        Requis pour toutes les actions ci-dessous (export, modif env, clear cache).
      </div>

      {/* Export */}
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 8,
      }}>1 · Export des secrets (.env)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button size="sm" onClick={doExport} disabled={busy || !password}>
          {busy ? '…' : 'Exporter'}
        </Button>
        {exported && (
          <Button size="sm" variant="secondary" onClick={downloadEnv}>
            ⬇ Télécharger .env
          </Button>
        )}
      </div>
      {exportError && (
        <div style={{
          marginBottom: 8, padding: 10,
          background: 'rgba(200,58,115,0.08)',
          border: '1px solid var(--jdm-magenta)',
          borderRadius: 'var(--radius)',
          color: 'var(--jdm-magenta)', fontSize: 12,
        }}>{exportError}</div>
      )}
      {exported && (
        <div style={{
          marginBottom: 16, padding: 12,
          background: 'var(--bg-elev)', borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
          maxHeight: 200, overflow: 'auto',
        }}>
          {Object.entries(exported).map(([k, v]) => (
            <div key={k} style={{ wordBreak: 'break-all' }}>
              <strong style={{ color: 'var(--accent)' }}>{k}</strong>
              =<span style={{ color: 'var(--ink-2)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Édition env */}
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 8,
      }}>2 · Modifier les variables d'environnement</div>
      <div style={{
        background: 'var(--bg-elev)', borderRadius: 'var(--radius)',
        padding: 12, marginBottom: 8,
      }}>
        {EDITABLE_VARS.map(k => (
          <div key={k} style={{
            display: 'grid', gridTemplateColumns: '160px 1fr',
            gap: 8, alignItems: 'center', marginBottom: 6,
          }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{k}</div>
            <Input value={edits[k] || ''}
              onChange={(v) => setOne(k, v)}
              placeholder="nouvelle valeur (vide = laisse l'actuelle)" mono />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button size="sm" onClick={submitEdits} disabled={!password}>
          ✓ Appliquer les modifications
        </Button>
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

      {/* Cache clear */}
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 8,
      }}>3 · Cache disque JDM</div>
      <Button size="sm" variant="secondary" onClick={clearCache} disabled={!password}>
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
  );
}

window.ViewProductions = ViewProductions;
