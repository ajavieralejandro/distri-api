import type { OrderStatus } from '@prisma/client';

type DeliveryCandidate = {
  status: OrderStatus;
  delivery: {
    mode: 'PICKUP' | 'DELIVERY';
  };
  stockDeducted: boolean;
};

export function isAvailableForDelivery(
  order: DeliveryCandidate,
): boolean {
  const isReady =
    order.status === 'CONFIRMED' ||
    order.status === 'PREPARING';

  return (
    order.delivery.mode === 'DELIVERY' &&
    isReady &&
    order.stockDeducted
  );
}