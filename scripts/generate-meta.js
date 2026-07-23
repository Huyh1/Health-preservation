#!/usr/bin/env node
/**
 * 养生知识库 - 元数据生成脚本（离线抽取式兜底）
 *
 * 为文章生成三类扩展内容（程序自动抽取，非 AI 精写）：
 *   1. summary     —— 总结 / 解析（导语 + 含建议/方法的句子，≤100 字，完整不截断）
 *   2. videoScript —— 短视频文案（两行：第1行“话题”≤30 字，第2行“内容”≤50 字）
 *   3. hashtags    —— 四个话题（由 季节 + 主题 + 通用养生标签 派生，补齐至 4 个）
 *
 * 说明：
 *   - 这是“离线兜底”方案。如需更自然、完整的高质量内容，请使用
 *     scripts/generate-meta-llm.js（调用大模型，需配置 LLM_API_KEY）。
 *   - 若 meta.js 中已存在“高质量示例”（同时具备 summary / videoScript / hashtags），
 *     本脚本会保留它们，仅为其余文章生成兜底内容。
 *   - 正文“段落化排版”由 scripts/format-content.js 生成（只重排、不改内容），存于 formatted.js。
 *
 * 用法：
 *   node scripts/generate-meta.js          # 为全部文章生成（保留已有高质量示例）
 *   node scripts/generate-meta.js examples # 仅重新生成示例文章（TARGET_IDS）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data.js');
const OUT_FILE = path.join(ROOT, 'meta.js');

// 示例文章 id（examples 模式下仅生成这些）
const TARGET_IDS = [0, 1, 2, 3, 4];

// ---------- 读取 data.js 中的 ARTICLE_DATA ----------
const src = fs.readFileSync(DATA_FILE, 'utf8');
const ARTICLE_DATA = eval(src.slice(src.indexOf('[', src.indexOf('const ARTICLE_DATA'))));

// ---------- 读取已有 meta.js（用于保留高质量示例） ----------
let existing = {};
if (fs.existsSync(OUT_FILE)) {
  try {
    const ms = fs.readFileSync(OUT_FILE, 'utf8');
    existing = eval('(' + ms.slice(ms.indexOf('=') + 1).replace(/;\s*$/, '') + ')');
  } catch (e) {
    existing = {};
  }
}

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
  let out = sents[0];
  const kw = ['建议', '可以', '注意', '应', '方法', '预防', '多吃', '少吃', '保持', '避免', '推荐', '要', '需', '尽量', '最好'];
  // 累加含建议/方法的完整句子，整体控制在 100 字以内（不截断、不加“…”）
  for (let i = 1; i < sents.length && out.length < 80; i++) {
    if (kw.some((k) => sents[i].includes(k))) {
      if (out.length + sents[i].length <= 100) out += sents[i];
      else break;
    }
  }
  return out.slice(0, 100);
}

function makeVideoScript(article) {
  // 第1行“话题”≤30 字（以问句作钩子）
  let topic = (article.title || '').replace(/\s+/g, '').trim();
  if (!topic.endsWith('？') && !topic.endsWith('?')) topic += '？';
  if (topic.length > 30) topic = topic.slice(0, 30);
  // 第2行“内容”≤50 字（取一条可操作建议，完整不截断）
  const sents = splitSentences((article.content || '').replace(/\n+/g, ' '));
  const kw = ['建议', '可以', '注意', '应', '多吃', '少吃', '保持', '避免', '推荐', '要', '需', '尽量', '最好', '可'];
  let content = sents.find((s) => kw.some((k) => s.includes(k))) || sents[0] || '';
  content = content.replace(/\s+/g, '').trim();
  if (content.length > 50) content = content.slice(0, 50);
  return `${topic}\n${content}`;
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
const mode = process.argv.slice(2);
const onlyExamples = mode.includes('examples');
const ids = onlyExamples
  ? TARGET_IDS
  : ARTICLE_DATA.map((a) => a.id);

const META = {};
ARTICLE_DATA.forEach((a) => {
  if (!ids.includes(a.id)) return;
  const ex = existing[a.id];
  // 保留已存在的高质量示例（同时具备三项），避免被兜底内容覆盖
  if (!onlyExamples && ex && ex.summary && ex.videoScript && ex.hashtags) {
    META[a.id] = ex;
    return;
  }
  const summary = makeSummary(a.content || '');
  META[a.id] = {
    summary,
    videoScript: makeVideoScript(a),
    hashtags: makeHashtags(a),
  };
});

const out =
  '// 文章扩展元数据\n' +
  '// 说明：其中 id 0-4 为「大模型分析」生成的高质量示例；其余为 scripts/generate-meta.js\n' +
  '// 离线抽取式兜底生成（质量较低）。如需全量高质量内容，请用 scripts/generate-meta-llm.js。\n' +
  '// 字段：summary 总结/解析(≤100字), videoScript 短视频文案(话题≤30+内容≤50 两行), hashtags 四个话题\n' +
  'const ARTICLE_META = ' +
  JSON.stringify(META, null, 2) +
  ';\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(`已生成 ${Object.keys(META).length} 篇元数据 -> ${path.relative(ROOT, OUT_FILE)}`);
