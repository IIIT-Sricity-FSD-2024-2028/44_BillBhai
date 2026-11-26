import { seedCustomers, WALK_IN_CUSTOMER_IDS } from '../../data/seed-data';
import { Customer } from '../../data/entities';
import { ConflictError, NotFoundError } from '../../errors/http-error';
import { normalisePhone } from '../../utils/money';
import { bumped, checkVersion, initialStamp } from '../../utils/versioning';
import { CreateCustomerDto, DeleteCustomerResult, UpdateCustomerDto } from './customers.schema';

export interface SaleCustomerInput {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

/**
 * Customers Module Service
 *
 * A phone number identifies one customer within a business. Customers who
 * give no phone share the business's single "Walk-in Customer" record, so
 * anonymous counter sales no longer create a new made-up customer each time.
 */
export class CustomersService {
  private customers: Customer[];

  constructor() {
    this.customers = seedCustomers.map((customer) => ({ ...customer }));
  }

  private nextId(): string {
    const highest = this.customers
      .filter((c) => !/^CUS-9\d\d$/.test(c.id))
      .reduce((max, c) => Math.max(max, Number(c.id.replace(/\D/g, '')) || 0), 0);
    let n = highest + 1;
    while (this.customers.some((c) => c.id === `CUS-${String(n).padStart(3, '0')}`) || (n >= 900 && n < 1000)) n += 1;
    return `CUS-${String(n).padStart(3, '0')}`;
  }

  public findAll(companyId?: string): Customer[] {
    return this.customers
      .filter((c) => (companyId ? c.companyId === companyId : true))
      .map((c) => ({ ...c }));
  }

  public findOne(id: string): Customer {
    const customer = this.customers.find((entry) => entry.id === id);
    if (!customer) {
      throw new NotFoundError(`Customer ${id} not found`);
    }
    return { ...customer };
  }

  public findByPhone(phone: string, companyId?: string): Customer {
    const needle = normalisePhone(phone);
    const found = needle
      ? this.customers.find(
          (c) => c.mobileNo === needle && (companyId ? c.companyId === companyId : true),
        )
      : undefined;
    if (!found) {
      throw new NotFoundError(`Customer with phone ${phone} not found`);
    }
    return { ...found };
  }

  /** The shared walk-in record for a business, created on first use. */
  public walkIn(companyId: string): Customer {
    const knownId = WALK_IN_CUSTOMER_IDS[companyId];
    const existing = this.customers.find(
      (c) => c.companyId === companyId && (c.id === knownId || (c.name === 'Walk-in Customer' && !c.mobileNo)),
    );
    if (existing) return { ...existing };
    const created: Customer = {
      id: this.nextId(),
      companyId,
      name: 'Walk-in Customer',
      mobileNo: '',
      email: '',
      address: '',
      ...initialStamp('system'),
    };
    this.customers.push(created);
    return { ...created };
  }

  public create(dto: CreateCustomerDto & { companyId: string }, by = 'system'): Customer {
    const phone = normalisePhone(dto.mobileNo);
    const clash = this.customers.find((c) => c.companyId === dto.companyId && c.mobileNo === phone);
    if (clash) {
      throw new ConflictError(`${clash.name} (${clash.id}) already uses phone ${phone}`);
    }
    const created: Customer = {
      id: this.nextId(),
      companyId: dto.companyId,
      name: (dto.name ?? '').trim() || 'Customer',
      mobileNo: phone,
      email: dto.email ?? '',
      address: (dto.address ?? '').trim(),
      ...initialStamp(by),
    };
    this.customers.push(created);
    return { ...created };
  }

  /**
   * Customer for a sale. Looks the phone up within the business; fills in only
   * blank details of an existing customer (a different name typed at the till
   * does not overwrite the saved one); creates the customer when the phone is
   * new; falls back to the walk-in record when no phone is given.
   */
  public resolveForSale(companyId: string, input: SaleCustomerInput, by = 'system'): Customer {
    let index = -1;
    if (input.id) {
      index = this.customers.findIndex((c) => c.id === input.id && c.companyId === companyId);
    }
    if (index === -1) {
      const phone = normalisePhone(input.phone);
      if (!phone) return this.walkIn(companyId);
      index = this.customers.findIndex((c) => c.companyId === companyId && c.mobileNo === phone);
      if (index === -1) {
        return this.create(
          { companyId, mobileNo: phone, name: input.name, email: input.email, address: input.address },
          by,
        );
      }
    }
    const current = this.customers[index];
    const fill: Partial<Customer> = {};
    if (!current.email && input.email) fill.email = input.email.trim();
    if (!current.address && input.address) fill.address = input.address.trim();
    if ((!current.name || current.name === 'Customer') && input.name) fill.name = input.name.trim();
    if (Object.keys(fill).length) {
      this.customers[index] = bumped({ ...current, ...fill }, by);
    }
    return { ...this.customers[index] };
  }

  public update(id: string, dto: UpdateCustomerDto, by = 'system'): Customer {
    const index = this.customers.findIndex((customer) => customer.id === id);
    if (index === -1) {
      throw new NotFoundError(`Customer ${id} not found`);
    }
    const current = this.customers[index];
    checkVersion(current, dto.version, `Customer ${id}`);
    const { version: _v, companyId: _c, ...changes } = dto;
    if (changes.mobileNo !== undefined) {
      const phone = normalisePhone(changes.mobileNo);
      const clash = this.customers.find(
        (c) => c.companyId === current.companyId && c.id !== id && c.mobileNo === phone,
      );
      if (clash) throw new ConflictError(`${clash.name} (${clash.id}) already uses phone ${phone}`);
      changes.mobileNo = phone;
    }
    this.customers[index] = bumped({ ...current, ...changes }, by);
    return { ...this.customers[index] };
  }

  public remove(id: string): DeleteCustomerResult {
    const index = this.customers.findIndex((customer) => customer.id === id);
    if (index === -1) {
      throw new NotFoundError(`Customer ${id} not found`);
    }
    const [removed] = this.customers.splice(index, 1);
    return { message: `Customer ${id} deleted`, customer: removed };
  }

  public dump(): { customers: Customer[] } {
    return { customers: this.customers };
  }

  public load(state: { customers?: Customer[] }): void {
    if (Array.isArray(state.customers)) this.customers = state.customers;
  }
}

export const customersService = new CustomersService();
