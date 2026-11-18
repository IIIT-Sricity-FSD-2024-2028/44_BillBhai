import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { ActivityService } from '../activity/activity.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
// Registers the "token belongs to a real, active user" check.
import '../users/users.service';
import { DeliveriesController } from './deliveries.controller';
import { createDeliveriesRouter } from './deliveries.routes';
import { DELIVERY_TRANSITIONS, MAX_DELIVERY_ATTEMPTS } from './deliveries.schema';
import { DeliveriesService } from './deliveries.service';

/**
 * Every test builds its own set of services (orders, stock, deliveries, log),
 * so a delivery that cancels an order or puts stock back cannot leak into the
 * next test.
 */
function buildWorld() {
  const activity = new ActivityService();
  const inventory = new InventoryService(activity);
  const products = new ProductsService(inventory, new SuppliersService(activity), activity);
  const orders = new OrdersService(inventory, products, new CustomersService(), new CouponsService(activity), activity);
  const deliveries = new DeliveriesService(orders, activity);

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/deliveries', createDeliveriesRouter(new DeliveriesController(deliveries, orders)));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, activity, inventory, products, orders, deliveries };
}

type World = ReturnType<typeof buildWorld>;

const CASHIER = { username: 'cashier', staffId: 'USR-002' };

/** A BIZ-101 product that is on sale and has enough units on the shelf. */
function stockedProduct(world: World, min = 5): string {
  const row = world.inventory
    .findAll('BIZ-101')
    .find((r) => r.stockAvailable >= min && world.products.findOne(r.productId).active !== false);
  if (!row) throw new Error('seed has no stocked BIZ-101 product');
  return row.productId;
}

/** A fresh delivery order (no delivery yet), as the till would save it. */
function newDeliveryOrder(world: World, mode: 'prepaid_delivery' | 'cod_delivery' = 'prepaid_delivery', qty = 2) {
  const productId = stockedProduct(world, qty + 1);
  const order = world.orders.createOrder(
    {
      companyId: 'BIZ-101',
      checkoutMode: mode,
      paymentMethod: mode === 'cod_delivery' ? 'COD' : 'UPI',
      customer: { name: 'Asha Rao', phone: '9876543210', address: '12 MG Road, Koregaon Park, Pune' },
      items: [{ productId, quantity: qty }],
    },
    CASHIER,
  );
  return { order, productId };
}

const PARTNER = { partnerName: 'Ravi Kumar', partnerPhone: '9812345678' };

function tokenFor(sub: string, username: string, role: string, companyId: string): string {
  return `Bearer ${signAccessToken({ sub, username, role, companyId })}`;
}

const METRO_ADMIN = tokenFor('USR-008', 'metroadmin', 'admin', 'BIZ-102');
const STORE_ADMIN = tokenFor('USR-001', 'admin', 'admin', 'BIZ-101');

describe('DeliveriesService - reads', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('lists the seeded deliveries, including the fixed ones', () => {
    const ids = world.deliveries.findAll().map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['DEL-900', 'DEL-901']));
  });

  it('filters the list by status and company', () => {
    const onRoad = world.deliveries.findAll('Out for Delivery');
    expect(onRoad.map((d) => d.id)).toContain('DEL-900');
    onRoad.forEach((d) => expect(d.status).toBe('Out for Delivery'));

    const metro = world.deliveries.findAll(undefined, 'BIZ-102');
    metro.forEach((d) => expect(d.companyId).toBe('BIZ-102'));
    expect(metro.map((d) => d.id)).not.toContain('DEL-901');
  });

  it('keeps the fixed records in their documented state', () => {
    const del901 = world.deliveries.findOne('DEL-901');
    expect(del901.orderId).toBe('ORD-4829');
    expect(del901.status).toBe('Assigned');
    expect(del901.codAmount).toBe(0);

    const del900 = world.deliveries.findOne('DEL-900');
    expect(del900.orderId).toBe('ORD-4828');
    expect(del900.status).toBe('Out for Delivery');
    expect(del900.codAmount).toBe(world.orders.findOneOrder('ORD-4828').total);
  });

  it('finds a delivery by its order id', () => {
    expect(world.deliveries.findByOrder('ORD-4829').id).toBe('DEL-901');
  });

  it('throws NotFound when an order has no delivery, or for an unknown id', () => {
    expect(() => world.deliveries.findByOrder('ORD-9999')).toThrow('No delivery for order ORD-9999');
    expect(() => world.deliveries.findOne('DEL-999')).toThrow('Delivery DEL-999 not found');
  });
});

