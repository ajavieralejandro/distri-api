import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    type: String,
    example: '20000.00',
    description: 'Importe en ARS, con punto y hasta dos decimales.',
  })
  @IsString()
  @MaxLength(11)
  @Matches(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/, {
    message: 'amount debe ser un importe con hasta dos decimales.',
  })
  amount!: string;

  @ApiProperty({
    enum: ['CASH'],
    example: 'CASH',
    description: 'Medio de pago admitido en este primer alcance.',
  })
  @IsIn(['CASH'])
  method!: 'CASH';
}