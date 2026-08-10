import { readFileSync, statSync } from 'node:fs';

import { parseSkillMarkdown } from './frontmatter';
import type { Skill, SkillManifest } from './types';

/** 激活时加载完整 SKILL.md 正文。 */
export function loadSkill(manifest: SkillManifest): Skill {
  const fileStat = statSync(manifest.filePath);
  if (
    !fileStat.isFile() ||
    fileStat.size !== manifest.fileIdentity.size ||
    fileStat.mtimeMs !== manifest.fileIdentity.mtimeMs
  ) {
    throw new Error(
      `Skill "${manifest.name}" changed after discovery; refresh the Skill registry before activating it.`,
    );
  }

  const markdown = readFileSync(manifest.filePath, 'utf8');
  const parsed = parseSkillMarkdown(markdown);
  if (!parsed.ok) {
    throw new Error(
      `Skill "${manifest.name}" cannot be activated: ${parsed.message}`,
    );
  }

  if (parsed.value.name !== manifest.name) {
    throw new Error(
      `Skill "${manifest.name}" metadata changed after discovery; refresh skills before activating it.`,
    );
  }

  if (
    parsed.value.description !== manifest.description ||
    parsed.value.version !== manifest.version ||
    JSON.stringify(parsed.value.triggers) !==
      JSON.stringify(manifest.triggers) ||
    JSON.stringify(parsed.value.constraints) !==
      JSON.stringify(manifest.constraints) ||
    JSON.stringify(parsed.value.requiredTools) !==
      JSON.stringify(manifest.requiredTools)
  ) {
    throw new Error(
      `Skill "${manifest.name}" metadata changed after discovery; refresh the Skill registry before activating it.`,
    );
  }

  return {
    ...manifest,
    description: parsed.value.description,
    version: parsed.value.version,
    triggers: parsed.value.triggers,
    constraints: parsed.value.constraints,
    requiredTools: parsed.value.requiredTools,
    instructions: parsed.value.instructions,
  };
}
