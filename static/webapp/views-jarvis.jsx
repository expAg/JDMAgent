// View: Jarvis — autonomous looping pipelines.
//
// Landing = a Projet-style panel carousel: a "Sommaire" overview panel
// followed by one design panel per flow, presented in sequence. Each flow
// panel shows its loop laid out step-by-step, the params you'll set, and a
// preview of the kind of results it accumulates, with a "Lancer" CTA that
// drops into the live auto-loop monitor (JarvisRun, unchanged).
//
// Skin-aware (uses --bg, --bg-card, --line, --accent, --jdm-* vars).

// Catalogue des 6 flux JDM réels (mapping vers les sous-commandes
// /api/jarvis/{flow_id}/stream du backend). Conserve la structure
// attendue par le design (id/title/kicker/desc/accent/loopOf/produces/
// category/tags/steps). Les TOOL_DOCS / FLOW_TOOL_STEPS / FLOW_FAKES
// restent fictifs en l'état (à câbler en phase 2 sur le vrai registre
// d'outils + SSE backend ; cf. handoff README §6).
const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'proposition → validation → consolidation',
    produces: 'triplets consolidés (.enrich)',
    category: 'Production',
    tags: ['proposition', 'validation', 'consolidation', 'inférence', 'LLMDrops'],
    steps: [
      { n: 'Proposition',   d: 'propose des triplets candidats sur la relation cible' },
      { n: 'Validation',    d: 'factcheck JDM + inférence (effort 1/2)' },
      { n: 'Consolidation', d: 'écrit dans le .enrich ceux qui passent' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit sémantique',
    kicker: 'Flux 2',
    desc: 'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit deux sections (verdicts + META).',
    accent: 'var(--jdm-cyan)',
    loopOf: 'sens → triplet → verdict',
    produces: 'verdicts par sens (.audit)',
    category: 'Qualité',
    tags: ['polysémie', 'sens', 'verdict', 'META'],
    steps: [
      { n: 'Disambiguation', d: 'isole les sens dominants du terme' },
      { n: 'Cross-check',    d: 'audite chaque triplet par sens' },
      { n: 'Verdict',        d: 'LEGITIME / CONTRASTIF / À REVOIR / NEGATION' },
    ],
  },
  {
    id: 'gap',
    title: 'Détection de trous',
    kicker: 'Flux 3',
    desc: 'Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l\'enrichissement de façon ciblée. Sortie : rapport JSON.',
    accent: 'var(--jdm-green)',
    loopOf: 'parcours → diagnostic → trous',
    produces: 'rapport de trous (MISSING/LOW)',
    category: 'Exploration',
    tags: ['couverture', 'trous', 'diagnostic'],
    steps: [
      { n: 'Parcours',   d: 'inventorie les relations existantes' },
      { n: 'Diagnostic', d: 'compare à la couverture attendue' },
      { n: 'Trous',      d: 'liste les MISSING / NEGATIVE / LOW_COVERAGE' },
    ],
  },
  {
    id: 'signalement',
    title: 'Signalement',
    kicker: 'Flux 4',
    desc: 'Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.',
    accent: 'var(--jdm-orange)',
    loopOf: 'inventaire → flag → catégorisation',
    produces: 'suspects flaggés (.err)',
    category: 'Qualité',
    tags: ['suspects', 'incohérence', 'polarité', 'annotations'],
    steps: [
      { n: 'Inventaire',     d: 'récupère les triplets candidats à inspecter' },
      { n: 'Flag',           d: 'jugement linguistique LLM par triplet' },
      { n: 'Catégorisation', d: 'sémantique / polarité / annotation_oubliée / …' },
    ],
  },
  {
    id: 'stats',
    title: 'Stats',
    kicker: 'Flux 5',
    desc: 'Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré (.stat).',
    accent: 'var(--jdm-violet)',
    loopOf: 'inventaire → agrégation',
    produces: 'récap structuré (.stat)',
    category: 'Synthèse',
    tags: ['distribution', 'compteurs', 'poids'],
    steps: [
      { n: 'Inventaire', d: 'récupère les relations & leurs poids' },
      { n: 'Agrégation', d: 'distribution par relation & par terme' },
    ],
  },
  {
    id: 'annotation',
    title: 'Annotation sémantique',
    kicker: 'Flux 6',
    desc: 'Annote les triplets existants selon la taxonomie 4 catégories (constitutif / contrastif / non spécifique / exception). L\'annotation qualifie le LIEN, pas l\'objet. Produit un fichier .annot deux sections (annotations + signalement des désaccords avec JDM existant).',
    accent: 'var(--jdm-yellow)',
    loopOf: 'triplet → jugement → catégorie',
    produces: 'annotations (.annot)',
    category: 'Production',
    tags: ['constitutif', 'contrastif', 'taxonomie', 'lien'],
    steps: [
      { n: 'Lecture',  d: 'récupère les triplets à annoter pour le terme' },
      { n: 'Jugement', d: 'décide constitutif / contrastif / non spécifique / exception' },
      { n: 'Sortie',   d: 'écrit dans .annot + section SIGNALEMENT si désaccord JDM' },
    ],
  },
];

// Three top-level sections shown in the horizontal "sommaire" nav.
// Ordre = position dans le carrousel : Configuration (gauche) → Supervision
// (CENTRE = entree par defaut) → Repertoire (droite, ex-« Accueil »).
// Supervision est l'entree « tableau de bord live » de la console.
const J_SECTIONS = [
  { id: 'config',      label: 'Configuration' },
  { id: 'supervision', label: 'Supervision' },
  { id: 'repertoire',  label: 'Répertoire' },
];
// Carousel track = the 3 sections, then one detail panel per flow
// (reachable from the Accueil / Supervision cards).
const J_PANELS = [
  ...J_SECTIONS,
  ...JARVIS_FLOWS.map(f => ({ id: f.id, label: f.kicker })),
];
const JPANEL_BASIS = `${100 / J_PANELS.length}%`;

// ─────────────────────────────────────────────────────────────────────

// REAL BACKEND WIRING (extrait de fastapi-self) — câble le design Jarvis

// sur le vrai /api/jarvis/{flow_id}/stream + JarvisStore (singleton qui

// survit aux unmount, persiste runId en localStorage, reconcile au boot).

// ─────────────────────────────────────────────────────────────────────

// LLM peut le faire directement via upload=True). Gap n'écrit pas
// de fichier → pas soumissible. Tous les autres sortent un fichier
// avec une extension reconnue par submit_to_jdm.
const SUBMITTABLE_FLOWS = new Set(['enrich', 'audit', 'signalement',
                                    'stats', 'annotation']);


// ─────────────────────────────────────────────────────────────────────
// JarvisStore — singleton qui survit aux unmounts de JarvisRun.
//
// Pourquoi : quand l'utilisateur quitte l'onglet Jarvis pendant un run,
// sans ce store le composant unmount, son fetch SSE est aborted par GC,
// sse-starlette détecte la déconnexion côté serveur, le générateur
// Python lève CancelledError → flow tué, progrès perdu, tokens LLM
// consommés pour rien.
//
// Avec : le reader SSE vit dans le store, indépendant du cycle React.
// Le composant lit l'état et se réabonne au mount. Le serveur ne voit
// pas de déconnexion, le flow continue, on retrouve tout en revenant.
//
// Bonus : permet l'affichage du badge « 🟢 en cours » sur la liste
// des flows (activeFlowIds()) — y compris depuis ViewJarvis.
// ─────────────────────────────────────────────────────────────────────
const _JARVIS_RUNS = {};
const _JARVIS_LISTENERS = {};

function _emptyJarvisRun(flowId) {
  return {
    flowId,
    status: 'idle',  // 'idle' | 'running' | 'done' | 'error'
    headline: '',
    log: [],
    metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
    accepted: [],
    narrationHTML: '',
    filePreview: '',
    filePath: null,
    resumeState: null,
    // internes — pas lus par le composant
    _abortCtrl: null,
    _startTime: null,
    _elapsedTimer: null,
    _prevConsolidatedCount: 0,
  };
}

