import { seedSuppliers } from '../../data/seed-data';
import { Supplier } from '../../data/entities';
import { NotFoundError } from '../../errors/http-error';
import {
  CreateSupplierDto,
  DeleteSupplierResult,
  UpdateSupplierDto,
} from './suppliers.schema';

/**
 * Suppliers Module Service
 *
 * Owns the vendor store. Framework agnostic: no express imports, no request or
 * response objects, no HTTP status codes.
 *
 * Straight CRUD over the seeded array, with ids following the legacy
 * `SUP-00n` sequence.
 */
export class SuppliersService {
  private suppliers: Supplier[];
  private counter: number;

  constructor() {
    this.suppliers = seedSuppliers.map((supplier) => ({ ...supplier }));
    this.counter = this.suppliers.length + 1;
  }

  public findAll(): Supplier[] {
    return [...this.suppliers];
  }

  public findOne(id: string): Supplier {
    const supplier = this.suppliers.find((entry) => entry.id === id);
    if (!supplier) {
      throw new NotFoundError(`Supplier ${id} not found`);
    }
    return supplier;
  }

  public create(dto: CreateSupplierDto): Supplier {
    const created: Supplier = {
      id: `SUP-${String(this.counter++).padStart(3, '0')}`,
      name: dto.name,
      mobileNo: dto.mobileNo,
      email: dto.email || '',
      address: dto.address || '',
      gstNo: dto.gstNo || '',
    };

    this.suppliers.push(created);
    return created;
  }

  public update(id: string, dto: UpdateSupplierDto): Supplier {
    const index = this.suppliers.findIndex((supplier) => supplier.id === id);
    if (index === -1) {
      throw new NotFoundError(`Supplier ${id} not found`);
    }

    this.suppliers[index] = { ...this.suppliers[index], ...dto };
    return this.suppliers[index];
  }

  public remove(id: string): DeleteSupplierResult {
    const index = this.suppliers.findIndex((supplier) => supplier.id === id);
    if (index === -1) {
      throw new NotFoundError(`Supplier ${id} not found`);
    }

    const [removed] = this.suppliers.splice(index, 1);
    return { message: `Supplier ${id} deleted`, supplier: removed };
  }
}

export const suppliersService = new SuppliersService();
