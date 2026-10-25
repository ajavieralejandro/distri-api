import { Module } from '@nestjs/common';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.services';

/**
 * Agrupa las operaciones de categorías.
 * Exporta el servicio para que otros módulos puedan reutilizarlo
 * importando CategoriesModule cuando lo necesiten.
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}