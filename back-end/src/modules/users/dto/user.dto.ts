import { IsString, IsEmail, IsOptional, IsIn, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

const VALID_ROLES = [
  'superuser',
  'admin',
  'cashier',
  'returnhandler',
  'inventorymanager',
  'deliveryops',
  'customer',
];

export class CreateUserDto {
  @ApiProperty({ example: 'BIZ-101', description: 'Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: 'Arjun Mehta', description: 'User name' })
  @IsString()
  name: string;

  @ApiProperty({ enum: VALID_ROLES, description: 'User role' })
  @IsIn(VALID_ROLES)
  role: string;

  @ApiProperty({ example: 'admin@billbhai.com', description: 'User email' })
  @IsEmail()
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
  email: string;

  @ApiProperty({ example: '9870011201', description: 'Mobile number' })
  @IsString()
  mobileNo: string;

  @ApiProperty({ example: 'admin', description: 'Username' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'admin123', description: 'Password' })
  @IsString()
  password: string;
}

export class UpdateUserDto {
  @ApiProperty({
    example: 'Arjun Mehta',
    description: 'User name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: VALID_ROLES, description: 'User role', required: false })
  @IsOptional()
  @IsIn(VALID_ROLES)
  role?: string;

  @ApiProperty({
    example: 'admin@billbhai.com',
    description: 'User email',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @Matches(EMAIL_PATTERN, { message: 'email must be a valid address' })
  email?: string;

  @ApiProperty({
    example: '9870011201',
    description: 'Mobile number',
    required: false,
  })
  @IsOptional()
  @IsString()
  mobileNo?: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'Password',
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    enum: ['Active', 'Inactive', 'Suspended'],
    description: 'User status',
    required: false,
  })
  @IsOptional()
  @IsIn(['Active', 'Inactive', 'Suspended'])
  status?: string;
}
