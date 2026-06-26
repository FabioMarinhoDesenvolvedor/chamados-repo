import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  // Vazio = todos os usuários.
  @IsOptional()
  @IsUUID()
  userId?: string;

  // Datas no formato YYYY-MM-DD (do <input type="date">).
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
