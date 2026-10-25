import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { money } from '../../shared/money/money';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

/**
 * Gestiona la creación de productos.
 *
 * El DTO valida los campos recibidos.
 * Este servicio comprueba las reglas que dependen de la base de datos.
 * El controlador restringirá la operación al administrador.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un producto asociado a una categoría existente.
   *
   * Prisma genera el ID, las fechas y active=true.
   * El stock recibido corresponde únicamente a las existencias iniciales.
   */
  async createProduct(input: CreateProductDto) {
    // Consultamos solo el ID: basta para comprobar la existencia.
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new AppException(
        'La categoría seleccionada no existe.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      );
    }

    try {
      const product = await this.prisma.product.create({
        // Asignación explícita para controlar qué campos se pueden guardar.
        data: {
          sku: input.sku,
          name: input.name,
          description: input.description,
          categoryId: category.id,
          brand: input.brand,
          unit: input.unit,
          presentation: input.presentation,
          priceCents: input.priceCents,
          availableStock: input.availableStock,
        },
      });

      // Conservamos el formato de respuesta que ya utiliza el catálogo:
      // price contiene el importe decimal como texto y la moneda ARS.
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        brand: product.brand,
        unit: product.unit,
        presentation: product.presentation,
        price: money(product.priceCents),
        availableStock: product.availableStock,
        active: product.active,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // La restricción única protege también frente a dos solicitudes
        // simultáneas que intenten crear el mismo SKU.
        if (error.code === 'P2002') {
          throw new AppException(
            'Ya existe un producto con ese SKU.',
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT,
          );
        }

        // La clave foránea protege la relación si la categoría fue
        // eliminada entre la comprobación inicial y la creación.
        if (error.code === 'P2003') {
          throw new AppException(
            'La categoría seleccionada ya no está disponible.',
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT,
          );
        }
      }

      // Los errores inesperados se propagan al filtro global.
      throw error;
    }
  }
}