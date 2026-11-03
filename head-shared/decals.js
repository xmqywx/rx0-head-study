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
export const DECALS = {
  unit: () => [canvas(512, 192, (g) => {
    g.fillStyle = INK;
    g.font = FONT(96, 800);
    g.fillText('RX-0', 10, 96);
    g.font = FONT(30, 600);
    g.fillText('UNICORN  /  NT-D', 14, 140);
    g.fillStyle = RED;
    g.fillRect(14, 156, 300, 8);
    g.fillStyle = BLUE;
    g.fillRect(322, 156, 120, 8);
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
    g.fillRect(0, 10, 300, 10);
    g.fillStyle = INK;
    g.fillRect(310, 10, 60, 10);
    g.fillStyle = BLUE;
    g.fillRect(0, 34, 200, 6);
    g.fillStyle = INK;
    g.fillRect(210, 34, 290, 6);
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
    helper.rotateZ(s.rot || 0);
    if (!cache[s.key]) {
      const [tex, aspect] = DECALS[s.key]();
      cache[s.key] = {
        mat: new THREE.MeshStandardMaterial({map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.55}),
        aspect,
      };
    }
    const {mat, aspect} = cache[s.key];
    const size = new THREE.Vector3(s.w, s.w / aspect, 0.25);
    const geo = new DecalGeometry(hit.object, hit.point, helper.rotation, size);
    if (!geo.attributes.position || geo.attributes.position.count === 0) continue;
    geo.applyMatrix4(hit.object.matrixWorld.clone().invert()); // into the part's own space: it moves with the part
    const d = new THREE.Mesh(geo, mat);
    d.raycast = () => {};
    d.renderOrder = 2;
    hit.object.add(d);
    made.push(d);
  }
  return made;
}
