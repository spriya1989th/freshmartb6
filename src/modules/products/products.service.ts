import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PriceHistoryService } from '../../common/services/price-history.service';
import { CostHistoryService } from '../../common/services/cost-history.service';
import { StockMovementService } from '../../common/services/stock-movement.service';
import { AuditService } from '../../common/services/audit.service';
import { ProductStatus } from '@prisma/client';

interface CreateProductDto {
  sku?: string; name: string; nameAr?: string; description?: string;
  categoryId?: string; brandId?: string; baseUnitId: string; purchaseUnitId?: string; saleUnitId?: string;
  taxRateId?: string; taxType?: string; purchasePrice: number; sellingPrice: number; wholesalePrice?: number;
  reorderLevel?: number; maxStock?: number; weight?: number; shelfLocation?: string;
  isForSale?: boolean; trackExpiry?: boolean; notes?: string;
  barcodes?: string[];
  openingStock?: number; openingWarehouseId?: string; openingBranchId?: string;
}

interface UpdateProductDto extends Partial<CreateProductDto> {
  status?: ProductStatus;
  priceChangeReason?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private priceHistory: PriceHistoryService,
    private costHistory: CostHistoryService,
    private stockMovement: StockMovementService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateProductDto, userId: string, branchId: string) {
    // Auto-generate SKU if not provided
    const sku = dto.sku ?? await this.generateSku();

    // Validate barcode uniqueness
    if (dto.barcodes?.length) {
      for (const barcode of dto.barcodes) {
        const exists = await this.prisma.productBarcode.findFirst({ where: { barcode, deletedAt: null } });
        if (exists) throw new ConflictException(`Barcode ${barcode} is already assigned to another product`);
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          sku, name: dto.name, nameAr: dto.nameAr, description: dto.description,
          categoryId: dto.categoryId, brandId: dto.brandId,
          baseUnitId: dto.baseUnitId, purchaseUnitId: dto.purchaseUnitId, saleUnitId: dto.saleUnitId,
          taxRateId: dto.taxRateId, taxType: (dto.taxType as any) ?? 'EXCLUSIVE',
          purchasePrice: dto.purchasePrice, sellingPrice: dto.sellingPrice,
          wholesalePrice: dto.wholesalePrice, reorderLevel: dto.reorderLevel ?? 10,
          maxStock: dto.maxStock, weight: dto.weight, shelfLocation: dto.shelfLocation,
          isForSale: dto.isForSale ?? true, trackExpiry: dto.trackExpiry ?? false, notes: dto.notes,
        },
      });

      // Record initial prices as history (source = manual)
      await tx.productPriceHistory.createMany({
        data: [
          { productId: p.id, priceType: 'SELLING', oldPrice: 0, newPrice: dto.sellingPrice, changedById: userId, source: 'manual', branchId },
          { productId: p.id, priceType: 'COST', oldPrice: 0, newPrice: dto.purchasePrice, changedById: userId, source: 'manual', branchId },
          ...(dto.wholesalePrice ? [{ productId: p.id, priceType: 'WHOLESALE' as any, oldPrice: 0, newPrice: dto.wholesalePrice, changedById: userId, source: 'manual' as any, branchId }] : []),
        ],
      });

      // Create barcodes
      if (dto.barcodes?.length) {
        await tx.productBarcode.createMany({
          data: dto.barcodes.map((barcode, i) => ({ productId: p.id, barcode, isPrimary: i === 0, source: 'manual' })),
        });
      }

      return p;
    });

    // Record opening stock if provided
    if (dto.openingStock && dto.openingStock > 0 && dto.openingWarehouseId) {
      await this.stockMovement.record({
        productId: product.id, branchId: dto.openingBranchId ?? branchId,
        warehouseId: dto.openingWarehouseId, unitId: dto.baseUnitId,
        movementType: 'OPENING_STOCK', direction: 'IN', quantity: dto.openingStock,
        costPerUnit: dto.purchasePrice, sourceModule: 'PRODUCTS',
        referenceType: 'Product', referenceId: product.id, createdById: userId,
        notes: 'Opening stock on product creation',
      });
    }

    await this.audit.log({ userId, action: 'CREATE', module: 'products', entityId: product.id, entityType: 'Product', newValues: { sku, name: dto.name }, branchId });
    return this.findById(product.id, branchId);
  }

  async findAll(branchId: string, filters: {
    search?: string; categoryId?: string; brandId?: string; status?: string;
    lowStock?: boolean; page?: number; perPage?: number;
  }) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;

    const where: any = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : { status: { not: 'DISCONTINUED' } }),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId   ? { brandId:    filters.brandId   } : {}),
      ...(filters.search ? {
        OR: [
          { name:    { contains: filters.search, mode: 'insensitive' } },
          { nameAr:  { contains: filters.search, mode: 'insensitive' } },
          { sku:     { contains: filters.search, mode: 'insensitive' } },
          { barcodes: { some: { barcode: { contains: filters.search }, deletedAt: null } } },
        ],
      } : {}),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category:    { select: { name: true, code: true } },
          brand:       { select: { name: true } },
          baseUnit:    { select: { name: true, abbreviation: true } },
          barcodes:    { where: { deletedAt: null }, select: { barcode: true, isPrimary: true } },
          images:      { where: { isPrimary: true }, select: { url: true } },
          stockBalances: branchId ? { where: { branchId }, select: { quantity: true, warehouseId: true } } : false,
        },
        orderBy: { name: 'asc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Enrich with computed stock
    const enriched = products.map(p => ({
      ...p,
      primaryBarcode: p.barcodes.find(b => b.isPrimary)?.barcode ?? p.barcodes[0]?.barcode ?? null,
      primaryImage:   p.images[0]?.url ?? null,
      currentStock:   (p.stockBalances as any[])?.reduce((s: number, b: any) => s + Number(b.quantity), 0) ?? 0,
      margin:         p.sellingPrice > 0 ? ((Number(p.sellingPrice) - Number(p.purchasePrice)) / Number(p.sellingPrice) * 100).toFixed(2) : '0',
    }));

    return { items: enriched, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async findById(id: string, branchId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true, brand: true,
        baseUnit: true, purchaseUnit: true, saleUnit: true, taxRate: true,
        barcodes: { where: { deletedAt: null } },
        images:   true,
        stockBalances: branchId ? { where: { branchId }, include: { warehouse: true } } : { include: { warehouse: true } },
        priceHistories: { orderBy: { createdAt: 'desc' }, take: 20, include: { changedBy: { select: { firstName: true, lastName: true } } } },
        costHistories:  { orderBy: { createdAt: 'desc' }, take: 20, include: { changedBy: { select: { firstName: true, lastName: true } }, supplier: { select: { name: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return {
      ...product,
      currentStock: (product.stockBalances as any[]).reduce((s, b) => s + Number(b.quantity), 0),
      margin: product.sellingPrice > 0 ? ((Number(product.sellingPrice) - Number(product.purchasePrice)) / Number(product.sellingPrice) * 100).toFixed(2) : '0',
    };
  }

  async findByBarcode(barcode: string) {
    const bc = await this.prisma.productBarcode.findFirst({
      where: { barcode: barcode.trim(), deletedAt: null },
      include: { product: { include: { baseUnit: true, saleUnit: true, barcodes: { where: { deletedAt: null } }, images: { where: { isPrimary: true } }, stockBalances: true } } },
    });
    return bc?.product ?? null;
  }

  async update(id: string, dto: UpdateProductDto, userId: string, branchId: string) {
    const current = await this.prisma.product.findUniqueOrThrow({ where: { id } });

    await this.prisma.$transaction(async (tx) => {
      // Detect price changes and record history
      if (dto.sellingPrice !== undefined && Number(dto.sellingPrice) !== Number(current.sellingPrice)) {
        await this.priceHistory.record({ productId: id, priceType: 'SELLING', oldPrice: Number(current.sellingPrice), newPrice: dto.sellingPrice, changedById: userId, branchId, source: 'manual', reason: dto.priceChangeReason }, tx);
      }
      if (dto.purchasePrice !== undefined && Number(dto.purchasePrice) !== Number(current.purchasePrice)) {
        await this.costHistory.record({ productId: id, oldCost: Number(current.purchasePrice), newCost: dto.purchasePrice, changedById: userId, branchId, source: 'manual', notes: dto.priceChangeReason }, tx);
      }
      if (dto.wholesalePrice !== undefined && Number(dto.wholesalePrice ?? 0) !== Number(current.wholesalePrice ?? 0)) {
        await this.priceHistory.record({ productId: id, priceType: 'WHOLESALE', oldPrice: Number(current.wholesalePrice ?? 0), newPrice: dto.wholesalePrice!, changedById: userId, branchId, source: 'manual', reason: dto.priceChangeReason }, tx);
      }

      const { barcodes, openingStock, openingWarehouseId, openingBranchId, priceChangeReason, ...updateData } = dto;

      await tx.product.update({ where: { id }, data: updateData as any });

      // Add new barcodes
      if (barcodes?.length) {
        for (const barcode of barcodes) {
          const exists = await tx.productBarcode.findFirst({ where: { barcode, deletedAt: null, productId: { not: id } } });
          if (exists) throw new ConflictException(`Barcode ${barcode} belongs to another product`);
          await tx.productBarcode.upsert({
            where: { barcode },
            create: { productId: id, barcode, isPrimary: false, source: 'manual' },
            update: { productId: id, deletedAt: null },
          });
        }
      }
    });

    await this.audit.log({ userId, action: 'UPDATE', module: 'products', entityId: id, entityType: 'Product', oldValues: { sellingPrice: current.sellingPrice, purchasePrice: current.purchasePrice }, newValues: dto, branchId });
    return this.findById(id, branchId);
  }

  async softDelete(id: string, userId: string, branchId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISCONTINUED' } });
    await this.audit.log({ userId, action: 'SOFT_DELETE', module: 'products', entityId: id, entityType: 'Product', newValues: { name: product.name }, branchId });
  }

  async duplicate(id: string, newSku: string, newBarcodes: string[], userId: string, branchId: string) {
    const source = await this.findById(id);
    if (!newSku) throw new BadRequestException('New SKU required for duplicate');
    const exists = await this.prisma.product.findFirst({ where: { sku: newSku, deletedAt: null } });
    if (exists) throw new ConflictException('SKU already exists');
    return this.create({ ...source as any, sku: newSku, barcodes: newBarcodes, openingStock: 0, name: `${source.name} (Copy)` }, userId, branchId);
  }

  async addBarcode(productId: string, barcode: string, userId: string) {
    const exists = await this.prisma.productBarcode.findFirst({ where: { barcode, deletedAt: null } });
    if (exists) throw new ConflictException(`Barcode ${barcode} already exists`);
    return this.prisma.productBarcode.create({ data: { productId, barcode, isPrimary: false, source: 'manual' } });
  }

  private async generateSku(): Promise<string> {
    const count = await this.prisma.product.count();
    return `SKU-${String(count + 1).padStart(6, '0')}`;
  }
}
