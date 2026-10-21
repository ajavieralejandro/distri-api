import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Roles } from '../../shared/auth/roles.decorator';
import { assertIdempotencyKey } from '../orders/order-rules';
import { DeliveryCompletionService } from './delivery-completion.service';
import { DeliveryService } from './delivery.service';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { ListDeliveryOrdersDto } from './dto/list-delivery-orders.dto';

@ApiTags('delivery')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly completionService: DeliveryCompletionService,
  ) {}

  @Get('pool')
  listAvailable(@Query() query: ListDeliveryOrdersDto) {
    return this.deliveryService.listAvailable({
      page: query.page,
      size: query.size,
    });
  }

  @Post('orders/:id/complete')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Conservar el mismo UUID al reintentar la operación.',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() body: CompleteDeliveryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const completion = await this.completionService.complete(
      user,
      orderId,
      body,
      assertIdempotencyKey(idempotencyKey),
    );

    return {
      id: completion.id,
      orderId: completion.orderId,
      status: 'DELIVERED',
      paymentId: completion.paymentId,
      completedAt: completion.createdAt.toISOString(),
    };
  }
}