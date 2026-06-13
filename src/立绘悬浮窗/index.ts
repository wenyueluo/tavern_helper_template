/**
 * 立绘展示悬浮窗 —— 酒馆助手脚本（Vue 版）
 *
 * 【脚本本质复习】
 *   脚本 = 无界面的后台 iframe。要显示东西，必须：
 *   1. $ 直接操作酒馆页面的 body（不是自己的 iframe）
 *   2. createScriptIdDiv() → appendTo('body') → 在酒馆页面上创建挂载点
 *   3. teleportStyle() → 把 iframe 内的 Vue scoped 样式复制到酒馆 <head>
 *   4. pagehide 时清理：unmount + remove DOM + destroy 样式
 *
 * 【与 jQuery 版的区别】
 *   jQuery 版：$() 画 DOM + 手动绑事件 + 手动更新状态
 *   Vue 版：    template 声明 UI + v-for/v-on 绑事件 + ref/reactive 管状态
 *   区别是"命令式" vs "声明式"。Vue 版更容易加功能、更容易读。
 *
 * 【入口约定】
 *   这个文件 = webpack 入口。只要它在 src/立绘悬浮窗/ 下且没有同级 index.html，
 *   webpack 就把它当「脚本」打包（产物是 dist/立绘悬浮窗/index.js，不含 html）。
 */

import { teleportStyle, createScriptIdDiv } from '@util/script';
import App from './App.vue';

// ══════════════════════════════════════════════════════════════════════
// 关键可见性样式——直接注入酒馆 <head>，不依赖 scoped/teleportStyle
// 仿照已验证可用的 jQuery 版做法，确保悬浮球无论如何都能显示
// ══════════════════════════════════════════════════════════════════════
const CRITICAL_CSS = `
.lh-fab {
  position:fixed !important; width:46px; height:46px; border-radius:50%;
  background:#1b1030; border:1px solid rgba(167,139,250,.4); color:#c4b5fd;
  font-size:22px; display:flex !important; align-items:center; justify-content:center;
  cursor:grab; user-select:none; touch-action:none; z-index:999999;
  box-shadow:0 0 16px rgba(167,139,250,.35), 0 3px 12px rgba(0,0,0,.5);
  transition:filter .15s, box-shadow .2s;
}
.lh-fab:hover { filter:brightness(1.2); box-shadow:0 0 26px rgba(167,139,250,.55); }
.lh-fab.is-dragging { cursor:grabbing; }
.lh-panel {
  position:fixed !important; width:280px; background:#120c1f;
  border:1px solid rgba(167,139,250,.3); border-radius:14px;
  box-shadow:0 10px 40px rgba(0,0,0,.6); z-index:999998;
  display:flex; flex-direction:column; overflow:hidden; color:#e9e3ff;
  font-family:'Segoe UI',system-ui,sans-serif;
}
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
.lh-cat-tab { flex:1; min-width:48px; padding:4px 0; font-size:12px;
  text-align:center; cursor:pointer; border-radius:6px;
  color:rgba(255,255,255,.5); transition:background .15s, color .15s; }
.lh-cat-tab:hover { color:#c4b5fd; background:rgba(167,139,250,.1); }
.lh-cat-tab.active { color:#e9e3ff; background:rgba(167,139,250,.15); font-weight:600; }
.lh-img-wrap { width:100%; aspect-ratio:2/3; background:#0a0712;
  display:flex; align-items:center; justify-content:center; overflow:hidden; }
.lh-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
.lh-btns { display:flex; flex-wrap:wrap; gap:6px; padding:10px; }
.lh-btn { flex:1 1 auto; min-width:56px; padding:6px 10px; font-size:12px;
  text-align:center; cursor:pointer; border-radius:8px;
  border:1px solid rgba(167,139,250,.25); background:rgba(167,139,250,.08);
  color:#d6ccff; transition:background .15s, border-color .15s; }
.lh-btn:hover { background:rgba(167,139,250,.2); }
.lh-btn.active { background:#a78bfa; border-color:#a78bfa; color:#1b1030; font-weight:600; }
.lh-fab.is-dragging *, .lh-panel-dragging * { user-select:none; }
`;

// ── 加载：创建 Vue 应用、挂载到酒馆 body ──
$(() => {
  // ① 先注入关键样式到酒馆 <head>（绕过 scoped 机制，确保悬浮球一定可见）
  $('<style>').attr('script_id', getScriptId()).text(CRITICAL_CSS).appendTo('head');

  const app = createApp(App).use(createPinia());

  // ② 创建挂载点并挂载 Vue 应用
  // createScriptIdDiv() 创建一个带 script_id 属性的 <div>，
  // appendTo('body') 把它追加到酒馆页面上（不是脚本 iframe）
  const $app = createScriptIdDiv().appendTo('body');
  app.mount($app[0]);

  // ③ teleportStyle() 把 Vue <style scoped> 产生的样式复制到酒馆 <head>
  // 作为补充（hover/focus 等增强样式，即使失败也不影响核心可见性）
  const { destroy } = teleportStyle();

  // ④ 调试：输出悬浮球位置，方便排查
  console.log('[立绘悬浮窗] 已挂载，脚本ID:', getScriptId(),
    '窗口:', window.innerWidth + 'x' + window.innerHeight);

  // ── 卸载：清理 Vue 实例、DOM、样式 ──
  $(window).on('pagehide', () => {
    app.unmount();
    $app.remove();
    destroy();
  });

  toastr.success('立绘悬浮窗已加载（Vue版）', '');
});
