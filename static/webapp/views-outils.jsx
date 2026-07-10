// View: Outils — hub TALN. Sous-onglets par tâche, tous sous les couleurs du
// site. Chaque tâche appelle un proxy backend /api/tools/<tâche> qui relaie vers
// un service séparé (coref/syntaxe locaux ; génitif/analogies/jdmrel externes).
// Le backend renvoie { ok, service, data|error } → jamais d'erreur brute ici.

const OUTILS_TABS = [
  { id: 'coref',    label: 'Coréférence' },
  { id: 'syntax',   label: 'Analyse syntaxique' },
  { id: 'wsd',      label: 'Désambiguïsation (WSD)' },
  { id: 'thematic', label: 'Analyse thématique' },
  { id: 'polarity', label: 'Analyse de polarité' },
  { id: 'genitive', label: 'Génitifs « A de B »' },
  { id: 'analogy',  label: 'Analogies' },
  { id: 'jdmrel',   label: 'Relations sémantiques (JDM)' },
];

// Modèles proposés par onglet (liste déroulante). Placeholders pour l'instant —
// on affinera les vrais modèles disponibles plus tard. Le `value` choisi est
// transmis au backend (payload.model) ; les services l'ignorent tant qu'ils ne
// le gèrent pas. {value, label}.
const TOOL_MODELS = {
  coref:    [{ value: 'corpipe25',      label: 'CorPipe 25 — mT5-large (défaut)' }],
  syntax:   [{ value: 'udpipe2-fr-gsd', label: 'UDPipe 2 — french-gsd (défaut)' }],
  wsd:      [{ value: 'default',        label: '(par défaut)' }],
  thematic: [{ value: 'default',        label: '(par défaut)' }],
  polarity: [{ value: 'default',        label: '(par défaut)' }],
  genitive: [{ value: 'default',        label: '(par défaut)' }],
  analogy:  [{ value: 'default',        label: '(par défaut)' }],
  jdmrel:   [{ value: 'default',        label: '(par défaut)' }],
};

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

