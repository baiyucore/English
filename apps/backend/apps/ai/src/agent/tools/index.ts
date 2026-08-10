import type { ClientTool } from '@langchain/core/tools';

import { correctEnglishTool } from './correct-english.tool';
import { listSkillsTool } from './list-skills.tool';
import { loadSkillTool } from './load-skill.tool';
import { lookupWordTool } from './lookup-word.tool';
import { translateZhToEnTool } from './translate-zh-to-en.tool';

export const englishLearningTools: ClientTool[] = [
  listSkillsTool,
  loadSkillTool,
  lookupWordTool,
  correctEnglishTool,
  translateZhToEnTool,
];

export {
  correctEnglishTool,
  listSkillsTool,
  loadSkillTool,
  lookupWordTool,
  translateZhToEnTool,
};
