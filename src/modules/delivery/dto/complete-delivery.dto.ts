import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';

export class CompleteDeliveryDto {
  @ApiPropertyOptional({
    type: CreatePaymentDto,
    description:
      'Pago recibido al entregar. Omitir si no se recibió dinero.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePaymentDto)
  payment?: CreatePaymentDto;
}