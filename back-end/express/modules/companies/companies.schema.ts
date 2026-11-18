import { z } from 'zod';
import { Company } from '../../data/entities';

/** Companies Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

/** 15-character GSTIN: 2-digit state, PAN, entity, Z, checksum. */
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const gstNo = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === '' || GSTIN_PATTERN.test(v), 'gstNo must be a valid 15-character GSTIN (e.g. 07AABCF1234K1Z5)');

const phone = z
  .string()
  .refine((value) => value.replace(/\D/g, '').length >= 10, 'phone must contain at least 10 digits');

export const PLAN_KEYS = ['starter', 'pro', 'enterprise'] as const;
export const COMPANY_STATUSES = ['Active', 'Paused', 'Suspended'] as const;

export const companyIdParamsSchema = z.object({
  id: z.string().regex(/^BIZ-\d+$/i, 'Company id must look like BIZ-101'),
});

const companyFields = {
  name: z.string().trim().min(2, 'name must be at least 2 characters').max(80),
  email: emailSchema,
  phone,
  owner: z.string().trim().max(80).optional(),
  adminName: z.string().trim().max(80).optional(),
  type: z.string().trim().max(60).optional(),
  gstNo: gstNo.optional(),
  address: z.string().trim().max(250).optional(),
  productsPlan: z.string().optional(),
  plan: z.enum(PLAN_KEYS).optional(),
  status: z.enum(COMPANY_STATUSES).optional(),
  storesCount: z.number().int().min(0).max(10000).optional(),
  tenureMonths: z.number().int().min(0).max(1200).optional(),
};

export const createCompanySchema = z.object(companyFields);

/** Fields only the platform super user may change. */
export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({
    subscriptionStatus: z.enum(['Active', 'Cancelled', 'Past Due']).optional(),
    monthlyPrice: z.number().min(0).max(1000000).optional(),
    renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    profit: z.number().min(-1e12).max(1e12).optional(),
    paymentDue: z.number().min(0).max(1e12).optional(),
    stores: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
    payments: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
    notes: z.string().max(1000).optional(),
    version: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export const changePlanSchema = z.object({
  plan: z.enum(PLAN_KEYS),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/**
 * Self-service sign-up: the business and its first admin are created
 * together, so an owner can never end up with a business and no login.
 */
export const registerCompanySchema = z.object({
  company: createCompanySchema,
  plan: z.enum(PLAN_KEYS).default('starter'),
  admin: z.object({
    name: z.string().trim().min(2, 'Your name must be at least 2 characters').max(80),
    email: emailSchema,
    mobileNo: z
      .string()
      .transform((v) => v.replace(/\D/g, '').slice(-10))
      .refine((v) => /^[6-9]\d{9}$/.test(v), 'mobileNo must be a 10-digit Indian mobile number'),
    username: z
      .string()
      .trim()
      .min(3, 'username must be at least 3 characters')
      .max(40)
      .regex(/^[a-zA-Z0-9._-]+$/, 'username may only contain letters, digits, dot, underscore or hyphen'),
    password: z
      .string()
      .min(8, 'password must be at least 8 characters')
      .regex(/[A-Za-z]/, 'password must contain a letter')
      .regex(/\d/, 'password must contain a digit'),
  }),
});

export type CreateCompanyDto = z.infer<typeof createCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;
export type RegisterCompanyDto = z.infer<typeof registerCompanySchema>;
export type { Company };

export interface DeleteCompanyResult {
  message: string;
  company: Company;
}
