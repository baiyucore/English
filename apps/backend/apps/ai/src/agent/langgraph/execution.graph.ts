import type { AgentStreamEmit } from '../stream/agent-stream-event';
import { AIMessage } from '@langchain/core/messages';
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';

import { AgentGraphState } from './agent.state';
import { createClassifyIntentNode } from './classify-intent.node';
import type { IntentClassifier } from './classify-intent.node';
import type { AgentGraphStateValue } from './agent.state';
import {
  withAgentResultDuration,
  type AgentResult,
} from '../contracts/agent-result.contract';
import type { AgentIntent } from '../contracts/intent.contract';

export type AgentGraphRuntime = {
  runId: string;
  signal?: AbortSignal;
  emit: AgentStreamEmit;
  markFirstToken: () => void;
  metrics: {
    startedAt: number;
    firstTokenAt: number | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    provider: string;
    model: string;
    scene: string;
  };
  metricsRecorded: boolean;
};

export type SpecializedRoute = Exclude<AgentIntent, 'learning_chat'>;

export type AgentExecutionResult = AgentResult;

export type AgentExecutionDependencies = {
  /** 顶层 Graph 的唯一短期状态恢复边界。 */
  checkpointer?: BaseCheckpointSaver;
  classifier: IntentClassifier;
  executeSpecialized: (
    route: SpecializedRoute,
    state: AgentGraphStateValue,
    runtime: AgentGraphRuntime,
  ) => Promise<AgentExecutionResult>;
  executeLearningChat: (
    state: AgentGraphStateValue,
    runtime: AgentGraphRuntime,
  ) => Promise<AgentExecutionResult>;
  persistAssistantMessage: (
    state: AgentGraphStateValue,
    runtime: AgentGraphRuntime,
  ) => Promise<void>;
  recordMetrics: (
    state: AgentGraphStateValue,
    runtime: AgentGraphRuntime,
  ) => Promise<void>;
};

const ROUTE_NODES = {
  translation: 'route_translation',
  correction: 'route_correction',
  vocabulary: 'route_vocabulary',
  learning_chat: 'route_learning_chat',
} as const;

const MIN_ROUTE_CONFIDENCE = 0.7;

/**
 * Project A 期间，词汇查询必须进入学习聊天的 Tool Calling 链路。
 * vocabulary 专项链会先由另一轮模型抽取参数，绕过“模型决定 → 程序执行”的学习目标。
 */
function selectExecutionRoute(state: AgentGraphStateValue): AgentIntent {
  const classifiedRoute =
    state.confidence !== null && state.confidence >= MIN_ROUTE_CONFIDENCE
      ? (state.intent ?? 'learning_chat')
      : 'learning_chat';

  return classifiedRoute === 'vocabulary' ? 'learning_chat' : classifiedRoute;
}

type GraphConfig = {
  configurable?: {
    agentRuntime?: AgentGraphRuntime;
  };
};

function getRuntime(config: GraphConfig): AgentGraphRuntime {
  const runtime = config.configurable?.agentRuntime;
  if (!runtime) {
    throw new Error('Agent graph runtime is missing');
  }
  return runtime;
}

function assertExecutionActive(runtime: AgentGraphRuntime) {
  if (runtime.signal?.aborted) {
    throw new Error('Agent execution cancelled');
  }
}

function createRouteNode(route: AgentIntent) {
  return async (_state: AgentGraphStateValue, config: GraphConfig) => {
    const runtime = getRuntime(config);
    assertExecutionActive(runtime);
    await runtime.emit({
      type: 'route_selected',
      role: 'ai',
      runId: runtime.runId,
      route,
      skillId: route === 'learning_chat' ? null : route,
    });
    return { route };
  };
}

