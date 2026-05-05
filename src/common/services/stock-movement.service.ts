import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma, StockMovementType, StockMovementDirection, ReturnReason } from '@prisma/client';
import Decimal from 'decimal.js';

export interface StockMovementParams {
  productId: string; branchId: string; warehouseId: string;
  unitId: string; movementType: StockMovementType;
  direction: StockMovementDirection; quantity: number;
  costPerUnit?: number; batchNumber?: string; expiryDate?: Date;
  sourceModule: string; referenceId?: string; referenceType?: string;
  referenceNum?: string; notes?: string; returnReason?: ReturnReason;
  createdById: string;
}

@Injectable()
export class StockMovementService {
  constructor(private readonly prisma: PrismaService) {}

  private async toBaseQty(productId: string, unitId: string, qty: number, tx: Prisma.TransactionClient): Promise<number> {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { baseUnitId: true } });
    if (product.baseUnitId === unitId) return qty;
    const conv = await tx.unitConversion.findFirst({ where: { fromUnitId: unitId, toUnitId: product.baseUnitId } });
    if (!conv) throw new BadRequestException(`No unit conversion from unit ${unitId} to base unit of product ${productId}`);
    return new Decimal(qty).mul(conv.ratio).toDecimalPlaces(4).toNumber();
  }

  async record(params: StockMovementParams, tx?: Prisma.TransactionClient): Promise<void> {
    const run = async (db: Prisma.TransactionClient) => {
      const baseQty = await this.toBaseQty(params.productId, params.unitId, params.quantity, db);
      await db.stockMovement.create({
        data: {
          productId: params.productId, branchId: params.branchId, warehouseId: params.warehouseId,
          unitId: params.unitId, movementType: params.movementType, direction: params.direction,
          quantity: params.quantity, baseQuantity: baseQty, costPerUnit: params.costPerUnit,
          batchNumber: params.batchNumber, expiryDate: params.expiryDate,
          sourceModule: params.sourceModule, referenceId: params.referenceId,
          referenceType: params.referenceType, referenceNum: params.referenceNum,
          notes: params.notes, returnReason: params.returnReason, createdById: params.createdById,
        },
      });
      const delta = params.direction === 'IN' ? baseQty : -baseQty;
      await db.stockBalance.upsert({
        where: { productId_branchId_warehouseId: { productId: params.productId, branchId: params.branchId, warehouseId: params.warehouseId } },
        create: { productId: params.productId, branchId: params.branchId, warehouseId: params.warehouseId, quantity: Math.max(0, delta), reservedQty: 0 },
        update: { quantity: { increment: delta } },
      });
    };
    if (tx) await run(tx);
    else await this.prisma.$transaction(run);
  }

  async recordBulk(movements: StockMovementParams[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const m of movements) await this.record(m, tx);
    });
  }

  async getProductMovements(productId: string, branchId?: string, filters?: {
    from?: Date; to?: Date; movementType?: StockMovementType;
  }, page = 1, perPage = 50) {
    const where: any = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...(filters?.movementType ? { movementType: filters.movementType } : {}),
      ...((filters?.from || filters?.to) ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where, include: { unit: { select: { abbreviation: true } }, createdBy: { select: { firstName: true, lastName: true } }, branch: { select: { name: true } }, warehouse: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: perPage, skip: (page - 1) * perPage,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async getCurrentStock(productId: string, branchId: string): Promise<number> {
    const r = await this.prisma.stockBalance.aggregate({ where: { productId, branchId }, _sum: { quantity: true } });
    return Number(r._sum.quantity ?? 0);
  }

  async getStockByWarehouse(productId: string, branchId: string) {
    return this.prisma.stockBalance.findMany({ where: { productId, branchId }, include: { warehouse: { select: { name: true, code: true } } } });
  }

  async getLowStockProducts(branchId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p."nameAr", p.sku, p."reorderLevel", p."purchasePrice", p."sellingPrice",
             COALESCE(SUM(sb.quantity), 0) as "currentStock",
             b.name as "brandName", c.name as "categoryName"
      FROM products p
      LEFT JOIN stock_balances sb ON sb."productId" = p.id AND sb."branchId" = ${branchId}
      LEFT JOIN brands b ON b.id = p."brandId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE'
      GROUP BY p.id, p.name, p."nameAr", p.sku, p."reorderLevel", p."purchasePrice", p."sellingPrice", b.name, c.name
      HAVING COALESCE(SUM(sb.quantity), 0) <= p."reorderLevel"
      ORDER BY COALESCE(SUM(sb.quantity), 0) ASC
    `;
  }
}
