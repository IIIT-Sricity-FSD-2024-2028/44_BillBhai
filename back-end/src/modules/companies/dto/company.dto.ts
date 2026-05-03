import { IsString, IsEmail, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'FreshKart Central', description: 'Company name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Ritu Malhotra', description: 'Owner name' })
  @IsString()
  owner: string;

  @ApiProperty({ example: 'Arjun Mehta', description: 'Admin name' })
  @IsString()
  adminName: string;

  @ApiProperty({ example: 'Grocery Retail', description: 'Company type' })
  @IsString()
  type: string;

  @ApiProperty({
    example: 'central@freshkart.in',
    description: 'Company email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+91-9870011101', description: 'Company phone' })
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'GST101',
    description: 'GST number',
    required: false,
  })
  @IsOptional()
  @IsString()
  gstNo?: string;

  @ApiProperty({
    example: 'Delhi, India',
    description: 'Company address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: 'Core POS + Inventory',
    description: 'Products plan',
    required: false,
  })
  @IsOptional()
  @IsString()
  productsPlan?: string;

  @ApiProperty({
    example: 32,
    description: 'Tenure in months',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenureMonths?: number;

  @ApiProperty({
    example: 6,
    description: 'Number of stores',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storesCount?: number;
}

export class UpdateCompanyDto {
  @ApiProperty({
    example: 'FreshKart Central',
    description: 'Company name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Ritu Malhotra',
    description: 'Owner name',
    required: false,
  })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({
    example: 'Arjun Mehta',
    description: 'Admin name',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminName?: string;

  @ApiProperty({
    example: 'Grocery Retail',
    description: 'Company type',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({
    example: 'central@freshkart.in',
    description: 'Company email',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '+91-9870011101',
    description: 'Company phone',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'GST101',
    description: 'GST number',
    required: false,
  })
  @IsOptional()
  @IsString()
  gstNo?: string;

  @ApiProperty({
    example: 'Delhi, India',
    description: 'Company address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: 'Active',
    description: 'Company status',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    example: 'Core POS + Inventory',
    description: 'Products plan',
    required: false,
  })
  @IsOptional()
  @IsString()
  productsPlan?: string;

  @ApiProperty({
    example: 32,
    description: 'Tenure in months',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenureMonths?: number;

  @ApiProperty({
    example: 6,
    description: 'Number of stores',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storesCount?: number;

  @ApiProperty({
    example: 1245000,
    description: 'Profit',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  profit?: number;

  @ApiProperty({
    example: 0,
    description: 'Payment due',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentDue?: number;
}
