import { Module } from '@nestjs/common';

import { DeliveryCompletionService } from './delivery-completion.service';
import { DELIVERY_COMPLETION_REPOSITORY } from './delivery-completion.repository';
import { DeliveryController } from './delivery.controller';
import { DELIVERY_REPOSITORY } from './delivery.repository';
import { DeliveryService } from './delivery.service';
import { PrismaDeliveryCompletionRepository } from './prisma-delivery-completion.repository';
import { PrismaDeliveryRepository } from './prisma-delivery.repository';

@Module({
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    DeliveryCompletionService,
    PrismaDeliveryRepository,
    PrismaDeliveryCompletionRepository,
    {
      provide: DELIVERY_REPOSITORY,
      useExisting: PrismaDeliveryRepository,
    },
    {
      provide: DELIVERY_COMPLETION_REPOSITORY,
      useExisting: PrismaDeliveryCompletionRepository,
    },
  ],
})
export class DeliveryModule {}