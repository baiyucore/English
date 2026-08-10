import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class ExceptionFilterFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray((exceptionResponse as { message?: unknown }).message)
          ? (exceptionResponse as { message: string[] }).message.join('; ')
          : typeof (exceptionResponse as { message?: unknown }).message ===
              'string'
            ? (exceptionResponse as { message: string }).message
            : exception.message;

    response.status(status).json({
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      code: status,
      success: false,
    });
  }
}
