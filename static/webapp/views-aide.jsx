// View: Aide — installation, usage, MCP, soumission.
// Conserve le layout designer (SectionTitle / Card / kbd / image-slot)
// mais le remplit avec notre contenu canonique AIDE_MD réparti dans
// des sections visuellement structurées.

// Navigation : table des onglets — version "card" du tableau markdown.
const TABS_TABLE = [
  { icon: '📋', name: 'Projet',        what: 'Présentation, liens code source.',                                 key: 'Aucune' },
  { icon: '🔎', name: 'Explorer JDM',  what: 'Table de triplets pour un terme/relation. Déterministe.',          key: 'Aucune' },
  { icon: '⚖️', name: 'Claim checker', what: 'SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet. Déterministe.', key: 'Aucune' },
  { icon: '🕸️', name: 'Sous-graphe',   what: 'Visualisation vis-network interactive du voisinage.',              key: 'Aucune' },
  { icon: '🤖', name: 'Agent',         what: 'Chat libre avec un agent LLM qui utilise les outils JDM.',         key: 'Gemini (gratuit) ou BYOK Claude/GPT' },
  { icon: '🦾', name: 'Jarvis',        what: 'Flux guidés par formulaires (5 sous-onglets).',                    key: 'Gemini gratuit · LLMDrops si soumission' },
  { icon: '🛠️', name: 'Aide',          what: 'Ce document.',                                                      key: '—' },
];

// Les 5 flows Jarvis avec leur description.
const JARVIS_FLOWS_HELP = [
  { id: 'enrich',      icon: '🌱', name: 'Enrichissement', wf: 'enrichment_workflow()',
    desc: 'Propose et consolide de nouveaux triplets pour un terme. Form : terme, relation cible (optionnelle), nombre cible, varier les relations, itérer jusqu\'au but, soumettre. Output : chatbot + fichier .enrich.' },
  { id: 'audit',       icon: '🔍', name: 'Audit',          wf: 'audit_workflow()',
    desc: 'Audit sémantique de la répartition des sens d\'un terme polysémique. Verdict par triplet (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative. Fichier .audit.' },
  { id: 'gap',         icon: '🕳️', name: 'Détection de trous', wf: 'gap_detection_workflow()',
    desc: 'Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE). Tableau déterministe + synthèse narrative. Routage vers Enrich / Audit / Stats.' },
  { id: 'signalement', icon: '⚠️', name: 'Signalement',    wf: 'signalement_workflow()',
    desc: 'Le LLM utilise son jugement linguistique pour flagger les triplets suspects (pas besoin de preuve d\'outil). Fichier .err avec catégorie de suspicion et justification.' },
  { id: 'stats',       icon: '📊', name: 'Stats',          wf: 'stats_workflow()',
    desc: 'Statistiques de couverture par terme et/ou par relation : n_total, n_pos, n_neg, max_w, min_w, mean_w par relation + 3-5 observations clés en prose.' },
];

const API_KEYS_TABLE = [
  { name: 'Gemini',          where: 'aistudio.google.com/apikey',     cost: 'Gratuit (500 req/jour pour 3.1 Flash Lite)', when: 'Pré-configurée côté serveur',
    url: 'https://aistudio.google.com/apikey' },
  { name: 'LLMDrops JDM',    where: 'jeuxdemots.org (contacter M. Lafourcade)', cost: 'Gratuit sur demande', when: 'Pousser .enrich / .audit / .err vers JDM',
    url: 'https://www.jeuxdemots.org' },
  { name: 'Anthropic (Claude)', where: 'console.anthropic.com',       cost: 'Payant ($)',                              when: 'BYOK Claude dans Agent / Jarvis',
    url: 'https://console.anthropic.com' },
  { name: 'OpenAI (GPT)',    where: 'platform.openai.com',            cost: 'Payant ($)',                              when: 'BYOK GPT dans Agent / Jarvis',
    url: 'https://platform.openai.com/api-keys' },
];

