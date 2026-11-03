// Waterslide-style marking decals for the armor, like a Gunpla detail-up sheet: unit codes, caution stencils, thin
// colour lines, number blocks, small arrows and barcodes in dark grey, red and light blue. Each is drawn into its own
// canvas texture and projected onto the armor with DecalGeometry, then parented to the part it lies on, so it moves
// with that part through NT-D and the explode. All designs are original generic markings.
import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

const INK = '#3a3f46';
const RED = '#c8261e';
const BLUE = '#5aa8d6';
const FONT = (px, w = 700) => `${w} ${px}px "JetBrains Mono", "Menlo", monospace`;

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const line = (g, x0, y0, x1, y1, c, wd) => {
  g.strokeStyle = c;
  g.lineWidth = wd;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
};

// each returns a texture and the aspect (w/h)
const FLUO = ['#ff6a13', '#c6ff1a', '#22e3ff', '#ff2f6d'];

export const DECALS = {
  // tiny stencil block: 2–3 lines of very small text with a hairline under it
  micro: (i = 0) => [canvas(512, 160, (g) => {
    const T = [['HYD.  PRESS  210', 'CHECK  ·  A-07'], ['NT-D  LOCK', 'MAINT.  ACCESS  4B'], ['PSYCHO-F.  REF  12', 'DO  NOT  PAINT'], ['SENS.  WIRE  /  C3', 'U.C.0096  ANAHEIM']][i % 4];
    g.fillStyle = INK;
    g.font = FONT(30, 700);
    g.fillText(T[0], 6, 44);
    g.font = FONT(24, 500);
    g.fillText(T[1], 6, 86);
    g.fillRect(6, 104, 380, 3);
    g.fillStyle = i % 2 ? RED : BLUE;
    g.fillRect(392, 100, 110, 10);
    g.fillStyle = INK;
    g.font = FONT(18, 500);
    g.fillText('00' + (i + 3) + '-' + (17 + i * 9), 6, 140);
  }), 512 / 160],
  // a hairline with end ticks and a small label
  tick: (i = 0) => [canvas(512, 64, (g) => {
    g.fillStyle = INK;
    g.fillRect(4, 30, 504, 3);
    g.fillRect(4, 16, 3, 30);
    g.fillRect(505, 16, 3, 30);
    g.fillStyle = [RED, BLUE, INK][i % 3];
    g.fillRect(150 + (i % 4) * 60, 26, 70, 11);
    g.fillStyle = INK;
    g.font = FONT(16, 600);
    g.fillText(['A', 'B', 'C', 'D'][i % 4] + '-' + (10 + i), 12, 58);
  }), 8],
  // an engraved panel line: a dark groove with a light lower lip, sometimes stepped, sometimes ending in a dot
  scribe: (i = 0) => [canvas(1024, 40, (g) => {
    const step = i % 3 === 1;
    const y0 = 4;
    const groove = (x0, x1, y) => {
      g.fillStyle = 'rgba(40,44,50,0.9)';
      g.fillRect(x0, y, x1 - x0, 14);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(x0, y + 14, x1 - x0, 5);
    };
    if (step) {
      groove(0, 480, y0);
      g.fillStyle = 'rgba(40,44,50,0.85)';
      g.fillRect(480, y0, 4, 10);
      groove(480, 1024, y0 + 14);
    } else groove(0, 1024, y0);
    if (i % 4 === 2) {
      g.fillStyle = 'rgba(40,44,50,0.9)';
      g.beginPath();
      g.arc(1012, y0 + 2, 6, 0, Math.PI * 2);
      g.fill();
    }
  }), 26],
  // sci-fi / military engraving patterns (recessed details scribed into the plates): drawn as grooves with a light lip
  // hatch: a chamfered access-panel outline with two fastener holes
  hatch: (i = 0) => [canvas(256, 192, (g) => {
    const G = 'rgba(40,44,50,0.9)';
    const L = 'rgba(255,255,255,0.95)';
    const path = (o) => {
      g.beginPath();
      g.moveTo(30 + o, 12 + o);
      g.lineTo(226 - o, 12 + o);
      g.lineTo(244 - o, 30 + o);
      g.lineTo(244 - o, 162 - o);
      g.lineTo(226 - o, 180 - o);
      g.lineTo(30 + o, 180 - o);
      g.lineTo(12 + o, 162 - o);
      g.lineTo(12 + o, 30 + o);
      g.closePath();
    };
    g.lineWidth = 7;
    g.strokeStyle = G;
    path(0);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = L;
    path(5);
    g.stroke();
    g.fillStyle = G;
    for (const [x, y] of [[40, 40], [216, 152]]) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
    if (i % 2) {
      g.fillRect(60, 90, 136, 6);
      g.fillStyle = L;
      g.fillRect(60, 96, 136, 2);
    }
  }), 256 / 192],
  // vents: a row of short parallel slots
  vents: (i = 0) => [canvas(256, 96, (g) => {
    const n = 5 + (i % 3);
    for (let k = 0; k < n; k++) {
      const x = 14 + (k * 228) / n;
      g.fillStyle = 'rgba(40,44,50,0.92)';
      g.fillRect(x, 10, 18, 72);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(x + 18, 10, 4, 72);
    }
  }), 256 / 96],
  // a bolted circular port: groove ring, six hex bolts, a centre cross
  port: () => [canvas(192, 192, (g) => {
    g.strokeStyle = 'rgba(40,44,50,0.9)';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(96, 96, 72, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(96, 96, 66, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(40,44,50,0.9)';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const cx = 96 + Math.cos(a) * 50;
      const cy = 96 + Math.sin(a) * 50;
      g.beginPath();
      for (let j = 0; j < 6; j++) g.lineTo(cx + Math.cos((j / 6) * Math.PI * 2) * 7, cy + Math.sin((j / 6) * Math.PI * 2) * 7);
      g.closePath();
      g.fill();
    }
    g.fillRect(90, 70, 12, 52);
    g.fillRect(70, 90, 52, 12);
  }), 1],
  // an angular panel line: runs, turns 45°, runs again (the chamfered breaks typical of mecha armor)
  zline: (i = 0) => [canvas(512, 128, (g) => {
    const G = 'rgba(40,44,50,0.9)';
    const L = 'rgba(255,255,255,0.95)';
    const pts = i % 2 ? [[8, 100], [220, 100], [290, 30], [504, 30]] : [[8, 30], [180, 30], [250, 100], [380, 100], [420, 60], [504, 60]];
    for (const [c, w, dy] of [[G, 8, 0], [L, 3, 6]]) {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy)));
      g.stroke();
    }
    g.fillStyle = G;
    g.beginPath();
    g.arc(pts[pts.length - 1][0] - 4, pts[pts.length - 1][1], 7, 0, Math.PI * 2);
    g.fill();
  }), 4],
  // a row of hex rivets
  rivets: (i = 0) => [canvas(384, 64, (g) => {
    const n = 6 + (i % 3);
    for (let k = 0; k < n; k++) {
      const cx = 24 + (k * 336) / (n - 1);
      g.fillStyle = 'rgba(40,44,50,0.85)';
      g.beginPath();
      for (let j = 0; j < 6; j++) g.lineTo(cx + Math.cos((j / 6) * Math.PI * 2 + 0.5) * 13, 32 + Math.sin((j / 6) * Math.PI * 2 + 0.5) * 13);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(cx - 3, 29, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }), 6],
  // chevron grooves (direction marks scribed in)
  chevrons: () => [canvas(256, 96, (g) => {
    for (let k = 0; k < 3; k++) {
      const x = 30 + k * 70;
      for (const [c, w, d] of [['rgba(40,44,50,0.9)', 9, 0], ['rgba(255,255,255,0.95)', 3, 6]]) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(x + d, 12);
        g.lineTo(x + 40 + d, 48);
        g.lineTo(x + d, 84);
        g.stroke();
      }
    }
  }), 256 / 96],
  // the luminous strips: tiny solid rectangles in fluorescent ink
  fluo: (i = 0) => [canvas(128, 32, (g) => {
    g.fillStyle = FLUO[i % FLUO.length];
    g.fillRect(2, 4, 124, 24);
  }), 4],
  dots: (i = 0) => [canvas(256, 64, (g) => {
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k === i % 6 ? RED : INK;
      g.beginPath();
      g.arc(20 + k * 42, 32, 9, 0, Math.PI * 2);
      g.fill();
    }
  }), 4],
  unit: () => [canvas(512, 192, (g) => {
    g.fillStyle = INK;
    g.font = FONT(96, 800);
    g.fillText('RX-0', 10, 96);
    g.font = FONT(30, 600);
    g.fillText('UNICORN  /  NT-D', 14, 140);
    g.fillStyle = RED;
    g.fillRect(14, 156, 300, 4);
    g.fillStyle = BLUE;
    g.fillRect(322, 156, 120, 4);
  }), 512 / 192],
  caution: () => [canvas(512, 160, (g) => {
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(70, 18);
    g.lineTo(130, 138);
    g.lineTo(10, 138);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.font = FONT(80, 800);
    g.fillText('!', 54, 128);
    g.fillStyle = INK;
    g.font = FONT(54, 800);
    g.fillText('CAUTION', 150, 78);
    g.font = FONT(24, 600);
    g.fillText('PSYCHO-FRAME  HIGH OUTPUT', 152, 122);
  }), 512 / 160],
  number: () => [canvas(256, 256, (g) => {
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.strokeRect(8, 8, 240, 240);
    g.fillStyle = INK;
    g.font = FONT(120, 800);
    g.fillText('014', 20, 150);
    g.fillStyle = RED;
    g.fillRect(20, 180, 216, 12);
    g.fillStyle = INK;
    g.font = FONT(22, 600);
    g.fillText('A-UNIT  LH', 22, 230);
  }), 1],
  lines: () => [canvas(512, 64, (g) => {
    g.fillStyle = RED;
    g.fillRect(0, 12, 300, 5);
    g.fillStyle = INK;
    g.fillRect(310, 12, 60, 5);
    g.fillStyle = BLUE;
    g.fillRect(0, 34, 200, 3);
    g.fillStyle = INK;
    g.fillRect(210, 34, 290, 3);
  }), 512 / 64],
  nostep: () => [canvas(384, 128, (g) => {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.strokeRect(6, 6, 372, 116);
    g.fillStyle = INK;
    g.font = FONT(50, 800);
    g.fillText('NO STEP', 40, 82);
    line(g, 20, 100, 360, 100, RED, 6);
  }), 384 / 128],
  barcode: () => [canvas(384, 160, (g) => {
    g.fillStyle = INK;
    let x = 10;
    let seed = 7;
    while (x < 300) {
      seed = (seed * 16807) % 2147483647;
      const w = 2 + (seed % 7);
      g.fillRect(x, 10, w, 100);
      x += w + 2 + (seed % 5);
    }
    g.font = FONT(28, 600);
    g.fillText('0000-RX0-AE', 10, 148);
  }), 384 / 160],
  arrow: () => [canvas(256, 128, (g) => {
    g.fillStyle = BLUE;
    g.beginPath();
    g.moveTo(10, 44);
    g.lineTo(150, 44);
    g.lineTo(150, 14);
    g.lineTo(240, 64);
    g.lineTo(150, 114);
    g.lineTo(150, 84);
    g.lineTo(10, 84);
    g.closePath();
    g.fill();
  }), 2],
  vertical: () => [canvas(96, 512, (g) => {
    g.save();
    g.translate(70, 500);
    g.rotate(-Math.PI / 2);
    g.fillStyle = INK;
    g.font = FONT(44, 800);
    g.fillText('PSYCHO-FRAME', 0, 0);
    g.restore();
    g.fillStyle = RED;
    g.fillRect(80, 10, 8, 490);
  }), 96 / 512],
  // a large back emblem: a chevron shield with a horn, unit text and stripes (original design)
  emblem: () => [canvas(512, 512, (g) => {
    g.strokeStyle = INK;
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(256, 30);
    g.lineTo(470, 110);
    g.lineTo(440, 330);
    g.lineTo(256, 480);
    g.lineTo(72, 330);
    g.lineTo(42, 110);
    g.closePath();
    g.stroke();
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(256, 70);
    g.lineTo(300, 330);
    g.lineTo(256, 300);
    g.lineTo(212, 330);
    g.closePath();
    g.fill();
    g.fillStyle = INK;
    g.font = FONT(64, 800);
    g.textAlign = 'center';
    g.fillText('RX-0', 256, 400);
    g.font = FONT(26, 600);
    g.fillText('U.C. 0096  ·  FULL PSYCHO-FRAME', 256, 440);
    g.fillStyle = BLUE;
    g.fillRect(100, 140, 60, 10);
    g.fillRect(352, 140, 60, 10);
  }), 1],
  // a tall side panel stencil: stacked lines and small text, read along the plate
  panel: () => [canvas(512, 128, (g) => {
    g.fillStyle = INK;
    g.font = FONT(30, 700);
    g.fillText('ARMOR-B / 2.4  ', 8, 40);
    g.fillStyle = RED;
    g.fillRect(8, 56, 380, 7);
    g.fillStyle = INK;
    g.fillRect(396, 56, 100, 7);
    g.fillStyle = BLUE;
    g.fillRect(8, 74, 160, 5);
    g.font = FONT(20, 600);
    g.fillStyle = INK;
    g.fillText('EXT. ARMOR — DO NOT REMOVE', 8, 112);
  }), 4],
  ring: () => [canvas(128, 128, (g) => {
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = RED;
    g.beginPath();
    g.arc(64, 64, 22, 0, Math.PI * 2);
    g.fill();
  }), 1],
};