const JarvisStore = {
  get(flowId) {
    if (!_JARVIS_RUNS[flowId]) _JARVIS_RUNS[flowId] = _emptyJarvisRun(flowId);
    return _JARVIS_RUNS[flowId];
  },
  patch(flowId, partial) {
    Object.assign(this.get(flowId), partial);
    this._emit(flowId);
  },
  _emit(flowId) {
    const subs = _JARVIS_LISTENERS[flowId];
    if (subs) for (const cb of subs) { try { cb(); } catch {} }
    const glob = _JARVIS_LISTENERS['*'];
    if (glob) for (const cb of glob) { try { cb(); } catch {} }
  },
  subscribe(flowId, cb) {
    if (!_JARVIS_LISTENERS[flowId]) _JARVIS_LISTENERS[flowId] = new Set();
    _JARVIS_LISTENERS[flowId].add(cb);
    return () => { if (_JARVIS_LISTENERS[flowId]) _JARVIS_LISTENERS[flowId].delete(cb); };
  },
  activeFlowIds() {
    return Object.entries(_JARVIS_RUNS)
      .filter(([, s]) => s.status === 'running')
      .map(([id]) => id);
  },
  stop(flowId) {
    // Stop = cooperative cancellation côté serveur (POST /cancel) qui
    // pose un flag que le bg thread voit entre deux chunks → break du
    // for loop → finally blocs propres (exclusion_context exit, etc.).
    // Latence ≈ 5-15s (le round-trip LLM en cours se termine, aucun
    // nouveau ne démarre). En parallèle on coupe l'observation SSE
    // locale pour libérer le reader.
    const cur = this.get(flowId);
    if (cur.runId) {
      // Fire-and-forget : on n'attend pas la réponse pour ne pas bloquer
      // l'UI. Le bg confirmera le stop via event 'cancelled' dans la SSE
      // (que l'observation soit encore branchée ou pas — au pire on le
      // récupère au prochain bootReconcile via GET /runs).
      fetch(`api/jarvis/runs/${encodeURIComponent(cur.runId)}/cancel`, {
        method: 'POST',
      }).catch(() => {});
      const ts = () => new Date().toTimeString().slice(0, 8);
      cur.log = [...cur.log, {
        t: ts(), tag: '[stop]', kind: 'iter',
        msg: 'Demande d\'arrêt envoyée — le flow se termine après le chunk en cours (~5-15s).',
      }];
      this._emit(flowId);
    }
    if (cur._abortCtrl) try { cur._abortCtrl.abort(); } catch {}
  },
  reset(flowId) {
    const cur = this.get(flowId);
    if (cur._abortCtrl) try { cur._abortCtrl.abort(); } catch {}
    if (cur._elapsedTimer) clearInterval(cur._elapsedTimer);
    _localRunIdSet(flowId, null);  // purge la persistance localStorage
    _JARVIS_RUNS[flowId] = _emptyJarvisRun(flowId);
    this._emit(flowId);
  },

  // Helpers internes ─────────────────────────────────────
  _resetRunData(cur) {
    Object.assign(cur, {
      status: 'running',
      log: [],
      accepted: [],
      narrationHTML: '',
      filePreview: '',
      filePath: null,
      headline: '',
      metrics: { toolsCalled: 0, accepted: 0, produced: 0, tokens: 0, elapsed: 0 },
      _prevConsolidatedCount: 0,
      _startTime: Date.now(),
      runId: null,
    });
  },
  _startElapsedTimer(cur) {
    if (cur._elapsedTimer) clearInterval(cur._elapsedTimer);
    cur._elapsedTimer = setInterval(() => {
      cur.metrics = { ...cur.metrics, elapsed: Date.now() - (cur._startTime || Date.now()) };
      this._emit(cur.flowId);
    }, 250);
  },

  /**
   * Réattache une stream SSE à un run_id existant côté serveur. Utilisé
   * au boot pour reconnecter aux runs qui tournaient avant un refresh
   * ou une tab close. Le serveur replay tous les events bufferés puis
   * passe en live → on retrouve l'état exact.
   *
   * Cas d'usage : au boot, on lit localStorage, on GET /api/jarvis/runs
   * pour filtrer les still-active, et on appelle attach() pour chacun.
   */
  async attach(flowId, runId, knownHeadline) {
    const cur = this.get(flowId);
    if (cur.status === 'running') return;  // déjà attaché ou en cours
    this._resetRunData(cur);
    cur.status = 'running';
    cur.runId = runId;
    if (knownHeadline) cur.headline = knownHeadline;
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(flowId);
    await this._consumeStream(
      flowId,
      `api/jarvis/runs/${encodeURIComponent(runId)}/stream`,
      { method: 'GET' },
      cur._abortCtrl,
    );
  },
  async start(flowId, { params, isResume, resumeState }) {
    const cur = this.get(flowId);
    if (cur.status === 'running') return;
    if (!isResume) {
      this._resetRunData(cur);
    } else {
      const ts = () => new Date().toTimeString().slice(0, 8);
      cur.status = 'running';
      cur.log = [...cur.log, { t: ts(), tag: '[resume]', kind: 'iter', msg: 'Reprise après abort PerDay…' }];
    }
    cur._abortCtrl = new AbortController();
    this._startElapsedTimer(cur);
    this._emit(flowId);

    const flowParams = {
      ...params,
      ...(isResume && resumeState ? { resume_state: resumeState } : {}),
    };
    await this._consumeStream(
      flowId,
      `api/jarvis/${flowId}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_id: flowId, params: flowParams }),
      },
      cur._abortCtrl,
    );
  },

  // Boucle de consommation SSE partagée par start() et attach(). Le
  // dispatchEv gère désormais 'run_id' (persisté en localStorage pour
  // reconnexion ultérieure) et 'ping' (keepalive — ignoré).
  async _consumeStream(flowId, url, fetchInit, abortCtrl) {
    const cur = this.get(flowId);
    const ts = () => new Date().toTimeString().slice(0, 8);
    try {
      const res = await fetch(url, {
        ...fetchInit,
        signal: abortCtrl.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      const dispatchEv = (ev) => {
        const d = ev.data || {};
        switch (ev.event) {
          case 'run_id':
            // Premier event de la SSE POST — on persiste pour reconnect.
            if (d.run_id) {
              cur.runId = d.run_id;
              _localRunIdSet(flowId, d.run_id);
            }
            break;
          case 'ping':
            // Keepalive serveur (toutes les ~20s d'idle) — no-op.
            break;
          case 'headline':
            cur.headline = d.text || '';
            // Premier event utile : on enregistre le run_id côté serveur
            // si présent dans le payload (sécurité / cas de reconnect).
            if (d.run_id && !cur.runId) {
              cur.runId = d.run_id;
              _localRunIdSet(flowId, d.run_id);
            }
            cur.log = [...cur.log, { t: ts(), tag: '[start]', kind: 'iter', msg: d.text || '' }];
            break;
          case 'jarvis': {
            const msgs = d.messages || [];
            const assistant = msgs.filter(m => m.role === 'assistant').slice(-1)[0];
            if (d.state) cur.resumeState = d.state;
            if (assistant && assistant.content) cur.narrationHTML = assistant.content;
            const cc = Number(d.consolidated_count || 0);
            if (cc !== cur._prevConsolidatedCount) {
              cur.metrics = { ...cur.metrics, accepted: cc };
              cur._prevConsolidatedCount = cc;
            }
            if (assistant && assistant.content) {
              const toolMatches = assistant.content.match(/class="jdm-narration"/g) || [];
              cur.metrics = { ...cur.metrics, toolsCalled: toolMatches.length };
            }
            if (typeof d.tokens_estimate === 'number') {
              cur.metrics = { ...cur.metrics, tokens: d.tokens_estimate };
            }
            if (Array.isArray(d.consolidated)) {
              // On garde tous les champs utiles à <ItemCard> (subject/
              // relation/target/explanation) pour pouvoir afficher
              // l'explication d'inférence sous chaque triplet — même
              // rendu que les autres flows.
              cur.accepted = d.consolidated.map(c => ({
                type: 'consolidated',
                subject: c.term || '',
                relation: c.relation || '',
                target: c.target || '',
                explanation: c.explanation || '',
                // Compat ancien rendu (label/score) : conservés au cas où.
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: '✓',
              }));
              // Push une entry log [ok] par NOUVEAU triplet (= delta avec
              // le compteur précédent). Permet à la zone « flux en direct »
              // de la Supervision d'afficher chaque consolidation au format
              // triplet pretty, à côté des autres events système ([file],
              // [start], etc.). Le _loggedAcceptedCount est strictement
              // monotone : si d.consolidated diminue (reset), on ne push
              // rien et on baisse le compteur sans bruit.
              const _prevLogged = cur._loggedAcceptedCount || 0;
              const nbNew = d.consolidated.length - _prevLogged;
              if (nbNew > 0) {
                const newOnes = d.consolidated.slice(_prevLogged);
                for (const c of newOnes) {
                  cur.log = [...cur.log, {
                    t: ts(), tag: '[ok]', kind: 'accept',
                    msg: `${c.term} | ${c.relation} | ${c.target}`,
                    triplet: {
                      term: c.term, relation: c.relation, target: c.target,
                      schema: c.schema || '',
                      explanation: c.explanation || '',
                    },
                  }];
                }
              }
              cur._loggedAcceptedCount = d.consolidated.length;
            }
            if (typeof d.file_preview === 'string') cur.filePreview = d.file_preview;
            if (d.file_path) {
              // cur.filePath = toujours updaté (suit le dernier path actif :
              // canonical_path en cours d'auto_append OU dernier path écrit par
              // le LLM — backend alterne entre les deux).
              cur.filePath = d.file_path;
              // Le LOG ne push qu'une seule entrée par path UNIQUE — sinon
              // on voit alterner [file] enrichment_submission.enrich /
              // [file] jdm_*.enrich à chaque tick parce que le backend
              // yield les deux sources (canonical vs path LLM) en boucle.
              const fileMsg = `Fichier : ${d.file_path}`;
              const alreadyLogged = cur.log.some(
                l => l.tag === '[file]' && l.msg === fileMsg
              );
              if (!alreadyLogged) {
                cur.log = [...cur.log, {
                  t: ts(), tag: '[file]', kind: 'accept', msg: fileMsg,
                }];
              }
            }
            break;
          }
          case 'cancelled':
            // Le bg thread a vu le flag et a fait sync_gen.close() —
            // les finally ont tourné, le flow s'est arrêté proprement.
            // Le serveur peut encore pousser un 'done' juste après pour
            // confirmer la fin de boucle — on ignorera le doublon car
            // status est déjà 'done'.
            cur.log = [...cur.log, { t: ts(), tag: '[stop]', kind: 'iter', msg: d.text || 'Flow annulé.' }];
            cur.status = 'done';
            _localRunIdSet(flowId, null);
            break;
          case 'done':
            // Idempotent : si déjà 'done' (post-cancellation), on ne
            // ré-écrit pas l'event log avec un message contradictoire.
            if (cur.status !== 'done') {
              cur.log = [...cur.log, { t: ts(), tag: '[done]', kind: 'accept', msg: 'Flow terminé.' }];
              cur.status = 'done';
            }
            _localRunIdSet(flowId, null);
            break;
          case 'error':
            cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: d.text || 'erreur' }];
            cur.status = 'error';
            _localRunIdSet(flowId, null);
            break;
        }
        this._emit(flowId);
      };
      const flush = () => {
        const re = /\r\n\r\n|\n\n|\r\r/;
        let m;
        while ((m = re.exec(buf)) !== null) {
          const raw = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          const ev = parseSSEEventJarvis(raw);
          if (ev) dispatchEv(ev);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        flush();
      }
      if (buf.trim()) {
        const ev = parseSSEEventJarvis(buf);
        if (ev) dispatchEv(ev);
      }
      if (cur.status === 'running') cur.status = 'done';
    } catch (e) {
      if (cur._abortCtrl && cur._abortCtrl.signal.aborted) {
        // Abort côté client = on arrête l'observation. Le bg thread
        // serveur peut continuer — donc on ne marque PAS done, on
        // garde le runId. La reconnexion ultérieure (boot reconcile)
        // récupérera la progression.
        cur.log = [...cur.log, { t: ts(), tag: '[stop]', kind: 'iter', msg: 'Observation arrêtée (le flow continue côté serveur).' }];
        // Statut = idle pour signaler que le composant local est détaché ;
        // le badge "en cours" reste via le serveur listing au prochain
        // bootReconcile() ou getRunStatus().
        cur.status = 'idle';
      } else {
        cur.log = [...cur.log, { t: ts(), tag: '[err]', kind: 'reject', msg: String(e && e.message ? e.message : e) }];
        cur.status = 'error';
        _localRunIdSet(flowId, null);
      }
    } finally {
      if (cur._elapsedTimer) { clearInterval(cur._elapsedTimer); cur._elapsedTimer = null; }
      this._emit(flowId);
    }
  },

  // Boot reconcile : appelée une fois au démarrage de l'app pour
  // détecter les runs qui tournaient encore côté serveur quand
  // l'utilisateur a fermé la tab / refresh / etc. Pour chaque
  // (flowId, runId) trouvé en localStorage qui est encore actif
  // côté serveur, on rouvre une stream pour récupérer la progression.
  async bootReconcile() {
    let local = {};
    try { local = _localRunIdMap(); } catch {}
    const flowIds = Object.keys(local);
    if (flowIds.length === 0) return;
    let serverRuns = [];
    try {
      const r = await fetch('api/jarvis/runs');
      if (r.ok) {
        const d = await r.json();
        serverRuns = d.runs || [];
      }
    } catch {}
    const activeOnServer = new Map(
      serverRuns
        .filter(s => s.status === 'starting' || s.status === 'running')
        .map(s => [s.run_id, s])
    );
    for (const flowId of flowIds) {
      const runId = local[flowId];
      if (!runId) continue;
      const serverInfo = activeOnServer.get(runId);
      if (!serverInfo) {
        // Plus actif côté serveur (terminé, ou TTL dépassé, ou process
        // restart) → purge la persistance.
        _localRunIdSet(flowId, null);
        continue;
      }
      // Reconnect — fire-and-forget. attach() retourne après que la
      // stream se ferme (= run terminé) ou que l'observation est
      // arrêtée par l'utilisateur. Pas besoin d'attendre.
      this.attach(flowId, runId, serverInfo.headline).catch(() => {});
    }
  },
};

// ── localStorage helpers ────────────────────────────────────────
// Stocke un mapping {[flowId]: runId} pour permettre la reconnexion
// au boot après refresh / tab close. Effacée à la terminaison normale
// (done / error) du flow ou au reset explicite.
const _JARVIS_LS_KEY = 'jdm_jarvis_runs_v1';

function _localRunIdMap() {
  try {
    const raw = localStorage.getItem(_JARVIS_LS_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch { return {}; }
}
function _localRunIdSet(flowId, runId) {
  try {
    const cur = _localRunIdMap();
    if (runId) cur[flowId] = runId; else delete cur[flowId];
    localStorage.setItem(_JARVIS_LS_KEY, JSON.stringify(cur));
  } catch {}
}
if (typeof window !== 'undefined') window.__jdmJarvisStore = JarvisStore;

function useJarvisRunState(flowId) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe(flowId, force), [flowId]);
  return JarvisStore.get(flowId);
}

function useJarvisActiveSet() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JarvisStore.subscribe('*', force), []);
  return new Set(JarvisStore.activeFlowIds());
}

function ItemCard({ item, accent }) {
  // Couleur de bord par type — signal visuel rapide.
  const typeStyle = {
    consolidated:       { border: 'var(--jdm-green)',   icon: '✓', label: 'consolidé' },
    flagged:            { border: 'var(--jdm-orange)',  icon: '⚠', label: 'suspect' },
    signalement:        { border: 'var(--jdm-magenta)', icon: '!', label: 'désaccord JDM' },
    audit_signalement:  { border: 'var(--jdm-magenta)', icon: '!', label: 'verdict' },
    sens:               { border: 'var(--line)',        icon: '·', label: 'sens' },
    meta:               { border: 'var(--accent)',      icon: '✎', label: 'observation' },
  }[item.type] || { border: 'var(--line)', icon: '·', label: '' };

  // Item meta = ligne de prose simple, pas un triplet.
  if (item.type === 'meta') {
    return (
      <div className="fade-up" style={{
        padding: '8px 10px',
        background: 'var(--bg-elev)',
        borderLeft: `3px solid ${typeStyle.border}`,
        borderRadius: '0 var(--radius) var(--radius) 0',
        fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5,
      }}>{item.raw}</div>
    );
  }

  // Triplet + (option) catégorie + (option) bloc explication.
  const tripletLine = (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <span style={{ color: typeStyle.border, flexShrink: 0,
                     fontWeight: 700, width: 12, textAlign: 'center' }}>
        {typeStyle.icon}
      </span>
      <span style={{ color: 'var(--ink)' }}>
        {item.subject} <span style={{ color: 'var(--ink-3)' }}>|</span>
        {' '}{item.relation} <span style={{ color: 'var(--ink-3)' }}>|</span>
        {' '}{item.target}
      </span>
    </div>
  );

  // Catégorie / verdict / JDM≠LLM — affiché en chip discret sous le triplet.
  const chips = [];
  if (item.category) chips.push({ k: 'cat', v: item.category });
  if (item.verdict)  chips.push({ k: 'verdict', v: item.verdict });
  if (item.jdm)      chips.push({ k: 'JDM', v: item.jdm });
  if (item.llm)      chips.push({ k: 'LLM', v: item.llm });

  return (
    <div className="fade-up" style={{
      padding: '8px 10px',
      background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)',
      borderLeft: `3px solid ${typeStyle.border}`,
      borderRadius: '0 var(--radius) var(--radius) 0',
    }}>
      {tripletLine}
      {chips.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          marginTop: 6, marginLeft: 18,
        }}>
          {chips.map((c, i) => (
            <span key={i} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--line-soft)',
              borderRadius: 3,
              color: c.k === 'LLM' ? typeStyle.border
                   : c.k === 'JDM' ? 'var(--ink-3)'
                   : 'var(--ink-2)',
            }}>
              <span style={{ color: 'var(--ink-3)' }}>{c.k}:</span> {c.v}
            </span>
          ))}
        </div>
      )}
      {/* Bloc explication stylisé — c'est ce que le LLM a dit sur ce
          signalement / verdict / désaccord. C'est ÇA la valeur ajoutée
          du flow ; on la met bien en évidence. */}
      {item.explanation && (
        <div style={{
          marginTop: 6, marginLeft: 18,
          padding: '6px 9px',
          background: 'var(--bg-card)',
          borderLeft: `2px solid ${accent || typeStyle.border}`,
          borderRadius: '0 3px 3px 0',
          fontSize: 11, color: 'var(--ink-2)',
          lineHeight: 1.5, fontStyle: 'italic',
        }}>
          {item.explanation}
        </div>
      )}
    </div>
  );
}

// ─── Markdown render (reuse pattern from views-agent) ────────────
// Contenu produit par notre propre LLM = confiance, on n'escape pas.
// marked.js (chargé dans index.html) fait tout le boulot ; fallback
// léger si non disponible.
function renderMarkdownJarvis(s) {
  s = s || '';
  if (typeof window !== 'undefined' && window.marked) {
    try {
      window.marked.setOptions({ gfm: true, breaks: true });
      return window.marked.parse(s);
    } catch {}
  }
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-elev);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>')
    .replace(/\n/g, '<br/>');
}

// ─── parseFilePreview ─────────────────────────────────────────────
// À partir du contenu textuel d'un .enrich / .err / .audit / .annot /
// .stat, extrait une liste structurée d'items à afficher dans le
// panneau de droite. Chaque item :
//   { type: 'consolidated'|'flagged'|'signalement'|'annotation'|'meta'|'sens',
//     subject, relation, target,    (canonique pipe-separated)
//     category, verdict, jdm, llm,  (champs optionnels selon type)
//     explanation,                  (justification / argument contre)
//     raw }                         (la ligne brute pour fallback)
//
// Comprend les 4 formats :
//   .enrich : term|rel|target|annotation < explanation >
//   .err    : term|rel|target|catégorie_suspect|justification
//   .annot  : sujet|rel|objet|annotation < justif >  +  section
//             =====SIGNALEMENT===== : sujet|rel|objet|JDM:x|LLM:y < arg >
//   .audit  : sections === SENS ===, === SIGNALEMENTS ===, === META ===
//             la section SIGNALEMENTS contient term|rel|target|verdict|justif
function parseFilePreview(text, flowId) {
  text = (text || '').toString();
  if (!text.trim()) return { items: [], counts: {} };
  const lines = text.split(/\r?\n/);
  const items = [];
  let inSignalement = false;
  let inAuditSignalements = false;
  let inAuditMeta = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Commentaires (# ...) sauvent comme meta light, on saute pour
    // l'affichage principal mais on sait les détecter.
    if (line.startsWith('#')) continue;

    // Délimiteurs de sections
    const upper = line.toUpperCase();
    if (/^=====+SIGNALEMENT=====+/i.test(line) ||
        upper.includes('SIGNALEMENT')) {
      inSignalement = true;
      inAuditSignalements = upper.includes('=== SIGNALEMENT') ||
                            upper.includes('SIGNALEMENTS ===');
      inAuditMeta = false;
      continue;
    }
    if (/^===\s*META\s*===$/i.test(line)) {
      inAuditMeta = true; inSignalement = false; inAuditSignalements = false;
      continue;
    }
    if (/^===\s*SENS\s*===$/i.test(line)) {
      inAuditMeta = false; inSignalement = false; inAuditSignalements = false;
      // SENS dans audit → on les push comme type 'sens'
      // (la 1re ligne après le délimiteur sera la suivante)
      continue;
    }
    // Bloc META : prose, on peut le montrer dans une carte spéciale
    if (inAuditMeta) {
      items.push({ type: 'meta', raw: line });
      continue;
    }

    // Format avec explication entre < > (commune à .enrich/.annot/.audit)
    // Accepte les pipes avec OU sans espaces (\s*) et l'annotation entre
    // crochets optionnels [...] (le nouveau format) — rétro-compat
    // avec l'ancien format sans espaces/crochets.
    const mWithExplain = line.match(/^([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)(?:\s+<\s*(.+?)\s*>\s*)?$/);
    if (mWithExplain) {
      const [, subject, relation, target, restRaw, explanation] = mWithExplain;
      // Strip les crochets autour de l'annotation pour l'affichage
      // (le nouveau format les ajoute, on les retire pour l'UI).
      const stripBrackets = (s) => (s || '').trim().replace(/^\[(.*)\]$/, '$1').trim();
      const rest = restRaw.trim();
      // Section SIGNALEMENT du .annot : rest peut contenir
      // "JDM:[x] | LLM:[y]" (nouveau) ou "JDM:<x>|LLM:<y>" (ancien) → extraction tolérante.
      if (inSignalement && /JDM\s*:/i.test(rest) && /LLM\s*:/i.test(rest)) {
        const jdmM = rest.match(/JDM\s*:\s*\[?([^|\]]+)\]?\s*\|\s*LLM\s*:\s*\[?(.+?)\]?\s*$/i);
        if (jdmM) {
          const jdmVal = jdmM[1].trim();
          const llmVal = jdmM[2].trim();
          // Filtrage anti-bug : si JDM == LLM (= pas un vrai désaccord),
          // on REND quand même la ligne mais comme `consolidated` pour
          // ne pas tromper le compteur de signalements et ne pas
          // laisser ce faux désaccord en évidence.
          if (jdmVal.toLowerCase() === llmVal.toLowerCase()) {
            items.push({
              type: 'consolidated',
              subject: subject.trim(), relation: relation.trim(),
              target: target.trim(),
              category: llmVal,
              explanation: (explanation || '').trim(),
              raw: line,
            });
            continue;
          }
          items.push({
            type: 'signalement',
            subject: subject.trim(), relation: relation.trim(),
            target: target.trim(),
            jdm: jdmVal, llm: llmVal,
            explanation: (explanation || '').trim(),
            raw: line,
          });
          continue;
        }
      }
      // .err format : rest = catégorie_suspect, explanation
      if (flowId === 'signalement' || /suspect/i.test(rest)) {
        items.push({
          type: 'flagged',
          subject: subject.trim(), relation: relation.trim(),
          target: target.trim(),
          category: stripBrackets(rest),
          explanation: (explanation || '').trim(),
          raw: line,
        });
        continue;
      }
      // .audit signalements section : rest = verdict
      if (inAuditSignalements) {
        items.push({
          type: 'audit_signalement',
          subject: subject.trim(), relation: relation.trim(),
          target: target.trim(),
          verdict: stripBrackets(rest),
          explanation: (explanation || '').trim(),
          raw: line,
        });
        continue;
      }
      // .enrich / .annot : rest = annotation (avec ou sans crochets)
      items.push({
        type: inSignalement ? 'signalement' : 'consolidated',
        subject: subject.trim(), relation: relation.trim(),
        target: target.trim(),
        category: stripBrackets(rest),
        explanation: (explanation || '').trim(),
        raw: line,
      });
      continue;
    }

    // Lignes 'pure pipe' (.audit SENS, autres tableaux .stat)
    const piped = line.match(/^([^|]+)\|([^|]+)\|([^|]+)$/);
    if (piped) {
      items.push({
        type: 'sens',
        subject: piped[1].trim(),
        relation: piped[2].trim(),
        target: piped[3].trim(),
        raw: line,
      });
      continue;
    }
  }

  // Compteurs par type — utiles pour le dashboard.
  const counts = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});
  return { items, counts };
}

// Libellé adaptatif du compteur "Consolidés" selon le flow.
// (design-pass-2 : aligné sur le wording designer — Signalés/Analysés)
function metricLabelFor(flowId) {
  switch (flowId) {
    case 'enrich':      return { label: 'Consolidés',  sub: 'triplets' };
    case 'audit':       return { label: 'Verdicts',    sub: 'signalements' };
    case 'signalement': return { label: 'Signalés',    sub: 'triplets flaggés' };
    case 'annotation':  return { label: 'Annotations', sub: '+ signalements' };
    case 'stats':       return { label: 'Analysés',    sub: 'Termes/Relations' };
    case 'gap':         return { label: 'Trous',       sub: 'détectés' };
    default:            return { label: 'Items',       sub: 'produits' };
  }
}

// Titre adaptatif du panneau de droite selon le flow.
// (design-pass-2 : 'Triplets signalés' + 'Artefacts analysés')
function panelTitleFor(flowId) {
  switch (flowId) {
    case 'enrich':      return 'Triplets consolidés';
    case 'audit':       return 'Verdicts d\'audit (signalements)';
    case 'signalement': return 'Triplets signalés';
    case 'annotation':  return 'Annotations + signalements';
    case 'stats':       return 'Artefacts analysés';
    case 'gap':         return 'Trous détectés';
    default:            return 'Résultats';
  }
}


function parseSSEEventJarvis(raw) {
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      const v = line.slice(5).replace(/^ /, '');
      data += (data ? '\n' : '') + v;
    }
  }
  if (!data) return null;
  let parsed;
  try { parsed = JSON.parse(data); } catch { parsed = { text: data }; }
  return { event, data: parsed };
}

// Formatte un nombre de tokens : 1234 → "1.2k", 1234567 → "1.2M".
function fmtTokens(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}

function shortArgs(args) {
  if (!args) return '';
  return Object.entries(args)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v.slice(0, 20)}"` : JSON.stringify(v).slice(0, 25)}`)
    .join(', ');
}

function fmtElapsed(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rem = sec - m * 60;
  return `${m}m ${rem.toFixed(1)}s`;
}

const REL_OPTS_COMMON = [
  { value: 'r_isa', label: 'r_isa — est un' },
  { value: 'r_hypo', label: 'r_hypo — exemple de' },
  { value: 'r_carac', label: 'r_carac — caractéristique' },
  { value: 'r_has_part', label: 'r_has_part — parties' },
  { value: 'r_has_color', label: 'r_has_color — couleur' },
  { value: 'r_agent', label: 'r_agent — agent typique' },
  { value: 'r_patient', label: 'r_patient — patient typique' },
  { value: 'r_lieu', label: 'r_lieu — lieu typique' },
  { value: 'r_telic_role', label: 'r_telic_role — à quoi sert' },
];

const BUDGET_OPTS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'illimité', label: 'illimité' },
];

function defaultParamsFor(flowId) {
  // Defaults : term vide partout (= tirage au hasard via pick_random_term),
  // budget illimité, thinking=true (raisonnement activé par défaut sur tous
  // les flows — meilleur taux de consolidation, l'utilisateur peut décocher
  // dans le ParamsForm si latence prioritaire), upload=false, auto_switch=false
  // (= mode B : abort + bouton Continuer).
  //
  // Le `model` et `autoSubmit` sont pré-remplis depuis JConfigPanel
  // (window.__JDM_JARVIS_CONFIG__, persisté en localStorage). L'utilisateur
  // peut toujours override dans le ParamsForm avant Lancer.
  const cfg = (typeof window !== 'undefined' && window.__JDM_JARVIS_CONFIG__) || {};
  // temperature de JConfig : si l'utilisateur l'a deplacee depuis le
  // default (0.3), on l'envoie au backend. Sinon undefined → defaults
  // par-modele cote serveur (jdm_temperature env var, sinon 1.5-1.7).
  const _temp = (typeof cfg.temperature === 'number') ? cfg.temperature : undefined;
  const common = {
    model: cfg.llm || 'gemini-3.1-flash-lite',
    api_key: '', drops_key: '',
    use_thinking: true,
    budget_label: 'illimité',
    auto_switch: false,
    temperature: _temp,
  };
  // `upload` = soumission auto du fichier au LLMDrops (mappe cfg.autoSubmit).
  const autoUpload = cfg.autoSubmit === true;
  switch (flowId) {
    case 'enrich':
      return { ...common, term: '', relation: [],
               target_count: 3, vary_relations: true, iterate: true, upload: autoUpload };
    case 'audit':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'gap':
      return { ...common, term: '' };
    case 'signalement':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'stats':
      return { ...common, term: '', relation: [], upload: autoUpload };
    case 'annotation':
      return { ...common, term: '', relation: [], top_k: 8,
               target_count: 10, upload: autoUpload };
  }
  return common;
}


function ParamsForm({ flow, params, setParams, locked }) {
  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  // Env-aware : la case « Soumettre à LLMDrops » n'est cochable que
  // si une clé est dispo (champ saisi OU env serveur). Sinon disabled
  // + tooltip explicatif.
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  const submitLabel = (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
      color: _canSubmit ? 'var(--ink-2)' : 'var(--ink-3)',
      cursor: _canSubmit ? 'pointer' : 'not-allowed',
      opacity: _canSubmit ? 1 : 0.55,
    }}
    title={_canSubmit
      ? (params.drops_key
        ? 'Le fichier sera soumis automatiquement avec la clé saisie'
        : 'Le fichier sera soumis automatiquement avec la clé serveur (.env)')
      : 'Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer'}>
      <input type="checkbox"
        checked={!!params.upload && _canSubmit}
        disabled={!_canSubmit}
        onChange={(e) => set('upload', e.target.checked)}
        style={{ accentColor: 'var(--accent)' }} />
      Soumettre à LLMDrops
    </label>
  );
  const wrap = (children) => (
    <div style={{ opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : undefined }}>
      {children}
    </div>
  );

  if (flow.id === 'enrich') {
    return wrap(<>
      <Field label="Terme à enrichir">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relations cibles (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— libre (toutes par défaut) —"
          options={REL_OPTS_COMMON} />
      </Field>
      <Field label={`Nombre cible · ${params.target_count}`}>
        <Slider value={params.target_count} onChange={(v) => set('target_count', v)} min={1} max={50} step={1} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={!!params.vary_relations}
          onChange={(e) => set('vary_relations', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Varier les relations
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={!!params.iterate}
          onChange={(e) => set('iterate', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Itérer jusqu'à la cible
      </label>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {submitLabel}
    </>);
  }

  if (flow.id === 'audit' || flow.id === 'signalement' || flow.id === 'stats') {
    return wrap(<>
      <Field label="Terme">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relations (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— toutes —"
          options={REL_OPTS_COMMON} />
      </Field>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {flow.id !== 'stats' && submitLabel}
    </>);
  }

  if (flow.id === 'gap') {
    return wrap(<>
      <Field label="Terme">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
    </>);
  }

  if (flow.id === 'annotation') {
    // Pas de Top-K exposé : le param top_k est laissé à sa valeur par
    // défaut (8) en arrière-plan, il configure la profondeur de
    // récup de triplets candidats par get_relations_of_type. Le seul
    // levier utile pour l'utilisateur est la CIBLE d'annotations
    // (= nombre d'annotations utiles à atteindre par itération).
    return wrap(<>
      <Field label="Terme (optionnel)">
        <Input value={params.term} onChange={(v) => set('term', v)} mono />
      </Field>
      <Field label="Relations (optionnel, multi)">
        <MultiSelect value={params.relation || []}
          onChange={(v) => set('relation', v)}
          placeholder="— toutes principales —"
          options={REL_OPTS_COMMON} />
      </Field>
      <Field label={`Cible d'annotations utiles · ${params.target_count}`}>
        <Slider value={params.target_count} onChange={(v) => set('target_count', v)} min={1} max={50} step={1} />
      </Field>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)', marginBottom: 8,
        fontFamily: 'var(--font-mono)', lineHeight: 1.4,
      }}>
        taxonomie : constitutif / contrastif / non spécifique / exception ·
        annotation qualifie le LIEN · sélectivité &gt; volume · itère
        librement
      </div>
      <Field label="Budget d'outils">
        <Select value={params.budget_label} onChange={(v) => set('budget_label', v)} options={BUDGET_OPTS} />
      </Field>
      {submitLabel}
    </>);
  }

  return null;
}

// Ring interaction CSS (hover spin + scale, soft pulsing halo). Injected once.
const JRING_CSS = `
@keyframes jorbGlow{0%,100%{opacity:.12}50%{opacity:.3}}
@keyframes jringSpin{to{transform:rotate(360deg)}}
.jring-btn{padding:0;border:none;background:transparent;cursor:pointer;border-radius:50%;line-height:0;-webkit-tap-highlight-color:transparent;}
.jring-btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
.jring{display:inline-flex;transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
.jring-btn:hover .jring{transform:scale(1.12);}
.jring-btn:active .jring{transform:scale(.95);}
.jring-arcs{transform-box:view-box;transform-origin:32px 32px;}
.jring-btn:hover .jring-arcs{animation:jringSpin .6s cubic-bezier(.45,0,.2,1);}
.jcfg-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;}
.jcfg-row + .jcfg-row{border-top:1px solid var(--line-soft);}
.jcfg-row--stack{flex-direction:column;align-items:stretch;gap:9px;}
.jtool-chip:hover{border-color:var(--accent)!important;color:var(--ink)!important;background:var(--bg-card)!important;}
@keyframes jbd{from{opacity:0}to{opacity:1}}
.jtool-backdrop{animation:jbd .16s ease-out;}
.jcode-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink-3);font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcode-copy:hover{background:var(--bg-elev);color:var(--ink);border-color:var(--ink-3);}
.jcli-copy{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;border:1px solid #2a2f3a;background:#222631;color:#c4c9d4;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
.jcli-copy:hover{background:#2f3542;color:#fff;border-color:#3a4150;}
.jpanel-scroll{scrollbar-width:thin;scrollbar-color:var(--line) transparent;}
.jpanel-scroll::-webkit-scrollbar{width:11px;height:11px;}
.jpanel-scroll::-webkit-scrollbar-track{background:transparent;}
.jpanel-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px;border:3px solid var(--bg);background-clip:padding-box;}
.jpanel-scroll::-webkit-scrollbar-thumb:hover{background:var(--ink-3);background-clip:padding-box;}
`;

