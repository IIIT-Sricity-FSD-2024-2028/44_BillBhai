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
    const newCompany = {
      id: `BIZ-${String(100 + this.counter++)}`,
      ...dto,
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
