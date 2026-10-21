import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  NewPayment,
  PaymentOrder,
  PaymentsRepository,
  PaymentTx,
  StoredPayment,
} from './payments.repository';

@Injectable()
export class PrismaPaymentsRepository implements PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    work: (tx: PaymentTx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (client) => work(new PrismaPaymentTx(client)),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}

/**
 * Operaciones de pagos sobre una transacción existente.
 * Delivery puede extender esta clase para registrar entrega
 * y cobro dentro de la misma transacción.
 */
export class PrismaPaymentTx implements PaymentTx {
  constructor(
    protected readonly tx: Prisma.TransactionClient,
  ) {}

  async findByIdempotency(
    recordedById: string,
    key: string,
  ): Promise<StoredPayment | null> {
    const payment = await this.tx.payment.findUnique({
      where: {
        recordedById_idempotencyKey: {
          recordedById,
          idempotencyKey: key,
        },
      },
    });

    if (!payment) {
      return null;
    }

    if (payment.method !== 'CASH') {
      throw new Error('Unsupported payment method.');
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      recordedById: payment.recordedById,
      amountCents: payment.amountCents,
      method: payment.method,
      createdAt: payment.createdAt,
      idempotencyKey: payment.idempotencyKey,
      requestHash: payment.requestHash,
    };
  }

  async findOrder(
    orderId: string,
  ): Promise<PaymentOrder | null> {
    return this.tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalCents: true,
        paymentVersion: true,
        status: true,
      },
    });
  }

  async tryAdvancePaymentVersion(
    orderId: string,
    expectedVersion: number,
  ): Promise<boolean> {
    const result = await this.tx.order.updateMany({
      where: {
        id: orderId,
        paymentVersion: expectedVersion,
      },
      data: {
        paymentVersion: {
          increment: 1,
        },
      },
    });

    return result.count === 1;
  }

  async sumPaidCents(orderId: string): Promise<number> {
    const result = await this.tx.payment.aggregate({
      where: { orderId },
      _sum: {
        amountCents: true,
      },
    });

    return result._sum.amountCents ?? 0;
  }

  async insertPayment(
    payment: NewPayment,
  ): Promise<StoredPayment> {
    const created = await this.tx.payment.create({
      data: {
        orderId: payment.orderId,
        recordedById: payment.recordedById,
        amountCents: payment.amountCents,
        method: payment.method,
        idempotencyKey: payment.idempotencyKey,
        requestHash: payment.requestHash,
      },
    });

    return {
      id: created.id,
      orderId: created.orderId,
      recordedById: created.recordedById,
      amountCents: created.amountCents,
      method: payment.method,
      createdAt: created.createdAt,
      idempotencyKey: created.idempotencyKey,
      requestHash: created.requestHash,
    };
  }
}