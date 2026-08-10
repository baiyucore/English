import { tool } from 'langchain';
import { z } from 'zod';

import { formatSkillSummaries, skillRegistry } from '../skills';

/** 渐进式披露第 1 层：只返回 frontmatter 摘要。 */
export const listSkillsTool = tool(
  () => formatSkillSummaries(skillRegistry.list()),
  {
    name: 'list_skills',
    description:
      '列出所有可用技能的摘要信息（名称、适用场景、约束、关联工具）。不确定用哪项技能时先调用这个。',
    schema: z.object({}),
  },
);
