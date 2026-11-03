# ref-match log — RX-0 head

| round | unicorn F/S/B (avg) | destroy F/S/B (avg) | change |
|---|---|---|---|
| base | .840/.767/.833 (.813) | .617/.647/.631 (.632) @k100 | first measured state |
| fit | — | (.747) @k80 | destroy sheet drawn ~80 % scale: k 100 → 80 |
| r1 | .889/.795/.877 (.854) | .743/.816/.728 (.762) | crown slimmed (hw 1.4: .93→.76, top narrower), forehead/brow pulled back .1–.2, rear fin −.2, pods +.28 up |
| r2 | .888/.812/.876 (.859) | (.755) | crown top slopes down to the back, lower head narrower; label excludes widened |
| r3 | = | .762/.795/.767 (.775) | Destroy: side armor, pods, cheeks spread outward (CROWN.spread .22) |
| r4 | = | (.773) ✗ reverted | V-fin pitched back −32° — lowered the fins, worse |
| r5 | = | (.7825) | V-fin split 57° → 52° (48° worse) |
| r6 | .931/.891/.912 (.911) | (.769) | horn width back to the Unicorn sheet (W .27(1-f)^.75), horn root −.2 z, crown hw 1.4 .76→.66, back of crown out again, rear fin lowered & flattened (top 1.45→1.22, z −1.6→−1.53), brow tip +.13, pods bottom up .25, cheek bottom up .15 |
| r7 | = | (.769 / .767 / .762) ✗ | Destroy spread/lift sweep .22/.13 → .30/.18 → .38/.22: wider is worse; kept .22/.13 |
| r8 | = | .760/.791/.790 (.780) | measurement fix: destroy front box overlapped the side drawing (x1 520→455); crownR spreads 1.0, rear-lower armor flares 2.4×; fin hinge spread .42 (.62/.80 worse overall) |

Open: destroy side view is ~20 % longer front-to-back than its own front view implies (sheet inconsistency, not fixed by one k); destroy front shows no neck collar (head hides it), the Unicorn sheet shows it wide.

## Pass 2 — Unicorn Mode detail (user: "only 40 %", circled parts)
| round | unicorn F/S/B (avg) | change |
|---|---|---|
| u3 | (.887) | shell → 16 flat facets; brow = prow of split facets (crease along the visor line, tip z 1.66); crown cap + crest + rear lip with vent; rear fin on a 2-facet back panel with slots; pod = body + raised rim + window, divider, 2 grilles, bar + lower bracket; cheek with jaw point; horn collars 1.13 |
| u4 | (.868) | pods to the side sheet's height (POD_UP .28 → .08, front view loses), head underside slopes up to the back, neck column of panels on a stepped base, horn depth .32, darker ink lines |
| u5 | .899/…/… (.882) | brow prow deepened to .62, back panel pulled in .06, crown cap seated on the shell as the top strip (was a floating lid) |

Note: IoU went down from .911 on purpose in u4 — the side sheet's pod height and the visible neck were chosen over the front-sheet silhouette.

## Pass 3 — part by part (user: generate one part sheet at a time, then align)
| round | part IoU F/S/B (avg) | head U / D | change |
|---|---|---|---|
| h1 | .902/.880/.906 (.896) | — | horn from reference/parts/horn.png: 7 chevron segments, octagon→diamond section, split halves; root housing (core, cheek blocks with slots, lugs, front tab, side slots) |
| h2 | .939/.929/.940 (.936) | — | blade 6 % slimmer (sheet outline stroke), smaller collars, housing front follows the ramp |
| h3 | .950/.928/.953 (.944) | .885 / .768 | narrow core, pointed lugs |
| h4 ✗ | (.942) | .878 / .736 | root raised to the crown surface (1.45→1.8) to show the housing: still hidden, head worse — reverted |
| e2 | — | .889 / .762 | ear pod traced from the Unicorn side view (the Codex pod sheet drew a different pod) |
| s1 ✗ | — | .884 / .773 | all ~200 segmented panels laid along the shell normal (surfPolyPlate): twisted near the facet creases — reverted |
| m1 | — | .897 / .760 | 9 side plates hand-traced from the segmented side view, flat facets over a sunk under-shell |
| m2 | — | .895 / .758 | cheek guard traced: main plate under the pod + front piece folding in to the jaw point |

Lesson: three automatic panel-transfer attempts failed (stamp grid, planar fit per panel, surface-normal plates). Hand-tracing a part from the sheet works (horn .944 alone, pod, side plates).
| v1–v4 | — | .895 / .767 | NEW METHOD viewHull: each part = intersection of its front, side and top outlines (convex pieces) → trapezoid faces at the angles the views imply. Rebuilt with it: mask (3 facets/half + chin, side profile measured: z 1.34 → 1.16 → chin 1.32), slim cheek slab, pod body (slanted front/back corners), visor (thin V), brow-prow underside down to the visor |
| w1–w4 | — | .897 / .761 | Face as a curved surface FACE_SURF = measured side profile (bulge 1.34 → hollow 1.15 → chin 1.30) − cross curve; mask halves, single chin, cheek front band on it; cheek side plate leaning in to the jaw; brow = nose piece + wings split on a rising ridge (prow); visor/mask top raised .12 (earlier grid misread); prismDense: uniform subdivision from corners (ink scratches) |
| fh1–fh4 | .899 | — | NEW METHOD foldedShell: armor = uniform-thickness folded sheets (user: every part has the same thickness, only the folds differ). Forehead rebuilt from 3x readings: U-channel column, central plate folded on the centre line / at the camera notch / at the chevron into the beak (profile 1.08@1.18 → 1.30@.80 → 1.66@.47 → 1.42@.03), framed camera window, four wing panels on one shallow plane, slits; shell and skull receded under it; dark windows made matte |
