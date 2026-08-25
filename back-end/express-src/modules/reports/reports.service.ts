'use strict';

class ReportsService {
  [key: string]: any;
  constructor(ordersService, inventoryService, returnsService) {
    this.ordersService = ordersService;
    this.inventoryService = inventoryService;
    this.returnsService = returnsService;
  }

  getSalesReport() {
    const orders = this.ordersService.findAllOrders();
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = orders.length;
    const totalDiscount = orders.reduce((s, o) => s + Number(o.discountAmount || 0), 0);
    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    const byPaymentMethod = orders.reduce((acc, o) => {
      const m = o.paymentMethod || 'Unknown';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    return { totalRevenue, totalOrders, totalDiscount, byStatus, byPaymentMethod, orders };
  }

  getInventoryReport() {
    const inventory = this.inventoryService.findAll();
    const byStatus = inventory.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {});
    const lowStock = this.inventoryService.findLowStock();
    return { totalItems: inventory.length, byStatus, lowStockCount: lowStock.length, lowStockItems: lowStock, inventory };
  }

  getReturnsReport() {
    const returns = this.returnsService.findAll();
    const totalRefund = returns.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
    const byStatus = returns.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    const byReason = returns.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {});
    return { totalReturns: returns.length, totalRefund, byStatus, byReason, returns };
  }
}

module.exports = { ReportsService };
