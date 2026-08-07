# English Agent 能力规划与实施路线

## 1. 先说结论：从哪里开始

不要先把 RAG、MCP、Skills、Tools、Graph 一次性接进来。第一步应当是建立**可重复的评测基线**，第二步完成一个可独立验收的**中文转英文垂直切片**，再逐步加入文件、RAG、用户水平画像和联网搜索。

推荐顺序：

1. Phase 0：修复身份边界，建立评测集和分步骤指标。
2. Phase 1：完成中文转英文能力，并用固定数据集得到第一组基线分数。
3. Phase 2：引入 Skills 和 Graph，显式路由翻译、纠错、查词和普通对话。
4. Phase 3：完成文件上传、文本提取和整篇转换，再加入文件 RAG。
5. Phase 4：根据历史证据建立 CEFR 英语水平画像，并让回答自适应。
6. Phase 5：通过受控 Tools/MCP 完成专业联网问答，并返回来源。
7. Phase 6：加入实验版本、线上反馈、回归门禁和指标看板。

每个 Phase 都必须遵守：

> 先写验收样例和基线 → 实现 → 跑同一批样例 → 比较质量、延迟、成本和失败率 → 达标后再进入下一阶段。

---

## 2. 当前代码已经具备的基础

当前不是从零开始，已有能力包括：

- `agent.service.ts`
  - 使用 LangChain `createAgent`。
  - 使用 DeepSeek 模型。
  - 使用 PostgreSQL Checkpointer 保存 LangGraph 会话状态。
  - 支持 SSE 流式输出和取消请求。
  - 将 Human/AI 消息写入 Prisma。
  - 记录 token、首 token 延迟、总耗时、成本和状态。
- `tools/`
  - `lookup_word`：联网查询词典。
  - `correct_english`：结构化英文纠错。
- `prompt/`
  - 已有英语学习教练的系统提示词。
  - Assistant 与 Conversation 已持久化。
- Prisma
  - 已有 `ChatAssistant`、`ChatConversation`、`ChatMessage`。
  - 已有 `ChatAttachment`，包含文件地址、提取文本和处理状态。
  - 已有 `LlmRun`。
- `metrics/`
  - 已有运行记录和 7/14/30 天查询。
  - 前端已有 token、缓存、延迟、成本和评分展示入口。
- 基础设施
  - 已有 MinIO，可复用为原始文件存储。
  - 已有 Jest 配置，但 AI 模块目前没有实际测试。

当前最主要的缺口：

- 没有明确的意图路由，所有任务都由同一个 Agent 和同一组 Tools 自由决定。
- 没有中文转英文的结构化输出和专项评测。
- `ChatAttachment` 只有表结构，没有上传、解析、转换和检索流程。
- 没有 embedding、向量索引、召回、引用和 RAG 评测。
- 没有英语水平画像，只把历史消息交给会话 Checkpointer。
- 没有专业搜索 Tool、网页抓取、来源校验和引用。
- 没有 MCP 客户端或 MCP Tool 注册层。
- `qualityScore` 当前始终写入 `null`，接口又把它显示为 `0`，不能表示真实质量。
- metrics 只记录整次请求，没有记录 Graph 节点、Tool、检索和评测步骤。
- `correct_english` 内部会再次调用 LLM，但该次调用的 token、延迟和成本没有进入 metrics，当前总成本会被低估。
- `promptVersion` 当前固定为 `v1`，没有绑定真实 Prompt、Assistant 或配置版本，修改前后无法可靠对比。
- metrics 查询最多取 200 条再聚合，数据量变大后趋势会失真。
- 被用户取消的请求不记指标，无法看到取消率。
- AI 接口当前从请求体/query 接受 `userId`，AI Axios 和原生 SSE 请求也没有附加认证头。后端必须从已验证的 token 获取用户，不能信任客户端传入的 `userId`。
- 现有 `AuthGuard` 在缺少 Authorization header 时仍继续读取并切分 header，接入 AI 接口前必须先修复。
- AI 服务没有全局 DTO 校验，文件大小、MIME、输入长度和枚举值都还缺少边界保护。

---

## 3. 产品能力应补充成什么样

### 3.1 MVP 必须有

#### A. 中文转英文

不只是直译，还应支持：

- 使用场景：日常、学术、商务、邮件、面试、技术文档。
- 目标语气：自然、正式、简洁、礼貌、母语化。
- 返回：
  - 主译文。
  - 1 个可选译法。
  - 关键表达说明。
  - 可能歧义；存在歧义时先追问。
- 对术语、专有名词和用户给定 glossary 保持一致。
- 长文本按段落处理，但最终做全局一致性检查。

#### B. 英文学习教练

- 纠错、润色和解释错误。
- 查词、搭配、例句和近义词辨析。
- 根据用户水平调整：
  - 中文解释比例。
  - 英文难度。
  - 例句长度。
  - 练习难度。
- 给出短练习，并能根据后续回答继续反馈。

#### C. 文件转换

第一版先支持：

- `.txt`、`.md`。
- 文本型 `.pdf`。
- `.docx`。

转换动作：

- 中文文件翻译成英文。
- 英文文件纠错/润色。
- 双语对照输出。
- 摘要、术语表和重点表达提取。

