import { tool } from 'langchain';
import { z } from 'zod';

import { toJsonResult } from './utils';

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

async function fetchDictionaryEntries(word: string): Promise<DictionaryEntry[]> {
  const encoded = encodeURIComponent(word.toLowerCase());
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`,
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`词典查询失败（HTTP ${response.status}）`);
  }

  const data = (await response.json()) as DictionaryEntry[];
  return Array.isArray(data) ? data : [];
}

function summarizeEntry(entry: DictionaryEntry) {
  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((item) => item.text)?.text ||
    null;

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
  async ({ word }) => {
    const query = word.trim();
    if (!query) {
      return toJsonResult({
        ok: false,
        error: '请提供要查询的英文单词或短语',
      });
    }

    try {
      const entries = await fetchDictionaryEntries(query);
      if (entries.length === 0) {
        return toJsonResult({
          ok: false,
          word: query,
          error: '未找到该词条，请检查拼写，或改用更常见的原型形式',
        });
      }

      return toJsonResult({
        ok: true,
        word: query,
        entries: entries.slice(0, 2).map(summarizeEntry),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '词典服务暂时不可用';
      return toJsonResult({
        ok: false,
        word: query,
        error: message,
      });
    }
  },
  {
    name: 'lookup_word',
    description:
      '查询英文单词或短语的音标、词性、释义、例句和近义词。当用户询问单词含义、发音、用法或搭配时优先使用。',
    schema: z.object({
      word: z
        .string()
        .min(1)
        .describe('要查询的英文单词或短语，例如 interest 或 look forward to'),
    }),
  },
);
