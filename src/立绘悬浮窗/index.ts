/**
 * 立绘展示悬浮窗 —— 酒馆助手脚本（纯 jQuery 版）
 *
 * 【关键教训：不要用 window.innerWidth/innerHeight】
 *   脚本运行在酒馆的「隐藏后台 iframe」里。$ / getScriptId / getVariables
 *   被酒馆助手特殊处理 → 指向酒馆主页面；但 window.innerWidth / innerHeight
 *   仍是这个隐藏 iframe 自己的尺寸（可能是 0），用它算初始位置会把悬浮球
 *   定位到 left:-62px → 跑到屏幕外 → 看不见！
 *
 *   解决：
 *   1. 初始定位用 CSS（right:16px; top:40%），和已验证可用的简易版一样，保证可见
 *   2. 拖动时用 getBoundingClientRect() 读元素真实屏幕坐标 + 鼠标 clientX/Y
 *      （鼠标事件在主 document 触发，坐标是相对主视口的真实值）
 *   3. 视口尺寸用 viewportW()/viewportH()（读主窗口，带多重回退）
 *
 * 【功能】
 *   1. 可拖动悬浮球（拖动后位置持久化到脚本变量）
 *   2. 可拖动立绘面板（标题栏拖动，位置独立持久化）
 *   3. 面板打开时出现在悬浮球旁；手动拖动后独立；关闭再打开重新跟随
 *   4. 5 个分类标签 + 版本切换按钮，真实立绘 URL
 */

// ══════════════════════════════════════════════════════════════
// 1. 立绘数据
// ══════════════════════════════════════════════════════════════
const ILLUST_BASE = 'https://raw.githubusercontent.com/wenyueluo/sillytraven/main/yyryjyy';

interface Illustration { name: string; url: string }
interface Category { name: string; items: Illustration[] }

