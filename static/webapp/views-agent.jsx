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
                    && window.__jdmPendingPayload?.agent) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.agent;
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

  // Send : POST /api/agent/stream, parse SSE en flux, accumule sur le
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
  const [html, setHtml] = useState('');
  const [err, setErr] = useState('');
  React.useEffect(() => {
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
      {err
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
