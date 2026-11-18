import { z } from 'zod';
import { Supplier } from '../../data/entities';

/** Suppliers Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

/** 15-character GSTIN: 2-digit state, PAN, entity, Z, checksum. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const supplierIdParamsSchema = z.object({
  id: z.string().regex(/^SUP-\d+$/i, 'Supplier id must look like SUP-001'),
});

export const listSuppliersQuerySchema = z.object({
  companyId: z.string().optional(),
});

const baseSupplier = {
  name: z.string().trim().min(2, 'name must be at least 2 characters').max(80),
  contactPerson: z.string().trim().max(60).optional(),
  mobileNo: z
    .string()
    .transform((v) => v.replace(/\D/g, '').slice(-10))
    .refine((v) => /^[6-9]\d{9}$/.test(v), 'mobileNo must be a 10-digit Indian mobile number'),
  email: emailSchema.optional().or(z.literal('')),
  address: z.string().trim().max(200).optional(),
  gstNo: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || GSTIN_PATTERN.test(v), 'gstNo must be a valid 15-character GSTIN')
    .optional(),
  leadTimeDays: z.number().int('leadTimeDays must be a whole number').min(0).max(90).optional(),
  moq: z.number().int('moq must be a whole number').min(0).max(100000).optional(),
};

export const createSupplierSchema = z.object({
  companyId: z.string().optional(),
  ...baseSupplier,
});

export const updateSupplierSchema = z
  .object({
    name: baseSupplier.name.optional(),
    contactPerson: baseSupplier.contactPerson,
    mobileNo: baseSupplier.mobileNo.optional(),
    email: baseSupplier.email,
    address: baseSupplier.address,
    gstNo: baseSupplier.gstNo,
    leadTimeDays: baseSupplier.leadTimeDays,
    moq: baseSupplier.moq,
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
export type { Supplier };

export interface DeleteSupplierResult {
  message: string;
  supplier: Supplier;
}
