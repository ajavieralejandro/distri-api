import {
  money,
  type Money,
} from '../../shared/money/money';
import type { StoredPayment } from './payments.repository';

export type PaymentView = {
  id: string;
  orderId: string;
  amount: Money;
  method: 'CASH';
  createdAt: string;
};

export function toPaymentView(
  payment: StoredPayment,
): PaymentView {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: money(payment.amountCents),
    method: payment.method,
    createdAt: payment.createdAt.toISOString(),
  };
}