第一版不要立即支持扫描 PDF、复杂表格、PPT 和音视频。它们需要 OCR、版面分析或转录，应作为独立后续能力。

#### D. 英语水平画像

采用 CEFR：A1、A2、B1、B2、C1、C2。

画像至少包含：

- `overallLevel`：综合等级。
- `grammarLevel`：语法。
- `vocabularyLevel`：词汇。
- `fluencyLevel`：表达流利度。
- `readingLevel`：阅读理解。
- `writingLevel`：写作。
- `confidence`：当前判断可信度。
- `evidenceCount`：有效证据数量。
- `lastAssessedAt`：最后评估时间。

注意：

- 不能只根据一两句话永久判级。
- 中文提问不能作为英语能力低的证据。
- 用户复制的专业英文不能直接当作用户自身水平。
- 历史推断只是弱标签；分级测试或人工评分才是强标签。
- 画像更新应保留证据和版本，不能只覆盖最终等级。

#### E. 专业联网问答

是否联网不应只由“用户水平高”决定，而应由问题是否需要**最新、可验证、外部信息**决定。用户水平决定答案语言难度，问题性质决定是否搜索。

专业联网回答必须：

- 搜索多个来源。
- 优先官方文档、论文、标准和一手资料。
- 区分资料发布时间和事件发生时间。
- 在答案中给出可点击来源。
- 明确哪些是来源事实，哪些是模型总结。
- 搜不到可靠来源时直接说明不确定，不能编造。

### 3.2 后续能力

- 个性化学习目标和周计划。
- 错题本、易错表达和间隔复习。
- 基于历史弱项自动出题。
- 用户术语库与组织知识库。
- 口语音频、发音评分和对话练习。
- 导出 DOCX/PDF/Markdown。

这些能力不进入第一轮实现，避免 MVP 范围失控。

---

## 4. RAG、MCP、Skills、Tools、Graph 各自负责什么

### 4.1 Tools：执行一个边界清晰的动作

Tool 应满足：输入结构化、输出结构化、可独立测试、有超时、有错误码。

现有：

- `lookup_word`
- `correct_english`

建议新增：

- `translate_zh_to_en`
- `retrieve_user_documents`
- `get_user_english_profile`
- `record_learning_evidence`
- `web_search`
- `fetch_web_page`

不要把“完成整个英语老师任务”做成一个 Tool。Tool 应小而确定。

### 4.2 Skills：可版本化的任务策略

本项目里的 Skill 可以定义为：

- 任务目标。
- Prompt 模板。
- 允许使用哪些 Tools。
- 输出 Schema。
- 失败和追问策略。
- 对应评测维度。
- Skill 版本。

首批 Skills：

- `translation.skill.ts`
- `correction.skill.ts`
- `document-conversion.skill.ts`
- `level-adaptation.skill.ts`
- `professional-research.skill.ts`

Skill 不是 Tool：

- Tool 负责“做一个动作”。
- Skill 负责“为了完成一个任务，按什么策略组合模型和 Tools”。

### 4.3 Graph：编排有状态、多分支流程

当只有普通聊天时，`createAgent` 已足够。出现翻译、文件、画像和联网问答后，再用 `StateGraph` 把路由显式化。

建议 Graph：

```text
START
  -> validate_request
  -> classify_intent
  -> load_user_profile
  -> route
       -> translation
       -> correction_or_lookup
       -> document_conversion_or_rag
       -> professional_research
       -> learning_chat
  -> compose_answer
  -> persist_messages
  -> record_metrics
  -> END
```

关键原则：

- 确定性校验、权限、文件状态不能交给 LLM 决定。
- 路由优先使用结构化输出。
- 每个节点可独立记录耗时、token、错误和版本。
- Graph State 只放本次运行需要的数据，不要把所有历史全文都塞进去。

### 4.4 RAG：从用户文件或知识库取回证据

文件 RAG 流程：

```text
上传
  -> 文件校验
  -> MinIO 私有存储
  -> 文本提取
  -> 清洗与保留页码/段落信息
  -> 分块
  -> Embedding
  -> 向量索引
  -> READY

提问
  -> 查询改写
  -> 按 userId/conversationId 做权限过滤
  -> 混合召回
  -> 可选重排
  -> 带引用生成
```

RAG 不能替代用户画像：

- 文件内容放向量库。
- 稳定的水平、偏好和弱项放结构化 Profile。
- 最近会话由 Checkpointer/消息表提供。
- 长期学习证据单独存储并定期汇总。

### 4.5 MCP：连接外部能力的协议层

MCP 适合放在专业搜索、外部知识库或未来第三方服务边界。

第一版不要为了“使用 MCP”而重写现有词典 Tool。推荐：

1. 先定义统一 `ExternalToolAdapter`。
2. 让本地 LangChain Tool 和 MCP Tool 转成同一种内部描述。
3. 先接一个只读搜索 MCP Server。
4. 配置 Tool allowlist、超时、最大输出和审计日志。
5. MCP 不可用时降级为“无法联网”，不要让整个学习对话失败。

---

## 5. 推荐目录边界

不要继续把所有逻辑堆到 `agent.service.ts`。建议逐步拆分：

