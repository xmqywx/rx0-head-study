// The RX-0 head, traced from the orthographic sheets in ../reference (Unicorn Mode front/side/back/top, Destroy Mode
// the same, an internal exploded view). Origin: the visor centre line, +z forward, +x the head's left, 1 unit = 100 px
// of the sheet. Outside: helmet plates cut from one surface S(u, y), the brow, forehead block, visor and mask halves
// as chamfered prisms, the horn as two segmented halves on a hinge. Inside: a graphite skull, psycho-frame strips
// laid under every seam, the dual-eye sensor unit, three mask actuator rails, the horn hinge, vulcans, cooling ducts
// in the ear pods and a neck ball joint. update({d, explode, armor, time}) poses all of it from kin.js.
import * as THREE from 'three';
import {D2R, loftBody, makeSurface, Mesher, mirrorX, prism, prismSplit, shellPlate, prismDense, sweep, viewHull, foldedShell, planarPanel} from './geo.js';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {mergeGeometries, toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {applyDecals} from './decals.js';
import {bearing, bracket, cables, clevis, gear, linkArm, linkPlate, motor, piston, place, rib, socket} from './mechparts.js';
const merge3 = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
import {CROWN, FACE, FIN, FRAME_RISE, HORN, MASK, pose} from './kin.js';

const V3 = THREE.Vector3;
// the face's depth, measured off the Unicorn side view (centre line), with a cross curve back toward the cheeks
// read at 3x off reference/grid/f3-side.png: upper face bulging 1.32 → 1.13, hollow at the fold, chin bulge 1.18, bottom 1.08
// the face leans back in one straight slope from the visor (z 1.33) to the jaw (1.15 at y −.85): no waves; the
// layering comes from the parts standing at different heights (FACE_PARTS), not from bending one surface
// one gentle fold (the user's red line, side view): the face leans slightly OUT from the visor to y −.4, then back
const FACE_PROFILE = [[0.3, 1.33], [-0.4, 1.37], [-1.0, 1.16], [-1.6, 1.02]];
const faceZ = (y) => {
  const P = FACE_PROFILE;
  if (y >= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++)
    if (y >= P[i + 1][0]) {
      const t = (y - P[i][0]) / (P[i + 1][0] - P[i][0]);
      return P[i][1] + (P[i + 1][1] - P[i][1]) * t; // linear: flat facets between the folds
    }
  return P[P.length - 1][1];
};
// top view (f3-top.png): a narrow front 0.2 wide, then the sides turn back ~35°, reaching z .87 at the mask edge
const FACE_SURF = (x, y) => {
  const a = Math.abs(x);
  const o = Math.max(0, a - 0.2);
  return faceZ(y) - 0.1 * a - 0.42 * o; // planar either side of the x = .2 fold; mask edge (x .74) ≈ z 1.02, cheek front (.92) ≈ .91: the side view's cheek edge
};
// reference/parts/face.png (front view, centre x 263): x = (px − 263)/225, y = .15 − .00384 (py − 400)
const FP = ([px, py]) => [(px - 263) / 225, 0.15 - 0.0034 * (py - 400)]; // the part sheet draws the face taller than the head sheet
const POD_UP = 0.08;
const POD_TUCK = {back: 0.55, in: 0.5, down: 0.05}; // into its bay under the rear side plates // the pod's rail travel in NT-D // the side sheet sets the pod low on the head, the front sheet higher; the side wins (it is the view people read)

// helmet surface, read off the Unicorn sheet: [y, half width, front z, back z]
const SHELL = [
  [-1.15, 0.68, 0.85, -0.85],
  [-0.55, 0.92, 1.15, -1.1],
  [0.3, 1.07, 1.35, -1.45],
  [0.95, 0.9, 1.08, -1.3],
  [1.4, 0.66, 0.86, -1.05],
  [1.62, 0.5, 0.78, -0.8],
  [1.8, 0.3, 0.66, -0.3],
  [1.9, 0.14, 0.44, -0.12],
];
// the skull under it, pulled in, with the face recessed for the faceplate and eye unit
const CORE = [
  [-1.2, 0.56, 0.62, -0.74],
  [-0.55, 0.8, 0.8, -0.98],
  [0.3, 0.95, 0.92, -1.37],
  [0.95, 0.86, 0.92, -1.18],
  [1.4, 0.6, 0.5, -0.78],
  [1.62, 0.38, 0.4, -0.48],
  [1.8, 0.18, 0.3, -0.2],
  [1.87, 0.08, 0.2, -0.06],
];

// helmet plates, left side (mirrored for the right): u in degrees at the plate's bottom (ub) and top (ut)
// red: which edges carry a psycho-frame strip underneath (b/t bottom/top, l/r the u0/u1 side)
const PLATES = [
  {k: 'crownR', side: 1.0, ub: [58, 166], ut: [76, 166], yb: [1.5, 1.42], yt: [1.98, 1.98], lift: 1, up: 1, red: 'b', off: 0.05, t: 0.1},
  {k: 'rearUp', side: 0.9, ub: [118, 166], ut: [118, 166], y: [0.45, 1.42], lift: 0.8, up: 0.4, red: 'lbr', off: 0.025, t: 0.11},
  {k: 'sideMidHi', side: 1, ub: [59, 118], ut: [56, 118], y: [0.12, 0.78], lift: 0.35, up: 0, red: ''},
  {k: 'sideMid', tuck: 1, side: 1, ub: [62, 118], ut: [59, 118], y: [-0.5, 0.12], lift: 0.35, up: 0, red: ''}, // the jaw side: tucks back in NT-D
  {k: 'rearLow', side: 2.4, ub: [118, 166], ut: [118, 166], yb: [-0.86, -0.9], yt: [0.45, 0.45], lift: 0.6, up: 0, red: 'lr', off: -0.01},
  {k: 'sideLow', tuck: 1, side: 1, ub: [68, 118], ut: [62, 118], yb: [-1.05, -0.86], yt: [-0.5, -0.5], lift: 0.3, up: 0, red: ''},
];
function materials() {
  const std = (o) => new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0, envMapIntensity: 0.6, ...o});
  return {
    white: std({color: '#f1f2ef', roughness: 0.62, envMapIntensity: 0.5}),
    grey: std({color: '#c3c8cc', roughness: 0.6}),
    frame: std({color: '#3a3f45', roughness: 0.55, metalness: 0.35}),
    frameMid: std({color: '#5c636a', roughness: 0.5, metalness: 0.4}),
    steel: std({color: '#8d959c', roughness: 0.35, metalness: 0.7}),
    visor: std({color: '#1b2128', roughness: 0.16, metalness: 0.5, envMapIntensity: 1}),
    lens: std({color: '#0d1114', roughness: 0.75, metalness: 0.05, envMapIntensity: 0.15}),
    redHot: std({color: '#ff9a80', emissive: '#ff5030', emissiveIntensity: 0, roughness: 0.3}),
    red: std({color: '#d8261a', emissive: '#ff1a0a', emissiveIntensity: 0, roughness: 0.3, metalness: 0.15, envMapIntensity: 0.9}),
    chin: std({color: '#c8262a', roughness: 0.4}),
    maroon: std({color: '#6e1d1a', roughness: 0.45}),
    eyeRim: std({color: '#123a1c', roughness: 0.4}),
    camGreen: std({color: '#1d5a32', emissive: '#2fbf5c', emissiveIntensity: 0, roughness: 0.35}), // the camera: darker and dimmer than the eyes
    green: std({color: '#0f2016', emissive: '#39ff6e', emissiveIntensity: 0, roughness: 0.55, envMapIntensity: 0.3}),
    ink: new THREE.LineBasicMaterial({color: '#2a2f35', transparent: true, opacity: 0.8}),
  };
}

