import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PriceType, Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

interface RecordPriceChangeParams {
  productId: string; priceType: PriceType; oldPrice: number; newPrice: number;
  changedById: string; branchId?: string;
  source: 'manual' | 'purchase' | 'promotion' | 'pos_override' | 'import';
  reason?: string; invoiceRef?: string;
}

@Injectable()
export class PriceHistoryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async record(p: RecordPriceChangeParams, tx?: Prisma.TransactionClient): Promise<void> {
    if (Math.abs(Number(p.oldPrice) - Number(p.newPrice)) < 0.001) return;
    const db = tx ?? this.prisma;
    await db.productPriceHistory.create({
      data: { productId: p.productId, branchId: p.branchId, changedById: p.changedById, priceType: p.priceType, oldPrice: p.oldPrice, newPrice: p.newPrice, reason: p.reason, source: p.source, invoiceRef: p.invoiceRef },
    });
    await this.audit.log({ userId: p.changedById, action: 'PRICE_OVERRIDE', module: 'products', entityId: p.productId, entityType: 'Product', oldValues: { price: p.oldPrice, type: p.priceType }, newValues: { price: p.newPrice, type: p.priceType, source: p.source }, branchId: p.branchId });
  }

  async updateSellingPrice(productId: string, newPrice: number, changedById: string, opts: { branchId?: string; reason?: string; source?: string } = {}): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      await this.record({ productId, priceType: 'SELLING', oldPrice: Number(p.sellingPrice), newPrice, changedById, branchId: opts.branchId, source: (opts.source as any) ?? 'manual', reason: opts.reason }, tx);
      await tx.product.update({ where: { id: productId }, data: { sellingPrice: newPrice } });
    });
  }

  async updateWholesalePrice(productId: string, newPrice: number, changedById: string, opts: { branchId?: string; reason?: string } = {}): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      await this.record({ productId, priceType: 'WHOLESALE', oldPrice: Number(p.wholesalePrice ?? 0), newPrice, changedById, branchId: opts.branchId, source: 'manual', reason: opts.reason }, tx);
      await tx.product.update({ where: { id: productId }, data: { wholesalePrice: newPrice } });
    });
  }

  async getHistory(productId: string, priceType?: PriceType) {
    return this.prisma.productPriceHistory.findMany({
      where: { productId, ...(priceType ? { priceType } : {}) },
      include: { changedBy: { select: { firstName: true, lastName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
