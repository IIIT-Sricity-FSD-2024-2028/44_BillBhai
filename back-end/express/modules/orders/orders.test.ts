import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { OrdersController } from './orders.controller';
import { createOrdersRouter } from './orders.routes';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './orders.schema';

/**
 * Each app gets its own service instance, so a test that creates an order, a
 * bill or a payment can never leak state into the next one.
 */
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/orders', createOrdersRouter(new OrdersController(new OrdersService())));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const sampleOrder: CreateOrderDto = {
  customerId: 'CUS-001',
  staffId: 'USR-002',
  companyId: 'BIZ-101',
  orderType: 'delivery',
  checkoutMode: 'cod_delivery',
  items: [
    { productId: 'P001', quantity: 2, itemPrice: 100 },
    { productId: 'P002', quantity: 1, itemPrice: 50 },
  ],
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(() => {
    service = new OrdersService();
  });

  it('joins every order to its items and derives itemsCount', () => {
    const orders = service.findAllOrders();
    expect(orders.length).toBeGreaterThan(0);

    const order = service.findOneOrder('ORD-4829');
    expect(order.items).toHaveLength(3);
    expect(order.itemsCount).toBe(4);
  });

  it('filters the list by companyId and by status', () => {
    expect(service.findAllOrders('BIZ-999')).toHaveLength(0);
    expect(service.findAllOrders('BIZ-101').length).toBeGreaterThan(0);
    expect(service.findAllOrders(undefined, 'Cancelled')).toHaveLength(0);
  });

  it('throws NotFound for an unknown order', () => {
    expect(() => service.findOneOrder('ORD-9999')).toThrow('Order ORD-9999 not found');
  });

  it('accepts the promo code trimmed and in any case', () => {
    const result = service.validatePromotion('  welcome10 ', 1250);
    expect(result).toEqual({
      valid: true,
      code: 'WELCOME10',
      discount: 125,
      subtotal: 1250,
      total: 1125,
    });
  });

  it('rejects any other promo code', () => {
    expect(() => service.validatePromotion('FREESTUFF', 1250)).toThrow('Invalid promo code');
  });

  it('creates an order at the front of the list with generated ids', () => {
    const created = service.createOrder(sampleOrder);

    expect(created.id).toBe('ORD-4830');
    expect(created.status).toBe('Processing');
    expect(created.total).toBe(250);
    expect(created.itemsCount).toBe(3);
    expect(created.items.map((item) => item.id)).toEqual(['OI-008', 'OI-009']);
    expect(service.findAllOrders()[0].id).toBe('ORD-4830');
  });

  it('applies the promo discount to the order total', () => {
    const created = service.createOrder({ ...sampleOrder, promoCode: 'welcome10' });

    expect(created.discountAmount).toBe(25);
    expect(created.total).toBe(225);
    expect(created.promoCode).toBe('WELCOME10');
  });

  it('refuses to create an order with an unknown promo code', () => {
    expect(() => service.createOrder({ ...sampleOrder, promoCode: 'NOPE' })).toThrow(
      'Invalid promo code',
    );
  });

  it('generates bill, payment and order item ids from the seeded maximum', () => {
    const order = service.createOrder(sampleOrder);
    const bill = service.createBill({ orderId: order.id });
    const payment = service.createPayment({
      billNo: bill.billNo,
      paymentMethod: 'UPI',
      amountPaid: 250,
    });

    expect(bill.billNo).toBe('BILL-004');
    expect(payment.id).toBe('PAY-004');
    expect(payment.paymentStatus).toBe('Paid');
  });

  it('rejects a bill for an unknown order and a duplicate bill for a known one', () => {
    expect(() => service.createBill({ orderId: 'ORD-9999' })).toThrow(
      'Order ORD-9999 not found',
    );
    expect(() => service.createBill({ orderId: 'ORD-4829' })).toThrow(
      'Bill already exists for order ORD-4829',
    );
  });

  it('rejects a payment for an unknown bill and a duplicate payment for a known one', () => {
    expect(() =>
      service.createPayment({ billNo: 'BILL-999', paymentMethod: 'Cash', amountPaid: 10 }),
    ).toThrow('Bill BILL-999 not found');
    expect(() =>
      service.createPayment({ billNo: 'BILL-001', paymentMethod: 'Cash', amountPaid: 10 }),
    ).toThrow('Payment already recorded for bill BILL-001');
  });

  it('updates the status of an existing order', () => {
    const updated = service.updateOrder('ORD-4829', { status: 'Delivered' });
    expect(updated.status).toBe('Delivered');
  });

  it('removes an order together with its order items', () => {
    const result = service.removeOrder('ORD-4829');

    expect(result.message).toBe('Order ORD-4829 deleted');
    expect(() => service.findOneOrder('ORD-4829')).toThrow('Order ORD-4829 not found');
    expect(service.findOneOrder('ORD-4828').items).toHaveLength(1);
  });
});