```text
apps/backend/apps/ai/src/
├── agent/
│   ├── agent.service.ts                 # 对外运行入口，逐步变薄
│   ├── graph/
│   │   ├── agent.state.ts
│   │   ├── agent.graph.ts
│   │   ├── intent.schema.ts
│   │   └── nodes/
│   ├── skills/
│   │   ├── skill.types.ts
│   │   ├── skill.registry.ts
│   │   ├── translation.skill.ts
│   │   ├── correction.skill.ts
│   │   ├── document-conversion.skill.ts
│   │   └── professional-research.skill.ts
│   └── tools/
│       ├── translate-zh-to-en.tool.ts
│       ├── retrieve-documents.tool.ts
│       ├── web-search.tool.ts
│       └── fetch-web-page.tool.ts
├── attachment/
│   ├── attachment.controller.ts
│   ├── attachment.service.ts
│   ├── document-parser.service.ts
│   └── parsers/
├── rag/
│   ├── ingestion.service.ts
│   ├── chunking.service.ts
│   ├── embedding.service.ts
│   └── retrieval.service.ts
├── profile/
│   ├── profile.service.ts
│   ├── assessment.service.ts
│   └── cefr.schema.ts
├── mcp/
│   ├── mcp.module.ts
│   ├── mcp-client.service.ts
│   └── mcp-tool-adapter.ts
├── evaluation/
│   ├── datasets/
│   ├── evaluators/
│   └── evaluation.service.ts
└── metrics/
    ├── metrics.service.ts
    ├── metrics.controller.ts
    └── run-observer.service.ts
```

附件、RAG、Profile、MCP 是独立领域模块，不建议全部放在 `agent/` 下。Agent 只负责组合它们。

---

## 6. Metrics 如何真正回答“提升了多少”

### 6.1 当前指标只能回答什么

现在可以粗略回答：

- 使用了多少 token。
- 首 token 和总耗时。
- 粗估成本。
- 请求是否抛出异常。

现在不能回答：

- 翻译是否更准确。
- RAG 是否找到了正确段落。
- 用户等级判断是否可靠。
- 联网回答是否有真实、正确的来源。
- 哪一个 Graph 节点或 Tool 变慢/失败。
- 新版本相对旧版本到底提升多少。

### 6.2 不要依赖单一 `qualityScore`

不同场景必须有不同指标。

翻译：

- 含义完整度。
- 流利度。
- 术语一致性。
- 语气/场景符合度。
- 不必要增删内容比例。

文件：

- 文本提取成功率。
- 字符/段落提取覆盖率。
- 转换完成率。
- 大文件耗时和失败率。

RAG：

- `Recall@K`：正确证据是否被召回。
- `MRR`：正确证据排名。
- Groundedness：答案是否被证据支持。
- Citation correctness：引用是否真的支持对应结论。
- 无答案问题的拒答准确率。

英语水平：

- 与人工/分级测试标签的一致率。
- CEFR 相差一级以内的比例。
- 分维度准确率。
- 置信度校准。
- 画像更新稳定性，避免等级频繁跳动。

专业联网问答：

- 搜索成功率。
- 官方/一手来源占比。
- 无效链接率。
- 引用支持率。
- 新鲜度。
- 事实正确性。

全局：

- 请求成功率和取消率。
- p50/p95 首 token 延迟。
- p50/p95 总耗时。
- 每次成功任务成本。
- Tool 调用成功率。
- 用户点赞/点踩和继续追问率。

### 6.3 建议补充的数据模型

可以在现有 `LlmRun` 上补充：

- `traceId`
- `assistantId`
- `parentRunId`
- `route`
- `skillId`
- `skillVersion`
- `graphVersion`
- `promptHash`
- `agentConfigHash`
- `experimentId`
- `variant`
- `finishReason`
- `errorCode`
- `aborted`

新增 `AgentStep`：

- `runId`
- `stepName`
- `stepType`：model/tool/retrieval/parser。
- `startedAt`
- `durationMs`
- `inputTokens`
- `outputTokens`
- `status`
- `errorCode`
- `metadata`

新增离线评测模型：

- `EvalDataset`
- `EvalCase`
- `EvalRun`
- `EvalResult`

新增线上反馈模型：

- `ChatFeedback`
  - `messageId`
  - `userId`
  - `rating`
  - `reason`
  - `createdAt`

质量评测结果建议存 `dimensionScores Json`，总分只用于看板概览，不能替代各维度。

### 6.4 提升计算方式

每次修改必须使用同一个冻结数据集，对旧版本和新版本做成对比较。

```text
绝对提升 = newScore - baselineScore
相对提升 = (newScore - baselineScore) / baselineScore
性能变化 = newP95 - baselineP95
成本变化 = newAvgCost - baselineAvgCost
```

发布门槛示例：

- 场景主质量指标必须提升或持平。
- 关键安全/引用指标不能下降。
- p95 延迟增长不得超过预设预算。
- 平均成本增长必须有明确质量收益。
- 任一已有评测 case 出现严重回归则阻止发布。

### 6.5 先建立最小冻结评测集

`evaluation/datasets/v1/` 建议先放：

