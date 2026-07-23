#!/usr/bin/env node
/**
 * 养生知识库 - 正文“纯格式美化”脚本（不改内容，只重排排版）
 *
 * 与 scripts/generate-meta-llm.js（由模型“改写/精简”正文）不同，本脚本
 * 不做任何文字增删改，仅把 data.js 中每篇文章的原始正文重排为“有段落感”的排版：
 *   - 以原文自身的换行（\n）为单元切分；
 *   - 通过启发式规则识别“小标题”行，加 “## ” 前缀；
 *   - 其余行作为普通段落；
 *   - 段落之间用空行（\n\n）分隔。
 * 因此输出的 formattedContent 与原文逐字一致（仅多出 “## ” 前缀与空行）。
 *
 * 依赖 Node 18+。
 *
 * 用法：
 *   node scripts/format-content.js            # 全部 296 篇
 *   node scripts/format-content.js 0 1 2      # 仅指定 id
 *
 * 输出：formatted.js -> const ARTICLE_FORMATTED = { id: "格式化正文", ... };
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data.js');
const OUT_FILE = path.join(ROOT, 'formatted.js');

// ---------- 读取 ARTICLE_DATA ----------
const src = fs.readFileSync(DATA_FILE, 'utf8');
const arrStart = src.indexOf('[', src.indexOf('const ARTICLE_DATA'));
const ARTICLE_DATA = eval(src.slice(arrStart));

// ---------- 小标题识别（启发式，不改动文字） ----------
const HEADING_PATTERNS = [
  /^[\u4e00-\u9fa5]+[、.．]/,                 // 一、二、三、
  /^[（(][\u4e00-\u9fa5]+[)）]/,              // （一）（二）
  /^(为什么|怎么|如何|何谓|何为|哪些|什么|为啥|为何)/, // 设问式标题
  /(教你|方法|原则|步骤|食疗|预防|原因|建议|注意|常识|调理|误区|危害|好处|功效|须知|要点|禁忌)/, // 关键词标题
];

function isHeading(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.endsWith('？') || t.endsWith('?')) return true;          // 问句标题
  if (/[。！；：…]/.test(t)) return false;                        // 含句末标点 => 正文
  if (HEADING_PATTERNS.some((re) => re.test(t))) return true;
  if (t.length <= 12) return true;                               // 短行（无句末标点）视为小标题
  return false;
}

function formatContent(content) {
  const lines = String(content || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const blocks = lines.map((l) => (isHeading(l) ? '## ' + l : l));
  return blocks.join('\n\n');
}

// ---------- 执行 ----------
const args = process.argv.slice(2);
const targets = args.length
  ? args.map((s) => parseInt(s, 10))
  : ARTICLE_DATA.map((a) => a.id);

const FORMATTED = {};
let changed = 0;
for (const id of targets) {
  const article = ARTICLE_DATA.find((a) => a.id === id);
  if (!article) continue;
  const original = article.content || '';
  const formatted = formatContent(original);
  if (formatted.length < original.length) {
    console.warn(`id ${id} 格式化后长度变短，疑似内容丢失，已跳过。`);
    continue;
  }
  FORMATTED[id] = formatted;
  changed++;
}

const out =
  '// 文章正文“纯格式美化”结果（由 scripts/format-content.js 生成）\n' +
  '// 与原文逐字一致，仅重排段落并标注小标题（## 开头），不含任何内容改写。\n' +
  'const ARTICLE_FORMATTED = ' +
  JSON.stringify(FORMATTED, null, 2) +
  ';\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(`完成，生成 ${changed} 篇格式化正文 -> ${path.relative(ROOT, OUT_FILE)}`);
