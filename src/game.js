import { Path } from './path.js';
import { LEVELS, ENDLESS, ENDLESS_STAGE, endlessStage, NIGHT_DEPTHS } from './levels.js';
import { COLORS, TEX, RAINBOW, POWERS } from './textures.js';
import { FX } from './fx.js';
import { sfx, music } from './audio.js';
import { CFG } from './config.js';
import { TAL, rollTalismans, prismEvery, COMBO_TIERS, comboTier, choiceStage, CURSE_SPEED, CURSE_SCORE } from './perks.js';
import { DAILY, dailyLevel } from './daily.js';

// 固定参数（改了会影响关卡布局，不放进调参面板）
// 触屏设备：珠子放大约 40%，同时按比例减少珠子数量，让珠串总长与关卡节奏保持不变
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const BASE_D = 46;
const D = IS_TOUCH ? 64 : BASE_D; // 珠子直径（世界坐标）
const R = D / 2;
const COUNT_K = BASE_D / D;
const SWAP_PX = 46;          // 触屏轻点主角交换的最小判定半径（屏幕像素）
// 震动反馈（安卓浏览器支持；iOS 会静默忽略）
let lastBuzz = 0;
const buzz = (ms) => {
  if (!IS_TOUCH || !navigator.vibrate) return;
  const now = performance.now();
  if (now - lastBuzz < 70) return;
  lastBuzz = now;
  try { navigator.vibrate(ms); } catch { /* 忽略 */ }
};
const MUZZLE = 80;          // 手持珠距主角中心距离
const EPS = 1.5;
const RAMP_TIME = 55;        // 关内加速达到最大值所需秒数
const POP_TIME = 0.17;      // 消除时"鼓起再消失"的时长
const POP_STAGGER = 0.05;   // 从命中点向外依次爆开的间隔（每个珠距）
const TRANSFER_TIME = 0.12; // 下一颗珠从灯笼底部移到手上的时长

const WORLD = 1000;
const CN_D = '零一二三四五六七八九';
const CN_NUM = (n) => (n <= 10 ? (n === 10 ? '十' : CN_D[n]) : n < 20 ? '十' + CN_D[n % 10] : n < 100 ? CN_D[(n / 10) | 0] + '十' + (n % 10 ? CN_D[n % 10] : '') : String(n));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerpColor = (a, b, t) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (r << 16) | (g << 8) | bl;
};

// 关卡里的轨道定义：单轨关卡用 path/count，多轨关卡用 tracks:[{path,count}]
export function trackDefs(lv) {
  return lv.tracks || [{ path: lv.path, count: lv.count }];
}

// 单局统计：成就与挑战都从这里读数
const newRun = () => ({
  shots: 0, misses: 0, swaps: 0, matches: 0, removed: 0, bestChain: 0, bestCombo: 0, bestBurst: 0,
  powers: {}, powerCount: 0, fevers: 0, clears: 0, closeCalls: 0, gemHits: 0, stage: 1, maxLead: 0,
  maxTier: -1, perks: 0, revives: 0,
});

export class Game {
  constructor(app, ui) {
    this.app = app;
    this.ui = ui;

    this.bg = new PIXI.Sprite(TEX.bg);
    this.bg.anchor.set(0.5);
    app.stage.addChild(this.bg);
    this.flyLayer = new PIXI.Container();
    app.stage.addChild(this.flyLayer);

    this.world = new PIXI.Container();
    app.stage.addChild(this.world);
    const layer = () => {
      const c = new PIXI.Container();
      this.world.addChild(c);
      return c;
    };
    this.pathLayer = layer();
    this.holeLayer = layer();
    this.bossLayer = layer();
    this.glowLayer = layer();
    this.ballLayer = layer();
    this.ghostLayer = layer();
    this.guideLayer = layer();
    this.projLayer = layer();
    this.shooterLayer = layer();
    this.fxLayer = layer();
    this.orbLayer = layer();
    this.textLayer = layer();
    this.guide = new PIXI.Graphics();
    this.guideLayer.addChild(this.guide);
    this.fx = new FX(this.fxLayer, this.textLayer);

    this.tmp = { x: 0, y: 0, tx: 1, ty: 0 };
    this.tracks = null;
    this.projectiles = [];
    this.ghosts = [];
    this.boss = null;
    this.orbs = [];
    this.inks = [];
    this.surgeT = 0;
    this.state = 'menu';
    this.t = 0;
    this.shakeAmt = 0;
    this.hitStop = 0;
    this.danger = 0;
    this.heartT = 0;
    this.aim = { x: 500, y: 200 };
    this.aimAng = -Math.PI / 2;
    this.touch = null;
    this.aiming = false;
    this.mouseMode = !matchMedia('(pointer: coarse)').matches;

    this.initFireflies();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    app.ticker.add(() => this.update(Math.min(app.ticker.deltaMS / 1000, 1 / 20)));
  }

  // 灯符层数（只有无尽模式会有）
  perk(id) { return this.perks[id] || 0; }

  // 选中一张灯符
  pickPerk(k, replace = null) {
    if (this.state !== 'choose' || !this.choices?.[k]) return;
    const c = this.choices[k];
    const id = c.id, t = c.t;
    if (c.swap && !replace) return;
    if (replace) {
      delete this.perks[replace];
      if (replace === 'guard') this.guardLeft = 0;
      this.fx.text(this.sx, this.sy - 170, `舍弃 ${TAL[replace].name}`, { size: 34, fill: ['#e8e4ff', '#9a96c8'], stroke: '#14082a', dur: 1.2, rise: 40, font: 'brush' });
    }
    if (t.once) {
      if (id === 'rewind') { this.reverseT = 4; this.slowT = 0; sfx.reverse(); }
    } else {
      const add = c.double ? 2 : 1;
      this.perks[id] = Math.min(t.max, (this.perks[id] || 0) + add);
      if (id === 'guard') this.guardLeft += add;
      if (c.double) this.curses++;
    }
    this.perkLog.push(id);
    this.run.perks = this.perkLog.length;
    this.choices = null;
    this.state = 'play';
    this.ui.close();
    this.fx.text(this.sx, this.sy - 120, `${c.double ? '祸福 · ' : ''}${t.name}${t.once ? '' : ' · ' + '壹贰叁肆伍'[this.perks[id] - 1]}`, { size: 46, fill: ['#fffbe6', '#ffd27a'], stroke: '#3a1606', dur: 1.4, rise: 50, font: 'brush' });
    this.fx.ring(this.sx, this.sy, 0xffd27a, 3.4, 0.7);
    this.fx.burst(this.sx, this.sy, 0xffe08a, 24, 1.6);
    this.ui.flash('rgba(255,225,140,0.3)');
    this.emit('perk', id);
  }

  openChoice() {
    this.choices = rollTalismans(this.perks, this.stage);
    if (!this.choices.length) return;
    this.state = 'choose';
    sfx.powerAppear();
    this.ui.showChoice(this.choices, this.perks, this.stage);
  }

  // 连击断了（失手）：护连符可抵挡
  breakCombo() {
    if (this.shotCombo <= 0) return;
    if (this.guardLeft > 0 && this.shotCombo >= 3) {
      this.guardLeft--;
      this.fx.text(this.sx, this.sy - 100, '护连', { size: 40, fill: ['#e8fbff', '#7ad0ff'], stroke: '#04203a', dur: 0.9, rise: 40, font: 'brush' });
      sfx.clack();
      return;
    }
    const had = this.shotCombo;
    this.shotCombo = 0;
    this.comboTierNow = -1;
    this.ui.setCombo?.(0, -1, had >= 3);
  }

  // 连击推进：跨过段位时大字 + 闪光
  bumpCombo() {
    this.shotCombo++;
    const c = this.shotCombo;
    const t = comboTier(c);
    this.ui.setCombo?.(c, t);
    if (t > this.comboTierNow) {
      this.comboTierNow = t;
      this.run.maxTier = Math.max(this.run.maxTier, t);
      const T = COMBO_TIERS[t];
      const top = t === COMBO_TIERS.length - 1;
      this.fx.text(500, 400, T.name, { size: top ? 120 : 130 + t * 10, fill: ['#fffbe6', T.color], stroke: '#2a0a04', dur: 1.3, rise: 30, font: 'brush' });
      this.fx.text(500, 490, `连击 ×${T.mul} 倍`, { size: 40, fill: ['#fffbe6', T.color], stroke: '#2a0a04', dur: 1.3, rise: 20, font: 'brush' });
      this.fx.ring(this.sx, this.sy, Number('0x' + T.color.slice(1)), 3 + t, 0.6);
      this.ui.flash(top ? 'rgba(255,90,120,0.4)' : 'rgba(255,215,140,0.25)');
      this.shake(6 + t * 3);
      this.punch(0.02 + t * 0.01);
      if (top) sfx.rainbow(); else sfx.star(t);
      this.emit('tier', t);
    }
  }

  comboMul() {
    const t = comboTier(this.shotCombo);
    return t < 0 ? 1 : COMBO_TIERS[t].mul;
  }

  // 向局外系统（成就 / 挑战）报告事件
  emit(ev, data) {
    if (this.state === 'play') this.ui.onEvent?.(ev, this.run, data);
  }

  // 灯灵外观：纹理 + 光晕颜色
  setSkin(id, halo) {
    this.skinId = id;
    this.skinHalo = halo ?? 0xffa53d;
    if (this.shooter) {
      this.shooter.lantern.texture = TEX.skins?.[id] || TEX.lantern;
    }
  }

  setBallSkin(id) { if (TEX.ballSets?.[id]) TEX.balls = TEX.ballSets[id]; }
  setTrail(id) { this.trailId = id || 'plain'; }

