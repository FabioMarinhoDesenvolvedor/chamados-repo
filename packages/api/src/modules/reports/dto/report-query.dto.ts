import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ReportQueryDto {
  // Vazio = todos os usuarios.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  // Datas no formato YYYY-MM-DD (do <input type="date">).
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subcategoryId?: number;
}
