/**
 * WebAudio synthesis for every Sfx id. Manifest AUDIO files override the
 * synthesized sound when they load. The AudioContext is only created after the
 * first user gesture (unlock()).
 */
import { Sfx } from '../contract.js';
import { AUDIO } from '../assets.js';

export class AudioEngine {
  constructor() {
    this.ac = null; this.master = null; this.muted = false; this.buffers = new Map();
    this.loops = new Map(); this.noiseBuf = null; this.unlocked = false; this.volume = 0.5;
  }

  /** Call from a keydown/click handler. Safe to call repeatedly. */
  unlock() {
    if (this.unlocked) { if (this.ac?.state === 'suspended') this.ac.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.unlocked = true;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ac.destination);
    const len = this.ac.sampleRate * 2;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.loadFiles();
    for (const id of this.pendingLoops || []) this.startLoop(id);
    this.pendingLoops = null;
  }

  async loadFiles() {
    await Promise.all(Object.entries(AUDIO).map(async ([id, slot]) => {
      try {
        const r = await fetch(slot.src);
        if (!r.ok) return;
        const buf = await this.ac.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(id, buf);
        // swap a running synthesized loop for the real file
        if (this.loops.has(id)) { this.stopLoop(id); this.startLoop(id); }
      } catch { /* missing or undecodable: keep synthesis */ }
    }));
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ac.currentTime, 0.02);
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  /* ---- primitives ---- */
  _env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  tone(freq, dur, { type = 'square', vol = 0.2, slide = null, delay = 0, a = 0.004 } = {}) {
    const ac = this.ac; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + dur);
    this._env(g, t0, a, dur, vol);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + a + dur + 0.05);
  }
  noise(dur, { vol = 0.2, type = 'lowpass', freq = 1000, q = 0.7, delay = 0, slide = null, a = 0.003 } = {}) {
    const ac = this.ac; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    const g = ac.createGain(); this._env(g, t0, a, dur, vol);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0, Math.random()); s.stop(t0 + a + dur + 0.05);
  }

  /** Play a buffer from AUDIO overrides. */
  _file(id, vol = 1) {
    const b = this.buffers.get(id); if (!b) return false;
    const s = this.ac.createBufferSource(); s.buffer = b;
    const g = this.ac.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start();
    return true;
  }

  play(id, opt) {
    if (!this.ac || this.muted) return;
    if (this.ac.state === 'suspended') this.ac.resume();
    if (AUDIO[id]?.loop) return;                  // loops go through startLoop
    if (this._file(id)) return;
    const f = this.recipes[id]; if (f) f.call(this, opt || {});
  }

  /* ---- loops (breath, ending pad) ---- */
  startLoop(id) {
    if (!this.ac) { (this.pendingLoops ||= new Set()).add(id); return; }
    if (this.loops.has(id)) return;
    const b = this.buffers.get(id);
    const ac = this.ac; const nodes = [];
    const out = ac.createGain(); out.gain.value = 0; out.connect(this.master);
    out.gain.setTargetAtTime(1, ac.currentTime, 0.4);
    if (b) {
      const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.connect(out); s.start(); nodes.push(s);
    } else if (id === Sfx.BREATH) {
      const s = ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8;
      const g = ac.createGain(); g.gain.value = 0.0;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.23;          // slow breathing, ~14 per minute
      const lg = ac.createGain(); lg.gain.value = 0.05;
      g.gain.value = 0.055; lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(out); s.start(); lfo.start(); nodes.push(s, lfo);
    } else if (id === Sfx.ENDING) {
      [196, 246.94, 293.66, 392].forEach((fr, i) => {
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = ac.createGain(); g.gain.value = 0.05;
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
        const lg = ac.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(out); o.start(); lfo.start(); nodes.push(o, lfo);
      });
    }
    this.loops.set(id, { out, nodes });
  }
  stopLoop(id) {
    this.pendingLoops?.delete(id);
    const l = this.loops.get(id); if (!l) return;
    this.loops.delete(id);
    const t = this.ac.currentTime;
    l.out.gain.setTargetAtTime(0, t, 0.15);
    setTimeout(() => { for (const n of l.nodes) { try { n.stop(); } catch { /* already stopped */ } } l.out.disconnect(); }, 900);
  }

  /** Talk blip: one short blip per character group. */
  blip(robotSfx) {
    if (!this.ac || this.muted) return;
    if (this._file(robotSfx, 0.6)) return;
    if (robotSfx === Sfx.TALK_LRV) {
      this.tone(78 + Math.random() * 40, 0.06, { type: 'square', vol: 0.11 });
      this.noise(0.05, { type: 'bandpass', freq: 1400, vol: 0.05 });
    } else {
      this.tone(620 + Math.random() * 260, 0.05, { type: 'triangle', vol: 0.16 });
      this.tone(1240 + Math.random() * 300, 0.03, { type: 'square', vol: 0.04, delay: 0.02 });
    }
  }
}

