// Kew UI sounds — synthesized on the fly with the Web Audio API, so there are
// no audio files to ship or license. Short, quiet, pitched to one key (C major)
// so they sit together; the keklik call on completion stays separate.

type Tone = {
  f: number; // start frequency (Hz)
  to?: number; // glide to this frequency
  at?: number; // start offset (s)
  d: number; // duration (s)
  g?: number; // peak gain
  w?: OscillatorType;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let last = -1e9; // ms, wall clock (the audio clock sits at 0 until it starts)

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  // a gentle low-pass takes the edge off the oscillators
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;
  master.connect(lp).connect(ctx.destination);
  return ctx;
}

function play(tones: Tone[], minGap = 0.03) {
  if (!enabled) return;
  try {
    const ac = audio();
    if (!ac || !master) return;
    if (ac.state === "suspended") void ac.resume();
    const wall = performance.now();
    if (wall - last < minGap * 1000) return; // no machine-gun clicks
    last = wall;
    const now = ac.currentTime;
    for (const t of tones) {
      const start = now + (t.at ?? 0);
      const end = start + t.d;
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = t.w ?? "sine";
      osc.frequency.setValueAtTime(t.f, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, end);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(t.g ?? 0.12, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* audio is decoration — never let it break the UI */
  }
}

// C major: C5 523, E5 659, G5 784, C6 1047, E6 1319, G6 1568
export const sfx = {
  /** generic button / chip */
  tap: () => play([{ f: 1400, to: 900, d: 0.04, g: 0.045, w: "triangle" }], 0.05),
  /** bottom tab switch */
  tab: () => play([{ f: 880, to: 1175, d: 0.07, g: 0.06 }]),
  toggleOn: () => play([{ f: 784, d: 0.06, g: 0.07 }, { f: 1175, at: 0.05, d: 0.08, g: 0.06 }]),
  toggleOff: () => play([{ f: 1047, d: 0.06, g: 0.06 }, { f: 659, at: 0.05, d: 0.08, g: 0.06 }]),
  /** a download was queued */
  start: () =>
    play([
      { f: 523, d: 0.1, g: 0.09, w: "triangle" },
      { f: 784, at: 0.075, d: 0.16, g: 0.09, w: "triangle" },
    ], 0),
  /** search results arrived */
  found: () =>
    play([
      { f: 1047, d: 0.09, g: 0.06 },
      { f: 1319, at: 0.06, d: 0.09, g: 0.06 },
      { f: 1568, at: 0.12, d: 0.22, g: 0.05 },
    ], 0),
  /** finished (used when the keklik call is off) */
  success: () =>
    play([
      { f: 784, d: 0.12, g: 0.08, w: "triangle" },
      { f: 1047, at: 0.09, d: 0.14, g: 0.08, w: "triangle" },
      { f: 1568, at: 0.18, d: 0.45, g: 0.06 },
      { f: 3136, at: 0.18, d: 0.3, g: 0.012 },
    ], 0),
  /** invalid input, failed download, nothing found */
  error: () =>
    play([
      { f: 330, d: 0.11, g: 0.09, w: "triangle" },
      { f: 247, at: 0.1, d: 0.18, g: 0.09, w: "triangle" },
    ], 0),
  /** item removed */
  remove: () => play([{ f: 600, to: 260, d: 0.14, g: 0.06, w: "triangle" }]),
};
