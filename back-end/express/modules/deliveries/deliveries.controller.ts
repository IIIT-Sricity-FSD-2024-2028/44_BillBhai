import { Request } from 'express';
import { Delivery } from '../../data/entities';
import { handle, param, query } from '../../utils/http';
import { actorName, assertInScope, listScope } from '../../utils/scope';
import { ordersService, OrdersService } from '../orders/orders.service';
import { deliveriesService, DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto, TransitionDeliveryDto, UpdateDeliveryDto } from './deliveries.schema';

/**
 * Deliveries Module Controller
 *
 * Reads join each delivery to its order, so the delivery desk sees what is in
 * the parcel, the bill total and how much cash to collect.
 */
export class DeliveriesController {
  constructor(
    private readonly service: DeliveriesService = deliveriesService,
    private readonly orders: OrdersService = ordersService,
  ) {}

  private withOrder(delivery: Delivery) {
    let order;
    try {
      order = this.orders.findOneOrder(delivery.orderId);
    } catch {
      order = undefined;
    }
    return {
      ...delivery,
      orderTotal: order?.total ?? 0,
      paymentMethod: order?.paymentMethod ?? '',
      paymentStatus: order?.paymentStatus ?? '',
      orderStatus: order?.status ?? '',
      orderDate: order?.orderDate,
      items: (order?.items ?? []).map((i) => ({
        productId: i.productId,
        productName: i.productName ?? i.productId,
        quantity: i.quantity,
      })),
    };
  }

  private owned(req: Request) {
    const delivery = this.service.findOne(param(req, 'id'));
    assertInScope(req, delivery.companyId, `Delivery ${delivery.id}`);
    return delivery;
  }

  public findAll = handle((req) =>
    this.service
      .findAll(query(req, 'status'), listScope(req, query(req, 'companyId')))
      .map((d) => this.withOrder(d)),
  );

  public findOne = handle((req) => this.withOrder(this.owned(req)));

  public findByOrder = handle((req) => {
    const delivery = this.service.findByOrder(param(req, 'orderId'));
    assertInScope(req, delivery.companyId, `Delivery for ${delivery.orderId}`);
    return this.withOrder(delivery);
  });

  public create = handle((req) => {
    const body = req.body as CreateDeliveryDto;
    const order = this.orders.findOneOrder(body.orderId);
    assertInScope(req, order.companyId, `Order ${order.id}`);
    return this.withOrder(this.service.create(body, actorName(req)));
  }, 201);

  public update = handle((req) => {
    this.owned(req);
    return this.withOrder(this.service.update(param(req, 'id'), req.body as UpdateDeliveryDto, actorName(req)));
  });

  public transition = handle((req) => {
    this.owned(req);
    return this.withOrder(
      this.service.transition(param(req, 'id'), req.body as TransitionDeliveryDto, actorName(req)),
    );
  });

  public remove = handle((req) => {
    this.owned(req);
    return this.service.remove(param(req, 'id'), actorName(req));
  });
}

export const deliveriesController = new DeliveriesController();
