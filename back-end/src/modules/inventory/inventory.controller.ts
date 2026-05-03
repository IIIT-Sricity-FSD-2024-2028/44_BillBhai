import { Controller, Get, Put, Post, Delete, Param, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto, AdjustStockDto } from './dto/inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

/**
 * InventoryController: REST endpoints for tracking warehouse stock.
 * Includes features for highlighting low-stock items.
 */
@Controller('inventory')
@ApiTags('Inventory')
@ApiSecurity('x-role')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('superuser', 'admin', 'inventorymanager', 'cashier')
  @ApiOperation({ summary: 'List inventory records' })
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('low-stock')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'List low stock items' })
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get('product/:productId')
  @Roles('superuser', 'admin', 'inventorymanager', 'cashier')
  @ApiOperation({ summary: 'Get inventory by product ID' })
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findByProduct(productId);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Get inventory record by ID' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Update inventory record' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventoryService.update(id, dto);
  }

  @Post('adjust')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Adjust inventory stock for a product' })
  adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Delete inventory record' })
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
