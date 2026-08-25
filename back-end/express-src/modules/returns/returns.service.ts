'use strict';
const { seedReturns } = require('../../seed/seed-data');

class ReturnsService {
  [key: string]: any;
  constructor() {
    this.returns = seedReturns.map((r) => ({ ...r }));
    this.counter = 222;
  }

  findAll(status) {
    return status ? this.returns.filter((r) => r.status === status) : [...this.returns];
  }

  findOne(id) {
    const r = this.returns.find((r) => r.id === id);
    if (!r) { const err = new Error(`Return ${id} not found`); err.status = 404; throw err; }
    return r;
  }

  create(dto) {
    const newReturn = {
      id: `RET-${this.counter++}`,
      companyId: dto.companyId,
      orderId: dto.orderId,
      staffId: dto.staffId,
      returnDate: dto.returnDate || new Date().toISOString().split('T')[0],
      reason: dto.reason || '',
      refundAmount: dto.refundAmount || 0,
      status: dto.status || 'Pending',
      returnType: dto.returnType || 'refund',
      product: dto.product || '',
      qty: dto.qty || 1,
      requestedBy: dto.requestedBy || '',
    };
    this.returns.push(newReturn);
    return newReturn;
  }

  update(id, dto) {
    const idx = this.returns.findIndex((r) => r.id === id);
    if (idx === -1) { const err = new Error(`Return ${id} not found`); err.status = 404; throw err; }
    this.returns[idx] = { ...this.returns[idx], ...dto };
    return this.returns[idx];
  }

  remove(id) {
    const idx = this.returns.findIndex((r) => r.id === id);
    if (idx === -1) { const err = new Error(`Return ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.returns.splice(idx, 1);
    return { message: `Return ${id} deleted`, return: removed };
  }
}

module.exports = { ReturnsService };
