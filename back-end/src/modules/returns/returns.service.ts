import { Injectable, NotFoundException } from '@nestjs/common';
import { seedReturns } from '../../common/seed/seed-data';
import { CreateReturnDto, UpdateReturnDto } from './dto/return.dto';

@Injectable()
export class ReturnsService {
  private returns = seedReturns.map((r) => ({ ...r }));
  private counter = 222;

  findAll(status?: string) {
    return status
      ? this.returns.filter((r) => r.status === status)
      : this.returns;
  }

  findOne(id: string) {
    const ret = this.returns.find((r) => r.id === id);
    if (!ret) throw new NotFoundException(`Return request ${id} not found`);
    return ret;
  }

  create(dto: CreateReturnDto) {
    const newReturn = {
      id: `RET-${this.counter++}`,
      ...dto,
      returnDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
    };
    this.returns.unshift(newReturn);
    return newReturn;
  }

  update(id: string, dto: UpdateReturnDto) {
    const idx = this.returns.findIndex((r) => r.id === id);
    if (idx === -1)
      throw new NotFoundException(`Return request ${id} not found`);
    this.returns[idx] = { ...this.returns[idx], ...dto };
    return this.returns[idx];
  }

  remove(id: string) {
    const idx = this.returns.findIndex((r) => r.id === id);
    if (idx === -1)
      throw new NotFoundException(`Return request ${id} not found`);
    const [removed] = this.returns.splice(idx, 1);
    return { message: `Return request ${id} deleted`, return: removed };
  }
}
