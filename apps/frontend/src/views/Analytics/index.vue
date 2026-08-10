<template>
  <main class="min-h-[calc(100vh-80px)] bg-slate-50">
    <div class="mx-auto w-full max-w-[1200px] px-4 py-6">
      <section class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="text-2xl font-extrabold text-slate-950">模型数据看板</div>
          <div class="mt-2 text-sm text-slate-500">
            观察 token、缓存命中、耗时与结果评分，方便后续切换模型时做对比。
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <el-tag :type="loading ? 'warning' : 'success'" effect="plain">
            {{ loading ? '加载中' : '实时数据' }}
          </el-tag>
          <el-segmented v-model="selectedRange" :options="rangeOptions" />
        </div>
      </section>
      <div v-if="errorMessage" class="mt-3 text-sm text-rose-500">
        {{ errorMessage }}
      </div>

      <section
        class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <div
          v-for="metric in summaryMetrics"
          :key="metric.label"
          class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium text-slate-500">{{
              metric.label
            }}</span>
            <component
              :is="metric.icon"
              class="h-5 w-5"
              :class="metric.color"
            />
          </div>
          <div class="mt-3 text-2xl font-extrabold text-slate-950">
            {{ metric.value }}
          </div>
          <div class="mt-2 text-xs text-slate-500">{{ metric.hint }}</div>
        </div>
      </section>

      <section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold text-slate-950">
                Token 使用趋势
              </div>
              <div class="mt-1 text-xs text-slate-500">
                输入、输出与缓存命中按天汇总
              </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-2 rounded-full bg-slate-900"></span>总量
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>命中
              </span>
            </div>
          </div>

          <div class="mt-4 h-[260px] overflow-hidden rounded-md bg-slate-50">
            <svg
              viewBox="0 0 720 260"
              class="h-full w-full"
              role="img"
              aria-label="Token usage trend"
            >
              <line
                v-for="tick in yTicks"
                :key="tick.y"
                x1="44"
                x2="700"
                :y1="tick.y"
                :y2="tick.y"
                stroke="#e2e8f0"
                stroke-width="1"
              />
              <text
                v-for="tick in yTicks"
                :key="tick.label"
                x="8"
                :y="tick.y + 4"
                fill="#64748b"
                font-size="11"
              >
                {{ tick.label }}
              </text>

              <polyline
                :points="totalTrendPoints"
                fill="none"
                stroke="#0f172a"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <polyline
                :points="cachedTrendPoints"
                fill="none"
                stroke="#10b981"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <g v-for="point in trendPointMeta" :key="point.label">
                <circle :cx="point.x" :cy="point.totalY" r="4" fill="#0f172a" />
                <circle
                  :cx="point.x"
                  :cy="point.cachedY"
                  r="4"
                  fill="#10b981"
                />
                <text
                  :x="point.x"
                  y="246"
                  text-anchor="middle"
                  fill="#64748b"
                  font-size="11"
                >
                  {{ point.label }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-base font-bold text-slate-950">成本与速度</div>
          <div class="mt-1 text-xs text-slate-500">
            用于判断模型切换后是否真的更划算
          </div>

          <div class="mt-5 space-y-5">
            <div v-for="item in efficiencyStats" :key="item.label">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-slate-700">{{ item.label }}</span>
                <span class="font-bold text-slate-950">{{ item.value }}</span>
              </div>
              <div class="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  class="h-2 rounded-full"
                  :class="item.barClass"
                  :style="{ width: item.width }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"
        >
          <div>
            <div class="text-base font-bold text-slate-950">模型横向对比</div>
            <div class="mt-1 text-xs text-slate-500">
              同一批任务下比较输入量、命中率、输出量、评分和首 token 时间
            </div>
          </div>

          <el-radio-group v-model="comparisonMetric" size="small">
            <el-radio-button label="totalTokens">Token</el-radio-button>
            <el-radio-button label="cacheRate">命中率</el-radio-button>
            <el-radio-button label="qualityScore">评分</el-radio-button>
          </el-radio-group>
        </div>

        <div class="grid grid-cols-1 gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div class="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
            <div
              v-for="model in modelComparison"
              :key="model.model"
              class="mb-4 last:mb-0"
            >
              <div class="mb-2 flex items-center justify-between gap-3">
                <span class="truncate text-sm font-semibold text-slate-800">{{
                  model.model
                }}</span>
                <span class="text-sm font-bold text-slate-950">{{
                  formatComparisonValue(model)
                }}</span>
              </div>
              <div class="h-3 rounded-full bg-slate-100">
                <div
                  class="h-3 rounded-full bg-slate-900"
                  :style="{ width: `${model.barWidth}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto p-4">
            <el-table
              :data="modelComparison"
              size="small"
              class="min-w-[640px]"
            >
              <el-table-column prop="model" label="模型" min-width="170" />
              <el-table-column label="请求数" width="90">
                <template #default="{ row }">{{ row.runCount }}</template>
              </el-table-column>
              <el-table-column label="输入 token" width="120">
                <template #default="{ row }">{{
                  formatNumber(row.inputTokens)
                }}</template>
              </el-table-column>
              <el-table-column label="命中率" width="100">
                <template #default="{ row }">{{
                  formatPercent(row.cacheRate)
                }}</template>
              </el-table-column>
              <el-table-column label="输出 token" width="120">
                <template #default="{ row }">{{
                  formatNumber(row.outputTokens)
                }}</template>
              </el-table-column>
              <el-table-column label="评分" width="90">
                <template #default="{ row }">{{
                  row.qualityScore ?? '--'
                }}</template>
              </el-table-column>
              <el-table-column label="首 token" width="110">
                <template #default="{ row }">{{ row.firstTokenMs }}ms</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </section>

      <section
        class="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"
        >
          <div>
            <div class="text-base font-bold text-slate-950">最近请求</div>
            <div class="mt-1 text-xs text-slate-500">
              后续可从这里钻到单次对话、提示版本和原始统计
            </div>
          </div>
          <el-input
            v-model="keyword"
            class="w-full sm:w-[260px]"
            placeholder="筛选模型、场景、路由或 Skill"
            clearable
          />
        </div>

        <div class="overflow-x-auto p-4">
          <el-table :data="filteredRuns" size="small" class="min-w-[920px]">
            <el-table-column prop="createdAt" label="时间" width="150" />
            <el-table-column prop="scene" label="场景" min-width="140" />
            <el-table-column prop="route" label="路由" width="120">
              <template #default="{ row }">{{ row.route || '-' }}</template>
            </el-table-column>
            <el-table-column prop="skillId" label="Skill" width="120">
              <template #default="{ row }">{{ row.skillId || '-' }}</template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="160" />
            <el-table-column
              prop="promptVersion"
              label="提示版本"
              width="110"
            />
            <el-table-column label="输入" width="100">
              <template #default="{ row }">{{
                formatNumber(row.inputTokens)
              }}</template>
            </el-table-column>
            <el-table-column label="命中" width="100">
              <template #default="{ row }">{{
                formatNumber(row.cachedInputTokens)
              }}</template>
            </el-table-column>
            <el-table-column label="输出" width="100">
              <template #default="{ row }">{{
                formatNumber(row.outputTokens)
              }}</template>
            </el-table-column>
            <el-table-column label="耗时" width="100">
              <template #default="{ row }">{{ row.durationMs }}ms</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Coin, DataLine, Finished, Lightning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getMetricsOverview } from '@/apis/metrics';
