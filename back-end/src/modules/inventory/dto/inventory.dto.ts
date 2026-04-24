import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateInventoryDto {
  @IsOptional() @IsNumber() @Min(0) stockAvailable?: number;
  @IsOptional() @IsNumber() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() location?: string;
}

export class AdjustStockDto {
  @IsString() productId: string;
  @IsNumber() adjustment: number; // positive = restock, negative = deduct
  @IsOptional() @IsString() reason?: string;
}
