import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { seedInventory } from '../../common/seed/seed-data';
import { UpdateInventoryDto, AdjustStockDto } from './dto/inventory.dto';

/**
 * InventoryService: Monitors and manages stock levels.
 * It automatically updates the stock status (In Stock, Low Stock, etc.)
 * based on current availability vs. reorder levels.
 */
@Injectable()
export class InventoryService {
  // In-memory inventory list seeded from project data
  private inventory = seedInventory.map((i) => ({ ...i }));

  /**
   * Helper to automatically determine stock status.
   */
  private computeStatus(stock: number, reorderLevel: number): string {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= reorderLevel * 0.5) return 'Critical';
    if (stock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  findAll() {
    return this.inventory;
  }

  findOne(id: string) {
    const item = this.inventory.find((i) => i.id === id);
    if (!item) throw new NotFoundException(`Inventory item ${id} not found`);
    return item;
  }

  findByProduct(productId: string) {
    const item = this.inventory.find((i) => i.productId === productId);
    if (!item)
      throw new NotFoundException(
        `No inventory record for product ${productId}`,
      );
    return item;
  }

  findLowStock() {
    return this.inventory.filter(
      (i) =>
        i.status === 'Low Stock' ||
        i.status === 'Critical' ||
        i.status === 'Out of Stock',
    );
  }

  update(id: string, dto: UpdateInventoryDto) {
    const idx = this.inventory.findIndex((i) => i.id === id);
    if (idx === -1)
      throw new NotFoundException(`Inventory item ${id} not found`);
    const updated = {
      ...this.inventory[idx],
      ...dto,
      lastUpdated: new Date().toISOString(),
    };
    updated.status = this.computeStatus(
      updated.stockAvailable,
      updated.reorderLevel,
    );
    this.inventory[idx] = updated;
    return this.inventory[idx];
  }

  adjustStock(dto: AdjustStockDto) {
    const idx = this.inventory.findIndex((i) => i.productId === dto.productId);
    if (idx === -1)
      throw new NotFoundException(`No inventory for product ${dto.productId}`);
    const newStock = this.inventory[idx].stockAvailable + dto.adjustment;
    if (newStock < 0) throw new BadRequestException('Stock cannot go below 0');
    this.inventory[idx].stockAvailable = newStock;
    this.inventory[idx].status = this.computeStatus(
      newStock,
      this.inventory[idx].reorderLevel,
    );
    this.inventory[idx].lastUpdated = new Date().toISOString();
    return this.inventory[idx];
  }
}
