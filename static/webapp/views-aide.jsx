// View: Aide — refonte visuelle "plus jolie".
// Sticky TOC à gauche, contenu structuré à droite, blocs colorés, icônes.
// Tous les textes canoniques sont préservés.

const AIDE_SECTIONS = [
  { id: 'tour',    num: '01', label: 'Tour des onglets' },
  { id: 'jarvis',  num: '02', label: 'Jarvis en détail' },
  { id: 'install', num: '03', label: 'Installation locale' },
  { id: 'mcp',     num: '04', label: 'Serveur MCP' },
  { id: 'keys',    num: '05', label: 'Clés API' },
  { id: 'kbd',     num: '06', label: 'Raccourcis' },
  { id: 'format',  num: '07', label: 'Formats de fichiers' },
];

const TABS_TABLE = [
  { icon: '📋', name: 'Projet',        what: 'Présentation, liens code source.',                                 key: 'Aucune' },
  { icon: '🔎', name: 'Explorer JDM',  what: 'Table de triplets pour un terme/relation. Déterministe.',          key: 'Aucune' },
  { icon: '⚖️', name: 'Claim checker', what: 'SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet. Déterministe.', key: 'Aucune' },
  { icon: '🕸️', name: 'Sous-graphe',   what: 'Visualisation vis-network interactive du voisinage.',              key: 'Aucune' },
  { icon: '🤖', name: 'Agent',         what: 'Chat libre avec un agent LLM qui utilise les outils JDM.',         key: 'Gemini gratuit · BYOK Claude/GPT' },
  { icon: '🦾', name: 'Jarvis',        what: 'Agents guidés par formulaires (5 sous-onglets).',                    key: 'Gemini · LLMDrops si soumission' },
  { icon: '🛠️', name: 'Aide',          what: 'Ce document.',                                                      key: '—' },
];

const JARVIS_AGENTS_HELP = [
  { id: 'enrich',      icon: '🌱', accent: 'var(--jdm-green)',   name: 'Enrichissement', wf: 'enrichment_workflow()',
    desc: 'Propose et consolide de nouveaux triplets pour un terme. Form : terme, relation cible (optionnelle), nombre cible, varier les relations, itérer jusqu\'au but, soumettre. Output : chatbot + fichier .enrich.' },
  { id: 'audit',       icon: '🔍', accent: 'var(--jdm-cyan)',    name: 'Audit',          wf: 'audit_workflow()',
    desc: 'Audit sémantique de la répartition des sens d\'un terme polysémique. Verdict par triplet (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative. Fichier .audit.' },
  { id: 'gap',         icon: '🕳️', accent: 'var(--jdm-violet)',  name: 'Détection de trous', wf: 'gap_detection_workflow()',
    desc: 'Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE). Tableau déterministe + synthèse narrative. Routage vers Enrich / Audit / Stats.' },
  { id: 'signalement', icon: '⚠️', accent: 'var(--jdm-magenta)', name: 'Signalement',    wf: 'signalement_workflow()',
    desc: 'Le LLM utilise son jugement linguistique pour flagger les triplets suspects (pas besoin de preuve d\'outil). Fichier .err avec catégorie de suspicion et justification.' },
  { id: 'stats',       icon: '📊', accent: 'var(--jdm-yellow)',  name: 'Stats',          wf: 'stats_workflow()',
    desc: 'Statistiques de couverture par terme et/ou par relation : n_total, n_pos, n_neg, max_w, min_w, mean_w par relation + 3-5 observations clés en prose.' },
];

const API_KEYS_TABLE = [
  { name: 'Gemini',          where: 'aistudio.google.com/apikey',     cost: 'Gratuit (500 req/jour, 3.1 Flash Lite)', when: 'Pré-configurée côté serveur',
    url: 'https://aistudio.google.com/apikey', tone: 'free' },
  { name: 'LLMDrops JDM',    where: 'jeuxdemots.org (contact M. Lafourcade)', cost: 'Gratuit sur demande', when: 'Pousser .enrich / .audit / .err',
    url: 'https://www.jeuxdemots.org', tone: 'free' },
  { name: 'Anthropic (Claude)', where: 'console.anthropic.com',       cost: 'Payant ($)',                              when: 'BYOK Claude dans Agent / Jarvis',
    url: 'https://console.anthropic.com', tone: 'paid' },
  { name: 'OpenAI (GPT)',    where: 'platform.openai.com',            cost: 'Payant ($)',                              when: 'BYOK GPT dans Agent / Jarvis',
    url: 'https://platform.openai.com/api-keys', tone: 'paid' },
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

// ── Code block stylisé avec header type "terminal" ───────────────────
function CodeBlock({ label, language, children }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--line)',
      background: 'var(--bg-card)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f56','#ffbd2e','#27c93f'].map((c, i) => (
            <span key={i} style={{
              width: 9, height: 9, borderRadius: '50%',
              background: c, opacity: 0.55,
            }}/>
          ))}
        </div>
        <span style={{ marginLeft: 4 }}>{label}</span>
        {language && (
          <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>{language}</span>
        )}
      </div>
      <pre style={{
        margin: 0, padding: '16px 18px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12, lineHeight: 1.65,
        color: 'var(--ink)',
        overflowX: 'auto', whiteSpace: 'pre',
      }}>{children}</pre>
    </div>
  );
}

