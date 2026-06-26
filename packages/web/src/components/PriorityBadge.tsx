import { Priority } from '@chamados/shared';
import { Badge } from './ui/badge';
import { PRIORITY_CLASS, priorityLabel } from '@/lib/labels';

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  const className = priority ? PRIORITY_CLASS[priority] : 'bg-grena/10 text-grena ring-grena/30';
  return <Badge className={className}>{priorityLabel(priority)}</Badge>;
}
