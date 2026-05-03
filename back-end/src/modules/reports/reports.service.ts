import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { ReturnsService } from '../returns/returns.service';

/**
 * ReportsService: Aggregates data from multiple modules to provide
 * high-level business analytics and summaries.
 */
@Injectable()
export class ReportsService {
  constructor(
    // Dependencies on other services to gather data
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly returnsService: ReturnsService,
  ) {}

  getSalesSummary() {
    const orders = this.ordersService.findAllOrders();
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    return {
      totalSales,
      orderCount,
      avgOrderValue,
      period: 'All Time (In-Memory)',
    };
  }

  getInventoryStatus() {
    const inventory = this.inventoryService.findAll();
    const lowStockCount = inventory.filter(
      (i) => i.status === 'Low Stock' || i.status === 'Critical',
    ).length;
    const outOfStockCount = inventory.filter(
      (i) => i.status === 'Out of Stock',
    ).length;

    return {
      totalSKUs: inventory.length,
      lowStockCount,
      outOfStockCount,
      inventoryHealth:
        lowStockCount + outOfStockCount > 5 ? 'Attention Required' : 'Healthy',
    };
  }

  getReturnsSummary() {
    const returns = this.returnsService.findAll();
    const totalRefunded = returns
      .filter((r) => r.status === 'Refunded')
      .reduce((sum, r) => sum + r.refundAmount, 0);

    return {
      totalReturns: returns.length,
      pendingReturns: returns.filter((r) => r.status === 'Pending').length,
      totalRefunded,
    };
  }
}
