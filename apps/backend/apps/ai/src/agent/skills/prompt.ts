import type { Skill, SkillManifest } from './types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** list_skills：只输出 frontmatter 摘要。 */
export function formatSkillSummaries(skills: readonly SkillManifest[]): string {
  if (skills.length === 0) return '当前没有可用技能。';

  const blocks = skills.map((skill) => {
    const lines = [`name: ${skill.name}`, `description: ${skill.description}`];
    if (skill.triggers.length > 0) {
      lines.push(`triggers: ${skill.triggers.join(', ')}`);
    }
    if (skill.constraints.length > 0) {
      lines.push(`constraints: ${skill.constraints.join('; ')}`);
    }
    if (skill.requiredTools.length > 0) {
      lines.push(`tools: ${skill.requiredTools.join(', ')}`);
    }
    return lines.join('\n');
  });

  return `可用技能（共 ${skills.length} 项）：\n\n${blocks.join('\n\n---\n\n')}`;
}

/** load_skill：输出完整 SKILL 文档视图。 */
export function formatLoadedSkill(skill: Skill): string {
  const header = [
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    skill.triggers.length > 0 ? `triggers: ${skill.triggers.join(', ')}` : '',
    skill.constraints.length > 0
      ? `constraints: ${skill.constraints.join('; ')}`
      : '',
    skill.requiredTools.length > 0
      ? `tools: ${skill.requiredTools.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `---\n${header}\n---\n\n${skill.instructions.trim()}\n`;
}

/** 系统 Prompt：只放目录摘要 + 渐进式披露用法，不塞正文。 */
export function formatSkillsForPrompt(
  skills: readonly SkillManifest[],
): string {
  if (skills.length === 0) {
    return [
      '专项能力通过 Skills 渐进式披露：',
      '1. 先调用 list_skills 查看摘要。',
      '2. 再调用 load_skill 加载完整策略。',
      '3. 按技能说明调用对应执行工具。',
    ].join('\n');
  }

  const lines = [
    '## Available Skills',
    '',
    'Skills 是按需加载的专项能力包。任务明显匹配某项技能时，可以先 load_skill 查看完整策略；执行工具会在服务端再次加载并校验对应 Skill。',
    '',
    '<available_skills>',
  ];

  for (const skill of skills) {
    const triggers =
      skill.triggers.length > 0
        ? ` triggers="${escapeXml(skill.triggers.join(', '))}"`
        : '';
    const tools =
      skill.requiredTools.length > 0
        ? ` tools="${escapeXml(skill.requiredTools.join(', '))}"`
        : '';
    lines.push(
      `  <skill name="${escapeXml(skill.name)}"${triggers}${tools}>${escapeXml(skill.description)}</skill>`,
    );
  }

  lines.push(
    '</available_skills>',
    '',
    '不确定用哪项时先 list_skills；需要查看详细策略时调用 load_skill(skillName)；普通闲聊不必加载技能。',
  );

  return lines.join('\n');
}
