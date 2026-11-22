import { buildTextures } from './textures.js';
import { Game } from './game.js';
import { LEVELS, ENDLESS } from './levels.js';
import { sfx } from './audio.js';
import { loadCfg } from './config.js';
import { initDevPanel } from './devpanel.js';
import { COLORS, RAINBOW, SKINS, SKIN_CANVAS, BALL_CANVAS, TRAIL_CANVAS } from './textures.js';
import { store, meta, ACHIEVEMENTS, CHALLENGES, chalState, SHELVES, REVIVE_COST } from './meta.js';
import { TAL, COMBO_TIERS } from './perks.js';
import { DAILY, dailyLevel, prevDayKey } from './daily.js';
import { drawShareCard, SHARE_URL } from './share.js';

const $ = (id) => document.getElementById(id);
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
const lvLabel = (i) => (i === DAILY ? '每日一灯' : i < 0 ? '无尽模式' : `第${CN[i] || i + 1}关`);
const lvName = (i) => (i === DAILY ? dailyLevel().name : i < 0 ? ENDLESS.name : LEVELS[i].name);
const stageLabel = (n) => `第${CN[n - 1] || n}重`;
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;


loadCfg();

// 等本地字体加载完再显示首页，避免画布上的特效字先用系统字体渲染（最多等 2.5 秒）
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('48px "Ma Shan Zheng"', '萤灯连珠夜游连锁连击过关灯火燎原将熄炸裂雷光缓行倒流彩珠余光暂停继续重新开始下一关再来一次选择关卡熄灭第一二三四五六七八九十'),
    document.fonts.load('16px "ZCOOL XiaoWei"', '一夜灯会十二盏连珠成火最高分移动鼠标瞄准左键发射右键空格交换拖动松手轻点灵消除断口同色回吸道具'),
    document.fonts.load('800 30px "Cinzel"', '0123456789,+×'),
  ]),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => {});

const app = new PIXI.Application({
  resizeTo: window,
  antialias: true,
  backgroundColor: 0x070818,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});
$('stage').appendChild(app.view);
buildTextures();

const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
let hintTimer = 0;

// 触屏交换按钮里的两颗珠：用 CSS 渐变画出与游戏内一致的配色
const orbBg = (c) => {
  if (c === RAINBOW) return 'conic-gradient(from 30deg, #ff4b5c, #ffc531, #35dc8a, #36b3ff, #c25cf5, #ff4b5c)';
  const k = COLORS[c] || COLORS[0];
  return `radial-gradient(circle at 36% 30%, ${k.light} 0 12%, ${k.hex} 48%, ${k.dark} 100%)`;
};

// ---------- 分数滚动 ----------
const scoreAnim = { shown: 0, target: 0 };
function tickScore() {
  const a = scoreAnim;
  if (a.shown !== a.target) {
    const d = a.target - a.shown;
    a.shown += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * 0.18));
    if ((d > 0 && a.shown > a.target) || (d < 0 && a.shown < a.target)) a.shown = a.target;
    $('score').textContent = a.shown.toLocaleString();
  }
  requestAnimationFrame(tickScore);
}
requestAnimationFrame(tickScore);

const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
const GOLD_DEFS = '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#ffc23d"/><stop offset="1" stop-color="#d9831c"/></linearGradient></defs></svg>';

