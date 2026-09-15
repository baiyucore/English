import type { TranslationResult } from '../tools/translation.schema';

export function renderTranslationResult(result: TranslationResult): string {
  const blocks = ['译文：', '', `> ${result.translation}`];

  if (result.alternative) {
    blocks.push('', '备选译法：', '', `> ${result.alternative}`);
  }

  if (result.keyExpressions.length > 0) {
    blocks.push('', '关键表达：', '');
    blocks.push(
      ...result.keyExpressions.map((item) =>
        item.note
          ? `- ${item.en}：${item.zh || '关键表达'}（${item.note}）`
          : `- ${item.en}：${item.zh || '关键表达'}`,
      ),
    );
  }

  return blocks.join('\n');
}

export function renderTranslationClarification(question: string): string {
  return `为了准确翻译，我想先确认一下：${question}`;
}
