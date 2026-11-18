import express from 'express';
import request from 'supertest';
import { InventoryItem, Product, ReturnRecord, StockMovement } from '../../data/entities';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
// Registers the "token belongs to a real, active user" check.
import '../users/users.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderSnapshot } from '../orders/orders.schema';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { ReturnsService } from '../returns/returns.service';
import { ReportsController } from './reports.controller';
import { createReportsRouter } from './reports.routes';
import { istDay, ReportsService } from './reports.service';

/* ------------------------------------------------------------------ */
/* Fixed data: the collaborators are stubbed so every figure is exact. */
/* ------------------------------------------------------------------ */

function order(partial: Record<string, unknown>): OrderSnapshot {
  return {
    discountAmount: 0,
    taxAmount: 0,
    refundedAmount: 0,
    payments: [],
    staffId: 'USR-002',
    staffName: 'Komal Shah',
    ...partial,
  } as unknown as OrderSnapshot;
}

const stubOrders: OrderSnapshot[] = [
  // 10:30 IST on 10 Nov. Discount 100 on a 1000 subtotal.
  order({
    id: 'ORD-T1',
    companyId: 'BIZ-101',
    orderDate: '2026-11-10T05:00:00.000Z',
    orderType: 'takeaway',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    status: 'Delivered',
    subtotal: 1000,
    discountAmount: 100,
    taxAmount: 45,
    total: 900,
    itemsCount: 3,
    items: [
      { productId: 'P001', productName: 'Rice 5kg', itemPrice: 400, quantity: 1 },
      { productId: 'P002', productName: 'Milk 1L', itemPrice: 300, quantity: 2 },
    ],
    payments: [{ paymentStatus: 'Paid', amountPaid: 900 }],
  }),
  // 19:00 UTC on 10 Nov is 00:30 IST on 11 Nov: it belongs to the 11th.
  order({
    id: 'ORD-T2',
    companyId: 'BIZ-101',
    orderDate: '2026-11-10T19:00:00.000Z',
    orderType: 'delivery',
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Shipped',
    subtotal: 500,
    total: 500,
    itemsCount: 2,
    items: [{ productId: 'P003', productName: 'Atta 10kg', itemPrice: 250, quantity: 2 }],
  }),
  // 13:30 IST on 11 Nov, ₹200 refunded on a return.
  order({
    id: 'ORD-T3',
    companyId: 'BIZ-101',
    orderDate: '2026-11-11T08:00:00.000Z',
    orderType: 'takeaway',
    paymentMethod: 'UPI',
    paymentStatus: 'Paid',
    status: 'Partially Returned',
    subtotal: 600,
    taxAmount: 30,
    total: 600,
    refundedAmount: 200,
    itemsCount: 2,
    staffId: 'USR-001',
    staffName: 'Arjun Mehta',
    items: [{ productId: 'P002', productName: 'Milk 1L', itemPrice: 300, quantity: 2 }],
    payments: [{ paymentStatus: 'Paid', amountPaid: 600 }],
  }),
  // Cancelled: counted in byStatus and cancelledOrders only.
  order({
    id: 'ORD-T4',
    companyId: 'BIZ-101',
    orderDate: '2026-11-11T09:00:00.000Z',
    orderType: 'takeaway',
    paymentMethod: 'Cash',
    paymentStatus: 'Refunded',
    status: 'Cancelled',
    subtotal: 1000,
    total: 1000,
    itemsCount: 1,
    items: [{ productId: 'P001', productName: 'Rice 5kg', itemPrice: 1000, quantity: 1 }],
    payments: [{ paymentStatus: 'Paid', amountPaid: 1000 }],
  }),
  // Another business.
  order({
    id: 'ORD-T5',
    companyId: 'BIZ-102',
    orderDate: '2026-11-11T09:00:00.000Z',
    orderType: 'takeaway',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    status: 'Delivered',
    subtotal: 777,
    total: 777,
    itemsCount: 1,
    staffId: 'USR-009',
    staffName: 'Tanmay Das',
    items: [{ productId: 'P101', productName: 'Mustard Oil', itemPrice: 777, quantity: 1 }],
    payments: [{ paymentStatus: 'Paid', amountPaid: 777 }],
  }),
];

