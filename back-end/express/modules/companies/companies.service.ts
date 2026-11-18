import { seedCompanies } from '../../data/seed-data';
import { Company } from '../../data/entities';
import { ConflictError, NotFoundError } from '../../errors/http-error';
import { PlanKey, PLANS } from '../../utils/plans';
import { bumped, checkVersion, diff, initialStamp } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { CreateCompanyDto, DeleteCompanyResult, UpdateCompanyDto } from './companies.schema';

/** One month after a date, as YYYY-MM-DD. */
function nextRenewal(from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Companies Module Service
 *
 * A business and its subscription. Plan changes store the plan key, name,
 * price, status and renewal date together so every screen reads the same plan.
 */
export class CompaniesService {
  private companies: Company[];

  constructor(private readonly activity: ActivityService = activityService) {
    this.companies = seedCompanies.map((company) => ({ ...company }));
  }

  private nextId(): string {
    const highest = this.companies.reduce((max, c) => Math.max(max, Number(c.id.replace(/\D/g, '')) || 0), 100);
    return `BIZ-${highest + 1}`;
  }

  public findAll(): Company[] {
    return this.companies.map((c) => ({ ...c }));
  }

  public findOne(id: string): Company {
    const company = this.companies.find((entry) => entry.id === id);
    if (!company) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    return { ...company };
  }

  public assertAvailable(name: string, email: string, exceptId?: string): void {
    const clash = this.companies.find(
      (c) =>
        c.id !== exceptId &&
        (c.email.toLowerCase() === email.toLowerCase() || c.name.trim().toLowerCase() === name.trim().toLowerCase()),
    );
    if (clash) {
      throw new ConflictError(
        clash.email.toLowerCase() === email.toLowerCase()
          ? `A business is already registered with ${email}`
          : `A business called "${clash.name}" already exists`,
      );
    }
  }

  public create(dto: CreateCompanyDto, by = 'system'): Company {
    this.assertAvailable(dto.name, dto.email);
    const planKey: PlanKey = dto.plan ?? 'starter';
    const plan = PLANS[planKey];
    const created: Company = {
      id: this.nextId(),
      name: dto.name.trim(),
      owner: dto.owner || '',
      adminName: dto.adminName || '',
      type: dto.type || '',
      email: dto.email,
      phone: dto.phone,
      gstNo: dto.gstNo || '',
      address: dto.address || '',
      status: dto.status || 'Active',
      productsPlan: plan.name,
      plan: planKey,
      subscriptionStatus: 'Active',
      monthlyPrice: plan.price,
      renewalDate: nextRenewal(),
      tenureMonths: dto.tenureMonths || 0,
      storesCount: dto.storesCount || 1,
      profit: 0,
      paymentDue: 0,
      ...initialStamp(by),
    };
    this.companies.push(created);
    this.activity.log({
      companyId: created.id,
      entity: 'company',
      entityId: created.id,
      action: 'create',
      summary: `Business ${created.name} registered on the ${plan.name}`,
      by,
    });
    return { ...created };
  }

  public update(id: string, dto: UpdateCompanyDto, by = 'system'): Company {
    const index = this.companies.findIndex((company) => company.id === id);
    if (index === -1) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    const current = this.companies[index];
    checkVersion(current, dto.version, `Business ${current.name}`);
    if (dto.name || dto.email) this.assertAvailable(dto.name ?? current.name, dto.email ?? current.email, id);
    const { version: _v, ...changes } = dto;
    const merged: Company = { ...current, ...changes } as Company;
    if (changes.plan) {
      const plan = PLANS[changes.plan];
      merged.productsPlan = plan.name;
      if (changes.monthlyPrice === undefined) merged.monthlyPrice = plan.price;
    }
    const updated = bumped(merged, by);
    this.companies[index] = updated;
    const changed = diff(current, updated, [
      'name', 'email', 'phone', 'gstNo', 'address', 'status', 'plan', 'subscriptionStatus', 'monthlyPrice', 'renewalDate', 'paymentDue', 'storesCount',
    ]);
    if (Object.keys(changed).length) {
      this.activity.log({
        companyId: id,
        entity: 'company',
        entityId: id,
        action: 'update',
        summary: `Business details updated (${Object.keys(changed).join(', ')})`,
        changes: changed,
        by,
      });
    }
    return { ...updated };
  }

  public changePlan(id: string, planKey: PlanKey, by = 'system'): Company {
    const plan = PLANS[planKey];
    return this.update(
      id,
      {
        plan: planKey,
        productsPlan: plan.name,
        monthlyPrice: plan.price,
        subscriptionStatus: 'Active',
        renewalDate: nextRenewal(),
      },
      by,
    );
  }

  public cancelSubscription(id: string, by = 'system'): Company {
    return this.update(id, { subscriptionStatus: 'Cancelled' }, by);
  }

  public remove(id: string): DeleteCompanyResult {
    const index = this.companies.findIndex((company) => company.id === id);
    if (index === -1) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    const [removed] = this.companies.splice(index, 1);
    return { message: `Company ${id} deleted`, company: removed };
  }

  public dump(): { companies: Company[] } {
    return { companies: this.companies };
  }

  public load(state: { companies?: Company[] }): void {
    if (Array.isArray(state.companies)) this.companies = state.companies;
  }
}

export const companiesService = new CompaniesService();
