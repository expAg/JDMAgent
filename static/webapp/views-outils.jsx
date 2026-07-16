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
  { id: 'jdmrel',   label: 'Extraction de relations' },
  { id: 'semviz',   label: 'Visualisation sémantique', disabled: true },
  { id: 'genitive', label: 'Génitifs « A de B »' },
  { id: 'analogy',  label: 'Analogies',                disabled: true },
];

// Modèles proposés par onglet (liste déroulante). Placeholders pour l'instant —
// on affinera les vrais modèles disponibles plus tard. Le `value` choisi est
// transmis au backend (payload.model) ; les services l'ignorent tant qu'ils ne
// le gèrent pas. {value, label}.
const TOOL_MODELS = {
  coref:    [{ value: 'corpipe25',      label: '(par défaut)' }],
  syntax:   [{ value: 'udpipe2-fr-gsd', label: 'UDPipe 2 — french-gsd (défaut)' }],
  wsd:      [{ value: 'jdm-raffinements', label: 'JDM WSD' }],
  thematic: [{ value: 'jdm-domain',     label: 'JDM DOMAIN' }],
  polarity: [{ value: 'jdm-infopot',    label: 'JDM POL' }],
  genitive: [{ value: 'grasp-it',       label: 'GRASP-IT' }],
  analogy:  [{ value: 'default',        label: '(par défaut)' }],
  jdmrel:   [{ value: 'default',        label: 'JDM EXTRACT' }],
};

// Texte d'exemple chargé par défaut dans l'onglet extraction JDM (biographie
// Lazy Lester — banc d'essai réel discuté avec l'utilisateur).
const JDMREL_DEFAULT = `Leslie Johnson (20 juin 1933 - 22 août 2018 (à 85 ans)), mieux connu sous le nom de Lazy Lester, est un musicien de blues américain qui chante, joue de l'harmonica et de la guitare. Au cours d'une carrière s'étendant des années 1950 à 2018, il a été un pionnier du swamp blues [1] et a également joué du blues harmonica, du rythme and blues et du blues de Louisiane[2].

Mieux connu pour ses succès régionaux enregistrés avec les Excello Records d'Ernie Young, basé à Nashville, Lester a également contribué aux morceaux enregistrés par d'autres artistes Excello, notamment Slim Harpo, Lightnin' Slim et Katie Webster . Des reprises de ses chansons ont été enregistrées par (entre autres) les Kinks, les Flamin' Groovies, Freddy Fender, Dwight Yoakam, Dave Edmunds, Raful Neal, Anson Funderburgh et les Fabulous Thunderbirds . Après son comeback (depuis la fin des années 1980), il enregistre de nouveaux albums grâce à Mike Buck, Sue Foley, Gene Taylor, Kenny Neal, Lucky Peterson et Jimmie Vaughan.

Leslie Johnson a commencé à jouer de la guitare vers l'âge de 11 ans et à se produire à l'adolescence autour de Baton Rouge avec Raful Neal, co-fondant plus tard les Rhythm Rockers. Au milieu des années 1950, Lester était en marge de la scène blues de Louisiane. Lorsque Buddy Guy part pour Chicago, en 1957, Lester le remplace, à la guitare, dans un groupe local – même si, à cette époque, Lester ne possède pas un tel instrument.

La carrière de Lester décolle lorsqu'il rencontre Lightnin' Slim dans un bus transportant Slim à une session d'enregistrement Excello. Au studio, l'harmoniciste prévu ne se présente pas. Slim et Lester passent l'après-midi à essayer en vain de le retrouver, lorsque Lester se propose de le remplacer. Le travail de Lester lors de cette première session Lightnin' Slim conduit le producteur Jay Miller à enregistrer Lester en tant qu'artiste solo. Miller a surnommé Lester « Lazy Lester » en raison de son style laconique et décontracté.

À la fin des années 1960, il abandonne la musique, travaillant manuellement et s'adonnant à son passe-temps favori : la pêche. Lester déménage finalement à Pontiac, Michigan, vivant avec la sœur de Slim Harpo. En 1971, Fred Reif organise un concert de Lightnin' Slim au Festival Folk de l'Université de Chicago, et amène Lester de Louisiane pour l'accompagner. Des années plus tard, Reif orchestre son comeback.

En septembre 2002, la Boston Blues Society lui décerne un Lifetime Achievement Award. En 2003, Martin Scorsese inclut Lester dans son concert hommage au blues au Radio City Music Hall. Lester vit alors à Paradise, en Californie, avec sa petite amie et apparaît dans le film documentaire de 2015 I Am the Blues. Lester continue à se produire jusqu'en 2018, retournant souvent en Louisiane. Lester décède d'un cancer le 22 août 2018, à l'âge de 85 ans.`;