function ViewJarvis() {
  const [running, setRunning] = useState(null);       // flow id, or null = carousel
  const [panelIndex, setPanelIndex] = useState(1);     // default landing = Accueil (middle)
  const [transitioning, setTransitioning] = useState(true);
  const total = J_PANELS.length;
  const sectionCount = J_SECTIONS.length;

  const goToIndex = useCallback((i) => {
    setTransitioning(true);
    setPanelIndex(Math.max(0, Math.min(total - 1, i)));
  }, [total]);
  const goToId = useCallback((id) => {
    const idx = J_PANELS.findIndex(p => p.id === id);
    if (idx >= 0) goToIndex(idx);
  }, [goToIndex]);

  // Auto-hide the section nav while scrolling down through a panel's content
  // (so it never collides with what's underneath); reveal it at the top or on scroll-up.
  const [navHidden, setNavHidden] = useState(false);
  // Au mount, reconnect aux runs serveur encore actifs apres un
  // refresh / tab close pendant un run (JarvisStore + localStorage).
  useEffect(() => { JarvisStore.bootReconcile().catch(() => {}); }, []);

  // Echappatoire : clic sur l'onglet Jarvis (qu'on soit deja dessus ou
  // qu'on arrive d'ailleurs) ramene SYSTEMATIQUEMENT a l'entree de la
  // console = panneau Supervision (centre). Sort aussi du mode Run
  // s'il y en avait un. App.jsx dispatche le meme event deux fois
  // (pre + post setView) pour couvrir le cas premier mount.
  useEffect(() => {
    const onReset = (e) => {
      if (!e.detail || e.detail.view !== 'jarvis') return;
      setRunning(null);
      const supIdx = J_SECTIONS.findIndex(s => s.id === 'supervision');
      setPanelIndex(supIdx >= 0 ? supIdx : 1);
      setTransitioning(true);
      // Purge aussi le pending payload eventuel (deep link /jarvis/X qui
      // remettrait `running` au mount via _pending). Belt-and-suspenders.
      if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
        delete window.__jdmPendingPayload.jarvis;
      }
    };
    window.addEventListener('jdm-nav-reset', onReset);
    return () => window.removeEventListener('jdm-nav-reset', onReset);
  }, []);

  // Switch entre runs depuis le rail bas du JarvisRun.
  useEffect(() => {
    const onSwitch = (e) => {
      const id = e.detail && e.detail.flow_id;
      if (id) setRunning(id);
    };
    window.addEventListener('jdm-jarvis-switch-run', onSwitch);
    return () => window.removeEventListener('jdm-jarvis-switch-run', onSwitch);
  }, []);

  // Clic sur la pill « N/M flux » du header (ProductionsCountPill) :
  // sort du mode run + ouvre le panneau Supervision (index 2 = derniere
  // section avant les flux details).
  useEffect(() => {
    const onGoToSup = () => {
      setRunning(null);
      setTransitioning(true);
      const supIdx = J_SECTIONS.findIndex(s => s.id === 'supervision');
      if (supIdx >= 0) setPanelIndex(supIdx);
    };
    window.addEventListener('jdm-goto-jarvis-supervision', onGoToSup);
    return () => window.removeEventListener('jdm-goto-jarvis-supervision', onGoToSup);
  }, []);

  const lastScroll = useRef(0);
  useEffect(() => { lastScroll.current = 0; setNavHidden(false); }, [panelIndex]);
  useEffect(() => {
    if (running) return;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains('jpanel-scroll')) return;
      const top = t.scrollTop;
      const prev = lastScroll.current;
      if (top < 40) setNavHidden(false);
      else if (top > prev + 4) setNavHidden(true);
      else if (top < prev - 4) setNavHidden(false);
      lastScroll.current = top;
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [running]);

  // ─── Keyboard : ←/→ move between the three top sections. ───
  useEffect(() => {
    if (running) return;
    const onKey = (e) => {
      if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
      const onFlow = panelIndex >= sectionCount;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.min(sectionCount - 1, panelIndex + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(onFlow ? 1 : Math.max(0, panelIndex - 1));
      } else if (e.key === 'Home') { goToIndex(0); }
      else if (e.key === 'End') { goToIndex(sectionCount - 1); }
      else if (e.key === 'Escape' && onFlow) { goToIndex(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Touch swipe between the three sections ───
  useEffect(() => {
    if (running) return;
    let start = null;
    const onStart = (e) => { start = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onEnd = (e) => {
      if (!start) return;
      const dx = start.x - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 50) {
        const onFlow = panelIndex >= sectionCount;
        if (onFlow) goToIndex(1);
        else goToIndex(Math.max(0, Math.min(sectionCount - 1, panelIndex + (dx > 0 ? 1 : -1))));
      }
      start = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [panelIndex, goToIndex, sectionCount, running]);

  // ─── Run mode : replace carousel with the live monitor ───
  if (running) {
    const flow = JARVIS_FLOWS.find(f => f.id === running);
    return (
      <JarvisRun
        flow={flow}
        onBack={() => {
          const idx = J_PANELS.findIndex(p => p.id === running);
          setRunning(null);
          setTransitioning(false);
          if (idx >= 0) setPanelIndex(idx);
        }}
      />
    );
  }

  const activePanel = J_PANELS[panelIndex].id;
  const activeSection = panelIndex < sectionCount ? activePanel : 'accueil';

  return (
    <>
      <style>{JRING_CSS}</style>
      {/* Rail sticky bottom = sections (Config / Supervision / Répertoire).
          TOUJOURS visible sur Config/Supervision/Répertoire (pas de hide
          au scroll — il prend la place de l'ancienne légende du bas et
          doit rester ancré). Caché uniquement quand on est sur un panneau
          de flux (= vue Run) pour laisser place au JarvisRunRail qui vit
          DEDANS avec la même position bottom. */}
      <JSectionNav activeSection={activeSection} onSelect={goToId}
        hidden={panelIndex >= sectionCount} />

      <div style={{
        position: 'relative',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${total * 100}%`,
          display: 'flex',
          flexDirection: 'row',
          transform: `translate3d(-${(panelIndex / total) * 100}%, 0, 0)`,
          transition: transitioning
            ? 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'none',
          willChange: 'transform',
        }}>
          <JPanel><JConfigPanel onAccueil={() => goToId('repertoire')} /></JPanel>
          <JPanel><JSupervisionPanel flows={JARVIS_FLOWS} onPick={goToId} onLaunch={(id) => setRunning(id)} active={activePanel === 'supervision'} /></JPanel>
          <JPanel><JAccueilPanel flows={JARVIS_FLOWS} onPick={goToId} onLaunch={(id) => setRunning(id)} /></JPanel>

          {JARVIS_FLOWS.map((f, i) => (
            <JPanel key={f.id}>
              <JFlowPanel
                flow={f}
                index={i}
                onLaunch={() => setRunning(f.id)}
                onIndex={goToIndex}
                onSommaire={() => goToId('accueil')}
              />
            </JPanel>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Panel wrapper — one slot of the carousel track ───
function JPanel({ children }) {
  return (
    <div className="jpanel-scroll" style={{
      flex: `0 0 ${JPANEL_BASIS}`,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '92px 28px 56px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  );
}

// ═══════════════════ Configuration — réglages de l'agent ═══════════════════
//
// JARVIS_LLMS = liste DE FALLBACK utilisée si /api/jarvis/models répond
// pas (offline mode, dev sans backend). Le vrai catalogue est fetché à
// l'init et populé via useGeminiModels() ci-dessous. Les modèles fictifs
// (Claude/GPT/Mistral/Llama) sont remplacés par les Gemini réels dispos
// côté serveur.
let JARVIS_LLMS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];
const _LLMS_LISTENERS = new Set();
let _LLMS_LOADED = false;

async function _loadJarvisModels() {
  if (_LLMS_LOADED) return;
  try {
    const r = await fetch('api/jarvis/models');
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.models) && d.models.length > 0) {
      JARVIS_LLMS = d.models.map(m => ({ value: m.value, label: m.label }));
      // Met à jour le default initial du JCONFIG si encore l'ancien fallback
      if (d.default) _JARVIS_DEFAULT_LLM = d.default;
      _LLMS_LOADED = true;
      for (const cb of _LLMS_LISTENERS) { try { cb(); } catch {} }
    }
  } catch {}
}
if (typeof window !== 'undefined') { _loadJarvisModels(); }

function useGeminiModels() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _LLMS_LISTENERS.add(force);
    return () => _LLMS_LISTENERS.delete(force);
  }, []);
  return [JARVIS_LLMS, _LLMS_LOADED];
}

// JARVIS_FORMATS : champ purement informatif (aucun backend de conversion
// d'export — les sorties sont des fichiers texte typés par flux :
// .enrich/.audit/.err/.stat/.annot, format JDM pipe-separated). Conservé
// pour ne pas casser le rendu du Select dans JConfigPanel mais marqué
// disabled côté UI ; tout choix utilisateur reste sans effet backend.
const JARVIS_FORMATS = [
  { value: 'jdm', label: 'JDM (.enrich/.audit/.err/.stat/.annot)' },
];

let _JARVIS_DEFAULT_LLM = 'gemini-3.1-flash-lite';

// JCONFIG = preferences UI (localStorage). Les champs « mode », « parallel »,
// « defaultMaxIter », « temperature », « globalConf », « humanReview »,
// « logLevel », « storageDir », « keepHistory » sont COSMETIQUES — ils
// n'ont aucun pendant backend dans le routage actuel des flows Jarvis
// (les vrais leviers sont passes per-run via /api/jarvis/{flow}/stream :
// model, api_key, budget_label, drops_key, auto_switch, term, relation,
// target_count, upload, vary_relations, iterate, top_k). On conserve la
// surface UI pour la fidelite au design ; seuls « llm » et « autoSubmit »
// sont reellement pre-utilises par ParamsForm via JarvisStore.
const JCONFIG_DEFAULTS = {
  mode: 'autonome', parallel: 2, defaultMaxIter: 30,
  llm: 'gemini-3.1-flash-lite', temperature: 0.3, globalConf: 50,
  humanReview: false, autoSubmit: true, logLevel: 'detaille',
  storageDir: '~/jdm/exports', exportFormat: 'jdm', keepHistory: true,
};

function useJarvisConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem('jdm_jarvis_config');
      if (raw) return { ...JCONFIG_DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {}
    return JCONFIG_DEFAULTS;
  });
  useEffect(() => {
    try { localStorage.setItem('jdm_jarvis_config', JSON.stringify(cfg)); } catch (e) {}
    window.__JDM_JARVIS_CONFIG__ = cfg;
  }, [cfg]);
  const set = useCallback((k, v) => setCfg(c => ({ ...c, [k]: v })), []);
  const reset = useCallback(() => setCfg(JCONFIG_DEFAULTS), []);
  return [cfg, set, reset];
}

// Small on/off switch (no shared Toggle exists).
function JToggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)} className="focus-ring"
      style={{
        width: 42, height: 24, flexShrink: 0, padding: 0,
        borderRadius: 999, position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--line)'),
        background: checked ? 'var(--accent)' : 'var(--bg-elev)',
        opacity: disabled ? 0.5 : 1, transition: 'background .2s, border-color .2s',
      }}>
      <span aria-hidden="true" style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--bg)' : 'var(--ink-3)',
        transition: 'left .2s cubic-bezier(.34,1.56,.64,1), background .2s',
      }} />
    </button>
  );
}

// Segmented control for 2–3 short options.
function JSegmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, gap: 2,
      background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 999,
    }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className="focus-ring"
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 999, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--ink-2)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontWeight: active ? 600 : 400, transition: 'background .18s, color .18s', whiteSpace: 'nowrap',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function JCfgGroup({ title, children }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>{title}</div>
      </div>
      <div style={{ padding: '2px 18px 8px' }}>{children}</div>
    </Card>
  );
}

function JCfgRow({ label, hint, children, stack }) {
  return (
    <div className={'jcfg-row' + (stack ? ' jcfg-row--stack' : '')}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: stack ? 'stretch' : 'flex-end',
        ...(stack ? { alignSelf: 'stretch' } : { minWidth: 150, maxWidth: '55%' }),
      }}>{children}</div>
    </div>
  );
}

function JConfigPanel({ onAccueil }) {
  const [cfg, set, reset] = useJarvisConfig();
  // useGeminiModels s'abonne au catalogue : le Select se met à jour
  // automatiquement quand /api/jarvis/models répond. Avant cela on
  // tombe sur le fallback (1 entrée gemini-3.1-flash-lite).
  const [llmList /*, llmsReady */] = useGeminiModels();
  const autonomous = cfg.mode === 'autonome';
  const modeHint = {
    autonome: 'La boucle s’exécute de bout en bout, sans intervention humaine.',
    supervise: 'Jarvis sollicite ta validation aux étapes critiques.',
    pasapas: 'Tu valides chaque itération avant qu’elle ne soit écrite.',
  }[cfg.mode];
  const llmLabel = (llmList.find(l => l.value === cfg.llm) || {}).label || cfg.llm;
  const fmtLabel = (JARVIS_FORMATS.find(f => f.value === cfg.exportFormat) || {}).label || cfg.exportFormat;
  const modeLabel = { autonome: 'Autonome', supervise: 'Supervisé', pasapas: 'Pas-à-pas' }[cfg.mode];
  const modeColor = { autonome: 'var(--jdm-green)', supervise: 'var(--jdm-orange)', pasapas: 'var(--jdm-cyan)' }[cfg.mode];

  // Ad-hoc readiness checklist → drives the preparation progress bar.
  const checks = [
    { label: 'Mode d’exécution choisi', ok: !!cfg.mode },
    { label: 'Modèle LLM sélectionné', ok: !!cfg.llm },
    { label: 'Seuil de confiance défini', ok: cfg.globalConf > 0 },
    { label: 'Répertoire de stockage renseigné', ok: !!(cfg.storageDir && cfg.storageDir.trim()) },
    { label: autonomous ? 'Soumission automatique activée' : 'Validation configurée', ok: autonomous ? cfg.autoSubmit : (cfg.humanReview || cfg.autoSubmit) },
  ];
  const doneCount = checks.filter(c => c.ok).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const ready = pct === 100;
  const barColor = ready ? 'var(--jdm-green)' : 'var(--accent)';

  return (
    <div style={{ width: '100%', maxWidth: 1080 }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 22,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
            letterSpacing: '0.16em', marginBottom: 12,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            &nbsp;· Réglages de l’agent
          </div>
          <h1 className="display" style={{
            margin: 0, fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)', fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
          }}>
            Config<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>uration</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> enregistré
          </span>
          <button type="button" onClick={reset} className="focus-ring" style={ghostLinkStyle}>↺ Réinitialiser</button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
        gap: 18, alignItems: 'start',
      }}>
        {/* settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <JCfgGroup title="Exécution">
            <JCfgRow label="Mode d’exécution" stack>
              <JSegmented value={cfg.mode} onChange={(v) => set('mode', v)} options={[
                { value: 'autonome', label: 'Autonome' },
                { value: 'supervise', label: 'Supervisé' },
                { value: 'pasapas', label: 'Pas-à-pas' },
              ]} />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{modeHint}</div>
            </JCfgRow>
            <JCfgRow label="Flux en parallèle" hint="Boucles d’agent exécutées simultanément." stack>
              <Slider value={cfg.parallel} onChange={(v) => set('parallel', v)} min={1} max={5} step={1} />
            </JCfgRow>
            <JCfgRow label="Itérations max par défaut" hint="Plafond appliqué à chaque nouveau flux." stack>
              <Slider value={cfg.defaultMaxIter} onChange={(v) => set('defaultMaxIter', v)} min={5} max={100} step={1} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Modèle & inférence">
            <JCfgRow label="Modèle LLM" stack>
              <Select value={cfg.llm} onChange={(v) => set('llm', v)} options={llmList} />
            </JCfgRow>
            <JCfgRow label="Température" hint="Créativité de la génération de candidats." stack>
              <Slider value={Math.round(cfg.temperature * 100)} onChange={(v) => set('temperature', v / 100)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
            <JCfgRow label="Seuil de confiance global" hint="Score minimum pour conserver un triplet." stack>
              <Slider value={cfg.globalConf} onChange={(v) => set('globalConf', v)} min={0} max={100} step={5} suffix="%" />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Validation & soumission">
            <JCfgRow label="Validation humaine avant écriture" hint={autonomous ? 'Désactivée en mode autonome.' : 'Relire les triplets avant de les mémoriser.'}>
              <JToggle checked={autonomous ? false : cfg.humanReview} disabled={autonomous} onChange={(v) => set('humanReview', v)} />
            </JCfgRow>
            <JCfgRow label="Soumettre automatiquement à JDM" hint="Pousser les triplets validés vers le serveur JeuxDeMots.">
              <JToggle checked={cfg.autoSubmit} onChange={(v) => set('autoSubmit', v)} />
            </JCfgRow>
            <JCfgRow label="Journalisation" stack>
              <JSegmented value={cfg.logLevel} onChange={(v) => set('logLevel', v)} options={[
                { value: 'concis', label: 'Concis' },
                { value: 'detaille', label: 'Détaillé' },
                { value: 'debug', label: 'Debug' },
              ]} />
            </JCfgRow>
          </JCfgGroup>

          <JCfgGroup title="Stockage & sortie">
            <JCfgRow label="Répertoire de stockage" hint="Où les exports et journaux sont écrits." stack>
              <Input value={cfg.storageDir} onChange={(v) => set('storageDir', v)} mono />
            </JCfgRow>
            <JCfgRow label="Format d’export" stack>
              <Select value={cfg.exportFormat} onChange={(v) => set('exportFormat', v)} options={JARVIS_FORMATS} />
            </JCfgRow>
            <JCfgRow label="Conserver l’historique des runs" hint="Garder une trace de chaque exécution.">
              <JToggle checked={cfg.keepHistory} onChange={(v) => set('keepHistory', v)} />
            </JCfgRow>
          </JCfgGroup>
        </div>

        {/* live summary */}
        <div style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ad-hoc preparation progress */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Préparation de l’agent</span>
                <span className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: ready ? 'var(--jdm-green)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 999, transition: 'width .4s cubic-bezier(.4,0,.2,1), background .3s' }} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {checks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, lineHeight: 1,
                      background: c.ok ? 'var(--jdm-green)' : 'var(--bg-elev)',
                      color: c.ok ? 'var(--bg)' : 'var(--ink-3)',
                      border: '1px solid ' + (c.ok ? 'var(--jdm-green)' : 'var(--line)'),
                    }}>{c.ok ? '✓' : ''}</span>
                    <span style={{ color: c.ok ? 'var(--ink-2)' : 'var(--ink-3)' }}>{c.label}</span>
                  </div>
                ))}
              </div>
              {ready && (
                <div className="mono" style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: 'var(--jdm-green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} /> prêt à lancer
                </div>
              )}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden', borderTop: `3px solid ${modeColor}` }}>
            <div style={{ padding: '14px 18px 12px' }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 10,
              }}>Profil d’exécution</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: modeColor, flexShrink: 0 }} />
                <span className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
                  letterSpacing: '-0.01em', color: 'var(--ink)',
                }}>{modeLabel}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-soft)', padding: '4px 18px 10px' }}>
              <JSumRow k="Modèle" v={llmLabel} />
              <JSumRow k="Confiance min" v={cfg.globalConf + ' %'} />
              <JSumRow k="Itér. max" v={cfg.defaultMaxIter} />
              <JSumRow k="Parallèle" v={cfg.parallel + ' flux'} />
              <JSumRow k="Soumission JDM" v={cfg.autoSubmit ? 'auto' : 'manuelle'} accent={cfg.autoSubmit ? 'var(--jdm-green)' : undefined} />
              <JSumRow k="Validation" v={autonomous ? 'aucune' : (cfg.humanReview ? 'humaine' : 'auto')} />
              <JSumRow k="Export" v={fmtLabel} />
              <JSumRow k="Stockage" v={cfg.storageDir} mono />
            </div>
          </Card>
          <Button full size="lg" onClick={onAccueil}>Choisir un flux →</Button>
        </div>
      </div>
    </div>
  );
}

function JSumRow({ k, v, accent, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', fontSize: 12.5 }}>
      <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0, fontSize: 11 }}>{k}</span>
      <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
      <span className={mono ? 'mono' : undefined} style={{
        color: accent || 'var(--ink)', textAlign: 'right', fontWeight: 500,
        maxWidth: '62%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: mono ? 11 : 12.5,
      }}>{v}</span>
    </div>
  );
}

// ═══════════════════ Repertoire — flux disponibles (panneau droit) ═══
// Anciennement « Accueil » (centre, vue Aperçus par defaut). Devenu
// le panneau droit « Répertoire » avec la Bibliothèque (mode library)
// par defaut — l'utilisateur peut basculer en « Aperçus » via le
// toggle dans la toolbar.
function JAccueilPanel({ flows, onPick, onLaunch }) {
  // Set des flows actuellement en cours (resync via JarvisStore — survit
  // aux unmount). Sert à dégrader chaque carte avec un badge « en cours »
  // pour que l'utilisateur retrouve d'un coup d'œil ses runs.
  const activeFlowSet = useJarvisActiveSet();
  const [q, setQ] = useState('');
  // Defaut = library (Bibliothèque MediaBay) au lieu d'apercus.
  const [view, setView] = useState('library'); // 'library' | 'apercus'

  const qq = q.trim().toLowerCase();
  const indexed = flows.map((f, i) => ({ f, num: i + 1 }));
  const list = qq
    ? indexed.filter(({ f }) =>
        (f.title + ' ' + f.kicker + ' ' + f.produces + ' ' + f.steps.map(s => s.n).join(' ')).toLowerCase().includes(qq))
    : indexed;

  return (
    <div style={{ width: '100%', maxWidth: view === 'library' ? 1180 : 980 }}>
      {/* header */}
      <div style={{ marginBottom: 14 }}>
        <div className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12,
        }}>
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
          &nbsp;· Catalogue des flux disponibles
        </div>
        <h1 className="display" style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)',
        }}>
          Réper<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>toire</span>
        </h1>
      </div>

      {/* toolbar — sticky search + view switch + count */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '8px 0 12px', marginBottom: 14,
        background: 'var(--bg)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 190 }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-3)', fontSize: 14, pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un flux, une étape, un résultat…"
            aria-label="Rechercher un flux"
            style={{
              width: '100%', padding: '10px 12px 10px 31px',
              background: 'var(--bg-card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', color: 'var(--ink)',
              fontFamily: 'inherit', fontSize: 13, outline: 'none',
            }} />
        </div>
        <JSegmented value={view} onChange={setView} options={[
          { value: 'library', label: 'Bibliothèque' },
          { value: 'apercus', label: 'Aperçus' },
        ]} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
          padding: '6px 11px', background: 'var(--bg-elev)', border: '1px solid var(--line-soft)', borderRadius: 999,
        }}>
          <strong style={{ color: 'var(--ink-2)' }}>{list.length}</strong>{qq ? ` / ${flows.length}` : ''} flux
        </span>
      </div>

      {list.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)',
        }}>
          <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun flux</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Rien ne correspond à «&nbsp;{q}&nbsp;».</div>
        </div>
      ) : view === 'apercus' ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
            fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)',
          }}>
            <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            Clic sur le <strong style={{ color: 'var(--ink-2)' }}>cercle</strong> = lancer le flux
            <span style={{ color: 'var(--line)' }}>|</span>
            clic sur la <strong style={{ color: 'var(--ink-2)' }}>carte</strong> = voir le détail
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map(({ f, num }) => (
              <JTocRow key={f.id} flow={f} num={num} delay={(num - 1) * 0.45}
                running={activeFlowSet.has(f.id)}
                onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
            ))}
          </div>
        </>
      ) : (
        <JLibrary list={list} onPick={onPick} onLaunch={onLaunch} />
      )}
    </div>
  );
}

// Rich animated preview row (loop ring + full preview). Default "Aperçus" view.
function JTocRow({ flow, num, delay, onOpen, onLaunch, running }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
      {running && (
        <div style={{
          position: 'absolute', top: -6, right: 10, zIndex: 2,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          background: 'rgba(78,166,60,0.12)',
          border: '1px solid rgba(78,166,60,0.40)',
          borderRadius: 999,
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--jdm-green)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--jdm-green)' }} />
          en cours
        </div>
      )}
      {/* Circular loop schematic — OUTSIDE the card. Click = launch the flux. */}
      <button type="button" onClick={onLaunch} className="jring-btn"
        title={`Lancer le flux « ${flow.title} »`} aria-label={`Lancer le flux ${flow.title}`}
        style={{ flexShrink: 0 }}>
        <JLoopRing accent={flow.accent} num={num} steps={flow.steps.length} delay={delay} size={62} />
      </button>

      {/* Card — click = open the flow's detail panel. */}
      <button type="button" onClick={onOpen}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="focus-ring"
        style={{
          flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: 16, textAlign: 'left', padding: '15px 20px',
          background: 'var(--bg-card)',
          border: '1px solid ' + (hover ? flow.accent : 'var(--line)'),
          borderRadius: 'var(--radius-lg)',
          boxShadow: hover
            ? `inset 5px 0 0 ${flow.accent}, 0 8px 26px -14px ${flow.accent}`
            : `inset 5px 0 0 ${flow.accent}`,
          cursor: 'pointer',
          transform: hover ? 'translateX(2px)' : 'none',
          transition: 'transform 0.16s, border-color 0.16s, box-shadow 0.28s',
          fontFamily: 'inherit',
        }}>
        <span style={{ minWidth: 0 }}>
          <span className="display" style={{
            display: 'block', fontFamily: 'var(--font-display)',
            fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em',
            color: 'var(--ink)', lineHeight: 1.1,
          }}>{flow.title}</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 7,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexWrap: 'wrap',
          }}>
            <LoopGlyph color={flow.accent} />
            {flow.steps.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
                <span>{s.n}</span>
              </React.Fragment>
            ))}
            <span style={{ color: 'var(--line)', margin: '0 2px' }}>—</span>
            <span style={{ color: flow.accent }}>{flow.produces}</span>
          </span>
        </span>

        <span className="mono" style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? flow.accent : 'var(--ink-3)',
          transition: 'color 0.16s, transform 0.16s',
          transform: hover ? 'translateX(3px)' : 'none',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>détails →</span>
      </button>
    </div>
  );
}

// Dense library/explorer table — catalogs flows in rows. "Registre" view.
function JRegistry({ list, onPick, onLaunch }) {
  const cols = '34px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1fr) 92px';
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '9px 16px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--line-soft)',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        <span>#</span><span>Flux</span><span>Séquence</span><span>Produit</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>
      {list.map(({ f, num }, i) => (
        <JRegistryRow key={f.id} flow={f} num={num} cols={cols} last={i === list.length - 1}
          onOpen={() => onPick(f.id)} onLaunch={() => onLaunch(f.id)} />
      ))}
    </div>
  );
}

function JRegistryRow({ flow, num, cols, last, onOpen, onLaunch }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center',
        padding: '10px 16px', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--line-soft)',
        background: hover ? 'var(--bg-elev)' : 'transparent',
        boxShadow: hover ? `inset 3px 0 0 ${a}` : 'inset 3px 0 0 transparent',
        transition: 'background .12s, box-shadow .12s',
      }}>
      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: a, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${a} 16%, transparent)` }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="display" style={{
          display: 'block', fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{flow.title}</span>
        <span className="mono" style={{ fontSize: 9.5, color: a, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
        {flow.steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--line)' }}>›</span>}
            <span>{s.n}</span>
          </React.Fragment>
        ))}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.produces}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onLaunch(); }}
          title={`Lancer « ${flow.title} »`} aria-label={`Lancer ${flow.title}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            border: `1px solid color-mix(in srgb, ${a} 50%, transparent)`,
            background: `color-mix(in srgb, ${a} 10%, transparent)`,
            color: a, cursor: 'pointer', fontSize: 10, lineHeight: 1,
          }}>▶</button>
        <span className="mono" style={{ fontSize: 13, color: hover ? a : 'var(--ink-3)', transition: 'color .12s', transform: hover ? 'translateX(2px)' : 'none' }}>→</span>
      </span>
    </div>
  );
}

// Tool kinds (API JDM / logique / workflow / IO / outil) a flow touches —
// utilise pour les facettes de la Bibliotheque. Source de verite :
// FLOW_TOOL_STEPS (mapping reel tool -> etape par flux) croise avec
// TOOL_DOCS (fetched : kind par tool).
function flowToolKinds(flow) {
  const steps = (typeof FLOW_TOOL_STEPS !== 'undefined' && FLOW_TOOL_STEPS[flow.id]) || {};
  const kinds = new Set();
  for (const t of Object.keys(steps)) {
    const d = TOOL_DOCS[t];
    if (d) kinds.add(d.kind);
  }
  return [...kinds];
}

// Facet definitions for the library browser.
const J_FACETS = [
  { id: 'category', label: 'Catégorie',    get: (f) => (f.category ? [f.category] : []) },
  { id: 'kind',     label: 'Type d’outil', get: (f) => flowToolKinds(f) },
  { id: 'steps',    label: 'Étapes',       get: (f) => [`${f.steps.length} étapes`] },
  { id: 'tags',     label: 'Tags',         get: (f) => f.tags || [] },
];

// MediaBay-style library: facet sidebar (multi-criteria) + filtered results table.
function JLibrary({ list, onPick, onLaunch }) {
  const [sel, setSel] = useState({});
  const toggle = (gid, val) => setSel(prev => {
    const next = { ...prev };
    const s = new Set(next[gid] || []);
    if (s.has(val)) s.delete(val); else s.add(val);
    next[gid] = s;
    return next;
  });
  const clear = () => setSel({});
  const activeCount = Object.values(sel).reduce((n, s) => n + (s ? s.size : 0), 0);

  // Scroll auto-centre sur les resultats apres chaque changement de
  // selection facette. Au mount initial (sel === {}), on ne fait rien
  // (la vue est deja au top, le user n'a pas encore interagi).
  // _userTouched evite le scroll sur le tout premier render.
  const resultsRef = useRef(null);
  const _userTouched = useRef(false);
  useEffect(() => {
    if (activeCount === 0 && !_userTouched.current) return;
    _userTouched.current = true;
    const el = resultsRef.current;
    if (!el) return;
    // Cherche le scrollable parent (.jpanel-scroll) et scrolle vers
    // la position des resultats. scrollIntoView fonctionne aussi mais
    // affecte la window — on prefere viser le panel pour ne pas casser
    // la nav de carrousel. Smooth + block 'start' = haut des resultats
    // arrive en haut de la fenetre de scroll.
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    if (!sc) sc = window;
    const elTop = el.getBoundingClientRect().top;
    const scTop = (sc === window) ? 0 : sc.getBoundingClientRect().top;
    const delta = elTop - scTop - 12;  // -12px de marge
    if (sc.scrollBy) sc.scrollBy({ top: delta, behavior: 'smooth' });
    else if (sc.scrollTo) sc.scrollTo({ top: (sc.scrollTop || 0) + delta, behavior: 'smooth' });
  }, [sel, activeCount]);

  const groups = J_FACETS.map(g => {
    const counts = {};
    list.forEach(({ f }) => g.get(f).forEach(v => { counts[v] = (counts[v] || 0) + 1; }));
    const items = Object.keys(counts).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, count: counts[v] }));
    return { ...g, items };
  }).filter(g => g.items.length > 0);

  const results = list.filter(({ f }) =>
    J_FACETS.every(g => {
      const s = sel[g.id];
      if (!s || s.size === 0) return true;
      return g.get(f).some(v => s.has(v));
    })
  );

  // Layout vertical : MediaBay en HAUT (panneau horizontal pleine largeur,
  // 4 sections empilees l'une au dessus de l'autre) → puis liste des
  // resultats en dessous. Chaque section MediaBay = un facette + ses
  // checkboxes disposees en wrap horizontal (= chips qu'on peut cocher).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
      {/* MediaBay : panneau facettes en haut, 4 sections empilees */}
      <aside style={{
        border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
        }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Filtres MediaBay {activeCount > 0 && <>· <span style={{ color: 'var(--accent)' }}>{activeCount} actif{activeCount > 1 ? 's' : ''}</span></>}
          </span>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="focus-ring"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Effacer ({activeCount})</button>
          )}
        </div>
        {/* 4 sections empilees verticalement, separees par un trait fin.
            Chaque section : label a gauche + chips horizontales a droite
            qui wrappent sur plusieurs lignes si necessaire. */}
        <div>
          {groups.map((g, gi) => (
            <div key={g.id} style={{
              display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)',
              gap: 14, alignItems: 'start',
              padding: '10px 14px',
              borderBottom: gi < groups.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', paddingTop: 5,
              }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                {g.items.map(it => {
                  const on = !!(sel[g.id] && sel[g.id].has(it.value));
                  return (
                    <button key={it.value} type="button" onClick={() => toggle(g.id, it.value)} className="focus-ring"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                        border: '1px solid ' + (on ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line-soft)'),
                        background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-elev)',
                        fontFamily: 'inherit',
                        transition: 'background .12s, border-color .12s',
                      }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                        background: on ? 'var(--accent)' : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--bg)', fontSize: 8.5, lineHeight: 1,
                      }}>{on ? '✓' : ''}</span>
                      <span style={{ fontSize: 11.5, color: on ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{it.value}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{it.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Liste des resultats — sous le MediaBay. Le ref est cible par
          le scroll auto-centre apres chaque toggle facette. */}
      <div ref={resultsRef} style={{ minWidth: 0, scrollMarginTop: 12 }}>
        {results.length > 0 ? (
          <JRegistry list={results} onPick={onPick} onLaunch={onLaunch} />
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 'var(--radius-lg)' }}>
            <div className="display" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 4 }}>Aucun flux pour ces filtres</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Élargis ta sélection dans les facettes ci-dessus.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════ Supervision — tableau de bord live ═══════════════════
// Synthetic dashboard: every flux is shown "en cours", with a live preview of
// what's happening inside (current step, growing metrics, streaming results).
function JSupervisionPanel({ flows, onPick, onLaunch, active }) {
  // Heartbeat tick (animation refresh) — anime stepIdx + petits effets visuels.
  // Reste fictif (cosmetique) ; ne change pas les chiffres reels.
  const [tick, setTick] = useState(0);
  const rootRef = useRef(null);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  // Donnees REELLES du backend : on poll /api/jarvis/runs toutes les 3s
  // pour le statut, headlines, started_at. En parallele JarvisStore expose
  // les metrics live (consolidated, toolsCalled, accepted items) pour chaque
  // flow_id observe localement. On combine les deux.
  const [serverRuns, setServerRuns] = useState([]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const t = async () => {
      try {
        const r = await fetch('api/jarvis/runs');
        if (r.ok) {
          const d = await r.json();
          if (alive) setServerRuns(d.runs || []);
        }
      } catch {}
    };
    t();
    const h = setInterval(t, 3000);
    return () => { alive = false; clearInterval(h); };
  }, [active]);

  // S'abonne aux changements de JarvisStore pour rerender quand une metrique
  // bouge entre deux ticks (= reactivite immediate au lieu d'attendre 1.4s).
  const localActiveSet = useJarvisActiveSet();

  // On opening Supervision, smooth-scroll its panel back to the top (stats strip).
  useEffect(() => {
    if (!active) return;
    const el = rootRef.current; if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active]);

  // Live computed pour CHAQUE flow dans l'ordre canonique du catalogue.
  // Sert au KPI strip aggrege ET au tri d'affichage (en cours d'abord).
  const live = flows.map((f, i) => computeFlowLive(f, i, tick, serverRuns, localActiveSet));
  // Ordre d'affichage : flux EN COURS en haut, AU REPOS apres.
  // L'ordre intra-bucket suit l'ordre canonique du catalogue JARVIS_FLOWS.
  const orderedIdx = flows.map((_, i) => i).sort((a, b) => {
    const aRun = live[a].isRunning ? 0 : 1;
    const bRun = live[b].isRunning ? 0 : 1;
    if (aRun !== bRun) return aRun - bRun;
    return a - b;
  });
  // Aggregats reels : iter cumule (sum des iter detectes par flux),
  // tools cumule, accepted cumule. Aucune valeur fabriquee.
  const agg = live.reduce((a, l) => ({
    iter:     a.iter + (l.iter || 0),
    tools:    a.tools + (l.tools || 0),
    accepted: a.accepted + (l.accepted || 0),
  }), { iter: 0, tools: 0, accepted: 0 });

  // Compteur "Flux actifs" base sur les runs serveur reellement running/starting.
  const activeCount = serverRuns.filter(r => r.status === 'running' || r.status === 'starting').length;

  return (
    <div ref={rootRef} style={{ width: '100%', maxWidth: 1120 }}>
      {/* ── Masthead ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.16em',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>Jarvis</em>
            <span>{'·'} Supervision {'·'} {flows.length} flux</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: activeCount > 0 ? 'var(--jdm-green)' : 'var(--ink-3)' }}>
              <span className="pulse-dot" style={{ background: activeCount > 0 ? 'var(--jdm-green)' : 'var(--ink-3)' }} /> live
            </span>
          </div>
          <h1 className="display" style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.2vw, 52px)',
            fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1,
            color: 'var(--ink)',
          }}>
            Tableau de <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>bord</span>
          </h1>
        </div>

        <p style={{
          margin: 0, maxWidth: '38ch',
          fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-3)',
        }}>
          Six flux d'agent supervises. Chaque carte montre, en direct, ce qui
          se passe a l'interieur du flux : etape active, metriques qui montent,
          derniers triplets/items produits.
        </p>
      </div>

      {/* ── KPI strip — agreges sur tous les flux ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 18,
      }}>
        <JKpi label="Flux actifs"      value={activeCount}   sub="en boucle"  dot />
        <JKpi label="Iterations"       value={agg.iter}      sub="cumulees" />
        <JKpi label="Outils appeles"   value={agg.tools}     sub="JDM" />
        <JKpi label="Items produits"   value={agg.accepted}  sub="consolides/annotes" color="var(--jdm-green)" />
      </div>

      {/* ── Live flux grid — une carte par flux ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: 14,
      }}>
        {orderedIdx.map(i => {
          const f = flows[i];
          return (
            <JFlowDashCard key={f.id} flow={f} num={i + 1} live={live[i]}
              onOpen={() => onPick(f.id)}
              onLaunch={() => onLaunch(f.id)}
              onStart={() => {
                // Demarre le flow IMMEDIATEMENT avec defaults (term/relation
                // vides → tirage random cote backend) sans naviguer. La card
                // passera "en cours" au prochain poll /api/jarvis/runs.
                if (typeof window !== 'undefined' && window.__jdmJarvisStore) {
                  const dp = (typeof defaultParamsFor === 'function')
                    ? defaultParamsFor(f.id) : {};
                  window.__jdmJarvisStore.start(f.id, {
                    params: dp, isResume: false, resumeState: null,
                  }).catch(() => {});
                }
              }} />
          );
        })}
      </div>

      {/* Légende « Clic sur le cercle / la carte » retirée — le rail
          sticky bottom (JSectionNav) prend sa place visuelle en bas de
          la console et reste toujours visible. */}
    </div>
  );
}

// KPI tile for the dashboard's top strip.
function JKpi({ label, value, sub, color, dot }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '13px 16px' }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {dot && <span className="pulse-dot" style={{ background: 'var(--jdm-green)' }} />}
        {label}
      </div>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
        marginTop: 4, color: color || 'var(--ink)', letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// Source de live snapshots pour les cartes du dashboard — alimentee
// par les VRAIES donnees backend :
//   - JarvisStore.get(flow.id) : etat local du run observe (metrics,
//     accepted items, log) ; survit aux unmount.
//   - serverRuns[flow.id] : dernier run cote serveur (statut, headline)
//     poll'e toutes les 3s via /api/jarvis/runs.
//   - tick : heartbeat 1.4s utilise UNIQUEMENT pour animer stepIdx
//     (= l'etape "active" qui clignote sur la pipeline) et donner du
//     mouvement aux cartes meme quand les chiffres ne bougent pas.
function computeFlowLive(flow, i, tick, serverRuns, _localActiveSet) {
  const store = (typeof JarvisStore !== 'undefined') ? JarvisStore.get(flow.id) : null;
  const runs = (serverRuns || []).filter(r => r.flow_id === flow.id);
  const latest = runs.sort((a, b) => (b.started_at || 0) - (a.started_at || 0))[0] || null;
  const isLocallyRunning = store && store.status === 'running';
  const isServerRunning = latest && (latest.status === 'running' || latest.status === 'starting');
  const isRunning = isLocallyRunning || isServerRunning;

  const m = (store && store.metrics) || { toolsCalled: 0, accepted: 0, tokens: 0, elapsed: 0 };
  const tools = m.toolsCalled || 0;
  const narration = (store && store.narrationHTML) || '';

  // Sequence des tool calls cote agent — chaque div narration porte
  // `data-tool="<nom>"` depuis jarvis.py. On parcourt cette sequence
  // UNE seule fois pour calculer iter (tentatives) ET stepIdx (etape
  // active courante). data-result="1" marque un retour de tool ; on
  // ne garde que les APPELS pour ne pas doubler chaque tool.
  const toolSeq = [];
  if (narration) {
    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"([^>]*)>/g;
    let mm;
    while ((mm = re.exec(narration)) !== null) {
      const isResult = /data-result="1"/.test(mm[2] || '');
      if (!isResult) toolSeq.push(mm[1]);
    }
  }

  // iter = TENTATIVE REELLE : chaque fois que l'agent retourne a step 0
  // depuis un step >= 1, c'est une nouvelle tentative. Le 1er passage en
  // step 0 compte aussi pour 1.
  //   ex annot : workflow(0) → lookup(0) → get_relations(1) → lookup(0=>+1)
  //              → get_relations(1) → write_submission(2)  ⇒ 2 tentatives
  const fts = (typeof FLOW_TOOL_STEPS !== 'undefined' && FLOW_TOOL_STEPS[flow.id]) || {};
  let iter = 0;
  {
    let prevStep = -1;
    for (const name of toolSeq) {
      const s = fts[name];
      if (s === undefined) continue;
      if (s === 0 && (prevStep === -1 || prevStep >= 1)) iter++;
      prevStep = s;
    }
  }
  if (iter < 1 && (isRunning || tools > 0)) iter = 1;

  // Y reel : si l'utilisateur a fixe un budget numerique, c'est Y. Sinon
  // pas de Y montre (juste "iter X").
  const dp = (typeof defaultParamsFor === 'function' && defaultParamsFor(flow.id)) || {};
  const budgetCap = dp.budget_label && /^\d+$/.test(String(dp.budget_label)) ? parseInt(dp.budget_label, 10) : null;
  const target = dp.target_count || null;
  // span = ce qui sert au "X / Y" du label iter X/Y. On prefere
  // target_count (le user a dit "je veux N items") sur budgetCap.
  const span = target || budgetCap || null;

  // accepted / rejected REELS via parseFilePreview du file_preview qui
  // contient le contenu reellement ecrit cote backend. Pour enrich on
  // s'appuie sur store.accepted (= registry de consolidation, source
  // canonique). Pour les autres flows on classe les items parses :
  //   ok types (consolidated, sens) → accepted
  //   not-ok types (flagged, signalement, audit_signalement) → rejected
  let accepted = 0, rejected = 0, items = [];
  if (flow.id === 'enrich' && Array.isArray(store && store.accepted)) {
    accepted = store.accepted.length;
    items = store.accepted;
  }
  if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id);
    if (flow.id !== 'enrich') {
      for (const it of parsed.items) {
        if (it.type === 'flagged' || it.type === 'signalement' || it.type === 'audit_signalement') rejected++;
        else accepted++;
      }
      items = parsed.items;
    } else {
      // pour enrich on ajoute juste le compte de signalements eventuels
      // (rare : enrich ne signale pas, mais defense en profondeur)
      for (const it of parsed.items) {
        if (it.type === 'flagged' || it.type === 'signalement') rejected++;
      }
    }
  }
  const produced = accepted;
  const pct = span ? Math.min(100, Math.round((produced / span) * 100)) : null;

  // Step ACTIF REEL : derniere etape touchee dans toolSeq (= meme source
  // que iter, derive des data-tool attributes). Quand le flow tourne, ca
  // anime visuellement la progression : chaque nouveau tool dans la
  // narration → re-render → stepIdx mis a jour → highlight CSS transition.
  // Hors run (idle/done), aucune etape highlightee.
  let stepIdx = -1;
  if (isRunning) {
    for (let k = toolSeq.length - 1; k >= 0; k--) {
      const s = fts[toolSeq[k]];
      if (s !== undefined) { stepIdx = s; break; }
    }
  }

  // Recent items : 3 derniers items avec leur LABEL reel ET un TAG
  // contextuel (= remplace l'ancien score "1.00" fictif). Le tag est
  // derive du type d'item :
  //   enrich consolidated → schema (isa-trans, trans, …) ou "✓"
  //   annot consolidated → category (constitutif, contrastif, …)
  //   annot signalement → JDM≠LLM
  //   audit verdict → verdict (LEGITIME, CONTRASTIF, …)
  //   err flagged → category (semantique, polarite, …)
  let recent = [];
  if (flow.id === 'enrich' && Array.isArray(items) && items.length > 0) {
    recent = items.slice(-3).map((a, k) => ({
      key: 'a' + k,
      label: a.label || `${a.subject || ''} | ${a.relation || ''} | ${a.target || ''}`,
      tag: (a.schema || '').replace(/^isa_?/, 'isa-') || 'consolidé',
      ok: true,
    }));
  } else if (store && store.filePreview) {
    const parsed = parseFilePreview(store.filePreview, flow.id);
    recent = parsed.items.slice(-3).map((it, k) => {
      const tag = it.type === 'flagged'           ? (it.category || 'suspect')
                : it.type === 'signalement'        ? 'JDM≠LLM'
                : it.type === 'audit_signalement'  ? (it.verdict || 'verdict')
                : it.type === 'consolidated'       ? (it.category || 'ok')
                : it.type === 'sens'               ? 'sens'
                : it.type;
      return {
        key: 'p' + k,
        label: `${it.subject || ''} | ${it.relation || ''} | ${it.target || ''}`,
        tag,
        ok: it.type !== 'flagged' && it.type !== 'signalement' && it.type !== 'audit_signalement',
      };
    });
  }

  // ─── Compteurs Tentatives / Termes / Tokens (réutilisent la narration) ──
  // - nbAttempted = nombre d'appels `validate_candidate` (= 1 triplet
  //   tenté = 1 appel). Source = toolSeq déjà parcouru ci-dessus.
  // - nbTerms     = nombre de termes UNIQUES vus dans `data-triplet="t|r|t"`
  //   sur les divs jdm-narration (1er champ).
  // - Rejected pour enrich : recalculé = nbAttempted - accepted (= consolidés).
  //   Le calcul d'origine basé sur filePreview restait à 0 pour enrich
  //   car le .enrich ne contient QUE les consolidés (les rejets ne sont
  //   pas écrits) → cube de stats incorrect en supervision.
  let nbAttempted = 0;
  for (const name of toolSeq) {
    if (name === 'validate_candidate') nbAttempted++;
  }
  const _terms = new Set();
  if (narration) {
    const re2 = /data-triplet="([^|"]+)/g;
    let mm2;
    while ((mm2 = re2.exec(narration)) !== null) {
      const t0 = (mm2[1] || '').trim();
      if (t0) _terms.add(t0);
    }
  }
  const nbTerms = _terms.size;
  if (flow.id === 'enrich' && nbAttempted > 0) {
    rejected = Math.max(0, nbAttempted - accepted);
  }
  const tokens = m.tokens || 0;

  // ─── Feed pour la zone « flux en direct » de la card Supervision ──────
  // Mix log brut + triplets validés (qui ont aussi leur entry [ok] dans
  // le log via le delta-push handler 'jarvis'), dans l'ordre chronologique
  // d'apparition. On garde les 6 dernières entries (tronque visuellement
  // à la zone) :
  //   - entry tag [ok] + triplet → rendu format triplet pretty
  //   - sinon → rendu format log mono compact (timestamp + tag + msg)
  const _log = (store && store.log) || [];
  const _feedSlice = _log.slice(-6);
  const feed = _feedSlice.map((e, idx) => {
    if (e.tag === '[ok]' && e.triplet) {
      return {
        kind: 'item',
        key: 'f' + idx + ':' + (e.t || ''),
        label: e.msg,
        tag: e.triplet.schema || '✓',
        ok: true,
      };
    }
    return {
      kind: 'log',
      key: 'f' + idx + ':' + (e.t || ''),
      t: e.t || '',
      tag: e.tag || '',
      msg: e.msg || '',
      ok: e.kind !== 'reject',
    };
  });

  return { iter, span, tools, accepted, rejected, produced, pct, recent, stepIdx,
           isRunning, nbAttempted, nbTerms, tokens, feed,
           headline: (store && store.headline) || (latest && latest.headline) || '' };
}

// One live "monitor" card for a flux — the heart of the dashboard.
//   onLaunch : ouvre la vue de Run (navigation interne du carrousel)
//   onOpen   : ouvre le panneau de detail du flow (l'explication)
//   onStart  : LANCE le flow IMMEDIATEMENT via JarvisStore.start avec
//              les params par defaut (term/relation vides) SANS changer
//              de page. Utilise par le ring click pour permettre de
//              demarrer un flow grise depuis Supervision en gardant le
//              tableau de bord visible.
function JFlowDashCard({ flow, num, live, onOpen, onLaunch, onStart }) {
  const [hover, setHover] = useState(false);
  const a = flow.accent;
  const tint = (p) => `color-mix(in srgb, ${a} ${p}%, transparent)`;
  // Cards "au repos" grisees (alpha sur la card entiere) — visuellement
  // reconnaissables en un coup d'oeil dans Supervision.
  const dimmed = !live.isRunning;
  return (
    <div
      role="button" tabIndex={0}
      onClick={onLaunch}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLaunch(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid ' + (hover ? a : 'var(--line)'),
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? `0 12px 32px -18px ${a}` : 'var(--shadow-sm)',
        overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform .18s, border-color .16s, box-shadow .28s, opacity .25s, filter .25s',
        opacity: dimmed ? 0.62 : 1,
        filter: dimmed ? 'saturate(0.55)' : 'none',
      }}>

      {/* top hairline in the flow's colour */}
      <div style={{ height: 3, background: a, opacity: 0.9 }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px 12px' }}>
        <button type="button" className="jring-btn"
          onClick={(e) => {
            e.stopPropagation();
            // Si onStart fourni : demarre en place (Supervision), la card
            // s'allume "en cours" via le poll /api/jarvis/runs sans
            // changer de page. Sinon fallback onLaunch (navigation vers
            // la vue Run — comportement par defaut hors Supervision).
            if (onStart) onStart(); else onLaunch();
          }}
          title={onStart ? `Lancer "${flow.title}" maintenant (defaults)` : `(Re)lancer "${flow.title}"`}
          aria-label={`Lancer ${flow.title}`}
          style={{ flexShrink: 0 }}>
          <JLoopRing accent={a} num={num} steps={flow.steps.length} delay={num * 0.3} size={50} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 10, color: a, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3,
          }}>{flow.kicker}</div>
          <div className="display" style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.05,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{flow.title}</div>
        </div>
        {/* badge "en cours" / "au repos" selon l'etat reel du run */}
        {live.isRunning ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '4px 9px', borderRadius: 999,
            border: `1px solid ${tint(45)}`, background: tint(8), color: a,
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            <span className="pulse-dot" style={{ background: a }} /> en cours
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '4px 9px', borderRadius: 999,
            border: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
          }}>
            au repos
          </span>
        )}
      </div>

      {/* Step pipeline — etape active highlightee. Detection REELLE :
          on lookup le dernier tool mentionne dans la narration LLM via
          FLOW_TOOL_STEPS pour savoir a quelle etape on en est. -1 = aucun
          tool reconnu encore, ou flow au repos. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 15px 12px', flexWrap: 'wrap' }}>
        {flow.steps.map((s, k) => {
          const isActive = live.isRunning && k === live.stepIdx;
          return (
            <React.Fragment key={k}>
              {k > 0 && <span style={{ color: 'var(--line)', fontSize: 11 }}>{'›'}</span>}
              <span className="mono" style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 999,
                background: isActive ? tint(14) : 'var(--bg-elev)',
                border: '1px solid ' + (isActive ? tint(50) : 'var(--line-soft)'),
                color: isActive ? a : 'var(--ink-3)',
                fontWeight: isActive ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'all .25s',
              }}>
                {isActive && <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} />}
                {s.n}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Tent. (nb triplets passés à validate_candidate) / Term. (nb termes
          distincts vus dans data-triplet de la narration). Plus parlant que
          le "iter X/Y" précédent qui comptait les retours à step 0 et donnait
          un compteur peu lisible. La progress bar reste basée sur live.pct
          (= produced / target_count) qui est inchangée. */}
      <div style={{ padding: '0 15px 12px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 5,
        }}>
          <span>
            Tent. <strong style={{ color: 'var(--ink)' }}>{live.nbAttempted || 0}</strong>
            <span style={{ margin: '0 6px', color: 'var(--line)' }}>·</span>
            Term. <strong style={{ color: 'var(--ink)' }}>{live.nbTerms || 0}</strong>
          </span>
          <span style={{ color: a }}>{flow.produces}</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-elev)', overflow: 'hidden' }}>
          <div style={{
            width: `${live.pct != null ? live.pct : Math.min(100, (live.nbAttempted || 0) * 8)}%`,
            height: '100%', background: a, borderRadius: 999,
            transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
      </div>

      {/* 4 mini-metriques : acceptés (vert), rejetés (magenta), tokens, outils.
          - acceptés/rejetés : alimentés par nbAttempted - accepted pour enrich
            (avant : rejetés restait à 0 car le .enrich ne contient que les
            consolidés).
          - tokens : estimation depuis store.metrics.tokens (tokens_estimate
            backend). */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--line-soft)',
        borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)',
      }}>
        <JMini label="acceptes" value={live.accepted} color="var(--jdm-green)" />
        <JMini label="rejetes"  value={live.rejected} color="var(--jdm-magenta)" />
        <JMini label="tokens"   value={fmtTokens(live.tokens || 0)} />
        <JMini label="outils"   value={live.tools} />
      </div>

      {/* Flux en direct = log temps réel (timestamps + tags) MIX avec les
          triplets validés au format pretty quand l'entry porte un `triplet`
          (= [ok] poussée par le handler delta-aware). Source unifiée :
          live.feed (cf. computeFlowLive). Avant : on n'affichait que les
          items recent → la zone restait « En attente du 1er résultat » tant
          qu'aucun triplet n'avait été validé, même si plein d'events
          [start]/[file] passaient. */}
      <div style={{ padding: '10px 15px 6px', flex: 1 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {live.isRunning && <span className="pulse-dot" style={{ background: a, width: 5, height: 5 }} />}
          {live.isRunning ? 'flux en direct' : 'derniers events'}
        </div>
        <div style={{ display: 'grid', gap: 4, minHeight: 78 }}>
          {(!live.feed || live.feed.length === 0) ? (
            <div style={{
              color: 'var(--ink-3)', fontSize: 11, fontStyle: 'italic',
              padding: '10px 0', textAlign: 'center',
            }}>
              {live.isRunning ? 'En attente du 1er event…' : 'Aucun event encore.'}
            </div>
          ) : live.feed.map((e) => (
            e.kind === 'item' ? (
              // Triplet validé : format pretty avec ✓ vert + tag schema
              <div key={e.key} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 'var(--radius)',
                background: 'var(--bg-elev)', border: '1px solid var(--line-soft)',
                fontFamily: 'var(--font-mono)', fontSize: 10.5,
                minWidth: 0,
              }}>
                <span style={{ flexShrink: 0, color: 'var(--jdm-green)' }}>✓</span>
                <span style={{
                  flex: '1 1 auto', minWidth: 0, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={e.label}>{e.label}</span>
                {e.tag && (
                  <span style={{
                    flex: '0 1 auto', minWidth: 0,
                    color: 'var(--ink-3)', fontSize: 9, lineHeight: 1.3,
                    padding: '1px 5px', borderRadius: 3,
                    background: 'var(--bg-card)', border: '1px solid var(--line-soft)',
                    maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={String(e.tag)}>{e.tag}</span>
                )}
              </div>
            ) : (
              // Log brut : timestamp + tag + msg mono compact
              <div key={e.key} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--ink-3)', minWidth: 0,
              }}>
                <span style={{ flexShrink: 0, opacity: 0.7 }}>{e.t}</span>
                <span style={{
                  flexShrink: 0,
                  color: e.tag === '[err]' ? 'var(--jdm-magenta)'
                    : e.tag === '[file]' ? a
                    : e.tag === '[done]' ? 'var(--jdm-green)'
                    : 'var(--ink-3)',
                }}>{e.tag}</span>
                <span style={{
                  flex: '1 1 auto', minWidth: 0, color: 'var(--ink-2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={e.msg}>{e.msg}</span>
              </div>
            )
          ))}
        </div>
      </div>

      {/* footer — "détail →" est un bouton qui stoppe la propagation et
          ouvre le panneau de détail du flux (l'explication). Le reste de
          la card route vers le run. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 15px', borderTop: '1px solid var(--line-soft)', background: 'var(--bg-elev)',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>boucle {'·'} {flow.steps.length} etapes</span>
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="focus-ring"
          style={{
            background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--ink-3)',
            transition: 'color .16s, transform .16s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = a; e.currentTarget.style.transform = 'translateX(3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.transform = 'none'; }}
        >detail {'→'}</button>
      </div>
    </div>
  );
}

// Compact metric cell inside a dashboard card.
function JMini({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', textAlign: 'left' }}>
      <div className="display" style={{
        fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
        color: color || 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{label}</div>
    </div>
  );
}



// KPI tile for the dashboard's top strip.
// Derive a flow's live snapshot from a shared heartbeat (tick). Pure + cyclic,
// so each card looks like a pipeline endlessly looping through its candidates.
// One live "monitor" card for a flux — the heart of the dashboard.
// Compact metric cell inside a dashboard card.
// Loop schematic in two refined, low-saturation styles (Tweaks → Cercles Jarvis):
//   'boucle' — a single repeat/refresh arrow wrapping the number (calm, default).
//   'cycle'  — step nodes joined by directional arcs (the original).
// Colour is desaturated by mixing the flow accent ~50% with a neutral.
function useRingStyle() {
  const get = () => (typeof window !== 'undefined' && window.__JDM_TWEAKS__ && window.__JDM_TWEAKS__.ringStyle) || 'boucle';
  const [s, setS] = useState(get);
  useEffect(() => {
    const f = () => setS(get());
    window.addEventListener('__jdm_tweaks_changed', f);
    return () => window.removeEventListener('__jdm_tweaks_changed', f);
  }, []);
  return s;
}

function JLoopRing({ accent, num, steps, delay, size = 60 }) {
  const ringStyle = useRingStyle();
  const c = `color-mix(in srgb, ${accent} 50%, var(--ink-3) 50%)`;   // desaturated
  const cx = 32, cy = 32, R = 20;
  const f = (n) => n.toFixed(2);
  const pt = (deg, r = R) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arrow = (deg, ah = 3.4) => {
    const ea = (deg - 90) * Math.PI / 180;
    const tx = -Math.sin(ea), ty = Math.cos(ea);
    const px = Math.cos(ea), py = Math.sin(ea);
    const [ex, ey] = pt(deg);
    return { ex, ey,
      b1: [ex - ah * tx + ah * 0.6 * px, ey - ah * ty + ah * 0.6 * py],
      b2: [ex - ah * tx - ah * 0.6 * px, ey - ah * ty - ah * 0.6 * py] };
  };
  const N = Math.max(2, steps || 2);

  let arcGroup, marks = null;
  if (ringStyle === 'cycle') {
    const gap = N === 2 ? 26 : 22;
    const segs = [];
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const base = i * 360 / N;
      nodes.push(pt(base));
      const s = base + gap, e = (i + 1) * 360 / N - gap;
      const [sx, sy] = pt(s), [ex, ey] = pt(e);
      const large = (e - s) > 180 ? 1 : 0;
      segs.push({ sx, sy, ex, ey, large, a: arrow(e) });
    }
    arcGroup = segs.map((s, i) => (
      <React.Fragment key={i}>
        <path d={`M ${f(s.sx)} ${f(s.sy)} A ${R} ${R} 0 ${s.large} 1 ${f(s.ex)} ${f(s.ey)}`} />
        <path d={`M ${f(s.a.b1[0])} ${f(s.a.b1[1])} L ${f(s.ex)} ${f(s.ey)} L ${f(s.a.b2[0])} ${f(s.a.b2[1])}`} />
      </React.Fragment>
    ));
    marks = nodes.map((n, i) => (
      <g key={i}>
        <circle cx={f(n[0])} cy={f(n[1])} r={3.6} fill="var(--bg-card)" stroke={c} strokeWidth="1.6" />
        <circle cx={f(n[0])} cy={f(n[1])} r={1.6} fill={c} />
      </g>
    ));
  } else {
    // 'boucle' — one near-full loop arrow with a gap at the top.
    const g = 40;
    const s = g, e = 360 - g;
    const [sx, sy] = pt(s), [ex, ey] = pt(e);
    const a = arrow(e, 3.8);
    arcGroup = (
      <React.Fragment>
        <path d={`M ${f(sx)} ${f(sy)} A ${R} ${R} 0 1 1 ${f(ex)} ${f(ey)}`} />
        <path d={`M ${f(a.b1[0])} ${f(a.b1[1])} L ${f(ex)} ${f(ey)} L ${f(a.b2[0])} ${f(a.b2[1])}`} />
      </React.Fragment>
    );
    marks = Array.from({ length: N }).map((_, i) => {
      const base = i * 360 / N;
      if (base < g || base > (360 - g)) return null;
      const [mx, my] = pt(base);
      return <circle key={i} cx={f(mx)} cy={f(my)} r={1.9} fill={c} opacity="0.85" />;
    });
  }

  return (
    <span className="jring" style={{
      position: 'relative', width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" className="jring-halo" style={{
        position: 'absolute', inset: Math.round(size * 0.05), borderRadius: '50%',
        background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
        filter: 'blur(7px)',
        animation: `jorbGlow 3.8s ease-in-out ${delay || 0}s infinite`,
      }} />
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'relative', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={26} fill={c} opacity="0.05" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeWidth="1" opacity="0.16" />
        <g className="jring-arcs" stroke={c} fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {arcGroup}
        </g>
        {marks}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fill={c}
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 17 }}>{num}</text>
      </svg>
    </span>
  );
}

// ═══════════════════ Tool catalog — fetché depuis le backend ═══════════════════
// TOOL_DOCS et FLOW_TOOL_STEPS sont alimentés au boot par
// GET /api/jarvis/tools. Le backend introspecte les @tool LangChain
// de build_jdm_tools() et renvoie 39 fiches : {name, kind, description,
// signature, args}. Avant la fin du fetch, TOOL_DOCS est un objet vide
// et les usages tombent sur le fallback générique défini dans
// JToolDialog (sig='nom(…)', kind='outil').
//
// useToolDocs() renvoie [docs, ready] et force le re-render des
// consommateurs quand le fetch arrive — sans cela, JToolDialog ouvert
// avant que le catalogue soit chargé n'afficherait jamais ses détails.

let TOOL_DOCS = {};
const _TOOL_DOCS_LISTENERS = new Set();
let _TOOL_DOCS_LOADED = false;

function _notifyToolDocs() {
  for (const cb of _TOOL_DOCS_LISTENERS) { try { cb(); } catch {} }
}

async function _loadToolDocs() {
  if (_TOOL_DOCS_LOADED) return;
  try {
    const r = await fetch('api/jarvis/tools');
    if (!r.ok) return;
    const d = await r.json();
    const m = {};
    for (const t of d.tools || []) {
      // Adapter le format backend -> celui attendu par JToolDialog
      // (sig, kind, desc, docstring, prompt, cli, output).
      const argList = (t.args || []).map(a => a.name + (a.required ? '' : '?')).join(', ');
      m[t.name] = {
        sig: t.signature || `${t.name}(${argList})`,
        kind: t.kind || 'outil',
        desc: (t.description || '').split('\n')[0],  // 1re ligne en résumé
        docstring: t.docstring || t.description || '',
        // Pas d'entrée prompt ni de cli côté backend — on synthétise.
        prompt: `# Outil LangChain — ${t.name}\n\n` +
                (t.description || '').slice(0, 600) +
                ((t.description || '').length > 600 ? '…' : ''),
        cli: `# Disponible via le serveur MCP\nmcp call ${t.name} ${(t.args || []).map(a => '--' + a.name + ' …').join(' ')}`,
        output: (t.args || []).length === 0
          ? '{}'
          : '{\n  // sortie selon la signature du tool\n  // schéma : ' +
            (t.args || []).map(a => a.name + ':' + (a.type || 'any')).join(', ') + '\n}',
      };
    }
    TOOL_DOCS = m;
    _TOOL_DOCS_LOADED = true;
    _notifyToolDocs();
  } catch {}
}
if (typeof window !== 'undefined') { _loadToolDocs(); }

function useToolDocs() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _TOOL_DOCS_LISTENERS.add(force);
    return () => _TOOL_DOCS_LISTENERS.delete(force);
  }, []);
  return [TOOL_DOCS, _TOOL_DOCS_LOADED];
}

// Map outil → index d'étape dans flow.steps, par flow_id réel. Établi
// d'après les workflows backend (enrichment_workflow, audit_workflow,
// etc.) qui décrivent quel tool LLM est attendu à quelle étape.
const FLOW_TOOL_STEPS = {
  enrich: {
    enrichment_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    list_existing_for_enrichment: 0,
    disambiguate: 0,
    validate_candidate: 1,
    consolidate_candidate: 1,
    verify_claim: 1,
    infer: 1,
    write_submission_file: 2,
    submit_to_jdm: 2,
  },
  audit: {
    audit_workflow: 0,
    pick_random_term: 0,
    disambiguate: 0,
    exists: 0,
    get_relations_of_type: 1,
    verify_claim: 1,
    write_submission_file: 2,
  },
  gap: {
    gap_detection_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    detect_gaps: 1,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1,
  },
  signalement: {
    // Le tool backend est `error_detection_workflow` (renommé). On garde
    // signalement_workflow ici comme alias pour les anciennes traces ; les
    // nouvelles passent par error_detection_workflow.
    error_detection_workflow: 0,
    signalement_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    get_relations_of_type: 1,
    verify_claim: 1,
    write_submission_file: 2,
  },
  stats: {
    stats_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    list_existing_for_enrichment: 1,
    get_relations_of_type: 1,
  },
  annotation: {
    annotation_workflow: 0,
    pick_random_term: 0,
    exists: 0,
    disambiguate: 0,
    get_relations_of_type: 1,
    write_submission_file: 2,
  },
};

// ═══════════════════ Tool catalog — fiches d'outils ═══════════════════
// Per-tool documentation surfaced in the JToolDialog (clic sur un chip outil).

// Which step (index into flow.steps) each tool serves, per flow.

function JToolCode({ children }) {
  return (
    <pre className="mono" style={{
      margin: 0, padding: '12px 14px', background: 'var(--bg-elev)',
      border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
      fontSize: 12, lineHeight: 1.55, color: 'var(--ink-2)',
      overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
    }}>{children}</pre>
  );
}

function JToolSection({ label, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="mono" style={{
        fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

// Copy-to-clipboard button (clipboard API + textarea fallback for sandboxed frames).
function JCopyBtn({ text, dark }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e) => {
    e.stopPropagation();
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    const fb = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {}
      done();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fb);
      } else fb();
    } catch (err) { fb(); }
  };
  return (
    <button type="button" onClick={onCopy} className={dark ? 'jcli-copy' : 'jcode-copy'}
      title="Copier" aria-label="Copier dans le presse-papiers">
      {copied ? '✓ Copié' : '⧉ Copier'}
    </button>
  );
}

// Lightweight syntax highlighter for all code/text zones (rendered on a dark surface).
// Handles JSON, HTTP docstrings, function docs and prompt specs in one pass.
function highlightCode(src) {
  const C = {
    comment: '#6b7280', guill: '#c9a978', verb: '#ff9e64', ph: '#7dcfff',
    key: '#7aa2f7', str: '#9ece6a', num: '#bb9af7', bool: '#ff9e64',
    punct: '#8b92a5', arrow: '#8b92a5',
  };
  const out = [];
  const re = /(#[^\n]*)|(«[^»]*»)|\b(GET|POST|PUT|DELETE|PATCH)\b|(\{[a-zA-Z0-9_]+\})|("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|(→)|([{}\[\],:])/g;
  let last = 0, m, i = 0;
  const push = (txt, color, extra) => out.push(<span key={i++} style={{ color, ...(extra || {}) }}>{txt}</span>);
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(<span key={i++}>{src.slice(last, m.index)}</span>);
    if (m[1] !== undefined) push(m[1], C.comment, { fontStyle: 'italic' });
    else if (m[2] !== undefined) push(m[2], C.guill, { fontStyle: 'italic' });
    else if (m[3] !== undefined) push(m[3], C.verb, { fontWeight: 600 });
    else if (m[4] !== undefined) push(m[4], C.ph);
    else if (m[5] !== undefined) {
      const isKey = m[6] !== undefined;
      push(m[5], isKey ? C.key : C.str);
      if (isKey) push(m[6], C.punct);
    }
    else if (m[7] !== undefined) push(m[7], C.num);
    else if (m[8] !== undefined) push(m[8], C.bool);
    else if (m[9] !== undefined) push(m[9], C.arrow);
    else if (m[10] !== undefined) push(m[10], C.punct);
    last = re.lastIndex;
  }
  if (last < src.length) out.push(<span key={i++}>{src.slice(last)}</span>);
  return out;
}

// Styled code zone — dark surface with a label header + copy button
// (docstring / prompt / output), so it reads clearly as a code/text area.
function JCodeBlock({ tag, code }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 8px 7px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a',
      }}>
        <span className="mono" style={{ fontSize: 9.5, color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tag || 'CODE'}</span>
        <JCopyBtn text={code} dark />
      </div>
      <pre className="mono" style={{
        margin: 0, padding: '13px 14px', background: '#0f1117',
        fontSize: 12, lineHeight: 1.6, color: '#d6dbe5',
        overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)',
      }}><code>{highlightCode(code)}</code></pre>
    </div>
  );
}