const stubProducts = [
  { id: 'P001', companyId: 'BIZ-101', category: 'Grocery', price: 400, costPrice: 300 },
  { id: 'P002', companyId: 'BIZ-101', category: 'Dairy', price: 300 },
  { id: 'P003', companyId: 'BIZ-101', category: 'Grocery', price: 250, costPrice: 200 },
  { id: 'P101', companyId: 'BIZ-102', category: 'Oils', price: 777, costPrice: 700 },
] as unknown as Product[];

const stubInventory = [
  { id: 'INV-001', companyId: 'BIZ-101', productId: 'P001', stockAvailable: 40, reorderLevel: 10, status: 'In Stock' },
  { id: 'INV-002', companyId: 'BIZ-101', productId: 'P002', stockAvailable: 4, reorderLevel: 10, status: 'Low Stock' },
  { id: 'INV-003', companyId: 'BIZ-101', productId: 'P003', stockAvailable: 0, reorderLevel: 5, status: 'Out of Stock' },
  // Product no longer in the catalogue: counted as a row, ignored for value.
  { id: 'INV-004', companyId: 'BIZ-101', productId: 'P999', stockAvailable: 9, reorderLevel: 1, status: 'In Stock' },
  { id: 'INV-101', companyId: 'BIZ-102', productId: 'P101', stockAvailable: 10, reorderLevel: 2, status: 'In Stock' },
] as unknown as InventoryItem[];

const stubMovements = [
  { companyId: 'BIZ-101', type: 'sale' },
  { companyId: 'BIZ-101', type: 'sale' },
  { companyId: 'BIZ-101', type: 'receive' },
  { companyId: 'BIZ-102', type: 'adjust' },
] as unknown as StockMovement[];

function ret(partial: Partial<ReturnRecord>): ReturnRecord {
  return {
    companyId: 'BIZ-101',
    orderId: 'ORD-T1',
    staffId: 'USR-005',
    reason: 'Damaged',
    returnType: 'refund',
    requestedBy: 'Customer',
    ...partial,
  } as ReturnRecord;
}

const stubReturns: ReturnRecord[] = [
  ret({ id: 'RET-T1', returnDate: '2026-11-10', status: 'Refunded', refundAmount: 200, reason: 'Damaged', items: [{ productName: 'Milk 1L', qty: 2 }] } as Partial<ReturnRecord>),
  ret({ id: 'RET-T2', returnDate: '2026-11-11', status: 'Pending', refundAmount: 120, reason: 'Wrong Item', items: [{ productName: 'Rice 5kg', qty: 1 }] } as Partial<ReturnRecord>),
  ret({ id: 'RET-T3', returnDate: '2026-11-12', status: 'Refunded', refundAmount: 50, reason: 'Damaged', items: [{ productName: 'Milk 1L', qty: 1 }, { productName: 'Atta 10kg', qty: 1 }] } as Partial<ReturnRecord>),
  ret({ id: 'RET-T4', companyId: 'BIZ-102', returnDate: '2026-11-11', status: 'Refunded', refundAmount: 999, reason: 'Expired' }),
];

const byCompany = <T extends { companyId?: string }>(rows: T[], companyId?: string) =>
  rows.filter((r) => (companyId ? r.companyId === companyId : true));