// Texte d'exemple pour l'analyse thématique (domaines JeuxDeMots variés).
const THEMATIC_DEFAULT = "Le guitariste et le pianiste ont joué une symphonie lors du concert. Le chef d'orchestre a dirigé les musiciens sur la scène du théâtre, et le public a applaudi la mélodie. Plus tard, l'équipe a marqué un but au stade : l'attaquant a dribblé le défenseur avant de tirer, et l'arbitre a sifflé la fin du match.";

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

// Flux NDJSON : appelle onEvent(obj) pour chaque ligne JSON reçue (temps réel).
async function _streamTool(path, payload, onEvent) {
  const res = await fetch('api/tools/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.body) { const j = await res.json(); onEvent(j); return; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) { try { onEvent(JSON.parse(line)); } catch (e) { /* ligne partielle */ } }
    }
  }
  const rest = buf.trim();
  if (rest) { try { onEvent(JSON.parse(rest)); } catch (e) { /* ignore */ } }
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
  const [phrase, setPhrase] = React.useState("roue du vélo");
  const [model, setModel] = React.useState(TOOL_MODELS.genitive[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool('genitive', { phrase, model })); setLoading(false);
  };
  const d = (res && res.ok) ? res.data : null;
  return (
    <div style={panelGrid()}>
      <ToolForm text={phrase} setText={setPhrase} run={run} loading={loading}
        rows={2} placeholder="Un syntagme génitif « A de B » (ex. roue du vélo)…"
        model={model} setModel={setModel} models={TOOL_MODELS.genitive} />
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {d && (
        <Card padding={18}>
          {/* Couche DIRECTE : relations JDM A↔B qui concernent les génitifs */}
          {d.direct && d.direct.length > 0 && (
            <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--jdm-green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>relations JeuxDeMots directes (A↔B)</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {d.direct.map((x, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--jdm-green)' : 'var(--ink-2)', minWidth: 130 }}>{x.relation}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>« {x.nl} »</span>
                    <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)' }}>{x.via} ({x.weight})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prédiction du modèle GRASP-IT (pour les paires inconnues de JDM) */}
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>prédiction du modèle</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{d.relation}</span>
            {d.top && d.top[0] && (
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{Math.round(d.top[0].proba * 100)}%</span>
            )}
          </div>
          <div style={{ fontSize: 16, marginBottom: 16 }}>« {d.nl} »</div>

          {/* Top-3 des classes */}
          {d.top && d.top.length > 1 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
              {d.top.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono" style={{ fontSize: 12, color: i === 0 ? 'var(--ink)' : 'var(--ink-3)', minWidth: 130 }}>{t.relation}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-elev)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(t.proba * 100)}%`, height: '100%', background: i === 0 ? 'var(--accent)' : 'var(--line)' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 34, textAlign: 'right' }}>{Math.round(t.proba * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Signaux de type (explicabilité : A est-il une action ? B une personne/lieu ?) */}
          {d.signals && (
            <div style={{ marginBottom: 14, display: 'grid', gap: 6 }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>signaux de type</div>
              {[['a', d.a], ['b', d.b]].map(([k, w]) => {
                const s = d.signals[k] || { types: [], isa: [] };
                return (
                  <div key={k} className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                    <b style={{ color: 'var(--ink)' }}>{w}</b>
                    {s.types.length ? ' — ' + s.types.join(' · ') : ''}
                    {s.isa.length ? <span style={{ color: 'var(--ink-3)' }}> (isa : {s.isa.join(', ')})</span> : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Évidence : relation directe A↔B discriminante (r_associated exclu) */}
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>évidence (relations JDM A↔B)</div>
            {d.evidence && d.evidence.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {d.evidence.map((e, i) => (
                  <span key={i} className="mono" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, color: 'var(--ink-2)', background: 'var(--bg-elev)', border: '1px solid var(--line-soft)' }}>{e}</span>
                ))}
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>aucune relation directe discriminante</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────── Panneau générique « texte → résultat » ─────────
// Mutualise les outils qui prennent un texte + un modèle et rendent un résultat
// JSON (WSD, thématique, polarité, relations JDM…). Un seul site : ajouter un
// outil de ce type = une entrée OUTILS_TABS + TOOL_MODELS + un rendu ci-dessous.
function TextToolPanel({ path, models, defaultText, placeholder, rows = 4, renderData, options }) {
  const [text, setText] = React.useState(defaultText || '');
  const [model, setModel] = React.useState(models[0].value);
  const [opts, setOpts] = React.useState(() => {
    const o = {}; (options || []).forEach(x => { o[x.key] = !!x.default; }); return o;
  });
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const run = async () => {
    setLoading(true); setRes(null);
    setRes(await _callTool(path, { text, model, ...opts })); setLoading(false);
  };
  const checkboxes = (options && options.length > 0) ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
      {options.map(o => (
        <label key={o.key} title={o.disabled ? 'À venir (coréférence trop lente)' : undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)', cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.5 : 1 }}>
          <input type="checkbox" checked={!o.disabled && !!opts[o.key]} disabled={o.disabled}
            onChange={(e) => setOpts(s => ({ ...s, [o.key]: e.target.checked }))} />
          {o.label}
        </label>
      ))}
    </div>
  ) : null;
  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        rows={rows} placeholder={placeholder}
        model={model} setModel={setModel} models={models} belowText={checkboxes} />
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
        {trips.length} relation(s) extraite(s){data.mode ? ` · ${data.mode}` : ''}
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

// ───────── Analyse de polarité (r_infopot) ─────────
// Charte du claim-checker : positif=vert, négatif=magenta, neutre=jaune.
const _POL_STYLE = {
  positif: { color: 'var(--jdm-green)',   bg: 'rgba(78,166,60,0.15)',  border: 'rgba(78,166,60,0.45)' },
  négatif: { color: 'var(--jdm-magenta)', bg: 'rgba(200,58,115,0.15)', border: 'rgba(200,58,115,0.45)' },
  neutre:  { color: 'var(--jdm-yellow)',  bg: 'rgba(212,169,10,0.15)', border: 'rgba(212,169,10,0.45)' },
};

function PolarityResult({ data }) {
  const s = _POL_STYLE[data.label] || _POL_STYLE.neutre;
  const words = data.words || [];
  const denom = (data.pos + data.neg) || 1;
  const posPct = Math.round((data.pos / denom) * 100);
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '8px 20px', borderRadius: 999, color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        }}>{data.label}</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          score {data.score >= 0 ? '+' : ''}{data.score} · pos {data.pos} / neg {data.neg}
        </span>
      </div>
      {/* Barre positif (vert) vs négatif (magenta) */}
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--line-soft)' }}>
        <div style={{ width: `${posPct}%`, background: 'var(--jdm-green)' }} />
        <div style={{ flex: 1, background: 'var(--jdm-magenta)' }} />
      </div>
      {/* Mots polarisés (négation marquée ⊘) */}
      {words.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {words.map((w, i) => {
            const ws = _POL_STYLE[w.polarity] || _POL_STYLE.neutre;
            return (
              <span key={i} title={`positif ${w.pos} · négatif ${w.neg}${w.negated ? ' · NÉGATION → inversé' : ''}`}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, color: ws.color, background: ws.bg, border: `1px solid ${ws.border}`, cursor: 'help' }}>
                {w.word}{w.negated ? ' ⊘' : ''}
              </span>
            );
          })}
        </div>
      ) : (
        <ToolNotice tone="warn" msg="Aucun mot porteur de polarité trouvé dans JeuxDeMots." />
      )}
    </Card>
  );
}

// ───────── Désambiguïsation (WSD par raffinements JDM) ─────────
// Étiquette courte d'un sens : le contenu entre parenthèses (« avocat (fruit) » → « fruit »).
function _senseTag(sense) {
  const m = (sense || '').match(/\(([^)]+)\)/);
  return m ? m[1] : sense;
}

// Une OCCURRENCE = une COLONNE verticale : en-tête + classement des sens empilés
// (chaque sens avec son score et l'explication gén/sél). Les colonnes défilent
// horizontalement (voir WsdView).
function WsdColumn({ occ: w }) {
  const senses = w.senses || [];
  const accent = w.mwe ? 'var(--jdm-cyan)' : (w.confident ? 'var(--accent)' : 'var(--jdm-yellow)');
  return (
    <div style={{
      flex: '0 0 250px', minWidth: 250, display: 'flex', flexDirection: 'column', gap: 8,
      padding: 12, background: 'var(--bg-elev)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
    }}>
      {/* En-tête de la colonne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700 }}>{w.word}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 999,
          color: (w.mwe || w.confident) ? 'var(--bg)' : 'var(--ink-2)',
          background: accent, border: '1px solid var(--line)',
        }}>{w.mwe ? 'composé' : (w.confident ? 'confiant' : 'incertain')}</span>
      </div>
      {w.role && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{w.role} de « {w.verb} »</span>
      )}

      {/* Classement des raffinements, empilé */}
      <div style={{ display: 'grid', gap: 5 }}>
        {senses.map((s, j) => {
          const top = j === 0;
          const scoreCol = s.score < 0 ? 'var(--jdm-magenta)' : (top ? accent : 'var(--ink-2)');
          return (
            <div key={j} style={{
              padding: '6px 8px', borderRadius: 8,
              background: top ? `color-mix(in srgb, ${accent} 16%, transparent)` : 'var(--bg)',
              border: `1px solid ${top ? accent : 'var(--line-soft)'}`,
            }}>
              {/* minWidth:0 : sans lui, un flex item refuse de rétrécir sous son
                  contenu (min-width:auto) → les libellés longs (« bâtiment, salle de
                  théâtre ») débordaient de la carte et poussaient le score dehors.
                  On laisse le libellé passer à la ligne (lisibilité) ; le score ne
                  rétrécit jamais (flexShrink:0). */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: top ? 'var(--ink)' : 'var(--ink-2)', fontWeight: top ? 600 : 400, minWidth: 0, flex: '1 1 auto', overflowWrap: 'anywhere' }}>
                  {j + 1}. {_senseTag(s.sense)}
                </span>
                <span className="mono" style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, fontWeight: 600, color: scoreCol }}>{s.score}</span>
              </div>
              {!w.mwe && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.55 }}>
                  <div>gén <b style={{ color: 'var(--ink-2)' }}>{s.generic}</b>
                    {s.why_gen && s.why_gen.length ? <span> ← {s.why_gen.join(', ')}</span> : null}</div>
                  {(s.selectional !== 0 || (s.why_sel && s.why_sel.length)) && (
                    <div>sél <b style={{ color: s.selectional < 0 ? 'var(--jdm-magenta)' : 'var(--ink-2)' }}>{s.selectional}</b>
                      {s.why_sel && s.why_sel.length ? <span> ← {s.why_sel.join(' · ')}</span> : null}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vue WSD : texte surligné (occurrences au fil de l'eau) + barres par occurrence.
function WsdView({ tokens, occ, mode, loading }) {
  const byToken = {};
  occ.forEach((o) => {
    const idxs = (o.span && o.span.length) ? o.span : (o.token != null ? [o.token] : []);
    idxs.forEach((ti) => { byToken[ti] = o; });
  });
  return (
    <Card padding={18}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        {occ.length} occurrence(s){loading ? ' · analyse en cours…' : ''}{mode ? ` · ${mode}` : ''}
      </div>

      {tokens.length > 0 && (
        <div style={{ fontSize: 15, lineHeight: 2.4, marginBottom: 16 }}>
          {tokens.map((t, i) => {
            const o = byToken[t.i];
            if (!o) return <React.Fragment key={i}><span>{t.text}</span>{t.ws}</React.Fragment>;
            const span = (o.span && o.span.length) ? o.span : [o.token];
            const isLast = t.i === span[span.length - 1];
            const col = o.mwe ? 'var(--jdm-cyan)' : (o.confident ? 'var(--accent)' : 'var(--jdm-yellow)');
            const tag = o.mwe ? 'composé' : _senseTag(o.chosen.sense);
            return (
              <React.Fragment key={i}>
                <span title={`${o.role ? o.role + ' de « ' + o.verb + ' » — ' : ''}${o.chosen.sense}`}
                  style={{ background: `color-mix(in srgb, ${col} 20%, transparent)`, borderBottom: `2px solid ${col}`, borderRadius: 3, padding: '1px 2px', cursor: 'help' }}>{t.text}</span>
                {isLast && <sub style={{ fontSize: 10, color: col, marginLeft: 1, whiteSpace: 'nowrap' }}>{tag}</sub>}
                {t.ws}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Une COLONNE par occurrence, défilement horizontal */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, alignItems: 'stretch' }}>
        {occ.map((w, i) => <WsdColumn key={i} occ={w} />)}
      </div>
    </Card>
  );
}

// Panneau WSD : streaming NDJSON → occurrences affichées en temps réel.
// Catégories désambiguïsables. Noms cochés par défaut (rapide) ; verbes/adjectifs
// sont tout aussi polysémiques mais chaque catégorie coûte des requêtes JDM.
const WSD_POS = [
  { key: 'NOUN', label: 'Nom' },
  { key: 'PROPN', label: 'Nom propre' },
  { key: 'VERB', label: 'Verbe' },
  { key: 'ADJ', label: 'Adjectif' },
];

function WsdPanel() {
  const [text, setText] = React.useState("L'avocat mange l'avocat. Au tribunal, l'avocat défend son client.");
  const [model, setModel] = React.useState(TOOL_MODELS.wsd[0].value);
  const [tokens, setTokens] = React.useState([]);
  const [occ, setOcc] = React.useState([]);
  const [mode, setMode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [pos, setPos] = React.useState({ NOUN: true, PROPN: true, VERB: false, ADJ: false });
  const allOn = WSD_POS.every((o) => pos[o.key]);
  const selected = WSD_POS.filter((o) => pos[o.key]).map((o) => o.key);
  const run = async () => {
    setLoading(true); setErr(null); setTokens([]); setOcc([]); setMode('');
    try {
      await _streamTool('wsd/stream', { text, model, pos: selected }, (ev) => {
        if (ev.type === 'tokens') { setTokens(ev.tokens || []); setMode(ev.mode || ''); }
        else if (ev.type === 'occ') { setOcc((prev) => [...prev, ev.occurrence]); }
        else if (ev.type === 'error') { setErr(ev.error); }
      });
    } catch (e) { setErr(String(e && e.message ? e.message : e)); }
    setLoading(false);
  };
  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        placeholder="Un texte à désambiguïser (le bon sens de chaque mot polysémique)…"
        model={model} setModel={setModel} models={TOOL_MODELS.wsd}
        belowText={
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              catégories à désambiguïser
            </span>
            {WSD_POS.map((o) => (
              <label key={o.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!pos[o.key]}
                  onChange={(e) => setPos({ ...pos, [o.key]: e.target.checked })} />
                {o.label}
              </label>
            ))}
            <label title="Désambiguïser aussi les verbes et adjectifs (plus complet, mais plus lent)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={allOn}
                onChange={(e) => setPos(Object.fromEntries(WSD_POS.map((o) => [o.key, e.target.checked])))} />
              Tout
            </label>
          </div>
        } />
      {err && <ToolNotice tone="warn" msg={err} />}
      {(tokens.length > 0 || occ.length > 0) && (
        <WsdView tokens={tokens} occ={occ} mode={mode} loading={loading} />
      )}
    </div>
  );
}

// ───────── Analyse thématique (domaines JeuxDeMots) ─────────
function ThematicPanel() {
  const [text, setText] = React.useState(THEMATIC_DEFAULT);
  const [model, setModel] = React.useState(TOOL_MODELS.thematic[0].value);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [thr, setThr] = React.useState(12);   // seuil sur le score normalisé (0-100)
  const [wsd, setWsd] = React.useState(true);
  const run = async () => {
    setLoading(true); setRes(null);
    const r = await _callTool('thematic', { text, model, wsd });
    setRes(r); setLoading(false);
    if (r && r.ok && r.data && typeof r.data.suggested_threshold === 'number') {
      setThr(r.data.suggested_threshold);   // seuil auto (au plus grand écart)
    }
  };
  const data = (res && res.ok) ? res.data : null;
  const suggested = data && typeof data.suggested_threshold === 'number' ? data.suggested_threshold : null;
  const themes = (data && data.themes) || [];
  const shown = themes.filter((t) => t.rel >= thr);
  return (
    <div style={panelGrid()}>
      <ToolForm text={text} setText={setText} run={run} loading={loading}
        rows={6} model={model} setModel={setModel} models={TOOL_MODELS.thematic}
        placeholder="Un texte à analyser thématiquement (thèmes = domaines JeuxDeMots)…"
        belowText={
          <label title="Désambiguïser chaque mot puis filtrer les domaines par le sens choisi (plus lent, retire la polysémie)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', marginTop: 12 }}>
            <input type="checkbox" checked={wsd} onChange={(e) => setWsd(e.target.checked)} />
            WSD
          </label>
        } />
      {res && !res.ok && <ToolNotice msg={res.error} tone="warn" />}
      {data && (
        <Card padding={18}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            {themes.length} thème(s) · {shown.length} affiché(s) · {data.analyzed}/{data.word_count} mots analysés
            {data.truncated ? ' (tronqué)' : ''}
          </div>
          {/* Barre de seuil (placée automatiquement au plus grand écart) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>Seuil</span>
            <input type="range" min="0" max="100" step="1" value={thr}
              onChange={(e) => setThr(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>{thr}%</span>
            {suggested !== null && (
              <button onClick={() => setThr(suggested)} className="focus-ring"
                title={`Seuil auto au plus grand écart (${suggested}%)`}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                  color: 'var(--ink-2)', background: 'var(--bg-elev)',
                  border: '1px solid var(--line)', whiteSpace: 'nowrap',
                }}>auto {suggested}%</button>
            )}
          </div>
          {/* Nuage de bulles : taille ∝ importance du thème */}
          {shown.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {shown.map((t) => {
                const fs = 13 + (t.rel / 100) * 24;               // 13 → 37 px
                const pct = Math.round(18 + (t.rel / 100) * 52);  // opacité 18 → 70 %
                return (
                  <span key={t.theme}
                    title={`score ${t.score} · ${t.count} mot(s) : ${t.words.join(', ')}`}
                    style={{
                      display: 'inline-block', padding: '6px 14px', borderRadius: 999,
                      fontSize: fs, lineHeight: 1.15, fontWeight: 600, color: 'var(--ink)',
                      background: `color-mix(in srgb, var(--accent) ${pct}%, transparent)`,
                      border: '1px solid var(--line-soft)', cursor: 'default',
                    }}>
                    {t.theme}
                  </span>
                );
              })}
            </div>
          ) : (
            <ToolNotice tone="warn" msg="Aucun thème au-dessus du seuil — baisse la barre." />
          )}
        </Card>
      )}
    </div>
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
function ToolForm({ text, setText, run, loading, placeholder, rows = 4, model, setModel, models, belowText }) {
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
      {belowText}
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
        title="Services : Tâche TALN"
        desc="Démonstrateurs d'outils de traitement automatique des langues assistés par le réseau lexico-sémantique JeuxDeMots"
      />

      {/* Barre de sous-onglets (sans glyphs ; services à venir grisés) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {OUTILS_TABS.map((t) => {
          const active = tab === t.id;
          const off = !!t.disabled;
          return (
            <button key={t.id}
              onClick={() => { if (!off) setTab(t.id); }}
              disabled={off}
              title={off ? 'À venir' : undefined}
              className="focus-ring"
              style={{
                padding: '8px 14px',
                background: active ? 'var(--accent)' : 'var(--bg-elev)',
                color: off ? 'var(--ink-3)' : (active ? 'var(--bg)' : 'var(--ink)'),
                border: '1px solid var(--line)',
                borderRadius: 999, cursor: off ? 'not-allowed' : 'pointer',
                opacity: off ? 0.5 : 1,
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'coref'    && <CorefPanel />}
      {tab === 'syntax'   && <SyntaxPanel />}
      {tab === 'wsd'      && <WsdPanel />}
      {tab === 'thematic' && <ThematicPanel />}
      {tab === 'polarity' && (
        <TextToolPanel path="polarity" models={TOOL_MODELS.polarity}
          defaultText="Ce film n'est pas excellent, quelle horreur. En revanche j'ai adoré la musique."
          placeholder="Un texte dont analyser la polarité (positif / négatif / neutre)…"
          renderData={(d) => <PolarityResult data={d} />} />
      )}
      {tab === 'genitive' && <GenitivePanel />}
      {tab === 'analogy'  && <AnalogyPanel />}
      {tab === 'jdmrel'   && (
        <TextToolPanel path="jdmrel" models={TOOL_MODELS.jdmrel}
          defaultText={JDMREL_DEFAULT} rows={12}
          placeholder="Un texte à analyser en relations sémantiques JDM (syntaxe UDPipe + JDM)…"
          options={[{ key: 'resolve_anaphora', label: 'Résoudre les anaphores pronominales (coréférence)', default: false, disabled: true }]}
          renderData={(d) => <JdmRelResult data={d} />} />
      )}
    </PageShell>
  );
}

window.ViewOutils = ViewOutils;
