import { seedCustomers } from '../../data/seed-data';
import { Customer } from '../../data/entities';
import { NotFoundError } from '../../errors/http-error';
import {
  CreateCustomerDto,
  DeleteCustomerResult,
  UpdateCustomerDto,
} from './customers.schema';

/**
 * Customers Module Service
 *
 * Owns the shopper store. Framework agnostic: no express imports, no request
 * or response objects, no HTTP status codes.
 *
 * Phone numbers reach us in every shape the till and the storefront allow, so
 * both sides of a lookup are reduced to their last ten digits before they are
 * compared - '+91-98100 01001' therefore matches the stored '9810001001'.
 */
export class CustomersService {
  private customers: Customer[];
  private counter: number;

  constructor() {
    this.customers = seedCustomers.map((customer) => ({ ...customer }));
    this.counter = this.customers.length + 1;
  }

  private normalisePhone(value: string): string {
    return String(value || '')
      .replace(/\D/g, '')
      .slice(-10);
  }

  public findAll(companyId?: string): Customer[] {
    return companyId
      ? this.customers.filter((customer) => customer.companyId === companyId)
      : [...this.customers];
  }

  public findOne(id: string): Customer {
    const customer = this.customers.find((entry) => entry.id === id);
    if (!customer) {
      throw new NotFoundError(`Customer ${id} not found`);
    }
    return customer;
  }

  public findByPhone(phone: string, companyId?: string): Customer {
    const needle = this.normalisePhone(phone);
    const scope = companyId
      ? this.customers.filter((customer) => customer.companyId === companyId)
      : this.customers;

    const customer = scope.find(
      (entry) => this.normalisePhone(entry.mobileNo) === needle,
    );
    if (!customer) {
      throw new NotFoundError(`Customer with phone ${phone} not found`);
    }
    return customer;
  }

  public create(dto: CreateCustomerDto): Customer {
    const created: Customer = {
      id: `CUS-${String(this.counter++).padStart(3, '0')}`,
      companyId: dto.companyId,
      name: String(dto.name || '').trim() || 'Walk-in Customer',
      mobileNo: this.normalisePhone(dto.mobileNo),
      email: dto.email || '',
      address: dto.address || '',
    };

    this.customers.push(created);
    return created;
  }

  public update(id: string, dto: UpdateCustomerDto): Customer {
    const index = this.customers.findIndex((customer) => customer.id === id);
    if (index === -1) {
      throw new NotFoundError(`Customer ${id} not found`);
    }

    this.customers[index] = { ...this.customers[index], ...dto };
    return this.customers[index];
  }

  public remove(id: string): DeleteCustomerResult {
    const index = this.customers.findIndex((customer) => customer.id === id);
    if (index === -1) {
      throw new NotFoundError(`Customer ${id} not found`);
    }

    const [removed] = this.customers.splice(index, 1);
    return { message: `Customer ${id} deleted`, customer: removed };
  }
}

export const customersService = new CustomersService();
