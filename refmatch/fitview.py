# sweep one view's origin (and optionally scale) for the Destroy sheet: rewrites SHEETS.destroy in stage.js each try
import re, subprocess, json, sys, itertools
view = sys.argv[1]
ks = [float(k) for k in sys.argv[2].split(',')] if len(sys.argv) > 2 else [None]
p = 'head-shared/stage.js'
src = open(p).read()
m = re.search(r"destroy: \{front: \[(\d+), (\d+)\], side: \[(\d+), (\d+)\], back: \[(\d+), (\d+)\], top: \[(\d+), (\d+)\], k: 80, topUp: -1(?:, kv: \{[^}]*\})?\}", src)
vals = list(map(int, m.groups()))
idx = {'front': 0, 'side': 2, 'back': 4, 'top': 6}[view]
best = None
S = '/Users/ying/.claude/skills/ref-match/scripts'
def run(o, k):
    v = vals[:]
    v[idx], v[idx + 1] = o
    kv = f", kv: {{{view}: {k}}}" if k else ''
    line = f"destroy: {{front: [{v[0]}, {v[1]}], side: [{v[2]}, {v[3]}], back: [{v[4]}, {v[5]}], top: [{v[6]}, {v[7]}], k: 80, topUp: -1{kv}}}"
    open(p, 'w').write(src.replace(m.group(0), line))
    subprocess.run(['node', '/Users/ying/.claude/skills/teardown/sims/build.mjs', './head-live'], capture_output=True)
    subprocess.run(['node', f'{S}/render.mjs', '--url', 'file://' + subprocess.os.getcwd() + '/teardown-out/dist/head-live.html#ortho=destroy', '--out', 'refmatch/out/render-destroy.png'], capture_output=True)
    out = subprocess.run(['python3', f'{S}/score.py', 'refmatch/destroy.json', '--tag', 'fit', '--fit'], capture_output=True, text=True).stdout
    line_v = [l for l in out.splitlines() if l.strip().startswith(view)][0]
    iou = float(re.search(r'IoU ([0-9.]+)', line_v).group(1))
    sh = json.loads(re.search(r'fit (\[[-0-9, ]+\])px', line_v).group(1))
    return iou, sh, line
for k in ks:
    o = (vals[idx], vals[idx + 1])
    for it in range(3):
        iou, sh, line = run(o, k)
        if sh == [0, 0]: break
        o = (o[0] + sh[0], o[1] + sh[1])
    iou, sh, line = run(o, k)
    print(k, o, iou)
    if not best or iou > best[0]: best = (iou, line)
src2 = src.replace(m.group(0), best[1])
open(p, 'w').write(src2)
print('best', best)
