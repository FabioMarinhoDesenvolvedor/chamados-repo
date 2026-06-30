import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from './toast-store';
import { apiMessage } from './api';

// Feedback automático de TODA mutação (DRY):
// - sucesso → toast verde, se a mutação definir `meta.successMessage`;
// - erro → toast vermelho com a mensagem da API (ou `meta.errorMessage`).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const message = mutation.meta?.successMessage as string | undefined;
      if (message) toast.success(message);
    },
    onError: (err, _vars, _ctx, mutation) => {
      const fallback = (mutation.meta?.errorMessage as string | undefined) ?? 'Não foi possível concluir a ação';
      toast.error(apiMessage(err, fallback));
    },
  }),
});
