import { tool } from 'langchain';
import { z } from 'zod';

import type { PrismaService } from '@libs/shared';

import { errorToToolFailure, toolCompleted, toJsonResult } from './utils';

/**
 * 读取当前用户的单词本进度。当前数据模型尚无间隔复习排期，
 * 因此只返回已保存、已掌握与建议复习的未掌握单词，不伪造学习计划。
 */
export function createGetLearningProgressTool(
  prisma: PrismaService,
  userId: string,
) {
  return tool(
    async () => {
      try {
        const [totalSaved, mastered, reviewRecords] = await Promise.all([
          prisma.wordBookRecord.count({ where: { userId } }),
          prisma.wordBookRecord.count({ where: { userId, isMaster: true } }),
          prisma.wordBookRecord.findMany({
            where: { userId, isMaster: false },
            orderBy: { updatedAt: 'asc' },
            take: 5,
            select: { word: { select: { word: true } } },
          }),
        ]);

        return toJsonResult(
          toolCompleted('get_learning_progress', {
            totalSaved,
            mastered,
            pendingReview: totalSaved - mastered,
            suggestedReviewWords: reviewRecords.map((record) => record.word.word),
          }),
        );
      } catch (error) {
        return toJsonResult(
          errorToToolFailure(
            'get_learning_progress',
            error,
            '暂时无法读取学习进度，请稍后再试',
          ),
        );
      }
    },
    {
      name: 'get_learning_progress',
      description:
        '读取当前用户已保存单词数、已掌握数，以及最多五个建议复习的未掌握单词。当用户询问“我今天学什么”“该复习什么”“我的单词学习进度”时使用。它只读取当前用户的数据，不能查询其他用户。',
      schema: z.object({}),
    },
  );
}