const ui = {
  setLevel(i) {
    $('lvNo').textContent = i === DAILY ? '每日' : i < 0 ? '无尽' : lvLabel(i);
    $('lvName').textContent = i === DAILY ? lvName(i) : i < 0 ? stageLabel(1) : LEVELS[i].name;
  },
  setStage(n) { $('lvName').textContent = stageLabel(n); },
  // 首领血条：name 为 null 时隐藏
  setBoss(name, ratio = 1) {
    const bar = $('bossBar');
    document.body.classList.toggle('boss', !!name);
    if (!name) { bar.classList.add('hidden'); return; }
    $('bossName').textContent = name;
    bar.classList.remove('hidden', 'enraged');
    const hp = $('bossHp'), lag = $('bossLag');
    hp.style.transition = lag.style.transition = 'none';
    hp.style.width = lag.style.width = ratio * 100 + '%';
    void hp.offsetWidth;
    hp.style.transition = lag.style.transition = '';
  },
  setBossHp(ratio) {
    const w = Math.max(0, ratio) * 100 + '%';
    $('bossHp').style.width = w;
    $('bossLag').style.width = w;
    $('bossBar').classList.toggle('enraged', ratio <= 0.5);
  },
  setScore(n, instant = false) {
    const el = $('score');
    if (instant) { scoreAnim.shown = n; el.textContent = n.toLocaleString(); }
    else if (n > scoreAnim.target) {
      el.classList.add('bump');
      clearTimeout(this._bumpT);
      this._bumpT = setTimeout(() => el.classList.remove('bump'), 120);
    }
    scoreAnim.target = n;
  },
  _prog: -1,
  setProgress(p) {
    p = Math.min(1, p);
    if (Math.abs(p - this._prog) < 0.002) return;
    this._prog = p;
    const w = (p * 100).toFixed(1) + '%';
    $('bar').style.width = w;
    $('bead').style.left = w;
  },
  _ammo: '',
  setAmmo(cur, next) {
    const key = cur + '|' + next;
    if (key === this._ammo) return;
    const swapped = this._ammo === next + '|' + cur;
    this._ammo = key;
    $('ammoCur').style.background = orbBg(cur);
    $('ammoNext').style.background = orbBg(next);
    $('ammoCur').style.setProperty('--glow', (COLORS[cur] || COLORS[0]).hex);
    const a = $('ammo');
    a.classList.remove('flip', 'feed');
    void a.offsetWidth;
    a.classList.add(swapped ? 'flip' : 'feed');
  },
  setDanger(d) { $('vignette').style.opacity = d.toFixed(3); },
  _fev: -1,
  setFever(v, active) {
    v = Math.min(1, v);
    if (Math.abs(v - this._fev) < 0.004) return;
    this._fev = v;
    $('feverBar').style.width = (v * 100).toFixed(1) + '%';
    $('feverBox').classList.toggle('ready', !active && v > 0.85);
  },
  setFeverMode(on) { document.body.classList.toggle('fever', on); },
  flash(color) {
    const f = $('flash');
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = '1';
    void f.offsetWidth;
    f.style.transition = 'opacity .5s ease-out';
    f.style.opacity = '0';
  },
  hud(show) {
    $('hud').classList.toggle('hidden', !show);
    $('ammo').classList.toggle('hidden', !show || !isTouch);
    if (!show) { this.setEffects(0, 0); this.setFeverMode(false); this.setBoss(null); this.setCombo(0, -1); }
  },
  _fxKey: '',
  setEffects(slowT, reverseT) {
    const key = Math.ceil(slowT) + '|' + Math.ceil(reverseT);
    if (key === this._fxKey) return;
    this._fxKey = key;
    const chip = (name, c, t) => `<div class="fx-chip" style="--c:${c}"><i></i>${name} ${Math.ceil(t)}s</div>`;
    $('effects').innerHTML =
      (slowT > 0 ? chip('缓行', '#6fd3ff', slowT) : '') +
      (reverseT > 0 ? chip('倒流', '#c39bff', reverseT) : '');
  },
  // 连击段位徽章：c<3 隐藏；broke 为 true 时播放"断"的动画
  setCombo(c, tier, broke = false) {
    const el = $('combo');
    if (c < 3) {
      if (broke && !el.classList.contains('hidden')) {
        el.classList.remove('bump');
        el.classList.add('break');
        clearTimeout(this._comboT);
        this._comboT = setTimeout(() => { el.classList.add('hidden'); el.classList.remove('break'); }, 600);
      } else if (!broke) { el.classList.add('hidden'); el.classList.remove('break'); }
      return;
    }
    clearTimeout(this._comboT);
    const T = COMBO_TIERS[tier];
    el.classList.remove('hidden', 'break', 'bump');
    el.style.setProperty('--c', T.color);
    el.dataset.tier = tier;
    el.querySelector('.rk').textContent = T.name;
    el.querySelector('.cn i').textContent = c;
    el.querySelector('.mul').textContent = '×' + T.mul;
    void el.offsetWidth;
    el.classList.add('bump');
  },

  // 无尽模式：三选一灯符
  showChoice(list, perks, stage) {
    const cards = list.map((t, k) => {
      const lv = t.once ? 0 : (perks[t.id] || 0) + 1;
      return `<button class="talisman ${t.rare ? 'rare' : ''}" data-act="perk" data-perk="${t.id}" style="--i:${k}">
        <span class="tl-ch">${t.ch}</span>
        <span class="tl-name">${t.name}</span>
        <span class="tl-lv">${t.once ? '一次性' : `第${'壹贰叁肆伍'[lv - 1]}层${t.max ? ` / ${'壹贰叁肆伍'[t.max - 1]}` : ''}`}</span>
        <span class="tl-desc">${t.desc(lv || 1)}</span>
        ${isTouch ? '' : `<kbd>${k + 1}</kbd>`}
      </button>`;
    }).join('');
    this.show(`
      <div class="choose">
        <div class="ch-head"><span class="ch-stage">${stageLabel(stage)}</span><h2>择一道灵符</h2><p>灵符效果可以叠加，整局有效</p></div>
        <div class="tl-row">${cards}</div>
        ${perkStrip(perks)}
      </div>`);
  },

  hint(text, ms = 5000) {
    const h = $('hint');
    h.textContent = text;
    h.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.remove('show'), ms);
  },
  show(html, dim = true) {
    $('screen').innerHTML = html;
    const o = $('overlay');
    o.classList.toggle('dim', dim);
    o.classList.remove('hidden');
    o.scrollTop = 0;
  },
  close() { $('overlay').classList.add('hidden'); },

  scroll(inner) {
    return `${GOLD_DEFS}<div class="scroll"><div class="rod"></div><div class="paper">${inner}</div><div class="rod"></div></div>`;
  },

  showPause() {
    const i = game.levelIndex;
    const st = i >= 0 ? chalState(i) : null;
    const chal = i >= 0 ? chalList(CHALLENGES[i].map((ch, k) => ({
      text: ch.text, done: st[k], prog: ch.prog?.(game.run),
    })), '本关挑战') : '';
    this.show(this.scroll(`
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">${lvName(i)}</h2>
      <div class="s-sub">暂歇片刻，灯火未熄</div>
      ${chal}
      ${i < 0 ? perkList(game.perks) : ''}
      <div class="actions">
        <button class="btn-red" data-act="resume">继续</button>
        <div class="btn-row">
          <button class="btn-ink" data-act="retry">重新开始</button>
          <button class="btn-ink" data-act="menu">选择关卡</button>
        </div>
      </div>`));
  },

  onWin(i, score, stars, stats) {
    if (i === DAILY) { this.onDaily(true, score, stars, stats); return; }
    const prevBest = store.get('best' + i, 0);
    const best = Math.max(score, prevBest);
    store.set('best' + i, best);
    store.set('stars' + i, Math.max(stars, store.get('stars' + i, 0)));
    store.set('unlocked', Math.max(store.get('unlocked', 0), Math.min(i + 1, LEVELS.length - 1)));
    const last = i === LEVELS.length - 1;
    const isNew = score > prevBest && prevBest > 0;
    const res = meta.finish(i, game.run, { won: true, score, stars, time: Math.round(game.levelTime) });
    this.show(this.scroll(`
      <div class="stamp">${last ? '圆满' : '过关'}</div>
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">${LEVELS[i].name}</h2>
      <div class="stars-row">${STAR}${STAR}${STAR}</div>
      <div class="s-score" id="resScore">0</div>
      <div class="s-stats">${stats.time != null ? `用时 <b>${stats.time} 秒</b> · ` : ''}最高连锁 <b>×${stats.bestChain || 1}</b> · 最高分 <b>${best.toLocaleString()}</b>${isNew ? ' · <b>新纪录</b>' : ''}</div>
      ${chalList(res.chal, '本关挑战', 1500)}
      ${res.revived ? `<div class="revive-note ink">本局续燃 ${res.revived} 次，挑战不计入</div>` : ''}
      ${coinLine(res)}
      <div class="actions">
        ${last ? '' : '<button class="btn-red" data-act="next">下一关</button>'}
        <div class="btn-row">
          <button class="btn-ink" data-act="retry">再来一次</button>
          <button class="btn-ink" data-act="share">晒战绩</button>
          <button class="btn-ink" data-act="menu">选择关卡</button>
        </div>
      </div>`));
    this.lastShare = {
      kind: lvLabel(i), title: LEVELS[i].name, score, stars,
      lines: [['最高连锁', `×${stats.bestChain || 1}`], ['最高连击', game.run.bestCombo]],
      badge: comboBadge(),
    };
    const svgs = $('screen').querySelectorAll('.stars-row svg');
    for (let k = 0; k < stars; k++) {
      setTimeout(() => { svgs[k]?.classList.add('on'); sfx.star(k); }, 650 + k * 300);
    }
    countUp($('resScore'), score, 900, 500);
    afterResult(res);
  },

  onLose(i, score, stats) {
    if (i === DAILY) { this.onDaily(false, score, 0, stats); return; }
    if (i < 0) { this.onEndless(score, stats); return; }
    const res = meta.finish(i, game.run, { won: false, score, stars: 0, time: Math.round(game.levelTime) });
    this.show(this.scroll(`
      <div class="stamp grey">熄</div>
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">灯火熄灭</h2>
      <div class="s-sub">珠串落入了古井</div>
      <div class="s-score" id="resScore">0</div>
      ${coinLine(res)}
      <div class="actions">
        <button class="btn-red" data-act="retry">再试一次</button>
        <button class="btn-ink" data-act="menu">选择关卡</button>
      </div>`));
    countUp($('resScore'), score, 700, 400);
    afterResult(res);
  },

  // 无尽模式结算：没有失败，只有纪录
  onEndless(score, st) {
    const prev = store.get('endlessBest', 0);
    const isNew = score > prev;
    if (isNew) store.set('endlessBest', score);
    store.set('endlessStage', Math.max(st.stage, store.get('endlessStage', 0)));
    store.set('endlessTime', Math.max(st.time, store.get('endlessTime', 0)));
    const res = meta.finish(-1, game.run, { won: false, score, stars: 0, time: st.time });
    this.show(this.scroll(`
      <div class="stamp">${isNew && prev > 0 ? '新纪录' : '尽兴'}</div>
      <div class="s-level">无尽模式</div>
      <h2 class="s-title">坚持到${stageLabel(st.stage)}</h2>
      <div class="s-score" id="resScore">0</div>
      <div class="s-stats">坚持 <b>${fmtTime(st.time)}</b> · 最高连锁 <b>×${st.bestChain || 1}</b> · 最高分 <b>${Math.max(score, prev).toLocaleString()}</b></div>
      ${perkList(st.perks)}
      ${coinLine(res)}
      <div class="actions">
        <button class="btn-red" data-act="retry">再战一夜</button>
        <div class="btn-row">
          <button class="btn-ink" data-act="share">晒战绩</button>
          <button class="btn-ink" data-act="menu">返回首页</button>
        </div>
      </div>`));
    this.lastShare = {
      kind: '无尽模式', title: `坚持到${stageLabel(st.stage)}`, score, stars: null,
      lines: [['坚持', fmtTime(st.time)], ['灵符', `${Object.values(st.perks || {}).reduce((a, b) => a + b, 0)} 道`]],
      badge: comboBadge(),
    };
    if (isNew) setTimeout(() => sfx.star(2), 700);
    countUp($('resScore'), score, 900, 400);
    afterResult(res);
  },

  // 每日一灯结算：过关有星，首胜发奖励并累计连续天数
  onDaily(won, score, stars, stats) {
    const lv = game.lv;
    const res = meta.finish(DAILY, game.run, { won, score, stars, time: Math.round(game.levelTime) });
    this.show(this.scroll(`
      <div class="stamp ${won ? '' : 'grey'}">${won ? (res.dailyFirst ? '点亮' : '再燃') : '熄'}</div>
      <div class="s-level">每日一灯 · ${lv.rule.name}</div>
      <h2 class="s-title">${won ? lv.baseName : '灯火熄灭'}</h2>
      <div class="s-sub">${lv.rule.desc}</div>
      ${won ? `<div class="stars-row">${STAR}${STAR}${STAR}</div>` : ''}
      <div class="s-score" id="resScore">0</div>
      <div class="s-stats">今日最高 <b>${res.dailyBest.toLocaleString()}</b> · 连续 <b>${res.streak} 夜</b>${res.dailyFirst ? ' · <b>今夜首胜</b>' : ''}</div>
      ${streakRow(res.streak, res.dailyFirst)}
      ${coinLine(res)}
      <div class="actions">
        <button class="btn-red" data-act="retry">${won ? '再刷一次' : '再试一次'}</button>
        <div class="btn-row">
          ${won ? '<button class="btn-ink" data-act="share">晒战绩</button>' : ''}
          <button class="btn-ink" data-act="menu">返回首页</button>
        </div>
      </div>`));
    this.lastShare = {
      kind: `每日一灯 · ${new Date().getMonth() + 1}月${new Date().getDate()}日`, title: lv.name, score, stars,
      lines: [['连续', `${res.streak} 夜`], ['最高连锁', `×${stats.bestChain || 1}`]],
      badge: comboBadge(),
    };
    const svgs = $('screen').querySelectorAll('.stars-row svg');
    for (let k = 0; k < stars; k++) setTimeout(() => { svgs[k]?.classList.add('on'); sfx.star(k); }, 650 + k * 300);
    countUp($('resScore'), score, 900, 500);
    afterResult(res);
  },

  showMenu() {
    const unlocked = store.get('unlocked', 0);
    let total = 0;
    const perRow = window.innerWidth < 600 ? 4 : 6;
    const cells = LEVELS.map((l, i) => {
      const st = store.get('stars' + i, 0);
      total += st;
      const locked = i > unlocked;
      const starsHtml = [0, 1, 2].map((k) => (k < st ? '<b>★</b>' : '★')).join('');
      return `<button class="lantern ${i === unlocked ? 'current' : ''} ${l.boss ? 'boss' : ''}" data-act="play" data-lv="${i}" ${locked ? 'disabled' : ''} aria-label="${lvLabel(i)} ${l.name}">
        <div class="cap"></div>
        <div class="body">${locked ? LOCK : CN[i] || i + 1}${l.boss ? '<span class="twin">兽</span>' : l.tracks ? '<span class="twin">双</span>' : ''}</div>
        <div class="cap b"></div>
        <div class="tassel"></div>
        <div class="name">${l.name}</div>
        <div class="stars">${locked ? '&nbsp;' : starsHtml}</div>
        <div class="chal-dots">${locked ? '' : chalState(i).map((d) => `<i class="${d ? 'on' : ''}"></i>`).join('')}</div>
      </button>`;
    });
    const rows = [];
    for (let k = 0; k < cells.length; k += perRow) rows.push(`<div class="row">${cells.slice(k, k + perRow).join('')}</div>`);
    const how = isTouch
      ? '拖动瞄准 · 松手发射 · 点下方珠盘交换'
      : '移动鼠标瞄准 · <kbd>左键</kbd>发射 · <kbd>右键</kbd>/<kbd>空格</kbd>交换';
    this.show(`
      <div class="title-screen">
        <div class="brand"><h1 class="logo">萤灯连珠</h1><span class="seal">夜游</span></div>
        <p class="tagline">一夜灯会 · 连珠成火</p>
        ${festivalHtml(total)}
        <div class="lantern-map">${rows.join('')}</div>
        ${dailyHtml()}
        <button class="endless-btn" data-act="play" data-lv="-1">
          <span class="e-title">无尽模式</span>
          <span class="e-sub">${store.get('endlessBest', 0) ? `最高分 <b>${store.get('endlessBest', 0).toLocaleString()}</b> · 最远${stageLabel(store.get('endlessStage', 1))}` : '珠串永不停歇，看你能坚持多久'}</span>
        </button>
        <div class="menu-tabs">
          <button class="tab-btn" data-act="codex">
            <span class="t-seal">谱</span>
            <span class="t-txt"><b>灯谱</b><small>成就 ${meta.achCount()} / ${ACHIEVEMENTS.length}</small></span>
            ${newAch() ? `<em class="dot">${newAch()}</em>` : ''}
          </button>
          <button class="tab-btn" data-act="shop">
            <span class="t-seal gold">坊</span>
            <span class="t-txt"><b>灯坊</b><small>${COIN}<span class="num">${meta.coins.toLocaleString()}</span></small></span>
            ${affordable() ? '<em class="dot">!</em>' : ''}
          </button>
        </div>
        <div class="meta">
          <span class="total">★ <b>${total}</b> / ${LEVELS.length * 3}</span>
          <span class="total">挑战 <b>${meta.chalDone()}</b> / ${LEVELS.length * 3}</span>
          <span class="howto">${how}<br>三珠同色即消 · 断口同色回吸成连锁 · 攒满「燎原」大爆发</span>
        </div>
        <div class="credits">
          <a class="credit more" href="https://hbycrj.com/games/">更多游戏 →</a>
          <a class="credit" href="https://hbycrj.com" target="_blank" rel="noopener">清河县翼程软件开发 · <b>hbycrj.com</b></a>
        </div>
      </div>`, false);
    this.menuOpen = true;
    this.page = 'menu';
    animateFestival();
  },

  // —— 灯谱：成就图鉴 + 灯会志 ——
  showCodex() {
    meta.P.seen = meta.achCount();
    store.set('profile', meta.P);
    const L = meta.P.life;
    const cats = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
    const secs = cats.map((cat) => {
      const list = ACHIEVEMENTS.filter((a) => a.cat === cat);
      const got = list.filter((a) => meta.hasAch(a.id)).length;
      const cards = list.map((a) => {
        const on = meta.hasAch(a.id);
        const hide = a.hidden && !on;
        return `<div class="ach ${on ? 'on' : ''}">
          ${sealHtml(hide ? '？？' : a.name, on)}
          <div class="a-name">${hide ? '？？？' : a.name}</div>
          <div class="a-desc">${hide ? '隐藏成就，达成后揭晓' : a.desc}</div>
          <div class="a-coin">${COIN}${a.coin}</div>
        </div>`;
      }).join('');
      return `<section><h3>${cat}<span>${got} / ${list.length}</span></h3><div class="ach-grid">${cards}</div></section>`;
    }).join('');
    const stat = (k, v) => `<div><b>${v}</b><span>${k}</span></div>`;
    this.show(`
      <div class="book">
        <header class="book-head">
          <button class="back" data-act="home" aria-label="返回">‹</button>
          <h2>灯谱</h2>
          <span class="seal-mini">${meta.achCount()} / ${ACHIEVEMENTS.length}</span>
        </header>
        <div class="journal">
          ${stat('过关', L.wins.toLocaleString())}
          ${stat('消除珠子', L.removed.toLocaleString())}
          ${stat('燎原', L.fevers.toLocaleString())}
          ${stat('完成挑战', meta.chalDone())}
          ${stat('游玩时长', fmtHours(L.playTime))}
          ${stat('累计灯币', L.coinsEarned.toLocaleString())}
        </div>
        ${secs}
      </div>`, false);
    this.menuOpen = false;
    this.page = 'codex';
  },

  // —— 灯坊：灯灵 / 珠子 / 拖尾 三个货架 ——
  shopTab: 'lantern',
  showShop(tab = this.shopTab) {
    this.shopTab = tab;
    const P = meta.P;
    const sh = SHELVES[tab];
    const pic = (s) => {
      if (tab === 'lantern') return `<img src="${imgUrl('l-' + s.id, SKIN_CANVAS[s.id])}" alt="${s.name}">`;
      if (tab === 'ball') return `<span class="ball-row">${[0, 1, 2, 3].map((k) => `<img src="${imgUrl(`b-${s.id}-${k}`, BALL_CANVAS[s.id][k])}" alt="">`).join('')}</span>`;
      return `<img class="trail-pic" src="${imgUrl('t-' + s.id, TRAIL_CANVAS[s.id])}" alt="${s.name}">`;
    };
    const cards = sh.list.map((s) => {
      const own = P[sh.own].includes(s.id);
      const on = P[sh.use] === s.id;
      let btn;
      if (on) btn = '<button class="sk-btn on" disabled>使用中</button>';
      else if (own) btn = `<button class="sk-btn" data-act="equip" data-kind="${tab}" data-skin="${s.id}">换上</button>`;
      else if (s.ach) btn = `<button class="sk-btn lock" disabled>成就「${meta.ach(s.ach).name}」解锁</button>`;
      else btn = `<button class="sk-btn buy" data-act="buy" data-kind="${tab}" data-skin="${s.id}" ${P.coins < s.price ? 'disabled' : ''}>${COIN}${s.price.toLocaleString()}</button>`;
      const halo = s.halo != null ? `#${s.halo.toString(16).padStart(6, '0')}` : '#ffd27a';
      return `<div class="skin kind-${tab} ${on ? 'on' : ''} ${own ? 'own' : ''}" style="--halo:${halo}">
        <div class="sk-pic">${pic(s)}</div>
        <div class="sk-name">${s.name}</div>
        <div class="sk-desc">${s.desc}</div>
        ${btn}
      </div>`;
    }).join('');
    const tabs = Object.entries(SHELVES).map(([k, v]) => {
      const n = v.list.filter((x) => P[v.own].includes(x.id)).length;
      return `<button class="shop-tab ${k === tab ? 'on' : ''}" data-act="shoptab" data-tab="${k}">${v.name}<small>${n}/${v.list.length}</small></button>`;
    }).join('');
    this.show(`
      <div class="book">
        <header class="book-head">
          <button class="back" data-act="home" aria-label="返回">‹</button>
          <h2>灯坊</h2>
          <span class="wallet">${COIN}<b>${P.coins.toLocaleString()}</b></span>
        </header>
        <div class="shop-tabs">${tabs}</div>
        <p class="book-sub">过关、完成挑战、达成成就都能得到灯币；珠串进井时还能花灯币「续燃」</p>
        <div class="skin-grid">${cards}</div>
      </div>`, false);
    this.menuOpen = false;
    this.page = 'shop';
  },

  // —— 灯油续燃：珠串进井时询问，倒计时内不选就算放弃 ——
  offerRevive(n) {
    if (n >= REVIVE_COST.length) return false;
    const cost = REVIVE_COST[n];
    const can = meta.coins >= cost;
    this.show(this.scroll(`
      <div class="s-level">珠串已到井口</div>
      <h2 class="s-title">灯火将熄</h2>
      <div class="s-sub">添一勺灯油：烧掉井口附近的珠子，珠串倒流</div>
      <div class="revive-timer"><i id="reviveBar"></i></div>
      <div class="actions">
        <button class="btn-red" data-act="revive" ${can ? '' : 'disabled'}>续燃 · ${COIN}${cost}</button>
        <button class="btn-ink" data-act="giveup">任其熄灭</button>
      </div>
      <div class="revive-note">${can ? `余 ${COIN}${meta.coins.toLocaleString()} · 本局第 ${n + 1} / ${REVIVE_COST.length} 次 · 续燃过的一局不计挑战` : `灯币不足（余 ${meta.coins.toLocaleString()}）`}</div>
    `));
    clearTimeout(this._reviveT);
    const bar = $('reviveBar');
    bar.style.animationDuration = '8s';
    this._reviveT = setTimeout(() => { if (game.state === 'revive') game.giveUp(); }, 8000);
    this._reviveCost = cost;
    return true;
  },

  // 局中事件 → 成就检查
  onEvent(ev, run) {
    for (const a of meta.onEvent(game.levelIndex, run, game.score)) toast(a);
  },
};

