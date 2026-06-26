import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type VaultStatus = 'UNINITIALIZED' | 'LOCKED' | 'UNLOCKED';

export function useVaultStatus(enabled = true) {
  return useQuery({
    queryKey: ['vault-status'],
    queryFn: async () => (await api.get<{ status: VaultStatus }>('/vault/status')).data,
    enabled,
    refetchInterval: 60000,
  });
}

export function useUnlockVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) =>
      (await api.post<{ status: VaultStatus }>('/vault/unlock', { password })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-status'] }),
  });
}