const categories: Category[] = [
  {
    name: '月岛悠',
    items: [
      { name: '颓废期', url: `${ILLUST_BASE}/ma-5.png` },
      { name: '后期', url: `${ILLUST_BASE}/ma-6.png` },
    ],
  },
  { name: '朝日向七海', items: [{ name: '日', url: `${ILLUST_BASE}/ma-11.png` }] },
  { name: '月见里雫', items: [{ name: '雨', url: `${ILLUST_BASE}/ma-9.png` }] },
  { name: '橘澪', items: [{ name: '橘', url: `${ILLUST_BASE}/ma-10.png` }] },
  {
    name: '双人',
    items: [
      { name: '月岛悠×朝日向七海', url: `${ILLUST_BASE}/ma-12.png` },
      { name: '月岛悠×月见里雫', url: `${ILLUST_BASE}/ma-17.png` },
      { name: '月岛悠×橘澪①', url: `${ILLUST_BASE}/ma-16.png` },
      { name: '月岛悠×橘澪②', url: `${ILLUST_BASE}/ma-18.png` },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// 2. 常量
// ══════════════════════════════════════════════════════════════
const 标记 = getScriptId();
const PANEL_WIDTH = 280;
const PANEL_MIN_VISIBLE = 80;
const FAB_SIZE = 46;
const DRAG_THRESHOLD = 4;

// ── 视口尺寸：脚本 iframe 的 window.innerWidth 不可靠，读主窗口 ──
function viewportW(): number {
  let w = 0;
  try { w = window.parent ? window.parent.innerWidth : 0; } catch { /* 跨域 */ }
  if (!w) w = window.innerWidth;
  if (!w) { try { w = window.parent.document.documentElement.clientWidth; } catch { /* ignore */ } }
  return w || 1280;
}
function viewportH(): number {
  let h = 0;
  try { h = window.parent ? window.parent.innerHeight : 0; } catch { /* 跨域 */ }
  if (!h) h = window.innerHeight;
  if (!h) { try { h = window.parent.document.documentElement.clientHeight; } catch { /* ignore */ } }
  return h || 720;
}

// ══════════════════════════════════════════════════════════════
// 3. 位置持久化（脚本变量）
//    存的是用户拖动后的真实坐标。首次没有 → 用 CSS 默认定位。
// ══════════════════════════════════════════════════════════════
interface SavedPos {
  fabLeft?: number; fabTop?: number;
  panelLeft?: number; panelTop?: number;
  panelManuallyPositioned?: boolean;
}
function 读位置(): SavedPos {
  try { return (getVariables({ type: 'script' }) as SavedPos) || {}; } catch { return {}; }
}
function 写位置(p: SavedPos) {
  try { insertOrAssignVariables({ ...p }, { type: 'script' }); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════
// 4. 样式（直接注入 head）
//    .lh-fab / .lh-panel 默认用 right/top 定位 → 不依赖 innerWidth，必可见
// ══════════════════════════════════════════════════════════════
const 样式 = `
.lh-fab {
  position:fixed; right:16px; top:40%; width:46px; height:46px; border-radius:50%;
  background:#1b1030; border:1px solid rgba(167,139,250,.4); color:#c4b5fd;
  font-size:22px; display:flex; align-items:center; justify-content:center;
  cursor:grab; user-select:none; touch-action:none; z-index:2147483646;
  box-shadow:0 0 16px rgba(167,139,250,.35), 0 3px 12px rgba(0,0,0,.5);
  transition:filter .15s, box-shadow .2s;
}
.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 26px rgba(167,139,250,.55); }
.lh-fab.is-dragging { cursor:grabbing; }
.lh-panel {
  position:fixed; right:16px; top:50%; transform:translateY(-50%);
  width:280px; background:#120c1f;
  border:1px solid rgba(167,139,250,.3); border-radius:14px;
  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:2147483647;
  display:none; flex-direction:column; overflow:hidden; color:#e9e3ff;
  font-family:'Segoe UI',system-ui,sans-serif;
}
.lh-panel.lh-visible { display:flex; }
.lh-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:8px 12px; font-size:13px;
  border-bottom:1px solid rgba(167,139,250,.15); cursor:move; user-select:none;
}
.lh-head.is-dragging { cursor:grabbing; }
.lh-close { cursor:pointer; width:22px; height:22px; line-height:22px;
  text-align:center; border-radius:6px; color:#c4b5fd; }
.lh-close:hover { background:rgba(167,139,250,.2); }
.lh-categories { display:flex; flex-wrap:wrap; gap:4px; padding:6px 10px;
  border-bottom:1px solid rgba(167,139,250,.15); }
.lh-cat-tab { flex:1; min-width:48px; padding:4px 2px; font-size:11px;
  text-align:center; cursor:pointer; border-radius:6px;
  color:rgba(255,255,255,.5); transition:background .15s, color .15s; }
.lh-cat-tab:hover { color:#c4b5fd; background:rgba(167,139,250,.1); }
.lh-cat-tab.active { color:#e9e3ff; background:rgba(167,139,250,.15); font-weight:600; }
.lh-img-wrap { width:100%; aspect-ratio:2/3; background:#0a0712;
  display:flex; align-items:center; justify-content:center; overflow:hidden; }
.lh-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
.lh-btns { display:flex; flex-wrap:wrap; gap:6px; padding:10px; }
.lh-btn { flex:1 1 auto; min-width:56px; padding:6px 10px; font-size:11px;
  text-align:center; cursor:pointer; border-radius:8px;
  border:1px solid rgba(167,139,250,.25); background:rgba(167,139,250,.08);
  color:#d6ccff; transition:background .15s, border-color .15s; white-space:nowrap; }
.lh-btn:hover { background:rgba(167,139,250,.2); }
.lh-btn.active { background:#a78bfa; border-color:#a78bfa; color:#1b1030; font-weight:600; }
.lh-fab.is-dragging *, .lh-panel-dragging * { user-select:none; }
`;

// ══════════════════════════════════════════════════════════════
// 5. 构建
// ══════════════════════════════════════════════════════════════
$(() => {
  // ── 注入样式 ──
  $('<style>').attr('script_id', 标记).text(样式).appendTo('head');

  const saved = 读位置();

  // ── 坐标有效性校验 ──
  //   旧版（Vue/早期jQuery）在 0x0 的 iframe 里用 innerWidth 算出 -62 这种坏坐标
  //   并持久化到了脚本变量。这里必须校验：坐标在主视口内才用，否则忽略→走CSS默认定位。
  function validCoord(left: unknown, top: unknown, w: number, h: number): boolean {
    if (typeof left !== 'number' || typeof top !== 'number') return false;
    if (!isFinite(left) || !isFinite(top)) return false;
    // 必须落在可视区域内（留 4px 容差），否则视为坏坐标
    return left >= -4 && top >= -4 && left <= viewportW() - 10 && top <= viewportH() - 10;
  }

  // ── 悬浮球（默认 CSS 定位 right:16px/top:40%；仅当存储坐标有效才覆盖）──
  const $fab = $('<div>')
    .attr('script_id', 标记)
    .addClass('lh-fab')
    .text('🖼') // 🖼
    .appendTo('body');
  if (validCoord(saved.fabLeft, saved.fabTop, FAB_SIZE, FAB_SIZE)) {
    $fab.css({ left: saved.fabLeft + 'px', top: saved.fabTop + 'px', right: 'auto' });
  } else if (saved.fabLeft !== undefined) {
    // 检测到坏坐标 → 清掉，避免下次再读到
    写位置({ fabLeft: undefined, fabTop: undefined });
  }

  // ── 面板 ──
  const $panel = $('<div>').attr('script_id', 标记).addClass('lh-panel').appendTo('body');
  let panelManuallyPositioned = saved.panelManuallyPositioned === true
    && validCoord(saved.panelLeft, saved.panelTop, PANEL_WIDTH, PANEL_MIN_VISIBLE);
  if (panelManuallyPositioned) {
    $panel.css({ left: saved.panelLeft + 'px', top: saved.panelTop + 'px', right: 'auto', transform: 'none' });
  }

  // 标题栏
  const $head = $('<div>').addClass('lh-head').appendTo($panel);
  $('<span>').text('立绘展示').appendTo($head);
  const $close = $('<span>').addClass('lh-close').text('✕').appendTo($head); // ✕

  const $cats = $('<div>').addClass('lh-categories').appendTo($panel);
  const $imgWrap = $('<div>').addClass('lh-img-wrap').appendTo($panel);
  const $img = $('<img>').addClass('lh-img').appendTo($imgWrap);
  const $btns = $('<div>').addClass('lh-btns').appendTo($panel);

  // ── 状态 ──
  let catIdx = 0, itemIdx = 0, panelVisible = false;
  const cat = () => categories[catIdx];
  const item = () => cat().items[itemIdx];

  function renderCats() {
    $cats.empty();
    categories.forEach((c, i) => {
      $('<div>').addClass('lh-cat-tab').toggleClass('active', i === catIdx)
        .text(c.name).on('click', () => switchCat(i)).appendTo($cats);
    });
  }
  function switchCat(idx: number) {
    if (idx === catIdx) return;
    catIdx = idx; itemIdx = 0;
    renderCats(); renderBtns(); updateImg();
  }
  function renderBtns() {
    $btns.empty();
    cat().items.forEach((it, i) => {
      $('<div>').addClass('lh-btn').toggleClass('active', i === itemIdx)
        .text(it.name).on('click', () => { itemIdx = i; renderBtns(); updateImg(); }).appendTo($btns);
    });
  }
  function updateImg() { $img.attr('src', item().url).attr('alt', item().name); }

  // ── 面板跟随悬浮球：基于 fab 的真实屏幕坐标 ──
  function fabRect() { return ($fab[0] as HTMLElement).getBoundingClientRect(); }
  function followFab() {
    const r = fabRect();
    let left = r.left - PANEL_WIDTH - 10;
    if (left < 0) left = r.right + 10;                       // 左侧放不下→放右侧
    if (left + PANEL_WIDTH > viewportW()) left = Math.max(10, viewportW() - PANEL_WIDTH - 10);
    let top = r.top - 40;
    if (top < 10) top = 10;
    if (top + PANEL_MIN_VISIBLE > viewportH()) top = viewportH() - PANEL_MIN_VISIBLE - 10;
    $panel.css({ left: left + 'px', top: top + 'px', right: 'auto', transform: 'none' });
  }

  function openPanel() {
    if (!panelManuallyPositioned) followFab();
    $panel.addClass('lh-visible');
    panelVisible = true;
    renderCats(); renderBtns(); updateImg();
  }
  function closePanel() {
    $panel.removeClass('lh-visible');
    panelVisible = false;
    panelManuallyPositioned = false;
    写位置({ panelManuallyPositioned: false });
  }

  // ══════════════════════════════════════════════════════════
  // 6. 拖动（悬浮球 + 面板标题栏）—— 全部基于 getBoundingClientRect
  // ══════════════════════════════════════════════════════════
  let dragTarget: 'fab' | 'panel' | null = null;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;

  function getXY(e: JQuery.TriggeredEvent): { x: number; y: number } | null {
    const oe = e.originalEvent;
    if (oe instanceof TouchEvent) {
      const t = oe.touches[0] ?? oe.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: (oe as MouseEvent).clientX, y: (oe as MouseEvent).clientY };
  }

  $fab.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'fab'; moved = false;
    const r = fabRect();
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    $fab.addClass('is-dragging');
    e.preventDefault();
  });

  $head.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'panel'; moved = false;
    const r = ($panel[0] as HTMLElement).getBoundingClientRect();
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    panelManuallyPositioned = true; // 拖动即断开跟随
    $head.addClass('is-dragging'); $panel.addClass('lh-panel-dragging');
    e.preventDefault();
  });

  $close.on('mousedown', (e) => e.stopPropagation());
  $close.on('click', () => closePanel());

  $(document).on('mousemove.lh touchmove.lh', (e) => {
    if (!dragTarget) return;
    const pos = getXY(e); if (!pos) return;
    const dx = pos.x - startX, dy = pos.y - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;

    if (dragTarget === 'fab') {
      const left = Math.max(0, Math.min(viewportW() - FAB_SIZE, startLeft + dx));
      const top = Math.max(0, Math.min(viewportH() - FAB_SIZE, startTop + dy));
      $fab.css({ left: left + 'px', top: top + 'px', right: 'auto' });
      if (panelVisible && !panelManuallyPositioned) followFab();
    } else {
      const left = Math.max(-PANEL_WIDTH + PANEL_MIN_VISIBLE, Math.min(viewportW() - PANEL_MIN_VISIBLE, startLeft + dx));
      const top = Math.max(0, Math.min(viewportH() - PANEL_MIN_VISIBLE, startTop + dy));
      $panel.css({ left: left + 'px', top: top + 'px', right: 'auto', transform: 'none' });
    }
  });

  $(document).on('mouseup.lh touchend.lh', () => {
    if (!dragTarget) return;
    if (dragTarget === 'fab') {
      $fab.removeClass('is-dragging');
      if (!moved) {
        panelVisible ? closePanel() : openPanel();
      } else {
        const r = fabRect();
        写位置({ fabLeft: r.left, fabTop: r.top });
      }
    } else {
      $head.removeClass('is-dragging'); $panel.removeClass('lh-panel-dragging');
      const r = ($panel[0] as HTMLElement).getBoundingClientRect();
      写位置({ panelLeft: r.left, panelTop: r.top, panelManuallyPositioned: true });
    }
    dragTarget = null;
  });

  // ── 窗口缩放：把元素拉回视口内 ──
  $(window).on('resize.lh', () => {
    const r = fabRect();
    const left = Math.max(0, Math.min(viewportW() - FAB_SIZE, r.left));
    const top = Math.max(0, Math.min(viewportH() - FAB_SIZE, r.top));
    $fab.css({ left: left + 'px', top: top + 'px', right: 'auto' });
    if (panelVisible) {
      if (!panelManuallyPositioned) followFab();
      else {
        const pr = ($panel[0] as HTMLElement).getBoundingClientRect();
        $panel.css({
          left: Math.max(0, Math.min(viewportW() - PANEL_WIDTH, pr.left)) + 'px',
          top: Math.max(0, Math.min(viewportH() - PANEL_MIN_VISIBLE, pr.top)) + 'px',
          right: 'auto', transform: 'none',
        });
      }
    }
  });

  // ── 兜底自检：挂载后检查悬浮球真实屏幕坐标，不在视口内就强制拉回右侧 ──
  function ensureVisible() {
    const el = $fab[0] as HTMLElement;
    const r = el.getBoundingClientRect();
    const vw = viewportW(), vh = viewportH();
    const offscreen = r.width === 0 || r.height === 0
      || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh;
    console.log('[立绘悬浮窗] 悬浮球实测坐标:', JSON.stringify({ left: r.left, top: r.top, w: r.width, h: r.height }),
      '父挂载点:', el.ownerDocument === document ? 'iframe-doc' : 'parent-doc',
      offscreen ? '⚠️屏外→已拉回' : '✅可见');
    if (offscreen) {
      // 强制定位到右侧可见处（用主视口尺寸算）
      $fab.css({ left: (vw - FAB_SIZE - 16) + 'px', top: Math.round(vh * 0.4) + 'px', right: 'auto' });
    }
  }
  // 立即检查 + 延迟再查一次（等布局稳定）
  ensureVisible();
  setTimeout(ensureVisible, 500);

  console.log('[立绘悬浮窗] jQuery版已挂载, ID:', 标记,
    'iframe视口:', window.innerWidth + 'x' + window.innerHeight,
    '主视口:', viewportW() + 'x' + viewportH());
  toastr.success('立绘悬浮窗已加载，点击右侧🖼展开', '');

  // ── 卸载 ──
  $(window).on('pagehide', () => {
    $(`[script_id="${标记}"]`).remove();
    $(document).off('.lh');
    $(window).off('.lh');
  });
});
