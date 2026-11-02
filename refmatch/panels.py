"""Turn Codex's colour-segmented copy of the Unicorn sheet into panel maps the model can stamp onto its shell.

    python3 refmatch/panels.py

For each view (front, side, back) it clusters the flat fill colours, cuts them apart at the black line work, labels
connected regions (one region = one armor panel as seen from that view), drops specks, and writes
head-shared/panels.js: per view a downsampled Uint8 label map (0 = line / background) plus the sheet mapping, so the
page can look up which panel any surface point belongs to. Also writes refmatch/out/panels-debug.png.
"""
import base64
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SEG = os.path.join(ROOT, 'reference/rx0-head-unicorn-segmentation.png')
VIEWS = {  # box on the sheet, origin pixel of the model's visor centre line (same as stage.js SHEETS.unicorn)
    'front': {'box': (60, 115, 430, 790), 'origin': (243, 590)},
    'side': {'box': (430, 115, 800, 790), 'origin': (610, 590)},
    'back': {'box': (800, 115, 1135, 790), 'origin': (962, 590)},
}
K = 100  # px per unit
DS = 3  # downsample factor for the stored map
MIN_PX = 60  # regions smaller than this (full res) are specks


def kmeans(X, k, iters=25, seed=1):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(iters):
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
        a = d.argmin(1)
        for j in range(k):
            if (a == j).any():
                C[j] = X[a == j].mean(0)
    return C


def label(mask_by_class):
    h, w = mask_by_class.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    sizes = [0]
    for y0 in range(h):
        for x0 in range(w):
            c = mask_by_class[y0, x0]
            if c < 0 or lab[y0, x0]:
                continue
            n += 1
            q = deque([(y0, x0)])
            lab[y0, x0] = n
            cnt = 0
            while q:
                y, x = q.popleft()
                cnt += 1
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < h and 0 <= xx < w and not lab[yy, xx] and mask_by_class[yy, xx] == c:
                        lab[yy, xx] = n
                        q.append((yy, xx))
            sizes.append(cnt)
    return lab, np.array(sizes)


def trace(mask):
    """Moore-neighbour boundary trace of the largest blob in mask; returns [(x, y), ...] in pixel coordinates."""
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return []
    i = np.lexsort((xs, ys))[0]
    start = (int(xs[i]), int(ys[i]))
    h, w = mask.shape
    inside = lambda p: 0 <= p[0] < w and 0 <= p[1] < h and mask[p[1], p[0]]
    nb = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    out = [start]
    cur = start
    d = 7
    for _ in range(20000):
        for k in range(8):
            dd = (d + 6 + k) % 8 if False else (d + 5 + k) % 8
            q = (cur[0] + nb[dd][0], cur[1] + nb[dd][1])
            if inside(q):
                cur = q
                d = dd
                break
        else:
            break
        if cur == start:
            break
        out.append(cur)
    return out


def dp(pts, eps):
    """Douglas-Peucker on a closed polyline."""
    if len(pts) < 4:
        return pts
    P = np.array(pts, float)
    def rec(a, b):
        if b <= a + 1:
            return [a]
        seg = P[b] - P[a]
        L = np.hypot(*seg) or 1e-9
        d = np.abs(np.cross(seg, P[a + 1 : b] - P[a])) / L
        k = int(d.argmax())
        if d[k] > eps:
            return rec(a, a + 1 + k) + rec(a + 1 + k, b)
        return [a]
    far = int(np.hypot(*(P - P[0]).T).argmax())
    idx = rec(0, far) + rec(far, len(P) - 1) + [len(P) - 1]
    return [tuple(map(float, P[i])) for i in idx]


def dilate(m, r=1):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o |= np.roll(np.roll(m, dy, 0), dx, 1)
    return o


def main():
    img = np.array(Image.open(SEG).convert('RGB')).astype(np.float32)
    mx = img.max(-1)
    mn = img.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    colored = (sat > 0.35) & (mx > 70)
    # one palette for the whole sheet so a colour means the same thing in every view
    X = img[colored][:: max(1, colored.sum() // 40000)]
    C = kmeans(X, 20)
    out = {}
    dbg = []
    rng = np.random.default_rng(3)
    for name, v in VIEWS.items():
        x0, y0, x1, y1 = v['box']
        sub = img[y0:y1, x0:x1]
        col = colored[y0:y1, x0:x1]
        d = ((sub[:, :, None, :] - C[None, None]) ** 2).sum(-1)
        cls = np.where(col, d.argmin(-1), -1)
        lab, sizes = label(cls)
        keep = sizes >= MIN_PX
        keep[0] = False
        remap = np.zeros(len(sizes), np.int32)
        ids = np.nonzero(keep)[0]
        remap[ids] = np.arange(1, len(ids) + 1)
        lab = remap[lab]
        n = int(lab.max())
        if n > 255:
            sys.exit(f'{name}: {n} panels, more than a byte holds')
        # downsample by majority (nearest) — boundaries stay as 0 lines
        small = lab[DS // 2 :: DS, DS // 2 :: DS].astype(np.uint8)
        out[name] = {
            'w': int(small.shape[1]), 'h': int(small.shape[0]), 'x0': x0, 'y0': y0, 'ds': DS,
            'ox': v['origin'][0], 'oy': v['origin'][1], 'n': n,
            'data': base64.b64encode(small.tobytes()).decode(),
        }
        polys = []
        ox, oy = v['origin']
        for lid in range(1, n + 1):
            m = lab == lid
            area = int(m.sum())
            if area < 90:
                continue
            ys_, xs_ = np.nonzero(m)
            yb, ye, xb, xe = ys_.min(), ys_.max() + 1, xs_.min(), xs_.max() + 1
            sub = dilate(np.pad(m[yb:ye, xb:xe], 2), 1)
            pts = trace(sub)
            pts = dp([(px + xb - 2 + x0 + 0.5, py + yb - 2 + y0 + 0.5) for px, py in pts], 2.2)
            if len(pts) < 3:
                continue
            sgn = {'front': 1, 'side': -1, 'back': -1}[name]
            poly = [[round(sgn * (px - ox) / K, 3), round((oy - py) / K, 3)] for px, py in pts]
            polys.append({'id': lid, 'area': area, 'poly': poly})
        out[name]['polys'] = polys
        pal = (rng.random((n + 1, 3)) * 200 + 40).astype(np.uint8)
        pal[0] = 255
        dbg.append(pal[lab])
        print(f'{name}: {n} panels, {len(polys)} polygons, map {small.shape[1]}x{small.shape[0]}')
    js = (
        "// Generated by refmatch/panels.py from reference/rx0-head-unicorn-segmentation.png — do not edit.\n"
        "// Per view: a label map (0 = line work / background), its place on the sheet and px per unit.\n"
        f"export const PANEL_K = {K};\n"
        f"export const PANEL_MAPS = {json.dumps(out)};\n"
    )
    open(os.path.join(ROOT, 'head-shared/panels.js'), 'w').write(js)
    h = max(d.shape[0] for d in dbg)
    Image.fromarray(np.concatenate([np.pad(d, ((0, h - d.shape[0]), (0, 6), (0, 0)), constant_values=255) for d in dbg], 1)).save(os.path.join(HERE, 'out/panels-debug.png'))
    print('panels.js', os.path.getsize(os.path.join(ROOT, 'head-shared/panels.js')) // 1024, 'KB')


if __name__ == '__main__':
    main()