// Terminal-style block for the CLI command — traffic lights, prompt, copy button.
function JCliBlock({ command }) {
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #2a2f3a', background: '#0f1117' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 12px', background: '#191c24', borderBottom: '1px solid #2a2f3a' }}>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: '#8b92a5', letterSpacing: '0.04em', marginLeft: 4 }}>zsh — jdm-agent</span>
        <span style={{ marginLeft: 'auto' }}><JCopyBtn text={command} dark /></span>
      </div>
      <div style={{ padding: '13px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span className="mono" style={{ color: '#4ea63c', userSelect: 'none', flexShrink: 0, fontSize: 12.5, lineHeight: 1.6 }}>$</span>
        <code className="mono" style={{ color: '#e6e9ef', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>{command}</code>
      </div>
    </div>
  );
}

// Modal fiche for a single tool, contextualised to the flow it's used in.
function JToolDialog({ flow, tool, onClose }) {
  // useToolDocs s'abonne au catalogue : le 1er render après l'ouverture
  // peut tomber sur TOOL_DOCS={} (fetch pas encore arrivé), useToolDocs
  // force le re-render dès que /api/jarvis/tools répond.
  const [docs, ready] = useToolDocs();
  const doc = docs[tool] || {
    sig: tool + '(…)',
    kind: 'outil',
    desc: ready ? 'Outil non documenté.' : 'Chargement du catalogue…',
    docstring: '—', prompt: '—', cli: tool, output: '—',
  };
  // Two notions de flow distinctes :
  //   - `flow` (prop)         : flow d'ORIGINE depuis lequel le dialog a ete
  //                             ouvert. Garde la pastille « ACTUEL » comme
  //                             reperage contextuel.
  //   - `selectedFlowId` / `selectedFlow` : flow actuellement VIEWE dans
  //                             le dialog. Defaut = flow.id ; change quand
  //                             l'utilisateur clique sur une autre carte
  //                             dans « Inscription dans les sequences ».
  // Tous les rendus dependants d'un flow (Prompt agreged, step highlight,
  // accent CSS) utilisent selectedFlow.
  const [selectedFlowId, setSelectedFlowId] = useState(flow.id);
  const selectedFlow = JARVIS_FLOWS.find(f => f.id === selectedFlowId) || flow;
  const a = selectedFlow.accent;
  const kindColor = { 'API JDM': 'var(--jdm-cyan)', 'LLM': 'var(--jdm-violet)', 'logique': 'var(--jdm-orange)' }[doc.kind] || a;

  // Every flow whose sequence calls this tool (souvent plus d'une).
  const usages = JARVIS_FLOWS.filter(f => (FLOW_TOOL_STEPS[f.id] || {})[tool] != null);

  // « Prompt » du flow courant = concatenation des docstrings de TOUS les
  // tools du flow (workflow + step tools), dans l'ordre de leur step.
  // C'est exactement ce qui est envoye au LLM comme contexte pour ce flow.
  // On INCLUT TOUT, sans tronquer — meme si certains tools n'ont pas leur
  // doc disponible cote catalogue (chargement en cours), on liste leur
  // nom avec un placeholder pour ne pas masquer leur presence.
  const flowPrompt = (() => {
    // Utilise selectedFlow (= flow VIEWE dans le dialog), pas flow (=
    // flow d'ORIGINE). Permet la navigation : cliquer sur une autre
    // carte dans « Inscription » switch le prompt agreged sur ce flow.
    const fts = (typeof FLOW_TOOL_STEPS !== 'undefined' && FLOW_TOOL_STEPS[selectedFlow.id]) || {};
    const ordered = Object.keys(fts).sort((a, b) => (fts[a] - fts[b]));
    if (ordered.length === 0) return doc.prompt;
    const parts = [
      `# PROMPT AGREGED — flow « ${selectedFlow.title} » (${selectedFlow.id})`,
      `# Etapes : ${selectedFlow.steps.map((s, k) => `[${k}] ${s.n}`).join(' → ')}`,
      `# ${ordered.length} tools concatenes ci-dessous dans l'ordre d'execution.`,
      `# C'est ce que voit le LLM comme contexte agent pour ce flow.`,
      '',
    ];
    for (const t of ordered) {
      const d = docs[t];
      const step = fts[t];
      const stepName = (selectedFlow.steps[step] && selectedFlow.steps[step].n) || '';
      parts.push(`## [step ${step}${stepName ? ' · ' + stepName : ''}] ${t}()`);
      parts.push('');
      if (d) {
        if (d.sig) parts.push(`# signature : ${d.sig}`);
        if (d.kind) parts.push(`# kind : ${d.kind}`);
        if (d.sig || d.kind) parts.push('');
        parts.push((d.docstring || d.desc || '(pas de docstring)').trim());
      } else {
        parts.push('(documentation indisponible — catalogue /api/jarvis/tools encore en chargement ou ce tool n\'est pas registry-expose)');
      }
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    return parts.join('\n');
  })();

  const codeTabs = [
    { id: 'docstring', label: 'Docstring', body: doc.docstring, lang: 'text', tag: doc.kind === 'API JDM' ? 'HTTP' : 'DOC' },
    { id: 'prompt',    label: 'Prompt',    body: flowPrompt,    lang: 'text', tag: 'PROMPT · FLOW' },
    { id: 'cli',       label: 'CLI',       body: doc.cli,       lang: 'sh' },
    { id: 'output',    label: 'Sortie',    body: doc.output,    lang: 'json', tag: 'JSON' },
  ];
  const [tab, setTab] = useState(doc.kind === 'LLM' ? 'prompt' : 'docstring');
  const active = codeTabs.find(t => t.id === tab) || codeTabs[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; };
  }, [onClose]);

  return ReactDOM.createPortal((
    <div onClick={onClose} className="jtool-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'rgba(15,12,8,0.5)',
      backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={doc.sig}
        className="fade-up jpanel-scroll" style={{
          width: 'min(820px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
          borderTop: `3px solid ${kindColor}`,
        }}>
        {/* header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
          padding: '16px 20px 14px', background: 'var(--bg-card)',
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span className="display" style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>{tool}<span style={{ color: 'var(--ink-3)' }}>()</span></span>
              <span className="mono" style={{
                fontSize: 9.5, padding: '3px 8px', borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${kindColor} 50%, transparent)`,
                background: `color-mix(in srgb, ${kindColor} 9%, transparent)`,
                color: kindColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
              }}>{doc.kind}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{doc.sig}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="focus-ring" style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--bg-elev)',
            color: 'var(--ink-2)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '4px 20px 20px' }}>
          <JToolSection label="Description">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{doc.desc}</p>
          </JToolSection>

          <JToolSection label={usages.length > 1 ? 'Inscription dans les séquences' : 'Inscription dans la séquence'}>
            <div style={{ display: 'grid', gap: 10 }}>
              {usages.map(u => {
                const si = (FLOW_TOOL_STEPS[u.id] || {})[tool];
                // Distinction nette : `isOriginFlow` = flow depuis lequel le
                // dialog a ete OUVERT (garde la pastille « actuel », pas
                // d'highlight). `isSelected` = flow actuellement VIEWE dans
                // le dialog (= alimente le Prompt tab) → highlight visuel.
                const isOriginFlow = u.id === flow.id;
                const isSelected   = u.id === selectedFlowId;
                const uc = u.accent;
                return (
                  <button key={u.id} type="button"
                    onClick={() => setSelectedFlowId(u.id)}
                    className="focus-ring"
                    title={isSelected
                      ? `Flow viewé — Prompt + step ci-dessous concernent « ${u.title} »`
                      : `Cliquer pour voir le Prompt agreged + l'étape de « ${u.title} »`}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '10px 12px', borderRadius: 'var(--radius)',
                      background: isSelected ? `color-mix(in srgb, ${uc} 14%, var(--bg-elev))` : 'var(--bg-elev)',
                      border: '1px solid ' + (isSelected ? `color-mix(in srgb, ${uc} 55%, transparent)` : 'var(--line-soft)'),
                      boxShadow: isSelected ? `0 0 0 1px color-mix(in srgb, ${uc} 35%, transparent), 0 6px 18px -10px ${uc}` : 'none',
                      transition: 'background .18s, border-color .18s, box-shadow .25s',
                      fontFamily: 'inherit',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: uc, flexShrink: 0,
                        opacity: isSelected ? 1 : 0.6,
                      }} />
                      <span className="display" style={{
                        fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600,
                        color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                        letterSpacing: '-0.01em',
                      }}>{u.title}</span>
                      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{u.kicker}</span>
                      {isOriginFlow && (
                        <span className="mono" style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 999,
                          // Pastille « actuel » TOUJOURS presente sur le flow
                          // d'origine — meme si on a clique ailleurs. Quand
                          // elle n'est PLUS le flow viewé, on l'attenue (border
                          // pointillé, fond plus discret).
                          background: isSelected
                            ? `color-mix(in srgb, ${uc} 22%, transparent)`
                            : 'transparent',
                          border: isSelected
                            ? '1px solid transparent'
                            : `1px dashed color-mix(in srgb, ${uc} 50%, transparent)`,
                          color: uc,
                          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                        }}>actuel</span>
                      )}
                      {isSelected && !isOriginFlow && (
                        // Indicateur « viewé » sur un flow autre que l'origine
                        // — pour signaler que c'est le flow qui alimente le
                        // Prompt sans ambiguïté.
                        <span className="mono" style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 999,
                          background: uc, color: 'var(--bg)',
                          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                        }}>viewé</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: si != null ? 7 : 0 }}>
                      {u.steps.map((s, k) => {
                        const act = k === si;
                        return (
                          <React.Fragment key={k}>
                            {k > 0 && <span style={{ color: 'var(--line)', fontSize: 12 }}>›</span>}
                            <span className="mono" style={{
                              fontSize: 10.5, padding: '3px 9px', borderRadius: 999,
                              background: act ? `color-mix(in srgb, ${uc} 16%, transparent)` : 'var(--bg-card)',
                              border: '1px solid ' + (act ? `color-mix(in srgb, ${uc} 50%, transparent)` : 'var(--line-soft)'),
                              color: act ? uc : 'var(--ink-3)', fontWeight: act ? 600 : 400,
                            }}>{s.n}</span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {si != null && u.steps[si] && (
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)' }}>
                        Étape <strong style={{ color: 'var(--ink-2)' }}>« {u.steps[si].n} »</strong> — {u.steps[si].d}.
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </JToolSection>

          <JToolSection label="Détails de l'outil">
            <div role="tablist" style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
              {codeTabs.map(t => {
                const on = t.id === tab;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on}
                    onClick={() => setTab(t.id)} className="focus-ring"
                    style={{
                      appearance: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '7px 12px', marginBottom: -1,
                      borderBottom: '2px solid ' + (on ? kindColor : 'transparent'),
                      color: on ? 'var(--ink)' : 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                      fontWeight: on ? 600 : 400, transition: 'color .15s, border-color .15s',
                    }}>{t.label}</button>
                );
              })}
            </div>
            {/* Le body du tab est rendu en pleine hauteur — le scroll est
                porte par le modal exterieur (overflow:auto sur le dialog
                container). Comme ca le prompt aggreged d'un flow peut
                faire 1500 lignes : tout reste visible, on scrolle juste
                le modal de bout en bout. */}
            {active.id === 'cli'
              ? <JCliBlock command={doc.cli} />
              : <JCodeBlock tag={active.tag} code={active.body} />}
          </JToolSection>
        </div>
      </div>
    </div>
  ), document.body);
}

// ═══════════════════ Per-flow design panel ═══════════════════
function JFlowPanel({ flow, index, onLaunch, onIndex, onSommaire }) {
  // Tools utilises par ce flow (derives de FLOW_TOOL_STEPS — le mapping
  // reel tool -> etape, defini en haut du fichier en s'alignant sur les
  // workflows backend). Pas de samples : la "candidatesPool" du design
  // etait des donnees fictives ; les vraies candidats remontent dans
  // le ItemCard de la vue Run au moment du run, pas en preview.
  const steps = (typeof FLOW_TOOL_STEPS !== 'undefined' && FLOW_TOOL_STEPS[flow.id]) || {};
  const tools = Object.keys(steps);
  const samples = [];
  const params = defaultParamsFor(flow.id);
  const [openTool, setOpenTool] = useState(null);
  const panelPos = J_PANELS.findIndex(p => p.id === flow.id);  // position in the carousel track
  const lastFlow = index === JARVIS_FLOWS.length - 1;

  return (
    <div style={{ width: '100%', maxWidth: 1120 }}>
      {openTool && <JToolDialog flow={flow} tool={openTool} onClose={() => setOpenTool(null)} />}
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
        paddingBottom: 16, marginBottom: 24,
        borderBottom: `1px solid var(--line)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            type="button"
            onClick={onLaunch}
            className="jring-btn"
            title="Lancer ce flux"
            aria-label="Lancer ce flux"
            style={{ flexShrink: 0 }}>
            <JLoopRing accent={flow.accent} num={index + 1} steps={flow.steps.length} delay={0} size={90} />
          </button>
          <div>
            <div className="mono" style={{
              fontSize: 11, color: flow.accent, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{flow.kicker} · {index + 1} / {JARVIS_FLOWS.length}</div>
            <h1 className="display" style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 3.6vw, 44px)', fontWeight: 500,
              letterSpacing: '-0.02em', lineHeight: 1.02, color: 'var(--ink)',
            }}>{flow.title}</h1>
            <div style={{ marginTop: 9, display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span className="mono" style={{
                fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>produit</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 17, color: 'var(--ink-2)',
              }}>{flow.produces}</span>
            </div>
          </div>
        </div>
        <div className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${flow.accent} 55%, var(--line))`,
          color: `color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`,
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
          background: `color-mix(in srgb, ${flow.accent} 7%, transparent)`,
        }}>
          <LoopGlyph color={`color-mix(in srgb, ${flow.accent} 70%, var(--ink-3))`} /> boucle · {flow.steps.length} étapes
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 26,
        alignItems: 'start',
      }}>
        {/* ── Left : the design of the flow, in sequence ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{
            margin: 0, fontSize: 15, lineHeight: 1.6,
            color: 'var(--ink-2)', maxWidth: '58ch',
          }}>{flow.desc}</p>

          <JLoopDiagram flow={flow} />

          {tools.length > 0 && (
            <div>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Outils JDM mobilisés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tools.map(t => (
                  <button key={t} type="button" onClick={() => setOpenTool(t)}
                    className="jtool-chip" title={`Voir la fiche de ${t}()`}
                    style={{
                      fontSize: 11, padding: '4px 9px',
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: 'var(--radius)', color: 'var(--ink-2)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      transition: 'border-color .14s, color .14s, background .14s',
                    }}>{t}()<span style={{ opacity: 0.5, fontSize: 10 }}>↗</span></button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right : params preview + sample output + CTA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={16} style={{ borderTop: `3px solid ${flow.accent}` }}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
            }}>Tu paramètres</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {Object.entries(params).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5,
                }}>
                  <span className="mono" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{PARAM_LABELS[k] || k}</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted var(--line)', transform: 'translateY(-4px)' }} />
                  <span className="mono" style={{
                    color: 'var(--ink)', textAlign: 'right', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%',
                  }}>{formatParam(k, v)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '9px 14px', background: 'var(--bg-elev)',
              borderBottom: '1px solid var(--line-soft)',
            }}>
              <div className="mono" style={{
                fontSize: 11, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Aperçu des résultats validés</div>
            </div>
            <div style={{ padding: 10, display: 'grid', gap: 4 }}>
              {samples.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', background: 'var(--bg-elev)',
                  border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>✓</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{s.s.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '8px 14px', borderTop: '1px solid var(--line-soft)',
              background: 'var(--bg-elev)', fontFamily: 'var(--font-mono)',
              fontSize: 10.5, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Exemple · la boucle en accumule davantage</div>
          </Card>

          <Button full size="lg" onClick={onLaunch}>▶ Lancer ce flux</Button>
        </div>
      </div>

      {/* Footer : sequence position + step within the run */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginTop: 26, paddingTop: 16,
        borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap',
      }}>
        <button type="button" onClick={onSommaire} className="focus-ring" style={ghostLinkStyle}>
          ↖ Accueil
        </button>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
          FLUX {String(index + 1).padStart(2, '0')} / {String(JARVIS_FLOWS.length).padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onIndex(panelPos - 1)} className="focus-ring" style={ghostLinkStyle}>
            ‹ Précédent
          </button>
          <button type="button"
            onClick={() => lastFlow ? onSommaire() : onIndex(panelPos + 1)}
            className="focus-ring" style={ghostLinkStyle}>
            {lastFlow ? 'Accueil ›' : 'Suivant ›'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostLinkStyle = {
  background: 'transparent', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '6px 12px',
  color: 'var(--ink-2)', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: 11,
  letterSpacing: '0.05em',
};

const PARAM_LABELS = {
  term: 'terme', relation: 'relation', maxIter: 'itér. max',
  minConf: 'confiance min', depth: 'profondeur', text: 'texte', concept: 'concept',
};
function formatParam(k, v) {
  if (k === 'minConf') return Math.round(v * 100) + ' %';
  if (k === 'text') return '« ' + String(v).slice(0, 28) + '… »';
  if (k === 'relation') return String(v);
  return String(v);
}

// ─── Loop diagram : the flow's steps laid out in sequence, looping ───
function JLoopDiagram({ flow }) {
  const mc = `color-mix(in srgb, ${flow.accent} 58%, var(--ink-3) 42%)`;
  const lineCol = `color-mix(in srgb, ${flow.accent} 30%, var(--line))`;
  const steps = flow.steps;
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--line-soft)',
      }}>
        <LoopGlyph color={mc} />
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>La boucle, étape par étape</span>
      </div>

      <div style={{ padding: '16px 18px 14px' }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: mc, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                  boxShadow: `0 2px 6px -2px ${mc}`,
                }}>{i + 1}</span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 14, background: lineCol, marginTop: 4, borderRadius: 2 }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, paddingTop: 3 }}>
                <div className="display" style={{
                  fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
                }}>{s.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 3 }}>{s.d}</div>
              </div>
            </div>
          );
        })}

        {/* loop-back to step 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 15, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none" aria-hidden="true">
              <path d="M14 4 A 8 8 0 1 1 6 12" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M11 3 L14 4 L13 7" fill="none" stroke={mc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mono" style={{
            alignSelf: 'center', fontSize: 11, color: mc,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>recommence — jusqu'au critère d'arrêt</div>
        </div>
      </div>
    </div>
  );
}

function JArrow({ color }) {
  return (
    <div style={{
      flex: '0 0 30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'flex-start', marginTop: 6, color,
    }}>
      <svg width="26" height="14" viewBox="0 0 26 14" fill="none">
        <path d="M1 7 H22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M18 3 L23 7 L18 11" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

// ─── Bottom sticky rail — the three top-level Jarvis sections ───
// Style aligné sur JarvisRunRail (rail de la vue Run) : fond opaque
// avec blur, border-top, pills compacts, position fixed bottom 0.
function JSectionNav({ activeSection, onSelect, hidden }) {
  return (
    <nav aria-label="Sections Jarvis" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      transform: hidden ? 'translateY(110%)' : 'translateY(0)',
      opacity: hidden ? 0 : 1,
      pointerEvents: hidden ? 'none' : 'auto',
      transition: 'transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease',
      borderTop: '1px solid var(--line-soft)',
      background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        overflowX: 'auto', whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
      }} className="jpanel-scroll">
        {/* « Sections » reste flush left, les pills sont centrés via
            les 2 spacers flex:1 de part et d'autre. Au-dessous d'une
            certaine largeur, le scroll horizontal prend le relais
            (overflowX: auto) — pas de débordement visuel. */}
        <span className="mono" style={{
          flexShrink: 0, fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginRight: 4,
        }}>Sections</span>
        <div style={{ flex: 1, minWidth: 8 }} aria-hidden="true" />
        {J_SECTIONS.map((p, i) => {
          const active = activeSection === p.id;
          return (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)}
              aria-label={`Aller à ${p.label}`} aria-current={active ? 'page' : undefined}
              className="focus-ring"
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 11px',
                background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)',
                border: '1px solid ' + (active ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'var(--line-soft)'),
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: active ? 'var(--accent)' : 'var(--ink-2)',
                transition: 'background .15s, border-color .15s, color .15s',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)', opacity: active ? 1 : 0.45,
              }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 11, opacity: active ? 0.9 : 0.55, fontWeight: 500,
                letterSpacing: 0,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ color: 'inherit' }}>{p.label}</span>
              {active && (
                <span className="mono" style={{
                  fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                  background: 'var(--accent)', color: 'var(--bg)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>actuel</span>
              )}
            </button>
          );
        })}
        {/* spacer droit (= miroir du gauche) pour finir le centrage des pills */}
        <div style={{ flex: 1, minWidth: 8 }} aria-hidden="true" />
      </div>
    </nav>
  );
}

