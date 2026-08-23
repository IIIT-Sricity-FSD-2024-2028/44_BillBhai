'use strict';
const { seedDeliveries } = require('../../seed/seed-data');

class DeliveriesService {
  [key: string]: any;
  constructor() {
    this.deliveries = seedDeliveries.map((d) => ({ ...d }));
    this.counter = 902;
  }

  findAll(status) {
    return status ? this.deliveries.filter((d) => d.status === status) : [...this.deliveries];
  }

  findOne(id) {
    const d = this.deliveries.find((d) => d.id === id);
    if (!d) { const err = new Error(`Delivery ${id} not found`); err.status = 404; throw err; }
    return d;
  }

  findByOrder(orderId) {
    const d = this.deliveries.find((d) => d.orderId === orderId);
    if (!d) { const err = new Error(`No delivery for order ${orderId}`); err.status = 404; throw err; }
    return d;
  }

  create(dto) {
    const newDelivery = {
      id: `DEL-${this.counter++}`,
      orderId: dto.orderId,
      customerName: dto.customerName || '',
      address: dto.address || '',
      partnerName: dto.partnerName || '',
      dispatchDate: dto.dispatchDate || new Date().toISOString().split('T')[0],
      deliveryDate: dto.deliveryDate || null,
      status: dto.status || 'Pending',
    };
    this.deliveries.push(newDelivery);
    return newDelivery;
  }

  update(id, dto) {
    const idx = this.deliveries.findIndex((d) => d.id === id);
    if (idx === -1) { const err = new Error(`Delivery ${id} not found`); err.status = 404; throw err; }
    this.deliveries[idx] = { ...this.deliveries[idx], ...dto };
    return this.deliveries[idx];
  }

  remove(id) {
    const idx = this.deliveries.findIndex((d) => d.id === id);
    if (idx === -1) { const err = new Error(`Delivery ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.deliveries.splice(idx, 1);
    return { message: `Delivery ${id} deleted`, delivery: removed };
  }
}

module.exports = { DeliveriesService };
