import { Module } from '@nestjs/common';

import { CommercesModule } from '../commerces/commerces.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [CommercesModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
