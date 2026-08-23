import { seedProducts } from '../../../src/common/seed/seed-data';
import { ConflictError, NotFoundError } from '../../../src/errors/http-error';
import {
  CreateProductDto,
  DeleteProductResult,
  Product,
  UpdateProductDto,
} from './products.schema';

/**
 * Products Module Service
 *
 * Responsibilities:
 * - Encapsulates product catalog business rules.
 * - Stays framework-agnostic and data-oriented.
 * - Maintains an isolated in-memory copy of the seeded catalog.
 */
export class ProductsService {
  private products: Product[] = seedProducts.map((product) => ({ ...product }));
  private counter = this.products.length + 1;

  private clone(product: Product): Product {
    return { ...product };
  }

  public findAll(category?: string): Product[] {
    const items = category
      ? this.products.filter((product) => product.category === category)
      : this.products;

    return items.map((product) => this.clone(product));
  }

  public findOne(id: string): Product {
    const product = this.products.find((item) => item.id === id);
    if (!product) {
      throw new NotFoundError(`Product ${id} not found`);
    }
    return this.clone(product);
  }

  public findByBarcode(barcode: string): Product {
    const product = this.products.find((item) => item.barcode === barcode);
    if (!product) {
      throw new NotFoundError(`Product with barcode ${barcode} not found`);
    }
    return this.clone(product);
  }

  public getCategories(): string[] {
    return [...new Set(this.products.map((product) => product.category))];
  }

  public create(dto: CreateProductDto): Product {
    if (dto.barcode) {
      const existing = this.products.find(
        (product) => product.barcode === dto.barcode,
      );
      if (existing) {
        throw new ConflictError('Product with this barcode already exists');
      }
    }

    const created: Product = {
      id: `P${String(this.counter++).padStart(3, '0')}`,
      ...dto,
    };

    this.products.push(created);
    return this.clone(created);
  }

  public update(id: string, dto: UpdateProductDto): Product {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) {
      throw new NotFoundError(`Product ${id} not found`);
    }

    this.products[index] = {
      ...this.products[index],
      ...dto,
    };

    return this.clone(this.products[index]);
  }

  public remove(id: string): DeleteProductResult {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) {
      throw new NotFoundError(`Product ${id} not found`);
    }

    const [removed] = this.products.splice(index, 1);
    return {
      message: `Product ${id} deleted`,
      product: this.clone(removed),
    };
  }
}

export const productsService = new ProductsService();

