import { IsUUID } from 'class-validator';

export class AssignTicketDto {
  @IsUUID()
  assignedTo!: string;
}
