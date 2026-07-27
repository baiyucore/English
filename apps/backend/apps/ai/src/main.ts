import { NestFactory } from '@nestjs/core';
import { AiModule } from './ai.module';
import { InterceptorInterceptor } from '@libs/shared/interceptor/interceptor';
import { ExceptionFilterFilter } from '@libs/shared/interceptor/exceptionFilter';
import { VersioningType } from '@nestjs/common';
import { Config } from '@en/config';
async function bootstrap() {
  const app = await NestFactory.create(AiModule);
  // 全局拦截器
  app.useGlobalInterceptors(new InterceptorInterceptor());
  // 全局异常过滤器
  app.useGlobalFilters(new ExceptionFilterFilter());
  // 全局前缀  目的是为了前端处理跨域问题
  app.setGlobalPrefix('/ai');
  // 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  await app.listen(Config.ports.ai);
}
bootstrap();
