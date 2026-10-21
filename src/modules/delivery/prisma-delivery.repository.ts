import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { orderInclude, toView } from '../orders/orders.mapper';
import type {
  DeliveryListFilter,
  DeliveryListResult,
  DeliveryRepository,
} from './delivery.repository';

@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAvailable(
    filter: DeliveryListFilter,
  ): Promise<DeliveryListResult> {
    const where: Prisma.OrderWhereInput = {
      deliveryMode: 'DELIVERY',
      status: {
        in: ['CONFIRMED', 'PREPARING'],
      },
      stockDeducted: true,
    };

    const [totalItems, orders] = await this.prisma.$transaction(
      [
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          include: orderInclude,
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
          skip: filter.page * filter.size,
          take: filter.size,
        }),
      ],
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );

    return {
      items: orders.map(toView),
      totalItems,
    };
  }
}