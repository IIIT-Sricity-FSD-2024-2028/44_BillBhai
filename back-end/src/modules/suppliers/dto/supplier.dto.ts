import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Agarwal Traders', description: 'Supplier name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '9811544101', description: 'Mobile number' })
  @IsString()
  mobileNo: string;

  @ApiProperty({ example: 'agarwal@traders.in', description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Delhi', description: 'Address' })
  @IsString()
  address: string;

  @ApiProperty({
    example: 'GSTSUP001',
    description: 'GST number',
    required: false,
  })
  @IsOptional()
  @IsString()
  gstNo?: string;
}

export class UpdateSupplierDto {
  @ApiProperty({
    example: 'Agarwal Traders',
    description: 'Supplier name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: '9811544101',
    description: 'Mobile number',
    required: false,
  })
  @IsOptional()
  @IsString()
  mobileNo?: string;

  @ApiProperty({
    example: 'agarwal@traders.in',
    description: 'Email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Delhi', description: 'Address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: 'GSTSUP001',
    description: 'GST number',
    required: false,
  })
  @IsOptional()
  @IsString()
  gstNo?: string;
}
