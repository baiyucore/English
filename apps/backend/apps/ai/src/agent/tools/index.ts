import type { ClientTool } from '@langchain/core/tools';

import { correctEnglishTool } from './correct-english.tool';
import { lookupWordTool } from './lookup-word.tool';

export const englishLearningTools: ClientTool[] = [
  lookupWordTool,
  correctEnglishTool,
];

export { correctEnglishTool, lookupWordTool };
