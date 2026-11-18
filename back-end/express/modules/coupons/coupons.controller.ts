import { Request } from 'express';
import { round2 } from '../../utils/money';
import { handle, param, query } from '../../utils/http';
import { actorName, assertInScope, listScope, writeScope } from '../../utils/scope';
import { customersService } from '../customers/customers.service';
import { ordersService, OrdersService } from '../orders/orders.service';
import { couponsService, CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupons.schema';

function istDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Coupons Module Controller
 *
 * Analytics are worked out from the saved orders, so they always agree with
 * the Orders page: uses, customers, sales, discount given, how coupon bills
 * compare with the rest, which cashiers apply them, returns on coupon bills,
 * the daily trend and the products bought with each code.
 */
export class CouponsController {
  constructor(
    private readonly service: CouponsService = couponsService,
    private readonly orders: OrdersService = ordersService,
  ) {}

  private owned(req: Request) {
    const coupon = this.service.findOne(param(req, 'id'));
    assertInScope(req, coupon.companyId, `Coupon ${coupon.id}`);
    return coupon;
  }

  private usedCount(companyId: string, code: string): number {
    return this.orders.couponUsage(companyId, code).total;
  }

  public findAll = handle((req) => {
    const companyId = listScope(req, query(req, 'companyId'));
    return this.service.findAll(companyId).map((c) => ({
      ...c,
      usedCount: this.usedCount(c.companyId, c.code),
    }));
  });

  public findOne = handle((req) => {
    const coupon = this.owned(req);
    return { ...coupon, usedCount: this.usedCount(coupon.companyId, coupon.code) };
  });

  public create = handle((req) => {
    const body = req.body as CreateCouponDto;
    return this.service.create({ ...body, companyId: writeScope(req, body.companyId) }, actorName(req));
  }, 201);

  public update = handle((req) => {
    const coupon = this.owned(req);
    return this.service.update(coupon.id, req.body as UpdateCouponDto, this.usedCount(coupon.companyId, coupon.code), actorName(req));
  });

  public remove = handle((req) => {
    const coupon = this.owned(req);
    return this.service.remove(coupon.id, this.usedCount(coupon.companyId, coupon.code), actorName(req));
  });

  public validate = handle((req) => {
    const body = req.body as ValidateCouponDto;
    const companyId = writeScope(req, body.companyId);
    let customerId = body.customerId;
    if (!customerId && body.customerPhone) {
      try {
        customerId = customersService.findByPhone(body.customerPhone, companyId).id;
      } catch {
        customerId = undefined;
      }
    }
    return this.service.validate(companyId, body.code, body.subtotal, this.orders.couponUsage(companyId, body.code, customerId));
  });

  public analytics = handle((req) => {
    const companyId = listScope(req, query(req, 'companyId'));
    const from = query(req, 'from');
    const to = query(req, 'to');
    const all = this.orders
      .findAllOrders(companyId)
      .filter((o) => o.status !== 'Cancelled')
      .filter((o) => {
        const day = istDay(o.orderDate);
        return (!from || day >= from) && (!to || day <= to);
      });
    const withCoupon = all.filter((o) => o.promoCode);
    const without = all.filter((o) => !o.promoCode);
    const avg = (list: typeof all) => (list.length ? round2(list.reduce((s, o) => s + o.total, 0) / list.length) : 0);

    // First order of each customer (walk-ins excluded) tells new from repeat.
    const firstOrder = new Map<string, string>();
    [...this.orders.findAllOrders(companyId)]
      .sort((a, b) => a.orderDate.localeCompare(b.orderDate))
      .forEach((o) => {
        if (o.customerPhone && !firstOrder.has(o.customerId)) firstOrder.set(o.customerId, o.id);
      });

    const coupons = this.service.findAll(companyId).map((coupon) => {
      const used = withCoupon.filter((o) => o.companyId === coupon.companyId && o.promoCode === coupon.code);
      const gross = round2(used.reduce((s, o) => s + (o.subtotal ?? o.total + o.discountAmount), 0));
      const discount = round2(used.reduce((s, o) => s + o.discountAmount, 0));
      const net = round2(used.reduce((s, o) => s + o.total - (o.refundedAmount ?? 0), 0));
      const customers = new Set(used.filter((o) => o.customerPhone).map((o) => o.customerId));
      const newCustomers = used.filter((o) => o.customerPhone && firstOrder.get(o.customerId) === o.id).length;
      const byCashier = new Map<string, { staff: string; uses: number; discount: number }>();
      used.forEach((o) => {
        const key = o.staffName || o.staffId;
        const row = byCashier.get(key) ?? { staff: key, uses: 0, discount: 0 };
        row.uses += 1;
        row.discount = round2(row.discount + o.discountAmount);
        byCashier.set(key, row);
      });
      const byDay = new Map<string, { day: string; uses: number; discount: number; sales: number }>();
      used.forEach((o) => {
        const day = istDay(o.orderDate);
        const row = byDay.get(day) ?? { day, uses: 0, discount: 0, sales: 0 };
        row.uses += 1;
        row.discount = round2(row.discount + o.discountAmount);
        row.sales = round2(row.sales + o.total);
        byDay.set(day, row);
      });
      const products = new Map<string, { productId: string; productName: string; quantity: number }>();
      used.forEach((o) =>
        o.items.forEach((i) => {
          const row = products.get(i.productId) ?? { productId: i.productId, productName: i.productName ?? i.productId, quantity: 0 };
          row.quantity += i.quantity;
          products.set(i.productId, row);
        }),
      );
      const returned = used.filter((o) => (o.refundedAmount ?? 0) > 0).length;
      return {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        active: coupon.active,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        usageLimit: coupon.usageLimit,
        uses: used.length,
        uniqueCustomers: customers.size,
        newCustomers,
        repeatCustomers: Math.max(0, used.filter((o) => o.customerPhone).length - newCustomers),
        grossSales: gross,
        discountGiven: discount,
        netRevenue: net,
        discountShare: gross ? round2((discount / gross) * 100) : 0,
        avgBill: avg(used),
        returnRate: used.length ? round2((returned / used.length) * 100) : 0,
        byCashier: [...byCashier.values()].sort((a, b) => b.uses - a.uses),
        daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
        topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      };
    });

    return {
      from: from ?? null,
      to: to ?? null,
      totals: {
        orders: all.length,
        couponOrders: withCoupon.length,
        couponShare: all.length ? round2((withCoupon.length / all.length) * 100) : 0,
        discountGiven: round2(withCoupon.reduce((s, o) => s + o.discountAmount, 0)),
        avgBillWithCoupon: avg(withCoupon),
        avgBillWithoutCoupon: avg(without),
      },
      coupons: coupons.sort((a, b) => b.uses - a.uses),
    };
  });
}

export const couponsController = new CouponsController();
