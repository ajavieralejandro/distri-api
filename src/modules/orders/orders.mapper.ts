import { Prisma } from '@prisma/client';

import { money } from '../../shared/money/money';
import type { StoredOrder } from './orders.repository';

export const orderInclude = {
  items: { orderBy: { id: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  commerce: { select: { tradeName: true } },
} satisfies Prisma.OrderInclude;


type OrderRow = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export function toView(order: OrderRow): StoredOrder {
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
    paidAmount: money(0),
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
    }))}
}