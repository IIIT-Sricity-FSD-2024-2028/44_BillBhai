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
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto, UpdateDeliveryDto } from './dto/delivery.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('deliveries')
@ApiTags('Deliveries')
@ApiSecurity('x-role')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @Roles('superuser', 'admin', 'deliveryops')
  @ApiOperation({ summary: 'List deliveries' })
  findAll(@Query('status') status?: string) {
    return this.deliveriesService.findAll(status);
  }

  @Get('order/:orderId')
  @Roles('superuser', 'admin', 'deliveryops', 'cashier')
  @ApiOperation({ summary: 'Get delivery by order ID' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.deliveriesService.findByOrder(orderId);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'deliveryops')
  @ApiOperation({ summary: 'Get delivery by ID' })
  findOne(@Param('id') id: string) {
    return this.deliveriesService.findOne(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'deliveryops', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create delivery' })
  create(@Body() dto: CreateDeliveryDto) {
    return this.deliveriesService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'deliveryops')
  @ApiOperation({ summary: 'Update delivery status/details' })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryDto) {
    return this.deliveriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Delete delivery' })
  remove(@Param('id') id: string) {
    return this.deliveriesService.remove(id);
  }
}
