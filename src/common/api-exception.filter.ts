import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isUnhandledException = !(exception instanceof HttpException);
    const message = getExceptionMessage(exception);

    if (isUnhandledException) {
      this.logger.error(
        `Unhandled request error for ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorBody = {
      statusCode,
      message: isUnhandledException ? 'Internal server error' : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }
}

function getExceptionMessage(exception: unknown): string | string[] {
  if (!(exception instanceof HttpException)) {
    return 'Internal server error';
  }

  const exceptionResponse = exception.getResponse();
  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'message' in exceptionResponse
  ) {
    const message = exceptionResponse.message;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message as string | string[];
    }
  }

  return exception.message;
}