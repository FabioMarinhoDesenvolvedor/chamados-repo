import { useQuery } from '@tanstack/react-query';
import { CategoryWithSubcategories } from '@chamados/shared';
import { api } from '@/lib/api';

// Blocos + subcategorias (dado de referência) — cache longo.
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<CategoryWithSubcategories[]>('/categories')).data,
    staleTime: 1000 * 60 * 30,
  });
}
