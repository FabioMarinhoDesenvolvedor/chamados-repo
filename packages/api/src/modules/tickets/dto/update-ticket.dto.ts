import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
