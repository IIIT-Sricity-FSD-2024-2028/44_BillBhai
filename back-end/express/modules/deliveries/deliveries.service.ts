import { seedDeliveries } from '../../data/seed-data';
import { Delivery } from '../../data/entities';
import { NotFoundError } from '../../errors/http-error';
import { ordersService, OrdersService } from '../orders/orders.service';
import {
  CreateDeliveryDto,
  DeleteDeliveryResult,
  UpdateDeliveryDto,
} from './deliveries.schema';

/**
 * Deliveries Module Service
 *
 * Owns the shipment store. Framework agnostic: no express imports, no request
 * or response objects, no HTTP status codes.
 *
 * Ids continue the legacy sequence: DEL-902 is the first one this service mints.
 */
export class DeliveriesService {
  private deliveries: Delivery[];
  private counter: number;

  constructor(private readonly orders: OrdersService = ordersService) {
    this.deliveries = seedDeliveries.map((delivery) => ({ ...delivery }));
    this.counter = 902;
  }

  private clone(delivery: Delivery): Delivery {
    return { ...delivery };
  }

  /** Today as YYYY-MM-DD - the default dispatch date. */
  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  public findAll(status?: string): Delivery[] {
    return this.deliveries
      .filter((delivery) => (status ? delivery.status === status : true))
      .map((delivery) => this.clone(delivery));
  }

  public findOne(id: string): Delivery {
    const delivery = this.deliveries.find((entry) => entry.id === id);
    if (!delivery) {
      throw new NotFoundError(`Delivery ${id} not found`);
    }
    return this.clone(delivery);
  }

  public findByOrder(orderId: string): Delivery {
    const delivery = this.deliveries.find((entry) => entry.orderId === orderId);
    if (!delivery) {
      throw new NotFoundError(`No delivery for order ${orderId}`);
    }
    return this.clone(delivery);
  }

  public create(dto: CreateDeliveryDto): Delivery {
    const created: Delivery = {
      id: `DEL-${this.counter++}`,
      orderId: dto.orderId,
      customerName: dto.customerName || '',
      address: dto.address || '',
      partnerName: dto.partnerName || '',
      dispatchDate: dto.dispatchDate || this.today(),
      deliveryDate: dto.deliveryDate || null,
      status: dto.status || 'Pending',
    };

    this.deliveries.push(created);
    return this.clone(created);
  }

  public update(id: string, dto: UpdateDeliveryDto): Delivery {
    const index = this.deliveries.findIndex((delivery) => delivery.id === id);
    if (index === -1) {
      throw new NotFoundError(`Delivery ${id} not found`);
    }

    this.deliveries[index] = { ...this.deliveries[index], ...dto };
    if (dto.status) this.syncOrderStatus(this.deliveries[index].orderId, dto.status);
    return this.clone(this.deliveries[index]);
  }

  /** Keeps the order's status in step with its delivery (shown on the Orders page). */
  private syncOrderStatus(orderId: string, status: string): void {
    const orderStatus =
      status === 'Delivered'
        ? 'Delivered'
        : status === 'Failed' || status === 'Cancelled'
          ? 'Cancelled'
          : status === 'Pending'
            ? 'Processing'
            : 'Shipped';
    try {
      this.orders.updateOrder(orderId, { status: orderStatus });
    } catch {
      // Deliveries typed in by hand may point at an order that is not in the store.
    }
  }

  public remove(id: string): DeleteDeliveryResult {
    const index = this.deliveries.findIndex((delivery) => delivery.id === id);
    if (index === -1) {
      throw new NotFoundError(`Delivery ${id} not found`);
    }

    const [removed] = this.deliveries.splice(index, 1);
    return { message: `Delivery ${id} deleted`, delivery: removed };
  }
}

export const deliveriesService = new DeliveriesService();