describe('Orders routes', () => {
  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(buildTestApp()).get('/api/orders');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(buildTestApp()).get('/api/orders').set('x-role', 'customer');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows a cashier to list orders (200)', async () => {
    const res = await request(buildTestApp()).get('/api/orders').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns one order with its items (200)', async () => {
    const res = await request(buildTestApp())
      .get('/api/orders/ORD-4829')
      .set('x-role', 'deliveryops');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ORD-4829');
    expect(res.body.items).toHaveLength(3);
    expect(res.body.itemsCount).toBe(4);
  });

  it('returns 404 for an unknown order', async () => {
    const res = await request(buildTestApp())
      .get('/api/orders/ORD-9999')
      .set('x-role', 'admin');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Order ORD-9999 not found');
  });

  it('creates an order and computes the total (201)', async () => {
    const res = await request(buildTestApp())
      .post('/api/orders')
      .set('x-role', 'cashier')
      .send(sampleOrder);

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(250);
    expect(res.body.itemsCount).toBe(3);
    expect(res.body.items).toHaveLength(2);
  });

  it('rejects an order with an empty items array (400)', async () => {
    const res = await request(buildTestApp())
      .post('/api/orders')
      .set('x-role', 'cashier')
      .send({ ...sampleOrder, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items must contain at least one entry/);
  });

  it('validates a good promo code (200) and refuses a bad one (400)', async () => {
    const app = buildTestApp();

    const good = await request(app)
      .post('/api/orders/promotions/validate')
      .set('x-role', 'customer')
      .send({ code: 'WELCOME10', subtotal: 1250 });
    expect(good.status).toBe(200);
    expect(good.body.discount).toBe(125);
    expect(good.body.total).toBe(1125);

    const bad = await request(app)
      .post('/api/orders/promotions/validate')
      .set('x-role', 'customer')
      .send({ code: 'FREESTUFF', subtotal: 1250 });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Invalid promo code');
  });

  it('serves /bills/all rather than letting /:id swallow it', async () => {
    const res = await request(buildTestApp())
      .get('/api/orders/bills/all')
      .set('x-role', 'cashier');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].billNo).toBe('BILL-001');
  });

  it('serves /payments/all rather than letting /:id swallow it', async () => {
    const res = await request(buildTestApp())
      .get('/api/orders/payments/all')
      .set('x-role', 'cashier');

    expect(res.status).toBe(200);
    expect(res.body[0].billNo).toBe('BILL-001');
  });

  it('returns 409 when a bill already exists for the order', async () => {
    const res = await request(buildTestApp())
      .post('/api/orders/bills')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-4829' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toBe('Bill already exists for order ORD-4829');
  });

  it('returns 409 when a payment is already recorded for the bill', async () => {
    const res = await request(buildTestApp())
      .post('/api/orders/payments')
      .set('x-role', 'cashier')
      .send({ billNo: 'BILL-001', paymentMethod: 'Cash', amountPaid: 1250 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Payment already recorded for bill BILL-001');
  });

  it('creates a bill and its payment for a fresh order (201)', async () => {
    const app = buildTestApp();

    const order = await request(app)
      .post('/api/orders')
      .set('x-role', 'cashier')
      .send(sampleOrder);

    const bill = await request(app)
      .post('/api/orders/bills')
      .set('x-role', 'cashier')
      .send({ orderId: order.body.id, taxAmount: 12.5 });
    expect(bill.status).toBe(201);

    const payment = await request(app)
      .post('/api/orders/payments')
      .set('x-role', 'cashier')
      .send({ billNo: bill.body.billNo, paymentMethod: 'UPI', amountPaid: 250 });
    expect(payment.status).toBe(201);
    expect(payment.body.paymentStatus).toBe('Paid');
  });

  it('returns a validation error for a malformed order id (400)', async () => {
    const res = await request(buildTestApp())
      .get('/api/orders/not-an-id')
      .set('x-role', 'admin');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('only lets superuser or admin delete an order', async () => {
    const denied = await request(buildTestApp())
      .delete('/api/orders/ORD-4829')
      .set('x-role', 'cashier');
    expect(denied.status).toBe(403);

    const allowed = await request(buildTestApp())
      .delete('/api/orders/ORD-4829')
      .set('x-role', 'admin');
    expect(allowed.status).toBe(200);
    expect(allowed.body.message).toBe('Order ORD-4829 deleted');
  });
});
