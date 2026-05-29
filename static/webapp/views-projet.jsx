// === webapp/views-projet.jsx ===
// View: Projet — landing page.
//
// Three vertical panels with scroll-snap:
//   1. Hero        : animated graph + chat demo (top), then text + stats (bottom)
//   2. Modules     : SectionTitle + carousel of 5 feature cards
//   3. Sous le capot : 4 briefs + footer
//
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).
// All canonical text from the original views-projet.jsx is preserved.

// Palette commune (stats + feature cards) — accents JDM.
const ACCENT_PALETTE = [
  'var(--jdm-yellow)',
  'var(--jdm-orange)',
  'var(--jdm-magenta)',
  'var(--jdm-green)',
  'var(--jdm-cyan)',
];

// Mélange Fisher-Yates puis renvoie N premières — garantit que toutes
// les couleurs sont distinctes (tant que N ≤ taille de palette).
function useShuffledAccents(n) {
  return React.useMemo(() => {
    const a = ACCENT_PALETTE.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const out = [];
    for (let k = 0; k < n; k++) out.push(a[k % a.length]);
    return out;
  }, [n]);
}

// PANELS — ordre VISUEL pour navigation :
//   • bref     (Sous le capot)  → à gauche / en haut
//   • hero     (Présentation)   → au centre (entrée par défaut)
//   • modules  (Modules)        → à droite / en bas
// Cet ordre détermine la position sur la track ; index initial = 1 (hero).
const PANELS = [
  { id: 'bref',     label: 'Sous le capot',  symbol: '♠' },
  { id: 'hero',     label: 'Présentation',   symbol: '♥' },
  { id: 'modules',  label: 'Modules',        symbol: '♦' },
];

