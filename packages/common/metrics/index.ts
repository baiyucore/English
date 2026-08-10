export type MetricsRange = '7d' | '14d' | '30d';

export type LlmRunStatus = 'success' | 'failed';

export type LlmRun = {
  id: string;
  createdAt: string;
  scene: string;
  /** 能力路由，例如 translation；未命中专项能力时为 null */
  route: string | null;
  /** 命中的 Skill id；未命中时为 null */
  skillId: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  firstTokenMs: number;
  durationMs: number;
  costCents: number;
  /** 尚未评测时为 null，不应伪装成 0 分 */
  qualityScore: number | null;
  status: LlmRunStatus;
};

export type MetricsTrendPoint = {
  label: string;
  total: number;
  cached: number;
};

export type MetricsOverview = {
  runs: LlmRun[];
  trend: MetricsTrendPoint[];
};

export type MetricsOverviewQuery = {
  range?: MetricsRange;
  userId?: string;
  keyword?: string;
};