function buildStubbedService(): ReportsService {
  const orders = {
    findAllOrders: (companyId?: string) => byCompany(stubOrders, companyId),
  } as unknown as OrdersService;
  const inventory = {
    findAll: (companyId?: string) => byCompany(stubInventory, companyId),
    findMovements: (filter: { companyId?: string }) => byCompany(stubMovements, filter.companyId),
  } as unknown as InventoryService;
  const returns = {
    findAll: (_status?: string, companyId?: string) => byCompany(stubReturns, companyId),
  } as unknown as ReturnsService;
  const products = {
    findAll: (options: { companyId?: string } = {}) => byCompany(stubProducts, options.companyId),
    findOne: (id: string) => {
      const found = stubProducts.find((p) => p.id === id);
      if (!found) throw new Error(`Product ${id} not found`);
      return found;
    },
  } as unknown as ProductsService;
  return new ReportsService(orders, inventory, returns, products);
}

function buildTestApp(service: ReportsService = buildStubbedService()) {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/reports', createReportsRouter(new ReportsController(service)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function bearer(sub: string, username: string, role: string, companyId: string): string {
  return `Bearer ${signAccessToken({ sub, username, role, companyId })}`;
}

const ACME_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const ACME_CASHIER = bearer('USR-002', 'cashier', 'cashier', 'BIZ-101');
const METRO_ADMIN = bearer('USR-008', 'metroadmin', 'admin', 'BIZ-102');
const SUPERUSER = bearer('USR-006', 'chirag', 'superuser', 'PLATFORM');

/* ------------------------------------------------------------------ */

describe('istDay', () => {
  it('uses the calendar day in India, not UTC', () => {
    expect(istDay('2026-11-10T18:29:59.000Z')).toBe('2026-11-10');
    expect(istDay('2026-11-10T18:30:00.000Z')).toBe('2026-11-11');
    expect(istDay('2026-11-10T19:00:00.000Z')).toBe('2026-11-11');
  });
});

