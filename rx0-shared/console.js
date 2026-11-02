// The RX-0 console at 1600 x 900.
//   top bar    badge, title, NT-D LOAD (segmented), UNIT, RUNTIME, STATUS, PILOT
//   left       01 NT-D (progress and the five stages), 02 PSYCHO-FRAME (resonance, the frame's heartbeat, exposure),
//              03 FRAME (head height, its growth, where the 2 m comes from)
//   right      04 MODE (Unicorn / Destroy, mass, open plates), 05 ASSEMBLIES, 06 DISPLAY + the NT-D switch,
//              07 SUBSYSTEMS (live status badges)
//   viewport   the mode in large type, the isolate tag, construction rings, callouts
//   bottom     08 OPERATION LOG (the operator's moves as ticks, the action count, the transform slider)
// update(s) redraws every live part from the frame's state; nothing on screen is typed in.
import {GROW, SCALE, SPEC, STAGES} from './kin.js';

export const C = {ink: '#1d2125', mute: '#89929a', faint: '#d2d8dc', line: '#e0e5e8', panel: 'rgba(250,251,252,.95)', or: '#e8392f', green: '#2fa36b', gold: '#c99a2e'};
export const SUBS = ['head', 'torso', 'arms', 'legs', 'shield'];
export const ASM_LABEL = {hero: 'HERO', head: 'HEAD', torso: 'TORSO', arms: 'ARMS', legs: 'LEGS', shield: 'SHIELD'};
export const ASSEMBLIES = ['hero', ...SUBS];
export const DISPLAY = ['labels', 'exploded', 'xray', 'turntable'];
export const DISPLAY_LABEL = {labels: 'LABELS', exploded: 'EXPLODED', xray: 'X-RAY', turntable: 'TURNTABLE'};
export const SUB_ROWS = [
  ['horn', 'HEAD UNIT', 'HORN · V-FIN · MAIN CAMERA'],
  ['visor', 'FACE', 'VISOR · TWIN MASK · DUAL EYE'],
  ['torso', 'TORSO', 'CHEST · COLLAR · BACKPACK'],
  ['arms', 'ARMS', 'SHOULDER · FOREARM SPLIT'],
  ['legs', 'LEGS', 'THIGH · KNEE · SHIN · FOOT'],
  ['shield', 'SHIELD', '4 PETALS · FRAME CROSS'],
];
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(30,40,60,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 8.6px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:22px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fdfefe;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.ink};white-space:nowrap}
.bd{position:absolute;height:13px;padding:0 5px;display:flex;align-items:center;border-radius:2px;font:700 7.6px 'JetBrains Mono',monospace;letter-spacing:.9px;color:#fff;white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.6px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const pad = (n) => String(Math.floor(n)).padStart(2, '0');

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const deco = el(`<svg style="position:absolute;inset:0;pointer-events:none" width="1600" height="900"></svg>`);
  app.appendChild(deco);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 12}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 14}px">${n}</div>`);
  };
  const txt = (x, y, h, cls = 'sm', extra = '') => add(`<div class="${cls}" style="position:absolute;left:${x}px;top:${y}px;${extra}">${h}</div>`);
  const rtxt = (r, y, h, cls = 'sm', extra = '') => add(`<div class="${cls}" style="position:absolute;right:${1600 - r}px;top:${y}px;${extra}">${h}</div>`);

  // ------------------------------------------------------------ top bar
  add(`<div style="position:absolute;left:0;top:0;width:150px;height:84px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:22px;top:20px" width="44" height="44" viewBox="0 0 44 44"><path d="M22 2L26 26H18Z" fill="#fff"/><path d="M8 40L18 26H26L36 40Z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>`);
  txt(76, 34, 'RX-0', 'mo', 'color:#fff;font-size:15px;font-weight:600;letter-spacing:3px');
  txt(172, 18, 'FULL PSYCHO-FRAME PROTOTYPE · STUDY MODEL 1/10');
  txt(171, 32, `RX-0 Unicorn <span style="color:${C.or};font-weight:400">/</span>`, '', 'font-size:30px;font-weight:700;letter-spacing:-.6px;line-height:1');
  txt(172, 68, 'NT-D TRANSFORMATION / FRAME SIMULATOR', 'mo', 'font-size:10px;letter-spacing:2.1px;color:#5a646c');
  txt(560, 16, 'NT-D LOAD');
  const loadSeg = add(`<div style="position:absolute;left:560px;top:31px;width:250px;height:12px"></div>`);
  const loadPct = txt(780, 16, '', 'mo', 'font-size:9px;font-weight:700');
  txt(560, 48, 'STANDBY'), txt(668, 48, 'ENGAGE'), txt(778, 48, 'DESTROY');
  const topCols = [['UNIT', 850], ['RUNTIME', 950], ['STATUS', 1060], ['PILOT', 1250]].map(([n, x]) => {
    txt(x, 16, n);
    return txt(x, 31, '', 'mo', 'font-size:10.5px;font-weight:700;letter-spacing:1px');
  });
  txt(1478, 30, 'RX-0', '', `color:${C.or};font-size:30px;font-weight:700;letter-spacing:-.6px`);
  {
    let h = '';
    for (let c = 0; c < 26; c++) h += `<path d="M${c * 22 + 4} 0v8M${c * 22} 4h8" stroke="${C.or}" stroke-width="1" opacity=".5"/>`;
    add(`<svg style="position:absolute;left:560px;top:66px" width="580" height="10">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 nt-d
  panel(24, 100, 282, 200, 'NT-D', '01');
  const ntdBig = txt(38, 128, '', '', 'font-size:32px;font-weight:700;letter-spacing:-.8px');
  txt(38, 166, 'TRANSFORMATION');
  const ntdState = rtxt(292, 136, '', 'mo', 'font-size:11px;font-weight:700;letter-spacing:1.4px');
  const stageRows = STAGES.map((s, i) => {
    const y = 190 + i * 21;
    txt(38, y, s.name, 'sm', 'font-size:8px');
    add(`<div style="position:absolute;left:150px;top:${y + 4}px;width:100px;height:4px;background:#e6ebee;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:150px;top:${y + 4}px;height:4px;background:${C.or};border-radius:2px"></div>`);
    const v = rtxt(292, y - 1, '', 'mo', 'font-size:9.4px;font-weight:700');
    return {f, v};
  });

  // ------------------------------------------------------------ 02 psycho-frame
  panel(24, 312, 282, 176, 'PSYCHO-FRAME', '02');
  const pfBig = txt(38, 340, '', '', 'font-size:28px;font-weight:700;letter-spacing:-.6px');
  txt(38, 375, 'RESONANCE');
  const pfRate = rtxt(292, 346, '', 'mo', 'font-size:12px;font-weight:700');
  rtxt(292, 375, 'HEARTBEAT');
  const pfWave = add(`<svg style="position:absolute;left:38px;top:394px" width="254" height="56"></svg>`);
  txt(38, 462, 'EXPOSED');
  add(`<div style="position:absolute;left:100px;top:466px;width:150px;height:4px;background:#e6ebee;border-radius:2px"></div>`);
  const expF = add(`<div style="position:absolute;left:100px;top:466px;height:4px;background:${C.or};border-radius:2px"></div>`);
  const expV = rtxt(292, 461, '', 'mo', 'font-size:9.4px;font-weight:700');

  // ------------------------------------------------------------ 03 frame
  panel(24, 500, 282, 238, 'FRAME', '03');
  const hBig = txt(38, 528, '', '', 'font-size:28px;font-weight:700;letter-spacing:-.6px');
  txt(38, 563, 'HEAD HEIGHT');
  const hDelta = rtxt(292, 534, '', 'mo', `font-size:13px;font-weight:700;color:${C.or}`);
  rtxt(292, 563, 'GROWTH');
  const growRows = [['THIGH', 'thigh', 'legs'], ['SHIN', 'shin', 'legs'], ['WAIST', 'waist', 'torso'], ['NECK', 'neck', 'head']].map(([n, k, stg], i) => {
    const y = 590 + i * 22;
    txt(38, y, n);
    add(`<div style="position:absolute;left:100px;top:${y + 4}px;width:130px;height:4px;background:#e6ebee;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:100px;top:${y + 4}px;height:4px;background:${C.ink};border-radius:2px"></div>`);
    const v = rtxt(292, y - 1, '', 'mo', 'font-size:9.4px;font-weight:700');
    return {f, v, k, stg};
  });
  add(`<div style="position:absolute;left:38px;top:684px;width:254px;height:1px;background:${C.line}"></div>`);
  const hScale = add(`<svg style="position:absolute;left:38px;top:692px" width="254" height="36"></svg>`);

  // ------------------------------------------------------------ 04 mode
  panel(1318, 100, 258, 150, 'MODE', '04');
  const modeName = txt(1332, 128, '', '', 'font-size:22px;font-weight:800;letter-spacing:-.4px');
  const modeSub2 = txt(1332, 156, '', 'sm');
  add(`<div style="position:absolute;left:1332px;top:178px;width:230px;height:1px;background:${C.line}"></div>`);
  const stats = [0, 1, 2].map((i) => {
    const x = 1332 + i * 78;
    if (i) add(`<div style="position:absolute;left:${x - 8}px;top:188px;width:1px;height:44px;background:${C.line}"></div>`);
    const v = txt(x, 190, '', '', 'font-size:16px;font-weight:700');
    const n = txt(x, 214, '', 'sm', 'font-size:7.8px');
    return {v, n};
  });

  // ------------------------------------------------------------ 05 assemblies, 06 display
  const btn = {};
  const btnRow = (keys, labels, x0, y, wmax = 232) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 6.9 + 18);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 28;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 5;
    }
  };
  panel(1318, 262, 258, 104, 'ASSEMBLIES', '05');
  btnRow(ASSEMBLIES, ASM_LABEL, 1332, 296);
  panel(1318, 378, 258, 120, 'DISPLAY', '06');
  btnRow(DISPLAY, DISPLAY_LABEL, 1332, 412);
  btn.ntd = add(`<div class="bt" style="left:1332px;top:466px;width:230px;height:24px;border:none;background:${C.or};color:#fff;font-size:10px;letter-spacing:2.4px">NT-D</div>`);

  // ------------------------------------------------------------ 07 subsystems
  panel(1318, 510, 258, 228, 'SUBSYSTEMS', '07');
  const rows = SUB_ROWS.map(([k, name, sub], i) => {
    const y = 540 + i * 31;
    txt(1332, y, String(i + 1).padStart(2, '0'), 'mo', `font-size:8.4px;color:${C.mute}`);
    const nm = txt(1352, y - 1, name, 'mo', 'font-size:9.4px;font-weight:700;letter-spacing:1px');
    txt(1352, y + 11, sub, 'sm', 'font-size:7.2px;letter-spacing:1px');
    const bd = add(`<div class="bd" style="right:${1600 - 1562}px;top:${y}px"></div>`);
    return {k, nm, bd};
  });

  // ------------------------------------------------------------ viewport overlays
  const isoTag = txt(1100, 104, '', 'sm', 'width:200px;text-align:right');
  txt(334, 104, 'STUDY MODEL RX-0 · REV A');
  txt(336, 616, 'OPERATING MODE');
  const modeBig = txt(334, 630, '', '', `font-size:34px;font-weight:800;letter-spacing:-.6px;color:${C.or};line-height:1`);
  const modeSub = txt(336, 670, '');

  // ------------------------------------------------------------ 08 operation log
  panel(330, 752, 940, 108, 'OPERATION LOG', '08');
  btn.play = add(`<div class="bt" style="left:346px;top:794px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:15px"></div>`);
  txt(408, 790, 'UNICORN');
  const opPhase = add(`<div class="mo" style="position:absolute;left:408px;width:690px;top:789px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  txt(1060, 790, 'DESTROY');
  const TL = {x: 410, w: 690};
  add(`<div style="position:absolute;left:${TL.x}px;top:818px;width:${TL.w}px;height:3px;background:#e6ebee;border-radius:2px"></div>`);
  const tlTicks = add(`<svg style="position:absolute;left:${TL.x}px;top:812px" width="${TL.w}" height="15"></svg>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:818px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:812px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const tlTime = txt(408, 832, '', 'mo', `font-size:9.4px;color:${C.mute};letter-spacing:1px`);
  const tlActs = rtxt(1100, 833, '', 'sm');
  txt(1122, 800, 'TRANSFORM');
  const SP = {x: 1124, w: 100};
  add(`<div style="position:absolute;left:${SP.x}px;top:821px;width:${SP.w}px;height:3px;background:#e6ebee;border-radius:2px"></div>`);
  const spFill = add(`<div style="position:absolute;left:${SP.x}px;top:821px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const spKnob = add(`<div style="position:absolute;top:815px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const spVal = txt(1124, 834, '', 'mo', 'font-size:9.6px;font-weight:700');

  txt(24, 880, 'FRAME SIMULATOR &nbsp;·&nbsp; PROCEDURAL MODEL &nbsp;·&nbsp; ONE INPUT: NT-D PROGRESS', 'sm', 'letter-spacing:2px');
  rtxt(1576, 880, `PERSONAL STUDY · NOT AN OFFICIAL MODEL <span style="color:${C.or}">//////</span>`, 'sm', 'letter-spacing:2px');

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => [parseFloat(n.style.left) + parseFloat(n.style.width) / 2, parseFloat(n.style.top) + (parseFloat(n.style.height) || 22) / 2];
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const fmt = (s) => `${pad(s / 60)}:${pad(s % 60)}`;
  let ticksFor = null;
  const seg = (n, k, w, h, gap, on, off = '#e3e8eb') => {
    let o = '';
    for (let i = 0; i < n; i++) o += `<div style="position:absolute;left:${i * (w + gap)}px;top:0;width:${w}px;height:${h}px;border-radius:1px;background:${(i + 0.5) / n < k ? on(i) : off}"></div>`;
    return o;
  };
  const badge = (n, text, kind) => {
    n.style.background = {ok: C.green, warn: C.or, idle: '#b7bfc4', ink: C.ink, gold: C.gold}[kind];
    n.textContent = text;
  };

  return {
    spots,
    btn,
    root: ui,
    TL,
    SP,
    update(s) {
      const d = s.d;
      // top bar
      loadSeg.innerHTML = seg(40, d, 4.4, 12, 1.8, (i) => (i < 30 ? C.ink : C.or));
      loadPct.textContent = `${Math.round(d * 100)}%`;
      topCols[0].textContent = 'RX-0 · 01';
      topCols[1].textContent = `00:${fmt(s.runtime)}`;
      topCols[2].innerHTML = `<span style="color:${C.or}">●</span> ${s.mode}`;
      topCols[3].textContent = 'NT · LINKED';
      // nt-d
      ntdBig.innerHTML = `${Math.round(d * 100)}<span style="font-size:13px;font-weight:600;color:${C.mute}">%</span>`;
      ntdState.textContent = d < 0.002 ? 'STANDBY' : d > 0.998 ? 'COMPLETE' : 'ENGAGING';
      ntdState.style.color = d > 0.998 ? C.or : C.ink;
      STAGES.forEach((st, i) => {
        const k = s.stages[st.key];
        stageRows[i].f.style.width = `${(k * 100).toFixed(1)}px`;
        stageRows[i].v.textContent = `${Math.round(k * 100)}%`;
      });
      // psycho-frame: the heartbeat trace over the last 4 s
      pfBig.innerHTML = `${Math.round(s.resonance * 100)}<span style="font-size:13px;font-weight:600;color:${C.mute}">%</span>`;
      pfRate.textContent = `${s.beat.toFixed(2)} Hz`;
      {
        const W = 254;
        const H = 50;
        let p = '';
        for (let i = 0; i <= 100; i++) {
          const tt = s.runtime - 4 + (i / 100) * 4;
          const v = Math.pow(Math.sin(tt * Math.PI * 2 * s.beat), 2) * (0.25 + 0.75 * s.exposure);
          p += `${i ? 'L' : 'M'}${((i / 100) * W).toFixed(1)} ${(H - 4 - v * (H - 10)).toFixed(1)}`;
        }
        pfWave.innerHTML = `<line x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}" stroke="${C.line}"/><path d="${p}" fill="none" stroke="${C.or}" stroke-width="1.4"/><circle cx="${W}" cy="${(H - 4 - Math.pow(Math.sin(s.runtime * Math.PI * 2 * s.beat), 2) * (0.25 + 0.75 * s.exposure) * (H - 10)).toFixed(1)}" r="3.4" fill="${C.or}"/>`;
      }
      expF.style.width = `${(s.exposure * 150).toFixed(1)}px`;
      expV.textContent = `${Math.round(s.exposure * 100)}%`;
      // frame
      hBig.innerHTML = `${s.height.toFixed(2)}<span style="font-size:13px;font-weight:600;color:${C.mute}"> m</span>`;
      hDelta.textContent = `+${(s.height - SPEC.hUnicorn).toFixed(2)} m`;
      for (const r of growRows) {
        const k = s.stages[r.stg];
        r.f.style.width = `${(k * 130).toFixed(1)}px`;
        r.v.textContent = `+${(GROW[r.k] * SCALE * k).toFixed(2)}`;
      }
      {
        const W = 254;
        const X = (h) => ((h - 19) / 3.2) * W;
        hScale.innerHTML = `<line x1="0" x2="${W}" y1="14" y2="14" stroke="${C.ink}"/>${[19, 20, 21, 22].map((h) => `<line x1="${X(h)}" x2="${X(h)}" y1="10" y2="18" stroke="${C.mute}"/><text x="${X(h)}" y="32" font-size="7.4" text-anchor="middle" fill="${C.mute}" font-family="JetBrains Mono">${h} M</text>`).join('')}
          <line x1="${X(SPEC.hUnicorn)}" x2="${X(SPEC.hUnicorn)}" y1="4" y2="14" stroke="${C.ink}" stroke-width="1.4"/><line x1="${X(SPEC.hDestroy)}" x2="${X(SPEC.hDestroy)}" y1="4" y2="14" stroke="${C.ink}" stroke-width="1.4"/>
          <path d="M${X(s.height)} 14l-5 -9h10z" fill="${C.or}"/>`;
      }
      // mode
      modeName.textContent = d < 0.5 ? 'UNICORN MODE' : 'DESTROY MODE';
      modeName.style.color = d < 0.5 ? C.ink : C.or;
      modeSub2.textContent = d < 0.002 ? 'ARMOR SEALED · HORN CLOSED' : d > 0.998 ? 'FRAME EXPOSED · V-FIN OPEN' : 'ARMOR RELEASING';
      [[`${SPEC.massEmpty}`, 'MASS T EMPTY'], [`${SPEC.massFull}`, 'MASS T FULL'], [`${s.openPlates}/${s.plates}`, 'PLATES OPEN']].forEach(([v, n], i) => {
        stats[i].v.textContent = v;
        stats[i].n.textContent = n;
      });
      // buttons
      const onBtn = (k, on) => {
        btn[k].style.background = on ? C.or : '#fdfefe';
        btn[k].style.color = on ? '#fff' : C.ink;
        btn[k].style.borderColor = on ? C.or : C.faint;
      };
      onBtn('hero', !s.focus);
      for (const k of SUBS) onBtn(k, s.focus === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      btn.ntd.textContent = s.ntdTarget > 0.5 ? 'NT-D · RELEASE' : 'NT-D · ENGAGE';
      btn.ntd.style.background = s.ntdTarget > 0.5 ? C.ink : C.or;
      for (const r of rows) {
        const [text, kind] = s.subStatus[r.k];
        badge(r.bd, text, kind);
        r.nm.style.color = s.focus && (s.focus === r.k || (s.focus === 'head' && (r.k === 'horn' || r.k === 'visor'))) ? C.or : C.ink;
      }
      // viewport
      isoTag.textContent = s.focus ? `ISOLATE · ${ASM_LABEL[s.focus]}` : s.display.exploded ? 'ISOLATE · ALL' : '';
      modeBig.textContent = s.bigMode;
      modeSub.textContent = s.bigSub;
      {
        let g = '';
        if (s.centre) {
          const [cx, cy] = s.centre;
          for (const [r, o] of [[220, 0.55], [320, 0.4], [420, 0.25]]) g += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#b7c0c6" stroke-width=".8" opacity="${o}"/>`;
          g += `<line x1="${cx - 460}" x2="${cx + 460}" y1="${cy}" y2="${cy}" stroke="#b7c0c6" stroke-width=".6" stroke-dasharray="2 5" opacity=".6"/>`;
          g += `<line x1="${cx}" x2="${cx}" y1="${cy - 380}" y2="${cy + 380}" stroke="#b7c0c6" stroke-width=".6" stroke-dasharray="2 5" opacity=".6"/>`;
          const a = (s.runtime * 0.25) % (Math.PI * 2);
          for (let k = 0; k < 3; k++) {
            const t = a + (k * Math.PI * 2) / 3;
            g += `<circle cx="${cx + Math.cos(t) * 320}" cy="${cy + Math.sin(t) * 320}" r="3" fill="none" stroke="${C.or}" stroke-width="1" opacity=".7"/>`;
          }
        }
        deco.innerHTML = g;
      }
      // operation log
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.log;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${(TL.x + s.prog * TL.w).toFixed(1)}px`;
      tlTime.textContent = `${fmt(s.tau)} / ${fmt(s.dur)}`;
      tlActs.textContent = `${s.actions} OPERATOR ACTIONS`;
      if (ticksFor !== s.ticks) {
        ticksFor = s.ticks;
        tlTicks.innerHTML = (s.ticks || []).map((u) => `<line x1="${(u * TL.w).toFixed(1)}" x2="${(u * TL.w).toFixed(1)}" y1="2" y2="13" stroke="${C.faint}" stroke-width="1"/>`).join('');
      }
      spFill.style.width = `${(d * SP.w).toFixed(1)}px`;
      spKnob.style.left = `${(SP.x + d * SP.w).toFixed(1)}px`;
      spVal.textContent = `${Math.round(d * 100)}% NT-D`;
      // labels
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const ex = lx > ax ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
