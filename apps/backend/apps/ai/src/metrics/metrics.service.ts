import { Injectable } from '@nestjs/common';
import type {
  LlmRun,
  MetricsOverview,
  MetricsOverviewQuery,
  MetricsRange,
  MetricsTrendPoint,
} from '@en/common/metrics';
import { PrismaService, ResponseService } from '@libs/shared';

const RANGE_DAYS: Record<MetricsRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export type RecordLlmRunInput = {
  userId?: string | null;
  conversationId?: string | null;
  scene?: string;
  provider: string;
  model: string;
  promptVersion?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  firstTokenMs?: number;
  durationMs?: number;
  costCents?: number;
  qualityScore?: number | null;
  status?: 'success' | 'failed';
};

@Injectable()
export class MetricsService {
  constructor(
    private readonly responseService: ResponseService,
    private readonly prisma: PrismaService,
  ) {}

  async getOverview(query: MetricsOverviewQuery = {}) {
    const range = normalizeRange(query.range);
    const since = startOfRange(range);
    const keyword = query.keyword?.trim();
    const userId = query.userId?.trim();

    const runs = await this.prisma.llmRun.findMany({
      where: {
        createdAt: { gte: since },
        ...(userId ? { userId } : {}),
        ...(keyword
          ? {
              OR: [
                { model: { contains: keyword, mode: 'insensitive' } },
                { scene: { contains: keyword, mode: 'insensitive' } },
                { promptVersion: { contains: keyword, mode: 'insensitive' } },
                { provider: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const data: MetricsOverview = {
      runs: runs.map(toLlmRunDto),
      trend: buildTrend(runs, range),
    };

    return this.responseService.success(data);
  }

  async recordRun(input: RecordLlmRunInput) {
    try {
      await this.prisma.llmRun.create({
        data: {
          userId: input.userId?.trim() || null,
          conversationId: input.conversationId?.trim() || null,
          scene: input.scene?.trim() || '自由对话',
          provider: input.provider,
          model: input.model,
          promptVersion: input.promptVersion?.trim() || 'v1',
          inputTokens: Math.max(0, Math.round(input.inputTokens ?? 0)),
          cachedInputTokens: Math.max(
            0,
            Math.round(input.cachedInputTokens ?? 0),
          ),
          outputTokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
          firstTokenMs: Math.max(0, Math.round(input.firstTokenMs ?? 0)),
          durationMs: Math.max(0, Math.round(input.durationMs ?? 0)),
          costCents: Number((input.costCents ?? 0).toFixed(4)),
          qualityScore:
            input.qualityScore == null
              ? null
              : Math.round(input.qualityScore),
          status: input.status === 'failed' ? 'FAILED' : 'SUCCESS',
        },
      });
    } catch (error) {
      // 埋点失败不影响主流程
      console.error('[MetricsService] recordRun failed', error);
    }
  }
}

function normalizeRange(range?: string): MetricsRange {
  if (range === '14d' || range === '30d' || range === '7d') return range;
  return '7d';
}

function startOfRange(range: MetricsRange): Date {
  const days = RANGE_DAYS[range];
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function toLlmRunDto(run: {
  id: string;
  createdAt: Date;
  scene: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  firstTokenMs: number;
  durationMs: number;
  costCents: number;
  qualityScore: number | null;
  status: 'SUCCESS' | 'FAILED';
}): LlmRun {
  return {
    id: run.id,
    createdAt: formatCreatedAt(run.createdAt),
    scene: run.scene,
    provider: run.provider,
    model: run.model,
    promptVersion: run.promptVersion,
    inputTokens: run.inputTokens,
    cachedInputTokens: run.cachedInputTokens,
    outputTokens: run.outputTokens,
    firstTokenMs: run.firstTokenMs,
    durationMs: run.durationMs,
    costCents: Number(run.costCents.toFixed(2)),
    qualityScore: run.qualityScore ?? 0,
    status: run.status === 'FAILED' ? 'failed' : 'success',
  };
}

function formatCreatedAt(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function buildTrend(
  runs: Array<{
    createdAt: Date;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  }>,
  range: MetricsRange,
): MetricsTrendPoint[] {
  const days = RANGE_DAYS[range];
  const buckets = new Map<string, MetricsTrendPoint>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const label = formatDayLabel(date);
    buckets.set(label, { label, total: 0, cached: 0 });
  }

  for (const run of runs) {
    const label = formatDayLabel(run.createdAt);
    const bucket = buckets.get(label);
    if (!bucket) continue;
    bucket.total += run.inputTokens + run.outputTokens;
    bucket.cached += run.cachedInputTokens;
  }

  return Array.from(buckets.values());
}

function formatDayLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}
