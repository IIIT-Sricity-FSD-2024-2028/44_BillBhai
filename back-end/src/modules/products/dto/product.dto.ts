import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() supplierId: string;
  @IsString() name: string;
  @IsString() category: string;
  @IsOptional() @IsString() barcode?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() description?: string;
}
