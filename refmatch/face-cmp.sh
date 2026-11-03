#!/bin/sh
# face-only review: sheet vs render, front + side at 2x; usage refmatch/face-cmp.sh <tag>
cd "$(dirname "$0")/.."
S=~/.claude/skills/ref-match/scripts
node ~/.claude/skills/teardown/sims/build.mjs ./head-live >/dev/null
node $S/render.mjs --url "file://$PWD/teardown-out/dist/head-live.html#ortho=unicorn" --out refmatch/out/render-unicorn.png >/dev/null
python3 - "$1" <<'PY'
import sys
from PIL import Image
t=sys.argv[1]
R=Image.open('reference/rx0-head-unicorn-mode-orthographic.png').convert('RGB')
X=Image.open('refmatch/out/render-unicorn.png').convert('RGBA')
X=Image.alpha_composite(Image.new('RGBA',X.size,(255,255,255,255)),X).convert('RGB')
bs=[(115,540,375,770),(435,540,600,770)]
W=Image.new('RGB',(sum((b[2]-b[0])*2 for b in bs)+30,230),'white'); x=0
for b in bs:
    for im in (R,X):
        W.paste(im.crop(b),(x,0)); x+=b[2]-b[0]+5
W.resize((W.width*2,W.height*2)).save(f'refmatch/out/{t}-face.png')
PY
