import { buildTextures } from './textures.js';
import { Game } from './game.js';
import { LEVELS, ENDLESS } from './levels.js';
import { sfx } from './audio.js';
import { loadCfg } from './config.js';
import { initDevPanel } from './devpanel.js';
import { COLORS, RAINBOW } from './textures.js';

const $ = (id) => document.getElementById(id);
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
const lvLabel = (i) => (i < 0 ? '无尽模式' : `第${CN[i] || i + 1}关`);
const lvName = (i) => (i < 0 ? ENDLESS.name : LEVELS[i].name);
const stageLabel = (n) => `第${CN[n - 1] || n}重`;
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

const store = {
  get(k, d) {
    try { const v = localStorage.getItem('lanternOrbs.' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('lanternOrbs.' + k, JSON.stringify(v)); } catch { /* 隐私模式等情况忽略 */ }
  },
};

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
    $('lvNo').textContent = i < 0 ? '无尽' : lvLabel(i);
    $('lvName').textContent = i < 0 ? stageLabel(1) : LEVELS[i].name;
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
    if (!show) { this.setEffects(0, 0); this.setFeverMode(false); this.setBoss(null); }
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
    this.show(this.scroll(`
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">${lvName(i)}</h2>
      <div class="s-sub">暂歇片刻，灯火未熄</div>
      <div class="actions">
        <button class="btn-red" data-act="resume">继续</button>
        <div class="btn-row">
          <button class="btn-ink" data-act="retry">重新开始</button>
          <button class="btn-ink" data-act="menu">选择关卡</button>
        </div>
      </div>`));
  },

  onWin(i, score, stars, stats) {
    const prevBest = store.get('best' + i, 0);
    const best = Math.max(score, prevBest);
    store.set('best' + i, best);
    store.set('stars' + i, Math.max(stars, store.get('stars' + i, 0)));
    store.set('unlocked', Math.max(store.get('unlocked', 0), Math.min(i + 1, LEVELS.length - 1)));
    const last = i === LEVELS.length - 1;
    const isNew = score > prevBest && prevBest > 0;
    this.show(this.scroll(`
      <div class="stamp">${last ? '圆满' : '过关'}</div>
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">${LEVELS[i].name}</h2>
      <div class="stars-row">${STAR}${STAR}${STAR}</div>
      <div class="s-score" id="resScore">0</div>
      <div class="s-stats">${stats.time != null ? `用时 <b>${stats.time} 秒</b> · ` : ''}最高连锁 <b>×${stats.bestChain || 1}</b> · 最高分 <b>${best.toLocaleString()}</b>${isNew ? ' · <b>新纪录</b>' : ''}</div>
      <div class="actions">
        ${last ? '' : '<button class="btn-red" data-act="next">下一关</button>'}
        <div class="btn-row">
          <button class="btn-ink" data-act="retry">再来一次</button>
          <button class="btn-ink" data-act="menu">选择关卡</button>
        </div>
      </div>`));
    const svgs = $('screen').querySelectorAll('.stars-row svg');
    for (let k = 0; k < stars; k++) {
      setTimeout(() => { svgs[k]?.classList.add('on'); sfx.star(k); }, 650 + k * 300);
    }
    countUp($('resScore'), score, 900, 500);
  },

  onLose(i, score, stats) {
    if (i < 0) { this.onEndless(score, stats); return; }
    this.show(this.scroll(`
      <div class="stamp grey">熄</div>
      <div class="s-level">${lvLabel(i)}</div>
      <h2 class="s-title">灯火熄灭</h2>
      <div class="s-sub">珠串落入了古井</div>
      <div class="s-score" id="resScore">0</div>
      <div class="actions">
        <button class="btn-red" data-act="retry">再试一次</button>
        <button class="btn-ink" data-act="menu">选择关卡</button>
      </div>`));
    countUp($('resScore'), score, 700, 400);
  },

  // 无尽模式结算：没有失败，只有纪录
  onEndless(score, st) {
    const prev = store.get('endlessBest', 0);
    const isNew = score > prev;
    if (isNew) store.set('endlessBest', score);
    store.set('endlessStage', Math.max(st.stage, store.get('endlessStage', 0)));
    store.set('endlessTime', Math.max(st.time, store.get('endlessTime', 0)));
    this.show(this.scroll(`
      <div class="stamp">${isNew && prev > 0 ? '新纪录' : '尽兴'}</div>
      <div class="s-level">无尽模式</div>
      <h2 class="s-title">坚持到${stageLabel(st.stage)}</h2>
      <div class="s-score" id="resScore">0</div>
      <div class="s-stats">坚持 <b>${fmtTime(st.time)}</b> · 最高连锁 <b>×${st.bestChain || 1}</b> · 最高分 <b>${Math.max(score, prev).toLocaleString()}</b></div>
      <div class="actions">
        <button class="btn-red" data-act="retry">再战一夜</button>
        <button class="btn-ink" data-act="menu">返回首页</button>
      </div>`));
    if (isNew) setTimeout(() => sfx.star(2), 700);
    countUp($('resScore'), score, 900, 400);
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
        <div class="lantern-map">${rows.join('')}</div>
        <button class="endless-btn" data-act="play" data-lv="-1">
          <span class="e-title">无尽模式</span>
          <span class="e-sub">${store.get('endlessBest', 0) ? `最高分 <b>${store.get('endlessBest', 0).toLocaleString()}</b> · 最远${stageLabel(store.get('endlessStage', 1))}` : '珠串永不停歇，看你能坚持多久'}</span>
        </button>
        <div class="meta">
          <span class="total">★ <b>${total}</b> / ${LEVELS.length * 3}</span>
          <span class="howto">${how}<br>三珠同色即消 · 断口同色回吸成连锁 · 攒满「燎原」大爆发</span>
        </div>
        <div class="credits">
          <a class="credit more" href="https://hbycrj.com/games/">更多游戏 →</a>
          <a class="credit" href="https://hbycrj.com" target="_blank" rel="noopener">清河县翼程软件开发 · <b>hbycrj.com</b></a>
        </div>
      </div>`, false);
    this.menuOpen = true;
  },
};

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
});

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

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (ui.menuOpen) ui.showMenu(); }, 200);
});

initDevPanel(() => game);
fontsReady.then(toMenu);
window.__game = game; // 调试用
