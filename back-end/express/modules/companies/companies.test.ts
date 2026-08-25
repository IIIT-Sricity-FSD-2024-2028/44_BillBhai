import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { createCompaniesRouter } from './companies.routes';
import { CompaniesService } from './companies.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/companies', createCompaniesRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(() => {
    service = new CompaniesService();
  });

  it('lists the seeded companies', () => {
    const companies = service.findAll();
    expect(companies.length).toBeGreaterThan(0);
    expect(companies[0].id).toBe('BIZ-101');
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('BIZ-999')).toThrow('Company BIZ-999 not found');
  });

  it('rejects a duplicate company name or email', () => {
    expect(() =>
      service.create({
        name: 'FreshKart Central',
        email: 'brand-new@freshkart.in',
        phone: '9870011999',
      }),
    ).toThrow('Company name or email already in use');

    expect(() =>
      service.create({
        name: 'Brand New Retail',
        email: 'central@freshkart.in',
        phone: '9870011999',
      }),
    ).toThrow('Company name or email already in use');
  });

  it('applies the documented defaults to a new company', () => {
    const created = service.create({
      name: 'Brand New Retail',
      email: 'hello@brandnew.in',
      phone: '+91-9870011999',
    });

    expect(created.id).toMatch(/^BIZ-\d+$/);
    expect(created.status).toBe('Active');
    expect(created.profit).toBe(0);
    expect(created.paymentDue).toBe(0);
    expect(created.storesCount).toBe(1);
    expect(created.tenureMonths).toBe(0);
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('BIZ-101');
    expect(result.message).toBe('Company BIZ-101 deleted');
    expect(result.company.id).toBe('BIZ-101');
    expect(() => service.findOne('BIZ-101')).toThrow('Company BIZ-101 not found');
  });
});

describe('Companies routes', () => {
  const app = buildTestApp();

  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(app).get('/api/companies').set('x-role', 'admin');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows a superuser to list companies (200)', async () => {
    const res = await request(app).get('/api/companies').set('x-role', 'superuser');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lets an admin read a single company (200)', async () => {
    const res = await request(app)
      .get('/api/companies/BIZ-101')
      .set('x-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('BIZ-101');
  });

  it('returns 404 for an unknown company id', async () => {
    const res = await request(app)
      .get('/api/companies/BIZ-999')
      .set('x-role', 'superuser');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Company BIZ-999 not found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(app)
      .get('/api/companies/not-an-id')
      .set('x-role', 'superuser');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 with field detail when creating an invalid company', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('x-role', 'superuser')
      .send({ name: 'x', email: 'not-an-email', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('rejects an empty update body (400)', async () => {
    const res = await request(app)
      .put('/api/companies/BIZ-101')
      .set('x-role', 'superuser')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/At least one field must be supplied/);
  });
});
