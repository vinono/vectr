# Vectr - AI 智能语义图像画廊开发者手册 (agent.md)

本手册专为 AI 编码助手及开发者设计，详细记录了 **Vectr** 项目的系统架构、核心业务流程、开发规范与性能优化决策，以便于后续高效迭代并维持极高的代码质量。

---

## 🧭 项目概述
**Vectr** 是一个基于 AI 驱动的现代化智能多语言语义搜索画廊。用户可以批量拖拽上传高清照片，系统会自动在前端进行无损 EXIF 提取与 Canvas 智能压缩，随后通过 **Google Gemini Vision API** 自动生成高精度的英文描述，并使用 **Upstash Vector Database** 进行多语言向量化索引。在首页中，用户可以通过中文或英文自然语言进行 Cosine 相似度语义搜索，并享受零延迟、GPU 加速的沉浸式极简幻灯片预览。

---

## 🛠️ 技术栈与依赖 (Technology Stack)
- **前端核心**: Next.js 16.0.10 (Turbopack 编译器) + React 19 + TypeScript
- **样式系统**: Tailwind CSS v4 (现代化、极速 CSS 编译系统)
- **代码规范**: Biome 2.2.7 (负责代码检查与格式化，极其严格的规则控制)
- **对象存储**: `@vercel/blob` (负责存放压缩后的优化图片实体)
- **向量数据库**: `@upstash/vector` (使用 Dense 密集检索模式，BGE-M3 多语言嵌入模型)
- **AI 视觉引擎**: `@ai-sdk/google` (Google Gemini 2.5 Flash 视觉描述生成)
- **UI 组件库**: Radix UI + Vaul (抽屉) + Lucide React (图标系统)

---

## 🏗️ 核心业务流程与架构

