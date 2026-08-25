import {
  seedBills,
  seedOrderItems,
  seedOrders,
  seedPayments,
} from '../../data/seed-data';
import { Bill, Order, OrderItem, Payment } from '../../data/entities';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../errors/http-error';
import {
  CreateBillDto,
  CreateOrderDto,
  CreatePaymentDto,
  DeleteOrderResult,
  OrderSnapshot,
  PromotionResult,
  UpdateOrderDto,
} from './orders.schema';

/** The single promotion the POS honours, and the rate it is worth. */
const PROMO_CODE = 'WELCOME10';
const PROMO_RATE = 0.1;

/**
 * Lowest counter each generator may start from, mirroring the ids that ship in
 * the seed data. Kept so a trimmed seed array can never hand out an id that a
 * historic record already owns.
 */
const ORDER_ID_FLOOR = 4829;
const BILL_ID_FLOOR = 3;
const PAYMENT_ID_FLOOR = 3;
const ORDER_ITEM_ID_FLOOR = 7;

/** Pulls the numeric tail out of an id such as ORD-4829 or BILL-001. */
function extractNumericId(value: string): number {
  const parsed = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Orders Module Service
 *
 * Owns the whole checkout domain: orders, their line items, the bill raised
 * against an order and the payment recorded against that bill, plus promo code
 * validation. Framework agnostic: no express imports, no request or response
 * objects, no HTTP status codes.
 *
 * Bills and payments are one-per-parent, so both creators reject a second
 * attempt with a ConflictError rather than silently duplicating a record.
 */
export class OrdersService {
  private orders: Order[];
  private orderItems: OrderItem[];
  private bills: Bill[];
  private payments: Payment[];
  private orderCounter: number;
  private billCounter: number;
  private paymentCounter: number;
  private orderItemCounter: number;

  constructor() {
    this.orders = seedOrders.map((order) => ({ ...order }));
    this.orderItems = seedOrderItems.map((item) => ({ ...item }));
    this.bills = seedBills.map((bill) => ({ ...bill }));
    this.payments = seedPayments.map((payment) => ({ ...payment }));

    this.orderCounter =
      Math.max(
        ...this.orders.map((order) => extractNumericId(order.id)),
        ORDER_ID_FLOOR,
      ) + 1;
    this.billCounter =
      Math.max(
        ...this.bills.map((bill) => extractNumericId(bill.billNo)),
        BILL_ID_FLOOR,
      ) + 1;
    this.paymentCounter =
      Math.max(
        ...this.payments.map((payment) => extractNumericId(payment.id)),
        PAYMENT_ID_FLOOR,
      ) + 1;
    this.orderItemCounter =
      Math.max(
        ...this.orderItems.map((item) => extractNumericId(item.id)),
        ORDER_ITEM_ID_FLOOR,
      ) + 1;
  }

  /**
   * Every read returns the order joined to its line items. `itemsCount` is the
   * stored value when the record carries one, and is otherwise derived from the
   * quantities on the joined items.
   */
  private buildSnapshot(order: Order): OrderSnapshot {
    const items = this.orderItems.filter((item) => item.orderId === order.id);
    const derivedCount = items.reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
      0,
    );

    return {
      ...order,
      items,
      itemsCount: Number.isFinite(Number(order.itemsCount))
        ? Number(order.itemsCount)
        : derivedCount,
    };
  }

  public findAllOrders(companyId?: string, status?: string): OrderSnapshot[] {
    return this.orders
      .filter((order) => (companyId ? order.companyId === companyId : true))
      .filter((order) => (status ? order.status === status : true))
      .map((order) => this.buildSnapshot(order));
  }

  public findOneOrder(id: string): OrderSnapshot {
    const order = this.orders.find((entry) => entry.id === id);
    if (!order) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    return this.buildSnapshot(order);
  }

  /**
   * Checks a promo code against a subtotal. The comparison is trimmed and
   * upper cased, so 'welcome10 ' is accepted just like 'WELCOME10'.
   */
  public validatePromotion(code: string, subtotal: number): PromotionResult {
    const normalised = String(code || '').trim().toUpperCase();
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);

    if (normalised !== PROMO_CODE) {
      throw new BadRequestError('Invalid promo code');
    }

    const discount = round2(safeSubtotal * PROMO_RATE);

    return {
      valid: true,
      code: PROMO_CODE,
      discount,
      subtotal: safeSubtotal,
      total: Math.max(0, round2(safeSubtotal - discount)),
    };
  }

  /**
   * Places an order at the FRONT of the list, so the newest sale is the first
   * row the POS grid renders. The required fields and the non empty items array
   * are guaranteed by createOrderSchema before this runs.
   */
  public createOrder(dto: CreateOrderDto): OrderSnapshot {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.itemPrice * item.quantity,
      0,
    );

    const promoCode = (dto.promoCode ?? '').trim().toUpperCase();
    const discount = promoCode
      ? this.validatePromotion(promoCode, subtotal).discount
      : Math.max(0, dto.discountAmount ?? 0);

    const orderId = `ORD-${this.orderCounter++}`;
    const created: Order = {
      id: orderId,
      customerId: dto.customerId,
      customerName: (dto.customerName ?? '').trim() || undefined,
      customerAddress: (dto.customerAddress ?? '').trim() || undefined,
      staffId: dto.staffId,
      companyId: dto.companyId,
      orderDate: new Date().toISOString(),
      orderType: dto.orderType,
      checkoutMode: dto.checkoutMode,
      status: 'Processing',
      discountAmount: discount,
      paymentMethod: dto.paymentMethod ?? 'Pending',
      total: Math.max(0, subtotal - discount),
      promoCode: promoCode || null,
      itemsCount: dto.items.reduce(
        (sum, item) => sum + Math.max(0, item.quantity),
        0,
      ),
    };

    this.orders.unshift(created);

    dto.items.forEach((item) => {
      this.orderItems.push({
        id: `OI-${String(this.orderItemCounter++).padStart(3, '0')}`,
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        itemPrice: item.itemPrice,
      });
    });

    return this.buildSnapshot(created);
  }

  public updateOrder(id: string, dto: UpdateOrderDto): OrderSnapshot {
    const index = this.orders.findIndex((order) => order.id === id);
    if (index === -1) {
      throw new NotFoundError(`Order ${id} not found`);
    }

    const updates: Partial<Order> = { ...dto };
    if (dto.customerName !== undefined) {
      updates.customerName = dto.customerName.trim();
    }
    if (dto.customerAddress !== undefined) {
      updates.customerAddress = dto.customerAddress.trim();
    }
    if (dto.itemsCount !== undefined) {
      updates.itemsCount = Math.max(0, dto.itemsCount);
    }
    if (dto.total !== undefined) {
      updates.total = Math.max(0, dto.total);
    }

    this.orders[index] = { ...this.orders[index], ...updates };
    return this.findOneOrder(id);
  }

  /** Deleting an order also drops the line items that belong to it. */
  public removeOrder(id: string): DeleteOrderResult {
    const index = this.orders.findIndex((order) => order.id === id);
    if (index === -1) {
      throw new NotFoundError(`Order ${id} not found`);
    }

    const [removed] = this.orders.splice(index, 1);
    this.orderItems = this.orderItems.filter((item) => item.orderId !== id);

    return { message: `Order ${id} deleted`, order: removed };
  }

  public findAllBills(): Bill[] {
    return [...this.bills];
  }

  public findOneBill(billNo: string): Bill {
    const bill = this.bills.find((entry) => entry.billNo === billNo);
    if (!bill) {
      throw new NotFoundError(`Bill ${billNo} not found`);
    }
    return bill;
  }

  /** One bill per order: a second attempt for the same order is a conflict. */
  public createBill(dto: CreateBillDto): Bill {
    const order = this.orders.find((entry) => entry.id === dto.orderId);
    if (!order) {
      throw new NotFoundError(`Order ${dto.orderId} not found`);
    }

    const existing = this.bills.find((bill) => bill.orderId === dto.orderId);
    if (existing) {
      throw new ConflictError(`Bill already exists for order ${dto.orderId}`);
    }

    const created: Bill = {
      billNo: `BILL-${String(this.billCounter++).padStart(3, '0')}`,
      orderId: dto.orderId,
      billDate: new Date().toISOString(),
      taxAmount: dto.taxAmount ?? 0,
      discountAmount: dto.discountAmount ?? 0,
    };

    this.bills.push(created);
    return created;
  }

  public findAllPayments(): Payment[] {
    return [...this.payments];
  }

  public findOnePayment(billNo: string): Payment {
    const payment = this.payments.find((entry) => entry.billNo === billNo);
    if (!payment) {
      throw new NotFoundError(`Payment for bill ${billNo} not found`);
    }
    return payment;
  }

  /** One payment per bill: a second attempt for the same bill is a conflict. */
  public createPayment(dto: CreatePaymentDto): Payment {
    const bill = this.bills.find((entry) => entry.billNo === dto.billNo);
    if (!bill) {
      throw new NotFoundError(`Bill ${dto.billNo} not found`);
    }

    const existing = this.payments.find(
      (payment) => payment.billNo === dto.billNo,
    );
    if (existing) {
      throw new ConflictError(`Payment already recorded for bill ${dto.billNo}`);
    }

    const created: Payment = {
      id: `PAY-${String(this.paymentCounter++).padStart(3, '0')}`,
      billNo: dto.billNo,
      paymentDate: new Date().toISOString(),
      paymentMethod: dto.paymentMethod,
      paymentStatus: 'Paid',
      amountPaid: dto.amountPaid,
    };

    this.payments.push(created);
    return created;
  }
}

export const ordersService = new OrdersService();
