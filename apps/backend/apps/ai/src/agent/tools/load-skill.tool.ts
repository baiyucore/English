import { tool } from 'langchain';
import { z } from 'zod';

import { skillRegistry } from '../skills';
import { toolCompleted, toolFailed, toJsonResult } from './utils';

/** 渐进式披露第 2 层：按需加载完整 SKILL.md 正文。 */
export const loadSkillTool = tool(
  ({ skillName }) => {
    const manifest = skillRegistry.get(skillName);
    if (!manifest) {
      const available = skillRegistry
        .list()
        .map((skill) => skill.id)
        .join(', ');
      return toJsonResult(
        toolFailed(
          'load_skill',
          'NOT_FOUND',
          `技能 ${skillName} 不存在，请先用 list_skills 查看可用技能列表。当前可用：${available || '无'}。`,
          { retryable: false, field: 'skillName' },
        ),
      );
    }

    try {
      const skill = skillRegistry.load(manifest.name);
      return toJsonResult(
        toolCompleted('load_skill', {
          name: skill.name,
          description: skill.description,
          version: skill.version,
          triggers: skill.triggers,
          constraints: skill.constraints,
          requiredTools: skill.requiredTools,
          instructions: skill.instructions,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toJsonResult(
        toolFailed(
          'load_skill',
          'INTERNAL_ERROR',
          `技能 ${manifest.name} 加载失败，请刷新技能注册表后重试：${message}`,
          { retryable: true },
        ),
      );
    }
  },
  {
    name: 'load_skill',
    description:
      '加载某项技能的完整内容，包括详细提示词、模板和示例。确认要深入使用某项技能后再调用。',
    schema: z.object({
      skillName: z
        .string()
        .trim()
        .min(1)
        .describe('技能目录名，例如 translation、correction、vocabulary'),
    }),
  },
);