const COIN = '<i class="coin"></i>';

// —— 灯会点亮：星星 + 挑战 + 成就 折算成一条街的灯笼 ——
const FEST_N = 24;
const FEST_NAMES = ['冷冷清清', '华灯初上', '灯火渐明', '人声鼎沸', '火树银花', '不夜之城'];
let festNew = [0, 0];
function festivalHtml(stars) {
  const pts = stars + meta.chalDone() + meta.achCount();
  const max = LEVELS.length * 6 + ACHIEVEMENTS.length;
  const lit = Math.min(FEST_N, Math.floor((pts / max) * FEST_N + 1e-9));
  const prev = Math.min(meta.P.lit || 0, lit);
  festNew = [prev, lit];
  const name = FEST_NAMES[Math.min(FEST_NAMES.length - 1, Math.floor((lit / FEST_N) * (FEST_NAMES.length - 1) + 1e-9))];
  const lamps = Array.from({ length: FEST_N }, (_, k) => {
    const sag = Math.sin((k / (FEST_N - 1)) * Math.PI) * 14;
    return `<i class="${k < prev ? 'on' : ''}" style="--sag:${sag.toFixed(1)}px;--h:${(k * 37) % 360}"></i>`;
  }).join('');
  return `<div class="festival" title="星星、挑战和成就都会点亮灯会">
    <div class="fest-lamps">${lamps}</div>
    <div class="fest-cap">灯会 · <b>${name}</b> <span>${lit} / ${FEST_N} 盏</span></div>
  </div>`;
}
function animateFestival() {
  const [from, to] = festNew;
  if (to <= from) return;
  const lamps = $('screen').querySelectorAll('.fest-lamps i');
  for (let k = from; k < to; k++) {
    // 一次点亮很多盏（老存档第一次打开）时加快节奏，最多 3 秒放完
    const gap = Math.min(260, 3000 / (to - from));
    setTimeout(() => { lamps[k]?.classList.add('on', 'pop'); if (k - from < 6 || k === to - 1) sfx.star(Math.min(2, k - from)); }, 900 + (k - from) * gap);
  }
  meta.P.lit = to;
  store.set('profile', meta.P);
}

