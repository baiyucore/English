import { tool } from 'langchain';
import { z } from 'zod';

import type { PrismaService } from '@libs/shared';

import {
  errorToToolFailure,
  toolCompleted,
  toolFailed,
  toJsonResult,
} from './utils';

/**
 * 将一个单词加入当前用户的单词本。
 * 用户身份由运行时注入，绝不让模型提供或修改 userId。
 */
export function createSaveVocabularyTool(
  prisma: PrismaService,
  userId: string,
) {
  return tool(
    async ({ word }) => {
      const normalizedWord = word.trim().toLowerCase();
      if (!normalizedWord) {
        return toJsonResult(
          toolFailed('save_vocabulary', 'VALIDATION_ERROR', '请提供要保存的单词', {
            retryable: false,
            field: 'word',
          }),
        );
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const existingWord = await tx.wordBook.findFirst({
            where: {
              word: { equals: normalizedWord, mode: 'insensitive' },
            },
            select: { id: true, word: true },
          });
          const wordBook =
            existingWord ??
            (await tx.wordBook.create({
              data: { word: normalizedWord },
              select: { id: true, word: true },
            }));

          const existingRecord = await tx.wordBookRecord.findUnique({
            where: { userId_wordId: { userId, wordId: wordBook.id } },
            select: { id: true },
          });
          if (existingRecord) {
            return { word: wordBook.word, alreadySaved: true };
          }

          await tx.wordBookRecord.create({
            data: { userId, wordId: wordBook.id },
          });
          await tx.user.update({
            where: { id: userId },
            data: { wordNumber: { increment: 1 } },
          });
          return { word: wordBook.word, alreadySaved: false };
        });

        return toJsonResult(toolCompleted('save_vocabulary', result));
      } catch (error) {
        return toJsonResult(
          errorToToolFailure(
            'save_vocabulary',
            error,
            '单词本暂时无法保存，请稍后再试',
          ),
        );
      }
    },
    {
      name: 'save_vocabulary',
      description:
        '将用户明确指定的英文单词或短语保存到当前用户的单词本。当用户说“保存”“加入单词本”“收藏这个词”时使用；只能保存用户明确提到的词，不要自行批量保存。',
      schema: z.object({
        word: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .describe('用户明确要求保存的英文单词或短语，例如 meticulous'),
      }),
    },
  );
}
