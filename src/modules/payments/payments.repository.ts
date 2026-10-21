import type { OrderStatus } from '@prisma/client';
export type StoredPayment = {
  id: string;
  orderId: string;
  recordedById: string;
  amountCents: number;
  method: 'CASH';
  createdAt: Date;
  idempotencyKey: string;
  requestHash: string;
};

export type PaymentOrder = {
  id: string;
  totalCents: number;
  paymentVersion: number;
  status: OrderStatus;
};

export type NewPayment = {
  orderId: string;
  recordedById: string;
  amountCents: number;
  method: 'CASH';
  idempotencyKey: string;
  requestHash: string;
};

export interface PaymentTx {
  findByIdempotency(
    recordedById: string,
    key: string,
  ): Promise<StoredPayment | null>;

  findOrder(orderId: string): Promise<PaymentOrder | null>;

  tryAdvancePaymentVersion(
    orderId: string,
    expectedVersion: number,
  ): Promise<boolean>;

  sumPaidCents(orderId: string): Promise<number>;

  insertPayment(payment: NewPayment): Promise<StoredPayment>;
}

export interface PaymentsRepository {
  transaction<T>(
    work: (tx: PaymentTx) => Promise<T>,
  ): Promise<T>;
}

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');