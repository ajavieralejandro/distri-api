import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { money } from '../../shared/money/money';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  NewOrder,
  OrderListFilter,
  OrderTx,
  OrdersRepository,
  StoredOrder,
} from './orders.repository';

const orderInclude = {
  items: { orderBy: { id: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  commerce: { select: { tradeName: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

type RawProduct = {
  id: string;
  sku: string;
  name: string;
  unit: 'UNIT' | 'PACK' | 'BOX';
  priceCents: number;
  availableStock: number;
  active: boolean;
};

@Injectable()
export class PrismaOrdersRepository implements OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: OrderTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) =>
      work(new PrismaOrderTx(client)),
    );
  }

  async list(
    filter: OrderListFilter,
  ): Promise<{ items: StoredOrder[]; totalItems: number }> {
    const where: Prisma.OrderWhereInput = {
      commerceId: filter.commerceId,
      status: filter.status,
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: filter.page * filter.size,
        take: filter.size,
      }),
    ]);
    return { totalItems, items: rows.map(toView) };
  }

  async findById(id: string): Promise<StoredOrder | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    return row ? toView(row) : null;
  }
}

class PrismaOrderTx implements OrderTx {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findIdempotency(userId: string, key: string) {
    const row = await this.tx.idempotencyRecord.findUnique({
      where: { userId_key: { userId, key } },
    });
    return row ? { requestHash: row.requestHash, orderId: row.orderId } : null;
  }

  async findCommerce(id: string) {
    const commerce = await this.tx.commerce.findUnique({
      where: { id },
      select: { id: true, tradeName: true, active: true },
    });
    return commerce;
  }

  async lockProducts(ids: string[]): Promise<RawProduct[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.tx.$queryRaw<RawProduct[]>`
      SELECT id, sku, name, unit::text AS unit, "priceCents", "availableStock", active
      FROM "Product"
      WHERE id IN (${Prisma.join(ids)})
      FOR UPDATE
    `;
  }

  async insertOrder(
    order: NewOrder,
    idempotency: { userId: string; key: string; requestHash: string },
  ): Promise<StoredOrder> {
    const created = await this.tx.order.create({
      data: {
        commerceId: order.commerceId,
        createdById: order.createdById,
        notes: order.notes,
        paymentMethod: order.paymentMethod,
        deliveryMode: order.delivery.mode,
        recipient: order.delivery.recipient,
        phone: order.delivery.phone,
        address: order.delivery.address,
        city: order.delivery.city,
        deliveryNotes: order.delivery.references,
        subtotalCents: order.subtotalCents,
        totalCents: order.totalCents,
        items: {
          create: order.lines.map((line) => ({
            productId: line.productId,
            sku: line.sku,
            name: line.name,
            unit: line.unit,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
          })),
        },
        events: {
          create: {
            toStatus: 'PENDING',
            userId: order.createdById,
            note: 'Pedido creado',
          },
        },
        idempotency: {
          create: {
            userId: idempotency.userId,
            key: idempotency.key,
            requestHash: idempotency.requestHash,
          },
        },
      },
      include: orderInclude,
    });
    return toView(created);
  }

  async findOrder(id: string): Promise<StoredOrder | null> {
    const row = await this.tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    return row ? toView(row) : null;
  }

  async deductStock(
    lines: { productId: string; quantity: number }[],
  ): Promise<boolean> {
    for (const line of lines) {
      const updated = await this.tx.product.updateMany({
        where: {
          id: line.productId,
          availableStock: { gte: line.quantity },
        },
        data: { availableStock: { decrement: line.quantity } },
      });
      if (updated.count !== 1) {
        return false;
      }
    }
    return true;
  }

  async tryChangeStatus(
  id: string,
  expectedStatus: StoredOrder['status'],
  nextStatus: StoredOrder['status'],
): Promise<boolean> {
  const result = await this.tx.order.updateMany({
    where: {
      id,
      status: expectedStatus,
    },
    data: {
      status: nextStatus,
    },
  });

  return result.count === 1;
}

  async applyStatus(input: {
    orderId: string;
    to: StoredOrder['status'];
    userId: string;
    stockDeducted: boolean;
  }): Promise<StoredOrder> {
    const current = await this.tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true },
    });
    if (!current) {
      throw new Error('Order disappeared during status update.');
    }
    const updated = await this.tx.order.update({
      where: { id: input.orderId },
      data: {
        status: input.to,
        stockDeducted: input.stockDeducted,
        events: {
          create: {
            fromStatus: current.status,
            toStatus: input.to,
            userId: input.userId,
          },
        },
      },
      include: orderInclude,
    });
    return toView(updated);
  }
}


function toView(order: OrderRow): StoredOrder {
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
    })),
  };

  
}
