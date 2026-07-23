# 养生知识库

一个纯静态的中医养生知识浏览应用，汇集了按季节、分类、主题整理的日常保健与疾病预防文章，适合作为个人养生资料库。

## 功能特性

- **分类浏览**：按文件夹（如「预防」「春季」「夏季」等）梳理文章。
- **多维度检索**：
  - 关键词搜索（标题 / 内容 / 主题）
  - 按季节筛选（春 / 夏 / 秋 / 冬）
  - 按主题筛选（饮食养生、疾病预防、日常保健等）
- **阅读体验**：
  - 卡片式列表 + 详情页切换
  - 字数统计与阅读进度
  - 响应式布局，适配桌面与移动端
  - 深色配色，阅读友好

## 技术栈

- 纯原生 HTML / CSS / JavaScript
- 数据以 `data.js` 中的 `ARTICLE_DATA` 数组形式内联，无需后端与构建工具
- 零依赖，开箱即用

## 快速开始

无需安装任何依赖，直接用浏览器打开即可：

```bash
# 方式一：直接双击 index.html 用浏览器打开

# 方式二：本地起一个静态服务（推荐，避免个别浏览器对 file:// 的限制）
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 目录结构

```
health-preservation/
├── index.html             # 页面结构、样式与交互逻辑
├── data.js                # 文章数据（ARTICLE_DATA 数组，296 篇）
├── meta.js                # 文章扩展元数据（当前含 5 篇大模型高质量示例）
├── scripts/
│   ├── generate-meta.js       # 离线抽取式兜底脚本（质量较低，默认不生成）
│   └── generate-meta-llm.js   # 基于大模型的批量高质量生成脚本
└── README.md
```

## 扩展元数据（总结 / 解析、短视频文案、话题）

每篇文章可附带三类扩展内容，用于内容二次加工与短视频分发：

- `summary`：总结 / 解析（抽取式自动生成）
- `videoScript`：短视频口播文案（模板 + 文章要素填充）
- `hashtags`：四个话题标签（由 季节 + 主题 + 通用养生标签 派生）

这些数据独立于 `data.js`，存放在 `meta.js` 的 `ARTICLE_META` 中，按文章 `id` 索引：

```js
const ARTICLE_META = {
  0: {
    summary: "…",
    videoScript: "【开场钩子】…【场景切入】…【干货输出】…【行动建议】…【结尾引流】…",
    hashtags: ["春季养生", "过敏防护", "健康养生", "养生小知识"]
  }
};
```

在详情弹窗中，若某篇文章存在上述字段，会额外展示「总结 / 解析」「短视频文案」「话题」三个板块；列表卡片上也会标记「已解析」。

### 生成 / 更新元数据

推荐用 **大模型分析正文** 的方式生成高质量内容（更自然、完整）：

```bash
# 需 Node 18+，配置 API Key 后运行（兼容 OpenAI Chat Completions 接口）
LLM_API_KEY=sk-xxx node scripts/generate-meta-llm.js          # 全部 296 篇
LLM_API_KEY=sk-xxx node scripts/generate-meta-llm.js 0 1 2    # 仅指定 id

# 可选环境变量：LLM_BASE_URL（默认 https://api.openai.com/v1）、LLM_MODEL（默认 gpt-4o-mini）、LLM_CONCURRENCY（默认 5）
```

该脚本会把每篇文章的标题、季节、主题与正文交给模型，产出 `summary`（总结/解析）、`videoScript`（短视频文案）与 `hashtags`（四个话题），并覆盖写入 `meta.js`。

兜底方案（离线、抽取式、质量较低，默认不生成以免覆盖高质量示例）：

```bash
node scripts/generate-meta.js all    # 为全部文章做离线抽取（会覆盖 meta.js）
```

`meta.js` 当前已内置 5 篇由模型分析生成的高质量示例（过敏 / 冬令瘙痒 / 夏季桃花癣 / 防晒 / 春困食疗）。生成后刷新页面即可生效；也可手动编辑 `meta.js` 中对应条目微调。

## 数据格式

`data.js` 中每篇文章为一个对象，字段如下：

```js
{
  "id": 0,                 // 唯一标识
  "title": "标题",
  "folder": "预防",         // 所属分类文件夹
  "folderLabel": "预防",    // 分类展示名称
  "seasons": ["夏季"],      // 关联季节
  "topics": ["疾病预防"],   // 主题标签
  "content": "正文内容…",   // 文章正文
  "contentLength": 123,     // 正文字数
  "fileName": "xxx.txt",    // 原始文件名
  "filePath": "/Users/.../xxx.txt"  // 原始路径
}
```

当前共收录 **296** 篇文章，涵盖春、夏、秋、冬四季及饮食、运动、穴位、疾病预防等主题。

## 使用说明

1. 顶部搜索框输入关键词，实时过滤文章。
2. 点击季节或主题标签进行组合筛选。
3. 点击任意文章卡片进入详情页阅读，可返回列表。

## 自定义数据

将文章按上述格式追加到 `data.js` 的 `ARTICLE_DATA` 数组末尾即可（保持 `id` 唯一递增）。保存后刷新页面即可生效。
