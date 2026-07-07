import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AssignTicketDto {
  @Type(() => Number)
  @IsInt()
  assignedTo!: number;
}
