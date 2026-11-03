# RX-0 head — pure-code study model

An interactive, code-only (three.js) study of the RX-0 Unicorn head: Unicorn Mode ⇄ NT-D transformation, psycho-frame revealed between the armor plates, exploded/ghosted interior machinery, panel-line and marking decals.

**Live preview:** https://xmqywx.github.io/rx0-head-study/ (works on phones: drag to orbit, pinch to zoom)

- `head-shared/` — the model (`head.js`, `geo.js`, `mechparts.js`, `decals.js`), stage and live page
- `head-live/` — entry for the page build
- `reference/` — the AI-generated reference sheets the model was traced from
- `refmatch/` — scripts that render the model at the sheets' layout and score/compare it
- `docs/index.html` — the built single-file page served by GitHub Pages

Build: `node ~/.claude/skills/teardown/sims/build.mjs ./head-live` → `teardown-out/dist/head-live.html`, then copy to `docs/index.html`.

Non-commercial fan study. Gundam and RX-0 Unicorn are trademarks of their respective owners; no official assets are used.
