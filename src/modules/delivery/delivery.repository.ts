import type { StoredOrder } from '../orders/orders.repository';

export interface DeliveryRepository {
  findAvailable(): Promise<StoredOrder[]>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');