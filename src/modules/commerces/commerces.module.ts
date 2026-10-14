import { Module } from '@nestjs/common';

import { CommercesController } from './commerces.controller';
import { CommercesService } from './commerces.service';

@Module({
  controllers: [CommercesController],
  providers: [CommercesService],
  exports: [CommercesService],
})
export class CommercesModule {}