  // 弹道拖尾：燎原时统一是火焰，平时按装备的样式
  emitTrail(p) {
    const fx = this.fx, x = p.x, y = p.y;
    if (this.feverT > 0) { fx.trail(x, y, 0xff9a3c, 1.6); return; }
    const tint = COLORS[p.color].tint;
    switch (this.trailId) {
      case 'firefly':
        fx.trail(x, y, tint, 0.8);
        if (Math.random() < 0.55) {
          fx._add(TEX.glow, x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, {
            tint: Math.random() < 0.6 ? 0xd9ff8f : 0xfff3a0, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 30,
            max: 0.9 + Math.random() * 0.6, s0: 0.16, s1: 0.04, a0: 0.95,
          });
        }
        break;
      case 'petal':
        fx.trail(x, y, 0xff9cc4, 0.7);
        if (Math.random() < 0.5) {
          const sp = fx._add(TEX.petal, x, y, {
            tint: Math.random() < 0.5 ? 0xffffff : 0xffb3d1, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 60,
            max: 1 + Math.random() * 0.6, s0: 0.45 + Math.random() * 0.3, s1: 0.2, a0: 0.95, grav: 90, drag: 2, spin: (Math.random() - 0.5) * 8,
          });
          sp.s.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
        break;
      case 'gold':
        fx.trail(x, y, 0xffd85a, 1);
        for (let k = 0; k < 2; k++) {
          fx._add(TEX.spark, x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16, {
            tint: Math.random() < 0.7 ? 0xffd85a : 0xffffff, vx: (Math.random() - 0.5) * 60, vy: 20 + Math.random() * 40,
            max: 0.5 + Math.random() * 0.4, s0: 0.22 + Math.random() * 0.2, s1: 0, spin: 10, grav: 120,
          });
        }
        break;
      case 'dragon':
        fx.trail(x, y, Math.random() < 0.5 ? 0xff8a2e : 0xff3d1e, 1.7);
        if (Math.random() < 0.7) fx.ember(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18);
        break;
      default:
        fx.trail(x, y, tint, 1);
    }
  }

  // ================= 灯油续燃（复活） =================
  // 珠串进井时先暂停，交给界面问玩家要不要花灯币续燃
  revive() {
    if (this.state !== 'revive') return;
    this.revives++;
    this.run.revives = this.revives;
    // 火焰烧掉靠近井口的珠子（不计分、不触发道具），再让珠串倒流
    for (const tr of this.tracks) {
      const L = tr.path.length, B = tr.balls;
      let i = B.length;
      while (i > 0 && B[i - 1].s > L * 0.7) i--;
      const burn = B.splice(i);
      burn.forEach((b, k) => {
        this.fx.burst(b.x, b.y, 0xff8a2e, 8, 1.1);
        this.toGhost(b, k * 0.03, 1.2);
      });
      tr.danger = 0;
    }
    this.reverseT = 3;
    this.slowT = Math.max(this.slowT, 6);
    this.state = 'play';
    this.ui.close();
    this.fx.text(500, 460, '灯油续燃', { size: 100, fill: ['#fffbe6', '#ffb02e', '#ff4d2e'], stroke: '#3a0a02', dur: 1.6, rise: 30, font: 'brush' });
    this.fx.ring(this.sx, this.sy, 0xffb347, 5, 0.8);
    this.ui.flash('rgba(255,170,60,0.5)');
    this.shake(14);
    this.setHitStop(0.15);
    sfx.fever();
    this.refreshAmmo();
    this.emit('revive');
  }

  giveUp() {
    if (this.state !== 'revive') return;
    this.state = 'play';
    this.ui.close();
    this.loseGame();
  }

  loseGame() {
    const T = this.tracks;
    this.run.maxLead = Math.max(...T.map((tr) => tr.maxLead));
    this.state = 'lose';
    this.endTimer = 0;
    this.shake(14);
    this.endFever();
    sfx.lose();
    this.fx.text(500, 470, '灯火将熄', { size: 84, fill: ['#ffd6dc', '#ff5a6e'], stroke: '#2a0610', dur: 2, rise: 30, font: 'brush' });
  }

  // 所有轨道上的珠子（只读遍历用）
  *allBalls() {
    if (!this.tracks) return;
    for (const tr of this.tracks) yield* tr.balls;
  }

  // ================= 布局 =================
  // 关卡实际用到的区域（轨道可见部分 + 主角 + 首领），缩放时只适配这块，手机上能放得更大
  computeBounds(lv) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y, r) => {
      x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
    };
    const tmp = { x: 0, y: 0, tx: 0, ty: 0 };
    for (const tr of this.tracks) {
      for (let s = 0; s <= tr.path.length; s += 10) {
        tr.path.at(s, tmp);
        if (tmp.x >= 0 && tmp.x <= WORLD && tmp.y >= 0 && tmp.y <= WORLD) add(tmp.x, tmp.y, R + 10);
      }
      tr.path.at(tr.path.length, tmp);
      add(tmp.x, tmp.y, 66);
    }
    add(lv.shooter[0], lv.shooter[1], MUZZLE + R + 8);
    if (lv.boss) add(lv.boss.x, lv.boss.y, lv.boss.r + 20);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(WORLD, x1); y1 = Math.min(WORLD, y1);
    this.bounds = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h > w;
    // 手机横屏：HUD 移到两侧，棋盘占满整个高度
    const sideHud = !portrait && h < 520;
    const top = portrait ? (w < 600 ? 104 : 80) : sideHud ? 6 : 70;
    const bottom = portrait ? (IS_TOUCH ? 96 : 56) : sideHud ? 6 : 12;
    const side = sideHud ? Math.min(190, w * 0.2) : portrait ? 2 : 8;
    const b = this.bounds || { x: 0, y: 0, w: WORLD, h: WORLD };
    const aw = Math.max(160, w - side * 2), ah = Math.max(160, h - top - bottom);
    const s = Math.min(aw / b.w, ah / b.h);
    this.scale = s;
    this.baseX = (w - b.w * s) / 2 - b.x * s;
    this.baseY = top + (ah - b.h * s) / 2 - b.y * s;
    this.world.scale.set(s);
    this.world.position.set(this.baseX, this.baseY);
    this.bg.position.set(w / 2, h / 2);
    this.bg.scale.set((Math.max(w, h) / 1024) * 1.05);
    this.screenW = w;
    this.screenH = h;
  }

  toWorld(cx, cy) {
    return { x: (cx - this.baseX) / this.scale, y: (cy - this.baseY) / this.scale };
  }

  // ================= 背景萤火 =================
  initFireflies() {
    this.flies = [];
    for (let i = 0; i < 46; i++) {
      const s = new PIXI.Sprite(TEX.glow);
      s.anchor.set(0.5);
      s.blendMode = PIXI.BLEND_MODES.ADD;
      s.tint = Math.random() < 0.6 ? 0xd9ff8f : 0xffd27a;
      this.flyLayer.addChild(s);
      this.flies.push({
        s, x: Math.random(), y: Math.random(), ph: Math.random() * 10,
        sz: 0.06 + Math.random() * 0.12, sp: 0.006 + Math.random() * 0.012,
      });
    }
  }

  updateFireflies(dt) {
    const w = this.screenW, h = this.screenH, t = this.t;
    const boost = this.feverT > 0 ? 4 : 1;
    for (const f of this.flies) {
      f.y -= f.sp * dt * boost;
      f.x += Math.sin(t * 0.4 + f.ph) * 0.004 * dt;
      if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
      f.s.position.set(f.x * w, f.y * h + Math.sin(t * 0.9 + f.ph) * 8);
      f.s.alpha = 0.15 + 0.55 * Math.abs(Math.sin(t * 1.3 + f.ph));
      f.s.scale.set(f.sz * (boost > 1 ? 1.4 : 1));
    }
  }

  // ================= 输入 =================
  bindInput() {
    const cv = this.app.view;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      if (this.state !== 'play') return;
      const p = this.toWorld(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        this.mouseMode = true;
        if (e.button === 2) { this.swap(); return; }
        if (e.button !== 0) return;
        this.aim = p;
        this.shoot();
        return;
      }
      this.mouseMode = false;
      try { cv.setPointerCapture(e.pointerId); } catch { /* 指针已失效时忽略 */ }
      const onShooter = Math.hypot(p.x - this.sx, p.y - this.sy) < Math.max(78, SWAP_PX / this.scale);
      this.touch = { id: e.pointerId, x0: p.x, y0: p.y, onShooter, moved: false };
      if (!onShooter) { this.aiming = true; this.aim = p; }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.toWorld(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') { this.mouseMode = true; this.aim = p; return; }
      const t = this.touch;
      if (!t || t.id !== e.pointerId) return;
      if (Math.hypot(p.x - t.x0, p.y - t.y0) > 24) t.moved = true;
      if (!t.onShooter || t.moved) { this.aiming = true; this.aim = p; }
    });
    const up = (e) => {
      const t = this.touch;
      if (!t || t.id !== e.pointerId) return;
      this.touch = null;
      if (this.state !== 'play') { this.aiming = false; return; }
      if (e.type === 'pointercancel') { this.aiming = false; return; }
      if (t.onShooter && !t.moved) this.swap();
      else if (this.aiming) this.shoot();
      this.aiming = false;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); if (this.state === 'play') this.swap(); }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
    });
  }

  // ================= 关卡 =================
  clearLevel() {
    for (const l of [this.pathLayer, this.holeLayer, this.bossLayer, this.glowLayer, this.ballLayer, this.ghostLayer, this.projLayer, this.shooterLayer, this.orbLayer]) {
      for (const c of l.removeChildren()) c.destroy({ children: true });
    }
    this.fx.clear();
    this.tracks = null;
    this.projectiles = [];
    this.ghosts = [];
    this.boss = null;
    this.orbs = [];
    this.inks = [];
    this.surgeT = 0;
  }

  loadLevel(i, mode = 'play') {
    this.clearLevel();
    // i < 0 为无尽模式：复制一份，难度参数会随"重"数改变
    const lv = i === DAILY ? dailyLevel() : i < 0 ? { ...ENDLESS, ...endlessStage(1) } : LEVELS[i];
    this.lv = lv;
    this.endless = !!lv.endless;
    this.daily = !!lv.daily;
    this.stage = 1;
    this.levelIndex = i;
    this.tracks = trackDefs(lv).map((def, k) => ({
      id: k,
      path: new Path(def.path),
      balls: [],
      // 首领关：珠串源源不断，直到年兽被击败
      count: lv.boss || lv.endless ? 1e9 : Math.round(def.count * COUNT_K),
      toSpawn: mode === 'play' ? (lv.boss || lv.endless ? 1e9 : Math.round(def.count * COUNT_K)) : 0,
      prevSpawn: -1,
      queue: [],
      rush: true,
      rushTo: def.rushTo ?? lv.rushTo,
      maxLead: 0,
      danger: 0,
      hole: null,
      winRun: null,
    }));
    this.totalCount = this.tracks.reduce((a, tr) => a + tr.count, 0);
    for (const tr of this.tracks) { this.drawPath(tr); this.drawHoles(tr); }
    this.buildShooter(lv.shooter);
    if (lv.boss) this.createBoss(lv.boss);
    this.computeBounds(lv);
    this.resize();
    this.ui.setBoss(lv.boss && mode === 'play' ? lv.boss.name : null, 1);
    this.levelTime = 0;
    this.waveT = 0;
    this.waveWarned = false;
    this.waveCd = lv.surge ? lv.surge.every : 0;

    this.score = 0;
    this.run = newRun();
    this.closeT = 0;
    this.shotCombo = 0;
    this.comboTierNow = -1;
    this.perks = {};
    this.perkLog = [];
    this.guardLeft = 0;
    this.prismN = 0;
    this.chooseT = 0;
    this.choices = null;
    this.revives = 0;
    this.curses = 0;
    this.inkT = 0;
    this.ui.setCombo?.(0, -1);
    this.bestChain = 0;
    this.removedCount = 0;
    this.insertedCount = 0;
    this.cooldown = 0;
    this.endTimer = 0;
    this.danger = 0;
    this.powerT = 8;
    this.slowT = 0;
    this.reverseT = 0;
    this.fever = 0;
    this.feverT = 0;
    this.ui.setEffects(0, 0);
    this.ui.setFever(0, false);
    this.ui.setFeverMode(false);
    this.cur = this.pickColor();
    this.next = this.pickColor();
    this.updateAmmoView();
    this.state = mode;
    this.world.visible = mode !== 'menu';
    this.ui.setScore(0, true);
    this.ui.setProgress(0);
    this.ui.setDanger(0);
  }

  start(i) {
    this.loadLevel(i, 'play');
    this.ui.setLevel(i);
    if (this.daily) this.ui.hint(`每日一灯 · ${this.lv.rule.name}：${this.lv.rule.desc}`, 6000);
    else if (this.endless) this.ui.hint(`无尽长夜：每 ${ENDLESS_STAGE} 秒升一重，速度越来越快，坚持得越久分越高`, 5000);
    else if (this.boss) this.ui.hint('消除珠子化作灯火攻击年兽 · 用额头宝珠的颜色直击它', 6000);
    else if (this.tracks.length > 1) this.ui.hint('双轨来袭：两条珠串都不能让它们进井', 4000);
  }
  pause() { if (this.state === 'play') { this.state = 'paused'; this.ui.showPause(); } }
  resume() { if (this.state === 'paused') { this.state = 'play'; this.ui.close(); } }

  drawPath(tr) {
    const path = tr.path, L = path.length, tmp = this.tmp;
    const pts = [];
    for (let s = 0; s < L; s += 6) { path.at(s, tmp); pts.push([tmp.x, tmp.y, tmp.tx, tmp.ty]); }
    path.at(L, tmp); pts.push([tmp.x, tmp.y, tmp.tx, tmp.ty]);

    // 第二条轨道用青色辉光，便于区分
    const glowA = tr.id === 0 ? 0x4a3dff : 0x1fa3c9;
    const glowB = tr.id === 0 ? 0x7062ff : 0x3cc8e0;
    const g = new PIXI.Graphics();
    const stroke = (w, color, alpha, off = 0) => {
      g.lineStyle({ width: w, color, alpha, join: 'round', cap: 'round' });
      pts.forEach((p, k) => {
        const x = p[0] - p[3] * off, y = p[1] + p[2] * off;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      });
    };
    stroke(D + 64, glowA, 0.05);
    stroke(D + 38, glowB, 0.08);
    stroke(D + 16, 0x05061a, 0.95);
    stroke(D + 4, 0x13163c, 1);
    stroke(2, 0xffd27a, 0.32, R + 5);
    stroke(2, 0xffd27a, 0.32, -(R + 5));
    this.pathLayer.addChild(g);

    const dots = new PIXI.Graphics();
    for (let s = 30; s < L - 30; s += 64) {
      path.at(s, tmp);
      dots.beginFill(0xffd27a, 0.28).drawCircle(tmp.x, tmp.y, 3).endFill();
    }
    dots.blendMode = PIXI.BLEND_MODES.ADD;
    this.pathLayer.addChild(dots);
  }

  drawHoles(tr) {
    const tmp = this.tmp;
    tr.path.at(tr.path.length, tmp);
    const hole = new PIXI.Container();
    hole.position.set(tmp.x, tmp.y);
    const hg = new PIXI.Sprite(TEX.glow);
    hg.anchor.set(0.5); hg.scale.set(2.3); hg.blendMode = PIXI.BLEND_MODES.ADD; hg.tint = 0x7a5cff; hg.alpha = 0.7;
    const stones = new PIXI.Graphics();
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      stones.lineStyle(2, 0x6b64b8, 0.8).beginFill(0x2a2752).drawCircle(Math.cos(a) * 52, Math.sin(a) * 52, 10).endFill();
    }
    const core = new PIXI.Graphics();
    core.beginFill(0x010106).drawCircle(0, 0, 44).endFill();
    const swirl = new PIXI.Graphics();
    for (let k = 0; k < 3; k++) {
      const r = 14 + k * 9;
      swirl.lineStyle(3, 0x9d8cff, 0.55 - k * 0.12).arc(0, 0, r, k, k + Math.PI * 1.2);
    }
    swirl.blendMode = PIXI.BLEND_MODES.ADD;
    hole.addChild(hg, stones, core, swirl);
    this.holeLayer.addChild(hole);
    tr.hole = { c: hole, glow: hg, swirl, stones };

    tr.path.at(0, tmp);
    const gate = new PIXI.Container();
    gate.position.set(tmp.x, tmp.y);
    const gg = new PIXI.Sprite(TEX.glow);
    gg.anchor.set(0.5); gg.scale.set(1.3); gg.blendMode = PIXI.BLEND_MODES.ADD; gg.tint = 0xffb04a; gg.alpha = 0.5;
    const gc = new PIXI.Graphics();
    gc.lineStyle(3, 0xffd27a, 0.7).beginFill(0x05061a).drawCircle(0, 0, 30).endFill();
    gate.addChild(gg, gc);
    this.holeLayer.addChild(gate);
  }

  buildShooter([x, y]) {
    this.sx = x; this.sy = y;
    const c = new PIXI.Container();
    c.position.set(x, y);
    const halo = new PIXI.Sprite(TEX.glow);
    halo.anchor.set(0.5); halo.scale.set(2.4); halo.tint = 0xffa53d; halo.alpha = 0.55; halo.blendMode = PIXI.BLEND_MODES.ADD;
    const ring = new PIXI.Graphics();
    ring.lineStyle(2, 0xffd27a, 0.18).drawCircle(0, 0, MUZZLE);
    const body = new PIXI.Container();
    const lantern = new PIXI.Sprite(TEX.skins?.[this.skinId] || TEX.lantern);
    lantern.anchor.set(0.5, 100 / 220);
    lantern.scale.set(0.82);
    const eyes = new PIXI.Graphics();
    body.addChild(lantern, eyes);
    const next = this.makeBallView(0, true);
    next.view.scale.set(0.5);
    next.view.position.set(0, 72);
    body.addChild(next.view);
    const cur = this.makeBallView(0, true);
    c.addChild(halo, ring, body, cur.view);
    this.shooterLayer.addChild(c);
    this.shooter = { c, halo, ring, body, eyes, lantern, cur, next, recoil: 0, swapT: 0, transferT: 0, joy: 0, blink: 2 };
  }

  makeBallView(color, innerGlow = false) {
    const view = new PIXI.Container();
    let glow = null;
    if (innerGlow) {
      glow = new PIXI.Sprite(TEX.glow);
      glow.anchor.set(0.5); glow.blendMode = PIXI.BLEND_MODES.ADD;
      glow.scale.set((D * 2.4) / 128); glow.alpha = 0.55; glow.tint = COLORS[color].tint;
      view.addChild(glow);
    }
    const body = new PIXI.Sprite(TEX.balls[color]);
    body.anchor.set(0.5);
    body.scale.set(D / 120);
    const shine = new PIXI.Sprite(TEX.shine);
    shine.anchor.set(0.5);
    shine.scale.set(D / 120);
    view.addChild(body, shine);
    return { view, body, glow };
  }

  setBallColor(v, color) {
    v.body.texture = TEX.balls[color];
    if (v.glow) v.glow.tint = COLORS[color].tint;
  }

  makeBall(tr, color, s) {
    const v = this.makeBallView(color);
    this.ballLayer.addChild(v.view);
    const glow = new PIXI.Sprite(TEX.glow);
    glow.anchor.set(0.5); glow.blendMode = PIXI.BLEND_MODES.ADD;
    glow.scale.set((D * 2.2) / 128); glow.tint = COLORS[color].tint;
    this.glowLayer.addChild(glow);
    tr.path.at(s, this.tmp);
    return {
      tr, color, s, grow: 1, retreatV: 0, chainLevel: 0, pending: false,
      view: v.view, body: v.body, glow, x: this.tmp.x, y: this.tmp.y, fx: 0, fy: 0,
    };
  }

  killBall(b) {
    b.view.destroy({ children: true });
    b.glow.destroy();
  }

  // 珠子是否在轨道可见段（可被击中/影响）
  onBoard(b) { return b.s >= 0 && b.s <= b.tr.path.length; }

  // ================= 颜色 =================
  presentColors() {
    const set = new Set();
    for (const b of this.allBalls()) set.add(b.color);
    return set;
  }

  // 手里的珠子偏向场上"差一颗就消"的颜色，让每一枪都更容易打响
  pickColor() {
    let arr = [...this.presentColors()];
    if (!arr.length) arr = [...Array(this.lv.colors).keys()];
    if (Math.random() < 0.7) {
      const w = new Map();
      for (const tr of this.tracks || []) {
        const B = tr.balls;
        for (let i = 1; i < B.length; i++) {
          const b = B[i];
          if (b.color === B[i - 1].color && b.color !== RAINBOW && this.onBoard(b) && b.s < tr.path.length * 0.95) {
            // 夹心核心（两侧颜色相同、补一颗就会连锁）权重最高；越靠近井口越优先
            const L = B[i - 2], Rr = B[i + 1];
            const core = L && Rr && L.color === Rr.color && L.color !== b.color;
            w.set(b.color, (w.get(b.color) || 0) + (core ? 10 : 1) * (1 + 2 * (b.s / tr.path.length)));
          }
        }
      }
      let tot = 0;
      for (const v of w.values()) tot += v;
      let x = Math.random() * tot;
      for (const [c, v] of w) { if ((x -= v) <= 0) return c; }
    }
    return arr[(Math.random() * arr.length) | 0];
  }

  // 出珠：按"块"生成，大量埋设夹心结构，一枪下去引发连锁——砰砰砰
  spawnColor(tr) {
    if (!tr.queue.length) this.genBlock(tr);
    const c = tr.queue.shift();
    tr.prevSpawn = c;
    return c;
  }

  // 一个"块"：拉链 / 多层夹心 D C B [A A] B C D / 普通段 —— 补中间一颗，从里到外一层层砰砰砰炸开
  genBlock(tr) {
    const n = this.lv.colors, q = tr.queue;
    const pickNot = (...no) => {
      let c, k = 0;
      do { c = (Math.random() * n) | 0; } while (no.includes(c) && ++k < 50);
      return c;
    };
    const run = (c, len) => { for (let i = 0; i < len; i++) q.push(c); };
    const r = Math.random();
    if (r < this.lv.zip) {
      // 拉链：A A B B A A B B …… 每一对都是"夹心核心"，打中任意一对都会一路连锁炸开
      const a = pickNot(tr.prevSpawn), b = pickNot(tr.prevSpawn, a);
      const pairs = 4 + ((Math.random() * 4) | 0);
      for (let k = 0; k < pairs; k++) run(k % 2 ? b : a, 2);
      return;
    }
    if (r >= this.lv.zip + this.lv.setup) {
      run(pickNot(tr.prevSpawn), Math.random() < 0.55 ? 2 : 3);   // 普通段
      return;
    }
    const [lo, hi] = this.lv.depth;
    const depth = lo + ((Math.random() * (hi - lo + 1)) | 0);
    // 由外到内选色：相邻两层不同色，尽量全不同
    const layers = [];
    for (let k = 0; k <= depth; k++) {
      const no = [layers[k - 1]];
      if (layers.length < n - 1) no.push(...layers);
      if (k === 0) no.push(tr.prevSpawn);
      layers.push(pickNot(...no));
    }
    const side = () => (Math.random() < 0.85 ? 2 : 1);
    const right = [];
    for (let k = 0; k < depth; k++) {
      const l = side(), r = Math.max(3 - l, side());   // 两边合起来至少 3 颗
      run(layers[k], l);
      right.unshift([layers[k], r]);
    }
    run(layers[depth], 2);                              // 核心：差一颗
    for (const [c, len] of right) run(c, len);
  }

  refreshAmmo() {
    const set = this.presentColors();
    if (!set.size) return;
    if (this.cur !== RAINBOW && !set.has(this.cur)) this.cur = this.pickColor();
    if (this.next !== RAINBOW && !set.has(this.next)) this.next = this.pickColor();
    this.updateAmmoView();
  }

  updateAmmoView() {
    if (!this.shooter) return;
    this.setBallColor(this.shooter.cur, this.cur);
    this.setBallColor(this.shooter.next, this.next);
    this.ui.setAmmo?.(this.cur, this.next);
  }

  // ================= 发射 =================
  shoot() {
    if (this.state !== 'play' || this.cooldown > 0) return;
    const dx = Math.cos(this.aimAng), dy = Math.sin(this.aimAng);
    const v = this.makeBallView(this.cur, true);
    const p = {
      color: this.cur, x: this.sx + dx * MUZZLE, y: this.sy + dy * MUZZLE,
      vx: dx * CFG.shotSpeed * (1 + 0.25 * this.perk('swift')), vy: dy * CFG.shotSpeed * (1 + 0.25 * this.perk('swift')), view: v.view, body: v.body,
      fire: this.feverT > 0,   // 灯火燎原：火珠，打到哪炸到哪
    };
    if (p.fire) {
      v.view.scale.set(1.25); v.body.tint = 0xffc070;
      this.feverShots--;
      this.fx.text(this.sx, this.sy - 110, this.feverShots > 0 ? `火珠 ×${this.feverShots}` : '火珠用尽', { size: 34, fill: ['#fffbe6', '#ff9d3c'], stroke: '#3a0a02', dur: 0.7, rise: 40, font: 'brush' });
      if (this.feverShots <= 0) this.feverT = Math.min(this.feverT, 0.5);
    }
    v.view.position.set(p.x, p.y);
    this.projLayer.addChild(v.view);
    this.projectiles.push(p);
    this.run.shots++;
    const tint = COLORS[this.cur].tint;
    this.fx.ring(p.x, p.y, tint, 0.55, 0.2);
    this.fx.burst(p.x + dx * 10, p.y + dy * 10, tint, 4, 0.45, true);
    this.cur = this.next;
    this.next = this.pickColor();
    const prismN = this.perk('prism') ? prismEvery(this.perk('prism')) : this.lv.prism;
    if (prismN && ++this.prismN >= prismN) { this.prismN = 0; this.next = RAINBOW; }
    this.updateAmmoView();
    this.cooldown = CFG.fireCooldown * (this.feverT > 0 ? 0.8 : 1) * (1 - 0.2 * this.perk('swift'));
    this.shooter.recoil = 1;
    this.shooter.transferT = 1;
    sfx.shoot();
    buzz(8);
  }

  swap() {
    if (this.state !== 'play') return;
    [this.cur, this.next] = [this.next, this.cur];
    this.updateAmmoView();
    this.shooter.swapT = 1;
    this.run.swaps++;
    sfx.swap();
    buzz(6);
  }

  // ================= 主循环 =================
  update(dt) {
    this.t += dt;
    this.updateFireflies(dt);
    if (this.state === 'paused' || this.state === 'choose' || this.state === 'revive' || !this.tracks) { sfx.roll(0); return; }
    if (this.chooseT > 0 && this.state === 'play') {
      this.chooseT -= dt;
      if (this.chooseT <= 0) { this.openChoice(); return; }
    }
    let gdt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; gdt = dt * 0.1; }
    if (this.state === 'play') {
      this.levelTime += gdt;
      this.surgeT = Math.max(0, this.surgeT - gdt);
      this.updateSurge(gdt);
      if (this.endless) { this.updateEndless(gdt); this.updateInkRain(gdt); }
      this.slowT = Math.max(0, this.slowT - gdt);
      this.reverseT = Math.max(0, this.reverseT - gdt);
      this.ui.setEffects(this.slowT, this.reverseT);
      if (this.feverT > 0) {
        this.feverT -= gdt;
        if (this.feverT <= 0) this.endFever();
      }
      this.ui.setFever(this.feverT > 0 ? Math.max(0, this.feverShots) / (CFG.feverShots + 2 * this.perk('ember')) : this.fever, this.feverT > 0);
    }
    if (this.state === 'play' || this.state === 'lose' || this.state === 'win') {
      this.updatePowers(gdt);
      for (const tr of this.tracks) this.updateTrack(tr, gdt);
      this.updateProjectiles(gdt);
    }
    this.cooldown -= dt;
    this.updateBoss(gdt);
    this.updateOrbs(gdt);
    this.updateInks(gdt);
    this.renderBalls();
    this.updateGhosts(gdt);
    this.updateShooter(dt);
    this.updateHoles(dt);
    this.drawGuide();
    this.updateWinRun(gdt);
    this.fx.update(gdt);
    this.updateDanger(dt);
    this.applyShake(dt);
    this.checkEnd(dt);
    this.updateRollSound(gdt / (dt || 1));
  }

  // 滚动声：取所有轨道里最快的那段（推进或回吸），顿帧时跟着变慢
  updateRollSound(k) {
    let v = 0, retreat = false;
    if (this.state === 'play' || this.state === 'lose') {
      for (const tr of this.tracks) {
        if (Math.abs(tr.rollV || 0) > Math.abs(v)) { v = tr.rollV; retreat = false; }
        if ((tr.rollRetreat || 0) > Math.abs(v)) { v = tr.rollRetreat; retreat = true; }
      }
      if (this.boss?.dying) v = 0;
    }
    sfx.roll(v * k, retreat);
  }

  // 无尽模式：每 ENDLESS_STAGE 秒升一重
  updateEndless() {
    const n = 1 + Math.floor(this.levelTime / ENDLESS_STAGE);
    if (n === this.stage) return;
    this.stage = n;
    this.run.stage = n;
    this.emit('stage', n);
    this.guardLeft = this.perk('guard');
    if (choiceStage(n)) this.chooseT = 1.7;   // 升重大字放完再选灵符
    const hadSurge = !!this.lv.surge;
    Object.assign(this.lv, endlessStage(n));
    if (this.lv.surge && !hadSurge) { this.waveCd = this.lv.surge.every; this.waveWarned = false; }
    const bonus = 500 * (n - 1);
    this.addScore(bonus);
    this.ui.setStage(n);
    this.fx.text(500, 430, `第${CN_NUM(n)}重`, { size: 100, fill: ['#fffbe6', '#ffd27a', '#ff9d3c'], stroke: '#3a1606', dur: 1.8, rise: 30, font: 'brush' });
    this.fx.text(500, 520, `+${bonus}`, { size: 44, font: 'num', dur: 1.6 });
    this.fx.ring(this.sx, this.sy, 0xffd27a, 4, 0.8);
    this.ui.flash('rgba(255,220,150,0.3)');
    const depth = NIGHT_DEPTHS.find((d) => d.n === n);
    if (depth) {
      this.fx.text(500, 600, '夜深', { size: 80, fill: ['#e8e4ff', '#8a7cff'], stroke: '#0a0420', dur: 2.2, rise: 20, font: 'brush' });
      this.ui.hint(depth.text, 5000);
      if (this.lv.ink) this.inkT = 4;
      if (this.chooseT > 0) this.chooseT = 2.5;   // 等「夜深」大字放完
    } else if (n === 3) this.ui.hint('潮涌来了：看到提示就先清理靠近古井的珠子', 4000);
    else if (n === 4) this.ui.hint('出现第五种颜色', 3000);
    else if (n === 13) this.ui.hint('夜色渐浓：之后每两重才能选一次灵符', 4000);
    sfx.powerAppear();
  }

  // 无尽夜深：墨点从天而降，把几颗珠子染成别的颜色
  updateInkRain(dt) {
    const ink = this.lv.ink;
    if (!ink || this.tracks.some((tr) => tr.rush)) return;
    this.inkT -= dt;
    if (this.inkT > 0) return;
    this.inkT = ink.every * (0.85 + Math.random() * 0.3);
    const cand = [...this.allBalls()].filter((x) => this.onBoard(x) && x.grow >= 1 && !x.power && x.s < x.tr.path.length * 0.9);
    for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const n = Math.min(cand.length, ink.count);
    for (let i = 0; i < n; i++) {
      const sx = 150 + Math.random() * 700, sy = -60;
      const s = new PIXI.Sprite(TEX.ink);
      s.anchor.set(0.5); s.scale.set(0.5); s.position.set(sx, sy);
      this.orbLayer.addChild(s);
      this.inks.push({ s, sx, sy, target: cand[i], t: 0, dur: 0.8 + i * 0.08, side: Math.random() < 0.5 ? -1 : 1 });
    }
    if (n) {
      this.fx.text(500, 200, '墨染', { size: 56, fill: ['#efe0ff', '#a066ff'], stroke: '#14052a', dur: 1.1, rise: 20, font: 'brush' });
      sfx.ink();
    }
  }

  // 潮涌：后期关卡定时让珠串猛冲一小段，先预警 1.2 秒
  updateSurge(dt) {
    const sg = this.lv.surge;
    if (!sg) return;
    if (this.waveT > 0) { this.waveT -= dt; return; }
    if (this.tracks.some((tr) => tr.rush) || this.reverseT > 0 || this.feverT > 0) return;
    this.waveCd -= dt;
    if (this.waveCd <= 1.2 && !this.waveWarned) {
      // 珠串已经很靠近古井时不再潮涌，避免无法反应的死亡
      if (this.tracks.some((tr) => this.lead(tr) > 0.68)) { this.waveCd = 4; return; }
      this.waveWarned = true;
      this.fx.text(500, 470, '潮涌', { size: 92, fill: ['#e8fbff', '#59c8ff'], stroke: '#04203a', dur: 1.3, rise: 30, font: 'brush' });
      sfx.bossWarn();
    }
    if (this.waveCd <= 0) {
      this.waveT = sg.dur;
      this.waveCd = sg.every * (0.85 + Math.random() * 0.3);
      this.waveWarned = false;
      this.shake(7);
    }
  }

  // 画面"一顶"：以屏幕中心为原点瞬间放大再弹回
  punch(a) { this.punchAmt = Math.min(0.06, Math.max(this.punchAmt || 0, a)); }

  // 某条轨道被打空：大字 + 奖励 + 沿着珠串原位置放一串烟花
  onTrackCleared(tr, list) {
    const bonus = 500 * (this.feverT > 0 ? 2 : 1);
    this.addScore(bonus);
    this.run.clears++;
    this.emit('clear');
    this.setHitStop(0.18);
    this.punch(0.05);
    this.shake(12);
    buzz(60);
    sfx.rainbow();
    this.ui.flash('rgba(255,236,190,0.45)');
    this.fx.text(500, 440, '一扫而空', { size: 104, fill: ['#fffbe6', '#ffd27a', '#ff9d3c'], stroke: '#3a1606', dur: 1.6, rise: 30, font: 'brush' });
    this.fx.text(500, 540, '+' + bonus, { size: 52, font: 'num', dur: 1.5, rise: 40 });
    const mine = list.filter((b) => b.tr === tr);
    const step = Math.max(1, Math.floor(mine.length / 8));
    for (let k = 0; k < mine.length; k += step) {
      const b = mine[k];
      this.fx.burst(b.x, b.y, COLORS[(k + b.color) % 6].tint, 18, 1.5);
      this.fx.ring(b.x, b.y, 0xffffff, 1.6, 0.5);
    }
    this.fx.ring(this.sx, this.sy, 0xffd27a, 4.5, 0.8);
  }

  setHitStop(t) { this.hitStop = Math.max(this.hitStop, t * CFG.hitStop); }
  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
    if (a >= 3) buzz(Math.min(70, Math.round(a * 3.5)));
  }

  spacing(a, b) { return R * (smooth(a.grow) + smooth(b.grow)); }

  lead(tr) { return tr.balls.length ? tr.balls[tr.balls.length - 1].s / tr.path.length : 0; }

  pushSpeed(tr) {
    if (this.state === 'lose') return 1100;
    if (this.boss?.dying) return 0;
    const lead = this.lead(tr);
    const base = this.lv.speed * CFG.speedMul * (1 - 0.1 * this.perk('calm')) * (1 + 0.15 * this.perk('gamble')) * (1 + CURSE_SPEED * this.curses);
    if (tr.rush) {
      if (lead >= tr.rushTo) tr.rush = false;
      else return Math.max(base, CFG.rushSpeed * (1 - (lead / tr.rushTo) ** 3));
    }
    // 关内加速：越往后珠串推得越快
    let v = base * (1 + this.lv.ramp * Math.min(1, this.levelTime / RAMP_TIME));
    if (this.boss?.enraged) v *= 1.15;
    if (this.waveT > 0) v *= (1 + (this.lv.surge.mul - 1) * (1 - 0.25 * this.perk('tide'))) * Math.min(1, this.waveT / 0.3);   // 潮涌
    if (this.surgeT > 0) v *= 2.8;          // 年兽怒吼：珠串猛冲
    if (lead > 0.8) v *= CFG.dangerSlow;    // 临近终点稍微放慢，给翻盘机会
    // 补珠：最后一段（被推动的那段）还在起点附近时快速冲入，清空后不用干等
    const rl = (tr.rearS ?? -D) / tr.path.length;
    if (tr.toSpawn > 0 && rl < 0.22) v += CFG.refillSpeed * (1 - Math.max(0, rl) / 0.22) ** 0.7;
    // 追赶：后段与前方断开的珠串距离很远时加速靠拢
    if (tr.rearGap > D * 3) v += Math.min(CFG.refillSpeed * 0.6, (tr.rearGap - D * 3) * 0.9);
    if (this.slowT > 0) v *= 0.35;
    if (this.feverT > 0) v *= 0.6;
    if (this.reverseT > 0) v = -CFG.reverseSpeed * Math.min(1, this.reverseT / 0.4);
    return v;
  }

  // 道具：计时、过期、定期在某条珠串上生成
  updatePowers(dt) {
    if (this.state !== 'play' || this.tracks.some((tr) => tr.rush) || this.lv.noPower) return;
    let active = 0;
    for (const b of this.allBalls()) {
      if (!b.power) continue;
      b.powerLife -= dt;
      if (b.powerLife <= 0) this.setPower(b, null);
      else active++;
    }
    this.powerT -= dt;
    if (this.powerT <= 0) {
      this.powerT = CFG.powerEvery * (0.75 + Math.random() * 0.5) * (1 - 0.25 * this.perk('treasure'));
      if (active < CFG.powerMax) {
        const cand = [];
        for (const b of this.allBalls()) {
          const L = b.tr.path.length;
          if (!b.power && b.grow >= 1 && b.s > L * 0.06 && b.s < L * 0.72) cand.push(b);
        }
        if (cand.length) this.setPower(cand[(Math.random() * cand.length) | 0], this.rollPower());
      }
    }
  }

  updateTrack(tr, dt) {
    const B = tr.balls, L = tr.path.length;

    // 1. 出珠
    if (this.state === 'play') {
      while (tr.toSpawn > 0 && (B.length === 0 || B[0].s >= -R)) {
        const s = B.length ? Math.min(B[0].s - D, -D) : -D;
        B.unshift(this.makeBall(tr, this.spawnColor(tr), s));
        tr.toSpawn--;
      }
    }

    // 2. 插入动画
    for (const b of B) {
      if (b.grow < 1) {
        b.grow = Math.min(1, b.grow + dt / CFG.insertTime);
        if (b.grow >= 1) b.pending = true;
      }
    }

    // 3. 分段：相互接触的珠子为一段
    const starts = [0];
    for (let i = 1; i < B.length; i++) {
      if (B[i].s - B[i - 1].s > this.spacing(B[i - 1], B[i]) + EPS) starts.push(i);
    }

    // 4. 各段速度：最后一段被推动；前方段若与身后颜色相同则回吸
    const rearEnd = (starts.length > 1 ? starts[1] : B.length) - 1;
    tr.rearS = rearEnd >= 0 ? B[rearEnd].s : -D;
    tr.rearGap = starts.length > 1 ? B[starts[1]].s - B[rearEnd].s : 0;
    const push = this.pushSpeed(tr);
    tr.rollV = B.length ? push : 0;
    tr.rollRetreat = 0;
    const segHeads = [];
    for (let k = 0; k < starts.length && B.length; k++) {
      const a0 = starts[k], a1 = (k + 1 < starts.length ? starts[k + 1] : B.length);
      let v = 0;
      const head = B[a0];
      if (k === 0) v = push;
      else {
        const prev = B[a0 - 1];
        if (this.state === 'play' && prev.color === head.color && prev.grow >= 1 && head.grow >= 1) {
          head.retreatV = Math.min(head.retreatV + CFG.retreatAcc * dt, CFG.retreatMax);
          v = -head.retreatV;
          tr.rollRetreat = Math.max(tr.rollRetreat, head.retreatV);
        } else head.retreatV = 0;
        segHeads.push(head);
      }
      if (v) for (let i = a0; i < a1; i++) B[i].s += v * dt;
    }

    // 5. 接触约束：后面的珠子把前面的顶开
    for (let i = 1; i < B.length; i++) {
      const m = B[i - 1].s + this.spacing(B[i - 1], B[i]);
      if (B[i].s < m) B[i].s = m;
    }
    tr.maxLead = Math.max(tr.maxLead, this.lead(tr));

    // 6. 检测合并（回吸撞上 → 连锁判定）
    const checks = [];
    for (const head of segHeads) {
      const i = B.indexOf(head);
      if (i <= 0) continue;
      const prev = B[i - 1];
      if (head.s - prev.s <= this.spacing(prev, head) + EPS) {
        if (head.retreatV > 0) {
          const mx = (head.x + prev.x) / 2, my = (head.y + prev.y) / 2;
          this.fx.burst(mx, my, 0xffffff, 6, 0.6, true);
          this.fx.ring(mx, my, 0xffe6b0, 0.8, 0.25);
          this.shake(4 + Math.min(head.retreatV / 200, 4));
          sfx.clack();
        }
        head.retreatV = 0;
        if (prev.color === head.color) checks.push([head, head.chainLevel + 1, false]);
        else head.chainLevel = 0;
      }
    }
    for (const b of B) {
      if (b.pending) { b.pending = false; checks.push([b, 1, true]); }
    }
    for (const [b, level, fromShot] of checks) {
      const ok = this.checkMatch(b, level, fromShot);
      if (!ok) {
        if (fromShot) this.breakCombo();
        else b.chainLevel = 0;
      }
    }

    // 7. 失败时珠子落入古井
    if (this.state === 'lose') {
      while (B.length && B[B.length - 1].s >= L) {
        const b = B.pop();
        this.killBall(b);
        if (Math.random() < 0.5) this.fx.burst(b.x, b.y, COLORS[b.color].tint, 4, 0.6);
      }
    }
  }

  checkMatch(ball, level, fromShot) {
    const B = ball.tr.balls;
    const idx = B.indexOf(ball);
    if (idx < 0) return false;
    const c = ball.color;
    const touching = (i, j) => B[j].s - B[i].s <= this.spacing(B[i], B[j]) + EPS * 2;
    let l = idx, r = idx;
    while (l > 0 && B[l - 1].color === c && B[l - 1].grow >= 1 && touching(l - 1, l)) l--;
    while (r < B.length - 1 && B[r + 1].color === c && B[r + 1].grow >= 1 && touching(r, r + 1)) r++;
    const n = r - l + 1;
    if (n < 3) return false;

    const removed = B.slice(l, r + 1);
    const cx = ball.x, cy = ball.y;
    const tint = COLORS[c].tint;
    const fever = this.feverT > 0;
    const mult = fever ? 2 : 1;

    if (fromShot) this.bumpCombo();
    this.bestChain = Math.max(this.bestChain, level);
    const run = this.run;
    run.matches++;
    run.bestChain = Math.max(run.bestChain, level);
    run.bestCombo = Math.max(run.bestCombo, this.shotCombo);
    // 化险为夷：珠串已逼近古井时打出消除
    const close = this.state === 'play' && this.lead(ball.tr) > 0.86;
    if (close) run.closeCalls++;
    let pts = (n * 10 * level + (level > 1 ? 40 * level * (1 + 0.5 * this.perk('chain')) * (this.lv.chainMul || 1) : 0)) * mult;
    if (fromShot && this.shotCombo >= 3) pts += this.shotCombo * 15 * mult;
    pts = Math.round(pts * this.comboMul());
    this.addScore(pts);
    this.shooter.joy = 1;

    this.fx.ring(cx, cy, tint, 1.2 + n * 0.1);
    this.fx.ring(cx, cy, 0xffffff, 0.8 + n * 0.08, 0.3);
    this.fx.text(cx, cy, '+' + pts, { size: 30 + Math.min(level, 5) * 4 + Math.min(n - 3, 6) * 2, font: 'num' });
    this.punch(0.012 + Math.min(n - 3, 6) * 0.004 + (level - 1) * 0.008);
    this.setHitStop(0.035 + Math.min(n - 3, 5) * 0.01);
    // 一次消得多：给一句夸赞
    const big = n >= 10 ? ['酣畅淋漓', '#ff6a3c'] : n >= 7 ? ['痛快', '#ffb02e'] : n >= 5 ? ['漂亮', '#ffd27a'] : null;
    if (big && level < 2) {
      this.fx.text(cx, cy - 56, big[0], { size: 54 + n * 3, fill: ['#fffbe6', big[1]], dur: 1.2, rise: 80, font: 'brush' });
      if (n >= 7) this.ui.flash('rgba(255,220,150,0.22)');
      this.shake(5 + n * 0.6);
    }
    if (level >= 2) {
      this.fx.text(cx, cy - 50, `连锁 ×${level}`, { size: 46 + level * 6, fill: ['#fff6c8', '#ff9d3c'], dur: 1.3, rise: 90, font: 'brush' });
      this.fx.ring(cx, cy, 0xffffff, 2.2 + level * 0.3, 0.7);
      this.setHitStop(0.07 + Math.min(level, 5) * 0.02);
      this.shake(6 + level * 3);
      if (level >= 3) this.ui.flash('rgba(255,220,150,0.35)');
    } else if (fromShot && this.shotCombo >= 3) {
      this.fx.text(cx, cy - 46, `连击 ${this.shotCombo}`, { size: 40 + Math.min(this.shotCombo, 20), fill: ['#fffbe6', COMBO_TIERS[Math.max(0, comboTier(this.shotCombo))].color], stroke: '#2a0a04', font: 'brush' });
      this.shake(4);
    } else {
      this.shake(3);
    }
    sfx.match(level - 1 + Math.min(this.shotCombo, 4));
    if (close && this.t - this.closeT > 4) {
      this.closeT = this.t;
      this.fx.text(cx, cy + 56, '化险为夷', { size: 48, fill: ['#e8fff4', '#4fe0a0'], stroke: '#03281a', dur: 1.3, rise: 50, font: 'brush' });
      this.ui.flash('rgba(120,255,190,0.18)');
    }
    this.destroyBalls(removed, level, cx, cy);
    this.emit('match', { n, level, close });

    return true;
  }

  // 移除一组珠子（可不连续、可跨轨道）：从 (ox,oy) 向外依次爆开、断口记录连锁层级、触发其中的道具
  destroyBalls(list, level, ox, oy) {
    if (!list.length) return 0;
    const set = new Set(list);
    const powers = [];
    const cleared = [];
    let n = 0;
    for (const tr of this.tracks) {
      const B = tr.balls;
      const keep = [];
      let gap = false;
      for (const b of B) {
        if (set.has(b)) {
          if (b.power) powers.push({ type: b.power, x: b.x, y: b.y, color: b.color });
          this.toGhost(b, ox == null ? 0 : (Math.hypot(b.x - ox, b.y - oy) / D) * POP_STAGGER, 1 + Math.min(level - 1, 4) * 0.18);
          gap = true;
        } else {
          // 断口前方的珠子记住连锁层级，回吸再次消除时层级 +1
          if (gap && keep.length) b.chainLevel = Math.max(b.chainLevel, level);
          gap = false;
          keep.push(b);
        }
      }
      const had = B.length;
      n += had - keep.length;
      B.length = 0;
      for (const b of keep) B.push(b);
      if (had && !keep.length && tr.toSpawn > 0 && this.state === 'play') cleared.push(tr);
    }
    this.removedCount += n;
    if (this.state === 'play') {
      this.run.removed += n;
      this.run.bestBurst = Math.max(this.run.bestBurst, n);
    }
    if (this.state === 'play' && !this.boss?.dying) this.addFever(n * (1 + (level - 1) * 0.5));
    // 首领关：每颗被消除的珠子化作一团灯火飞向年兽
    if (this.boss && !this.boss.dying && this.state === 'play') {
      const dmg = level * (this.feverT > 0 ? 2 : 1);
      list.slice(0, 24).forEach((b, k) => this.spawnOrb(b.x, b.y, dmg * (k === 23 ? list.length - 23 : 1)));
    }
    for (const p of powers) this.triggerPower(p, level);
    for (const tr of cleared) this.onTrackCleared(tr, list);
    this.refreshAmmo();
    return n;
  }

  // 被消除的珠子先鼓起、发白，再缩小消失并迸出粒子
  toGhost(b, delay, pow = 1) {
    b.glow.destroy();
    if (b.badge) b.badge.visible = false;
    this.ghostLayer.addChild(b.view);
    this.ghosts.push({ view: b.view, x: b.x, y: b.y, tint: COLORS[b.color].tint, delay, t: 0, burst: false, pow });
    this.popSeq = (this.popSeq || 0) + 1;
  }

  updateGhosts(dt) {
    const G = this.ghosts;
    for (let i = G.length - 1; i >= 0; i--) {
      const g = G[i];
      if (g.delay > 0) { g.delay -= dt; continue; }
      g.t += dt;
      const k = g.t / POP_TIME;
      if (!g.burst && k > 0.35) {
        g.burst = true;
        this.fx.pop(g.x, g.y, g.tint, g.pow);
        // 砰砰砰：每颗都有自己的一声，同一波里音高逐颗升高
        if (this.t - (this.lastPopT || 0) > 0.035) {
          if (this.t - (this.lastPopT || 0) > 0.4) this.popStep = 0;
          sfx.pop(this.popStep++);
          this.lastPopT = this.t;
        }
      }
      if (k >= 1) {
        g.view.destroy({ children: true });
        G.splice(i, 1);
        continue;
      }
      const sc = k < 0.35 ? 1 + 0.4 * (k / 0.35) : 1.4 * (1 - (k - 0.35) / 0.65);
      g.view.scale.set(sc);
      g.view.alpha = 1 - k * 0.4;
    }
  }

  addScore(pts) {
    if (this.endless) pts = Math.round(pts * (1 + 0.25 * this.perk('toad')) * 1.5 ** this.perk('gamble') * (1 + CURSE_SCORE * this.curses));
    if (this.lv.scoreMul) pts = Math.round(pts * this.lv.scoreMul);
    this.score += pts;
    this.ui.setScore(this.score);
  }

  // 半径内所有轨道上的珠子
  ballsNear(x, y, r) {
    const r2 = r * r, out = [];
    for (const b of this.allBalls()) {
      if (this.onBoard(b) && (b.x - x) ** 2 + (b.y - y) ** 2 < r2) out.push(b);
    }
    return out;
  }

  // ================= 灯火燎原（Fever） =================
  addFever(amount) {
    if (this.feverT > 0 || CFG.feverNeed <= 0) return;
    this.fever += (amount * (1 + 0.3 * this.perk('blaze'))) / (CFG.feverNeed * (this.lv.feverMul || 1));
    if (this.fever >= 1) this.startFever();
  }

  startFever() {
    this.fever = 0;
    this.feverT = CFG.feverTime;
    this.feverShots = CFG.feverShots + 2 * this.perk('ember');
    this.run.fevers++;
    this.emit('fever');
    this.fx.text(500, 430, '灯火燎原', { size: 110, fill: ['#fffbe6', '#ffb02e', '#ff4d2e'], stroke: '#3a0a02', dur: 1.8, rise: 30, font: 'brush' });
    this.fx.ring(this.sx, this.sy, 0xffb347, 6, 0.9);
    this.fx.burst(this.sx, this.sy, 0xffb347, 40, 2.2);
    this.shake(12);
    this.setHitStop(0.12);
    this.ui.flash('rgba(255,170,60,0.55)');
    this.ui.setFeverMode(true);
    this.fx.text(500, 540, `火珠 ×${this.feverShots} · 打哪炸哪`, { size: 44, fill: ['#fffbe6', '#ffb02e'], stroke: '#3a0a02', dur: 2, rise: 20, font: 'brush' });
    sfx.fever();
  }

  endFever() {
    this.feverT = 0;
    this.ui.setFeverMode(false);
  }

  feverBlast(x, y, level) {
    const blastR = CFG.feverBlast * (1 + 0.2 * this.perk('thunder'));
    const hit = this.ballsNear(x, y, blastR);
    this.fx.burst(x, y, 0xff8a2e, 30, 1.8);
    this.fx.burst(x, y, 0xffe08a, 14, 1.1, true);
    this.fx.ring(x, y, 0xffb347, blastR / 80, 0.45);
    this.fx.ring(x, y, 0xffffff, blastR / 130, 0.25);
    this.shake(9);
    this.punch(0.025);
    this.setHitStop(0.04);
    buzz(25);
    sfx.blast();
    if (hit.length) {
      const pts = hit.length * 20 * 2;
      this.addScore(pts);
      this.fx.text(x, y, '+' + pts, { size: 34 + Math.min(hit.length, 8) * 2, fill: ['#fffbe6', '#ff9d3c'], font: 'num' });
      this.destroyBalls(hit, level, x, y);
    }
  }

  // ================= 首领：年兽 =================
  createBoss(def) {
    const k = def.r / 102;           // 纹理里脸半径 102px
    const c = new PIXI.Container();
    c.position.set(def.x, def.y);
    const aura = new PIXI.Sprite(TEX.glow);
    aura.anchor.set(0.5); aura.blendMode = PIXI.BLEND_MODES.ADD;
    aura.scale.set((def.r * 3.6) / 128); aura.tint = 0x7a3cff; aura.alpha = 0.55;
    const face = new PIXI.Container();
    face.scale.set(k);
    const body = new PIXI.Sprite(TEX.boss);
    body.anchor.set(0.5);
    const flash = new PIXI.Sprite(TEX.boss);
    flash.anchor.set(0.5); flash.blendMode = PIXI.BLEND_MODES.ADD; flash.alpha = 0;
    const eyeGlows = [-1, 1].map((side) => {
      const s = new PIXI.Sprite(TEX.glow);
      s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.scale.set(0.55); s.position.set(side * 42, -8);
      return s;
    });
    const eyes = new PIXI.Graphics();
    const gem = this.makeBallView(0, true);
    gem.view.scale.set(0.85 / k);
    gem.view.position.set(0, -62);
    face.addChild(body, flash, ...eyeGlows, eyes, gem.view);
    c.addChild(aura, face);
    this.bossLayer.addChild(c);
    this.boss = {
      def, k, c, aura, face, flash, eyes, eyeGlows, gem,
      x: def.x, y: def.y, r: def.r, hp: def.hp, max: def.hp,
      weak: 0, weakT: 0, attackT: 9, tele: 0, next: 'roar', alt: 0,
      hitT: 0, kick: 0, enraged: false, dying: false, dieT: 0, dead: false, popT: 0, blink: 3, hitSfxT: 0,
    };
    this.setWeak();
  }

  bossContains(x, y) {
    const b = this.boss;
    if (!b || b.dying) return false;
    return (x - b.x) ** 2 + (y - b.y) ** 2 < (b.r * 0.82) ** 2;
  }

  gemPos() {
    const b = this.boss;
    return { x: b.x, y: b.y - 62 * b.face.scale.y };
  }

  // 额头宝珠换一种场上存在的颜色（直击用这个颜色才有效）
  setWeak() {
    const b = this.boss;
    let arr = [...this.presentColors()];
    if (!arr.length) arr = [...Array(this.lv.colors).keys()];
    if (arr.length > 1) arr = arr.filter((c) => c !== b.weak);
    b.weak = arr[(Math.random() * arr.length) | 0];
    b.weakT = 7;
    this.setBallColor(b.gem, b.weak);
    const gp = this.gemPos();
    this.fx.ring(gp.x, gp.y, COLORS[b.weak].tint, 0.9, 0.35);
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    if (b.dying) this.popChain(dt);
    if (b.dead) return;
    const t = this.t;
    const bob = Math.sin(t * (b.enraged ? 2.4 : 1.2)) * 8;
    let jx = 0, jy = 0;
    if (b.tele > 0 || (b.dying && b.dieT < 2)) { jx = (Math.random() - 0.5) * 8; jy = (Math.random() - 0.5) * 8; }
    b.kick *= Math.exp(-dt * 8);
    b.x = b.def.x + jx;
    b.y = b.def.y + bob + jy - b.kick * 16;
    b.c.position.set(b.x, b.y);
    const breathe = Math.sin(t * 2) * 0.025;
    b.face.scale.set(b.k * (1 + breathe), b.k * (1 - breathe));
    b.hitT = Math.max(0, b.hitT - dt * 5);
    b.flash.alpha = b.hitT * 0.7;
    b.hitSfxT -= dt;
    const angry = b.tele > 0 || b.enraged;
    b.aura.tint = b.tele > 0 ? 0xff2a3a : b.enraged ? 0xd0306a : 0x7a3cff;
    b.aura.alpha = 0.45 + Math.sin(t * (angry ? 8 : 2)) * 0.15;
    b.gem.view.scale.set((0.85 / b.k) * (1 + Math.sin(t * 5) * 0.06));
    b.gem.body.rotation += dt * 2;

    // 眼睛：盯着灯灵，蓄力/暴怒时变红，偶尔眨眼
    const dx = this.sx - b.x, dy = this.sy - b.y, dl = Math.hypot(dx, dy) || 1;
    const ex = (dx / dl) * 5, ey = (dy / dl) * 4;
    const col = angry ? 0xff4030 : 0xffe14a;
    b.blink -= dt;
    if (b.blink < -0.12) b.blink = 2.5 + Math.random() * 3;
    const e = b.eyes;
    e.clear();
    for (const side of [-1, 1]) {
      const x = side * 42 + ex, y = -8 + ey;
      if (b.blink < 0 && !b.dying) { e.lineStyle(4, col).moveTo(x - 12, y).lineTo(x + 12, y); continue; }
      e.lineStyle(0).beginFill(col).drawEllipse(x, y, 14, b.dying ? 4 : 10).endFill();
      e.beginFill(0x1a0505).drawEllipse(x, y, 3, b.dying ? 2 : 8).endFill();
    }
    for (const g of b.eyeGlows) { g.tint = col; g.alpha = 0.6 + Math.sin(t * 6) * 0.2; }

    if (b.dying) { this.updateBossDeath(dt); return; }
    if (this.state !== 'play') return;

    b.weakT -= dt;
    if (b.weakT <= 0) this.setWeak();

    // 攻击：先蓄力（发抖、眼红）1.1 秒，再出招
    if (b.tele > 0) {
      b.tele -= dt;
      if (b.tele <= 0) this.bossAttack(b.next);
    } else if (!this.tracks.some((tr) => tr.rush)) {
      b.attackT -= dt;
      if (b.attackT <= 0) {
        b.next = b.enraged ? (Math.random() < 0.5 ? 'roar' : 'ink') : (b.alt++ % 2 ? 'ink' : 'roar');
        b.tele = 1.1;
        b.attackT = b.enraged ? 6.5 : 9.5;
        sfx.bossWarn();
      }
    }
  }

  bossAttack(kind) {
    const b = this.boss;
    if (kind === 'roar') {
      this.surgeT = 2.2;
      this.shake(16);
      this.ui.flash('rgba(140,0,30,0.35)');
      this.fx.ring(b.x, b.y, 0xff3040, 6, 0.8);
      this.fx.ring(b.x, b.y, 0xff8060, 4, 0.6);
      this.fx.text(b.x, b.y + b.r + 40, '年兽怒吼', { size: 58, fill: ['#ffd6d6', '#ff4040'], stroke: '#2a0408', dur: 1.4, font: 'brush' });
      sfx.roar();
    } else {
      const cand = [...this.allBalls()].filter((x) => this.onBoard(x) && x.grow >= 1 && !x.power && x.s < x.tr.path.length * 0.92);
      for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
      const n = Math.min(cand.length, b.enraged ? 7 : 5);
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(TEX.ink);
        s.anchor.set(0.5);
        s.scale.set(0.55);
        s.position.set(b.x, b.y + 40);
        this.orbLayer.addChild(s);
        this.inks.push({ s, sx: b.x, sy: b.y + 40, target: cand[i], t: 0, dur: 0.55 + i * 0.08, side: Math.random() < 0.5 ? -1 : 1 });
      }
      this.fx.text(b.x, b.y + b.r + 40, '墨染', { size: 58, fill: ['#efe0ff', '#a066ff'], stroke: '#14052a', dur: 1.3, font: 'brush' });
      this.shake(6);
      sfx.ink();
    }
  }

  updateInks(dt) {
    const I = this.inks;
    for (let i = I.length - 1; i >= 0; i--) {
      const o = I[i];
      o.t += dt;
      const k = Math.min(1, o.t / o.dur);
      const tb = o.target;
      const alive = tb.tr.balls.includes(tb);
      const tx = tb.x, ty = tb.y;
      const cx = (o.sx + tx) / 2 + o.side * 120, cy = Math.min(o.sy, ty) - 140;
      const u = 1 - k;
      o.s.position.set(u * u * o.sx + 2 * u * k * cx + k * k * tx, u * u * o.sy + 2 * u * k * cy + k * k * ty);
      o.s.rotation += dt * 8;
      if (k >= 1) {
        o.s.destroy();
        I.splice(i, 1);
        if (!alive || this.state !== 'play') continue;
        let c;
        do { c = (Math.random() * this.lv.colors) | 0; } while (c === tb.color && this.lv.colors > 1);
        tb.color = c;
        tb.body.texture = TEX.balls[c];
        if (!tb.power) tb.glow.tint = COLORS[c].tint;
        this.fx.burst(tb.x, tb.y, 0xa066ff, 8, 0.7);
        sfx.splat();
        this.checkMatch(tb, 1, false);
        this.refreshAmmo();
      }
    }
  }

  // 消除时飞向年兽的灯火
  spawnOrb(x, y, dmg) {
    const s = new PIXI.Sprite(TEX.glow);
    s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.tint = 0xffd27a; s.scale.set(0.42);
    s.position.set(x, y);
    this.orbLayer.addChild(s);
    const a = Math.random() * Math.PI * 2;
    this.orbs.push({ s, x0: x, y0: y, cx: x + Math.cos(a) * 160, cy: y + Math.sin(a) * 160, t: 0, dur: 0.45 + Math.random() * 0.3, dmg });
  }

  updateOrbs(dt) {
    const O = this.orbs, b = this.boss;
    for (let i = O.length - 1; i >= 0; i--) {
      const o = O[i];
      o.t += dt;
      const k = Math.min(1, o.t / o.dur);
      const tx = b ? b.x : o.x0, ty = b ? b.y : o.y0;
      const e = k * k, u = 1 - e;
      const x = u * u * o.x0 + 2 * u * e * o.cx + e * e * tx;
      const y = u * u * o.y0 + 2 * u * e * o.cy + e * e * ty;
      o.s.position.set(x, y);
      if (Math.random() < 0.6) this.fx.trail(x, y, 0xffb347, 0.8);
      if (k >= 1) {
        o.s.destroy();
        O.splice(i, 1);
        this.damageBoss(o.dmg, false);
      }
    }
  }

  damageBoss(d, big) {
    const b = this.boss;
    if (!b || b.dying) return;
    b.hp = Math.max(0, b.hp - d);
    b.hitT = big ? 1 : Math.max(b.hitT, 0.5);
    b.kick = Math.min(1, b.kick + (big ? 1 : 0.15));
    if (b.hitSfxT <= 0 || big) { sfx.bossHit(big); b.hitSfxT = 0.07; }
    this.ui.setBossHp(b.hp / b.max);
    if (!b.enraged && b.hp <= b.max * 0.5) this.enrageBoss();
    if (b.hp <= 0) this.killBoss();
  }

  shotHitsBoss(p) {
    const b = this.boss;
    const gp = this.gemPos();
    if (p.color === b.weak || p.color === RAINBOW) {
      const dmg = 8 * (this.feverT > 0 ? 2 : 1);
      this.fx.burst(gp.x, gp.y, COLORS[b.weak].tint, 30, 1.6);
      this.fx.ring(gp.x, gp.y, 0xffffff, 2.4, 0.5);
      this.fx.text(gp.x, gp.y - 40, `-${dmg}`, { size: 54, fill: ['#ffffff', '#ffc23d'], font: 'num', dur: 1 });
      this.shake(9);
      this.setHitStop(0.07);
      this.shooter.joy = 1;
      this.bumpCombo();
      this.run.gemHits++;
      this.run.bestCombo = Math.max(this.run.bestCombo, this.shotCombo);
      this.emit('gem');
      this.addScore(100 * (this.feverT > 0 ? 2 : 1));
      b.attackT += 1;
      this.damageBoss(dmg, true);
      if (!b.dying) this.setWeak();
    } else {
      this.fx.burst(p.x, p.y, 0x6a40a8, 10, 0.7);
      this.fx.text(p.x, p.y - 30, '无效', { size: 30, fill: ['#d8d4ee', '#8a86a8'], stroke: '#14082a', font: 'brush', dur: 0.8, rise: 40 });
      this.breakCombo();
      sfx.clack();
    }
  }

  enrageBoss() {
    const b = this.boss;
    b.enraged = true;
    b.attackT = Math.min(b.attackT, 2.5);
    this.fx.text(b.x, b.y - b.r - 20, '年兽暴怒', { size: 76, fill: ['#ffe0e0', '#ff3030'], stroke: '#2a0408', dur: 1.6, font: 'brush' });
    this.ui.flash('rgba(200,20,40,0.4)');
    this.shake(14);
    sfx.roar();
  }

  killBoss() {
    const b = this.boss;
    b.dying = true;
    b.dieT = 0;
    b.popT = 0.6;
    b.tele = 0;
    for (const tr of this.tracks) tr.toSpawn = 0;
    this.surgeT = 0;
    for (const o of this.inks) o.s.destroy();
    this.inks = [];
    this.fx.text(500, 470, '年兽退散', { size: 110, fill: ['#fffbe6', '#ffd27a', '#ff9d3c'], stroke: '#3a1606', dur: 2.2, rise: 30, font: 'brush' });
    this.ui.flash('rgba(255,240,200,0.75)');
    this.setHitStop(0.4);
    this.shake(22);
    sfx.bossDie();
  }

  updateBossDeath(dt) {
    const b = this.boss;
    b.dieT += dt;
    if (b.dieT < 2 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * b.r;
      this.fx.burst(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, COLORS[(Math.random() * 6) | 0].tint, 8, 1.2);
    }
    if (b.dieT > 1.5) {
      const k = Math.min(1, (b.dieT - 1.5) / 0.7);
      b.c.alpha = 1 - k;
      b.c.scale.set(1 + k * 0.35);
    }
    if (b.dieT > 2.2 && !b.dead) {
      b.dead = true;
      b.c.visible = false;
      this.fx.burst(b.x, b.y, 0xffd27a, 60, 2.6);
      this.fx.ring(b.x, b.y, 0xffffff, 6, 0.9);
      this.shake(18);
      sfx.boom();
      this.ui.setBoss(null);
    }
  }

  // 年兽被击败后，残余珠串从最前端开始一颗颗炸开，每颗 +20
  popChain(dt) {
    const b = this.boss;
    b.popT -= dt;
    if (b.popT <= 0) {
      b.popT = 0.05;
      for (const tr of this.tracks) {
        const last = tr.balls[tr.balls.length - 1];
        if (!last) continue;
        if (last.s < 0) { tr.balls.pop(); this.killBall(last); continue; }
        this.addScore(20);
        this.destroyBalls([last], 1, last.x, last.y);
        sfx.tick();
      }
    }
  }

  // ================= 道具 =================
  rollPower() {
    const keys = Object.keys(POWERS);
    let total = 0;
    for (const k of keys) total += POWERS[k].w;
    let r = Math.random() * total;
    for (const k of keys) { r -= POWERS[k].w; if (r <= 0) return k; }
    return keys[0];
  }

  setPower(b, type) {
    if (b.badge) { b.badge.destroy(); b.badge = null; }
    b.power = type;
    if (!type) { b.glow.tint = COLORS[b.color].tint; return; }
    b.powerLife = CFG.powerLife;
    const badge = new PIXI.Sprite(TEX.icons[type]);
    badge.anchor.set(0.5);
    b.view.addChild(badge);
    b.badge = badge;
    b.glow.tint = POWERS[type].tint;
    this.fx.ring(b.x, b.y, POWERS[type].tint, 1, 0.5);
    sfx.powerAppear();
    if (!this.powerHinted) {
      this.powerHinted = true;
      this.ui.hint('击中并消除带图标的珠子，可触发道具', 4500);
    }
  }

  triggerPower(p, level) {
    const def = POWERS[p.type];
    const mult = this.feverT > 0 ? 2 : 1;
    this.fx.text(p.x, p.y - 50, def.name, { size: 56, fill: ['#ffffff', def.color], stroke: '#14082a', dur: 1.3, rise: 80, font: 'brush' });
    this.fx.ring(p.x, p.y, def.tint, 2.6, 0.6);
    let pts = 50;
    this.run.powers[p.type] = (this.run.powers[p.type] || 0) + 1;
    this.run.powerCount++;
    this.emit('power', p.type);
    switch (p.type) {
      case 'bomb': {
        const bombR = CFG.bombRadius * (1 + 0.4 * this.perk('thunder'));
        const hit = this.ballsNear(p.x, p.y, bombR);
        this.fx.burst(p.x, p.y, def.tint, 40, 2);
        this.fx.ring(p.x, p.y, 0xffd27a, bombR / 90, 0.5);
        this.shake(16);
        this.setHitStop(0.1);
        this.ui.flash('rgba(255,140,60,0.35)');
        sfx.boom();
        pts += hit.length * 10;
        this.destroyBalls(hit, level, p.x, p.y);
        break;
      }
      case 'lightning': {
        const hit = [...this.allBalls()].filter((b) => this.onBoard(b) && b.color === p.color);
        for (const b of hit) this.fx.bolt(p.x, p.y, b.x, b.y, def.tint);
        this.shake(8);
        this.ui.flash('rgba(255,240,150,0.3)');
        sfx.zap();
        pts += hit.length * 10;
        this.destroyBalls(hit, level, p.x, p.y);
        break;
      }
      case 'slow':
        this.slowT = CFG.slowTime * (1 + 0.5 * this.perk('long'));
        this.reverseT = 0;
        sfx.slow();
        break;
      case 'reverse':
        this.reverseT = CFG.reverseTime * (1 + 0.5 * this.perk('long'));
        sfx.reverse();
        break;
      case 'rainbow':
        this.cur = RAINBOW;
        this.updateAmmoView();
        this.shooter.swapT = 1;
        this.fx.burst(this.sx, this.sy, 0xffffff, 18, 1.2);
        sfx.rainbow();
        break;
    }
    this.addScore(pts * mult);
  }

  updateProjectiles(dt) {
    const P = this.projectiles;
    const lim = 1600;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      let hit = null, hitBoss = false;
      const sub = 3;
      for (let k = 0; k < sub && !hit && !hitBoss; k++) {
        p.x += (p.vx * dt) / sub;
        p.y += (p.vy * dt) / sub;
        hit = this.findHit(p.x, p.y);
        hitBoss = !hit && this.bossContains(p.x, p.y);
      }
      p.view.position.set(p.x, p.y);
      p.body.rotation += dt * 14;
      this.emitTrail(p);
      if (hitBoss) {
        this.shotHitsBoss(p);
        p.view.destroy({ children: true });
        P.splice(i, 1);
      } else if (hit && p.fire) {
        this.feverBlast(hit.x, hit.y, 1);
      } else if (hit) {
        this.insertBall(p, hit);
        p.view.destroy({ children: true });
        P.splice(i, 1);
      } else if (p.x < -lim || p.x > WORLD + lim || p.y < -lim || p.y > WORLD + lim) {
        p.view.destroy({ children: true });
        P.splice(i, 1);
        this.breakCombo();
        if (this.state === 'play') { this.run.misses++; this.emit('miss'); }
      }
    }
  }

  findHit(x, y) {
    let best = null, bd = (D * 0.88) ** 2;
    for (const b of this.allBalls()) {
      if (!this.onBoard(b)) continue;
      const dx = b.x - x, dy = b.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  insertBall(p, hit) {
    const tr = hit.tr, B = tr.balls;
    const i = B.indexOf(hit);
    tr.path.at(hit.s, this.tmp);
    const front = (p.x - this.tmp.x) * this.tmp.tx + (p.y - this.tmp.y) * this.tmp.ty > 0;
    // 彩珠：变成被击中珠子的颜色
    const color = p.color === RAINBOW ? hit.color : p.color;
    if (p.color === RAINBOW) this.fx.burst(p.x, p.y, 0xffffff, 14, 1);
    const nb = this.makeBall(tr, color, front ? hit.s + R : hit.s - R);
    nb.grow = 0;
    nb.fx = p.x; nb.fy = p.y;
    nb.x = p.x; nb.y = p.y;
    B.splice(front ? i + 1 : i, 0, nb);
    this.insertedCount++;
    this.fx.ring(p.x, p.y, COLORS[color].tint, 0.6, 0.18);
    this.shake(1.5);
    sfx.insert();
  }

  // ================= 渲染 =================
  renderBalls() {
    const tmp = this.tmp;
    for (const tr of this.tracks) {
      const L = tr.path.length;
      for (const b of tr.balls) {
        tr.path.at(b.s, tmp);
        let x = tmp.x, y = tmp.y;
        let squash = 1;
        if (b.grow < 1) {
          const e = easeOut(b.grow);
          x = b.fx + (x - b.fx) * e;
          y = b.fy + (y - b.fy) * e;
          squash = 1 + Math.sin(b.grow * Math.PI) * 0.18;
        }
        b.x = x; b.y = y;
        const a = b.s < 0 ? clamp(1 + b.s / D, 0, 1) : 1;
        let sc = squash;
        if (b.s > L - D) sc = clamp((L - b.s) / D + 0.25, 0.25, 1);
        b.view.visible = a > 0.01;
        b.view.position.set(x, y);
        b.view.alpha = a;
        b.view.scale.set(sc);
        b.body.rotation = b.s / R;
        b.glow.position.set(x, y);
        b.glow.alpha = 0.3 * a;
        if (b.badge) {
          const blink = b.powerLife < 3 ? (Math.sin(this.t * 18) > 0 ? 1 : 0.3) : 1;
          b.badge.alpha = blink;
          b.badge.scale.set(((0.64 * D) / 88) * (1 + 0.08 * Math.sin(this.t * 6)));
          b.glow.alpha = (0.55 + 0.2 * Math.sin(this.t * 6)) * a * blink;
        }
      }
    }
    if (this.endless) this.ui.setProgress((this.levelTime % ENDLESS_STAGE) / ENDLESS_STAGE);
    else if (this.boss) this.ui.setProgress(1 - this.boss.hp / this.boss.max);
    else this.ui.setProgress(this.removedCount / Math.max(1, (this.totalCount || 1) + this.insertedCount));
  }

  updateShooter(dt) {
    const sh = this.shooter;
    if (!sh) return;
    const dx = this.aim.x - this.sx, dy = this.aim.y - this.sy;
    if (dx * dx + dy * dy > 100) this.aimAng = Math.atan2(dy, dx);
    const ca = Math.cos(this.aimAng), sa = Math.sin(this.aimAng);
    const fever = this.feverT > 0;
    const bob = Math.sin(this.t * (fever ? 6 : 2.2)) * 3;

    sh.recoil = Math.max(0, sh.recoil - dt * 6);
    sh.swapT = Math.max(0, sh.swapT - dt * 5);
    sh.transferT = Math.max(0, sh.transferT - dt / TRANSFER_TIME);
    sh.joy = Math.max(0, sh.joy - dt * 1.6);
    const rec = sh.recoil * 12;
    const hop = Math.sin(sh.joy * Math.PI) * 10 * (sh.joy > 0 ? 1 : 0);
    const tremble = this.danger > 0.5 ? (Math.random() - 0.5) * this.danger * 3 : 0;
    sh.body.position.set(-ca * rec * 0.4 + tremble, bob - sh.recoil * 3 - hop);
    sh.body.scale.set(1 + sh.recoil * 0.06 + sh.joy * 0.05, 1 - sh.recoil * 0.05 + sh.joy * 0.03);
    sh.halo.alpha = (fever ? 0.85 : 0.45) + Math.sin(this.t * (fever ? 9 : 3)) * 0.1 + sh.recoil * 0.3;
    sh.halo.tint = fever ? 0xff6a1e : (this.skinHalo ?? 0xffa53d);
    sh.halo.scale.set(fever ? 3.4 : 2.4);
    if (fever && Math.random() < 0.5) {
      const a = Math.random() * Math.PI * 2;
      this.fx.ember(this.sx + Math.cos(a) * 50, this.sy + Math.sin(a) * 40);
    }

    // 手上的珠：从灯笼底部"递"上来
    const dist = MUZZLE - rec;
    const mx = ca * dist, my = sa * dist + bob;
    const bx = sh.body.x, by = sh.body.y + 72;
    const p = easeOut(1 - sh.transferT);
    sh.cur.view.position.set(bx + (mx - bx) * p, by + (my - by) * p);
    sh.cur.view.scale.set(0.5 + 0.5 * p + sh.swapT * 0.2);
    sh.cur.body.rotation += dt * 1.5;
    sh.next.view.scale.set(0.5 * easeOut(1 - sh.transferT) + sh.swapT * 0.2);

    // 眼睛：看向瞄准方向；开心时眯眼，危险时睁大，偶尔眨眼
    sh.blink -= dt;
    if (sh.blink < -0.12) sh.blink = 2 + Math.random() * 3;
    const e = sh.eyes;
    e.clear();
    const ex = ca * 4, ey = sa * 3 - 4;
    const big = this.danger > 0.5 ? 1.25 : 1;
    for (const side of [-1, 1]) {
      const x = side * 17 + ex, y = ey;
      if (sh.joy > 0.15 || fever) {
        e.lineStyle(3.5, 0x3a1608).moveTo(x - 7, y + 2).quadraticCurveTo(x, y - 7, x + 7, y + 2);
      } else if (sh.blink < 0) {
        e.lineStyle(3, 0x3a1608).moveTo(x - 6, y).lineTo(x + 6, y);
      } else {
        e.lineStyle(0).beginFill(0x3a1608).drawEllipse(x, y, 6 * big, 8 * big).endFill();
        e.beginFill(0xffffff).drawCircle(x - 2, y - 3, 2.2 * big).endFill();
      }
    }
  }

  updateHoles(dt) {
    for (const tr of this.tracks) {
      const h = tr.hole;
      if (!h) continue;
      const d = tr.danger;
      h.swirl.rotation += dt * (2 + d * 6);
      h.stones.rotation -= dt * 0.15;
      h.glow.tint = lerpColor(0x7a5cff, 0xff2a4a, d);
      h.glow.scale.set(2.3 + Math.sin(this.t * (3 + d * 6)) * 0.15 * (0.4 + d));
    }
  }

  drawGuide() {
    const g = this.guide;
    g.clear();
    if (this.state !== 'play') return;
    if (!this.mouseMode && !this.aiming) return;
    const ca = Math.cos(this.aimAng), sa = Math.sin(this.aimAng);
    const x0 = this.sx + ca * MUZZLE, y0 = this.sy + sa * MUZZLE;
    let hitD = 1500, hit = null, hitBoss = false;
    const r2 = (D * 0.88) ** 2;
    const balls = [...this.allBalls()].filter((b) => this.onBoard(b));
    outer: for (let d = 0; d < 1500; d += 8) {
      const x = x0 + ca * d, y = y0 + sa * d;
      if (x < -200 || x > WORLD + 200 || y < -200 || y > WORLD + 200) { hitD = d; break; }
      if (this.bossContains(x, y)) { hitD = d; hitBoss = true; break; }
      for (const b of balls) {
        const dx = b.x - x, dy = b.y - y;
        if (dx * dx + dy * dy < r2) { hitD = d; hit = b; break outer; }
      }
    }
    const tint = COLORS[this.cur].tint;
    const phase = (this.t * 60) % 26;
    // 引导点按屏幕像素保底，手机上缩小后也清晰可见
    const dotR = Math.max(3.2, 2.4 / this.scale), ringW = Math.max(3, 2.2 / this.scale);
    for (let d = 26 + phase; d < hitD; d += 26) {
      const a = 0.6 * (1 - (d / hitD) * 0.7);
      g.beginFill(tint, a).drawCircle(x0 + ca * d, y0 + sa * d, dotR).endFill();
    }
    if (hit) g.lineStyle(ringW, tint, 0.9).drawCircle(hit.x, hit.y, R + 5);
    if (hitBoss) {
      // 瞄准年兽：颜色对得上宝珠时金圈，否则灰圈
      const b = this.boss, ok = this.cur === b.weak || this.cur === RAINBOW;
      const gp = this.gemPos();
      g.lineStyle(ok ? 4 : 2, ok ? 0xffd27a : 0x8a86a8, ok ? 0.95 : 0.6).drawCircle(gp.x, gp.y, ok ? 30 + Math.sin(this.t * 10) * 3 : 26);
    }
  }

  updateDanger(dt) {
    let worst = 0;
    for (const tr of this.tracks) {
      const target = this.state === 'play' ? clamp((this.lead(tr) - 0.7) / 0.22, 0, 1) : 0;
      tr.danger += (target - tr.danger) * Math.min(1, dt * 4);
      worst = Math.max(worst, tr.danger);
    }
    this.danger = worst;
    this.ui.setDanger(this.danger * 0.85);
    music.setIntensity(Math.max(this.danger, this.feverT > 0 ? 0.7 : 0));
    if (this.state === 'play' && this.danger > 0.3) {
      this.heartT -= dt;
      if (this.heartT <= 0) { sfx.heart(); this.heartT = 1.1 - this.danger * 0.5; }
    }
  }

  applyShake(dt) {
    this.shakeAmt *= Math.exp(-dt * 10);
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    const s = this.shakeAmt * this.scale * CFG.shake;
    this.punchAmt = (this.punchAmt || 0) * Math.exp(-dt * 14);
    if (this.punchAmt < 0.0005) this.punchAmt = 0;
    const p = this.punchAmt * CFG.shake, cx = this.screenW / 2, cy = this.screenH / 2;
    this.world.scale.set(this.scale * (1 + p));
    this.world.position.set(
      cx - (cx - this.baseX) * (1 + p) + (Math.random() - 0.5) * s * 2,
      cy - (cy - this.baseY) * (1 + p) + (Math.random() - 0.5) * s * 2,
    );
  }

  // 过关后的"灯路余光"：每条轨道一道光从古井倒着跑回珠串最远到过的位置，剩余轨道越长奖励越多
  updateWinRun(dt) {
    for (const tr of this.tracks) {
      const w = tr.winRun;
      if (!w || w.done) continue;
      const L = tr.path.length;
      w.s -= (L / 1.3) * dt;
      if (w.s <= w.stopS) { w.s = w.stopS; w.done = true; }
      tr.path.at(w.s, this.tmp);
      this.fx.burst(this.tmp.x, this.tmp.y, 0xffd27a, 2, 0.4, true);
      this.fx.trail(this.tmp.x, this.tmp.y, 0xffe6a0, 2.4);
      w.acc += (L / 1.3) * dt;
      if (w.acc > 90) { w.acc = 0; sfx.tick(); }
      if (w.done && w.bonus > 0) {
        this.fx.text(this.tmp.x, this.tmp.y - 40, `余光 +${w.bonus}`, { size: 44, font: 'brush', dur: 1.4 });
        this.addScore(w.bonus);
      }
    }
  }

  starsFor(score) {
    // 首领关按用时评星
    if (this.boss) return 1 + (this.levelTime < 150 ? 1 : 0) + (this.levelTime < 100 ? 1 : 0);
    const c = this.totalCount;
    return 1 + (score >= c * 28 ? 1 : 0) + (score >= c * 45 ? 1 : 0);
  }

  checkEnd(dt) {
    const T = this.tracks;
    if (this.state === 'play') {
      const lost = T.find((tr) => tr.balls.length && tr.balls[tr.balls.length - 1].s >= tr.path.length);
      if (lost) {
        // 首领已被击败的收尾阶段不再询问
        if (!this.boss?.dying && this.ui.offerRevive?.(this.revives)) {
          this.state = 'revive';
          this.endFever();
          sfx.heart();
        } else this.loseGame();
      } else if (T.every((tr) => tr.toSpawn === 0 && tr.balls.length === 0) && (!this.boss || this.boss.dead)) {
        this.run.maxLead = Math.max(...T.map((tr) => tr.maxLead));
        this.state = 'win';
        this.endTimer = 0;
        this.endFever();
        this.setHitStop(0.35);
        sfx.win();
        this.ui.flash('rgba(255,230,170,0.5)');
        this.fx.text(500, 470, '过关', { size: 120, dur: 1.8, rise: 40, font: 'brush' });
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          this.fx.burst(this.sx + Math.cos(a) * 120, this.sy + Math.sin(a) * 120, COLORS[k % 6].tint, 16, 1.3);
        }
        this.fx.ring(this.sx, this.sy, 0xffd27a, 4, 0.9);
        for (const tr of T) {
          const L = tr.path.length;
          const bonus = Math.round(((1 - tr.maxLead) * 20) / T.length) * 50;
          tr.winRun = { s: L, stopS: Math.max(0, tr.maxLead * L), bonus, acc: 0, done: false };
        }
      }
    } else if (this.state === 'lose') {
      this.endTimer += dt;
      if (T.every((tr) => tr.balls.length === 0) || this.endTimer > 4) {
        this.state = 'over';
        this.ui.onLose(this.levelIndex, this.score, {
          time: Math.round(this.levelTime), stage: this.stage, bestChain: this.bestChain, perks: { ...this.perks },
        });
      }
    } else if (this.state === 'win') {
      this.endTimer += dt;
      if (this.endTimer > 2.6 && T.every((tr) => !tr.winRun || tr.winRun.done)) {
        this.state = 'over';
        this.ui.onWin(this.levelIndex, this.score, this.starsFor(this.score), {
          bestChain: this.bestChain,
          time: this.boss ? Math.round(this.levelTime) : null,
        });
      }
    }
  }
}
