import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { createCustomersRouter } from './customers.routes';
import { CustomersService } from './customers.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/customers', createCustomersRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(() => {
    service = new CustomersService();
  });

  it('lists the seeded customers and scopes them by company', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
    expect(service.findAll('BIZ-101').length).toBeGreaterThan(0);
    expect(service.findAll('BIZ-999')).toEqual([]);
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('CUS-999')).toThrow('Customer CUS-999 not found');
  });

  it('normalises both sides of a phone lookup', () => {
    expect(service.findByPhone('9810001001').id).toBe('CUS-001');
    expect(service.findByPhone('+91-98100 01001').id).toBe('CUS-001');
    expect(service.findByPhone('098100-01001').id).toBe('CUS-001');
  });

  it('throws NotFound when no customer carries that phone', () => {
    expect(() => service.findByPhone('9999999999')).toThrow(
      'Customer with phone 9999999999 not found',
    );
  });

  it('honours the company scope on a phone lookup', () => {
    expect(() => service.findByPhone('9810001001', 'BIZ-999')).toThrow(
      'Customer with phone 9810001001 not found',
    );
  });

  it('falls back to a walk-in name and normalises the mobile number', () => {
    const created = service.create({
      companyId: 'BIZ-101',
      name: '   ',
      mobileNo: '+91-98100 09999',
    });

    expect(created.id).toMatch(/^CUS-\d{3}$/);
    expect(created.name).toBe('Walk-in Customer');
    expect(created.mobileNo).toBe('9810009999');
    expect(created.email).toBe('');
    expect(service.findByPhone('9810009999').id).toBe(created.id);
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('CUS-001');
    expect(result.message).toBe('Customer CUS-001 deleted');
    expect(result.customer.id).toBe('CUS-001');
    expect(() => service.findOne('CUS-001')).toThrow('Customer CUS-001 not found');
  });
});

describe('Customers routes', () => {
  const app = buildTestApp();

  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(app).get('/api/customers').set('x-role', 'customer');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows a cashier to list customers (200)', async () => {
    const res = await request(app).get('/api/customers').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('does not let /:id swallow the phone lookup', async () => {
    const res = await request(app)
      .get('/api/customers/phone/9810001001')
      .set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('CUS-001');
  });

  it('normalises a formatted number on the phone lookup (200)', async () => {
    const res = await request(app)
      .get(`/api/customers/phone/${encodeURIComponent('+91-98100 01001')}`)
      .set('x-role', 'customer');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('CUS-001');
  });

  it('returns 404 for an unknown customer id', async () => {
    const res = await request(app)
      .get('/api/customers/CUS-999')
      .set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer CUS-999 not found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(app)
      .get('/api/customers/not-an-id')
      .set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 with field detail when creating an invalid customer', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('x-role', 'cashier')
      .send({ companyId: 'BIZ-101', mobileNo: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('rejects an empty update body (400)', async () => {
    const res = await request(app)
      .put('/api/customers/CUS-001')
      .set('x-role', 'cashier')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/At least one field must be supplied/);
  });
});
