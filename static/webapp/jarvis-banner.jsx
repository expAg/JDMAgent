/* ──────────────────────────────────────────────────────────────────────
   JarvisBanner — bandeau d'identité compact pour le Tableau de bord.
     · Robot mascotte animé (roam + grimaces + petites pensées JDM)
     · mot-symbole « Jarvis » + accroche
     · toggle Manuel / Autonome SYNCHRONISÉ avec jdm_jarvis_config
     · fermeture discrète → se replie en un petit robot (clin d'œil) qu'on
       reclique pour rouvrir.
   Module à scope isolé (chargé avant bundle.jsx). Expose window.JarvisBanner.
   ────────────────────────────────────────────────────────────────────── */
(function () {
const { useRef, useEffect, useState, useCallback } = React;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Rendu markdown des réponses du robot (gras, listes, code, titres).
   Utilise `marked` déjà chargé globalement par index.html ; fallback
   sur un échappement texte brut si absent. */
function renderMd(text) {
  const src = text || '';
  try {
    if (window.marked) {
      const fn = window.marked.parse || window.marked;
      return fn(src, { breaks: true });
    }
  } catch (e) {}
  // Fallback : échappe le HTML et préserve les sauts de ligne.
  return src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}
const JDMC = ['#E63B7A', '#5FB94A', '#F5C518', '#2BB8D4', '#8A5CD4', '#F47B20'];
const ri = (n) => (Math.random() * n) | 0;

function _hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _mix(h, t, to) { const a = _hx(h); return `rgb(${Math.round(a[0] + (to[0] - a[0]) * t)},${Math.round(a[1] + (to[1] - a[1]) * t)},${Math.round(a[2] + (to[2] - a[2]) * t)})`; }
const lighten = (h, t) => _mix(h, t, [255, 255, 255]);
const darken = (h, t) => _mix(h, t, [8, 10, 14]);

function placeTail(B, rx, ry) {
  const bcx = B.left + B.bw / 2, bcy = B.top + B.bh / 2;
  let vx = rx - bcx, vy = ry - bcy; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
  const ex = bcx + vx * (B.bw * 0.42), ey = bcy + vy * (B.bh * 0.46);
  B.dots.forEach((o) => {
    const px = ex + vx * o.dist, py = ey + vy * o.dist;
    o.el.style.left = (px - B.left - o.rad).toFixed(1) + 'px';
    o.el.style.top = (py - B.top - o.rad).toFixed(1) + 'px';
  });
}

/* ── pensées compactes (bulles courtes seulement) ──────────────────── */
const TRIPLETS = [
  ['chat', 'r_isa', 'animal'], ['pomme', 'r_isa', 'fruit'], ['soleil', 'r_carac', 'chaud'],
  ['oiseau', 'r_agent', 'voler'], ['mer', 'r_carac', 'salé'], ['rose', 'r_color', 'rouge'],
  ['abeille', 'r_agent', 'butiner'], ['poisson', 'r_lieu', 'eau'], ['paris', 'r_isa', 'ville'],
];
function gTriplet(accent) {
  const [s, r, o] = TRIPLETS[ri(TRIPLETS.length)];
  return { expr: 'baby', kind: 'triplet',
    html: `<span>${s}</span><i>│</i><b style="color:${accent}">${r}</b><i>│</i><span>${o}</span>` };
}
function bulbSVG(c) {
  return `<svg width="15" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10c.5.5 1 1.2 1 2h6c0-.8.5-1.5 1-2a6 6 0 0 0-4-10Z"/></svg>`;
}
function lensSVG(c) {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20.5" y2="20.5"/></svg>`;
}

/* ── graphes JDM animés : chemins, réseaux, dessins, routes ─────────── */
const CHAINS = [
  { n: ['baleine', 'mammifère', 'animal'], r: ['r_isa', 'r_isa'] },
  { n: ['rose', 'fleur', 'parfum'], r: ['r_isa', 'r_carac'] },
  { n: ['chat', 'félin', 'chasseur'], r: ['r_isa', 'r_carac'] },
  { n: ['paris', 'ville', 'france'], r: ['r_isa', 'r_lieu'] },
  { n: ['abeille', 'insecte', 'miel'], r: ['r_isa', 'r_telic'] },
];
const STARS = [
  { c: 'pomme', l: [['r_isa', 'fruit'], ['r_carac', 'rouge'], ['r_has_part', 'pépin'], ['r_agent', 'croquer']] },
  { c: 'chat', l: [['r_isa', 'animal'], ['r_carac', 'agile'], ['r_agent', 'miauler'], ['r_assoc', 'souris']] },
  { c: 'soleil', l: [['r_carac', 'chaud'], ['r_isa', 'étoile'], ['r_assoc', 'été'], ['r_color', 'jaune']] },
];
function gChain(accent) {
  const c = CHAINS[ri(CHAINS.length)];
  const h = 42, cy = 22, GAP = 50;
  const pos = []; let x = 2;
  c.n.forEach((w) => { const ww = w.length * 6.2 + 16; pos.push({ x, w: ww }); x += ww + GAP; });
  const W = x - GAP + 4;
  const SC = 0.7; let s = `<svg width="${Math.round(W * SC)}" height="${Math.round(h * SC)}" viewBox="0 0 ${Math.round(W)} ${h}">`;
  for (let i = 0; i < c.n.length - 1; i++) {
    const x1 = pos[i].x + pos[i].w, x2 = pos[i + 1].x, mid = (x1 + x2) / 2, t = (i * 2 + 1) * 0.34;
    s += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="currentColor" stroke-opacity="0" stroke-width="1.4"><animate attributeName="stroke-opacity" values="0;0.4" dur="0.3s" begin="${t}s" fill="freeze"/></line>`;
    s += `<path d="M${x2 - 5} ${cy - 3} L${x2} ${cy} L${x2 - 5} ${cy + 3}" fill="none" stroke="currentColor" stroke-opacity="0" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><animate attributeName="stroke-opacity" values="0;0.5" dur="0.3s" begin="${t}s" fill="freeze"/></path>`;
    s += `<text x="${mid}" y="${cy - 5}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="7.5" fill="${accent}" opacity="0">${c.r[i]}<animate attributeName="opacity" values="0;0.95" dur="0.3s" begin="${t + 0.1}s" fill="freeze"/></text>`;
  }
  c.n.forEach((w, i) => {
    const p = pos[i], col = JDMC[i % JDMC.length], t = i * 0.68;
    s += `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="${t}s" fill="freeze"/><rect x="${p.x}" y="${cy - 9}" width="${p.w}" height="18" rx="9" fill="${col}"/><text x="${p.x + p.w / 2}" y="${cy + 3}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="600" font-size="8.5" fill="#0c0e12">${w}</text></g>`;
  });
  return { expr: 'thinking', kind: 'chain', html: s + '</svg>' };
}
function gStar(accent) {
  const st = STARS[ri(STARS.length)];
  const W = 168, H = 92, cx = 84, cy = 46;
  const slots = [[26, 19], [142, 21], [24, 74], [144, 72]];
  const SC = 0.7; let s = `<svg width="${Math.round(W * SC)}" height="${Math.round(H * SC)}" viewBox="0 0 ${W} ${H}">`;
  st.l.forEach((leaf, i) => {
    const [rl, w] = leaf, lx = slots[i][0], ly = slots[i][1], t = 0.4 + i * 0.42;
    s += `<line x1="${cx}" y1="${cy}" x2="${lx}" y2="${ly}" stroke="currentColor" stroke-opacity="0" stroke-width="1.3"><animate attributeName="stroke-opacity" values="0;0.4" dur="0.3s" begin="${t}s" fill="freeze"/></line>`;
    s += `<text x="${(cx + lx) / 2}" y="${(cy + ly) / 2 - 3}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="7" fill="${accent}" opacity="0">${rl}<animate attributeName="opacity" values="0;0.85" dur="0.3s" begin="${t + 0.1}s" fill="freeze"/></text>`;
    const ww = w.length * 5.6 + 12;
    s += `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="${t + 0.15}s" fill="freeze"/><rect x="${lx - ww / 2}" y="${ly - 8}" width="${ww}" height="16" rx="8" fill="${JDMC[(i + 1) % JDMC.length]}"/><text x="${lx}" y="${ly + 2.6}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="600" font-size="7.6" fill="#0c0e12">${w}</text></g>`;
  });
  const cw = st.c.length * 6.4 + 16;
  s += `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.3s" begin="0s" fill="freeze"/><rect x="${cx - cw / 2}" y="${cy - 10}" width="${cw}" height="20" rx="10" fill="#15151c" stroke="${accent}" stroke-width="1.4"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="9" fill="${accent}">${st.c}</text></g>`;
  return { expr: 'baby', kind: 'star', html: s + '</svg>' };
}
function gMesh() {
  const W = 134, H = 74, N = 6 + ri(2);
  const pts = [];
  for (let i = 0; i < N; i++) pts.push([14 + Math.random() * (W - 28), 12 + Math.random() * (H - 24)]);
  const SC = 0.7; let s = `<svg width="${Math.round(W * SC)}" height="${Math.round(H * SC)}" viewBox="0 0 ${W} ${H}">`;
  const edges = [];
  for (let i = 0; i < N; i++) { const j = (i + 1 + ri(N - 1)) % N; edges.push([i, j]); }
  edges.forEach((e, i) => {
    s += `<line x1="${pts[e[0]][0].toFixed(1)}" y1="${pts[e[0]][1].toFixed(1)}" x2="${pts[e[1]][0].toFixed(1)}" y2="${pts[e[1]][1].toFixed(1)}" stroke="currentColor" stroke-opacity="0" stroke-width="1"><animate attributeName="stroke-opacity" values="0;0.3" dur="0.3s" begin="${0.2 + i * 0.08}s" fill="freeze"/></line>`;
  });
  const order = [...Array(N).keys()].sort(() => Math.random() - 0.5).slice(0, 4);
  const d = order.map((k, i) => `${i ? 'L' : 'M'}${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)}`).join(' ');
  s += `<path d="${d}" fill="none" stroke="#2BD4C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="240" stroke-dashoffset="240"><animate attributeName="stroke-dashoffset" values="240;0" dur="1.1s" begin="0.6s" fill="freeze"/></path>`;
  pts.forEach((p, i) => {
    s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="0" fill="${JDMC[i % JDMC.length]}" stroke="#0c0e12" stroke-width="0.8"><animate attributeName="r" values="0;3.6" dur="0.3s" begin="${i * 0.1}s" fill="freeze"/></circle>`;
  });
  return { expr: 'thinking', kind: 'mesh', html: s + '</svg>' };
}
function pickThought(accent) {
  const x = Math.random();
  if (x < 0.26) return gChain(accent);            // chemins / inférence
  if (x < 0.50) return gMesh();                    // réseaux / routes (parcours tracé)
  if (x < 0.66) return gStar(accent);              // dessins / étoile de relations
  if (x < 0.80) return gTriplet(accent);
  if (x < 0.90) return { expr: 'eureka', kind: 'idea', html: bulbSVG(accent) + `<span class="jb-spark" style="color:${accent}">!</span>` };
  if (x < 0.96) return { expr: 'thinking', kind: 'search', html: lensSVG(accent) + `<span class="jb-dots">…</span>` };
  return { expr: 'curious', kind: 'q', html: `<span class="jb-qm">?</span>` };
}

/* ── Le robot (roam + grimaces) ─────────────────────────────────────── */
function Robot({ mode, dark, speedPct, sizePx, expressivity, freq, manualExpr }) {
  const wrapRef = useRef(null);
  const robotRef = useRef(null);
  const r = useRef({});
  const live = useRef({ x: 200, y: 80, sh: 70, sw: 56 });
  const boundRef = useRef({ lb: 36, lb2: 36, upMaxY: 999 });
  const bubblesRef = useRef([]);
  const stateRef = useRef({});
  const [expr, setExpr] = useState(manualExpr || 'baby');
  stateRef.current = { mode, speedPct, sizePx, expressivity, freq, expr };

  useEffect(() => {
    const wrap = wrapRef.current, robot = robotRef.current;
    const puffs = [];
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'jb-puff'; wrap.appendChild(d); puffs.push({ el: d, life: 0, max: 1 }); }
    let puffIx = 0, puffCd = 0;
    const A = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, phase: 0, t: 0, last: performance.now(),
      dir: 1, lean: 0, bob: 0, mouse: { x: 0, y: 0, on: false }, nextWp: 0, nextBlink: 2,
      blink: { on: false, s: 0 }, pup: { x: 0, y: 0 }, waveAt: 3, waveOn: false, waveS: 0 };
    const r0 = wrap.getBoundingClientRect();
    A.x = r0.width * 0.6; A.y = r0.height * 0.6; A.tx = A.x; A.ty = A.y;
    { const sw0 = stateRef.current.sizePx, sh0 = sw0 * 150 / 120;
      robot.style.width = sw0 + 'px';
      robot.style.transform = `translate(${(A.x - sw0 * 0.5).toFixed(1)}px, ${(A.y - sh0 * 0.95).toFixed(1)}px)`; }

    const onMove = (e) => { const b = wrap.getBoundingClientRect(); A.mouse.x = e.clientX - b.left; A.mouse.y = e.clientY - b.top; A.mouse.on = true; };
    const onLeave = () => { A.mouse.on = false; };
    const layer = wrap.closest('.jb-layer');
    const host = (layer && layer.parentElement) || layer || wrap;
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    // borne gauche du robot = bord droit du texte (titre « Tableau de bord »
    // + description) → le robot ne passe JAMAIS sous le texte.
    const measureBound = () => {
      try {
        const fb = wrap.getBoundingClientRect();
        const h1 = host.querySelector('h1'), p = host.querySelector('p');
        const textRight = (el) => {
          if (!el) return fb.left;
          const rg = document.createRange(); rg.selectNodeContents(el);
          const rb = rg.getBoundingClientRect();
          return rb.right || el.getBoundingClientRect().right;
        };
        const titleRight = h1 ? textRight(h1) - fb.left : fb.width * 0.4;
        const descRight = p ? textRight(p) - fb.left : titleRight;
        const titleBottom = h1 ? (h1.getBoundingClientRect().bottom - fb.top) : 84;
        boundRef.current = {
          lb: Math.max(36, titleRight + 18),   // limite gauche = le « d » de bord (extent réel du texte)
          lb2: Math.max(36, descRight + 18),   // au-delà : pleine hauteur (sous la description)
          upMaxY: titleBottom + 6,             // bande haute = à côté du titre, au-dessus du texte
        };
      } catch (e) {}
    };
    measureBound();
    // Position de repos = juste à droite du titre « Tableau de bord »,
    // alignée comme en mode fermé (et non plus au centre-droit du bandeau).
    const homePos = () => {
      const B = boundRef.current;
      if (!B) return;
      const fw = wrap.getBoundingClientRect().width || r0.width;
      const sw0 = stateRef.current.sizePx;
      A.x = A.tx = Math.min(B.lb + sw0 * 0.5, fw - 30);
      A.y = A.ty = Math.max(stateRef.current.sizePx * 150 / 120 * 0.95, B.upMaxY - 2);
    };
    homePos();
    { const sw0 = stateRef.current.sizePx, sh0 = sw0 * 150 / 120;
      robot.style.transform = `translate(${(A.x - sw0 * 0.5).toFixed(1)}px, ${(A.y - sh0 * 0.95).toFixed(1)}px)`; }
    const reHome = () => { if (!auto && !A.mouse.on) homePos(); };
    const bt1 = setTimeout(() => { measureBound(); reHome(); }, 300),
          bt2 = setTimeout(() => { measureBound(); reHome(); }, 1200);
    const onResizeHome = () => { measureBound(); reHome(); };
    window.addEventListener('resize', onResizeHome);
    const setT = (k, t) => { if (r.current[k]) r.current[k].setAttribute('transform', t); };

    let raf;
    const tick = (now) => {
      try {
        const dt = Math.min(0.045, (now - A.last) / 1000); A.last = now; A.t += dt;
        const S = stateRef.current, auto = S.mode === 'auto';
        const b = wrap.getBoundingClientRect(); const W = b.width, H = b.height;
        const sw = S.sizePx, sh = sw * 150 / 120;
        const mx = 36, myTop = Math.max(sh, 62), myBot = 56;
        const B = boundRef.current || { lb: mx, lb2: mx, upMaxY: H };
        const lb = Math.max(mx, Math.min(B.lb, W - mx - 60));
        const lb2 = Math.max(lb, Math.min(B.lb2, W - mx - 8));
        const lowMaxY = H - myBot;
        const upMaxY = Math.min(lowMaxY, Math.max(myTop + 6, B.upMaxY));
        const yMaxFor = (tx) => (tx < lb2 ? upMaxY : lowMaxY);
        const xv = (S.expressivity || 120) / 100;

        if (auto) { if (A.t > A.nextWp) { A.tx = lb + Math.random() * (W - mx - lb); A.ty = myTop + Math.random() * (yMaxFor(A.tx) - myTop); A.nextWp = A.t + 0.5 + Math.random() * 1.4; } }
        else if (A.mouse.on) { A.tx = clamp(A.mouse.x, lb, W - mx); A.ty = clamp(A.mouse.y, myTop, yMaxFor(A.tx)); }
        else { A.tx = A.x; A.ty = A.y; }   // manuel + souris hors zone → reste statique (idle : salut + clignement)

        const maxV = (auto ? 300 : 280) * (S.speedPct / 100);
        const dx = A.tx - A.x, dy = A.ty - A.y, dist = Math.hypot(dx, dy) || 1;
        let desVX = 0, desVY = 0;
        if (dist > 18) { const sp = dist < 110 ? maxV * (dist / 110) : maxV; desVX = dx / dist * sp; desVY = dy / dist * sp; }
        A.vx += (desVX - A.vx) * (1 - Math.exp(-dt * 9)); A.vy += (desVY - A.vy) * (1 - Math.exp(-dt * 9));
        A.x += A.vx * dt; A.y += A.vy * dt;
        A.x = clamp(A.x, lb, W - mx); A.y = clamp(A.y, myTop, yMaxFor(A.x));
        const speed = Math.hypot(A.vx, A.vy), running = speed > 24;

        if (Math.abs(A.vx) > 12) A.dir += ((A.vx < 0 ? -1 : 1) - A.dir) * (1 - Math.exp(-dt * 12));
        const leanTarget = clamp(A.vx / maxV, -1, 1) * 9 * (A.dir < 0 ? -1 : 1);
        A.lean += (leanTarget - A.lean) * (1 - Math.exp(-dt * 8));

        const freqR = running ? 4 + (speed / maxV) * 13 : 0;
        A.phase += dt * freqR;
        const ls = running ? Math.sin(A.phase * Math.PI * 2) : 0;
        const ls2 = running ? Math.sin(A.phase * Math.PI * 2 + Math.PI) : 0;
        const hop = running ? Math.abs(Math.sin(A.phase * Math.PI * 2)) * 4 * (0.7 + 0.5 * xv) : 0;
        const idleB = running ? 0 : Math.sin(A.t * 2.2) * 1.4 * xv;
        A.bob = -hop + idleB;

        const look = auto ? { x: dx, y: dy } : (A.mouse.on ? { x: A.mouse.x - A.x, y: A.mouse.y - A.y } : { x: dx, y: dy });
        const ln = Math.hypot(look.x, look.y) || 1;
        A.pup.x += (clamp(look.x / ln, -1, 1) * 2.4 * (A.dir < 0 ? -1 : 1) - A.pup.x) * (1 - Math.exp(-dt * 10));
        A.pup.y += (clamp(look.y / ln, -1, 1) * 2.0 - A.pup.y) * (1 - Math.exp(-dt * 10));

        let eyeS = 1;
        if (!A.blink.on && A.t > A.nextBlink) { A.blink.on = true; A.blink.s = A.t; }
        if (A.blink.on) { const p = A.t - A.blink.s; if (p < 0.06) eyeS = 1 - p / 0.06; else if (p < 0.12) eyeS = (p - 0.06) / 0.06; else { eyeS = 1; A.blink.on = false; A.nextBlink = A.t + 1.8 + Math.random() * 3.2; } }

        let armLa, armRa;
        if (running) { armLa = ls2 * 22 * xv; armRa = ls * 22 * xv; }
        else {
          const sway = Math.sin(A.t * 1.8) * 8 * xv;
          armLa = sway; armRa = -sway;
          if (S.expr === 'eureka') { armLa = -62; armRa = 62; }
          else if (S.expr === 'thinking') { armRa = -50; armLa = sway * 0.4; }
          else if (S.expr === 'curious') { armLa = 22; armRa = -22; }
          if (A.t > A.waveAt && S.expr !== 'eureka') { A.waveOn = true; A.waveS = A.t; A.waveAt = A.t + 5 + Math.random() * 5; }
          if (A.waveOn) { const p = A.t - A.waveS; if (p < 1.2) armRa = -48 + Math.sin(p * 19) * 24 * xv; else A.waveOn = false; }
        }

        robot.style.transform = `translate(${(A.x - sw * 0.5).toFixed(1)}px, ${(A.y - sh * 0.95).toFixed(1)}px)`;
        robot.style.width = sw + 'px';
        live.current = { x: A.x, y: A.y, sh, sw };
        const rty = A.y - sh * 0.5;
        for (const B of bubblesRef.current) placeTail(B, A.x, rty);
        setT('lean', `rotate(${A.lean.toFixed(2)} 60 140)`);
        setT('face', `translate(60 0) scale(${A.dir.toFixed(3)} 1) translate(-60 0)`);
        setT('bob', `translate(0 ${A.bob.toFixed(2)})`);
        setT('legL', `translate(0 ${(-ls * 3).toFixed(2)}) rotate(${(ls * 16).toFixed(1)} 50 116)`);
        setT('legR', `translate(0 ${(-ls2 * 3).toFixed(2)}) rotate(${(ls2 * 16).toFixed(1)} 70 116)`);
        setT('armL', `rotate(${armLa.toFixed(1)} 36 92)`);
        setT('armR', `rotate(${armRa.toFixed(1)} 84 92)`);
        setT('ant', `rotate(${(A.lean * 0.6 + ls * 4).toFixed(2)} 60 40)`);
        setT('pupils', `translate(${A.pup.x.toFixed(2)} ${A.pup.y.toFixed(2)})`);
        setT('eyes', `translate(60 46) scale(1 ${eyeS.toFixed(3)}) translate(-60 -46)`);

        puffCd -= dt;
        if (running && speed > maxV * 0.45 && puffCd <= 0) {
          const p = puffs[puffIx % puffs.length]; puffIx++; puffCd = 0.09;
          p.life = 1; p.max = 0.5 + Math.random() * 0.2;
          p.el.style.left = (A.x - A.dir * sw * 0.12 - 5) + 'px'; p.el.style.top = (A.y - 5) + 'px';
        }
        puffs.forEach((p) => {
          if (p.life > 0) { p.life -= dt / p.max; const k = Math.max(0, p.life);
            p.el.style.opacity = (k * 0.45).toFixed(3);
            p.el.style.transform = `translate(${((1 - k) * -9).toFixed(1)}px, ${((1 - k) * -7).toFixed(1)}px) scale(${(0.5 + (1 - k) * 1.0).toFixed(2)})`;
          } else if (p.el.style.opacity !== '0') p.el.style.opacity = '0';
        });
        raf = requestAnimationFrame(tick);
      } catch (err) { console.error('[jb-robot]', err); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); host.removeEventListener('mousemove', onMove); host.removeEventListener('mouseleave', onLeave); window.removeEventListener('resize', onResizeHome); clearTimeout(bt1); clearTimeout(bt2); puffs.forEach((p) => p.el.remove()); };
  }, []);

  /* grimaces + pensées (mode autonome) */
  useEffect(() => {
    if (mode !== 'auto') { setExpr(manualExpr || 'baby'); return; }
    let alive = true; const timers = [];
    const cycle = () => {
      if (!alive) return;
      const th = pickThought('#2BD4C0');
      setExpr(th.expr);
      const field = wrapRef.current;
      if (field) {
        field.querySelectorAll('.jb-thought').forEach((n) => n.remove());
        bubblesRef.current = [];
        const d = document.createElement('div');
        d.className = 'jb-thought jb-thought--' + th.kind; d.innerHTML = th.html;
        d.style.visibility = 'hidden';
        field.appendChild(d);
        const W = field.clientWidth, H = field.clientHeight;
        const bw = d.offsetWidth, bh = d.offsetHeight;
        const pad = 8, gap = 10, rise = 10, tail = 16;
        const cx = live.current.x;
        const headTop = live.current.y - live.current.sh * 0.83;
        let left = cx - bw / 2;
        let top = headTop - gap - bh;
        if (top < pad + rise) {
          top = live.current.y - live.current.sh * 0.55;
          left = cx + live.current.sw * 0.42;
          if (left + bw + pad > W) left = cx - live.current.sw * 0.42 - bw;
        }
        left = clamp(left, pad, W - bw - pad);
        top = clamp(top, pad, H - bh - pad - tail);
        d.style.left = left + 'px'; d.style.top = top + 'px';

        const dotBg = getComputedStyle(d).backgroundColor;
        const B = { el: d, left, top, bw, bh, dots: [] };
        [[10, 5.2], [19, 3.4], [27, 2.3]].forEach(([dist, rad]) => {
          const dot = document.createElement('div');
          dot.className = 'jb-tdot';
          dot.style.cssText = `position:absolute;border-radius:50%;background:${dotBg};width:${rad * 2}px;height:${rad * 2}px;`;
          d.appendChild(dot);
          B.dots.push({ el: dot, rad, dist });
        });
        placeTail(B, live.current.x, live.current.y - live.current.sh * 0.5);
        bubblesRef.current.push(B);
        d.style.visibility = '';
        setTimeout(() => {
          d.remove();
          const ix = bubblesRef.current.indexOf(B);
          if (ix >= 0) bubblesRef.current.splice(ix, 1);
        }, 2800);
      }
      const f = (stateRef.current.freq || 110) / 100;
      timers.push(setTimeout(cycle, (1700 + Math.random() * 1500) / f));
    };
    timers.push(setTimeout(cycle, 600));
    return () => { alive = false; timers.forEach(clearTimeout); setExpr(manualExpr || 'baby');
      bubblesRef.current = [];
      if (wrapRef.current) wrapRef.current.querySelectorAll('.jb-thought').forEach((n) => n.remove()); };
  }, [mode, manualExpr]);

  const accent = mode === 'auto' ? '#2BD4C0' : '#FFC93C';
  const ref = (k) => (el) => { r.current[k] = el; };

  const glow = (cx) => <ellipse cx={cx} cy="45" rx="12" ry="12" fill="url(#jbeyeGlow)" />;
  const glassEye = (cx) => <>
    <rect x={cx - 5.5} y="38" width="11" height="15" rx="5.5" fill="url(#jbeyeFill)" />
    <ellipse cx={cx - 1.6} cy="42" rx="3.4" ry="2.3" fill="#fff" opacity="0.55" /></>;
  const glassCircle = (cx, rr) => <>
    <circle cx={cx} cy="45" r={rr} fill="url(#jbeyeFill)" />
    <ellipse cx={cx - rr * 0.32} cy={45 - rr * 0.34} rx={rr * 0.42} ry={rr * 0.28} fill="#fff" opacity="0.5" /></>;
  const star = (cx, cy, s) => <>
    <path d={`M${cx} ${cy - s} L${cx + s * 0.28} ${cy - s * 0.28} L${cx + s} ${cy} L${cx + s * 0.28} ${cy + s * 0.28} L${cx} ${cy + s} L${cx - s * 0.28} ${cy + s * 0.28} L${cx - s} ${cy} L${cx - s * 0.28} ${cy - s * 0.28} Z`} fill="url(#jbeyeFill)" stroke={accent} strokeWidth="0.6" />
    <circle cx={cx - s * 0.18} cy={cy - s * 0.18} r="1.5" fill="#fff" opacity="0.85" /></>;
  const closedEye = (cx) => <path d={`M${cx - 7} 44 q7 7 14 0`} fill="none" stroke={accent} strokeWidth="3.4" strokeLinecap="round" />;
  const pupilDots = (xs) => <g ref={ref('pupils')}>{xs.map((cx, i) => <circle key={i} cx={cx} cy="47.5" r="1.9" fill="#fff" opacity="0.9" />)}</g>;
  const babyEyes = <>
    <ellipse cx="50" cy="46" rx="9" ry="10.5" fill="#fdfbf7" />
    <ellipse cx="70" cy="46" rx="9" ry="10.5" fill="#fdfbf7" />
    <g ref={ref('pupils')}><circle cx="50" cy="47" r="6" fill="url(#jbeyeFill)" /><circle cx="70" cy="47" r="6" fill="url(#jbeyeFill)" />
      <circle cx="50" cy="48" r="3" fill="#241c2e" /><circle cx="70" cy="48" r="3" fill="#241c2e" />
      <circle cx="47.8" cy="45" r="2.5" fill="#fff" /><circle cx="67.8" cy="45" r="2.5" fill="#fff" />
      <circle cx="52" cy="49.5" r="1.2" fill="#fff" opacity="0.85" /><circle cx="72" cy="49.5" r="1.2" fill="#fff" opacity="0.85" />
    </g></>;

  let eyesJSX;
  if (expr === 'baby') eyesJSX = babyEyes;
  else if (expr === 'starry' || expr === 'eureka') eyesJSX = <>{star(50, 44, 8.6)}{star(70, 44, 8.6)}</>;
  else if (expr === 'thinking') eyesJSX = <>
    <path d="M44 46 q6 -7 12 0" fill="none" stroke={accent} strokeWidth="3.6" strokeLinecap="round" />
    <path d="M64 46 q6 -7 12 0" fill="none" stroke={accent} strokeWidth="3.6" strokeLinecap="round" /></>;
  else if (expr === 'curious') eyesJSX = <>{glow(50)}{glow(70)}{glassCircle(50, 7.5)}{glassCircle(70, 7.5)}{pupilDots([50, 70])}</>;
  else if (expr === 'closed') eyesJSX = <>{closedEye(50)}{closedEye(70)}</>;
  else if (expr === 'wink') eyesJSX = <>{closedEye(50)}{glow(70)}{glassEye(70)}{pupilDots([70])}</>;
  else eyesJSX = <>{glow(50)}{glow(70)}{glassEye(50)}{glassEye(70)}{pupilDots([50, 70])}</>;

  let mouthJSX;
  if (expr === 'baby') mouthJSX = <path d="M55 56 q5 4.5 10 0" fill="none" stroke="#d05a86" strokeWidth="2.2" strokeLinecap="round" />;
  else if (expr === 'eureka') mouthJSX = <path d="M53 54 q7 7 14 0 q-7 2 -14 0 Z" fill={accent} opacity="0.9" />;
  else if (expr === 'thinking') mouthJSX = <circle cx="60" cy="56" r="2.3" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.7" />;
  else if (expr === 'curious') mouthJSX = <path d="M55 56 q2.5 2.5 5 0 q2.5 -2.5 5 0" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />;
  else mouthJSX = <path d="M53 55 q7 5 14 0" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.8" />;

  return (
    <div className="jb-robot-field" ref={wrapRef}>
      <div className="jb-robot" ref={robotRef}>
        <svg viewBox="0 0 120 150" width="100%" style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            <linearGradient id="jbbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#f3eee2" /><stop offset="1" stopColor="#dcd4c4" /></linearGradient>
            <linearGradient id="jbmetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eceadf" /><stop offset="1" stopColor="#c4bcab" /></linearGradient>
            <linearGradient id="jbvisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#33353f" /><stop offset="0.5" stopColor="#1a1b22" /><stop offset="1" stopColor="#0b0c10" /></linearGradient>
            <linearGradient id="jbjdm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E63B7A" /><stop offset="0.25" stopColor="#F5C518" /><stop offset="0.5" stopColor="#5FB94A" /><stop offset="0.75" stopColor="#2BB8D4" /><stop offset="1" stopColor="#8A5CD4" /></linearGradient>
            <radialGradient id="jbeyeGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={accent} stopOpacity="0.6" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
            <linearGradient id="jbonesie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eaf7fa" /><stop offset="1" stopColor="#bfe3ec" /></linearGradient>
            <linearGradient id="jbeyeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={lighten(accent, 0.6)} />
              <stop offset="0.45" stopColor={accent} />
              <stop offset="1" stopColor={darken(accent, 0.42)} />
            </linearGradient>
          </defs>

          <ellipse cx="60" cy="128" rx="24" ry="5" fill="#000" opacity={dark ? 0.36 : 0.15} />

          <g ref={ref('lean')}>
            <g ref={ref('face')}>
              <g ref={ref('bob')}>
                <g ref={ref('legL')}><rect x="47" y="102" width="11" height="15" rx="5.5" fill="url(#jbmetal)" /><ellipse cx="52.5" cy="115" rx="6.5" ry="2.4" fill="#fff" opacity="0.4" /></g>
                <g ref={ref('legR')}><rect x="62" y="102" width="11" height="15" rx="5.5" fill="url(#jbmetal)" /><ellipse cx="67.5" cy="115" rx="6.5" ry="2.4" fill="#fff" opacity="0.4" /></g>
                <g ref={ref('armL')}><circle cx="30" cy="90" r="7" fill="url(#jbbody)" stroke="rgba(40,32,22,0.10)" strokeWidth="1.2" /></g>
                <g ref={ref('armR')}><circle cx="90" cy="90" r="7" fill="url(#jbbody)" stroke="rgba(40,32,22,0.10)" strokeWidth="1.2" /></g>

                <rect x="43" y="72" width="34" height="34" rx="17" fill="url(#jbonesie)" stroke="rgba(31,151,177,0.20)" strokeWidth="1.4" />
                <ellipse cx="60" cy="79" rx="11" ry="4.5" fill="#ffffff" opacity="0.4" />
                <circle cx="60" cy="83" r="1.9" fill="#E63B7A" /><circle cx="60" cy="90" r="1.9" fill="#F5C518" /><circle cx="60" cy="97" r="1.9" fill="#5FB94A" />

                <g>
                  <rect x="26" y="12" width="68" height="62" rx="24" fill="url(#jbbody)" stroke="rgba(40,32,22,0.12)" strokeWidth="1.5" />
                  <ellipse cx="60" cy="22" rx="24" ry="6" fill="#ffffff" opacity="0.45" />
                  <rect x="20" y="38" width="8" height="18" rx="4" fill="url(#jbmetal)" stroke="rgba(40,32,22,0.12)" strokeWidth="1" />
                  <circle cx="24" cy="47" r="2" fill="#E63B7A" />
                  <rect x="92" y="38" width="8" height="18" rx="4" fill="url(#jbmetal)" stroke="rgba(40,32,22,0.12)" strokeWidth="1" />
                  <circle cx="96" cy="47" r="2" fill="#2BB8D4" />
                  <circle cx="34" cy="20" r="1.4" fill="rgba(40,32,22,0.25)" /><circle cx="86" cy="20" r="1.4" fill="rgba(40,32,22,0.25)" />
                  <g ref={ref('ant')}>
                    <line x1="60" y1="12" x2="60" y2="5" stroke="#b8b0a0" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="60" cy="3.5" r="3.4" fill={accent}>
                      {mode === 'auto'
                        ? <animate attributeName="fill" values="#E63B7A;#F5C518;#5FB94A;#2BB8D4;#8A5CD4;#E63B7A" dur="6s" repeatCount="indefinite" />
                        : <animate attributeName="r" values="3.1;4;3.1" dur="1.5s" repeatCount="indefinite" />}
                    </circle>
                  </g>
                  <text x="54" y="24.2" textAnchor="middle" fontFamily="'Lilita One',system-ui" fontSize="7.6" fill="#c83a73">j</text>
                  <text x="60" y="24.2" textAnchor="middle" fontFamily="'Lilita One',system-ui" fontSize="7.6" fill="#4ea63c">d</text>
                  <text x="66" y="24.2" textAnchor="middle" fontFamily="'Lilita One',system-ui" fontSize="7.6" fill="#1f97b1">m</text>
                  <rect x="31" y="27" width="58" height="38" rx="17" fill="url(#jbjdm)" opacity="0.95" />
                  <rect x="33.5" y="29.5" width="53" height="33" rx="15" fill="url(#jbvisor)" />
                  <rect x="37" y="31" width="46" height="9" rx="4.5" fill="#ffffff" opacity="0.06" />
                  <circle cx="40" cy="57" r="3" fill="#F2A05A" opacity="0.5" /><circle cx="80" cy="57" r="3" fill="#F2A05A" opacity="0.5" />
                  <g ref={ref('eyes')}>{eyesJSX}</g>
                  {mouthJSX}
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

/* ── Mini robot statique (état replié) ───────────────────────────────
   awake=false → en veille : yeux fermés (deux traits), pas de radiations.
   awake=true  → mode autonome : yeux ouverts qui clignent + belles
   ondes qui pulsent depuis le centre de la tête. */
function MiniRobot({ dark, awake }) {
  const accent = '#2BD4C0';
  const cx = 40, cy = 39; // centre de la tête (visière)
  return (
    <svg className="jb-mini-svg" viewBox="0 0 80 74" width="38" height="35" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="jbmbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#f3eee2" /><stop offset="1" stopColor="#dcd4c4" /></linearGradient>
        <linearGradient id="jbmjdm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E63B7A" /><stop offset="0.25" stopColor="#F5C518" /><stop offset="0.5" stopColor="#5FB94A" /><stop offset="0.75" stopColor="#2BB8D4" /><stop offset="1" stopColor="#8A5CD4" /></linearGradient>
        <linearGradient id="jbmvisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#33353f" /><stop offset="0.5" stopColor="#1a1b22" /><stop offset="1" stopColor="#0b0c10" /></linearGradient>
      </defs>

      <line x1="40" y1="14" x2="40" y2="6" stroke="#b8b0a0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="4.5" r="3" fill={accent}>
        {awake
          ? <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite" />
          : <animate attributeName="opacity" values="0.18;0.32;0.18" dur="4s" repeatCount="indefinite" />}
      </circle>
      <rect x="14" y="14" width="52" height="48" rx="19" fill="url(#jbmbody)" stroke="rgba(40,32,22,0.14)" strokeWidth="1.4" />
      <rect x="10" y="32" width="6" height="14" rx="3" fill="#cfc8b8" />
      <rect x="64" y="32" width="6" height="14" rx="3" fill="#cfc8b8" />
      <rect x="20" y="25" width="40" height="28" rx="13" fill="url(#jbmjdm)" opacity="0.95" />
      <rect x="22" y="27" width="36" height="24" rx="11" fill="url(#jbmvisor)" />

      {awake ? (
        <g className="jb-mini-eyes">
          <circle cx="33" cy="39" r="4.4" fill={accent} />
          <circle cx="47" cy="39" r="4.4" fill={accent} />
          <circle cx="31.5" cy="37.5" r="1.4" fill="#fff" opacity="0.85" />
          <circle cx="45.5" cy="37.5" r="1.4" fill="#fff" opacity="0.85" />
        </g>
      ) : (
        <g className="jb-mini-eyes-closed" stroke={accent} strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
          <path d="M28.5 39.5q4.5 3 9 0" fill="none" />
          <path d="M42.5 39.5q4.5 3 9 0" fill="none" />
        </g>
      )}
    </svg>
  );
}

/* ── mode de la mascotte ─────────────────────────────────────────────
   NOTE : dans cette branche, l'ancien réglage global jdm_jarvis_config
   (mode autonome/manuel) n'existe plus — les flux sont lancés au
   formulaire. Le toggle pilote donc le COMPORTEMENT DU ROBOT (autonome =
   il vadrouille et réfléchit ; manuel = il suit le curseur), mémorisé en
   local. À rebrancher sur un vrai réglage produit si besoin. */
/* Synchro avec la vraie config Jarvis (jdm_jarvis_config.mode) :
   modes réels = autonome / supervise / pasapas. Le toggle binaire mappe
   Autonome → 'autonome' ; Manuel → 'supervise' (en préservant 'pasapas'
   si déjà choisi dans le panneau Configuration). Lecture/écriture sur la
   même clé localStorage + miroir window.__JDM_JARVIS_CONFIG__. */
function readMode() {
  try {
    const live = window.__JDM_JARVIS_CONFIG__ && window.__JDM_JARVIS_CONFIG__.mode;
    if (live) return live;
    const raw = localStorage.getItem('jdm_jarvis_config');
    if (raw) { const c = JSON.parse(raw); if (c && c.mode) return c.mode; }
  } catch (e) {}
  return 'autonome';
}
function writeMode(next) {
  try {
    let cfg = {};
    const raw = localStorage.getItem('jdm_jarvis_config');
    if (raw) cfg = JSON.parse(raw) || {};
    cfg.mode = next;
    localStorage.setItem('jdm_jarvis_config', JSON.stringify(cfg));
    window.__JDM_JARVIS_CONFIG__ = cfg;
    window.dispatchEvent(new Event('__jdm_jarvis_config_changed'));
  } catch (e) {}
}

const BANNER_KEY = 'jdm_jarvis_banner_collapsed';

/* ── Panneau latéral de discussion avec Jarvis ───────────────────────
   Indépendant du mode (autonome/manuel) : c'est un overlay fixe à droite,
   refermable. Champ de saisie + bouton envoyer en bas. Tente d'utiliser
   window.claude.complete si dispo, sinon réponse locale gracieuse. */
/* ── Store de conversation — singleton module-level ────────────────────
   La discussion (msgs) et la requête en cours vivent ICI, pas dans le
   composant ChatPanel. Conséquence : fermer/rouvrir le panneau ne perd
   ni l'historique ni le stream en cours — le fetch SSE continue en tâche
   de fond et met à jour le store même panneau fermé ; à la réouverture,
   ChatPanel ré-affiche l'état courant. Persistance EN MÉMOIRE uniquement
   (pas de disque) : un rechargement de page repart à zéro, voulu. */
const JarvisChatStore = (function () {
  const GREETING = { who: 'bot', text: "Bonjour 👋 Je suis Jarvis. Pose-moi une question sur tes flux, tes triplets ou le graphe JDM." };
  let msgs = [GREETING];
  let busy = false;
  const listeners = new Set();
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (e) {} }); };

  const stripHtml = (s) => (s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const applyConfigPatch = (p) => {
    if (!p || !p.key) return;
    try {
      const raw = localStorage.getItem('jdm_jarvis_config');
      const c = raw ? JSON.parse(raw) : {};
      c[p.key] = p.value;
      localStorage.setItem('jdm_jarvis_config', JSON.stringify(c));
      window.__JDM_JARVIS_CONFIG__ = c;
      window.dispatchEvent(new CustomEvent('__jdm_jarvis_config_changed'));
    } catch (e) {}
  };

  const parseSSE = (raw) => {
    let event = 'message';
    const dataLines = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    let data = null;
    if (dataLines.length) { try { data = JSON.parse(dataLines.join('\n')); } catch (e) {} }
    return { event, data };
  };

  const setBot = (txt) => {
    const next = msgs.slice();
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].who === 'bot') { next[i] = { who: 'bot', text: txt }; break; }
    }
    msgs = next; emit();
  };

  async function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    const history = msgs.map((m) => ({
      role: m.who === 'me' ? 'user' : 'assistant', content: m.text || '',
    }));
    let cfg = {};
    try {
      cfg = window.__JDM_JARVIS_CONFIG__
        || JSON.parse(localStorage.getItem('jdm_jarvis_config') || '{}') || {};
    } catch (e) { cfg = {}; }
    msgs = [...msgs, { who: 'me', text }, { who: 'bot', text: '' }];
    busy = true; emit();
    let lastText = '';
    try {
      const res = await fetch('api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, config: cfg }),
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      const handle = (ev) => {
        if (!ev) return;
        if (ev.event === 'text' && ev.data && typeof ev.data.text === 'string') {
          lastText = stripHtml(ev.data.text); setBot(lastText || '…');
        } else if (ev.event === 'config_patch' && ev.data) {
          applyConfigPatch(ev.data);
        } else if (ev.event === 'viz' && ev.data && ev.data.term) {
          // Visualisation inline : bulle dédiée (iframe via /api/subgraph).
          // Insérée APRÈS la bulle bot courante (le texte continue de la
          // remplir au-dessus ; setBot vise toujours la dernière 'bot').
          msgs = [...msgs, { who: 'viz', viz: ev.data }]; emit();
        } else if (ev.event === 'error' && ev.data) {
          setBot('⚠️ ' + (ev.data.text || 'Erreur du moteur de discussion.'));
        }
      };
      const re = /\r\n\r\n|\n\n|\r\r/;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let mm;
        while ((mm = re.exec(buf)) !== null) {
          handle(parseSSE(buf.slice(0, mm.index)));
          buf = buf.slice(mm.index + mm[0].length);
        }
      }
      if (buf.trim()) handle(parseSSE(buf));
      if (!lastText) setBot('…');
    } catch (e) {
      setBot("Désolé, la connexion au moteur de discussion a échoué. Réessaie dans un instant.");
    } finally {
      busy = false; emit();
    }
  }

  return {
    get: () => ({ msgs, busy }),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    send,
    reset: () => { msgs = [GREETING]; busy = false; emit(); },
  };
})();

/* Bulle de visualisation inline : récupère le HTML du sous-graphe via
   /api/subgraph (même endpoint que l'onglet Sous-graphe, CSS adapté à
   l'iframe) et l'affiche dans une iframe. Évite tout lien/fichier. */
function VizBubble({ viz }) {
  const [html, setHtml] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('api/subgraph', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...viz, format: 'html' }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const d = await res.json();
        if (!alive) return;
        if (d.html) setHtml(d.html);
        else setErr(d.message || 'Visualisation indisponible.');
      } catch (e) {
        if (alive) setErr(String(e && e.message ? e.message : e));
      }
    })();
    return () => { alive = false; };
  }, [JSON.stringify(viz)]);
  return (
    <div className="jb-msg jb-msg--bot jb-viz">
      <div className="jb-viz-head">🕸️ Sous-graphe : <strong>{viz.term}</strong></div>
      {err
        ? <div className="jb-viz-err">⚠️ {err}</div>
        : html
          ? <iframe title={`viz-${viz.term}`} srcDoc={html}
                    sandbox="allow-scripts allow-same-origin" className="jb-viz-frame" />
          : <div className="jb-viz-load">… génération du graphe …</div>}
    </div>
  );
}

function ChatPanel({ dark, onClose }) {
  // S'abonne au store singleton — l'état réel (msgs/busy) y vit, donc il
  // survit à la fermeture/réouverture et le stream continue en fond.
  const [, _force] = React.useReducer((x) => x + 1, 0);
  useEffect(() => JarvisChatStore.subscribe(_force), []);
  const { msgs, busy } = JarvisChatStore.get();
  const [draft, setDraft] = useState('');
  const [railH, setRailH] = useState(0);
  // Largeur du panneau, élargissable au glissement de la poignée gauche.
  // Persistée en mémoire (localStorage) pour rester stable entre ouvertures.
  const [width, setWidth] = useState(() => {
    try {
      const w = parseInt(localStorage.getItem('jdm_jarvis_chat_w') || '', 10);
      if (w >= 320 && w <= 1000) return w;
    } catch (e) {}
    return Math.min(380, Math.round(window.innerWidth * 0.92));
  });
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Drag de la poignée gauche → largeur = distance du bord droit au curseur.
  const startResize = useCallback((e) => {
    e.preventDefault();
    const onMove = (ev) => {
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const w = clamp(Math.round(window.innerWidth - x), 320,
                      Math.round(window.innerWidth * 0.96));
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      document.body.style.userSelect = '';
      setWidth((w) => { try { localStorage.setItem('jdm_jarvis_chat_w', String(w)); } catch (e) {} return w; });
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, []);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  // Mesure la hauteur du rail bas VISIBLE (sections ou flux) pour que le
  // panneau s'arrête juste au-dessus — on doit voir le panneau ET le rail.
  useEffect(() => {
    const measure = () => {
      let h = 0;
      const rails = document.querySelectorAll('nav[aria-label="Sections Jarvis"], nav[aria-label="Navigation entre flux"]');
      rails.forEach((r) => {
        const rect = r.getBoundingClientRect();
        // rail visible et ancré en bas de l'écran
        if (rect.height && rect.bottom <= window.innerHeight + 2 && rect.bottom >= window.innerHeight - rect.height - 2 && getComputedStyle(r).opacity !== '0') {
          h = Math.max(h, window.innerHeight - rect.top);
        }
      });
      setRailH((prev) => (Math.abs(prev - h) > 1 ? Math.round(h) : prev));
    };
    measure();
    const id = setInterval(measure, 400); // suit l'apparition/disparition du rail
    window.addEventListener('resize', measure);
    return () => { clearInterval(id); window.removeEventListener('resize', measure); };
  }, []);

  // Esc ferme le panneau
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Délègue au store : la requête vit hors du composant (tâche de fond).
  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    JarvisChatStore.send(text);
  }, [draft]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return ReactDOM.createPortal((
    <div className={`jb-chat ${dark ? 'jb-is-dark' : 'jb-is-light'}`} role="dialog" aria-label="Discuter avec Jarvis"
         style={{ bottom: railH ? railH + 'px' : 0, width: width + 'px' }}>
      {/* Poignée de redimensionnement (bord gauche) — glisser pour élargir. */}
      <div className="jb-chat-resize" onMouseDown={startResize} onTouchStart={startResize}
           role="separator" aria-label="Redimensionner le panneau" title="Glisser pour élargir" />
      <div className="jb-chat-head">
        <span className="jb-chat-bot" aria-hidden="true"><MiniRobot dark={dark} awake={true} /></span>
        <div className="jb-chat-titles">
          <strong>Jarvis</strong>
          <span>Discussion</span>
        </div>
        <button type="button" className="jb-chat-x" onClick={onClose} title="Fermer la discussion" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="jb-chat-body" ref={scrollRef}>
        {msgs.map((m, i) => (
          m.who === 'viz'
            ? <VizBubble key={i} viz={m.viz} />
            : m.who === 'bot' && m.text
              ? <div key={i} className="jb-msg jb-msg--bot jb-md"
                     dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
              : <div key={i} className={`jb-msg jb-msg--${m.who}`}>{m.text}</div>
        ))}
        {busy && (
          <div className="jb-msg jb-msg--bot jb-msg--typing"><span></span><span></span><span></span></div>
        )}
      </div>

      <div className="jb-chat-foot">
        <textarea ref={inputRef} className="jb-chat-input" rows="1" placeholder="Écris ton message…"
                  value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
        <button type="button" className="jb-chat-send" onClick={send} disabled={busy || !draft.trim()} title="Envoyer" aria-label="Envoyer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 8h9M7.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  ), document.body);
}

/* ── La bannière ────────────────────────────────────────────────────── */
function JarvisBanner() {
  const [dark, setDark] = useState(() => (document.body.dataset.theme === 'lab'));
  const [cfgMode, setCfgMode] = useState(readMode);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(BANNER_KEY) === '1'; } catch (e) { return false; }
  });
  const [chatOpen, setChatOpen] = useState(false);
  const collapsedRef = useRef(null);
  const [restPos, setRestPos] = useState(null); // position du mini-robot (mode fermé), calée sur le titre

  // suit le thème de l'app (paper → clair, lab → sombre)
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(document.body.dataset.theme === 'lab'));
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  // reflète les changements de mode faits ailleurs (panneau Configuration,
  // autre onglet) — événement custom + storage + poll léger de sécurité.
  useEffect(() => {
    const sync = () => setCfgMode(readMode());
    window.addEventListener('__jdm_jarvis_config_changed', sync);
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 1200);
    return () => { window.removeEventListener('__jdm_jarvis_config_changed', sync); window.removeEventListener('storage', sync); clearInterval(id); };
  }, []);

  const auto = cfgMode === 'autonome';
  const setMode = useCallback((wantAuto) => {
    if (wantAuto) { writeMode('autonome'); setCfgMode('autonome'); }
    else {
      const cur = readMode();
      const next = cur === 'autonome' ? 'supervise' : cur; // préserve supervise/pasapas
      writeMode(next); setCfgMode(next);
    }
  }, []);

  const setCollapsedPersist = useCallback((v) => {
    setCollapsed(v);
    try { localStorage.setItem(BANNER_KEY, v ? '1' : '0'); } catch (e) {}
  }, []);

  // distingue clic simple (bascule autonome/veille) du double-clic (ouvrir)
  const clickTimer = useRef(null);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  // Mode fermé : place le mini-robot juste à droite du titre « Tableau de
  // bord » (et non plus en bas à droite). On mesure le h1 du masthead.
  useEffect(() => {
    if (!collapsed) return;
    let raf;
    const measure = () => {
      const layer = collapsedRef.current;
      if (!layer) return;
      const host = layer.parentElement || layer;
      const lb = layer.getBoundingClientRect();
      const h1 = host.querySelector('h1');
      if (!h1) return;
      const rg = document.createRange(); rg.selectNodeContents(h1);
      const tb = rg.getBoundingClientRect();
      const right = (tb.right || h1.getBoundingClientRect().right) - lb.left;
      const midY = (tb.top + tb.bottom) / 2 - lb.top;
      setRestPos({ left: Math.round(right + 14), top: Math.round(midY) });
    };
    measure();
    const t1 = setTimeout(measure, 300), t2 = setTimeout(measure, 900);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, [collapsed]);

  // Couleurs = tokens de l'app → la bannière se fond dans le fond de page.
  const ink   = 'var(--ink)';
  const ink2  = 'var(--ink-2)';
  const ink3  = 'var(--ink-3)';
  const line  = 'var(--line)';
  const cardBg = 'var(--bg-card)';
  const statusColor = auto ? 'var(--jdm-green)' : 'var(--jdm-orange)';
  const jdm = ['#c83a73', '#4ea63c', '#1f97b1'];

  if (collapsed) {
    return (
      <div ref={collapsedRef} className={`jb-layer jb-layer--collapsed ${dark ? 'jb-is-dark' : 'jb-is-light'}`}>
        <button type="button" className={`jb-reopen ${auto ? 'jb-reopen-awake' : ''}`}
                style={restPos ? { left: restPos.left + 'px', top: (restPos.top - 21) + 'px', right: 'auto', bottom: 'auto' } : undefined}
                title={auto ? 'Mode autonome — clic : repasser en veille · double-clic : ouvrir' : 'En veille — clic : réveiller en autonome · double-clic : ouvrir'}
                onClick={() => {
                  if (clickTimer.current) return; // double-clic en cours → ignore
                  clickTimer.current = setTimeout(() => {
                    clickTimer.current = null;
                    setMode(!auto); // clic simple → bascule autonome / veille
                  }, 230);
                }}
                onDoubleClick={() => {
                  if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                  setCollapsedPersist(false); // double-clic → ouvre
                }}>
          {auto && (
            <span className="jb-radiate-css" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
          )}
          <MiniRobot dark={dark} awake={auto} />
        </button>
      </div>
    );
  }

  return (
    <>
    <div className={`jb-layer ${auto ? 'jb-mode-auto' : 'jb-mode-manual'} ${dark ? 'jb-is-dark' : 'jb-is-light'}`}>
      <Robot mode={auto ? 'auto' : 'manual'} dark={dark} speedPct={92} sizePx={54}
             expressivity={130} freq={110} manualExpr="baby" />

      <div className="jb-ctl">
          <div className="jb-mode-toggle" role="radiogroup" aria-label="Mode d'exécution"
               style={{ background: cardBg, borderColor: line }}>
            <span className="jb-mode-thumb" data-on={auto ? 'auto' : 'manual'} />
            <button type="button" className={`jb-mode-btn ${!auto ? 'on' : ''}`} role="radio" aria-checked={!auto}
                    onClick={() => setMode(false)} style={{ color: !auto ? '#fff' : ink2 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M5 2.5c0-.8.6-1.4 1.3-1.4s1.2.6 1.2 1.4v4.3M7.5 6.8V1.9c0-.8.6-1.3 1.3-1.3s1.2.5 1.2 1.3v4.9M10 7V3c0-.8.5-1.3 1.2-1.3S12.5 2.2 12.5 3v6.2c0 3-2 5.3-4.8 5.3-1.6 0-2.7-.6-3.7-1.9L1.7 9.3c-.4-.6-.3-1.4.3-1.8.5-.4 1.3-.3 1.7.3L5 9.2V3.3c0-.8.5-1.3 1.2-1.3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              Manuel
            </button>
            <button type="button" className={`jb-mode-btn ${auto ? 'on' : ''}`} role="radio" aria-checked={auto}
                    onClick={() => setMode(true)} style={{ color: auto ? '#fff' : ink2 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.1" fill="currentColor"/>
                <path d="M8 1.4v1.8M8 12.8v1.8M14.6 8h-1.8M3.2 8H1.4M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.6L3.3 3.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Autonome
            </button>
          </div>
          {/* Bouton indépendant : ouvre le panneau de discussion sans toucher au mode actif */}
          <button type="button" className={`jb-chat-btn ${chatOpen ? 'on' : ''}`}
                  aria-pressed={chatOpen} title="Discuter avec Jarvis"
                  onClick={() => setChatOpen((v) => !v)}
                  style={{ background: chatOpen ? 'var(--accent)' : cardBg, borderColor: chatOpen ? 'var(--accent)' : line, color: chatOpen ? '#fff' : ink2 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4.2C2 3 3 2 4.2 2h7.6C13 2 14 3 14 4.2v5.1c0 1.2-1 2.2-2.2 2.2H7l-3.1 2.4c-.4.3-1 0-1-.5v-1.9H4.2C3 11.5 2 10.5 2 9.3V4.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="5.5" cy="6.75" r="0.9" fill="currentColor"/>
              <circle cx="8" cy="6.75" r="0.9" fill="currentColor"/>
              <circle cx="10.5" cy="6.75" r="0.9" fill="currentColor"/>
            </svg>
            Discuter
          </button>
          <button type="button" className="jb-close" title="Mettre Jarvis en veille"
                  onClick={() => setCollapsedPersist(true)} style={{ color: ink3 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
    </div>
    {chatOpen && <ChatPanel dark={dark} onClose={() => setChatOpen(false)} />}
    </>
  );
}

/* ── styles (préfixés jb-) ─────────────────────────────────────────── */
const CSS = `
/* Le robot vit DANS le conteneur du masthead : calque transparent, sans
   fond ni halo dur qui le sépare. pointer-events:none → ne bloque ni le
   texte ni les contrôles ; .jb-ctl/.jb-reopen rétablissent pointer-events. */
.jb-layer { position:absolute; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.jb-ctl { position:absolute; bottom:9px; right:10px; z-index:6; display:flex; align-items:center; gap:8px; pointer-events:auto; }

/* Bouton "Discuter" — pilule indépendante à côté du toggle de mode */
.jb-chat-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border:1px solid; border-radius:999px; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; letter-spacing:0.02em; white-space:nowrap; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); transition: background .2s ease, border-color .2s ease, color .2s ease, transform .12s ease; }
.jb-chat-btn:hover { transform:translateY(-1px); }
.jb-chat-btn svg { flex-shrink:0; }
.jb-chat-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

/* Panneau latéral de discussion */
.jb-chat { position:fixed; top:0; right:0; bottom:0; width:min(380px,92vw); z-index:1000; display:flex; flex-direction:column; background:var(--bg-card); border-left:1px solid var(--line); box-shadow:-18px 0 48px -24px rgba(0,0,0,0.5); pointer-events:auto; transform:translateX(0); }
.jb-chat-resize { position:absolute; left:0; top:0; bottom:0; width:7px; cursor:ew-resize; z-index:5; background:transparent; transition: background .15s ease; }
.jb-chat-resize:hover, .jb-chat-resize:active { background:linear-gradient(90deg, var(--accent), transparent); }
@media (prefers-reduced-motion: no-preference) { .jb-chat { animation: jbChatIn .26s cubic-bezier(.22,1,.36,1) both; } }
@keyframes jbChatIn { from{transform:translateX(100%);} to{transform:translateX(0);} }

.jb-chat-head { display:flex; align-items:center; gap:11px; padding:14px 14px 13px 16px; border-bottom:1px solid var(--line); }
.jb-chat-bot { display:inline-flex; width:34px; height:31px; align-items:center; justify-content:center; flex-shrink:0; }
.jb-chat-titles { display:flex; flex-direction:column; line-height:1.15; flex:1; min-width:0; }
.jb-chat-titles strong { font-family:var(--font-display); font-style:italic; font-weight:600; font-size:18px; color:var(--ink); }
.jb-chat-titles span { font-family:var(--font-mono); font-size:9.5px; text-transform:uppercase; letter-spacing:0.14em; color:var(--ink-3); margin-top:1px; }
.jb-chat-x { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:none; border-radius:8px; background:transparent; color:var(--ink-3); cursor:pointer; transition: background .15s ease, color .15s ease; }
.jb-chat-x:hover { background:rgba(127,127,127,0.14); color:var(--ink); }
.jb-chat-x:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }

.jb-chat-body { flex:1; overflow-y:auto; padding:18px 16px; display:flex; flex-direction:column; gap:10px; }
.jb-msg { max-width:84%; padding:9px 13px; border-radius:14px; font-size:13.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
.jb-msg--bot { align-self:flex-start; background:var(--bg-elev); color:var(--ink); border:1px solid var(--line-soft); border-bottom-left-radius:5px; }
.jb-msg--me { align-self:flex-end; background:var(--accent); color:#fff; border-bottom-right-radius:5px; }
/* Bulle bot en markdown rendu (jb-md) : on retire le pre-wrap (le HTML
   gère les sauts) et on cadre les marges des blocs marked. */
.jb-md { white-space:normal; }
.jb-md > :first-child { margin-top:0; }
.jb-md > :last-child { margin-bottom:0; }
.jb-md p { margin:0 0 8px; }
.jb-md ul, .jb-md ol { margin:4px 0 8px; padding-left:20px; }
.jb-md li { margin:2px 0; }
.jb-md code { font-family:var(--font-mono),monospace; font-size:12px; background:rgba(127,127,127,0.16); padding:1px 5px; border-radius:5px; }
.jb-md pre { background:rgba(127,127,127,0.12); padding:9px 11px; border-radius:9px; overflow-x:auto; margin:6px 0; }
.jb-md pre code { background:none; padding:0; }
.jb-md strong { font-weight:600; }
.jb-md a { color:var(--accent); }
.jb-md h1, .jb-md h2, .jb-md h3 { font-size:14px; font-weight:600; margin:8px 0 4px; }

/* Bulle de visualisation : prend toute la largeur dispo, iframe haute. */
.jb-viz { max-width:100%!important; width:100%; padding:10px!important; }
.jb-viz-head { font-size:12px; color:var(--ink-2); margin-bottom:7px; }
.jb-viz-frame { width:100%; height:340px; border:1px solid var(--line-soft); border-radius:10px; background:var(--bg); }
.jb-viz-load, .jb-viz-err { font-size:12.5px; color:var(--ink-3); padding:18px 6px; text-align:center; }
.jb-viz-err { color:var(--jdm-magenta); }

.jb-msg--typing { display:inline-flex; gap:4px; align-items:center; padding:12px 14px; }
.jb-msg--typing span { width:6px; height:6px; border-radius:50%; background:var(--ink-3); opacity:0.5; animation: jbTyping 1.1s ease-in-out infinite; }
.jb-msg--typing span:nth-child(2){ animation-delay:.18s; } .jb-msg--typing span:nth-child(3){ animation-delay:.36s; }
@keyframes jbTyping { 0%,60%,100%{transform:translateY(0);opacity:.35;} 30%{transform:translateY(-4px);opacity:.9;} }

.jb-chat-foot { display:flex; align-items:flex-end; gap:8px; padding:12px 14px; border-top:1px solid var(--line); background:var(--bg-card); }
.jb-chat-input { flex:1; resize:none; max-height:120px; padding:10px 12px; border:1px solid var(--line); border-radius:12px; background:var(--bg-elev); color:var(--ink); font-family:var(--font-sans); font-size:13.5px; line-height:1.4; outline:none; transition: border-color .15s ease; }
.jb-chat-input:focus { border-color:var(--accent); }
.jb-chat-input::placeholder { color:var(--ink-3); }
.jb-chat-send { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; border:none; border-radius:11px; background:var(--accent); color:#fff; cursor:pointer; transition: transform .12s ease, opacity .15s ease; }
.jb-chat-send:hover:not(:disabled) { transform:translateY(-1px); }
.jb-chat-send:disabled { opacity:0.4; cursor:default; }
.jb-chat-send:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

.jb-robot-field { position:absolute; inset:0; overflow:hidden; z-index:6; pointer-events:none; }
.jb-robot { position:absolute; left:0; top:0; width:56px; z-index:8; will-change:transform; filter: drop-shadow(0 5px 8px rgba(0,0,0,0.22)); }
.jb-puff { position:absolute; width:16px; height:16px; border-radius:50%; background: radial-gradient(circle, rgba(210,200,180,0.55), transparent 70%); opacity:0; pointer-events:none; will-change:transform,opacity; }
.jb-is-light .jb-puff { background: radial-gradient(circle, rgba(120,108,88,0.5), transparent 70%); }

.jb-thought { --jbbub: rgba(22,22,28,0.93); position:absolute; transform-origin:center bottom; display:flex; align-items:center; gap:4px; padding:4px 9px; border-radius:20px / 24px; background:var(--jbbub); box-shadow:0 8px 20px -10px rgba(0,0,0,0.6); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px); font-family:'JetBrains Mono',monospace; font-size:9.5px; color:#f4efe4; white-space:nowrap; pointer-events:none; z-index:7; opacity:0; animation: jbThoughtFloat 2.8s cubic-bezier(.25,.7,.3,1) forwards; }
.jb-thought::before { content:''; position:absolute; z-index:-1; top:-5px; left:16%; width:11px; height:11px; border-radius:50%; background:var(--jbbub); box-shadow: 15px -2px 0 -1px var(--jbbub), 30px 1px 0 -2px var(--jbbub); }
.jb-tdot { pointer-events:none; }
.jb-is-light .jb-thought { --jbbub: rgba(255,255,255,0.96); color:#1f1d18; box-shadow:0 8px 20px -12px rgba(0,0,0,0.3); }
.jb-thought i { opacity:0.35; font-style:normal; }
.jb-thought b { font-weight:600; }
.jb-thought .jb-qm { font-family:'Newsreader',Georgia,serif; font-style:italic; font-weight:600; font-size:14px; line-height:1; }
.jb-thought .jb-spark { font-weight:700; }
.jb-thought .jb-dots { letter-spacing:1px; opacity:0.7; }
.jb-thought svg { display:block; }
@keyframes jbThoughtFloat { 0%{opacity:0;transform:translateY(7px) scale(0.8);} 16%{opacity:1;transform:translateY(0) scale(1);} 80%{opacity:1;transform:translateY(-8px) scale(1);} 100%{opacity:0;transform:translateY(-16px) scale(0.97);} }

.jb-content { position: relative; display: flex; flex-direction: column; gap: 7px; padding: 16px 24px; max-width: 64%; z-index: 3; }
.jb-kicker { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; }
.jb-dot-sep { width:3px; height:3px; border-radius:50%; display:inline-block; opacity:0.7; }
.jb-headline { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
.jb-title { margin:0; font-family:'Newsreader',Georgia,serif; font-style:italic; font-weight:500; font-size:clamp(30px,3.6vw,42px); line-height:0.9; letter-spacing:-0.02em; }
.jb-subtitle { margin:0; font-size:13px; line-height:1.4; max-width:34ch; text-wrap:pretty; }
.jb-controls { display:flex; flex-wrap:wrap; align-items:center; gap:12px 16px; margin-top:2px; }

.jb-mode-toggle { position:relative; display:inline-flex; padding:3px; border:1px solid; border-radius:999px; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.jb-mode-thumb { position:absolute; top:3px; bottom:3px; width:calc(50% - 3px); border-radius:999px; background:linear-gradient(180deg,#d96810,#c0411a); box-shadow:0 4px 12px -4px rgba(192,65,26,0.7); transition: transform .34s cubic-bezier(.22,1,.36,1), background .34s ease, box-shadow .34s ease; transform:translateX(0); z-index:0; }
.jb-mode-thumb[data-on="auto"] { transform:translateX(100%); background:linear-gradient(180deg,#5FB94A,#1f97b1); box-shadow:0 4px 14px -3px rgba(31,151,177,0.75); }
.jb-mode-btn { position:relative; z-index:1; display:inline-flex; align-items:center; gap:6px; border:none; background:transparent; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; letter-spacing:0.02em; padding:7px 14px; border-radius:999px; white-space:nowrap; transition: color .28s ease; }
.jb-mode-btn svg { flex-shrink:0; }

.jb-status { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; line-height:1.35; }
.jb-status b { font-weight:600; }
.jb-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; box-shadow:0 0 0 0 currentColor; }
.jb-status-dot.jb-pulse { animation: jbDotPulse 1.6s ease-in-out infinite; }
@keyframes jbDotPulse { 0%,100%{box-shadow:0 0 0 0 rgba(95,185,74,0.55);} 50%{box-shadow:0 0 0 6px rgba(95,185,74,0);} }

.jb-close { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border:none; border-radius:7px; background:transparent; cursor:pointer; opacity:0.42; transition: opacity .16s ease, background .16s ease; }
.jb-close:hover { opacity:0.95; background: rgba(127,127,127,0.16); }
.jb-close:focus-visible { outline:2px solid var(--accent); outline-offset:1px; opacity:0.95; }

.jb-layer--collapsed { pointer-events:none; overflow:visible; z-index:12; }
.jb-reopen { position:absolute; bottom:9px; right:10px; pointer-events:auto; display:inline-flex; align-items:center; justify-content:center; width:46px; height:42px; padding:0; border:none; background:transparent; cursor:pointer; border-radius:10px; transition: transform .15s ease; }
.jb-reopen .jb-mini-svg { position:relative; z-index:1; }
/* Radiations : cercles diffus qui naissent (scale 0) derrière la tête et
   s'étendent en s'estompant. transform+opacity uniquement → composité GPU,
   parfaitement fluide, zéro re-rasterisation. */
.jb-radiate-css { position:absolute; left:50%; top:46%; width:26px; height:26px; transform:translate(-50%,-50%); pointer-events:none; z-index:0; }
.jb-radiate-css i { position:absolute; inset:0; border-radius:50%; background: radial-gradient(circle, rgba(43,212,192,0.5) 0%, rgba(43,212,192,0.32) 42%, rgba(43,212,192,0) 70%); opacity:0; transform:scale(0); will-change:transform,opacity; animation: jbRadCss 3s cubic-bezier(.22,.7,.3,1) infinite; }
.jb-radiate-css i:nth-child(2) { animation-delay:1s; }
.jb-radiate-css i:nth-child(3) { animation-delay:2s; }
@keyframes jbRadCss { 0%{transform:scale(0);opacity:0;} 14%{opacity:0.85;} 100%{transform:scale(3.4);opacity:0;} }
@media (prefers-reduced-motion: reduce) { .jb-radiate-css i { animation-duration:6s; } }
.jb-reopen:hover { transform:translateY(-1px) scale(1.06); }
.jb-reopen-awake { animation: jbAwakeBreathe 2.4s ease-in-out infinite; }
@keyframes jbAwakeBreathe { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
.jb-reopen-awake:hover { animation:none; }
.jb-reopen:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.jb-reopen-bot { display:inline-flex; width:38px; height:35px; align-items:center; justify-content:center; }
.jb-reopen-text { display:flex; flex-direction:column; line-height:1.05; text-align:left; }
.jb-reopen-label { font-family:var(--font-display); font-style:italic; font-weight:500; font-size:16px; color:var(--ink); }
.jb-reopen-sub { font-family:var(--font-mono); font-size:9.5px; text-transform:uppercase; letter-spacing:0.12em; color:var(--ink-3); margin-top:1px; }

.jb-mini-eyes { transform-box: fill-box; transform-origin: center; animation: jbWink 4s ease-in-out infinite; }
@keyframes jbWink { 0%,88%,100%{transform:scaleY(1);} 92%{transform:scaleY(0.12);} 96%{transform:scaleY(1);} }

/* (mobile : le robot occupe tout le conteneur, comme sur desktop) */
`;

function injectStyles() {
  if (document.getElementById('jb-styles')) return;
  const s = document.createElement('style');
  s.id = 'jb-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}
injectStyles();

window.JarvisBanner = JarvisBanner;
})();
