import { Module } from '@nestjs/common';

import { PaymentsController } from './paymets.controller';
import { PaymentsService } from './paymets.service';
import { PAYMENTS_REPOSITORY } from './payments.repository';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENTS_REPOSITORY,
      useClass: PrismaPaymentsRepository,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}