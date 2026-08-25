import { z } from 'zod';
import { InventoryItem } from '../../data/entities';

/** Inventory Module Schemas - DTOs and zod validation only. No business logic. */

/**
 * The four stock states. NOTE: status is DERIVED from stockAvailable and
 * reorderLevel by the service, so it is deliberately absent from every write
 * schema below - a client may never set it.
 */
export const INVENTORY_STATUSES = [
  'In Stock',
  'Low Stock',
  'Critical',
  'Out of Stock',
] as const;

/** The subset of statuses that findLowStock() reports on. */
export const LOW_STOCK_STATUSES = [
  'Low Stock',
  'Critical',
  'Out of Stock',
] as const;

export const inventoryIdParamsSchema = z.object({
  id: z.string().regex(/^INV-\d+$/i, 'Inventory id must look like INV-001'),
});

export const productIdParamsSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
});

export const updateInventorySchema = z
  .object({
    stockAvailable: z
      .number()
      .int('stockAvailable must be a whole number')
      .min(0, 'stockAvailable must not be negative')
      .optional(),
    reorderLevel: z
      .number()
      .int('reorderLevel must be a whole number')
      .min(0, 'reorderLevel must not be negative')
      .optional(),
    location: z.string().min(1, 'location must not be empty').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be supplied',
  });

export const adjustStockSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  adjustment: z
    .number()
    .int('adjustment must be a whole number')
    .refine((value) => value !== 0, {
      message: 'adjustment must not be zero',
    }),
});

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
export type { InventoryItem };

export interface DeleteInventoryResult {
  message: string;
  inventory: InventoryItem;
}
