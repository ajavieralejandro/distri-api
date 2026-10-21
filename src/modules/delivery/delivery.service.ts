import { Inject, Injectable } from '@nestjs/common';

import type { StoredOrder } from '../orders/orders.repository';
import {
  DELIVERY_REPOSITORY,
  type DeliveryListFilter,
  type DeliveryRepository,
} from './delivery.repository';

export type DeliveryPage = {
  items: StoredOrder[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly delivery: DeliveryRepository,
  ) {}

  async listAvailable(
    filter: DeliveryListFilter,
  ): Promise<DeliveryPage> {
    const result = await this.delivery.findAvailable(filter);

    return {
      items: result.items,
      page: filter.page,
      size: filter.size,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / filter.size),
    };
  }
}