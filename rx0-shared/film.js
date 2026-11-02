// RX-0 study model, the film: the machine (mech.js) on the hangar floor (stage.js) under the console (console.js). It
// stands in Unicorn Mode, the operator looks at the head, then engages NT-D: the torso unlocks, the legs extend, the
// arms and shoulders open, the horn splits into the V-fin and the mask retracts over the dual eyes, the psycho-frame
// beating red through every seam. In Destroy Mode the operator isolates the arms and the shield, bursts the machine
// apart on a 330° turntable, reassembles it, x-rays the armor and labels it. A pure function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {ASM_LABEL, createConsole, DISPLAY, SUBS} from './console.js';
import {beatRate, exposure, headTop, height, stagesAt} from './kin.js';
import {DURATION, dAt, SCRIPT, ss} from './schedule.js';
import {createRx0Stage} from './stage.js';

export {DURATION, dAt, SCRIPT, ss};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'rx0-unicorn', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;

// ------------------------------------------------------------ focus and display toggles at film time t
export const subAt = (t) => {
  const e = SCRIPT.filter((x) => x.sub && x.t <= t).pop();
  return e && e.sub !== 'off' ? e.sub : null;
};
export const focusAt = (t, dur = 0.9) => {
  const out = Object.fromEntries(SUBS.map((k) => [k, 0]));
  const ev = SCRIPT.filter((x) => x.sub);
  ev.forEach((e, i) => {
    if (e.sub === 'off') return;
    const end = ev[i + 1]?.t ?? 1e9;
    out[e.sub] = ss(e.t, e.t + dur, t) * (1 - ss(end, end + dur * 0.8, t));
  });
  return out;
};
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.9) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};
export const logAt = (t) => SCRIPT.filter((e) => e.log && e.t <= t).pop().log;
export const actionsAt = (t) => SCRIPT.filter((e) => e.t > 0 && (e.sub || e.display || e.ntd) && e.t <= t).length;