describe('ReportsService (fixed data)', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = buildStubbedService();
  });

  describe('sales report', () => {
    it('works out gross, refunds, net, collected and COD pending for one business', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });

      expect(report.totalOrders).toBe(3);
      expect(report.cancelledOrders).toBe(1);
      expect(report.grossSales).toBe(2000);
      expect(report.refunds).toBe(200);
      expect(report.netSales).toBe(1800);
      expect(report.totalRevenue).toBe(report.netSales);
      // Paid payments on bills still standing (900 + 600), less refunds paid out.
      expect(report.collected).toBe(1300);
      expect(report.codPending).toBe(500);
      expect(report.totalDiscount).toBe(100);
      expect(report.taxCollected).toBe(75);
      expect(report.avgBill).toBe(666.67);
      expect(report.itemsSold).toBe(7);
      expect(report.from).toBeNull();
      expect(report.to).toBeNull();
    });

    it('leaves cancelled orders out of the money but counts them by status', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });
      expect(report.byStatus).toEqual({ Delivered: 1, Shipped: 1, 'Partially Returned': 1, Cancelled: 1 });
      expect(report.byPaymentMethod).toEqual({ Cash: 1, COD: 1, UPI: 1 });
      expect(report.byOrderType).toEqual({ takeaway: 2, delivery: 1 });
      expect(report.orders.map((o) => o.id)).toContain('ORD-T4');
    });

    it('groups by India calendar day, with day totals matching the report totals', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });
      expect(report.byDay).toEqual([
        { day: '2026-11-10', orders: 1, gross: 900, refunds: 0, net: 900, discount: 100 },
        { day: '2026-11-11', orders: 2, gross: 1100, refunds: 200, net: 900, discount: 0 },
      ]);
      const sum = (key: 'orders' | 'gross' | 'refunds' | 'net') => report.byDay.reduce((s, d) => s + d[key], 0);
      expect(sum('orders')).toBe(report.totalOrders);
      expect(sum('gross')).toBe(report.grossSales);
      expect(sum('refunds')).toBe(report.refunds);
      expect(sum('net')).toBe(report.netSales);
    });

    it('groups by India hour of the day', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });
      expect(report.byHour).toEqual([
        { hour: 0, orders: 1, net: 500 },
        { hour: 10, orders: 1, net: 900 },
        { hour: 13, orders: 1, net: 400 },
      ]);
    });

    it('ranks cashiers by net sales', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });
      expect(report.byCashier).toEqual([
        { staff: 'Komal Shah', orders: 2, net: 1400 },
        { staff: 'Arjun Mehta', orders: 1, net: 400 },
      ]);
    });

    it('shares the bill discount across lines for category and product sales', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-101' });
      // ORD-T1 kept 90% after its discount: P001 360, P002 540.
      expect(report.byCategory).toEqual([
        { category: 'Dairy', quantity: 4, sales: 1140 },
        { category: 'Grocery', quantity: 3, sales: 860 },
      ]);
      expect(report.topProducts).toEqual([
        { productId: 'P002', productName: 'Milk 1L', quantity: 4, sales: 1140 },
        { productId: 'P003', productName: 'Atta 10kg', quantity: 2, sales: 500 },
        { productId: 'P001', productName: 'Rice 5kg', quantity: 1, sales: 360 },
      ]);
    });

    it('filters by from/to on the India calendar day (inclusive)', () => {
      const tenth = service.getSalesReport({ companyId: 'BIZ-101', from: '2026-11-10', to: '2026-11-10' });
      // ORD-T2 was placed at 19:00 UTC on the 10th, which is the 11th in India.
      expect(tenth.orders.map((o) => o.id)).toEqual(['ORD-T1']);
      expect(tenth.grossSales).toBe(900);
      expect(tenth.from).toBe('2026-11-10');
      expect(tenth.to).toBe('2026-11-10');

      const eleventh = service.getSalesReport({ companyId: 'BIZ-101', from: '2026-11-11', to: '2026-11-11' });
      expect(eleventh.orders.map((o) => o.id).sort()).toEqual(['ORD-T2', 'ORD-T3', 'ORD-T4']);
      expect(eleventh.grossSales).toBe(1100);
      expect(eleventh.refunds).toBe(200);
      expect(eleventh.netSales).toBe(900);
      expect(eleventh.cancelledOrders).toBe(1);

      const later = service.getSalesReport({ companyId: 'BIZ-101', from: '2026-11-12' });
      expect(later.totalOrders).toBe(0);
      expect(later.avgBill).toBe(0);
      expect(later.byDay).toEqual([]);
    });

    it('never mixes in another business', () => {
      const report = service.getSalesReport({ companyId: 'BIZ-102' });
      expect(report.orders.map((o) => o.id)).toEqual(['ORD-T5']);
      expect(report.grossSales).toBe(777);
      expect(report.byCategory).toEqual([{ category: 'Oils', quantity: 1, sales: 777 }]);
    });
  });

  describe('inventory report', () => {
    it('counts rows by status, lists low stock and values stock at cost and price', () => {
      const report = service.getInventoryReport({ companyId: 'BIZ-101' });
      expect(report.totalItems).toBe(4);
      expect(report.byStatus).toEqual({ 'In Stock': 2, 'Low Stock': 1, 'Out of Stock': 1 });
      expect(report.lowStockCount).toBe(2);
      expect(report.lowStockItems.map((i) => i.id)).toEqual(['INV-002', 'INV-003']);
      // P001 40 × 300 + P002 4 × 300 (no cost price: falls back to price); P999 is skipped.
      expect(report.stockValueAtCost).toBe(13200);
      expect(report.stockValueAtPrice).toBe(17200);
      expect(report.movementsByType).toEqual({ sale: 2, receive: 1 });
    });

    it('is scoped to one business', () => {
      const report = service.getInventoryReport({ companyId: 'BIZ-102' });
      expect(report.totalItems).toBe(1);
      expect(report.stockValueAtPrice).toBe(7770);
      expect(report.movementsByType).toEqual({ adjust: 1 });
    });
  });

  describe('returns report', () => {
    it('counts only Refunded returns towards the refund total', () => {
      const report = service.getReturnsReport({ companyId: 'BIZ-101' });
      expect(report.totalReturns).toBe(3);
      expect(report.totalRefund).toBe(250);
      expect(report.byStatus).toEqual({ Refunded: 2, Pending: 1 });
      expect(report.byReason).toEqual({ Damaged: 2, 'Wrong Item': 1 });
      expect(report.topProducts[0]).toEqual({ productName: 'Milk 1L', qty: 3 });
    });

    it('filters by return date (inclusive) and by business', () => {
      const report = service.getReturnsReport({ companyId: 'BIZ-101', from: '2026-11-11', to: '2026-11-12' });
      expect(report.returns.map((r) => r.id)).toEqual(['RET-T2', 'RET-T3']);
      expect(report.totalRefund).toBe(50);

      const metro = service.getReturnsReport({ companyId: 'BIZ-102' });
      expect(metro.returns.map((r) => r.id)).toEqual(['RET-T4']);
    });
  });
});

