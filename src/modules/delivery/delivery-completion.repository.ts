import type { OrderStatus } from '@prisma/client';

import type { PaymentTx } from '../payments/payments.repository';

export type StoredDeliveryCompletion = {
  id: string;
  orderId: string;
  completedById: string;
  idempotencyKey: string;
  requestHash: string;
  paymentId: string | null;
  createdAt: Date;
};

export type DeliveryOrder = {
  id: string;
  status: OrderStatus;
  deliveryMode: 'PICKUP' | 'DELIVERY';
  stockDeducted: boolean;
  totalCents: number;
  paymentVersion: number;
};

export type NewDeliveryCompletion = {
  orderId: string;
  completedById: string;
  idempotencyKey: string;
  requestHash: string;
  paymentId: string | null;
};

export interface DeliveryCompletionTx extends PaymentTx {
  findCompletionByKey(
    userId: string,
    key: string,
  ): Promise<StoredDeliveryCompletion | null>;

  findDeliveryOrder(
    orderId: string,
  ): Promise<DeliveryOrder | null>;

  tryMarkDelivered(
    orderId: string,
    expectedStatus: OrderStatus,
    userId: string,
  ): Promise<boolean>;

  insertCompletion(
    input: NewDeliveryCompletion,
  ): Promise<StoredDeliveryCompletion>;
}

export interface DeliveryCompletionRepository {
  transaction<T>(
    work: (tx: DeliveryCompletionTx) => Promise<T>,
  ): Promise<T>;
}

export const DELIVERY_COMPLETION_REPOSITORY =
  Symbol('DELIVERY_COMPLETION_REPOSITORY');