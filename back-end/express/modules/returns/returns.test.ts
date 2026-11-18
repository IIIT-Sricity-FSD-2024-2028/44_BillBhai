import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { round2 } from '../../utils/money';
import { ActivityService } from '../activity/activity.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
// Registers the "token belongs to a real, active user" check.
import '../users/users.service';
import { ReturnsController } from './returns.controller';
import { createReturnsRouter } from './returns.routes';
import { RETURN_TRANSITIONS, RETURN_WINDOW_DAYS } from './returns.schema';
import { ReturnsService } from './returns.service';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Every test builds its own orders, stock, returns and activity log, so a
 * refund that restocks or changes an order cannot leak into the next test.
 */
function buildWorld() {
  const activity = new ActivityService();
  const inventory = new InventoryService(activity);
  const products = new ProductsService(inventory, new SuppliersService(activity), activity);
  const orders = new OrdersService(inventory, products, new CustomersService(), new CouponsService(activity), activity);
  const returns = new ReturnsService(orders, inventory, activity);

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/returns', createReturnsRouter(new ReturnsController(returns, orders)));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, activity, inventory, products, orders, returns };
}

type World = ReturnType<typeof buildWorld>;

const CASHIER = { username: 'cashier', staffId: 'USR-002' };
const DESK = { username: 'returnhandler', staffId: 'USR-005' };

function tokenFor(sub: string, username: string, role: string, companyId: string): string {
  return `Bearer ${signAccessToken({ sub, username, role, companyId })}`;
}

const METRO_ADMIN = tokenFor('USR-008', 'metroadmin', 'admin', 'BIZ-102');
const STORE_DESK = tokenFor('USR-005', 'returnhandler', 'returnhandler', 'BIZ-101');

/** BIZ-101 products that are on sale with enough stock, cheapest first. */
function stockedProducts(world: World, min = 5): string[] {
  return world.inventory
    .findAll('BIZ-101')
    .filter((r) => r.stockAvailable >= min && world.products.findOne(r.productId).active !== false)
    .map((r) => r.productId);
}

/** A fresh, paid counter sale. */
function counterSale(world: World, lines: Array<{ productId: string; quantity: number }>, promoCode?: string) {
  return world.orders.createOrder(
    { companyId: 'BIZ-101', checkoutMode: 'takeaway_now', paymentMethod: 'UPI', items: lines, promoCode },
    CASHIER,
  );
}

describe('ReturnsService - reads', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('keeps the fixed returns on ORD-4827', () => {
    const ret220 = world.returns.findOne('RET-220');
    expect(ret220).toMatchObject({ orderId: 'ORD-4827', status: 'Refunded', restock: false, refundMethod: 'Cash' });
    expect(ret220.items).toEqual([expect.objectContaining({ productId: 'P006', qty: 1 })]);
    const ret221 = world.returns.findOne('RET-221');
    expect(ret221).toMatchObject({ orderId: 'ORD-4827', status: 'Pending' });
    expect(ret221.items).toEqual([expect.objectContaining({ productId: 'P005', qty: 1 })]);
  });

  it('filters the list by status and company', () => {
    const pending = world.returns.findAll('Pending');
    expect(pending.map((r) => r.id)).toContain('RET-221');
    pending.forEach((r) => expect(r.status).toBe('Pending'));
    expect(world.returns.findAll('Refunded').map((r) => r.id)).toContain('RET-220');
    world.returns.findAll(undefined, 'BIZ-102').forEach((r) => expect(r.companyId).toBe('BIZ-102'));
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => world.returns.findOne('RET-999')).toThrow('Return RET-999 not found');
  });
});

