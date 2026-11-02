#!/bin/sh
# build the head page, render both sheets, score them. usage: refmatch/run.sh <tag> [--fit]
set -e
cd "$(dirname "$0")/.."
TAG=${1:-r}; shift || true
S=~/.claude/skills/ref-match/scripts
node ~/.claude/skills/teardown/sims/build.mjs ./head-live >/dev/null
H="file://$PWD/teardown-out/dist/head-live.html"
mkdir -p refmatch/out
node $S/render.mjs --url "$H#ortho=unicorn&ink=1" --out refmatch/out/render-unicorn.png >/dev/null
node $S/render.mjs --url "$H#ortho=destroy&ink=1" --out refmatch/out/render-destroy.png >/dev/null
python3 $S/score.py refmatch/unicorn.json --tag "$TAG-u" "$@"
python3 $S/score.py refmatch/destroy.json --tag "$TAG-d" "$@"
