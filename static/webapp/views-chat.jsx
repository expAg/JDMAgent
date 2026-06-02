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
        desc="Discute avec l'orchestrateur en plein écran : il supervise les agents, lance des flux, explique le graphe JDM. Même conversation que le volet latéral (le fil continue en fond)." />

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
