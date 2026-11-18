import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { ActivityService } from '../activity/activity.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
// Importing the users service registers the "token belongs to a live user" check.
import '../users/users.service';
import { SuppliersController } from './suppliers.controller';
import { createSuppliersRouter } from './suppliers.routes';
import { SuppliersService } from './suppliers.service';

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
  app.use('/api/suppliers', createSuppliersRouter(new SuppliersController(stores.suppliers, stores.products)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, ...stores };
}

const bearer = (sub: string, username: string, role: string, companyId: string) =>
  `Bearer ${signAccessToken({ sub, username, role, companyId })}`;

const BIZ101_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const BIZ101_CASHIER = bearer('USR-002', 'cashier', 'cashier', 'BIZ-101');
const BIZ102_ADMIN = bearer('USR-008', 'metroadmin', 'admin', 'BIZ-102');

const newSupplier = (overrides: Record<string, unknown> = {}) => ({
  name: 'Nova Distribution',
  contactPerson: 'Kavya Iyer',
  mobileNo: '9812345678',
  email: 'orders@nova.in',
  gstNo: '07AAFCN1234A1Z5',
  leadTimeDays: 5,
  moq: 12,
  ...overrides,
});

describe('SuppliersService', () => {
  let activity: ActivityService;
  let service: SuppliersService;

  beforeEach(() => {
    activity = new ActivityService();
    service = new SuppliersService(activity);
  });

  it('lists the seeded suppliers of one company', () => {
    const biz101 = service.findAll('BIZ-101');
    expect(biz101.map((s) => s.id)).toEqual([
      'SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005', 'SUP-006', 'SUP-007',
    ]);
    expect(service.findAll('BIZ-102').map((s) => s.id)).toEqual(['SUP-101', 'SUP-102', 'SUP-103']);
  });

  it('carries contact person, lead time and MOQ on seeded suppliers', () => {
    expect(service.findOne('SUP-001')).toMatchObject({
      companyId: 'BIZ-101',
      name: 'Agarwal Traders',
      contactPerson: 'Sanjay Agarwal',
      leadTimeDays: 2,
      moq: 25,
    });
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('SUP-999')).toThrow('Supplier SUP-999 not found');
  });

  it('creates a supplier with an id clear of every company and sensible defaults', () => {
    const created = service.create({ companyId: 'BIZ-101', name: 'Nova', mobileNo: '9812345678' }, 'admin');
    expect(created.id).toBe('SUP-104');
    expect(created).toMatchObject({
      companyId: 'BIZ-101',
      contactPerson: '',
      email: '',
      address: '',
      gstNo: '',
      leadTimeDays: 2,
      moq: 0,
      version: 1,
      updatedBy: 'admin',
    });
    expect(activity.find({ entity: 'supplier', entityId: created.id })[0].action).toBe('create');
  });

  it('refuses a duplicate name in the same company, ignoring case and spaces', () => {
    expect(() =>
      service.create({ companyId: 'BIZ-101', name: '  agarwal traders ', mobileNo: '9812345678' }),
    ).toThrow('A supplier called "Agarwal Traders" already exists (SUP-001)');
  });

  it('allows the same name in another company', () => {
    const created = service.create({ companyId: 'BIZ-102', name: 'Agarwal Traders', mobileNo: '9812345678' });
    expect(created.companyId).toBe('BIZ-102');
  });

  it('updates only the supplied fields and logs what changed', () => {
    const updated = service.update('SUP-001', { address: 'Noida', moq: 50 }, 'admin');
    expect(updated).toMatchObject({ address: 'Noida', moq: 50, name: 'Agarwal Traders', version: 2 });
    const [entry] = activity.find({ entityId: 'SUP-001' });
    expect(entry.summary).toContain('address');
    expect(entry.changes?.moq).toEqual({ from: 25, to: 50 });
  });

  it('refuses a rename onto another supplier of the same company', () => {
    expect(() => service.update('SUP-002', { name: 'Agarwal Traders' })).toThrow('already exists');
  });

  it('refuses a stale version', () => {
    service.update('SUP-001', { address: 'A' });
    expect(() => service.update('SUP-001', { address: 'B', version: 1 })).toThrow(/since you opened it/);
  });

  it('removes a supplier and logs it', () => {
    const result = service.remove('SUP-001', 'admin');
    expect(result.message).toBe('Supplier SUP-001 deleted');
    expect(result.supplier.id).toBe('SUP-001');
    expect(() => service.findOne('SUP-001')).toThrow('Supplier SUP-001 not found');
    expect(activity.find({ entityId: 'SUP-001' })[0].action).toBe('delete');
  });
});

