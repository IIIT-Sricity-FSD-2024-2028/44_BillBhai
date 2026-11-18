import { Request } from 'express';
import { ConflictError } from '../../errors/http-error';
import { handle, param, query } from '../../utils/http';
import { actorName, assertInScope, listScope, writeScope } from '../../utils/scope';
import { productsService, ProductsService } from '../products/products.service';
import { suppliersService, SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './suppliers.schema';

/** Suppliers Module Controller - scoped to the signed-in user's business. */
export class SuppliersController {
  constructor(
    private readonly service: SuppliersService = suppliersService,
    private readonly products: ProductsService = productsService,
  ) {}

  private owned(req: Request) {
    const supplier = this.service.findOne(param(req, 'id'));
    assertInScope(req, supplier.companyId, `Supplier ${supplier.id}`);
    return supplier;
  }

  public findAll = handle((req) => {
    const companyId = listScope(req, query(req, 'companyId'));
    const products = this.products.findAll({ companyId, includeInactive: false });
    return this.service.findAll(companyId).map((s) => ({
      ...s,
      productCount: products.filter((p) => p.supplierId === s.id).length,
    }));
  });

  public findOne = handle((req) => this.owned(req));

  public create = handle((req) => {
    const body = req.body as CreateSupplierDto;
    return this.service.create({ ...body, companyId: writeScope(req, body.companyId) }, actorName(req));
  }, 201);

  public update = handle((req) => {
    this.owned(req);
    return this.service.update(param(req, 'id'), req.body as UpdateSupplierDto, actorName(req));
  });

  public remove = handle((req) => {
    const supplier = this.owned(req);
    const linked = this.products
      .findAll({ companyId: supplier.companyId, includeInactive: true })
      .filter((p) => p.supplierId === supplier.id);
    if (linked.length) {
      throw new ConflictError(
        `${supplier.name} is linked to ${linked.length} product(s) (active or not): ${linked
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ')}${linked.length > 3 ? '…' : ''}. Move them to another supplier first.`,
      );
    }
    return this.service.remove(supplier.id, actorName(req));
  });
}

export const suppliersController = new SuppliersController();
