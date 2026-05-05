/**
 * FRESHMART ERP — DATABASE SEED
 * Run: npx prisma db seed
 * Creates all required demo data for testing
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FreshMart database...');

  // ── BRANCH ───────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { code: 'MAIN', name: 'FreshMart Main Branch', nameAr: 'فرع فريش مارت الرئيسي', address: 'Block 5, Salmiya, Kuwait', phone: '+965 2200 0000', whatsapp: '+965 9900 0000', email: 'main@freshmart.com.kw', timezone: 'Asia/Kuwait', isDefault: true },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'WH01' } },
    update: {},
    create: { branchId: branch.id, code: 'WH01', name: 'Main Warehouse', isDefault: true },
  });

  // ── ROLES ─────────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { type: 'SUPER_ADMIN' }, update: {}, create: { type: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access' } }),
    prisma.role.upsert({ where: { type: 'ADMIN' },       update: {}, create: { type: 'ADMIN',       name: 'Admin',       description: 'Administrative access' } }),
    prisma.role.upsert({ where: { type: 'MANAGER' },     update: {}, create: { type: 'MANAGER',     name: 'Manager',     description: 'Store management access' } }),
    prisma.role.upsert({ where: { type: 'CASHIER' },     update: {}, create: { type: 'CASHIER',     name: 'Cashier',     description: 'POS and sales access' } }),
    prisma.role.upsert({ where: { type: 'INVENTORY_STAFF' }, update: {}, create: { type: 'INVENTORY_STAFF', name: 'Inventory Staff', description: 'Stock management access' } }),
  ]);
  const [superAdminRole, adminRole, managerRole, cashierRole] = roles;

  // ── PERMISSIONS ───────────────────────────────────────────────────
  const perms = [
    { key: 'dashboard.view',          module: 'dashboard',  name: 'View Dashboard' },
    { key: 'pos.access',              module: 'pos',        name: 'Access POS' },
    { key: 'pos.price_override',      module: 'pos',        name: 'Override Price at POS' },
    { key: 'pos.discount_override',   module: 'pos',        name: 'Override Discount Limit' },
    { key: 'pos.credit_override',     module: 'pos',        name: 'Override Credit Limit' },
    { key: 'sale.void',               module: 'sales',      name: 'Void a Sale' },
    { key: 'sale.return',             module: 'sales',      name: 'Process Return' },
    { key: 'product.view',            module: 'products',   name: 'View Products' },
    { key: 'product.create',          module: 'products',   name: 'Create Products' },
    { key: 'product.edit',            module: 'products',   name: 'Edit Products' },
    { key: 'product.delete',          module: 'products',   name: 'Delete Product' },
    { key: 'product.delete.bulk',     module: 'products',   name: 'Bulk Delete Products' },
    { key: 'purchase.view',           module: 'purchases',  name: 'View Purchases' },
    { key: 'purchase.create',         module: 'purchases',  name: 'Create Purchase' },
    { key: 'stock.adjust',            module: 'inventory',  name: 'Adjust Stock' },
    { key: 'customer.view',           module: 'customers',  name: 'View Customers' },
    { key: 'customer.create',         module: 'customers',  name: 'Create Customers' },
    { key: 'supplier.view',           module: 'suppliers',  name: 'View Suppliers' },
    { key: 'reports.view',            module: 'reports',    name: 'View Reports' },
    { key: 'reports.export',          module: 'reports',    name: 'Export Reports' },
    { key: 'users.manage',            module: 'users',      name: 'Manage Users' },
    { key: 'settings.manage',         module: 'settings',   name: 'Manage Settings' },
    { key: 'shift.open',              module: 'shifts',     name: 'Open Shift' },
    { key: 'shift.close',             module: 'shifts',     name: 'Close Shift' },
    { key: 'backup.access',           module: 'backup',     name: 'Backup & Restore' },
  ];

  const createdPerms = await Promise.all(perms.map(p => prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p })));

  // Assign all permissions to SUPER_ADMIN
  await Promise.all(createdPerms.map(p =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: p.id } },
      update: { granted: true },
      create: { roleId: superAdminRole.id, permissionId: p.id, granted: true },
    })
  ));

  // Cashier permissions
  const cashierPerms = ['dashboard.view','pos.access','sale.return','product.view','customer.view','customer.create','shift.open','shift.close'];
  await Promise.all(createdPerms.filter(p => cashierPerms.includes(p.key)).map(p =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: cashierRole.id, permissionId: p.id } },
      update: { granted: true },
      create: { roleId: cashierRole.id, permissionId: p.id, granted: true },
    })
  ));

  // Manager gets all except users.manage, settings.manage, backup
  const managerExclude = ['users.manage','settings.manage','backup.access','product.delete.bulk'];
  await Promise.all(createdPerms.filter(p => !managerExclude.includes(p.key)).map(p =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: p.id } },
      update: { granted: true },
      create: { roleId: managerRole.id, permissionId: p.id, granted: true },
    })
  ));

  // ── USERS ─────────────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hashSync(p, 12);
  await Promise.all([
    prisma.user.upsert({ where: { username: 'admin' },   update: {}, create: { branchId: branch.id, roleId: superAdminRole.id, username: 'admin',   email: 'admin@freshmart.com',   passwordHash: hash('admin123'),   firstName: 'Ahmed',  lastName: 'Al-Admin' } }),
    prisma.user.upsert({ where: { username: 'manager' }, update: {}, create: { branchId: branch.id, roleId: managerRole.id,    username: 'manager', email: 'manager@freshmart.com', passwordHash: hash('manager123'), firstName: 'Sara',   lastName: 'Manager' } }),
    prisma.user.upsert({ where: { username: 'cashier' }, update: {}, create: { branchId: branch.id, roleId: cashierRole.id,    username: 'cashier', email: 'cashier@freshmart.com', passwordHash: hash('cash123'),    firstName: 'Khalid', lastName: 'Cashier' } }),
  ]);

  // ── UNITS ─────────────────────────────────────────────────────────
  const units = await Promise.all([
    prisma.unit.upsert({ where: { id: 'unit-piece' }, update: {}, create: { id: 'unit-piece',  name: 'Piece',   nameAr: 'قطعة', abbreviation: 'pcs',    isBase: true } }),
    prisma.unit.upsert({ where: { id: 'unit-kg' },    update: {}, create: { id: 'unit-kg',     name: 'Kilogram',nameAr: 'كيلو',  abbreviation: 'kg',     isBase: true } }),
    prisma.unit.upsert({ where: { id: 'unit-litre' }, update: {}, create: { id: 'unit-litre',  name: 'Litre',   nameAr: 'لتر',   abbreviation: 'L',      isBase: true } }),
    prisma.unit.upsert({ where: { id: 'unit-box' },   update: {}, create: { id: 'unit-box',    name: 'Box',     nameAr: 'صندوق', abbreviation: 'box',    isBase: false } }),
    prisma.unit.upsert({ where: { id: 'unit-carton' },update: {}, create: { id: 'unit-carton', name: 'Carton',  nameAr: 'كرتون', abbreviation: 'carton', isBase: false } }),
    prisma.unit.upsert({ where: { id: 'unit-pack' },  update: {}, create: { id: 'unit-pack',   name: 'Pack',    nameAr: 'حزمة',  abbreviation: 'pack',   isBase: false } }),
    prisma.unit.upsert({ where: { id: 'unit-gram' },  update: {}, create: { id: 'unit-gram',   name: 'Gram',    nameAr: 'غرام',  abbreviation: 'g',      isBase: false } }),
  ]);

  // Unit conversions
  await prisma.unitConversion.upsert({ where: { fromUnitId_toUnitId: { fromUnitId: 'unit-box',    toUnitId: 'unit-piece' } }, update: {}, create: { fromUnitId: 'unit-box',    toUnitId: 'unit-piece', ratio: 12 } });
  await prisma.unitConversion.upsert({ where: { fromUnitId_toUnitId: { fromUnitId: 'unit-carton', toUnitId: 'unit-piece' } }, update: {}, create: { fromUnitId: 'unit-carton', toUnitId: 'unit-piece', ratio: 24 } });
  await prisma.unitConversion.upsert({ where: { fromUnitId_toUnitId: { fromUnitId: 'unit-pack',   toUnitId: 'unit-piece' } }, update: {}, create: { fromUnitId: 'unit-pack',   toUnitId: 'unit-piece', ratio: 6  } });
  await prisma.unitConversion.upsert({ where: { fromUnitId_toUnitId: { fromUnitId: 'unit-gram',   toUnitId: 'unit-kg'    } }, update: {}, create: { fromUnitId: 'unit-gram',   toUnitId: 'unit-kg',    ratio: 0.001 } });

  // ── CATEGORIES ────────────────────────────────────────────────────
  const catData = [
    { code: 'BEV', name: 'Beverages',         nameAr: 'مشروبات',       desc: 'Water, Soft Drinks, Juices, Tea & Coffee' },
    { code: 'DAI', name: 'Dairy & Chilled',   nameAr: 'ألبان ومبردات', desc: 'Milk, Yogurt, Cheese, Butter, Eggs' },
    { code: 'SNK', name: 'Chips & Sweets',    nameAr: 'شيبس وحلويات', desc: 'Chips, Chocolates, Biscuits, Candy' },
    { code: 'BAK', name: 'Bakery & Ready-to-Eat', nameAr: 'مخبوزات',  desc: 'Bread, Pastries, Ready Meals' },
    { code: 'PRO', name: 'Vegetables & Fruits', nameAr: 'خضار وفواكه', desc: 'Fresh Veg, Fresh Fruit, Packed' },
    { code: 'MEA', name: 'Meat & Seafood',    nameAr: 'لحوم وأسماك',  desc: 'Chicken, Beef, Lamb, Fish, Seafood' },
    { code: 'GRO', name: 'Grocery (Dry Food)', nameAr: 'بقالة',       desc: 'Rice, Flour, Pasta, Canned Food, Spices' },
    { code: 'HYG', name: 'Personal Care',     nameAr: 'عناية شخصية',  desc: 'Shampoo, Soap, Toothpaste' },
    { code: 'HOU', name: 'Household Items',   nameAr: 'منزليات',       desc: 'Cleaning, Detergents, Tissue' },
    { code: 'TOB', name: 'Tobacco & Vapes',   nameAr: 'تبغ وأجهزة',  desc: 'Cigarettes, Vapes, Accessories' },
    { code: 'OTH', name: 'Others',            nameAr: 'أخرى',          desc: 'Stationery, Phone Accessories, Misc' },
  ];
  const categories: Record<string, string> = {};
  for (const c of catData) {
    const cat = await prisma.category.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, name: c.name, nameAr: c.nameAr, description: c.desc } });
    categories[c.code] = cat.id;
  }

  // ── BRANDS ────────────────────────────────────────────────────────
  const brandNames = ['AlMarai','Pepsi','Coca-Cola','Lays','Nescafe','Dettol','KDD','Aquafina','Lipton','Kelloggs','Nestle','Unilever','Al Safi','AirBar','Baida'];
  const brandMap: Record<string, string> = {};
  for (const name of brandNames) {
    const b = await prisma.brand.upsert({ where: { id: `brand-${name.toLowerCase().replace(/\s+/g, '-')}` }, update: {}, create: { id: `brand-${name.toLowerCase().replace(/\s+/g, '-')}`, name } });
    brandMap[name] = b.id;
  }

  // ── TAX RATES ─────────────────────────────────────────────────────
  await prisma.taxRate.upsert({ where: { id: 'tax-zero' }, update: {}, create: { id: 'tax-zero', name: 'No Tax (0%)', rate: 0, type: 'NONE', isDefault: true } });
  await prisma.taxRate.upsert({ where: { id: 'tax-5' },    update: {}, create: { id: 'tax-5',    name: 'VAT 5%',     rate: 5, type: 'EXCLUSIVE' } });

  // ── PRODUCTS ──────────────────────────────────────────────────────
  const adminUser = await prisma.user.findFirstOrThrow({ where: { username: 'admin' } });

  const prodData = [
    { sku: 'BEV-001', name: 'Pepsi Cola 330ml Can',         nameAr: 'بيبسي كولا 330مل',   cat: 'BEV', brand: 'Pepsi',     cost: 0.080, price: 0.150, barcode: '6281234567001', stock: 480 },
    { sku: 'BEV-002', name: 'Aquafina Water 500ml',         nameAr: 'أكوافينا 500مل',      cat: 'BEV', brand: 'Aquafina', cost: 0.050, price: 0.100, barcode: '6281234567002', stock: 1200 },
    { sku: 'BEV-003', name: 'Nescafe Classic 200g',         nameAr: 'نسكافيه كلاسيك 200غ', cat: 'BEV', brand: 'Nescafe',  cost: 2.200, price: 3.500, barcode: '6281234567003', stock: 60 },
    { sku: 'DAI-001', name: 'AlMarai Fresh Milk 1L',        nameAr: 'المراعي حليب طازج 1ل',cat: 'DAI', brand: 'AlMarai', cost: 0.280, price: 0.500, barcode: '6281234567004', stock: 240 },
    { sku: 'DAI-002', name: 'KDD Yogurt 170g',              nameAr: 'كيدي زبادي 170غ',     cat: 'DAI', brand: 'KDD',      cost: 0.120, price: 0.250, barcode: '6281234567005', stock: 180 },
    { sku: 'DAI-003', name: 'Fresh Eggs (30 pcs)',          nameAr: 'بيض طازج 30 حبة',    cat: 'DAI', brand: 'Baida',    cost: 1.800, price: 2.500, barcode: '6281234567006', stock: 50, trackExpiry: true },
    { sku: 'SNK-001', name: "Lay's Classic Chips 87g",      nameAr: 'ليز كلاسيك 87غ',      cat: 'SNK', brand: 'Lays',     cost: 0.200, price: 0.400, barcode: '6281234567007', stock: 350 },
    { sku: 'SNK-002', name: 'Kelloggs Corn Flakes 375g',    nameAr: 'كيلوغز 375غ',         cat: 'SNK', brand: 'Kelloggs', cost: 0.900, price: 1.600, barcode: '6281234567008', stock: 90 },
    { sku: 'BAK-001', name: 'Whole Wheat Bread 650g',       nameAr: 'خبز قمح كامل 650غ',   cat: 'BAK', brand: 'AlMarai', cost: 0.300, price: 0.550, barcode: '6281234567009', stock: 45, trackExpiry: true },
    { sku: 'HYG-001', name: 'Dettol Antibacterial Soap 125g',nameAr:'ديتول صابون 125غ',    cat: 'HYG', brand: 'Dettol',   cost: 0.200, price: 0.400, barcode: '6281234567010', stock: 200 },
    { sku: 'HYG-002', name: 'Head & Shoulders 400ml',       nameAr: 'هيد آند شولدرز 400مل',cat: 'HYG', brand: 'Unilever', cost: 1.200, price: 2.200, barcode: '6281234567011', stock: 80 },
    { sku: 'GRO-001', name: 'Basmati Rice 5kg',             nameAr: 'أرز بسمتي 5كغ',       cat: 'GRO', brand: 'AlMarai', cost: 2.500, price: 3.800, barcode: '6281234567012', stock: 120 },
    { sku: 'GRO-002', name: 'Sunflower Oil 1.5L',           nameAr: 'زيت عباد الشمس 1.5ل', cat: 'GRO', brand: 'AlMarai', cost: 1.000, price: 1.800, barcode: '6281234567013', stock: 75 },
    { sku: 'PRO-001', name: 'Tomatoes 1kg (pack)',          nameAr: 'طماطم 1كغ',           cat: 'PRO', brand: 'AlMarai', cost: 0.200, price: 0.400, barcode: '6281234567014', stock: 30, trackExpiry: true },
    { sku: 'MEA-001', name: 'Chicken Breast 1kg',           nameAr: 'صدر دجاج 1كغ',        cat: 'MEA', brand: 'AlMarai', cost: 1.500, price: 2.500, barcode: '6281234567015', stock: 40, trackExpiry: true },
  ];

  for (const p of prodData) {
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
    if (existing) continue;

    const product = await prisma.product.create({
      data: {
        sku: p.sku, name: p.name, nameAr: p.nameAr,
        categoryId: categories[p.cat], brandId: brandMap[p.brand],
        baseUnitId: 'unit-piece', taxRateId: 'tax-zero', taxType: 'NONE',
        purchasePrice: p.cost, sellingPrice: p.price,
        reorderLevel: 20, isForSale: true, trackExpiry: p.trackExpiry ?? false, status: 'ACTIVE',
      },
    });

    await prisma.productBarcode.create({ data: { productId: product.id, barcode: p.barcode, isPrimary: true, source: 'seed' } });

    // Price history (initial)
    await prisma.productPriceHistory.createMany({ data: [
      { productId: product.id, priceType: 'SELLING', oldPrice: 0, newPrice: p.price, changedById: adminUser.id, source: 'manual', branchId: branch.id },
      { productId: product.id, priceType: 'COST',    oldPrice: 0, newPrice: p.cost,  changedById: adminUser.id, source: 'manual', branchId: branch.id },
    ]});

    // Opening stock
    await prisma.stockMovement.create({
      data: {
        productId: product.id, branchId: branch.id, warehouseId: warehouse.id, unitId: 'unit-piece',
        movementType: 'OPENING_STOCK', direction: 'IN', quantity: p.stock, baseQuantity: p.stock,
        costPerUnit: p.cost, sourceModule: 'SEED', referenceType: 'Seed', notes: 'Initial seed stock',
        createdById: adminUser.id,
      },
    });
    await prisma.stockBalance.upsert({
      where:  { productId_branchId_warehouseId: { productId: product.id, branchId: branch.id, warehouseId: warehouse.id } },
      update: { quantity: { increment: p.stock } },
      create: { productId: product.id, branchId: branch.id, warehouseId: warehouse.id, quantity: p.stock },
    });
  }

  // ── CUSTOMERS ─────────────────────────────────────────────────────
  const custData = [
    { code: 'CUST-001', name: 'Ahmed Al-Rashid',   phone: '+965 9900 1122', whatsapp: '+965 9900 1122', type: 'REGULAR', creditLimit: 0 },
    { code: 'CUST-002', name: 'Sara Mohammed',     phone: '+965 9911 3344', whatsapp: '+965 9911 3344', type: 'REGULAR', creditLimit: 0 },
    { code: 'CUST-003', name: 'Kuwait Corp Ltd',   phone: '+965 2233 5566', whatsapp: '+965 2233 5566', type: 'CREDIT',  creditLimit: 500 },
    { code: 'CUST-004', name: 'Faisal Al-Nasser',  phone: '+965 9922 7788', whatsapp: '+965 9922 7788', type: 'CREDIT',  creditLimit: 200 },
  ];
  for (const c of custData) {
    await prisma.customer.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, name: c.name, phone: c.phone, whatsapp: c.whatsapp, customerType: c.type as any, creditLimit: c.creditLimit } });
  }

  // ── SUPPLIERS ─────────────────────────────────────────────────────
  const suppData = [
    { code: 'SUPP-001', name: 'AlMarai Distribution', phone: '+965 2210 0001', email: 'kw@almarai.com' },
    { code: 'SUPP-002', name: 'PepsiCo Kuwait',        phone: '+965 2210 0002', email: 'kw@pepsico.com' },
    { code: 'SUPP-003', name: 'Fresh Farms Kuwait',    phone: '+965 9900 5566', email: 'orders@freshfarms.kw' },
  ];
  for (const s of suppData) {
    await prisma.supplier.upsert({ where: { code: s.code }, update: {}, create: { code: s.code, name: s.name, phone: s.phone, email: s.email } });
  }

  // ── DOCUMENT SEQUENCES ────────────────────────────────────────────
  const seqTypes = ['SALE','SALE_RETURN','PURCHASE','PURCHASE_RETURN','STOCK_ADJUSTMENT','SHIFT','RECEIPT','EXPENSE'];
  const prefixes  = { SALE:'SAL', SALE_RETURN:'SRT', PURCHASE:'PUR', PURCHASE_RETURN:'PRT', STOCK_ADJUSTMENT:'ADJ', SHIFT:'SHF', RECEIPT:'RCP', EXPENSE:'EXP' };
  for (const docType of seqTypes) {
    await prisma.documentSequence.upsert({
      where:  { branchId_docType: { branchId: branch.id, docType: docType as any } },
      update: {},
      create: { branchId: branch.id, docType: docType as any, prefix: (prefixes as any)[docType], lastNumber: 0, padLength: 6 },
    });
  }

  // ── DEFAULT SETTINGS ──────────────────────────────────────────────
  const defaultSettings = [
    { key: 'business_name',             value: 'FreshMart Kuwait',          group: 'business' },
    { key: 'branch_name',               value: 'Main Branch',               group: 'business' },
    { key: 'phone',                      value: '+965 2200 0000',            group: 'business' },
    { key: 'whatsapp',                   value: '+965 9900 0000',            group: 'business' },
    { key: 'email',                      value: 'info@freshmart.com.kw',     group: 'business' },
    { key: 'address',                    value: 'Block 5, Salmiya, Kuwait',  group: 'business' },
    { key: 'currency',                   value: 'KWD',                       group: 'business' },
    { key: 'timezone',                   value: 'Asia/Kuwait',               group: 'business' },
    { key: 'receipt_header1',            value: 'FreshMart Kuwait',          group: 'receipt' },
    { key: 'receipt_header2',            value: 'Block 5, Salmiya',          group: 'receipt' },
    { key: 'receipt_footer',             value: 'Thank you for shopping with us!', group: 'receipt' },
    { key: 'receipt_paper',              value: '80mm',                      group: 'receipt' },
    { key: 'receipt_copies',             value: '1',                         group: 'receipt' },
    { key: 'pos_max_discount_cashier',   value: '10',                        group: 'pos' },
    { key: 'discount_approval_threshold',value: '20',                        group: 'pos' },
    { key: 'pos_allow_negative_stock',   value: 'no',                        group: 'pos' },
    { key: 'default_tax_type',           value: 'NONE',                      group: 'tax' },
    { key: 'default_tax_rate',           value: '0',                         group: 'tax' },
    { key: 'alert_low_stock_days',       value: '7',                         group: 'notifications' },
    { key: 'alert_expiry_days',          value: '30',                        group: 'notifications' },
    { key: 'label_default_size',         value: '58x30',                     group: 'labels' },
    { key: 'label_header',               value: 'FreshMart',                 group: 'labels' },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where:  { branchId_key: { branchId: branch.id, key: s.key } },
      update: {},
      create: { branchId: branch.id, key: s.key, value: s.value, group: s.group },
    });
  }

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts:');
  console.log('  admin    / admin123    (Super Admin)');
  console.log('  manager  / manager123  (Manager)');
  console.log('  cashier  / cash123     (Cashier)');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
