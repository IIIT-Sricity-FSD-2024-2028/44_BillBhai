import { z } from 'zod';
import { InventoryItem, ReturnRecord } from '../../data/entities';
import { OrderSnapshot } from '../orders/orders.schema';

/** Reports Module Schemas. */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'date is not a real calendar date');

export const reportQuerySchema = z
  .object({
    companyId: z.string().optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be on or before to', path: ['to'] });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export type CountByKey = Record<string, number>;

export interface DayRow {
  day: string;
  orders: number;
  gross: number;
  refunds: number;
  net: number;
  discount: number;
}

/**
 * One definition of money, used by the dashboard and the Reports page:
 *   grossSales  = bill totals of orders that were not cancelled
 *   refunds     = money paid back on returns of those orders
 *   netSales    = grossSales - refunds
 *   collected   = payments actually received (COD counts once collected)
 *   codPending  = COD bills still out with the delivery partner
 */
export interface SalesReport {
  from: string | null;
  to: string | null;
  totalOrders: number;
  cancelledOrders: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  collected: number;
  codPending: number;
  totalDiscount: number;
  taxCollected: number;
  avgBill: number;
  itemsSold: number;
  /** Kept for older callers: equals netSales. */
  totalRevenue: number;
  byStatus: CountByKey;
  byPaymentMethod: CountByKey;
  byOrderType: CountByKey;
  byDay: DayRow[];
  byHour: Array<{ hour: number; orders: number; net: number }>;
  byCashier: Array<{ staff: string; orders: number; net: number }>;
  byCategory: Array<{ category: string; quantity: number; sales: number }>;
  topProducts: Array<{ productId: string; productName: string; quantity: number; sales: number }>;
  orders: OrderSnapshot[];
}

export interface InventoryReport {
  totalItems: number;
  byStatus: CountByKey;
  lowStockCount: number;
  lowStockItems: InventoryItem[];
  stockValueAtCost: number;
  stockValueAtPrice: number;
  movementsByType: CountByKey;
  inventory: InventoryItem[];
}

export interface ReturnsReport {
  totalReturns: number;
  totalRefund: number;
  byStatus: CountByKey;
  byReason: CountByKey;
  topProducts: Array<{ productName: string; qty: number }>;
  returns: ReturnRecord[];
}
