// RX-0 study model, the transformation. One input drives everything: d, the NT-D progress from 0 (Unicorn Mode) to 1
// (Destroy Mode). The sequence runs bottom-up through the body the way the armor releases: the torso unlocks first,
// then the legs extend, the arms open, the shoulders lift, and last the head: the horn splits into the V-fin and the
// face mask retracts. Every stage is a window of d; every plate reads its stage's eased progress. No three.js here.
//
// Scale: the scene is built at 1/10 (1 scene metre = 10 m). Heights from the published spec as remembered:
// 19.7 m to the head top in Unicorn Mode, 21.7 m in Destroy Mode; 23.7 t empty, 42.7 t full. The 2.0 m of growth is
// shared out here as thigh 0.5 m + shin 0.6 m + waist 0.5 m + neck 0.4 m (check below: 0.5 + 0.6 + 0.5 + 0.4 = 2.0).

export const SCALE = 10; // real metres per scene metre
export const SPEC = {hUnicorn: 19.7, hDestroy: 21.7, massEmpty: 23.7, massFull: 42.7};
export const GROW = {thigh: 0.05, shin: 0.06, waist: 0.05, neck: 0.04}; // scene metres added at d = 1

// the stage windows on d
export const STAGES = [
  {key: 'torso', name: 'TORSO UNLOCK', a: 0.0, b: 0.32},
  {key: 'legs', name: 'LEG EXTENSION', a: 0.12, b: 0.5},
  {key: 'arms', name: 'ARM RELEASE', a: 0.3, b: 0.62},
  {key: 'shoulder', name: 'SHOULDER LIFT', a: 0.42, b: 0.72},
  {key: 'head', name: 'HEAD · V-FIN', a: 0.66, b: 0.96},
];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
/** eased progress of one stage at transformation d */
export const stage = (key, d) => {
  const s = STAGES.find((x) => x.key === key);
  return smoother((d - s.a) / (s.b - s.a));
};
/** all stages at once */
export const stagesAt = (d) => Object.fromEntries(STAGES.map((s) => [s.key, stage(s.key, d)]));

// segment lengths (scene metres) in Unicorn Mode; Destroy Mode adds GROW
export const SEG = {
  foot: 0.09,
  shin: 0.52,
  thigh: 0.48,
  pelvis: 0.12,
  waist: 0.14,
  chest: 0.36,
  neck: 0.06,
  head: 0.2,
};
/** the head top above the ground at d (scene metres) */
export function headTop(d) {
  const S = stagesAt(d);
  return SEG.foot + SEG.shin + GROW.shin * S.legs + SEG.thigh + GROW.thigh * S.legs + SEG.pelvis + SEG.waist + GROW.waist * S.torso + SEG.chest + SEG.neck + GROW.neck * S.head + SEG.head;
}
/** real height in metres */
export const height = (d) => headTop(d) * SCALE;

// the psycho-frame: how much of it is exposed (the open armor area) and its resonance, a glow that rises with the
// exposure and beats at a rate that climbs with d (the "heartbeat" of the frame: 0.6 Hz idle, 1.6 Hz at full NT-D)
export const PF_SECTIONS = ['torso', 'legs', 'arms', 'shoulder', 'head'];
export const exposure = (d) => {
  const S = stagesAt(d);
  return (S.torso * 0.22 + S.legs * 0.32 + S.arms * 0.2 + S.shoulder * 0.14 + S.head * 0.12);
};
export const beatRate = (d) => 0.6 + 1.0 * d;

export const CHECK = {
  grow: (GROW.thigh + GROW.shin + GROW.waist + GROW.neck) * SCALE,
  unicorn: height(0),
  destroy: height(1),
};
