// The film's schedule, pure (no three.js): the operator's script and the NT-D progress over the film.
export const SCRIPT = [
  {t: 0, view: 'hero', log: 'OPERATOR · STANDBY · UNICORN MODE'},
  {t: 2.4, sub: 'head', view: 'headClose', log: 'OPERATOR · ISOLATE HEAD UNIT'},
  {t: 5.0, sub: 'off', view: 'hero', log: 'OPERATOR · ALL ASSEMBLIES HOME'},
  {t: 6.0, ntd: 1, view: 'legs', log: 'NT-D · ACTIVATED · TORSO UNLOCK'},
  {t: 8.6, view: 'chest', log: 'NT-D · LEGS EXTEND · ARMS RELEASE'},
  {t: 11.6, view: 'headClose', log: 'NT-D · HORN SPLITS · V-FIN'},
  {t: 15.2, view: 'hero', log: 'DESTROY MODE · FRAME AT RESONANCE'},
  {t: 17.0, sub: 'arms', view: 'arm', log: 'OPERATOR · ISOLATE ARMS'},
  {t: 19.4, sub: 'shield', view: 'shield', log: 'OPERATOR · ISOLATE SHIELD'},
  {t: 21.8, sub: 'off', view: 'hero', display: 'exploded', log: 'OPERATOR · EXPLODE ALL'},
  {t: 22.2, display: 'turntable'},
  {t: 25.4, display: 'exploded', log: 'OPERATOR · REASSEMBLE'},
  {t: 26.0, display: 'xray', log: 'OPERATOR · X-RAY ARMOR'},
  {t: 28.0, display: 'xray'},
  {t: 28.3, display: 'turntable'},
  {t: 28.6, display: 'labels', log: 'OPERATOR · DESTROY MODE · LABELLED'},
];
export const DURATION = 32;
export const NTD = {t0: 6.0, t1: 15.0};
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
/** NT-D progress: linear through the activation window (each stage eases inside its own window) */
export const dAt = (t) => Math.min(1, Math.max(0, (t - NTD.t0) / (NTD.t1 - NTD.t0)));
