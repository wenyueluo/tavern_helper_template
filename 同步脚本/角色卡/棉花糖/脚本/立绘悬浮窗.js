/**
 * 立绘展示悬浮窗 -- 棉花糖（纯 jQuery 版）
 *
 * 角色：
 * 苏怀瑾 / 许念棠 / 方晴 / 苏念瑶 / 白软软 / 唐果 / 许疏影 / 楚清音
 * CDN 路径：https://testingcf.jsdelivr.net/gh/wenyueluo/tavern_helper_template@master/dist/棉花糖
 */

// ============================================================
// 1. 立绘数据
// ============================================================
const ILLUST_BASE = 'https://testingcf.jsdelivr.net/gh/wenyueluo/tavern_helper_template@master/dist/%E6%A3%89%E8%8A%B1%E7%B3%96';

const categories = [
  {
    name: '苏怀瑾',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/苏怀瑾_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/苏怀瑾_2.png' },
    ],
  },
  {
    name: '许念棠',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/许念棠_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/许念棠_2.png' },
    ],
  },
  {
    name: '方晴',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/方晴_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/方晴_2.png' },
    ],
  },
  {
    name: '苏念瑶',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/苏念瑶_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/苏念瑶_2.png' },
    ],
  },
  {
    name: '白软软',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/白软软_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/白软软_2.png' },
    ],
  },
  {
    name: '唐果',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/唐果_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/唐果_2.png' },
    ],
  },
  {
    name: '许疏影',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/许疏影_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/许疏影_2.png' },
    ],
  },
  {
    name: '楚清音',
    items: [
      { name: '日常壹', url: ILLUST_BASE + '/楚清音_1.png' },
      { name: '日常贰', url: ILLUST_BASE + '/楚清音_2.png' },
    ],
  },
];

// ============================================================
// 2. 常量
// ============================================================
const 标记 = getScriptId();
const PANEL_WIDTH = 280;
const FAB_SIZE = 46;
const DRAG_THRESHOLD = 4;

function viewportW() {
  let w = 0;
  try { w = window.parent ? window.parent.innerWidth : 0; } catch (e) { /* 跨域 */ }
  if (!w) w = window.innerWidth;
  if (!w) { try { w = window.parent.document.documentElement.clientWidth; } catch (e) { /* ignore */ } }
  return w || 1280;
}
function viewportH() {
  let h = 0;
  try { h = window.parent ? window.parent.innerHeight : 0; } catch (e) { /* 跨域 */ }
  if (!h) h = window.innerHeight;
  if (!h) { try { h = window.parent.document.documentElement.clientHeight; } catch (e) { /* ignore */ } }
  return h || 720;
}

// ============================================================
// 3. 持久化（脚本变量）
// ============================================================
function 读位置() {
  try { return getVariables({ type: 'script' }) || {}; } catch (e) { return {}; }
}
function 写位置(p) {
  try { insertOrAssignVariables(Object.assign({}, p), { type: 'script' }); } catch (e) { /* ignore */ }
}

