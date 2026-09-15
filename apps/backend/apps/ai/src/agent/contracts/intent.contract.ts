import { z } from 'zod';

export const AGENT_INTENTS = [
  'translation',
  'correction',
  'vocabulary',
  'learning_chat',
] as const;

export type AgentIntent = (typeof AGENT_INTENTS)[number];

export const intentClassificationSchema = z.object({
  intent: z.enum(AGENT_INTENTS),
  // DeepSeek 的 JSON mode 只保证 JSON，不保证每个字段都会出现。
  // 路由器遗漏置信度时使用保守的默认值，避免合法 intent 被错误降级。
  confidence: z.number().min(0).max(1).default(0.8),
  reason: z.string().trim().max(200).optional(),
});

export type IntentClassification = z.infer<typeof intentClassificationSchema>;
