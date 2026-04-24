import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * ReportsController: Provides summary statistics for Admins and Super Users.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles('superuser', 'admin')
  getSalesSummary() {
    return this.reportsService.getSalesSummary();
  }

  @Get('inventory')
  @Roles('superuser', 'admin', 'inventorymanager')
  getInventoryStatus() {
    return this.reportsService.getInventoryStatus();
  }

  @Get('returns')
  @Roles('superuser', 'admin', 'returnhandler')
  getReturnsSummary() {
    return this.reportsService.getReturnsSummary();
  }
}
