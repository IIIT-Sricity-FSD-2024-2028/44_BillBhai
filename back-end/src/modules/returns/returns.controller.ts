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
import { ReturnsService } from './returns.service';
import { CreateReturnDto, UpdateReturnDto } from './dto/return.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('returns')
@ApiTags('Returns')
@ApiSecurity('x-role')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @Roles('superuser', 'admin', 'returnhandler')
  @ApiOperation({ summary: 'List returns' })
  findAll(@Query('status') status?: string) {
    return this.returnsService.findAll(status);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'returnhandler')
  @ApiOperation({ summary: 'Get return by ID' })
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'returnhandler', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create return request' })
  create(@Body() dto: CreateReturnDto) {
    return this.returnsService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'returnhandler')
  @ApiOperation({ summary: 'Update return status/details' })
  update(@Param('id') id: string, @Body() dto: UpdateReturnDto) {
    return this.returnsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Delete return request' })
  remove(@Param('id') id: string) {
    return this.returnsService.remove(id);
  }
}
