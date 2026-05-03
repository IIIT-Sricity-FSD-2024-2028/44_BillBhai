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
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateBillDto,
  CreatePaymentDto,
} from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

/**
 * OrdersController: Exposes REST endpoints for the POS system.
 * Handles the complete lifecycle from order placement to bill generation and final payment.
 */
@Controller('orders')
@ApiTags('Orders')
@ApiSecurity('x-role')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Orders - General Operations ──
  @Get()
  @Roles('superuser', 'admin', 'cashier', 'returnhandler')
  @ApiOperation({ summary: 'List orders' })
  findAll(@Query('companyId') companyId?: string) {
    return this.ordersService.findAllOrders(companyId);
  }

  @Post()
  @Roles('superuser', 'admin', 'cashier', 'customer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create order' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  // ── Bills - Specific Routes BEFORE generic :id ──
  @Get('bills/all')
  @Roles('superuser', 'admin', 'cashier')
  @ApiOperation({ summary: 'List bills' })
  findAllBills() {
    return this.ordersService.findAllBills();
  }

  @Post('bills')
  @Roles('superuser', 'admin', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create bill for an order' })
  createBill(@Body() dto: CreateBillDto) {
    return this.ordersService.createBill(dto);
  }

  @Get('bills/:billNo')
  @Roles('superuser', 'admin', 'cashier')
  @ApiOperation({ summary: 'Get bill by bill number' })
  findOneBill(@Param('billNo') billNo: string) {
    return this.ordersService.findOneBill(billNo);
  }

  // ── Payments - Specific Routes BEFORE generic :id ──
  @Get('payments/all')
  @Roles('superuser', 'admin', 'cashier')
  @ApiOperation({ summary: 'List payments' })
  findAllPayments() {
    return this.ordersService.findAllPayments();
  }

  @Post('payments')
  @Roles('superuser', 'admin', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record payment for a bill' })
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.ordersService.createPayment(dto);
  }

  @Get('payments/:billNo')
  @Roles('superuser', 'admin', 'cashier')
  @ApiOperation({ summary: 'Get payment by bill number' })
  findOnePayment(@Param('billNo') billNo: string) {
    return this.ordersService.findOnePayment(billNo);
  }

  // ── Order Details - Generic routes LAST ──
  @Get(':id')
  @Roles('superuser', 'admin', 'cashier', 'returnhandler', 'deliveryops')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOneOrder(id);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'cashier')
  @ApiOperation({ summary: 'Update order status or payment details' })
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.updateOrder(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Delete order' })
  remove(@Param('id') id: string) {
    return this.ordersService.removeOrder(id);
  }
}
