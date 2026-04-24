import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() productId: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) itemPrice: number;
}

export class CreateOrderDto {
  @IsString() customerId: string;
  @IsString() staffId: string;
  @IsString() companyId: string;
  @IsIn(['pickup', 'delivery']) orderType: string;
  @IsIn(['takeaway_now', 'prepaid_delivery', 'cod_delivery']) checkoutMode: string;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}

export class UpdateOrderDto {
  @IsOptional() @IsIn(['Pending', 'Processing', 'Delivered', 'Cancelled']) status?: string;
  @IsOptional() @IsString() paymentMethod?: string;
}

export class CreateBillDto {
  @IsString() orderId: string;
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
}

export class CreatePaymentDto {
  @IsString() billNo: string;
  @IsString() paymentMethod: string;
  @IsNumber() @Min(0) amountPaid: number;
}