describe('ReturnsService - returnable', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('shows what is left to return on ORD-4827, counting Pending and Refunded returns', () => {
    const state = world.returns.returnable('ORD-4827');
    expect(state.eligible).toBe(true);
    expect(state.companyId).toBe('BIZ-101');
    const byId = Object.fromEntries(state.lines.map((l) => [l.productId, l]));
    expect(byId.P005).toMatchObject({ sold: 2, returned: 1, returnable: 1 });
    expect(byId.P006).toMatchObject({ sold: 1, returned: 1, returnable: 0 });
    expect(byId.P001).toMatchObject({ sold: 1, returned: 0, returnable: 1 });
  });

  it('prices each unit at what the customer paid', () => {
    const order = world.orders.findOneOrder('ORD-4827');
    const keep = (order.subtotal! - order.discountAmount) / order.subtotal!;
    world.returns.returnable('ORD-4827').lines.forEach((line) => {
      expect(line.unitPrice).toBeCloseTo(round2(line.itemPrice * keep), 2);
    });
  });

  it('a Rejected return no longer counts against what can be returned', () => {
    world.returns.transition('RET-221', { status: 'Rejected', rejectReason: 'Seal broken' });
    const p005 = world.returns.returnable('ORD-4827').lines.find((l) => l.productId === 'P005')!;
    expect(p005.returnable).toBe(2);
  });

  it('refuses an unknown order', () => {
    expect(() => world.returns.returnable('ORD-99999')).toThrow('Order ORD-99999 does not exist');
  });

  it('is not eligible before the order reaches the customer', () => {
    const processing = world.returns.returnable('ORD-4829');
    expect(processing.eligible).toBe(false);
    expect(processing.reason).toBe('This order has not reached the customer yet');
    expect(world.returns.returnable('ORD-4828').eligible).toBe(false);
  });

  it('is not eligible for a cancelled order', () => {
    const [productId] = stockedProducts(world);
    const sale = counterSale(world, [{ productId, quantity: 1 }]);
    world.orders.cancelOrder(sale.id, 'Rang up by mistake');
    expect(world.returns.returnable(sale.id)).toMatchObject({ eligible: false, reason: 'This order was cancelled' });
  });

  it('is not eligible for a delivered order that has not been paid', () => {
    const [productId] = stockedProducts(world);
    const cod = world.orders.createOrder(
      {
        companyId: 'BIZ-101',
        checkoutMode: 'cod_delivery',
        customer: { name: 'Asha', phone: '9876543210', address: '12 MG Road, Pune 411001' },
        items: [{ productId, quantity: 1 }],
      },
      CASHIER,
    );
    world.orders.setDeliveryStatus(cod.id, 'Delivered');
    expect(world.returns.returnable(cod.id)).toMatchObject({
      eligible: false,
      reason: 'This order has not been paid for',
    });
  });

  it(`is not eligible after ${RETURN_WINDOW_DAYS} days`, () => {
    const later = Date.now() + (RETURN_WINDOW_DAYS + 2) * DAY;
    const state = world.returns.returnable('ORD-4827', later);
    expect(state.eligible).toBe(false);
    expect(state.reason).toMatch(`Returns are accepted within ${RETURN_WINDOW_DAYS} days`);
  });
});

