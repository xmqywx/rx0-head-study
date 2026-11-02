// Writes rx0-film/timeline.json from the film's schedule: the beats, the operator's clicks, the NT-D window, the
// stage starts (when each stage's window opens) and the explode toggles. The score and the review sheet read it.
import fs from 'node:fs';
import {STAGES} from './rx0-shared/kin.js';
import {DURATION, NTD, SCRIPT} from './rx0-shared/schedule.js';

const beats = [...new Set(SCRIPT.map((e) => e.t))];
const clicks = SCRIPT.filter((e) => e.t > 0 && (e.sub || e.display || e.ntd)).flatMap((e) => [e.t, ...(e.sub && e.display ? [e.t + 0.4] : [])]);
const stageStarts = STAGES.map((s) => Number((NTD.t0 + s.a * (NTD.t1 - NTD.t0)).toFixed(3)));
const exploded = SCRIPT.filter((e) => e.display === 'exploded').map((e) => e.t);
fs.writeFileSync('rx0-film/timeline.json', JSON.stringify({duration: DURATION, beats, clicks, ntd: [NTD.t0, NTD.t1], stageStarts, exploded}, null, 1));
console.log({beats: beats.length, clicks: clicks.length, stageStarts});
