import { z } from 'zod';
import { Product } from '../../data/entities';

/** Products Module Schemas - DTOs and zod validation only. No business logic. */

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
  companyId: z.string().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const productIdParamsSchema = z.object({
  id: z.string().regex(/^P\d+$/i, 'Product id must look like P001'),
});

export const productBarcodeParamsSchema = z.object({
  barcode: z.string().trim().min(3, 'barcode is too short'),
});

const money = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .finite()
    .refine((v) => Math.round(v * 100) === v * 100, `${label} can have at most 2 decimals`);

const productFields = {
  supplierId: z.string().regex(/^SUP-\d+$/i, 'Pick a supplier'),
  name: z.string().trim().min(2, 'name must be at least 2 characters').max(80),
  category: z.string().trim().min(2, 'category must be at least 2 characters').max(40),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{3,20}$/, 'barcode may only contain letters, digits or hyphens (3-20)')
    .optional()
    .or(z.literal('')),
  price: money('price').gt(0, 'price must be more than 0').max(1000000, 'price is too high'),
  costPrice: money('costPrice').min(0).max(1000000).optional(),
  gstRate: z
    .number()
    .refine((v) => (GST_RATES as readonly number[]).includes(v), 'gstRate must be 0, 5, 12, 18 or 28')
    .optional(),
  size: z.string().trim().max(40).optional(),
  description: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().max(500).optional(),
};

export const createProductSchema = z
  .object({
    companyId: z.string().optional(),
    ...productFields,
    openingStock: z.number().int('openingStock must be a whole number').min(0).max(1000000).default(0),
    reorderLevel: z.number().int('reorderLevel must be a whole number').min(0).max(100000).default(10),
    location: z.string().trim().min(1).max(60).default('Shelf'),
  })
  .refine((v) => v.costPrice === undefined || v.costPrice <= v.price, {
    message: 'costPrice cannot be more than the selling price',
    path: ['costPrice'],
  });

export const updateProductSchema = z
  .object({
    supplierId: productFields.supplierId.optional(),
    name: productFields.name.optional(),
    category: productFields.category.optional(),
    barcode: productFields.barcode,
    price: productFields.price.optional(),
    costPrice: productFields.costPrice,
    gstRate: productFields.gstRate,
    size: productFields.size,
    description: productFields.description,
    imageUrl: productFields.imageUrl,
    active: z.boolean().optional(),
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export type CreateProductDto = z.input<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type { Product };

export interface DeleteProductResult {
  message: string;
  product: Product;
}