- 中文转英文 30 条：
  - 日常 8。
  - 商务/邮件 8。
  - 技术 8。
  - 歧义与应追问 6。
- 英文纠错 20 条。
- 词典查询 10 条。
- 文件转换 10 个小文件。
- 文件 RAG 20 个有答案问题 + 10 个无答案问题。
- CEFR 评估样本每级至少 10 条，后续继续扩充。
- 专业联网问答 20 条，其中一半要求最新信息。

每条 case 应包含：

- `id`
- `scene`
- `input`
- `context`
- `expected`
- `rubric`
- `tags`
- `critical`

LLM-as-judge 只能作为自动化辅助。先人工检查一批 judge 结果，确认与人的判断基本一致，再用于回归。

---

## 7. 分阶段修改与测试

## Phase 0：安全边界与可测基线

### 目标

先保证后续数据可信、用户数据不串号、每次修改可比较。

### 修改

1. 修复现有 `AuthGuard` 的缺失/异常 Authorization header 处理，再为 Chat、Prompt、Attachment、Metrics 等全部 AI API 接入 JWT Guard。
2. 从 token 获取 `userId`，删除或忽略 Body/Query 中的 `userId`。
3. `aiApi` 和 SSE 请求补 Authorization header。
4. 在 `main.ts` 增加 `ValidationPipe`。
5. 为 Chat DTO 建立运行时校验：输入长度、conversationId、attachmentIds。
6. 修复 metrics：
   - 保留 `qualityScore = null`，前端显示 `--`，不要显示成 0。
   - 记录 aborted。
   - 趋势在数据库聚合，不要先 `take: 200`。
   - 记录真实 `assistantId`，并用 Prompt hash/配置 hash 代替写死的 `promptVersion = v1`。
   - 主 Agent 与 Tool 内部的每次 LLM 调用都要计量，并通过 `parentRunId` 关联。
   - 错误埋点继续不能阻断主流程，但要有结构化日志。
7. 添加第一个 Jest 测试和评测命令。
8. 建立 `evaluation/datasets/v1/translation.jsonl`。

### 重点文件

- `agent/agent.controller.ts`
- `agent/agent.service.ts`
- `packages/common/chat/index.ts`
- `apps/frontend/src/apis/index.ts`
- `apps/frontend/src/apis/sse/index.ts`
- `metrics/metrics.service.ts`
- `packages/common/metrics/index.ts`
- `prisma/schema.prisma`

### 测试

- 用用户 A 的 token 访问用户 B 的 conversation，必须返回 403/404。
- Body 伪造 `userId` 不能越权。
- 空输入、超长输入和无效 ID 返回 400。
- 正常、失败、取消三种请求都有 Run。
- `qualityScore = null` 在看板显示 `--`。
- 运行同一批翻译 case，保存 `baseline-v1`，此时即使质量普通也不要修改数据集。

### 完成标准

- 身份不再依赖客户端传入 `userId`。
- 有至少 30 条冻结翻译样例。
- 能输出 baseline 的质量、p95 延迟、平均 token 和成本。

---

## Phase 1：中文转英文垂直切片

### 目标

先完成一个真正可验收的 Agent 能力。

### 修改

1. 在 `output-schemas.ts` 增加 `translationResultSchema`：
   - `translation`
   - `alternative`
   - `keyExpressions`
   - `ambiguities`
   - `needsClarification`
2. 新建 `translate-zh-to-en.tool.ts`。
3. 新建 `translation.skill.ts`，定义：
   - 支持的场景与语气。
   - 何时追问。
   - 术语保持规则。
   - 输出 Schema。
   - `skillVersion = translation-v1`。
4. 在系统 Prompt 中明确何时调用翻译能力。
5. Run 记录 `route=translation`、`skillId`、`skillVersion`。
6. SSE 后续可以新增 `metadata` 事件，让前端区分译文、备选和解释；第一版也可先转成可读文本。

### 单元测试

- 空文本。
- 普通中文。
- 商务语气。
- 技术术语。
- 有歧义的中文。
- 模型异常时返回统一错误。

### 离线评测

- 对 30 条冻结样例跑旧 Prompt 和 translation-v1。
- 人工抽检所有 `critical=true` case。
- 对比完整度、流利度、术语和指令遵循。

### 完成标准

- 翻译路由准确率达到预设目标。
- 严重漏译/反义不高于预设阈值。
- 质量提升可量化，同时报告延迟和成本变化。

---

## Phase 2：Skills 注册与显式 Graph 路由

### 目标

让项目清楚展示 Skills、Tools 和 Graph 的职责，而不是继续依赖 Agent 自由选择。

### 修改

1. 定义 `SkillDefinition`：
   - id/version/description。
   - prompt。
   - tools。
   - outputSchema。
   - evaluationDimensions。
2. 实现 `SkillRegistry`。
3. 将现有纠错、查词和翻译注册成 Skills。
4. 新建结构化 `IntentSchema`：
   - translation
   - correction
   - vocabulary
   - document
   - professional_research
   - learning_chat
5. 用 `StateGraph` 建立最小 Graph。
6. 每个 Node 通过 `RunObserver` 记录 AgentStep。
7. 保留 fallback：分类失败进入 `learning_chat`。

### 测试

