import { z } from 'zod';

/** Payments Module Schemas — DTOs and Zod validation for Razorpay */

export const SUBSCRIPTION_PLANS = ['starter', 'pro', 'enterprise'] as const;
export const BILLING_CYCLES = ['monthly', 'yearly'] as const;

export const PLAN_PRICING: Record<string, { name: string; monthly: number; yearly: number }> = {
  starter: { name: 'Starter Plan (Free)', monthly: 0, yearly: 0 },
  pro: { name: 'Growth / Pro Plan', monthly: 1999, yearly: 19990 },
  enterprise: { name: 'Enterprise Plan', monthly: 4999, yearly: 49990 },
};

export const createRazorpayOrderSchema = z.object({
  amount: z.number().min(1, 'amount must be greater than zero'),
  currency: z.string().default('INR'),
  billNo: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
  billNo: z.string().optional(),
});

export const createSubscriptionOrderSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  plan: z.enum(SUBSCRIPTION_PLANS),
  billingCycle: z.enum(BILLING_CYCLES).default('monthly'),
});

export const verifySubscriptionPaymentSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  plan: z.enum(SUBSCRIPTION_PLANS),
  billingCycle: z.enum(BILLING_CYCLES).default('monthly'),
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
});

export const razorpayWebhookSchema = z.object({
  event: z.string().min(1, 'event is required'),
  payload: z.record(z.string(), z.unknown()),
});

export type CreateRazorpayOrderDto = z.infer<typeof createRazorpayOrderSchema>;
export type VerifyRazorpayPaymentDto = z.infer<typeof verifyRazorpayPaymentSchema>;
export type CreateSubscriptionOrderDto = z.infer<typeof createSubscriptionOrderSchema>;
export type VerifySubscriptionPaymentDto = z.infer<typeof verifySubscriptionPaymentSchema>;
export type RazorpayWebhookDto = z.infer<typeof razorpayWebhookSchema>;

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
  keyId: string;
  plan?: string;
  companyId?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  paymentId: string;
  orderId: string;
  billNo?: string;
  companyId?: string;
  plan?: string;
  status?: string;
}
