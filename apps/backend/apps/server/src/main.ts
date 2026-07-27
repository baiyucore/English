import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InterceptorInterceptor } from '@libs/shared/interceptor/interceptor';
import { ExceptionFilterFilter } from '@libs/shared/interceptor/exceptionFilter';
import { Config } from '@en/config';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 全局拦截器
  app.useGlobalInterceptors(new InterceptorInterceptor());
  // 全局异常过滤器
  app.useGlobalFilters(new ExceptionFilterFilter());
  // 全局前缀  目的是为了前端处理跨域问题
  app.setGlobalPrefix('/api');
  // 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  await app.listen(Config.ports.server);
}
bootstrap();