- 为每种 intent 准备正例和容易混淆的反例。
- 测 route 选择、fallback 和节点错误传播。
- 模拟 Tool 超时，Graph 应返回可解释错误。
- Checkpointer 恢复后不能重复写消息或重复调用有副作用 Tool。

### 完成标准

- 每个请求在 metrics 中能看到 route 和步骤耗时。
- 路由评测达到目标。
- 纠错、查词和翻译原有功能无回归。

---

## Phase 3A：文件上传与直接转换

### 目标

先完成“上传一个文件并转换”，暂时不做向量检索。

### 修改

1. 新增附件 API：
   - `POST /attachments`
   - `GET /attachments/:id`
2. 校验：
   - token 用户拥有 conversation。
   - MIME 与扩展名双重检查。
   - 单文件大小限制。
   - 文件名清洗。
3. MinIO bucket 改为私有，返回短时预签名 URL；学习文档不应公开读。
4. 解析 txt/md/pdf/docx。
5. 将提取文本写入 `ChatAttachment.textContent`。
6. 状态：
   - UPLOADED
   - PROCESSING（需要新增）
   - READY
   - ERROR
7. `ChatDto` 增加 `attachmentIds`。
8. 文件必须先 READY 才能进入转换 Skill。
9. 小文件同步处理；较大文件后续接队列，避免占用 SSE 请求。

### 测试

- 每种支持格式一个正常样例。
- 空文件、损坏文件、伪造 MIME、超限文件。
- A 用户不能读取 B 用户附件。
- 解析失败后状态和错误信息正确。
- 长文件分段转换后段落顺序、术语和标题不丢失。

### 完成标准

- 支持格式的文本提取成功率达到目标。
- 文件转换结果可下载或复制。
- 文件失败不影响同一会话继续聊天。

---

## Phase 3B：文件 RAG

### 目标

允许用户基于已上传文件提问，并返回页码/段落引用。

### 修改

1. PostgreSQL 开启 pgvector，或明确选择独立向量库。
2. 新增 DocumentChunk：
   - attachmentId
   - userId
   - content
   - page/section
   - chunkIndex
   - embedding
   - metadata
3. 实现 chunk、embedding 和索引。
4. `retrieve_user_documents` 强制按 `userId` 和允许的附件范围过滤。
5. 回答返回引用：
   - attachmentId
   - fileName
   - page/section
   - chunkId
6. 提供无证据拒答。
7. 记录 retrieval query、topK、召回耗时和命中文档。

### 测试

- 有答案、跨段答案、无答案和冲突答案。
- 不同用户、不同会话的隔离。
- 删除附件后 chunk 一并删除。
- 重新解析时向量版本正确替换。
- 计算 Recall@K、MRR、Groundedness 和 Citation correctness。

### 完成标准

- 达到预设 Recall@K。
- 所有引用都能定位到原文件。
- 无证据时不会凭空回答。
- 权限隔离测试 100% 通过。

---

## Phase 4：历史证据与 CEFR 用户画像

### 目标

从历史英文输出中积累证据，让回答难度自适应。

### 修改

1. 新增 `UserEnglishProfile`。
2. 新增 `EnglishLevelEvidence`：
   - sourceMessageId
   - sourceType
   - observedFeatures
   - dimensionScores
   - proposedLevel
   - confidence
   - evaluatorVersion
3. 只分析用户自己产生的英文。
4. 达到最小证据量或固定间隔后再更新 Profile。
5. 提供用户可见的“当前判断 + 依据 + 手动重测/修正”。
6. Graph 的 `load_user_profile` 节点只加载摘要，不加载所有证据。
7. Skill 根据 Profile 调整解释和例句，但不降低事实准确性。

### 测试

- A1-C2 标注样例。
- 中文消息、引用文本和上传文档不能污染画像。
- 单条异常消息不能造成等级跳跃。
- 手动修正优先级高于弱推断。
- 用人工标注集计算一致率、相差一级以内比例和置信度校准。

### 完成标准

- 达到最小证据量之前显示“证据不足”。
- 画像变化可追溯。
- 自适应回答在人工盲评中优于统一难度回答。

---

## Phase 5：专业联网问答与 MCP

### 目标

对需要最新或专业资料的问题进行可审计的联网研究。

### 修改

1. 先实现统一搜索接口，再选择本地 Tool 或 MCP 实现。
2. MCP Client 只注册 allowlist 中的只读 Tool。
3. `professional-research.skill.ts`：
   - 生成检索词。
   - 搜索。
   - 选择多个高质量来源。
   - 抓取正文。
   - 交叉核验。
   - 带引用生成。
4. 搜索结果记录 URL、标题、来源、发布时间和抓取时间。
5. 防止网页 Prompt Injection：
   - 网页内容始终视为不可信数据。
   - 网页中的指令不得改变系统规则或调用权限。
6. MCP/搜索服务超时、限流时降级。
7. Profile 只决定回答难度；联网由 freshness/verification need 决定。

### 测试

- 需要最新资料的问题必须搜索。
- 不需要搜索的语言学习问题不应浪费搜索成本。
- 官方资料应优先于转载。
- 无效 URL、冲突来源、搜索超时和恶意网页。
- 校验每个引用是否支持对应陈述。

