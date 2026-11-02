// The RX-0 head as a page you drive. NT-D runs the transformation (5 s each way), TRANSFORM sets it directly, EXPLODE
// pulls every assembly off the skull, ARMOR fades the white plates to show the frame. Drag to orbit, wheel to zoom,
// keys: N NT-D, E explode, X armor, 1-7 views, L labels. Left alone, it tours itself; any input hands control over and
// 25 s of quiet hands it back. #ortho=unicorn|destroy renders the four sheet views for overlay checks instead.
import * as THREE from 'three';
import {warmComposer} from 'teardown-kit/warm.js';
import {readouts, STAGE_NAME, STAGE_ORDER, UNIT_M} from './kin.js';
import {createHeadStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const VIEWS = {
  '3/4': {tx: 0, ty: 1.35, tz: 0, az: 0.5, el: 0.14, d: 17.5},
  front: {tx: 0, ty: 1.35, tz: 0, az: 0, el: 0.04, d: 17},
  side: {tx: 0, ty: 1.35, tz: 0, az: Math.PI / 2, el: 0.04, d: 17.5},
  back: {tx: 0, ty: 1.35, tz: 0, az: Math.PI, el: 0.1, d: 17.5},
  top: {tx: 0, ty: 0.6, tz: 0, az: 0.001, el: 1.48, d: 16},
  face: {tx: 0, ty: 0.25, tz: 0.6, az: 0.32, el: 0.05, d: 10.5},
  inside: {tx: 0, ty: 0.7, tz: 0, az: -0.8, el: 0.24, d: 23},
};
const VIEW_KEYS = Object.keys(VIEWS);

// the tour: a loop of operator moves, as a pure function of tour time
const TOUR = [
  {t: 0, view: '3/4', d: 0, ex: 0, armor: 1, msg: 'UNICORN MODE · FACE MASK CLOSED · HORN LOCKED'},
  {t: 4, view: 'front', d: 1, ex: 0, armor: 1, msg: 'NT-D · MASK PARTS · HORN SPLITS · FRAME EXPOSED'},
  {t: 11, view: 'side', d: 1, ex: 0, armor: 1, msg: 'DESTROY MODE · CROWN LIFTED · REAR FIN UP'},
  {t: 15, view: 'face', d: 1, ex: 0, armor: 1, msg: 'GUNDAM FACE · DUAL EYE · MAIN CAMERA'},
  {t: 19, view: 'inside', d: 1, ex: 1, armor: 1, msg: 'EXPLODED · SKULL · HINGE · RAILS · DUCTS · NECK JOINT'},
  {t: 25, view: 'inside', d: 1, ex: 1, armor: 0.12, msg: 'ARMOR GHOSTED · PSYCHO-FRAME UNDER EVERY SEAM'},
  {t: 29, view: 'back', d: 1, ex: 0, armor: 1, msg: 'REASSEMBLED'},
  {t: 32, view: '3/4', d: 0, ex: 0, armor: 1, msg: 'NT-D RELEASED · BACK TO UNICORN MODE'},
];
const TOUR_LEN = 38;
const tourAt = (tt) => {
  const t = ((tt % TOUR_LEN) + TOUR_LEN) % TOUR_LEN;
  let i = 0;
  while (i < TOUR.length - 1 && TOUR[i + 1].t <= t) i++;
  return {cur: TOUR[i], prev: TOUR[(i - 1 + TOUR.length) % TOUR.length], since: t - TOUR[i].t, t};
};

const CSS = `
html,body{background:#eef0f0;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;color:#1d2125}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.ui{position:absolute;inset:0;pointer-events:none;font-family:'JetBrains Mono',monospace}
.hd{position:absolute;left:34px;top:28px}
.hd b{display:block;font:700 22px 'Inter',sans-serif;letter-spacing:.5px}
.hd span{display:block;margin-top:5px;font:600 10px 'JetBrains Mono';letter-spacing:1.6px;color:#6b737a}
.pn{position:absolute;width:236px;padding:14px 14px 12px;background:rgba(250,251,252,.9);border:1px solid #dfe4e7;border-radius:6px;pointer-events:auto}
.pn h4{margin:0 0 8px;font:700 9px 'JetBrains Mono';letter-spacing:1.8px;color:#8a9399}
.pn h4:not(:first-child){margin-top:14px}
.row{display:flex;gap:5px;flex-wrap:wrap}
.bt{flex:1;min-width:0;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid #d6dce0;border-radius:4px;background:#fff;font:700 10px 'JetBrains Mono';letter-spacing:1px;color:#2a3036;cursor:pointer;pointer-events:auto;user-select:none}
.bt:hover{background:#f3f5f6}
.bt.on{background:#1d2125;color:#fff;border-color:#1d2125}
.bt.red.on{background:#e8392f;border-color:#e8392f}
.sl{position:relative;height:26px;margin-top:2px;cursor:ew-resize;pointer-events:auto}
.sl .tr{position:absolute;left:0;right:0;top:12px;height:3px;background:#dfe4e7;border-radius:2px}
.sl .fi{position:absolute;left:0;top:12px;height:3px;background:#1d2125;border-radius:2px}
.sl .kn{position:absolute;top:6px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:2px solid #1d2125}
.sl .lb{position:absolute;right:0;top:-4px;font:600 10px 'JetBrains Mono';color:#6b737a}
.ro{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #edf0f2}
.ro i{font:600 10px 'JetBrains Mono';font-style:normal;letter-spacing:1px;color:#6b737a}
.ro b{font:700 15px 'JetBrains Mono';color:#1d2125}
.ro b small{font-size:10px;color:#8a9399;margin-left:3px}
.sq{display:grid;grid-template-columns:86px 1fr 34px;align-items:center;gap:6px;padding:3px 0;font:600 9.5px 'JetBrains Mono';letter-spacing:.8px;color:#6b737a}
.sq .bar{height:5px;background:#e6eaec;border-radius:3px;overflow:hidden}
.sq .bar div{height:100%;background:#9aa3a9}
.sq.act{color:#e8392f}.sq.act .bar div{background:#e8392f}
.sq.done .bar div{background:#1d2125}
.sq em{font-style:normal;text-align:right}
.views{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;gap:5px;padding:7px;background:rgba(250,251,252,.9);border:1px solid #dfe4e7;border-radius:6px;pointer-events:auto}
.views .bt{flex:none;width:72px}
.chip{position:absolute;left:800px;top:28px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:24px;padding:0 12px;border:1px solid #e0e5e8;border-radius:4px;background:rgba(250,251,252,.95);font:700 9.5px 'JetBrains Mono';letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.chip i{display:block;width:6px;height:6px;border-radius:50%;background:#e8392f}
.chip.on i{animation:blink 1.2s steps(2) infinite}
.msg{position:absolute;left:800px;top:60px;transform:translateX(-50%);font:600 10.5px 'JetBrains Mono';letter-spacing:1.4px;color:#4b545b;white-space:nowrap}
@keyframes blink{50%{opacity:.15}}
svg.ld{position:absolute;inset:0;overflow:visible}
.lab{position:absolute;padding:3px 7px;background:rgba(255,255,255,.94);border:1px solid #d3d9dd;border-radius:3px;font:700 10.5px 'JetBrains Mono';letter-spacing:.8px;white-space:nowrap;color:#1d2125;transform:translate(var(--ox),-50%)}
.lab.int{border-color:#1d2125}
.lab.hot{border-color:#e8392f;color:#c62a20}
.ft{position:absolute;right:34px;bottom:34px;font:600 9.5px 'JetBrains Mono';letter-spacing:1.2px;color:#8a9399;text-align:right;line-height:1.6}
`;

const LABELS = [
  {k: 'horn', t: (d) => (d > 0.4 ? 'V-FIN (HORN HALVES)' : 'HORN')},
  {k: 'camera', t: () => 'MAIN CAMERA'},
  {k: 'mask', t: () => 'FACE MASK L/R', show: (d) => d < 0.5},
  {k: 'eyes', t: () => 'DUAL EYE', show: (d, e) => d > 0.5 || e > 0.4, hot: true},
  {k: 'chin', t: () => 'CHIN · MOUTH VENTS', show: (d) => d > 0.45},
  {k: 'cheek', t: () => 'CHEEK GUARD'},
  {k: 'pod', t: () => 'EAR POD'},
  {k: 'vulcan', t: () => 'VULCAN', show: (d, e) => e > 0.3 || d > 0.6},
  {k: 'fin', t: () => 'REAR FIN · SENSOR'},
  {k: 'crown', t: () => 'HELMET CROWN'},
  {k: 'frame', t: () => 'PSYCHO-FRAME', show: (d, e, a) => d > 0.5 || a < 0.5, hot: true},
  {k: 'collar', t: () => 'NECK COLLAR', show: (d, e) => e < 0.3},
  {k: 'skull', t: () => 'INNER FRAME SKULL', show: (d, e, a) => e > 0.4 || a < 0.5, int: true},
  {k: 'hinge', t: () => 'HORN SPLIT HINGE', show: (d, e) => e > 0.4, int: true},
  {k: 'rails', t: () => 'MASK ACTUATOR RAILS', show: (d, e) => e > 0.4, int: true},
  {k: 'duct', t: () => 'COOLING DUCT', show: (d, e) => e > 0.4, int: true},
  {k: 'ball', t: () => 'NECK BALL JOINT', show: (d, e) => e > 0.4, int: true},
];

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createHeadStage({canvas});

  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('ortho')) {
    // overlay-check mode: draw the four views where the sheet has them, and stop
    const key = hash.get('ortho');
    const d = +(hash.get('d') ?? (key === 'destroy' ? 1 : 0));
    app.style.width = '1536px';
    app.style.height = '1024px';
    canvas.style.width = '1536px';
    canvas.style.height = '1024px';
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    st.renderOrtho(key, {d, explode: +(hash.get('ex') ?? 0), armor: 1, time: 0, ink: hash.get('ink') !== '0'});
    window.__ready = true;
    return;
  }

  const ui = document.createElement('div');
  ui.className = 'ui';
  app.appendChild(ui);
  const el = (tag, cls, parent = ui, html = '') => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };
  el('div', 'hd', ui, `<b>RX-0 UNICORN · HEAD UNIT</b><span>STUDY MODEL · PURE CODE · TRACED FROM 3 REFERENCE SHEETS</span>`);
  const chip = el('div', 'chip');
  const msg = el('div', 'msg');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ld');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  ui.appendChild(svg);
  const labLayer = el('div', '', ui);

  // left panel: controls
  const L = el('div', 'pn', ui);
  L.style.left = '34px';
  L.style.top = '110px';
  el('h4', '', L, 'MODE');
  const modeRow = el('div', 'row', L);
  const bUni = el('div', 'bt', modeRow, 'UNICORN');
  const bNtd = el('div', 'bt red', modeRow, 'NT-D');
  el('h4', '', L, 'TRANSFORM');
  const slider = (parent, fmt) => {
    const s = el('div', 'sl', parent, '<div class="tr"></div><div class="fi"></div><div class="kn"></div><div class="lb"></div>');
    const fi = s.querySelector('.fi');
    const kn = s.querySelector('.kn');
    const lb = s.querySelector('.lb');
    return {
      el: s,
      set(v) {
        fi.style.width = `${v * 100}%`;
        kn.style.left = `${v * 100}%`;
        lb.textContent = fmt(v);
      },
    };
  };
  const sD = slider(L, (v) => `${Math.round(v * 100)} %`);
  el('h4', '', L, 'EXPLODE');
  const sE = slider(L, (v) => `${Math.round(v * 100)} %`);
  el('h4', '', L, 'ARMOR');
  const armorRow = el('div', 'row', L);
  const ARMOR_SET = {SOLID: 1, GHOST: 0.14, OFF: 0};
  const bArmor = Object.fromEntries(Object.keys(ARMOR_SET).map((k) => [k, el('div', 'bt', armorRow, k)]));
  el('h4', '', L, 'DISPLAY');
  const dispRow = el('div', 'row', L);
  const bLab = el('div', 'bt on', dispRow, 'LABELS');
  const bInk = el('div', 'bt on', dispRow, 'INK');
  const bSpin = el('div', 'bt', dispRow, 'SPIN');

  // right panel: readouts and the sequence
  const R = el('div', 'pn', ui);
  R.style.right = '34px';
  R.style.top = '110px';
  el('h4', '', R, 'READOUT · FROM THE POSE');
  const RO = [
    ['hornAngle', 'HORN SPLIT', (v) => v.toFixed(1), '°'],
    ['finSpan', 'V-FIN SPAN', (v) => v.toFixed(2), 'm'],
    ['maskGap', 'MASK GAP', (v) => v.toFixed(0), 'mm'],
    ['crownLift', 'CROWN LIFT', (v) => v.toFixed(0), 'mm'],
    ['frame', 'FRAME OUTPUT', (v) => v.toFixed(0), '%'],
    ['height', 'HEAD HEIGHT', (v) => v.toFixed(2), 'm'],
  ].map(([k, n, f, u]) => {
    const r = el('div', 'ro', R, `<i>${n}</i><b>0<small>${u}</small></b>`);
    return {k, f, u, b: r.querySelector('b')};
  });
  el('h4', '', R, 'NT-D SEQUENCE');
  const SQ = STAGE_ORDER.map((k) => {
    const r = el('div', 'sq', R, `<span>${STAGE_NAME[k]}</span><div class="bar"><div></div></div><em>0</em>`);
    return {k, r, bar: r.querySelector('.bar div'), em: r.querySelector('em')};
  });
  el('div', 'ft', ui, `1 UNIT = ${UNIT_M} M (ESTIMATE) · DRAG ORBIT · WHEEL ZOOM<br>N NT-D · E EXPLODE · X ARMOR · L LABELS · 1-7 VIEWS`);

  const viewsBar = el('div', 'views', ui);
  const bView = Object.fromEntries(VIEW_KEYS.map((k, i) => [k, el('div', 'bt', viewsBar, `${i + 1} ${k.toUpperCase()}`)]));

  // quality tiers for weaker GPUs
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, glow: true, pr: 2},
    {samples: 4, ao: false, shadow: 2048, glow: true, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, glow: false, pr: 1},
  ];
  let tier = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700 ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);

  // state
  const S = {d: 0, dTarget: 0, ex: 0, exTarget: 0, armor: 1, armorTarget: 1, view: '3/4', viewFrom: VIEWS['3/4'], viewT: 1, uAz: 0, uEl: 0, uZoom: 1, spin: false, labels: true, ink: true};
  let touring = true;
  let pinned = false; // tests switch the tour off for good
  let lastInput = -1e9;
  let clock = 0;
  let tourClock = 0;
  let camNow = {...VIEWS['3/4']};

  const setView = (v) => {
    if (v === S.view && S.viewT >= 1) return;
    S.viewFrom = {...camNow};
    S.view = v;
    S.viewT = 0;
    S.uAz = 0;
    S.uEl = 0;
    S.uZoom = 1;
  };
  const takeover = () => {
    if (touring) {
      touring = false;
      S.uAz = 0;
      S.uEl = 0;
      S.uZoom = 1;
    }
    lastInput = clock;
  };
  const tap = (b, fn) =>
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      takeover();
      fn();
    });
  tap(bUni, () => (S.dTarget = 0));
  tap(bNtd, () => (S.dTarget = 1));
  for (const [k, b] of Object.entries(bArmor)) tap(b, () => (S.armorTarget = ARMOR_SET[k]));
  tap(bLab, () => (S.labels = !S.labels));
  tap(bInk, () => (S.ink = !S.ink));
  tap(bSpin, () => (S.spin = !S.spin));
  for (const [k, b] of Object.entries(bView)) tap(b, () => setView(k));
  chip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (touring) takeover();
    else {
      touring = true;
      tourClock = 0;
    }
  });
  const dragSlider = (s, apply) => {
    const set = (cx) => {
      const r = s.el.getBoundingClientRect();
      apply(clamp((cx - r.left) / r.width, 0, 1));
    };
    s.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      takeover();
      s.el.setPointerCapture(e.pointerId);
      set(e.clientX);
      const mv = (ev) => set(ev.clientX);
      const up = () => {
        s.el.removeEventListener('pointermove', mv);
        s.el.removeEventListener('pointerup', up);
      };
      s.el.addEventListener('pointermove', mv);
      s.el.addEventListener('pointerup', up);
    });
  };
  dragSlider(sD, (v) => {
    S.d = S.dTarget = v;
  });
  dragSlider(sE, (v) => {
    S.ex = S.exTarget = v;
  });

  // orbit and zoom
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    takeover();
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    lastInput = clock;
    S.uAz -= ((e.clientX - drag.x) / scale) * 0.006;
    S.uEl = clamp(S.uEl + ((e.clientY - drag.y) / scale) * 0.005, -0.5, 1.3);
    drag = {x: e.clientX, y: e.clientY};
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeover();
      S.uZoom = clamp(S.uZoom * Math.exp(e.deltaY * 0.0012), 0.35, 2.2);
    },
    {passive: false},
  );
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'n') S.dTarget = S.dTarget > 0.5 ? 0 : 1;
    else if (k === 'e') S.exTarget = S.exTarget > 0.5 ? 0 : 1;
    else if (k === 'x') S.armorTarget = S.armorTarget > 0.5 ? 0.14 : 1;
    else if (k === 'l') S.labels = !S.labels;
    else if (k >= '1' && k <= String(VIEW_KEYS.length)) setView(VIEW_KEYS[+k - 1]);
    else return;
    takeover();
  });

  // labels: one pool, leaders drawn in SVG
  const pool = LABELS.map((lab) => {
    const div = el('div', `lab${lab.int ? ' int' : ''}${lab.hot ? ' hot' : ''}`, labLayer);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', lab.hot ? '#e8392f' : '#1d2125');
    line.setAttribute('stroke-width', '1');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.6');
    dot.setAttribute('fill', lab.hot ? '#e8392f' : '#1d2125');
    svg.append(line, dot);
    return {lab, div, line, dot, a: 0};
  });
  // a label whose part is hidden behind other parts (from this camera) fades out; checked a few times a second
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  let occT = 0;
  const occluded = (P, w) => {
    dir.copy(w).sub(st.camera.position);
    const dist = dir.length();
    ray.set(st.camera.position, dir.normalize());
    ray.far = dist;
    for (const h of ray.intersectObject(st.head.root, true)) {
      const m = h.object.material;
      if (!h.object.isMesh || (m.transparent && m.opacity < 0.5)) continue;
      return h.distance < dist - 0.3;
    }
    return false;
  };
  const drawLabels = (dt) => {
    occT -= dt;
    const recheck = occT <= 0;
    if (recheck) occT = 0.15;
    const c = st.project(st.head.anchorWorld('collar').clone().set(0, 1.2, 0));
    const vis = [];
    for (const P of pool) {
      if (recheck) P.hid = occluded(P, st.head.anchorWorld(P.lab.k).clone());
      const on = S.labels && !P.hid && (P.lab.show ? P.lab.show(S.d, S.ex, S.armor) : true);
      P.a = clamp(P.a + (on ? dt : -dt) * 4, 0, 1);
      const p = P.a > 0 ? st.project(st.head.anchorWorld(P.lab.k)) : null;
      if (!p || P.a <= 0) {
        P.div.style.display = 'none';
        P.line.style.display = P.dot.style.display = 'none';
        continue;
      }
      const side = p[0] >= (c ? c[0] : W / 2) ? 1 : -1;
      vis.push({P, p, side, y: p[1]});
    }
    // per side: label column outside the head, pushed apart vertically
    for (const side of [1, -1]) {
      const col = vis.filter((v) => v.side === side).sort((a, b) => a.y - b.y);
      for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + 26);
      const over = col.length ? col[col.length - 1].y - (H - 110) : 0;
      if (over > 0) for (const v of col) v.y -= over;
      for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - 26);
      for (const v of col) {
        const lx = side > 0 ? Math.max(v.p[0] + 70, 1000) : Math.min(v.p[0] - 70, 600);
        const x = clamp(lx, 300, 1300);
        const ly = clamp(v.y, 100, H - 100);
        const {P} = v;
        P.div.style.display = 'block';
        P.div.style.left = `${x}px`;
        P.div.style.top = `${ly}px`;
        P.div.style.setProperty('--ox', side > 0 ? '0' : '-100%');
        P.div.textContent = P.lab.t(S.d);
        P.div.style.opacity = P.a;
        const ex = x - side * 4;
        P.line.setAttribute('d', `M${v.p[0]},${v.p[1]} L${ex - side * 18},${ly} L${ex},${ly}`);
        P.line.style.display = P.dot.style.display = 'block';
        P.line.style.opacity = P.dot.style.opacity = P.a * 0.8;
        P.dot.setAttribute('cx', v.p[0]);
        P.dot.setAttribute('cy', v.p[1]);
      }
    }
  };

  const mixCam = (a, b, t) => {
    const o = {};
    for (const k of Object.keys(b)) o[k] = k === 'az' ? a.az + wrapPi(b.az - a.az) * t : lerp(a[k], b[k], t);
    return o;
  };
  const step = (cur, target, rate, dt) => (cur < target ? Math.min(target, cur + rate * dt) : Math.max(target, cur - rate * dt));

  let last = performance.now();
  let frames = 0;
  let slow = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (!touring && !pinned && clock - lastInput > IDLE) {
      touring = true;
      tourClock = 0;
    }
    let spinAz = 0;
    if (touring) {
      tourClock += dt;
      const {cur, since} = tourAt(tourClock);
      S.dTarget = cur.d;
      S.exTarget = cur.ex;
      S.armorTarget = cur.armor;
      if (S.view !== cur.view) setView(cur.view);
      spinAz = Math.sin(tourClock * 0.22) * 0.18;
      msg.textContent = cur.msg;
      msg.style.opacity = clamp(since * 2, 0, 1);
    } else msg.style.opacity = 0;
    S.d = step(S.d, S.dTarget, 1 / 5, dt);
    S.ex = step(S.ex, S.exTarget, 1 / 2.2, dt);
    S.armor = step(S.armor, S.armorTarget, 1 / 1.2, dt);
    if (S.spin && !touring) S.uAz += dt * 0.25;
    S.viewT = Math.min(1, S.viewT + dt / 1.3);
    const base = mixCam(S.viewFrom, VIEWS[S.view], ease(S.viewT));
    camNow = {...base, az: base.az + S.uAz + spinAz, el: clamp(base.el + S.uEl, -0.5, 1.5), d: base.d * S.uZoom * (1 + 0.25 * S.ex * (S.view === 'inside' ? 0 : 1))};
    st.frame({d: S.d, explode: ease(S.ex), armor: S.armor, time: clock, ink: S.ink}, camNow);

    // panels
    const r = readouts(S.d);
    for (const o of RO) o.b.firstChild.nodeValue = o.f(r[o.k]);
    for (const q of SQ) {
      const v = r.stages[q.k];
      q.bar.style.width = `${v * 100}%`;
      q.em.textContent = Math.round(v * 100);
      q.r.classList.toggle('act', v > 0.001 && v < 0.999);
      q.r.classList.toggle('done', v >= 0.999);
    }
    sD.set(S.d);
    sE.set(S.ex);
    bUni.classList.toggle('on', S.dTarget < 0.5);
    bNtd.classList.toggle('on', S.dTarget >= 0.5);
    for (const [k, b] of Object.entries(bArmor)) b.classList.toggle('on', Math.abs(ARMOR_SET[k] - S.armorTarget) < 0.01);
    for (const [k, b] of Object.entries(bView)) b.classList.toggle('on', k === S.view);
    bLab.classList.toggle('on', S.labels);
    bInk.classList.toggle('on', S.ink);
    bSpin.classList.toggle('on', S.spin);
    chip.className = `chip${touring ? ' on' : ''}`;
    chip.innerHTML = touring ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : pinned ? '<i></i>YOU HAVE CONTROL' : `<i></i>YOU HAVE CONTROL · TOUR IN ${Math.ceil(IDLE - (clock - lastInput))} S`;
    drawLabels(dt);

    // drop a quality tier if frames stay slow
    frames++;
    if (dt > 1 / 40) slow++;
    if (frames === 90) {
      if (slow > 45 && tier < TIERS.length - 1) {
        tier++;
        applyTier();
      }
      frames = 0;
      slow = 0;
    }
    requestAnimationFrame(loop);
  };
  window.__head = {
    S,
    setTour: (v) => {
      touring = v;
      pinned = !v;
      lastInput = clock;
    },
    setView,
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera)
    .catch(() => {})
    .then(() => {
      window.__ready = true;
      requestAnimationFrame(loop);
    });
}
