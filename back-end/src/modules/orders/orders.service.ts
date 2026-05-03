import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateBillDto,
  CreatePaymentDto,
} from './dto/order.dto';

/**
 * OrdersService: Handles the complex POS transactional flow.
 * This includes:
 * 1. Creating Orders and linking multiple OrderItems.
 * 2. Generating Bills tied to specific Orders.
 * 3. Recording Payments against those Bills.
 *
 * All data is managed in-memory only and resets on server restart.
 */
@Injectable()
export class OrdersService {
  private static readonly PROMO_CODE = 'WELCOME10';
  private static readonly PROMO_RATE = 0.1;
  // In-memory data collections
  private orders: any[] = [];
  private orderItems: any[] = [];
  private bills: any[] = [];
  private payments: any[] = [];

  // Dynamic counters for ID generation
  private orderCounter = 4830;
  private billCounter = 4;
  private paymentCounter = 4;
  private itemCounter = 8;

  // ── Orders ──

  private buildOrderSnapshot(order: any) {
    const items = this.orderItems.filter((item) => item.orderId === order.id);
    const itemCount = items.reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
      0,
    );

    return {
      ...order,
      items,
      itemsCount: Number.isFinite(Number(order.itemsCount))
        ? Number(order.itemsCount)
        : itemCount,
    };
  }

  findAllOrders(companyId?: string) {
    const list = companyId
      ? this.orders.filter((o) => o.companyId === companyId)
      : this.orders;
    return list.map((o) => this.buildOrderSnapshot(o));
  }

  findOneOrder(id: string) {
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.buildOrderSnapshot(order);
  }

  validatePromotion(code: string, subtotal: number) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);
    if (normalizedCode !== OrdersService.PROMO_CODE) {
      throw new BadRequestException('Invalid promo code');
    }

    const discount = Number(
      (safeSubtotal * OrdersService.PROMO_RATE).toFixed(2),
    );
    return {
      valid: true,
      code: OrdersService.PROMO_CODE,
      discount,
      subtotal: safeSubtotal,
      total: Math.max(0, Number((safeSubtotal - discount).toFixed(2))),
    };
  }

  createOrder(dto: CreateOrderDto) {
    const orderId = `ORD-${this.orderCounter++}`;
    const subtotal = dto.items.reduce(
      (sum, i) => sum + i.itemPrice * i.quantity,
      0,
    );
    const normalizedPromoCode = String(dto.promoCode || '')
      .trim()
      .toUpperCase();
    let discount = Math.max(0, Number(dto.discountAmount ?? 0) || 0);
    if (normalizedPromoCode) {
      if (normalizedPromoCode !== OrdersService.PROMO_CODE) {
        throw new BadRequestException('Invalid promo code');
      }
      discount = Number((subtotal * OrdersService.PROMO_RATE).toFixed(2));
    }
    const total = Math.max(0, subtotal - discount);

    const newOrder = {
      id: orderId,
      customerName: String(dto.customerName || '').trim() || undefined,
      customerId: dto.customerId,
      staffId: dto.staffId,
      companyId: dto.companyId,
      orderDate: new Date().toISOString(),
      orderType: dto.orderType,
      checkoutMode: dto.checkoutMode,
      status: 'Processing',
      discountAmount: discount,
      promoCode: normalizedPromoCode || null,
      paymentMethod: dto.paymentMethod ?? 'Pending',
      total,
      itemsCount: dto.items.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
        0,
      ),
    };
    this.orders.unshift(newOrder);

    dto.items.forEach((item) => {
      this.orderItems.push({
        id: `OI-${String(this.itemCounter++).padStart(3, '0')}`,
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        itemPrice: item.itemPrice,
      });
    });

    return {
      ...newOrder,
      items: this.orderItems.filter((i) => i.orderId === orderId),
    };
  }

  updateOrder(id: string, dto: UpdateOrderDto) {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new NotFoundException(`Order ${id} not found`);
    this.orders[idx] = {
      ...this.orders[idx],
      ...dto,
      ...(dto.customerName !== undefined
        ? { customerName: String(dto.customerName).trim() }
        : {}),
      ...(dto.itemsCount !== undefined
        ? { itemsCount: Math.max(0, Number(dto.itemsCount) || 0) }
        : {}),
      ...(dto.total !== undefined
        ? { total: Math.max(0, Number(dto.total) || 0) }
        : {}),
    };
    return this.findOneOrder(id);
  }

  removeOrder(id: string) {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new NotFoundException(`Order ${id} not found`);
    const [removed] = this.orders.splice(idx, 1);
    this.orderItems = this.orderItems.filter((i) => i.orderId !== id);
    return { message: `Order ${id} deleted`, order: removed };
  }

  // ── Bills ──

  findAllBills() {
    return this.bills;
  }

  findOneBill(billNo: string) {
    const bill = this.bills.find((b) => b.billNo === billNo);
    if (!bill) throw new NotFoundException(`Bill ${billNo} not found`);
    return bill;
  }

  createBill(dto: CreateBillDto) {
    const order = this.orders.find((o) => o.id === dto.orderId);
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
    const exists = this.bills.find((b) => b.orderId === dto.orderId);
    if (exists)
      throw new ConflictException(
        `Bill already exists for order ${dto.orderId}`,
      );
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

  findAllPayments() {
    return this.payments;
  }

  findOnePayment(billNo: string) {
    const payment = this.payments.find((p) => p.billNo === billNo);
    if (!payment)
      throw new NotFoundException(`Payment for bill ${billNo} not found`);
    return payment;
  }

  createPayment(dto: CreatePaymentDto) {
    const bill = this.bills.find((b) => b.billNo === dto.billNo);
    if (!bill) throw new NotFoundException(`Bill ${dto.billNo} not found`);
    const exists = this.payments.find((p) => p.billNo === dto.billNo);
    if (exists)
      throw new ConflictException(
        `Payment already recorded for bill ${dto.billNo}`,
      );
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
