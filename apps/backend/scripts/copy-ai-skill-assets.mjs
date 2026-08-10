import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const sourceRoot = path.join(backendRoot, 'apps/ai/src/agent/skills');
const distRoot = path.join(backendRoot, 'dist/apps/ai');

async function findFiles(directory, predicate, result = []) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await findFiles(filePath, predicate, result);
    } else if (predicate(filePath)) {
      result.push(filePath);
    }
  }

  return result;
}

const sourceSkills = await findFiles(
  sourceRoot,
  (filePath) => path.basename(filePath) === 'SKILL.md',
);
const compiledBootstraps = await findFiles(
  distRoot,
  (filePath) =>
    path.basename(filePath) === 'bootstrap.js' &&
    filePath.includes(`${path.sep}agent${path.sep}skills${path.sep}`),
);

if (sourceSkills.length === 0) {
  throw new Error(`No SKILL.md files found under ${sourceRoot}`);
}

if (compiledBootstraps.length === 0) {
  throw new Error(`No compiled Skill bootstrap found under ${distRoot}`);
}

for (const bootstrapPath of compiledBootstraps) {
  const destinationRoot = path.dirname(bootstrapPath);

  for (const sourcePath of sourceSkills) {
    const relativePath = path.relative(sourceRoot, sourcePath);
    const destinationPath = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

console.log(
  `Copied ${sourceSkills.length} Skill document(s) to ${compiledBootstraps
    .map((filePath) => path.dirname(filePath))
    .join(', ')}`,
);
