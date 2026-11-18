import { seedDeliveries } from '../../data/seed-data';
import { Delivery } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { normalisePhone } from '../../utils/money';
import { bumped, checkVersion, nowIso } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { ordersService, OrdersService } from '../orders/orders.service';
import {
  CreateDeliveryDto,
  DeleteDeliveryResult,
  DELIVERY_TRANSITIONS,
  MAX_DELIVERY_ATTEMPTS,
  TransitionDeliveryDto,
  UpdateDeliveryDto,
} from './deliveries.schema';

const ACTIVE = ['Pending', 'Assigned', 'Dispatched', 'Out for Delivery', 'Failed Attempt'];

/**
 * Deliveries Module Service
 *
 * One delivery per delivery order, created in the same step as the sale.
 * Every status change goes through transition(), which enforces the flow in
 * deliveries.schema.ts, records who moved it and when, and keeps the order
 * in step: Dispatched marks the order Shipped, Delivered marks it Delivered
 * and records the COD cash, Returned to Store and Cancelled cancel the order
 * and put its stock back.
 */
export class DeliveriesService {
  private deliveries: Delivery[];
  private counter: number;

  constructor(
    private readonly orders: OrdersService = ordersService,
    private readonly activity: ActivityService = activityService,
  ) {
    this.deliveries = seedDeliveries.map((delivery) => ({
      ...delivery,
      history: (delivery.history ?? []).map((h) => ({ ...h })),
    }));
    this.counter =
      Math.max(901, ...this.deliveries.map((d) => Number(d.id.replace(/\D/g, '')) || 0)) + 1;
  }

  private clone(delivery: Delivery): Delivery {
    return { ...delivery, history: (delivery.history ?? []).map((h) => ({ ...h })) };
  }

  public findAll(status?: string, companyId?: string): Delivery[] {
    return this.deliveries
      .filter((d) => (status ? d.status === status : true))
      .filter((d) => (companyId ? d.companyId === companyId : true))
      .map((d) => this.clone(d));
  }

  public findOne(id: string): Delivery {
    const delivery = this.deliveries.find((entry) => entry.id === id);
    if (!delivery) throw new NotFoundError(`Delivery ${id} not found`);
    return this.clone(delivery);
  }

  /** The current (or latest) delivery for an order. */
  public findByOrder(orderId: string): Delivery {
    const matches = this.deliveries.filter((entry) => entry.orderId === orderId);
    const delivery = matches.find((d) => ACTIVE.includes(d.status)) ?? matches[matches.length - 1];
    if (!delivery) throw new NotFoundError(`No delivery for order ${orderId}`);
    return this.clone(delivery);
  }

  private checkPartnerPhone(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (!value) return '';
    const phone = normalisePhone(value);
    if (!phone) throw new BadRequestError('Partner phone must be a 10-digit mobile number');
    return phone;
  }

  public create(dto: CreateDeliveryDto, by = 'system'): Delivery {
    const order = this.orders.findOneOrder(dto.orderId);
    if (order.orderType !== 'delivery') {
      throw new BadRequestError(`Order ${order.id} is a counter sale, not a delivery order`);
    }
    if (order.status === 'Cancelled') throw new ConflictError(`Order ${order.id} is cancelled`);
    const open = this.deliveries.find((d) => d.orderId === order.id && ACTIVE.concat('Delivered').includes(d.status));
    if (open) throw new ConflictError(`Order ${order.id} already has delivery ${open.id} (${open.status})`);

    const address = (dto.address ?? order.customerAddress ?? '').trim();
    if (address.length < 8) throw new BadRequestError('A delivery needs a full address');
    const customerPhone = normalisePhone(dto.customerPhone ?? order.customerPhone ?? '');
    if (!customerPhone) throw new BadRequestError("A delivery needs the customer's 10-digit phone number");
    const partnerPhone = this.checkPartnerPhone(dto.partnerPhone) ?? '';
    const partnerName = (dto.partnerName ?? '').trim();
    if (partnerName && !partnerPhone) throw new BadRequestError('Give the partner\'s phone number so the store can reach them');
    const assigned = Boolean(partnerName);

    const at = nowIso();
    const created: Delivery = {
      id: `DEL-${this.counter++}`,
      companyId: order.companyId,
      orderId: order.id,
      customerName: order.customerName ?? '',
      customerPhone,
      address,
      partnerName,
      partnerPhone,
      partnerAgency: dto.partnerAgency ?? '',
      partnerVehicle: dto.partnerVehicle ?? '',
      etaMinutes: dto.etaMinutes ?? (assigned ? 45 : undefined),
      dispatchDate: at.slice(0, 10),
      deliveryDate: null,
      status: assigned ? 'Assigned' : 'Pending',
      codAmount: order.paymentMethod === 'COD' ? order.total : 0,
      cashCollected: 0,
      attempts: 0,
      history: [{ status: 'Pending', at, by, note: 'Created at checkout' }],
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedBy: by,
    };
    if (assigned) created.history!.push({ status: 'Assigned', at, by, note: `Assigned to ${partnerName}` });
    this.deliveries.unshift(created);
    this.activity.log({
      companyId: order.companyId,
      entity: 'delivery',
      entityId: created.id,
      action: 'create',
      summary: `Delivery for ${order.id} created${assigned ? `, assigned to ${partnerName}` : ''}`,
      by,
    });
    return this.clone(created);
  }