import type {
  LlmRun,
  MetricsRange,
  MetricsTrendPoint,
} from '@en/common/metrics';

type RangeValue = MetricsRange;
type ComparisonMetric = 'totalTokens' | 'cacheRate' | 'qualityScore';

interface ModelComparison {
  model: string;
  runCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheRate: number;
  firstTokenMs: number;
  durationMs: number;
  costCents: number;
  qualityScore: number | null;
  barWidth: number;
}

const selectedRange = ref<RangeValue>('7d');
const comparisonMetric = ref<ComparisonMetric>('totalTokens');
const keyword = ref('');
const loading = ref(false);
const errorMessage = ref('');

const rangeOptions = [
  { label: '7 天', value: '7d' },
  { label: '14 天', value: '14d' },
  { label: '30 天', value: '30d' },
];

const runs = ref<LlmRun[]>([]);
const trendPoints = ref<MetricsTrendPoint[]>([]);

const visibleRuns = computed(() => {
  return runs.value;
});

const totals = computed(() => {
  return visibleRuns.value.reduce(
    (acc, run) => {
      acc.inputTokens += run.inputTokens;
      acc.cachedInputTokens += run.cachedInputTokens;
      acc.outputTokens += run.outputTokens;
      acc.totalTokens += run.inputTokens + run.outputTokens;
      acc.firstTokenMs += run.firstTokenMs;
      acc.durationMs += run.durationMs;
      acc.costCents += run.costCents;
      if (run.qualityScore !== null) {
        acc.qualityScore += run.qualityScore;
        acc.qualityScoreCount += 1;
      }
      return acc;
    },
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      firstTokenMs: 0,
      durationMs: 0,
      costCents: 0,
      qualityScore: 0,
      qualityScoreCount: 0,
    },
  );
});

