import { ChatDeepSeek } from '@langchain/deepseek';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export const createDeepSeek = () => {
  const configService = new ConfigService();
  return new ChatDeepSeek({
    apiKey: configService.get<string>('DEEPSEEK_API_KEY'), // Default value.
    model: configService.get<string>('DEEPSEEK_API_MODEL'),
    temperature: 1.3,
    maxTokens: 4096,
    streaming: true,
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