  private indexOf(id: string): number {
    const index = this.deliveries.findIndex((d) => d.id === id);
    if (index === -1) throw new NotFoundError(`Delivery ${id} not found`);
    return index;
  }

  /** Corrects details (partner, phone, address, ETA) without moving the parcel. */
  public update(id: string, dto: UpdateDeliveryDto, by = 'system'): Delivery {
    if (dto.status) {
      const { status, version, ...details } = dto;
      if (Object.keys(details).length) this.update(id, { ...details, version }, by);
      const current = this.findOne(id);
      if (current.status === status) return current;
      return this.transition(id, { status, ...details }, by);
    }
    const index = this.indexOf(id);
    const current = this.deliveries[index];
    checkVersion(current, dto.version, `Delivery ${id}`);
    if (['Delivered', 'Returned to Store', 'Cancelled'].includes(current.status)) {
      throw new ConflictError(`Delivery ${id} is ${current.status} and can no longer change`);
    }
    if (dto.address !== undefined && ['Dispatched', 'Out for Delivery'].includes(current.status)) {
      throw new ConflictError('The address cannot change while the parcel is on the road');
    }
    const next: Delivery = { ...current };
    if (dto.address !== undefined) next.address = dto.address;
    if (dto.customerPhone !== undefined) {
      const phone = normalisePhone(dto.customerPhone);
      if (!phone) throw new BadRequestError('Customer phone must be a 10-digit mobile number');
      next.customerPhone = phone;
    }
    if (dto.partnerName !== undefined) next.partnerName = dto.partnerName;
    const partnerPhone = this.checkPartnerPhone(dto.partnerPhone);
    if (partnerPhone !== undefined) next.partnerPhone = partnerPhone;
    if (dto.partnerAgency !== undefined) next.partnerAgency = dto.partnerAgency;
    if (dto.partnerVehicle !== undefined) next.partnerVehicle = dto.partnerVehicle;
    if (dto.etaMinutes !== undefined) next.etaMinutes = dto.etaMinutes;
    if (current.status !== 'Pending' && (!next.partnerName || !next.partnerPhone)) {
      throw new BadRequestError('An assigned delivery needs a partner name and phone');
    }
    this.deliveries[index] = bumped(next, by);
    this.activity.log({
      companyId: current.companyId ?? '',
      entity: 'delivery',
      entityId: id,
      action: 'update',
      summary: 'Delivery details updated',
      by,
    });
    return this.clone(this.deliveries[index]);
  }

  /** Moves a delivery along its flow, applying the effects of each step. */
  public transition(id: string, dto: TransitionDeliveryDto, by = 'system'): Delivery {
    const index = this.indexOf(id);
    const current = this.deliveries[index];
    checkVersion(current, dto.version, `Delivery ${id}`);
    const allowed = DELIVERY_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictError(
        allowed.length
          ? `Delivery ${id} is ${current.status}; next it can be ${allowed.join(', ')}`
          : `Delivery ${id} is ${current.status} and cannot change any more`,
      );
    }

    const at = nowIso();
    const next: Delivery = { ...current, status: dto.status };
    let note = dto.note;

    if (dto.partnerName !== undefined) next.partnerName = dto.partnerName;
    const partnerPhone = this.checkPartnerPhone(dto.partnerPhone);
    if (partnerPhone !== undefined) next.partnerPhone = partnerPhone;
    if (dto.partnerAgency !== undefined) next.partnerAgency = dto.partnerAgency;
    if (dto.partnerVehicle !== undefined) next.partnerVehicle = dto.partnerVehicle;
    if (dto.etaMinutes !== undefined) next.etaMinutes = dto.etaMinutes;

