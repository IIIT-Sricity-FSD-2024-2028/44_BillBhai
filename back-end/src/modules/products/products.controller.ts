import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('products')
@ApiTags('Products')
@ApiSecurity('x-role')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  @ApiOperation({ summary: 'List products' })
  findAll(@Query('category') category?: string) {
    return this.productsService.findAll(category);
  }

  @Get('categories')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  @ApiOperation({ summary: 'List product categories' })
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get('barcode/:barcode')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager')
  @ApiOperation({ summary: 'Get product by barcode' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'inventorymanager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create product' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Delete product' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
