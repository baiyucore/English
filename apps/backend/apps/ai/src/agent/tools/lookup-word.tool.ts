/**
 * 查询本地 WordBook 中的英文单词或短语。
 * 不依赖外部词典服务，因此 Tool 的可用性只取决于本地数据库是否已有词条。
 */

import { tool } from 'langchain';
import { z } from 'zod';

import type { PrismaService } from '@libs/shared';

import {
  errorToToolFailure,
  toolCompleted,
  toolFailed,
  toolRequiresInput,
  toJsonResult,
} from './utils';
import { skillRegistry, VOCABULARY_SKILL_ID } from '../skills';

type LocalWordBookEntry = {
  word: string;
  phonetic: string | null;
  definition: string | null;
  translation: string | null;
  pos: string | null;
  exchange: string | null;
};

const localWordBookSelect = {
  word: true,
  phonetic: true,
  definition: true,
  translation: true,
  pos: true,
  exchange: true,
} as const;

function summarizeEntry(entry: LocalWordBookEntry) {
  return {
    word: entry.word,
    phonetic: entry.phonetic,
    translation: entry.translation,
    meanings: [
      {
        partOfSpeech: entry.pos,
        definitions: [
          {
            definition: entry.definition ?? entry.translation ?? '',
            example: null,
            synonyms: entry.exchange ? [entry.exchange] : [],
          },
        ],
        synonyms: entry.exchange ? [entry.exchange] : [],
      },
    ],
  };
}

/** 本地词典依赖数据库连接，因此由应用在运行时注入 Prisma。 */
export function createLookupWordTool(prisma: PrismaService) {
  return tool(
    async ({ word }) => {
      const query = word.trim();
      if (!query) {
        return toJsonResult(
          toolFailed(
            'lookup_word',
            'VALIDATION_ERROR',
            '请提供要查询的英文单词或短语',
            { retryable: false, field: 'word' },
          ),
        );
      }

      try {
        const skill = skillRegistry.load(VOCABULARY_SKILL_ID);
        // 先精确匹配，避免 "art" 意外返回 "partial"；无精确结果时再给相近词条。
        const exactMatch = await prisma.wordBook.findFirst({
          where: { word: { equals: query, mode: 'insensitive' } },
          select: localWordBookSelect,
        });
        const entries = exactMatch
          ? [exactMatch]
          : await prisma.wordBook.findMany({
              where: { word: { contains: query, mode: 'insensitive' } },
              select: localWordBookSelect,
              orderBy: { frq: 'desc' },
              take: 2,
            });

        if (entries.length === 0) {
          return toJsonResult(
            toolRequiresInput(
              'lookup_word',
              {
                question: '本地词典未收录该词条，请检查拼写或改用原型形式后再试。',
                fields: ['word'],
              },
              { skillId: VOCABULARY_SKILL_ID, skillVersion: skill.version },
            ),
          );
        }

        return toJsonResult(
          toolCompleted(
            'lookup_word',
            {
              word: query,
              source: 'local_word_book',
              entries: entries.map(summarizeEntry),
            },
            { skillId: VOCABULARY_SKILL_ID, skillVersion: skill.version },
          ),
        );
      } catch (error) {
        return toJsonResult(
          errorToToolFailure(
            'lookup_word',
            error,
            '本地词典暂时无法查询，请稍后再试',
          ),
        );
      }
    },
    {
      name: 'lookup_word',
      description:
        '查询本地词典中英文单词或短语的音标、词性、释义、翻译和近义词。当用户询问单词含义、发音、用法或搭配时使用；查无结果时返回本地词典未收录，不要猜测词义。服务端会自动加载 vocabulary Skill。',
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
}
