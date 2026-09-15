import type { AgentIntent } from '../contracts/intent.contract';
import type { PrismaService } from '@libs/shared';
import {
  createCompletedAgentResult,
  createFailedAgentResult,
  createRequiresInputAgentResult,
  type AgentResult,
} from '../contracts/agent-result.contract';
import {
  correctEnglishTool,
  createLookupWordTool,
  messageContentToText,
  type ToolResult,
  translateZhToEnTool,
} from '../capabilities';
import { extractVocabularyQuery } from '../executors/vocabulary-query.executor';
import { renderCorrectionResult } from '../renderers/correction.renderer';
import {
  renderTranslationClarification,
  renderTranslationResult,
} from '../renderers/translation.renderer';
import {
  renderVocabularyClarification,
  renderVocabularyResult,
  type VocabularyLookupResult,
} from '../renderers/vocabulary.renderer';
import type { AgentStreamEmit } from '../stream/agent-stream-event';
import type { CorrectionResult } from '../tools/correction.schema';
import type { TranslationResult } from '../tools/translation.schema';

/** LangChain 专项能力：工具调用、结构化结果校验与面向用户的渲染。 */
export type SpecializedRoute = Exclude<AgentIntent, 'learning_chat'>;

export type SpecializedExecutionResult = AgentResult;

type TranslationToolData = {
  original: string;
  result: TranslationResult;
};

type CorrectionToolData = {
  original: string;
  result: CorrectionResult;
};

export async function executeSpecializedRoute(
  route: SpecializedRoute,
  content: string,
  emit: AgentStreamEmit,
  runId: string,
  prisma: PrismaService,
  signal?: AbortSignal,
): Promise<SpecializedExecutionResult> {
  if (route === 'translation') {
    const outcome = await invokeSpecializedTool<TranslationToolData>(
      'translate_zh_to_en',
      runId,
      emit,
      () => translateZhToEnTool.invoke({ text: content }, { signal }),
    );
    return renderTranslationOutcome(outcome);
  }

  if (route === 'correction') {
    const outcome = await invokeSpecializedTool<CorrectionToolData>(
      'correct_english',
      runId,
      emit,
      () => correctEnglishTool.invoke({ text: content }, { signal }),
    );
    return renderCorrectionOutcome(outcome);
  }

  return executeVocabularyRoute(content, emit, runId, prisma, signal);
}

async function executeVocabularyRoute(
  content: string,
  emit: AgentStreamEmit,
  runId: string,
  prisma: PrismaService,
  signal?: AbortSignal,
): Promise<SpecializedExecutionResult> {
  const tool = 'extract_vocabulary_query';
  const callId = `${runId}:${tool}`;
  const startedAt = Date.now();
  await emit({ type: 'tool_started', role: 'ai', runId, tool, callId });

  try {
    const query = await extractVocabularyQuery(content, signal);
    await emit({
      type: 'tool_completed',
      role: 'ai',
      runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
    });
    if (query.needsClarification) {
      return createRequiresInputAgentResult(
        'vocabulary',
        renderVocabularyClarification(
          query.clarificationQuestion ?? '请告诉我想查询的英文单词或短语。',
        ),
        ['word'],
      );
    }

    const outcome = await invokeSpecializedTool<VocabularyLookupResult>(
      'lookup_word',
      runId,
      emit,
      () => createLookupWordTool(prisma).invoke({ word: query.word }, { signal }),
    );
    return renderVocabularyOutcome(outcome);
  } catch {
    await emit({
      type: 'tool_failed',
      role: 'ai',
      runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
      error: {
        code: 'DOWNSTREAM_ERROR',
        message: '词汇查询参数提取失败',
        retryable: true,
      },
    });
    return createFailedAgentResult(
      'vocabulary',
      '暂时无法识别要查询的词条，请直接发送英文单词或短语后再试。',
      {
        code: 'DOWNSTREAM_ERROR',
        message: '词汇查询参数提取失败',
        retryable: true,
      },
    );
  }
}

