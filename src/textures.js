// 全部美术资源程序化生成（Canvas 2D → PIXI 纹理），后期可替换为正式美术图
export const COLORS = [
  { hex: '#ff4b5c', light: '#ffd3d8', dark: '#6e0c1f', tint: 0xff4b5c, sym: 'ring' },
  { hex: '#ffc531', light: '#fff4c8', dark: '#7d4a00', tint: 0xffc531, sym: 'diamond' },
  { hex: '#35dc8a', light: '#d6ffea', dark: '#08603a', tint: 0x35dc8a, sym: 'tri' },
  { hex: '#36b3ff', light: '#d4f0ff', dark: '#0a4580', tint: 0x36b3ff, sym: 'square' },
  { hex: '#c25cf5', light: '#f3dcff', dark: '#4a0f78', tint: 0xc25cf5, sym: 'star' },
  { hex: '#ff8fd6', light: '#ffe4f6', dark: '#7c1f5d', tint: 0xff8fd6, sym: 'cross' },
  // 彩珠：只作为发射物出现，插入时变成被击中珠子的颜色
  { hex: '#ffffff', light: '#ffffff', dark: '#5a4a8a', tint: 0xffffff, sym: 'rainbow' },
];
export const RAINBOW = 6;

// 道具：随机附着在珠串上的珠子，限时，消除该珠即触发
export const POWERS = {
  bomb:      { name: '炸裂', color: '#ff7a3c', tint: 0xff7a3c, w: 3 },
  slow:      { name: '缓行', color: '#6fd3ff', tint: 0x6fd3ff, w: 2.2 },
  reverse:   { name: '倒流', color: '#c39bff', tint: 0xc39bff, w: 2 },
  lightning: { name: '雷光', color: '#ffe25c', tint: 0xffe25c, w: 1.4 },
  rainbow:   { name: '彩珠', color: '#ffffff', tint: 0xffffff, w: 2 },
};

