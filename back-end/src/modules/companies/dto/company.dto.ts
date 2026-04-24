import { IsString, IsEmail, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateCompanyDto {
  @IsString() name: string;
  @IsString() owner: string;
  @IsString() adminName: string;
  @IsString() type: string;
  @IsEmail() email: string;
  @IsString() phone: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() productsPlan?: string;
  @IsOptional() @IsNumber() @Min(0) tenureMonths?: number;
  @IsOptional() @IsNumber() @Min(0) storesCount?: number;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() owner?: string;
  @IsOptional() @IsString() adminName?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() productsPlan?: string;
  @IsOptional() @IsNumber() @Min(0) tenureMonths?: number;
  @IsOptional() @IsNumber() @Min(0) storesCount?: number;
  @IsOptional() @IsNumber() @Min(0) profit?: number;
  @IsOptional() @IsNumber() @Min(0) paymentDue?: number;
}
