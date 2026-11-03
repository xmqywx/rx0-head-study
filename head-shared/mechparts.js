// Machine parts for the inner frame, built from code so the head's interior reads as a mechanism (exploded view:
// frame members, actuators, gears, bolted brackets, cable runs), not stacked blocks. Every builder returns a
// BufferGeometry in a local frame: x across, y up, z out of the surface it sits on. place() moves it onto the skull.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;

const box = (w, h, d, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const cyl = (r0, r1, h, seg = 12, rotX = false, x = 0, y = 0, z = 0) => {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (rotX) g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
};
const clean = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
};
const merge = (list) => mergeGeometries(list.map(clean));

/** an I-section frame rib, length L along y, flange width w, depth d */
export function rib(L, w = 0.09, d = 0.07) {
  const s = new THREE.Shape();
  const t = 0.018;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, t);
  s.lineTo(t / 2, t);
  s.lineTo(t / 2, d - t);
  s.lineTo(w / 2, d - t);
  s.lineTo(w / 2, d);
  s.lineTo(-w / 2, d);
  s.lineTo(-w / 2, d - t);
  s.lineTo(-t / 2, d - t);
  s.lineTo(-t / 2, t);
  s.lineTo(-w / 2, t);
  const g = new THREE.ExtrudeGeometry(s, {depth: L, bevelEnabled: false});
  g.rotateX(-Math.PI / 2); // extrude along +y, profile in x/z
  g.translate(0, -L / 2, 0);
  // lightening holes are suggested by bolt bosses along the web
  const parts = [g];
  for (let k = -2; k <= 2; k++) parts.push(cyl(0.016, 0.016, 0.02, 8, true, 0, (k * L) / 6, d + 0.008));
  return merge(parts);
}

/** a hydraulic actuator between two clevises, length L along y */
export function piston(L, r = 0.035) {
  return merge([
    cyl(r, r, L * 0.55, 14, false, 0, -L * 0.2, r + 0.01),
    cyl(r * 1.15, r * 1.15, 0.03, 14, false, 0, -L * 0.2 + L * 0.275, r + 0.01),
    cyl(r * 0.45, r * 0.45, L * 0.5, 10, false, 0, L * 0.22, r + 0.01),
    box(r * 2.2, 0.06, r * 2.2, 0, -L / 2 + 0.03, r + 0.01),
    box(r * 1.6, 0.05, r * 1.6, 0, L / 2 - 0.025, r + 0.01),
    cyl(0.012, 0.012, r * 3, 8, true, 0, -L / 2 + 0.03, r + 0.01).rotateY(Math.PI / 2),
  ]);
}

/** a spur gear of radius r, n teeth, face width t, lying in the x/y plane */
export function gear(r = 0.1, n = 14, t = 0.04) {
  const s = new THREE.Shape();
  const ro = r;
  const ri = r * 0.84;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 0.3) / n) * Math.PI * 2;
    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    const a3 = ((i + 0.8) / n) * Math.PI * 2;
    const P = (rr, a) => [rr * Math.cos(a), rr * Math.sin(a)];
    if (i === 0) s.moveTo(...P(ri, a0));
    s.lineTo(...P(ro, a1));
    s.lineTo(...P(ro, a2));
    s.lineTo(...P(ri, a3));
    s.lineTo(...P(ri, ((i + 1) / n) * Math.PI * 2));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: false, curveSegments: 6});
  return merge([g, cyl(r * 0.22, r * 0.22, t * 2.2, 10, true, 0, 0, t / 2)]);
}

/** a bolted bracket plate with a stiffening flange and bolt heads */
export function bracket(w = 0.22, h = 0.16, t = 0.03) {
  const parts = [box(w, h, t, 0, 0, t / 2), box(w, 0.025, 0.06, 0, -h / 2 + 0.0125, 0.03 + t / 2)];
  for (const [x, y] of [[-w / 2 + 0.03, h / 2 - 0.03], [w / 2 - 0.03, h / 2 - 0.03], [-w / 2 + 0.03, -h / 2 + 0.05], [w / 2 - 0.03, -h / 2 + 0.05]])
    parts.push(cyl(0.014, 0.014, 0.018, 6, true, x, y, t + 0.009));
  return merge(parts);
}

/** a servo / motor block with a shaft and cooling fins */
export function motor(w = 0.16, h = 0.12, d = 0.1) {
  const parts = [box(w, h, d, 0, 0, d / 2), cyl(0.03, 0.03, 0.06, 12, true, w * 0.25, 0, d + 0.03)];
  for (let k = 0; k < 4; k++) parts.push(box(0.012, h * 0.9, 0.03, -w / 2 + 0.02 + k * 0.025, 0, d + 0.015));
  return merge(parts);
}

