/**
 * Skills 渐进式披露类型（对齐 arovi：发现层只有 Manifest，激活后才有 instructions）。
 */

export type SkillManifest = {
  /** 稳定 id，与目录名 / frontmatter.name 一致 */
  id: string;
  name: string;
  description: string;
  version: string;
  directory: string;
  filePath: string;
  fileIdentity: {
    size: number;
    mtimeMs: number;
  };
  triggers: readonly string[];
  constraints: readonly string[];
  /** 该技能声明依赖的执行 Tool */
  requiredTools: readonly string[];
};

/** 激活后才加载正文 */
export type Skill = SkillManifest & {
  instructions: string;
};

export type SkillsDiscoverResult = {
  skills: SkillManifest[];
  diagnostics: string[];
};