// —— 首页的每日一灯入口 ——
function dailyHtml() {
  const d = meta.daily();
  const lv = dailyLevel();
  const next = d.lastDone === prevDayKey(d.day) ? d.streak + 1 : 1;
  const side = d.done
    ? `<span class="d-st">今夜已点亮</span><span>今日最高 <b>${d.best.toLocaleString()}</b></span>`
    : `<span class="d-st">首胜 ${COIN}<b>+${100 + Math.min(next, 7) * 20}</b></span><span>${d.streak ? `已连续 ${d.streak} 夜` : '每天零点换新'}</span>`;
  return `<button class="daily-btn ${d.done ? 'done' : ''}" data-act="play" data-lv="${DAILY}">
    <span class="d-seal">${d.done ? '已燃' : '今夜'}</span>
    <span class="d-txt"><b>每日一灯</b><span class="d-rule">${lv.rule.name} · ${lv.baseName}</span><small>${lv.rule.desc}</small></span>
    <span class="d-side">${side}</span>
  </button>`;
}

// 七夜连续进度：一排小灯
function streakRow(streak, fresh) {
  const n = Math.min(streak, 7);
  return `<div class="streak">${Array.from({ length: 7 }, (_, k) => `<i class="${k < n ? 'on' : ''} ${fresh && k === n - 1 ? 'new' : ''}">${k + 1}</i>`).join('')}<span>${streak >= 7 ? '七夜灯会 · 奖励封顶' : `连续 7 夜奖励最高`}</span></div>`;
}

