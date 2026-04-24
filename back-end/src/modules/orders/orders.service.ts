import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { seedOrders, seedOrderItems, seedBills, seedPayments } from '../../common/seed/seed-data';
import { CreateOrderDto, UpdateOrderDto, CreateBillDto, CreatePaymentDto } from './dto/order.dto';

/**
 * OrdersService: Handles the complex POS transactional flow.
 * This includes:
 * 1. Creating Orders and linking multiple OrderItems.
 * 2. Generating Bills tied to specific Orders.
 * 3. Recording Payments against those Bills.
 * 
 * All data is managed in-memory using arrays seeded from the original project defaults.
 */
@Injectable()
export class OrdersService {
  // In-memory data collections
  private orders = seedOrders.map(o => ({ ...o }));
  private orderItems = seedOrderItems.map(i => ({ ...i }));
  private bills = seedBills.map(b => ({ ...b }));
  private payments = seedPayments.map(p => ({ ...p }));

  // Dynamic counters for ID generation
  private orderCounter = 4830; 
  private billCounter = 4;
  private paymentCounter = 4;
  private itemCounter = 8;

  // ── Orders ──

  findAllOrders(companyId?: string) {
    const list = companyId ? this.orders.filter(o => o.companyId === companyId) : this.orders;
    return list.map(o => ({
      ...o,
      items: this.orderItems.filter(i => i.orderId === o.id),
    }));
  }

  findOneOrder(id: string) {
    const order = this.orders.find(o => o.id === id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return { ...order, items: this.orderItems.filter(i => i.orderId === id) };
  }

  createOrder(dto: CreateOrderDto) {
    const orderId = `ORD-${this.orderCounter++}`;
    const subtotal = dto.items.reduce((sum, i) => sum + i.itemPrice * i.quantity, 0);
    const discount = dto.discountAmount ?? 0;
    const total = Math.max(0, subtotal - discount);

    const newOrder = {
      id: orderId,
      customerId: dto.customerId,
      staffId: dto.staffId,
      companyId: dto.companyId,
      orderDate: new Date().toISOString(),
      orderType: dto.orderType,
      checkoutMode: dto.checkoutMode,
      status: 'Processing',
      discountAmount: discount,
      paymentMethod: dto.paymentMethod ?? 'Pending',
      total,
    };
    this.orders.unshift(newOrder);

    dto.items.forEach(item => {
      this.orderItems.push({
        id: `OI-${String(this.itemCounter++).padStart(3, '0')}`,
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        itemPrice: item.itemPrice,
      });
    });

    return { ...newOrder, items: this.orderItems.filter(i => i.orderId === orderId) };
  }

  updateOrder(id: string, dto: UpdateOrderDto) {
    const idx = this.orders.findIndex(o => o.id === id);
    if (idx === -1) throw new NotFoundException(`Order ${id} not found`);
    this.orders[idx] = { ...this.orders[idx], ...dto };
    return this.findOneOrder(id);
  }

  removeOrder(id: string) {
    const idx = this.orders.findIndex(o => o.id === id);
    if (idx === -1) throw new NotFoundException(`Order ${id} not found`);
    const [removed] = this.orders.splice(idx, 1);
    this.orderItems = this.orderItems.filter(i => i.orderId !== id);
    return { message: `Order ${id} deleted`, order: removed };
  }

  // ── Bills ──

  findAllBills() { return this.bills; }

  findOneBill(billNo: string) {
    const bill = this.bills.find(b => b.billNo === billNo);
    if (!bill) throw new NotFoundException(`Bill ${billNo} not found`);
    return bill;
  }

  createBill(dto: CreateBillDto) {
    const order = this.orders.find(o => o.id === dto.orderId);
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
    const exists = this.bills.find(b => b.orderId === dto.orderId);
    if (exists) throw new ConflictException(`Bill already exists for order ${dto.orderId}`);
    const newBill = {
      billNo: `BILL-${String(this.billCounter++).padStart(3, '0')}`,
      orderId: dto.orderId,
      billDate: new Date().toISOString(),
      taxAmount: dto.taxAmount ?? 0,
      discountAmount: dto.discountAmount ?? 0,
    };
    this.bills.push(newBill);
    return newBill;
  }

  // ── Payments ──

  findAllPayments() { return this.payments; }

  findOnePayment(billNo: string) {
    const payment = this.payments.find(p => p.billNo === billNo);
    if (!payment) throw new NotFoundException(`Payment for bill ${billNo} not found`);
    return payment;
  }

  createPayment(dto: CreatePaymentDto) {
    const bill = this.bills.find(b => b.billNo === dto.billNo);
    if (!bill) throw new NotFoundException(`Bill ${dto.billNo} not found`);
    const exists = this.payments.find(p => p.billNo === dto.billNo);
    if (exists) throw new ConflictException(`Payment already recorded for bill ${dto.billNo}`);
    const newPayment = {
      id: `PAY-${String(this.paymentCounter++).padStart(3, '0')}`,
      billNo: dto.billNo,
      paymentDate: new Date().toISOString(),
      paymentMethod: dto.paymentMethod,
      paymentStatus: 'Paid',
      amountPaid: dto.amountPaid,
    };
    this.payments.push(newPayment);
    return newPayment;
  }
}
