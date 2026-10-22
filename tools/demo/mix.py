"""Synthesises a fantasy-tavern tune plus click/typing sounds, timed to the recording, and muxes the final video.

Everything is generated here (no samples), so there are no licensing questions.
"""
import json, math, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
import imageio_ffmpeg

SR = 44100
OUT = Path('out')
rng = np.random.default_rng(7)
meta = json.loads((OUT / 'meta.json').read_text())
events = json.loads((OUT / 'events.json').read_text())
L = meta['length']
N = int(L * SR) + SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, f, order=2):
    b, a = butter(order, f / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = butter(order, f / (SR / 2), 'high')
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return lfilter(b, a, x)


# ── Instruments ───────────────────────────────────────────────────────────
def pluck(m, dur, bright=0.5, decay=0.996):
    """Karplus-Strong string (harp/lute), vectorised one period at a time."""
    f = hz(m)
    p = max(2, int(round(SR / f)))
    n = int(dur * SR)
    y = np.zeros(n + p + 1)
    exc = lp(rng.uniform(-1, 1, p), 1500 + 6000 * bright, 1)
    y[:p] = exc - exc.mean()
    i = p
    while i < n + p:
        j = min(i + p, n + p)
        k = j - i
        y[i:j] = decay * 0.5 * (y[i - p:i - p + k] + y[i - p - 1:i - p - 1 + k] if i - p - 1 >= 0 else y[i - p:i - p + k] * 2)
        i = j
    out = y[p:p + n]
    env = np.ones(n)
    r = min(n, int(0.08 * SR))
    env[-r:] = np.linspace(1, 0, r)
    return out * env / (np.max(np.abs(out)) + 1e-9)


def flute(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    ph = 2 * np.pi * hz(m) * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    breath = bp(rng.normal(0, 1, n), hz(m) * 0.8, min(hz(m) * 3, 9000)) * 0.06
    att, rel = 0.06, min(0.15, dur * 0.4)
    env = np.clip(t / att, 0, 1) * np.clip((dur - t) / rel, 0, 1)
    env *= 0.85 + 0.15 * np.exp(-t * 3)
    return (x + breath) * env


def pad(notes, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for det in (-0.08, 0.0, 0.08):
            f = hz(m + det)
            for k in range(1, 7):
                x += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) / k
    x = lp(x, 1200)
    env = np.clip(t / 0.6, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return x * env / (len(notes) * 6)


def drum(strong=True):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 95 * np.exp(-t * 6) + 55
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (9 if strong else 16))
    skin = bp(rng.normal(0, 1, n), 200, 1800) * np.exp(-t * 40) * 0.35
    return (body + skin) * (1.0 if strong else 0.45)


# ── Score: D dorian, 3/4, eighth-note grid ────────────────────────────────
CHORDS = {  # harp tones (low to high), pad tones, bass
    'Dm': ([50, 57, 62, 65], [57, 62, 65], 38),
    'C': ([48, 55, 60, 64], [55, 60, 64], 36),
    'Bb': ([46, 53, 58, 62], [53, 58, 62], 34),
    'A': ([45, 52, 57, 61], [52, 57, 61], 33),
    'F': ([41, 48, 53, 57], [53, 57, 60], 41),
}
PROG = ['Dm', 'C', 'Bb', 'A', 'Dm', 'F', 'C', 'A']
MEL_A = [[(74, 3), (76, 1), (77, 2)], [(76, 2), (74, 2), (72, 2)], [(74, 4), (70, 2)], [(69, 6)],
         [(77, 3), (79, 1), (81, 2)], [(81, 2), (79, 2), (77, 2)], [(76, 2), (79, 2), (76, 2)], [(76, 2), (73, 2), (69, 2)]]
MEL_B = [[(81, 2), (77, 2), (74, 2)], [(79, 3), (77, 1), (76, 2)], [(77, 2), (74, 2), (70, 2)], [(73, 4), (76, 2)],
         [(74, 2), (77, 2), (81, 2)], [(84, 3), (81, 1), (77, 2)], [(79, 2), (76, 2), (72, 2)], [(69, 2), (73, 2), (76, 2)]]
ARP = [0, 1, 2, 3, 2, 1]

TAIL = 4.5
phrases = max(3, round((L - TAIL) / 14.4))
bar = (L - TAIL) / (phrases * 8)
eighth = bar / 6
L_music = phrases * 8 * bar + TAIL

mus = np.zeros((N + 6 * SR, 2))


def add(sig, t, gain, pan=0.0):
    i = int(t * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(i + len(sig), len(mus))
    if j <= i:
        return
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    mus[i:j, 0] += sig[:j - i] * gain * l * 1.41
    mus[i:j, 1] += sig[:j - i] * gain * r * 1.41


for ph in range(phrases):
    last = ph == phrases - 1
    melody = None if ph == 0 else (MEL_A if ph % 2 == 1 else MEL_B)
    drums = ph >= 2 and ph != phrases - 2 or (last and phrases > 3)
    for b, name in enumerate(PROG):
        t0 = (ph * 8 + b) * bar
        harp, padn, bass = CHORDS[name]
        if last and b == 7:  # end on D minor instead of A, to resolve
            harp, padn, bass = CHORDS['Dm']
        for k, idx in enumerate(ARP):
            tt = t0 + k * eighth + rng.normal(0, 0.006)
            add(pluck(harp[idx] + 12, 1.6, bright=0.45, decay=0.9965), tt, 0.20 * (1.15 if k == 0 else 1), pan=-0.3 + 0.12 * idx)
        add(pluck(bass, bar * 1.1, bright=0.25, decay=0.998), t0, 0.33, pan=0)
        add(pad(padn, bar + 0.6), t0 - 0.05, 0.55 if ph else 0.4)
        if drums:
            add(drum(True), t0, 0.32)
            add(drum(False), t0 + 4 * eighth, 0.32)
        if melody:
            notes = melody[b]
            if last and b == 7:
                notes = [(74, 6)]
            tt = t0
            for m, d in notes:
                add(flute(m, d * eighth * 0.97), tt, 0.16, pan=0.2)
                tt += d * eighth
# Final chord: strum and let it ring.
tf = phrases * 8 * bar
for k, m in enumerate([38, 50, 57, 62, 65, 69, 74]):
    add(pluck(m, TAIL, bright=0.4, decay=0.9985), tf + k * 0.045, 0.24, pan=-0.4 + k * 0.13)
add(pad([57, 62, 65], TAIL), tf, 0.5)

# Reverb: a decaying noise tail, a little different per ear.
ir_n = int(2.4 * SR)
ti = np.arange(ir_n) / SR
for ch in range(2):
    ir = lp(rng.normal(0, 1, ir_n), 4000) * np.exp(-ti * 2.6)
    ir[:int(0.02 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(mus[:, ch], ir)[:len(mus)]
    mus[:, ch] = mus[:, ch] * 0.8 + wet * 0.35
mus = mus[:N]
for ch in range(2):
    mus[:, ch] = hp(mus[:, ch], 45, 4)
mus /= np.max(np.abs(mus)) + 1e-9
mus *= 0.42
# Fades: gentle in, and out over the closing card.
fade_in = int(1.5 * SR)
mus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
end = int(L * SR)
fo = int(3.0 * SR)
mus[end - fo:end] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mus[end:] = 0

# ── Sound effects ─────────────────────────────────────────────────────────
sfx = np.zeros((N, 2))


def click_sound(strength=1.0):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    tick = hp(rng.normal(0, 1, n), 2500) * np.exp(-t / 0.0012)
    ping = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.004) * 0.5
    thud = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.006) * 0.6
    return (tick + ping + thud) * strength


def key_sound(space=False):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    lo, hi = (500, 4000) if space else (1200, 7000)
    clack = bp(rng.normal(0, 1, n), lo, hi) * np.exp(-t / (0.006 if space else 0.0035))
    f = rng.uniform(170, 260) * (0.7 if space else 1)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * 0.5
    bottom = np.zeros(n)
    k = int(rng.uniform(0.018, 0.028) * SR)  # key bottoming out a moment later
    m = n - k
    bottom[k:] = bp(rng.normal(0, 1, m), 900, 5000) * np.exp(-np.arange(m) / SR / 0.002) * 0.35
    return (clack + body + bottom) * rng.uniform(0.75, 1.0)


def place(sig, t, gain, pan):
    i = int(t * SR)
    j = min(i + len(sig), N)
    if i < 0 or j <= i:
        return
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    sfx[i:j, 0] += sig[:j - i] * gain * l * 1.41
    sfx[i:j, 1] += sig[:j - i] * gain * r * 1.41


t0 = meta['t0']
for e in events:
    t = e['t'] - t0
    if e['type'] == 'click':
        place(click_sound(1.0), t + 0.01, 0.30, 0.1)
        place(click_sound(0.6), t + 0.085, 0.30, 0.1)  # release
    elif e['type'] in ('key', 'space'):
        place(key_sound(e['type'] == 'space'), t, 0.32, rng.uniform(-0.15, 0.15))

mix = mus + sfx
peak = np.max(np.abs(mix))
if peak > 0.97:
    mix *= 0.97 / peak
mix = mix[:end]

with wave.open(str(OUT / 'audio.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())

dest = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / 'demo.mp4'
dest.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(OUT / 'silent.mp4'), '-i', str(OUT / 'audio.wav'),
                '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(dest)], check=True)
print(f'video {L:.1f} s, {phrases} phrases at {60 / (bar / 3):.0f} bpm -> {dest}')
