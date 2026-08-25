'use strict';
const { seedOrders, seedOrderItems, seedBills, seedPayments } = require('../../seed/seed-data');

const PROMO_CODE = 'WELCOME10';
const PROMO_RATE = 0.1;

function extractNumericId(value) {
  const parsed = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

class OrdersService {
  [key: string]: any;
  constructor() {
    this.orders = seedOrders.map((o) => ({ ...o }));
    this.orderItems = seedOrderItems.map((i) => ({ ...i }));
    this.bills = seedBills.map((b) => ({ ...b }));
    this.payments = seedPayments.map((p) => ({ ...p }));
    this.orderCounter = Math.max(...this.orders.map((o) => extractNumericId(o.id)), 4829) + 1;
    this.billCounter  = Math.max(...this.bills.map((b) => extractNumericId(b.billNo)), 3) + 1;
    this.payCounter   = Math.max(...this.payments.map((p) => extractNumericId(p.id)), 3) + 1;
    this.itemCounter  = Math.max(...this.orderItems.map((i) => extractNumericId(i.id)), 7) + 1;
  }

  _buildSnapshot(order) {
    const items = this.orderItems.filter((i) => i.orderId === order.id);
    const itemCount = items.reduce((s, i) => s + Math.max(0, Number(i.quantity || 0)), 0);
    return { ...order, items, itemsCount: Number.isFinite(Number(order.itemsCount)) ? Number(order.itemsCount) : itemCount };
  }

  findAllOrders(companyId) {
    const list = companyId ? this.orders.filter((o) => o.companyId === companyId) : this.orders;
    return list.map((o) => this._buildSnapshot(o));
  }

  findOneOrder(id) {
    const order = this.orders.find((o) => o.id === id);
    if (!order) { const err = new Error(`Order ${id} not found`); err.status = 404; throw err; }
    return this._buildSnapshot(order);
  }

  validatePromotion(code, subtotal) {
    const norm = String(code || '').trim().toUpperCase();
    const safe = Math.max(0, Number(subtotal) || 0);
    if (norm !== PROMO_CODE) { const err = new Error('Invalid promo code'); err.status = 400; throw err; }
    const discount = Number((safe * PROMO_RATE).toFixed(2));
    return { valid: true, code: PROMO_CODE, discount, subtotal: safe, total: Math.max(0, Number((safe - discount).toFixed(2))) };
  }

  createOrder(dto) {
    if (!dto.customerId || !dto.staffId || !dto.companyId || !dto.orderType || !dto.checkoutMode) {
      const err = new Error('customerId, staffId, companyId, orderType, checkoutMode are required'); err.status = 400; throw err;
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      const err = new Error('items array is required and must not be empty'); err.status = 400; throw err;
    }
    const orderId = `ORD-${this.orderCounter++}`;
    const subtotal = dto.items.reduce((s, i) => s + Number(i.itemPrice) * Number(i.quantity), 0);
    const normPromo = String(dto.promoCode || '').trim().toUpperCase();
    let discount = Math.max(0, Number(dto.discountAmount ?? 0) || 0);
    if (normPromo) {
      if (normPromo !== PROMO_CODE) { const err = new Error('Invalid promo code'); err.status = 400; throw err; }
      discount = Number((subtotal * PROMO_RATE).toFixed(2));
    }
    const total = Math.max(0, subtotal - discount);
    const newOrder = {
      id: orderId,
      customerName: String(dto.customerName || '').trim() || undefined,
      customerAddress: String(dto.customerAddress || '').trim() || undefined,
      customerId: dto.customerId, staffId: dto.staffId, companyId: dto.companyId,
      orderDate: new Date().toISOString(), orderType: dto.orderType, checkoutMode: dto.checkoutMode,
      status: 'Processing', discountAmount: discount, promoCode: normPromo || null,
      paymentMethod: dto.paymentMethod ?? 'Pending', total,
      itemsCount: dto.items.reduce((s, i) => s + Math.max(0, Number(i.quantity || 0)), 0),
    };
    this.orders.unshift(newOrder);
    dto.items.forEach((item) => {
      this.orderItems.push({ id: `OI-${String(this.itemCounter++).padStart(3,'0')}`, orderId, productId: item.productId, quantity: item.quantity, itemPrice: item.itemPrice });
    });
    return { ...newOrder, items: this.orderItems.filter((i) => i.orderId === orderId) };
  }

  updateOrder(id, dto) {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) { const err = new Error(`Order ${id} not found`); err.status = 404; throw err; }
    this.orders[idx] = {
      ...this.orders[idx], ...dto,
      ...(dto.customerName !== undefined ? { customerName: String(dto.customerName).trim() } : {}),
      ...(dto.customerAddress !== undefined ? { customerAddress: String(dto.customerAddress).trim() } : {}),
      ...(dto.itemsCount !== undefined ? { itemsCount: Math.max(0, Number(dto.itemsCount) || 0) } : {}),
      ...(dto.total !== undefined ? { total: Math.max(0, Number(dto.total) || 0) } : {}),
    };
    return this.findOneOrder(id);
  }

  removeOrder(id) {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) { const err = new Error(`Order ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.orders.splice(idx, 1);
    this.orderItems = this.orderItems.filter((i) => i.orderId !== id);
    return { message: `Order ${id} deleted`, order: removed };
  }

  findAllBills() { return [...this.bills]; }
  findOneBill(billNo) {
    const b = this.bills.find((b) => b.billNo === billNo);
    if (!b) { const err = new Error(`Bill ${billNo} not found`); err.status = 404; throw err; }
    return b;
  }
  createBill(dto) {
    if (!dto.orderId) { const err = new Error('orderId is required'); err.status = 400; throw err; }
    const order = this.orders.find((o) => o.id === dto.orderId);
    if (!order) { const err = new Error(`Order ${dto.orderId} not found`); err.status = 404; throw err; }
    const exists = this.bills.find((b) => b.orderId === dto.orderId);
    if (exists) { const err = new Error(`Bill already exists for order ${dto.orderId}`); err.status = 409; throw err; }
    const newBill = { billNo: `BILL-${String(this.billCounter++).padStart(3,'0')}`, orderId: dto.orderId, billDate: new Date().toISOString(), taxAmount: dto.taxAmount ?? 0, discountAmount: dto.discountAmount ?? 0 };
    this.bills.push(newBill);
    return newBill;
  }

  findAllPayments() { return [...this.payments]; }
  findOnePayment(billNo) {
    const p = this.payments.find((p) => p.billNo === billNo);
    if (!p) { const err = new Error(`Payment for bill ${billNo} not found`); err.status = 404; throw err; }
    return p;
  }
  createPayment(dto) {
    if (!dto.billNo || !dto.paymentMethod || dto.amountPaid === undefined) {
      const err = new Error('billNo, paymentMethod, amountPaid are required'); err.status = 400; throw err;
    }
    const bill = this.bills.find((b) => b.billNo === dto.billNo);
    if (!bill) { const err = new Error(`Bill ${dto.billNo} not found`); err.status = 404; throw err; }
    const exists = this.payments.find((p) => p.billNo === dto.billNo);
    if (exists) { const err = new Error(`Payment already recorded for bill ${dto.billNo}`); err.status = 409; throw err; }
    const newPayment = { id: `PAY-${String(this.payCounter++).padStart(3,'0')}`, billNo: dto.billNo, paymentDate: new Date().toISOString(), paymentMethod: dto.paymentMethod, paymentStatus: 'Paid', amountPaid: dto.amountPaid };
    this.payments.push(newPayment);
    return newPayment;
  }
}

module.exports = { OrdersService };
