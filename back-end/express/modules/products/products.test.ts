import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { ActivityService } from '../activity/activity.service';
import { InventoryService } from '../inventory/inventory.service';
import { SuppliersService } from '../suppliers/suppliers.service';
// Importing the users service registers the "token belongs to a live user" check.
import '../users/users.service';
import { ProductsController } from './products.controller';
import { createProductsRouter } from './products.routes';
import { ProductsService } from './products.service';

/** Fresh, isolated stores for every test so nothing leaks between cases. */
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
  app.use('/api/products', createProductsRouter(new ProductsController(stores.products)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, ...stores };
}

const bearer = (sub: string, username: string, role: string, companyId: string) =>
  `Bearer ${signAccessToken({ sub, username, role, companyId })}`;

const BIZ101_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const BIZ101_CASHIER = bearer('USR-002', 'cashier', 'cashier', 'BIZ-101');
const BIZ102_ADMIN = bearer('USR-008', 'metroadmin', 'admin', 'BIZ-102');
const SUPERUSER = bearer('USR-006', 'chirag', 'superuser', 'PLATFORM');

const newProduct = (overrides: Record<string, unknown> = {}) => ({
  supplierId: 'SUP-001',
  name: 'Sona Masoori Rice',
  category: 'Groceries',
  price: 90,
  costPrice: 70,
  gstRate: 5,
  openingStock: 40,
  reorderLevel: 8,
  location: 'Shelf A9',
  ...overrides,
});

