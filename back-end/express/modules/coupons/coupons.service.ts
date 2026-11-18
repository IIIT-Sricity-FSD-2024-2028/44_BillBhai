import { couponDiscount, seedCoupons } from '../../data/seed-data';
import { Coupon } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { round2 } from '../../utils/money';
import { bumped, checkVersion, diff, initialStamp } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { CouponCheck, CreateCouponDto, UpdateCouponDto } from './coupons.schema';

export interface CouponUsage {
  total: number;
  byCustomer: number;
}

/** Today's date in India, as YYYY-MM-DD, for validity windows. */
function todayIst(at = Date.now()): string {
  return new Date(at + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Coupons Module Service
 *
 * Each business keeps its own coupons. validate() is the single check used
 * by the till's "Apply" button and by order creation, so the discount on a
 * saved bill is always what the server worked out, never what a browser sent.
 */
export class CouponsService {
  private coupons: Coupon[];

  constructor(private readonly activity: ActivityService = activityService) {
    this.coupons = seedCoupons.map((c) => ({ ...c }));
  }

  private nextId(): string {
    const highest = this.coupons.reduce((max, c) => Math.max(max, Number(c.id.replace(/\D/g, '')) || 0), 0);
    return `CPN-${String(highest + 1).padStart(3, '0')}`;
  }

  public findAll(companyId?: string): Coupon[] {
    return this.coupons
      .filter((c) => (companyId ? c.companyId === companyId : true))
      .map((c) => ({ ...c }));
  }

  public findOne(id: string): Coupon {
    const found = this.coupons.find((c) => c.id === id);
    if (!found) throw new NotFoundError(`Coupon ${id} not found`);
    return { ...found };
  }

  public findByCode(companyId: string, code: string): Coupon | undefined {
    const needle = String(code || '').trim().toUpperCase();
    const found = this.coupons.find((c) => c.companyId === companyId && c.code === needle);
    return found ? { ...found } : undefined;
  }

  /**
   * Checks a code for a business, a bill subtotal and (optionally) a
   * customer's past use. Throws a 400 that says exactly why a code cannot be
   * used, so the cashier can tell the customer.
   */
  public validate(
    companyId: string,
    code: string,
    subtotal: number,
    usage: CouponUsage = { total: 0, byCustomer: 0 },
    at = Date.now(),
  ): CouponCheck {
    const normalised = String(code || '').trim().toUpperCase();
    const coupon = this.findByCode(companyId, normalised);
    if (!coupon) throw new BadRequestError(`Coupon ${normalised} does not exist`);
    if (!coupon.active) throw new BadRequestError(`Coupon ${coupon.code} is switched off`);
    const today = todayIst(at);
    if (today < coupon.validFrom) throw new BadRequestError(`Coupon ${coupon.code} starts on ${coupon.validFrom}`);
    if (today > coupon.validTo) throw new BadRequestError(`Coupon ${coupon.code} expired on ${coupon.validTo}`);
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);
    if (safeSubtotal < coupon.minOrder) {
      throw new BadRequestError(
        `Coupon ${coupon.code} needs a bill of at least ₹${coupon.minOrder} (this bill is ₹${round2(safeSubtotal)})`,
      );
    }
    if (coupon.usageLimit > 0 && usage.total >= coupon.usageLimit) {
      throw new BadRequestError(`Coupon ${coupon.code} has reached its limit of ${coupon.usageLimit} uses`);
    }
    if (coupon.perCustomerLimit > 0 && usage.byCustomer >= coupon.perCustomerLimit) {
      throw new BadRequestError(
        `This customer has already used ${coupon.code} ${usage.byCustomer} time(s), the most allowed`,
      );
    }
    const discount = couponDiscount(coupon, safeSubtotal);
    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount,
      subtotal: round2(safeSubtotal),
      total: round2(safeSubtotal - discount),
    };
  }

  public create(dto: CreateCouponDto & { companyId: string }, by = 'system'): Coupon {
    if (this.findByCode(dto.companyId, dto.code)) {
      throw new ConflictError(`Coupon code ${dto.code} already exists`);
    }
    const created: Coupon = {
      id: this.nextId(),
      companyId: dto.companyId,
      code: dto.code,
      description: dto.description ?? '',
      type: dto.type,
      value: dto.value,
      minOrder: dto.minOrder ?? 0,
      maxDiscount: dto.maxDiscount ?? 0,
      validFrom: dto.validFrom,
      validTo: dto.validTo,
      usageLimit: dto.usageLimit ?? 0,
      perCustomerLimit: dto.perCustomerLimit ?? 0,
      active: dto.active ?? true,
      ...initialStamp(by),
    };
    this.coupons.push(created);
    this.activity.log({
      companyId: created.companyId,
      entity: 'coupon',
      entityId: created.id,
      action: 'create',
      summary: `Coupon ${created.code} created (${created.type === 'percent' ? `${created.value}%` : `₹${created.value}`} off)`,
      by,
    });
    return { ...created };
  }

  public update(id: string, dto: UpdateCouponDto, usedCount: number, by = 'system'): Coupon {
    const index = this.coupons.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundError(`Coupon ${id} not found`);
    const current = this.coupons[index];
    checkVersion(current, dto.version, `Coupon ${current.code}`);
    if (dto.code && dto.code !== current.code) {
      if (usedCount > 0) {
        throw new ConflictError(`${current.code} is on ${usedCount} bill(s); its code cannot change. Create a new coupon instead.`);
      }
      if (this.findByCode(current.companyId, dto.code)) {
        throw new ConflictError(`Coupon code ${dto.code} already exists`);
      }
    }
    const { version: _v, ...changes } = dto;
    const merged = { ...current, ...changes };
    if (merged.type === 'percent' && merged.value > 90) {
      throw new BadRequestError('A percent coupon can give at most 90% off');
    }
    if (merged.validFrom > merged.validTo) {
      throw new BadRequestError('validTo must be on or after validFrom');
    }
    const updated = bumped(merged, by);
    this.coupons[index] = updated;
    const changed = diff(current, updated, [
      'code', 'description', 'type', 'value', 'minOrder', 'maxDiscount', 'validFrom', 'validTo', 'usageLimit', 'perCustomerLimit', 'active',
    ]);
    if (Object.keys(changed).length) {
      this.activity.log({
        companyId: current.companyId,
        entity: 'coupon',
        entityId: id,
        action: 'update',
        summary: `Coupon ${updated.code} updated (${Object.keys(changed).join(', ')})`,
        changes: changed,
        by,
      });
    }
    return { ...updated };
  }

  public remove(id: string, usedCount: number, by = 'system'): { message: string; coupon: Coupon } {
    const index = this.coupons.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundError(`Coupon ${id} not found`);
    const current = this.coupons[index];
    if (usedCount > 0) {
      const coupon = this.update(id, { active: false }, usedCount, by);
      return { message: `Coupon ${current.code} is on ${usedCount} bill(s), so it was switched off instead of deleted`, coupon };
    }
    const [removed] = this.coupons.splice(index, 1);
    this.activity.log({
      companyId: removed.companyId,
      entity: 'coupon',
      entityId: id,
      action: 'delete',
      summary: `Coupon ${removed.code} deleted`,
      by,
    });
    return { message: `Coupon ${removed.code} deleted`, coupon: removed };
  }

  public dump(): { coupons: Coupon[] } {
    return { coupons: this.coupons };
  }

  public load(state: { coupons?: Coupon[] }): void {
    if (Array.isArray(state.coupons)) this.coupons = state.coupons;
  }
}

export const couponsService = new CouponsService();
