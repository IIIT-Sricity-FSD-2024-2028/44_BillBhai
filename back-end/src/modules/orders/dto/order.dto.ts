import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ example: 'P001', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity ordered', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 380, description: 'Price per item', minimum: 0 })
  @IsNumber()
  @Min(0)
  itemPrice: number;
}

export class CreateOrderDto {
  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Customer display name',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    example: '12, MG Road, Sector 14',
    description: 'Customer delivery address captured at checkout',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerAddress?: string;

  @ApiProperty({ example: 'CUS-001', description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: 'USR-002', description: 'Staff ID' })
  @IsString()
  staffId: string;

  @ApiProperty({ example: 'BIZ-101', description: 'Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ enum: ['pickup', 'delivery'], description: 'Order type' })
  @IsIn(['pickup', 'delivery'])
  orderType: string;

  @ApiProperty({
    enum: ['takeaway_now', 'prepaid_delivery', 'cod_delivery'],
    description: 'Checkout mode',
  })
  @IsIn(['takeaway_now', 'prepaid_delivery', 'cod_delivery'])
  checkoutMode: string;

  @ApiProperty({
    example: 100,
    description: 'Discount amount',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({
    example: 'WELCOME10',
    description: 'Promotion code',
    required: false,
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiProperty({
    example: 'UPI',
    description: 'Payment method',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class ValidatePromotionDto {
  @ApiProperty({ example: 'WELCOME10', description: 'Promotion code' })
  @IsString()
  code: string;

  @ApiProperty({ example: 1250, description: 'Order subtotal', minimum: 0 })
  @IsNumber()
  @Min(0)
  subtotal: number;
}

export class UpdateOrderDto {
  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Editable customer display name',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    example: '12, MG Road, Sector 14',
    description: 'Editable customer delivery address',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerAddress?: string;

  @ApiProperty({
    example: 3,
    description: 'Editable item count shown in the orders table',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemsCount?: number;

  @ApiProperty({
    example: 1250,
    description: 'Editable order total shown in the orders table',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiProperty({
    enum: ['Pending', 'Processing', 'Delivered', 'Cancelled'],
    description: 'Order status',
    required: false,
  })
  @IsOptional()
  @IsIn(['Pending', 'Processing', 'Delivered', 'Cancelled'])
  status?: string;

  @ApiProperty({
    example: 'Card',
    description: 'Payment method',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateBillDto {
  @ApiProperty({ example: 'ORD-4821', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({
    example: 50,
    description: 'Tax amount',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({
    example: 0,
    description: 'Discount amount',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreatePaymentDto {
  @ApiProperty({ example: 'BILL-001', description: 'Bill number' })
  @IsString()
  billNo: string;

  @ApiProperty({ example: 'Card', description: 'Payment method' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 1250, description: 'Amount paid', minimum: 0 })
  @IsNumber()
  @Min(0)
  amountPaid: number;
}
