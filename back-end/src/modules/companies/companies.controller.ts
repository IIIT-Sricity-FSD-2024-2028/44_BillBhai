import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * CompaniesController: Handles all business-tenant operations.
 * This module is primarily accessible by the 'superuser' role for platform-wide management.
 */
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('superuser')
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @Roles('superuser', 'admin')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles('superuser')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Put(':id')
  @Roles('superuser')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