    switch (dto.status) {
      case 'Assigned': {
        if (!next.partnerName || !next.partnerPhone) {
          throw new BadRequestError('Pick a delivery partner and give their phone number');
        }
        if (current.status === 'Failed Attempt' && (current.attempts ?? 0) >= MAX_DELIVERY_ATTEMPTS) {
          throw new ConflictError(`Delivery ${id} has failed ${current.attempts} times. Return it to the store.`);
        }
        next.etaMinutes = next.etaMinutes ?? 45;
        note = note ?? `Assigned to ${next.partnerName}`;
        if (current.status === 'Failed Attempt') this.orders.setDeliveryStatus(current.orderId, 'Processing', by);
        break;
      }
      case 'Pending': {
        next.partnerName = '';
        next.partnerPhone = '';
        note = note ?? 'Partner unassigned';
        break;
      }
      case 'Dispatched': {
        next.dispatchDate = at.slice(0, 10);
        this.orders.setDeliveryStatus(current.orderId, 'Shipped', by);
        break;
      }
      case 'Out for Delivery': {
        break;
      }
      case 'Delivered': {
        const receiver = (dto.receiverName ?? '').trim();
        if (receiver.length < 2) throw new BadRequestError('Enter the name of the person who received the parcel');
        next.receiverName = receiver;
        if ((current.codAmount ?? 0) > 0) {
          if (dto.cashCollected === undefined) {
            throw new BadRequestError(`This is a COD order: enter the cash collected (₹${current.codAmount})`);
          }
          this.orders.recordCodPayment(current.orderId, dto.cashCollected, by);
          next.cashCollected = dto.cashCollected;
        }
        next.deliveryDate = at;
        this.orders.setDeliveryStatus(current.orderId, 'Delivered', by);
        note = note ?? `Received by ${receiver}`;
        break;
      }
      case 'Failed Attempt': {
        const reason = (dto.failureReason ?? '').trim();
        if (reason.length < 3) throw new BadRequestError('Say why the delivery failed');
        next.failureReason = reason;
        next.attempts = (current.attempts ?? 0) + 1;
        note = note ?? reason;
        break;
      }
      case 'Returned to Store': {
        this.orders.cancelOrder(
          current.orderId,
          `Delivery failed after ${current.attempts ?? 1} attempt(s): ${current.failureReason ?? 'not delivered'}`,
          by,
          { fromDelivery: true },
        );
        note = note ?? 'Parcel back in the store; stock put back';
        break;
      }
      case 'Cancelled': {
        this.orders.cancelOrder(current.orderId, dto.note || 'Delivery cancelled before dispatch', by, {
          fromDelivery: true,
        });
        break;
      }
      default:
        break;
    }

    next.history = [...(current.history ?? []), { status: dto.status, at, by, note }];
    this.deliveries[index] = bumped(next, by);
    this.activity.log({
      companyId: current.companyId ?? '',
      entity: 'delivery',
      entityId: id,
      action: 'status',
      summary: `${current.status} → ${dto.status}${note ? ` (${note})` : ''}`,
      by,
    });
    return this.clone(this.deliveries[index]);
  }

  /** Used when an order is cancelled from the Orders page before dispatch. */
  public cancelForOrder(orderId: string, reason: string, by = 'system'): void {
    const open = this.deliveries.find(
      (d) => d.orderId === orderId && ['Pending', 'Assigned'].includes(d.status),
    );
    if (!open) return;
    const index = this.indexOf(open.id);
    const at = nowIso();
    this.deliveries[index] = bumped(
      {
        ...open,
        status: 'Cancelled',
        history: [...(open.history ?? []), { status: 'Cancelled', at, by, note: reason }],
      },
      by,
    );
  }

  /** Deleting is only for a delivery created by mistake and still Pending. */
  public remove(id: string, by = 'system'): DeleteDeliveryResult {
    const index = this.indexOf(id);
    const current = this.deliveries[index];
    if (current.status !== 'Pending') {
      throw new ConflictError(`Delivery ${id} is ${current.status}. Cancel it instead of deleting it.`);
    }
    const [removed] = this.deliveries.splice(index, 1);
    this.activity.log({
      companyId: removed.companyId ?? '',
      entity: 'delivery',
      entityId: id,
      action: 'delete',
      summary: `Delivery for ${removed.orderId} deleted`,
      by,
    });
    return { message: `Delivery ${id} deleted`, delivery: removed };
  }

  public dump(): { deliveries: Delivery[]; counter: number } {
    return { deliveries: this.deliveries, counter: this.counter };
  }

  public load(state: { deliveries?: Delivery[]; counter?: number }): void {
    if (Array.isArray(state.deliveries)) this.deliveries = state.deliveries;
    if (Number(state.counter)) this.counter = Number(state.counter);
  }
}

export const deliveriesService = new DeliveriesService();
