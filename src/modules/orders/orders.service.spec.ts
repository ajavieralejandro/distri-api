import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { money } from '../../shared/money/money';
import type { CreateOrderInput } from './order-rules';
import type {
  NewOrder,
  OrderListFilter,
  OrderTx,
  OrdersRepository,
  StoredOrder,
} from './orders.repository';
import { OrdersService } from './orders.service';

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: 'UNIT';
  priceCents: number;
  availableStock: number;
  active: boolean;
};

// Repositorio para pruebas secuenciales.
// Simula rollback, pero no concurrencia ni locks de PostgreSQL.
class MemoryOrders implements OrdersRepository {
  products: Product[] = [
    {
      id: 'prod-agua',
      sku: 'BEB-001',
      name: 'Agua',
      unit: 'UNIT',
      priceCents: 85050,
      availableStock: 10,
      active: true,
    },
  ];

  commerces = [
    { id: 'com-norte', tradeName: 'Norte', active: true },
    { id: 'com-sur', tradeName: 'Sur', active: true },
  ];

  orders: StoredOrder[] = [];

  keys: {
    userId: string;
    key: string;
    requestHash: string;
    orderId: string;
  }[] = [];

  private sequence = 0;

  async transaction<T>(
    work: (tx: OrderTx) => Promise<T>,
  ): Promise<T> {
    const snapshot = structuredClone({
      products: this.products,
      orders: this.orders,
      keys: this.keys,
      sequence: this.sequence,
    });

    try {
      return await work(this.tx());
    } catch (error) {
      this.products = snapshot.products;
      this.orders = snapshot.orders;
      this.keys = snapshot.keys;
      this.sequence = snapshot.sequence;
      throw error;
    }
  }

  list(filter: OrderListFilter) {
    const filtered = this.orders.filter((order) => {
      if (filter.commerceId && order.commerceId !== filter.commerceId) {
        return false;
      }

      if (filter.status && order.status !== filter.status) {
        return false;
      }

      return true;
    });

    return Promise.resolve({
      totalItems: filtered.length,
      items: structuredClone(
        filtered.slice(
          filter.page * filter.size,
          filter.page * filter.size + filter.size,
        ),
      ),
    });
  }

  async findById(id: string): Promise<StoredOrder | null> {
    const order = this.orders.find((candidate) => candidate.id === id);
    return order ? structuredClone(order) : null;
  }

  private tx(): OrderTx {
    return {
      findIdempotency: async (userId, key) => {
        const row = this.keys.find(
          (candidate) =>
            candidate.userId === userId && candidate.key === key,
        );

        return row ? { ...row } : null;
      },

      findCommerce: async (id) => {
        const commerce = this.commerces.find(
          (candidate) => candidate.id === id,
        );

        return commerce ? { ...commerce } : null;
      },

      lockProducts: async (ids) =>
        this.products
          .filter((product) => ids.includes(product.id))
          .map((product) => ({ ...product })),

      insertOrder: async (order, idempotency) => {
        const created = this.toStored(order);
        this.orders.unshift(created);
        this.keys.push({ ...idempotency, orderId: created.id });

        return structuredClone(created);
      },

      findOrder: (id) => this.findById(id),

      tryChangeStatus: async (id, expectedStatus, nextStatus) => {
        const order = this.orders.find(
          (candidate) => candidate.id === id,
        );

        if (!order || order.status !== expectedStatus) {
          return false;
        }

        order.status = nextStatus;
        return true;
      },

      deductStock: async (lines) => {
        const next = this.products.map((product) => ({ ...product }));

        for (const line of lines) {
          const product = next.find(
            (candidate) => candidate.id === line.productId,
          );

          if (!product || product.availableStock < line.quantity) {
            return false;
          }

          product.availableStock -= line.quantity;
        }

        this.products = next;
        return true;
      },

      applyStatus: async (input) => {
        const order = this.orders.find(
          (candidate) => candidate.id === input.orderId,
        );

        if (!order) {
          throw new Error('missing order');
        }

        order.stockDeducted = input.stockDeducted;
        order.updatedAt = new Date().toISOString();

        order.history.push({
          id: `event-${order.history.length + 1}`,
          fromStatus: input.from,
          toStatus: input.to,
          userId: input.userId,
          note: null,
          createdAt: new Date().toISOString(),
        });

        return structuredClone(order);
      },
    };
  }

  private toStored(order: NewOrder): StoredOrder {
    this.sequence += 1;
    const now = '2026-10-14T12:00:00.000Z';

    return {
      id: `order-${this.sequence}`,
      number: `PED-${this.sequence}`,
      commerceId: order.commerceId,
      commerceName: order.commerceName,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      paidAmount: money(0),
      outstandingAmount: money(order.totalCents),
paymentStatus: order.totalCents === 0 ? 'PAID' : 'UNPAID',
      delivery: structuredClone(order.delivery),
      items: order.lines.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        unit: line.unit,
        unitPrice: money(line.unitPriceCents),
        quantity: line.quantity,
        lineTotal: money(line.lineTotalCents),
      })),
      subtotal: money(order.subtotalCents),
      total: money(order.totalCents),
      stockDeducted: false,
      history: [],
    };
  }
}

const norte: AuthenticatedUser = {
  userId: 'user-norte',
  sessionId: 'session-norte',
  role: 'COMMERCE',
  commerceId: 'com-norte',
  displayName: 'Norte',
  email: 'norte@pruebas.distrisoft.local',
};

const sur: AuthenticatedUser = {
  ...norte,
  userId: 'user-sur',
  sessionId: 'session-sur',
  commerceId: 'com-sur',
  displayName: 'Sur',
  email: 'sur@pruebas.distrisoft.local',
};

