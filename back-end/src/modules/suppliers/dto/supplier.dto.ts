import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

export class CreateSupplierDto {
  @ApiProperty({ example: 'Agarwal Traders', description: 'Supplier name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '9811544101', description: 'Mobile number' })
  @IsString()
  mobileNo: string;

  @ApiProperty({ example: 'agarwal@traders.in', description: 'Email address' })
  @IsEmail()
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
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
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
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
