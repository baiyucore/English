import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Request, Response } from 'express';

// 将bigint转换为字符串，并保留日期类型不变
const transformBigInt = (obj: any): any => {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(transformBigInt);
  }
  if (obj !== null && typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, transformBigInt(value)]),
    );
  }
  return obj;
};

@Injectable()
export class InterceptorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    return next.handle().pipe(
      map((data: any) => {
        const code = data?.code || 200;
        return {
          timestamp: new Date().toISOString(),
          path: request.url,

          message: data?.message || '请求成功',

          code,
          success: code === 200,
          data: transformBigInt(data?.data) ?? null,
        };
      }),
    );
  }
}
