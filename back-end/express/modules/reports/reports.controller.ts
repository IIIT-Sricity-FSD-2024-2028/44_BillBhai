import { Request } from 'express';
import { handle, query } from '../../utils/http';
import { listScope } from '../../utils/scope';
import { reportsService, ReportsService } from './reports.service';

/** Reports Module Controller - always one business, optional date range. */
export class ReportsController {
  constructor(private readonly service: ReportsService = reportsService) {}

  private scope(req: Request) {
    return {
      companyId: listScope(req, query(req, 'companyId')),
      from: query(req, 'from'),
      to: query(req, 'to'),
    };
  }

  public getSalesReport = handle((req) => this.service.getSalesReport(this.scope(req)));
  public getInventoryReport = handle((req) => this.service.getInventoryReport(this.scope(req)));
  public getReturnsReport = handle((req) => this.service.getReturnsReport(this.scope(req)));
}

export const reportsController = new ReportsController();
