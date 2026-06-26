import { Card } from '@/components/ui/card';

export function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'bg-grena-gradient p-4 text-white' : 'p-4'}>
      <div className={highlight ? 'text-xs opacity-90' : 'text-xs text-gray-500'}>{label}</div>
      <div className={highlight ? 'text-3xl font-bold' : 'text-3xl font-bold text-grena'}>
        {value}
      </div>
    </Card>
  );
}
