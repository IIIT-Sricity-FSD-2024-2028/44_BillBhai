import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

/**
 * CompaniesController: Handles all business-tenant operations.
 * This module is primarily accessible by the 'superuser' role for platform-wide management.
 */
@Controller('companies')
@ApiTags('Companies')
@ApiSecurity('x-role')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('superuser')
  @ApiOperation({ summary: 'List all companies' })
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Get company by ID' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles('superuser')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create company' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Put(':id')
  @Roles('superuser')
  @ApiOperation({ summary: 'Update company' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser')
  @ApiOperation({ summary: 'Delete company' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
