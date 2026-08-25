import express from 'express';
import request from 'supertest';
import { InventoryItem, ReturnRecord } from '../../data/entities';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { ReturnsService } from '../returns/returns.service';
import { ReportsController } from './reports.controller';
import { createReportsRouter } from './reports.routes';
import { ReportsService } from './reports.service';

const stubInventory: InventoryItem[] = [
  {
    id: 'INV-001',
    productId: 'P001',
    stockAvailable: 40,
    reorderLevel: 10,
    location: 'Shelf A1',
    lastUpdated: '2026-02-17T09:00:00Z',
    status: 'In Stock',
  },
  {
    id: 'INV-002',
    productId: 'P002',
    stockAvailable: 4,
    reorderLevel: 10,
    location: 'Shelf B2',
    lastUpdated: '2026-02-17T09:00:00Z',
    status: 'Low Stock',
  },
];

const stubReturns: ReturnRecord[] = [
  {
    id: 'RET-001',
    companyId: 'BIZ-101',
    orderId: 'ORD-4829',
    staffId: 'USR-002',
    returnDate: '2026-02-17T10:00:00Z',
    reason: 'Damaged',
    refundAmount: 380,
    status: 'Approved',
    returnType: 'refund',
    product: 'P001',
    qty: 1,
    requestedBy: 'CUS-001',
  },
  {
    id: 'RET-002',
    companyId: 'BIZ-101',
    orderId: 'ORD-4828',
    staffId: 'USR-002',
    returnDate: '2026-02-17T11:00:00Z',
    reason: 'Wrong Item',
    refundAmount: 120,
    status: 'Pending',
    returnType: 'refund',
    product: 'P002',
    qty: 1,
    requestedBy: 'CUS-002',
  },
];

/**
 * The inventory and returns collaborators are stubbed so the numbers under test
 * stay fixed no matter what those modules seed.
 */
function buildStubbedService(): ReportsService {
  const inventory = {
    findAll: (): InventoryItem[] => stubInventory,
    findLowStock: (): InventoryItem[] =>
      stubInventory.filter((item) => item.stockAvailable <= item.reorderLevel),
  } as unknown as InventoryService;

  const returns = {
    findAll: (): ReturnRecord[] => stubReturns,
  } as unknown as ReturnsService;

  return new ReportsService(new OrdersService(), inventory, returns);
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(
    '/api/reports',
    createReportsRouter(new ReportsController(buildStubbedService())),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = buildStubbedService();
  });

  it('totals revenue, discount and orders, and tallies them by status', () => {
    const report = service.getSalesReport();

    expect(report.totalOrders).toBe(report.orders.length);
    expect(report.totalRevenue).toBe(5260);
    expect(report.totalDiscount).toBe(0);
    expect(report.byStatus.Processing).toBe(2);
    expect(report.byPaymentMethod['Paid Upfront']).toBe(1);
  });

  it('counts inventory rows by status and separates the low stock ones', () => {
    const report = service.getInventoryReport();

    expect(report.totalItems).toBe(2);
    expect(report.byStatus['In Stock']).toBe(1);
    expect(report.lowStockCount).toBe(1);
    expect(report.lowStockItems[0].id).toBe('INV-002');
  });

  it('totals refunds and tallies returns by status and by reason', () => {
    const report = service.getReturnsReport();

    expect(report.totalReturns).toBe(2);
    expect(report.totalRefund).toBe(500);
    expect(report.byStatus.Approved).toBe(1);
    expect(report.byReason['Wrong Item']).toBe(1);
  });
});

describe('Reports routes', () => {
  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(buildTestApp()).get('/api/reports/sales');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales')
      .set('x-role', 'cashier');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('serves the sales report to an admin (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/sales')
      .set('x-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(2);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it('serves the inventory report to an inventory manager (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/inventory')
      .set('x-role', 'inventorymanager');

    expect(res.status).toBe(200);
    expect(res.body.lowStockCount).toBe(1);
  });

  it('serves the returns report to a return handler (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/returns')
      .set('x-role', 'returnhandler');

    expect(res.status).toBe(200);
    expect(res.body.totalRefund).toBe(500);
  });

  it('keeps the inventory report away from a return handler (403)', async () => {
    const res = await request(buildTestApp())
      .get('/api/reports/inventory')
      .set('x-role', 'returnhandler');

    expect(res.status).toBe(403);
  });
});
