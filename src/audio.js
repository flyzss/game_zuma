// WebAudio 合成音效 + 生成式背景音乐（五声音阶，连锁越高音越高）
import { CFG } from './config.js';

let ctx = null;
let master = null;
let musicBus = null;
let muted = false;

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0, attack = 0.004, dest = null) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur, vol = 0.15, freq = 2000, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// ---------------- 背景音乐 ----------------
// 低音铺底和弦 + 随机游走的五声拨弦；紧张度越高越快、越密
const CHORDS = [[130.81, 196.0], [110.0, 164.81], [87.31, 130.81], [98.0, 146.83]];
const PLUCK = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

export const music = {
  started: false,
  intensity: 0,
  step: 0,
  nextT: 0,
  walk: 4,
  timer: 0,
  start() {
    if (this.started || !ctx) return;
    this.started = true;
    this.nextT = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  },
  setIntensity(v) {
    this.intensity += (v - this.intensity) * 0.05;
    if (musicBus) musicBus.gain.value = CFG.musicVol * 0.55;
  },
  schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const I = this.intensity;
    const half = (0.62 - I * 0.24) / 2;   // 八分音符时长
    while (this.nextT < ctx.currentTime + 0.15) {
      const t = this.nextT - ctx.currentTime;
      const st = this.step;
      if (st % 16 === 0) {
        const ch = CHORDS[(st / 16) % CHORDS.length];
        for (const f of ch) tone(f, half * 16 + 0.6, 'sine', 0.05, 0, t, 0.8, musicBus);
        tone(ch[0] / 2, half * 16, 'triangle', 0.035, 0, t, 0.4, musicBus);
      }
      if (I > 0.35 && st % 4 === 0) {
        const ch = CHORDS[Math.floor(st / 16) % CHORDS.length];
        tone(ch[0] / 2, 0.22, 'sine', 0.09 * I, ch[0] / 3, t, 0.005, musicBus);
      }
      if (Math.random() < 0.3 + I * 0.4) {
        this.walk = Math.max(0, Math.min(PLUCK.length - 1, this.walk + ((Math.random() * 5) | 0) - 2));
        tone(PLUCK[this.walk], 0.5, 'triangle', 0.045, 0, t, 0.004, musicBus);
        tone(PLUCK[this.walk] * 2, 0.2, 'sine', 0.012, 0, t, 0.004, musicBus);
      }
      this.step++;
      this.nextT += half;
    }
  },
};

export const sfx = {
  unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = CFG.musicVol * 0.55;
      musicBus.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    music.start();
  },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
  },
  shoot() { tone(420, 0.09, 'triangle', 0.16, 240); noise(0.06, 0.05, 3000); },
  insert() { tone(1200, 0.04, 'sine', 0.08); noise(0.03, 0.08, 4500); },
  swap() { tone(700, 0.07, 'sine', 0.12, 1000); },
  clack() { tone(260, 0.07, 'square', 0.05, 150); noise(0.05, 0.12, 1800); },
  tick() { tone(1568, 0.06, 'sine', 0.06); },
  // 单颗珠子爆开：短促的"啵"，k 越大音越高（连成一串就是上行音阶）
  pop(k) {
    const f = PENTA[Math.min(k, 9)] * (k > 9 ? 1 + (k - 9) * 0.03 : 1) * 0.5;
    tone(f * 1.6, 0.09, 'sine', 0.16, f * 0.8);
    tone(f * 3.2, 0.05, 'triangle', 0.04, 0, 0.004);
    noise(0.035, 0.09, 3200 + k * 150);
  },
  match(level) {
    const i = Math.min(level, PENTA.length - 1);
    const f = PENTA[i];
    tone(f, 0.45, 'sine', 0.22);
    tone(f * 2, 0.3, 'triangle', 0.07, 0, 0.01);
    tone(PENTA[Math.min(i + 2, PENTA.length - 1)], 0.35, 'sine', 0.1, 0, 0.07);
    noise(0.12, 0.1, 6000);
  },
  boom() { noise(0.5, 0.5, 300); noise(0.25, 0.25, 1200); tone(140, 0.45, 'sine', 0.45, 40); },
  blast() { noise(0.3, 0.3, 500); tone(180, 0.25, 'sine', 0.25, 60); },
  zap() { noise(0.3, 0.25, 5000); tone(1800, 0.25, 'sawtooth', 0.06, 300); tone(900, 0.2, 'square', 0.05, 2400, 0.05); },
  slow() { tone(880, 0.6, 'sine', 0.16, 330); tone(660, 0.6, 'triangle', 0.06, 250, 0.08); },
  reverse() { tone(300, 0.5, 'sine', 0.16, 900); noise(0.4, 0.08, 800); },
  rainbow() { [4, 5, 6, 7, 8, 9].forEach((n, k) => tone(PENTA[n], 0.3, 'sine', 0.1, 0, k * 0.05)); },
  powerAppear() { tone(1568, 0.25, 'sine', 0.07); tone(2093, 0.3, 'sine', 0.05, 0, 0.08); },
  fever() {
    noise(0.8, 0.3, 900);
    tone(220, 0.9, 'sawtooth', 0.08, 880);
    [0, 2, 4, 5, 7, 9].forEach((n, k) => tone(PENTA[n], 0.5, 'triangle', 0.14, 0, 0.15 + k * 0.06));
  },
  roar() {
    noise(0.9, 0.45, 220);
    tone(110, 0.9, 'sawtooth', 0.14, 55);
    tone(82, 0.9, 'square', 0.06, 41, 0.05);
  },
  bossWarn() { tone(196, 0.25, 'square', 0.07, 0); tone(196, 0.25, 'square', 0.07, 0, 0.3); },
  ink() { noise(0.2, 0.2, 700); tone(320, 0.2, 'sine', 0.1, 120); },
  splat() { noise(0.12, 0.18, 1100); },
  bossHit(big) {
    tone(big ? 160 : 240, big ? 0.3 : 0.12, 'sine', big ? 0.35 : 0.1, big ? 60 : 140);
    noise(big ? 0.25 : 0.06, big ? 0.3 : 0.08, big ? 900 : 2500);
  },
  bossDie() {
    noise(1.4, 0.5, 260);
    tone(220, 1.2, 'sawtooth', 0.12, 40);
    [0, 2, 4, 5, 7, 9].forEach((n, k) => tone(PENTA[n], 0.6, 'triangle', 0.14, 0, 0.6 + k * 0.1));
  },
  heart() { tone(80, 0.16, 'sine', 0.4, 50); tone(72, 0.16, 'sine', 0.3, 45, 0.2); },
  win() { [0, 2, 4, 5, 7].forEach((n, k) => tone(PENTA[n], 0.5, 'sine', 0.18, 0, k * 0.11)); },
  lose() { [6, 4, 2, 0].forEach((n, k) => tone(PENTA[n] / 2, 0.6, 'triangle', 0.16, 0, k * 0.18)); },
  star(k) { tone(PENTA[4 + k * 2], 0.5, 'sine', 0.2); tone(PENTA[6 + k], 0.4, 'triangle', 0.08, 0, 0.04); noise(0.1, 0.08, 7000); },
};
