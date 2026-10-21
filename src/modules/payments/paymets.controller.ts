import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Roles } from '../../shared/auth/roles.decorator';
import { assertIdempotencyKey } from '../orders/order-rules';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { toPaymentView } from './payment.mapper';
import { PaymentsService } from './paymets.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('orders/:id/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @HttpCode(201)
  @Roles(Role.ADMIN)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID que debe conservarse al reintentar el mismo pago.',
  })
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() body: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const payment = await this.paymentsService.register(
      user,
      orderId,
      body,
      assertIdempotencyKey(idempotencyKey),
    );

    return toPaymentView(payment);
  }
}