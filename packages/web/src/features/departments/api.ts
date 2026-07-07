import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateDepartmentInput, Department } from '@chamados/shared';
import { api } from '@/lib/api';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDepartmentInput) =>
      (await api.post<Department>('/departments', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
    meta: { successMessage: 'Departamento criado' },
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/departments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
    meta: { successMessage: 'Departamento removido' },
  });
}
