import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditAction } from '@prisma/client';

interface AuditParams {
  userId?: string; action: AuditAction; module: string;
  entityId?: string; entityType?: string;
  oldValues?: unknown; newValues?: unknown;
  ipAddress?: string; branchId?: string; notes?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(p: AuditParams): Promise<void> {
    this.prisma.auditLog.create({
      data: {
        userId: p.userId, action: p.action, module: p.module,
        entityId: p.entityId, entityType: p.entityType,
        oldValues: p.oldValues as any, newValues: p.newValues as any,
        ipAddress: p.ipAddress, branchId: p.branchId, notes: p.notes,
      },
    }).catch(e => console.error('[Audit]', e));
  }

  async query(f: {
    userId?: string; module?: string; action?: AuditAction; branchId?: string;
    from?: Date; to?: Date; limit?: number; offset?: number;
  }) {
    const where: any = {
      ...(f.userId   ? { userId:   f.userId   } : {}),
      ...(f.module   ? { module:   f.module   } : {}),
      ...(f.action   ? { action:   f.action   } : {}),
      ...(f.branchId ? { branchId: f.branchId } : {}),
      ...((f.from || f.to) ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' }, take: f.limit ?? 50, skip: f.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
