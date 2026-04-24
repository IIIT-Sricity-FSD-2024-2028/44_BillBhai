import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('superuser', 'admin', 'cashier')
  findAll(@Query('companyId') companyId?: string) {
    return this.customersService.findAll(companyId);
  }

  @Get('phone/:phone')
  @Roles('superuser', 'admin', 'cashier', 'customer')
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'cashier')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'cashier', 'customer')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'cashier', 'customer')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
