import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { InventoryController } from './inventory.controller';
import { createInventoryRouter } from './inventory.routes';
import { InventoryService } from './inventory.service';

/**
 * Every app gets its own service instance so a test that mutates stock cannot
 * leak into the next one.
 */
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(
    '/api/inventory',
    createInventoryRouter(new InventoryController(new InventoryService())),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
  });

  it('lists the seeded stock ledger', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
  });

  it('derives Out of Stock when the count reaches zero', () => {
    expect(service.update('INV-001', { stockAvailable: 0 }).status).toBe(
      'Out of Stock',
    );
  });

  it('derives Critical at or below half the reorder level', () => {
    // INV-001 has a reorder level of 20, so 10 is exactly the critical edge.
    expect(service.update('INV-001', { stockAvailable: 10 }).status).toBe(
      'Critical',
    );
  });

  it('derives Low Stock at or below the reorder level', () => {
    expect(service.update('INV-001', { stockAvailable: 20 }).status).toBe(
      'Low Stock',
    );
    expect(service.update('INV-001', { stockAvailable: 15 }).status).toBe(
      'Low Stock',
    );
  });

  it('derives In Stock above the reorder level', () => {
    expect(service.update('INV-001', { stockAvailable: 21 }).status).toBe(
      'In Stock',
    );
  });

  it('refreshes lastUpdated on every write', () => {
    const before = service.findOne('INV-001').lastUpdated;
    const after = service.update('INV-001', { stockAvailable: 99 }).lastUpdated;
    expect(after).not.toBe(before);
    expect(Number.isNaN(Date.parse(after))).toBe(false);
  });

  it('only reports items in a low stock state', () => {
    const lowStock = service.findLowStock();
    expect(lowStock.length).toBeGreaterThan(0);
    lowStock.forEach((item) => {
      expect(['Low Stock', 'Critical', 'Out of Stock']).toContain(item.status);
    });
  });

  it('adjusts stock by product id, not by inventory id', () => {
    const before = service.findByProduct('P001').stockAvailable;
    const adjusted = service.adjustStock({ productId: 'P001', adjustment: -5 });
    expect(adjusted.stockAvailable).toBe(before - 5);
    expect(adjusted.id).toBe('INV-001');
  });

  it('recomputes the status after an adjustment', () => {
    const adjusted = service.adjustStock({ productId: 'P003', adjustment: -18 });
    expect(adjusted.stockAvailable).toBe(0);
    expect(adjusted.status).toBe('Out of Stock');
  });

  it('refuses an adjustment that would drive stock below zero', () => {
    expect(() =>
      service.adjustStock({ productId: 'P001', adjustment: -1000 }),
    ).toThrow('Stock cannot go below 0');
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('INV-999')).toThrow(
      'Inventory item INV-999 not found',
    );
  });

  it('throws NotFound when a product has no inventory record', () => {
    expect(() => service.findByProduct('P999')).toThrow(
      'No inventory record for product P999',
    );
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('INV-001');
    expect(result.message).toBe('Inventory item INV-001 deleted');
    expect(result.inventory.id).toBe('INV-001');
  });
});

describe('Inventory routes', () => {
  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(buildTestApp()).get('/api/inventory');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory')
      .set('x-role', 'returnhandler');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows an inventory manager to list stock (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory')
      .set('x-role', 'inventorymanager');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('serves /low-stock without it being swallowed by /:id', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory/low-stock')
      .set('x-role', 'inventorymanager');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((item: { status: string }) => {
      expect(['Low Stock', 'Critical', 'Out of Stock']).toContain(item.status);
    });
  });

  it('resolves /product/P001 to its inventory record', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory/product/P001')
      .set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('INV-001');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory/INV-999')
      .set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/inventory/not-an-id')
      .set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 when an update carries the wrong types', async () => {
    const res = await request(buildTestApp())
      .put('/api/inventory/INV-001')
      .set('x-role', 'admin')
      .send({ stockAvailable: 'plenty' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('never lets a client set the status directly', async () => {
    const res = await request(buildTestApp())
      .put('/api/inventory/INV-014')
      .set('x-role', 'admin')
      .send({ stockAvailable: 500, status: 'Out of Stock' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Stock');
  });

  it('rejects an adjustment that would drive stock below zero (400)', async () => {
    const res = await request(buildTestApp())
      .post('/api/inventory/adjust')
      .set('x-role', 'inventorymanager')
      .send({ productId: 'P001', adjustment: -1000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Stock cannot go below 0');
  });

  it('applies a valid adjustment (200)', async () => {
    const res = await request(buildTestApp())
      .post('/api/inventory/adjust')
      .set('x-role', 'inventorymanager')
      .send({ productId: 'P003', adjustment: -8 });

    expect(res.status).toBe(200);
    expect(res.body.stockAvailable).toBe(10);
    expect(res.body.status).toBe('Critical');
  });
});
