import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInventoryDto {
  @ApiProperty({
    example: 145,
    description: 'Available stock',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockAvailable?: number;

  @ApiProperty({
    example: 20,
    description: 'Reorder level',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @ApiProperty({
    example: 'Shelf A1',
    description: 'Storage location',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
}

export class AdjustStockDto {
  @ApiProperty({ example: 'P001', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({
    example: 10,
    description: 'Stock adjustment (positive=restock, negative=deduct)',
  })
  @IsNumber()
  adjustment: number;

  @ApiProperty({
    example: 'Restock from warehouse',
    description: 'Reason for adjustment',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
