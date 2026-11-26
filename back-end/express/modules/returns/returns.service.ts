import { seedReturns } from '../../data/seed-data';
import { ReturnLine, ReturnRecord } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { netUnitPrice, round2 } from '../../utils/money';
import { bumped, checkVersion, nowIso } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { ordersService, OrdersService } from '../orders/orders.service';
import {
  CreateReturnDto,
  DeleteReturnResult,
  RETURN_TRANSITIONS,
  RETURN_WINDOW_DAYS,
  ReturnableOrder,
  TransitionReturnDto,
  UpdateReturnDto,
} from './returns.schema';

/** Statuses whose quantities count against what can still be returned. */
const COUNTS_AGAINST = ['Pending', 'Approved', 'Refunded', 'Exchanged'];

const NOT_SELLABLE_REASONS = ['damaged', 'expired', 'stale', 'defective'];

function isSellableByDefault(entry: ReturnRecord): boolean {
  if (entry.condition === 'damaged') return false;
  return !NOT_SELLABLE_REASONS.includes(String(entry.reason || '').toLowerCase());
}

/**
 * Returns Module Service
 *
 * A return is built from the order it belongs to:
 *   - only items on that order can be returned;
 *   - at most what was bought, minus what is already returned or waiting;
 *   - the refund is the price the customer actually paid for those units
 *     (the order's discount is shared out), worked out here, not typed in;
 *   - only for orders that were handed over and paid, within the return window.
 * Refunding updates the order's refunded amount and status and, unless the
 * goods were damaged, puts them back on the shelf through the stock ledger.
 */
export class ReturnsService {
  private returns: ReturnRecord[];
  private counter: number;

  constructor(
    private readonly orders: OrdersService = ordersService,
    private readonly inventory: InventoryService = inventoryService,
    private readonly activity: ActivityService = activityService,
  ) {
    this.returns = seedReturns.map((entry) => ({ ...entry, items: entry.items?.map((i) => ({ ...i })) }));
    this.counter = Math.max(221, ...this.returns.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1;
  }

  private clone(entry: ReturnRecord): ReturnRecord {
    return { ...entry, items: entry.items?.map((i) => ({ ...i })) };
  }

  public findAll(status?: string, companyId?: string): ReturnRecord[] {
    return this.returns
      .filter((entry) => (status ? entry.status === status : true))
      .filter((entry) => (companyId ? entry.companyId === companyId : true))
      .map((entry) => this.clone(entry));
  }

  public findOne(id: string): ReturnRecord {
    const entry = this.returns.find((record) => record.id === id);
    if (!entry) throw new NotFoundError(`Return ${id} not found`);
    return this.clone(entry);
  }

  /** What can still be returned from an order, line by line. */
  public returnable(orderId: string, at = Date.now()): ReturnableOrder {
    let order;
    try {
      order = this.orders.findOneOrder(orderId);
    } catch {
      throw new NotFoundError(`Order ${orderId} does not exist`);
    }
    const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.itemPrice * i.quantity, 0);
    const already = new Map<string, number>();
    this.returns
      .filter((r) => r.orderId === orderId && COUNTS_AGAINST.includes(r.status))
      .forEach((r) =>
        (r.items ?? []).forEach((line) => already.set(line.productId, (already.get(line.productId) ?? 0) + line.qty)),
      );
    const lines = order.items.map((item) => {
      const returned = already.get(item.productId) ?? 0;
      return {
        productId: item.productId,
        productName: item.productName ?? item.productId,
        sold: item.quantity,
        returned,
        returnable: Math.max(0, item.quantity - returned),
        itemPrice: item.itemPrice,
        unitPrice: netUnitPrice(item.itemPrice, subtotal, order.discountAmount),
      };
    });

    let reason: string | undefined;
    const ageDays = (at - new Date(order.orderDate).getTime()) / (24 * 60 * 60 * 1000);
    if (order.status === 'Cancelled') reason = 'This order was cancelled';
    else if (order.status === 'Processing' || order.status === 'Shipped') {
      reason = 'This order has not reached the customer yet';
    } else if (order.paymentStatus === 'Pending') reason = 'This order has not been paid for';
    else if (ageDays > RETURN_WINDOW_DAYS) {
      reason = `Returns are accepted within ${RETURN_WINDOW_DAYS} days; this order is ${Math.floor(ageDays)} days old`;
    } else if (!lines.some((l) => l.returnable > 0)) reason = 'Everything on this order is already returned';

    return {
      orderId: order.id,
      companyId: order.companyId,
      customerName: order.customerName ?? '',
      customerPhone: order.customerPhone,
      orderDate: order.orderDate,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      refundedAmount: order.refundedAmount ?? 0,
      eligible: !reason,
      reason,
      lines,
    };
  }

