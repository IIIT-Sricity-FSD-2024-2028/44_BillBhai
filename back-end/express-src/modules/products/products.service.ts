'use strict';
const { seedProducts } = require('../../seed/seed-data');

class ProductsService {
  [key: string]: any;
  constructor() {
    this.products = seedProducts.map((p) => ({ ...p }));
    this.counter = this.products.length + 1;
  }

  findAll(category) {
    return category ? this.products.filter((p) => p.category === category) : [...this.products];
  }

  getCategories() {
    return [...new Set(this.products.map((p) => p.category))];
  }

  findOne(id) {
    const p = this.products.find((p) => p.id === id);
    if (!p) { const err = new Error(`Product ${id} not found`); err.status = 404; throw err; }
    return p;
  }

  findByBarcode(barcode) {
    const p = this.products.find((p) => p.barcode === barcode);
    if (!p) { const err = new Error(`Product with barcode ${barcode} not found`); err.status = 404; throw err; }
    return p;
  }

  create(dto) {
    const newProduct = {
      id: `P${String(this.counter++).padStart(3, '0')}`,
      supplierId: dto.supplierId,
      name: dto.name,
      category: dto.category,
      barcode: dto.barcode || `BAR${String(this.counter).padStart(3, '0')}`,
      price: dto.price,
      size: dto.size || '',
      description: dto.description || '',
    };
    this.products.push(newProduct);
    return newProduct;
  }

  update(id, dto) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) { const err = new Error(`Product ${id} not found`); err.status = 404; throw err; }
    this.products[idx] = { ...this.products[idx], ...dto };
    return this.products[idx];
  }

  remove(id) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) { const err = new Error(`Product ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.products.splice(idx, 1);
    return { message: `Product ${id} deleted`, product: removed };
  }
}

module.exports = { ProductsService };