### 完成标准

- 引用链接有效率和引用支持率达到目标。
- 搜索失败不会编造来源。
- 每次外部 Tool 调用在 AgentStep 中可审计。

---

## Phase 6：持续实验与发布门禁

### 目标

让 metrics 从展示面板升级为决策系统。

### 修改

1. 为 Prompt、Skill、Graph、模型和检索配置建立版本号。
2. 每个 Run 固化所有版本，避免事后无法复现。
3. 支持离线 EvalRun 比较 baseline 与 candidate。
4. 支持小流量 A/B：
   - 用户固定分桶。
   - 同一用户在实验期保持同一 variant。
   - 不按单次请求随机切换。
5. 增加点赞/点踩及原因。
6. Analytics 按 scene/route/version/variant 展示：
   - 质量。
   - p95 延迟。
   - 成本。
   - 失败率。
   - Tool/RAG 指标。
7. CI 中加入 critical case 回归门禁。

### 测试

- 同一用户稳定命中同一 variant。
- Run 能完整复现版本配置。
- 数据量超过 200 条时趋势仍正确。
- 无评分 Run 不进入平均质量分母。
- candidate 严重回归时 CI 失败。

---

## 8. 建议立即创建的第一批测试文件

```text
agent/
├── agent.service.spec.ts
├── graph/intent-classifier.spec.ts
├── tools/correct-english.tool.spec.ts
├── tools/lookup-word.tool.spec.ts
└── tools/translate-zh-to-en.tool.spec.ts
metrics/
└── metrics.service.spec.ts
attachment/
├── attachment.service.spec.ts
└── document-parser.service.spec.ts
rag/
└── retrieval.service.spec.ts
profile/
└── assessment.service.spec.ts
evaluation/
├── datasets/v1/translation.jsonl
├── datasets/v1/routing.jsonl
└── evaluation.service.spec.ts
```

测试分层：

1. Unit：Schema、路由、分块、解析、评分计算。
2. Contract：Tool 输入输出、MCP 适配、模型结构化输出。
3. Integration：Prisma、pgvector、MinIO、Checkpointer。
4. E2E：登录、建会话、发消息、上传文件、流式回复、查看 metrics。
5. Offline Eval：冻结数据集上的版本对比。
6. Security：越权、文件伪造、Prompt Injection、外部 Tool allowlist。
7. Load：长文件、并发 SSE、搜索超时、p95 延迟。

常用命令：

```bash
cd apps/backend
pnpm test
pnpm test -- agent
pnpm test -- metrics
pnpm type-check
pnpm build
```

---

## 9. 第一次动手建议拆成 5 个小任务

### Task 1：修复身份与 DTO

- AI API 接 JWT。
- 后端从 token 取 userId。
- AI Axios/SSE 附带 token。
- 加 ValidationPipe。
- 写越权和 DTO 测试。

### Task 2：修复 metrics 语义

- `qualityScore` 保持 nullable。
- 记录 aborted。
- 修复 200 条截断聚合。
- 给 Run 增加 assistantId、route、skillVersion、promptHash、agentConfigHash 和 traceId。
- 将 Tool 内部 LLM 调用计入成本，并用 parentRunId 关联主 Run。
- 写 metrics 单测。

### Task 3：建立 translation-v1 数据集

- 先人工写 30 条 case。
- 固化 rubric。
- 跑当前 Agent，保存 baseline。
- 不要在看到结果后修改测试答案来迎合模型。

### Task 4：实现 translation-v1

- Schema。
- Tool。
- Skill。
- 单测。
- 跑同一个评测集，输出质量/延迟/成本差值。

### Task 5：引入最小 Graph

- 只路由 translation、correction、vocabulary、learning_chat。
- 暂时不要接文件、RAG、Profile 和 MCP。
- 路由稳定后再开始 Phase 3。

建议现在从 **Task 1** 开始。如果当前目标主要是先学习 Agent 技术，也可以让 Task 2 和 Task 3 并行准备，但不能跳过基线直接做 RAG。

---

## 10. 配套学习文章顺序

这份 roadmap 对应的是边做边学的路线。阅读顺序不要按文章编号从头看到尾，而是跟着当前要改的工程问题走。每次动手前只看能减少本阶段误判的文章；做完后再看更深的模式文章，用来复盘为什么这样拆，以及下一阶段怎么扩。

### 10.1 现在动手前先看

这些文章应该在开始 Task 1 到 Task 5 前先读。目标不是记住所有概念，而是避免一开始把 Agent 做成“一个大 Prompt 加一堆工具”。

1. `docs/Agent/30. 如何设计一个Agent.md`
   - 先建立工程 Agent 的完整链路：需求、上下文、计划、权限、验证、评估和记忆。
   - 对应本项目：不要直接做 RAG/MCP，先把 run、route、metrics、权限和验收基线定住。
2. `docs/Agent/31. Agent为什么必须先做意图理解.md`
   - 先理解入口层不是简单分类，而是把用户请求还原成可执行前提。
   - 对应本项目：translation、correction、vocabulary、document、professional_research、learning_chat 不能只靠一个万能 Prompt 混在一起。
