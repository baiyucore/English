import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseMessage } from 'langchain';
import { randomUUID } from 'node:crypto';

import { ChatDto, type ChatMessageMetadata } from '@en/common/chat';
import { PrismaService, ResponseService } from '@libs/shared';

import { createCheckerPoint } from '../llm/llm.config';
import { MetricsService } from '../metrics/metrics.service';
import {
  createAgentResultMetadata,
  createFailedAgentResult,
  agentResultSchema,
  withAgentResultDuration,
  type AgentResult,
} from './contracts/agent-result.contract';
import type { AgentIntent } from './contracts/intent.contract';
import type { AgentGraphStateValue } from './langgraph/agent.state';
import {
  createAgentExecutionGraph,
  type AgentExecutionGraph,
  type AgentGraphRuntime,
} from './langgraph/execution.graph';
import { classifyIntent } from './langchain/intent-classifier.chain';
import {
  createLearningChatChain,
  type LearningChatChain,
} from './langchain/learning-chat.chain';
import { executeSpecializedRoute } from './langchain/specialized-execution.chain';
import { LANGGRAPH_AGENT_SDK_STATUS } from './langgraph/sdk/agent-sdk.integration';
import type { AgentStreamEmit } from './stream/agent-stream-event';

export interface AgentRunOptions {
  signal?: AbortSignal;
}

type UsageAccumulator = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/**
 * HTTP / database adapter only.
 * - LangChain 能力封装在 ./langchain
 * - LangGraph 编排封装在 ./langgraph
 * - tools、skills 与未来 RAG 保持为两层共享能力
 */
@Injectable()
export class AgentService implements OnModuleInit {
  private checkerPoint!: PostgresSaver;
  private learningChatChain!: LearningChatChain;
  private executionGraph!: AgentExecutionGraph;

  constructor(
    private readonly responseService: ResponseService,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.checkerPoint = await createCheckerPoint();
    this.learningChatChain = createLearningChatChain(this.prisma);
    this.executionGraph = createAgentExecutionGraph({
      checkpointer: this.checkerPoint,
      classifier: classifyIntent,
      executeSpecialized: (route, state, runtime) =>
        executeSpecializedRoute(
          route,
          state.content,
          runtime.emit,
          runtime.runId,
          this.prisma,
          runtime.signal,
        ),
      executeLearningChat: (state, runtime) =>
        this.learningChatChain.execute(
          {
            messages: state.messages,
            goal: state.content,
            conversationId: state.conversationId,
            userId: state.userId,
            assistantId: state.assistantId,
            attachmentIds: state.attachmentIds,
            conversationTitle: state.conversationTitle,
          },
          runtime,
        ),
      persistAssistantMessage: (state) =>
        this.recordAssistantMessage(
          state.conversationId ?? '',
          state.userId ?? '',
          state.responseContent ?? '',
          state.agentResult,
        ),
      recordMetrics: (state, runtime) =>
        this.recordGraphMetrics(state, runtime),
    });
  }

