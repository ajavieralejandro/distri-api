import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../shared/auth/roles.decorator';
import { DeliveryService } from './delivery.service';
import { ListDeliveryOrdersDto } from './dto/list-delivery-orders.dto';

@ApiTags('delivery')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get('pool')
  listAvailable(@Query() query: ListDeliveryOrdersDto) {
    return this.deliveryService.listAvailable({
      page: query.page,
      size: query.size,
    });
  }
}