const summaryMetrics = computed(() => {
  const runCount = visibleRuns.value.length || 1;
  const cacheRate = totals.value.inputTokens
    ? totals.value.cachedInputTokens / totals.value.inputTokens
    : 0;

  return [
    {
      label: '总 token',
      value: formatNumber(totals.value.totalTokens),
      hint: `输入 ${formatNumber(totals.value.inputTokens)} / 输出 ${formatNumber(totals.value.outputTokens)}`,
      icon: Coin,
      color: 'text-slate-700',
    },
    {
      label: '缓存命中率',
      value: formatPercent(cacheRate),
      hint: `命中 ${formatNumber(totals.value.cachedInputTokens)} 输入 token`,
      icon: Finished,
      color: 'text-emerald-600',
    },
    {
      label: '平均首 token',
      value: `${Math.round(totals.value.firstTokenMs / runCount)}ms`,
      hint: '用户开始看到回复的等待时间',
      icon: Lightning,
      color: 'text-amber-500',
    },
    {
      label: '平均评分',
      value: totals.value.qualityScoreCount
        ? `${Math.round(totals.value.qualityScore / totals.value.qualityScoreCount)}`
        : '--',
      hint: '后续由固定评测集或人工反馈写入',
      icon: DataLine,
      color: 'text-rose-500',
    },
  ];
});

const modelComparison = computed<ModelComparison[]>(() => {
  const grouped = new Map<string, LlmRun[]>();
  visibleRuns.value.forEach((run) => {
    grouped.set(run.model, [...(grouped.get(run.model) ?? []), run]);
  });

  const rows = Array.from(grouped.entries()).map(([model, group]) => {
    const sum = group.reduce(
      (acc, run) => {
        acc.inputTokens += run.inputTokens;
        acc.cachedInputTokens += run.cachedInputTokens;
        acc.outputTokens += run.outputTokens;
        acc.firstTokenMs += run.firstTokenMs;
        acc.durationMs += run.durationMs;
        acc.costCents += run.costCents;
        if (run.qualityScore !== null) {
          acc.qualityScore += run.qualityScore;
          acc.qualityScoreCount += 1;
        }
        return acc;
      },
      {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        firstTokenMs: 0,
        durationMs: 0,
        costCents: 0,
        qualityScore: 0,
        qualityScoreCount: 0,
      },
    );
    const runCount = group.length;
    const cacheRate = sum.inputTokens
      ? sum.cachedInputTokens / sum.inputTokens
      : 0;

    return {
      model,
      runCount,
      inputTokens: sum.inputTokens,
      cachedInputTokens: sum.cachedInputTokens,
      outputTokens: sum.outputTokens,
      totalTokens: sum.inputTokens + sum.outputTokens,
      cacheRate,
      firstTokenMs: Math.round(sum.firstTokenMs / runCount),
      durationMs: Math.round(sum.durationMs / runCount),
      costCents: Number(sum.costCents.toFixed(2)),
      qualityScore: sum.qualityScoreCount
        ? Math.round(sum.qualityScore / sum.qualityScoreCount)
        : null,
      barWidth: 0,
    };
  });

  const maxValue = Math.max(
    ...rows.map((row) => metricValue(row, comparisonMetric.value)),
    1,
  );

  return rows
    .map((row) => ({
      ...row,
      barWidth: Math.max(
        8,
        (metricValue(row, comparisonMetric.value) / maxValue) * 100,
      ),
    }))
    .sort(
      (a, b) =>
        metricValue(b, comparisonMetric.value) -
        metricValue(a, comparisonMetric.value),
    );
});

