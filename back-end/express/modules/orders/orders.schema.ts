import { z } from 'zod';
import { Bill, Order, OrderItem, Payment } from '../../data/entities';

/** Orders Module Schemas - DTOs and zod validation only. No business logic. */

export const ORDER_TYPES = ['pickup', 'delivery'] as const;

export const CHECKOUT_MODES = [
  'takeaway_now',
  'prepaid_delivery',
  'cod_delivery',
] as const;

export const ORDER_STATUSES = [
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

export const listOrdersQuerySchema = z.object({
  companyId: z.string().optional(),
  status: z.string().optional(),
});

export const orderIdParamsSchema = z.object({
  id: z.string().regex(/^ORD-\d+$/i, 'Order id must look like ORD-4829'),
});

export const billNoParamsSchema = z.object({
  billNo: z.string().regex(/^BILL-\d+$/i, 'Bill number must look like BILL-001'),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int('quantity must be a whole number').min(1, 'quantity must be at least 1'),
  itemPrice: z.number().min(0, 'itemPrice must not be negative'),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  staffId: z.string().min(1, 'staffId is required'),
  companyId: z.string().min(1, 'companyId is required'),
  orderType: z.enum(ORDER_TYPES),
  checkoutMode: z.enum(CHECKOUT_MODES),
  discountAmount: z.number().min(0, 'discountAmount must not be negative').optional(),
  promoCode: z.string().optional(),
  paymentMethod: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'items must contain at least one entry'),
});

export const updateOrderSchema = z
  .object({
    customerName: z.string().optional(),
    customerAddress: z.string().optional(),
    itemsCount: z.number().min(0, 'itemsCount must not be negative').optional(),
    total: z.number().min(0, 'total must not be negative').optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    paymentMethod: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export const createBillSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  taxAmount: z.number().min(0, 'taxAmount must not be negative').optional(),
  discountAmount: z.number().min(0, 'discountAmount must not be negative').optional(),
});

export const createPaymentSchema = z.object({
  billNo: z.string().min(1, 'billNo is required'),
  paymentMethod: z.string().min(1, 'paymentMethod is required'),
  amountPaid: z.number().min(0, 'amountPaid must not be negative'),
});

export const validatePromotionSchema = z.object({
  code: z.string().min(1, 'code is required'),
  subtotal: z.number().min(0, 'subtotal must not be negative'),
});

export type OrderItemDto = z.infer<typeof orderItemSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type CreateBillDto = z.infer<typeof createBillSchema>;
export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type ValidatePromotionDto = z.infer<typeof validatePromotionSchema>;
export type { Bill, Order, OrderItem, Payment };

/** An order plus the items that belong to it - the shape every read returns. */
export interface OrderSnapshot extends Order {
  items: OrderItem[];
  itemsCount: number;
}

export interface PromotionResult {
  valid: boolean;
  code: string;
  discount: number;
  subtotal: number;
  total: number;
}

export interface DeleteOrderResult {
  message: string;
  order: Order;
}