function comboBadge() {
  const c = game.run.bestCombo;
  let t = -1;
  COMBO_TIERS.forEach((T, i) => { if (c >= T.n) t = i; });
  return t >= 0 ? `连击段位 · ${COMBO_TIERS[t].name}` : '';
}

// —— 晒战绩 ——
function openShare() {
  const d = ui.lastShare;
  if (!d) return;
  const canvas = drawShareCard({ ...d, skin: meta.P.skin });
  const url = canvas.toDataURL('image/png');
  const box = $('shareBox');
  box.innerHTML = `<div class="share-inner">
    <img src="${url}" alt="战绩卡">
    <p>${isTouch ? '长按图片保存，发给好友一起来玩' : '保存图片，发给好友一起来玩'}</p>
    <div class="share-acts">
      <a class="btn-red" href="${url}" download="萤灯连珠战绩.png">保存图片</a>
      ${navigator.share ? '<button class="btn-gold" data-share="send">分享</button>' : ''}
      <button class="btn-ghost" data-share="close">关闭</button>
    </div>
  </div>`;
  box.classList.add('show');
  box._canvas = canvas;
  sfx.powerAppear();
}
$('shareBox').addEventListener('click', async (e) => {
  const box = $('shareBox');
  const b = e.target.closest('[data-share]');
  if (!b) { if (e.target === box) box.classList.remove('show'); return; }
  if (b.dataset.share === 'close') box.classList.remove('show');
  if (b.dataset.share === 'send') {
    try {
      const blob = await new Promise((r) => box._canvas.toBlob(r, 'image/png'));
      const file = new File([blob], '萤灯连珠战绩.png', { type: 'image/png' });
      const data = { title: '萤灯连珠', text: `我在《萤灯连珠》拿了 ${ui.lastShare.score.toLocaleString()} 分，来比比？`, url: SHARE_URL };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      await navigator.share(data);
    } catch { /* 用户取消分享 */ }
  }
});
const CN_LV = '壹贰叁肆伍';

