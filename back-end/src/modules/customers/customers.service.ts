import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { seedCustomers } from '../../common/seed/seed-data';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

/**
 * CustomersService: Manages customer profiles and loyalty info.
 * Includes phone-number normalization for reliable lookup during checkout.
 */
@Injectable()
export class CustomersService {
  private customers = seedCustomers.map(c => ({ ...c }));
  private counter = this.customers.length + 1;

  findAll(companyId?: string) {
    return companyId ? this.customers.filter(c => c.companyId === companyId) : this.customers;
  }

  findOne(id: string) {
    const c = this.customers.find(c => c.id === id);
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  findByPhone(mobileNo: string) {
    const normalized = mobileNo.replace(/\D/g, '').slice(-10);
    const c = this.customers.find(c => c.mobileNo.replace(/\D/g, '').slice(-10) === normalized);
    if (!c) throw new NotFoundException(`No customer found with phone ${mobileNo}`);
    return c;
  }

  create(dto: CreateCustomerDto) {
    const exists = this.customers.find(c => c.mobileNo === dto.mobileNo);
    if (exists) throw new ConflictException('Customer with this mobile number already exists');
    const newCustomer = { id: `CUS-${String(this.counter++).padStart(3, '0')}`, ...dto };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  update(id: string, dto: UpdateCustomerDto) {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) throw new NotFoundException(`Customer ${id} not found`);
    this.customers[idx] = { ...this.customers[idx], ...dto };
    return this.customers[idx];
  }

  remove(id: string) {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) throw new NotFoundException(`Customer ${id} not found`);
    const [removed] = this.customers.splice(idx, 1);
    return { message: `Customer ${id} deleted`, customer: removed };
  }
}
