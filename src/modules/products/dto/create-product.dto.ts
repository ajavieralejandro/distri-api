import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductUnit } from '@prisma/client';

/**
 * Elimina espacios al principio y al final.
 * No convierte números, objetos u otros valores en texto.
 */
function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Datos necesarios para crear un producto.
 *
 * El ID, las fechas y el estado activo inicial los genera Prisma.
 * La categoría se recibe por su ID; el servicio verificará que exista.
 * La foto se cargará mediante una operación independiente.
 */
export class CreateProductDto {
  /** Código comercial único. Es diferente del ID interno del producto. */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @Length(1, 100)
  sku!: string;

  /** Nombre que aparecerá en el catálogo. */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @Length(1, 200)
  name!: string;

  /** Descripción del producto. Se permite enviar una cadena vacía. */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @MaxLength(2000)
  description!: string;

  /** ID de la categoría seleccionada en el formulario. */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @Length(1, 100)
  categoryId!: string;

  /** Marca comercial. Se permite enviar una cadena vacía. */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  brand!: string;

  /** Unidad de venta: UNIT (unidad), PACK (paquete) o BOX (caja). */
  @Type(() => Object)
  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  /** Presentación comercial, por ejemplo: "Botella de 1 litro". */
  @Type(() => Object)
  @Transform(trimText)
  @IsString()
  @Length(1, 200)
  presentation!: string;

  /**
   * Precio entero en centavos de ARS.
   * Ejemplo: 150050 representa $1500,50.
   * El límite corresponde al tipo Int de PostgreSQL.
   */
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  priceCents!: number;

  /**
   * Stock inicial contado en unidades de venta.
   * Si unit es BOX, 10 representa diez cajas.
   * Los ajustes posteriores tendrán su operación de inventario.
   */
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  availableStock!: number;
}