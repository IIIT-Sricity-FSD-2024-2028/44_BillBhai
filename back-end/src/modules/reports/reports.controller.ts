import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

/**
 * ReportsController: Provides summary statistics for Admins and Super Users.
 */
@Controller('reports')
@ApiTags('Reports')
@ApiSecurity('x-role')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Get sales summary report' })
  getSalesSummary() {
    return this.reportsService.getSalesSummary();
  }

  @Get('inventory')
  @Roles('superuser', 'admin', 'inventorymanager')
  @ApiOperation({ summary: 'Get inventory status report' })
  getInventoryStatus() {
    return this.reportsService.getInventoryStatus();
  }

  @Get('returns')
  @Roles('superuser', 'admin', 'returnhandler')
  @ApiOperation({ summary: 'Get returns summary report' })
  getReturnsSummary() {
    return this.reportsService.getReturnsSummary();
  }
}