  public create(dto: CreateReturnDto, actor: { username: string; staffId: string; name?: string }): ReturnRecord {
    const state = this.returnable(dto.orderId);
    if (!state.eligible) throw new BadRequestError(`Order ${dto.orderId}: ${state.reason}`);

    const wanted = new Map<string, number>();
    const requestedLines = dto.items?.length
      ? dto.items
      : [{ productId: String(dto.product || ''), qty: dto.qty ?? 1 }];
    requestedLines.forEach((line) => {
      // The single-line form may name the product instead of its id.
      const match =
        state.lines.find((l) => l.productId === line.productId) ??
        state.lines.find((l) => l.productName.toLowerCase() === line.productId.trim().toLowerCase());
      if (!match) {
        throw new BadRequestError(`${line.productId} is not on order ${dto.orderId}`);
      }
      wanted.set(match.productId, (wanted.get(match.productId) ?? 0) + line.qty);
    });

    const items: ReturnLine[] = [];
    wanted.forEach((qty, productId) => {
      const line = state.lines.find((l) => l.productId === productId)!;
      if (qty > line.returnable) {
        throw new BadRequestError(
          line.returnable === 0
            ? `${line.productName} from ${dto.orderId} is already fully returned`
            : `Only ${line.returnable} of ${line.productName} can be returned from ${dto.orderId} (bought ${line.sold}, already returned ${line.returned})`,
        );
      }
      items.push({
        productId,
        productName: line.productName,
        qty,
        unitPrice: line.unitPrice,
        amount: round2(line.unitPrice * qty),
      });
    });

    const refundAmount =
      dto.returnType === 'exchange' ? 0 : round2(items.reduce((sum, i) => sum + i.amount, 0));
    const maxLeft = round2(state.total - state.refundedAmount);
    const finalRefund = Math.min(refundAmount, Math.max(0, maxLeft));

    const at = nowIso();
    const created: ReturnRecord = {
      id: `RET-${this.counter++}`,
      companyId: state.companyId,
      orderId: state.orderId,
      staffId: actor.staffId,
      returnDate: new Date(Date.parse(at) + 330 * 60 * 1000).toISOString().slice(0, 10),
      reason: dto.reason,
      condition: dto.condition,
      refundAmount: finalRefund,
      status: 'Pending',
      returnType: dto.returnType ?? 'refund',
      product: items.map((i) => `${i.productName} ×${i.qty}`).join(', '),
      qty: items.reduce((sum, i) => sum + i.qty, 0),
      items,
      requestedBy: dto.requestedBy?.trim() || state.customerName || 'Customer',
      note: dto.note,
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedBy: actor.username,
    };
    this.returns.unshift(created);
    this.activity.log({
      companyId: created.companyId,
      entity: 'return',
      entityId: created.id,
      action: 'create',
      summary: `Return raised on ${created.orderId}: ${created.product} (${created.returnType === 'exchange' ? 'exchange' : `₹${created.refundAmount}`})`,
      by: actor.username,
    });
    return this.clone(created);
  }

  private indexOf(id: string): number {
    const index = this.returns.findIndex((entry) => entry.id === id);
    if (index === -1) throw new NotFoundError(`Return ${id} not found`);
    return index;
  }

  /** Corrects the reason or note of a Pending return; status goes through transition(). */
  public update(id: string, dto: UpdateReturnDto, by = 'system'): ReturnRecord {
    if (dto.status) {
      return this.transition(
        id,
        {
          status: dto.status,
          refundMethod: dto.refundMethod,
          restock: dto.restock,
          rejectReason: dto.rejectReason,
          note: dto.note,
          version: dto.version,
        },
        by,
      );
    }
    const index = this.indexOf(id);
    const current = this.returns[index];
    checkVersion(current, dto.version, `Return ${id}`);
    if (current.status !== 'Pending') {
      throw new ConflictError(`Return ${id} is ${current.status}; only a Pending return can be edited`);
    }
    const next = { ...current };
    if (dto.reason !== undefined) next.reason = dto.reason;
    if (dto.note !== undefined) next.note = dto.note;
    this.returns[index] = bumped(next, by);
    return this.clone(this.returns[index]);
  }

  public transition(id: string, dto: TransitionReturnDto, by = 'system'): ReturnRecord {
    const index = this.indexOf(id);
    const current = this.returns[index];
    checkVersion(current, dto.version, `Return ${id}`);
    const allowed = RETURN_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictError(
        allowed.length
          ? `Return ${id} is ${current.status}; next it can be ${allowed.join(', ')}`
          : `Return ${id} is already ${current.status} and cannot change`,
      );
    }

    const at = nowIso();
    const next: ReturnRecord = { ...current, status: dto.status };
    let summary = `${current.status} → ${dto.status}`;
    const lines = current.items ?? [];