// ============================================================
// 4. 样式
// ============================================================
const 样式 = [
  '.lh-fab {',
  '  position:fixed; right:16px; top:40%; width:46px; height:46px; border-radius:50%;',
  '  background:linear-gradient(135deg,#302040,#201830); border:1px solid rgba(236,168,198,.45); color:#f0c0d8;',
  '  font-size:22px; display:flex; align-items:center; justify-content:center;',
  '  cursor:grab; user-select:none; touch-action:none; z-index:2147483646;',
  '  box-shadow:0 0 18px rgba(236,168,198,.35), 0 3px 14px rgba(0,0,0,.5);',
  '  backdrop-filter:blur(6px);',
  '  transition:filter .15s, box-shadow .2s;',
  '}',
  '.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 28px rgba(236,168,198,.55); }',
  '.lh-fab.is-dragging { cursor:grabbing; }',
  '.lh-panel {',
  '  position:fixed; right:74px; top:60px;',
  '  width:280px; background:rgba(30,20,40,.92);',
  '  border:1px solid rgba(236,168,198,.3); border-radius:16px;',
  '  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:2147483645;',
  '  display:none; flex-direction:column; overflow:hidden; color:#f0e8f8;',
  "  font-family:'Segoe UI',system-ui,sans-serif;",
  '  backdrop-filter:blur(10px);',
  '}',
  '.lh-panel.lh-visible { display:flex; }',
  '.lh-head {',
  '  display:flex; align-items:center; justify-content:space-between; gap:6px;',
  '  padding:8px 12px; font-size:13px;',
  '  border-bottom:1px solid rgba(236,168,198,.15); cursor:move; user-select:none;',
  '  background:linear-gradient(135deg,rgba(236,168,198,.08),rgba(180,200,240,.04));',
  '}',
  '.lh-head.is-dragging { cursor:grabbing; }',
  '.lh-head-title { flex:1; color:#f0c0d8; letter-spacing:1px; }',
  '.lh-close { cursor:pointer; width:22px; height:22px; line-height:22px;',
  '  text-align:center; border-radius:8px; color:#d8b8d8; font-size:13px; }',
  '.lh-close:hover { background:rgba(236,168,198,.2); }',
  '.lh-categories { display:flex; flex-wrap:wrap; gap:4px; padding:6px 10px;',
  '  border-bottom:1px solid rgba(236,168,198,.12); }',
  '.lh-cat-tab { flex:1; min-width:48px; padding:4px 2px; font-size:11px;',
  '  text-align:center; cursor:pointer; border-radius:10px;',
  '  color:rgba(255,255,255,.5); transition:background .15s, color .15s; }',
  '.lh-cat-tab:hover { color:#f0c0d8; background:rgba(236,168,198,.1); }',
  '.lh-cat-tab.active { color:#f8e8f8; background:rgba(236,168,198,.18); font-weight:600; }',
  '.lh-img-wrap { width:100%; aspect-ratio:2/3; background:rgba(10,8,20,.6);',
  '  display:flex; align-items:center; justify-content:center; overflow:hidden;',
  '  cursor:zoom-in; position:relative; }',
  ".lh-img-wrap::after { content:'🎨 点击放大'; position:absolute; bottom:8px; right:8px;",
  '  font-size:10px; color:#f0c0d8; background:rgba(30,20,40,.7); padding:2px 8px;',
  '  border-radius:10px; opacity:0; transition:opacity .2s; pointer-events:none; }',
  '.lh-img-wrap:hover::after { opacity:1; }',
  '.lh-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }',
  '.lh-btns { display:flex; flex-wrap:wrap; gap:6px; padding:10px; }',
  '.lh-btn { flex:1 1 auto; min-width:56px; padding:6px 10px; font-size:11px;',
  '  text-align:center; cursor:pointer; border-radius:10px;',
  '  border:1px solid rgba(236,168,198,.25); background:rgba(236,168,198,.06);',
  '  color:#f0d0e0; transition:background .15s, border-color .15s; white-space:nowrap; }',
  '.lh-btn:hover { background:rgba(236,168,198,.2); }',
  '.lh-btn.active { background:#eca8c6; border-color:#eca8c6; color:#201830; font-weight:600; }',
  '.lh-fab.is-dragging *, .lh-panel-dragging * { user-select:none; }',
  '/* 全屏放大遮罩 */',
  '.lh-zoom { position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:2147483647;',
  '  display:none; align-items:center; justify-content:center;',
  '  overflow:hidden; box-sizing:border-box; backdrop-filter:blur(2px); }',
  '.lh-zoom.lh-zoom-show { display:flex; }',
  '.lh-zoom img { max-width:90vw; max-height:90vh; object-fit:contain; border-radius:12px;',
  '  box-shadow:0 0 60px rgba(236,168,198,.3), 0 0 30px rgba(0,0,0,.8);',
  '  transform-origin:center center; cursor:zoom-in; user-select:none;',
  '  -webkit-user-drag:none; will-change:transform; touch-action:none; }',
  '.lh-zoom img.lh-zoom-grab { cursor:grab; }',
  '.lh-zoom img.lh-zoom-grabbing { cursor:grabbing; }',
  '.lh-zoom-close { position:absolute; top:18px; right:24px; width:40px; height:40px;',
  '  line-height:38px; text-align:center; font-size:22px; color:#f0e8f8; cursor:pointer;',
  '  border:1px solid rgba(236,168,198,.4); border-radius:50%; background:rgba(30,20,40,.6); z-index:2; }',
  '.lh-zoom-close:hover { background:rgba(236,168,198,.25); }',
  '.lh-zoom-cap { position:absolute; bottom:24px; left:50%; transform:translateX(-50%);',
  '  color:#f0c0d8; font-size:13px; letter-spacing:1px; background:rgba(30,20,40,.7);',
  '  padding:4px 16px; border-radius:14px; z-index:2; }',
  '.lh-zoom-tip { position:absolute; top:18px; left:24px;',
  '  color:#b8a8c8; font-size:11px; letter-spacing:.5px; background:rgba(30,20,40,.6);',
  '  padding:4px 12px; border-radius:12px; z-index:2; pointer-events:none; }',
].join('\n');

