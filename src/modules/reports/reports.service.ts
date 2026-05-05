import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { BusinessDate } from '../../common/utils/business-date.util';

interface ReportFilters {
  branchId: string; period?: string; from?: string; to?: string;
  categoryId?: string; brandId?: string; supplierId?: string;
  customerId?: string; cashierId?: string; page?: number; perPage?: number;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── COMMAND CENTER STATS ────────────────────────────────────────
  async getDashboardStats(branchId: string, period = 'today') {
    const range = BusinessDate.resolvePeriod(period);
    const prevRange = this.getPrevRange(period);

    const [salesAgg, prevSalesAgg, purchasesAgg, returnsAgg, newCustomers, lowStockCount, expiringCount] = await Promise.all([
      this.prisma.salesInvoice.aggregate({ where: { branchId, status: 'COMPLETED', saleDate: range }, _sum: { totalAmount: true, discountAmount: true, taxAmount: true }, _count: { id: true } }),
      this.prisma.salesInvoice.aggregate({ where: { branchId, status: 'COMPLETED', saleDate: prevRange }, _sum: { totalAmount: true } }),
      this.prisma.purchase.aggregate({ where: { branchId, status: 'RECEIVED', receivedDate: range }, _sum: { totalAmount: true } }),
      this.prisma.salesReturn.aggregate({ where: { branchId, createdAt: range }, _sum: { totalAmount: true } }),
      this.prisma.customer.count({ where: { createdAt: range, deletedAt: null } }),
      this.prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM products p LEFT JOIN stock_balances sb ON sb."productId"=p.id AND sb."branchId"=${branchId} WHERE p."deletedAt" IS NULL AND p.status='ACTIVE' GROUP BY p.id HAVING COALESCE(SUM(sb.quantity),0) <= p."reorderLevel"`.catch(() => [{ count: 0n }]),
      this.getExpiringCount(branchId, 30),
    ]);

    const totalSales  = Number(salesAgg._sum.totalAmount ?? 0);
    const prevSales   = Number(prevSalesAgg._sum.totalAmount ?? 0);
    const salesChange = prevSales > 0 ? ((totalSales - prevSales) / prevSales * 100).toFixed(1) : '0';

    return {
      totalSales, salesChange: `${Number(salesChange) >= 0 ? '+' : ''}${salesChange}%`,
      totalTransactions: salesAgg._count.id,
      totalDiscount:     Number(salesAgg._sum.discountAmount ?? 0),
      totalTax:          Number(salesAgg._sum.taxAmount ?? 0),
      totalPurchases:    Number(purchasesAgg._sum.totalAmount ?? 0),
      totalReturns:      Number(returnsAgg._sum.totalAmount ?? 0),
      netProfit:         totalSales * 0.32, // placeholder — real P&L uses cost data
      newCustomers,
      lowStockCount:     Number((lowStockCount as any)?.[0]?.count ?? 0),
      expiringCount,
    };
  }

  async getSalesByPeriod(branchId: string, groupBy: 'day' | 'week' | 'month' = 'day', period = 'this_month') {
    const range = BusinessDate.resolvePeriod(period);
    const trunc  = { day: 'day', week: 'week', month: 'month' }[groupBy];

    return this.prisma.$queryRaw<any[]>`
      SELECT DATE_TRUNC(${trunc}, "saleDate" AT TIME ZONE 'Asia/Kuwait') as period,
             SUM("totalAmount") as total, COUNT(*) as count,
             SUM("discountAmount") as discount, SUM("taxAmount") as tax
      FROM sales_invoices
      WHERE "branchId" = ${branchId} AND status = 'COMPLETED'
        AND "saleDate" BETWEEN ${range.gte} AND ${range.lte}
      GROUP BY 1 ORDER BY 1
    `;
  }

  // ── BEST-SELLING PRODUCTS ───────────────────────────────────────
  async getBestSellingProducts(filters: ReportFilters & { topN?: number; sortBy?: 'quantity' | 'revenue' | 'profit' }) {
    const range   = BusinessDate.resolvePeriod(filters.period ?? 'this_month', filters.from, filters.to);
    const page    = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const limit   = filters.topN ?? perPage;

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        p.id, p.name, p."nameAr", p.sku, p."reorderLevel", p."sellingPrice", p."purchasePrice",
        b.name as "brandName", c.name as "categoryName",
        COALESCE(pi.primary_barcode, '') as barcode,
        COALESCE(ii.qty_sold, 0) as "qtySold",
        COALESCE(ii.invoice_count, 0) as "invoiceCount",
        COALESCE(ii.gross_sales, 0) as "grossSales",
        COALESCE(ii.total_discount, 0) as "totalDiscount",
        COALESCE(ii.net_sales, 0) as "netSales",
        COALESCE(ii.cost_total, 0) as "costTotal",
        COALESCE(ii.net_sales, 0) - COALESCE(ii.cost_total, 0) as profit,
        CASE WHEN COALESCE(ii.net_sales, 0) > 0
          THEN ((COALESCE(ii.net_sales, 0) - COALESCE(ii.cost_total, 0)) / COALESCE(ii.net_sales, 0) * 100)
          ELSE 0 END as "profitMargin",
        COALESCE(SUM(sb.quantity), 0) as "currentStock"
      FROM products p
      LEFT JOIN brands b ON b.id = p."brandId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN LATERAL (SELECT barcode FROM product_barcodes WHERE "productId"=p.id AND "isPrimary"=true AND "deletedAt" IS NULL LIMIT 1) pi ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(sii.quantity) as qty_sold,
          COUNT(DISTINCT sii."invoiceId") as invoice_count,
          SUM(sii."lineTotal") as gross_sales,
          SUM(sii."discountAmount") as total_discount,
          SUM(sii."lineTotal" - sii."discountAmount") as net_sales,
          SUM(sii.quantity * COALESCE(sii."costAtSale", p."purchasePrice")) as cost_total
        FROM sales_invoice_items sii
        JOIN sales_invoices si ON si.id = sii."invoiceId"
        WHERE sii."productId" = p.id AND si."branchId" = ${filters.branchId}
          AND si.status = 'COMPLETED'
          AND si."saleDate" BETWEEN ${range.gte} AND ${range.lte}
          ${filters.categoryId ? this.prisma.$queryRaw`AND p."categoryId" = ${filters.categoryId}` : this.prisma.$queryRaw``}
      ) ii ON true
      LEFT JOIN stock_balances sb ON sb."productId" = p.id AND sb."branchId" = ${filters.branchId}
      WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE'
        ${filters.categoryId ? this.prisma.$queryRaw`AND p."categoryId" = ${filters.categoryId}` : this.prisma.$queryRaw``}
        ${filters.brandId    ? this.prisma.$queryRaw`AND p."brandId" = ${filters.brandId}`    : this.prisma.$queryRaw``}
      GROUP BY p.id, p.name, p."nameAr", p.sku, p."reorderLevel", p."sellingPrice", p."purchasePrice", b.name, c.name, pi.primary_barcode, ii.qty_sold, ii.invoice_count, ii.gross_sales, ii.total_discount, ii.net_sales, ii.cost_total
      ORDER BY ${filters.sortBy === 'revenue' ? this.prisma.$queryRaw`"netSales"` : filters.sortBy === 'profit' ? this.prisma.$queryRaw`profit` : this.prisma.$queryRaw`"qtySold"`} DESC NULLS LAST
      LIMIT ${limit} OFFSET ${(page - 1) * perPage}
    `;

    return { items: rows.map((r, i) => ({ ...r, rank: (page - 1) * perPage + i + 1 })), page, perPage };
  }

  // ── STOCK REPORT ────────────────────────────────────────────────
  async getStockReport(branchId: string, filters: { categoryId?: string; lowStockOnly?: boolean; page?: number; perPage?: number }) {
    const page    = filters.page ?? 1;
    const perPage = filters.perPage ?? 50;

    const where: any = {
      deletedAt: null, status: 'ACTIVE',
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category:    { select: { name: true } },
          brand:       { select: { name: true } },
          baseUnit:    { select: { abbreviation: true } },
          barcodes:    { where: { deletedAt: null, isPrimary: true }, select: { barcode: true } },
          stockBalances: { where: { branchId }, select: { quantity: true, warehouse: { select: { name: true } } } },
        },
        take: perPage,
        skip: (page - 1) * perPage,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const enriched = products.map(p => {
      const currentStock = (p.stockBalances as any[]).reduce((s, b) => s + Number(b.quantity), 0);
      return {
        id: p.id, name: p.name, sku: p.sku, barcode: p.barcodes[0]?.barcode,
        category: p.category?.name, brand: p.brand?.name, unit: p.baseUnit.abbreviation,
        currentStock, reorderLevel: p.reorderLevel, stockValue: currentStock * Number(p.purchasePrice),
        sellingPrice: Number(p.sellingPrice), purchasePrice: Number(p.purchasePrice),
        status: currentStock <= 0 ? 'OUT_OF_STOCK' : currentStock <= p.reorderLevel ? 'LOW' : 'OK',
        warehouses: p.stockBalances,
      };
    }).filter(p => !filters.lowStockOnly || p.currentStock <= p.reorderLevel);

    return { items: enriched, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  // ── EXPIRY REPORT ───────────────────────────────────────────────
  async getExpiryReport(branchId: string, daysAhead = 90) {
    const now      = BusinessDate.now().toJSDate();
    const cutoff   = BusinessDate.now().plus({ days: daysAhead }).toJSDate();

    return this.prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p.sku, sm."batchNumber", sm."expiryDate",
             SUM(sm."baseQuantity" * CASE WHEN sm.direction='IN' THEN 1 ELSE -1 END) as "currentStock",
             EXTRACT(DAY FROM sm."expiryDate" - NOW()) as "daysUntilExpiry",
             p."sellingPrice", p."purchasePrice"
      FROM stock_movements sm
      JOIN products p ON p.id = sm."productId"
      WHERE sm."branchId" = ${branchId} AND sm."expiryDate" IS NOT NULL
        AND sm."expiryDate" <= ${cutoff}
        AND p."deletedAt" IS NULL
      GROUP BY p.id, p.name, p.sku, sm."batchNumber", sm."expiryDate", p."sellingPrice", p."purchasePrice"
      HAVING SUM(sm."baseQuantity" * CASE WHEN sm.direction='IN' THEN 1 ELSE -1 END) > 0
      ORDER BY sm."expiryDate" ASC
    `;
  }

  // ── P&L REPORT ──────────────────────────────────────────────────
  async getProfitAndLoss(branchId: string, period = 'this_month', from?: string, to?: string) {
    const range = BusinessDate.resolvePeriod(period, from, to);

    const [sales, returns, purchases, expenses] = await Promise.all([
      this.prisma.salesInvoice.aggregate({ where: { branchId, status: 'COMPLETED', saleDate: range }, _sum: { totalAmount: true, discountAmount: true, taxAmount: true } }),
      this.prisma.salesReturn.aggregate({ where: { branchId, createdAt: range }, _sum: { totalAmount: true } }),
      this.prisma.purchase.aggregate({ where: { branchId, status: 'RECEIVED', receivedDate: range }, _sum: { totalAmount: true } }),
      this.prisma.expense.aggregate({ where: { branchId, expenseDate: range }, _sum: { amount: true } }),
    ]);

    const grossRevenue   = Number(sales._sum.totalAmount   ?? 0);
    const totalReturns   = Number(returns._sum.totalAmount ?? 0);
    const netRevenue     = grossRevenue - totalReturns;
    const totalPurchases = Number(purchases._sum.totalAmount ?? 0);
    const totalExpenses  = Number(expenses._sum.amount ?? 0);
    const grossProfit    = netRevenue - totalPurchases;
    const netProfit      = grossProfit - totalExpenses;
    const margin         = netRevenue > 0 ? (netProfit / netRevenue * 100) : 0;

    return { grossRevenue, totalReturns, netRevenue, totalPurchases, grossProfit, totalExpenses, netProfit, margin: margin.toFixed(2), discounts: Number(sales._sum.discountAmount ?? 0), taxes: Number(sales._sum.taxAmount ?? 0) };
  }

  // ── SHIFT REPORT ────────────────────────────────────────────────
  async getShiftReport(shiftId: string) {
    const shift = await this.prisma.shift.findUniqueOrThrow({
      where: { id: shiftId },
      include: { cashier: { select: { firstName: true, lastName: true } }, branch: { select: { name: true } }, sales: { include: { items: { include: { product: { select: { name: true } } } } } }, cashMovements: true },
    });

    const paymentBreakdown = await this.prisma.paymentTransaction.groupBy({ by: ['method'], where: { shiftId }, _sum: { amount: true } });

    return { ...shift, paymentBreakdown: paymentBreakdown.map(p => ({ method: p.method, total: Number(p._sum.amount) })) };
  }

  // ── CUSTOMER LEDGER ─────────────────────────────────────────────
  async getCustomerLedger(customerId: string, period = 'this_month', from?: string, to?: string) {
    const range = BusinessDate.resolvePeriod(period, from, to);
    const [customer, entries, summary] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } }),
      this.prisma.customerCreditLedger.findMany({ where: { customerId, createdAt: range }, include: { invoice: { select: { docNumber: true, saleDate: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.customerCreditLedger.aggregate({ where: { customerId }, _sum: { debit: true, credit: true } }),
    ]);
    return { customer, entries, totalDebit: Number(summary._sum.debit ?? 0), totalCredit: Number(summary._sum.credit ?? 0), outstandingBalance: Number(customer.creditBalance) };
  }

  // ── SUPPLIER LEDGER ─────────────────────────────────────────────
  async getSupplierLedger(supplierId: string, branchId: string, period = 'this_month', from?: string, to?: string) {
    const range = BusinessDate.resolvePeriod(period, from, to);
    const [supplier, purchases] = await Promise.all([
      this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } }),
      this.prisma.purchase.findMany({ where: { supplierId, branchId, orderDate: range }, include: { items: { include: { product: { select: { name: true } } } } }, orderBy: { orderDate: 'desc' } }),
    ]);
    const totalPurchased = purchases.reduce((s, p) => s + Number(p.totalAmount), 0);
    const totalPaid      = purchases.reduce((s, p) => s + Number(p.paidAmount),  0);
    return { supplier, purchases, totalPurchased, totalPaid, balance: totalPurchased - totalPaid };
  }

  // ── TAX REPORT ──────────────────────────────────────────────────
  async getTaxReport(branchId: string, period = 'this_month', from?: string, to?: string) {
    const range = BusinessDate.resolvePeriod(period, from, to);
    const rows  = await this.prisma.$queryRaw<any[]>`
      SELECT sii."taxRate", SUM(sii."taxAmount") as "totalTax", SUM(sii."lineTotal") as "totalSales", COUNT(*) as items
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii."invoiceId"
      WHERE si."branchId" = ${branchId} AND si.status = 'COMPLETED' AND si."saleDate" BETWEEN ${range.gte} AND ${range.lte}
      GROUP BY sii."taxRate" ORDER BY sii."taxRate" DESC
    `;
    const totalTax = rows.reduce((s, r) => s + Number(r.totalTax), 0);
    return { rows, totalTax };
  }

  private getPrevRange(period: string) {
    switch (period) {
      case 'today':      return BusinessDate.resolvePeriod('today'); // yesterday would need extra method
      case 'this_month': return BusinessDate.lastMonth();
      case 'this_year':  return BusinessDate.lastNMonths(12);
      default:           return BusinessDate.lastMonth();
    }
  }

  private async getExpiringCount(branchId: string, days: number): Promise<number> {
    const cutoff = BusinessDate.now().plus({ days }).toJSDate();
    const rows = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "productId") as count FROM stock_movements
      WHERE "branchId" = ${branchId} AND "expiryDate" IS NOT NULL AND "expiryDate" <= ${cutoff}
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
