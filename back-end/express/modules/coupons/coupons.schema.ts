import { z } from 'zod';
import { Coupon } from '../../data/entities';

/** Coupons Module Schemas - DTOs and zod validation only. No business logic. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD');

export const couponIdParamsSchema = z.object({
  id: z.string().regex(/^CPN-\d+$/i, 'Coupon id must look like CPN-001'),
});

export const listCouponsQuerySchema = z.object({
  companyId: z.string().optional(),
});

export const couponAnalyticsQuerySchema = z.object({
  companyId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const couponFields = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'code must be 3-20 letters or digits, no spaces'),
  description: z.string().trim().max(120).optional(),
  type: z.enum(['percent', 'flat']),
  value: z.number().gt(0, 'value must be more than 0').max(100000),
  minOrder: z.number().min(0).max(1000000).default(0),
  maxDiscount: z.number().min(0).max(100000).default(0),
  validFrom: isoDate,
  validTo: isoDate,
  usageLimit: z.number().int().min(0).max(1000000).default(0),
  perCustomerLimit: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

function couponRules<
  T extends { type?: string; value?: number; minOrder?: number; validFrom?: string; validTo?: string },
>(schema: z.ZodType<T>) {
  return schema
    .refine((v) => v.type !== 'percent' || v.value === undefined || v.value <= 90, {
      message: 'A percent coupon can give at most 90% off',
      path: ['value'],
    })
    .refine(
      (v) => v.type !== 'flat' || v.value === undefined || v.minOrder === undefined || v.minOrder >= v.value,
      {
        message: 'Set a minimum bill at least as big as the discount',
        path: ['minOrder'],
      },
    )
    .refine((v) => !v.validFrom || !v.validTo || v.validFrom <= v.validTo, {
      message: 'validTo must be on or after validFrom',
      path: ['validTo'],
    });
}

export const createCouponSchema = couponRules(couponFields.extend({ companyId: z.string().optional() }));

/** Same fields with no defaults, so an edit only changes what it sends. */
const couponUpdateFields = z.object({
  code: couponFields.shape.code.optional(),
  description: couponFields.shape.description,
  type: z.enum(['percent', 'flat']).optional(),
  value: z.number().gt(0, 'value must be more than 0').max(100000).optional(),
  minOrder: z.number().min(0).max(1000000).optional(),
  maxDiscount: z.number().min(0).max(100000).optional(),
  validFrom: isoDate.optional(),
  validTo: isoDate.optional(),
  usageLimit: z.number().int().min(0).max(1000000).optional(),
  perCustomerLimit: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

export const updateCouponSchema = couponRules(
  couponUpdateFields
    .extend({ version: z.number().int().optional() })
    .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
      message: 'At least one field must be supplied',
    }),
);

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
  subtotal: z.number().min(0, 'subtotal must not be negative'),
  customerId: z.string().optional(),
  customerPhone: z.string().optional(),
  companyId: z.string().optional(),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
export type ValidateCouponDto = z.infer<typeof validateCouponSchema>;
export type { Coupon };

export interface CouponCheck {
  valid: true;
  couponId: string;
  code: string;
  description?: string;
  discount: number;
  subtotal: number;
  total: number;
}
