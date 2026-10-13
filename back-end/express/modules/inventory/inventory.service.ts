import { seedInventory } from '../../data/seed-data';
import { InventoryItem } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/http-error';
import {
  AdjustStockDto,
  CreateInventoryDto,
  DeleteInventoryResult,
  InventoryStatus,
  LOW_STOCK_STATUSES,
  UpdateInventoryDto,
} from './inventory.schema';

/**
 * Inventory Module Service
 *
 * Owns the stock ledger. Framework agnostic: no express imports, no request or
 * response objects, no HTTP status codes.
 *
 * Business rule: `status` is always DERIVED from stockAvailable against
 * reorderLevel and is recomputed on every write, so a client can never push a
 * stock state that contradicts the numbers.
 */
export class InventoryService {
  private inventory: InventoryItem[];

  constructor() {
    this.inventory = seedInventory.map((item) => ({ ...item }));
  }

  private clone(item: InventoryItem): InventoryItem {
    return { ...item };
  }

  /** The single source of truth for a stock state. */
  private computeStatus(stock: number, reorderLevel: number): InventoryStatus {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= reorderLevel * 0.5) return 'Critical';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  public findAll(): InventoryItem[] {
    return this.inventory.map((item) => this.clone(item));
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

  public findLowStock(): InventoryItem[] {
    const lowStock: readonly string[] = LOW_STOCK_STATUSES;
    return this.inventory
      .filter((item) => lowStock.includes(item.status))
      .map((item) => this.clone(item));
  }

  /** Opens the stock row for a product. Each product has at most one. */
  public create(dto: CreateInventoryDto): InventoryItem {
    if (this.inventory.some((item) => item.productId === dto.productId)) {
      throw new ConflictError(`Product ${dto.productId} already has an inventory record`);
    }

    const highest = this.inventory.reduce((max, item) => {
      const n = Number.parseInt(item.id.replace(/^INV-/i, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);

    const created: InventoryItem = {
      id: `INV-${String(highest + 1).padStart(3, '0')}`,
      productId: dto.productId,
      stockAvailable: dto.stockAvailable,
      reorderLevel: dto.reorderLevel,
      location: dto.location,
      lastUpdated: new Date().toISOString(),
      status: this.computeStatus(dto.stockAvailable, dto.reorderLevel),
    };

    this.inventory.push(created);
    return this.clone(created);
  }

  public update(id: string, dto: UpdateInventoryDto): InventoryItem {
    const index = this.inventory.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }

    const updated: InventoryItem = {
      ...this.inventory[index],
      ...dto,
      lastUpdated: new Date().toISOString(),
    };
    updated.status = this.computeStatus(updated.stockAvailable, updated.reorderLevel);

    this.inventory[index] = updated;
    return this.clone(updated);
  }

  /**
   * Applies a signed delta to the stock held for a PRODUCT id (not an
   * inventory id), refusing anything that would drive the count negative.
   */
  public adjustStock(dto: AdjustStockDto): InventoryItem {
    const index = this.inventory.findIndex(
      (item) => item.productId === dto.productId,
    );
    if (index === -1) {
      throw new NotFoundError(`No inventory for product ${dto.productId}`);
    }

    const newStock = this.inventory[index].stockAvailable + dto.adjustment;
    if (newStock < 0) {
      throw new BadRequestError('Stock cannot go below 0');
    }

    const adjusted: InventoryItem = {
      ...this.inventory[index],
      stockAvailable: newStock,
      status: this.computeStatus(newStock, this.inventory[index].reorderLevel),
      lastUpdated: new Date().toISOString(),
    };

    this.inventory[index] = adjusted;
    return this.clone(adjusted);
  }

  public remove(id: string): DeleteInventoryResult {
    const index = this.inventory.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }

    const [removed] = this.inventory.splice(index, 1);
    return { message: `Inventory item ${id} deleted`, inventory: removed };
  }
}

export const inventoryService = new InventoryService();
