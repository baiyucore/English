import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
  type ToolCall,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableLambda } from '@langchain/core/runnables';
import type { AIMessageChunk } from 'langchain';

import { createDeepSeek } from '../../llm/llm.config';
import { buildSystemPrompt } from '../../prompt';
import type { PrismaService } from '@libs/shared';
import {
  createCompletedAgentResult,
  type AgentResult,
} from '../contracts/agent-result.contract';
import type { AgentStreamEmit } from '../stream/agent-stream-event';
import { createGetLearningProgressTool } from '../tools/get-learning-progress.tool';
import { createLookupWordTool } from '../tools/lookup-word.tool';
import {
  authorizeToolInvocation,
  createToolPolicyState,
  type ToolPolicyState,
} from '../tools/policy';
import { messageContentToText } from '../tools/utils';
import { createSaveVocabularyTool } from '../tools/save-vocabulary.tool';

/** LangChain 英语学习能力：只负责 Prompt → Model → Stream，不负责路由或持久化。 */
export type LearningChatChain = {
  execute(
    input: LearningChatInput,
    runtime: LearningChatRuntime,
  ): Promise<AgentResult>;
};

export type LearningChatInput = {
  messages: BaseMessage[];
  goal: string;
  conversationId: string | null;
  userId: string | null;
  assistantId: string | null;
  attachmentIds: string[];
  conversationTitle: string | null;
};

export type LearningChatRuntime = {
  runId: string;
  signal?: AbortSignal;
  emit: AgentStreamEmit;
  markFirstToken: () => void;
  metrics: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
};

export function createLearningChatChain(
  prisma: PrismaService,
): LearningChatChain {
  // Tool Calling 的决策必须读取完整响应；DeepSeek 的流式 DSML 标记不会被当前适配层解析为 tool_calls。
  // Tool Calling 是结构化协议，因此把温度固定为 0，避免工具选择受随机采样影响。
  const toolDecisionModel = createDeepSeek({
    streaming: false,
    temperature: 0,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', '{systemPrompt}'],
    new MessagesPlaceholder('messages'),
  ]);
  const promptInput = RunnableLambda.from((input: LearningChatInput) => ({
    systemPrompt: buildLearningChatSystemPrompt(input),
    messages: input.messages,
  })).pipe(prompt);
  return {
    async execute(input, runtime) {
      if (
        !input.conversationId?.trim() ||
        !input.userId?.trim() ||
        !input.assistantId?.trim()
      ) {
        throw new Error('Conversation context is missing');
      }

      const tools = createLearningChatTools(prisma, input.userId);
      const toolPolicyState = createToolPolicyState();
      const toolCallingChain = promptInput
        .pipe(
          toolDecisionModel.bindTools([
            tools.lookupWord,
            tools.saveVocabulary,
            tools.getLearningProgress,
          ]),
        )
        .withConfig({
          runName: 'learning_chat_tool_decision',
          tags: ['agent', 'langchain', 'learning_chat', 'tool_calling'],
        });
      const finalResponseChain = promptInput
        // 这一轮的职责只是把已经拿到的 Tool Result 组织成最终回答，
        // 不再把工具协议发给模型。这样供应商的 Tool Calling 差异只停留在决策轮。
        .pipe(toolDecisionModel)
        .withConfig({
          runName: 'learning_chat_final_response',
          tags: ['agent', 'langchain', 'learning_chat', 'tool_result'],
        });

      // 模型决定是否调用 Tool；程序只负责执行模型请求的 Action。
      // 这里不能 stream：必须拿到适配器解析后的完整 tool_calls，不能让 DSML 标记流向用户。
      const decision = await toolCallingChain.invoke(input, {
        signal: runtime.signal,
      });
      mergeUsageFromMessage(runtime.metrics, decision as AIMessageChunk);

      // DeepSeek 可能把 Tool Call 作为 DSML 原文放在 content 中，而不是填入 tool_calls。
      // 在这里统一成 LangChain 的 ToolCall，后续执行器不需要关心供应商协议。
      const toolCalls = getDecisionToolCalls(decision, runtime.runId);
      if (toolCalls.length === 0) {
        const content = messageContentToText(decision.content);
        if (containsRawToolCallMarkup(content)) {
          throw new Error(
            '模型返回了未解析的 Tool Call 标记；请检查 DeepSeek Tool Calling 适配配置。',
          );
        }
        if (content) {
          runtime.markFirstToken();
          await runtime.emit({ type: 'delta', role: 'ai', content });
        }
        return createCompletedAgentResult('learning_chat', content, {
          kind: 'learning_chat',
          data: null,
        });
      }

      // Project A 当前只验证一个只读 Tool Call；多步循环留到 Agent Loop 阶段。
      const toolMessage = await executeLearningToolCall(
        toolCalls[0],
        tools,
        runtime,
        {
          authenticatedUserId: input.userId,
          userMessage: input.goal,
          policyState: toolPolicyState,
        },
      );
      const toolDecisionMessage = createToolDecisionMessage(
        decision,
        toolCalls,
      );
      // Tool Result 必须作为下一轮模型输入的一部分。最终回答轮不携带 tools：
      // Phase A 只允许一次工具调用，避免第二轮重新进入供应商的 Tool Calling 协议。
      const finalResponse = await finalResponseChain.invoke(
        {
          ...input,
          messages: [...input.messages, toolDecisionMessage, toolMessage],
        },
        { signal: runtime.signal },
      );
      mergeUsageFromMessage(runtime.metrics, finalResponse as AIMessageChunk);

      if ((finalResponse.tool_calls ?? []).length > 0) {
        throw new Error(
          '模型在收到工具结果后还请求继续调用工具；这需要 Agent Loop，将在下一阶段实现。',
        );
      }

      const content = messageContentToText(finalResponse.content);
      if (containsRawToolCallMarkup(content)) {
        throw new Error(
          '模型返回了未解析的 Tool Call 标记；请检查 DeepSeek Tool Calling 适配配置。',
        );
      }
      if (content) {
        runtime.markFirstToken();
        await runtime.emit({ type: 'delta', role: 'ai', content });
      }

      return createCompletedAgentResult('learning_chat', content, {
        kind: 'learning_chat',
        data: null,
      });
    },
  };
}

