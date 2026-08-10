import { Logger } from '@nestjs/common';
import { tool } from 'langchain';
import type { ToolRunnableConfig } from '@langchain/core/tools';

import { createDeepSeek } from '../../llm/llm.config';
import { skillRegistry, TRANSLATION_SKILL_ID } from '../skills';
import {
  normalizeTranslationResult,
  translationInputSchema,
  translationResultSchema,
  type TranslationModelResult,
} from './translation.schema';
import {
  describeToolError,
  errorToToolFailure,
  toolFailure,
  toJsonResult,
} from './utils';

const logger = new Logger('TranslateZhToEnTool');

export const translateZhToEnTool = tool(
  async ({ text, tone, domain }, config?: ToolRunnableConfig) => {
    const content = text.trim();
    const startedAt = Date.now();
    if (!content) {
      return toJsonResult(
        toolFailure('VALIDATION_ERROR', '请提供需要翻译的中文内容', {
          retryable: false,
          field: 'text',
        }),
      );
    }

    try {
      logger.log(
        `translation started ${JSON.stringify({
          inputLength: content.length,
          hasTone: Boolean(tone?.trim()),
          hasDomain: Boolean(domain?.trim()),
          hasAbortSignal: Boolean(config?.signal),
        })}`,
      );

      const skill = skillRegistry.load(TRANSLATION_SKILL_ID);
      const structuredModel = createDeepSeek({
        temperature: 0.2,
        maxTokens: 2048,
        streaming: false,
      }).withStructuredOutput(translationResultSchema, {
        // Thinking mode 不支持 tool_choice；使用 JSON mode 返回结构化结果。
        method: 'jsonMode',
      });

      const hints = [
        tone?.trim() ? `语气偏好：${tone.trim()}` : '',
        domain?.trim() ? `领域：${domain.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const rawResult = (await structuredModel.invoke(
        [
          {
            role: 'system',
            content: `${skill.instructions}\n只返回 JSON 对象，不要输出 Markdown、解释文字或代码块。`,
          },
          {
            role: 'user',
            content: `请把下面中文翻译成英文：\n${content}${hints ? `\n\n${hints}` : ''}`,
          },
        ],
        // 模型请求不设置 Tool 级总时长；由 SDK 默认超时和用户 Abort 控制。
        { signal: config?.signal },
      )) as TranslationModelResult;
      const result = normalizeTranslationResult(rawResult);

      logger.log(
        `translation succeeded ${JSON.stringify({
          elapsedMs: Date.now() - startedAt,
          inputLength: content.length,
        })}`,
      );

      return toJsonResult({
        ok: true,
        skillId: TRANSLATION_SKILL_ID,
        skillVersion: skill.version,
        original: content,
        result,
      });
    } catch (error) {
      logger.error(
        `translation failed ${JSON.stringify({
          elapsedMs: Date.now() - startedAt,
          inputLength: content.length,
          error: describeToolError(error),
        })}`,
      );
      return toJsonResult(errorToToolFailure(error, '中英翻译服务暂时不可用'));
    }
  },
  {
    name: 'translate_zh_to_en',
    description:
      '将用户提供的中文句子或段落翻译成自然英文，并返回主译文、可选备选、关键表达和歧义信息。当用户明确要求中译英或翻译成英文时使用；不要用于英文纠错或单词释义。服务端会自动加载 translation Skill。',
    schema: translationInputSchema,
  },
);
