// hero-animation.jsx — animated graph + simulated chat for Projet hero.
// Loops indefinitely with 2 alternating scenarios.
//
// Mount with <HeroAnimation height={380} /> inside Panel 1.
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).
//
// Size is configurable via `height` prop (default 380). The internal
// graph layout & font sizes stay constant — they're tuned for 380px.

const { useState: useStateHero, useEffect: useEffectHero, useRef: useRefHero } = React;

function HeroAnimation({ height = 380, showChat = true, liveScenario = null,
                         interactive = false, onNodeClick = null }) {
  // Si liveScenario est fourni : on l'utilise À LA PLACE des scénarios
  // hardcodés (= mode "vraies données JDM" depuis /api/subgraph/live).
  // Pas de loop, pas de chat de démo — un seul rendu animé.
  const scenarios = [
    {
      id: 'voiture',
      question: 'quels sont les sens de "voiture" ?',
      streamChunks: [
        'Dans JeuxDeMots, ',
        '**voiture** est polysémique. ',
        'Quatre sens principaux sont identifiés :\n',
        '\n• **véhicule automobile**',
        ' — le plus fréquent (w=842)',
        '\n• **wagon ferroviaire**',
        ' — sens technique (w=312)',
        '\n• **moyen de transport**',
        ' — sens générique (w=198)',
        '\n• **véhicule hippomobile**',
        ' — sens historique (w=89)',
        '\n\nChacun a son propre voisinage lexical.',
      ],
      graph: {
        center: 'voiture',
        nodes: [
          { id: 'auto',    label: 'automobile',     angle: -60, dist: 110, color: 'jdm-magenta', delay: 0.6 },
          { id: 'wagon',   label: 'wagon',          angle: 30,  dist: 110, color: 'jdm-cyan',    delay: 1.6 },
          { id: 'tpt',     label: 'transport',      angle: 120, dist: 110, color: 'jdm-green',   delay: 2.3 },
          { id: 'hippo',   label: 'hippomobile',    angle: 210, dist: 110, color: 'jdm-violet',  delay: 3.2 },
          { id: 'moteur',  label: 'moteur',         angle: -90, dist: 180, color: 'jdm-magenta', delay: 3.8, dim: true },
          { id: 'roue',    label: 'roue',           angle: -30, dist: 180, color: 'jdm-magenta', delay: 4.1, dim: true },
          { id: 'rail',    label: 'rail',           angle: 60,  dist: 180, color: 'jdm-cyan',    delay: 4.4, dim: true },
          { id: 'voyage',  label: 'voyage',         angle: 150, dist: 180, color: 'jdm-green',   delay: 4.7, dim: true },
          { id: 'cheval',  label: 'cheval',         angle: 240, dist: 180, color: 'jdm-violet',  delay: 5.0, dim: true },
        ],
        edges: [
          { from: 'voiture', to: 'auto',   delay: 0.7, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'wagon',  delay: 1.7, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'tpt',    delay: 2.4, label: 'r_raff', highlight: true },
          { from: 'voiture', to: 'hippo',  delay: 3.3, label: 'r_raff', highlight: true },
          { from: 'auto',  to: 'moteur', delay: 3.9, label: 'r_has_part' },
          { from: 'auto',  to: 'roue',   delay: 4.2, label: 'r_has_part' },
          { from: 'wagon', to: 'rail',   delay: 4.5, label: 'r_lieu' },
          { from: 'tpt',   to: 'voyage', delay: 4.8, label: 'r_telic_role' },
          { from: 'hippo', to: 'cheval', delay: 5.1, label: 'r_agent' },
        ],
      },
    },
    {
      id: 'velo-pneu',
      question: 'comment sont liés vélo et pneumatique ?',
      streamChunks: [
        'Dans JeuxDeMots, ',
        'il **n\'existe pas de lien direct**',
        ' entre *vélo* et *pneumatique*.\n',
        '\nMais en passant par **pneu** :\n',
        '\n• vélo `r_has_part` **pneu** (w=110)',
        '\n• pneu `r_syn` **pneumatique** (w=87)',
        '\n\nLa chaîne fait **2 sauts**.',
        ' L\'agent infère donc une relation indirecte.',
      ],
      graph: {
        center: null,
        layout: 'path',
        nodes: [
          { id: 'velo',  label: 'vélo',        x: -150, y: 0,   color: 'jdm-green',   delay: 0.3 },
          { id: 'pneu',  label: 'pneu',        x: 0,    y: 0,   color: 'jdm-orange',  delay: 1.5 },
          { id: 'pneuma',label: 'pneumatique', x: 155,  y: 0,   color: 'jdm-magenta', delay: 2.7 },
          { id: 'cadre', label: 'cadre',       x: -195, y: -90, color: 'jdm-green',   delay: 3.6, dim: true },
          { id: 'guidon',label: 'guidon',      x: -195, y: 90,  color: 'jdm-green',   delay: 3.9, dim: true },
          { id: 'caoutchouc', label: 'caoutchouc', x: 200, y: -90, color: 'jdm-magenta', delay: 4.3, dim: true },
        ],
        edges: [
          { from: 'velo', to: 'pneu',   delay: 1.8, label: 'r_has_part', highlight: true },
          { from: 'pneu', to: 'pneuma', delay: 3.0, label: 'r_syn',      highlight: true },
          { from: 'velo', to: 'cadre',  delay: 3.7, label: 'r_has_part' },
          { from: 'velo', to: 'guidon', delay: 4.0, label: 'r_has_part' },
          { from: 'pneuma', to: 'caoutchouc', delay: 4.4, label: 'r_made_of' },
        ],
      },
    },
  ];

  const [scenarioIdx, setScenarioIdx] = useStateHero(0);
  const [phase, setPhase] = useStateHero('typing');
  const [userText, setUserText] = useStateHero('');
  const [streamText, setStreamText] = useStateHero('');
  const [tick, setTick] = useStateHero(0);

  // Si liveScenario fourni → on l'utilise (mode données réelles SSE).
  // Sinon : rotation des scénarios pré-enregistrés (mode démo Projet).
  const scenario = liveScenario || scenarios[scenarioIdx];

  // Wait for the graph to finish drawing before swapping scenarios.
  const graphEndTime = (() => {
    const lastNode = Math.max(...scenario.graph.nodes.map(n => n.delay + 0.5));
    const lastEdge = scenario.graph.edges.length
      ? Math.max(...scenario.graph.edges.map(e => e.delay + 0.7))
      : 0;
    return Math.max(lastNode, lastEdge);
  })();

  useEffectHero(() => {
    let cancelled = false;
    const run = async () => {
      setUserText(''); setStreamText(''); setPhase('typing'); setTick(0);

      // Mode liveScenario : on saute le typing et le streaming de chat,
      // on démarre directement l'animation du graphe.
      if (liveScenario) {
        setPhase('streaming');
        const startTick = Date.now();
        const tickInterval = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick) / 1000);
        }, 80);
        // Anim termine quand le dernier edge est dessiné. Puis on garde
        // le graphe visible (pas de loop : pas de scenarioIdx incrémenté).
        await sleepHero((graphEndTime + 1) * 1000);
        clearInterval(tickInterval);
        return;
      }

      const q = scenario.question;
      for (let i = 0; i <= q.length; i++) {
        if (cancelled) return;
        setUserText(q.slice(0, i));
        await sleepHero(22 + Math.random() * 22);
      }
      await sleepHero(350);

      if (cancelled) return;
      setPhase('streaming');
      const startTick = Date.now();
      const tickInterval = setInterval(() => {
        if (!cancelled) setTick((Date.now() - startTick) / 1000);
      }, 80);

      let acc = '';
      for (const chunk of scenario.streamChunks) {
        if (cancelled) { clearInterval(tickInterval); return; }
        for (let i = 0; i < chunk.length; i++) {
          acc += chunk[i];
          setStreamText(acc);
          await sleepHero(6 + Math.random() * 11);
        }
        await sleepHero(90);
      }
      clearInterval(tickInterval);

      if (cancelled) return;
      setPhase('done');
      const elapsedNow = (Date.now() - startTick) / 1000;
      const waitForGraph = Math.max(0, graphEndTime - elapsedNow) * 1000;
      if (waitForGraph > 0) {
        const waitTick = setInterval(() => {
          if (!cancelled) setTick((Date.now() - startTick) / 1000);
        }, 80);
        await sleepHero(waitForGraph);
        clearInterval(waitTick);
      }
      await sleepHero(1600);
      if (cancelled) return;
      setScenarioIdx(i => (i + 1) % scenarios.length);
    };
    run();
    return () => { cancelled = true; };
  }, [scenarioIdx, liveScenario]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: showChat ? 'minmax(0, 1.05fr) minmax(0, 1fr)' : '1fr',
      gap: 16,
      borderRadius: 'var(--radius-lg)',
      height: interactive ? '100%' : 'auto',
    }}>
      {/* Left — graph */}
      {/* En mode interactif (LIVE), on prend toute la hauteur dispo
          du parent (height: 100%) ; sinon hauteur fixe (démo accueil). */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        height: interactive ? '100%' : height,
        overflow: 'hidden',
      }}>
        <GraphCanvas scenario={scenario} tick={tick} height={height}
                     interactive={interactive} onNodeClick={onNodeClick} />
        <div style={{
          position: 'absolute', top: 14, left: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          <span className="pulse-dot" style={{ background: 'var(--accent)' }} />
          Graphe JDM · en direct
        </div>
      </div>

      {/* Right — chat (caché si showChat=false) */}
      {showChat && (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />
          Chatbot LLM · démo
          <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
            gemini-3.1-flash-lite
          </span>
        </div>
        <ChatView userText={userText} streamText={streamText} phase={phase} />
      </div>
      )}
    </div>
  );
}

