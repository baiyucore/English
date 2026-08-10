import { Logger } from '@nestjs/common';

import { discoverSkills, getBuiltinSkillsRoot } from './discovery';
import { SkillRegistry } from './registry';

const logger = new Logger('SkillBootstrap');

export const TRANSLATION_SKILL_ID = 'translation';
export const CORRECTION_SKILL_ID = 'correction';
export const VOCABULARY_SKILL_ID = 'vocabulary';

/** 启动时发现内置 SKILL.md；正文不在此加载。 */
export function createBuiltinSkillRegistry(): SkillRegistry {
  const { skills, diagnostics } = discoverSkills(getBuiltinSkillsRoot());

  for (const message of diagnostics) {
    logger.warn(message);
  }

  logger.log(`Discovered ${skills.length} builtin skill(s).`);
  return new SkillRegistry(skills);
}

export const skillRegistry = createBuiltinSkillRegistry();
