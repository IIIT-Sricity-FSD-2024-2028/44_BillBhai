import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { seedDeliveries } from '../../common/seed/seed-data';
import { CreateDeliveryDto, UpdateDeliveryDto } from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  private deliveries = seedDeliveries.map(d => ({ ...d }));
  private counter = 902;

  findAll(status?: string) {
    return status ? this.deliveries.filter(d => d.status === status) : this.deliveries;
  }

  findOne(id: string) {
    const d = this.deliveries.find(d => d.id === id);
    if (!d) throw new NotFoundException(`Delivery ${id} not found`);
    return d;
  }

  findByOrder(orderId: string) {
    const d = this.deliveries.find(d => d.orderId === orderId);
    if (!d) throw new NotFoundException(`No delivery found for order ${orderId}`);
    return d;
  }

  create(dto: CreateDeliveryDto) {
    const exists = this.deliveries.find(d => d.orderId === dto.orderId);
    if (exists) throw new ConflictException(`Delivery already exists for order ${dto.orderId}`);
    const newDelivery = {
      id: `DEL-${this.counter++}`,
      orderId: dto.orderId,
      partnerName: dto.partnerName ?? 'Unassigned',
      dispatchDate: dto.dispatchDate ?? null,
      deliveryDate: null,
      status: dto.partnerName ? 'Dispatched' : 'Pending',
    };
    this.deliveries.unshift(newDelivery);
    return newDelivery;
  }

  update(id: string, dto: UpdateDeliveryDto) {
    const idx = this.deliveries.findIndex(d => d.id === id);
    if (idx === -1) throw new NotFoundException(`Delivery ${id} not found`);
    this.deliveries[idx] = { ...this.deliveries[idx], ...dto };
    return this.deliveries[idx];
  }

  remove(id: string) {
    const idx = this.deliveries.findIndex(d => d.id === id);
    if (idx === -1) throw new NotFoundException(`Delivery ${id} not found`);
    const [removed] = this.deliveries.splice(idx, 1);
    return { message: `Delivery ${id} deleted`, delivery: removed };
  }
}
