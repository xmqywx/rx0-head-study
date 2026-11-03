// Geometry kit for the RX-0 head: faceted armor built from flat triangles (every face its own normal, so planes read
// as planes), with a chamfer on every plate so edges catch the light like a kit part.
//   Mesher      collects triangles; each one is turned to face a hint direction, so winding never has to be tracked.
//   prism()     a 2D outline extruded between two height functions (planar if they are linear), chamfered on top.
//   shellPlate  a trapezoid patch of the helmet surface S(u, y), thickened along its normal, chamfered, gapped.
//   sweep()     a cross-section carried along a path (horn halves, the crown ridge).
import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';

const V3 = THREE.Vector3;
export const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;

export class Mesher {
  constructor() {
    this.p = [];
  }
  tri(a, b, c, hint) {
    if (hint) {
      const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a));
      if (n.dot(hint) < 0) [b, c] = [c, b];
    }
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  quad(a, b, c, d, hint) {
    this.tri(a, b, c, hint);
    this.tri(a, c, d, hint);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

const area2 = (P) => P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0);

// inset a CCW polygon by d (miter joins, clamped)
export function inset(P, d) {
  const n = P.length;
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n];
    const b = P[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]];
    const e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...e1) || 1;
    const l2 = Math.hypot(...e2) || 1;
    const n1 = [e1[1] / l1, -e1[0] / l1];
    const n2 = [e2[1] / l2, -e2[0] / l2];
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const m = Math.min(1 / Math.max(k, 0.25), 3);
    return [p[0] - d * (n1[0] + n2[0]) * m, p[1] - d * (n1[1] + n2[1]) * m];
  });
}

// plane coordinates (a, b) plus height h → world, for an extrusion along 'x', 'y' or 'z'
const AX = {
  z: (a, b, h) => new V3(a, b, h),
  x: (a, b, h) => new V3(h, b, a),
  y: (a, b, h) => new V3(a, h, b),
};
const AXV = {z: new V3(0, 0, 1), x: new V3(1, 0, 0), y: new V3(0, 1, 0)};

/**
 * poly: [[a, b], ...]; near/far: (a, b) => h (numbers allowed); bevel: chamfer on the far face. mirror: also emit the
 * copy with the first world axis negated (for 'z' and 'y' prisms) or the extrusion negated (for 'x').
 */
export function prism(m, poly, axis, near, far, bevel = 0.03, {mirror = false} = {}) {
  const N = typeof near === 'number' ? () => near : near;
  const F = typeof far === 'number' ? () => far : far;
  let P = poly.map((p) => [...p]);
  if (area2(P) < 0) P.reverse();
  const Q = bevel > 0 ? inset(P, bevel) : P;
  const map = AX[axis];
  const up = AXV[axis];
  const emit = (mx) => {
    const W = (a, b, h) => {
      const v = map(a, b, h);
      if (mx) {
        if (axis === 'x') v.x = -v.x;
        else v.x = -v.x;
      }
      return v;
    };
    const flip = (v) => {
      const w = v.clone();
      if (mx) w.x = -w.x;
      return w;
    };
    const s = Math.sign(F(P[0][0], P[0][1]) - N(P[0][0], P[0][1])) || 1;
    const topN = flip(up.clone().multiplyScalar(s));
    const botN = topN.clone().negate();
    const tris = THREE.ShapeUtils.triangulateShape(Q.map((q) => new THREE.Vector2(q[0], q[1])), []);
    const trisP = THREE.ShapeUtils.triangulateShape(P.map((q) => new THREE.Vector2(q[0], q[1])), []);
    const top = Q.map(([a, b]) => W(a, b, F(a, b)));
    const rim = P.map(([a, b]) => W(a, b, F(a, b) - s * bevel * 0.8));
    const bot = P.map(([a, b]) => W(a, b, N(a, b)));
    for (const [i, j, k] of tris) m.tri(top[i], top[j], top[k], topN);
    for (const [i, j, k] of trisP) m.tri(bot[i], bot[j], bot[k], botN);
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const e = [P[j][0] - P[i][0], P[j][1] - P[i][1]];
      const out2 = [e[1], -e[0]];
      const out = flip(map(out2[0], out2[1], 0).normalize());
      if (bevel > 0) m.quad(top[i], top[j], rim[j], rim[i], out.clone().add(topN));
      m.quad(rim[i], rim[j], bot[j], bot[i], out);
    }
  };
  emit(false);
  if (mirror) emit(true);
  return m;
}

