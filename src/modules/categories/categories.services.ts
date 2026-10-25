import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { PrismaService } from '../../shared/prisma/prisma.service';

/**
 * Representación de una categoría que devuelve la API.
 * El cliente utiliza el ID para filtrar o asociar productos.
 */
export type CategoryView = {
  id: string;
  name: string;
};

/**
 * Gestiona la persistencia de categorías.
 * Los permisos HTTP se comprueban en el controlador mediante RolesGuard.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve las categorías ordenadas alfabéticamente.
   * Solo expone los campos necesarios para el catálogo.
   */
  listCategories(): Promise<CategoryView[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  /**
   * Guarda una categoría con el nombre validado por el DTO.
   * Prisma genera automáticamente el ID y las fechas.
   */
  async createCategory(name: string): Promise<CategoryView> {
    try {
      return await this.prisma.category.create({
        data: { name },
        select: { id: true, name: true },
      });
    } catch (error) {
      // La restricción @unique de Category.name impide repetir
      // exactamente el mismo nombre, incluso con solicitudes simultáneas.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'Ya existe una categoría con ese nombre.',
          HttpStatus.CONFLICT,
          ErrorCode.CONFLICT,
        );
      }

      // Los errores inesperados llegan al filtro global de la aplicación.
      throw error;
    }
  }
}