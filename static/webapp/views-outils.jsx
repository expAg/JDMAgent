// View: Outils — hub TALN. Sous-onglets par tâche, tous sous les couleurs du
// site. Chaque tâche appelle un proxy backend /api/tools/<tâche> qui relaie vers
// un service séparé (coref/syntaxe locaux ; génitif/analogies externes). Le
// backend renvoie { ok, service, data|error } → jamais d'erreur brute ici.

const OUTILS_TABS = [
  { id: 'coref',    label: 'Coréférence',       icon: '🔗' },
  { id: 'syntax',   label: 'Analyse syntaxique', icon: '🌳' },
  { id: 'genitive', label: 'Génitifs « A de B »', icon: '🧩' },
  { id: 'analogy',  label: 'Analogies',          icon: '⚖️' },
];

// Palette de chaînes (coréférence) — reprend les couleurs signature du site.
const _COREF_COLORS = [
  'var(--jdm-magenta)', 'var(--jdm-cyan)', 'var(--jdm-green)',
  'var(--jdm-violet)', 'var(--jdm-orange)', 'var(--jdm-yellow)',
];

// Encart d'erreur / placeholder homogène (service down ou non branché).
function ToolNotice({ msg, tone }) {
  const color = tone === 'error' ? 'var(--jdm-magenta)' : 'var(--jdm-orange)';
  return (
    <div style={{
      padding: 16, borderRadius: 'var(--radius)',
      background: 'var(--bg-elev)', border: `1px dashed ${color}`,
      color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5,
    }}>
      {tone === 'error' ? '⚠️ ' : 'ℹ️ '}{msg}
    </div>
  );
}

