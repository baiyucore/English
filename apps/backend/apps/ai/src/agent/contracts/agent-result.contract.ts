import { z } from 'zod';

import { correctionResultSchema } from '../tools/correction.schema';
import { translationResultSchema } from '../tools/translation.schema';
import { AGENT_INTENTS } from './intent.contract';

/**
 * 词典 Tool 的规范化业务结果。它与渲染器分离，供 Agent State、SSE 和持久化共同使用。
 */
export const vocabularyLookupResultSchema = z.object({
  word: z.string().trim().min(1).max(120),
  entries: z.array(
    z.object({
      word: z.string().nullable(),
      phonetic: z.string().nullable(),
      meanings: z.array(
        z.object({
          partOfSpeech: z.string().nullable(),
          definitions: z.array(
            z.object({
              definition: z.string(),
              example: z.string().nullable(),
              synonyms: z.array(z.string()),
            }),
          ),
          synonyms: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export type VocabularyLookupResult = z.infer<
  typeof vocabularyLookupResultSchema
>;

/** 所有可被后续程序消费的英语学习业务结果。 */
export const agentStructuredResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('translation'), data: translationResultSchema }),
  z.object({ kind: z.literal('correction'), data: correctionResultSchema }),
  z.object({
    kind: z.literal('vocabulary'),
    data: vocabularyLookupResultSchema,
  }),
  z.object({ kind: z.literal('learning_chat'), data: z.null() }),
]);

export type AgentStructuredResult = z.infer<typeof agentStructuredResultSchema>;

export const AGENT_FAILURE_CODES = [
  'VALIDATION_ERROR',
  'INPUT_TOO_LARGE',
  'INPUT_COUNT_EXCEEDED',
  'INPUT_TOKEN_BUDGET_EXCEEDED',
  'ATTACHMENT_TOO_LARGE',
  'ATTACHMENT_COUNT_EXCEEDED',
  'UNSUPPORTED_FILE_TYPE',
  'TOOL_OUTPUT_TOO_LARGE',
  'TIMEOUT',
  'RATE_LIMITED',
  'CANCELLED',
  'DOWNSTREAM_ERROR',
  'INTERNAL_ERROR',
] as const;

export const agentFailureSchema = z.object({
  code: z.enum(AGENT_FAILURE_CODES),
  message: z.string().trim().min(1).max(500),
  retryable: z.boolean(),
  field: z.string().trim().min(1).max(120).optional(),
  boundary: z
    .object({
      actual: z.number().nonnegative().optional(),
      limit: z.number().nonnegative().optional(),
      unit: z.enum(['characters', 'items', 'bytes', 'tokens']),
    })
    .optional(),
});

export const agentRetrySchema = z.object({
  state: z.enum(['not_needed', 'retrying', 'exhausted', 'not_retryable']),
  retryable: z.boolean(),
  nextRetryAfterMs: z.number().int().positive().optional(),
});

/** 一次 Agent 执行的可观察信息；当前尚未启动自动重试，故默认仅允许一次。 */
export const agentExecutionMetaSchema = z
  .object({
    durationMs: z.number().nonnegative().optional(),
    attempt: z.number().int().positive().default(1),
    maxAttempts: z.number().int().positive().default(1),
    retry: agentRetrySchema.default({
      state: 'not_needed',
      retryable: false,
    }),
  })
  .superRefine((value, context) => {
    if (value.attempt > value.maxAttempts) {
      context.addIssue({
        code: 'custom',
        path: ['attempt'],
        message: 'attempt 不能超过 maxAttempts。',
      });
    }
  });

const agentRouteSchema = z.enum(AGENT_INTENTS);

/**
 * LangChain、LangGraph、SSE 和持久化层共享的最终结果。
 * `content` 给用户展示；`structuredResult` 专供程序后续处理，绝不依赖解析 Markdown。
 */
export const agentResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    route: agentRouteSchema,
    content: z.string(),
    structuredResult: agentStructuredResultSchema.nullable(),
    execution: agentExecutionMetaSchema,
  }),
  z.object({
    status: z.literal('requires_input'),
    route: agentRouteSchema.nullable(),
    content: z.string().trim().min(1),
    question: z.string().trim().min(1),
    fields: z.array(z.string().trim().min(1)).min(1),
    structuredResult: agentStructuredResultSchema.nullable(),
    execution: agentExecutionMetaSchema,
  }),
  z.object({
    status: z.literal('failed'),
    route: agentRouteSchema.nullable(),
    content: z.string().trim().min(1),
    error: agentFailureSchema,
    execution: agentExecutionMetaSchema,
  }),
  z.object({
    status: z.literal('cancelled'),
    route: agentRouteSchema.nullable(),
    content: z.string().trim().min(1),
    error: agentFailureSchema,
    execution: agentExecutionMetaSchema,
  }),
]);