const SHORTCUTS = [
  { keys: ['G', 'E'], desc: 'Aller à Explorer' },
  { keys: ['G', 'C'], desc: 'Aller à Claim checker' },
  { keys: ['G', 'A'], desc: 'Aller à Agent' },
  { keys: ['G', 'J'], desc: 'Aller à Jarvis' },
  { keys: ['?'],      desc: 'Cette page d\'aide' },
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

function ViewAide() {
  return (
    <PageShell>
      <SectionTitle
        kicker="Documentation"
        title="Aide & Installation"
        desc="Naviguer la démo, installer en local, brancher le MCP, comprendre les formats de soumission JDM."
      />

      {/* 1. Naviguer dans la démo — cards par onglet */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>1 · Naviguer dans la démo</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        marginBottom: 40,
      }}>
        {TABS_TABLE.map((t) => (
          <div key={t.name} style={{ background: 'var(--bg-card)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{t.name}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>
              {t.what}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Clé : <span style={{ color: 'var(--accent)' }}>{t.key}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Jarvis en détail */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 8px',
      }}>2 · Jarvis en détail — 5 flows guidés</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.55 }}>
        Tous les sous-onglets Jarvis partagent un <strong>bandeau</strong> en haut :
        clé LLMDrops (override env), modèle LLM (Gemini par défaut, BYOK possible),
        budget d&apos;appels d&apos;outils (10 / 25 / 50 / 100 / illimité — au-delà, le LLM reçoit un sentinel et consolide ce qu&apos;il a).
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12, marginBottom: 40,
      }}>
        {JARVIS_FLOWS_HELP.map(f => (
          <Card key={f.id} padding={18}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <strong style={{ fontSize: 16, color: 'var(--ink)' }}>{f.name}</strong>
              <code className="mono" style={{
                marginLeft: 'auto', background: 'var(--bg-elev)',
                padding: '2px 6px', borderRadius: 3,
                fontSize: 10, color: 'var(--accent)',
              }}>{f.wf}</code>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{f.desc}</p>
          </Card>
        ))}
      </div>

      {/* 3. Installation locale */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>3 · Installation locale</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.55 }}>
        Déployer la même app sur ta machine ou un serveur. Sur <strong>Debian 12 / Ubuntu 24.04</strong> (PEP 668),
        le venv est <strong>obligatoire</strong> (pip refuse hors venv).
      </p>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}>{INSTALL_SCRIPT}</pre>
      </Card>
      <div style={{
        fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 40,
        padding: 12, background: 'var(--bg-elev)',
        borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius)',
      }}>
        <strong style={{ color: 'var(--ink)' }}>Sous reverse-proxy</strong> (Apache/Nginx sur sous-chemin <code className="mono">/Jarvis/</code> par ex.) :
        mets <code className="mono">APP_SUBPATH=/Jarvis</code> dans <code className="mono">.env</code>. Le frontend injecte <code className="mono">&lt;base href&gt;</code> automatiquement et les fetch API se résolvent.
      </div>

      {/* 4. MCP */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>4 · Serveur MCP — outils JDM dans Claude Code / Cursor</h2>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto',
        }}>{MCP_SCRIPT}</pre>
      </Card>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 40, lineHeight: 1.55 }}>
        Ensuite depuis Claude Code : <em>« Donne-moi les synonymes de voiture dans JDM »</em> → l&apos;agent appelle automatiquement les outils MCP exposés.
      </p>

      {/* 5. Clés API + Raccourcis (2 colonnes) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40,
      }}>
        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
            margin: '0 0 14px',
          }}>5 · Clés API</h2>
          <Card padding={0}>
            {API_KEYS_TABLE.map((k, i) => (
              <a key={k.name} href={k.url}
                style={{
                  display: 'block', padding: 14,
                  borderBottom: i < API_KEYS_TABLE.length - 1 ? '1px solid var(--line-soft)' : 'none',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elev)'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{k.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--accent)' }}>↗</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{k.where}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{k.cost} · <em>{k.when}</em></div>
              </a>
            ))}
          </Card>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.55 }}>
            ⚠️ Sécurité : les clés que tu colles dans l&apos;UI ne sont <strong>jamais persistées</strong> côté serveur — elles vivent uniquement le temps de ton onglet navigateur.
          </div>
        </div>

        <div>
          <h2 className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
            margin: '0 0 14px',
          }}>Raccourcis clavier</h2>
          <Card padding={0}>
            {SHORTCUTS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                borderBottom: i < SHORTCUTS.length - 1 ? '1px solid var(--line-soft)' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginLeft: 12 }}>{s.desc}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* 6. Formats de fichiers de soumission */}
      <h2 className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
        margin: '40px 0 14px',
      }}>6 · Format des fichiers de soumission</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.55 }}>
        Tous les fichiers produits par Jarvis suivent un <strong>format pipe</strong>.
      </p>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <pre style={{
          margin: 0, padding: 18,
          background: 'var(--bg-elev)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12, lineHeight: 1.6,
          color: 'var(--ink)',
          overflowX: 'auto', whiteSpace: 'pre',
        }}>{FORMAT_TEXT}</pre>
      </Card>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 40, lineHeight: 1.55 }}>
        Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
        <ul style={{ marginTop: 6, paddingLeft: 20 }}>
          <li>coche <strong>Soumettre directement</strong> dans le formulaire (clé <code className="mono">JDM_DROPS_API_KEY</code> requise) ;</li>
          <li>ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.</li>
        </ul>
      </div>

      {/* 7. Panneau admin — réservé ?admin=1 (positionné en bas, avant
          le footer institutionnel, comme requis par l'utilisateur). */}
      <div className="admin-only" style={{ marginTop: 40, marginBottom: 28 }}>
        <h2 className="display" style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
          margin: '0 0 14px',
        }}>7 · Panneau admin</h2>
        <AdminPanel />
      </div>

      {/* 8. Footer institutionnel — crédits + liens cliquables */}
      <div style={{
        padding: 28, background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <JDMMark size={36} />
          <div>
            <div className="display" style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
              marginBottom: 4,
            }}>
              jdmAgent
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Mathieu Lafourcade ·{' '}
              <a href="https://www.lirmm.fr/" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}>LIRMM</a>{' '}
              (Université de Montpellier — CNRS) ·{' '}
              <a href="https://www.lirmm.fr/equipes/slice/" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}>Équipe SLICE</a>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
              <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--ink-3)' }}>github.com/expAg/JDMAgent</a>
              {' · '}
              <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--ink-3)' }}>USAGE.md</a>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Panneau admin (gate par mot de passe) ─────────────────────

