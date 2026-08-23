'use strict';
const { seedInventory } = require('../../seed/seed-data');

class InventoryService {
  [key: string]: any;
  constructor() {
    this.inventory = seedInventory.map((i) => ({ ...i }));
  }

  _computeStatus(stock, reorderLevel) {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= reorderLevel * 0.5) return 'Critical';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  findAll() { return [...this.inventory]; }

  findOne(id) {
    const item = this.inventory.find((i) => i.id === id);
    if (!item) { const err = new Error(`Inventory item ${id} not found`); err.status = 404; throw err; }
    return item;
  }

  findByProduct(productId) {
    const item = this.inventory.find((i) => i.productId === productId);
    if (!item) { const err = new Error(`No inventory record for product ${productId}`); err.status = 404; throw err; }
    return item;
  }

  findLowStock() {
    return this.inventory.filter((i) => ['Low Stock','Critical','Out of Stock'].includes(i.status));
  }

  update(id, dto) {
    const idx = this.inventory.findIndex((i) => i.id === id);
    if (idx === -1) { const err = new Error(`Inventory item ${id} not found`); err.status = 404; throw err; }
    const updated = { ...this.inventory[idx], ...dto, lastUpdated: new Date().toISOString() };
    updated.status = this._computeStatus(updated.stockAvailable, updated.reorderLevel);
    this.inventory[idx] = updated;
    return this.inventory[idx];
  }

  adjustStock(dto) {
    const idx = this.inventory.findIndex((i) => i.productId === dto.productId);
    if (idx === -1) { const err = new Error(`No inventory for product ${dto.productId}`); err.status = 404; throw err; }
    const newStock = this.inventory[idx].stockAvailable + Number(dto.adjustment);
    if (newStock < 0) { const err = new Error('Stock cannot go below 0'); err.status = 400; throw err; }
    this.inventory[idx].stockAvailable = newStock;
    this.inventory[idx].status = this._computeStatus(newStock, this.inventory[idx].reorderLevel);
    this.inventory[idx].lastUpdated = new Date().toISOString();
    return this.inventory[idx];
  }

  remove(id) {
    const idx = this.inventory.findIndex((i) => i.id === id);
    if (idx === -1) { const err = new Error(`Inventory item ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.inventory.splice(idx, 1);
    return { message: `Inventory item ${id} deleted`, inventory: removed };
  }
}

module.exports = { InventoryService };
