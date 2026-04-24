import { IsString, IsEmail, IsOptional, IsIn } from 'class-validator';

const VALID_ROLES = ['superuser', 'admin', 'cashier', 'returnhandler', 'inventorymanager', 'deliveryops', 'customer'];

export class CreateUserDto {
  @IsString() companyId: string;
  @IsString() name: string;
  @IsIn(VALID_ROLES) role: string;
  @IsEmail() email: string;
  @IsString() mobileNo: string;
  @IsString() username: string;
  @IsString() password: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(VALID_ROLES) role?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() mobileNo?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsIn(['Active', 'Inactive', 'Suspended']) status?: string;
}
