// 关卡：世界坐标为 1000×1000 的正方形，横屏/竖屏都等比适配
// 用 tools/check-levels.mjs 校验：相邻圈间距、主角安全距离、越界

const RAD = Math.PI / 180;

// 通用螺旋：rFn(θ, t) 决定半径形状，t 为 0→1 的进度
function spiralBy({ cx = 500, cy = 500, r0, r1, a0 = 0, turns, ccw = false, step = 6, shape = null, sx = 1, sy = 1 }) {
  const pts = [];
  const total = turns * 360;
  for (let d = 0; d <= total + 0.001; d += step) {
    const t = d / total;
    const a = (a0 + (ccw ? -d : d)) * RAD;
    let r = r0 + (r1 - r0) * t;
    if (shape) r *= shape(a, t);
    pts.push([cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy]);
  }
  return pts;
}

const spiral = (o) => spiralBy(o);
const flower = (k, amp) => (a) => 1 + amp * Math.cos(k * a);
// 方圆（超椭圆）：圆角方形螺旋
const squircle = (n = 4) => (a) => {
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
};

// 由起点切线方向反推一段引入线，让珠串从边缘外滑入
function leadIn(pts, len = 260) {
  const [x0, y0] = pts[0], [x1, y1] = pts[1];
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  return [[x0 - (dx / l) * len, y0 - (dy / l) * len], ...pts];
}

export const LEVELS = [
  {
    name: '萤火初现', colors: 4, count: 70, speed: 44, rushTo: 0.3, shooter: [500, 500],
    path: [[150, 52], ...spiral({ r0: 448, r1: 205, a0: -90, turns: 1.55 })],
  },
  {
    name: '曲水流灯', colors: 4, count: 90, speed: 48, rushTo: 0.3, shooter: [500, 625],
    path: [
      [70, 110], [500, 110], [850, 110], [935, 200], [850, 290], [500, 290], [170, 290],
      [95, 385], [100, 560], [110, 780], [200, 915], [500, 920], [800, 915], [905, 800],
      [900, 580], [845, 455], [710, 440], [625, 495],
    ],
  },
  {
    name: '方城夜市', colors: 4, count: 100, speed: 50, rushTo: 0.3, shooter: [500, 505],
    path: leadIn(spiral({ cy: 505, r0: 430, r1: 215, a0: -90, turns: 1.55, shape: squircle(4) }), 300),
  },
  {
    name: '星河回旋', colors: 4, count: 110, speed: 54, rushTo: 0.3, shooter: [500, 500],
    path: [[170, 958], ...spiral({ r0: 458, r1: 175, a0: 90, turns: 2.0, ccw: true })],
  },
  // —— 双轨：上下两条横向蛇形，从两侧同时压向中间 ——
  {
    name: '鹊桥相会', colors: 4, speed: 36, rushTo: 0.26, shooter: [500, 500],
    tracks: [
      { count: 60, path: [[-40, 80], [500, 80], [880, 80], [945, 155], [880, 230], [500, 230], [150, 230], [75, 305], [150, 380], [380, 380]] },
      { count: 60, path: [[1040, 920], [500, 920], [120, 920], [55, 845], [120, 770], [500, 770], [850, 770], [925, 695], [850, 620], [620, 620]] },
    ],
  },
  {
    name: '莲花灯', colors: 4, count: 120, speed: 56, rushTo: 0.3, shooter: [500, 500],
    path: leadIn(spiral({ r0: 405, r1: 190, a0: 144, turns: 1.6, ccw: true, shape: flower(5, 0.09) }), 50),
  },
  {
    name: '竹林小径', colors: 4, count: 120, speed: 58, rushTo: 0.3, shooter: [800, 520],
    path: [
      [80, -40], [80, 300], [80, 700], [90, 850], [160, 905], [230, 850], [240, 700], [240, 300],
      [250, 150], [320, 95], [390, 150], [400, 300], [400, 700], [410, 850], [480, 905],
      [550, 850], [560, 700], [565, 470],
    ],
  },
  // —— 双轨：两条螺旋臂交错盘入，打外圈时要越过内圈 ——
  {
    name: '双龙戏珠', colors: 5, speed: 40, rushTo: 0.26, shooter: [500, 500],
    tracks: [
      { count: 65, path: spiral({ r0: 455, r1: 215, a0: -90, turns: 1.15 }) },
      { count: 65, path: spiral({ r0: 455, r1: 215, a0: 90, turns: 1.15 }) },
    ],
  },
  {
    name: '弦月', colors: 5, count: 125, speed: 58, rushTo: 0.3, shooter: [500, 520],
    path: leadIn(spiral({ cy: 520, r0: 455, r1: 225, a0: -90, turns: 1.6, sx: 1, sy: 0.86 }), 300),
  },
  {
    name: '九曲桥', colors: 5, count: 135, speed: 60, rushTo: 0.3, shooter: [500, 830],
    path: [
      [-40, 80], [500, 80], [870, 80], [940, 160], [870, 240], [500, 240], [130, 240],
      [60, 320], [130, 400], [500, 400], [870, 400], [940, 480], [870, 560], [600, 560], [330, 565],
    ],
  },
  // —— 双轨：外圈大环 + 内圈小螺旋，内圈挡住外圈的射线 ——
  {
    name: '日月同辉', colors: 5, speed: 40, rushTo: 0.26, shooter: [500, 500],
    tracks: [
      { count: 55, path: leadIn(spiral({ r0: 458, r1: 452, a0: 180, turns: 0.85 }), 200) },
      { count: 60, rushTo: 0.14, path: spiral({ r0: 320, r1: 178, a0: 0, turns: 1.0, ccw: true }) },
    ],
  },
  {
    name: '星芒', colors: 5, count: 145, speed: 62, rushTo: 0.3, shooter: [500, 500],
    path: leadIn(spiral({ r0: 410, r1: 195, a0: -60, turns: 1.7, shape: flower(6, 0.08) }), 50),
  },
  {
    name: '回字阵', colors: 5, count: 155, speed: 62, rushTo: 0.3, shooter: [500, 500],
    path: leadIn(spiral({ r0: 440, r1: 190, a0: 0, turns: 2.0, ccw: true, shape: squircle(4) }), 200),
  },
  // —— 双轨：左右镜像竖列，一上一下逆向而行 ——
  {
    name: '镜湖', colors: 5, speed: 46, rushTo: 0.26, shooter: [500, 500],
    tracks: [
      { count: 75, path: [[70, -40], [70, 300], [70, 820], [140, 905], [210, 820], [210, 500], [210, 180], [280, 95], [350, 180], [350, 420], [350, 640]] },
      { count: 75, path: [[930, 1040], [930, 700], [930, 180], [860, 95], [790, 180], [790, 500], [790, 820], [720, 905], [650, 820], [650, 580], [650, 360]] },
    ],
  },
  {
    name: '浪花', colors: 5, count: 155, speed: 66, rushTo: 0.3, shooter: [500, 500],
    path: leadIn(spiral({ r0: 430, r1: 185, a0: 90, turns: 1.85, shape: flower(9, 0.05) }), 200),
  },
  {
    name: '万家灯火', colors: 5, count: 180, speed: 70, rushTo: 0.28, shooter: [500, 500],
    path: [[150, 960], ...spiral({ r0: 462, r1: 170, a0: 90, turns: 2.25, ccw: true })],
  },
  // —— 首领关：年兽盘踞中央，环形轨道绕场一周 ——
  {
    name: '驱年兽', colors: 4, speed: 40, rushTo: 0.2, shooter: [500, 735],
    boss: { name: '年兽', x: 500, y: 395, r: 108, hp: 420 },
    path: leadIn(spiral({ r0: 458, r1: 395, a0: -90, turns: 0.9, shape: squircle(5) }), 230),
  },
];

