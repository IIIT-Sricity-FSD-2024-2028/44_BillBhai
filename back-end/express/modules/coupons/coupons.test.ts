import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { ActivityService } from '../activity/activity.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import '../users/users.service';
import { CouponsController } from './coupons.controller';
import { createCouponsRouter } from './coupons.routes';
import { CouponsService } from './coupons.service';

/** Fresh, wired services per test so coupon use never leaks between tests. */
function buildWorld() {
  const activity = new ActivityService();
  const inventory = new InventoryService(activity);
  const products = new ProductsService(inventory, new SuppliersService(activity), activity);
  const customers = new CustomersService();
  const coupons = new CouponsService(activity);
  const orders = new OrdersService(inventory, products, customers, coupons, activity);

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/coupons', createCouponsRouter(new CouponsController(coupons, orders)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, activity, coupons, orders };
}

const DAY = 24 * 60 * 60 * 1000;
/** A date in India time, `offset` days from today, as YYYY-MM-DD. */
function istDay(offset = 0): string {
  return new Date(Date.now() + offset * DAY + 330 * 60 * 1000).toISOString().slice(0, 10);
}

const ACTOR = { username: 'cashier', staffId: 'USR-002' };

/** Sells P001 (₹380) x qty in BIZ-101 with a coupon. */
function sellWithCoupon(orders: OrdersService, code: string, qty = 2, phone?: string) {
  return orders.createOrder(
    {
      companyId: 'BIZ-101',
      checkoutMode: 'takeaway_now',
      paymentMethod: 'UPI',
      promoCode: code,
      customer: phone ? { phone, name: 'Coupon Buyer' } : undefined,
      items: [{ productId: 'P001', quantity: qty }],
    },
    ACTOR,
  );
}

const newCoupon = {
  companyId: 'BIZ-101',
  code: 'test25',
  description: 'Test coupon',
  type: 'flat' as const,
  value: 25,
  minOrder: 25,
  validFrom: istDay(-1),
  validTo: istDay(10),
};

const metroAdmin = () =>
  `Bearer ${signAccessToken({ sub: 'USR-008', username: 'metroadmin', role: 'admin', companyId: 'BIZ-102' })}`;

