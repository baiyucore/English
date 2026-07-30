import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService, ResponseService } from '@libs/shared';
import { SYSTEM_PROMPT } from './prompt.mode';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { AgentService } from '../agent/agent.service';

const DEFAULT_ASSISTANT_ID = 'a0000000-0000-4000-8000-000000000001';
const DEFAULT_ASSISTANT_KEY = 'normal';
const DEFAULT_ASSISTANT_NAME = '💬 智能助手';

@Injectable()
export class PromptService implements OnModuleInit {
  constructor(
    private readonly responseService: ResponseService,
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPromptIfNeeded();
    const modes = await this.prisma.chatPrompt.findMany({
      orderBy: { createdAt: 'asc' },
    });
    for (const mode of modes) {
      this.agentService.registerAssistant(this.toAssistantConfig(mode));
    }
  }

  async findAll() {
    const list = await this.prisma.chatPrompt.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return this.responseService.success(
      list.map((item) => this.toPromptSummary(item)),
    );
  }

  async create(createPromptDto: CreatePromptDto) {
    const normalized = this.normalizeCreatePromptInput(createPromptDto);
    if ('message' in normalized) {
      return this.responseService.error(null, normalized.message ?? '', 400);
    }

    const existing = await this.prisma.chatPrompt.findFirst({
      where: { role: normalized.key },
    });
    if (existing) {
      return this.responseService.error(
        null,
        '助手标识已存在，请更换后重试',
        409,
      );
    }

    const item = await this.prisma.chatPrompt.create({
      data: {
        id: randomUUID(),
        role: normalized.key,
        label: normalized.name,
        prompt: SYSTEM_PROMPT,
      },
    });
    this.agentService.registerAssistant(this.toAssistantConfig(item));
    return this.responseService.success(this.toPromptSummary(item));
  }

  async remove(id: string) {
    const existing = await this.prisma.chatPrompt.findUnique({
      where: { id },
    });
    if (!existing) {
      return this.responseService.error(null, '助手不存在', 404);
    }

    if (existing.role === DEFAULT_ASSISTANT_KEY) {
      return this.responseService.error(null, '默认助手不支持删除', 400);
    }

    await this.prisma.chatPrompt.delete({
      where: { id },
    });
    this.agentService.unregisterAssistant(existing.role);
    return this.responseService.success(this.toPromptSummary(existing));
  }

  private async seedDefaultPromptIfNeeded() {
    const count = await this.prisma.chatPrompt.count();
    if (count > 0) return;

    await this.prisma.chatPrompt.create({
      data: {
        id: DEFAULT_ASSISTANT_ID,
        role: DEFAULT_ASSISTANT_KEY,
        label: DEFAULT_ASSISTANT_NAME,
        prompt: SYSTEM_PROMPT,
      },
    });
  }

  private toPromptSummary(item: { id: string; role: string; label: string }) {
    return {
      id: item.id,
      key: item.role,
      name: item.label,
    };
  }

  private toAssistantConfig(item: {
    id: string;
    role: string;
    label: string;
    prompt: string;
  }) {
    return {
      id: item.id,
      key: item.role,
      name: item.label,
      prompt: item.prompt,
    };
  }

  private normalizeCreatePromptInput(createPromptDto: CreatePromptDto) {
    const name =
      normalizeOptionalText(createPromptDto.name) ??
      normalizeOptionalText(createPromptDto.label);
    const keyInput =
      normalizeOptionalText(createPromptDto.key) ??
      normalizeOptionalText(createPromptDto.role);

    if (!name && !keyInput) {
      return { message: '请至少提供一个助手名称或助手标识' } as const;
    }

    if (name && name.length > 30) {
      return { message: '助手名称不能超过 30 个字符' } as const;
    }

    const key = keyInput
      ? normalizeAssistantKey(keyInput)
      : buildAssistantKeyFromName(name ?? '');
    if (!key) {
      return {
        message: '助手标识仅支持字母、数字、空格、短横线和下划线',
      } as const;
    }

    return {
      key,
      name: name ?? formatAssistantName(key),
    } as const;
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeAssistantKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildAssistantKeyFromName(name: string): string {
  const normalized = normalizeAssistantKey(name);
  return normalized || `chat-${randomUUID().slice(0, 8)}`;
}

function formatAssistantName(key: string): string {
  const text = key
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ');

  return text || '新聊天';
}
