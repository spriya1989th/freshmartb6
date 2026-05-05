import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';
import { StockMovementService } from '../../common/services/stock-movement.service';
import { AuditService } from '../../common/services/audit.service';
import { PriceHistoryService } from '../../common/services/price-history.service';
import { ApprovalService } from '../../common/services/approval.service';
import { PaymentMethod, CustomerType, ReturnReason } from '@prisma/client';

interface SaleItemDto {
  productId: string; unitId: string; quantity: number;
  unitPrice: number; discountAmount?: number; discountPercent?: number;
  batchNumber?: string; expiryDate?: Date; priceOverridden?: boolean;
  priceOverrideApprovalId?: string;
}

interface CreateSaleDto {
  customerId?: string; shiftId?: string; warehouseId: string;
  customerType: CustomerType; paymentMethod: PaymentMethod;
  deliveryAddress?: string; deliveryPhone?: string;
  discountAmount?: number; discountPercent?: number;
  paidAmount: number; notes?: string;
  items: SaleItemDto[];
}

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private stockMovement: StockMovementService,
    private audit: AuditService,
    private priceHistory: PriceHistoryService,
    private approval: ApprovalService,
  ) {}

  async create(dto: CreateSaleDto, userId: string, branchId: string) {
    // 1. Validate all items exist and have stock
    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, status: 'ACTIVE', isForSale: true },
      include: { baseUnit: true, saleUnit: true, taxRate: true, barcodes: { where: { deletedAt: null } } },
    });
    if (products.length !== productIds.length) throw new BadRequestException('One or more products not found or inactive');

    // 2. Check stock availability
    for (const item of dto.items) {
      const currentStock = await this.stockMovement.getCurrentStock(item.productId, branchId);
      const itemQty = item.quantity;
      if (currentStock < itemQty) {
        const product = products.find(p => p.id === item.productId);
        throw new BadRequestException(`Insufficient stock for ${product?.name}. Available: ${currentStock}, requested: ${itemQty}`);
      }
    }

    // 3. Check credit customer limit
    if (dto.customerType === 'CREDIT' && dto.customerId) {
      const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: dto.customerId } });
      const totalAmount = this.calculateTotal(dto.items);
      const available = Number(customer.creditLimit) - Number(customer.creditBalance);
      if (totalAmount > available) {
        throw new BadRequestException(`Credit limit exceeded. Available: KD ${available.toFixed(3)}, Sale total: KD ${totalAmount.toFixed(3)}`);
      }
    }

    // 4. Generate document number (atomic, no duplicates)
    const docNumber = await this.sequence.next(branchId, 'SALE');

    // 5. Build invoice in transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      let subtotal = 0, taxTotal = 0;

      const lineItems = dto.items.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const taxRate  = product.taxRate ? Number(product.taxRate.rate) / 100 : 0;
        const taxType  = product.taxType;

        let netPrice = item.unitPrice;
        let taxAmount = 0;

        if (taxType === 'EXCLUSIVE') {
          taxAmount = netPrice * taxRate * item.quantity;
        } else if (taxType === 'INCLUSIVE') {
          netPrice  = netPrice / (1 + taxRate);
          taxAmount = (item.unitPrice - netPrice) * item.quantity;
        }

        const lineDiscount = item.discountAmount ?? (item.discountPercent ? (item.unitPrice * item.quantity * item.discountPercent / 100) : 0);
        const lineTotal    = (item.unitPrice * item.quantity) - lineDiscount + (taxType === 'EXCLUSIVE' ? taxAmount : 0);

        subtotal += item.unitPrice * item.quantity - lineDiscount;
        taxTotal += taxAmount;

        return { ...item, lineTotal, taxAmount, taxRate: taxRate * 100, originalPrice: item.unitPrice, costAtSale: Number(product.purchasePrice) };
      });

      const discountAmount = dto.discountAmount ?? (dto.discountPercent ? subtotal * dto.discountPercent / 100 : 0);
      const totalAmount    = subtotal + taxTotal - discountAmount;
      const changeAmount   = Math.max(0, dto.paidAmount - totalAmount);
      const creditAmount   = dto.paymentMethod === 'CREDIT' ? totalAmount : 0;

      const inv = await tx.salesInvoice.create({
        data: {
          branchId, warehouseId: dto.warehouseId, customerId: dto.customerId,
          shiftId: dto.shiftId, createdById: userId, docNumber,
          customerType: dto.customerType, paymentMethod: dto.paymentMethod,
          deliveryAddress: dto.deliveryAddress, deliveryPhone: dto.deliveryPhone,
          subtotal, taxAmount: taxTotal, discountAmount, discountPercent: dto.discountPercent ?? 0,
          totalAmount, paidAmount: dto.paidAmount, changeAmount, creditAmount,
          notes: dto.notes, status: 'COMPLETED',
          items: {
            create: lineItems.map(item => ({
              productId: item.productId, unitId: item.unitId,
              quantity: item.quantity, baseQuantity: item.quantity,
              originalPrice: item.originalPrice, unitPrice: item.unitPrice,
              discountAmount: item.discountAmount ?? 0, discountPercent: item.discountPercent ?? 0,
              taxRate: item.taxRate, taxAmount: item.taxAmount, lineTotal: item.lineTotal,
              costAtSale: item.costAtSale, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
              priceOverridden: item.priceOverridden ?? false,
            })),
          },
        },
        include: { items: true },
      });

      // 6. Deduct stock for each item
      for (const item of dto.items) {
        await this.stockMovement.record({
          productId: item.productId, branchId, warehouseId: dto.warehouseId,
          unitId: item.unitId, movementType: 'SALE', direction: 'OUT',
          quantity: item.quantity, costPerUnit: products.find(p => p.id === item.productId)?.purchasePrice as any,
          sourceModule: 'SALE', referenceId: inv.id, referenceType: 'SalesInvoice', referenceNum: docNumber,
          batchNumber: item.batchNumber, expiryDate: item.expiryDate, createdById: userId,
        }, tx);
      }

      // 7. Payment transaction
      await tx.paymentTransaction.create({
        data: { invoiceId: inv.id, shiftId: dto.shiftId, method: dto.paymentMethod, amount: dto.paidAmount },
      });

      // 8. Update credit balance if credit sale
      if (dto.customerId && creditAmount > 0) {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: dto.customerId } });
        const newBalance = Number(customer.creditBalance) + creditAmount;
        await tx.customer.update({ where: { id: dto.customerId }, data: { creditBalance: newBalance } });
        await tx.customerCreditLedger.create({
          data: { customerId: dto.customerId, invoiceId: inv.id, description: `Sale ${docNumber}`, debit: creditAmount, credit: 0, balance: newBalance },
        });
      }

      // 9. Update shift totals
      if (dto.shiftId) {
        const updates: any = { totalSales: { increment: totalAmount }, totalReturns: { increment: 0 } };
        if (dto.paymentMethod === 'CASH')          updates.totalCash   = { increment: totalAmount };
        else if (dto.paymentMethod === 'KNET')      updates.totalKnet   = { increment: totalAmount };
        else if (dto.paymentMethod === 'CARD')      updates.totalCard   = { increment: totalAmount };
        else if (dto.paymentMethod === 'CREDIT')    updates.totalCredit = { increment: totalAmount };
        await tx.shift.update({ where: { id: dto.shiftId }, data: updates });
      }

      return inv;
    });

    await this.audit.log({ userId, action: 'CREATE', module: 'sales', entityId: invoice.id, entityType: 'SalesInvoice', newValues: { docNumber, totalAmount: invoice.totalAmount }, branchId });
    return this.findById(invoice.id);
  }

  async findAll(branchId: string, filters: {
    search?: string; customerId?: string; status?: string; period?: string; from?: string; to?: string;
    paymentMethod?: string; shiftId?: string; page?: number; perPage?: number;
  }) {
    const { BusinessDate } = await import('../../common/utils/business-date.util');
    const page    = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const dateRange = filters.period ? BusinessDate.resolvePeriod(filters.period, filters.from, filters.to) : undefined;

    const where: any = {
      branchId,
      ...(filters.customerId    ? { customerId:     filters.customerId    } : {}),
      ...(filters.status        ? { status:          filters.status        } : {}),
      ...(filters.paymentMethod ? { paymentMethod:   filters.paymentMethod } : {}),
      ...(filters.shiftId       ? { shiftId:         filters.shiftId       } : {}),
      ...(dateRange             ? { saleDate:         dateRange             } : {}),
      ...(filters.search        ? { docNumber: { contains: filters.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where, include: { customer: { select: { name: true, phone: true } }, createdBy: { select: { firstName: true, lastName: true } }, _count: { select: { items: true } } },
        orderBy: { saleDate: 'desc' }, take: perPage, skip: (page - 1) * perPage,
      }),
      this.prisma.salesInvoice.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async findById(id: string) {
    const inv = await this.prisma.salesInvoice.findFirst({
      where: { id },
      include: {
        customer:  true,
        createdBy: { select: { firstName: true, lastName: true } },
        shift:     { select: { docNumber: true } },
        items: {
          include: { product: { select: { name: true, nameAr: true, sku: true, images: { where: { isPrimary: true } } } }, unit: { select: { abbreviation: true } } },
        },
        payments: true,
        returns:  { include: { items: true } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async voidSale(id: string, reason: string, userId: string, branchId: string) {
    const inv = await this.prisma.salesInvoice.findFirst({ where: { id, branchId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== 'COMPLETED') throw new BadRequestException('Only completed invoices can be voided');

    await this.prisma.$transaction(async (tx) => {
      await tx.salesInvoice.update({ where: { id }, data: { status: 'VOIDED', voidReason: reason, voidedAt: new Date(), voidedById: userId } });

      // Reverse stock
      const items = await tx.salesInvoiceItem.findMany({ where: { invoiceId: id } });
      for (const item of items) {
        await this.stockMovement.record({
          productId: item.productId, branchId, warehouseId: inv.warehouseId ?? branchId,
          unitId: item.unitId, movementType: 'MANUAL_CORRECTION', direction: 'IN',
          quantity: Number(item.quantity), sourceModule: 'SALE_VOID',
          referenceId: id, referenceType: 'SalesInvoice', referenceNum: inv.docNumber,
          notes: `Void: ${reason}`, createdById: userId,
        }, tx);
      }
    });

    await this.audit.log({ userId, action: 'VOID_SALE', module: 'sales', entityId: id, entityType: 'SalesInvoice', newValues: { reason }, branchId });
  }

  async processReturn(invoiceId: string, items: Array<{ productId: string; quantity: number; reason: ReturnReason }>, userId: string, branchId: string, warehouseId: string) {
    const inv = await this.findById(invoiceId);
    const docNumber = await this.sequence.next(branchId, 'SALE_RETURN');

    let totalAmount = 0;
    await this.prisma.$transaction(async (tx) => {
      const retDoc = await tx.salesReturn.create({
        data: {
          invoiceId, customerId: inv.customerId, branchId,
          docNumber, reason: items[0].reason, status: 'COMPLETED',
          totalAmount: 0, // update after
        },
      });

      for (const ret of items) {
        const invItem = inv.items.find(i => i.productId === ret.productId);
        if (!invItem) throw new BadRequestException(`Product not in original invoice`);
        if (ret.quantity > Number(invItem.quantity)) throw new BadRequestException(`Return quantity exceeds sold quantity`);

        const lineTotal = Number(invItem.unitPrice) * ret.quantity;
        totalAmount += lineTotal;

        await tx.salesReturnItem.create({
          data: { returnId: retDoc.id, productId: ret.productId, quantity: ret.quantity, baseQuantity: ret.quantity, unitPrice: invItem.unitPrice, lineTotal, returnReason: ret.reason },
        });

        await this.stockMovement.record({
          productId: ret.productId, branchId, warehouseId,
          unitId: invItem.unitId, movementType: 'SALES_RETURN', direction: 'IN',
          quantity: ret.quantity, returnReason: ret.reason,
          sourceModule: 'SALE_RETURN', referenceId: retDoc.id, referenceType: 'SalesReturn', referenceNum: docNumber,
          createdById: userId,
        }, tx);
      }

      await tx.salesReturn.update({ where: { id: retDoc.id }, data: { totalAmount } });
      await tx.salesInvoice.update({ where: { id: invoiceId }, data: { status: 'PARTIAL_RETURNED' } });
    });

    return { docNumber, totalAmount };
  }

  private calculateTotal(items: SaleItemDto[]): number {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity) - (item.discountAmount ?? 0), 0);
  }
}
