import { Request } from 'express';
import { handle, param, query } from '../../utils/http';
import { actorName, assertInScope, listScope, writeScope } from '../../utils/scope';
import { ForbiddenError } from '../../errors/http-error';
import { planOf } from '../../utils/plans';
import { companiesService } from '../companies/companies.service';
import { productsService, ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './products.schema';

/**
 * Products Module Controller
 *
 * Every read and write is limited to the signed-in user's business.
 */
export class ProductsController {
  constructor(private readonly service: ProductsService = productsService) {}

  private owned(req: Request) {
    const product = this.service.findOne(param(req, 'id'));
    assertInScope(req, product.companyId, `Product ${product.id}`);
    return product;
  }

  public findAll = handle((req) =>
    this.service.findAll({
      companyId: listScope(req, query(req, 'companyId')),
      category: query(req, 'category'),
      includeInactive: query(req, 'includeInactive') === 'true',
    }),
  );

  public findOne = handle((req) => this.owned(req));

  public findByBarcode = handle((req) =>
    this.service.findByBarcode(param(req, 'barcode'), listScope(req, query(req, 'companyId'))),
  );

  public getCategories = handle((req) => this.service.getCategories(listScope(req, query(req, 'companyId'))));

  public create = handle((req) => {
    const body = req.body as CreateProductDto;
    const companyId = writeScope(req, body.companyId);
    const plan = planOf(companiesService.findOne(companyId));
    const count = this.service.findAll({ companyId, includeInactive: true }).length;
    if (count >= plan.limits.maxProducts) {
      throw new ForbiddenError(`The ${plan.name} allows ${plan.limits.maxProducts} products. Upgrade the plan to add more.`);
    }
    return this.service.create({ ...body, companyId }, actorName(req));
  }, 201);

  public update = handle((req) => {
    this.owned(req);
    return this.service.update(param(req, 'id'), req.body as UpdateProductDto, actorName(req));
  });

  public remove = handle((req) => {
    this.owned(req);
    return this.service.remove(param(req, 'id'), actorName(req));
  });
}

export const productsController = new ProductsController();
