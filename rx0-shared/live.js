// The RX-0 study model as a page you drive. NT-D engages or releases the transformation (it runs over 6 s each way),
// the TRANSFORM slider sets the progress directly, ASSEMBLIES isolate a part (HERO puts everything back), DISPLAY
// toggles labels, the exploded set, the x-ray and the turntable; the play button freezes the transformation. Drag to
// orbit, wheel to zoom, keys 1-5 for views, N for NT-D. Left alone it plays the film's script as an auto tour with the
// operator's cursor; any click, drag, wheel or key hands control over, 25 s of quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY, SUBS} from './console.js';
import {actionsAt, camAt, dAt, displayAt, DURATION, easedDisplay, focusAt, logAt, makeConsoleFrame, makeCursor, SCRIPT, ss, subAt, telemetry, viewAt, VIEW_FN} from './film.js';
import {createRx0Stage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const SUB_VIEW = {head: 'headClose', torso: 'chest', arms: 'arm', legs: 'legs', shield: 'shield'};
const NTD_SECONDS = 6;

const CSS = `
html,body{background:#eef0f0;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:100px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #e0e5e8;border-radius:4px;background:rgba(250,251,252,.95);color:#1d2125;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e8392f}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createRx0Stage({canvas});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st);
  const tourTicks = SCRIPT.filter((e) => e.t > 0).map((e) => e.t / DURATION);

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
  const toStage = (cx) => (cx - app.getBoundingClientRect().left) / scale;
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);

  let T = 0;
  let d = 0;
  let target = 0;
  let paused = false;
  let view = 'hero';
  let viewAt0 = 0;
  let sub = null;
  let actions = 0;
  const subT = Object.fromEntries(SUBS.map((k) => [k, {on: 0, t: -9}]));
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0, 0)};
  let turn = 0;
  let ring = {t: -9, x: 0, y: 0};
  const easedD = (k, dur = 0.9) => {
    const x = ss(disp[k].t, disp[k].t + dur, T);
    return disp[k].on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});
  let log = 'OPERATOR · MANUAL CONTROL';
  const setView = (v) => {
    view = v;
    viewAt0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };

  const AP = {on: true, t0: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const [t0, v] = viewAt(cyc);
    view = v;
    viewAt0 = T - (cyc - t0);
    d = dAt(cyc);
    target = d > 0.5 ? 1 : 0;
    turn = camAt(cyc).az - VIEW_FN[v](cyc - t0, d).az;
    sub = subAt(cyc);
    actions = actionsAt(cyc);
    for (const k of SUBS) subT[k] = {on: sub === k ? 1 : 0, t: -9};
    for (const k of DISPLAY) disp[k] = {on: displayAt(cyc)[k], t: -9};
    log = 'OPERATOR · MANUAL CONTROL';
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  const choose = (next) => {
    for (const s of SUBS) {
      const want = s === next ? 1 : 0;
      if (subT[s].on !== want) subT[s] = {on: want, t: T};
    }
    sub = next;
    actions++;
    log = next ? `OPERATOR · ISOLATE ${next.toUpperCase()}` : 'OPERATOR · ALL ASSEMBLIES HOME';
    setView(next ? SUB_VIEW[next] : 'hero');
  };
  ui.btn.hero.addEventListener('click', () => {
    takeOver();
    pulse('hero');
    choose(null);
  });
  for (const k of SUBS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      choose(sub === k ? null : k);
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k] = {on: disp[k].on ? 0 : 1, t: T};
      actions++;
      log = `OPERATOR · ${k.toUpperCase()} ${disp[k].on ? 'ON' : 'OFF'}`;
    });
  ui.btn.ntd.addEventListener('click', () => {
    takeOver();
    pulse('ntd');
    target = target > 0.5 ? 0 : 1;
    paused = false;
    actions++;
    log = target ? 'NT-D · ACTIVATED' : 'NT-D · RELEASED · RETURNING TO UNICORN MODE';
  });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    paused = !paused;
  });
  const slider = (x0, w, y, apply) => {
    const el = document.createElement('div');
    el.className = 'hit';
    Object.assign(el.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${w + 16}px`, height: '22px'});
    const move = (e) => {
      apply(clamp((toStage(e.clientX) - x0) / w, 0, 1));
      lastInput = T;
    };
    el.addEventListener('pointerdown', (e) => {
      takeOver();
      el.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(el);
  };
  const scrub = (k) => {
    d = k;
    target = k;
    log = `OPERATOR · TRANSFORM ${Math.round(k * 100)}%`;
  };
  slider(ui.SP.x, ui.SP.w, 822, scrub);
  slider(ui.TL.x, ui.TL.w, 819, scrub);
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'front', 3: 'side', 4: 'back', 5: 'top'}[key];
    if (v) {
      takeOver();
      setView(v);
    } else if (key === 'n') ui.btn.ntd.click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 't') ui.btn.turntable.click();
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -15, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.2);
    },
    {passive: false},
  );

  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    let tgt, cursor, focus, display, explode, xray, labels, prog, tau, dur, ticks, logText, acts, ntdTarget;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      d = dAt(cyc);
      sub = subAt(cyc);
      focus = focusAt(cyc);
      display = displayAt(cyc);
      explode = easedDisplay('exploded', cyc, 1.1);
      xray = easedDisplay('xray', cyc);
      labels = easedDisplay('labels', cyc, 0.6);
      tgt = camAt(cyc);
      view = viewAt(cyc)[1];
      cursor = tourCursor(cyc);
      prog = cyc / DURATION;
      tau = cyc;
      dur = DURATION;
      ticks = tourTicks;
      logText = logAt(cyc);
      acts = actionsAt(cyc);
      ntdTarget = cyc >= SCRIPT.find((e) => e.ntd).t ? 1 : 0;
    } else {
      if (T - lastInput > IDLE) startTour();
      if (!paused) d += clamp(target - d, -dt / NTD_SECONDS, dt / NTD_SECONDS);
      focus = Object.fromEntries(SUBS.map((k) => [k, subT[k].on ? ss(subT[k].t, subT[k].t + 0.9, T) : 1 - ss(subT[k].t, subT[k].t + 0.7, T)]));
      display = Object.fromEntries(DISPLAY.map((k) => [k, disp[k].on]));
      explode = easedD('exploded', 1.1);
      xray = easedD('xray');
      labels = easedD('labels', 0.6);
      tgt = VIEW_FN[view](T - viewAt0, d);
      if (disp.turntable.on) turn += 48 * dt;
      tgt.az += off.az + turn;
      tgt.el = clamp(tgt.el + off.el, -12, 80);
      tgt.d = tgt.d * off.k + 0.9 * explode;
      tgt.ty += 0.1 * explode;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      prog = d;
      tau = d * NTD_SECONDS;
      dur = NTD_SECONDS;
      ticks = [];
      logText = log;
      acts = actions;
      ntdTarget = target;
    }
    const k = 1 - Math.exp(-dt / (AP.on ? 0.12 : 0.4));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    st.frame({d, time: T, focus, explode, xray}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
    const focusK = sub ? focus[sub] : 0;
    const tel = telemetry({d, time: T, focus: sub, focusK, display, explode, armorStages: st.mech.armorStages});
    frameConsole({tel, focus: sub, focusK: sub ? focusK * ss(0.5, 1, focusK) : 0, display, ntdTarget, log: logText, runtime: T, prog, tau, dur, ticks, actions: acts, paused: AP.on ? false : paused, labels, cursor});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, get tier() {
    return tier;
  }, get d() {
    return d;
  }};
}
