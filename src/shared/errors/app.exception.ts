import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-codes';

/**
 * Base application exception for intentional, structured API errors.
 * Prefer this over throwing raw Error instances from application code.
 */
export class AppException extends HttpException {
  readonly errorCode: ErrorCode | string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    errorCode: ErrorCode | string = ErrorCode.BAD_REQUEST,
    details?: unknown,
  ) {
    super(
      {
        message,
        errorCode,
        details,
      },
      status,
    );
    this.errorCode = errorCode;
  }
}