// 难度曲线（未单独指定时按关卡序号自动生成）
//   ramp：关内加速，开局后 RAMP_TIME 秒内推进速度逐渐提高到 (1 + ramp) 倍
//   zip / setup：出珠时"拉链""夹心"结构占的比例，打掉中间一段两边会合并连锁
//   surge：后期关卡的"潮涌"，每隔 every 秒珠串加速冲一小段，出现前有预警
LEVELS.forEach((lv, i) => {
  lv.ramp ??= lv.boss ? 0.25 : Math.min(0.55, 0.12 + i * 0.028);
  lv.zip ??= i < 6 ? 0.45 : 0.35;     // 拉链段比例（A A B B A A B B…，任意一对都能引发大连锁）
  lv.setup ??= i < 6 ? 0.4 : 0.45;    // 多层夹心比例；剩下的是普通段
  lv.depth ??= i < 3 ? [1, 2] : i < 9 ? [1, 3] : [2, 4];   // 夹心层数：层数 = 一枪最多连锁次数
  if (lv.surge === undefined && !lv.boss && i >= 8) lv.surge = { every: Math.max(13, 22 - (i - 8) * 1.2), mul: 2.1, dur: 1.5 };
});

// —— 无尽模式：珠串永不停歇；每 ENDLESS_STAGE 秒进入下一"重"，越来越快 ——
export const ENDLESS_STAGE = 35;

