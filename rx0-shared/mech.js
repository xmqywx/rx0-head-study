// RX-0 study model, the geometry, built from code at 1/10 scale (scene metres; y up, the machine faces +z, its left is
// +x). A skeleton of joint groups (pelvis, waist, chest, neck, head; per side hip, thigh, knee, shin, ankle, foot;
// shoulder, upper arm, elbow, forearm, hand) carries three layers:
//   frame          graphite inner frame, always there
//   psycho-frame   red emissive strips laid on the frame under every armor seam; they glow as the armor opens
//   armor          white plates, each registered with its stage, its open offset and rotation, and its sub-assembly
// plus the horn (two gold half-blades that split into the V-fin), the visor and the face mask over the Gundam face,
// the shield on the left forearm (four petals that part over a psycho-frame cross) and the beam magnum in the right
// hand. update(st) poses all of it from the transformation d (kin.js) and the display state.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {beatRate, GROW, SEG, stagesAt} from './kin.js';

const V3 = THREE.Vector3;
export const COL = {white: '#f3f3f1', frame: '#3a3f46', dark: '#1d2024', steel: '#9aa2a9', pf: '#ff2a3c', gold: '#e2b84a', eye: '#4dff9a', visor: '#123a2c', yellow: '#f2c230'};
export const SUBS = ['head', 'torso', 'arms', 'legs', 'shield'];
const TAU = Math.PI * 2;

const RB = (w, h, d, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
// a beveled plate from a 2D outline (x, y), extruded along z and centred
const plateGeo = (pts, depth, bevel = 0.006) => {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, {depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4});
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
};

// taper a geometry along y: x and z scale linearly from (bx, bz) at its bottom to (tx, tz) at its top
const taper = (g, tx, bx, tz = tx, bz = bx) => {
  g.computeBoundingBox();
  const {min, max} = g.boundingBox;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getY(i) - min.y) / (max.y - min.y || 1);
    p.setX(i, p.getX(i) * (bx + (tx - bx) * u));
    p.setZ(i, p.getZ(i) * (bz + (tz - bz) * u));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
};