3. `docs/Agent/13. Workflow路由Routing先判断再分流.md`
   - 先学习 Router 输出为什么必须结构化，为什么要有 confidence、missingFields、riskLevel 和 fallback。
   - 对应本项目：Phase 2 的最小 Graph 应先做路由评测，再接文件、RAG 和联网。
4. `docs/Agent/27. Agent执行前为什么必须做权限风险确认闸门.md`
   - 先明确 Tool、文件、联网和外部内容不是普通文本，必须有权限、风险和确认边界。
   - 对应本项目：AI 接口鉴权、附件 userId 隔离、MCP allowlist、网页 Prompt Injection 防护都属于基础设施，不是后期优化。
5. `docs/langchain/9.让AI返回可控的结构化数据.md`
   - 先学 `zod` schema 和 `withStructuredOutput`。
   - 对应本项目：翻译结果、纠错结果、意图路由、CEFR 画像和评测结果都应该是结构化对象，不应该靠解析自然语言。
6. `docs/langchain/6.给Agent配备工具.md`
   - 先理解 Tool 的名称、描述、参数 schema、执行逻辑和工具调用循环。
   - 对应本项目：新增 `translate_zh_to_en`、`web_search`、`retrieve_user_documents` 时都要保持小而确定。
7. `docs/langchain/34. Langchain 中 Tool 设计怎么做可以降低参数错误.md`
   - 先学习字段收敛、枚举、业务校验、可修复错误和超时重试。
   - 对应本项目：Tool 不能只写 `z.object({ text: z.string() })` 就完事，还要返回结构化错误码并限制输出大小。
8. `docs/langchain/40. LangChain 的 Callback 机制与生命周期事件.md`
   - 先理解 LLM、Tool、Retriever、Agent 的 start/end/error 事件。
   - 对应本项目：metrics 不应该只在 `AgentService.stream()` finally 里写一条主 run；Tool 内 LLM、检索、解析都要能被观测。

### 10.2 Phase 0/1 做完后再看

完成鉴权、DTO、metrics 语义和 translation-v1 后，再看这些文章。此时你已经有第一个可评测能力，读这些内容会更容易知道为什么要拆 Skill 和 Graph。

1. `docs/langchain/19.Skills.md`
   - 重点看渐进式披露：先列能力摘要，用到时再加载完整技能。
   - 对应本项目：`translation.skill.ts`、`document-conversion.skill.ts`、`professional-research.skill.ts` 不应全部塞进一个系统 Prompt。
2. `docs/langchain/20.Router.md`
   - 重点看单路由、多路由扇出、子查询改写和流式综合。
   - 对应本项目：专业联网问答和文件 RAG 以后可能需要“搜索多个来源再综合”，但第一版 Graph 先做单路由。
3. `docs/langchain/21.Custom workflow.md`
   - 重点看 `StateGraph` 的状态、节点、边、条件边和 checkpointer。
   - 对应本项目：Phase 2 把 translation/correction/vocabulary/learning_chat 显式拆成节点，不要让模型自由决定整条链。
4. `docs/Agent/48. Graph和DAG框架.md`
   - 重点看链式调用、DAG、循环图和 Agent Workflow 的区别。
   - 对应本项目：翻译可以先是链，文件 RAG 和专业联网问答才更适合图。
5. `docs/Agent/73. StateMachineOrchestration模式为什么不能只靠LLM自由调度.md`
   - 重点看为什么生产系统不能只靠 LLM 自由调度。
   - 对应本项目：Graph 里确定性校验、权限、文件状态、失败降级都应由代码节点控制。

### 10.3 做文件、RAG、历史水平前再看

开始 Phase 3 和 Phase 4 前看这些。它们能帮你区分“聊天历史”“短期状态”“长期画像”“文件向量库”之间的边界。

1. `docs/langchain/31.Long-term memory.md`
   - 重点看 checkpointer 和 store 的区别，以及 Profile、Collection、Episodic、Procedural memory。
   - 对应本项目：`UserEnglishProfile` 是结构化 Profile，不是把所有聊天记录塞进向量库。
2. `docs/Agent/37. 什么是Agent记忆系统.md`
3. `docs/Agent/38. Agent记忆的8种常见策略.md`
4. `docs/Agent/39. 长期记忆和短期记忆应该存储在哪.md`
5. `docs/Agent/41. LangChain与LangGraph中的记忆分层与实现.md`
   - 这几篇连着看，用来确定历史消息、用户画像、学习证据、RAG 文档和 Checkpoint 各自放在哪里。
6. `docs/Agent/40. 短期记忆是否应该存储FunctionCall内容.md`
7. `docs/Agent/42. LangGraph中FunctionCallToolResultSummaryArtifact如何存储.md`
   - 对应本项目：Tool 原始结果、摘要、引用、附件解析 artifact 和消息 metadata 要分层存储，不能全塞进 ChatMessage 文本。
8. `docs/Agent/43. 上下文压缩记忆写回与状态一致性如何协同.md`
9. `docs/langchain/39. 长对话如何压缩历史又不丢关键信息.md`
   - 对应本项目：会话变长后不能无限把历史传给模型，应做摘要、画像和检索。

### 10.4 做 MCP、联网搜索和安全前再看

