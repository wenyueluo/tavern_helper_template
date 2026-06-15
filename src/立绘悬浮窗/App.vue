<!--
  ════════════════════════════════════════════════════════════════
   App.vue —— 立绘悬浮窗主组件（Vue 单文件组件）
  ════════════════════════════════════════════════════════════════

  【Vue SFC 三段结构】
    <template>  = 声明 UI「长什么样」（对应 jQuery 版的 $('<div>').addClass(...)）
    <script>   = 声明逻辑「怎么做」 （对应 jQuery 版的 const x = ...; $('x').on(...)）
    <style>    = 声明样式（对应 jQuery 版的 const 样式 = `...`; $('<style>').text(样式)）

  【Vue 关键概念对照 jQuery】
    jQuery  ｜ Vue
    ────────┼────────
    $('.lh-fab').css('left', '100px')  ｜ :style="{ left: fabX + 'px' }"  在模板里绑定样式
    $按钮排.children().removeClass(...)  ｜ :class="{ active: i === currentIndex }"  条件类名
    立绘列表.forEach((项,i) => { $('<div>').on('click'...) })  ｜ v-for="(item, i) in list" @click="switchTo(i)"
    let 拖动中 = false; const 按下 = (e) => ...  ｜ const dragging = ref(false); @mousedown="onDragStart"
    $悬浮球.on('mousedown', ...)  ｜ @mousedown="..."  直接在模板里绑定

  【Vue scoped 样式原理】
    scoped 会给每个元素加 data-v-xxxx 属性，
    CSS 选择器自动变成 .lh-fab[data-v-xxxx]，
    所以不同组件的 .lh-fab 不会互相影响。
    teleportStyle() 在 index.ts 里负责把这些样式复制到酒馆页面。

  【面板拖动与跟随逻辑】
    1. 面板初始位置由悬浮球位置计算：left = fabLeft - 280 - 10, top = fabTop - 50
    2. 面板显示时自动计算初始位置（watch panelVisible）
    3. 拖动标题栏可独立移动面板，移动后面板"断开跟随"
    4. 关闭面板再打开时重新跟随悬浮球位置（watch 重新计算）
    5. 悬浮球和面板各自独立拖动，互不干扰
-->
<template>
  <!-- ── 悬浮球 ── -->
  <div
    class="lh-fab"
    :class="{ 'is-dragging': fabDragging }"
    :style="fabStyle"
    @mousedown.prevent="onFabDragStart"
    @touchstart.prevent="onFabDragStart"
  >
    🖼
  </div>

  <!-- ── 立绘面板 ── -->
  <div
    v-show="panelVisible"
    ref="panelEl"
    class="lh-panel"
    :class="{ 'lh-panel-dragging': panelDragging }"
    :style="panelStyle"
  >
    <!-- 标题栏（可拖动面板） -->
    <div
      class="lh-head"
      :class="{ 'is-dragging': panelDragging }"
      @mousedown.prevent="onPanelDragStart"
      @touchstart.prevent="onPanelDragStart"
    >
      <span>立绘展示</span>
      <span class="lh-close" @mousedown.stop @click.stop="panelVisible = false">✕</span>
    </div>

    <!--
      【任务3】分类标签栏（角色切换）
      点击"角色A"→显示角色A的第一张、按钮排切换到角色A的立绘列表
      v-for 遍历 categories，:class 高亮当前的，@click 切换
    -->
    <div class="lh-categories">
      <div
        v-for="(cat, idx) in categories"
        :key="idx"
        class="lh-cat-tab"
        :class="{ active: idx === currentCategoryIndex }"
        @click="switchCategory(idx)"
      >
        {{ cat.name }}
      </div>
    </div>

    <!-- 立绘大图 -->
    <div class="lh-img-wrap">
      <img :src="current.url" :alt="current.name" class="lh-img" />
    </div>

    <!--
      切图按钮 —— 现在遍历的是 currentItems（当前角色的立绘列表），
      而不是全局的 illustrations。
      切换角色时 currentItems 自动变，按钮排自动更新。
    -->
    <div class="lh-btns">
      <div
        v-for="(item, index) in currentItems"
        :key="index"
        class="lh-btn"
        :class="{ active: index === currentIndex }"
        @click="switchTo(index)"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【script setup 是什么】
 *   Vue 3 的「语法糖」—— 写在 setup() 里的代码可以直接放在顶层的 <script setup> 里，
 *   定义的变量/函数自动暴露给 template 使用。不需要 return。
 *   注意：项目配置了自动导入（auto-imports），所以 ref、computed、watch、onMounted 等
 *   Vue 函数不需要手动 import，直接用就行。
 */

