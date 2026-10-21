import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { parsePaymentCents } from '../../shared/money/money';
import {
  canRegisterPayment,
  summarizePayments,
} from '../payments/payment-rules';
import {
  DELIVERY_COMPLETION_REPOSITORY,
  type DeliveryCompletionRepository,
  type StoredDeliveryCompletion,
} from './delivery-completion.repository';
import type { CompleteDeliveryDto } from './dto/complete-delivery.dto';

@Injectable()
export class DeliveryCompletionService {
  constructor(
    @Inject(DELIVERY_COMPLETION_REPOSITORY)
    private readonly deliveries: DeliveryCompletionRepository,
  ) {}

  async complete(
    user: AuthenticatedUser,
    orderId: string,
    input: CompleteDeliveryDto,
    idempotencyKey: string,
  ): Promise<StoredDeliveryCompletion> {
    if (user.role !== 'ADMIN') {
      throw new AppException(
        'No tenés permiso para finalizar entregas.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const amountCents = input.payment
      ? this.parseAmount(input.payment.amount)
      : 0;

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          orderId,
          amountCents,
          method: input.payment?.method ?? null,
        }),
      )
      .digest('hex');

    try {
      return await this.deliveries.transaction(async (tx) => {
        const existing = await tx.findCompletionByKey(
          user.userId,
          idempotencyKey,
        );

        if (existing) {
          this.assertSameRequest(existing, requestHash);
          return existing;
        }

        const order = await tx.findDeliveryOrder(orderId);

        if (!order) {
          throw new AppException(
            'Pedido no encontrado.',
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
          );
        }

        if (
          order.deliveryMode !== 'DELIVERY' ||
          !order.stockDeducted ||
          !['CONFIRMED', 'PREPARING'].includes(order.status)
        ) {
          throw new AppException(
            'El pedido no está disponible para completar la entrega.',
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_ORDER_TRANSITION,
          );
        }

        const acquired = await tx.tryAdvancePaymentVersion(
          order.id,
          order.paymentVersion,
        );

        if (!acquired) {
          throw new AppException(
            'El pedido cambió. Actualizá e intentá nuevamente.',
            HttpStatus.CONFLICT,
            ErrorCode.PAYMENT_CONFLICT,
          );
        }

        const paidCents = await tx.sumPaidCents(order.id);
        const summary = summarizePayments(order.totalCents, paidCents);

        if (
          input.payment &&
          !canRegisterPayment(amountCents, summary.outstandingCents)
        ) {
          throw new AppException(
            'El importe supera el pendiente del pedido.',
            HttpStatus.CONFLICT,
            ErrorCode.PAYMENT_EXCEEDS_OUTSTANDING,
          );
        }

        const delivered = await tx.tryMarkDelivered(
          order.id,
          order.status,
          user.userId,
        );

        if (!delivered) {
          throw new AppException(
            'El pedido cambió y no se pudo completar la entrega.',
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT,
          );
        }

        let paymentId: string | null = null;

        if (input.payment) {
          const payment = await tx.insertPayment({
            orderId: order.id,
            recordedById: user.userId,
            amountCents,
            method: input.payment.method,
            // Evita colisiones con las claves del endpoint de pagos.
            idempotencyKey: `delivery:${idempotencyKey}`,
            requestHash,
          });

          paymentId = payment.id;
        }

        return tx.insertCompletion({
          orderId: order.id,
          completedById: user.userId,
          idempotencyKey,
          requestHash,
          paymentId,
        });
      });
    } catch (error) {
      const uniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      const applicationConflict =
        error instanceof AppException &&
        error.getStatus() === HttpStatus.CONFLICT;

      if (!uniqueConflict && !applicationConflict) {
        throw error;
      }

      const existing = await this.deliveries.transaction((tx) =>
        tx.findCompletionByKey(user.userId, idempotencyKey),
      );

      if (!existing) {
        throw error;
      }

      this.assertSameRequest(existing, requestHash);
      return existing;
    }
  }

  private assertSameRequest(
    existing: StoredDeliveryCompletion,
    requestHash: string,
  ): void {
    if (existing.requestHash !== requestHash) {
      throw new AppException(
        'La clave ya fue utilizada con otros datos.',
        HttpStatus.CONFLICT,
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
      );
    }
  }

  private parseAmount(amount: string): number {
    try {
      return parsePaymentCents(amount);
    } catch {
      throw new AppException(
        'El importe del pago debe ser positivo y válido.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_PAYMENT_AMOUNT,
      );
    }
  }
}