// ─── (legacy) Carousel navigation — kept for reference, no longer mounted ───
function JFlowNav({ navStyle, activePanel, onSelect }) {
  const [wide, setWide] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1100 : true);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (navStyle === 'left' && wide) return <JNavRail activePanel={activePanel} onSelect={onSelect} />;
  return <JNavBottom activePanel={activePanel} onSelect={onSelect} />;
}

function JNavBottom({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ x: ir.left - cr.left + cont.scrollLeft, w: ir.width, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre flux" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 2, padding: 6,
      maxWidth: 'calc(100vw - 32px)', overflowX: 'auto',
      background: 'var(--bg-card)', border: '1px solid var(--line)',
      borderRadius: 999, boxShadow: 'var(--shadow)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 40, scrollbarWidth: 'none',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: indicator.x, width: indicator.w,
        top: 6, bottom: 6, background: 'var(--accent)', borderRadius: 999,
        opacity: indicator.ready ? 1 : 0,
        transition: 'left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
        zIndex: 0,
      }} />
      {J_PANELS.map((p, i) => {
        const active = activePanel === p.id;
        return (
          <button key={p.id}
            ref={el => { if (el) itemRefs.current[p.id] = el; }}
            type="button" onClick={() => onSelect(p.id)}
            aria-label={`Aller à ${p.label}`}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 13px', background: 'transparent', border: 'none',
              borderRadius: 999, cursor: 'pointer',
              color: active ? 'var(--bg)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
              transition: 'color 0.32s 0.05s',
            }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
              opacity: active ? 0.85 : 0.55, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
            }}>{String(i).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function JNavRail({ activePanel, onSelect }) {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });
  useEffect(() => {
    const activeEl = itemRefs.current[activePanel];
    const cont = containerRef.current;
    if (!activeEl || !cont) return;
    const cr = cont.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({ y: ir.top - cr.top, h: ir.height, ready: true });
  }, [activePanel]);

  return (
    <nav ref={containerRef} aria-label="Navigation entre flux" style={{
      position: 'fixed', left: 32, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 0, zIndex: 40,
      borderLeft: '1px solid var(--line)', paddingLeft: 16,
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: -1, top: indicator.y, height: indicator.h,
        width: 2, background: 'var(--accent)', opacity: indicator.ready ? 1 : 0,
        transition: 'top 0.42s cubic-bezier(0.4,0,0.2,1), height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
      }} />
      {J_PANELS.map((p, i) => (
        <JRailItem key={p.id}
          ref={el => { if (el) itemRefs.current[p.id] = el; }}
          num={String(i).padStart(2, '0')} label={p.label}
          active={activePanel === p.id} onClick={() => onSelect(p.id)} />
      ))}
    </nav>
  );
}