// 已得灯符：选符界面底部的小印章条
function perkStrip(perks) {
  const ids = Object.keys(perks || {});
  if (!ids.length) return '';
  return `<div class="perk-strip">${ids.map((id) => `<span class="pk" title="${TAL[id].name}">${TAL[id].ch}<sub>${perks[id]}</sub></span>`).join('')}</div>`;
}
// 暂停 / 结算卷轴里的灯符清单
function perkList(perks) {
  const ids = Object.keys(perks || {});
  if (!ids.length) return '';
  return `<div class="perk-list"><div class="chal-t">本局灵符</div><ul>${ids.map((id) => {
    const t = TAL[id], l = perks[id];
    return `<li><b>${t.ch}</b><span>${t.name} · ${CN_LV[l - 1]}层</span><em>${t.desc(l)}</em></li>`;
  }).join('')}</ul></div>`;
}
const fmtHours = (sec) => (sec < 3600 ? `${Math.floor(sec / 60)} 分` : `${(sec / 3600).toFixed(1)} 时`);
const newAch = () => Math.max(0, meta.achCount() - (meta.P.seen || 0));
const affordable = () => Object.values(SHELVES).some((sh) => sh.list.some((s) => !s.ach && !meta.P[sh.own].includes(s.id) && meta.coins >= s.price));
// 预览图只生成一次
const imgCache = {};
const imgUrl = (k, c) => (imgCache[k] ||= c.toDataURL());