describe('ReportsService (seeded data invariants)', () => {
  const service = new ReportsService();

  it('keeps netSales = grossSales - refunds and the breakdowns consistent', () => {
    const report = service.getSalesReport({ companyId: 'BIZ-101' });
    expect(report.totalOrders).toBeGreaterThan(0);
    expect(report.netSales).toBeCloseTo(report.grossSales - report.refunds, 2);
    expect(report.totalRevenue).toBe(report.netSales);
    expect(report.totalOrders + report.cancelledOrders).toBe(report.orders.length);
    expect(Object.values(report.byStatus).reduce((s, n) => s + n, 0)).toBe(report.orders.length);

    const daySum = (key: 'orders' | 'gross' | 'refunds' | 'net') => report.byDay.reduce((s, d) => s + d[key], 0);
    expect(daySum('orders')).toBe(report.totalOrders);
    expect(daySum('gross')).toBeCloseTo(report.grossSales, 1);
    expect(daySum('refunds')).toBeCloseTo(report.refunds, 1);
    expect(daySum('net')).toBeCloseTo(report.netSales, 1);
    expect(report.byCashier.reduce((s, c) => s + c.orders, 0)).toBe(report.totalOrders);
    expect(report.byHour.reduce((s, h) => s + h.orders, 0)).toBe(report.totalOrders);
    expect(report.topProducts.length).toBeLessThanOrEqual(10);

    const days = report.byDay.map((d) => d.day);
    expect([...days].sort()).toEqual(days);
  });

  it('counts COD pending from COD orders that are still unpaid', () => {
    const report = service.getSalesReport({ companyId: 'BIZ-101' });
    const expected = report.orders
      .filter((o) => o.status !== 'Cancelled' && o.paymentMethod === 'COD' && o.paymentStatus === 'Pending')
      .reduce((s, o) => s + o.total, 0);
    expect(report.codPending).toBeCloseTo(expected, 2);
    // ORD-4828 is a COD order still out for delivery.
    expect(report.orders.find((o) => o.id === 'ORD-4828')?.paymentStatus).toBe('Pending');
    expect(report.codPending).toBeGreaterThan(0);
  });

  it('only reports the orders of the requested business', () => {
    const acme = service.getSalesReport({ companyId: 'BIZ-101' });
    const metro = service.getSalesReport({ companyId: 'BIZ-102' });
    expect(acme.orders.every((o) => o.companyId === 'BIZ-101')).toBe(true);
    expect(metro.orders.every((o) => o.companyId === 'BIZ-102')).toBe(true);
    expect(acme.orders.map((o) => o.id)).toContain('ORD-4829');
    expect(metro.orders.map((o) => o.id)).not.toContain('ORD-4829');
  });

  it('keeps every order inside the requested India date range', () => {
    const today = istDay(new Date().toISOString());
    const weekAgo = istDay(new Date(Date.now() - 7 * 86_400_000).toISOString());
    const report = service.getSalesReport({ companyId: 'BIZ-101', from: weekAgo, to: today });
    expect(report.orders.every((o) => istDay(o.orderDate) >= weekAgo && istDay(o.orderDate) <= today)).toBe(true);
    expect(report.byDay.every((d) => d.day >= weekAgo && d.day <= today)).toBe(true);
    expect(report.totalOrders).toBeLessThanOrEqual(service.getSalesReport({ companyId: 'BIZ-101' }).totalOrders);
  });

  it('counts the fixed Refunded return RET-220 in the returns report', () => {
    const report = service.getReturnsReport({ companyId: 'BIZ-101' });
    expect(report.returns.map((r) => r.id)).toEqual(expect.arrayContaining(['RET-220', 'RET-221']));
    const refunded = report.returns.filter((r) => r.status === 'Refunded').reduce((s, r) => s + r.refundAmount, 0);
    expect(report.totalRefund).toBeCloseTo(refunded, 2);
  });

  it('lists only rows of the business in the inventory report', () => {
    const report = service.getInventoryReport({ companyId: 'BIZ-102' });
    expect(report.totalItems).toBeGreaterThan(0);
    expect(report.inventory.every((i) => i.companyId === 'BIZ-102')).toBe(true);
    expect(report.lowStockCount).toBe(report.lowStockItems.length);
    expect(report.stockValueAtCost).toBeLessThanOrEqual(report.stockValueAtPrice);
  });
});

