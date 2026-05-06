import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}
}
