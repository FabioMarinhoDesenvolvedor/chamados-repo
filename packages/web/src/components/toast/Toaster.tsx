import { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { subscribe, getToasts, dismissToast, Toast, ToastKind } from '@/lib/toast-store';
import { cn } from '@/lib/cn';

// Visual herdado do TipsToaster: cartão discreto no canto inferior direito.
const STYLES: Record<ToastKind, { icon: typeof Info; accent: string; border: string }> = {
  success: { icon: CheckCircle2, accent: 'bg-green-50 text-green-600', border: 'border-green-200' },
  error: { icon: XCircle, accent: 'bg-red-50 text-red-600', border: 'border-red-200' },
  info: { icon: Info, accent: 'bg-grena/10 text-grena', border: 'border-grena/15' },
};

function ToastCard({ toast }: { toast: Toast }) {
  const [shown, setShown] = useState(false);
  // Anima a entrada (translate + opacity), como as dicas.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const style = STYLES[toast.kind];
  const Icon = style.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-white p-3 shadow-lg transition-all duration-300',
        style.border,
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', style.accent)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="flex-1 text-sm text-gray-700">{toast.message}</p>
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Fechar"
        className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
