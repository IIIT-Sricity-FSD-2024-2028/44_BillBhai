import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { ActivityService } from '../activity/activity.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomersService } from '../customers/customers.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { usersService } from '../users/users.service';
import { OrdersController } from './orders.controller';
import { createOrdersRouter } from './orders.routes';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './orders.schema';

/**
 * Every test gets a fresh set of services wired to each other, so a sale in
 * one test can never move stock, coupons or customers in the next.
 */
function buildWorld() {
  const activity = new ActivityService();
  const inventory = new InventoryService(activity);
  const suppliers = new SuppliersService(activity);
  const products = new ProductsService(inventory, suppliers, activity);
  const customers = new CustomersService();
  const coupons = new CouponsService(activity);
  const orders = new OrdersService(inventory, products, customers, coupons, activity);
  const deliveries = new DeliveriesService(orders, activity);
  const controller = new OrdersController(orders, deliveries, usersService, customers);

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/orders', createOrdersRouter(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, activity, inventory, products, customers, coupons, orders, deliveries };
}

const ACTOR = { username: 'cashier', staffId: 'USR-002', staffName: 'Komal Shah' };

/** A counter sale in BIZ-101: Basmati Rice ₹380 x1 + Toor Dal ₹120 x2 = ₹620. */
const takeaway: CreateOrderDto & { companyId: string } = {
  companyId: 'BIZ-101',
  checkoutMode: 'takeaway_now',
  paymentMethod: 'UPI',
  items: [
    { productId: 'P001', quantity: 1 },
    { productId: 'P002', quantity: 2 },
  ],
};

const codDelivery: CreateOrderDto & { companyId: string } = {
  companyId: 'BIZ-101',
  checkoutMode: 'cod_delivery',
  customer: { name: 'Neha Rao', phone: '9876543210', address: '14, Park Street, Sector 9' },
  items: [{ productId: 'P005', quantity: 2 }],
};

const cashierToken = () =>
  signAccessToken({ sub: 'USR-002', username: 'cashier', role: 'cashier', companyId: 'BIZ-101' });
const metroAdminToken = () =>
  signAccessToken({ sub: 'USR-008', username: 'metroadmin', role: 'admin', companyId: 'BIZ-102' });

