import { Request } from 'express';
import { ConflictError } from '../../errors/http-error';
import { handle, param, query } from '../../utils/http';
import { ordersService } from '../orders/orders.service';
import { actorName, assertInScope, listScope, writeScope } from '../../utils/scope';
import { customersService, CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customers.schema';

/** Customers Module Controller - scoped to the signed-in user's business. */
export class CustomersController {
  constructor(private readonly service: CustomersService = customersService) {}

  private owned(req: Request) {
    const customer = this.service.findOne(param(req, 'id'));
    assertInScope(req, customer.companyId, `Customer ${customer.id}`);
    return customer;
  }

  public findAll = handle((req) => this.service.findAll(listScope(req, query(req, 'companyId'))));

  public findOne = handle((req) => this.owned(req));

  public findByPhone = handle((req) =>
    this.service.findByPhone(param(req, 'phone'), listScope(req, query(req, 'companyId'))),
  );

  public create = handle((req) => {
    const body = req.body as CreateCustomerDto;
    return this.service.create({ ...body, companyId: writeScope(req, body.companyId) }, actorName(req));
  }, 201);

  public update = handle((req) => {
    this.owned(req);
    return this.service.update(param(req, 'id'), req.body as UpdateCustomerDto, actorName(req));
  });

  public remove = handle((req) => {
    const customer = this.owned(req);
    if (customer.name === 'Walk-in Customer' && !customer.mobileNo) {
      throw new ConflictError('The shared walk-in record cannot be deleted');
    }
    const orders = ordersService
      .findAllOrders(customer.companyId, undefined, true)
      .filter((o) => o.customerId === customer.id);
    if (orders.length) {
      throw new ConflictError(`${customer.name} has ${orders.length} order(s) on record and cannot be deleted`);
    }
    return this.service.remove(customer.id);
  });
}

export const customersController = new CustomersController();
