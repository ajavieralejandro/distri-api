import type { OrderStatus, PaymentMethod, ProductUnit } from '@prisma/client';

import type { Money } from '../../shared/money/money';

export type OrderLineView = {
  productId: string;
  sku: string;
  name: string;
  unit: ProductUnit;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
};

export type OrderView = {
  id: string;
  number: string;
  commerceId: string;
  commerceName: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  paymentMethod: PaymentMethod | null;
  paidAmount: Money;
  delivery: {
    mode: 'PICKUP' | 'DELIVERY';
    recipient: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    references: string | null;
  };
  items: OrderLineView[];
  subtotal: Money;
  total: Money;
  stockDeducted: boolean;
  history: {
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    userId: string;
    note: string | null;
    createdAt: string;
  }[];
};

export type StoredOrder = OrderView;

export type NewOrder = {
  commerceId: string;
  commerceName: string;
  createdById: string;
  notes: string | null;
  paymentMethod: PaymentMethod;
  delivery: OrderView['delivery'];
  lines: {
    productId: string;
    sku: string;
    name: string;
    unit: ProductUnit;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  totalCents: number;
};

export type OrderListFilter = {
  commerceId?: string;
  status?: OrderStatus;
  page: number;
  size: number;
};

export interface OrderTx {
  findIdempotency(
    userId: string,
    key: string,
  ): Promise<{ requestHash: string; orderId: string } | null>;
  findCommerce(
    id: string,
  ): Promise<{ id: string; tradeName: string; active: boolean } | null>;
  lockProducts(ids: string[]): Promise<
    {
      id: string;
      sku: string;
      name: string;
      unit: ProductUnit;
      priceCents: number;
      availableStock: number;
      active: boolean;
    }[]
  >;
  insertOrder(
    order: NewOrder,
    idempotency: { userId: string; key: string; requestHash: string },
  ): Promise<StoredOrder>;
  findOrder(id: string): Promise<StoredOrder | null>;
  deductStock(
    lines: { productId: string; quantity: number }[],
  ): Promise<boolean>;
 applyStatus(input: {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  userId: string;
  stockDeducted: boolean;
}): Promise<StoredOrder>;

  tryChangeStatus(
  id: string,
  expectedStatus: StoredOrder['status'],
  nextStatus: StoredOrder['status'],
): Promise<boolean>;
}

export interface OrdersRepository {
  transaction<T>(work: (tx: OrderTx) => Promise<T>): Promise<T>;
  list(
    filter: OrderListFilter,
  ): Promise<{ items: StoredOrder[]; totalItems: number }>;
  findById(id: string): Promise<StoredOrder | null>;
}

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');
