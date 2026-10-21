import { Logger } from '@nestjs/common';

import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  afterEach(() => {
    Logger.overrideLogger(new Logger());
  });

  it('keeps logging after Nest installs it as the application logger', () => {
    const appLogger = new AppLogger();
    Logger.overrideLogger(appLogger);

    expect(() => appLogger.log('listo', 'Bootstrap')).not.toThrow();
  });
});
