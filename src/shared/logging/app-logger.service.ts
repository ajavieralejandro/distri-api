import { Injectable, Logger, LoggerService, Scope } from '@nestjs/common';

/**
 * Thin wrapper around NestJS Logger so modules share a consistent
 * logging entry point without introducing a third-party library yet.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private readonly logger = new Logger();
  private context?: string;

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    this.logger.log(message, context ?? this.context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, trace, context ?? this.context);
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, context ?? this.context);
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, context ?? this.context);
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, context ?? this.context);
  }
}
