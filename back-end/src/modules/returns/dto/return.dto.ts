import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateReturnDto {
  @IsString() orderId: string;
  @IsString() staffId: string;
  @IsString() reason: string;
  @IsNumber() @Min(0) refundAmount: number;
  @IsString() returnType: string; // e.g., 'refund', 'exchange'
  @IsString() product: string;
  @IsNumber() @Min(1) qty: number;
  @IsString() requestedBy: string;
}

export class UpdateReturnDto {
  @IsOptional() @IsNumber() @Min(0) refundAmount?: number;
  @IsOptional() @IsIn(['Pending', 'Approved', 'Refunded', 'Rejected', 'Under Review']) status?: string;
  @IsOptional() @IsString() reason?: string;
}
