import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Common services
import { PrismaService }       from './common/services/prisma.service';
import { AuditService }        from './common/services/audit.service';
import { SequenceService }     from './common/services/sequence.service';
import { StockMovementService } from './common/services/stock-movement.service';
import { PriceHistoryService } from './common/services/price-history.service';
import { CostHistoryService }  from './common/services/cost-history.service';
import { ApprovalService }     from './common/services/approval.service';
import { DiscountService }     from './common/services/discount.service';

// Module services
import { AuthService }      from './modules/auth/auth.service';
import { ProductsService }  from './modules/products/products.service';
import { SalesService }     from './modules/sales/sales.service';
import { PurchasesService } from './modules/purchases/purchases.service';
import { InventoryService } from './modules/inventory/inventory.service';
import { CustomersService } from './modules/customers/customers.service';
import { ShiftsService }    from './modules/shifts/shifts.service';
import { ReportsService }   from './modules/reports/reports.service';
import { SettingsService }  from './modules/settings/settings.service';

// Controllers
import { AuthController }      from './modules/auth/auth.controller';
import { ProductsController }  from './modules/products/products.controller';
import { SalesController }     from './modules/sales/sales.controller';
import { PurchasesController } from './modules/purchases/purchases.controller';
import { InventoryController } from './modules/inventory/inventory.controller';
import { CustomersController } from './modules/customers/customers.controller';
import { ShiftsController }    from './modules/shifts/shifts.controller';
import { ReportsController }   from './modules/reports/reports.controller';
import { SettingsController }  from './modules/settings/settings.controller';

const COMMON_SERVICES = [
  PrismaService, AuditService, SequenceService,
  StockMovementService, PriceHistoryService, CostHistoryService,
  ApprovalService, DiscountService,
];

const MODULE_SERVICES = [
  AuthService, ProductsService, SalesService, PurchasesService,
  InventoryService, CustomersService, ShiftsService, ReportsService, SettingsService,
];

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'fallback-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [
    AuthController, ProductsController, SalesController, PurchasesController,
    InventoryController, CustomersController, ShiftsController, ReportsController, SettingsController,
  ],
  providers: [...COMMON_SERVICES, ...MODULE_SERVICES],
})
export class AppModule {}