// --- 任务2 新增：引入位置记忆 store ---
// 这个 store 会在加载时从脚本变量读取上次保存的位置，
// 并在位置变化时自动写回脚本变量。详见 store.ts。
import { usePositionStore } from './store';

// ══════════════════════════════════════════════════════════════
// 1. 数据（★ 真实立绘 URL + 双人分类 ★）
//
//   【URL 来源】
//     GitHub raw URL 前缀: https://raw.githubusercontent.com/wenyueluo/sillytraven/main/yyryjyy/
//
//   月岛悠:      ma-5.png (颓废期) / ma-6.png (后期)
//   朝日向七海:  ma-11.png (日)
//   月见里雫:    ma-9.png (雨)
//   橘澪:        ma-10.png (橘)
//   双人立绘:    ma-12.png (月岛悠×朝日向七海) / ma-17.png (月岛悠×月见里雫)
//                ma-16.png (月岛悠×橘澪①) / ma-18.png (月岛悠×橘澪②)
// ══════════════════════════════════════════════════════════════

const ILLUST_BASE = 'https://raw.githubusercontent.com/wenyueluo/sillytraven/main/沉鸢不归';

/** 单张立绘 */
type Illustration = { name: string; url: string };
/** 一个角色（或分类），包含多张立绘 */
type Category = { name: string; items: Illustration[] };

