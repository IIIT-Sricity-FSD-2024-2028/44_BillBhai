import { z } from 'zod';

/**
 * Products Module Schemas / Types
 *
 * Responsibilities:
 * - Data transfer object types for the Express migration layer.
 * - Validation schemas for request params, query strings, and bodies.
 *
 * NOTE: Keep this file free of business logic and persistence concerns.
 */

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
});

export const productIdParamsSchema = z.object({
  id: z.string(),
});

export const productBarcodeParamsSchema = z.object({
  barcode: z.string(),
});

export const createProductSchema = z.object({
  supplierId: z.string(),
  name: z.string(),
  category: z.string(),
  barcode: z.string().optional(),
  price: z.number().min(0),
  size: z.string().optional(),
  description: z.string().optional(),
});

export const updateProductSchema = z.object({
  supplierId: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().min(0).optional(),
  size: z.string().optional(),
  description: z.string().optional(),
});

export interface Product {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  barcode?: string;
  price: number;
  size?: string;
  description?: string;
}

export interface CreateProductDto {
  supplierId: string;
  name: string;
  category: string;
  barcode?: string;
  price: number;
  size?: string;
  description?: string;
}

export interface UpdateProductDto {
  supplierId?: string;
  name?: string;
  category?: string;
  barcode?: string;
  price?: number;
  size?: string;
  description?: string;
}

export interface DeleteProductResult {
  message: string;
  product: Product;
}

