// 每日一灯：按日期挑一个关卡 + 一条当夜规则，每天一换
import { LEVELS } from './levels.js';

export const DAILY = -2;   // 关卡编号：-1 是无尽模式，-2 是每日一灯

const mirrorPts = (pts) => pts.map(([x, y]) => [1000 - x, y]);

export const RULES = [
  { id: 'three', name: '三色夜', desc: '珠子只有三种颜色，一消一大片', apply: (lv) => { lv.colors = 3; } },
  { id: 'swift', name: '疾风夜', desc: '珠串快两成，得分 ×1.5', apply: (lv) => { lv.speed *= 1.2; lv.scoreMul = 1.5; } },
  { id: 'bare', name: '素灯夜', desc: '没有道具珠，全凭手上功夫，得分 ×1.3', apply: (lv) => { lv.noPower = true; lv.scoreMul = 1.3; } },
  { id: 'blaze', name: '燎原夜', desc: '燎原只需攒一半就能点燃', apply: (lv) => { lv.feverMul = 0.5; } },
  { id: 'prism', name: '虹彩夜', desc: '每 8 发必出一颗彩珠', apply: (lv) => { lv.prism = 8; } },
  { id: 'mirror', name: '镜像夜', desc: '轨道左右翻转，熟悉的关卡换个方向', apply: (lv) => {
    if (lv.tracks) lv.tracks = lv.tracks.map((t) => ({ ...t, path: mirrorPts(t.path) }));
    else lv.path = mirrorPts(lv.path);
    lv.shooter = [1000 - lv.shooter[0], lv.shooter[1]];
  } },
  { id: 'chain', name: '连环夜', desc: '连锁得分翻倍', apply: (lv) => { lv.chainMul = 2; } },
  { id: 'long', name: '长龙夜', desc: '珠串多四成，得分 ×1.3', apply: (lv) => {
    if (lv.tracks) lv.tracks = lv.tracks.map((t) => ({ ...t, count: Math.round(t.count * 1.4) }));
    else lv.count = Math.round(lv.count * 1.4);
    lv.scoreMul = 1.3;
  } },
];

// 本地日期 YYYY-MM-DD
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 当天的关卡定义（同一天每次进入都一样）
export function dailyLevel(key = dayKey()) {
  const h = hash('lantern-' + key);
  // 只从中段关卡里挑：太简单没意思，后期关卡叠上规则又太难
  const pool = LEVELS.map((l, i) => i).filter((i) => !LEVELS[i].boss && i >= 1 && i <= 11);
  const base = LEVELS[pool[h % pool.length]];
  const rule = RULES[(h >>> 8) % RULES.length];
  const lv = structuredClone({ ...base, name: base.name });
  rule.apply(lv);
  lv.daily = true;
  lv.rule = rule;
  lv.baseName = base.name;
  lv.name = `${rule.name}·${base.name}`;
  return lv;
}
