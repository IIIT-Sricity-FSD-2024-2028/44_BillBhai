import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReturnDto {
  @ApiProperty({ example: 'BIZ-102', description: 'Company ID' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ example: 'ORD-4821', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'USR-002', description: 'Staff ID' })
  @IsString()
  staffId: string;

  @ApiProperty({ example: 'Damaged product', description: 'Return reason' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 100, description: 'Refund amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  refundAmount: number;

  @ApiProperty({ example: 'refund', description: 'Return type' })
  @IsString()
  returnType: string;

  @ApiProperty({ example: 'P001', description: 'Product ID' })
  @IsString()
  product: string;

  @ApiProperty({ example: 1, description: 'Quantity returned', minimum: 1 })
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiProperty({
    example: 'Arjun Mehta',
    description: 'Name of person requesting return',
  })
  @IsString()
  requestedBy: string;
}

export class UpdateReturnDto {
  @ApiProperty({
    example: 100,
    description: 'Refund amount',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @ApiProperty({
    enum: ['Pending', 'Approved', 'Refunded', 'Rejected', 'Under Review'],
    description: 'Return status',
    required: false,
  })
  @IsOptional()
  @IsIn(['Pending', 'Approved', 'Refunded', 'Rejected', 'Under Review'])
  status?: string;

  @ApiProperty({
    example: 'Damaged product',
    description: 'Return reason',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