  async stream(
    chatDto: ChatDto,
    emit: AgentStreamEmit,
    options: AgentRunOptions = {},
  ): Promise<AgentResult> {
    const startedAt = Date.now();
    const runId = randomUUID();
    let firstTokenAt: number | null = null;
    let status: 'success' | 'failed' = 'success';
    let scene = '自由对话';
    let route: AgentIntent | null = null;
    let skillId: string | null = null;
    let graphRuntime: AgentGraphRuntime | undefined;
    let agentResult: AgentResult | undefined;
    const usage: UsageAccumulator = {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    };
    const provider = 'deepseek';
    const executionMode = chatDto.executionMode ?? 'hybrid';
    const model =
      this.configService.get<string>('DEEPSEEK_API_MODEL') || 'deepseek-chat';

    try {
      await emit({ type: 'agent_started', role: 'ai', runId });
      const prepared = await this.prepareConversation(chatDto);
      scene = prepared.scene;
      graphRuntime = this.createGraphRuntime(
        runId,
        options.signal,
        emit,
        startedAt,
        scene,
        firstTokenAt,
        usage,
        () => {
          if (firstTokenAt === null) firstTokenAt = Date.now();
        },
      );

      if (executionMode === 'langgraph_agent') {
        throw new Error(
          `LangGraph Agent SDK is ${LANGGRAPH_AGENT_SDK_STATUS}; integration is not available yet.`,
        );
      }

      if (executionMode === 'langchain') {
        await emit({
          type: 'route_selected',
          role: 'ai',
          runId,
          route: 'learning_chat',
          skillId: null,
        });
        const result = await this.learningChatChain.execute(
          {
            messages: await this.getConversationMessages(
              chatDto.conversationId,
            ),
            goal: chatDto.content,
            conversationId: chatDto.conversationId,
            userId: chatDto.userId,
            assistantId: prepared.assistantId,
            attachmentIds: prepared.attachmentIds,
            conversationTitle: prepared.conversationTitle,
          },
          graphRuntime,
        );
        agentResult = withAgentResultDuration(result, Date.now() - startedAt);
        route = 'learning_chat';
        await this.recordAssistantMessage(
          chatDto.conversationId,
          chatDto.userId,
          result.content,
          agentResult,
        );
      } else {
        const result = await this.executionGraph.invoke(
          {
            messages: [new HumanMessage(chatDto.content)],
            content: chatDto.content,
            conversationId: chatDto.conversationId,
            userId: chatDto.userId,
            assistantId: prepared.assistantId,
            attachmentIds: prepared.attachmentIds,
            conversationTitle: prepared.conversationTitle,
          },
          {
            configurable: {
              thread_id: chatDto.conversationId,
              agentRuntime: graphRuntime,
            },
            signal: options.signal,
          },
        );
        route = result.route ?? 'learning_chat';
        skillId = route === 'learning_chat' ? null : route;
        if (result.toolFailed) status = 'failed';
        agentResult =
          result.agentResult ??
          createFailedAgentResult(route, '暂时无法生成回答，请稍后再试。', {
            code: 'INTERNAL_ERROR',
            message: '工作流未生成统一结果',
            retryable: true,
          });
      }

      if (options.signal?.aborted) {
        await emit({ type: 'agent_cancelled', role: 'ai', runId });
        return createFailedAgentResult(null, '本次请求已取消。', {
          code: 'CANCELLED',
          message: '用户取消了请求',
          retryable: false,
        });
      }
      if (!agentResult) {
        throw new Error('Agent execution completed without a result');
      }
      await emit({
        type: 'agent_result',
        role: 'ai',
        runId,
        result: agentResult,
      });
      await emit({
        type: 'agent_completed',
        role: 'ai',
        runId,
        durationMs: Date.now() - startedAt,
      });
      await emit({ type: 'done', role: 'ai' });
      return agentResult;
    } catch (error) {
      if (options.signal?.aborted) {
        await emit({ type: 'agent_cancelled', role: 'ai', runId });
        return createFailedAgentResult(null, '本次请求已取消。', {
          code: 'CANCELLED',
          message: '用户取消了请求',
          retryable: false,
        });
      }
      status = 'failed';
      await emit({
        type: 'agent_failed',
        role: 'ai',
        runId,
        error: getSafeErrorMessage(),
      });
      throw error;
    } finally {
      if (!options.signal?.aborted && !graphRuntime?.metricsRecorded) {
        const durationMs = Date.now() - startedAt;
        const metrics = graphRuntime?.metrics;
        const effectiveFirstTokenAt = metrics?.firstTokenAt ?? firstTokenAt;
        const firstTokenMs =
          effectiveFirstTokenAt == null
            ? durationMs
            : effectiveFirstTokenAt - startedAt;
        await this.metricsService.recordRun({
          userId: chatDto.userId,
          conversationId: chatDto.conversationId,
          scene,
          route,
          skillId,
          provider,
          model: metrics?.model ?? model,
          promptVersion: 'v1',
          inputTokens: metrics?.inputTokens ?? usage.inputTokens,
          cachedInputTokens:
            metrics?.cachedInputTokens ?? usage.cachedInputTokens,
          outputTokens: metrics?.outputTokens ?? usage.outputTokens,
          firstTokenMs,
          durationMs,
          costCents: estimateCostCents(
            metrics?.model ?? model,
            metrics?.inputTokens ?? usage.inputTokens,
            metrics?.cachedInputTokens ?? usage.cachedInputTokens,
            metrics?.outputTokens ?? usage.outputTokens,
          ),
          qualityScore: null,
          status,
        });
      }
    }
  }

