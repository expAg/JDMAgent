// View: Jarvis — agent-driven flows wired to /api/jarvis/{flow_id}/stream.
//
// Conserve la structure visuelle du designer (cards de flow, page Run
// avec params + metrics + log + résultats) mais branche maintenant les
// 5 vrais flows backend : enrich / audit / gap / signalement / stats.

const JARVIS_FLOWS = [
  {
    id: 'enrich',
    title: 'Enrichissement',
    kicker: 'Flux 1',
    desc: 'Propose de nouveaux triplets pour un terme, les valide via JDM (factcheck + inférence), garde ceux qui passent, écrit un fichier .enrich prêt pour LLMDrops.',
    accent: 'var(--jdm-magenta)',
    loopOf: 'proposition → validation → consolidation',
  },
  {
    id: 'audit',
    title: 'Audit sémantique',
    kicker: 'Flux 2',
    desc: 'Pour un terme polysémique, vérifie sens par sens quelles relations sont légitimes, contrastives, à corriger. Produit un fichier .audit.',
    accent: 'var(--jdm-cyan)',
    loopOf: 'sens → triplet → verdict',
  },
  {
    id: 'gap',
    title: 'Détection de trous',
    kicker: 'Flux 3',
    desc: 'Identifie les relations manquantes ou faiblement couvertes pour un terme — pour relancer l\'enrichissement de façon ciblée.',
    accent: 'var(--jdm-green)',
    loopOf: 'parcours → diagnostic → trous',
  },
  {
    id: 'signalement',
    title: 'Signalement',
    kicker: 'Flux 4',
    desc: 'Scanne un terme à la recherche de triplets suspects (incohérences, polarité douteuse, annotations oubliées). Produit un fichier .err.',
    accent: 'var(--jdm-orange)',
    loopOf: 'inventaire → flag → catégorisation',
  },
  {
    id: 'stats',
    title: 'Stats',
    kicker: 'Flux 5',
    desc: 'Compte les relations, leur poids, leur distribution par terme et par relation. Renvoie un récapitulatif structuré.',
    accent: 'var(--jdm-violet)',
    loopOf: 'inventaire → agrégation',
  },
  {
    id: 'annotation',
    title: 'Annotation sémantique',
    kicker: 'Flux 6',
    desc: 'Annote les triplets existants selon la taxonomie 4 catégories (constitutif/contrastif/non spécifique/exception). L\'annotation qualifie le LIEN, pas l\'objet. Produit un fichier .annot deux sections (annotations + signalement des désaccords avec JDM existant).',
    accent: 'var(--jdm-yellow)',
    loopOf: 'triplet → jugement → catégorie',
  },
];

