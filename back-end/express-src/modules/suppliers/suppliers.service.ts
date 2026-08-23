'use strict';
const { seedSuppliers } = require('../../seed/seed-data');

class SuppliersService {
  [key: string]: any;
  constructor() {
    this.suppliers = seedSuppliers.map((s) => ({ ...s }));
    this.counter = this.suppliers.length + 1;
  }

  findAll() { return [...this.suppliers]; }

  findOne(id) {
    const s = this.suppliers.find((s) => s.id === id);
    if (!s) { const err = new Error(`Supplier ${id} not found`); err.status = 404; throw err; }
    return s;
  }

  create(dto) {
    const newSupplier = {
      id: `SUP-${String(this.counter++).padStart(3,'0')}`,
      name: dto.name,
      mobileNo: dto.mobileNo,
      email: dto.email || '',
      address: dto.address || '',
      gstNo: dto.gstNo || '',
    };
    this.suppliers.push(newSupplier);
    return newSupplier;
  }

  update(id, dto) {
    const idx = this.suppliers.findIndex((s) => s.id === id);
    if (idx === -1) { const err = new Error(`Supplier ${id} not found`); err.status = 404; throw err; }
    this.suppliers[idx] = { ...this.suppliers[idx], ...dto };
    return this.suppliers[idx];
  }

  remove(id) {
    const idx = this.suppliers.findIndex((s) => s.id === id);
    if (idx === -1) { const err = new Error(`Supplier ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.suppliers.splice(idx, 1);
    return { message: `Supplier ${id} deleted`, supplier: removed };
  }
}

module.exports = { SuppliersService };
