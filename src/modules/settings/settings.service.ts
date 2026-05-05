import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getAll(branchId: string, group?: string) {
    return this.prisma.setting.findMany({
      where: { branchId, ...(group ? { group } : {}) },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async get(branchId: string, key: string): Promise<string | null> {
    const s = await this.prisma.setting.findFirst({ where: { branchId, key } });
    return s?.value ?? null;
  }

  async updateMany(branchId: string, data: Record<string, string>, userId: string) {
    const ops = Object.entries(data).map(([key, value]) =>
      this.prisma.setting.upsert({
        where:  { branchId_key: { branchId, key } },
        create: { branchId, key, value, group: this.inferGroup(key) },
        update: { value },
      })
    );
    await Promise.all(ops);
    await this.audit.log({ userId, action: 'SETTINGS_CHANGE', module: 'settings', newValues: data, branchId });
    return { success: true };
  }

  async backup(branchId: string, userId: string) {
    const [settings, products, customers, suppliers, categories, brands, units] = await Promise.all([
      this.prisma.setting.findMany({ where: { branchId } }),
      this.prisma.product.findMany({ where: { deletedAt: null }, include: { barcodes: { where: { deletedAt: null } } } }),
      this.prisma.customer.findMany({ where: { deletedAt: null } }),
      this.prisma.supplier.findMany({ where: { deletedAt: null } }),
      this.prisma.category.findMany({ where: { deletedAt: null } }),
      this.prisma.brand.findMany({ where: { deletedAt: null } }),
      this.prisma.unit.findMany({ where: { deletedAt: null } }),
    ]);

    const backup = {
      meta: { createdAt: new Date().toISOString(), branchId, version: '1.0', createdBy: userId },
      settings, products, customers, suppliers, categories, brands, units,
    };

    await this.audit.log({ userId, action: 'BACKUP', module: 'settings', newValues: { branchId }, branchId });
    return backup;
  }

  async restore(branchId: string, backupData: any, userId: string) {
    // Validate structure
    if (!backupData.meta?.version || !backupData.products) {
      throw new Error('Invalid backup file structure');
    }

    // Restore settings
    if (backupData.settings) {
      for (const s of backupData.settings) {
        await this.prisma.setting.upsert({
          where:  { branchId_key: { branchId, key: s.key } },
          create: { branchId, key: s.key, value: s.value, group: s.group },
          update: { value: s.value },
        });
      }
    }

    // Restore categories (merge, no overwrite)
    if (backupData.categories) {
      for (const c of backupData.categories) {
        await this.prisma.category.upsert({
          where:  { code: c.code ?? c.id },
          create: { id: c.id, name: c.name, nameAr: c.nameAr, code: c.code, description: c.description },
          update: {},
        });
      }
    }

    // Restore brands
    if (backupData.brands) {
      for (const b of backupData.brands) {
        await this.prisma.brand.upsert({
          where:  { id: b.id },
          create: { id: b.id, name: b.name, nameAr: b.nameAr, note: b.note },
          update: {},
        });
      }
    }

    await this.audit.log({ userId, action: 'RESTORE', module: 'settings', newValues: { branchId, backupDate: backupData.meta.createdAt }, branchId });
    return { success: true, message: 'Backup restored successfully' };
  }

  private inferGroup(key: string): string {
    if (key.startsWith('business_') || key === 'phone' || key === 'email' || key === 'address' || key === 'currency' || key === 'timezone') return 'business';
    if (key.startsWith('receipt_')) return 'receipt';
    if (key.startsWith('pos_') || key === 'discount_approval_threshold') return 'pos';
    if (key.startsWith('tax_') || key === 'default_tax_type' || key === 'default_tax_rate') return 'tax';
    if (key.startsWith('printer_')) return 'printer';
    if (key.startsWith('label_')) return 'labels';
    if (key.startsWith('alert_')) return 'notifications';
    return 'general';
  }
}
