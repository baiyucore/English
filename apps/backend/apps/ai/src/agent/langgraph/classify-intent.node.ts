import type { AgentGraphStateValue } from './agent.state';
import type {
  IntentClassification,
  AgentIntent,
} from '../contracts/intent.contract';

export type IntentClassifier = (
  content: string,
  signal?: AbortSignal,
) => Promise<IntentClassification>;

export function createClassifyIntentNode(classifier: IntentClassifier) {
  return async (
    state: AgentGraphStateValue,
    config?: { signal?: AbortSignal },
  ) => {
    const result = await classifier(state.content, config?.signal);

    return {
      intent: result.intent as AgentIntent,
      confidence: result.confidence,
      routeReason: result.reason ?? null,
    };
  };
}