function ViewProjet({ goto }) {
  // ─── Carousel state ───
  // Au lieu de scroll-snap natif, on utilise une track translatée. C'est
  // un "carousel géant" — toute la page glisse comme un bloc.
  // direction = 'vertical' (translateY) ou 'horizontal' (translateX).
  // La nav du bas force horizontal, le rail gauche force vertical.
  const [panelIndex, setPanelIndex] = useState(1);  // hero = milieu = entrée par défaut
  const [direction, setDirection] = useState('vertical');
  const [transitioning, setTransitioning] = useState(true);
  const totalPanels = PANELS.length;

  const goToIndex = useCallback((i) => {
    setPanelIndex(Math.max(0, Math.min(totalPanels - 1, i)));
  }, [totalPanels]);

  // External nav hook : let other components (e.g. the topbar wordmark)
  // jump to a specific panel via window.dispatchEvent.
  useEffect(() => {
    const onPanel = (e) => {
      const i = e.detail?.index;
      if (typeof i === 'number') goToIndex(i);
    };
    window.addEventListener('jdm:projet-panel', onPanel);
    return () => window.removeEventListener('jdm:projet-panel', onPanel);
  }, [goToIndex]);

  const activePanel = PANELS[panelIndex].id;

  // Handlers spécifiques aux 2 navs : forcent la direction d'anim.
  // Si on switche de direction (V→H ou H→V), on snap d'abord au même
  // panelIndex dans la nouvelle direction (sans anim), puis on anime
  // vers la cible. Évite le « slide diagonal » disgracieux.
  const switchTo = (newDir, targetIdx) => {
    if (direction === newDir) {
      goToIndex(targetIdx);
      return;
    }
    // Phase 1 — snap sans anim à la nouvelle direction, panelIndex inchangé.
    setTransitioning(false);
    setDirection(newDir);
    // Phase 2 — sur le frame suivant (double rAF pour que React ait
    // committé le snap), on ré-active l'anim et on bouge vers la cible.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
        goToIndex(targetIdx);
      });
    });
  };
  const goFromBottom = (id) => {
    const idx = PANELS.findIndex(p => p.id === id);
    if (idx >= 0) switchTo('horizontal', idx);
  };
  const goFromLeft = (id) => {
    const idx = PANELS.findIndex(p => p.id === id);
    if (idx >= 0) switchTo('vertical', idx);
  };

  // ─── Wheel : un cran de molette = un panneau, debouncé ───
  useEffect(() => {
    let lock = false;
    let resetTimer = null;
    const onWheel = (e) => {
      // Ne pas bloquer le scroll dans les zones internes scrollables
      // (carousel des cards, log Jarvis, etc.) — on check si le scroll
      // peut être absorbé par un ancêtre.
      let el = e.target;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll')
            && el.scrollHeight > el.clientHeight) {
          return;  // un parent gère, on laisse passer
        }
        el = el.parentElement;
      }
      e.preventDefault();
      if (lock) return;
      lock = true;
      const dir = e.deltaY > 0 ? 1 : -1;
      setPanelIndex(prev => Math.max(0, Math.min(totalPanels - 1, prev + dir)));
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { lock = false; }, 850);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      clearTimeout(resetTimer);
    };
  }, [totalPanels]);

  // ─── Clavier : flèches up/down, page up/down, home/end ───
  useEffect(() => {
    const onKey = (e) => {
      // N'interfère pas si on est dans un input/textarea
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(panelIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(panelIndex - 1);
      } else if (e.key === 'Home') {
        goToIndex(0);
      } else if (e.key === 'End') {
        goToIndex(totalPanels - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelIndex, goToIndex, totalPanels]);

  // ─── Touch : swipe haut/bas ───
  useEffect(() => {
    let startY = null;
    const onStart = (e) => { startY = e.touches[0].clientY; };
    const onEnd = (e) => {
      if (startY == null) return;
      const endY = e.changedTouches[0].clientY;
      const dy = startY - endY;
      if (Math.abs(dy) > 50) {
        goToIndex(panelIndex + (dy > 0 ? 1 : -1));
      }
      startY = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [panelIndex, goToIndex]);

  // Stats — chiffres tirés du README JDM (LIRMM/CNRS) et du projet.
  const stats = [
    { label: 'Termes JDM',   value: '2M+',    sub: 'JeuxDeMots'    },
    { label: 'Relations',    value: '180+',   sub: 'types typées'  },
    { label: 'Outils MCP',   value: '35',     sub: 'LangChain · FastMCP' },
    { label: 'Flux Jarvis',  value: '5',      sub: 'guidés'        },
  ];

  // Features
  const features = [
    {
      id: 'jarvis',
      title: '🤖 Jarvis',
      kind: '5 flux',
      primary: true,
      desc: 'Flux guidés par formulaires (zéro prompt à taper) : Enrichissement (.enrich), Audit (.audit), Détection de trous, Signalement (.err), Statistiques.',
      example: 'enrichissement → 17 triplets consolidés',
      detail: {
        lede: 'Cinq workflows agentiques guidés par formulaire — pas de prompt à écrire, l\'enchaînement outils + LLM + consolidation est canonique.',
        body: 'Chaque flux suit un workflow déterministe (defined-in-code) avec un budget de tokens, un budget d\'outils et un critère d\'arrêt. Le LLM ne décide jamais seul de continuer ; il propose, le moteur consolide ou rejette.',
        quickTry: {
          kind: 'select-and-term',
          options: [
            { value: 'enrich', label: 'Enrichissement' },
            { value: 'audit', label: 'Audit sémantique' },
            { value: 'gap', label: 'Détection de trous' },
            { value: 'signalement', label: 'Signalement' },
            { value: 'stats', label: 'Stats' },
          ],
          defaultValue: 'enrich',
          termDefault: 'voiture',
          mock: (flow, term) => `→ Lancement ${flow} sur "${term}" — ETA ~45s · cible 20 triplets`,
        },
      },
    },
    {
      id: 'agent',
      title: '💬 Chatbot LLM',
      kind: 'LLM · BYOK',
      desc: 'Conversation avec un agent (Gemini hébergé gratuit, ou BYOK Claude/GPT) qui n\'utilise QUE les outils JDM et cite ses sources.',
      example: '« Que mange typiquement un chat ? »',
      detail: {
        lede: 'Agent contraint à l\'usage exclusif des outils JDM. Toute affirmation factuelle est appuyée par un triplet cité.',
        body: 'Le modèle planifie en boucle (raisonnement → outil → observation) sans jamais répondre à partir de sa mémoire pré-entraînée seule. Si JDM ne couvre pas la question, l\'agent l\'explicite plutôt que d\'halluciner.',
        quickTry: {
          kind: 'prompt',
          placeholder: 'Que mange typiquement un chat ?',
          defaultValue: 'Que mange typiquement un chat ?',
          models: [
            { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash · gratuit' },
            { value: 'gemini-2.0-pro',        label: 'Gemini 2.0 Pro · BYOK' },
            { value: 'claude-4.5-sonnet',     label: 'Claude 4.5 Sonnet · BYOK' },
            { value: 'gpt-5-mini',            label: 'GPT-5 mini · BYOK' },
            { value: 'llama-4-70b',           label: 'Llama 4 70B · local' },
          ],
          defaultModel: 'gemini-3.1-flash-lite',
          mock: (q, model) => `agent (${model}) → recherche dans JDM (r_agent-1, r_mange) → 4 triplets retournés · w_moyen=621`,
        },
      },
    },
    {
      id: 'subgraph',
      title: '🕸️ Sous-graphe',
      kind: 'visuel',
      desc: 'Visualisation interactive (vis-network) du voisinage sémantique d\'un terme jusqu\'à profondeur 4, sélection de relations indépendante par niveau, négations en rouge.',
      example: 'plat asiatique · depth 1 · 8 relations',
      detail: {
        lede: 'Sous-graphe lexico-sémantique d\'un terme, filtré par relation et par profondeur — un instrument de lecture, pas seulement de visualisation.',
        body: 'Construit un HTML autonome (zéro requête externe) qui peut être archivé dans un dépôt de publication. Palette par famille de relation, négations marquées en rouge, opacité dégradée par profondeur.',
        quickTry: {
          kind: 'term-and-depth',
          termDefault: 'voiture',
          depthDefault: 2,
          mock: (term, depth) => `→ ${term} · depth=${depth} · ~${Math.floor(8 + depth * 12)} arcs estimés`,
        },
      },
    },
    {
      id: 'claim',
      title: '⚖️ Claim checker',
      kind: 'déterministe',
      desc: 'Vérifie une affirmation factuelle contre JDM de façon déterministe (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN avec citations des triplets utilisés.',
      example: 'baleine | r_isa | poisson → ❌',
      detail: {
        lede: 'Vérification déterministe d\'un triplet contre JDM — pas de LLM dans la boucle de jugement, le verdict est rejouable et auditable.',
        body: 'L\'effort de vérification est paramétrable (0 = match direct ; 1 = contenance ; 2+ = inférence transitive bornée). Chaque verdict est accompagné de la chaîne d\'évidence (triplets cités, poids).',
        quickTry: {
          kind: 'triplet',
          defaults: { s: 'baleine', r: 'r_isa', o: 'mammifère' },
          mock: (s, r, o) => {
            const key = `${s}|${r}|${o}`.toLowerCase();
            if (s === 'baleine' && o === 'mammifère') {
              return {
                verdict: 'SUPPORTED', confidence: 0.92,
                triplet: { s, r, o },
                chain: [
                  { from: 'baleine', rel: 'r_isa', to: 'cétacé',    w: 2014 },
                  { from: 'cétacé',  rel: 'r_isa', to: 'mammifère', w: 1421 },
                ],
                note: '2 hops · transitivité de r_isa',
              };
            }
            if (s === 'baleine' && o === 'poisson') {
              return {
                verdict: 'CONTRADICTED', confidence: 0.88,
                triplet: { s, r, o },
                chain: [
                  { from: 'baleine', rel: 'r_isa',       to: 'mammifère', w: 1421 },
                  { from: 'baleine', rel: 'r_isa_not',   to: 'poisson',   w:  734, neg: true },
                ],
                note: 'négation explicite trouvée (r_isa_not)',
              };
            }
            return {
              verdict: 'UNKNOWN', confidence: 0,
              triplet: { s, r, o },
              chain: [],
              note: 'aucune chaîne d\'inférence (≤ k=2) ni triplet direct',
            };
          },
        },
      },
    },
    {
      id: 'explorer',
      title: '🔎 Explorer JDM',
      kind: 'instant',
      desc: 'Choisis un terme et une relation, vois les triplets triés par poids consensuel. Annotations sémantiques (constitutif, contrastif, exception…) optionnelles. Désambiguïsation des termes polysémiques (avocat, souris, police…).',
      example: 'chat | r_has_part | ?',
      detail: {
        lede: 'Table déterministe des triplets d\'un terme pour une relation — l\'instrument le plus simple pour inspecter JDM.',
        body: 'Tri par poids consensuel décroissant. Désambiguïsation polysémique optionnelle (avocat, souris, police…). Annotations sémantiques (constitutif, contrastif, exception).',
        quickTry: {
          kind: 'term-and-relation',
          termDefault: 'chat',
          relationDefault: 'r_has_part',
          mock: (term, rel) => `→ ${term} | ${rel} → 12 triplets · 1ers : tête (w=1842) · patte (w=1721) · queue (w=1640)`,
        },
      },
    },
  ];

  const briefs = [
    {
      title: 'Client typé + cache disque',
      body: <>Couche client <code>JDMClient</code> sur l&apos;<a href="https://jdm-api.demo.lirmm.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>API JeuxDeMots</a>, cache disque, retry exponentiel.</>,
      // ── Detail panel content ─────────────────────────────────────────
      detail: {
        kicker: 'Reproductibilité · Abstraction typée',
        lede: 'Une couche d\'abstraction Python entre l\'agent et l\'API JeuxDeMots — pas un wrapper trivial, mais un substrat qui rend les workflows agentiques auditables, déterministes et rejouables.',
        paragraphs: [
          <>Les <em>workflows agentiques</em> souffrent classiquement d&apos;un problème de reproductibilité : un même prompt produit des appels API distincts à chaque exécution, rendant l&apos;audit et la régression difficiles. Le client typé matérialise chaque réponse JDM en objet Python (<code>Term</code>, <code>Relation</code>, <code>Triplet</code>), sérialisé sur disque dans un cache LRU adressé par hash de requête.</>,
          <>Cette indirection ouvre trois bénéfices : <strong>hors-ligne</strong> (un workflow déjà exécuté peut être rejoué sans accès réseau), <strong>idempotence</strong> (deux runs du même flow produisent strictement le même artefact), <strong>traçabilité</strong> (chaque triplet consolidé pointe vers la requête API qui l&apos;a produit, avec timestamp et version du cache).</>,
        ],
        citations: [
          { author: 'Lafourcade, M.', year: 2007, title: 'Making people play for Lexical Acquisition with the JeuxDeMots prototype', venue: 'SNLP\'07, Pattaya' },
          { author: 'Schick, T. et al.', year: 2023, title: 'Toolformer: Language Models Can Teach Themselves to Use Tools', venue: 'NeurIPS' },
          { author: 'Anthropic', year: 2024, title: 'Model Context Protocol — Specification', venue: 'Technical Report' },
        ],
        cta: { label: 'Voir le client sur GitHub →', href: 'https://github.com/expAg/JDMAgent' },
      },
    },
    {
      title: '~35 outils MCP exposés',
      body: <>À n&apos;importe quel client (Claude Code/Desktop, Cursor, etc.) via <a href="https://github.com/jlowin/fastmcp" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>FastMCP</a>.</>,
      detail: {
        kicker: 'Interopérabilité · Outils standardisés',
        lede: 'Le Model Context Protocol comme standard d\'accès à une base de connaissance lexico-sémantique — une trentaine d\'outils typés exposés à tout client compatible (Claude Code, Claude Desktop, Cursor, OpenAI Realtime…).',
        paragraphs: [
          <>L&apos;exposition MCP transforme JeuxDeMots d&apos;une API REST traditionnelle en un <em>knowledge backend</em> consultable nativement par les agents LLM. Chaque outil porte une <strong>signature typée</strong> (Pydantic) et une <strong>docstring discriminante</strong> — le LLM choisit l&apos;outil par similarité sémantique sans heuristique côté serveur.</>,
          <>Le découpage suit la sémantique JDM, pas l&apos;API : <code>get_relations(term, relation_type)</code> plutôt qu&apos;un endpoint paramétrique générique. Cela réduit l&apos;espace de décision du modèle et accroît la précision du tool-calling — un effet documenté par <em>Patil et al. (2024)</em> dans l&apos;évaluation de Gorilla.</>,
        ],
        citations: [
          { author: 'Patil, S.G. et al.', year: 2024, title: 'Gorilla: Large Language Model Connected with Massive APIs', venue: 'NeurIPS' },
          { author: 'Yao, S. et al.', year: 2023, title: 'ReAct: Synergizing Reasoning and Acting in Language Models', venue: 'ICLR' },
          { author: 'Lafourcade, M. & Joubert, A.', year: 2008, title: 'Une approche lexico-sémantique du jeu pour l\'acquisition de connaissances', venue: 'TALN' },
        ],
        cta: { label: 'Lire l\'USAGE MCP →', href: 'https://github.com/expAg/JDMAgent/blob/main/USAGE.md' },
      },
    },
    {
      title: 'Pipeline fact-check + inférence',
      body: <>Détermination + détection de gaps + <strong>moteur d&apos;inférence symbolique borné</strong> pour la consolidation des candidats avant soumission au canal contributif LLMDrops de JDM.</>,
      detail: {
        kicker: 'Neuro-symbolique · Consolidation',
        lede: 'Au cœur du projet : un pipeline neuro-symbolique qui mobilise un LLM pour proposer des connaissances, puis un moteur d\'inférence borné pour vérifier, contraindre et consolider avant écriture dans la base.',
        paragraphs: [
          <>L&apos;agent illustre une instance pragmatique de l&apos;<em>approche neuro-symbolique</em> formalisée par <strong>Garcez & Lamb (2020)</strong> : le LLM joue le rôle de <em>générateur sous-contraint</em> (créativité, formulation, désambiguïsation), tandis que le moteur d&apos;inférence sur la base JDM joue le rôle de <em>vérificateur formel</em> (cohérence, antonymie, transitivité bornée).</>,
          <>La consolidation procède en trois passes : <strong>(i) génération</strong> — le modèle propose <code>n</code> triplets candidats pour un terme cible ; <strong>(ii) vérification</strong> — chaque candidat est soumis au claim-checker déterministe (chaîne d&apos;inférence ≤ k, contradiction explicite, sub-graphe d&apos;évidence) ; <strong>(iii) annotation</strong> — les triplets survivants sont étiquetés (légitime, contrastif, sens-spécifique) puis sérialisés dans le format de soumission JDM (canal LLMDrops).</>,
          <>Cette architecture évite à la fois l&apos;écueil des <em>hallucinations symboliques pures</em> (génération sans LLM = peu inventive) et celui des <em>hallucinations neurales</em> (LLM sans contrôle symbolique = injection de bruit dans la base).</>,
        ],
        citations: [
          { author: 'd\'Avila Garcez, A. & Lamb, L.C.', year: 2020, title: 'Neurosymbolic AI: The 3rd Wave', venue: 'arXiv:2012.05876' },
          { author: 'Hitzler, P. & Sarker, M.K.', year: 2021, title: 'Neuro-Symbolic Artificial Intelligence: The State of the Art', venue: 'IOS Press' },
          { author: 'Marcus, G.', year: 2020, title: 'The Next Decade in AI: Four Steps Towards Robust AI', venue: 'arXiv:2002.06177' },
          { author: 'Pan, S. et al.', year: 2024, title: 'Unifying Large Language Models and Knowledge Graphs: A Roadmap', venue: 'IEEE TKDE' },
        ],
        cta: { label: 'Comprendre le pipeline →', href: 'https://github.com/expAg/JDMAgent/blob/main/docs/pipeline.md' },
      },
    },
    {
      title: 'Sous-graphe HTML autonome',
      body: <>vis-network avec sélection de relations par niveau, palette par famille de relation, opacité progressive.</>,
      detail: {
        kicker: 'Explicabilité · Graphes lexico-sémantiques',
        lede: 'Visualisation du voisinage sémantique comme outil d\'explicabilité : le chercheur ou le contributeur voit pourquoi un triplet a été retenu ou rejeté, sans relancer l\'agent.',
        paragraphs: [
          <>JeuxDeMots compte ~2 millions de termes et 180+ relations typées et pondérées (<em>Lafourcade, 2007</em>). Naviguer ce graphe à profondeur ≥ 2 sans filtrage produit des sous-graphes hyper-denses inutilisables visuellement (densité moyenne &gt; 80 arcs/nœud sur les termes-vedettes).</>,
          <>Le module construit un sous-graphe avec <strong>sélection indépendante par profondeur</strong> et <strong>palette par famille de relation</strong> — choix de design issus des conventions de visualisation de graphes lexicaux (<em>Crouch et al., 2019</em>). L&apos;HTML produit est <strong>autonome</strong> (zéro requête externe) pour rester archivable dans un dépôt de publication.</>,
        ],
        citations: [
          { author: 'Lafourcade, M.', year: 2007, title: 'Making people play for Lexical Acquisition', venue: 'SNLP\'07' },
          { author: 'Crouch, R. et al.', year: 2019, title: 'Lexical Semantics in the Age of LLMs', venue: 'CL Journal' },
          { author: 'Almeida, A. & Lafourcade, M.', year: 2015, title: 'Sentiment polarity and term relevance in JeuxDeMots', venue: 'LREC' },
        ],
        cta: { label: 'Ouvrir le module Sous-graphe →', goto: 'subgraph' },
      },
    },
  ];

  // Pan style : on rend les DEUX navs en même temps maintenant.
  return (
    <>
      <NavLeftRail   activePanel={activePanel} onSelect={goFromLeft} />
      <NavBottomDots activePanel={activePanel} onSelect={goFromBottom} />
      <style>{`
        @media (max-width: 720px) {
          nav[aria-label="Navigation entre panneaux bas"] {
            bottom: 14px !important;
            transform: translateX(-50%) scale(0.85) !important;
            transform-origin: bottom center !important;
          }
        }
      `}</style>

      {/* Carousel container — viewport plein, sous la nav */}
      <div style={{
        position: 'relative',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}>
        {/* Track : N panneaux empilés (vertical) ou alignés (horizontal),
            transform: translateY OU translateX selon direction. */}
        <div style={{
          height: direction === 'vertical' ? `${totalPanels * 100}%` : '100%',
          width:  direction === 'vertical' ? '100%' : `${totalPanels * 100}%`,
          display: 'flex',
          flexDirection: direction === 'vertical' ? 'column' : 'row',
          transform: direction === 'vertical'
            ? `translate3d(0, -${(panelIndex / totalPanels) * 100}%, 0)`
            : `translate3d(-${(panelIndex / totalPanels) * 100}%, 0, 0)`,
          transition: transitioning
            ? 'transform 0.85s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'none',
          willChange: 'transform',
        }}>
          {/* ── Panneau 1 — Sous le capot (gauche / haut) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}>
              <SectionTitle
                kicker="Sous le capot"
                title="Le projet en bref"
                desc="Quatre piliers techniques qui rendent l'agent fiable, reproductible et accessible à toute la chaîne d'outils LLM modernes."
              />

              <ExpandableBriefsGrid briefs={briefs} goto={goto} />

              <div style={{
                padding: 24,
                background: 'var(--bg-elev)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'var(--font-display)',
                    fontSize: 18, fontWeight: 600, marginBottom: 6,
                  }}>
                    <GitHubMark size={20} />
                    <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                      Projet open-source
                    </a>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    Données : <strong>JeuxDeMots</strong> — Mathieu Lafourcade, équipe SLICE, LIRMM/CNRS.
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                    <a href="https://github.com/expAg/JDMAgent" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>Code source</a>
                    <span style={{ color: 'var(--ink-3)' }}>·</span>
                    <a href="https://github.com/expAg/JDMAgent/blob/main/USAGE.md" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>USAGE.md</a>
                    <span style={{ color: 'var(--ink-3)' }}>·</span>
                    <a href="https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>Notebook Colab</a>
                  </div>
                </div>
              </div>
            </div>
          </CarouselPanel>{/* ── Panneau 2 — Présentation (centre, entrée) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(20px, 3vh, 36px)',
            }}>
              <HeroAnimation height={Math.min(320, Math.round(window.innerHeight * 0.34))} />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: 48,
                alignItems: 'center',
              }}>
                <div>
                  <div className="mono" style={{
                    fontSize: 11, color: 'var(--ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                    marginBottom: 14,
                  }}>
                    LIRMM · CNRS · Université de Montpellier
                  </div>
                  <h1 className="display" style={{
                    fontFamily: 'var(--font-display)',
                    margin: 0,
                    fontSize: 'clamp(32px, 4.5vw, 56px)',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    color: 'var(--ink)',
                  }}>
                    Agent <em style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic', color: 'var(--accent)',
                    }}>Jarvis</em> :<br/>Plateforme web.
                  </h1>
                  <p style={{
                    marginTop: 18,
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: 'var(--ink-2)',
                    maxWidth: '52ch',
                  }}>
                    Projet d&apos;agentification de la ressource lexico-sémantique{' '}
                    <a href="https://www.jeuxdemots.org" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>JeuxDeMots</a>{' '}
                    (LIRMM/CNRS, ~2 M nœuds, 180+ relations typées et pondérées) pour les{' '}
                    <strong style={{ color: 'var(--ink)' }}>LLM modernes</strong> via{' '}
                    <strong style={{ color: 'var(--ink)' }}>LangChain</strong> et le{' '}
                    <strong style={{ color: 'var(--ink)' }}>Model Context Protocol</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                    <Button onClick={() => goto('jarvis')}>Jarvis →</Button>
                    <Button variant="secondary" onClick={() => goto('agent')}>Discuter avec JDM</Button>
                    <Button variant="secondary" onClick={() => goto('subgraph')}>Visualiser</Button>
                    <Button variant="secondary" onClick={() => goto('explorer')}>Explorer</Button>
                  </div>
                </div>

                <StatsGrid stats={stats} />
              </div>
            </div>
          </CarouselPanel>

          {/* ── Panneau 3 — Modules (droite / bas) ── */}
          <CarouselPanel>
            <div style={{
              width: '100%',
              maxWidth: 1320,
              display: 'flex',
              flexDirection: 'column',
              gap: 32,
            }}>
              <SectionTitle
                kicker="Que peux-tu faire sur cette page ?"
                title={<>Fonctionnalités de l'API :<br/>Utilisation CLI, distant (à venir)</>}
                desc="Chaque fonctionnalité est accessible via remote API et en ligne de commande."
              />
              <ExpandableFeaturesPanel features={features} goto={goto} />
            </div>
          </CarouselPanel>

          
        </div>
      </div>
    </>
  );
}

// ─── Wrapper pour chaque panneau dans le carousel ───
// flex 1/N de la track (en main axis), padding uniforme.
function CarouselPanel({ children }) {
  return (
    <div style={{
      flex: '0 0 33.3333%',
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 28px 110px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  );
}

// ─── PanelNav : 2 variantes, l'indicateur ACTIF glisse entre items.
//   'bottom' (défaut) : pill horizontal en bas — indicateur glisse en X
//   'left'           : rail vertical à gauche — indicateur glisse en Y
//
// La variante est choisie via tweaks.navStyle (Tweaks panel ou
// window.__JDM_TWEAKS__.navStyle = 'left' | 'bottom').
function PanelDots({ activePanel, onSelect }) {
  // Re-read on tweaks change.
  const [style, setStyle] = useState(() =>
    (typeof window !== 'undefined' && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle) || 'bottom'
  );
  useEffect(() => {
    const sync = () => setStyle(
      (window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.navStyle) || 'bottom'
    );
    window.addEventListener('__jdm_tweaks_changed', sync);
    return () => window.removeEventListener('__jdm_tweaks_changed', sync);
  }, []);

  if (style === 'left') return <NavLeftRail   activePanel={activePanel} onSelect={onSelect} />;
  return                       <NavBottomDots activePanel={activePanel} onSelect={onSelect} />;
}

// ─── Variant : Bottom dots avec indicateur glissant ──────────────────
function NavBottomDots({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  // Mesure la position/largeur du bouton actif et anime l'indicateur.
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({
      x: ir.left - cr.left + cont.scrollLeft,
      w: ir.width,
      ready: true,
    });
  }, [activePanel]);

  // Re-mesure au resize (les labels peuvent changer de largeur).
  useEffect(() => {
    const onResize = () => {
      const activeEl = itemRefs.current[activePanel];
      const cont = containerRef.current;
      if (!activeEl || !cont) return;
      const cr = cont.getBoundingClientRect();
      const ir = activeEl.getBoundingClientRect();
      setIndicator(prev => ({ ...prev, x: ir.left - cr.left, w: ir.width }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePanel]);

  return (
    <nav
      ref={containerRef}
      aria-label="Navigation entre panneaux bas"
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 6,
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 999,
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 40,
        opacity: 0.5,
        transition: 'opacity 0.22s ease-out',
      }}>
      {/* Pill d'indicateur — glisse en horizontal */}
      <span aria-hidden="true" style={{
        position: 'absolute',
        left: indicator.x,
        width: indicator.w,
        top: 6, bottom: 6,
        background: 'var(--accent)',
        borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4, 0, 0.2, 1), width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s',
        zIndex: 0,
      }}/>
      {PANELS.map((p, i) => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.32s 0.05s',  // léger délai pour matcher l'arrivée du pill
              whiteSpace: 'nowrap',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              opacity: active ? 0.95 : 0.55,
              fontWeight: 600,
              letterSpacing: 0,
              textTransform: 'none',
              lineHeight: 1,
            }}>{p.symbol}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Variant : Left rail avec indicateur glissant verticalement ──────
//
// Comportement adaptatif piloté par la largeur du viewport :
//   - ≥ 1440px : rail complet avec symbole + label (mode 'full')
//   - 1180-1439 : rail compact, symbole uniquement (mode 'compact')
//   - < 1180px : rail entièrement caché (mode 'hidden')
//
// Cette logique est doublée par une mesure réelle de collision avec le
// contenu principal (.jdm-projet-content si présent) — si le rail
// chevauche le contenu, on bascule en hidden quelle que soit la largeur.
function NavLeftRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  const [mode, setMode] = useState('full');  // 'full' | 'compact' | 'hidden'

  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel, mode]);

  // Détection de largeur + collision avec le contenu hero.
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // Choix nominal basé sur la largeur.
      let next = w >= 1440 ? 'full' : w >= 1180 ? 'compact' : 'hidden';

      // Test de collision : on cherche un élément qui marque la zone
      // de contenu (h1.display dans le panneau hero, ou main centré).
      // Si le rail prévu (à gauche, 32px + 110-200px de large) chevauche,
      // on cache.
      if (next !== 'hidden') {
        const heroTextEl = document.querySelector('main h1.display');
        if (heroTextEl) {
          const r = heroTextEl.getBoundingClientRect();
          const railEdge = 32 + (next === 'full' ? 170 : 50);
          if (r.left < railEdge + 24) {
            // Si collision en mode full, tenter compact avant de cacher.
            if (next === 'full') {
              const compactEdge = 32 + 50;
              next = r.left < compactEdge + 24 ? 'hidden' : 'compact';
            } else {
              next = 'hidden';
            }
          }
        }
      }
      setMode(next);
    };
    compute();
    window.addEventListener('resize', compute);
    // Re-mesure après que le contenu hero ait bougé (changement de
    // panneau ou de thème).
    const id = setInterval(compute, 800);
    return () => { window.removeEventListener('resize', compute); clearInterval(id); };
  }, []);

  if (mode === 'hidden') return null;

  const compact = mode === 'compact';

  return (
    <nav
      ref={containerRef}
      aria-label="Navigation entre panneaux gauche"
      style={{
        position: 'fixed',
        left: compact ? 24 : 32,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        zIndex: 40,
        borderLeft: '1px solid var(--line)',
        paddingLeft: compact ? 10 : 16,
      }}>
      <span aria-hidden="true" style={{
        position: 'absolute',
        left: -1, top: indicator.y,
        height: indicator.h,
        width: 2,
        background: 'var(--accent)',
        opacity: indicator.ready ? 1 : 0,
        transition: 'top 0.42s cubic-bezier(0.4, 0, 0.2, 1), height 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s',
      }}/>
      {PANELS.map((p) => (
        <PanelNavItem
          key={p.id}
          ref={el => { if (el) itemRefs.current[p.id] = el; }}
          symbol={p.symbol}
          label={p.label}
          showLabel={!compact}
          active={activePanel === p.id}
          onClick={() => onSelect(p.id)}
        />
      ))}
    </nav>
  );
}

const PanelNavItem = React.forwardRef(function PanelNavItem({ symbol, label, showLabel, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? 'var(--accent)' : (hover ? 'var(--ink)' : 'var(--ink-3)');
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Aller à ${label}`}
      title={!showLabel ? label : undefined}
      style={{
        background: 'transparent',
        border: 'none',
        padding: showLabel ? '16px 0' : '14px 0',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        position: 'relative',
        color,
        transition: 'color 0.32s',
        fontFamily: 'inherit',
      }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: showLabel ? 22 : 18,
        fontWeight: 600,
        lineHeight: 1,
        color: 'inherit',
      }}>{symbol}</span>
      {showLabel && (
        <span className="mono" style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'inherit',
          fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap',
        }}>{label}</span>
      )}
    </button>
  );
});

function BackToTopBtn({ visible, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Revenir en haut"
      title="Revenir en haut"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: visible
          ? 'translate(-50%, 0)'
          : 'translate(-50%, 24px)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px',
        borderRadius: 999,
        border: '1px solid var(--line)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'opacity 0.25s, transform 0.25s, background 0.15s, color 0.15s',
        zIndex: 45,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent)';
        e.currentTarget.style.color = 'var(--bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.color = 'var(--ink)';
      }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>↑</span>
      Revenir en haut
    </button>
  );
}

function StatsGrid({ stats }) {
  const colors = useShuffledAccents(stats.length);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 1,
      background: 'var(--line)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {stats.map((s, i) => (
        <StatTile key={s.label} stat={s} hoverColor={colors[i]} />
      ))}
    </div>
  );
}

// ─── FeaturesGrid : carrousel avec FADE PAR MASK-IMAGE (pas par overlay).
//
// Solution aux deux bugs précédents :
//
//   1. Bleed à droite : mask-image fond GRADUELLEMENT le contenu en
//      transparent — au lieu d'un overlay opaque var(--bg), ce sont les
//      pixels eux-mêmes qui disparaissent. Aucun bleed possible.
//
//   2. Hover lift clippé : on ne touche plus à overflow. Le carousel a
//      `overflow-x: auto` et `overflow-y: hidden`, mais avec une padding
//      verticale (14px haut + bas) + margin négative compensatrice, le
//      hover lift (+ son ombre) s'épanouit dans la zone padded — pas
//      clippé visuellement. La mask-image fait le boulot du gradient.
function FeaturesGrid({ features, onCardClick, expandedId }) {
  const colors = useShuffledAccents(features.length);
  const scrollRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateBounds = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setCanPrev(!atStart);
    setCanNext(!atEnd);
  }, []);

  React.useEffect(() => {
    updateBounds();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateBounds, { passive: true });
    window.addEventListener('resize', updateBounds);
    return () => {
      el.removeEventListener('scroll', updateBounds);
      window.removeEventListener('resize', updateBounds);
    };
  }, [updateBounds]);

  // Animation JS du scroll : interpolation ease-out quint, 900ms.
  const animFrameRef = useRef(null);
  const animScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';

    const step = Math.max(320, el.clientWidth * 0.78);
    const start = el.scrollLeft;
    const target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, start + dir * step));
    const duration = 900;
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 5);
      el.scrollLeft = start + (target - start) * eased;
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
        el.style.scrollSnapType = prevSnap || 'x mandatory';
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  React.useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const btnStyle = (enabled) => ({
    width: 44, height: 44,
    borderRadius: '50%',
    border: '1px solid var(--line)',
    background: 'var(--bg-card)',
    color: 'var(--ink-2)',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? 'auto' : 'none',
    boxShadow: 'var(--shadow)',
    fontSize: 22, lineHeight: 1, fontWeight: 500,
    transition: 'background 0.15s, color 0.15s, transform 0.18s, opacity 0.25s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });

  const hoverIn = (e) => {
    e.currentTarget.style.background = 'var(--accent)';
    e.currentTarget.style.color = 'var(--bg)';
    e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
  };
  const hoverOut = (e) => {
    e.currentTarget.style.background = 'var(--bg-card)';
    e.currentTarget.style.color = 'var(--ink-2)';
    e.currentTarget.style.transform = 'translateY(-50%)';
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => animScroll(-1)}
        aria-label="Défiler à gauche"
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{
          ...btnStyle(canPrev),
          position: 'absolute',
          left: -56, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 6,
        }}>‹</button>

      <div
        ref={scrollRef}
        className={`jdm-carousel ${canNext ? 'jdm-carousel--fade-right' : ''}`}
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          // Padding vertical = breathing room pour le hover lift + son
          // ombre. Margin négative compense pour conserver l'alignement
          // visuel avec les autres éléments de la page.
          padding: '14px 4px',
          margin: '-14px -4px',
          scrollSnapType: 'x mandatory',
        }}>
        {features.map((f, i) => (
          <div key={f.id} style={{
            flex: '0 0 clamp(280px, 28vw, 340px)',
            scrollSnapAlign: 'start',
            display: 'flex',
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <FeatureCard f={f} onClick={() => onCardClick(f.id)} hoverColor={colors[i]} selected={expandedId === f.id} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => animScroll(1)}
        aria-label="Défiler à droite"
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
        style={{
          ...btnStyle(canNext),
          position: 'absolute',
          right: 8, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 6,
        }}>›</button>
    </div>
  );
}

function FeatureCard({ f, onClick, hoverColor, selected }) {
  const [hovering, setHovering] = useState(false);
  const primary = !!f.primary;

  const bg = primary
    ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
    : 'var(--bg-card)';
  const inkColor = primary ? 'var(--bg)' : 'var(--ink)';
  const ink2Color = primary ? 'rgba(255,255,255,0.88)' : 'var(--ink-2)';
  const ink3Color = primary ? 'rgba(255,255,255,0.72)' : 'var(--ink-3)';
  const borderColor = selected
    ? 'var(--accent)'
    : primary
      ? 'color-mix(in srgb, var(--accent) 88%, var(--ink) 12%)'
      : (hovering ? hoverColor : 'var(--line)');
  const shadow = selected
    ? '0 8px 22px -10px var(--accent)'
    : hovering
      ? (primary
          ? '0 10px 24px -10px var(--accent)'
          : `0 6px 18px -8px ${hoverColor}`)
      : 'none';

  return (
    <div
      onClick={onClick}
      className="focus-ring"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick && onClick(); }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
        borderRadius: 'var(--radius-lg)',
        padding: 22,
        cursor: 'pointer',
        transform: hovering ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
        display: 'flex', flexDirection: 'column', gap: 10,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}>
      {primary && (
        <div className="mono" style={{
          position: 'absolute',
          top: 10, right: 10,
          fontSize: 9,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.18)',
          padding: '2px 8px',
          borderRadius: 999,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 600,
        }}>★ principal</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className="display" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 600,
          letterSpacing: '-0.01em',
          color: primary ? inkColor : (hovering ? hoverColor : 'var(--ink)'),
          transition: 'color 0.18s',
        }}>{f.title}</div>
        {!primary && <Pill>{f.kind}</Pill>}
        {primary && (
          <span style={{
            padding: '3px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
          }}>{f.kind}</span>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: 13,
        color: ink2Color, lineHeight: 1.55, flex: 1,
      }}>{f.desc}</p>
      <div className="mono" style={{
        fontSize: 11,
        color: primary ? ink3Color : (hovering ? hoverColor : 'var(--ink-3)'),
        paddingTop: 10,
        borderTop: `1px dashed ${primary
          ? 'rgba(255,255,255,0.30)'
          : (hovering ? hoverColor : 'var(--line-soft)')}`,
        transition: 'color 0.18s, border-top-color 0.18s',
      }}>{f.example}</div>
    </div>
  );
}

// ───────── Scroll helper — centers a card+detail group in its scroll parent.
// Walks up to the closest overflowing ancestor and animates scrollTo there.
// (Avoids scrollIntoView, which behaves unpredictably across our layout.)
function findScrollableParent(el) {
  let p = el && el.parentElement;
  while (p) {
    const cs = getComputedStyle(p);
    // Accept any auto/scroll ancestor — don't require scrollHeight>clientHeight
    // (the overflow only appears AFTER the detail panel expands).
    if (/(auto|scroll)/.test(cs.overflowY)) return p;
    p = p.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

// Custom rAF-driven smooth scroll. Runs in parallel with the panel's
// grid-template-rows animation so the two motions feel like a single
// coordinated gesture — no waiting, no jank.
//   topEl       : top of the group (the card)
//   extraHeight : natural height of the detail content (measured separately)
//   gap         : px between card and detail (matches CSS gap)
//   duration    : ms; ease = easeInOutCubic
function scrollGroupIntoView(topEl, detailEl, gap = 18, duration = 520) {
  if (!topEl) return;
  const scroller = findScrollableParent(topEl);
  if (!scroller) return;
  // Detail's natural height — measure the inner content (which is not
  // affected by the grid-template-rows animation).
  const contentEl = detailEl && detailEl.querySelector('[data-detail-content]');
  const extraHeight = contentEl ? contentEl.getBoundingClientRect().height : 0;

  const sRect = scroller.getBoundingClientRect();
  const tRect = topEl.getBoundingClientRect();
  const topInScroll = tRect.top - sRect.top + scroller.scrollTop;
  const groupHeight = tRect.height + (extraHeight > 0 ? gap + extraHeight : 0);
  const center = topInScroll + groupHeight / 2;
  // Don't clamp to current scrollHeight — the detail panel is still
  // animating its row from 0→natural, so the scroll height grows over
  // time. The browser will silently clamp each frame to the live max.
  const target = Math.max(0, center - scroller.clientHeight / 2);

  const start = scroller.scrollTop;
  if (Math.abs(target - start) < 2) return;
  const t0 = performance.now();
  const ease = (t) => (t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    scroller.scrollTop = start + (target - start) * ease(t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ───────── Expandable features panel (Modules) ─────────
// Click a card → inline DetailPanel below the carousel with the expanded
// description, an "Aller à <module>" CTA, and a small quick-try widget.
function ExpandableFeaturesPanel({ features, goto }) {
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);
  const expanded = expandedId ? features.find(f => f.id === expandedId) : null;
  const gridRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    if (!expandedId) return;
    // Measure & scroll on next frame — refs are in place, panel content
    // has its natural size (only the row animation clips it visually).
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(gridRef.current, detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div ref={gridRef}>
        <FeaturesGrid features={features} onCardClick={toggle} expandedId={expandedId} />
      </div>
      <div ref={detailRef}>
        <FeatureDetailPanel f={expanded} goto={goto} onClose={() => setExpandedId(null)} />
      </div>
    </div>
  );
}

function FeatureDetailPanel({ f, goto, onClose }) {
  // Keep last truthy f around so the panel can finish its close animation
  // before content unmounts. Ref so the value is committed SYNCHRONOUSLY
  // — fixes the first-click case where the scroll measurement would happen
  // before content had a natural height.
  const lastFRef = useRef(null);
  if (f) lastFRef.current = f;
  const [, forceRender] = useReducer(x => x + 1, 0);
  const open = !!f;
  const shown = lastFRef.current;
  return (
    <div
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && lastFRef.current) {
          lastFRef.current = null;
          forceRender();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.32s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s',
        opacity: open ? 1 : 0,
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {shown && (
          <div data-detail-content style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            gap: 28,
            position: 'relative',
          }}>
            <button
              onClick={onClose}
              aria-label="Refermer le panneau"
              className="focus-ring"
              style={{
                position: 'absolute',
                top: 12, right: 12,
                background: 'transparent', border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                width: 26, height: 26, padding: 0,
                color: 'var(--ink-3)', cursor: 'pointer',
                fontSize: 14, lineHeight: 1,
                zIndex: 2,
              }}>×</button>
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, marginBottom: 12,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  fontWeight: 600,
                }}>
                  {shown.title} · détail
                </div>
              </div>
              <p className="display" style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
                color: 'var(--ink)', lineHeight: 1.25,
                marginBottom: 12,
              }}>{shown.detail?.lede}</p>
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6,
                color: 'var(--ink-2)',
                marginBottom: 18,
              }}>{shown.detail?.body}</p>
              <Button onClick={() => goto(shown.id)}>Aller au module {shown.title.replace(/^[^\s]+\s/, '')} →</Button>
            </div>
            <div>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                marginBottom: 8,
              }}>Essai rapide</div>
              <ModuleQuickTry config={shown.detail?.quickTry} />
              <div style={{ marginTop: 16 }}>
                <CliTerminalBlock
                  cliData={CLI_COMMANDS[shown.id]}
                  remoteData={REMOTE_COMMANDS[shown.id]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───── Inline quick-try widget per module ─────────────────────────────
// Mock-only — exercises the form, returns a faux preview line.
function ModuleQuickTry({ config }) {
  if (!config) return null;
  switch (config.kind) {
    case 'select-and-term':
      return <QTSelectAndTerm config={config} />;
    case 'prompt':
      return <QTPrompt config={config} />;
    case 'term-and-depth':
      return <QTTermAndDepth config={config} />;
    case 'triplet':
      return <QTTriplet config={config} />;
    case 'term-and-relation':
      return <QTTermAndRelation config={config} />;
    default:
      return null;
  }
}

const QT_PANEL = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line-soft)',
  borderRadius: 'var(--radius)',
  padding: 12,
  display: 'flex', flexDirection: 'column', gap: 10,
};

function QTPreview({ text, node, onClose }) {
  const content = node ?? text;
  if (!content) return null;
  return (
    <div className="mono" style={{
      fontSize: 11,
      color: 'var(--ink-2)',
      background: 'var(--bg-card)',
      border: '1px dashed var(--line)',
      borderRadius: 4,
      padding: '8px 10px',
      lineHeight: 1.5,
      wordBreak: 'break-word',
      position: 'relative',
    }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le résultat"
          title="Fermer"
          className="focus-ring"
          style={{
            position: 'absolute',
            top: 4, right: 4,
            width: 18, height: 18, padding: 0,
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 3,
            color: 'var(--ink-3)',
            cursor: 'pointer',
            fontSize: 12, lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      )}
      <div style={{ paddingRight: onClose ? 24 : 0 }}>{content}</div>
    </div>
  );
}

// Verdict colors — match the claim checker's UI conventions.
const VERDICT_STYLES = {
  SUPPORTED:    { color: 'var(--jdm-green)',   bg: 'rgba(78,166,60,0.15)',  border: 'rgba(78,166,60,0.45)' },
  CONTRADICTED: { color: 'var(--jdm-magenta)', bg: 'rgba(200,58,115,0.15)', border: 'rgba(200,58,115,0.45)' },
  UNKNOWN:      { color: 'var(--jdm-yellow)',  bg: 'rgba(212,169,10,0.15)', border: 'rgba(212,169,10,0.45)' },
};

function VerdictPill({ verdict }) {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.04em',
    }}>{verdict}</span>
  );
}

function ClaimVerdictHeader({ result }) {
  if (!result) return null;
  const { verdict, triplet } = result;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--ink-3)' }}>→</span>
      <span style={{ color: 'var(--ink)' }}>{triplet.s}</span>
      <span style={{ color: 'var(--ink-3)' }}>|</span>
      <span style={{ color: 'var(--accent)' }}>{triplet.r}</span>
      <span style={{ color: 'var(--ink-3)' }}>|</span>
      <span style={{ color: 'var(--ink)' }}>{triplet.o}</span>
      <span style={{ color: 'var(--ink-3)' }}>→</span>
      <VerdictPill verdict={verdict} />
    </div>
  );
}

function ClaimVerdictChain({ result }) {
  if (!result) return null;
  const { verdict, chain, confidence, note } = result;
  const vStyle = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  if ((!chain || chain.length === 0) && !note && confidence == null) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {chain && chain.length > 0 && (
        <div style={{
          paddingLeft: 8,
          borderLeft: `2px solid ${vStyle.border}`,
          color: 'var(--ink-2)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Schéma d'inférence
          </div>
          {chain.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-3)' }}>{i === chain.length - 1 ? '└─' : '├─'}</span>
              <span style={{ color: 'var(--ink)' }}>{step.from}</span>
              <span style={{ color: 'var(--ink-3)' }}>──</span>
              <span style={{ color: step.neg ? 'var(--jdm-magenta)' : 'var(--accent)' }}>{step.rel}</span>
              <span style={{ color: 'var(--ink-3)' }}>→</span>
              <span style={{ color: 'var(--ink)' }}>{step.to}</span>
              {step.w != null && (
                <span style={{ color: 'var(--ink-3)', marginLeft: 'auto', fontSize: 10 }}>w={step.w}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {(confidence != null || note) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          color: 'var(--ink-3)', fontSize: 10,
        }}>
          {note && <span>{note}</span>}
          {confidence != null && <span>confidence = {confidence.toFixed(2)}</span>}
        </div>
      )}
    </div>
  );
}

function ClaimVerdictBlock({ result }) {
  if (!result) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ClaimVerdictHeader result={result} />
      <ClaimVerdictChain result={result} />
    </div>
  );
}

function QTRunButton({ onClick, label = 'Tester' }) {
  return (
    <div style={{ alignSelf: 'flex-start' }}>
      <Button size="sm" onClick={onClick}>{label}</Button>
    </div>
  );
}

function QTSelectAndTerm({ config }) {
  const [flow, setFlow] = useState(config.defaultValue);
  const [term, setTerm] = useState(config.termDefault);
  const [out, setOut] = useState(null);
  return (
    <div style={QT_PANEL}>
      <Select value={flow} onChange={setFlow} options={config.options} />
      <Input value={term} onChange={setTerm} placeholder="terme" />
      <QTRunButton onClick={() => setOut(config.mock(flow, term))} label="Simuler le flux" />
      <QTPreview text={out} />
    </div>
  );
}

function QTPrompt({ config }) {
  const [q, setQ] = useState(config.defaultValue);
  const [model, setModel] = useState(config.defaultModel || (config.models?.[0]?.value));
  const [out, setOut] = useState(null);
  return (
    <div style={QT_PANEL}>
      {config.models && (
        <Select
          value={model}
          onChange={setModel}
          options={config.models}
        />
      )}
      <Input value={q} onChange={setQ} placeholder={config.placeholder} />
      <QTRunButton onClick={() => setOut(config.mock(q, model))} label="Envoyer" />
      <QTPreview text={out} />
    </div>
  );
}

function QTTermAndDepth({ config }) {
  const [term, setTerm] = useState(config.termDefault);
  const [depth, setDepth] = useState(config.depthDefault);
  const [out, setOut] = useState(null);
  return (
    <div style={QT_PANEL}>
      <Input value={term} onChange={setTerm} placeholder="terme" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 78 }}>profondeur</span>
        <div style={{ flex: 1 }}>
          <Slider min={1} max={4} step={1} value={depth} onChange={setDepth} />
        </div>
      </div>
      <QTRunButton onClick={() => setOut(config.mock(term, depth))} label="Construire" />
      <QTPreview text={out} />
    </div>
  );
}

function QTTriplet({ config }) {
  const [s, setS] = useState(config.defaults.s);
  const [r, setR] = useState(config.defaults.r);
  const [o, setO] = useState(config.defaults.o);
  const [out, setOut] = useState(null);
  const isVerdict = out && typeof out === 'object';
  const rootRef = useRef(null);
  const tailRef = useRef(null);

  // After clicking Vérifier, smooth-scroll so the whole result (header +
  // inference chain) is fully visible.
  const onVerify = () => {
    setOut(config.mock(s, r, o));
    requestAnimationFrame(() => {
      // Wait a beat so React renders the new chain block, then center.
      setTimeout(() => {
        if (rootRef.current) scrollGroupIntoView(rootRef.current, tailRef.current || rootRef.current);
      }, 30);
    });
  };

  return (
    <div ref={rootRef} style={QT_PANEL}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Input value={s} onChange={setS} placeholder="sujet" />
        <Input value={r} onChange={setR} placeholder="relation" />
        <Input value={o} onChange={setO} placeholder="objet" />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <QTRunButton onClick={onVerify} label="Vérifier" />
        {out && (
          <div style={{ flex: 1, minWidth: 0 }}>
            {isVerdict
              ? <QTPreview node={<ClaimVerdictHeader result={out} />} onClose={() => setOut(null)} />
              : <QTPreview text={out} onClose={() => setOut(null)} />}
          </div>
        )}
      </div>
      {isVerdict && (out.chain?.length > 0 || out.note || out.confidence != null) && (
        <div ref={tailRef} data-detail-content>
          <QTPreview node={<ClaimVerdictChain result={out} />} />
        </div>
      )}
    </div>
  );
}

function QTTermAndRelation({ config }) {
  const [term, setTerm] = useState(config.termDefault);
  const [rel, setRel] = useState(config.relationDefault);
  const [out, setOut] = useState(null);
  return (
    <div style={QT_PANEL}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Input value={term} onChange={setTerm} placeholder="terme" />
        <Input value={rel} onChange={setRel} placeholder="relation" />
      </div>
      <QTRunButton onClick={() => setOut(config.mock(term, rel))} label="Lister" />
      <QTPreview text={out} />
    </div>
  );
}

// ───────── Expandable briefs grid (Sous le capot) ─────────
function ExpandableBriefsGrid({ briefs, goto }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const expanded = expandedIdx == null ? null : briefs[expandedIdx];
  const toggle = (i) => setExpandedIdx(prev => prev === i ? null : i);
  const cardRefs = useRef({});
  const detailRef = useRef(null);

  useEffect(() => {
    if (expandedIdx == null) return;
    const raf = requestAnimationFrame(() => {
      scrollGroupIntoView(cardRefs.current[expandedIdx], detailRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [expandedIdx]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {briefs.map((b, i) => {
          const isOpen = expandedIdx === i;
          return (
            <div
              key={i}
              ref={el => { if (el) cardRefs.current[i] = el; }}
              onClick={() => toggle(i)}
              onKeyDown={(e) => { if (e.key === 'Enter') toggle(i); }}
              className="focus-ring"
              tabIndex={0}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--line)'),
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isOpen ? '0 6px 18px -10px var(--accent)' : 'none',
                transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
                transform: isOpen ? 'translateY(-1px)' : 'none',
              }}>
              <div className="mono" style={{
                fontSize: 11,
                color: isOpen ? 'var(--accent)' : 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8, fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: 'var(--accent)' }}>0{i + 1}</span>
                <span style={{
                  fontSize: 10,
                  color: isOpen ? 'var(--accent)' : 'var(--ink-3)',
                  letterSpacing: '0.08em',
                }}>{isOpen ? '— refermer' : 'déplier +'}</span>
              </div>
              <div className="display" style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18, fontWeight: 600,
                marginBottom: 8, color: 'var(--ink)',
              }}>{b.title}</div>
              <p style={{
                margin: 0, fontSize: 13,
                color: 'var(--ink-2)', lineHeight: 1.55,
              }}>{b.body}</p>
            </div>
          );
        })}
      </div>
      <div ref={detailRef}>
        <BriefDetailPanel
          brief={expanded}
          index={expandedIdx}
          goto={goto}
          onClose={() => setExpandedIdx(null)}
        />
      </div>
    </div>
  );
}

function BriefDetailPanel({ brief, index, goto, onClose }) {
  // Keep last truthy brief around so the panel can finish its close animation
  // before content unmounts. Ref so the value is committed SYNCHRONOUSLY
  // — fixes the first-click case where scroll measurement would happen
  // before content had a natural height.
  const lastBriefRef = useRef(null);
  const lastIndexRef = useRef(index);
  if (brief) { lastBriefRef.current = brief; lastIndexRef.current = index; }
  const [, forceRender] = useReducer(x => x + 1, 0);
  const open = !!brief;
  const shown = lastBriefRef.current;
  const shownIndex = lastIndexRef.current;
  return (
    <div
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && lastBriefRef.current) {
          lastBriefRef.current = null;
          forceRender();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.34s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.22s',
        opacity: open ? 1 : 0,
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {shown && (
          <div data-detail-content style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius-lg)',
            padding: '22px 26px 0',
            display: 'flex', flexDirection: 'column', gap: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                fontWeight: 600,
              }}>
                0{(shownIndex ?? 0) + 1} · {shown.detail?.kicker}
              </div>
              <button
                onClick={onClose}
                aria-label="Refermer le panneau"
                className="focus-ring"
                style={{
                  background: 'transparent', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  width: 26, height: 26, padding: 0,
                  color: 'var(--ink-3)', cursor: 'pointer',
                  fontSize: 14, lineHeight: 1,
                }}>×</button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 32,
              alignItems: 'start',
            }}>
              <div>
                <p className="display" style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
                  color: 'var(--ink)', lineHeight: 1.3,
                  marginBottom: 14,
                }}>{shown.detail?.lede}</p>
                {(shown.detail?.paragraphs || []).map((p, i) => (
                  <p key={i} style={{
                    margin: '0 0 12px',
                    fontSize: 14, lineHeight: 1.65,
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font-serif)',
                  }}>{p}</p>
                ))}
                {shown.detail?.cta && (
                  <div style={{ marginTop: 12 }}>
                    {shown.detail.cta.goto ? (
                      <Button onClick={() => goto(shown.detail.cta.goto)}>
                        {shown.detail.cta.label}
                      </Button>
                    ) : (
                      <a href={shown.detail.cta.href} target="_blank" rel="noopener noreferrer"
                         style={{ textDecoration: 'none' }}>
                        <Button variant="secondary">{shown.detail.cta.label}</Button>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                  marginBottom: 10,
                }}>Bibliographie convoquée</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(shown.detail?.citations || []).map((c, i) => (
                    <li key={i} style={{
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      paddingLeft: 12,
                      borderLeft: '2px solid var(--line-soft)',
                    }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.author}</span>
                      <span style={{ color: 'var(--ink-3)' }}> ({c.year})</span>
                      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--ink-2)' }}>
                        {c.title}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 2 }}>
                        {c.venue}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Scrolling marquee — citations égrainées */}
            <CitationsMarquee citations={shown.detail?.citations || []} />
          </div>
        )}
      </div>
    </div>
  );
}

function CitationsMarquee({ citations }) {
  if (!citations.length) return null;
  // Duplicate the run to make seamless loop.
  const items = [...citations, ...citations, ...citations];
  return (
    <div style={{
      borderTop: '1px solid var(--line-soft)',
      margin: '0 -26px',
      padding: '10px 0',
      overflow: 'hidden',
      position: 'relative',
      maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
    }}>
      <div style={{
        display: 'flex',
        gap: 36,
        whiteSpace: 'nowrap',
        animation: 'jdm-citations-scroll 48s linear infinite',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink-3)',
        letterSpacing: '0.04em',
      }}>
        {items.map((c, i) => (
          <span key={i} style={{ flexShrink: 0 }}>
            <span style={{ color: 'var(--accent)' }}>●</span>{' '}
            <span style={{ color: 'var(--ink-2)' }}>{c.author}</span>
            {' '}({c.year}) — <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{c.title}</span>
            {' '}· <span>{c.venue}</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes jdm-citations-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(-100% / 3)); }
        }
      `}</style>
    </div>
  );
}

function StatTile({ stat, hoverColor }) {
  const parsed = React.useMemo(() => {
    const m = String(stat.value).match(/^([\d.]+)(.*)$/);
    if (!m) return { num: 0, suffix: stat.value };
    return { num: parseFloat(m[1]), suffix: m[2] };
  }, [stat.value]);

  const [display, setDisplay] = useState(parsed.num);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef(null);

  const animate = () => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    // Pour les stats en "M+" on commence à 1k (= 0.001M) et on passe
    // de k vers M lorsqu'on atteint 1M.
    // Pour les stats sans magnitude (180+, 35, 5) : start = 0.45 * target.
    const startVal = hasM ? 0.001 : target * 0.45;
    // Plus la plage est large, plus on prend de temps — sinon le début
    // (les milliers) défile trop vite pour être lisible.
    const duration = hasM ? 2400 : 1200;
    // Renvoie la chaîne complète (nombre + magnitude) — le "+" est ajouté
    // uniquement à la fin de l'animation pour ne pas distraire pendant.
    // Tant que v < 1M, on affiche "Xk" (PAS de M) ; ≥ 1M, on affiche "X.YM".
    const fmtFull = (v, final = false) => {
      const plus = final && hasPlus ? '+' : '';
      if (hasM) {
        if (v < 1) return Math.round(v * 1000) + 'k' + plus;
        const s = v.toFixed(1);
        return (s.endsWith('.0') ? s.slice(0, -2) : s) + 'M' + plus;
      }
      return String(Math.floor(v)) + plus;
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Pour les "M" (1k → 2M = 3+ ordres de grandeur) on interpole en
      // exponentiel pour que chaque décade soit visible le même temps.
      // Pour les autres, ease-out cubique standard.
      let v;
      if (hasM) {
        const logStart = Math.log(startVal);
        const logEnd = Math.log(target);
        const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
        v = Math.exp(logStart + (logEnd - logStart) * eased);
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        v = startVal + (target - startVal) * eased;
      }
      setDisplay(fmtFull(v, t === 1));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Au mount : affichage initial = valeur formatée selon les règles ci-dessus
  // (donc "2M+" complet d'office, "180+", "35", etc.).
  React.useEffect(() => {
    const target = parsed.num;
    const suffix = parsed.suffix || '';
    const hasM = /M/.test(suffix);
    const hasPlus = /\+/.test(suffix);
    const plus = hasPlus ? '+' : '';
    if (hasM) {
      const s = target.toFixed(1);
      setDisplay((s.endsWith('.0') ? s.slice(0, -2) : s) + 'M' + plus);
    } else {
      setDisplay(String(target) + plus);
    }
  }, [parsed]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div
      onMouseEnter={() => { setHovering(true); animate(); }}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: 'var(--bg-card)',
        padding: '18px 20px',
        transition: 'background 0.2s',
        cursor: 'default',
      }}>
      <div className="mono" style={{
        fontSize: 11, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 6,
      }}>{stat.label}</div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 600,
        color: hovering ? (hoverColor || 'var(--accent)') : 'var(--ink)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
        transition: 'color 0.18s',
        fontVariantNumeric: 'tabular-nums',
      }}>{display}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{stat.sub}</div>
    </div>
  );
}

function GitHubMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
         style={{ flexShrink: 0 }} aria-label="GitHub">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.79.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}

window.ViewProjet = ViewProjet;

