import { NestFactory } from '@nestjs/core';
import { AiModule } from './ai.module';
import { InterceptorInterceptor } from '@libs/shared/interceptor/interceptor';
import { ExceptionFilterFilter } from '@libs/shared/interceptor/exceptionFilter';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Config } from '@en/config';
async function bootstrap() {
  const app = await NestFactory.create(AiModule);
  // 全局拦截器
  app.useGlobalInterceptors(new InterceptorInterceptor());
  // 全局异常过滤器
  app.useGlobalFilters(new ExceptionFilterFilter());
  // DTO 运行时校验：whitelist 剥离未声明字段（含客户端伪造的 userId）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // 全局前缀  目的是为了前端处理跨域问题
  app.setGlobalPrefix('/ai');
  // 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  await app.listen(Config.ports.ai);
}
void bootstrap().catch((error: unknown) => {
  console.error('AI service failed to start', error);
  process.exitCode = 1;
});
