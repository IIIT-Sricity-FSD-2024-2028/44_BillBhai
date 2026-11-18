import { z } from 'zod';
import { InventoryItem } from '../../data/entities';

/** Inventory Module Schemas - DTOs and zod validation only. No business logic. */

export const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'] as const;

/** Statuses the low-stock report and the reorder list pick up. */
export const LOW_STOCK_STATUSES = ['Low Stock', 'Critical', 'Out of Stock'] as const;

export const MOVEMENT_TYPES = ['opening', 'sale', 'return', 'cancel', 'receive', 'adjust', 'exchange'] as const;

const wholeNumber = (label: string) => z.number().int(`${label} must be a whole number`);

export const inventoryIdParamsSchema = z.object({
  id: z.string().regex(/^INV-\d+$/i, 'Inventory id must look like INV-001'),
});

export const productIdParamsSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
});

export const listInventoryQuerySchema = z.object({
  companyId: z.string().optional(),
});

export const listMovementsQuerySchema = z.object({
  companyId: z.string().optional(),
  productId: z.string().optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

/**
 * Shelf settings only. `stockAvailable` is deliberately not accepted: stock
 * changes go through POST /inventory/adjust or /inventory/receive so every
 * change has a reason and a ledger entry.
 */
export const updateInventorySchema = z
  .object({
    reorderLevel: wholeNumber('reorderLevel').min(0, 'reorderLevel must not be negative').max(100000).optional(),
    location: z.string().trim().min(1, 'location must not be empty').max(60).optional(),
    version: z.number().int().optional(),
    stockAvailable: z.unknown().optional(),
  })
  .refine((value) => value.stockAvailable === undefined, {
    message: 'Stock count cannot be set directly. Use Adjust stock or Receive stock.',
    path: ['stockAvailable'],
  })
  .transform(({ stockAvailable: _ignored, ...rest }) => rest)
  .refine((value) => value.reorderLevel !== undefined || value.location !== undefined, {
    message: 'At least one field must be supplied',
  });

export const createInventorySchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  stockAvailable: wholeNumber('stockAvailable').min(0, 'stockAvailable must not be negative').max(1000000).default(0),
  reorderLevel: wholeNumber('reorderLevel').min(0, 'reorderLevel must not be negative').default(10),
  location: z.string().trim().min(1, 'location must not be empty').default('Shelf'),
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  adjustment: wholeNumber('adjustment')
    .min(-100000)
    .max(100000)
    .refine((value) => value !== 0, { message: 'adjustment must not be zero' }),
  reason: z.string().trim().min(3, 'Say why the stock is changing (at least 3 characters)').max(200),
});

export const receiveStockSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: wholeNumber('quantity').min(1, 'quantity must be at least 1').max(100000),
  supplierId: z.string().optional(),
  note: z.string().max(200).optional(),
});

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export type CreateInventoryDto = z.infer<typeof createInventorySchema>;
export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
export type ReceiveStockDto = z.infer<typeof receiveStockSchema>;
export type { InventoryItem };

export interface DeleteInventoryResult {
  message: string;
  inventory: InventoryItem;
}
