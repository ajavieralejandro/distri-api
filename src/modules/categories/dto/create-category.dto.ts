import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Define los datos que esperamos recibir para crear una categoría.
// DTO significa "objeto de transferencia de datos".
export class CreateCategoryDto {
  // Si el valor es texto, elimina espacios al principio y al final.
  // Por ejemplo: "  Bebidas  " → "Bebidas".
  // Si llega otro tipo de dato, lo deja para que la validación lo rechace.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )

  // Exige que el nombre sea un string.
  // Rechaza valores como 123, null o un objeto.
  @IsString()

  // Después de quitar los espacios, debe tener entre 1 y 100 caracteres.
  // Así también rechazamos un nombre vacío o compuesto solo por espacios.
  @Length(1, 100)

  // Declara la propiedad "name" como string.
  // El signo ! le indica a TypeScript que se asignará al procesar la petición.
  // No genera ningún valor ni reemplaza las validaciones anteriores.
  name!: string;
}