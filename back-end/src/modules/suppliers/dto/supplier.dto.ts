import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @IsString() name: string;
  @IsString() mobileNo: string;
  @IsEmail() email: string;
  @IsString() address: string;
  @IsOptional() @IsString() gstNo?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() mobileNo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gstNo?: string;
}
