import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { ActivityService } from '../activity/activity.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
// Importing the users service registers the "token belongs to a live user" check.
import '../users/users.service';
import { InventoryController } from './inventory.controller';
import { createInventoryRouter } from './inventory.routes';
import { InventoryService } from './inventory.service';

function buildStores() {
  const activity = new ActivityService();
  const inventory = new InventoryService(activity);
  const suppliers = new SuppliersService(activity);
  const products = new ProductsService(inventory, suppliers, activity);
  return { activity, inventory, suppliers, products };
}

function buildTestApp(stores = buildStores()) {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(
    '/api/inventory',
    createInventoryRouter(new InventoryController(stores.inventory, stores.products, stores.suppliers)),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, ...stores };
}

const bearer = (sub: string, username: string, role: string, companyId: string) =>
  `Bearer ${signAccessToken({ sub, username, role, companyId })}`;

const BIZ101_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const BIZ101_CASHIER = bearer('USR-002', 'cashier', 'cashier', 'BIZ-101');
const BIZ101_STOCK = bearer('USR-003', 'inventorymanager', 'inventorymanager', 'BIZ-101');
const BIZ102_ADMIN = bearer('USR-008', 'metroadmin', 'admin', 'BIZ-102');

// Fixed seed rows: P001 Basmati Rice 145 on hand (reorder 20, INV-001),
// P003 Refined Oil 18 (reorder 20), P020 Detergent Powder 0 (INV-020).