/**
 * The helmet surface. sections: [[y, halfWidth, zFront, zBack], ...] bottom to top. u: radians, 0 = front (+z),
 * +90° = the head's left (+x). Cross sections are superellipses (exponent p) so the shell reads boxy, not egg-like.
 */
export function makeSurface(sections, p = 2.6, scale = 1, facets = 0) {
  const ys = sections.map((s) => s[0]);
  const at = (y) => {
    let i = 0;
    while (i < sections.length - 2 && y > sections[i + 1][0]) i++;
    const a = sections[i];
    const b = sections[i + 1];
    const t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0])));
    return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  };
  const e = 2 / p;
  const raw = (u, y, out) => {
    const [hw, zf, zb] = at(y);
    const s = Math.sin(u);
    const c = Math.cos(u);
    const zc = (zf + zb) / 2;
    const hd = (zf - zb) / 2;
    return out.set(hw * scale * Math.sign(s) * Math.abs(s) ** e, y, zc + hd * scale * Math.sign(c) * Math.abs(c) ** e);
  };
  // facets > 0: the cross-section is the polygon through `facets` points of the superellipse, so armor reads as
  // flat panels meeting at creases instead of an egg
  const step = facets ? (Math.PI * 2) / facets : 0;
  const tA = new V3();
  const tB = new V3();
  const S = (u, y, out = new V3()) => {
    if (!step) return raw(u, y, out);
    const k = Math.floor(u / step);
    const f = u / step - k;
    raw(k * step, y, tA);
    raw((k + 1) * step, y, tB);
    return out.copy(tA).lerp(tB, f);
  };
  const corners = facets ? Array.from({length: facets * 2 + 1}, (_, i) => (i - facets) * (360 / facets)) : [];
  const CEN = new V3(0, 0.3, -0.15);
  const normal = (u, y) => {
    const du = 0.004;
    const dy = 0.004;
    const a = S(u + du, y).sub(S(u - du, y));
    const b = S(u, y + dy).sub(S(u, y - dy));
    const n = a.cross(b).normalize();
    if (!Number.isFinite(n.x)) n.copy(S(u, y)).sub(CEN).normalize();
    if (n.dot(S(u, y).sub(CEN)) < 0) n.negate();
    return n;
  };
  return {S, normal, ys, at, corners};
}

/**
 * A plate on surface `surf`. c: {ub: [u0, u1] at y0, ut: [u0, u1] at y1, y: [y0, y1]} in degrees and units.
 * t: thickness, off: base offset along the normal, gap: clearance to neighbours, nu: facets across.
 * Returns {geo, center, normal} with the geometry in world coordinates.
 */
