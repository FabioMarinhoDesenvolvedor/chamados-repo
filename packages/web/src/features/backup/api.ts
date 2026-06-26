import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BackupList, BackupRunResult } from '@chamados/shared';
import { api } from '@/lib/api';

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: async () => (await api.get<BackupList>('/backup')).data,
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<BackupRunResult>('/backup/run')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
}
