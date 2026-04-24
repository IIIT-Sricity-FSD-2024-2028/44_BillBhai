import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ReturnsModule } from '../returns/returns.module';

@Module({
  imports: [OrdersModule, InventoryModule, ReturnsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
