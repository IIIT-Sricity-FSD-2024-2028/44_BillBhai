import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'SUP-001', description: 'Supplier ID' })
  @IsString()
  supplierId: string;

  @ApiProperty({ example: 'Basmati Rice', description: 'Product name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Groceries', description: 'Product category' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'BAR001', description: 'Barcode', required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 380, description: 'Product price', minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: '5kg', description: 'Product size', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({
    example: 'Premium basmati rice',
    description: 'Product description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProductDto {
  @ApiProperty({
    example: 'SUP-001',
    description: 'Supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    example: 'Basmati Rice',
    description: 'Product name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Groceries',
    description: 'Product category',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'BAR001', description: 'Barcode', required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    example: 400,
    description: 'Product price',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ example: '5kg', description: 'Product size', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({
    example: 'Premium basmati rice',
    description: 'Product description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