/**
 * Lay decals on the armor. targets: meshes that may carry decals; spots: [{key, dir: [x,y,z], from: [x,y,z],
 * w, rot}] — a ray from `from` toward the head centre along −dir finds the armor surface; the decal is projected
 * there, sized w wide (height from its aspect), rotated rot about the surface normal, and parented to the hit mesh.
 */
// the dominant direction of a part's vertices projected onto the plane with normal n (2D PCA)
function longAxis(mesh, n) {
  const P = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const pts = [];
  const step = Math.max(1, Math.floor(P.count / 400));
  for (let i = 0; i < P.count; i += step) pts.push(v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).clone());
  const c = pts.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const t1 = new THREE.Vector3(0, 1, 0).cross(n);
  if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0).cross(n);
  t1.normalize();
  const t2 = n.clone().cross(t1).normalize();
  let a = 0;
  let b = 0;
  let d = 0;
  for (const q of pts) {
    const x = q.clone().sub(c).dot(t1);
    const y = q.clone().sub(c).dot(t2);
    a += x * x;
    b += x * y;
    d += y * y;
  }
  if (Math.abs(a - d) < 1e-6 && Math.abs(b) < 1e-6) return null;
  const ang = 0.5 * Math.atan2(2 * b, a - d);
  return t1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(t2, Math.sin(ang));
}

