import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { parsePaymentCents } from '../../shared/money/money';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENTS_REPOSITORY,
  type PaymentsRepository,
} from './payments.repository';
import {
  canRegisterPayment,
  summarizePayments,
} from './payment-rules';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly payments: PaymentsRepository,
  ) {}

async register(
  user: AuthenticatedUser,
  orderId: string,
  input: CreatePaymentDto,
  idempotencyKey: string,
) {
  if (user.role !== 'ADMIN') {
    throw new AppException(
      'No tenés permiso para registrar pagos.',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  const amountCents = this.parseAmount(input.amount);

  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        orderId,
        amountCents,
        method: input.method,
      }),
    )
    .digest('hex');

  try {
    return await this.payments.transaction(async (tx) => {
      const existing = await tx.findByIdempotency(
        user.userId,
        idempotencyKey,
      );

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new AppException(
            'La clave ya fue utilizada con otros datos.',
            HttpStatus.CONFLICT,
            ErrorCode.IDEMPOTENCY_KEY_REUSED,
          );
        }

        return existing;
      }

      const order = await tx.findOrder(orderId);

      if (!order) {
        throw new AppException(
          'Pedido no encontrado.',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
        );
      }

      if (order.status !== 'DELIVERED') {
        throw new AppException(
          'El pedido debe estar entregado para registrar este pago.',
          HttpStatus.CONFLICT,
          ErrorCode.ORDER_NOT_PAYABLE,
        );
      }

      const acquired = await tx.tryAdvancePaymentVersion(
        order.id,
        order.paymentVersion,
      );

      if (!acquired) {
        throw new AppException(
          'El pedido cambió mientras registrabas el pago. Actualizá e intentá nuevamente.',
          HttpStatus.CONFLICT,
          ErrorCode.PAYMENT_CONFLICT,
        );
      }

      const paidCents = await tx.sumPaidCents(order.id);

      const summary = summarizePayments(
        order.totalCents,
        paidCents,
      );

      if (!canRegisterPayment(amountCents, summary.outstandingCents)) {
        throw new AppException(
          'El importe supera el pendiente del pedido.',
          HttpStatus.CONFLICT,
          ErrorCode.PAYMENT_EXCEEDS_OUTSTANDING,
        );
      }

      return tx.insertPayment({
        orderId: order.id,
        recordedById: user.userId,
        amountCents,
        method: input.method,
        idempotencyKey,
        requestHash,
      });
    });
  } catch (error) {
    const isUniqueConflict =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002';

    const isApplicationConflict =
      error instanceof AppException &&
      error.getStatus() === HttpStatus.CONFLICT;

    if (!isUniqueConflict && !isApplicationConflict) {
      throw error;
    }

    // Recuperar un pago que otra solicitud pudo haber confirmado.
    const existing = await this.payments.transaction((tx) =>
      tx.findByIdempotency(user.userId, idempotencyKey),
    );

    if (!existing) {
      throw error;
    }

    if (existing.requestHash !== requestHash) {
      throw new AppException(
        'La clave ya fue utilizada con otros datos.',
        HttpStatus.CONFLICT,
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
      );
    }

    return existing;
  }
}
  private parseAmount(amount: string): number {
    try {
      return parsePaymentCents(amount);
    } catch {
      throw new AppException(
        'El importe debe ser positivo y estar dentro del rango permitido.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_PAYMENT_AMOUNT,
      );
    }
  }
}