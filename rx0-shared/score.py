"""Score for the RX-0 study film: a low, tense bed (Dm9 chords, 76 bpm) the whole way; at NT-D a rising swell under
the whole transformation, a heavy thud as each stage releases its armor, air under the exploded view, and a quiet
click on every button the operator presses.

    python run_sfx.py <project>/rx0-shared/score.py

Every time comes from ../rx0-film/timeline.json (written by gen-timeline.mjs from the film's schedule).
"""

import os

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import click

TIMELINE = "../rx0-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "rx0-score.wav")
TARGET_LUFS = -14.0
SEED = 0

CHORDS = chords("Dm9:D1 A1 C2 E2 F2/D0", "Bbmaj7:Bb0 F1 A1 D2/Bb-1", "Gm9:G0 D1 F1 A1 Bb1/G-1", "A7sus:A0 E1 G1 D2/A-1")
MOTIF = [(0.5, hz("A4")), (1.5, hz("F4")), (2.5, hz("E4"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 76, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2600)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.03)
    a, b = tl["ntd"]
    mix.put(a, airy(b - a, 120, 900, 0.8), 0.03)
    mix.put(a, motor(b - a, 90, 900, 9), 0.016)
    for t in tl["stageStarts"]:
        mix.put(t, thud(55, 0.11, 0.6), 0.1)
    ex = tl["exploded"]
    for x, y in zip(ex[0::2], ex[1::2]):
        mix.put(x, airy(y - x, 400, 1500, 0.6), 0.02)
    for t in tl["clicks"]:
        mix.put(t, click(2400, 0.025), 0.05)
