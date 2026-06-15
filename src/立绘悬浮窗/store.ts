/**
 * 【任务2】位置记忆 —— 用脚本变量保存悬浮球位置
 *
 * 【脚本变量是什么】
 *   每个酒馆助手脚本可以存自己的「脚本变量」，读写方式：
 *     getVariables({ type: 'script' })          — 读取这个脚本的所有变量
 *     insertOrAssignVariables(newVars, { type: 'script' }) — 写入/更新变量
 *   变量绑定到这个脚本的 ID（getScriptId()），卸载后不会丢失。
 *
 * 【Pinia store 的作用】
 *   把「读变量 → 响应式状态 → 写回变量」这个循环封装起来：
 *   1. 加载时从变量读初始值 → 放入 reactive ref
 *   2. watchEffect 自动监听 ref 变化 → 每次变化都写回变量
 *   3. 下次脚本加载 → 变量还在 → 恢复到上次的位置
 *
 * 【如果你想改保存的内容】
 *   只改下面的 Schema 定义（加字段/改默认值），
 *   App.vue 里读 store.位置.xxx 就行。
 */

// Zod schema：定义我们要保存什么数据、默认值是什么
const 位置Schema = z
  .object({
    /** 悬浮球的 left 像素值 */
    fabLeft: z.number().default(window.innerWidth - 62),
    /** 悬浮球的 top 像素值 */
    fabTop: z.number().default(window.innerHeight * 0.4),
    /** 面板的 left 像素值（手动拖动后使用） */
    panelLeft: z.number().default(Math.max(0, window.innerWidth - 62 - 280 - 10)),
    /** 面板的 top 像素值（手动拖动后使用） */
    panelTop: z.number().default(Math.max(0, window.innerHeight * 0.4 - 50)),
    /** 面板是否已被用户手动拖动过（true=断开悬浮球跟随，使用独立位置） */
    panelManuallyPositioned: z.boolean().default(false),
  })
  .default({});

export const usePositionStore = defineStore('立绘悬浮窗-位置', () => {
  // 从脚本变量读取已有位置（如无则用 schema 默认值）
  const 位置 = ref(位置Schema.parse(getVariables({ type: 'script' })));

  // 每次位置变化，自动写回脚本变量
  // watchEffect 是 Vue 的自动追踪——用了哪个 ref，那个 ref 变了就触发回调
  watchEffect(() => {
    insertOrAssignVariables(klona(位置.value), { type: 'script' });
  });

  return { 位置 };
});