function sleepHero(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function GraphCanvas({ scenario, tick, height, interactive = false, onNodeClick = null }) {
  // viewBox élargi en mode interactif (LIVE) pour que les nœuds
  // utilisent toute la largeur du canvas, pas juste le carré central.
  // Les scénarios démo (typing+chat) gardent 560×H (carré centré).
  const W = interactive ? 920 : 560;
  const H = height;
  const cx = W / 2, cy = H / 2;
  const g = scenario.graph;

  const positions = {};
  if (g.center) positions[g.center] = { x: 0, y: 0 };
  g.nodes.forEach(n => {
    if (n.x !== undefined) {
      positions[n.id] = { x: n.x, y: n.y };
    } else {
      const rad = (n.angle * Math.PI) / 180;
      positions[n.id] = { x: Math.cos(rad) * n.dist, y: Math.sin(rad) * n.dist };
    }
  });

  // ── AUTOFIT — rescale toutes les positions pour exploiter au mieux
  //    le viewBox :
  //      - réduit (≤ 1) si du contenu dépasserait les marges sûres
  //      - agrandit (≤ 1.6) si le contenu est petit et qu'il reste
  //        de la place → les nœuds deviennent lisibles
  //    Marges :
  //      horizontal = bubble + demi-largeur label (≈84)
  //      vertical   = bubble + hauteur label sous bulle (≈44)
  //    Activé uniquement en mode interactif (LIVE).
  if (interactive) {
    const margX = 84, margY = 44;
    const maxX = Math.max(1, ...Object.values(positions).map(p => Math.abs(p.x)));
    const maxY = Math.max(1, ...Object.values(positions).map(p => Math.abs(p.y)));
    const safeX = Math.max(40, cx - margX);
    const safeY = Math.max(40, cy - margY);
    const sX = safeX / maxX;
    const sY = safeY / maxY;
    // Cap à 1.6 : sinon les petits graphes deviennent grotesques
    // (1 nœud à 100px → x4 → 400px illisible).
    const fitScale = Math.min(sX, sY, 1.6);
    if (Math.abs(fitScale - 1) > 0.02) {
      for (const id of Object.keys(positions)) {
        positions[id] = {
          x: positions[id].x * fitScale,
          y: positions[id].y * fitScale,
        };
      }
    }
  }

  // Path layout doesn't rotate — labels need to stay axis-aligned and
  // not drift off-frame. Radial layout has a slow drift.
  // MODE INTERACTIF (LIVE) : aucune rotation pour que le hover soit
  // utilisable et que les nœuds soient cliquables sans bouger.
  const isPath = g.layout === 'path';
  const breathScale = 1 + (isPath || interactive ? 0.004 : 0.012) * Math.sin(tick * 0.6);
  const rotateAll = (isPath || interactive) ? 0 : tick * 1.2;

  const transform = `translate(${cx} ${cy}) rotate(${rotateAll}) scale(${breathScale})`;

  // Hover state — index d'arête/de nœud sous le curseur
  const [hoverEdge, setHoverEdge] = useStateHero(null);
  const [hoverNode, setHoverNode] = useStateHero(null);

  // Index : pour un nœud donné, quelles arêtes le touchent ?
  // Permet de SURBRILLER les arêtes connectées au nœud survolé.
  const edgesByNode = {};
  g.edges.forEach((e, i) => {
    (edgesByNode[e.from] = edgesByNode[e.from] || []).push(i);
    (edgesByNode[e.to]   = edgesByNode[e.to]   || []).push(i);
  });

  // Index id → label décodé pour les tooltips d'arêtes — les ids
  // bruts JDM (N23, N1234…, ROOT) ne sont pas lisibles.
  // Source la PLUS COMPLÈTE : _labelByRawId fourni par buildLiveScenario
  // qui couvre TOUS les nœuds reçus du backend (y compris ROOT et ceux
  // qui auraient pu être filtrés du rendu). On complète avec g.nodes
  // et g.center pour les scénarios démo.
  const labelOf = Object.assign({}, g._labelByRawId || {});
  if (g.center) labelOf[g.center] = g.center;
  g.nodes.forEach(n => {
    const lbl = (n.label || '').toString().trim();
    if (lbl) labelOf[n.id] = lbl;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`}
         preserveAspectRatio="xMidYMid meet"
         width="100%" height="100%"
         style={{ display: 'block' }}>
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </radialGradient>
        {/* Marqueurs de flèche — un par couleur unique présente dans
            les arêtes. Permet à chaque arête d'avoir une flèche de
            même couleur que sa ligne (pas de context-stroke universel
            cross-browser). */}
        {Array.from(new Set(g.edges.map(e =>
          e.color || (e.highlight ? '__accent__' : '__ink3__')
        ))).map(c => {
          const fill = c === '__accent__' ? 'var(--accent)'
                     : c === '__ink3__'   ? 'var(--ink-3)'
                     : c;
          const id = 'arrow-' + (c || 'none').replace(/[^a-zA-Z0-9_-]/g, '');
          return (
            <marker key={c} id={id}
                    viewBox="0 0 10 10" refX="9" refY="5"
                    markerUnits="userSpaceOnUse"
                    markerWidth="11" markerHeight="11"
                    orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={fill}/>
            </marker>
          );
        })}
      </defs>

      <circle cx={cx} cy={cy} r={Math.min(W, H) / 3} fill="url(#hero-glow)"/>

      <g transform={transform}>
        {g.edges.map((e, i) => {
          const visible = tick >= e.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - e.delay) / 0.7);
          const a = positions[e.from], b = positions[e.to];
          if (!a || !b) return null;
          // Tronque la ligne avant le nœud destination pour que la
          // flèche ne plonge pas dans la bulle (marge = rayon + padding).
          const dx = b.x - a.x, dy = b.y - a.y;
          const segLen = Math.max(1, Math.sqrt(dx*dx + dy*dy));
          const trim = interactive ? 16 : 0;
          const bx = b.x - (dx / segLen) * trim;
          const by = b.y - (dy / segLen) * trim;
          const x = a.x + (bx - a.x) * t;
          const y = a.y + (by - a.y) * t;
          const edgeColor = e.color
            || (e.highlight ? 'var(--accent)' : 'var(--ink-3)');
          const labelColor = e.color
            || (e.highlight ? 'var(--accent)' : 'var(--ink-3)');
          // États de surlignage : hover direct sur l'arête OU nœud
          // adjacent survolé.
          const adjacentHover = hoverNode != null &&
            (e.from === hoverNode || e.to === hoverNode);
          const isHot = hoverEdge === i || adjacentHover;
          // En mode interactif, on dim les arêtes non concernées
          // quand un hover est actif → "focus mode".
          const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
          const dimmed = someHoverActive && !isHot;
          return (
            <g key={i}>
              {/* Hitbox transparente plus large pour faciliter le hover */}
              {interactive && (
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverEdge(i)}
                  onMouseLeave={() => setHoverEdge(h => h === i ? null : h)}
                >
                  <title>
                    {`${labelOf[e.from] || e.from} —[${e.label || '?'}]→ ${labelOf[e.to] || e.to}`}
                    {e.weight !== undefined ? `  (w=${e.weight})` : ''}
                    {e.negative ? '  [NÉGATION]' : ''}
                  </title>
                </line>
              )}
              <line
                x1={a.x} y1={a.y} x2={x} y2={y}
                stroke={edgeColor}
                strokeWidth={isHot ? 3.2 : (e.highlight ? 2 : 1.2)}
                strokeOpacity={dimmed ? 0.15 : (isHot ? 1 : (e.color ? 0.82 : (e.highlight ? 0.9 : 0.45)))}
                strokeLinecap="round"
                strokeDasharray={e.negative ? '4 3' : undefined}
                markerEnd={interactive && t > 0.85 ? `url(#arrow-${
                  (e.color || (e.highlight ? '__accent__' : '__ink3__'))
                    .replace(/[^a-zA-Z0-9_-]/g, '')
                })` : undefined}
                style={{ pointerEvents: 'none', transition: 'stroke-width 0.12s, stroke-opacity 0.12s' }}
              />
              {((e.label && t > 0.6) || isHot) && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={isHot ? 11 : 9}
                  fontWeight={isHot ? 700 : 400}
                  fill={labelColor}
                  opacity={dimmed ? 0.15 : (isHot ? 1 : ((t - 0.6) / 0.4))}
                  transform={`rotate(${-rotateAll}, ${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 6})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {g.center && (
          <CenterNode label={g.center} tick={tick} counterRotate={-rotateAll} />
        )}

        {g.nodes.map((n, i) => {
          const p = positions[n.id];
          if (!p) return null;
          const visible = tick >= n.delay;
          if (!visible) return null;
          const t = Math.min(1, (tick - n.delay) / 0.5);
          // Pas de flottement en mode interactif (sinon le clic rate).
          const floatY = interactive ? 0 : Math.sin(tick * 1.2 + i) * 1.5;
          const isHot = hoverNode === n.id;
          const someHoverActive = interactive && (hoverEdge != null || hoverNode != null);
          // Un nœud "concerné" par le hover d'arête = ses extrémités
          const edgeHovered = hoverEdge != null ? g.edges[hoverEdge] : null;
          const concerned = edgeHovered &&
            (edgeHovered.from === n.id || edgeHovered.to === n.id);
          const dimmed = someHoverActive && !isHot && !concerned;
          return (
            <NodeBubble
              key={n.id}
              x={p.x} y={p.y + floatY}
              label={n.label}
              color={n.color}
              dim={n.dim}
              appearT={t}
              counterRotate={-rotateAll}
              interactive={interactive}
              hot={isHot || concerned}
              dimmed={dimmed}
              onMouseEnter={interactive ? () => setHoverNode(n.id) : undefined}
              onMouseLeave={interactive ? () => setHoverNode(h => h === n.id ? null : h) : undefined}
              onClick={interactive && onNodeClick ? () => onNodeClick(n) : undefined}
              tooltip={`${n.label}${n.dist != null ? `  (depth ${n.dim ? 2 : 1})` : ''}`}
            />
          );
        })}
      </g>
    </svg>
  );
}

function CenterNode({ label, tick, counterRotate }) {
  const pulse = 0.5 + 0.5 * Math.sin(tick * 2);
  return (
    <g>
      <circle r={28} fill="var(--accent)" opacity={0.08 + pulse * 0.06}/>
      <circle r={20} fill="var(--accent)" opacity={0.18}/>
      <circle r={13} fill="var(--accent)"/>
      <text
        y={5}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="600"
        fill="var(--bg)"
        transform={`rotate(${counterRotate})`}
      >
        {label}
      </text>
    </g>
  );
}

function NodeBubble({ x, y, label, color, dim, appearT, counterRotate,
                     interactive = false, hot = false, dimmed = false,
                     onMouseEnter, onMouseLeave, onClick, tooltip }) {
  const c = `var(--${color})`;
  // Hot = boost taille + opacité ; dimmed = recule visuellement.
  // Bulles plus grosses en mode interactif (LIVE) — viewBox étendu.
  const baseR = (dim ? 7 : 12) * (interactive ? 1 : 0.75);
  const r = (hot ? baseR * 1.35 : baseR) * appearT;
  const fontSize = (dim ? 11 : 13) + (hot ? 2 : 0);
  const opacity = dimmed ? 0.25 : appearT;
  // Tronque les labels très longs pour limiter le chevauchement.
  // Le tooltip natif (title) garde la version complète.
  const shownLabel = (label && label.length > 22)
    ? label.slice(0, 21) + '…'
    : label;
  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={opacity}
      data-node-bubble={interactive ? '1' : undefined}
      style={{
        cursor: interactive && onClick ? 'pointer' : (interactive ? 'default' : 'inherit'),
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {tooltip && <title>{tooltip}</title>}
      {/* Hitbox transparente pour faciliter hover/clic */}
      {interactive && (
        <circle r={Math.max(r + 8, 14)} fill="transparent" />
      )}
      <circle r={r + (hot ? 8 : 5)} fill={c} opacity={hot ? 0.28 : 0.12}/>
      <circle r={r} fill={c} stroke={hot ? '#fff' : 'none'} strokeWidth={hot ? 1.5 : 0}/>
      <g transform={`rotate(${counterRotate})`} style={{ pointerEvents: 'none' }}>
        <text
          y={r + fontSize + 4}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={fontSize}
          fontWeight={hot ? 700 : (dim ? 400 : 600)}
          fill="var(--ink)"
          opacity={dim && !hot ? 0.7 : 1}
          style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3, strokeLinejoin: 'round' }}
        >
          {shownLabel}
        </text>
      </g>
    </g>
  );
}

