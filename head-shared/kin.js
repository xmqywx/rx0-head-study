// The RX-0 head's one input: NT-D progress d in [0, 1] (0 = Unicorn Mode, 1 = Destroy Mode). Every pose in head.js and
// every number on the panels comes from here, so the readouts can never disagree with the parts.
//
// Units: the model is built in "sheet units" (100 px of the orthographic reference = 1 unit). UNIT_M converts to metres.
// There is no official dimension for the head alone; 0.3 m per unit puts the Unicorn-mode head (collar to horn tip,
// 6.3 units) at 1.9 m, about 9.5 % of the 19.7 m machine, the usual head ratio of a Gundam design. It is an estimate,
// labelled as such on the page.
export const UNIT_M = 0.3;

export const STAGES = {
  mask: [0.0, 0.3], // face mask halves part and slide back
  cheek: [0.06, 0.34], // cheek guards make room
  face: [0.2, 0.42], // the Gundam faceplate rolls forward
  horn: [0.24, 0.62], // the horn splits into the V-fin
  crown: [0.36, 0.76], // crown armor lifts off the frame
  fin: [0.44, 0.8], // rear fin rises
  frame: [0.46, 1.0], // psycho-frame resonance
  eyes: [0.56, 0.86], // dual eyes and the main camera light
};
export const STAGE_ORDER = ['mask', 'cheek', 'face', 'horn', 'crown', 'fin', 'frame', 'eyes'];
export const STAGE_NAME = {mask: 'MASK', cheek: 'CHEEK', face: 'FACE', horn: 'V-FIN', crown: 'CROWN', fin: 'REAR FIN', frame: 'PSYCHO-FRAME', eyes: 'DUAL EYE'};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// smootherstep: actuators start and stop without a jolt
export const ease = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const stage = (d, k) => ease((d - STAGES[k][0]) / (STAGES[k][1] - STAGES[k][0]));
export const raw = (d, k) => clamp01((d - STAGES[k][0]) / (STAGES[k][1] - STAGES[k][0]));

// mechanism constants (units)
export const HORN = {root: [0, 1.45, 0.75], tip: [0, 4.57, 1.5], split: 52, spread: 0.42, drop: 0.5, sink: 0.6, pitch: 0};
HORN.len = Math.hypot(HORN.tip[1] - HORN.root[1], HORN.tip[2] - HORN.root[2]);
export const MASK = {slide: 0.36, back: 0.45, yaw: 0.6, drop: 0.14};
export const CROWN = {lift: 0.13, rise: 0.08, spread: 0.22}; // spread: the side armor opens outward, the Destroy head is wider
export const FRAME_RISE = 0.13; // the psycho-frame pushes out into the opened seams
export const FIN = {rise: 0.36};
export const FACE = {travel: 0.14};
const COLLAR_Y = -1.72;

export function pose(d) {
  const s = Object.fromEntries(Object.keys(STAGES).map((k) => [k, stage(d, k)]));
  return {...s, d, hornAngle: HORN.split * s.horn};
}

// the numbers on the panels, all from the same pose the parts use
export function readouts(d) {
  const p = pose(d);
  const a = p.hornAngle * (Math.PI / 180);
  // horn half tip: rotated about its hinge, then the hinge spreads and drops
  const L = HORN.len - HORN.sink * p.horn; // the halves slide down into the head as they open
  const tipX = L * Math.sin(a) + HORN.spread * p.horn;
  const tipY = HORN.root[1] + L * Math.cos(a) * 0.985 - HORN.drop * p.horn;
  const top = Math.max(tipY, 2.17 + (CROWN.rise + 0.05) * p.crown); // horn tip or the crown ridge, whichever is higher
  return {
    hornAngle: p.hornAngle,
    finSpan: 2 * tipX * UNIT_M,
    maskGap: 2 * MASK.slide * p.mask * UNIT_M * 1000,
    crownLift: CROWN.lift * p.crown * UNIT_M * 1000,
    frame: p.frame * 100,
    eyes: p.eyes * 100,
    height: (top - COLLAR_Y) * UNIT_M,
    stages: p,
  };
}

// the hand check: Unicorn height = (4.57 + 1.72) × 0.3 = 1.887 m; Destroy fin tip at 58°
export const CHECK = (() => {
  const u = readouts(0);
  const x = readouts(1);
  return {unicornH: +u.height.toFixed(3), destroyH: +x.height.toFixed(3), destroySpan: +x.finSpan.toFixed(3)};
})();