// 印章：两到四个字，竖排从右往左
function sealHtml(text, on) {
  const n = [...text].length;
  return `<div class="seal-s n${n} ${on ? 'on' : ''}"><span>${text}</span></div>`;
}

// 挑战列表：delay 有值时新完成的项逐条盖章
function chalList(items, title, delay = 0) {
  if (!items?.length) return '';
  let k = 0;
  const rows = items.map((c) => {
    const d = c.isNew ? delay + (k++) * 280 : 0;
    return `<li class="${c.done ? 'done' : ''} ${c.isNew ? 'new' : ''}" ${c.isNew ? `style="--d:${d}ms"` : ''}>
      <i class="ck"></i><span>${c.text}</span>${c.prog && !c.done ? `<em>${c.prog}</em>` : c.isNew ? '<em class="nw">新达成</em>' : ''}
    </li>`;
  }).join('');
  return `<div class="chal"><div class="chal-t">${title}</div><ul>${rows}</ul></div>`;
}

function coinLine(res) {
  const parts = res.parts.filter((p) => p[1] > 0).map((p) => `${p[0]} +${p[1]}`).join(' · ');
  return `<div class="coin-line">${COIN}<b id="resCoin">+0</b><span>${parts}</span></div>`;
}

function afterResult(res) {
  const el = $('resCoin');
  if (el && res.coins > 0) {
    setTimeout(() => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 700);
        el.textContent = '+' + Math.round(res.coins * (1 - (1 - k) ** 3));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      sfx.tick();
    }, 1100);
  }
  $('screen').querySelectorAll('.chal li.new').forEach((li) => {
    const d = parseInt(li.style.getPropertyValue('--d')) || 0;
    setTimeout(() => sfx.star(1), d + 200);
  });
  res.unlocked.forEach((a, k) => setTimeout(() => toast(a), 1600 + k * 400));
}

