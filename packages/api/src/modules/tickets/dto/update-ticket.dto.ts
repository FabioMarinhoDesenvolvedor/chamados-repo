import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { COMPLEXITIES, Complexity } from '@chamados/shared';

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(COMPLEXITIES)
  complexity?: Complexity;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
