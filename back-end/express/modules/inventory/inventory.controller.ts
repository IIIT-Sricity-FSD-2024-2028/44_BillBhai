import { Request } from 'express';
import { InventoryItem } from '../../data/entities';
import { BadRequestError, ConflictError } from '../../errors/http-error';
import { handle, param, query } from '../../utils/http';
import { actorName, assertInScope, listScope } from '../../utils/scope';
import { productsService, ProductsService } from '../products/products.service';
import { suppliersService, SuppliersService } from '../suppliers/suppliers.service';
import { inventoryService, InventoryService } from './inventory.service';
import { AdjustStockDto, ReceiveStockDto, UpdateInventoryDto } from './inventory.schema';

/**
 * Inventory Module Controller
 *
 * List reads return each stock row joined to its product and supplier, so
 * the Inventory page and the till see the same name, price and count.
 */
export class InventoryController {
  constructor(
    private readonly service: InventoryService = inventoryService,
    private readonly products: ProductsService = productsService,
    private readonly suppliers: SuppliersService = suppliersService,
  ) {}

  private enrich(rows: InventoryItem[], forCustomer = false) {
    return rows.map((row) => {
      let product;
      try {
        product = this.products.findOne(row.productId);
      } catch {
        product = undefined;
      }
      if (forCustomer) {
        const inStock = row.stockAvailable > 0;
        return {
          id: row.id,
          companyId: row.companyId,
          productId: row.productId,
          productName: product?.name ?? row.productId,
          category: product?.category ?? 'Uncategorized',
          price: product?.price ?? 0,
          gstRate: product?.gstRate ?? 0,
          barcode: product?.barcode,
          size: product?.size,
          active: product?.active !== false,
          inStock,
          stockAvailable: Math.min(row.stockAvailable, 10),
          status: inStock ? 'In Stock' : 'Out of Stock',
        };
      }
      let supplier;
      try {
        supplier = product ? this.suppliers.findOne(product.supplierId) : undefined;
      } catch {
        supplier = undefined;
      }
      return {
        ...row,
        productName: product?.name ?? row.productId,
        category: product?.category ?? 'Uncategorized',
        price: product?.price ?? 0,
        costPrice: product?.costPrice,
        gstRate: product?.gstRate ?? 0,
        barcode: product?.barcode,
        size: product?.size,
        active: product?.active !== false,
        productVersion: product?.version,
        supplierId: product?.supplierId,
        supplierName: supplier?.name ?? '',
        supplierContact: supplier?.contactPerson ?? '',
        supplierPhone: supplier?.mobileNo ?? '',
        supplierEmail: supplier?.email ?? '',
        leadTimeDays: supplier?.leadTimeDays,
        moq: supplier?.moq,
      };
    });
  }

  private ownedByProduct(req: Request, productId: string) {
    const row = this.service.findByProduct(productId);
    assertInScope(req, row.companyId, `Product ${productId}`);
    return row;
  }

  public findAll = handle((req) =>
    this.enrich(this.service.findAll(listScope(req, query(req, 'companyId'))), req.auth?.role === 'customer'),
  );

  public findLowStock = handle((req) =>
    this.enrich(this.service.findLowStock(listScope(req, query(req, 'companyId')))),
  );

  public findMovements = handle((req) =>
    this.service.findMovements({
      companyId: listScope(req, query(req, 'companyId')),
      productId: query(req, 'productId'),
      type: query(req, 'type'),
      limit: Number((req.query as Record<string, unknown>).limit) || undefined,
    }),
  );

  public findOne = handle((req) => {
    const row = this.service.findOne(param(req, 'id'));
    assertInScope(req, row.companyId, `Inventory item ${row.id}`);
    return this.enrich([row])[0];
  });

  public findByProduct = handle((req) => this.enrich([this.ownedByProduct(req, param(req, 'productId'))])[0]);

  public update = handle((req) => {
    const row = this.service.findOne(param(req, 'id'));
    assertInScope(req, row.companyId, `Inventory item ${row.id}`);
    return this.enrich([this.service.update(row.id, req.body as UpdateInventoryDto, actorName(req))])[0];
  });

  public adjustStock = handle((req) => {
    const body = req.body as AdjustStockDto;
    this.ownedByProduct(req, body.productId);
    return this.enrich([this.service.adjustStock(body, actorName(req))])[0];
  });

  public receiveStock = handle((req) => {
    const body = req.body as ReceiveStockDto;
    const row = this.ownedByProduct(req, body.productId);
    if (body.supplierId) {
      const supplier = this.suppliers.findOne(body.supplierId);
      if (supplier.companyId !== row.companyId) {
        throw new BadRequestError(`Supplier ${body.supplierId} does not belong to this business`);
      }
    }
    return this.enrich([this.service.receive(body, actorName(req))])[0];
  });

  public remove = handle((req) => {
    const row = this.service.findOne(param(req, 'id'));
    assertInScope(req, row.companyId, `Inventory item ${row.id}`);
    let active = false;
    try {
      active = this.products.findOne(row.productId).active !== false;
    } catch {
      active = false;
    }
    if (active) {
      throw new ConflictError('This product is still sold. Deactivate the product before removing its stock record.');
    }
    return this.service.remove(row.id);
  });
}

export const inventoryController = new InventoryController();
