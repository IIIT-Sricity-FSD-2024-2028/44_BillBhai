import {
  seedBills,
  seedOrderItems,
  seedOrders,
  seedPayments,
} from '../../data/seed-data';
import { Bill, Order, OrderItem, Payment } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { inclusiveTax, normalisePhone, round2 } from '../../utils/money';
import { bumped, checkVersion, nowIso } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { couponsService, CouponsService } from '../coupons/coupons.service';
import { customersService, CustomersService } from '../customers/customers.service';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { productsService, ProductsService } from '../products/products.service';
import {
  CreateOrderDto,
  DeleteOrderResult,
  OrderQuote,
  OrderSnapshot,
  PAYMENT_METHODS,
  PricedLine,
  PromotionResult,
  QuoteOrderDto,
  UpdateOrderDto,
} from './orders.schema';

/** Ids already handed out in the seed; counters never go below these. */
const ORDER_ID_FLOOR = 4829;

function extractNumericId(value: string): number {
  const parsed = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface Actor {
  username: string;
  staffId: string;
  staffName?: string;
}

/**
 * Orders Module Service
 *
 * Owns orders, their lines, bills and payments. The browser says WHAT is
 * being bought; this service decides what it costs:
 *   - every product must exist, belong to the business and be active;
 *   - the price is the one on file (a different price from the screen is
 *     refused with 409, so a stale till cannot undercharge);
 *   - the quantity must be on the shelf;
 *   - a coupon must be valid for this business, bill and customer;
 *   - the total, GST and change due are worked out here.
 * Creating an order also takes the stock off the shelf through the stock
 * ledger and writes the bill and (unless it is cash on delivery) the payment.
 *
 * Money on a saved order never changes. Cancelling puts the stock back and
 * marks the payment refunded or voided; returns are handled by the returns
 * module, which calls applyRefund().
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

  constructor(
    private readonly inventory: InventoryService = inventoryService,
    private readonly products: ProductsService = productsService,
    private readonly customers: CustomersService = customersService,
    private readonly coupons: CouponsService = couponsService,
    private readonly activity: ActivityService = activityService,
  ) {
    this.orders = seedOrders.map((order) => ({ ...order }));
    this.orderItems = seedOrderItems.map((item) => ({ ...item }));
    this.bills = seedBills.map((bill) => ({ ...bill }));
    this.payments = seedPayments.map((payment) => ({ ...payment }));
    this.orderCounter = Math.max(...this.orders.map((o) => extractNumericId(o.id)), ORDER_ID_FLOOR) + 1;
    this.billCounter = Math.max(0, ...this.bills.map((b) => extractNumericId(b.billNo))) + 1;
    this.paymentCounter = Math.max(0, ...this.payments.map((p) => extractNumericId(p.id))) + 1;
    this.orderItemCounter = Math.max(0, ...this.orderItems.map((i) => extractNumericId(i.id))) + 1;
  }

  /* -------------------------------------------------------------- */
  /* Reads                                                           */
  /* -------------------------------------------------------------- */

  private buildSnapshot(order: Order): OrderSnapshot {
    const items = this.orderItems.filter((item) => item.orderId === order.id).map((i) => ({ ...i }));
    const bill = this.bills.find((b) => b.orderId === order.id);
    const payments = this.payments.filter((p) => p.orderId === order.id || (bill && p.billNo === bill.billNo));
    const derivedCount = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
    return {
      ...order,
      items,
      itemsCount: derivedCount || Number(order.itemsCount) || 0,
      bill: bill ? { ...bill } : undefined,
      payments: payments.map((p) => ({ ...p })),
    };
  }

  public findAllOrders(companyId?: string, status?: string, includeDeleted = false): OrderSnapshot[] {
    return this.orders
      .filter((order) => (companyId ? order.companyId === companyId : true))
      .filter((order) => (status ? order.status === status : true))
      .filter((order) => (includeDeleted ? true : !order.deleted))
      .map((order) => this.buildSnapshot(order));
  }

  public countMonthlyBills(companyId: string, monthPrefix = nowIso().slice(0, 7)): number {
    return this.bills.filter(
      (b) => b.companyId === companyId && String(b.billDate || '').startsWith(monthPrefix),
    ).length;
  }

  public findOneOrder(id: string): OrderSnapshot {
    const order = this.orders.find((entry) => entry.id === id);
    if (!order) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    return this.buildSnapshot(order);
  }

  public findItems(orderId: string): OrderItem[] {
    return this.orderItems.filter((i) => i.orderId === orderId).map((i) => ({ ...i }));
  }

  /** Times a coupon was used in a business (cancelled bills do not count). */
  public couponUsage(companyId: string, code: string, customerId?: string): { total: number; byCustomer: number } {
    const needle = String(code || '').trim().toUpperCase();
    const used = this.orders.filter(
      (o) => o.companyId === companyId && o.promoCode === needle && o.status !== 'Cancelled' && !o.deleted,
    );
    return {
      total: used.length,
      byCustomer: customerId ? used.filter((o) => o.customerId === customerId).length : 0,
    };
  }

  /* -------------------------------------------------------------- */
  /* Pricing                                                         */
  /* -------------------------------------------------------------- */

  /**
   * Prices a cart from the catalogue and checks stock. Shared by the
   * "quote" endpoint (the till calls it before the cashier confirms) and by
   * createOrder, so the preview and the saved bill cannot disagree.
   */
  public quote(companyId: string, dto: QuoteOrderDto, customerId?: string): OrderQuote {
    const wanted = new Map<string, { quantity: number; sentPrices: number[] }>();
    (dto.items ?? []).forEach((item) => {
      const prev = wanted.get(item.productId);
      wanted.set(item.productId, {
        quantity: (prev?.quantity ?? 0) + item.quantity,
        sentPrices: [...(prev?.sentPrices ?? []), ...(item.itemPrice !== undefined ? [item.itemPrice] : [])],
      });
    });
    if (!wanted.size) throw new BadRequestError('The bill has no items');

    const lines: PricedLine[] = [];
    wanted.forEach((want, productId) => {
      let product;
      try {
        product = this.products.findOne(productId);
      } catch {
        throw new BadRequestError(`Product ${productId} does not exist`);
      }
      if (product.companyId !== companyId) {
        throw new BadRequestError(`Product ${productId} does not belong to this business`);
      }
      if (product.active === false) {
        throw new ConflictError(`${product.name} is no longer sold`);
      }
      const wrongPrice = want.sentPrices.find((p) => Math.abs(p - product.price) > 0.001);
      if (wrongPrice !== undefined) {
        throw new ConflictError(
          `The price of ${product.name} is now ₹${product.price} (the screen showed ₹${wrongPrice}). Refresh and try again.`,
          { productId, price: product.price },
        );
      }
      const onHand = this.inventory.stockFor(productId);
      if (onHand === null) {
        throw new ConflictError(`${product.name} has no stock record. Ask the inventory manager to add it.`);
      }
      if (want.quantity > onHand) {
        throw new ConflictError(
          onHand === 0 ? `${product.name} is out of stock` : `Only ${onHand} ${product.name} left in stock`,
          { productId, stockAvailable: onHand },
        );
      }
      lines.push({
        productId,
        productName: product.name,
        quantity: want.quantity,
        itemPrice: product.price,
        gstRate: product.gstRate ?? 0,
        lineTotal: round2(product.price * want.quantity),
        stockAvailable: onHand,
      });
    });

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    let discountAmount = 0;
    let promoCode: string | null = null;
    let couponDescription: string | undefined;
    if (dto.promoCode && dto.promoCode.trim()) {
      const check = this.coupons.validate(
        companyId,
        dto.promoCode,
        subtotal,
        this.couponUsage(companyId, dto.promoCode, customerId),
      );
      discountAmount = check.discount;
      promoCode = check.code;
      couponDescription = check.description;
    }
    const isDelivery = dto.checkoutMode === 'prepaid_delivery' || dto.checkoutMode === 'cod_delivery';
    const deliveryCharge = isDelivery ? round2(Math.max(0, dto.deliveryCharge ?? 0)) : 0;
    const taxAmount = inclusiveTax(lines, discountAmount);
    return {
      companyId,
      lines,
      subtotal,
      discountAmount,
      promoCode,
      couponDescription,
      deliveryCharge,
      taxAmount,
      total: round2(subtotal - discountAmount + deliveryCharge),
    };
  }

  public validatePromotion(
    companyId: string,
    code: string,
    subtotal: number,
    customerId?: string,
  ): PromotionResult {
    const check = this.coupons.validate(companyId, code, subtotal, this.couponUsage(companyId, code, customerId));
    return {
      valid: true,
      code: check.code,
      discount: check.discount,
      subtotal: check.subtotal,
      total: check.total,
      description: check.description,
    };
  }

  /* -------------------------------------------------------------- */
  /* Create                                                          */
  /* -------------------------------------------------------------- */

  public createOrder(
    dto: CreateOrderDto & { companyId: string; isCustomerSelfCheckout?: boolean },
    actor: Actor,
  ): OrderSnapshot & { changeDue?: number } {
    const isDelivery = dto.checkoutMode !== 'takeaway_now';
    const orderType = isDelivery ? 'delivery' : 'pickup';
    if (dto.orderType && dto.orderType !== orderType) {
      throw new BadRequestError(`checkoutMode ${dto.checkoutMode} is a ${orderType} order, not ${dto.orderType}`);
    }

    // Payment method follows the checkout mode.
    let paymentMethod = String(dto.paymentMethod || '').trim();
    if (dto.checkoutMode === 'cod_delivery') paymentMethod = 'COD';
    if (!paymentMethod) paymentMethod = 'Cash';
    if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
      throw new BadRequestError(`Payment method must be one of Cash, UPI, Card${isDelivery ? ' or COD' : ''}`);
    }
    if (paymentMethod === 'COD' && dto.checkoutMode !== 'cod_delivery') {
      throw new BadRequestError('Cash on delivery is only for delivery orders');
    }

    const input = dto.customer ?? {};
    const name = (input.name ?? dto.customerName ?? '').trim();
    const rawPhone = (input.phone ?? dto.customerPhone ?? '').trim();
    const phone = normalisePhone(rawPhone);
    if (rawPhone && !phone) throw new BadRequestError('Customer phone must be a 10-digit Indian mobile number');
    const address = (dto.delivery?.address ?? input.address ?? dto.customerAddress ?? '').trim();
    if (isDelivery) {
      if (!phone) throw new BadRequestError('A delivery needs the customer\'s 10-digit phone number');
      if (address.length < 8) throw new BadRequestError('A delivery needs a full address (at least 8 characters)');
    }

    // Price everything before touching anything (no customer is created for
    // a sale that is going to be refused).
    let knownCustomerId = input.id ?? dto.customerId;
    if (!knownCustomerId && phone) {
      try {
        knownCustomerId = this.customers.findByPhone(phone, dto.companyId).id;
      } catch {
        knownCustomerId = undefined;
      }
    }
    const priced = this.quote(dto.companyId, dto, knownCustomerId);
    const customer = this.customers.resolveForSale(
      dto.companyId,
      { id: knownCustomerId, name, phone, email: input.email, address: isDelivery ? address : input.address },
      actor.username,
    );

    let cashReceived: number | undefined;
    let changeDue: number | undefined;
    if (paymentMethod === 'Cash' && dto.amountTendered !== undefined) {
      if (dto.amountTendered < priced.total) {
        throw new BadRequestError(`Cash received ₹${dto.amountTendered} is less than the bill ₹${priced.total}`);
      }
      cashReceived = round2(dto.amountTendered);
      changeDue = round2(dto.amountTendered - priced.total);
    }

    const at = nowIso();
    const orderId = `ORD-${this.orderCounter++}`;
    const pendingSelfCheckoutPay = Boolean(dto.isCustomerSelfCheckout && (paymentMethod === 'UPI' || paymentMethod === 'Card'));
    const orderNotes = pendingSelfCheckoutPay
      ? [dto.notes, 'Payment pending — show to staff'].filter(Boolean).join(' · ')
      : dto.notes;
    const order: Order = {
      id: orderId,
      customerId: customer.id,
      customerName: name || customer.name,
      customerPhone: phone || customer.mobileNo || undefined,
      customerAddress: isDelivery ? address : undefined,
      staffId: actor.staffId,
      staffName: actor.staffName,
      companyId: dto.companyId,
      orderDate: at,
      orderType,
      checkoutMode: dto.checkoutMode,
      // A counter sale is handed over on the spot, unless self-checkout payment is pending staff confirmation.
      status: isDelivery || pendingSelfCheckoutPay ? 'Processing' : 'Delivered',
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      deliveryCharge: priced.deliveryCharge,
      taxAmount: priced.taxAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' || pendingSelfCheckoutPay ? 'Pending' : 'Paid',
      total: priced.total,
      cashReceived,
      changeDue,
      refundedAmount: 0,
      promoCode: priced.promoCode,
      itemsCount: priced.lines.reduce((sum, l) => sum + l.quantity, 0),
      notes: orderNotes,
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedBy: actor.username,
    };

    // Take the stock. quote() already checked it, so this cannot fail part way
    // unless two tills sell the last unit at once; undo what was taken if so.
    const taken: Array<{ productId: string; quantity: number }> = [];
    try {
      priced.lines.forEach((line) => {
        this.inventory.consumeStock(line.productId, line.quantity, { by: actor.username, refId: orderId });
        taken.push({ productId: line.productId, quantity: line.quantity });
      });
    } catch (error) {
      taken.forEach((t) =>
        this.inventory.move(t.productId, t.quantity, {
          type: 'cancel',
          reason: `Sale ${orderId} could not complete`,
          refType: 'order',
          refId: orderId,
          by: actor.username,
        }),
      );
      throw error;
    }

    this.orders.unshift(order);
    priced.lines.forEach((line) => {
      this.orderItems.push({
        id: `OI-${String(this.orderItemCounter++).padStart(4, '0')}`,
        orderId,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        itemPrice: line.itemPrice,
        gstRate: line.gstRate,
      });
    });

    const companyBills = this.bills.filter((b) => b.companyId === dto.companyId);
    const nextCompanyBillNum = Math.max(0, ...companyBills.map((b) => extractNumericId(b.billNo))) + 1;
    this.billCounter = Math.max(this.billCounter, nextCompanyBillNum + 1);
    const bill: Bill = {
      billNo: `BILL-${String(nextCompanyBillNum).padStart(4, '0')}`,
      orderId,
      companyId: dto.companyId,
      billDate: at,
      subtotal: priced.subtotal,
      taxAmount: priced.taxAmount,
      discountAmount: priced.discountAmount,
      deliveryCharge: priced.deliveryCharge,
      total: priced.total,
    };
    this.bills.push(bill);

    if (paymentMethod !== 'COD' && !pendingSelfCheckoutPay) {
      this.payments.push({
        id: `PAY-${String(this.paymentCounter++).padStart(4, '0')}`,
        billNo: bill.billNo,
        orderId,
        companyId: dto.companyId,
        paymentDate: at,
        paymentMethod,
        paymentStatus: 'Paid',
        amountPaid: priced.total,
        collectedBy: actor.username,
      });
    }

    this.activity.log({
      companyId: dto.companyId,
      entity: 'order',
      entityId: orderId,
      action: 'create',
      summary: `${orderType === 'delivery' ? 'Delivery' : 'Counter'} sale of ₹${priced.total} (${order.itemsCount} items, ${paymentMethod})${priced.promoCode ? ` with ${priced.promoCode}` : ''}`,
      by: actor.username,
    });

    const snapshot = this.buildSnapshot(order);
    return changeDue === undefined ? snapshot : { ...snapshot, changeDue };
  }

  /* -------------------------------------------------------------- */
  /* Changes                                                         */
  /* -------------------------------------------------------------- */

  private indexOf(id: string): number {
    const index = this.orders.findIndex((order) => order.id === id);
    if (index === -1) throw new NotFoundError(`Order ${id} not found`);
    return index;
  }

  private save(index: number, next: Order, summary: string, by: string, action = 'update'): OrderSnapshot {
    this.orders[index] = bumped(next, by);
    this.activity.log({
      companyId: next.companyId,
      entity: 'order',
      entityId: next.id,
      action,
      summary,
      by,
    });
    return this.buildSnapshot(this.orders[index]);
  }

  /**
   * Edits contact details and notes, and moves a counter order to Delivered or
   * Cancelled. Totals, lines and payment never change here. Delivery orders
   * change status through their delivery.
   */
  public updateOrder(id: string, dto: UpdateOrderDto, by = 'system'): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    checkVersion(current, dto.version, `Order ${id}`);

    if (dto.status && dto.status !== current.status) {
      if (dto.status === 'Cancelled') {
        return this.cancelOrder(id, dto.cancelReason || 'Cancelled from the Orders page', by);
      }
      if (dto.status === 'Delivered' && current.orderType === 'pickup' && current.status === 'Processing') {
        return this.save(index, { ...current, status: 'Delivered' }, 'Handed over at the counter', by, 'status');
      }
      if (current.orderType === 'delivery') {
        throw new ConflictError(
          `Order ${id} is a delivery order. Change its status from the Delivery page (it is ${current.status}).`,
        );
      }
      throw new ConflictError(`Order ${id} cannot go from ${current.status} to ${dto.status}`);
    }

    const next: Order = { ...current };
    const changed: string[] = [];
    if (dto.customerName !== undefined && dto.customerName !== current.customerName) {
      next.customerName = dto.customerName;
      changed.push('customer name');
    }
    if (dto.customerPhone !== undefined) {
      const phone = normalisePhone(dto.customerPhone);
      if (dto.customerPhone && !phone) throw new BadRequestError('Customer phone must be a 10-digit Indian mobile number');
      if (phone !== (current.customerPhone ?? '')) {
        next.customerPhone = phone || undefined;
        changed.push('phone');
      }
    }
    if (dto.customerAddress !== undefined && dto.customerAddress !== (current.customerAddress ?? '')) {
      if (['Shipped', 'Delivered'].includes(current.status)) {
        throw new ConflictError('The address cannot change after the order has left the store');
      }
      next.customerAddress = dto.customerAddress;
      changed.push('address');
    }
    if (dto.notes !== undefined && dto.notes !== (current.notes ?? '')) {
      next.notes = dto.notes;
      changed.push('notes');
    }
    if (!changed.length) return this.buildSnapshot(current);
    return this.save(index, next, `Updated ${changed.join(', ')}`, by);
  }

  /**
   * Cancels an order that has not been (partly) returned: puts every unit
   * back on the shelf and marks the money refunded (paid) or voided (COD not
   * yet collected). The caller cancels the delivery, if there is one.
   */
  public cancelOrder(id: string, reason: string, by = 'system', options: { fromDelivery?: boolean } = {}): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    if (current.status === 'Cancelled') throw new ConflictError(`Order ${id} is already cancelled`);
    if (current.status === 'Partially Returned' || current.status === 'Returned') {
      throw new ConflictError(`Order ${id} already has refunded returns, so it cannot be cancelled`);
    }
    if (current.orderType === 'delivery' && !options.fromDelivery) {
      if (current.status === 'Shipped') {
        throw new ConflictError(`Order ${id} is already out with the delivery partner. Record a failed attempt, then return it to the store.`);
      }
      if (current.status === 'Delivered') {
        throw new ConflictError(`Order ${id} was delivered. Use a return instead of cancelling.`);
      }
    }
    if (!reason || reason.trim().length < 3) throw new BadRequestError('Say why the order is being cancelled');

    this.findItems(id).forEach((item) => {
      this.inventory.move(item.productId, item.quantity, {
        type: 'cancel',
        reason: `Order ${id} cancelled: ${reason}`,
        refType: 'order',
        refId: id,
        by,
      });
    });
    const paid = current.paymentStatus === 'Paid';
    const bill = this.bills.find((b) => b.orderId === id);
    this.payments = this.payments.map((p) =>
      p.orderId === id || (bill && p.billNo === bill.billNo) ? { ...p, paymentStatus: 'Refunded' } : p,
    );
    return this.save(
      index,
      {
        ...current,
        status: 'Cancelled',
        cancelReason: reason,
        paymentStatus: paid ? 'Refunded' : 'Voided',
        refundedAmount: paid ? current.total : 0,
      },
      `Cancelled (${reason}); stock put back${paid ? `, ₹${current.total} to refund` : ''}`,
      by,
      'cancel',
    );
  }

  /** Called by the delivery flow so the Orders page shows where a parcel is. */
  public setDeliveryStatus(id: string, status: 'Processing' | 'Shipped' | 'Delivered', by = 'system'): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    if (current.status === status || current.status === 'Cancelled') return this.buildSnapshot(current);
    return this.save(index, { ...current, status }, `Delivery status: ${status}`, by, 'status');
  }

  public setDeliveryNote(id: string, deliveryNote?: string): void {
    const index = this.indexOf(id);
    this.orders[index] = { ...this.orders[index], deliveryNote };
  }

  /** Cash collected at the door for a COD order. */
  public recordCodPayment(id: string, amount: number, by = 'system'): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    if (current.paymentMethod !== 'COD') return this.buildSnapshot(current);
    if (current.paymentStatus === 'Paid') return this.buildSnapshot(current);
    if (Math.abs(amount - current.total) > 0.009) {
      throw new BadRequestError(`Collect exactly ₹${current.total} for order ${id} (entered ₹${amount})`);
    }
    const bill = this.bills.find((b) => b.orderId === id);
    this.payments.push({
      id: `PAY-${String(this.paymentCounter++).padStart(4, '0')}`,
      billNo: bill ? bill.billNo : '',
      orderId: id,
      companyId: current.companyId,
      paymentDate: nowIso(),
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      amountPaid: amount,
      collectedBy: by,
    });
    return this.save(index, { ...current, paymentStatus: 'Paid' }, `₹${amount} cash collected on delivery`, by, 'payment');
  }

  /** Called by the returns module once a refund is paid out. */
  public applyRefund(id: string, amount: number, by = 'system'): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    const refunded = round2((current.refundedAmount ?? 0) + amount);
    if (refunded - current.total > 0.009) {
      throw new ConflictError(`Refunds on ${id} would come to ₹${refunded}, more than the bill of ₹${current.total}`);
    }
    return this.save(
      index,
      { ...current, refundedAmount: refunded, refundedAt: nowIso() },
      `₹${amount} refunded (total refunded ₹${refunded})`,
      by,
      'refund',
    );
  }

  /** Called by the returns module after the returned quantities change. */
  public setReturnState(id: string, fullyReturned: boolean, by = 'system'): OrderSnapshot {
    const index = this.indexOf(id);
    const current = this.orders[index];
    const status = fullyReturned ? 'Returned' : 'Partially Returned';
    const refunded = (current.refundedAmount ?? 0) > 0;
    const paymentStatus = refunded
      ? Math.abs((current.refundedAmount ?? 0) - current.total) < 0.01
        ? 'Refunded'
        : 'Partially Refunded'
      : current.paymentStatus;
    if (current.status === status && current.paymentStatus === paymentStatus) return this.buildSnapshot(current);
    return this.save(index, { ...current, status, paymentStatus }, `Order is now ${status}`, by, 'status');
  }

  /**
   * Only a cancelled order can be removed, and only from view: it is marked
   * deleted and kept for the books and the stock ledger.
   */
  public removeOrder(id: string, by = 'system'): DeleteOrderResult {
    const index = this.indexOf(id);
    const current = this.orders[index];
    if (current.status !== 'Cancelled') {
      throw new ConflictError(`Order ${id} is ${current.status}. Cancel it first; only cancelled orders can be deleted.`);
    }
    const snapshot = this.save(index, { ...current, deleted: true }, 'Hidden from the order list', by, 'delete');
    return { message: `Order ${id} deleted`, order: snapshot };
  }

  /* -------------------------------------------------------------- */
  /* Bills and payments                                              */
  /* -------------------------------------------------------------- */

  public findAllBills(companyId?: string): Bill[] {
    return this.bills.filter((b) => (companyId ? b.companyId === companyId : true)).map((b) => ({ ...b }));
  }

  public findOneBill(billNo: string): Bill {
    const bill = this.bills.find((entry) => entry.billNo === billNo);
    if (!bill) throw new NotFoundError(`Bill ${billNo} not found`);
    return { ...bill };
  }

  public findAllPayments(companyId?: string): Payment[] {
    return this.payments.filter((p) => (companyId ? p.companyId === companyId : true)).map((p) => ({ ...p }));
  }

  public findOnePayment(billNo: string): Payment {
    const payment = this.payments.find((entry) => entry.billNo === billNo);
    if (!payment) throw new NotFoundError(`Payment for bill ${billNo} not found`);
    return { ...payment };
  }

  public dump(): Record<string, unknown> {
    return {
      orders: this.orders,
      orderItems: this.orderItems,
      bills: this.bills,
      payments: this.payments,
      counters: [this.orderCounter, this.billCounter, this.paymentCounter, this.orderItemCounter],
    };
  }

  public load(state: {
    orders?: Order[];
    orderItems?: OrderItem[];
    bills?: Bill[];
    payments?: Payment[];
    counters?: number[];
  }): void {
    if (Array.isArray(state.orders)) this.orders = state.orders;
    if (Array.isArray(state.orderItems)) this.orderItems = state.orderItems;
    if (Array.isArray(state.bills)) this.bills = state.bills;
    if (Array.isArray(state.payments)) this.payments = state.payments;
    if (Array.isArray(state.counters) && state.counters.length === 4) {
      [this.orderCounter, this.billCounter, this.paymentCounter, this.orderItemCounter] = state.counters;
    }
  }
}

export const ordersService = new OrdersService();