const categories: Category[] = [
  {
    name: '沈鸢',
    items: [
      { name: '沈鸢-1', url: `${ILLUST_BASE}/沈鸢-1.png` },
      { name: '沈鸢-2', url: `${ILLUST_BASE}/沈鸢-2.png` },
      { name: '沈鸢-3', url: `${ILLUST_BASE}/沈鸢-3.png` },
      { name: '沈鸢-4', url: `${ILLUST_BASE}/沈鸢-4.png` },
      { name: '沈鸢-5', url: `${ILLUST_BASE}/沈鸢-5.png` },
      { name: '沈鸢-6', url: `${ILLUST_BASE}/沈鸢-6.png` },
      { name: '沈鸢-7', url: `${ILLUST_BASE}/沈鸢-7.png` },
    ],
  },
  {
    name: '乔晚',
    items: [
      { name: '乔晚-1', url: `${ILLUST_BASE}/乔晚-1.png` },
    ],
  },
  {
    name: '凌千夏',
    items: [
      { name: '凌千夏-1', url: `${ILLUST_BASE}/凌千夏-1.png` },
    ],
  },
  {
    name: '姜野',
    items: [
      { name: '姜野-1', url: `${ILLUST_BASE}/姜野-1.png` },
    ],
  },
  {
    name: '安樱',
    items: [
      { name: '安樱-1', url: `${ILLUST_BASE}/安樱-1.png` },
    ],
  },
  {
    name: '宋薄寒',
    items: [
      { name: '宋薄寒-1', url: `${ILLUST_BASE}/宋薄寒-1.png` },
    ],
  },
  {
    name: '时染',
    items: [
      { name: '时染-1', url: `${ILLUST_BASE}/时染-1.png` },
    ],
  },
  {
    name: '苏小眠',
    items: [
      { name: '苏小眠-1', url: `${ILLUST_BASE}/苏小眠-1.png` },
    ],
  },
  {
    name: '裴寒露',
    items: [
      { name: '裴寒露-1', url: `${ILLUST_BASE}/裴寒露-1.png` },
    ],
  },
  {
    name: '闻浅',
    items: [
      { name: '闻浅-1', url: `${ILLUST_BASE}/闻浅-1.png` },
    ],
  },
  {
    name: '颜絮',
    items: [
      { name: '颜絮-1', url: `${ILLUST_BASE}/颜絮-1.png` },
    ],
  },
  {
    name: 'NTR游戏',
    items: [
      { name: 'NTR游戏-1', url: `${ILLUST_BASE}/ntr游戏-1.png` },
      { name: 'NTR游戏-2', url: `${ILLUST_BASE}/ntr游戏-2.png` },
    ],
  },
  {
    name: '玩偶服隐奸',
    items: [
      { name: '玩偶服隐奸-1', url: `${ILLUST_BASE}/玩偶服隐奸-1.png` },
      { name: '玩偶服隐奸-2', url: `${ILLUST_BASE}/玩偶服隐奸-2.png` },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// 2. 响应式状态
// ══════════════════════════════════════════════════════════════
const panelVisible = ref(false);           // 面板是否可见
const currentCategoryIndex = ref(0);       // 当前选中的角色/分类索引
const currentIndex = ref(0);               // 当前显示第几张立绘（在当前分类内）
const fabDragging = ref(false);            // 悬浮球是否正在拖动
const panelDragging = ref(false);          // 面板是否正在拖动

// --- 任务2：位置从脚本变量读取（替代原来的硬编码初始值）---
// panelLeft/panelTop/panelManuallyPositioned 现在也由 store 持久化
const { 位置 } = storeToRefs(usePositionStore());

// 面板 DOM 元素引用，用于获取实际渲染尺寸做视口约束
const panelEl = ref<HTMLElement | null>(null);

// ══════════════════════════════════════════════════════════════
// 3. 计算属性（computed）
// ══════════════════════════════════════════════════════════════
const currentCategory = computed(() => categories[currentCategoryIndex.value]);
const currentItems = computed(() => currentCategory.value.items);
const current = computed(() => currentItems.value[currentIndex.value]);

// 悬浮球定位样式
const fabStyle = computed(() => ({
  left: 位置.value.fabLeft + 'px',
  top: 位置.value.fabTop + 'px',
}));

// 面板定位样式 —— 从 store 读取（初始由 watch 计算，拖动后独立持久化）
const panelStyle = computed(() => ({
  left: 位置.value.panelLeft + 'px',
  top: 位置.value.panelTop + 'px',
}));

// ══════════════════════════════════════════════════════════════
// 4. 面板初始位置计算（跟随悬浮球）
// ══════════════════════════════════════════════════════════════
const PANEL_WIDTH = 280;
const PANEL_MIN_VISIBLE = 80; // 最小可⻅像素，防止面板完全拖出屏幕

/** 根据悬浮球位置计算面板初始 left */
function computeInitialPanelLeft(): number {
  let left = 位置.value.fabLeft - PANEL_WIDTH - 10;
  // 视口约束：不超出左右边界
  if (left < 0) left = 10;
  if (left + PANEL_WIDTH > window.innerWidth) left = window.innerWidth - PANEL_WIDTH - 10;
  return left;
}

/** 根据悬浮球位置计算面板初始 top */
function computeInitialPanelTop(): number {
  let top = 位置.value.fabTop - 50;
  // 视口约束：不超出上下边界
  if (top < 0) top = 10;
  if (top + PANEL_MIN_VISIBLE > window.innerHeight) top = window.innerHeight - PANEL_MIN_VISIBLE - 10;
  return top;
}

// 面板打开且未被手动拖动时，持续跟随悬浮球移动
watch([() => 位置.value.fabLeft, () => 位置.value.fabTop], () => {
  if (panelVisible.value && !位置.value.panelManuallyPositioned) {
    位置.value.panelLeft = computeInitialPanelLeft();
    位置.value.panelTop = computeInitialPanelTop();
  }
});

// 面板打开时重置位置为跟随悬浮球，同时重置手动拖动标记，并在渲染后约束到视口内
watch(panelVisible, (visible) => {
  if (visible) {
    位置.value.panelLeft = computeInitialPanelLeft();
    位置.value.panelTop = computeInitialPanelTop();
    位置.value.panelManuallyPositioned = false;
    nextTick(() => {
      clampPanelToViewport();
    });
  }
});

// ══════════════════════════════════════════════════════════════
// 5. 方法
// ══════════════════════════════════════════════════════════════
function switchTo(index: number) {
  if (index >= 0 && index < currentItems.value.length) {
    currentIndex.value = index;
  }
}

// --- 任务3：切换分类（切换角色）---
function switchCategory(index: number) {
  if (index >= 0 && index < categories.length) {
    currentCategoryIndex.value = index;
    currentIndex.value = 0;
  }
}

// ══════════════════════════════════════════════════════════════
// 6. 拖动逻辑（悬浮球 + 面板共享 document 级事件）
//
//   dragTarget 区分当前拖动的是悬浮球还是面板，
//   onDragMove / onDragEnd 根据 dragTarget 更新对应的位置。
//   面板拖动后位置独立于悬浮球，但面板关闭再打开时重新跟随（由 watch 重置）。
// ══════════════════════════════════════════════════════════════
const DRAG_THRESHOLD = 4;

let dragTarget: 'fab' | 'panel' | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;
let hasMoved = false;

/** 提取事件中的 clientX / clientY（兼容鼠标和触摸） */
function getClientXY(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } | null {
  if (e instanceof TouchEvent) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return null;
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

// ── 悬浮球拖拽开始 ──
function onFabDragStart(e: MouseEvent | TouchEvent) {
  dragTarget = 'fab';
  fabDragging.value = true;
  hasMoved = false;
  dragStartLeft = 位置.value.fabLeft;
  dragStartTop = 位置.value.fabTop;

  const pos = getClientXY(e);
  if (pos) {
    dragStartX = pos.clientX;
    dragStartY = pos.clientY;
  }
}

// ── 面板拖拽开始（标题栏）──
function onPanelDragStart(e: MouseEvent | TouchEvent) {
  dragTarget = 'panel';
  panelDragging.value = true;
  hasMoved = false;
  dragStartLeft = 位置.value.panelLeft;
  dragStartTop = 位置.value.panelTop;

  // 标记面板被手动拖动，断开与悬浮球的跟随关系
  //（在 dragStart 就设置，防止跟随 watcher 在拖动过程中覆盖面板位置）
  位置.value.panelManuallyPositioned = true;

  const pos = getClientXY(e);
  if (pos) {
    dragStartX = pos.clientX;
    dragStartY = pos.clientY;
  }
}

// ── 共享拖拽移动 ──
function onDragMove(e: MouseEvent | TouchEvent) {
  if (!dragTarget) return;

  const pos = getClientXY(e);
  if (!pos) return;

  const dx = pos.clientX - dragStartX;
  const dy = pos.clientY - dragStartY;

  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    hasMoved = true;
  }

  if (dragTarget === 'fab') {
    位置.value.fabLeft = Math.max(0, Math.min(window.innerWidth - 46, dragStartLeft + dx));
    位置.value.fabTop = Math.max(0, Math.min(window.innerHeight - 46, dragStartTop + dy));
  } else if (dragTarget === 'panel') {
    位置.value.panelLeft = Math.max(-PANEL_WIDTH + PANEL_MIN_VISIBLE, Math.min(window.innerWidth - PANEL_MIN_VISIBLE, dragStartLeft + dx));
    位置.value.panelTop = Math.max(0, Math.min(window.innerHeight - PANEL_MIN_VISIBLE, dragStartTop + dy));
  }
}

// ── 共享拖拽结束 ──
function onDragEnd() {
  if (!dragTarget) return;

  if (dragTarget === 'fab') {
    fabDragging.value = false;
    if (!hasMoved) {
      // 没有拖动 = 点击 → 展开/收起面板
      panelVisible.value = !panelVisible.value;
    }
  } else if (dragTarget === 'panel') {
    panelDragging.value = false;
    // panelManuallyPositioned 已在 onPanelDragStart 中设置，
    // 面板关闭时由 watch(panelVisible) 重置
  }

  dragTarget = null;
}

// ══════════════════════════════════════════════════════════════
// 7. 生命周期
// ══════════════════════════════════════════════════════════════
onMounted(() => {
  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);

  // 窗口大小改变时，把悬浮球限制在可视范围内
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  window.removeEventListener('resize', onResize);
});

function clampFabToViewport() {
  位置.value.fabLeft = Math.max(0, Math.min(window.innerWidth - 46, 位置.value.fabLeft));
  位置.value.fabTop = Math.max(0, Math.min(window.innerHeight - 46, 位置.value.fabTop));
}

/** 约束面板位置不超出视口 —— 使用面板实际渲染尺寸，确保面板完全在屏幕内 */
function clampPanelToViewport() {
  const el = panelEl.value;
  let w = PANEL_WIDTH;
  let h = window.innerHeight * 0.8; // 面板未渲染时的保守估算
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) w = rect.width;
    if (rect.height > 0) h = rect.height;
  }
  // 严格约束：面板不得超出视口任何一边
  位置.value.panelLeft = Math.max(0, Math.min(window.innerWidth - w, 位置.value.panelLeft));
  位置.value.panelTop = Math.max(0, Math.min(window.innerHeight - h, 位置.value.panelTop));
}

