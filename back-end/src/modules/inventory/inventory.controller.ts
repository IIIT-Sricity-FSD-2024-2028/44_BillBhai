import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto, AdjustStockDto } from './dto/inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * InventoryController: REST endpoints for tracking warehouse stock.
 * Includes features for highlighting low-stock items.
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('superuser', 'admin', 'inventorymanager', 'cashier')
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('low-stock')
  @Roles('superuser', 'admin', 'inventorymanager')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get('product/:productId')
  @Roles('superuser', 'admin', 'inventorymanager', 'cashier')
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findByProduct(productId);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventoryService.update(id, dto);
  }

  @Post('adjust')
  @Roles('superuser', 'admin', 'inventorymanager')
  adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }
}
