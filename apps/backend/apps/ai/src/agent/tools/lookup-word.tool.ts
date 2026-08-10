/**
 * 查询英文单词或短语的音标、词性、释义、例句和近义词。
 * 当用户询问单词含义、发音、用法或搭配时优先使用。
 */

import { tool } from 'langchain';
import type { ToolRunnableConfig } from '@langchain/core/tools';
import { z } from 'zod';

import {
  errorToToolFailure,
  toolFailure,
  toJsonResult,
  withToolTimeout,
} from './utils';
import { skillRegistry, VOCABULARY_SKILL_ID } from '../skills';

type DictionaryMeaning = {
  partOfSpeech?: string;
  definitions?: Array<{
    definition?: string;
    example?: string;
    synonyms?: string[];
  }>;
  synonyms?: string[];
};

type DictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: DictionaryMeaning[];
};

async function fetchDictionaryEntries(
  word: string,
  signal: AbortSignal,
): Promise<DictionaryEntry[]> {
  const encoded = encodeURIComponent(word.toLowerCase());
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`,
    { signal },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`dictionary request failed with status ${response.status}`);
  }

  const body = await response.text();
  if (body.length > 256_000) {
    throw new Error('dictionary response exceeded the size limit');
  }
  const data = JSON.parse(body) as DictionaryEntry[];
  return Array.isArray(data) ? data : [];
}

function summarizeEntry(entry: DictionaryEntry) {
  const phonetic =
    entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || null;

  const meanings = (entry.meanings ?? []).slice(0, 4).map((meaning) => ({
    partOfSpeech: meaning.partOfSpeech ?? null,
    definitions: (meaning.definitions ?? []).slice(0, 3).map((item) => ({
      definition: item.definition ?? '',
      example: item.example ?? null,
      synonyms: (item.synonyms ?? []).slice(0, 5),
    })),
    synonyms: (meaning.synonyms ?? []).slice(0, 8),
  }));

  return {
    word: entry.word ?? null,
    phonetic,
    meanings,
  };
}

export const lookupWordTool = tool(
  async ({ word }, config?: ToolRunnableConfig) => {
    const query = word.trim();
    if (!query) {
      return toJsonResult(
        toolFailure('VALIDATION_ERROR', '请提供要查询的英文单词或短语', {
          retryable: false,
          field: 'word',
        }),
      );
    }

    try {
      const skill = skillRegistry.load(VOCABULARY_SKILL_ID);
      const entries = await withToolTimeout(
        (signal) => fetchDictionaryEntries(query, signal),
        30_000,
        config?.signal,
      );
      if (entries.length === 0) {
        return toJsonResult(
          toolFailure('NOT_FOUND', '未找到该词条，请检查拼写或改用原型形式', {
            retryable: false,
          }),
        );
      }

      return toJsonResult({
        ok: true,
        skillId: VOCABULARY_SKILL_ID,
        skillVersion: skill.version,
        word: query,
        entries: entries.slice(0, 2).map(summarizeEntry),
      });
    } catch (error) {
      return toJsonResult(errorToToolFailure(error, '词典服务暂时不可用'));
    }
  },
  {
    name: 'lookup_word',
    description:
      '查询英文单词或短语的音标、词性、释义、例句和近义词。当用户询问单词含义、发音、用法或搭配时使用；查无结果时返回 NOT_FOUND，不要猜测词义。服务端会自动加载 vocabulary Skill。',
    schema: z.object({
      word: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .describe('要查询的英文单词或短语，例如 interest 或 look forward to'),
    }),
  },
);