describe('ReturnsService - create', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('creates a Pending refund return from several lines, with the refund worked out here', () => {
    const state = world.returns.returnable('ORD-4827');
    const unit = (id: string) => state.lines.find((l) => l.productId === id)!.unitPrice;

    const created = world.returns.create(
      {
        orderId: 'ORD-4827',
        items: [
          { productId: 'P005', qty: 1 },
          { productId: 'P001', qty: 1 },
        ],
        reason: 'Expired',
        returnType: 'refund',
      },
      DESK,
    );

    expect(created.id).toMatch(/^RET-\d+$/);
    expect(created).toMatchObject({ status: 'Pending', companyId: 'BIZ-101', orderId: 'ORD-4827', qty: 2, staffId: 'USR-005' });
    expect(created.items).toHaveLength(2);
    expect(created.refundAmount).toBeCloseTo(round2(unit('P005') + unit('P001')), 2);
    // The India calendar day, like the sales report.
    expect(created.returnDate).toBe(new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10));
    expect(world.activity.find({ entity: 'return', entityId: created.id })[0].action).toBe('create');
  });

  it('accepts the legacy single-line form, by product id or name', () => {
    const byId = world.returns.create(
      { orderId: 'ORD-4827', product: 'P001', qty: 1, reason: 'Wrong item', returnType: 'refund' },
      DESK,
    );
    expect(byId.items).toEqual([expect.objectContaining({ productId: 'P001', qty: 1 })]);

    const fresh = buildWorld();
    const p001Name = fresh.orders.findOneOrder('ORD-4827').items.find((i) => i.productId === 'P001')!.productName!;
    const byName = fresh.returns.create(
      { orderId: 'ORD-4827', product: p001Name.toUpperCase(), qty: 1, reason: 'Wrong item', returnType: 'refund' },
      DESK,
    );
    expect(byName.items?.[0].productId).toBe('P001');
  });

  it('refuses an item that is not on the order', () => {
    expect(() =>
      world.returns.create(
        { orderId: 'ORD-4827', items: [{ productId: 'P010', qty: 1 }], reason: 'Damaged', returnType: 'refund' },
        DESK,
      ),
    ).toThrow('P010 is not on order ORD-4827');
  });

  it('refuses more than was bought minus what is already returned or waiting', () => {
    expect(() =>
      world.returns.create(
        { orderId: 'ORD-4827', items: [{ productId: 'P005', qty: 2 }], reason: 'Expired', returnType: 'refund' },
        DESK,
      ),
    ).toThrow(/Only 1 of .* can be returned from ORD-4827 \(bought 2, already returned 1\)/);
  });

  it('adds up repeated lines for the same product before checking', () => {
    expect(() =>
      world.returns.create(
        {
          orderId: 'ORD-4827',
          items: [
            { productId: 'P005', qty: 1 },
            { productId: 'P005', qty: 1 },
          ],
          reason: 'Expired',
          returnType: 'refund',
        },
        DESK,
      ),
    ).toThrow(/Only 1 of/);
  });

  it('refuses an item that is already fully returned', () => {
    expect(() =>
      world.returns.create(
        { orderId: 'ORD-4827', items: [{ productId: 'P006', qty: 1 }], reason: 'Damaged', returnType: 'refund' },
        DESK,
      ),
    ).toThrow(/is already fully returned/);
  });

  it('refuses an order that is not eligible', () => {
    expect(() =>
      world.returns.create(
        { orderId: 'ORD-4829', items: [{ productId: 'P001', qty: 1 }], reason: 'Damaged', returnType: 'refund' },
        DESK,
      ),
    ).toThrow('Order ORD-4829: This order has not reached the customer yet');
  });

  it('shares the coupon discount out across the refunded units', () => {
    const [productId] = stockedProducts(world);
    const sale = counterSale(world, [{ productId, quantity: 3 }], 'WELCOME10');
    expect(sale.discountAmount).toBeGreaterThan(0);
    const item = sale.items[0];
    const expectedUnit = round2((item.itemPrice * (sale.subtotal! - sale.discountAmount)) / sale.subtotal!);

    const created = world.returns.create(
      { orderId: sale.id, items: [{ productId, qty: 1 }], reason: 'Damaged', returnType: 'refund' },
      DESK,
    );
    expect(created.items?.[0].unitPrice).toBe(expectedUnit);
    expect(created.refundAmount).toBe(expectedUnit);
    expect(created.refundAmount).toBeLessThan(item.itemPrice);
  });

  it('an exchange carries no refund', () => {
    const created = world.returns.create(
      { orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 1 }], reason: 'Wrong size', returnType: 'exchange' },
      DESK,
    );
    expect(created.returnType).toBe('exchange');
    expect(created.refundAmount).toBe(0);
  });
});

