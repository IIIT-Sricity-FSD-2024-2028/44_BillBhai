import { Request } from 'express';
import { ForbiddenError } from '../../errors/http-error';
import { handle, param, query } from '../../utils/http';
import { actorId, actorName, assertInScope, listScope, writeScope } from '../../utils/scope';
import { assertFeature, assertMonthlyBillLimit } from '../../utils/plans';
import { companiesService } from '../companies/companies.service';
import { customersService, CustomersService } from '../customers/customers.service';
import { deliveriesService, DeliveriesService } from '../deliveries/deliveries.service';
import { usersService, UsersService } from '../users/users.service';
import { ordersService, OrdersService } from './orders.service';
import {
  CancelOrderDto,
  CreateOrderDto,
  QuoteOrderDto,
  UpdateOrderDto,
  ValidatePromotionDto,
} from './orders.schema';

/**
 * Orders Module Controller
 *
 * Creating a delivery order also creates its delivery in the same request.
 * If the delivery cannot be created the sale is cancelled (stock goes back),
 * so the till never shows "booked" for an order Delivery Ops cannot see.
 */
export class OrdersController {
  constructor(
    private readonly service: OrdersService = ordersService,
    private readonly deliveries: DeliveriesService = deliveriesService,
    private readonly users: UsersService = usersService,
    private readonly customers: CustomersService = customersService,
  ) {}

  private owned(req: Request) {
    const order = this.service.findOneOrder(param(req, 'id'));
    assertInScope(req, order.companyId, `Order ${order.id}`);
    return order;
  }

  private actor(req: Request, fallbackStaffId?: string) {
    const staffId = actorId(req) || fallbackStaffId || 'system';
    let staffName: string | undefined;
    try {
      staffName = this.users.findOne(staffId).name;
    } catch {
      staffName = undefined;
    }
    return { username: actorName(req), staffId, staffName };
  }

  public findAll = handle((req) =>
    this.service.findAllOrders(
      listScope(req, query(req, 'companyId')),
      query(req, 'status'),
      query(req, 'includeDeleted') === 'true',
    ),
  );

  public findOne = handle((req) => this.owned(req));

  public quote = handle((req) => {
    const body = req.body as QuoteOrderDto;
    const companyId = writeScope(req, body.companyId);
    let customerId = body.customerId ?? body.customer?.id;
    const phone = body.customer?.phone ?? body.customerPhone;
    if (!customerId && phone) {
      try {
        customerId = this.customers.findByPhone(phone, companyId).id;
      } catch {
        customerId = undefined;
      }
    }
    return this.service.quote(companyId, body, customerId);
  });

  public create = handle((req) => {
    const body = req.body as CreateOrderDto;
    const companyId = writeScope(req, body.companyId);
    const company = companiesService.findOne(companyId);
    assertMonthlyBillLimit(company, this.service.countMonthlyBills(companyId));
    if (body.checkoutMode !== 'takeaway_now') assertFeature(company, 'delivery');
    if (body.promoCode) assertFeature(company, 'discounts');
    const actor = this.actor(req, body.staffId);
    const isCustomerSelfCheckout = req.auth?.role === 'customer';
    const order = this.service.createOrder({ ...body, companyId, isCustomerSelfCheckout }, actor);
    if (order.orderType !== 'delivery') return order;
    try {
      const delivery = this.deliveries.create(
        {
          orderId: order.id,
          address: order.customerAddress,
          customerPhone: order.customerPhone,
          partnerName: body.delivery?.partnerName,
          partnerPhone: body.delivery?.partnerPhone,
          partnerAgency: body.delivery?.partnerAgency,
          partnerVehicle: body.delivery?.partnerVehicle,
          etaMinutes: body.delivery?.etaMinutes,
        },
        actor.username,
      );
      return { ...this.service.findOneOrder(order.id), delivery };
    } catch (error) {
      this.service.cancelOrder(order.id, 'Delivery could not be booked', actor.username, { fromDelivery: true });
      throw error;
    }
  }, 201);

  public update = handle((req) => {
    const order = this.owned(req);
    const body = req.body as UpdateOrderDto;
    if (body.status === 'Cancelled' && !['admin', 'superuser'].includes(String(req.auth?.role))) {
      throw new ForbiddenError('Only an admin can cancel (void) a bill');
    }
    const updated = this.service.updateOrder(order.id, body, actorName(req));
    if (body.customerAddress !== undefined || body.customerPhone !== undefined) {
      this.deliveries.syncContactForOrder(
        order.id,
        { address: updated.customerAddress, customerPhone: updated.customerPhone },
        actorName(req),
      );
    }
    if (updated.status === 'Cancelled' && order.status !== 'Cancelled') {
      this.deliveries.cancelForOrder(order.id, updated.cancelReason || 'Order cancelled', actorName(req));
    }
    return updated;
  });

  public confirmPayment = handle((req) => this.service.confirmCounterPayment(this.owned(req).id, actorName(req)));

  public cancel = handle((req) => {
    const order = this.owned(req);
    const body = req.body as CancelOrderDto;
    if (body.version !== undefined) this.service.updateOrder(order.id, { version: body.version, notes: order.notes ?? '' });
    const cancelled = this.service.cancelOrder(order.id, body.reason, actorName(req));
    this.deliveries.cancelForOrder(order.id, body.reason, actorName(req));
    return cancelled;
  });

  public remove = handle((req) => {
    const order = this.owned(req);
    return this.service.removeOrder(order.id, actorName(req));
  });

  public validatePromotion = handle((req) => {
    const body = req.body as ValidatePromotionDto;
    const companyId = writeScope(req, body.companyId);
    let customerId = body.customerId;
    if (!customerId && body.customerPhone) {
      try {
        customerId = this.customers.findByPhone(body.customerPhone, companyId).id;
      } catch {
        customerId = undefined;
      }
    }
    return this.service.validatePromotion(companyId, body.code, body.subtotal, customerId);
  });

  public findAllBills = handle((req) => this.service.findAllBills(listScope(req, query(req, 'companyId'))));

  public findOneBill = handle((req) => {
    const bill = this.service.findOneBill(param(req, 'billNo'), listScope(req, query(req, 'companyId')));
    assertInScope(req, bill.companyId, `Bill ${bill.billNo}`);
    return bill;
  });

  public findAllPayments = handle((req) => this.service.findAllPayments(listScope(req, query(req, 'companyId'))));

  public findOnePayment = handle((req) => {
    const payment = this.service.findOnePayment(param(req, 'billNo'), listScope(req, query(req, 'companyId')));
    assertInScope(req, payment.companyId, `Payment ${payment.id}`);
    return payment;
  });
}

export const ordersController = new OrdersController();
