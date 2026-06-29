import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { TIPS } from '@/lib/tips';
import { cn } from '@/lib/cn';

// Tempos: primeira dica logo após entrar; cada dica fica um tempo curto na tela;
// intervalo maior entre uma dica e a próxima. Roda a lista uma vez por sessão.
const INITIAL_DELAY_MS = 15_000; // ~15s após abrir
const VISIBLE_MS = 8_000; // ~8s na tela
const GAP_MS = 3 * 60_000; // ~3min entre uma dica e a próxima

export function TipsToaster() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (index >= TIPS.length) return;
    let hideId: ReturnType<typeof setTimeout>;
    let nextId: ReturnType<typeof setTimeout>;
    const delay = index === 0 ? INITIAL_DELAY_MS : GAP_MS;
    const showId = setTimeout(() => {
      setVisible(true);
      hideId = setTimeout(() => {
        setVisible(false);
        nextId = setTimeout(() => setIndex((i) => i + 1), 400);
      }, VISIBLE_MS);
    }, delay);
    return () => {
      clearTimeout(showId);
      clearTimeout(hideId);
      clearTimeout(nextId);
    };
  }, [index]);

  // Fecha a dica atual; a próxima volta a aparecer só após o intervalo normal.
  function dismiss() {
    setVisible(false);
    setIndex((i) => i + 1);
  }

  if (index >= TIPS.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] transition-all duration-500 print:hidden',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <div className="flex items-start gap-3 rounded-lg border border-grena/15 bg-white p-3 shadow-lg">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-grena/10 text-grena">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-grena">Dica</p>
          <p className="mt-0.5 text-sm text-gray-700">{TIPS[index]}</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar dica"
          className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
