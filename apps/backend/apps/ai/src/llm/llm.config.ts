import { ChatDeepSeek } from '@langchain/deepseek';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

type CreateDeepSeekOptions = {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  timeout?: number;
};

/** 模型请求的最终硬上限；用户 Abort 仍然可以更早终止请求。 */
export const MODEL_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export const createDeepSeek = (options: CreateDeepSeekOptions = {}) => {
  const configService = new ConfigService();
  return new ChatDeepSeek({
    apiKey: configService.get<string>('DEEPSEEK_API_KEY'), // Default value.
    model: configService.get<string>('DEEPSEEK_API_MODEL'),
    temperature: options.temperature ?? 1.3,
    maxTokens: options.maxTokens ?? 4096,
    streaming: options.streaming ?? true,
    timeout: options.timeout ?? MODEL_REQUEST_TIMEOUT_MS,
  });
};

export const createCheckerPoint = async () => {
  const configService = new ConfigService();
  const checkerPoint = PostgresSaver.fromConnString(
    configService.get<string>('AI_DATABASE_URL')!,
  );
  await checkerPoint.setup();
  return checkerPoint;
};
