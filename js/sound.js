const Sound = {
  enabled: true,
  ctx: null,
  heartNextAt: 0,

  init() {
    this.enabled = localStorage.getItem('tebakkata.sound') !== 'off';
    document.addEventListener('pointerdown', () => this.resume(), { once: true });
    ['sound-toggle', 'play-sound'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onclick = () => this.toggle();
    });
    this.updateLabels();
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('tebakkata.sound', this.enabled ? 'on' : 'off');
    if (!this.enabled) this.heartStop();
    this.updateLabels();
  },

  updateLabels() {
    const text = this.enabled ? 'Suara: On' : 'Suara: Off';
    ['sound-toggle', 'play-sound'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  },

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const w = typeof window !== 'undefined' ? window : null;
      const AC = (w && (w.AudioContext || w.webkitAudioContext)) ||
        (typeof AudioContext !== 'undefined' ? AudioContext : null);
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    return this.ctx;
  },

  wordReveal() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.12);
    bp.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.06, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.13);
  },

  nextSound() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;

    const sweep = ctx.createOscillator();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(440, t);
    sweep.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    sweep.connect(sg);
    sg.connect(ctx.destination);
    sweep.start(t);
    sweep.stop(t + 0.18);

    const ding = ctx.createOscillator();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(987.77, t + 0.09);
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.0001, t + 0.09);
    dg.gain.exponentialRampToValueAtTime(0.28, t + 0.11);
    dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    ding.connect(dg);
    dg.connect(ctx.destination);
    ding.start(t + 0.09);
    ding.stop(t + 0.45);
  },

  pasSound() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  },

  heartInterval(remain) {
    if (remain > 10000) return 1100;
    if (remain > 5000) return 800;
    if (remain > 3000) return 550;
    if (remain > 1500) return 380;
    return 240;
  },

  heartGain(remain) {
    if (remain > 10000) return 0.24;
    if (remain > 3000) return 0.45;
    return 0.55;
  },

  heartTick(remain) {
    if (!this.enabled) { this.heartStop(); return; }
    const ctx = this.ensure();
    if (!ctx) return;
    const now = Date.now();
    const interval = this.heartInterval(remain);
    if (!this.heartNextAt) {
      this.thump(ctx, this.heartGain(remain));
      this.heartNextAt = now + interval;
      return;
    }
    if (now >= this.heartNextAt) {
      this.thump(ctx, this.heartGain(remain));
      this.heartNextAt = now + interval;
    }
  },

  thump(ctx, peak) {
    const t = ctx.currentTime;
    const beat = (delay, dur, from, to, gain) => {
      const s = t + delay;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, s);
      osc.frequency.exponentialRampToValueAtTime(to, s + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(gain, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(s);
      osc.stop(s + dur + 0.02);
    };
    beat(0, 0.14, 75, 55, peak);
    beat(0.17, 0.12, 62, 48, peak * 0.7);
  },

  heartStop() {
    this.heartNextAt = 0;
  },

  endSound(reason) {
    this.heartStop();
    if (!this.enabled || reason === 'exit') return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (reason === 'time') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.7);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    } else if (reason === 'words') {
      const note = (freq, at, dur, gain) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + dur + 0.02);
      };
      note(523.25, t, 0.2, 0.25);
      note(783.99, t + 0.18, 0.4, 0.25);
    }
  }
};
