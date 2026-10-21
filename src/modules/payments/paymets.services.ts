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

    // Próximo paso: implementar la transacción.
    // No conectar todavía este método al controller.
    throw new Error('Payment transaction not implemented.');
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