import { createAgentRouteGraph } from './agent.graph';
import type { AgentIntent } from '../contracts/intent.contract';

describe('agent route graph', () => {
  const run = async (intent: AgentIntent) => {
    const graph = createAgentRouteGraph(async () => ({
      intent,
      confidence: 0.95,
      reason: 'test',
    }));

    return graph.invoke({ content: 'test input' });
  };

  it.each([
    ['translation', 'translation'],
    ['correction', 'correction'],
    ['vocabulary', 'vocabulary'],
    ['learning_chat', 'learning_chat'],
  ] as const)('routes %s to the matching branch', async (intent, route) => {
    await expect(run(intent)).resolves.toMatchObject({ intent, route });
  });

  it('falls back to learning_chat when the classifier returns no intent', async () => {
    const graph = createAgentRouteGraph(async () => ({
      intent: 'learning_chat',
      confidence: 0,
      reason: 'fallback',
    }));

    await expect(
      graph.invoke({ content: '不确定的问题' }),
    ).resolves.toMatchObject({
      route: 'learning_chat',
    });
  });

  it('falls back to learning_chat when confidence is below the route guard', async () => {
    const graph = createAgentRouteGraph(async () => ({
      intent: 'translation',
      confidence: 0.4,
      reason: 'ambiguous',
    }));

    await expect(
      graph.invoke({ content: '可能是翻译，也可能是解释' }),
    ).resolves.toMatchObject({
      intent: 'translation',
      route: 'learning_chat',
    });
  });
});
