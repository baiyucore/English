import { z } from 'zod';

export const correctionErrorSchema = z.object({
  original: z.string().describe('原文中有问题的片段'),
  suggestion: z.string().describe('建议替换的表达'),
  type: z
    .enum(['grammar', 'vocabulary', 'style', 'spelling'])
    .describe('错误类型'),
  explanation: z.string().describe('简短中文解释'),
});

export const correctionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(8_000)
    .describe('需要纠错或润色的英文原文，最多 8000 个字符'),
  focus: z
    .string()
    .max(120)
    .optional()
    .describe('可选纠错重点，例如 grammar、vocabulary、naturalness'),
});

export const correctionResultSchema = z.object({
  corrected: z.string().describe('改写后的自然英文'),
  isCorrect: z.boolean().describe('原文是否基本正确'),
  errors: z
    .array(correctionErrorSchema)
    .describe('发现的问题列表；若几乎正确可为空数组'),
  summary: z.string().describe('一句话中文总结'),
});

export type CorrectionInput = z.infer<typeof correctionInputSchema>;
export type CorrectionResult = z.infer<typeof correctionResultSchema>;