// ------------------------------------------------------------ views; the head views follow the head as it grows
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 1.16, tz: 0, az: 28 + 2.2 * u, el: 8, d: 5.1, sx: 0, sy: -24}),
  headClose: (u, d) => ({tx: 0, ty: headTop(d) - 0.1, tz: 0.02, az: 22 + 3 * u, el: 7, d: 1.05, sx: 0, sy: -20}),
  legs: (u) => ({tx: 0, ty: 0.55, tz: 0, az: 36 + 2.5 * u, el: 7, d: 2.7, sx: 0, sy: -20}),
  chest: (u) => ({tx: 0, ty: 1.45, tz: 0, az: 20 + 3 * u, el: 10, d: 2.3, sx: 0, sy: -20}),
  arm: (u) => ({tx: 0.2, ty: 1.25, tz: 0, az: 62 + 3 * u, el: 9, d: 2.4, sx: 0, sy: -20}),
  shield: (u) => ({tx: 0.25, ty: 1.15, tz: 0.05, az: 78 + 3 * u, el: 6, d: 2.7, sx: 0, sy: -20}),
  front: (u) => ({tx: 0, ty: 1.08, tz: 0, az: 2 * u, el: 5, d: 4.6, sx: 0, sy: -24}),
  side: (u) => ({tx: 0, ty: 1.08, tz: 0, az: 90 + 2 * u, el: 5, d: 4.6, sx: 0, sy: -24}),
  back: (u) => ({tx: 0, ty: 1.08, tz: 0, az: 200 + 2 * u, el: 8, d: 4.6, sx: 0, sy: -24}),
  top: (u) => ({tx: 0, ty: 1.0, tz: 0, az: 30 + 2 * u, el: 55, d: 4.8, sx: 0, sy: -24}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  // pull back through the move so the camera never cuts through the machine
  o.d += Math.max(0, Math.max(a.d, b.d) * 1.1 - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const turnAt = (t) => {
  const on = SCRIPT.filter((e) => e.display === 'turntable');
  let turn = 0;
  for (let j = 0; j < on.length; j += 2) turn += 330 * ss(on[j].t, (on[j + 1]?.t ?? 1e9) + 0.4, t);
  return turn;
};
export const camAt = (t) => {
  const d = dAt(t);
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], d);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.6, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], d), cur, k);
  }
  const ex = easedDisplay('exploded', t, 1.1);
  return {...o, az: o.az + turnAt(t), ty: o.ty + 0.1 * ex, d: o.d + 0.9 * ex};
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 470], [760, 400], [900, 520], [800, 360]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).flatMap((e) => {
    const out = [];
    if (e.sub) out.push({t: e.t, spot: ui.spots[e.sub === 'off' ? 'hero' : e.sub]});
    if (e.ntd) out.push({t: e.t, spot: ui.spots.ntd});
    if (e.display) out.push({t: e.t + (e.sub ? 0.4 : 0), spot: ui.spots[e.display]});
    return out;
  });
  const WP = [[0, 900, 560]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.18, ...e.spot], [e.t + 0.2, ...e.spot]);
    const next = EV[i + 1];
    if (!next || next.t - e.t > 1.6) WP.push([e.t + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ labels
export const FOCUS_LABELS = {
  head: [['horn', 'HORN / V-FIN', 'SPLITS ±36°'], ['mask', 'FACE MASK', 'TWIN HALVES FOLD'], ['eye', 'DUAL EYE', 'BEHIND THE VISOR'], ['visor', 'VISOR', 'RETRACTS INTO HELMET']],
  torso: [['chest', 'CHEST PLATE', 'SLIDES UP AND OUT'], ['collar', 'COLLAR', 'LIFTS 0.3 M'], ['backpack', 'BACKPACK', '2 BEAM SABERS'], ['skirt', 'FRONT SKIRT', 'SWINGS OUT']],
  arms: [['shoulder', 'SHOULDER ARMOR', 'LIFTS AND ROLLS OUT'], ['forearm', 'FOREARM', 'SPLITS IN HALF'], ['magnum', 'BEAM MAGNUM', 'RIGHT HAND']],
  legs: [['thigh', 'THIGH', '+0.5 M'], ['knee', 'KNEE ARMOR', 'TILTS UP'], ['shin', 'SHIN', '+0.6 M'], ['pfShin', 'PSYCHO-FRAME', 'SHIN RAIL'], ['foot', 'FOOT', 'TOE · HEEL SPREAD']],
  shield: [['shield', 'SHIELD', '4 PETALS PART'], ['forearm', 'MOUNT', 'LEFT FOREARM']],
};
const OVERVIEW = [['horn', 'V-FIN', 'SPLIT HORN'], ['eye', 'DUAL EYE', 'NT-D ACTIVE'], ['chest', 'CHEST', 'PSYCHO-FRAME'], ['shoulder', 'SHOULDER', 'LIFTED'], ['shield', 'SHIELD', 'PETALS OPEN'], ['magnum', 'BEAM MAGNUM', ''], ['knee', 'KNEE', ''], ['shin', 'SHIN', 'EXTENDED']];
export function makeLabels(st) {
  const place = (list, o) => {
    if (o < 0.02) return [];
    const pts = list.map(([key, name, sub]) => ({name, sub, at: st.project(st.mech.anchors[key]())})).filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1300 && x.at[1] > 120 && x.at[1] < 740);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 140;
      for (const c of col) {
        y = Math.max(y, Math.min(590, c.at[1] - 10));
        out.push({...c, label: [x, y], w, o});
        y += 34;
      }
    };
    stack(L, 336, 160);
    stack(R, 1130, 160);
    return out;
  };
  return (focus, focusK, overview) => [...(focus ? place(FOCUS_LABELS[focus], focusK) : []), ...place(OVERVIEW, overview * (1 - focusK))];
}

