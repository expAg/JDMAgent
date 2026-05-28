// Mock API — intercepts fetch('/api/...') calls and returns realistic
// JDM-flavoured data. Lets the UI work end-to-end without a backend.
//
// To disable : load index.html with ?nomocks (skip this script).

(function() {
  if (location.search.includes('nomocks')) return;
  const origFetch = window.fetch.bind(window);

  // ─── Static fixtures ─────────────────────────────────────────────
  const SUBGRAPH_HTML = (term) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${term}</title>
<style>
  body { margin:0; background:transparent; font-family:system-ui;
    display:flex; align-items:center; justify-content:center; height:100vh; }
  .placeholder { text-align:center; color:#847d6e; }
  .ph-title { font-family:Georgia,serif; font-size:24px; color:#1f1d18; margin-bottom:8px; }
  .ph-mono  { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.1em;
              text-transform:uppercase; }
</style></head>
<body><div class="placeholder">
  <div class="ph-title">${term}</div>
  <div class="ph-mono">vis-network · mocké · 28 nœuds · 42 arêtes</div>
  <div style="margin-top:24px; font-size:12px; max-width:340px;">
    En mode démo : la viz vis-network réelle s'affichera quand l'API
    <code style="font-family:'JetBrains Mono',monospace;">/api/subgraph</code> sera connectée.
  </div>
</div></body></html>`;

  const fakeSubgraph = (req) => {
    const { term = 'chat', depth = 1, format = 'html' } = req || {};
    // Fake nodes/edges (concentric layout, depth-aware)
    const ring1 = ['félin','mammifère','animal domestique','patte','queue','oreille','griffe','agile','indépendant','curieux'];
    const ring2 = depth >= 2 ? ['vertébré','animal','carnivore','poil','moustache','pelage'] : [];
    const ring3 = depth >= 3 ? ['organisme','être vivant','animal de compagnie'] : [];
    const nodes = [{ id: term, label: term, kind: 'center', depth: 0 }];
    ring1.forEach((t, i) => nodes.push({ id: t, label: t, kind: ['isa','isa','isa','part','part','part','part','carac','carac','carac'][i] || 'isa', depth: 1, w: 200 - i * 12 }));
    ring2.forEach((t, i) => nodes.push({ id: t, label: t, kind: ['isa','isa','isa','part','part','part'][i] || 'isa', depth: 2, w: 150 - i * 10 }));
    ring3.forEach((t, i) => nodes.push({ id: t, label: t, kind: 'isa', depth: 3, w: 100 - i * 10 }));
    const edges = [];
    ring1.forEach((t, i) => edges.push({
      from: term, to: t, w: 200 - i * 12,
      relation: ['r_isa','r_isa','r_isa','r_has_part','r_has_part','r_has_part','r_has_part','r_carac','r_carac','r_carac'][i] || 'r_isa',
      kind: i < 3 ? 'isa' : i < 7 ? 'part' : 'carac',
      negative: false,
    }));
    if (depth >= 2) ring2.forEach((t, i) => edges.push({
      from: ring1[i % ring1.length], to: t, w: 80 - i * 5,
      relation: 'r_isa', kind: 'isa', negative: false,
    }));
    return {
      nodes, edges, format,
      html: format === 'html' ? SUBGRAPH_HTML(term) : '',
      stats: {
        n_nodes: nodes.length,
        n_edges: edges.length,
        n_negative: 0,
        depth,
      },
      message: 'Données simulées — backend non connecté.',
    };
  };

  const fakeExplore = (req) => {
    const { term = 'chat', relation = 'r_has_part', min_weight = 0, limit = 50, with_annotations = false } = req || {};
    const POOLS = {
      r_has_part: [['patte',142,'constitutif (w=12)'],['queue',138,''],['oreille',121,'constitutif (w=10)'],['griffe',110,''],['moustache',104,''],['œil',98,''],['fourrure',85,''],['pelage',72,''],['crocs',51,'']],
      r_isa: [['félin',215,'constitutif (w=18)'],['mammifère',198,''],['animal de compagnie',142,''],['carnivore',121,''],['animal domestique',118,''],['animal',102,''],['vertébré',56,'']],
      r_syn: [['matou',89,''],['minet',72,''],['félin',58,''],['greffier',14,'familier'],['mistigri',11,'familier']],
      r_carac: [['agile',98,''],['indépendant',92,''],['curieux',88,''],['propre',81,''],['silencieux',74,''],['nocturne',68,''],['affectueux',61,'']],
    };
    const pool = POOLS[relation] || POOLS.r_has_part;
    const rows = pool
      .filter(([t, w]) => w >= min_weight)
      .slice(0, limit)
      .map(([target, weight, annot]) => ({
        source: term, relation, target, weight,
        annotations: with_annotations ? annot : '',
        target_id: '',
      }));
    return { rows, message: rows.length ? `${rows.length} triplet(s) trouvé(s).` : `Aucun triplet ${term}|${relation}|? (mocké).` };
  };

  const fakeFactcheck = (req) => {
    const { subject = 'chat', relation = 'r_isa', object = 'animal', effort = 1 } = req || {};
    const SCENARIOS = {
      'tomate|r_isa|fruit':   { status: 'supported',    confidence: 0.94, origin: 'containment',
        explanation: 'Triplet trouvé directement dans JDM avec poids 256.',
        proof: [{ s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 }] },
      'tomate|r_isa|légume':  { status: 'contradicted', confidence: 0.82, origin: 'containment',
        explanation: 'JDM contient tomate r_isa fruit (w=256). Aucune trace de tomate r_isa légume.',
        counter: [{ s: 'tomate', r: 'r_isa', t: 'fruit', w: 256 }] },
      'chat|r_isa|animal':    { status: 'supported',    confidence: 0.97, origin: 'inference',
        explanation: 'Verdict obtenu par inférence (isa-transitivité).',
        proof: [
          { s: 'chat', r: 'r_isa', t: 'mammifère', w: 198 },
          { s: 'mammifère', r: 'r_isa', t: 'vertébré', w: 220 },
          { s: 'vertébré', r: 'r_isa', t: 'animal', w: 305 },
        ] },
      'chat|r_agent|aboyer':  { status: 'contradicted', confidence: 0.78, origin: 'containment',
        explanation: 'Le verbe aboyer a chien comme agent typique. Aucun lien chat-aboyer trouvé.',
        counter: [{ s: 'aboyer', r: 'r_agent', t: 'chien', w: 312 }] },
    };
    const key = `${subject}|${relation}|${object}`;
    return SCENARIOS[key] || {
      status: 'unknown', confidence: 0.0, origin: 'none',
      explanation: 'Aucun triplet direct, aucune chaîne d\'inférence trouvée (mocké).',
      proof: [], counter: [],
    };
  };

  const fakePoolStatus = () => ({
    current_key_index: 3,
    pool_size: 4,
    blown_today: [],
    reset_at: '00:00 PT',
    last_used: new Date().toISOString(),
  });

  // ─── SSE helpers : produce a ReadableStream of formatted SSE events ─
  function sseStream(events, delayMs = 80) {
    return new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        for (const ev of events) {
          await new Promise(r => setTimeout(r, delayMs));
          const data = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
          controller.enqueue(enc.encode(`event: ${ev.event}\ndata: ${data}\n\n`));
        }
        controller.close();
      },
    });
  }

  const fakeAgentStream = (req) => {
    const msg = (req && req.message) || '?';
    const reply =
      'Selon JeuxDeMots (mocké), voici ce que je peux dire à propos de **' +
      msg.slice(0, 60).replace(/\*/g, '') + '** :\n\n' +
      '• L\'agent appelle plusieurs outils (`relations_from`, `term_exists`…) pour rassembler les triplets pertinents.\n' +
      '• En production, cette réponse serait streamée par l\'endpoint `/api/agent/stream` connecté à Gemini ou Claude.\n' +
      '• Active la vraie API en lançant `uvicorn app_fastapi:app` côté backend.';
    const chunks = reply.split(' ');
    const events = [];
    events.push({ event: 'tool', data: { name: 'term_exists', args: { term: msg.split(' ')[0] }, dur_ms: 32 } });
    events.push({ event: 'tool', data: { name: 'relations_from', args: { term: msg.split(' ')[0], rel: 'r_carac' }, dur_ms: 124, count: 12 } });
    let acc = '';
    for (const w of chunks) {
      acc += (acc ? ' ' : '') + w;
      events.push({ event: 'response', data: { text: acc } });
    }
    events.push({ event: 'done', data: '{}' });
    return events;
  };

  const fakeJarvisStream = (flowId, req) => {
    const events = [];
    events.push({ event: 'iter', data: { n: 1 } });
    events.push({ event: 'tool', data: { name: 'relations_from', args: {}, dur_ms: 124 } });
    events.push({ event: 'accept', data: { label: 'chat | r_carac | curieux', score: 0.92 } });
    events.push({ event: 'tool', data: { name: 'analogies', args: {}, dur_ms: 98 } });
    events.push({ event: 'accept', data: { label: 'chat | r_carac | indépendant', score: 0.89 } });
    events.push({ event: 'reject', data: { label: 'chat | r_carac | aboyeur', reason: 'contradicted by r_agent(aboyer, chien)' } });
    events.push({ event: 'accept', data: { label: 'chat | r_carac | propre', score: 0.81 } });
    events.push({ event: 'accept', data: { label: 'chat | r_carac | nocturne', score: 0.77 } });
    events.push({ event: 'done', data: { accepted: 4, rejected: 1 } });
    return events;
  };

  // ─── Router ─────────────────────────────────────────────────────
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (!/(?:^|\/)api\//.test(url)) return origFetch(input, init);

    const path = url.split('?')[0].replace(/^.*\/api\//, 'api/');
    let body = {};
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch { body = {}; }
    }

    const respond = (payload, status = 200) => Promise.resolve(new Response(
      JSON.stringify(payload),
      { status, headers: { 'Content-Type': 'application/json' } },
    ));
    const sseResponse = (events, delay = 90) => Promise.resolve(new Response(
      sseStream(events, delay),
      { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    ));

    // Routes
    if (path === 'api/explore')      return respond(fakeExplore(body));
    if (path === 'api/factcheck')    return respond(fakeFactcheck(body));
    if (path === 'api/subgraph')     return respond(fakeSubgraph(body));
    if (path === 'api/agent/stream') return sseResponse(fakeAgentStream(body), 70);
    const jm = path.match(/^api\/jarvis\/([^/]+)\/stream$/);
    if (jm)                          return sseResponse(fakeJarvisStream(jm[1], body), 350);
    if (path === 'api/pool/status')  return respond(fakePoolStatus());
    if (path === 'api/pool/rotate')  return respond({ ...fakePoolStatus(), current_key_index: 1 });
    if (path === 'api/productions')  return respond({
      productions: [
        { name: '2026-05-28_enrich-chat_carac.csv', size: 1842, mtime: '2026-05-28T14:32:00Z', n_lines: 18 },
        { name: '2026-05-27_audit-felin.json',       size: 4521, mtime: '2026-05-27T09:11:00Z', n_lines: 42 },
        { name: '2026-05-26_factcheck-batch.csv',    size: 9230, mtime: '2026-05-26T17:48:00Z', n_lines: 87 },
        { name: '2026-05-25_synth-voiture.md',       size: 2104, mtime: '2026-05-25T11:02:00Z', n_lines: 36 },
        { name: '2026-05-24_enrich-fruit.csv',       size: 1320, mtime: '2026-05-24T15:20:00Z', n_lines: 14 },
      ],
      archives: [
        { name: '2026-05-20_old-enrich.csv',  size: 880,  mtime: '2026-05-20T10:00:00Z', n_lines: 9 },
        { name: '2026-05-15_old-audit.json',  size: 2200, mtime: '2026-05-15T12:00:00Z', n_lines: 22 },
      ],
    });
    if (path === 'api/productions/file')   {
      const name = (url.match(/name=([^&]+)/) || [])[1] || '';
      const decoded = decodeURIComponent(name);
      const content = decoded.endsWith('.csv')
        ? 'subject,relation,object,weight,annotation\nchat,r_carac,curieux,92,\nchat,r_carac,indépendant,89,\nchat,r_carac,propre,81,constitutif\nchat,r_carac,nocturne,77,\nchat,r_carac,silencieux,71,'
        : decoded.endsWith('.json')
          ? '{\n  "term": "félin",\n  "depth": 2,\n  "candidates": [\n    {"triplet": "félin r_has_part griffe", "score": 0.92, "validated": true},\n    {"triplet": "félin r_has_part queue",  "score": 0.89, "validated": true}\n  ],\n  "rejected": 3\n}'
          : `# Synthèse — voiture\n\n## Sens identifiés\n\n- **automobile** (sens dominant, w=842)\n- **wagon ferroviaire** (technique, w=312)\n- **moyen de transport** (générique, w=198)\n- **véhicule hippomobile** (historique, w=89)\n\n## Caractéristiques\n\nLe terme *voiture* est polysémique. JeuxDeMots distingue ces sens via la relation \`r_raff\`.`;
      return respond({ content, mime: decoded.endsWith('.json') ? 'application/json' : decoded.endsWith('.csv') ? 'text/csv' : 'text/markdown' });
    }
    if (path === 'api/productions/submit') return respond({ ok: true, n: 0 });
    if (path === 'api/productions/delete') return respond({ ok: true });
    if (path === 'api/admin/info')   return respond({ admin: false, env_vars: [] });
    if (path === 'api/admin/auth')   return respond({ ok: false, error: 'admin désactivé en mode démo.' }, 403);
    if (path === 'api/admin/export-secrets') return respond({}, 403);
    if (path === 'api/admin/env-set') return respond({ ok: true });
    if (path === 'api/admin/cache-clear') return respond({ ok: true, cleared: 0 });

    // Fallback : 404
    return respond({ error: `Mock fetch: route ${path} non gérée.` }, 404);
  };

  console.info('[mock-api] fetch interceptor actif — toutes les routes /api/* sont mockées.');
})();
