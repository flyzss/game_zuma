// 全部美术资源程序化生成（Canvas 2D → PIXI 纹理），后期可替换为正式美术图
import { LEVELS, ENDLESS_SCENES } from './levels.js';
import { Path } from './path.js';

export const COLORS = [
  { hex: '#ff4b5c', light: '#ffd3d8', dark: '#6e0c1f', tint: 0xff4b5c, sym: 'ring' },
  { hex: '#ffc531', light: '#fff4c8', dark: '#7d4a00', tint: 0xffc531, sym: 'diamond' },
  { hex: '#35dc8a', light: '#d6ffea', dark: '#08603a', tint: 0x35dc8a, sym: 'tri' },
  { hex: '#36b3ff', light: '#d4f0ff', dark: '#0a4580', tint: 0x36b3ff, sym: 'square' },
  { hex: '#c25cf5', light: '#f3dcff', dark: '#4a0f78', tint: 0xc25cf5, sym: 'star' },
  // 彩珠：只作为发射物出现，插入时变成被击中珠子的颜色
  { hex: '#ffffff', light: '#ffffff', dark: '#5a4a8a', tint: 0xffffff, sym: 'rainbow' },
];
export const RAINBOW = 5;

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
    COLORS.slice(0, RAINBOW).forEach((col, i) => gr.addColorStop(i / RAINBOW, col.hex));
    gr.addColorStop(1, COLORS[0].hex);
  } else {
    gr = g.createLinearGradient(0, 0, S, S);
    COLORS.slice(0, RAINBOW).forEach((col, i) => gr.addColorStop(i / (RAINBOW - 1), col.hex));
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

// 珠子外观：传统材质 + 毛绒萌宠（plush 为毛绒系，柔和反光更显毛绒质感）
export const BALL_SKINS = [
  { id: 'classic', name: '彩釉珠', desc: '灯会上最常见的彩釉，干净利落', price: 0 },
  { id: 'glass', name: '琉璃珠', desc: '通透的琉璃，里面流着光', price: 1200 },
  { id: 'mirror', name: '镜面珠', desc: '纯色镜面玻璃，无纹无饰，干净通透清爽', price: 1400 },
  { id: 'cat', name: '绒猫珠', desc: '毛茸茸的小猫团子，软乎乎滚过长夜', price: 1600, plush: true },
  { id: 'yarn', name: '毛线球', desc: '绕得密实的彩毛线团，滚起来像逗猫玩', price: 1800, plush: true },
  { id: 'jade', name: '温玉珠', desc: '温润如玉，带着云絮般的玉纹', price: 2000 },
  { id: 'bunny', name: '垂耳兔', desc: '圆滚滚的绒毛兔团，软耳朵贴着脸颊', price: 2200, plush: true },
  { id: 'paw', name: '肉垫珠', desc: '软糯的毛绒小猫爪，印着圆圆的肉垫', price: 2400, plush: true },
  { id: 'bear', name: '绒熊珠', desc: '蓬松的泰迪小熊团，圆耳朵藏着暖意', price: 2800, plush: true },
  { id: 'star', name: '星辰珠', desc: '每一颗里都藏着一小片星空', price: 3000 },
  { id: 'pet', name: '百兽团', desc: '五色化作狐柴蛙企枭，五只萌宠绝不看混', price: 3800, plush: true },
  { id: 'gilt', name: '鎏金珠', desc: '描金宝相花纹，富丽堂皇', price: 4500 },
  { id: 'fortune', name: '招财猫', desc: '集齐所有毛绒萌宠后点亮，系着金铃的招财小猫', ach: 'plush_all', plush: true },
];
export const BALL_CANVAS = {};
export const SCENE_CANVAS = {};

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

// 毛绒珠公共绘制：圆润天鹅绒底 + 逆光绒晕（Velvet Rim）+ 柔雾棉感，光滑柔软无杂刺
function drawPlushBase(g, C, r, col, idx) {
  const rnd = seeded(idx * 37 + 13);
  const br = r - 1.5;

  // 外缘极柔羽化绒晕（模拟细绒毛在光线下的柔和毛边，无锯齿）
  const fuzz = g.createRadialGradient(C, C, br * 0.84, C, C, r);
  fuzz.addColorStop(0, col.hex + '00');
  fuzz.addColorStop(0.55, col.light + '55');
  fuzz.addColorStop(1, col.light + '00');
  g.fillStyle = fuzz;
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();

  g.save();
  g.beginPath(); g.arc(C, C, br, 0, Math.PI * 2); g.fillStyle = col.hex; g.fill();
  g.clip();

  // 哑光柔雾球体明暗：大面积干净本色，边缘温和压深
  const gr = g.createRadialGradient(C - 10, C - 14, 6, C + 4, C + 6, br * 1.06);
  gr.addColorStop(0, col.hex);
  gr.addColorStop(0.62, col.hex);
  gr.addColorStop(0.92, col.dark);
  gr.addColorStop(1, col.dark);
  g.fillStyle = gr;
  g.fillRect(0, 0, C * 2, C * 2);

  // 蓬松棉云柔斑（极低透明大柔光团，营造暖绒布面而非生硬线条）
  for (let k = 0; k < 7; k++) {
    const a = rnd() * Math.PI * 2, d = 8 + rnd() * (br * 0.55);
    const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d, pr = 22 + rnd() * 18;
    const pf = g.createRadialGradient(x, y, 0, x, y, pr);
    pf.addColorStop(0, k % 2 ? 'rgba(255,255,255,0.08)' : col.light + '18');
    pf.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pf;
    g.fillRect(0, 0, C * 2, C * 2);
  }

  // 天鹅绒逆光亮边（Fresnel 绒毛边缘光，毛绒玩具最核心的柔软质感）
  const rim = g.createRadialGradient(C, C, br * 0.68, C, C, br);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.68, col.light + '14');
  rim.addColorStop(0.9, col.light + '66');
  rim.addColorStop(1, col.light + '18');
  g.fillStyle = rim;
  g.fillRect(0, 0, C * 2, C * 2);

  // 左上方柔和粉雾暖光（哑光棉感，不刺眼）
  const hi = g.createRadialGradient(C - 16, C - 20, 2, C - 12, C - 14, br * 0.62);
  hi.addColorStop(0, 'rgba(255,255,255,0.24)');
  hi.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, C * 2, C * 2);

  g.restore();
}

