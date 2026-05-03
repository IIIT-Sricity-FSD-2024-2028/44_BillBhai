import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { seedProducts } from '../../common/seed/seed-data';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

/**
 * ProductsService: Manages the product catalog.
 * Supports searching by ID or barcode for quick POS integration.
 */
export interface Product {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  barcode?: string;
  price: number;
  size?: string;
  description?: string;
}

@Injectable()
export class ProductsService {
  private products: Product[] = seedProducts.map(p => ({ ...p }));
  private counter = this.products.length + 1;

  findAll(category?: string) {
    return category ? this.products.filter(p => p.category === category) : this.products;
  }

  findOne(id: string) {
    const p = this.products.find(p => p.id === id);
    if (!p) throw new NotFoundException(`Product ${id} not found`);
    return p;
  }

  findByBarcode(barcode: string) {
    const p = this.products.find(p => p.barcode === barcode);
    if (!p) throw new NotFoundException(`Product with barcode ${barcode} not found`);
    return p;
  }

  getCategories() {
    return [...new Set(this.products.map(p => p.category))];
  }

  create(dto: CreateProductDto) {
    if (dto.barcode) {
      const exists = this.products.find(p => p.barcode === dto.barcode);
      if (exists) throw new ConflictException('Product with this barcode already exists');
    }
    const newProduct = {
      id: `P${String(this.counter++).padStart(3, '0')}`,
      ...dto,
    };
    this.products.push(newProduct);
    return newProduct;
  }

  update(id: string, dto: UpdateProductDto) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Product ${id} not found`);
    this.products[idx] = { ...this.products[idx], ...dto };
    return this.products[idx];
  }

  remove(id: string) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Product ${id} not found`);
    const [removed] = this.products.splice(idx, 1);
    return { message: `Product ${id} deleted`, product: removed };
  }
}
