import { IsIn, IsOptional } from 'class-validator';
import { PRIORITIES, Priority, TICKET_STATUSES, TicketStatus } from '@chamados/shared';

export class TicketQueryDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: Priority;
}
