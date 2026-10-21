import { Prisma } from '@prisma/client';

import { money, sumCents } from '../../shared/money/money';
import { summarizePayments } from '../payments/payment-rules';
import type { StoredOrder } from './orders.repository';

export const orderInclude = {
  items: { orderBy: { id: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  commerce: { select: { tradeName: true } },
  payments: { select: { amountCents: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export function toView(order: OrderRow): StoredOrder {
  const paidCents = sumCents(
    order.payments.map((payment) => payment.amountCents),
  );

  const summary = summarizePayments(order.totalCents, paidCents);

  return {
    id: order.id,
    number: `PED-${order.number}`,
    commerceId: order.commerceId,
    commerceName: order.commerce.tradeName,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    notes: order.notes,
    paymentMethod: order.paymentMethod,
    paidAmount: money(summary.paidCents),
    outstandingAmount: money(summary.outstandingCents),
    paymentStatus: summary.status,
    delivery: {
      mode: order.deliveryMode,
      recipient: order.recipient,
      phone: order.phone,
      address: order.address,
      city: order.city,
      references: order.deliveryNotes,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      unitPrice: money(item.unitPriceCents),
      quantity: item.quantity,
      lineTotal: money(item.lineTotalCents),
    })),
    subtotal: money(order.subtotalCents),
    total: money(order.totalCents),
    stockDeducted: order.stockDeducted,
    history: order.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      userId: event.userId,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}