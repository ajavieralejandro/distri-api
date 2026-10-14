import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../shared/auth/roles.decorator';
import { CatalogService } from './catalog.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COMMERCE)
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('products')
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts({
      page: query.page ?? 0,
      size: query.size ?? 20,
      search: query.search,
      categoryId: query.categoryId,
    });
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalogService.getProduct(id);
  }
}
