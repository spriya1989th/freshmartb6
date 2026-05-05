// ── PRODUCTS CONTROLLER ──────────────────────────────────────
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, BranchId } from '../../common/guards/jwt.guard';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  findAll(@Query() q: any, @BranchId() branchId: string) {
    return this.svc.findAll(branchId, { search: q.search, categoryId: q.categoryId, brandId: q.brandId, status: q.status, page: +q.page || 1, perPage: +q.perPage || 25 });
  }

  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string) { return this.svc.findByBarcode(barcode); }

  @Get(':id')
  findOne(@Param('id') id: string, @BranchId() branchId: string) { return this.svc.findById(id, branchId); }

  @Get(':id/price-history')
  priceHistory(@Param('id') id: string) { return this.svc['priceHistory'].getHistory(id); }

  @Get(':id/cost-history')
  costHistory(@Param('id') id: string) { return this.svc['costHistory'].getHistory(id); }

  @Get(':id/movements')
  movements(@Param('id') id: string, @Query() q: any, @BranchId() branchId: string) {
    return this.svc['stockMovement'].getProductMovements(id, branchId, {}, +q.page || 1, +q.perPage || 50);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any, @BranchId() branchId: string) {
    return this.svc.create(body, user.id, branchId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @BranchId() branchId: string) {
    return this.svc.update(id, body, user.id, branchId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any, @BranchId() branchId: string) {
    return this.svc.softDelete(id, user.id, branchId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @BranchId() branchId: string) {
    return this.svc.duplicate(id, body.sku, body.barcodes ?? [], user.id, branchId);
  }

  @Post(':id/barcodes')
  addBarcode(@Param('id') id: string, @Body() body: { barcode: string }, @CurrentUser() user: any) {
    return this.svc.addBarcode(id, body.barcode, user.id);
  }
}
