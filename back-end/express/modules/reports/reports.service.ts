import { round2 } from '../../utils/money';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { LOW_STOCK_STATUSES } from '../inventory/inventory.schema';
import { ordersService, OrdersService } from '../orders/orders.service';
import { productsService, ProductsService } from '../products/products.service';
import { returnsService, ReturnsService } from '../returns/returns.service';
import { CountByKey, InventoryReport, ReportQuery, ReturnsReport, SalesReport } from './reports.schema';

const IST = 330 * 60 * 1000;

/** Calendar day in India for an ISO timestamp. */
export function istDay(iso: string): string {
  return new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 10);
}

function istHour(iso: string): number {
  return new Date(new Date(iso).getTime() + IST).getUTCHours();
}

function countBy<T>(rows: T[], key: (row: T) => string): CountByKey {
  return rows.reduce<CountByKey>((acc, row) => {
    const k = key(row) || 'Unknown';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Reports Module Service
 *
 * Every figure is worked out from saved orders, returns and the stock ledger
 * for one business and one date range (India time), so the dashboard, the
 * Reports page and the coupon analytics always agree.
 */
export class ReportsService {
  constructor(
    private readonly orders: OrdersService = ordersService,
    private readonly inventory: InventoryService = inventoryService,
    private readonly returns: ReturnsService = returnsService,
    private readonly products: ProductsService = productsService,
  ) {}

  public getSalesReport(query: ReportQuery = {}): SalesReport {
    const inRange = (iso: string) => {
      const day = istDay(iso);
      return (!query.from || day >= query.from) && (!query.to || day <= query.to);
    };
    const allOrders = this.orders.findAllOrders(query.companyId);
    const all = allOrders.filter((o) => inRange(o.orderDate));
    const live = all.filter((o) => o.status !== 'Cancelled');
    const refundedInRange = allOrders.filter(
      (o) =>
        o.status !== 'Cancelled' &&
        (o.refundedAmount ?? 0) > 0 &&
        inRange(o.refundedAt || o.updatedAt || o.orderDate),
    );
    const categoryOf = new Map(this.products.findAll({ companyId: query.companyId, includeInactive: true }).map((p) => [p.id, p.category]));

    const grossSales = round2(live.reduce((s, o) => s + o.total, 0));
    const refunds = round2(refundedInRange.reduce((s, o) => s + (o.refundedAmount ?? 0), 0));
    const netSales = round2(grossSales - refunds);
    // Money in the drawer: payments taken on bills still standing, less refunds paid out in range.
    const collected = round2(
      live.reduce((s, o) => s + (o.payments ?? []).reduce((p, pay) => p + (pay.paymentStatus === 'Paid' ? pay.amountPaid : 0), 0), 0) -
        refunds,
    );
    const codPending = round2(
      live.filter((o) => o.paymentMethod === 'COD' && o.paymentStatus === 'Pending').reduce((s, o) => s + o.total, 0),
    );

    const days = new Map<string, { day: string; orders: number; gross: number; refunds: number; net: number; discount: number }>();
    const hours = new Map<number, { hour: number; orders: number; net: number }>();
    const cashiers = new Map<string, { staff: string; orders: number; net: number }>();
    const categories = new Map<string, { category: string; quantity: number; sales: number }>();
    const products = new Map<string, { productId: string; productName: string; quantity: number; sales: number }>();

    live.forEach((o) => {
      const day = istDay(o.orderDate);
      const d = days.get(day) ?? { day, orders: 0, gross: 0, refunds: 0, net: 0, discount: 0 };
      d.orders += 1;
      d.gross = round2(d.gross + o.total);
      d.net = round2(d.net + o.total);
      d.discount = round2(d.discount + o.discountAmount);
      days.set(day, d);

      const hour = istHour(o.orderDate);
      const h = hours.get(hour) ?? { hour, orders: 0, net: 0 };
      h.orders += 1;
      h.net = round2(h.net + o.total);
      hours.set(hour, h);

      const staff = o.staffName || o.staffId || 'Unknown';
      const c = cashiers.get(staff) ?? { staff, orders: 0, net: 0 };
      c.orders += 1;
      c.net = round2(c.net + o.total);
      cashiers.set(staff, c);

      const keep = (o.subtotal ?? 0) > 0 ? (o.subtotal! - o.discountAmount) / o.subtotal! : 1;
      o.items.forEach((item) => {
        const sales = round2(item.itemPrice * item.quantity * keep);
        const category = categoryOf.get(item.productId) ?? 'Uncategorized';
        const cat = categories.get(category) ?? { category, quantity: 0, sales: 0 };
        cat.quantity += item.quantity;
        cat.sales = round2(cat.sales + sales);
        categories.set(category, cat);
        const p = products.get(item.productId) ?? { productId: item.productId, productName: item.productName ?? item.productId, quantity: 0, sales: 0 };
        p.quantity += item.quantity;
        p.sales = round2(p.sales + sales);
        products.set(item.productId, p);
      });
    });

    refundedInRange.forEach((o) => {
      const day = istDay(o.refundedAt || o.updatedAt || o.orderDate);
      const d = days.get(day) ?? { day, orders: 0, gross: 0, refunds: 0, net: 0, discount: 0 };
      const amt = o.refundedAmount ?? 0;
      d.refunds = round2(d.refunds + amt);
      d.net = round2(d.net - amt);
      days.set(day, d);
    });

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      totalOrders: live.length,
      cancelledOrders: all.length - live.length,
      grossSales,
      refunds,
      netSales,
      collected,
      codPending,
      totalDiscount: round2(live.reduce((s, o) => s + o.discountAmount, 0)),
      taxCollected: round2(live.reduce((s, o) => s + (o.taxAmount ?? 0), 0)),
      avgBill: live.length ? round2(grossSales / live.length) : 0,
      itemsSold: live.reduce((s, o) => s + o.itemsCount, 0),
      totalRevenue: netSales,
      byStatus: countBy(all, (o) => o.status),
      byPaymentMethod: countBy(live, (o) => o.paymentMethod),
      byOrderType: countBy(live, (o) => o.orderType),
      byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      byHour: [...hours.values()].sort((a, b) => a.hour - b.hour),
      byCashier: [...cashiers.values()].sort((a, b) => b.net - a.net),
      byCategory: [...categories.values()].sort((a, b) => b.sales - a.sales),
      topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      orders: all,
    };
  }

  public getInventoryReport(query: ReportQuery = {}): InventoryReport {
    const inventory = this.inventory.findAll(query.companyId);
    const lowStock: readonly string[] = LOW_STOCK_STATUSES;
    const lowStockItems = inventory.filter((item) => lowStock.includes(item.status));
    let atCost = 0;
    let atPrice = 0;
    inventory.forEach((row) => {
      try {
        const p = this.products.findOne(row.productId);
        atCost += row.stockAvailable * (p.costPrice ?? p.price);
        atPrice += row.stockAvailable * p.price;
      } catch {
        /* product removed */
      }
    });
    const movements = this.inventory.findMovements({ companyId: query.companyId, limit: 1000 });
    return {
      totalItems: inventory.length,
      byStatus: countBy(inventory, (i) => i.status),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      stockValueAtCost: round2(atCost),
      stockValueAtPrice: round2(atPrice),
      movementsByType: countBy(movements, (m) => m.type),
      inventory,
    };
  }

  public getReturnsReport(query: ReportQuery = {}): ReturnsReport {
    const returns = this.returns
      .findAll(undefined, query.companyId)
      .filter((r) => (!query.from || r.returnDate >= query.from) && (!query.to || r.returnDate <= query.to));
    const top = new Map<string, number>();
    returns.forEach((r) => (r.items ?? []).forEach((l) => top.set(l.productName, (top.get(l.productName) ?? 0) + l.qty)));
    return {
      totalReturns: returns.length,
      totalRefund: round2(returns.filter((r) => r.status === 'Refunded').reduce((s, r) => s + r.refundAmount, 0)),
      byStatus: countBy(returns, (r) => r.status),
      byReason: countBy(returns, (r) => r.reason),
      topProducts: [...top.entries()].map(([productName, qty]) => ({ productName, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5),
      returns,
    };
  }
}

export const reportsService = new ReportsService();