export function shellPlate(surf, c, {t = 0.09, off = 0, gap = 0.025, bevel = 0.035, nu = 0, mirror = false} = {}) {
  // y may slant: yb = [y at u0, y at u1] along the bottom edge, yt along the top; c.y = [y0, y1] for level edges
  const yb = c.yb || [c.y[0], c.y[0]];
  const yt = c.yt || [c.y[1], c.y[1]];
  const y0 = (yb[0] + yb[1]) / 2;
  const y1 = (yt[0] + yt[1]) / 2;
  const meanHw = surf.at((y0 + y1) / 2)[0];
  const gu = (gap / Math.max(meanHw, 0.35)) / D2R;
  const bu = (bevel / Math.max(meanHw, 0.35)) / D2R;
  const corner = (ins, insy) => ({
    ub: [c.ub[0] + ins, c.ub[1] - ins],
    ut: [c.ut[0] + ins, c.ut[1] - ins],
    yb: [yb[0] + insy, yb[1] + insy],
    yt: [yt[0] - insy, yt[1] - insy],
  });
  const full = corner(gu, gap);
  const topR = corner(gu + bu, gap + bevel);
  const span = Math.max(c.ub[1] - c.ub[0], c.ut[1] - c.ut[0]);
  const NU = nu || Math.max(1, Math.round(span / 16));
  // b samples: plate ends plus every surface section strictly inside (measured on the centre line)
  const bs = [0];
  for (const y of surf.ys) if (y > y0 + 0.02 && y < y1 - 0.02) bs.push((y - y0) / (y1 - y0));
  bs.push(1);
  const yAt = (R, a, b) => lerp(lerp(R.yb[0], R.yb[1], a), lerp(R.yt[0], R.yt[1], a), b);
  const uAt = (R, a, b) => lerp(lerp(R.ub[0], R.ut[0], b), lerp(R.ub[1], R.ut[1], b), a) * D2R;
  const pt = (R, a, b, h) => {
    const yy = yAt(R, a, b);
    const u = uAt(R, a, b);
    return surf.S(u, yy).addScaledVector(surf.normal(u, yy), off + h);
  };
  // a samples: evenly spaced, plus every facet crease the plate's centre line crosses (so flat panels stay flat)
  const uc0 = lerp(c.ub[0], c.ut[0], 0.5);
  const uc1 = lerp(c.ub[1], c.ut[1], 0.5);
  const as = Array.from({length: NU + 1}, (_, i) => i / NU);
  for (const cu of surf.corners || []) if (cu > uc0 + 1 && cu < uc1 - 1) as.push((cu - uc0) / (uc1 - uc0));
  as.sort((p, q) => p - q);
  const G = (R, h) => bs.map((b) => as.map((a) => pt(R, a, b, h)));
  const top = G(topR, t);
  const rim = G(full, t - bevel * 0.8);
  const base = G(full, 0);
  const center = surf.S(uAt(full, 0.5, 0.5), yAt(full, 0.5, 0.5));
  const nrm = surf.normal(uAt(full, 0.5, 0.5), yAt(full, 0.5, 0.5));
  const m = new Mesher();
  const nb = bs.length;
  const na = as.length;
  const nAt = (i, j) => surf.normal(uAt(full, as[j], bs[i]), yAt(full, as[j], bs[i]));
  for (let i = 0; i < nb - 1; i++)
    for (let j = 0; j < na - 1; j++) {
      const h = nAt(i, j);
      m.quad(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j], h);
      m.quad(base[i][j], base[i][j + 1], base[i + 1][j + 1], base[i + 1][j], h.clone().negate());
    }
  // the border, walked once around: rim chamfer up to the top, wall down to the base
  const ring = [];
  for (let j = 0; j < na; j++) ring.push([0, j]);
  for (let i = 1; i < nb; i++) ring.push([i, na - 1]);
  for (let j = na - 2; j >= 0; j--) ring.push([nb - 1, j]);
  for (let i = nb - 2; i > 0; i--) ring.push([i, 0]);
  const mid = new V3();
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k];
    const [i1, j1] = ring[(k + 1) % ring.length];
    mid.addVectors(base[i0][j0], base[i1][j1]).multiplyScalar(0.5);
    const n = nAt(i0, j0);
    const out = mid.clone().sub(center);
    out.addScaledVector(n, -out.dot(n)).normalize();
    m.quad(top[i0][j0], top[i1][j1], rim[i1][j1], rim[i0][j0], out.clone().add(n));
    m.quad(rim[i0][j0], rim[i1][j1], base[i1][j1], base[i0][j0], out);
  }
  let geo = m.geo();
  if (mirror) {
    geo = geo.clone();
    geo.scale(-1, 1, 1);
    flipWinding(geo);
    center.x = -center.x;
    nrm.x = -nrm.x;
  }
  return {geo, center, normal: nrm};
}

export function flipWinding(geo) {
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 9)
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** mirror a geometry across x = 0 (keeps faces outward) */
export function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  return flipWinding(g);
}

/**
 * A cross-section swept along a path. path: [V3], up: [V3] (the section's "n" direction at each point), section(i):
 * [[l, n], ...] closed loop in the (lateral, up) frame. Caps both ends.
 */
export function sweep(m, path, up, section) {
  const rings = path.map((p, i) => {
    const tg = (path[Math.min(i + 1, path.length - 1)].clone().sub(path[Math.max(i - 1, 0)])).normalize();
    const n = up[i].clone().addScaledVector(tg, -up[i].dot(tg)).normalize();
    const l = new V3().crossVectors(tg, n).normalize();
    return {pts: section(i).map(([a, b]) => p.clone().addScaledVector(l, a).addScaledVector(n, b)), tg, c: p};
  });
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i].pts;
    const B = rings[i + 1].pts;
    const k = A.length;
    const cen = rings[i].c.clone().add(rings[i + 1].c).multiplyScalar(0.5);
    for (let j = 0; j < k; j++) {
      const j1 = (j + 1) % k;
      const out = A[j].clone().add(A[j1]).add(B[j]).add(B[j1]).multiplyScalar(0.25).sub(cen);
      m.quad(A[j], A[j1], B[j1], B[j], out);
    }
  }
  const cap = (r, s) => {
    const c = r.pts.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / r.pts.length);
    for (let j = 0; j < r.pts.length; j++) m.tri(c, r.pts[j], r.pts[(j + 1) % r.pts.length], r.tg.clone().multiplyScalar(s));
  };
  cap(rings[0], -1);
  cap(rings[rings.length - 1], 1);
  return m;
}

