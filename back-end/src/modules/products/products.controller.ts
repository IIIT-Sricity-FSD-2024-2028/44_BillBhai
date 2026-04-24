import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  findAll(@Query('category') category?: string) {
    return this.productsService.findAll(category);
  }

  @Get('categories')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get('barcode/:barcode')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager')
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'inventorymanager')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
