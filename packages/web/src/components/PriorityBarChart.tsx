import { Priority } from '@chamados/shared';
import { Card } from '@/components/ui/card';
import { PRIORITY_LABEL } from '@/lib/labels';

const BAR: Record<Priority, string> = {
  LOW: 'bg-green-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-red-400',
  URGENT: 'bg-purple-500',
};
const ORDER: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function PriorityBarChart({ counts }: { counts: Record<Priority, number> }) {
  const max = Math.max(1, ...ORDER.map((p) => counts[p]));
  return (
    <Card className="p-4">
      <div className="mb-3 text-xs font-semibold text-gray-500">Chamados por prioridade</div>
      <div className="flex h-32 items-end gap-3">
        {ORDER.map((p) => (
          <div key={p} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-gray-600">{counts[p]}</span>
            <div
              className={`w-full rounded-t ${BAR[p]}`}
              style={{ height: `${(counts[p] / max) * 100}%`, minHeight: counts[p] ? 6 : 2 }}
            />
            <span className="text-[10px] text-gray-500">{PRIORITY_LABEL[p]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
