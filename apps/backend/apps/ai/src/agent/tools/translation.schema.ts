import { z } from 'zod';

export const TRANSLATION_TONES = [
  'casual',
  'neutral',
  'formal',
  'business',
] as const;

export const TRANSLATION_DOMAINS = [
  'daily',
  'business',
  'tech',
  'general',
] as const;

export type TranslationTone = (typeof TRANSLATION_TONES)[number];
export type TranslationDomain = (typeof TRANSLATION_DOMAINS)[number];

export type TranslationInput = {
  text: string;
  tone?: TranslationTone;
  domain?: TranslationDomain;
};

export const translationInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(8_000)
    .describe('需要翻译成英文的中文原文，最多 8000 个字符'),
  tone: z.enum(TRANSLATION_TONES).optional().describe('可选语气'),
  domain: z.enum(TRANSLATION_DOMAINS).optional().describe('可选领域'),
}) satisfies z.ZodType<TranslationInput>;

export const translationExpressionSchema = z.object({
  zh: z.string().describe('原文中的关键表达'),
  en: z.string().describe('对应英文表达'),
  note: z.string().optional().describe('简短中文用法说明'),
});

/**
 * JSON mode 只能保证返回合法 JSON，不能像 function calling 一样强制模型
 * 严格遵循嵌套 Schema。因此兼容模型常见的字符串表达式和缺失空数组。
 */
const translationExpressionModelSchema = z.union([
  translationExpressionSchema,
  z.string().describe('模型无法展开时返回的英文关键表达'),
]);

export const translationResultSchema = z
  .object({
    translation: z
      .string()
      .describe('中文对应的自然英文译文；若需追问可为空字符串'),
    alternative: z
      .string()
      .nullable()
      .describe('可选备选译文；无合适备选时为 null'),
    keyExpressions: z
      .array(translationExpressionModelSchema)
      .default([])
      .describe('值得学习的关键表达；可以是对象数组，短句可为空数组'),
    ambiguities: z
      .array(z.string())
      .default([])
      .describe('发现的歧义或不确定点（中文说明）；无疑义可为空数组'),
    needsClarification: z
      .boolean()
      .describe('原文是否因歧义或不完整而需要先追问'),
    clarificationQuestion: z
      .string()
      .nullable()
      .describe('需要追问时的中文问题；不需要追问时为 null'),
  })
  .superRefine((value, context) => {
    if (value.needsClarification && !value.clarificationQuestion?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationQuestion'],
        message: '需要追问时必须提供 clarificationQuestion。',
      });
    }

    if (!value.needsClarification && value.clarificationQuestion !== null) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationQuestion'],
        message: '不需要追问时 clarificationQuestion 必须为 null。',
      });
    }

    if (!value.needsClarification && !value.translation.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['translation'],
        message: '不需要追问时必须提供 translation。',
      });
    }
  });

export type TranslationModelResult = z.infer<typeof translationResultSchema>;

export type TranslationResult = Omit<
  TranslationModelResult,
  'keyExpressions'
> & {
  keyExpressions: Array<z.infer<typeof translationExpressionSchema>>;
};

export function normalizeTranslationResult(
  result: TranslationModelResult,
): TranslationResult {
  return {
    ...result,
    keyExpressions: result.keyExpressions.map((item) =>
      typeof item === 'string' ? { zh: '', en: item } : item,
    ),
  };
}
