import type { CorrectionResult } from '../tools/correction.schema';

export function renderCorrectionResult(result: CorrectionResult): string {
  const blocks = [
    result.isCorrect ? '这段英文整体表达正确。' : '建议改为：',
    '',
    `> ${result.corrected}`,
  ];

  if (result.errors.length > 0) {
    blocks.push('', '关键说明：', '');
    blocks.push(
      ...result.errors.map(
        (item) =>
          `- ${item.original} → ${item.suggestion}：${item.explanation}`,
      ),
    );
  }

  if (result.summary) {
    blocks.push('', result.summary);
  }

  return blocks.join('\n');
}