function drawEye(g, x, y, rx = 5.4, ry = 6.4) {
  g.fillStyle = '#24141a';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x - rx * 0.34, y - ry * 0.32, rx * 0.38, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + rx * 0.28, y + ry * 0.32, rx * 0.18, 0, Math.PI * 2); g.fill();
}

function drawBlush(g, x, y, idx, rx = 8.5, ry = 5) {
  g.fillStyle = idx === 0 ? 'rgba(255,225,180,0.42)' : 'rgba(255,140,175,0.45)';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

function drawCatMouth(g, y = 10, s = 1) {
  g.strokeStyle = '#331922';
  g.lineWidth = 2.6 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-8 * s, y);
  g.quadraticCurveTo(-4 * s, y + 5.5 * s, 0, y + 0.5 * s);
  g.quadraticCurveTo(4 * s, y + 5.5 * s, 8 * s, y);
  g.stroke();
}

function drawPlushStyle(g, C, r, col, style, idx) {
  if (style === 'yarn') {
    // 毛线球：粗实柔和的三组大股毛线交叠缠绕，圆润温暖不密集
    drawPlushBase(g, C, r, col, idx);
    g.save();
    g.beginPath(); g.arc(C, C, r - 1.5, 0, Math.PI * 2); g.clip();
    g.translate(C, C);
    g.lineCap = 'round';
    const bands = [
      { rot: -0.52, offs: [-26, -12, 2, 16, 30], bend: 20 },
      { rot: 0.62, offs: [-20, -6, 8, 22], bend: 22 },
      { rot: 1.72, offs: [-14, 0, 14], bend: 18 },
    ];
    for (const b of bands) {
      g.save();
      g.rotate(b.rot);
      // 整束毛线的柔和底影，让层叠更有立体蓬松感
      g.beginPath();
      g.moveTo(-72, b.offs[0] - 8);
      g.quadraticCurveTo(0, b.offs[0] + b.bend, 72, b.offs[0] - 8);
      g.lineTo(72, b.offs[b.offs.length - 1] + 8);
      g.quadraticCurveTo(0, b.offs[b.offs.length - 1] + b.bend + 10, -72, b.offs[b.offs.length - 1] + 8);
      g.closePath();
      g.fillStyle = col.dark + '44';
      g.fill();
      for (const yy of b.offs) {
        // 柔和阴影槽
        g.beginPath();
        g.moveTo(-72, yy - 10);
        g.quadraticCurveTo(0, yy + b.bend, 72, yy - 10);
        g.strokeStyle = col.dark + '66';
        g.lineWidth = 11.5;
        g.stroke();
        // 饱满主毛线股
        g.strokeStyle = col.hex;
        g.lineWidth = 8.5;
        g.stroke();
        // 绒感柔亮丝
        g.beginPath();
        g.moveTo(-68, yy - 11.5);
        g.quadraticCurveTo(0, yy + b.bend - 2, 68, yy - 11.5);
        g.strokeStyle = col.light + '66';
        g.lineWidth = 2.6;
        g.stroke();
      }
      g.restore();
    }
    // 外圈再叠一层柔暗球面体积与天鹅绒亮边，让线团圆鼓鼓
    const vol = g.createRadialGradient(-10, -14, 8, 0, 0, r);
    vol.addColorStop(0, 'rgba(255,255,255,0.12)');
    vol.addColorStop(0.65, 'rgba(0,0,0,0)');
    vol.addColorStop(0.92, col.dark + '88');
    vol.addColorStop(1, col.light + '55');
    g.fillStyle = vol;
    g.fillRect(-C, -C, C * 2, C * 2);
    // 中心轻压色弱符号
    g.globalAlpha = 0.5;
    g.fillStyle = col.dark; g.strokeStyle = col.dark; g.lineJoin = 'round';
    symbol(g, col.sym, 16);
    g.restore();
    return;
  }

  drawPlushBase(g, C, r, col, idx);
  g.save();
  g.translate(C, C);

  if (style === 'cat' || style === 'fortune') {
    const lucky = style === 'fortune';
    // 圆润尖猫耳（贴边收在圆内）
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(12, -40); g.quadraticCurveTo(28, -55, 38, -44);
      g.quadraticCurveTo(44, -30, 34, -20); g.closePath();
      g.fillStyle = col.dark;
      g.globalAlpha = 0.55; g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(16, -38); g.quadraticCurveTo(27, -49, 34, -41);
      g.quadraticCurveTo(37, -31, 30, -24); g.closePath();
      g.fillStyle = lucky ? '#ffd870' : col.light;
      g.fill();
      g.restore();
    }
    // 额头虎斑（招财猫换金色福纹）
    g.strokeStyle = lucky ? '#ffe27a' : col.dark + '99';
    g.lineWidth = 3.2; g.lineCap = 'round';
    for (const dx of [-8, 0, 8]) {
      g.beginPath(); g.moveTo(dx, -38 + Math.abs(dx) * 0.25); g.lineTo(dx * 0.85, -26); g.stroke();
    }
    // 眼睛：普通绒猫水汪汪圆眼，招财猫笑眯眯弯眼
    if (lucky) {
      g.strokeStyle = '#2d1418'; g.lineWidth = 3.6; g.lineCap = 'round';
      for (const side of [-1, 1]) {
        g.beginPath(); g.arc(side * 16, -2, 8.5, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      }
    } else {
      drawEye(g, -16, -3, 5.8, 6.8);
      drawEye(g, 16, -3, 5.8, 6.8);
    }
    drawBlush(g, -26, 7, idx, 8.5, 4.8);
    drawBlush(g, 26, 7, idx, 8.5, 4.8);
    // 小鼻 + ω 猫嘴
    g.fillStyle = idx === 0 ? '#ffe1c6' : '#ff8eb3';
    g.beginPath(); g.moveTo(-4.5, 4); g.lineTo(4.5, 4); g.lineTo(0, 9); g.closePath(); g.fill();
    drawCatMouth(g, 10, 1);
    // 两侧胡须
    g.strokeStyle = '#2d1418aa'; g.lineWidth = 2; g.lineCap = 'round';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 25, 4); g.lineTo(side * 42, 0);
      g.moveTo(side * 25, 11); g.lineTo(side * 42, 13);
      g.stroke();
    }
    if (lucky) {
      // 招财猫红金项圈 + 小金铃
      g.save();
      g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.clip();
      g.strokeStyle = '#c81e2c'; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -10, 44, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
      g.strokeStyle = '#ffd76a'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, -10, 40, Math.PI * 0.27, Math.PI * 0.73); g.stroke();
      g.restore();
      const bg = g.createRadialGradient(-3, 31, 1, 0, 34, 11);
      bg.addColorStop(0, '#fff7c4'); bg.addColorStop(0.55, '#ffc93c'); bg.addColorStop(1, '#9c5c08');
      g.fillStyle = bg;
      g.beginPath(); g.arc(0, 34, 10.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#733e04'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#5c2e02';
      g.beginPath(); g.arc(0, 36, 2.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-6, 36); g.lineTo(6, 36); g.stroke();
    }
  } else if (style === 'bunny') {
    // 垂耳兔：贴着两颊垂落的软耳朵 + 头顶绒毛团
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(18, -34);
      g.bezierCurveTo(44, -30, 52, 4, 40, 26);
      g.bezierCurveTo(31, 34, 22, 18, 26, -6);
      g.closePath();
      g.fillStyle = col.dark; g.globalAlpha = 0.48; g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.ellipse(35, 3, 6.5, 16, -0.18, 0, Math.PI * 2);
      g.fillStyle = col.light; g.globalAlpha = 0.85; g.fill();
      g.restore();
    }
    // 头顶软绒卷毛
    g.fillStyle = col.light; g.globalAlpha = 0.78;
    for (const [x, y, rr] of [[-7, -36, 7], [0, -39, 8.5], [7, -36, 7]]) {
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    drawEye(g, -13, -5, 5.6, 6.6);
    drawEye(g, 13, -5, 5.6, 6.6);
    drawBlush(g, -20, 7, idx, 7.5, 4.5);
    drawBlush(g, 20, 7, idx, 7.5, 4.5);
    // 兔鼻与 Y 字小嘴
    g.fillStyle = idx === 0 ? '#ffe1c6' : '#ff94b8';
    g.beginPath(); g.ellipse(0, 4, 4.2, 3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#331922'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 7); g.lineTo(0, 12); g.moveTo(0, 12); g.lineTo(-6, 16); g.moveTo(0, 12); g.lineTo(6, 16); g.stroke();
  } else if (style === 'paw') {
    // 肉垫珠：中心胖嘟嘟的猫爪印（掌心 + 4 颗圆趾垫）
    const drawPad = (fn) => {
      g.save();
      g.translate(0, 3);
      g.fillStyle = col.dark + '66';
      fn(); g.fill();
      g.restore();
      g.fillStyle = col.light;
      fn(); g.fill();
    };
    // 掌心（圆润心形垫）
    drawPad(() => {
      g.beginPath();
      g.moveTo(0, -3);
      g.bezierCurveTo(18, -10, 28, 8, 22, 22);
      g.bezierCurveTo(15, 31, 6, 26, 0, 24);
      g.bezierCurveTo(-6, 26, -15, 31, -22, 22);
      g.bezierCurveTo(-28, 8, -18, -10, 0, -3);
      g.closePath();
    });
    // 四颗圆润小趾垫
    const toes = [[-26, -8, 8.5, 10.5, -0.38], [-10, -24, 9, 11.5, -0.14], [10, -24, 9, 11.5, 0.14], [26, -8, 8.5, 10.5, 0.38]];
    for (const [x, y, rx, ry, rot] of toes) {
      drawPad(() => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); });
    }
    // 掌心高光点
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(-7, 9, 5, 3, -0.4, 0, Math.PI * 2); g.fill();
  } else if (style === 'bear') {
    // 绒熊珠：圆熊耳 + 奶色吻部 + 纽扣鼻 + 玩偶缝线
    for (const side of [-1, 1]) {
      g.fillStyle = col.dark; g.globalAlpha = 0.48;
      g.beginPath(); g.arc(side * 30, -31, 14, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.88; g.fillStyle = col.light;
      g.beginPath(); g.arc(side * 30, -31, 8, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // 额头玩偶针脚线
    g.strokeStyle = col.dark + '66'; g.lineWidth = 2; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(0, -48); g.lineTo(0, -18); g.stroke();
    g.setLineDash([]);
    // 浅色吻部
    g.fillStyle = col.light; g.globalAlpha = 0.86;
    g.beginPath(); g.ellipse(0, 14, 21, 15.5, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    drawEye(g, -17, -7, 5.2, 5.8);
    drawEye(g, 17, -7, 5.2, 5.8);
    drawBlush(g, -27, 4, idx, 7.5, 4.5);
    drawBlush(g, 27, 4, idx, 7.5, 4.5);
    // 巧克力色熊鼻 + 笑嘴
    g.fillStyle = '#361a12';
    g.beginPath(); g.ellipse(0, 8, 7.2, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.ellipse(-2, 6.5, 2.5, 1.3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#361a12'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 13); g.lineTo(0, 17); g.stroke();
    drawCatMouth(g, 17, 0.95);
  } else if (style === 'pet') {
    // 百兽团：五色对应五只不同绒毛萌宠（红狐、黄柴、绿蛙、蓝企鹅、紫猫头鹰）
    if (idx === 0) {
      // 红：小狐狸
      for (const side of [-1, 1]) {
        g.save(); g.scale(side, 1);
        g.beginPath(); g.moveTo(10, -42); g.lineTo(36, -46); g.lineTo(34, -18); g.closePath();
        g.fillStyle = '#4a0814'; g.fill();
        g.beginPath(); g.moveTo(16, -38); g.lineTo(31, -40); g.lineTo(29, -23); g.closePath();
        g.fillStyle = col.light; g.fill();
        // 尖毛蓬松白脸颊
        g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(24, 4, 44, 14); g.quadraticCurveTo(36, 36, 0, 42); g.closePath();
        g.fillStyle = col.light; g.globalAlpha = 0.88; g.fill();
        g.restore();
      }
      drawEye(g, -15, -6, 5.5, 6.2);
      drawEye(g, 15, -6, 5.5, 6.2);
      g.fillStyle = '#2d1016';
      g.beginPath(); g.ellipse(0, 9, 5.5, 4, 0, 0, Math.PI * 2); g.fill();
      drawCatMouth(g, 15, 0.9);
    } else if (idx === 1) {
      // 黄：小柴犬
      for (const side of [-1, 1]) {
        g.save(); g.scale(side, 1);
        g.beginPath(); g.moveTo(14, -40); g.quadraticCurveTo(32, -52, 38, -32); g.lineTo(28, -22); g.closePath();
        g.fillStyle = col.dark; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
        g.beginPath(); g.moveTo(19, -37); g.quadraticCurveTo(30, -44, 33, -32); g.lineTo(26, -26); g.closePath();
        g.fillStyle = '#fff4d4'; g.fill();
        g.restore();
      }
      // 柴犬标志奶油脸颊 + 豆豆眉
      g.fillStyle = '#fff5d8'; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(0, 18, 30, 19, 0, 0, Math.PI * 2); g.fill();
      for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 15, -18, 5.5, 3.8, side * -0.2, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      drawEye(g, -16, -4, 5.2, 5.6);
      drawEye(g, 16, -4, 5.2, 5.6);
      g.fillStyle = '#331c0a';
      g.beginPath(); g.ellipse(0, 7, 6.2, 4.5, 0, 0, Math.PI * 2); g.fill();
      // 开心小舌头
      g.fillStyle = '#ff6b8b';
      g.beginPath(); g.arc(0, 18, 5, 0, Math.PI); g.fill();
      drawCatMouth(g, 14, 1);
    } else if (idx === 2) {
      // 绿：小青蛙
      g.fillStyle = col.light; g.globalAlpha = 0.72;
      g.beginPath(); g.ellipse(0, 28, 34, 20, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      for (const side of [-1, 1]) {
        g.fillStyle = col.hex;
        g.beginPath(); g.arc(side * 20, -21, 15, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col.dark + '88'; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(side * 20, -21, 10.5, 0, Math.PI * 2); g.fill();
        drawEye(g, side * 20, -21, 6, 6.5);
      }
      drawBlush(g, -28, 3, idx, 8.5, 5);
      drawBlush(g, 28, 3, idx, 8.5, 5);
      g.strokeStyle = '#07482a'; g.lineWidth = 3.2; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, 21, Math.PI * 0.16, Math.PI * 0.84); g.stroke();
    } else if (idx === 3) {
      // 蓝：小企鹅
      g.fillStyle = '#f2f9ff'; g.globalAlpha = 0.92;
      g.beginPath();
      g.moveTo(0, -16);
      g.bezierCurveTo(18, -32, 36, -14, 34, 16);
      g.bezierCurveTo(32, 40, -32, 40, -34, 16);
      g.bezierCurveTo(-36, -14, -18, -32, 0, -16);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
      drawEye(g, -15, -6, 5.4, 6.2);
      drawEye(g, 15, -6, 5.4, 6.2);
      drawBlush(g, -24, 6, idx, 7, 4.2);
      drawBlush(g, 24, 6, idx, 7, 4.2);
      // 橘黄小菱形嘴
      g.fillStyle = '#ffb326';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 8); g.lineTo(0, 16); g.lineTo(-10, 8); g.closePath(); g.fill();
      g.strokeStyle = '#b86200'; g.lineWidth = 1.6; g.stroke();
    } else {
      // 紫：小猫头鹰
      for (const side of [-1, 1]) {
        g.save(); g.scale(side, 1);
        g.beginPath(); g.moveTo(14, -36); g.lineTo(35, -45); g.lineTo(30, -24); g.closePath();
        g.fillStyle = col.dark; g.fill();
        // 大圆眼圈
        g.fillStyle = col.light; g.globalAlpha = 0.9;
        g.beginPath(); g.arc(16, -7, 15, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      drawEye(g, -16, -7, 6.8, 7.2);
      drawEye(g, 16, -7, 6.8, 7.2);
      // 金色小尖喙
      g.fillStyle = '#ffd24c';
      g.beginPath(); g.moveTo(0, -1); g.lineTo(7, 9); g.lineTo(0, 17); g.lineTo(-7, 9); g.closePath(); g.fill();
      // 肚皮羽毛弧纹
      g.strokeStyle = col.light + 'cc'; g.lineWidth = 2.6; g.lineCap = 'round';
      for (const [x, y] of [[-13, 25], [0, 29], [13, 25]]) {
        g.beginPath(); g.arc(x, y, 6, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      }
    }
  }
  g.restore();
}

function ballTex(col, style = 'classic', idx = 0) {
  if (col.sym === 'rainbow') return rainbowBallTex();
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  const sk = BALL_SKINS.find((b) => b.id === style);
  if (sk?.plush) {
    drawPlushStyle(g, C, r, col, style, idx);
    (BALL_CANVAS[style] ||= [])[idx] = c;
    return PIXI.Texture.from(c);
  }
  if (style === 'mirror') {
    // 镜面玻璃珠：纯色无纹理，中心通透清亮、外缘自带玻璃折射亮边（旋转对称，搭配固定高光层更清爽）
    const gr = g.createRadialGradient(C, C, 2, C, C, r);
    gr.addColorStop(0, col.light + 'aa');
    gr.addColorStop(0.28, col.hex);
    gr.addColorStop(0.76, col.hex);
    gr.addColorStop(0.94, col.dark);
    gr.addColorStop(1, col.light);
    g.fillStyle = col.hex;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
    // 极细玻璃内圈折射亮线
    g.strokeStyle = 'rgba(255,255,255,0.34)';
    g.lineWidth = 2.2;
    g.beginPath(); g.arc(C, C, r - 2.2, 0, Math.PI * 2); g.stroke();
    // 商店静态预览叠加镜面窗光与底部通透焦散（局内由固定不转的 TEX.shine 提供）
    const [pc, pg] = canvas(S, S);
    pg.drawImage(c, 0, 0);
    pg.save();
    pg.beginPath(); pg.arc(C, C, r, 0, Math.PI * 2); pg.clip();
    // 底部清透焦散反光
    const cau = pg.createRadialGradient(C + 14, C + 32, 2, C + 14, C + 32, 34);
    cau.addColorStop(0, 'rgba(255,255,255,0.58)');
    cau.addColorStop(0.6, col.light + '44');
    cau.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = cau; pg.fillRect(0, 0, S, S);
    // 左上镜面月牙高光
    pg.save();
    pg.translate(C - 18, C - 22);
    pg.rotate(-0.62);
    pg.scale(1, 0.54);
    const sp = pg.createRadialGradient(0, 0, 0, 0, 0, 26);
    sp.addColorStop(0, 'rgba(255,255,255,0.96)');
    sp.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = sp;
    pg.beginPath(); pg.arc(0, 0, 26, 0, Math.PI * 2); pg.fill();
    pg.restore();
    // 利落镜面小星点
    pg.fillStyle = 'rgba(255,255,255,0.96)';
    pg.beginPath(); pg.arc(C - 26, C - 28, 4.2, 0, Math.PI * 2); pg.fill();
    pg.restore();
    (BALL_CANVAS[style] ||= [])[idx] = pc;
    return PIXI.Texture.from(c);
  }
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

// 灯坊里无尽场景的迷你轨道预览图
function scenePreview(sc) {
  const S = 180, pad = 16, scale = (S - pad * 2) / 1000;
  const [c, g] = canvas(S, S);
  const mx = (x) => pad + x * scale, my = (y) => pad + y * scale;
  // 深蓝夜空圆形底
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip();
  const bg = g.createRadialGradient(S / 2, S * 0.45, 6, S / 2, S / 2, S * 0.55);
  bg.addColorStop(0, '#252a68'); bg.addColorStop(0.65, '#11143a'); bg.addColorStop(1, '#07081a');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const rnd = seeded(sc.lv * 19 + sc.id.length * 7);
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgba(255,240,210,${0.2 + rnd() * 0.45})`;
    g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.7 + rnd() * 0.9, 0, Math.PI * 2); g.fill();
  }

  const src = LEVELS[sc.lv];
  const defs = src.tracks || [{ path: src.path }];
  const tmp = { x: 0, y: 0, tx: 1, ty: 0 };
  defs.forEach((def, k) => {
    const p = new Path(def.path, 4);
    const colA = k === 0 ? '#7868ff' : '#35cde8';
    const colB = k === 0 ? '#c4b8ff' : '#9cf0ff';
    g.beginPath();
    for (let s = 0; s <= p.length; s += 14) {
      p.at(s, tmp);
      s ? g.lineTo(mx(tmp.x), my(tmp.y)) : g.moveTo(mx(tmp.x), my(tmp.y));
    }
    p.at(p.length, tmp);
    g.lineTo(mx(tmp.x), my(tmp.y));
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = colA + '55'; g.lineWidth = 10; g.stroke();
    g.strokeStyle = colA; g.lineWidth = 5; g.stroke();
    g.strokeStyle = colB; g.lineWidth = 2; g.stroke();
    // 终点古井光点
    const hx = mx(tmp.x), hy = my(tmp.y);
    g.fillStyle = '#ff4f7a';
    g.beginPath(); g.arc(hx, hy, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd0de'; g.lineWidth = 1.6; g.stroke();
  });

  // 主角灯灵位置
  const [sx, sy] = src.shooter;
  const gx = mx(sx), gy = my(sy);
  const sh = g.createRadialGradient(gx, gy, 1, gx, gy, 15);
  sh.addColorStop(0, '#fff7cf'); sh.addColorStop(0.45, '#ffbe42'); sh.addColorStop(1, 'rgba(255,170,50,0)');
  g.fillStyle = sh;
  g.beginPath(); g.arc(gx, gy, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff5cc';
  g.beginPath(); g.arc(gx, gy, 5, 0, Math.PI * 2); g.fill();
  g.restore();

  // 外缘细金圈
  g.strokeStyle = 'rgba(255,216,130,0.32)'; g.lineWidth = 2;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.stroke();
  SCENE_CANVAS[sc.id] = c;
}

// 灯火燎原：火珠（熔岩芯 + 流动的亮纹），尺寸与普通珠一致（128 画布、半径 60）
function fireOrbTex() {
  const S = 128, C = 64, r = 60;
  const [c, g] = canvas(S, S);
  const gr = g.createRadialGradient(C - 12, C - 14, 2, C, C, r);
  gr.addColorStop(0, '#fffdf0');
  gr.addColorStop(0.22, '#ffe98a');
  gr.addColorStop(0.5, '#ffa531');
  gr.addColorStop(0.8, '#ff4d12');
  gr.addColorStop(1, '#a01800');
  g.fillStyle = gr;
  g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
  // 熔岩亮纹：在球面内盘旋的几道曲线
  g.save();
  g.beginPath(); g.arc(C, C, r - 2, 0, Math.PI * 2); g.clip();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r0 = 10 + (i % 3) * 8, r1 = 44 + (i % 2) * 12;
    g.strokeStyle = i % 2 ? 'rgba(255,240,170,0.55)' : 'rgba(255,170,60,0.6)';
    g.lineWidth = 3 + (i % 3);
    g.beginPath();
    g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    g.quadraticCurveTo(C + Math.cos(a + 0.9) * (r1 * 0.8), C + Math.sin(a + 0.9) * (r1 * 0.8), C + Math.cos(a + 1.5) * r1, C + Math.sin(a + 1.5) * r1);
    g.stroke();
  }
  g.restore();
  // 外缘一圈暗红勾边 + 内圈金边，保证在亮背景上也看得出是颗球
  g.strokeStyle = 'rgba(90,10,0,0.8)'; g.lineWidth = 3;
  g.beginPath(); g.arc(C, C, r - 1.5, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,220,130,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.arc(C, C, r - 5, 0, Math.PI * 2); g.stroke();
  return PIXI.Texture.from(c);
}

// 火舌：尖头朝上的水滴形，底部最亮；锚点放在底部圆心附近使用
function flameTex() {
  const W = 64, H = 128;
  const [c, g] = canvas(W, H);
  const shape = (k) => {
    const cx = W / 2, by = H - 30, br = 24 * k;
    g.beginPath();
    g.moveTo(cx, H - (H - 4) * k - 26 * (1 - k));
    g.bezierCurveTo(cx + 10 * k, 46, cx + br + 6, by - 30 * k, cx + br, by);
    g.arc(cx, by, br, 0, Math.PI);
    g.bezierCurveTo(cx - br - 6, by - 30 * k, cx - 10 * k, 46, cx, H - (H - 4) * k - 26 * (1 - k));
    g.closePath();
  };
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, 'rgba(255,60,10,0)');
  lg.addColorStop(0.3, 'rgba(255,90,20,0.7)');
  lg.addColorStop(0.65, 'rgba(255,170,50,0.95)');
  lg.addColorStop(1, 'rgba(255,220,120,1)');
  g.fillStyle = lg; shape(1); g.fill();
  const ig = g.createLinearGradient(0, 30, 0, H);
  ig.addColorStop(0, 'rgba(255,240,180,0)');
  ig.addColorStop(0.6, 'rgba(255,245,200,0.8)');
  ig.addColorStop(1, 'rgba(255,255,240,1)');
  g.fillStyle = ig; shape(0.55); g.fill();
  return PIXI.Texture.from(c);
}

export function buildTextures() {
  TEX.ballSets = {};
  for (const sk of BALL_SKINS) TEX.ballSets[sk.id] = COLORS.map((col, i) => ballTex(col, sk.id, i));
  TEX.balls = TEX.ballSets.classic;
  TEX.petal = petalTex();
  for (const t of TRAILS) trailPreview(t);
  for (const sc of ENDLESS_SCENES) scenePreview(sc);
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
  TEX.fireOrb = fireOrbTex();
  TEX.flame = flameTex();
}
