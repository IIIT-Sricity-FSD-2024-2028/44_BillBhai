import { z } from 'zod';
import { Delivery } from '../../data/entities';

/** Deliveries Module Schemas - DTOs and zod validation only. No business logic. */

/**
 * The delivery status flow, in the order a parcel travels through it.
 *
 *   Pending (waiting for a partner) → Assigned → Dispatched → Out for Delivery → Delivered
 *   Dispatched / Out for Delivery   → Failed Attempt → Assigned (retry, up to 3 tries)
 *                                                    → Returned to Store (stock goes back)
 *   Pending / Assigned              → Cancelled (order cancelled, stock goes back)
 *
 * Delivered, Returned to Store and Cancelled are final.
 */
export const DELIVERY_STATUSES = [
  'Pending',
  'Assigned',
  'Dispatched',
  'Out for Delivery',
  'Delivered',
  'Failed Attempt',
  'Returned to Store',
  'Cancelled',
] as const;

export const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  Pending: ['Assigned', 'Cancelled'],
  Assigned: ['Dispatched', 'Pending', 'Cancelled'],
  Dispatched: ['Out for Delivery', 'Delivered', 'Failed Attempt'],
  'Out for Delivery': ['Delivered', 'Failed Attempt'],
  'Failed Attempt': ['Assigned', 'Returned to Store'],
  Delivered: [],
  'Returned to Store': [],
  Cancelled: [],
};

export const MAX_DELIVERY_ATTEMPTS = 3;

const phone = z.string().trim().max(20);

export const listDeliveriesQuerySchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
  companyId: z.string().optional(),
});

export const deliveryIdParamsSchema = z.object({
  id: z.string().regex(/^DEL-\d+$/i, 'Delivery id must look like DEL-901'),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/i, 'Order id must look like ORD-4829'),
});

export const createDeliverySchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/i, 'orderId must look like ORD-4829'),
  address: z.string().trim().max(250).optional(),
  customerPhone: phone.optional(),
  partnerName: z.string().trim().max(60).optional(),
  partnerPhone: phone.optional(),
  partnerAgency: z.string().trim().max(60).optional(),
  partnerVehicle: z.string().trim().max(40).optional(),
  etaMinutes: z.number().int().min(5).max(24 * 60).optional(),
});

/** Details ops can correct without moving the parcel along. */
export const updateDeliverySchema = z
  .object({
    address: z.string().trim().min(8, 'address is too short').max(250).optional(),
    customerPhone: phone.optional(),
    partnerName: z.string().trim().max(60).optional(),
    partnerPhone: phone.optional(),
    partnerAgency: z.string().trim().max(60).optional(),
    partnerVehicle: z.string().trim().max(40).optional(),
    etaMinutes: z.number().int().min(5).max(24 * 60).optional(),
    /** Accepted for older clients; routed through the same rules as /status. */
    status: z.enum(DELIVERY_STATUSES).optional(),
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export const transitionDeliverySchema = z.object({
  status: z.enum(DELIVERY_STATUSES),
  note: z.string().trim().max(200).optional(),
  partnerName: z.string().trim().max(60).optional(),
  partnerPhone: phone.optional(),
  partnerAgency: z.string().trim().max(60).optional(),
  partnerVehicle: z.string().trim().max(40).optional(),
  etaMinutes: z.number().int().min(5).max(24 * 60).optional(),
  receiverName: z.string().trim().max(60).optional(),
  cashCollected: z.number().min(0).max(10000000).optional(),
  failureReason: z.string().trim().max(200).optional(),
  version: z.number().int().optional(),
});

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
export type CreateDeliveryDto = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryDto = z.infer<typeof updateDeliverySchema>;
export type TransitionDeliveryDto = z.infer<typeof transitionDeliverySchema>;
export type { Delivery };

export interface DeleteDeliveryResult {
  message: string;
  delivery: Delivery;
}
