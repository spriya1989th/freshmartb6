import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CustomerType } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(data: { name: string; nameAr?: string; customerType?: CustomerType; phone?: string; whatsapp?: string; email?: string; address?: string; city?: string; creditLimit?: number; notes?: string }, userId: string, branchId: string) {
    const code = await this.generateCode();
    const customer = await this.prisma.customer.create({
      data: { code, name: data.name, nameAr: data.nameAr, customerType: data.customerType ?? 'WALKIN', phone: data.phone, whatsapp: data.whatsapp, email: data.email, address: data.address, city: data.city, creditLimit: data.creditLimit ?? 0, notes: data.notes },
    });
    await this.audit.log({ userId, action: 'CREATE', module: 'customers', entityId: customer.id, entityType: 'Customer', newValues: { name: data.name, code } });
    return customer;
  }

  async findAll(branchId: string, filters: { search?: string; customerType?: string; page?: number; perPage?: number }) {
    const page = filters.page ?? 1; const perPage = filters.perPage ?? 25;
    const where: any = {
      deletedAt: null,
      ...(filters.customerType ? { customerType: filters.customerType } : {}),
      ...(filters.search ? {
        OR: [
          { name:     { contains: filters.search, mode: 'insensitive' } },
          { phone:    { contains: filters.search } },
          { whatsapp: { contains: filters.search } },
          { code:     { contains: filters.search } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, take: perPage, skip: (page - 1) * perPage }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async findById(id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async update(id: string, data: Partial<{ name: string; phone: string; whatsapp: string; email: string; address: string; city: string; customerType: CustomerType; creditLimit: number; notes: string }>, userId: string) {
    const c = await this.prisma.customer.findUniqueOrThrow({ where: { id } });
    await this.prisma.customer.update({ where: { id }, data });
    await this.audit.log({ userId, action: 'UPDATE', module: 'customers', entityId: id, entityType: 'Customer', oldValues: c, newValues: data });
    return this.findById(id);
  }

  async getLedger(customerId: string, filters: { period?: string; from?: string; to?: string }) {
    const { BusinessDate } = await import('../../common/utils/business-date.util');
    const range = filters.period ? BusinessDate.resolvePeriod(filters.period, filters.from, filters.to) : undefined;
    const [customer, entries] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } }),
      this.prisma.customerCreditLedger.findMany({
        where: { customerId, ...(range ? { createdAt: range } : {}) },
        include: { invoice: { select: { docNumber: true, saleDate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { customer, entries, outstandingBalance: Number(customer.creditBalance) };
  }

  async recordPayment(customerId: string, data: { amount: number; method: string }, userId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (data.amount <= 0) throw new Error('Amount must be positive');

    const newBalance = Math.max(0, Number(customer.creditBalance) - data.amount);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { creditBalance: newBalance } });
      await tx.customerCreditLedger.create({
        data: { customerId, description: `Payment received (${data.method})`, debit: 0, credit: data.amount, balance: newBalance },
      });
    });

    await this.audit.log({ userId, action: 'UPDATE', module: 'customers', entityId: customerId, entityType: 'Customer', newValues: { action: 'payment', amount: data.amount, method: data.method, newBalance } });
    return { success: true, newBalance };
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.customer.count();
    return `CUST-${String(count + 1).padStart(4, '0')}`;
  }
}