// ============================================================
// 5. 构建
// ============================================================
$(function () {
  $('<style>').attr('script_id', 标记).text(样式).appendTo('head');

  // 预加载所有立绘
  var preloaded = [];
  categories.forEach(function (c) {
    c.items.forEach(function (it) {
      var im = new Image();
      im.src = it.url;
      preloaded.push(im);
    });
  });

  var saved = 读位置();

  function validCoord(left, top) {
    if (typeof left !== 'number' || typeof top !== 'number') return false;
    if (!isFinite(left) || !isFinite(top)) return false;
    return left >= -4 && top >= -4 && left <= viewportW() - 10 && top <= viewportH() - 10;
  }

  // 悬浮球
  var $fab = $('<div>').attr('script_id', 标记).addClass('lh-fab').text('🎨').appendTo('body');
  if (validCoord(saved.fabLeft, saved.fabTop)) {
    $fab.css({ left: saved.fabLeft + 'px', top: saved.fabTop + 'px', right: 'auto' });
  } else if (saved.fabLeft !== undefined) {
    写位置({ fabLeft: undefined, fabTop: undefined });
  }

  // 面板
  var $panel = $('<div>').attr('script_id', 标记).addClass('lh-panel').appendTo('body');
  if (validCoord(saved.panelLeft, saved.panelTop)) {
    $panel.css({ left: saved.panelLeft + 'px', top: saved.panelTop + 'px', right: 'auto' });
  } else if (saved.panelLeft !== undefined) {
    写位置({ panelLeft: undefined, panelTop: undefined });
  }

  // 标题栏
  var $head = $('<div>').addClass('lh-head').appendTo($panel);
  $('<span>').addClass('lh-head-title').text('立绘展示 -- 棉花糖').appendTo($head);
  var $close = $('<span>').addClass('lh-close').attr('title', '关闭').text('✕').appendTo($head);

  var $cats = $('<div>').addClass('lh-categories').appendTo($panel);
  var $imgWrap = $('<div>').addClass('lh-img-wrap').appendTo($panel);
  var $img = $('<img>').addClass('lh-img').appendTo($imgWrap);
  var $btns = $('<div>').addClass('lh-btns').appendTo($panel);

  // 全屏放大遮罩
  var $zoom = $('<div>').attr('script_id', 标记).addClass('lh-zoom').appendTo('body');
  var $zoomClose = $('<span>').addClass('lh-zoom-close').text('✕').appendTo($zoom);
  var $zoomImg = $('<img>').appendTo($zoom);
  var $zoomCap = $('<div>').addClass('lh-zoom-cap').appendTo($zoom);
  $('<div>').addClass('lh-zoom-tip').text('滚轮缩放 · 拖动平移 · 双击复位').appendTo($zoom);

  // 状态
  var catIdx = 0, itemIdx = 0, panelVisible = false;

  function cat() { return categories[catIdx]; }
  function item() { return cat().items[itemIdx]; }

  function renderCats() {
    $cats.empty();
    categories.forEach(function (c, i) {
      $('<div>').addClass('lh-cat-tab').toggleClass('active', i === catIdx)
        .text(c.name).on('click', function (e) { e.stopPropagation(); switchCat(i); }).appendTo($cats);
    });
  }
  function switchCat(idx) {
    if (idx === catIdx) return;
    catIdx = idx; itemIdx = 0;
    renderCats(); renderBtns(); updateImg();
  }
  function renderBtns() {
    $btns.empty();
    cat().items.forEach(function (it, i) {
      $('<div>').addClass('lh-btn').toggleClass('active', i === itemIdx)
        .text(it.name).on('click', function (e) { e.stopPropagation(); itemIdx = i; renderBtns(); updateImg(); })
        .appendTo($btns);
    });
  }
  function updateImg() { $img.attr('src', item().url).attr('alt', item().name); }

  function openPanel() {
    $panel.addClass('lh-visible');
    panelVisible = true;
    renderCats(); renderBtns(); updateImg();
  }
  function closePanel() {
    $panel.removeClass('lh-visible');
    panelVisible = false;
  }

  // ============================================================
  // 6. 放大查看（滚轮缩放 + 拖动平移 + 双击复位）
  // ============================================================
  var zScale = 1, zX = 0, zY = 0;
  var Z_MIN = 1, Z_MAX = 6;
  function applyZoom() {
    $zoomImg[0].style.transform = 'translate(' + zX + 'px, ' + zY + 'px) scale(' + zScale + ')';
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
  $zoomImg.on('click', function (e) { e.stopPropagation(); });
  $zoomClose.on('click', closeZoom);

  $zoomImg.on('wheel', function (e) {
    e.preventDefault(); e.stopPropagation();
    var oe = e.originalEvent;
    var rect = $zoomImg[0].getBoundingClientRect();
    var cx = oe.clientX - (rect.left + rect.width / 2);
    var cy = oe.clientY - (rect.top + rect.height / 2);
    var prev = zScale;
    var factor = oe.deltaY < 0 ? 1.15 : 1 / 1.15;
    zScale = Math.max(Z_MIN, Math.min(Z_MAX, zScale * factor));
    var ratio = zScale / prev;
    zX = (zX - cx) * ratio + cx;
    zY = (zY - cy) * ratio + cy;
    if (zScale === 1) { zX = 0; zY = 0; }
    applyZoom();
  });

  var zDragging = false, zSX = 0, zSY = 0, zOX = 0, zOY = 0;
  $zoomImg.on('mousedown touchstart', function (e) {
    if (zScale <= 1) return;
    var oe = e.originalEvent;
    var p = oe instanceof TouchEvent ? (oe.touches[0] || oe.changedTouches[0]) : oe;
    if (!p) return;
    zDragging = true; zSX = p.clientX; zSY = p.clientY; zOX = zX; zOY = zY;
    $zoomImg.addClass('lh-zoom-grabbing');
    e.preventDefault(); e.stopPropagation();
  });
  $zoomImg.on('dblclick', function (e) { e.stopPropagation(); resetZoom(); });

  // ============================================================
  // 7. 拖动
  // ============================================================
  var dragTarget = null;
  var startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;

  function getXY(e) {
    var oe = e.originalEvent;
    if (oe instanceof TouchEvent) {
      var t = oe.touches[0] || oe.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: oe.clientX, y: oe.clientY };
  }
  function rectOf($el) { return $el[0].getBoundingClientRect(); }

  $fab.on('mousedown touchstart', function (e) {
    var pos = getXY(e); if (!pos) return;
    dragTarget = 'fab'; moved = false;
    var r = rectOf($fab);
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    $fab.addClass('is-dragging');
    e.preventDefault();
  });

  $head.on('mousedown touchstart', function (e) {
    var pos = getXY(e); if (!pos) return;
    dragTarget = 'panel'; moved = false;
    var r = rectOf($panel);
    startX = pos.x; startY = pos.y; startLeft = r.left; startTop = r.top;
    $head.addClass('is-dragging'); $panel.addClass('lh-panel-dragging');
    e.preventDefault();
  });

  $close.on('mousedown', function (e) { e.stopPropagation(); });
  $close.on('click', function (e) { e.stopPropagation(); closePanel(); });

  var ownerDoc = $fab[0].ownerDocument || document;
  var ownerWin = ownerDoc.defaultView || window;
  var $doc = $(ownerDoc);
  var $win = $(ownerWin);

  // 放大图平移
  $doc.on('mousemove.lhzoom touchmove.lhzoom', function (e) {
    if (!zDragging) return;
    var oe = e.originalEvent;
    var p = oe instanceof TouchEvent ? (oe.touches[0] || oe.changedTouches[0]) : oe;
    if (!p) return;
    zX = zOX + (p.clientX - zSX);
    zY = zOY + (p.clientY - zSY);
    applyZoom();
    e.preventDefault();
  });
  $doc.on('mouseup.lhzoom touchend.lhzoom', function () {
    if (!zDragging) return;
    zDragging = false; $zoomImg.removeClass('lh-zoom-grabbing');
  });

  // 球/面板拖动
  $doc.on('mousemove.lh touchmove.lh', function (e) {
    if (!dragTarget) return;
    var pos = getXY(e); if (!pos) return;
    var dx = pos.x - startX, dy = pos.y - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;

    var $el = dragTarget === 'fab' ? $fab : $panel;
    var w = dragTarget === 'fab' ? FAB_SIZE : PANEL_WIDTH;
    var minVisible = dragTarget === 'fab' ? FAB_SIZE : 80;
    var left = Math.max(-(w - minVisible), Math.min(viewportW() - minVisible, startLeft + dx));
    var top = Math.max(0, Math.min(viewportH() - minVisible, startTop + dy));
    $el.css({ left: left + 'px', top: top + 'px', right: 'auto' });
  });

  $doc.on('mouseup.lh touchend.lh', function () {
    if (!dragTarget) return;
    if (dragTarget === 'fab') {
      $fab.removeClass('is-dragging');
      if (!moved) {
        panelVisible ? closePanel() : openPanel();
      } else {
        var r = rectOf($fab);
        写位置({ fabLeft: r.left, fabTop: r.top });
      }
    } else {
      $head.removeClass('is-dragging'); $panel.removeClass('lh-panel-dragging');
      if (moved) {
        var r2 = rectOf($panel);
        写位置({ panelLeft: r2.left, panelTop: r2.top });
      }
    }
    dragTarget = null;
  });

  // 窗口缩放拉回
  $win.on('resize.lh', function () {
    var fr = rectOf($fab);
    $fab.css({
      left: Math.max(0, Math.min(viewportW() - FAB_SIZE, fr.left)) + 'px',
      top: Math.max(0, Math.min(viewportH() - FAB_SIZE, fr.top)) + 'px',
      right: 'auto',
    });
    if (panelVisible) {
      var pr = rectOf($panel);
      $panel.css({
        left: Math.max(0, Math.min(viewportW() - PANEL_WIDTH, pr.left)) + 'px',
        top: Math.max(0, Math.min(viewportH() - 80, pr.top)) + 'px',
        right: 'auto',
      });
    }
  });

  // 兜底：球在视口外才拉回
  setTimeout(function () {
    var r = rectOf($fab);
    var vw = viewportW(), vh = viewportH();
    if (r.width === 0 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) {
      $fab.css({ left: (vw - FAB_SIZE - 16) + 'px', top: Math.round(vh * 0.4) + 'px', right: 'auto' });
    }
  }, 500);

  toastr.success('棉花糖立绘已加载，点击展开', '');

  // 卸载
  $(window).on('pagehide', function () {
    $('[script_id="' + 标记 + '"]').remove();
    $doc.off('.lh'); $doc.off('.lhzoom');
    $win.off('.lh');
  });
});
