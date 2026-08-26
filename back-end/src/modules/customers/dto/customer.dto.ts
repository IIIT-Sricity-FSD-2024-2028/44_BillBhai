import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

export class CreateCustomerDto {
  @ApiProperty({ example: 'BIZ-101', description: 'Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: 'Rahul Sharma', description: 'Customer name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '9810001001', description: 'Mobile number' })
  @IsString()
  mobileNo: string;

  @ApiProperty({
    example: 'rahul@example.com',
    description: 'Email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
  email?: string;

  @ApiProperty({
    example: '12, MG Road, Sector 14',
    description: 'Address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateCustomerDto {
  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Customer name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: '9810001002',
    description: 'Mobile number',
    required: false,
  })
  @IsOptional()
  @IsString()
  mobileNo?: string;

  @ApiProperty({
    example: 'rahul@example.com',
    description: 'Email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
  email?: string;

  @ApiProperty({
    example: '12, MG Road, Sector 14',
    description: 'Address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;
}
