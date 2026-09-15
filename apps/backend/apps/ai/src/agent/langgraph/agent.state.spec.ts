import { AgentGraphState } from './agent.state';

describe('agent graph state schema', () => {
  it('accepts defined route values and rejects invalid route updates', async () => {
    await expect(
      AgentGraphState.validateInput({
        content: '请翻译这句话',
        route: 'translation',
        confidence: 0.95,
      }),
    ).resolves.toMatchObject({
      route: 'translation',
      confidence: 0.95,
    });

    await expect(
      AgentGraphState.validateInput({ route: 'unsupported_route' }),
    ).rejects.toThrow('Validation failed for field "route"');
  });

  it('rejects confidence values outside the route contract', async () => {
    await expect(
      AgentGraphState.validateInput({ confidence: 1.1 }),
    ).rejects.toThrow('Validation failed for field "confidence"');
  });

  it('keeps RAG state as references and validates its processing contract', async () => {
    await expect(
      AgentGraphState.validateInput({
        retrievalStatus: 'completed',
        retrievalQuery: '总结附件中的条件句用法',
        retrievedChunkIds: ['chunk-1'],
        citations: [
          {
            documentId: 'attachment-1',
            chunkId: 'chunk-1',
            title: '语法笔记',
            locator: '第 2 页',
          },
        ],
      }),
    ).resolves.toMatchObject({
      retrievalStatus: 'completed',
      retrievedChunkIds: ['chunk-1'],
      citations: [{ documentId: 'attachment-1', chunkId: 'chunk-1' }],
    });

    await expect(
      AgentGraphState.validateInput({ retrievalStatus: 'unknown' }),
    ).rejects.toThrow('Validation failed for field "retrievalStatus"');
  });

  it('accepts only explicit long-term-memory workflow states', async () => {
    await expect(
      AgentGraphState.validateInput({
        relevantMemoryIds: ['memory-1'],
        memoryCandidateIds: ['candidate-1'],
        memoryStatus: 'pending',
      }),
    ).resolves.toMatchObject({
      relevantMemoryIds: ['memory-1'],
      memoryCandidateIds: ['candidate-1'],
      memoryStatus: 'pending',
    });

    await expect(
      AgentGraphState.validateInput({ memoryStatus: 'saved' }),
    ).rejects.toThrow('Validation failed for field "memoryStatus"');
  });
});
