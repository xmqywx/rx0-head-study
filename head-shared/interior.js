// The head's interior as systems, each with a job, wired to each other — not a stack of rings:
//
//   NECK YAW      a slewing ring (toothed outer race, ball cage, inner race) on the neck ball, turned by a motor pinion
//   SPINE         a titanium hex column from the yaw ring to the crown; two machined bulkheads hang the systems on it
//   SENSORS       an optical bench at eye level: two eye-sensor barrels behind the dual eyes, the main-camera barrel
//                 above them behind the forehead window, each with focus rings and a glass front
//   PROCESSOR     a card cage in the back of the skull: nine blade boards with lit edges, titanium rails, a cold plate
//   COOLING       copper heat pipes from the cold plate to two radiator stacks with fans, toward the ear pods; a pump
//   POWER         four capacitor cells round the spine under the lower bulkhead, brass terminals, amber charge bands
//   HORN DRIVE    a worm and worm wheel under the horn root: the wheel turns with the horn's split (kin.js), the worm
//                 spins with it, a servo drives the worm
//   HARNESS       colour-coded cable runs (yellow power, blue data, black ground) from the processor to every system
//
// Materials are machined metals (gunmetal, titanium, aluminium, brass, copper, blue and orange anodising) with small
// lit indicators; no red (red is the psycho-frame's, and only in NT-D). Each system is one explode part.
import * as THREE from 'three';
import {gear} from './mechparts.js';

const V3 = THREE.Vector3;

export function interiorMaterials() {
  const met = (color, roughness, metalness = 0.9, o = {}) =>
    new THREE.MeshStandardMaterial({color, roughness, metalness, envMapIntensity: 1.1, ...o});
  return {
    gun: met('#353b42', 0.36, 0.85),
    gunDark: met('#22272c', 0.42, 0.8),
    ti: met('#a9b0b6', 0.28),
    alu: met('#c8cdd1', 0.42, 0.8),
    brass: met('#c09a4a', 0.3),
    copper: met('#c0703f', 0.28),
    blue: met('#2d5f94', 0.32, 0.75),
    orange: met('#e07a26', 0.38, 0.55),
    pcb: new THREE.MeshStandardMaterial({color: '#142a24', roughness: 0.55, metalness: 0.2}),
    glass: new THREE.MeshStandardMaterial({color: '#0c3340', roughness: 0.05, metalness: 0.3, envMapIntensity: 1.6}),
    rubber: new THREE.MeshStandardMaterial({color: '#17191c', roughness: 0.75}),
    wireY: new THREE.MeshStandardMaterial({color: '#e2b53a', roughness: 0.5}),
    wireB: new THREE.MeshStandardMaterial({color: '#2f7fd6', roughness: 0.5}),
    cyan: new THREE.MeshBasicMaterial({color: '#62e6ff', toneMapped: false}),
    amber: new THREE.MeshBasicMaterial({color: '#ffb547', toneMapped: false}),
  };
}

/**
 * build the interior; `add(obj, ex)` registers an explode part, `mesh(geo, mat)` makes a shadowed mesh.
 * Returns update(p) to drive the moving parts from the pose.
 */
