import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import configuration, { validateEnv } from './config/configuration';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommercesModule } from './modules/commerces/commerces.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard';
import { RolesGuard } from './shared/auth/roles.guard';
import { AppLoggerModule } from './shared/logging/app-logger.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CategoriesModule } from './modules/categories/categories.modules';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    AppLoggerModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    CommercesModule,
    OrdersModule,
    AccountModule,
    PaymentsModule,
    DeliveryModule,
    CategoriesModule

  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