describe('InventoryService', () => {
  let activity: ActivityService;
  let service: InventoryService;

  beforeEach(() => {
    activity = new ActivityService();
    service = new InventoryService(activity);
  });

  describe('computeStatus', () => {
    it.each([
      [0, 10, 'Out of Stock'],
      [-2, 10, 'Out of Stock'],
      [5, 10, 'Critical'],
      [6, 10, 'Low Stock'],
      [10, 10, 'Low Stock'],
      [11, 10, 'In Stock'],
    ])('stock %p with reorder level %p is %p', (stock, reorder, status) => {
      expect(service.computeStatus(stock, reorder)).toBe(status);
    });
  });

  it('gives every row a company and a status that matches its count', () => {
    const rows = service.findAll();
    expect(rows.length).toBe(28);
    rows.forEach((row) => {
      expect(['BIZ-101', 'BIZ-102']).toContain(row.companyId);
      expect(row.status).toBe(service.computeStatus(row.stockAvailable, row.reorderLevel));
    });
  });

  it('filters rows by company', () => {
    const rows = service.findAll('BIZ-102');
    expect(rows).toHaveLength(8);
    rows.forEach((row) => expect(row.companyId).toBe('BIZ-102'));
  });

  it('keeps the seeded ledger in line with the shelf count', () => {
    service.findAll().forEach((row) => {
      const [latest] = service.findMovements({ productId: row.productId, limit: 1 });
      expect(latest.balanceAfter).toBe(row.stockAvailable);
    });
  });

  it('finds a row by product id', () => {
    expect(service.findByProduct('P001')).toMatchObject({ id: 'INV-001', stockAvailable: 145 });
  });

  it('throws NotFound for an unknown id or product', () => {
    expect(() => service.findOne('INV-999')).toThrow('Inventory item INV-999 not found');
    expect(() => service.findByProduct('P999')).toThrow('No inventory record for product P999');
  });

  it('only reports rows in a low stock state', () => {
    const low = service.findLowStock('BIZ-101');
    expect(low.map((r) => r.productId)).toEqual(expect.arrayContaining(['P003', 'P020']));
    low.forEach((row) => expect(['Low Stock', 'Critical', 'Out of Stock']).toContain(row.status));
    expect(low.map((r) => r.productId)).not.toContain('P001');
  });

  describe('update (shelf settings)', () => {
    it('changes the reorder level and recomputes the status without touching the count', () => {
      const updated = service.update('INV-001', { reorderLevel: 200 }, 'inventorymanager');
      expect(updated.stockAvailable).toBe(145);
      expect(updated.reorderLevel).toBe(200);
      expect(updated.status).toBe('Low Stock');
      expect(updated.version).toBe(2);
      expect(updated.updatedBy).toBe('inventorymanager');
    });

    it('writes no ledger entry but logs the settings change', () => {
      const before = service.findMovements({ productId: 'P001' }).length;
      service.update('INV-001', { location: 'Back store' }, 'admin');
      expect(service.findMovements({ productId: 'P001' })).toHaveLength(before);
      const [entry] = activity.find({ entityId: 'P001' });
      expect(entry.action).toBe('stock-settings');
      expect(entry.summary).toContain('"Back store"');
    });

    it('refuses a stale version', () => {
      service.update('INV-001', { location: 'A' });
      expect(() => service.update('INV-001', { location: 'B', version: 1 })).toThrow(
        /since you opened it/,
      );
    });
  });

  describe('adjustStock', () => {
    it('applies a signed change and writes an adjust ledger entry', () => {
      const adjusted = service.adjustStock(
        { productId: 'P001', adjustment: -5, reason: 'Damaged bags' },
        'inventorymanager',
      );
      expect(adjusted.stockAvailable).toBe(140);
      expect(adjusted.id).toBe('INV-001');

      const [move] = service.findMovements({ productId: 'P001', limit: 1 });
      expect(move).toMatchObject({
        companyId: 'BIZ-101',
        type: 'adjust',
        quantity: -5,
        balanceAfter: 140,
        reason: 'Damaged bags',
        by: 'inventorymanager',
      });
    });

    it('requires a reason', () => {
      expect(() => service.adjustStock({ productId: 'P001', adjustment: 2, reason: '   ' })).toThrow(
        'A reason is required for a stock adjustment',
      );
      expect(service.findByProduct('P001').stockAvailable).toBe(145);
    });

    it('recomputes the status', () => {
      const adjusted = service.adjustStock({ productId: 'P003', adjustment: -18, reason: 'Expired' });
      expect(adjusted.stockAvailable).toBe(0);
      expect(adjusted.status).toBe('Out of Stock');
    });

    it('refuses to go below zero', () => {
      expect(() =>
        service.adjustStock({ productId: 'P001', adjustment: -1000, reason: 'Count' }),
      ).toThrow('Stock cannot go below 0 (on hand 145, change -1000)');
    });
  });

  describe('receive', () => {
    it('adds stock and records the supplier on the ledger entry', () => {
      const received = service.receive({ productId: 'P020', quantity: 30, supplierId: 'SUP-007' }, 'admin');
      expect(received.stockAvailable).toBe(30);
      expect(received.status).toBe('In Stock');
      const [move] = service.findMovements({ productId: 'P020', limit: 1 });
      expect(move).toMatchObject({
        type: 'receive',
        quantity: 30,
        balanceAfter: 30,
        refType: 'supplier',
        refId: 'SUP-007',
        reason: 'Received from SUP-007',
      });
    });

    it('uses the note as the reason when given', () => {
      service.receive({ productId: 'P001', quantity: 5, note: 'Invoice 778' });
      expect(service.findMovements({ productId: 'P001', limit: 1 })[0].reason).toBe('Invoice 778');
    });
  });

  describe('consumeStock (sales)', () => {
    it('takes sold units off and writes a sale entry pointing at the order', () => {
      const after = service.consumeStock('P001', 5, { by: 'cashier', refId: 'ORD-9000' });
      expect(after.stockAvailable).toBe(140);
      const [move] = service.findMovements({ productId: 'P001', limit: 1 });
      expect(move).toMatchObject({ type: 'sale', quantity: -5, refType: 'order', refId: 'ORD-9000' });
    });

    it('refuses to sell more than is on the shelf (409)', () => {
      expect(() => service.consumeStock('P003', 19)).toThrow('Only 18 left in stock for P003');
      expect(service.findByProduct('P003').stockAvailable).toBe(18);
    });

    it('refuses to sell an out-of-stock product', () => {
      expect(() => service.consumeStock('P020', 1)).toThrow('P020 is out of stock');
    });

    it('throws NotFound for a product with no stock row', () => {
      expect(() => service.consumeStock('P999', 1)).toThrow('No inventory for product P999');
    });

    it('reports stock on hand, or null when there is no row', () => {
      expect(service.stockFor('P001')).toBe(145);
      expect(service.stockFor('P999')).toBeNull();
    });
  });

  describe('create', () => {
    it('opens a row with the next id and an opening ledger entry', () => {
      const row = service.create(
        { companyId: 'BIZ-101', productId: 'P500', stockAvailable: 12, reorderLevel: 4, location: 'Bin 1' },
        'admin',
      );
      expect(row).toMatchObject({ id: 'INV-029', companyId: 'BIZ-101', stockAvailable: 12, status: 'In Stock' });
      expect(service.findMovements({ productId: 'P500' })).toEqual([
        expect.objectContaining({ type: 'opening', quantity: 12, balanceAfter: 12 }),
      ]);
    });

    it('refuses a second row for the same product', () => {
      expect(() =>
        service.create({ companyId: 'BIZ-101', productId: 'P001', stockAvailable: 0, reorderLevel: 1, location: 'X' }),
      ).toThrow('Product P001 already has an inventory record');
    });
  });

  describe('findMovements', () => {
    it('returns newest first and honours the filters and limit', () => {
      service.adjustStock({ productId: 'P001', adjustment: 1, reason: 'first' });
      service.adjustStock({ productId: 'P001', adjustment: 1, reason: 'second' });
      const moves = service.findMovements({ productId: 'P001', type: 'adjust', limit: 2 });
      expect(moves.map((m) => m.reason)).toEqual(['second', 'first']);
    });

    it('filters by company', () => {
      const moves = service.findMovements({ companyId: 'BIZ-102', limit: 1000 });
      expect(moves.length).toBeGreaterThan(0);
      moves.forEach((m) => expect(m.companyId).toBe('BIZ-102'));
    });
  });

  describe('remove', () => {
    it('refuses a row that still has stock', () => {
      expect(() => service.remove('INV-001')).toThrow('This product still has stock on the shelf');
      expect(service.findOne('INV-001')).toBeDefined();
    });

    it('removes an empty row', () => {
      const result = service.remove('INV-020');
      expect(result.message).toBe('Inventory item INV-020 deleted');
      expect(result.inventory.productId).toBe('P020');
      expect(() => service.findOne('INV-020')).toThrow();
    });
  });
});