const trendData = computed(() => {
  return trendPoints.value;
});

const maxTrendValue = computed(() => {
  return Math.max(...trendData.value.map((item) => item.total), 1);
});

const trendPointMeta = computed(() => {
  const left = 56;
  const right = 684;
  const top = 26;
  const bottom = 220;
  const width = right - left;
  const height = bottom - top;
  const lastIndex = Math.max(trendData.value.length - 1, 1);

  return trendData.value.map((item, index) => {
    const x = left + (width * index) / lastIndex;
    const toY = (value: number) =>
      bottom - (value / maxTrendValue.value) * height;

    return {
      label: item.label.slice(3),
      x,
      totalY: toY(item.total),
      cachedY: toY(item.cached),
    };
  });
});

const totalTrendPoints = computed(() => {
  return trendPointMeta.value
    .map((point) => `${point.x},${point.totalY}`)
    .join(' ');
});

const cachedTrendPoints = computed(() => {
  return trendPointMeta.value
    .map((point) => `${point.x},${point.cachedY}`)
    .join(' ');
});

const yTicks = computed(() => {
  const top = 26;
  const bottom = 220;
  return [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
    const value = maxTrendValue.value * ratio;
    return {
      y: bottom - ratio * (bottom - top),
      label: compactNumber(value),
    };
  });
});

const efficiencyStats = computed(() => {
  const runCount = visibleRuns.value.length || 1;
  const avgDuration = Math.round(totals.value.durationMs / runCount);
  const avgCost = totals.value.costCents / runCount;
  const outputPerInput = totals.value.inputTokens
    ? totals.value.outputTokens / totals.value.inputTokens
    : 0;

  return [
    {
      label: '平均耗时',
      value: `${avgDuration}ms`,
      width: `${Math.min(100, Math.max(12, avgDuration / 90))}%`,
      barClass: 'bg-amber-400',
    },
    {
      label: '平均成本',
      value: `${avgCost.toFixed(2)} 分`,
      width: `${Math.min(100, Math.max(12, avgCost * 24))}%`,
      barClass: 'bg-rose-400',
    },
    {
      label: '输出/输入',
      value: outputPerInput.toFixed(2),
      width: `${Math.min(100, Math.max(12, outputPerInput * 120))}%`,
      barClass: 'bg-emerald-500',
    },
  ];
});

const filteredRuns = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return visibleRuns.value;

  return visibleRuns.value.filter((run) => {
    return `${run.model} ${run.scene} ${run.route ?? ''} ${run.skillId ?? ''} ${run.promptVersion}`
      .toLowerCase()
      .includes(value);
  });
});

const metricValue = (row: ModelComparison, metric: ComparisonMetric) => {
  return row[metric] ?? 0;
};

const formatComparisonValue = (row: ModelComparison) => {
  if (comparisonMetric.value === 'cacheRate') {
    return formatPercent(row.cacheRate);
  }
  if (comparisonMetric.value === 'qualityScore') {
    return row.qualityScore == null ? '--' : `${row.qualityScore} 分`;
  }
  return formatNumber(row.totalTokens);
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('zh-CN').format(value);
};

const compactNumber = (value: number) => {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value)}`;
};

const loadOverview = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await getMetricsOverview({
      range: selectedRange.value,
    });
    if (!response.success) {
      throw new Error(response.message || '获取看板数据失败');
    }
    runs.value = response.data.runs ?? [];
    trendPoints.value = response.data.trend ?? [];
  } catch (error) {
    runs.value = [];
    trendPoints.value = [];
    errorMessage.value = '加载看板数据失败，请稍后重试';
    ElMessage.error(
      error instanceof Error ? error.message : '加载看板数据失败，请稍后重试',
    );
  } finally {
    loading.value = false;
  }
};

watch(selectedRange, () => {
  void loadOverview();
});

onMounted(() => {
  void loadOverview();
});
</script>
