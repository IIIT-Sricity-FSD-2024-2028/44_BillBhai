import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliveryDto {
  @ApiProperty({ example: 'ORD-4821', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({
    example: 'DHL Express',
    description: 'Delivery partner name',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerName?: string;

  @ApiProperty({
    example: '+91 98111 22334',
    description: 'Delivery partner phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerPhone?: string;

  @ApiProperty({
    example: 'SwiftDrop Logistics',
    description: 'Delivery partner agency/team',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerAgency?: string;

  @ApiProperty({
    example: 'Bike',
    description: 'Delivery partner vehicle',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerVehicle?: string;

  @ApiProperty({
    example: '2026-02-20',
    description: 'Dispatch date',
    required: false,
  })
  @IsOptional()
  @IsString()
  dispatchDate?: string;

  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Customer name',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    example: '12, MG Road, Sector 14',
    description: 'Delivery address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateDeliveryDto {
  @ApiProperty({
    example: 'DHL Express',
    description: 'Delivery partner name',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerName?: string;

  @ApiProperty({
    example: '+91 98111 22334',
    description: 'Delivery partner phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerPhone?: string;

  @ApiProperty({
    example: 'SwiftDrop Logistics',
    description: 'Delivery partner agency/team',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerAgency?: string;

  @ApiProperty({
    example: 'Bike',
    description: 'Delivery partner vehicle',
    required: false,
  })
  @IsOptional()
  @IsString()
  partnerVehicle?: string;

  @ApiProperty({
    example: '2026-02-20',
    description: 'Dispatch date',
    required: false,
  })
  @IsOptional()
  @IsString()
  dispatchDate?: string;

  @ApiProperty({
    example: '2026-02-22',
    description: 'Delivery date',
    required: false,
  })
  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @ApiProperty({
    enum: ['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Failed'],
    description: 'Delivery status',
    required: false,
  })
  @IsOptional()
  @IsIn(['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Failed'])
  status?: string;
}