async function invokeSpecializedTool<T>(
  tool: string,
  runId: string,
  emit: AgentStreamEmit,
  invoke: () => Promise<unknown>,
): Promise<ToolResult<T> | null> {
  const callId = `${runId}:${tool}`;
  const startedAt = Date.now();
  await emit({ type: 'tool_started', role: 'ai', runId, tool, callId });

  try {
    const outcome = parseToolResult<T>(await invoke());
    const durationMs = Date.now() - startedAt;
    if (outcome.status === 'failed') {
      await emit({
        type: 'tool_failed',
        role: 'ai',
        runId,
        tool,
        callId,
        durationMs,
        error: outcome.error,
      });
    } else {
      await emit({
        type: 'tool_completed',
        role: 'ai',
        runId,
        tool,
        callId,
        durationMs,
      });
    }
    return outcome;
  } catch {
    await emit({
      type: 'tool_failed',
      role: 'ai',
      runId,
      tool,
      callId,
      durationMs: Date.now() - startedAt,
      error: {
        code: 'INTERNAL_ERROR',
        message: '工具结果解析失败',
        retryable: true,
      },
    });
    return null;
  }
}

function renderTranslationOutcome(
  outcome: ToolResult<TranslationToolData> | null,
): SpecializedExecutionResult {
  if (!outcome || outcome.status === 'failed') {
    return createToolFailureResult('translation', '翻译', outcome);
  }
  if (outcome.status === 'requires_input') {
    return createRequiresInputAgentResult(
      'translation',
      renderTranslationClarification(outcome.request.question),
      outcome.request.fields,
    );
  }
  return createCompletedAgentResult(
    'translation',
    renderTranslationResult(outcome.data.result),
    { kind: 'translation', data: outcome.data.result },
  );
}

function renderCorrectionOutcome(
  outcome: ToolResult<CorrectionToolData> | null,
): SpecializedExecutionResult {
  if (!outcome || outcome.status === 'failed') {
    return createToolFailureResult('correction', '英文纠错', outcome);
  }
  if (outcome.status === 'requires_input') {
    return createRequiresInputAgentResult(
      'correction',
      outcome.request.question,
      outcome.request.fields,
    );
  }
  return createCompletedAgentResult(
    'correction',
    renderCorrectionResult(outcome.data.result),
    { kind: 'correction', data: outcome.data.result },
  );
}

function renderVocabularyOutcome(
  outcome: ToolResult<VocabularyLookupResult> | null,
): SpecializedExecutionResult {
  if (!outcome || outcome.status === 'failed') {
    return createToolFailureResult('vocabulary', '词汇查询', outcome);
  }
  if (outcome.status === 'requires_input') {
    return createRequiresInputAgentResult(
      'vocabulary',
      renderVocabularyClarification(outcome.request.question),
      outcome.request.fields,
    );
  }
  return createCompletedAgentResult(
    'vocabulary',
    renderVocabularyResult(outcome.data),
    { kind: 'vocabulary', data: outcome.data },
  );
}

function createToolFailureResult(
  route: SpecializedRoute,
  capability: string,
  outcome: ToolResult<unknown> | null,
): AgentResult {
  const error =
    outcome?.status === 'failed'
      ? outcome.error
      : {
          code: 'INTERNAL_ERROR' as const,
          message: '工具结果解析失败',
          retryable: true,
        };
  return createFailedAgentResult(route, renderToolFailure(capability), {
    code: mapToolErrorCode(error.code),
    message: error.message,
    retryable: error.retryable,
    ...(error.field ? { field: error.field } : {}),
  });
}

function mapToolErrorCode(code: string) {
  if (code === 'TIMEOUT_ERROR') return 'TIMEOUT' as const;
  if (code === 'CANCELLED') return 'CANCELLED' as const;
  if (code === 'NOT_FOUND') return 'DOWNSTREAM_ERROR' as const;
  return code as 'VALIDATION_ERROR' | 'DOWNSTREAM_ERROR' | 'INTERNAL_ERROR';
}

function parseToolResult<T>(content: unknown): ToolResult<T> {
  const text = messageContentToText(content);
  if (!text) throw new Error('Tool returned an empty result');

  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || typeof value.tool !== 'string') {
    throw new Error('Tool returned an invalid result envelope');
  }
  if (value.status === 'completed' && 'data' in value) {
    return value as ToolResult<T>;
  }
  if (
    value.status === 'requires_input' &&
    isRecord(value.request) &&
    typeof value.request.question === 'string' &&
    Array.isArray(value.request.fields)
  ) {
    return value as ToolResult<T>;
  }
  if (
    value.status === 'failed' &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string' &&
    typeof value.error.retryable === 'boolean'
  ) {
    return value as ToolResult<T>;
  }
  throw new Error('Tool returned an unsupported result status');
}

function renderToolFailure(capability: string): string {
  return `暂时无法完成${capability}，请稍后再试。`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
