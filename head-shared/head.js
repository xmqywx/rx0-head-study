// The RX-0 head, traced from the orthographic sheets in ../reference (Unicorn Mode front/side/back/top, Destroy Mode
// the same, an internal exploded view). Origin: the visor centre line, +z forward, +x the head's left, 1 unit = 100 px
// of the sheet. Outside: helmet plates cut from one surface S(u, y), the brow, forehead block, visor and mask halves
// as chamfered prisms, the horn as two segmented halves on a hinge. Inside: a graphite skull, psycho-frame strips
// laid under every seam, the dual-eye sensor unit, three mask actuator rails, the horn hinge, vulcans, cooling ducts
// in the ear pods and a neck ball joint. update({d, explode, armor, time}) poses all of it from kin.js.
import * as THREE from 'three';
import {D2R, loftBody, makeSurface, Mesher, mirrorX, prism, shellPlate, sweep} from './geo.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CROWN, FACE, FIN, FRAME_RISE, HORN, MASK, pose} from './kin.js';

const V3 = THREE.Vector3;

// helmet surface, read off the Unicorn sheet: [y, half width, front z, back z]
const SHELL = [
  [-1.15, 0.8, 0.85, -1.1],
  [-0.55, 0.98, 1.15, -1.45],
  [0.3, 1.07, 1.35, -1.6],
  [0.95, 1.05, 1.38, -1.5],
  [1.4, 0.93, 1.22, -1.28],
  [1.72, 0.68, 0.95, -0.95],
  [1.92, 0.38, 0.58, -0.66],
  [2.0, 0.16, 0.35, -0.4],
];
// the skull under it, pulled in, with the face recessed for the faceplate and eye unit
const CORE = [
  [-1.2, 0.7, 0.62, -1.02],
  [-0.55, 0.86, 0.8, -1.32],
  [0.3, 0.95, 0.92, -1.46],
  [0.95, 0.94, 1.18, -1.38],
  [1.4, 0.83, 1.08, -1.16],
  [1.72, 0.59, 0.84, -0.84],
  [1.9, 0.32, 0.52, -0.56],
  [1.97, 0.12, 0.3, -0.34],
];

// helmet plates, left side (mirrored for the right): u in degrees at the plate's bottom (ub) and top (ut)
// red: which edges carry a psycho-frame strip underneath (b/t bottom/top, l/r the u0/u1 side)
const PLATES = [
  {k: 'crownF', ub: [12, 58], ut: [14, 76], yb: [1.18, 1.5], yt: [1.98, 1.98], lift: 1, up: 1, red: 'br', off: 0.05, t: 0.1},
  {k: 'crownR', ub: [58, 166], ut: [76, 166], yb: [1.5, 1.42], yt: [1.98, 1.98], lift: 1, up: 1, red: 'b', off: 0.05, t: 0.1},
  {k: 'forehead', ub: [18, 56], ut: [12, 58], yb: [0.98, 0.98], yt: [1.18, 1.5], lift: 0.6, up: 0.6, red: 'b'},
  {k: 'temple', ub: [56, 118], ut: [58, 118], yb: [0.78, 0.78], yt: [1.5, 1.42], lift: 0.8, up: 0.5, red: 'lb', off: 0.03, t: 0.13},
  {k: 'rearUp', ub: [118, 166], ut: [118, 166], y: [0.45, 1.42], lift: 0.8, up: 0.4, red: 'lbr', off: 0.025, t: 0.11},
  {k: 'sideMid', ub: [62, 118], ut: [56, 118], y: [-0.6, 0.78], lift: 0.35, up: 0, red: ''},
  {k: 'rearLow', ub: [118, 166], ut: [118, 166], y: [-1.1, 0.45], lift: 0.6, up: 0, red: 'lr', off: -0.01},
  {k: 'sideLow', ub: [68, 118], ut: [62, 118], y: [-1.12, -0.6], lift: 0.3, up: 0, red: ''},
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
    lens: std({color: '#0d1114', roughness: 0.2, metalness: 0.3}),
    red: std({color: '#7c1f1a', emissive: '#ff1a0a', emissiveIntensity: 0, roughness: 0.3, metalness: 0.15, envMapIntensity: 0.9}),
    chin: std({color: '#c8262a', roughness: 0.4}),
    green: std({color: '#0f2016', emissive: '#39ff6e', emissiveIntensity: 0, roughness: 0.2}),
    ink: new THREE.LineBasicMaterial({color: '#41474e', transparent: true, opacity: 0.55}),
  };
}

