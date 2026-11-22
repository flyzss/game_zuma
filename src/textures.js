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

function ballTex(col) {
  if (col.sym === 'rainbow') return rainbowBallTex();
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  let gr = g.createRadialGradient(C, C, 2, C, C, r);
  // 大面积纯色、只在边缘压暗：远看就是一个干净的色块，更好分辨
  gr.addColorStop(0, col.hex);
  gr.addColorStop(0.72, col.hex);
  gr.addColorStop(1, col.dark);
  g.fillStyle = gr;
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();

  // 赤道纹 + 符号（随滚动旋转）
  g.save();
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 4;
  g.beginPath(); g.ellipse(C, C, r * 1.02, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
  g.restore();

  g.save();
  g.translate(C, C);
  // 符号用同色系深色压印，作为色弱辅助，不再和底色抢眼
  g.globalAlpha = 0.5;
  g.fillStyle = col.dark; g.strokeStyle = col.dark;
  g.lineJoin = 'round';
  symbol(g, col.sym, 19);
  g.restore();
  return PIXI.Texture.from(c);
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
function lanternTex() {
  const W = 200, H = 220, cx = 100, cy = 100;
  const [c, g] = canvas(W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  // 挂钩
  g.strokeStyle = '#ffcf5a'; g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy - 70, 9, Math.PI, 0); g.stroke();
  // 灯身
  const gr = g.createRadialGradient(cx - 14, cy - 16, 6, cx, cy, 66);
  gr.addColorStop(0, '#fff7da');
  gr.addColorStop(0.45, '#ffc062');
  gr.addColorStop(1, '#e2552a');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(cx, cy, 64, 54, 0, 0, Math.PI * 2); g.fill();
  // 竹骨
  g.strokeStyle = 'rgba(150,50,20,0.28)'; g.lineWidth = 3;
  for (const rx of [22, 44]) { g.beginPath(); g.ellipse(cx, cy, rx, 54, 0, 0, Math.PI * 2); g.stroke(); }
  // 上下盖
  g.fillStyle = '#b4232f';
  rr(cx - 32, cy - 64, 64, 16, 6);
  rr(cx - 32, cy + 48, 64, 16, 6);
  g.fillStyle = '#ffcf5a';
  rr(cx - 32, cy - 52, 64, 3, 1);
  rr(cx - 32, cy + 48, 64, 3, 1);
  // 腮红 + 嘴
  g.fillStyle = 'rgba(255,95,120,0.45)';
  g.beginPath(); g.ellipse(cx - 34, cy + 12, 10, 6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 34, cy + 12, 10, 6, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#6b2412'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy + 10, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // 流苏
  g.strokeStyle = '#ffcf5a'; g.lineWidth = 3;
  for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + dx, cy + 92); g.lineTo(cx + dx * 1.6, cy + 116); g.stroke(); }
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
  TEX.balls = COLORS.map(ballTex);
  TEX.icons = {};
  for (const k of Object.keys(POWERS)) TEX.icons[k] = iconTex(k);
  TEX.shine = shineTex();
  TEX.glow = glowTex();
  TEX.spark = sparkTex();
  TEX.ring = ringTex();
  TEX.lantern = lanternTex();
  TEX.bg = bgTex();
  TEX.boss = bossTex();
  TEX.ink = inkTex();
}
