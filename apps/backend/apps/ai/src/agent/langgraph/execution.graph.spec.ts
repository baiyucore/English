import type { AgentStreamEmit } from '../stream/agent-stream-event';
import { HumanMessage } from '@langchain/core/messages';
import { createCompletedAgentResult } from '../contracts/agent-result.contract';
import {
  createAgentExecutionGraph,
  type AgentExecutionDependencies,
  type AgentGraphRuntime,
} from './execution.graph';

function createRuntime(): AgentGraphRuntime {
  const emit: AgentStreamEmit = jest.fn();
  return {
    runId: 'run-1',
    emit,
    markFirstToken: jest.fn(),
    metrics: {
      startedAt: Date.now(),
      firstTokenAt: null,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      provider: 'test',
      model: 'test-model',
      scene: '测试',
    },
    metricsRecorded: false,
  };
}

describe('agent execution graph', () => {
  it('executes, persists, and records a specialized route', async () => {
    const runtime = createRuntime();
    const persisted: string[] = [];
    const recorded: string[] = [];
    const deps: AgentExecutionDependencies = {
      classifier: async () => ({
        intent: 'translation',
        confidence: 0.99,
        reason: 'test',
      }),
      executeSpecialized: async (route) =>
        createCompletedAgentResult(route, `${route} answer`, null),
      executeLearningChat: async () =>
        createCompletedAgentResult('learning_chat', 'learning answer', {
          kind: 'learning_chat',
          data: null,
        }),
      persistAssistantMessage: async (state) => {
        persisted.push(state.responseContent ?? '');
      },
      recordMetrics: async (state) => {
        recorded.push(state.route ?? '');
      },
    };

    const graph = createAgentExecutionGraph(deps);
    const result = await graph.invoke(
      {
        messages: [new HumanMessage('请翻译这句话')],
        content: '请翻译这句话',
        conversationId: 'conversation-1',
        userId: 'user-1',
      },
      { configurable: { agentRuntime: runtime } },
    );

    expect(result).toMatchObject({
      intent: 'translation',
      route: 'translation',
      responseContent: 'translation answer',
      toolFailed: false,
      agentResult: {
        status: 'completed',
        route: 'translation',
        content: 'translation answer',
      },
    });
    expect(persisted).toEqual(['translation answer']);
    expect(recorded).toEqual(['translation']);
    expect(runtime.metricsRecorded).toBe(true);
    expect(result.messages.map((message) => message.getType())).toEqual([
      'human',
      'ai',
    ]);
    expect(result.messages.at(-1)?.content).toBe('translation answer');
  });

  it('falls back to learning_chat and still runs the common tail', async () => {
    const runtime = createRuntime();
    const executed: string[] = [];
    const deps: AgentExecutionDependencies = {
      classifier: async () => ({
        intent: 'translation',
        confidence: 0.2,
        reason: 'ambiguous',
      }),
      executeSpecialized: async () => {
        executed.push('specialized');
        return createCompletedAgentResult('translation', 'wrong branch', null);
      },
      executeLearningChat: async () => {
        executed.push('learning_chat');
        return createCompletedAgentResult('learning_chat', 'learning answer', {
          kind: 'learning_chat',
          data: null,
        });
      },
      persistAssistantMessage: async () => undefined,
      recordMetrics: async () => undefined,
    };

    const graph = createAgentExecutionGraph(deps);
    const result = await graph.invoke(
      { content: '不确定的问题' },
      { configurable: { agentRuntime: runtime } },
    );

    expect(result.route).toBe('learning_chat');
    expect(result.responseContent).toBe('learning answer');
    expect(executed).toEqual(['learning_chat']);
  });

  it('stops before execution and persistence when the run is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const runtime = createRuntime();
    runtime.signal = controller.signal;
    const execute = jest.fn();
    const persist = jest.fn();
    const graph = createAgentExecutionGraph({
      classifier: async () => ({
        intent: 'translation',
        confidence: 0.99,
        reason: 'test',
      }),
      executeSpecialized: execute,
      executeLearningChat: execute,
      persistAssistantMessage: persist,
      recordMetrics: jest.fn(),
    });

    await expect(
      graph.invoke(
        { content: '取消的请求' },
        { configurable: { agentRuntime: runtime } },
      ),
    ).rejects.toThrow('Agent execution cancelled');
    expect(execute).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
