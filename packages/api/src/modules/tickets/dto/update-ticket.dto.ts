import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;
}
