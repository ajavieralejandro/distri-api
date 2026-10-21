import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Roles } from '../../shared/auth/roles.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { assertIdempotencyKey } from './order-rules';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  @Roles(Role.COMMERCE)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(
      user,
      body,
      assertIdempotencyKey(idempotencyKey),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.COMMERCE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.list(user, {
      page: query.page ?? 0,
      size: query.size ?? 20,
      status: query.status,
      commerceId: query.commerceId,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COMMERCE)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.getById(user, id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user, id, body.status);
  }
}
