import { TicketStatus } from '@chamados/shared';
import { Badge } from './ui/badge';
import { STATUS_CLASS, STATUS_LABEL } from '@/lib/labels';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}