describe('CouponsService', () => {
  let world: ReturnType<typeof buildWorld>;
  let service: CouponsService;

  beforeEach(() => {
    world = buildWorld();
    service = world.coupons;
  });

  it('keeps each business\'s coupons separate', () => {
    const biz101 = service.findAll('BIZ-101');
    expect(biz101.map((c) => c.code).sort()).toEqual(['DIWALI15', 'FLAT50', 'SUMMER20', 'WELCOME10']);
    expect(service.findAll('BIZ-102').every((c) => c.companyId === 'BIZ-102')).toBe(true);
    expect(service.findByCode('BIZ-101', ' welcome10 ')?.id).toBe('CPN-001');
    expect(service.findByCode('BIZ-101', 'PUJA100')).toBeUndefined();
    expect(() => service.findOne('CPN-999')).toThrow('Coupon CPN-999 not found');
  });

  describe('validate', () => {
    it('works out a percent discount and caps it at maxDiscount', () => {
      expect(service.validate('BIZ-101', 'welcome10', 1000)).toEqual(
        expect.objectContaining({ valid: true, couponId: 'CPN-001', code: 'WELCOME10', discount: 100, subtotal: 1000, total: 900 }),
      );
      expect(service.validate('BIZ-101', 'WELCOME10', 5000).discount).toBe(150);
    });

    it('gives a flat discount from the minimum bill upwards', () => {
      expect(service.validate('BIZ-101', 'FLAT50', 500)).toEqual(expect.objectContaining({ discount: 50, total: 450 }));
      expect(() => service.validate('BIZ-101', 'FLAT50', 499.5)).toThrow(
        'Coupon FLAT50 needs a bill of at least ₹500 (this bill is ₹499.5)',
      );
    });

    it('never discounts more than the bill', () => {
      service.create({ ...newCoupon, code: 'BIGFLAT', value: 1000, minOrder: 0, maxDiscount: 0, usageLimit: 0, perCustomerLimit: 0, active: true });
      expect(service.validate('BIZ-101', 'BIGFLAT', 300)).toEqual(expect.objectContaining({ discount: 300, total: 0 }));
    });

    it('refuses a code that does not exist in this business', () => {
      expect(() => service.validate('BIZ-101', 'NOPE', 1000)).toThrow(
        expect.objectContaining({ statusCode: 400, message: 'Coupon NOPE does not exist' }),
      );
      expect(() => service.validate('BIZ-101', 'PUJA100', 2000)).toThrow('Coupon PUJA100 does not exist');
      expect(service.validate('BIZ-102', 'PUJA100', 2000).discount).toBe(100);
    });

    it('refuses a switched-off coupon', () => {
      expect(() => service.validate('BIZ-101', 'SUMMER20', 1000)).toThrow('Coupon SUMMER20 is switched off');
    });

    it('refuses a coupon outside its date window (India date)', () => {
      expect(() => service.validate('BIZ-101', 'DIWALI15', 1000)).toThrow(/^Coupon DIWALI15 expired on \d{4}-\d{2}-\d{2}$/);
      service.create({
        ...newCoupon,
        code: 'LATER',
        validFrom: istDay(2),
        validTo: istDay(5),
        minOrder: 25,
        maxDiscount: 0,
        usageLimit: 0,
        perCustomerLimit: 0,
        active: true,
      });
      expect(() => service.validate('BIZ-101', 'LATER', 1000)).toThrow(`Coupon LATER starts on ${istDay(2)}`);
      // Valid on the first and last day of the window.
      expect(service.validate('BIZ-101', 'LATER', 1000, undefined, Date.now() + 2 * DAY).discount).toBe(25);
      expect(service.validate('BIZ-101', 'LATER', 1000, undefined, Date.now() + 5 * DAY).discount).toBe(25);
      expect(() => service.validate('BIZ-101', 'LATER', 1000, undefined, Date.now() + 6 * DAY)).toThrow(/expired/);
    });

    it('refuses a coupon that has reached its total or per-customer limit', () => {
      expect(() => service.validate('BIZ-101', 'FLAT50', 800, { total: 200, byCustomer: 0 })).toThrow(
        'Coupon FLAT50 has reached its limit of 200 uses',
      );
      expect(() => service.validate('BIZ-101', 'FLAT50', 800, { total: 10, byCustomer: 3 })).toThrow(
        'This customer has already used FLAT50 3 time(s), the most allowed',
      );
      expect(service.validate('BIZ-101', 'FLAT50', 800, { total: 199, byCustomer: 2 }).discount).toBe(50);
      // 0 means no limit.
      expect(service.validate('BIZ-101', 'WELCOME10', 800, { total: 100000, byCustomer: 1000 }).discount).toBe(80);
    });
  });

  describe('create, update and remove', () => {
    const full = { ...newCoupon, code: 'TEST25', minOrder: 0, maxDiscount: 0, usageLimit: 0, perCustomerLimit: 0, active: true };

    it('creates a coupon with the next id and logs it', () => {
      const created = service.create(full, 'admin');
      expect(created.id).toBe('CPN-103');
      expect(created.version).toBe(1);
      expect(service.findByCode('BIZ-101', 'TEST25')?.id).toBe(created.id);
      expect(world.activity.find({ entity: 'coupon', entityId: created.id })[0].action).toBe('create');
    });

    it('refuses a duplicate code in the same business but allows it in another', () => {
      expect(() => service.create({ ...full, code: 'WELCOME10' })).toThrow(
        expect.objectContaining({ statusCode: 409, message: 'Coupon code WELCOME10 already exists' }),
      );
      expect(service.create({ ...full, companyId: 'BIZ-102', code: 'FLAT50' }).companyId).toBe('BIZ-102');
    });

    it('changes the code of an unused coupon but not of a used one', () => {
      const created = service.create(full);
      expect(service.update(created.id, { code: 'TEST30' }, 0).code).toBe('TEST30');
      expect(() => service.update(created.id, { code: 'TEST35' }, 2)).toThrow(
        expect.objectContaining({ statusCode: 409, message: expect.stringContaining('its code cannot change') }),
      );
      expect(() => service.update(created.id, { code: 'FLAT50' }, 0)).toThrow('Coupon code FLAT50 already exists');
      // Other fields of a used coupon can still change.
      expect(service.update(created.id, { description: 'Renamed' }, 2).description).toBe('Renamed');
    });

    it('refuses an update that breaks the rules or uses a stale version', () => {
      expect(() => service.update('CPN-001', { value: 95 }, 0)).toThrow('A percent coupon can give at most 90% off');
      expect(() => service.update('CPN-001', { validTo: '2000-01-01' }, 0)).toThrow('validTo must be on or after validFrom');
      expect(() => service.update('CPN-001', { description: 'x', version: 99 }, 0)).toThrow(
        expect.objectContaining({ statusCode: 409 }),
      );
    });

    it('switches a used coupon off instead of deleting it', () => {
      const result = service.remove('CPN-002', 4, 'admin');
      expect(result.message).toBe('Coupon FLAT50 is on 4 bill(s), so it was switched off instead of deleted');
      expect(result.coupon.active).toBe(false);
      expect(service.findOne('CPN-002').active).toBe(false);
      expect(service.findOne('CPN-002').minOrder).toBe(500);
    });

    it('deletes an unused coupon', () => {
      const created = service.create(full);
      expect(service.remove(created.id, 0).message).toBe('Coupon TEST25 deleted');
      expect(() => service.findOne(created.id)).toThrow(/not found/);
    });
  });
});