describe('Reports routes', () => {
  it('rejects a request with no credential (401)', async () => {
    const res = await request(buildTestApp()).get('/api/reports/sales');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp()).get('/api/reports/sales').set('x-role', 'returnhandler');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('serves the sales report to a cashier of the business, scoped to it (200)', async () => {
    const res = await request(buildTestApp()).get('/api/reports/sales').set('Authorization', ACME_CASHIER);
    expect(res.status).toBe(200);
    expect(res.body.grossSales).toBe(2000);
    expect(res.body.netSales).toBe(1800);
    expect(res.body.orders.every((o: { companyId: string }) => o.companyId === 'BIZ-101')).toBe(true);
  });

  it('shows another store admin only their own business (200)', async () => {
    const res = await request(buildTestApp()).get('/api/reports/sales').set('Authorization', METRO_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: { id: string }) => o.id)).toEqual(['ORD-T5']);
  });

  it("refuses a store user asking for another business's report (403)", async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales?companyId=BIZ-101')
      .set('Authorization', METRO_ADMIN);
    expect(res.status).toBe(403);
  });

  it('lets the super user pick a business', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales?companyId=BIZ-102')
      .set('Authorization', SUPERUSER);
    expect(res.status).toBe(200);
    expect(res.body.grossSales).toBe(777);
  });

  it('applies the from/to range from the query string', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales?from=2026-11-11&to=2026-11-11')
      .set('Authorization', ACME_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2026-11-11');
    expect(res.body.grossSales).toBe(1100);
    expect(res.body.byDay).toHaveLength(1);
  });

  it('rejects a date that is not YYYY-MM-DD (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales?from=11/11/2026')
      .set('Authorization', ACME_ADMIN);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/YYYY-MM-DD/);
  });

  it('rejects a range that ends before it starts (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales?from=2026-11-12&to=2026-11-10')
      .set('Authorization', ACME_ADMIN);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from must be on or before to/);
  });

  it('serves the inventory report to an inventory manager (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/inventory?companyId=BIZ-101')
      .set('x-role', 'inventorymanager');
    expect(res.status).toBe(200);
    expect(res.body.lowStockCount).toBe(2);
  });

  it('serves the returns report to a return handler (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/returns?companyId=BIZ-101')
      .set('x-role', 'returnhandler');
    expect(res.status).toBe(200);
    expect(res.body.totalRefund).toBe(250);
  });

  it('keeps the inventory report away from a return handler and a cashier (403)', async () => {
    const app = buildTestApp();
    expect((await request(app).get('/api/reports/inventory').set('x-role', 'returnhandler')).status).toBe(403);
    expect((await request(app).get('/api/reports/inventory').set('Authorization', ACME_CASHIER)).status).toBe(403);
  });
});
