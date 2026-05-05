import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, CurrentUser, BranchId } from '../../common/guards/jwt.guard';

// ── SALES ────────────────────────────────────────────────────
import { SalesService } from './sales.service';
@Controller('sales') @UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private svc: SalesService) {}
  @Get()    list(@Query() q: any, @BranchId() b: string)   { return this.svc.findAll(b, { search: q.search, status: q.status, period: q.period, page: +q.page || 1, perPage: +q.perPage || 25 }); }
  @Get(':id') get(@Param('id') id: string)                  { return this.svc.findById(id); }
  @Post()  @HttpCode(201) create(@Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.create(body, u.id, b); }
  @Post(':id/void')  void_(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.voidSale(id, body.reason, u.id, b); }
  @Post(':id/return') return_(@Param('id') id: string, @Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.processReturn(id, body.items, u.id, b, body.warehouseId); }
}

// ── PURCHASES ────────────────────────────────────────────────
import { PurchasesService } from './purchases.service';
@Controller('purchases') @UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private svc: PurchasesService) {}
  @Get()    list(@Query() q: any, @BranchId() b: string)      { return this.svc.findAll(b, { supplierId: q.supplierId, status: q.status, search: q.search, page: +q.page || 1, perPage: +q.perPage || 20 }); }
  @Get(':id') get(@Param('id') id: string)                     { return this.svc.findById(id); }
  @Post()  @HttpCode(201) create(@Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.create(body, u.id, b); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return { id, ...body }; }
  @Post(':id/receive') receive(@Param('id') id: string, @Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.receive(id, body, u.id, b); }
}

// ── INVENTORY ────────────────────────────────────────────────
import { InventoryService } from './inventory.service';
@Controller('inventory') @UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private svc: InventoryService) {}
  @Post('adjust') @HttpCode(200) adjust(@Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.adjust(body, u.id, b); }
  @Post('bulk-adjust') @HttpCode(200) bulkAdjust(@Body() body: { items: any[] }, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.bulkAdjust(body.items, u.id, b); }
  @Get('low-stock') lowStock(@BranchId() b: string) { return this.svc.getStockTake(b); }
}

// ── CUSTOMERS ────────────────────────────────────────────────
import { CustomersService } from './customers.service';
@Controller('customers') @UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private svc: CustomersService) {}
  @Get()    list(@Query() q: any, @BranchId() b: string)   { return this.svc.findAll(b, { search: q.search, customerType: q.customerType, page: +q.page || 1, perPage: +q.perPage || 25 }); }
  @Get(':id') get(@Param('id') id: string)                  { return this.svc.findById(id); }
  @Post()   @HttpCode(201) create(@Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.create(body, u.id, b); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any, @CurrentUser() u: any) { return this.svc.update(id, body, u.id); }
  @Get(':id/ledger') ledger(@Param('id') id: string, @Query() q: any) { return this.svc.getLedger(id, { period: q.period, from: q.from, to: q.to }); }
  @Post(':id/payment') payment(@Param('id') id: string, @Body() body: { amount: number; method: string }, @CurrentUser() u: any) { return this.svc.recordPayment(id, body, u.id); }
}

// ── SUPPLIERS ────────────────────────────────────────────────
import { PrismaService } from '../../common/services/prisma.service';
@Controller('suppliers') @UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private prisma: PrismaService) {}
  @Get() list(@Query() q: any) {
    const page = +q.page || 1; const perPage = +q.perPage || 25;
    const where: any = { deletedAt: null, ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}) };
    return Promise.all([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, take: perPage, skip: (page - 1) * perPage }),
      this.prisma.supplier.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) }));
  }
  @Get(':id') get(@Param('id') id: string) { return this.prisma.supplier.findUniqueOrThrow({ where: { id } }); }
  @Post()  @HttpCode(201) create(@Body() body: any) {
    return this.prisma.supplier.count().then(count =>
      this.prisma.supplier.create({ data: { ...body, code: `SUPP-${String(count + 1).padStart(4, '0')}` } })
    );
  }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.prisma.supplier.update({ where: { id }, data: body }); }
}

// ── CATEGORIES ───────────────────────────────────────────────
@Controller('categories') @UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private prisma: PrismaService) {}
  @Get()  list() { return this.prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }).then(items => ({ items })); }
  @Post() @HttpCode(201) create(@Body() body: any) { return this.prisma.category.create({ data: body }); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.prisma.category.update({ where: { id }, data: body }); }
  @Delete(':id') remove(@Param('id') id: string) { return this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } }); }
}

// ── BRANDS ───────────────────────────────────────────────────
@Controller('brands') @UseGuards(JwtAuthGuard)
export class BrandsController {
  constructor(private prisma: PrismaService) {}
  @Get()  list() { return this.prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }).then(items => ({ items })); }
  @Post() @HttpCode(201) create(@Body() body: any) { return this.prisma.brand.create({ data: body }); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.prisma.brand.update({ where: { id }, data: body }); }
  @Delete(':id') remove(@Param('id') id: string) { return this.prisma.brand.update({ where: { id }, data: { deletedAt: new Date() } }); }
}

