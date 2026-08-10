import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createCheckerPoint, createDeepSeek } from '../llm/llm.config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { AIMessageChunk, ReactAgent } from 'langchain';
import { createAgent, dynamicSystemPromptMiddleware } from 'langchain';
import { ChatDto } from '@en/common/chat';
import { PrismaService, ResponseService } from '@libs/shared';
import type { AgentStreamEmit } from './stream/agent-stream-event';
import { skillRegistry, formatSkillsForPrompt } from './skills';
import { englishLearningTools } from './tools';
import { MetricsService } from '../metrics/metrics.service';
import {
  buildSystemPrompt,
  promptRuntimeContextSchema,
  type PromptRuntimeContext,
} from '../prompt';

export interface AgentRunOptions {
  signal?: AbortSignal;
}

type UsageAccumulator = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

@Injectable()
export class AgentService implements OnModuleInit {
  private checkerPoint!: PostgresSaver;
  private agent!: ReactAgent<any>;

  constructor(
    private readonly responseService: ResponseService,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.checkerPoint = await createCheckerPoint();
    const skillsHint = formatSkillsForPrompt(skillRegistry.list());
    this.agent = createAgent({
      model: createDeepSeek(),
      checkpointer: this.checkerPoint,
      contextSchema: promptRuntimeContextSchema,
      middleware: [
        dynamicSystemPromptMiddleware<PromptRuntimeContext>((_, runtime) =>
          buildSystemPrompt(runtime.context, skillsHint),
        ),
      ],
      tools: englishLearningTools,
    });
  }

  async stream(
    chatDto: ChatDto,
    emit: AgentStreamEmit,
    options: AgentRunOptions = {},
  ) {
    const startedAt = Date.now();
    let firstTokenAt: number | null = null;
    let assistantContent = '';
    let status: 'success' | 'failed' = 'success';
    let scene = '自由对话';
    let route: string | null = null;
    let skillId: string | null = null;
    const usage: UsageAccumulator = {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    };
    const provider = 'deepseek';
    const model =
      this.configService.get<string>('DEEPSEEK_API_MODEL') || 'deepseek-chat';

    try {
      const prepared = await this.createCompletionStream(
        chatDto,
        options.signal,
      );
      scene = prepared.scene;
      const stream = prepared.stream;

      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          return;
        }

        const [msg] = chunk;
        mergeUsageFromMessage(usage, msg as AIMessageChunk);

        const detected = detectActiveSkill(msg);
        if (detected) {
          // Phase 1：route 与 skillId 同为能力标识（如 translation）
          route = detected;
          skillId = detected;
        }

        if (msg.getType() !== 'ai' || !msg.content) continue;
        if (typeof msg.content !== 'string') continue;

        if (firstTokenAt === null) {
          firstTokenAt = Date.now();
        }

        assistantContent += msg.content;
        await emit({ type: 'delta', role: 'ai', content: msg.content });
      }

      if (options.signal?.aborted) {
        return;
      }

