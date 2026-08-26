import { z } from 'zod';
import { Customer } from '../../data/entities';

/** Customers Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

export const listCustomersQuerySchema = z.object({
  companyId: z.string().optional(),
});

export const customerIdParamsSchema = z.object({
  id: z.string().regex(/^CUS-\d+$/i, 'Customer id must look like CUS-001'),
});

/**
 * The phone lookup accepts whatever the till or the storefront sends
 * ('+91-98100 01001', '098100-01001', ...). The service normalises it, so the
 * only rule enforced here is that at least 10 digits are present.
 */
export const customerPhoneParamsSchema = z.object({
  phone: z
    .string()
    .refine(
      (value) => value.replace(/\D/g, '').length >= 10,
      'phone must contain at least 10 digits',
    ),
});

export const createCustomerSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  name: z.string().optional(),
  mobileNo: z
    .string()
    .refine(
      (value) => value.replace(/\D/g, '').length >= 10,
      'mobileNo must contain at least 10 digits',
    ),
  email: emailSchema.optional(),
  address: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be supplied' },
);

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
export type { Customer };

export interface DeleteCustomerResult {
  message: string;
  customer: Customer;
}
