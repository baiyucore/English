import { tool } from 'langchain';
import { z } from 'zod';

import { createDeepSeek } from '../../llm/llm.config';
import { correctionResultSchema } from './output-schemas';
import { toJsonResult } from './utils';

const CORRECT_PROMPT = `你是英语纠错助手。请分析用户英文，保留原意，只标关键问题。
若几乎正确，isCorrect 设为 true，errors 可为空数组。`;

export const correctEnglishTool = tool(
  async ({ text, focus }) => {
    const content = text.trim();
    if (!content) {
      return toJsonResult({
        ok: false,
        error: '请提供需要纠错的英文内容',
      });
    }

    try {
      const structuredModel = createDeepSeek({
        temperature: 0.2,
        maxTokens: 2048,
        streaming: false,
      }).withStructuredOutput(correctionResultSchema);

      const focusHint = focus?.trim()
        ? `\n纠错重点：${focus.trim()}`
        : '';
      const result = await structuredModel.invoke([
        { role: 'system', content: CORRECT_PROMPT },
        {
          role: 'user',
          content: `请纠错下面这段英文：\n${content}${focusHint}`,
        },
      ]);

      return toJsonResult({
        ok: true,
        original: content,
        result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '英文纠错失败';
      return toJsonResult({
        ok: false,
        original: content,
        error: message,
      });
    }
  },
  {
    name: 'correct_english',
    description:
      '纠正并润色用户的英文句子或段落，返回改写结果、错误类型和中文解释。当用户要求改错、润色、检查语法或表达是否地道时使用。',
    schema: z.object({
      text: z.string().min(1).describe('需要纠错或润色的英文原文'),
      focus: z
        .string()
        .optional()
        .describe('可选纠错重点，例如 grammar、vocabulary、naturalness'),
    }),
  },
);
