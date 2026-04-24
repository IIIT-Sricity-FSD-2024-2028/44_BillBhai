import { Injectable, NotFoundException } from '@nestjs/common';
import { seedSuppliers } from '../../common/seed/seed-data';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  private suppliers = seedSuppliers.map(s => ({ ...s }));
  private counter = 8;

  findAll() {
    return this.suppliers;
  }

  findOne(id: string) {
    const s = this.suppliers.find(s => s.id === id);
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s;
  }

  create(dto: CreateSupplierDto) {
    const newSupplier = {
      id: `SUP-${String(this.counter++).padStart(3, '0')}`,
      ...dto,
    };
    this.suppliers.push(newSupplier);
    return newSupplier;
  }

  update(id: string, dto: UpdateSupplierDto) {
    const idx = this.suppliers.findIndex(s => s.id === id);
    if (idx === -1) throw new NotFoundException(`Supplier ${id} not found`);
    this.suppliers[idx] = { ...this.suppliers[idx], ...dto };
    return this.suppliers[idx];
  }

  remove(id: string) {
    const idx = this.suppliers.findIndex(s => s.id === id);
    if (idx === -1) throw new NotFoundException(`Supplier ${id} not found`);
    const [removed] = this.suppliers.splice(idx, 1);
    return { message: `Supplier ${id} deleted`, supplier: removed };
  }
}
