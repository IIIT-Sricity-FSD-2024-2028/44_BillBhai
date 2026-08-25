import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { DeliveriesController } from './deliveries.controller';
import { createDeliveriesRouter } from './deliveries.routes';
import { DeliveriesService } from './deliveries.service';

/**
 * Every app gets its own service instance so a test that creates or deletes a
 * delivery cannot leak into the next one.
 */
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(
    '/api/deliveries',
    createDeliveriesRouter(new DeliveriesController(new DeliveriesService())),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('DeliveriesService', () => {
  let service: DeliveriesService;

  beforeEach(() => {
    service = new DeliveriesService();
  });

  it('lists the seeded deliveries', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
  });

  it('filters the list by status', () => {
    const inTransit = service.findAll('In Transit');
    expect(inTransit.length).toBeGreaterThan(0);
    inTransit.forEach((delivery) => {
      expect(delivery.status).toBe('In Transit');
    });
  });

  it('mints ids from DEL-902 upwards', () => {
    expect(service.create({ orderId: 'ORD-5000' }).id).toBe('DEL-902');
    expect(service.create({ orderId: 'ORD-5001' }).id).toBe('DEL-903');
  });

  it('defaults dispatchDate to today and deliveryDate to null', () => {
    const created = service.create({ orderId: 'ORD-5000' });
    expect(created.dispatchDate).toBe(new Date().toISOString().split('T')[0]);
    expect(created.deliveryDate).toBeNull();
    expect(created.status).toBe('Pending');
  });

  it('finds a delivery by its order id', () => {
    expect(service.findByOrder('ORD-4829').id).toBe('DEL-901');
  });

  it('throws NotFound when an order has no delivery', () => {
    expect(() => service.findByOrder('ORD-9999')).toThrow(
      'No delivery for order ORD-9999',
    );
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('DEL-999')).toThrow('Delivery DEL-999 not found');
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('DEL-901');
    expect(result.message).toBe('Delivery DEL-901 deleted');
    expect(result.delivery.id).toBe('DEL-901');
  });
});

describe('Deliveries routes', () => {
  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(buildTestApp()).get('/api/deliveries');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp())
      .get('/api/deliveries')
      .set('x-role', 'cashier');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows delivery ops to list deliveries (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/deliveries')
      .set('x-role', 'deliveryops');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('serves /order/ORD-4829 without it being swallowed by /:id', async () => {
    const res = await request(buildTestApp())
      .get('/api/deliveries/order/ORD-4829')
      .set('x-role', 'cashier');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('DEL-901');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(buildTestApp())
      .get('/api/deliveries/DEL-999')
      .set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/deliveries/not-an-id')
      .set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 when a create is missing its orderId', async () => {
    const res = await request(buildTestApp())
      .post('/api/deliveries')
      .set('x-role', 'cashier')
      .send({ customerName: 'Nobody' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 for a status outside the flow', async () => {
    const res = await request(buildTestApp())
      .put('/api/deliveries/DEL-901')
      .set('x-role', 'deliveryops')
      .send({ status: 'Teleported' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('creates a delivery (201)', async () => {
    const res = await request(buildTestApp())
      .post('/api/deliveries')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-5000', customerName: 'Asha Rao' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('DEL-902');
    expect(res.body.status).toBe('Pending');
  });

  it('lets an admin delete a delivery but not delivery ops (403)', async () => {
    const app = buildTestApp();
    const denied = await request(app)
      .delete('/api/deliveries/DEL-901')
      .set('x-role', 'deliveryops');
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .delete('/api/deliveries/DEL-901')
      .set('x-role', 'admin');
    expect(allowed.status).toBe(200);
    expect(allowed.body.message).toBe('Delivery DEL-901 deleted');
  });
});