### 1. 图片上传与“前端预压缩”流程
为了避免大图（相机/手机原图 10MB+）上传超时、超出 Serverless 请求体限制及占用高额 Blob 存储费用，系统采用了**“客户端预压缩 + EXIF 无损分离”**架构：
1. **EXIF 元数据提取**：在压缩前，使用 [lib/exif.ts](file:///Users/he/Desktop/vinono/vectr/lib/exif.ts) 直接从**原始未压缩文件**中读出相机、镜头、快门、ISO等元数据，保证即使 Canvas 重绘抹除文件头信息，参数也绝对无损。
2. **Canvas 智能预压缩**：通过 [app/upload/page.tsx](file:///Users/he/Desktop/vinono/vectr/app/upload/page.tsx) 中的 Canvas API，将大图缩放至最大边 `2048px` 并以 `0.8` 的质量导出为 JPEG/WebP，使体积骤降 95%（降至 `200KB~500KB`）。
3. **云端工作流处理**：
   - 客户端发送请求至 `/api/upload`。
   - 触发 Serverless 异步工作流 `processImage`：将压缩图存入 Vercel Blob -> 调用 Gemini 自动生成描述 -> 将描述、EXIF 和 URL 一并索引存入 Upstash Vector 数据库。

### 2. 多语言语义搜索与精准度判定 (Semantic Search)
- **纯 DENSE 相似度匹配**：传统的 Hybrid 混合检索对中文关键词和英文图像描述之间的匹配效果不佳。因此，系统全面采用 `@upstash/vector` 的 **`QueryMode.DENSE`** 密集匹配模式，完全依赖多语言向量嵌入。
- **绝对相关性阈值控制 (`RELEVANCE_THRESHOLD = 0.74`)**：
   - Cosine 相似度为绝对指标。经测试，设定阈值为 `0.74`。
   - 只有相似度 $\ge 0.74$ 的结果才予以展示。若无匹配项，将触发干净的空搜索结果界面，防止低相关性的噪声图片污染搜索体验。
   - 搜索入口位于首页底部的智能搜索栏。

### 3. 沉浸式幻灯片预览 (Zero-Latency Preview Lightbox)
预览模态框采用了一套高度优化的、无参考依赖的过渡控制体系：
- **`targetImage` 零延迟即时首帧渲染**：
  - 核心定义：`const targetImage = displayedImage || activeImage;`
  - 首次点击图片时，`targetImage` 立即降级渲染 `activeImage`（第 1 帧立即可见，实现 true 0ms 启动），避免了传统 `useEffect` 异步挂载导致的 1 帧黑屏闪烁。
  - 关闭模态框时，`activeImage` 清空，但 `displayedImage` 在 200ms 内依然保持原图渲染，给 CSS 淡出动效留出充足时间，保证过渡丝滑。
- **防止状态死循环与重复定时器**：
  - 退出动效受 `else if (displayedImage)` 严格守护。当两者皆空时，绝对不重复设置定时器，确保了极速连续开关、左右切换的绝对稳定性。
- **GPU 硬件加速画质优化**：
  - 环境背景采用大面积 `blur-2xl`（比 CPU 级别的 `blur-[100px]` 渲染开销低 10 倍以上），配合 `transform-gpu` 和 `will-change-[filter,transform]`，强制浏览器将画质重绘与图层混合全部交给 GPU 硬件渲染，流畅度拉满。

---

## 🎨 页面组件拓扑与性能决策
- **[Preview](file:///Users/he/Desktop/vinono/vectr/components/preview.tsx) 组件缓存化**：
  - 预览模态框的开启/关闭/切换均在父级 `ResultsClient` 中维护 `activeImageIndex` 状态。
  - 为了防止开启预览时全量画廊网格重新渲染导致的界面卡顿，`Preview` 卡片组件被包裹在 `React.memo` 中进行浅层比较，彻底杜绝网格无效刷新。
- **全局状态共享 (`UploadedImagesProvider`)**：
  - 挂载于最外层 [layout.tsx](file:///Users/he/Desktop/vinono/vectr/app/layout.tsx)，使从 `/upload` 上传页返回 `/` 主页后，上传的图片依然能够完美驻留在全局画廊状态中。
- **瀑布流避重叠机制**：
  - 画廊布局采用多列 masonry 排版。为防止浏览器在瀑布流底部切碎卡片，为每个卡片容器指定了 `inline-block` 与 `break-inside-avoid`。

---

## 🛑 开发与维护红线 (Development Constraints)

### 1. 严格遵守 Biome Linter 规范
本项目集成了极高标准的 Biome 代码检查工具，所有新代码修改必须保证 **零错误、零警告**：
- **禁止魔术数字**：所有硬编码数字（如超时时间、批处理大小、大小限制等）必须提取为大写常数，并添加注释。
- **认知复杂度上限**：单个函数/逻辑块的复杂度评分不得超过 **`15`**。若代码嵌套较深，必须拆分为内聚的纯函数（如将 Canvas 尺寸等比例计算拆分为独立工具函数 `calculateDimensions`）。
- **console.log 审查**：为了调试便利性在页面保留的必要日志（如压缩比输出），必须显式标注 `// biome-ignore lint/suspicious/noConsole: <Reason>`，其余无用日志一律清除。
- **规范的 React Hooks**：必须严格遵循 hooks 顶级调用顺序，条件执行内部不得包含 hooks，依赖数组必须完整。

### 2. 数据库变更红线
- 所有的图像查询、删除、更新均以数据库中的 **文件路径名 `pathname`** 作为唯一鉴权删除 Key。在做逻辑重构时，务必保证该主键在上下游（上传/存储/索引/删除）中的映射链完整一致。

---

## 🚀 常用维护指令
```bash
# 1. 启动本地开发服务器（开启 Turbopack 支持）
pnpm dev

# 2. 全量执行生产环境编译检测（在提交任何改动前必须运行，保证类型及 Prerender 无冲突）
pnpm build

# 3. 运行代码自动格式化
pnpm format

# 4. 执行 Biome 代码规范和质量检查 (如有报错必须当场解决)
pnpm check
```
