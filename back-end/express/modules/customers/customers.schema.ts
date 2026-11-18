import { z } from 'zod';
import { Customer } from '../../data/entities';

/** Customers Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

const indianMobile = z
  .string()
  .refine((value) => {
    const digits = value.replace(/\D/g, '');
    const tail = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
    return /^[6-9]\d{9}$/.test(tail);
  }, 'mobileNo must be a 10-digit Indian mobile number');

export const listCustomersQuerySchema = z.object({
  companyId: z.string().optional(),
});

export const customerIdParamsSchema = z.object({
  id: z.string().regex(/^CUS-\d+$/i, 'Customer id must look like CUS-001'),
});

export const customerPhoneParamsSchema = z.object({
  phone: indianMobile,
});

export const createCustomerSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().trim().max(80).optional(),
  mobileNo: indianMobile,
  email: emailSchema.optional(),
  address: z.string().trim().max(250).optional(),
});

export const updateCustomerSchema = z
  .object({
    companyId: z.string().optional(),
    name: z.string().trim().min(2).max(80).optional(),
    mobileNo: indianMobile.optional(),
    email: emailSchema.optional().or(z.literal('')),
    address: z.string().trim().max(250).optional(),
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
export type { Customer };

export interface DeleteCustomerResult {
  message: string;
  customer: Customer;
}