// —— 成就达成横幅：排队依次弹出 ——
const toastQ = [];
let toastBusy = false;
function toast(a) {
  toastQ.push(a);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const a = toastQ.shift();
  if (!a) { toastBusy = false; return; }
  toastBusy = true;
  const el = $('toast');
  el.innerHTML = `${sealHtml(a.name, true)}
    <div class="t-body">
      <em>成就达成</em>
      <b>${a.name}</b>
      <small>${a.desc} · ${COIN}+${a.coin}${a.skin ? ` · 解锁「${a.skin.name}」` : ''}</small>
    </div>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  sfx.powerAppear();
  setTimeout(() => sfx.star(2), 120);
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 380); }, 3000);
}

function countUp(el, to, dur, delay) {
  if (!el) return;
  setTimeout(() => {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, delay);
}

const game = new Game(app, ui);
applySkin();
meta.perksNow = () => game.perks;
let current = 0;

function play(i) {
  current = i;
  ui.menuOpen = false;
  ui.close();
  ui.hud(true);
  ui.hint(isTouch ? '按住拖动瞄准 · 松手发射 · 点珠盘交换' : '左键发射 · 右键 / 空格 交换 · Esc 暂停');
  game.start(i);
}

function toMenu() {
  ui.hud(false);
  game.loadLevel(Math.min(store.get('unlocked', 0), LEVELS.length - 1), 'menu');
  ui.showMenu();
}

$('screen').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  sfx.unlock();
  sfx.swap();
  const act = b.dataset.act;
  if (act === 'play') play(+b.dataset.lv);
  else if (act === 'retry') play(current);
  else if (act === 'next') play(Math.min(current + 1, LEVELS.length - 1));
  else if (act === 'menu') toMenu();
  else if (act === 'resume') game.resume();
  else if (act === 'codex') ui.showCodex();
  else if (act === 'share') openShare();
  else if (act === 'shop') ui.showShop();
  else if (act === 'home') ui.showMenu();
  else if (act === 'buy') {
    const got = meta.buy(b.dataset.kind, b.dataset.skin);
    if (got) { applySkin(); sfx.rainbow(); ui.showShop(); got.forEach(toast); }
  } else if (act === 'perk') {
    game.pickPerk(b.dataset.perk);
  } else if (act === 'equip') {
    if (meta.equip(b.dataset.kind, b.dataset.skin)) { applySkin(); sfx.powerAppear(); ui.showShop(); }
  } else if (act === 'shoptab') {
    ui.showShop(b.dataset.tab);
  } else if (act === 'revive') {
    clearTimeout(ui._reviveT);
    if (game.state === 'revive' && meta.spend(ui._reviveCost)) game.revive();
  } else if (act === 'giveup') {
    clearTimeout(ui._reviveT);
    game.giveUp();
  }
});

function applySkin() {
  const s = meta.skin();
  game.setSkin(s.id, s.halo);
  game.setBallSkin(meta.P.ball);
  game.setTrail(meta.P.trail);
}

$('btnPause').addEventListener('click', () => game.pause());
// 交换按钮用 pointerdown，按下即生效，不等松手
$('ammo').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlock(); game.swap(); });
const muteBtn = $('btnMute');
const applyMute = (m) => { sfx.setMuted(m); muteBtn.classList.toggle('muted', m); store.set('muted', m); };
applyMute(store.get('muted', false));
muteBtn.addEventListener('click', () => { sfx.unlock(); applyMute(!sfx.muted); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { game.pause(); sfx.suspend(); }
});
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
window.addEventListener('keydown', (e) => {
  if (game.state !== 'choose' || !game.choices) return;
  const k = +e.key;
  if (k >= 1 && k <= game.choices.length) { sfx.swap(); game.pickPerk(game.choices[k - 1].id); }
});

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (ui.menuOpen) ui.showMenu(); }, 200);
});

initDevPanel(() => game);
fontsReady.then(() => {
  toMenu();
  // 老存档：补发已经满足条件的成就（如累计星数）
  const got = meta.check(meta.ctx(0, { powers: {} }));
  if (got.length) { got.forEach(toast); ui.showMenu(); }
});
window.__game = game; // 调试用