export function buildHead() {
  const M = materials();
  const ARMOR = [M.white, M.grey, M.visor];
  const root = new THREE.Group();
  const surf = makeSurface(SHELL, 2.6, 1, 16); // 16 flat facets around: panels, not an egg
  const core = makeSurface(CORE, 2.6);
  const parts = []; // {obj, home: V3, ex: V3 (explode offset), pose(p, obj)}
  const anchors = {};
  const inkLines = [];

  // ink: true for white/grey parts; a number sets the crease angle (curved parts use a high one so only real
  // creases and outlines are drawn, not the facets of the curve)
  const mesh = (geo, mat, ink = mat === M.white || mat === M.grey) => {
    // a numeric ink marks a curved part: smooth its normals across shallow angles so the facets of the curve do not band
    if (typeof ink === 'number') geo = toCreasedNormals(geo, 28 * D2R);
    const o = new THREE.Mesh(geo, mat);
    o.castShadow = true;
    o.receiveShadow = true;
    if (ink) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, typeof ink === 'number' ? ink : 24), M.ink);
      l.raycast = () => {};
      o.add(l);
      inkLines.push(l);
    }
    return o;
  };
  // a group whose origin sits at pivot P, so rotations turn about P; children are built in head coordinates
  const pivot = (P, ...objs) => {
    const g = new THREE.Group();
    g.position.copy(P);
    const inner = new THREE.Group();
    inner.position.copy(P).negate();
    inner.add(...objs);
    g.add(inner);
    return g;
  };
  const add = (obj, ex, fn, parent = root) => {
    parent.add(obj);
    const part = {obj, home: obj.position.clone(), homeQ: obj.quaternion.clone(), ex: ex || new V3(), fn};
    parts.push(part);
    return part;
  };
  const geoOf = (fill) => {
    const m = new Mesher();
    fill(m);
    return m.geo();
  };

  // ---------------------------------------------------------------- inner frame skull
  // A machine, not an egg (reference/rx0-head-internal-exploded-view.png): a central spine carrying six machined
  // decks that follow the head's profile, and between the decks, round the perimeter, chunky modules — machined
  // housings with recessed panels, paired actuators, gear trains on the outer faces, servo blocks — at the scale the
  // exploded view draws them (.2–.45 units), each one aimed outward. Merged into one mesh per material.
  const skull = new THREE.Group();
  // the inner skin the frame plates retract behind (hidden when the armor is ghosted or exploded, to show the machine)
  const innerSkin = mesh(loftBody(core, [-1.2, -0.85, -0.55, -0.1, 0.3, 0.65, 0.95, 1.2, 1.4, 1.58, 1.72, 1.84], 24), M.frame, false);
  root.add(innerSkin);
  {
    const hash = (i, j) => {
      const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const dark = [];
    const mid = [];
    const steel = [];
    const UP = new V3(0, 1, 0);
    const B = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      g.deleteAttribute('uv');
      g.translate(x, y, z);
      return g;
    };
    // the spine
    dark.push(B(0.42, 3.0, 0.5, 0, 0.35, -0.2));
    const DY = [-1.12, -0.62, -0.12, 0.38, 0.88, 1.36, 1.72];
    const prof = (y) => {
      const [hw, zf, zb] = core.at(y);
      return {hw: hw * 0.9, zf: zf * 0.9, zb: zb * 0.9, zc: (zf + zb) / 2};
    };
    // decks: chamfered octagons at each level
    for (const y of DY) {
      const {hw, zf, zb} = prof(y);
      const c = Math.min(hw, (zf - zb) / 2) * 0.35;
      const oct = [[-hw + c, zb], [hw - c, zb], [hw, zb + c], [hw, zf - c], [hw - c, zf], [-hw + c, zf], [-hw, zf - c], [-hw, zb + c]];
      mid.push(geoOf((m) => prism(m, oct, 'y', y - 0.04, y + 0.04, 0.015)));
    }
    // between the decks: structural posts tying each deck to the next, and in every bay a joint assembly from the
    // exploded view — a two-link arm on clevises, a bearing joint on a bracket, paired actuators with clevis ends,
    // or a gear pair on a bearing — each aimed outward, so the interior reads as linked machinery
    for (let i = 0; i < DY.length - 1; i++) {
      const y0 = DY[i] + 0.04;
      const y1 = DY[i + 1] - 0.04;
      const ym = (y0 + y1) / 2;
      const hgt = y1 - y0;
      const {hw, zf, zb, zc} = prof(ym);
      const rz = (zf - zb) / 2;
      const N = hw > 0.5 ? 10 : 6;
      for (let k = 0; k < N; k++) {
        const a = ((k + 0.5 * (i % 2)) / N) * Math.PI * 2;
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        const n = new V3(dx / hw, 0, dz / rz).normalize();
        const t = new V3(-n.z, 0, n.x);
        const p = new V3(dx * hw * 0.8, ym, zc + dz * rz * 0.8);
        // a post at every other bay boundary
        if (k % 2 === 0) {
          const q = new V3(Math.sin(a - Math.PI / N) * hw * 0.86, ym, zc + Math.cos(a - Math.PI / N) * rz * 0.86);
          dark.push(place(rib(hgt), q, n, UP));
        }
        const h = hash(i * 5.3, k * 2.9);
        if (h < 0.3) {
          dark.push(place(clevis(0.14, 0.08), p.clone().addScaledVector(UP, -hgt * 0.42), UP, n));
          steel.push(place(linkArm(hgt * 0.45, hgt * 0.38, 0.8 + h), p.clone().addScaledVector(UP, -hgt * 0.3).addScaledVector(n, 0.06), n, UP, (h - 0.15) * 2));
        } else if (h < 0.55) {
          mid.push(place(bracket(0.2, hgt * 0.7), p, n, UP));
          steel.push(place(bearing(Math.min(0.1, hgt * 0.28)), p.clone().addScaledVector(n, 0.06), n, UP));
          steel.push(place(linkPlate(hgt * 0.4, 0.06), p.clone().addScaledVector(n, 0.12), n, t, 0.6));
        } else if (h < 0.78) {
          for (const o of [-0.07, 0.07]) {
            steel.push(place(piston(hgt * 0.8, 0.028), p.clone().addScaledVector(t, o), n, UP));
            dark.push(place(clevis(0.09, 0.05, 0.035), p.clone().addScaledVector(t, o).addScaledVector(UP, -hgt * 0.45), UP, n));
          }
        } else {
          mid.push(place(socket(0.16), p.clone().addScaledVector(UP, -hgt * 0.35), UP, n));
          steel.push(place(gear(Math.min(hgt * 0.3, 0.12), 16, 0.04), p.clone().addScaledVector(n, 0.08), n, UP, h * 9));
          steel.push(place(bearing(0.05, 0.05), p.clone().addScaledVector(n, 0.1).addScaledVector(t, 0.14), n, UP));
        }
      }
    }
    // the mounting joints, where armor hangs on the frame: mask hinges, horn-root socket, cheek and pod pivots
    for (const sx of [1, -1]) {
      const pr = (x, y, z) => new V3(sx * x, y, z);
      steel.push(place(bearing(0.08, 0.06), pr(0.72, -0.35, 0.72), pr(1, 0, 0.3).normalize(), UP));
      dark.push(place(clevis(0.16, 0.1), pr(0.66, -0.75, 0.62), pr(1, 0, 0.2).normalize(), UP));
      steel.push(place(linkArm(0.3, 0.24, 1.1), pr(0.7, -0.6, 0.55), pr(1, 0, 0).normalize(), UP, sx * 0.2));
      steel.push(place(bearing(0.1, 0.07), pr(0.86, 0.05, -0.3), pr(1, 0, 0), UP));
      dark.push(place(clevis(0.18, 0.12), pr(0.8, 0.45, -0.25), pr(1, 0.2, 0).normalize(), UP));
    }
    mid.push(place(socket(0.24), new V3(0, 1.62, 0.55), UP, new V3(0, 0, 1)));
    // the face recess (behind the faceplate, between the opened mask halves): actuators, the jaw gear train, servos
    for (const sx of [1, -1]) {
      const pr = (x, y, z) => new V3(sx * x, y, z);
      const fwd = new V3(0, 0, 1);
      steel.push(place(piston(0.5, 0.04), pr(0.32, -0.55, 0.78), fwd, new V3(sx * 0.3, 1, 0)));
      steel.push(place(piston(0.36, 0.03), pr(0.55, -0.2, 0.72), fwd, new V3(-sx * 0.4, 1, 0)));
      steel.push(place(gear(0.11, 16), pr(0.5, -0.82, 0.74), fwd, UP, 0.3));
      steel.push(place(gear(0.06, 10), pr(0.62, -0.68, 0.76), fwd, UP, 0.1));
      mid.push(place(motor(0.16, 0.12, 0.08), pr(0.2, -1.05, 0.7), fwd, UP));
      mid.push(place(bracket(0.2, 0.18), pr(0.62, 0.05, 0.66), fwd, UP));
      dark.push(place(cables([pr(0.1, 0.0, 0.0), pr(0.2, -0.3, 0.06), pr(0.12, -0.7, 0.02)]), pr(0.15, -0.3, 0.74), fwd, UP));
    }
    for (const [list, mat] of [[dark, M.frame], [mid, M.frameMid], [steel, M.steel]]) if (list.length) skull.add(mesh(mergeGeometries(list), mat, false));
  }

  // ---------------------------------------------------------------- psycho-frame: red parts, not lights
  // Chunky red segments chained along every armor seam, seated on the skull. In Unicorn Mode their tops sit just
  // under the plates' undersides, so the seams read dark; in NT-D the plates lift off and the frame rises into the
  // gaps. Each chain is its own part so the explode can float it between the skull and the armor.
  const frameParts = [];
  const chain = (path, {w = 0.06, h = 0.035, base = -0.09, seg = 0.24, gap = 0.025} = {}) => {
    // densify the (u, y) polyline, measure it in world space, then cut it into segments
    const pts = [];
    for (let i = 0; i < path.length - 1; i++)
      for (let k = 0; k < 12; k++) {
        const t = k / 12;
        pts.push([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]);
      }
    pts.push(path[path.length - 1]);
    const W3 = pts.map(([u, y]) => surf.S(u * D2R, y));
    const N3 = pts.map(([u, y]) => surf.normal(u * D2R, y));
    const len = [0];
    for (let i = 1; i < W3.length; i++) len.push(len[i - 1] + W3[i].distanceTo(W3[i - 1]));
    const L = len[len.length - 1];
    const at = (s) => {
      let i = 1;
      while (i < len.length - 1 && len[i] < s) i++;
      const t = (s - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return {p: W3[i - 1].clone().lerp(W3[i], t), n: N3[i - 1].clone().lerp(N3[i], t).normalize()};
    };
    const m = new Mesher();
    const n = Math.max(1, Math.round((L + gap) / (seg + gap)));
    const sl = (L - gap * (n - 1)) / n;
    for (let k = 0; k < n; k++) {
      const s0 = k * (sl + gap);
      const ss = [s0, s0 + sl * 0.5, s0 + sl];
      const fr = ss.map(at);
      const path3 = fr.map((f) => f.p.clone().addScaledVector(f.n, base));
      const ups = fr.map((f) => f.n);
      // a flat, chamfered plate segment lying tight under the shell (exploded view: blocky angular units, stepping
      // sideways from one to the next), every third one with a tab that steps out to the side
      const o = (k % 2 ? 1 : -1) * w * 0.35;
      sweep(m, path3, ups, () => [[o - w, 0], [o + w, 0], [o + w * 0.8, h], [o - w * 0.8, h]]);
      if (k % 3 === 2 && sl > 0.12) {
        const c = at(s0 + sl * 0.3);
        const c2 = at(s0 + sl * 0.7);
        sweep(m, [c.p.clone().addScaledVector(c.n, base), c2.p.clone().addScaledVector(c2.n, base)], [c.n, c2.n], () => [[o + w, 0], [o + w * 2.1, 0], [o + w * 1.9, h], [o + w, h]]);
      }
    }
    const mid = at(L / 2);
    return {geo: m.geo(), n: mid.n, p: mid.p};
  };
  const edgePath = (c, e) => {
    const yb = c.yb || [c.y[0], c.y[0]];
    const yt = c.yt || [c.y[1], c.y[1]];
    if (e === 'b') return [[c.ub[0], yb[0]], [c.ub[1], yb[1]]];
    if (e === 't') return [[c.ut[0], yt[0]], [c.ut[1], yt[1]]];
    const i = e === 'l' ? 0 : 1;
    return [[c.ub[i], yb[i]], [c.ut[i], yt[i]]];
  };
  // each chain is built twice — seated under the shell, and risen by `rise` along the surface normal at every point —
  // and the second copy is its morph target, so in NT-D the whole strip lifts evenly into its seam however it curves
  const addChain = (path, opts, mirror = true, rise = FRAME_RISE) => {
    const {geo, n} = chain(path, opts);
    const up = chain(path, {...opts, base: (opts.base ?? -0.09) + rise}).geo;
    for (const s of mirror ? [1, -1] : [1]) {
      const g0 = s > 0 ? geo : mirrorX(geo);
      const g1 = s > 0 ? up : mirrorX(up);
      g0.morphAttributes.position = [g1.attributes.position];
      g0.morphAttributes.normal = [g1.attributes.normal];
      const g = new THREE.Group();
      const ms = mesh(g0, M.red, false);
      g.add(ms);
      const nn = n.clone();
      if (s < 0) nn.x = -nn.x;
      const part = add(g, nn.clone().multiplyScalar(0.5), (q) => (ms.morphTargetInfluences[0] = q.frame));
      frameParts.push(part);
    }
  };
  void addChain; // the psycho-frame is now the sheet under every plate (built at the end, see underSheets)
  add(skull, new V3(0, 0, 0));
  anchors.skull = {obj: skull, p: new V3(-0.7, 0.4, -1.0)};

  // ---------------------------------------------------------------- helmet plates
  const plateParts = [];
  const redPlates = []; // thin frame plates, one under each armor plate (built here, posed at the end)
  const T_ARMOR = 0.06;
  const T_RED = 0.022;
  const mkPlate = (c, side, extra = {}) => {
    const mirror = side < 0;
    const {geo, center, normal} = shellPlate(surf, c, {t: T_ARMOR, off: Math.min(c.off ?? 0, 0.02) - 0.02, gap: 0.028, bevel: 0.02, mirror});
    // its frame plate: the same outline, thin, lying just under it
    if (!c.tuck) redPlates.push(shellPlate(surf, c, {t: T_RED, off: Math.min(c.off ?? 0, 0.02) - 0.02 - T_RED - 0.008, gap: 0.0, bevel: 0.006, mirror}).geo);
    const o = mesh(geo, M.white);
    const g = new THREE.Group();
    g.add(o);
    const ex = normal.clone().multiplyScalar(1.15).add(new V3(0, 0.25, 0));
    const part = add(g, ex, (p, obj) => {
      const k = p.crown;
      obj.position.addScaledVector(normal, CROWN.lift * k * c.lift).add(new V3(Math.sign(center.x) * CROWN.spread * k * (c.side ?? 0), CROWN.rise * k * c.up, 0));
      // plates over the side of the jaw slide back and in under the rear plates in NT-D, uncovering the mask half's side wall
      if (c.tuck) obj.position.add(new V3(Math.sign(center.x) * 0.03 * p.cheek, 0, -0.22 * p.cheek)); // just clears the shorter side wall; no hole behind it
    });
    plateParts.push({part, center, c, ...extra});
    return part;
  };
  for (const c of PLATES) for (const s of [1, -1]) mkPlate(c, s);
  mkPlate({k: 'back', ub: [166, 194], ut: [166, 194], y: [-0.9, 1.42], lift: 0.5, up: 0.2, off: 0.04, t: 0.1}, 1);

  // ---------------------------------------------------------------- side armor, traced plate by plate
  // Outlines hand-traced from the side view of the colour-segmented Unicorn sheet (reference/grid/seg-side.png,
  // sheet px), each a flat plate: its outer face is the plane that best fits the shell under it, raised to clear the
  // shell, plus a standing height; mirrored for the right side. They lie over the PLATES layer (now the under-shell).
  {
    const tv = new V3();
    const shellX = (z, y) => {
      let lo = 0.02;
      let hi = Math.PI - 0.02;
      for (let k = 0; k < 28; k++) {
        const mid = (lo + hi) / 2;
        if (surf.S(mid, y, tv).z > z) lo = mid;
        else hi = mid;
      }
      return surf.S((lo + hi) / 2, y, tv).x;
    };
    const Zp = (px) => (610 - px) / 100;
    const Yp = (q) => (590 - q) / 100;
    const SIDE = [
      // [name, sheet px outline, standing height]
      ['crown', [[532, 462], [580, 415], [650, 400], [675, 407], [660, 437], [675, 450], [640, 465], [595, 482], [550, 495]], 0.12],
      ['crownRear', [[662, 438], [676, 406], [722, 430], [714, 450], [676, 450]], 0.1],
      ['rearUpper', [[640, 466], [676, 451], [716, 452], [728, 497], [641, 500]], 0.09],
      ['temple', [[503, 565], [518, 533], [550, 503], [597, 482], [597, 500], [580, 535], [548, 553]], 0.1],
      ['midBlue', [[597, 483], [640, 467], [640, 500], [622, 510], [598, 518]], 0.07],
      ['aboveEar', [[620, 508], [748, 498], [758, 528], [668, 532], [622, 536]], 0.1],
      ['rearMid', [[660, 532], [748, 530], [730, 570], [700, 575], [662, 566]], 0.08],
      ['rearLow', [[668, 570], [730, 572], [745, 588], [722, 655], [690, 672], [640, 672], [640, 640], [668, 615]], 0.09],
      ['rearEdge', [[748, 530], [760, 532], [765, 575], [742, 660], [722, 660], [744, 588], [736, 572]], 0.08],
    ];
    const inPoly = (P, a, b) => {
      let ins = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i];
        const [xj, yj] = P[j];
        if (yi > b !== yj > b && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    for (const [, pts, h] of SIDE) {
      const P = pts.map(([a, b]) => [Zp(a), Yp(b)]);
      const xs = P.map((q) => q[0]);
      const ys = P.map((q) => q[1]);
      const S = [...P];
      for (let i = 1; i < 8; i++)
        for (let j = 1; j < 8; j++) {
          const a = Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 8;
          const b = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 8;
          if (inPoly(P, a, b)) S.push([a, b]);
        }
      const D = S.map(([a, b]) => shellX(a, b));
      let [saa, sab, sbb, sa, sb, sn, sad, sbd, sd] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      S.forEach(([a, b], i) => {
        const d = D[i];
        saa += a * a; sab += a * b; sbb += b * b; sa += a; sb += b; sn += 1; sad += a * d; sbd += b * d; sd += d;
      });
      const r = new V3(sad, sbd, sd).applyMatrix3(new THREE.Matrix3().set(saa, sab, sa, sab, sbb, sb, sa, sb, sn).invert());
      let lift = 0;
      S.forEach(([a, b], i) => (lift = Math.max(lift, D[i] - (r.x * a + r.y * b + r.z))));
      const far = (a, b) => r.x * a + r.y * b + r.z + lift + h;
      void far;
      const fl = (a, b) => shellX(a, b) + 0.065; // conforms to the shell's contour, one armor thickness proud
      const geo = geoOf((m) => prismDense(m, P, 'x', (a, b) => fl(a, b) - T_ARMOR, fl, 0.02, {seg: 0.08}));
      const rg = geoOf((m) => prismDense(m, P, 'x', (a, b) => fl(a, b) - T_ARMOR - 0.008 - T_RED, (a, b) => fl(a, b) - T_ARMOR - 0.008, 0.006, {seg: 0.08}));
      redPlates.push(rg, mirrorX(rg));
      const cy = ys.reduce((q, v) => q + v, 0) / ys.length;
      const nn = new V3(1, -r.y * 0.5, -r.x * 0.5).normalize();
      for (const s of [1, -1]) {
        const g = new THREE.Group();
        g.add(mesh(s > 0 ? geo : mirrorX(geo), M.white, 40));
        const ns = nn.clone();
        ns.x *= s;
        add(g, ns.clone().multiplyScalar(1.1).add(new V3(0, 0.2, 0)), (p, obj) => {
          const k = p.crown;
          obj.position.addScaledVector(ns, CROWN.lift * k).add(new V3(s * CROWN.spread * k, CROWN.rise * k * Math.max(0, (cy - 0.6) / 1.4), 0));
        });
      }
    }
  }

  // crown cap: a separate faceted cap laid over the crown, overhanging the back of the head and ending in a raised
  // lip with a vent slot (the sheet's "helmet crown"); a narrow crest runs along its spine
  {
    // seated on the shell (not floating): the top view's centre strip, wide at the back where the lip rises
    const P = [[0.5, 1.84], [0.2, 1.93], [-0.3, 1.92], [-0.8, 1.74], [-1.18, 1.52], [-1.4, 1.38]];
    const Wd = [0.26, 0.3, 0.32, 0.33, 0.32, 0.28];
    const path = P.map(([z, y]) => new V3(0, y, z));
    const up = P.map((_, i) => {
      const a0 = P[Math.max(0, i - 1)];
      const a1 = P[Math.min(P.length - 1, i + 1)];
      return new V3(0, a0[0] - a1[0], a1[1] - a0[1]).normalize().negate().multiplyScalar(-1);
    });
    for (const u of up) if (u.y < 0) u.negate();
    // the spine (Destroy top view): a wide band in four blocks with gaps between, a red frame band under it that
    // shows along both edges once the side plates part in NT-D
    const SEGS = [[0, 1], [1, 2], [2, 3], [3, 5]];
    // each block is a convex solid through its section corners (side walls, chamfers and top all closed)
    const cap = geoOf((m) => {
      for (const [a, b] of SEGS) {
        const pts = [];
        for (let i = a; i <= b; i++) {
          let c = path[i].clone();
          if (i === a) c = c.lerp(path[Math.min(i + 1, b)], 0.06);
          if (i === b) c = c.lerp(path[Math.max(i - 1, a)], 0.06);
          const u = up[i];
          const t = path[Math.min(i + 1, path.length - 1)].clone().sub(path[Math.max(i - 1, 0)]).normalize();
          const l = new V3().crossVectors(t, u).normalize();
          const w = Wd[i] * 1.3;
          for (const [x, h] of [[-w, -0.16], [w, -0.16], [w, 0.03], [w * 0.72, 0.11], [-w * 0.72, 0.11], [-w, 0.03]]) pts.push(c.clone().addScaledVector(l, x).addScaledVector(u, h));
        }
        const hull = new ConvexGeometry(pts);
        const pa = hull.attributes.position.array;
        for (let i = 0; i < pa.length; i += 9) {
          const v = [0, 3, 6].map((o) => new V3(pa[i + o], pa[i + o + 1], pa[i + o + 2]));
          m.tri(v[0], v[1], v[2]); // ConvexGeometry already winds every face outward
        }
      }
    });
    const spineRed = geoOf((m) => sweep(m, path.map((v, i) => v.clone().addScaledVector(up[i], -0.05)), up, (i) => {
      const w = Wd[i] * 1.3 + 0.07;
      return [[-w, -0.12], [w, -0.12], [w, -0.04], [-w, -0.04]];
    }));
    const crest = geoOf((m) => sweep(m, path.slice(2, 5), up.slice(2, 5), () => [[-0.17, 0.08], [0.17, 0.08], [0.17, 0.16], [0.12, 0.2], [-0.12, 0.2], [-0.17, 0.16]]));
    const lip = geoOf((m) => prism(m, [[-1.08, 1.56], [-1.44, 1.36], [-1.5, 1.48], [-1.2, 1.68]], 'x', -0.24, 0.24, 0.025));
    const vent = geoOf((m) => prism(m, [[-1.24, 1.55], [-1.42, 1.44], [-1.44, 1.5], [-1.26, 1.6]], 'x', -0.13, 0.13, 0.008));
    const g = new THREE.Group();
    g.add(mesh(cap, M.white), mesh(crest, M.white), mesh(lip, M.white));
    const spineR = mesh(spineRed, M.red, false);
    g.add(spineR);
    const v = mesh(vent, M.lens, false);
    v.scale.set(1.05, 1, 1);
    v.position.set(0, 0.012, -0.005);
    g.add(v);
    // NT-D: the crown slides forward over the risen camera (Destroy sheet: the helmet crown block above the camera)
    // the crown's front block: hangs down from the cap's front, hidden inside the head in Unicorn Mode; in NT-D the
    // crown slides forward and a little down and this block lands right on the camera housing, so camera and crown
    // read as one unit (Destroy sheet front view)
    g.add(mesh(geoOf((m) => viewHull(m, {
      front: [[-0.16, 1.31], [0.16, 1.31], [0.21, 1.38], [0.22, 1.72], [0.15, 1.84], [-0.15, 1.84], [-0.22, 1.72], [-0.21, 1.38]],
      side: [[0.5, 1.31], [0.84, 1.31], [0.86, 1.4], [0.78, 1.84], [0.5, 1.84]],
    })), M.white));
    add(g, new V3(0, 1.3, 0), (p, obj) => {
      obj.position.add(new V3(0, 0.06 * p.crown, 0.22 * p.crown)); // forward along the top; not lower, or it sinks into the crown plates
      spineR.position.y = -0.4 * (1 - p.crown); // deep inside in Unicorn Mode; rises under the spine's edges in NT-D
    });
    anchors.crown = {obj: g, p: new V3(0.35, 1.95, -0.3)};
  }

  // ---------------------------------------------------------------- rear fin on its back panel
  {
    // two facets, creased at y = .35: the upper leans in toward the crown, the lower tucks in toward the neck
    const pf = (x, y) => (y >= 0.35 ? -1.6 + 0.25 * (y - 0.35) : -1.6 + 0.33 * (0.35 - y));
    const panelPoly = [[-0.42, 1.0], [0.42, 1.0], [0.47, -0.2], [0.38, -0.62], [-0.38, -0.62], [-0.47, -0.2]];
    const panel = geoOf((m) => prismSplit(m, panelPoly, 'z', (x, y) => pf(x, y) + 0.24, (x, y, P) => pf(x, P.reduce((s, q) => s + q[1], 0) / P.length >= 0.35 ? Math.max(y, 0.35) : Math.min(y, 0.35)), 0.03, [[0, 1, 0.35]], {gap: 0.02}));
    const finPoly = [[-0.13, 1.28], [0.13, 1.28], [0.15, -0.32], [0.09, -0.44], [-0.09, -0.44], [-0.15, -0.32]];
    const fin = geoOf((m) => prismSplit(m, finPoly, 'z', (x, y) => pf(x, y) + 0.05, (x, y, P) => pf(x, P.reduce((s, q) => s + q[1], 0) / P.length >= 0.35 ? Math.max(y, 0.35) : Math.min(y, 0.35)) - 0.13, 0.03, [[0, 1, 0.35]], {gap: 0.012}));
    const slot = geoOf((m) => prism(m, [[-0.06, -0.22], [0.06, -0.22], [0.06, -0.3], [-0.06, -0.3]], 'z', -1.6, (x, y) => pf(x, y) - 0.14, 0.006));
    const pg = new THREE.Group();
    pg.add(mesh(panel, M.white));
    // two dark slots either side of the panel top
    for (const s of [1, -1]) {
      const sl = mesh(geoOf((m) => prism(m, [[0.52, 0.62], [0.66, 0.62], [0.66, 0.5], [0.52, 0.5]], 'z', -1.45, -1.58, 0.006)), M.lens, false);
      if (s < 0) sl.scale.x = -1;
      pg.add(sl);
    }
    add(pg, new V3(0, 0.1, -0.9), (p, obj) => obj.position.add(new V3(0, 0, -0.05 * p.fin)));
    const g = new THREE.Group();
    g.add(mesh(fin, M.white), mesh(slot, M.lens, false));
    add(g, new V3(0, 0.3, -1.3), (p, obj) => obj.position.add(new V3(0, FIN.rise * p.fin, -0.08 * p.fin)));
    anchors.fin = {obj: g, p: new V3(0, 0.9, -1.72)};
  }

  // ---------------------------------------------------------------- brow and forehead block (main camera, horn root)
  // ---------------------------------------------------------------- forehead: folded sheet armor
  // Parts and fold angles from reference/parts/forehead-detail.png (Codex: F-01…F-07, folds 135°/150°, one sheet
  // thickness); outlines read at 5x off the Unicorn sheet's front view (reference/grid/fh5x.png, x = (px − 243)/100,
  // y = (590 − py)/100), depths from the side view. Each part is a uniform-thickness folded sheet (foldedShell),
  // built as the right half and mirrored; no right angles anywhere.
  //  F-01 column    the U round the horn: 150° chamfers from the horn's flanks, then the sides back
  //  F-02 recess    the camera surround: window floor, 135° bevels on the top and sides, pillar faces outside them
  //  F-03 nose      a V inset under the recess folding forward to the prow tip (obtuse, ~106°), the beak below it
  //  F-04/05 plate  the forehead plate either side: main face, a 135° rim folding back along its top, a dark slot
  //  F-06/07 crown  the crown-side plate above it, folded 150° along a line from the plate's corner to its top edge
  //  brow           the lower brow plate from the plate down to the visor's top edge
  const browGroup = new THREE.Group();
  browGroup.userData.noRed = true;
  const T = 0.07;
  const P3 = (x, y, z) => new V3(x, y, z);
  const MX = (fs) => [...fs, ...fs.map((f) => f.map((v) => new V3(-v.x, v.y, v.z)))];
  const shell = (facets, centre, mat = M.white, t = T) => {
    const o = mesh(geoOf((m) => foldedShell(m, MX(facets), t, {centre})), mat);
    browGroup.add(o);
    return o;
  };
  {
    // F-01: the horn's base housing, read at 3x off reference/parts/horn.png (grid/hb-front, hb-side, hb-top; 200 px
    // per part unit, origin = blade root: front x 183, side x 534, y 715). Every piece is the intersection of its
    // front, side and top outlines (viewHull), so every face is a chamfer at the angle the views give:
    //   tab    the small block at the front foot          core   the ramp under the blade's chevron
    //   lobes  hexagonal blocks either side, front face folded at the crease, a slanted slot on the front,
    //          a hole and a dark recess on the side      lugs   tall chamfered pillars hugging the blade
    // Scaled .64 so its width matches the column of the Unicorn sheet, its foot on the camera recess (y 1.18).
    {
      const fx = (px) => (px - 183) / 200;
      const sz = (px) => (534 - px) / 200;
      const yy = (py) => (715 - py) / 200;
      const zt = (ty) => -0.36 + (ty - 661) * 0.00466; // top view's depth axis onto the side view's
      const tx = (px) => (px - 1082) / 200;
      const HB = new THREE.Group();
      const K = 0.64;
      HB.scale.setScalar(K);
      HB.position.set(0, 1.18 + 0.915 * K, 1.15 - 0.665 * K); // lobe fronts level with the forehead plates (z ~1.05)
      const vh = (spec, mirror = false) => geoOf((m) => viewHull(m, spec, {mirror}));
      const tab = vh({
        front: [[fx(160), yy(902)], [fx(208), yy(902)], [fx(208), yy(877)], [fx(160), yy(877)]],
        side: [[sz(401), yy(898)], [sz(440), yy(898)], [sz(447), yy(860)], [sz(422), yy(851)]],
        top: [[tx(1057), zt(825)], [tx(1108), zt(825)], [tx(1103), zt(897)], [tx(1062), zt(897)]],
      });
      const core = vh({
        front: [[fx(150), yy(805)], [fx(216), yy(805)], [fx(217), yy(877)], [fx(150), yy(877)]],
        side: [[sz(430), yy(898)], [sz(571), yy(898)], [sz(603), yy(807)], [sz(480), yy(812)]],
      });
      const lobe = vh({
        front: [[fx(240), yy(800)], [fx(258), yy(785)], [fx(292), yy(820)], [fx(292), yy(855)], [fx(272), yy(895)], [fx(228), yy(895)], [fx(225), yy(872)]],
        side: [[sz(430), yy(898)], [sz(571), yy(898)], [sz(606), yy(818)], [sz(603), yy(807)], [sz(467), yy(843)]],
        top: [[tx(1120), zt(661)], [tx(1142), zt(661)], [tx(1190), zt(708)], [tx(1190), zt(783)], [tx(1133), zt(850)], [tx(1120), zt(850)]],
      }, true);
      const lug = vh({
        front: [[fx(222), yy(895)], [fx(225), yy(737)], [fx(240), yy(720)], [fx(253), yy(738)], [fx(258), yy(785)], [fx(240), yy(880)]],
        side: [[sz(470), yy(843)], [sz(480), yy(812)], [sz(520), yy(742)], [sz(590), yy(698)], [sz(600), yy(700)], [sz(606), yy(768)], [sz(603), yy(807)]],
      }, true);
      // dark details as thin folded sheets laid on the faces they sit in
      const zFront = (py) => sz(430 + (37 * (898 - py)) / 55); // the lobes' front face, slanting back as it rises
      const flat = (pts) => geoOf((m) => foldedShell(m, MX([pts]), 0.012, {centre: new V3(0, -0.6, -1)}));
      const slotF = flat([[262, 855], [285, 842], [287, 849], [264, 862]].map(([x, y]) => P3(fx(x), yy(y), zFront(y) + 0.012)));
      const onSide = (x, pts) => flat(pts.map(([z, y]) => P3(x, yy(y), sz(z))));
      const slotS = onSide(fx(258) + 0.01, [[532, 808], [587, 790], [589, 798], [534, 816]]);
      const hole = onSide(fx(292) + 0.01, [[545, 833], [557, 833], [557, 862], [545, 862]]);
      const under = onSide(fx(292) + 0.01, [[490, 878], [572, 878], [572, 897], [490, 897]]);
      HB.add(mesh(tab, M.white), mesh(core, M.white), mesh(lobe, M.white), mesh(lug, M.white));
      // the recess between the lugs and the lobes reads as shaded metal, not a hole into the head
      browGroup.add(mesh(geoOf((m) => viewHull(m, {front: [[-0.3, 1.2], [0.3, 1.2], [0.26, 1.78], [-0.26, 1.78]], side: [[0.42, 1.2], [0.95, 1.2], [0.8, 1.78], [0.42, 1.78]]})), M.white)); // the U-collar's wall behind the horn
      for (const d of [slotF, slotS, hole, under]) HB.add(mesh(d, M.lens, false));
      HB.userData.noRed = true;
      browGroup.add(HB);
    }

    // F-02: the recess. floor z(y) runs back as it rises; bevels 135° (45° to the floor), pillars turned out 30°
    const fl = (y) => 0.98 + (0.28 * (1.12 - y)) / 0.62;
    const B = 0.08;
    shell([
      [P3(0, 1.0, fl(1.0)), P3(0.15, 1.0, fl(1.0)), P3(0.15, 0.63, fl(0.63)), P3(0, 0.63, fl(0.63))],
      [P3(0, 1.0, fl(1.0)), P3(0, 1.18, fl(1.18) + B), P3(0.23, 1.18, fl(1.18) + B), P3(0.15, 1.0, fl(1.0))],
      [P3(0.15, 1.0, fl(1.0)), P3(0.23, 1.18, fl(1.18) + B), P3(0.23, 0.66, fl(0.66) + B), P3(0.15, 0.63, fl(0.63))],
      [P3(0.23, 1.18, fl(1.18) + B), P3(0.35, 1.18, fl(1.18) + B - 0.036), P3(0.27, 0.66, fl(0.66) + B - 0.012), P3(0.23, 0.66, fl(0.66) + B)],
    ], new V3(0, 0.9, 0.4));
    // the main camera unit: a chamfered housing with the window and lens, sitting in the recess in Unicorn Mode; in NT-D
    // it slides out of the recess and up to between the V-fin roots (Destroy sheet front view), red frame either side
    const camUnit = new THREE.Group();
    {
      const cz = fl(0.78) + 0.04;
      // a funnel bezel: four trapezoid faces sloping in to a recessed window (Destroy sheet), the whole unit
      // tilted back so it sits inset at an angle; no red side blocks
      const cy = 0.79;
      const Ro = [0.17, 0.2]; // outer half width (at the bottom) / half height
      const Ri = [0.105, 0.135]; // inner (window) half width (at the bottom) / half height
      const TOP = 0.66; // trapezoid: the top edge is this fraction of the bottom
      const zo = cz + 0.0;
      const zi = cz - 0.025; // a shallow bevel: flat, flush with the forehead
      const O = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P3(a * Ro[0] * (b > 0 ? TOP : 1), cy + b * Ro[1], zo));
      const I = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P3(a * Ri[0] * (b > 0 ? TOP : 1), cy + b * Ri[1], zi));
      const bez = [0, 1, 2, 3].map((k) => [O[k], O[(k + 1) % 4], I[(k + 1) % 4], I[k]]);
      const tilt = new THREE.Group();
      tilt.add(mesh(geoOf((m) => foldedShell(m, bez, 0.025, {centre: new V3(0, cy, zi - 0.3)})), M.grey, false));
      tilt.add(mesh(geoOf((m) => prism(m, [[-Ri[0], cy - Ri[1]], [Ri[0], cy - Ri[1]], [Ri[0] * TOP, cy + Ri[1]], [-Ri[0] * TOP, cy + Ri[1]]], 'z', zi - 0.04, zi + 0.002, 0.004)), M.lens, false));
      const cam = mesh(geoOf((m) => prism(m, [[-0.078, cy - 0.105], [0.078, cy - 0.105], [0.078 * TOP, cy + 0.105], [-0.078 * TOP, cy + 0.105]], 'z', zi - 0.04, zi + 0.006, 0.006)), M.camGreen, false);
      tilt.add(cam);
      // tilt back about the window's centre
      const pivotC = new V3(0, cy, zi);
      tilt.position.copy(pivotC);
      tilt.children.forEach((c) => c.position.sub(pivotC));
      tilt.rotation.x = -0.42; // lies in the plane of the forehead plate around it (leaning back ~24°), flush, not standing up
      camUnit.add(tilt);
      camUnit.userData.red = new THREE.Object3D();
      anchors.camera = {obj: cam, p: new V3(0, cy, zi + 0.02)};
      camUnit.userData.noRed = true;
      add(camUnit, new V3(0, 0.6, 0.6), (p, obj) => {
        const t = p.crown;
        // rides with the forehead (which moves +.04 y, +.06 z in NT-D) plus a short rise of its own, staying set in the recess
        obj.position.add(new V3(0, 0.04 * t + 0.09 * t, 0.06 * t));
        obj.userData.red.position.z = -0.2 * (1 - t); // the frame either side slides out behind it
      });
    }

    // F-03: V inset (a, b, f), the beak's upper face (b, c, f) and lower face (f, c, g, h) on one plane
    const a = P3(0, 0.7, 1.34);
    const b = P3(0.23, 0.7, 1.28);
    const f = P3(0, 0.35, 1.66);
    const c = P3(0.36, 0.5, 1.32);
    const h = P3(0, 0.17, 1.46); // the beak's point rests on the visor's V
    const g = P3(0.26, 0.24, 1.66 + 0.606 * (0.24 - 0.35) - 1.197 * 0.26);
    shell([[a, b, f], [b, c, f], [f, c, g, h]], new V3(0, 0.38, 0.9));

    // F-05: the forehead plate. main face z = 1.568 − .53x − .27y; the rim above the fold line turns back 45°
    const pz = (x, y) => 1.568 - 0.53 * x - 0.27 * y;
    const MAIN = [[0.27, 0.66], [0.37, 0.49], [0.68, 0.62], [0.81, 0.92], [0.73, 0.99], [0.57, 1.13], [0.35, 1.16]];
    const main = MAIN.map(([x, y]) => P3(x, y, pz(x, y)));
    const rimTop = [[0.37, 1.31], [0.51, 1.27]].map(([x, y]) => P3(x, y, pz(x, y) - 0.15));
    const rim = [main[6], main[5], main[4], main[3], rimTop[1], rimTop[0]];
    shell([main, rim], new V3(0.5, 0.85, 0.5));
    // the dark slot along the plate's outer edge
    browGroup.add(mesh(geoOf((m) => {
      const S = [[0.7, 0.69], [0.79, 0.91], [0.75, 0.95], [0.66, 0.73]];
      foldedShell(m, MX([S.map(([x, y]) => P3(x, y, pz(x, y) + 0.008))]), 0.01, {centre: new V3(0.5, 0.8, 0.5)});
    }), M.lens, false));

    // F-07: the crown-side plate, z = 2.268 − 1.02x − .707y, its inner strip folded 150° forward toward the column
    const cz = (x, y) => 2.268 - 1.02 * x - 0.707 * y;
    const fold = [P3(0.37, 1.31, cz(0.37, 1.31)), P3(0.55, 1.7, cz(0.55, 1.7))];
    const outer = [fold[0], P3(0.51, 1.27, cz(0.51, 1.27)), P3(0.81, 0.92, cz(0.81, 0.92)), P3(0.97, 1.0, cz(0.97, 1.0)), P3(0.95, 1.2, cz(0.95, 1.2)), fold[1]];
    const inZ = (x, y) => cz(x, y) + 0.2 * Math.max(0, 0.37 + (y - 1.31) * 0.46 - x);
    // its inner edge stops at x .36 where the horn base (F-01) begins
    const inner = [fold[1], P3(0.43, 1.81, inZ(0.43, 1.81)), P3(0.36, 1.84, inZ(0.36, 1.84)), P3(0.36, 1.36, inZ(0.36, 1.36)), fold[0]];
    shell([outer, inner], new V3(0.4, 1.3, 0.2));

    // brow: the lower plate from the forehead plate down to the visor's top edge, beside the beak
    // its lower edge rests on the visor's top edge (.17 at the centre → .34 at x .69 → .42 at .92), leaving the band clear
    const BROW = [[0.37, 0.49, 1.3], [0.68, 0.62, 1.1], [0.81, 0.92, 0.88], [0.97, 1.0, 0.7], [1.02, 0.55, 0.78], [0.92, 0.44, 0.95], [0.69, 0.36, 1.12], [0.4, 0.28, 1.27], [0.3, 0.26, 1.29]];
    // the eye socket under this plate is dark on the Destroy sheet: no frame sheet behind it
    shell([BROW.map(([x, y, z]) => P3(x, y, z))], new V3(0.55, 0.5, 0.3)).userData.noRed = true;

    add(browGroup, new V3(0, 0.2, 1.0), (p, obj) => obj.position.add(new V3(0, 0.04 * p.crown, 0.06 * p.crown))); // slides forward in NT-D (Destroy sheet: prow further out)
    anchors.brow = {obj: browGroup, p: new V3(0.62, 0.85, pz(0.62, 0.85))};
  }

  // ---------------------------------------------------------------- horn: two segmented halves on a split hinge
  // Traced from reference/parts/horn.png (Codex part sheet, 200 px = 1 unit, origin = blade root centre): seven
  // segments meeting in down-pointing chevrons, a section that runs from a chamfered octagon at the root to a sharp
  // diamond at the tip, the two halves split on the centre line. The root housing is in head axes (it does not lean).
  const hornParts = [];
  {
    const dir = new V3(0, HORN.tip[1] - HORN.root[1], HORN.tip[2] - HORN.root[2]).normalize();
    const L = HORN.len;
    const horn = new THREE.Group();
    horn.position.set(...HORN.root);
    horn.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
    horn.userData.dir = dir;
    const PS = HORN.partScale;
    const HW = 0.82; // the Unicorn sheet's horn is this much slimmer than the part sheet's; its base is built at .64
    const W = (f) => HW * PS * 0.258 * Math.max(0, 1 - f) ** 0.72 + 0.004; // half width, front view
    const Dp = (f) => HW * PS * 0.24 * Math.max(0, 1 - f) ** 0.62 + 0.004; // half depth, side view
    const pf = (f) => 0.5 + 0.2 * Math.max(0, 1 - f) ** 1.5; // 0.7 = octagon at the root, 0.5 = diamond at the tip
    const SEG = [0, 0.13, 0.32, 0.47, 0.62, 0.74, 1];
    const CHEV = 0.55; // seam rises this much per unit out from the centre line
    const half = (s) => {
      const m = new Mesher();
      const ring = (f, k, rise) => {
        const w = W(f) * k;
        const d = Dp(f) * k;
        const p = pf(f);
        return [[0, d], [s * p * w, p * d], [s * w, 0], [s * p * w, -p * d], [0, -d]].map(([l, n]) => new V3(l, f * L + (rise ? CHEV * Math.abs(l) : 0), n));
      };
      for (let i = 0; i < SEG.length - 1; i++) {
        const f0 = SEG[i] + (i ? 0.004 : 0);
        const f1 = SEG[i + 1] - (i < SEG.length - 2 ? 0.004 : 0);
        // each segment starts with a slightly proud collar, then tapers to the next seam
        const R = [ring(f0, 1.0, i > 0), ring(f0 + 0.012, 1.035, i > 0), ring(f1, 1.0, i < SEG.length - 2)];
        for (let r = 0; r < R.length - 1; r++)
          for (let j = 0; j < 5; j++) {
            const j1 = (j + 1) % 5;
            const out = new V3(R[r][j].x + R[r][j1].x, 0, R[r][j].z + R[r][j1].z);
            if (j === 4) out.set(-s, 0, 0);
            m.quad(R[r][j], R[r][j1], R[r + 1][j1], R[r + 1][j], out);
          }
        for (const [Rk, sg] of [[R[0], -1], [R[2], 1]]) {
          const c = Rk.reduce((a, v) => a.add(v), new V3()).multiplyScalar(1 / 5);
          for (let j = 0; j < 5; j++) m.tri(c, Rk[j], Rk[(j + 1) % 5], new V3(0, sg, 0));
        }
      }
      const g = new THREE.Group();
      g.add(mesh(m.geo(), M.white));
      return g;
    };
    horn.userData.noRed = true;
    const halves = [1, -1].map((s) => {
      const h = half(s);
      const pv = new THREE.Group();
      pv.position.set(s * 0.02, 0.06, 0);
      h.position.set(-s * 0.02, -0.06, 0);
      pv.add(h);
      // the V-fin blade this half opens into (Destroy sheet): flat, chamfered, a notched root on its lower edge
      const BL = [[-0.03, -0.05], [0.26, -0.05], [0.44, 0.2], [0.4, 0.34], [0.27, 0.42], [0.24, 0.8], [0.05, 2.5], [-0.03, 2.45], [-0.05, 0.6]].map(([x, y]) => [s * x, y]);
      const BLW = 0.82; // fits inside the horn's depth when folded
      const bl = mesh(geoOf((m) => prism(m, BL.map(([x, y]) => [x * BLW, y]), 'z', -0.012, 0.012, 0.006)), M.white);
      const blade = new THREE.Group(); // the hinge: along the half's length at the front of its split face
      blade.position.set(-s * 0.02, -0.06, 0.17);
      blade.rotation.order = 'XYZ';
      blade.rotation.x = -0.057; // the hinge follows the half's front edge as the horn tapers
      blade.add(bl);
      pv.add(blade);
      horn.add(pv);
      return {pv, h, s, blade};
    });
    hornParts.push(horn);

    // root housing, in part px → units: front x = (px-183)/200, side z = (534-px)/200, y = (715-py)/200
    const fx = (px) => (PS * (px - 183)) / 200;
    const sz = (px) => (PS * (534 - px)) / 200;
    const yy = (py) => (PS * (715 - py)) / 200;
    const ramp = (y) => sz(401) + ((sz(483) - sz(401)) * (y - yy(898))) / (yy(790) - yy(898)); // the base's front slope
    const base = new THREE.Group();
    base.position.set(...HORN.root);
    // core: the side profile, a front ramp and a stepped back, across the lugs
    const side = [[401, 898], [571, 898], [577, 870], [592, 830], [606, 790], [601, 750], [598, 705], [560, 700], [487, 748], [483, 790], [452, 830]].map(([x, y]) => [sz(x), yy(y)]);
    base.add(mesh(geoOf((m) => prism(m, side, 'x', -0.24 * PS, 0.24 * PS, 0.03)), M.white));
    // cheek blocks either side of the core, each with a slot on its front
    const cheek = [[230, 792], [263, 790], [292, 828], [287, 872], [268, 898], [230, 898]].map(([x, y]) => [fx(x), yy(y)]);
    base.add(mesh(geoOf((m) => prism(m, cheek, 'z', sz(590), (x, y) => ramp(y) - 0.02, 0.03, {mirror: true})), M.white));
    base.add(mesh(geoOf((m) => prism(m, [[fx(262), yy(840)], [fx(282), yy(845)], [fx(282), yy(852)], [fx(262), yy(847)]], 'z', 0.2, (x, y) => ramp(y) - 0.014, 0.004, {mirror: true})), M.lens, false));
    // the two lugs that hug the blade's root
    const lug = [[208, 795], [253, 795], [253, 748], [246, 722], [230, 714], [214, 728], [208, 750]].map(([x, y]) => [fx(x), yy(y)]);
    base.add(mesh(geoOf((m) => prism(m, lug, 'z', sz(600), sz(470), 0.025, {mirror: true})), M.white));
    // front tab at the foot of the ramp
    base.add(mesh(geoOf((m) => prism(m, [[fx(157), yy(860)], [fx(210), yy(860)], [fx(210), yy(898)], [fx(157), yy(898)]], 'z', sz(500), (x, y) => ramp(y) + 0.015, 0.02)), M.white));
    // side slots (a long diagonal one and a short vertical one)
    for (const poly of [[[530, 790], [582, 772], [584, 780], [532, 798]], [[546, 828], [553, 828], [553, 856], [546, 856]]])
      base.add(mesh(geoOf((m) => prism(m, poly.map(([x, y]) => [sz(x), yy(y)]), 'x', 0.2, 0.245 * PS, 0.004, {mirror: true})), M.lens, false));
    // not added to the head: the Unicorn sheet shows the column and plate here instead (kept for the part render)
    hornParts.push(base);
    // the hinge: two knuckles and an axle across the horn's root, lit up only by the explode
    const hinge = new THREE.Group();
    const knuckle = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10); // inside the slimmed horn root
    knuckle.rotateX(Math.PI / 2);
    for (const s of [1, -1]) {
      const k = mesh(knuckle, M.frameMid, false);
      k.position.set(s * 0.07, 0.05, 0);
      hinge.add(k);
    }
    const axle = new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8);
    axle.rotateZ(Math.PI / 2);
    const ax = mesh(axle, M.steel, false);
    ax.position.set(0, 0.05, 0);
    hinge.add(ax);
    horn.add(hinge);
    add(horn, new V3(0, 1.5, 0.25), (p, obj) => {
      const a = p.hornAngle * D2R;
      for (const {pv, h, s, blade} of halves) {
        pv.rotation.set(HORN.pitch * D2R * p.horn, 0, -s * a); // split in the face plane, then lean the V back
        pv.position.set(s * (0.02 + HORN.spread * p.horn), 0.06 - HORN.drop * p.horn, 0);
        h.position.y = -0.06 - HORN.sink * p.horn;
        // the flap swings out about its hinge as the halves open: folded (s·90°) inside the horn → flat, facing forward
        blade.rotation.y = s * (Math.PI / 2) * (1 - p.horn);
        blade.position.y = -0.06 - HORN.sink * p.horn;
      }
    });
    anchors.horn = {obj: halves[0].pv, p: new V3(0.05, 3.1, 1.36)};
    anchors.hinge = {obj: hinge, p: new V3(0.12, 1.5, 1.05)};
  }

  // ---------------------------------------------------------------- face: mask halves with the visor (Unicorn Mode)
  const maskFar = (x, y) => 1.37 + 0.23 * y - 0.35 * x;
  const visorFar = (x, y) => 1.36 + 0.2 * y - 0.33 * x;
  for (const s of [1, -1]) {
    const mk = (fill) => {
      const g = geoOf(fill);
      return s > 0 ? g : mirrorX(g);
    };
    // Every piece below is read off two or three views at once (viewHull): its front outline (x, y), its side
    // outline (z, y) and its top outline (x, z). Side profile measured off the Unicorn sheet: the mask's front runs
    // z 1.34 under the visor back to 1.16 at y −.8, then the chin pushes forward again to 1.32; across x the face
    // turns back toward the cheeks (top outlines), so every facet is a trapezoid at its own angle.
    // The face is a curved surface, not flat plates. Its depth F(x, y) = the centre-line side profile measured off the
    // Unicorn sheet (upper face bulging out to 1.34 under the visor, a hollow at 1.15 around y −.75, the chin bulging
    // forward again to 1.30) minus a cross curve that turns the face back toward the cheeks. Mask pieces, chin and
    // cheek front all lie on this one surface, so they read as one convex face with a dip between face and chin.
    const mask = FACE_SURF;
    const T_FACE = 0.08;
    // Layered as reference/parts/face.png draws it, each layer a uniform-thickness sheet (foldedShell) on the
    // face plane at its own height: the raised inner panel under the visor, the outer strip stepping back beside
    // it down to the chin
    const onFace = (pts, lift) => pts.map(FP).map(([x, y]) => new V3(x, y, mask(x, y) + lift));
    // Outlines from the Unicorn sheet's front view at 3x (reference/grid/f3-front.png), which wins over the stylised
    // face part sheet: a large upper panel under the visor down to the fold (y −.9), the lower V's front facet to
    // the chin, and its side facet turning back toward the cheek; each a uniform sheet at its own height
    // the mask half lies on the head's cylinder (axis z .1), so when it turns round that axis in NT-D it stays on it
    const cylZ = (x, y) => 0.1 + Math.sqrt(Math.max(0.05, (faceZ(y) - 0.1) ** 2 - x * x));
    const U = (pts, lift) => pts.map(([x, y]) => new V3(x, y, cylZ(x, y) + lift));
    let wallX = null;
    let wallFacets = null;
    let wallBackZ = null;
    let wallFrontZ = null;
    const CYL = 0.1; // the head's vertical axis (z) the face pieces wrap round
    const WALL = 35 * D2R; // the side wall's arc beyond the front edge
    const shell = mk((m) => {
      // re-read against the sheet on one grid (refmatch/out/face-grid.png): the upper panel's outer edge runs from
      // under the visor at x .6 down and in to .47 at y −.6, then the diagonal to the fold at (.19, −1.0); outside
      // it a long side facet from the visor's end (x .72) down to a point beside the chin (.28, −1.42)
      foldedShell(m, [U([[0.006, -0.16], [0.6, 0.05], [0.47, -0.6], [0.19, -1.0], [0.006, -1.0]], 0.03)], T_FACE, {centre: new V3(0.3, -0.4, 0)});
      foldedShell(m, [U([[0.006, -1.02], [0.18, -1.02], [0.13, -1.22], [0.006, -1.22]], 0.03)], T_FACE, {centre: new V3(0.1, -1.0, 0)});
      foldedShell(m, [U([[0.61, 0.05], [0.72, 0.1], [0.57, -0.65], [0.28, -1.42], [0.14, -1.24], [0.2, -1.02], [0.48, -0.62]], 0.03)], T_FACE, {centre: new V3(0.35, -0.6, 0)});
      // S-03 side wall: from the facet's outer edge (x .72 → .5) straight back to the red frame line (sheet: the
      // wall's back edge runs z .62 at the top, .68 at y −.34, .9 at y −1.0, in the half's closed position)
      // the wall reaches back to mid-head (Destroy side view: its back edge — the red Z — runs z 0 from y .1 to −.29,
      // then 45° forward-down to (.44, −.85) and on to (.6, −1.2)); no right angles anywhere on its outline
      const YS = [0.1, -0.29, -0.85, -1.2];
      const ox = (y) => (y > -0.45 ? 0.72 + (0.1 / 0.55) * (y - 0.1) : 0.62 + (0.12 / 0.55) * (y + 0.45)); // the outer edge
      // the side wall leaves the front facet at ~142° (top view: back 1, out .5) so it wraps the face, and stops at
      // the red frame's Z (back edge depths from the Destroy side view, shortened to stay on the head)
      const zf = (y) => cylZ(ox(y) + 0.02, y) + 0.03;
      const rW = (y) => Math.hypot(ox(y) + 0.02, zf(y) - CYL);
      const phiF = (y) => Math.atan2(ox(y) + 0.02, zf(y) - CYL);
      const W = YS.map((y) => new V3(ox(y) + 0.02, y, zf(y)));
      const Wb = YS.map((y) => new V3(rW(y) * Math.sin(phiF(y) + WALL), y, CYL + rW(y) * Math.cos(phiF(y) + WALL)));
      wallX = (y, z) => Math.sqrt(Math.max(0, rW(y) ** 2 - (z - CYL) ** 2)); // on the head's cylinder
      wallBackZ = (y) => CYL + rW(y) * Math.cos(phiF(y) + WALL);
      wallFrontZ = zf;
      wallFacets = [0, 1, 2].map((i) => [W[i], W[i + 1], Wb[i + 1], Wb[i]]);
    });
    const wallGeo = geoOf((m) => foldedShell(m, wallFacets, T_FACE, {centre: new V3(0.2, -0.45, 0.6)}));
    // the jaw behind the layers: shaded metal where face.png shows the dark recess between strip and cheek, and a
    // closed face so the neck never shows through
    const jaw = mk((m) => {
      const P = [[0.006, 0.0], [0.7, 0.1], [0.62, -0.7], [0.3, -1.4], [0.006, -1.4]].map(([x, y]) => new V3(x, y, mask(Math.min(x, 0.74), y) - 0.1));
      foldedShell(m, [P], 0.05, {centre: new V3(0.3, -0.5, -0.5)});
    });
    // one chin block under the V (not split): it bulges forward like the face above it and tucks up behind the
    // faceplate when the mask opens
    if (s > 0) {
      // the chin block (face.png x 228–300, y 690–848): a front face with 135° bevels down both sides, its front
      // leaning forward at the bottom
      const cz = (y) => 1.12 + 0.1 * (-1.22 - y);
      const [cx0, cy0] = [0.13, -1.22];
      const [cx1, cy1] = [0.13, -1.55];
      const fc = (x, y) => new V3(x, y, cz(y));
      const chin = geoOf((m) =>
        foldedShell(m, [
          [fc(-0.1, cy0), fc(0.1, cy0), fc(0.08, cy1), fc(-0.08, cy1)],
          [fc(0.1, cy0), new V3(cx0, cy0, cz(cy0) - 0.08), new V3(cx1, cy1, cz(cy1) - 0.08), fc(0.08, cy1)],
          [fc(-0.1, cy0), new V3(-cx0, cy0, cz(cy0) - 0.08), new V3(-cx1, cy1, cz(cy1) - 0.08), fc(-0.08, cy1)],
        ], T_FACE, {centre: new V3(0, -1.3, 0.8)}),
      );
      const jg = new THREE.Group();
      jg.add(mesh(chin, M.white, 40));
      jg.userData.noRed = true;
      add(jg, new V3(0, -1.0, 0.9), (p, obj) => obj.position.add(new V3(0, 0.28 * p.mask, -0.42 * p.mask)));
    }
    // visor band (f3-front): centre .03 / −.13, outer end x .92 at .30 / .15, on the face surface
    // visor band (f3-front at 3x): centre .17 / −.03, it rises to the outer end x .92 at .40 / .28, sitting just above the mask panel's top edge
    const visor = mk((m) => prismDense(m, [[0.006, 0.1], [0.006, -0.16], [0.6, 0.05], [0.82, 0.16], [0.82, 0.37], [0.6, 0.31]], 'z', (x, y) => mask(x, y) - 0.25, (x, y) => mask(x, y) + 0.01, 0.01, {seg: 0.06}));
    const wallMesh = mesh(s > 0 ? wallGeo : mirrorX(wallGeo), M.white);
    const pv = pivot(new V3(0, -0.5, CYL), mesh(shell, M.white), wallMesh); // turns round the head's vertical axis: hugs the head
    pv.userData.noRed = true;
    let maskRed = null;
    let maskFront = null;
    let maskRedX = 0;
    let maskL2 = null;
    // the frame sheet that rides under this half: same outline, a little larger, just behind it, so the opened
    // half shows a red rim along its edges (Destroy sheet, "opened mask halves")
    {
      // the frame strip along the half's outer edge, traced from the Destroy sheet's red L: down from beside the eye
      // (x .74, y .1) to (.6, −.65), then diagonally in to the chin (.3, −1.4). A flat red strip with a hot core,
      // standing just outside the half's edge and behind it, so it shows as a glowing seam between mask and cheek.
      // S-04 (Codex side-face sheet): a thin red plate along the side wall's back edge: a short upright prong above
      // the eye line, down the edge, then stepping forward to the chin line; it lies in the wall's plane, just behind it
      const E = [0.1, -0.29, -0.85, -1.2].map((y) => [y, wallBackZ(y) + 0.06]); // along the wall's back edge
      const wx = (y) => (y > -0.45 ? 0.72 + (0.1 / 0.55) * (y - 0.1) : 0.62 + (0.12 / 0.55) * (y + 0.45)) + 0.0;
      void wx;
      const at = ([y, z], dz) => new V3(sx(wallX(y, z - dz) - 0.075), y, z - dz); // under the wall's inner skin
      const sx = (x) => s * x;
      const strip = (w0, w1, mat) => {
        const m2 = new Mesher();
        for (let k = 0; k < E.length - 1; k++) {
          const a = E[k];
          const b = E[k + 1];
          const A0 = at(a, w0), A1 = at(a, w1), B0 = at(b, w0), B1 = at(b, w1);
          m2.quad(A0, B0, B1, A1, new V3(s, 0, 0));
          const back = (v) => v.clone().add(new V3(-s * 0.025, 0, 0));
          m2.quad(back(A0), back(A1), back(B1), back(B0), new V3(-s, 0, 0));
          m2.quad(A1, B1, back(B1), back(A1), new V3(0, 0, -1));
          m2.quad(A0, back(A0), back(B0), B0, new V3(0, 0, 1));
        }
        return mesh(m2.geo(), mat, false);
      };
      {
        // cheek plate: on the wall's outer face (one armor thickness out), covering its front part, tapering
        // to the jaw; folded once along its length so it follows the wall's bend
        const on = (y, z, o) => new V3(wallX(y, z) + o, y, z);
        const CP = [0.16, -0.3, -0.8, -1.12].map((y) => { const f = wallFrontZ(y); const b = wallBackZ(y); return [y, f - 0.08, b + 0.25 * (f - b)]; });
        const fac = [];
        for (let i = 0; i < CP.length - 1; i++) {
          const [y0, a0, b0] = CP[i];
          const [y1, a1, b1] = CP[i + 1];
          fac.push([on(y0, a0, 0.075), on(y0, b0, 0.075), on(y1, b1, 0.075)], [on(y0, a0, 0.075), on(y1, b1, 0.075), on(y1, a1, 0.075)]);
        }
        const cg = geoOf((m) => foldedShell(m, fac, 0.05, {centre: new V3(0.4, -0.45, 0.5), lip: 0}));
        maskL2 = mesh(s > 0 ? cg : mirrorX(cg), M.white, 40);
        pv.children[0].add(maskL2);
      }
      maskRed = new THREE.Group();
      // an inner red shell: a band lying just inside the wall's plane, from under the wall to past its back edge
      maskRed.add(strip(-0.1, 0.1, M.red));
      maskRedX = 0;
      // and the L in the fold between the half's inner panel and outer facet, seen from the front
      {
        const F = [[0.57, -0.08], [0.48, -0.62], [0.2, -1.02]]; // the fold between the inner panel and the outer facet: the sheet's L, left visible beside layer 2
        const fa = ([x, y], d) => new V3(s * (x + d), y, cylZ(x + d, y) + 0.07);
        const m3 = new Mesher();
        const fl = (w0, w1) => {
          for (let k = 0; k < F.length - 1; k++) {
            const A0 = fa(F[k], w0), A1 = fa(F[k], w1), B0 = fa(F[k + 1], w0), B1 = fa(F[k + 1], w1);
            const bk = (v) => v.clone().add(new V3(0, 0, -0.05));
            m3.quad(A0, B0, B1, A1, new V3(0, 0, 1));
            m3.quad(bk(A0), bk(A1), bk(B1), bk(B0), new V3(0, 0, -1));
            m3.quad(A1, B1, bk(B1), bk(A1), new V3(s, 0, 0));
            m3.quad(A0, bk(A0), bk(B0), B0, new V3(-s, 0, 0));
          }
        };
        fl(-0.04, 0.03);
        maskFront = mesh(m3.geo(), M.red, false);
        pv.children[0].add(maskFront);
      }

      pv.children[0].add(maskRed);
    }
    // the hinge itself: three knuckles on a vertical axle with bearing rings, between mask and cheek guard
    {
      const hg = new THREE.Group();
      const ax = new THREE.CylinderGeometry(0.022, 0.022, 0.9, 10);
      hg.add(mesh(ax, M.steel, false));
      for (const y of [-0.3, 0, 0.3]) {
        const kn = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), M.frameMid, false);
        kn.position.y = y;
        const br = mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 16).rotateX(Math.PI / 2), M.steel, false);
        br.position.y = y + 0.065;
        hg.add(kn, br);
      }
      hg.position.set(s * 0.74, -0.5, 0.97);
      hg.position.z = 0.6; // deep behind the mask half, where it stays hidden when open too
      add(hg, new V3(s * 0.6, 0, 0.3), (p, obj) => (obj.visible = p.mask > 0.05));
    }
    const jawG = new THREE.Group();
    jawG.add(mesh(jaw, M.frame, false));
    add(jawG, new V3(0, -0.2, 0.3), (p, obj) => (obj.visible = p.mask < 0.05)); // only behind the closed mask
    const vg = new THREE.Group();
    vg.add(mesh(visor, M.visor, false));
    // the visor retracts into the brow before the mask halves part
    add(vg, new V3(s * 0.5, 0.3, 1.2), (p, obj) => obj.position.add(new V3(0, 0.05 * p.mask, -0.44 * Math.min(1, p.mask * 1.6))));
    add(pv, new V3(s * 1.0, -0.2, 0.95), (p, obj) => {
      const k = p.mask;
      // slide out and back, outer edge swinging behind the cheek guard, so only the inner face stays in view
      obj.position.add(new V3(0, -MASK.drop * k, 0));
      obj.rotation.y = s * MASK.orbit * k; // slides round the head's cylinder
      if (maskRed) {
        maskRed.position.x = maskRedX - s * 0.25 * (1 - k); // the inner shell slides in until the half opens
        maskRed.visible = k > 0.03;
      }
      wallMesh.position.x = -s * 0.14 * (1 - k); // the side wall tucks inward behind the cheek until the half opens
      if (maskFront) {
        maskFront.position.z = -0.3 * (1 - k);
        maskFront.visible = k > 0.03; // the seam it shows through only opens in NT-D
      }
      if (maskL2) {
        maskL2.visible = k > 0.02;
        maskL2.position.x = -s * 0.2 * (1 - k); // slides out of the wall as the half opens
      }
    });
    if (s > 0) anchors.mask = {obj: pv, p: new V3(0.45, -0.55, 1.15)};
  }

  // ---------------------------------------------------------------- face: Gundam faceplate (Destroy Mode)
  {
    const g = new THREE.Group();
    // Read off the Destroy sheet's side view on a unit grid (reference/grid/d-side-face.png): the faceplate's front
    // runs z 1.29 at its top (y −.1) down to 1.24 at y −.62 (the vents), then folds back to 1.12 at −.84; its sides
    // fold back 135° toward the cheeks. The red chin is a wedge jutting forward and down (front corner z 1.33 at
    // y −1.2, bottom 1.26 at −1.46). All folded sheets / three-view solids, no flat slab.
    // Destroy sheet: ±.6 at the top edge (y −.05), tapering to ±.22 at the chin (y −.70)
    // recessed between the opened mask halves (Destroy side sheet: the halves' front edges stand proud of it)
    // taller, as the sheet draws it: from the eye sill (y 0) down to the chin (−.88), edges tucked under the mask halves
    const ROWS = [[0.0, 0.58, 1.06], [-0.5, 0.5, 1.04], [-0.75, 0.34, 1.02]]; // set back; no bump at the chin // inside the mask halves' U (S-03), not in front of it
    const P = (x, y, z) => new V3(x, y, z);
    const facets = [];
    for (let i = 0; i < 2; i++) {
      const [y0, w0, z0] = ROWS[i];
      const [y1, w1, z1] = ROWS[i + 1];
      const R = 0.22; // the ridge
      const C0 = P(0, y0, z0 + R);
      const C1 = P(0, y1, z1 + R);
      for (const sx of [1, -1]) {
        const A = P(sx * w0, y0, z0);
        const B = P(sx * w1, y1, z1);
        facets.push([C0, A, B], [C0, B, C1]);
        const d = P(sx * 0.06, 0, -0.1); // short side bevel under the mask halves
        facets.push([A, B, B.clone().add(d)], [A, B.clone().add(d), A.clone().add(d)]);
      }
    }
    // two prongs carry the faceplate on down either side of the chin, turning in under it: the chin sits in the notch
    for (const sx of [1, -1]) {
      const Q = (x, y, z) => P(sx * x, y, z);
      // in front of the mask halves' inner edges (sheet front view: the shield's sides run down beside the chin)
      facets.push([Q(0.15, -0.75, 1.17), Q(0.34, -0.75, 1.02), Q(0.3, -1.06, 1.0), Q(0.15, -1.06, 1.12)]);
      facets.push([Q(0.15, -1.06, 1.12), Q(0.3, -1.06, 1.0), Q(0.24, -1.16, 0.98), Q(0.15, -1.16, 1.08)]);
    }
    g.add(mesh(geoOf((m) => foldedShell(m, facets, 0.06, {centre: new V3(0, -0.5, 0.6)})), M.white));
    const faceZ = (y) => {
      // the ridge's depth, following ROWS
      const i = y > ROWS[1][0] ? 0 : 1;
      const [y0, , z0] = ROWS[i];
      const [y1, , z1] = ROWS[i + 1];
      return z0 + ((z1 - z0) * (y - y0)) / (y1 - y0) + 0.22;
    };
    // mouth vents: three chevrons on the upper front facet
    for (const y of [-0.2, -0.33, -0.46])
      g.add(mesh(geoOf((m) => prism(m, [[0, y + 0.02], [0.17, y + 0.06], [0.17, y + 0.025], [0, y - 0.015]], 'z', 1.1, (x, yy) => faceZ(yy) - 0.4 * Math.abs(x) + 0.014, 0.006, {mirror: true})), M.lens, false));
    const chin = mesh(
      geoOf((m) =>
        viewHull(m, {
          // hexagonal block hanging from the faceplate's point (sheet: ±.18, y −.70 … −1.25)
          // S-02: front a hexagon chamfered at the top, flat at the bottom; side a slab leaning forward 45°
          // the sheet's side view: a slim wedge hanging from under the faceplate's front, its front edge running down
          // and a little forward to a point, its back edge sloping up under the face
          // the sheet's side view: a wedge hanging from the faceplate's lower front, leaning forward as it drops,
          // its tip just ahead of the faceplate's front
          front: [[-0.1, -0.78], [0.1, -0.78], [0.15, -0.88], [0.15, -1.2], [-0.15, -1.2], [-0.15, -0.88]],
          side: [[0.88, -0.78], [1.2, -0.84], [1.34, -1.12], [1.28, -1.22], [1.0, -1.05]], // hangs straight on from the faceplate's lower front
          top: [[-0.15, 0.88], [0.15, 0.88], [0.15, 1.24], [0.08, 1.34], [-0.08, 1.34], [-0.15, 1.24]],
        }),
      ),
      M.chin,
      false,
    );
    // the dark jaw behind the shield and beside the chin (sheet: dark grey parts round the chin, no opening)
    {
      const jw = new THREE.Group();
      jw.add(mesh(geoOf((m) => viewHull(m, {front: [[-0.42, -0.7], [0.42, -0.7], [0.38, -1.05], [0.22, -1.2], [-0.22, -1.2], [-0.38, -1.05]], side: [[0.7, -0.7], [1.06, -0.7], [1.12, -0.95], [0.98, -1.2], [0.7, -1.2]], top: [[-0.42, 0.7], [0.42, 0.7], [0.36, 1.1], [0.2, 1.14], [-0.2, 1.14], [-0.36, 1.1]]})), M.frame, false));
      jw.add(mesh(geoOf((m) => prism(m, [[-0.5, -0.1], [0.5, -0.1], [0.5, -0.7], [-0.5, -0.7]], 'z', 0.75, 0.95, 0.02)), M.frame, false));
      jw.userData.noRed = true;
      add(jw, new V3(0, 0, 0));
    }
    // the chin rides up inside the face in Unicorn Mode and drops into place as the faceplate rolls out
    const chinG = new THREE.Group();
    chinG.add(chin);
    g.add(chinG);
    g.add(mesh(geoOf((m) => prism(m, [[-0.52, -0.2], [0.52, -0.2], [0.56, 0.05], [0.4, 0.07], [-0.4, 0.07], [-0.56, 0.05]], 'z', 0.92, (x) => 1.12 - 0.36 * Math.abs(x), 0.01)), M.red, false)); // the red inner shell behind the faceplate
    g.userData.noRed = true;
    add(g, new V3(0, -0.5, 1.9), (p, obj) => {
      obj.position.add(new V3(0, 0, -FACE.travel * (1 - p.face)));
      chinG.position.set(0, 0.34 * (1 - p.face), -0.06 * (1 - p.face));
    });
    anchors.chin = {obj: chin, p: new V3(0, -1.0, 1.0)};
    anchors.vents = {obj: g, p: new V3(0.1, -0.4, 1.0)};
  }

  // ---------------------------------------------------------------- dual-eye sensor unit
  let eyeBar = null;
  {
    const g = new THREE.Group();
    // Traced at 5x off the Destroy sheet's front view (refmatch/out/eyes1.png, origin at the sheet's fitted front
    // centre): each eye a slanted green blade rising outward — pointed at its inner-lower end, x .20 → .74,
    // y .05 → .30 — set in a dark socket with a dark-green rim, a maroon sill under it from the nose to the
    // cheek, and the dark socket filling everything round it up to the brow (no red here; red only at the
    // cheek frame beyond x .85).
    const eyeFar = (x, y) => 1.1 + 0.1 * y - 0.3 * Math.abs(x);
    // extracted from the sheet's own pixels (bright green / dark-green rim, convex hull, 6 corners)
    // a pentagon, as the sheet draws it: inner end, low point on the bottom, outer point, outer top, inner top
    const EYE = [[0.212, 0.113], [0.475, 0.075], [0.675, 0.212], [0.65, 0.263], [0.25, 0.188]];
    const RIM = [[0.15, 0.113], [0.463, 0.037], [0.75, 0.212], [0.7, 0.31], [0.212, 0.237]];
    g.add(mesh(geoOf((m) => prism(m, [[0.12, 0.1], [0.46, 0.0], [0.82, 0.2], [0.82, 0.34], [0.62, 0.37], [0.18, 0.28]], 'z', 0.7, (x, y) => eyeFar(x, y) - 0.03, 0.01, {mirror: true})), M.frame, false)); // socket just round the rim
    // the nose block's lower end between the eyes (sheet: grey, down to the sill)
    g.add(mesh(geoOf((m) => prism(m, [[0.0, 0.02], [0.13, 0.04], [0.17, 0.13], [0.15, 0.32], [0.0, 0.32]], 'z', 0.7, (x, y) => eyeFar(x, y) + 0.02, 0.012, {mirror: true})), M.grey, false));
    g.add(mesh(geoOf((m) => prism(m, RIM, 'z', 0.8, (x, y) => eyeFar(x, y) - 0.008, 0.008, {mirror: true})), M.eyeRim, false));
    const eyes = mesh(geoOf((m) => prism(m, EYE, 'z', 0.8, eyeFar, 0.012, {mirror: true})), M.green, false);
    g.add(eyes);
    // the glowing frame bar standing in a dark slot beside each eye (sheet: x .84–.95, y .0 … .42, a hot core)
    const bar = new THREE.Group();
    // a folded red frame plate (one thickness), its face turned out like the cheek, top cut at an angle; it sits
    // under the brow plate's lower edge (y < .26) so nothing crosses it
    {
      const fz = (x, y) => eyeFar(x, y) + 0.04; // in front of the socket and the mask edges, nothing cuts it
      const F = [[0.83, -0.02], [0.95, 0.02], [0.95, 0.2], [0.89, 0.25], [0.83, 0.22]].map(([x, y]) => new V3(x, y, fz(x, y)));
      const geoB = geoOf((m) => foldedShell(m, [F], 0.06, {centre: new V3(0.6, 0.1, 0.5)}));
      bar.add(mesh(geoB, M.red, false), mesh(mirrorX(geoB), M.red, false));
    }
    g.add(bar);
    eyeBar = bar;
    // maroon sill under the eyes, from beside the nose out toward the cheek
    g.add(mesh(geoOf((m) => prism(m, [[0.1, 0.07], [0.45, -0.02], [0.84, 0.17], [0.82, 0.23], [0.75, 0.205], [0.463, 0.03], [0.15, 0.105]], 'z', 0.8, (x, y) => eyeFar(x, y) + 0.01, 0.008, {mirror: true})), M.maroon, false)); // the thin sill under each eye
    add(g, new V3(0, 0.05, 1.25), (p) => (eyeBar.position.z = -0.35 * (1 - p.frame))); // the bars slide out in NT-D
    anchors.eyes = {obj: g, p: new V3(0.4, 0.0, 1.0)};
  }

  // ---------------------------------------------------------------- mask actuator rails (behind the faceplate)
  {
    const g = new THREE.Group();
    for (const [i, y] of [-0.22, -0.58, -0.94].entries()) {
      const rod = new THREE.CylinderGeometry(0.035, 0.035, 1.25, 10);
      rod.rotateZ(Math.PI / 2);
      const r = mesh(rod, M.steel, false);
      r.position.set(0, y, 0.72 - i * 0.04);
      g.add(r);
      const screw = new THREE.CylinderGeometry(0.055, 0.055, 0.7, 12);
      screw.rotateZ(Math.PI / 2);
      const sc = mesh(screw, M.frameMid, false);
      sc.position.set(0, y, 0.72 - i * 0.04);
      g.add(sc);
      for (const s of [1, -1]) {
        const blk = mesh(geoOf((m) => prism(m, [[-0.07, -0.08], [0.07, -0.08], [0.07, 0.08], [-0.07, 0.08]], 'z', -0.07, 0.07, 0.015)), M.frame, false);
        blk.position.set(s * 0.6, y, 0.72 - i * 0.04);
        g.add(blk);
      }
    }
    add(g, new V3(0, -0.25, 0.65), (p, obj) => {
      for (const c of obj.children) if (c.geometry?.parameters?.radiusTop === 0.055) c.rotation.x = p.mask * 12;
    });
    anchors.rails = {obj: g, p: new V3(0.45, -0.58, 0.75)};
  }

  let cheekOld = null;
  // ---------------------------------------------------------------- cheek guards
  for (const s of [1, -1]) {
    // a tall plate standing just outside the mask (front view: x .68–.93, its front face a narrow strip; side view:
    // z .48–.93, y .08 down to −1.2 with a slanted back edge), its front face sloping back toward the top
    // The cheek guard lies against the face: its front band continues the face surface outward just behind the
    // mask's edge, running from beside the visor down and in toward the chin; its side plate leans inward toward the
    // jaw (x 1.0 at the top, .85 at the bottom), its lower front corner cut back to a point (side view)
    // Two fangs, as face.png draws the cheek: an inner strip beside the mask and an outer guard that wraps to the
    // side; both taper to one point low and forward (face.png 372, 800 → x .48, y −1.39). Each is a folded sheet:
    // the inner strip one facet stepped back from the face; the outer guard a front facet and a side facet meeting
    // at a 135° fold, its top capped.
    // The cheek guard (Unicorn sheet front view): a broad plate beside the mask from the visor's outer end down to
    // y −1.18, its face turning back toward the side; a narrower strip along the mask's lower edge; the plate's
    // lower front corner cut to the point the side view shows. Uniform sheets, mirrored.
    const geo = geoOf((m) => {
      const back = (x, y, d) => new V3(x, y, FACE_SURF(Math.min(x, 0.7), y) - d - 0.9 * Math.max(0, x - 0.7));
      // one folded sheet (side view at 4x, grid/cheek-side4.png: the guard spans z ~1.25 → .45, folded at its outer
      // edge): the front facet turned back toward the side (front view x .73–.93), folded 135° at the outer edge into
      // the side facet that reaches back under the pod; the side facet itself folds along y −.45, standing out there
      const F = [[0.73, 0.2], [0.93, 0.24], [0.93, -0.45], [0.84, -0.78], [0.66, -0.66]].map(([x, y]) => back(x, y, 0.02));
      const [E0, E1, E2] = [F[1], F[2], F[3]];
      const B0 = new V3(0.97, 0.06, 0.45);
      const B1 = new V3(1.03, -0.45, 0.6);
      const B2 = new V3(0.92, -0.95, 0.78);
      foldedShell(m, [F, [E0, B0, B1, E1], [E1, B1, B2, E2]], 0.07, {centre: new V3(0.5, -0.4, 0.5)});
      const BR = [[0.45, -0.5], [0.12, -0.5], [0.12, -0.64], [0.28, -0.64], [0.3, -0.98], [0.44, -1.0]];
      foldedShell(m, [BR.map(([z, y]) => new V3(1.0 + 0.1 * (y + 0.5), y, z))], 0.07, {centre: new V3(0.5, -0.7, 0.3)});
    });
    const tab = geoOf((m) =>
      viewHull(m, {
        front: [[0.5, -1.26], [0.74, -1.26], [0.68, -1.72], [0.56, -1.72]],
        side: [[0.6, -1.3], [0.82, -1.27], [0.92, -1.72], [0.62, -1.56]],
      }),
    );
    const g = new THREE.Group();
    g.userData.noRed = true;
    g.add(mesh(s > 0 ? geo : mirrorX(geo), M.white, 40));
    cheekOld = g;
    // the lower tab only appears in NT-D: it slides down out of the cheek guard (Destroy sheet side view)
    const tabG = new THREE.Group();
    tabG.userData.noRed = true;
    tabG.add(mesh(s > 0 ? tab : mirrorX(tab), M.white));
    add(tabG, new V3(s * 0.8, -0.6, 0.4), (p, obj) => {
      obj.position.y += 0.4 * (1 - p.cheek);
      obj.visible = p.cheek > 0.02;
    });
    add(g, new V3(s * 1.0, -0.35, 0.3), (p, obj) => {
      obj.position.add(new V3(s * (-0.2 * p.cheek + CROWN.spread * 0.9 * p.crown), -0.04 * p.cheek, -0.32 * p.cheek)); // retracts inside, the NT-D cheek plate takes its place
      obj.visible = p.cheek < 0.98;
    });
    // NT-D cheek: two more curved layers outside the opened mask half (Destroy front sheet: mask half, then two
    // staggered cheek plates, each bent round the face and tapering in toward the jaw). Each is a uniform folded
    // sheet, three columns across so it curves; they slide out from inside the head as NT-D runs.
    {
      const zw = (x, lift) => 1.3 - 0.4 * (x - 0.6) - 0.9 * (x - 0.6) ** 2 + lift;
      const band = (rows, lift) => {
        // rows: [y, xInner, xOuter] top to bottom → triangles over a 3-column grid on the wrap surface
        const g3 = rows.map(([y, a, b]) => [a, (a + b) / 2, b].map((x) => new V3(x, y, zw(x, lift))));
        const f = [];
        for (let i = 0; i < g3.length - 1; i++)
          for (let j = 0; j < 2; j++) {
            f.push([g3[i][j], g3[i][j + 1], g3[i + 1][j + 1]]);
            f.push([g3[i][j], g3[i + 1][j + 1], g3[i + 1][j]]);
          }
        return f;
      };
      // layer 2 starts just outside the red L on the mask half (sheet: mask half's visible strip ±.45–.75)
      const L2 = band([[0.2, 0.9, 1.08], [-0.3, 0.92, 1.1], [-0.75, 0.8, 1.0], [-1.05, 0.62, 0.78]], 0.02);
      const L3 = band([[0.28, 1.06, 1.26], [-0.3, 1.08, 1.28], [-0.82, 0.98, 1.16], [-1.12, 0.76, 0.9]], 0.05);
      void L3;
      void L2;
      for (const [F, k] of []) {
        const geoL = geoOf((m) => foldedShell(m, F, 0.05, {centre: new V3(0.4, -0.4, 0.2)}));
        const lg = new THREE.Group();
        lg.add(mesh(s > 0 ? geoL : mirrorX(geoL), M.white, 40));
        lg.userData.noRed = true;
        add(lg, new V3(s * (0.8 + 0.3 * k), -0.3, 0.3), (p, obj) => {
          const t = 1 - p.cheek;
          obj.position.add(new V3(-s * (0.3 + 0.1 * k) * t, 0, -0.35 * t));
          obj.visible = p.cheek > 0.02;
        });
      }
    }
    if (s > 0) anchors.cheek = {obj: g, p: new V3(0.95, -0.6, 0.85)};
  }

  // ---------------------------------------------------------------- ear pods with cooling ducts, vulcans at the temples
  for (const s of [1, -1]) {
    const M2 = (geo) => (s > 0 ? geo : mirrorX(geo));
    const pod = new THREE.Group();
    // traced from the Unicorn sheet's side view (reference/grid/u-side-pod.png; the Codex pod sheet drew a different,
    // slanted pod and lost): a deep box frame, a small front window and a big rear one with a cross bar and slats,
    // raised rims round both windows, a chamfered lower back corner and a bracket under the front
    const Z = (px) => (610 - px) / 100;
    const Y = (q) => (590 - q) / 100;
    const T = (pts) => pts.map(([a, b]) => [Z(a), Y(b)]);
    const frame = T([[567, 555], [687, 547], [686, 615], [645, 630], [565, 627]]);
    // the pod body read off three views: front (a column up to y .85 that chamfers in at the top and bottom),
    // side (the box frame), top (front and back corners cut at an angle) — slanted faces all round
    void frame;
    pod.add(mesh(M2(geoOf((m) => viewHull(m, {
      front: [[0.92, 0.85], [1.18, 0.72], [1.3, 0.5], [1.3, -0.1], [1.24, -0.4], [0.92, -0.46]],
      side: [[0.5, 0.6], [0.1, 0.85], [-0.6, 0.8], [-0.84, 0.5], [-0.84, -0.2], [-0.5, -0.46], [0.5, -0.46]],
      top: [[0.92, 0.5], [1.2, 0.45], [1.3, 0.25], [1.3, -0.6], [1.18, -0.84], [0.92, -0.84]],
    }))), M.white));
    const win = (x0, x1, y0, y1, slats, bar) => {
      const w = T([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      pod.add(mesh(M2(geoOf((m) => prism(m, w, 'x', 1.25, 1.334, 0.004))), M.lens, false));
      // raised rim: four bars round the window
      const r = 0.035;
      const [[za, ya], [zb], , [, yb]] = w;
      for (const q of [[[za + r, ya + r], [zb - r, ya + r], [zb - r, ya], [za + r, ya]], [[za + r, yb], [zb - r, yb], [zb - r, yb - r], [za + r, yb - r]], [[za + r, ya + r], [za, ya + r], [za, yb - r], [za + r, yb - r]], [[zb, ya + r], [zb - r, ya + r], [zb - r, yb - r], [zb, yb - r]]])
        pod.add(mesh(M2(geoOf((m) => prism(m, q, 'x', 1.3, 1.375, 0.012))), M.white));
      for (let k = 1; k <= slats; k++) {
        const yy = ya + ((yb - ya) * k) / (slats + 1);
        pod.add(mesh(M2(geoOf((m) => prism(m, [[za, yy + 0.012], [zb, yy + 0.012], [zb, yy - 0.012], [za, yy - 0.012]], 'x', 1.26, 1.31, 0.003))), M.grey, false));
      }
      if (bar) pod.add(mesh(M2(geoOf((m) => prism(m, [[za, Y(588)], [zb, Y(588)], [zb, Y(594)], [za, Y(594)]], 'x', 1.26, 1.35, 0.008))), M.white));
    };
    // the pod's front face carries a window too (front view: x .98–1.18, y .23 to −.2)
    pod.add(mesh(M2(geoOf((m) => prism(m, [[0.99, 0.22], [1.17, 0.22], [1.17, -0.19], [0.99, -0.19]], 'z', 0.4, 0.492, 0.006))), M.lens, false));
    for (const q of [[[0.96, 0.25], [1.2, 0.25], [1.2, 0.22], [0.96, 0.22]], [[0.96, -0.19], [1.2, -0.19], [1.2, -0.22], [0.96, -0.22]], [[0.96, 0.25], [0.99, 0.25], [0.99, -0.22], [0.96, -0.22]], [[1.17, 0.25], [1.2, 0.25], [1.2, -0.22], [1.17, -0.22]]])
      pod.add(mesh(M2(geoOf((m) => prism(m, q, 'z', 0.42, 0.53, 0.01))), M.white));
    for (let k = 1; k < 5; k++) {
      const yy = 0.22 - (0.41 * k) / 5;
      pod.add(mesh(M2(geoOf((m) => prism(m, [[0.99, yy + 0.012], [1.17, yy + 0.012], [1.17, yy - 0.012], [0.99, yy - 0.012]], 'z', 0.42, 0.5, 0.003))), M.grey, false));
    }
    win(577, 589, 566, 609, 4, false);
    win(630, 671, 566, 616, 5, true);
    // the little mark on the frame's top back corner
    pod.add(mesh(M2(geoOf((m) => prism(m, T([[668, 556], [678, 556], [678, 560], [668, 560]]), 'x', 1.3, 1.336, 0.002))), M.lens, false));
    // bracket under the front of the pod, down to the jaw: a thin folded sheet, not a slab. Front view (grid/
    // jaw-front.png): a strip x ~.95–1.19 whose outer edge runs down and slightly out, then folds back in toward the
    // jaw below y −.65; side view (jaw-side.png): z ~.1–.35. Upper facet faces out and forward (45°), the lower facet
    // turns in ~40°. Pod-local y = sheet y − POD_UP.
    {
      const u = (x, y, z) => new V3(x, y - POD_UP, z);
      const top = [u(0.97, -0.3, 0.36), u(1.17, -0.3, 0.12)];
      const mid = [u(1.0, -0.64, 0.36), u(1.2, -0.64, 0.1)];
      const bot = [u(0.92, -0.84, 0.32), u(1.06, -0.84, 0.14)];
      const facets = [[top[0], mid[0], mid[1], top[1]], [mid[0], bot[0], bot[1], mid[1]]];
      pod.add(mesh(M2(geoOf((m) => foldedShell(m, facets, 0.05, {centre: new V3(0.6, -0.6 - POD_UP, -0.4)}))), M.white));
    }
    pod.userData.noRed = true;
    add(pod, new V3(s * 1.6, 0.05, -0.1), (p, obj) => obj.position.add(new V3(s * (CROWN.spread * p.crown - POD_TUCK.in * p.cheek), POD_TUCK.down * p.cheek, -POD_TUCK.back * p.cheek)));
    if (s > 0) anchors.pod = {obj: pod, p: new V3(1.37, 0.0, -0.3)};
    // cooling duct inside the pod
    const duct = new THREE.Group();
    duct.add(mesh(M2(geoOf((m) => prism(m, [[0.2, 0.3], [-0.55, 0.3], [-0.55, -0.55], [0.2, -0.55]], 'x', 0.84, 1.18, 0.02))), M.frameMid, false));
    for (let k = 0; k < 6; k++) {
      const yy = -0.48 + k * 0.13;
      duct.add(mesh(M2(geoOf((m) => prism(m, [[0.15, yy + 0.03], [-0.5, yy + 0.03], [-0.5, yy - 0.02], [0.15, yy - 0.02]], 'x', 1.17, 1.22, 0.006))), M.frame, false));
    }
    duct.position.y = POD_UP;
    add(duct, new V3(s * 0.9, 0, -0.1), (p, obj) => obj.position.add(new V3(s * (CROWN.spread * 0.7 * p.crown - POD_TUCK.in * p.cheek), POD_TUCK.down * p.cheek, -POD_TUCK.back * p.cheek)));
    if (s > 0) anchors.duct = {obj: duct, p: new V3(1.2, -0.1, -0.2)};
    // vulcan: barrel through the temple, muzzle forward
    const vul = new THREE.Group();
    const barrel = new THREE.CylinderGeometry(0.06, 0.07, 1.1, 10);
    barrel.rotateX(Math.PI / 2);
    const b = mesh(barrel, M.frameMid, false);
    b.position.set(s * 0.86, 0.72, 0.05); // the muzzles sit back inside the brow until NT-D
    vul.add(b);
    const muzzle = new THREE.CylinderGeometry(0.085, 0.085, 0.12, 10);
    muzzle.rotateX(Math.PI / 2);
    const mz = mesh(muzzle, M.lens, false);
    mz.position.set(s * 0.86, 0.72, 0.57);
    vul.add(mz);
    const housing = mesh(M2(geoOf((m) => prism(m, [[-0.2, 0.62], [0.35, 0.62], [0.35, 0.84], [-0.2, 0.84]], 'x', 0.72, 1.0, 0.02))), M.frame, false);
    vul.add(housing);
    add(vul, new V3(s * 0.7, 0.35, 0.9));
    if (s > 0) anchors.vulcan = {obj: vul, p: new V3(0.86, 0.72, 1.1)};
  }

  // ---------------------------------------------------------------- neck: collar and ball joint
  const oct = (hw, z0, z1, c) => [[-hw + c, z0], [hw - c, z0], [hw, z0 + c], [hw, z1 - c], [hw - c, z1], [-hw + c, z1], [-hw, z1 - c], [-hw, z0 + c]];
  {
    const g = new THREE.Group();
    // a tall neck column of panels (the sheet shows it plainly under the back half of the head), on a stepped base
    g.add(mesh(geoOf((m) => prismSplit(m, oct(0.62, -0.72, 0.62, 0.2), 'y', -1.5, -0.62, 0.03, [[1, 0, 0.3], [1, 0, -0.3], [0, 1, -0.05]], {gap: 0.025})), M.frame, false));
    g.add(mesh(geoOf((m) => prism(m, oct(0.82, -0.84, 0.86, 0.24), 'y', -1.58, -1.44, 0.03)), M.frameMid, false));
    g.add(mesh(geoOf((m) => prism(m, oct(0.98, -0.94, 1.0, 0.3), 'y', -1.74, -1.58, 0.04)), M.grey));
    add(g, new V3(0, -1.7, 0));
    anchors.collar = {obj: g, p: new V3(0.9, -1.55, 0.6)};
    const ball = new THREE.Group();
    const sph = mesh(new THREE.IcosahedronGeometry(0.36, 2), M.steel, false);
    sph.position.set(0, -1.05, -0.12);
    ball.add(sph);
    const ring = new THREE.TorusGeometry(0.38, 0.06, 6, 16);
    ring.rotateX(Math.PI / 2);
    const rg = mesh(ring, M.frameMid, false);
    rg.position.set(0, -1.18, -0.12);
    ball.add(rg);
    add(ball, new V3(0, -0.85, 0.35));
    anchors.ball = {obj: ball, p: new V3(0.3, -1.0, 0.1)};
  }

  // armor opacity for the x-ray (fading armor sets transparent, which needs a program switch)
  let armorAlpha = 1;
  const setArmor = (a) => {
    if (a === armorAlpha) return;
    const was = armorAlpha < 1;
    armorAlpha = a;
    for (const m of ARMOR) {
      m.opacity = a;
      m.transparent = a < 1;
      m.depthWrite = a > 0.5;
      if (was !== a < 1) m.needsUpdate = true;
    }
    M.ink.opacity = 0.8 * a;
  };

  const tmp = new V3();
  let underSheet = null;
  const RED_OFF = new THREE.Color('#2b2e33'); // the frame under the shell reads as a dark seam until NT-D
  const RED_ON = new THREE.Color('#d41a10');
  const update = ({d = 0, explode = 0, armor = 1, time = 0, ink = true}) => {
    const p = pose(d);
    for (const part of parts) {
      part.obj.position.copy(part.home);
      part.obj.quaternion.copy(part.homeQ);
      part.fn?.(p, part.obj);
      if (explode > 0) part.obj.position.addScaledVector(part.ex, explode);
    }
    setArmor(armor);
    for (const l of inkLines) l.visible = ink;
    // psycho-frame: dull red at rest, a breathing glow as NT-D builds
    const beat = 0.5 + 0.5 * Math.sin(time * (2.2 + 2 * p.frame));
    M.red.emissiveIntensity = 0.9; // a lit red part, the same in both modes; only its position changes
    M.redHot.emissiveIntensity = 1.6;
    void beat;
    if (underSheet) underSheet.morphTargetInfluences[0] = p.frame; // the frame pieces push out under the plates
    // the frame plates are always there: retracted behind the inner skin in Unicorn Mode, they slide out as NT-D runs
    if (underSheet) underSheet.visible = explode < 0.25 && armor > 0.5;
    innerSkin.visible = explode < 0.25 && armor > 0.5; // it is a copy of the shell's footprint: in the exploded view the frame shows as the core's own parts
    M.green.emissiveIntensity = 0.04 + 1.5 * p.eyes;
    M.camGreen.emissiveIntensity = 0.02 + 0.35 * p.eyes;
    return p;
  };
  const anchorWorld = (k, out = tmp) => {
    const a = anchors[k];
    a.obj.updateWorldMatrix(true, false);
    return out.copy(a.p).applyMatrix4(a.obj.matrixWorld);
  };
  // anchors are given in head coordinates; convert them once to each object's local space
  root.updateMatrixWorld(true);
  for (const a of Object.values(anchors)) {
    a.obj.updateWorldMatrix(true, false);
    a.p = a.obj.worldToLocal(a.p.clone().applyMatrix4(root.matrixWorld));
  }
  // The psycho-frame as the exploded view draws it: a thin sheet lying under every white plate, the plate's own shape
  // a little larger, seated on the frame (static). In Unicorn Mode it reads as the dark seams between plates; in
  // NT-D the plates lift a little off it and it glows red in every seam. Built once from the rest pose and merged.
  {
    update({d: 0});
    root.updateMatrixWorld(true);
    const skip = (o) => {
      for (let q = o; q && q !== root; q = q.parent) if (q.userData.noRed) return true;
      return false;
    };
    void skip;
    const C = new V3(0, 0.3, -0.2);
    const list = [];
    for (const g0 of redPlates) {
      let g = g0.index ? g0.toNonIndexed() : g0.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new V3());
      if (c.z > 0.45 && c.y < 1.3) continue; // the face area has its own frame parts (eye bars, mask L): no plate copies there
      const out = c.clone().sub(C).normalize();
      // retracted inside (Unicorn Mode) → in place under its plate (NT-D): a straight push, no shape change
      const lo = g.clone();
      lo.translate(-out.x * 0.5, -out.y * 0.5, -out.z * 0.5);
      list.push([lo, g]);
    }
    const base = mergeGeometries(list.map((q) => q[0]));
    const raised = mergeGeometries(list.map((q) => q[1]));
    base.morphAttributes.position = [raised.attributes.position];
    base.morphAttributes.normal = [raised.attributes.normal];
    const under = mesh(base, M.red, false);
    root.add(under);
    underSheet = under;
    anchors.frame = {obj: under, p: surf.S(66 * D2R, 1.6)};
  }
  // marking decals (decals.js), laid in the Unicorn pose on the outer armor and carried by their parts
  {
    update({d: 0});
    root.updateMatrixWorld(true);
    const shown = (o) => {
      for (let q = o; q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    const targets = [];
    root.traverse((o) => o.isMesh && o.material === M.white && shown(o) && targets.push(o));
    const pair = (key, x, y, z, w, rot = 0) => [{key, dir: [x, y, z], w, rot}, {key, dir: [-x, y, z], w, rot: -rot}];
    const spots = [
      {key: 'unit', dir: [0.45, 0.55, 0.75], w: 0.5},
      {key: 'number', dir: [-0.45, 0.55, 0.75], w: 0.22, follow: false},
      ...pair('caution', 0.9, 0.85, -0.2, 0.55, 0),
      ...pair('lines', 1, -0.35, 0.1, 0.6, 0),
      ...pair('lines', 0.35, 1, 0.2, 0.5, 0),
      ...pair('ring', 1, 0.6, 0.2, 0.1, 0),
      ...pair('lines', 0.6, -0.7, 0.8, 0.36, 0),
      // the sides: panel stencils, numbers and lines along the plates
      ...pair('panel', 1, 0.45, -0.3, 0.62, 0),
      ...pair('number', 1, 0.15, -0.55, 0.26, 0),
      ...pair('lines', 1, 0.95, -0.6, 0.55, 0),
      ...pair('panel', 1, -0.05, -0.95, 0.5, 0),
      ...pair('ring', 0.9, -0.2, -0.6, 0.09, 0),
      ...pair('arrow', 0.95, 0.4, -0.7, 0.14, 0),
      ...pair('barcode', 1, -0.5, -0.4, 0.28, 0),
      // the back: a large emblem, stencils either side
      {key: 'emblem', dir: [0, 0.1, -1], from: [0, 0.35, -4], w: 0.62, follow: false, depth: 0.12},
      ...pair('emblem', 0.5, 0.3, -1, 0.42, 0).map((q) => ({...q, follow: false, depth: 0.12})),
      ...pair('barcode', 0.55, 0.25, -1, 0.3, 0),
      ...pair('caution', 0.5, 0.75, -1, 0.42, 0),
      ...pair('lines', 0.55, -0.45, -1, 0.42, 0),
      {key: 'nostep', dir: [0, 1, -0.25], w: 0.36, follow: false},
      {key: 'vertical', dir: [0.12, 0.25, -1], w: 0.1, follow: false},
      {key: 'lines', dir: [0, -0.2, 1], from: [0.05, 2.6, 4], w: 0.32, rot: 0},
    ];
    // the fine detail layer: dozens of tiny stencils, hairlines, dot rows and fluorescent strips over the whole shell
    // (golden-spiral directions, deterministic), kept off the face opening
    {
      const N = 90;
      const kinds = ['micro', 'tick', 'fluo', 'tick', 'fluo', 'dots', 'micro', 'fluo'];
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;
        const yN = 1 - 1.75 * t; // from the top down to the jaw line
        const r = Math.sqrt(Math.max(0, 1 - yN * yN));
        const ph = i * 2.399963;
        const d = [Math.sin(ph) * r, yN, Math.cos(ph) * r];
        if (d[2] > 0.55 && Math.abs(d[0]) < 0.6 && d[1] < 0.45) continue; // the face
        const key = kinds[i % kinds.length];
        const w = key === 'fluo' ? 0.05 + 0.03 * ((i * 7) % 3) : key === 'micro' ? 0.17 : key === 'dots' ? 0.1 : 0.22;
        spots.push({key, v: i, dir: d, w, rot: key === 'fluo' && i % 3 === 0 ? Math.PI / 2 : 0, depth: 0.06});
      }
    }
    // engraved panel lines across the plates (scribed detail), more fluorescent strips
    for (let i = 0; i < 70; i++) {
      const t = (i + 0.5) / 70;
      const yN = 0.95 - 1.7 * t;
      const r = Math.sqrt(Math.max(0, 1 - yN * yN));
      const ph = i * 2.399963 + 1.1;
      const d = [Math.sin(ph) * r, yN, Math.cos(ph) * r];
      if (d[2] > 0.55 && Math.abs(d[0]) < 0.6 && d[1] < 0.45) continue;
      spots.push({key: 'scribe', v: i, dir: d, w: 0.28 + 0.22 * ((i * 5) % 4) / 3, rot: i % 2 ? Math.PI / 2 : 0, depth: 0.05});
    }
    for (let i = 0; i < 40; i++) {
      const t = (i + 0.5) / 40;
      const yN = 0.9 - 1.6 * t;
      const r = Math.sqrt(Math.max(0, 1 - yN * yN));
      const ph = i * 2.399963 + 2.3;
      const d = [Math.sin(ph) * r, yN, Math.cos(ph) * r];
      if (d[2] > 0.55 && Math.abs(d[0]) < 0.6 && d[1] < 0.45) continue;
      spots.push({key: 'fluo', v: i, dir: d, w: 0.09 + 0.04 * (i % 3), rot: i % 4 === 0 ? Math.PI / 2 : 0, depth: 0.05});
    }
    // sci-fi engraving patterns over the shell
    {
      const KINDS = ['hatch', 'vents', 'zline', 'rivets', 'port', 'zline', 'chevrons', 'hatch', 'rivets', 'vents'];
      const SIZE = {hatch: 0.36, vents: 0.24, zline: 0.6, rivets: 0.36, port: 0.2, chevrons: 0.24};
      for (let i = 0; i < 46; i++) {
        const t = (i + 0.5) / 46;
        const yN = 0.92 - 1.65 * t;
        const r = Math.sqrt(Math.max(0, 1 - yN * yN));
        const ph = i * 2.399963 + 0.6;
        const d = [Math.sin(ph) * r, yN, Math.cos(ph) * r];
        if (d[2] > 0.55 && Math.abs(d[0]) < 0.6 && d[1] < 0.45) continue;
        const key = KINDS[i % KINDS.length];
        spots.push({key, v: i, dir: d, w: SIZE[key], depth: 0.05});
      }
    }
    // the larger marks a little finer
    for (const sp of spots) if (!['micro', 'tick', 'fluo', 'dots', 'emblem'].includes(sp.key)) sp.w *= 0.82;
    applyDecals(root, targets, spots);
  }
  // NT-D parts: decals laid in the Destroy pose on the faceplate, the opened mask halves' walls and cheek plates, the
  // V-fin blades and the camera's crown block
  {
    update({d: 1});
    root.updateMatrixWorld(true);
    const shown = (o) => {
      for (let q = o; q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    const targets = [];
    root.traverse((o) => o.isMesh && o.material === M.white && shown(o) && targets.push(o));
    const F = (x, y, z, dx, dy, dz) => [x + 4 * dx, y + 4 * dy, z + 4 * dz];
    const sp = [];
    for (const sx of [1, -1]) {
      // V-fin blades: along each blade, rays from the front
      for (const [f, key, w] of [[0.3, 'lines', 0.36], [0.45, 'micro', 0.2], [0.6, 'fluo', 0.12], [0.72, 'scribe', 0.4], [0.85, 'tick', 0.26], [0.38, 'rivets', 0.2]]) {
        const L = 2.6 * f;
        const x = sx * (0.3 + Math.sin(63 * D2R) * L);
        const y = 1.2 + Math.cos(63 * D2R) * L;
        sp.push({key, v: Math.round(f * 20), dir: [0, 0, 1], from: [x, y, 4], w, depth: 0.05, rot: -sx * (27 * D2R) * (key === 'fluo' ? 0 : 1)});
      }
      // mask side walls and cheek plates
      sp.push({key: 'panel', dir: [sx, -0.3, 0.55], w: 0.4, depth: 0.05});
      sp.push({key: 'vents', v: 1, dir: [sx, -0.6, 0.6], w: 0.14, depth: 0.05});
      sp.push({key: 'fluo', v: 2 + (sx > 0 ? 0 : 1), dir: [sx, -0.1, 0.7], w: 0.1, depth: 0.05});
      sp.push({key: 'zline', v: sx > 0 ? 0 : 1, dir: [sx, -0.45, 0.4], w: 0.36, depth: 0.05});
      sp.push({key: 'micro', v: sx > 0 ? 1 : 2, dir: [sx, -0.8, 0.5], w: 0.17, depth: 0.05});
      // faceplate flanks
      sp.push({key: 'tick', v: 3, dir: [sx * 0.3, -0.5, 1], from: [sx * 0.25, -0.3, 4], w: 0.18, depth: 0.04, rot: Math.PI / 2});
      sp.push({key: 'fluo', v: 3, dir: [0, 0, 1], from: [sx * 0.3, -0.62, 4], w: 0.07, depth: 0.04});
    }
    // faceplate centre and the crown block over the camera
    sp.push({key: 'number', dir: [0, 0, 1], from: [0, -0.62, 4], w: 0.1, depth: 0.04, follow: false});
    sp.push({key: 'hatch', v: 1, dir: [0, 0.2, 1], from: [0, 1.75, 4], w: 0.2, depth: 0.05, follow: false});
    sp.push({key: 'lines', dir: [0, 0.2, 1], from: [0, 1.6, 4], w: 0.24, depth: 0.04, rot: Math.PI / 2});
    void F;
    applyDecals(root, targets, sp);
    update({d: 0});
  }
  return {root, update, anchors, anchorWorld, materials: M, surf, hornParts};
}