// ── Header de section : numéro accent + titre serif + ligne ──────────
function AideSectionHeader({ num, title, kicker }) {
  return (
    <div id={`aide-${num}`} style={{
      marginBottom: 20,
      paddingTop: 8,
      scrollMarginTop: 80,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14,
        marginBottom: kicker ? 8 : 0,
      }}>
        <span className="mono" style={{
          fontSize: 12, color: 'var(--accent)',
          fontWeight: 700, letterSpacing: '0.08em',
        }}>{num}</span>
        <h2 className="display" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26, fontWeight: 600,
          letterSpacing: '-0.015em',
          margin: 0, color: 'var(--ink)',
        }}>{title}</h2>
        <div style={{
          flex: 1, height: 1,
          background: 'linear-gradient(to right, var(--line) 0%, transparent 100%)',
          marginLeft: 6,
        }}/>
      </div>
      {kicker && (
        <p style={{
          margin: 0, marginLeft: 38,
          fontSize: 13, color: 'var(--ink-2)',
          lineHeight: 1.55, maxWidth: '64ch',
        }}>{kicker}</p>
      )}
    </div>
  );
}

// ── Table des matières sticky (left rail) ────────────────────────────
function AideTOC() {
  const [active, setActive] = useState('tour');
  useEffect(() => {
    const onScroll = () => {
      // Trouve la section dont le top est le plus proche du viewport
      let best = 'tour', bestDist = Infinity;
      AIDE_SECTIONS.forEach(s => {
        const el = document.getElementById(`aide-${s.num}`);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const dist = Math.abs(top - 100);
        if (top < 200 && dist < bestDist) {
          bestDist = dist; best = s.id;
        }
      });
      setActive(best);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (s) => {
    const el = document.getElementById(`aide-${s.num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Table des matières" style={{
      position: 'sticky', top: 80,
      display: 'flex', flexDirection: 'column', gap: 2,
      paddingLeft: 14,
      borderLeft: '1px solid var(--line-soft)',
    }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.14em',
        marginBottom: 10, fontWeight: 600,
      }}>Sommaire</div>
      {AIDE_SECTIONS.map(s => {
        const on = active === s.id;
        return (
          <button key={s.id}
            type="button"
            onClick={() => go(s)}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: on ? 'var(--accent)' : 'var(--ink-2)',
              transition: 'color 0.18s',
              position: 'relative',
            }}>
            {on && (
              <span style={{
                position: 'absolute',
                left: -15, top: '50%',
                transform: 'translateY(-50%)',
                width: 2, height: 16,
                background: 'var(--accent)',
              }}/>
            )}
            <span className="mono" style={{
              fontSize: 10, opacity: 0.7,
              minWidth: 18,
            }}>{s.num}</span>
            <span style={{
              fontSize: 13,
              fontWeight: on ? 600 : 400,
            }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ViewAide() {
  return (
    <PageShell>
      {/* HERO bloc compact : intro + chips de raccourcis vers sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 28,
        alignItems: 'center',
        padding: '24px 28px',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 40,
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 30, color: 'var(--bg)' }}>?</span>
        </div>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.18em',
            marginBottom: 6,
          }}>Documentation</div>
          <h1 className="display" style={{
            fontFamily: 'var(--font-display)',
            margin: 0,
            fontSize: 30, fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}>Aide &amp; Installation</h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: 14,
            color: 'var(--ink-2)',
            lineHeight: 1.55,
            maxWidth: '70ch',
          }}>
            Naviguer la démo, installer en local, brancher le MCP, comprendre
            les formats de soumission JDM. Sommaire à gauche, contenu à droite.
          </p>
        </div>
      </div>

      {/* Layout 2 colonnes : TOC sticky | contenu */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 40,
        alignItems: 'start',
      }}>
        <AideTOC />

        <div style={{ minWidth: 0 }}>
          {/* 01 — Tour des onglets */}
          <AideSectionHeader num="01" title="Tour des onglets"
            kicker="7 onglets, chacun avec sa fonction. Cartes ci-dessous : ce que fait l'onglet et quelle clé API il consomme." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10, marginBottom: 48,
          }}>
            {TABS_TABLE.map((t) => (
              <div key={t.name} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: 14,
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{t.name}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 8 }}>
                  {t.what}
                </div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Clé : <span style={{ color: 'var(--accent)' }}>{t.key}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 02 — Jarvis */}
          <AideSectionHeader num="02" title="Jarvis en détail"
            kicker="5 flows guidés. Tous partagent un bandeau (clé LLMDrops, modèle, budget d'appels d'outils 10 / 25 / 50 / 100 / illimité)." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12, marginBottom: 48,
          }}>
            {JARVIS_AGENTS_HELP.map(f => (
              <div key={f.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${f.accent}`,
                borderRadius: 'var(--radius-lg)',
                padding: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{f.icon}</span>
                  <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{f.name}</strong>
                  <code className="mono" style={{
                    marginLeft: 'auto',
                    background: 'var(--bg-elev)',
                    padding: '3px 8px', borderRadius: 4,
                    fontSize: 10, color: f.accent, fontWeight: 600,
                  }}>{f.wf}</code>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* 03 — Installation */}
          <AideSectionHeader num="03" title="Installation locale"
            kicker="Sur Debian 12 / Ubuntu 24.04 (PEP 668), le venv est obligatoire — pip refuse hors venv." />
          <CodeBlock label="install.sh" language="bash">{INSTALL_SCRIPT}</CodeBlock>
          <div style={{
            fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6,
            padding: '12px 16px',
            background: 'var(--bg-elev)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '0 var(--radius) var(--radius) 0',
            marginBottom: 48,
          }}>
            <strong style={{ color: 'var(--ink)' }}>Reverse-proxy</strong> — pour servir sur un sous-chemin (<code className="mono">/Jarvis/</code> par ex.),
            mets <code className="mono">APP_SUBPATH=/Jarvis</code> dans <code className="mono">.env</code>. Le frontend injecte <code className="mono">&lt;base href&gt;</code> automatiquement et les fetch API se résolvent.
          </div>

          {/* 04 — MCP */}
          <AideSectionHeader num="04" title="Serveur MCP"
            kicker="Expose les outils JDM dans Claude Code / Cursor / tout client MCP-compatible." />
          <CodeBlock label="claude-code" language="bash">{MCP_SCRIPT}</CodeBlock>
          <p style={{
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6,
            margin: '0 0 48px',
          }}>
            Ensuite depuis Claude Code : <em>« Donne-moi les synonymes de voiture dans JDM »</em> → l'agent appelle automatiquement les outils MCP exposés.
          </p>

          {/* 05 — Clés API */}
          <AideSectionHeader num="05" title="Clés API"
            kicker="Quatre fournisseurs possibles, deux gratuits et deux payants." />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 10, marginBottom: 12,
          }}>
            {API_KEYS_TABLE.map(k => (
              <a key={k.name} href={k.url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: 16,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'transform 0.18s, border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = k.tone === 'free' ? 'var(--jdm-green)' : 'var(--jdm-yellow)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px -10px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{k.name}</strong>
                  <Pill color={k.tone === 'free' ? 'var(--jdm-green)' : 'var(--jdm-yellow)'} tone="outline">
                    {k.tone === 'free' ? 'Gratuit' : 'Payant'}
                  </Pill>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 8 }}>{k.where}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>{k.cost}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>{k.when}</div>
                <span style={{ position: 'absolute', bottom: 12, right: 14, color: 'var(--accent)', fontSize: 14 }}>↗</span>
              </a>
            ))}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--ink-3)',
            marginBottom: 48, lineHeight: 1.6,
            padding: '10px 14px',
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line)',
            borderRadius: 'var(--radius)',
          }}>
            ⚠ <strong style={{ color: 'var(--ink-2)' }}>Sécurité</strong> — les clés que tu colles dans l'UI ne sont
            <strong style={{ color: 'var(--ink)' }}> jamais persistées</strong> côté serveur — elles vivent uniquement le temps de ton onglet.
          </div>

          {/* 06 — Raccourcis */}
          <AideSectionHeader num="06" title="Raccourcis clavier" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 10, marginBottom: 48,
          }}>
            {SHORTCUTS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {s.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* 07 — Formats */}
          <AideSectionHeader num="07" title="Format des fichiers de soumission"
            kicker="Tous les fichiers produits par Jarvis suivent un format pipe." />
          <CodeBlock label="formats" language="pipe">{FORMAT_TEXT}</CodeBlock>
          <div style={{
            fontSize: 13, color: 'var(--ink-2)',
            marginBottom: 48, lineHeight: 1.6,
          }}>
            Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
            <ul style={{ marginTop: 8, paddingLeft: 22 }}>
              <li style={{ marginBottom: 4 }}>coche <strong style={{ color: 'var(--ink)' }}>Soumettre directement</strong> dans le formulaire (clé <code className="mono">JDM_DROPS_API_KEY</code> requise) ;</li>
              <li>ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.</li>
            </ul>
          </div>

          {/* Panneau admin — réservé ?admin=1 */}
          <div className="admin-only" style={{ marginBottom: 40 }}>
            <AideSectionHeader num="08" title="Panneau admin" />
            <AdminPanel />
          </div>

          {/* Footer institutionnel */}
          <div style={{
            padding: 28,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18,
          }}>
            <JDMMark size={36} />
            <div>
              <div className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
                marginBottom: 4,
              }}>jdmAgent</div>
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
      </div>
    </PageShell>
  );
}

// ─── Panneau admin (gate par mot de passe) — inchangé ─────────────────

function AdminPanel() {
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [allVars, setAllVars] = useState({});
  const [edits, setEdits] = useState({});
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
