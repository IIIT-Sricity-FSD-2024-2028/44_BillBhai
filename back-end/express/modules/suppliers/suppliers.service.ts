import { seedSuppliers } from '../../data/seed-data';
import { Supplier } from '../../data/entities';
import { ConflictError, NotFoundError } from '../../errors/http-error';
import { activityService, ActivityService } from '../activity/activity.service';
import { bumped, checkVersion, diff, initialStamp } from '../../utils/versioning';
import { CreateSupplierDto, DeleteSupplierResult, UpdateSupplierDto } from './suppliers.schema';

/**
 * Suppliers Module Service
 *
 * Each business keeps its own supplier list. Names are unique within a
 * business. A supplier still linked to products cannot be deleted (the
 * controller checks the product list before calling remove()).
 */
export class SuppliersService {
  private suppliers: Supplier[];

  constructor(private readonly activity: ActivityService = activityService) {
    this.suppliers = seedSuppliers.map((s) => ({ ...s }));
  }

  private nextId(): string {
    const highest = this.suppliers.reduce(
      (max, s) => Math.max(max, Number(s.id.replace(/\D/g, '')) || 0),
      0,
    );
    // BIZ-102 uses the 1xx range; keep new ids clear of every existing one.
    return `SUP-${String(highest + 1).padStart(3, '0')}`;
  }

  private assertUniqueName(companyId: string, name: string, exceptId?: string): void {
    const needle = name.trim().toLowerCase();
    const clash = this.suppliers.find(
      (s) => s.companyId === companyId && s.id !== exceptId && s.name.trim().toLowerCase() === needle,
    );
    if (clash) throw new ConflictError(`A supplier called "${clash.name}" already exists (${clash.id})`);
  }

  public findAll(companyId?: string): Supplier[] {
    return this.suppliers
      .filter((s) => (companyId ? s.companyId === companyId : true))
      .map((s) => ({ ...s }));
  }

  public findOne(id: string): Supplier {
    const found = this.suppliers.find((s) => s.id === id);
    if (!found) throw new NotFoundError(`Supplier ${id} not found`);
    return { ...found };
  }

  public create(dto: CreateSupplierDto & { companyId: string }, by = 'system'): Supplier {
    this.assertUniqueName(dto.companyId, dto.name);
    const created: Supplier = {
      id: this.nextId(),
      companyId: dto.companyId,
      name: dto.name.trim(),
      contactPerson: dto.contactPerson?.trim() || '',
      mobileNo: dto.mobileNo,
      email: dto.email || '',
      address: dto.address?.trim() || '',
      gstNo: dto.gstNo || '',
      leadTimeDays: dto.leadTimeDays ?? 2,
      moq: dto.moq ?? 0,
      ...initialStamp(by),
    };
    this.suppliers.push(created);
    this.activity.log({
      companyId: created.companyId,
      entity: 'supplier',
      entityId: created.id,
      action: 'create',
      summary: `Supplier ${created.name} added`,
      by,
    });
    return { ...created };
  }

  public update(id: string, dto: UpdateSupplierDto, by = 'system'): Supplier {
    const index = this.suppliers.findIndex((s) => s.id === id);
    if (index === -1) throw new NotFoundError(`Supplier ${id} not found`);
    const current = this.suppliers[index];
    checkVersion(current, dto.version, `Supplier ${id}`);
    if (dto.name) this.assertUniqueName(current.companyId, dto.name, id);
    const { version: _v, ...changes } = dto;
    const updated = bumped({ ...current, ...changes }, by);
    this.suppliers[index] = updated;
    const changed = diff(current, updated, ['name', 'contactPerson', 'mobileNo', 'email', 'address', 'gstNo', 'leadTimeDays', 'moq']);
    if (Object.keys(changed).length) {
      this.activity.log({
        companyId: current.companyId,
        entity: 'supplier',
        entityId: id,
        action: 'update',
        summary: `Supplier ${updated.name} updated (${Object.keys(changed).join(', ')})`,
        changes: changed,
        by,
      });
    }
    return { ...updated };
  }

  public remove(id: string, by = 'system'): DeleteSupplierResult {
    const index = this.suppliers.findIndex((s) => s.id === id);
    if (index === -1) throw new NotFoundError(`Supplier ${id} not found`);
    const [removed] = this.suppliers.splice(index, 1);
    this.activity.log({
      companyId: removed.companyId,
      entity: 'supplier',
      entityId: id,
      action: 'delete',
      summary: `Supplier ${removed.name} deleted`,
      by,
    });
    return { message: `Supplier ${id} deleted`, supplier: removed };
  }

  public dump(): { suppliers: Supplier[] } {
    return { suppliers: this.suppliers };
  }

  public load(state: { suppliers?: Supplier[] }): void {
    if (Array.isArray(state.suppliers)) this.suppliers = state.suppliers;
  }
}

export const suppliersService = new SuppliersService();
