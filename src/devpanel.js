// 调参面板：按 ` 键或网址加 ?dev 打开；拖动滑块实时生效，参数存到本地
import { PARAMS, CFG, saveCfg, resetCfg } from './config.js';

export function initDevPanel(getGame) {
  let panel = null;

  function build() {
    panel = document.createElement('div');
    panel.id = 'devpanel';
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    render();
    document.body.appendChild(panel);
  }

  function render() {
    let html = '<div class="head"><b>手感调参</b><span>` 键开关</span></div>';
    for (const p of PARAMS) {
      if (p.group) { html += `<h4>${p.group}</h4>`; continue; }
      const changed = CFG[p.key] !== p.def ? 'changed' : '';
      html += `<label class="${changed}" data-k="${p.key}"><span>${p.label}</span><output>${CFG[p.key]}</output>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${CFG[p.key]}" data-k="${p.key}"></label>`;
    }
    html += `<div class="row-btn"><button data-a="copy">复制参数</button><button data-a="reset">恢复默认</button></div>
      <div class="row-btn"><button data-a="retry">重开本关</button><button data-a="fever">触发燎原</button></div>
      <div class="row-btn"><button data-a="unlock">解锁全部关卡</button></div>`;
    panel.innerHTML = html;
  }

  function attach() {
    panel.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      CFG[k] = +e.target.value;
      const lab = e.target.closest('label');
      lab.querySelector('output').textContent = CFG[k];
      lab.classList.toggle('changed', CFG[k] !== PARAMS.find((p) => p.key === k).def);
      saveCfg();
    });
    panel.addEventListener('click', async (e) => {
      const a = e.target.dataset.a;
      const g = getGame();
      if (a === 'copy') {
        const txt = JSON.stringify(saveCfg(), null, 2);
        try { await navigator.clipboard.writeText(txt); e.target.textContent = '已复制'; }
        catch { prompt('复制下面的参数：', txt); }
        setTimeout(() => (e.target.textContent = '复制参数'), 1200);
      } else if (a === 'reset') { resetCfg(); render(); }
      else if (a === 'retry' && g.lv) { g.start(g.levelIndex); }
      else if (a === 'fever' && g.state === 'play') { g.startFever(); }
      else if (a === 'unlock') {
        try { localStorage.setItem('lanternOrbs.unlocked', '999'); } catch { /* 忽略 */ }
        location.reload();
      }
    });
  }

  function toggle() {
    if (!panel) { build(); attach(); return; }
    panel.hidden = !panel.hidden;
  }

  window.addEventListener('keydown', (e) => { if (e.code === 'Backquote') toggle(); });
  if (new URLSearchParams(location.search).has('dev')) toggle();
}