describe('ProductsService', () => {
  let stores: ReturnType<typeof buildStores>;
  let service: ProductsService;

  beforeEach(() => {
    stores = buildStores();
    service = stores.products;
  });

  it('lists only the asked company when a companyId is given', () => {
    const biz102 = service.findAll({ companyId: 'BIZ-102' });
    expect(biz102.map((p) => p.id).sort()).toEqual(
      ['P101', 'P102', 'P103', 'P104', 'P105', 'P106', 'P107', 'P108'],
    );
    biz102.forEach((p) => expect(p.companyId).toBe('BIZ-102'));
  });

  it('filters by category case-insensitively', () => {
    const dairy = service.findAll({ companyId: 'BIZ-101', category: 'dairy' });
    expect(dairy.length).toBeGreaterThan(0);
    dairy.forEach((p) => expect(p.category).toBe('Dairy'));
  });

  it('returns a copy so callers cannot change the store', () => {
    const product = service.findOne('P001');
    product.price = 1;
    expect(service.findOne('P001').price).toBe(380);
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('P999')).toThrow('Product P999 not found');
  });

  it('looks a barcode up only inside the given company', () => {
    expect(service.findByBarcode('8901200001', 'BIZ-101').id).toBe('P001');
    expect(() => service.findByBarcode('8901200001', 'BIZ-102')).toThrow(
      'Product with barcode 8901200001 not found',
    );
  });

  it('returns sorted, de-duplicated categories for one company', () => {
    const categories = service.getCategories('BIZ-102');
    expect(categories).toEqual([...categories].sort());
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toContain('Personal Care');
    expect(service.getCategories('BIZ-101')).not.toContain('Personal Care');
  });

  describe('create', () => {
    it('opens the stock row with the opening stock, reorder level and location', () => {
      const created = service.create({ ...newProduct(), companyId: 'BIZ-101' }, 'admin');

      expect(created.id).toBe('P109');
      expect(created.companyId).toBe('BIZ-101');
      expect(created.active).toBe(true);
      expect(created.version).toBe(1);
      expect(created.barcode).toMatch(/^89012\d{5}$/);

      const row = stores.inventory.findByProduct(created.id);
      expect(row.companyId).toBe('BIZ-101');
      expect(row.stockAvailable).toBe(40);
      expect(row.reorderLevel).toBe(8);
      expect(row.location).toBe('Shelf A9');
      expect(row.status).toBe('In Stock');
    });

    it('writes the opening stock to the ledger', () => {
      const created = service.create({ ...newProduct(), companyId: 'BIZ-101' }, 'admin');
      const moves = stores.inventory.findMovements({ productId: created.id });
      expect(moves).toHaveLength(1);
      expect(moves[0]).toMatchObject({ type: 'opening', quantity: 40, balanceAfter: 40, by: 'admin' });
    });

    it('opens an out-of-stock row with no ledger entry when there is no opening stock', () => {
      const created = service.create(
        { ...newProduct({ openingStock: 0 }), companyId: 'BIZ-101' },
        'admin',
      );
      expect(stores.inventory.findByProduct(created.id).status).toBe('Out of Stock');
      expect(stores.inventory.findMovements({ productId: created.id })).toHaveLength(0);
    });

    it('logs the new product to the activity log', () => {
      const created = service.create({ ...newProduct(), companyId: 'BIZ-101' }, 'admin');
      const [entry] = stores.activity.find({ entity: 'product', entityId: created.id });
      expect(entry).toMatchObject({ action: 'create', companyId: 'BIZ-101', by: 'admin' });
    });

    it('refuses a supplier that does not exist', () => {
      expect(() =>
        service.create({ ...newProduct({ supplierId: 'SUP-999' }), companyId: 'BIZ-101' }),
      ).toThrow('Supplier SUP-999 does not exist');
    });

    it('refuses a supplier from another business', () => {
      expect(() =>
        service.create({ ...newProduct({ supplierId: 'SUP-101' }), companyId: 'BIZ-101' }),
      ).toThrow('Supplier SUP-101 does not belong to this business');
    });

    it('refuses a duplicate name in the same company, ignoring case', () => {
      expect(() =>
        service.create({ ...newProduct({ name: '  basmati RICE ', size: '5kg' }), companyId: 'BIZ-101' }),
      ).toThrow('A product called "Basmati Rice" (5kg) already exists (P001)');
    });

    it('allows the same name in another company', () => {
      const created = service.create(
        { ...newProduct({ name: 'Basmati Rice', supplierId: 'SUP-101' }), companyId: 'BIZ-102' },
      );
      expect(created.companyId).toBe('BIZ-102');
    });

    it('refuses a barcode already used in the same company', () => {
      expect(() =>
        service.create({ ...newProduct({ barcode: '8901200001' }), companyId: 'BIZ-101' }),
      ).toThrow('Barcode 8901200001 is already used by Basmati Rice');
    });

    it('does not leave a product behind when nothing was created', () => {
      const before = service.findAll({ includeInactive: true }).length;
      expect(() =>
        service.create({ ...newProduct({ supplierId: 'SUP-999' }), companyId: 'BIZ-101' }),
      ).toThrow();
      expect(service.findAll({ includeInactive: true })).toHaveLength(before);
    });
  });

  describe('update', () => {
    it('logs a price change with the old and new price', () => {
      const updated = service.update('P001', { price: 399 }, 'admin');
      expect(updated.price).toBe(399);
      expect(updated.version).toBe(2);
      expect(updated.updatedBy).toBe('admin');

      const [entry] = stores.activity.find({ entity: 'product', entityId: 'P001' });
      expect(entry.action).toBe('update');
      expect(entry.summary).toContain('price ₹380 → ₹399');
      expect(entry.changes?.price).toEqual({ from: 380, to: 399 });
    });

    it('does not log anything when nothing changed', () => {
      service.update('P001', { price: 380 });
      expect(stores.activity.find({ entityId: 'P001' })).toHaveLength(0);
    });

    it('refuses a stale version with a conflict', () => {
      service.update('P001', { price: 390 });
      expect(() => service.update('P001', { price: 395, version: 1 })).toThrow(
        /was changed by .* since you opened it/,
      );
    });

    it('refuses a cost price above the selling price', () => {
      expect(() => service.update('P001', { costPrice: 500 })).toThrow(
        'costPrice cannot be more than the selling price',
      );
    });

    it('refuses renaming to another product name in the same company', () => {
      expect(() => service.update('P002', { name: 'Basmati Rice', size: '5kg' })).toThrow(
        'A product called "Basmati Rice" (5kg) already exists',
      );
    });

    it('refuses moving to a supplier of another business', () => {
      expect(() => service.update('P001', { supplierId: 'SUP-101' })).toThrow(
        'does not belong to this business',
      );
    });

    it('throws NotFound for an unknown id', () => {
      expect(() => service.update('P999', { price: 10 })).toThrow('Product P999 not found');
    });
  });

  describe('remove', () => {
    it('deactivates instead of deleting', () => {
      const result = service.remove('P001', 'admin');
      expect(result.message).toBe('Product P001 deactivated');
      expect(result.product.active).toBe(false);

      // Still there for old bills and the ledger.
      expect(service.findOne('P001').active).toBe(false);
      expect(stores.inventory.findByProduct('P001').stockAvailable).toBe(145);
    });

    it('hides inactive products unless includeInactive is set', () => {
      service.remove('P001');
      expect(service.findAll({ companyId: 'BIZ-101' }).map((p) => p.id)).not.toContain('P001');
      expect(
        service.findAll({ companyId: 'BIZ-101', includeInactive: true }).map((p) => p.id),
      ).toContain('P001');
    });

    it('logs the deactivation', () => {
      service.remove('P001', 'admin');
      const [entry] = stores.activity.find({ entityId: 'P001' });
      expect(entry.action).toBe('deactivate');
    });

    it('says so when the product is already inactive', () => {
      service.remove('P001');
      expect(service.remove('P001').message).toBe('Product P001 is already inactive');
    });

    it('can be reactivated through update', () => {
      service.remove('P001');
      expect(service.update('P001', { active: true }).active).toBe(true);
      expect(stores.activity.find({ entityId: 'P001' })[0].action).toBe('reactivate');
    });
  });
});

