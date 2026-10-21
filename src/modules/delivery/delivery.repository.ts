import type { StoredOrder } from '../orders/orders.repository';

export type DeliveryListFilter = {
  page: number;
  size: number;
};

export type DeliveryListResult = {
  items: StoredOrder[];
  totalItems: number;
};

export interface DeliveryRepository {
  findAvailable(
    filter: DeliveryListFilter,
  ): Promise<DeliveryListResult>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');