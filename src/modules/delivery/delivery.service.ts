import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from './delivery.repository';

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly delivery: DeliveryRepository,
  ) {}

  async listAvailable() {
    return this.delivery.findAvailable();
  }
}