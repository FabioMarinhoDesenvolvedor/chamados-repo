import { useMutation } from '@tanstack/react-query';
import { CreateKioskTokenInput, KioskTokenResponse } from '@chamados/shared';
import { api } from '@/lib/api';

export function useCreateKioskToken() {
  return useMutation({
    mutationFn: async (input: CreateKioskTokenInput) =>
      (await api.post<KioskTokenResponse>('/auth/kiosk-token', input)).data,
  });
}