/** a closed faceted body lofted through the surface's sections (the inner skull) */
export function loftBody(surf, ys, nu = 20) {
  const m = new Mesher();
  const rows = ys.map((y) => Array.from({length: nu}, (_, j) => surf.S((j / nu) * Math.PI * 2, y)));
  const CEN = new V3(0, 0.3, -0.15);
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < nu; j++) {
      const a = rows[i][j];
      const b = rows[i][(j + 1) % nu];
      const c = rows[i + 1][(j + 1) % nu];
      const d = rows[i + 1][j];
      const h = a.clone().add(c).multiplyScalar(0.5).sub(CEN);
      m.quad(a, b, c, d, h);
    }
  for (const [row, s] of [
    [rows[0], -1],
    [rows[rows.length - 1], 1],
  ]) {
    const c = row.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / row.length);
    for (let j = 0; j < nu; j++) m.tri(c, row[j], row[(j + 1) % nu], new V3(0, s, 0));
  }
  return m.geo();
}

/** clip a polygon to the half-plane a*x + b*y <= c (Sutherland-Hodgman) */
export function clipPoly(P, a, b, c) {
  const out = [];
  const inside = (p) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const q = P[(i + 1) % P.length];
    const ip = inside(p);
    const iq = inside(q);
    if (ip) out.push(p);
    if (ip !== iq) {
      const dp = a * p[0] + b * p[1] - c;
      const dq = a * q[0] + b * q[1] - c;
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/**
 * A prism cut into facet panels along lines: cuts = [[a, b, c], ...] each splitting a*x + b*y = c. Every piece is its
 * own chamfered prism with `gap` clearance, so creases read as panel lines and each piece can have its own planar
 * far face: far(x, y, i) gets the piece index. Returns the pieces' polygons too.
 */
export function prismSplit(m, poly, axis, near, far, bevel, cuts, {gap = 0.02, mirror = false} = {}) {
  let pieces = [poly.map((p) => [...p])];
  for (const [a, b, c] of cuts) {
    const n = Math.hypot(a, b);
    const next = [];
    for (const P of pieces) {
      const lo = clipPoly(P, a, b, c - (gap / 2) * n);
      const hi = clipPoly(P, -a, -b, -c - (gap / 2) * n);
      if (lo.length >= 3) next.push(lo);
      if (hi.length >= 3) next.push(hi);
    }
    pieces = next;
  }
  pieces.forEach((P, i) => {
    const F = typeof far === 'number' ? () => far : (x, y) => far(x, y, P);
    prism(m, P, axis, near, F, bevel, {mirror});
  });
  return pieces;
}

/**
 * A plate whose outline is any polygon on the surface, given in surface coordinates [u (radians), y]. The outline is
 * densified, shrunk by gap/2 (clearance to its neighbours) and again by `bevel` for the chamfer, triangulated and
 * subdivided, and every point is laid on the surface and pushed out along the surface normal (off .. off + t), so the
 * plate follows the shell without stair steps and stands proud of it. R converts radians to roughly metric units so the
 * insets are even.
 */
export function surfPolyPlate(surf, polyUY, {t = 0.08, off = 0, gap = 0.024, bevel = 0.03, seg = 0.12, R = 1.0} = {}) {
  let P = polyUY.map(([u, y]) => [u * R, y]);
  if (area2(P) < 0) P.reverse();
  const D = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / seg));
    for (let k = 0; k < n; k++) D.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const base = inset(D, gap / 2);
  const top = inset(base, bevel);
  const at = ([s, y], h) => {
    const u = s / R;
    return surf.S(u, y).addScaledVector(surf.normal(u, y), off + h);
  };
  const nrm = ([s, y]) => surf.normal(s / R, y);
  const m = new Mesher();
  let tris = THREE.ShapeUtils.triangulateShape(top.map((q) => new THREE.Vector2(q[0], q[1])), []).map((t3) => t3.map((i) => top[i]));
  for (let pass = 0; pass < 6; pass++) {
    const next = [];
    let split = false;
    for (const [a, b, c] of tris) {
      const L = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
      if (L <= seg * 1.3) {
        next.push([a, b, c]);
        continue;
      }
      split = true;
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
    if (!split) break;
  }
  for (const [a, b, c] of tris) m.tri(at(a, t), at(b, t), at(c, t), nrm(a));
  const n = base.length;
  const cen = base.reduce((acc, q) => [acc[0] + q[0] / n, acc[1] + q[1] / n], [0, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const N = nrm(base[i]);
    const out = at(base[i], 0).add(at(base[j], 0)).multiplyScalar(0.5).sub(at(cen, 0));
    out.addScaledVector(N, -out.dot(N)).normalize();
    m.quad(at(top[i], t), at(top[j], t), at(base[j], t - bevel * 0.8), at(base[i], t - bevel * 0.8), out.clone().add(N));
    m.quad(at(base[i], t - bevel * 0.8), at(base[j], t - bevel * 0.8), at(base[j], 0), at(base[i], 0), out);
  }
  const geo = m.geo();
  return {geo, center: at(cen, 0), normal: nrm(cen)};
}

/**
 * Read a part off three views: the solid that the front outline (x, y), the side outline (z, y) and optionally the
 * top outline (x, z) all allow — the intersection of their three extrusions. Outlines must be convex (split a
 * concave part into convex pieces). Extra cut planes [[nx, ny, nz, d], ...] (keep n·p <= d) chamfer edges. Every face
 * comes out a flat polygon at whatever angle the views imply: the trapezoids of a kit part, not boxes.
 */
export function viewHull(m, {front, side, top, cuts = []}, {mirror = false} = {}) {
  const planes = [];
  const add2 = (poly, to3) => {
    let P = poly.map((p) => [...p]);
    if (area2(P) < 0) P.reverse();
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const c = P[(i + 2) % P.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) console.warn('viewHull: concave outline at', b, poly);
      const n2 = [b[1] - a[1], -(b[0] - a[0])];
      const n = to3(n2[0], n2[1]);
      const p = to3(a[0], a[1], true);
      const L = n.length();
      if (L < 1e-9) continue;
      n.multiplyScalar(1 / L);
      planes.push([n, n.dot(p)]);
    }
  };
  // 2D (a, b) → 3D direction / point; the missing axis is 0
  if (front) add2(front, (a, b) => new V3(a, b, 0));
  if (side) add2(side, (a, b) => new V3(0, b, a));
  if (top) add2(top, (a, b) => new V3(a, 0, b));
  for (const [nx, ny, nz, d] of cuts) {
    const n = new V3(nx, ny, nz);
    const L = n.length();
    planes.push([n.multiplyScalar(1 / L), d / L]);
  }
  const pts = [];
  const M3 = new THREE.Matrix3();
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const [a, da] = planes[i];
        const [b, db] = planes[j];
        const [c, dc] = planes[k];
        M3.set(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        if (Math.abs(M3.determinant()) < 1e-7) continue;
        const p = new V3(da, db, dc).applyMatrix3(M3.clone().invert());
        if (planes.every(([n, d]) => n.dot(p) <= d + 1e-5) && !pts.some((q) => q.distanceToSquared(p) < 1e-8)) pts.push(p);
      }
  if (pts.length < 4) return m;
  const hull = new ConvexGeometry(pts);
  const P = hull.attributes.position.array;
  const cen = pts.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / pts.length);
  for (const mx of mirror ? [false, true] : [false]) {
    const c = cen.clone();
    if (mx) c.x = -c.x;
    for (let i = 0; i < P.length; i += 9) {
      const v = [0, 3, 6].map((o) => new V3(P[i + o], P[i + o + 1], P[i + o + 2]));
      if (mx) for (const w of v) w.x = -w.x;
      m.tri(v[0], v[1], v[2], v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1 / 3).sub(c)); // outward
    }
  }
  return m;
}