export const TEX = {};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function poly(g, n, r, rot = -Math.PI / 2, inner = 0) {
  g.beginPath();
  const m = inner ? n * 2 : n;
  for (let i = 0; i < m; i++) {
    const rr = inner && i % 2 ? inner : r;
    const a = rot + (i / m) * Math.PI * 2;
    i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

// 每种颜色带一个独立符号：既增加滚动感，也照顾色弱玩家
function symbol(g, type, s) {
  switch (type) {
    case 'ring':
      g.lineWidth = s * 0.34;
      g.beginPath(); g.arc(0, 0, s * 0.9, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, 0, s * 0.28, 0, Math.PI * 2); g.fill();
      break;
    case 'diamond':
      g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(s * 0.82, 0); g.lineTo(0, s * 1.2); g.lineTo(-s * 0.82, 0);
      g.closePath(); g.fill();
      break;
    case 'tri':
      poly(g, 3, s * 1.2); g.fill();
      break;
    case 'square':
      poly(g, 4, s * 1.1, Math.PI / 4); g.fill();
      break;
    case 'star':
      poly(g, 5, s * 1.25, -Math.PI / 2, s * 0.52); g.fill();
      break;
    case 'cross':
      g.lineWidth = s * 0.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 0.9, 0); g.lineTo(s * 0.9, 0); g.moveTo(0, -s * 0.9); g.lineTo(0, s * 0.9); g.stroke();
      break;
  }
}

function rainbowBallTex() {
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  let gr;
  if (g.createConicGradient) {
    gr = g.createConicGradient(0, C, C);
    COLORS.slice(0, 6).forEach((col, i) => gr.addColorStop(i / 6, col.hex));
    gr.addColorStop(1, COLORS[0].hex);
  } else {
    gr = g.createLinearGradient(0, 0, S, S);
    COLORS.slice(0, 6).forEach((col, i) => gr.addColorStop(i / 5, col.hex));
  }
  g.fillStyle = gr;
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
  gr = g.createRadialGradient(C, C, 0, C, C, r);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(C, C);
  g.shadowColor = '#7a4cff'; g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  poly(g, 4, 30, -Math.PI / 2, 9); g.fill();
  g.restore();
  return PIXI.Texture.from(c);
}

function iconTex(type) {
  const S = 128, C = 64;
  const [c, g] = canvas(S, S);
  const p = POWERS[type];
  g.fillStyle = 'rgba(12,8,32,0.42)';
  g.beginPath(); g.arc(C, C, 44, 0, Math.PI * 2); g.fill();
  g.strokeStyle = p.color; g.lineWidth = 5;
  g.shadowColor = p.color; g.shadowBlur = 10;
  g.beginPath(); g.arc(C, C, 44, 0, Math.PI * 2); g.stroke();
  g.translate(C, C);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff';
  g.lineCap = 'round'; g.lineJoin = 'round';
  switch (type) {
    case 'bomb':
      g.beginPath(); g.arc(-3, 6, 20, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.beginPath(); g.moveTo(9, -9); g.quadraticCurveTo(16, -22, 24, -22); g.stroke();
      g.fillStyle = p.color; g.save(); g.translate(26, -24); poly(g, 4, 10, 0, 3); g.fill(); g.restore();
      break;
    case 'slow':
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(-18, -26); g.lineTo(18, -26); g.moveTo(-18, 26); g.lineTo(18, 26); g.stroke();
      g.beginPath(); g.moveTo(-14, -22); g.lineTo(14, -22); g.lineTo(0, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(14, 22); g.lineTo(-14, 22); g.closePath(); g.globalAlpha = 0.55; g.fill();
      break;
    case 'reverse':
      for (const dx of [-12, 12]) {
        g.beginPath(); g.moveTo(dx - 12, 0); g.lineTo(dx + 12, -18); g.lineTo(dx + 12, 18); g.closePath(); g.fill();
      }
      break;
    case 'lightning':
      g.beginPath();
      g.moveTo(6, -30); g.lineTo(-16, 4); g.lineTo(-1, 4); g.lineTo(-8, 30); g.lineTo(16, -6); g.lineTo(1, -6); g.lineTo(8, -30);
      g.closePath(); g.fill();
      break;
    case 'rainbow':
      g.lineWidth = 7;
      ['#ff4b5c', '#ffc531', '#35dc8a', '#36b3ff'].forEach((col, i) => {
        g.strokeStyle = col;
        g.beginPath(); g.arc(0, 14, 30 - i * 8, Math.PI, 0); g.stroke();
      });
      break;
  }
  return PIXI.Texture.from(c);
}

// 珠子外观：每种都保留颜色符号（色弱辅助），只换质感
export const BALL_SKINS = [
  { id: 'classic', name: '彩釉珠', desc: '灯会上最常见的彩釉，干净利落', price: 0 },
  { id: 'glass', name: '琉璃珠', desc: '通透的琉璃，里面流着光', price: 1200 },
  { id: 'jade', name: '温玉珠', desc: '温润如玉，带着云絮般的玉纹', price: 2000 },
  { id: 'star', name: '星辰珠', desc: '每一颗里都藏着一小片星空', price: 3000 },
  { id: 'gilt', name: '鎏金珠', desc: '描金宝相花纹，富丽堂皇', price: 4500 },
];
export const BALL_CANVAS = {};

// 弹道拖尾
export const TRAILS = [
  { id: 'plain', name: '流光', desc: '珠子本色的一道淡光', price: 0, colors: null },
  { id: 'firefly', name: '萤火', desc: '一路洒下点点萤火，久久不散', price: 800, colors: ['#d9ff8f', '#fff3a0'] },
  { id: 'petal', name: '落英', desc: '花瓣纷飞，打完一枪满地落红', price: 1500, colors: ['#ffb3d1', '#ff7aa8'] },
  { id: 'gold', name: '金粉', desc: '金屑闪闪，打一枪像撒一把钱', price: 2500, colors: ['#ffe08a', '#ffffff'] },
  { id: 'dragon', name: '火龙', desc: '烈焰缠身，每一发都像燎原', price: 4000, colors: ['#ff8a2e', '#ff3d1e'] },
];
export const TRAIL_CANVAS = {};

function seeded(n) {
  let s = n * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function ballTex(col, style = 'classic', idx = 0) {
  if (col.sym === 'rainbow') return rainbowBallTex();
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  const clip = () => { g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.clip(); };
  let gr;
  if (style === 'glass') {
    // 琉璃：中心透亮、边缘浓郁，底部一道焦散光
    gr = g.createRadialGradient(C - 10, C - 12, 4, C, C, r);
    gr.addColorStop(0, col.light);
    gr.addColorStop(0.35, col.hex);
    gr.addColorStop(0.85, col.hex);
    gr.addColorStop(1, col.dark);
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    g.save(); clip();
    g.globalCompositeOperation = 'lighter';
    gr = g.createRadialGradient(C + 12, C + 30, 2, C + 12, C + 30, 34);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.arc(C, C, r - 6, 0.2 * Math.PI, 0.75 * Math.PI); g.stroke();
    g.restore();
  } else if (style === 'jade') {
    // 温玉：偏乳白的柔和底色 + 云絮玉纹
    gr = g.createRadialGradient(C - 8, C - 10, 4, C, C, r);
    gr.addColorStop(0, col.light);
    gr.addColorStop(0.55, col.hex);
    gr.addColorStop(1, col.dark);
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    g.save(); clip();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, S, S);
    const rnd = seeded(idx + 3);
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.2})`;
      g.lineWidth = 2 + rnd() * 5;
      g.beginPath();
      const y0 = 14 + rnd() * 100;
      g.moveTo(0, y0);
      g.bezierCurveTo(40, y0 + (rnd() - 0.5) * 60, 90, y0 + (rnd() - 0.5) * 60, S, y0 + (rnd() - 0.5) * 30);
      g.stroke();
    }
    g.restore();
  } else if (style === 'star') {
    // 星辰：深色核心 + 本色星云边 + 星点
    gr = g.createRadialGradient(C, C, 2, C, C, r);
    gr.addColorStop(0, '#0b0820');
    gr.addColorStop(0.5, col.dark);
    gr.addColorStop(0.88, col.hex);
    gr.addColorStop(1, col.light);
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    g.save(); clip();
    const rnd = seeded(idx + 11);
    g.globalCompositeOperation = 'lighter';
    gr = g.createRadialGradient(C + 14, C - 6, 0, C + 14, C - 6, 40);
    gr.addColorStop(0, col.hex + '88');
    gr.addColorStop(1, col.hex + '00');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 16; k++) {
      const x = 14 + rnd() * 100, y = 14 + rnd() * 100, s = 0.8 + rnd() * 1.8;
      g.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  } else {
    gr = g.createRadialGradient(C, C, 2, C, C, r);
    // 大面积纯色、只在边缘压暗：远看就是一个干净的色块，更好分辨
    gr.addColorStop(0, col.hex);
    gr.addColorStop(0.72, col.hex);
    gr.addColorStop(1, col.dark);
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    // 赤道纹（随滚动旋转）
    g.save(); clip();
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 4;
    g.beginPath(); g.ellipse(C, C, r * 1.02, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  if (style === 'gilt') {
    // 鎏金：描金宝相花 + 金色赤道带
    g.save(); clip();
    g.strokeStyle = '#ffe08a'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(C, C, r * 1.02, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    g.translate(C, C);
    g.strokeStyle = 'rgba(255,230,150,0.85)'; g.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(16, -44, 0, -56); g.quadraticCurveTo(-16, -44, 0, -30); g.stroke();
    }
    g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  g.save();
  g.translate(C, C);
  // 符号用同色系深色压印，作为色弱辅助，不再和底色抢眼
  g.globalAlpha = style === 'star' ? 0.75 : 0.5;
  const ink = style === 'star' ? col.light : style === 'gilt' ? '#5a3a08' : col.dark;
  g.fillStyle = ink; g.strokeStyle = ink;
  g.lineJoin = 'round';
  symbol(g, col.sym, 19);
  g.restore();
  (BALL_CANVAS[style] ||= [])[idx] = c;
  return PIXI.Texture.from(c);
}

// 花瓣粒子
function petalTex() {
  const [c, g] = canvas(48, 48);
  g.translate(24, 24);
  const gr = g.createLinearGradient(0, -20, 0, 20);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffd0e2');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(16, -4, 0, 20); g.quadraticCurveTo(-16, -4, 0, -20); g.fill();
  return PIXI.Texture.from(c);
}

// 灯坊里拖尾的静态预览：一道弧线上的粒子
function trailPreview(t) {
  const W = 200, H = 120;
  const [c, g] = canvas(W, H);
  const rnd = seeded(t.id.length * 7);
  const pt = (k) => [20 + k * 150, 96 - Math.sin(k * Math.PI * 0.85) * 64];
  g.globalCompositeOperation = 'lighter';
  const cols = t.colors || ['#ffc531', '#ffe08a'];
  for (let i = 0; i < 46; i++) {
    const k = i / 45;
    const [x, y] = pt(k);
    const a = 0.15 + k * 0.85;
    const col = cols[i % cols.length];
    const jx = (rnd() - 0.5) * 14 * (t.id === 'plain' ? 0.2 : 1), jy = (rnd() - 0.5) * 14 * (t.id === 'plain' ? 0.2 : 1);
    const size = t.id === 'dragon' ? 5 + k * 9 : t.id === 'plain' ? 3 + k * 6 : 2 + rnd() * 4;
    const gr = g.createRadialGradient(x + jx, y + jy, 0, x + jx, y + jy, size * 2.2);
    gr.addColorStop(0, col);
    gr.addColorStop(1, col + '00');
    g.globalAlpha = a;
    if (t.id === 'petal' && i % 2) {
      g.save(); g.translate(x + jx, y + jy); g.rotate(rnd() * 6);
      g.fillStyle = col;
      g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(5, 0, 0, 6); g.quadraticCurveTo(-5, 0, 0, -6); g.fill();
      g.restore();
    } else {
      g.fillStyle = gr;
      g.beginPath(); g.arc(x + jx, y + jy, size * 2.2, 0, Math.PI * 2); g.fill();
    }
  }
  // 末端一颗珠子
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const [x, y] = pt(1);
  const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
  gr.addColorStop(0, '#fff4c8'); gr.addColorStop(0.5, '#ffc531'); gr.addColorStop(1, '#7d4a00');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
  TRAIL_CANVAS[t.id] = c;
}

// 固定不转的光影层：高光 + 暗部，让珠子有体积感
function shineTex() {
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  g.save();
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.clip();
  let gr = g.createRadialGradient(C - 16, C - 18, r * 0.15, C, C, r * 1.06);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(6,0,30,0.62)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  gr = g.createRadialGradient(C + 14, C + 34, 0, C + 14, C + 34, r * 0.55);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.restore();

  g.save();
  g.translate(C - 20, C - 25);
  g.rotate(-0.6);
  g.scale(1, 0.62);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, 24);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.arc(C - 27, C - 30, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(C, C, r - 1, 0, Math.PI * 2); g.stroke();
  return PIXI.Texture.from(c);
}

function glowTex() {
  const S = 128, C = 64;
  const [c, g] = canvas(S, S);
  const gr = g.createRadialGradient(C, C, 0, C, C, C);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return PIXI.Texture.from(c);
}

function sparkTex() {
  const S = 64, C = 32;
  const [c, g] = canvas(S, S);
  g.translate(C, C);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, C);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 5 : 30;
    i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(r, 0);
  }
  g.closePath(); g.fill();
  return PIXI.Texture.from(c);
}

function ringTex() {
  const S = 256, C = 128;
  const [c, g] = canvas(S, S);
  g.shadowColor = '#fff'; g.shadowBlur = 18;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 8;
  g.beginPath(); g.arc(C, C, 100, 0, Math.PI * 2); g.stroke();
  return PIXI.Texture.from(c);
}

// 主角：提灯小精灵（灯笼本体，眼睛在游戏里单独绘制以便跟随瞄准）
// 灯灵外观：price 为灯坊售价，ach 为解锁它的成就（成就外观不能购买）
export const SKINS = [
  { id: 'orange', name: '橘灯', desc: '灯会上最常见的一盏，暖暖的', price: 0, halo: 0xffa53d,
    body: ['#fff7da', '#ffc062', '#e2552a'], cap: '#b4232f', trim: '#ffcf5a', rib: 'rgba(150,50,20,0.28)' },
  { id: 'rabbit', name: '玉兔灯', desc: '竖着一对长耳朵，蹦蹦跳跳', price: 800, halo: 0xffc4d8,
    body: ['#ffffff', '#ffe6ee', '#f2a5bd'], cap: '#e0607e', trim: '#fff2c4', rib: 'rgba(200,90,120,0.2)', deco: 'ears' },
  { id: 'lotus', name: '青莲灯', desc: '莲瓣层层托起，出水不染', price: 1500, halo: 0x6ff0d0,
    body: ['#f4fff9', '#8ff0cf', '#1d9c86'], cap: '#0f5e55', trim: '#ffe7a8', rib: 'rgba(10,90,80,0.25)', deco: 'petals' },
  { id: 'koi', name: '锦鲤灯', desc: '摆着鳍尾，鱼跃龙门', price: 2500, halo: 0xff7a4a,
    body: ['#fffbe8', '#ffad5c', '#e8341f'], cap: '#8a1410', trim: '#ffd86a', rib: 'rgba(130,20,10,0.25)', deco: 'fins' },
  { id: 'palace', name: '紫宸宫灯', desc: '六角宫灯，金框紫纱，贵气逼人', price: 4000, halo: 0xc77dff,
    body: ['#fbeaff', '#c58bff', '#5a1fa8'], cap: '#2e0c52', trim: '#ffd86a', rib: 'rgba(60,10,110,0.3)', deco: 'palace' },
  { id: 'dragon', name: '金龙灯', desc: '击退年兽的勇者才能点亮', ach: 'boss_win', halo: 0xffd84a,
    body: ['#fffbe0', '#ffd84a', '#c87410'], cap: '#a8161c', trim: '#fff0a8', rib: 'rgba(140,70,0,0.3)', deco: 'horns' },
  { id: 'night', name: '夜明灯', desc: '在长夜里坚持到第十重才能点亮', ach: 'endless_10', halo: 0x7ab8ff,
    body: ['#eef6ff', '#6aa8ff', '#16246e'], cap: '#0b1238', trim: '#d8e8ff', rib: 'rgba(10,20,80,0.3)', deco: 'stars' },
];
export const SKIN_CANVAS = {};

function lanternTex(sk = SKINS[0]) {
  const W = 200, H = 220, cx = 100, cy = 100;
  const [c, g] = canvas(W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const ell = (x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
  const deco = sk.deco;
  // —— 画在灯身后面的装饰 ——
  if (deco === 'ears') {
    for (const s of [-1, 1]) {
      g.fillStyle = '#ffffff'; ell(cx + s * 24, cy - 62, 13, 34, s * 0.22);
      g.fillStyle = '#ffb3c8'; ell(cx + s * 24, cy - 60, 6, 24, s * 0.22);
    }
  } else if (deco === 'petals') {
    // 莲座：花瓣沿灯身下沿一圈，瓣尖朝外上方
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (k / 8);
      const px = cx + Math.cos(a) * 58, py = cy + 30 + Math.sin(a) * 18;
      g.fillStyle = k % 2 ? '#ff9cc4' : '#ffc4dc';
      g.save(); g.translate(px, py); g.rotate(Math.cos(a) * 1.15);
      g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(16, 0, 0, 22); g.quadraticCurveTo(-16, 0, 0, -30); g.fill();
      g.restore();
    }
  } else if (deco === 'fins') {
    for (const s of [-1, 1]) {
      g.fillStyle = '#ff6a3c';
      g.beginPath(); g.moveTo(cx + s * 56, cy - 14); g.quadraticCurveTo(cx + s * 98, cy - 30, cx + s * 92, cy + 10); g.quadraticCurveTo(cx + s * 80, cy + 4, cx + s * 58, cy + 18); g.fill();
      g.strokeStyle = 'rgba(255,230,160,0.7)'; g.lineWidth = 2;
      for (const t of [0.35, 0.65]) { g.beginPath(); g.moveTo(cx + s * 60, cy); g.lineTo(cx + s * (64 + 34 * t), cy - 22 + t * 26); g.stroke(); }
    }
  } else if (deco === 'horns') {
    for (const s of [-1, 1]) {
      g.strokeStyle = '#ffe06a'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + s * 22, cy - 58); g.quadraticCurveTo(cx + s * 30, cy - 86, cx + s * 52, cy - 92); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx + s * 30, cy - 76); g.lineTo(cx + s * 44, cy - 74); g.stroke();
      // 龙须
      g.strokeStyle = 'rgba(255,240,170,0.85)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx + s * 40, cy + 18); g.bezierCurveTo(cx + s * 80, cy + 10, cx + s * 70, cy + 50, cx + s * 96, cy + 44); g.stroke();
    }
  }
  // 挂钩
  g.strokeStyle = sk.trim; g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy - 70, 9, Math.PI, 0); g.stroke();
  // 灯身
  const gr = g.createRadialGradient(cx - 14, cy - 16, 6, cx, cy, 66);
  gr.addColorStop(0, sk.body[0]);
  gr.addColorStop(0.45, sk.body[1]);
  gr.addColorStop(1, sk.body[2]);
  g.fillStyle = gr;
  if (deco === 'palace') {
    // 六角宫灯：上下收窄的六边形
    g.beginPath();
    g.moveTo(cx - 40, cy - 52); g.lineTo(cx + 40, cy - 52); g.lineTo(cx + 64, cy);
    g.lineTo(cx + 40, cy + 52); g.lineTo(cx - 40, cy + 52); g.lineTo(cx - 64, cy); g.closePath(); g.fill();
    g.strokeStyle = sk.trim; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.moveTo(cx - 22, cy - 52); g.lineTo(cx - 30, cy); g.lineTo(cx - 22, cy + 52);
    g.moveTo(cx + 22, cy - 52); g.lineTo(cx + 30, cy); g.lineTo(cx + 22, cy + 52); g.stroke();
  } else {
    ell(cx, cy, 64, 54);
    // 竹骨
    g.strokeStyle = sk.rib; g.lineWidth = 3;
    for (const rx of [22, 44]) { g.beginPath(); g.ellipse(cx, cy, rx, 54, 0, 0, Math.PI * 2); g.stroke(); }
  }
  // —— 画在灯身上的装饰 ——
  if (deco === 'fins') {
    g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 2;
    for (let row = 0; row < 3; row++) {
      for (let k = -2; k <= 2; k++) {
        const x = cx + k * 18 + (row % 2) * 9, y = cy + 26 + row * 9;
        if (Math.abs(x - cx) > 46 - row * 6) continue;
        g.beginPath(); g.arc(x, y, 8, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
      }
    }
  } else if (deco === 'stars') {
    g.fillStyle = '#ffffff';
    for (const [x, y, r] of [[-38, -22, 2.5], [30, -30, 2], [44, 8, 2.6], [-46, 18, 2], [-14, 34, 1.8], [18, 38, 2.2], [4, -40, 1.6]]) {
      ell(cx + x, cy + y, r, r);
    }
  } else if (deco === 'horns') {
    g.fillStyle = 'rgba(200,110,0,0.35)';
    for (let k = -2; k <= 2; k++) ell(cx + k * 20, cy + 32, 7, 4);
  }
  // 上下盖
  g.fillStyle = sk.cap;
  rr(cx - 32, cy - 64, 64, 16, 6);
  rr(cx - 32, cy + 48, 64, 16, 6);
  g.fillStyle = sk.trim;
  rr(cx - 32, cy - 52, 64, 3, 1);
  rr(cx - 32, cy + 48, 64, 3, 1);
  // 腮红 + 嘴
  g.fillStyle = 'rgba(255,95,120,0.45)';
  ell(cx - 34, cy + 12, 10, 6);
  ell(cx + 34, cy + 12, 10, 6);
  g.strokeStyle = '#6b2412'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy + 10, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // 流苏
  if (deco === 'palace') {
    g.strokeStyle = '#e83a4a';
    for (const s of [-1, 1]) {
      for (const dx of [-3, 0, 3]) { g.beginPath(); g.moveTo(cx + s * 62 + dx, cy + 4); g.lineTo(cx + s * 64 + dx * 1.5, cy + 44); g.stroke(); }
    }
  }
  if (deco === 'fins') {
    // 鱼尾代替流苏
    g.fillStyle = '#ff6a3c';
    g.beginPath(); g.moveTo(cx, cy + 66); g.quadraticCurveTo(cx - 34, cy + 80, cx - 30, cy + 104); g.quadraticCurveTo(cx - 8, cy + 88, cx, cy + 82);
    g.quadraticCurveTo(cx + 8, cy + 88, cx + 30, cy + 104); g.quadraticCurveTo(cx + 34, cy + 80, cx, cy + 66); g.fill();
  } else {
    g.strokeStyle = sk.trim; g.lineWidth = 3;
    for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + dx, cy + 92); g.lineTo(cx + dx * 1.6, cy + 116); g.stroke(); }
  }
  // 灯坊预览图：游戏里眼睛是实时画的，预览单独补一双笑眼
  const [pc, pg] = canvas(W, H);
  pg.drawImage(c, 0, 0);
  pg.strokeStyle = '#3a1608'; pg.lineWidth = 4; pg.lineCap = 'round';
  for (const s of [-1, 1]) {
    pg.beginPath(); pg.moveTo(cx + s * 21 - 8, cy - 2); pg.quadraticCurveTo(cx + s * 21, cy - 12, cx + s * 21 + 8, cy - 2); pg.stroke();
  }
  SKIN_CANVAS[sk.id] = pc;
  return PIXI.Texture.from(c);
}

// 年兽：紫黑鬃毛、金角、獠牙；眼睛和额头宝珠在游戏里单独绘制（会动）
// 纹理 340×340，脸半径 102px，中心 (170,170)
function bossTex() {
  const S = 340, C = 170;
  const [c, g] = canvas(S, S);
  g.translate(C, C);

  // 鬃毛：火焰状波浪
  const n = 22;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const ro = 150 + (i % 3 === 0 ? 12 : 0);
    const x0 = Math.cos(a0) * 118, y0 = Math.sin(a0) * 118;
    if (i === 0) g.moveTo(x0, y0);
    else g.quadraticCurveTo(Math.cos(a0 - 0.08) * 128, Math.sin(a0 - 0.08) * 128, x0, y0);
    if (i < n) g.quadraticCurveTo(Math.cos(a1 - 0.12) * (ro - 10), Math.sin(a1 - 0.12) * (ro - 10), Math.cos(a1) * ro, Math.sin(a1) * ro);
  }
  g.closePath();
  let gr = g.createRadialGradient(0, 0, 60, 0, 0, 165);
  gr.addColorStop(0, '#4a2478');
  gr.addColorStop(0.6, '#2a1248');
  gr.addColorStop(1, '#14081f');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(160,110,255,0.45)';
  g.lineWidth = 2;
  g.stroke();

  // 金角
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side, 1);
    g.beginPath();
    g.moveTo(34, -80);
    g.quadraticCurveTo(70, -152, 126, -150);
    g.quadraticCurveTo(88, -126, 70, -68);
    g.closePath();
    gr = g.createLinearGradient(40, -70, 126, -150);
    gr.addColorStop(0, '#a8661c');
    gr.addColorStop(0.5, '#ffd77a');
    gr.addColorStop(1, '#fff5d8');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = '#5a3008';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(90,48,8,0.5)';
    for (const k of [0.3, 0.5, 0.7]) {
      g.beginPath();
      g.moveTo(34 + 40 * k, -80 - 60 * k);
      g.lineTo(52 + 40 * k, -72 - 58 * k);
      g.stroke();
    }
    g.restore();
  }

  // 两腮毛簇
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side, 1);
    g.beginPath();
    g.moveTo(92, -20);
    g.lineTo(128, 0); g.lineTo(98, 12); g.lineTo(130, 34); g.lineTo(94, 40); g.lineTo(118, 66); g.lineTo(80, 60);
    g.closePath();
    g.fillStyle = '#3a1f68';
    g.fill();
    g.restore();
  }

  // 脸
  gr = g.createRadialGradient(-30, -40, 10, 0, 0, 104);
  gr.addColorStop(0, '#6a40a8');
  gr.addColorStop(0.5, '#33195c');
  gr.addColorStop(1, '#180c2c');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 102, 0, Math.PI * 2); g.fill();

  // 额头金饰（宝珠底座）
  g.strokeStyle = '#ffcf5a';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, -62, 23, 0, Math.PI * 2); g.stroke();
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * 23, -62);
    g.quadraticCurveTo(side * 44, -70, side * 52, -88);
    g.stroke();
  }

  // 怒眉
  g.strokeStyle = '#0a0414';
  g.lineCap = 'round';
  g.lineWidth = 10;
  for (const side of [-1, 1]) {
    g.beginPath(); g.moveTo(side * 72, -38); g.lineTo(side * 22, -22); g.stroke();
  }
  // 眼窝
  g.fillStyle = '#06020c';
  for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 42, -8, 21, 14, side * 0.18, 0, Math.PI * 2); g.fill(); }

  // 鼻
  g.fillStyle = '#0c0418';
  g.beginPath(); g.moveTo(-16, 16); g.quadraticCurveTo(0, 8, 16, 16); g.quadraticCurveTo(10, 32, 0, 32); g.quadraticCurveTo(-10, 32, -16, 16); g.fill();

  // 嘴
  g.beginPath();
  g.moveTo(-64, 44);
  g.quadraticCurveTo(0, 104, 64, 44);
  g.quadraticCurveTo(0, 62, -64, 44);
  g.fillStyle = '#5e0b1a';
  g.fill();
  g.fillStyle = '#2a0309';
  g.beginPath(); g.moveTo(-40, 58); g.quadraticCurveTo(0, 90, 40, 58); g.quadraticCurveTo(0, 70, -40, 58); g.fill();
  // 小牙
  g.fillStyle = '#f4ead8';
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) === 2) continue;
    const x = i * 12, y = 44 + 18 * (1 - (x / 64) ** 2);
    g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x + 5, y - 1); g.lineTo(x, y + 8); g.fill();
  }
  // 獠牙
  for (const side of [-1, 1]) {
    const x = side * 26, y = 56;
    gr = g.createLinearGradient(x, y, x, y + 34);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#c9b9a0');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.lineTo(x + side * 2, y + 34); g.closePath(); g.fill();
  }

  // 腮边金纹
  g.strokeStyle = 'rgba(217,164,65,0.75)';
  g.lineWidth = 3;
  for (const side of [-1, 1]) {
    g.beginPath(); g.arc(side * 70, 28, 13, side > 0 ? Math.PI * 0.9 : -Math.PI * 0.1, side > 0 ? Math.PI * 2.1 : Math.PI * 1.1); g.stroke();
    g.beginPath(); g.arc(side * 70, 28, 5, 0, Math.PI * 2); g.stroke();
  }
  return PIXI.Texture.from(c);
}

// 墨团：年兽吐出的墨染弹
function inkTex() {
  const S = 96, C = 48;
  const [c, g] = canvas(S, S);
  g.translate(C, C);
  g.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 30 + (i % 2 ? 6 : -2) + Math.sin(i * 2.3) * 4;
    i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(r, 0);
  }
  g.closePath();
  const gr = g.createRadialGradient(-8, -8, 2, 0, 0, 38);
  gr.addColorStop(0, '#b77bff');
  gr.addColorStop(0.45, '#4a1880');
  gr.addColorStop(1, '#160628');
  g.fillStyle = gr;
  g.shadowColor = '#a066ff';
  g.shadowBlur = 10;
  g.fill();
  return PIXI.Texture.from(c);
}

function bgTex() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  let gr = g.createRadialGradient(S / 2, S * 0.42, 40, S / 2, S / 2, S * 0.75);
  gr.addColorStop(0, '#22265e');
  gr.addColorStop(0.5, '#0e1033');
  gr.addColorStop(1, '#04050f');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const blob = (x, y, r, col) => {
    const b = g.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, col); b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b; g.fillRect(0, 0, S, S);
  };
  blob(240, 300, 320, 'rgba(120,70,220,0.16)');
  blob(800, 700, 360, 'rgba(30,150,200,0.10)');
  blob(700, 200, 220, 'rgba(255,140,80,0.07)');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * S, y = rnd() * S, r = rnd() < 0.08 ? 1.6 : 0.7 + rnd() * 0.6;
    g.fillStyle = `rgba(255,${230 + rnd() * 25 | 0},${200 + rnd() * 55 | 0},${0.25 + rnd() * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return PIXI.Texture.from(c);
}

export function buildTextures() {
  TEX.ballSets = {};
  for (const sk of BALL_SKINS) TEX.ballSets[sk.id] = COLORS.map((col, i) => ballTex(col, sk.id, i));
  TEX.balls = TEX.ballSets.classic;
  TEX.petal = petalTex();
  for (const t of TRAILS) trailPreview(t);
  TEX.icons = {};
  for (const k of Object.keys(POWERS)) TEX.icons[k] = iconTex(k);
  TEX.shine = shineTex();
  TEX.glow = glowTex();
  TEX.spark = sparkTex();
  TEX.ring = ringTex();
  TEX.skins = {};
  for (const sk of SKINS) TEX.skins[sk.id] = lanternTex(sk);
  TEX.lantern = TEX.skins.orange;
  TEX.bg = bgTex();
  TEX.boss = bossTex();
  TEX.ink = inkTex();
}
