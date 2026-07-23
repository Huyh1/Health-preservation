#!/usr/bin/env node
/**
 * 养生知识库 - 元数据生成脚本
 *
 * 为文章生成三类扩展内容（程序自动生成，非 AI 精写）：
 *   1. summary     —— 总结 / 解析（抽取式：导语 + 含建议/方法的句子）
 *   2. videoScript —— 短视频文案（模板 + 文章要素填充）
 *   3. hashtags    —— 四个话题（由 季节/分类/主题 派生，补齐至 4 个）
 *
 * 用法：
 *   node scripts/generate-meta.js        # 仅生成示例文章（TARGET_IDS）
 *   node scripts/generate-meta.js all    # 为全部文章生成
 *
 * 输出：meta.js  ->  const ARTICLE_META = { <id>: {...}, ... };
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data.js');
const OUT_FILE = path.join(ROOT, 'meta.js');

// 仅生成示例时覆盖的文章 id；传 all 则全部
const TARGET_IDS = [0, 1, 2];

// ---------- 读取 data.js 中的 ARTICLE_DATA ----------
const src = fs.readFileSync(DATA_FILE, 'utf8');
const arrStart = src.indexOf('[', src.indexOf('const ARTICLE_DATA'));
const ARTICLE_DATA = eval(src.slice(arrStart)); // 形如 [ {...}, ... ];

// ---------- 生成函数 ----------
function splitSentences(text) {
  return text
    .split(/(?<=[。！？!?])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 6);
}

function makeSummary(content) {
  const text = content.replace(/\n+/g, ' ').trim();
  const sents = splitSentences(text);
  if (!sents.length) return text.slice(0, 100);
  const lead = sents[0];
  const kw = ['建议', '可以', '注意', '要', '应', '方法', '预防', '多吃', '少吃', '保持', '避免', '推荐'];
  const action = sents
    .slice(1)
    .filter((s) => kw.some((k) => s.includes(k)))
    .slice(0, 3);
  // 完整输出，不做字数截断（不使用“…”）
  return [lead, ...action].join('');
}

function makeVideoScript(article, summary) {
  // 标题作钩子 + 一句完整要点（取首句，不使用“…”）+ 轻量引导
  const lead = summary.split(/[。！？!?]/)[0].replace(/\s+/g, '').trim();
  return `${article.title}？\n${lead}\n关注我，每天一个实用养生小知识～`;
}

function makeHashtags(article) {
  // 注意：原始数据中部分 folderLabel 可能为截断值（如“为什”），
  // 因此话题不依赖 folderLabel，统一从 季节 + 主题 + 通用养生标签 派生。
  const set = [];
  (article.seasons || []).forEach((s) => set.push(s + '养生'));
  (article.topics || []).forEach((t) => {
    if (t && t !== '其他') set.push(t);
  });
  set.push('健康养生', '养生小知识');
  const PADDING = ['日常保健', '中医养生', '节气养生', '食疗养生'];
  const uniq = [...new Set(set)];
  let i = 0;
  while (uniq.length < 4 && i < PADDING.length) {
    if (!uniq.includes(PADDING[i])) uniq.push(PADDING[i]);
    i++;
  }
  return uniq.slice(0, 4);
}

// ---------- 执行 ----------
const ids = process.argv.includes('all')
  ? ARTICLE_DATA.map((a) => a.id)
  : TARGET_IDS;

const META = {};
ARTICLE_DATA.forEach((a) => {
  if (!ids.includes(a.id)) return;
  const summary = makeSummary(a.content || '');
  META[a.id] = {
    summary,
    videoScript: makeVideoScript(a, summary),
    hashtags: makeHashtags(a),
  };
});

const out =
  '// 文章扩展元数据（自动生成）\n' +
  '// 字段：summary 总结/解析, videoScript 短视频文案, hashtags 四个话题\n' +
  'const ARTICLE_META = ' +
  JSON.stringify(META, null, 2) +
  ';\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(`已生成 ${Object.keys(META).length} 篇元数据 -> ${path.relative(ROOT, OUT_FILE)}`);