export function applyDecals(root, targets, spots, centre = new THREE.Vector3(0, 0.3, -0.2)) {
  root.updateMatrixWorld(true);
  const cache = {};
  const ray = new THREE.Raycaster();
  const helper = new THREE.Object3D();
  const made = [];
  for (const s of spots) {
    const dir = new THREE.Vector3(...s.dir).normalize();
    const origin = centre.clone().addScaledVector(dir, 4);
    if (s.from) origin.set(...s.from);
    ray.set(origin, dir.clone().negate());
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit || !hit.face) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(dir) < 0) n.negate();
    helper.position.copy(hit.point);
    helper.up.set(0, 1, 0);
    if (Math.abs(n.y) > 0.9) helper.up.set(0, 0, -1);
    helper.lookAt(hit.point.clone().add(n));
    // follow the armor: turn the decal so its long side runs along the part's long axis (in the tangent plane)
    if (s.follow !== false) {
      const axis = longAxis(hit.object, n);
      if (axis) {
        const xNow = new THREE.Vector3(1, 0, 0).applyQuaternion(helper.quaternion);
        const yNow = new THREE.Vector3(0, 1, 0).applyQuaternion(helper.quaternion);
        let a = Math.atan2(axis.dot(yNow), axis.dot(xNow));
        if (a > Math.PI / 2) a -= Math.PI; // keep text reading left to right
        if (a < -Math.PI / 2) a += Math.PI;
        helper.rotateZ(a);
      }
    }
    helper.rotateZ(s.rot || 0);
    const ck = s.key + ':' + (s.v ?? 0);
    if (!cache[ck]) {
      const [tex, aspect] = DECALS[s.key](s.v ?? 0);
      const common = {map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4};
      cache[ck] = {
        // fluorescent ink reads as lit: unlit and outside tone mapping, so it stays saturated
        mat: s.key === 'fluo' ? new THREE.MeshBasicMaterial({...common, toneMapped: false}) : new THREE.MeshStandardMaterial({...common, roughness: 0.55}),
        aspect,
      };
    }
    const {mat, aspect} = cache[ck];
    const size = new THREE.Vector3(s.w, s.w / aspect, s.depth ?? 0.08);
    const geo = new DecalGeometry(hit.object, hit.point, helper.rotation, size);
    if (!geo.attributes.position || geo.attributes.position.count === 0) continue;
    geo.applyMatrix4(hit.object.matrixWorld.clone().invert()); // into the part's own space: it moves with the part
    const d = new THREE.Mesh(geo, mat);
    d.raycast = () => {};
    d.renderOrder = 2;
    hit.object.add(d);
    made.push(d);
  }
  if (typeof window !== 'undefined') window.__decals = {asked: spots.length, made: made.length};
  return made;
}