function containsRawToolCallMarkup(content: string): boolean {
  return /<｜+DSML｜+tool_calls>/u.test(content);
}

/**
 * 将 DeepSeek 未被适配器解析的 DSML Tool Call 转成统一 ToolCall。
 * 这里只做协议兼容；工具名白名单和参数 schema 仍在真正执行前校验。
 */
function getDecisionToolCalls(
  decision: AIMessageChunk,
  runId: string,
): ToolCall[] {
  if (decision.tool_calls?.length) return decision.tool_calls;

  const content = messageContentToText(decision.content);
  if (!containsRawToolCallMarkup(content)) return [];

  const calls: ToolCall[] = [];
  const invokePattern =
    /<｜+DSML｜+invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/｜+DSML｜+invoke>/gu;
  let invokeMatch: RegExpExecArray | null;

  while ((invokeMatch = invokePattern.exec(content)) !== null) {
    const args: Record<string, string> = {};
    const parameterPattern =
      /<｜+DSML｜+parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/｜+DSML｜+parameter>/gu;
    let parameterMatch: RegExpExecArray | null;

    while ((parameterMatch = parameterPattern.exec(invokeMatch[2])) !== null) {
      args[parameterMatch[1]] = decodeDsmlText(parameterMatch[2]).trim();
    }

    calls.push({
      // DSML 没有提供 OpenAI 兼容协议所需的 call id；在同一段消息历史中
      // 创建一个稳定、合法的关联 id，供 Assistant Tool Call 与 ToolMessage 配对。
      id: createCompatibleToolCallId(runId, calls.length),
      // LangChain 只有识别到这个字段才会把 { name, args, id } 作为 ToolCall
      // 处理；否则它会把整个对象误当作工具的输入，导致 word 参数校验失败。
      type: 'tool_call',
      name: invokeMatch[1],
      args,
    });
  }

  return calls;
}

function createCompatibleToolCallId(runId: string, index: number): string {
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/gu, '').slice(0, 24);
  return `call_${safeRunId || 'learning'}_${index}`;
}

function createToolDecisionMessage(
  decision: AIMessageChunk,
  toolCalls: ToolCall[],
): BaseMessage {
  if (decision.tool_calls?.length) return decision;
  return new AIMessage({ content: '', tool_calls: toolCalls });
}

