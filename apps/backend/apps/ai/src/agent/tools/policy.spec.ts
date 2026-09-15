import {
  authorizeToolInvocation,
  createToolPolicyState,
} from './policy';

describe('learning tool policy', () => {
  const baseContext = () => ({
    route: 'learning_chat' as const,
    authenticatedUserId: 'user-1',
    userMessage: 'What does meticulous mean?',
    state: createToolPolicyState(),
  });

  it('allows an authenticated user to look up a word', () => {
    expect(authorizeToolInvocation('lookup_word', baseContext())).toMatchObject({
      allowed: true,
      policy: { risk: 'read' },
    });
  });

  it('does not let the model save vocabulary without explicit user intent', () => {
    expect(
      authorizeToolInvocation('save_vocabulary', baseContext()),
    ).toMatchObject({ allowed: false });
  });

  it('allows one explicit vocabulary save per run', () => {
    const context = {
      ...baseContext(),
      userMessage: 'Please add meticulous to my wordbook.',
    };
    expect(authorizeToolInvocation('save_vocabulary', context)).toMatchObject({
      allowed: true,
      policy: { risk: 'write' },
    });
    expect(authorizeToolInvocation('save_vocabulary', context)).toMatchObject({
      allowed: false,
    });
  });
});