// Poste un texte au proxy et renvoie { ok, data|error }. Enveloppe unifiée pour
// tous les onglets — coref/syntaxe marchent tout de suite, génitif/analogies
// renvoient le message « non branché » tant que leur URL n'est pas configurée.
async function _callTool(path, payload) {
  try {
    const res = await fetch('api/tools/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    return j;
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// ───────── Coréférence ─────────
function CorefPanel() {
  const [text, setText] = React.useState(
    "Marie a appelé son frère parce qu'elle voulait lui rendre les clés. "
    + "Il les avait oubliées chez elle hier soir.");
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    setLoading(true); setRes(null);
    const j = await _callTool('coref', { text });
    setRes(j); setLoading(false);
  };

  // token index → id de chaîne (pour le surlignage).
  const chainOf = {};
  if (res && res.ok && res.data && Array.isArray(res.data.chains)) {
    res.data.chains.forEach((c) => {
      (c.mentions || []).forEach((span) => {
        (span || []).forEach((i) => { chainOf[i] = c.id; });
      });
    });
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        placeholder="Colle un texte français à résoudre…" />
      {res && !res.ok && <ToolNotice msg={res.error} tone="error" />}
      {res && res.ok && res.data && (
        <Card padding={18}>
          {/* Texte surligné par chaîne */}
          <div style={{ fontSize: 15, lineHeight: 2, marginBottom: 16 }}>
            {(res.data.tokens || []).map((t, i) => {
              const cid = chainOf[i];
              const col = cid != null ? _COREF_COLORS[cid % _COREF_COLORS.length] : null;
              return (
                <React.Fragment key={i}>
                  <span style={col ? {
                    background: `color-mix(in srgb, ${col} 22%, transparent)`,
                    borderBottom: `2px solid ${col}`,
                    borderRadius: 3, padding: '1px 2px',
                  } : undefined}>{t.text}</span>
                  {t.ws}
                </React.Fragment>
              );
            })}
          </div>
          {/* Liste des chaînes */}
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            {(res.data.chains || []).length} chaîne(s) de coréférence
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(res.data.chains || []).map((c) => {
              const col = _COREF_COLORS[c.id % _COREF_COLORS.length];
              return (
                <span key={c.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999,
                  background: `color-mix(in srgb, ${col} 15%, transparent)`,
                  border: `1px solid ${col}`, fontSize: 12, color: 'var(--ink)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                  {c.label}{c.cat ? ` · ${c.cat}` : ''} ({(c.mentions || []).length})
                </span>
              );
            })}
          </div>
          {res.data.ud_svg && <UdSvg svg={res.data.ud_svg} />}
        </Card>
      )}
    </div>
  );
}

// ───────── Analyse syntaxique ─────────
function SyntaxPanel() {
  const [text, setText] = React.useState("Le chat de la voisine dort sur le canapé.");
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    setLoading(true); setRes(null);
    const j = await _callTool('syntax', { text });
    setRes(j); setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        placeholder="Une phrase à analyser en dépendances…" />
      {res && !res.ok && <ToolNotice msg={res.error} tone="error" />}
      {res && res.ok && res.data && res.data.ud_svg && (
        <Card padding={18}><UdSvg svg={res.data.ud_svg} /></Card>
      )}
    </div>
  );
}

// SVG displaCy (thémé clair) — rendu dans un cadre à fond blanc, scroll horizontal.
function UdSvg({ svg }) {
  return (
    <div style={{
      marginTop: 14, background: '#ffffff', borderRadius: 'var(--radius)',
      border: '1px solid var(--line)', padding: 12, overflowX: 'auto',
    }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// ───────── Génitifs « A de B » (placeholder branché) ─────────
function GenitivePanel() {
  const [phrase, setPhrase] = React.useState("pied de la table");
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    const j = await _callTool('genitive', { phrase });
    setRes(j); setLoading(false);
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <ToolForm text={phrase} setText={setPhrase} run={run} loading={loading}
        rows={2} placeholder="Un syntagme génitif « A de B » (ex. pied de la table)…" />
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {res && res.ok && res.data && (
        <Card padding={18}>
          <pre className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(res.data, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}

// ───────── Analogies (placeholder branché) ─────────
function AnalogyPanel() {
  const [a, setA] = React.useState('Paris');
  const [b, setB] = React.useState('France');
  const [c, setC] = React.useState('Rome');
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    const j = await _callTool('analogy', { a, b, c });
    setRes(j); setLoading(false);
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card padding={18}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <Field label="A"><Input value={a} onChange={setA} mono /></Field>
          <Field label="est à B"><Input value={b} onChange={setB} mono /></Field>
          <Field label="ce que C"><Input value={c} onChange={setC} mono /></Field>
          <Button onClick={run} disabled={loading}>{loading ? '…' : 'Expliquer'}</Button>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
          A est à B ce que C est à … ?
        </div>
      </Card>
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {res && res.ok && res.data && (
        <Card padding={18}>
          <pre className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(res.data, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}

// Formulaire textarea + bouton, mutualisé.
function ToolForm({ text, setText, run, loading, placeholder, rows = 4 }) {
  return (
    <Card padding={18}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical',
          background: 'var(--bg-elev)', color: 'var(--ink)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13,
          lineHeight: 1.5,
        }} />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={run} disabled={loading || !text.trim()}>
          {loading ? 'Analyse…' : 'Analyser'}
        </Button>
      </div>
    </Card>
  );
}

function ViewOutils() {
  const [tab, setTab] = React.useState('coref');
  return (
    <PageShell>
      <SectionTitle
        kicker="Hub · TALN"
        title="Outils"
        desc="Démonstrateurs d'outils de traitement automatique des langues, réunis ici sous une même interface. Chaque outil est un service à part, branché progressivement."
      />

      {/* Barre de sous-onglets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {OUTILS_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className="focus-ring"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                background: active ? 'var(--accent)' : 'var(--bg-elev)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}>
              <span>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'coref'    && <CorefPanel />}
      {tab === 'syntax'   && <SyntaxPanel />}
      {tab === 'genitive' && <GenitivePanel />}
      {tab === 'analogy'  && <AnalogyPanel />}
    </PageShell>
  );
}

window.ViewOutils = ViewOutils;