AudioEngine.prototype.recipes = {
  [Sfx.STEP_WOOD]() { this.tone(150 + Math.random() * 20, 0.07, { type: 'sine', vol: 0.3, slide: 70 }); this.noise(0.04, { type: 'lowpass', freq: 1200, vol: 0.14 }); },
  [Sfx.STEP_SAND]() { this.noise(0.11, { type: 'bandpass', freq: 2600, q: 0.6, vol: 0.13, slide: 1400 }); this.noise(0.05, { type: 'highpass', freq: 3500, vol: 0.05, delay: 0.03 }); },
  [Sfx.STEP_SUIT]() { this.tone(64, 0.14, { type: 'sine', vol: 0.4, slide: 38 }); this.noise(0.1, { type: 'lowpass', freq: 260, vol: 0.18 }); },
  [Sfx.CONFIRM]() { this.tone(660, 0.07, { vol: 0.12 }); this.tone(990, 0.1, { vol: 0.12, delay: 0.06 }); },
  [Sfx.CANCEL]() { this.tone(520, 0.07, { vol: 0.12 }); this.tone(330, 0.1, { vol: 0.12, delay: 0.06 }); },
  [Sfx.CURSOR]() { this.tone(880, 0.035, { type: 'square', vol: 0.07 }); },
  [Sfx.SCAN]() { this.tone(180, 1.0, { type: 'sawtooth', vol: 0.09, slide: 1700 }); this.noise(1.0, { type: 'bandpass', freq: 600, vol: 0.05, slide: 3000 }); },
  [Sfx.BLUEPRINT_GET]() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.16, delay: i * 0.08 })); },
  [Sfx.STATION_COMPUTER]() { this.tone(60, 0.5, { type: 'sawtooth', vol: 0.1 }); this.tone(220, 0.45, { type: 'sine', vol: 0.1, slide: 1500 }); this.noise(0.05, { type: 'highpass', freq: 4000, vol: 0.1 }); },
  [Sfx.STATION_STARMAP]() { this.tone(1250, 0.5, { type: 'sine', vol: 0.15 }); this.tone(1250, 0.5, { type: 'sine', vol: 0.06, delay: 0.18 }); },
  [Sfx.NOTEBOOK]() { this.noise(0.12, { type: 'highpass', freq: 2200, vol: 0.12 }); this.noise(0.09, { type: 'highpass', freq: 3000, vol: 0.09, delay: 0.1 }); },
  [Sfx.PORTAL]() { this.tone(110, 0.8, { type: 'sawtooth', vol: 0.1, slide: 880 }); this.tone(113, 0.8, { type: 'sawtooth', vol: 0.08, slide: 900 }); },
  [Sfx.RETURN_PAD]() { this.tone(880, 0.7, { type: 'sawtooth', vol: 0.1, slide: 110 }); this.tone(890, 0.7, { type: 'sawtooth', vol: 0.08, slide: 112 }); },
  [Sfx.FACT]() { this.tone(740, 0.07, { type: 'square', vol: 0.1 }); this.tone(1110, 0.12, { type: 'square', vol: 0.1, delay: 0.07 }); },
  [Sfx.HEADLAMP]() { this.noise(0.02, { type: 'highpass', freq: 3000, vol: 0.2 }); this.tone(1900, 0.02, { type: 'square', vol: 0.06 }); },
  [Sfx.SIGNAL_TICK]() { this.tone(540, 0.03, { type: 'square', vol: 0.06 }); },
  [Sfx.SIGNAL_DONE]() { this.tone(880, 0.08, { type: 'triangle', vol: 0.14 }); this.tone(1320, 0.14, { type: 'triangle', vol: 0.14, delay: 0.09 }); },
  [Sfx.PROP_OPEN]() { this.tone(300, 0.1, { type: 'triangle', vol: 0.12, slide: 700 }); },
  [Sfx.PROP_ACTION]() { this.noise(0.02, { type: 'highpass', freq: 2500, vol: 0.16 }); this.tone(420, 0.05, { type: 'square', vol: 0.08 }); },
  [Sfx.PAUSE]() { this.tone(440, 0.09, { type: 'triangle', vol: 0.12 }); this.tone(330, 0.12, { type: 'triangle', vol: 0.12, delay: 0.08 }); },
};
