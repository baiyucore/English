import { loadSkill } from './loader';
import type { Skill, SkillManifest } from './types';

/**
 * 内存中的 Manifest 注册表；正文按需懒加载并缓存。
 */
export class SkillRegistry {
  private manifests = new Map<string, SkillManifest>();
  private loaded = new Map<string, Skill>();

  constructor(skills: readonly SkillManifest[] = []) {
    this.replace(skills);
  }

  replace(skills: readonly SkillManifest[]): void {
    const next = new Map<string, SkillManifest>();
    for (const skill of skills) {
      if (next.has(skill.id)) {
        throw new Error(`Duplicate skill registry entry: ${skill.id}`);
      }
      next.set(skill.id, skill);
    }

    for (const id of this.loaded.keys()) {
      const previous = this.manifests.get(id);
      const current = next.get(id);

      if (
        !current ||
        !previous ||
        previous.filePath !== current.filePath ||
        previous.fileIdentity.size !== current.fileIdentity.size ||
        previous.fileIdentity.mtimeMs !== current.fileIdentity.mtimeMs ||
        previous.version !== current.version ||
        previous.description !== current.description ||
        JSON.stringify(previous.triggers) !==
          JSON.stringify(current.triggers) ||
        JSON.stringify(previous.constraints) !==
          JSON.stringify(current.constraints) ||
        JSON.stringify(previous.requiredTools) !==
          JSON.stringify(current.requiredTools)
      ) {
        this.loaded.delete(id);
      }
    }

    this.manifests = next;
  }

  list(): SkillManifest[] {
    return Array.from(this.manifests.values());
  }

  get(name: string): SkillManifest | undefined {
    return this.manifests.get(name.trim().toLowerCase());
  }

  /** 渐进式披露第 2 层：加载完整 instructions。 */
  load(name: string): Skill {
    const key = name.trim().toLowerCase();
    const manifest = this.get(key);
    if (!manifest) {
      throw new Error(`Skill "${name}" is not registered.`);
    }

    const cached = this.loaded.get(manifest.id);
    if (cached) return cached;

    const skill = loadSkill(manifest);
    this.loaded.set(manifest.id, skill);
    return skill;
  }

  findByToolName(toolName: string): SkillManifest | undefined {
    return this.list().find((skill) => skill.requiredTools.includes(toolName));
  }
}
