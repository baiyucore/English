import type { AgentIntent } from '../contracts/intent.contract';

/**
 * Tool Policy 是 Runtime 的安全边界，不是给模型看的 Prompt。
 * 模型即使生成了 tool_call，也必须通过这里的校验才会真正执行。
 */
export type ToolRisk = 'read' | 'write' | 'sensitive_write';

export type ToolPolicy = {
  name: string;
  risk: ToolRisk;
  allowedRoutes: readonly AgentIntent[];
  requiresAuthenticatedUser: boolean;
  requiresExplicitUserIntent: boolean;
  maxCallsPerRun: number;
};

export const learningToolPolicies: Record<
  'lookup_word' | 'save_vocabulary',
  ToolPolicy
> = {
  lookup_word: {
    name: 'lookup_word',
    risk: 'read',
    allowedRoutes: ['learning_chat', 'vocabulary'],
    requiresAuthenticatedUser: true,
    requiresExplicitUserIntent: false,
    maxCallsPerRun: 5,
  },
  save_vocabulary: {
    name: 'save_vocabulary',
    risk: 'write',
    allowedRoutes: ['learning_chat'],
    requiresAuthenticatedUser: true,
    requiresExplicitUserIntent: true,
    maxCallsPerRun: 1,
  },
};

export type ToolPolicyName = keyof typeof learningToolPolicies;

export type ToolPolicyState = {
  callsByTool: Map<string, number>;
};

export type ToolPolicyContext = {
  route: AgentIntent;
  authenticatedUserId: string | null;
  /** 原始用户输入，不采用模型对“用户意图”的二次描述。 */
  userMessage: string;
  state: ToolPolicyState;
};

export type ToolPolicyDecision =
  | { allowed: true; policy: ToolPolicy }
  | { allowed: false; message: string };

export function createToolPolicyState(): ToolPolicyState {
  return { callsByTool: new Map() };
}

/**
 * 校验并记录一次实际调用。调用次数只在通过校验后增加，避免被无效请求耗尽预算。
 */
export function authorizeToolInvocation(
  toolName: string,
  context: ToolPolicyContext,
): ToolPolicyDecision {
  const policy = learningToolPolicies[toolName as ToolPolicyName];
  if (!policy) {
    return { allowed: false, message: `工具 ${toolName} 不在当前运行时的允许列表中。` };
  }

  if (!policy.allowedRoutes.includes(context.route)) {
    return { allowed: false, message: `当前流程不允许调用工具 ${toolName}。` };
  }

  if (policy.requiresAuthenticatedUser && !context.authenticatedUserId?.trim()) {
    return { allowed: false, message: `调用工具 ${toolName} 需要已认证的用户身份。` };
  }

  if (
    policy.requiresExplicitUserIntent &&
    !hasExplicitVocabularySaveIntent(context.userMessage)
  ) {
    return { allowed: false, message: '保存单词需要用户在当前消息中明确提出请求。' };
  }

  const callCount = context.state.callsByTool.get(toolName) ?? 0;
  if (callCount >= policy.maxCallsPerRun) {
    return { allowed: false, message: `本次任务调用工具 ${toolName} 的次数已达到上限。` };
  }

  context.state.callsByTool.set(toolName, callCount + 1);
  return { allowed: true, policy };
}

function hasExplicitVocabularySaveIntent(message: string): boolean {
  const value = message.trim().toLowerCase();
  return /保存|收藏|加入(?:我的)?单词本|添加(?:到|进)(?:我的)?单词本/.test(value) ||
    /\b(save|bookmark)\b.*\b(word|vocabulary|phrase)\b/.test(value) ||
    /\badd\b.*\b(to|into)\b.*\b(wordbook|vocabulary)\b/.test(value);
}
