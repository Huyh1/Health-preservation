#!/usr/bin/env node
/**
 * 养生知识库 - 基于大模型的元数据生成脚本（高质量）
 *
 * 与 scripts/generate-meta.js（离线抽取式，质量较低）不同，本脚本会把每篇文章的
 * 正文交给大模型“读懂后再写”，产出更自然的 总结/解析 与 短视频文案。
 *
 * 依赖 Node 18+（使用全局 fetch）。
 *
 * 配置（环境变量）：
 *   LLM_API_KEY    必填，大模型 API Key
 *   LLM_BASE_URL   可选，兼容 OpenAI Chat Completions 的地址，默认 https://api.openai.com/v1
 *   LLM_MODEL      可选，模型名，默认 gpt-4o-mini
 *   LLM_CONCURRENCY 可选，并发数，默认 5
 *
 * 用法：
 *   LLM_API_KEY=sk-xxx node scripts/generate-meta-llm.js          # 全部 296 篇
 *   LLM_API_KEY=sk-xxx node scripts/generate-meta-llm.js 0 1 2    # 仅指定 id
 *
 * 输出：覆盖 meta.js -> const ARTICLE_META = { ... };
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data.js');
const OUT_FILE = path.join(ROOT, 'meta.js');

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '5', 10);

if (!API_KEY) {
  console.error('缺少环境变量 LLM_API_KEY，请先设置后再运行。');
  process.exit(1);
}

// ---------- 读取 ARTICLE_DATA ----------
const src = fs.readFileSync(DATA_FILE, 'utf8');
const arrStart = src.indexOf('[', src.indexOf('const ARTICLE_DATA'));
const ARTICLE_DATA = eval(src.slice(arrStart));

// ---------- Prompt ----------
const SYSTEM_PROMPT = `你是一位资深的健康养生内容编辑。你会阅读用户提供的养生文章正文，
然后产出两类二次加工内容，用于内容分发与短视频制作。务必严格遵守以下字数限制：
1) summary（总结/解析）：用 2-4 句通顺中文，点明核心因果/原理并给出最关键的可操作建议，
   完整、准确、口语化，不要使用“……”省略，不要照抄原文长句。
   严格控制在 100 个汉字以内（含标点）。
2) videoScript（短视频文案）：格式为两行纯文本，不要加“关注我”等引导语、不要带 # 号：
   第一行 topic（话题）：一个吸引点击的钩子/标题，严格不超过 30 个汉字。
   第二行 content（内容）：核心干货建议，严格不超过 50 个汉字。
   两行之间用换行符 \\n 分隔。
3) hashtags（话题标签）：4 个适合作为短视频话题标签的词（不带 # 号，如“春季养生”），由文章的季节/主题引申。
只输出 JSON，不要任何解释或 markdown 代码块。`;

function buildUserPrompt(article) {
  const content = (article.content || '').slice(0, 4000);
  return `文章标题：${article.title}
所属季节：${(article.seasons || []).join('、') || '通用'}
主题分类：${(article.topics || []).join('、') || '养生'}
正文：
${content}

请严格按以下 JSON 结构返回（summary≤100字；videoScript 为“话题≤30字\n内容≤50字”两行）：
{"summary": "...", "videoScript": "话题\n内容", "hashtags": ["...", "...", "...", "..."]}`;
}

async function callLLM(article) {
  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(article) }
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  // 兼容被 ```json 包裹的返回
  const jsonStr = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(jsonStr);
}

// ---------- 并发控制 ----------
async function runPool(items, worker, concurrency) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// ---------- 执行 ----------
const args = process.argv.slice(2);
const targets = args.length
  ? args.map((s) => parseInt(s, 10))
  : ARTICLE_DATA.map((a) => a.id);

const META = {};
let done = 0;

(async () => {
  console.log(`准备为 ${targets.length} 篇文章调用模型（${MODEL}）…`);
  await runPool(targets, async (id) => {
    const article = ARTICLE_DATA.find((a) => a.id === id);
    if (!article) return;
    try {
      const r = await callLLM(article);
      META[id] = {
        summary: (r.summary || '').trim(),
        videoScript: (r.videoScript || '').trim(),
        hashtags: Array.isArray(r.hashtags) ? r.hashtags.slice(0, 4) : [],
      };
    } catch (e) {
      console.warn(`id ${id} 生成失败，跳过：${e.message}`);
    }
    done++;
    if (done % 20 === 0 || done === targets.length) {
      console.log(`进度 ${done}/${targets.length}`);
    }
  }, CONCURRENCY);

  const out =
    '// 文章扩展元数据（由大模型分析正文生成）\n' +
    'const ARTICLE_META = ' +
    JSON.stringify(META, null, 2) +
    ';\n';
  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`完成，成功生成 ${Object.keys(META).length} 篇 -> ${path.relative(ROOT, OUT_FILE)}`);
})();
