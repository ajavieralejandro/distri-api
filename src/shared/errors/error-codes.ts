/**
 * Application-level error codes for consistent API responses.
 * Domain-specific codes will be added alongside commercial modules.
 */
export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  UNPROCESSABLE = 'UNPROCESSABLE',
  IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_ORDER_TRANSITION = 'INVALID_ORDER_TRANSITION',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export interface ErrorResponseBody {
  statusCode: number;
  errorCode: ErrorCode | string;
  message: string | string[];
  timestamp: string;
  path: string;
  details?: unknown;
}