describe('ReturnsService - status flow', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('declares Refunded, Exchanged and Rejected as final', () => {
    expect(RETURN_TRANSITIONS.Refunded).toEqual([]);
    expect(RETURN_TRANSITIONS.Exchanged).toEqual([]);
    expect(RETURN_TRANSITIONS.Rejected).toEqual([]);
  });

  it('a refund needs a refund method', () => {
    expect(() => world.returns.transition('RET-221', { status: 'Refunded' })).toThrow('Choose how the money is refunded');
    expect(world.returns.findOne('RET-221').status).toBe('Pending');
  });

  it('refunding puts the goods back on the shelf and writes a ledger entry', () => {
    const before = world.inventory.stockFor('P005')!;
    const order = world.orders.findOneOrder('ORD-4827');
    const ret = world.returns.findOne('RET-221');

    const refunded = world.returns.transition('RET-221', { status: 'Refunded', refundMethod: 'UPI' }, 'returnhandler');

    expect(refunded).toMatchObject({ status: 'Refunded', refundMethod: 'UPI', restock: true, resolvedBy: 'returnhandler' });
    expect(refunded.resolvedAt).toBeTruthy();
    expect(world.inventory.stockFor('P005')).toBe(before + 1);
    const move = world.inventory.findMovements({ productId: 'P005', type: 'return' })[0];
    expect(move).toMatchObject({ refId: 'RET-221', refType: 'return', quantity: 1, balanceAfter: before + 1 });

    const after = world.orders.findOneOrder('ORD-4827');
    expect(after.refundedAmount).toBeCloseTo(round2((order.refundedAmount ?? 0) + ret.refundAmount), 2);
    expect(after.status).toBe('Partially Returned');
    expect(after.paymentStatus).toBe('Partially Refunded');
  });

  it('restock:false refunds without touching the shelf', () => {
    const before = world.inventory.stockFor('P005')!;
    const movesBefore = world.inventory.findMovements({ productId: 'P005' }).length;
    const refunded = world.returns.transition('RET-221', { status: 'Refunded', refundMethod: 'Cash', restock: false });
    expect(refunded.restock).toBe(false);
    expect(world.inventory.stockFor('P005')).toBe(before);
    expect(world.inventory.findMovements({ productId: 'P005' })).toHaveLength(movesBefore);
  });

  it('marks the order Returned and Refunded once every unit is refunded', () => {
    // P006 went back on RET-220 and one P005 is waiting on RET-221; this takes the rest.
    const second = world.returns.create(
      {
        orderId: 'ORD-4827',
        items: [
          { productId: 'P005', qty: 1 },
          { productId: 'P001', qty: 1 },
        ],
        reason: 'Damaged',
        returnType: 'refund',
      },
      DESK,
    );
    world.returns.transition('RET-221', { status: 'Refunded', refundMethod: 'Cash' });
    expect(world.orders.findOneOrder('ORD-4827').status).toBe('Partially Returned');
    world.returns.transition(second.id, { status: 'Approved' });
    world.returns.transition(second.id, { status: 'Refunded', refundMethod: 'Cash' });

    const order = world.orders.findOneOrder('ORD-4827');
    expect(order.status).toBe('Returned');
    expect(order.paymentStatus).toBe('Refunded');
    expect(order.refundedAmount).toBeCloseTo(order.total, 2);
    expect(world.returns.returnable('ORD-4827')).toMatchObject({
      eligible: false,
      reason: 'Everything on this order is already returned',
    });
  });

  it('a rejection needs a reason, then the return is final', () => {
    expect(() => world.returns.transition('RET-221', { status: 'Rejected' })).toThrow('Say why the return is rejected');
    const rejected = world.returns.transition('RET-221', { status: 'Rejected', rejectReason: 'Seal broken' });
    expect(rejected).toMatchObject({ status: 'Rejected', rejectReason: 'Seal broken' });
    expect(() => world.returns.transition('RET-221', { status: 'Refunded', refundMethod: 'Cash' })).toThrow(
      'Return RET-221 is already Rejected and cannot change',
    );
  });

  it('a final return cannot move again', () => {
    expect(() => world.returns.transition('RET-220', { status: 'Approved' })).toThrow(
      'Return RET-220 is already Refunded and cannot change',
    );
  });

  it('an exchange cannot be refunded; completing it swaps the unit on the shelf', () => {
    const created = world.returns.create(
      { orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 1 }], reason: 'Wrong size', returnType: 'exchange' },
      DESK,
    );
    expect(() => world.returns.transition(created.id, { status: 'Refunded', refundMethod: 'Cash' })).toThrow(
      /This is an exchange request/,
    );

    const before = world.inventory.stockFor('P001')!;
    const done = world.returns.transition(created.id, { status: 'Exchanged' });
    expect(done.status).toBe('Exchanged');
    expect(world.inventory.stockFor('P001')).toBe(before);
    const types = world.inventory
      .findMovements({ productId: 'P001' })
      .filter((m) => m.refId === created.id)
      .map((m) => m.type)
      .sort();
    expect(types).toEqual(['exchange', 'return']);
  });

  it('refuses a stale version', () => {
    expect(() => world.returns.transition('RET-221', { status: 'Approved', version: 99 })).toThrow(/since you opened it/);
  });

  it('logs every status change', () => {
    world.returns.transition('RET-221', { status: 'Approved' }, 'returnhandler');
    const entry = world.activity.find({ entity: 'return', entityId: 'RET-221' })[0];
    expect(entry).toMatchObject({ action: 'status', by: 'returnhandler', companyId: 'BIZ-101' });
    expect(entry.summary).toContain('Pending → Approved');
  });
});

