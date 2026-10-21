import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import {
  assertCanReadOrder,
  assertCommerceCanCreate,
  assertTransition,
  commerceFilterFor,
  hashOrderRequest,
  priceOrder,
  resolveIdempotency,
  type CreateOrderInput,
} from './order-rules';
import {
  ORDERS_REPOSITORY,
  type OrderListFilter,
  type OrdersRepository,
  type StoredOrder,
} from './orders.repository';

export type OrderPage = {
  items: StoredOrder[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
  ) {}

  async create(
    user: AuthenticatedUser,
    input: CreateOrderInput,
    idempotencyKey: string,
  ): Promise<StoredOrder> {
    const commerceId = assertCommerceCanCreate(user);
    const requestHash = hashOrderRequest(input);

    try {
      return await this.orders.transaction(async (tx) => {
        const existing = await tx.findIdempotency(user.userId, idempotencyKey);
        if (resolveIdempotency(existing, requestHash) === 'replay') {
          const replayed = existing
            ? await tx.findOrder(existing.orderId)
            : null;
          if (!replayed) {
            throw new AppException(
              'No se pudo recuperar el pedido ya enviado.',
              HttpStatus.CONFLICT,
              ErrorCode.CONFLICT,
            );
          }
          return replayed;
        }

        const commerce = await tx.findCommerce(commerceId);
        if (!commerce?.active) {
          throw new AppException(
            'El comercio no está activo.',
            HttpStatus.FORBIDDEN,
            ErrorCode.FORBIDDEN,
          );
        }

        const products = await tx.lockProducts(
          input.items.map((item) => item.productId),
        );
        const priced = priceOrder(input, products);
        return tx.insertOrder(
          {
            commerceId: commerce.id,
            commerceName: commerce.tradeName,
            createdById: user.userId,
            notes: priced.notes,
            paymentMethod: input.paymentMethod,
            delivery: priced.delivery,
            lines: priced.lines,
            subtotalCents: priced.subtotalCents,
            totalCents: priced.totalCents,
          },
          { userId: user.userId, key: idempotencyKey, requestHash },
        );
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      return this.orders.transaction(async (tx) => {
        const existing = await tx.findIdempotency(user.userId, idempotencyKey);
        resolveIdempotency(existing, requestHash);
        const replayed = existing ? await tx.findOrder(existing.orderId) : null;
        if (!replayed) {
          throw new AppException(
            'No se pudo recuperar el pedido ya enviado.',
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT,
          );
        }
        return replayed;
      });
    }
  }

  async list(
    user: AuthenticatedUser,
    filter: Omit<OrderListFilter, 'commerceId'> & { commerceId?: string },
  ): Promise<OrderPage> {
    const commerceId = commerceFilterFor(user, filter.commerceId);
    const result = await this.orders.list({ ...filter, commerceId });
    const totalPages =
      result.totalItems === 0 ? 0 : Math.ceil(result.totalItems / filter.size);
    return {
      items: result.items,
      page: filter.page,
      size: filter.size,
      totalItems: result.totalItems,
      totalPages,
    };
  }

  async getById(user: AuthenticatedUser, id: string): Promise<StoredOrder> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new AppException(
        'Pedido no encontrado.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      );
    }
    assertCanReadOrder(user, order.commerceId);
    return order;
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    status: OrderStatus,
  ): Promise<StoredOrder> {
    if (user.role !== 'ADMIN') {
      throw new AppException(
        'No tenés permiso para cambiar el estado del pedido.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    return this.orders.transaction(async (tx) => {
      const order = await tx.findOrder(id);
      if (!order) {
        throw new AppException(
          'Pedido no encontrado.',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
        );
      }
      assertTransition(order.status, status);
      const changed = await tx.tryChangeStatus(
        order.id,
        order.status,
        status,
      );

      if (!changed) {
        throw new AppException(
          'El pedido cambió mientras lo estabas procesando. Actualizá e intentá nuevamente.',
          HttpStatus.CONFLICT,
          ErrorCode.CONFLICT,
        );
      }
      let stockDeducted = order.stockDeducted;
      if (status === 'CONFIRMED' && !stockDeducted) {
        const deducted = await tx.deductStock(
          order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        );
        if (!deducted) {
          throw new AppException(
            'No hay stock suficiente para confirmar el pedido.',
            HttpStatus.CONFLICT,
            ErrorCode.INSUFFICIENT_STOCK,
          );
        }
        stockDeducted = true;
      }
      return tx.applyStatus({
        orderId: order.id,
        to: status,
        userId: user.userId,
        stockDeducted,
      });
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
