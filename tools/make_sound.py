# Kew — synthesize a short stylized keklik (chukar) call for the
# "download complete" notification. Pure stdlib, no deps. Cybergah Group.
import wave, struct, math, sys, os

SR = 44100


def chirp(f0, f1, dur, vol):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / n
        env = math.sin(math.pi * t) ** 0.8
        f = f0 + (f1 - f0) * t
        ph = 2 * math.pi * f * (i / SR)
        s = 0.8 * math.sin(ph) + 0.2 * math.sin(2 * ph)
        out.append(env * vol * s)
    return out


def silence(dur):
    return [0.0] * int(SR * dur)


def build():
    seq = []
    # a few accelerating clucks — the chukar's "chuck-chuck-chuck"
    gaps = [0.12, 0.10, 0.085, 0.07, 0.06]
    for i, g in enumerate(gaps):
        seq += chirp(1300 + i * 60, 1750 + i * 70, 0.05, 0.5)
        seq += silence(g)
    # closing flourish — "…kar"
    seq += chirp(1500, 2250, 0.10, 0.62)
    seq += silence(0.05)
    peak = max(1e-6, max(abs(x) for x in seq))
    return b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, x / peak * 0.9)) * 32767)) for x in seq
    )


if __name__ == "__main__":
    data = build()
    for path in sys.argv[1:]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        w = wave.open(path, "w")
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
        w.close()
        print("wrote", path)
