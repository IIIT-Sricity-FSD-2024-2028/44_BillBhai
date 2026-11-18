import { seedInventory, seedStockMovements } from '../../data/seed-data';
import { InventoryItem, StockMovement, StockMovementType } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import { activityService, ActivityService } from '../activity/activity.service';
import { bumped, checkVersion, nowIso } from '../../utils/versioning';
import {
  CreateInventoryDto,
  DeleteInventoryResult,
  InventoryStatus,
  LOW_STOCK_STATUSES,
  UpdateInventoryDto,
} from './inventory.schema';

export interface MoveOptions {
  type: StockMovementType;
  reason: string;
  by: string;
  refType?: string;
  refId?: string;
  /** Allow the move to take stock below zero (never used by sales). */
  allowNegative?: boolean;
}

/**
 * Inventory Module Service
 *
 * Owns the stock ledger. `stockAvailable` only ever changes through move(),
 * which writes a StockMovement saying why (sale, return, cancellation, goods
 * received, adjustment), who did it and the balance after. Status is always
 * derived from the count against the reorder level and recomputed on every
 * change, so a client can never push a stock state that contradicts the
 * numbers.
 */
export class InventoryService {
  private inventory: InventoryItem[];
  private movements: StockMovement[];
  private movementCounter: number;

  constructor(private readonly activity: ActivityService = activityService) {
    this.inventory = seedInventory.map((item) => ({ ...item }));
    this.movements = seedStockMovements.map((m) => ({ ...m }));
    this.movementCounter = this.movements.length + 1;
  }

  private clone(item: InventoryItem): InventoryItem {
    return { ...item };
  }

  /** The single source of truth for a stock state. */
  public computeStatus(stock: number, reorderLevel: number): InventoryStatus {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= reorderLevel * 0.5) return 'Critical';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  public findAll(companyId?: string): InventoryItem[] {
    return this.inventory
      .filter((item) => (companyId ? item.companyId === companyId : true))
      .map((item) => this.clone(item));
  }

