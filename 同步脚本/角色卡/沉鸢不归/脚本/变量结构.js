import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

function getStage(name, goodwill) {
  const stages = {
    闻浅: [[91,'唯一执念'],[71,'深度交融']],
    安樱: [[91,'如梦初醒'],[71,'无虑沉溺']],
    颜絮: [[91,'不顾一切'],[71,'珍贵渴望']],
    姜野: [[91,'彻底臣服'],[71,'认输不认账']],
    苏小眠: [[91,'偷偷独占'],[71,'暗中炽热'],[41,'胆怯深爱']],
    凌千夏: [[91,'疯狂占有'],[71,'卸甲归心'],[41,'傲娇深陷']],
    宋薄寒: [[91,'炽热独钟'],[71,'冰冷消融']],
    裴寒露: [[86,'挣脱枷锁'],[61,'主动索取'],[31,'暗藏渴望']],
    乔晚: [[86,'正牌争夺'],[61,'公开亲近'],[31,'隐秘偏爱']],
    时染: [[81,'甘愿沉沦'],[56,'欲罢不能'],[26,'背德刺激'],[0,'禁忌初尝']],
  };
  const thresholds = stages[name];
  if (!thresholds) return '深度交融';
  for (const [t, s] of thresholds) {
    if (goodwill >= t) return s;
  }
  return thresholds[thresholds.length - 1][1];
}

export const Schema = z.object({
  世界: z.object({
    当前日期: z.string().prefault('6月12日·周四'),
    当前时间: z.string().prefault('上午'),
    当前场景: z.string().prefault('云垂大学'),
    天气: z.string().prefault('晴'),
    在场角色: z.array(z.string()).prefault([]),
  }).prefault({}),
  沈鸢: z.object({
    当前位置: z.string().prefault('云垂大学'),
    当前状态: z.string().prefault('平静'),
    服装: z.object({
      上衣: z.string().optional(),
      下身: z.string().optional(),
      内衣: z.string().optional(),
      袜子: z.string().optional(),
      鞋子: z.string().optional(),
    }).prefault({}),
  }).prefault({}),
  炮友数据: z.record(z.string().describe('角色名'), z.object({
    好感度: z.coerce.number().transform(n => Math.max(0, Math.min(100, n))).prefault(50),
    当前阶段: z.string().prefault('深度交融'),
    当前状态: z.string().prefault('平静'),
    最后见面: z.string().prefault('本周'),
    服装: z.object({
      上衣: z.string().optional(),
      下身: z.string().optional(),
      内衣: z.string().optional(),
      袜子: z.string().optional(),
      鞋子: z.string().optional(),
    }).prefault({}),
  }).transform(data => {
    return { ...data };
  }).prefault({})).prefault({}),
}).prefault({});

$(() => {
  registerMvuSchema(Schema);
});