describe('Inventory routes', () => {
  it('rejects a request with no credential (401)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  it('lets a cashier read stock but not change it', async () => {
    const { app } = buildTestApp();
    const list = await request(app).get('/api/inventory').set('Authorization', BIZ101_CASHIER);
    expect(list.status).toBe(200);
    const put = await request(app)
      .put('/api/inventory/INV-001')
      .set('Authorization', BIZ101_CASHIER)
      .send({ reorderLevel: 5 });
    expect(put.status).toBe(403);
    const adjust = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', BIZ101_CASHIER)
      .send({ productId: 'P001', adjustment: 1, reason: 'Found one' });
    expect(adjust.status).toBe(403);
    const ledger = await request(app).get('/api/inventory/movements').set('Authorization', BIZ101_CASHIER);
    expect(ledger.status).toBe(403);
  });

  it('enriches list rows with product and supplier details', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/inventory').set('Authorization', BIZ101_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(20);
    const rice = res.body.find((r: { productId: string }) => r.productId === 'P001');
    expect(rice).toMatchObject({
      id: 'INV-001',
      companyId: 'BIZ-101',
      stockAvailable: 145,
      productName: 'Basmati Rice',
      category: 'Groceries',
      price: 380,
      gstRate: 5,
      barcode: '8901200001',
      active: true,
      supplierId: 'SUP-001',
      supplierName: 'Agarwal Traders',
      supplierContact: 'Sanjay Agarwal',
      supplierPhone: '9811544101',
      leadTimeDays: 2,
      moq: 25,
    });
  });

  it('shows the current product price after a price change', async () => {
    const { app, products } = buildTestApp();
    products.update('P001', { price: 410 });
    const res = await request(app).get('/api/inventory/product/P001').set('Authorization', BIZ101_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(410);
  });

  it('lists only low-stock rows on /low-stock', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/inventory/low-stock').set('Authorization', BIZ101_STOCK);
    expect(res.status).toBe(200);
    res.body.forEach((row: { status: string; companyId: string }) => {
      expect(['Low Stock', 'Critical', 'Out of Stock']).toContain(row.status);
      expect(row.companyId).toBe('BIZ-101');
    });
    expect(res.body.map((r: { productId: string }) => r.productId)).toContain('P020');
  });

  describe('PUT /api/inventory/:id', () => {
    it('refuses to set the stock count directly (400) with a clear message', async () => {
      const { app, inventory } = buildTestApp();
      const res = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ stockAvailable: 999 });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Stock count cannot be set directly. Use Adjust stock or Receive stock.');
      expect(inventory.findOne('INV-001').stockAvailable).toBe(145);
    });

    it('refuses stockAvailable even alongside allowed fields', async () => {
      const { app, inventory } = buildTestApp();
      const res = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ reorderLevel: 30, stockAvailable: 0 });
      expect(res.status).toBe(400);
      expect(inventory.findOne('INV-001').reorderLevel).toBe(20);
    });

    it('updates reorderLevel and location (200)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ101_STOCK)
        .send({ reorderLevel: 150, location: 'Godown', version: 1 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        reorderLevel: 150,
        location: 'Godown',
        stockAvailable: 145,
        status: 'Low Stock',
        productName: 'Basmati Rice',
        updatedBy: 'inventorymanager',
      });
    });

    it('rejects an empty body or a negative reorder level (400)', async () => {
      const { app } = buildTestApp();
      const empty = await request(app).put('/api/inventory/INV-001').set('Authorization', BIZ101_ADMIN).send({});
      expect(empty.status).toBe(400);
      const negative = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ reorderLevel: -1 });
      expect(negative.status).toBe(400);
    });

    it('answers a stale version with 409', async () => {
      const { app } = buildTestApp();
      await request(app).put('/api/inventory/INV-001').set('Authorization', BIZ101_ADMIN).send({ location: 'A' });
      const res = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ location: 'B', version: 1 });
      expect(res.status).toBe(409);
    });

    it('validates the inventory id format (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .put('/api/inventory/abc')
        .set('Authorization', BIZ101_ADMIN)
        .send({ reorderLevel: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/inventory/adjust', () => {
    it('requires a reason (400)', async () => {
      const { app, inventory } = buildTestApp();
      const missing = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', adjustment: -2 });
      expect(missing.status).toBe(400);
      const short = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', adjustment: -2, reason: 'x' });
      expect(short.status).toBe(400);
      expect(short.body.message).toContain('Say why the stock is changing');
      expect(inventory.findByProduct('P001').stockAvailable).toBe(145);
    });

    it('rejects a zero or fractional adjustment (400)', async () => {
      const { app } = buildTestApp();
      const zero = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', adjustment: 0, reason: 'Recount' });
      expect(zero.status).toBe(400);
      const fraction = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', adjustment: 1.5, reason: 'Recount' });
      expect(fraction.status).toBe(400);
    });

    it('applies the change and writes a ledger entry visible on /movements', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_STOCK)
        .send({ productId: 'P001', adjustment: -3, reason: 'Torn bags' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ stockAvailable: 142, productName: 'Basmati Rice' });

      const ledger = await request(app)
        .get('/api/inventory/movements?productId=P001&type=adjust')
        .set('Authorization', BIZ101_STOCK);
      expect(ledger.status).toBe(200);
      expect(ledger.body[0]).toMatchObject({
        productId: 'P001',
        type: 'adjust',
        quantity: -3,
        balanceAfter: 142,
        reason: 'Torn bags',
        by: 'inventorymanager',
      });
    });

    it('refuses to go below zero (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P003', adjustment: -19, reason: 'Recount' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Stock cannot go below 0');
    });

    it('answers 404 for a product with no stock row', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P999', adjustment: 1, reason: 'Recount' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/inventory/receive', () => {
    it('adds stock and writes a receive ledger entry', async () => {
      const { app, inventory } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/receive')
        .set('Authorization', BIZ101_STOCK)
        .send({ productId: 'P020', quantity: 25, supplierId: 'SUP-007' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ stockAvailable: 25, status: 'In Stock', supplierName: 'HomeSpark Supplies' });

      const [move] = inventory.findMovements({ productId: 'P020', limit: 1 });
      expect(move).toMatchObject({ type: 'receive', quantity: 25, refId: 'SUP-007', by: 'inventorymanager' });
    });

    it('rejects a quantity below 1 (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/receive')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', quantity: 0 });
      expect(res.status).toBe(400);
    });

    it('refuses a supplier from another business (400)', async () => {
      const { app, inventory } = buildTestApp();
      const res = await request(app)
        .post('/api/inventory/receive')
        .set('Authorization', BIZ101_ADMIN)
        .send({ productId: 'P001', quantity: 5, supplierId: 'SUP-101' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Supplier SUP-101 does not belong to this business');
      expect(inventory.findByProduct('P001').stockAvailable).toBe(145);
    });
  });

  describe('DELETE /api/inventory/:id', () => {
    it('refuses the stock row of a product that is still sold (409)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).delete('/api/inventory/INV-020').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('still sold');
    });

    it('refuses a row that still has stock, even for an inactive product (409)', async () => {
      const { app, products } = buildTestApp();
      products.remove('P001');
      const res = await request(app).delete('/api/inventory/INV-001').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('still has stock');
    });

    it('removes the empty row of an inactive product (200)', async () => {
      const { app, products } = buildTestApp();
      products.remove('P020');
      const res = await request(app).delete('/api/inventory/INV-020').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Inventory item INV-020 deleted');
    });

    it('is refused for an inventory manager (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).delete('/api/inventory/INV-020').set('Authorization', BIZ101_STOCK);
      expect(res.status).toBe(403);
    });
  });

  describe('company scoping', () => {
    it('lists only the business own rows', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/inventory').set('Authorization', BIZ102_ADMIN);
      expect(res.body).toHaveLength(8);
      res.body.forEach((row: { companyId: string }) => expect(row.companyId).toBe('BIZ-102'));
    });

    it('refuses a store user asking for another company (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/inventory?companyId=BIZ-101').set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(403);
    });

    it('hides another business row and product (404)', async () => {
      const { app } = buildTestApp();
      const byId = await request(app).get('/api/inventory/INV-001').set('Authorization', BIZ102_ADMIN);
      expect(byId.status).toBe(404);
      const byProduct = await request(app).get('/api/inventory/product/P001').set('Authorization', BIZ102_ADMIN);
      expect(byProduct.status).toBe(404);
    });

    it('cannot change another business stock (404)', async () => {
      const { app, inventory } = buildTestApp();
      const put = await request(app)
        .put('/api/inventory/INV-001')
        .set('Authorization', BIZ102_ADMIN)
        .send({ reorderLevel: 1 });
      expect(put.status).toBe(404);
      const adjust = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', BIZ102_ADMIN)
        .send({ productId: 'P001', adjustment: -100, reason: 'Theft' });
      expect(adjust.status).toBe(404);
      const receive = await request(app)
        .post('/api/inventory/receive')
        .set('Authorization', BIZ102_ADMIN)
        .send({ productId: 'P001', quantity: 5 });
      expect(receive.status).toBe(404);
      const del = await request(app).delete('/api/inventory/INV-020').set('Authorization', BIZ102_ADMIN);
      expect(del.status).toBe(404);
      expect(inventory.findOne('INV-001')).toMatchObject({ stockAvailable: 145, reorderLevel: 20 });
    });

    it('shows only the business own ledger', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/inventory/movements?limit=1000').set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((m: { companyId: string }) => expect(m.companyId).toBe('BIZ-102'));
    });
  });
});
