import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration, { validateEnv } from './config/configuration';
import { HealthModule } from './modules/health/health.module';
import { AppLoggerModule } from './shared/logging/app-logger.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    AppLoggerModule,
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
