import { MessagesValue, StateSchema } from '@langchain/langgraph';
import { z } from 'zod';

import { agentResultSchema } from '../contracts/agent-result.contract';
import { AGENT_INTENTS } from '../contracts/intent.contract';

/**
 * RAG 检索的可观察状态。检索内容本体不进入 Graph State：它仍属于向量库/文件库；
 * State 只记录本轮处理到了哪里，供后续节点决定是否继续、回退或展示降级提示。
 */
export const retrievalStatusSchema = z.enum([
  'not_requested',
  'pending',
  'completed',
  'skipped',
  'failed',
]);

/**
 * 可复现回答依据的最小引用。`chunkId` 由检索库解析为实际文本，不能把 chunk 正文放进
 * checkpoint，避免会话状态无限膨胀，也避免在会话间复制受权限保护的文件内容。
 */
export const citationSchema = z.object({
  documentId: z.string(),
  chunkId: z.string(),
  title: z.string().nullable().default(null),
  locator: z.string().nullable().default(null),
});

/**
 * 长期记忆写入流程的状态。候选项本身应先写入受审计的 memory-candidate 存储；
 * Graph 只携带其 ID，随后由校验节点决定是否升级为用户长期记忆。
 */
export const memoryStatusSchema = z.enum([
  'not_evaluated',
  'pending',
  'stored',
  'skipped',
  'rejected',
  'failed',
]);

/**
 * 外层 Graph 的固定数据契约。它只保存当前请求在节点间传递的数据；
 * `messages` 是所有路线共享的短期会话上下文，并由这个 Graph 的 Checkpointer 保存。
 *
 * 简单字段使用 StateSchema 的默认 last-write-wins 更新规则：节点返回新值时覆盖旧值。
 * 数据库实体、附件正文、向量、完整 RAG 片段与长期记忆正文不在这里保存。
 */
export const AgentGraphState = new StateSchema({
  // 共享短期对话上下文
  messages: MessagesValue,

  // 本轮请求与归属
  content: z.string(),
  conversationId: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
  assistantId: z.string().nullable().default(null),
  attachmentIds: z.array(z.string()).default([]),
  conversationTitle: z.string().nullable().default(null),

  // 意图识别与路由
  intent: z.enum(AGENT_INTENTS).nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  routeReason: z.string().nullable().default(null),
  route: z.enum(AGENT_INTENTS).nullable().default(null),

  // RAG：只在 State 中传递检索意图、授权后命中的引用与处理结果。
  retrievalStatus: retrievalStatusSchema.default('not_requested'),
  retrievalQuery: z.string().nullable().default(null),
  retrievedChunkIds: z.array(z.string()).default([]),
  citations: z.array(citationSchema).default([]),
  retrievalFailureReason: z.string().nullable().default(null),

  // 长期记忆：读取命中的记忆与待审核候选均通过 ID 交接。
  relevantMemoryIds: z.array(z.string()).default([]),
  memoryCandidateIds: z.array(z.string()).default([]),
  memoryStatus: memoryStatusSchema.default('not_evaluated'),

  // 本轮最终输出与执行结果
  responseContent: z.string().nullable().default(null),
  agentResult: agentResultSchema.nullable().default(null),
  toolFailed: z.boolean().default(false),
});

export type AgentGraphStateValue = typeof AgentGraphState.State;
export type RetrievalStatus = z.infer<typeof retrievalStatusSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;