function decodeDsmlText(value: string): string {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

function createLearningChatTools(prisma: PrismaService, userId: string) {
  return {
    lookupWord: createLookupWordTool(prisma),
    saveVocabulary: createSaveVocabularyTool(prisma, userId),
    getLearningProgress: createGetLearningProgressTool(prisma, userId),
  };
}

type LearningChatTools = ReturnType<typeof createLearningChatTools>;

type LearningToolExecutionContext = {
  authenticatedUserId: string;
  userMessage: string;
  policyState: ToolPolicyState;
};

async function executeLearningToolCall(
  toolCall: ToolCall,
  tools: LearningChatTools,
  runtime: LearningChatRuntime,
  context: LearningToolExecutionContext,
): Promise<ToolMessage> {
  const callId = toolCall.id?.trim() || `${runtime.runId}:${toolCall.name}`;
  const tool = toolCall.name;
  const startedAt = Date.now();
  await runtime.emit({
    type: 'tool_started',
    role: 'ai',
    runId: runtime.runId,
    tool,
    callId,
  });

  if (
    tool !== tools.lookupWord.name &&
    tool !== tools.saveVocabulary.name &&
    tool !== tools.getLearningProgress.name
  ) {
    const message = `不支持模型请求的工具：${tool}`;
    await runtime.emit({
      type: 'tool_failed',
      role: 'ai',
      runId: runtime.runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
      error: { code: 'VALIDATION_ERROR', message, retryable: false },
    });
    return new ToolMessage({
      content: JSON.stringify({ status: 'failed', tool, error: { message } }),
      tool_call_id: callId,
      status: 'error',
    });
  }

  const policyDecision = authorizeToolInvocation(tool, {
    route: 'learning_chat',
    authenticatedUserId: context.authenticatedUserId,
    userMessage: context.userMessage,
    state: context.policyState,
  });
  if (!policyDecision.allowed) {
    await runtime.emit({
      type: 'tool_failed',
      role: 'ai',
      runId: runtime.runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
      error: {
        code: 'POLICY_DENIED',
        message: policyDecision.message,
        retryable: false,
      },
    });
    return new ToolMessage({
      content: JSON.stringify({
        status: 'failed',
        tool,
        error: { code: 'POLICY_DENIED', message: policyDecision.message },
      }),
      tool_call_id: callId,
      status: 'error',
    });
  }

  try {
    let result: ToolMessage;
    if (tool === tools.lookupWord.name) {
      result = await tools.lookupWord.invoke(
        { type: 'tool_call', name: tool, args: toolCall.args, id: callId },
        { signal: runtime.signal },
      );
    } else if (tool === tools.saveVocabulary.name) {
      result = await tools.saveVocabulary.invoke(
        { type: 'tool_call', name: tool, args: toolCall.args, id: callId },
        { signal: runtime.signal },
      );
    } else {
      result = await tools.getLearningProgress.invoke(
        { type: 'tool_call', name: tool, args: {}, id: callId },
        { signal: runtime.signal },
      );
    }
    await runtime.emit({
      type: 'tool_completed',
      role: 'ai',
      runId: runtime.runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '查词工具执行失败';
    await runtime.emit({
      type: 'tool_failed',
      role: 'ai',
      runId: runtime.runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
      error: { code: 'DOWNSTREAM_ERROR', message, retryable: true },
    });
    return new ToolMessage({
      content: JSON.stringify({ status: 'failed', tool, error: { message } }),
      tool_call_id: callId,
      status: 'error',
    });
  }
}

function buildLearningChatSystemPrompt(input: LearningChatInput): string {
  return buildSystemPrompt({
    goal: input.goal,
    acceptance:
      '准确回应当前英语学习需求；表达清晰、不过度展开。查询单词或短语的释义、发音、用法、搭配时调用 lookup_word；用户明确要求加入单词本时调用 save_vocabulary；用户询问学习进度或今天该复习什么时调用 get_learning_progress。不要凭记忆编造词典结果，也不要自行保存单词。',
    conversationId: input.conversationId!,
    riskLevel: 'low',
    maxTurns: 2,
    stateSummary: buildStateSummary(input),
  });
}

function buildStateSummary(input: LearningChatInput): string {
  const title = input.conversationTitle?.trim() || '未命名会话';
  return `当前会话主题：${title}；已校验附件数量：${input.attachmentIds.length}；当前链可由模型自行请求 lookup_word、save_vocabulary 或 get_learning_progress，程序执行后会把结果作为 Tool Message 回传。`;
}

function mergeUsageFromMessage(
  usage: LearningChatRuntime['metrics'],
  message: AIMessageChunk,
) {
  const metadata = message.usage_metadata as
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_token_details?: { cache_read?: number };
      }
    | undefined;
  if (metadata) {
    if (typeof metadata.input_tokens === 'number') {
      usage.inputTokens = Math.max(usage.inputTokens, metadata.input_tokens);
    }
    if (typeof metadata.output_tokens === 'number') {
      usage.outputTokens = Math.max(usage.outputTokens, metadata.output_tokens);
    }
    const cacheRead = metadata.input_token_details?.cache_read;
    if (typeof cacheRead === 'number') {
      usage.cachedInputTokens = Math.max(usage.cachedInputTokens, cacheRead);
    }
  }

  const responseMetadata = message.response_metadata as
    | {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_cache_hit_tokens?: number;
          prompt_cache_tokens?: number;
        };
        tokenUsage?: { promptTokens?: number; completionTokens?: number };
      }
    | undefined;
  const rawUsage = responseMetadata?.usage;
  if (rawUsage) {
    if (typeof rawUsage.prompt_tokens === 'number') {
      usage.inputTokens = Math.max(usage.inputTokens, rawUsage.prompt_tokens);
    }
    if (typeof rawUsage.completion_tokens === 'number') {
      usage.outputTokens = Math.max(
        usage.outputTokens,
        rawUsage.completion_tokens,
      );
    }
    const cacheHit =
      rawUsage.prompt_cache_hit_tokens ?? rawUsage.prompt_cache_tokens;
    if (typeof cacheHit === 'number') {
      usage.cachedInputTokens = Math.max(usage.cachedInputTokens, cacheHit);
    }
  }

  const tokenUsage = responseMetadata?.tokenUsage;
  if (tokenUsage?.promptTokens !== undefined) {
    usage.inputTokens = Math.max(usage.inputTokens, tokenUsage.promptTokens);
  }
  if (tokenUsage?.completionTokens !== undefined) {
    usage.outputTokens = Math.max(
      usage.outputTokens,
      tokenUsage.completionTokens,
    );
  }
}