export function buildMech() {
  const root = new THREE.Group();
  // materials per sub-assembly, so a sub-assembly fades as one
  const matCache = {};
  const all = [];
  const KIND = {
    white: () => new THREE.MeshStandardMaterial({color: COL.white, roughness: 0.38, metalness: 0.05, envMapIntensity: 0.55}),
    frame: () => new THREE.MeshStandardMaterial({color: COL.frame, roughness: 0.45, metalness: 0.55, envMapIntensity: 0.5}),
    dark: () => new THREE.MeshStandardMaterial({color: COL.dark, roughness: 0.4, metalness: 0.3}),
    steel: () => new THREE.MeshStandardMaterial({color: COL.steel, roughness: 0.32, metalness: 0.85, envMapIntensity: 0.6}),
    pf: () => new THREE.MeshStandardMaterial({color: '#5a0a12', emissive: new THREE.Color(COL.pf), emissiveIntensity: 0.1, roughness: 0.3}),
    gold: () => new THREE.MeshStandardMaterial({color: COL.gold, roughness: 0.3, metalness: 0.75, envMapIntensity: 0.7}),
    yellow: () => new THREE.MeshStandardMaterial({color: COL.yellow, roughness: 0.45}),
    eye: () => new THREE.MeshStandardMaterial({color: '#0b2a18', emissive: new THREE.Color(COL.eye), emissiveIntensity: 0, roughness: 0.2}),
    visor: () => new THREE.MeshStandardMaterial({color: COL.visor, roughness: 0.1, metalness: 0.4, emissive: new THREE.Color('#1a7a50'), emissiveIntensity: 0.25}),
  };
  const mat = (sub, kind) => {
    const k = `${sub}:${kind}`;
    if (!matCache[k]) {
      const m = KIND[kind]();
      m.userData = {sub, kind, base: 1};
      matCache[k] = m;
      all.push(m);
    }
    return matCache[k];
  };
  const mesh = (parent, geo, m, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...pos);
    o.rotation.set(...rot);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const G = (parent, pos = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    return g;
  };
  // armor registry: base pose, the open offset and rotation at stage = 1, and an explode direction
  const armor = [];
  const plate = (parent, sub, stg, geo, pos, rot, open = [0, 0, 0], orot = [0, 0, 0], kind = 'white') => {
    const o = mesh(parent, geo, mat(sub, kind), pos, rot);
    const ov = new V3(...open);
    armor.push({o, sub, stg, base: o.position.clone(), baseRot: o.rotation.clone(), open: ov, orot: new V3(...orot), dir: ov.lengthSq() > 0 ? ov.clone().normalize() : o.position.clone().normalize()});
    return o;
  };
  const pf = [];
  const strip = (parent, sub, stg, w, h, d, pos, rot = [0, 0, 0]) => {
    const o = mesh(parent, RB(w, h, d, 0.003), mat(sub, 'pf'), pos, rot);
    pf.push({o, stg, sub});
    return o;
  };
  const frame = (parent, sub, geo, pos, rot, kind = 'frame') => mesh(parent, geo, mat(sub, kind), pos, rot);

  // ------------------------------------------------------------ skeleton
  const pelvis = G(root);
  const waist = G(pelvis, [0, 0.07, 0]);
  const chest = G(waist);
  const neck = G(chest, [0, SEG.chest, 0]);
  const head = G(neck);
  const sides = [-1, 1].map((sx) => {
    const hip = G(pelvis, [sx * 0.11, -0.03, 0]);
    const thigh = G(hip);
    const knee = G(thigh);
    const shin = G(knee);
    const ankle = G(shin);
    const foot = G(ankle);
    const shoulder = G(chest, [sx * 0.2, 0.27, -0.005]);
    const upper = G(shoulder, [sx * 0.07, -0.02, 0]);
    const elbow = G(upper, [0, -0.25, 0]);
    const fore = G(elbow);
    const hand = G(fore, [0, -0.25, 0]);
    return {sx, hip, thigh, knee, shin, ankle, foot, shoulder, upper, elbow, fore, hand};
  });

  // ------------------------------------------------------------ pelvis and skirts
  frame(pelvis, 'torso', RB(0.2, 0.12, 0.14, 0.015), [0, 0.02, 0]);
  plate(pelvis, 'torso', 'torso', plateGeo([[-0.035, 0.05], [0.035, 0.05], [0.03, -0.04], [0, -0.06], [-0.03, -0.04]], 0.04), [0, 0.0, 0.065], [0, 0, 0], [0, -0.005, 0.015]);
  mesh(pelvis, RB(0.03, 0.03, 0.01), mat('torso', 'dark'), [0, 0.005, 0.09]);
  for (const sx of [-1, 1]) {
    plate(pelvis, 'torso', 'torso', plateGeo([[-0.045, 0.06], [0.045, 0.06], [0.05, -0.06], [-0.035, -0.075]], 0.022), [sx * 0.072, -0.015, 0.082], [-0.12, 0, sx * 0.04], [sx * 0.022, 0.012, 0.03], [-0.25, 0, sx * 0.12]);
    strip(pelvis, 'torso', 'torso', 0.05, 0.09, 0.008, [sx * 0.072, -0.01, 0.066]);
    plate(pelvis, 'torso', 'torso', RB(0.026, 0.15, 0.12, 0.01), [sx * 0.135, -0.005, 0], [0, 0, sx * 0.06], [sx * 0.035, 0.012, 0], [0, 0, sx * 0.15]);
    strip(pelvis, 'torso', 'torso', 0.008, 0.11, 0.08, [sx * 0.118, -0.005, 0]);
  }
  plate(pelvis, 'torso', 'torso', RB(0.17, 0.12, 0.024, 0.01), [0, -0.01, -0.085], [0.12, 0, 0], [0, 0.012, -0.035], [0.25, 0, 0]);

  // ------------------------------------------------------------ waist (abdomen; grows with the torso stage)
  const abdomen = frame(waist, 'torso', RB(0.13, SEG.waist, 0.1, 0.012), [0, SEG.waist / 2, 0]);
  const abPlates = [];
  for (let k = 0; k < 3; k++) abPlates.push(plate(waist, 'torso', 'torso', RB(0.1 - k * 0.006, 0.035, 0.03, 0.008), [0, 0.025 + k * 0.042, 0.05], [0, 0, 0], [0, 0, 0.008]));
  for (const sx of [-1, 1]) strip(waist, 'torso', 'torso', 0.008, SEG.waist * 0.8, 0.07, [sx * 0.066, SEG.waist / 2, 0]);

  // ------------------------------------------------------------ chest, collar, backpack
  frame(chest, 'torso', taper(RB(0.3, 0.3, 0.2, 0.02), 1.12, 0.8, 1.05, 0.9), [0, 0.16, -0.01]);
  for (const sx of [-1, 1]) {
    const cp = plate(chest, 'torso', 'torso', plateGeo([[-0.075, 0.08], [0.07, 0.09], [0.08, -0.03], [0.02, -0.085], [-0.07, -0.07]].map(([x, y]) => [x * sx, y]), 0.05), [sx * 0.078, 0.2, 0.095], [0.05, sx * 0.1, 0], [sx * 0.032, 0.028, 0.022], [0, sx * 0.12, -sx * 0.12]);
    // the chest vents: dark grilles with yellow surrounds
    mesh(cp, RB(0.055, 0.034, 0.012), mat('torso', 'yellow'), [sx * 0.012, -0.02, 0.03]);
    for (let k = 0; k < 3; k++) mesh(cp, RB(0.046, 0.006, 0.012), mat('torso', 'dark'), [sx * 0.012, -0.03 + k * 0.01, 0.034]);
    strip(chest, 'torso', 'torso', 0.12, 0.13, 0.01, [sx * 0.078, 0.2, 0.072]);
    plate(chest, 'torso', 'torso', RB(0.12, 0.09, 0.19, 0.014), [sx * 0.1, 0.06, -0.005], [0, 0, 0], [sx * 0.03, -0.005, 0]);
    strip(chest, 'torso', 'torso', 0.01, 0.07, 0.16, [sx * 0.155, 0.08, -0.005]);
    // beam saber hilts on the backpack
    const saber = mesh(chest, new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12), mat('torso', 'steel'), [sx * 0.07, 0.36, -0.16], [-0.5, 0, sx * 0.15]);
    mesh(saber, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), mat('torso', 'pf'), [0, 0.045, 0]);
  }
  plate(chest, 'torso', 'torso', RB(0.24, 0.05, 0.19, 0.015), [0, 0.32, 0], [0, 0, 0], [0, 0.03, 0]);
  strip(chest, 'torso', 'torso', 0.2, 0.012, 0.16, [0, 0.3, 0]);
  frame(chest, 'torso', RB(0.2, 0.24, 0.08, 0.015), [0, 0.18, -0.14]);
  plate(chest, 'torso', 'torso', plateGeo([[-0.11, 0.1], [0.11, 0.1], [0.1, -0.1], [-0.1, -0.1]], 0.03), [0, 0.19, -0.19], [0, 0, 0], [0, 0.035, -0.045], [0.2, 0, 0]);
  strip(chest, 'torso', 'torso', 0.16, 0.16, 0.01, [0, 0.19, -0.178]);
  for (const sx of [-1, 1]) mesh(chest, new THREE.CylinderGeometry(0.028, 0.036, 0.06, 16), mat('torso', 'dark'), [sx * 0.065, 0.05, -0.2], [0, 0, 0]);

  // ------------------------------------------------------------ neck and head
  const neckCore = frame(neck, 'head', new THREE.CylinderGeometry(0.035, 0.045, SEG.neck, 16), [0, SEG.neck / 2, 0]);
  strip(neck, 'head', 'head', 0.06, SEG.neck * 0.7, 0.06, [0, SEG.neck / 2, 0.012]);
  frame(head, 'head', RB(0.1, 0.11, 0.11, 0.015), [0, 0.06, 0]);
  plate(head, 'head', 'head', RB(0.122, 0.06, 0.13, 0.02), [0, 0.118, -0.008], [0, 0, 0], [0, 0.012, -0.008]);
  for (const sx of [-1, 1]) {
    const side = plate(head, 'head', 'head', RB(0.026, 0.085, 0.11, 0.01), [sx * 0.062, 0.068, 0], [0, 0, 0], [sx * 0.014, 0.004, 0]);
    mesh(side, new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12), mat('head', 'dark'), [sx * 0.013, 0.01, 0.03], [0, 0, Math.PI / 2]);
    strip(head, 'head', 'head', 0.006, 0.07, 0.09, [sx * 0.05, 0.068, 0]);
    // the Gundam face, behind the mask: eyes and cheeks
    mesh(head, plateGeo([[-0.016, 0.006], [0.018, 0.009], [0.014, -0.006], [-0.016, -0.005]].map(([x, y]) => [x * sx, y]), 0.004, 0.001), mat('head', 'eye'), [sx * 0.022, 0.078, 0.058]);
  }
  mesh(head, RB(0.07, 0.05, 0.02, 0.006), mat('head', 'white'), [0, 0.06, 0.052]);
  for (let k = 0; k < 3; k++) mesh(head, RB(0.026, 0.004, 0.008), mat('head', 'dark'), [0, 0.042 + k * 0.007, 0.064]);
  mesh(head, RB(0.02, 0.014, 0.01, 0.003), mat('head', 'pf'), [0, 0.03, 0.064]);
  // the visor (Unicorn Mode) and the two halves of the face mask that cover the face
  const visor = plate(head, 'head', 'head', RB(0.096, 0.03, 0.016, 0.007), [0, 0.08, 0.066], [0, 0, 0], [0, 0.04, -0.03], [0.4, 0, 0], 'visor');
  const masks = [-1, 1].map((sx) => plate(head, 'head', 'head', plateGeo([[0, 0.02], [0.045, 0.018], [0.04, -0.02], [0, -0.032]].map(([x, y]) => [x * sx, y]), 0.014, 0.003), [0, 0.048, 0.07], [0, 0, 0], [sx * 0.035, -0.006, -0.03], [0, sx * 0.9, 0]));
  // the main camera and the horn: two gold half-blades that split into the V-fin
  mesh(head, RB(0.022, 0.016, 0.012, 0.004), mat('head', 'pf'), [0, 0.104, 0.066]);
  const hornBase = G(head, [0, 0.108, 0.058]);
  const horns = [-1, 1].map((sx) => {
    const piv = G(hornBase);
    const blade = mesh(piv, plateGeo([[0, -0.004], [sx * 0.014, 0.0], [sx * 0.003, 0.2], [0, 0.205]], 0.008, 0.002), mat('head', 'gold'), [0, 0, 0], [-0.22, 0, 0]);
    return {piv, blade, sx};
  });

  // ------------------------------------------------------------ arms
  for (const S of sides) {
    const {sx} = S;
    frame(S.shoulder, 'arms', new THREE.SphereGeometry(0.05, 20, 14), [sx * 0.03, 0, 0]);
    strip(S.shoulder, 'arms', 'shoulder', 0.012, 0.09, 0.12, [sx * 0.05, 0.02, 0]);
    const sh = plate(S.shoulder, 'arms', 'shoulder', taper(RB(0.13, 0.13, 0.18, 0.02), 0.85, 1.12, 0.9, 1.1), [sx * 0.085, 0.02, 0], [0, 0, sx * -0.08], [sx * 0.045, 0.06, 0], [0, 0, sx * -0.38]);
    for (let k = 0; k < 2; k++) mesh(sh, RB(0.135, 0.008, 0.09), mat('arms', 'frame'), [0, -0.025 + k * 0.04, 0]);
    plate(S.shoulder, 'arms', 'shoulder', RB(0.1, 0.03, 0.14, 0.01), [sx * 0.085, 0.1, 0], [0, 0, sx * -0.08], [sx * 0.04, 0.09, 0], [0, 0, sx * -0.45]);
    // upper arm
    frame(S.upper, 'arms', new THREE.CylinderGeometry(0.035, 0.04, 0.24, 16), [0, -0.12, 0]);
    plate(S.upper, 'arms', 'arms', RB(0.09, 0.12, 0.095, 0.014), [0, -0.1, 0], [0, 0, 0], [sx * 0.02, 0, 0]);
    strip(S.upper, 'arms', 'arms', 0.008, 0.1, 0.07, [sx * 0.044, -0.1, 0]);
    frame(S.elbow, 'arms', new THREE.SphereGeometry(0.04, 16, 12), [0, 0, 0]);
    // forearm: outer and inner halves part over the frame
    frame(S.fore, 'arms', new THREE.CylinderGeometry(0.036, 0.03, 0.23, 16), [0, -0.12, 0]);
    plate(S.fore, 'arms', 'arms', taper(RB(0.05, 0.21, 0.11, 0.014), 0.9, 1.1, 0.9, 1.15), [sx * 0.03, -0.12, 0], [0, 0, 0], [sx * 0.035, 0, 0]);
    plate(S.fore, 'arms', 'arms', RB(0.045, 0.2, 0.1, 0.014), [-sx * 0.026, -0.12, 0], [0, 0, 0], [-sx * 0.03, 0, 0]);
    plate(S.fore, 'arms', 'arms', RB(0.07, 0.05, 0.03, 0.01), [0, -0.05, 0.055], [0, 0, 0], [0, 0.01, 0.025]);
    strip(S.fore, 'arms', 'arms', 0.012, 0.18, 0.09, [sx * 0.003, -0.12, 0]);
    // the forearm beam saber
    mesh(S.fore, new THREE.CylinderGeometry(0.01, 0.01, 0.07, 10), mat('arms', 'steel'), [sx * 0.058, -0.1, -0.02]);
    // hand: a fist
    frame(S.hand, 'arms', RB(0.062, 0.075, 0.075, 0.012), [0, -0.035, 0.005]);
    for (let k = 0; k < 4; k++) mesh(S.hand, RB(0.014, 0.03, 0.064, 0.005), mat('arms', 'frame'), [sx * (-0.022 + k * 0.015) * -1, -0.065, 0.02]);
  }

  // ------------------------------------------------------------ the shield (left forearm) and the beam magnum (right hand)
  const L = sides[1];
  const R = sides[0];
  const shield = G(L.fore, [0.075, -0.12, 0.01]);
  shield.rotation.set(0, Math.PI / 2, 0);
  frame(shield, 'shield', plateGeo([[-0.06, 0.2], [0.06, 0.2], [0.075, 0.03], [0, -0.21], [-0.075, 0.03]], 0.015), [0, 0, -0.008]);
  strip(shield, 'shield', 'arms', 0.02, 0.32, 0.012, [0, 0, 0.004]);
  strip(shield, 'shield', 'arms', 0.12, 0.02, 0.012, [0, 0.05, 0.004]);
  const petal = (pts, open) => plate(shield, 'shield', 'arms', plateGeo(pts, 0.016, 0.004), [0, 0, 0.012], [0, 0, 0], open);
  petal([[-0.058, 0.195], [-0.012, 0.195], [-0.012, 0.062], [-0.07, 0.062]], [-0.03, 0.03, 0.004]);
  petal([[0.012, 0.195], [0.058, 0.195], [0.07, 0.062], [0.012, 0.062]], [0.03, 0.03, 0.004]);
  petal([[-0.07, 0.038], [-0.012, 0.038], [-0.012, -0.17], [-0.06, -0.04]], [-0.035, -0.02, 0.004]);
  petal([[0.012, 0.038], [0.07, 0.038], [0.06, -0.04], [0.012, -0.17]], [0.035, -0.02, 0.004]);
  const magnum = G(R.hand, [0, -0.055, 0.0]);
  magnum.rotation.x = Math.PI / 2;
  frame(magnum, 'shield', RB(0.05, 0.085, 0.2, 0.01), [0, 0.0, 0.07], [0, 0, 0], 'white');
  frame(magnum, 'shield', RB(0.036, 0.036, 0.36, 0.008), [0, 0.02, 0.32], [0, 0, 0], 'white');
  frame(magnum, 'shield', RB(0.03, 0.05, 0.12, 0.006), [0, 0.065, 0.12], [0, 0, 0], 'frame');
  frame(magnum, 'shield', new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12), [0, 0.02, 0.52], [Math.PI / 2, 0, 0], 'dark');
  frame(magnum, 'shield', RB(0.034, 0.1, 0.05, 0.006), [0, -0.07, 0.1], [0.2, 0, 0], 'frame');
  frame(magnum, 'shield', RB(0.038, 0.06, 0.08, 0.006), [0, -0.05, -0.04], [0, 0, 0], 'dark');

  // ------------------------------------------------------------ legs
  for (const S of sides) {
    const {sx} = S;
    frame(S.hip, 'legs', new THREE.SphereGeometry(0.05, 16, 12), [0, 0, 0]);
    // thigh (the core is built at the Unicorn length and stretched with the legs stage)
    S.thighCore = frame(S.thigh, 'legs', taper(RB(0.1, SEG.thigh, 0.11, 0.015), 1.1, 0.8), [0, -SEG.thigh / 2, 0]);
    S.thighArmor = G(S.thigh);
    plate(S.thighArmor, 'legs', 'legs', taper(RB(0.12, 0.36, 0.05, 0.02), 1.1, 0.78, 1, 1), [0, -0.22, 0.058], [0, 0, 0], [0, 0.015, 0.03]);
    plate(S.thighArmor, 'legs', 'legs', RB(0.04, 0.38, 0.13, 0.016), [sx * 0.058, -0.23, 0], [0, 0, 0], [sx * 0.03, 0, 0]);
    plate(S.thighArmor, 'legs', 'legs', taper(RB(0.12, 0.34, 0.045, 0.018), 1.1, 0.8, 1, 1), [0, -0.24, -0.058], [0, 0, 0], [0, -0.02, -0.03]);
    strip(S.thigh, 'legs', 'legs', 0.07, 0.3, 0.01, [0, -0.22, 0.04]);
    strip(S.thigh, 'legs', 'legs', 0.01, 0.26, 0.09, [sx * 0.04, -0.22, 0]);
    // knee
    frame(S.knee, 'legs', new THREE.SphereGeometry(0.048, 16, 12), [0, 0, 0]);
    plate(S.knee, 'legs', 'legs', plateGeo([[-0.055, 0.04], [0.055, 0.04], [0.06, -0.05], [0, -0.09], [-0.06, -0.05]], 0.045), [0, 0.0, 0.07], [-0.1, 0, 0], [0, 0.035, 0.04], [-0.4, 0, 0]);
    strip(S.knee, 'legs', 'legs', 0.07, 0.06, 0.01, [0, -0.01, 0.05]);
    // shin
    S.shinCore = frame(S.shin, 'legs', taper(RB(0.1, SEG.shin, 0.11, 0.015), 0.85, 1.2), [0, -SEG.shin / 2, 0]);
    S.shinUpper = G(S.shin);
    S.shinLower = G(S.shin);
    plate(S.shinUpper, 'legs', 'legs', taper(RB(0.12, 0.2, 0.05, 0.015), 0.85, 1.05, 1, 1), [0, -0.14, 0.07], [0.05, 0, 0], [0, 0.02, 0.04]);
    plate(S.shinLower, 'legs', 'legs', taper(RB(0.13, 0.22, 0.055, 0.015), 1.05, 1.3, 1, 1.2), [0, -0.37, 0.075], [-0.04, 0, 0], [0, -0.01, 0.045]);
    for (const k of [-1, 1]) {
      plate(S.shinUpper, 'legs', 'legs', RB(0.03, 0.22, 0.13, 0.012), [k * 0.075, -0.16, 0], [0, 0, 0], [k * 0.035, 0, 0]);
      plate(S.shinLower, 'legs', 'legs', taper(RB(0.032, 0.2, 0.14, 0.012), 1, 1, 1.05, 1.25), [k * 0.082, -0.38, 0], [0, 0, 0], [k * 0.04, 0, 0]);
      strip(S.shin, 'legs', 'legs', 0.008, 0.36, 0.1, [k * 0.058, -0.27, 0]);
    }
    plate(S.shinUpper, 'legs', 'legs', taper(RB(0.12, 0.26, 0.05, 0.016), 0.85, 1.15, 1, 1.4), [0, -0.2, -0.072], [0, 0, 0], [0, 0.01, -0.045]);
    plate(S.shinLower, 'legs', 'legs', taper(RB(0.12, 0.16, 0.05, 0.016), 1.2, 1.3, 1.4, 1.2), [0, -0.42, -0.08], [0, 0, 0], [0, -0.01, -0.045]);
    strip(S.shin, 'legs', 'legs', 0.08, 0.4, 0.01, [0, -0.27, 0.05]);
    strip(S.shin, 'legs', 'legs', 0.08, 0.34, 0.01, [0, -0.27, -0.052]);
    // ankle and foot (the sole's bottom at y = -SEG.foot)
    frame(S.ankle, 'legs', new THREE.SphereGeometry(0.04, 14, 10), [0, 0, 0]);
    plate(S.foot, 'legs', 'legs', plateGeo([[-0.065, -0.07], [0.065, -0.07], [0.05, 0.05], [0, 0.085], [-0.05, 0.05]], 0.055, 0.012), [0, -0.05, 0.1], [Math.PI / 2 + 0.08, 0, 0], [0, 0, 0.02]);
    plate(S.foot, 'legs', 'legs', RB(0.12, 0.06, 0.1, 0.014), [0, -0.05, -0.03], [0, 0, 0], [0, 0, -0.025]);
    plate(S.foot, 'legs', 'legs', RB(0.1, 0.05, 0.08, 0.012), [0, -0.015, 0.0], [0, 0, 0], [0, 0.01, 0]);
    frame(S.foot, 'legs', RB(0.14, 0.02, 0.3, 0.006), [0, -SEG.foot + 0.01, 0.04], [0, 0, 0], 'dark');
    strip(S.foot, 'legs', 'legs', 0.08, 0.012, 0.16, [0, -0.07, 0.03]);
  }

  // ------------------------------------------------------------ pose
  const fade = (sub, a, xr) => {
    for (const m of all) {
      if (m.userData.sub !== sub) continue;
      let o = a;
      if (xr > 0 && (m.userData.kind === 'white' || m.userData.kind === 'yellow' || m.userData.kind === 'visor')) o *= 1 - 0.82 * xr;
      m.opacity = o;
      const tr = o < 0.999;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.depthWrite = o > 0.5;
    }
  };
  const tmp = new V3();

  /**
   * st: {d (0..1), time (s, for the frame's heartbeat), focus: {head..shield: 0..1}, explode 0..1, xray 0..1}
   */
  const update = (st) => {
    const d = st.d;
    const S = stagesAt(d);
    const F = st.focus;
    const ex = st.explode ?? 0;
    const xr = st.xray ?? 0;
    const dim = Math.min(1, SUBS.reduce((a, k) => a + F[k], 0));
    for (const k of SUBS) fade(k, 1 - 0.85 * dim * (1 - F[k]), xr);

    // lengths
    const thighL = SEG.thigh + GROW.thigh * S.legs;
    const shinL = SEG.shin + GROW.shin * S.legs;
    const waistL = SEG.waist + GROW.waist * S.torso;
    const neckL = SEG.neck + GROW.neck * S.head;
    // the stance widens and the knees flex a little in Destroy Mode; the body breathes
    const breathe = Math.sin(st.time * 1.3) * 0.004;
    const abd = 0.05 + 0.03 * S.legs;
    const knee = 0.08 + 0.06 * S.legs;
    for (const s of sides) {
      const {sx} = s;
      s.hip.position.set(sx * (0.105 + 0.12 * ex), -0.03 - 0.05 * ex, 0);
      s.hip.rotation.set(-knee * 0.5, 0, sx * abd);
      // bulk: the limbs are built slim and widened here (x and z only, so every length stays true)
      s.thigh.scale.set(1.32, 1, 1.25);
      s.knee.scale.set(1.0, 1, 1.02);
      s.upper.scale.set(1.28, 1, 1.25);
      s.thighCore.scale.y = thighL / SEG.thigh;
      s.thighCore.position.y = -thighL / 2;
      s.thighArmor.position.y = -GROW.thigh * S.legs * 0.5;
      s.knee.position.y = -thighL;
      s.knee.rotation.set(knee, 0, 0);
      s.shinCore.scale.y = shinL / SEG.shin;
      s.shinCore.position.y = -shinL / 2;
      s.shinUpper.position.y = 0;
      s.shinLower.position.y = -GROW.shin * S.legs;
      s.ankle.position.y = -shinL;
      s.ankle.rotation.set(-knee * 0.5, 0, -sx * abd);
      // arms: the right holds the magnum forward, the left carries the shield
      s.shoulder.position.set(sx * (0.2 + 0.18 * ex), 0.27 + 0.04 * ex, -0.005);
      if (sx < 0) {
        s.upper.rotation.set(-0.12 - 0.08 * S.arms, 0, -0.1);
        s.elbow.rotation.set(-0.42, 0, 0);
      } else {
        s.upper.rotation.set(-0.1, 0, 0.16 + 0.06 * S.arms);
        s.elbow.rotation.set(-0.55, 0.2, 0);
      }
    }
    // pelvis height: the ground under the soles through the bent legs
    const legH = SEG.foot + shinL * Math.cos(knee * 0.5) + thighL * Math.cos(knee * 0.5) * Math.cos(abd);
    pelvis.position.y = legH + 0.03 + 0.06 * ex;
    abdomen.scale.y = waistL / SEG.waist;
    abdomen.position.y = waistL / 2;
    abPlates.forEach((p, k) => (p.userData.dy = (k / 2) * GROW.waist * S.torso));
    chest.position.y = waistL + 0.07 * ex;
    chest.scale.set(1.14, 1, 1.12);
    neck.scale.set(1 / 1.14, 1, 1 / 1.12);
    pelvis.scale.set(1.15, 1, 1.15);
    for (const s of sides) {
      s.hip.scale.set(1 / 1.15, 1, 1 / 1.15);
      s.shoulder.scale.set(1.2, 1.2, 1.2);
      s.upper.scale.y = 1 / 1.2;
    }
    chest.position.z = 0;
    chest.rotation.x = breathe;
    neck.position.y = SEG.chest + 0.05 * ex;
    neckCore.scale.y = neckL / SEG.neck;
    neckCore.position.y = neckL / 2;
    head.position.y = neckL + 0.08 * ex;
    head.rotation.y = 0.12 * Math.sin(st.time * 0.35);

    // armor: the stage's open offset, then the focus and explode pushes along the same line
    for (const a of armor) {
      const k = S[a.stg];
      const push = 0.06 * F[a.sub] + 0.09 * ex;
      a.o.position.copy(a.base).addScaledVector(a.open, k).addScaledVector(a.dir, push);
      if (a.o.userData.dy) a.o.position.y += a.o.userData.dy;
      a.o.rotation.set(a.baseRot.x + a.orot.x * k, a.baseRot.y + a.orot.y * k, a.baseRot.z + a.orot.z * k);
    }
    // the horn: the two halves splay into the V-fin and lean back
    for (const h of horns) h.piv.rotation.set(-0.12 * S.head, 0, -h.sx * 0.62 * S.head);
    // the psycho-frame: glow rises with each section's stage and beats with the frame's heartbeat
    const beat = 0.75 + 0.25 * Math.sin(st.time * TAU * beatRate(d)) ** 2;
    for (const m of all) if (m.userData.kind === 'pf') m.emissiveIntensity = 0.15 + 3.6 * d * beat;
    for (const m of all) if (m.userData.kind === 'eye') m.emissiveIntensity = 3.2 * S.head * (0.85 + 0.15 * beat);
    for (const m of all) if (m.userData.kind === 'visor') m.emissiveIntensity = 0.25 * (1 - S.head);
    void tmp;
  };

  // label anchors (world space, after update)
  const w = new V3();
  const at = (o, x = 0, y = 0, z = 0) => () => o.localToWorld(w.set(x, y, z)).clone();
  const anchors = {
    horn: at(horns[1].blade, 0.004, 0.17, 0),
    visor: at(visor),
    mask: at(masks[1]),
    eye: at(head, 0.022, 0.078, 0.06),
    chest: at(chest, 0.078, 0.2, 0.12),
    collar: at(chest, 0, 0.33, 0.08),
    backpack: at(chest, 0.08, 0.32, -0.17),
    shoulder: at(sides[1].shoulder, 0.1, 0.06, 0.05),
    forearm: at(sides[1].fore, 0.04, -0.12, 0.04),
    shield: at(shield, 0, 0.12, 0.02),
    magnum: at(magnum, 0, 0.03, 0.45),
    skirt: at(pelvis, -0.075, -0.03, 0.1),
    thigh: at(sides[0].thigh, 0, -0.2, 0.08),
    knee: at(sides[1].knee, 0, -0.02, 0.1),
    shin: at(sides[0].shin, 0, -0.3, 0.08),
    pfShin: at(sides[1].shin, 0.06, -0.27, 0.0),
    foot: at(sides[1].foot, 0, -0.05, 0.14),
    head: at(head, 0, 0.12, 0.05),
  };
  return {root, update, anchors, armorStages: armor.map((a) => a.stg), pfCount: pf.length};
}
