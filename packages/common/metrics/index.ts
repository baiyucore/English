export type MetricsRange = '7d' | '14d' | '30d';

export type LlmRunStatus = 'success' | 'failed';

export type LlmRun = {
  id: string;
  createdAt: string;
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
  qualityScore: number;
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
