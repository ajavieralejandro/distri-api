import { Global, Module } from '@nestjs/common';

import { AppLoggerModule } from '../logging/app-logger.module';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [AppLoggerModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
