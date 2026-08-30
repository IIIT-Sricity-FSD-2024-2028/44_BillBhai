'use strict';
const { seedCompanies } = require('../../seed/seed-data');

class CompaniesService {
  [key: string]: any;
  constructor() {
    this.companies = seedCompanies.map((c) => ({ ...c }));
    this.counter = this.companies.length + 1;
  }

  findAll() { return [...this.companies]; }

  findOne(id) {
    const c = this.companies.find((c) => c.id === id);
    if (!c) { const err = new Error(`Company ${id} not found`); err.status = 404; throw err; }
    return c;
  }

  create(dto) {
    const exists = this.companies.find((c) => c.email === dto.email || c.name === dto.name);
    if (exists) { const err = new Error('Company name or email already in use'); err.status = 409; throw err; }
    const rawPlan = String(dto.plan || dto.productsPlan || 'starter').toLowerCase();
    const planKey = rawPlan.includes('enterprise') ? 'enterprise' : (rawPlan.includes('pro') ? 'pro' : 'starter');
    const planName = planKey === 'enterprise' ? 'Enterprise Plan' : (planKey === 'pro' ? 'Growth / Pro Plan' : 'Starter Plan (Free)');
    const monthlyPrice = planKey === 'enterprise' ? 4999 : (planKey === 'pro' ? 1999 : 0);

    const newCompany = {
      id: `BIZ-${String(100 + this.counter++)}`,
      ...dto,
      plan: planKey,
      productsPlan: dto.productsPlan || planName,
      subscriptionStatus: dto.subscriptionStatus || 'Active',
      monthlyPrice: dto.monthlyPrice !== undefined ? dto.monthlyPrice : monthlyPrice,
      renewalDate: dto.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: dto.status || 'Active',
      profit: 0,
      paymentDue: 0,
      storesCount: dto.storesCount || 1,
      tenureMonths: dto.tenureMonths || 0,
    };
    this.companies.push(newCompany);
    return newCompany;
  }

  update(id, dto) {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) { const err = new Error(`Company ${id} not found`); err.status = 404; throw err; }
    if (dto.plan) {
      const rawPlan = String(dto.plan).toLowerCase();
      dto.plan = rawPlan.includes('enterprise') ? 'enterprise' : (rawPlan.includes('pro') ? 'pro' : 'starter');
      if (!dto.productsPlan) {
        dto.productsPlan = dto.plan === 'enterprise' ? 'Enterprise Plan' : (dto.plan === 'pro' ? 'Growth / Pro Plan' : 'Starter Plan (Free)');
      }
      if (dto.monthlyPrice === undefined) {
        dto.monthlyPrice = dto.plan === 'enterprise' ? 4999 : (dto.plan === 'pro' ? 1999 : 0);
      }
    }
    this.companies[idx] = { ...this.companies[idx], ...dto };
    return this.companies[idx];
  }

  remove(id) {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) { const err = new Error(`Company ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.companies.splice(idx, 1);
    return { message: `Company ${id} deleted`, company: removed };
  }
}

module.exports = { CompaniesService };