describe('DeliveriesService - create', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('refuses an order that does not exist', () => {
    expect(() => world.deliveries.create({ orderId: 'ORD-99999' })).toThrow('Order ORD-99999 not found');
  });

  it('refuses a counter sale', () => {
    expect(() => world.deliveries.create({ orderId: 'ORD-4827' })).toThrow(/counter sale, not a delivery order/);
  });

  it('refuses an order that already has an open delivery', () => {
    expect(() => world.deliveries.create({ orderId: 'ORD-4829' })).toThrow(/already has delivery DEL-901/);
  });

  it('creates a Pending delivery from the order address and phone when no partner is given', () => {
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({ orderId: order.id }, 'cashier');

    expect(created.id).toMatch(/^DEL-\d+$/);
    expect(created.status).toBe('Pending');
    expect(created.companyId).toBe('BIZ-101');
    expect(created.address).toBe('12 MG Road, Koregaon Park, Pune');
    expect(created.customerPhone).toBe('9876543210');
    expect(created.codAmount).toBe(0);
    expect(created.attempts).toBe(0);
    expect(created.deliveryDate).toBeNull();
    expect(created.history?.map((h) => h.status)).toEqual(['Pending']);
    expect(world.deliveries.findByOrder(order.id).id).toBe(created.id);
  });

  it('creates an Assigned delivery and stores every partner detail', () => {
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({
      orderId: order.id,
      partnerName: 'Ravi Kumar',
      partnerPhone: '+91 98123 45678',
      partnerAgency: 'Dunzo',
      partnerVehicle: 'MH12AB1234',
      etaMinutes: 30,
    });

    expect(created.status).toBe('Assigned');
    expect(created.partnerName).toBe('Ravi Kumar');
    expect(created.partnerPhone).toBe('9812345678');
    expect(created.partnerAgency).toBe('Dunzo');
    expect(created.partnerVehicle).toBe('MH12AB1234');
    expect(created.etaMinutes).toBe(30);
    expect(created.history?.map((h) => h.status)).toEqual(['Pending', 'Assigned']);
  });

  it('refuses a partner without a valid phone number', () => {
    const { order } = newDeliveryOrder(world);
    expect(() => world.deliveries.create({ orderId: order.id, partnerName: 'Ravi' })).toThrow(/partner's phone/);
    expect(() =>
      world.deliveries.create({ orderId: order.id, partnerName: 'Ravi', partnerPhone: '12345' }),
    ).toThrow('Partner phone must be a 10-digit mobile number');
  });

  it('sets the COD amount to the bill for a cash-on-delivery order', () => {
    const { order } = newDeliveryOrder(world, 'cod_delivery');
    expect(order.paymentStatus).toBe('Pending');
    const created = world.deliveries.create({ orderId: order.id });
    expect(created.codAmount).toBe(order.total);
    expect(created.codAmount).toBeGreaterThan(0);
  });

  it('logs the creation in the activity log', () => {
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({ orderId: order.id }, 'cashier');
    const entries = world.activity.find({ entity: 'delivery', entityId: created.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('create');
    expect(entries[0].by).toBe('cashier');
  });
});

describe('DeliveriesService - status flow', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('declares Delivered, Returned to Store and Cancelled as final', () => {
    expect(DELIVERY_TRANSITIONS.Delivered).toEqual([]);
    expect(DELIVERY_TRANSITIONS['Returned to Store']).toEqual([]);
    expect(DELIVERY_TRANSITIONS.Cancelled).toEqual([]);
  });

  it('refuses a move that skips a step and names the allowed ones', () => {
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({ orderId: order.id });
    expect(() => world.deliveries.transition(created.id, { status: 'Dispatched' })).toThrow(
      `Delivery ${created.id} is Pending; next it can be Assigned, Cancelled`,
    );
    expect(world.deliveries.findOne(created.id).status).toBe('Pending');
  });

  it('needs a partner name and phone to assign', () => {
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({ orderId: order.id });
    expect(() => world.deliveries.transition(created.id, { status: 'Assigned' })).toThrow(
      'Pick a delivery partner and give their phone number',
    );
    expect(() =>
      world.deliveries.transition(created.id, { status: 'Assigned', partnerName: 'Ravi Kumar' }),
    ).toThrow('Pick a delivery partner and give their phone number');

    const assigned = world.deliveries.transition(created.id, { status: 'Assigned', ...PARTNER }, 'deliveryops');
    expect(assigned.status).toBe('Assigned');
    expect(assigned.partnerName).toBe('Ravi Kumar');
    expect(assigned.etaMinutes).toBe(45);
    expect(assigned.history?.[assigned.history.length - 1]).toMatchObject({ status: 'Assigned', by: 'deliveryops' });
  });

  it('unassigning (back to Pending) clears the partner', () => {
    const pending = world.deliveries.transition('DEL-901', { status: 'Pending' });
    expect(pending.partnerName).toBe('');
    expect(pending.partnerPhone).toBe('');
  });

  it('marks the order Shipped when the parcel is dispatched', () => {
    expect(world.orders.findOneOrder('ORD-4829').status).toBe('Processing');
    const dispatched = world.deliveries.transition('DEL-901', { status: 'Dispatched' });
    expect(dispatched.status).toBe('Dispatched');
    expect(world.orders.findOneOrder('ORD-4829').status).toBe('Shipped');
  });

  it('needs the receiver name to mark a prepaid delivery Delivered', () => {
    world.deliveries.transition('DEL-901', { status: 'Dispatched' });
    expect(() => world.deliveries.transition('DEL-901', { status: 'Delivered' })).toThrow(
      'Enter the name of the person who received the parcel',
    );

    const delivered = world.deliveries.transition('DEL-901', { status: 'Delivered', receiverName: 'Neha' });
    expect(delivered.status).toBe('Delivered');
    expect(delivered.receiverName).toBe('Neha');
    expect(delivered.deliveryDate).toBeTruthy();
    const order = world.orders.findOneOrder('ORD-4829');
    expect(order.status).toBe('Delivered');
    expect(order.paymentStatus).toBe('Paid');
  });

  it('a COD delivery needs the cash collected', () => {
    expect(() => world.deliveries.transition('DEL-900', { status: 'Delivered', receiverName: 'Ramesh' })).toThrow(
      /This is a COD order: enter the cash collected/,
    );
  });

  it('a COD delivery refuses a cash amount that is not the bill, and changes nothing', () => {
    const order = world.orders.findOneOrder('ORD-4828');
    const paymentsBefore = order.payments!.length;
    expect(() =>
      world.deliveries.transition('DEL-900', {
        status: 'Delivered',
        receiverName: 'Ramesh',
        cashCollected: order.total - 10,
      }),
    ).toThrow(`Collect exactly ₹${order.total} for order ORD-4828`);

    expect(world.deliveries.findOne('DEL-900').status).toBe('Out for Delivery');
    const after = world.orders.findOneOrder('ORD-4828');
    expect(after.paymentStatus).toBe('Pending');
    expect(after.status).toBe('Shipped');
    expect(after.payments).toHaveLength(paymentsBefore);
  });

  it('a COD delivery with the exact cash records the payment and closes the order', () => {
    const total = world.orders.findOneOrder('ORD-4828').total;
    const delivered = world.deliveries.transition(
      'DEL-900',
      { status: 'Delivered', receiverName: 'Ramesh', cashCollected: total },
      'deliveryops',
    );

    expect(delivered.status).toBe('Delivered');
    expect(delivered.cashCollected).toBe(total);
    const order = world.orders.findOneOrder('ORD-4828');
    expect(order.status).toBe('Delivered');
    expect(order.paymentStatus).toBe('Paid');
    const cash = order.payments!.filter((p) => p.paymentMethod === 'Cash' && p.paymentStatus === 'Paid');
    expect(cash).toHaveLength(1);
    expect(cash[0].amountPaid).toBe(total);
    expect(cash[0].collectedBy).toBe('deliveryops');
  });

  it('a Delivered parcel cannot change any more', () => {
    const total = world.orders.findOneOrder('ORD-4828').total;
    world.deliveries.transition('DEL-900', { status: 'Delivered', receiverName: 'Ramesh', cashCollected: total });
    expect(() => world.deliveries.transition('DEL-900', { status: 'Failed Attempt', failureReason: 'oops' })).toThrow(
      'Delivery DEL-900 is Delivered and cannot change any more',
    );
    expect(() => world.deliveries.update('DEL-900', { partnerAgency: 'Other' })).toThrow(/can no longer change/);
  });

  it('a failed attempt needs a reason and is counted', () => {
    expect(() => world.deliveries.transition('DEL-900', { status: 'Failed Attempt' })).toThrow(
      'Say why the delivery failed',
    );
    const failed = world.deliveries.transition('DEL-900', {
      status: 'Failed Attempt',
      failureReason: 'Customer not reachable',
    });
    expect(failed.status).toBe('Failed Attempt');
    expect(failed.attempts).toBe(1);
    expect(failed.failureReason).toBe('Customer not reachable');

    const retry = world.deliveries.transition('DEL-900', { status: 'Assigned' });
    expect(retry.status).toBe('Assigned');
  });

  it(`allows at most ${MAX_DELIVERY_ATTEMPTS} attempts, then only Returned to Store`, () => {
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      const failed = world.deliveries.transition('DEL-900', {
        status: 'Failed Attempt',
        failureReason: 'Door locked',
      });
      expect(failed.attempts).toBe(attempt);
      if (attempt < MAX_DELIVERY_ATTEMPTS) {
        world.deliveries.transition('DEL-900', { status: 'Assigned' });
        world.deliveries.transition('DEL-900', { status: 'Dispatched' });
      }
    }
    expect(() => world.deliveries.transition('DEL-900', { status: 'Assigned' })).toThrow(
      `Delivery DEL-900 has failed ${MAX_DELIVERY_ATTEMPTS} times. Return it to the store.`,
    );
    expect(world.deliveries.transition('DEL-900', { status: 'Returned to Store' }).status).toBe('Returned to Store');
  });

  it('Returned to Store cancels the order and puts every unit back on the shelf', () => {
    const order = world.orders.findOneOrder('ORD-4828');
    const before = new Map(order.items.map((i) => [i.productId, world.inventory.stockFor(i.productId)!]));

    world.deliveries.transition('DEL-900', { status: 'Failed Attempt', failureReason: 'Wrong address' });
    world.deliveries.transition('DEL-900', { status: 'Returned to Store' }, 'deliveryops');

    order.items.forEach((item) => {
      expect(world.inventory.stockFor(item.productId)).toBe(before.get(item.productId)! + item.quantity);
      const moves = world.inventory.findMovements({ productId: item.productId, type: 'cancel' });
      expect(moves[0]).toMatchObject({ refId: 'ORD-4828', quantity: item.quantity, by: 'deliveryops' });
    });
    const after = world.orders.findOneOrder('ORD-4828');
    expect(after.status).toBe('Cancelled');
    // COD that was never collected is voided, not refunded.
    expect(after.paymentStatus).toBe('Voided');
    expect(after.refundedAmount).toBe(0);
  });

  it('Cancelled (before dispatch) cancels a prepaid order, restocks it and marks the money to refund', () => {
    const before = { P001: world.inventory.stockFor('P001')!, P002: world.inventory.stockFor('P002')!, P003: world.inventory.stockFor('P003')! };
    const cancelled = world.deliveries.transition('DEL-901', { status: 'Cancelled', note: 'Customer called to cancel' });

    expect(cancelled.status).toBe('Cancelled');
    expect(world.inventory.stockFor('P001')).toBe(before.P001 + 1);
    expect(world.inventory.stockFor('P002')).toBe(before.P002 + 2);
    expect(world.inventory.stockFor('P003')).toBe(before.P003 + 1);
    const order = world.orders.findOneOrder('ORD-4829');
    expect(order.status).toBe('Cancelled');
    expect(order.paymentStatus).toBe('Refunded');
    expect(order.refundedAmount).toBe(order.total);
    expect(order.cancelReason).toBe('Customer called to cancel');
  });

  it('cannot cancel a parcel that is already on the road', () => {
    expect(() => world.deliveries.transition('DEL-900', { status: 'Cancelled' })).toThrow(
      'Delivery DEL-900 is Out for Delivery; next it can be Delivered, Failed Attempt',
    );
  });

  it('refuses a stale version', () => {
    const current = world.deliveries.findOne('DEL-901');
    expect(() =>
      world.deliveries.transition('DEL-901', { status: 'Dispatched', version: Number(current.version) + 5 }),
    ).toThrow(/since you opened it/);
  });

  it('writes every status change to the activity log', () => {
    world.deliveries.transition('DEL-901', { status: 'Dispatched' }, 'deliveryops');
    const entries = world.activity.find({ entity: 'delivery', entityId: 'DEL-901' });
    expect(entries[0]).toMatchObject({ action: 'status', by: 'deliveryops', companyId: 'BIZ-101' });
    expect(entries[0].summary).toContain('Assigned → Dispatched');
  });
});

