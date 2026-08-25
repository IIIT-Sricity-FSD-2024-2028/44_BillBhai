'use strict';
const { seedCustomers } = require('../../seed/seed-data');

class CustomersService {
  [key: string]: any;
  constructor() {
    this.customers = seedCustomers.map((c) => ({ ...c }));
    this.counter = this.customers.length + 1;
  }

  findAll(companyId) {
    return companyId ? this.customers.filter((c) => c.companyId === companyId) : [...this.customers];
  }

  findOne(id) {
    const c = this.customers.find((c) => c.id === id);
    if (!c) { const err = new Error(`Customer ${id} not found`); err.status = 404; throw err; }
    return c;
  }

  findByPhone(phone, companyId) {
    const norm = String(phone || '').replace(/\D/g, '').slice(-10);
    const list = companyId ? this.customers.filter((c) => c.companyId === companyId) : this.customers;
    const c = list.find((c) => String(c.mobileNo || '').replace(/\D/g, '').slice(-10) === norm);
    if (!c) { const err = new Error(`Customer with phone ${phone} not found`); err.status = 404; throw err; }
    return c;
  }

  create(dto) {
    const newCustomer = {
      id: `CUS-${String(this.counter++).padStart(3, '0')}`,
      companyId: dto.companyId,
      name: String(dto.name || '').trim() || 'Walk-in Customer',
      mobileNo: String(dto.mobileNo || '').replace(/\D/g, '').slice(-10),
      email: dto.email || '',
      address: dto.address || '',
    };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  update(id, dto) {
    const idx = this.customers.findIndex((c) => c.id === id);
    if (idx === -1) { const err = new Error(`Customer ${id} not found`); err.status = 404; throw err; }
    this.customers[idx] = { ...this.customers[idx], ...dto };
    return this.customers[idx];
  }

  remove(id) {
    const idx = this.customers.findIndex((c) => c.id === id);
    if (idx === -1) { const err = new Error(`Customer ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.customers.splice(idx, 1);
    return { message: `Customer ${id} deleted`, customer: removed };
  }
}

module.exports = { CustomersService };
