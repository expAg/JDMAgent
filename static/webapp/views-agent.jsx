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

  const needsBYOK = model.startsWith('claude-') || model.startsWith('gpt-');

  // Send : POST /api/agent/stream, parse SSE en flux, accumule sur le
  // dernier message assistant (créé vide juste avant le fetch).
  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    // Snapshot l'historique AVANT d'ajouter le message courant
    // (le backend l'attend séparément via `message`).
    const historySnapshot = convo.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? (m.content || '') : m.content,
    }));
    const assistantStub = { role: 'assistant', thoughts: [], tools: [], content: '', error: '' };
    setConvo([...convo, userMsg, assistantStub]);
    const msg = input;
    setInput('');
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
        kicker="Module · agent LLM"
        title="Agent"
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
            <div style={{
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
              {convo.map((m, i) => <Message key={i} m={m} />)}
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
              <Select value={model} options={AGENT_MODELS} onChange={setModel} />
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
    case 'thought':
      patchLast(last => { last.thoughts = [...(last.thoughts || []), d.text || '']; });
      break;
    case 'spoken':
      patchLast(last => {
        const sep = last.content ? '\n\n' : '';
        last.content = (last.content || '') + sep + (d.text || '');
      });
      break;
    case 'tool_call':
      patchLast(last => {
        last.tools = [...(last.tools || []), {
          name: d.name, args: d.args || {}, narration: d.narration || '',
          result: null,
        }];
      });
      break;
    case 'tool_result':
      patchLast(last => {
        const tools = (last.tools || []).slice();
        // Trouve le dernier tool_call du même nom sans résultat
        for (let i = tools.length - 1; i >= 0; i--) {
          if (tools[i].name === d.name && !tools[i].result) {
            tools[i] = { ...tools[i], result: { preview: d.preview, narration: d.narration } };
            break;
          }
        }
        last.tools = tools;
      });
      break;
    case 'final':
      patchLast(last => { last.content = d.text || last.content || ''; });
      break;
    case 'error':
      patchLast(last => { last.error = d.text || 'Erreur inconnue.'; });
      break;
    default:
      // unknown event type — ignore
      break;
  }
}

// ─── Rendu d'un message ────────────────────────────────────────

function Message({ m }) {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '70%',
          padding: '10px 14px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          borderRadius: 'var(--radius-lg)',
          fontSize: 14,
          lineHeight: 1.5,
        }}>{m.content}</div>
      </div>
    );
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
        {m.thoughts && m.thoughts.length > 0 && (
          <details style={{ marginBottom: 10 }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>🧠 Raisonnement ({m.thoughts.length})</summary>
            <div style={{
              marginTop: 8,
              padding: 10,
              background: 'var(--bg-elev)',
              borderLeft: '2px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{m.thoughts.join('\n\n')}</div>
          </details>
        )}
        {m.tools && m.tools.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px',
            background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius)',
            marginBottom: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: t.result ? 'var(--jdm-green)' : 'var(--ink-3)' }}>●</span>
            <span style={{ color: 'var(--accent)' }}>{t.name}</span>
            <span style={{ color: 'var(--ink-3)' }}>(</span>
            <span style={{ color: 'var(--ink)' }}>
              {Object.entries(t.args || {}).map(([k, v]) =>
                `${k}=${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`
              ).join(', ')}
            </span>
            <span style={{ color: 'var(--ink-3)' }}>)</span>
            {t.result && t.result.preview && (
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {t.result.preview}
              </span>
            )}
          </div>
        ))}
        {m.content && (
          <div style={{
            fontSize: 14,
            color: 'var(--ink)',
            lineHeight: 1.6,
          }} dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
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

window.ViewAgent = ViewAgent;
