import { useQuery } from '@tanstack/react-query';
import { ReportQuery, UserActivityReport } from '@chamados/shared';
import { api } from '@/lib/api';

export function useUserActivityReport(params: ReportQuery, enabled: boolean) {
  return useQuery({
    queryKey: ['report-user-activity', params],
    queryFn: async () =>
      (await api.get<UserActivityReport>('/reports/user-activity', { params })).data,
    enabled,
  });
}