// ------------------------------------------------------------ the derived telemetry
const MODE = {head: 'HEAD APART', torso: 'TORSO APART', arms: 'ARMS APART', legs: 'LEGS APART', shield: 'SHIELD APART'};
export function telemetry({d, time, focus, focusK, display, explode, armorStages}) {
  const stages = stagesAt(d);
  const beat = beatRate(d);
  const exp = exposure(d);
  const resonance = exp * (0.8 + 0.2 * Math.pow(Math.sin(time * Math.PI * 2 * beat), 2));
  const openPlates = armorStages.filter((s) => stages[s] > 0.5).length;
  const S = stages;
  const subStatus = {
    horn: S.head > 0.5 ? ['V-FIN', 'gold'] : ['HORN', 'ink'],
    visor: S.head > 0.5 ? ['DUAL EYE', 'warn'] : ['VISOR', 'ok'],
    torso: S.torso > 0.5 ? ['OPEN', 'warn'] : ['SEALED', 'ok'],
    arms: S.arms > 0.5 ? ['SPLIT', 'warn'] : ['SEALED', 'ok'],
    legs: S.legs > 0.5 ? ['EXTENDED', 'warn'] : ['SEALED', 'ok'],
    shield: S.arms > 0.5 ? ['OPEN', 'warn'] : ['CLOSED', 'ok'],
  };
  if (focus === 'head') subStatus.horn = ['ISOLATED', 'ink'];
  else if (focus && subStatus[focus]) subStatus[focus] = ['ISOLATED', 'ink'];
  let bigMode = d < 0.002 ? 'UNICORN MODE' : d > 0.998 ? 'DESTROY MODE' : 'NT-D';
  let bigSub = d < 0.002 ? 'ARMOR SEALED · FRAME DORMANT' : `PSYCHO-FRAME ${Math.round(resonance * 100)}% · ${height(d).toFixed(2)} M`;
  if (focus) {
    bigMode = MODE[focus];
    bigSub = `${ASM_LABEL[focus]} · ${Math.round(focusK * 100)}% APART`;
  } else if (explode > 0.02) {
    bigMode = 'EXPLODED';
    bigSub = `ALL ASSEMBLIES · ${Math.round(explode * 100)}% APART`;
  } else if (display.xray) {
    bigMode = 'X-RAY';
    bigSub = 'ARMOR AT 18% · FRAME VISIBLE';
  }
  return {d, stages, beat, exposure: exp, resonance, height: height(d), openPlates, plates: armorStages.length, subStatus, mode: d < 0.5 ? 'UNICORN' : 'DESTROY', bigMode, bigSub};
}

export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const c = st.project(st.mech.root.position.clone().setY(1.1));
    ui.update({...s, ...s.tel, centre: c, callouts: labels(s.focus, s.focusK, s.labels)});
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createRx0Stage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    const ticks = SCRIPT.filter((e) => e.t > 0).map((e) => e.t / DURATION);
    window.RX = st;
    return {
      resize,
      render(t) {
        const d = dAt(t);
        const display = displayAt(t);
        const focus = focusAt(t);
        const sub = subAt(t);
        const explode = easedDisplay('exploded', t, 1.1);
        const cam = camAt(t);
        st.frame({d, time: t, focus, explode, xray: easedDisplay('xray', t)}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const focusK = sub ? focus[sub] : 0;
        const tel = telemetry({d, time: t, focus: sub, focusK, display, explode, armorStages: st.mech.armorStages});
        frame({
          tel,
          focus: sub,
          focusK: sub ? focusK * ss(0.5, 1, focusK) : 0,
          display,
          ntdTarget: t >= SCRIPT.find((e) => e.ntd).t ? 1 : 0,
          log: logAt(t),
          runtime: t,
          prog: t / DURATION,
          tau: t,
          dur: DURATION,
          ticks,
          actions: actionsAt(t),
          paused: false,
          labels: easedDisplay('labels', t, 0.6),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
