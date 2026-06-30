import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

// Spinner de carregamento reutilizável (sensação de "carregando").
export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-gray-500', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-grena" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
