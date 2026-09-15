import { END, START, StateGraph } from '@langchain/langgraph';

import { AgentGraphState } from './agent.state';
import { createClassifyIntentNode } from './classify-intent.node';
import type { IntentClassifier } from './classify-intent.node';
import type { AgentIntent } from '../contracts/intent.contract';

const ROUTE_NODES = {
  translation: 'route_translation',
  correction: 'route_correction',
  vocabulary: 'route_vocabulary',
  learning_chat: 'route_learning_chat',
} as const;

type RouteNode = (typeof ROUTE_NODES)[AgentIntent];
const MIN_ROUTE_CONFIDENCE = 0.7;

/**
 * 外层只负责“分类 -> 合法路由”，不让 LLM 直接决定整条执行链。
 * 具体 Agent/Tool 的执行仍由 AgentService 根据 route 选择。
 */
export function createAgentRouteGraph(classifier: IntentClassifier) {
  const graph = new StateGraph(AgentGraphState)
    .addNode('classify_intent', createClassifyIntentNode(classifier))
    .addNode('route_translation', () => ({ route: 'translation' as const }))
    .addNode('route_correction', () => ({ route: 'correction' as const }))
    .addNode('route_vocabulary', () => ({ route: 'vocabulary' as const }))
    .addNode('route_learning_chat', () => ({ route: 'learning_chat' as const }))
    .addEdge(START, 'classify_intent')
    .addConditionalEdges(
      'classify_intent',
      (state) => {
        const intent = state.intent ?? 'learning_chat';
        return state.confidence !== null &&
          state.confidence >= MIN_ROUTE_CONFIDENCE
          ? intent
          : 'learning_chat';
      },
      ROUTE_NODES,
    )
    .addEdge('route_translation', END)
    .addEdge('route_correction', END)
    .addEdge('route_vocabulary', END)
    .addEdge('route_learning_chat', END)
    .compile();

  return graph;
}

export type AgentRouteGraph = ReturnType<typeof createAgentRouteGraph>;

export function routeNodeToIntent(node: RouteNode): AgentIntent {
  const entry = Object.entries(ROUTE_NODES).find(([, value]) => value === node);
  return (entry?.[0] as AgentIntent | undefined) ?? 'learning_chat';
}
