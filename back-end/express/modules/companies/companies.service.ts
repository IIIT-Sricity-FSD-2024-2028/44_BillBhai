import { seedCompanies } from '../../data/seed-data';
import { Company } from '../../data/entities';
import { ConflictError, NotFoundError } from '../../errors/http-error';
import {
  CreateCompanyDto,
  DeleteCompanyResult,
  UpdateCompanyDto,
} from './companies.schema';

/**
 * Companies Module Service
 *
 * Owns the tenant (business) store. Framework agnostic: no express imports, no
 * request or response objects, no HTTP status codes.
 *
 * Ids follow the legacy `BIZ-<100 + n>` sequence so that seeded records and
 * newly created ones share one numbering scheme.
 */
export class CompaniesService {
  private companies: Company[];
  private counter: number;

  constructor() {
    this.companies = seedCompanies.map((company) => ({ ...company }));
    this.counter = this.companies.length + 1;
  }

  public findAll(): Company[] {
    return [...this.companies];
  }

  public findOne(id: string): Company {
    const company = this.companies.find((entry) => entry.id === id);
    if (!company) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    return company;
  }

  public create(dto: CreateCompanyDto): Company {
    const clash = this.companies.find(
      (company) => company.email === dto.email || company.name === dto.name,
    );
    if (clash) {
      throw new ConflictError('Company name or email already in use');
    }

    const created: Company = {
      id: `BIZ-${String(100 + this.counter++)}`,
      name: dto.name,
      owner: dto.owner || '',
      adminName: dto.adminName || '',
      type: dto.type || '',
      email: dto.email,
      phone: dto.phone,
      gstNo: dto.gstNo || '',
      address: dto.address || '',
      status: dto.status || 'Active',
      productsPlan: dto.productsPlan || '',
      tenureMonths: dto.tenureMonths || 0,
      storesCount: dto.storesCount || 1,
      profit: 0,
      paymentDue: 0,
    };

    this.companies.push(created);
    return created;
  }

  public update(id: string, dto: UpdateCompanyDto): Company {
    const index = this.companies.findIndex((company) => company.id === id);
    if (index === -1) {
      throw new NotFoundError(`Company ${id} not found`);
    }

    this.companies[index] = { ...this.companies[index], ...dto };
    return this.companies[index];
  }

  public remove(id: string): DeleteCompanyResult {
    const index = this.companies.findIndex((company) => company.id === id);
    if (index === -1) {
      throw new NotFoundError(`Company ${id} not found`);
    }

    const [removed] = this.companies.splice(index, 1);
    return { message: `Company ${id} deleted`, company: removed };
  }
}

export const companiesService = new CompaniesService();
