import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

interface RecordCostChangeParams {
  productId: string; oldCost: number; newCost: number; changedById: string;
  supplierId?: string; branchId?: string; purchaseRef?: string;
  source: 'purchase' | 'manual' | 'landed_cost' | 'import'; notes?: string;
}

@Injectable()
export class CostHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(p: RecordCostChangeParams, tx?: Prisma.TransactionClient): Promise<void> {
    if (Math.abs(Number(p.oldCost) - Number(p.newCost)) < 0.001) return;
    const db = tx ?? this.prisma;
    await db.productCostHistory.create({
      data: { productId: p.productId, supplierId: p.supplierId, branchId: p.branchId, changedById: p.changedById, purchaseRef: p.purchaseRef, oldCost: p.oldCost, newCost: p.newCost, source: p.source, notes: p.notes },
    });
  }

  async updateCost(productId: string, newCost: number, changedById: string, opts: { supplierId?: string; branchId?: string; purchaseRef?: string; source?: RecordCostChangeParams['source']; notes?: string } = {}): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      await this.record({ productId, oldCost: Number(p.purchasePrice), newCost, changedById, ...opts, source: opts.source ?? 'purchase' }, tx);
      await tx.product.update({ where: { id: productId }, data: { purchasePrice: newCost } });
    });
  }

  async getHistory(productId: string) {
    return this.prisma.productCostHistory.findMany({
      where: { productId },
      include: { changedBy: { select: { firstName: true, lastName: true } }, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