describe('Products routes', () => {
  it('rejects a request with no credential (401)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Please sign in to continue.');
  });

  it('rejects an invalid bearer token (401)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('refuses a cashier creating a product (403)', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', BIZ101_CASHIER)
      .send(newProduct());
    expect(res.status).toBe(403);
  });

  it('lets a cashier read the catalogue of their own company', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/products').set('Authorization', BIZ101_CASHIER);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(20);
    res.body.forEach((p: { companyId: string }) => expect(p.companyId).toBe('BIZ-101'));
  });

  it('validates the product id format (400)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/products/abc').set('x-role', 'admin');
    expect(res.status).toBe(400);
  });

  describe('POST /api/products', () => {
    it('takes the company from the token and opens the stock row (201)', async () => {
      const { app, inventory } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct());

      expect(res.status).toBe(201);
      expect(res.body.companyId).toBe('BIZ-101');
      expect(res.body.updatedBy).toBe('admin');
      const row = inventory.findByProduct(res.body.id);
      expect(row).toMatchObject({ companyId: 'BIZ-101', stockAvailable: 40, reorderLevel: 8, location: 'Shelf A9' });
    });

    it('defaults reorder level, location and opening stock', async () => {
      const { app, inventory } = buildTestApp();
      const body = newProduct();
      delete (body as Record<string, unknown>).openingStock;
      delete (body as Record<string, unknown>).reorderLevel;
      delete (body as Record<string, unknown>).location;
      const res = await request(app).post('/api/products').set('Authorization', BIZ101_ADMIN).send(body);
      expect(res.status).toBe(201);
      expect(inventory.findByProduct(res.body.id)).toMatchObject({
        stockAvailable: 0,
        reorderLevel: 10,
        location: 'Shelf',
        status: 'Out of Stock',
      });
    });

    it('requires a companyId from a cross-company caller (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).post('/api/products').set('x-role', 'admin').send(newProduct());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Pick a business first. The super user must open a business before adding records.');
    });

    it('lets the super user pick the company', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', SUPERUSER)
        .send(newProduct({ companyId: 'BIZ-102', supplierId: 'SUP-101' }));
      expect(res.status).toBe(201);
      expect(res.body.companyId).toBe('BIZ-102');
    });

    it('refuses a store admin creating in another company (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct({ companyId: 'BIZ-102' }));
      expect(res.status).toBe(403);
    });

    it('refuses a supplier of another company (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ102_ADMIN)
        .send(newProduct({ supplierId: 'SUP-001' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Supplier SUP-001 does not belong to this business');
    });

    it('refuses a duplicate name (409)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct({ name: 'Toor Dal', size: '1kg' }));
      expect(res.status).toBe(409);
    });

    it('refuses a duplicate barcode (409)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct({ barcode: '8901200002' }));
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Toor Dal');
    });

    it.each([
      [{ price: 0 }, 'price must be more than 0'],
      [{ price: -5 }, 'price must be more than 0'],
      [{ price: 10.555 }, 'at most 2 decimals'],
      [{ gstRate: 7 }, 'gstRate must be 0, 5, 12, 18 or 28'],
      [{ costPrice: 100 }, 'costPrice cannot be more than the selling price'],
      [{ openingStock: -1 }, 'openingStock'],
      [{ openingStock: 2.5 }, 'openingStock must be a whole number'],
      [{ supplierId: 'nobody' }, 'Pick a supplier'],
      [{ name: 'A' }, 'name must be at least 2 characters'],
    ])('rejects an invalid body %p (400)', async (overrides, message) => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct(overrides));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
    });

    it.each([0, 5, 12, 18, 28])('accepts gstRate %p', async (gstRate) => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', BIZ101_ADMIN)
        .send(newProduct({ gstRate }));
      expect(res.status).toBe(201);
      expect(res.body.gstRate).toBe(gstRate);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('updates the price and writes it to the activity log', async () => {
      const { app, activity } = buildTestApp();
      const res = await request(app)
        .put('/api/products/P002')
        .set('Authorization', BIZ101_ADMIN)
        .send({ price: 125, version: 1 });
      expect(res.status).toBe(200);
      expect(res.body.price).toBe(125);
      expect(res.body.version).toBe(2);

      const [entry] = activity.find({ entity: 'product', entityId: 'P002' });
      expect(entry).toMatchObject({ companyId: 'BIZ-101', by: 'admin' });
      expect(entry.summary).toContain('price ₹120 → ₹125');
    });

    it('answers a stale version with 409', async () => {
      const { app } = buildTestApp();
      await request(app).put('/api/products/P002').set('Authorization', BIZ101_ADMIN).send({ price: 121 });
      const res = await request(app)
        .put('/api/products/P002')
        .set('Authorization', BIZ101_ADMIN)
        .send({ price: 122, version: 1 });
      expect(res.status).toBe(409);
      expect(res.body.details).toEqual({ currentVersion: 2 });
    });

    it('rejects an empty body (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).put('/api/products/P002').set('Authorization', BIZ101_ADMIN).send({});
      expect(res.status).toBe(400);
    });

    it('rejects a gstRate outside the slabs (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .put('/api/products/P002')
        .set('Authorization', BIZ101_ADMIN)
        .send({ gstRate: 10 });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('deactivates the product and hides it from the list', async () => {
      const { app } = buildTestApp();
      const del = await request(app).delete('/api/products/P003').set('Authorization', BIZ101_ADMIN);
      expect(del.status).toBe(200);
      expect(del.body.message).toBe('Product P003 deactivated');
      expect(del.body.product.active).toBe(false);

      const list = await request(app).get('/api/products').set('Authorization', BIZ101_ADMIN);
      expect(list.body.map((p: { id: string }) => p.id)).not.toContain('P003');

      const all = await request(app)
        .get('/api/products?includeInactive=true')
        .set('Authorization', BIZ101_ADMIN);
      expect(all.body.find((p: { id: string }) => p.id === 'P003').active).toBe(false);

      const one = await request(app).get('/api/products/P003').set('Authorization', BIZ101_ADMIN);
      expect(one.status).toBe(200);
      expect(one.body.active).toBe(false);
    });

    it('is allowed for an inventory manager', async () => {
      const { app } = buildTestApp();
      const res = await request(app).delete('/api/products/P003').set('x-role', 'inventorymanager');
      expect(res.status).toBe(200);
    });

    it('is refused for a cashier (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).delete('/api/products/P003').set('Authorization', BIZ101_CASHIER);
      expect(res.status).toBe(403);
    });
  });

  describe('company scoping', () => {
    it('shows another business only its own products', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/products').set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
      res.body.forEach((p: { companyId: string }) => expect(p.companyId).toBe('BIZ-102'));
    });

    it('refuses a store user asking for another company list (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .get('/api/products?companyId=BIZ-101')
        .set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(403);
    });

    it('reports another company product as not found (404)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/products/P001').set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product P001 not found');
    });

    it('cannot edit or deactivate another company product (404)', async () => {
      const { app, products } = buildTestApp();
      const put = await request(app)
        .put('/api/products/P001')
        .set('Authorization', BIZ102_ADMIN)
        .send({ price: 1 });
      expect(put.status).toBe(404);
      const del = await request(app).delete('/api/products/P001').set('Authorization', BIZ102_ADMIN);
      expect(del.status).toBe(404);
      expect(products.findOne('P001')).toMatchObject({ price: 380, active: true });
    });

    it('scopes barcode lookups and categories to the business', async () => {
      const { app } = buildTestApp();
      const miss = await request(app)
        .get('/api/products/barcode/8901200001')
        .set('Authorization', BIZ102_ADMIN);
      expect(miss.status).toBe(404);
      const hit = await request(app)
        .get('/api/products/barcode/8901200001')
        .set('Authorization', BIZ101_ADMIN);
      expect(hit.status).toBe(200);
      expect(hit.body.id).toBe('P001');

      const cats = await request(app).get('/api/products/categories').set('Authorization', BIZ102_ADMIN);
      expect(cats.body).toContain('Personal Care');
      expect(cats.body).not.toContain('Bakery');
    });

    it('lets the super user see every company', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/products').set('Authorization', SUPERUSER);
      const companies = new Set(res.body.map((p: { companyId: string }) => p.companyId));
      expect(companies).toEqual(new Set(['BIZ-101', 'BIZ-102']));
    });

    it('rejects a token for a user that does not exist (401)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', bearer('USR-404', 'ghost', 'admin', 'BIZ-101'));
      expect(res.status).toBe(401);
    });
  });
});
