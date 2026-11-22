// 关卡校验：node tools/check-levels.mjs
// 检查：同一轨道相邻圈间距、不同轨道之间间距、主角安全距离、终点距离、越界
import { Path } from '../src/path.js';
import { LEVELS } from '../src/levels.js';

const D = 46;
const MIN_GAP = 2 * D + 6;     // 两段轨道中心线最小距离
const MIN_SHOOTER = 122;       // 轨道到主角中心最小距离（手持珠半径 80 + 珠子半径 + 余量）
const MIN_HOLE = 150;
const MARGIN = 26;

const defs = (lv) => lv.tracks || [{ path: lv.path, count: lv.count }];

function sample(path) {
  const o = { x: 0, y: 0 };
  const pts = [];
  for (let s = 0; s <= path.length; s += 8) { path.at(s, o); pts.push([o.x, o.y, s]); }
  return pts;
}

function minDist(a, b, sameTrack) {
  let m = Infinity, at = null;
  for (let i = 0; i < a.length; i++) {
    for (let j = sameTrack ? i + 1 : 0; j < b.length; j++) {
      if (sameTrack && b[j][2] - a[i][2] < 3 * D) continue;
      const d = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]);
      if (d < m) { m = d; at = a[i]; }
    }
  }
  return [m, at];
}

let bad = 0;
LEVELS.forEach((lv, i) => {
  const tracks = defs(lv).map((d) => new Path(d.path));
  const samples = tracks.map(sample);
  const [sx, sy] = lv.shooter;
  let gap = Infinity, gapAt = null, cross = Infinity, crossAt = null, minSh = Infinity, minHole = Infinity, oob = 0;
  samples.forEach((pts, k) => {
    const [g, at] = minDist(pts, pts, true);
    if (g < gap) { gap = g; gapAt = at; }
    for (let k2 = k + 1; k2 < samples.length; k2++) {
      const [c, cat] = minDist(pts, samples[k2], false);
      if (c < cross) { cross = c; crossAt = cat; }
    }
    for (const [x, y, s] of pts) {
      minSh = Math.min(minSh, Math.hypot(x - sx, y - sy));
      if (s > 150 && (x < MARGIN || x > 1000 - MARGIN || y < MARGIN || y > 1000 - MARGIN)) oob++;
    }
    const e = pts[pts.length - 1];
    minHole = Math.min(minHole, Math.hypot(e[0] - sx, e[1] - sy));
  });
  // 首领：轨道不能压到年兽身上，主角与年兽之间要留出射击空间
  let bossGap = Infinity;
  if (lv.boss) {
    const b = lv.boss;
    for (const pts of samples) for (const [x, y] of pts) bossGap = Math.min(bossGap, Math.hypot(x - b.x, y - b.y) - b.r);
    bossGap = Math.min(bossGap, Math.hypot(sx - b.x, sy - b.y) - b.r - 80);
  }
  const ok = (bossGap >= D) && gap >= MIN_GAP && cross >= MIN_GAP && minSh >= MIN_SHOOTER && minHole >= MIN_HOLE && oob === 0;
  if (!ok) bad++;
  const fmt = (v, at) => `${v === Infinity ? '  - ' : v.toFixed(0).padStart(4)}${v < MIN_GAP && at ? `(@${at[0].toFixed(0)},${at[1].toFixed(0)})` : ''}`;
  console.log(
    `${ok ? 'OK ' : 'BAD'} ${String(i + 1).padStart(2)} ${lv.name.padEnd(5, '　')} ${tracks.length}轨 ` +
    `长度 ${tracks.map((t) => t.length.toFixed(0)).join('+').padStart(9)}  圈距${fmt(gap, gapAt)}  轨距${fmt(cross, crossAt)}` +
    `${lv.boss ? `  首领余量 ${bossGap.toFixed(0)}` : ''}  主角距 ${minSh.toFixed(0).padStart(4)}  终点距 ${minHole.toFixed(0).padStart(4)}  越界 ${oob}`,
  );
});
process.exit(bad ? 1 : 0);
