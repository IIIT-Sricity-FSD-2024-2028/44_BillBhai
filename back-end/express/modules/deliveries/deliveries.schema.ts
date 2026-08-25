import { z } from 'zod';
import { Delivery } from '../../data/entities';

/** Deliveries Module Schemas - DTOs and zod validation only. No business logic. */

/** The delivery status flow, in the order a shipment travels through it. */
export const DELIVERY_STATUSES = [
  'Pending',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD');

export const listDeliveriesQuerySchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
});

export const deliveryIdParamsSchema = z.object({
  id: z.string().regex(/^DEL-\d+$/i, 'Delivery id must look like DEL-901'),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/i, 'Order id must look like ORD-4829'),
});

export const createDeliverySchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  customerName: z.string().optional(),
  address: z.string().optional(),
  partnerName: z.string().optional(),
  dispatchDate: isoDate.optional(),
  deliveryDate: isoDate.nullable().optional(),
  status: z.enum(DELIVERY_STATUSES).optional(),
});

export const updateDeliverySchema = z
  .object({
    orderId: z.string().min(1, 'orderId must not be empty').optional(),
    customerName: z.string().optional(),
    address: z.string().optional(),
    partnerName: z.string().optional(),
    dispatchDate: isoDate.optional(),
    deliveryDate: isoDate.nullable().optional(),
    status: z.enum(DELIVERY_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
export type CreateDeliveryDto = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryDto = z.infer<typeof updateDeliverySchema>;
export type { Delivery };

export interface DeleteDeliveryResult {
  message: string;
  delivery: Delivery;
}
