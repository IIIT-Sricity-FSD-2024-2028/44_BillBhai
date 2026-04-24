import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, CreateBillDto, CreatePaymentDto } from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * OrdersController: Exposes REST endpoints for the POS system.
 * Handles the complete lifecycle from order placement to bill generation and final payment.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Orders ──
  @Get()
  @Roles('superuser', 'admin', 'cashier', 'returnhandler')
  findAll(@Query('companyId') companyId?: string) {
    return this.ordersService.findAllOrders(companyId);
  }

  @Get(':id')
  @Roles('superuser', 'admin', 'cashier', 'returnhandler', 'deliveryops')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOneOrder(id);
  }

  @Post()
  @Roles('superuser', 'admin', 'cashier', 'customer')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Put(':id')
  @Roles('superuser', 'admin', 'cashier')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.updateOrder(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'admin')
  remove(@Param('id') id: string) {
    return this.ordersService.removeOrder(id);
  }

  // ── Bills ──
  @Get('bills/all')
  @Roles('superuser', 'admin', 'cashier')
  findAllBills() {
    return this.ordersService.findAllBills();
  }

  @Get('bills/:billNo')
  @Roles('superuser', 'admin', 'cashier')
  findOneBill(@Param('billNo') billNo: string) {
    return this.ordersService.findOneBill(billNo);
  }

  @Post('bills')
  @Roles('superuser', 'admin', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  createBill(@Body() dto: CreateBillDto) {
    return this.ordersService.createBill(dto);
  }

  // ── Payments ──
  @Get('payments/all')
  @Roles('superuser', 'admin', 'cashier')
  findAllPayments() {
    return this.ordersService.findAllPayments();
  }

  @Get('payments/:billNo')
  @Roles('superuser', 'admin', 'cashier')
  findOnePayment(@Param('billNo') billNo: string) {
    return this.ordersService.findOnePayment(billNo);
  }

  @Post('payments')
  @Roles('superuser', 'admin', 'cashier')
  @HttpCode(HttpStatus.CREATED)
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.ordersService.createPayment(dto);
  }
}