describe('Suppliers routes', () => {
  it('rejects a request with no credential (401)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/suppliers');
    expect(res.status).toBe(401);
  });

  it('refuses a cashier (403)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/suppliers').set('Authorization', BIZ101_CASHIER);
    expect(res.status).toBe(403);
  });

  it('lists the business suppliers with how many active products each supplies', async () => {
    const { app, products } = buildTestApp();
    products.remove('P010'); // inactive products do not count
    const res = await request(app).get('/api/suppliers').set('Authorization', BIZ101_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    const agarwal = res.body.find((s: { id: string }) => s.id === 'SUP-001');
    expect(agarwal.productCount).toBe(1);
    const homespark = res.body.find((s: { id: string }) => s.id === 'SUP-007');
    expect(homespark.productCount).toBe(3);
  });

  describe('POST /api/suppliers', () => {
    it('creates a supplier in the caller company (201)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier());
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        companyId: 'BIZ-101',
        name: 'Nova Distribution',
        contactPerson: 'Kavya Iyer',
        leadTimeDays: 5,
        moq: 12,
        gstNo: '07AAFCN1234A1Z5',
      });
    });

    it('normalises a mobile number with country code and spaces', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier({ mobileNo: '+91 98123-45678' }));
      expect(res.status).toBe(201);
      expect(res.body.mobileNo).toBe('9812345678');
    });

    it('upper-cases a GSTIN typed in lower case', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier({ gstNo: '07aafcn1234a1z5' }));
      expect(res.status).toBe(201);
      expect(res.body.gstNo).toBe('07AAFCN1234A1Z5');
    });

    it.each([
      [{ mobileNo: '12345' }, 'mobileNo must be a 10-digit Indian mobile number'],
      [{ mobileNo: '5812345678' }, 'mobileNo must be a 10-digit Indian mobile number'],
      [{ gstNo: '07AAFCN1234A1X5' }, 'gstNo must be a valid 15-character GSTIN'],
      [{ gstNo: 'GST123' }, 'gstNo must be a valid 15-character GSTIN'],
      [{ email: 'not-an-email' }, 'email must be a valid address'],
      [{ leadTimeDays: 91 }, 'leadTimeDays'],
      [{ leadTimeDays: 1.5 }, 'leadTimeDays must be a whole number'],
      [{ moq: -1 }, 'moq'],
      [{ name: 'N' }, 'name must be at least 2 characters'],
    ])('rejects an invalid body %p (400)', async (overrides, message) => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier(overrides));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
    });

    it('allows a blank GSTIN and email', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier({ gstNo: '', email: '' }));
      expect(res.status).toBe(201);
    });

    it('refuses a duplicate name in the same company (409)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier({ name: 'City Dairy' }));
      expect(res.status).toBe(409);
    });

    it('allows a name used by another company', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ102_ADMIN)
        .send(newSupplier({ name: 'City Dairy' }));
      expect(res.status).toBe(201);
      expect(res.body.companyId).toBe('BIZ-102');
    });

    it('requires a companyId from a cross-company caller (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).post('/api/suppliers').set('x-role', 'admin').send(newSupplier());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('companyId is required');
    });

    it('refuses a store admin creating for another company (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', BIZ101_ADMIN)
        .send(newSupplier({ companyId: 'BIZ-102' }));
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/suppliers/:id', () => {
    it('updates the supplied fields (200)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .put('/api/suppliers/SUP-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ leadTimeDays: 4, contactPerson: 'Ravi', version: 1 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ leadTimeDays: 4, contactPerson: 'Ravi', version: 2, updatedBy: 'admin' });
    });

    it('rejects an empty body (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).put('/api/suppliers/SUP-001').set('Authorization', BIZ101_ADMIN).send({});
      expect(res.status).toBe(400);
    });

    it('rejects a bad mobile number (400)', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .put('/api/suppliers/SUP-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ mobileNo: '999' });
      expect(res.status).toBe(400);
    });

    it('answers a stale version with 409', async () => {
      const { app } = buildTestApp();
      await request(app).put('/api/suppliers/SUP-001').set('Authorization', BIZ101_ADMIN).send({ moq: 1 });
      const res = await request(app)
        .put('/api/suppliers/SUP-001')
        .set('Authorization', BIZ101_ADMIN)
        .send({ moq: 2, version: 1 });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/suppliers/:id', () => {
    it('is refused while active products still use the supplier (409)', async () => {
      const { app, suppliers } = buildTestApp();
      const res = await request(app).delete('/api/suppliers/SUP-001').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Agarwal Traders is linked to 2 product(s) (active or not): Basmati Rice, Atta Flour. Move them to another supplier first.',
      );
      expect(suppliers.findOne('SUP-001')).toBeDefined();
    });

    it('is still refused when the linked products are only deactivated (they keep pointing at it)', async () => {
      const { app, products } = buildTestApp();
      products.remove('P001');
      products.remove('P010');
      const res = await request(app).delete('/api/suppliers/SUP-001').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(409);
    });

    it('is allowed once linked products move to another supplier', async () => {
      const { app, products } = buildTestApp();
      products.update('P001', { supplierId: 'SUP-002' });
      products.update('P010', { supplierId: 'SUP-002' });
      const res = await request(app).delete('/api/suppliers/SUP-001').set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(200);
    });

    it('deletes a supplier with no products', async () => {
      const { app, suppliers } = buildTestApp();
      const created = suppliers.create({ companyId: 'BIZ-101', name: 'Spare', mobileNo: '9812345678' });
      const res = await request(app).delete(`/api/suppliers/${created.id}`).set('Authorization', BIZ101_ADMIN);
      expect(res.status).toBe(200);
      const after = await request(app).get(`/api/suppliers/${created.id}`).set('Authorization', BIZ101_ADMIN);
      expect(after.status).toBe(404);
    });
  });

  describe('company scoping', () => {
    it('lists only the business own suppliers', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/suppliers').set('Authorization', BIZ102_ADMIN);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual(['SUP-101', 'SUP-102', 'SUP-103']);
    });

    it('refuses a list of another company (403)', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/suppliers?companyId=BIZ-101').set('Authorization', BIZ102_ADMIN);
      expect(res.status).toBe(403);
    });

    it('hides, and refuses changes to, another business supplier (404)', async () => {
      const { app, suppliers } = buildTestApp();
      const get = await request(app).get('/api/suppliers/SUP-001').set('Authorization', BIZ102_ADMIN);
      expect(get.status).toBe(404);
      expect(get.body.message).toBe('Supplier SUP-001 not found');
      const put = await request(app)
        .put('/api/suppliers/SUP-001')
        .set('Authorization', BIZ102_ADMIN)
        .send({ address: 'Kolkata' });
      expect(put.status).toBe(404);
      const del = await request(app).delete('/api/suppliers/SUP-001').set('Authorization', BIZ102_ADMIN);
      expect(del.status).toBe(404);
      expect(suppliers.findOne('SUP-001').address).toBe('Naya Bazar, Delhi');
    });

    it('lets a cross-company caller filter by company', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/suppliers?companyId=BIZ-102').set('x-role', 'superuser');
      expect(res.body).toHaveLength(3);
    });
  });
});