  public findOne(id: string): InventoryItem {
    const item = this.inventory.find((entry) => entry.id === id);
    if (!item) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }
    return this.clone(item);
  }

  public findByProduct(productId: string): InventoryItem {
    const item = this.inventory.find((entry) => entry.productId === productId);
    if (!item) {
      throw new NotFoundError(`No inventory record for product ${productId}`);
    }
    return this.clone(item);
  }

  public findLowStock(companyId?: string): InventoryItem[] {
    const lowStock: readonly string[] = LOW_STOCK_STATUSES;
    return this.findAll(companyId).filter((item) => lowStock.includes(item.status));
  }

  /** Opens the stock row for a product. Each product has exactly one. */
  public create(dto: CreateInventoryDto & { companyId: string }, by = 'system'): InventoryItem {
    if (this.inventory.some((item) => item.productId === dto.productId)) {
      throw new ConflictError(`Product ${dto.productId} already has an inventory record`);
    }

    const highest = this.inventory.reduce((max, item) => {
      const n = Number.parseInt(item.id.replace(/^INV-/i, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const at = nowIso();
    const created: InventoryItem = {
      id: `INV-${String(highest + 1).padStart(3, '0')}`,
      companyId: dto.companyId,
      productId: dto.productId,
      stockAvailable: 0,
      reorderLevel: dto.reorderLevel,
      location: dto.location,
      lastUpdated: at,
      status: this.computeStatus(0, dto.reorderLevel),
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedBy: by,
    };
    this.inventory.push(created);
    if (dto.stockAvailable > 0) {
      this.move(dto.productId, dto.stockAvailable, { type: 'opening', reason: 'Opening stock', by });
    }
    return this.findByProduct(dto.productId);
  }

  /**
   * Changes the shelf settings of a row. The count itself is NOT editable
   * here: an absolute number typed on a screen that was opened an hour ago
   * would undo every sale since. Stock changes go through adjust() or
   * receive(), which apply a +/- change to the current count.
   */
  public update(id: string, dto: UpdateInventoryDto, by = 'system'): InventoryItem {
    const index = this.inventory.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }
    const current = this.inventory[index];
    checkVersion(current, dto.version, `Stock record ${id}`);
    const { version: _v, ...changes } = dto;
    const updated: InventoryItem = bumped(
      { ...current, ...changes, lastUpdated: nowIso() },
      by,
    );
    updated.status = this.computeStatus(updated.stockAvailable, updated.reorderLevel);
    this.inventory[index] = updated;
    this.activity.log({
      companyId: current.companyId,
      entity: 'product',
      entityId: current.productId,
      action: 'stock-settings',
      summary: `Reorder level ${current.reorderLevel} → ${updated.reorderLevel}, location "${current.location}" → "${updated.location}"`,
      by,
    });
    return this.clone(updated);
  }

  /**
   * The only way the count changes. Applies a signed delta, refuses to go
   * below zero unless told otherwise, and writes a ledger entry.
   */
  public move(productId: string, delta: number, options: MoveOptions): InventoryItem {
    const index = this.inventory.findIndex((item) => item.productId === productId);
    if (index === -1) {
      throw new NotFoundError(`No inventory for product ${productId}`);
    }
    const current = this.inventory[index];
    const next = current.stockAvailable + delta;
    if (next < 0 && !options.allowNegative) {
      throw new ConflictError(
        current.stockAvailable === 0
          ? `${productId} is out of stock`
          : `Only ${current.stockAvailable} left in stock for ${productId}`,
      );
    }
    const at = nowIso();
    const updated: InventoryItem = {
      ...current,
      stockAvailable: next,
      status: this.computeStatus(next, current.reorderLevel),
      lastUpdated: at,
      version: Number(current.version ?? 1) + 1,
      updatedAt: at,
      updatedBy: options.by,
    };
    this.inventory[index] = updated;
    this.movements.push({
      id: `MOV-${String(this.movementCounter++).padStart(5, '0')}`,
      companyId: current.companyId,
      productId,
      type: options.type,
      quantity: delta,
      balanceAfter: next,
      reason: options.reason,
      refType: options.refType,
      refId: options.refId,
      by: options.by,
      at,
    });
    return this.clone(updated);
  }

  /** Manual correction (damage, expiry, count mismatch). A reason is required. */
  public adjustStock(
    dto: { productId: string; adjustment: number; reason?: string },
    by = 'system',
  ): InventoryItem {
    const reason = String(dto.reason || '').trim();
    if (!reason) throw new BadRequestError('A reason is required for a stock adjustment');
    const current = this.findByProduct(dto.productId);
    if (current.stockAvailable + dto.adjustment < 0) {
      throw new BadRequestError(
        `Stock cannot go below 0 (on hand ${current.stockAvailable}, change ${dto.adjustment})`,
      );
    }
    return this.move(dto.productId, dto.adjustment, { type: 'adjust', reason, by });
  }

  /** Goods received from a supplier. */
  public receive(
    dto: { productId: string; quantity: number; supplierId?: string; note?: string },
    by = 'system',
  ): InventoryItem {
    const note = String(dto.note || '').trim();
    return this.move(dto.productId, dto.quantity, {
      type: 'receive',
      reason: note || (dto.supplierId ? `Received from ${dto.supplierId}` : 'Goods received'),
      refType: dto.supplierId ? 'supplier' : undefined,
      refId: dto.supplierId,
      by,
    });
  }

  /** Units on hand for a product, or null when the product has no stock row. */
  public stockFor(productId: string): number | null {
    const row = this.inventory.find((item) => item.productId === productId);
    return row ? row.stockAvailable : null;
  }

  /** Takes sold units off the shelf. The sale is refused if stock is short. */
  public consumeStock(
    productId: string,
    quantity: number,
    meta: { by?: string; refId?: string } = {},
  ): InventoryItem {
    return this.move(productId, -Math.max(0, quantity), {
      type: 'sale',
      reason: meta.refId ? `Sold on ${meta.refId}` : 'Sale',
      refType: 'order',
      refId: meta.refId,
      by: meta.by ?? 'system',
    });
  }

  public findMovements(filter: {
    companyId?: string;
    productId?: string;
    type?: string;
    limit?: number;
  }): StockMovement[] {
    const limit = Math.min(1000, Math.max(1, Number(filter.limit) || 200));
    return this.movements
      .filter((m) => (filter.companyId ? m.companyId === filter.companyId : true))
      .filter((m) => (filter.productId ? m.productId === filter.productId : true))
      .filter((m) => (filter.type ? m.type === filter.type : true))
      .slice()
      .reverse()
      .slice(0, limit)
      .map((m) => ({ ...m }));
  }

  public remove(id: string): DeleteInventoryResult {
    const index = this.inventory.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }
    if (this.inventory[index].stockAvailable > 0) {
      throw new ConflictError(
        'This product still has stock on the shelf. Adjust it to 0 or deactivate the product instead.',
      );
    }
    const [removed] = this.inventory.splice(index, 1);
    return { message: `Inventory item ${id} deleted`, inventory: removed };
  }

  public dump(): { inventory: InventoryItem[]; movements: StockMovement[]; movementCounter: number } {
    return { inventory: this.inventory, movements: this.movements, movementCounter: this.movementCounter };
  }

  public load(state: { inventory?: InventoryItem[]; movements?: StockMovement[]; movementCounter?: number }): void {
    if (Array.isArray(state.inventory)) this.inventory = state.inventory;
    if (Array.isArray(state.movements)) this.movements = state.movements;
    this.movementCounter = Number(state.movementCounter) || this.movements.length + 1;
  }
}

export const inventoryService = new InventoryService();
