// 局外系统：存档、成就「灯谱」、每关挑战、灯币与灯灵外观
import { LEVELS, ENDLESS_SCENES } from './levels.js';
import { SKINS, BALL_SKINS, TRAILS } from './textures.js';
import { DAILY, dayKey, prevDayKey } from './daily.js';

export const store = {
  get(k, d) {
    try { const v = localStorage.getItem('lanternOrbs.' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('lanternOrbs.' + k, JSON.stringify(v)); } catch { /* 隐私模式等情况忽略 */ }
  },
};

const BOSS_I = LEVELS.findIndex((l) => l.boss);
const LAST_I = LEVELS.length - 1;
const POWER_TYPES = ['bomb', 'slow', 'reverse', 'lightning', 'rainbow'];

// ================= 存档 =================
const LIFE_KEYS = ['plays', 'wins', 'losses', 'removed', 'matches', 'fevers', 'clears', 'shots', 'coinsEarned', 'playTime', 'gemHits'];
function defaults() {
  const life = {};
  for (const k of LIFE_KEYS) life[k] = 0;
  life.powers = {};
  return { coins: 0, life, ach: {}, chal: {}, skins: ['orange'], skin: 'orange', seen: 0, lit: 0,
    balls: ['classic'], ball: 'classic', trails: ['plain'], trail: 'plain',
    scenes: ['default'], scene: 'default', endlessSeen: [],
    daily: { day: '', best: 0, done: false, streak: 0, lastDone: '', total: 0 } };
}
const P = Object.assign(defaults(), store.get('profile', {}));
P.life = Object.assign(defaults().life, P.life);
P.daily = Object.assign(defaults().daily, P.daily);
if (!Array.isArray(P.scenes) || !P.scenes.length) P.scenes = ['default'];
if (!ENDLESS_SCENES.some((s) => s.id === P.scene)) P.scene = 'default';
if (!Array.isArray(P.endlessSeen)) P.endlessSeen = [];
const save = () => store.set('profile', P);

const totalStars = () => LEVELS.reduce((a, _, i) => a + store.get('stars' + i, 0), 0);
const threeStarAll = () => LEVELS.every((_, i) => store.get('stars' + i, 0) >= 3);
const buyable = SKINS.filter((s) => !s.ach && s.price > 0);
const buyableBalls = BALL_SKINS.filter((s) => !s.ach && s.price > 0);
const buyablePlush = BALL_SKINS.filter((s) => s.plush && !s.ach && s.price > 0);
const plushIds = BALL_SKINS.filter((s) => s.plush).map((s) => s.id);
const buyableScenes = ENDLESS_SCENES.filter((s) => !s.ach && s.price > 0);

// 灯坊货架：类别 → 商品列表 / 已拥有字段 / 正在使用字段
export const SHELVES = {
  lantern: { name: '灯灵', list: SKINS, own: 'skins', use: 'skin' },
  ball: { name: '珠子', list: BALL_SKINS, own: 'balls', use: 'ball' },
  trail: { name: '拖尾', list: TRAILS, own: 'trails', use: 'trail' },
  scene: { name: '夜境', list: ENDLESS_SCENES, own: 'scenes', use: 'scene' },
};
const allBuyable = () => Object.values(SHELVES).flatMap((sh) => sh.list.filter((x) => !x.ach && x.price > 0).map((x) => [sh, x]));
const boughtAny = () => Object.values(SHELVES).some((sh) => P[sh.own].length > 1);

// 灯油续燃：每局最多 3 次，价格翻倍
export const REVIVE_COST = [60, 120, 240];

// ================= 成就 =================
// test(c)：c.run 本局统计，c.sum(k) 生涯累计（含本局），c.end 结算信息（局中为 null）
// cat 分类；coin 奖励；hidden 未解锁前显示为「？？？」
const A = (id, cat, name, desc, coin, test, hidden = false) => ({ id, cat, name, desc, coin, test, hidden });
const won = (c) => c.end?.won && c.end.level >= 0;
export const ACHIEVEMENTS = [
  // —— 初入灯会 ——
  A('first_match', '初入灯会', '初试灯火', '第一次消除珠子', 10, (c) => c.sum('matches') >= 1),
  A('first_win', '初入灯会', '一夜成名', '第一次过关', 20, won),
  A('wins_10', '初入灯会', '夜游常客', '累计过关 10 次', 50, (c) => c.sum('wins') >= 10),
  A('wins_50', '初入灯会', '灯会熟客', '累计过关 50 次', 150, (c) => c.sum('wins') >= 50),
  A('removed_1k', '初入灯会', '千珠散尽', '累计消除 1,000 颗珠子', 50, (c) => c.sum('removed') >= 1000),
  A('removed_10k', '初入灯会', '万灯齐明', '累计消除 10,000 颗珠子', 150, (c) => c.sum('removed') >= 10000),
  A('removed_50k', '初入灯会', '星河倒悬', '累计消除 50,000 颗珠子', 300, (c) => c.sum('removed') >= 50000),
  A('stars_25', '初入灯会', '半壁星光', '累计获得 25 颗星', 80, () => totalStars() >= 25),
  A('stars_all', '初入灯会', '满天星斗', '所有关卡都拿到三星', 500, threeStarAll),
  A('last_level', '初入灯会', '灯路尽头', `通关第${LEVELS.length}关`, 200, (c) => c.end?.won && c.end.level === LAST_I),

  // —— 连珠妙手 ——
  A('chain3', '连珠妙手', '连环三响', '打出一次 ×3 连锁', 20, (c) => c.run.bestChain >= 3),
  A('chain5', '连珠妙手', '五连珠璧', '打出一次 ×5 连锁', 80, (c) => c.run.bestChain >= 5),
  A('chain7', '连珠妙手', '七星连珠', '打出一次 ×7 连锁', 200, (c) => c.run.bestChain >= 7),
  A('burst8', '连珠妙手', '一网打尽', '一次消除 8 颗以上', 40, (c) => c.run.bestBurst >= 8),
  A('burst15', '连珠妙手', '横扫千军', '一次消除 15 颗以上', 120, (c) => c.run.bestBurst >= 15),
  A('combo5', '连珠妙手', '弹无虚发', '连击达到 5', 30, (c) => c.run.bestCombo >= 5),
  A('combo10', '连珠妙手', '百步穿杨', '连击达到 10', 100, (c) => c.run.bestCombo >= 10),
  A('combo20', '连珠妙手', '神射无双', '连击达到 20', 250, (c) => c.run.bestCombo >= 20),
  A('close', '连珠妙手', '化险为夷', '珠串逼近古井时打出消除', 40, (c) => c.run.closeCalls >= 1),
  A('close_win', '连珠妙手', '绝处逢生', '珠串曾到过井口边，却仍然过关', 80, (c) => won(c) && c.run.maxLead > 0.93),
  A('tier_god', '连珠妙手', '天下无双', '连击达到「天下无双」段位', 300, (c) => c.run.maxTier >= 3),
  A('clean', '连珠妙手', '一扫而空', '把一条珠串打空', 30, (c) => c.run.clears >= 1),
  A('clean3', '连珠妙手', '片甲不留', '一局里打空珠串 3 次', 100, (c) => c.run.clears >= 3),

  // —— 灯火燎原 ——
  A('fever', '灯火燎原', '初燃燎原', '第一次触发燎原', 20, (c) => c.run.fevers >= 1),
  A('fever3', '灯火燎原', '星火燎原', '一局里触发 3 次燎原', 80, (c) => c.run.fevers >= 3),
  A('fever_50', '灯火燎原', '烈焰不熄', '累计触发 50 次燎原', 150, (c) => c.sum('fevers') >= 50),
  A('power_all', '灯火燎原', '百宝锦囊', '五种道具都触发过', 80, (c) => POWER_TYPES.every((t) => (P.life.powers[t] || 0) + (c.run.powers[t] || 0) > 0)),
  A('bomb_20', '灯火燎原', '爆竹声声', '累计触发 20 次炸裂', 50, (c) => (P.life.powers.bomb || 0) + (c.run.powers.bomb || 0) >= 20),
  A('zap3', '灯火燎原', '雷霆万钧', '一局里触发 3 次雷光', 80, (c) => (c.run.powers.lightning || 0) >= 3),
  A('no_power', '灯火燎原', '不假外物', '不触发任何道具过关', 60, (c) => won(c) && c.run.powerCount === 0),
  A('no_swap', '灯火燎原', '从一而终', '一次都不交换珠子就过关', 60, (c) => won(c) && c.run.swaps === 0),
  A('safe', '灯火燎原', '闲庭信步', '珠串从未越过轨道一半就过关', 100, (c) => won(c) && c.run.maxLead < 0.5),

  // —— 驱傩逐兽 ——
  A('boss_win', '驱傩逐兽', '驱年兽', '击退年兽（奖励：金龙灯）', 100, (c) => c.end?.won && c.end.level === BOSS_I),
  A('boss_fast', '驱傩逐兽', '速驱年兽', '100 秒内击退年兽', 200, (c) => c.end?.won && c.end.level === BOSS_I && c.end.time < 100),
  A('gem_10', '驱傩逐兽', '一击即中', '一局里直击年兽宝珠 10 次', 80, (c) => c.run.gemHits >= 10),
  A('gem_100', '驱傩逐兽', '百发百中', '累计直击年兽宝珠 100 次', 150, (c) => c.sum('gemHits') >= 100),

  // —— 无尽长夜 ——
  A('endless_5', '无尽长夜', '长夜漫漫', '无尽模式坚持到第五重', 60, (c) => c.level === -1 && c.run.stage >= 5),
  A('endless_10', '无尽长夜', '彻夜不眠', '无尽模式坚持到第十重（奖励：夜明灯）', 150, (c) => c.level === -1 && c.run.stage >= 10),
  A('endless_15', '无尽长夜', '不夜之天', '无尽模式坚持到第十五重', 300, (c) => c.level === -1 && c.run.stage >= 15),
  A('perk_first', '无尽长夜', '灵符初成', '在无尽模式里选下第一道灵符', 20, (c) => c.run.perks >= 1),
  A('perk_8', '无尽长夜', '符箓满身', '一局无尽模式里选下 8 道灵符', 150, (c) => c.run.perks >= 8),
  A('gamble_3', '无尽长夜', '孤注一掷', '把博险符叠满三层', 200, (c) => c.level === -1 && (c.perks?.gamble || 0) >= 3),
  A('endless_50k', '无尽长夜', '灯火通宵', '无尽模式单局 50,000 分', 200, (c) => c.level === -1 && c.score >= 50000),
  A('scene_tour', '无尽长夜', '游历夜境', '在 3 个不同的无尽场景里坚持到第五重（奖励：镜湖）', 180, () => P.endlessSeen.length >= 3),
  A('endless_twin', '无尽长夜', '双龙守夜', '在双轨无尽场景里坚持到第八重', 220, (c) => c.level === -1 && !!c.run.twin && c.run.stage >= 8),

  // —— 每日一灯 ——
  A('daily_1', '每日一灯', '今夜有约', '完成一次每日一灯', 30, () => P.daily.total >= 1),
  A('daily_3', '每日一灯', '三夜连游', '连续 3 天完成每日一灯', 80, () => P.daily.streak >= 3),
  A('daily_7', '每日一灯', '七夜灯会', '连续 7 天完成每日一灯', 300, () => P.daily.streak >= 7),
  A('daily_30', '每日一灯', '夜夜笙歌', '累计 30 天完成每日一灯', 500, () => P.daily.total >= 30),
  A('daily_3star', '每日一灯', '一夜三星', '在每日一灯里拿到三星', 60, (c) => c.end?.won && c.level === DAILY && c.end.stars >= 3),

  // —— 灯坊珍藏 ——
  A('skin_1', '灯坊珍藏', '新灯初换', '在灯坊买下第一件商品', 20, boughtAny),
  A('skin_all', '灯坊珍藏', '灯坊常客', '买齐灯坊里所有的灯', 300, () => buyable.every((s) => P.skins.includes(s.id))),
  A('plush_first', '灯坊珍藏', '萌宠初遇', '在灯坊买下第一款毛绒萌宠珠', 40, () => buyablePlush.some((s) => P.balls.includes(s.id))),
  A('plush_all', '灯坊珍藏', '猫狗双全', '买齐灯坊里所有毛绒萌宠珠（奖励：招财猫）', 260, () => buyablePlush.every((s) => P.balls.includes(s.id))),
  A('cat_night', '灯坊珍藏', '撸猫消珠', '换上毛绒萌宠珠过关一次，或在无尽坚持到第三重', 60, (c) => plushIds.includes(P.ball) && (won(c) || (c.level === -1 && c.run.stage >= 3))),
  A('ball_all', '灯坊珍藏', '珠玉满堂', '买齐灯坊里所有可购买的珠子', 350, () => buyableBalls.every((s) => P.balls.includes(s.id))),
  A('scene_first', '灯坊珍藏', '另辟夜境', '在灯坊买下第一个无尽场景', 40, () => buyableScenes.some((s) => P.scenes.includes(s.id))),
  A('scene_all', '灯坊珍藏', '夜游百景', '买齐灯坊里所有可购买的无尽场景', 350, () => buyableScenes.every((s) => P.scenes.includes(s.id))),
  A('collector', '灯坊珍藏', '琳琅满目', '买齐灯坊里所有的商品', 800, () => allBuyable().every(([sh, x]) => P[sh.own].includes(x.id))),
  A('revive_win', '灯坊珍藏', '死灰复燃', '用灯油续燃之后仍然过关', 60, (c) => c.end?.won && (c.run.revives || 0) > 0),
  A('coins_5k', '灯坊珍藏', '腰缠万贯', '累计获得 5,000 灯币', 100, () => P.life.coinsEarned >= 5000),
  A('chal_30', '灯坊珍藏', '有求必应', '累计完成 30 项关卡挑战', 150, () => chalDone() >= 30),
  A('chal_all', '灯坊珍藏', '十全十美', '完成所有关卡挑战', 500, () => chalDone() >= LEVELS.length * 3),

  // —— 隐藏 ——
  A('fast_lose', '奇闻轶事', '出师未捷', '开局 20 秒内就输了', 20, (c) => c.end && !c.end.won && c.level >= 0 && c.end.time < 20, true),
  A('miss_10', '奇闻轶事', '天女散花', '一局里 10 发打空', 20, (c) => c.run.misses >= 10, true),
  A('lose_10', '奇闻轶事', '屡败屡战', '累计失败 10 次', 40, (c) => c.sum('losses') >= 10, true),
  A('swap_50', '奇闻轶事', '犹豫不决', '一局里交换 50 次珠子', 20, (c) => c.run.swaps >= 50, true),
  A('night_owl', '奇闻轶事', '夜游神', '在凌晨 0 点到 5 点之间过关', 50, (c) => won(c) && new Date().getHours() < 5, true),
];
const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ================= 每关挑战 =================
// 每关三项：一项连锁、一项技巧（轮换）、一项限制（轮换）。全部在过关时判定
const C = (text, test, prog) => ({ text, test, prog });
function challengesFor(i) {
  const lv = LEVELS[i];
  if (lv.boss) {
    return [
      C('直击年兽宝珠 8 次', (r) => r.gemHits >= 8, (r) => `${Math.min(r.gemHits, 8)}/8`),
      C('120 秒内击退年兽', (r, e) => e.time < 120),
      C('一次都不交换珠子', (r) => r.swaps === 0, (r) => (r.swaps ? '已破' : '尚守')),
    ];
  }
  const chain = i < 3 ? 3 : i < 10 ? 4 : 5;
  const skill = [
    () => { const n = 5 + Math.floor(i / 3); return C(`连击达到 ${n}`, (r) => r.bestCombo >= n, (r) => `${Math.min(r.bestCombo, n)}/${n}`); },
    () => { const n = 7 + Math.floor(i / 4); return C(`一次消除 ${n} 颗珠子`, (r) => r.bestBurst >= n, (r) => `${Math.min(r.bestBurst, n)}/${n}`); },
    () => { const n = i < 8 ? 2 : 3; return C(`触发 ${n} 次燎原`, (r) => r.fevers >= n, (r) => `${Math.min(r.fevers, n)}/${n}`); },
    () => { const n = lv.tracks ? 2 : 1; return C(n > 1 ? '打空珠串 2 次' : '把珠串打空一次', (r) => r.clears >= n, (r) => `${Math.min(r.clears, n)}/${n}`); },
  ][i % 4]();
  const limit = [
    () => C('不触发任何道具', (r) => r.powerCount === 0, (r) => (r.powerCount ? '已破' : '尚守')),
    () => { const k = i < 8 ? 0.6 : 0.7; return C(`珠串不越过轨道的${k === 0.6 ? '六' : '七'}成`, (r) => r.maxLead < k); },
    () => C('一次都不交换珠子', (r) => r.swaps === 0, (r) => (r.swaps ? '已破' : '尚守')),
    () => C('空发不超过 2 次', (r) => r.misses <= 2, (r) => `空发 ${r.misses}`),
    () => C('不靠「化险为夷」过关', (r) => r.closeCalls === 0, (r) => (r.closeCalls ? '已破' : '尚守')),
  ][(i * 2 + 1) % 5]();
  return [
    C(`打出一次 ×${chain} 连锁`, (r) => r.bestChain >= chain, (r) => `×${r.bestChain || 0}/×${chain}`),
    skill,
    limit,
  ];
}
export const CHALLENGES = LEVELS.map((_, i) => challengesFor(i));
const chalDone = () => Object.values(P.chal).reduce((a, v) => a + v.filter(Boolean).length, 0);
export const chalState = (i) => P.chal[i] || [false, false, false];

// ================= 对外接口 =================
export const meta = {
  P,
  get coins() { return P.coins; },
  hasAch: (id) => !!P.ach[id],
  achCount: () => Object.keys(P.ach).length,
  chalDone,

  ctx(level, run, end = null, score = 0) {
    return { level, run, end, score, perks: this.perksNow?.(), sum: (k) => (P.life[k] || 0) + (run[k] || 0) };
  },

  // 检查未解锁的成就，返回新解锁列表（已发放灯币与外观）
  check(c) {
    let dirty = false;
    if (c.level === -1 && c.run?.stage >= 5 && c.run?.scene && !P.endlessSeen.includes(c.run.scene)) {
      P.endlessSeen.push(c.run.scene);
      dirty = true;
    }
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (P.ach[a.id]) continue;
      let ok = false;
      try { ok = !!a.test(c); } catch { ok = false; }
      if (!ok) continue;
      P.ach[a.id] = Date.now();
      P.coins += a.coin;
      P.life.coinsEarned += a.coin;
      let reward = null;
      for (const sh of Object.values(SHELVES)) {
        const item = sh.list.find((s) => s.ach === a.id);
        if (item) {
          if (!P[sh.own].includes(item.id)) P[sh.own].push(item.id);
          reward = item;
        }
      }
      got.push({ ...a, skin: reward });
    }
    if (got.length || dirty) save();
    return got;
  },

  // 局中事件
  onEvent(level, run, score) {
    return this.check(this.ctx(level, run, null, score));
  },

  // 一局结束：结算挑战、灯币、生涯统计，返回结算界面要展示的内容
  finish(level, run, end) {
    const res = { coins: 0, chal: [], unlocked: [], parts: [] };
    if (level >= 0 && end.won) {
      const prev = chalState(level);
      const now = CHALLENGES[level].map((ch, k) => {
        const done = !run.revives && !!ch.test(run, end);
        return { text: ch.text, done: done || prev[k], isNew: done && !prev[k] };
      });
      P.chal[level] = now.map((x) => x.done);
      res.chal = now;
      res.revived = run.revives || 0;
      const nNew = now.filter((x) => x.isNew).length;
      if (nNew) res.parts.push(['挑战', nNew * 40]);
    } else if (level >= 0) {
      res.chal = CHALLENGES[level].map((ch, k) => ({ text: ch.text, done: chalState(level)[k], isNew: false }));
    }
    if (level === DAILY) this.finishDaily(end, res, run);
    // 灯币：分数 + 星数（过关）或少量安慰（失败）；无尽模式按重数
    if (level === -1) res.parts.unshift(['长夜', Math.round(end.score / 250) + (run.stage - 1) * 10]);
    else if (end.won) res.parts.unshift(['过关', Math.round(end.score / 200) + end.stars * 15]);
    else res.parts.unshift(['辛苦', Math.round(end.score / 500)]);
    res.coins = res.parts.reduce((a, p) => a + p[1], 0);

    const c = this.ctx(level, run, { ...end, level }, end.score);
    res.unlocked = this.check(c);
    // 并入生涯统计
    const L = P.life;
    L.plays++;
    if (level >= 0) end.won ? L.wins++ : L.losses++;
    for (const k of ['removed', 'matches', 'fevers', 'clears', 'shots', 'gemHits']) L[k] += run[k] || 0;
    L.playTime += end.time || 0;
    for (const [t, n] of Object.entries(run.powers)) L.powers[t] = (L.powers[t] || 0) + n;
    P.coins += res.coins;
    L.coinsEarned += res.coins;
    // 灯币到账后可能解锁「腰缠万贯」；挑战写入后可能解锁「有求必应」
    res.unlocked.push(...this.check(this.ctx(level, {}, { ...end, level }, end.score)));
    save();
    return res;
  },

  // 今天的每日一灯状态（跨天自动重置）
  daily() {
    const d = P.daily, today = dayKey();
    if (d.day !== today) {
      d.day = today; d.best = 0; d.done = false;
      // 断了一天以上，连续天数归零（显示用；真正累加在完成时）
      if (d.lastDone && d.lastDone !== prevDayKey(today)) d.streak = 0;
      save();
    }
    return d;
  },

  finishDaily(end, res, run = {}) {
    const d = this.daily();
    if (!run.revives) d.best = Math.max(d.best, end.score);
    res.dailyBest = d.best;
    if (end.won && !d.done) {
      d.done = true;
      d.streak = d.lastDone === prevDayKey(d.day) ? d.streak + 1 : 1;
      d.lastDone = d.day;
      d.total++;
      res.dailyFirst = true;
      res.parts.push(['每日首胜', 100 + Math.min(d.streak, 7) * 20]);
    }
    res.streak = d.streak;
  },

  buy(kind, id) {
    const sh = SHELVES[kind];
    const s = sh?.list.find((x) => x.id === id);
    if (!s || s.ach || P[sh.own].includes(id) || P.coins < s.price) return null;
    P.coins -= s.price;
    P[sh.own].push(id);
    P[sh.use] = id;
    save();
    return this.check(this.ctx(0, { powers: {} }));
  },
  equip(kind, id) {
    const sh = SHELVES[kind];
    if (!sh || !P[sh.own].includes(id)) return false;
    P[sh.use] = id;
    save();
    return true;
  },
  // 续燃：扣灯币，成功返回 true
  spend(n) {
    if (P.coins < n) return false;
    P.coins -= n;
    save();
    return true;
  },
  skin: () => SKINS.find((s) => s.id === P.skin) || SKINS[0],
  scene: () => ENDLESS_SCENES.find((s) => s.id === P.scene) || ENDLESS_SCENES[0],
  ach: (id) => ACH[id],
};
