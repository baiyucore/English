import { Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableLambda } from '@langchain/core/runnables';

import { createDeepSeek } from '../../llm/llm.config';
import {
  intentClassificationSchema,
  type IntentClassification,
} from '../contracts/intent.contract';

const logger = new Logger('IntentClassifier');

const ROUTER_PROMPT = `你是英语学习 Agent 的意图路由器，只负责分类，不要回答用户问题。

只能从以下四个 intent 中选择一个：
- translation：明确要求中文翻译成英文
- correction：要求英文纠错、润色、检查语法或表达
- vocabulary：询问英文单词、短语的含义、发音、搭配或例句
- learning_chat：英语学习、解释、练习、闲聊，以及无法确定的请求

规则：
1. 只根据用户当前输入判断，不要把中文提问本身当成英语水平证据。
2. 不确定、多个意图或无法分类时选择 learning_chat。
3. 只返回结构化 JSON，不要回答原问题。
4. 必须始终包含 intent、confidence、reason 三个字段；confidence 是 0 到 1 的数字。

返回格式示例：
{{"intent":"translation","confidence":0.95,"reason":"用户明确要求中译英"}}`;

const routerPrompt = ChatPromptTemplate.fromMessages([
  ['system', ROUTER_PROMPT],
  ['human', '{content}'],
]);

export async function classifyIntent(
  content: string,
  signal?: AbortSignal,
): Promise<IntentClassification> {
  try {
    const model = createDeepSeek({
      temperature: 0,
      maxTokens: 256,
      streaming: false,
    }).withStructuredOutput(intentClassificationSchema, {
      method: 'jsonMode',
    });
    const chain = RunnableLambda.from((value: string) => ({
      content: value.trim(),
    }))
      .pipe(routerPrompt)
      .pipe(model)
      .withConfig({
        runName: 'classify_agent_intent',
        tags: ['agent', 'langchain', 'intent_classifier'],
      });

    const result = await chain.invoke(content, { signal });
    return intentClassificationSchema.parse(result);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    logger.warn(
      `intent classification failed; fallback to learning_chat: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {
      intent: 'learning_chat',
      confidence: 0,
      reason: '分类服务不可用，已降级到英语学习回答',
    };
  }
}
