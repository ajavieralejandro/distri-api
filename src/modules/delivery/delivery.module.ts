import { Module } from '@nestjs/common';

import { DeliveryController } from './delivery.controller';
import { DELIVERY_REPOSITORY } from './delivery.repository';
import { DeliveryService } from './delivery.service';
import { PrismaDeliveryRepository } from './prisma-delivery.repository';

@Module({
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    PrismaDeliveryRepository,
    {
      provide: DELIVERY_REPOSITORY,
      useExisting: PrismaDeliveryRepository,
    },
  ],
})
export class DeliveryModule {}