const admin: AuthenticatedUser = {
  userId: 'user-admin',
  sessionId: 'session-admin',
  role: 'ADMIN',
  commerceId: null,
  displayName: 'Admin',
  email: 'admin@pruebas.distrisoft.local',
};

const KEY = '11111111-1111-4111-8111-111111111111';

function pickup(quantity: number): CreateOrderInput {
  return {
    paymentMethod: 'CASH',
    delivery: { mode: 'PICKUP' },
    items: [{ productId: 'prod-agua', quantity }],
  };
}

describe('OrdersService', () => {
  let store: MemoryOrders;
  let service: OrdersService;

  beforeEach(() => {
    store = new MemoryOrders();
    service = new OrdersService(store);
  });

  it('prices the order from the catalog and links the authenticated commerce', async () => {
    const order = await service.create(norte, pickup(2), KEY);

    expect(order.commerceId).toBe('com-norte');
    expect(order.items[0]).toEqual(
      expect.objectContaining({
        unitPrice: { amount: '850.50', currency: 'ARS' },
        quantity: 2,
        lineTotal: { amount: '1701.00', currency: 'ARS' },
      }),
    );
    expect(order.total).toEqual({ amount: '1701.00', currency: 'ARS' });
    expect(order.paidAmount).toEqual({ amount: '0.00', currency: 'ARS' });
    expect(order.status).toBe('PENDING');
    expect(store.products[0]?.availableStock).toBe(10);
  });

  it('returns the original order when the same key and payload are retried', async () => {
    const first = await service.create(norte, pickup(2), KEY);
    const second = await service.create(norte, pickup(2), KEY);

    expect(second.id).toBe(first.id);
    expect(store.orders).toHaveLength(1);
  });

  it('rejects the same key with a different payload', async () => {
    await service.create(norte, pickup(2), KEY);

    await expect(
      service.create(norte, pickup(3), KEY),
    ).rejects.toMatchObject({
      errorCode: 'IDEMPOTENCY_KEY_REUSED',
    });

    expect(store.orders).toHaveLength(1);
  });

  it('rejects insufficient stock, duplicate products and a missing delivery address', async () => {
    await expect(
      service.create(norte, pickup(11), KEY),
    ).rejects.toMatchObject({
      errorCode: 'INSUFFICIENT_STOCK',
    });

    await expect(
      service.create(
        norte,
        {
          ...pickup(1),
          items: [
            { productId: 'prod-agua', quantity: 1 },
            { productId: 'prod-agua', quantity: 1 },
          ],
        },
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });

    await expect(
      service.create(
        norte,
        {
          paymentMethod: 'TRANSFER',
          delivery: { mode: 'DELIVERY', address: 'Calle 1' },
          items: [{ productId: 'prod-agua', quantity: 1 }],
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });

    expect(store.orders).toHaveLength(0);
  });

  it('hides another commerce order and lets the administrator see both', async () => {
    const order = await service.create(norte, pickup(1), KEY);

    await service.create(
      sur,
      pickup(1),
      '44444444-4444-4444-8444-444444444444',
    );

    await expect(
      service.getById(sur, order.id),
    ).rejects.toMatchObject({
      errorCode: 'NOT_FOUND',
    });

    const surList = await service.list(sur, { page: 0, size: 20 });
    expect(surList.items.map((item) => item.commerceId)).toEqual([
      'com-sur',
    ]);

    await expect(
      service.list(sur, {
        page: 0,
        size: 20,
        commerceId: 'com-norte',
      }),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });

    const adminList = await service.list(admin, { page: 0, size: 20 });
    expect(adminList.totalItems).toBe(2);

    await expect(
      service.getById(admin, order.id),
    ).resolves.toMatchObject({
      id: order.id,
    });
  });

  it('deducts stock once when an administrator confirms, and not on later changes', async () => {
    const order = await service.create(norte, pickup(2), KEY);

    await expect(
      service.updateStatus(norte, order.id, 'CONFIRMED'),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });

    expect(store.products[0]?.availableStock).toBe(10);

    const confirmed = await service.updateStatus(
      admin,
      order.id,
      'CONFIRMED',
    );

    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.history).toEqual([
      expect.objectContaining({
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
      }),
    ]);
    expect(store.products[0]?.availableStock).toBe(8);

    await expect(
      service.updateStatus(admin, order.id, 'CONFIRMED'),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_ORDER_TRANSITION',
    });

    expect(store.products[0]?.availableStock).toBe(8);

    const preparing = await service.updateStatus(
      admin,
      order.id,
      'PREPARING',
    );

    expect(preparing.status).toBe('PREPARING');
    expect(store.products[0]?.availableStock).toBe(8);

    await service.updateStatus(admin, order.id, 'CANCELLED');
    expect(store.products[0]?.availableStock).toBe(8);

    await expect(
      service.updateStatus(admin, order.id, 'DELIVERED'),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_ORDER_TRANSITION',
    });
  });

  it('rolls back the status when confirmation fails due to stock', async () => {
    const order = await service.create(norte, pickup(2), KEY);
    store.products[0]!.availableStock = 1;

    await expect(
      service.updateStatus(admin, order.id, 'CONFIRMED'),
    ).rejects.toMatchObject({
      errorCode: 'INSUFFICIENT_STOCK',
    });

    const stored = await store.findById(order.id);

    expect(stored?.status).toBe('PENDING');
    expect(stored?.stockDeducted).toBe(false);
    expect(stored?.history).toHaveLength(0);
    expect(store.products[0]?.availableStock).toBe(1);
  });

  it('does not let an administrator create a client order', async () => {
    await expect(
      service.create(admin, pickup(1), KEY),
    ).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
    });
  });
});