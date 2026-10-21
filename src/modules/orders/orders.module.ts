import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { ORDERS_REPOSITORY } from './orders.repository';
import { OrdersService } from './orders.service';
import { PrismaOrdersRepository } from './prisma-orders.repository';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaOrdersRepository,
    { provide: ORDERS_REPOSITORY, useExisting: PrismaOrdersRepository },
  ],
})
export class OrdersModule {}
