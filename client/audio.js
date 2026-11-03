// Tiny synth sound effects with Web Audio: no audio files to load.

let ctx = null;

export function unlockAudio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
}

function tone(freq, dur, { type = "sine", gain = 0.15, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  dash: () => tone(260, 0.12, { type: "sawtooth", gain: 0.05, slide: 300 }),
  bump: (strong) => tone(strong ? 110 : 180, 0.15, { type: "square", gain: strong ? 0.12 : 0.05, slide: -60 }),
  goal: (mine) => {
    const notes = mine ? [523, 659, 784, 1047] : [392, 330];
    notes.forEach((f, i) => tone(f, 0.18, { type: "triangle", gain: 0.12, delay: i * 0.08 }));
  },
  beep: (high) => tone(high ? 880 : 440, 0.12, { type: "square", gain: 0.06 }),
};