// 灯坊可解锁的无尽场景：复用主线经典地形（默认保留「万家灯火」长螺旋）
export const ENDLESS_SCENES = [
  { id: 'default', lv: 15, name: '万家灯火', desc: '经典长螺旋，灯火漫卷，最适合初探无尽长夜', price: 0 },
  { id: 'river',   lv: 1,  name: '曲水流灯', desc: '蜿蜒曲水大回环，中后段视野开阔，节奏明快', price: 1000 },
  { id: 'lotus',   lv: 5,  name: '莲花灯',   desc: '五瓣莲花旋入，弧线优雅，穿瓣连消爽快', price: 1400 },
  { id: 'bamboo',  lv: 6,  name: '竹林小径', desc: '竖列折返长径，灯灵居侧，斜射截击手感独特', price: 1800 },
  { id: 'bridge',  lv: 9,  name: '九曲桥',   desc: '层层横桥步步逼近，隔桥狙击最考准头', price: 2200 },
  { id: 'maze',    lv: 12, name: '回字阵',   desc: '两圈方正回字阵，拐角密集，适合连环夹心', price: 2600 },
  { id: 'magpie',  lv: 4,  name: '鹊桥相会', desc: '双轨夹击，上下两道灯龙齐进，控场刺激倍增', price: 3200, twin: true },
  { id: 'dragons', lv: 7,  name: '双龙戏珠', desc: '双螺旋交错盘入，穿内圈打外圈的高阶舞台', price: 3800, twin: true },
  { id: 'mirror',  lv: 13, name: '镜湖',     desc: '左右镜像逆行双轨，游历三个无尽场景后解锁', ach: 'scene_tour', twin: true },
];

export const ENDLESS = {
  name: '无尽长夜', endless: true, colors: 4, speed: 42, rushTo: 0.3, shooter: [500, 500],
  ramp: 0, zip: 0.45, setup: 0.4, depth: [1, 3], surge: null,
  path: LEVELS[15].path,
};

// 按灯坊选中的场景组装一局无尽模式关卡
export function endlessLevel(sceneId = 'default') {
  const sc = ENDLESS_SCENES.find((s) => s.id === sceneId) || ENDLESS_SCENES[0];
  const src = LEVELS[sc.lv];
  const lv = {
    ...ENDLESS,
    name: `无尽·${sc.name}`,
    sceneId: sc.id,
    sceneName: sc.name,
    twin: !!sc.twin,
    shooter: src.shooter,
    rushTo: src.rushTo ?? ENDLESS.rushTo,
    ...endlessStage(1, !!sc.twin),
  };
  if (src.tracks) {
    lv.tracks = src.tracks.map((t) => ({ ...t }));
    delete lv.path;
  } else {
    lv.path = src.path;
  }
  return lv;
}

// 第 n 重（从 1 开始）的难度：前 10 重快速升温，之后缓慢但持续地变难、没有上限
// 夜深：压力一层层错开加入，最多 5 种颜色，避免后期陡峭与辨色混淆
export const NIGHT_DEPTHS = [
  { n: 16, text: '夜深 · 墨染：不时有墨点把珠子染成别的颜色' },
  { n: 25, text: '夜深 · 潮涌更急更猛' },
  { n: 30, text: '夜更深 · 墨染更密' },
];
export function endlessStage(n, twin = false) {
  // 速度：1～10 重每重 +6，10～24 重每重 +3，之后每重 +2.5（线性，不封顶）；双轨按 0.72 倍平衡
  const baseSpeed = n <= 10 ? 42 + (n - 1) * 6 : n <= 24 ? 96 + (n - 10) * 3 : 138 + (n - 24) * 2.5;
  const speed = twin ? Math.round(baseSpeed * 0.72) : baseSpeed;
  const late = Math.max(0, n - 25);
  return {
    speed,
    colors: n <= 3 ? 4 : 5,
    zip: Math.max(0.12, 0.45 - (n - 1) * 0.03),        // 送分的拉链段越来越少
    setup: Math.max(0.3, 0.4 - Math.max(0, n - 8) * 0.01),
    depth: n <= 2 ? [1, 2] : n <= 5 ? [1, 3] : [2, 4],
    surge: n >= 3 ? {
      every: n < 25 ? Math.max(7, 22 - (n - 3) * 1.5) : Math.max(5.5, 7 - late * 0.1),
      mul: n < 10 ? 2.1 : n < 25 ? 2.4 : Math.min(2.9, 2.45 + late * 0.03),
      dur: n < 10 ? 1.5 : n < 25 ? 1.8 : 2,
    } : null,
    ink: n >= 16 ? {
      every: Math.max(7, 16 - (n - 16) * 0.3),
      count: Math.min(6, n < 30 ? 2 + Math.floor((n - 16) / 5) : 4 + Math.floor((n - 30) / 5)),
    } : null,
  };
}