describe('DeliveriesService - update and delete', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('corrects partner details without moving the parcel', () => {
    const updated = world.deliveries.update('DEL-901', { partnerAgency: 'Shadowfax', etaMinutes: 20 });
    expect(updated.status).toBe('Assigned');
    expect(updated.partnerAgency).toBe('Shadowfax');
    expect(updated.etaMinutes).toBe(20);
  });

  it('refuses to clear the partner of an assigned delivery', () => {
    expect(() => world.deliveries.update('DEL-901', { partnerPhone: '' })).toThrow(
      'An assigned delivery needs a partner name and phone',
    );
  });

  it('refuses an address change while the parcel is on the road', () => {
    expect(() => world.deliveries.update('DEL-900', { address: '99 New Street, Pune' })).toThrow(
      'The address cannot change while the parcel is on the road',
    );
  });

  it('routes a status sent through update through the same flow rules', () => {
    const dispatched = world.deliveries.update('DEL-901', { status: 'Dispatched' });
    expect(dispatched.status).toBe('Dispatched');
    expect(world.orders.findOneOrder('ORD-4829').status).toBe('Shipped');
    expect(() => world.deliveries.update('DEL-901', { status: 'Cancelled' })).toThrow(/next it can be/);
  });

  it('deletes only a Pending delivery', () => {
    expect(() => world.deliveries.remove('DEL-901')).toThrow(
      'Delivery DEL-901 is Assigned. Cancel it instead of deleting it.',
    );
    const { order } = newDeliveryOrder(world);
    const created = world.deliveries.create({ orderId: order.id });
    const result = world.deliveries.remove(created.id);
    expect(result.message).toBe(`Delivery ${created.id} deleted`);
    expect(() => world.deliveries.findOne(created.id)).toThrow('not found');
  });
});

