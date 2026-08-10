import { parse } from 'yaml';

export type ParsedSkillMetadata = {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  constraints: string[];
  requiredTools: string[];
};

export type ParsedSkillMarkdown = ParsedSkillMetadata & {
  instructions: string;
};

type ParseOk<T> = { ok: true; value: T; bodyOffset?: number };
type ParseErr = { ok: false; message: string };

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function splitFrontmatter(
  markdown: string,
): ParseOk<{ yaml: string; bodyOffset: number }> | ParseErr {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(normalized);
  if (!match) {
    return {
      ok: false,
      message:
        'SKILL.md must begin with YAML frontmatter delimited by --- lines.',
    };
  }

  return {
    ok: true,
    value: { yaml: match[1], bodyOffset: match[0].length },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asStringList(value: unknown): string[] {
  if (value == null) return [];
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter((item): item is string => typeof item === 'string')
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

export function isValidSkillName(value: string): boolean {
  return NAME_PATTERN.test(value) && !value.includes('--');
}

/** 只解析 frontmatter（发现阶段用）。 */
export function parseSkillMetadata(
  markdown: string,
): ParseOk<ParsedSkillMetadata> | ParseErr {
  const split = splitFrontmatter(markdown);
  if (!split.ok) return split;

  let parsedYaml: unknown;
  try {
    parsedYaml = parse(split.value.yaml);
  } catch (error) {
    return {
      ok: false,
      message: `Unable to parse SKILL.md frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!isRecord(parsedYaml)) {
    return {
      ok: false,
      message: 'SKILL.md frontmatter must be a YAML mapping.',
    };
  }

  const metadata = isRecord(parsedYaml.metadata) ? parsedYaml.metadata : {};
  const readField = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (Object.hasOwn(parsedYaml, key)) return parsedYaml[key];
      if (Object.hasOwn(metadata, key)) return metadata[key];
    }
    return undefined;
  };

  const name = asString(readField('name'));
  if (!isValidSkillName(name)) {
    return {
      ok: false,
      message:
        'Skill name must use lowercase letters, digits, and single hyphens (1-64 characters).',
    };
  }

  const description = asString(readField('description'));
  if (!description) {
    return { ok: false, message: 'Skill description is required.' };
  }

  return {
    ok: true,
    bodyOffset: split.value.bodyOffset,
    value: {
      name,
      description,
      version: asString(readField('version')) || 'unversioned',
      triggers: asStringList(readField('triggers')),
      constraints: asStringList(readField('constraints')),
      requiredTools: asStringList(
        readField('required-tools', 'requiredTools', 'tools'),
      ),
    },
  };
}

/** 解析完整 SKILL.md（激活阶段用）。 */
export function parseSkillMarkdown(
  markdown: string,
): ParseOk<ParsedSkillMarkdown> | ParseErr {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const metadata = parseSkillMetadata(normalized);
  if (!metadata.ok) return metadata;

  const instructions = normalized.slice(metadata.bodyOffset ?? 0).trim();
  if (!instructions) {
    return {
      ok: false,
      message: 'SKILL.md must include instructions after its frontmatter.',
    };
  }

  return {
    ok: true,
    value: { ...metadata.value, instructions },
  };
}