    if (dto.status === 'Rejected') {
      const reason = (dto.rejectReason ?? '').trim();
      if (reason.length < 3) throw new BadRequestError('Say why the return is rejected');
      next.rejectReason = reason;
      summary += ` (${reason})`;
    }

    if (dto.status === 'Refunded') {
      if (current.returnType === 'exchange') {
        throw new BadRequestError('This is an exchange request. Complete it as Exchanged, or raise a refund return instead.');
      }
      if (!dto.refundMethod) throw new BadRequestError('Choose how the money is refunded');
      const restock = dto.restock ?? isSellableByDefault(current);
      // Check the order can take this refund before anything moves.
      const order = this.orders.findOneOrder(current.orderId);
      if (round2((order.refundedAmount ?? 0) + current.refundAmount) - order.total > 0.009) {
        throw new ConflictError(`Refunding ₹${current.refundAmount} would take ${order.id} over its bill of ₹${order.total}`);
      }
      if (restock) {
        lines.forEach((line) =>
          this.inventory.move(line.productId, line.qty, {
            type: 'return',
            reason: `Returned on ${id} (${current.reason})`,
            refType: 'return',
            refId: id,
            by,
          }),
        );
      } else {
        lines.forEach((line) =>
          this.inventory.move(line.productId, 0, {
            type: 'write-off',
            reason: `Written off on ${id} (${current.reason})`,
            refType: 'return',
            refId: id,
            by,
          }),
        );
      }
      this.orders.applyRefund(current.orderId, current.refundAmount, by);
      next.refundMethod = dto.refundMethod;
      next.restock = restock;
      summary += ` ₹${current.refundAmount} by ${dto.refundMethod}; ${restock ? 'items back on the shelf' : 'items written off as damaged'}`;
    }

    if (dto.status === 'Exchanged') {
      const restock = dto.restock ?? isSellableByDefault(current);
      lines.forEach((line) => {
        const onHand = this.inventory.stockFor(line.productId) ?? 0;
        const coming = restock ? line.qty : 0;
        if (onHand + coming < line.qty) {
          throw new ConflictError(`Not enough ${line.productName} on the shelf to hand over a replacement`);
        }
      });
      lines.forEach((line) => {
        if (restock) {
          this.inventory.move(line.productId, line.qty, {
            type: 'return',
            reason: `Returned for exchange on ${id}`,
            refType: 'return',
            refId: id,
            by,
          });
        } else {
          this.inventory.move(line.productId, 0, {
            type: 'write-off',
            reason: `Written off on exchange ${id} (${current.reason})`,
            refType: 'return',
            refId: id,
            by,
          });
        }
        this.inventory.move(line.productId, -line.qty, {
          type: 'exchange',
          reason: `Replacement handed over on ${id}`,
          refType: 'return',
          refId: id,
          by,
        });
      });
      next.restock = restock;
      summary += `; replacement handed over`;
    }

    if (['Refunded', 'Exchanged', 'Rejected'].includes(dto.status)) {
      next.resolvedAt = at;
      next.resolvedBy = by;
    }
    if (dto.note) next.note = dto.note;
    this.returns[index] = bumped(next, by);

    if (dto.status === 'Refunded') {
      const order = this.orders.findOneOrder(current.orderId);
      const refundedQty = new Map<string, number>();
      this.returns
        .filter((r) => r.orderId === order.id && r.status === 'Refunded')
        .forEach((r) => (r.items ?? []).forEach((l) => refundedQty.set(l.productId, (refundedQty.get(l.productId) ?? 0) + l.qty)));
      const fully = order.items.every((item) => (refundedQty.get(item.productId) ?? 0) >= item.quantity);
      this.orders.setReturnState(order.id, fully, by);
    }

    this.activity.log({
      companyId: current.companyId,
      entity: 'return',
      entityId: id,
      action: 'status',
      summary,
      by,
    });
    return this.clone(this.returns[index]);
  }

  /** A Pending request raised by mistake can be withdrawn. */
  public remove(id: string, by = 'system'): DeleteReturnResult {
    const index = this.indexOf(id);
    const current = this.returns[index];
    if (current.status !== 'Pending') {
      throw new ConflictError(`Return ${id} is ${current.status} and is kept for the records`);
    }
    const [removed] = this.returns.splice(index, 1);
    this.activity.log({
      companyId: removed.companyId,
      entity: 'return',
      entityId: id,
      action: 'delete',
      summary: `Return request on ${removed.orderId} withdrawn`,
      by,
    });
    return { message: `Return ${id} deleted`, 'return': removed };
  }

  public dump(): { returns: ReturnRecord[]; counter: number } {
    return { returns: this.returns, counter: this.counter };
  }

  public load(state: { returns?: ReturnRecord[]; counter?: number }): void {
    if (Array.isArray(state.returns)) this.returns = state.returns;
    if (Number(state.counter)) this.counter = Number(state.counter);
  }
}

export const returnsService = new ReturnsService();
