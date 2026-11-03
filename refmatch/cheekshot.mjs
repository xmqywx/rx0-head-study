// side close-up of the cheek / pod area next to the sheet's side view: node refmatch/cheekshot.mjs <html> <out>
import {chromium} from '/Users/ying/.claude/skills/teardown/node_modules/playwright/index.mjs';
import {execSync} from 'node:child_process';
const [html, out] = process.argv.slice(2);
const b = await chromium.launch({args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
await p.goto(`file://${html}`);
await p.waitForFunction(() => window.__head && window.__ready, null, {timeout: 30000});
await p.evaluate(() => { const H = window.__head; H.setTour(false); Object.assign(H.S, {d: 0, dTarget: 0, labels: false}); H.setView('cheek'); });
await p.waitForTimeout(2800);
await p.screenshot({path: out + '-r.png', clip: {x: 470, y: 170, width: 660, height: 560}});
await b.close();
execSync(`magick reference/rx0-head-unicorn-mode-orthographic.png -crop 300x260+430+470 -resize 660x572 ${out}-s.png`);
execSync(`magick ${out}-s.png ${out}-r.png -resize x560 +append ${out}.png`);
