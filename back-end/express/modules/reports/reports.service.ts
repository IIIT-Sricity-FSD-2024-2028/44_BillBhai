import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { ordersService, OrdersService } from '../orders/orders.service';
import { returnsService, ReturnsService } from '../returns/returns.service';
import {
  CountByKey,
  InventoryReport,
  ReturnsReport,
  SalesReport,
} from './reports.schema';

/**
 * Reports Module Service
 *
 * Owns no data of its own: every figure is aggregated from the orders,
 * inventory and returns services, which are injected through the constructor so
 * a test can hand in stubs. Framework agnostic: no express imports, no request
 * or response objects, no HTTP status codes.
 */
export class ReportsService {
  constructor(
    private readonly orders: OrdersService = ordersService,
    private readonly inventory: InventoryService = inventoryService,
    private readonly returns: ReturnsService = returnsService,
  ) {}

  /** Tallies rows by whatever key `pick` pulls off each one. */
  private countBy<T>(rows: T[], pick: (row: T) => string): CountByKey {
    return rows.reduce<CountByKey>((counts, row) => {
      const key = pick(row);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  public getSalesReport(): SalesReport {
    const orders = this.orders.findAllOrders();

    return {
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      totalOrders: orders.length,
      totalDiscount: orders.reduce(
        (sum, order) => sum + Number(order.discountAmount || 0),
        0,
      ),
      byStatus: this.countBy(orders, (order) => order.status),
      byPaymentMethod: this.countBy(
        orders,
        (order) => order.paymentMethod || 'Unknown',
      ),
      orders,
    };
  }

  public getInventoryReport(): InventoryReport {
    const inventory = this.inventory.findAll();
    const lowStockItems = this.inventory.findLowStock();

    return {
      totalItems: inventory.length,
      byStatus: this.countBy(inventory, (item) => item.status),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      inventory,
    };
  }

  public getReturnsReport(): ReturnsReport {
    const returns = this.returns.findAll();

    return {
      totalReturns: returns.length,
      totalRefund: returns.reduce(
        (sum, entry) => sum + Number(entry.refundAmount || 0),
        0,
      ),
      byStatus: this.countBy(returns, (entry) => entry.status),
      byReason: this.countBy(returns, (entry) => entry.reason),
      returns,
    };
  }
}

export const reportsService = new ReportsService();