describe('Deliveries routes', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('rejects a request with no credential (401)', async () => {
    const res = await request(world.app).get('/api/deliveries');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Please sign in to continue.');
  });

  it('rejects an invalid bearer token (401)', async () => {
    const res = await request(world.app).get('/api/deliveries').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(world.app).get('/api/deliveries').set('x-role', 'returnhandler');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('lets cashiers read but not move a delivery (403)', async () => {
    const read = await request(world.app).get('/api/deliveries/DEL-901').set('x-role', 'cashier');
    expect(read.status).toBe(200);
    const move = await request(world.app)
      .post('/api/deliveries/DEL-901/status')
      .set('x-role', 'cashier')
      .send({ status: 'Dispatched' });
    expect(move.status).toBe(403);
  });

  it('lists deliveries joined to their order', async () => {
    const res = await request(world.app).get('/api/deliveries').set('x-role', 'deliveryops');
    expect(res.status).toBe(200);
    const del900 = res.body.find((d: { id: string }) => d.id === 'DEL-900');
    const order = world.orders.findOneOrder('ORD-4828');
    expect(del900).toMatchObject({ orderTotal: order.total, paymentMethod: 'COD', orderStatus: 'Shipped' });
    expect(del900.items).toHaveLength(order.items.length);
  });

  it('serves /order/ORD-4829 without it being swallowed by /:id', async () => {
    const res = await request(world.app).get('/api/deliveries/order/ORD-4829').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('DEL-901');
    expect(res.body.paymentMethod).toBe('UPI');
    expect(res.body.items.map((i: { productId: string }) => i.productId).sort()).toEqual(['P001', 'P002', 'P003']);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const missing = await request(world.app).get('/api/deliveries/DEL-999').set('x-role', 'admin');
    expect(missing.status).toBe(404);
    const malformed = await request(world.app).get('/api/deliveries/not-an-id').set('x-role', 'admin');
    expect(malformed.status).toBe(400);
    expect(malformed.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 when a create is missing its orderId', async () => {
    const res = await request(world.app).post('/api/deliveries').set('x-role', 'cashier').send({});
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('refuses a delivery for a counter sale (400) and a second open delivery (409)', async () => {
    const counter = await request(world.app)
      .post('/api/deliveries')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-4827' });
    expect(counter.status).toBe(400);
    const twice = await request(world.app)
      .post('/api/deliveries')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-4829' });
    expect(twice.status).toBe(409);
  });

  it('creates a delivery for a new delivery order (201)', async () => {
    const { order } = newDeliveryOrder(world);
    const res = await request(world.app)
      .post('/api/deliveries')
      .set('x-role', 'cashier')
      .send({ orderId: order.id, ...PARTNER, partnerVehicle: 'MH12XY9999' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Assigned');
    expect(res.body.partnerVehicle).toBe('MH12XY9999');
    expect(res.body.orderTotal).toBe(order.total);
  });

  it('returns 400 for a status outside the list', async () => {
    const res = await request(world.app)
      .put('/api/deliveries/DEL-901')
      .set('x-role', 'deliveryops')
      .send({ status: 'Teleported' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 409 for a move the flow does not allow', async () => {
    const res = await request(world.app)
      .post('/api/deliveries/DEL-901/status')
      .set('x-role', 'deliveryops')
      .send({ status: 'Delivered', receiverName: 'Neha' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('next it can be Dispatched, Pending, Cancelled');
  });

  it('dispatches through PUT with a status and reports the order as Shipped', async () => {
    const res = await request(world.app)
      .put('/api/deliveries/DEL-901')
      .set('x-role', 'deliveryops')
      .send({ status: 'Dispatched' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Dispatched');
    expect(res.body.orderStatus).toBe('Shipped');
  });

  it('collects COD cash: wrong amount 400, exact amount closes the order', async () => {
    const total = world.orders.findOneOrder('ORD-4828').total;
    const wrong = await request(world.app)
      .post('/api/deliveries/DEL-900/status')
      .set('x-role', 'deliveryops')
      .send({ status: 'Delivered', receiverName: 'Ramesh', cashCollected: total + 100 });
    expect(wrong.status).toBe(400);

    const right = await request(world.app)
      .post('/api/deliveries/DEL-900/status')
      .set('x-role', 'deliveryops')
      .send({ status: 'Delivered', receiverName: 'Ramesh', cashCollected: total });
    expect(right.status).toBe(200);
    expect(right.body).toMatchObject({ status: 'Delivered', orderStatus: 'Delivered', paymentStatus: 'Paid' });
  });

  it('lets an admin delete only a Pending delivery, and never delivery ops (403)', async () => {
    const denied = await request(world.app).delete('/api/deliveries/DEL-901').set('x-role', 'deliveryops');
    expect(denied.status).toBe(403);
    const assigned = await request(world.app).delete('/api/deliveries/DEL-901').set('x-role', 'admin');
    expect(assigned.status).toBe(409);
  });

  describe('company scoping', () => {
    it('lets a store admin work on their own deliveries', async () => {
      const res = await request(world.app).get('/api/deliveries/DEL-901').set('Authorization', STORE_ADMIN);
      expect(res.status).toBe(200);
    });

    it("lists only the signed-in user's company", async () => {
      const res = await request(world.app).get('/api/deliveries').set('Authorization', METRO_ADMIN);
      expect(res.status).toBe(200);
      res.body.forEach((d: { companyId: string }) => expect(d.companyId).toBe('BIZ-102'));
      expect(res.body.map((d: { id: string }) => d.id)).not.toContain('DEL-901');
    });

    it("refuses to list another company's deliveries (403)", async () => {
      const res = await request(world.app)
        .get('/api/deliveries?companyId=BIZ-101')
        .set('Authorization', METRO_ADMIN);
      expect(res.status).toBe(403);
    });

    it("reports another company's delivery as not found (404)", async () => {
      const one = await request(world.app).get('/api/deliveries/DEL-901').set('Authorization', METRO_ADMIN);
      expect(one.status).toBe(404);
      const byOrder = await request(world.app)
        .get('/api/deliveries/order/ORD-4829')
        .set('Authorization', METRO_ADMIN);
      expect(byOrder.status).toBe(404);
    });

    it("cannot move, edit or create a delivery for another company's order (404)", async () => {
      const move = await request(world.app)
        .post('/api/deliveries/DEL-901/status')
        .set('Authorization', METRO_ADMIN)
        .send({ status: 'Cancelled' });
      expect(move.status).toBe(404);
      expect(world.deliveries.findOne('DEL-901').status).toBe('Assigned');

      const edit = await request(world.app)
        .put('/api/deliveries/DEL-901')
        .set('Authorization', METRO_ADMIN)
        .send({ partnerAgency: 'Hijack' });
      expect(edit.status).toBe(404);

      const { order } = newDeliveryOrder(world);
      const create = await request(world.app)
        .post('/api/deliveries')
        .set('Authorization', METRO_ADMIN)
        .send({ orderId: order.id });
      expect(create.status).toBe(404);
    });

    it('signs out a token whose user no longer matches (role changed)', async () => {
      const forged = tokenFor('USR-008', 'metroadmin', 'deliveryops', 'BIZ-102');
      const res = await request(world.app).get('/api/deliveries').set('Authorization', forged);
      expect(res.status).toBe(401);
    });
  });
});
