# 2x side-by-side crops of the Unicorn sheet vs the latest render: refmatch/out/<tag>-<view>-pair.png
import sys
from PIL import Image
tag = sys.argv[1]
R = Image.open('reference/rx0-head-unicorn-mode-orthographic.png').convert('RGB')
X = Image.open('refmatch/out/render-unicorn.png').convert('RGBA')
X = Image.alpha_composite(Image.new('RGBA', X.size, (255, 255, 255, 255)), X).convert('RGB')
for name, box in [('side', (430, 330, 800, 780)), ('back', (800, 330, 1135, 780)), ('front', (80, 330, 420, 780))]:
    a, b = R.crop(box), X.crop(box)
    W = Image.new('RGB', (a.width * 2 + 10, a.height), 'white')
    W.paste(a, (0, 0))
    W.paste(b, (a.width + 10, 0))
    W.resize((W.width * 2, W.height * 2)).save(f'refmatch/out/{tag}-{name}-pair.png')
