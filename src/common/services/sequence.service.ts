import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SequenceDocType } from '@prisma/client';
import { DateTime } from 'luxon';

const PREFIXES: Record<SequenceDocType, string> = {
  SALE: 'SAL', SALE_RETURN: 'SRT', PURCHASE: 'PUR',
  PURCHASE_RETURN: 'PRT', STOCK_ADJUSTMENT: 'ADJ',
  SHIFT: 'SHF', RECEIPT: 'RCP', EXPENSE: 'EXP',
};

@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(branchId: string, docType: SequenceDocType, tz = 'Asia/Kuwait'): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where:  { branchId_docType: { branchId, docType } },
        create: { branchId, docType, prefix: PREFIXES[docType], lastNumber: 1, padLength: 6 },
        update: { lastNumber: { increment: 1 } },
      });
      const now = DateTime.now().setZone(tz);
      const mm  = now.month.toString().padStart(2, '0');
      const num = seq.lastNumber.toString().padStart(seq.padLength, '0');
      return `${seq.prefix}-${now.year}-${mm}-${num}`;
    });
  }

  async peek(branchId: string, docType: SequenceDocType): Promise<string> {
    const seq  = await this.prisma.documentSequence.findUnique({ where: { branchId_docType: { branchId, docType } } });
    const next = (seq?.lastNumber ?? 0) + 1;
    const now  = DateTime.now().setZone('Asia/Kuwait');
    const mm   = now.month.toString().padStart(2, '0');
    return `${seq?.prefix ?? PREFIXES[docType]}-${now.year}-${mm}-${next.toString().padStart(seq?.padLength ?? 6, '0')}`;
  }
}
