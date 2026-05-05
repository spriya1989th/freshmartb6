// ============================================================
// FRESHMART ERP — ALL API CONTROLLERS
// Each controller in its own section for clarity
// ============================================================

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Res, UploadedFile, UseInterceptors, HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';

import { JwtAuthGuard, PermissionGuard, CurrentUser, BranchId, Public, RequirePermission } from '../common/guards/jwt.guard';
import { AuthService }      from './auth/auth.service';
import { ProductsService }  from './products/products.service';
import { SalesService }     from './sales/sales.service';
import { PurchasesService } from './purchases/purchases.service';
import { InventoryService } from './inventory/inventory.service';
import { CustomersService } from './customers/customers.service';
import { ShiftsService }    from './shifts/shifts.service';
import { ReportsService }   from './reports/reports.service';
import { SettingsService }  from './settings/settings.service';

// ── AUTH CONTROLLER ──────────────────────────────────────────
// File: src/modules/auth/auth.controller.ts
export { AuthController } from './auth/auth.controller';
export { ProductsController } from './products/products.controller';
export { SalesController } from './sales/sales.controller';
export { PurchasesController } from './purchases/purchases.controller';
export { InventoryController } from './inventory/inventory.controller';
export { CustomersController } from './customers/customers.controller';
export { ShiftsController } from './shifts/shifts.controller';
export { ReportsController } from './reports/reports.controller';
export { SettingsController } from './settings/settings.controller';
