import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../shared/auth/roles.decorator';
import { CategoriesService } from './categories.services';
import { CreateCategoryDto } from './dto/create-category.dto';

/**
 * Expone las operaciones HTTP de categorías.
 * El prefijo global /api se configura en main.ts.
 *
 * JwtAuthGuard y RolesGuard están registrados globalmente.
 */
@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /api/categories
   * Disponible para administradores y comercios.
   */
  @Get()
  @Roles(Role.ADMIN, Role.COMMERCE)
  listCategories() {
    return this.categoriesService.listCategories();
  }

  /**
   * POST /api/categories
   * Exclusivo del administrador.
   * La validación del cuerpo la realiza el ValidationPipe global.
   */
  @Post()
  @Roles(Role.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto.name);
  }
}