function ChatView({ userText, streamText, phase }) {
  const scrollRef = useRefHero(null);
  useEffectHero(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamText]);

  return (
    <div ref={scrollRef} style={{
      flex: 1,
      padding: '16px 18px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {userText && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            maxWidth: '85%',
            padding: '8px 12px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 13,
            lineHeight: 1.45,
          }}>
            {userText}
            {phase === 'typing' && (
              <span style={{
                display: 'inline-block',
                width: 2, height: 13,
                background: 'var(--bg)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'hero-caret 0.7s steps(2) infinite',
              }}/>
            )}
          </div>
        </div>
      )}

      {(phase === 'streaming' || phase === 'done') && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0,
            borderRadius: 6, marginTop: 2,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <JDMMark size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {streamText.length === 0 ? (
              <TypingDots />
            ) : (
              <div style={{
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.55,
              }} dangerouslySetInnerHTML={{ __html: renderStreamMd(streamText, phase === 'streaming') }}/>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes hero-caret { 50% { opacity: 0; } }
        @keyframes hero-typing {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--ink-3)',
          animation: `hero-typing 1.2s infinite ${i * 0.15}s`,
        }}/>
      ))}
    </div>
  );
}

function renderStreamMd(s, withCaret) {
  let html = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.88em;color:var(--accent);">$1</code>')
    .replace(/\n• /g, '<br/><span style="color:var(--accent);">•</span> ')
    .replace(/\n/g, '<br/>');
  if (withCaret) {
    html += '<span style="display:inline-block;width:2px;height:1em;background:var(--accent);margin-left:2px;vertical-align:text-bottom;animation:hero-caret 0.7s steps(2) infinite;"></span>';
  }
  return html;
}

window.HeroAnimation = HeroAnimation;
