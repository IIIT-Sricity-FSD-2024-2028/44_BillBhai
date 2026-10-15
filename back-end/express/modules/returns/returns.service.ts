import { seedReturns } from '../../data/seed-data';
import { ReturnRecord } from '../../data/entities';
import { BadRequestError, NotFoundError } from '../../errors/http-error';
import { ordersService, OrdersService } from '../orders/orders.service';
import {
  CreateReturnDto,
  DeleteReturnResult,
  UpdateReturnDto,
} from './returns.schema';

/**
 * Returns Module Service
 *
 * Owns the returns and refunds store. Framework agnostic: no express imports,
 * no request or response objects, no HTTP status codes.
 *
 * Ids continue the legacy sequence: RET-222 is the first one this service mints.
 */
export class ReturnsService {
  private returns: ReturnRecord[];
  private counter: number;

  constructor(private readonly orders: OrdersService = ordersService) {
    this.returns = seedReturns.map((entry) => ({ ...entry }));
    this.counter = 222;
  }

  private clone(entry: ReturnRecord): ReturnRecord {
    return { ...entry };
  }

  /** Today as YYYY-MM-DD - the default return date. */
  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  /** A return must point at a real order and can never refund more than was paid. */
  private checkAgainstOrder(orderId: string, refundAmount: number): void {
    let total: number;
    try {
      total = this.orders.findOneOrder(orderId).total;
    } catch {
      throw new BadRequestError(`Order ${orderId} does not exist`);
    }
    if (refundAmount > total) {
      throw new BadRequestError(
        `Refund of ${refundAmount} is more than the order total of ${total}`,
      );
    }
  }

  public findAll(status?: string): ReturnRecord[] {
    return this.returns
      .filter((entry) => (status ? entry.status === status : true))
      .map((entry) => this.clone(entry));
  }

  public findOne(id: string): ReturnRecord {
    const entry = this.returns.find((record) => record.id === id);
    if (!entry) {
      throw new NotFoundError(`Return ${id} not found`);
    }
    return this.clone(entry);
  }

  public create(dto: CreateReturnDto): ReturnRecord {
    this.checkAgainstOrder(dto.orderId, dto.refundAmount || 0);
    const created: ReturnRecord = {
      id: `RET-${this.counter++}`,
      companyId: dto.companyId,
      orderId: dto.orderId,
      staffId: dto.staffId,
      returnDate: dto.returnDate || this.today(),
      reason: dto.reason || '',
      refundAmount: dto.refundAmount || 0,
      status: dto.status || 'Pending',
      returnType: dto.returnType || 'refund',
      product: dto.product || '',
      qty: dto.qty || 1,
      requestedBy: dto.requestedBy || '',
    };

    this.returns.push(created);
    return this.clone(created);
  }

  public update(id: string, dto: UpdateReturnDto): ReturnRecord {
    const index = this.returns.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundError(`Return ${id} not found`);
    }

    const current = this.returns[index];
    const isFinal = current.status === 'Refunded' || current.status === 'Rejected';
    if (isFinal && dto.status && dto.status !== current.status) {
      throw new BadRequestError(`Return ${id} is already ${current.status} and cannot change`);
    }
    const next = { ...current, ...dto };
    if (dto.orderId !== undefined || dto.refundAmount !== undefined) {
      this.checkAgainstOrder(next.orderId, next.refundAmount || 0);
    }

    this.returns[index] = next;
    return this.clone(this.returns[index]);
  }

  public remove(id: string): DeleteReturnResult {
    const index = this.returns.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundError(`Return ${id} not found`);
    }

    const [removed] = this.returns.splice(index, 1);
    return { message: `Return ${id} deleted`, 'return': removed };
  }
}

export const returnsService = new ReturnsService();
