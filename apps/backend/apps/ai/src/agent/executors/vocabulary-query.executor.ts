import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableLambda } from '@langchain/core/runnables';

import { createDeepSeek } from '../../llm/llm.config';
import { VOCABULARY_QUERY_EXECUTOR_PROMPT } from '../prompts/executors/vocabulary-query.prompt';

const vocabularyQuerySchema = z
  .object({
    word: z.string().trim().max(120),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (!value.needsClarification && !value.word) {
      context.addIssue({
        code: 'custom',
        path: ['word'],
        message: '无需澄清时必须提供待查询词条。',
      });
    }
    if (value.needsClarification && !value.clarificationQuestion?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationQuestion'],
        message: '需要澄清时必须提供问题。',
      });
    }
  });

export type VocabularyQuery = z.infer<typeof vocabularyQuerySchema>;

const vocabularyQueryPrompt = ChatPromptTemplate.fromMessages([
  ['system', VOCABULARY_QUERY_EXECUTOR_PROMPT],
  ['human', '{content}'],
]);

export async function extractVocabularyQuery(
  content: string,
  signal?: AbortSignal,
): Promise<VocabularyQuery> {
  const model = createDeepSeek({
    temperature: 0,
    maxTokens: 256,
    streaming: false,
  }).withStructuredOutput(vocabularyQuerySchema, { method: 'jsonMode' });

  const chain = RunnableLambda.from((value: string) => ({
    content: value.trim(),
  }))
    .pipe(vocabularyQueryPrompt)
    .pipe(model)
    .withConfig({
      runName: 'extract_vocabulary_query',
      tags: ['agent', 'langchain', 'vocabulary'],
    });

  return chain.invoke(content, { signal });
}
