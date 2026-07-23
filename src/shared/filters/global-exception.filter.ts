import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { AppConfig } from '../../config/configuration';
import { AppException } from '../errors/app.exception';
import { ErrorCode, ErrorResponseBody } from '../errors/error-codes';
import { AppLogger } from '../logging/app-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, errorCode, message, details } =
      this.normalizeException(exception);

    const body: ErrorResponseBody = {
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const nodeEnv = this.configService.get<AppConfig['nodeEnv']>('nodeEnv');
    const isProduction = nodeEnv === 'production';

    if (!isProduction && details !== undefined) {
      body.details = details;
    }

    if (statusCode >= 500) {
      const stack =
        exception instanceof Error && !isProduction
          ? exception.stack
          : undefined;

      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${this.stringifyMessage(message)}`,
        stack,
      );
    } else {
      this.logger.warn(
        `HTTP ${statusCode} on ${request.method} ${request.url}: ${this.stringifyMessage(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    errorCode: ErrorCode | string;
    message: string | string[];
    details?: unknown;
  } {
    if (exception instanceof AppException) {
      const response = exception.getResponse() as {
        message: string;
        errorCode: string;
        details?: unknown;
      };

      return {
        statusCode: exception.getStatus(),
        errorCode: response.errorCode ?? exception.errorCode,
        message: response.message,
        details: response.details,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode,
          errorCode: this.mapStatusToErrorCode(statusCode),
          message: response,
        };
      }

      const payload = response as {
        message?: string | string[];
        error?: string;
      };

      return {
        statusCode,
        errorCode:
          statusCode === 400
            ? ErrorCode.VALIDATION_ERROR
            : this.mapStatusToErrorCode(statusCode),
        message: payload.message ?? exception.message,
        details: payload,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }

  private mapStatusToErrorCode(statusCode: number): ErrorCode {
    switch (statusCode) {
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 400:
        return ErrorCode.BAD_REQUEST;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private stringifyMessage(message: string | string[]): string {
    return Array.isArray(message) ? message.join('; ') : message;
  }
}
