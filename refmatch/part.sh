#!/bin/sh
# render one part alone at its part sheet's layout and score it. usage: refmatch/part.sh <part> <tag>
set -e
cd "$(dirname "$0")/.."
PART=$1; TAG=${2:-p}
S=~/.claude/skills/ref-match/scripts
node ~/.claude/skills/teardown/sims/build.mjs ./head-live >/dev/null
node $S/render.mjs --url "file://$PWD/teardown-out/dist/head-live.html#part=$PART" --out refmatch/out/render-part-$PART.png
python3 $S/score.py refmatch/part-$PART.json --tag "$TAG-$PART"
