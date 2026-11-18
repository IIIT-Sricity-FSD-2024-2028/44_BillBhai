import { z } from 'zod';
import { ReturnRecord } from '../../data/entities';

/** Returns Module Schemas - DTOs and zod validation only. No business logic. */

/**
 * The lifecycle of a return request.
 *   Pending → Approved → Refunded | Exchanged
 *   Pending | Approved → Rejected
 * Refunded, Exchanged and Rejected are final.
 */
export const RETURN_STATUSES = ['Pending', 'Approved', 'Rejected', 'Refunded', 'Exchanged'] as const;

export const RETURN_TRANSITIONS: Record<string, string[]> = {
  Pending: ['Approved', 'Rejected', 'Refunded', 'Exchanged'],
  Approved: ['Refunded', 'Exchanged', 'Rejected'],
  Rejected: [],
  Refunded: [],
  Exchanged: [],
};

/** What the customer gets back: money or another unit of the product. */
export const RETURN_TYPES = ['refund', 'exchange'] as const;

export const REFUND_METHODS = ['Cash', 'UPI', 'Card', 'Original payment', 'Store credit'] as const;

/** Days after the sale during which a return is accepted. */
export const RETURN_WINDOW_DAYS = 30;

export const listReturnsQuerySchema = z.object({
  status: z.enum(RETURN_STATUSES).optional(),
  companyId: z.string().optional(),
});

export const returnIdParamsSchema = z.object({
  id: z.string().regex(/^RET-\d+$/i, 'Return id must look like RET-221'),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/i, 'Order id must look like ORD-4829'),
});

const returnLine = z.object({
  productId: z.string().min(1, 'productId is required'),
  qty: z.number().int('qty must be a whole number').min(1, 'qty must be at least 1').max(1000),
});

export const createReturnSchema = z
  .object({
    orderId: z.string().trim().toUpperCase().regex(/^ORD-\d+$/, 'orderId must look like ORD-4829'),
    items: z.array(returnLine).min(1).max(50).optional(),
    /** Single-line form, still accepted: a product id and a quantity. */
    product: z.string().optional(),
    qty: z.number().int().min(1).max(1000).optional(),
    reason: z.string().trim().min(3, 'Give a reason for the return').max(120),
    returnType: z.enum(RETURN_TYPES).default('refund'),
    note: z.string().trim().max(300).optional(),
    requestedBy: z.string().trim().max(80).optional(),
    companyId: z.string().optional(),
  })
  .refine((v) => (v.items && v.items.length) || v.product, {
    message: 'Pick at least one item from the order',
    path: ['items'],
  });

/** While a return is Pending, its reason and note can still be corrected. */
export const updateReturnSchema = z
  .object({
    reason: z.string().trim().min(3).max(120).optional(),
    note: z.string().trim().max(300).optional(),
    status: z.enum(RETURN_STATUSES).optional(),
    refundMethod: z.enum(REFUND_METHODS).optional(),
    restock: z.boolean().optional(),
    rejectReason: z.string().trim().max(200).optional(),
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export const transitionReturnSchema = z.object({
  status: z.enum(RETURN_STATUSES),
  refundMethod: z.enum(REFUND_METHODS).optional(),
  /** Put the returned units back on the shelf (false = damaged, written off). */
  restock: z.boolean().optional(),
  rejectReason: z.string().trim().max(200).optional(),
  note: z.string().trim().max(300).optional(),
  version: z.number().int().optional(),
});

export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type ReturnType = (typeof RETURN_TYPES)[number];
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;
export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnDto = z.infer<typeof updateReturnSchema>;
export type TransitionReturnDto = z.infer<typeof transitionReturnSchema>;
export type { ReturnRecord };

export interface DeleteReturnResult {
  message: string;
  'return': ReturnRecord;
}

export interface ReturnableLine {
  productId: string;
  productName: string;
  sold: number;
  returned: number;
  returnable: number;
  unitPrice: number;
  itemPrice: number;
}

export interface ReturnableOrder {
  orderId: string;
  companyId: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  status: string;
  paymentMethod: string;
  paymentStatus?: string;
  total: number;
  refundedAmount: number;
  eligible: boolean;
  reason?: string;
  lines: ReturnableLine[];
}
