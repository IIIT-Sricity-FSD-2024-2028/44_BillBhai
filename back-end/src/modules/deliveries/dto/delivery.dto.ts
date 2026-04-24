import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateDeliveryDto {
  @IsString() orderId: string;
  @IsOptional() @IsString() partnerName?: string;
  @IsOptional() @IsString() dispatchDate?: string;
}

export class UpdateDeliveryDto {
  @IsOptional() @IsString() partnerName?: string;
  @IsOptional() @IsString() dispatchDate?: string;
  @IsOptional() @IsString() deliveryDate?: string;
  @IsOptional() @IsIn(['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Failed']) status?: string;
}
