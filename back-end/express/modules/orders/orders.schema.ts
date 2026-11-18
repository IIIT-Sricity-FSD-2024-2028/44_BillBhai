import { z } from 'zod';
import { Bill, Order, OrderItem, Payment } from '../../data/entities';

/** Orders Module Schemas - DTOs and zod validation only. No business logic. */

export const ORDER_TYPES = ['pickup', 'delivery'] as const;

export const CHECKOUT_MODES = ['takeaway_now', 'prepaid_delivery', 'cod_delivery'] as const;

export const ORDER_STATUSES = [
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Partially Returned',
  'Returned',
] as const;

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'COD'] as const;

export const listOrdersQuerySchema = z.object({
  companyId: z.string().optional(),
  status: z.string().optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
});

export const orderIdParamsSchema = z.object({
  id: z.string().regex(/^ORD-\d+$/i, 'Order id must look like ORD-4829'),
});

export const billNoParamsSchema = z.object({
  billNo: z.string().regex(/^BILL-\d+$/i, 'Bill number must look like BILL-0001'),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z
    .number()
    .int('quantity must be a whole number')
    .min(1, 'quantity must be at least 1')
    .max(1000, 'quantity cannot be more than 1000 per line'),
  /**
   * Optional. When sent, it must match the price on file; a mismatch means the
   * screen is showing an old price and the sale is refused with 409.
   */
  itemPrice: z.number().min(0).optional(),
});

const phoneLike = z.string().trim().max(20).optional();

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().max(80).optional(),
  phone: phoneLike,
  email: z.string().trim().max(120).optional(),
  address: z.string().trim().max(250).optional(),
});

const deliverySchema = z.object({
  address: z.string().trim().max(250).optional(),
  partnerName: z.string().trim().max(60).optional(),
  partnerPhone: phoneLike,
  partnerAgency: z.string().trim().max(60).optional(),
  partnerVehicle: z.string().trim().max(40).optional(),
  etaMinutes: z.number().int().min(5).max(24 * 60).optional(),
});

export const createOrderSchema = z.object({
  companyId: z.string().optional(),
  customerId: z.string().optional(),
  customer: customerSchema.optional(),
  /** Older field names, still accepted. */
  customerName: z.string().trim().max(80).optional(),
  customerPhone: phoneLike,
  customerAddress: z.string().trim().max(250).optional(),
  staffId: z.string().optional(),
  orderType: z.enum(ORDER_TYPES).optional(),
  checkoutMode: z.enum(CHECKOUT_MODES),
  paymentMethod: z.string().trim().optional(),
  promoCode: z.string().trim().max(20).optional(),
  deliveryCharge: z.number().min(0).max(500, 'delivery charge cannot be more than ₹500').optional(),
  delivery: deliverySchema.optional(),
  amountTendered: z.number().min(0).max(10000000).optional(),
  notes: z.string().trim().max(300).optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'items must contain at least one entry')
    .max(100, 'a bill can have at most 100 lines'),
});

export const quoteOrderSchema = createOrderSchema.partial({ checkoutMode: true });

/**
 * What can change on a saved order. Money and lines cannot: a bill that was
 * paid stays as it was paid. Status changes go through their own rules.
 */
export const updateOrderSchema = z
  .object({
    customerName: z.string().trim().min(2).max(80).optional(),
    customerPhone: phoneLike,
    customerAddress: z.string().trim().max(250).optional(),
    notes: z.string().trim().max(300).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    cancelReason: z.string().trim().max(200).optional(),
    version: z.number().int().optional(),
    total: z.unknown().optional(),
    itemsCount: z.unknown().optional(),
    paymentMethod: z.unknown().optional(),
    discountAmount: z.unknown().optional(),
  })
  .refine((v) => v.total === undefined && v.itemsCount === undefined && v.discountAmount === undefined, {
    message: 'The items and total of a saved bill cannot be changed. Cancel it and bill again, or raise a return.',
  })
  .refine((v) => v.paymentMethod === undefined, {
    message: 'The payment method of a saved bill cannot be changed.',
  })
  .transform(({ total: _t, itemsCount: _i, paymentMethod: _p, discountAmount: _d, ...rest }) => rest)
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Say why the order is being cancelled').max(200),
  version: z.number().int().optional(),
});

export const validatePromotionSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
  subtotal: z.number().min(0, 'subtotal must not be negative'),
  customerId: z.string().optional(),
  customerPhone: z.string().optional(),
  companyId: z.string().optional(),
});

export type OrderItemDto = z.infer<typeof orderItemSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type QuoteOrderDto = z.infer<typeof quoteOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;
export type ValidatePromotionDto = z.infer<typeof validatePromotionSchema>;
export type { Bill, Order, OrderItem, Payment };

/** An order plus the items, bill and payments that belong to it. */
export interface OrderSnapshot extends Order {
  items: OrderItem[];
  itemsCount: number;
  bill?: Bill;
  payments?: Payment[];
}

export interface PromotionResult {
  valid: boolean;
  code: string;
  discount: number;
  subtotal: number;
  total: number;
  description?: string;
}

export interface DeleteOrderResult {
  message: string;
  order: Order;
}

export interface PricedLine {
  productId: string;
  productName: string;
  quantity: number;
  itemPrice: number;
  gstRate: number;
  lineTotal: number;
  stockAvailable: number;
}

export interface OrderQuote {
  companyId: string;
  lines: PricedLine[];
  subtotal: number;
  discountAmount: number;
  promoCode: string | null;
  couponDescription?: string;
  deliveryCharge: number;
  taxAmount: number;
  total: number;
}
