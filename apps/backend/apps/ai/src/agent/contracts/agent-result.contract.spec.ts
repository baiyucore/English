import {
  agentResultSchema,
  createAgentResultMetadata,
  createCompletedAgentResult,
  createFailedAgentResult,
  createRequiresInputAgentResult,
} from './agent-result.contract';

describe('agent result contract', () => {
  it('keeps a translation result available after the user-facing text is rendered', () => {
    const result = createCompletedAgentResult('translation', 'Hello, world.', {
      kind: 'translation',
      data: {
        translation: 'Hello, world.',
        alternative: null,
        keyExpressions: [],
        ambiguities: [],
        needsClarification: false,
        clarificationQuestion: null,
      },
    });

    expect(result).toMatchObject({
      status: 'completed',
      route: 'translation',
      structuredResult: {
        kind: 'translation',
        data: { translation: 'Hello, world.' },
      },
      execution: { attempt: 1, maxAttempts: 1 },
    });
  });

  it('represents a follow-up request without pretending the task succeeded', () => {
    const result = createRequiresInputAgentResult(
      'vocabulary',
      '请提供需要查询的英文单词或短语。',
      ['word'],
    );

    expect(result).toMatchObject({
      status: 'requires_input',
      question: '请提供需要查询的英文单词或短语。',
      fields: ['word'],
    });
  });

  it('records timeout failure and an exhausted retry decision', () => {
    const result = createFailedAgentResult(
      'translation',
      '暂时无法完成翻译，请稍后再试。',
      {
        code: 'TIMEOUT',
        message: '翻译服务超时',
        retryable: true,
      },
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'TIMEOUT', retryable: true },
      execution: { retry: { state: 'exhausted', retryable: true } },
    });
  });

  it('rejects impossible retry metadata', () => {
    expect(() =>
      agentResultSchema.parse({
        status: 'completed',
        route: 'learning_chat',
        content: 'ok',
        structuredResult: null,
        execution: {
          attempt: 2,
          maxAttempts: 1,
          retry: { state: 'retrying', retryable: true },
        },
      }),
    ).toThrow('attempt 不能超过 maxAttempts');
  });

  it('drops an oversized structured payload before database persistence', () => {
    const result = createCompletedAgentResult('translation', '短文本', {
      kind: 'translation',
      data: {
        translation: 'x'.repeat(70_000),
        alternative: null,
        keyExpressions: [],
        ambiguities: [],
        needsClarification: false,
        clarificationQuestion: null,
      },
    });

    expect(createAgentResultMetadata(result)).toMatchObject({
      agentResultVersion: 1,
      agentResultTruncated: true,
      agentResult: { structuredResult: null },
    });
  });
});
