/**
 * 立绘展示悬浮窗 —— 酒馆助手脚本（纯 jQuery 版）
 *
 * 【设计原则：硬绑定 + 独立记录 + 零自动跳转】
 *   - 悬浮球：独立位置，拖动即存，加载即恢复，永不自动移动
 *   - 面板：  独立位置，拖动即存，加载/打开都用自己存的位置，永不自动移动
 *   - 点击球：只切换面板显示/隐藏，谁的位置都不动
 *   - 没有 ⚙ 切换、没有 side、没有自动布局/跟随/联动
 *
 * 【关键环境约束】
 *   1. 脚本跑在 0x0 隐藏 iframe，window.innerWidth 不可靠 → viewportW/H 读父窗口
 *   2. 全局事件绑到 $fab[0].ownerDocument（父页面），否则拖动失效
 *   3. 初始位置：有存储用存储，无存储用 CSS 默认（不依赖 innerWidth）
 */

// ══════════════════════════════════════════════════════════════
// 1. 立绘数据
// ══════════════════════════════════════════════════════════════
const ILLUST_BASE = 'https://raw.githubusercontent.com/wenyueluo/sillytraven/main/%E6%AD%A3%E5%A4%AA%E6%8E%A7%E9%83%BD%E7%BB%99%E6%88%91%E6%BB%9A';

interface Illustration { name: string; url: string }
interface Category { name: string; items: Illustration[] }

