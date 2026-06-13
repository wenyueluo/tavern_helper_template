/**
 * 立绘展示悬浮窗 —— 酒馆助手脚本（纯 jQuery 版）
 *
 * 【关键教训】
 *   1. 脚本跑在 0x0 隐藏 iframe 里，window.innerWidth/innerHeight 不可靠
 *      → 视口尺寸用 viewportW()/viewportH()（读 window.parent）
 *   2. 全局事件（mousemove/mouseup/resize）必须绑在 $fab[0].ownerDocument
 *      （父页面文档），否则点击/拖动失效
 *   3. 初始定位用 CSS，不依赖 innerWidth，保证可见
 *
 * 【功能】
 *   1. 可拖动悬浮球（位置持久化）
 *   2. 点击悬浮球展开立绘面板，面板默认停靠在悬浮球所在侧的顶部角落
 *   3. 面板可拖动（标题栏），拖动后独立；关闭再打开重新停靠
 *   4. ⚙ 设置按钮：切换悬浮球/面板在页面左侧还是右侧
 *   5. 点击立绘大图 → 全屏放大查看细节
 *   6. 5 个分类标签 + 版本切换按钮
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
const DOCK_TOP = 60; // 面板/悬浮球停靠时距顶部像素
const DOCK_GAP = 8;  // 悬浮球与面板之间的间隙
const EDGE = 16;     // 距屏幕边缘像素

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
// 3. 持久化（脚本变量）
// ══════════════════════════════════════════════════════════════
interface SavedPos {
  fabLeft?: number; fabTop?: number;
  panelLeft?: number; panelTop?: number;
  panelManuallyPositioned?: boolean;
  side?: 'left' | 'right';
}
function 读位置(): SavedPos {
  try { return (getVariables({ type: 'script' }) as SavedPos) || {}; } catch { return {}; }
}
function 写位置(p: SavedPos) {
  try { insertOrAssignVariables({ ...p }, { type: 'script' }); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════
// 4. 样式
// ══════════════════════════════════════════════════════════════
const 样式 = `
.lh-fab {
  position:fixed; right:16px; top:40%; width:46px; height:46px; border-radius:50%;
  background:#1b1030; border:1px solid rgba(167,139,250,.4); color:#c4b5fd;
  font-size:22px; display:flex; align-items:center; justify-content:center;
  cursor:grab; user-select:none; touch-action:none; z-index:2147483647;
  box-shadow:0 0 16px rgba(167,139,250,.35), 0 3px 12px rgba(0,0,0,.5);
  transition:filter .15s, box-shadow .2s;
}
/* 仅 ⚙ 切换时给位置加缓动；拖动/展开时无过渡保证跟手 */
.lh-fab.lh-anim, .lh-panel.lh-anim { transition:left .25s ease, top .25s ease; }
.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 26px rgba(167,139,250,.55); }
.lh-fab.is-dragging { cursor:grabbing; }
.lh-panel {
  position:fixed; right:16px; top:60px;
  width:280px; background:#120c1f;
  border:1px solid rgba(167,139,250,.3); border-radius:14px;
  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:2147483645;
  display:none; flex-direction:column; overflow:hidden; color:#e9e3ff;
  font-family:'Segoe UI',system-ui,sans-serif;
}
.lh-panel.lh-visible { display:flex; }
.lh-head {
  display:flex; align-items:center; justify-content:space-between; gap:6px;
  padding:8px 12px; font-size:13px;
  border-bottom:1px solid rgba(167,139,250,.15); cursor:move; user-select:none;
}
.lh-head.is-dragging { cursor:grabbing; }
.lh-head-title { flex:1; }
.lh-head-btns { display:flex; align-items:center; gap:4px; }
.lh-gear, .lh-close { cursor:pointer; width:22px; height:22px; line-height:22px;
  text-align:center; border-radius:6px; color:#c4b5fd; font-size:13px; }
.lh-gear:hover, .lh-close:hover { background:rgba(167,139,250,.2); }
.lh-side-hint { font-size:10px; color:#8a7fb5; margin-left:4px; }
.lh-categories { display:flex; flex-wrap:wrap; gap:4px; padding:6px 10px;
  border-bottom:1px solid rgba(167,139,250,.15); }
.lh-cat-tab { flex:1; min-width:48px; padding:4px 2px; font-size:11px;
  text-align:center; cursor:pointer; border-radius:6px;
  color:rgba(255,255,255,.5); transition:background .15s, color .15s; }
.lh-cat-tab:hover { color:#c4b5fd; background:rgba(167,139,250,.1); }
.lh-cat-tab.active { color:#e9e3ff; background:rgba(167,139,250,.15); font-weight:600; }
.lh-img-wrap { width:100%; aspect-ratio:2/3; background:#0a0712;
  display:flex; align-items:center; justify-content:center; overflow:hidden;
  cursor:zoom-in; position:relative; }
.lh-img-wrap::after { content:'🔍 点击放大'; position:absolute; bottom:8px; right:8px;
  font-size:10px; color:#c4b5fd; background:rgba(18,12,31,.7); padding:2px 8px;
  border-radius:10px; opacity:0; transition:opacity .2s; pointer-events:none; }
.lh-img-wrap:hover::after { opacity:1; }
.lh-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
.lh-btns { display:flex; flex-wrap:wrap; gap:6px; padding:10px; }
.lh-btn { flex:1 1 auto; min-width:56px; padding:6px 10px; font-size:11px;
  text-align:center; cursor:pointer; border-radius:8px;
  border:1px solid rgba(167,139,250,.25); background:rgba(167,139,250,.08);
  color:#d6ccff; transition:background .15s, border-color .15s; white-space:nowrap; }
.lh-btn:hover { background:rgba(167,139,250,.2); }
.lh-btn.active { background:#a78bfa; border-color:#a78bfa; color:#1b1030; font-weight:600; }
.lh-fab.is-dragging *, .lh-panel-dragging * { user-select:none; }
/* ── 全屏放大遮罩 ── */
.lh-zoom { position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:2147483647;
  display:none; align-items:center; justify-content:center;
  overflow:hidden; box-sizing:border-box; backdrop-filter:blur(2px); }
.lh-zoom.lh-zoom-show { display:flex; }
.lh-zoom img { max-width:90vw; max-height:90vh; object-fit:contain; border-radius:8px;
  box-shadow:0 0 60px rgba(167,139,250,.3), 0 0 30px rgba(0,0,0,.8);
  transform-origin:center center; cursor:zoom-in; user-select:none;
  -webkit-user-drag:none; will-change:transform; touch-action:none; }
.lh-zoom img.lh-zoom-grab { cursor:grab; }
.lh-zoom img.lh-zoom-grabbing { cursor:grabbing; }
.lh-zoom-close { position:absolute; top:18px; right:24px; width:40px; height:40px;
  line-height:38px; text-align:center; font-size:22px; color:#e9e3ff; cursor:pointer;
  border:1px solid rgba(167,139,250,.4); border-radius:50%; background:rgba(18,12,31,.6); z-index:2; }
.lh-zoom-close:hover { background:rgba(167,139,250,.25); }
.lh-zoom-cap { position:absolute; bottom:24px; left:50%; transform:translateX(-50%);
  color:#c4b5fd; font-size:13px; letter-spacing:1px; background:rgba(18,12,31,.7);
  padding:4px 16px; border-radius:14px; z-index:2; }
.lh-zoom-tip { position:absolute; top:18px; left:24px;
  color:#8a7fb5; font-size:11px; letter-spacing:.5px; background:rgba(18,12,31,.6);
  padding:4px 12px; border-radius:12px; z-index:2; pointer-events:none; }
`;

// ══════════════════════════════════════════════════════════════
// 5. 构建
// ══════════════════════════════════════════════════════════════
$(() => {
  $('<style>').attr('script_id', 标记).text(样式).appendTo('head');

  // ── 预加载所有立绘到浏览器缓存（每张约2MB，避免切换时现下载导致延迟）──
  const preloaded: HTMLImageElement[] = [];
  categories.forEach((c) => c.items.forEach((it) => {
    const im = new Image();
    im.src = it.url;
    preloaded.push(im); // 持有引用，防止被 GC 提前回收
  }));
  console.log('[立绘悬浮窗] 开始预加载', preloaded.length, '张立绘');

  const saved = 读位置();
  let side: 'left' | 'right' = saved.side === 'left' ? 'left' : 'right';

  function validCoord(left: unknown, top: unknown): boolean {
    if (typeof left !== 'number' || typeof top !== 'number') return false;
    if (!isFinite(left) || !isFinite(top)) return false;
    return left >= -4 && top >= -4 && left <= viewportW() - 10 && top <= viewportH() - 10;
  }

  // ── 悬浮球 ──
  const $fab = $('<div>').attr('script_id', 标记).addClass('lh-fab').text('🖼').appendTo('body');
  if (validCoord(saved.fabLeft, saved.fabTop)) {
    $fab.css({ left: saved.fabLeft + 'px', top: saved.fabTop + 'px', right: 'auto' });
  } else {
    // 无有效存储 → 按 side 设置默认靠边
    if (side === 'left') $fab.css({ left: '16px', right: 'auto' });
    if (saved.fabLeft !== undefined) 写位置({ fabLeft: undefined, fabTop: undefined });
  }

  // ── 面板 ──
  const $panel = $('<div>').attr('script_id', 标记).addClass('lh-panel').appendTo('body');
  let panelManuallyPositioned = saved.panelManuallyPositioned === true
    && validCoord(saved.panelLeft, saved.panelTop);
  if (panelManuallyPositioned) {
    $panel.css({ left: saved.panelLeft + 'px', top: saved.panelTop + 'px', right: 'auto' });
  }

  // 标题栏：标题 + [⚙设置] [✕关闭]
  const $head = $('<div>').addClass('lh-head').appendTo($panel);
  $('<span>').addClass('lh-head-title').text('立绘展示').appendTo($head);
  const $headBtns = $('<div>').addClass('lh-head-btns').appendTo($head);
  const $gear = $('<span>').addClass('lh-gear').attr('title', '切换左右侧').text('⚙').appendTo($headBtns);
  const $close = $('<span>').addClass('lh-close').attr('title', '关闭').text('✕').appendTo($headBtns);

  const $cats = $('<div>').addClass('lh-categories').appendTo($panel);
  const $imgWrap = $('<div>').addClass('lh-img-wrap').appendTo($panel);
  const $img = $('<img>').addClass('lh-img').appendTo($imgWrap);
  const $btns = $('<div>').addClass('lh-btns').appendTo($panel);

  // ── 全屏放大遮罩 ──
  const $zoom = $('<div>').attr('script_id', 标记).addClass('lh-zoom').appendTo('body');
  const $zoomClose = $('<span>').addClass('lh-zoom-close').text('✕').appendTo($zoom);
  const $zoomImg = $('<img>').appendTo($zoom);
  const $zoomCap = $('<div>').addClass('lh-zoom-cap').appendTo($zoom);
  $('<div>').addClass('lh-zoom-tip').text('滚轮缩放 · 拖动平移 · 双击复位').appendTo($zoom);

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
        .text(it.name)
        .on('click', (e) => {
          e.stopPropagation();
          itemIdx = i;
          renderBtns(); updateImg();
        })
        .appendTo($btns);
    });
  }
  function updateImg() { $img.attr('src', item().url).attr('alt', item().name); }

  // ── 算出「球 + 面板」的最终位置 ──
  //   水平方向完全由 side 决定（确定性，不依赖球的残留 left，避免重开漂移）；
  //   垂直方向以球当前 top 为锚。两者一次性定好。
  //   side='right' → 球在右上角(靠右边)，面板在球左侧
  //   side='left'  → 球在左上角(靠左边)，面板在球右侧
  function layoutDocked() {
    const fr = fabRect();
    const fabTop = Math.max(EDGE, Math.min(viewportH() - 120, fr.top || EDGE));

    let fabLeft: number, panelLeft: number;
    if (side === 'right') {
      fabLeft = viewportW() - FAB_SIZE - EDGE;             // 球靠右边
      panelLeft = fabLeft - DOCK_GAP - PANEL_WIDTH;        // 面板在球左侧
      if (panelLeft < EDGE) panelLeft = EDGE;
    } else {
      fabLeft = EDGE;                                      // 球靠左边
      panelLeft = fabLeft + FAB_SIZE + DOCK_GAP;           // 面板在球右侧
      if (panelLeft + PANEL_WIDTH > viewportW() - EDGE) panelLeft = viewportW() - EDGE - PANEL_WIDTH;
    }
    const panelTop = fabTop; // 顶边对齐

    $fab.css({ left: fabLeft + 'px', top: fabTop + 'px', right: 'auto' });
    $panel.css({ left: panelLeft + 'px', top: panelTop + 'px', right: 'auto' });
  }

  function openPanel() {
    $panel.addClass('lh-visible'); // 先可见，rect 才有效
    panelVisible = true;
    layoutDocked();                // 一次性定好球和面板位置
    renderCats(); renderBtns(); updateImg();
  }
  function closePanel() {
    $panel.removeClass('lh-visible');
    panelVisible = false;
    panelManuallyPositioned = false;
    写位置({ panelManuallyPositioned: false });
  }

  // ── 放大查看（滚轮缩放 + 拖动平移 + 双击复位）──
  let zScale = 1, zX = 0, zY = 0;            // 当前缩放/平移
  const Z_MIN = 1, Z_MAX = 6;
  function applyZoom() {
    (($zoomImg[0] as HTMLElement)).style.transform =
      `translate(${zX}px, ${zY}px) scale(${zScale})`;
    $zoomImg.toggleClass('lh-zoom-grab', zScale > 1);
  }
  function resetZoom() { zScale = 1; zX = 0; zY = 0; applyZoom(); }

  function openZoom() {
    $zoomImg.attr('src', item().url).attr('alt', item().name);
    $zoomCap.text(cat().name + ' · ' + item().name);
    resetZoom();
    $zoom.addClass('lh-zoom-show');
  }
  function closeZoom() { $zoom.removeClass('lh-zoom-show'); }
  $imgWrap.on('click', openZoom);
  $zoom.on('click', closeZoom);                       // 点遮罩空白处关闭
  $zoomImg.on('click', (e) => e.stopPropagation());   // 点图片本身不关闭
  $zoomClose.on('click', closeZoom);

  // 滚轮缩放（以鼠标位置为中心）
  $zoomImg.on('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    const oe = e.originalEvent as WheelEvent;
    const rect = ($zoomImg[0] as HTMLElement).getBoundingClientRect();
    // 鼠标相对图片中心的偏移（缩放前）
    const cx = oe.clientX - (rect.left + rect.width / 2);
    const cy = oe.clientY - (rect.top + rect.height / 2);
    const prev = zScale;
    const factor = oe.deltaY < 0 ? 1.15 : 1 / 1.15;
    zScale = Math.max(Z_MIN, Math.min(Z_MAX, zScale * factor));
    const ratio = zScale / prev;
    // 让鼠标指向的点保持不动
    zX = (zX - cx) * ratio + cx;
    zY = (zY - cy) * ratio + cy;
    if (zScale === 1) { zX = 0; zY = 0; }
    applyZoom();
  });

  // 拖动平移（放大后）
  let zDragging = false, zSX = 0, zSY = 0, zOX = 0, zOY = 0;
  $zoomImg.on('mousedown touchstart', (e) => {
    if (zScale <= 1) return;
    const oe = e.originalEvent as MouseEvent | TouchEvent;
    const p = oe instanceof TouchEvent ? (oe.touches[0] ?? oe.changedTouches[0]) : oe;
    if (!p) return;
    zDragging = true; zSX = p.clientX; zSY = p.clientY; zOX = zX; zOY = zY;
    $zoomImg.addClass('lh-zoom-grabbing');
    e.preventDefault(); e.stopPropagation();
  });
  // 双击复位
  $zoomImg.on('dblclick', (e) => { e.stopPropagation(); resetZoom(); });

  // ── ⚙ 切换左右侧 ──
  $gear.on('mousedown', (e) => e.stopPropagation()); // 别触发面板拖动
  $gear.on('click', (e) => {
    e.stopPropagation();
    side = side === 'right' ? 'left' : 'right';
    // 带动画地重排
    $fab.addClass('lh-anim'); $panel.addClass('lh-anim');
    if (panelVisible) {
      layoutDocked(); // 球+面板按新 side 确定性重排
    } else {
      const left = side === 'right' ? (viewportW() - FAB_SIZE - EDGE) : EDGE;
      const r = fabRect();
      $fab.css({ left: left + 'px', top: r.top + 'px', right: 'auto' });
    }
    setTimeout(() => { $fab.removeClass('lh-anim'); $panel.removeClass('lh-anim'); }, 300);
    // 保存 side + 目标坐标（读 style 设定值，不受动画过渡中间态影响）
    const save: SavedPos = { side };
    save.fabLeft = parseFloat($fab.css('left')) || 0;
    save.fabTop = parseFloat($fab.css('top')) || 0;
    if (panelVisible) {
      save.panelLeft = parseFloat($panel.css('left')) || 0;
      save.panelTop = parseFloat($panel.css('top')) || 0;
    }
    写位置(save);
    toastr.info('悬浮球已切换到' + (side === 'right' ? '右侧' : '左侧'), '');
  });

  // ══════════════════════════════════════════════════════════
  // 6. 拖动
  // ══════════════════════════════════════════════════════════
  let dragTarget: 'fab' | 'panel' | null = null;
  let startX = 0, startY = 0, moved = false;
  // 拖动开始时同时记录悬浮球与面板的起始坐标（用于整体联动）
  let fabStartLeft = 0, fabStartTop = 0, panelStartLeft = 0, panelStartTop = 0;

  function getXY(e: JQuery.TriggeredEvent): { x: number; y: number } | null {
    const oe = e.originalEvent;
    if (oe instanceof TouchEvent) {
      const t = oe.touches[0] ?? oe.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: (oe as MouseEvent).clientX, y: (oe as MouseEvent).clientY };
  }

  function fabRect() { return ($fab[0] as HTMLElement).getBoundingClientRect(); }
  function panelRect() { return ($panel[0] as HTMLElement).getBoundingClientRect(); }

  function recordStarts(pos: { x: number; y: number }) {
    startX = pos.x; startY = pos.y; moved = false;
    // 清掉可能残留的切换动画类，保证拖动 100% 跟手无缓动
    $fab.removeClass('lh-anim'); $panel.removeClass('lh-anim');
    const fr = fabRect(), pr = panelRect();
    fabStartLeft = fr.left; fabStartTop = fr.top;
    panelStartLeft = pr.left; panelStartTop = pr.top;
  }

  $fab.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'fab'; recordStarts(pos);
    $fab.addClass('is-dragging');
    e.preventDefault();
  });

  $head.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'panel'; recordStarts(pos);
    $head.addClass('is-dragging'); $panel.addClass('lh-panel-dragging');
    e.preventDefault();
  });

  $close.on('mousedown', (e) => e.stopPropagation());
  $close.on('click', (e) => { e.stopPropagation(); closePanel(); });

  const ownerDoc = ($fab[0] as HTMLElement).ownerDocument || document;
  const ownerWin = ownerDoc.defaultView || window;
  const $doc = $(ownerDoc);
  const $win = $(ownerWin);

  // ── 放大图的拖动平移（全局 move/up）──
  $doc.on('mousemove.lhzoom touchmove.lhzoom', (e) => {
    if (!zDragging) return;
    const oe = e.originalEvent as MouseEvent | TouchEvent;
    const p = oe instanceof TouchEvent ? (oe.touches[0] ?? oe.changedTouches[0]) : oe;
    if (!p) return;
    zX = zOX + (p.clientX - zSX);
    zY = zOY + (p.clientY - zSY);
    applyZoom();
    e.preventDefault();
  });
  $doc.on('mouseup.lhzoom touchend.lhzoom', () => {
    if (!zDragging) return;
    zDragging = false;
    $zoomImg.removeClass('lh-zoom-grabbing');
  });

  $doc.on('mousemove.lh touchmove.lh', (e) => {
    if (!dragTarget) return;
    const pos = getXY(e); if (!pos) return;
    const dx = pos.x - startX, dy = pos.y - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;

    // 面板打开时：悬浮球和面板作为整体一起移动（拖任意一个，另一个同步位移）
    if (panelVisible) {
      const fl = Math.max(0, Math.min(viewportW() - FAB_SIZE, fabStartLeft + dx));
      const ft = Math.max(0, Math.min(viewportH() - FAB_SIZE, fabStartTop + dy));
      const pl = panelStartLeft + (fl - fabStartLeft);
      const pt = panelStartTop + (ft - fabStartTop);
      $fab.css({ left: fl + 'px', top: ft + 'px', right: 'auto' });
      $panel.css({ left: pl + 'px', top: pt + 'px', right: 'auto' });
    } else {
      // 面板关闭：只动悬浮球
      const fl = Math.max(0, Math.min(viewportW() - FAB_SIZE, fabStartLeft + dx));
      const ft = Math.max(0, Math.min(viewportH() - FAB_SIZE, fabStartTop + dy));
      $fab.css({ left: fl + 'px', top: ft + 'px', right: 'auto' });
    }
  });

  $doc.on('mouseup.lh touchend.lh', () => {
    if (!dragTarget) return;
    $fab.removeClass('is-dragging');
    $head.removeClass('is-dragging'); $panel.removeClass('lh-panel-dragging');

    if (dragTarget === 'fab' && !moved) {
      // 没拖动 = 点击 → 开/关面板
      panelVisible ? closePanel() : openPanel();
    } else {
      const fr = fabRect();
      // 根据悬浮球落点更新 side
      side = (fr.left + FAB_SIZE / 2) > viewportW() / 2 ? 'right' : 'left';
      const save: SavedPos = { fabLeft: fr.left, fabTop: fr.top, side };
      if (panelVisible) {
        const pr = panelRect();
        save.panelLeft = pr.left; save.panelTop = pr.top;
      }
      写位置(save);
    }
    dragTarget = null;
  });

  // ── 窗口缩放 ──
  $win.on('resize.lh', () => {
    const r = fabRect();
    const left = Math.max(0, Math.min(viewportW() - FAB_SIZE, r.left));
    const top = Math.max(0, Math.min(viewportH() - FAB_SIZE, r.top));
    $fab.css({ left: left + 'px', top: top + 'px', right: 'auto' });
    if (panelVisible) {
      if (!panelManuallyPositioned) dockPanel();
      else {
        const pr = ($panel[0] as HTMLElement).getBoundingClientRect();
        $panel.css({
          left: Math.max(0, Math.min(viewportW() - PANEL_WIDTH, pr.left)) + 'px',
          top: Math.max(0, Math.min(viewportH() - PANEL_MIN_VISIBLE, pr.top)) + 'px',
          right: 'auto',
        });
      }
    }
  });

  // ── 兜底自检：屏外拉回 ──
  function ensureVisible() {
    const el = $fab[0] as HTMLElement;
    const r = el.getBoundingClientRect();
    const vw = viewportW(), vh = viewportH();
    const offscreen = r.width === 0 || r.height === 0
      || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh;
    if (offscreen) {
      $fab.css({ left: (vw - FAB_SIZE - 16) + 'px', top: Math.round(vh * 0.4) + 'px', right: 'auto' });
    }
  }
  ensureVisible();
  setTimeout(ensureVisible, 500);

  console.log('[立绘悬浮窗] jQuery版已挂载, side:', side,
    '主视口:', viewportW() + 'x' + viewportH());
  toastr.success('立绘悬浮窗已加载，点击右侧🖼展开', '');

  // ── 卸载 ──
  $(window).on('pagehide', () => {
    $(`[script_id="${标记}"]`).remove();
    $doc.off('.lh'); $doc.off('.lhzoom');
    $win.off('.lh');
  });
});
