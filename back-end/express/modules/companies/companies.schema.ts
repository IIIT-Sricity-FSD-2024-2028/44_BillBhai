import { z } from 'zod';
import { Company } from '../../data/entities';

/** Companies Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

export const companyIdParamsSchema = z.object({
  id: z.string().regex(/^BIZ-\d+$/i, 'Company id must look like BIZ-101'),
});

export const createCompanySchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  email: emailSchema,
  phone: z
    .string()
    .refine(
      (value) => value.replace(/\D/g, '').length >= 10,
      'phone must contain at least 10 digits',
    ),
  owner: z.string().optional(),
  adminName: z.string().optional(),
  type: z.string().optional(),
  gstNo: z.string().optional(),
  address: z.string().optional(),
  productsPlan: z.string().optional(),
  status: z.string().optional(),
  storesCount: z.number().int().min(0).optional(),
  tenureMonths: z.number().int().min(0).optional(),
});

export const updateCompanySchema = createCompanySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be supplied' },
);

export type CreateCompanyDto = z.infer<typeof createCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;
export type { Company };

export interface DeleteCompanyResult {
  message: string;
  company: Company;
}