describe('ReturnsService - update and delete', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('edits the reason and note of a Pending return', () => {
    const updated = world.returns.update('RET-221', { reason: 'Expired on arrival', note: 'Checked by desk' });
    expect(updated.reason).toBe('Expired on arrival');
    expect(updated.note).toBe('Checked by desk');
    expect(updated.status).toBe('Pending');
  });

  it('refuses to edit a final return', () => {
    expect(() => world.returns.update('RET-220', { reason: 'Changed my mind' })).toThrow(
      'Return RET-220 is Refunded; only a Pending return can be edited',
    );
  });

  it('routes a status sent through update through the flow rules', () => {
    expect(() => world.returns.update('RET-221', { status: 'Rejected' })).toThrow('Say why the return is rejected');
    expect(world.returns.update('RET-221', { status: 'Approved' }).status).toBe('Approved');
  });

  it('deletes only a Pending return', () => {
    expect(() => world.returns.remove('RET-220')).toThrow('Return RET-220 is Refunded and is kept for the records');
    const result = world.returns.remove('RET-221');
    expect(result.message).toBe('Return RET-221 deleted');
    expect(result.return.id).toBe('RET-221');
    expect(() => world.returns.findOne('RET-221')).toThrow('Return RET-221 not found');
  });
});

describe('Returns routes', () => {
  let world: World;
  beforeEach(() => {
    world = buildWorld();
  });

  it('rejects a request with no credential (401)', async () => {
    const res = await request(world.app).get('/api/returns');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Please sign in to continue.');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(world.app).get('/api/returns').set('x-role', 'deliveryops');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('lists returns joined to their order', async () => {
    const res = await request(world.app).get('/api/returns?status=Pending').set('x-role', 'returnhandler');
    expect(res.status).toBe(200);
    const ret221 = res.body.find((r: { id: string }) => r.id === 'RET-221');
    const order = world.orders.findOneOrder('ORD-4827');
    expect(ret221).toMatchObject({ orderTotal: order.total, paymentMethod: 'Cash', customerName: order.customerName });
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    expect((await request(world.app).get('/api/returns/RET-999').set('x-role', 'admin')).status).toBe(404);
    const malformed = await request(world.app).get('/api/returns/nope').set('x-role', 'admin');
    expect(malformed.status).toBe(400);
    expect(malformed.body.message).toMatch(/Validation failed/);
  });

  it('serves the returnable lines of an order', async () => {
    const res = await request(world.app).get('/api/returns/order/ORD-4827/returnable').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.lines).toHaveLength(3);
  });

  it('lets a cashier raise a return (201) but not resolve it (403)', async () => {
    const created = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'cashier')
      .send({ orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 1 }], reason: 'Damaged' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'Pending', returnType: 'refund', qty: 1 });
    expect(created.body.refundAmount).toBeGreaterThan(0);

    const resolve = await request(world.app)
      .post(`/api/returns/${created.body.id}/status`)
      .set('x-role', 'cashier')
      .send({ status: 'Refunded', refundMethod: 'Cash' });
    expect(resolve.status).toBe(403);
  });

  it('ignores a refund amount sent by the client', async () => {
    const res = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 1 }], reason: 'Damaged', refundAmount: 99999 });
    expect(res.status).toBe(201);
    const unit = world.returns.returnable('ORD-4827').lines.find((l) => l.productId === 'P001')!.unitPrice;
    expect(res.body.refundAmount).toBe(unit);
  });

  it('returns 400 for a create with no items, a bad qty, or too many units', async () => {
    const empty = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: 'ORD-4827', reason: 'Damaged' });
    expect(empty.status).toBe(400);

    const zero = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 0 }], reason: 'Damaged' });
    expect(zero.status).toBe(400);

    const tooMany = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: 'ORD-4827', items: [{ productId: 'P005', qty: 2 }], reason: 'Expired' });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/Only 1 of/);
  });

  it('refuses a return on an order older than the return window (400)', async () => {
    const old = world.orders
      .findAllOrders('BIZ-101', 'Delivered')
      .find((o) => o.paymentStatus === 'Paid' && Date.now() - new Date(o.orderDate).getTime() > (RETURN_WINDOW_DAYS + 1) * DAY);
    expect(old).toBeDefined();
    const res = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: old!.id, items: [{ productId: old!.items[0].productId, qty: 1 }], reason: 'Damaged' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(`within ${RETURN_WINDOW_DAYS} days`);
  });

  it('returns 404 when raising a return on an unknown order', async () => {
    const res = await request(world.app)
      .post('/api/returns')
      .set('x-role', 'returnhandler')
      .send({ orderId: 'ORD-99999', items: [{ productId: 'P001', qty: 1 }], reason: 'Damaged' });
    expect(res.status).toBe(404);
  });

  it('refund needs a method (400) and then restocks (200)', async () => {
    const before = world.inventory.stockFor('P005')!;
    const noMethod = await request(world.app)
      .post('/api/returns/RET-221/status')
      .set('x-role', 'returnhandler')
      .send({ status: 'Refunded' });
    expect(noMethod.status).toBe(400);

    const ok = await request(world.app)
      .post('/api/returns/RET-221/status')
      .set('x-role', 'returnhandler')
      .send({ status: 'Refunded', refundMethod: 'Original payment' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('Refunded');
    expect(world.inventory.stockFor('P005')).toBe(before + 1);
  });

  it('returns 409 for a move out of a final status', async () => {
    const res = await request(world.app)
      .post('/api/returns/RET-220/status')
      .set('x-role', 'returnhandler')
      .send({ status: 'Approved' });
    expect(res.status).toBe(409);
  });

  it('rejects through PUT with a status only with a reason', async () => {
    const missing = await request(world.app)
      .put('/api/returns/RET-221')
      .set('x-role', 'admin')
      .send({ status: 'Rejected' });
    expect(missing.status).toBe(400);
    const ok = await request(world.app)
      .put('/api/returns/RET-221')
      .set('x-role', 'admin')
      .send({ status: 'Rejected', rejectReason: 'Seal broken by customer' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('Rejected');
  });

  it('refuses to edit (409) or delete (409) a final return, and deletes a Pending one', async () => {
    const edit = await request(world.app).put('/api/returns/RET-220').set('x-role', 'admin').send({ reason: 'Changed' });
    expect(edit.status).toBe(409);
    const delFinal = await request(world.app).delete('/api/returns/RET-220').set('x-role', 'admin');
    expect(delFinal.status).toBe(409);
    const delPending = await request(world.app).delete('/api/returns/RET-221').set('x-role', 'returnhandler');
    expect(delPending.status).toBe(200);
    expect(delPending.body.message).toBe('Return RET-221 deleted');
  });

  describe('company scoping', () => {
    it("lets the store's return desk work on its own returns", async () => {
      const res = await request(world.app).get('/api/returns/RET-221').set('Authorization', STORE_DESK);
      expect(res.status).toBe(200);
    });

    it("lists only the signed-in user's company and refuses another company (403)", async () => {
      const own = await request(world.app).get('/api/returns').set('Authorization', METRO_ADMIN);
      expect(own.status).toBe(200);
      own.body.forEach((r: { companyId: string }) => expect(r.companyId).toBe('BIZ-102'));
      const other = await request(world.app).get('/api/returns?companyId=BIZ-101').set('Authorization', METRO_ADMIN);
      expect(other.status).toBe(403);
    });

    it("reports another company's return and order as not found (404)", async () => {
      expect((await request(world.app).get('/api/returns/RET-221').set('Authorization', METRO_ADMIN)).status).toBe(404);
      expect(
        (await request(world.app).get('/api/returns/order/ORD-4827/returnable').set('Authorization', METRO_ADMIN))
          .status,
      ).toBe(404);
    });

    it("cannot raise, resolve or delete a return on another company's order (404)", async () => {
      const create = await request(world.app)
        .post('/api/returns')
        .set('Authorization', METRO_ADMIN)
        .send({ orderId: 'ORD-4827', items: [{ productId: 'P001', qty: 1 }], reason: 'Damaged' });
      expect(create.status).toBe(404);

      const resolve = await request(world.app)
        .post('/api/returns/RET-221/status')
        .set('Authorization', METRO_ADMIN)
        .send({ status: 'Refunded', refundMethod: 'Cash' });
      expect(resolve.status).toBe(404);

      const del = await request(world.app).delete('/api/returns/RET-221').set('Authorization', METRO_ADMIN);
      expect(del.status).toBe(404);
      expect(world.returns.findOne('RET-221').status).toBe('Pending');
    });
  });
});