/** resize 事件处理：同时约束悬浮球和面板 */
function onResize() {
  clampFabToViewport();
  clampPanelToViewport();
}
</script>

<style lang="scss" scoped>
/**
 * 【为什么用 scoped】
 *   这些 CSS 会被 Vue 自动加上 data-v-xxx 哈希（如 .lh-fab[data-v-7ba5bd90]），
 *   不会影响酒馆原有的任何样式，反过来酒馆样式也不会影响我们的悬浮窗。
 *
 * 【为什么用 lang="scss"】
 *   项目模板用的就是 scss，虽然这份代码没用到 scss 特性（嵌套/变量/mixin），
 *   但保持一致更好。将来你想用 & 嵌套写 .lh-fab { &:hover {...} } 也方便。
 */

/* ── 悬浮球 ── */
.lh-fab {
  position: fixed;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #1b1030;
  border: 1px solid rgba(167, 139, 250, 0.4);
  color: #c4b5fd;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  touch-action: none;
  z-index: 100000;
  box-shadow: 0 0 16px rgba(167, 139, 250, 0.35), 0 3px 12px rgba(0, 0, 0, 0.5);
  transition: filter 0.15s, box-shadow 0.2s;

  &:hover {
    filter: brightness(1.2);
    box-shadow: 0 0 26px rgba(167, 139, 250, 0.55);
  }

  &.is-dragging {
    cursor: grabbing;
  }
}