/**
 * Like prism(), but the far face follows a curved far(a, b): the outline is densified (max edge `seg`) and the top is
 * triangulated then subdivided until every edge is under `seg`, each new point lifted onto far(). Used for armor panels
 * laid onto a curved shell, where corner-only triangles would sag through it.
 */
export function prismDense(m, poly, axis, near, far, bevel = 0.03, {seg = 0.2, mirror = false} = {}) {
  let P = poly.map((p) => [...p]);
  if (area2(P) < 0) P.reverse();
  const D = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / seg));
    for (let k = 0; k < n; k++) D.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const P0 = P;
  P = D;
  const Q = bevel > 0 ? inset(P, bevel) : P;
  const Q0 = bevel > 0 ? inset(P0, bevel) : P0; // the top is triangulated from the corners only: no slivers
  const map = AX[axis];
  const N = typeof near === 'number' ? () => near : near;
  const F = far;
  const s = Math.sign(F(P[0][0], P[0][1]) - N(P[0][0], P[0][1])) || 1;
  const up = AXV[axis];
  for (const mx of mirror ? [false, true] : [false]) {
    const W = (a, b, h) => {
      const v = map(a, b, h);
      if (mx) v.x = -v.x;
      return v;
    };
    const flip = (v) => {
      const w = v.clone();
      if (mx) w.x = -w.x;
      return w;
    };
    const topN = flip(up.clone().multiplyScalar(s));
    // top: triangulate the inset outline, then split long edges (midpoints shared through a cache)
    let tris = THREE.ShapeUtils.triangulateShape(Q0.map((q) => new THREE.Vector2(q[0], q[1])), []).map((t) => t.map((i) => Q0[i]));
    // split every triangle in a pass while any is too long: uniform subdivision, so no T-junctions (cracks that
    // the ink pass would draw as scratches)
    for (let pass = 0; pass < 6; pass++) {
      const next = [];
      const longest = Math.max(...tris.map(([a, b, c]) => Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]))));
      const split = longest > seg * 1.2;
      for (const [a, b, c] of tris) {
        if (!split) {
          next.push([a, b, c]);
          continue;
        }
        const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const ab = mid(a, b);
        const bc = mid(b, c);
        const ca = mid(c, a);
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      }
      tris = next;
      if (!split) break;
    }
    for (const [a, b, c] of tris) m.tri(W(a[0], a[1], F(a[0], a[1])), W(b[0], b[1], F(b[0], b[1])), W(c[0], c[1], F(c[0], c[1])), topN);
    const trisP = THREE.ShapeUtils.triangulateShape(P.map((q) => new THREE.Vector2(q[0], q[1])), []);
    const bot = P.map(([a, b]) => W(a, b, N(a, b)));
    for (const [i, j, k] of trisP) m.tri(bot[i], bot[j], bot[k], topN.clone().negate());
    const top = Q.map(([a, b]) => W(a, b, F(a, b)));
    const rim = P.map(([a, b]) => W(a, b, F(a, b) - s * bevel * 0.8));
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      const e = [P[j][0] - P[i][0], P[j][1] - P[i][1]];
      const out = flip(map(e[1], -e[0], 0).normalize());
      if (bevel > 0) m.quad(top[i], top[j], rim[j], rim[i], out.clone().add(topN));
      m.quad(rim[i], rim[j], bot[j], bot[i], out);
    }
  }
  return m;
}