function createSpecializedExecutionNode(
  route: SpecializedRoute,
  deps: AgentExecutionDependencies,
) {
  return async (state: AgentGraphStateValue, config: GraphConfig) => {
    const runtime = getRuntime(config);
    assertExecutionActive(runtime);
    const result = await deps.executeSpecialized(route, state, runtime);
    assertExecutionActive(runtime);
    const agentResult = withAgentResultDuration(
      result,
      Date.now() - runtime.metrics.startedAt,
    );
    if (agentResult.content) {
      runtime.markFirstToken();
    }
    return {
      responseContent: agentResult.content,
      agentResult,
      toolFailed: agentResult.status === 'failed',
    };
  };
}

function createLearningChatExecutionNode(deps: AgentExecutionDependencies) {
  return async (state: AgentGraphStateValue, config: GraphConfig) => {
    const runtime = getRuntime(config);
    assertExecutionActive(runtime);
    const result = await deps.executeLearningChat(state, runtime);
    assertExecutionActive(runtime);
    const agentResult = withAgentResultDuration(
      result,
      Date.now() - runtime.metrics.startedAt,
    );
    return {
      responseContent: agentResult.content,
      agentResult,
      toolFailed: agentResult.status === 'failed',
    };
  };
}

/**
 * 完整执行 Graph：分类、路由、执行、整理、持久化、指标记录。
 * LLM 只在 classify 或 execute 节点内部工作，不能直接跳过代码节点。
 */
export function createAgentExecutionGraph(deps: AgentExecutionDependencies) {
  const graph = new StateGraph(AgentGraphState)
    .addNode('classify_intent', createClassifyIntentNode(deps.classifier))
    .addNode('route_translation', createRouteNode('translation'))
    .addNode('route_correction', createRouteNode('correction'))
    .addNode('route_vocabulary', createRouteNode('vocabulary'))
    .addNode('route_learning_chat', createRouteNode('learning_chat'))
    .addNode(
      'execute_translation',
      createSpecializedExecutionNode('translation', deps),
    )
    .addNode(
      'execute_correction',
      createSpecializedExecutionNode('correction', deps),
    )
    .addNode(
      'execute_vocabulary',
      createSpecializedExecutionNode('vocabulary', deps),
    )
    .addNode('execute_learning_chat', createLearningChatExecutionNode(deps))
    .addNode('compose_answer', (state: AgentGraphStateValue) => {
      const content =
        state.responseContent?.trim() || '暂时无法生成回答，请稍后再试。';
      return {
        responseContent: content,
        // 执行节点始终生成 AgentResult；保留该兜底使 State 在异常恢复时仍可展示文本。
        ...(state.agentResult ? {} : { agentResult: null }),
      };
    })
    .addNode('append_assistant_message', async (state, config) => {
      const runtime = getRuntime(config);
      assertExecutionActive(runtime);
      return {
        messages: [new AIMessage(state.responseContent ?? '')],
      };
    })
    .addNode('persist_assistant_message', async (state, config) => {
      const runtime = getRuntime(config);
      assertExecutionActive(runtime);
      await deps.persistAssistantMessage(state, runtime);
      return {};
    })
    .addNode('record_metrics', async (state, config) => {
      const runtime = getRuntime(config);
      await deps.recordMetrics(state, runtime);
      runtime.metricsRecorded = true;
      return {};
    })
    .addEdge(START, 'classify_intent')
    .addConditionalEdges(
      'classify_intent',
      selectExecutionRoute,
      ROUTE_NODES,
    )
    .addEdge('route_translation', 'execute_translation')
    .addEdge('route_correction', 'execute_correction')
    .addEdge('route_vocabulary', 'execute_vocabulary')
    .addEdge('route_learning_chat', 'execute_learning_chat')
    .addEdge('execute_translation', 'compose_answer')
    .addEdge('execute_correction', 'compose_answer')
    .addEdge('execute_vocabulary', 'compose_answer')
    .addEdge('execute_learning_chat', 'compose_answer')
    .addEdge('compose_answer', 'append_assistant_message')
    .addEdge('append_assistant_message', 'persist_assistant_message')
    .addEdge('persist_assistant_message', 'record_metrics')
    .addEdge('record_metrics', END)
    .compile({ checkpointer: deps.checkpointer });

  return graph;
}

export type AgentExecutionGraph = ReturnType<typeof createAgentExecutionGraph>;
