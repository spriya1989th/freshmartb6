import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';
import { StockMovementService } from '../../common/services/stock-movement.service';
import { CostHistoryService } from '../../common/services/cost-history.service';
import { AuditService } from '../../common/services/audit.service';
import { PurchaseStatus } from '@prisma/client';

interface PurchaseItemDto {
  productId: string; unitId: string; orderedQty: number; costPerUnit: number;
  batchNumber?: string; expiryDate?: string; sellingPrice?: number;
}

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private stockMovement: StockMovementService,
    private costHistory: CostHistoryService,
    private audit: AuditService,
  ) {}

  async create(data: { supplierId?: string; orderDate: string; supplierRef?: string; warehouseId?: string; items: PurchaseItemDto[]; notes?: string }, userId: string, branchId: string) {
    const docNumber = await this.sequence.next(branchId, 'PURCHASE');
    const items = data.items;
    const subtotal = items.reduce((s, i) => s + i.orderedQty * i.costPerUnit, 0);

    const purchase = await this.prisma.purchase.create({
      data: {
        branchId, supplierId: data.supplierId, createdById: userId, docNumber,
        supplierRef: data.supplierRef, warehouseId: data.warehouseId,
        orderDate: new Date(data.orderDate), status: 'DRAFT',
        subtotal, taxAmount: 0, discountAmount: 0, totalAmount: subtotal, paidAmount: 0,
        notes: data.notes,
        items: {
          create: items.map(i => ({
            productId: i.productId, unitId: i.unitId,
            orderedQty: i.orderedQty, receivedQty: 0, baseQty: 0,
            costPerUnit: i.costPerUnit, lineTotal: i.orderedQty * i.costPerUnit,
            batchNumber: i.batchNumber, expiryDate: i.expiryDate ? new Date(i.expiryDate) : undefined,
            sellingPrice: i.sellingPrice,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.log({ userId, action: 'CREATE', module: 'purchases', entityId: purchase.id, entityType: 'Purchase', newValues: { docNumber, totalAmount: subtotal }, branchId });
    return purchase;
  }

  async receive(purchaseId: string, receiveData: { items: Array<{ purchaseItemId: string; receivedQty: number; expiryDate?: string; batchNumber?: string }> }, userId: string, branchId: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id: purchaseId }, include: { items: { include: { product: true, unit: true } } } });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status === 'RECEIVED' || purchase.status === 'CANCELLED') throw new BadRequestException('Cannot receive — purchase is already ' + purchase.status);

    const warehouseId = purchase.warehouseId ?? (await this.prisma.warehouse.findFirst({ where: { branchId, isDefault: true } }))?.id;
    if (!warehouseId) throw new BadRequestException('No warehouse configured for this branch');

    await this.prisma.$transaction(async (tx) => {
      for (const recv of receiveData.items) {
        const item = purchase.items.find(i => i.id === recv.purchaseItemId);
        if (!item) continue;
        if (recv.receivedQty <= 0) continue;

        // Update purchase item received qty
        await tx.purchaseItem.update({
          where: { id: recv.purchaseItemId },
          data: {
            receivedQty: { increment: recv.receivedQty },
            baseQty: { increment: recv.receivedQty },
            expiryDate: recv.expiryDate ? new Date(recv.expiryDate) : undefined,
            batchNumber: recv.batchNumber,
          },
        });

        // Record stock movement
        await this.stockMovement.record({
          productId: item.productId, branchId, warehouseId,
          unitId: item.unitId, movementType: 'PURCHASE_RECEIVE', direction: 'IN',
          quantity: recv.receivedQty, costPerUnit: Number(item.costPerUnit),
          batchNumber: recv.batchNumber, expiryDate: recv.expiryDate ? new Date(recv.expiryDate) : undefined,
          sourceModule: 'PURCHASE', referenceId: purchase.id, referenceType: 'Purchase', referenceNum: purchase.docNumber,
          createdById: userId,
        }, tx);

        // Update product cost if changed
        if (Number(item.costPerUnit) !== Number(item.product.purchasePrice)) {
          await this.costHistory.record({
            productId: item.productId, supplierId: purchase.supplierId ?? undefined,
            branchId, changedById: userId, purchaseRef: purchase.docNumber,
            oldCost: Number(item.product.purchasePrice), newCost: Number(item.costPerUnit),
            source: 'purchase',
          }, tx);
          await tx.product.update({ where: { id: item.productId }, data: { purchasePrice: item.costPerUnit } });
        }

        // Update selling price if provided
        if (item.sellingPrice && Number(item.sellingPrice) !== Number(item.product.sellingPrice)) {
          await tx.product.update({ where: { id: item.productId }, data: { sellingPrice: item.sellingPrice } });
        }
      }

      // Update purchase status
      const allItems = await tx.purchaseItem.findMany({ where: { purchaseId } });
      const fullyReceived = allItems.every(i => Number(i.receivedQty) >= Number(i.orderedQty));
      const anyReceived   = allItems.some(i =>  Number(i.receivedQty) > 0);
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: fullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL_RECEIVED' : 'DRAFT', receivedDate: new Date() },
      });
    });

    await this.audit.log({ userId, action: 'UPDATE', module: 'purchases', entityId: purchaseId, entityType: 'Purchase', newValues: { action: 'receive' }, branchId });
    return this.findById(purchaseId);
  }

  async findAll(branchId: string, filters: { supplierId?: string; status?: string; search?: string; page?: number; perPage?: number }) {
    const page = filters.page ?? 1; const perPage = filters.perPage ?? 20;
    const where: any = {
      branchId,
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.status     ? { status:     filters.status     } : {}),
      ...(filters.search     ? { docNumber:  { contains: filters.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({ where, include: { supplier: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { orderDate: 'desc' }, take: perPage, skip: (page - 1) * perPage }),
      this.prisma.purchase.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async findById(id: string) {
    const p = await this.prisma.purchase.findFirst({
      where: { id },
      include: { supplier: true, createdBy: { select: { firstName: true, lastName: true } }, items: { include: { product: { select: { name: true, sku: true, purchasePrice: true, sellingPrice: true } }, unit: { select: { abbreviation: true, name: true } } } } },
    });
    if (!p) throw new NotFoundException('Purchase not found');
    return p;
  }
}
