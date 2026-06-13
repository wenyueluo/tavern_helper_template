/**
 * 立绘展示悬浮窗 —— 酒馆助手脚本（纯 jQuery 版）
 *
 * 【为什么不用 Vue】
 *   Vue 版依赖 scoped 样式 + teleportStyle() 复制到酒馆 head，
 *   这个链路在某些环境下失效 → 悬浮球不可见。
 *   纯 jQuery 版=样式直接 $('<style>').appendTo('head')+DOM 直接 appendTo('body')，
 *   和已验证可用的简易版一模一样的注入方式，保证 100% 可见。
 *
 * 【功能】
 *   1. 可拖动悬浮球（位置持久化到脚本变量）
 *   2. 可拖动立绘面板（标题栏拖动，位置独立持久化）
 *   3. 面板初始跟随悬浮球；手动拖动后面板独立；关闭再打开重新跟随
 *   4. 5 个分类标签（月岛悠/朝日向七海/月见里雫/橘澪/双人）+ 版本切换按钮
 *   5. 真实立绘 URL（GitHub raw）
 *   6. 窗口缩放时自动约束边界
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
  {
    name: '朝日向七海',
    items: [{ name: '日', url: `${ILLUST_BASE}/ma-11.png` }],
  },
  {
    name: '月见里雫',
    items: [{ name: '雨', url: `${ILLUST_BASE}/ma-9.png` }],
  },
  {
    name: '橘澪',
    items: [{ name: '橘', url: `${ILLUST_BASE}/ma-10.png` }],
  },
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

// ══════════════════════════════════════════════════════════════
// 3. 位置持久化（脚本变量）
// ══════════════════════════════════════════════════════════════
function 读位置() {
  try {
    const v = getVariables({ type: 'script' }) as Record<string, any> | undefined;
    return {
      fabLeft: v?.fabLeft ?? (window.innerWidth - 62),
      fabTop: v?.fabTop ?? (window.innerHeight * 0.4),
      panelLeft: v?.panelLeft ?? Math.max(0, window.innerWidth - 62 - PANEL_WIDTH - 10),
      panelTop: v?.panelTop ?? Math.max(0, window.innerHeight * 0.4 - 50),
      panelManuallyPositioned: v?.panelManuallyPositioned ?? false,
    };
  } catch { return { fabLeft: window.innerWidth - 62, fabTop: window.innerHeight * 0.4, panelLeft: window.innerWidth - 62 - PANEL_WIDTH - 10, panelTop: window.innerHeight * 0.4 - 50, panelManuallyPositioned: false }; }
}

// 位置状态（可变）
const 位置 = 读位置();

function 写位置() {
  try { insertOrAssignVariables({ fabLeft: 位置.fabLeft, fabTop: 位置.fabTop, panelLeft: 位置.panelLeft, panelTop: 位置.panelTop, panelManuallyPositioned: 位置.panelManuallyPositioned }, { type: 'script' }); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════
// 4. 样式（直接注入 head —— 已验证可用）
// ══════════════════════════════════════════════════════════════
const 样式 = `
.lh-fab {
  position:fixed; width:46px; height:46px; border-radius:50%;
  background:#1b1030; border:1px solid rgba(167,139,250,.4); color:#c4b5fd;
  font-size:22px; display:flex; align-items:center; justify-content:center;
  cursor:grab; user-select:none; touch-action:none; z-index:999999;
  box-shadow:0 0 16px rgba(167,139,250,.35), 0 3px 12px rgba(0,0,0,.5);
  transition:filter .15s, box-shadow .2s;
}
.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 26px rgba(167,139,250,.55); }
.lh-fab.is-dragging { cursor:grabbing; }
.lh-panel {
  position:fixed; width:280px; background:#120c1f;
  border:1px solid rgba(167,139,250,.3); border-radius:14px;
  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:999998;
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
// 5. 构建 DOM
// ══════════════════════════════════════════════════════════════
$(() => {
  // ── 注入样式 ──
  $('<style>').attr('script_id', 标记).text(样式).appendTo('head');

  // ── 悬浮球（直接挂 body，已验证的方式）──
  const $fab = $('<div>')
    .attr('script_id', 标记)
    .addClass('lh-fab')
    .text('🖼') // 🖼
    .css({ left: 位置.fabLeft + 'px', top: 位置.fabTop + 'px' })
    .appendTo('body');

  // ── 面板 ──
  const $panel = $('<div>')
    .attr('script_id', 标记)
    .addClass('lh-panel')
    .css({ left: 位置.panelLeft + 'px', top: 位置.panelTop + 'px' })
    .appendTo('body');

  // 标题栏
  const $head = $('<div>').addClass('lh-head').appendTo($panel);
  $('<span>').text('立绘展示').appendTo($head);
  const $close = $('<span>').addClass('lh-close').text('✕').appendTo($head); // ✕

  // 分类标签
  const $cats = $('<div>').addClass('lh-categories').appendTo($panel);

  // 大图
  const $imgWrap = $('<div>').addClass('lh-img-wrap').appendTo($panel);
  const $img = $('<img>').addClass('lh-img').appendTo($imgWrap);

  // 版本按钮
  const $btns = $('<div>').addClass('lh-btns').appendTo($panel);

  // ══════════════════════════════════════════════════════════
  // 6. 状态
  // ══════════════════════════════════════════════════════════
  let catIdx = 0;
  let itemIdx = 0;
  let panelVisible = false;

  function currentCat() { return categories[catIdx]; }
  function currentItem() { return currentCat().items[itemIdx]; }

  // ══════════════════════════════════════════════════════════
  // 7. 渲染分类标签
  // ══════════════════════════════════════════════════════════
  function renderCats() {
    $cats.empty();
    categories.forEach((cat, i) => {
      $('<div>')
        .addClass('lh-cat-tab')
        .toggleClass('active', i === catIdx)
        .text(cat.name)
        .on('click', () => switchCat(i))
        .appendTo($cats);
    });
  }

  function switchCat(idx: number) {
    if (idx === catIdx) return;
    catIdx = idx;
    itemIdx = 0;
    renderCats();
    renderBtns();
    updateImg();
  }

  // ══════════════════════════════════════════════════════════
  // 8. 渲染版本按钮 + 更新图片
  // ══════════════════════════════════════════════════════════
  function renderBtns() {
    $btns.empty();
    currentCat().items.forEach((item, i) => {
      $('<div>')
        .addClass('lh-btn')
        .toggleClass('active', i === itemIdx)
        .text(item.name)
        .on('click', () => { itemIdx = i; renderBtns(); updateImg(); })
        .appendTo($btns);
    });
  }

  function updateImg() {
    $img.attr('src', currentItem().url).attr('alt', currentItem().name);
  }

  // ══════════════════════════════════════════════════════════
  // 9. 面板初始位置计算（跟随悬浮球）
  // ══════════════════════════════════════════════════════════
  function computePanelLeft(): number {
    let left = 位置.fabLeft - PANEL_WIDTH - 10;
    if (left < 0) left = 10;
    if (left + PANEL_WIDTH > window.innerWidth) left = window.innerWidth - PANEL_WIDTH - 10;
    return left;
  }
  function computePanelTop(): number {
    let top = 位置.fabTop - 50;
    if (top < 0) top = 10;
    if (top + PANEL_MIN_VISIBLE > window.innerHeight) top = window.innerHeight - PANEL_MIN_VISIBLE - 10;
    return top;
  }

  // ══════════════════════════════════════════════════════════
  // 10. 打开/关闭面板
  // ══════════════════════════════════════════════════════════
  function openPanel() {
    if (!位置.panelManuallyPositioned) {
      位置.panelLeft = computePanelLeft();
      位置.panelTop = computePanelTop();
      $panel.css({ left: 位置.panelLeft + 'px', top: 位置.panelTop + 'px' });
    }
    $panel.addClass('lh-visible');
    panelVisible = true;
    renderCats();
    renderBtns();
    updateImg();
    写位置();
  }

  function closePanel() {
    $panel.removeClass('lh-visible');
    panelVisible = false;
    位置.panelManuallyPositioned = false;
    写位置();
  }

  // ══════════════════════════════════════════════════════════
  // 11. 拖动逻辑（共享：悬浮球 + 面板标题栏）
  // ══════════════════════════════════════════════════════════
  let dragTarget: 'fab' | 'panel' | null = null;
  let dragStartX = 0, dragStartY = 0;
  let dragStartLeft = 0, dragStartTop = 0;
  let hasMoved = false;

  function getXY(e: JQuery.TriggeredEvent): { x: number; y: number } | null {
    const oe = e.originalEvent;
    if (oe instanceof TouchEvent) {
      const t = oe.touches[0] ?? oe.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: (oe as MouseEvent).clientX, y: (oe as MouseEvent).clientY };
  }

  function onFabDown(e: JQuery.TriggeredEvent) {
    dragTarget = 'fab';
    hasMoved = false;
    const pos = getXY(e);
    if (!pos) return;
    dragStartX = pos.x; dragStartY = pos.y;
    dragStartLeft = 位置.fabLeft; dragStartTop = 位置.fabTop;
    $fab.addClass('is-dragging');
    e.preventDefault();
  }

  function onPanelDown(e: JQuery.TriggeredEvent) {
    dragTarget = 'panel';
    hasMoved = false;
    const pos = getXY(e);
    if (!pos) return;
    dragStartX = pos.x; dragStartY = pos.y;
    dragStartLeft = 位置.panelLeft; dragStartTop = 位置.panelTop;
    // 面板开始拖动即断开跟随（在 dragStart 就设，防 watcher 覆盖）
    位置.panelManuallyPositioned = true;
    $head.addClass('is-dragging');
    $panel.addClass('lh-panel-dragging');
    e.preventDefault();
  }

  function onDragMove(e: JQuery.TriggeredEvent) {
    if (!dragTarget) return;
    const pos = getXY(e);
    if (!pos) return;
    const dx = pos.x - dragStartX;
    const dy = pos.y - dragStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) hasMoved = true;

    if (dragTarget === 'fab') {
      位置.fabLeft = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragStartLeft + dx));
      位置.fabTop = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragStartTop + dy));
      $fab.css({ left: 位置.fabLeft + 'px', top: 位置.fabTop + 'px' });
      // 面板跟随悬浮球
      if (panelVisible && !位置.panelManuallyPositioned) {
        位置.panelLeft = computePanelLeft();
        位置.panelTop = computePanelTop();
        $panel.css({ left: 位置.panelLeft + 'px', top: 位置.panelTop + 'px' });
      }
    } else if (dragTarget === 'panel') {
      位置.panelLeft = Math.max(-PANEL_WIDTH + PANEL_MIN_VISIBLE, Math.min(window.innerWidth - PANEL_MIN_VISIBLE, dragStartLeft + dx));
      位置.panelTop = Math.max(0, Math.min(window.innerHeight - PANEL_MIN_VISIBLE, dragStartTop + dy));
      $panel.css({ left: 位置.panelLeft + 'px', top: 位置.panelTop + 'px' });
    }
  }

  function onDragEnd() {
    if (!dragTarget) return;
    if (dragTarget === 'fab') {
      $fab.removeClass('is-dragging');
      if (!hasMoved) {
        // 点击 → 切换面板
        panelVisible ? closePanel() : openPanel();
      }
    } else if (dragTarget === 'panel') {
      $head.removeClass('is-dragging');
      $panel.removeClass('lh-panel-dragging');
    }
    dragTarget = null;
    写位置();
  }

  $fab.on('mousedown touchstart', onFabDown);
  $head.on('mousedown touchstart', onPanelDown);
  $close.on('mousedown', (e: JQuery.TriggeredEvent) => { e.stopPropagation(); });
  $close.on('click', () => closePanel());
  $(document).on('mousemove.lh touchmove.lh', onDragMove);
  $(document).on('mouseup.lh touchend.lh', onDragEnd);

  // ══════════════════════════════════════════════════════════
  // 12. 窗口缩放 → 约束边界
  // ══════════════════════════════════════════════════════════
  $(window).on('resize.lh', () => {
    位置.fabLeft = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, 位置.fabLeft));
    位置.fabTop = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, 位置.fabTop));
    $fab.css({ left: 位置.fabLeft + 'px', top: 位置.fabTop + 'px' });
    if (panelVisible) {
      if (!位置.panelManuallyPositioned) {
        位置.panelLeft = computePanelLeft();
        位置.panelTop = computePanelTop();
      } else {
        位置.panelLeft = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, 位置.panelLeft));
        位置.panelTop = Math.max(0, Math.min(window.innerHeight - PANEL_MIN_VISIBLE, 位置.panelTop));
      }
      $panel.css({ left: 位置.panelLeft + 'px', top: 位置.panelTop + 'px' });
    }
    写位置();
  });

  // ══════════════════════════════════════════════════════════
  // 13. 初始化
  // ══════════════════════════════════════════════════════════
  console.log('[立绘悬浮窗] 已加载 jQuery版, 脚本ID:', 标记,
    '位置:', 位置.fabLeft + ',' + 位置.fabTop,
    '窗口:', window.innerWidth + 'x' + window.innerHeight);
  toastr.success('立绘悬浮窗已加载，点击🖼展开', '');

  // ══════════════════════════════════════════════════════════
  // 14. 卸载
  // ══════════════════════════════════════════════════════════
  $(window).on('pagehide', () => {
    写位置();
    $(`[script_id="${标记}"]`).remove();
    $(document).off('.lh');
    $(window).off('.lh');
  });
});
