// All sounds are synthesised with WebAudio: no audio files needed.

import { settings } from './util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicStops = new Set();
  }

  /** Must be called from a user gesture (first tap) to unlock audio. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = settings.muted ? 0 : 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    settings.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx && !settings.muted;
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, when = 0, slide = null, attack = 0.01, vibrato = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 18;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, { when = 0, vol = 0.2, freq = 1200, q = 1, sweepTo = null, type = 'bandpass' } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  tap() {
    this.tone(660, 0.08, { type: 'triangle', vol: 0.15 });
  }

  pop() {
    this.tone(420, 0.18, { slide: 980, vol: 0.35 });
    this.tone(1300, 0.12, { type: 'triangle', vol: 0.08, when: 0.08 });
  }

  unpop() {
    this.tone(900, 0.22, { slide: 300, vol: 0.3 });
  }

  boing() {
    this.tone(180, 0.35, { slide: 420, vol: 0.3, vibrato: 25, type: 'triangle' });
  }

  whoosh() {
    this.noise(0.6, { freq: 300, sweepTo: 3000, q: 2, vol: 0.35 });
    [0, 0.08, 0.16, 0.24, 0.32].forEach((w, i) => this.tone(NOTE(72 + i * 2), 0.12, { type: 'triangle', vol: 0.12, when: 0.3 + w * 0.6 }));
  }

  giggle() {
    const base = 620 + Math.random() * 80;
    for (let i = 0; i < 6; i++) {
      const f = base * (1.15 - i * 0.05);
      this.tone(f, 0.11, { type: 'triangle', vol: 0.22, when: i * 0.13, slide: f * 0.78, vibrato: 30 });
      this.tone(f * 2.01, 0.09, { type: 'sine', vol: 0.05, when: i * 0.13 });
    }
  }

  hmm() {
    this.tone(330, 0.25, { type: 'triangle', vol: 0.2, slide: 400, vibrato: 8 });
    this.tone(400, 0.3, { type: 'triangle', vol: 0.2, slide: 300, when: 0.25, vibrato: 8 });
  }

  chime() {
    [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.5, { type: 'sine', vol: 0.18, when: i * 0.09 }));
  }

  hearts() {
    [76, 79, 83, 88, 91].forEach((n, i) => {
      this.tone(NOTE(n), 0.6, { type: 'sine', vol: 0.18, when: i * 0.1 });
      this.tone(NOTE(n + 12), 0.3, { type: 'triangle', vol: 0.05, when: i * 0.1 });
    });
  }

  shutter() {
    this.noise(0.08, { freq: 4000, q: 0.7, vol: 0.4, type: 'highpass' });
    this.noise(0.12, { freq: 2500, q: 0.7, vol: 0.3, when: 0.09, type: 'highpass' });
  }

  applause(duration = 1.8) {
    if (!this.ready) return;
    for (let i = 0; i < 26; i++) {
      this.noise(0.05, { when: Math.random() * duration, freq: 1500 + Math.random() * 1500, q: 1.5, vol: 0.18 + Math.random() * 0.1 });
    }
    this.tone(NOTE(84), 0.4, { type: 'triangle', vol: 0.06, when: 0.1, vibrato: 40 });
  }

  /** Bouncy little tune. Returns a stop function. */
  music(beats = 16, bpm = 132) {
    if (!this.ready) return () => {};
    const melody = [72, 76, 79, 76, 77, 81, 79, 76, 74, 77, 81, 77, 76, 72, 79, 84];
    const bass = [48, 48, 53, 53, 55, 55, 48, 48];
    const beat = 60 / bpm / 2;
    const nodes = [];
    const t0 = this.ctx.currentTime + 0.05;
    for (let i = 0; i < beats * 2; i++) {
      const t = t0 + i * beat;
      const mk = (freq, dur, type, vol) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        nodes.push(osc);
      };
      mk(NOTE(melody[i % melody.length]), beat * 0.9, 'triangle', 0.13);
      if (i % 2 === 0) mk(NOTE(bass[(i / 2) % bass.length]), beat * 1.6, 'sine', 0.2);
      if (i % 4 === 2) {
        this.noise(0.05, { when: t - this.ctx.currentTime, freq: 6000, type: 'highpass', vol: 0.06 });
      }
    }
    const stop = () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      this.musicStops.delete(stop);
    };
    this.musicStops.add(stop);
    return stop;
  }

  stopMusic() {
    for (const stop of [...this.musicStops]) stop();
  }
}
