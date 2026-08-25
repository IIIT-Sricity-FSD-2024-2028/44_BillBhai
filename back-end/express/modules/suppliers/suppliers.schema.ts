import { z } from 'zod';
import { Supplier } from '../../data/entities';

/** Suppliers Module Schemas - DTOs and zod validation only. No business logic. */

export const supplierIdParamsSchema = z.object({
  id: z.string().regex(/^SUP-\d+$/i, 'Supplier id must look like SUP-001'),
});

export const createSupplierSchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  mobileNo: z.string().regex(/^\d{10}$/, 'mobileNo must be exactly 10 digits'),
  email: z.email('email must be a valid address').optional(),
  address: z.string().optional(),
  gstNo: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be supplied' },
);

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
export type { Supplier };

export interface DeleteSupplierResult {
  message: string;
  supplier: Supplier;
}