/* ── 面板 ── */
/* left/top 由 :style 动态设置，这里只定义固定样式 */
.lh-panel {
  position: fixed;
  width: 280px;
  background: #120c1f;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  z-index: 100001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e9e3ff;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

/* ── 标题栏（可拖动面板）── */
.lh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.15);
  cursor: move;
  user-select: none;

  &.is-dragging {
    cursor: grabbing;
  }
}

.lh-close {
  cursor: pointer;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 6px;
  color: #c4b5fd;

  &:hover {
    background: rgba(167, 139, 250, 0.2);
  }
}

/* ── 【任务3】分类标签栏 ── */
.lh-categories {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.15);
  flex-wrap: wrap;
}

.lh-cat-tab {
  flex: 1;
  min-width: 48px;
  padding: 4px 0;
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  transition: background 0.15s, color 0.15s;

  &:hover {
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.1);
  }

  &.active {
    color: #e9e3ff;
    background: rgba(167, 139, 250, 0.15);
    font-weight: 600;
  }
}

/* ── 立绘大图 ── */
.lh-img-wrap {
  width: 100%;
  aspect-ratio: 2 / 3;
  background: #0a0712;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lh-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

/* ── 切图按钮排 ── */
.lh-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
}

.lh-btn {
  flex: 1 1 auto;
  min-width: 56px;
  padding: 6px 10px;
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.25);
  background: rgba(167, 139, 250, 0.08);
  color: #d6ccff;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(167, 139, 250, 0.2);
  }

  &.active {
    background: #a78bfa;
    border-color: #a78bfa;
    color: #1b1030;
    font-weight: 600;
  }
}

/* ── 拖动时禁止全页选择文字 ── */
.lh-fab.is-dragging *,
.lh-panel-dragging * {
  user-select: none;
}
</style>
