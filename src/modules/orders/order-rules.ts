import { createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import type { OrderStatus, PaymentMethod, ProductUnit } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import {
  lineTotalCents,
  money,
  sumCents,
  type Money,
} from '../../shared/money/money';

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const IDEMPOTENCY_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeliveryInput = {
  mode: 'PICKUP' | 'DELIVERY';
  recipient?: string;
  phone?: string;
  address?: string;
  city?: string;
  references?: string;
};

export type CreateOrderInput = {
  notes?: string;
  paymentMethod: PaymentMethod;
  delivery: DeliveryInput;
  items: { productId: string; quantity: number }[];
};

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  unit: ProductUnit;
  priceCents: number;
  availableStock: number;
  active: boolean;
};

export type PricedLine = {
  productId: string;
  sku: string;
  name: string;
  unit: ProductUnit;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type PricedOrder = {
  lines: PricedLine[];
  subtotalCents: number;
  totalCents: number;
  notes: string | null;
  delivery: {
    mode: 'PICKUP' | 'DELIVERY';
    recipient: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    references: string | null;
  };
};

export function assertIdempotencyKey(key: string | undefined): string {
  const value = key?.trim() ?? '';
  if (!IDEMPOTENCY_KEY.test(value)) {
    throw new AppException(
      'Falta un Idempotency-Key válido.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  return value;
}

export function hashOrderRequest(input: CreateOrderInput): string {
  const canonical = {
    delivery: normalizeDelivery(input.delivery),
    items: [...input.items]
      .map((item) => ({ productId: item.productId, quantity: item.quantity }))
      .sort((left, right) => left.productId.localeCompare(right.productId)),
    notes: input.notes?.trim() || null,
    paymentMethod: input.paymentMethod,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function resolveIdempotency(
  existing: { requestHash: string } | null,
  requestHash: string,
): 'create' | 'replay' {
  if (!existing) {
    return 'create';
  }
  if (existing.requestHash === requestHash) {
    return 'replay';
  }
  throw new AppException(
    'Esa clave de envío ya se usó con otros datos.',
    HttpStatus.CONFLICT,
    ErrorCode.IDEMPOTENCY_KEY_REUSED,
  );
}

export function assertCommerceCanCreate(user: AuthenticatedUser): string {
  if (user.role !== 'COMMERCE' || !user.commerceId) {
    throw new AppException(
      'Solo un comercio vinculado puede crear un pedido.',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }
  return user.commerceId;
}

export function assertCanReadOrder(
  user: AuthenticatedUser,
  orderCommerceId: string,
): void {
  if (user.role === 'ADMIN') {
    return;
  }
  if (user.commerceId !== orderCommerceId) {
    throw new AppException(
      'Pedido no encontrado.',
      HttpStatus.NOT_FOUND,
      ErrorCode.NOT_FOUND,
    );
  }
}

export function commerceFilterFor(
  user: AuthenticatedUser,
  requestedCommerceId?: string,
): string | undefined {
  if (user.role === 'COMMERCE') {
    if (!user.commerceId) {
      throw new AppException(
        'El usuario no está vinculado a un comercio.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }
    if (requestedCommerceId && requestedCommerceId !== user.commerceId) {
      throw new AppException(
        'No podés consultar pedidos de otro comercio.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }
    return user.commerceId;
  }
  return requestedCommerceId;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new AppException(
      'Ese cambio de estado no está permitido.',
      HttpStatus.CONFLICT,
      ErrorCode.INVALID_ORDER_TRANSITION,
    );
  }
}

export function priceOrder(
  input: CreateOrderInput,
  products: CatalogProduct[],
): PricedOrder {
  if (input.items.length < 1) {
    throw new AppException(
      'El pedido no tiene productos.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const seen = new Set<string>();
  for (const item of input.items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 9999
    ) {
      throw new AppException(
        'La cantidad tiene que ser un entero entre 1 y 9999.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (seen.has(item.productId)) {
      throw new AppException(
        'El pedido tiene el mismo producto más de una vez.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    seen.add(item.productId);
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.active) {
      throw new AppException(
        'Hay un producto que no está disponible.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.UNPROCESSABLE,
      );
    }
    if (item.quantity > product.availableStock) {
      throw new AppException(
        `No hay stock suficiente de ${product.name}.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.INSUFFICIENT_STOCK,
        { productId: product.id, availableStock: product.availableStock },
      );
    }
    const lineTotal = lineTotalCents(product.priceCents, item.quantity);
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: lineTotal,
    };
  });

  const subtotalCents = sumCents(lines.map((line) => line.lineTotalCents));
  return {
    lines,
    subtotalCents,
    totalCents: subtotalCents,
    notes: input.notes?.trim() || null,
    delivery: normalizeDelivery(input.delivery),
  };
}

export function toMoney(cents: number): Money {
  return money(cents);
}

function normalizeDelivery(delivery: DeliveryInput): PricedOrder['delivery'] {
  if (delivery.mode === 'PICKUP') {
    return {
      mode: 'PICKUP',
      recipient: null,
      phone: null,
      address: null,
      city: null,
      references: null,
    };
  }

  const recipient = delivery.recipient?.trim() ?? '';
  const phone = delivery.phone?.trim() ?? '';
  const address = delivery.address?.trim() ?? '';
  const city = delivery.city?.trim() ?? '';
  if (!recipient || !phone || !address || !city) {
    throw new AppException(
      'El envío necesita destinatario, teléfono, dirección y localidad.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  return {
    mode: 'DELIVERY',
    recipient,
    phone,
    address,
    city,
    references: delivery.references?.trim() || null,
  };
}
