// View: Agent — conversational chat with the LLM + JDM tools.

const AGENT_MODELS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', sub: 'pool gratuit · 500 req/jour' },
  { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash',      sub: 'pool gratuit · 20 req/jour' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', sub: 'pool gratuit · 20 req/jour' },
  { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5',      sub: 'BYOK Anthropic' },
  { value: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5',     sub: 'BYOK Anthropic' },
  { value: 'gpt-4o-mini',           label: 'GPT-4o mini',           sub: 'BYOK OpenAI' },
  { value: 'gpt-4o',                label: 'GPT-4o',                sub: 'BYOK OpenAI' },
];

const SEED_CONVO = [
  {
    role: 'user',
    content: 'Que mange typiquement un chat ?',
  },
  {
    role: 'assistant',
    thinking: 'L\'utilisateur cherche les patients typiques du verbe « manger » avec « chat » comme agent. Je vais interroger r_patient sur manger, puis croiser avec r_agent(chat).',
    tools: [
      { name: 'relations_from', args: { term: 'manger', rel: 'r_patient', limit: 30 }, dur: 142, count: 30 },
      { name: 'relations_to',   args: { term: 'manger', rel: 'r_agent',   limit: 30 }, dur: 98,  count: 28 },
    ],
    content: 'Selon JeuxDeMots, un chat mange typiquement des **croquettes** (w=312), de la **viande** (w=287), du **poisson** (w=234), des **souris** (w=198), du **lait** (w=156). Le lait est culturellement associé mais souvent mal toléré par les chats adultes. Veux-tu que j\'élargisse aux verbes apparentés (chasser, attraper) ?',
  },
];

function ViewAgent() {
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [thinking, setThinking] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [convo, setConvo] = useState(SEED_CONVO);
  const [input, setInput] = useState('');

  const needsBYOK = model.startsWith('claude-') || model.startsWith('gpt-');

  const send = () => {
    if (!input.trim()) return;
    setConvo([...convo, { role: 'user', content: input }]);
    setInput('');
    // Faked assistant reply.
    setTimeout(() => {
      setConvo(c => [...c, {
        role: 'assistant',
        thinking: 'Je décompose la requête en interrogations JDM atomiques.',
        tools: [
          { name: 'term_exists', args: { term: input.split(' ')[0] || 'chat' }, dur: 32, count: 1 },
          { name: 'relations_from', args: { term: input.split(' ')[0] || 'chat', rel: 'r_carac' }, dur: 124, count: 12 },
        ],
        content: 'Réponse simulée — connecte ta clé pour interroger le vrai modèle.',
      }]);
    }, 600);
  };

  return (
    <PageShell>
      <SectionTitle
        kicker="Module · agent LLM"
        title="Agent"
        desc="Chat conversationnel. Le modèle a accès à 34 outils JDM via LangChain."
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
              {convo.map((m, i) => <Message key={i} m={m} />)}
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
                <Button onClick={send} size="lg">Envoyer</Button>
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
            }}>Outils disponibles · 34</div>
            <div style={{
              fontSize: 12, color: 'var(--ink-2)',
              display: 'grid', gap: 4,
            }}>
              {['relations_from', 'relations_to', 'term_exists', 'refinements_decoded',
                'verify_claim', 'build_subgraph', 'common_ancestors', 'analogies',
                'shortest_path', 'gloss_term'].map(t => (
                <div key={t} className="mono" style={{
                  fontSize: 11,
                  padding: '3px 6px',
                  background: 'var(--bg-elev)',
                  borderRadius: 3,
                  color: 'var(--ink)',
                }}>{t}</div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                + 24 autres…
              </div>
            </div>
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 10,
            }}>Pool Gemini</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Clé courante : <span className="mono" style={{ color: 'var(--ink)' }}>3/4</span><br/>
              Reset quotidien : <span className="mono">00:00 PT</span>
            </div>
            <Button variant="secondary" size="sm" full>
              ↻ Rotation manuelle
            </Button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

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
        {m.thinking && (
          <details style={{ marginBottom: 10 }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>🧠 Raisonnement</summary>
            <div style={{
              marginTop: 8,
              padding: 10,
              background: 'var(--bg-elev)',
              borderLeft: '2px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}>{m.thinking}</div>
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
          }}>
            <span style={{ color: 'var(--jdm-green)' }}>●</span>
            <span style={{ color: 'var(--accent)' }}>{t.name}</span>
            <span style={{ color: 'var(--ink-3)' }}>(</span>
            <span style={{ color: 'var(--ink)' }}>{Object.entries(t.args).map(([k, v]) => `${k}="${v}"`).join(', ')}</span>
            <span style={{ color: 'var(--ink-3)' }}>)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
              {t.count} résultats · {t.dur}ms
            </span>
          </div>
        ))}
        <div style={{
          fontSize: 14,
          color: 'var(--ink)',
          lineHeight: 1.6,
        }} dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
      </div>
    </div>
  );
}

function renderMarkdownLite(s) {
  // tiny markdown subset: **bold**, *italic*, `code`, line breaks
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>')
    .replace(/\n/g, '<br/>');
}

window.ViewAgent = ViewAgent;
