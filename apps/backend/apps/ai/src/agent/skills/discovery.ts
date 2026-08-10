import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  type Dirent,
} from 'node:fs';
import path from 'node:path';

import { parseSkillMetadata } from './frontmatter';
import type { SkillManifest, SkillsDiscoverResult } from './types';

/** 目录下是否至少有一个带 SKILL.md 的技能子目录。 */
function looksLikeSkillsRoot(dir: string): boolean {
  try {
    return readdirSync(dir, { withFileTypes: true }).some(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(dir, entry.name, 'SKILL.md')),
    );
  } catch {
    return false;
  }
}

/**
 * 发现技能目录：每个子目录一份 SKILL.md，只读 frontmatter。
 * 正文留到 loadSkill 再读。
 */
export function discoverSkills(rootDir: string): SkillsDiscoverResult {
  const skills: SkillManifest[] = [];
  const diagnostics: string[] = [];

  let entries: Dirent[];
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch (error) {
    return {
      skills: [],
      diagnostics: [
        `Cannot read skills root ${rootDir}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;

    const directory = path.join(rootDir, entry.name);
    const filePath = path.join(directory, 'SKILL.md');

    let markdown: string;
    let fileStat: ReturnType<typeof statSync>;
    try {
      fileStat = statSync(filePath);
      if (!fileStat.isFile()) continue;
      markdown = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const parsed = parseSkillMetadata(markdown);
    if (!parsed.ok) {
      diagnostics.push(`Ignoring ${entry.name}: ${parsed.message}`);
      continue;
    }

    if (parsed.value.name !== entry.name) {
      diagnostics.push(
        `Ignoring ${entry.name}: frontmatter name "${parsed.value.name}" must match directory name.`,
      );
      continue;
    }

    if (skills.some((skill) => skill.id === parsed.value.name)) {
      diagnostics.push(`Ignoring duplicate skill: ${parsed.value.name}`);
      continue;
    }

    skills.push({
      id: parsed.value.name,
      name: parsed.value.name,
      description: parsed.value.description,
      version: parsed.value.version,
      directory,
      filePath,
      fileIdentity: {
        size: fileStat.size,
        mtimeMs: fileStat.mtimeMs,
      },
      triggers: parsed.value.triggers,
      constraints: parsed.value.constraints,
      requiredTools: parsed.value.requiredTools,
    });
  }

  return { skills, diagnostics };
}

/**
 * 内置技能根目录。
 *
 * Nest monorepo 下 tsc 可能把 JS 打到 `dist/.../apps/ai/src/agent/skills`，
 * 而 assets 默认落到 `dist/.../agent/skills`，二者不一致时不能只用 `__dirname`。
 */
export function getBuiltinSkillsRoot(): string {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const enqueue = (dir: string) => {
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    candidates.push(resolved);
  };

  let current = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    enqueue(current);
    enqueue(path.join(current, 'agent', 'skills'));
    enqueue(path.join(current, 'apps', 'ai', 'src', 'agent', 'skills'));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const candidate of candidates) {
    if (looksLikeSkillsRoot(candidate)) {
      return candidate;
    }
  }

  return path.resolve(__dirname);
}