describe('Coupons routes', () => {
  let world: ReturnType<typeof buildWorld>;
  const app = () => world.app;

  beforeEach(() => {
    world = buildWorld();
  });

  it('rejects a request with no credential (401)', async () => {
    expect((await request(app()).get('/api/coupons')).status).toBe(401);
  });

  it('lists coupons with how often each was used', async () => {
    const before = await request(app()).get('/api/coupons?companyId=BIZ-101').set('x-role', 'cashier');
    expect(before.status).toBe(200);
    expect(before.body.every((c: { companyId: string }) => c.companyId === 'BIZ-101')).toBe(true);
    const usedBefore = before.body.find((c: { code: string }) => c.code === 'WELCOME10').usedCount;

    sellWithCoupon(world.orders, 'WELCOME10');
    const after = await request(app()).get('/api/coupons?companyId=BIZ-101').set('x-role', 'cashier');
    expect(after.body.find((c: { code: string }) => c.code === 'WELCOME10').usedCount).toBe(usedBefore + 1);

    const one = await request(app()).get('/api/coupons/CPN-001').set('x-role', 'cashier');
    expect(one.status).toBe(200);
    expect(one.body.usedCount).toBe(usedBefore + 1);
  });

  it('lets only managers create, edit or delete coupons (403)', async () => {
    expect((await request(app()).post('/api/coupons').set('x-role', 'cashier').send(newCoupon)).status).toBe(403);
    expect((await request(app()).put('/api/coupons/CPN-001').set('x-role', 'cashier').send({ value: 5 })).status).toBe(403);
    expect((await request(app()).delete('/api/coupons/CPN-001').set('x-role', 'cashier')).status).toBe(403);
    expect((await request(app()).get('/api/coupons/analytics').set('x-role', 'cashier')).status).toBe(403);
  });

  it('creates a coupon with an upper-cased code and defaults (201)', async () => {
    const response = await request(app()).post('/api/coupons').set('x-role', 'admin').send(newCoupon);
    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        companyId: 'BIZ-101',
        code: 'TEST25',
        minOrder: 25,
        maxDiscount: 0,
        usageLimit: 0,
        perCustomerLimit: 0,
        active: true,
      }),
    );
  });

  it('validates a new coupon (400)', async () => {
    const bad = [
      { ...newCoupon, code: 'AB' },
      { ...newCoupon, code: 'NO SPACES' },
      { ...newCoupon, type: 'percent', value: 95 },
      { ...newCoupon, value: 0 },
      { ...newCoupon, validFrom: istDay(5), validTo: istDay(1) },
      { ...newCoupon, validTo: '31/12/2030' },
      { ...newCoupon, type: 'bogo' },
    ];
    for (const body of bad) {
      const response = await request(app()).post('/api/coupons').set('x-role', 'admin').send(body);
      expect(response.status).toBe(400);
    }
    const noCompany = await request(app())
      .post('/api/coupons')
      .set('x-role', 'admin')
      .send({ ...newCoupon, companyId: undefined });
    expect(noCompany.status).toBe(400);
    expect(noCompany.body.message).toBe('Pick a business first. The super user must open a business before adding records.');
  });

  it('refuses a duplicate code (409)', async () => {
    const response = await request(app())
      .post('/api/coupons')
      .set('x-role', 'admin')
      .send({ ...newCoupon, code: 'flat50' });
    expect(response.status).toBe(409);
  });

  it('keeps the code of a coupon once it is on a bill (409)', async () => {
    sellWithCoupon(world.orders, 'FLAT50');
    const response = await request(app()).put('/api/coupons/CPN-002').set('x-role', 'admin').send({ code: 'FLAT60' });
    expect(response.status).toBe(409);
    expect(world.coupons.findOne('CPN-002').code).toBe('FLAT50');
  });

  it('renames an unused coupon (200)', async () => {
    const created = (await request(app()).post('/api/coupons').set('x-role', 'admin').send(newCoupon)).body;
    const response = await request(app()).put(`/api/coupons/${created.id}`).set('x-role', 'admin').send({ code: 'test30' });
    expect(response.status).toBe(200);
    expect(response.body.code).toBe('TEST30');
    expect(response.body.version).toBe(2);
  });

  // Known bug: updateCouponSchema is couponFields.partial(), and zod 4 still
  // applies .default() inside optional fields, so a PUT that names one field
  // silently resets minOrder/maxDiscount/usageLimit/perCustomerLimit to 0 and
  // active to true, and an empty PUT passes the "at least one field" check.
  // Unskip both once coupons.schema.ts is fixed.
  it('refuses an empty update (400)', async () => {
    expect((await request(app()).put('/api/coupons/CPN-001').set('x-role', 'admin').send({})).status).toBe(400);
  });

  it('keeps fields that a partial update does not mention', async () => {
    const response = await request(app())
      .put('/api/coupons/CPN-002')
      .set('x-role', 'admin')
      .send({ description: 'Fifty off' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ minOrder: 500, usageLimit: 200, perCustomerLimit: 3, active: true }),
    );
    const off = await request(app()).put('/api/coupons/CPN-004').set('x-role', 'admin').send({ value: 25 });
    expect(off.body.active).toBe(false);
  });

  it('switches off a used coupon on delete and deletes an unused one', async () => {
    sellWithCoupon(world.orders, 'FLAT50');
    const used = await request(app()).delete('/api/coupons/CPN-002').set('x-role', 'admin');
    expect(used.status).toBe(200);
    expect(used.body.coupon.active).toBe(false);
    expect(world.coupons.findOne('CPN-002').active).toBe(false);

    const created = (await request(app()).post('/api/coupons').set('x-role', 'admin').send(newCoupon)).body;
    const unused = await request(app()).delete(`/api/coupons/${created.id}`).set('x-role', 'admin');
    expect(unused.status).toBe(200);
    expect(unused.body.message).toBe('Coupon TEST25 deleted');
    expect((await request(app()).get(`/api/coupons/${created.id}`).set('x-role', 'admin')).status).toBe(404);
  });

  describe('POST /api/coupons/validate', () => {
    it('validates a code for a bill (200) and explains a refusal (400)', async () => {
      const ok = await request(app())
        .post('/api/coupons/validate')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', code: 'welcome10', subtotal: 620 });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual(expect.objectContaining({ valid: true, code: 'WELCOME10', discount: 62, total: 558 }));

      for (const [code, message] of [
        ['NOPE', 'Coupon NOPE does not exist'],
        ['SUMMER20', 'Coupon SUMMER20 is switched off'],
        ['DIWALI15', 'Coupon DIWALI15 expired on'],
        ['FLAT50', 'needs a bill of at least ₹500'],
      ]) {
        const response = await request(app())
          .post('/api/coupons/validate')
          .set('x-role', 'cashier')
          .send({ companyId: 'BIZ-101', code, subtotal: 300 });
        expect(response.status).toBe(400);
        expect(response.body.message).toContain(message);
      }
    });

    it('counts a customer\'s past bills against the per-customer limit', async () => {
      const phone = '9123400002';
      for (let i = 0; i < 3; i += 1) sellWithCoupon(world.orders, 'FLAT50', 2, phone);
      const order = world.orders.findAllOrders().find((o) => o.customerPhone === phone)!;
      const response = await request(app())
        .post('/api/coupons/validate')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', code: 'FLAT50', subtotal: 800, customerId: order.customerId });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('This customer has already used FLAT50 3 time(s), the most allowed');
    });

    it('counts total uses against the usage limit', async () => {
      await request(app())
        .post('/api/coupons')
        .set('x-role', 'admin')
        .send({ ...newCoupon, code: 'ONCE', usageLimit: 1 });
      sellWithCoupon(world.orders, 'ONCE');
      const response = await request(app())
        .post('/api/coupons/validate')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', code: 'ONCE', subtotal: 800 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Coupon ONCE has reached its limit of 1 uses');
    });
  });

  describe('scoping', () => {
    it('shows a store admin only their own coupons', async () => {
      const list = await request(app()).get('/api/coupons').set('Authorization', metroAdmin());
      expect(list.status).toBe(200);
      expect(list.body.map((c: { code: string }) => c.code).sort()).toEqual(['PUJA100', 'WELCOME10']);

      expect((await request(app()).get('/api/coupons?companyId=BIZ-101').set('Authorization', metroAdmin())).status).toBe(403);
      expect((await request(app()).get('/api/coupons/CPN-001').set('Authorization', metroAdmin())).status).toBe(404);
      expect(
        (await request(app()).put('/api/coupons/CPN-001').set('Authorization', metroAdmin()).send({ value: 50 })).status,
      ).toBe(404);
      expect((await request(app()).delete('/api/coupons/CPN-001').set('Authorization', metroAdmin())).status).toBe(404);
      expect(world.coupons.findOne('CPN-001').value).toBe(10);
    });

    it('creates and validates in the admin\'s own business', async () => {
      const { companyId: _c, ...body } = newCoupon;
      const created = await request(app()).post('/api/coupons').set('Authorization', metroAdmin()).send(body);
      expect(created.status).toBe(201);
      expect(created.body.companyId).toBe('BIZ-102');

      // FLAT50 exists only in BIZ-101.
      const validate = await request(app())
        .post('/api/coupons/validate')
        .set('Authorization', metroAdmin())
        .send({ code: 'FLAT50', subtotal: 800 });
      expect(validate.status).toBe(400);
    });
  });

  describe('GET /api/coupons/analytics', () => {
    it('reports uses and discount worked out from the saved orders', async () => {
      const before = await request(app()).get('/api/coupons/analytics?companyId=BIZ-101').set('x-role', 'admin');
      expect(before.status).toBe(200);
      expect(before.body.totals).toEqual(
        expect.objectContaining({
          orders: expect.any(Number),
          couponOrders: expect.any(Number),
          couponShare: expect.any(Number),
          discountGiven: expect.any(Number),
        }),
      );
      const row = (body: { coupons: Array<{ code: string; uses: number; discountGiven: number }> }) =>
        body.coupons.find((c) => c.code === 'WELCOME10')!;
      const was = row(before.body);

      // ₹760 with WELCOME10 = ₹76 off.
      const sale = sellWithCoupon(world.orders, 'WELCOME10');
      const after = await request(app()).get('/api/coupons/analytics?companyId=BIZ-101').set('x-role', 'admin');
      expect(after.body.totals.orders).toBe(before.body.totals.orders + 1);
      expect(after.body.totals.couponOrders).toBe(before.body.totals.couponOrders + 1);
      expect(row(after.body).uses).toBe(was.uses + 1);
      expect(row(after.body).discountGiven).toBeCloseTo(was.discountGiven + 76, 2);
      expect(after.body.coupons.every((c: { code: string }) => c.code !== 'PUJA100')).toBe(true);

      // Cancelled bills drop out.
      world.orders.cancelOrder(sale.id, 'Customer changed mind', 'admin');
      const cancelled = await request(app()).get('/api/coupons/analytics?companyId=BIZ-101').set('x-role', 'admin');
      expect(row(cancelled.body).uses).toBe(was.uses);
    });

    it('filters by an India-date window and validates the dates', async () => {
      const future = await request(app())
        .get(`/api/coupons/analytics?companyId=BIZ-101&from=${istDay(30)}&to=${istDay(40)}`)
        .set('x-role', 'admin');
      expect(future.status).toBe(200);
      expect(future.body.from).toBe(istDay(30));
      expect(future.body.totals.orders).toBe(0);

      const bad = await request(app()).get('/api/coupons/analytics?from=yesterday').set('x-role', 'admin');
      expect(bad.status).toBe(400);
    });
  });
});
