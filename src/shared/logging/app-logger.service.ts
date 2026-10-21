import {
  ConsoleLogger,
  Injectable,
  LoggerService,
  Scope,
} from '@nestjs/common';

/**
 * Thin wrapper around Nest's console logger.
 * It must not use `Logger`: once `app.useLogger()` installs this class,
 * every `Logger` instance delegates back here and the process recurses.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private readonly logger = new ConsoleLogger();
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