  async findAll(conversationId: string, userId?: string) {
    const threadId = conversationId?.trim();
    const normalizedUserId = userId?.trim();
    if (!threadId || !normalizedUserId) return this.responseService.success([]);

    const owned = await this.prisma.chatConversation.findFirst({
      where: { id: threadId, userId: normalizedUserId },
    });
    if (!owned) return this.responseService.success([]);

    const storedMessages = await this.prisma.chatMessage.findMany({
      where: { conversationId: threadId },
      orderBy: { createdAt: 'asc' },
    });
    if (storedMessages.length > 0) {
      return this.responseService.success(
        storedMessages
          .filter((item) => item.role === 'AI' || item.role === 'HUMAN')
          .map((item) => {
            const metadata = normalizeChatMessageMetadata(item.metadata);
            return {
              content: item.content,
              role: item.role === 'AI' ? 'ai' : 'human',
              ...(metadata ? { metadata } : {}),
            };
          }),
      );
    }

    const messages = await this.getCheckpointMessages(threadId);
    if (!messages) return this.responseService.success([]);
    return this.responseService.success(
      messages
        .filter((item) => item.getType() === 'ai' || item.getType() === 'human')
        .map((item) => ({
          content: normalizeMessageContent(item.content),
          role: item.getType() === 'ai' ? 'ai' : 'human',
        })),
    );
  }

  async deleteThread(threadId: string) {
    const id = threadId?.trim();
    if (id) await this.checkerPoint.deleteThread(id);
  }

