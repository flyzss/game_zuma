// 粒子、冲击波、飘字
import { TEX } from './textures.js';
import { CFG } from './config.js';

// 书法体用于大字特效，数字用衬线展示体
export const FONTS = {
  brush: '"Ma Shan Zheng","STXingkai","STKaiti","KaiTi",serif',
  num: '"Cinzel","ZCOOL XiaoWei","Georgia",serif',
  ui: '"ZCOOL XiaoWei","Noto Serif SC","STSong","SimSun",serif',
};

const TEXT_K = matchMedia('(pointer: coarse)').matches ? 1.3 : 1;

export class FX {
  constructor(layer, textLayer) {
    this.layer = layer;
    this.textLayer = textLayer;
    this.items = [];
    this.pool = [];
    this.texts = [];
    this.gfx = [];
  }

  // 闪电：锯齿折线，外层彩色光晕 + 内层白芯
  bolt(x1, y1, x2, y2, tint, dur = 0.4) {
    const g = new PIXI.Graphics();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const n = Math.max(4, Math.round(len / 40));
    const pts = [[x1, y1]];
    for (let i = 1; i < n; i++) {
      const t = i / n, o = (Math.random() - 0.5) * 36;
      pts.push([x1 + dx * t + nx * o, y1 + dy * t + ny * o]);
    }
    pts.push([x2, y2]);
    for (const [w, c, a] of [[9, tint, 0.45], [3, 0xffffff, 1]]) {
      g.lineStyle({ width: w, color: c, alpha: a, join: 'round', cap: 'round' });
      pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    }
    this.layer.addChild(g);
    this.gfx.push({ g, life: 0, max: dur });
  }

  _sprite(tex) {
    let s = this.pool.pop();
    if (!s) {
      s = new PIXI.Sprite();
      s.anchor.set(0.5);
      s.blendMode = PIXI.BLEND_MODES.ADD;
    }
    s.texture = tex;
    s.rotation = 0;
    s.alpha = 1;
    s.tint = 0xffffff;
    this.layer.addChild(s);
    return s;
  }

  _add(tex, x, y, o) {
    const s = this._sprite(tex);
    if (o.tint != null) s.tint = o.tint;
    const p = Object.assign({ s, x, y, vx: 0, vy: 0, life: 0, max: 0.5, s0: 0.3, s1: 0, a0: 1, drag: 0, grav: 0, spin: 0, ease: false }, o);
    s.position.set(x, y);
    s.scale.set(p.s0);
    this.items.push(p);
    return p;
  }

  burst(x, y, tint, n = 14, power = 1, noFlash = false) {
    if (!noFlash) this._add(TEX.glow, x, y, { tint, max: 0.3, s0: 1.2 * power, s1: 0.3, a0: 0.9 });
    n = Math.round(n * CFG.particles);
    for (let i = 0; i < n; i++) {
      const star = Math.random() < 0.45;
      const a = Math.random() * Math.PI * 2;
      const v = (140 + Math.random() * 300) * power;
      this._add(star ? TEX.spark : TEX.glow, x, y, {
        tint: Math.random() < 0.25 ? 0xffffff : tint,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        max: 0.45 + Math.random() * 0.45,
        s0: star ? 0.4 + Math.random() * 0.35 : 0.12 + Math.random() * 0.16,
        s1: 0, drag: 3, grav: 60, spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  trail(x, y, tint, size = 1) {
    this._add(TEX.glow, x, y, { tint, max: 0.22, s0: 0.32 * size, s1: 0.05, a0: 0.55 });
  }

  // 火星：缓缓上飘（灯火燎原时环绕主角）
  ember(x, y) {
    this._add(TEX.spark, x, y, {
      tint: Math.random() < 0.5 ? 0xffb347 : 0xff5a2e,
      vx: (Math.random() - 0.5) * 40, vy: -80 - Math.random() * 90,
      max: 0.6 + Math.random() * 0.5, s0: 0.25 + Math.random() * 0.25, s1: 0, spin: 4,
    });
  }

  ring(x, y, tint, size = 1.4, dur = 0.5) {
    this._add(TEX.ring, x, y, { tint, max: dur, s0: 0.12, s1: size, a0: 0.9, ease: true });
  }

  text(x, y, str, o = {}) {
    // 触屏上棋盘缩得更小，飘字相应放大，保证看得清、有冲击力
    if (TEXT_K !== 1) o = { ...o, size: (o.size || 34) * TEXT_K };
    const style = new PIXI.TextStyle({
      fontFamily: FONTS[o.font || 'num'],
      fontSize: o.size || 34,
      fontWeight: o.font === 'brush' ? '400' : '700',
      padding: 12,
      fill: o.fill || ['#ffffff', '#ffe08a'],
      stroke: o.stroke || '#3a1606',
      strokeThickness: o.size ? Math.max(5, o.size / 7) : 6,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 8,
      dropShadowDistance: 0,
      dropShadowAlpha: 0.6,
    });
    const t = new PIXI.Text(str, style);
    t.resolution = 2;
    t.anchor.set(0.5);
    x = Math.min(Math.max(x, 110), 890);   // 避免贴边被 HUD 遮挡
    y = Math.min(Math.max(y, 120), 940);
    t.position.set(x, y);
    this.textLayer.addChild(t);
    this.texts.push({ t, x, y, life: 0, max: o.dur || 1.1, rise: o.rise ?? 70 });
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        this.layer.removeChild(p.s);
        this.pool.push(p.s);
        items[i] = items[items.length - 1];
        items.pop();
        continue;
      }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const e = p.ease ? 1 - (1 - k) ** 3 : k;
      p.s.position.set(p.x, p.y);
      p.s.scale.set(p.s0 + (p.s1 - p.s0) * e);
      p.s.alpha = p.a0 * (1 - k);
      if (p.spin) p.s.rotation += p.spin * dt;
    }
    for (let i = this.gfx.length - 1; i >= 0; i--) {
      const o = this.gfx[i];
      o.life += dt;
      if (o.life >= o.max) { o.g.destroy(); this.gfx.splice(i, 1); continue; }
      o.g.alpha = 1 - o.life / o.max;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const o = this.texts[i];
      o.life += dt;
      const k = o.life / o.max;
      if (k >= 1) {
        o.t.destroy();
        this.texts.splice(i, 1);
        continue;
      }
      o.t.y = o.y - o.rise * (1 - (1 - k) ** 2);
      const sc = k < 0.12 ? 0.5 + (k / 0.12) * 0.75 : Math.max(1, 1.25 - (k - 0.12) * 2);
      o.t.scale.set(sc);
      o.t.alpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    }
  }

  clear() {
    for (const p of this.items) { this.layer.removeChild(p.s); this.pool.push(p.s); }
    this.items.length = 0;
    for (const o of this.texts) o.t.destroy();
    this.texts.length = 0;
    for (const o of this.gfx) o.g.destroy();
    this.gfx.length = 0;
  }
}
