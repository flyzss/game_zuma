// 手感调参：游戏里按 ` 键（或网址加 ?dev）打开调参面板实时修改
// 面板里"复制参数"得到的 JSON 发给我，即可把它固化为默认值
export const PARAMS = [
  { group: '发射' },
  { key: 'shotSpeed', label: '发射速度', def: 1500, min: 700, max: 2600, step: 50 },
  { key: 'insertTime', label: '插入动画(秒)', def: 0.13, min: 0.04, max: 0.35, step: 0.01 },
  { key: 'fireCooldown', label: '发射间隔(秒)', def: 0.16, min: 0.05, max: 0.5, step: 0.01 },

  { group: '珠串' },
  { key: 'speedMul', label: '推进速度倍率', def: 1.5, min: 0.3, max: 3, step: 0.05 },
  { key: 'refillSpeed', label: '补珠冲入速度', def: 800, min: 0, max: 1400, step: 20 },
  { key: 'rushSpeed', label: '开局冲入速度', def: 560, min: 150, max: 1200, step: 10 },
  { key: 'retreatAcc', label: '回吸加速度', def: 2200, min: 300, max: 4000, step: 50 },
  { key: 'retreatMax', label: '回吸最大速度', def: 950, min: 200, max: 1600, step: 20 },
  { key: 'dangerSlow', label: '临终减速倍率', def: 0.7, min: 0.2, max: 1, step: 0.05 },

  { group: '打击感' },
  { key: 'shake', label: '震屏强度', def: 1, min: 0, max: 2.5, step: 0.05 },
  { key: 'hitStop', label: '顿帧强度', def: 1, min: 0, max: 3, step: 0.1 },
  { key: 'particles', label: '粒子数量', def: 1, min: 0, max: 2.5, step: 0.1 },

  { group: '道具' },
  { key: 'powerEvery', label: '出现间隔(秒)', def: 9, min: 3, max: 30, step: 0.5 },
  { key: 'powerLife', label: '存在时长(秒)', def: 12, min: 4, max: 30, step: 1 },
  { key: 'powerMax', label: '同时最多', def: 2, min: 0, max: 5, step: 1 },
  { key: 'bombRadius', label: '炸裂半径', def: 125, min: 60, max: 260, step: 5 },
  { key: 'slowTime', label: '缓行时长(秒)', def: 6, min: 1, max: 15, step: 0.5 },
  { key: 'reverseTime', label: '倒流时长(秒)', def: 3, min: 0.5, max: 8, step: 0.25 },
  { key: 'reverseSpeed', label: '倒流速度', def: 140, min: 40, max: 400, step: 10 },

  { group: '灯火燎原（Fever）' },
  { key: 'feverNeed', label: '充满所需消除数', def: 50, min: 10, max: 120, step: 2 },
  { key: 'feverShots', label: '火珠数量', def: 6, min: 2, max: 30, step: 1 },
  { key: 'feverTime', label: '最长持续(秒)', def: 10, min: 3, max: 20, step: 0.5 },
  { key: 'feverBlast', label: '火珠爆炸半径', def: 100, min: 0, max: 220, step: 5 },

  { group: '声音' },
  { key: 'musicVol', label: '背景音乐音量', def: 0.6, min: 0, max: 1.5, step: 0.05 },
  { key: 'rollVol', label: '滚动音量', def: 1, min: 0, max: 2.5, step: 0.05 },
];

export const CFG = {};
for (const p of PARAMS) if (p.key) CFG[p.key] = p.def;

const STORE = 'lanternOrbs.cfg';
export function loadCfg() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const k of Object.keys(saved)) if (k in CFG) CFG[k] = saved[k];
  } catch { /* 忽略 */ }
}
export function saveCfg() {
  const diff = {};
  for (const p of PARAMS) if (p.key && CFG[p.key] !== p.def) diff[p.key] = CFG[p.key];
  try { localStorage.setItem(STORE, JSON.stringify(diff)); } catch { /* 忽略 */ }
  return diff;
}
export function resetCfg() {
  for (const p of PARAMS) if (p.key) CFG[p.key] = p.def;
  try { localStorage.removeItem(STORE); } catch { /* 忽略 */ }
}