const JRailItem = React.forwardRef(function JRailItem({ num, label, active, onClick }, ref) {
  const [hover, setHover] = useState(false);
  const color = active ? 'var(--accent)' : (hover ? 'var(--ink)' : 'var(--ink-3)');
  return (
    <button ref={ref} type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={`Aller à ${label}`}
      style={{
        background: 'transparent', border: 'none', padding: '13px 0',
        cursor: 'pointer', textAlign: 'left', display: 'flex',
        flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        position: 'relative', color, transition: 'color 0.32s', fontFamily: 'inherit',
      }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 20, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.01em', color: 'inherit',
      }}>{num}</span>
      <span className="mono" style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
        color: 'inherit', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
});

function LoopGlyph({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
      <path d="M 10 4 A 4 4 0 1 0 9.5 8.5"
        fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 10 4 L 8 4 L 10 2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ───── Run view — the auto-loop interface ─────
function JarvisRun({ flow, nextFlow, onBack, onNext }) {
  // Pré-remplissage du `term` depuis Projet › Quick try (si présent).
  // Consommation et nettoyage du payload au mount. PAS de lancement
  // automatique — l'utilisateur clique « Lancer » lui-même.
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.jarvis) || null;
  if (typeof window !== 'undefined' && window.__jdmPendingPayload) {
    delete window.__jdmPendingPayload.jarvis;
  }
  const [params, setParams] = useState(() => {
    const base = defaultParamsFor(flow.id);
    if (_pending?.term && typeof base === 'object') {
      return { ...base, term: _pending.term };
    }
    return base;
  });
  // ── Run state hoisted in JarvisStore ───────────────────────────
  // Survit aux unmounts → switch d'onglet pendant un run ne tue plus
  // le flow ni la progression affichée. Le composant ne fait que lire
  // et déclencher des actions sur le store.
  const run = useJarvisRunState(flow.id);
  const state = run.status;
  const log = run.log;
  const metrics = run.metrics;
  const accepted = run.accepted;
  const narrationHTML = run.narrationHTML;
  const filePreview = run.filePreview;
  const filePath = run.filePath;
  const headline = run.headline;
  const resumeState = run.resumeState;
  const setResumeState = (v) => JarvisStore.patch(flow.id, { resumeState: v });
  const [poolStatus, setPoolStatus] = useState(null);
  // État des secrets en env serveur. Permet d'autoriser
  // soumission / auto-upload même si l'utilisateur n'a pas tapé la clé
  // (elle sera prise depuis l'env par le backend).
  const _envStatus = useEnvStatus();
  const _envHasDrops = !!(_envStatus.JDM_DROPS_API_KEY && _envStatus.JDM_DROPS_API_KEY.set);
  const _canSubmit = !!params.drops_key || _envHasDrops;
  // État du bouton « 📤 Soumettre » post-hoc à côté de Télécharger.
  // submitState ∈ {idle, sending, done, error}. submitMsg = retour serveur
  // affiché en pastille discrète sous l'en-tête du panneau pour ~6s.
  const [submitState, setSubmitState] = useState('idle');
  const [submitMsg, setSubmitMsg] = useState('');

  // Vue alternative du panneau GAUCHE (Narration LLM) :
  //   'log' (défaut, timeline mono-fontée avec timestamps + tags colorés
  //   — donne le suivi factuel des events) ↔ 'narration' (markdown HTML
  //   rendu, pensées + tool calls formatés par le backend). Le toggle
  //   apparaît dans le header du panneau. Le panneau droit (ItemCard)
  //   reste constant.
  const [leftView, setLeftView] = useState('log');

  // Pool status pour griser les Gemini blown dans le dropdown modèle.
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('api/pool/status');
        if (r.ok && alive) setPoolStatus(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const logRef = useRef(null);

  // Auto-scroll log + narration : suit le flux de génération en bas
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, narrationHTML]);

  // Parse le file_preview pour extraire les items à afficher dans le
  // panneau de droite. Mémoïsé sur (filePreview, flow.id) — la parse
  // est cheap mais évite de re-allouer N fois par seconde pendant
  // que le fichier grandit.
  const parsed = React.useMemo(
    () => parseFilePreview(filePreview, flow.id),
    [filePreview, flow.id]
  );

  // Synchronise le compteur "produced" du dashboard avec les items
  // parsés. Pour enrich, on garde la source registry (`accepted`) qui
  // est canonique. Push direct dans le store via patch — pas de setX
  // local (le state vit là-bas).
  React.useEffect(() => {
    if (flow.id === 'enrich') {
      JarvisStore.patch(flow.id, { metrics: { ...metrics, produced: metrics.accepted } });
    } else {
      const n = parsed.items.filter(i => i.type !== 'meta' && i.type !== 'sens').length;
      JarvisStore.patch(flow.id, { metrics: { ...metrics, produced: n } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.items.length, metrics.accepted, flow.id]);

  // launch/stop/reset délèguent au store. Le reader SSE + l'horloge
  // elapsed + le state du run vivent là-bas, donc unmount du composant
  // (= switch d'onglet) ne tue plus le flow.
  const launch = (continueFromResume) => {
    JarvisStore.start(flow.id, {
      params,
      isResume: !!continueFromResume,
      resumeState: continueFromResume ? resumeState : null,
    });
    if (continueFromResume) setResumeState(null);
  };
  const stop = () => JarvisStore.stop(flow.id);
  const reset = () => JarvisStore.reset(flow.id);

  // Smooth scroll animé : tween rAF custom (behavior:'smooth' peut
  // etre desactive par prefers-reduced-motion).
  //
  // Deux comportements :
  //   - À l'ouverture (mount / changement de flow) : scroll vers le
  //     TITRE (top + petite marge), pas vers le bas. L'utilisateur veut
  //     voir le header « Audit sémantique » + description avant les
  //     metrics/cards.
  //   - Au lancement (idle → running) : scroll vers le bas pour suivre
  //     le live (narration LLM + triplets en cours d'écriture).
  const _scrollSmoothTo = React.useCallback((targetY) => {
    const startY = window.scrollY || window.pageYOffset || 0;
    const dist = targetY - startY;
    if (Math.abs(dist) < 4) return;  // déjà au bon endroit
    const dur = 520;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, startY + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);
  const _scrollSmoothToBottom = React.useCallback(() => {
    _scrollSmoothTo(Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  }, [_scrollSmoothTo]);
  // Au mount / changement de flow : scroll vers le HAUT (titre visible
  // a quelques pixels du top). Pas vers le bas, l'utilisateur veut voir
  // l'entete du run avant les metrics et le live.
  React.useEffect(() => {
    const tid = setTimeout(() => _scrollSmoothTo(0), 50);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);
  // Au passage idle → running (clic Lancer) : scroll vers le bas pour
  // suivre la narration live + les triplets qui arrivent.
  const _prevStateRef = useRef(state);
  React.useEffect(() => {
    if (_prevStateRef.current === 'idle' && state === 'running') {
      setTimeout(_scrollSmoothToBottom, 200);
    }
    _prevStateRef.current = state;
  }, [state, _scrollSmoothToBottom]);

  return (
    <PageShell>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
      }}>
        <Button variant="ghost" size="sm" onClick={onBack}>← Tous les flux</Button>
        <span style={{ color: 'var(--ink-3)' }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: flow.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{flow.kicker}</span>
        {/* Symétrique : à droite, le flux suivant si pas en bout. */}
        {onNext && nextFlow && (
          <Button variant="ghost" size="sm" onClick={onNext}
            style={{ marginLeft: 'auto' }}>
            {nextFlow.title} →
          </Button>
        )}
      </div>
      <SectionTitle
        kicker={flow.kicker}
        title={flow.title}
        desc={flow.desc}
        right={<StatusBadge state={state} accent={flow.accent} />}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: params + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 80 }}>
          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Paramètres</div>
            <ParamsForm flow={flow} params={params} setParams={setParams} locked={state === 'running'} />
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12,
            }}>Contrôles</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(state === 'idle' || state === 'done' || state === 'error') && (
                <Button full onClick={() => launch(false)}>
                  {state === 'idle' ? '▶ Lancer' : '↻ Relancer'}
                </Button>
              )}
              {state === 'running' && (
                <Button variant="secondary" full onClick={stop}>⏹ Stop</Button>
              )}
            </div>

            {/* Bouton Continuer — apparaît si l'agent a abort (mode B) */}
            {resumeState && state !== 'running' && (
              <div style={{ marginTop: 10 }}>
                <Button full onClick={() => launch(true)}>
                  ▶ Continuer avec 3.1
                </Button>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
                  L'agent a saturé son quota — reprends sur Gemini 3.1 Flash Lite
                  (pool partagé, 500 req/jour) en gardant l'historique.
                </div>
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 12, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer',
            }}>
              <input type="checkbox"
                checked={!!params.auto_switch}
                onChange={(e) => setParams(p => ({ ...p, auto_switch: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
                disabled={state === 'running'} />
              Auto-bascule sur 3.1 si quota épuisé
            </label>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>
              Décoché (défaut) : abort propre + bouton « Continuer » apparaît.
              Coché : retry silencieux sans intervention.
            </div>

            {state === 'running' && (
              <div style={{
                marginTop: 10,
                padding: '6px 10px',
                background: 'var(--bg-elev)',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                Streaming SSE · arrêt manuel possible
              </div>
            )}
          </Card>

          <Card padding={16}>
            <div className="mono" style={{
              fontSize: 11, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 8,
            }}>Note</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Modèle, budget et clés sont configurés dans la barre horizontale
              en bas de l'écran (sous la vue temps réel).
            </div>
          </Card>
        </div>

        {/* Right: live monitor */}
        <div>
          {/* Headline (résumé) */}
          {headline && (
            <div style={{
              padding: '8px 14px',
              marginBottom: 12,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              color: 'var(--ink-2)',
            }}>
              {headline}
            </div>
          )}

          {/* ── Barre horizontale Modèle / Budget / Clé LLMDrops :
              Modèle / Budget / Clé LLMDrops (et clé BYOK si applicable).
              Positionnée AU-DESSUS des compteurs (remontée depuis sidebar). */}
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: (params.model || '').match(/^(claude|gpt)-/)
                ? 'minmax(180px, 1.4fr) minmax(140px, 1fr) minmax(180px, 1.2fr) minmax(180px, 1.2fr)'
                : 'minmax(220px, 1.6fr) minmax(160px, 1fr) minmax(200px, 1.2fr)',
              gap: 12,
              alignItems: 'end',
            }}>
              <Field label="Modèle">
                <Select value={params.model || 'gemini-3.1-flash-lite'}
                  onChange={(v) => setParams(p => ({ ...p, model: v }))}
                  options={[
                    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
                    { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash' },
                    { value: 'claude-haiku-4-5',      label: 'Claude Haiku 4.5 (BYOK)' },
                    { value: 'gpt-4o-mini',           label: 'GPT-4o mini (BYOK)' },
                  ].map(m => {
                    if (poolStatus && m.value.startsWith('gemini-')) {
                      const allBlown = (poolStatus.keys || []).every(
                        k => k.invalid || (k.blown_by_model && k.blown_by_model[m.value])
                      );
                      if (allBlown && poolStatus.keys && poolStatus.keys.length > 0) {
                        return { ...m, label: `❌ ${m.label} — épuisé`,
                                 sub: 'pool entièrement consommé aujourd\'hui' };
                      }
                    }
                    return m;
                  })} />
              </Field>
              <Field label="Budget outils">
                <Select value={params.budget_label || 'illimité'}
                  onChange={(v) => setParams(p => ({ ...p, budget_label: v }))}
                  options={BUDGET_OPTS} />
              </Field>
              <Field label={
                _envHasDrops
                  ? 'Clé LLMDrops (override .env)'
                  : 'Clé LLMDrops'
              }>
                <Input type="password"
                  value={params.drops_key || ''}
                  onChange={(v) => setParams(p => ({ ...p, drops_key: v }))}
                  placeholder={_envHasDrops ? '— configurée côté serveur —' : 'vide = pas de clé'}
                  mono />
              </Field>
              {(params.model || '').match(/^(claude|gpt)-/) && (() => {
                const envKey = (params.model || '').startsWith('claude-') ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
                const envHas = !!(_envStatus[envKey] && _envStatus[envKey].set);
                return (
                  <Field label={envHas ? 'Clé API LLM (override .env)' : 'Clé API LLM'}>
                    <Input type="password"
                      value={params.api_key || ''}
                      onChange={(v) => setParams(p => ({ ...p, api_key: v }))}
                      placeholder={envHas
                        ? '— configurée côté serveur —'
                        : ((params.model || '').startsWith('claude-') ? 'sk-ant-…' : 'sk-…')}
                      mono />
                  </Field>
                );
              })()}
            </div>
            {/* Checkbox raisonnement (chain-of-thought) — pareil que dans
                l'onglet Chatbot LLM. Toggle params.use_thinking, dispo
                quel que soit le modèle (Gemini, Claude, GPT). Pour les
                flows Jarvis le défaut est false (robustesse > raisonnement
                long) mais l'utilisateur peut l'activer ad hoc. */}
            <label
              title="Active la trace de raisonnement (« thinking » Anthropic / Google) — coûte plus de tokens mais peut améliorer les choix d'outils."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--line-soft)',
              }}>
              <input type="checkbox"
                checked={!!params.use_thinking}
                onChange={(e) => setParams(p => ({ ...p, use_thinking: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }} />
              Raisonnement (chain-of-thought)
            </label>
          </Card>

          {/* Metrics grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <Metric label="Outils" value={metrics.toolsCalled} sub="appels" accent={flow.accent} />
            <Metric label="Tokens" value={fmtTokens(metrics.tokens)} sub="estimés" mono />
            {/* Compteur "produits" dynamique selon le flow : pour enrich
                = consolidés depuis le registry ; pour audit/err/annot/stats
                = items extraits du file_preview (signalements + verdicts +
                annotations + lignes). Le label s'adapte. */}
            <Metric label={metricLabelFor(flow.id).label}
                    value={metrics.produced}
                    sub={metricLabelFor(flow.id).sub}
                    color="var(--jdm-green)" />
            <Metric label="Temps" value={fmtElapsed(metrics.elapsed)} sub="écoulé" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            {/* Narration (markdown HTML interprété — narrations LLM,
                tools, consolidations) — c'est notre VRAI log temps réel. */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {leftView === 'log' ? 'Log temps réel' : 'Narration LLM'}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
                  {/* Toggle Narration / Log — bascule l'affichage du panneau
                      gauche entre :
                      - Narration LLM (défaut) : markdown HTML rendu (pensées
                        + tool calls formatés par le backend, c'est notre
                        vrai « live » de l'agent)
                      - Log temps réel : timeline mono-fontée avec timestamps
                        + tags colorés par type d'event SSE (start/file/done/
                        error/cancelled)
                      Même flux de données ; seule la présentation change. */}
                  <div style={{
                    display: 'inline-flex',
                    background: 'var(--bg-card)', border: '1px solid var(--line)',
                    borderRadius: 999, padding: 2,
                  }}>
                    {[
                      { id: 'narration', label: 'Narration' },
                      { id: 'log',       label: 'Log' },
                    ].map(t => {
                      const active = leftView === t.id;
                      return (
                        <button key={t.id} type="button"
                          onClick={() => setLeftView(t.id)}
                          className="focus-ring"
                          style={{
                            padding: '3px 10px', borderRadius: 999,
                            border: 'none', cursor: 'pointer',
                            background: active ? flow.accent : 'transparent',
                            color: active ? 'var(--bg)' : 'var(--ink-3)',
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontWeight: active ? 600 : 500,
                            transition: 'background .18s, color .18s',
                          }}>{t.label}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420,
                overflowY: 'auto',
                padding: leftView === 'log' ? 12 : 14,
                background: 'var(--bg-card)',
                fontFamily: leftView === 'log' ? 'var(--font-mono)' : 'inherit',
                fontSize: leftView === 'log' ? 11 : 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {leftView === 'log' ? (
                  // Vue Log : derive les TENTATIVES depuis narrationHTML
                  // (data-tool attributes) + croise avec FLOW_TOOL_STEPS,
                  // puis groupe les tools de chaque tentative sous un
                  // header « Tentative N ». Les events SSE brut (log)
                  // restent en pied de page pour les meta-evenements
                  // (start/done/error/cancelled/file).
                  //
                  // Triplet VALIDE = present dans store.accepted (registry
                  // consolidation pour enrich) ou dans les items
                  // parseFilePreview type=consolidated/audit_signalement.
                  // On construit un Set de cles "term|rel|target" normalisees
                  // pour pouvoir teinter chaque ligne tentative.
                  (() => {
                    const fts = (typeof FLOW_TOOL_STEPS !== 'undefined' && FLOW_TOOL_STEPS[flow.id]) || {};
                    const _norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase();
                    const validatedSet = new Set();
                    if (Array.isArray(accepted)) {
                      for (const a of accepted) {
                        const t = _norm(a.subject || a.term);
                        const r = _norm(a.relation);
                        const tg = _norm(a.target);
                        if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
                      }
                    }
                    // file_preview consolidated/audit_signalement items
                    if (parsed && Array.isArray(parsed.items)) {
                      for (const it of parsed.items) {
                        if (it.type === 'consolidated' || it.type === 'audit_signalement') {
                          const t = _norm(it.subject);
                          const r = _norm(it.relation);
                          const tg = _norm(it.target);
                          if (t && r && tg) validatedSet.add(`${t}|${r}|${tg}`);
                        }
                      }
                    }
                    // Parse les tool calls — on extrait data-tool, data-triplet
                    // (pose cote backend depuis tc.args.term/relation/target) et
                    // data-result. La vue Log affiche les TRIPLETS tentes, pas
                    // la phrase humaine ; le pattern « X | r_xxx | Y » ressort
                    // directement de l'attribut data-triplet, deterministe.
                    const re = /<div\s+class="jdm-narration"\s+data-tool="(\w+)"\s*(data-triplet="([^"]*)")?\s*(data-result="1")?[^>]*>/g;
                    const items = [];
                    if (narrationHTML) {
                      let mm;
                      while ((mm = re.exec(narrationHTML)) !== null) {
                        items.push({
                          tool: mm[1],
                          triplet: mm[3] || '',
                          isResult: !!mm[4],
                        });
                      }
                    }
                    // Regroupe par tentative (chaque step 0 apres step >=1 ouvre une nouvelle)
                    const tentatives = [];
                    let cur = null, prevStep = -1;
                    for (const it of items) {
                      if (it.isResult) {
                        if (cur) cur.push(it);
                        continue;
                      }
                      const s = fts[it.tool];
                      if (s === undefined) {
                        if (cur) cur.push(it);
                        continue;
                      }
                      if (s === 0 && (prevStep === -1 || prevStep >= 1)) {
                        cur = [];
                        tentatives.push(cur);
                      }
                      if (cur) cur.push(it);
                      prevStep = s;
                    }
                    if (!narrationHTML && (!log || log.length === 0)) return null;
                    return (
                      <>
                        {tentatives.map((tent, ti) => (
                          <div key={'t' + ti} style={{ marginBottom: 12 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '4px 0', marginBottom: 6,
                              borderBottom: `1px dashed color-mix(in srgb, ${flow.accent} 35%, transparent)`,
                              color: flow.accent, fontWeight: 600,
                              textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10,
                            }}>
                              <span style={{
                                background: flow.accent, color: 'var(--bg)',
                                padding: '1px 7px', borderRadius: 3, fontSize: 9.5,
                              }}>Tentative {ti + 1}</span>
                              <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
                                {tent.filter(x => !x.isResult).length} appel(s), {tent.filter(x => x.isResult).length} retour(s)
                              </span>
                            </div>
                            {tent.filter(x => !x.isResult && x.triplet).map((it, k) => {
                              // Affiche le TRIPLET tente (data-triplet : term|rel|target,
                              // term|rel, ou term seul selon le tool). Skip les tools
                              // sans triplet (workflow init, write_submission_file).
                              const parts = it.triplet.split('|');
                              const [term, rel, target] = parts;
                              // Check si ce triplet a fini par etre VALIDE (= present
                              // dans le registry de consolidation enrich ou les items
                              // consolidated du file_preview). Sans target on ne peut
                              // pas valider strictement, on laisse neutre.
                              const _key = (term && rel && target)
                                ? `${term.trim().toLowerCase()}|${rel.trim().toLowerCase()}|${target.trim().toLowerCase()}`
                                : null;
                              const isValidated = _key && validatedSet.has(_key);
                              return (
                                <div key={k} style={{
                                  display: 'flex', gap: 8, marginBottom: 3, alignItems: 'baseline',
                                  paddingLeft: 8, paddingRight: 8,
                                  // Teinte verte douce + liseré gauche quand valide.
                                  // L'absence de fond et de bordure pour les non valides
                                  // garde le visuel sobre par défaut.
                                  background: isValidated
                                    ? 'color-mix(in srgb, var(--jdm-green) 9%, transparent)'
                                    : 'transparent',
                                  borderLeft: isValidated
                                    ? '2px solid var(--jdm-green)'
                                    : '2px solid transparent',
                                  borderRadius: '0 3px 3px 0',
                                  paddingTop: 2, paddingBottom: 2,
                                  transition: 'background .25s, border-color .25s',
                                }} title={isValidated ? 'Triplet validé : passé en consolidation' : 'Triplet tenté'}>
                                  <span style={{
                                    flexShrink: 0, fontSize: 10,
                                    color: isValidated ? 'var(--jdm-green)' : 'var(--accent)',
                                    fontWeight: isValidated ? 700 : 400,
                                  }}>
                                    {isValidated ? '✓' : '→'}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', wordBreak: 'break-word' }}>
                                    <span style={{ fontWeight: 600 }}>{term}</span>
                                    {rel && (<>
                                      <span style={{ color: 'var(--ink-3)' }}> | </span>
                                      <span style={{ color: flow.accent }}>{rel}</span>
                                    </>)}
                                    {target && (<>
                                      <span style={{ color: 'var(--ink-3)' }}> | </span>
                                      <span style={{ fontWeight: 600 }}>{target}</span>
                                    </>)}
                                  </span>
                                  {isValidated && (
                                    <span className="mono" style={{
                                      flexShrink: 0, fontSize: 8.5, fontWeight: 600,
                                      padding: '1px 5px', borderRadius: 3,
                                      background: 'var(--jdm-green)', color: 'var(--bg)',
                                      textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>validé</span>
                                  )}
                                  <span style={{ flexShrink: 0, color: 'var(--ink-3)', fontSize: 9.5 }}>{it.tool}</span>
                                </div>
                              );
                            })}
                            {/* Si la tentative n'a aucun triplet (workflow + lookup seuls),
                                affiche un placeholder leger pour ne pas etre invisible. */}
                            {tent.filter(x => !x.isResult && x.triplet).length === 0 && (
                              <div style={{ paddingLeft: 8, fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                                aucun triplet tente dans cette tentative ({tent.filter(x => !x.isResult).length} appel(s) sans args triplet)
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Events SSE bruts (start/done/cancelled/file/error) en pied de page */}
                        {(log || []).length > 0 && (
                          <div style={{
                            marginTop: 14, paddingTop: 10,
                            borderTop: '1px solid var(--line-soft)',
                          }}>
                            <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Events systeme</div>
                            {log.map((l, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'baseline' }}>
                                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                                <span style={{
                                  flexShrink: 0,
                                  color: l.kind === 'tool' ? 'var(--accent)' :
                                         l.kind === 'accept' ? 'var(--jdm-green)' :
                                         l.kind === 'reject' ? 'var(--jdm-magenta)' :
                                         l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                                  minWidth: 56,
                                }}>{l.tag}</span>
                                <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : narrationHTML ? (
                  // Vue Narration : markdown + HTML <jdm-narration> inline
                  // rendus par marked.js (la trace d'outils reste structurée,
                  // les **gras** / `code` / listes se rendent correctement).
                  <div className="jdm-prose"
                       dangerouslySetInnerHTML={{ __html: renderMarkdownJarvis(narrationHTML) }} />
                ) : (
                  // Fallback : entrées tag/temps des events headline/file/etc.
                  log.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.t}</span>
                      <span style={{
                        flexShrink: 0, minWidth: 64,
                        color: l.kind === 'accept' ? 'var(--jdm-green)'
                              : l.kind === 'reject' ? 'var(--jdm-magenta)'
                              : l.kind === 'iter' ? flow.accent : 'var(--ink-3)',
                      }}>{l.tag}</span>
                      <span style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Triplets consolidés = liste qui croît avec le fichier en
                construction. Bouton "Télécharger" en haut à droite pour
                récupérer le fichier brut. */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 8,
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {panelTitleFor(flow.id)} · <span style={{ color: 'var(--jdm-green)' }}>{metrics.produced}</span>
                  {filePath && (
                    <span style={{ color: 'var(--ink-2)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                      · {filePath.split(/[\\/]/).slice(-1)[0]}
                    </span>
                  )}
                </div>
                {/* Télécharger le fichier brut — appelle l'API
                    /api/productions/download avec le basename. */}
                {filePath && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Bouton « 📤 Soumettre à JDM » post-hoc. Disponible
                        uniquement pour les flows qui produisent un fichier
                        soumissible (.enrich/.audit/.err/.stat/.annot) ET
                        si la clé LLMDrops est saisie (sinon disabled +
                        tooltip explicatif). Appelle /api/productions/submit
                        avec le basename + api_key + model_name pour
                        renommer correctement côté serveur. */}
                    {SUBMITTABLE_FLOWS.has(flow.id) && (
                      <Button size="sm" variant="ghost"
                        // Disabled UNIQUEMENT si pas de clé OU upload en cours.
                        // Si le flow tourne encore mais qu'on a la clé, on
                        // laisse cliquer (avec grisage visuel + confirm).
                        disabled={!_canSubmit || submitState === 'sending'}
                        style={state === 'running' && _canSubmit
                          ? { opacity: 0.55 }
                          : undefined}
                        title={!_canSubmit
                          ? 'Renseigne la clé LLMDrops (ou configure JDM_DROPS_API_KEY côté serveur) pour activer la soumission'
                          : state === 'running'
                            ? 'Soumission anticipée — le flow tourne encore (clic pour confirmer)'
                            : (params.drops_key
                              ? 'Soumettre ce fichier au LLMDrops JDM (clé saisie)'
                              : 'Soumettre ce fichier au LLMDrops JDM (clé serveur)')}
                        onClick={async () => {
                          // Confirmation si le flow tourne encore — soumettre
                          // un fichier incomplet est légitime mais inhabituel.
                          if (state === 'running') {
                            const ok = window.confirm(
                              'Le flow n\'est pas encore terminé — le fichier .' +
                              (flow.id === 'enrich' ? 'enrich' : flow.id === 'audit' ? 'audit'
                                : flow.id === 'signalement' ? 'err' : flow.id === 'stats' ? 'stat'
                                : flow.id === 'annotation' ? 'annot' : 'txt') +
                              ' contient seulement les triplets produits jusqu\'à maintenant. ' +
                              '\n\nSoumettre maintenant quand même ?'
                            );
                            if (!ok) return;
                          }
                          const name = filePath.split(/[\\/]/).slice(-1)[0];
                          setSubmitState('sending');
                          setSubmitMsg('');
                          try {
                            const r = await fetch('api/productions/submit', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                names: [name],
                                archived: false,
                                api_key: params.drops_key || '',
                                model_name: params.model || '',
                              }),
                            });
                            const data = await r.json();
                            const res = (data.results || [])[0] || {};
                            if (res.ok) {
                              setSubmitState('done');
                              setSubmitMsg(`✓ uploadé sous ${res.uploaded_as || name} (HTTP ${res.status_code || '?'})`);
                            } else {
                              setSubmitState('error');
                              setSubmitMsg(`✗ ${res.error || 'échec inconnu'}`);
                            }
                          } catch (e) {
                            setSubmitState('error');
                            setSubmitMsg(`✗ ${e.message || e}`);
                          }
                          // Auto-clear le message après 8s pour ne pas
                          // bloquer l'UI si l'user veut retenter.
                          setTimeout(() => {
                            setSubmitState('idle'); setSubmitMsg('');
                          }, 8000);
                        }}>
                        {submitState === 'sending' ? '⏳ Envoi…' : '📤 Soumettre'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => {
                        const name = filePath.split(/[\\/]/).slice(-1)[0];
                        const url = `api/productions/download?name=${encodeURIComponent(name)}`;
                        const a = document.createElement('a');
                        a.href = url; a.download = name;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}>
                      ⬇ Télécharger
                    </Button>
                  </div>
                )}
              </div>
              {/* Toast discret du verdict de soumission post-hoc.
                  Vert si succès, rose si erreur. Apparaît ~8s. */}
              {submitMsg && (
                <div className="fade-up" style={{
                  padding: '6px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: submitState === 'error' ? 'var(--jdm-magenta)' : 'var(--jdm-green)',
                  borderBottom: '1px solid var(--line-soft)',
                  background: 'var(--bg-elev)',
                }}>{submitMsg}</div>
              )}
              <div style={{
                height: 420,
                overflowY: 'auto',
                padding: 0,
                background: 'var(--bg-card)',
              }}>
              {(() => {
                  // Enrich : source registry (`accepted`) — déjà au format
                  // ItemCard (cf. mapping SSE plus haut qui pose
                  // type='consolidated' + explanation).
                  if (flow.id === 'enrich') {
                    if (accepted.length === 0) {
                      return (
                        <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                          {state === 'idle' ? 'Aucun triplet encore.' : 'En attente du 1ᵉʳ triplet consolidé…'}
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                        {accepted.map((a, i) => (
                          <ItemCard key={i} item={a} accent={flow.accent} />
                        ))}
                      </div>
                    );
                  }

                  // Autres flows : on parse le file_preview.
                  if (parsed.items.length === 0) {
                    return (
                      <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                        {state === 'idle'
                          ? 'Le panneau se remplira au fur et à mesure que le fichier est écrit.'
                          : 'En attente des premiers résultats…'}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                      {parsed.items.map((it, i) => (
                        <ItemCard key={i} item={it} accent={flow.accent} />
                      ))}
                    </div>
                  );
              })()}
              </div>
            </Card>
          </div>

        </div>
      </div>

      {/* Rail discret d'acces rapide aux 10 premiers flux (running d'abord).
          Permet de switcher entre runs depuis la vue de run sans repasser
          par le carrousel sommaire. Styling subtil — bg-elev, separateurs
          fins, pulse-dot sur le flux courant et les flux en cours. */}
      <JarvisRunRail flow={flow}
        onPick={(id) => {
          // Si on est deja sur ce flow, no-op ; sinon switch en passant par
          // window.__jdmRoute pour preserver l'historique.
          if (id === flow.id) return;
          if (typeof window !== 'undefined' && window.__jdmRoute) {
            window.__jdmRoute.push('jarvis', id);
          }
          // Force le ViewJarvis a re-evaluer son state running depuis l'URL.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('jdm-jarvis-switch-run', { detail: { flow_id: id } }));
          }
        }}
      />
    </PageShell>
  );
}

// Rail bas de page — 10 premiers flux du catalogue, ordonnes : en cours
// d'abord (avec pulse-dot d'accent), puis au repos. Le flux courant a un
// outline et une pastille « actuel ». Styling aligne sur le design
// (mono font, var(--bg-elev), bordures fines).
function JarvisRunRail({ flow, onPick }) {
  const activeSet = useJarvisActiveSet();
  const ordered = JARVIS_FLOWS.slice(0, 10).slice().sort((a, b) => {
    const aRun = activeSet.has(a.id) ? 0 : 1;
    const bRun = activeSet.has(b.id) ? 0 : 1;
    if (aRun !== bRun) return aRun - bRun;
    return JARVIS_FLOWS.findIndex(f => f.id === a.id) - JARVIS_FLOWS.findIndex(f => f.id === b.id);
  });
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 5,
      marginTop: 18,
      borderTop: '1px solid var(--line-soft)',
      background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        overflowX: 'auto', whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
      }} className="jpanel-scroll">
        <span className="mono" style={{
          flexShrink: 0, fontSize: 9.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginRight: 4,
        }}>Flux</span>
        {ordered.map(f => {
          const isCurrent = f.id === flow.id;
          const isActive = activeSet.has(f.id);
          return (
            <button key={f.id} type="button" onClick={() => onPick(f.id)}
              title={`${f.title}${isActive ? ' · en cours' : ''}`}
              className="focus-ring"
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 11px',
                background: isCurrent ? `color-mix(in srgb, ${f.accent} 12%, var(--bg-card))` : 'var(--bg-card)',
                border: '1px solid ' + (isCurrent ? `color-mix(in srgb, ${f.accent} 55%, transparent)` : 'var(--line-soft)'),
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: isCurrent ? f.accent : 'var(--ink-2)',
                transition: 'background .15s, border-color .15s, color .15s',
              }}>
              {isActive && (
                <span className="pulse-dot" style={{ background: f.accent, width: 6, height: 6 }} />
              )}
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: f.accent, opacity: isActive ? 0 : 0.55,
                display: isActive ? 'none' : 'inline-block',
              }} />
              <span style={{ color: 'inherit' }}>{f.title}</span>
              {isCurrent && (
                <span className="mono" style={{
                  fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                  background: f.accent, color: 'var(--bg)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>actuel</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}




// ───── Status badge ─────
function StatusBadge({ state, accent }) {
  const STYLES = {
    idle:      { label: 'En attente', color: 'var(--ink-3)',       dot: false },
    running:   { label: 'En cours',   color: accent,               dot: true  },
    paused:    { label: 'En pause',   color: 'var(--jdm-orange)',  dot: false },
    done:      { label: 'Terminé',    color: 'var(--jdm-green)',   dot: false },
    error:     { label: 'Erreur',     color: 'var(--jdm-magenta)', dot: false },
    cancelled: { label: 'Annulé',     color: 'var(--ink-3)',       dot: false },
    aborted:   { label: 'Interrompu', color: 'var(--ink-3)',       dot: false },
  };
  // Fallback : si un nouveau statut backend arrive sans entrée dans STYLES,
  // on retombe sur 'idle' pour ne JAMAIS crasher le render (vu en prod
  // quand une erreur Google API mettait state='error', non couvert → null
  // → styles.color crash).
  const styles = STYLES[state] || STYLES.idle;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '5px 12px',
      border: `1px solid ${styles.color}`,
      borderRadius: 999,
      color: styles.color,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      fontWeight: 600,
    }}>
      {styles.dot && <span className="pulse-dot" style={{ background: styles.color }} />}
      {styles.label}
    </div>
  );
}

// ───── Metric tile ─────
function Metric({ label, value, sub, max, accent, color, mono }) {
  const pct = max ? Math.min(100, (Number(value) / max) * 100) : null;
  return (
    <div style={{ background: 'var(--bg-card)', padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>{label}</div>
      <div className="display" style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontSize: mono ? 20 : 24,
        fontWeight: 600,
        marginTop: 4,
        color: color || 'var(--ink)',
        letterSpacing: '-0.01em',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      {pct != null && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 2, background: 'var(--line-soft)',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', background: accent || 'var(--accent)', transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

// ───── Per-flow params ─────
// ───── Simulated step — fake but realistic ─────
window.ViewJarvis = ViewJarvis;
