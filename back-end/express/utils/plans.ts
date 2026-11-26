import { Company } from '../data/entities';
import { ForbiddenError } from '../errors/http-error';

/**
 * Subscription plans. Mirrors PLAN_DEFINITIONS in the front-end
 * (front-end/src/lib/dashboard/constants.js); the server is what enforces them.
 */
export const PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter Plan (Free)',
    price: 0,
    limits: { maxUsers: 2, maxProducts: 300, maxStores: 1, maxInvoices: 500 },
    features: { delivery: false, returns: false, discounts: false },
  },
  pro: {
    key: 'pro',
    name: 'Growth / Pro Plan',
    price: 1999,
    limits: { maxUsers: 10, maxProducts: 5000, maxStores: 3, maxInvoices: Infinity },
    features: { delivery: true, returns: true, discounts: true },
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise Plan',
    price: 4999,
    limits: { maxUsers: Infinity, maxProducts: Infinity, maxStores: Infinity, maxInvoices: Infinity },
    features: { delivery: true, returns: true, discounts: true },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function planKeyOf(company: Pick<Company, 'plan' | 'productsPlan'> | undefined): PlanKey {
  const raw = String(company?.plan || company?.productsPlan || '').toLowerCase();
  if (raw.includes('enterprise')) return 'enterprise';
  if (raw.includes('starter') || raw.includes('free')) return 'starter';
  return 'pro';
}

export function planOf(company: Pick<Company, 'plan' | 'productsPlan'> | undefined) {
  return PLANS[planKeyOf(company)];
}

export function assertFeature(
  company: Pick<Company, 'plan' | 'productsPlan' | 'name'> | undefined,
  feature: 'delivery' | 'returns' | 'discounts',
): void {
  if (!company) return;
  const plan = planOf(company);
  if (!plan.features[feature]) {
    const label = { delivery: 'Home delivery', returns: 'Returns and refunds', discounts: 'Coupons' }[feature];
    throw new ForbiddenError(`${label} is not part of the ${plan.name}. Upgrade the plan to use it.`);
  }
}

export function assertMonthlyBillLimit(
  company: Pick<Company, 'plan' | 'productsPlan' | 'name'> | undefined,
  currentMonthBills: number,
): void {
  if (!company) return;
  const plan = planOf(company);
  if (Number.isFinite(plan.limits.maxInvoices) && currentMonthBills >= plan.limits.maxInvoices) {
    throw new ForbiddenError(
      `${plan.name} allows up to ${plan.limits.maxInvoices} bills per month. Upgrade your plan to continue billing.`,
    );
  }
}
