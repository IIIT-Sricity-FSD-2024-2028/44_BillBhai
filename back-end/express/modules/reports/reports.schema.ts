import { InventoryItem, ReturnRecord } from '../../data/entities';
import { OrderSnapshot } from '../orders/orders.schema';

/**
 * Reports Module Schemas - DTOs and result types only. No business logic.
 *
 * Every reports endpoint is a plain GET with no params, query string or body,
 * so this file declares no zod schemas: there is nothing to validate. What it
 * does own is the shape of each report, which the service builds and the
 * dashboard consumes.
 */

/** A tally of rows keyed by a field value, for example { Processing: 2 }. */
export type CountByKey = Record<string, number>;

export interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  byStatus: CountByKey;
  byPaymentMethod: CountByKey;
  orders: OrderSnapshot[];
}

export interface InventoryReport {
  totalItems: number;
  byStatus: CountByKey;
  lowStockCount: number;
  lowStockItems: InventoryItem[];
  inventory: InventoryItem[];
}

export interface ReturnsReport {
  totalReturns: number;
  totalRefund: number;
  byStatus: CountByKey;
  byReason: CountByKey;
  returns: ReturnRecord[];
}
