import { IsIn } from 'class-validator';
import { TICKET_STATUSES, TicketStatus } from '@chamados/shared';

export class UpdateStatusDto {
  @IsIn(TICKET_STATUSES)
  status!: TicketStatus;
}