// ── UNITS ────────────────────────────────────────────────────
@Controller('units') @UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private prisma: PrismaService) {}
  @Get()  list() { return this.prisma.unit.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }).then(items => ({ items })); }
  @Post() @HttpCode(201) create(@Body() body: any) { return this.prisma.unit.create({ data: body }); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.prisma.unit.update({ where: { id }, data: body }); }
  @Get('conversions') conversions() { return this.prisma.unitConversion.findMany({ include: { fromUnit: true, toUnit: true } }); }
  @Post('conversions') @HttpCode(201) createConversion(@Body() body: any) { return this.prisma.unitConversion.create({ data: body }); }
}

// ── SHIFTS ───────────────────────────────────────────────────
import { ShiftsService } from './shifts.service';
@Controller('shifts') @UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private svc: ShiftsService) {}
  @Get('active') active(@CurrentUser() u: any, @BranchId() b: string) { return this.svc.getActive(u.id, b); }
  @Get()    list(@Query() q: any, @BranchId() b: string) { return this.svc.list(b, { page: +q.page || 1, perPage: +q.perPage || 20, status: q.status }); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.getReport(id); }
  @Post('open')  @HttpCode(201) open(@Body() body: { openingCash: number }, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.open(body, u.id, b); }
  @Post(':id/close')  close(@Param('id') id: string, @Body() body: any, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.close(id, body, u.id, b); }
  @Post(':id/cash-movement') cashMove(@Param('id') id: string, @Body() body: any, @CurrentUser() u: any) { return this.svc.addCashMovement(id, body, u.id); }
}

// ── REPORTS ──────────────────────────────────────────────────
import { ReportsService } from './reports.service';
@Controller('reports') @UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private svc: ReportsService) {}
  @Get('dashboard')    dashboard(@Query() q: any, @BranchId() b: string)     { return this.svc.getDashboardStats(b, q.period); }
  @Get('sales-chart')  chart(@Query() q: any, @BranchId() b: string)         { return this.svc.getSalesByPeriod(b, q.groupBy, q.period); }
  @Get('best-selling') bestSelling(@Query() q: any, @BranchId() b: string)   { return this.svc.getBestSellingProducts({ branchId: b, period: q.period, from: q.from, to: q.to, sortBy: q.sortBy, topN: +q.topN || 25, page: +q.page || 1, perPage: +q.perPage || 25, categoryId: q.categoryId, brandId: q.brandId }); }
  @Get('stock')        stock(@Query() q: any, @BranchId() b: string)          { return this.svc.getStockReport(b, { categoryId: q.categoryId, lowStockOnly: q.lowStockOnly === 'true', page: +q.page || 1, perPage: +q.perPage || 50 }); }
  @Get('expiry')       expiry(@Query() q: any, @BranchId() b: string)         { return this.svc.getExpiryReport(b, +q.daysAhead || 90); }
  @Get('pnl')          pnl(@Query() q: any, @BranchId() b: string)            { return this.svc.getProfitAndLoss(b, q.period, q.from, q.to); }
  @Get('tax')          tax(@Query() q: any, @BranchId() b: string)            { return this.svc.getTaxReport(b, q.period, q.from, q.to); }
  @Get('shift/:id')    shift(@Param('id') id: string)                         { return this.svc.getShiftReport(id); }
  @Get('customer-ledger/:id') custLedger(@Param('id') id: string, @Query() q: any) { return this.svc.getCustomerLedger(id, q.period, q.from, q.to); }
  @Get('supplier-ledger/:id') suppLedger(@Param('id') id: string, @Query() q: any, @BranchId() b: string) { return this.svc.getSupplierLedger(id, b, q.period, q.from, q.to); }
}

// ── SETTINGS ─────────────────────────────────────────────────
import { SettingsService } from './settings.service';
@Controller('settings') @UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private svc: SettingsService) {}
  @Get()    getAll(@Query() q: any, @BranchId() b: string)               { return this.svc.getAll(b, q.group); }
  @Put()    update(@Body() body: Record<string, string>, @CurrentUser() u: any, @BranchId() b: string) { return this.svc.updateMany(b, body, u.id); }
  @Get('backup') async backup(@BranchId() b: string, @CurrentUser() u: any, @Res() res: any) {
    const data = await this.svc.backup(b, u.id);
    const filename = `freshmart-backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);
  }
  @Post('restore') restore(@Body() body: any, @BranchId() b: string, @CurrentUser() u: any) { return this.svc.restore(b, body, u.id); }
}

// ── IMPORT ───────────────────────────────────────────────────
@Controller('import') @UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private prisma: PrismaService) {}
  @Get('jobs')    listJobs(@CurrentUser() u: any) { return this.prisma.importJob.findMany({ where: { createdById: u.id }, orderBy: { createdAt: 'desc' }, take: 20 }); }
  @Get('jobs/:id') getJob(@Param('id') id: string) { return this.prisma.importJob.findUniqueOrThrow({ where: { id }, include: { rows: { where: { status: 'failed' }, take: 50 } } }); }
  // File upload handled by separate import.service (use multer + xlsx parsing)
  @Post('products') @HttpCode(202) importProducts(@CurrentUser() u: any, @BranchId() b: string) {
    return this.prisma.importJob.create({ data: { branchId: b, createdById: u.id, entityType: 'products', fileName: 'uploaded.csv', status: 'PENDING' } });
  }
}

// Missing Put import
import { Put } from '@nestjs/common';