  private async prepareConversation(chatDto: ChatDto) {
    const conversationId = chatDto.conversationId?.trim();
    const userId = chatDto.userId?.trim();
    if (!conversationId || !userId) throw new Error('Conversation not found');

    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId, status: 'ACTIVE' },
    });
    if (!conversation) throw new Error('Conversation not found');
    if (
      chatDto.assistantKey &&
      chatDto.assistantKey !== conversation.assistantId
    ) {
      throw new Error('Agent not found');
    }

    const attachmentIds = [...new Set(chatDto.attachmentIds ?? [])];
    if (attachmentIds.length > 0) {
      const readyAttachmentCount = await this.prisma.chatAttachment.count({
        where: {
          id: { in: attachmentIds },
          userId,
          conversationId,
          status: 'READY',
        },
      });
      if (readyAttachmentCount !== attachmentIds.length) {
        throw new Error('附件不存在、未就绪或无权访问');
      }
    }

    await this.prisma.chatMessage.create({
      data: { conversationId, role: 'HUMAN', content: chatDto.content },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        title:
          conversation.title === '新聊天'
            ? createConversationTitle(chatDto.content)
            : conversation.title,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return {
      scene:
        conversation.title && conversation.title !== '新聊天'
          ? conversation.title
          : '自由对话',
      assistantId: conversation.assistantId,
      attachmentIds,
      conversationTitle: conversation.title,
    };
  }

  private createGraphRuntime(
    runId: string,
    signal: AbortSignal | undefined,
    emit: AgentStreamEmit,
    startedAt: number,
    scene: string,
    firstTokenAt: number | null,
    usage: UsageAccumulator,
    onFirstToken: () => void,
  ): AgentGraphRuntime {
    const model =
      this.configService.get<string>('DEEPSEEK_API_MODEL') || 'deepseek-chat';
    let runtime!: AgentGraphRuntime;
    runtime = {
      runId,
      signal,
      emit,
      markFirstToken: () => {
        if (runtime.metrics.firstTokenAt === null) {
          runtime.metrics.firstTokenAt = Date.now();
        }
        onFirstToken();
      },
      metrics: {
        startedAt,
        firstTokenAt,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        provider: 'deepseek',
        model,
        scene,
      },
      metricsRecorded: false,
    };
    return runtime;
  }

  private async recordGraphMetrics(
    state: AgentGraphStateValue,
    runtime: AgentGraphRuntime,
  ) {
    const durationMs = Date.now() - runtime.metrics.startedAt;
    const firstTokenMs =
      runtime.metrics.firstTokenAt === null
        ? durationMs
        : runtime.metrics.firstTokenAt - runtime.metrics.startedAt;
    await this.metricsService.recordRun({
      userId: state.userId,
      conversationId: state.conversationId,
      scene: runtime.metrics.scene,
      route: state.route,
      skillId: state.route === 'learning_chat' ? null : state.route,
      provider: runtime.metrics.provider,
      model: runtime.metrics.model,
      promptVersion: 'v1',
      inputTokens: runtime.metrics.inputTokens,
      cachedInputTokens: runtime.metrics.cachedInputTokens,
      outputTokens: runtime.metrics.outputTokens,
      firstTokenMs,
      durationMs,
      costCents: estimateCostCents(
        runtime.metrics.model,
        runtime.metrics.inputTokens,
        runtime.metrics.cachedInputTokens,
        runtime.metrics.outputTokens,
      ),
      qualityScore: null,
      status: state.toolFailed ? 'failed' : 'success',
    });
  }

  private async recordAssistantMessage(
    conversationId: string,
    userId: string,
    content: string,
    agentResult: AgentResult | null = null,
  ) {
    const normalizedContent = content.trim();
    if (!normalizedContent) return;
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) return;
    await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'AI',
        content: normalizedContent,
        ...(agentResult
          ? { metadata: createAgentResultMetadata(agentResult) }
          : {}),
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });
  }

  private async getCheckpointMessages(
    threadId: string,
  ): Promise<BaseMessage[] | null> {
    const checkpoint = await this.checkerPoint.get({
      configurable: { thread_id: threadId },
    });
    return (
      (checkpoint?.channel_values.messages as BaseMessage[] | undefined) ?? null
    );
  }

  private async getConversationMessages(
    conversationId: string,
  ): Promise<BaseMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages
      .filter((item) => item.role === 'AI' || item.role === 'HUMAN')
      .map((item) =>
        item.role === 'AI'
          ? new AIMessage(item.content)
          : new HumanMessage(item.content),
      );
  }
}

function createConversationTitle(content: string): string {
  const title = content.trim();
  if (!title) return '新聊天';
  return title.length > 24 ? `${title.slice(0, 24)}...` : title;
}

function getSafeErrorMessage(): string {
  return '智能体执行失败，请稍后重试';
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return typeof content === 'number' || typeof content === 'boolean'
    ? String(content)
    : '';
}

function normalizeChatMessageMetadata(
  metadata: unknown,
): ChatMessageMetadata | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const value = metadata as {
    agentResult?: unknown;
    agentResultVersion?: unknown;
    agentResultTruncated?: unknown;
  };
  const parsedResult = agentResultSchema.safeParse(value.agentResult);
  if (!parsedResult.success) return undefined;
  return {
    agentResult: parsedResult.data,
    ...(typeof value.agentResultVersion === 'number'
      ? { agentResultVersion: value.agentResultVersion }
      : {}),
    ...(typeof value.agentResultTruncated === 'boolean'
      ? { agentResultTruncated: value.agentResultTruncated }
      : {}),
  };
}

function estimateCostCents(
  model: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number {
  const billableInput = Math.max(0, inputTokens - cachedInputTokens);
  const rates = model.includes('reasoner')
    ? { input: 55, cached: 14, output: 219 }
    : { input: 14, cached: 1.4, output: 28 };
  const costYuan =
    (billableInput * rates.input +
      cachedInputTokens * rates.cached +
      outputTokens * rates.output) /
    1_000_000;
  return Number((costYuan * 100).toFixed(4));
}
