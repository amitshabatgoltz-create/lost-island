// All sound is synthesized live with the Web Audio API — no audio files needed.
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.ambientOn = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.master);
    this.cabin = this.ctx.createGain();
    this.cabin.gain.value = 0;
    this.cabin.connect(this.master);
    this.noiseBuf = this.makeNoise(4);
    this.brownBuf = this.makeNoise(4, true);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  makeNoise(seconds, brown = false) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  noiseSource(brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brownBuf : this.noiseBuf;
    s.loop = true;
    return s;
  }

  // ------------------------------------------------------------ island ambience
  startAmbience() {
    if (!this.ctx || this.ambientOn) return;
    this.ambientOn = true;
    const c = this.ctx;
    // waves: low-passed noise with slow swells
    const w = this.noiseSource();
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520;
    this.waveGain = c.createGain(); this.waveGain.gain.value = 0.3;
    w.connect(wf).connect(this.waveGain).connect(this.amb);
    w.start();
    // wind: band-passed noise with wandering frequency
    const wn = this.noiseSource();
    this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 600; this.windFilter.Q.value = 0.8;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.06;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.amb);
    wn.start();
    this.amb.gain.setTargetAtTime(1, c.currentTime, 1.5);
    this.nextBird = c.currentTime + 2;
  }

  stopAmbience() {
    if (this.amb) this.amb.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }
  resumeAmbience() {
    if (this.amb && this.ambientOn) this.amb.gain.setTargetAtTime(1, this.ctx.currentTime, 0.6);
  }

  // called every frame with how close the player is to the shoreline/forest (0..1)
  updateAmbience(t, nearSea, nearForest, night = 0, nearStream = 0) {
    if (!this.ctx || !this.ambientOn) return;
    const c = this.ctx, now = c.currentTime;
    this.updateNight(t, night, nearStream);
    if (night > 0.5) nearForest *= 0.25; // birds mostly sleep at night
    const swell = 0.55 + 0.45 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1);
    this.waveGain.gain.setTargetAtTime((nearSea > 0 ? 0.08 + nearSea * 0.42 : 0.012) * swell, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(450 + Math.sin(t * 0.13) * 220 + Math.sin(t * 0.71) * 80, now, 0.5);
    this.windGain.gain.setTargetAtTime(0.04 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.09)), now, 0.5);
    if (now > this.nextBird) {
      this.bird(0.03 + nearForest * 0.06);
      this.nextBird = now + 1.5 + Math.random() * (6 - nearForest * 4);
    }
  }

  bird(vol) {
    const c = this.ctx, now = c.currentTime;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1800;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    const out = c.createGain(); out.gain.value = vol;
    if (pan) { pan.pan.value = Math.random() * 2 - 1; out.connect(pan).connect(this.amb); } else out.connect(this.amb);
    for (let i = 0; i < notes; i++) {
      const o = c.createOscillator(); const g = c.createGain();
      const t0 = now + i * (0.09 + Math.random() * 0.06);
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), t0 + 0.06);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      o.connect(g).connect(out);
      o.start(t0); o.stop(t0 + 0.1);
    }
  }

  // ------------------------------------------------------------ cabin (intro)
  startCabin() {
    if (!this.ctx) return;
    const c = this.ctx;
    const n = this.noiseSource(true);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280;
    const g = c.createGain(); g.gain.value = 0.5;
    n.connect(f).connect(g).connect(this.cabin);
    n.start();
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 72;
    const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 160;
    const og = c.createGain(); og.gain.value = 0.05;
    o.connect(of).connect(og).connect(this.cabin);
    o.start();
    this.cabinNodes = [n, o];
    this.cabinRumble = g;
    this.cabin.gain.cancelScheduledValues(c.currentTime);
    this.cabin.gain.setValueAtTime(0, c.currentTime);
    this.cabin.gain.linearRampToValueAtTime(0.9, c.currentTime + 2);
  }

  cabinIntensity(k) {
    if (this.cabinRumble) this.cabinRumble.gain.setTargetAtTime(0.5 + k * 1.4, this.ctx.currentTime, 0.1);
  }

  stopCabin(fast = false) {
    if (!this.ctx || !this.cabinNodes) return;
    const now = this.ctx.currentTime;
    this.cabin.gain.cancelScheduledValues(now);
    this.cabin.gain.setTargetAtTime(0, now, fast ? 0.02 : 0.3);
    const nodes = this.cabinNodes;
    this.cabinNodes = null;
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }), 1500);
  }

  // ------------------------------------------------------------ one-shots
  tone(freq, dur, vol = 0.2, type = 'sine', when = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + when;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noiseBurst(dur, vol, filterType = 'lowpass', freq = 1000, when = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05);
  }

  chime() { this.tone(988, 1.2, 0.18, 'sine'); this.tone(784, 1.6, 0.18, 'sine', 0.55); }
  seatbelt() { this.tone(1318, 0.6, 0.12); }
  pickup() { this.tone(660, 0.25, 0.14, 'triangle'); this.tone(990, 0.35, 0.12, 'triangle', 0.08); }
  page() { this.noiseBurst(0.18, 0.18, 'highpass', 2500); }
  deny() { this.tone(220, 0.25, 0.12, 'square'); }
  latch() { this.tone(300, 0.06, 0.2, 'square'); this.tone(240, 0.08, 0.2, 'square', 0.12); this.noiseBurst(0.4, 0.12, 'bandpass', 900, 0.2); }
  quest() { this.tone(523, 0.4, 0.1, 'sine'); this.tone(659, 0.4, 0.1, 'sine', 0.12); this.tone(784, 0.7, 0.1, 'sine', 0.24); }
  click() { this.tone(1200, 0.05, 0.06, 'square'); }
  flashlight() { this.tone(1800, 0.03, 0.1, 'square'); }

  thump(vol = 0.6) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(30, t0 + 0.5);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    o.connect(g).connect(this.sfx);
    o.start(t0); o.stop(t0 + 0.8);
    this.noiseBurst(0.5, vol * 0.5, 'lowpass', 400);
  }

  alarm(duration = 4) {
    for (let i = 0; i < duration / 0.5; i++) this.tone(880, 0.22, 0.07, 'square', i * 0.5);
  }

  radio(duration) { this.noiseBurst(duration, 0.05, 'bandpass', 1800); }

  crash() {
    this.thump(1.0);
    this.noiseBurst(2.6, 0.9, 'lowpass', 1800);
    for (let i = 0; i < 6; i++) this.tone(150 + Math.random() * 500, 0.8 + Math.random(), 0.12, 'sawtooth', Math.random() * 0.6);
  }

  tinnitus(dur = 5) { this.tone(4200, dur, 0.05, 'sine'); }

  reveal() {
    this.thump(0.9);
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    [55, 82.4, 110.5].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 1.5 + i * 0.3); g.gain.linearRampToValueAtTime(0, t0 + 8);
      o.connect(lp).connect(g).connect(this.sfx);
      o.start(t0); o.stop(t0 + 8.2);
    });
  }

  signalBeeps() {
    for (let i = 0; i < 3; i++) { this.tone(1046, 0.12, 0.05, 'sine', i * 0.35); }
    this.radio(1.2);
  }

  speak(text, { pitch = 0.75, rate = 0.95 } = {}) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, this.volume * 0.9);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }
  stopSpeech() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* optional */ } }

  // ------------------------------------------------------------ positional audio (Part 2)
  updateListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    const p = camera.position;
    const f = (this._fwd ||= camera.position.clone());
    camera.getWorldDirection(f);
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.05); l.positionY.setTargetAtTime(p.y, t, 0.05); l.positionZ.setTargetAtTime(p.z, t, 0.05);
      l.forwardX.setTargetAtTime(f.x, t, 0.05); l.forwardY.setTargetAtTime(f.y, t, 0.05); l.forwardZ.setTargetAtTime(f.z, t, 0.05);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  // a short-lived panner at a world position; sounds connected to it fade with distance
  at(pos, { ref = 4, max = 120, life = 6 } = {}) {
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.sfx);
    setTimeout(() => { try { p.disconnect(); } catch (e) { /* already gone */ } }, life * 1000);
    return p;
  }

  branchSnap(pos) {
    if (!this.ctx) return;
    const d = this.at(pos, { ref: 6 });
    this.noiseBurst(0.06, 0.9, 'highpass', 1800, 0, d);
    this.noiseBurst(0.12, 0.5, 'bandpass', 700, 0.05, d);
    this.noiseBurst(0.3, 0.25, 'lowpass', 500, 0.12, d);
  }

  footstepsRun(a, b, dur) {
    if (!this.ctx) return;
    const n = Math.round(dur / 0.16);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const pos = { x: a.x + (b.x - a.x) * k, y: (a.y || 0) + 0.2, z: a.z + (b.z - a.z) * k };
      const d = this.at(pos, { ref: 5, life: dur + 1 });
      this.noiseBurst(0.09, 0.55, 'lowpass', 420, i * 0.16, d);
      this.noiseBurst(0.05, 0.25, 'highpass', 2500, i * 0.16 + 0.01, d);
    }
  }

  distantNoise(pos) {
    if (!this.ctx) return;
    const kind = Math.floor(Math.random() * 3);
    const d = this.at(pos, { ref: 8, life: 4 });
    if (kind === 0) { this.branchSnap(pos); return; }
    if (kind === 1) { // low two-note call
      this.tone(320, 0.5, 0.18, 'sine', 0, d); this.tone(270, 0.7, 0.16, 'sine', 0.55, d);
      return;
    }
    // heavy thud, as if something dropped
    const c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(28, t0 + 0.6);
    g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    o.connect(g).connect(d); o.start(t0); o.stop(t0 + 0.8);
  }

  radioAt(pos, dur) {
    if (!this.ctx) return;
    const d = this.at(pos, { ref: 3, life: dur + 1 });
    this.noiseBurst(dur, 0.28, 'bandpass', 1700, 0, d);
    for (let i = 0; i < dur * 3; i++) this.tone(600 + Math.random() * 500, 0.08, 0.05, 'square', Math.random() * dur, d);
  }

  powerUp() {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain();
    o.frequency.setValueAtTime(45, t0); o.frequency.exponentialRampToValueAtTime(220, t0 + 1.6);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.4); g.gain.linearRampToValueAtTime(0.05, t0 + 1.6); g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);
    o.connect(lp).connect(g).connect(this.sfx); o.start(t0); o.stop(t0 + 3.3);
    [0.2, 0.55, 0.9].forEach((w) => { this.tone(1400, 0.04, 0.15, 'square', w); this.noiseBurst(0.05, 0.3, 'highpass', 3000, w); });
    this.tone(880, 0.15, 0.08, 'sine', 1.4); this.tone(1320, 0.2, 0.08, 'sine', 1.55);
  }

  unlock() { this.tone(988, 0.08, 0.12, 'square'); this.tone(1318, 0.12, 0.12, 'square', 0.1); this.latch(); }

  spark() { this.noiseBurst(0.35, 0.6, 'highpass', 2000); this.tone(90, 0.4, 0.2, 'sawtooth'); this.thump(0.35); }

  sting() {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    [146.8, 155.6, 220].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
      o.connect(lp).connect(g).connect(this.sfx); o.start(t0); o.stop(t0 + 2.3);
    });
  }

  lightOn(i) {
    this.tone(70 + i * 4, 0.35, 0.22, 'sine');
    this.noiseBurst(0.12, 0.18, 'lowpass', 300);
    this.tone(440 + i * 30, 0.6, 0.03, 'sine', 0.05);
  }

  // night insects + frogs near water; gain follows the zone
  startNight() {
    if (!this.ctx || this.night) return;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.amb);
    const n = this.noiseSource();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
    const trem = c.createGain(); trem.gain.value = 0.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 18;
    const lfoG = c.createGain(); lfoG.gain.value = 0.45;
    lfo.connect(lfoG).connect(trem.gain);
    n.connect(bp).connect(trem).connect(out);
    n.start(); lfo.start();
    const n2 = this.noiseSource();
    const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 3300; bp2.Q.value = 9;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    n2.connect(bp2).connect(g2).connect(out); n2.start();
    this.night = { out, nextFrog: 0, nextCall: c.currentTime + 6 };
  }

  updateNight(t, night, nearStream) {
    if (night > 0) this.startNight();
    if (!this.night) return;
    const c = this.ctx, now = c.currentTime;
    this.night.out.gain.setTargetAtTime(night * (0.07 + 0.03 * Math.sin(t * 0.3)), now, 0.4);
    if (night <= 0) return;
    if (nearStream > 0.05 && now > this.night.nextFrog) {
      const f = 380 + Math.random() * 160;
      for (let i = 0; i < 3; i++) this.tone(f, 0.05, 0.06 * nearStream, 'square', i * 0.07, this.amb);
      this.night.nextFrog = now + 0.6 + Math.random() * 1.8;
    }
    if (now > this.night.nextCall) {
      this.tone(410, 0.35, 0.03 * night, 'sine', 0, this.amb);
      this.tone(360, 0.5, 0.03 * night, 'sine', 0.45, this.amb);
      this.night.nextCall = now + 9 + Math.random() * 14;
    }
  }

  // tuning the transmitter: static fades as the signal grows, a voice-like carrier rises out of it
  startTuning() {
    if (!this.ctx) return { set() {}, stop() {} };
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.sfx);
    const n = this.noiseSource();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.7;
    const ng = c.createGain(); ng.gain.value = 0.25;
    n.connect(bp).connect(ng).connect(out); n.start();
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const og = c.createGain(); og.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
    const lfoG = c.createGain(); lfoG.gain.value = 40;
    lfo.connect(lfoG).connect(o.frequency);
    o.connect(lp).connect(og).connect(out); o.start(); lfo.start();
    out.gain.setTargetAtTime(1, c.currentTime, 0.1);
    return {
      set(sig) {
        const t = c.currentTime;
        ng.gain.setTargetAtTime(0.03 + 0.24 * (1 - sig), t, 0.05);
        og.gain.setTargetAtTime(0.09 * sig * sig, t, 0.05);
      },
      stop() {
        out.gain.setTargetAtTime(0, c.currentTime, 0.08);
        setTimeout(() => { try { n.stop(); o.stop(); lfo.stop(); } catch (e) { /* stopped */ } }, 600);
      },
    };
  }
}