开始 Phase 5 前看这些。这个阶段会接触外部网页、外部服务和 MCP Tool，风险重点从“答错”变成“信错来源、越权调用、泄露数据”。

1. `docs/langchain/14.MCP连接外部工具的协议.md`
   - 重点看 MCP server、client、list tools、call tool 和 LangChain adapter。
   - 对应本项目：先把 MCP 当作外部工具接入协议，不要为了 MCP 重写本地 Tool。
2. `docs/Agent/5. PromptInjection为什么会导致越权与数据泄露.md`
3. `docs/Agent/9. 工具调用前的Schema权限风险校验分层.md`
4. `docs/Agent/45. TypeScript加LangGraph实现权限与安全Agent.md`
   - 对应本项目：网页内容、PDF 内容、MCP 返回值都必须视为不可信数据；Tool allowlist、资源权限、动作风险和审计必须在代码层实现。
5. `docs/Agent/32. Agent如何判断信息已经足够并停止搜索.md`
   - 对应本项目：专业联网问答需要停止条件，避免无限搜索、重复搜索和成本失控。
6. `docs/Agent/72. VetoGate模式为什么SafetyComplianceFactCheck应有否决权.md`
   - 对应本项目：专业答案、引用和事实核验失败时，安全/事实节点应能否决最终回答。

### 10.5 做长文件、异步任务和可恢复执行前再看

开始处理长文件、批量 RAG、后台任务或长图执行前看这些。

1. `docs/Agent/50. 超长任务与超长图执行时如何设计Checkpoint.md`
   - 重点看 checkpoint 保存的是恢复边界，不是普通 state dump。
   - 对应本项目：长文件解析、分段翻译、embedding 和检索构建都要拆成可恢复的小任务。
2. `docs/Agent/46. LangGraph的State为什么会膨胀以及如何控制.md`
   - 对应本项目：Graph state 只放当前运行所需摘要和引用，大文本放 artifact/store。
3. `docs/Agent/47. Agent长任务输出被截断如何断点续写与工程兜底.md`
   - 对应本项目：长文档转换不能只靠一次 LLM 输出，必须有章节级 artifact 和续写策略。
4. `docs/Agent/49. 多轮对话状态一致性与高并发问题.md`
   - 对应本项目：多个标签页、重复提交、取消和恢复都要考虑幂等与状态一致性。

### 10.6 暂时不建议优先读的文章

这些文章有价值，但不适合当前第一轮就投入太多时间：

- `docs/langchain/23.CoT.md`、`24.ToT.md`、`25.GoT.md`、`27.Plan-and-Execute.md`、`28.Reflexion.md`、`29.Self-Critic.md`、`30.LATS.md`
  - 这些偏推理策略和高级 Agent 算法。当前项目更缺的是权限、路由、结构化输出、评测和数据链路。
- `docs/Agent/51-71` 多 Agent 系列
  - 等单 Agent 的 route、metrics、Graph、Tool 边界稳定后再看。过早上多 Agent 会放大成本、延迟和上下文污染。

### 10.7 对应到当前 5 个小任务的最小阅读量

如果只想马上开工，每个任务前看这些即可：

- Task 1：`Agent/27`、`Agent/45`。
- Task 2：`langchain/40`、`Agent/50` 的 Run 元数据部分。
- Task 3：`langchain/9`，再补一遍本 roadmap 的 Metrics 章节。
- Task 4：`langchain/6`、`langchain/34`、`langchain/9`。
- Task 5：`Agent/31`、`Agent/13`、`langchain/21`、`Agent/48`。

处理完 Task 1-5 后，再按 Phase 3/4/5 分别去看记忆、RAG、MCP 和安全文章，这样学习路线会和代码修改互相印证。

---

## 11. 每次提交前的检查清单

- [ ] 这次只解决一个明确能力或一个基础问题。
- [ ] 有固定输入和预期验收标准。
- [ ] 新增/修改的 Prompt、Skill、Graph、模型有版本号。
- [ ] Unit、Integration 或 Eval 至少覆盖一种。
- [ ] 与上一版本使用同一批 Eval Case。
- [ ] 同时比较质量、p95 延迟、成本和失败率。
- [ ] 没有把 `null` 指标当成 0。
- [ ] Tool 有输入 Schema、超时、错误码和输出上限。
- [ ] RAG/MCP/附件都按 token 用户做权限隔离。
- [ ] 外部内容被视为不可信数据。
- [ ] 失败时能降级，不泄漏内部错误和敏感信息。
- [ ] 看板能按 route、skillVersion 和 variant 定位变化。

---

## 12. 最终建议

这个项目最适合采用“垂直切片 + 可量化评测”的学习方式：

1. 用翻译学习结构化输出、Skill 和基础 Eval。
2. 用多意图学习 Graph。
3. 用文件问答学习解析、Embedding、检索和 RAG。
4. 用英语画像学习长期记忆与结构化状态。
5. 用专业搜索学习 Tools、MCP、来源引用和安全边界。
6. 用 Metrics/Evaluation 学习如何证明每次修改真的更好。

这样每加入一个概念，都会对应一个真实产品问题，也能在 metrics 中看到它带来的收益和代价。
