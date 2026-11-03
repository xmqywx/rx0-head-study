// Self-review contact sheet: five perspective close-ups of the head in Unicorn mode (face, 3/4 left, 3/4 right, side,
// back), labels off. node refmatch/review.mjs <html> <out.png>
import {chromium} from '/Users/ying/.claude/skills/teardown/node_modules/playwright/index.mjs';
import {execSync} from 'node:child_process';
const [html, out] = process.argv.slice(2);
const b = await chromium.launch({args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`file://${html}`);
await p.waitForFunction(() => window.__head && window.__ready, null, {timeout: 30000});
const shots = [['face', 'face', 0, 0, 1], ['q-left', '3/4', 0.1, 0.05, 0.75], ['q-right', '3/4', -1.1, 0.05, 0.75], ['side', 'side', 0, 0, 0.8], ['back', 'back', 0, 0, 0.8]];
const files = [];
for (const [name, view, az, el, zoom] of shots) {
  await p.evaluate(([v, az, el, zoom, d]) => { const H = window.__head; H.setTour(false); Object.assign(H.S, {d, dTarget: d, labels: false}); H.setView(v); setTimeout(() => { H.S.uAz = az; H.S.uEl = el; H.S.uZoom = zoom; }, 1400); }, [view, az, el, zoom, +(process.env.D || 0)]);
  await p.waitForTimeout(3000);
  const f = out.replace('.png', `-${name}.png`);
  await p.screenshot({path: f, clip: {x: 400, y: 40, width: 800, height: 800}});
  files.push(f);
}
await b.close();
execSync(`magick ${files.join(' ')} +append -resize 2400x ${out}`);
console.log(out, 'errors', JSON.stringify(errs));
