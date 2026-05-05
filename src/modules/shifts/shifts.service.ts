import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private audit: AuditService,
  ) {}

  async open(data: { openingCash: number }, userId: string, branchId: string) {
    const existing = await this.prisma.shift.findFirst({ where: { branchId, cashierId: userId, status: 'OPEN' } });
    if (existing) throw new BadRequestException('You already have an open shift. Close it first.');
    const docNumber = await this.sequence.next(branchId, 'SHIFT');
    const shift = await this.prisma.shift.create({
      data: { branchId, cashierId: userId, docNumber, status: 'OPEN', openingCash: data.openingCash, openedAt: new Date() },
      include: { cashier: { select: { firstName: true, lastName: true } }, branch: { select: { name: true } } },
    });
    await this.audit.log({ userId, action: 'CREATE', module: 'shifts', entityId: shift.id, entityType: 'Shift', newValues: { docNumber, openingCash: data.openingCash }, branchId });
    return shift;
  }

  async close(shiftId: string, data: { closingCash: number; notes?: string }, userId: string, branchId: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id: shiftId, branchId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== 'OPEN') throw new BadRequestException('Shift is not open');

    // Calculate expected cash
    const expectedCash = Number(shift.openingCash) + Number(shift.totalCash) - Number(shift.totalReturns);
    const variance     = data.closingCash - expectedCash;

    await this.prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'CLOSED', closedAt: new Date(), closingCash: data.closingCash, expectedCash, cashVariance: variance, notes: data.notes },
    });

    await this.audit.log({ userId, action: 'UPDATE', module: 'shifts', entityId: shiftId, entityType: 'Shift', newValues: { status: 'CLOSED', closingCash: data.closingCash, variance }, branchId });
    return { success: true, variance, expectedCash };
  }

  async getActive(userId: string, branchId: string) {
    return this.prisma.shift.findFirst({
      where: { branchId, cashierId: userId, status: 'OPEN' },
      include: {
        cashier:      { select: { firstName: true, lastName: true } },
        branch:       { select: { name: true } },
        cashMovements: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async addCashMovement(shiftId: string, data: { type: 'IN' | 'OUT'; amount: number; reason: string }, userId: string) {
    const shift = await this.prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
    if (shift.status !== 'OPEN') throw new BadRequestException('Shift is not open');

    await this.prisma.cashMovement.create({
      data: { shiftId, type: data.type, amount: data.amount, reason: data.reason, createdById: userId },
    });

    // Update shift total cash
    if (data.type === 'IN') {
      await this.prisma.shift.update({ where: { id: shiftId }, data: { totalCash: { increment: data.amount } } });
    }
    return { success: true };
  }

  async getReport(shiftId: string) {
    const shift = await this.prisma.shift.findUniqueOrThrow({
      where: { id: shiftId },
      include: {
        cashier:  { select: { firstName: true, lastName: true } },
        branch:   { select: { name: true, phone: true, address: true } },
        sales:    { where: { status: 'COMPLETED' }, include: { items: { include: { product: { select: { name: true } } } }, payments: true } },
        cashMovements: { orderBy: { createdAt: 'asc' } },
      },
    });

    const payBreakdown = await this.prisma.paymentTransaction.groupBy({
      by: ['method'], where: { shiftId },
      _sum: { amount: true },
    });

    const expenseTotal = await this.prisma.expense.aggregate({ where: { shiftId }, _sum: { amount: true } });

    return {
      ...shift,
      paymentBreakdown: payBreakdown.map(p => ({ method: p.method, total: Number(p._sum.amount ?? 0) })),
      totalExpenses: Number(expenseTotal._sum.amount ?? 0),
    };
  }

  async list(branchId: string, filters: { page?: number; perPage?: number; status?: string }) {
    const page = filters.page ?? 1; const perPage = filters.perPage ?? 20;
    const where: any = { branchId, ...(filters.status ? { status: filters.status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.shift.findMany({ where, include: { cashier: { select: { firstName: true, lastName: true } } }, orderBy: { openedAt: 'desc' }, take: perPage, skip: (page - 1) * perPage }),
      this.prisma.shift.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }
}