export function buildInterior({add, mesh, M}) {
  const UP = new V3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V3(1, 1, 1);
  const clean = (g) => {
    g.deleteAttribute('uv');
    return g;
  };
  // a turned part about y: pts [[r, y], ...]
  const lathe = (pts, seg = 40) => clean(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
  // the same turned part laid along +z (barrels, shafts pointing forward)
  const latheZ = (pts, seg) => lathe(pts, seg).rotateX(Math.PI / 2);
  const cylY = (r, h, seg = 20) => clean(new THREE.CylinderGeometry(r, r, h, seg));
  const boxG = (w, h, d) => clean(new THREE.BoxGeometry(w, h, d));
  const chamferBox = (w, h, d, c) => {
    // a box with chamfered vertical edges (an extruded octagon), y up
    const s = new THREE.Shape();
    const P = [[-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c]];
    s.moveTo(...P[0]);
    for (const p of P.slice(1)) s.lineTo(...p);
    const g = new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: false});
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    return clean(g);
  };
  const tube = (pts, r, seg = 40) => clean(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), seg, r, 8, false));
  const at = (o, x, y, z) => {
    o.position.set(x, y, z);
    return o;
  };
  const inst = (geo, mat, mats) => {
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((mm, k) => im.setMatrixAt(k, mm));
    im.castShadow = im.receiveShadow = true;
    return im;
  };
  const T = (x, y, z, rx = 0, ry = 0, rz = 0, s = one) => new THREE.Matrix4().compose(new V3(x, y, z), q.clone().setFromEuler(new THREE.Euler(rx, ry, rz)), s);
  const movers = [];

  // ------------------------------------------------------------------ NECK YAW: slewing ring on the ball joint
  {
    const g = new THREE.Group();
    const Y = -0.74;
    const Z = -0.12;
    const outer = gear(0.5, 64, 0.07);
    outer.rotateX(-Math.PI / 2);
    g.add(at(mesh(outer, M.gun), 0, Y - 0.035, Z));
    // inner race and the ball cage between
    g.add(at(mesh(lathe([[0.3, -0.05], [0.4, -0.05], [0.4, 0.05], [0.3, 0.05], [0.3, -0.05]]), M.ti), 0, Y + 0.02, Z));
    const balls = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      balls.push(T(Math.cos(a) * 0.43, Y + 0.02, Z + Math.sin(a) * 0.43));
    }
    g.add(inst(new THREE.IcosahedronGeometry(0.022, 1), M.ti, balls));
    // bolt circle on the inner race
    const bolts = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      bolts.push(T(Math.cos(a) * 0.35, Y + 0.08, Z + Math.sin(a) * 0.35));
    }
    g.add(inst(cylY(0.014, 0.025, 6), M.brass, bolts));
    // the yaw motor and its brass pinion on the outer teeth, at the back
    const pin = gear(0.09, 14, 0.07);
    pin.rotateX(-Math.PI / 2);
    const pinion = at(mesh(pin, M.brass), 0.42, Y - 0.035, Z - 0.42);
    g.add(pinion);
    g.add(at(mesh(cylY(0.075, 0.2), M.blue), 0.42, Y + 0.16, Z - 0.42));
    g.add(at(mesh(cylY(0.08, 0.04), M.orange), 0.42, Y + 0.28, Z - 0.42));
    g.add(at(mesh(cylY(0.083, 0.012), M.cyan), 0.42, Y + 0.1, Z - 0.42));
    add(g, new V3(0, -1.0, 0)).radial = false;
    movers.push((p, t) => {
      pinion.rotation.y = t * 0.8;
    });
  }

  // ------------------------------------------------------------------ SPINE and bulkheads
  {
    const g = new THREE.Group();
    const Z = -0.12;
    g.add(at(mesh(lathe([[0.001, -0.7], [0.075, -0.7], [0.075, 1.42], [0.001, 1.42]], 6), M.ti), 0, 0, Z));
    for (const y of [-0.55, -0.1, 0.35, 0.8, 1.2]) {
      g.add(at(mesh(lathe([[0.075, -0.035], [0.11, -0.035], [0.12, -0.02], [0.12, 0.02], [0.11, 0.035], [0.075, 0.035]], 6), M.gun), 0, y, Z));
    }
    add(g, new V3(0, 0, -0.2)).radial = false;
  }
  const bulkhead = (y, hw, zf, zb, lift) => {
    // a machined deck following the skull's section, lightened with a ring of holes, an LED strip on its front lip
    const g = new THREE.Group();
    const s = new THREE.Shape();
    const zc = (zf + zb) / 2;
    const rz = (zf - zb) / 2;
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const x = Math.cos(a) * hw;
      const z = zc + Math.sin(a) * rz;
      k ? s.lineTo(x, z) : s.moveTo(x, z);
    }
    // a ring frame, not a plate: the inside is cut away, four spokes carry the spine collar
    const inner = new THREE.Path();
    for (let k = N; k >= 0; k--) {
      const a = (k / N) * Math.PI * 2;
      const x = Math.cos(a) * (hw - 0.09);
      const z = zc + Math.sin(a) * (rz - 0.09);
      k === N ? inner.moveTo(x, z) : inner.lineTo(x, z);
    }
    s.holes.push(inner);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const r0 = 0.12;
      const ex = Math.cos(a) * (hw - 0.06);
      const ez = zc + Math.sin(a) * (rz - 0.06);
      const sx0 = Math.cos(a) * r0;
      const sz0 = -0.12 + Math.sin(a) * r0;
      const L = Math.hypot(ex - sx0, ez - sz0);
      const sp = at(mesh(chamferBox(L, 0.035, 0.05, 0.012), M.gun), (ex + sx0) / 2, y, (ez + sz0) / 2);
      sp.rotation.y = -Math.atan2(ez - sz0, ex - sx0);
      g.add(sp);
      // lightening slots: bolts at each spoke's ends
      g.add(at(mesh(cylY(0.016, 0.05, 6), M.brass), ex, y + 0.01, ez));
    }
    g.add(at(mesh(lathe([[0.08, -0.03], [0.15, -0.03], [0.16, -0.015], [0.16, 0.015], [0.15, 0.03], [0.08, 0.03]], 8), M.gun), 0, y, -0.12));
    const geo = new THREE.ExtrudeGeometry(s, {depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 12});
    geo.rotateX(Math.PI / 2); // shape (x, z) → floor, depth down
    geo.translate(0, 0.025, 0);
    g.add(at(mesh(clean(geo), M.gunDark), 0, y, 0));
    const led = at(mesh(boxG(0.3, 0.012, 0.012), M.cyan), 0, y - 0.005, zf + 0.012);
    g.add(led);
    for (const sx of [-1, 1]) g.add(at(mesh(boxG(0.05, 0.012, 0.012), M.amber), sx * 0.24, y - 0.005, zf + 0.008));
    add(g, new V3(0, lift, 0)).radial = false;
  };
  bulkhead(-0.5, 0.66, 0.66, -0.86, -0.75);
  bulkhead(1.0, 0.7, 0.78, -1.02, 0.75);

  // ------------------------------------------------------------------ SENSORS: optical bench behind eyes and camera
  {
    const g = new THREE.Group();
    const Y = 0.2;
    // the bench: a titanium beam with two saddles
    g.add(at(mesh(chamferBox(1.2, 0.06, 0.12, 0.025), M.ti), 0, Y - 0.12, 0.42));
    // eye barrel: housing, focus rings, glass; aimed forward, splayed a little outward like the eyes
    const barrel = (x, y, z, r, len, splay) => {
      const b = new THREE.Group();
      b.add(mesh(latheZ([[0.001, 0], [r * 0.9, 0], [r, 0.03], [r, len * 0.55], [r * 0.82, len * 0.6], [r * 0.82, len], [0.001, len]], 28), M.gun));
      const rings = [];
      for (const f of [0.18, 0.32, 0.46]) rings.push(T(0, 0, len * f, Math.PI / 2));
      b.add(inst(clean(new THREE.TorusGeometry(r * 1.02, 0.012, 6, 28)).rotateX(Math.PI / 2), M.brass, rings));
      const focus = mesh(latheZ([[r * 0.82, len * 0.68], [r * 0.95, len * 0.7], [r * 0.95, len * 0.86], [r * 0.82, len * 0.88]], 28), M.blue);
      b.add(focus);
      b.add(mesh(latheZ([[0.001, len + 0.005], [r * 0.74, len + 0.005], [r * 0.6, len + 0.02], [0.001, len + 0.025]], 28), M.glass));
      b.add(at(mesh(boxG(0.01, 0.04, 0.012), M.cyan), r * 0.9, 0, len * 0.4));
      b.position.set(x, y, z);
      b.rotation.y = splay;
      g.add(b);
      return focus;
    };
    const fL = barrel(0.4, Y, 0.3, 0.1, 0.42, 0.2);
    const fR = barrel(-0.4, Y, 0.3, 0.1, 0.42, -0.2);
    const fC = barrel(0, 0.62, 0.32, 0.075, 0.4, 0);
    // camera mount: a strut from the bench up to the camera barrel
    g.add(at(mesh(chamferBox(0.08, 0.36, 0.08, 0.02), M.gun), 0, 0.38, 0.45));
    // the sensor ECU on the bench, between the eyes
    g.add(at(mesh(chamferBox(0.24, 0.12, 0.16, 0.03), M.blue), 0, Y + 0.0, 0.4));
    g.add(at(mesh(boxG(0.16, 0.012, 0.012), M.amber), 0, Y + 0.02, 0.485));
    add(g, new V3(0, 0.15, 1.2)).radial = false;
    movers.push((p) => {
      const a = p.eyes * Math.PI * 0.8;
      fL.rotation.z = a;
      fR.rotation.z = -a;
      fC.rotation.z = a * 1.4;
    });
  }

  // ------------------------------------------------------------------ PROCESSOR: card cage in the back of the skull
  const CPU = new V3(0, 0.35, -0.82);
  {
    const g = new THREE.Group();
    const n = 9;
    const cards = [];
    const leds = [];
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * 0.07;
      cards.push(T(CPU.x + x, CPU.y, CPU.z));
      leds.push(T(CPU.x + x, CPU.y + 0.255, CPU.z + 0.12 - (k % 3) * 0.06));
    }
    g.add(inst(boxG(0.022, 0.48, 0.4), M.pcb, cards));
    g.add(inst(boxG(0.024, 0.012, 0.05), M.cyan, leds));
    // card edges: gold contacts along each card's bottom
    g.add(inst(boxG(0.026, 0.03, 0.34), M.brass, cards.map((m) => m.clone().multiply(T(0, -0.25, 0)))));
    // the cage: titanium rails top and bottom, end plates
    for (const y of [0.27, -0.27]) for (const z of [0.19, -0.19]) g.add(at(mesh(boxG(0.7, 0.03, 0.03), M.ti), CPU.x, CPU.y + y, CPU.z + z));
    for (const sx of [-1, 1]) g.add(at(mesh(chamferBox(0.03, 0.58, 0.44, 0.05), M.gun), CPU.x + sx * 0.35, CPU.y, CPU.z));
    // cold plate on the back, with copper fins
    g.add(at(mesh(boxG(0.64, 0.5, 0.025), M.copper), CPU.x, CPU.y, CPU.z - 0.215));
    const fins = [];
    for (let k = 0; k < 12; k++) fins.push(T(CPU.x, CPU.y - 0.22 + k * 0.04, CPU.z - 0.25));
    g.add(inst(boxG(0.6, 0.012, 0.06), M.copper, fins));
    add(g, new V3(0, 0.1, -1.2)).radial = false;
  }

  // ------------------------------------------------------------------ COOLING: heat pipes, radiators with fans, pump
  {
    for (const sx of [1, -1]) {
      const g = new THREE.Group();
      const R = new V3(sx * 0.68, -0.12, -0.42); // the radiator, under the ear pod
      // radiator: a stack of aluminium fins between two end plates
      const fins = [];
      for (let k = 0; k < 14; k++) fins.push(T(R.x, R.y - 0.2 + k * 0.03, R.z));
      g.add(inst(boxG(0.16, 0.01, 0.34), M.alu, fins));
      for (const dy of [-0.22, 0.22]) g.add(at(mesh(chamferBox(0.18, 0.025, 0.36, 0.04), M.gun), R.x, R.y + dy, R.z));
      // fan on its outer face
      const fan = new THREE.Group();
      fan.add(mesh(clean(new THREE.TorusGeometry(0.13, 0.015, 6, 28)), M.gun));
      fan.add(mesh(clean(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16)).rotateX(Math.PI / 2), M.orange));
      const blades = [];
      for (let k = 0; k < 7; k++) blades.push(T(0, 0, 0, 0.5, 0, (k / 7) * Math.PI * 2).multiply(T(0.075, 0, 0)));
      fan.add(inst(boxG(0.08, 0.03, 0.006), M.ti, blades));
      fan.position.set(R.x + sx * 0.1, R.y, R.z);
      fan.rotation.y = (sx * Math.PI) / 2;
      g.add(fan);
      // two heat pipes from the processor's cold plate round to the radiator
      for (const dy of [-0.08, 0.08]) {
        g.add(
          mesh(
            tube(
              [
                [sx * 0.3, CPU.y + dy, CPU.z - 0.23],
                [sx * 0.5, CPU.y + dy - 0.05, CPU.z - 0.1],
                [sx * 0.62, R.y + 0.12 + dy, R.z - 0.05],
                [R.x, R.y + dy, R.z],
              ],
              0.018,
            ),
            M.copper,
          ),
        );
      }
      add(g, new V3(sx * 0.9, -0.1, -0.3)).radial = false;
      movers.push((p, t) => {
        fan.rotation.z = t * 6 * sx;
      });
    }
    // coolant pump on the lower bulkhead
    const g = new THREE.Group();
    const P = new V3(0.3, -0.33, -0.55);
    g.add(at(mesh(lathe([[0.001, -0.1], [0.09, -0.1], [0.1, -0.08], [0.1, 0.06], [0.07, 0.1], [0.001, 0.1]], 28), M.gun), P.x, P.y, P.z));
    g.add(at(mesh(cylY(0.105, 0.03, 28), M.orange), P.x, P.y + 0.02, P.z));
    g.add(at(mesh(cylY(0.106, 0.008, 28), M.amber), P.x, P.y - 0.04, P.z));
    g.add(mesh(tube([[P.x, P.y + 0.1, P.z], [P.x, P.y + 0.3, P.z - 0.1], [0.3, CPU.y - 0.2, CPU.z - 0.2]], 0.022), M.copper));
    g.add(mesh(tube([[P.x + 0.1, P.y, P.z], [0.55, P.y + 0.05, -0.5], [0.66, -0.3, -0.45]], 0.022), M.copper));
    add(g, new V3(0.4, -0.6, -0.5)).radial = false;
  }

  // ------------------------------------------------------------------ POWER: capacitor cells round the spine
  {
    const g = new THREE.Group();
    const Y = -0.3;
    const cells = [];
    const bands = [];
    const caps = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 0.26;
      const z = -0.12 + Math.sin(a) * 0.26;
      cells.push(T(x, Y, z));
      bands.push(T(x, Y + 0.06, z));
      caps.push(T(x, Y + 0.17, z));
    }
    g.add(inst(lathe([[0.001, -0.15], [0.07, -0.15], [0.075, -0.13], [0.075, 0.13], [0.07, 0.15], [0.001, 0.15]], 24), M.blue, cells));
    g.add(inst(cylY(0.077, 0.02, 24), M.amber, bands));
    g.add(inst(lathe([[0.001, -0.02], [0.04, -0.02], [0.04, 0.01], [0.025, 0.03], [0.001, 0.03]], 16), M.brass, caps));
    // bus bar ring over the cells
    g.add(at(mesh(clean(new THREE.TorusGeometry(0.26, 0.012, 6, 40)).rotateX(Math.PI / 2), M.copper), 0, Y + 0.2, -0.12));
    add(g, new V3(0, -0.35, 0.6)).radial = false;
  }

  // ------------------------------------------------------------------ HORN DRIVE: worm wheel under the horn root
  {
    const g = new THREE.Group();
    const W = new V3(0, 1.3, 0.28);
    const wg = gear(0.17, 30, 0.06);
    wg.translate(0, 0, -0.03);
    wg.rotateY(Math.PI / 2); // axis along x
    const wheel = at(mesh(wg, M.brass), W.x, W.y, W.z);
    g.add(wheel);
    // the wheel's axle in two pillow blocks on the upper bulkhead
    g.add(at(mesh(cylY(0.022, 0.4, 14).rotateZ(Math.PI / 2), M.ti), W.x, W.y, W.z));
    for (const sx of [-1, 1]) g.add(at(mesh(chamferBox(0.06, 0.28, 0.1, 0.02), M.gun), sx * 0.17, W.y - 0.14, W.z));
    // the worm: a helix on a shaft along z, under the wheel, meshing with its bottom teeth
    const wormY = W.y - 0.17 - 0.035;
    const worm = new THREE.Group();
    const hel = [];
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2 * 6;
      hel.push([Math.cos(a) * 0.035, Math.sin(a) * 0.035, -0.15 + (k / 96) * 0.3]);
    }
    worm.add(mesh(tube(hel, 0.012, 160), M.ti));
    worm.add(mesh(cylY(0.03, 0.42, 14).rotateX(Math.PI / 2), M.gun));
    worm.position.set(0, wormY, W.z);
    g.add(worm);
    // the servo at the worm's back end
    g.add(at(mesh(cylY(0.065, 0.16, 24).rotateX(Math.PI / 2), M.blue), 0, wormY, W.z - 0.29));
    g.add(at(mesh(cylY(0.07, 0.03, 24).rotateX(Math.PI / 2), M.orange), 0, wormY, W.z - 0.385));
    g.add(at(mesh(boxG(0.012, 0.04, 0.1), M.cyan), 0.066, wormY, W.z - 0.29));
    // the link up from the wheel to the horn-root socket
    g.add(mesh(tube([[0, W.y + 0.1, W.z + 0.05], [0, W.y + 0.2, W.z + 0.18], [0, 1.52, 0.5]], 0.025), M.gun));
    add(g, new V3(0, 0.9, 0.3)).radial = false;
    movers.push((p) => {
      const a = (p.hornAngle * Math.PI) / 180;
      wheel.rotation.x = -a * 1.5;
      worm.rotation.z = a * 30;
    });
  }

  // ------------------------------------------------------------------ HARNESS: colour-coded cable runs
  {
    const g = new THREE.Group();
    const run = (pts) => {
      const offs = [[0, 0, 0, M.wireY], [0.026, 0, 0, M.wireB], [-0.026, 0, 0, M.rubber]];
      for (const [dx, dy, dz, mat] of offs) g.add(mesh(tube(pts.map(([x, y, z]) => [x + dx, y + dy, z + dz]), 0.012, 48), mat));
      // clips along the run
      const c = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)));
      for (const f of [0.3, 0.65]) {
        const p = c.getPoint(f);
        g.add(at(mesh(boxG(0.09, 0.03, 0.04), M.orange), p.x, p.y, p.z));
      }
    };
    run([[0.12, CPU.y + 0.2, CPU.z + 0.22], [0.2, 0.42, -0.2], [0.3, 0.3, 0.15], [0.4, 0.22, 0.28]]); // to the left eye
    run([[-0.12, CPU.y + 0.2, CPU.z + 0.22], [-0.2, 0.42, -0.2], [-0.3, 0.3, 0.15], [-0.4, 0.22, 0.28]]); // right eye
    run([[0, CPU.y + 0.27, CPU.z + 0.15], [0.05, 0.75, -0.3], [0.04, 0.7, 0.1], [0, 0.64, 0.3]]); // camera
    run([[0.15, CPU.y + 0.27, CPU.z], [0.18, 1.05, -0.4], [0.1, 1.15, 0.0], [0.06, 1.13, 0.0]]); // horn servo
    run([[-0.15, CPU.y - 0.27, CPU.z + 0.1], [-0.25, -0.1, -0.55], [-0.2, -0.25, -0.3], [-0.18, -0.2, -0.3]]); // power
    add(g, new V3(0, 0.2, -0.5)).radial = false;
  }

  let t = 0;
  return (p, time = t) => {
    t = time;
    for (const f of movers) f(p, time);
  };
}
