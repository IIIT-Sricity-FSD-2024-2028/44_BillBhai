import { seedProducts } from '../../data/seed-data';
import { Product } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { activityService, ActivityService } from '../activity/activity.service';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { suppliersService, SuppliersService } from '../suppliers/suppliers.service';
import { bumped, checkVersion, diff, initialStamp } from '../../utils/versioning';
import { CreateProductDto, DeleteProductResult, UpdateProductDto } from './products.schema';

/**
 * Products Module Service
 *
 * A product always has a stock row: create() opens both together, so nothing
 * can be sold without being counted. Products are never hard deleted, because
 * old bills, returns and the stock ledger point at them; "delete" deactivates
 * the product so it disappears from the till but keeps its history.
 */
export class ProductsService {
  private products: Product[];

  constructor(
    private readonly inventory: InventoryService = inventoryService,
    private readonly suppliers: SuppliersService = suppliersService,
    private readonly activity: ActivityService = activityService,
  ) {
    this.products = seedProducts.map((product) => ({ ...product }));
  }

  private clone(product: Product): Product {
    return { ...product };
  }

  private nextId(): string {
    const highest = this.products.reduce(
      (max, p) => Math.max(max, Number(p.id.replace(/\D/g, '')) || 0),
      0,
    );
    return `P${String(highest + 1).padStart(3, '0')}`;
  }

  /** Next barcode in the store's own 89012xxxxx range. */
  private nextBarcode(): string {
    const taken = new Set(this.products.map((p) => p.barcode));
    let n = this.products.length + 1;
    while (taken.has(`89012${String(n).padStart(5, '0')}`)) n += 1;
    return `89012${String(n).padStart(5, '0')}`;
  }

  private assertSupplier(companyId: string, supplierId: string): void {
    let supplier;
    try {
      supplier = this.suppliers.findOne(supplierId);
    } catch {
      throw new BadRequestError(`Supplier ${supplierId} does not exist`);
    }
    if (supplier.companyId !== companyId) {
      throw new BadRequestError(`Supplier ${supplierId} does not belong to this business`);
    }
  }

  private assertUnique(companyId: string, name: string, barcode: string | undefined, exceptId?: string): void {
    const needle = name.trim().toLowerCase();
    const sameName = this.products.find(
      (p) => p.companyId === companyId && p.id !== exceptId && p.name.trim().toLowerCase() === needle,
    );
    if (sameName) {
      throw new ConflictError(`A product called "${sameName.name}" already exists (${sameName.id})`);
    }
    if (barcode) {
      const sameCode = this.products.find(
        (p) => p.companyId === companyId && p.id !== exceptId && p.barcode === barcode,
      );
      if (sameCode) {
        throw new ConflictError(`Barcode ${barcode} is already used by ${sameCode.name}`);
      }
    }
  }

  public findAll(options: { companyId?: string; category?: string; includeInactive?: boolean } = {}): Product[] {
    const category = options.category?.toLowerCase();
    return this.products
      .filter((p) => (options.companyId ? p.companyId === options.companyId : true))
      .filter((p) => (options.includeInactive ? true : p.active !== false))
      .filter((p) => (category ? p.category.toLowerCase() === category : true))
      .map((p) => this.clone(p));
  }

  public findOne(id: string): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundError(`Product ${id} not found`);
    }
    return this.clone(product);
  }

  public findByBarcode(barcode: string, companyId?: string): Product {
    const product = this.products.find(
      (p) => p.barcode === barcode && (companyId ? p.companyId === companyId : true),
    );
    if (!product) {
      throw new NotFoundError(`Product with barcode ${barcode} not found`);
    }
    return this.clone(product);
  }

  public getCategories(companyId?: string): string[] {
    return [...new Set(this.findAll({ companyId }).map((p) => p.category))].sort();
  }

  public create(dto: CreateProductDto & { companyId: string }, by = 'system'): Product {
    this.assertSupplier(dto.companyId, dto.supplierId);
    const barcode = dto.barcode ? dto.barcode : undefined;
    this.assertUnique(dto.companyId, dto.name, barcode);

    const created: Product = {
      id: this.nextId(),
      companyId: dto.companyId,
      supplierId: dto.supplierId,
      name: dto.name.trim(),
      category: dto.category.trim(),
      barcode: barcode || this.nextBarcode(),
      price: dto.price,
      costPrice: dto.costPrice,
      gstRate: dto.gstRate ?? 5,
      size: dto.size?.trim() || '1 unit',
      description: dto.description?.trim() || '',
      imageUrl: dto.imageUrl,
      active: true,
      ...initialStamp(by),
    };
    this.products.push(created);
    try {
      this.inventory.create(
        {
          companyId: dto.companyId,
          productId: created.id,
          stockAvailable: dto.openingStock ?? 0,
          reorderLevel: dto.reorderLevel ?? 10,
          location: dto.location || 'Shelf',
        },
        by,
      );
    } catch (error) {
      // Never leave a product without its stock row.
      this.products = this.products.filter((p) => p.id !== created.id);
      throw error;
    }
    this.activity.log({
      companyId: created.companyId,
      entity: 'product',
      entityId: created.id,
      action: 'create',
      summary: `${created.name} added at ₹${created.price} with ${dto.openingStock ?? 0} in stock`,
      by,
    });
    return this.clone(created);
  }

  public update(id: string, dto: UpdateProductDto, by = 'system'): Product {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new NotFoundError(`Product ${id} not found`);
    }
    const current = this.products[index];
    checkVersion(current, dto.version, `Product ${current.name}`);
    if (dto.supplierId) this.assertSupplier(current.companyId, dto.supplierId);
    this.assertUnique(current.companyId, dto.name ?? current.name, dto.barcode || undefined, id);
    const nextPrice = dto.price ?? current.price;
    const nextCost = dto.costPrice ?? current.costPrice;
    if (nextCost !== undefined && nextCost > nextPrice) {
      throw new BadRequestError('costPrice cannot be more than the selling price');
    }

    const { version: _v, ...changes } = dto;
    if (changes.barcode === '') delete changes.barcode;
    const updated = bumped({ ...current, ...changes }, by);
    this.products[index] = updated;

    const changed = diff(current, updated, [
      'name', 'category', 'supplierId', 'barcode', 'price', 'costPrice', 'gstRate', 'size', 'active',
    ]);
    if (Object.keys(changed).length) {
      const parts = Object.entries(changed).map(([field, c]) =>
        field === 'price' ? `price ₹${c.from} → ₹${c.to}` : field,
      );
      this.activity.log({
        companyId: current.companyId,
        entity: 'product',
        entityId: id,
        action: changed.active ? (updated.active ? 'reactivate' : 'deactivate') : 'update',
        summary: `${updated.name}: ${parts.join(', ')}`,
        changes: changed,
        by,
      });
    }
    return this.clone(updated);
  }

  /** "Delete" from the UI: the product leaves the till but keeps its history. */
  public remove(id: string, by = 'system'): DeleteProductResult {
    const current = this.findOne(id);
    if (current.active === false) {
      return { message: `Product ${id} is already inactive`, product: current };
    }
    const product = this.update(id, { active: false }, by);
    return { message: `Product ${id} deactivated`, product };
  }

  public dump(): { products: Product[] } {
    return { products: this.products };
  }

  public load(state: { products?: Product[] }): void {
    if (Array.isArray(state.products)) this.products = state.products;
  }
}

export const productsService = new ProductsService();