export function buildHead() {
  const M = materials();
  const ARMOR = [M.white, M.grey, M.visor];
  const root = new THREE.Group();
  const surf = makeSurface(SHELL, 2.6);
  const core = makeSurface(CORE, 2.6);
  const parts = []; // {obj, home: V3, ex: V3 (explode offset), pose(p, obj)}
  const anchors = {};
  const inkLines = [];

  const mesh = (geo, mat, ink = mat === M.white || mat === M.grey) => {
    const o = new THREE.Mesh(geo, mat);
    o.castShadow = true;
    o.receiveShadow = true;
    if (ink) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), M.ink);
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
  // Not a smooth egg: courses of graphite blocks bolted round a dark core, every course offset like brickwork, block
  // heights varied so the surface steps. Merged into one mesh per material.
  const skull = new THREE.Group();
  skull.add(mesh(loftBody(core, [-1.2, -0.85, -0.55, -0.1, 0.3, 0.65, 0.95, 1.2, 1.4, 1.58, 1.72, 1.84, 1.9, 1.97], 24), M.frame, false));
  {
    const hash = (i, j) => {
      const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const COURSES = [-1.18, -0.82, -0.46, -0.1, 0.25, 0.6, 0.92, 1.22, 1.48, 1.7, 1.86];
    const geos = [[], [], []];
    for (let i = 0; i < COURSES.length - 1; i++) {
      const y0 = COURSES[i];
      const y1 = COURSES[i + 1];
      const step = i > 7 ? 30 : 20;
      const shift = (i % 2) * step * 0.5;
      for (let u = -180 + shift; u < 180 + shift - 0.1; u += step) {
        const h = hash(i, u);
        const w = step * (h > 0.8 ? 1 : 1);
        const t = 0.04 + 0.06 * hash(u, i + 9);
        // some blocks split in two along their height for a busier, machined surface
        const split = h > 0.6 && y1 - y0 > 0.28;
        const parts = split ? [[y0, (y0 + y1) / 2], [(y0 + y1) / 2, y1]] : [[y0, y1]];
        for (const [a0, a1] of parts) {
          const g = shellPlate(core, {ub: [u, u + w], ut: [u, u + w], y: [a0, a1]}, {t: t * (split ? 1.25 : 1), gap: 0.018, bevel: 0.016, nu: w > 24 ? 2 : 1}).geo;
          geos[h < 0.45 ? 0 : h < 0.85 ? 1 : 2].push(g);
        }
      }
    }
    const MATS = [M.frame, M.frameMid, M.steel];
    for (const [k, list] of geos.entries()) if (list.length) skull.add(mesh(mergeGeometries(list), MATS[k], false));
  }

  // ---------------------------------------------------------------- psycho-frame: red parts, not lights
  // Chunky red segments chained along every armor seam, seated on the skull. In Unicorn Mode their tops sit just
  // under the plates' undersides, so the seams read dark; in NT-D the plates lift off and the frame rises into the
  // gaps. Each chain is its own part so the explode can float it between the skull and the armor.
  const frameParts = [];
  const chain = (path, {w = 0.072, h = 0.13, base = -0.15, seg = 0.42, gap = 0.04} = {}) => {
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
      // bevelled bar; every other segment carries a raised knuckle so the chain reads as machined links
      sweep(m, path3, ups, () => [[-w, 0], [w, 0], [w, h * 0.78], [w * 0.62, h], [-w * 0.62, h], [-w, h * 0.78]]);
      if (k % 3 === 1 && sl > 0.2) {
        const c = at(s0 + sl * 0.5);
        const c2 = at(s0 + sl * 0.5 + 0.07);
        sweep(m, [c.p.clone().addScaledVector(c.n, base), c2.p.clone().addScaledVector(c2.n, base)], [c.n, c2.n], () => [[-w * 1.45, 0], [w * 1.45, 0], [w * 1.45, h * 1.08], [-w * 1.45, h * 1.08]]);
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
  const addChain = (path, opts, mirror = true) => {
    const {geo, n, p} = chain(path, opts);
    for (const s of mirror ? [1, -1] : [1]) {
      const g = new THREE.Group();
      g.add(mesh(s > 0 ? geo : mirrorX(geo), M.red, false));
      const nn = n.clone();
      if (s < 0) nn.x = -nn.x;
      const part = add(g, nn.clone().multiplyScalar(0.5), (q, obj) => obj.position.addScaledVector(nn, FRAME_RISE * q.frame));
      frameParts.push(part);
    }
  };
  for (const c of PLATES) for (const e of c.red) addChain(edgePath(c, e), {base: (c.off ?? 0) - 0.21});
  addChain([[166, 1.42], [194, 1.42]], {base: -0.17}, false);
  // the face: frame either side of the faceplate, under the brow, and up both sides of the crest
  {
    const g = new THREE.Group();
    const face = (x, y) => 1.08 + 0.12 * y - 0.25 * x;
    g.add(
      mesh(geoOf((m) => prism(m, [[0.37, 0.06], [0.47, 0.06], [0.46, -0.6], [0.31, -1.1], [0.23, -1.06], [0.37, -0.6]], 'z', 0.76, face, 0.02, {mirror: true})), M.red, false),
      mesh(geoOf((m) => prism(m, [[0.08, 0.17], [0.8, 0.47], [0.88, 0.37], [0.1, 0.06]], 'z', 0.88, (x) => 1.25 - 0.3 * x, 0.02, {mirror: true})), M.red, false),
      mesh(geoOf((m) => prism(m, [[0.19, 0.5], [0.3, 0.58], [0.3, 1.52], [0.19, 1.62]], 'z', 0.95, (x, y) => 1.34 - 0.3 * (y - 0.5), 0.02, {mirror: true})), M.red, false),
    );
    for (const [x, y] of [[0.42, -0.25], [0.4, -0.55], [0.34, -0.85]])
      for (const s of [1, -1]) {
        const k = mesh(geoOf((m) => prism(m, [[x - 0.07, y + 0.05], [x + 0.07, y + 0.05], [x + 0.07, y - 0.05], [x - 0.07, y - 0.05]], 'z', 0.8, (xx, yy) => face(xx, yy) + 0.035, 0.015)), M.red, false);
        if (s < 0) k.scale.x = -1;
        g.add(k);
      }
    const part = add(g, new V3(0, 0, 0.55), (q, obj) => obj.position.z += 0.04 * q.frame);
    frameParts.push(part);
    anchors.frameFace = {obj: g, p: new V3(0.42, -0.4, 1.0)};
  }
  add(skull, new V3(0, 0, 0));
  anchors.frame = {obj: frameParts[0].obj, p: surf.S(66 * D2R, 1.72)};
  anchors.skull = {obj: skull, p: new V3(-0.7, 0.4, -1.0)};

  // ---------------------------------------------------------------- helmet plates
  const plateParts = [];
  const mkPlate = (c, side, extra = {}) => {
    const mirror = side < 0;
    const {geo, center, normal} = shellPlate(surf, c, {t: c.t ?? 0.09, off: c.off ?? 0, gap: 0.028, bevel: 0.035, mirror});
    const o = mesh(geo, M.white);
    const g = new THREE.Group();
    g.add(o);
    const ex = normal.clone().multiplyScalar(1.15).add(new V3(0, 0.25, 0));
    const part = add(g, ex, (p, obj) => {
      const k = p.crown;
      obj.position.addScaledVector(normal, CROWN.lift * k * c.lift).add(new V3(0, CROWN.rise * k * c.up, 0));
    });
    plateParts.push({part, center, c, ...extra});
    return part;
  };
  for (const c of PLATES) for (const s of [1, -1]) mkPlate(c, s);
  mkPlate({k: 'back', ub: [166, 194], ut: [166, 194], y: [-1.1, 1.42], lift: 0.5, up: 0.2, off: 0.04, t: 0.1}, 1);
  anchors.crown = {obj: plateParts[0].part.obj, p: surf.S(40 * D2R, 1.78).add(new V3(0, 0.05, 0))};

  // crown ridge: over the top from the forehead to the back
  {
    const path = [];
    const up = [];
    for (const y of [1.36, 1.6, 1.8, 1.95]) {
      path.push(surf.S(0, y).addScaledVector(surf.normal(0, y), 0.02));
      up.push(surf.normal(0, y));
    }
    for (const z of [0.15, -0.2]) {
      path.push(new V3(0, 2.02, z));
      up.push(new V3(0, 1, 0));
    }
    for (const y of [1.95, 1.8, 1.6, 1.42]) {
      path.push(surf.S(Math.PI, y).addScaledVector(surf.normal(Math.PI, y), 0.02));
      up.push(surf.normal(Math.PI, y));
    }
    const n = path.length;
    const geo = geoOf((m) =>
      sweep(m, path, up, (i) => {
        const w = 0.17 + 0.07 * (i / (n - 1));
        return [[-w, -0.06], [w, -0.06], [w, 0.08], [w * 0.7, 0.15], [-w * 0.7, 0.15], [-w, 0.08]];
      }),
    );
    const g = new THREE.Group();
    g.add(mesh(geo, M.white));
    add(g, new V3(0, 1.3, 0), (p, obj) => obj.position.add(new V3(0, (CROWN.rise + 0.05) * p.crown, 0)));
  }

  // ---------------------------------------------------------------- rear fin
  {
    const geo = geoOf((m) => prism(m, [[-1.46, 1.52], [-1.74, 1.44], [-1.82, 0.95], [-1.76, 0.32], [-1.5, 0.22]], 'x', -0.13, 0.13, 0.03));
    const g = new THREE.Group();
    g.add(mesh(geo, M.white));
    const sensor = mesh(geoOf((m) => prism(m, [[-1.79, 0.62], [-1.79, 0.48], [-1.83, 0.5], [-1.83, 0.6]], 'x', -0.07, 0.07, 0)), M.lens, false);
    g.add(sensor);
    add(g, new V3(0, 0.3, -1.3), (p, obj) => obj.position.add(new V3(0, FIN.rise * p.fin, -0.08 * p.fin)));
    anchors.fin = {obj: g, p: new V3(0, 1.4, -1.75)};
  }

  // ---------------------------------------------------------------- brow and forehead block (main camera, horn root)
  const browFar = (x, y) => 1.62 - 0.4 * x - 0.25 * (y - 0.3);
  {
    const brow = geoOf((m) =>
      prism(m, [[0.17, 0.14], [0.85, 0.47], [1.0, 0.56], [1.0, 0.8], [0.62, 1.1], [0.17, 0.98]], 'z', (x, y) => browFar(x, y) - 0.32, browFar, 0.035, {mirror: true}),
    );
    const g = new THREE.Group();
    g.add(mesh(brow, M.white));
    // vulcan muzzles in the brow corners
    add(g, new V3(0, 0.15, 1.0), (p, obj) => obj.position.add(new V3(0, 0, 0.04 * p.crown)));
    anchors.brow = {obj: g, p: new V3(0.55, 0.85, 1.42)};
  }
  const block = new THREE.Group();
  {
    const far = (x, y) => 1.7 - 0.3 * (y - 0.2) - 0.2 * Math.abs(x);
    block.add(
      mesh(
        geoOf((m) => prism(m, [[-0.12, 0.15], [0.12, 0.15], [0.2, 0.5], [0.21, 1.35], [0.15, 1.66], [-0.15, 1.66], [-0.21, 1.35], [-0.2, 0.5]], 'z', 0.95, far, 0.035)),
        M.white,
      ),
    );
    // main camera: a dark recess and a lens that lights with the eyes
    block.add(mesh(geoOf((m) => prism(m, [[-0.09, 0.72], [0.09, 0.72], [0.09, 1.02], [-0.09, 1.02]], 'z', 1.2, (x, y) => far(x, y) + 0.004, 0.01)), M.lens, false));
    const cam = mesh(geoOf((m) => prism(m, [[-0.055, 0.78], [0.055, 0.78], [0.055, 0.96], [-0.055, 0.96]], 'z', 1.2, (x, y) => far(x, y) + 0.012, 0.012)), M.green, false);
    block.add(cam);
    add(block, new V3(0, 0.5, 1.4), (p, obj) => obj.position.add(new V3(0, 0.26 * p.crown, 0.03 * p.crown)));
    anchors.camera = {obj: cam, p: new V3(0, 0.87, 1.5)};
  }

  // ---------------------------------------------------------------- horn: two segmented halves on a split hinge
  {
    const dir = new V3(0, HORN.tip[1] - HORN.root[1], HORN.tip[2] - HORN.root[2]).normalize();
    const L = HORN.len;
    const horn = new THREE.Group();
    horn.position.set(...HORN.root);
    horn.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
    const W = (f) => 0.33 * (1 - f) ** 0.5 + 0.006;
    const Dp = (f) => 0.21 * (1 - f) + 0.006;
    const SEG = [0, 0.24, 0.46, 0.64, 0.8, 1];
    const half = (s) => {
      const m = new Mesher();
      for (let i = 0; i < SEG.length - 1; i++) {
        const f0 = SEG[i] + (i ? 0.006 : 0);
        const f1 = SEG[i + 1];
        const fs = [f0, f0 + 0.03, f1];
        const path = fs.map((f) => new V3(0, f * L, 0));
        const up = fs.map(() => new V3(0, 0, 1));
        sweep(m, path, up, (j) => {
          const f = fs[j];
          const k = j === 0 ? 1.0 : j === 1 ? 1.07 : 1;
          const w = W(f) * k;
          const d = Dp(f) * k;
          return [[0, d], [s * w * 0.55, d * 0.5], [s * w, 0], [s * w * 0.55, -d * 0.5], [0, -d]];
        });
      }
      const g = new THREE.Group();
      g.add(mesh(m.geo(), M.white));
      return g;
    };
    const halves = [1, -1].map((s) => {
      const h = half(s);
      const pv = new THREE.Group();
      pv.position.set(s * 0.02, 0.06, 0);
      h.position.set(-s * 0.02, -0.06, 0);
      pv.add(h);
      horn.add(pv);
      return {pv, h, s};
    });
    // the hinge: two knuckles and an axle across the horn's root, lit up only by the explode
    const hinge = new THREE.Group();
    const knuckle = new THREE.CylinderGeometry(0.11, 0.11, 0.2, 10);
    knuckle.rotateX(Math.PI / 2);
    for (const s of [1, -1]) {
      const k = mesh(knuckle, M.frameMid, false);
      k.position.set(s * 0.12, 0.05, 0);
      hinge.add(k);
    }
    const axle = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8);
    axle.rotateZ(Math.PI / 2);
    const ax = mesh(axle, M.steel, false);
    ax.position.set(0, 0.05, 0);
    hinge.add(ax);
    horn.add(hinge);
    add(horn, new V3(0, 1.5, 0.25), (p, obj) => {
      const a = p.hornAngle * D2R;
      for (const {pv, h, s} of halves) {
        pv.rotation.z = -s * a;
        pv.position.set(s * (0.02 + HORN.spread * p.horn), 0.06 - HORN.drop * p.horn, 0);
        h.position.y = -0.06 - HORN.sink * p.horn;
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
    const shell = mk((m) => prism(m, [[0.012, -0.1], [0.95, 0.26], [0.84, -0.42], [0.5, -1.05], [0.15, -1.12], [0.012, -1.12]], 'z', (x, y) => maskFar(x, y) - 0.2, maskFar, 0.03));
    // the mask's chin quarter is its own part: it tucks up behind the faceplate instead of riding out with the half
    const jaw = mk((m) => prism(m, [[0.012, -1.135], [0.15, -1.135], [0.15, -1.55], [0.012, -1.55]], 'z', (x, y) => maskFar(x, y) - 0.2, maskFar, 0.025));
    const chin = mk((m) => prism(m, [[0.012, -1.16], [0.14, -1.16], [0.14, -1.53], [0.012, -1.53]], 'z', (x, y) => maskFar(x, y) - 0.1, (x, y) => maskFar(x, y) + 0.05, 0.02));
    const jg = new THREE.Group();
    jg.add(mesh(jaw, M.white), mesh(chin, M.white));
    add(jg, new V3(s * 0.4, -1.0, 0.9), (p, obj) => obj.position.add(new V3(0, 0.28 * p.mask, -0.42 * p.mask)));
    const visor = mk((m) => prism(m, [[0.012, 0.12], [0.012, -0.1], [0.95, 0.26], [0.97, 0.4], [0.85, 0.47]], 'z', (x, y) => visorFar(x, y) - 0.15, visorFar, 0.015));
    const pv = pivot(new V3(s * 0.48, -0.55, 1.15), mesh(shell, M.white));
    const vg = new THREE.Group();
    vg.add(mesh(visor, M.visor, false));
    // the visor retracts into the brow before the mask halves part
    add(vg, new V3(s * 0.5, 0.3, 1.2), (p, obj) => obj.position.add(new V3(0, 0.05 * p.mask, -0.44 * Math.min(1, p.mask * 1.6))));
    add(pv, new V3(s * 1.0, -0.2, 0.95), (p, obj) => {
      const k = p.mask;
      // slide out and back, outer edge swinging behind the cheek guard, so only the inner face stays in view
      obj.position.add(new V3(s * MASK.slide * k, -MASK.drop * k, -MASK.back * k));
      obj.rotation.y = s * MASK.yaw * k;
    });
    if (s > 0) anchors.mask = {obj: pv, p: new V3(0.45, -0.55, 1.15)};
  }

  // ---------------------------------------------------------------- face: Gundam faceplate (Destroy Mode)
  {
    const g = new THREE.Group();
    const far = (x, y) => 1.08 + 0.12 * y - 0.3 * Math.abs(x);
    g.add(mesh(geoOf((m) => prism(m, [[-0.33, -0.08], [-0.12, -0.16], [0, -0.13], [0.12, -0.16], [0.33, -0.08], [0.3, -0.62], [0.17, -0.7], [-0.17, -0.7], [-0.3, -0.62]], 'z', 0.82, far, 0.03)), M.white));
    // mouth vents: three chevrons
    for (const y of [-0.3, -0.4, -0.5])
      g.add(mesh(geoOf((m) => prism(m, [[0, y + 0.02], [0.17, y + 0.06], [0.17, y + 0.025], [0, y - 0.015]], 'z', 0.95, (x, yy) => far(x, yy) + 0.008, 0.006, {mirror: true})), M.lens, false));
    const chin = mesh(geoOf((m) => prism(m, [[-0.15, -0.66], [0.15, -0.66], [0.12, -1.28], [-0.12, -1.28]], 'z', 0.78, (x, y) => 1.02 + 0.08 * y, 0.03)), M.chin, false);
    // the chin rides up inside the face in Unicorn Mode and drops into place as the faceplate rolls out
    const chinG = new THREE.Group();
    chinG.add(chin);
    g.add(chinG);
    add(g, new V3(0, -0.5, 1.9), (p, obj) => {
      obj.position.add(new V3(0, 0, -FACE.travel * (1 - p.face)));
      chinG.position.set(0, 0.34 * (1 - p.face), -0.06 * (1 - p.face));
    });
    anchors.chin = {obj: chin, p: new V3(0, -1.0, 1.0)};
    anchors.vents = {obj: g, p: new V3(0.1, -0.4, 1.0)};
  }

  // ---------------------------------------------------------------- dual-eye sensor unit
  {
    const g = new THREE.Group();
    g.add(mesh(geoOf((m) => prism(m, [[-0.84, 0.44], [-0.1, 0.1], [0.1, 0.1], [0.84, 0.44], [0.84, -0.2], [-0.84, -0.2]], 'z', 0.7, (x) => 1.0 - 0.26 * Math.abs(x), 0.03)), M.frame, false));
    const eyeFar = (x, y) => 1.1 + 0.1 * y - 0.3 * Math.abs(x);
    const eyes = mesh(geoOf((m) => prism(m, [[0.15, 0.03], [0.72, 0.31], [0.8, 0.33], [0.78, 0.18], [0.22, -0.1]], 'z', 0.88, eyeFar, 0.02, {mirror: true})), M.green, false);
    g.add(eyes);
    g.add(mesh(geoOf((m) => prism(m, [[0.11, 0.06], [0.74, 0.37], [0.85, 0.38], [0.83, 0.13], [0.2, -0.15]], 'z', 0.86, (x, y) => eyeFar(x, y) - 0.03, 0.01, {mirror: true})), M.red, false));
    add(g, new V3(0, 0.05, 1.25));
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

  // ---------------------------------------------------------------- cheek guards
  for (const s of [1, -1]) {
    const geo = geoOf((m) =>
      prism(m, [[1.26, -0.02], [1.3, -0.42], [1.12, -0.95], [0.62, -1.02], [0.48, -0.55], [0.6, -0.02]], 'x', 0.7, (a) => 0.99 - 0.13 * (a - 0.5), 0.035),
    );
    const g = new THREE.Group();
    g.add(mesh(s > 0 ? geo : mirrorX(geo), M.white));
    add(g, new V3(s * 1.0, -0.35, 0.3), (p, obj) => obj.position.add(new V3(s * 0.14 * p.cheek, -0.05 * p.cheek, -0.1 * p.cheek)));
    if (s > 0) anchors.cheek = {obj: g, p: new V3(0.95, -0.6, 0.85)};
  }

  // ---------------------------------------------------------------- ear pods with cooling ducts, vulcans at the temples
  for (const s of [1, -1]) {
    const M2 = (geo) => (s > 0 ? geo : mirrorX(geo));
    const pod = new THREE.Group();
    const poly = [[0.42, 0.52], [0.45, -0.62], [0.2, -0.85], [-0.62, -0.85], [-0.8, -0.6], [-0.8, 0.35], [-0.6, 0.55]];
    pod.add(mesh(M2(geoOf((m) => prism(m, poly, 'x', 0.92, 1.36, 0.04))), M.white));
    // side grilles: dark windows with slats
    for (const [z0, z1, y0, y1] of [[0.28, 0.06, 0.32, -0.3], [-0.18, -0.6, 0.3, -0.12]]) {
      pod.add(mesh(M2(geoOf((m) => prism(m, [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], 'x', 1.3, 1.366, 0.008))), M.lens, false));
      for (let k = 1; k < 4; k++) {
        const yy = y1 + ((y0 - y1) * k) / 4;
        pod.add(mesh(M2(geoOf((m) => prism(m, [[z0 - 0.01, yy + 0.018], [z1 + 0.01, yy + 0.018], [z1 + 0.01, yy - 0.018], [z0 - 0.01, yy - 0.018]], 'x', 1.33, 1.37, 0.005))), M.grey, false));
      }
    }
    // front grille
    pod.add(mesh(M2(geoOf((m) => prism(m, [[1.0, 0.3], [1.24, 0.3], [1.24, -0.25], [1.0, -0.25]], 'z', 0.38, 0.465, 0.01))), M.lens, false));
    add(pod, new V3(s * 1.6, 0.05, -0.1));
    if (s > 0) anchors.pod = {obj: pod, p: new V3(1.37, 0.0, -0.3)};
    // cooling duct inside the pod
    const duct = new THREE.Group();
    duct.add(mesh(M2(geoOf((m) => prism(m, [[0.2, 0.3], [-0.55, 0.3], [-0.55, -0.55], [0.2, -0.55]], 'x', 0.84, 1.18, 0.02))), M.frameMid, false));
    for (let k = 0; k < 6; k++) {
      const yy = -0.48 + k * 0.13;
      duct.add(mesh(M2(geoOf((m) => prism(m, [[0.15, yy + 0.03], [-0.5, yy + 0.03], [-0.5, yy - 0.02], [0.15, yy - 0.02]], 'x', 1.17, 1.22, 0.006))), M.frame, false));
    }
    add(duct, new V3(s * 0.9, 0, -0.1));
    if (s > 0) anchors.duct = {obj: duct, p: new V3(1.2, -0.1, -0.2)};
    // vulcan: barrel through the temple, muzzle forward
    const vul = new THREE.Group();
    const barrel = new THREE.CylinderGeometry(0.06, 0.07, 1.1, 10);
    barrel.rotateX(Math.PI / 2);
    const b = mesh(barrel, M.frameMid, false);
    b.position.set(s * 0.86, 0.72, 0.5);
    vul.add(b);
    const muzzle = new THREE.CylinderGeometry(0.085, 0.085, 0.12, 10);
    muzzle.rotateX(Math.PI / 2);
    const mz = mesh(muzzle, M.lens, false);
    mz.position.set(s * 0.86, 0.72, 1.05);
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
    g.add(mesh(geoOf((m) => prism(m, oct(0.6, -0.72, 0.5, 0.18), 'y', -1.46, -0.72, 0.03)), M.frame, false));
    g.add(mesh(geoOf((m) => prism(m, oct(0.82, -0.82, 0.7, 0.22), 'y', -1.46, -1.2, 0.03)), M.frameMid, false));
    g.add(mesh(geoOf((m) => prism(m, oct(0.98, -0.92, 0.88, 0.26), 'y', -1.72, -1.46, 0.04)), M.grey));
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
    M.ink.opacity = 0.55 * a;
  };

  const tmp = new V3();
  const RED_OFF = new THREE.Color('#4a1a17');
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
    M.red.emissiveIntensity = p.frame * (0.9 + 0.7 * beat);
    M.red.color.copy(RED_OFF).lerp(RED_ON, p.frame);
    M.green.emissiveIntensity = 0.04 + 2.5 * p.eyes;
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
  return {root, update, anchors, anchorWorld, materials: M, surf};
}
