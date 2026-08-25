import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { ReturnsController } from './returns.controller';
import { createReturnsRouter } from './returns.routes';
import { ReturnsService } from './returns.service';

/**
 * Every app gets its own service instance so a test that creates or deletes a
 * return cannot leak into the next one.
 */
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(
    '/api/returns',
    createReturnsRouter(new ReturnsController(new ReturnsService())),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('ReturnsService', () => {
  let service: ReturnsService;

  beforeEach(() => {
    service = new ReturnsService();
  });

  it('lists the seeded returns', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
  });

  it('filters the list by status', () => {
    const pending = service.findAll('Pending');
    expect(pending.length).toBeGreaterThan(0);
    pending.forEach((entry) => {
      expect(entry.status).toBe('Pending');
    });
    expect(service.findAll('Refunded')).toHaveLength(0);
  });

  it('mints ids from RET-222 upwards', () => {
    const dto = { companyId: 'BIZ-101', orderId: 'ORD-4829', staffId: 'USR-005' };
    expect(service.create(dto).id).toBe('RET-222');
    expect(service.create(dto).id).toBe('RET-223');
  });

  it('applies the documented defaults on create', () => {
    const created = service.create({
      companyId: 'BIZ-101',
      orderId: 'ORD-4829',
      staffId: 'USR-005',
    });

    expect(created.returnDate).toBe(new Date().toISOString().split('T')[0]);
    expect(created.refundAmount).toBe(0);
    expect(created.qty).toBe(1);
    expect(created.status).toBe('Pending');
    expect(created.returnType).toBe('refund');
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('RET-999')).toThrow('Return RET-999 not found');
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('RET-221');
    expect(result.message).toBe('Return RET-221 deleted');
    expect(result['return'].id).toBe('RET-221');
  });
});

describe('Returns routes', () => {
  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(buildTestApp()).get('/api/returns');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp())
      .get('/api/returns')
      .set('x-role', 'cashier');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows a return handler to list returns (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/returns')
      .set('x-role', 'returnhandler');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters the list by status over the query string', async () => {
    const res = await request(buildTestApp())
      .get('/api/returns?status=Pending')
      .set('x-role', 'returnhandler');

    expect(res.status).toBe(200);
    res.body.forEach((entry: { status: string }) => {
      expect(entry.status).toBe('Pending');
    });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(buildTestApp())
      .get('/api/returns/RET-999')
      .set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/returns/not-an-id')
      .set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 when a create is missing required fields', async () => {
    const res = await request(buildTestApp())
      .post('/api/returns')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-4829' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 for a returnType outside the allowed set', async () => {
    const res = await request(buildTestApp())
      .post('/api/returns')
      .set('x-role', 'cashier')
      .send({
        companyId: 'BIZ-101',
        orderId: 'ORD-4829',
        staffId: 'USR-005',
        returnType: 'store-credit',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('creates a return (201)', async () => {
    const res = await request(buildTestApp())
      .post('/api/returns')
      .set('x-role', 'cashier')
      .send({
        companyId: 'BIZ-101',
        orderId: 'ORD-4829',
        staffId: 'USR-005',
        reason: 'Damaged',
        returnType: 'exchange',
        qty: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('RET-222');
    expect(res.body.status).toBe('Pending');
    expect(res.body.returnType).toBe('exchange');
  });

  it('lets an admin delete a return but not a return handler (403)', async () => {
    const app = buildTestApp();
    const denied = await request(app)
      .delete('/api/returns/RET-221')
      .set('x-role', 'returnhandler');
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .delete('/api/returns/RET-221')
      .set('x-role', 'admin');
    expect(allowed.status).toBe(200);
    expect(allowed.body.message).toBe('Return RET-221 deleted');
  });
});
