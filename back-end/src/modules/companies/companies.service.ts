import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { seedCompanies } from '../../common/seed/seed-data';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

/**
 * CompaniesService: Manages business profiles in-memory.
 * Seedes initial data from seed-data.ts.
 */
@Injectable()
export class CompaniesService {
  // Initialize in-memory store with seed data
  private companies = seedCompanies.map((c) => ({ ...c }));
  private counter = 105; // Starting point for new BIZ IDs

  findAll() {
    return this.companies;
  }

  findOne(id: string) {
    const company = this.companies.find((c) => c.id === id);
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }

  create(dto: CreateCompanyDto) {
    const exists = this.companies.find((c) => c.email === dto.email);
    if (exists)
      throw new ConflictException('A company with this email already exists');
    const newCompany = {
      ...dto,
      id: `BIZ-${this.counter++}`,
      gstNo: dto.gstNo || 'PENDING',
      address: dto.address || 'Not Provided',
      status: 'Active',
      profit: 0,
      paymentDue: 0,
      tenureMonths: dto.tenureMonths ?? 0,
      storesCount: dto.storesCount ?? 1,
      productsPlan: dto.productsPlan ?? 'Billing Starter',
      users: Array.isArray(dto.users) ? dto.users : [],
      stores: Array.isArray(dto.stores) ? dto.stores : [],
      payments: Array.isArray(dto.payments) ? dto.payments : [],
    };
    this.companies.push(newCompany);
    return newCompany;
  }

  update(id: string, dto: UpdateCompanyDto) {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Company ${id} not found`);
    this.companies[idx] = { ...this.companies[idx], ...dto };
    return this.companies[idx];
  }

  remove(id: string) {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Company ${id} not found`);
    const [removed] = this.companies.splice(idx, 1);
    return { message: `Company ${id} deleted`, company: removed };
  }
}