const categories: Category[] = [
  {
    name: '颜舒',
    items: [
      { name: '制服', url: `${ILLUST_BASE}/yan_shu_uniform.png` },
      { name: '外出', url: `${ILLUST_BASE}/yan_shu_outing.png` },
      { name: '日常', url: `${ILLUST_BASE}/yan_shu_daily.png` },
      { name: '赤裸', url: `${ILLUST_BASE}/yan_shu_nude.png` },
      { name: '口交', url: `${ILLUST_BASE}/yan_shu_blowjob.png` },
      { name: '性交', url: `${ILLUST_BASE}/yan_shu_sex.png` },
    ],
  },
  {
    name: '周晚',
    items: [
      { name: '制服', url: `${ILLUST_BASE}/zhou_wan_uniform.png` },
      { name: '外出', url: `${ILLUST_BASE}/zhou_wan_outing.png` },
      { name: '日常', url: `${ILLUST_BASE}/zhou_wan_daily.png` },
      { name: '赤裸', url: `${ILLUST_BASE}/zhou_wan_nude.png` },
      { name: '口交', url: `${ILLUST_BASE}/zhou_wan_blowjob.png` },
      { name: '足交', url: `${ILLUST_BASE}/zhou_wan_footjob.png` },
      { name: '性交', url: `${ILLUST_BASE}/zhou_wan_sex.png` },
    ],
  },
  {
    name: '周敏',
    items: [
      { name: '制服', url: `${ILLUST_BASE}/zhou_min_uniform.png` },
      { name: '外出', url: `${ILLUST_BASE}/zhou_min_outing.png` },
      { name: '日常', url: `${ILLUST_BASE}/zhou_min_daily.png` },
      { name: '赤裸', url: `${ILLUST_BASE}/zhou_min_nude.png` },
      { name: '口交', url: `${ILLUST_BASE}/zhou_min_blowjob.png` },
      { name: '足交', url: `${ILLUST_BASE}/zhou_min_footjob.png` },
      { name: '性交', url: `${ILLUST_BASE}/zhou_min_sex.png` },
    ],
  },
  {
    name: '颜知遥',
    items: [
      { name: '概念图', url: `${ILLUST_BASE}/yan_zhiyao_concept.png` },
      { name: '赤裸', url: `${ILLUST_BASE}/yan_zhiyao_nude.png` },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// 2. 常量
// ══════════════════════════════════════════════════════════════
const 标记 = getScriptId();
const PANEL_WIDTH = 280;
const FAB_SIZE = 46;
const DRAG_THRESHOLD = 4;
const PANEL_MIN_W = 200;   // 面板最小宽
const PANEL_MIN_H = 240;   // 面板最小高
const PANEL_MAX_W = 720;   // 面板最大宽
const PANEL_MAX_H = 960;   // 面板最大高

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
// 3. 持久化（脚本变量）—— 球和面板各自独立的坐标
// ══════════════════════════════════════════════════════════════
interface SavedPos {
  fabLeft?: number; fabTop?: number;
  panelLeft?: number; panelTop?: number;
  panelW?: number; panelH?: number;
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
  cursor:grab; user-select:none; touch-action:none; z-index:2147483646;
  box-shadow:0 0 16px rgba(167,139,250,.35), 0 3px 12px rgba(0,0,0,.5);
  transition:filter .15s, box-shadow .2s;
}
.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 26px rgba(167,139,250,.55); }
.lh-fab.is-dragging { cursor:grabbing; }
.lh-panel {
  position:fixed; right:74px; top:60px;
  width:280px; background:#120c1f;
  border:1px solid rgba(167,139,250,.3); border-radius:14px;
  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:2147483645;
  display:none; flex-direction:column; overflow:hidden; color:#e9e3ff;
  font-family:'Segoe UI',system-ui,sans-serif;
}
.lh-panel.lh-visible { display:flex; }
.lh-panel.lh-resizing { user-select:none; }
/* ── 八向拉伸把手 ── */
.lh-rz { position:absolute; z-index:5; touch-action:none; }
.lh-rz-n  { top:-4px; left:8px; right:8px; height:8px; cursor:ns-resize; }
.lh-rz-s  { bottom:-4px; left:8px; right:8px; height:8px; cursor:ns-resize; }
.lh-rz-w  { left:-4px; top:8px; bottom:8px; width:8px; cursor:ew-resize; }
.lh-rz-e  { right:-4px; top:8px; bottom:8px; width:8px; cursor:ew-resize; }
.lh-rz-nw { top:-4px; left:-4px; width:14px; height:14px; cursor:nwse-resize; }
.lh-rz-ne { top:-4px; right:-4px; width:14px; height:14px; cursor:nesw-resize; }
.lh-rz-sw { bottom:-4px; left:-4px; width:14px; height:14px; cursor:nesw-resize; }
.lh-rz-se { bottom:-4px; right:-4px; width:14px; height:14px; cursor:nwse-resize; }
/* 右下角视觉提示纹 */
.lh-rz-se::after { content:''; position:absolute; right:3px; bottom:3px; width:7px; height:7px;
  border-right:2px solid rgba(167,139,250,.5); border-bottom:2px solid rgba(167,139,250,.5); }
.lh-head {
  display:flex; align-items:center; justify-content:space-between; gap:6px;
  padding:8px 12px; font-size:13px;
  border-bottom:1px solid rgba(167,139,250,.15); cursor:move; user-select:none;
}
.lh-head.is-dragging { cursor:grabbing; }
.lh-head-title { flex:1; }
.lh-close { cursor:pointer; width:22px; height:22px; line-height:22px;
  text-align:center; border-radius:6px; color:#c4b5fd; font-size:13px; }
.lh-close:hover { background:rgba(167,139,250,.2); }
.lh-categories { display:flex; flex-wrap:wrap; gap:4px; padding:6px 10px;
  border-bottom:1px solid rgba(167,139,250,.15); }
.lh-cat-tab { flex:1; min-width:48px; padding:4px 2px; font-size:11px;
  text-align:center; cursor:pointer; border-radius:6px;
  color:rgba(255,255,255,.5); transition:background .15s, color .15s; }
.lh-cat-tab:hover { color:#c4b5fd; background:rgba(167,139,250,.1); }
.lh-cat-tab.active { color:#e9e3ff; background:rgba(167,139,250,.15); font-weight:600; }
.lh-img-wrap { width:100%; flex:1 1 auto; min-height:120px; background:#0a0712;
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

  // 预加载所有立绘到缓存（每张约2MB，避免切换时现下载）
  const preloaded: HTMLImageElement[] = [];
  categories.forEach((c) => c.items.forEach((it) => {
    const im = new Image(); im.src = it.url; preloaded.push(im);
  }));

  const saved = 读位置();

  // 坐标有效性校验（防旧版坏坐标 / 视口外）
  function validCoord(left: unknown, top: unknown): boolean {
    if (typeof left !== 'number' || typeof top !== 'number') return false;
    if (!isFinite(left) || !isFinite(top)) return false;
    return left >= -4 && top >= -4 && left <= viewportW() - 10 && top <= viewportH() - 10;
  }

  // ── 悬浮球：恢复存储位置，无存储用 CSS 默认 ──
  const $fab = $('<div>').attr('script_id', 标记).addClass('lh-fab').text('🖼').appendTo('body');
  if (validCoord(saved.fabLeft, saved.fabTop)) {
    $fab.css({ left: saved.fabLeft + 'px', top: saved.fabTop + 'px', right: 'auto' });
  } else if (saved.fabLeft !== undefined) {
    写位置({ fabLeft: undefined, fabTop: undefined }); // 清坏坐标
  }

  // ── 面板：恢复存储位置，无存储用 CSS 默认 ──
  const $panel = $('<div>').attr('script_id', 标记).addClass('lh-panel').appendTo('body');
  if (validCoord(saved.panelLeft, saved.panelTop)) {
    $panel.css({ left: saved.panelLeft + 'px', top: saved.panelTop + 'px', right: 'auto' });
  } else if (saved.panelLeft !== undefined) {
    写位置({ panelLeft: undefined, panelTop: undefined });
  }
  // ── 面板尺寸：恢复存储的宽高（带范围校验）──
  if (typeof saved.panelW === 'number' && isFinite(saved.panelW)) {
    $panel.css('width', Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, saved.panelW)) + 'px');
  }
  if (typeof saved.panelH === 'number' && isFinite(saved.panelH)) {
    $panel.css('height', Math.max(PANEL_MIN_H, Math.min(PANEL_MAX_H, saved.panelH)) + 'px');
  }

  // 标题栏：标题 + [✕关闭]（没有 ⚙ 切换按钮）
  const $head = $('<div>').addClass('lh-head').appendTo($panel);
  $('<span>').addClass('lh-head-title').text('立绘展示').appendTo($head);
  const $close = $('<span>').addClass('lh-close').attr('title', '关闭').text('✕').appendTo($head);

  const $cats = $('<div>').addClass('lh-categories').appendTo($panel);
  const $imgWrap = $('<div>').addClass('lh-img-wrap').appendTo($panel);
  const $img = $('<img>').addClass('lh-img').appendTo($imgWrap);
  const $btns = $('<div>').addClass('lh-btns').appendTo($panel);

  // ── 八向拉伸把手（N/S/W/E + 四角）──
  const RZ_DIRS = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'] as const;
  RZ_DIRS.forEach((d) => {
    $('<div>').addClass('lh-rz lh-rz-' + d).attr('data-rz', d).appendTo($panel);
  });

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
        .text(c.name).on('click', (e) => { e.stopPropagation(); switchCat(i); }).appendTo($cats);
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
        .text(it.name).on('click', (e) => { e.stopPropagation(); itemIdx = i; renderBtns(); updateImg(); })
        .appendTo($btns);
    });
  }
  function updateImg() { $img.attr('src', item().url).attr('alt', item().name); }

  // ── 打开/关闭面板：只切显示，不动任何位置 ──
  function openPanel() {
    $panel.addClass('lh-visible');
    panelVisible = true;
    renderCats(); renderBtns(); updateImg();
  }
  function closePanel() {
    $panel.removeClass('lh-visible');
    panelVisible = false;
  }

  // ══════════════════════════════════════════════════════════
  // 6. 放大查看（滚轮缩放 + 拖动平移 + 双击复位）
  // ══════════════════════════════════════════════════════════
  let zScale = 1, zX = 0, zY = 0;
  const Z_MIN = 1, Z_MAX = 6;
  function applyZoom() {
    ($zoomImg[0] as HTMLElement).style.transform = `translate(${zX}px, ${zY}px) scale(${zScale})`;
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
  $zoom.on('click', closeZoom);
  $zoomImg.on('click', (e) => e.stopPropagation());
  $zoomClose.on('click', closeZoom);

  $zoomImg.on('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    const oe = e.originalEvent as WheelEvent;
    const rect = ($zoomImg[0] as HTMLElement).getBoundingClientRect();
    const cx = oe.clientX - (rect.left + rect.width / 2);
    const cy = oe.clientY - (rect.top + rect.height / 2);
    const prev = zScale;
    const factor = oe.deltaY < 0 ? 1.15 : 1 / 1.15;
    zScale = Math.max(Z_MIN, Math.min(Z_MAX, zScale * factor));
    const ratio = zScale / prev;
    zX = (zX - cx) * ratio + cx;
    zY = (zY - cy) * ratio + cy;
    if (zScale === 1) { zX = 0; zY = 0; }
    applyZoom();
  });

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
  $zoomImg.on('dblclick', (e) => { e.stopPropagation(); resetZoom(); });

  // ══════════════════════════════════════════════════════════
  // 7. 拖动 —— 球和面板完全独立，各拖各的，各存各的
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
  function rectOf($el: JQuery) { return ($el[0] as HTMLElement).getBoundingClientRect(); }

  $fab.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'fab'; moved = false;
    const r = rectOf($fab);
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    $fab.addClass('is-dragging');
    e.preventDefault();
  });

  $head.on('mousedown touchstart', (e) => {
    const pos = getXY(e); if (!pos) return;
    dragTarget = 'panel'; moved = false;
    const r = rectOf($panel);
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    $head.addClass('is-dragging'); $panel.addClass('lh-panel-dragging');
    e.preventDefault();
  });

  $close.on('mousedown', (e) => e.stopPropagation());
  $close.on('click', (e) => { e.stopPropagation(); closePanel(); });

  const ownerDoc = ($fab[0] as HTMLElement).ownerDocument || document;
  const ownerWin = ownerDoc.defaultView || window;
  const $doc = $(ownerDoc);
  const $win = $(ownerWin);

  // 放大图平移
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
    zDragging = false; $zoomImg.removeClass('lh-zoom-grabbing');
  });

  // 球/面板拖动
  $doc.on('mousemove.lh touchmove.lh', (e) => {
    if (!dragTarget) return;
    const pos = getXY(e); if (!pos) return;
    const dx = pos.x - startX, dy = pos.y - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;

    const $el = dragTarget === 'fab' ? $fab : $panel;
    const w = dragTarget === 'fab' ? FAB_SIZE : PANEL_WIDTH;
    const minVisible = dragTarget === 'fab' ? FAB_SIZE : 80;
    const left = Math.max(-(w - minVisible), Math.min(viewportW() - minVisible, startLeft + dx));
    const top = Math.max(0, Math.min(viewportH() - minVisible, startTop + dy));
    $el.css({ left: left + 'px', top: top + 'px', right: 'auto' });
  });

  $doc.on('mouseup.lh touchend.lh', () => {
    if (!dragTarget) return;
    if (dragTarget === 'fab') {
      $fab.removeClass('is-dragging');
      if (!moved) {
        panelVisible ? closePanel() : openPanel(); // 点击=开关面板，位置不变
      } else {
        const r = rectOf($fab);
        写位置({ fabLeft: r.left, fabTop: r.top }); // 拖动结束才存球坐标
      }
    } else {
      $head.removeClass('is-dragging'); $panel.removeClass('lh-panel-dragging');
      if (moved) {
        const r = rectOf($panel);
        写位置({ panelLeft: r.left, panelTop: r.top }); // 拖动结束才存面板坐标
      }
    }
    dragTarget = null;
  });

  // ══════════════════════════════════════════════════════════
  // 7.5 面板四边/四角拉伸 —— 改变尺寸，拖动结束存宽高
  // ══════════════════════════════════════════════════════════
  let rzDir: string | null = null;
  let rzSX = 0, rzSY = 0, rzSL = 0, rzST = 0, rzSW = 0, rzSH = 0;

  $panel.on('mousedown touchstart', '.lh-rz', (e) => {
    const pos = getXY(e); if (!pos) return;
    rzDir = String($(e.currentTarget).attr('data-rz') || '');
    const r = rectOf($panel);
    rzSX = pos.x; rzSY = pos.y;
    rzSL = r.left; rzST = r.top; rzSW = r.width; rzSH = r.height;
    $panel.addClass('lh-resizing');
    e.preventDefault(); e.stopPropagation();
  });

  $doc.on('mousemove.lhrz touchmove.lhrz', (e) => {
    if (!rzDir) return;
    const pos = getXY(e); if (!pos) return;
    const dx = pos.x - rzSX, dy = pos.y - rzSY;
    let newL = rzSL, newT = rzST, newW = rzSW, newH = rzSH;

    // 东/西：改宽（西边同时移动 left）
    if (rzDir.indexOf('e') !== -1) {
      newW = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, rzSW + dx));
    }
    if (rzDir.indexOf('w') !== -1) {
      newW = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, rzSW - dx));
      newL = rzSL + (rzSW - newW);
    }
    // 南/北：改高（北边同时移动 top）
    if (rzDir.indexOf('s') !== -1) {
      newH = Math.max(PANEL_MIN_H, Math.min(PANEL_MAX_H, rzSH + dy));
    }
    if (rzDir.indexOf('n') !== -1) {
      newH = Math.max(PANEL_MIN_H, Math.min(PANEL_MAX_H, rzSH - dy));
      newT = rzST + (rzSH - newH);
    }
    $panel.css({
      width: newW + 'px', height: newH + 'px',
      left: newL + 'px', top: newT + 'px', right: 'auto',
    });
    e.preventDefault();
  });

  $doc.on('mouseup.lhrz touchend.lhrz', () => {
    if (!rzDir) return;
    rzDir = null;
    $panel.removeClass('lh-resizing');
    const r = rectOf($panel);
    写位置({ panelLeft: r.left, panelTop: r.top, panelW: r.width, panelH: r.height });
  });

  // ── 窗口缩放：仅把超出视口的元素拉回，不改变相对布局 ──
  $win.on('resize.lh', () => {
    const fr = rectOf($fab);
    $fab.css({
      left: Math.max(0, Math.min(viewportW() - FAB_SIZE, fr.left)) + 'px',
      top: Math.max(0, Math.min(viewportH() - FAB_SIZE, fr.top)) + 'px',
      right: 'auto',
    });
    if (panelVisible) {
      const pr = rectOf($panel);
      $panel.css({
        left: Math.max(0, Math.min(viewportW() - PANEL_WIDTH, pr.left)) + 'px',
        top: Math.max(0, Math.min(viewportH() - 80, pr.top)) + 'px',
        right: 'auto',
      });
    }
  });

  // ── 兜底：球在视口外才拉回（只针对球，不碰面板）──
  setTimeout(() => {
    const r = rectOf($fab);
    const vw = viewportW(), vh = viewportH();
    if (r.width === 0 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) {
      $fab.css({ left: (vw - FAB_SIZE - 16) + 'px', top: Math.round(vh * 0.4) + 'px', right: 'auto' });
    }
  }, 500);

  toastr.success('立绘悬浮窗已加载，点击🖼展开', '');

  // ── 卸载 ──
  $(window).on('pagehide', () => {
    $(`[script_id="${标记}"]`).remove();
    $doc.off('.lh'); $doc.off('.lhzoom'); $doc.off('.lhrz');
    $win.off('.lh');
  });
});
