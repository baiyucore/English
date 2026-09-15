import type { VocabularyLookupResult } from '../contracts/agent-result.contract';

export type { VocabularyLookupResult } from '../contracts/agent-result.contract';

export function renderVocabularyResult(result: VocabularyLookupResult): string {
  const entry = result.entries[0];
  if (!entry) return `没有找到 “${result.word}” 的词典结果。`;

  const title = [entry.word ?? result.word, entry.phonetic]
    .filter(Boolean)
    .join(' ');
  const blocks = [title];

  for (const meaning of entry.meanings) {
    const label = meaning.partOfSpeech ? `\n${meaning.partOfSpeech}` : '';
    if (label) blocks.push(label);
    blocks.push(
      ...meaning.definitions.map((item) => {
        const example = item.example ? `\n  例：${item.example}` : '';
        return `- ${item.definition}${example}`;
      }),
    );
  }

  return blocks.join('\n');
}

export function renderVocabularyClarification(question: string): string {
  return question;
}
