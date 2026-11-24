// 无尽模式「灯符」：每升一重从三张里选一张，效果可叠加
// max：最多叠几层；w：出现权重；rare：稀有（金边）；once：一次性效果，不占层数
export const TALISMANS = [
  { id: 'blaze', ch: '焰', name: '烈焰符', desc: (l) => `燎原积攒速度 +${25 * l}%`, max: 3, w: 10 },
  { id: 'ember', ch: '燃', name: '久燃符', desc: (l) => `每次燎原多 ${2 * l} 发火珠`, max: 3, w: 8 },
  { id: 'arc', ch: '惊', name: '引雷符', desc: (l) => `惊雷充能 +${30 * l}%，闪电球额外炸开周围珠子`, max: 3, w: 9 },
  { id: 'prism', ch: '虹', name: '虹光符', desc: (l) => `每 ${prismEvery(l)} 发必出一颗彩珠`, max: 3, w: 8 },
  { id: 'chain', ch: '环', name: '连环符', desc: (l) => `连锁得分 +${50 * l}%`, max: 3, w: 9 },
  { id: 'calm', ch: '稳', name: '沉稳符', desc: (l) => `珠串推进速度 -${10 * l}%`, max: 2, w: 9 },
  { id: 'tide', ch: '潮', name: '定海符', desc: (l) => `潮涌威力 -${25 * l}%`, max: 2, w: 6 },
  { id: 'treasure', ch: '宝', name: '聚宝符', desc: (l) => `道具珠出现频率 +${Math.round((1 / (1 - 0.25 * l) - 1) * 100)}%`, max: 2, w: 8 },
  { id: 'thunder', ch: '雷', name: '雷火符', desc: (l) => `炸裂范围 +${40 * l}%，火珠爆炸范围 +${20 * l}%`, max: 2, w: 7 },
  { id: 'long', ch: '缓', name: '长生符', desc: (l) => `缓行与倒流持续时间 +${50 * l}%`, max: 2, w: 7 },
  { id: 'toad', ch: '蟾', name: '金蟾符', desc: (l) => `所有得分 +${25 * l}%`, max: 3, w: 9 },
  { id: 'swift', ch: '疾', name: '疾射符', desc: (l) => `珠子飞得更快，发射间隔 -${20 * l}%`, max: 2, w: 7 },
  { id: 'guard', ch: '护', name: '护连符', desc: (l) => `每一重有 ${l} 次失手不断连击`, max: 3, w: 7 },
  { id: 'gamble', ch: '险', name: '博险符', desc: (l) => `得分 ×${(1.5 ** l).toFixed(2).replace(/\.?0+$/, '')}，但珠串加速 ${15 * l}%`, max: 3, w: 4, rare: true },
  { id: 'rewind', ch: '回', name: '回春符', desc: () => '立刻让珠串倒流 4 秒', once: true, w: 6 },
];
export const TAL = Object.fromEntries(TALISMANS.map((t) => [t.id, t]));
export function prismEvery(l) { return Math.max(6, 15 - 3 * l); }

export const BAG_SIZE = 6;          // 灵符囊：最多带 6 种不同的灵符
export const CURSE_SPEED = 0.06;    // 祸福符的代价：每张让珠串快 6%
export const CURSE_SCORE = 0.1;     // 同时得分 +10%，让人愿意冒险

// 第几重可以选灵符：前期每重都给，后期越来越少
export function choiceStage(n) {
  if (n <= 12) return true;
  if (n <= 24) return n % 2 === 0;
  return n % 3 === 0;
}

// 抽三张：未满层的才会出现；囊满后新种类需要替换旧符，已有的权重翻倍；
// 第 15 重起有一定几率变成「祸福符」：一次升两层，但珠串加速
export function rollTalismans(perks, stage = 1, n = 3) {
  const owned = Object.keys(perks).filter((k) => perks[k] > 0);
  const full = owned.length >= BAG_SIZE;
  const pool = TALISMANS.filter((t) => t.once || (perks[t.id] || 0) < t.max)
    .map((t) => ({ t, w: t.w * (full && owned.includes(t.id) ? 2 : 1) }));
  const out = [];
  while (out.length < n && pool.length) {
    let tot = 0;
    for (const p of pool) tot += p.w;
    let r = Math.random() * tot, k = 0;
    for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
    const t = pool.splice(k, 1)[0].t;
    const lv = perks[t.id] || 0;
    const canDouble = !t.once && t.id !== 'gamble' && t.max - lv >= 2;
    out.push({
      id: t.id, t,
      double: stage >= 15 && canDouble && Math.random() < 0.4,
      swap: !t.once && !lv && full,
    });
  }
  return out;
}

// 连击段位：达到 n 连击后得分乘以 mul
export const COMBO_TIERS = [
  { n: 3, name: '妙', mul: 1.2, color: '#ffd27a' },
  { n: 6, name: '绝', mul: 1.5, color: '#ffb02e' },
  { n: 10, name: '神', mul: 2, color: '#ff6a3c' },
  { n: 15, name: '天下无双', mul: 3, color: '#ff3d6e' },
];
export function comboTier(c) {
  let t = -1;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (c >= COMBO_TIERS[i].n) t = i;
  return t;
}
