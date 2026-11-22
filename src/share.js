// 战绩分享卡：画成一张竖版图片，带游戏二维码，方便发到群里 / 朋友圈
import { qrMatrix } from './qr.js';
import { SKIN_CANVAS } from './textures.js';

export const SHARE_URL = 'https://hbycrj.com/games/zuma/';
const W = 720, H = 1200;
const BRUSH = '"Ma Shan Zheng", "STKaiti", serif';
const UI = '"ZCOOL XiaoWei", "STSong", serif';
const NUM = '"Cinzel", Georgia, serif';

let qrCache = null;

function star(g, cx, cy, r, on) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  if (on) {
    const gr = g.createLinearGradient(0, cy - r, 0, cy + r);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.55, '#ffc23d'); gr.addColorStop(1, '#d9831c');
    g.fillStyle = gr;
    g.shadowColor = 'rgba(255,190,60,0.8)'; g.shadowBlur = 18;
  } else g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fill();
  g.shadowBlur = 0;
}

function center(g, text, y, font, fill, spacing = 0) {
  g.font = font;
  g.fillStyle = fill;
  if (!spacing) { g.textAlign = 'center'; g.fillText(text, W / 2, y); return; }
  // 手动字距
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = (W - total) / 2;
  g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, x, y); x += widths[i] + spacing; });
}

// d: { kind, title, score, stars, lines: [[标签, 值], …], badge, skin }
export function drawShareCard(d) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';

  // 夜空
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0a2e'); bg.addColorStop(0.55, '#1b1250'); bg.addColorStop(1, '#070818');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 20, W / 2, 470, 420);
  glow.addColorStop(0, 'rgba(255,170,80,0.35)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,${200 + rnd() * 55 | 0},150,${0.15 + rnd() * 0.5})`;
    g.beginPath(); g.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
  }
  // 金边
  g.strokeStyle = 'rgba(255,210,122,0.55)'; g.lineWidth = 2;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.strokeStyle = 'rgba(255,210,122,0.22)';
  g.strokeRect(32, 32, W - 64, H - 64);

  // 标题
  const lg = g.createLinearGradient(0, 70, 0, 160);
  lg.addColorStop(0, '#fffbe6'); lg.addColorStop(0.5, '#ffd87e'); lg.addColorStop(1, '#ff9d3c');
  g.shadowColor = 'rgba(255,150,60,0.6)'; g.shadowBlur = 24;
  center(g, '萤灯连珠', 150, `96px ${BRUSH}`, lg, 6);
  g.shadowBlur = 0;
  center(g, '一夜灯会 · 连珠成火', 196, `24px ${UI}`, 'rgba(255,210,122,0.85)', 8);

  // 灯灵
  const sk = SKIN_CANVAS[d.skin] || SKIN_CANVAS.orange;
  if (sk) g.drawImage(sk, W / 2 - 90, 226, 180, 198);

  // 模式 / 关卡
  center(g, d.kind, 470, `26px ${UI}`, '#b9b1d4', 10);
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8;
  center(g, d.title, 548, `68px ${BRUSH}`, '#fff1c2', 4);
  g.shadowBlur = 0;

  let y = 580;
  if (d.stars != null) {
    for (let k = 0; k < 3; k++) star(g, W / 2 + (k - 1) * 80, y + 34 - (k === 1 ? 8 : 0), k === 1 ? 34 : 28, k < d.stars);
    y += 84;
  }
  // 分数
  const sg = g.createLinearGradient(0, y, 0, y + 90);
  sg.addColorStop(0, '#fffbe6'); sg.addColorStop(1, '#ffb347');
  g.shadowColor = 'rgba(255,170,60,0.7)'; g.shadowBlur = 20;
  center(g, d.score.toLocaleString(), y + 86, `800 88px ${NUM}`, sg);
  g.shadowBlur = 0;
  y += 112;
  if (d.badge) { center(g, d.badge, y + 30, `34px ${BRUSH}`, '#ff8a5c', 4); y += 46; }
  // 数据行
  g.font = `26px ${UI}`;
  const line = d.lines.map(([k, v]) => `${k} ${v}`).join('   ·   ');
  center(g, line, y + 30, `26px ${UI}`, '#f6e9cf');

  // 二维码区
  const qy = H - 280;
  g.fillStyle = 'rgba(255,210,122,0.16)';
  g.fillRect(60, qy - 24, W - 120, 1);
  if (!qrCache) qrCache = qrMatrix(SHARE_URL);
  // 白边留足 4 个模块宽，深色背景下手机也能稳定识别
  const n = qrCache.length, cell = Math.max(4, Math.floor(150 / n)), qs = cell * n, pad = cell * 4;
  const qx = 80, qy2 = qy + 10;
  g.fillStyle = '#fff8e6';
  g.beginPath(); g.roundRect(qx, qy2, qs + pad * 2, qs + pad * 2, 12); g.fill();
  g.fillStyle = '#1a0f05';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qrCache[r][k]) g.fillRect(qx + pad + k * cell, qy2 + pad + r * cell, cell, cell);
  const tx = qx + qs + pad * 2 + 30;
  g.textAlign = 'left';
  g.font = `40px ${BRUSH}`; g.fillStyle = '#ffd27a';
  g.fillText('扫码来战', tx, qy2 + 56);
  g.font = `24px ${UI}`; g.fillStyle = '#f6e9cf';
  g.fillText('电脑、手机浏览器即点即玩', tx, qy2 + 100);
  g.fillStyle = '#b9b1d4';
  g.fillText('hbycrj.com/games/zuma', tx, qy2 + 138);
  g.font = `20px ${UI}`; g.fillStyle = 'rgba(185,177,212,0.7)';
  g.fillText('清河县翼程软件开发', tx, qy2 + 172);
  return c;
}