      await this.recordAssistantMessage(
        chatDto.conversationId,
        chatDto.userId,
        assistantContent,
      );
      await emit({ type: 'done', role: 'ai' });
    } catch (error) {
      status = 'failed';
      throw error;
    } finally {
      if (!options.signal?.aborted) {
        const durationMs = Date.now() - startedAt;
        const firstTokenMs =
          firstTokenAt == null ? durationMs : firstTokenAt - startedAt;
        const costCents = estimateCostCents(
          model,
          usage.inputTokens,
          usage.cachedInputTokens,
          usage.outputTokens,
        );

        await this.metricsService.recordRun({
          userId: chatDto.userId,
          conversationId: chatDto.conversationId,
          scene,
          route,
          skillId,
          provider,
          model,
          promptVersion: 'v1',
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          firstTokenMs,
          durationMs,
          costCents,
          qualityScore: null,
          status,
        });
      }
    }
  }
  // 获取历史记录
  async findAll(conversationId: string, userId?: string) {
    const threadId = conversationId?.trim();
    const normalizedUserId = userId?.trim();
    if (!threadId || !normalizedUserId) {
      return this.responseService.success([]);
    }

    const owned = await this.prisma.chatConversation.findFirst({
      where: { id: threadId, userId: normalizedUserId },
    });
    if (!owned) {
      return this.responseService.success([]);
    }

    const storedMessages = await this.prisma.chatMessage.findMany({
      where: { conversationId: threadId },
      orderBy: { createdAt: 'asc' },
    });
    if (storedMessages.length > 0) {
      return this.responseService.success(
        storedMessages
          .filter((item) => item.role === 'AI' || item.role === 'HUMAN')
          .map((item) => ({
            content: item.content,
            role: item.role === 'AI' ? 'ai' : 'human',
          })),
      );
    }

    const list = await this.getCheckpointMessages(threadId);
    if (!list) return this.responseService.success([]);
    return this.responseService.success(
      list
        .filter((item) => item.type === 'ai' || item.type === 'human')
        .map((item) => ({
          content: normalizeMessageContent(item.content),
          role: item.type === 'ai' ? 'ai' : 'human',
        })),
    );
  }

  async deleteThread(threadId: string) {
    const id = threadId?.trim();
    if (!id) return;
    await this.checkerPoint.deleteThread(id);
  }

  private async createCompletionStream(chatDto: ChatDto, signal?: AbortSignal) {
    const conversationId = chatDto.conversationId?.trim();
    const userId = chatDto.userId?.trim();
    if (!conversationId || !userId) {
      throw new Error('Conversation not found');
    }

    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId, status: 'ACTIVE' },
    });
    if (!conversation) {
      throw new Error('Conversation not found');
    }

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
      data: {
        conversationId,
        role: 'HUMAN',
        content: chatDto.content,
      },
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

    const scene =
      conversation.title && conversation.title !== '新聊天'
        ? conversation.title
        : '自由对话';

    const stream = await this.agent.stream(
      {
        messages: [{ role: 'human', content: chatDto.content }],
      },
      {
        configurable: {
          thread_id: conversationId,
          userId,
          assistantId: conversation.assistantId,
          attachmentIds,
          traceId: randomUUID(),
        },
        context: {
          conversationTitle: conversation.title,
          attachmentCount: attachmentIds.length,
        },
        streamMode: 'messages',
        signal,
      },
    );

    return { scene, stream };
  }

  private async recordAssistantMessage(
    conversationId: string,
    userId: string,
    content: string,
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
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  private async getCheckpointMessages(
    threadId: string,
  ): Promise<AIMessageChunk[] | null> {
    const checkpoint = await this.checkerPoint.get({
      configurable: {
        thread_id: threadId,
      },
    });
    const list = checkpoint?.channel_values.messages as
      | AIMessageChunk[]
      | undefined;
    return list ?? null;
  }
}

function createConversationTitle(content: string): string {
  const title = content.trim();
  if (!title) return '新聊天';
  return title.length > 24 ? `${title.slice(0, 24)}...` : title;
}

function detectActiveSkill(msg: unknown): string | null {
  const loaded = detectLoadedSkillName(msg);
  if (loaded && skillRegistry.get(loaded)) {
    return loaded;
  }

  const toolNames = collectToolNames(msg);
  for (const name of toolNames) {
    if (name === 'list_skills' || name === 'load_skill') continue;
    const skill = skillRegistry.findByToolName(name);
    if (skill) {
      return skill.id;
    }
  }
  return null;
}

function detectLoadedSkillName(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;

  const record = msg as {
    tool_calls?: Array<{
      name?: string;
      args?: Record<string, unknown>;
    }>;
  };

  for (const call of record.tool_calls ?? []) {
    if (call?.name !== 'load_skill') continue;
    const skillName = call.args?.skillName;
    if (typeof skillName === 'string' && skillName.trim()) {
      return skillName.trim();
    }
  }

  return null;
}

function collectToolNames(msg: unknown): string[] {
  if (!msg || typeof msg !== 'object') return [];

  const record = msg as {
    getType?: () => string;
    name?: string;
    tool_calls?: Array<{ name?: string }>;
    tool_call_chunks?: Array<{ name?: string }>;
  };

  const names: string[] = [];

  if (typeof record.getType === 'function' && record.getType() === 'tool') {
    if (typeof record.name === 'string' && record.name) {
      names.push(record.name);
    }
  }

  for (const call of record.tool_calls ?? []) {
    if (typeof call?.name === 'string' && call.name) {
      names.push(call.name);
    }
  }

  for (const chunk of record.tool_call_chunks ?? []) {
    if (typeof chunk?.name === 'string' && chunk.name) {
      names.push(chunk.name);
    }
  }

  return names;
}

function normalizeMessageContent(content: AIMessageChunk['content']): string {
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
  return content == null ? '' : String(content);
}

function mergeUsageFromMessage(usage: UsageAccumulator, msg: AIMessageChunk) {
  const metadata = msg.usage_metadata as
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

  const responseMetadata = msg.response_metadata as
    | {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_cache_hit_tokens?: number;
          prompt_cache_tokens?: number;
        };
        tokenUsage?: {
          promptTokens?: number;
          completionTokens?: number;
        };
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
  if (tokenUsage) {
    if (typeof tokenUsage.promptTokens === 'number') {
      usage.inputTokens = Math.max(usage.inputTokens, tokenUsage.promptTokens);
    }
    if (typeof tokenUsage.completionTokens === 'number') {
      usage.outputTokens = Math.max(
        usage.outputTokens,
        tokenUsage.completionTokens,
      );
    }
  }
}

/** 按 DeepSeek 公开价粗估成本，单位：分（CNY fen） */
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
