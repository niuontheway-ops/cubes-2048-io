'use strict';
/* ============================================================
 * 音效引擎 - WebAudio 实时合成(无外部音频文件)
 * 说明：原版游戏音频文件无法直接复制，这里按原版音效风格
 * (吃块轻响、合并升调、死亡下滑、加速轰鸣等)用振荡器+噪声实时合成
 * ============================================================ */
const SND = {
  ctx: null, master: null, sfxG: null, musG: null,
  ready: false, boostOsc: null, boostGain: null,
  musicTimer: null, musicStep: 0, musicNext: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = G.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxG = this.ctx.createGain();
    this.sfxG.gain.value = 0.85;
    this.sfxG.connect(this.master);
    this.musG = this.ctx.createGain();
    this.musG.gain.value = G.musicOn ? 0.30 : 0;
    this.musG.connect(this.master);
    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  t() { return this.ctx ? this.ctx.currentTime : 0; },

  // 基础音：可滑音的正弦/方波等
  tone(o) {
    if (!this.ready || G.muted) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + o.dur);
    const g = c.createGain();
    const vol = (o.vol || 0.25);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(this.sfxG);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  },
  // 基础噪声：可扫频
  noise(o) {
    if (!this.ready || G.muted) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
    const dur = o.dur || 0.2;
    const buf = this._noiseBuf();
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 800, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const vol = o.vol || 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxG);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  _noiseBuf() {
    if (this._nb) return this._nb;
    const c = this.ctx;
    const len = c.sampleRate * 1.2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = buf;
    return buf;
  },

  /* ---------- 具体音效 ---------- */
  eat(v) { // 吃到小数字块
    const f = 480 + tier(v) * 85;
    this.tone({ freq: f, freq2: f * 1.4, dur: 0.07, type: 'sine', vol: 0.20 });
  },
  merge(v) { // 合并：随层级升调的清脆双音
    const step = clamp(tier(v), 1, 9) / 9;
    const f = 210 * Math.pow(2, step * 1.35);
    this.tone({ freq: f, dur: 0.11, type: 'triangle', vol: 0.30 });
    this.tone({ freq: f * 1.5, dur: 0.16, type: 'sine', vol: 0.22, delay: 0.055 });
  },
  absorb() { // 吞掉别人一个块
    this.noise({ dur: 0.09, f0: 1200, f1: 300, vol: 0.22, q: 0.8 });
    this.tone({ freq: 160, freq2: 90, dur: 0.1, type: 'square', vol: 0.12 });
  },
  devour() { // 整条吞掉对手
    this.noise({ dur: 0.3, f0: 2400, f1: 200, vol: 0.3, q: 0.6 });
    this.tone({ freq: 300, freq2: 70, dur: 0.35, type: 'sawtooth', vol: 0.18 });
  },
  death() {
    this.noise({ dur: 0.5, f0: 900, f1: 80, vol: 0.3, q: 0.5 });
    this.tone({ freq: 420, freq2: 55, dur: 0.55, type: 'sawtooth', vol: 0.22 });
  },
  boostStart() {
    if (!this.ready || G.muted) return;
    this.boostStop();
    const c = this.ctx;
    this.boostOsc = c.createOscillator();
    this.boostOsc.type = 'sawtooth';
    this.boostOsc.frequency.value = 62;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2;
    this.boostGain = c.createGain();
    this.boostGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.boostGain.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 0.08);
    this.boostOsc.connect(f); f.connect(this.boostGain); this.boostGain.connect(this.sfxG);
    this.boostOsc.start();
  },
  boostStop() {
    if (!this.boostOsc) return;
    try {
      const c = this.ctx, t = c.currentTime;
      this.boostGain.gain.cancelScheduledValues(t);
      this.boostGain.gain.setValueAtTime(this.boostGain.gain.value, t);
      this.boostGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      this.boostOsc.stop(t + 0.2);
    } catch (e) { /* ignore */ }
    this.boostOsc = null; this.boostGain = null;
  },
  dash() {
    this.noise({ dur: 0.26, f0: 300, f1: 3400, vol: 0.28, q: 0.9, filter: 'bandpass' });
    this.tone({ freq: 900, freq2: 240, dur: 0.2, type: 'sine', vol: 0.12 });
  },
  ghostOn() {
    this.tone({ freq: 760, freq2: 220, dur: 0.4, type: 'sine', vol: 0.2 });
    this.tone({ freq: 1140, freq2: 330, dur: 0.45, type: 'triangle', vol: 0.12, delay: 0.05 });
  },
  ghostOff() {
    this.tone({ freq: 220, freq2: 760, dur: 0.3, type: 'sine', vol: 0.16 });
  },
  burnThrow() {
    this.noise({ dur: 0.3, f0: 500, f1: 2600, vol: 0.2, q: 0.7 });
  },
  burnHit() {
    this.noise({ dur: 0.45, f0: 2400, f1: 120, vol: 0.34, q: 0.4, filter: 'lowpass' });
    this.tone({ freq: 120, freq2: 40, dur: 0.4, type: 'sine', vol: 0.3 });
    this.noise({ dur: 0.2, f0: 600, f1: 3000, vol: 0.14, q: 1.2 });
  },
  zap() { // ÷ 陷阱
    this.tone({ freq: 1300, freq2: 90, dur: 0.22, type: 'square', vol: 0.2 });
    this.noise({ dur: 0.16, f0: 3000, f1: 400, vol: 0.2, q: 1 });
  },
  skillGet() {
    this.tone({ freq: 523, dur: 0.09, type: 'triangle', vol: 0.22 });
    this.tone({ freq: 659, dur: 0.09, type: 'triangle', vol: 0.22, delay: 0.07 });
    this.tone({ freq: 784, dur: 0.14, type: 'triangle', vol: 0.24, delay: 0.14 });
  },
  orbGet() {
    this.tone({ freq: 880, freq2: 1320, dur: 0.14, type: 'sine', vol: 0.22 });
  },
  uiClick() { this.tone({ freq: 920, dur: 0.04, type: 'square', vol: 0.12 }); },
  tick() { this.tone({ freq: 620, dur: 0.09, type: 'square', vol: 0.18 }); },
  go() { this.tone({ freq: 880, dur: 0.16, type: 'square', vol: 0.22 }); },
  win() {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.26, delay: i * 0.13 }));
  },

  /* ---------- 背景音乐：轻柔氛围垫 + 随机铃音 ---------- */
  startMusic() {
    if (!this.ready || this.musicTimer) return;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this._musicSched(), 250);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
  _musicSched() {
    if (!this.ready) return;
    const c = this.ctx;
    while (this.musicNext < c.currentTime + 1.0) {
      const t = this.musicNext;
      const chords = [
        [220.00, 261.63, 329.63],
        [174.61, 220.00, 261.63],
        [196.00, 246.94, 293.66],
        [164.81, 196.00, 246.94],
      ];
      const ch = chords[this.musicStep % chords.length];
      ch.forEach((f) => {
        const o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.9);
        o.connect(g); g.connect(this.musG);
        o.start(t); o.stop(t + 4.0);
      });
      // 稀疏铃音(五声音阶)
      if (Math.random() < 0.75) {
        const penta = [523.25, 587.33, 659.25, 783.99, 880.00];
        const f = pick(penta);
        const o = c.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = c.createGain();
        const tt = t + rand(0.4, 3.2);
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.045, tt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
        o.connect(g); g.connect(this.musG);
        o.start(tt); o.stop(tt + 1.5);
      }
      this.musicStep++;
      this.musicNext += 4.0;
    }
  },
  setMute(m) {
    G.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
    if (m) this.boostStop();
  },
  setMusic(on) {
    G.musicOn = on;
    if (this.musG) this.musG.gain.value = on ? 0.30 : 0;
  },
};
