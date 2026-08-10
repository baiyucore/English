import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService, ResponseService } from '@libs/shared';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly responseService: ResponseService,
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async findAll(userId: string) {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      return this.responseService.error(null, '请提供用户 id', 400);
    }

    const list = await this.prisma.chatConversation.findMany({
      where: { userId: normalizedUserId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
    return this.responseService.success(
      list.map((item) => this.toConversationSummary(item)),
    );
  }

  async create(userId: string, title?: string) {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      return this.responseService.error(null, '请提供用户 id', 400);
    }

    const assistant = await this.ensureDefaultAssistant(normalizedUserId);
    const conversation = await this.prisma.chatConversation.create({
      data: {
        id: randomUUID(),
        userId: normalizedUserId,
        assistantId: assistant.id,
        title: createConversationTitle(title),
      },
    });
    return this.responseService.success(
      this.toConversationSummary(conversation),
    );
  }

  async search(userId: string, keyword?: string) {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      return this.responseService.error(null, '请提供用户 id', 400);
    }

    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return this.findAll(normalizedUserId);
    }

    const list = await this.prisma.chatConversation.findMany({
      where: {
        userId: normalizedUserId,
        status: 'ACTIVE',
        OR: [
          { title: { contains: normalizedKeyword, mode: 'insensitive' } },
          {
            messages: {
              some: {
                content: { contains: normalizedKeyword, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: {
          where: {
            content: { contains: normalizedKeyword, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true },
        },
      },
    });

    return this.responseService.success(
      list.map((item) => ({
        ...this.toConversationSummary(item),
        snippet: buildSearchSnippet(
          item.messages[0]?.content,
          normalizedKeyword,
        ),
      })),
    );
  }

  async remove(conversationId: string, userId: string) {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      return this.responseService.error(null, '请提供用户 id', 400);
    }

    const existing = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId: normalizedUserId },
    });
    if (!existing) {
      return this.responseService.error(null, '对话不存在', 404);
    }

    await this.prisma.chatConversation.delete({
      where: { id: conversationId },
    });
    try {
      await this.agentService.deleteThread(existing.id);
    } catch (error) {
      console.error('清理会话 checkpoint 失败', existing.id, error);
    }
    return this.responseService.success(this.toConversationSummary(existing));
  }

  private async ensureDefaultAssistant(userId: string) {
    const existing = await this.prisma.chatAssistant.findFirst({
      where: { userId, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    // 该字段保留用于兼容现有数据库结构；Agent 运行时不会读取它。
    return this.prisma.chatAssistant.create({
      data: {
        id: randomUUID(),
        userId,
        name: '英语学习助手',
        prompt: '',
        isDefault: true,
      },
    });
  }

  private toConversationSummary(item: {
    id: string;
    assistantId: string;
    title: string;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      assistantKey: item.assistantId,
      title: item.title,
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

function createConversationTitle(content?: string): string {
  const title = content?.trim();
  if (!title) return '新聊天';
  return title.length > 24 ? `${title.slice(0, 24)}...` : title;
}

function buildSearchSnippet(content: string | undefined, keyword: string) {
  if (!content) return '';
  const trimmed = content.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 80) return trimmed;

  const index = trimmed.toLowerCase().indexOf(keyword.toLowerCase());
  if (index < 0) return `${trimmed.slice(0, 80)}...`;

  const start = Math.max(0, index - 20);
  const end = Math.min(trimmed.length, index + keyword.length + 40);
  return `${start > 0 ? '…' : ''}${trimmed.slice(start, end)}${end < trimmed.length ? '…' : ''}`;
}