export type AgentResult = z.infer<typeof agentResultSchema>;

export const AGENT_RESULT_METADATA_VERSION = 1;
export const MAX_AGENT_RESULT_METADATA_BYTES = 64 * 1024;

export function createExecutionMeta(
  options: Partial<z.input<typeof agentExecutionMetaSchema>> = {},
) {
  return agentExecutionMetaSchema.parse(options);
}

export function createCompletedAgentResult(
  route: z.infer<typeof agentRouteSchema>,
  content: string,
  structuredResult: AgentStructuredResult | null,
  execution: Partial<z.input<typeof agentExecutionMetaSchema>> = {},
): AgentResult {
  return agentResultSchema.parse({
    status: 'completed',
    route,
    content,
    structuredResult,
    execution: createExecutionMeta(execution),
  });
}

export function createRequiresInputAgentResult(
  route: z.infer<typeof agentRouteSchema> | null,
  question: string,
  fields: string[],
  structuredResult: AgentStructuredResult | null = null,
  execution: Partial<z.input<typeof agentExecutionMetaSchema>> = {},
): AgentResult {
  return agentResultSchema.parse({
    status: 'requires_input',
    route,
    content: question,
    question,
    fields,
    structuredResult,
    execution: createExecutionMeta(execution),
  });
}

export function createFailedAgentResult(
  route: z.infer<typeof agentRouteSchema> | null,
  content: string,
  error: z.input<typeof agentFailureSchema>,
  execution: Partial<z.input<typeof agentExecutionMetaSchema>> = {},
): AgentResult {
  const parsedError = agentFailureSchema.parse(error);
  return agentResultSchema.parse({
    status: parsedError.code === 'CANCELLED' ? 'cancelled' : 'failed',
    route,
    content,
    error: parsedError,
    execution: createExecutionMeta({
      ...execution,
      retry: execution.retry ?? {
        state: parsedError.retryable ? 'exhausted' : 'not_retryable',
        retryable: parsedError.retryable,
      },
    }),
  });
}

/** 为同一份最终结果补充整次 Agent 运行耗时。 */
export function withAgentResultDuration(
  result: AgentResult,
  durationMs: number,
): AgentResult {
  return agentResultSchema.parse({
    ...result,
    execution: {
      ...result.execution,
      durationMs: Math.max(0, Math.round(durationMs)),
    },
  });
}

/**
 * 写入 ChatMessage.metadata 前的有界快照。
 * 聊天正文已单独存储；当业务结果异常膨胀时仅丢弃 structuredResult，避免单条消息
 * 把数据库或 checkpoint 撑大。
 */
export function createAgentResultMetadata(result: AgentResult) {
  const parsed = agentResultSchema.parse(result);
  const metadata = {
    agentResultVersion: AGENT_RESULT_METADATA_VERSION,
    agentResult: parsed,
  };
  if (
    Buffer.byteLength(JSON.stringify(metadata), 'utf8') <=
    MAX_AGENT_RESULT_METADATA_BYTES
  ) {
    return metadata;
  }

  const withoutStructuredResult =
    parsed.status === 'completed' || parsed.status === 'requires_input'
      ? { ...parsed, structuredResult: null }
      : parsed;
  return {
    agentResultVersion: AGENT_RESULT_METADATA_VERSION,
    agentResult: withoutStructuredResult,
    agentResultTruncated: true,
  };
}