// Poste un payload au proxy et renvoie { ok, data|error }. Enveloppe unifiée.
async function _callTool(path, payload) {
  try {
    const res = await fetch('api/tools/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// Sélecteur de modèle (liste déroulante) — commun à tous les onglets.
function ModelPicker({ value, onChange, options }) {
  if (!options || options.length === 0) return null;
  return (
    <div style={{ marginBottom: 12, maxWidth: 420 }}>
      <Field label="Modèle">
        <Select value={value} options={options} onChange={onChange} />
      </Field>
    </div>
  );
}

// Grille verticale d'un panneau — minmax(0,1fr) empêche un enfant large (le SVG
// des dépendances) de faire déborder la page horizontalement.
function panelGrid() {
  return { display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' };
}

// Palette des chaînes de coréférence (couleurs signature du site).
const _COREF_COLORS = [
  'var(--jdm-magenta)', 'var(--jdm-cyan)', 'var(--jdm-green)',
  'var(--jdm-violet)', 'var(--jdm-orange)', 'var(--jdm-yellow)',
];

// Phrases d'exemple cliquables (anaphore). La 1re sert de texte par défaut.
const COREF_EXAMPLES = [
  "La chienne de la voisine est en chaleur. Elle braille sans arrêt. Pourtant elle lui donne la pilule.",
  "Le chien de la voisine est tombé dans le puits. Il a aboyé toute la nuit. Il est très profond. Il l'a beaucoup ennuyée.",
  "Julien a appelé son frère parce qu'il devait lui rendre sa clé. Il l'avait oubliée chez lui hier soir.",
];

// ───────── Coréférence ─────────
function CorefPanel() {
  const [text, setText] = React.useState(COREF_EXAMPLES[0]);
  const [model, setModel] = React.useState(TOOL_MODELS.coref[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  // `override` : texte explicite (clic sur un exemple) — évite la course avec
  // le setState async de setText.
  const run = async (override) => {
    const t = (typeof override === 'string') ? override : text;
    setLoading(true); setRes(null);
    setRes(await _callTool('coref', { text: t, model })); setLoading(false);
  };

  const chainOf = {};
  if (res && res.ok && res.data && Array.isArray(res.data.chains)) {
    res.data.chains.forEach((c) => {
      (c.mentions || []).forEach((span) => {
        (span || []).forEach((i) => { chainOf[i] = c.id; });
      });
    });
  }

  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        placeholder="Colle un texte français à résoudre…"
        model={model} setModel={setModel} models={TOOL_MODELS.coref} />
      {/* Exemples cliquables (anaphore) : clic = remplit + lance */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 4 }}>Exemples :</span>
        {COREF_EXAMPLES.map((ex, i) => (
          <button key={i} className="focus-ring" title={ex}
            onClick={() => { setText(ex); run(ex); }}
            style={{
              padding: '4px 10px', maxWidth: 360,
              background: 'transparent', border: '1px solid var(--line)',
              borderRadius: 999, color: 'var(--ink-2)', fontSize: 11,
              cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
            {ex.length > 46 ? ex.slice(0, 45) + '…' : ex}
          </button>
        ))}
      </div>
      {res && !res.ok && <ToolNotice msg={res.error} tone="error" />}
      {res && res.ok && res.data && (
        <Card padding={18}>
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
  const [model, setModel] = React.useState(TOOL_MODELS.syntax[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool('syntax', { text, model })); setLoading(false);
  };

  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        placeholder="Une phrase à analyser en dépendances…"
        model={model} setModel={setModel} models={TOOL_MODELS.syntax} />
      {res && !res.ok && <ToolNotice msg={res.error} tone="error" />}
      {res && res.ok && res.data && res.data.ud_svg && (
        <Card padding={18}><UdSvg svg={res.data.ud_svg} /></Card>
      )}
    </div>
  );
}

// SVG displaCy (thémé clair) — cadre à fond blanc, borné à la largeur dispo,
// scroll horizontal interne (les arbres longs ne débordent plus la page).
function UdSvg({ svg }) {
  return (
    <div style={{
      marginTop: 14, background: '#ffffff', borderRadius: 'var(--radius)',
      border: '1px solid var(--line)', padding: 12,
      maxWidth: '100%', overflowX: 'auto',
    }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Rendu générique d'un résultat JSON (onglets sans rendu dédié).
function JsonResult({ data }) {
  return (
    <Card padding={18}>
      <pre className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', margin: 0, maxWidth: '100%', overflowX: 'auto' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}

// ───────── Génitifs « A de B » ─────────
function GenitivePanel() {
  const [phrase, setPhrase] = React.useState("pied de la table");
  const [model, setModel] = React.useState(TOOL_MODELS.genitive[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool('genitive', { phrase, model })); setLoading(false);
  };
  return (
    <div style={panelGrid()}>
      <ToolForm text={phrase} setText={setPhrase} run={run} loading={loading}
        rows={2} placeholder="Un syntagme génitif « A de B » (ex. pied de la table)…"
        model={model} setModel={setModel} models={TOOL_MODELS.genitive} />
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {res && res.ok && res.data && <JsonResult data={res.data} />}
    </div>
  );
}

// ───────── Panneau générique « texte → résultat » ─────────
// Mutualise les outils qui prennent un texte + un modèle et rendent un résultat
// JSON (WSD, thématique, polarité, relations JDM…). Un seul site : ajouter un
// outil de ce type = une entrée OUTILS_TABS + TOOL_MODELS + un rendu ci-dessous.
function TextToolPanel({ path, models, defaultText, placeholder, rows = 4, renderData }) {
  const [text, setText] = React.useState(defaultText || '');
  const [model, setModel] = React.useState(models[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool(path, { text, model })); setLoading(false);
  };
  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        rows={rows} placeholder={placeholder}
        model={model} setModel={setModel} models={models} />
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {res && res.ok && res.data && (
        renderData ? renderData(res.data) : <JsonResult data={res.data} />
      )}
    </div>
  );
}

// Rendu des triplets extraits (onglet Relations sémantiques JDM).
function JdmRelResult({ data }) {
  const trips = (data && data.triplets) || [];
  if (!trips.length) {
    return <ToolNotice tone="warn"
      msg="Aucune relation détectée (patrons morpho-lexicaux + lexique JeuxDeMots)." />;
  }
  return (
    <Card padding={18}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        {trips.length} relation(s) extraite(s)
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {trips.map((t, i) => (
          <div key={i} title={t.pattern} style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '8px 10px', background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
          }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>{t.source}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{t.relation}</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>{t.target}</span>
            {t.category && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>{t.category}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ───────── Analogies ─────────
function AnalogyPanel() {
  const [a, setA] = React.useState('Paris');
  const [b, setB] = React.useState('France');
  const [c, setC] = React.useState('Rome');
  const [model, setModel] = React.useState(TOOL_MODELS.analogy[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool('analogy', { a, b, c, model })); setLoading(false);
  };
  return (
    <div style={panelGrid()}>
      <Card padding={18}>
        <ModelPicker value={model} onChange={setModel} options={TOOL_MODELS.analogy} />
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
      {res && res.ok && res.data && <JsonResult data={res.data} />}
    </div>
  );
}

// Formulaire textarea + sélecteur de modèle + bouton, mutualisé.
function ToolForm({ text, setText, run, loading, placeholder, rows = 4, model, setModel, models }) {
  return (
    <Card padding={18}>
      <ModelPicker value={model} onChange={setModel} options={models} />
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
        title="Outils"
        desc="Démonstrateurs d'outils de traitement automatique des langues, réunis ici sous une même interface. Chaque outil est un service à part, branché progressivement."
      />

      {/* Barre de sous-onglets (sans glyphs) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {OUTILS_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className="focus-ring"
              style={{
                padding: '8px 14px',
                background: active ? 'var(--accent)' : 'var(--bg-elev)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'coref'    && <CorefPanel />}
      {tab === 'syntax'   && <SyntaxPanel />}
      {tab === 'wsd'      && (
        <TextToolPanel path="wsd" models={TOOL_MODELS.wsd}
          defaultText="L'avocat a plaidé toute la matinée, puis il a mangé un avocat bien mûr."
          placeholder="Un texte à désambiguïser (le bon sens de chaque mot polysémique)…" />
      )}
      {tab === 'thematic' && (
        <TextToolPanel path="thematic" models={TOOL_MODELS.thematic}
          defaultText="Le réchauffement climatique menace la biodiversité et l'agriculture."
          placeholder="Un texte à analyser thématiquement…" />
      )}
      {tab === 'polarity' && (
        <TextToolPanel path="polarity" models={TOOL_MODELS.polarity}
          defaultText="Ce film était vraiment excellent, je l'ai adoré du début à la fin."
          placeholder="Un texte dont analyser la polarité (positif / négatif)…" />
      )}
      {tab === 'genitive' && <GenitivePanel />}
      {tab === 'analogy'  && <AnalogyPanel />}
      {tab === 'jdmrel'   && (
        <TextToolPanel path="jdmrel" models={TOOL_MODELS.jdmrel}
          defaultText="La pomme de terre est une sorte de légume. La grippe provoque de la fièvre. La roue fait partie de la voiture."
          placeholder="Un texte à analyser en relations sémantiques JDM (patrons + JDM)…"
          renderData={(d) => <JdmRelResult data={d} />} />
      )}
    </PageShell>
  );
}

window.ViewOutils = ViewOutils;
