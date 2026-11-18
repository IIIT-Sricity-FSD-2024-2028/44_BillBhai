import { Request } from 'express';
import { ReturnRecord } from '../../data/entities';
import { handle, param, query } from '../../utils/http';
import { actorId, actorName, assertInScope, listScope } from '../../utils/scope';
import { assertFeature } from '../../utils/plans';
import { companiesService } from '../companies/companies.service';
import { ordersService, OrdersService } from '../orders/orders.service';
import { returnsService, ReturnsService } from './returns.service';
import { CreateReturnDto, TransitionReturnDto, UpdateReturnDto } from './returns.schema';

/** Returns Module Controller - scoped to the signed-in user's business. */
export class ReturnsController {
  constructor(
    private readonly service: ReturnsService = returnsService,
    private readonly orders: OrdersService = ordersService,
  ) {}

  private withOrder(entry: ReturnRecord) {
    let order;
    try {
      order = this.orders.findOneOrder(entry.orderId);
    } catch {
      order = undefined;
    }
    return {
      ...entry,
      customerName: order?.customerName ?? entry.requestedBy,
      customerPhone: order?.customerPhone,
      orderTotal: order?.total,
      orderDate: order?.orderDate,
      paymentMethod: order?.paymentMethod,
    };
  }

  private owned(req: Request) {
    const entry = this.service.findOne(param(req, 'id'));
    assertInScope(req, entry.companyId, `Return ${entry.id}`);
    return entry;
  }

  public findAll = handle((req) =>
    this.service
      .findAll(query(req, 'status'), listScope(req, query(req, 'companyId')))
      .map((r) => this.withOrder(r)),
  );

  public findOne = handle((req) => this.withOrder(this.owned(req)));

  public returnable = handle((req) => {
    const state = this.service.returnable(param(req, 'orderId'));
    assertInScope(req, state.companyId, `Order ${state.orderId}`);
    return state;
  });

  public create = handle((req) => {
    const body = req.body as CreateReturnDto;
    const order = this.orders.findOneOrder(body.orderId);
    assertInScope(req, order.companyId, `Order ${body.orderId}`);
    assertFeature(companiesService.findOne(order.companyId), 'returns');
    const created = this.service.create(body, {
      username: actorName(req),
      staffId: actorId(req) || 'system',
    });
    return this.withOrder(created);
  }, 201);

  public update = handle((req) => {
    this.owned(req);
    return this.withOrder(this.service.update(param(req, 'id'), req.body as UpdateReturnDto, actorName(req)));
  });

  public transition = handle((req) => {
    this.owned(req);
    return this.withOrder(
      this.service.transition(param(req, 'id'), req.body as TransitionReturnDto, actorName(req)),
    );
  });

  public remove = handle((req) => {
    this.owned(req);
    return this.service.remove(param(req, 'id'), actorName(req));
  });
}

export const returnsController = new ReturnsController();
