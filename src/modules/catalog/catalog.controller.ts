import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../shared/auth/roles.decorator';
import { CatalogService } from './catalog.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

/**
 * Consultas del catálogo de productos.
 *
 * Permite el acceso a administradores y comercios.
 * CatalogService realiza las consultas a la base de datos.
 */
@ApiTags('catalog')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COMMERCE)
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/products
   *
   * Lista productos activos con paginación.
   * Permite buscar por texto y filtrar por categoría.
   * La primera página es 0; el tamaño predeterminado es 20.
   */
  @Get('products')
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts({
      page: query.page ?? 0,
      size: query.size ?? 20,
      search: query.search,
      categoryId: query.categoryId,
    });
  }

  /**
   * GET /api/products/:id
   *
   * Devuelve un producto activo a partir de su ID.
   * El servicio responde con 404 si no lo encuentra.
   */
  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalogService.getProduct(id);
  }
}