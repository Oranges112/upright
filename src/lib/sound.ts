"use client";

/**
 * All sounds are synthesised live with the Web Audio API: soft bell-like chimes
 * (D-major pentatonic so everything sounds pleasant together), gentle countdown
 * ticks, and an optional warm ambient pad that plays under a session.
 */

const NOTE: Record<string, number> = {
  D3: 146.83,
  A3: 220.0,
  D4: 293.66,
  "F#4": 369.99,
  A4: 440.0,
  B4: 493.88,
  D5: 587.33,
  E5: 659.25,
  "F#5": 739.99,
  A5: 880.0,
  B5: 987.77,
  D6: 1174.66,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private pad: { nodes: AudioNode[]; gain: GainNode; stop: () => void } | null = null;
  enabled = true;

  /** Must be called from a user gesture at least once (browser autoplay rules). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.35;
      this.reverb.connect(wet);
      wet.connect(this.master);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** A single bell tone: sine fundamental + soft inharmonic partial, long decay. */
  private bell(freq: number, when: number, vol = 0.22, decay = 1.6) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(vol, when + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    out.connect(this.master!);
    out.connect(this.reverb!);

    const partials: [number, number, OscillatorType][] = [
      [1, 1, "sine"],
      [2.0, 0.28, "sine"],
      [3.01, 0.08, "triangle"],
    ];
    for (const [mult, amp, type] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g);
      g.connect(out);
      o.start(when);
      o.stop(when + decay + 0.05);
    }
  }

  private play(notes: string[], gap = 0.12, vol = 0.22, decay = 1.6) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    notes.forEach((n, i) => this.bell(NOTE[n], t + i * gap, vol, decay));
  }

  /** Soft woodblock-ish tick for the last seconds of a countdown */
  tick(final = false) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(final ? 1320 : 990, t);
    o.frequency.exponentialRampToValueAtTime(final ? 880 : 660, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.15);
  }

  /** Movement begins (tuck / hold / squeeze) */
  phaseIn() {
    this.play(["D5", "A5"], 0.09, 0.18, 1.2);
  }
  /** Release / return */
  phaseOut() {
    this.play(["A4", "D5"], 0.09, 0.13, 1.0);
  }
  /** New exercise announced */
  next() {
    this.play(["D5", "F#5", "A5"], 0.11, 0.17, 1.6);
  }
  switchSides() {
    this.play(["B4", "E5"], 0.14, 0.16, 1.2);
  }
  start() {
    this.play(["D4", "A4", "D5", "F#5"], 0.13, 0.17, 2);
  }
  /** Session complete - a little celebratory cascade */
  complete() {
    this.play(["D5", "F#5", "A5", "B5", "D6"], 0.11, 0.17, 2.6);
    setTimeout(() => this.play(["A4", "D5", "F#5"], 0.0, 0.1, 3.2), 650);
  }
  levelUp() {
    this.play(["A4", "D5", "E5", "F#5", "A5", "D6"], 0.08, 0.17, 2.8);
  }
  /** Clear but friendly "sit up" chime for Posture Guard nudges */
  posture() {
    this.play(["A4", "D5", "F#5", "A5"], 0.13, 0.26, 1.8);
  }

  gentle() {
    this.play(["F#5", "D5"], 0.16, 0.14, 1.6);
  }

  /** Warm, slowly breathing ambient pad (D major add9) */
  startPad() {
    this.unlock();
    if (!this.ctx || this.pad) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    filter.connect(gain);
    gain.connect(this.master!);
    gain.connect(this.reverb!);

    const nodes: AudioNode[] = [filter];
    const chord = ["D3", "A3", "F#4", "E5"];
    chord.forEach((n, i) => {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = NOTE[n];
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = i === 3 ? 0.025 : 0.06;
        o.connect(g);
        g.connect(filter);
        o.start();
        nodes.push(o, g);
      }
    });
    // slow "breathing" swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo, lfoGain);

    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
    this.pad = {
      nodes,
      gain,
      stop: () => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        setTimeout(() => {
          nodes.forEach((n) => {
            try {
              (n as OscillatorNode).stop?.();
            } catch {}
            n.disconnect();
          });
          gain.disconnect();
        }, 2000);
      },
    };
  }

  stopPad() {
    this.pad?.stop();
    this.pad = null;
  }
}

export const sound = new SoundEngine();

/* ---------------- Voice coach ---------------- */

let chosenVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (chosenVoice) return chosenVoice;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const prefs = [/natural/i, /Google UK English Female/i, /Samantha/i, /Serena/i, /Aria/i, /Jenny/i, /Libby/i, /Google US English/i];
  for (const p of prefs) {
    const v = voices.find((x) => p.test(x.name));
    if (v) return (chosenVoice = v);
  }
  return (chosenVoice = voices[0] ?? null);
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.98;
    u.pitch = 1.0;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    chosenVoice = null;
    pickVoice();
  };
}