// Flows qui produisent un fichier soumissible au LLMDrops. Stats =
// .stat est techniquement soumissible mais l'usage le rend rare (le
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
              cur.accepted = d.consolidated.map(c => ({
                label: `${c.term} | ${c.relation} | ${c.target}`,
                score: '✓',
              }));
            }
            if (typeof d.file_preview === 'string') cur.filePreview = d.file_preview;
            if (d.file_path && d.file_path !== cur.filePath) {
              cur.filePath = d.file_path;
              cur.log = [...cur.log, {
                t: ts(), tag: '[file]', kind: 'accept',
                msg: `Fichier : ${d.file_path}`,
              }];
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

function ViewJarvis() {
  // Pré-remplissage depuis Projet › Quick try OU deep link URL
  // /jarvis/<flow> : si l'utilisateur a cliqué « Préparer dans Jarvis »
  // ou ouvert un lien deep, on bascule directement sur ce flow (le terme
  // est consommé par JarvisRun via une seconde lecture du payload —
  // gardé sur window jusqu'au mount de JarvisRun).
  const _pending = (typeof window !== 'undefined'
                    && window.__jdmPendingPayload?.jarvis) || null;
  const [active, setActive] = useState(_pending?.flow || null);

  // Set des flows actuellement en cours (resync à chaque changement
  // d'état du store). Sert à dégrader le badge "🟢 en cours" sur les
  // cartes de la liste — un run survit au unmount donc on peut quitter
  // la vue et revenir : le badge reste, le run aussi.
  const activeRunSet = useJarvisActiveSet();

  // Synchronise l'URL avec le flow actif. /jarvis (liste) ↔ /jarvis/<id>
  // (run). Permet bookmark/share + back/forward navigateur cohérents.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.__jdmRoute) return;
    window.__jdmRoute.replace('jarvis', active || null);
  }, [active]);

  if (active) {
    const idx = JARVIS_FLOWS.findIndex(f => f.id === active);
    const flow = JARVIS_FLOWS[idx];
    const nextFlow = idx >= 0 && idx < JARVIS_FLOWS.length - 1 ? JARVIS_FLOWS[idx + 1] : null;
    return (
      <JarvisRun
        flow={flow}
        nextFlow={nextFlow}
        onBack={() => setActive(null)}
        onNext={nextFlow ? () => setActive(nextFlow.id) : null}
      />
    );
  }
  return (
    <PageShell>
      <SectionTitle
        kicker="Pipelines guidés"
        title="Jarvis"
        desc="Cinq flux d'agent guidés par formulaire. Tu paramètres, tu lances, l'agent suit le workflow canonique du flux. Stoppable à tout moment."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {JARVIS_FLOWS.map(f => (
          <div key={f.id}
            onClick={() => setActive(f.id)}
            className="focus-ring"
            tabIndex={0}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: 22,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = f.accent;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.transform = '';
            }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: 4,
              background: f.accent,
            }} />
            {/* Badge "en cours" — visible si le store dit que ce flow
                tourne. Tient toujours même si l'utilisateur a quitté
                l'onglet pendant le run grâce au JarvisStore. */}
            {activeRunSet.has(f.id) && (
              <div style={{
                position: 'absolute',
                top: 14, right: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                background: 'rgba(78,166,60,0.12)',
                border: '1px solid rgba(78,166,60,0.40)',
                borderRadius: 999,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--jdm-green)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--jdm-green)',
                  animation: 'pulse-dot 1.2s ease-in-out infinite',
                }} />
                <span>en cours</span>
              </div>
            )}
            <div className="mono" style={{
              fontSize: 11, color: f.accent,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontWeight: 600,
              marginBottom: 8,
            }}>{f.kicker}</div>
            <div className="display" style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24, fontWeight: 600,
              letterSpacing: '-0.015em',
              marginBottom: 10,
            }}>{f.title}</div>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              marginBottom: 14,
            }}>{f.desc}</p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              background: 'var(--bg-elev)',
              border: '1px dashed var(--line-soft)',
              borderRadius: 999,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-3)',
            }}>
              <LoopGlyph color={f.accent} />
              {f.loopOf}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function LoopGlyph({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
      <path d="M 10 4 A 4 4 0 1 0 9.5 8.5"
        fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 10 4 L 8 4 L 10 2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ───── Run view — Sse-driven ─────
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

  // Smooth scroll à l'ouverture : si le flow a déjà du contenu (run en
  // cours ou terminé avec données), on amène le bas des panneaux dans
  // la viewport — l'utilisateur voit l'état courant (dernières lignes
  // de narration, derniers triplets) sans scroller manuellement.
  //
  // Robustesse : on lit le state DEPUIS LE STORE au moment du setTimeout
  // (pas une closure stale), on attend que le layout se pose (300ms
  // pour laisser le temps aux panneaux narration/triplets de calculer
  // leur hauteur), et on scroll via window.scrollTo + scrollHeight
  // plutôt que scrollIntoView qui se comporte erratiquement quand le
  // contenu grandit pendant l'animation.
  React.useEffect(() => {
    const tid = setTimeout(() => {
      const fresh = JarvisStore.get(flow.id);
      const hasContent = fresh.status === 'running' || fresh.status === 'done' || fresh.status === 'error'
                      || (fresh.narrationHTML && fresh.narrationHTML.length > 0)
                      || (fresh.filePreview && fresh.filePreview.length > 0);
      if (!hasContent) return;
      try {
        const targetY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } catch {}
    }, 300);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);

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
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--bg-elev)',
                borderBottom: '1px solid var(--line-soft)',
              }}>
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>Narration LLM</div>
                {state === 'running' && <span className="pulse-dot" style={{ background: flow.accent }} />}
              </div>
              <div ref={logRef} className="jdm-narration-pane" style={{
                height: 420,
                overflowY: 'auto',
                padding: 14,
                background: 'var(--bg-card)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}>
                {!narrationHTML && log.length === 0 && (
                  <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>
                    {state === 'idle' ? 'En attente du lancement…' : '—'}
                  </div>
                )}
                {narrationHTML ? (
                  // Le contenu sortant du LLM est markdown + parfois
                  // des divs HTML <jdm-narration> embeddés (trace
                  // d'outils). marked.js préserve les blocs HTML
                  // inline → la trace reste structurée, mais les
                  // titres / listes / **gras** / `code` se rendent
                  // correctement (cf. chatbot et enrich qui font pareil).
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
                {/* Rendu adaptatif selon flow.id et type de chaque item.
                    Enrich = liste simple (canonique du registry).
                    Audit/err/annot = cartes stylisées par type, avec
                    bloc explication mis en valeur quand il existe. */}
                {(() => {
                  // Enrich : on garde la source registry (accepted) qui
                  // ne contient QUE les consolidés vérifiés.
                  if (flow.id === 'enrich') {
                    if (accepted.length === 0) {
                      return (
                        <div style={{ color: 'var(--ink-3)', fontSize: 12, textAlign: 'center', padding: '60px 0' }}>
                          {state === 'idle' ? 'Aucun triplet encore.' : 'En attente du 1ᵉʳ triplet consolidé…'}
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'grid', gap: 4, padding: 12 }}>
                        {accepted.map((a, i) => (
                          <div key={i} className="fade-up" style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px',
                            background: 'var(--bg-elev)',
                            border: '1px solid var(--line-soft)',
                            borderRadius: 'var(--radius)',
                            fontFamily: 'var(--font-mono)', fontSize: 11,
                          }}>
                            <span style={{ color: 'var(--jdm-green)', flexShrink: 0 }}>{a.score}</span>
                            <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)' }}>{a.label}</span>
                          </div>
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
    </PageShell>
  );
}

// ───── Helpers ─────

// ─── ItemCard — rendu stylisé d'un item parsé ───────────────────
// 5 types affichables : consolidated, flagged (.err), signalement
// (.annot/.audit), audit_signalement (.audit verdicts), meta (prose).
// Quand un item a une `explanation` (= ce que le LLM a dit sur le
// flag / signalement), on l'affiche dans un bloc stylisé sous le
// triplet — c'est le coeur de la demande utilisateur.
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

// ───── Status badge ─────
function StatusBadge({ state, accent }) {
  const styles = {
    idle:    { label: 'En attente', color: 'var(--ink-3)',       dot: false },
    running: { label: 'En cours',   color: accent,               dot: true  },
    done:    { label: 'Terminé',    color: 'var(--jdm-green)',   dot: false },
    error:   { label: 'Erreur',     color: 'var(--jdm-magenta)', dot: false },
  }[state];
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

// ───── fmtElapsed : ms → "12.4s" ou "2m 14.8s" (passe en minutes ≥ 60s) ─
function fmtElapsed(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rem = sec - m * 60;
  return `${m}m ${rem.toFixed(1)}s`;
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

// ───── Per-flow form ─────

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
  // Defaults alignés sur la branche deploy-self / app.py :
  // term vide partout (= tirage au hasard côté backend), budget illimité,
  // thinking=false (Jarvis = robustesse > raisonnement), upload=false,
  // auto_switch=false (= mode B : abort + bouton Continuer).
  const common = {
    model: 'gemini-3.1-flash-lite',
    api_key: '', drops_key: '',
    use_thinking: false,
    budget_label: 'illimité',
    auto_switch: false,
  };
  switch (flowId) {
    case 'enrich':
      return { ...common, term: '', relation: [],
               target_count: 3, vary_relations: true, iterate: true, upload: false };
    case 'audit':
      return { ...common, term: '', relation: [], upload: false };
    case 'gap':
      return { ...common, term: '' };
    case 'signalement':
      return { ...common, term: '', relation: [], upload: false };
    case 'stats':
      return { ...common, term: '', relation: [], upload: false };
    case 'annotation':
      return { ...common, term: '', relation: [], top_k: 8,
               target_count: 10, upload: false };
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

window.ViewJarvis = ViewJarvis;
