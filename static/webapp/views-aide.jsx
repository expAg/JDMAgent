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

      {/* 7. Footer institutionnel — slots logos préservés */}
      <div style={{
        padding: 32, background: 'var(--bg-elev)',
        border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 48, marginBottom: 28, flexWrap: 'wrap',
        }}>
          <image-slot id="logo-lirmm" shape="rect" placeholder="Dépose le logo LIRMM ici"
            style={{ width: 200, height: 80, background: 'transparent' }} />
          <div style={{ width: 1, height: 60, background: 'var(--line)' }} />
          <image-slot id="logo-um" shape="rect" placeholder="Dépose le logo Université de Montpellier ici"
            style={{ width: 200, height: 80, background: 'transparent' }} />
          <div style={{ width: 1, height: 60, background: 'var(--line)' }} />
          <image-slot id="logo-cnrs" shape="rect" placeholder="Dépose le logo CNRS ici"
            style={{ width: 120, height: 80, background: 'transparent' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, paddingTop: 24, borderTop: '1px solid var(--line-soft)',
        }}>
          <JDMMark size={28} />
          <div>
            <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              jdmAgent
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              <a href="https://github.com/expAg/JDMAgent" style={{ color: 'var(--ink-3)' }}>github.com/expAg/JDMAgent</a>
              {' · '}
              <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" style={{ color: 'var(--ink-3)' }}>USAGE.md</a>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

window.ViewAide = ViewAide;