/**
 * A folded sheet of uniform thickness t — how the kit's armor is made. facets: [[V3, ...], ...], each a (nearly)
 * planar outer polygon, sharing edges along the folds. The inner skin is the outer skin offset by t: at every vertex
 * the offset satisfies n_i · d = −t for all facets meeting there (a mitred fold, exact for up to three planes), so
 * the two skins meet cleanly along folds. Open edges (used by one facet) get a wall t tall. Facets are oriented
 * outward from `centre` (default: the mean vertex). Returns m.
 */
export function foldedShell(m, facets, t = 0.07, {centre, lip = t >= 0.05 ? 0.11 : 0} = {}) {
  // lip: every open edge of the sheet folds back 90° into a return flange this deep (kit armor is a bent shell
  // with returns round its rim, not a flat card); 0 for thin dark/red inserts
  const all = facets.flat();
  const C = centre || all.reduce((a, v) => a.add(v), new V3()).multiplyScalar(1 / all.length);
  const newell = (P) => {
    const n = new V3();
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    return n.normalize();
  };
  const F = facets.map((poly) => {
    const c = poly.reduce((a, v) => a.add(v), new V3()).multiplyScalar(1 / poly.length);
    let n = newell(poly);
    if (n.dot(c.clone().sub(C)) < 0) {
      n = n.negate();
      poly = poly.slice().reverse();
    }
    return {poly, n, c};
  });
  const key = (v) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  const vn = new Map();
  for (const f of F)
    for (const v of f.poly) {
      const k = key(v);
      if (!vn.has(k)) vn.set(k, {v, ns: []});
      vn.get(k).ns.push(f.n);
    }
  // offset per vertex: least squares on n_i · d = −t (min-norm through a small ridge term)
  const inner = new Map();
  const M = new THREE.Matrix3();
  for (const [k, {v, ns}] of vn) {
    const e = 1e-4;
    let [a, b, c, d, f, g] = [e, 0, 0, e, 0, e];
    const r = new V3();
    for (const n of ns) {
      a += n.x * n.x;
      b += n.x * n.y;
      c += n.x * n.z;
      d += n.y * n.y;
      f += n.y * n.z;
      g += n.z * n.z;
      r.add(n);
    }
    M.set(a, b, c, b, d, f, c, f, g);
    const dv = r.multiplyScalar(-t).applyMatrix3(M.invert());
    if (dv.length() > 3 * t) dv.setLength(3 * t); // a nearly folded-flat fold would otherwise shoot off
    inner.set(k, v.clone().add(dv));
  }
  const edges = new Map();
  const ek = (p, q) => [key(p), key(q)].sort().join('|');
  for (const f of F)
    for (let i = 0; i < f.poly.length; i++) edges.set(ek(f.poly[i], f.poly[(i + 1) % f.poly.length]), (edges.get(ek(f.poly[i], f.poly[(i + 1) % f.poly.length])) || 0) + 1);
  for (const f of F) {
    const {poly, n, c} = f;
    // triangulate in the plane's dominant projection (handles concave outlines)
    const ax = Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z) ? 'x' : Math.abs(n.y) > Math.abs(n.z) ? 'y' : 'z';
    const P2 = poly.map((v) => (ax === 'x' ? new THREE.Vector2(v.y, v.z) : ax === 'y' ? new THREE.Vector2(v.z, v.x) : new THREE.Vector2(v.x, v.y)));
    const tris = poly.length === 3 ? [[0, 1, 2]] : THREE.ShapeUtils.triangulateShape(P2, []);
    for (const [i, j, k] of tris) {
      m.tri(poly[i], poly[j], poly[k], n);
      m.tri(inner.get(key(poly[i])), inner.get(key(poly[j])), inner.get(key(poly[k])), n.clone().negate());
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (edges.get(ek(a, b)) !== 1) continue;
      const w = new V3().subVectors(b, a).cross(n);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      if (w.dot(mid.clone().sub(c)) < 0) w.negate();
      if (!lip) {
        m.quad(a, b, inner.get(key(b)), inner.get(key(a)), w);
        continue;
      }
      // the return: a strip of the same thickness bent back along −n from this edge
      w.normalize();
      const a2 = a.clone().addScaledVector(n, -lip);
      const b2 = b.clone().addScaledVector(n, -lip);
      const ai = a.clone().addScaledVector(w, -t);
      const bi = b.clone().addScaledVector(w, -t);
      const ai2 = ai.clone().addScaledVector(n, -lip);
      const bi2 = bi.clone().addScaledVector(n, -lip);
      m.quad(a, b, b2, a2, w); // outside of the return
      m.quad(ai, ai2, bi2, bi, w.clone().negate()); // inside of the return
      m.quad(a2, b2, bi2, ai2, n.clone().negate()); // its folded-back edge
      m.quad(a, ai, bi, b, n); // the corner where the face meets the return
    }
  }
  return m;
}

/** a flat armor panel: outline [[x, y], ...] lifted onto z = plane(x, y), inset by gap/2, as a folded shell of one facet */
export function planarPanel(m, outline, plane, {t = 0.07, gap = 0.024, mirror = false} = {}) {
  let P = outline.map((p) => [...p]);
  if (area2(P) < 0) P.reverse();
  const Q = gap > 0 ? inset(P, gap / 2) : P;
  const poly = Q.map(([x, y]) => new V3(x, y, plane(x, y)));
  const c = poly.reduce((a, v) => a.add(v), new V3()).multiplyScalar(1 / poly.length);
  for (const sx of mirror ? [1, -1] : [1]) {
    const f = poly.map((v) => new V3(sx * v.x, v.y, v.z));
    const cc = new V3(sx * c.x, c.y, c.z - 1); // behind the panel, so its outer face is the lifted side
    foldedShell(m, [f], t, {centre: cc});
  }
  return m;
}