function AdminPanel() {
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Edition env vars
  const [allVars, setAllVars] = useState({});  // {NAME: currentValue}
  const [edits, setEdits] = useState({});      // {NAME: newValue}
  const [editMsg, setEditMsg] = useState('');
  const [cacheMsg, setCacheMsg] = useState('');

  React.useEffect(() => {
    fetch('api/admin/info').then(r => r.json()).then(setInfo).catch(() => {});
  }, []);

  const auth = async () => {
    if (!password) { setAuthErr('Mot de passe requis.'); return; }
    setBusy(true); setAuthErr('');
    try {
      const r = await fetch('api/admin/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.status === 401) { setAuthErr('Mot de passe invalide.'); return; }
      if (r.status === 503) {
        setAuthErr('Admin désactivé : EXPORT_SECRETS_PASSWORD non défini côté serveur.');
        return;
      }
      if (!r.ok) { setAuthErr(`HTTP ${r.status}`); return; }
      setAuthed(true);
      // Charge les valeurs actuelles (via export — réutilise l'endpoint)
      const exp = await fetch('api/admin/export-secrets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
    setAuthed(false); setPassword(''); setAllVars({}); setEdits({});
    setEditMsg(''); setCacheMsg('');
  };

  const setOne = (k, v) => setEdits(e => ({ ...e, [k]: v }));

  const submitEdits = async () => {
    setEditMsg('');
    const vars = Object.fromEntries(Object.entries(edits).filter(([_, v]) => v !== undefined && v !== ''));
    if (Object.keys(vars).length === 0) { setEditMsg('Aucune modification à appliquer.'); return; }
    try {
      const r = await fetch('api/admin/env-set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, vars }),
      });
      const d = await r.json();
      if (r.ok) {
        setEditMsg(`✓ ${(d.updated || []).length} mise(s) à jour · .env persisté : ${d.persisted_to_dotenv ? 'oui' : 'non'}`);
        // Reload current values
        setAllVars(av => ({ ...av, ...vars }));
        setEdits({});
      } else {
        setEditMsg(`✗ ${d.detail || r.status}`);
      }
    } catch (e) {
      setEditMsg(`✗ ${e && e.message ? e.message : e}`);
    }
  };

  const clearCache = async () => {
    setCacheMsg('');
    if (!confirm('Vider tout le cache disque JDM ? Les prochains appels iront refrapper l\'API.')) return;
    try {
      const r = await fetch('api/admin/cache-clear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '.env.export';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Liste complète des vars autorisées côté backend
  // (matchée à _EXPORTABLE_ENV_VARS).
  const EDITABLE_VARS = [
    'JDM_BASE_URL', 'JDM_TIMEOUT',
    'JDM_CACHE_DIR', 'JDM_CACHE_TTL_META', 'JDM_CACHE_TTL_DATA',
    'LLM_PROVIDER', 'LLM_MODEL', 'LLM_TEMPERATURE',
    'OLLAMA_BASE_URL',
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY',
    'DEEPSEEK_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_API_KEYS',
    'HF_TOKEN',
    'JDM_DROPS_API_KEY', 'JDM_DROPS_URL',
    'APP_SUBPATH',
  ];

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
        {authed && (
          <Button size="sm" variant="ghost"
            style={{ marginLeft: 'auto' }}
            onClick={logout}>🔒 Verrouiller</Button>
        )}
      </div>

      {/* Diag info (toujours visible si admin URL) */}
      {info && (
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
            {info.export_secrets_enabled ? 'activé' : 'désactivé (EXPORT_SECRETS_PASSWORD non défini)'}
          </strong></div>
          <div>Env vars présentes : <strong style={{ color: 'var(--ink)' }}>{(info.env_vars_present || []).length}</strong> / {EDITABLE_VARS.length}</div>
        </div>
      )}

      {/* AVANT auth : juste le champ password. Les contrôles d'édition,
          cache clear, export ne s'affichent QU'après validation OK. */}
      {!authed ? (
        <>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>Authentification requise</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <Input value={password} onChange={setPassword}
              placeholder="Mot de passe EXPORT_SECRETS_PASSWORD" mono />
            <Button size="sm" onClick={auth} disabled={busy || !password}>
              {busy ? '…' : 'Déverrouiller'}
            </Button>
          </div>
          {authErr && (
            <div style={{
              marginTop: 8, padding: 10,
              background: 'rgba(200,58,115,0.08)',
              border: '1px solid var(--jdm-magenta)',
              borderRadius: 'var(--radius)',
              color: 'var(--jdm-magenta)', fontSize: 12,
            }}>{authErr}</div>
          )}
        </>
      ) : (
        <>
          <div style={{
            marginBottom: 16, padding: 10,
            background: 'rgba(78,166,60,0.08)',
            border: '1px solid var(--jdm-green)',
            borderRadius: 'var(--radius)',
            color: 'var(--jdm-green)', fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}>✓ Mot de passe accepté — contrôles débloqués</div>

          {/* 1 · Edition env vars */}
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>1 · Variables d'environnement</div>
          <div style={{
            background: 'var(--bg-elev)', borderRadius: 'var(--radius)',
            padding: 12, marginBottom: 8,
            maxHeight: 420, overflow: 'auto',
          }}>
            {EDITABLE_VARS.map(k => {
              const isSecret = /KEY|TOKEN|PASSWORD/.test(k);
              const cur = allVars[k] || '';
              // Affiche la valeur in extenso quand non-secret. Les secrets
              // restent masqués (premier 4 / dernier 4) — copie copie la
              // valeur COMPLÈTE quand même.
              const displayMask = isSecret && cur ? (cur.slice(0, 4) + '…' + cur.slice(-4)) : cur;
              return (
                <AdminVarRow key={k}
                  name={k} current={cur} displayMask={displayMask}
                  editValue={edits[k] || ''}
                  onEdit={(v) => setOne(k, v)} />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button size="sm" onClick={submitEdits}>✓ Appliquer les modifications</Button>
            <Button size="sm" variant="secondary" onClick={downloadEnv}>⬇ Télécharger .env complet</Button>
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

          {/* 2 · Cache JDM */}
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 8,
          }}>2 · Cache disque JDM</div>
          <Button size="sm" variant="secondary" onClick={clearCache}>
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
      )}
    </Card>
  );
}

// ─── Ligne d'édition d'une variable d'env (admin) ──────────────
// Layout : nom (compact) | valeur actuelle (flex 2, monoespace, tronquée
// si trop longue mais TITLE = valeur complète) | bouton copier |
// nouvelle valeur (flex 1, étroit pour laisser de la place à la valeur).
function AdminVarRow({ name, current, displayMask, editValue, onEdit }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '170px 1fr 28px 220px',
      gap: 8, alignItems: 'center', marginBottom: 6,
    }}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
      <div className="mono" title={current || '(non défini)'} style={{
        fontSize: 11,
        color: current ? 'var(--ink)' : 'var(--ink-3)',
        fontStyle: current ? 'normal' : 'italic',
        background: 'var(--bg-card)',
        padding: '6px 10px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line-soft)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{current ? displayMask : '(non défini)'}</div>
      <button
        type="button"
        onClick={copy}
        disabled={!current}
        title={current ? 'Copier la valeur' : ''}
        style={{
          width: 28, height: 28, padding: 0,
          background: copied ? 'var(--jdm-green)' : 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          color: copied ? '#fff' : 'var(--ink-3)',
          cursor: current ? 'pointer' : 'not-allowed',
          opacity: current ? 1 : 0.4,
          fontSize: 13,
        }}>{copied ? '✓' : '⎘'}</button>
      <Input value={editValue}
        onChange={onEdit}
        placeholder="nouvelle valeur (vide = ignore)" mono />
    </div>
  );
}

window.ViewAide = ViewAide;
