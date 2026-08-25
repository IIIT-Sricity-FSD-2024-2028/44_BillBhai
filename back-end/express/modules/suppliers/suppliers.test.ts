import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { createSuppliersRouter } from './suppliers.routes';
import { SuppliersService } from './suppliers.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/suppliers', createSuppliersRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(() => {
    service = new SuppliersService();
  });

  it('lists the seeded suppliers', () => {
    const suppliers = service.findAll();
    expect(suppliers.length).toBeGreaterThan(0);
    expect(suppliers[0].id).toBe('SUP-001');
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('SUP-999')).toThrow('Supplier SUP-999 not found');
  });

  it('creates a supplier with the next id and blank optional fields', () => {
    const created = service.create({
      name: 'Nova Distribution',
      mobileNo: '9812345678',
    });

    expect(created.id).toMatch(/^SUP-\d{3}$/);
    expect(created.email).toBe('');
    expect(created.address).toBe('');
    expect(created.gstNo).toBe('');
    expect(service.findOne(created.id).name).toBe('Nova Distribution');
  });

  it('updates only the supplied fields', () => {
    const updated = service.update('SUP-001', { address: 'Noida' });
    expect(updated.address).toBe('Noida');
    expect(updated.name).toBe('Agarwal Traders');
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('SUP-001');
    expect(result.message).toBe('Supplier SUP-001 deleted');
    expect(result.supplier.id).toBe('SUP-001');
    expect(() => service.findOne('SUP-001')).toThrow('Supplier SUP-001 not found');
  });
});

describe('Suppliers routes', () => {
  const app = buildTestApp();

  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(app).get('/api/suppliers');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(app).get('/api/suppliers').set('x-role', 'cashier');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows an inventory manager to list suppliers (200)', async () => {
    const res = await request(app)
      .get('/api/suppliers')
      .set('x-role', 'inventorymanager');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 for an unknown supplier id', async () => {
    const res = await request(app)
      .get('/api/suppliers/SUP-999')
      .set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Supplier SUP-999 not found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(app)
      .get('/api/suppliers/not-an-id')
      .set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 with field detail when creating an invalid supplier', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('x-role', 'inventorymanager')
      .send({ name: 'x', mobileNo: '123', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('does not let an inventory manager delete a supplier (403)', async () => {
    const res = await request(app)
      .delete('/api/suppliers/SUP-001')
      .set('x-role', 'inventorymanager');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('rejects an empty update body (400)', async () => {
    const res = await request(app)
      .put('/api/suppliers/SUP-001')
      .set('x-role', 'admin')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/At least one field must be supplied/);
  });
});
