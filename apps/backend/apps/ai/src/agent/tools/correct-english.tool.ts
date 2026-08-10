import { tool } from 'langchain';
import type { ToolRunnableConfig } from '@langchain/core/tools';

import { createDeepSeek } from '../../llm/llm.config';
import { CORRECTION_SKILL_ID, skillRegistry } from '../skills';
import {
  correctionInputSchema,
  correctionResultSchema,
} from './correction.schema';
import { errorToToolFailure, toolFailure, toJsonResult } from './utils';

export const correctEnglishTool = tool(
  async ({ text, focus }, config?: ToolRunnableConfig) => {
    const content = text.trim();
    if (!content) {
      return toJsonResult(
        toolFailure('VALIDATION_ERROR', '请提供需要纠错的英文内容', {
          retryable: false,
          field: 'text',
        }),
      );
    }

    try {
      const skill = skillRegistry.load(CORRECTION_SKILL_ID);
      const structuredModel = createDeepSeek({
        temperature: 0.2,
        maxTokens: 2048,
        streaming: false,
      }).withStructuredOutput(correctionResultSchema, {
        // Thinking mode 不支持 tool_choice；使用 JSON mode 返回结构化结果。
        method: 'jsonMode',
      });

      const focusHint = focus?.trim() ? `\n纠错重点：${focus.trim()}` : '';
      const result = await structuredModel.invoke(
        [
          {
            role: 'system',
            content: `${skill.instructions}\n只返回 JSON 对象，不要输出 Markdown、解释文字或代码块。`,
          },
          {
            role: 'user',
            content: `请纠错下面这段英文：\n${content}${focusHint}`,
          },
        ],
        // 模型请求不设置 Tool 级总时长；由 SDK 默认超时和用户 Abort 控制。
        { signal: config?.signal },
      );

      return toJsonResult({
        ok: true,
        skillId: CORRECTION_SKILL_ID,
        skillVersion: skill.version,
        original: content,
        result,
      });
    } catch (error) {
      return toJsonResult(errorToToolFailure(error, '英文纠错服务暂时不可用'));
    }
  },
  {
    name: 'correct_english',
    description:
      '纠正并润色用户提供的英文句子或段落，返回自然改写、错误类型和中文解释。当用户要求改错、润色或检查语法时使用；不要用于中译英或查词。服务端会自动加载 correction Skill。',
    schema: correctionInputSchema,
  },
);
