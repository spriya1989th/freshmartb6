import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';
import { StockMovementService } from '../../common/services/stock-movement.service';
import { AuditService } from '../../common/services/audit.service';
import { ReturnReason, StockMovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private stockMovement: StockMovementService,
    private audit: AuditService,
  ) {}

  async adjust(data: {
    productId: string; warehouseId?: string; movementType: StockMovementType;
    quantity: number; reason: ReturnReason | string; notes?: string;
    batchNumber?: string; expiryDate?: string;
  }, userId: string, branchId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: data.productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');

    const warehouseId = data.warehouseId ?? (await this.prisma.warehouse.findFirst({ where: { branchId, isDefault: true } }))?.id;
    if (!warehouseId) throw new BadRequestException('No warehouse configured');

    const docNumber = await this.sequence.next(branchId, 'STOCK_ADJUSTMENT');
    const isIncrease = ['ADJUSTMENT_INCREASE', 'OPENING_STOCK', 'TRANSFER_IN', 'SALES_RETURN', 'PURCHASE_RECEIVE'].includes(data.movementType);

    // Validate: don't allow negative stock result
    if (!isIncrease) {
      const current = await this.stockMovement.getCurrentStock(data.productId, branchId);
      if (current < data.quantity) throw new BadRequestException(`Insufficient stock. Current: ${current.toFixed(0)}, Requested: ${data.quantity}`);
    }

    await this.stockMovement.record({
      productId: data.productId, branchId, warehouseId,
      unitId: product.baseUnitId,
      movementType: data.movementType as StockMovementType,
      direction: isIncrease ? 'IN' : 'OUT',
      quantity: data.quantity,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      sourceModule: 'ADJUSTMENT',
      referenceType: 'StockAdjustment',
      referenceNum: docNumber,
      notes: data.notes,
      returnReason: data.reason as ReturnReason,
      createdById: userId,
    });

    await this.audit.log({ userId, action: 'STOCK_ADJUST', module: 'inventory', entityId: data.productId, entityType: 'Product', newValues: { movementType: data.movementType, quantity: data.quantity, reason: data.reason, docNumber }, branchId });
    return { docNumber, success: true };
  }

  async bulkAdjust(items: Array<{ productId: string; movementType: StockMovementType; quantity: number; reason: string; notes?: string }>, userId: string, branchId: string) {
    const docNumber = await this.sequence.next(branchId, 'STOCK_ADJUSTMENT');
    const warehouseId = (await this.prisma.warehouse.findFirst({ where: { branchId, isDefault: true } }))?.id;
    if (!warehouseId) throw new BadRequestException('No warehouse configured');

    for (const item of items) {
      const product = await this.prisma.product.findFirst({ where: { id: item.productId, deletedAt: null } });
      if (!product) continue;
      const isIncrease = ['ADJUSTMENT_INCREASE', 'OPENING_STOCK', 'TRANSFER_IN'].includes(item.movementType);
      await this.stockMovement.record({
        productId: item.productId, branchId, warehouseId,
        unitId: product.baseUnitId, movementType: item.movementType,
        direction: isIncrease ? 'IN' : 'OUT', quantity: item.quantity,
        sourceModule: 'BULK_ADJUSTMENT', referenceNum: docNumber,
        notes: item.notes, returnReason: item.reason as any, createdById: userId,
      });
    }

    await this.audit.log({ userId, action: 'STOCK_ADJUST', module: 'inventory', newValues: { docNumber, itemCount: items.length, type: 'BULK' }, branchId });
    return { docNumber, success: true };
  }

  async getStockTake(branchId: string) {
    return this.stockMovement.getLowStockProducts(branchId);
  }
}
