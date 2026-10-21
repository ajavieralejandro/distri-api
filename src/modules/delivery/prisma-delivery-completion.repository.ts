import { Injectable } from '@nestjs/common';
import { Prisma, type OrderStatus } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { PrismaPaymentTx } from '../payments/prisma-payments.repository';
import type {
  DeliveryCompletionRepository,
  DeliveryCompletionTx,
  DeliveryOrder,
  NewDeliveryCompletion,
  StoredDeliveryCompletion,
} from './delivery-completion.repository';

@Injectable()
export class PrismaDeliveryCompletionRepository
  implements DeliveryCompletionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    work: (tx: DeliveryCompletionTx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (client) => work(new PrismaDeliveryCompletionTx(client)),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}

class PrismaDeliveryCompletionTx
  extends PrismaPaymentTx
  implements DeliveryCompletionTx
{
  async findCompletionByKey(
    userId: string,
    key: string,
  ): Promise<StoredDeliveryCompletion | null> {
    return this.tx.deliveryCompletion.findUnique({
      where: {
        completedById_idempotencyKey: {
          completedById: userId,
          idempotencyKey: key,
        },
      },
    });
  }

  async findDeliveryOrder(
    orderId: string,
  ): Promise<DeliveryOrder | null> {
    return this.tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        status: true,
        deliveryMode: true,
        stockDeducted: true,
        totalCents: true,
        paymentVersion: true,
      },
    });
  }

  async tryMarkDelivered(
    orderId: string,
    expectedStatus: OrderStatus,
    userId: string,
  ): Promise<boolean> {
    const canDeliver =
      expectedStatus === 'CONFIRMED' ||
      expectedStatus === 'PREPARING';

    if (!canDeliver) {
      return false;
    }

    const result = await this.tx.order.updateMany({
      where: {
        id: orderId,
        status: expectedStatus,
        deliveryMode: 'DELIVERY',
        stockDeducted: true,
      },
      data: {
        status: 'DELIVERED',
      },
    });

    if (result.count !== 1) {
      return false;
    }

    await this.tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: expectedStatus,
        toStatus: 'DELIVERED',
        userId,
        note: 'Entrega completada',
      },
    });

    return true;
  }

  async insertCompletion(
    input: NewDeliveryCompletion,
  ): Promise<StoredDeliveryCompletion> {
    return this.tx.deliveryCompletion.create({
      data: {
        orderId: input.orderId,
        completedById: input.completedById,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        paymentId: input.paymentId,
      },
    });
  }
}