describe('OrdersService', () => {
  let world: ReturnType<typeof buildWorld>;
  let service: OrdersService;

  beforeEach(() => {
    world = buildWorld();
    service = world.orders;
  });

  describe('reads', () => {
    it('joins the fixed orders to their items, bill and payments', () => {
      const prepaid = service.findOneOrder('ORD-4829');
      expect(prepaid.companyId).toBe('BIZ-101');
      expect(prepaid.status).toBe('Processing');
      expect(prepaid.items.map((i) => [i.productId, i.quantity])).toEqual([
        ['P001', 1],
        ['P002', 2],
        ['P003', 1],
      ]);
      expect(prepaid.itemsCount).toBe(4);
      expect(prepaid.bill?.total).toBe(prepaid.total);
      expect(prepaid.payments).toHaveLength(1);
      expect(prepaid.payments?.[0].paymentStatus).toBe('Paid');

      const cod = service.findOneOrder('ORD-4828');
      expect(cod.paymentMethod).toBe('COD');
      expect(cod.paymentStatus).toBe('Pending');
      expect(cod.status).toBe('Shipped');
      expect(cod.payments).toHaveLength(0);
    });

    it('filters the list by companyId and by status', () => {
      expect(service.findAllOrders('BIZ-999')).toHaveLength(0);
      const biz101 = service.findAllOrders('BIZ-101');
      expect(biz101.length).toBeGreaterThan(0);
      expect(biz101.every((o) => o.companyId === 'BIZ-101')).toBe(true);
      expect(service.findAllOrders('BIZ-102').every((o) => o.companyId === 'BIZ-102')).toBe(true);
      expect(service.findAllOrders(undefined, 'Shipped').every((o) => o.status === 'Shipped')).toBe(true);
    });

    it('throws NotFound for an unknown order', () => {
      expect(() => service.findOneOrder('ORD-9999')).toThrow('Order ORD-9999 not found');
    });
  });

  describe('quote (server pricing)', () => {
    it('prices every line from the catalogue and works out the GST inside the price', () => {
      const quote = service.quote('BIZ-101', { items: takeaway.items });
      expect(quote.lines.map((l) => [l.productId, l.itemPrice, l.lineTotal])).toEqual([
        ['P001', 380, 380],
        ['P002', 120, 240],
      ]);
      expect(quote.subtotal).toBe(620);
      expect(quote.discountAmount).toBe(0);
      // All 5% GST, prices include tax: 620 * 5 / 105
      expect(quote.taxAmount).toBe(29.52);
      expect(quote.total).toBe(620);
    });

    it('merges repeated lines for the same product', () => {
      const quote = service.quote('BIZ-101', {
        items: [
          { productId: 'P002', quantity: 1 },
          { productId: 'P002', quantity: 2 },
        ],
      });
      expect(quote.lines).toHaveLength(1);
      expect(quote.lines[0].quantity).toBe(3);
      expect(quote.subtotal).toBe(360);
    });

    it('adds a delivery charge only for delivery checkouts', () => {
      const items = [{ productId: 'P002', quantity: 1 }];
      expect(service.quote('BIZ-101', { items, checkoutMode: 'takeaway_now', deliveryCharge: 40 }).total).toBe(120);
      const delivered = service.quote('BIZ-101', { items, checkoutMode: 'prepaid_delivery', deliveryCharge: 40 });
      expect(delivered.deliveryCharge).toBe(40);
      expect(delivered.total).toBe(160);
    });

    it('refuses a price that differs from the catalogue with 409', () => {
      expect(() =>
        service.quote('BIZ-101', { items: [{ productId: 'P001', quantity: 1, itemPrice: 100 }] }),
      ).toThrow(expect.objectContaining({ statusCode: 409, message: expect.stringContaining('₹380') }));
    });

    it('accepts a sent price that matches the catalogue', () => {
      expect(service.quote('BIZ-101', { items: [{ productId: 'P001', quantity: 1, itemPrice: 380 }] }).total).toBe(380);
    });

    it('refuses an unknown product and a product of another business (400)', () => {
      expect(() => service.quote('BIZ-101', { items: [{ productId: 'P999', quantity: 1 }] })).toThrow(
        expect.objectContaining({ statusCode: 400, message: 'Product P999 does not exist' }),
      );
      expect(() => service.quote('BIZ-101', { items: [{ productId: 'P101', quantity: 1 }] })).toThrow(
        expect.objectContaining({ statusCode: 400, message: 'Product P101 does not belong to this business' }),
      );
    });

    it('refuses a product that is no longer sold (409)', () => {
      world.products.remove('P004');
      expect(() => service.quote('BIZ-101', { items: [{ productId: 'P004', quantity: 1 }] })).toThrow(
        expect.objectContaining({ statusCode: 409, message: 'Amul Butter is no longer sold' }),
      );
    });

    it('refuses more than is on the shelf (409)', () => {
      // P020 Detergent Powder is seeded at 0; P009 Coffee Jar at 7.
      expect(() => service.quote('BIZ-101', { items: [{ productId: 'P020', quantity: 1 }] })).toThrow(
        expect.objectContaining({ statusCode: 409, message: 'Detergent Powder is out of stock' }),
      );
      expect(() => service.quote('BIZ-101', { items: [{ productId: 'P009', quantity: 8 }] })).toThrow(
        expect.objectContaining({ statusCode: 409, message: 'Only 7 Coffee Jar left in stock' }),
      );
      expect(service.quote('BIZ-101', { items: [{ productId: 'P009', quantity: 7 }] }).total).toBe(1260);
    });

    it('applies a coupon through the coupons service', () => {
      const quote = service.quote('BIZ-101', { items: takeaway.items, promoCode: ' welcome10 ' });
      expect(quote.promoCode).toBe('WELCOME10');
      expect(quote.discountAmount).toBe(62);
      expect(quote.total).toBe(558);

      // 10% of 1900 is 190, capped at ₹150.
      const big = service.quote('BIZ-101', { items: [{ productId: 'P001', quantity: 5 }], promoCode: 'WELCOME10' });
      expect(big.discountAmount).toBe(150);
      expect(big.total).toBe(1750);
    });

    it('refuses an unknown, switched-off, expired or too-small coupon', () => {
      const items = takeaway.items;
      expect(() => service.quote('BIZ-101', { items, promoCode: 'FREESTUFF' })).toThrow('Coupon FREESTUFF does not exist');
      expect(() => service.quote('BIZ-101', { items, promoCode: 'SUMMER20' })).toThrow('Coupon SUMMER20 is switched off');
      expect(() => service.quote('BIZ-101', { items, promoCode: 'DIWALI15' })).toThrow(/Coupon DIWALI15 expired on/);
      expect(() =>
        service.quote('BIZ-101', { items: [{ productId: 'P002', quantity: 1 }], promoCode: 'FLAT50' }),
      ).toThrow(/needs a bill of at least ₹500/);
      // PUJA100 belongs to BIZ-102.
      expect(() => service.quote('BIZ-101', { items, promoCode: 'PUJA100' })).toThrow('Coupon PUJA100 does not exist');
    });

    it('validates a promotion code trimmed and in any case', () => {
      const result = service.validatePromotion('BIZ-101', '  welcome10 ', 1250);
      expect(result).toEqual({
        valid: true,
        code: 'WELCOME10',
        discount: 125,
        subtotal: 1250,
        total: 1125,
        description: '10% off for every customer',
      });
    });

    it('refuses an empty cart', () => {
      expect(() => service.quote('BIZ-101', { items: [] })).toThrow('The bill has no items');
    });
  });

  describe('createOrder', () => {
    it('creates a counter sale that is handed over and paid on the spot', () => {
      const created = service.createOrder(takeaway, ACTOR);

      expect(created.id).toBe('ORD-4830');
      expect(created.orderType).toBe('pickup');
      expect(created.status).toBe('Delivered');
      expect(created.paymentMethod).toBe('UPI');
      expect(created.paymentStatus).toBe('Paid');
      expect(created.total).toBe(620);
      expect(created.itemsCount).toBe(3);
      expect(created.items.map((i) => i.itemPrice)).toEqual([380, 120]);
      expect(service.findAllOrders()[0].id).toBe('ORD-4830');
    });

    it('writes the bill and the payment automatically', () => {
      const created = service.createOrder(takeaway, ACTOR);
      expect(created.bill).toEqual(
        expect.objectContaining({ orderId: created.id, companyId: 'BIZ-101', total: 620, taxAmount: 29.52 }),
      );
      expect(created.bill?.billNo).toMatch(/^BILL-\d{4,}$/);
      expect(created.payments).toHaveLength(1);
      expect(created.payments?.[0]).toEqual(
        expect.objectContaining({ billNo: created.bill?.billNo, amountPaid: 620, paymentMethod: 'UPI', paymentStatus: 'Paid' }),
      );
      expect(service.findOneBill(created.bill!.billNo).orderId).toBe(created.id);
      expect(service.findOnePayment(created.bill!.billNo).amountPaid).toBe(620);
    });

    it('defaults the payment method to Cash and works out the change', () => {
      const created = service.createOrder({ ...takeaway, paymentMethod: undefined, amountTendered: 700 }, ACTOR);
      expect(created.paymentMethod).toBe('Cash');
      expect(created.changeDue).toBe(80);
      expect(() => service.createOrder({ ...takeaway, paymentMethod: 'Cash', amountTendered: 600 }, ACTOR)).toThrow(
        'Cash received ₹600 is less than the bill ₹620',
      );
    });

    it('takes the sold units off the shelf and writes a sale movement for each line', () => {
      const before1 = world.inventory.stockFor('P001')!;
      const before2 = world.inventory.stockFor('P002')!;
      const created = service.createOrder(takeaway, ACTOR);

      expect(world.inventory.stockFor('P001')).toBe(before1 - 1);
      expect(world.inventory.stockFor('P002')).toBe(before2 - 2);
      const moves = world.inventory.findMovements({ type: 'sale' }).filter((m) => m.refId === created.id);
      expect(moves).toHaveLength(2);
      expect(moves.find((m) => m.productId === 'P002')).toEqual(
        expect.objectContaining({ quantity: -2, balanceAfter: before2 - 2, refType: 'order', by: 'cashier' }),
      );
    });

    it('does not take stock or create a customer when the sale is refused', () => {
      const before = world.inventory.stockFor('P001');
      const customersBefore = world.customers.findAll('BIZ-101').length;
      const ordersBefore = service.findAllOrders().length;
      expect(() =>
        service.createOrder(
          {
            ...takeaway,
            customer: { name: 'New Person', phone: '9123456780' },
            items: [
              { productId: 'P001', quantity: 1 },
              { productId: 'P020', quantity: 1 },
            ],
          },
          ACTOR,
        ),
      ).toThrow('Detergent Powder is out of stock');
      expect(world.inventory.stockFor('P001')).toBe(before);
      expect(world.customers.findAll('BIZ-101')).toHaveLength(customersBefore);
      expect(service.findAllOrders()).toHaveLength(ordersBefore);
    });

    it('books cash on delivery as Processing with the payment pending and no payment row', () => {
      const created = service.createOrder(codDelivery, ACTOR);
      expect(created.orderType).toBe('delivery');
      expect(created.status).toBe('Processing');
      expect(created.paymentMethod).toBe('COD');
      expect(created.paymentStatus).toBe('Pending');
      expect(created.customerAddress).toBe('14, Park Street, Sector 9');
      expect(created.bill?.total).toBe(120);
      expect(created.payments).toHaveLength(0);
      expect(() => service.findOnePayment(created.bill!.billNo)).toThrow(/not found/);
    });

    it('forces COD for a COD checkout even when another method is sent', () => {
      expect(service.createOrder({ ...codDelivery, paymentMethod: 'UPI' }, ACTOR).paymentMethod).toBe('COD');
    });

    it('enforces the payment method rules', () => {
      expect(() => service.createOrder({ ...takeaway, paymentMethod: 'Bitcoin' }, ACTOR)).toThrow(
        'Payment method must be one of Cash, UPI, Card',
      );
      expect(() => service.createOrder({ ...takeaway, paymentMethod: 'COD' }, ACTOR)).toThrow(
        'Cash on delivery is only for delivery orders',
      );
      expect(() =>
        service.createOrder({ ...codDelivery, checkoutMode: 'prepaid_delivery', paymentMethod: 'COD' }, ACTOR),
      ).toThrow('Cash on delivery is only for delivery orders');
    });

    it('refuses an orderType that contradicts the checkout mode', () => {
      expect(() => service.createOrder({ ...takeaway, orderType: 'delivery' }, ACTOR)).toThrow(
        'checkoutMode takeaway_now is a pickup order, not delivery',
      );
    });

    it('needs a valid 10-digit phone and a full address for a delivery', () => {
      expect(() =>
        service.createOrder({ ...codDelivery, customer: { name: 'X', address: '14, Park Street' } }, ACTOR),
      ).toThrow("A delivery needs the customer's 10-digit phone number");
      expect(() =>
        service.createOrder({ ...codDelivery, customer: { phone: '12345', address: '14, Park Street' } }, ACTOR),
      ).toThrow('Customer phone must be a 10-digit Indian mobile number');
      expect(() =>
        service.createOrder({ ...codDelivery, customer: { phone: '9876543210', address: 'Park' } }, ACTOR),
      ).toThrow('A delivery needs a full address (at least 8 characters)');
    });

    it('links the sale to the customer by phone, creating one when the phone is new', () => {
      const known = service.createOrder({ ...takeaway, customer: { phone: '+91 98100 01001' } }, ACTOR);
      expect(known.customerId).toBe('CUS-001');
      expect(known.customerPhone).toBe('9810001001');

      const fresh = service.createOrder(codDelivery, ACTOR);
      const customer = world.customers.findByPhone('9876543210', 'BIZ-101');
      expect(fresh.customerId).toBe(customer.id);
      expect(customer.address).toBe('14, Park Street, Sector 9');

      const walkIn = service.createOrder(takeaway, ACTOR);
      expect(walkIn.customerId).toBe('CUS-900');
    });

    it('saves the server-worked coupon discount on the order and the bill', () => {
      const created = service.createOrder({ ...takeaway, promoCode: 'welcome10' }, ACTOR);
      expect(created.promoCode).toBe('WELCOME10');
      expect(created.discountAmount).toBe(62);
      expect(created.total).toBe(558);
      expect(created.bill?.discountAmount).toBe(62);
      expect(created.payments?.[0].amountPaid).toBe(558);
    });

    it('stops a customer from using a coupon more than its per-customer limit', () => {
      // FLAT50: ₹50 off ₹500+, three uses per customer.
      const order = {
        ...takeaway,
        customer: { name: 'Repeat Buyer', phone: '9123400001' },
        items: [{ productId: 'P001', quantity: 2 }],
        promoCode: 'FLAT50',
      };
      for (let i = 0; i < 3; i += 1) expect(service.createOrder(order, ACTOR).discountAmount).toBe(50);
      expect(() => service.createOrder(order, ACTOR)).toThrow(/already used FLAT50 3 time\(s\)/);

      // Cancelled bills give the use back.
      const customerId = world.customers.findByPhone('9123400001', 'BIZ-101').id;
      expect(service.couponUsage('BIZ-101', 'flat50', customerId).byCustomer).toBe(3);
      const last = service.findAllOrders().find((o) => o.customerId === customerId)!;
      service.cancelOrder(last.id, 'Customer changed mind', 'admin');
      expect(service.couponUsage('BIZ-101', 'FLAT50', customerId).byCustomer).toBe(2);
      expect(service.createOrder(order, ACTOR).discountAmount).toBe(50);
    });

    it('logs the sale in the activity log', () => {
      const created = service.createOrder(takeaway, ACTOR);
      const entries = world.activity.find({ entity: 'order', entityId: created.id });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(expect.objectContaining({ action: 'create', companyId: 'BIZ-101', by: 'cashier' }));
    });
  });

  describe('changes', () => {
    it('edits contact details and notes and bumps the version', () => {
      const before = service.findOneOrder('ORD-4829');
      const updated = service.updateOrder('ORD-4829', { notes: 'Ring the bell twice', customerName: 'Rahul S.' }, 'admin');
      expect(updated.notes).toBe('Ring the bell twice');
      expect(updated.customerName).toBe('Rahul S.');
      expect(updated.version).toBe(Number(before.version ?? 1) + 1);
      expect(updated.total).toBe(before.total);
    });

    it('refuses a stale version with 409', () => {
      const current = service.findOneOrder('ORD-4829');
      expect(() =>
        service.updateOrder('ORD-4829', { notes: 'x', version: Number(current.version ?? 1) + 5 }),
      ).toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('refuses a bad phone and an address change after the parcel has left', () => {
      expect(() => service.updateOrder('ORD-4829', { customerPhone: '12345' })).toThrow(
        'Customer phone must be a 10-digit Indian mobile number',
      );
      expect(() => service.updateOrder('ORD-4828', { customerAddress: '99, Another Road, Sector 1' })).toThrow(
        'The address cannot change after the order has left the store',
      );
    });

    it('does not move a delivery order status from the Orders page', () => {
      expect(() => service.updateOrder('ORD-4829', { status: 'Shipped' })).toThrow(/is a delivery order/);
    });

    it('cancels a paid order: stock goes back and the payment is marked refunded', () => {
      const p1 = world.inventory.stockFor('P001')!;
      const p2 = world.inventory.stockFor('P002')!;
      const p3 = world.inventory.stockFor('P003')!;
      const cancelled = service.cancelOrder('ORD-4829', 'Customer cancelled on the phone', 'admin');

      expect(cancelled.status).toBe('Cancelled');
      expect(cancelled.paymentStatus).toBe('Refunded');
      expect(cancelled.refundedAmount).toBe(cancelled.total);
      expect(cancelled.cancelReason).toBe('Customer cancelled on the phone');
      expect(world.inventory.stockFor('P001')).toBe(p1 + 1);
      expect(world.inventory.stockFor('P002')).toBe(p2 + 2);
      expect(world.inventory.stockFor('P003')).toBe(p3 + 1);
      const moves = world.inventory.findMovements({ type: 'cancel' }).filter((m) => m.refId === 'ORD-4829');
      expect(moves.map((m) => m.quantity).sort()).toEqual([1, 1, 2]);
    });

    it('voids an uncollected COD order on cancel', () => {
      const created = service.createOrder(codDelivery, ACTOR);
      const cancelled = service.cancelOrder(created.id, 'Wrong address', 'admin');
      expect(cancelled.paymentStatus).toBe('Voided');
      expect(cancelled.refundedAmount).toBe(0);
    });

    it('refuses to cancel twice, a shipped delivery, or an order with returns', () => {
      service.cancelOrder('ORD-4829', 'Customer cancelled', 'admin');
      expect(() => service.cancelOrder('ORD-4829', 'Again', 'admin')).toThrow('Order ORD-4829 is already cancelled');
      expect(() => service.cancelOrder('ORD-4828', 'Customer not home', 'admin')).toThrow(
        /already out with the delivery partner/,
      );
      expect(() => service.cancelOrder('ORD-4827', 'Customer changed mind', 'admin')).toThrow(
        /already has refunded returns/,
      );
    });

    it('records COD cash only when it matches the bill', () => {
      const order = service.findOneOrder('ORD-4828');
      expect(() => service.recordCodPayment('ORD-4828', order.total - 10, 'deliveryops')).toThrow(
        `Collect exactly ₹${order.total} for order ORD-4828`,
      );
      const paid = service.recordCodPayment('ORD-4828', order.total, 'deliveryops');
      expect(paid.paymentStatus).toBe('Paid');
      expect(paid.payments).toHaveLength(1);
      expect(paid.payments?.[0]).toEqual(
        expect.objectContaining({ paymentMethod: 'Cash', amountPaid: order.total, billNo: order.bill?.billNo }),
      );
      // Calling again does not double-record.
      expect(service.recordCodPayment('ORD-4828', order.total).payments).toHaveLength(1);
    });

    it('refuses refunds that add up to more than the bill', () => {
      const order = service.findOneOrder('ORD-4829');
      expect(service.applyRefund('ORD-4829', 100).refundedAmount).toBe(100);
      expect(() => service.applyRefund('ORD-4829', order.total)).toThrow(/more than the bill/);
    });

    it('only deletes a cancelled order, and only hides it', () => {
      expect(() => service.removeOrder('ORD-4829')).toThrow(
        'Order ORD-4829 is Processing. Cancel it first; only cancelled orders can be deleted.',
      );
      service.cancelOrder('ORD-4829', 'Customer cancelled', 'admin');
      const result = service.removeOrder('ORD-4829', 'admin');
      expect(result.message).toBe('Order ORD-4829 deleted');
      expect(result.order.deleted).toBe(true);
      expect(service.findAllOrders().some((o) => o.id === 'ORD-4829')).toBe(false);
      expect(service.findAllOrders(undefined, undefined, true).some((o) => o.id === 'ORD-4829')).toBe(true);
      // Items and bill are kept for the books.
      expect(service.findOneOrder('ORD-4829').items).toHaveLength(3);
    });
  });
});

describe('Orders routes', () => {
  let world: ReturnType<typeof buildWorld>;

  beforeEach(() => {
    world = buildWorld();
  });

  const app = () => world.app;

  describe('credentials and scoping', () => {
    it('rejects a request with no credential (401)', async () => {
      const response = await request(app()).get('/api/orders');
      expect(response.status).toBe(401);
    });

    it('rejects a role that may not sell (403)', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'returnhandler')
        .send({ ...takeaway });
      expect(response.status).toBe(403);
    });

    it('lets order readers list orders', async () => {
      const response = await request(app()).get('/api/orders?companyId=BIZ-101').set('x-role', 'deliveryops');
      expect(response.status).toBe(200);
      expect(response.body.every((o: { companyId: string }) => o.companyId === 'BIZ-101')).toBe(true);
    });

    it('needs a companyId from a cross-company caller', async () => {
      const { companyId: _c, ...body } = takeaway;
      const response = await request(app()).post('/api/orders').set('x-role', 'admin').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Pick a business first. The super user must open a business before adding records.');
    });

    it('sells into the signed-in user\'s own business and refuses another', async () => {
      const { companyId: _c, ...body } = takeaway;
      const own = await request(app())
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken()}`)
        .send(body);
      expect(own.status).toBe(201);
      expect(own.body.companyId).toBe('BIZ-101');
      expect(own.body.staffId).toBe('USR-002');
      expect(own.body.staffName).toBe('Komal Shah');

      const other = await request(app())
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken()}`)
        .send({ ...body, companyId: 'BIZ-102' });
      expect(other.status).toBe(403);
    });

    it('hides another business\'s orders (404) and lists only its own', async () => {
      const token = metroAdminToken();
      const one = await request(app()).get('/api/orders/ORD-4829').set('Authorization', `Bearer ${token}`);
      expect(one.status).toBe(404);

      const list = await request(app()).get('/api/orders').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThan(0);
      expect(list.body.every((o: { companyId: string }) => o.companyId === 'BIZ-102')).toBe(true);

      const asked = await request(app()).get('/api/orders?companyId=BIZ-101').set('Authorization', `Bearer ${token}`);
      expect(asked.status).toBe(403);

      const cancel = await request(app())
        .post('/api/orders/ORD-4829/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Not mine to cancel' });
      expect(cancel.status).toBe(404);
      expect(world.orders.findOneOrder('ORD-4829').status).toBe('Processing');
    });

    it('will not sell another business\'s product', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('Authorization', `Bearer ${metroAdminToken()}`)
        .send({ checkoutMode: 'takeaway_now', items: [{ productId: 'P001', quantity: 1 }] });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Product P001 does not belong to this business');
    });

    it('refuses a token for a user who does not exist', async () => {
      const token = signAccessToken({ sub: 'USR-999', username: 'ghost', role: 'admin', companyId: 'BIZ-101' });
      const response = await request(app()).get('/api/orders').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/orders', () => {
    it('creates a counter sale priced by the server (201)', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...takeaway, items: [{ productId: 'P001', quantity: 1, itemPrice: 380 }, { productId: 'P002', quantity: 2 }] });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('ORD-4830');
      expect(response.body.total).toBe(620);
      expect(response.body.status).toBe('Delivered');
      expect(response.body.paymentStatus).toBe('Paid');
      expect(response.body.bill.total).toBe(620);
      expect(response.body.payments).toHaveLength(1);
      expect(response.body.delivery).toBeUndefined();
    });

    it('refuses a tampered line price with 409 and sells nothing', async () => {
      const before = world.inventory.stockFor('P001');
      const count = world.orders.findAllOrders().length;
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...takeaway, items: [{ productId: 'P001', quantity: 1, itemPrice: 1 }] });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('The price of Basmati Rice is now ₹380');
      expect(response.body.details).toEqual({ productId: 'P001', price: 380 });
      expect(world.inventory.stockFor('P001')).toBe(before);
      expect(world.orders.findAllOrders()).toHaveLength(count);
    });

    it('refuses an out-of-stock item with 409', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...takeaway, items: [{ productId: 'P020', quantity: 1 }] });
      expect(response.status).toBe(409);
      expect(response.body.details).toEqual({ productId: 'P020', stockAvailable: 0 });
    });

    it('validates the body (400)', async () => {
      const bad = [
        { ...takeaway, items: [] },
        { ...takeaway, items: [{ productId: 'P001', quantity: 0 }] },
        { ...takeaway, items: [{ productId: 'P001', quantity: 1.5 }] },
        { ...takeaway, checkoutMode: 'drone' },
        { ...takeaway, checkoutMode: undefined },
      ];
      for (const body of bad) {
        const response = await request(app()).post('/api/orders').set('x-role', 'cashier').send(body);
        expect(response.status).toBe(400);
      }
    });

    it('creates the delivery in the same request for a delivery order', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({
          ...codDelivery,
          deliveryCharge: 30,
          delivery: { partnerName: 'Ravi', partnerPhone: '9988776655', partnerAgency: 'Dunzo', partnerVehicle: 'DL3S 1234', etaMinutes: 30 },
        });

      expect(response.status).toBe(201);
      expect(response.body.total).toBe(150);
      expect(response.body.paymentStatus).toBe('Pending');
      expect(response.body.delivery).toEqual(
        expect.objectContaining({
          orderId: response.body.id,
          status: 'Assigned',
          codAmount: 150,
          partnerName: 'Ravi',
          partnerPhone: '9988776655',
          partnerAgency: 'Dunzo',
          etaMinutes: 30,
          customerPhone: '9876543210',
        }),
      );
      expect(world.deliveries.findByOrder(response.body.id).id).toBe(response.body.delivery.id);
    });

    it('creates a Pending delivery when no partner is given', async () => {
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...codDelivery, checkoutMode: 'prepaid_delivery', paymentMethod: 'Card' });
      expect(response.status).toBe(201);
      expect(response.body.paymentStatus).toBe('Paid');
      expect(response.body.delivery.status).toBe('Pending');
      expect(response.body.delivery.codAmount).toBe(0);
    });

    it('cancels the sale and puts the stock back when the delivery cannot be booked', async () => {
      const before = world.inventory.stockFor('P005');
      const response = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...codDelivery, delivery: { partnerName: 'Ravi' } });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/partner's phone/);
      expect(world.inventory.stockFor('P005')).toBe(before);
      const orphan = world.orders.findOneOrder('ORD-4830');
      expect(orphan.status).toBe('Cancelled');
      expect(orphan.paymentStatus).toBe('Voided');
    });

    it('refuses a delivery order without a phone or address (400) and books nothing', async () => {
      const count = world.orders.findAllOrders().length;
      const noPhone = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...codDelivery, customer: { address: '14, Park Street, Sector 9' } });
      expect(noPhone.status).toBe(400);
      const noAddress = await request(app())
        .post('/api/orders')
        .set('x-role', 'cashier')
        .send({ ...codDelivery, customer: { phone: '9876543210' } });
      expect(noAddress.status).toBe(400);
      expect(world.orders.findAllOrders()).toHaveLength(count);
    });
  });

  describe('quote and promotions', () => {
    it('quotes a cart without saving anything (200)', async () => {
      const count = world.orders.findAllOrders().length;
      const response = await request(app())
        .post('/api/orders/quote')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', items: takeaway.items, promoCode: 'WELCOME10' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({ subtotal: 620, discountAmount: 62, total: 558, promoCode: 'WELCOME10' }),
      );
      expect(response.body.lines).toHaveLength(2);
      expect(world.orders.findAllOrders()).toHaveLength(count);
    });

    it('returns 409 from the quote for a stale price', async () => {
      const response = await request(app())
        .post('/api/orders/quote')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', items: [{ productId: 'P002', quantity: 1, itemPrice: 100 }] });
      expect(response.status).toBe(409);
    });

    it('validates a good promo code (200) and refuses a bad one (400)', async () => {
      const ok = await request(app())
        .post('/api/orders/promotions/validate')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', code: 'flat50', subtotal: 800 });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual(expect.objectContaining({ valid: true, code: 'FLAT50', discount: 50, total: 750 }));

      const bad = await request(app())
        .post('/api/orders/promotions/validate')
        .set('x-role', 'cashier')
        .send({ companyId: 'BIZ-101', code: 'FLAT50', subtotal: 200 });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toMatch(/needs a bill of at least ₹500/);
    });
  });

  describe('bills and payments', () => {
    it('serves /bills/all and /payments/all rather than letting /:id swallow them', async () => {
      const bills = await request(app()).get('/api/orders/bills/all?companyId=BIZ-101').set('x-role', 'cashier');
      expect(bills.status).toBe(200);
      expect(bills.body.length).toBeGreaterThan(0);
      expect(bills.body.every((b: { companyId: string }) => b.companyId === 'BIZ-101')).toBe(true);

      const payments = await request(app()).get('/api/orders/payments/all').set('x-role', 'cashier');
      expect(payments.status).toBe(200);
      expect(Array.isArray(payments.body)).toBe(true);
    });

    it('serves one bill, and 404 for a payment that was never collected', async () => {
      const bill = world.orders.findOneOrder('ORD-4829').bill!;
      const one = await request(app()).get(`/api/orders/bills/${bill.billNo}`).set('x-role', 'cashier');
      expect(one.status).toBe(200);
      expect(one.body.orderId).toBe('ORD-4829');

      const codBill = world.orders.findOneOrder('ORD-4828').bill!;
      const none = await request(app()).get(`/api/orders/payments/${codBill.billNo}`).set('x-role', 'cashier');
      expect(none.status).toBe(404);
    });

    it('no longer accepts bills or payments from the browser', async () => {
      const bill = await request(app()).post('/api/orders/bills').set('x-role', 'admin').send({ orderId: 'ORD-4829' });
      expect(bill.status).toBe(404);
      const payment = await request(app()).post('/api/orders/payments').set('x-role', 'admin').send({ billNo: 'BILL-0001' });
      expect(payment.status).toBe(404);
    });

    it('hides another business\'s bill (404)', async () => {
      const bill = world.orders.findOneOrder('ORD-4829').bill!;
      const response = await request(app())
        .get(`/api/orders/bills/${bill.billNo}`)
        .set('Authorization', `Bearer ${signAccessToken({ sub: 'USR-009', username: 'metrocashier', role: 'cashier', companyId: 'BIZ-102' })}`);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('edits notes and contact details (200)', async () => {
      const response = await request(app())
        .put('/api/orders/ORD-4829')
        .set('x-role', 'cashier')
        .send({ notes: 'Leave at the gate', customerPhone: '9810001011' });
      expect(response.status).toBe(200);
      expect(response.body.notes).toBe('Leave at the gate');
      expect(response.body.customerPhone).toBe('9810001011');
    });

    it('refuses edits to the total, item count, discount or payment method (400)', async () => {
      for (const body of [{ total: 1 }, { itemsCount: 9 }, { discountAmount: 100 }, { paymentMethod: 'Cash' }]) {
        const response = await request(app()).put('/api/orders/ORD-4829').set('x-role', 'admin').send(body);
        expect(response.status).toBe(400);
      }
      const order = world.orders.findOneOrder('ORD-4829');
      expect(order.paymentMethod).toBe('UPI');
      expect(order.total).toBe(order.bill?.total);
    });

    it('refuses an empty update and a bad id (400)', async () => {
      expect((await request(app()).put('/api/orders/ORD-4829').set('x-role', 'admin').send({})).status).toBe(400);
      expect((await request(app()).put('/api/orders/4829').set('x-role', 'admin').send({ notes: 'x' })).status).toBe(400);
    });

    it('refuses a status move a delivery order cannot make here (409)', async () => {
      const response = await request(app()).put('/api/orders/ORD-4829').set('x-role', 'admin').send({ status: 'Delivered' });
      expect(response.status).toBe(409);
    });

    it('does not let a cashier void a bill through PUT (403)', async () => {
      const response = await request(app())
        .put('/api/orders/ORD-4829')
        .set('x-role', 'cashier')
        .send({ status: 'Cancelled', cancelReason: 'oops' });
      expect(response.status).toBe(403);
      expect(world.orders.findOneOrder('ORD-4829').status).toBe('Processing');
    });

    it('returns 404 for an unknown order', async () => {
      const response = await request(app()).put('/api/orders/ORD-9999').set('x-role', 'admin').send({ notes: 'x' });
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('lets an admin cancel: stock back, payment refunded, open delivery cancelled', async () => {
      const before = world.inventory.stockFor('P002')!;
      const response = await request(app())
        .post('/api/orders/ORD-4829/cancel')
        .set('x-role', 'admin')
        .send({ reason: 'Customer cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Cancelled');
      expect(response.body.paymentStatus).toBe('Refunded');
      expect(world.inventory.stockFor('P002')).toBe(before + 2);
      expect(world.deliveries.findOne('DEL-901').status).toBe('Cancelled');
    });

    it('does not let a cashier cancel (403)', async () => {
      const response = await request(app())
        .post('/api/orders/ORD-4829/cancel')
        .set('x-role', 'cashier')
        .send({ reason: 'Customer cancelled' });
      expect(response.status).toBe(403);
      expect(world.orders.findOneOrder('ORD-4829').status).toBe('Processing');
    });

    it('needs a reason (400) and refuses a shipped order (409)', async () => {
      const noReason = await request(app()).post('/api/orders/ORD-4829/cancel').set('x-role', 'admin').send({ reason: 'x' });
      expect(noReason.status).toBe(400);
      const shipped = await request(app())
        .post('/api/orders/ORD-4828/cancel')
        .set('x-role', 'admin')
        .send({ reason: 'Customer not home' });
      expect(shipped.status).toBe(409);
    });

    it('refuses a cancel against a stale version (409)', async () => {
      const response = await request(app())
        .post('/api/orders/ORD-4829/cancel')
        .set('x-role', 'admin')
        .send({ reason: 'Customer cancelled', version: 999 });
      expect(response.status).toBe(409);
      expect(world.orders.findOneOrder('ORD-4829').status).toBe('Processing');
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('only lets superuser or admin delete an order', async () => {
      const response = await request(app()).delete('/api/orders/ORD-4829').set('x-role', 'cashier');
      expect(response.status).toBe(403);
    });

    it('refuses to delete an order that is not cancelled (409)', async () => {
      const response = await request(app()).delete('/api/orders/ORD-4829').set('x-role', 'admin');
      expect(response.status).toBe(409);
    });

    it('soft-deletes a cancelled order', async () => {
      await request(app()).post('/api/orders/ORD-4829/cancel').set('x-role', 'admin').send({ reason: 'Customer cancelled' });
      const response = await request(app()).delete('/api/orders/ORD-4829').set('x-role', 'superuser');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order ORD-4829 deleted');

      const list = await request(app()).get('/api/orders?companyId=BIZ-101').set('x-role', 'admin');
      expect(list.body.some((o: { id: string }) => o.id === 'ORD-4829')).toBe(false);
      const withDeleted = await request(app())
        .get('/api/orders?companyId=BIZ-101&includeDeleted=true')
        .set('x-role', 'admin');
      expect(withDeleted.body.find((o: { id: string }) => o.id === 'ORD-4829').deleted).toBe(true);
      const one = await request(app()).get('/api/orders/ORD-4829').set('x-role', 'admin');
      expect(one.status).toBe(200);
    });
  });
});
