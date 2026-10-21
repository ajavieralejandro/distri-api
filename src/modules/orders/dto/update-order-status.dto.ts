import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsIn(['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERED', 'CANCELLED'])
  status!: OrderStatus;
}