/** a bundle of three cables following a curve of points (already in local space) */
export function cables(points, r = 0.012) {
  const parts = [];
  const curve = new THREE.CatmullRomCurve3(points);
  for (const off of [-1, 0, 1]) {
    const pts = curve.getPoints(24).map((p) => p.clone().add(new V3(off * r * 2.4, 0, off === 0 ? r * 1.5 : 0)));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false));
  }
  return merge(parts);
}

/** move a local-frame part onto a surface point: origin p, outward normal n, 'up' hint (tangent kept in the plane) */
export function place(geo0, p, n, up = new V3(0, 1, 0), spin = 0) {
  const geo = clean(geo0); // position + normal only, non-indexed: every placed part merges with every other
  const z = n.clone().normalize();
  const y = up.clone().addScaledVector(z, -up.dot(z)).normalize();
  const x = new V3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  if (spin) m.multiply(new THREE.Matrix4().makeRotationZ(spin));
  m.setPosition(p);
  return geo.clone().applyMatrix4(m);
}

// ---------------------------------------------------------------- articulated joints (exploded-view crops)
const extrude = (shape, depth) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 10});
  g.translate(0, 0, -depth / 2);
  return g;
};
/** a dog-bone link plate between two pin centres (0,0) and (0,L), width w, with pin holes */
export function linkPlate(L, w = 0.07, t = 0.025) {
  const s = new THREE.Shape();
  s.absarc(0, 0, w / 2, Math.PI, 0, false);
  s.lineTo(w / 2, L);
  s.absarc(0, L, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  for (const y of [0, L]) {
    const h = new THREE.Path();
    h.absarc(0, y, w * 0.22, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return extrude(s, t);
}
/** a clevis: a base block with two lugs and a pin across them; the pin axis is x, at height h */
export function clevis(w = 0.14, h = 0.12, gap = 0.05) {
  const parts = [box(w, 0.04, 0.1, 0, 0.02, 0)];
  const lug = new THREE.Shape();
  lug.moveTo(-0.045, 0);
  lug.lineTo(0.045, 0);
  lug.lineTo(0.045, h);
  lug.absarc(0, h, 0.045, 0, Math.PI, false);
  lug.lineTo(-0.045, 0);
  const lh = new THREE.Path();
  lh.absarc(0, h, 0.018, 0, Math.PI * 2, true);
  lug.holes.push(lh);
  const t = (w - gap) / 2;
  for (const sx of [1, -1]) {
    const g = extrude(lug, t);
    g.rotateY(Math.PI / 2);
    g.translate(sx * (gap / 2 + t / 2), 0.04, 0);
    parts.push(g);
  }
  parts.push(cyl(0.018, 0.018, w + 0.03, 10, false, 0, 0.04 + h, 0).rotateZ(Math.PI / 2).translate(0, 0.04 + h, 0));
  return merge(parts.map((g) => g));
}
/** a bearing joint: housing ring, inner race, axle stub; axis along z */
export function bearing(r = 0.09, t = 0.06) {
  return merge([
    new THREE.TorusGeometry(r, r * 0.22, 8, 20),
    cyl(r * 0.62, r * 0.62, t, 18, true, 0, 0, 0),
    cyl(r * 0.3, r * 0.3, t * 1.8, 14, true, 0, 0, 0),
    cyl(r * 0.36, r * 0.36, 0.012, 14, true, 0, 0, t * 0.9 + 0.006),
  ]);
}
/** a socket boss: stepped block with a square socket on top (the horn-root plug drops into it) */
export function socket(w = 0.2) {
  return merge([box(w * 1.5, 0.05, w * 1.3, 0, 0.025, 0), box(w, 0.12, w * 0.9, 0, 0.11, 0), box(w * 0.55, 0.03, w * 0.5, 0, 0.185, 0)]);
}
/** a two-link arm: clevis at the base, a link up, an elbow bearing, a link across to a second clevis */
export function linkArm(L1 = 0.32, L2 = 0.26, ang = 0.9) {
  const a = linkPlate(L1);
  const a2 = linkPlate(L1);
  a.translate(0, 0, 0.035);
  a2.translate(0, 0, -0.035);
  const b = linkPlate(L2, 0.06);
  b.rotateZ(-ang);
  b.translate(0, L1, 0);
  const elbow = cyl(0.03, 0.03, 0.12, 12, true, 0, L1, 0);
  const pin0 = cyl(0.022, 0.022, 0.12, 12, true, 0, 0, 0);
  const tip = new THREE.Vector3(Math.sin(ang) * L2, L1 + Math.cos(ang) * L2, 0);
  const pin1 = cyl(0.022, 0.022, 0.1, 12, true, tip.x, tip.y, 0);
  return merge([a, a2, b, elbow, pin0, pin1]);
}
