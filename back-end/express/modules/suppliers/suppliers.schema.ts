import { z } from 'zod';
import { Supplier } from '../../data/entities';

/** Suppliers Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

export const supplierIdParamsSchema = z.object({
  id: z.string().regex(/^SUP-\d+$/i, 'Supplier id must look like SUP-001'),
});

export const createSupplierSchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  mobileNo: z.string().regex(/^\d{10}$/, 'mobileNo must be exactly 10 digits'),
  email: emailSchema.optional(),
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
