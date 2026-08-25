import { z } from 'zod';
import { ReturnRecord } from '../../data/entities';

/** Returns Module Schemas - DTOs and zod validation only. No business logic. */

/** The lifecycle of a return request. */
export const RETURN_STATUSES = [
  'Pending',
  'Approved',
  'Rejected',
  'Refunded',
] as const;

/** What the customer gets back: money or another unit of the product. */
export const RETURN_TYPES = ['refund', 'exchange'] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD');

export const listReturnsQuerySchema = z.object({
  status: z.enum(RETURN_STATUSES).optional(),
});

export const returnIdParamsSchema = z.object({
  id: z.string().regex(/^RET-\d+$/i, 'Return id must look like RET-221'),
});

export const createReturnSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  staffId: z.string().min(1, 'staffId is required'),
  returnDate: isoDate.optional(),
  reason: z.string().optional(),
  refundAmount: z.number().min(0, 'refundAmount must not be negative').optional(),
  status: z.enum(RETURN_STATUSES).optional(),
  returnType: z.enum(RETURN_TYPES).optional(),
  product: z.string().optional(),
  qty: z
    .number()
    .int('qty must be a whole number')
    .min(1, 'qty must be at least 1')
    .optional(),
  requestedBy: z.string().optional(),
});

export const updateReturnSchema = createReturnSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be supplied' },
);

export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type ReturnType = (typeof RETURN_TYPES)[number];
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;
export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnDto = z.infer<typeof updateReturnSchema>;
export type { ReturnRecord };

export interface DeleteReturnResult {
  message: string;
  'return': ReturnRecord;
}
